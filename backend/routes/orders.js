const express = require('express');
const Order = require('../models/Order');
const Book = require('../models/Book');
const User = require('../models/User');
const Coupon = require('../models/Coupon');
const { auth } = require('../middleware/auth');
const { createNotification } = require('./notifications');
const { sendOrderConfirmationEmail, sendSellerOrderNotificationEmail } = require('../utils/emailService');
const { calculateShippingCharges, validatePincode, getShippingInfo } = require('../utils/shippingUtils');

const router = express.Router();

// Calculate shipping charges endpoint
router.post('/calculate-shipping', auth, async (req, res) => {
  try {
    const { zipCode, subtotal = 0 } = req.body;

    if (!zipCode) {
      return res.status(400).json({ message: 'ZIP code is required' });
    }

    const validation = validatePincode(zipCode);
    if (!validation.isValid) {
      return res.status(400).json({ message: validation.message });
    }

    const shippingCharges = calculateShippingCharges(zipCode, subtotal);
    const shippingInfo = getShippingInfo(zipCode, subtotal);

    res.json({
      zipCode,
      subtotal,
      shippingCharges,
      shippingInfo,
      freeShippingThreshold: 2000,
      amountForFreeShipping: Math.max(0, 2000 - subtotal)
    });
  } catch (error) {
    console.error('Calculate shipping error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Create a new order
router.post('/', auth, async (req, res) => {
  try {
    const { items, shippingAddress, paymentMethod, couponDiscount = 0, appliedCoupon } = req.body;

    // Validate shipping address PIN code
    if (!shippingAddress.zipCode) {
      return res.status(400).json({ message: 'ZIP code is required for shipping calculation' });
    }

    const pincodeValidation = validatePincode(shippingAddress.zipCode);
    if (!pincodeValidation.isValid) {
      return res.status(400).json({ message: pincodeValidation.message });
    }

    // Validate items and calculate totals
    let subtotal = 0;
    const orderItems = [];

    for (const item of items) {
      const book = await Book.findById(item.bookId);
      if (!book) {
        return res.status(404).json({ message: `Book not found: ${item.bookId}` });
      }

      if (book.stock < item.quantity) {
        return res.status(400).json({ 
          message: `Insufficient stock for ${book.title}. Available: ${book.stock}` 
        });
      }

      const itemTotal = book.price * item.quantity;
      subtotal += itemTotal;

      orderItems.push({
        book: book._id,
        quantity: item.quantity,
        price: book.price
      });

      // Note: Stock will be reduced when order status changes to 'confirmed' in Order model
    }

    // Calculate shipping charges based on PIN code and discounted subtotal
    const discountedSubtotal = subtotal - couponDiscount;
    const shippingCost = calculateShippingCharges(shippingAddress.zipCode, discountedSubtotal);
    const total = subtotal - couponDiscount + shippingCost;

    console.log(`Order shipping calculation: PIN ${shippingAddress.zipCode}, Subtotal: ₹${subtotal}, Discount: ₹${couponDiscount}, Discounted Subtotal: ₹${discountedSubtotal}, Shipping: ₹${shippingCost}, Total: ₹${total}`);

    // Handle coupon usage
    let couponData = null;
    if (appliedCoupon && couponDiscount > 0) {
      const Coupon = require('../models/Coupon');
      const coupon = await Coupon.findOne({ 
        code: appliedCoupon.code.toUpperCase(),
        isActive: true 
      });

      if (coupon && coupon.isValid()) {
        // Increment usage count
        coupon.usedCount += 1;
        await coupon.save();
        
        couponData = {
          code: coupon.code,
          description: coupon.description,
          type: coupon.type,
          value: coupon.value
        };
        
        console.log(`Coupon ${coupon.code} used. New usage count: ${coupon.usedCount}`);
      } else {
        return res.status(400).json({ message: 'Invalid or expired coupon' });
      }
    }

    const order = new Order({
      user: req.user._id,
      items: orderItems,
      shippingAddress,
      paymentMethod,
      subtotal,
      shippingCost,
      couponDiscount,
      appliedCoupon: couponData,
      total,
      orderStatus: 'confirmed', // Set to confirmed immediately for successful orders
      paymentStatus: paymentMethod === 'cash_on_delivery' ? 'pending' : 'paid',
      estimatedDelivery: new Date(Date.now() + 5 * 24 * 60 * 60 * 1000) // 5 days from now
    });

    await order.save();
    
    // Populate the order with book and seller information for notifications
    await order.populate({
      path: 'items.book',
      select: 'title author images price seller',
      populate: {
        path: 'seller',
        select: 'name email'
      }
    });

    console.log(`Order ${order.orderNumber} created with ${order.items.length} items${couponDiscount > 0 ? ` and coupon discount of ₹${couponDiscount}` : ''}`);

    // Send order confirmation email immediately
    try {
      await sendOrderConfirmationEmail(
        req.user.email,
        req.user.name,
        order
      );
      console.log(`✅ Order confirmation email sent for order ${order.orderNumber}`);
    } catch (emailError) {
      console.error('❌ Error sending order confirmation email:', emailError);
    }

    // Notify sellers about new order immediately (since order is created with 'confirmed' status)
    try {
      console.log(`🔔 Starting seller notifications for order ${order.orderNumber}`);
      await order.notifySellersAboutNewOrder();
      console.log(`✅ Seller notifications completed for order ${order.orderNumber}`);
    } catch (notificationError) {
      console.error('❌ Error notifying sellers about new order:', notificationError);
    }

    // Create notification for admin users
    try {
      const adminUsers = await User.find({ role: 'admin' });
      for (const admin of adminUsers) {
        await createNotification(
          admin._id,
          'order',
          'New Order Received!',
          `New order ${order.orderNumber} received from ${req.user.name}. Total: ₹${order.total}. Shipping to: ${order.shippingAddress?.landmark ? `${order.shippingAddress.landmark}, ` : ''}${order.shippingAddress?.city || 'N/A'}`,
          { 
            orderId: order._id,
            orderNumber: order.orderNumber,
            customerName: req.user.name,
            shippingAddress: order.shippingAddress
          }
        );
      }
    } catch (notificationError) {
      console.error('Error creating admin notifications:', notificationError);
    }

    res.status(201).json({
      message: 'Order created successfully',
      order
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Get user orders
router.get('/my-orders', auth, async (req, res) => {
  try {
    const { page = 1, limit = 10 } = req.query;
    const skip = (page - 1) * limit;

    const orders = await Order.find({ user: req.user._id })
      .populate('items.book', 'title author images price')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(Number(limit));

    const total = await Order.countDocuments({ user: req.user._id });

    res.json({
      orders,
      pagination: {
        current: Number(page),
        pages: Math.ceil(total / limit),
        total
      }
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Get single order
router.get('/:id', auth, async (req, res) => {
  try {
    const order = await Order.findOne({
      _id: req.params.id,
      user: req.user._id
    }).populate('items.book', 'title author images price');

    if (!order) {
      return res.status(404).json({ message: 'Order not found' });
    }

    res.json(order);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Cancel order
router.patch('/:id/cancel', auth, async (req, res) => {
  try {
    const { reason } = req.body;
    
    const order = await Order.findOne({
      _id: req.params.id,
      user: req.user._id
    });

    if (!order) {
      return res.status(404).json({ message: 'Order not found' });
    }

    if (!order.canBeCancelled()) {
      return res.status(400).json({ 
        message: 'Order cannot be cancelled. Orders can only be cancelled before shipping.' 
      });
    }

    // Cancel the order (this will trigger the pre-save hook to restore stock)
    await order.cancelOrder(reason || 'Cancelled by user');
    
    // Populate the order for response
    await order.populate('items.book', 'title author images price');

    res.json({ 
      message: 'Order cancelled successfully. Stock has been restored and refund will be processed.', 
      order 
    });
  } catch (error) {
    console.error('Cancel order error:', error);
    if (error.message === 'Order cannot be cancelled at this stage') {
      return res.status(400).json({ message: error.message });
    }
    res.status(500).json({ message: 'Server error' });
  }
});

module.exports = router;
