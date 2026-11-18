// PUMPKIN HOLLOW: a haunted graveyard island under a misty night, with giant rolling jack-o-lanterns.
import * as THREE from 'three';
import { ArenaBase } from './common.js';
import { box, wallBox, wallCyl } from '../physics.js';
import { audio } from '../audio.js';
import { srand, rand, pick } from '../util.js';

const JACK = { orange: 'hall:pumpkin_orange_jackolantern', yellow: 'hall:pumpkin_yellow_jackolantern' };

export async function build(ctx) {
  const A = new ArenaBase({ id: 'hollow', name: 'PUMPKIN HOLLOW', tagline: 'Giant jack-o-lanterns on the loose', color: '#ff9a2e', music: 'sneaky' });
  const st = A.stage;
  A.fog(0x1b1440, 45, 170);
  A.sky(0x070a22, 0x1f1a4d, 0x3a2a5e, { stars: 400 });
  A.lights({ sky: 0x6f7fff, ground: 0x2a1a3a, hemi: 0.85, sun: 0xa9b8ff, sunI: 1.5, sunPos: [-16, 28, 14], shadow: 24, center: [0, 0, 0] });
  const lamp = (x, y, z, i = 28) => { const l = new THREE.PointLight(0xff8a2a, i, 16, 1.5); l.position.set(x, y, z); A.scene.add(l); };

  // ---- island: 5x5 dirt tiles minus corners
  for (let i = -2; i <= 2; i++) for (let k = -2; k <= 2; k++) {
    if (Math.abs(i) === 2 && Math.abs(k) === 2) continue;
    st.add('hall:floor_dirt', { x: i * 4, y: -0.03, z: k * 4, s: 1, tint: (i + k) % 2 ? 0xffffff : 0xe8dcd0 });
  }
  A.solid(box(0, 0, 0, 20, 12, 1)); A.solid(box(0, 0, 0, 12, 20, 1)); A.solid(box(0, 0, 0, 16, 16, 1));
  A.rockUnder(0, -0.5, 0, 9, 11, 0x3a2f4a, 8);
  A.rockUnder(-5, -0.5, 4, 4.5, 8, 0x2f2640, 7); A.rockUnder(6, -0.5, -4, 4.5, 7, 0x2f2640, 7);
  // path
  [[-2, 6], [2, 6], [0, 8], [-2, -6], [2, -6]].forEach(([x, z], i) => st.add(['hall:path_A', 'hall:path_B', 'hall:path_C', 'hall:path_D', 'hall:path_A'][i], { x, y: 0.02, z, s: 1.5, ry: i }));

  // ---- central dais
  st.add('hall:plaque', { x: 0, y: 0, z: 0, s: 2.1 });
  A.solid(box(0, 0.84, 0, 4.0, 4.0, 1));
  st.add('hall:candle_triple', { x: -1.5, y: 0.84, z: -1.5, s: 1.3 }); st.add('hall:candle', { x: 1.5, y: 0.84, z: -1.5, s: 1.3 });
  st.add('hall:skull_candle', { x: -1.6, y: 0.84, z: 1.5, s: 0.9 }); st.add('hall:candle_thin', { x: 1.6, y: 0.84, z: 1.6, s: 1.5 });
  A.dais = { x: 0, y: 0.84, z: 0 };
  lamp(0, 2.6, 0, 30);
  A.glow(-1.5, 1.9, -1.5, 0xffa34a, 2.0, 0.8, 0.08); A.glow(1.5, 1.8, -1.5, 0xffa34a, 1.8, 0.8, 0.08); A.glow(1.6, 2.2, 1.6, 0xffa34a, 1.4, 0.7, 0.08);

  // ---- crypt backdrop + gate + fences
  st.add('hall:crypt', { x: 0, y: -0.3, z: -15, s: 1.4 });
  A.solid(wallBox(0, -15, 8.4, 11.2, -1));
  st.add('hall:arch_gate', { x: 0, y: 0, z: -9.6, s: 1.5 });
  A.glow(0, 3.2, -14, 0xffa34a, 5, 0.35);
  for (const x of [-8, -4, 4, 8]) { st.add('hall:fence', { x, y: 0, z: -9.8, s: 1 }); A.solid(wallBox(x, -9.8, 4, 0.6, -1, 2.2)); }
  A.solid(wallBox(-2.6, -9.6, 0.8, 1, -1, 4.4)); A.solid(wallBox(2.6, -9.6, 0.8, 1, -1, 4.4));
  for (const z of [-6, -2, 6]) for (const sx of [-1, 1]) { st.add(z === -2 ? 'hall:fence_broken' : 'hall:fence', { x: sx * 9.7, y: 0, z, s: 1, ry: Math.PI / 2 }); if (z !== -2) A.solid(wallBox(sx * 9.7, z, 0.6, 4, -1, 2.2)); }
  for (const [x, z] of [[-9.7, -9.8], [9.7, -9.8], [-9.7, 4], [9.7, 4]]) st.add('hall:fence_pillar', { x, y: 0, z, s: 1.1 });

  // ---- graves and cover
  const stone = (tok, x, z, w, h, ry = 0, s = 1) => { st.add(tok, { x, y: 0, z, s, ry }); A.solid(box(x, h, z, w, 0.9, 1)); };
  stone('hall:gravestone', -6.5, 2, 1.5, 1.6, 0.2, 1.1); stone('hall:gravestone', 6.2, 2.4, 1.5, 1.6, -0.2, 1.1);
  stone('hall:grave_B', -3.5, -5.5, 2.0, 2.2, 0, 1); stone('hall:grave_A', 4, -6, 2.0, 2.1, 0.1, 1);
  stone('hall:gravestone', -8, -1, 1.5, 1.6, 1.4, 1.1); stone('hall:gravestone', 8, 0, 1.5, 1.6, -1.5, 1.1);
  for (const [x, z, r] of [[-5, 6.6, 0.3], [5.5, 7, -0.4], [-7.5, 8, 0.1], [8, -3.5, 1], [-9, -5.5, 2]]) st.add(Math.random() < 0.5 ? 'hall:gravemarker_A' : 'hall:gravemarker_B', { x, y: 0, z, s: 1.4, ry: r });
  st.add('hall:coffin_decorated', { x: -7.5, y: 0, z: 6.5, s: 1.2, ry: 0.4 }); A.solid(wallBox(-7.5, 6.5, 2.2, 3.4, -1, 1.1));
  st.add('hall:bench_decorated', { x: 7, y: 0, z: 6.5, s: 1.5, ry: -0.3 }); A.solid(wallBox(7, 6.5, 2.8, 1.4, -1, 0.8));
  st.add('hall:ribcage', { x: 2.5, y: 0.2, z: 5, s: 1.3, ry: 1 }); st.add('hall:skull', { x: -3, y: 0.3, z: 4.5, s: 0.7 }); st.add('hall:bone_A', { x: 6, y: 0.1, z: 4, s: 1.2, ry: 2 }); st.add('hall:bone_B', { x: -6, y: 0.1, z: -3, s: 1.2 }); st.add('hall:bone_C', { x: 2, y: 0.1, z: -3.5, s: 1.2, ry: 1 });
  // pumpkins
  for (const [x, z, k] of [[-2.5, 3.6, 'orange'], [3.0, 3.3, 'yellow'], [-8.4, 4.4, 'orange'], [8.4, -6.5, 'yellow'], [-3, -8, 'orange'], [4.8, -8.4, 'orange']]) st.add(JACK[k], { x, y: 0, z, s: 1.1, ry: rand(-0.5, 0.5) + (z > 0 ? Math.PI : 0) * 0 });
  for (const [x, z] of [[-4.5, 8], [4.5, 8.5], [9, 3], [-9, 2.5], [0.8, 4.4], [-1.2, -7]]) st.add(Math.random() < 0.5 ? 'hall:pumpkin_orange_small' : 'hall:pumpkin_yellow_small', { x, y: 0, z, s: 1.2, ry: rand(0, 6) });
  for (const [x, z] of [[-4.5, 8], [4.5, 8.5], [-2.5, 3.6], [3, 3.3], [8.4, -6.5], [-8.4, 4.4]]) A.glow(x, 0.7, z, 0xff8a1a, 2.4, 0.55, 0.1);
  // lanterns with real light
  const lanternPost = (x, z, ry = 0) => { st.add('hall:post_lantern', { x, y: 0, z, s: 1.3, ry }); A.solid(wallCyl(x, z, 0.3, -1, 4)); A.glow(x + 0.45 * Math.cos(ry), 3.7, z - 0.8 * Math.sin(ry), 0xffa34a, 3.4, 0.8, 0.1); };
  lanternPost(-9.2, 8.8, 0); lanternPost(9.2, 8.8, Math.PI);
  lamp(-9, 3.5, 8.2, 24); lamp(9, 3.5, 8.2, 24); lamp(0, 3.2, -8.5, 20);
  for (const [x, z] of [[-6, 4.5], [6, -2.5], [-2.2, -3], [3.4, 6], [-9, -8], [9, -8]]) { st.add('hall:lantern_standing', { x, y: 0, z, s: 1.3 }); A.glow(x, 0.95, z, 0xffa34a, 2.4, 0.7, 0.1); }
  // raised stone steps
  st.add('hall:plaque', { x: -8, y: 0, z: -5.4, s: 1.7 }); A.solid(box(-8, 0.68, -5.4, 3.4, 3.4, 1));
  st.add('hall:plaque', { x: -8, y: 0.68, z: -5.4, s: 1.0 }); A.solid(box(-8, 1.08, -5.4, 2.0, 2.0, 1));
  st.add('hall:plaque', { x: 8, y: 0, z: -5.4, s: 1.7 }); A.solid(box(8, 0.68, -5.4, 3.4, 3.4, 1));
  st.add('hall:shrine_candles', { x: 8, y: 0.68, z: -5.4, s: 1.4 }); A.glow(8, 2.2, -5.4, 0xffa34a, 2.2, 0.6, 0.1);
  A.pickups = [{ x: -8, y: 1.08, z: -5.4 }, { x: 8, y: 0.68, z: -4 }, { x: -8, y: 0, z: 7 }, { x: 8, y: 0, z: 7.6 }, { x: 0, y: 0, z: 8 }];
  A.spawns = [{ x: -5.2, y: 0, z: 4.6 }, { x: 5.2, y: 0, z: 4.6 }, { x: -5.4, y: 0, z: -2 }, { x: 5.4, y: 0, z: -2 }];

  // trees on the rim
  srand(9);
  const trees = ['hall:tree_dead_large', 'hall:tree_dead_medium', 'hall:tree_pine_orange_large', 'hall:tree_pine_orange_medium', 'hall:tree_dead_small', 'hall:tree_pine_yellow_medium'];
  [[-13.5, -9], [13.5, -9], [-13.5, -1], [13.5, -2], [-13, 6], [13, 6], [-6.5, -11.5], [6.8, -11.8], [-11.5, -11]].forEach(([x, z], i) => { st.add(trees[i % trees.length], { x, y: -0.3, z, s: 0.9 + (i % 3) * 0.1, ry: i, tint: 0xd8d0e8 }); });
  // far below: a dark forest + mist
  for (let i = 0; i < 260; i++) {
    const a = Math.random() * 6.283, r = 16 + Math.random() * 80;
    st.add(pick(['hall:tree_pine_orange_large', 'hall:tree_pine_yellow_large', 'hall:tree_dead_large']), { x: Math.cos(a) * r, y: -30 + Math.random() * 3, z: Math.sin(a) * r - 6, s: 1.8 + Math.random() * 1.8, ry: Math.random() * 6, tint: 0x3a3a60, noShadow: true });
  }
  const g2 = new THREE.Mesh(new THREE.PlaneGeometry(400, 400), new THREE.MeshBasicMaterial({ color: 0x120e2a })); g2.rotation.x = -Math.PI / 2; g2.position.y = -31; A.scene.add(g2);
  A.cloudLayer(-19, 420, { color: '110,100,190', count: 120, opacity: 0.7, seed: 3, blob: [60, 150], drift: 0.004 });
  A.cloudLayer(-9, 260, { color: '90,84,160', count: 60, opacity: 0.45, seed: 8, blob: [50, 120], drift: 0.007 });
  // moon-lit rocks floating around
  [[-24, -8, -14], [26, -12, -6], [-20, -14, 16], [22, -9, 18]].forEach(([x, y, z], i) => A.rockUnder(x, y, z, 3 + i, 6 + i, 0x3a2f4a, 6));

  // ---- rolling pumpkins
  const lanes = [];
  A.rollers = [];
  const model = (await import('../assets.js')).loadModel;
  const prefab = await model('hall:pumpkin_orange_jackolantern');
  const roll = A.roll = { t: 6 + Math.random() * 2, tele: null, active: [] };
  const teleMat = () => new THREE.MeshBasicMaterial({ color: 0xff7a1a, transparent: true, opacity: 0.4, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide });
  const spawnRoller = (lane) => {
    const grp = new THREE.Group(); const m = prefab.clone(true); m.scale.setScalar(3.0); m.position.set(0, -1.95, 0);
    m.traverse((o) => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } }); grp.add(m);
    const l = new THREE.PointLight(0xff7a1a, 40, 14, 1.5); l.position.set(0, 1.5, 0); grp.add(l);
    const gl = A.glow(0, 1.5, 0, 0xff7a1a, 5.5, 0.6); grp.add(gl);
    const start = lane.dir * -17;
    if (lane.axis === 'x') grp.position.set(start, 1.95, lane.at); else grp.position.set(lane.at, 1.95, start);
    A.scene.add(grp);
    roll.active.push({ grp, m, lane, hit: new Set(), v: 11 });
  };
  const clearRollers = () => { for (const r of roll.active) r.grp.removeFromParent(); roll.active.length = 0; if (roll.tele) { roll.tele.mesh.removeFromParent(); roll.tele = null; } };
  A.reset = () => { clearRollers(); roll.t = 6 + Math.random() * 2; };
  A.updaters.push((dt, round) => {
    if (round.phase !== 'play') return;
    roll.t -= dt;
    if (!roll.tele && roll.t <= 0) {
      const axis = Math.random() < 0.7 ? 'x' : 'z', dir = Math.random() < 0.5 ? -1 : 1;
      const at = axis === 'x' ? pick([-7, -3.5, 0, 3.5, 7]) : pick([-6.5, -2, 2, 6.5]);
      const lane = { axis, dir, at };
      const len = 38, geo = axis === 'x' ? new THREE.PlaneGeometry(len, 4.2) : new THREE.PlaneGeometry(4.2, len);
      const mesh = new THREE.Mesh(geo, teleMat()); mesh.rotation.x = -Math.PI / 2; mesh.position.set(axis === 'x' ? 0 : at, 0.1, axis === 'x' ? at : 0); mesh.renderOrder = 4; A.scene.add(mesh);
      roll.tele = { lane, mesh, t: 1.1 }; audio.sfx('warn'); round.banner('ROLLING PUMPKIN!', '#ff9a2e', 1.2);
    }
    if (roll.tele) {
      roll.tele.t -= dt; roll.tele.mesh.material.opacity = 0.25 + (Math.sin(roll.tele.t * 22) * 0.5 + 0.5) * 0.4;
      if (roll.tele.t <= 0) { spawnRoller(roll.tele.lane); roll.tele.mesh.removeFromParent(); roll.tele = null; roll.t = (round.frenzy ? 3.2 : 5.5) + Math.random() * 3; }
    }
    for (let i = roll.active.length - 1; i >= 0; i--) {
      const r = roll.active[i], L = r.lane;
      const mv = L.dir * r.v * dt;
      if (L.axis === 'x') { r.grp.position.x += mv; r.m.parent.rotation.z -= (mv / 2.0); } else { r.grp.position.z += mv; r.m.parent.rotation.x += (mv / 2.0); }
      if (Math.random() < 0.4) round.fx.dust(new THREE.Vector3(r.grp.position.x, 0.2, r.grp.position.z), 1, 1.2);
      for (const f of round.fighters) {
        if (f.dead || r.hit.has(f) || f.invuln > 0) continue;
        const dx = f.pos.x - r.grp.position.x, dz = f.pos.z - r.grp.position.z;
        if (dx * dx + dz * dz < 2.5 * 2.5 && f.pos.y < 2.8) {
          r.hit.add(f);
          f.takeHit({ dx: L.axis === 'x' ? L.dir : dx * 0.5, dz: L.axis === 'z' ? L.dir : dz * 0.5, force: 15, up: 9, stun: 0.9, kind: 'hazard' }, round);
          round.popup(f.pos, 'SQUASHED!', '#ff9a2e'); round.fx.shake(0.5); round.fx.ring(f.pos, 0xff7a1a, 3, 0.4);
        }
      }
      if (Math.abs(r.grp.position.x) > 19 || Math.abs(r.grp.position.z) > 19) { r.grp.removeFromParent(); roll.active.splice(i, 1); }
    }
  });
  // rotation pivot: the model hangs below the group, so rotate the group's child wrapper (handled via m.parent === grp)
  A.cam = { center: [0, 1, 0], minDist: 11.5, maxDist: 24, pitch: 0.95, pad: 2.8 };
  A.navBounds = [-12, 12, -12, 12];
  return A.finish('Pumpkin Hollow');
}
