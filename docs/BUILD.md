# SCS Play Build Guide

## Requirements

- Node.js 20 for CI parity. Node 18+ also works for most local tasks.
- npm.
- Java 17 and Android Studio for Android builds.
- Android SDK with target SDK 35 installed.

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

1. Static WCAG token/theme contrast audit.
2. Production web build.
3. Playwright DOM contrast audit against rendered screens.
4. Playwright smoke test for the core game flow.

The Playwright scripts start a local static server for `docs/` automatically. To target an external deployment instead, pass `SCS_BASE`:

```powershell
$env:SCS_BASE="https://example.com/scs-play/"
npm run smoke-test
```

## Android Build

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

Release APK/AAB signing must use a private keystore that is never committed.

```powershell
cd android
.\gradlew.bat assembleRelease
```

Unsigned release APK:

```text
android/app/build/outputs/apk/release/app-release-unsigned.apk
```

## Android Studio

```bash
npm run cap:open
```

## Release Checklist

1. `npm run verify` passes locally.
2. No secrets or signing files are staged.
3. Generated `docs/` diffs are expected and come from `npm run build:prod`.
4. Android version metadata is intentionally updated when releasing native builds.
5. GitHub Actions is green on the pushed branch before collaborator access or store submission.