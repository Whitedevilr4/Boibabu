const mongoose = require('mongoose');
const Book = require('./models/Book');
const User = require('./models/User');
const Category = require('./models/Category');
const Coupon = require('./models/Coupon');
require('dotenv').config();

const sampleCategories = [
  {
    name: "Fiction",
    description: "Fictional stories and novels",
    slug: "fiction",
    sortOrder: 1
  },
  {
    name: "Technology",
    description: "Books about programming, software development, and technology",
    slug: "technology",
    sortOrder: 2
  },
  {
    name: "History",
    description: "Historical books and biographies",
    slug: "history",
    sortOrder: 3
  },
  {
    name: "Science",
    description: "Scientific books and research",
    slug: "science",
    sortOrder: 4
  },
  {
    name: "Business",
    description: "Business and entrepreneurship books",
    slug: "business",
    sortOrder: 5
  },
  {
    name: "Self-Help",
    description: "Personal development and self-improvement",
    slug: "self-help",
    sortOrder: 6
  }
];

const sampleBooks = [
  {
    title: "The Great Gatsby",
    author: "F. Scott Fitzgerald",
    description: "A classic American novel set in the Jazz Age, exploring themes of wealth, love, and the American Dream.",
    price: 899,
    originalPrice: 1199,
    category: "Fiction",
    stock: 25,
    images: [{ url: "data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMjAwIiBoZWlnaHQ9IjMwMCIgdmlld0JveD0iMCAwIDIwMCAzMDAiIGZpbGw9Im5vbmUiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+CjxyZWN0IHdpZHRoPSIyMDAiIGhlaWdodD0iMzAwIiBmaWxsPSIjRjNGNEY2Ii8+CjxyZWN0IHg9IjIwIiB5PSIyMCIgd2lkdGg9IjE2MCIgaGVpZ2h0PSIyNjAiIGZpbGw9IiNFNUU3RUIiLz4KPHJlY3QgeD0iNDAiIHk9IjQwIiB3aWR0aD0iMTIwIiBoZWlnaHQ9IjgiIGZpbGw9IiM5Q0EzQUYiLz4KPHJlY3QgeD0iNDAiIHk9IjYwIiB3aWR0aD0iODAiIGhlaWdodD0iNiIgZmlsbD0iIzlDQTNBRiIvPgo8cmVjdCB4PSI0MCIgeT0iMTAwIiB3aWR0aD0iMTIwIiBoZWlnaHQ9IjQiIGZpbGw9IiNEMUQ1REIiLz4KPHJlY3QgeD0iNDAiIHk9IjExMCIgd2lkdGg9IjEyMCIgaGVpZ2h0PSI0IiBmaWxsPSIjRDFENURCIi8+CjxyZWN0IHg9IjQwIiB5PSIxMjAiIHdpZHRoPSIxMjAiIGhlaWdodD0iNCIgZmlsbD0iI0QxRDVEQiIvPgo8cmVjdCB4PSI0MCIgeT0iMTMwIiB3aWR0aD0iMTIwIiBoZWlnaHQ9IjQiIGZpbGw9IiNEMUQ1REIiLz4KPHJlY3QgeD0iNDAiIHk9IjE0MCIgd2lkdGg9IjEyMCIgaGVpZ2h0PSI0IiBmaWxsPSIjRDFENURCIi8+CjxyZWN0IHg9IjQwIiB5PSIxNTAiIHdpZHRoPSI5MCIgaGVpZ2h0PSI0IiBmaWxsPSIjRDFENURCIi8+Cjx0ZXh0IHg9IjEwMCIgeT0iMjIwIiB0ZXh0LWFuY2hvcj0ibWlkZGxlIiBmaWxsPSIjNkI3MjgwIiBmb250LWZhbWlseT0iQXJpYWwiIGZvbnQtc2l6ZT0iMTQiPkJvb2sgSW1hZ2U8L3RleHQ+Cjwvc3ZnPgo=", filename: "placeholder-book.jpg" }],
    isbn: "9780743273565",
    publisher: "Scribner",
    pages: 180,
    language: "English",
    featured: true,
    bestseller: true,
    rating: { average: 4.2, count: 1250 }
  },
  {
    title: "To Kill a Mockingbird",
    author: "Harper Lee",
    description: "A gripping tale of racial injustice and childhood innocence in the American South.",
    price: 999,
    originalPrice: 1299,
    category: "Fiction",
    stock: 30,
    images: [{ url: "data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMjAwIiBoZWlnaHQ9IjMwMCIgdmlld0JveD0iMCAwIDIwMCAzMDAiIGZpbGw9Im5vbmUiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+CjxyZWN0IHdpZHRoPSIyMDAiIGhlaWdodD0iMzAwIiBmaWxsPSIjRjNGNEY2Ii8+CjxyZWN0IHg9IjIwIiB5PSIyMCIgd2lkdGg9IjE2MCIgaGVpZ2h0PSIyNjAiIGZpbGw9IiNFNUU3RUIiLz4KPHJlY3QgeD0iNDAiIHk9IjQwIiB3aWR0aD0iMTIwIiBoZWlnaHQ9IjgiIGZpbGw9IiM5Q0EzQUYiLz4KPHJlY3QgeD0iNDAiIHk9IjYwIiB3aWR0aD0iODAiIGhlaWdodD0iNiIgZmlsbD0iIzlDQTNBRiIvPgo8cmVjdCB4PSI0MCIgeT0iMTAwIiB3aWR0aD0iMTIwIiBoZWlnaHQ9IjQiIGZpbGw9IiNEMUQ1REIiLz4KPHJlY3QgeD0iNDAiIHk9IjExMCIgd2lkdGg9IjEyMCIgaGVpZ2h0PSI0IiBmaWxsPSIjRDFENURCIi8+CjxyZWN0IHg9IjQwIiB5PSIxMjAiIHdpZHRoPSIxMjAiIGhlaWdodD0iNCIgZmlsbD0iI0QxRDVEQiIvPgo8cmVjdCB4PSI0MCIgeT0iMTMwIiB3aWR0aD0iMTIwIiBoZWlnaHQ9IjQiIGZpbGw9IiNEMUQ1REIiLz4KPHJlY3QgeD0iNDAiIHk9IjE0MCIgd2lkdGg9IjEyMCIgaGVpZ2h0PSI0IiBmaWxsPSIjRDFENURCIi8+CjxyZWN0IHg9IjQwIiB5PSIxNTAiIHdpZHRoPSI5MCIgaGVpZ2h0PSI0IiBmaWxsPSIjRDFENURCIi8+Cjx0ZXh0IHg9IjEwMCIgeT0iMjIwIiB0ZXh0LWFuY2hvcj0ibWlkZGxlIiBmaWxsPSIjNkI3MjgwIiBmb250LWZhbWlseT0iQXJpYWwiIGZvbnQtc2l6ZT0iMTQiPkJvb2sgSW1hZ2U8L3RleHQ+Cjwvc3ZnPgo=", filename: "placeholder-book.jpg" }],
    isbn: "9780061120084",
    publisher: "Harper Perennial",
    pages: 376,
    language: "English",
    featured: true,
    rating: { average: 4.5, count: 2100 }
  },
  {
    title: "1984",
    author: "George Orwell",
    description: "A dystopian social science fiction novel about totalitarian control and surveillance.",
    price: 799,
    originalPrice: 1099,
    category: "Fiction",
    stock: 40,
    images: [{ url: "data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMjAwIiBoZWlnaHQ9IjMwMCIgdmlld0JveD0iMCAwIDIwMCAzMDAiIGZpbGw9Im5vbmUiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+CjxyZWN0IHdpZHRoPSIyMDAiIGhlaWdodD0iMzAwIiBmaWxsPSIjRjNGNEY2Ii8+CjxyZWN0IHg9IjIwIiB5PSIyMCIgd2lkdGg9IjE2MCIgaGVpZ2h0PSIyNjAiIGZpbGw9IiNFNUU3RUIiLz4KPHJlY3QgeD0iNDAiIHk9IjQwIiB3aWR0aD0iMTIwIiBoZWlnaHQ9IjgiIGZpbGw9IiM5Q0EzQUYiLz4KPHJlY3QgeD0iNDAiIHk9IjYwIiB3aWR0aD0iODAiIGhlaWdodD0iNiIgZmlsbD0iIzlDQTNBRiIvPgo8cmVjdCB4PSI0MCIgeT0iMTAwIiB3aWR0aD0iMTIwIiBoZWlnaHQ9IjQiIGZpbGw9IiNEMUQ1REIiLz4KPHJlY3QgeD0iNDAiIHk9IjExMCIgd2lkdGg9IjEyMCIgaGVpZ2h0PSI0IiBmaWxsPSIjRDFENURCIi8+CjxyZWN0IHg9IjQwIiB5PSIxMjAiIHdpZHRoPSIxMjAiIGhlaWdodD0iNCIgZmlsbD0iI0QxRDVEQiIvPgo8cmVjdCB4PSI0MCIgeT0iMTMwIiB3aWR0aD0iMTIwIiBoZWlnaHQ9IjQiIGZpbGw9IiNEMUQ1REIiLz4KPHJlY3QgeD0iNDAiIHk9IjE0MCIgd2lkdGg9IjEyMCIgaGVpZ2h0PSI0IiBmaWxsPSIjRDFENURCIi8+CjxyZWN0IHg9IjQwIiB5PSIxNTAiIHdpZHRoPSI5MCIgaGVpZ2h0PSI0IiBmaWxsPSIjRDFENURCIi8+Cjx0ZXh0IHg9IjEwMCIgeT0iMjIwIiB0ZXh0LWFuY2hvcj0ibWlkZGxlIiBmaWxsPSIjNkI3MjgwIiBmb250LWZhbWlseT0iQXJpYWwiIGZvbnQtc2l6ZT0iMTQiPkJvb2sgSW1hZ2U8L3RleHQ+Cjwvc3ZnPgo=", filename: "placeholder-book.jpg" }],
    isbn: "9780451524935",
    publisher: "Signet Classics",
    pages: 328,
    language: "English",
    bestseller: true,
    rating: { average: 4.4, count: 1800 }
  },
  {
    title: "The Catcher in the Rye",
    author: "J.D. Salinger",
    description: "A controversial novel about teenage rebellion and alienation in post-war America.",
    price: 849,
    category: "Fiction",
    stock: 20,
    images: [{ url: "data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMjAwIiBoZWlnaHQ9IjMwMCIgdmlld0JveD0iMCAwIDIwMCAzMDAiIGZpbGw9Im5vbmUiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+CjxyZWN0IHdpZHRoPSIyMDAiIGhlaWdodD0iMzAwIiBmaWxsPSIjRjNGNEY2Ii8+CjxyZWN0IHg9IjIwIiB5PSIyMCIgd2lkdGg9IjE2MCIgaGVpZ2h0PSIyNjAiIGZpbGw9IiNFNUU3RUIiLz4KPHJlY3QgeD0iNDAiIHk9IjQwIiB3aWR0aD0iMTIwIiBoZWlnaHQ9IjgiIGZpbGw9IiM5Q0EzQUYiLz4KPHJlY3QgeD0iNDAiIHk9IjYwIiB3aWR0aD0iODAiIGhlaWdodD0iNiIgZmlsbD0iIzlDQTNBRiIvPgo8cmVjdCB4PSI0MCIgeT0iMTAwIiB3aWR0aD0iMTIwIiBoZWlnaHQ9IjQiIGZpbGw9IiNEMUQ1REIiLz4KPHJlY3QgeD0iNDAiIHk9IjExMCIgd2lkdGg9IjEyMCIgaGVpZ2h0PSI0IiBmaWxsPSIjRDFENURCIi8+CjxyZWN0IHg9IjQwIiB5PSIxMjAiIHdpZHRoPSIxMjAiIGhlaWdodD0iNCIgZmlsbD0iI0QxRDVEQiIvPgo8cmVjdCB4PSI0MCIgeT0iMTMwIiB3aWR0aD0iMTIwIiBoZWlnaHQ9IjQiIGZpbGw9IiNEMUQ1REIiLz4KPHJlY3QgeD0iNDAiIHk9IjE0MCIgd2lkdGg9IjEyMCIgaGVpZ2h0PSI0IiBmaWxsPSIjRDFENURCIi8+CjxyZWN0IHg9IjQwIiB5PSIxNTAiIHdpZHRoPSI5MCIgaGVpZ2h0PSI0IiBmaWxsPSIjRDFENURCIi8+Cjx0ZXh0IHg9IjEwMCIgeT0iMjIwIiB0ZXh0LWFuY2hvcj0ibWlkZGxlIiBmaWxsPSIjNkI3MjgwIiBmb250LWZhbWlseT0iQXJpYWwiIGZvbnQtc2l6ZT0iMTQiPkJvb2sgSW1hZ2U8L3RleHQ+Cjwvc3ZnPgo=", filename: "placeholder-book.jpg" }],
    isbn: "9780316769174",
    publisher: "Little, Brown and Company",
    pages: 277,
    language: "English",
    newArrival: true,
    rating: { average: 3.8, count: 950 }
  },
  {
    title: "Clean Code",
    author: "Robert C. Martin",
    description: "A handbook of agile software craftsmanship with practical advice for writing clean, maintainable code.",
    price: 2999,
    originalPrice: 3799,
    category: "Technology",
    stock: 15,
    images: [{ url: "data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMjAwIiBoZWlnaHQ9IjMwMCIgdmlld0JveD0iMCAwIDIwMCAzMDAiIGZpbGw9Im5vbmUiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+CjxyZWN0IHdpZHRoPSIyMDAiIGhlaWdodD0iMzAwIiBmaWxsPSIjRjNGNEY2Ii8+CjxyZWN0IHg9IjIwIiB5PSIyMCIgd2lkdGg9IjE2MCIgaGVpZ2h0PSIyNjAiIGZpbGw9IiNFNUU3RUIiLz4KPHJlY3QgeD0iNDAiIHk9IjQwIiB3aWR0aD0iMTIwIiBoZWlnaHQ9IjgiIGZpbGw9IiM5Q0EzQUYiLz4KPHJlY3QgeD0iNDAiIHk9IjYwIiB3aWR0aD0iODAiIGhlaWdodD0iNiIgZmlsbD0iIzlDQTNBRiIvPgo8cmVjdCB4PSI0MCIgeT0iMTAwIiB3aWR0aD0iMTIwIiBoZWlnaHQ9IjQiIGZpbGw9IiNEMUQ1REIiLz4KPHJlY3QgeD0iNDAiIHk9IjExMCIgd2lkdGg9IjEyMCIgaGVpZ2h0PSI0IiBmaWxsPSIjRDFENURCIi8+CjxyZWN0IHg9IjQwIiB5PSIxMjAiIHdpZHRoPSIxMjAiIGhlaWdodD0iNCIgZmlsbD0iI0QxRDVEQiIvPgo8cmVjdCB4PSI0MCIgeT0iMTMwIiB3aWR0aD0iMTIwIiBoZWlnaHQ9IjQiIGZpbGw9IiNEMUQ1REIiLz4KPHJlY3QgeD0iNDAiIHk9IjE0MCIgd2lkdGg9IjEyMCIgaGVpZ2h0PSI0IiBmaWxsPSIjRDFENURCIi8+CjxyZWN0IHg9IjQwIiB5PSIxNTAiIHdpZHRoPSI5MCIgaGVpZ2h0PSI0IiBmaWxsPSIjRDFENURCIi8+Cjx0ZXh0IHg9IjEwMCIgeT0iMjIwIiB0ZXh0LWFuY2hvcj0ibWlkZGxlIiBmaWxsPSIjNkI3MjgwIiBmb250LWZhbWlseT0iQXJpYWwiIGZvbnQtc2l6ZT0iMTQiPkJvb2sgSW1hZ2U8L3RleHQ+Cjwvc3ZnPgo=", filename: "placeholder-book.jpg" }],
    isbn: "9780132350884",
    publisher: "Prentice Hall",
    pages: 464,
    language: "English",
    featured: true,
    rating: { average: 4.6, count: 750 }
  },
  {
    title: "Sapiens",
    author: "Yuval Noah Harari",
    description: "A brief history of humankind, exploring how Homo sapiens came to dominate the world.",
    price: 1299,
    originalPrice: 1599,
    category: "History",
    stock: 35,
    images: [{ url: "data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMjAwIiBoZWlnaHQ9IjMwMCIgdmlld0JveD0iMCAwIDIwMCAzMDAiIGZpbGw9Im5vbmUiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+CjxyZWN0IHdpZHRoPSIyMDAiIGhlaWdodD0iMzAwIiBmaWxsPSIjRjNGNEY2Ii8+CjxyZWN0IHg9IjIwIiB5PSIyMCIgd2lkdGg9IjE2MCIgaGVpZ2h0PSIyNjAiIGZpbGw9IiNFNUU3RUIiLz4KPHJlY3QgeD0iNDAiIHk9IjQwIiB3aWR0aD0iMTIwIiBoZWlnaHQ9IjgiIGZpbGw9IiM5Q0EzQUYiLz4KPHJlY3QgeD0iNDAiIHk9IjYwIiB3aWR0aD0iODAiIGhlaWdodD0iNiIgZmlsbD0iIzlDQTNBRiIvPgo8cmVjdCB4PSI0MCIgeT0iMTAwIiB3aWR0aD0iMTIwIiBoZWlnaHQ9IjQiIGZpbGw9IiNEMUQ1REIiLz4KPHJlY3QgeD0iNDAiIHk9IjExMCIgd2lkdGg9IjEyMCIgaGVpZ2h0PSI0IiBmaWxsPSIjRDFENURCIi8+CjxyZWN0IHg9IjQwIiB5PSIxMjAiIHdpZHRoPSIxMjAiIGhlaWdodD0iNCIgZmlsbD0iI0QxRDVEQiIvPgo8cmVjdCB4PSI0MCIgeT0iMTMwIiB3aWR0aD0iMTIwIiBoZWlnaHQ9IjQiIGZpbGw9IiNEMUQ1REIiLz4KPHJlY3QgeD0iNDAiIHk9IjE0MCIgd2lkdGg9IjEyMCIgaGVpZ2h0PSI0IiBmaWxsPSIjRDFENURCIi8+CjxyZWN0IHg9IjQwIiB5PSIxNTAiIHdpZHRoPSI5MCIgaGVpZ2h0PSI0IiBmaWxsPSIjRDFENURCIi8+Cjx0ZXh0IHg9IjEwMCIgeT0iMjIwIiB0ZXh0LWFuY2hvcj0ibWlkZGxlIiBmaWxsPSIjNkI3MjgwIiBmb250LWZhbWlseT0iQXJpYWwiIGZvbnQtc2l6ZT0iMTQiPkJvb2sgSW1hZ2U8L3RleHQ+Cjwvc3ZnPgo=", filename: "placeholder-book.jpg" }],
    isbn: "9780062316097",
    publisher: "Harper",
    pages: 443,
    language: "English",
    bestseller: true,
    newArrival: true,
    rating: { average: 4.3, count: 1600 }
  }
];

