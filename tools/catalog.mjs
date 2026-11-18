// node tools/catalog.mjs <kit> [out.png] [cols]  -> contact sheet of every model in a kit (dev aid)
import esbuild from 'esbuild';
import fs from 'fs';
import path from 'path';
import puppeteer from 'puppeteer-core';
import http from 'http';
import { fileURLToPath } from 'url';
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const { KITS } = await import(path.join(root, 'src/kits.js'));
const kit = process.argv[2]; const out = process.argv[3] || path.join(root, 'shots', `catalog-${kit}.png`); const cols = process.argv[4] || 8;
const tmp = path.join(root, 'tools/catalog/out'); fs.mkdirSync(tmp, { recursive: true });
await esbuild.build({ entryPoints: [path.join(root, 'tools/catalog/catalog.js')], bundle: true, format: 'esm', outfile: path.join(tmp, 'c.js'), logLevel: 'warning' });
fs.writeFileSync(path.join(tmp, 'index.html'), '<body style="margin:0"><canvas id="c"></canvas><div id="labels" style="position:absolute;left:0;top:0;width:1600px;height:1000px"></div><script type="module" src="c.js"></script>');
const [dir, ext] = KITS[kit];
const names = fs.readdirSync(path.join(root, dir)).filter((f) => f.endsWith(ext) && !(ext === '.gltf' && f.endsWith('.glb'))).map((f) => f.slice(0, -ext.length));
const server = http.createServer((req, res) => {
  const p = decodeURIComponent(req.url.split('?')[0]);
  const f = fs.existsSync(path.join(tmp, p)) && p !== '/' ? path.join(tmp, p) : p === '/' ? path.join(tmp, 'index.html') : path.join(root, p);
  if (!fs.existsSync(f)) { res.writeHead(404); return res.end(); }
  res.writeHead(200, { 'content-type': f.endsWith('.html') ? 'text/html' : f.endsWith('.js') ? 'text/javascript' : f.endsWith('.png') ? 'image/png' : 'application/octet-stream' }); fs.createReadStream(f).pipe(res);
}).listen(8091);
const browser = await puppeteer.launch({ executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', headless: 'new', args: ['--use-angle=metal', '--enable-gpu', '--ignore-gpu-blocklist'], defaultViewport: { width: 1600, height: 1000 } });
const page = await browser.newPage();
page.on('console', (m) => console.log('console:', m.text()));
await page.goto(`http://localhost:8091/?kit=${kit}&basic=${process.env.BASIC||''}&tilt=${process.env.TILT||0}&cols=${cols}&names=${names.join(',')}&kits=${encodeURIComponent(JSON.stringify(KITS))}`);
await page.waitForFunction('window.__done', { timeout: 60000 });
await new Promise((r) => setTimeout(r, 500));
await page.screenshot({ path: out });
await browser.close(); server.close(); console.log(out, names.length);
