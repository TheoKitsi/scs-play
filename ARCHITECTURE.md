# Architecture

## Stack

- Vanilla JavaScript ES modules.
- Phaser 4.2.1, shared and lazy-loaded for Prism Worlds and all ten hybrid-rendered arcade modes. Arcade rules remain in the original `GameEngine`.
- CSS partials imported by `css/style.css`.
- Playwright for browser QA.
- esbuild for production bundling.
- Capacitor Android wrapper.

## Runtime Shape

### Prism Worlds

`js/game/prism/PrismSimulation.js` is a render-independent simulation. Read-only ray tracing supplies both the aim preview and live path; fixed 1/120-second steps resolve flights, chains, switches and completion without wall-clock timers. Twelve bilingual, authored definitions live in `js/game/prism/levels.js`. Mirrors reflect rays, paint rings retune them, closed walls/gates block rays and chain links. Undo restores the complete pre-shot state. `scripts/lib/prism-solutions.mjs` contains test inputs only and is excluded from production output.

`js/engine/PrismScene.js` owns Phaser drawing and pointer input, not rewards or persistence. A single 420×560 logical canvas scales to its DOM container. Original vector geometry/generated textures require no asset CDN. No Phaser audio manager/physics world is started: the application audio graph and the pure simulation remain authoritative. Impacts are bounded to 4/12 and disabled by reduced motion. Menus do not create a Phaser instance; pause/results sleep its loop, and navigation destroys it.

`js/screens/PrismScreen.js` supplies the world map, DOM HUD, accessible alternative controls and shared modal-stack dialogs. Campaign progress is stored by `js/services/PrismProgress.js` under `save.data.prism`, independently of arcade scores, XP, lives and mastery. Only eligible wins commit through the existing batched save transaction. Failed writes leave an explicit retryable result and cannot enable Next. Shared puzzles never call the campaign persistence path.

`js/services/NativeLifecycle.js` is loaded only in the packaged app and registers the installed Capacitor App plugin. Android Back uses the same modal/navigation path; root Back minimizes the app. Native backgrounding and document visibility both suspend active play. This is integration code, not evidence of physical-device behavior.

Prism uses a separate scoped stylesheet (`css/prism.css`) and a lazy engine chunk. The source HTML import map resolves Phaser for source-server QA; the production build removes it and bundles the dependency locally with its MIT license. The production service worker caches all compiled chunks for offline play. Existing initial-JS/CSS caps remain; total JS, Prism CSS and complete precache now have additional explicit budgets.

### Prism Arcade

`js/engine/ArcadeArena.js` upgrades all ten public arcade modes with one hybrid Phaser stage. `GameScreen.prepareArenaEngine()` resolves the shared lazy dependency before countdown. The renderer receives only target geometry, whitelisted mode architecture, read-only phase/energy and committed feedback; it never receives a question, correct upcoming direction, hidden Memo symbol or Sequence pattern. DOM/SVG task faces retain exact colours, accessible names, keyboard/touch controls and stationary rectangles. `css/arcade-engine.css` skins those faces and hides the redundant fallback stage only after engine boot.

The backing surface is capped at 1024×1536; camera zoom preserves CSS-coordinate geometry on larger displays. High/mid use a 60 FPS cap, low 30. **Static live scenes sleep too:** changes wake a render, while only necessary Sequence cues and at most two short high-tier hit effects sustain frames. Mid/low/reduced motion keep the existing local DOM contact cue without another animated canvas pass. Unchanged target direction sets reuse measured geometry instead of forcing a layout read on each spawn. Sequence's necessary watch outline remains visible regardless of motion policy. Optional depth moves architecture only, at most ±4/3 pixels, with one coalesced pointer frame; resize/release/pause/policy reset it. Pause/results sleep the renderer, real continuation resumes it, and navigation destroys its game, observer, listeners and pending frames. Failed boot/context loss releases the layer so the existing DOM/SVG presentation remains playable; context loss pauses the round first. Stale callbacks after disposal are inert.

`arcade-engine-release-test` uses real timed taps in all ten compiled modes, choosing locked modes with the existing QA selector but never assigning scores. Read-only renderer snapshots check backing pixels, policy, phase and lifecycle. Preferences/quality and a dispatched graphics-loss event are explicit fixtures, not physical-device/GPU measurements. `pwa-release-test` also launches the arcade for the first time only after disconnecting, proving that all lazy Phaser chunks were precached before use.

