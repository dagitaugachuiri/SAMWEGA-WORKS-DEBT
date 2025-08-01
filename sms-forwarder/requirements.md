# React Native CLI SMS Forwarder App Development Prompt

I need you to help me create a React Native app for Android using React Native CLI (NOT Expo) that reads SMS messages and forwards them to configurable endpoints. The app must have native SMS reading capabilities and work on physical Android devices. Current date: July 31, 2025.

## Project Requirements

### Core Setup and Dependencies
- Use React Native CLI for project initialization (react-native init SMSForwarder)
- Target Android platform only (no iOS requirements)
- Use the latest stable React Native version compatible with SMS reading libraries
- Include all necessary native dependencies and linking configurations

### SMS Reading Functionality
- Read SMS messages from device including: sender phone number (address), message body, and timestamp
- Use `react-native-sms-android` or equivalent native module for SMS access
- Request SMS permissions at runtime: READ_SMS and RECEIVE_SMS
- Display clear permission request dialogs with explanations
- Handle permission denials gracefully with retry options
- Fetch and display SMS messages in chronological order (newest first)

### Message Forwarding System
- Forward SMS messages to multiple configurable HTTP endpoints via POST requests
- JSON payload format: `{ "messages": [{"address": "string", "body": "string", "timestamp": "ISO string"}], "sync_time": "ISO string" }`
- Send only NEW messages since last successful sync (track last sync timestamp)
- Configurable sync interval (default 60 seconds, allow user modification)
- Manual sync trigger button
- Retry failed requests with exponential backoff
- Support multiple endpoints simultaneously with individual success/failure tracking

### User Interface Requirements
- Clean, modern design with proper Android Material Design components
- Header with app title "SMS Forwarder" and current status
- Permission request section (show only when permissions not granted)
- Endpoint management section:
  - Text input for adding new endpoint URLs
  - Validation for proper URL format (https required)
  - List of configured endpoints with individual remove buttons
  - Test connectivity button for each endpoint
- SMS messages display:
  - FlatList with sender, message body (truncated), and timestamp
  - Message count indicator
  - Pull-to-refresh functionality
  - Loading states and error handling
- Status section showing:
  - Last sync time
  - Number of messages sent
  - Success/failure count per endpoint
  - Current sync status (idle, syncing, error)

### Data Persistence
- Use AsyncStorage for:
  - Configured endpoint URLs
  - Last sync timestamp
  - App settings (sync interval, etc.)
  - Basic message metadata (avoid storing actual SMS content long-term)
- Implement data migration for app updates

### Android-Specific Configurations
- Proper AndroidManifest.xml permissions setup
- Handle Android 6.0+ runtime permissions correctly
- Optimize for different Android versions and screen sizes
- Proper app icons and splash screen
- Handle app backgrounding and foregrounding correctly

### Error Handling and Logging
- Comprehensive error handling for all operations
- User-friendly error messages with actionable advice
- Console logging for debugging (removable for production)
- Network timeout handling (10 second timeout for HTTP requests)
- SMS reading failure fallbacks

### Security and Privacy Considerations
- Validate all endpoint URLs (must be HTTPS)
- Basic input sanitization
- Clear privacy notices about SMS access
- Option to exclude certain SMS types or senders (future enhancement hook)

## Technical Specifications

### Required Dependencies
```json
{
  "@react-native-async-storage/async-storage": "latest stable",
  "react-native-sms-android": "latest stable", 
  "axios": "latest stable",
  "react-native-permissions": "latest stable"
}
```

### Android Permissions (AndroidManifest.xml)
```xml
<uses-permission android:name="android.permission.READ_SMS" />
<uses-permission android:name="android.permission.RECEIVE_SMS" />
<uses-permission android:name="android.permission.INTERNET" />
```

### Project Structure
- Single App.js file with all functionality (for simplicity)
- Proper component organization with clear separation of concerns
- Styled components using StyleSheet with consistent theming
- Comments explaining all major functions and complex logic

## Development Environment Setup Instructions
Provide complete setup instructions including:
1. React Native CLI installation
2. Android development environment setup (Android Studio alternatives if possible)
3. Physical device connection and debugging setup
4. Dependency installation and linking commands
5. Build and run commands
6. Troubleshooting common issues

## Testing Requirements
- Instructions for testing on physical Android devices
- Mock endpoint setup for testing (webhook.site integration)
- Permission testing scenarios
- SMS simulation for testing (using ADB commands)
- Build APK generation instructions

## Production Considerations
- Google Play Store SMS policy compliance notes
- APK optimization and signing instructions
- Performance considerations for large SMS databases
- Memory usage optimization
- Battery usage optimization for background operations

## Deliverables Required
1. Complete App.js file with full functionality
2. package.json with all dependencies
3. AndroidManifest.xml configuration
4. Complete setup and run instructions
5. Build and deployment guide
6. Testing methodology and troubleshooting guide

## Constraints and Limitations
- Must work without Expo or any Expo dependencies
- Focus on Android only (no iOS code needed)
- Prioritize functionality over visual polish
- Must handle SMS reading permissions properly
- Should work on Android 7.0+ devices
- No cloud services dependencies (local operation only)

## Additional Features (Nice to Have)
- Dark mode support
- Message filtering by sender or keywords
- Export SMS data functionality
- Backup/restore endpoint configurations
- Real-time SMS listening (broadcast receiver)
- Custom sync intervals per endpoint

Please provide a complete, working solution that I can immediately set up and run on a physical Android device. Include all necessary configuration files, detailed setup instructions, and troubleshooting tips for common issues.

## Expected Output Format
- Complete React Native CLI project structure
- Step-by-step setup commands
- All configuration files
- Testing instructions
- Deployment guidelines

Focus on creating a robust, production-ready app that handles edge cases gracefully and provides a smooth user experience for SMS forwarding functionality.