const mongoose = require('mongoose');

const pageSchema = new mongoose.Schema({
  title: {
    type: String,
    required: true,
    trim: true
  },
  slug: {
    type: String,
    required: true,
    unique: true,
    trim: true,
    lowercase: true
  },
  content: {
    type: String,
    required: true
  },
  metaTitle: {
    type: String,
    trim: true
  },
  metaDescription: {
    type: String,
    trim: true
  },
  isActive: {
    type: Boolean,
    default: true
  },
  showInFooter: {
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

// Create slug from title before saving
pageSchema.pre('save', function(next) {
  if (this.isModified('title') && !this.slug) {
    this.slug = this.title
      .toLowerCase()
      .replace(/[^a-z0-9\s-]/g, '') // Remove special characters
      .replace(/\s+/g, '-') // Replace spaces with hyphens
      .replace(/-+/g, '-') // Replace multiple hyphens with single
      .trim('-'); // Remove leading/trailing hyphens
  }
  next();
});

// Static method to get active footer pages
pageSchema.statics.getFooterPages = async function() {
  return this.find({ 
    isActive: true, 
    showInFooter: true 
  })
  .select('title slug displayOrder')
  .sort({ displayOrder: 1, title: 1 });
};

// Static method to get page by slug
pageSchema.statics.getBySlug = async function(slug) {
  return this.findOne({ 
    slug: slug.toLowerCase(), 
    isActive: true 
  });
};

module.exports = mongoose.model('Page', pageSchema);
