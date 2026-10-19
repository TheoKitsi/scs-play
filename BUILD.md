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

`build:prod` bundles `js/app.js` and `css/style.css` into `docs/js/app.bundle.js` and `docs/css/style.bundle.css`. Standalone `js/legal.js` and `css/legal.css` are built separately for the scrollable bilingual legal documents. It also copies root assets, images, audio metadata, legal pages, and store listing docs into `docs/`.

The build script enforces default budgets:

- JavaScript bundle: 480 KB max.
- CSS bundle: 255 KB max.

## Full Local Gate

```bash
npm run verify
```

This runs:

1. Knip static dependency/export checks and branding asset consistency (web/native sources, raster dimensions/palette, adaptive safe zone).
2. Game, audio, feedback, service worker and effects regression tests, plus deterministic performance resource/lifecycle limits, Living Arena world/material/depth/phase checks and 100-answer phase-flow regressions.
3. Static WCAG token/theme contrast audit.
4. Production web build.
5. Playwright PWA release checks for cached music, HTTP byte ranges, offline loading and first-visit German/English legal URLs without a network connection.
6. Playwright first-round reward/existing-save migration checks, plus six naturally timed guest rounds covering genuine continuation, earned progression, records, awards, analysis and reload persistence without seeded progress or clock overrides.
7. Playwright DOM contrast audit against rendered screens.
8. Playwright source surface gallery on three sizes: actual navigation, purchase cancellation/confirmation, service-level restrictions, photo upload/removal/error, keyboard tutorial, reserve/round-life disclosure, result states, reduced-motion wheel, themes, notices, installation/landscape fixtures and legal languages. Uncommon populated/report/result states are seeded renderer fixtures, not simulated user achievements.
9. Playwright compiled presentation checks: ten mode worlds/layouts on phone/desktop, catalog navigation, theme surfaces, full-size form controls, persisted opt-in depth, native touch with fixed targets, motion preferences, local answer feedback and results.
10. Playwright flawless-streak checks through combo, Shuffle, Rush and cooldown, including first-frame stimulus visibility, footer/target separation, peripheral energy and one consolidated sound/haptic per answer.
11. Playwright smoke test for the core game flow; browser console errors fail the gate.

Release browser checks start a local static server for `docs/` automatically; isolated performance/material lifecycle and streak-presentation checks serve source fixtures instead. To target an external deployment with the smoke test, pass `SCS_BASE`:

```powershell
$env:SCS_BASE="https://example.com/scs-play/"
npm run smoke-test
```

`npm run visual-review` runs the asserted local-source surface gallery and captures screenshots in `%LOCALAPPDATA%/Temp/opencode/scs-surface-review`. `SCS_REVIEW_OUT` chooses another archive and `SCS_REVIEW_VIEW=phone|small|desktop` selects one viewport. The compiled `presentation-release-test` can also write the ten gameplay views to `SCS_REVIEW_OUT`. Unlike the old review script, neither path removes live overlays or forces screen classes to mask failed navigation. Cloud sign-in remains unconfigured and is not claimed as tested. Legal translations retain the original policy scope but still require human legal review before store publication.

`npm run brand:generate` refreshes `icon-192.svg`, store PNGs and the Android density-specific launcher/splash rasters from `img/icon-512.svg` and `feature-graphic.svg`. It preserves each splash's existing resolution. Native vector/adaptive/monochrome sources use the same four silhouettes inside the adaptive safe zone; `styles.xml` supplies a dark launch background and post-splash theme. The obsolete API-24 Android-robot drawable override is removed. `npm run brand-assets-test` checks source XML, palette pixels and dimensions across all raster variants and can archive a browser conversion of the native vector via `SCS_REVIEW_OUT`. This preview is not a screenshot of Android's launcher or a substitute for Android resource compilation and device tests. Run `cap:sync` before packaging these resources.

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

