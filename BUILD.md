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

The gate now also includes `prism-logic-test` (all twelve authored solutions, ray/chain rules, undo, migration and storage rollback) and `prism-release-test` (genuinely played compiled campaign, touch/tap/drag, loss/undo, storage failure/retry, replay/reload, offline play, shared puzzles and responsive layouts). `SCS_BROWSERS=chromium,firefox,webkit` expands the latter. Windows WebKit's context-level offline toggle produces an internal navigation error; its local offline test therefore disconnects the real HTTP server transport instead, requiring the service worker to supply the game. No wins or campaign records are seeded.

`arcade-engine-release-test` also covers all ten existing modes on the new hybrid stage with real timed input, fixed hit rectangles, covered Memo names, reduced-motion Sequence cues, engine sleep/resume/disposal, low-tier caps and opt-in depth/graphics-fallback fixtures. `SCS_BROWSERS=chromium,firefox,webkit` expands both engine suites. `pwa-release-test` starts an arcade round for the first time after disconnecting, rather than only replaying an already loaded engine.

Additional production budgets are **2600 KB total compiled JavaScript**, **20 KB Prism CSS**, **12 KB arcade engine CSS** and **16 MB full precache**. The existing **480 KB initial JavaScript / 255 KB original CSS** limits remain unchanged. Phaser and transitive/Capacitor MIT notices are bundled under `licenses/`. `index.html`'s source-only import map is stripped; packaged/web production runs without `node_modules` or an engine CDN.

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

The measurement history below predates the Phaser upgrade and is **not** performance evidence for the current renderer. Current runtime caps are documented under **Prism Arcade** in `ARCHITECTURE.md`; they do not establish Android frame rate, thermals or battery behavior.

Run measurements serially on an otherwise quiet machine, after building. Use the Node command directly so shells/npm cannot drop benchmark flags:

```powershell
node scripts/perf-benchmark.mjs --mode=klassik --play=classic --cpu=4 --seconds=30 --reaction=150 --tier=mid --seed=1337 --json=perf-mid.json
```

Use the same viewport, CPU rate, input, seed, duration and pinned tier for comparisons. Repeat runs and compare medians, including p95 frame time and long-task time rather than FPS alone. `--root=<built-directory>` can compare an archived build; `--input=tap` covers the tap path. JSON includes steady-state frames after the warmup, connected DOM nodes, active animations and trail allocation. **The current benchmark seed pins `Math.random`, not the engine's independent `Date.now()` seed. These runs therefore do not replay identical task sequences**, even within a build. Frozen-clock fixtures additionally pin that engine seed for visual comparisons; those fixtures are not FPS measurements.

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

The initial web release was merged through PR #7 as `e4d9e1f` after green local verification and PR CI. Pages deployment, 64 live smoke checks, all compiled mode/viewport presentation checks, six naturally earned live rounds and 18 decoded runtime-asset comparisons passed. The post-merge CI exposed a source-gallery measurement issue on the installation banner: during its translate-only animation Chromium can report the 44×44 CSS-pixel dismissal target as 44×43.999996185302734. A deterministic sweep of 401 animation times reproduced this on all three viewports; the CSS and layout dimensions stay 44×44 throughout. The gallery now allows only 0.001 CSS px of painted-geometry rounding while still requiring at least 44×44 layout dimensions. It samples an in-animation frame, explicitly rejects a target scaled to 99%, restores the animation/style, checks settled geometry and clicks the real dismiss action. This correction changes only the test, not production CSS, controls, waits or game timers. Its isolated 191-state gallery and subsequent full `npm run verify` passed (maximum painted successor gap 343 ms in that full run); the diagnosis and test logs are retained in the closure archive. The owner separately authorized one administrative merge of this test-correction PR, conditional on green local verification and PR CI.

### Precision Arcade art direction (local, 2026-10-19)

