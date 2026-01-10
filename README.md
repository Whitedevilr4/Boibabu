# BoiBabu - Book Selling E-commerce Platform

A full-stack book selling e-commerce platform built with React and Node.js.

## Project Structure

```
├── backend/          # Node.js/Express API server
│   ├── server.js     # Main server file
│   ├── package.json  # Backend dependencies
│   └── ...          # Backend source code
│
└── frontend/         # React frontend application
    ├── src/          # Frontend source code
    ├── package.json  # Frontend dependencies
    └── ...          # Frontend assets
```

## Quick Start

### Backend (API Server)
```bash
cd backend
npm install
npm run dev
```

### Frontend (React App)
```bash
cd frontend
npm install
npm start
```

## Deployment

- **Backend**: Deploy to Vercel, Railway, or any Node.js hosting service
- **Frontend**: Deploy to Vercel, Netlify, or any static hosting service

## Documentation

- Backend documentation and deployment guides are in the `backend/` directory
- Frontend SEO guide is in the `frontend/` directory

## Features

- User authentication and authorization
- Book catalog with search and filtering
- Shopping cart and checkout
- Order management
- Admin panel for book and user management
- Seller dashboard for book sellers
- Payment integration with Razorpay
- Email notifications
- Image upload with Cloudinary
- Responsive design

## Tech Stack

**Backend:**
- Node.js & Express.js
- MongoDB with Mongoose
- JWT Authentication
- Cloudinary for image storage
- Nodemailer for emails

**Frontend:**
- React 18
- React Router
- React Query
- Tailwind CSS
- Axios for API calls

## License

MIT