Living Arena keeps the same budgets: two light textures (at most 150×420 CSS pixels each) animate only with active, visible high-quality gameplay; mid is static and low omits them. Reading worlds keep the lights still. Answer impulses reuse one element, last 70 ms and are cancelled at the next spawn. Target springs animate SVG contents, not hit areas. Ten static world paths, diffed energy phases, exact material colors, unique local paint references, lifecycle cleanup and zero idle per-frame style writes are covered by the local gate. Optional depth is off by default and has one coalesced event-driven frame at most, no layout reads and ±4/3 px backdrop-only limits. It is disabled on mid/low or with reduced motion. Two (at most three) immediate short voices replace the previous overlapping answer arpeggios. No extra runtime dependency, canvas or game-engine delay is introduced.

Historical material/light-only measurements, before the ten-world/depth/feedback extension: the initial separate-rim-paint implementation stacked the lights on existing floating dots and was slower; it was replaced with a shared paint and lights instead of dots. That intermediate version was compared against `bae525f` in three serial, alternating 30-second runs per version using the same Farben/classic, 412×915/DPR 2, 4× CPU, 150 ms swipe reaction and seed 1337 settings, but pinned to `high`. Results after the 3-second warmup remained noisy:

| Metric | `bae525f` | Living Arena |
| --- | ---: | ---: |
| Median FPS (range) | 35.1 (30.7–50.4) | 36.6 (35.3–37.8) |
| Median p95 frame time | 66.7 ms | 66.7 ms |
| Median total long-task time | 5,925 ms | 7,454 ms |
| Connected nodes at first stimulus | 1,248 | 1,264 |

A single final `mid` pair measured 45.5 → 41.4 FPS, unchanged 50 ms p95 and 2,895 → 4,848 ms long-task time; that spot check is not a repeated comparison. These mixed measurements do **not** establish a performance improvement or the absence of a regression. Forced high quality still stalls under strong emulated load. Normal sessions retain automatic quality downgrades; physical Android profiling remains necessary. All benchmark runs were untraced and had zero page errors.

Historical complete-world extension, **before the surface-coherence pass**: the ten-world/energy/depth/feedback version was checked against `bae525f` in three paired `mid` runs, alternating which build ran first, with the same 30-second/3-second-warmup settings. Optional depth was off (the default). Medians were 49.7 → 46.7 FPS, 33.4 → 49.9 ms p95 and 1,492 → 2,655 ms total long-task time. FPS ranges overlapped (44.0–50.2 vs 46.5–52.8); the run-to-run spread remains material, but no performance gain or regression-free result is claimed. A single forced-`high` pair measured 47.2 → 44.0 FPS, 49.9 → 50.0 ms p95 and 3,162 → 5,031 ms long-task time. Both quality tiers retained their existing trail allocation, all eight runs had zero page errors and no inactive-screen animations, and that build stayed within the 480/255 KB JS/CSS limits. This presentation had a measured cost under emulated load; native-touch/depth bounds are checked separately by the deterministic gates, not presented as a physical Android FPS benchmark.

### Surface-coherence pass: final local checks (2026-10-19)

The full `npm run verify` gate passed after the shared-surface pass, including 188 source-gallery states across 360×640, 412×915 and 1440×900, all ten compiled gameplay layouts at each size, 129 static contrast checks, rendered contrast (including every wheel theme), offline bilingual legal navigation, the three 100-answer browser series and all 64 smoke checks. The final series measured at most 343 ms from accepted answer to painted successor. Engine rules, Rush/spawn scheduling, dependencies and the existing bundle budgets were not changed. The build reports **443.9 KB initial JS / 254.1 KB CSS**.

The CDP touch test now waits for an actually new stimulus ID after pause/resume, not merely a non-null snapshot of the already answered symbol. Presentation viewports run serially so touch devices and screenshot work do not compete with another live answer window. These are harness corrections, not extra gameplay waits. One earlier combined attempt stopped at `browserContext.newPage` with a closed-target error; the isolated streak test and the subsequent complete gate passed. No gameplay cause is inferred from that browser startup failure.

Native branding passed the 28-raster/source/safe-circle checks. After `cap:sync`, `:app:processDebugResources` compiled and linked the Android resources successfully with SDK 36. This is **not** a packaged APK/AAB or a physical-device visual check. Configured cloud login remains unavailable; populated report/record/result gallery states are explicitly seeded renderer fixtures. German legal translations retain the original English scope but need human legal review before store publication.

