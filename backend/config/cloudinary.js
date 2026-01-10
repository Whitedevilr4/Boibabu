const cloudinary = require('cloudinary').v2;
const { CloudinaryStorage } = require('multer-storage-cloudinary');
const multer = require('multer');

// Configure Cloudinary
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

// Create storage configurations for different image types
const createCloudinaryStorage = (folder, allowedFormats = ['jpg', 'jpeg', 'png', 'webp']) => {
  return new CloudinaryStorage({
    cloudinary: cloudinary,
    params: {
      folder: `boibabu/${folder}`,
      allowed_formats: allowedFormats,
      transformation: [
        { quality: 'auto:good' },
        { fetch_format: 'auto' }
      ],
      public_id: (req, file) => {
        // Generate unique filename with timestamp
        const timestamp = Date.now();
        const originalName = file.originalname.split('.')[0];
        return `${originalName}_${timestamp}`;
      }
    },
  });
};

// Storage configurations for different image types
const bookStorage = createCloudinaryStorage('books');
const userStorage = createCloudinaryStorage('users');
const heroSlideStorage = createCloudinaryStorage('hero-slides');
const publisherAdStorage = createCloudinaryStorage('publisher-ads');

// Multer configurations
const uploadBook = multer({ 
  storage: bookStorage,
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB limit
  },
  fileFilter: (req, file, cb) => {
    if (file.mimetype.startsWith('image/')) {
      cb(null, true);
    } else {
      cb(new Error('Only image files are allowed!'), false);
    }
  }
});

const uploadUser = multer({ 
  storage: userStorage,
  limits: {
    fileSize: 5 * 1024 * 1024, // 5MB limit
  },
  fileFilter: (req, file, cb) => {
    if (file.mimetype.startsWith('image/')) {
      cb(null, true);
    } else {
      cb(new Error('Only image files are allowed!'), false);
    }
  }
});

const uploadHeroSlide = multer({ 
  storage: heroSlideStorage,
  limits: {
    fileSize: 15 * 1024 * 1024, // 15MB limit for hero images
  },
  fileFilter: (req, file, cb) => {
    if (file.mimetype.startsWith('image/')) {
      cb(null, true);
    } else {
      cb(new Error('Only image files are allowed!'), false);
    }
  }
});

const uploadPublisherAd = multer({ 
  storage: publisherAdStorage,
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB limit
  },
  fileFilter: (req, file, cb) => {
    if (file.mimetype.startsWith('image/')) {
      cb(null, true);
    } else {
      cb(new Error('Only image files are allowed!'), false);
    }
  }
});

// Helper function to delete image from Cloudinary
const deleteImage = async (publicId) => {
  try {
    const result = await cloudinary.uploader.destroy(publicId);
    return result;
  } catch (error) {
    console.error('Error deleting image from Cloudinary:', error);
    throw error;
  }
};

// Helper function to get optimized image URL
const getOptimizedImageUrl = (publicId, options = {}) => {
  if (!publicId) return null;
  
  const defaultOptions = {
    quality: 'auto:good',
    fetch_format: 'auto',
    ...options
  };
  
  return cloudinary.url(publicId, defaultOptions);
};

// Helper function to extract public ID from Cloudinary URL
const extractPublicId = (cloudinaryUrl) => {
  if (!cloudinaryUrl) return null;
  
  try {
    // Extract public ID from Cloudinary URL
    const matches = cloudinaryUrl.match(/\/v\d+\/(.+)\./);
    return matches ? matches[1] : null;
  } catch (error) {
    console.error('Error extracting public ID:', error);
    return null;
  }
};

module.exports = {
  cloudinary,
  uploadBook,
  uploadUser,
  uploadHeroSlide,
  uploadPublisherAd,
  deleteImage,
  getOptimizedImageUrl,
  extractPublicId
};