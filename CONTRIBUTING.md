# Contributing

Welcome. This project is intentionally small-stack: vanilla ES modules, CSS partials, Playwright QA, and Capacitor for Android.

## Local Setup

```bash
npm ci
npm run verify
```

Use Node 20 when possible because CI uses Node 20.

## Development Rules

- Edit source files, not generated files in `docs/`.
- Keep screen modules focused on their own DOM. Shared UI updates belong in `js/helpers/` or `js/services/`.
- Keep `js/app.js` as the orchestration layer for cross-screen wiring.
- Prefer existing helpers: `helpers/dom.js`, `helpers/haptics.js`, `services/EffectsService.js`, `helpers/xpBarHelper.js`, and display helpers.
- Do not introduce a framework or new runtime dependency without a clear reason.
- Keep CSS in the matching partial and preserve the import order in `css/style.css`.
- If a new color/surface pair is introduced, update contrast coverage.

## Pull Request Gate

Before opening a PR:

```bash
npm run verify
```

Include the user-visible behavior changed, the QA commands run, and any known limitations. If a test cannot be run locally, say why.

## Branch Hygiene

- Work in branches, not directly on `main`.
- Keep commits focused.
- Do not commit `.env`, keystores, `google-services.json`, APK/AAB output, or local IDE files.
- Do not force-push shared branches without explicit coordination.

## Accessibility Bar

The app is mobile-first and fast, but contrast and readability are non-negotiable. The static and DOM contrast audits are part of the required gate. Prefer stronger text tokens over opacity-based dimming for readable text.