`app.js` coalesces repeated start requests and cancels a pending start on navigation, so a cold engine download cannot take over a menu opened while loading. The compiled gate holds the real module request and navigates normally to exercise this race. `helpers/prismLink.js` strips unrelated query/hash state from puzzle links; packaged shares use the public deployment URL instead of Capacitor's device-local origin. This prepares usable native links after publication, not evidence that the new chapter is already live.

The web-test UX pass reads the selected theme's existing `--surface`, `--bg` and `--primary-glow` once at arcade mount, sharing neutral card materials with the shop preview instead of hardcoding a substitute palette. Exact task/success colours remain independent. Home uses the canonical campaign sanitizer for earned progress; the map exposes authored titles and the next puzzle, and results/aim controls show actual efficiency/angle. Settings catch rejected preference writes, retain their session effect and offer a visible retry without throwing from async DOM listeners. No new account, telemetry or progression reward path was added.

`js/appState.js` exports the shared `app` singleton. Core services are instantiated in `js/app.js`, which is the app orchestrator. Screen modules render and bind their own screen-specific UI, while cross-screen behavior is routed through `app.js`, helper modules, or services.

## Main Layers

| Layer | Location | Notes |
| --- | --- | --- |
| App orchestration | `js/app.js` | Service creation, navigation wrappers, cross-screen event binding. |
| State singleton | `js/appState.js` | Shared references to services, selected mode, game state, and session state. |
| Game core | `js/game/` | Game engine and ModeMastery logic. |
| Screens | `js/screens/` | UI for home, game, results, store, settings, achievements, and onboarding. |
| Helpers | `js/helpers/` | DOM utilities, haptics, display helpers, system integration, onboarding. |
| Services | `js/services/` | Bounded progression, a single daily goal, ads, theme/effects integration, sharing. |
| Rendering | `js/renderers/` | Avatar and shape markup renderers. |

## Screen Coupling Rules

Screens should not import other screens for small UI side effects. Use these patterns instead:

- Shared display state goes in `js/helpers/`.
- Shared domain behavior goes in `js/services/` or `js/game/`.
- Cross-screen navigation belongs in `js/app.js`.
- Screen-to-orchestrator notifications can use narrow custom events such as `scs:show-home`.

Current shared helpers include:

- `helpers/avatarDisplayHelper.js`
- `helpers/livesDisplayHelper.js`
- `helpers/modeUnlockHelper.js`
- `helpers/systemIntegration.js`
- `helpers/xpBarHelper.js`
- `services/EffectsService.js`

## Game Screen

`js/screens/GameScreen.js` remains the densest module because it owns active gameplay UI. Keep changes incremental and validate after meaningful edits. ModeMastery lifecycle work is centralized in `js/screens/gameHud/modeMasteryLifecycle.js`, and per-answer ModeMastery updates are dispatched from `updateModeMasteryAfterAnswer`.

`GameEngine._scheduleSpawn` is the single owner of normal and Rush successor/deadline timers. Rush counts actual emitted items and finishes when its last item is resolved; it does not queue fixed-duration pauses. Rush and corner Shuffle cannot own spawning simultaneously. `helpers/gameNotice.js` owns one bounded, prioritized footer notice with cleanup on leaving the game; no notice schedules game logic or injects styles. Keep the stimulus fully readable on its first frame.

## CSS

`css/style.css` imports partials in order. Later partials intentionally override earlier ones, so avoid moving imports casually.

Important partials:

- `01-tokens.css`: design tokens and theme base values.
- `04-home.css`: home screen.
- `05-game.css`: gameplay and tutorial surfaces.
- `06-overlays.css`: results, pause, leaderboard, achievements, settings, store, wheel overlays.
- `09-extensions.css`: mode unlocks, themes, responsive extensions.
- `10-micro-modes.css` and `11-mode-mastery.css`: mode-specific UI.
- `12-polish-v18-v19.css`: final polish and overrides.
- `13-mobile-2026.css`: canonical responsive UI surfaces, shared arena coordinates, accessible controls and text sizing.
- `14-mode-worlds.css`: studio-lit stage materials, mode-specific atmosphere, bounded compositor light/impact animations and performance tiers. Stage decoration must never encode the next answer.

