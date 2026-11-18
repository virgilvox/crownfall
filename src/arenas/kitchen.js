// KITCHEN CHAOS: tabletops, counters and a stove in a giant kitchen. The floor far below is the ring-out zone.
import * as THREE from 'three';
import { ArenaBase } from './common.js';
import { box, wallBox, wallCyl, cyl } from '../physics.js';
import { audio } from '../audio.js';
import { srand, rand, pick } from '../util.js';

export async function build(ctx) {
  const A = new ArenaBase({ id: 'kitchen', name: 'KITCHEN CHAOS', tagline: 'The stoves are heating up', color: '#ffb23a', music: 'epic', ringY: -17.5 });
  const st = A.stage;
  const FLOOR = -16;
  A.fog(0x6a3d22, 90, 260);
  A.sky(0x5a3520, 0xa0602e, 0xe0a060, {});
  A.lights({ sky: 0xffe6c0, ground: 0x8a5a38, hemi: 1.0, sun: 0xffe2b0, sunI: 1.9, sunPos: [10, 36, 16], shadow: 26, center: [0, 0, 0] });
  const lamp = (x, y, z, i = 40) => { const l = new THREE.PointLight(0xffc27a, i, 40, 1.4); l.position.set(x, y, z); A.scene.add(l); };
  lamp(-14, 14, -6, 60); lamp(14, 14, -6, 60); lamp(0, 12, 10, 40);

  // ---- platforms (each stands on a tiled column rising from the floor)
  const column = (x, z, top, w) => st.add('rest:pillar_B', { x, y: FLOOR, z, sx: w, sy: (top - FLOOR) / 4.1, sz: w, noShadow: false });
  // central table
  st.add('rest:kitchentable_A_large', { x: 0, y: -3, z: 0, s: 3 }); A.solid(box(0, 0, 0, 8.8, 5.8, 3));
  column(0, 0, -3, 3.4);
  // cutting board dais
  st.add('rest:cuttingboard', { x: 0, y: 0, z: 0, s: 3 }); A.solid(box(0, 0.44, 0, 4.2, 2.8, 0.5));
  A.dais = { x: 0, y: 0.44, z: 0 };
  A.glow(0, 1.2, 0, 0xffe27a, 4, 0.3);
  // table decor + cover
  st.add('rest:food_burger', { x: -2.6, y: 0, z: 1.2, s: 2.2, ry: 0.5 }); A.solid(wallCyl(-2.6, 1.2, 0.95, -1, 2.0));
  st.add('rest:pot_A_stew', { x: 3.2, y: 0, z: -1.5, s: 3, ry: 0.3 }); A.solid(box(3.2, 1.5, -1.5, 3.8, 2.6, 2));
  st.add('rest:ketchup', { x: 3.9, y: 0, z: 2.0, s: 3 }); A.solid(wallCyl(3.9, 2.0, 0.45, -1, 2.3));
  st.add('rest:mustard', { x: -3.9, y: 0, z: -1.9, s: 3 }); A.solid(wallCyl(-3.9, -1.9, 0.45, -1, 2.3));
  st.add('rest:plate', { x: 0.4, y: 0, z: 2.2, s: 3 }); st.add('rest:knife', { x: -1.8, y: 0, z: -2.2, s: 3, ry: 1.2, rz: 1.5707 });
  // left counters (one is a stove)
  const sx0 = -11.8, topL = 0.6;
  st.add('rest:kitchencounter_straight_A', { x: sx0, y: topL - 3.0, z: 3.3, s: 3, ry: Math.PI / 2 }); A.solid(box(sx0, topL, 3.3, 6.0, 6.0, 3)); column(sx0, 3.3, topL - 3, 3.6);
  st.add('rest:stove_single', { x: sx0, y: topL - 3.63, z: -3.3, s: 3, ry: Math.PI / 2 }); A.solid(box(sx0, topL, -3.3, 6.0, 6.0, 3)); column(sx0, -3.3, topL - 3.6, 3.6);
  st.add('rest:bowl', { x: sx0 - 0.5, y: topL, z: 3.6, s: 2.6 }); st.add('rest:jar_B_large', { x: sx0 + 1.8, y: topL, z: 4.8, s: 3 }); A.solid(wallCyl(sx0 + 1.8, 4.8, 0.7, topL - 1, topL + 2.3));
  // right stove
  const rx = 11.8, topR = 0.6;
  st.add('rest:stove_multi', { x: rx, y: topR - 3.6, z: -0.4, s: 3, ry: Math.PI / 2 }); A.solid(box(rx, topR, -0.4, 6.0, 6.8, 3)); column(rx, -0.4, topR - 3.6, 3.8);
  // back: crate step + fridge
  st.add('rest:crate_tomatoes', { x: -7.0, y: 2.4 - 2.76, z: -8.6, s: 3 }); A.solid(box(-7.0, 2.4, -8.6, 5.8, 5.8, 2.8)); column(-7, -8.6, 2.4 - 2.76, 3.4);
  st.add('rest:fridge_A', { x: 0.5, y: 4.6 - 7.5, z: -10.4, s: 3 }); A.solid(box(0.5, 4.6, -10.4, 5.8, 6.4, 3)); column(0.5, -10.4, 4.6 - 7.5, 3.6);
  st.add('rest:jar_A_large', { x: 1.8, y: 4.6, z: -9.6, s: 3 }); A.solid(wallCyl(1.8, -9.6, 0.7, 4.5, 6.9));
  // front crate + round table
  st.add('rest:crate_potatoes', { x: 3.5, y: -1.2 - 2.91, z: 10.2, s: 3 }); A.solid(box(3.5, -1.2, 10.2, 5.8, 5.8, 2.9)); column(3.5, 10.2, -1.2 - 2.9, 3.4);
  st.add('rest:table_round_A_small', { x: -9.4, y: 1.4 - 3.0, z: 9.2, s: 3 }); A.solid(cyl(-9.4, 1.4, 9.2, 2.1, 0.5)); column(-9.4, 9.2, -1.6, 1.4);
  st.add('rest:plate_small', { x: -9.4, y: 1.4, z: 9.2, s: 2.4 });
  // far right high shelf
  st.add('rest:crate_cheese', { x: 11.5, y: 3.4 - 2.85, z: 9.5, s: 2.6 }); A.solid(box(11.5, 3.4, 9.5, 5.0, 5.0, 2.8)); column(11.5, 9.5, 3.4 - 2.85, 3);

  A.pickups = [{ x: -11.8, y: 0.6, z: 3.3 }, { x: 11.8, y: 0.6, z: 3 }, { x: 0.5, y: 4.6, z: -10.4 }, { x: 3.5, y: -1.2, z: 10.2 }, { x: -7, y: 2.4, z: -8.6 }, { x: 11.5, y: 3.4, z: 9.5 }];
  A.spawns = [{ x: -1.5, y: 0.44, z: 0.3 }, { x: 1.5, y: 0.44, z: 0.3 }, { x: -0.8, y: 0.44, z: -1.5 }, { x: 0.8, y: 0.44, z: 1.5 }];
  A.safe = [...A.spawns, { x: -11.8, y: 0.6, z: 3.3 }, { x: 11.8, y: 0.6, z: 3 }, { x: 3.5, y: -1.2, z: 10.2 }];

  // ---- the kitchen around it
  for (let i = -3; i <= 2; i++) for (let k = -3; k <= 2; k++) st.add('rest:floor_kitchen', { x: i * 20 + 10, y: FLOOR - 0.5 * 5 + 0.5, z: k * 20 + 10, s: 5, noShadow: true });
  const wallRow = (z, ry, xs) => xs.forEach((x, i) => {
    const t = ['rest:wall', 'rest:wall_window_open', 'rest:wall', 'rest:wall_orderwindow', 'rest:wall', 'rest:wall_doorway', 'rest:wall_decorated', 'rest:wall'][i % 8];
    for (let h = 0; h < 3; h++) st.add(h === 0 ? t : 'rest:wall', { x, y: FLOOR + h * 12, z, s: 3, ry });
  });
  wallRow(-30, 0, [-48, -36, -24, -12, 0, 12, 24, 36, 48]);
  [-52, 52].forEach((x) => { for (let k = -2; k <= 3; k++) for (let h = 0; h < 3; h++) st.add('rest:wall', { x, y: FLOOR + h * 12, z: k * 12 - 6, s: 3, ry: Math.PI / 2 }); });
  // hanging gear on the back wall
  [[-20, 12], [-8, 14], [8, 12], [20, 14]].forEach(([x, y], i) => { st.add(['rest:extractorhood', 'rest:shelf_papertowel', 'rest:towelrail', 'rest:dishrack_plates'][i], { x, y, z: -27.5, s: 4 }); });
  // giant food scattered on the floor far below
  srand(4);
  const junk = ['rest:food_burger', 'rest:food_dinner', 'rest:crate_tomatoes', 'rest:pot_large', 'rest:pan_A', 'rest:jar_C_large', 'rest:bowl_dirty', 'rest:food_ingredient_tomato', 'rest:food_ingredient_cheese', 'rest:plate_dirty', 'rest:chair_stool', 'rest:crate_lettuce', 'rest:food_ingredient_carrot', 'rest:food_ingredient_bun', 'rest:ketchup', 'rest:lid_large'];
  for (let i = 0; i < 28; i++) {
    const a = Math.random() * 6.283, r = 30 + Math.random() * 40;
    st.add(junk[i % junk.length], { x: Math.cos(a) * r, y: FLOOR, z: Math.sin(a) * r - 4, s: 4 + Math.random() * 3, ry: Math.random() * 6, noShadow: true });
  }
  // floor tables far below for scale
  [[-34, -18], [34, -14], [-30, 24], [30, 22]].forEach(([x, z], i) => st.add(i % 2 ? 'rest:kitchentable_B_large' : 'rest:kitchentable_A_large', { x, y: FLOOR, z, s: 6, ry: i * 0.4, noShadow: true }));
  // warm light shafts
  [[-14, -6], [14, -6], [0, 10]].forEach(([x, z]) => A.glow(x, 14, z, 0xffc27a, 14, 0.12));

  // ---- hot stoves
  const hot = [];
  const mkStove = (cx, cz, w, d, col) => {
    const m = new THREE.Mesh(new THREE.PlaneGeometry(w - 0.4, d - 0.4), new THREE.MeshBasicMaterial({ color: 0xff6a1a, transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending }));
    m.rotation.x = -Math.PI / 2; m.position.set(cx, 0.65, cz); m.renderOrder = 4; A.scene.add(m);
    const l = new THREE.PointLight(0xff5a1a, 0, 14, 1.6); l.position.set(cx, 2.6, cz); A.scene.add(l);
    hot.push({ cx, cz, w, d, m, l, col, state: 'off', t: 2 + Math.random() * 4, hit: new Set() });
  };
  mkStove(sx0, -3.3, 6, 6, A.colliders[A.colliders.length - 0]);
  mkStove(rx, -0.4, 6, 6.8, null);
  A.hot = hot;
  A.reset = () => { for (const h of hot) { h.state = 'off'; h.t = 3 + Math.random() * 4; h.m.material.opacity = 0; h.l.intensity = 0; h.hit.clear(); } };
  A.updaters.push((dt, round) => {
    if (round.phase !== 'play') return;
    const t = performance.now() / 1000;
    for (const h of hot) {
      h.t -= dt;
      if (h.state === 'off' && h.t <= 0) { h.state = 'warm'; h.t = 2.0; audio.sfx('warn'); }
      else if (h.state === 'warm' && h.t <= 0) { h.state = 'hot'; h.t = 1.8; h.hit.clear(); audio.sfx('time'); round.fx.shake(0.15); }
      else if (h.state === 'hot' && h.t <= 0) { h.state = 'off'; h.t = (round.frenzy ? 2.5 : 4.5) + Math.random() * 3; }
      const k = h.state === 'warm' ? 1 - h.t / 2.0 : h.state === 'hot' ? 1 : h.state === 'off' ? 0 : 0;
      const pulse = h.state === 'warm' ? 0.3 + k * 0.5 + Math.sin(t * 14) * 0.08 : h.state === 'hot' ? 0.9 + Math.sin(t * 25) * 0.1 : 0;
      h.m.material.opacity = pulse * 0.7; h.m.material.color.setHex(h.state === 'hot' ? 0xff2a10 : 0xff8a2a); h.l.intensity = pulse * 60;
      if (h.state !== 'off' && Math.random() < 0.5) round.fx.emit({ x: h.cx + rand(-2.5, 2.5), y: 0.8, z: h.cz + rand(-2.5, 2.5), vy: rand(2, 4), color: h.state === 'hot' ? 0xff6a3a : 0xffaa55, size: 0.5, life: 0.8, shape: 0, add: 1, a: 0.5, grow: 1 });
      if (h.state === 'hot') {
        for (const f of round.fighters) {
          if (f.dead || h.hit.has(f) || f.invuln > 0) continue;
          if (Math.abs(f.pos.x - h.cx) < h.w / 2 && Math.abs(f.pos.z - h.cz) < h.d / 2 && f.pos.y < 1.4 && f.pos.y > -0.2) {
            h.hit.add(f); f.takeHit({ dx: rand(-0.3, 0.3), dz: rand(-0.3, 0.3), force: 3, up: 14, stun: 0.8, kind: 'hazard' }, round);
            round.popup(f.pos, 'HOT!', '#ff6a3a'); round.fx.burst(f.pos, 14, { color: [0xff6a3a, 0xffcc55], speed: 5, up: 6, size: 0.35, shape: 2, add: 1 });
          }
        }
      }
    }
  });

  A.cam = { center: [0, 0.5, 0], minDist: 11.5, maxDist: 26, pitch: 0.95, pad: 2.8 };
  A.navBounds = [-17, 17, -15, 15];
  return A.finish('Kitchen Chaos');
}
