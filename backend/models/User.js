const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const userSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    trim: true
  },
  email: {
    type: String,
    required: true,
    unique: true,
    lowercase: true
  },
  password: {
    type: String,
    required: true,
    minlength: 6
  },
  role: {
    type: String,
    enum: ['user', 'admin', 'seller'],
    default: 'user'
  },
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    default: null // Only set for seller accounts created by admin
  },
  address: {
    street: String,
    landmark: String,
    city: String,
    state: String,
    zipCode: String,
    country: String
  },
  phone: String,
  avatar: String,
  resetPasswordToken: String,
  resetPasswordExpires: Date,
  isEmailVerified: {
    type: Boolean,
    default: false // Require email verification for new users
  },
  // Suspension fields
  isSuspended: {
    type: Boolean,
    default: false
  },
  suspendedAt: {
    type: Date
  },
  suspendedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  suspensionReason: {
    type: String,
    trim: true
  },
  suspensionNotes: {
    type: String,
    trim: true
  }
}, {
  timestamps: true
});

// Hash password before saving
userSchema.pre('save', async function(next) {
  if (!this.isModified('password')) return next();
  this.password = await bcrypt.hash(this.password, 12);
  next();
});

// Compare password method
userSchema.methods.comparePassword = async function(candidatePassword) {
  return await bcrypt.compare(candidatePassword, this.password);
};

// Suspension methods
userSchema.methods.suspend = function(adminId, reason, notes) {
  this.isSuspended = true;
  this.suspendedAt = new Date();
  this.suspendedBy = adminId;
  this.suspensionReason = reason;
  this.suspensionNotes = notes;
  return this.save();
};

userSchema.methods.unsuspend = function() {
  this.isSuspended = false;
  this.suspendedAt = undefined;
  this.suspendedBy = undefined;
  this.suspensionReason = undefined;
  this.suspensionNotes = undefined;
  return this.save();
};

module.exports = mongoose.model('User', userSchema);