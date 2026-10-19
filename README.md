# SCS Play

SCS Play is a mobile-first reaction and brain-training game built as a Progressive Web App with a Capacitor Android wrapper. Its release catalog focuses on ten top-level modes covering sorting, math, knowledge, memory, focus, and rule-switching challenges.

## What Matters

- Vanilla JavaScript ES modules, no frontend framework.
- Source lives in `js/`, `css/`, `audio/`, `img/`, and root app files.
- Production output is generated into `docs/` by `npm run build:prod`.
- Do not manually edit generated files in `docs/`.
- The current Google Play release is guest-only and keeps gameplay data local; Firebase auth/cloud sync remains unconfigured development scaffolding.
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

The smoke script starts a production server (or uses `SCS_BASE`). The visual review serves local source and runs the asserted surface-state gallery:

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
| `npm run service-worker-test` | Regression coverage for cached media ranges, cache failures, and scoped worker lifecycle. |
| `npm run pwa-release-test` | Real-browser checks for all music tracks, range responses, and offline loading; supports `SCS_BASE`. |
| `npm run reward-release-test` | A real first round, quiet results, reward limits, and existing-save migration; supports `SCS_BASE`. |
| `npm run earned-progress-release-test` | Six naturally timed rounds on a fresh guest profile, real life continuation, earned records/milestones/analysis and reload persistence. No seeded scores or clock overrides; allows about four minutes and supports `SCS_BASE`. |
| `npm run visual-review` | Capture the asserted phone/desktop surface gallery to `%LOCALAPPDATA%/Temp/opencode/scs-surface-review`; override with `SCS_REVIEW_OUT` and optionally `SCS_REVIEW_VIEW=phone\|small\|desktop`. |
| `npm run surface-release-test` | Local-source navigation and state-gallery checks: dialogs, purchases/level requirements, photos/errors, keyboard tutorial, results, wheel/motion, notifications, themes, language and legal documents. Some uncommon states use explicitly seeded fixtures. |
| `npm run precision-ui-test` | Compiled UI: 14 static shop previews on three sizes, real-theme palette parity, no spending/equipping, focus/Back/Escape and single-bitmap normal/reduced-motion wheel spins. Supports `SCS_BASE`. |
| `npm run usability-release-test` | Compiled DE/EN reflow at 320px through desktop, 16/32px root-font stress, landscape menus, section navigation, local font decoding/real weight rendering, preview motion cleanup, localized live color names and four ways of finishing a wheel spin without duplicate rewards. Defaults to Chromium; `SCS_BROWSERS=chromium,firefox,webkit` expands coverage. |
| `npm run round-finale-logic-test` | Scoped/bounded personal-best references, raw/bonus separation, DE/EN highlights and self-paced practice-only scheduler/Sequence guards. |
| `npm run round-finale-release-test` | Compiled natural timeout, single finale, same-card settlement, immediate actions, optional comparison, practice, single-charge continuation, restored Memo/input and cancel/refund paths. Supports `SCS_BASE` and `SCS_BROWSERS`. |
| `npm run presentation-release-test` | Check the ten mode layouts, mode catalog, themes, settings, motion preferences and feedback on phone/desktop viewports. |
| `npm run perf-benchmark` | Play a round with a scripted fast player under CPU throttling and report frame times, long tasks and style/layout cost per pace bucket (see flags in the script header). |
| `npm run performance-release-test` | Deterministic resource/work limits for particles, trails, input geometry, motion and the frame-rate governor. |
| `npm run living-arena-test` | Bounded studio lights/answer impulses, stable hit areas, pause/tier/motion cleanup, all 12 silhouettes and exact normal/colorblind face colors. |
| `npm run brand:generate` | Refresh web/store PNGs and Android legacy/adaptive/splash rasters from the shared material icon. |
| `npm run brand-assets-test` | Check icon master consistency, raster palette/dimensions, native XML sources and adaptive safe-zone geometry. Not an Android device test. |
| `npm run game-feedback-test` | World/phase contact sounds, immediate bounded voices, one short answer haptic, independent preferences and blocked-device safety. |
| `npm run streak-flow-test` | Virtual-clock regression: 100 correct answers in five modes, phase overlap, Rush deadlines and pause cleanup. |
| `npm run streak-presentation-test` | Real-browser flawless streaks through combo, Shuffle, Rush and cooldown; first-frame symbol visibility and unobstructed targets. |
| `npm run verify` | Full local gate: static checks, logic/service worker tests, contrast, build, PWA/offline checks, DOM contrast, and smoke. |
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
  js/services/                Quests, effects, sharing, and ad demo scaffolding (no packaged ad SDK)
  fonts/                      Self-hosted Latin font cuts, provenance and SIL OFL license
  scripts/                    Build, QA, contrast, screenshot tooling
  android/                    Capacitor Android project
  docs/                       Generated production web output
