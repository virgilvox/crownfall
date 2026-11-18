// SKY GARDEN: bright floating islands, crumbling stepping-stone tiles, a sea of clouds below.
import * as THREE from 'three';
import { ArenaBase } from './common.js';
import { box, cyl } from '../physics.js';
import { audio } from '../audio.js';
import { glowTexture } from '../powerups.js';
import { srand, srand as _s, rand } from '../util.js';

const HEX = { forest: 'hex:hex_forest', rock: 'hex:hex_rock', sand: 'hex:hex_sand' };

export async function build(ctx) {
  const A = new ArenaBase({ id: 'garden', name: 'SKY GARDEN', tagline: 'Mind the crumbling tiles', color: '#5ecbff', music: 'happy' });
  const st = A.stage;
  A.sky(0x1f6bff, 0x62b4ff, 0xb8e2ff, { midAt: 0.5 });
  A.fog(0x8cc8ff, 90, 300);
  A.lights({ sky: 0xdcecff, ground: 0xc4dc92, hemi: 0.95, sun: 0xfff0d0, sunI: 1.9, sunPos: [22, 36, 18], shadow: 26, center: [0, 0, 0] });

  // ---- central island
  const cs = 1.75;
  st.add('plat:platform-grass-large-round', { x: 0, y: -0.5 * cs, z: 0, s: cs });
  A.solid(cyl(0, 0, 0, 4.2, 1.1));
  A.rockUnder(0, -0.8, 0, 4.2, 8, 0x7a6350);
  // dais
  st.add('plat:platform', { x: 0, y: 0, z: 0, s: 1.5, tint: 0xfff3c0 });
  A.solid(box(0, 0.83, 0, 3.0, 3.0, 0.9));
  A.dais = { x: 0, y: 0.83, z: 0 };
  [[-1.55, -1.55], [1.55, -1.55]].forEach(([x, z], i) => st.add('plat:flag', { x, y: 0.2, z, s: 1.5, ry: i ? 0.4 : -0.4 }));
  // grass + bushes around the rim
  srand(11);
  for (let i = 0; i < 30; i++) {
    const a = Math.random() * 6.283, r = 3.2 + Math.random() * 0.8;
    if (Math.abs(Math.sin(a)) < 0.15 && Math.cos(a) > 0) continue;
    st.add(Math.random() < 0.5 ? 'plat:grass' : 'plat:grass-small', { x: Math.cos(a) * r, y: 0, z: Math.sin(a) * r, s: 1.6 + Math.random(), ry: Math.random() * 6 });
  }
  for (let i = 0; i < 7; i++) { const a = (i / 7) * 6.283 + 0.3; st.add('hex:detail_forestA', { x: Math.cos(a) * 4.4, y: -0.1, z: Math.sin(a) * 4.4, s: 1.1, ry: a }); }

  // ---- satellites + crumbling stepping stones
  const arms = [
    { dir: [-0.78, -0.62], top: 1.6, name: 'NW' }, { dir: [0.78, -0.62], top: 3.0, name: 'NE' },
    { dir: [-0.78, 0.62], top: 1.4, name: 'SW' }, { dir: [0.78, 0.62], top: 2.6, name: 'SE' },
  ];
  A.tiles = [];
  arms.forEach((a, i) => {
    const sx = a.dir[0] * 11.2, sz = a.dir[1] * 11.2;
    st.add('plat:platform-medium', { x: sx, y: a.top - 0.55 * 1.5, z: sz, s: 1.5 });
    A.solid(box(sx, a.top, sz, 4.4, 4.4, 0.9));
    A.rockUnder(sx, a.top - 0.8, sz, 2.1, 5, 0x7a6350);
    st.add('plat:flag', { x: sx + 1.4, y: a.top, z: sz - 1.4, s: 1.5, ry: i });
    st.add('plat:grass', { x: sx - 1.4, y: a.top, z: sz + 1.2, s: 2 });
    st.add('plat:grass-small', { x: sx + 1.3, y: a.top, z: sz + 1.4, s: 2.2 });
    A.pickups.push({ x: sx, y: a.top, z: sz });
    // crumbling tile
    const tx = a.dir[0] * 6.1, tz = a.dir[1] * 6.1, top = 0.6;
    const g = st.add('plat:platform-falling', { dyn: true, x: tx, y: top - 0.5 * 1.4, z: tz, s: 1.4 });
    const c = A.solid(box(tx, top, tz, 2.7, 2.7, 0.6));
    A.tiles.push({ c, g, home: new THREE.Vector3(tx, top - 0.5 * 1.4, tz), state: 'idle', t: 0, vy: 0, spin: new THREE.Vector3() });
  });
  // two high perches
  [[0, -13.5, 4.6], [0, 13.5, 4.2]].forEach(([x, z, top]) => {
    st.add('plat:platform', { x, y: top - 0.55 * 1.5, z, s: 1.5 });
    A.solid(box(x, top, z, 2.8, 2.8, 0.8));
    A.pickups.push({ x, y: top, z });
    st.add('plat:flag', { x: x + 0.8, y: top, z: z - 0.8, s: 1.4 });
  });
  A.pickups.push({ x: -3.0, y: 0, z: 0 }, { x: 3.0, y: 0, z: 0 });

  A.spawns = [{ x: -2.9, y: 0, z: 2.6 }, { x: 2.9, y: 0, z: 2.6 }, { x: -2.9, y: 0, z: -2.6 }, { x: 2.9, y: 0, z: -2.6 }];

  // ---- scenery: distant hex islands, clouds
  const hexIsland = (x, y, z, s, kinds) => {
    kinds.forEach((k, i) => {
      const row = Math.floor(i / 2), col = i % 2;
      const ox = col * 2 * s + (row % 2) * s, oz = row * 1.73 * s;
      st.add(HEX[k.t], { x: x + ox, y: y - s, z: z + oz, s });
      if (k.d) st.add(k.d, { x: x + ox, y, z: z + oz, s: s * 0.9, ry: i });
    });
    A.rockUnder(x + s, y - s, z + s * 0.8, s * 1.8, s * 4, 0x7a6350, 6);
  };
  hexIsland(-34, -6, -22, 3.0, [{ t: 'forest', d: 'hex:detail_forestA' }, { t: 'forest', d: 'hex:mountain' }, { t: 'rock' }]);
  hexIsland(32, -9, -26, 3.4, [{ t: 'forest', d: 'hex:house' }, { t: 'sand' }, { t: 'forest', d: 'hex:detail_forestA' }]);
  hexIsland(-40, -12, 18, 3.0, [{ t: 'rock', d: 'hex:mountain' }, { t: 'forest', d: 'hex:detail_forestA' }]);
  hexIsland(36, -7, 22, 3.0, [{ t: 'forest', d: 'hex:detail_forestA' }, { t: 'forest', d: 'hex:house' }]);
  hexIsland(4, -14, -52, 4.0, [{ t: 'rock', d: 'hex:mountain' }, { t: 'forest', d: 'hex:detail_forestA' }, { t: 'sand' }]);
  srand(3);
  // soft sea of cloud puffs far below + a few chunky low-poly clouds nearer the island
  A.cloudLayer(-30, 700, { count: 150, opacity: 1, seed: 5, blob: [60, 130], drift: 0.003, bg: 'rgba(70,140,240,1)' });
  A.cloudLayer(-18, 460, { count: 60, opacity: 0.7, seed: 9, blob: [60, 140], drift: 0.006 });
  A.cloudLayer(-9, 300, { count: 22, opacity: 0.5, seed: 13, blob: [50, 110], drift: 0.009 });
  for (let i = 0; i < 7; i++) {
    const a = Math.random() * 6.283, r = 24 + Math.random() * 30, s2 = 2.2 + Math.random() * 2.6;
    st.add(Math.random() < 0.5 ? 'fps:cloud' : 'plat:cloud', { x: Math.cos(a) * r, y: -3 - Math.random() * 10, z: Math.sin(a) * r - 6, sx: s2 * 2.2, sy: s2, sz: s2 * 1.4, ry: Math.random() * 3, noShadow: true });
  }
  // drifting cloud puffs
  A.drift = [];
  for (let i = 0; i < 6; i++) {
    const g = st.add('plat:cloud', { dyn: true, x: -50 + i * 20, y: -6 - (i % 3) * 3, z: -30 + (i % 2) * 60, sx: 7, sy: 2.6, sz: 4.2, shadow: false });
    A.drift.push({ g, v: 0.8 + (i % 3) * 0.4 });
  }
  A.updaters.push((dt) => { for (const d of A.drift) { d.g.position.x += d.v * dt; if (d.g.position.x > 70) d.g.position.x = -70; } });

  // ---- crumble logic
  const reset = () => { for (const t of A.tiles) { t.state = 'idle'; t.c.enabled = true; t.g.position.copy(t.home); t.g.rotation.set(0, 0, 0); t.g.scale.setScalar(1); t.g.visible = true; } };
  A.reset = reset;
  A.dangerAt = (x, z, y) => A.tiles.some((t) => (t.state === 'shake' || t.state === 'fall') && Math.abs(x - t.home.x) < 1.7 && Math.abs(z - t.home.z) < 1.7 && y < 1.5);
  A.updaters.push((dt, round) => {
    for (const t of A.tiles) {
      if (t.state === 'idle') {
        if (round.fighters.some((f) => f.groundC === t.c)) { t.state = 'shake'; t.t = 0.8; audio.sfx('warn'); }
      } else if (t.state === 'shake') {
        t.t -= dt;
        t.g.position.set(t.home.x + Math.sin(t.t * 90) * 0.07, t.home.y, t.home.z + Math.cos(t.t * 77) * 0.07);
        if (Math.random() < 0.3) round.fx.dust(new THREE.Vector3(t.home.x + rand(-1.3, 1.3), t.home.y + 0.7, t.home.z + rand(-1.3, 1.3)), 1, 0.6);
        if (t.t <= 0) { t.state = 'fall'; t.c.enabled = false; t.vy = 0; t.spin.set(rand(-1, 1), rand(-1, 1), rand(-1, 1)); round.fx.dust(t.home, 10, 1.4); }
      } else if (t.state === 'fall') {
        t.vy -= 28 * dt; t.g.position.y += t.vy * dt; t.g.rotation.x += t.spin.x * dt; t.g.rotation.z += t.spin.z * dt;
        if (t.g.position.y < t.home.y - 40) { t.state = 'gone'; t.t = 5; t.g.visible = false; }
      } else if (t.state === 'gone') {
        t.t -= dt;
        if (t.t <= 0) { t.state = 'back'; t.t = 0; t.g.position.copy(t.home); t.g.rotation.set(0, 0, 0); t.g.visible = true; t.c.enabled = true; round.fx.ring(new THREE.Vector3(t.home.x, t.home.y + 0.6, t.home.z), 0xffffff, 2, 0.4); }
      } else if (t.state === 'back') {
        t.t += dt * 4; t.g.scale.setScalar(Math.min(1, 0.2 + t.t * 0.8) * (1 + Math.sin(Math.min(t.t, 1) * 3.14) * 0.15));
        if (t.t >= 1) { t.state = 'idle'; t.g.scale.setScalar(1); }
      }
    }
  });

  A.navOpts = { jumpRange: 6.2, jumpUp: 3.2, avoid: (x, z, y) => (A.tiles.some((t) => Math.abs(x - t.home.x) < 1.6 && Math.abs(z - t.home.z) < 1.6) ? 40 : 0) };
  A.cam = { center: [0, 1.5, 0], minDist: 10.5, maxDist: 23, pitch: 0.95, pad: 2.6 };
  A.navBounds = [-18, 18, -20, 20];
  A.nav = null;
  return A.finish('Sky Garden');
}
