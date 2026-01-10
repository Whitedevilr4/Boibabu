#!/bin/bash

echo "🚀 Starting BoiBabu Application..."

# Check if Node.js is installed
if ! command -v node &> /dev/null; then
    echo "❌ Node.js is not installed. Please install Node.js first."
    exit 1
fi

# Check if npm is installed
if ! command -v npm &> /dev/null; then
    echo "❌ npm is not installed. Please install npm first."
    exit 1
fi

echo "📦 Installing dependencies..."

# Install root dependencies
npm install

# Install backend dependencies
echo "📦 Installing backend dependencies..."
cd backend
npm install
cd ..

# Install frontend dependencies
echo "📦 Installing frontend dependencies..."
cd frontend
npm install
cd ..

echo "✅ Dependencies installed successfully!"

# Create uploads directory for local file storage
mkdir -p backend/uploads/books

echo "📁 Created uploads directory for images"

# Check if .env file exists
if [ ! -f "backend/.env" ]; then
    echo "⚠️  Creating .env file from template..."
    cp backend/.env.example backend/.env
    echo "📝 Please update backend/.env with your MongoDB connection string"
fi

echo "🎉 Setup complete!"
echo ""
echo "🔧 Available commands:"
echo "   npm run dev         (starts both frontend and backend)"
echo "   npm run seed        (seeds database with sample data)"
echo ""
echo "🌐 Application URLs:"
echo "   Frontend: http://localhost:3000"
echo "   Backend:  http://localhost:5000"
echo "   Admin:    http://localhost:3000/admin"
echo ""
echo "📋 Don't forget to:"
echo "   1. Update backend/.env with your MongoDB Atlas connection string"
echo "   2. Run 'npm run seed' to add sample books and admin user"
echo "   3. Admin credentials: admin@boibabu.com / admin123"
echo ""

# Ask what to do next
echo "What would you like to do?"
echo "1) Start the application"
echo "2) Seed database with sample data"
echo "3) Exit"
read -p "Choose an option (1-3): " choice

case $choice in
    1)
        echo "🚀 Starting application..."
        npm run dev
        ;;
    2)
        echo "🌱 Seeding database..."
        cd backend && npm run seed && cd ..
        echo "✅ Database seeded! Now starting application..."
        npm run dev
        ;;
    3)
        echo "👋 Run the commands manually when you're ready!"
        ;;
    *)
        echo "Invalid option. Run the script again."
        ;;
esac