const sampleAdmin = {
  name: "Admin User",
  email: "admin@boibabu.com",
  password: "admin123",
  role: "admin"
};

const sampleCoupons = [
  {
    code: "WELCOME10",
    description: "Welcome discount - 10% off your first order",
    type: "percentage",
    value: 10,
    minOrderAmount: 500,
    maxDiscount: 200,
    usageLimit: 100,
    isActive: true,
    validFrom: new Date(),
    validUntil: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000) // 30 days from now
  },
  {
    code: "SAVE20",
    description: "Save 20% on orders above ₹1000",
    type: "percentage", 
    value: 20,
    minOrderAmount: 1000,
    maxDiscount: 500,
    usageLimit: 50,
    isActive: true,
    validFrom: new Date(),
    validUntil: new Date(Date.now() + 60 * 24 * 60 * 60 * 1000) // 60 days from now
  },
  {
    code: "FLAT100",
    description: "Flat ₹100 off on orders above ₹800",
    type: "fixed",
    value: 100,
    minOrderAmount: 800,
    usageLimit: 200,
    isActive: true,
    validFrom: new Date(),
    validUntil: new Date(Date.now() + 45 * 24 * 60 * 60 * 1000) // 45 days from now
  }
];

async function seedDatabase() {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('Connected to MongoDB');

    // Clear existing data
    await Book.deleteMany({});
    await Category.deleteMany({});
    await Coupon.deleteMany({});
    console.log('Cleared existing books, categories, and coupons');

    // Insert sample categories first
    await Category.insertMany(sampleCategories);
    console.log('Sample categories inserted successfully');

    // Insert sample books
    await Book.insertMany(sampleBooks);
    console.log('Sample books inserted successfully');

    // Check if admin user exists and get admin ID for coupons
    let adminUser = await User.findOne({ email: sampleAdmin.email });
    if (!adminUser) {
      adminUser = new User(sampleAdmin);
      await adminUser.save();
      console.log('Admin user created successfully');
      console.log('Admin credentials: admin@boibabu.com / admin123');
    } else {
      console.log('Admin user already exists');
    }

    // Insert sample coupons with admin as creator
    const couponsWithCreator = sampleCoupons.map(coupon => ({
      ...coupon,
      createdBy: adminUser._id
    }));
    await Coupon.insertMany(couponsWithCreator);
    console.log('Sample coupons inserted successfully');

    console.log('Database seeded successfully!');
    process.exit(0);
  } catch (error) {
    console.error('Error seeding database:', error);
    process.exit(1);
  }
}

seedDatabase();