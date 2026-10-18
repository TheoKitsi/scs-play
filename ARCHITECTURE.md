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
- `14-mode-worlds.css`: neutral static stage materials and performance tiers. Stage decoration must never encode the next answer.

`renderers/shapes.js` provides material SVG silhouettes; cached gameplay clones receive unique gradient IDs. `renderers/modePreview.js` shares previews between the home carousel and mode catalog. The catalog uses the common modal controller for focus trapping, Escape/Back and inert-background cleanup. Answer confirmation state and streak lighting live on the decorative stage rather than the full game root to keep style invalidation local.

## Runtime Performance

`helpers/perfMode.js` owns quality detection, session-scoped downgrades and gameplay-only frame sampling. `EffectsManager` follows its tier/motion events instead of running a second device benchmark. Its particle trajectories use bounded transform/opacity animations with cancellation and recycling; trail draws are coalesced and use a tier-capped backing store. `SwipeHandler` caches fixed target geometry and invalidates it on mode/layout/resize/scroll changes. HUD updates are diffed and cached material nodes have a bounded per-round cache. Inactive screens release their layout trees after the exit transition.

## QA Gates

`npm run verify` is the default local gate. It checks static contrast, deterministic performance resource limits, builds the production bundle, scans rendered screens for contrast, and runs a smoke test through the core gameplay flow.
