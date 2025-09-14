#!/bin/bash

echo "🚀 Starting OCR Pro React Application"
echo "====================================="
echo ""

cd "$(dirname "$0")"

# Check if node_modules exists
if [ ! -d "node_modules" ]; then
    echo "📦 Dependencies not installed. Running npm install..."
    npm install
fi

# Check if .env exists
if [ ! -f .env ]; then
    echo "⚠️  No .env file found. Creating from template..."
    cp .env.example .env
    echo "📝 Please add your Gemini API key to the .env file"
fi

echo ""
echo "🌟 Starting development server..."
npm run dev
