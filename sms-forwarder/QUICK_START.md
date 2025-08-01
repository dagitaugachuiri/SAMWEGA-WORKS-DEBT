# 🚀 Quick Start Guide

Get your SMS Forwarder app running in 5 minutes!

## Prerequisites Checklist

- [ ] Node.js v16+ installed
- [ ] Android device connected via USB
- [ ] USB debugging enabled on device
- [ ] Android SDK installed (or Android Studio)

## Step 1: Setup Project

```bash
# Install dependencies
npm install

# Run setup script (if on Linux/Mac)
chmod +x setup.sh
./setup.sh
```

## Step 2: Start Development Server

```bash
# Start Metro bundler
npm start
```

## Step 3: Run on Device

In a new terminal:
```bash
# Install and run on Android device
npm run android
```

## Step 4: Grant Permissions

1. Open the app on your device
2. Tap "Grant Permission" when prompted
3. Allow SMS reading permissions

## Step 5: Test with Mock Server

```bash
# Start test server (in new terminal)
node test-endpoint.js
```

1. Copy the URL shown (e.g., `http://localhost:3000`)
2. Add it as an endpoint in the app
3. Send SMS to your device
4. Check the test server webpage to see forwarded messages

## Step 6: Test with Real Endpoint

1. Visit [webhook.site](https://webhook.site)
2. Copy the unique URL
3. Add it to your app
4. Send test SMS messages

## Troubleshooting

### Device Not Found
```bash
adb devices
# If empty, check USB debugging is enabled
```

### Build Errors
```bash
cd android
./gradlew clean
cd ..
npm install
```

### Permission Issues
```bash
# Grant permissions manually
adb shell pm grant com.smsforwarder android.permission.READ_SMS
adb shell pm grant com.smsforwarder android.permission.RECEIVE_SMS
```

## Next Steps

- Read the full [README.md](README.md) for detailed instructions
- Check [requirements.md](requirements.md) for feature specifications
- Customize the app for your needs

## Support

- Check the troubleshooting section in README.md
- Use the test server for debugging
- Verify all permissions are granted

---

**Happy SMS Forwarding! 📱➡️🌐** 