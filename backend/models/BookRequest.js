const mongoose = require('mongoose');

const bookRequestSchema = new mongoose.Schema({
  seller: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  type: {
    type: String,
    enum: ['create', 'update'],
    required: true
  },
  status: {
    type: String,
    enum: ['pending', 'approved', 'rejected'],
    default: 'pending'
  },
  originalBook: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Book',
    required: function() {
      return this.type === 'update';
    }
  },
  bookData: {
    title: {
      type: String,
      required: true
    },
    author: {
      type: String,
      required: true
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
    category: {
      type: String,
      required: true,
      enum: ['Fiction', 'Non-Fiction', 'Mystery', 'Romance', 'Sci-Fi', 'Fantasy', 'Biography', 'History', 'Self-Help', 'Technology', 'Business', 'Health', 'Travel', 'Cooking', 'Art', 'Education', 'Children', 'Poetry', 'Drama', 'Science', 'Mythology', 'Other']
    },
    isbn: {
      type: String,
      sparse: true
    },
    publisher: String,
    publishedDate: Date,
    pages: {
      type: Number,
      min: 1
    },
    language: {
      type: String,
      default: 'English'
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
    tags: [String],
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
    }
  },
  adminNotes: {
    type: String,
    default: ''
  },
  reviewedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  reviewedAt: Date,
  submittedAt: {
    type: Date,
    default: Date.now
  }
}, {
  timestamps: true
});

// Index for efficient queries
bookRequestSchema.index({ seller: 1, status: 1 });
bookRequestSchema.index({ status: 1, submittedAt: -1 });

module.exports = mongoose.model('BookRequest', bookRequestSchema);