`renderers/shapes.js` provides material SVG silhouettes with a neutral clearcoat and edge highlight; the face's middle retains its exact answer color. Fill and rim reuse one neutral paint to bound SVG/DOM work; cached gameplay clones receive unique paint IDs and retarget both references. `renderers/modePreview.js` shares previews between the home carousel and mode catalog. The catalog uses the common modal controller for focus trapping, Escape/Back and inert-background cleanup. Answer confirmation state and streak lighting live on the decorative stage rather than the full game root to keep style invalidation local.

`renderers/arenaWorld.js` defines ten whitelisted static architectures, shared by stage scenery and mode previews. They never receive stimulus/answer data. World names and task summaries are localized in the selector; world/plinth silhouettes vary while common buttons retain consistent geometry, theme fills and label colors.

`helpers/livingArena.js` preserves the fallback stage lifecycle: two small, CSS-animated studio lights on high quality, static atmosphere on mid, no light layers on low. When Phaser is ready, this stage is hidden and its redundant impulse/depth work is suppressed. Its semantic phase attributes remain synchronized for existing UI and QA. Quantized `calm → flow → charged → surge → fever` state also drives the engine rails; reading modes build later and fever/decay updates are immediate. Neither backend adds full-screen streak glows or a fever overlay.

A single reusable 70 ms compositor impulse is emitted only after a correct answer using cached input geometry; every new stimulus cancels it and removes the committed direction. Local target rings/springs transform only decoration or SVG contents, never the button's hit area. Optional `arenaDepth` is saved locally and defaults to false. On visible, active high quality with motion allowed, passive primary-pointer events coalesce into at most one requested frame, moving **only** `.arena-scenery` by at most ±4/3 CSS pixels. No sensor permission, geometry read or persistent frame loop is involved. Release, resize, pause, hiding, opt-out, quality/motion changes and teardown cancel/reset it. Countdown/tutorial cancellation also releases configured scenery before the first gameplay frame.

`helpers/gameFeedback.js` emits one world-specific material sound and short haptic after an accepted answer, including sequence steps. Perfect/bonus/multiplier accents are folded into this cue; the global menu tap handler excludes gameplay targets so it cannot overwrite it. `AudioManager.gameImpact` uses two immediate voices (at most three for perfect/bonus), a short attack, world/phase-specific pitches and mild panning toward an already committed correct target. Wrong answers stay centered. It queues no later notes, while quiet fever transitions preserve the music state. Haptics, sound and music remain independent settings; pause/hiding cancels feedback. Actual vibration availability/feel remains device-dependent.

## Shared surfaces and disclosure

`renderers/icons.js` owns whitelisted, identifier-free vector UI icons. Chaos uses the cached material renderer inside the existing size-coded boxes; Focus uses shared vector arrows without changing flankers or answer mappings. Branding, mode instructions and tutorial objects reuse the same preview/material renderer. Gameplay enters without a moving screen transition, preserving fixed input geometry from its first frame. Only committed-answer route segments are painted; redundant orbit layers are removed.

`helpers/appDialog.js` owns one lazy, recycled application dialog. Content uses `textContent` (including optional read-only share text), the shared modal stack owns focus/inert isolation, and Escape/Back/backdrop cancellation never confirms a purchase. Navigation settles pending requests as cancelled. Store purchase/activate controls expose the existing `SaveService` level gate instead of silently purchasing an item that cannot be activated. `getAvatar()` returns a copy, and removal clears both current and legacy photo locations; photo rendering has bounded size and a visible failure state.

The optional feedback group is attached only inside opened result details, with vector faces and explicit skip/rating controls. It does not float over replay/navigation or auto-disappear while the player is reading. Leaving results dismisses it. Install suggestions use a separate top-anchored surface with a 44-pixel dismissal target, away from the play command. None of these surfaces changes game-engine timers or rewards.

Continuation advertises its time bonus only when a reserve life is actually available; the description is cleared/hidden otherwise and restored for a later eligible round. Manual score sharing uses one application dialog without a redundant toast behind it. `earned-progress-release-test.mjs` complements the seeded surface gallery with six naturally completed Colors/Shapes rounds, real continuation, earned awards/records/analysis and persisted reloads. It only reads gameplay QA snapshots, never writes progress or replaces clocks/game-over callbacks.

Standalone `js/legal.js` and `css/legal.css` are built separately from the fixed-viewport application. Both legal documents retain their English content and provide German translations. `?lang=de|en` is presentation state, not a different document: the worker resolves uncached offline language URLs to the correct precached legal page, never to the game shell. Settings links inherit the selected language. This is presentation/translation work, not a new legal policy or a legal-compliance certification.