The approved follow-up refines the existing 2.5D presentation; it does not add Unreal, live 3D, a runtime library or new game modes. It replaces diagonal gloss with narrower neutral material edges, shares panel/control finishes and typography across the app, and removes obsolete compact-results overrides. Shop previews are static schematic scenes using the actual theme/trail declarations, not screenshots or a running game. A recycled, accessible modal allows previewing every locked or owned design without purchasing/equipping. The wheel uses one crisp, themed 2x-capped bitmap for a normal spin instead of per-frame canvas repaint. Rewards, prize weights and game timing/target geometry are unchanged. Off-style cyan ripples/confetti and central life/streak flashes are replaced by the existing local/status feedback. Web/store/native branding sources and all 28 raster assets were regenerated with the same material finish.

The complete `npm run verify` passed: **194 source-gallery states**, **145 static contrast checks** (including bright material endpoints), rendered contrast plus the preview dialog, all ten compiled mode layouts on three viewports, **42 compiled preview cases**, six genuinely timed earned-progression rounds, three flawless 100-answer browser series and **64 smoke checks**, without browser console errors. The longest painted successor gap in that gate was **356 ms**; deterministic engine successor bounds remain 320 ms in sorting modes and 400 ms in the tested thinking modes. These are distinct measurements, not a frame-rate guarantee.

The build is **447.3 KB initial JavaScript / 252.6 KB CSS**, versus 443.9 / 254.0 KB for `67ba15b`; the unchanged limits remain 480 / 255 KB. `GameEngine.js`, `ModeMastery.js`, mode unlock rules, dependencies and `package-lock.json` are unchanged. The archive `%LOCALAPPDATA%/Temp/opencode/scs-precision-arcade-20261019/` holds the frozen `baseline/` and `candidate/` builds, final gallery/mode/preview/branding pictures and `verify-final.log`. No commit, push or deployment is part of this local art-direction pass. Physical Android feel/thermals and professional legal review remain separate, outstanding sign-offs; this pass does not authorize a Play Store submission.

Eight untraced benchmark runs compared the frozen `67ba15b` runtime with this candidate: Colors/classic, 412×915/DPR 2, CPU 4×, 30 seconds, 3-second frame warmup, 150 ms swipe reaction, seed 1337, default-off depth. The three mid pairs alternated order (baseline→candidate, candidate→baseline, baseline→candidate); the one high pair ran candidate first. No other browser tests or Android compilation ran concurrently.

| Metric | `67ba15b` | Precision Arcade |
| --- | ---: | ---: |
| Mid median FPS (range), 3 runs each | 56.5 (54.9–57.2) | 57.0 (55.0–57.2) |
| Mid median p95 frame time | 16.8 ms | 16.8 ms |
| Mid median total long-task time | 917 ms | 643 ms |
| High FPS, 1 run each | 55.1 | 57.4 |
| High p95 frame time | 33.3 ms | 16.8 ms |
| High total long-task time | 1,119 ms | 642 ms |
| Connected nodes at first stimulus | 1,603 | 1,603 |
| Mid / high trail backing pixels | 848,514 / 1,507,920 | 848,514 / 1,507,920 |

These small median differences and the high spot check do **not** establish a performance improvement or regression-free behavior. The second mid pair worsened from 56.5 to 55.0 FPS, from 16.8 to 33.3 ms p95 and from 920 to 1,400 ms total long-task time. All eight runs had zero page errors and zero inactive-screen animations. Raw JSON/logs, run order, settings and bundle hashes are in `comparison-summary.json` and its sibling files; physical Android profiling remains necessary.

After the final web gate, `npm run cap:sync` and JDK 21 / SDK 36 `:app:processDebugResources` succeeded for the regenerated native branding. Gradle still reports its existing flatDir metadata warning and an SDK command-line XML-version mismatch warning; resource compilation/linking completes successfully. No APK/AAB was packaged, installed or submitted.

### Usability audit follow-up (local, 2026-10-19)

The owner approved closing the remaining UI/UX findings while explicitly postponing physical smartphone testing. The follow-up makes home content intrinsic-height/scrollable, wraps enlarged labels and menu grids instead of clipping them, protects text/button height in dialogs/pause/results, adds focus-moving settings section navigation and real wide-screen settings/shop layouts, and removes the global landscape screen-hiding rule. Narrow landscape touch arenas pause through the existing pause flow; menus and dialogs stay operable. No landscape-arena redesign, engine rule/deadline change or new game mode is claimed.

