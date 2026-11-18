// NEON ROOFTOPS: a dusk city. Five jumpable rooftops over a glowing street, with periodic wind gusts.
import * as THREE from 'three';
import { ArenaBase } from './common.js';
import { box, wallBox, wallCyl } from '../physics.js';
import { audio } from '../audio.js';
import { srand, rand, pick } from '../util.js';
import { W, H, text } from '../ui.js';

const BD = {
  A: { minx: -0.6, minz: -0.65, w: 1.21, d: 1.45, T: 1.65 }, B: { minx: -0.8, minz: -0.65, w: 1.61, d: 1.3, T: 1.65 },
  C: { minx: -0.6, minz: -0.65, w: 1.21, d: 1.3, T: 2.35 }, D: { minx: -0.8, minz: -0.65, w: 1.61, d: 1.3, T: 2.35 },
  E: { minx: -1, minz: -0.65, w: 2.01, d: 1.45, T: 2.35 }, F: { minx: -1, minz: -0.65, w: 2.01, d: 1.3, T: 2.35 },
  G: { minx: -1, minz: -0.65, w: 2.01, d: 1.45, T: 2.35 }, H: { minx: -1, minz: -0.65, w: 2.01, d: 1.3, T: 3.05 },
};
const ROOF = { A: 'cityb:building_A_withoutBase', B: 'cityb:building_B_withoutBase', C: 'cityb:building_C_withoutBase', D: 'cityb:building_D_withoutBase', E: 'cityb:building_E_withoutBase', F: 'cityb:building_F_withoutBase', G: 'cityb:building_G_withoutBase', H: 'cityb:building_H_withoutBase' };
const FULL = { A: 'cityb:building_A', B: 'cityb:building_B', C: 'cityb:building_C', D: 'cityb:building_D', E: 'cityb:building_E', F: 'cityb:building_F', G: 'cityb:building_G', H: 'cityb:building_H' };
const FULLT = { A: 1.65, B: 1.65, C: 2.98, D: 2.97, E: 2.35, F: 2.35, G: 2.98, H: 3.05 };

function signTexture(label, color) {
  const c = document.createElement('canvas'); c.width = 256; c.height = 96; const g = c.getContext('2d');
  g.fillStyle = '#120820'; g.fillRect(0, 0, 256, 96);
  g.strokeStyle = color; g.lineWidth = 6; g.strokeRect(6, 6, 244, 84);
  g.font = '900 52px "Arial Black", Impact, sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle';
  g.shadowColor = color; g.shadowBlur = 18; g.fillStyle = '#fff'; g.fillText(label, 128, 52); g.fillText(label, 128, 52);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
}

