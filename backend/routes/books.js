const express = require('express');
const Book = require('../models/Book');
const { auth } = require('../middleware/auth');

const router = express.Router();

// Get featured books (must come before /:id route)
router.get('/featured/list', async (req, res) => {
  try {
    const books = await Book.find({ featured: true })
      .limit(8)
      .select('-reviews');

    res.json(books);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Get bestsellers (must come before /:id route)
router.get('/bestsellers/list', async (req, res) => {
  try {
    const books = await Book.find({ bestseller: true })
      .limit(8)
      .select('-reviews');

    res.json(books);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Get new arrivals (must come before /:id route)
router.get('/new-arrivals/list', async (req, res) => {
  try {
    const books = await Book.find({ newArrival: true })
      .limit(8)
      .select('-reviews');

    res.json(books);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Get categories (must come before /:id route)
router.get('/categories/list', async (req, res) => {
  try {
    const categories = await Book.distinct('category');
    res.json(categories);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Get all books with filtering and pagination
router.get('/', async (req, res) => {
  try {
    const {
      page = 1,
      limit = 12,
      category,
      search,
      sortBy = 'createdAt',
      sortOrder = 'desc',
      minPrice,
      maxPrice,
      featured,
      bestseller,
      newArrival,
      publisher
    } = req.query;

    // Build filter object
    const filter = {};
    
    if (category) filter.category = category;
    if (publisher) filter.publisher = { $regex: publisher, $options: 'i' }; // Case-insensitive publisher search
    if (featured) filter.featured = featured === 'true';
    if (bestseller) filter.bestseller = bestseller === 'true';
    if (newArrival) filter.newArrival = newArrival === 'true';
    
    if (minPrice || maxPrice) {
      filter.price = {};
      if (minPrice) filter.price.$gte = Number(minPrice);
      if (maxPrice) filter.price.$lte = Number(maxPrice);
    }

    if (search) {
      filter.$text = { $search: search };
    }

    // Build sort object
    const sort = {};
    sort[sortBy] = sortOrder === 'desc' ? -1 : 1;

    const skip = (page - 1) * limit;

    const books = await Book.find(filter)
      .sort(sort)
      .skip(skip)
      .limit(Number(limit))
      .select('-reviews');

    const total = await Book.countDocuments(filter);

    res.json({
      books,
      pagination: {
        current: Number(page),
        pages: Math.ceil(total / limit),
        total,
        hasNext: page * limit < total,
        hasPrev: page > 1
      }
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Get single book by ID
router.get('/:id', async (req, res) => {
  try {
    const book = await Book.findById(req.params.id)
      .populate('reviews.user', 'name avatar');

    if (!book) {
      return res.status(404).json({ message: 'Book not found' });
    }

    res.json(book);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Add review to book
router.post('/:id/reviews', auth, async (req, res) => {
  try {
    const { rating, comment } = req.body;

    // Validate input
    if (!rating || rating < 1 || rating > 5) {
      return res.status(400).json({ message: 'Rating must be between 1 and 5' });
    }

    // Validate book ID format
    if (!req.params.id.match(/^[0-9a-fA-F]{24}$/)) {
      return res.status(400).json({ message: 'Invalid book ID format' });
    }

    const book = await Book.findById(req.params.id);

    if (!book) {
      return res.status(404).json({ message: 'Book not found' });
    }

    // Initialize reviews array if it doesn't exist
    if (!book.reviews) {
      book.reviews = [];
    }

    // Initialize rating object if it doesn't exist or is corrupted
    if (!book.rating || typeof book.rating !== 'object' || book.rating.constructor !== Object) {
      book.rating = { average: 0, count: 0 };
    }

    // Check if user already reviewed this book
    const existingReview = book.reviews.find(
      review => review.user && review.user.toString() === req.user._id.toString()
    );

    if (existingReview) {
      return res.status(400).json({ message: 'You have already reviewed this book. Use PUT to update your review.' });
    }

    // Add new review with explicit date
    const newReview = {
      user: req.user._id,
      rating: Number(rating),
      comment: comment || '',
      createdAt: new Date()
    };

    book.reviews.push(newReview);

    // Update rating average
    const totalRating = book.reviews.reduce((sum, review) => sum + (review.rating || 0), 0);
    book.rating.average = book.reviews.length > 0 ? totalRating / book.reviews.length : 0;
    book.rating.count = book.reviews.length;

    await book.save();

    // Populate user info for response
    await book.populate('reviews.user', 'name avatar');
    const addedReview = book.reviews[book.reviews.length - 1];

    res.status(201).json({ 
      message: 'Review added successfully',
      review: addedReview
    });
  } catch (error) {
    console.error('Review creation error:', error);
    
    // Handle specific MongoDB errors
    if (error.name === 'ValidationError') {
      return res.status(400).json({ 
        message: 'Validation error',
        details: error.message
      });
    }
    
    if (error.name === 'CastError') {
      return res.status(400).json({ 
        message: 'Invalid book ID'
      });
    }

    res.status(500).json({ 
      message: 'Server error while adding review',
      error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
    });
  }
});

// Update review
router.put('/:id/reviews', auth, async (req, res) => {
  try {
    const { rating, comment } = req.body;
    const book = await Book.findById(req.params.id);

    if (!book) {
      return res.status(404).json({ message: 'Book not found' });
    }

    // Find user's existing review
    const reviewIndex = book.reviews.findIndex(
      review => review.user.toString() === req.user._id.toString()
    );

    if (reviewIndex === -1) {
      return res.status(404).json({ message: 'Review not found. Use POST to add a new review.' });
    }

    // Update the review
    book.reviews[reviewIndex].rating = Number(rating);
    book.reviews[reviewIndex].comment = comment;
    book.reviews[reviewIndex].createdAt = new Date(); // Update timestamp

    // Recalculate rating average
    const totalRating = book.reviews.reduce((sum, review) => sum + review.rating, 0);
    book.rating.average = totalRating / book.reviews.length;
    book.rating.count = book.reviews.length;

    await book.save();

    // Populate user info for response
    await book.populate('reviews.user', 'name avatar');
    const updatedReview = book.reviews[reviewIndex];

    res.json({ 
      message: 'Review updated successfully',
      review: updatedReview
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Delete review
router.delete('/:id/reviews', auth, async (req, res) => {
  try {
    const book = await Book.findById(req.params.id);

    if (!book) {
      return res.status(404).json({ message: 'Book not found' });
    }

    // Find and remove user's review
    const reviewIndex = book.reviews.findIndex(
      review => review.user.toString() === req.user._id.toString()
    );

    if (reviewIndex === -1) {
      return res.status(404).json({ message: 'Review not found' });
    }

    book.reviews.splice(reviewIndex, 1);

    // Recalculate rating average
    if (book.reviews.length > 0) {
      const totalRating = book.reviews.reduce((sum, review) => sum + review.rating, 0);
      book.rating.average = totalRating / book.reviews.length;
      book.rating.count = book.reviews.length;
    } else {
      book.rating.average = 0;
      book.rating.count = 0;
    }

    await book.save();

    res.json({ message: 'Review deleted successfully' });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
});

module.exports = router;
