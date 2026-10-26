# Prism Worlds — first playable chapter

## Shipped source scope

- Phaser 4.2.1 / MIT; original JavaScript/vector artwork, no external asset or AI-image service.
- Twelve handcrafted puzzles across three garden regions, with colour/symbol matching, connected crystal chains, mirrors, colour rings, switches and light barriers.
- Aim by tapping, launch with the labelled button, or drag and release. Keyboard arrows and Space/Enter plus a named target picker are alternatives.
- No countdown. Free undo/retry, three-star efficiency goals, visible restoration, sequential campaign unlocks and persistent best solutions.
- DE/EN, reduced-motion support, bounded impact effects and a low-tier 30 FPS renderer cap. These are implementation policies, not a physical-device FPS guarantee.
- Shared puzzle links open free play, including late puzzles, without awarding or unlocking campaign progress.
- Existing arcade records, currency, preferences and achievements are preserved. Campaign results have their own versioned save namespace.
- All ten existing arcade modes use a shared hybrid Phaser stage: architecture, neutral stations, peripheral energy and bounded accepted-hit effects. Exact task faces, fixed controls, rules/deadlines, Memo concealment and Sequence watch cues remain intact. The original renderer is retained as a graphics fallback, not a second visible effect layer.
- Local-only data. No new ads, payments, account creation, cloud service, analytics SDK or recurring service bill.

This is the first chapter and validation foundation, not a claimed international Top-5 product. More worlds/content, live operations, aggregated retention measurement and market distribution need actual player evidence before expansion.

## Validation

```powershell
npm run prism-logic-test
npm run build:prod
$env:SCS_BROWSERS = 'chromium,firefox,webkit'
npm run prism-release-test
npm run arcade-engine-release-test
npm run verify
```

The release test plays the actual compiled game with normal pointer/touch controls and naturally timed flights. Test solutions are external input fixtures, never bundled hints or assigned wins. Screenshots and earned result receipts default to `%LOCALAPPDATA%/Temp/opencode/scs-prism-worlds`; override with `SCS_REVIEW_OUT`. Root-font/layout and storage-failure cases are explicitly injected test conditions, not claims about real player achievements.

Arcade engine screenshots/receipts default to `%LOCALAPPDATA%/Temp/opencode/scs-prism-arcade`. Its QA selector opens otherwise locked modes without awarding progress. Low-tier/preferences and dispatched graphics-loss checks are explicit lifecycle fixtures. Offline coverage includes a first-ever arcade engine launch after the network is disconnected. Frozen-clock screenshots in the older arena suite remain presentation fixtures, separate from the new normally timed input tests.

Remaining human checks: physical Android touch and dragging accuracy, TalkBack usability, app switching/Back, vibration/audio feel, GPU context recovery, long-session memory/thermals/battery and first-time-player observation. Browser automation cannot certify these.

### Initial engine acceptance (before the web-test UX pass)

The final `npm run verify` passed with `SCS_BROWSERS=chromium,firefox,webkit`, on unchanged runtime/build/test source: all twelve naturally completed puzzles in each browser, all ten arcade modes in each browser, first-ever offline arcade launch, 164 static contrast checks plus rendered contrast, the existing earned-progression/continuation/layout/phase gates, three flawless 100-answer series and **64/64 smoke checks with no console errors**. The final gate's maximum painted successor gap was 344ms; deterministic engine bounds and device performance remain distinct. `npm audit` reported zero known vulnerabilities.

Evidence: `%LOCALAPPDATA%/Temp/opencode/scs-prism-worlds/verify-final-source.log`. Earlier `verify-full.log` and `verify-release-candidate.log` are failed diagnostic runs, not approval. Arcade screenshots and `arcade-engine-receipts.json`, the 131-file stable-source receipt and native packaging/parity receipts are under the sibling `scs-prism-arcade` directory.

That engine snapshot was **466.9 KiB initial JS / 253.8 KiB original CSS / 1966.0 KiB total JS / 13.66 MiB precache**. Phaser and native lifecycle integration were synced, and Android `:app:assembleDebug :app:bundleRelease` succeeded with JDK 21/SDK 36. Both packaged artifacts contained 49 byte-identical required runtime/worker/license files matching that web snapshot and registered the App plugin. `apksigner` confirmed the APK's Android Debug signature; the release AAB was **unsigned**, confirmed with `jarsigner`, because no production signing credentials were configured. Existing flatDir/SDK-tool metadata warnings remained. No device was connected and installed-app behavior was not tested. These earlier packages do not represent the later web-test refinements below.

## Web-only test release — UX audit and cleanup

The owner requested testing at **https://theokitsi.github.io/scs-play/** only, not Play Store publication. The browser build retains all ten arcade modes and the first adventure chapter. The UX pass improves discoverability and recovery without inventing achievements or changing scored arcade rules:

