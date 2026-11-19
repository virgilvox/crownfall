// Boots the built cart in the HOPPER stand-in with the network throttled (default 250 KB/s, about what HOPPER's CDN
// gave us) and reports the loading bar over time and how long it takes to reach the title.
//   node tools/slow-load.mjs [KB/s]
import puppeteer from 'puppeteer-core';
import { serveHarness } from './hopper-harness/serve.mjs';
const kbps = Number(process.argv[2]) || 250;
const srv = await serveHarness(8090);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const browser = await puppeteer.launch({ executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', headless: false, args: ['--window-size=1400,850'], defaultViewport: { width: 1380, height: 760 } });
const page = await browser.newPage();
page.on('pageerror', (e) => console.log('[pageerror]', e.message));
page.on('console', (m) => { if (m.type() === 'error' && !/404/.test(m.text())) console.log('[error]', m.text().slice(0, 200)); });
const cdp = await page.createCDPSession();
await cdp.send('Network.enable');
await cdp.send('Network.emulateNetworkConditions', { offline: false, latency: 80, downloadThroughput: kbps * 1024, uploadThroughput: 100 * 1024 });
const t0 = Date.now();
await page.goto('http://localhost:8090/');
let f = null, shot = 0;
for (let i = 0; i < 600; i++) {
  await sleep(1000);
  if (!f) for (const fr of page.frames()) { try { if (await fr.evaluate('!!window.__game')) f = fr; } catch {} }
  if (!f) continue;
  const s = await f.evaluate(() => ({ mode: window.__menus?.mode })).catch(() => ({}));
  const sec = ((Date.now() - t0) / 1000) | 0;
  if (i % 5 === 0) { const p = `shots/slow-${String(sec).padStart(3, '0')}.png`; await page.screenshot({ path: p }); console.log(sec + 's', p, s.mode || 'loading'); }
  if (s.mode === 'title') { console.log(`title after ${sec}s at ${kbps} KB/s`); break; }
}
await browser.close(); srv.close();
