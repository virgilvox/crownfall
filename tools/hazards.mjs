// Forces each arena's hazard and screenshots it.
import puppeteer from 'puppeteer-core';
import { execSync } from 'child_process';
import path from 'path';
import { fileURLToPath } from 'url';
import { serve } from './serve.mjs';
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
execSync('node tools/build.mjs --dev', { cwd: root, stdio: 'inherit' });
const server = await serve(8080);
const browser = await puppeteer.launch({ executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', headless: 'new', args: ['--use-angle=metal', '--enable-gpu', '--ignore-gpu-blocklist'], defaultViewport: { width: 1280, height: 720 } });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const errs = [];
const jobs = {
  rooftops: ['window.__menus.round.arena.wind.t = 0', 1900],
  hollow: ['window.__menus.round.arena.roll.t = 0', 2600],
  orbit: ['window.__menus.round.arena.meteor.t = 0', 1500],
  kitchen: ['window.__menus.round.arena.hot.forEach((h) => { h.t = 0; })', 4200],
  garden: ['window.__menus.round.time = 80; window.__menus.round.fighters[0].pos.set(4.6, 1, 3.8)', 1500],
};
for (const [id, [js, wait]] of Object.entries(jobs)) {
  const page = await browser.newPage();
  page.on('pageerror', (e) => errs.push(id + ' ' + e.message)); page.on('console', (m) => { if (m.type() === 'error') errs.push(id + ' ' + m.text()); });
  await page.goto(`http://localhost:8080/?arena=${id}&bots=4&skip=1`);
  await page.waitForFunction('window.__menus && window.__menus.mode === "round"', { timeout: 120000 });
  await sleep(1500); await page.evaluate(js); await sleep(wait);
  await page.screenshot({ path: path.join(root, 'shots', `hazard-${id}.png`) }); console.log('shot', id); await page.close();
}
await browser.close(); server.close();
if (errs.length) { console.error(errs); process.exit(1); }
