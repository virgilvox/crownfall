// Drives the real game in headless Chrome with fake gamepads and saves screenshots to shots/.
//   node tools/shot.mjs flow            full flow: title -> select -> cup -> round -> results -> podium
//   node tools/shot.mjs arenas [secs]   every arena mid-round (?arena=<id>&bots=4&skip=1)
//   node tools/shot.mjs one <arena> [secs] [bots] [extra query]
// Any console error / page error / failed request fails the run (exit 1).
import puppeteer from 'puppeteer-core';
import { execSync } from 'child_process';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { serve } from './serve.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const shots = path.join(root, 'shots'); fs.mkdirSync(shots, { recursive: true });
const [, , cmd = 'flow', ...args] = process.argv;
const dist = process.env.USE_DIST === '1';
if (dist) process.env.NO_FALLBACK = '1';
if (!dist) execSync('node tools/build.mjs --dev', { cwd: root, stdio: 'inherit' });
const server = await serve(Number(process.env.PORT) || 8080);
const BASE = `http://localhost:${process.env.PORT || 8080}/`;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const errors = [];

async function launch(headless = 'new') {
  return puppeteer.launch({
    executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', headless,
    args: ['--use-angle=metal', '--enable-gpu', '--ignore-gpu-blocklist', '--autoplay-policy=no-user-gesture-required', '--window-size=1300,760'],
    defaultViewport: { width: 1280, height: 720 },
  });
}
async function open(browser, query = '') {
  const page = await browser.newPage();
  page.on('console', (m) => { const t = m.type(); if (t === 'error') { Promise.all(m.args().map((a) => a.evaluate((x) => (x && x.stack) || String(x)).catch(() => ''))).then((v) => errors.push('console.error: ' + m.text() + ' ' + v.join(' | ').slice(0, 600))); } else if (t === 'warning' && !/GPU stall|ReadPixels/.test(m.text())) console.log('warn:', m.text()); });
  page.on('pageerror', (e) => errors.push('pageerror: ' + e.message));
  page.on('requestfailed', (r) => /ERR_ABORTED/.test(String(r.failure() && r.failure().errorText)) ? null : errors.push('requestfailed: ' + r.url() + ' ' + (r.failure() && r.failure().errorText)));
  page.on('response', (r) => { if (r.status() >= 400 && !r.url().endsWith('favicon.ico')) errors.push(`http ${r.status()}: ${r.url()}`); });
  await page.goto(BASE + (query ? '?' + query : ''));
  await page.waitForFunction('window.__menus && window.__menus.mode', { timeout: 120000 });
  return page;
}
const snap = async (page, name) => { const f = path.join(shots, name + '.png'); await page.screenshot({ path: f }); console.log('shot', name); };
const press = (page, seat, b, ms = 120) => page.evaluate((s, b, ms) => window.__press(s, b, ms), seat, b, ms);
const axis = (page, seat, x, y) => page.evaluate((s, x, y) => window.__axis(s, x, y), seat, x, y);
const mode = (page) => page.evaluate('window.__menus.mode');
const waitMode = (page, m, t = 60000) => page.waitForFunction(`window.__menus.mode === '${m}'`, { timeout: t });

async function launchWithFallback() {
  try { const b = await launch('new'); const p = await b.newPage(); await p.setContent('<canvas id=c></canvas>'); const ok = await p.evaluate(() => !!document.getElementById('c').getContext('webgl2')); await p.close(); if (ok) return b; await b.close(); } catch (e) { console.log('headless failed', e.message); }
  console.log('falling back to headed chrome'); return launch(false);
}

