const nodemailer = require('nodemailer');

// Create transporter based on environment
const createTransporter = () => {
  // Check if email credentials are provided
  if (!process.env.EMAIL_USER || !process.env.EMAIL_PASS) {
    if (process.env.NODE_ENV === 'production') {
      throw new Error('Email credentials are required for production');
    }
    console.warn('Email credentials not found. Email features will be disabled.');
    return null;
  }

  // Use Gmail SMTP for both development and production
  return nodemailer.createTransport({
    service: 'gmail',
    host: 'smtp.gmail.com',
    port: 587,
    secure: false,
    auth: {
      user: process.env.EMAIL_USER,
      pass: process.env.EMAIL_PASS
    },
    tls: {
      rejectUnauthorized: false
    }
  });
};

const sendPasswordResetEmail = async (email, resetToken, userName) => {
  try {
    const transporter = createTransporter();
    
    if (!transporter) {
      console.log('Email service not configured, skipping password reset email');
      return { success: true, messageId: 'email-disabled' };
    }
    
    const resetUrl = process.env.NODE_ENV === 'production' 
      ? `${process.env.FRONTEND_URL}/reset-password?token=${resetToken}`
      : `http://localhost:3000/reset-password?token=${resetToken}`;

    const mailOptions = {
      from: process.env.EMAIL_FROM || 'BoiBabu <noreply@boibabu.com>',
      to: email,
      subject: 'Password Reset Request - BoiBabu',
      html: `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>Password Reset - BoiBabu</title>
          <style>
            body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
            .container { max-width: 600px; margin: 0 auto; padding: 20px; }
            .header { background: #3b82f6; color: white; padding: 20px; text-align: center; border-radius: 8px 8px 0 0; }
            .content { background: #f9fafb; padding: 30px; border-radius: 0 0 8px 8px; }
            .button { display: inline-block; background: #3b82f6; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; margin: 20px 0; }
            .footer { text-align: center; margin-top: 20px; color: #666; font-size: 14px; }
            .warning { background: #fef3cd; border: 1px solid #fde68a; padding: 15px; border-radius: 6px; margin: 20px 0; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <h1>📚 BoiBabu</h1>
              <h2>Password Reset Request</h2>
            </div>
            <div class="content">
              <p>Hello ${userName},</p>
              
              <p>We received a request to reset your password for your BoiBabu account. If you didn't make this request, you can safely ignore this email.</p>
              
              <p>To reset your password, click the button below:</p>
              
              <div style="text-align: center;">
                <a href="${resetUrl}" class="button">Reset My Password</a>
              </div>
              
              <p>Or copy and paste this link into your browser:</p>
              <p style="word-break: break-all; background: #e5e7eb; padding: 10px; border-radius: 4px;">${resetUrl}</p>
              
              <div class="warning">
                <strong>⚠️ Important:</strong>
                <ul>
                  <li>This link will expire in 1 hour for security reasons</li>
                  <li>You can only use this link once</li>
                  <li>If you didn't request this reset, please ignore this email</li>
                </ul>
              </div>
              
              <p>If you're having trouble with the button above, copy and paste the URL into your web browser.</p>
              
              <p>Best regards,<br>The BoiBabu Team</p>
            </div>
            <div class="footer">
              <p>This email was sent to ${email}</p>
              <p>© ${new Date().getFullYear()} BoiBabu. All rights reserved.</p>
            </div>
          </div>
        </body>
        </html>
      `
    };

    const info = await transporter.sendMail(mailOptions);
    
    if (process.env.NODE_ENV === 'development') {
      console.log('Password reset email sent:', info.messageId);
    }
    
    return { success: true, messageId: info.messageId };
  } catch (error) {
    console.error('Email sending error:', error);
    return { success: false, error: error.message };
  }
};

const sendOTPEmail = async (email, otp, userName, type = 'email_verification') => {
  try {
    const transporter = createTransporter();
    
    if (!transporter) {
      console.log('Email service not configured, skipping OTP email');
      return { success: true, messageId: 'email-disabled' };
    }

    const isPasswordReset = type === 'password_reset';
    const subject = isPasswordReset ? 'Password Reset OTP - BoiBabu' : 'Email Verification OTP - BoiBabu';
    const title = isPasswordReset ? 'Password Reset' : 'Email Verification';
    const message = isPasswordReset 
      ? 'We received a request to reset your password. Use the OTP below to proceed with password reset.'
      : 'Welcome to BoiBabu! Please verify your email address using the OTP below to complete your registration.';

    const mailOptions = {
      from: process.env.EMAIL_FROM || 'BoiBabu <noreply@boibabu.com>',
      to: email,
      subject,
      html: `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>${title} - BoiBabu</title>
          <style>
            body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
            .container { max-width: 600px; margin: 0 auto; padding: 20px; }
            .header { background: #3b82f6; color: white; padding: 20px; text-align: center; border-radius: 8px 8px 0 0; }
            .content { background: #f9fafb; padding: 30px; border-radius: 0 0 8px 8px; }
            .otp-box { background: white; border: 2px solid #3b82f6; padding: 20px; text-align: center; border-radius: 8px; margin: 20px 0; }
            .otp-code { font-size: 32px; font-weight: bold; color: #3b82f6; letter-spacing: 8px; font-family: monospace; }
            .footer { text-align: center; margin-top: 20px; color: #666; font-size: 14px; }
            .warning { background: #fef3cd; border: 1px solid #fde68a; padding: 15px; border-radius: 6px; margin: 20px 0; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <h1>📚 BoiBabu</h1>
              <h2>${title}</h2>
            </div>
            <div class="content">
              <p>Hello ${userName},</p>
              
              <p>${message}</p>
              
              <div class="otp-box">
                <p style="margin: 0 0 10px 0; font-size: 16px; color: #666;">Your OTP Code:</p>
                <div class="otp-code">${otp}</div>
              </div>
              
              <div class="warning">
                <strong>⚠️ Important Security Information:</strong>
                <ul>
                  <li>This OTP will expire in <strong>5 minutes</strong></li>
                  <li>You have <strong>3 attempts</strong> per 24 hours</li>
                  <li>Never share this OTP with anyone</li>
                  <li>If you didn't request this, please ignore this email</li>
                </ul>
              </div>
              
              <p>If you're having trouble, please contact our support team.</p>
              
              <p>Best regards,<br>The BoiBabu Team</p>
            </div>
            <div class="footer">
              <p>This email was sent to ${email}</p>
              <p>© ${new Date().getFullYear()} BoiBabu. All rights reserved.</p>
            </div>
          </div>
        </body>
        </html>
      `
    };

    const info = await transporter.sendMail(mailOptions);
    
    if (process.env.NODE_ENV === 'development') {
      console.log(`${title} OTP email sent:`, info.messageId);
      // OTP is not logged for security reasons
    }
    
    return { success: true, messageId: info.messageId };
  } catch (error) {
    console.error('OTP email sending error:', error);
    return { success: false, error: error.message };
  }
};

