const mongoose = require('mongoose');

const complaintSchema = new mongoose.Schema({
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  userType: {
    type: String,
    enum: ['user', 'seller'],
    required: true,
    default: 'user'
  },
  subject: {
    type: String,
    required: true,
    trim: true,
    maxlength: 200
  },
  description: {
    type: String,
    required: true,
    trim: true,
    maxlength: 2000
  },
  category: {
    type: String,
    required: true,
    enum: {
      values: ['Order Issue', 'Payment Issue', 'Book Quality', 'Delivery Issue', 'Account Issue', 'Commission Issue', 'Platform Issue', 'Technical Issue', 'Other'],
      message: 'Invalid category'
    },
    default: 'Other'
  },
  priority: {
    type: String,
    enum: ['Low', 'Medium', 'High', 'Urgent'],
    default: 'Medium'
  },
  status: {
    type: String,
    enum: ['Open', 'In Progress', 'Resolved', 'Closed'],
    default: 'Open'
  },
  orderId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Order',
    required: false
  },
  bookId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Book',
    required: false
  },
  adminResponse: {
    type: String,
    trim: true,
    maxlength: 2000
  },
  adminResponseDate: {
    type: Date
  },
  resolvedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  resolvedDate: {
    type: Date
  }
}, {
  timestamps: true
});

// Index for efficient queries
complaintSchema.index({ user: 1, status: 1 });
complaintSchema.index({ userType: 1, status: 1 });
complaintSchema.index({ status: 1, priority: 1 });
complaintSchema.index({ createdAt: -1 });

// Virtual for complaint age in days
complaintSchema.virtual('ageInDays').get(function() {
  return Math.floor((Date.now() - this.createdAt) / (1000 * 60 * 60 * 24));
});

// Method to update status
complaintSchema.methods.updateStatus = function(status, adminId = null, response = null) {
  this.status = status;
  
  if (response) {
    this.adminResponse = response;
    this.adminResponseDate = new Date();
  }
  
  if (status === 'Resolved' || status === 'Closed') {
    this.resolvedBy = adminId;
    this.resolvedDate = new Date();
  }
  
  return this.save();
};

module.exports = mongoose.model('Complaint', complaintSchema);