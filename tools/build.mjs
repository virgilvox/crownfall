// Bundles src/main.js with esbuild, copies only the assets the source references, writes dist/ and crownfall.jsgame.
// `node tools/build.mjs --dev` skips minification, the asset copy and the zip (tools/serve.mjs falls back to ./assets).
import esbuild from 'esbuild';
import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';
import zlib from 'zlib';
import { slimVRM } from './slim-vrm.mjs';
import { fileURLToPath } from 'url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const dev = process.argv.includes('--dev');
const dist = path.join(root, 'dist');
const { KITS, modelUrl } = await import(path.join(root, 'src/kits.js'));

if (!dev) fs.rmSync(dist, { recursive: true, force: true });
fs.mkdirSync(dist, { recursive: true });

const bundle = (define = {}) => esbuild.build({
  entryPoints: [path.join(root, 'src/main.js')],
  bundle: true, format: 'esm', target: 'es2020', outfile: path.join(dist, 'main.js'),
  minify: !dev, sourcemap: dev ? 'inline' : false, legalComments: 'none', logLevel: 'warning', define,
});
if (dev) await bundle();
fs.copyFileSync(path.join(root, 'src/index.html'), path.join(dist, 'index.html'));
const pkg = {
  name: 'crownfall', version: '1.0.0', main: 'main.js',
  hopper: { hopper: 1, seats: [1, 4], controller: 'xbox', buttons: 'position', labels: { A: 'JUMP', B: 'SLAM', X: 'DASH', Y: 'TAUNT', START: 'START' } },
};
fs.writeFileSync(path.join(dist, 'package.json'), JSON.stringify(pkg, null, 2));
if (dev) { console.log('dev build ok'); process.exit(0); }

// ---- collect referenced assets
const files = new Set();
const srcFiles = [];
(function walk(d) { for (const f of fs.readdirSync(d)) { const p = path.join(d, f); fs.statSync(p).isDirectory() ? walk(p) : /\.js$/.test(f) && srcFiles.push(p); } })(path.join(root, 'src'));
const kitRe = new RegExp('[\'"`](' + Object.keys(KITS).join('|') + '):([\\w.\\-]+)[\'"`]', 'g');
const litRe = /assets\/[A-Za-z0-9_\-./]+\.(?:vrm|mp3|json|png|jpg|glb|gltf|bin|ogg|wav)/g;
for (const f of srcFiles) {
  const s = fs.readFileSync(f, 'utf8');
  for (const m of s.matchAll(kitRe)) files.add(modelUrl(m[1] + ':' + m[2]));
  for (const m of s.matchAll(litRe)) files.add(m[0]);
  for (const m of s.matchAll(/['"]([\w\-]+\.vrm)['"]/g)) files.add('assets/chars/' + m[1]);
}
function deps(rel) {
  const abs = path.join(root, rel);
  const out = [];
  let json;
  if (rel.endsWith('.glb')) { const b = fs.readFileSync(abs); json = JSON.parse(b.slice(20, 20 + b.readUInt32LE(12)).toString()); }
  else if (rel.endsWith('.gltf')) json = JSON.parse(fs.readFileSync(abs, 'utf8'));
  else return out;
  for (const x of [...(json.buffers || []), ...(json.images || [])]) if (x.uri && !x.uri.startsWith('data:')) out.push(path.posix.join(path.posix.dirname(rel), decodeURIComponent(x.uri)));
  return out;
}
for (const f of [...files]) for (const d of deps(f)) files.add(d);
let total = 0;
for (const f of files) {
  const src = path.join(root, f);
  if (!fs.existsSync(src)) { console.error('MISSING asset referenced: ' + f); process.exitCode = 1; continue; }
  const dst = path.join(dist, f);
  fs.mkdirSync(path.dirname(dst), { recursive: true });
  fs.copyFileSync(src, dst);
  total += fs.statSync(src).size;
}
console.log(`copied ${files.size} assets (${(total / 1048576).toFixed(1)} MB)`);

// HOPPER's CDN serves files uncompressed (and not fast), so ship avatars slimmed + gzipped and the animation data
// gzipped; the game gunzips them (src/assets.js). Their sizes go into the bundle so the loading bar is exact.
const sizes = {};
for (const f of [...files]) {
  if (!/^assets\/chars\/.+\.vrm$|^assets\/anims\.json$/.test(f)) continue;
  const dst = path.join(dist, f);
  let buf = fs.readFileSync(dst);
  if (f.endsWith('.vrm')) buf = slimVRM(buf);
  const gz = zlib.gzipSync(buf, { level: 9 });
  fs.writeFileSync(dst + '.gz', gz); fs.rmSync(dst);
  sizes[f + '.gz'] = gz.length;
}
console.log(`gzipped ${Object.keys(sizes).length} files: ${(Object.values(sizes).reduce((a, b) => a + b, 0) / 1048576).toFixed(1)} MB`);
await bundle({ __GZ__: 'true', __SIZES__: JSON.stringify(sizes) });
const out = path.join(root, 'crownfall.jsgame');
fs.rmSync(out, { force: true });
execSync(`zip -qr -X "${out}" .`, { cwd: dist });
console.log(`crownfall.jsgame ${(fs.statSync(out).size / 1048576).toFixed(1)} MB`);
