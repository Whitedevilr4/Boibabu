const mongoose = require('mongoose');

const publisherAdSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    trim: true
  },
  image: {
    type: String, // URL to publisher logo/image
    required: true
  },
  description: {
    type: String,
    default: 'Quality Books'
  },
  website: {
    type: String, // Publisher's website URL
    default: ''
  },
  isActive: {
    type: Boolean,
    default: true
  },
  displayOrder: {
    type: Number,
    default: 0
  },
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  updatedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  }
}, {
  timestamps: true
});

// Index for efficient querying
publisherAdSchema.index({ isActive: 1, displayOrder: 1 });

// Static method to get active publisher ads
publisherAdSchema.statics.getActiveAds = async function() {
  return await this.find({ isActive: true })
    .sort({ displayOrder: 1, createdAt: -1 })
    .populate('createdBy updatedBy', 'name');
};

module.exports = mongoose.model('PublisherAd', publisherAdSchema);