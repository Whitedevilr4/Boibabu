@echo off
echo 🚀 Starting BoiBabu Application...

REM Check if Node.js is installed
node --version >nul 2>&1
if %errorlevel% neq 0 (
    echo ❌ Node.js is not installed. Please install Node.js first.
    pause
    exit /b 1
)

REM Check if npm is installed
npm --version >nul 2>&1
if %errorlevel% neq 0 (
    echo ❌ npm is not installed. Please install npm first.
    pause
    exit /b 1
)

echo 📦 Installing dependencies...

REM Install root dependencies
npm install

REM Install backend dependencies
echo 📦 Installing backend dependencies...
cd backend
npm install
cd ..

REM Install frontend dependencies
echo 📦 Installing frontend dependencies...
cd frontend
npm install
cd ..

echo ✅ Dependencies installed successfully!

REM Create uploads directory for local file storage
if not exist "backend\uploads\books" (
    mkdir backend\uploads\books
    echo 📁 Created uploads directory for images
)

REM Check if .env file exists
if not exist "backend\.env" (
    echo ⚠️  Creating .env file from template...
    copy "backend\.env.example" "backend\.env"
    echo 📝 Please update backend\.env with your MongoDB connection string
)

echo 🎉 Setup complete!
echo.
echo 🔧 Available commands:
echo    npm run dev         (starts both frontend and backend)
echo    npm run seed        (seeds database with sample data)
echo.
echo 🌐 Application URLs:
echo    Frontend: http://localhost:3000
echo    Backend:  http://localhost:5000
echo    Admin:    http://localhost:3000/admin
echo.
echo 📋 Don't forget to:
echo    1. Update backend\.env with your MongoDB Atlas connection string
echo    2. Run 'npm run seed' to add sample books and admin user
echo    3. Admin credentials: admin@boibabu.com / admin123
echo.

echo What would you like to do?
echo 1) Start the application
echo 2) Seed database with sample data
echo 3) Exit
set /p choice="Choose an option (1-3): "

if "%choice%"=="1" (
    echo 🚀 Starting application...
    npm run dev
) else if "%choice%"=="2" (
    echo 🌱 Seeding database...
    cd backend && npm run seed && cd ..
    echo ✅ Database seeded! Now starting application...
    npm run dev
) else if "%choice%"=="3" (
    echo 👋 Run the commands manually when you're ready!
) else (
    echo Invalid option. Run the script again.
)

pause