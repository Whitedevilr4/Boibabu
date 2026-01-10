#!/bin/bash

# BoiBabu Production Deployment Script
echo "🚀 Starting BoiBabu Production Deployment..."

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Function to print colored output
print_status() {
    echo -e "${GREEN}[INFO]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

print_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Check if required environment variables are set
check_env_vars() {
    print_status "Checking environment variables..."
    
    required_vars=("MONGODB_URI" "JWT_SECRET" "EMAIL_USER" "EMAIL_PASS" "FRONTEND_URL")
    missing_vars=()
    
    for var in "${required_vars[@]}"; do
        if [ -z "${!var}" ]; then
            missing_vars+=("$var")
        fi
    done
    
    if [ ${#missing_vars[@]} -ne 0 ]; then
        print_error "Missing required environment variables:"
        printf '%s\n' "${missing_vars[@]}"
        exit 1
    fi
    
    print_status "All required environment variables are set ✓"
}

# Install dependencies
install_dependencies() {
    print_status "Installing backend dependencies..."
    cd backend
    npm ci --only=production
    cd ..
    
    print_status "Installing frontend dependencies..."
    cd frontend
    npm ci
    cd ..
}

# Build frontend
build_frontend() {
    print_status "Building frontend for production..."
    cd frontend
    npm run build
    
    if [ $? -eq 0 ]; then
        print_status "Frontend build completed successfully ✓"
    else
        print_error "Frontend build failed ✗"
        exit 1
    fi
    cd ..
}

# Run tests (if available)
run_tests() {
    print_status "Running tests..."
    cd backend
    if [ -f "package.json" ] && grep -q '"test"' package.json; then
        npm test
    else
        print_warning "No tests found, skipping..."
    fi
    cd ..
}

# Create production directories
create_directories() {
    print_status "Creating production directories..."
    mkdir -p logs
    mkdir -p backend/uploads
    mkdir -p backend/uploads/books
    mkdir -p backend/uploads/users
    mkdir -p backend/uploads/hero-slides
    mkdir -p backend/uploads/publisher-ads
}

# Set proper permissions
set_permissions() {
    print_status "Setting proper permissions..."
    chmod -R 755 backend/uploads
    chmod -R 755 frontend/build
    chmod +x start_app.sh
}

# Create PM2 ecosystem file
create_pm2_config() {
    print_status "Creating PM2 ecosystem configuration..."
    cat > ecosystem.config.js << EOF
module.exports = {
  apps: [{
    name: 'boibabu-backend',
    script: 'backend/server.js',
    instances: 'max',
    exec_mode: 'cluster',
    env: {
      NODE_ENV: 'development',
      PORT: 5000
    },
    env_production: {
      NODE_ENV: 'production',
      PORT: process.env.PORT || 5000
    },
    error_file: './logs/err.log',
    out_file: './logs/out.log',
    log_file: './logs/combined.log',
    time: true,
    max_memory_restart: '1G',
    node_args: '--max-old-space-size=1024'
  }]
};
EOF
    print_status "PM2 configuration created ✓"
}

# Create nginx configuration template
create_nginx_config() {
    print_status "Creating Nginx configuration template..."
    cat > nginx.conf << EOF
server {
    listen 80;
    server_name boibabu.in www.boibabu.in;
    
    # Redirect HTTP to HTTPS
    return 301 https://\$server_name\$request_uri;
}

server {
    listen 443 ssl http2;
    server_name boibabu.in www.boibabu.in;
    
    # SSL Configuration (update paths as needed)
    ssl_certificate /path/to/ssl/certificate.crt;
    ssl_certificate_key /path/to/ssl/private.key;
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers ECDHE-RSA-AES256-GCM-SHA512:DHE-RSA-AES256-GCM-SHA512:ECDHE-RSA-AES256-GCM-SHA384:DHE-RSA-AES256-GCM-SHA384;
    ssl_prefer_server_ciphers off;
    ssl_session_cache shared:SSL:10m;
    
    # Security headers
    add_header X-Frame-Options "SAMEORIGIN" always;
    add_header X-XSS-Protection "1; mode=block" always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header Referrer-Policy "no-referrer-when-downgrade" always;
    add_header Content-Security-Policy "default-src 'self' http: https: data: blob: 'unsafe-inline'" always;
    
    # Gzip compression
    gzip on;
    gzip_vary on;
    gzip_min_length 1024;
    gzip_proxied expired no-cache no-store private must-revalidate auth;
    gzip_types text/plain text/css text/xml text/javascript application/x-javascript application/xml+rss application/javascript;
    
    # Frontend (React build)
    location / {
        root $(pwd)/frontend/build;
        index index.html index.htm;
        try_files \$uri \$uri/ /index.html;
        
        # Cache static assets
        location ~* \.(js|css|png|jpg|jpeg|gif|ico|svg)$ {
            expires 1y;
            add_header Cache-Control "public, immutable";
        }
    }
    
    # API routes
    location /api {
        proxy_pass http://localhost:5000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
        proxy_cache_bypass \$http_upgrade;
        
        # Timeout settings
        proxy_connect_timeout 60s;
        proxy_send_timeout 60s;
        proxy_read_timeout 60s;
    }
    
    # Uploads
    location /uploads {
        proxy_pass http://localhost:5000;
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
    }
}
EOF
    print_status "Nginx configuration template created ✓"
}

# Create systemd service file
create_systemd_service() {
    print_status "Creating systemd service file..."
    cat > boibabu.service << EOF
[Unit]
Description=BoiBabu Bookstore Application
After=network.target

[Service]
Type=forking
User=www-data
WorkingDirectory=$(pwd)
ExecStart=/usr/bin/pm2 start ecosystem.config.js --env production
ExecReload=/usr/bin/pm2 reload ecosystem.config.js --env production
ExecStop=/usr/bin/pm2 stop ecosystem.config.js
Restart=always
RestartSec=10

[Install]
WantedBy=multi-user.target
EOF
    print_status "Systemd service file created ✓"
}

# Main deployment function
main() {
    print_status "Starting BoiBabu production deployment..."
    
    # Run all deployment steps
    check_env_vars
    install_dependencies
    build_frontend
    run_tests
    create_directories
    set_permissions
    create_pm2_config
    create_nginx_config
    create_systemd_service
    
    print_status "🎉 Deployment preparation completed successfully!"
    echo ""
    print_status "Next steps:"
    echo "1. Copy nginx.conf to /etc/nginx/sites-available/boibabu"
    echo "2. Create symbolic link: sudo ln -s /etc/nginx/sites-available/boibabu /etc/nginx/sites-enabled/"
    echo "3. Test nginx config: sudo nginx -t"
    echo "4. Reload nginx: sudo systemctl reload nginx"
    echo "5. Copy boibabu.service to /etc/systemd/system/"
    echo "6. Enable service: sudo systemctl enable boibabu"
    echo "7. Start service: sudo systemctl start boibabu"
    echo "8. Check status: sudo systemctl status boibabu"
    echo ""
    print_status "Your BoiBabu application is ready for production! 🚀"
}

# Run main function
main