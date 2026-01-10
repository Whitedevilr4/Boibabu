# BoiBabu Production Deployment Guide

## 🚀 Quick Start

### Prerequisites
- Node.js 16+ and npm 8+
- MongoDB 4.4+
- PM2 (for process management)
- Nginx (for reverse proxy)
- SSL certificate (recommended)

### Automated Deployment

#### Linux/macOS
```bash
chmod +x deploy.sh
./deploy.sh
```

#### Windows
```cmd
deploy.bat
```

### Manual Deployment

#### 1. Environment Setup
```bash
# Copy and configure environment files
cp backend/.env.production.example backend/.env.production
cp frontend/.env.production frontend/.env.production

# Edit the files with your production values
nano backend/.env.production
nano frontend/.env.production
```

#### 2. Install Dependencies
```bash
npm run install-prod
```

#### 3. Build Frontend
```bash
npm run build
```

#### 4. Start with PM2
```bash
npm install -g pm2
npm run pm2:start
```

## 🔧 Configuration

### Environment Variables

#### Backend (.env.production)
```env
NODE_ENV=production
PORT=5000
MONGODB_URI=mongodb://localhost:27017/boibabu_production
JWT_SECRET=your-super-secure-jwt-secret
EMAIL_USER=your-email@gmail.com
EMAIL_PASS=your-app-password
FRONTEND_URL=https://boibabu.in
RAZORPAY_KEY_ID=your-razorpay-key
RAZORPAY_KEY_SECRET=your-razorpay-secret
```

#### Frontend (.env.production)
```env
REACT_APP_API_URL=https://api.boibabu.in
REACT_APP_ENVIRONMENT=production
GENERATE_SOURCEMAP=false
```

### Nginx Configuration

```nginx
server {
    listen 80;
    server_name boibabu.in www.boibabu.in;
    return 301 https://$server_name$request_uri;
}

server {
    listen 443 ssl http2;
    server_name boibabu.in www.boibabu.in;
    
    # SSL Configuration
    ssl_certificate /path/to/ssl/certificate.crt;
    ssl_certificate_key /path/to/ssl/private.key;
    
    # Frontend
    location / {
        root /path/to/boibabu/frontend/build;
        try_files $uri $uri/ /index.html;
    }
    
    # API
    location /api {
        proxy_pass http://localhost:5000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

## 🐳 Docker Deployment

### Build and Run
```bash
docker-compose up -d
```

### Environment Variables for Docker
Create a `.env` file in the root directory:
```env
MONGODB_URI=mongodb://mongo:27017/boibabu_production
JWT_SECRET=your-jwt-secret
EMAIL_USER=your-email@gmail.com
EMAIL_PASS=your-app-password
FRONTEND_URL=https://boibabu.in
```

## 📊 Monitoring

### PM2 Commands
```bash
# Check status
npm run pm2:status

# View logs
npm run pm2:logs

# Restart application
npm run pm2:restart

# Stop application
npm run pm2:stop
```

### Health Check
```bash
curl http://localhost:5000/api/health
```

## 🔒 Security Checklist

- [ ] Environment variables are set correctly
- [ ] SSL certificate is installed and configured
- [ ] MongoDB is secured with authentication
- [ ] Firewall is configured to allow only necessary ports
- [ ] Regular backups are scheduled
- [ ] Log rotation is configured
- [ ] Rate limiting is enabled
- [ ] CORS is properly configured
- [ ] Security headers are set

## 🚨 Troubleshooting

### Common Issues

#### Application won't start
1. Check environment variables
2. Verify MongoDB connection
3. Check port availability
4. Review PM2 logs

#### Frontend not loading
1. Verify Nginx configuration
2. Check build files exist
3. Verify SSL certificate
4. Check browser console for errors

#### API requests failing
1. Check CORS configuration
2. Verify API URL in frontend
3. Check backend logs
4. Verify proxy configuration

### Log Locations
- PM2 logs: `./logs/`
- Nginx logs: `/var/log/nginx/`
- MongoDB logs: `/var/log/mongodb/`

## 📈 Performance Optimization

### Frontend
- Gzip compression enabled
- Static assets cached
- Code splitting implemented
- Images optimized

### Backend
- Clustering with PM2
- Database indexing
- Response compression
- Rate limiting

### Database
- Proper indexing
- Connection pooling
- Query optimization
- Regular maintenance

## 🔄 Updates and Maintenance

### Updating the Application
```bash
# Pull latest changes
git pull origin main

# Install dependencies
npm run install-prod

# Build frontend
npm run build

# Restart application
npm run pm2:restart
```

### Database Backup
```bash
# Create backup
mongodump --db boibabu_production --out ./backups/$(date +%Y%m%d)

# Restore backup
mongorestore --db boibabu_production ./backups/20240101/boibabu_production
```

## 📞 Support

For production support and issues:
- Check logs first
- Review this documentation
- Contact the development team
- Create an issue on GitHub

## 🎯 Performance Metrics

### Expected Performance
- Page load time: < 3 seconds
- API response time: < 500ms
- Uptime: > 99.9%
- Memory usage: < 1GB per instance

### Monitoring Tools
- PM2 monitoring
- Nginx access logs
- MongoDB profiler
- Application health checks