`scripts/surface-release-test.mjs` combines actual navigation/input with explicitly seeded renderer fixtures for uncommon populated/result states. `visual-review.mjs` uses the same assertions and cannot delete overlays or force screen classes to bypass failures. `SCS_REVIEW_OUT` captures the gallery outside production assets, while compiled mode/touch/reward/PWA gates remain independent. Cloud account flows are not enabled or represented as tested by this guest-only release.

`img/icon-512.svg` is the raster-branding master, with a reusable `brand-mark` group. `brand:generate` derives the small web icon and store/Android PNG variants; no runtime renderer or dependency is added. Android's vector and monochrome marks use the same geometry, scaled into a 64dp box inside the adaptive icon's central 66dp safe circle. The native dark splash theme replaces the default white Capacitor image, and the generic `drawable-v24` robot override is removed so it cannot shadow the real mark. Asset tests inspect XML/pixels/geometry; actual Android resource compilation and physical-device rendering remain separate checks.

## Runtime Performance

### Precision Arcade surfaces

`01-tokens.css` owns the display font and radius scale; body-derived `--panel-fill`, `--control-fill` and `--material-edge` in `02-base.css` resolve against each active theme. Canonical responsive selectors in `13-mobile-2026.css` consume those materials. The obsolete parallel compact-results block in `12-polish-v18-v19.css` was removed rather than extending the cascade. Panel/control highlight endpoints are included in the static contrast gate. The existing two studio lights, phase changes, fixed hit boxes, exact stimulus colors and depth policy are preserved. Material lighting now has a broad neutral readable face and narrow vertical edge highlights instead of the diagonal plastic sheen; branding sources and generated native rasters use the same finish.

`renderers/designPreview.js` creates static, inert shop scenes from whitelisted themes, the real active trail configuration and the shared shape renderer. `.design-preview.theme-*` and `body.theme-*` use the same palette declarations; the local default does not inherit the currently equipped theme, and the derived preview material resolves locally. `StoreScreen` lazily creates one recycled preview dialog through the existing modal stack. It has no purchase/equip action, never starts the engine and closes on navigation, Back, Escape or backdrop, preserving focus isolation and return. Its Preview caption makes the action discoverable. An optional, user-requested 750ms example has at most two transform/opacity animations, cancelled on close, hiding or low/reduced-motion policy. It is illustrative, not an engine simulation. CSS theme fixtures remain distinguished from earned progression tests.

`WheelScreen.drawWheel` resolves palette values on opening and paints a logical 300px disk at a capped device ratio of 2. Spin frames update only the canvas transform and pointer cue; no text/gradient rasterization or computed-style reads happen in that loop. Normal/reduced/skipped spins all reuse the bitmap. One idempotent finisher cancels wheel/pointer frames and timers on Skip, hiding, Escape/Back or newly enabled reduced motion, then displays the already-picked result without rerolling. The busy flag spans animation **and persistence**, so duplicate input cannot open a second reward transaction. A same-document wheel history entry protects Back on the root screen; explicit closure consumes that entry without navigating screens. Prize weights, spin limits, default durations and awards are unchanged. New transient EffectsManager instances, shop cyan ripples and celebratory confetti are removed; life/streak status uses the existing prioritized game notice rather than a central flash/pop.

`precision-ui-test.mjs` exercises all 14 previews on three viewport sizes, palette parity with the real theme CSS, unchanged balances/preferences, local paint references, keyboard/Back/focus, static preview geometry and normal/reduced-motion wheel canvas-paint counts. Existing material tests now sample three parts of each readable palette face, not only the center pixel. The existing release gates remain mandatory.

### Reflow, orientation and local typography

The current carousel slide participates in layout rather than sitting inside a fixed-height clipping box; inactive slides remain inert/hidden. The home viewport scrolls when its intrinsic content exceeds the viewport. Its action grids use rem-aware minimum columns, the navigation dock participates in normal flow and label/dialog children do not shrink below their text. Canonical selectors have low enough specificity for intended wide-screen max-widths. Settings section buttons scroll to and focus the corresponding fieldset legend without hash/history navigation; all groups stay present and discoverable.

`systemIntegration.checkOrientation` returns an advisory only for a touch game arena below 500px landscape height. It never hides a screen or blocks input. Screen/orientation/resize events pause an active narrow arena through the existing pause function; `beginGame` also checks when a round starts while already rotated. Existing pause/settings/quit behavior remains available, and menus/dialogs are orientation-independent. This is not a new landscape-arena layout.

