const express = require('express');
const Razorpay = require('razorpay');
const crypto = require('crypto');
const { auth } = require('../middleware/auth');
const Order = require('../models/Order');

const router = express.Router();

// Initialize Razorpay
const razorpay = new Razorpay({
  key_id: process.env.RAZORPAY_KEY_ID,
  key_secret: process.env.RAZORPAY_KEY_SECRET,
});

// Create Razorpay order
router.post('/create-order', auth, async (req, res) => {
  try {
    const { amount, currency = 'INR' } = req.body;

    const options = {
      amount: Math.round(amount * 100), // Convert to paise
      currency,
      receipt: `receipt_${Date.now()}`,
      payment_capture: 1,
    };

    const razorpayOrder = await razorpay.orders.create(options);

    res.json({
      success: true,
      order: razorpayOrder,
      key_id: process.env.RAZORPAY_KEY_ID,
    });
  } catch (error) {
    console.error('Razorpay order creation error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to create payment order',
    });
  }
});

// Verify payment
router.post('/verify-payment', auth, async (req, res) => {
  try {
    const {
      razorpay_order_id,
      razorpay_payment_id,
      razorpay_signature,
      orderData
    } = req.body;

    console.log('Payment verification request:', {
      razorpay_order_id,
      razorpay_payment_id,
      orderData: { ...orderData, items: orderData.items?.length + ' items' }
    });

    // Verify signature
    const body = razorpay_order_id + '|' + razorpay_payment_id;
    const expectedSignature = crypto
      .createHmac('sha256', process.env.RAZORPAY_KEY_SECRET)
      .update(body.toString())
      .digest('hex');

    if (expectedSignature !== razorpay_signature) {
      console.log('Signature verification failed');
      return res.status(400).json({
        success: false,
        message: 'Payment verification failed - Invalid signature',
      });
    }

    // Create order in database
    const Book = require('../models/Book');
    const User = require('../models/User');
    const { createNotification } = require('./notifications');
    
    // Validate order data
    if (!orderData.items || orderData.items.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'No items in order',
      });
    }
    
    // Get book details and reduce stock immediately on successful payment
    const bookIds = orderData.items.map(item => item.bookId);
    const books = await Book.find({ _id: { $in: bookIds } });
    
    if (books.length !== orderData.items.length) {
      return res.status(400).json({
        success: false,
        message: 'Some books not found',
      });
    }
    
    const orderItems = [];
    
    // Process each item and reduce stock immediately
    for (const item of orderData.items) {
      const book = books.find(b => b._id.toString() === item.bookId);
      if (!book) {
        throw new Error(`Book not found: ${item.bookId}`);
      }
      
      if (book.stock < item.quantity) {
        return res.status(400).json({
          success: false,
          message: `Insufficient stock for ${book.title}. Available: ${book.stock}`,
        });
      }
      
      orderItems.push({
        book: item.bookId,
        quantity: item.quantity,
        price: book.price
      });
      
      // Note: Stock will be reduced when order status changes to 'confirmed' in Order model
    }

    const order = new Order({
      user: req.user._id,
      items: orderItems,
      shippingAddress: orderData.shippingAddress,
      paymentMethod: 'razorpay',
      paymentStatus: 'paid',
      orderStatus: 'confirmed',
      razorpayOrderId: razorpay_order_id,
      razorpayPaymentId: razorpay_payment_id,
      subtotal: orderData.subtotal,
      shippingCost: orderData.shippingCost,
      tax: orderData.tax || 0,
      total: orderData.total,
      couponDiscount: orderData.couponDiscount || 0,
      appliedCoupon: orderData.appliedCoupon ? {
        code: orderData.appliedCoupon.code,
        description: orderData.appliedCoupon.description,
        type: orderData.appliedCoupon.type,
        value: orderData.appliedCoupon.value
      } : null,
      estimatedDelivery: new Date(Date.now() + 5 * 24 * 60 * 60 * 1000) // 5 days from now
    });

    // Ensure orderNumber is generated
    if (!order.orderNumber) {
      const count = await Order.countDocuments();
      order.orderNumber = `ORD${Date.now()}${String(count + 1).padStart(4, '0')}`;
    }

    await order.save();
    await order.populate('items.book', 'title author images price');

    // Create notification for admin users
    try {
      const adminUsers = await User.find({ role: 'admin' });
      for (const admin of adminUsers) {
        await createNotification(
          admin._id,
          'order',
          'New Order Received!',
          `New order ${order.orderNumber} received from ${req.user.name}. Total: ₹${order.total}`,
          { orderId: order._id }
        );
      }
      console.log(`Admin notifications sent for order ${order.orderNumber}`);
    } catch (notificationError) {
      console.error('Error creating admin notifications:', notificationError);
    }

    console.log('Order created successfully:', order._id);

    res.json({
      success: true,
      message: 'Payment verified successfully',
      order,
    });
  } catch (error) {
    console.error('Payment verification error:', error);
    res.status(500).json({
      success: false,
      message: 'Payment verification failed - Server error',
      error: error.message
    });
  }
});

// Get payment details
router.get('/payment/:paymentId', auth, async (req, res) => {
  try {
    const payment = await razorpay.payments.fetch(req.params.paymentId);
    res.json({
      success: true,
      payment,
    });
  } catch (error) {
    console.error('Payment fetch error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch payment details',
    });
  }
});

module.exports = router;
