/**
 * SCS Play — Gameplay performance benchmark
 *
 * Plays a real round with a scripted "fast player" (touch swipes from the
 * center to the correct corner) and records how the main thread holds up
 * as the game speeds up. Results are bucketed by correct answers, so a
 * regression that only appears at high pace (short spawn interval, high
 * streak, fever) shows up as worse numbers in the later buckets.
 *
 * Run (after npm run build:prod):
 *   node scripts/perf-benchmark.mjs [--mode=klassik] [--play=classic]
 *        [--cpu=4] [--seconds=40] [--reaction=200] [--tier=high|mid|low]
 *        [--json=out.json] [--trace=trace.json]
 *
 * Numbers are relative: headless Chromium rasterizes in software, so
 * compare runs on the same machine rather than reading absolute FPS.
 */
import { chromium } from 'playwright';
import { writeFileSync } from 'fs';
import { startStaticServer } from './lib/static-server.mjs';

const args = Object.fromEntries(process.argv.slice(2).map(arg => {
  const [key, value = 'true'] = arg.replace(/^--/, '').split('=');
  return [key, value];
}));
const MODE = args.mode || 'klassik';
const PLAY_TYPE = args.play || 'classic';
const CPU_RATE = Number(args.cpu || 4);
const SECONDS = Number(args.seconds || 40);
const REACTION_MS = Number(args.reaction || 200);
const BUCKET = Number(args.bucket || 20);
/* --tier=high|mid|low pins the perf tier (disables the FPS governor) */
const TIER = args.tier || '';
const EXTERNAL_BASE = process.env.SCS_BASE || '';

const DEVICE = {
  viewport: { width: 412, height: 915 },
  deviceScaleFactor: 2,
  isMobile: true,
  hasTouch: true,
  userAgent: 'Mozilla/5.0 (Linux; Android 15; SM-S936B) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Mobile Safari/537.36',
};

const METRIC_KEYS = ['RecalcStyleCount', 'RecalcStyleDuration', 'LayoutCount', 'LayoutDuration', 'ScriptDuration', 'TaskDuration', 'Nodes'];

function percentile(values, p) {
  if (!values.length) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.min(sorted.length - 1, Math.floor((p / 100) * sorted.length))];
}

const round = (n, d = 1) => Math.round(n * 10 ** d) / 10 ** d;

async function metrics(cdp) {
  const { metrics: list } = await cdp.send('Performance.getMetrics');
  return Object.fromEntries(list.filter(m => METRIC_KEYS.includes(m.name)).map(m => [m.name, m.value]));
}

async function enterGame(page) {
  await page.waitForSelector('#btnGuest', { state: 'visible', timeout: 10000 });
  await page.evaluate(() => document.querySelector('#btnGuest')?.click());
  await page.waitForSelector('#home.active', { timeout: 10000 });
  await page.evaluate(([mode, play]) => globalThis.__SCS_QA__.setGameSelection(mode, play), [MODE, PLAY_TYPE]);
  await page.evaluate(() => document.querySelector('#btnPlay')?.click());
  const deadline = Date.now() + 15000;
  while (Date.now() < deadline) {
    await page.evaluate(() => {
      if (document.querySelector('#tutorial.active')) document.querySelector('#btnTutorialSkip')?.click();
      const instruction = document.querySelector('#modeInstructionOverlay');
      if (instruction?.classList.contains('active') || instruction?.open) document.querySelector('#btnStartAfterInstruction')?.click();
    });
    const state = await page.evaluate(() => globalThis.__SCS_QA__.gameState());
    if (state?.running && state.stimulusId != null) return;
    await page.waitForTimeout(150);
  }
  throw new Error('Game did not start');
}

