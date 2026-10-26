# SCS Play

SCS Play is a mobile-first offline game for Web/PWA and Capacitor Android. **Prism Worlds** adds a Phaser 4 action-puzzle adventure: aim energy pulses, trigger crystal chains, use mirrors, colour rings and switches, and restore three illustrated floating gardens across twelve handcrafted puzzles. **Prism Arcade** upgrades all ten existing reflex, math, memory and attention modes with engine-rendered stages while retaining their rules and saves.

## Prism Worlds

Choose **Prism Worlds** on the home screen. Tap to aim and press **Launch pulse**, or drag and release. Every crystal must awaken within the level's pulse allowance. There is no countdown, energy paywall, advertisement or real-money purchase. Undo and retry are free. Matching colours also have different geometric symbols; named target selection, keyboard aiming and DOM launch controls provide alternatives to dragging.

Earned stars restore the world illustration and unlock the next puzzle. Replays retain the best result without adding duplicate rewards. Shared `?prism=<level-id>` links open a clearly labelled free-play puzzle, never bypassing campaign unlocks. All campaign data stays on the device; no remote analytics service was enabled.

See [PRISM_WORLDS.md](PRISM_WORLDS.md) for architecture, scope, research sources and remaining physical-device/release checks. This source addition does not by itself publish the existing live website or submit a Play Store release.

The current release task targets **the existing GitHub Pages site only**, for owner testing. Home shows earned campaign progress, the world map names each puzzle, aim/results explain angle and pulse efficiency, and arcade stages respect selected design themes. Settings disclose browser-local saves and offer a visible retry if a preference cannot be persisted. This is a first chapter/test build, not a verified Top-5 or retention claim.

## What Matters

- Vanilla JavaScript ES modules, no frontend framework; Phaser 4.2.1 is shared and lazy-loaded when starting the adventure or arcade.
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
| `npm run prism-logic-test` | All twelve authored puzzle solutions, collision/chain rules, undo, migration and save rollback. |
| `npm run prism-release-test` | Naturally played compiled campaign, persistence failures/retry, offline/reload, responsive controls and shared challenges. Supports `SCS_BROWSERS`. |
| `npm run arcade-engine-release-test` | Real input in all ten Phaser-backed modes, fixed geometry, Memo concealment, reduced-motion Sequence cues, pause/disposal, depth and graphics-fallback fixtures. Supports `SCS_BROWSERS`. |
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
| `npm run arena-phase-logic-test` | Read-only phase priority, actual Rush item count, paused Fever remainder, cooldown and protected memory phases; no engine mutation. |
| `npm run arena-experience-release-test` | Compiled ten-world fixtures, real accepted controls, fixed target rectangles, Memo/Sequence phase transitions, compact rule icons and enlarged narrow HUD. Supports `SCS_BASE`, `SCS_BROWSERS`, `SCS_REVIEW_OUT`; `SCS_ARENA_ROOT`/`--baseline` archive comparable frozen presentation fixtures, not earned rounds/FPS. |
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
  js/engine/                  Shared Phaser adventure and hybrid arcade stages
  js/screens/                 Screen-specific rendering and bindings
  js/helpers/                 DOM, haptics, onboarding, display helpers
  js/services/                Quests, effects, sharing, and ad demo scaffolding (no packaged ad SDK)
  fonts/                      Self-hosted Latin font cuts, provenance and SIL OFL license
  scripts/                    Build, QA, contrast, screenshot tooling
  android/                    Capacitor Android project
  docs/                       Generated production web output
