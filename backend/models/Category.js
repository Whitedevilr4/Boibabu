const mongoose = require('mongoose');

const categorySchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    unique: true,
    trim: true
  },
  description: {
    type: String,
    trim: true
  },
  slug: {
    type: String,
    required: true,
    unique: true,
    lowercase: true
  },
  image: {
    url: String,
    filename: String
  },
  isActive: {
    type: Boolean,
    default: true
  },
  sortOrder: {
    type: Number,
    default: 0
  }
}, {
  timestamps: true
});

// Generate slug before saving
categorySchema.pre('save', function(next) {
  console.log('Pre-save hook called for category:', this.name);
  
  if (this.isNew || this.isModified('name') || !this.slug) {
    if (this.name && this.name.trim()) {
      this.slug = this.name.toLowerCase()
        .trim()
        .replace(/[^a-z0-9\s-]/g, '') // Remove special characters
        .replace(/\s+/g, '-') // Replace spaces with hyphens
        .replace(/-+/g, '-') // Replace multiple hyphens with single
        .replace(/(^-|-$)/g, ''); // Remove leading/trailing hyphens
      
      // Ensure slug is not empty
      if (!this.slug) {
        this.slug = `category-${Date.now()}`;
      }
    } else {
      this.slug = `category-${Date.now()}`;
    }
  }
  
  console.log('Generated slug:', this.slug);
  next();
});

module.exports = mongoose.model('Category', categorySchema);