const sendWelcomeEmail = async (email, userName) => {
  try {
    const transporter = createTransporter();
    
    if (!transporter) {
      console.log('Email service not configured, skipping welcome email');
      return { success: true, messageId: 'email-disabled' };
    }
    
    const mailOptions = {
      from: process.env.EMAIL_FROM || 'BoiBabu <welcome@boibabu.com>',
      to: email,
      subject: 'Welcome to BoiBabu! 📚',
      html: `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>Welcome to BoiBabu</title>
          <style>
            body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
            .container { max-width: 600px; margin: 0 auto; padding: 20px; }
            .header { background: #3b82f6; color: white; padding: 20px; text-align: center; border-radius: 8px 8px 0 0; }
            .content { background: #f9fafb; padding: 30px; border-radius: 0 0 8px 8px; }
            .button { display: inline-block; background: #3b82f6; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; margin: 20px 0; }
            .footer { text-align: center; margin-top: 20px; color: #666; font-size: 14px; }
            .feature { background: white; padding: 15px; margin: 10px 0; border-radius: 6px; border-left: 4px solid #3b82f6; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <h1>📚 Welcome to BoiBabu!</h1>
            </div>
            <div class="content">
              <p>Hello ${userName},</p>
              
              <p>Welcome to BoiBabu! We're excited to have you join our community of book lovers. Your account has been successfully created and you're ready to start exploring our vast collection of books.</p>
              
              <h3>What you can do now:</h3>
              
              <div class="feature">
                <strong>🔍 Discover Books</strong><br>
                Browse our extensive catalog with advanced search and filtering options.
              </div>
              
              <div class="feature">
                <strong>⭐ Read Reviews</strong><br>
                Check out reviews from other readers and share your own thoughts.
              </div>
              
              <div class="feature">
                <strong>🛒 Easy Shopping</strong><br>
                Add books to your cart and enjoy a seamless checkout experience.
              </div>
              
              <div class="feature">
                <strong>📦 Track Orders</strong><br>
                Monitor your orders from purchase to delivery with real-time updates.
              </div>
              
              <div style="text-align: center;">
                <a href="${process.env.FRONTEND_URL || 'https://boibabu.in'}" class="button">Start Shopping</a>
              </div>
              
              <p>If you have any questions or need assistance, don't hesitate to reach out to our support team.</p>
              
              <p>Happy reading!<br>The BoiBabu Team</p>
            </div>
            <div class="footer">
              <p>This email was sent to ${email}</p>
              <p>© ${new Date().getFullYear()} BoiBabu. All rights reserved.</p>
            </div>
          </div>
        </body>
        </html>
      `
    };

    const info = await transporter.sendMail(mailOptions);
    
    if (process.env.NODE_ENV === 'development') {
      console.log('Welcome email sent:', info.messageId);
    }
    
    return { success: true, messageId: info.messageId };
  } catch (error) {
    console.error('Welcome email sending error:', error);
    return { success: false, error: error.message };
  }
};

const sendOrderConfirmationEmail = async (email, userName, order) => {
  try {
    const transporter = createTransporter();
    
    if (!transporter) {
      console.log('Email service not configured, skipping order confirmation email');
      return { success: true, messageId: 'email-disabled' };
    }

    // Format order items for email
    const itemsList = order.items.map(item => 
      `<tr>
        <td style="padding: 10px; border-bottom: 1px solid #e5e7eb;">${item.book.title}</td>
        <td style="padding: 10px; border-bottom: 1px solid #e5e7eb; text-align: center;">${item.quantity}</td>
        <td style="padding: 10px; border-bottom: 1px solid #e5e7eb; text-align: right;">₹${item.price.toLocaleString('en-IN')}</td>
        <td style="padding: 10px; border-bottom: 1px solid #e5e7eb; text-align: right;">₹${(item.price * item.quantity).toLocaleString('en-IN')}</td>
      </tr>`
    ).join('');

    const mailOptions = {
      from: process.env.EMAIL_FROM || 'BoiBabu <orders@boibabu.com>',
      to: email,
      subject: `Order Confirmation - ${order.orderNumber} | BoiBabu`,
      html: `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>Order Confirmation - BoiBabu</title>
          <style>
            body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
            .container { max-width: 600px; margin: 0 auto; padding: 20px; }
            .header { background: #3b82f6; color: white; padding: 20px; text-align: center; border-radius: 8px 8px 0 0; }
            .content { background: #f9fafb; padding: 30px; border-radius: 0 0 8px 8px; }
            .order-box { background: white; border: 1px solid #e5e7eb; padding: 20px; border-radius: 8px; margin: 20px 0; }
            .footer { text-align: center; margin-top: 20px; color: #666; font-size: 14px; }
            .button { display: inline-block; background: #3b82f6; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; margin: 20px 0; }
            table { width: 100%; border-collapse: collapse; margin: 15px 0; }
            th { background: #f3f4f6; padding: 10px; text-align: left; border-bottom: 2px solid #e5e7eb; }
            .total-row { background: #f9fafb; font-weight: bold; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <h1>📚 BoiBabu</h1>
              <h2>Order Confirmation</h2>
            </div>
            <div class="content">
              <p>Hello ${userName},</p>
              
              <p>Thank you for your order! We're excited to get your books to you. Here are the details of your order:</p>
              
              <div class="order-box">
                <h3 style="margin-top: 0; color: #3b82f6;">Order #${order.orderNumber}</h3>
                <p><strong>Order Date:</strong> ${new Date(order.createdAt).toLocaleDateString('en-IN', { 
                  year: 'numeric', 
                  month: 'long', 
                  day: 'numeric' 
                })}</p>
                <p><strong>Payment Method:</strong> ${order.paymentMethod.replace('_', ' ').toUpperCase()}</p>
                <p><strong>Estimated Delivery:</strong> ${order.estimatedDelivery ? new Date(order.estimatedDelivery).toLocaleDateString('en-IN', { 
                  year: 'numeric', 
                  month: 'long', 
                  day: 'numeric' 
                }) : '5-7 business days'}</p>
              </div>

              <h3>Order Items</h3>
              <table>
                <thead>
                  <tr>
                    <th>Book Title</th>
                    <th style="text-align: center;">Quantity</th>
                    <th style="text-align: right;">Price</th>
                    <th style="text-align: right;">Total</th>
                  </tr>
                </thead>
                <tbody>
                  ${itemsList}
                  <tr class="total-row">
                    <td colspan="3" style="padding: 10px; text-align: right;">Subtotal:</td>
                    <td style="padding: 10px; text-align: right;">₹${order.subtotal.toLocaleString('en-IN')}</td>
                  </tr>
                  <tr class="total-row">
                    <td colspan="3" style="padding: 10px; text-align: right;">Shipping:</td>
                    <td style="padding: 10px; text-align: right;">₹${order.shippingCost.toLocaleString('en-IN')}</td>
                  </tr>
                  <tr class="total-row" style="background: #3b82f6; color: white;">
                    <td colspan="3" style="padding: 15px; text-align: right; font-size: 18px;">Total:</td>
                    <td style="padding: 15px; text-align: right; font-size: 18px;">₹${order.total.toLocaleString('en-IN')}</td>
                  </tr>
                </tbody>
              </table>

              <h3>Shipping Address</h3>
              <div class="order-box">
                <p><strong>${order.shippingAddress.name}</strong></p>
                <p>${order.shippingAddress.street}</p>
                ${order.shippingAddress.landmark ? `<p>${order.shippingAddress.landmark}</p>` : ''}
                <p>${order.shippingAddress.city}, ${order.shippingAddress.state} ${order.shippingAddress.zipCode}</p>
                <p>${order.shippingAddress.country}</p>
                <p>Phone: ${order.shippingAddress.phone}</p>
              </div>

              <div style="text-align: center;">
                <a href="${process.env.FRONTEND_URL || 'https://boibabu.in'}/orders/${order._id}" class="button">Track Your Order</a>
              </div>
              
              <p>We'll send you another email when your order ships with tracking information.</p>
              
              <p>If you have any questions about your order, please don't hesitate to contact our support team.</p>
              
              <p>Thank you for choosing BoiBabu!</p>
              
              <p>Best regards,<br>The BoiBabu Team</p>
            </div>
            <div class="footer">
              <p>This email was sent to ${email}</p>
              <p>© ${new Date().getFullYear()} BoiBabu. All rights reserved.</p>
            </div>
          </div>
        </body>
        </html>
      `
    };

    const info = await transporter.sendMail(mailOptions);
    
    if (process.env.NODE_ENV === 'development') {
      console.log('Order confirmation email sent:', info.messageId);
    }
    
    return { success: true, messageId: info.messageId };
  } catch (error) {
    console.error('Order confirmation email sending error:', error);
    return { success: false, error: error.message };
  }
};

