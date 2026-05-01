# SCS Play

SCS Play is a mobile-first reaction and brain-training game built as a Progressive Web App with a Capacitor Android wrapper. Players sort shapes, colors, words, math prompts, memory sequences, and rule-switching challenges by swiping toward the correct direction.

## What Matters

- Vanilla JavaScript ES modules, no frontend framework.
- Source lives in `js/`, `css/`, `audio/`, `img/`, and root app files.
- Production output is generated into `docs/` by `npm run build:prod`.
- Do not manually edit generated files in `docs/`.
- Guest mode works without backend setup; Firebase auth/cloud sync is optional.
- CI requires static contrast audit, production build, DOM contrast audit, and smoke test.

## Quick Start

```bash
npm ci
npm run verify
```

For day-to-day browser testing, build the production bundle and run any static server against `docs/`:

```bash
npm run build:prod
npx serve docs
```

The automated smoke and visual scripts start their own local static server unless `SCS_BASE` is set:

```bash
npm run smoke-test
npm run visual-review
```

## Scripts

| Command | Purpose |
| --- | --- |
| `npm run build:prod` | Bundle JS/CSS into `docs/` with size budgets. |
| `npm run build` | Build the web assets for Capacitor development sync. |
| `npm run contrast-audit` | Static WCAG token/theme contrast audit. |
| `npm run contrast-audit:dom` | Playwright scan of rendered app screens for text/background contrast. |
| `npm run smoke-test` | Critical boot -> guest -> home -> game -> results flow. |
| `npm run visual-review` | Capture mobile screenshots for manual review. |
| `npm run verify` | Full local gate: contrast, build, DOM contrast, smoke. |
| `npm run cap:sync` | Build production web assets and sync Android. |
| `npm run cap:run` | Build and run through Capacitor Android. |

## Project Map

```text
SCS Play/
  index.html                  App shell and screen markup
  css/style.css               CSS partial entrypoint
  css/partials/               Design tokens, screens, overlays, polish
  js/app.js                   App orchestrator and global event wiring
  js/appState.js              Shared singleton state
  js/game/                    Game engine and mode mastery core
  js/screens/                 Screen-specific rendering and bindings
  js/helpers/                 DOM, haptics, onboarding, display helpers
  js/services/                Ads, quests, season pass, effects, sharing
  scripts/                    Build, QA, contrast, screenshot tooling
  android/                    Capacitor Android project
  docs/                       Generated production web output
```

## Quality Bar

Before opening a PR or handing the repo to another developer, run:

```bash
npm run verify
```

The contrast gates enforce WCAG AA expectations across tokens, themes, common states, and rendered screens. If a screen introduces new text over a new surface, update both CSS and the relevant audit coverage instead of weakening the checks.

## Firebase

The game runs in guest mode out of the box. To enable cloud auth/sync, configure Firebase in `js/auth.js` and keep all project secrets out of git. Android signing files, `google-services.json`, keystores, and `.env` files are ignored by default.

Firestore rule baseline:

```js
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /saves/{userId} {
      allow read, write: if request.auth != null && request.auth.uid == userId;
    }
  }
}
```

## More Docs

- [ARCHITECTURE.md](ARCHITECTURE.md)
- [CONTRIBUTING.md](CONTRIBUTING.md)
- [BUILD.md](BUILD.md)
- [SECURITY.md](SECURITY.md)