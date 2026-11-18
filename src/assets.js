// Asset loading: kit models (cached, cloned), VRM avatars (parsed per instance from a cached buffer), static-prop batching.
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { VRMLoaderPlugin, VRMUtils } from '@pixiv/three-vrm';
import { modelUrl } from './kits.js';

export const progress = { done: 0, total: 0, label: 'Loading' };
const track = (p) => { progress.total++; return p.finally(() => { progress.done++; }); };

const gltfLoader = new GLTFLoader();
const modelCache = new Map();
const modelDone = new Map();

export function loadModel(tok) {
  if (!modelCache.has(tok)) modelCache.set(tok, gltfLoader.loadAsync(modelUrl(tok)).then((g) => { g.scene.updateMatrixWorld(true); fixDarkTops(tok, g.scene); modelDone.set(tok, g.scene); return g.scene; }));
  return modelCache.get(tok);
}
// The Kenney platform kit paints the walkable top of its platforms near-black in the colormap. Re-point those
// top-facing vertices at a grass (or sand) pixel so they read as ground.
const FIX_TOPS = /^(plat|fps):platform/;
function fixDarkTops(tok, scene) {
  if (!FIX_TOPS.test(tok)) return;
  scene.traverse((m) => {
    const map = m.isMesh && m.material && m.material.map;
    if (!map || !map.image) return;
    const img = map.image, w = img.width, h = img.height;
    const c = document.createElement('canvas'); c.width = w; c.height = h; const cx = c.getContext('2d', { willReadFrequently: true }); cx.drawImage(img, 0, 0);
    const px = cx.getImageData(0, 0, w, h).data;
    const at = (x, y) => { const i = (y * w + x) * 4; return [px[i], px[i + 1], px[i + 2]]; };
    let want = null;
    const falling = tok.includes('falling');
    for (let y = 0; y < h && !want; y += 2) for (let x = 0; x < w && !want; x += 2) {
      const [r, g, b] = at(x, y);
      if (falling ? (r > 215 && g > 170 && b < 130 && g > b + 60) : (g > 150 && g > r * 1.3 && g > b * 1.15)) want = [(x + 0.5) / w, (y + 0.5) / h];
    }
    if (!want) return;
    const geo = m.geometry, uv = geo.attributes.uv, nor = geo.attributes.normal;
    if (!uv || !nor) return;
    let flipY = map.flipY;
    for (let i = 0; i < uv.count; i++) {
      if (nor.getY(i) < 0.8) continue;
      const x = Math.min(w - 1, Math.max(0, Math.floor(uv.getX(i) * w))), y = Math.min(h - 1, Math.max(0, Math.floor((flipY ? 1 - uv.getY(i) : uv.getY(i)) * h)));
      const [r, g, b] = at(x, y);
      if (r + g + b < 260 && Math.max(r, g, b) - Math.min(r, g, b) < 40) uv.setXY(i, want[0], flipY ? 1 - want[1] : want[1]);
    }
    uv.needsUpdate = true;
  });
}
export const loadModels = (toks) => Promise.all([...new Set(toks)].map(loadModel));
export function getModel(tok) { return modelDone.get(tok); }

let animJson = null;
export async function loadAnimJson() {
  if (!animJson) animJson = fetch('assets/anims.json').then((r) => r.json());
  return animJson;
}

const vrmLoader = new GLTFLoader();
vrmLoader.register((p) => new VRMLoaderPlugin(p));
const vrmBuf = new Map();
export function fetchVRM(file) {
  if (!vrmBuf.has(file)) vrmBuf.set(file, track(fetch(`assets/chars/${file}`).then((r) => r.arrayBuffer())));
  return vrmBuf.get(file);
}
export async function parseVRM(file) {
  const buf = await fetchVRM(file);
  const gltf = await vrmLoader.parseAsync(buf.slice(0), 'assets/chars/');
  const vrm = gltf.userData.vrm;
  VRMUtils.removeUnnecessaryVertices(gltf.scene);
  VRMUtils.combineSkeletons(gltf.scene);
  VRMUtils.rotateVRM0(vrm);
  return vrm;
}

