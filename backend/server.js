const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const dotenv = require('dotenv');
const path = require('path');
const errorHandler = require('./middleware/errorHandler');
const { generalLimiter } = require('./middleware/rateLimiter');

// Load environment variables
dotenv.config();

const app = express();

// Trust proxy for rate limiting (required for X-Forwarded-For header)
app.set('trust proxy', 1);

// Apply production optimizations if in production
if (process.env.NODE_ENV === 'production') {
  const configureProduction = require('./config/production');
  configureProduction(app);
}

// Security middleware
app.use(generalLimiter);

// CORS configuration
const corsOptions = {
  origin: process.env.NODE_ENV === 'production' 
    ? [process.env.FRONTEND_URL] 
    : ['http://localhost:3000', 'http://127.0.0.1:3000', 'https://boibabu.in'],
  credentials: true,
  optionsSuccessStatus: 200
};

app.use(cors(corsOptions));

// Body parsing middleware
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Security headers
app.use((req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('X-XSS-Protection', '1; mode=block');
  next();
});

// Serve static files (uploaded images)
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.status(200).json({
    status: 'OK',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    environment: process.env.NODE_ENV,
    version: require('./package.json').version || '1.0.0'
  });
});

// Basic home route
app.get('/', (req, res) => {
  res.json({ 
    message: 'BoiBabu API is running!',
    status: 'OK',
    timestamp: new Date().toISOString(),
    version: require('./package.json').version || '1.0.0',
    endpoints: {
      health: '/health',
      api: '/api',
      docs: 'Check API_DOCUMENTATION.md for full API documentation'
    }
  });
});

// Routes
app.use('/api/auth', require('./routes/auth'));
app.use('/api/books', require('./routes/books'));
app.use('/api/orders', require('./routes/orders'));
app.use('/api/admin', require('./routes/admin'));
app.use('/api/seller', require('./routes/seller'));
app.use('/api/payment', require('./routes/payment'));
app.use('/api/categories', require('./routes/categories'));
app.use('/api/notifications', require('./routes/notifications').router);
app.use('/api/coupons', require('./routes/coupons'));
app.use('/api/cart', require('./routes/cart'));
app.use('/api/complaints', require('./routes/complaints'));

// Catch-all route for undefined API endpoints
app.use('/api/*', (req, res) => {
  res.status(404).json({
    error: 'API endpoint not found',
    path: req.originalUrl,
    method: req.method,
    timestamp: new Date().toISOString()
  });
});

// Error handling middleware (must be last)
app.use(errorHandler);

// MongoDB connection with better error handling
const connectDB = async () => {
  try {
    const conn = await mongoose.connect(process.env.MONGODB_URI, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
      serverSelectionTimeoutMS: 5000, // Timeout after 5s instead of 30s
      socketTimeoutMS: 45000, // Close sockets after 45s of inactivity
    });
    console.log(`MongoDB connected successfully: ${conn.connection.host}`);
  } catch (error) {
    console.error('MongoDB connection error:', error.message);
    
    // Try alternative connection string format
    if (error.message.includes('querySrv ECONNREFUSED')) {
      console.log('Trying alternative connection method...');
      try {
        // Alternative connection string without SRV
        const altUri = process.env.MONGODB_URI.replace('mongodb+srv://', 'mongodb://').replace('cluster0.juyci1b.mongodb.net', 'cluster0-shard-00-00.juyci1b.mongodb.net:27017,cluster0-shard-00-01.juyci1b.mongodb.net:27017,cluster0-shard-00-02.juyci1b.mongodb.net:27017');
        const conn = await mongoose.connect(altUri, {
          useNewUrlParser: true,
          useUnifiedTopology: true,
          ssl: true,
          authSource: 'admin',
        });
        console.log(`MongoDB connected with alternative method: ${conn.connection.host}`);
      } catch (altError) {
        console.error('Alternative connection also failed:', altError.message);
        console.log('Please check:');
        console.log('1. Your internet connection');
        console.log('2. MongoDB Atlas cluster is running (not paused)');
        console.log('3. IP address is whitelisted in MongoDB Atlas');
        console.log('4. Username and password are correct');
        process.exit(1);
      }
    } else {
      process.exit(1);
    }
  }
};

// Connect to MongoDB
connectDB();

// Health check endpoint
app.get('/health', async (req, res) => {
  try {
    // Check database connection
    const dbStatus = mongoose.connection.readyState === 1 ? 'connected' : 'disconnected';
    
    // Check memory usage
    const memoryUsage = process.memoryUsage();
    
    res.json({
      status: 'healthy',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      database: dbStatus,
      memory: {
        rss: `${Math.round(memoryUsage.rss / 1024 / 1024)} MB`,
        heapUsed: `${Math.round(memoryUsage.heapUsed / 1024 / 1024)} MB`,
        heapTotal: `${Math.round(memoryUsage.heapTotal / 1024 / 1024)} MB`
      },
      environment: process.env.NODE_ENV || 'development'
    });
  } catch (error) {
    res.status(500).json({
      status: 'unhealthy',
      error: error.message,
      timestamp: new Date().toISOString()
    });
  }
});

// Test route for frontend connectivity
app.get('/api/test', (req, res) => {
  console.log('Test endpoint hit from frontend');
  res.json({ message: 'Frontend can reach backend!', timestamp: new Date().toISOString() });
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
