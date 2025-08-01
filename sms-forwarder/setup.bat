@echo off
echo 🚀 Setting up SMS Forwarder React Native project...

REM Check if Node.js is installed
node --version >nul 2>&1
if %errorlevel% neq 0 (
    echo ❌ Node.js is not installed. Please install Node.js v16 or higher.
    pause
    exit /b 1
)

REM Check Node.js version
for /f "tokens=1,2,3 delims=." %%a in ('node --version') do set NODE_VERSION=%%a
set NODE_VERSION=%NODE_VERSION:~1%
if %NODE_VERSION% LSS 16 (
    echo ❌ Node.js version 16 or higher is required. Current version: 
    node --version
    pause
    exit /b 1
)

echo ✅ Node.js version: 
node --version

REM Check if React Native CLI is installed
react-native --version >nul 2>&1
if %errorlevel% neq 0 (
    echo 📦 Installing React Native CLI...
    npm install -g @react-native-community/cli
)

echo ✅ React Native CLI installed

REM Install dependencies
echo 📦 Installing project dependencies...
npm install

REM Check if Android SDK is available
if "%ANDROID_HOME%"=="" (
    echo ⚠️  ANDROID_HOME environment variable is not set.
    echo Please set it to your Android SDK location:
    echo set ANDROID_HOME=C:\path\to\your\android\sdk
    echo.
)

REM Check if adb is available
adb version >nul 2>&1
if %errorlevel% equ 0 (
    echo ✅ ADB is available
    echo 📱 Connected devices:
    adb devices
) else (
    echo ⚠️  ADB not found. Please install Android SDK Platform Tools.
)

REM Clean Android build
echo 🧹 Cleaning Android build...
cd android
call gradlew clean
cd ..

echo.
echo 🎉 Setup complete!
echo.
echo Next steps:
echo 1. Connect your Android device via USB
echo 2. Enable USB debugging on your device
echo 3. Run: npm start
echo 4. In another terminal, run: npm run android
echo.
echo For testing:
echo - Visit webhook.site to get a test endpoint
echo - Add the endpoint URL to the app
echo - Send SMS messages to your device
echo.
echo 📖 See README.md for detailed instructions
pause 