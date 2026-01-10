const express = require('express');
const mongoose = require('mongoose');
const { body, validationResult } = require('express-validator');
const Book = require('../models/Book');
const BookRequest = require('../models/BookRequest');
const Order = require('../models/Order');
const User = require('../models/User');
const Notification = require('../models/Notification');
const EmailCampaign = require('../models/EmailCampaign');
const WebsiteSettings = require('../models/WebsiteSettings');
const PublisherAd = require('../models/PublisherAd');
const HeroSlide = require('../models/HeroSlide');
const Page = require('../models/Page');
const { createNotification } = require('../utils/notificationService');
const { adminAuth } = require('../middleware/auth');
const LANGUAGES = require('../constants/languages');
const { 
  sendSellerOrderNotificationEmail, 
  sendComplaintResolvedEmail, 
  sendAccountSuspensionEmail,
  sendMarketingEmail,
  sendBulkEmails,
  getEmailTemplate
} = require('../utils/emailService');

// Import Cloudinary configuration
const {
  uploadBook,
  uploadUser,
  uploadHeroSlide,
  uploadPublisherAd,
  deleteImage,
  extractPublicId
} = require('../config/cloudinary');

const router = express.Router();

// Dashboard stats
router.get('/dashboard', adminAuth, async (req, res) => {
  try {
    const totalBooks = await Book.countDocuments();
    const totalOrders = await Order.countDocuments();
    const totalUsers = await User.countDocuments({ role: 'user' });
    const totalSellers = await User.countDocuments({ role: 'seller' });
    const pendingBookRequests = await BookRequest.countDocuments({ status: 'pending' });
    
    const totalRevenue = await Order.aggregate([
      { $match: { orderStatus: { $in: ['delivered', 'shipped', 'returned'] } } },
      { 
        $group: { 
          _id: null, 
          grossRevenue: { $sum: '$total' },
          totalRefunds: { $sum: '$refundAmount' },
          netRevenue: { $sum: { $subtract: ['$total', { $ifNull: ['$refundAmount', 0] }] } }
        } 
      }
    ]);

    const refundStats = await Order.aggregate([
      { $match: { refundAmount: { $gt: 0 } } },
      {
        $group: {
          _id: null,
          totalRefunds: { $sum: '$refundAmount' },
          refundCount: { $sum: 1 }
        }
      }
    ]);

    const recentOrders = await Order.find()
      .populate('user', 'name email')
      .populate('items.book', 'title')
      .sort({ createdAt: -1 })
      .limit(5);

    const lowStockBooks = await Book.find({ stock: { $lte: 5 } })
      .select('title stock')
      .limit(10);

    res.json({
      stats: {
        totalBooks,
        totalOrders,
        totalUsers,
        totalSellers,
        pendingBookRequests,
        totalRevenue: totalRevenue[0]?.netRevenue || 0,
        grossRevenue: totalRevenue[0]?.grossRevenue || 0,
        totalRefunds: totalRevenue[0]?.totalRefunds || 0,
        refundCount: refundStats[0]?.refundCount || 0
      },
      recentOrders,
      lowStockBooks
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Create seller account
router.post('/sellers', adminAuth, [
  body('name').trim().isLength({ min: 2 }).withMessage('Name must be at least 2 characters'),
  body('email').isEmail().withMessage('Please enter a valid email'),
  body('password').isLength({ min: 6 }).withMessage('Password must be at least 6 characters')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { name, email, password } = req.body;

    // Check if user already exists
    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res.status(400).json({ message: 'User already exists with this email' });
    }

    // Create seller account
    const seller = new User({
      name,
      email,
      password,
      role: 'seller',
      createdBy: req.user._id,
      isEmailVerified: true
    });

    await seller.save();

    res.status(201).json({
      message: 'Seller account created successfully',
      seller: {
        id: seller._id,
        name: seller.name,
        email: seller.email,
        role: seller.role,
        createdAt: seller.createdAt
      }
    });
  } catch (error) {
    console.error('Create seller error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Get all sellers
router.get('/sellers', adminAuth, async (req, res) => {
  try {
    const sellers = await User.find({ role: 'seller' })
      .populate('createdBy', 'name')
      .select('name email createdAt createdBy')
      .sort({ createdAt: -1 });

    res.json({
      sellers,
      count: sellers.length
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Get book requests for admin approval
router.get('/book-requests', adminAuth, async (req, res) => {
  try {
    const { status = 'pending', page = 1, limit = 10 } = req.query;

    const filter = {};
    if (status !== 'all') {
      filter.status = status;
    }

    const requests = await BookRequest.find(filter)
      .populate('seller', 'name email')
      .populate('originalBook', 'title author')
      .populate('reviewedBy', 'name')
      .sort({ submittedAt: -1 })
      .limit(limit * 1)
      .skip((page - 1) * limit);

    const total = await BookRequest.countDocuments(filter);

    res.json({
      requests,
      pagination: {
        current: page,
        pages: Math.ceil(total / limit),
        total
      }
    });
  } catch (error) {
    console.error('Get book requests error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Approve book request
router.post('/book-requests/:requestId/approve', adminAuth, async (req, res) => {
  try {
    const { requestId } = req.params;

    const bookRequest = await BookRequest.findById(requestId)
      .populate('seller', 'name email');

    if (!bookRequest) {
      return res.status(404).json({ message: 'Book request not found' });
    }

    if (bookRequest.status !== 'pending') {
      return res.status(400).json({ message: 'Request has already been processed' });
    }

    // Create new book from request data
    const bookData = {
      ...bookRequest.bookData,
      seller: bookRequest.seller._id,
      createdBy: req.user._id,
      images: bookRequest.bookData.images || [] // Images are already Cloudinary URLs
    };

    const book = new Book(bookData);
    await book.save();

    // Update request status
    bookRequest.status = 'approved';
    bookRequest.processedBy = req.user._id;
    bookRequest.processedAt = new Date();
    await bookRequest.save();

    // Create notification for seller
    await createNotification(
      bookRequest.seller._id,
      'general',
      'Book Request Approved',
      `Your book "${bookRequest.bookData.title}" has been approved and is now live on the platform.`,
      { bookId: book._id }
    );

    // Send email notification
    try {
      await sendSellerOrderNotificationEmail(
        bookRequest.seller.email,
        bookRequest.seller.name,
        'Book Request Approved',
        `Your book "${bookRequest.bookData.title}" has been approved and is now available for purchase.`
      );
    } catch (emailError) {
      console.error('Error sending approval email:', emailError);
    }

    res.json({
      message: 'Book request approved successfully',
      book
    });
  } catch (error) {
    console.error('Error approving book request:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Reject book request
router.post('/book-requests/:requestId/reject', adminAuth, [
  body('adminNotes').trim().isLength({ min: 1 }).withMessage('Rejection note is required')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { requestId } = req.params;
    const { adminNotes } = req.body;

    const bookRequest = await BookRequest.findById(requestId)
      .populate('seller', 'name email');

    if (!bookRequest) {
      return res.status(404).json({ message: 'Book request not found' });
    }

    if (bookRequest.status !== 'pending') {
      return res.status(400).json({ message: 'Request has already been processed' });
    }

    // Update request status
    bookRequest.status = 'rejected';
    bookRequest.reviewedBy = req.user._id;
    bookRequest.reviewedAt = new Date();
    bookRequest.adminNotes = adminNotes;
    await bookRequest.save();

    // Create notification for seller
    await createNotification(
      bookRequest.seller._id,
      'general',
      'Book Request Rejected',
      `Your ${bookRequest.type} request for "${bookRequest.bookData.title}" has been rejected.`,
      {
        requestId: bookRequest._id,
        bookTitle: bookRequest.bookData.title,
        adminNotes
      }
    );

    res.json({
      message: 'Book request rejected successfully',
      request: bookRequest
    });
  } catch (error) {
    console.error('Reject book request error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Get all books for admin
router.get('/books', adminAuth, async (req, res) => {
  try {
    const { page = 1, limit = 20, search } = req.query;
    const filter = {};
    
    if (search) {
      filter.$text = { $search: search };
    }

    const skip = (page - 1) * limit;
    const books = await Book.find(filter)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(Number(limit));

    const total = await Book.countDocuments(filter);

    res.json({
      books,
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

// Create new book
router.post('/books', adminAuth, uploadBook.array('images', 5), async (req, res) => {
  try {
    console.log('Creating new book with data:', req.body);
    console.log('Uploaded files:', req.files);

    const {
      title,
      author,
      isbn,
      description,
      price,
      category,
      language,
      publisher,
      publishedDate,
      pages,
      stock,
      featured
    } = req.body;

    // Get Cloudinary URLs from uploaded files
    const imageUrls = req.files ? req.files.map(file => file.path) : [];

    const book = new Book({
      title,
      author,
      isbn,
      description,
      price: parseFloat(price),
      category,
      language,
      publisher,
      publishedDate: publishedDate ? new Date(publishedDate) : undefined,
      pages: pages ? parseInt(pages) : undefined,
      stock: parseInt(stock) || 0,
      images: imageUrls, // Now contains Cloudinary URLs
      featured: featured === 'true',
      createdBy: req.user.id
    });

    await book.save();
    console.log('Book created successfully:', book._id);

    res.status(201).json({
      message: 'Book created successfully',
      book
    });
  } catch (error) {
    console.error('Error creating book:', error);
    
    // Clean up uploaded images if book creation fails
    if (req.files) {
      for (const file of req.files) {
        try {
          const publicId = extractPublicId(file.path);
          if (publicId) {
            await deleteImage(publicId);
          }
        } catch (cleanupError) {
          console.error('Error cleaning up uploaded image:', cleanupError);
        }
      }
    }
    
    res.status(500).json({ 
      message: 'Error creating book', 
      error: error.message 
    });
  }
});

// Update book
router.put('/books/:id', adminAuth, uploadBook.array('images', 5), async (req, res) => {
  try {
    console.log('Updating book with ID:', req.params.id);
    console.log('Update data received:', req.body);
    
    const book = await Book.findById(req.params.id);
    if (!book) {
      console.log('Book not found:', req.params.id);
      return res.status(404).json({ message: 'Book not found' });
    }

    const updateData = { ...req.body };
    
    // Handle new image uploads
    if (req.files && req.files.length > 0) {
      console.log('Processing new images:', req.files.length);
      
      // Delete old images from Cloudinary
      if (book.images && book.images.length > 0) {
        for (const imageUrl of book.images) {
          try {
            const publicId = extractPublicId(imageUrl);
            if (publicId) {
              await deleteImage(publicId);
              console.log('Deleted old image from Cloudinary:', publicId);
            }
          } catch (deleteError) {
            console.error('Error deleting old image:', deleteError);
          }
        }
      }

      // Get new Cloudinary URLs
      updateData.images = req.files.map(file => file.path);
      console.log('New images processed:', updateData.images.length);
    }

    // Convert numeric fields safely
    if (updateData.price !== undefined && updateData.price !== '') {
      updateData.price = Number(updateData.price);
      if (isNaN(updateData.price)) {
        return res.status(400).json({ message: 'Invalid price value' });
      }
    }

    if (updateData.stock !== undefined && updateData.stock !== '') {
      updateData.stock = Number(updateData.stock);
      if (isNaN(updateData.stock)) {
        return res.status(400).json({ message: 'Invalid stock value' });
      }
    }

    if (updateData.pages !== undefined && updateData.pages !== '') {
      updateData.pages = Number(updateData.pages);
      if (isNaN(updateData.pages)) {
        return res.status(400).json({ message: 'Invalid pages value' });
      }
    }

    // Convert boolean fields
    if (updateData.featured !== undefined) {
      updateData.featured = updateData.featured === 'true' || updateData.featured === true;
    }

    // Convert date fields
    if (updateData.publishedDate && updateData.publishedDate !== '') {
      updateData.publishedDate = new Date(updateData.publishedDate);
    }

    console.log('Final update data:', updateData);

    const updatedBook = await Book.findByIdAndUpdate(
      req.params.id,
      updateData,
      { new: true, runValidators: true }
    );

    console.log('Book updated successfully');
    res.json({
      message: 'Book updated successfully',
      book: updatedBook
    });
  } catch (error) {
    console.error('Error updating book:', error);
    
    // Clean up newly uploaded images if update fails
    if (req.files) {
      for (const file of req.files) {
        try {
          const publicId = extractPublicId(file.path);
          if (publicId) {
            await deleteImage(publicId);
          }
        } catch (cleanupError) {
          console.error('Error cleaning up uploaded image:', cleanupError);
        }
      }
    }
    
    res.status(500).json({ 
      message: 'Error updating book', 
      error: error.message 
    });
  }
});

// Delete book
// Delete book
router.delete('/books/:id', adminAuth, async (req, res) => {
  try {
    const book = await Book.findById(req.params.id);
    if (!book) {
      return res.status(404).json({ message: 'Book not found' });
    }

    // Delete images from Cloudinary
    if (book.images && book.images.length > 0) {
      for (const imageUrl of book.images) {
        try {
          const publicId = extractPublicId(imageUrl);
          if (publicId) {
            await deleteImage(publicId);
            console.log('Deleted image from Cloudinary:', publicId);
          }
        } catch (deleteError) {
          console.error('Error deleting image from Cloudinary:', deleteError);
        }
      }
    }

    await Book.findByIdAndDelete(req.params.id);
    res.json({ message: 'Book deleted successfully' });
  } catch (error) {
    console.error('Error deleting book:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Get all orders for admin
router.get('/orders', adminAuth, async (req, res) => {
  try {
    const { page = 1, limit = 20, status } = req.query;
    const filter = {};
    
    if (status) filter.orderStatus = status;

    const skip = (page - 1) * limit;
    const orders = await Order.find(filter)
      .populate('user', 'name email')
      .populate({
        path: 'items.book',
        select: 'title author seller',
        populate: {
          path: 'seller',
          select: 'name email'
        }
      })
      .populate('sellerPayments.seller', 'name email')
      .populate('sellerPayments.paidBy', 'name')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(Number(limit));

    const total = await Order.countDocuments(filter);

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

// Get single order details for admin
router.get('/orders/:id', adminAuth, async (req, res) => {
  try {
    const order = await Order.findById(req.params.id)
      .populate('user', 'name email phone')
      .populate({
        path: 'items.book',
        select: 'title author seller price images',
        populate: {
          path: 'seller',
          select: 'name email'
        }
      })
      .populate('sellerPayments.seller', 'name email')
      .populate('sellerPayments.paidBy', 'name')
      .populate('statusHistory.updatedBy', 'name');

    if (!order) {
      return res.status(404).json({ message: 'Order not found' });
    }

    res.json(order);
  } catch (error) {
    console.error('Error fetching order details:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Update order status
router.patch('/orders/:id/status', adminAuth, async (req, res) => {
  try {
    const { orderStatus, trackingNumber, notes } = req.body;
    
    const order = await Order.findById(req.params.id);
    if (!order) {
      return res.status(404).json({ message: 'Order not found' });
    }

    console.log(`Admin ${req.user.name} updating order ${order.orderNumber} status from ${order.orderStatus} to ${orderStatus}`);

    // Set metadata for the pre-save hook
    order._updatedBy = req.user._id;
    order._statusNotes = notes;

    // Update order fields
    order.orderStatus = orderStatus;
    if (trackingNumber) order.trackingNumber = trackingNumber;
    if (orderStatus === 'delivered') order.deliveredAt = new Date();
    if (orderStatus === 'shipped' && !order.estimatedDelivery) {
      order.estimatedDelivery = new Date(Date.now() + 5 * 24 * 60 * 60 * 1000); // 5 days from now
    }

    await order.save();
    
    // Populate the order for response
    await order.populate('user', 'name email');
    await order.populate('items.book', 'title author');
    await order.populate('statusHistory.updatedBy', 'name');

    console.log(`Order ${order.orderNumber} status updated successfully. Status history length: ${order.statusHistory?.length}`);

    res.json({ 
      message: 'Order status updated successfully', 
      order 
    });
  } catch (error) {
    console.error('Error updating order status:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Update shipping charges for an order
router.patch('/orders/:orderId/shipping', adminAuth, async (req, res) => {
  try {
    const { orderId } = req.params;
    const { shippingCost } = req.body;
    
    const order = await Order.findById(orderId);
    if (!order) {
      return res.status(404).json({ message: 'Order not found' });
    }

    // Update shipping cost
    order.shippingCost = shippingCost;
    
    // Recalculate seller payments if order is delivered
    if (order.orderStatus === 'delivered' && order.sellerPayments.length > 0) {
      await order.calculateSellerPayments();
    }
    
    await order.save();

    res.json({ 
      message: 'Shipping charges updated successfully', 
      order 
    });
  } catch (error) {
    console.error('Error updating shipping charges:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Update seller payment commission rate
router.patch('/orders/:orderId/seller-payment/:sellerId/commission', adminAuth, async (req, res) => {
  try {
    const { orderId, sellerId } = req.params;
    const { commissionRate } = req.body;
    
    if (typeof commissionRate !== 'number' || commissionRate < 0 || commissionRate > 100) {
      return res.status(400).json({ message: 'Commission rate must be between 0 and 100' });
    }

    const order = await Order.findById(orderId);
    if (!order) {
      return res.status(404).json({ message: 'Order not found' });
    }

    const payment = order.sellerPayments.find(p => p.seller.toString() === sellerId);
    if (!payment) {
      return res.status(404).json({ message: 'Seller payment not found' });
    }

    // Update commission rate and recalculate amounts
    payment.commissionRate = commissionRate;
    payment.adminCommission = payment.itemsTotal * (commissionRate / 100);
    payment.netAmount = payment.itemsTotal - payment.adminCommission - payment.shippingCharges;

    await order.save();

    // Notify seller about commission change
    await createNotification(
      sellerId,
      'general',
      'Payment Updated 💰',
      `Commission rate for order ${order.orderNumber} has been updated to ${commissionRate}%. New net amount: ₹${payment.netAmount.toFixed(2)}`,
      {
        orderId: order._id,
        orderNumber: order.orderNumber,
        commissionRate,
        netAmount: payment.netAmount
      }
    );

    res.json({ 
      message: 'Commission rate updated successfully',
      payment 
    });
  } catch (error) {
    console.error('Error updating commission rate:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Update seller payment status
router.patch('/orders/:orderId/seller-payment/:sellerId', adminAuth, async (req, res) => {
  try {
    const { orderId, sellerId } = req.params;
    const { paymentStatus, notes } = req.body;
    
    const order = await Order.findById(orderId);
    if (!order) {
      return res.status(404).json({ message: 'Order not found' });
    }

    if (paymentStatus === 'paid') {
      const payment = await order.markSellerPaymentPaid(sellerId, req.user._id, notes);
      
      // Create notification for seller
      await createNotification(
        sellerId,
        'general',
        'Payment Processed! 💰',
        `Your payment of ${payment.netAmount.toLocaleString('en-IN', { style: 'currency', currency: 'INR' })} for order ${order.orderNumber} has been processed.`,
        {
          orderId: order._id,
          orderNumber: order.orderNumber,
          amount: payment.netAmount
        }
      );
    } else {
      // Update payment status
      const payment = order.sellerPayments.find(p => p.seller.toString() === sellerId);
      if (payment) {
        payment.paymentStatus = paymentStatus;
        if (notes) payment.notes = notes;
        await order.save();
      } else {
        return res.status(404).json({ message: 'Seller payment not found' });
      }
    }

    res.json({ message: 'Payment status updated successfully' });
  } catch (error) {
    console.error('Error updating seller payment:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Get seller analytics
router.get('/sellers/:sellerId/analytics', adminAuth, async (req, res) => {
  try {
    const { sellerId } = req.params;
    
    // Verify seller exists
    const seller = await User.findById(sellerId);
    if (!seller || seller.role !== 'seller') {
      return res.status(404).json({ message: 'Seller not found' });
    }

    // Get all orders containing books from this seller
    const orders = await Order.find({
      'items.book': { $in: await Book.find({ seller: sellerId }).distinct('_id') }
    }).populate([
      { path: 'items.book', select: 'title price seller' },
      { path: 'user', select: 'name email' }
    ]);

    // Filter orders to only include items from this seller
    const sellerOrders = orders.map(order => ({
      ...order.toObject(),
      items: order.items.filter(item => 
        item.book && item.book.seller && item.book.seller.toString() === sellerId
      )
    })).filter(order => order.items.length > 0);

    // Calculate analytics
    const totalOrders = sellerOrders.length;
    const deliveredOrders = sellerOrders.filter(order => order.status === 'delivered').length;
    const cancelledOrders = sellerOrders.filter(order => order.status === 'cancelled').length;
    const pendingOrders = sellerOrders.filter(order => 
      ['pending', 'confirmed', 'shipped'].includes(order.status)
    ).length;

    // Calculate delivery rate
    const deliveryRate = totalOrders > 0 ? ((deliveredOrders / totalOrders) * 100).toFixed(1) : 0;
    
    // Calculate cancellation rate
    const cancellationRate = totalOrders > 0 ? ((cancelledOrders / totalOrders) * 100).toFixed(1) : 0;

    // Calculate total earnings (from delivered orders)
    let totalEarnings = 0;
    let totalCommission = 0;
    
    sellerOrders.forEach(order => {
      if (order.status === 'delivered') {
        order.items.forEach(item => {
          if (item.book && item.book.price) {
            const itemTotal = item.book.price * item.quantity;
            const commission = itemTotal * 0.025; // 2.5% commission
            totalEarnings += itemTotal - commission;
            totalCommission += commission;
          }
        });
      }
    });

    // Get recent orders (last 10)
    const recentOrders = sellerOrders
      .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
      .slice(0, 10)
      .map(order => ({
        _id: order._id,
        orderNumber: order.orderNumber,
        status: order.status,
        total: order.items.reduce((sum, item) => 
          sum + (item.book && item.book.price ? item.book.price * item.quantity : 0), 0
        ),
        itemCount: order.items.reduce((sum, item) => sum + item.quantity, 0),
        createdAt: order.createdAt,
        customer: order.user ? order.user.name : 'Unknown'
      }));

    // Monthly earnings (last 6 months)
    const monthlyEarnings = [];
    for (let i = 5; i >= 0; i--) {
      const date = new Date();
      date.setMonth(date.getMonth() - i);
      const monthStart = new Date(date.getFullYear(), date.getMonth(), 1);
      const monthEnd = new Date(date.getFullYear(), date.getMonth() + 1, 0);
      
      const monthOrders = sellerOrders.filter(order => 
        order.status === 'delivered' &&
        new Date(order.deliveredAt || order.createdAt) >= monthStart &&
        new Date(order.deliveredAt || order.createdAt) <= monthEnd
      );
      
      let monthEarnings = 0;
      monthOrders.forEach(order => {
        order.items.forEach(item => {
          const itemTotal = item.book.price * item.quantity;
          const commission = itemTotal * 0.025;
          monthEarnings += itemTotal - commission;
        });
      });
      
      monthlyEarnings.push({
        month: date.toLocaleDateString('en-US', { month: 'short', year: 'numeric' }),
        earnings: monthEarnings,
        orders: monthOrders.length
      });
    }

    res.json({
      seller: {
        _id: seller._id,
        name: seller.name,
        email: seller.email,
        createdAt: seller.createdAt
      },
      analytics: {
        totalOrders,
        deliveredOrders,
        cancelledOrders,
        pendingOrders,
        deliveryRate: parseFloat(deliveryRate),
        cancellationRate: parseFloat(cancellationRate),
        totalEarnings,
        totalCommission,
        recentOrders,
        monthlyEarnings
      }
    });
  } catch (error) {
    console.error('Get seller analytics error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Update commission rate
router.patch('/settings/commission', adminAuth, async (req, res) => {
  try {
    const { commissionRate } = req.body;
    
    if (typeof commissionRate !== 'number' || commissionRate < 0 || commissionRate > 100) {
      return res.status(400).json({ message: 'Commission rate must be between 0 and 100' });
    }

    // For now, we'll store this in environment or a settings collection
    // In a production app, you'd want a proper settings model
    process.env.COMMISSION_RATE = commissionRate.toString();
    
    res.json({
      message: 'Commission rate updated successfully',
      commissionRate
    });
  } catch (error) {
    console.error('Update commission rate error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Test email endpoint (for debugging)
router.post('/test-email', adminAuth, async (req, res) => {
  try {
    const { type, email } = req.body;
    
    if (type === 'seller-order') {
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
        email || 'test@example.com',
        'Test Seller',
        mockOrder,
        mockSellerBooks
      );
      
      res.json({ success: true, result });
    } else if (type === 'complaint-resolved') {
      const mockComplaint = {
        subject: 'Test Complaint',
        category: 'Test Issue',
        priority: 'Medium',
        status: 'Resolved',
        description: 'This is a test complaint',
        createdAt: new Date(),
        adminResponse: 'This issue has been resolved for testing purposes',
        adminResponseDate: new Date(),
        userType: 'user'
      };
      
      const result = await sendComplaintResolvedEmail(
        email || 'test@example.com',
        'Test User',
        mockComplaint
      );
      
      res.json({ success: true, result });
    } else {
      res.status(400).json({ message: 'Invalid test type. Use "seller-order" or "complaint-resolved"' });
    }
  } catch (error) {
    console.error('Test email error:', error);
    res.status(500).json({ message: 'Test email failed', error: error.message });
  }
});

// Debug endpoint to check user roles
router.get('/debug/users', adminAuth, async (req, res) => {
  try {
    const users = await User.find({}).select('name email role isSuspended');
    const roleStats = users.reduce((acc, user) => {
      acc[user.role] = (acc[user.role] || 0) + 1;
      return acc;
    }, {});
    
    const suspendedStats = users.reduce((acc, user) => {
      if (user.isSuspended) {
        acc.suspended = (acc.suspended || 0) + 1;
      } else {
        acc.active = (acc.active || 0) + 1;
      }
      return acc;
    }, {});

    res.json({
      totalUsers: users.length,
      roleStats,
      suspendedStats,
      sampleUsers: users.slice(0, 10).map(u => ({
        name: u.name,
        email: u.email,
        role: u.role,
        isSuspended: u.isSuspended
      }))
    });
  } catch (error) {
    console.error('Debug users error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// User Management Routes

// Get all users with analytics
router.get('/users', adminAuth, async (req, res) => {
  try {
    const { page = 1, limit = 20, role, status, search } = req.query;
    
    const filter = {};
    
    // Role filtering - only filter if role is specified
    if (role && role !== 'all') {
      filter.role = role;
    }
    
    // Status filtering
    if (status === 'suspended') {
      filter.isSuspended = true;
    } else if (status === 'active') {
      filter.isSuspended = { $ne: true };
    }
    
    // Search filtering
    if (search) {
      filter.$or = [
        { name: { $regex: search, $options: 'i' } },
        { email: { $regex: search, $options: 'i' } }
      ];
    }

    const skip = (page - 1) * limit;
    const users = await User.find(filter)
      .select('name email role isSuspended suspendedAt suspendedBy suspensionReason createdAt')
      .populate('suspendedBy', 'name')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(Number(limit));

    const total = await User.countDocuments(filter);

    res.json({
      users,
      pagination: {
        current: Number(page),
        pages: Math.ceil(total / limit),
        total
      }
    });
  } catch (error) {
    console.error('Get users error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Get user analytics
router.get('/users/:userId/analytics', adminAuth, async (req, res) => {
  try {
    const { userId } = req.params;
    
    const user = await User.findById(userId).select('-password');
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    // Get user's orders
    const orders = await Order.find({ user: userId });
    
    // Calculate analytics
    const totalOrders = orders.length;
    const totalSpent = orders.reduce((sum, order) => sum + order.total, 0);
    const cancelledOrders = orders.filter(order => order.orderStatus === 'cancelled').length;
    const deliveredOrders = orders.filter(order => order.orderStatus === 'delivered').length;
    const cancellationRate = totalOrders > 0 ? (cancelledOrders / totalOrders * 100).toFixed(2) : 0;
    
    // Get recent orders
    const recentOrders = await Order.find({ user: userId })
      .populate('items.book', 'title')
      .sort({ createdAt: -1 })
      .limit(5);

    // Order status distribution
    const statusDistribution = orders.reduce((acc, order) => {
      acc[order.orderStatus] = (acc[order.orderStatus] || 0) + 1;
      return acc;
    }, {});

    // Monthly order trend (last 6 months)
    const sixMonthsAgo = new Date();
    sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);
    
    const monthlyOrders = await Order.aggregate([
      {
        $match: {
          user: new mongoose.Types.ObjectId(userId),
          createdAt: { $gte: sixMonthsAgo }
        }
      },
      {
        $group: {
          _id: {
            year: { $year: '$createdAt' },
            month: { $month: '$createdAt' }
          },
          count: { $sum: 1 },
          total: { $sum: '$total' }
        }
      },
      { $sort: { '_id.year': 1, '_id.month': 1 } }
    ]);

    res.json({
      user: {
        _id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
        createdAt: user.createdAt,
        isSuspended: user.isSuspended,
        suspendedAt: user.suspendedAt,
        suspensionReason: user.suspensionReason
      },
      analytics: {
        totalOrders,
        totalSpent,
        cancelledOrders,
        deliveredOrders,
        cancellationRate: parseFloat(cancellationRate),
        statusDistribution,
        monthlyTrend: monthlyOrders
      },
      recentOrders
    });
  } catch (error) {
    console.error('Get user analytics error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Suspend user
router.post('/users/:userId/suspend', adminAuth, async (req, res) => {
  try {
    const { userId } = req.params;
    const { reason, notes } = req.body;
    
    if (!reason) {
      return res.status(400).json({ message: 'Suspension reason is required' });
    }

    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    if (user.role === 'admin') {
      return res.status(403).json({ message: 'Cannot suspend admin users' });
    }

    if (user.isSuspended) {
      return res.status(400).json({ message: 'User is already suspended' });
    }

    await user.suspend(req.user._id, reason, notes);

    // Send suspension email
    try {
      await sendAccountSuspensionEmail(
        user.email,
        user.name,
        reason,
        req.user.name
      );
      console.log(`Suspension email sent to ${user.email}`);
    } catch (emailError) {
      console.error('Failed to send suspension email:', emailError);
    }

    res.json({
      message: 'User suspended successfully',
      user: {
        _id: user._id,
        name: user.name,
        email: user.email,
        isSuspended: user.isSuspended,
        suspendedAt: user.suspendedAt,
        suspensionReason: user.suspensionReason
      }
    });
  } catch (error) {
    console.error('Suspend user error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Unsuspend user
router.post('/users/:userId/unsuspend', adminAuth, async (req, res) => {
  try {
    const { userId } = req.params;
    
    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    if (!user.isSuspended) {
      return res.status(400).json({ message: 'User is not suspended' });
    }

    await user.unsuspend();

    // Send unsuspension email
    try {
      const { sendAccountUnsuspensionEmail } = require('../utils/emailService');
      await sendAccountUnsuspensionEmail(
        user.email,
        user.name,
        req.user.name
      );
      console.log(`Unsuspension email sent to ${user.email}`);
    } catch (emailError) {
      console.error('Failed to send unsuspension email:', emailError);
    }

    res.json({
      message: 'User unsuspended successfully',
      user: {
        _id: user._id,
        name: user.name,
        email: user.email,
        isSuspended: user.isSuspended
      }
    });
  } catch (error) {
    console.error('Unsuspend user error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Email Marketing Routes

// Get all email campaigns
router.get('/email-campaigns', adminAuth, async (req, res) => {
  try {
    const { page = 1, limit = 20, status } = req.query;
    
    const filter = {};
    if (status && status !== 'all') {
      filter.status = status;
    }

    const skip = (page - 1) * limit;
    const campaigns = await EmailCampaign.find(filter)
      .populate('createdBy', 'name email')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(Number(limit));

    const total = await EmailCampaign.countDocuments(filter);

    res.json({
      campaigns,
      pagination: {
        current: Number(page),
        pages: Math.ceil(total / limit),
        total
      }
    });
  } catch (error) {
    console.error('Get email campaigns error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Get single email campaign
router.get('/email-campaigns/:id', adminAuth, async (req, res) => {
  try {
    const campaign = await EmailCampaign.findById(req.params.id)
      .populate('createdBy', 'name email')
      .populate('specificRecipients', 'name email role');

    if (!campaign) {
      return res.status(404).json({ message: 'Campaign not found' });
    }

    res.json(campaign);
  } catch (error) {
    console.error('Get email campaign error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Create email campaign
router.post('/email-campaigns', adminAuth, [
  body('title').trim().isLength({ min: 1 }).withMessage('Title is required'),
  body('subject').trim().isLength({ min: 1 }).withMessage('Subject is required'),
  body('content').trim().isLength({ min: 1 }).withMessage('Content is required'),
  body('template').isIn(['marketing', 'announcement', 'newsletter', 'promotion', 'official', 'custom']).withMessage('Invalid template'),
  body('recipients').isIn(['all_users', 'all_sellers', 'active_users', 'suspended_users', 'specific_users']).withMessage('Invalid recipients type')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { title, subject, content, template, recipients, specificRecipients, scheduledAt } = req.body;

    // Validate specific recipients if needed
    if (recipients === 'specific_users' && (!specificRecipients || specificRecipients.length === 0)) {
      return res.status(400).json({ message: 'Specific recipients are required when recipients type is specific_users' });
    }

    const campaign = new EmailCampaign({
      title,
      subject,
      content,
      template,
      recipients,
      specificRecipients: recipients === 'specific_users' ? specificRecipients : [],
      scheduledAt: scheduledAt ? new Date(scheduledAt) : null,
      createdBy: req.user._id,
      status: scheduledAt ? 'scheduled' : 'draft'
    });

    await campaign.save();

    res.status(201).json({
      message: 'Email campaign created successfully',
      campaign
    });
  } catch (error) {
    console.error('Create email campaign error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Update email campaign
router.put('/email-campaigns/:id', adminAuth, [
  body('title').trim().isLength({ min: 1 }).withMessage('Title is required'),
  body('subject').trim().isLength({ min: 1 }).withMessage('Subject is required'),
  body('content').trim().isLength({ min: 1 }).withMessage('Content is required'),
  body('template').isIn(['marketing', 'announcement', 'newsletter', 'promotion', 'official', 'custom']).withMessage('Invalid template'),
  body('recipients').isIn(['all_users', 'all_sellers', 'active_users', 'suspended_users', 'specific_users']).withMessage('Invalid recipients type')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const campaign = await EmailCampaign.findById(req.params.id);
    if (!campaign) {
      return res.status(404).json({ message: 'Campaign not found' });
    }

    if (campaign.status === 'sent') {
      return res.status(400).json({ message: 'Cannot update sent campaigns' });
    }

    const { title, subject, content, template, recipients, specificRecipients, scheduledAt } = req.body;

    campaign.title = title;
    campaign.subject = subject;
    campaign.content = content;
    campaign.template = template;
    campaign.recipients = recipients;
    campaign.specificRecipients = recipients === 'specific_users' ? specificRecipients : [];
    campaign.scheduledAt = scheduledAt ? new Date(scheduledAt) : null;
    campaign.status = scheduledAt ? 'scheduled' : 'draft';

    await campaign.save();

    res.json({
      message: 'Email campaign updated successfully',
      campaign
    });
  } catch (error) {
    console.error('Update email campaign error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Send email campaign
router.post('/email-campaigns/:id/send', adminAuth, async (req, res) => {
  try {
    const campaign = await EmailCampaign.findById(req.params.id);
    if (!campaign) {
      return res.status(404).json({ message: 'Campaign not found' });
    }

    if (campaign.status === 'sent') {
      return res.status(400).json({ message: 'Campaign already sent' });
    }

    // Get recipients based on campaign settings
    let recipients = [];
    
    switch (campaign.recipients) {
      case 'all_users':
        recipients = await User.find({ role: 'user' }).select('name email');
        break;
      case 'all_sellers':
        recipients = await User.find({ role: 'seller' }).select('name email');
        break;
      case 'active_users':
        recipients = await User.find({ 
          role: { $in: ['user', 'seller'] }, 
          isSuspended: { $ne: true } 
        }).select('name email');
        break;
      case 'suspended_users':
        recipients = await User.find({ 
          role: { $in: ['user', 'seller'] }, 
          isSuspended: true 
        }).select('name email');
        break;
      case 'specific_users':
        recipients = await User.find({ 
          _id: { $in: campaign.specificRecipients } 
        }).select('name email');
        break;
      default:
        return res.status(400).json({ message: 'Invalid recipients type' });
    }

    if (recipients.length === 0) {
      return res.status(400).json({ message: 'No recipients found' });
    }

    // Update campaign status
    campaign.status = 'sending';
    campaign.stats.totalRecipients = recipients.length;
    await campaign.save();

    // Send emails in background
    setImmediate(async () => {
      try {
        const result = await sendBulkEmails(
          recipients,
          campaign.subject,
          campaign.content,
          campaign.template
        );

        // Update campaign with results
        campaign.status = 'sent';
        campaign.sentAt = new Date();
        campaign.stats.sentCount = result.results.success;
        campaign.stats.failedCount = result.results.failed;
        campaign.stats.deliveryRate = recipients.length > 0 ? 
          (result.results.success / recipients.length * 100).toFixed(2) : 0;
        campaign.errorLogs = result.results.errors || [];

        await campaign.save();

        console.log(`Email campaign ${campaign.title} completed: ${result.results.success} sent, ${result.results.failed} failed`);
      } catch (error) {
        console.error('Background email sending error:', error);
        campaign.status = 'failed';
        await campaign.save();
      }
    });

    res.json({
      message: 'Email campaign is being sent',
      totalRecipients: recipients.length
    });
  } catch (error) {
    console.error('Send email campaign error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Delete email campaign
router.delete('/email-campaigns/:id', adminAuth, async (req, res) => {
  try {
    const campaign = await EmailCampaign.findById(req.params.id);
    if (!campaign) {
      return res.status(404).json({ message: 'Campaign not found' });
    }

    if (campaign.status === 'sending') {
      return res.status(400).json({ message: 'Cannot delete campaign that is currently being sent' });
    }

    await EmailCampaign.findByIdAndDelete(req.params.id);

    res.json({ message: 'Email campaign deleted successfully' });
  } catch (error) {
    console.error('Delete email campaign error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Preview email template
router.post('/email-campaigns/preview', adminAuth, [
  body('subject').trim().isLength({ min: 1 }).withMessage('Subject is required'),
  body('content').trim().isLength({ min: 1 }).withMessage('Content is required'),
  body('template').isIn(['marketing', 'announcement', 'newsletter', 'promotion', 'official', 'custom']).withMessage('Invalid template')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { subject, content, template } = req.body;

    const htmlContent = getEmailTemplate(template, {
      subject,
      content,
      userName: 'Preview User'
    });

    res.json({
      htmlContent,
      subject,
      template
    });
  } catch (error) {
    console.error('Preview email template error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Send individual email
router.post('/send-individual-email', adminAuth, [
  body('email').isEmail().withMessage('Valid email is required'),
  body('subject').trim().isLength({ min: 1 }).withMessage('Subject is required'),
  body('content').trim().isLength({ min: 1 }).withMessage('Content is required'),
  body('template').isIn(['marketing', 'announcement', 'newsletter', 'promotion', 'official', 'custom']).withMessage('Invalid template')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { email, subject, content, template, userName } = req.body;

    const result = await sendMarketingEmail(email, userName || 'User', subject, content, template);

    if (result.success) {
      res.json({
        message: 'Email sent successfully',
        messageId: result.messageId
      });
    } else {
      res.status(500).json({
        message: 'Failed to send email',
        error: result.error
      });
    }
  } catch (error) {
    console.error('Send individual email error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Get email campaign statistics
router.get('/email-campaigns/stats/overview', adminAuth, async (req, res) => {
  try {
    const totalCampaigns = await EmailCampaign.countDocuments();
    const sentCampaigns = await EmailCampaign.countDocuments({ status: 'sent' });
    const draftCampaigns = await EmailCampaign.countDocuments({ status: 'draft' });
    const scheduledCampaigns = await EmailCampaign.countDocuments({ status: 'scheduled' });

    // Get total emails sent and delivery rate
    const campaignStats = await EmailCampaign.aggregate([
      { $match: { status: 'sent' } },
      {
        $group: {
          _id: null,
          totalEmailsSent: { $sum: '$stats.sentCount' },
          totalEmailsFailed: { $sum: '$stats.failedCount' },
          totalRecipients: { $sum: '$stats.totalRecipients' }
        }
      }
    ]);

    const stats = campaignStats[0] || { totalEmailsSent: 0, totalEmailsFailed: 0, totalRecipients: 0 };
    const overallDeliveryRate = stats.totalRecipients > 0 ? 
      (stats.totalEmailsSent / stats.totalRecipients * 100).toFixed(2) : 0;

    // Get recent campaigns
    const recentCampaigns = await EmailCampaign.find()
      .populate('createdBy', 'name')
      .sort({ createdAt: -1 })
      .limit(5)
      .select('title status stats.sentCount stats.totalRecipients createdAt');

    res.json({
      overview: {
        totalCampaigns,
        sentCampaigns,
        draftCampaigns,
        scheduledCampaigns,
        totalEmailsSent: stats.totalEmailsSent,
        totalEmailsFailed: stats.totalEmailsFailed,
        overallDeliveryRate: parseFloat(overallDeliveryRate)
      },
      recentCampaigns
    });
  } catch (error) {
    console.error('Get email campaign stats error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Process refund for order
router.post('/orders/:orderId/refund', adminAuth, async (req, res) => {
  try {
    const { orderId } = req.params;
    const { refundAmount, reason } = req.body;
    
    if (!refundAmount || refundAmount <= 0) {
      return res.status(400).json({ message: 'Valid refund amount is required' });
    }

    const order = await Order.findById(orderId);
    if (!order) {
      return res.status(404).json({ message: 'Order not found' });
    }

    await order.processRefund(refundAmount, reason, req.user._id);

    res.json({ 
      message: 'Refund processed successfully',
      order: {
        orderNumber: order.orderNumber,
        refundAmount: order.refundAmount,
        paymentStatus: order.paymentStatus,
        refundedAt: order.refundedAt
      }
    });
  } catch (error) {
    console.error('Process refund error:', error);
    res.status(500).json({ message: error.message || 'Server error' });
  }
});

// Website Settings Management Routes

// Get website settings
router.get('/website-settings', adminAuth, async (req, res) => {
  try {
    const settings = await WebsiteSettings.getSettings();
    res.json(settings);
  } catch (error) {
    console.error('Get website settings error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Update website settings
router.put('/website-settings', adminAuth, uploadUser.fields([
  { name: 'logo', maxCount: 1 },
  { name: 'heroImage', maxCount: 1 }
]), async (req, res) => {
  try {
    const updateData = { ...req.body };
    
    // Handle logo upload
    if (req.files && req.files.logo && req.files.logo[0]) {
      updateData.logo = req.files.logo[0].path; // Cloudinary URL
    }
    
    // Handle hero image upload
    if (req.files && req.files.heroImage && req.files.heroImage[0]) {
      updateData.heroImage = req.files.heroImage[0].path; // Cloudinary URL
    }

    // Parse social media JSON if it's a string
    if (typeof updateData.socialMedia === 'string') {
      try {
        updateData.socialMedia = JSON.parse(updateData.socialMedia);
      } catch (e) {
        console.error('Error parsing socialMedia:', e);
      }
    }

    // Parse features JSON if it's a string
    if (typeof updateData.features === 'string') {
      try {
        updateData.features = JSON.parse(updateData.features);
      } catch (e) {
        console.error('Error parsing features:', e);
      }
    }

    // Convert numeric fields
    if (updateData.features) {
      if (updateData.features.freeShippingThreshold) {
        updateData.features.freeShippingThreshold = Number(updateData.features.freeShippingThreshold);
      }
      if (updateData.features.commissionRate) {
        updateData.features.commissionRate = Number(updateData.features.commissionRate);
      }
    }

    const settings = await WebsiteSettings.updateSettings(updateData, req.user._id);
    
    res.json({
      message: 'Website settings updated successfully',
      settings
    });
  } catch (error) {
    console.error('Update website settings error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Publisher Advertisement Management Routes

// Get all publisher ads
router.get('/publisher-ads', adminAuth, async (req, res) => {
  try {
    const { page = 1, limit = 20, status } = req.query;
    
    const filter = {};
    if (status === 'active') {
      filter.isActive = true;
    } else if (status === 'inactive') {
      filter.isActive = false;
    }

    const skip = (page - 1) * limit;
    const ads = await PublisherAd.find(filter)
      .populate('createdBy updatedBy', 'name')
      .sort({ displayOrder: 1, createdAt: -1 })
      .skip(skip)
      .limit(Number(limit));

    const total = await PublisherAd.countDocuments(filter);

    res.json({
      ads,
      pagination: {
        current: Number(page),
        pages: Math.ceil(total / limit),
        total
      }
    });
  } catch (error) {
    console.error('Get publisher ads error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Get active publisher ads for frontend
router.get('/publisher-ads/active', async (req, res) => {
  try {
    const ads = await PublisherAd.getActiveAds();
    res.json(ads);
  } catch (error) {
    console.error('Get active publisher ads error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Get public website settings (no auth required)
router.get('/website-settings/public', async (req, res) => {
  try {
    const settings = await WebsiteSettings.getSettings();
    
    // Return only public fields
    const publicSettings = {
      websiteName: settings.websiteName,
      websiteDomain: settings.websiteDomain,
      logo: settings.logo,
      heroImage: settings.heroImage,
      heroTitle: settings.heroTitle,
      heroSubtitle: settings.heroSubtitle,
      metaDescription: settings.metaDescription,
      metaKeywords: settings.metaKeywords,
      contactEmail: settings.contactEmail,
      contactPhone: settings.contactPhone,
      socialMedia: settings.socialMedia,
      features: {
        freeShippingThreshold: settings.features?.freeShippingThreshold || 2000
      }
    };
    
    res.json(publicSettings);
  } catch (error) {
    console.error('Get public website settings error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Create publisher ad
router.post('/publisher-ads', adminAuth, uploadPublisherAd.single('image'), [
  body('name').trim().isLength({ min: 1 }).withMessage('Publisher name is required'),
  body('description').optional().trim()
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    if (!req.file) {
      return res.status(400).json({ message: 'Publisher image is required' });
    }

    const { name, description, website, displayOrder } = req.body;

    const ad = new PublisherAd({
      name,
      description: description || 'Quality Books',
      website: website || '',
      image: req.file.path, // Cloudinary URL
      displayOrder: displayOrder ? Number(displayOrder) : 0,
      createdBy: req.user._id,
      updatedBy: req.user._id
    });

    await ad.save();

    res.status(201).json({
      message: 'Publisher advertisement created successfully',
      ad
    });
  } catch (error) {
    console.error('Create publisher ad error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Update publisher ad
router.put('/publisher-ads/:id', adminAuth, uploadPublisherAd.single('image'), [
  body('name').trim().isLength({ min: 1 }).withMessage('Publisher name is required'),
  body('description').optional().trim()
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const ad = await PublisherAd.findById(req.params.id);
    if (!ad) {
      return res.status(404).json({ message: 'Publisher advertisement not found' });
    }

    const { name, description, website, displayOrder, isActive } = req.body;

    // Update fields
    ad.name = name;
    ad.description = description || ad.description;
    ad.website = website || '';
    ad.displayOrder = displayOrder ? Number(displayOrder) : ad.displayOrder;
    ad.isActive = isActive !== undefined ? isActive === 'true' || isActive === true : ad.isActive;
    ad.updatedBy = req.user._id;

    // Handle image update
    if (req.file) {
      // Delete old image from Cloudinary if it exists
      if (ad.image) {
        try {
          const publicId = extractPublicId(ad.image);
          if (publicId) {
            await deleteImage(publicId);
            console.log('Deleted old publisher ad image from Cloudinary:', publicId);
          }
        } catch (deleteError) {
          console.error('Error deleting old publisher ad image:', deleteError);
        }
      }
      ad.image = req.file.path; // Cloudinary URL
    }

    await ad.save();

    res.json({
      message: 'Publisher advertisement updated successfully',
      ad
    });
  } catch (error) {
    console.error('Update publisher ad error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Delete publisher ad
// Delete publisher ad
router.delete('/publisher-ads/:id', adminAuth, async (req, res) => {
  try {
    const ad = await PublisherAd.findById(req.params.id);
    if (!ad) {
      return res.status(404).json({ message: 'Publisher advertisement not found' });
    }

    // Delete image from Cloudinary
    if (ad.image) {
      try {
        const publicId = extractPublicId(ad.image);
        if (publicId) {
          await deleteImage(publicId);
          console.log('Deleted publisher ad image from Cloudinary:', publicId);
        }
      } catch (deleteError) {
        console.error('Error deleting publisher ad image from Cloudinary:', deleteError);
      }
    }

    await PublisherAd.findByIdAndDelete(req.params.id);

    res.json({ message: 'Publisher advertisement deleted successfully' });
  } catch (error) {
    console.error('Delete publisher ad error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Toggle publisher ad status
router.patch('/publisher-ads/:id/toggle', adminAuth, async (req, res) => {
  try {
    const ad = await PublisherAd.findById(req.params.id);
    if (!ad) {
      return res.status(404).json({ message: 'Publisher advertisement not found' });
    }

    ad.isActive = !ad.isActive;
    ad.updatedBy = req.user._id;
    await ad.save();

    res.json({
      message: `Publisher advertisement ${ad.isActive ? 'activated' : 'deactivated'} successfully`,
      ad
    });
  } catch (error) {
    console.error('Toggle publisher ad status error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Hero Slides Management Routes

// Get all hero slides
router.get('/hero-slides', adminAuth, async (req, res) => {
  try {
    const { page = 1, limit = 20, status } = req.query;
    
    const filter = {};
    if (status === 'active') {
      filter.isActive = true;
    } else if (status === 'inactive') {
      filter.isActive = false;
    }

    const skip = (page - 1) * limit;
    const slides = await HeroSlide.find(filter)
      .populate('createdBy updatedBy', 'name')
      .sort({ displayOrder: 1, createdAt: -1 })
      .skip(skip)
      .limit(Number(limit));

    const total = await HeroSlide.countDocuments(filter);

    res.json({
      slides,
      pagination: {
        current: Number(page),
        pages: Math.ceil(total / limit),
        total
      }
    });
  } catch (error) {
    console.error('Get hero slides error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Get active hero slides for frontend
router.get('/hero-slides/active', async (req, res) => {
  try {
    const slides = await HeroSlide.getActiveSlides();
    res.json(slides);
  } catch (error) {
    console.error('Get active hero slides error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Create hero slide
router.post('/hero-slides', adminAuth, uploadHeroSlide.single('backgroundImage'), [
  body('title').trim().isLength({ min: 1 }).withMessage('Title is required'),
  body('subtitle').trim().isLength({ min: 1 }).withMessage('Subtitle is required')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    if (!req.file) {
      return res.status(400).json({ message: 'Background image is required' });
    }

    const {
      title,
      subtitle,
      description,
      overlayColor,
      textColor,
      primaryButtonText,
      primaryButtonLink,
      primaryButtonStyle,
      secondaryButtonText,
      secondaryButtonLink,
      secondaryButtonStyle,
      displayOrder,
      autoSlideDelay
    } = req.body;

    const slide = new HeroSlide({
      title,
      subtitle,
      description: description || '',
      backgroundImage: req.file.path, // Cloudinary URL
      overlayColor: overlayColor || 'rgba(0, 0, 0, 0.4)',
      textColor: textColor || '#ffffff',
      primaryButton: {
        text: primaryButtonText || 'Browse Books',
        link: primaryButtonLink || '/books',
        style: primaryButtonStyle || 'primary'
      },
      secondaryButton: {
        text: secondaryButtonText || 'Featured Books',
        link: secondaryButtonLink || '/books?featured=true',
        style: secondaryButtonStyle || 'outline'
      },
      displayOrder: displayOrder ? Number(displayOrder) : 0,
      autoSlideDelay: autoSlideDelay ? Number(autoSlideDelay) : 5000,
      createdBy: req.user._id,
      updatedBy: req.user._id
    });

    await slide.save();

    res.status(201).json({
      message: 'Hero slide created successfully',
      slide
    });
  } catch (error) {
    console.error('Create hero slide error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Update hero slide
router.put('/hero-slides/:id', adminAuth, uploadHeroSlide.single('backgroundImage'), [
  body('title').trim().isLength({ min: 1 }).withMessage('Title is required'),
  body('subtitle').trim().isLength({ min: 1 }).withMessage('Subtitle is required')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const slide = await HeroSlide.findById(req.params.id);
    if (!slide) {
      return res.status(404).json({ message: 'Hero slide not found' });
    }

    const {
      title,
      subtitle,
      description,
      overlayColor,
      textColor,
      primaryButtonText,
      primaryButtonLink,
      primaryButtonStyle,
      secondaryButtonText,
      secondaryButtonLink,
      secondaryButtonStyle,
      displayOrder,
      autoSlideDelay,
      isActive
    } = req.body;

    // Update fields
    slide.title = title;
    slide.subtitle = subtitle;
    slide.description = description || '';
    slide.overlayColor = overlayColor || slide.overlayColor;
    slide.textColor = textColor || slide.textColor;
    slide.primaryButton = {
      text: primaryButtonText || slide.primaryButton.text,
      link: primaryButtonLink || slide.primaryButton.link,
      style: primaryButtonStyle || slide.primaryButton.style
    };
    slide.secondaryButton = {
      text: secondaryButtonText || slide.secondaryButton.text,
      link: secondaryButtonLink || slide.secondaryButton.link,
      style: secondaryButtonStyle || slide.secondaryButton.style
    };
    slide.displayOrder = displayOrder ? Number(displayOrder) : slide.displayOrder;
    slide.autoSlideDelay = autoSlideDelay ? Number(autoSlideDelay) : slide.autoSlideDelay;
    slide.isActive = isActive !== undefined ? isActive === 'true' || isActive === true : slide.isActive;
    slide.updatedBy = req.user._id;

    // Handle background image update
    if (req.file) {
      // Delete old image from Cloudinary if it exists
      if (slide.backgroundImage) {
        try {
          const publicId = extractPublicId(slide.backgroundImage);
          if (publicId) {
            await deleteImage(publicId);
            console.log('Deleted old hero slide image from Cloudinary:', publicId);
          }
        } catch (deleteError) {
          console.error('Error deleting old hero slide image:', deleteError);
        }
      }
      slide.backgroundImage = req.file.path; // Cloudinary URL
    }

    await slide.save();

    res.json({
      message: 'Hero slide updated successfully',
      slide
    });
  } catch (error) {
    console.error('Update hero slide error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Delete hero slide
// Delete hero slide
router.delete('/hero-slides/:id', adminAuth, async (req, res) => {
  try {
    const slide = await HeroSlide.findById(req.params.id);
    if (!slide) {
      return res.status(404).json({ message: 'Hero slide not found' });
    }

    // Delete background image from Cloudinary
    if (slide.backgroundImage) {
      try {
        const publicId = extractPublicId(slide.backgroundImage);
        if (publicId) {
          await deleteImage(publicId);
          console.log('Deleted hero slide image from Cloudinary:', publicId);
        }
      } catch (deleteError) {
        console.error('Error deleting hero slide image from Cloudinary:', deleteError);
      }
    }

    await HeroSlide.findByIdAndDelete(req.params.id);

    res.json({ message: 'Hero slide deleted successfully' });
  } catch (error) {
    console.error('Delete hero slide error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Toggle hero slide status
router.patch('/hero-slides/:id/toggle', adminAuth, async (req, res) => {
  try {
    const slide = await HeroSlide.findById(req.params.id);
    if (!slide) {
      return res.status(404).json({ message: 'Hero slide not found' });
    }

    slide.isActive = !slide.isActive;
    slide.updatedBy = req.user._id;
    await slide.save();

    res.json({
      message: `Hero slide ${slide.isActive ? 'activated' : 'deactivated'} successfully`,
      slide
    });
  } catch (error) {
    console.error('Toggle hero slide status error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Page Management Routes

// Get all pages
router.get('/pages', adminAuth, async (req, res) => {
  try {
    const { page = 1, limit = 20, status } = req.query;
    
    const filter = {};
    if (status === 'active') {
      filter.isActive = true;
    } else if (status === 'inactive') {
      filter.isActive = false;
    }

    const skip = (page - 1) * limit;
    const pages = await Page.find(filter)
      .populate('createdBy updatedBy', 'name')
      .sort({ displayOrder: 1, title: 1 })
      .skip(skip)
      .limit(Number(limit));

    const total = await Page.countDocuments(filter);

    res.json({
      pages,
      pagination: {
        current: Number(page),
        pages: Math.ceil(total / limit),
        total
      }
    });
  } catch (error) {
    console.error('Get pages error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Get single page
router.get('/pages/:id', adminAuth, async (req, res) => {
  try {
    const page = await Page.findById(req.params.id)
      .populate('createdBy updatedBy', 'name');

    if (!page) {
      return res.status(404).json({ message: 'Page not found' });
    }

    res.json(page);
  } catch (error) {
    console.error('Get page error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Create page
router.post('/pages', adminAuth, [
  body('title').trim().isLength({ min: 1 }).withMessage('Title is required'),
  body('content').trim().isLength({ min: 1 }).withMessage('Content is required'),
  body('slug').optional().trim().matches(/^[a-z0-9-]+$/).withMessage('Slug must contain only lowercase letters, numbers, and hyphens')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { title, content, slug, metaTitle, metaDescription, showInFooter, displayOrder } = req.body;

    // Generate slug if not provided
    let pageSlug = slug;
    if (!pageSlug) {
      pageSlug = title
        .toLowerCase()
        .replace(/[^a-z0-9\s-]/g, '')
        .replace(/\s+/g, '-')
        .replace(/-+/g, '-')
        .trim('-');
    }

    // Check if slug already exists
    const existingPage = await Page.findOne({ slug: pageSlug });
    if (existingPage) {
      return res.status(400).json({ message: 'A page with this slug already exists' });
    }

    const page = new Page({
      title,
      slug: pageSlug,
      content,
      metaTitle: metaTitle || title,
      metaDescription: metaDescription || '',
      showInFooter: showInFooter !== undefined ? showInFooter : true,
      displayOrder: displayOrder ? Number(displayOrder) : 0,
      createdBy: req.user._id,
      updatedBy: req.user._id
    });

    await page.save();

    res.status(201).json({
      message: 'Page created successfully',
      page
    });
  } catch (error) {
    console.error('Create page error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Update page
router.put('/pages/:id', adminAuth, [
  body('title').trim().isLength({ min: 1 }).withMessage('Title is required'),
  body('content').trim().isLength({ min: 1 }).withMessage('Content is required'),
  body('slug').optional().trim().matches(/^[a-z0-9-]+$/).withMessage('Slug must contain only lowercase letters, numbers, and hyphens')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const page = await Page.findById(req.params.id);
    if (!page) {
      return res.status(404).json({ message: 'Page not found' });
    }

    const { title, content, slug, metaTitle, metaDescription, showInFooter, displayOrder, isActive } = req.body;

    // Check if slug is being changed and if it already exists
    if (slug && slug !== page.slug) {
      const existingPage = await Page.findOne({ slug, _id: { $ne: req.params.id } });
      if (existingPage) {
        return res.status(400).json({ message: 'A page with this slug already exists' });
      }
      page.slug = slug;
    }

    // Update fields
    page.title = title;
    page.content = content;
    page.metaTitle = metaTitle || title;
    page.metaDescription = metaDescription || '';
    page.showInFooter = showInFooter !== undefined ? showInFooter : page.showInFooter;
    page.displayOrder = displayOrder ? Number(displayOrder) : page.displayOrder;
    page.isActive = isActive !== undefined ? isActive : page.isActive;
    page.updatedBy = req.user._id;

    await page.save();

    res.json({
      message: 'Page updated successfully',
      page
    });
  } catch (error) {
    console.error('Update page error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Delete page
router.delete('/pages/:id', adminAuth, async (req, res) => {
  try {
    const page = await Page.findById(req.params.id);
    if (!page) {
      return res.status(404).json({ message: 'Page not found' });
    }

    await Page.findByIdAndDelete(req.params.id);

    res.json({ message: 'Page deleted successfully' });
  } catch (error) {
    console.error('Delete page error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Toggle page status
router.patch('/pages/:id/toggle', adminAuth, async (req, res) => {
  try {
    const page = await Page.findById(req.params.id);
    if (!page) {
      return res.status(404).json({ message: 'Page not found' });
    }

    page.isActive = !page.isActive;
    page.updatedBy = req.user._id;
    await page.save();

    res.json({
      message: `Page ${page.isActive ? 'activated' : 'deactivated'} successfully`,
      page
    });
  } catch (error) {
    console.error('Toggle page status error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Get footer pages (public route)
router.get('/pages/footer/public', async (req, res) => {
  try {
    const pages = await Page.getFooterPages();
    res.json(pages);
  } catch (error) {
    console.error('Get footer pages error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Get page by slug (public route)
router.get('/pages/slug/:slug', async (req, res) => {
  try {
    const page = await Page.getBySlug(req.params.slug);
    if (!page) {
      return res.status(404).json({ message: 'Page not found' });
    }

    res.json(page);
  } catch (error) {
    console.error('Get page by slug error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

module.exports = router;
