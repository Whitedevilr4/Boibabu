const Notification = require('../models/Notification');

// Helper function to create notification
const createNotification = async (recipientId, type, title, message, data = {}) => {
  try {
    console.log(`Creating notification for user ${recipientId}: ${title}`);
    
    const notification = new Notification({
      recipient: recipientId,
      type,
      title,
      message,
      data
    });
    
    await notification.save();
    console.log(`Notification created successfully: ${notification._id}`);
    return notification;
  } catch (error) {
    console.error('Error creating notification:', error);
    throw error;
  }
};

// Helper function to create notifications for multiple recipients
const createBulkNotifications = async (recipientIds, type, title, message, data = {}) => {
  try {
    console.log(`Creating bulk notifications for ${recipientIds.length} users: ${title}`);
    
    const notifications = recipientIds.map(recipientId => ({
      recipient: recipientId,
      type,
      title,
      message,
      data
    }));
    
    const createdNotifications = await Notification.insertMany(notifications);
    console.log(`${createdNotifications.length} notifications created successfully`);
    return createdNotifications;
  } catch (error) {
    console.error('Error creating bulk notifications:', error);
    throw error;
  }
};

module.exports = {
  createNotification,
  createBulkNotifications
};