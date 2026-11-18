// Shared arena scaffolding: scene lighting, sky dome, glow sprites, neon strips, rock undersides.
import * as THREE from 'three';
import { Stage, progress } from '../assets.js';
import { World } from '../physics.js';
import { Nav } from '../nav.js';
import { glowTexture } from '../powerups.js';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { srand, rand } from '../util.js';

export class ArenaBase {
  constructor(meta) {
    Object.assign(this, { gravity: 1, ringY: -12, color: '#ffd23f', music: 'happy' }, meta);
    this.scene = new THREE.Scene();
    this.stage = new Stage(this.scene);
    this.colliders = []; this.spawns = []; this.pickups = []; this.updaters = []; this.dais = { x: 0, y: 0, z: 0 };
    this.sun = null; this.glows = []; this.neonGeos = new Map();
  }
  solid(c) { this.colliders.push(c); return c; }
  update(dt, round) { for (const u of this.updaters) u(dt, round); }

  lights({ sky = 0xbfd8ff, ground = 0x8a7a66, hemi = 1.0, sun = 0xfff1d6, sunI = 2.4, sunPos = [18, 30, 14], shadow = 24, center = [0, 0, 0], ambient = 0 }) {
    this.scene.add(new THREE.HemisphereLight(sky, ground, hemi));
    if (ambient) this.scene.add(new THREE.AmbientLight(0xffffff, ambient));
    const d = new THREE.DirectionalLight(sun, sunI);
    d.position.set(center[0] + sunPos[0], center[1] + sunPos[1], center[2] + sunPos[2]);
    d.target.position.set(...center);
    d.castShadow = true; d.shadow.mapSize.set(2048, 2048);
    const c = d.shadow.camera; c.left = -shadow; c.right = shadow; c.top = shadow; c.bottom = -shadow; c.near = 1; c.far = 110;
    d.shadow.bias = -0.0004; d.shadow.normalBias = 0.04;
    this.scene.add(d, d.target); this.sun = d;
  }
  fog(color, near, far) { this.scene.fog = new THREE.Fog(color, near, far); this.scene.background = new THREE.Color(color); }

