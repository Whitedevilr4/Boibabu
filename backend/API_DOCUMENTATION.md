# BoiBabu API Documentation

## Base URL
- Development: `http://localhost:5000/api`
- Production: `https://your-domain.com/api`

## Authentication
Most endpoints require JWT authentication. Include the token in the Authorization header:
```
Authorization: Bearer <your_jwt_token>
```

## Rate Limiting
- General endpoints: 100 requests per 15 minutes
- Authentication endpoints: 5 requests per 15 minutes
- Password reset: 3 requests per hour
- Email verification: 3 requests per 10 minutes

## Response Format
All responses follow this format:
```json
{
  "success": true,
  "message": "Success message",
  "data": { ... }
}
```

Error responses:
```json
{
  "success": false,
  "message": "Error message",
  "errors": [ ... ]
}
```

---

## Authentication Endpoints

### Register User
**POST** `/auth/register`

**Body:**
```json
{
  "name": "John Doe",
  "email": "john@example.com",
  "password": "password123"
}
```

**Response:**
```json
{
  "message": "Registration successful! Please check your email for verification code.",
  "requiresVerification": true,
  "email": "john@example.com"
}
```

### Verify Email
**POST** `/auth/verify-email`

**Body:**
```json
{
  "email": "john@example.com",
  "otp": "123456"
}
```

**Response:**
```json
{
  "message": "Email verified successfully!",
  "token": "jwt_token_here",
  "user": {
    "id": "user_id",
    "name": "John Doe",
    "email": "john@example.com",
    "role": "user",
    "isEmailVerified": true
  }
}
```

### Login
**POST** `/auth/login`

**Body:**
```json
{
  "email": "john@example.com",
  "password": "password123"
}
```

**Response:**
```json
{
  "message": "Login successful",
  "token": "jwt_token_here",
  "user": {
    "id": "user_id",
    "name": "John Doe",
    "email": "john@example.com",
    "role": "user"
  }
}
```

### Forgot Password
**POST** `/auth/forgot-password`

**Body:**
```json
{
  "email": "john@example.com"
}
```

### Reset Password
**POST** `/auth/reset-password`

**Body:**
```json
{
  "token": "reset_token",
  "newPassword": "newpassword123"
}
```

### Get Current User
**GET** `/auth/me`
*Requires authentication*

### Update Profile
**PUT** `/auth/profile`
*Requires authentication*

**Body:**
```json
{
  "name": "John Doe",
  "phone": "9876543210",
  "address": {
    "street": "123 Main St",
    "landmark": "Near Park",
    "city": "Mumbai",
    "state": "Maharashtra",
    "zipCode": "400001",
    "country": "India"
  }
}
```

### Change Password
**PUT** `/auth/change-password`
*Requires authentication*

**Body:**
```json
{
  "currentPassword": "oldpassword",
  "newPassword": "newpassword123"
}
```

---

## Books Endpoints

### Get All Books
**GET** `/books`

**Query Parameters:**
- `page` (number): Page number (default: 1)
- `limit` (number): Items per page (default: 12)
- `search` (string): Search term
- `category` (string): Category filter
- `minPrice` (number): Minimum price
- `maxPrice` (number): Maximum price
- `sort` (string): Sort by (price_asc, price_desc, rating, newest)

**Response:**
```json
{
  "books": [...],
  "totalPages": 5,
  "currentPage": 1,
  "totalBooks": 50
}
```

### Get Book by ID
**GET** `/books/:id`

### Get Book Reviews
**GET** `/books/:id/reviews`

### Add Review
**POST** `/books/:id/reviews`
*Requires authentication*

**Body:**
```json
{
  "rating": 5,
  "comment": "Great book!"
}
```

### Update Review
**PUT** `/books/:bookId/reviews/:reviewId`
*Requires authentication*

### Delete Review
**DELETE** `/books/:bookId/reviews/:reviewId`
*Requires authentication*

---

## Categories Endpoints

### Get All Categories
**GET** `/categories`

---

## Cart & Orders Endpoints

### Get User Orders
**GET** `/orders`
*Requires authentication*

### Get Order by ID
**GET** `/orders/:id`
*Requires authentication*

### Cancel Order
**PUT** `/orders/:id/cancel`
*Requires authentication*

---

## Payment Endpoints

### Create Razorpay Order
**POST** `/payment/create-order`
*Requires authentication*

**Body:**
```json
{
  "amount": 1000,
  "currency": "INR"
}
```

### Verify Payment
**POST** `/payment/verify`
*Requires authentication*

**Body:**
```json
{
  "razorpay_order_id": "order_id",
  "razorpay_payment_id": "payment_id",
  "razorpay_signature": "signature",
  "orderDetails": {
    "items": [...],
    "totalAmount": 1000,
    "shippingAddress": {...},
    "couponCode": "SAVE10"
  }
}
```

---

## Notifications Endpoints

### Get User Notifications
**GET** `/notifications`
*Requires authentication*

### Mark Notification as Read
**PUT** `/notifications/:id/read`
*Requires authentication*

### Mark All as Read
**PUT** `/notifications/mark-all-read`
*Requires authentication*

---

## Coupons Endpoints

### Validate Coupon
**POST** `/coupons/validate`
*Requires authentication*

**Body:**
```json
{
  "code": "SAVE10",
  "orderAmount": 1000
}
```

---

## Admin Endpoints

### Get Dashboard Stats
**GET** `/admin/dashboard`
*Requires admin authentication*

### Get All Books (Admin)
**GET** `/admin/books`
*Requires admin authentication*

### Create Book
**POST** `/admin/books`
*Requires admin authentication*

**Body (multipart/form-data):**
```
title: "Book Title"
author: "Author Name"
description: "Book description"
price: 500
category: "Fiction"
stock: 100
image: <file>
```

