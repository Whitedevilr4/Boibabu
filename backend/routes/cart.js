const express = require('express');
const Cart = require('../models/Cart');
const Book = require('../models/Book');
const { auth } = require('../middleware/auth');

const router = express.Router();

// Get user's cart
router.get('/', auth, async (req, res) => {
  try {
    let cart = await Cart.findOne({ user: req.user._id }).populate('items.book');
    
    if (!cart) {
      cart = new Cart({ user: req.user._id, items: [] });
      await cart.save();
    }

    res.json(cart);
  } catch (error) {
    console.error('Get cart error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Add item to cart
router.post('/add', auth, async (req, res) => {
  try {
    const { bookId, quantity = 1 } = req.body;

    if (!bookId) {
      return res.status(400).json({ message: 'Book ID is required' });
    }

    const book = await Book.findById(bookId);
    if (!book) {
      return res.status(404).json({ message: 'Book not found' });
    }

    if (book.stock < quantity) {
      return res.status(400).json({ message: 'Not enough stock available' });
    }

    let cart = await Cart.findOne({ user: req.user._id });
    if (!cart) {
      cart = new Cart({ user: req.user._id, items: [] });
    }

    // Check if adding this quantity would exceed stock
    const existingItem = cart.items.find(item => item.book.toString() === bookId);
    const currentQuantity = existingItem ? existingItem.quantity : 0;
    
    if (currentQuantity + quantity > book.stock) {
      return res.status(400).json({ message: 'Cannot add more items than available stock' });
    }

    await cart.addItem(book, quantity);
    await cart.populate('items.book');

    res.json({
      message: 'Item added to cart',
      cart
    });
  } catch (error) {
    console.error('Add to cart error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Update item quantity
router.put('/update', auth, async (req, res) => {
  try {
    const { bookId, quantity } = req.body;

    if (!bookId || quantity === undefined) {
      return res.status(400).json({ message: 'Book ID and quantity are required' });
    }

    if (quantity > 0) {
      const book = await Book.findById(bookId);
      if (!book) {
        return res.status(404).json({ message: 'Book not found' });
      }

      if (quantity > book.stock) {
        return res.status(400).json({ message: 'Cannot exceed available stock' });
      }
    }

    let cart = await Cart.findOne({ user: req.user._id });
    if (!cart) {
      return res.status(404).json({ message: 'Cart not found' });
    }

    await cart.updateItemQuantity(bookId, quantity);
    await cart.populate('items.book');

    res.json({
      message: 'Cart updated',
      cart
    });
  } catch (error) {
    console.error('Update cart error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Remove item from cart
router.delete('/remove/:bookId', auth, async (req, res) => {
  try {
    const { bookId } = req.params;

    let cart = await Cart.findOne({ user: req.user._id });
    if (!cart) {
      return res.status(404).json({ message: 'Cart not found' });
    }

    await cart.removeItem(bookId);
    await cart.populate('items.book');

    res.json({
      message: 'Item removed from cart',
      cart
    });
  } catch (error) {
    console.error('Remove from cart error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Clear cart
router.delete('/clear', auth, async (req, res) => {
  try {
    let cart = await Cart.findOne({ user: req.user._id });
    if (!cart) {
      return res.status(404).json({ message: 'Cart not found' });
    }

    await cart.clearCart();

    res.json({
      message: 'Cart cleared',
      cart
    });
  } catch (error) {
    console.error('Clear cart error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Sync cart from localStorage
router.post('/sync', auth, async (req, res) => {
  try {
    const { items } = req.body;

    if (!Array.isArray(items)) {
      return res.status(400).json({ message: 'Items must be an array' });
    }

    let cart = await Cart.findOne({ user: req.user._id });
    if (!cart) {
      cart = new Cart({ user: req.user._id, items: [] });
    }

    // Clear existing items
    cart.items = [];

    // Add items from localStorage
    for (const item of items) {
      const book = await Book.findById(item.book._id);
      if (book && book.stock >= item.quantity) {
        cart.items.push({
          book: book._id,
          quantity: item.quantity,
          price: book.price
        });
      }
    }

    await cart.save();
    await cart.populate('items.book');

    res.json({
      message: 'Cart synced',
      cart
    });
  } catch (error) {
    console.error('Sync cart error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

module.exports = router;