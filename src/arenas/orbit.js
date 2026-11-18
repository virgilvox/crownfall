// ORBIT STATION: low-gravity landing pads above a giant ringed planet, with meteor showers.
import * as THREE from 'three';
import { ArenaBase } from './common.js';
import { box, wallBox, wallCyl } from '../physics.js';
import { audio } from '../audio.js';
import { srand, rand, pick } from '../util.js';
import { loadModel } from '../assets.js';

function planetTexture(w, h, bands, seed) {
  const c = document.createElement('canvas'); c.width = w; c.height = h; const g = c.getContext('2d');
  let s = seed; const r = () => { s = (s * 16807) % 2147483647; return s / 2147483647; };
  for (let y = 0; y < h; y++) { const t = y / h; const col = bands(t, r); g.fillStyle = col; g.fillRect(0, y, w, 1); }
  for (let i = 0; i < 260; i++) { g.fillStyle = `rgba(${r() < 0.5 ? '255,255,255' : '40,20,10'},${0.04 + r() * 0.08})`; g.beginPath(); g.ellipse(r() * w, r() * h, 20 + r() * 80, 2 + r() * 8, 0, 0, 7); g.fill(); }
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
}

export async function build(ctx) {
  const A = new ArenaBase({ id: 'orbit', name: 'ORBIT STATION', tagline: 'Low gravity, falling rocks', color: '#7aa8ff', music: 'tense', gravity: 0.6 });
  const st = A.stage;
  A.scene.background = new THREE.Color(0x02030c);
  A.sky(0x01020a, 0x080c2a, 0x0e1840, { stars: 1100, starSize: 2.2 });
  A.lights({ sky: 0x8aa4ff, ground: 0x3a2a40, hemi: 0.75, sun: 0xfff0d8, sunI: 2.1, sunPos: [-18, 28, 22], shadow: 28, center: [0, 0, 0] });
  const back = new THREE.DirectionalLight(0x6f8fff, 0.9); back.position.set(20, 10, -25); A.scene.add(back);

  // ---- planet below + ring + moon
  const pl = new THREE.Mesh(new THREE.SphereGeometry(80, 64, 40), new THREE.MeshStandardMaterial({
    map: planetTexture(1024, 512, (t, r) => { const b = Math.sin(t * 38) * 0.5 + Math.sin(t * 17 + 1) * 0.5; const k = 0.5 + b * 0.25; return `rgb(${Math.floor(70 * k + 40)},${Math.floor(110 * k + 60)},${Math.floor(190 * k + 40)})`; }, 7), roughness: 1, emissive: 0x0a1a38, emissiveIntensity: 0.3 }));
  pl.position.set(-42, -122, -58); pl.rotation.z = 0.35; pl.rotation.x = 0.4; A.scene.add(pl);
  const rc = document.createElement('canvas'); rc.width = 512; rc.height = 8; const rg = rc.getContext('2d');
  const gr = rg.createLinearGradient(0, 0, 512, 0); gr.addColorStop(0, 'rgba(240,210,160,0)'); gr.addColorStop(0.25, 'rgba(240,210,160,0.75)'); gr.addColorStop(0.45, 'rgba(180,140,100,0.25)'); gr.addColorStop(0.6, 'rgba(230,200,150,0.7)'); gr.addColorStop(1, 'rgba(240,210,160,0)');
  rg.fillStyle = gr; rg.fillRect(0, 0, 512, 8);
  const rt = new THREE.CanvasTexture(rc); rt.colorSpace = THREE.SRGBColorSpace;
  const rgeo = new THREE.RingGeometry(105, 170, 128, 1); const pos = rgeo.attributes.position, uv = rgeo.attributes.uv;
  for (let i = 0; i < pos.count; i++) { const d = Math.hypot(pos.getX(i), pos.getY(i)); uv.setXY(i, (d - 105) / 65, 0.5); }
  const ringM = new THREE.Mesh(rgeo, new THREE.MeshBasicMaterial({ map: rt, transparent: true, side: THREE.DoubleSide, depthWrite: false, fog: false }));
  ringM.position.copy(pl.position); ringM.rotation.x = Math.PI / 2 - 0.15; ringM.rotation.y = 0.0; ringM.rotation.z = 0.35; A.scene.add(ringM);
  const moon = new THREE.Mesh(new THREE.SphereGeometry(16, 32, 20), new THREE.MeshStandardMaterial({ map: planetTexture(256, 128, (t) => `rgb(${150 + Math.sin(t * 50) * 20},${150 + Math.sin(t * 50) * 20},${160})`, 3), roughness: 1 }));
  moon.position.set(70, -70, -90); A.scene.add(moon);

  // ---- main pad
  const pad = (cx, cz, top, s, big = false) => {
    const tok = big ? 'space:landingpad_large' : 'space:landingpad_small';
    const th = 0.5 * s;
    st.add(tok, { x: cx, y: top - th, z: cz, s });
    const sz = (big ? 2.5 : 1.9) * s;
    A.solid(box(cx, top, cz, sz - 0.5, sz - 0.5, 2));
    A.rockUnder(cx, top - th, cz, sz * 0.42, sz * 1.3, 0x4a4250, 6);
    return sz;
  };
  pad(0, 0, 0, 4.4, true);
  const sats = [[-14.5, -9.5, 2.0], [14.5, -9.5, 3.4], [-14.5, 10, 0.8], [14.5, 10, 2.4], [0, -16, 4.6], [0, 15.5, -1.5]];
  sats.forEach(([x, z, y]) => { pad(x, z, y, 3.4); A.pickups.push({ x, y, z }); });
  A.pickups.push({ x: 0, y: 0, z: 4 });
  // dais
  st.add('space:landingpad_small', { x: 0, y: 0, z: 0, s: 2.0 }); A.solid(box(0, 1.0, 0, 3.4, 3.4, 1.1));
  A.dais = { x: 0, y: 1.0, z: 0 };
  A.glow(0, 1.2, 0, 0x7ad8ff, 5, 0.35);
  for (const [x, z] of [[-1.7, -1.7], [1.7, -1.7], [-1.7, 1.7], [1.7, 1.7]]) A.neon(0x7ad8ff, x, 1.04, z, 0.25, 0.08, 0.25);

  // ---- props
  A.pickups.push();
  st.add('space:lander_A', { x: -4.5, y: 0, z: -4.0, s: 3.2, ry: 0.5 }); A.solid(wallBox(-4.5, -4.0, 4.0, 4.0, -1, 3.4));
  st.add('space:cargo_A_stacked', { x: 4.4, y: 0, z: -3.6, s: 3.0, ry: 0.2 }); A.solid(box(4.4, 3.0, -3.6, 2.9, 2.9, 3.1));
  st.add('space:cargo_B', { x: -4.0, y: 0, z: 3.8, s: 3.0 }); A.solid(box(-4.0, 1.55, 3.8, 1.4, 1.4, 1.6));
  st.add('space:cargo_B_packed', { x: -2.4, y: 0, z: 4.4, s: 2.6, ry: 0.6 });
  st.add('space:spacetruck', { x: 4.2, y: 0, z: 4.2, s: 3.6, ry: 2.4 }); A.solid(wallBox(4.2, 4.2, 2.2, 3.4, -1, 2.0));
  [[-4.2, -5.0], [5.0, 4.8]].forEach(([x, z]) => { st.add('space:lights', { x, y: 0, z, s: 4 }); A.glow(x, 3.8, z, 0xfff0b0, 3.2, 0.6); });
  const prop = (x, z, y, tok, s, ry = 0, wall = null) => { st.add(tok, { x, y, z, s, ry }); if (wall) A.solid(wall); };
  // satellites
  prop(-14.5, -9.5, 2.0, 'space:windturbine_tall', 2.8, 0.5); A.solid(wallCyl(-14.5, -9.5, 0.7, 1.5));
  prop(-16.2, -11, 2.0, 'space:solarpanel', 3.4, 0.4); prop(-12.8, -8, 2.0, 'space:rock_B', 3, 1);
  prop(14.5, -9.5, 3.4, 'space:cargodepot_B', 2.6, 3.14, wallBox(14.5, -9.5, 5.2, 5.0, 2.4, 5.5)); prop(16, -8, 3.4, 'space:lights', 3.4, 0);
  prop(-14.5, 10, 0.8, 'space:drill_structure', 2.4, 0.3, wallBox(-14.5, 10, 4.0, 4.0, 0, 5)); prop(-12.4, 11.6, 0.8, 'space:rocks_A', 2.5, 0.5);
  prop(14.5, 10, 2.4, 'space:lander_B', 2.6, -0.6, wallBox(14.5, 10, 3.4, 3.4, 1.4, 5)); prop(12.9, 8.6, 2.4, 'space:solarpanel', 3.2, 0.2);
  prop(0, -16, 4.6, 'space:structure_tall', 2.2, 0, wallBox(0, -16, 3.6, 3.6, 3.6, 8.6)); prop(1.8, -14.6, 4.6, 'space:containers_B', 3.2, 1);
  prop(0, 15.5, -1.5, 'space:basemodule_C', 2.0, 0, wallBox(0, 15.5, 4.2, 4.4, -2.5, 1.4)); prop(2.2, 14, -1.5, 'space:rocks_A', 2.5, 0.1);
  // a few floating rocks and a drifting satellite in the void
  A.drifters = [];
  [[-30, -6, -20], [32, -8, -14], [-26, -10, 28], [34, -4, 24], [8, -12, -34], [-8, -9, 36]].forEach(([x, y, z], i) => {
    const g = st.add(['space:rocks_B', 'space:rock_B', 'space:rocks_B'][i % 3], { dyn: true, x, y, z, s: 5 + (i % 3) * 2, shadow: false });
    A.drifters.push({ g, sp: new THREE.Vector3(rand(-1, 1), rand(-0.3, 0.3), rand(-1, 1)).multiplyScalar(0.4), rot: rand(-0.3, 0.3) });
  });
  A.updaters.push((dt) => { for (const d of A.drifters) { d.g.position.addScaledVector(d.sp, dt); d.g.rotation.y += d.rot * dt; d.g.rotation.x += d.rot * 0.5 * dt; } });

  A.spawns = [{ x: -3.3, y: 0, z: 2.6 }, { x: 3.3, y: 0, z: 2.8 }, { x: -3.3, y: 0, z: -1.0 }, { x: 3.3, y: 0, z: -1.2 }];
  A.safe = [...A.spawns, { x: 0, y: 0, z: 4.2 }, { x: -14.5, y: 2, z: -9.5 }, { x: 14.5, y: 3.4, z: -9 }];

  // ---- meteors
  const rockTok = await loadModel('space:rocks_B');
  const mt = A.meteor = { t: 6, list: [] };
  const discGeo = new THREE.CircleGeometry(1, 32), ringGeo = new THREE.RingGeometry(0.88, 1, 40);
  A.reset = () => { for (const m of mt.list) { m.ring.removeFromParent(); m.disc.removeFromParent(); m.rock && m.rock.removeFromParent(); } mt.list.length = 0; mt.t = 6; };
  const launch = (x, z, y, round) => {
    const ring = new THREE.Mesh(ringGeo, new THREE.MeshBasicMaterial({ color: 0xff4a3a, transparent: true, opacity: 0.9, depthWrite: false, side: THREE.DoubleSide, blending: THREE.AdditiveBlending }));
    const disc = new THREE.Mesh(discGeo, new THREE.MeshBasicMaterial({ color: 0xff3a2a, transparent: true, opacity: 0.2, depthWrite: false, side: THREE.DoubleSide, blending: THREE.AdditiveBlending }));
    for (const m of [ring, disc]) { m.rotation.x = -Math.PI / 2; m.position.set(x, y + 0.07, z); m.scale.setScalar(2.6); m.renderOrder = 4; A.scene.add(m); }
    mt.list.push({ x, z, y, t: 1.25, ring, disc, rock: null, fall: 0.55 });
  };
  A.updaters.push((dt, round) => {
    if (round.phase !== 'play') return;
    mt.t -= dt;
    if (mt.t <= 0) {
      const n = round.frenzy ? 3 : 2;
      for (let i = 0; i < n; i++) {
        let x, z, y;
        const f = pick(round.fighters.filter((q) => !q.dead));
        if (f && Math.random() < 0.6) { const g = round.world.ground(f.pos.x + rand(-3, 3), f.pos.z + rand(-3, 3), f.pos.y + 1.5); if (g) { x = f.pos.x + rand(-3, 3); z = f.pos.z + rand(-3, 3); y = g.y; } }
        if (x === undefined) { const s = pick(A.pickups); x = s.x + rand(-1.5, 1.5); z = s.z + rand(-1.5, 1.5); y = s.y; }
        launch(x, z, y, round);
      }
      audio.sfx('warn'); round.banner('INCOMING METEORS!', '#ff7a6a', 1.2);
      mt.t = round.frenzy ? 3.6 : 6.0 + Math.random() * 1.5;
    }
    for (let i = mt.list.length - 1; i >= 0; i--) {
      const m = mt.list[i]; m.t -= dt;
      const pulse = 0.6 + Math.sin(m.t * 26) * 0.3;
      m.ring.material.opacity = pulse; m.disc.material.opacity = 0.15 + (1 - m.t / 1.25) * 0.35;
      if (m.t <= m.fall && !m.rock) {
        m.rock = rockTok.clone(true); m.rock.scale.setScalar(2.4); m.rock.traverse((o) => { if (o.isMesh) { o.castShadow = true; } });
        const g = new THREE.Group(); g.add(m.rock); m.rock = g; g.position.set(m.x, m.y + 24, m.z); A.scene.add(g);
        round.fx.emit({ x: m.x, y: m.y + 20, z: m.z, vy: -30, color: 0xff8a3a, size: 3, life: 0.5, shape: 0, add: 1, a: 0.5 });
      }
      if (m.rock) {
        const k = 1 - Math.max(0, m.t) / m.fall;
        m.rock.position.y = m.y + 24 * (1 - k * k) + 0.2; m.rock.rotation.x += dt * 5; m.rock.rotation.z += dt * 3;
        round.fx.emit({ x: m.rock.position.x, y: m.rock.position.y + 1, z: m.rock.position.z, color: 0xff9a4a, size: 1.4, life: 0.4, shape: 0, add: 1, a: 0.6, vy: 3 });
      }
      if (m.t <= 0) {
        const p = new THREE.Vector3(m.x, m.y, m.z);
        round.fx.ring(p, 0xffa04a, 4.5, 0.5, 0.4, 1); round.fx.ring(p, 0xffffff, 3, 0.35); round.fx.dust(p, 18, 1.8);
        round.fx.burst(p.clone().setY(m.y + 0.5), 22, { color: [0xffa04a, 0xff5a2a, 0xffffff], speed: 9, up: 7, size: 0.4, shape: 2, add: 1, life: 0.8 });
        round.fx.shake(0.55); audio.sfx('slam');
        for (const f of round.fighters) {
          if (f.dead) continue;
          const dx = f.pos.x - m.x, dz = f.pos.z - m.z, d = Math.hypot(dx, dz);
          if (d < 2.6 + f.radius && Math.abs(f.pos.y - m.y) < 2.4) f.takeHit({ dx: d < 0.1 ? 1 : dx, dz: d < 0.1 ? 0 : dz, force: 12, up: 9, stun: 0.85, kind: 'hazard' }, round);
        }
        m.ring.removeFromParent(); m.disc.removeFromParent(); m.rock && m.rock.removeFromParent(); mt.list.splice(i, 1);
      }
    }
  });
  A.navOpts = { jumpRange: 7.6, jumpUp: 4.8 };
  A.cam = { center: [0, 1, 0], minDist: 12, maxDist: 28, pitch: 0.95, pad: 3 };
  A.navBounds = [-20, 20, -21, 21];
  return A.finish('Orbit Station');
}