const browser = await launchWithFallback();
try {
  if (cmd === 'flow') {
    const page = await open(browser, 'pads=2');
    await sleep(2500); await snap(page, 'flow-01-title');
    await press(page, 1, 0); await sleep(1500);                 // P1 A -> select (joins)
    await press(page, 2, 0); await sleep(1200);                 // P2 joins
    await press(page, 1, 15); await sleep(900);                 // P1 right
    await press(page, 2, 14); await sleep(900);
    await snap(page, 'flow-02-select');
    await press(page, 1, 0); await press(page, 2, 0); await sleep(1500);
    await snap(page, 'flow-03-select-ready');
    await press(page, 1, 9); await sleep(800);
    await snap(page, 'flow-04-cup');
    await press(page, 1, 15); await sleep(300); await press(page, 1, 15); await sleep(300);
    await press(page, 1, 0);
    await waitMode(page, 'round'); await sleep(1200); await snap(page, 'flow-05-intro');
    await sleep(1800); await snap(page, 'flow-06-countdown');
    await sleep(2200);
    await axis(page, 1, 1, 0); await sleep(700); await press(page, 1, 0); await sleep(600); await axis(page, 1, 0, 0);
    await press(page, 1, 2); await sleep(400);
    await snap(page, 'flow-07-play');
    await sleep(8000); await snap(page, 'flow-08-play2');
    await page.evaluate('window.__menus.round.time = window.__menus.round.duration - 1.2');
    await waitMode(page, 'results', 30000); await sleep(2800); await snap(page, 'flow-09-results');
    await press(page, 1, 0); await waitMode(page, 'podium', 20000); await sleep(3500); await snap(page, 'flow-10-podium');
    await press(page, 1, 1); await sleep(1500); await snap(page, 'flow-11-back-to-select');
  } else if (cmd === 'arenas') {
    const secs = Number(args[0]) || 6;
    for (const id of ['garden', 'rooftops', 'hollow', 'orbit', 'kitchen']) {
      const page = await open(browser, `arena=${id}&bots=4&skip=1`);
      await waitMode(page, 'round'); await sleep(secs * 1000); await snap(page, 'arena-' + id);
      await page.close();
    }
  } else if (cmd === 'attract') {
    const page = await open(browser, 'idle=3&pads=2');
    await waitMode(page, 'round', 30000); await sleep(9000); await snap(page, 'attract-01');
    await press(page, 1, 0); await waitMode(page, 'title', 10000); await sleep(1500); await snap(page, 'attract-02-back-to-title');
  } else if (cmd === 'cup') {
    const page = await open(browser, 'pads=1&dur=6');
    await sleep(1200); await press(page, 1, 0); await sleep(800); await press(page, 1, 0); await sleep(800); await press(page, 1, 9); await sleep(600);
    await press(page, 1, 0);                                   // Grand Cup is the first card
    for (let r = 1; r <= 3; r++) {
      await waitMode(page, 'round', 90000); await sleep(500); await snap(page, `cup-r${r}-intro`);
      await waitMode(page, 'results', 60000); await sleep(2500); await snap(page, `cup-r${r}-results`);
      await press(page, 1, 0);
    }
    await waitMode(page, 'podium', 30000); await sleep(3500); await snap(page, 'cup-podium');
    await press(page, 1, 0); await waitMode(page, 'round', 60000); await sleep(800); await snap(page, 'cup-rematch');
    console.log('stats', await page.evaluate("localStorage.getItem('crownfall.stats')"));
  } else if (cmd === 'frenzy') {
    const page = await open(browser, 'arena=kitchen&bots=4&skip=1&intro=1');
    await waitMode(page, 'round'); await sleep(800); await snap(page, 'frenzy-00-intro');
    await sleep(2200); await snap(page, 'frenzy-01-countdown'); await sleep(1500); await snap(page, 'frenzy-02-go');
    await page.evaluate('window.__menus.round.time = window.__menus.round.duration - 14.5'); await sleep(1600); await snap(page, 'frenzy-03');
    await page.evaluate('window.__menus.round.time = window.__menus.round.duration - 0.6'); await sleep(1200); await snap(page, 'frenzy-04-time');
  } else if (cmd === 'select') {
    // 3 humans, duplicate avatar, CPU toggle, leave and rejoin
    const page = await open(browser, 'pads=3');
    await sleep(1500); await press(page, 1, 0); await sleep(800); await press(page, 3, 0); await sleep(800);
    await press(page, 3, 14); await sleep(600); await press(page, 3, 14); await sleep(600);
    await press(page, 1, 3); await sleep(300); await press(page, 1, 3); await sleep(1500); await snap(page, 'select-3p');
    await press(page, 3, 1); await sleep(500); await press(page, 1, 15); await sleep(400); await press(page, 1, 15); await sleep(1200); await snap(page, 'select-after-leave');
  } else if (cmd === 'perf') {
    for (const id of ['garden', 'rooftops', 'hollow', 'orbit', 'kitchen']) {
      const page = await open(browser, `arena=${id}&bots=4&skip=1`);
      await waitMode(page, 'round'); await sleep(2500);
      const r = await page.evaluate(() => new Promise((res) => { let n = 0; const t0 = performance.now(); const tick = () => { n++; if (performance.now() - t0 > 4000) { const i = window.__game.renderer.info; res({ fps: +(n / 4).toFixed(1), ...window.__game.stats, geos: i.memory.geometries, tex: i.memory.textures }); } else requestAnimationFrame(tick); }; requestAnimationFrame(tick); }));
      console.log(id, JSON.stringify(r)); await page.close();
    }
  } else if (cmd === 'one') {
    const [id, secs = '5', bots = '4', extra = ''] = args;
    const page = await open(browser, `arena=${id}&bots=${bots}&skip=1&${extra}`);
    await waitMode(page, 'round'); await sleep(Number(secs) * 1000); await snap(page, 'arena-' + id);
  }
} catch (e) {
  console.error('FAILED:', e.message);
  try { const pg = (await browser.pages()).pop(); await pg.screenshot({ path: path.join(shots, 'failure.png') }); } catch (e2) { /* ignore */ }
  errors.push('run failed: ' + e.message);
} finally {
  await browser.close(); server.close();
}
if (errors.length) { console.error('\nERRORS:\n' + [...new Set(errors)].join('\n')); process.exit(1); }
console.log('no console errors');