Colors now announces distinct, localized displayed colors and target directions, not four identical “square” names. All twelve silhouettes and both full palettes have German/English name coverage. Center descriptions do not reveal the correct direction; covered Memo and Stroop semantics are preserved. Shop previews have visible captions, real material shapes/current trail declarations and an opt-in 750ms example with bounded cancellation, never a game or purchase. Ten different vector illustrations replace the generic selection plinths without adding live-arena geometry. Wheel Skip, Escape/Back, hiding and newly enabled reduced motion settle the already-picked spin; busy state spans reward persistence. A same-document root history entry prevents browser Back from leaving the app during this flow. Missing/rejected Web Audio context creation no longer blocks boot or starts an invalid synth scheduler.

A further real-pause check found stale palette targets after a settings change, and the global localization pass could overwrite their rich names with direction-only fallbacks. Settings now apply the presentation change while storage completes; the paused display refreshes its cached targets/center on palette/language changes. It removes those shell fallbacks from live task nodes, preserves covered Memo labels/Sequence phases, and leaves the current item, score and target geometry unchanged. This is a presentation-cache correction, not an engine-rule or timing change.

Typography is self-hosted with **11 static Latin WOFF2 cuts / 150,088 bytes (146.6 KiB)**, including provenance and the SIL OFL license under `fonts/`. Only regular Outfit is preloaded; all cuts are available through the offline worker. Static cuts are intentional: Windows WebKit reported successful variable-font decoding but rendered 400/700 Outfit almost identically (243/245 covered canvas pixels in one diagnostic), whereas static cuts restored the expected distinction (755/1,228). The new test checks actual weight rendering, not only font-load promises. There is no font probe in the runtime and no font-CDN request. German/English privacy text was updated only for this resource-loading change; professional legal review remains separate.

The current build is **455.2 KB initial JavaScript / 254.5 KB CSS**, with the unchanged **480 / 255 KB** limits. Font bytes are separate assets, not hidden within the CSS/JS budget. The larger font asset set is a deliberate compatibility tradeoff against the smaller variable-font pair. Dependencies, `package-lock.json`, `GameEngine.js`, `ModeMastery.js` and mode unlock rules remain unchanged. The earlier eight-run comparison describes the frozen first Precision Arcade snapshot, **not** this follow-up; no new Android/FPS/improvement guarantee is inferred from it.

The isolated compiled `usability-release-test` passed in Chromium, Firefox and WebKit on Windows: **18 DE/EN viewport/root-font configurations**, **12 independently earned one-spin finish cases**, plus three combined demo/lifecycle/live-label/large-pause/result fixtures. It checks actual desktop widths as well as reflow so a higher-specificity old selector cannot silently defeat the intended layout. Root-font 16→32px stress is not a physical OS-font/zoom or TalkBack certification. The explicit result-end fixture is separate from the naturally timed earned-progression gate. The source gallery's old expectation of an orientation-blocked home was replaced with positive, real-click navigation checks for the newly supported landscape menus, not an ignored failure.

The final, rebuilt-source **`npm run verify` passed** with `SCS_BROWSERS=chromium,firefox,webkit`: **196 source-gallery states** (66 phone / 66 small / 64 desktop), **145 static contrast checks**, rendered contrast, **42 compiled design-preview cases**, all 33 cross-engine usability groups including the real paused palette/language refresh, ten compiled mode layouts on three sizes, six naturally timed earned-progression rounds with reloads, three flawless 100-answer series and **64 smoke checks**. The longest painted successor gap was **355 ms**; deterministic engine limits remain unchanged. No console errors were reported. The application source was held unchanged throughout this final gate; no device/FPS or full accessibility certification is inferred from these browser checks.

After that gate, `npm run cap:sync` rebuilt the same **455.2 / 254.5 KB** runtime and synced the local fonts/web assets to Android. All **34 precached assets**, including the 11 font cuts, were byte-identical between the built web app and Android's public assets; `artifact-parity.json` records their SHA-256 hashes. JDK 21 / SDK 36 `:app:processDebugResources` completed successfully (unchanged app resources were up-to-date); Gradle's existing flatDir metadata warnings remain. No APK/AAB was packaged, installed or submitted, and no smartphone was used.