/* Runs inside the page: frame monitor + scripted swipes. */
async function playInPage({ seconds, reactionMs }) {
  const qa = globalThis.__SCS_QA__;
  const game = document.getElementById('game');
  const nextFrame = () => new Promise(resolve => requestAnimationFrame(resolve));
  const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));
  const frames = [];
  const longTasks = [];
  const answers = [];
  let stop = false;

  let last = performance.now();
  const onFrame = (now) => {
    const state = qa.gameState();
    frames.push({ dt: now - last, correct: state?.correct ?? 0 });
    last = now;
    if (!stop) requestAnimationFrame(onFrame);
  };
  requestAnimationFrame(onFrame);

  let observer = null;
  try {
    observer = new PerformanceObserver(list => {
      const correct = qa.gameState()?.correct ?? 0;
      for (const entry of list.getEntries()) longTasks.push({ duration: entry.duration, correct });
    });
    observer.observe({ type: 'longtask' });
  } catch { /* longtask unsupported */ }

  const touch = (type, x, y) => {
    const point = new Touch({ identifier: 1, target: game, clientX: x, clientY: y });
    const ended = type === 'touchend';
    game.dispatchEvent(new TouchEvent(type, {
      bubbles: true, cancelable: true,
      touches: ended ? [] : [point], targetTouches: ended ? [] : [point], changedTouches: [point],
    }));
  };
  const center = el => {
    const r = el.getBoundingClientRect();
    return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
  };

  const endAt = performance.now() + seconds * 1000;
  let answered = null;
  while (performance.now() < endAt) {
    const state = qa.gameState();
    if (!state?.running) break;
    if (state.stimulusId == null || state.stimulusId === answered || state.paused) { await nextFrame(); continue; }
    await sleep(reactionMs);
    const fresh = qa.gameState();
    if (!fresh?.running || fresh.stimulusId !== state.stimulusId) continue;
    const corner = document.querySelector(`.corner-shape[data-dir="${fresh.direction}"]`);
    const platform = document.getElementById('centerPlatform');
    if (!corner || !platform) { await nextFrame(); continue; }
    const from = center(platform);
    const to = center(corner);
    touch('touchstart', from.x, from.y);
    for (let i = 1; i <= 3; i++) {
      await nextFrame();
      touch('touchmove', from.x + (to.x - from.x) * i / 4, from.y + (to.y - from.y) * i / 4);
    }
    await nextFrame();
    const t0 = performance.now();
    touch('touchend', to.x, to.y);
    answers.push({ handlerMs: performance.now() - t0, correct: fresh.correct, spawnInterval: fresh.spawnInterval });
    answered = fresh.stimulusId;
  }
  stop = true;
  observer?.disconnect();
  return { frames: frames.slice(1), longTasks, answers, final: qa.gameState(), perfMode: document.body.dataset.perfMode };
}

function summarizeFrames(frames) {
  const dts = frames.map(f => f.dt);
  const total = dts.reduce((a, b) => a + b, 0);
  return {
    frames: dts.length,
    fps: total ? round(dts.length / (total / 1000)) : 0,
    p50: round(percentile(dts, 50)),
    p95: round(percentile(dts, 95)),
    p99: round(percentile(dts, 99)),
    max: round(Math.max(0, ...dts)),
    jankPct: dts.length ? round(100 * dts.filter(dt => dt > 34).length / dts.length) : 0,
  };
}

