const express = require('express');
const Notification = require('../models/Notification');
const { auth, adminAuth } = require('../middleware/auth');
const { createNotification, createBulkNotifications } = require('../utils/notificationService');

const router = express.Router();

// Get user notifications
router.get('/', auth, async (req, res) => {
  try {
    const { page = 1, limit = 20, unreadOnly = false } = req.query;
    
    const filter = { recipient: req.user._id };
    if (unreadOnly === 'true') {
      filter.read = false;
    }

    const notifications = await Notification.find(filter)
      .sort({ createdAt: -1 })
      .limit(limit * 1)
      .skip((page - 1) * limit);

    const unreadCount = await Notification.countDocuments({
      recipient: req.user._id,
      read: false
    });

    res.json({
      notifications,
      unreadCount,
      pagination: {
        current: Number(page),
        pages: Math.ceil(await Notification.countDocuments(filter) / limit)
      }
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Mark notification as read
router.put('/:id/read', auth, async (req, res) => {
  try {
    const notification = await Notification.findOneAndUpdate(
      { _id: req.params.id, recipient: req.user._id },
      { read: true },
      { new: true }
    );

    if (!notification) {
      return res.status(404).json({ message: 'Notification not found' });
    }

    res.json(notification);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Mark all notifications as read
router.put('/mark-all-read', auth, async (req, res) => {
  try {
    await Notification.updateMany(
      { recipient: req.user._id, read: false },
      { read: true }
    );

    res.json({ message: 'All notifications marked as read' });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Create notification (admin only)
router.post('/', adminAuth, async (req, res) => {
  try {
    const { recipients, type, title, message, data } = req.body;

    const notifications = recipients.map(recipientId => ({
      recipient: recipientId,
      type,
      title,
      message,
      data
    }));

    const createdNotifications = await Notification.insertMany(notifications);
    res.status(201).json(createdNotifications);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Broadcast notification to multiple users (admin only)
router.post('/broadcast', adminAuth, async (req, res) => {
  try {
    const { recipients, type, title, message, priority = 'medium', data = {} } = req.body;

    if (!recipients || !Array.isArray(recipients) || recipients.length === 0) {
      return res.status(400).json({ message: 'Recipients array is required' });
    }

    if (!title || !message) {
      return res.status(400).json({ message: 'Title and message are required' });
    }

    const notifications = recipients.map(recipientId => ({
      recipient: recipientId,
      type: type || 'general',
      title,
      message,
      priority,
      data
    }));

    const createdNotifications = await Notification.insertMany(notifications);
    
    res.status(201).json({
      message: `Notification sent to ${recipients.length} users`,
      count: createdNotifications.length,
      notifications: createdNotifications
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Get all notifications for admin (admin only)
router.get('/admin', adminAuth, async (req, res) => {
  try {
    const { page = 1, limit = 20 } = req.query;
    
    // Get recent notifications sent to all users, grouped by content
    const notifications = await Notification.aggregate([
      {
        $sort: { createdAt: -1 }
      },
      {
        $group: {
          _id: {
            title: '$title',
            message: '$message',
            type: '$type',
            priority: '$priority',
            createdAt: {
              $dateToString: {
                format: '%Y-%m-%d %H:%M',
                date: '$createdAt'
              }
            }
          },
          recipientCount: { $sum: 1 },
          recipients: { $push: '$recipient' },
          firstCreated: { $first: '$createdAt' }
        }
      },
      {
        $project: {
          _id: 0,
          title: '$_id.title',
          message: '$_id.message',
          type: '$_id.type',
          priority: '$_id.priority',
          createdAt: '$firstCreated',
          recipientCount: 1
        }
      },
      { $sort: { createdAt: -1 } },
      { $skip: (Number(page) - 1) * Number(limit) },
      { $limit: Number(limit) }
    ]);

    const totalCount = await Notification.aggregate([
      {
        $group: {
          _id: {
            title: '$title',
            message: '$message',
            type: '$type',
            priority: '$priority'
          }
        }
      },
      { $count: 'total' }
    ]);

    res.json({
      notifications,
      pagination: {
        current: Number(page),
        pages: Math.ceil((totalCount[0]?.total || 0) / Number(limit)),
        total: totalCount[0]?.total || 0
      }
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Helper function to create notification
module.exports = { router, createNotification };