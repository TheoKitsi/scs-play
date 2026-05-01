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
| Services | `js/services/` | Ads, quests, season pass, theme/effects integration, sharing. |
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

## QA Gates

`npm run verify` is the default local gate. It checks static contrast, builds the production bundle, scans rendered screens for contrast, and runs a smoke test through the core gameplay flow.