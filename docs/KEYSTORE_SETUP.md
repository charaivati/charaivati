# Android Release Keystore Setup

## One-time keystore generation
Run this once. Store the .jks file somewhere safe —
losing it means you cannot update the Play Store listing.

```bash
keytool -genkey -v \
  -keystore android/charaivati-release.jks \
  -alias charaivati \
  -keyalg RSA \
  -keysize 2048 \
  -validity 10000
```

You will be prompted for:
- Keystore password (remember this)
- Key password (can be same as keystore password)
- Name, org, city, state, country

## Configure local.properties
Add to android/local.properties (this file is gitignored):
```
KEYSTORE_PATH=charaivati-release.jks
KEYSTORE_PASSWORD=your_keystore_password
KEY_ALIAS=charaivati
KEY_PASSWORD=your_key_password
```

## Build signed APK
```bash
npx cap sync android
cd android && ./gradlew assembleRelease
```

Output: android/app/build/outputs/apk/release/app-release.apk
This APK is signed and ready to install or submit to Play Store.

## Share for direct install (bypass Play Store)
1. Share app-release.apk via WhatsApp/Drive/email
2. Recipient: Settings → Install unknown apps → Allow
3. Tap APK to install

## Play Store submission (when ready)
Use bundleRelease instead of assembleRelease for AAB format:
```bash
cd android && ./gradlew bundleRelease
```
Output: android/app/build/outputs/bundle/release/app-release.aab

## CRITICAL — Backup the keystore
Back up these three things somewhere outside the project:
- android/charaivati-release.jks
- The keystore password
- The key alias and key password

Suggested: store in a password manager + Google Drive
private folder. Never commit to git.