// ---- material helpers
const vcMats = new Map();
function vcMaterial(m) {
  if (!vcMats.has(m)) {
    const c = m.clone();
    c.vertexColors = true;
    if (c.metalness !== undefined) c.metalness = Math.min(c.metalness, 0.2);
    vcMats.set(m, c);
  }
  return vcMats.get(m);
}

// Collects prop placements, loads every model they need, then merges static props into a handful of meshes
// (one per kit material) with per-instance tint baked into vertex colours. Dynamic props stay separate objects.
export class Stage {
  constructor(parent) {
    this.parent = parent;
    this.jobs = [];
  }
  // opts: x y z (position), ry rx rz (radians), s (uniform scale) or sx sy sz, tint (hex), dyn (returns a Group), shadow, parent
  add(tok, o = {}) {
    const job = { tok, o, group: null };
    if (o.dyn) { job.group = new THREE.Group(); job.group.position.set(o.x || 0, o.y || 0, o.z || 0); (o.parent || this.parent).add(job.group); }
    this.jobs.push(job);
    return job.group;
  }
  // grid / ring helpers
  async finalize(label = 'Building') {
    progress.label = label;
    await loadModels(this.jobs.map((j) => j.tok));
    const buckets = new Map();
    const tmp = new THREE.Matrix4();
    for (const j of this.jobs) {
      const src = getModel(j.tok);
      const o = j.o;
      const sx = o.sx ?? o.s ?? 1, sy = o.sy ?? o.s ?? 1, sz = o.sz ?? o.s ?? 1;
      const place = new THREE.Matrix4().compose(
        j.group ? new THREE.Vector3() : new THREE.Vector3(o.x || 0, o.y || 0, o.z || 0),
        new THREE.Quaternion().setFromEuler(new THREE.Euler(o.rx || 0, o.ry || 0, o.rz || 0, 'YXZ')),
        new THREE.Vector3(sx, sy, sz));
      if (j.group || o.keep) {
        const c = src.clone(true);
        c.traverse((m) => {
          if (!m.isMesh) return;
          m.castShadow = o.shadow !== false; m.receiveShadow = true;
          if (o.tint !== undefined || o.emissive !== undefined) {
            m.material = m.material.clone();
            if (o.tint !== undefined) m.material.color.multiply(new THREE.Color(o.tint));
            if (o.emissive !== undefined) { m.material.emissive = new THREE.Color(o.emissive); m.material.emissiveIntensity = o.ei ?? 1; }
          }
        });
        c.applyMatrix4(place);
        if (j.group) { j.group.add(c); j.group.userData.model = c; }
        else (o.parent || this.parent).add(c);
        continue;
      }
      const tint = new THREE.Color(o.tint ?? 0xffffff);
      src.traverse((m) => {
        if (!m.isMesh) return;
        let g = m.geometry.clone();
        tmp.copy(place).multiply(m.matrixWorld);
        g.applyMatrix4(tmp);
        if (g.index) g = g.toNonIndexed();
        for (const k of Object.keys(g.attributes)) if (!['position', 'normal', 'uv'].includes(k)) g.deleteAttribute(k);
        if (!g.attributes.uv) g.setAttribute('uv', new THREE.BufferAttribute(new Float32Array(g.attributes.position.count * 2), 2));
        const n = g.attributes.position.count;
        const col = new Float32Array(n * 3);
        for (let i = 0; i < n; i++) { col[i * 3] = tint.r; col[i * 3 + 1] = tint.g; col[i * 3 + 2] = tint.b; }
        g.setAttribute('color', new THREE.BufferAttribute(col, 3));
        const mats = Array.isArray(m.material) ? m.material : [m.material];
        const mat = vcMaterial(mats[0]);
        const key = mat.uuid + (o.noShadow ? 'n' : '');
        if (!buckets.has(key)) buckets.set(key, { mat, geos: [], noShadow: !!o.noShadow });
        buckets.get(key).geos.push(g);
      });
    }
    for (const b of buckets.values()) {
      const merged = mergeGeometries(b.geos, false);
      b.geos.forEach((g) => g.dispose());
      const mesh = new THREE.Mesh(merged, b.mat);
      mesh.castShadow = !b.noShadow; mesh.receiveShadow = true;
      mesh.matrixAutoUpdate = false;
      this.parent.add(mesh);
    }
    this.jobs = [];
  }
}