The local evidence folder is `%LOCALAPPDATA%/Temp/opencode/scs-usability-polish-20261019/`. The approval record is **`verify-release-candidate.log`**, with screenshots under `release-candidate/`, and **`android-resources-final.log`**. `usability-final.log` / `pause-fix/` contain the isolated all-engine verification of the final pause fix. Early `cross-browser.log`, `verify-final.log` and `verify-confirmed.log` retain diagnostics from the discovered Web Audio/orientation-test issues and the earlier pre-pause-fix bundle; they are not final approval records. At that implementation stage, no commit, push or deployment had been requested. Physical smartphone, haptic/thermal/long-session, screen-reader and new-player usability reviews remain open.

### Web release authorization (2026-10-19)

The owner subsequently requested the commit/push/deployment flow and explicitly approved **one administrative merge for this refinement** after green local verification and PR CI. Publication targets the existing GitHub Pages site, not Google Play. The postponed physical-device and professional legal reviews are not represented as completed by this authorization. The release review also corrected the static material contrast check to use the actual card-derived highlight endpoint (`card` mixed with 6% text), rather than the darker base surface; no production styling or thresholds were relaxed. Preserve the existing engine deadlines, fixed hit areas, dependency versions and bundle limits throughout release closure.

The complete gate was rerun immediately before the release commit with `SCS_BROWSERS=chromium,firefox,webkit` and passed, including all 145 corrected static contrast checks, the cross-engine usability fixtures and 64 smoke checks without console errors. The longest painted successor gap in this repeat was **341 ms**; build sizes remained **455.2 KB initial JS / 254.5 KB CSS**. Its local evidence is `%LOCALAPPDATA%/Temp/opencode/scs-usability-polish-20261019/verify-before-publish.log`. PR CI, production CI, Pages deployment and live smoke verification are separate required publication steps, not implied by this local result.

### Complete-round follow-up (2026-10-19)

The owner requested the full approved round-flow/polish package and the commit/push/deployment routine. This is a new PR; the administrative authorization used for PR #9 is not treated as permission for a further bypass. The target remains the existing Pages site, not Google Play.

The implementation moves the 420ms end cue before continuation/results, preserves stationary targets until scoring has stopped, removes the red global loss flash/long pad, and settles a declined continuation in the same card. Raw interim points become the final score with an explicit bonus breakdown and optional 360ms count-up; action availability is independent of that count. One factual highlight and the shared ten-world artwork/theme tokens connect gameplay and results. A 300ms ready cue precedes the existing 15-second continuation timer; duplicate input, Back, hiding, reduced motion, ready cancellation/refund, scroll/input restoration and covered Memo presentation are lifecycle concerns, not extra scoring grace.

The default-off best-run setting uses one scoped, bounded raw-score comparison in the existing mastery save, not the old mode-only HUD. Scope is mode + version + play type + original duration; daily/competition/endless/practice/used continuations are excluded. One sample per active second, at most 240 seconds and four current scope keys per mode, bounds storage and lookup. Existing unscoped paces are not reclassified. Details offer a truthful per-mode practice suggestion without claiming a diagnosis. The existing practice engine is now genuinely self-paced: only practice holds unanswered tasks and disables Sequence input timeout/life depletion. Practice completion never submits score/progression. Scored-round rules and 320/400ms successor limits are unchanged; the Rush fixture now isolates combo decay directly while testing a scored round, retaining all single-deadline assertions.

New mandatory gates are `round-finale-logic-test` and `round-finale-release-test`; the latter supports `SCS_BROWSERS` and naturally completed rounds/continuation plus explicitly labeled early-end lifecycle fixtures. Rendered contrast also snapshots the real end cue within its triggering task, without altering production timeouts. Touch-only synthetic hover no longer translates ordinary menu buttons; genuine press feedback is preserved. Local diagnostics/screenshots are archived under `%LOCALAPPDATA%/Temp/opencode/scs-round-finale-20261019/`. `verify-initial.log` is an intermediate discovery run while edge-case coverage was being expanded, not the final release approval record. Physical smartphone, TalkBack, haptics/thermal/long-session and external/legal reviews remain postponed; browser checks do not certify them.

