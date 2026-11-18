import puppeteer from 'puppeteer-core';
import { serve } from './serve.mjs';
const server = await serve(8080);
const browser = await puppeteer.launch({ executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', headless: 'new', args: ['--use-angle=metal', '--enable-gpu', '--ignore-gpu-blocklist'] });
const page = await browser.newPage();
await page.goto(`http://localhost:8080/?arena=${process.argv[2] || 'hollow'}&bots=4&skip=1`);
await page.waitForFunction('window.__menus && window.__menus.mode === "round"', { timeout: 120000 });
await new Promise((r) => setTimeout(r, 1500));
console.log(await page.evaluate(() => {
  const sc = window.__menus.round.scene; const c = {}; let skinned = 0; const mats = new Set();
  sc.traverse((o) => { if (!o.visible) return; const k = o.isSkinnedMesh ? 'skinned' : o.isMesh ? 'mesh' : o.isSprite ? 'sprite' : o.isPoints ? 'points' : o.isLight ? 'light' : 'other'; c[k] = (c[k] || 0) + 1; });
  const byArena = {}; sc.children.forEach((ch) => { let n = 0; ch.traverse((o) => { if (o.isMesh) n++; }); if (n > 3) byArena[ch.name || ch.type + ch.uuid.slice(0, 4)] = n; });
  return JSON.stringify({ c, big: byArena, calls: window.__game.stats, lights: window.__game.renderer.info.programs.length });
}));
await browser.close(); server.close();