const sendOrderDeliveredEmail = async (email, userName, order) => {
  try {
    const transporter = createTransporter();
    
    if (!transporter) {
      console.log('Email service not configured, skipping order delivered email');
      return { success: true, messageId: 'email-disabled' };
    }

    const mailOptions = {
      from: process.env.EMAIL_FROM || 'BoiBabu <orders@boibabu.com>',
      to: email,
      subject: `Order Delivered - ${order.orderNumber} | BoiBabu`,
      html: `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>Order Delivered - BoiBabu</title>
          <style>
            body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
            .container { max-width: 600px; margin: 0 auto; padding: 20px; }
            .header { background: #10b981; color: white; padding: 20px; text-align: center; border-radius: 8px 8px 0 0; }
            .content { background: #f9fafb; padding: 30px; border-radius: 0 0 8px 8px; }
            .order-box { background: white; border: 1px solid #e5e7eb; padding: 20px; border-radius: 8px; margin: 20px 0; }
            .footer { text-align: center; margin-top: 20px; color: #666; font-size: 14px; }
            .button { display: inline-block; background: #3b82f6; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; margin: 20px 0; }
            .success-icon { font-size: 48px; text-align: center; margin: 20px 0; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <h1>📚 BoiBabu</h1>
              <h2>Order Delivered!</h2>
            </div>
            <div class="content">
              <div class="success-icon">📦✅</div>
              
              <p>Hello ${userName},</p>
              
              <p>Great news! Your order has been successfully delivered. We hope you enjoy your new books!</p>
              
              <div class="order-box">
                <h3 style="margin-top: 0; color: #10b981;">Order #${order.orderNumber}</h3>
                <p><strong>Delivered On:</strong> ${new Date(order.deliveredAt).toLocaleDateString('en-IN', { 
                  year: 'numeric', 
                  month: 'long', 
                  day: 'numeric',
                  hour: '2-digit',
                  minute: '2-digit'
                })}</p>
                <p><strong>Delivered To:</strong></p>
                <p>${order.shippingAddress.name}<br>
                ${order.shippingAddress.street}<br>
                ${order.shippingAddress.landmark ? `${order.shippingAddress.landmark}<br>` : ''}
                ${order.shippingAddress.city}, ${order.shippingAddress.state} ${order.shippingAddress.zipCode}</p>
              </div>

              <h3>Your Books (${order.items.length} item${order.items.length > 1 ? 's' : ''})</h3>
              <div class="order-box">
                ${order.items.map(item => `
                  <p><strong>${item.book.title}</strong> ${item.book.author ? `by ${item.book.author}` : ''}<br>
                  Quantity: ${item.quantity}</p>
                `).join('')}
              </div>

              <div style="text-align: center;">
                <a href="${process.env.FRONTEND_URL || 'https://boibabu.in'}/orders/${order._id}" class="button">View Order Details</a>
              </div>
              
              <p><strong>What's Next?</strong></p>
              <ul>
                <li>📖 Start reading and enjoy your new books!</li>
                <li>⭐ Consider leaving a review to help other readers</li>
                <li>📚 Browse our collection for your next great read</li>
              </ul>
              
              <p>If there are any issues with your delivery or if you have questions, please contact our support team immediately.</p>
              
              <p>Thank you for choosing BoiBabu. We appreciate your business!</p>
              
              <p>Happy reading!<br>The BoiBabu Team</p>
            </div>
            <div class="footer">
              <p>This email was sent to ${email}</p>
              <p>© ${new Date().getFullYear()} BoiBabu. All rights reserved.</p>
            </div>
          </div>
        </body>
        </html>
      `
    };

    const info = await transporter.sendMail(mailOptions);
    
    if (process.env.NODE_ENV === 'development') {
      console.log('Order delivered email sent:', info.messageId);
    }
    
    return { success: true, messageId: info.messageId };
  } catch (error) {
    console.error('Order delivered email sending error:', error);
    return { success: false, error: error.message };
  }
};

