const mongoose = require('mongoose');
const Book = require('../models/Book');

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

// Fix books with missing or corrupted review/rating structures
const fixBookReviews = async () => {
  try {
    console.log('Starting book review structure fix...');
    
    // Find all books
    const books = await Book.find({});
    console.log(`Found ${books.length} books to check`);
    
    let fixedCount = 0;
    
    for (const book of books) {
      let needsUpdate = false;
      
      // Initialize reviews array if missing
      if (!book.reviews) {
        book.reviews = [];
        needsUpdate = true;
        console.log(`Fixed missing reviews array for book: ${book.title}`);
      }
      
      // Initialize rating object if missing or corrupted
      if (!book.rating || typeof book.rating !== 'object' || book.rating.constructor !== Object) {
        book.rating = { average: 0, count: 0 };
        needsUpdate = true;
        console.log(`Fixed missing/corrupted rating object for book: ${book.title}`);
      }
      
      // Fix missing createdBy field (set to first admin user if missing)
      if (!book.createdBy) {
        // Find first admin user
        const User = require('../models/User');
        const adminUser = await User.findOne({ role: 'admin' });
        if (adminUser) {
          book.createdBy = adminUser._id;
          needsUpdate = true;
          console.log(`Fixed missing createdBy for book: ${book.title}`);
        }
      }
      
      // Fix corrupted reviews array
      if (book.reviews && book.reviews.length > 0) {
        const validReviews = [];
        for (const review of book.reviews) {
          // Skip corrupted reviews (empty strings, null, undefined, or invalid objects)
          if (review && typeof review === 'object' && review.user && review.rating) {
            if (!review.createdAt) {
              review.createdAt = new Date();
              needsUpdate = true;
              console.log(`Fixed missing createdAt for review in book: ${book.title}`);
            }
            validReviews.push(review);
          } else {
            console.log(`Removed corrupted review from book: ${book.title}`);
            needsUpdate = true;
          }
        }
        
        if (validReviews.length !== book.reviews.length) {
          book.reviews = validReviews;
          console.log(`Cleaned reviews array for book: ${book.title} (${book.reviews.length} -> ${validReviews.length})`);
        }
      }
      
      // Recalculate rating if reviews exist but rating is incorrect
      if (book.reviews && book.reviews.length > 0) {
        const totalRating = book.reviews.reduce((sum, review) => sum + (review.rating || 0), 0);
        const calculatedAverage = totalRating / book.reviews.length;
        const calculatedCount = book.reviews.length;
        
        if (book.rating.average !== calculatedAverage || book.rating.count !== calculatedCount) {
          book.rating.average = calculatedAverage;
          book.rating.count = calculatedCount;
          needsUpdate = true;
          console.log(`Recalculated rating for book: ${book.title} - Average: ${calculatedAverage}, Count: ${calculatedCount}`);
        }
      }
      
      // Save if changes were made
      if (needsUpdate) {
        try {
          await book.save();
          fixedCount++;
          console.log(`✅ Successfully updated book: ${book.title}`);
        } catch (saveError) {
          console.error(`❌ Error saving book ${book.title}:`, saveError.message);
        }
      }
    }
    
    console.log(`\nBook review structure fix completed!`);
    console.log(`Total books checked: ${books.length}`);
    console.log(`Books fixed: ${fixedCount}`);
    
  } catch (error) {
    console.error('Error fixing book reviews:', error);
  }
};

// Run the fix
const runFix = async () => {
  await connectDB();
  await fixBookReviews();
  await mongoose.connection.close();
  console.log('Database connection closed');
  process.exit(0);
};

// Check if this script is being run directly
if (require.main === module) {
  runFix();
}

module.exports = { fixBookReviews };