# Android shell

This is a native Android WebView shell for the AeroSense responsive web application.

1. Deploy the Node/HTML application behind HTTPS.
2. Replace `webUrl` in `MainActivity.kt` with the deployed HTTPS URL.
3. Open `android/` in Android Studio.
4. Sync Gradle and build the APK.

For local development, an Android emulator cannot use `localhost` in the same way as the desktop browser; use `10.0.2.2:3000` for the host machine, and allow cleartext traffic only for development if needed. Production should use HTTPS.
