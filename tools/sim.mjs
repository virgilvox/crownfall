// Headless bot-vs-bot simulation inside the page: node tools/sim.mjs [arena ...]  (prints per-fighter stats)
import puppeteer from 'puppeteer-core';
import { execSync } from 'child_process';
import path from 'path';
import { fileURLToPath } from 'url';
import { serve } from './serve.mjs';
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
execSync('node tools/build.mjs --dev', { cwd: root, stdio: 'inherit' });
const server = await serve(8080);
const ids = process.argv.slice(2).length ? process.argv.slice(2) : ['garden', 'rooftops', 'hollow', 'orbit', 'kitchen'];
const secs = Number(process.env.SECS) || 90;
const browser = await puppeteer.launch({ executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', headless: 'new', args: ['--use-angle=metal', '--enable-gpu', '--ignore-gpu-blocklist'], defaultViewport: { width: 1280, height: 720 } });
const errors = [];
for (const id of ids) {
  const page = await browser.newPage();
  page.on('pageerror', (e) => errors.push(id + ' ' + e.message));
  page.on('console', (m) => { if (m.type() === 'error') errors.push(id + ' ' + m.text()); });
  await page.goto(`http://localhost:8080/?arena=${id}&bots=4&skip=1`);
  await page.waitForFunction('window.__menus && window.__menus.mode === "round"', { timeout: 120000 });
  const t0 = Date.now();
  const res = await page.evaluate((s) => window.__menus.simulate(s), secs);
  if (process.env.LOG) { const log = await page.evaluate('window.__outLog || []'); const sample = log.filter((l) => !l.hit).slice(0, Number(process.env.LOG)); console.log('non-hit outs:', log.filter((l) => !l.hit).length, 'hit outs:', log.filter((l) => l.hit).length); console.log(JSON.stringify(sample.map((l) => ({ ...l, leave: l.leave && { x: +l.leave.x.toFixed(1), y: +l.leave.y.toFixed(1), z: +l.leave.z.toFixed(1), vy: +l.leave.vy.toFixed(1), stun: l.leave.stun, dash: l.leave.dash, mode: l.leave.mode } })))); }
  console.log(`\n${id} (${secs}s sim in ${Date.now() - t0}ms)`); console.table(res);
  await page.close();
}
await browser.close(); server.close();
if (errors.length) { console.error('ERRORS', [...new Set(errors)]); process.exit(1); }
