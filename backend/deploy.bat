@echo off
echo Starting BoiBabu Production Deployment...

REM Check if Node.js is installed
node --version >nul 2>&1
if errorlevel 1 (
    echo ERROR: Node.js is not installed or not in PATH
    exit /b 1
)

REM Check if npm is installed
npm --version >nul 2>&1
if errorlevel 1 (
    echo ERROR: npm is not installed or not in PATH
    exit /b 1
)

echo Installing backend dependencies...
cd backend
call npm ci --only=production
if errorlevel 1 (
    echo ERROR: Failed to install backend dependencies
    exit /b 1
)
cd ..

echo Installing frontend dependencies...
cd frontend
call npm ci
if errorlevel 1 (
    echo ERROR: Failed to install frontend dependencies
    exit /b 1
)

echo Building frontend for production...
call npm run build
if errorlevel 1 (
    echo ERROR: Frontend build failed
    exit /b 1
)
cd ..

echo Creating production directories...
if not exist "logs" mkdir logs
if not exist "backend\uploads" mkdir backend\uploads
if not exist "backend\uploads\books" mkdir backend\uploads\books
if not exist "backend\uploads\users" mkdir backend\uploads\users
if not exist "backend\uploads\hero-slides" mkdir backend\uploads\hero-slides
if not exist "backend\uploads\publisher-ads" mkdir backend\uploads\publisher-ads

echo Deployment preparation completed successfully!
echo.
echo Next steps for Windows deployment:
echo 1. Install PM2 globally: npm install -g pm2
echo 2. Install PM2 Windows service: npm install -g pm2-windows-service
echo 3. Set up PM2 service: pm2-service-install
echo 4. Start the application: pm2 start ecosystem.config.js --env production
echo 5. Save PM2 configuration: pm2 save
echo.
echo Your BoiBabu application is ready for production!
pause