const sendSellerOrderNotificationEmail = async (email, sellerName, order, sellerBooks) => {
  try {
    console.log(`🔄 Attempting to send order notification email to seller: ${sellerName} (${email}) for order: ${order.orderNumber}`);
    
    const transporter = createTransporter();
    
    if (!transporter) {
      console.log('⚠️ Email service not configured, skipping seller order notification email');
      return { success: true, messageId: 'email-disabled' };
    }

    // Test the transporter connection
    try {
      await transporter.verify();
      console.log('✅ Email transporter verified successfully');
    } catch (verifyError) {
      console.error('❌ Email transporter verification failed:', verifyError.message);
      return { success: false, error: 'Email service verification failed' };
    }

    // Format seller's books in the order
    const sellerItemsList = sellerBooks.map(item => 
      `<tr>
        <td style="padding: 10px; border-bottom: 1px solid #e5e7eb;">${item.book.title}</td>
        <td style="padding: 10px; border-bottom: 1px solid #e5e7eb; text-align: center;">${item.quantity}</td>
        <td style="padding: 10px; border-bottom: 1px solid #e5e7eb; text-align: right;">₹${item.price.toLocaleString('en-IN')}</td>
        <td style="padding: 10px; border-bottom: 1px solid #e5e7eb; text-align: right;">₹${(item.price * item.quantity).toLocaleString('en-IN')}</td>
      </tr>`
    ).join('');

    const totalAmount = sellerBooks.reduce((sum, item) => sum + (item.price * item.quantity), 0);

    const mailOptions = {
      from: process.env.EMAIL_FROM || 'BoiBabu <orders@boibabu.com>',
      to: email,
      subject: `New Order Received - ${order.orderNumber} | BoiBabu Seller`,
      html: `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>New Order Received - BoiBabu</title>
          <style>
            body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
            .container { max-width: 600px; margin: 0 auto; padding: 20px; }
            .header { background: #10b981; color: white; padding: 20px; text-align: center; border-radius: 8px 8px 0 0; }
            .content { background: #f9fafb; padding: 30px; border-radius: 0 0 8px 8px; }
            .order-box { background: white; border: 1px solid #e5e7eb; padding: 20px; border-radius: 8px; margin: 20px 0; }
            .footer { text-align: center; margin-top: 20px; color: #666; font-size: 14px; }
            .button { display: inline-block; background: #10b981; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; margin: 20px 0; }
            table { width: 100%; border-collapse: collapse; margin: 15px 0; }
            th { background: #f3f4f6; padding: 10px; text-align: left; border-bottom: 2px solid #e5e7eb; }
            .total-row { background: #f9fafb; font-weight: bold; }
            .success-icon { font-size: 48px; text-align: center; margin: 20px 0; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <h1>📚 BoiBabu Seller</h1>
              <h2>New Order Received!</h2>
            </div>
            <div class="content">
              <div class="success-icon">🛒✨</div>
              
              <p>Hello ${sellerName},</p>
              
              <p>Great news! You have received a new order for your books. Please process this order through your seller dashboard.</p>
              
              <div class="order-box">
                <h3 style="margin-top: 0; color: #10b981;">Order #${order.orderNumber}</h3>
                <p><strong>Order Date:</strong> ${new Date(order.createdAt).toLocaleDateString('en-IN', { 
                  year: 'numeric', 
                  month: 'long', 
                  day: 'numeric' 
                })}</p>
                <p><strong>Customer:</strong> ${order.shippingAddress?.name || 'N/A'}</p>
                <p><strong>Payment Method:</strong> ${order.paymentMethod.replace('_', ' ').toUpperCase()}</p>
                <p><strong>Payment Status:</strong> ${order.paymentStatus.toUpperCase()}</p>
              </div>

              <h3>Your Books in This Order</h3>
              <table>
                <thead>
                  <tr>
                    <th>Book Title</th>
                    <th style="text-align: center;">Quantity</th>
                    <th style="text-align: right;">Price</th>
                    <th style="text-align: right;">Total</th>
                  </tr>
                </thead>
                <tbody>
                  ${sellerItemsList}
                  <tr class="total-row" style="background: #10b981; color: white;">
                    <td colspan="3" style="padding: 15px; text-align: right; font-size: 18px;">Your Total:</td>
                    <td style="padding: 15px; text-align: right; font-size: 18px;">₹${totalAmount.toLocaleString('en-IN')}</td>
                  </tr>
                </tbody>
              </table>

              <h3>Shipping Address</h3>
              <div class="order-box">
                <p><strong>${order.shippingAddress.name}</strong></p>
                <p>${order.shippingAddress.street}</p>
                ${order.shippingAddress.landmark ? `<p>${order.shippingAddress.landmark}</p>` : ''}
                <p>${order.shippingAddress.city}, ${order.shippingAddress.state} ${order.shippingAddress.zipCode}</p>
                <p>${order.shippingAddress.country}</p>
                <p>Phone: ${order.shippingAddress.phone}</p>
              </div>

              <div style="text-align: center;">
                <a href="${process.env.FRONTEND_URL || 'https://boibabu.in'}/seller/orders/${order._id}" class="button">Process Order in Dashboard</a>
              </div>
              
              <p><strong>Next Steps:</strong></p>
              <ul>
                <li>📦 Log into your seller dashboard to view full order details</li>
                <li>📋 Prepare your books for shipping</li>
                <li>🚚 Update the order status once shipped</li>
                <li>💰 Payment will be processed after successful delivery</li>
              </ul>
              
              <p>If you have any questions about this order, please contact our support team.</p>
              
              <p>Thank you for being a valued seller on BoiBabu!</p>
              
              <p>Best regards,<br>The BoiBabu Team</p>
            </div>
            <div class="footer">
              <p>This email was sent to ${email}</p>
              <p>© ${new Date().getFullYear()} BoiBabu. All rights reserved.</p>
            </div>
          </div>
        </body>
        </html>
      `
    };

    const info = await transporter.sendMail(mailOptions);
    
    console.log('✅ Seller order notification email sent successfully:', info.messageId);
    
    return { success: true, messageId: info.messageId };
  } catch (error) {
    console.error('❌ Seller order notification email sending error:', error);
    console.error('❌ Error details:', {
      message: error.message,
      code: error.code,
      response: error.response
    });
    return { success: false, error: error.message };
  }
};

