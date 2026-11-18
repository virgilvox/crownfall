import puppeteer from 'puppeteer-core';
import { serve } from './serve.mjs';
const server = await serve(8080);
const id = process.argv[2] || 'kitchen';
const browser = await puppeteer.launch({ executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', headless: 'new', args: ['--use-angle=metal', '--enable-gpu', '--ignore-gpu-blocklist'] });
const page = await browser.newPage();
page.on('pageerror', (e) => console.log('ERR', e.message));
await page.goto(`http://localhost:8080/?arena=${id}&bots=4&skip=1`);
await page.waitForFunction('window.__menus && window.__menus.mode === "round"', { timeout: 120000 });
const out = await page.evaluate(() => {
  const m = window.__menus, r = m.round, g = m.game;
  const buf = new Map(); r.fighters.forEach((f) => buf.set(f, []));
  let found = null;
  for (let t = 0; t < 120 * 60 && !found; t++) {
    r.update(1 / 60); g.fx.update(1 / 60);
    for (const f of r.fighters) {
      const b = buf.get(f); b.push({ t: +r.time.toFixed(2), x: +f.pos.x.toFixed(2), y: +f.pos.y.toFixed(2), z: +f.pos.z.toFixed(2), vx: +f.vel.x.toFixed(1), vy: +f.vel.y.toFixed(1), vz: +f.vel.z.toFixed(1), gr: f.grounded, mode: f.brain && f.brain.mode, st: +f.stun.toFixed(1), dash: f.dashT > 0, inv: +f.invuln.toFixed(1) }); if (b.length > 90) b.shift();
      if (f.dead && !f._seen) { f._seen = true; const log = r.outLog[r.outLog.length - 1]; if (!log.hit) { found = { who: f.name, log, trace: b.filter((_, i) => i % 6 === 0) }; } }
    }
  }
  return found;
});
console.log(JSON.stringify(out, null, 0).replace(/\},\{/g, '},\n{'));
await browser.close(); server.close();