```

## Presentation

The game uses a lightweight 2.5D presentation, not a 3D engine: material SVG silhouettes, a shared neutral arena, and local answer feedback. Directional light only confirms a committed answer; scene decoration must never disclose the next answer. Reading modes use wider answer cards and a protected question surface. The mode catalog uses the same previews as the home carousel.

UI colors are defined in `css/partials/01-tokens.css` and the theme definitions in `09-extensions.css`. Theme-aware action labels use `--on-primary`, including dark labels on bright themes. The static contrast gate reads those source tokens directly; browser contrast coverage also checks every theme and the mode catalog.

Performance tiers share one policy for CSS and effects. Short particle trajectories are baked into compositor animations; input bounds and material nodes are reused, and unchanged HUD values are not rewritten. The trail canvas is capped at 2× / 1.5× / 1× resolution for high / mid / low tiers and clears only its previous drawn bounds. The governor samples active gameplay, not menus or pauses, and keeps downgrade decisions within the current tab session. See `BUILD.md` for repeatable benchmarks; emulated FPS is not an Android device guarantee.

Gameplay notices are a single compact footer status, not center-screen celebrations. Combo/fever/cooldown text never holds the next item or injects a stylesheet mid-round. A stimulus is fully opaque on its first frame. Rush uses the same single spawn scheduler as normal play: a correct answer advances promptly, while unanswered items retain their minimum answer window. Shuffle keeps its short orientation cue, without an extra post-animation wait.

The Living Arena adds neutral clearcoat/rim materials and ten distinct architectural worlds. The mode selector/instructions now give each world its own illustrated silhouette, without adding geometry to the live arena. Two small studio lights replace the previous floating dots. Five peripheral energy stages build with a streak, without a full-screen glow or center-screen celebration. Reading worlds remain restrained. Correct answers emit one short, reusable light impulse and a local target ring/spring. These never move hit areas, hold a successor or persist into the next stimulus.

Optional **Moving background** in Settings is off by default: primary mouse/touch movement shifts only the backdrop by at most ±4/3 pixels, on high quality with motion allowed. Its status explains when motion/quality settings suspend it. Inputs are coalesced into one frame; idle gameplay adds no depth loop. Pause, visibility, tier/motion changes and release reset the scenery. World-specific contact sounds and short haptics share the accepted-answer event rather than stacking perfect/combo/menu buzzes. Sound, music and vibration keep independent controls. No 3D engine, sensor permission or runtime dependency is required.

The surface-coherence pass reuses material objects in branding, tutorials and Chaos, with shared vector UI icons. Chaos size ratios and all task colors stay intact. A single world silhouette replaces stacked decorative rings; routes are invisible until confirmation. The desktop selector uses a composed two-column stage, the catalog describes tasks as well as worlds, and settings group related controls rather than boxing every row. Results distinguish unanswered rounds, continuation, records and completed rounds, without fake zero-XP rewards. Reserve lives are explained separately from Endless round lives.

Shop confirmations and manual-share fallbacks use a bounded, accessible in-app dialog with cancel-on-Escape/Back and focus restoration, not browser alerts/prompts. The shop discloses the existing service-level unlock requirements before spending currency. Start-up has no cosmetic minimum wait. Web/store icons, native launcher rasters and splash art share the material silhouettes; the Android API-24 robot override and white Capacitor splash are replaced. Legal pages share a readable dark layout, German/English versions and an offline-capable language switch; the original English legal content is retained. Game insights and its text export describe activity rather than claiming to measure enjoyment or ability. Visual review is not a substitute for physical Android testing or legal review of translations.

The Precision Arcade art direction refines these existing systems rather than adding another renderer: narrow neutral material highlights, shallower extrusion, shared panel/control finishes and display/numeric typography. Menu, catalog, tutorial, game, results, records, achievements, avatar, settings, analysis and dialogs share the same material tokens. Shop thumbnails open a static schematic arena/trail preview using the actual theme/trail declarations, without buying/equipping a design. The wheel paints one capped-2x themed bitmap and rotates it instead of redrawing all labels each frame. Unrelated cyan ripples/confetti and center-screen life/streak flashes are removed; status stays in the existing peripheral notice. Engine rules, answer scheduling and target coordinates are unchanged. This is a 2D/SVG implementation inspired by game-UI craft, not Unreal Engine or real PBR rendering.

The usability follow-up makes home content intrinsic-height/scrollable and lets play types, labels, dialogs and menu grids reflow at larger text sizes. The dock stays in document flow, so enlarged text cannot be hidden beneath it. Settings provide focus-moving section shortcuts and a wide-screen sidebar; the desktop shop uses two columns. The orientation hint no longer hides or blocks any menu. Rotating an active narrow touch arena pauses it; its normal resume/settings/quit controls stay usable. The arena remains designed for portrait rather than promising a new landscape gameplay layout.

Color-mode accessible names describe the displayed palette color and target direction instead of four identical “square” labels. Shape names cover all twelve silhouettes in German/English; the stimulus does not announce a correct direction and covered Memo corners remain covered. Actual screen-reader speech/navigation on a smartphone still needs device review.

Changing palette/language from a paused round now refreshes the current display before play resumes, without changing the item, score or target geometry. Global localization cannot overwrite these task names with direction-only shell labels.

Shop thumbnails have a visible Preview caption. The enlarged scene uses the real material shapes, active trail and theme declarations. An explicitly requested 750ms example animation has at most two transform/opacity animations, never starts a game, cannot buy/equip a design and cancels on close, hiding, low quality or motion reduction. It remains an illustrative example, not a promise of a fully simulated round. Wheel Skip, Escape/Back or newly enabled reduced motion finish the already-picked spin; the transaction stays busy until its one reward is saved. A root-screen history guard keeps browser Back inside the wheel flow.

Outfit and Space Grotesk are self-hosted Latin WOFF2 cuts with their OFL license, precached for offline use. Static cuts deliberately avoid incorrectly rendered variable weight axes observed in Windows WebKit. The game adds no runtime raster probe or font-CDN request. Its German/English privacy text reflects this resource change, not a professional legal sign-off. Missing/unavailable Web Audio no longer blocks app startup; supported file music remains independent of synth availability.

## Complete Round Flow

When time or round lives run out, scoring stops immediately. The stationary arena holds for a short 420ms material/world cue before the continuation or final card appears; reduced motion/hiding skips that decorative hold. There is no full-screen red loss flash. Declining continuation settles the same result card, rather than replaying the ending. The interim score is raw play points; only final settlement adds the existing end bonuses, with an explicit breakdown and optional 360ms count-up. Decisions and useful stats do not wait for this animation. One factual streak/record highlight and the selected world's illustration carry the arena identity into results.

Using a reserve life gives a short 300ms ready cue **before** the existing 15-second continuation timer starts. Duplicate activation charges once, cancelling readiness refunds the reserved life, and input/trail/Memo cover state is restored. No extra scoring grace or change to scored-round deadlines is introduced. Music fades into one short, outcome-specific cadence; existing milestone sounds are not stacked at time zero.

The default-off **Personal-best comparison** setting shows one small, non-interactive raw-score delta, replacing the old proximity pill when active. References are local mastery data, scoped by mode, play type and original duration; only naturally completed, unextended Blitz/Marathon rounds with a correct answer can replace them. Daily, competition, endless and practice rounds are excluded. Pace samples are bounded to one per active second (maximum 240 seconds); no additional clock, frame loop or per-answer storage write is introduced. Older mode-only ghost data is not silently treated as a comparable reference.

Opened round details offer a mode-specific practice suggestion and a route into the existing practice engine. Practice tasks now wait for an answer rather than replacing themselves; Sequence practice has no input deadline or round-life loss. These guards apply **only to practice**. Practice is explicitly labeled, has a visible stop action and does not save scores, award progress or spend reserve lives. This is self-paced mode practice, not a claimed diagnosis or automatically generated remedial curriculum.

## Lean Progression

Qualified rounds require at least 20 active seconds and a mode-appropriate answer sample: 10 sorting/memory answers, 5 reading/thinking answers, or 6 sequence inputs, with at least half that minimum answered correctly. They earn 20–30 XP in Blitz, 40–50 XP in Classic, or bounded playtime-based XP in Endless. Score multipliers and fast-answer counts do not multiply progression rewards.

There is one daily goal requiring three qualifying rounds, 17 long-term milestones, and no automatic season-pass payouts. Mastery ranks require five qualifying rounds and sufficient samples in the mode. First scores establish personal-best baselines; results show at most one milestone and put extra analysis behind **Round details**.

Existing XP, balances, purchases, earned awards and mastery ranks are preserved. Earlier awards remain available in the earned-achievement archive.

## Quality Bar

Before opening a PR or handing the repo to another developer, run:

```bash
npm run verify
```

The contrast gates enforce WCAG AA expectations across tokens, themes, common states, and rendered screens. If a screen introduces new text over a new surface, update both CSS and the relevant audit coverage instead of weakening the checks.

## Firebase (Not Enabled in the Current Release)

The Google Play release runs in guest mode and does not offer account creation or cloud sync. The source contains an optional Firebase path for development, but `js/auth.js` has no Firebase project configuration. Enabling it would change the release's privacy and account-deletion obligations and requires a separate release review. Keep all project secrets out of git. Android signing files, `google-services.json`, keystores, and `.env` files are ignored by default.

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
