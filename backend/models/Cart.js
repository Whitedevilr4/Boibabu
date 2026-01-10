const mongoose = require('mongoose');

const cartItemSchema = new mongoose.Schema({
  book: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Book',
    required: true
  },
  quantity: {
    type: Number,
    required: true,
    min: 1,
    default: 1
  },
  price: {
    type: Number,
    required: true,
    min: 0
  }
}, {
  timestamps: true
});

const cartSchema = new mongoose.Schema({
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    unique: true
  },
  items: [cartItemSchema],
  total: {
    type: Number,
    default: 0,
    min: 0
  },
  itemCount: {
    type: Number,
    default: 0,
    min: 0
  }
}, {
  timestamps: true
});

// Calculate totals before saving
cartSchema.pre('save', function(next) {
  this.total = this.items.reduce((sum, item) => sum + (item.price * item.quantity), 0);
  this.itemCount = this.items.reduce((sum, item) => sum + item.quantity, 0);
  next();
});

// Method to add item to cart
cartSchema.methods.addItem = function(book, quantity = 1) {
  const existingItemIndex = this.items.findIndex(item => item.book.toString() === book._id.toString());
  
  if (existingItemIndex > -1) {
    // Update existing item
    this.items[existingItemIndex].quantity += quantity;
  } else {
    // Add new item
    this.items.push({
      book: book._id,
      quantity,
      price: book.price
    });
  }
  
  return this.save();
};

// Method to update item quantity
cartSchema.methods.updateItemQuantity = function(bookId, quantity) {
  const itemIndex = this.items.findIndex(item => item.book.toString() === bookId.toString());
  
  if (itemIndex > -1) {
    if (quantity <= 0) {
      this.items.splice(itemIndex, 1);
    } else {
      this.items[itemIndex].quantity = quantity;
    }
  }
  
  return this.save();
};

// Method to remove item from cart
cartSchema.methods.removeItem = function(bookId) {
  this.items = this.items.filter(item => item.book.toString() !== bookId.toString());
  return this.save();
};

// Method to clear cart
cartSchema.methods.clearCart = function() {
  this.items = [];
  return this.save();
};

module.exports = mongoose.model('Cart', cartSchema);