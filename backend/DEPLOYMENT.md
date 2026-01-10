# BoiBabu Deployment Guide

## Production Deployment Checklist

### Environment Variables

#### Backend (.env)
```bash
# Server Configuration
PORT=5000
NODE_ENV=production
JWT_SECRET=your_super_secret_jwt_key_here_make_it_long_and_complex_2024

# Database
MONGODB_URI=mongodb+srv://username:password@cluster.mongodb.net/bookstore?retryWrites=true&w=majority

# Payment Gateway
RAZORPAY_KEY_ID=your_razorpay_key_id
RAZORPAY_KEY_SECRET=your_razorpay_key_secret

# Email Configuration (Gmail SMTP)
EMAIL_USER=your-email@gmail.com
EMAIL_PASS=your-app-password
EMAIL_FROM=BoiBabu <noreply@yourdomain.com>

# Frontend URL
FRONTEND_URL=https://yourdomain.com
```

#### Frontend (.env)
```bash
REACT_APP_API_URL=https://your-backend-domain.com
REACT_APP_RAZORPAY_KEY_ID=your_razorpay_key_id
```

### Pre-deployment Steps

1. **Update Dependencies**
   ```bash
   # Backend
   cd backend
   npm audit fix
   npm update
   
   # Frontend
   cd frontend
   npm audit fix
   npm update
   ```

2. **Build Frontend**
   ```bash
   cd frontend
   npm run build
   ```

3. **Test Production Build Locally**
   ```bash
   # Backend
   cd backend
   NODE_ENV=production npm start
   
   # Frontend (serve build)
   cd frontend
   npx serve -s build -l 3000
   ```

### Deployment Options

#### Option 1: Heroku Deployment

1. **Backend Deployment**
   ```bash
   # Install Heroku CLI
   # Create Heroku app
   heroku create your-app-name-backend
   
   # Set environment variables
   heroku config:set NODE_ENV=production
   heroku config:set JWT_SECRET=your_jwt_secret
   heroku config:set MONGODB_URI=your_mongodb_uri
   # ... set all other env vars
   
   # Deploy
   git subtree push --prefix backend heroku main
   ```

2. **Frontend Deployment (Netlify/Vercel)**
   ```bash
   # Build and deploy to Netlify/Vercel
   # Set environment variables in platform dashboard
   ```

#### Option 2: VPS/Cloud Server Deployment

1. **Server Setup**
   ```bash
   # Update system
   sudo apt update && sudo apt upgrade -y
   
   # Install Node.js
   curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
   sudo apt-get install -y nodejs
   
   # Install PM2
   sudo npm install -g pm2
   
   # Install Nginx
   sudo apt install nginx -y
   ```

2. **Application Setup**
   ```bash
   # Clone repository
   git clone https://github.com/yourusername/bookstore.git
   cd bookstore
   
   # Backend setup
   cd backend
   npm install --production
   
   # Frontend setup
   cd ../frontend
   npm install
   npm run build
   ```

3. **PM2 Configuration**
   ```bash
   # Create ecosystem.config.js
   module.exports = {
     apps: [{
       name: 'bookstore-backend',
       script: './backend/server.js',
       env: {
         NODE_ENV: 'production',
         PORT: 5000
       }
     }]
   };
   
   # Start with PM2
   pm2 start ecosystem.config.js
   pm2 save
   pm2 startup
   ```

4. **Nginx Configuration**
   ```nginx
   # /etc/nginx/sites-available/bookstore
   server {
       listen 80;
       server_name yourdomain.com;
   
       # Frontend
       location / {
           root /path/to/bookstore/frontend/build;
           index index.html index.htm;
           try_files $uri $uri/ /index.html;
       }
   
       # Backend API
       location /api {
           proxy_pass http://localhost:5000;
           proxy_http_version 1.1;
           proxy_set_header Upgrade $http_upgrade;
           proxy_set_header Connection 'upgrade';
           proxy_set_header Host $host;
           proxy_set_header X-Real-IP $remote_addr;
           proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
           proxy_set_header X-Forwarded-Proto $scheme;
           proxy_cache_bypass $http_upgrade;
       }
   
       # Static files (uploads)
       location /uploads {
           proxy_pass http://localhost:5000;
       }
   }
   ```

