const mongoose = require('mongoose');

const heroSlideSchema = new mongoose.Schema({
  title: {
    type: String,
    required: true,
    trim: true
  },
  subtitle: {
    type: String,
    required: true,
    trim: true
  },
  description: {
    type: String,
    default: ''
  },
  backgroundImage: {
    type: String, // URL to background image
    required: true
  },
  overlayColor: {
    type: String,
    default: 'rgba(0, 0, 0, 0.4)' // Always dark overlay
  },
  textColor: {
    type: String,
    default: '#ffffff'
  },
  primaryButton: {
    text: {
      type: String,
      default: 'Browse Books'
    },
    link: {
      type: String,
      default: '/books'
    },
    style: {
      type: String,
      enum: ['primary', 'secondary', 'outline'],
      default: 'primary'
    }
  },
  secondaryButton: {
    text: {
      type: String,
      default: 'Featured Books'
    },
    link: {
      type: String,
      default: '/books?featured=true'
    },
    style: {
      type: String,
      enum: ['primary', 'secondary', 'outline'],
      default: 'outline'
    }
  },
  displayOrder: {
    type: Number,
    default: 0
  },
  isActive: {
    type: Boolean,
    default: true
  },
  autoSlideDelay: {
    type: Number,
    default: 5000 // 5 seconds
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
heroSlideSchema.index({ isActive: 1, displayOrder: 1 });

// Static method to get active hero slides
heroSlideSchema.statics.getActiveSlides = async function() {
  return await this.find({ isActive: true })
    .sort({ displayOrder: 1, createdAt: -1 })
    .populate('createdBy updatedBy', 'name');
};

module.exports = mongoose.model('HeroSlide', heroSlideSchema);