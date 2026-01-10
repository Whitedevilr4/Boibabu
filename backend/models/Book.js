const mongoose = require('mongoose');
const LANGUAGES = require('../constants/languages');

const bookSchema = new mongoose.Schema({
  title: {
    type: String,
    required: true,
    trim: true
  },
  author: {
    type: String,
    required: true,
    trim: true
  },
  description: {
    type: String,
    required: true
  },
  price: {
    type: Number,
    required: true,
    min: 0
  },
  originalPrice: {
    type: Number,
    min: 0
  },
  category: {
    type: String,
    required: true,
    enum: ['Fiction', 'Non-Fiction', 'Mystery', 'Romance', 'Sci-Fi', 'Fantasy', 'Biography', 'History', 'Self-Help', 'Technology', 'Business', 'Health', 'Travel', 'Cooking', 'Art', 'Education', 'Children', 'Poetry', 'Drama', 'Science', 'Mythology', 'Other']
  },
  stock: {
    type: Number,
    required: true,
    min: 0,
    default: 0
  },
  images: [{
    type: String
  }],
  isbn: {
    type: String,
    unique: true,
    sparse: true
  },
  publisher: String,
  publishedDate: Date,
  pages: Number,
  language: {
    type: String,
    enum: LANGUAGES,
    default: 'English'
  },
  rating: {
    average: {
      type: Number,
      default: 0,
      min: 0,
      max: 5
    },
    count: {
      type: Number,
      default: 0
    }
  },
  reviews: [{
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    rating: {
      type: Number,
      required: true,
      min: 1,
      max: 5
    },
    comment: String,
    createdAt: {
      type: Date,
      default: Date.now
    }
  }],
  featured: {
    type: Boolean,
    default: false
  },
  bestseller: {
    type: Boolean,
    default: false
  },
  newArrival: {
    type: Boolean,
    default: false
  },
  seller: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
    // null for admin-created books, seller ID for seller-created books
  },
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true // Admin or seller who created/approved the book
  },
}, {
  timestamps: true
});

// Index for search functionality
bookSchema.index({ title: 'text', author: 'text', description: 'text' },
{ default_language: "none", language_override: "lang" });

module.exports = mongoose.model('Book', bookSchema);