5. **SSL Certificate (Let's Encrypt)**
   ```bash
   sudo apt install certbot python3-certbot-nginx
   sudo certbot --nginx -d yourdomain.com
   ```

### Database Setup

1. **MongoDB Atlas (Recommended)**
   - Create cluster on MongoDB Atlas
   - Whitelist server IP addresses
   - Create database user
   - Get connection string

2. **Self-hosted MongoDB**
   ```bash
   # Install MongoDB
   sudo apt install mongodb
   
   # Configure security
   sudo nano /etc/mongod.conf
   # Enable authentication
   
   # Create admin user
   mongo
   use admin
   db.createUser({
     user: "admin",
     pwd: "password",
     roles: ["userAdminAnyDatabase"]
   })
   ```

### Email Service Setup

1. **Gmail SMTP**
   - Enable 2-factor authentication
   - Generate app password
   - Use app password in EMAIL_PASS

2. **SendGrid (Alternative)**
   ```bash
   npm install @sendgrid/mail
   ```

### Monitoring and Logging

1. **PM2 Monitoring**
   ```bash
   pm2 monit
   pm2 logs
   ```

2. **Log Rotation**
   ```bash
   pm2 install pm2-logrotate
   ```

### Security Checklist

- [ ] Environment variables secured
- [ ] HTTPS enabled
- [ ] Rate limiting configured
- [ ] Input validation implemented
- [ ] CORS properly configured
- [ ] Security headers set
- [ ] Database access restricted
- [ ] File upload restrictions
- [ ] Error messages sanitized

### Performance Optimization

1. **Frontend**
   - Code splitting implemented
   - Images optimized
   - Lazy loading enabled
   - Bundle size analyzed

2. **Backend**
   - Database indexes created
   - Query optimization
   - Caching implemented
   - Compression enabled

### Backup Strategy

1. **Database Backup**
   ```bash
   # MongoDB backup
   mongodump --uri="mongodb+srv://user:pass@cluster.mongodb.net/bookstore"
   
   # Automated backup script
   #!/bin/bash
   DATE=$(date +%Y%m%d_%H%M%S)
   mongodump --uri="$MONGODB_URI" --out="/backups/backup_$DATE"
   ```

2. **File Backup**
   ```bash
   # Backup uploads directory
   tar -czf uploads_backup_$(date +%Y%m%d).tar.gz backend/uploads/
   ```

### Health Monitoring

- Health check endpoint: `/health`
- Uptime monitoring service (UptimeRobot, Pingdom)
- Error tracking (Sentry)
- Performance monitoring (New Relic, DataDog)

### Troubleshooting

1. **Common Issues**
   - CORS errors: Check FRONTEND_URL in backend .env
   - Database connection: Verify MongoDB URI and network access
   - Email not sending: Check SMTP credentials and app passwords
   - File uploads failing: Check directory permissions

2. **Logs Location**
   - PM2 logs: `~/.pm2/logs/`
   - Nginx logs: `/var/log/nginx/`
   - Application logs: Check console output

### Post-deployment Testing

1. **Functional Testing**
   - User registration and email verification
   - Login/logout functionality
   - Book browsing and search
   - Cart and checkout process
   - Order management
   - Admin panel functionality

2. **Performance Testing**
   - Load testing with tools like Artillery or k6
   - Database query performance
   - API response times

### Maintenance

1. **Regular Updates**
   - Security patches
   - Dependency updates
   - Database maintenance

2. **Monitoring**
   - Server resources
   - Application performance
   - Error rates
   - User activity

## Support

For deployment issues, check:
1. Application logs
2. Server logs
3. Database connectivity
4. Environment variables
5. Network configuration

Contact: support@boibabu.com