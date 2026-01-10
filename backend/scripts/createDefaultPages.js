require('dotenv').config();
const mongoose = require('mongoose');
const Page = require('../models/Page');
const User = require('../models/User');

// Connect to MongoDB
mongoose.connect(process.env.MONGODB_URI, {
  useNewUrlParser: true,
  useUnifiedTopology: true,
});

const defaultPages = [
  {
    title: 'Contact Us',
    slug: 'contact',
    content: `
      <h2>Get in Touch</h2>
      <p>We'd love to hear from you! Whether you have questions about our books, need help with your order, or just want to say hello, we're here to help.</p>
      
      <h3>Contact Information</h3>
      <ul>
        <li><strong>Email:</strong> support@boibabu.in</li>
        <li><strong>Phone:</strong> +91-1234567890</li>
        <li><strong>Address:</strong> BoiBabu Bookstore, India</li>
      </ul>
      
      <h3>Business Hours</h3>
      <p>Monday - Friday: 9:00 AM - 6:00 PM<br>
      Saturday: 10:00 AM - 4:00 PM<br>
      Sunday: Closed</p>
      
      <h3>Customer Support</h3>
      <p>Our customer support team is available to help you with:</p>
      <ul>
        <li>Order inquiries and tracking</li>
        <li>Book recommendations</li>
        <li>Account assistance</li>
        <li>Technical support</li>
        <li>Returns and refunds</li>
      </ul>
    `,
    metaTitle: 'Contact Us - BoiBabu',
    metaDescription: 'Get in touch with BoiBabu. Contact our customer support team for help with orders, book recommendations, and more.',
    displayOrder: 1
  },
  {
    title: 'FAQ',
    slug: 'faq',
    content: `
      <h2>Frequently Asked Questions</h2>
      
      <h3>Ordering & Payment</h3>
      
      <h4>How do I place an order?</h4>
      <p>Simply browse our collection, add books to your cart, and proceed to checkout. You can pay using various methods including credit/debit cards, UPI, and cash on delivery.</p>
      
      <h4>What payment methods do you accept?</h4>
      <p>We accept all major credit and debit cards, UPI payments, net banking, and cash on delivery for eligible orders.</p>
      
      <h4>Is it safe to use my credit card on your website?</h4>
      <p>Yes, absolutely! We use industry-standard SSL encryption to protect your personal and payment information.</p>
      
      <h3>Shipping & Delivery</h3>
      
      <h4>How long does delivery take?</h4>
      <p>Standard delivery takes 3-7 business days. Express delivery options are available for faster shipping.</p>
      
      <h4>Do you offer free shipping?</h4>
      <p>Yes! We offer free shipping on orders above ₹2000. For orders below this amount, standard shipping charges apply.</p>
      
      <h4>Can I track my order?</h4>
      <p>Yes, once your order is shipped, you'll receive a tracking number via email and SMS to monitor your package.</p>
      
      <h3>Returns & Refunds</h3>
      
      <h4>What is your return policy?</h4>
      <p>We offer a 30-day return policy for books in original condition. Digital products and personalized items are not eligible for returns.</p>
      
      <h4>How do I return a book?</h4>
      <p>Contact our customer support team to initiate a return. We'll provide you with return instructions and a prepaid shipping label if applicable.</p>
    `,
    metaTitle: 'FAQ - BoiBabu',
    metaDescription: 'Find answers to frequently asked questions about ordering, shipping, returns, and more at BoiBabu.',
    displayOrder: 2
  },
  {
    title: 'Shipping Info',
    slug: 'shipping',
    content: `
      <h2>Shipping Information</h2>
      
      <h3>Shipping Options</h3>
      
      <h4>Standard Shipping</h4>
      <ul>
        <li>Delivery Time: 3-7 business days</li>
        <li>Cost: ₹50 (Free on orders above ₹2000)</li>
        <li>Available across India</li>
      </ul>
      
      <h4>Express Shipping</h4>
      <ul>
        <li>Delivery Time: 1-3 business days</li>
        <li>Cost: ₹150</li>
        <li>Available in major cities</li>
      </ul>
      
      <h4>Same Day Delivery</h4>
      <ul>
        <li>Delivery Time: Within 24 hours</li>
        <li>Cost: ₹250</li>
        <li>Available in select metro cities</li>
      </ul>
      
      <h3>Shipping Locations</h3>
      <p>We ship to all major cities and towns across India. Remote locations may have extended delivery times.</p>
      
      <h3>Order Processing</h3>
      <p>Orders are typically processed within 1-2 business days. You'll receive a confirmation email once your order is shipped with tracking information.</p>
      
      <h3>Packaging</h3>
      <p>All books are carefully packaged to ensure they arrive in perfect condition. We use eco-friendly packaging materials whenever possible.</p>
      
      <h3>Delivery Issues</h3>
      <p>If you experience any issues with delivery, please contact our customer support team immediately. We'll work to resolve the issue quickly.</p>
    `,
    metaTitle: 'Shipping Information - BoiBabu',
    metaDescription: 'Learn about our shipping options, delivery times, and costs. Free shipping available on orders above ₹2000.',
    displayOrder: 3
  },
  {
    title: 'Returns',
    slug: 'returns',
    content: `
      <h2>Returns & Refunds Policy</h2>
      
      <h3>Return Eligibility</h3>
      <p>We want you to be completely satisfied with your purchase. If you're not happy with your order, you can return it within 30 days of delivery.</p>
      
      <h4>Eligible Items</h4>
      <ul>
        <li>Books in original, unused condition</li>
        <li>Items with original packaging and tags</li>
        <li>Books without writing, highlighting, or damage</li>
      </ul>
      
      <h4>Non-Eligible Items</h4>
      <ul>
        <li>Digital books and e-books</li>
        <li>Personalized or customized items</li>
        <li>Books damaged by customer use</li>
        <li>Items returned after 30 days</li>
      </ul>
      
      <h3>How to Return</h3>
      <ol>
        <li>Contact our customer support team at support@boibabu.in</li>
        <li>Provide your order number and reason for return</li>
        <li>We'll send you return instructions and a prepaid shipping label</li>
        <li>Pack the items securely and ship them back to us</li>
      </ol>
      
      <h3>Refund Process</h3>
      <p>Once we receive and inspect your returned items:</p>
      <ul>
        <li>Approved returns will be refunded within 5-7 business days</li>
        <li>Refunds will be processed to your original payment method</li>
        <li>You'll receive an email confirmation once the refund is processed</li>
      </ul>
      
      <h3>Return Shipping</h3>
      <p>We provide prepaid return shipping labels for eligible returns. If the return is due to our error, we'll cover all shipping costs.</p>
      
      <h3>Exchanges</h3>
      <p>We currently don't offer direct exchanges. Please return the item for a refund and place a new order for the desired item.</p>
    `,
    metaTitle: 'Returns & Refunds - BoiBabu',
    metaDescription: 'Learn about our 30-day return policy, eligible items, and refund process. Easy returns with prepaid shipping labels.',
    displayOrder: 4
  },
  {
    title: 'Privacy Policy',
    slug: 'privacy',
    content: `
      <h2>Privacy Policy</h2>
      <p><em>Last updated: ${new Date().toLocaleDateString()}</em></p>
      
      <h3>Information We Collect</h3>
      
      <h4>Personal Information</h4>
      <p>When you create an account or make a purchase, we collect:</p>
      <ul>
        <li>Name and contact information</li>
        <li>Shipping and billing addresses</li>
        <li>Email address and phone number</li>
        <li>Payment information (processed securely)</li>
      </ul>
      
      <h4>Usage Information</h4>
      <p>We automatically collect information about how you use our website:</p>
      <ul>
        <li>Pages visited and time spent</li>
        <li>Search queries and browsing behavior</li>
        <li>Device and browser information</li>
        <li>IP address and location data</li>
      </ul>
      
      <h3>How We Use Your Information</h3>
      <p>We use your information to:</p>
      <ul>
        <li>Process and fulfill your orders</li>
        <li>Provide customer support</li>
        <li>Send order updates and notifications</li>
        <li>Improve our website and services</li>
        <li>Send promotional emails (with your consent)</li>
        <li>Prevent fraud and ensure security</li>
      </ul>
      
      <h3>Information Sharing</h3>
      <p>We do not sell, trade, or rent your personal information to third parties. We may share information with:</p>
      <ul>
        <li>Service providers who help us operate our business</li>
        <li>Payment processors for transaction processing</li>
        <li>Shipping companies for order delivery</li>
        <li>Legal authorities when required by law</li>
      </ul>
      
      <h3>Data Security</h3>
      <p>We implement appropriate security measures to protect your personal information:</p>
      <ul>
        <li>SSL encryption for data transmission</li>
        <li>Secure servers and databases</li>
        <li>Regular security audits and updates</li>
        <li>Limited access to personal information</li>
      </ul>
      
      <h3>Your Rights</h3>
      <p>You have the right to:</p>
      <ul>
        <li>Access and update your personal information</li>
        <li>Delete your account and data</li>
        <li>Opt out of marketing communications</li>
        <li>Request a copy of your data</li>
      </ul>
      
      <h3>Cookies</h3>
      <p>We use cookies to enhance your browsing experience. You can control cookie settings through your browser preferences.</p>
      
      <h3>Contact Us</h3>
      <p>If you have questions about this privacy policy, please contact us at privacy@boibabu.in</p>
    `,
    metaTitle: 'Privacy Policy - BoiBabu',
    metaDescription: 'Read our privacy policy to understand how we collect, use, and protect your personal information at BoiBabu.',
    displayOrder: 5
  }
];

async function createDefaultPages() {
  try {
    // Find an admin user to assign as creator
    const adminUser = await User.findOne({ role: 'admin' });
    if (!adminUser) {
      console.log('No admin user found. Please create an admin user first.');
      process.exit(1);
    }

    console.log('Creating default pages...');

    for (const pageData of defaultPages) {
      // Check if page already exists
      const existingPage = await Page.findOne({ slug: pageData.slug });
      if (existingPage) {
        console.log(`Page "${pageData.title}" already exists, skipping...`);
        continue;
      }

      // Create the page
      const page = new Page({
        ...pageData,
        createdBy: adminUser._id,
        updatedBy: adminUser._id
      });

      await page.save();
      console.log(`Created page: ${pageData.title}`);
    }

    console.log('Default pages created successfully!');
    process.exit(0);
  } catch (error) {
    console.error('Error creating default pages:', error);
    process.exit(1);
  }
}

createDefaultPages();
