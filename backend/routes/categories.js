const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const Category = require('../models/Category');
const { adminAuth } = require('../middleware/auth');

const router = express.Router();

// Configure multer for category images
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    const uploadPath = path.join(__dirname, '../uploads/categories');
    if (!fs.existsSync(uploadPath)) {
      fs.mkdirSync(uploadPath, { recursive: true });
    }
    cb(null, uploadPath);
  },
  filename: function (req, file, cb) {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, 'category-' + uniqueSuffix + path.extname(file.originalname));
  }
});

const upload = multer({ 
  storage,
  limits: { fileSize: 2 * 1024 * 1024 }, // 2MB limit
  fileFilter: (req, file, cb) => {
    if (file.mimetype.startsWith('image/')) {
      cb(null, true);
    } else {
      cb(new Error('Only image files are allowed'), false);
    }
  }
});

// Get all categories (public)
router.get('/', async (req, res) => {
  try {
    console.log('Categories endpoint hit - fetching categories...');
    const categories = await Category.find({ isActive: true })
      .sort({ sortOrder: 1, name: 1 });
    console.log(`Found ${categories.length} categories:`, categories.map(c => c.name));
    res.json(categories);
  } catch (error) {
    console.error('Error in categories endpoint:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Get all categories for admin
router.get('/admin', adminAuth, async (req, res) => {
  try {
    const { page = 1, limit = 10, search } = req.query;
    const filter = {};
    
    if (search) {
      filter.name = { $regex: search, $options: 'i' };
    }

    const skip = (page - 1) * limit;
    const categories = await Category.find(filter)
      .sort({ sortOrder: 1, name: 1 })
      .skip(skip)
      .limit(Number(limit));

    const total = await Category.countDocuments(filter);

    res.json({
      categories,
      pagination: {
        current: Number(page),
        pages: Math.ceil(total / limit),
        total
      }
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Get single category
router.get('/:id', async (req, res) => {
  try {
    const category = await Category.findById(req.params.id);
    if (!category) {
      return res.status(404).json({ message: 'Category not found' });
    }
    res.json(category);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Create category
router.post('/', adminAuth, upload.single('image'), async (req, res) => {
  try {
    const categoryData = req.body;
    
    console.log('Creating category with data:', categoryData);
    
    // Validate required fields
    if (!categoryData.name || categoryData.name.trim() === '') {
      return res.status(400).json({ message: 'Category name is required' });
    }
    
    // Manually generate slug as backup
    if (!categoryData.slug) {
      categoryData.slug = categoryData.name.toLowerCase()
        .trim()
        .replace(/[^a-z0-9\s-]/g, '') // Remove special characters
        .replace(/\s+/g, '-') // Replace spaces with hyphens
        .replace(/-+/g, '-') // Replace multiple hyphens with single
        .replace(/(^-|-$)/g, ''); // Remove leading/trailing hyphens
      
      // Ensure slug is not empty
      if (!categoryData.slug) {
        categoryData.slug = `category-${Date.now()}`;
      }
    }
    
    console.log('Category data with slug:', categoryData);
    
    // Add image if uploaded
    if (req.file) {
      categoryData.image = {
        url: `/uploads/categories/${req.file.filename}`,
        filename: req.file.filename
      };
    }

    const category = new Category(categoryData);
    
    console.log('Category before save:', category.toObject());
    
    await category.save();

    console.log('Category saved successfully:', category._id);

    res.status(201).json({
      message: 'Category created successfully',
      category
    });
  } catch (error) {
    console.error('Category creation error:', error);
    if (error.code === 11000) {
      const field = Object.keys(error.keyPattern)[0];
      res.status(400).json({ message: `Category ${field} already exists` });
    } else if (error.name === 'ValidationError') {
      const messages = Object.values(error.errors).map(err => err.message);
      res.status(400).json({ message: messages.join(', ') });
    } else {
      res.status(500).json({ message: 'Server error while creating category' });
    }
  }
});

// Update category
router.put('/:id', adminAuth, upload.single('image'), async (req, res) => {
  try {
    const category = await Category.findById(req.params.id);
    if (!category) {
      return res.status(404).json({ message: 'Category not found' });
    }

    const updateData = req.body;

    // Handle image update
    if (req.file) {
      // Delete old image
      if (category.image && category.image.filename) {
        const oldImagePath = path.join(__dirname, '../uploads/categories', category.image.filename);
        if (fs.existsSync(oldImagePath)) {
          fs.unlinkSync(oldImagePath);
        }
      }

      updateData.image = {
        url: `/uploads/categories/${req.file.filename}`,
        filename: req.file.filename
      };
    }

    Object.assign(category, updateData);
    await category.save();

    res.json({
      message: 'Category updated successfully',
      category
    });
  } catch (error) {
    console.error(error);
    if (error.code === 11000) {
      res.status(400).json({ message: 'Category name already exists' });
    } else {
      res.status(500).json({ message: 'Server error' });
    }
  }
});

// Delete category
router.delete('/:id', adminAuth, async (req, res) => {
  try {
    const category = await Category.findById(req.params.id);
    if (!category) {
      return res.status(404).json({ message: 'Category not found' });
    }

    // Delete image file
    if (category.image && category.image.filename) {
      const imagePath = path.join(__dirname, '../uploads/categories', category.image.filename);
      if (fs.existsSync(imagePath)) {
        fs.unlinkSync(imagePath);
      }
    }

    await Category.findByIdAndDelete(req.params.id);
    res.json({ message: 'Category deleted successfully' });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
});

module.exports = router;