export async function build(ctx) {
  const A = new ArenaBase({ id: 'rooftops', name: 'NEON ROOFTOPS', tagline: 'Hold on when the wind kicks up', color: '#ff4fd8', music: 'action' });
  const st = A.stage;
  A.fog(0x2a0f45, 70, 230);
  A.sky(0x120a3a, 0x7a2a8a, 0xff6f5e, { stars: 200 });
  A.lights({ sky: 0xa98bff, ground: 0x4a2060, hemi: 0.95, sun: 0xffb0d8, sunI: 1.9, sunPos: [-22, 28, 20], shadow: 26, center: [0, 0, 0] });
  const rim = new THREE.PointLight(0x39f3ff, 30, 60, 1.5); rim.position.set(14, 8, 10); A.scene.add(rim);
  const rim2 = new THREE.PointLight(0xff3fd0, 30, 60, 1.5); rim2.position.set(-14, 8, -10); A.scene.add(rim2);

  const S = 5;
  const NEON = [0xff2bd6, 0x2bf3ff];
  let ni = 0;
  const roof = (k, cx, cz, top, s = S, props = null) => {
    const b = BD[k], tok = ROOF[k];
    const x = cx - (b.minx + b.w / 2) * s, z = cz - (b.minz + b.d / 2) * s;
    const w = b.w * s, d = b.d * s;
    const seg = (b.T - 0.1) * s, n = Math.ceil((top + 32) / seg);
    for (let i = 0; i < n; i++) st.add(tok, { x, y: top - b.T * s - i * seg, z, s });
    A.solid(box(cx, top - 0.02, cz, w, d, 6));
    // neon edge strips + corner glows
    const col = NEON[ni++ % 2], col2 = NEON[ni % 2];
    A.neon(col, cx, top + 0.14, cz + d / 2 - 0.12, w, 0.14, 0.16);
    A.neon(col, cx, top + 0.14, cz - d / 2 + 0.12, w, 0.14, 0.16);
    A.neon(col2, cx - w / 2 + 0.12, top + 0.14, cz, 0.16, 0.14, d);
    A.neon(col2, cx + w / 2 - 0.12, top + 0.14, cz, 0.16, 0.14, d);
    for (const [gx, gz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) A.glow(cx + gx * w / 2, top + 0.4, cz + gz * d / 2, (gx * gz > 0 ? col : col2), 3.4, 0.55);
    return { cx, cz, top, w, d };
  };
  const R0 = roof('G', 0, 0, 0);
  const R1 = roof('D', -13.3, -1.0, 2.0);
  const R2 = roof('B', 13.3, 1.0, 1.2);
  const R3 = roof('H', -1.0, -11.0, 3.2);
  const R4 = roof('A', 2.0, 11.6, -1.4, 5.5);

  // dais: a rooftop garage shed
  st.add('kcity:building-garage', { x: 0, y: 0, z: 0, sx: 3.4, sy: 2.7, sz: 3.4 });
  A.solid(box(0, 1.45, 0, 3.4, 3.4, 1.5));
  A.dais = { x: 0, y: 1.45, z: 0 };
  A.neon(0xffd23f, 0, 1.5, 1.72, 3.4, 0.1, 0.1);

  // props on the roofs
  st.add('cityb:watertower', { x: -15.5, y: 2.0, z: -3.2, s: S * 0.9 }); A.solid(wallCyl(-15.5, -3.2, 1.2, 1.5));
  st.add('cityb:watertower', { x: 3.5, y: 3.2, z: -12.2, s: S * 0.8 }); A.solid(wallCyl(3.5, -12.2, 1.05, 2.7));
  st.add('cityb:bench', { x: -3.6, y: 0, z: 2.5, s: 6, ry: 0 }); st.add('cityb:bench', { x: 14.6, y: 1.2, z: 3.0, s: 6, ry: Math.PI });
  for (const [x, y, z, ry] of [[-4.2, 0, -2.4, 0.4], [4.2, 0, 2.6, 2], [-11, 2, 1.8, 1], [12, 1.2, -1.5, 3]]) st.add('cityb:streetlight', { x, y, z, s: 5, ry });
  [[-6.5, 0, -2.6], [5.8, 0, -1.8], [14.6, 1.2, -1.8]].forEach(([x, y, z], i) => { st.add(i % 2 ? 'cityb:box_A' : 'cityb:box_B', { x, y, z, s: 8, ry: i }); A.solid(box(x, y + 1.3, z, 1.5, 1.5, 1.3)); });
  [[-12, 2, 1.9], [-2.4, 3.2, -9.1], [7.5, 3.2, -12.0], [1.5, -1.4, 13.6]].forEach(([x, y, z], i) => { st.add('cityb:trash_A', { x, y, z, s: 7 }); st.add('cityb:dumpster', { x: x + 1.2, y, z: z + 0.3, s: 4.2, ry: i }); });
  st.add('cityb:dumpster', { x: 7.2, y: 0, z: 2.3, s: 4.5, ry: 0.2 }); A.solid(wallBox(7.2, 2.3, 2.5, 1.5, 0, 1.4));
  st.add('cityb:bush', { x: -8.5, y: 0, z: 2.5, s: 6 }); st.add('cityb:bush', { x: 9.5, y: 0, z: -2.5, s: 6 }); st.add('cityb:bush', { x: 15, y: 1.2, z: 3.5, s: 5 });
  st.add('cityb:trafficlight_C', { x: -1.4, y: 3.2, z: -8.6, s: 5, ry: 0 });

  // neon signs on the building fronts
  const signs = [['HOTEL', '#ff4fd8', -13.3, 0.4, -4.35, 4.4, 1.7], ['RAMEN', '#4ff3ff', 13.3, -0.4, -2.1, 4.0, 1.5], ['ARCADE', '#ffd23f', -1.0, 1.2, -7.8, 5.0, 1.8], ['CROWN', '#ff8a3d', 2.0, -3.0, 15.7, 4.0, 1.5]];
  for (const [label, color, x, y, z, w, h] of signs) {
    const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshBasicMaterial({ map: signTexture(label, color), toneMapped: false, fog: false }));
    m.position.set(x, y, z + 0.06); A.scene.add(m);
    A.glow(x, y, z + 0.5, new THREE.Color(color), w * 1.3, 0.35);
  }

  A.spawns = [{ x: -3.4, y: 0, z: 2.4 }, { x: 3.6, y: 0, z: 2.4 }, { x: -3.6, y: 0, z: -2.4 }, { x: 3.8, y: 0, z: -2.2 }];
  A.safe = [...A.spawns, { x: -12, y: 2, z: 0 }, { x: 12, y: 1.2, z: -0.5 }, { x: -1, y: 3.2, z: -10 }];
  A.pickups = [{ x: -13.3, y: 2.0, z: -1 }, { x: 13.3, y: 1.2, z: 1 }, { x: -1, y: 3.2, z: -11 }, { x: 2, y: -1.4, z: 11.6 }, { x: 0, y: 0, z: 3 }];

  // ---- the city far below
  srand(21);
  const ST = -30, PITCH = 24;
  const roadAt = (x, z, tok, ry = 0) => st.add(tok, { x, y: ST, z, s: 6, ry, noShadow: true });
  for (let i = -4; i <= 4; i++) for (let k = -4; k <= 4; k++) {
    const x = i * PITCH, z = k * PITCH;
    roadAt(x, z, 'cityb:road_junction');
    // straight road pieces between junctions
    if (i < 4) { roadAt(x + PITCH / 2 - 0.0, z, 'cityb:road_straight', Math.PI / 2); }
    if (k < 4) { roadAt(x, z + PITCH / 2, 'cityb:road_straight', 0); }
    if (i < 4 && k < 4) {
      const bx = x + PITCH / 2, bz = z + PITCH / 2;
      const dist = Math.hypot(bx, bz);
      const key = pick(['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H']);
      const topY = dist < 30 ? -16 - Math.random() * 6 : -8 - Math.random() * 14 + Math.min(dist, 90) * 0.05;
      const sy = (topY - ST) / (FULLT[key] * 5.5);
      st.add(FULL[key], { x: bx, y: ST, z: bz, sx: 5.5, sy, sz: 5.5, ry: Math.floor(Math.random() * 4) * Math.PI / 2, noShadow: true });
      if (Math.random() < 0.5) st.add('cityb:watertower', { x: bx + rand(-2, 2), y: topY, z: bz + rand(-2, 2), s: 5, noShadow: true });
    }
  }
  // traffic
  A.cars = [];
  const carToks = ['cityb:car_taxi', 'cityb:car_sedan', 'cityb:car_police', 'cityb:car_hatchback', 'cityb:car_stationwagon', 'cityb:car_taxi'];
  for (let i = 0; i < 12; i++) {
    const lane = (i % 5 - 2) * PITCH;
    const dirv = i % 2 ? 1 : -1;
    const along = i % 3 === 0;
    const g = st.add(carToks[i % carToks.length], { dyn: true, x: 0, y: ST + 0.2, z: 0, s: 7.5, ry: along ? (dirv > 0 ? Math.PI / 2 : -Math.PI / 2) : (dirv > 0 ? 0 : Math.PI), shadow: false });
    A.cars.push({ g, lane: lane + dirv * 2.4, along, dir: dirv, pos: rand(-80, 80), v: rand(9, 16) });
  }
  A.updaters.push((dt) => {
    for (const c of A.cars) {
      c.pos += c.dir * c.v * dt; if (c.pos > 95) c.pos = -95; if (c.pos < -95) c.pos = 95;
      if (c.along) c.g.position.set(c.pos, ST + 0.2, c.lane); else c.g.position.set(c.lane, ST + 0.2, c.pos);
    }
  });

  // ---- wind gusts
  const wind = A.wind = { on: false, x: 0, z: 0, state: 'idle', t: 5 + Math.random() * 3, dir: 1 };
  A.reset = () => { wind.on = false; wind.state = 'idle'; wind.t = 6 + Math.random() * 3; };
  A.updaters.push((dt, round) => {
    if (round.phase !== 'play') return;
    wind.t -= dt;
    if (wind.state === 'idle' && wind.t <= 0) { wind.state = 'warn'; wind.t = 1.6; wind.dir = Math.random() < 0.5 ? -1 : 1; round.banner(wind.dir > 0 ? 'GUST INCOMING >>' : '<< GUST INCOMING', '#7ae8ff', 1.6); audio.sfx('warn'); }
    else if (wind.state === 'warn' && wind.t <= 0) { wind.state = 'blow'; wind.t = 2.5; wind.on = true; wind.x = wind.dir; wind.z = 0; audio.sfx('dash'); round.fx.shake(0.15); }
    else if (wind.state === 'blow' && wind.t <= 0) { wind.state = 'idle'; wind.on = false; wind.x = 0; wind.t = 6 + Math.random() * 4; }
    if (wind.state === 'warn' || wind.state === 'blow') {
      const n = wind.state === 'blow' ? 3 : 1;
      for (let i = 0; i < n; i++) round.fx.emit({ x: -wind.dir * 18 + rand(-4, 4), y: rand(0, 6), z: rand(-14, 14), vx: wind.dir * rand(28, 40), vy: rand(-0.5, 0.5), color: 0xcfeaff, size: rand(0.25, 0.5), life: 1.2, shape: 0, add: 0.8, a: 0.6 });
    }
  });
  A.hudDraw = (g, round, cam, t) => {
    if (wind.state !== 'warn' && wind.state !== 'blow') return;
    const on = wind.state === 'blow', a = on ? 0.9 : 0.4 + Math.sin(t * 16) * 0.3;
    g.save(); g.globalAlpha = a; g.strokeStyle = '#8fe8ff'; g.lineWidth = 8; g.lineJoin = 'round'; g.lineCap = 'round';
    for (let i = 0; i < 3; i++) {
      const x = W / 2 + wind.dir * ((t * (on ? 520 : 90) + i * 180) % 640 - 320), y = 160 + i * 14;
      g.beginPath(); g.moveTo(x - wind.dir * 26, y - 22); g.lineTo(x, y); g.lineTo(x - wind.dir * 26, y + 22); g.stroke();
    }
    g.restore();
  };

  A.cam = { center: [0, 1, 1], minDist: 11.5, maxDist: 26, pitch: 0.95, pad: 2.8 };
  A.navBounds = [-20, 20, -17, 19];
  return A.finish('Neon Rooftops');
}
