const express = require('express');
const { body, validationResult } = require('express-validator');
const { auth, requireRole } = require('../middleware/auth');
const Book = require('../models/Book');
const BookRequest = require('../models/BookRequest');
const Order = require('../models/Order');
const LANGUAGES = require('../constants/languages');

// Import Cloudinary configuration
const {
  uploadBook,
  deleteImage,
  extractPublicId
} = require('../config/cloudinary');

const router = express.Router();

// Get seller dashboard stats
router.get('/dashboard', auth, requireRole(['seller']), async (req, res) => {
  try {
    const sellerId = req.user._id;

    // Get seller's book requests stats
    const [pendingRequests, approvedBooks, rejectedRequests] = await Promise.all([
      BookRequest.countDocuments({ seller: sellerId, status: 'pending' }),
      Book.countDocuments({ seller: sellerId }),
      BookRequest.countDocuments({ seller: sellerId, status: 'rejected' })
    ]);

    // Get seller's books
    const sellerBooks = await Book.find({ seller: sellerId }).distinct('_id');

    // Get orders containing seller's books
    const orders = await Order.find({
      'items.book': { $in: sellerBooks }
    }).populate('sellerPayments.seller');

    // Debug: Check total orders in database
    const totalOrdersInDB = await Order.countDocuments({});

    // Calculate payment statistics
    let totalRevenue = 0;
    let pendingPayments = 0;
    let paidAmount = 0;
    let totalShippingCharges = 0;
    let totalCommission = 0;

    orders.forEach(order => {
      const sellerPayment = order.sellerPayments?.find(p => 
        p.seller && p.seller._id.toString() === sellerId.toString()
      );
      
      if (sellerPayment) {
        totalRevenue += sellerPayment.itemsTotal;
        totalCommission += sellerPayment.adminCommission;
        totalShippingCharges += sellerPayment.shippingCharges;
        
        if (sellerPayment.paymentStatus === 'due') {
          pendingPayments += sellerPayment.netAmount;
        } else if (sellerPayment.paymentStatus === 'paid') {
          paidAmount += sellerPayment.netAmount;
        }
      }
    });

    // Get recent orders for seller's books
    const recentOrders = await Order.find({
      'items.book': { $in: sellerBooks }
    })
    .populate('user', 'name email')
    .populate('items.book', 'title price')
    .populate('sellerPayments.seller')
    .sort({ createdAt: -1 })
    .limit(5);

    res.json({
      stats: {
        pendingRequests,
        approvedBooks,
        rejectedRequests,
        totalOrders: orders.length,
        totalRevenue,
        pendingPayments,
        paidAmount,
        totalShippingCharges,
        totalCommission,
        netEarnings: totalRevenue - totalCommission - totalShippingCharges
      },
      recentOrders
    });
  } catch (error) {
    console.error('Seller dashboard error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Get seller's book requests
router.get('/book-requests', auth, requireRole(['seller']), async (req, res) => {
  try {
    const { status, page = 1, limit = 10 } = req.query;
    const sellerId = req.user._id;

    const query = { seller: sellerId };
    if (status && status !== 'all') {
      query.status = status;
    }

    const requests = await BookRequest.find(query)
      .populate('originalBook', 'title author')
      .populate('reviewedBy', 'name')
      .sort({ submittedAt: -1 })
      .limit(limit * 1)
      .skip((page - 1) * limit);

    const total = await BookRequest.countDocuments(query);

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

// Submit new book request with image upload
router.post('/book-requests', auth, requireRole(['seller']), uploadBook.array('images', 5), [
  body('title').trim().isLength({ min: 1 }).withMessage('Title is required'),
  body('author').trim().isLength({ min: 1 }).withMessage('Author is required'),
  body('description').trim().isLength({ min: 10 }).withMessage('Description must be at least 10 characters'),
  body('price').isFloat({ min: 0 }).withMessage('Price must be a positive number'),
  body('category').isIn(['Fiction', 'Non-Fiction', 'Mystery', 'Romance', 'Sci-Fi', 'Fantasy', 'Biography', 'History', 'Self-Help', 'Technology', 'Business', 'Health', 'Travel', 'Cooking', 'Art', 'Education', 'Children', 'Poetry', 'Drama', 'Science', 'Mythology', 'Other']).withMessage('Invalid category'),
  body('language').optional().isIn(LANGUAGES).withMessage('Invalid language'),
  body('stock').isInt({ min: 0 }).withMessage('Stock must be a non-negative integer')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const sellerId = req.user._id;
    const bookData = req.body;

    // Process numeric fields - handle arrays and convert to numbers
    if (bookData.price) {
      bookData.price = Array.isArray(bookData.price) ? bookData.price[0] : bookData.price;
      bookData.price = parseFloat(bookData.price);
      if (isNaN(bookData.price)) {
        return res.status(400).json({ message: 'Invalid price value' });
      }
    }

    if (bookData.originalPrice) {
      bookData.originalPrice = Array.isArray(bookData.originalPrice) ? bookData.originalPrice[0] : bookData.originalPrice;
      bookData.originalPrice = parseFloat(bookData.originalPrice);
      if (isNaN(bookData.originalPrice)) {
        return res.status(400).json({ message: 'Invalid original price value' });
      }
    }

    if (bookData.stock) {
      bookData.stock = Array.isArray(bookData.stock) ? bookData.stock[0] : bookData.stock;
      bookData.stock = parseInt(bookData.stock);
      if (isNaN(bookData.stock)) {
        return res.status(400).json({ message: 'Invalid stock value' });
      }
    }

    if (bookData.pages) {
      bookData.pages = Array.isArray(bookData.pages) ? bookData.pages[0] : bookData.pages;
      bookData.pages = parseInt(bookData.pages);
      if (isNaN(bookData.pages)) {
        return res.status(400).json({ message: 'Invalid pages value' });
      }
    }

    // Handle date fields
    if (bookData.publishedDate && bookData.publishedDate !== '') {
      bookData.publishedDate = Array.isArray(bookData.publishedDate) ? bookData.publishedDate[0] : bookData.publishedDate;
      const date = new Date(bookData.publishedDate);
      if (isNaN(date.getTime())) {
        return res.status(400).json({ message: 'Invalid published date' });
      }
      bookData.publishedDate = date;
    }

    // Handle boolean fields
    if (bookData.featured !== undefined) {
      bookData.featured = Array.isArray(bookData.featured) ? bookData.featured[0] : bookData.featured;
      bookData.featured = bookData.featured === 'true' || bookData.featured === true;
    }

    if (bookData.bestseller !== undefined) {
      bookData.bestseller = Array.isArray(bookData.bestseller) ? bookData.bestseller[0] : bookData.bestseller;
      bookData.bestseller = bookData.bestseller === 'true' || bookData.bestseller === true;
    }

    if (bookData.newArrival !== undefined) {
      bookData.newArrival = Array.isArray(bookData.newArrival) ? bookData.newArrival[0] : bookData.newArrival;
      bookData.newArrival = bookData.newArrival === 'true' || bookData.newArrival === true;
    }

    // Handle string fields that might be arrays
    const stringFields = ['title', 'author', 'isbn', 'description', 'category', 'language', 'publisher'];
    stringFields.forEach(field => {
      if (bookData[field] && Array.isArray(bookData[field])) {
        bookData[field] = bookData[field][0];
      }
    });

    // Handle uploaded images
    if (req.files && req.files.length > 0) {
      bookData.images = req.files.map(file => file.path); // Cloudinary URLs
    } else if (bookData.images && typeof bookData.images === 'string') {
      // Handle single image as string
      try {
        bookData.images = JSON.parse(bookData.images);
      } catch (e) {
        bookData.images = [bookData.images];
      }
    } else if (!bookData.images) {
      bookData.images = [];
    }

    // Remove empty ISBN to prevent duplicate key error
    if (bookData.isbn === '' || bookData.isbn === null || bookData.isbn === undefined) {
      delete bookData.isbn;
    } else {
      // Check if ISBN already exists in pending requests
      const existingRequest = await BookRequest.findOne({ 
        'bookData.isbn': bookData.isbn,
        status: 'pending'
      });
      
      if (existingRequest) {
        return res.status(400).json({ 
          message: 'A pending book request with this ISBN already exists. Please use a different ISBN or wait for the existing request to be processed.' 
        });
      }
    }

    const bookRequest = new BookRequest({
      seller: sellerId,
      type: 'create',
      bookData
    });

    await bookRequest.save();

    res.status(201).json({
      message: 'Book request submitted successfully',
      request: bookRequest
    });
  } catch (error) {
    console.error('Submit book request error:', error);
    console.error('Error details:', {
      message: error.message,
      stack: error.stack,
      name: error.name
    });
    
    // Handle specific MongoDB errors
    if (error.name === 'MongoServerError' && error.code === 11000) {
      // Handle duplicate key errors
      if (error.message.includes('bookData.isbn')) {
        return res.status(400).json({ 
          message: 'A book request with this ISBN already exists. Please use a different ISBN or leave it empty.' 
        });
      }
      return res.status(400).json({ 
        message: 'Duplicate data detected. Please check your input and try again.' 
      });
    }
    
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// Submit book update request with image upload
router.post('/book-requests/update/:bookId', auth, requireRole(['seller']), uploadBook.array('images', 5), [
  body('title').trim().isLength({ min: 1 }).withMessage('Title is required'),
  body('author').trim().isLength({ min: 1 }).withMessage('Author is required'),
  body('description').trim().isLength({ min: 10 }).withMessage('Description must be at least 10 characters'),
  body('price').isFloat({ min: 0 }).withMessage('Price must be a positive number'),
  body('category').isIn(['Fiction', 'Non-Fiction', 'Mystery', 'Romance', 'Sci-Fi', 'Fantasy', 'Biography', 'History', 'Self-Help', 'Technology', 'Business', 'Health', 'Travel', 'Cooking', 'Art', 'Education', 'Children', 'Poetry', 'Drama', 'Science', 'Mythology', 'Other']).withMessage('Invalid category'),
  body('language').optional().isIn(LANGUAGES).withMessage('Invalid language'),
  body('stock').isInt({ min: 0 }).withMessage('Stock must be a non-negative integer')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { bookId } = req.params;
    const sellerId = req.user._id;
    const bookData = req.body;

    // Process numeric fields - handle arrays and convert to numbers
    if (bookData.price) {
      bookData.price = Array.isArray(bookData.price) ? bookData.price[0] : bookData.price;
      bookData.price = parseFloat(bookData.price);
      if (isNaN(bookData.price)) {
        return res.status(400).json({ message: 'Invalid price value' });
      }
    }

    if (bookData.originalPrice) {
      bookData.originalPrice = Array.isArray(bookData.originalPrice) ? bookData.originalPrice[0] : bookData.originalPrice;
      bookData.originalPrice = parseFloat(bookData.originalPrice);
      if (isNaN(bookData.originalPrice)) {
        return res.status(400).json({ message: 'Invalid original price value' });
      }
    }

    if (bookData.stock) {
      bookData.stock = Array.isArray(bookData.stock) ? bookData.stock[0] : bookData.stock;
      bookData.stock = parseInt(bookData.stock);
      if (isNaN(bookData.stock)) {
        return res.status(400).json({ message: 'Invalid stock value' });
      }
    }

    if (bookData.pages) {
      bookData.pages = Array.isArray(bookData.pages) ? bookData.pages[0] : bookData.pages;
      bookData.pages = parseInt(bookData.pages);
      if (isNaN(bookData.pages)) {
        return res.status(400).json({ message: 'Invalid pages value' });
      }
    }

    // Handle date fields
    if (bookData.publishedDate && bookData.publishedDate !== '') {
      bookData.publishedDate = Array.isArray(bookData.publishedDate) ? bookData.publishedDate[0] : bookData.publishedDate;
      const date = new Date(bookData.publishedDate);
      if (isNaN(date.getTime())) {
        return res.status(400).json({ message: 'Invalid published date' });
      }
      bookData.publishedDate = date;
    }

    // Handle boolean fields
    if (bookData.featured !== undefined) {
      bookData.featured = Array.isArray(bookData.featured) ? bookData.featured[0] : bookData.featured;
      bookData.featured = bookData.featured === 'true' || bookData.featured === true;
    }

    if (bookData.bestseller !== undefined) {
      bookData.bestseller = Array.isArray(bookData.bestseller) ? bookData.bestseller[0] : bookData.bestseller;
      bookData.bestseller = bookData.bestseller === 'true' || bookData.bestseller === true;
    }

    if (bookData.newArrival !== undefined) {
      bookData.newArrival = Array.isArray(bookData.newArrival) ? bookData.newArrival[0] : bookData.newArrival;
      bookData.newArrival = bookData.newArrival === 'true' || bookData.newArrival === true;
    }

    // Handle string fields that might be arrays
    const stringFields = ['title', 'author', 'isbn', 'description', 'category', 'language', 'publisher'];
    stringFields.forEach(field => {
      if (bookData[field] && Array.isArray(bookData[field])) {
        bookData[field] = bookData[field][0];
      }
    });

    // Handle uploaded images
    if (req.files && req.files.length > 0) {
      bookData.images = req.files.map(file => file.path); // Cloudinary URLs
    } else if (bookData.images && typeof bookData.images === 'string') {
      // Handle single image as string
      try {
        bookData.images = JSON.parse(bookData.images);
      } catch (e) {
        bookData.images = [bookData.images];
      }
    } else if (!bookData.images) {
      bookData.images = [];
    }

    // Remove empty ISBN to prevent duplicate key error
    if (bookData.isbn === '' || bookData.isbn === null || bookData.isbn === undefined) {
      delete bookData.isbn;
    } else {
      // Check if ISBN already exists in pending requests (excluding current book's requests)
      const existingRequest = await BookRequest.findOne({ 
        'bookData.isbn': bookData.isbn,
        status: 'pending',
        originalBook: { $ne: bookId }
      });
      
      if (existingRequest) {
        return res.status(400).json({ 
          message: 'A pending book request with this ISBN already exists. Please use a different ISBN or wait for the existing request to be processed.' 
        });
      }
    }

    // Verify the book belongs to this seller
    const book = await Book.findOne({ _id: bookId, seller: sellerId });
    if (!book) {
      return res.status(404).json({ message: 'Book not found or not authorized' });
    }

    const bookRequest = new BookRequest({
      seller: sellerId,
      type: 'update',
      originalBook: bookId,
      bookData
    });

    await bookRequest.save();

    res.status(201).json({
      message: 'Book update request submitted successfully',
      request: bookRequest
    });
  } catch (error) {
    console.error('Submit book update request error:', error);
    console.error('Error details:', {
      message: error.message,
      stack: error.stack,
      name: error.name
    });
    
    // Handle specific MongoDB errors
    if (error.name === 'MongoServerError' && error.code === 11000) {
      // Handle duplicate key errors
      if (error.message.includes('bookData.isbn')) {
        return res.status(400).json({ 
          message: 'A book request with this ISBN already exists. Please use a different ISBN or leave it empty.' 
        });
      }
      return res.status(400).json({ 
        message: 'Duplicate data detected. Please check your input and try again.' 
      });
    }
    
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// Get seller's books
router.get('/books', auth, requireRole(['seller']), async (req, res) => {
  try {
    const { page = 1, limit = 10, search } = req.query;
    const sellerId = req.user._id;

    const query = { seller: sellerId };
    if (search) {
      query.$or = [
        { title: { $regex: search, $options: 'i' } },
        { author: { $regex: search, $options: 'i' } }
      ];
    }

    const books = await Book.find(query)
      .sort({ createdAt: -1 })
      .limit(limit * 1)
      .skip((page - 1) * limit);

    const total = await Book.countDocuments(query);

    res.json({
      books,
      pagination: {
        current: page,
        pages: Math.ceil(total / limit),
        total
      }
    });
  } catch (error) {
    console.error('Get seller books error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Get single book for editing
router.get('/books/:bookId', auth, requireRole(['seller']), async (req, res) => {
  try {
    const { bookId } = req.params;
    const sellerId = req.user._id;

    const book = await Book.findOne({ _id: bookId, seller: sellerId });
    if (!book) {
      return res.status(404).json({ message: 'Book not found or not authorized' });
    }

    res.json(book);
  } catch (error) {
    console.error('Get seller book error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Get seller's payment history
router.get('/payments', auth, requireRole(['seller']), async (req, res) => {
  try {
    const sellerId = req.user._id;
    const { page = 1, limit = 10, status } = req.query;

    const filter = {
      'sellerPayments.seller': sellerId
    };

    if (status) {
      filter['sellerPayments.paymentStatus'] = status;
    }

    const skip = (page - 1) * limit;
    const orders = await Order.find(filter)
      .populate('user', 'name email')
      .populate('sellerPayments.seller', 'name email')
      .populate('sellerPayments.paidBy', 'name')
      .sort({ deliveredAt: -1 })
      .skip(skip)
      .limit(Number(limit));

    // Filter to only include this seller's payments
    const payments = orders.map(order => {
      const sellerPayment = order.sellerPayments.find(p => 
        p.seller._id.toString() === sellerId.toString()
      );
      
      return {
        orderId: order._id,
        orderNumber: order.orderNumber,
        orderDate: order.createdAt,
        deliveredAt: order.deliveredAt,
        customer: order.user,
        ...sellerPayment.toObject()
      };
    }).filter(payment => payment.seller);

    const total = await Order.countDocuments(filter);

    res.json({
      payments,
      pagination: {
        current: Number(page),
        pages: Math.ceil(total / limit),
        total
      }
    });
  } catch (error) {
    console.error('Get seller payments error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Get seller's orders with payment info
router.get('/orders', auth, requireRole(['seller']), async (req, res) => {
  try {
    const { page = 1, limit = 10, status } = req.query;
    const sellerId = req.user._id;

    console.log('Seller orders request:', { 
      sellerId: sellerId.toString(), 
      page, 
      limit, 
      status,
      userObject: {
        id: req.user._id?.toString(),
        name: req.user.name,
        role: req.user.role,
        hasId: !!req.user._id
      }
    });

    // Get seller's books with error handling
    let sellerBooks;
    try {
      sellerBooks = await Book.find({ seller: sellerId }).select('_id');
      console.log('Seller books found:', sellerBooks.length);
      
      if (sellerBooks.length === 0) {
        console.log('No books found for seller, returning empty result');
        return res.json({
          orders: [],
          pagination: {
            current: parseInt(page),
            pages: 0,
            total: 0
          }
        });
      }
    } catch (bookError) {
      console.error('Error fetching seller books:', bookError);
      return res.status(500).json({ 
        message: 'Error fetching seller books',
        error: process.env.NODE_ENV === 'development' ? bookError.message : 'Database error'
      });
    }

    // Extract book IDs
    const sellerBookIds = sellerBooks.map(book => book._id);
    console.log('Seller book IDs for matching:', sellerBookIds.map(id => id.toString()));

    // Build query
    const query = {
      'items.book': { $in: sellerBookIds }
    };

    if (status && status !== 'all') {
      query.status = status;
    }

    console.log('Order query:', JSON.stringify(query));

    // Parse pagination parameters safely
    const pageNum = parseInt(page) || 1;
    const limitNum = parseInt(limit) || 10;
    const skip = (pageNum - 1) * limitNum;

    // Fetch orders with simplified population
    let orders;
    try {
      orders = await Order.find(query)
        .populate('user', 'name email phone')
        .populate('items.book', 'title author price images seller')
        .sort({ createdAt: -1 })
        .limit(limitNum)
        .skip(skip);

      console.log('Orders found:', orders.length);
      
      // Debug: Log details of found orders
      if (orders.length > 0) {
        console.log('Order details:', orders.slice(0, 2).map(order => ({
          id: order._id.toString(),
          itemCount: order.items.length,
          books: order.items.map(item => ({
            bookId: item.book?._id?.toString(),
            bookTitle: item.book?.title,
            bookSeller: item.book?.seller?.toString()
          }))
        })));
      }
    } catch (orderError) {
      console.error('Error fetching orders:', orderError);
      return res.status(500).json({ 
        message: 'Error fetching orders',
        error: process.env.NODE_ENV === 'development' ? orderError.message : 'Database error'
      });
    }

    // Process orders - filter items and add seller payment info
    const filteredOrders = [];
    
    for (const order of orders) {
      try {
        // Filter items to only show seller's books
        const sellerItems = order.items.filter(item => {
          if (!item.book || !item.book._id) return false;
          return sellerBookIds.some(bookId => bookId.toString() === item.book._id.toString());
        });

        if (sellerItems.length === 0) continue; // Skip if no items for this seller

        // Find seller payment info
        let sellerPayment = null;
        if (order.sellerPayments && order.sellerPayments.length > 0) {
          sellerPayment = order.sellerPayments.find(p => 
            p.seller && p.seller.toString() === sellerId.toString()
          );
        }

        // Create filtered order object
        const filteredOrder = {
          _id: order._id,
          orderNumber: order.orderNumber,
          user: order.user,
          items: sellerItems,
          shippingAddress: order.shippingAddress,
          status: order.status,
          paymentStatus: order.paymentStatus,
          createdAt: order.createdAt,
          deliveredAt: order.deliveredAt,
          refundAmount: order.refundAmount || 0,
          sellerPayment: sellerPayment
        };

        filteredOrders.push(filteredOrder);
      } catch (processingError) {
        console.error('Error processing order:', order._id, processingError);
        // Continue with other orders
      }
    }

    // Get total count
    let total = 0;
    try {
      total = await Order.countDocuments(query);
    } catch (countError) {
      console.error('Error counting orders:', countError);
      total = filteredOrders.length; // Fallback to current results count
    }

    console.log('Sending response:', { ordersCount: filteredOrders.length, total });

    res.json({
      orders: filteredOrders,
      pagination: {
        current: pageNum,
        pages: Math.ceil(total / limitNum),
        total
      }
    });
  } catch (error) {
    console.error('Get seller orders error:', error);
    console.error('Error stack:', error.stack);
    res.status(500).json({ 
      message: 'Server error',
      error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
    });
  }
});

// Get single order details (seller can only see their books in the order)
router.get('/orders/:orderId', auth, requireRole(['seller']), async (req, res) => {
  try {
    const { orderId } = req.params;
    const sellerId = req.user._id;

    // Get seller's books
    const sellerBooks = await Book.find({ seller: sellerId }).distinct('_id');

    const order = await Order.findById(orderId)
      .populate('user', 'name email phone address')
      .populate('items.book', 'title author price images seller');

    if (!order) {
      return res.status(404).json({ message: 'Order not found' });
    }

    // Check if order contains seller's books
    const sellerItems = order.items.filter(item => 
      sellerBooks.some(bookId => bookId.toString() === item.book._id.toString())
    );

    if (sellerItems.length === 0) {
      return res.status(403).json({ message: 'Not authorized to view this order' });
    }

    // Return order with only seller's items
    const filteredOrder = {
      ...order.toObject(),
      items: sellerItems
    };

    res.json(filteredOrder);
  } catch (error) {
    console.error('Get seller order details error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Test endpoint for debugging seller orders
router.get('/orders-test', auth, requireRole(['seller']), async (req, res) => {
  try {
    const sellerId = req.user._id;
    
    // Test 1: Check if we can access the seller
    console.log('Test - Seller ID:', sellerId);
    
    // Test 2: Check if we can query books
    const bookCount = await Book.countDocuments({ seller: sellerId });
    console.log('Test - Book count:', bookCount);
    
    // Test 3: Get actual seller books with details
    const sellerBooks = await Book.find({ seller: sellerId }).select('_id title author');
    console.log('Test - Seller books:', sellerBooks.map(b => ({ id: b._id.toString(), title: b.title })));
    
    // Test 4: Check if we can query orders
    const orderCount = await Order.countDocuments({});
    console.log('Test - Total orders:', orderCount);
    
    // Test 5: Get sample orders with book details
    const sampleOrders = await Order.find({}).limit(3).populate('items.book', 'title seller');
    console.log('Test - Sample orders with books:', sampleOrders.map(order => ({
      id: order._id.toString(),
      items: order.items.map(item => ({
        bookId: item.book?._id?.toString(),
        bookTitle: item.book?.title,
        bookSeller: item.book?.seller?.toString()
      }))
    })));
    
    // Test 6: Check for orders containing seller's books
    const sellerBookIds = sellerBooks.map(b => b._id);
    const ordersWithSellerBooks = await Order.find({
      'items.book': { $in: sellerBookIds }
    }).populate('items.book', 'title seller');
    
    console.log('Test - Orders with seller books:', ordersWithSellerBooks.length);
    
    // Test 7: Check for any orders where book seller matches
    const ordersWithSellerAsBookSeller = await Order.aggregate([
      {
        $lookup: {
          from: 'books',
          localField: 'items.book',
          foreignField: '_id',
          as: 'bookDetails'
        }
      },
      {
        $match: {
          'bookDetails.seller': sellerId
        }
      },
      {
        $limit: 5
      }
    ]);
    
    console.log('Test - Orders via aggregation:', ordersWithSellerAsBookSeller.length);
    
    res.json({
      success: true,
      sellerId: sellerId.toString(),
      bookCount,
      sellerBooks: sellerBooks.map(b => ({ id: b._id.toString(), title: b.title })),
      totalOrders: orderCount,
      hasOrders: orderCount > 0,
      ordersWithSellerBooks: ordersWithSellerBooks.length,
      ordersViaAggregation: ordersWithSellerAsBookSeller.length,
      sampleOrdersData: sampleOrders.map(order => ({
        id: order._id.toString(),
        itemCount: order.items.length,
        books: order.items.map(item => ({
          bookId: item.book?._id?.toString(),
          bookSeller: item.book?.seller?.toString(),
          matchesSeller: item.book?.seller?.toString() === sellerId.toString()
        }))
      }))
    });
  } catch (error) {
    console.error('Test endpoint error:', error);
    res.status(500).json({ 
      success: false, 
      error: error.message,
      stack: error.stack
    });
  }
});

// Simple orders endpoint for immediate testing
router.get('/orders-simple', auth, requireRole(['seller']), async (req, res) => {
  try {
    const sellerId = req.user._id;
    
    console.log('Simple orders test - Seller ID:', sellerId?.toString());
    
    // Just return basic info for now
    res.json({
      success: true,
      sellerId: sellerId?.toString(),
      message: 'Simple endpoint working',
      orders: [],
      pagination: { current: 1, pages: 0, total: 0 }
    });
  } catch (error) {
    console.error('Simple orders error:', error);
    res.status(500).json({ 
      success: false, 
      error: error.message 
    });
  }
});

module.exports = router;
