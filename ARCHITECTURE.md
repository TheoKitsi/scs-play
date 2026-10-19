# Architecture

## Stack

- Vanilla JavaScript ES modules.
- CSS partials imported by `css/style.css`.
- Playwright for browser QA.
- esbuild for production bundling.
- Capacitor Android wrapper.

## Runtime Shape

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

`helpers/livingArena.js` owns the stage lifecycle: two small, CSS-animated studio lights on high quality, static atmosphere on mid, no light layers on low. These replace, rather than stack on, the floating ambient dots. Reading worlds keep the lights static. Quantized `calm → flow → charged → surge → fever` state lives on the stage; unchanged phases do not rewrite attributes. Reading modes build later, and fever/decay updates are immediate. Local light rails/rims replace the old full-screen streak glows and fever overlay.

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

## QA Gates

`npm run verify` is the default local gate. It checks static contrast, deterministic performance resource limits, builds the production bundle, scans rendered screens for contrast, and runs a smoke test through the core gameplay flow.