A fresh comparison used the archived production `bae525f` build and the frozen surface build: Farben/classic, 412×915 at DPR 2, 4× CPU throttle, 30 seconds with 3 seconds frame warmup, 150 ms synthetic swipe reaction, seed 1337, optional depth off, no trace. Three `mid` pairs alternated build order; the `high` pair is a single spot check. No UI/resource-compilation tests ran concurrently with these measurements.

| Metric | Production `bae525f` | Surface-coherence build |
| --- | ---: | ---: |
| Mid median FPS (range), 3 runs each | 52.2 (50.4–58.9) | 59.1 (51.7–59.4) |
| Mid median p95 frame time | 33.4 ms | 16.8 ms |
| Mid median total long-task time | 1,254 ms | 175 ms |
| High FPS, 1 run each | 36.0 | 43.7 |
| High p95 frame time | 66.7 ms | 50.0 ms |
| High total long-task time | 6,589 ms | 4,805 ms |
| Connected nodes at first stimulus (mid) | 1,246 | 1,603 |
| Mid / high trail backing pixels | 848,514 / 1,507,920 | 848,514 / 1,507,920 |

These medians are favorable but **not proof of a performance improvement or regression-free behavior**. The early runs were substantially faster than later runs, FPS ranges overlap, and the third mid pair worsened from 52.2 to 51.7 FPS and from 1,254 to 2,358 ms long-task time. The connected DOM is also larger. All eight runs had zero page errors and zero inactive-screen animations; quality stayed pinned, and the trail budgets stayed unchanged. Normal sessions still use the automatic quality governor. The emulated results do not certify Android GPU/battery/thermal behavior or stable 60 FPS.

The local archive is `%LOCALAPPDATA%/Temp/opencode/scs-surface-polish-20261019/`: `final/` contains the surface/mode/brand pictures, `build-final/` the frozen web build, and `comparison-summary.json` plus the eight JSON/log pairs record run order, metrics and bundle hashes. The published reference remains in the sibling `scs-living-arena-bae525f/baseline/` archive. No commit, push, Pages deployment or store submission is part of this local pass.

### Web-release closure and remaining external sign-offs

The continuation panel no longer advertises extra seconds when no reserve life is available, and it restores the description when a later round is eligible. Manual sharing shows only its copy dialog, without a duplicate notification underneath. The source-gallery regressions explicitly check both transitions and the absence of the duplicate toast.

The genuinely earned profile also exposed an accordion discovery issue: expanding one achievement category hid every other category header. Those headers now stay reachable while the existing exclusive-open body behavior is preserved; the earned-profile test navigates between milestones and precision awards to cover it.

`npm run earned-progress-release-test` serves the compiled build and plays six complete, normally timed rounds on a fresh guest profile: five Colors and one Shapes round, including one actual reserve-life extension. Inputs use the normal DOM controls; the only QA gameplay operation is a read-only snapshot. There are no assigned scores/rewards/dates/achievements, engine-end shortcuts or clock replacements. The test verifies earned score lists, the five-round award, profile levels, computed analysis and two reloads. This closes an automated earned-state coverage gap, not the separate human/device acceptance requirement. It takes roughly four additional minutes in `verify`.

The owner explicitly approved **web publication despite the outstanding physical-Android and professional legal reviews**. No Android device was connected during the closure check. Those reviews remain open and must not be reported as completed by browser tests or Android resource compilation. No Play Store submission is authorized by this web-release approval. The performance measurements above describe the archived surface-coherence snapshot; the closure changes affect only results/manual sharing, not the game engine or its deadlines.

The final closure `npm run verify` passed, including the naturally earned profile, 191 source-gallery states, all ten compiled mode layouts on three viewports, all 64 smoke checks and the three 100-answer browser series (maximum painted successor gap 350 ms in that run). The bundle remains within the unchanged limits at **443.9 KB initial JS / 254.0 KB CSS**. Closure screenshots, earned-round receipts and the complete verification log are archived locally under `%LOCALAPPDATA%/Temp/opencode/scs-surface-release-20261019/`. The earned-analysis test waits for the lazily loaded report to become visible before asserting its contents; no production waits or engine timers were added.

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