Gameplay ARIA names use localized, distinct displayed palette colors and directions for Colors, and localized silhouettes for shape modes. The center description contains visible task data only, never the target direction. Stroop/Chaos and covered Memo semantics are preserved. Unit coverage includes both full palettes and twelve silhouettes in both languages; compiled coverage checks live Colors DOM names.

Live task nodes relinquish the shell's direction-only `data-i18n-aria` fallback once rendered, so a global language pass cannot erase their color/shape information. Settings apply presentation changes immediately while persistence finishes. Returning to the pause menu/resuming refreshes corner/center presentation only when palette/language changed, without replacing the current stimulus or advancing a game phase. Covered Memo labels remain covered; Sequence's phase-owned center is not generically repainted. The browser gate changes language/palette during a real pause and asserts unchanged stimulus, score and hit rectangles as well as the refreshed painted palette and rich English names.

`css/style.css` declares the self-hosted, static Latin font cuts listed in `fonts/README.md`, distributed with `fonts/OFL.txt`. Only regular Outfit is preloaded. esbuild emits/copies the WOFF2 assets unchanged and derives production precache entries from its CSS metafile. The source worker lists those same fonts; its cache is bumped for the changed resources. The fonts work offline without Google Fonts requests. Windows WebKit incorrectly rendered variable weight axes despite reporting successful decoding, so QA also checks actual regular/bold pixel coverage. This probe exists only in tests, never in the runtime. `AudioManager._ensure` returns false for missing/rejected Web Audio construction; file playback can still work and procedural scheduling never dereferences an unavailable context.

`usability-release-test.mjs` checks 320px, compact/wide landscape and desktop layouts with German/English and 16/32px root-font fixtures, including focus-moving settings shortcuts, visible/inert previews and motion cancellation, four wheel finish paths with exactly one real guest reward, live accessible color labels and local font weight rendering. Default verification uses Chromium; `SCS_BROWSERS=chromium,firefox,webkit` runs the same suite in all installed engines. Root-font fixtures do not certify system text scaling, native screen readers, device touch/thermals or full WCAG compliance. Those physical/user tests remain separate.

`helpers/perfMode.js` owns quality detection, session-scoped downgrades and gameplay-only frame sampling. `EffectsManager` follows its tier/motion events instead of running a second device benchmark. Its particle trajectories use bounded transform/opacity animations with cancellation and recycling; trail draws are coalesced and use a tier-capped backing store. `SwipeHandler` caches fixed target geometry and invalidates it on mode/layout/resize/scroll changes. HUD updates are diffed and cached material nodes have a bounded per-round cache. Inactive screens release their layout trees after the exit transition.

## Round presentation and optional comparison

`helpers/roundCue.js` owns one recyclable in-arena status cue with one cancellable timeout, not a game clock. `GameScreen` first suspends input/feedback on the engine's real end callback, preserving fixed target geometry and visible scene state. After 420ms it cleans up and opens the continuation/final result. No-life offers are bypassed. Decline finalizes in place without a second cue; true continuation rebuilds scene/input/trail bindings and covered Memo names, then calls the unchanged continuation engine timer **after** a 300ms ready cue. Back/new navigation cancels delayed work; cancelling readiness refunds its reserved life. Reduced motion/hiding finishes decoration immediately, and a continuation resumed while hidden/narrow-landscape enters the existing pause flow.

`ResultsScreen` prepares new content before changing screens and guards asynchronous persistence with its generation token. During in-place saving the action region is inert. The continue preview displays raw points without rewards; final settlement counts only raw→final bonuses for 360ms, with a static final accessible name and visible breakdown. Stats/actions are available immediately. Hiding or motion reduction settles the count; leaving results cancels it. Shared `modeArtwork`/theme tokens add decorative world identity to both the cue and result, not new live arena geometry. `AudioManager.roundEnd` cancels queued cues/tension, fades music for 180ms and plays one short two-voice cadence; stop/start/visibility cancel its finisher. The old global loss flash and long game-over pad are removed.

`helpers/bestRun.js` is the canonical opt-in comparison presenter data source, replacing exposure of the old hidden mode-only ghost HUD. It uses accepted-answer/elapsed updates and stores bounded, once-per-active-second raw-score samples in the existing mode mastery save, under versioned `bestRuns` play-type/original-duration keys. Only natural, unextended Blitz/Marathon finishes with a hit may commit a reference, once, before mastery persistence. The engine's `continued` flag is also used for declining, so actual continuation use is tracked separately. End bonuses select the best final run but never enter its live pace. Old/corrupt/unscoped references are not promoted; comparisons stop when the reference ends and do not leak future samples. There is no extra clock/frame loop or live storage write, and the default-off setting avoids pace lookup work when hidden. Legacy mastery metrics remain intact.

