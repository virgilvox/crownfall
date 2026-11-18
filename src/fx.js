// Particles (one Points draw call), shockwave rings, camera shake and hitstop.
import * as THREE from 'three';
import { rand, clamp } from './util.js';

const MAX = 2600;
const vs = `
attribute vec4 aColor; attribute float aSize; attribute vec2 aMisc;
uniform float uScale; varying vec4 vColor; varying vec2 vMisc;
void main(){ vColor=aColor; vMisc=aMisc; vec4 mv=modelViewMatrix*vec4(position,1.0);
  gl_PointSize=clamp(aSize*uScale/max(0.1,-mv.z),1.0,300.0); gl_Position=projectionMatrix*mv; }`;
const fs = `
varying vec4 vColor; varying vec2 vMisc;
void main(){ vec2 p=gl_PointCoord-0.5; float a;
  if(vMisc.x<0.5){ a=smoothstep(0.5,0.12,length(p)); }
  else if(vMisc.x<1.5){ a=1.0; }
  else { a=max(0.0,1.0-7.0*min(abs(p.x),abs(p.y)))*(1.0-1.6*length(p)); a=max(a,smoothstep(0.22,0.0,length(p))); }
  a*=vColor.a; if(a<0.01) discard;
  gl_FragColor=vec4(vColor.rgb*a, a*(1.0-vMisc.y)); }`;