- The home entry describes light puzzles/no time limit instead of engine technology, identifies the separate Arcade section and shows actually earned campaign progress/next level on return.
- The map displays authored level names and a next-puzzle preview, explains free undo/retry and three-star targets, and results report real pulse efficiency. Aim controls show their actual angle without flooding screen-reader announcements during dragging.
- New engine architecture and task-card materials respect the selected shop theme instead of replacing it with a fixed blue palette. Task colours and memory concealment are unchanged; theme colours are read at mount, never per frame.
- Failed settings writes show an in-viewport retry with an honest session-only explanation; display/audio changes still apply immediately. Settings explain browser-local storage and the absence of cloud backup.
- Knip's `lamejs` suppression was removed: the music tool now resolves the real dependency through Node's package resolver. Knip remains enabled without new ignore entries; no used compatibility modes or existing saves were deleted to manufacture a cleanup. The resolved encoder is checked without regenerating music.
- Both new screenshot/receipt suites now choose a portable temporary path on Linux CI as well as Windows. Source-gallery populated states remain explicit fixtures, not claims of earned player results.

The release candidate is **474.5 KiB initial JS / 254.1 KiB original CSS / 1969.3 KiB total JS / 13.66 MiB precache**, within the original and engine-specific budgets. Local release evidence is archived under `%LOCALAPPDATA%/Temp/opencode/scs-web-release-20261026/`; final local verification, exact-SHA GitHub CI, Pages deployment and live smoke verification are separate required release checks.

**Local release gate passed:** `verify-local.log` records a complete `npm run verify` with `SCS_BROWSERS=chromium,firefox,webkit`, held on unchanged application source. It includes 159 static contrast checks plus rendered save-error recovery, all twelve naturally played puzzles and ten real-input arcade modes in each browser, 193 source-gallery fixture states, 60 frozen arena fixtures, existing earned/continuation/reflow checks, three 100-answer series and 64/64 smoke checks without console errors. The longest painted successor gap in this run was 362ms, distinct from the deterministic engine deadlines and not a device-FPS claim. `npm audit` reported zero known vulnerabilities. Screenshots/receipts are under `final/`. The owner authorized exactly one administrative squash merge of this release PR **only after green local verification and PR CI**, without changing branch protection. Production CI, Pages deployment and published-site checks still have to pass for publication to count as complete.

This is a stronger playable test candidate, **not evidence of international Top-5 readiness**. Twelve introductory puzzles are a first chapter, not a long-term content pipeline. Actual new-player observation, repeat visits/retention, device play, content demand and country/category-specific acquisition evidence are still needed. No remote analytics, advertising or monetization was activated for this test.

## Zero-budget growth path

1. Recruit volunteer testers using the playable web build. Observe first action, misunderstanding, voluntary next-level play and subsequent return.
2. Share honest short gameplay clips and puzzle links; distinguish organic community response from representative market data.
3. Iterate on the core mechanic and early levels before producing a larger campaign.
4. If remote analytics is later enabled, review the SDK's actual data flows, target audience, consent requirements, privacy policy and Play Data safety declarations first. Local activity records alone do not provide aggregate D1/D7/D30 retention.
5. Define charts by country, category and time period; a worldwide Top-5 promise or fixed install-to-ranking formula is not justified.

The tools/content can be developed without license spending. A Play Console account, if not already owned, has a one-time US$25 registration fee. Publishing/signing credentials, identity verification, review and real tester recruitment remain owner/platform dependencies. No store submission is implied by building an AAB.

## Research used (26 October 2026)

- [Phaser 4.2.1 release](https://phaser.io/download/release/v4.2.1), [MIT license](https://phaser.io/download/license) and [Capacitor game-development guide](https://capacitorjs.com/docs/guides/games): compatible engine/runtime stack, without commercial engine fees.
- [Sensor Tower State of Mobile 2026](https://sensortower.com/report/state-of-mobile-2026): public summary emphasizes efficient growth, attention competition and ongoing product operations; gated report details were not treated as verified data.
- [GameAnalytics 2026 benchmarks](https://www.gameanalytics.com/reports/2026-mobile-pc-gaming-benchmarks): explains cohort/methodology differences and the gap between median and standout retention. These do not certify this game's retention.
- [GameRefinery April 2026 market review](https://www.gamerefinery.com/mobile-game-market-review-april-2026/): accessible puzzle cores combined with meaningful progression. Competitor designs/art are not copied.
- [GameAnalytics free pricing](https://www.gameanalytics.com/pricing): possible later measurement option, not an enabled dependency or blanket privacy approval.
- [Kenney licensing](https://kenney.nl/support): verified CC0 asset option. The first chapter instead uses original procedural/vector art; no Kenney download was incorporated.
- [Google Play API requirement](https://developer.android.com/google/play/requirements/target-sdk): API 36 for new mobile apps/updates since 31 August 2026; the project already targets 36.
- [Closed testing requirements](https://support.google.com/googleplay/android-developer/answer/14151465): qualifying new personal accounts need 12 continuously opted-in testers for 14 days before applying for production access.
- [Android vitals](https://developer.android.com/google/play/vitals): real stability, performance and device behavior remain release concerns.