Result details offer a truthful mode-specific practice suggestion through `app.js`, reusing the practice engine rather than changing ranked/daily rules or claiming a diagnosis. Only practice scheduling changes: an unanswered item remains present, Sequence input has no timeout/life depletion, and stopping/ending practice cannot submit a score or mastery/progression receipt. Scored-round scheduling, rewards, Shuffle/Rush, answer windows, palettes and hit rectangles are unchanged. The Rush scheduler regression now explicitly tests a scored round and stubs only its unrelated combo-decay timer, rather than misusing the practice flag to suppress it. Its one-deadline assertions and the 320/400ms scored successor bounds remain mandatory.

## Live arena experience

The ten existing `arenaWorld` entries also own identifier-free architectural relief paths for previews and the fallback stage. Phaser now supplies live architecture as described under **Prism Arcade** above; `14-mode-worlds.css` still supplies mode-specific DOM chassis, inset faces and contact shadows. Engine task data, palettes and material SVG geometry remain unchanged. Rounded/cut/radial surface silhouettes never translate/scale the input elements. The old 374px `!important` rule that forced **every** nested center SVG to 60px was removed: it incorrectly enlarged Chaos's rule icon and defeated size-coded Chaos symbols on compact screens. Canonical material/icon dimensions now apply there too, rather than claiming compact SVG display sizes stayed at 60px.

`helpers/arenaPhase.js` is a pure, read-only projection of existing engine fields. Priority is orientation/remembering before Rush/reward states; actual emitted Rush index/count, paused Fever remainder and the existing cooldown deadline are used. Sequence has explicit watch/recall/ready presentation, with no pattern directions exposed. `GameScreen.syncArenaPhase` runs on existing spawn/result/HUD/phase callbacks, diffs stage and HUD attributes, and updates the **existing multiplier group** rather than introducing an overlay over the task. Phase labels have localized accessible multiplier/state names; the small quantized meter is decorative, not another clock or interaction. No game-engine scheduler, duration, reward threshold or input acceptance rule changed.

`impactQuality` supplies the same accepted-answer classification to sound, haptics and local target feedback. Sequence uses the same confirmation path as other answers; completion points stay at the committed target, not over the next sequence. Good/perfect/bonus contacts have restrained, neutral single/double-rim differences and short decorative springs. Ten bounded sound registers share the existing two/three immediate voices. Bonus particles and old central WATCH/GO spinning text are replaced, not stacked. Memo reveal/cover and Sequence flashes keep stationary hit rectangles; necessary watch cues remain visible even with motion reduced. Old shape/timer shaking/glowing overrides are removed or disabled rather than becoming a second visual system.

`AudioManager.setArenaPhase` coalesces changes into one cancellable next-beat update. Normal MP3 playback uses its actual playhead/rate and the generated track's BPM; the procedural fallback uses its existing audio epoch. The same media element is routed through at most one reusable lowpass filter when Web Audio supports it, allowing real quiet/open file timbres and mix changes without added tracks, stems, downloads or SFX layers. No-Web-Audio keeps plain file playback. Pause/stop/hiding clears the pending phase; immediate answer cues are never beat-delayed. This is a phase-aware EQ/mix, not independently remixed MP3 instruments or a new adaptive-stem soundtrack. The source gate checks actual HTML-audio playhead advancement/filter routing; it does not claim a physical listening or vibration test.

`arena-experience-release-test` serves the compiled build, with explicit frozen-clock/constant-RNG fixtures for comparable screenshots (not earned progress or performance measurements). It checks all ten worlds, accepted controls, fixed rectangles, Memo/Sequence transitions, compact rule icons and enlarged narrow HUD layout in selected browsers. Real naturally timed round and 100-answer tests remain independent. The latter now require both actual Rush item indices plus calm/flow/fever/cooldown phases in normal play. Original 480/255KB caps and quality/motion/depth policies remain mandatory.

## QA Gates

`npm run verify` is the default local gate. It checks static contrast, deterministic performance resource limits, builds the production bundle, scans rendered screens for contrast, and runs a smoke test through the core gameplay flow.
