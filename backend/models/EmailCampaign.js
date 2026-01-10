const mongoose = require('mongoose');

const emailCampaignSchema = new mongoose.Schema({
  title: {
    type: String,
    required: true,
    trim: true
  },
  subject: {
    type: String,
    required: true,
    trim: true
  },
  template: {
    type: String,
    required: true,
    enum: ['marketing', 'announcement', 'newsletter', 'promotion', 'official', 'custom']
  },
  content: {
    type: String,
    required: true
  },
  htmlContent: {
    type: String
  },
  recipients: {
    type: String,
    enum: ['all_users', 'all_sellers', 'active_users', 'suspended_users', 'specific_users'],
    required: true
  },
  specificRecipients: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  }],
  status: {
    type: String,
    enum: ['draft', 'scheduled', 'sending', 'sent', 'failed'],
    default: 'draft'
  },
  scheduledAt: {
    type: Date
  },
  sentAt: {
    type: Date
  },
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  stats: {
    totalRecipients: {
      type: Number,
      default: 0
    },
    sentCount: {
      type: Number,
      default: 0
    },
    failedCount: {
      type: Number,
      default: 0
    },
    deliveryRate: {
      type: Number,
      default: 0
    }
  },
  errorLogs: [{
    email: String,
    error: String,
    timestamp: {
      type: Date,
      default: Date.now
    }
  }]
}, {
  timestamps: true,
  suppressReservedKeysWarning: true
});

// Index for better query performance
emailCampaignSchema.index({ createdBy: 1, createdAt: -1 });
emailCampaignSchema.index({ status: 1 });
emailCampaignSchema.index({ scheduledAt: 1 });

module.exports = mongoose.model('EmailCampaign', emailCampaignSchema);