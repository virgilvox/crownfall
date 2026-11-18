// Static server for dist/ on http://localhost:8080 (falls back to ./assets so a --dev build works without copying).
import http from 'http';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const types = { '.html': 'text/html', '.js': 'text/javascript', '.json': 'application/json', '.png': 'image/png', '.jpg': 'image/jpeg', '.mp3': 'audio/mpeg', '.glb': 'model/gltf-binary', '.gltf': 'model/gltf+json', '.bin': 'application/octet-stream', '.vrm': 'application/octet-stream' };

export function serve(port = 8080) {
  const server = http.createServer((req, res) => {
    let p = decodeURIComponent(new URL(req.url, 'http://x').pathname);
    if (p.endsWith('/')) p += 'index.html';
    let f = path.join(root, 'dist', p);
    if (!f.startsWith(path.join(root, 'dist'))) { res.writeHead(403); return res.end(); }
    if (!fs.existsSync(f) && p.startsWith('/assets/') && process.env.NO_FALLBACK !== '1') f = path.join(root, p);
    if (!fs.existsSync(f) || fs.statSync(f).isDirectory()) { res.writeHead(404); return res.end('not found'); }
    res.writeHead(200, { 'content-type': types[path.extname(f)] || 'application/octet-stream', 'cache-control': 'no-store' });
    fs.createReadStream(f).pipe(res);
  });
  return new Promise((r) => server.listen(port, () => r(server)));
}
if (process.argv[1] === fileURLToPath(import.meta.url)) { await serve(Number(process.env.PORT) || 8080); console.log('http://localhost:8080'); }
