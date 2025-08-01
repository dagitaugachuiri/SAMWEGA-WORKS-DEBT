# SMS Forwarder

A React Native Android app that reads SMS messages and forwards them to configurable HTTP endpoints.

## Features

- 📱 Read SMS messages from Android device (mock data for testing)
- 🔄 Forward messages to multiple HTTP endpoints
- ⚙️ Configurable sync intervals
- 🔒 HTTPS-only endpoint validation
- 📊 Real-time status monitoring
- 🔄 Manual and automatic sync
- 💾 Persistent configuration storage
- 🧪 Mock SMS data for testing forwarding functionality

## Prerequisites

Before setting up the project, ensure you have the following installed:

- **Node.js** (v16 or higher)
- **Java Development Kit (JDK)** 11 or higher
- **Android Studio** or Android SDK
- **React Native CLI**
- **Physical Android device** (required for SMS testing)

## Installation

### 1. Install React Native CLI

```bash
npm install -g @react-native-community/cli
```

### 2. Clone and Setup Project

```bash
# Navigate to project directory
cd sms-forwarder

# Install dependencies
npm install

# For Android development
cd android
./gradlew clean
cd ..
```

### 3. Android Development Environment Setup

#### Option A: Using Android Studio (Recommended)

1. Download and install [Android Studio](https://developer.android.com/studio)
2. Install Android SDK (API level 21 or higher)
3. Set up Android Virtual Device (AVD) or connect physical device
4. Set environment variables:
   ```bash
   export ANDROID_HOME=$HOME/Library/Android/sdk
   export PATH=$PATH:$ANDROID_HOME/emulator
   export PATH=$PATH:$ANDROID_HOME/tools
   export PATH=$PATH:$ANDROID_HOME/tools/bin
   export PATH=$PATH:$ANDROID_HOME/platform-tools
   ```

#### Option B: Using Command Line Tools Only

1. Download [Android SDK Command Line Tools](https://developer.android.com/studio#command-tools)
2. Install required SDK packages:
   ```bash
   sdkmanager "platform-tools" "platforms;android-33" "build-tools;33.0.0"
   ```

### 4. Physical Device Setup

1. Enable Developer Options on your Android device:
   - Go to Settings > About Phone
   - Tap "Build Number" 7 times
   
2. Enable USB Debugging:
   - Go to Settings > Developer Options
   - Enable "USB Debugging"
   
3. Connect device via USB and authorize debugging

4. Verify device connection:
   ```bash
   adb devices
   ```

## Running the App

### Development Mode

```bash
# Start Metro bundler
npm start

# In a new terminal, run on Android
npm run android
```

### Building APK

```bash
# Build debug APK
npm run build:android-debug

# Build release APK
npm run build:android
```

The APK will be generated at: `android/app/build/outputs/apk/debug/app-debug.apk`

## Usage

### 1. Grant Permissions

On first launch, the app will request SMS reading permissions. Grant the required permissions for the app to function.

### 2. Configure Endpoints

1. Add HTTPS endpoint URLs in the "Endpoints" section
2. Test connectivity using the "Test" button
3. Remove endpoints using the "Remove" button

### 3. Monitor Status

- View sync status in the header
- Check last sync time and message count
- Monitor endpoint status indicators

### 4. Manual Sync

Use the "Manual Sync" button to immediately forward new messages to configured endpoints.

## Testing

### Mock Endpoint Setup

1. Visit [webhook.site](https://webhook.site)
2. Copy the unique URL provided
3. Add it as an endpoint in the app
4. Send test SMS messages to your device
5. Check webhook.site to see forwarded messages

### SMS Simulation (ADB)

```bash
# Send test SMS via ADB
adb shell am start -a android.intent.action.SENDTO -d sms:+1234567890 --es sms_body "Test message"
```

### Permission Testing

```bash
# Check if permissions are granted
adb shell dumpsys package com.smsforwarder | grep permission

# Grant permissions manually (if needed)
adb shell pm grant com.smsforwarder android.permission.READ_SMS
adb shell pm grant com.smsforwarder android.permission.RECEIVE_SMS
```

## API Format

The app sends POST requests to configured endpoints with the following JSON format:

```json
{
  "messages": [
    {
      "address": "+1234567890",
      "body": "Message content",
      "timestamp": "2025-07-31T10:30:00.000Z"
    }
  ],
  "sync_time": "2025-07-31T10:30:00.000Z"
}
```

## Configuration

### Sync Interval

The default sync interval is 60 seconds. This can be modified in the app settings.

### Storage

The app uses AsyncStorage to persist:
- Configured endpoint URLs
- Last sync timestamp
- App settings

## Troubleshooting

### Common Issues

#### 1. Permission Denied
```
Error: Permission denied for SMS access
```
**Solution**: Grant SMS permissions in device settings or reinstall the app.

#### 2. Build Failures
```
Error: Could not resolve dependencies
```
**Solution**: 
```bash
cd android
./gradlew clean
cd ..
npm install
```

#### 3. Metro Bundler Issues
```
Error: Metro bundler not starting
```
**Solution**:
```bash
npx react-native start --reset-cache
```

#### 4. Device Not Detected
```
Error: No devices found
```
**Solution**:
```bash
adb kill-server
adb start-server
adb devices
```

#### 5. SMS Reading Issues
```
Error: Failed to load SMS
```
**Solution**: 
- Ensure device has SMS messages
- Check if SMS app is set as default
- Verify permissions are granted

### Debug Mode

Enable debug logging by checking the browser console or using:
```bash
adb logcat | grep ReactNativeJS
```

## Security Considerations

- Only HTTPS endpoints are allowed
- SMS content is not stored long-term
- Permissions are requested at runtime
- Input validation is implemented

## Production Deployment

### Google Play Store Compliance

⚠️ **Important**: SMS reading apps may face restrictions on Google Play Store. Consider:

1. Clear privacy policy
2. Transparent data usage
3. User consent mechanisms
4. Alternative distribution methods

### APK Signing

For production release:

1. Generate keystore:
   ```bash
   keytool -genkey -v -keystore my-release-key.keystore -alias my-key-alias -keyalg RSA -keysize 2048 -validity 10000
   ```

2. Configure signing in `android/app/build.gradle`

3. Build signed APK:
   ```bash
   cd android
   ./gradlew assembleRelease
   ```

## Performance Optimization

- Messages are limited to 100 recent items
- Sync only sends new messages since last sync
- Network timeouts set to 10 seconds
- Background sync uses efficient intervals

## Contributing

1. Fork the repository
2. Create feature branch
3. Make changes
4. Test thoroughly
5. Submit pull request

## License

This project is for educational and development purposes. Ensure compliance with local laws and regulations regarding SMS access and data privacy.

## Support

For issues and questions:
1. Check troubleshooting section
2. Review Android logs
3. Test with mock endpoints
4. Verify device compatibility

---

**Note**: This app currently uses mock SMS data for testing. For real SMS functionality, see [SMS_LIBRARY_NOTE.md](SMS_LIBRARY_NOTE.md) for integration instructions. 