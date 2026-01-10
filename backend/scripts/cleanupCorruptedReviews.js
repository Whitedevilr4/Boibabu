const mongoose = require('mongoose');
const Book = require('../models/Book');

// Connect to MongoDB
mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/bookstore', {
  useNewUrlParser: true,
  useUnifiedTopology: true,
});

const cleanupCorruptedReviews = async () => {
  try {
    console.log('Starting cleanup of corrupted reviews...');
    
    // Find all books
    const books = await Book.find({});
    console.log(`Found ${books.length} books to check`);

    let fixedCount = 0;
    let totalCorruptedReviews = 0;

    for (const book of books) {
      let needsUpdate = false;
      let originalReviewsCount = 0;
      let cleanReviewsCount = 0;

      // Check if reviews field exists and is an array
      if (book.reviews) {
        originalReviewsCount = book.reviews.length;
        
        // Filter out corrupted reviews
        const cleanReviews = book.reviews.filter(review => {
          return review && 
                 typeof review === 'object' && 
                 review.user && 
                 typeof review.rating === 'number' &&
                 review.rating >= 1 && 
                 review.rating <= 5;
        });

        cleanReviewsCount = cleanReviews.length;

        if (cleanReviews.length !== book.reviews.length) {
          needsUpdate = true;
          totalCorruptedReviews += (book.reviews.length - cleanReviews.length);
          book.reviews = cleanReviews;
        }
      } else {
        // Initialize empty reviews array if it doesn't exist
        book.reviews = [];
        needsUpdate = true;
      }

      // Recalculate rating if needed
      if (needsUpdate || !book.rating || typeof book.rating !== 'object') {
        if (book.reviews.length > 0) {
          const totalRating = book.reviews.reduce((sum, review) => sum + review.rating, 0);
          book.rating = {
            average: totalRating / book.reviews.length,
            count: book.reviews.length
          };
        } else {
          book.rating = {
            average: 0,
            count: 0
          };
        }
        needsUpdate = true;
      }

      if (needsUpdate) {
        await book.save();
        fixedCount++;
        console.log(`Fixed "${book.title}": ${originalReviewsCount} -> ${cleanReviewsCount} reviews`);
      }
    }

    console.log(`\nCleanup completed:`);
    console.log(`- Books checked: ${books.length}`);
    console.log(`- Books fixed: ${fixedCount}`);
    console.log(`- Corrupted reviews removed: ${totalCorruptedReviews}`);

    // Show some examples of clean books
    const booksWithReviews = await Book.find({
      'reviews.0': { $exists: true }
    }).limit(3);

    if (booksWithReviews.length > 0) {
      console.log('\nExamples of books with clean reviews:');
      booksWithReviews.forEach(book => {
        console.log(`- "${book.title}": ${book.reviews.length} reviews, avg rating: ${book.rating.average.toFixed(1)}`);
      });
    }

  } catch (error) {
    console.error('Error cleaning up reviews:', error);
  } finally {
    mongoose.connection.close();
  }
};

cleanupCorruptedReviews();
