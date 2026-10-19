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

`helpers/perfMode.js` owns quality detection, session-scoped downgrades and gameplay-only frame sampling. `EffectsManager` follows its tier/motion events instead of running a second device benchmark. Its particle trajectories use bounded transform/opacity animations with cancellation and recycling; trail draws are coalesced and use a tier-capped backing store. `SwipeHandler` caches fixed target geometry and invalidates it on mode/layout/resize/scroll changes. HUD updates are diffed and cached material nodes have a bounded per-round cache. Inactive screens release their layout trees after the exit transition.

## QA Gates

`npm run verify` is the default local gate. It checks static contrast, deterministic performance resource limits, builds the production bundle, scans rendered screens for contrast, and runs a smoke test through the core gameplay flow.