  sky(top, mid, bot, { midAt = 0.52, stars = 0, starSize = 2, exponent = 1 } = {}) {
    const m = new THREE.ShaderMaterial({
      side: THREE.BackSide, depthWrite: false, fog: false,
      uniforms: { top: { value: new THREE.Color(top) }, mid: { value: new THREE.Color(mid) }, bot: { value: new THREE.Color(bot) }, midAt: { value: midAt } },
      vertexShader: 'varying vec3 vP; void main(){ vP=normalize(position); gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0); gl_Position.z=gl_Position.w*0.9999; }',
      fragmentShader: `uniform vec3 top,mid,bot; uniform float midAt; varying vec3 vP;
        void main(){ float h=vP.y*0.5+0.5; vec3 c = h<midAt ? mix(bot,mid,smoothstep(0.0,midAt,h)) : mix(mid,top,smoothstep(midAt,1.0,h)); gl_FragColor=vec4(c,1.0); }`,
    });
    const dome = new THREE.Mesh(new THREE.SphereGeometry(450, 24, 16), m); dome.renderOrder = -10; dome.frustumCulled = false; this.scene.add(dome);
    if (stars) {
      srand(7); const p = new Float32Array(stars * 3);
      for (let i = 0; i < stars; i++) { const u = Math.random() * 2 - 1, a = Math.random() * 6.283, r = Math.sqrt(1 - u * u); p[i * 3] = Math.cos(a) * r * 420; p[i * 3 + 1] = u * 420; p[i * 3 + 2] = Math.sin(a) * r * 420; }
      const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(p, 3));
      const pts = new THREE.Points(g, new THREE.PointsMaterial({ color: 0xffffff, size: starSize, sizeAttenuation: false, fog: false, depthWrite: false, transparent: true, opacity: 0.9 }));
      pts.renderOrder = -9; pts.frustumCulled = false; this.scene.add(pts);
    }
    return dome;
  }

  glow(x, y, z, color, size = 2.5, opacity = 0.8, flicker = 0) {
    const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTexture(), color, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, opacity, fog: false }));
    s.position.set(x, y, z); s.scale.setScalar(size); s.renderOrder = 6; this.scene.add(s);
    if (flicker) this.glows.push({ s, base: size, op: opacity, f: flicker, ph: Math.random() * 10 });
    return s;
  }
  // thin emissive box merged per colour
  neon(color, cx, cy, cz, w, h, d) {
    const k = String(color);
    if (!this.neonGeos.has(k)) this.neonGeos.set(k, []);
    const g = new THREE.BoxGeometry(w, h, d); g.translate(cx, cy, cz); g.deleteAttribute('uv'); this.neonGeos.get(k).push(g);
  }
  // rock chunk hanging under an island
  rockUnder(x, y, z, r, depth, color = 0x6b5a4a, sides = 7) {
    const g = new THREE.ConeGeometry(r, depth, sides, 2); g.rotateX(Math.PI);
    const p = g.attributes.position; for (let i = 0; i < p.count; i++) { const f = 1 + Math.sin(i * 12.9898) * 0.12; p.setX(i, p.getX(i) * f); p.setZ(i, p.getZ(i) * f); if (p.getY(i) < -depth * 0.3) p.setY(i, p.getY(i) + Math.sin(i * 78.2) * depth * 0.08); }
    g.computeVertexNormals();
    const m = new THREE.Mesh(g, new THREE.MeshStandardMaterial({ color, flatShading: true, roughness: 1 }));
    m.position.set(x, y - depth / 2, z); m.castShadow = true; m.receiveShadow = true; this.scene.add(m); return m;
  }

  // a big flat layer of soft blobs (clouds / mist) as ONE draw call; drifts slowly
  cloudLayer(y, size, { color = '255,255,255', count = 160, opacity = 0.9, seed = 1, blob = [90, 220], drift = 0.004, bg = null } = {}) {
    const c = document.createElement('canvas'); c.width = c.height = 1024; const g = c.getContext('2d');
    if (bg) { g.fillStyle = bg; g.fillRect(0, 0, 1024, 1024); }
    let s0 = seed; const r = () => { s0 = (s0 * 16807) % 2147483647; return s0 / 2147483647; };
    for (let i = 0; i < count; i++) {
      const x = r() * 1024, yy = r() * 1024, rad = blob[0] + r() * (blob[1] - blob[0]);
      for (const ox of [-1024, 0, 1024]) for (const oy of [-1024, 0, 1024]) {
        const gr = g.createRadialGradient(x + ox, yy + oy, 0, x + ox, yy + oy, rad);
        gr.addColorStop(0, `rgba(${color},0.55)`); gr.addColorStop(0.6, `rgba(${color},0.22)`); gr.addColorStop(1, `rgba(${color},0)`);
        g.fillStyle = gr; g.fillRect(x + ox - rad, yy + oy - rad, rad * 2, rad * 2);
      }
    }
    const t = new THREE.CanvasTexture(c); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.colorSpace = THREE.SRGBColorSpace; t.repeat.set(2.5, 2.5);
    const m = new THREE.Mesh(new THREE.PlaneGeometry(size, size), new THREE.MeshBasicMaterial({ map: t, transparent: true, opacity, depthWrite: false, fog: false, toneMapped: false }));
    m.rotation.x = -Math.PI / 2; m.position.y = y; m.renderOrder = -4; this.scene.add(m);
    this.updaters.push((dt) => { t.offset.x += dt * drift; t.offset.y += dt * drift * 0.4; });
    return m;
  }

  async finish(label) {
    await this.stage.finalize(label);
    for (const [k, geos] of this.neonGeos) {
      const m = new THREE.Mesh(mergeGeometries(geos), new THREE.MeshBasicMaterial({ color: Number(k), fog: false, toneMapped: false })); this.scene.add(m);
    }
    this.world = new World(this.colliders);
    const b = this.navBounds;
    this.nav = new Nav(this.world, b, this.navOpts);
    if (this.glows.length) this.updaters.push((dt, r) => { const t = performance.now() / 1000; for (const g of this.glows) { const k = 1 + Math.sin(t * 9 + g.ph) * g.f + Math.sin(t * 23 + g.ph * 2) * g.f * 0.5; g.s.scale.setScalar(g.base * k); g.s.material.opacity = g.op * (0.85 + (k - 1)); } });
    this.scene.updateMatrixWorld(true);
    return this;
  }
}

// scatter helper
export function ring(n, r, a0 = 0, fn) { for (let i = 0; i < n; i++) { const a = a0 + (i / n) * Math.PI * 2; fn(Math.cos(a) * r, Math.sin(a) * r, a, i); } }
