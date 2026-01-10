const express = require('express');
const Coupon = require('../models/Coupon');
const { auth, adminAuth } = require('../middleware/auth');

const router = express.Router();

// Get all coupons (admin only)
router.get('/admin', adminAuth, async (req, res) => {
  try {
    const { page = 1, limit = 10, search } = req.query;
    
    const filter = {};
    if (search) {
      filter.$or = [
        { code: { $regex: search, $options: 'i' } },
        { description: { $regex: search, $options: 'i' } }
      ];
    }

    const skip = (page - 1) * limit;
    const coupons = await Coupon.find(filter)
      .populate('createdBy', 'name email')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(Number(limit));

    const total = await Coupon.countDocuments(filter);

    res.json({
      coupons,
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

// Validate coupon (public)
router.post('/validate', async (req, res) => {
  try {
    const { code, orderAmount } = req.body;

    if (!code || !orderAmount) {
      return res.status(400).json({ message: 'Code and order amount are required' });
    }

    const coupon = await Coupon.findOne({ 
      code: code.toUpperCase(),
      isActive: true 
    });

    if (!coupon) {
      return res.status(404).json({ message: 'Invalid coupon code' });
    }

    if (!coupon.isValid()) {
      return res.status(400).json({ message: 'Coupon is expired or usage limit exceeded' });
    }

    if (orderAmount < coupon.minOrderAmount) {
      return res.status(400).json({ 
        message: `Minimum order amount of ₹${coupon.minOrderAmount} required` 
      });
    }

    const discount = coupon.calculateDiscount(orderAmount);

    res.json({
      valid: true,
      coupon: {
        code: coupon.code,
        description: coupon.description,
        type: coupon.type,
        value: coupon.value,
        discount
      }
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Create coupon (admin only)
router.post('/', adminAuth, async (req, res) => {
  try {
    const couponData = {
      ...req.body,
      createdBy: req.user._id,
      code: req.body.code.toUpperCase()
    };

    const coupon = new Coupon(couponData);
    await coupon.save();

    res.status(201).json({
      message: 'Coupon created successfully',
      coupon
    });
  } catch (error) {
    console.error(error);
    if (error.code === 11000) {
      res.status(400).json({ message: 'Coupon code already exists' });
    } else if (error.name === 'ValidationError') {
      const messages = Object.values(error.errors).map(err => err.message);
      res.status(400).json({ message: messages.join(', ') });
    } else {
      res.status(500).json({ message: 'Server error' });
    }
  }
});

// Update coupon (admin only)
router.put('/:id', adminAuth, async (req, res) => {
  try {
    const coupon = await Coupon.findById(req.params.id);
    if (!coupon) {
      return res.status(404).json({ message: 'Coupon not found' });
    }

    const updateData = {
      ...req.body,
      code: req.body.code ? req.body.code.toUpperCase() : coupon.code
    };

    Object.assign(coupon, updateData);
    await coupon.save();

    res.json({
      message: 'Coupon updated successfully',
      coupon
    });
  } catch (error) {
    console.error(error);
    if (error.code === 11000) {
      res.status(400).json({ message: 'Coupon code already exists' });
    } else {
      res.status(500).json({ message: 'Server error' });
    }
  }
});

// Delete coupon (admin only)
router.delete('/:id', adminAuth, async (req, res) => {
  try {
    const coupon = await Coupon.findById(req.params.id);
    if (!coupon) {
      return res.status(404).json({ message: 'Coupon not found' });
    }

    await Coupon.findByIdAndDelete(req.params.id);
    res.json({ message: 'Coupon deleted successfully' });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Toggle coupon status (admin only)
router.patch('/:id/toggle', adminAuth, async (req, res) => {
  try {
    const coupon = await Coupon.findById(req.params.id);
    if (!coupon) {
      return res.status(404).json({ message: 'Coupon not found' });
    }

    coupon.isActive = !coupon.isActive;
    await coupon.save();

    res.json({
      message: `Coupon ${coupon.isActive ? 'activated' : 'deactivated'} successfully`,
      coupon
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
});

module.exports = router;