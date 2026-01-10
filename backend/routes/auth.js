const express = require('express');
const jwt = require('jsonwebtoken');
const { body, validationResult } = require('express-validator');
const User = require('../models/User');
const OTP = require('../models/OTP');
const { auth } = require('../middleware/auth');
const { sendWelcomeEmail, sendOTPEmail } = require('../utils/emailService');
const { authLimiter, emailVerificationLimiter, passwordResetLimiter, otpLimiter } = require('../middleware/rateLimiter');

const router = express.Router();

// Generate JWT token
const generateToken = (userId) => {
  return jwt.sign({ userId }, process.env.JWT_SECRET, { expiresIn: '7d' });
};

// Register user
router.post('/register', authLimiter, [
  body('name').trim().isLength({ min: 2 }).withMessage('Name must be at least 2 characters'),
  body('email').isEmail().withMessage('Please enter a valid email'),
  body('password').isLength({ min: 6 }).withMessage('Password must be at least 6 characters')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { name, email, password } = req.body;

    // Check if user already exists
    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res.status(400).json({ message: 'User already exists with this email' });
    }

    // Create new user (not verified initially)
    const userRole = email === 'admin@gmail.com' ? 'admin' : 'user';

    const user = new User({ 
      name, 
      email, 
      password,
      role: userRole,
      isEmailVerified: false // Require email verification for new users
    });
    await user.save();

    // Generate and send OTP for email verification
    try {
      const otpDoc = await OTP.createOTP(email, 'email_verification');
      await sendOTPEmail(email, otpDoc.otp, name, 'email_verification');
      
      res.status(201).json({
        message: 'Registration successful! Please check your email for verification OTP.',
        requiresVerification: true,
        email: email
      });
    } catch (otpError) {
      // If OTP creation fails, delete the user and return error
      await User.findByIdAndDelete(user._id);
      
      if (otpError.message.includes('Maximum OTP attempts')) {
        return res.status(429).json({ message: otpError.message });
      }
      
      console.error('OTP generation error:', otpError);
      return res.status(500).json({ message: 'Failed to send verification email. Please try again.' });
    }
  } catch (error) {
    console.error('Registration error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Verify OTP for email verification
router.post('/verify-otp', [
  body('email').isEmail().withMessage('Please enter a valid email'),
  body('otp').isLength({ min: 6, max: 6 }).withMessage('OTP must be 6 digits')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { email, otp } = req.body;

    // Find user
    const user = await User.findOne({ email });
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    // Check if user is already verified
    if (user.isEmailVerified) {
      return res.status(400).json({ message: 'Email is already verified' });
    }

    // Verify OTP
    try {
      await OTP.verifyOTP(email, otp, 'email_verification');
      
      // Mark user as verified
      user.isEmailVerified = true;
      await user.save();

      // Send welcome email (optional)
      try {
        await sendWelcomeEmail(email, user.name);
      } catch (emailError) {
        console.log('Welcome email failed (non-critical):', emailError.message);
      }

      // Generate token for automatic login
      const token = generateToken(user._id);

      res.json({
        message: 'Email verified successfully!',
        token,
        user: {
          id: user._id,
          name: user.name,
          email: user.email,
          role: user.role,
          isEmailVerified: user.isEmailVerified
        }
      });
    } catch (otpError) {
      return res.status(400).json({ message: otpError.message });
    }
  } catch (error) {
    console.error('OTP verification error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Resend OTP for email verification
router.post('/resend-otp', otpLimiter, [
  body('email').isEmail().withMessage('Please enter a valid email')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { email } = req.body;

    // Find user
    const user = await User.findOne({ email });
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    // Check if user is already verified
    if (user.isEmailVerified) {
      return res.status(400).json({ message: 'Email is already verified' });
    }

    // Generate and send new OTP
    try {
      const otpDoc = await OTP.createOTP(email, 'email_verification');
      await sendOTPEmail(email, otpDoc.otp, user.name, 'email_verification');
      
      res.json({ message: 'OTP sent successfully!' });
    } catch (otpError) {
      if (otpError.message.includes('Maximum OTP attempts')) {
        return res.status(429).json({ message: otpError.message });
      }
      
      console.error('OTP generation error:', otpError);
      return res.status(500).json({ message: 'Failed to send OTP. Please try again.' });
    }
  } catch (error) {
    console.error('Resend OTP error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Login user
router.post('/login', [
  body('email').isEmail().withMessage('Please enter a valid email'),
  body('password').exists().withMessage('Password is required')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { email, password } = req.body;

    // Find user
    const user = await User.findOne({ email });
    if (!user) {
      return res.status(400).json({ message: 'Invalid credentials' });
    }

    // Check password
    const isMatch = await user.comparePassword(password);
    if (!isMatch) {
      return res.status(400).json({ message: 'Invalid credentials' });
    }

    // Check if user is suspended
    if (user.isSuspended) {
      return res.status(403).json({ 
        message: 'Account suspended', 
        suspended: true,
        suspensionReason: user.suspensionReason,
        suspendedAt: user.suspendedAt
      });
    }

    // Check if email is verified (skip for existing users who were created before verification system)
    if (!user.isEmailVerified && user.createdAt > new Date('2026-01-01')) {
      return res.status(400).json({ 
        message: 'Please verify your email before logging in',
        requiresVerification: true,
        email: user.email
      });
    }

    // Generate token
    const token = generateToken(user._id);

    res.json({
      message: 'Login successful',
      token,
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
        isEmailVerified: user.isEmailVerified
      }
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Get current user
router.get('/me', auth, async (req, res) => {
  try {
    res.json({
      user: {
        id: req.user._id,
        name: req.user.name,
        email: req.user.email,
        role: req.user.role,
        address: req.user.address,
        phone: req.user.phone,
        isEmailVerified: req.user.isEmailVerified
      }
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Update user profile
router.put('/profile', auth, async (req, res) => {
  try {
    const { name, phone, address } = req.body;
    
    const user = await User.findByIdAndUpdate(
      req.user._id,
      { name, phone, address },
      { new: true, runValidators: true }
    ).select('-password');

    res.json({
      message: 'Profile updated successfully',
      user
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Change password
router.put('/change-password', auth, [
  body('currentPassword').exists().withMessage('Current password is required'),
  body('newPassword').isLength({ min: 6 }).withMessage('New password must be at least 6 characters')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { currentPassword, newPassword } = req.body;

    // Get user with password
    const user = await User.findById(req.user._id);
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    // Check current password
    const isMatch = await user.comparePassword(currentPassword);
    if (!isMatch) {
      return res.status(400).json({ message: 'Current password is incorrect' });
    }

    // Update password (will be hashed by pre-save middleware)
    user.password = newPassword;
    await user.save();

    res.json({ message: 'Password changed successfully' });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Forgot password - send OTP
router.post('/forgot-password', otpLimiter, [
  body('email').isEmail().withMessage('Please enter a valid email')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { email } = req.body;

    // Find user
    const user = await User.findOne({ email });
    if (!user) {
      // Don't reveal if email exists or not for security
      return res.json({ message: 'If an account with that email exists, a password reset OTP has been sent.' });
    }

    // Generate and send OTP for password reset
    try {
      const otpDoc = await OTP.createOTP(email, 'password_reset');
      await sendOTPEmail(email, otpDoc.otp, user.name, 'password_reset');
      
      res.json({ 
        message: 'If an account with that email exists, a password reset OTP has been sent.',
        // Remove this in production - only for testing
        otp: process.env.NODE_ENV === 'development' ? otpDoc.otp : undefined
      });
    } catch (otpError) {
      if (otpError.message.includes('Maximum OTP attempts')) {
        return res.status(429).json({ message: otpError.message });
      }
      
      console.error('OTP generation error:', otpError);
      // Still return success message for security
      return res.json({ message: 'If an account with that email exists, a password reset OTP has been sent.' });
    }
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Reset password with OTP
router.post('/reset-password', [
  body('email').isEmail().withMessage('Please enter a valid email'),
  body('otp').isLength({ min: 6, max: 6 }).withMessage('OTP must be 6 digits'),
  body('newPassword').isLength({ min: 6 }).withMessage('New password must be at least 6 characters')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { email, otp, newPassword } = req.body;

    // Find user
    const user = await User.findOne({ email });
    if (!user) {
      return res.status(400).json({ message: 'Invalid email or OTP' });
    }

    // Verify OTP
    try {
      await OTP.verifyOTP(email, otp, 'password_reset');
      
      // Update password (will be hashed by pre-save middleware)
      user.password = newPassword;
      await user.save();

      res.json({ message: 'Password reset successfully' });
    } catch (otpError) {
      return res.status(400).json({ message: otpError.message });
    }
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
});

module.exports = router;