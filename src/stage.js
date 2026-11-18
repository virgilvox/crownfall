// The menu / podium stage: a Kenney arena plaza with columns, banners, statues, pedestals and a podium.
import * as THREE from 'three';
import { ArenaBase } from './arenas/common.js';
import { makeCrownMesh } from './crown.js';
import { PLAYER_HEX } from './roster.js';
import { srand } from './util.js';

export async function buildStage() {
  const A = new ArenaBase({ id: 'stage', name: 'STAGE' });
  const st = A.stage;
  A.sky(0x0c0724, 0x3a1b66, 0x7a2f7e, { midAt: 0.45, stars: 500, starSize: 2 });
  A.fog(0x2a1450, 40, 140);
  A.lights({ sky: 0xb9a6ff, ground: 0x5a3a70, hemi: 1.0, sun: 0xffe2b8, sunI: 2.4, sunPos: [10, 20, 16], shadow: 20, center: [0, 0, 0] });
  const fill = new THREE.PointLight(0xff6ab8, 26, 40, 1.4); fill.position.set(-9, 5, 6); A.scene.add(fill);
  const fill2 = new THREE.PointLight(0x58b8ff, 40, 40, 1.4); fill2.position.set(9, 5, 6); A.scene.add(fill2);

  // plaza floor 2x2 tiles
  const T = 2;
  for (let i = -8; i <= 8; i++) for (let k = -5; k <= 4; k++) {
    const edge = Math.abs(i) === 8 || k === -5 || k === 4;
    const x = i * T, z = k * T;
    if (Math.abs(i) === 8 && (k === -5 || k === 4)) continue;
    st.add((i + k) % 2 === 0 ? 'arena:floor' : 'arena:floor-detail', { x, y: 0, z, s: T, tint: edge ? 0x7a80c0 : 0x8f94d4 });
  }
  // thick base
  const base = new THREE.Mesh(new THREE.BoxGeometry(34, 4, 21), new THREE.MeshStandardMaterial({ color: 0x4a3566, roughness: 1 }));
  base.position.set(0, -2.02, -1); base.receiveShadow = true; A.scene.add(base);
  // back wall with a gate
  for (let i = -8; i <= 8; i++) {
    st.add(i === 0 ? 'arena:wall-gate' : 'arena:wall', { x: i * T, y: 0, z: -11.3, s: T, sy: T * 1.6, ry: 0 });
  }
  [-8.6, -4.4, 4.4, 8.6].forEach((x) => st.add('arena:banner', { x, y: 0.5, z: -10.5, s: 3.2 }));
  [-12.6, 12.6].forEach((x) => st.add('arena:statue', { x, y: 0, z: -9.0, s: 3.4, ry: x < 0 ? 0.3 : -0.3 }));
  for (const x of [-15, -11, -6.4, 6.4, 11, 15]) st.add('arena:column', { x, y: 0, z: -9.6, s: 3.4 });
  for (const x of [-16.4, 16.4]) for (const z of [-6, 2]) st.add('arena:column', { x, y: 0, z, s: 3.0 });
  srand(5);
  for (let i = 0; i < 10; i++) { const side = i % 2 ? 1 : -1; st.add('arena:tree', { x: side * (17.5 + (i % 4)), y: 0, z: -9 + (i * 1.7) % 14, s: 3 + (i % 3) * 0.5 }); }
  for (const x of [-14, 14]) st.add('arena:weapon-rack', { x, y: 0, z: -4, s: 2.2, ry: x < 0 ? 1.2 : -1.2 });
  st.add('arena:trophy', { x: -17.5, y: 0, z: -11, s: 2 });

  // podium (hidden until the end)
  A.podium = new THREE.Group();
  const heights = [1.3, 0.85, 0.55], xs = [0, -2.7, 2.7];
  heights.forEach((h, i) => st.add('arena:block', { x: xs[i], y: 0, z: -0.5, sx: 2.5, sy: h * 2, sz: 2.5, parent: A.podium, keep: true, tint: [0xffd86a, 0xdfe6f2, 0xe0a678][i] }));
  A.podium.visible = false; A.scene.add(A.podium);
  A.podiumSpots = [{ x: 0, y: 1.3, z: -0.5 }, { x: -2.7, y: 0.85, z: -0.5 }, { x: 2.7, y: 0.55, z: -0.5 }, { x: 5.2, y: 0, z: 1.0 }];

  // select pedestals
  A.pedestals = new THREE.Group();
  A.pedSpots = [];
  [-5.7, -1.9, 1.9, 5.7].forEach((x, i) => {
    st.add('arena:block', { x, y: 0, z: 0, sx: 3.3, sy: 0.9, sz: 3.3, parent: A.pedestals, keep: true, tint: 0xcdb8e8 });
    const disc = new THREE.Mesh(new THREE.CylinderGeometry(1.4, 1.4, 0.06, 40), new THREE.MeshBasicMaterial({ color: PLAYER_HEX[i], toneMapped: false }));
    disc.position.set(x, 0.47, 0); A.pedestals.add(disc);
    const ring = new THREE.Mesh(new THREE.RingGeometry(1.5, 1.62, 48), new THREE.MeshBasicMaterial({ color: PLAYER_HEX[i], side: THREE.DoubleSide, transparent: true, opacity: 0.8, blending: THREE.AdditiveBlending, depthWrite: false }));
    ring.rotation.x = -Math.PI / 2; ring.position.set(x, 0.5, 0); A.pedestals.add(ring);
    A.pedSpots.push({ x, y: 0.48, z: 0 });
  });
  A.pedestals.visible = false; A.scene.add(A.pedestals);

  // spinning crown for the title
  A.titleCrown = new THREE.Group();
  const cr = makeCrownMesh(); cr.scale.setScalar(2.6); A.titleCrown.add(cr); A.titleCrown.userData.mesh = cr;
  const cl = new THREE.PointLight(0xffd25a, 25, 14, 1.5); cl.position.y = 1; A.titleCrown.add(cl);
  A.titleCrown.position.set(0, 3.5, -3.5); A.scene.add(A.titleCrown);
  A.glow(0, 3.9, -3.9, 0xffc43a, 7, 0.55);

  // stage lights
  A.glow(-8.6, 4.6, -9.8, 0xff7ad8, 5, 0.35); A.glow(8.6, 4.6, -9.8, 0x6ad2ff, 5, 0.35);

  A.navBounds = [-1, 1, -1, 1];
  A.colliders = [];
  await A.finish('Stage');
  return A;
}
