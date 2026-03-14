# SCS Play — APK Build Guide

## Prerequisites
- **Node.js** 18+ and **npm**
- **Java 17** (JDK)
- **Android Studio** with SDK 34+ installed
- Set `ANDROID_HOME` environment variable

## Quick Build

```bash
# 1. Install dependencies
npm install

# 2. Build web assets + sync to Android
npm run build
npm run cap:sync

# 3. Build debug APK
cd android
./gradlew assembleDebug
# APK: android/app/build/outputs/apk/debug/app-debug.apk

# 4. Build release APK (unsigned)
./gradlew assembleRelease
# APK: android/app/build/outputs/apk/release/app-release-unsigned.apk
```

## Sign Release APK

```bash
# Generate keystore (once)
keytool -genkey -v -keystore scs-play.keystore -alias scs-play -keyalg RSA -keysize 2048 -validity 10000

# Sign
jarsigner -verbose -sigalg SHA256withRSA -digestalg SHA-256 -keystore scs-play.keystore android/app/build/outputs/apk/release/app-release-unsigned.apk scs-play

# Align
zipalign -v 4 android/app/build/outputs/apk/release/app-release-unsigned.apk scs-play-release.apk
```

## Open in Android Studio

```bash
npm run cap:open
```

## App Details
- **Package**: `com.scs.play`
- **Min SDK**: 22 (Android 5.1)
- **Target SDK**: 35
- **App Name**: SCS Play