The final **`npm run verify` passed** with `SCS_BROWSERS=chromium,firefox,webkit` while application source was held unchanged: 196 source-gallery states, 145 static contrast checks plus rendered end-cue/settled-result checks, 42 compiled design previews, 33 usability groups, all 12 new cross-engine finale/lifecycle groups, ten mode layouts on three sizes, the existing six naturally earned progression rounds, three flawless 100-answer presentation runs and 64 smoke checks without console errors. Approval evidence is **`verify-release-candidate.log`** and screenshots under **`release-candidate/`**. `round-finale-confirmed.log` is the preceding isolated all-engine pass. The earlier `round-finale-expanded.log` records a corrected fixture-navigation issue (the explicit QA mode selector does not repaint the real locked carousel), not a relaxed production unlock gate.

Build size is **459.4 KB initial JS / 253.6 KB CSS**, inside the unchanged **480 / 255 KB** caps. Maximum painted successor gap in the final gate was **351 ms**; the separate deterministic scored-engine bounds remain 320/400ms. No device/FPS improvement guarantee follows. After verification, `npm run cap:sync` passed; **36 release files** (all precached files, worker and font license) matched Android public assets byte-for-byte, recorded in `android-parity.json`. No native resource source changed, no APK/AAB was packaged or submitted, and no physical device was used. PR CI, production CI, Pages deployment and published-site checks remain required separate release steps.

### Live arena follow-up (2026-10-19)

The owner approved the complete live-arena package following PR #10: actual mode-specific station skins/architectural relief, shared accepted-hit quality, readable persistent Rush/Flow/Fevers/cooldown and memory phases, plus beat-coalesced music transitions for **normal file playback** as well as procedural fallback. No game modes, engine rules/deadlines, palettes, hit rectangles, reward thresholds, dependencies or lockfile were changed. No smartphone/TalkBack/haptics/thermal/long-session or professional legal sign-off is implied. Any administrative authorization for the preceding PR is consumed, not permission for a further bypass.

`arena-phase-logic-test` and `arena-experience-release-test` join `verify`. The latter's constant-RNG/frozen-clock views are explicitly **presentation fixtures**, not naturally earned rounds or performance evidence. Archived baseline `c2d55ae` and candidate screenshots use the same fixture setup; compare their task/geometry receipts rather than presenting a different question as a before/after improvement. Independent normally timed rounds, real-input 100-answer flows, exact material-color rasterization, quality/motion/depth cleanup and the original 480/255KB budgets remain required. File-audio coverage now checks actual media playhead movement through a reusable EQ graph and stop cancellation, not merely an oscillator stub. New station-material highlight endpoints are included in static contrast checks.

The compact-screen review also found the legacy `max-width:374px` center-SVG override enlarged the Chaos rule icon to 60px and masked its size-coded symbols. Removing that obsolete override restores canonical per-purpose dimensions rather than changing the size rule. Sequence watch/reveal no longer transforms target buttons; its static highlight remains essential under reduced motion. The archive is `%LOCALAPPDATA%/Temp/opencode/scs-arena-experience-20261019/`. Prototype/fixture-discovery logs there are intermediate, not final release approval.

**Final approval: `verify-approval.log`**, a successful full `npm run verify` with `SCS_BROWSERS=chromium,firefox,webkit`, held on unchanged application source. It includes 153 static contrast checks, rendered end/result contrast, 196 gallery states, 42 design previews, 33 usability groups, 12 round-finale groups, **60 new compiled arena fixtures**, the existing natural earned-progression rounds, all ten layouts on three sizes, three flawless 100-answer flows and **64/64 smoke checks without console errors**. The longest painted successor gap was **343ms**; scored-engine 320/400ms limits remain distinct, unchanged checks. `verify-final.log` is an earlier passing app gate before the final screenshot-fixture correction; `verify-release-candidate.log` is the intermediate Memo badge discovery, not release approval. The final Memo check verifies a centered accepted-answer badge on covered targets; hidden off-map slots no longer receive Memo reveal/cover classes.

