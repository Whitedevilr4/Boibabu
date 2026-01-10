const mongoose = require('mongoose');

const otpSchema = new mongoose.Schema({
  email: {
    type: String,
    required: true,
    lowercase: true,
    trim: true
  },
  otp: {
    type: String,
    required: true
  },
  type: {
    type: String,
    enum: ['email_verification', 'password_reset'],
    required: true
  },
  attempts: {
    type: Number,
    default: 0,
    max: 3
  },
  expiresAt: {
    type: Date,
    required: true,
    default: () => new Date(Date.now() + 5 * 60 * 1000) // 5 minutes from now
  },
  createdAt: {
    type: Date,
    default: Date.now
  }
}, {
  timestamps: true
});

// Index for automatic deletion of expired documents
otpSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

// Index for efficient queries
otpSchema.index({ email: 1, type: 1 });

// Static method to generate OTP
otpSchema.statics.generateOTP = function() {
  return Math.floor(100000 + Math.random() * 900000).toString(); // 6-digit OTP
};

// Static method to create or update OTP
otpSchema.statics.createOTP = async function(email, type) {
  const otp = this.generateOTP();
  
  // Check OTP generation attempts in the last 24 hours
  const recentOTPs = await this.countDocuments({
    email,
    type,
    createdAt: { $gte: new Date(Date.now() - 24 * 60 * 60 * 1000) }
  });

  // Limit OTP generation to 5 times per day per email/type
  if (recentOTPs >= 5) {
    throw new Error('Maximum OTP generation attempts reached for today. Please try again tomorrow.');
  }

  // Delete any existing OTP for this email and type (to prevent multiple active OTPs)
  await this.deleteMany({ email, type });

  // Create new OTP
  const newOTP = new this({
    email,
    otp,
    type,
    attempts: 0 // Always start with 0 attempts for verification
  });

  await newOTP.save();
  return newOTP;
};

// Static method to verify OTP
otpSchema.statics.verifyOTP = async function(email, otp, type) {
  const otpDoc = await this.findOne({ email, type });

  if (!otpDoc) {
    throw new Error('OTP not found or expired');
  }

  // Check if OTP has expired
  if (otpDoc.expiresAt < new Date()) {
    await this.deleteOne({ _id: otpDoc._id });
    throw new Error('OTP has expired');
  }

  // Increment attempts
  otpDoc.attempts += 1;
  await otpDoc.save();

  // Check if maximum attempts reached
  if (otpDoc.attempts > 3) {
    await this.deleteOne({ _id: otpDoc._id });
    throw new Error('Maximum OTP attempts reached');
  }

  // Verify OTP
  if (otpDoc.otp !== otp) {
    throw new Error('Invalid OTP');
  }

  // OTP is valid, delete it
  await this.deleteOne({ _id: otpDoc._id });
  return true;
};

module.exports = mongoose.model('OTP', otpSchema);