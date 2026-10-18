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
- CSS bundle: 255 KB max.

## Full Local Gate

```bash
npm run verify
```

This runs:

1. Knip static dependency and export checks.
2. Game, audio, service worker and effects regression tests, plus deterministic performance resource/lifecycle limits.
3. Static WCAG token/theme contrast audit.
4. Production web build.
5. Playwright PWA release checks for cached music, HTTP byte ranges, and offline loading.
6. Playwright first-round reward and existing-save migration checks.
7. Playwright DOM contrast audit against rendered screens.
8. Playwright presentation checks: ten mode layouts on phone/desktop, catalog navigation, theme surfaces, full-size form controls, motion preferences, local answer feedback and results.
9. Playwright smoke test for the core game flow; browser console errors fail the gate.

The Playwright scripts start a local static server for `docs/` automatically. To target an external deployment instead, pass `SCS_BASE`:

```powershell
$env:SCS_BASE="https://example.com/scs-play/"
npm run smoke-test
```

## Performance Checks

Run measurements serially on an otherwise quiet machine, after building. Use the Node command directly so shells/npm cannot drop benchmark flags:

```powershell
node scripts/perf-benchmark.mjs --mode=klassik --play=classic --cpu=4 --seconds=30 --reaction=150 --tier=mid --seed=1337 --json=perf-mid.json
```

Use the same viewport, CPU rate, input, seed, duration and pinned tier for comparisons. Repeat runs and compare medians, including p95 frame time and long-task time rather than FPS alone. `--root=<built-directory>` can compare an archived build; `--input=tap` covers the tap path. JSON includes steady-state frames after the warmup, connected DOM nodes, active animations and trail allocation. The seed makes a given build repeatable; decorative randomness can change the precise stimulus sequence between builds.

`--trace=trace.json` is diagnostic and adds overhead; do not compare traced measurements with untraced ones. Headless Chromium with CPU throttling does not simulate an Android GPU, thermals or battery use. Check those on physical devices before claiming a stable device frame rate. Performance JSON and traces are local diagnostics, not release assets.

The 2.5D performance pass was compared against its pre-optimization build in three alternating, untraced 30-second runs each: Farben / classic, 412×915 at DPR 2, 4× CPU throttling, 150 ms reaction, fixed `mid` tier, seed 1337. Medians:

| Metric | Before | After |
| --- | ---: | ---: |
| FPS | 37.1 | 41.8 |
| p95 frame time | 66.8 ms | 50.0 ms |
| Total long-task time | 8,011 ms | 4,845 ms |
| Trail backing pixels | 1,507,920 | 848,514 |

These are relative local measurements with visible run-to-run variance, not device targets or a 60 FPS guarantee. An additional retained/recolored-SVG experiment was slower and was not kept.

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
