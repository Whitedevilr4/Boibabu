const express = require('express');
const Complaint = require('../models/Complaint');
const Order = require('../models/Order');
const Book = require('../models/Book');
const { auth, adminAuth, sellerAuth } = require('../middleware/auth');
const { sendComplaintResolvedEmail } = require('../utils/emailService');

const router = express.Router();

// Get user's complaints
router.get('/my-complaints', auth, async (req, res) => {
  try {
    const complaints = await Complaint.find({ user: req.user._id })
      .populate('orderId', 'orderNumber total')
      .sort({ createdAt: -1 });

    res.json(complaints);
  } catch (error) {
    console.error('Get user complaints error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Create new complaint
router.post('/', auth, async (req, res) => {
  try {
    const { subject, description, category, orderId, bookId, priority } = req.body;

    if (!subject || !description || !category) {
      return res.status(400).json({ message: 'Subject, description, and category are required' });
    }

    // Determine user type based on role
    const userType = req.user.role === 'seller' ? 'seller' : 'user';

    // Validate order if provided
    if (orderId) {
      let order;
      if (userType === 'user') {
        order = await Order.findOne({ _id: orderId, user: req.user._id });
      } else {
        // For sellers, check if they have books in the order
        order = await Order.findById(orderId).populate('items.book');
        if (order) {
          const hasSellerBooks = order.items.some(item => 
            item.book.seller && item.book.seller.toString() === req.user._id.toString()
          );
          if (!hasSellerBooks) {
            order = null;
          }
        }
      }
      
      if (!order) {
        return res.status(404).json({ message: 'Order not found or not accessible' });
      }
    }

    // Validate book if provided (for sellers)
    if (bookId && userType === 'seller') {
      const book = await Book.findOne({ _id: bookId, seller: req.user._id });
      if (!book) {
        return res.status(404).json({ message: 'Book not found or not accessible' });
      }
    }

    const complaint = new Complaint({
      user: req.user._id,
      userType,
      subject,
      description,
      category,
      orderId: orderId || undefined,
      bookId: bookId || undefined,
      priority: priority || 'Medium'
    });

    await complaint.save();
    await complaint.populate([
      { path: 'orderId', select: 'orderNumber total' },
      { path: 'bookId', select: 'title author' }
    ]);

    res.status(201).json({
      message: 'Complaint submitted successfully',
      complaint
    });
  } catch (error) {
    console.error('Create complaint error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Get complaint details
router.get('/:id', auth, async (req, res) => {
  try {
    const complaint = await Complaint.findOne({
      _id: req.params.id,
      user: req.user._id
    }).populate([
      { path: 'orderId', select: 'orderNumber total items' },
      { path: 'bookId', select: 'title author' }
    ]);

    if (!complaint) {
      return res.status(404).json({ message: 'Complaint not found' });
    }

    res.json(complaint);
  } catch (error) {
    console.error('Get complaint error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Admin routes
// Get all complaints (admin only)
router.get('/admin/all', adminAuth, async (req, res) => {
  try {
    const { status, priority, category, userType, page = 1, limit = 20 } = req.query;
    
    const filter = {};
    if (status) filter.status = status;
    if (priority) filter.priority = priority;
    if (category) filter.category = category;
    if (userType) filter.userType = userType;

    const complaints = await Complaint.find(filter)
      .populate('user', 'name email role')
      .populate('orderId', 'orderNumber total')
      .populate('bookId', 'title author')
      .populate('resolvedBy', 'name')
      .sort({ createdAt: -1 })
      .limit(limit * 1)
      .skip((page - 1) * limit);

    const total = await Complaint.countDocuments(filter);

    res.json({
      complaints,
      totalPages: Math.ceil(total / limit),
      currentPage: page,
      total
    });
  } catch (error) {
    console.error('Get all complaints error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Get complaint details (admin)
router.get('/admin/:id', adminAuth, async (req, res) => {
  try {
    const complaint = await Complaint.findById(req.params.id)
      .populate('user', 'name email phone role')
      .populate('orderId', 'orderNumber total items')
      .populate('bookId', 'title author')
      .populate('resolvedBy', 'name');

    if (!complaint) {
      return res.status(404).json({ message: 'Complaint not found' });
    }

    res.json(complaint);
  } catch (error) {
    console.error('Get complaint details error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Update complaint status (admin only)
router.put('/admin/:id/status', adminAuth, async (req, res) => {
  try {
    const { status, response } = req.body;

    if (!status) {
      return res.status(400).json({ message: 'Status is required' });
    }

    const complaint = await Complaint.findById(req.params.id);
    if (!complaint) {
      return res.status(404).json({ message: 'Complaint not found' });
    }

    await complaint.updateStatus(status, req.user._id, response);
    await complaint.populate([
      { path: 'user', select: 'name email' },
      { path: 'orderId', select: 'orderNumber total' },
      { path: 'bookId', select: 'title author' },
      { path: 'resolvedBy', select: 'name' }
    ]);

    // Send email notification if complaint is resolved
    if (status === 'Resolved' && complaint.user) {
      try {
        await sendComplaintResolvedEmail(
          complaint.user.email,
          complaint.user.name,
          complaint
        );
        console.log(`Complaint resolved email sent successfully`);
      } catch (emailError) {
        console.error(`Failed to send complaint resolved email:`, emailError);
      }
    }

    res.json({
      message: 'Complaint status updated successfully',
      complaint
    });
  } catch (error) {
    console.error('Update complaint status error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Get complaint statistics (admin only)
router.get('/admin/stats/overview', adminAuth, async (req, res) => {
  try {
    const stats = await Complaint.aggregate([
      {
        $group: {
          _id: '$status',
          count: { $sum: 1 }
        }
      }
    ]);

    const priorityStats = await Complaint.aggregate([
      {
        $group: {
          _id: '$priority',
          count: { $sum: 1 }
        }
      }
    ]);

    const categoryStats = await Complaint.aggregate([
      {
        $group: {
          _id: '$category',
          count: { $sum: 1 }
        }
      }
    ]);

    const userTypeStats = await Complaint.aggregate([
      {
        $group: {
          _id: '$userType',
          count: { $sum: 1 }
        }
      }
    ]);

    const totalComplaints = await Complaint.countDocuments();
    const openComplaints = await Complaint.countDocuments({ status: 'Open' });
    const resolvedComplaints = await Complaint.countDocuments({ status: 'Resolved' });
    const userComplaints = await Complaint.countDocuments({ userType: 'user' });
    const sellerComplaints = await Complaint.countDocuments({ userType: 'seller' });

    res.json({
      totalComplaints,
      openComplaints,
      resolvedComplaints,
      userComplaints,
      sellerComplaints,
      statusStats: stats,
      priorityStats,
      categoryStats,
      userTypeStats
    });
  } catch (error) {
    console.error('Get complaint stats error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

module.exports = router;