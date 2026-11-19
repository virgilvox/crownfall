// Shrinks a VRM 0.x (.vrm GLB) for the web: drops the blendshape groups the game never drives (visemes, fun, wink,
// extras), then the morph targets only they used, then every byte of the binary chunk nothing references any more.
// Face morph targets are most of a VRoid file, so this typically cuts it to a quarter.
//   node tools/slim-vrm.mjs in.vrm out.vrm
import fs from 'node:fs';

const KEEP = new Set(['blink', 'joy', 'angry', 'sorrow', 'surprised']);   // presetName, or name for 'unknown' presets
const keepGroup = (g) => KEEP.has(String(g.presetName === 'unknown' || !g.presetName ? g.name : g.presetName).toLowerCase());

export function slimVRM(buf) {
  const jsonLen = buf.readUInt32LE(12);
  const json = JSON.parse(buf.subarray(20, 20 + jsonLen).toString('utf8'));
  const binStart = 20 + jsonLen + 8;
  const bin = buf.subarray(binStart, binStart + buf.readUInt32LE(20 + jsonLen));
  const vrm = json.extensions?.VRM;
  if (!vrm) throw new Error('not a VRM 0.x file');

  // 1. blendshape groups -> which morph targets stay
  const groups = vrm.blendShapeMaster.blendShapeGroups.filter(keepGroup);
  vrm.blendShapeMaster.blendShapeGroups = groups;
  const keep = json.meshes.map(() => new Set());
  for (const g of groups) for (const b of g.binds || []) keep[b.mesh].add(b.index);
  const remap = json.meshes.map((m, mi) => {
    const n = m.primitives[0]?.targets?.length || 0;
    const map = new Map(); let k = 0;
    for (let i = 0; i < n; i++) if (keep[mi].has(i)) map.set(i, k++);
    return map;
  });
  json.meshes.forEach((m, mi) => {
    const map = remap[mi];
    const pick = (arr) => arr && arr.filter((_, i) => map.has(i));
    for (const p of m.primitives) {
      if (!p.targets) continue;
      p.targets = pick(p.targets);
      if (!p.targets.length) delete p.targets;
      if (p.extras?.targetNames) p.extras.targetNames = pick(p.extras.targetNames);
    }
    if (m.weights) { m.weights = pick(m.weights); if (!m.weights.length) delete m.weights; }
    if (m.extras?.targetNames) { m.extras.targetNames = pick(m.extras.targetNames); }
  });
  for (const g of groups) for (const b of g.binds || []) b.index = remap[b.mesh].get(b.index);

  // 2. accessors still in use; unused ones lose their data (glTF allows an accessor with no bufferView)
  const usedAcc = new Set();
  for (const m of json.meshes) for (const p of m.primitives) {
    Object.values(p.attributes).forEach((a) => usedAcc.add(a));
    if (p.indices !== undefined) usedAcc.add(p.indices);
    for (const t of p.targets || []) Object.values(t).forEach((a) => usedAcc.add(a));
  }
  for (const s of json.skins || []) if (s.inverseBindMatrices !== undefined) usedAcc.add(s.inverseBindMatrices);
  for (const an of json.animations || []) for (const s of an.samplers) { usedAcc.add(s.input); usedAcc.add(s.output); }
  json.accessors.forEach((a, i) => { if (!usedAcc.has(i)) { delete a.bufferView; delete a.byteOffset; if (a.sparse) delete a.sparse; } });

  // 3. compact the binary chunk to the bufferViews still referenced
  const usedBV = new Set();
  for (const a of json.accessors) {
    if (a.bufferView !== undefined) usedBV.add(a.bufferView);
    if (a.sparse) { usedBV.add(a.sparse.indices.bufferView); usedBV.add(a.sparse.values.bufferView); }
  }
  for (const im of json.images || []) if (im.bufferView !== undefined) usedBV.add(im.bufferView);
  const bvMap = new Map(); const views = []; const parts = []; let off = 0;
  json.bufferViews.forEach((bv, i) => {
    if (!usedBV.has(i)) return;
    const pad = (4 - (off % 4)) % 4; if (pad) { parts.push(Buffer.alloc(pad)); off += pad; }
    parts.push(bin.subarray(bv.byteOffset || 0, (bv.byteOffset || 0) + bv.byteLength));
    bvMap.set(i, views.length);
    views.push({ ...bv, byteOffset: off });
    off += bv.byteLength;
  });
  json.bufferViews = views;
  for (const a of json.accessors) {
    if (a.bufferView !== undefined) a.bufferView = bvMap.get(a.bufferView);
    if (a.sparse) { a.sparse.indices.bufferView = bvMap.get(a.sparse.indices.bufferView); a.sparse.values.bufferView = bvMap.get(a.sparse.values.bufferView); }
  }
  for (const im of json.images || []) if (im.bufferView !== undefined) im.bufferView = bvMap.get(im.bufferView);
  const pad = (4 - (off % 4)) % 4; if (pad) { parts.push(Buffer.alloc(pad)); off += pad; }
  json.buffers = [{ byteLength: off }];

  // 4. write the GLB
  let js = Buffer.from(JSON.stringify(json), 'utf8');
  if (js.length % 4) js = Buffer.concat([js, Buffer.alloc(4 - (js.length % 4), 0x20)]);
  const head = Buffer.alloc(12); head.writeUInt32LE(0x46546c67, 0); head.writeUInt32LE(2, 4);
  const jh = Buffer.alloc(8); jh.writeUInt32LE(js.length, 0); jh.writeUInt32LE(0x4e4f534a, 4);
  const bh = Buffer.alloc(8); bh.writeUInt32LE(off, 0); bh.writeUInt32LE(0x004e4942, 4);
  const out = Buffer.concat([head, jh, js, bh, ...parts]);
  out.writeUInt32LE(out.length, 8);
  return out;
}

if (process.argv[1] && import.meta.url.endsWith(process.argv[1].split('/').pop())) {
  const [, , i, o] = process.argv;
  const out = slimVRM(fs.readFileSync(i));
  fs.writeFileSync(o, out);
  console.log(`${i} ${fs.statSync(i).size} -> ${out.length}`);
}