`visual-parity.json` verifies **20 before/after scenes with identical task text/names, material colors/silhouettes, arrows and hit rectangles** against published `c2d55ae`. Screenshots and `before-after.png/html` are presentation fixtures, not gameplay performance evidence. Both the decorative RNG and independent engine wall-clock seed are fixed. Only construction/cover CSS fades are settled equally in both versions; no overlays are hidden and essential Sequence flashes are not finished to obtain pictures. This avoids presenting the old Memo cover's half-finished fade as an improvement.

The approved bundle is **464.3 KB initial JS / 253.8 KB CSS**, inside the unchanged **480/255 KB** limits. `GameEngine.js`, `js/config.js`, `ModeMastery.js`, `save.js`, `input.js`, material SVG geometry and the dependency lockfile are unchanged. After `npm run cap:sync`, **36 files** (all precached assets, worker and font license) matched Android public assets and the frozen benchmark candidate byte-for-byte (`android-parity.json`). No native resource source changed; no APK/AAB or Play submission was made. Exact-SHA PR CI, production CI, Pages deployment and live checks remain subsequent required publication steps.

Eight serial, untraced benchmark runs compared frozen `c2d55ae` and the approved runtime: Colors/classic, 412×915/DPR2, 4× CPU throttle, 30 seconds, 3-second warmup, 150ms synthetic swipe reaction, default-off depth, requested seed 1337, pinned tiers. No other tests/builds ran concurrently. The three mid pairs alternated order; high is a single candidate-first spot check. The seed limitation above applies; these are protocol-matched runs, **not identical task replays**.

| Metric | Published `c2d55ae` | Live-arena candidate |
| --- | ---: | ---: |
| Mid median FPS (range), 3 each | 59.5 (59.0–59.7) | 59.4 (59.3–59.7) |
| Mid median p95 frame time | 16.8ms | 16.8ms |
| Mid median total long-task time | 146ms | 136ms |
| High FPS, one each | 58.3 | 58.8 |
| High p95 frame time | 16.8ms | 16.8ms |
| High total long-task time | 274ms | 206ms |
| Connected nodes at first task | 1,618 | 1,616 |
| Mid / high trail backing pixels | 848,514 / 1,507,920 | 848,514 / 1,507,920 |

These small, mixed differences and overlapping ranges establish neither a speed improvement nor regression-free/device-60-FPS behavior. The third mid candidate was slower (59.5→59.3 FPS). All eight runs had zero page errors, no inactive-screen animations and unchanged trail budgets. `comparison-summary.json`, per-run logs/JSON and runtime hashes retain the results. Physical smartphone, native screen-reader, vibration/thermal/long-session and legal reviews remain separate/postponed.

### Prism engine diagnostic (local, 2026-10-26)

An initial continuous-render prototype was too costly under emulated load. The retained arcade renderer sleeps on static scenes, reuses unchanged direction geometry and limits animated engine hits to high quality. A single serial, untraced final mid-tier spot check used Colors/classic, 412×915/DPR2, 4× CPU throttle, 30 seconds/3-second warmup, 150ms swipe reaction, seed 1337 and default-off depth. It measured **54.2 FPS after warmup, 33.3ms p95, 1,215ms total long-task time**, 82 correct inputs, zero page errors and no inactive-screen animations. This is one local diagnostic, not a repeated baseline comparison, stable Android FPS or a regression-free/thermal/battery guarantee. Earlier intermediate JSON files intentionally retain the slower prototypes. The final diagnostic is `%LOCALAPPDATA%/Temp/opencode/scs-prism-arcade/perf-mid-static.json`.

## Android Build

The Prism Worlds/Prism Arcade local acceptance is recorded in [PRISM_WORLDS.md](PRISM_WORLDS.md). Its final all-browser `verify` passed on stable application source, and both APK/AAB packaging plus 49-file runtime parity passed. The APK is debug-signed; the AAB is unsigned and cannot be treated as a signed Play release. Current output paths are those below; physical device, production signing and store submission remain outstanding.

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
