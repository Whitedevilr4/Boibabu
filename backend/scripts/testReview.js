const mongoose = require('mongoose');
const Book = require('../models/Book');
const User = require('../models/User');

// Load environment variables
require('dotenv').config();

// Database connection
const connectDB = async () => {
  try {
    const mongoUri = process.env.MONGODB_URI || process.env.DATABASE_URL;
    if (!mongoUri) {
      throw new Error('MongoDB URI not found in environment variables');
    }
    
    await mongoose.connect(mongoUri, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    });
    console.log('MongoDB connected');
  } catch (error) {
    console.error('Database connection error:', error);
    process.exit(1);
  }
};

// Test adding a review to a specific book
const testReview = async () => {
  try {
    console.log('Starting review test...');
    
    // Find the problematic book
    const bookId = '695fa7ebf44d1c0bdc73fe70';
    const book = await Book.findById(bookId);
    
    if (!book) {
      console.log('❌ Book not found');
      return;
    }
    
    console.log('✅ Book found:', book.title);
    console.log('Book structure:');
    console.log('- reviews:', !!book.reviews, book.reviews ? book.reviews.length : 'N/A');
    console.log('- rating:', !!book.rating, book.rating);
    console.log('- createdBy:', !!book.createdBy);
    
    // Find a test user
    const user = await User.findOne({ role: 'user' });
    if (!user) {
      console.log('❌ No test user found');
      return;
    }
    
    console.log('✅ Test user found:', user.name);
    
    // Initialize missing fields
    if (!book.reviews) {
      book.reviews = [];
      console.log('🔧 Initialized reviews array');
    }
    
    if (!book.rating) {
      book.rating = { average: 0, count: 0 };
      console.log('🔧 Initialized rating object');
    }
    
    if (!book.createdBy) {
      const adminUser = await User.findOne({ role: 'admin' });
      if (adminUser) {
        book.createdBy = adminUser._id;
        console.log('🔧 Set createdBy to admin user');
      }
    }
    
    // Check if user already reviewed
    const existingReview = book.reviews.find(
      review => review.user && review.user.toString() === user._id.toString()
    );
    
    if (existingReview) {
      console.log('❌ User already reviewed this book');
      return;
    }
    
    // Add test review
    const testReview = {
      user: user._id,
      rating: 5,
      comment: 'Test review from script',
      createdAt: new Date()
    };
    
    console.log('📝 Adding test review:', testReview);
    
    book.reviews.push(testReview);
    
    // Update rating
    const totalRating = book.reviews.reduce((sum, review) => sum + (review.rating || 0), 0);
    book.rating.average = book.reviews.length > 0 ? totalRating / book.reviews.length : 0;
    book.rating.count = book.reviews.length;
    
    console.log('📊 Updated rating:', book.rating);
    
    // Try to save
    console.log('💾 Attempting to save...');
    await book.save();
    console.log('✅ Book saved successfully!');
    
    // Verify the save
    const updatedBook = await Book.findById(bookId);
    console.log('✅ Verification - Reviews count:', updatedBook.reviews.length);
    console.log('✅ Verification - Rating:', updatedBook.rating);
    
  } catch (error) {
    console.error('❌ Test failed:', error);
    console.error('Error name:', error.name);
    console.error('Error message:', error.message);
    if (error.errors) {
      console.error('Validation errors:', error.errors);
    }
  }
};

// Run the test
const runTest = async () => {
  await connectDB();
  await testReview();
  await mongoose.connection.close();
  console.log('Database connection closed');
  process.exit(0);
};

// Check if this script is being run directly
if (require.main === module) {
  runTest();
}

module.exports = { testReview };