const sendComplaintResolvedEmail = async (email, userName, complaint) => {
  try {
    console.log(`Attempting to send complaint resolved email for complaint: ${complaint.subject}`);
    
    const transporter = createTransporter();
    
    if (!transporter) {
      console.log('Email service not configured, skipping complaint resolved email');
      return { success: true, messageId: 'email-disabled' };
    }

    // Test the transporter connection
    try {
      await transporter.verify();
      console.log('Email transporter verified successfully');
    } catch (verifyError) {
      console.error('Email transporter verification failed:', verifyError.message);
      return { success: false, error: 'Email service verification failed' };
    }
    
    if (!transporter) {
      console.log('Email service not configured, skipping complaint resolved email');
      return { success: true, messageId: 'email-disabled' };
    }

    const userTypeLabel = complaint.userType === 'seller' ? 'Seller' : 'Customer';

    const mailOptions = {
      from: process.env.EMAIL_FROM || 'BoiBabu <support@boibabu.com>',
      to: email,
      subject: `Complaint Resolved - ${complaint.subject} | BoiBabu Support`,
      html: `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>Complaint Resolved - BoiBabu</title>
          <style>
            body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
            .container { max-width: 600px; margin: 0 auto; padding: 20px; }
            .header { background: #10b981; color: white; padding: 20px; text-align: center; border-radius: 8px 8px 0 0; }
            .content { background: #f9fafb; padding: 30px; border-radius: 0 0 8px 8px; }
            .complaint-box { background: white; border: 1px solid #e5e7eb; padding: 20px; border-radius: 8px; margin: 20px 0; }
            .response-box { background: #ecfdf5; border: 1px solid #10b981; padding: 20px; border-radius: 8px; margin: 20px 0; }
            .footer { text-align: center; margin-top: 20px; color: #666; font-size: 14px; }
            .button { display: inline-block; background: #3b82f6; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; margin: 20px 0; }
            .success-icon { font-size: 48px; text-align: center; margin: 20px 0; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <h1>📚 BoiBabu Support</h1>
              <h2>Complaint Resolved</h2>
            </div>
            <div class="content">
              <div class="success-icon">✅🎉</div>
              
              <p>Hello ${userName},</p>
              
              <p>We're pleased to inform you that your complaint has been resolved. Thank you for bringing this matter to our attention.</p>
              
              <div class="complaint-box">
                <h3 style="margin-top: 0; color: #10b981;">Complaint Details</h3>
                <p><strong>Subject:</strong> ${complaint.subject}</p>
                <p><strong>Category:</strong> ${complaint.category}</p>
                <p><strong>Priority:</strong> ${complaint.priority}</p>
                <p><strong>Status:</strong> <span style="color: #10b981; font-weight: bold;">${complaint.status}</span></p>
                <p><strong>Submitted:</strong> ${new Date(complaint.createdAt).toLocaleDateString('en-IN', { 
                  year: 'numeric', 
                  month: 'long', 
                  day: 'numeric' 
                })}</p>
                <p><strong>Resolved:</strong> ${new Date(complaint.resolvedDate || Date.now()).toLocaleDateString('en-IN', { 
                  year: 'numeric', 
                  month: 'long', 
                  day: 'numeric' 
                })}</p>
                ${complaint.orderId ? `<p><strong>Related Order:</strong> #${complaint.orderId.orderNumber || complaint.orderId}</p>` : ''}
                ${complaint.bookId ? `<p><strong>Related Book:</strong> ${complaint.bookId.title || complaint.bookId}</p>` : ''}
              </div>

              <h3>Your Original Complaint</h3>
              <div class="complaint-box">
                <p>${complaint.description}</p>
              </div>

              ${complaint.adminResponse ? `
                <h3>Our Resolution</h3>
                <div class="response-box">
                  <p><strong>Admin Response:</strong></p>
                  <p>${complaint.adminResponse}</p>
                  <p style="margin-top: 15px; font-size: 14px; color: #059669;">
                    <strong>Response Date:</strong> ${new Date(complaint.adminResponseDate || Date.now()).toLocaleDateString('en-IN', { 
                      year: 'numeric', 
                      month: 'long', 
                      day: 'numeric' 
                    })}
                  </p>
                </div>
              ` : ''}

              <div style="text-align: center;">
                <a href="${process.env.FRONTEND_URL || 'https://boibabu.in'}/${complaint.userType === 'seller' ? 'seller' : ''}/complaints" class="button">View All Complaints</a>
              </div>
              
              <p><strong>What's Next?</strong></p>
              <ul>
                <li>✅ Your complaint has been marked as resolved</li>
                <li>📝 If you need further assistance, you can submit a new complaint</li>
                <li>💬 Feel free to contact our support team if you have any questions</li>
                <li>⭐ We appreciate your feedback to help us improve our service</li>
              </ul>
              
              <p>We apologize for any inconvenience caused and appreciate your patience while we worked to resolve this matter.</p>
              
              <p>Thank you for choosing BoiBabu!</p>
              
              <p>Best regards,<br>The BoiBabu Support Team</p>
            </div>
            <div class="footer">
              <p>This email was sent to ${email}</p>
              <p>© ${new Date().getFullYear()} BoiBabu. All rights reserved.</p>
            </div>
          </div>
        </body>
        </html>
      `
    };

    console.log(`Sending complaint resolved email for complaint: ${complaint.subject}`);

    const info = await transporter.sendMail(mailOptions);
    
    console.log('Complaint resolved email sent successfully:', info.messageId);
    
    return { success: true, messageId: info.messageId };
  } catch (error) {
    console.error('Complaint resolved email sending error:', error);
    return { success: false, error: error.message };
  }
};

const sendAccountSuspensionEmail = async (email, userName, reason, suspendedBy) => {
  try {
    console.log(`Sending account suspension email to: ${userName} (${email})`);
    
    const transporter = createTransporter();
    
    if (!transporter) {
      console.log('Email service not configured, skipping suspension email');
      return { success: true, messageId: 'email-disabled' };
    }

    const mailOptions = {
      from: process.env.EMAIL_FROM || 'BoiBabu <support@boibabu.com>',
      to: email,
      subject: 'Account Suspended - BoiBabu',
      html: `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>Account Suspended - BoiBabu</title>
          <style>
            body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
            .container { max-width: 600px; margin: 0 auto; padding: 20px; }
            .header { background: #dc2626; color: white; padding: 20px; text-align: center; border-radius: 8px 8px 0 0; }
            .content { background: #f9fafb; padding: 30px; border-radius: 0 0 8px 8px; }
            .warning-box { background: #fef2f2; border: 1px solid #fecaca; padding: 20px; border-radius: 8px; margin: 20px 0; }
            .footer { text-align: center; margin-top: 20px; color: #666; font-size: 14px; }
            .button { display: inline-block; background: #3b82f6; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; margin: 20px 0; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <h1>📚 BoiBabu</h1>
              <h2>Account Suspended</h2>
            </div>
            <div class="content">
              <p>Hello ${userName},</p>
              
              <p>We regret to inform you that your BoiBabu account has been suspended by our administration team.</p>
              
              <div class="warning-box">
                <h3 style="margin-top: 0; color: #dc2626;">Suspension Details</h3>
                <p><strong>Reason:</strong> ${reason}</p>
                <p><strong>Suspended On:</strong> ${new Date().toLocaleDateString('en-IN', { 
                  year: 'numeric', 
                  month: 'long', 
                  day: 'numeric',
                  hour: '2-digit',
                  minute: '2-digit'
                })}</p>
                <p><strong>Suspended By:</strong> ${suspendedBy}</p>
              </div>

              <p><strong>What this means:</strong></p>
              <ul>
                <li>🚫 You cannot log into your account</li>
                <li>🛑 All account activities are suspended</li>
                <li>📧 You will not receive regular notifications</li>
                <li>🔒 Access to all services is restricted</li>
              </ul>

              <p><strong>Next Steps:</strong></p>
              <ul>
                <li>📧 Reply to this email to request a review of your suspension</li>
                <li>📝 Provide any relevant information or explanation</li>
                <li>⏳ Our team will review your case within 2-3 business days</li>
                <li>📞 Contact our support team for urgent matters</li>
              </ul>

              <div style="text-align: center;">
                <a href="mailto:support@boibabu.com?subject=Account Suspension Review Request - ${userName}" class="button">Request Review</a>
              </div>
              
              <p>If you believe this suspension was made in error, please contact our support team immediately with any relevant information.</p>
              
              <p>We take account security and platform integrity seriously. All suspensions are reviewed carefully before implementation.</p>
              
              <p>Best regards,<br>The BoiBabu Support Team</p>
            </div>
            <div class="footer">
              <p>This email was sent to ${email}</p>
              <p>© ${new Date().getFullYear()} BoiBabu. All rights reserved.</p>
            </div>
          </div>
        </body>
        </html>
      `
    };

    const info = await transporter.sendMail(mailOptions);
    
    console.log('Account suspension email sent successfully:', info.messageId);
    
    return { success: true, messageId: info.messageId };
  } catch (error) {
    console.error('Account suspension email sending error:', error);
    return { success: false, error: error.message };
  }
};

const sendAccountUnsuspensionEmail = async (email, userName, unsuspendedBy) => {
  try {
    console.log(`Sending account unsuspension email to: ${userName} (${email})`);
    
    const transporter = createTransporter();
    
    if (!transporter) {
      console.log('Email service not configured, skipping unsuspension email');
      return { success: true, messageId: 'email-disabled' };
    }

    const mailOptions = {
      from: process.env.EMAIL_FROM || 'BoiBabu <support@boibabu.com>',
      to: email,
      subject: 'Account Unsuspended - BoiBabu',
      html: `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>Account Unsuspended - BoiBabu</title>
          <style>
            body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
            .container { max-width: 600px; margin: 0 auto; padding: 20px; }
            .header { background: #10b981; color: white; padding: 20px; text-align: center; border-radius: 8px 8px 0 0; }
            .content { background: #f9fafb; padding: 30px; border-radius: 0 0 8px 8px; }
            .success-box { background: #ecfdf5; border: 1px solid #10b981; padding: 20px; border-radius: 8px; margin: 20px 0; }
            .warning-box { background: #fef3cd; border: 1px solid #fde68a; padding: 20px; border-radius: 8px; margin: 20px 0; }
            .footer { text-align: center; margin-top: 20px; color: #666; font-size: 14px; }
            .button { display: inline-block; background: #10b981; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; margin: 20px 0; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <h1>📚 BoiBabu</h1>
              <h2>Account Unsuspended</h2>
            </div>
            <div class="content">
              <p>Hello ${userName},</p>
              
              <p>Good news! Your BoiBabu account suspension has been lifted by our administration team. You can now access your account and resume all activities.</p>
              
              <div class="success-box">
                <h3 style="margin-top: 0; color: #10b981;">Account Restored</h3>
                <p><strong>Unsuspended On:</strong> ${new Date().toLocaleDateString('en-IN', { 
                  year: 'numeric', 
                  month: 'long', 
                  day: 'numeric',
                  hour: '2-digit',
                  minute: '2-digit'
                })}</p>
                <p><strong>Unsuspended By:</strong> ${unsuspendedBy}</p>
              </div>

              <p><strong>What you can do now:</strong></p>
              <ul>
                <li>✅ Log into your account normally</li>
                <li>🛒 Resume shopping and placing orders</li>
                <li>📧 Receive all notifications and updates</li>
                <li>🔓 Access all platform features</li>
              </ul>

              <div class="warning-box">
                <h3 style="margin-top: 0; color: #d97706;">⚠️ Important Reminder</h3>
                <p>Please ensure you follow our Terms of Service and Community Guidelines to avoid future suspensions. We appreciate your cooperation in maintaining a safe and positive environment for all users.</p>
                <ul>
                  <li>Respect other users and sellers</li>
                  <li>Provide accurate information</li>
                  <li>Follow payment and transaction policies</li>
                  <li>Report any issues through proper channels</li>
                </ul>
              </div>

              <div style="text-align: center;">
                <a href="${process.env.FRONTEND_URL || 'https://boibabu.in'}/login" class="button">Login to Your Account</a>
              </div>
              
              <p>If you have any questions or need assistance, please don't hesitate to contact our support team.</p>
              
              <p>Thank you for your patience and welcome back to BoiBabu!</p>
              
              <p>Best regards,<br>The BoiBabu Support Team</p>
            </div>
            <div class="footer">
              <p>This email was sent to ${email}</p>
              <p>© ${new Date().getFullYear()} BoiBabu. All rights reserved.</p>
            </div>
          </div>
        </body>
        </html>
      `
    };

    const info = await transporter.sendMail(mailOptions);
    
    console.log('Account unsuspension email sent successfully:', info.messageId);
    
    return { success: true, messageId: info.messageId };
  } catch (error) {
    console.error('Account unsuspension email sending error:', error);
    return { success: false, error: error.message };
  }
};

// Email templates for marketing campaigns
const getEmailTemplate = (template, data) => {
  const { subject, content, userName, companyName = 'BoiBabu' } = data;
  
  const baseStyle = `
    body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; margin: 0; padding: 0; }
    .container { max-width: 600px; margin: 0 auto; padding: 20px; }
    .header { background: #3b82f6; color: white; padding: 20px; text-align: center; border-radius: 8px 8px 0 0; }
    .content { background: #f9fafb; padding: 30px; border-radius: 0 0 8px 8px; }
    .footer { text-align: center; margin-top: 20px; color: #666; font-size: 14px; }
    .button { display: inline-block; background: #3b82f6; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; margin: 20px 0; }
    .highlight-box { background: #e0f2fe; border-left: 4px solid #3b82f6; padding: 15px; margin: 20px 0; border-radius: 4px; }
    .promotion-box { background: #fef3cd; border: 1px solid #fde68a; padding: 20px; border-radius: 8px; margin: 20px 0; text-align: center; }
    .newsletter-section { background: white; padding: 20px; margin: 15px 0; border-radius: 6px; border-left: 4px solid #10b981; }
  `;

  switch (template) {
    case 'marketing':
      return `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>${subject} - ${companyName}</title>
          <style>${baseStyle}</style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <h1>📚 ${companyName}</h1>
              <h2>${subject}</h2>
            </div>
            <div class="content">
              <p>Hello ${userName || 'Valued Customer'},</p>
              
              <div class="promotion-box">
                <h3 style="margin-top: 0; color: #d97706;">🎉 Special Offer Just for You!</h3>
                ${content}
              </div>
              
              <div style="text-align: center;">
                <a href="${process.env.FRONTEND_URL || 'http://localhost:3000'}" class="button">Shop Now</a>
              </div>
              
              <p>Don't miss out on this amazing opportunity to discover your next favorite book!</p>
              
              <p>Happy reading!<br>The ${companyName} Team</p>
            </div>
            <div class="footer">
              <p>© ${new Date().getFullYear()} ${companyName}. All rights reserved.</p>
              <p><a href="${process.env.FRONTEND_URL || 'https://boibabu.in'}/unsubscribe" style="color: #666;">Unsubscribe</a></p>
            </div>
          </div>
        </body>
        </html>
      `;

    case 'newsletter':
      return `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>${subject} - ${companyName}</title>
          <style>${baseStyle}</style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <h1>📚 ${companyName} Newsletter</h1>
              <h2>${subject}</h2>
            </div>
            <div class="content">
              <p>Hello ${userName || 'Book Lover'},</p>
              
              <div class="newsletter-section">
                <h3 style="margin-top: 0; color: #10b981;">📖 What's New This Week</h3>
                ${content}
              </div>
              
              <div style="text-align: center;">
                <a href="${process.env.FRONTEND_URL || 'https://boibabu.in'}" class="button">Explore Books</a>
              </div>
              
              <p>Thank you for being part of our reading community!</p>
              
              <p>Best regards,<br>The ${companyName} Team</p>
            </div>
            <div class="footer">
              <p>© ${new Date().getFullYear()} ${companyName}. All rights reserved.</p>
              <p><a href="${process.env.FRONTEND_URL || 'http://localhost:3000'}/unsubscribe" style="color: #666;">Unsubscribe</a></p>
            </div>
          </div>
        </body>
        </html>
      `;

    case 'announcement':
      return `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>${subject} - ${companyName}</title>
          <style>${baseStyle}</style>
        </head>
        <body>
          <div class="container">
            <div class="header" style="background: #10b981;">
              <h1>📢 ${companyName}</h1>
              <h2>Important Announcement</h2>
            </div>
            <div class="content">
              <p>Hello ${userName || 'Dear User'},</p>
              
              <div class="highlight-box">
                <h3 style="margin-top: 0; color: #3b82f6;">${subject}</h3>
                ${content}
              </div>
              
              <p>If you have any questions, please don't hesitate to contact our support team.</p>
              
              <p>Best regards,<br>The ${companyName} Team</p>
            </div>
            <div class="footer">
              <p>© ${new Date().getFullYear()} ${companyName}. All rights reserved.</p>
            </div>
          </div>
        </body>
        </html>
      `;

    case 'promotion':
      return `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>${subject} - ${companyName}</title>
          <style>${baseStyle}</style>
        </head>
        <body>
          <div class="container">
            <div class="header" style="background: #dc2626;">
              <h1>🔥 ${companyName}</h1>
              <h2>Limited Time Offer!</h2>
            </div>
            <div class="content">
              <p>Hello ${userName || 'Valued Customer'},</p>
              
              <div class="promotion-box" style="background: #fef2f2; border-color: #fecaca;">
                <h3 style="margin-top: 0; color: #dc2626;">⏰ ${subject}</h3>
                ${content}
                <p style="font-size: 18px; font-weight: bold; color: #dc2626; margin: 15px 0;">Hurry! Limited time only!</p>
              </div>
              
              <div style="text-align: center;">
                <a href="${process.env.FRONTEND_URL || 'https://boibabu.in'}" class="button" style="background: #dc2626; font-size: 18px; padding: 15px 30px;">Claim Offer Now</a>
              </div>
              
              <p>Don't let this amazing deal slip away!</p>
              
              <p>Happy shopping!<br>The ${companyName} Team</p>
            </div>
            <div class="footer">
              <p>© ${new Date().getFullYear()} ${companyName}. All rights reserved.</p>
              <p><a href="${process.env.FRONTEND_URL || 'https://boibabu.in'}/unsubscribe" style="color: #666;">Unsubscribe</a></p>
            </div>
          </div>
        </body>
        </html>
      `;

    case 'official':
      return `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>${subject} - ${companyName}</title>
          <style>${baseStyle}</style>
        </head>
        <body>
          <div class="container">
            <div class="header" style="background: #374151;">
              <h1>📚 ${companyName}</h1>
              <h2>Official Communication</h2>
            </div>
            <div class="content">
              <p>Dear ${userName || 'User'},</p>
              
              <h3 style="color: #374151;">${subject}</h3>
              
              <div style="background: white; padding: 20px; border-radius: 6px; border: 1px solid #e5e7eb;">
                ${content}
              </div>
              
              <p>This is an official communication from ${companyName}. Please keep this email for your records.</p>
              
              <p>Best regards,<br>The ${companyName} Team</p>
            </div>
            <div class="footer">
              <p>© ${new Date().getFullYear()} ${companyName}. All rights reserved.</p>
            </div>
          </div>
        </body>
        </html>
      `;

    case 'custom':
    default:
      return `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>${subject} - ${companyName}</title>
          <style>${baseStyle}</style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <h1>📚 ${companyName}</h1>
              <h2>${subject}</h2>
            </div>
            <div class="content">
              <p>Hello ${userName || 'Dear User'},</p>
              
              ${content}
              
              <p>Best regards,<br>The ${companyName} Team</p>
            </div>
            <div class="footer">
              <p>© ${new Date().getFullYear()} ${companyName}. All rights reserved.</p>
            </div>
          </div>
        </body>
        </html>
      `;
  }
};

const sendMarketingEmail = async (email, userName, subject, content, template = 'marketing') => {
  try {
    const transporter = createTransporter();
    
    if (!transporter) {
      console.log('Email service not configured, skipping marketing email');
      return { success: true, messageId: 'email-disabled' };
    }

    const htmlContent = getEmailTemplate(template, {
      subject,
      content,
      userName
    });

    const mailOptions = {
      from: process.env.EMAIL_FROM || 'BoiBabu <marketing@boibabu.com>',
      to: email,
      subject: subject,
      html: htmlContent
    };

    const info = await transporter.sendMail(mailOptions);
    
    if (process.env.NODE_ENV === 'development') {
      console.log('Marketing email sent:', info.messageId);
    }
    
    return { success: true, messageId: info.messageId };
  } catch (error) {
    console.error('Marketing email sending error:', error);
    return { success: false, error: error.message };
  }
};

const sendBulkEmails = async (recipients, subject, content, template = 'marketing') => {
  const results = {
    success: 0,
    failed: 0,
    errors: []
  };

  const transporter = createTransporter();
  
  if (!transporter) {
    console.log('Email service not configured, skipping bulk emails');
    return { success: true, messageId: 'email-disabled', results };
  }

  // Send emails in batches to avoid overwhelming the email service
  const batchSize = 10;
  const batches = [];
  
  for (let i = 0; i < recipients.length; i += batchSize) {
    batches.push(recipients.slice(i, i + batchSize));
  }

  for (const batch of batches) {
    const promises = batch.map(async (recipient) => {
      try {
        const htmlContent = getEmailTemplate(template, {
          subject,
          content,
          userName: recipient.name
        });

        const mailOptions = {
          from: process.env.EMAIL_FROM || 'BoiBabu <marketing@boibabu.com>',
          to: recipient.email,
          subject: subject,
          html: htmlContent
        };

        const info = await transporter.sendMail(mailOptions);
        results.success++;
        return { success: true, email: recipient.email, messageId: info.messageId };
      } catch (error) {
        results.failed++;
        results.errors.push({
          email: recipient.email,
          error: error.message
        });
        return { success: false, email: recipient.email, error: error.message };
      }
    });

    await Promise.all(promises);
    
    // Add delay between batches to be respectful to email service
    if (batches.indexOf(batch) < batches.length - 1) {
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
  }

  return { success: true, results };
};

const sendRefundConfirmationEmail = async (email, userName, order, refundAmount, reason) => {
  try {
    console.log(`Sending refund confirmation email to: ${userName} (${email}) for order: ${order.orderNumber}`);
    
    const transporter = createTransporter();
    
    if (!transporter) {
      console.log('Email service not configured, skipping refund confirmation email');
      return { success: true, messageId: 'email-disabled' };
    }

    const mailOptions = {
      from: process.env.EMAIL_FROM || 'BoiBabu <orders@boibabu.com>',
      to: email,
      subject: `Refund Processed - ${order.orderNumber} | BoiBabu`,
      html: `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>Refund Processed - BoiBabu</title>
          <style>
            body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
            .container { max-width: 600px; margin: 0 auto; padding: 20px; }
            .header { background: #10b981; color: white; padding: 20px; text-align: center; border-radius: 8px 8px 0 0; }
            .content { background: #f9fafb; padding: 30px; border-radius: 0 0 8px 8px; }
            .refund-box { background: white; border: 1px solid #e5e7eb; padding: 20px; border-radius: 8px; margin: 20px 0; }
            .footer { text-align: center; margin-top: 20px; color: #666; font-size: 14px; }
            .button { display: inline-block; background: #3b82f6; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; margin: 20px 0; }
            .success-icon { font-size: 48px; text-align: center; margin: 20px 0; }
            .amount-highlight { background: #ecfdf5; border: 1px solid #10b981; padding: 15px; border-radius: 8px; text-align: center; margin: 20px 0; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <h1>📚 BoiBabu</h1>
              <h2>Refund Processed</h2>
            </div>
            <div class="content">
              <div class="success-icon">💰✅</div>
              
              <p>Hello ${userName},</p>
              
              <p>We have successfully processed your refund request. The refund amount will be credited to your original payment method within 5-7 business days.</p>
              
              <div class="amount-highlight">
                <h3 style="margin: 0; color: #10b981; font-size: 24px;">₹${refundAmount.toLocaleString('en-IN')}</h3>
                <p style="margin: 5px 0 0 0; color: #059669;">Refund Amount</p>
              </div>

              <div class="refund-box">
                <h3 style="margin-top: 0; color: #10b981;">Refund Details</h3>
                <p><strong>Order Number:</strong> #${order.orderNumber}</p>
                <p><strong>Original Order Total:</strong> ₹${order.total.toLocaleString('en-IN')}</p>
                <p><strong>Refund Amount:</strong> ₹${refundAmount.toLocaleString('en-IN')}</p>
                <p><strong>Refund Date:</strong> ${new Date().toLocaleDateString('en-IN', { 
                  year: 'numeric', 
                  month: 'long', 
                  day: 'numeric',
                  hour: '2-digit',
                  minute: '2-digit'
                })}</p>
                ${reason ? `<p><strong>Reason:</strong> ${reason}</p>` : ''}
                <p><strong>Payment Method:</strong> ${order.paymentMethod.replace('_', ' ').toUpperCase()}</p>
              </div>

              <div style="text-align: center;">
                <a href="${process.env.FRONTEND_URL || 'https://boibabu.in'}/orders/${order._id}" class="button">View Order Details</a>
              </div>
              
              <p><strong>What happens next?</strong></p>
              <ul>
                <li>💳 The refund will be processed to your original payment method</li>
                <li>⏰ It may take 5-7 business days to reflect in your account</li>
                <li>📧 You'll receive a confirmation from your bank/payment provider</li>
                <li>❓ Contact us if you don't see the refund after 7 business days</li>
              </ul>
              
              <p>If you have any questions about this refund or need further assistance, please don't hesitate to contact our support team.</p>
              
              <p>We apologize for any inconvenience and appreciate your understanding.</p>
              
              <p>Best regards,<br>The BoiBabu Team</p>
            </div>
            <div class="footer">
              <p>This email was sent to ${email}</p>
              <p>© ${new Date().getFullYear()} BoiBabu. All rights reserved.</p>
            </div>
          </div>
        </body>
        </html>
      `
    };

    const info = await transporter.sendMail(mailOptions);
    
    console.log('Refund confirmation email sent successfully:', info.messageId);
    
    return { success: true, messageId: info.messageId };
  } catch (error) {
    console.error('Refund confirmation email sending error:', error);
    return { success: false, error: error.message };
  }
};

module.exports = {
  sendPasswordResetEmail,
  sendWelcomeEmail,
  sendOTPEmail,
  sendOrderConfirmationEmail,
  sendOrderDeliveredEmail,
  sendSellerOrderNotificationEmail,
  sendComplaintResolvedEmail,
  sendAccountSuspensionEmail,
  sendAccountUnsuspensionEmail,
  sendMarketingEmail,
  sendBulkEmails,
  getEmailTemplate,
  sendRefundConfirmationEmail
};
