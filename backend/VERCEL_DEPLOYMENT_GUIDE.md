# Vercel Deployment Guide for BoiBabu

This guide will help you deploy your BoiBabu application with the backend on Vercel and frontend configured to use the Vercel backend.

## Backend Deployment to Vercel

### 1. Prepare Backend for Vercel

The backend is already configured for Vercel deployment with:
- ✅ `vercel.json` configuration file
- ✅ Production environment setup
- ✅ CORS configuration for production

### 2. Deploy Backend to Vercel

1. **Install Vercel CLI** (if not already installed):
   ```bash
   npm install -g vercel
   ```

2. **Navigate to backend directory**:
   ```bash
   cd backend
   ```

3. **Login to Vercel**:
   ```bash
   vercel login
   ```

4. **Deploy to Vercel**:
   ```bash
   vercel --prod
   ```

5. **Set Environment Variables** in Vercel Dashboard:
   - Go to your Vercel project dashboard
   - Navigate to Settings > Environment Variables
   - Add all the required environment variables from `.env.production.example`:

   **Required Environment Variables:**
   ```
   NODE_ENV=production
   MONGODB_URI=your-mongodb-connection-string
   JWT_SECRET=your-jwt-secret-key
   EMAIL_USER=your-email@gmail.com
   EMAIL_PASS=your-app-password
   FRONTEND_URL=https://your-frontend-domain.vercel.app
   RAZORPAY_KEY_ID=your-razorpay-key
   RAZORPAY_KEY_SECRET=your-razorpay-secret
   CLOUDINARY_CLOUD_NAME=your-cloudinary-name
   CLOUDINARY_API_KEY=your-cloudinary-key
   CLOUDINARY_API_SECRET=your-cloudinary-secret
   ```

6. **Note your Backend URL**: After deployment, Vercel will provide you with a URL like:
   ```
   https://your-backend-app.vercel.app
   ```

## Frontend Configuration

### 1. Update Frontend Environment Variables

1. **Update `.env.production`** with your actual Vercel backend URL:
   ```env
   REACT_APP_API_URL=https://your-backend-app.vercel.app
   GENERATE_SOURCEMAP=false
   ```

2. **For development**, update `.env`:
   ```env
   REACT_APP_API_URL=https://your-backend-app.vercel.app
   GENERATE_SOURCEMAP=false
   ```

### 2. Deploy Frontend

You can deploy the frontend to:
- **Vercel** (recommended)
- **Netlify**
- **Any static hosting service**

#### Deploy Frontend to Vercel:

1. **Navigate to frontend directory**:
   ```bash
   cd frontend
   ```

2. **Deploy to Vercel**:
   ```bash
   vercel --prod
   ```

3. **Update Backend CORS**: After frontend deployment, update the `FRONTEND_URL` environment variable in your backend Vercel project with your frontend URL.

## Important Configuration Changes Made

### 1. API Utility (`frontend/src/utils/api.js`)
- ✅ Created centralized API utility
- ✅ Automatic authentication header injection
- ✅ Environment-based base URL configuration
- ✅ Error handling for 401 responses

### 2. Updated Components
- ✅ `AdminCoupons` - Updated to use new API utility
- ✅ `AuthContext` - Updated to use new API utility

### 3. Backend Configuration
- ✅ `vercel.json` - Updated to point to `server.js`
- ✅ CORS configuration for production
- ✅ Environment variable support

## Testing the Deployment

### 1. Test Backend Endpoints
After backend deployment, test these endpoints:
```bash
# Health check
curl https://your-backend-app.vercel.app/health

# API test (should return 401 without auth)
curl https://your-backend-app.vercel.app/api/auth/me
```

### 2. Test Frontend
1. Open your frontend URL
2. Try logging in as admin
3. Navigate to Admin > Coupons
4. Verify coupon fetching works

## Troubleshooting

### Common Issues:

1. **CORS Errors**:
   - Ensure `FRONTEND_URL` in backend matches your frontend domain exactly
   - Check that CORS is configured properly in `server.js`

2. **API Connection Issues**:
   - Verify `REACT_APP_API_URL` in frontend environment variables
   - Check that backend is deployed and accessible

3. **Authentication Issues**:
   - Ensure JWT_SECRET is set in backend environment variables
   - Check that API utility is properly injecting auth headers

4. **Database Connection**:
   - Verify `MONGODB_URI` is correct and accessible from Vercel
   - Ensure MongoDB Atlas allows connections from anywhere (0.0.0.0/0) for Vercel

### Environment Variables Checklist:

**Backend (Vercel Dashboard):**
- [ ] NODE_ENV=production
- [ ] MONGODB_URI
- [ ] JWT_SECRET
- [ ] EMAIL_USER
- [ ] EMAIL_PASS
- [ ] FRONTEND_URL
- [ ] RAZORPAY_KEY_ID
- [ ] RAZORPAY_KEY_SECRET
- [ ] CLOUDINARY_CLOUD_NAME
- [ ] CLOUDINARY_API_KEY
- [ ] CLOUDINARY_API_SECRET

**Frontend (.env.production):**
- [ ] REACT_APP_API_URL
- [ ] GENERATE_SOURCEMAP=false

## Next Steps

After successful deployment:

1. **Update remaining components** to use the new API utility (optional but recommended)
2. **Set up custom domain** if needed
3. **Configure SSL certificates** (Vercel handles this automatically)
4. **Set up monitoring** and error tracking
5. **Configure backup strategies** for your database

## Support

If you encounter any issues during deployment:
1. Check Vercel deployment logs
2. Verify all environment variables are set correctly
3. Test API endpoints individually
4. Check browser console for frontend errors

Your coupon fetching issue should be resolved once the backend is deployed to Vercel and the frontend is configured with the correct API URL.