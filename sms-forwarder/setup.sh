#!/bin/bash

# SMS Forwarder Setup Script
# This script sets up the React Native development environment

echo "🚀 Setting up SMS Forwarder React Native project..."

# Check if Node.js is installed
if ! command -v node &> /dev/null; then
    echo "❌ Node.js is not installed. Please install Node.js v16 or higher."
    exit 1
fi

# Check Node.js version
NODE_VERSION=$(node -v | cut -d'v' -f2 | cut -d'.' -f1)
if [ "$NODE_VERSION" -lt 16 ]; then
    echo "❌ Node.js version 16 or higher is required. Current version: $(node -v)"
    exit 1
fi

echo "✅ Node.js version: $(node -v)"

# Check if React Native CLI is installed
if ! command -v react-native &> /dev/null; then
    echo "📦 Installing React Native CLI..."
    npm install -g @react-native-community/cli
fi

echo "✅ React Native CLI installed"

# Install dependencies
echo "📦 Installing project dependencies..."
npm install

# Check if Android SDK is available
if [ -z "$ANDROID_HOME" ]; then
    echo "⚠️  ANDROID_HOME environment variable is not set."
    echo "Please set it to your Android SDK location:"
    echo "export ANDROID_HOME=/path/to/your/android/sdk"
    echo ""
    echo "For Windows, add to PATH:"
    echo "set ANDROID_HOME=C:\\path\\to\\your\\android\\sdk"
fi

# Check if adb is available
if command -v adb &> /dev/null; then
    echo "✅ ADB is available"
    echo "📱 Connected devices:"
    adb devices
else
    echo "⚠️  ADB not found. Please install Android SDK Platform Tools."
fi

# Clean Android build
echo "🧹 Cleaning Android build..."
cd android
./gradlew clean
cd ..

echo ""
echo "🎉 Setup complete!"
echo ""
echo "Next steps:"
echo "1. Connect your Android device via USB"
echo "2. Enable USB debugging on your device"
echo "3. Run: npm start"
echo "4. In another terminal, run: npm run android"
echo ""
echo "For testing:"
echo "- Visit webhook.site to get a test endpoint"
echo "- Add the endpoint URL to the app"
echo "- Send SMS messages to your device"
echo ""
echo "📖 See README.md for detailed instructions" 