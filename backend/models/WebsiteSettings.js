const mongoose = require('mongoose');

const websiteSettingsSchema = new mongoose.Schema({
  websiteName: {
    type: String,
    required: true,
    default: 'BoiBabu'
  },
  websiteDomain: {
    type: String,
    required: true,
    default: 'boibabu.in'
  },
  logo: {
    type: String, // URL to logo image
    default: null
  },
  heroImage: {
    type: String, // URL to hero background image
    default: null
  },
  heroTitle: {
    type: String,
    default: 'Discover Your Next Great Read'
  },
  heroSubtitle: {
    type: String,
    default: "India's largest online bookstore with thousands of books across all genres. From bestsellers to hidden gems, find your perfect book at BoiBabu.in with free shipping and best prices."
  },
  metaDescription: {
    type: String,
    default: "BoiBabu.in - India's largest online bookstore. Buy books online with free shipping, best prices, and fast delivery. Fiction, Non-fiction, Academic books, and more. Shop now!"
  },
  metaKeywords: {
    type: String,
    default: "buy books online, online bookstore India, books online, BoiBabu, fiction books, non-fiction books, academic books, bestsellers, new arrivals, book shopping, free shipping books, discount books, Indian bookstore"
  },
  contactEmail: {
    type: String,
    default: 'support@boibabu.in'
  },
  contactPhone: {
    type: String,
    default: '+91-1234567890'
  },
  socialMedia: {
    facebook: { type: String, default: '' },
    twitter: { type: String, default: '' },
    instagram: { type: String, default: '' },
    linkedin: { type: String, default: '' }
  },
  features: {
    freeShippingThreshold: {
      type: Number,
      default: 2000
    },
    commissionRate: {
      type: Number,
      default: 2.5,
      min: 0,
      max: 100
    }
  },
  updatedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  }
}, {
  timestamps: true
});

// Ensure only one settings document exists
websiteSettingsSchema.statics.getSettings = async function() {
  let settings = await this.findOne();
  if (!settings) {
    // Create default settings if none exist
    settings = new this({
      updatedBy: new mongoose.Types.ObjectId() // Temporary ID, should be updated by admin
    });
    await settings.save();
  }
  return settings;
};

websiteSettingsSchema.statics.updateSettings = async function(updateData, adminId) {
  let settings = await this.findOne();
  if (!settings) {
    settings = new this({ updatedBy: adminId });
  }
  
  Object.assign(settings, updateData);
  settings.updatedBy = adminId;
  await settings.save();
  return settings;
};

module.exports = mongoose.model('WebsiteSettings', websiteSettingsSchema);