### Update Book
**PUT** `/admin/books/:id`
*Requires admin authentication*

### Delete Book
**DELETE** `/admin/books/:id`
*Requires admin authentication*

### Get All Orders (Admin)
**GET** `/admin/orders`
*Requires admin authentication*

### Update Order Status
**PUT** `/admin/orders/:id/status`
*Requires admin authentication*

**Body:**
```json
{
  "status": "shipped",
  "notes": "Order shipped via courier"
}
```

### Get All Categories (Admin)
**GET** `/admin/categories`
*Requires admin authentication*

### Create Category
**POST** `/admin/categories`
*Requires admin authentication*

**Body (multipart/form-data):**
```
name: "Category Name"
description: "Category description"
image: <file>
```

### Update Category
**PUT** `/admin/categories/:id`
*Requires admin authentication*

### Delete Category
**DELETE** `/admin/categories/:id`
*Requires admin authentication*

### Get All Coupons (Admin)
**GET** `/admin/coupons`
*Requires admin authentication*

### Create Coupon
**POST** `/admin/coupons`
*Requires admin authentication*

**Body:**
```json
{
  "code": "SAVE20",
  "discountType": "percentage",
  "discountValue": 20,
  "minimumAmount": 500,
  "maximumDiscount": 100,
  "expiryDate": "2024-12-31T23:59:59.000Z",
  "usageLimit": 100,
  "isActive": true
}
```

### Update Coupon
**PUT** `/admin/coupons/:id`
*Requires admin authentication*

### Delete Coupon
**DELETE** `/admin/coupons/:id`
*Requires admin authentication*

---

## Error Codes

| Code | Description |
|------|-------------|
| 400 | Bad Request - Invalid input data |
| 401 | Unauthorized - Invalid or missing token |
| 403 | Forbidden - Insufficient permissions |
| 404 | Not Found - Resource not found |
| 409 | Conflict - Resource already exists |
| 422 | Unprocessable Entity - Validation errors |
| 429 | Too Many Requests - Rate limit exceeded |
| 500 | Internal Server Error |

---

## Data Models

### User
```json
{
  "_id": "ObjectId",
  "name": "string",
  "email": "string",
  "role": "user|admin",
  "address": {
    "street": "string",
    "landmark": "string",
    "city": "string",
    "state": "string",
    "zipCode": "string",
    "country": "string"
  },
  "phone": "string",
  "isEmailVerified": "boolean",
  "createdAt": "Date",
  "updatedAt": "Date"
}
```

### Book
```json
{
  "_id": "ObjectId",
  "title": "string",
  "author": "string",
  "description": "string",
  "price": "number",
  "category": "ObjectId",
  "stock": "number",
  "image": "string",
  "rating": "number",
  "numReviews": "number",
  "reviews": [
    {
      "user": "ObjectId",
      "name": "string",
      "rating": "number",
      "comment": "string",
      "createdAt": "Date"
    }
  ],
  "createdAt": "Date",
  "updatedAt": "Date"
}
```

### Order
```json
{
  "_id": "ObjectId",
  "user": "ObjectId",
  "items": [
    {
      "book": "ObjectId",
      "title": "string",
      "price": "number",
      "quantity": "number"
    }
  ],
  "shippingAddress": {
    "name": "string",
    "phone": "string",
    "street": "string",
    "landmark": "string",
    "city": "string",
    "state": "string",
    "zipCode": "string"
  },
  "paymentMethod": "string",
  "paymentResult": {
    "razorpay_order_id": "string",
    "razorpay_payment_id": "string",
    "razorpay_signature": "string"
  },
  "itemsPrice": "number",
  "shippingPrice": "number",
  "totalPrice": "number",
  "couponDiscount": "number",
  "status": "pending|confirmed|shipped|delivered|cancelled",
  "statusHistory": [
    {
      "status": "string",
      "timestamp": "Date",
      "updatedBy": "ObjectId",
      "notes": "string"
    }
  ],
  "createdAt": "Date",
  "updatedAt": "Date"
}
```

### Notification
```json
{
  "_id": "ObjectId",
  "user": "ObjectId",
  "title": "string",
  "message": "string",
  "type": "order|system|promotion",
  "isRead": "boolean",
  "relatedOrder": "ObjectId",
  "createdAt": "Date"
}
```

### Coupon
```json
{
  "_id": "ObjectId",
  "code": "string",
  "discountType": "percentage|fixed",
  "discountValue": "number",
  "minimumAmount": "number",
  "maximumDiscount": "number",
  "expiryDate": "Date",
  "usageLimit": "number",
  "usedCount": "number",
  "isActive": "boolean",
  "createdAt": "Date",
  "updatedAt": "Date"
}
```

---

## Testing

### Health Check
**GET** `/health`

Returns server health status, database connection, and system information.

### Test Connectivity
**GET** `/api/test`

Simple endpoint to test frontend-backend connectivity.

---

## Webhooks

### Razorpay Webhook
**POST** `/payment/webhook`

Handles Razorpay payment status updates.

---

## File Uploads

### Supported Formats
- Images: JPG, JPEG, PNG, WebP
- Maximum size: 5MB per file

### Upload Endpoints
- Book images: `/admin/books` (POST/PUT)
- Category images: `/admin/categories` (POST/PUT)

Files are stored in `/uploads` directory and served statically.

---

## Security Features

- JWT authentication
- Password hashing with bcrypt
- Rate limiting
- Input validation and sanitization
- CORS protection
- Security headers
- File upload restrictions
- NoSQL injection protection

---

## Support

For API support or questions:
- Email: api-support@boibabu.com
- Documentation: https://docs.boibabu.com
- Status Page: https://status.boibabu.com