export class FX {
  constructor() {
    this.n = 0;
    this.d = [];                 // per-particle js state
    const g = this.geo = new THREE.BufferGeometry();
    this.pos = new Float32Array(MAX * 3); this.col = new Float32Array(MAX * 4); this.size = new Float32Array(MAX); this.misc = new Float32Array(MAX * 2);
    g.setAttribute('position', new THREE.BufferAttribute(this.pos, 3).setUsage(THREE.DynamicDrawUsage));
    g.setAttribute('aColor', new THREE.BufferAttribute(this.col, 4).setUsage(THREE.DynamicDrawUsage));
    g.setAttribute('aSize', new THREE.BufferAttribute(this.size, 1).setUsage(THREE.DynamicDrawUsage));
    g.setAttribute('aMisc', new THREE.BufferAttribute(this.misc, 2).setUsage(THREE.DynamicDrawUsage));
    this.mat = new THREE.ShaderMaterial({
      vertexShader: vs, fragmentShader: fs, uniforms: { uScale: { value: 900 } },
      transparent: true, depthWrite: false, blending: THREE.CustomBlending, blendEquation: THREE.AddEquation,
      blendSrc: THREE.OneFactor, blendDst: THREE.OneMinusSrcAlphaFactor,
    });
    this.points = new THREE.Points(g, this.mat); this.points.frustumCulled = false; this.points.renderOrder = 10;
    // rings
    this.rings = [];
    const rg = new THREE.RingGeometry(0.86, 1, 56); rg.rotateX(-Math.PI / 2);
    for (let i = 0; i < 12; i++) {
      const m = new THREE.Mesh(rg, new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, depthWrite: false, side: THREE.DoubleSide, blending: THREE.AdditiveBlending }));
      m.visible = false; m.renderOrder = 9; this.rings.push({ m, t: 0, dur: 1, r0: 0, r1: 1, a: 1 });
    }
    this.group = new THREE.Group(); this.group.add(this.points); this.rings.forEach((r) => this.group.add(r.m));
    this.shakeAmt = 0; this.shakeT = 0; this.hitstop = 0; this.scene = null;
  }
  attach(scene) { if (this.scene) this.scene.remove(this.group); this.scene = scene; scene.add(this.group); this.clear(); }
  clear() { this.n = 0; this.d.length = 0; this.rings.forEach((r) => { r.m.visible = false; r.t = r.dur; }); }
  setCamera(cam, h = 720) { this.mat.uniforms.uScale.value = h / (2 * Math.tan((cam.fov * Math.PI) / 360)); }

  // o: x y z vx vy vz, color (hex), a, size, life, grav, drag, shape(0 soft,1 square,2 sparkle), add(0..1), grow, sway
  emit(o) {
    if (this.n >= MAX) return;
    const c = new THREE.Color(o.color ?? 0xffffff);
    this.d[this.n++] = { x: o.x, y: o.y, z: o.z, vx: o.vx || 0, vy: o.vy || 0, vz: o.vz || 0, r: c.r, g: c.g, b: c.b, a: o.a ?? 1, size: o.size ?? 0.3, t: 0, life: o.life ?? 0.6, grav: o.grav ?? 0, drag: o.drag ?? 0, shape: o.shape ?? 0, add: o.add ?? 0, grow: o.grow ?? 0, sway: o.sway || 0, ph: Math.random() * 6 };
  }
  burst(p, n, o = {}) {
    for (let i = 0; i < n; i++) {
      const a = Math.random() * Math.PI * 2, e = o.flat ? 0.15 : Math.random();
      const sp = (o.speed ?? 4) * (0.4 + Math.random() * 0.6);
      this.emit({ x: p.x + rand(-1, 1) * (o.spread || 0), y: p.y, z: p.z + rand(-1, 1) * (o.spread || 0), vx: Math.cos(a) * sp * (1 - e * 0.4), vy: (o.up ?? 3) * (0.3 + e) , vz: Math.sin(a) * sp * (1 - e * 0.4),
        color: Array.isArray(o.colors) ? o.colors[(Math.random() * o.colors.length) | 0] : o.color, size: (o.size ?? 0.3) * rand(0.7, 1.2), life: (o.life ?? 0.6) * rand(0.7, 1.2), grav: o.grav ?? 8, drag: o.drag ?? 1.5, shape: o.shape ?? 0, add: o.add ?? 0, grow: o.grow ?? 0, a: o.a ?? 1 });
    }
  }
  dust(p, n = 8, big = 1) { this.burst(p, n, { color: 0xd9d2c4, speed: 2.5 * big, up: 1.2, size: 0.45 * big, life: 0.5, grav: -0.5, drag: 3, flat: true, a: 0.6, grow: 0.8 }); }
  sparkle(p, n = 6, color = 0xffd54a) { this.burst(p, n, { color, speed: 2.5, up: 2, size: 0.28, life: 0.7, grav: 2, drag: 1, shape: 2, add: 1 }); }
  hit(p, color = 0xffe066) { this.burst(p, 14, { color: [color, 0xffffff, 0xff9040], speed: 7, up: 3, size: 0.34, life: 0.45, grav: 4, drag: 2, shape: 2, add: 1 }); }
  confetti(p, n = 60, spread = 6) {
    const cols = [0xff4d6d, 0x4dabff, 0xffd23f, 0x5ef38c, 0xff8ec9, 0xffffff, 0xb05cff];
    for (let i = 0; i < n; i++) this.emit({ x: p.x + rand(-spread, spread), y: p.y + rand(0, 2), z: p.z + rand(-spread, spread) * 0.6, vx: rand(-2, 2), vy: rand(-1, 3), vz: rand(-2, 2), color: cols[(Math.random() * cols.length) | 0], size: rand(0.14, 0.26), life: rand(3, 5), grav: 2.2, drag: 0.8, shape: 1, sway: rand(1, 2.5) });
  }
  ring(p, color = 0xffffff, r1 = 3, dur = 0.5, r0 = 0.3, a = 0.9) {
    const r = this.rings.find((q) => q.t >= q.dur) || this.rings[0];
    r.t = 0; r.dur = dur; r.r0 = r0; r.r1 = r1; r.a = a; r.m.visible = true; r.m.position.set(p.x, p.y + 0.06, p.z); r.m.material.color.set(color);
    r.m.scale.setScalar(r0);
  }
  shake(a) { this.shakeAmt = Math.min(1.2, Math.max(this.shakeAmt, a)); }
  freeze(sec) { this.hitstop = Math.max(this.hitstop, sec); }
  shakeOffset(out, t) {
    const a = this.shakeAmt * this.shakeAmt;
    out.set(Math.sin(t * 91) * a, Math.sin(t * 77 + 1) * a, Math.cos(t * 83) * a * 0.5);
    return out;
  }

  update(dt) {
    this.shakeAmt = Math.max(0, this.shakeAmt - dt * 3.2);
    for (let i = 0; i < this.n; i++) {
      const p = this.d[i];
      p.t += dt;
      if (p.t >= p.life) { this.d[i] = this.d[--this.n]; this.d.length = this.n; i--; continue; }
      p.vy -= p.grav * dt; const k = Math.exp(-p.drag * dt); p.vx *= k; p.vy *= (p.grav > 0 ? 1 : k); p.vz *= k;
      p.x += p.vx * dt + (p.sway ? Math.sin(p.t * 5 + p.ph) * p.sway * dt : 0); p.y += p.vy * dt; p.z += p.vz * dt;
    }
    for (let i = 0; i < this.n; i++) {
      const p = this.d[i], f = p.t / p.life;
      this.pos[i * 3] = p.x; this.pos[i * 3 + 1] = p.y; this.pos[i * 3 + 2] = p.z;
      const fade = f < 0.15 ? f / 0.15 : 1 - Math.max(0, (f - 0.5) / 0.5);
      this.col[i * 4] = p.r; this.col[i * 4 + 1] = p.g; this.col[i * 4 + 2] = p.b; this.col[i * 4 + 3] = p.a * clamp(fade, 0, 1);
      this.size[i] = p.size * (1 + p.grow * f);
      this.misc[i * 2] = p.shape; this.misc[i * 2 + 1] = p.add;
    }
    this.geo.setDrawRange(0, this.n);
    for (const k of ['position', 'aColor', 'aSize', 'aMisc']) this.geo.attributes[k].needsUpdate = true;
    for (const r of this.rings) {
      if (r.t >= r.dur) { r.m.visible = false; continue; }
      r.t += dt; const f = clamp(r.t / r.dur, 0, 1); const e = 1 - Math.pow(1 - f, 3);
      r.m.scale.setScalar(r.r0 + (r.r1 - r.r0) * e); r.m.material.opacity = r.a * (1 - f);
    }
  }
}