```

## Presentation

Prism Worlds uses a Phaser-rendered puzzle arena and scoped `css/prism.css`. All ten arcade modes now share a hybrid Phaser stage (`js/engine/ArcadeArena.js`, `css/arcade-engine.css`). Phaser draws the architecture, neutral stations, energy rails and accepted-hit effects; readable tasks, exact colours/symbols, ARIA names and stationary touch/keyboard controls remain DOM/SVG. This is a 2D engine presentation, not Unreal, 3D physics or PBR rendering.

The game uses a lightweight 2.5D presentation, not a 3D engine: material SVG silhouettes, a shared neutral arena, and local answer feedback. Directional light only confirms a committed answer; scene decoration must never disclose the next answer. Reading modes use wider answer cards and a protected question surface. The mode catalog uses the same previews as the home carousel.

UI colors are defined in `css/partials/01-tokens.css` and the theme definitions in `09-extensions.css`. Theme-aware action labels use `--on-primary`, including dark labels on bright themes. The static contrast gate reads those source tokens directly; browser contrast coverage also checks every theme and the mode catalog.

Performance tiers share one policy for CSS and effects. Short particle trajectories are baked into compositor animations; input bounds and material nodes are reused, and unchanged HUD values are not rewritten. The trail canvas is capped at 2× / 1.5× / 1× resolution for high / mid / low tiers and clears only its previous drawn bounds. The governor samples active gameplay, not menus or pauses, and keeps downgrade decisions within the current tab session. See `BUILD.md` for repeatable benchmarks; emulated FPS is not an Android device guarantee.

Gameplay notices are a single compact footer status, not center-screen celebrations. Combo/fever/cooldown text never holds the next item or injects a stylesheet mid-round. A stimulus is fully opaque on its first frame. Rush uses the same single spawn scheduler as normal play: a correct answer advances promptly, while unanswered items retain their minimum answer window. Shuffle keeps its short orientation cue, without an extra post-animation wait.

The ten distinct worlds use restrained architectural frames and peripheral energy stages. The engine replaces the old CSS light/impulse layer while ready; that layer remains a fallback if engine loading or graphics fails. No question or upcoming answer is passed to the renderer. High-tier engine effects confirm committed correct input only, are bounded to two and clear at the next stimulus; other tiers retain local DOM feedback. Static live stages sleep until drawing changes, without changing game timers. Memo remains concealed and Sequence's necessary watch cues remain visible with reduced motion.

Optional **Moving background** in Settings is off by default: primary mouse/touch movement shifts only the architecture by at most ±4/3 pixels, on high quality with motion allowed. Its status explains when motion/quality settings suspend it. Inputs are coalesced into one frame; depth itself adds no idle loop. Pause, visibility, tier/motion changes, resize and release reset the scenery. The engine backing surface is capped at 1024×1536, with a 30 FPS low-tier limit; pause sleeps its loop and navigation destroys it. These are resource policies, not a device performance guarantee. World-specific contact sounds and short haptics retain independent settings and the existing app audio owner; Phaser does not start a second audio graph.

The surface-coherence pass reuses material objects in branding, tutorials and Chaos, with shared vector UI icons. Chaos size ratios and all task colors stay intact. A single world silhouette replaces stacked decorative rings; routes are invisible until confirmation. The desktop selector uses a composed two-column stage, the catalog describes tasks as well as worlds, and settings group related controls rather than boxing every row. Results distinguish unanswered rounds, continuation, records and completed rounds, without fake zero-XP rewards. Reserve lives are explained separately from Endless round lives.

Shop confirmations and manual-share fallbacks use a bounded, accessible in-app dialog with cancel-on-Escape/Back and focus restoration, not browser alerts/prompts. The shop discloses the existing service-level unlock requirements before spending currency. Start-up has no cosmetic minimum wait. Web/store icons, native launcher rasters and splash art share the material silhouettes; the Android API-24 robot override and white Capacitor splash are replaced. Legal pages share a readable dark layout, German/English versions and an offline-capable language switch; the original English legal content is retained. Game insights and its text export describe activity rather than claiming to measure enjoyment or ability. Visual review is not a substitute for physical Android testing or legal review of translations.

The earlier Precision Arcade art direction remains the menu/task-face foundation: narrow neutral highlights, shallow extrusion, shared panel/control finishes and display/numeric typography. The new Phaser stage complements these DOM/SVG surfaces rather than replacing accessible tasks with canvas-only content. Shop thumbnails remain static schematic arena/trail previews, without buying/equipping a design. The wheel paints one capped-2x themed bitmap and rotates it instead of redrawing labels each frame. Status stays peripheral; engine rules, answer scheduling and target coordinates remain unchanged.

The usability follow-up makes home content intrinsic-height/scrollable and lets play types, labels, dialogs and menu grids reflow at larger text sizes. The dock stays in document flow, so enlarged text cannot be hidden beneath it. Settings provide focus-moving section shortcuts and a wide-screen sidebar; the desktop shop uses two columns. The orientation hint no longer hides or blocks any menu. Rotating an active narrow touch arena pauses it; its normal resume/settings/quit controls stay usable. The arena remains designed for portrait rather than promising a new landscape gameplay layout.

Color-mode accessible names describe the displayed palette color and target direction instead of four identical “square” labels. Shape names cover all twelve silhouettes in German/English; the stimulus does not announce a correct direction and covered Memo corners remain covered. Actual screen-reader speech/navigation on a smartphone still needs device review.

Changing palette/language from a paused round now refreshes the current display before play resumes, without changing the item, score or target geometry. Global localization cannot overwrite these task names with direction-only shell labels.

Shop thumbnails have a visible Preview caption. The enlarged scene uses the real material shapes, active trail and theme declarations. An explicitly requested 750ms example animation has at most two transform/opacity animations, never starts a game, cannot buy/equip a design and cancels on close, hiding, low quality or motion reduction. It remains an illustrative example, not a promise of a fully simulated round. Wheel Skip, Escape/Back or newly enabled reduced motion finish the already-picked spin; the transaction stays busy until its one reward is saved. A root-screen history guard keeps browser Back inside the wheel flow.

Outfit and Space Grotesk are self-hosted Latin WOFF2 cuts with their OFL license, precached for offline use. Static cuts deliberately avoid incorrectly rendered variable weight axes observed in Windows WebKit. The game adds no runtime raster probe or font-CDN request. Its German/English privacy text reflects this resource change, not a professional legal sign-off. Missing/unavailable Web Audio no longer blocks app startup; supported file music remains independent of synth availability.

## Live Arena Experience

All ten live modes use their own Phaser architecture: a precision color deck, chamfered shape stations, radial Expert instrument, restrained math/knowledge consoles, memory cells/Sequence pads and distinct Stroop/Focus/Chaos frames. Shared inset faces, narrow highlights and contact shadows preserve exact answer colors and a clear stimulus center. Phaser chooses WebGL or Canvas; if it cannot start, the original DOM/SVG stage remains playable. There are no moving targets or full-screen particle celebrations.

The multiplier group also shows the current phase: real Rush item count, Flow/strong streaks, Fever/cooldown, or memory Watch/Recall/Ready. It is read-only and does not add a timer or waiting period. Rule/orientation notices outrank reward notices. Accepted contact uses one shared good/perfect/bonus classification for local visual response, a short mode-specific sound and existing independent haptic settings. Sequence points appear at the answered target; its Watch/Go text no longer spins over the task.

Music transitions coalesce at the next track beat. With Web Audio, normal MP3 playback gains a reusable quiet/open EQ as well as the mix changes; there are no extra stems/tracks/downloads and no claim of separately remixing instruments inside a file. The procedural fallback follows the same phases; ordinary file playback remains available without Web Audio. Answer sounds remain immediate. Pause/hiding/navigation cancels pending music/visual work. Low quality/reduced motion retains essential static phase/Sequence cues; the default-off depth limits apply to engine architecture instead of the hidden fallback stage.

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
