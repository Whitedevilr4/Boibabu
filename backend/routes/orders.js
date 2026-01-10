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

// Simple test route for email (no auth required)
router.get('/test-email-simple', async (req, res) => {
  try {
    console.log('Starting email service test');
    
    const { sendSellerOrderNotificationEmail } = require('../utils/emailService');
    
    // Create a mock order for testing
    const mockOrder = {
      orderNumber: 'TEST123',
      createdAt: new Date(),
      shippingAddress: {
        name: 'Test Customer',
        street: '123 Test St',
        city: 'Test City',
        state: 'Test State',
        zipCode: '12345',
        country: 'India',
        phone: '1234567890'
      },
      paymentMethod: 'cash_on_delivery',
      paymentStatus: 'pending'
    };
    
    const mockSellerBooks = [{
      book: { title: 'Test Book' },
      quantity: 1,
      price: 500
    }];
    
    console.log('Calling email service');
    
    const result = await sendSellerOrderNotificationEmail(
      'test@example.com',
      'Test Seller',
      mockOrder,
      mockSellerBooks
    );
    
    console.log('Email test completed');
    
    res.json({ success: true, result, message: 'Test email completed' });
  } catch (error) {
    console.error('Email test error:', error.message);
    res.status(500).json({ message: 'Test email failed', error: error.message });
  }
});

// Diagnostic route to check books with sellers
router.get('/check-sellers', async (req, res) => {
  try {
    const Book = require('../models/Book');
    const User = require('../models/User');
    
    console.log('Checking books with sellers...');
    
    // Get all books
    const totalBooks = await Book.countDocuments();
    console.log(`Total books in database: ${totalBooks}`);
    
    // Get books with sellers
    const booksWithSellers = await Book.find({ seller: { $ne: null } })
      .populate('seller', 'name email role')
      .select('title author seller');
    
    console.log(`Books with sellers: ${booksWithSellers.length}`);
    
    // Get all sellers
    const sellers = await User.find({ role: 'seller' }).select('name email');
    console.log(`Total sellers: ${sellers.length}`);
    
    res.json({
      totalBooks,
      booksWithSellers: booksWithSellers.length,
      booksWithSellersDetails: booksWithSellers.map(book => ({
        title: book.title,
        author: book.author,
        seller: book.seller ? {
          name: book.seller.name,
          email: book.seller.email
        } : null
      })),
      totalSellers: sellers.length,
      sellers: sellers.map(seller => ({
        name: seller.name,
        email: seller.email
      }))
    });
  } catch (error) {
    console.error('Check sellers error:', error);
    res.status(500).json({ message: 'Check failed', error: error.message });
  }
});

// Test order creation with seller book
router.get('/test-order-with-seller', async (req, res) => {
  try {
    const Book = require('../models/Book');
    const User = require('../models/User');
    
    console.log('🧪 TEST: Creating test order with seller book...');
    
    // Find a book with a seller
    const bookWithSeller = await Book.findOne({ seller: { $ne: null } })
      .populate('seller', 'name email');
    
    if (!bookWithSeller) {
      return res.status(404).json({ message: 'No books with sellers found' });
    }
    
    console.log(`🧪 TEST: Found book "${bookWithSeller.title}" with seller "${bookWithSeller.seller.name}"`);
    
    // Find a test user (or create one)
    let testUser = await User.findOne({ email: 'test@example.com' });
    if (!testUser) {
      testUser = await User.findOne({ role: 'user' });
    }
    
    if (!testUser) {
      return res.status(404).json({ message: 'No test user found' });
    }
    
    console.log(`🧪 TEST: Using test user: ${testUser.name}`);
    
    // Create a test order
    const testOrder = new Order({
      user: testUser._id,
      items: [{
        book: bookWithSeller._id,
        quantity: 1,
        price: bookWithSeller.price
      }],
      shippingAddress: {
        name: 'Test Customer',
        street: '123 Test St',
        city: 'Test City',
        state: 'Test State',
        zipCode: '12345',
        country: 'India',
        phone: '1234567890'
      },
      paymentMethod: 'cash_on_delivery',
      subtotal: bookWithSeller.price,
      shippingCost: 70,
      total: bookWithSeller.price + 70,
      orderStatus: 'confirmed',
      paymentStatus: 'pending'
    });
    
    await testOrder.save();
    
    // Populate the order with book and seller information
    await testOrder.populate({
      path: 'items.book',
      select: 'title author images price seller',
      populate: {
        path: 'seller',
        select: 'name email'
      }
    });
    
    console.log(`🧪 TEST: Test order ${testOrder.orderNumber} created`);
    
    // Trigger seller notifications
    console.log(`🧪 TEST: Triggering seller notifications...`);
    await testOrder.notifySellersAboutNewOrder();
    
    res.json({
      success: true,
      message: 'Test order created and notifications sent',
      order: {
        orderNumber: testOrder.orderNumber,
        book: bookWithSeller.title,
        seller: bookWithSeller.seller.name,
        total: testOrder.total
      }
    });
    
  } catch (error) {
    console.error('🧪 TEST: Error creating test order:', error);
    res.status(500).json({ message: 'Test order failed', error: error.message });
  }
});

// Create new order
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

      // Update book stock
      book.stock -= item.quantity;
      await book.save();
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

// Test email route (for debugging)
router.post('/test-seller-email', auth, async (req, res) => {
  try {
    console.log('Testing seller email notification...');
    
    // Create a mock order for testing
    const mockOrder = {
      orderNumber: 'TEST123',
      createdAt: new Date(),
      shippingAddress: {
        name: 'Test Customer',
        street: '123 Test St',
        city: 'Test City',
        state: 'Test State',
        zipCode: '12345',
        country: 'India',
        phone: '1234567890'
      },
      paymentMethod: 'cash_on_delivery',
      paymentStatus: 'pending'
    };
    
    const mockSellerBooks = [{
      book: { title: 'Test Book' },
      quantity: 1,
      price: 500
    }];
    
    const result = await sendSellerOrderNotificationEmail(
      'test@example.com',
      'Test Seller',
      mockOrder,
      mockSellerBooks
    );
    
    res.json({ success: true, result, message: 'Test email sent' });
  } catch (error) {
    console.error('Test email error:', error);
    res.status(500).json({ message: 'Test email failed', error: error.message });
  }
});

module.exports = router;
