// CROWNFALL boot + main loop. Everything is driven by requestAnimationFrame; input comes only from navigator.getGamepads().
import * as THREE from 'three';
import { Overlay, W, H, text } from './ui.js';
import { Input } from './input.js';
import { progress, parseVRM, fetchVRM, loadAnimJson } from './assets.js';
import { decodeAnimData } from './anims.js';
import { Actor } from './character.js';
import { ROSTER } from './roster.js';
import { FX } from './fx.js';
import { GameCamera } from './camera.js';
import { audio } from './audio.js';
import { seedRng } from './util.js';
import { Menus } from './menus.js';

const canvas = document.getElementById('game-canvas');
canvas.width = 1280; canvas.height = 720;

const qs = new URLSearchParams(location.search);
if (qs.get('seed')) seedRng(Number(qs.get('seed')));

const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
renderer.setPixelRatio(1); renderer.setSize(1280, 720, false);
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 1.05;
renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.setClearColor(0x05060a, 1);

const overlay = new Overlay(renderer);
const input = new Input();
const fx = new FX();
const cam = new GameCamera();

// ---- actor pool: every VRM is parsed once per instance; two seats can pick the same avatar (second instance loads on demand)
class Pool {
  constructor() { this.data = null; this.inst = new Map(); this.pending = new Set(); }
  async init() {
    this.data = decodeAnimData(await loadAnimJson());
    progress.label = 'Loading avatars';
    await Promise.all(ROSTER.map((c) => fetchVRM(c.file)));
    for (const c of ROSTER) {
      const vrm = await parseVRM(c.file);
      this.inst.set(c.id, [{ actor: new Actor(vrm, this.data, c), used: false }]);
    }
  }
  // returns an Actor (or null while a second copy is still loading)
  acquire(id) {
    const list = this.inst.get(id);
    const free = list.find((e) => !e.used);
    if (free) { free.used = true; return free.actor; }
    const key = id + list.length;
    if (!this.pending.has(key)) {
      this.pending.add(key);
      const c = ROSTER.find((r) => r.id === id);
      parseVRM(c.file).then((vrm) => { list.push({ actor: new Actor(vrm, this.data, c), used: false }); this.pending.delete(key); });
    }
    return null;
  }
  async acquireAsync(id) { for (let i = 0; i < 1200; i++) { const a = this.acquire(id); if (a) return a; await new Promise((r) => requestAnimationFrame(() => r())); } return null; }
  release(actor) { for (const list of this.inst.values()) for (const e of list) if (e.actor === actor) { e.used = false; actor.root.removeFromParent(); actor.root.visible = true; actor.root.scale.setScalar(1); actor.fixedBase = null; actor.cancelOneShot(); } }
  releaseAll() { for (const list of this.inst.values()) for (const e of list) this.release(e.actor); }
}
const pool = new Pool();

const game = {
  renderer, overlay, input, fx, cam, pool, qs,
  getPad: (index) => input.pads.get(index) || null,
  time: 0,
};

let booted = false, menus = null, bootError = null;
(async () => {
  try {
    await pool.init();
    menus = new Menus(game); window.__menus = menus;
    await menus.init();
    booted = true;
  } catch (e) { bootError = e; console.error(e); }
})();

let last = performance.now();
function frame(now) {
  requestAnimationFrame(frame);
  let dt = Math.min(0.05, (now - last) / 1000); last = now;
  if (dt <= 0) dt = 0.001;
  game.time += dt;
  const pads = input.poll(dt);
  if (input.any) audio.resume();
  const g = overlay.begin();
  if (!booted) {
    renderer.setClearColor(0x0b0a1a, 1); renderer.clear();
    drawLoading(g, game.time);
    overlay.render();
    return;
  }
  menus.update(dt, pads);
  menus.render(g, dt);
  overlay.render();
}
function drawLoading(g, t) {
  g.fillStyle = '#0b0a1a'; g.fillRect(0, 0, W, H);
  text(g, 'CROWNFALL', W / 2, 280, { size: 96, align: 'center', color: '#ffd23f', sw: 16 });
  const p = bootError ? 1 : progress.total ? progress.done / progress.total : 0;
  g.fillStyle = 'rgba(255,255,255,0.15)'; g.fillRect(W / 2 - 220, 380, 440, 18);
  g.fillStyle = bootError ? '#ff5a5a' : '#ffd23f'; g.fillRect(W / 2 - 220, 380, 440 * p, 18);
  text(g, bootError ? 'Something went wrong' : progress.label + '...', W / 2, 430, { size: 22, align: 'center', color: '#d8d4ff' });
}
requestAnimationFrame((t) => { last = t; frame(t); });
window.__game = game;
