// Serves the local HOPPER stand-in on http://localhost:8090 with play.hopper.games' CSP, and dist/ under /game/.
import http from 'http'; import fs from 'fs'; import path from 'path'; import { fileURLToPath } from 'url';
const here = path.dirname(fileURLToPath(import.meta.url)), dist = path.resolve(here, '../../dist');
const CSP = "default-src 'none'; script-src 'self' 'wasm-unsafe-eval'; worker-src 'self' blob:; connect-src 'self'; img-src 'self' data: blob:; media-src 'self' data: blob:; font-src 'self' data: blob:; style-src 'self' 'unsafe-inline'; frame-src 'self'; base-uri 'self'; form-action 'none'";
const types = { '.html': 'text/html', '.js': 'text/javascript', '.json': 'application/json', '.png': 'image/png', '.mp3': 'audio/mpeg', '.glb': 'model/gltf-binary', '.gltf': 'model/gltf+json', '.vrm': 'application/octet-stream', '.bin': 'application/octet-stream' };
export function serveHarness(port = 8090) {
  const srv = http.createServer((req, res) => {
    let p = decodeURIComponent(new URL(req.url, 'http://x').pathname); let f;
    if (p === '/') f = path.join(here, 'index.html');
    else if (p === '/harness.js' || p === '/jsgame-shim.js') f = path.join(here, p.slice(1));
    else if (p.startsWith('/game/')) { f = path.join(dist, p.slice(6)); if (!f.startsWith(dist)) f = null; }
    if (!f || !fs.existsSync(f) || fs.statSync(f).isDirectory()) { res.writeHead(404, { 'access-control-allow-origin': '*' }); return res.end(); }
    res.writeHead(200, { 'content-type': types[path.extname(f)] || 'application/octet-stream', 'cache-control': 'no-store', 'access-control-allow-origin': '*',
      'cross-origin-resource-policy': 'cross-origin', ...(p === '/' ? { 'content-security-policy': CSP } : {}) });
    fs.createReadStream(f).pipe(res);
  });
  return new Promise((r) => srv.listen(port, () => r(srv)));
}
if (process.argv[1] === fileURLToPath(import.meta.url)) { await serveHarness(); console.log('http://localhost:8090'); }