async function run() {
  const staticServer = EXTERNAL_BASE ? null : await startStaticServer({ root: 'docs', port: 3100 });
  const BASE = EXTERNAL_BASE || staticServer.baseUrl;
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext(DEVICE);
  await context.addInitScript((tier) => {
    localStorage.setItem('scsQa', '1');
    if (tier) localStorage.setItem('scsQaPerfTier', tier);
  }, TIER);
  const page = await context.newPage();
  const errors = [];
  page.on('pageerror', err => errors.push(err.message));

  try {
    await page.goto(BASE, { waitUntil: 'networkidle' });
    await enterGame(page);

    const cdp = await context.newCDPSession(page);
    await cdp.send('Performance.enable');
    await cdp.send('Emulation.setCPUThrottlingRate', { rate: CPU_RATE });

    /* Sample CDP counters while the bot plays so they can be bucketed too. */
    const samples = [];
    let sampling = true;
    const sampler = (async () => {
      while (sampling) {
        const [m, state] = await Promise.all([metrics(cdp), page.evaluate(() => globalThis.__SCS_QA__.gameState()).catch(() => null)]);
        samples.push({ m, correct: state?.correct ?? 0 });
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
    })();

    /* --trace=file.json records a Chrome trace (with style invalidation
       tracking) for a few seconds once the round is well under way. */
    let tracing = null;
    if (args.trace) {
      tracing = (async () => {
        await page.waitForTimeout(Number(args.traceDelay || 15000));
        await browser.startTracing(page, {
          path: args.trace,
          categories: (args.traceCategories || 'devtools.timeline,disabled-by-default-devtools.timeline,disabled-by-default-devtools.timeline.invalidationTracking,blink.user_timing').split(','),
        });
        await page.waitForTimeout(Number(args.traceSeconds || 5) * 1000);
        await browser.stopTracing();
      })();
    }

    const result = await page.evaluate(playInPage, { seconds: SECONDS, reactionMs: REACTION_MS });
    await tracing;
    sampling = false;
    await sampler;
    await cdp.send('Emulation.setCPUThrottlingRate', { rate: 1 });

    const buckets = new Map();
    const bucketOf = correct => Math.floor(correct / BUCKET) * BUCKET;
    const ensure = key => {
      if (!buckets.has(key)) buckets.set(key, { frames: [], longTasks: [], answers: [], deltas: {} });
      return buckets.get(key);
    };
    result.frames.forEach(f => ensure(bucketOf(f.correct)).frames.push(f));
    result.longTasks.forEach(t => ensure(bucketOf(t.correct)).longTasks.push(t));
    result.answers.forEach(a => ensure(bucketOf(a.correct)).answers.push(a));
    for (let i = 1; i < samples.length; i++) {
      const bucket = ensure(bucketOf(samples[i - 1].correct));
      for (const key of METRIC_KEYS) {
        if (key === 'Nodes') continue;
        bucket.deltas[key] = (bucket.deltas[key] || 0) + (samples[i].m[key] - samples[i - 1].m[key]);
      }
    }

    const rows = [...buckets.entries()].sort((a, b) => a[0] - b[0]).map(([key, b]) => {
      const answers = Math.max(1, b.answers.length);
      return {
        correct: `${key}-${key + BUCKET - 1}`,
        spawnMs: b.answers.length ? Math.round(b.answers.reduce((s, a) => s + a.spawnInterval, 0) / b.answers.length) : null,
        answers: b.answers.length,
        ...summarizeFrames(b.frames),
        longTasks: b.longTasks.length,
        longTaskMs: Math.round(b.longTasks.reduce((s, t) => s + t.duration, 0)),
        handlerMs: round(b.answers.reduce((s, a) => s + a.handlerMs, 0) / answers, 2),
        styleRecalcs: Math.round((b.deltas.RecalcStyleCount || 0) / answers),
        styleMs: round(((b.deltas.RecalcStyleDuration || 0) * 1000) / answers, 2),
        layouts: Math.round((b.deltas.LayoutCount || 0) / answers),
        layoutMs: round(((b.deltas.LayoutDuration || 0) * 1000) / answers, 2),
        scriptMs: round(((b.deltas.ScriptDuration || 0) * 1000) / answers, 2),
      };
    });

    const first = samples[0]?.m || {};
    const lastSample = samples[samples.length - 1]?.m || {};
    const overall = {
      mode: MODE, playType: PLAY_TYPE, cpuThrottle: CPU_RATE, reactionMs: REACTION_MS, pinnedTier: TIER || null,
      perfModeAtEnd: result.perfMode,
      answers: result.answers.length,
      finalCorrect: result.final?.correct,
      finalStreak: result.final?.streak,
      ...summarizeFrames(result.frames),
      longTasks: result.longTasks.length,
      longTaskMs: Math.round(result.longTasks.reduce((s, t) => s + t.duration, 0)),
      domNodesStart: first.Nodes, domNodesEnd: lastSample.Nodes,
      pageErrors: errors.length,
    };

    console.log('\nSCS Play gameplay benchmark');
    console.log(JSON.stringify(overall, null, 2));
    console.log('\nPer pace bucket (per-answer averages for style/layout/script):');
    console.table(rows);
    if (errors.length) console.log('Page errors:', errors);
    if (args.json) writeFileSync(args.json, JSON.stringify({ overall, rows }, null, 2));
  } finally {
    await browser.close();
    if (staticServer) await staticServer.close();
  }
}

run().catch(err => {
  console.error(err);
  process.exit(1);
});
