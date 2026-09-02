# SCS Play Build Guide

## Requirements

- Node.js 22 or newer (required by Capacitor 8).
- npm.
- JDK 21 and Android Studio for Android builds. Capacitor's generated Android configuration compiles for Java 21.
- Android SDK Platform 36 and compatible SDK Build Tools. The project compiles against and targets SDK 36.

## Web Build

```bash
npm ci
npm run build:prod
```

`build:prod` bundles `js/app.js` and `css/style.css` into `docs/js/app.bundle.js` and `docs/css/style.bundle.css`. It also copies root assets, images, audio metadata, legal pages, and store listing docs into `docs/`.

The build script enforces default budgets:

- JavaScript bundle: 480 KB max.
- CSS bundle: 240 KB max.

## Full Local Gate

```bash
npm run verify
```

This runs:

1. Knip static dependency and export checks.
2. Game and audio logic regression tests.
3. Static WCAG token/theme contrast audit.
4. Production web build.
5. Playwright DOM contrast audit against rendered screens.
6. Playwright smoke test for the core game flow.

The Playwright scripts start a local static server for `docs/` automatically. To target an external deployment instead, pass `SCS_BASE`:

```powershell
$env:SCS_BASE="https://example.com/scs-play/"
npm run smoke-test
```

## Android Build

`npm run cap:sync` is mandatory before every Android debug or release build. It runs the production web build and then copies the current `docs/` output and Capacitor configuration into the Android project. Running Gradle without this step can package stale web assets.

```powershell
npm ci
npm run cap:sync
cd android
.\gradlew.bat assembleDebug
```

Debug APK:

```text
android/app/build/outputs/apk/debug/app-debug.apk
```

## Google Play Release

Google Play requires an Android App Bundle (AAB) signed with the app's upload key. Before the first release:

1. Create the app in Play Console with package name `com.scs.play`.
2. Enroll in Play App Signing and create or securely obtain the upload keystore, key alias, and passwords. Back them up outside the repository.
3. Complete the Play Console store listing, privacy-policy URL, Data safety form, content rating, target-audience declaration, and app-access declaration.
4. Confirm `versionCode` is unique and increasing and that `versionName` is intentional in `android/app/build.gradle`.
5. Install JDK 21 and Android SDK Platform 36, and confirm Android Studio and Gradle use JDK 21.
6. Run the full local gate, followed by the mandatory sync:

```powershell
npm ci
npm run verify
npm run cap:sync
```

The release build reads signing credentials from Gradle properties or environment variables. Keep all values and the keystore outside source control:

```powershell
$env:SCS_RELEASE_STORE_FILE="C:\secure\scs-upload.jks"
$env:SCS_RELEASE_STORE_PASSWORD="..."
$env:SCS_RELEASE_KEY_ALIAS="scs-upload"
$env:SCS_RELEASE_KEY_PASSWORD="..."
```

With all four values set, `bundleRelease` creates a signed AAB. Without them it creates an unsigned artifact for local checks. Android Studio's **Build > Generate Signed Bundle / APK** remains a supported alternative.

For a local unsigned release artifact check after `cap:sync`:

```powershell
cd android
.\gradlew.bat bundleRelease
```

Release bundle output:

```text
android/app/build/outputs/bundle/release/app-release.aab
```

Do not upload it until its signature has been verified. For the signed bundle, run `jarsigner -verify -verbose -certs android/app/build/outputs/bundle/release/app-release.aab` and require successful verification before submission.

## Android Studio

```bash
npm run cap:open
```

## Release Checklist

1. `npm run verify` passes locally.
2. `npm run cap:sync` is run after the final source change and before the final AAB build.
3. The AAB is signed with the upload key and its signature is verified.
4. No secrets, keystores, signing properties, or generated APK/AAB files are staged.
5. Generated `docs/` diffs are expected and come from `npm run build:prod`.
6. `versionCode` and `versionName` are intentionally updated for the release.
7. Play Console declarations match the shipped build: no ads, no real-money in-app purchases, guest-only accounts, and locally stored gameplay data.
8. The ten-mode top-level store catalog and all submitted screenshots match the release build.
9. GitHub Actions is green before store submission.
