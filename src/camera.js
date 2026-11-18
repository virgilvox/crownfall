// One shared camera: frames every living fighter + the crown, damped, with shake and an intro fly-around.
import * as THREE from 'three';
import { clamp, damp, easeInOut, easeOut } from './util.js';

export class GameCamera {
  constructor() {
    this.cam = new THREE.PerspectiveCamera(40, 16 / 9, 0.5, 600);
    this.target = new THREE.Vector3(); this.dist = 30; this.yaw = 0; this.pitch = 0.9;
    this.shake = new THREE.Vector3(); this.cfg = null; this.t = 0;
    this.focus = null;
  }
  setArena(cfg) {
    this.cfg = cfg; this.pitch = cfg.pitch ?? 0.92;
    this.target.set(...cfg.center); this.dist = cfg.maxDist; this.yaw = 0;
  }
  // points: array of Vector3 to keep in view
  frame(points, dt, snap = false) {
    const c = this.cfg; if (!c) return;
    if (!points.length) points = [new THREE.Vector3(...c.center)];
    let minX = 1e9, maxX = -1e9, minZ = 1e9, maxZ = -1e9, minY = 1e9, maxY = -1e9;
    for (const p of points) { minX = Math.min(minX, p.x); maxX = Math.max(maxX, p.x); minZ = Math.min(minZ, p.z); maxZ = Math.max(maxZ, p.z); minY = Math.min(minY, p.y); maxY = Math.max(maxY, p.y); }
    const pad = c.pad ?? 5.5;
    const cx = (minX + maxX) / 2, cz = (minZ + maxZ) / 2, cy = (minY + maxY) / 2;
    const ex = maxX - minX + pad * 2, ez = maxZ - minZ + pad * 2, ey = maxY - minY + 2;
    const vf = (this.cam.fov * Math.PI) / 180, th = Math.tan(vf / 2), tw = th * this.cam.aspect;
    const band = 0.64;   // usable share of the screen height (between the timer and the HUD cards)
    const needW = ex / (2 * tw), needH = (ez * Math.sin(this.pitch) + ey * Math.cos(this.pitch)) / (2 * th * band);
    const dist = clamp(Math.max(needW, needH), c.minDist, c.maxDist);
    // pull the framing centre a little toward the arena centre so the stage stays composed
    const k = c.centerPull ?? 0.1;
    const tx = cx + (c.center[0] - cx) * k, tz = cz + (c.center[2] - cz) * k, ty = cy;
    if (snap) { this.target.set(tx, ty, tz); this.dist = dist; }
    else { this.target.x = damp(this.target.x, tx, 3.2, dt); this.target.y = damp(this.target.y, ty, 3.2, dt); this.target.z = damp(this.target.z, tz, 3.2, dt); this.dist = damp(this.dist, dist, 2.4, dt); }
  }
  apply(shakeOffset) {
    const cp = Math.cos(this.pitch), sp = Math.sin(this.pitch);
    this.cam.position.set(this.target.x + Math.sin(this.yaw) * cp * this.dist, this.target.y + sp * this.dist, this.target.z + Math.cos(this.yaw) * cp * this.dist);
    if (shakeOffset) this.cam.position.add(shakeOffset);
    this.cam.lookAt(this.target);
  }
  setUiOffset(px, x = 0) { this.cam.setViewOffset(1280, 720, x, px, 1280, 720); }
  // intro orbit: t 0..1
  intro(t) {
    const c = this.cfg;
    const e = easeInOut(t);
    this.yaw = (1 - e) * 2.4 * (c.introDir || 1);
    this.pitch = (c.pitch ?? 0.92) * (0.6 + 0.4 * e) + 0.15 * (1 - e);
    this.dist = c.maxDist * (1.1 - 0.1 * e) + 6 * (1 - e);
    this.target.set(c.center[0], c.center[1], c.center[2]);
    this.apply();
    this.yaw = 0; this.pitch = c.pitch ?? 0.92;
  }
}
