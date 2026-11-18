// One round: fighters, crown, power-ups, hazards, scoring, phases (intro -> countdown -> play -> end).
import * as THREE from 'three';
import { Fighter, TUNE } from './player.js';
import { Crown } from './crown.js';
import { Powerups, glowTexture } from './powerups.js';
import { Bot } from './bots.js';
import { audio } from './audio.js';
import { PLAYER_HEX, PLAYER_COLORS } from './roster.js';
import { clamp, rand } from './util.js';
import { BTN } from './input.js';

export const ROUND_TIME = 90;
export const FRENZY_AT = 15;
export const PLACE_POINTS = [5, 3, 2, 1];

let blobTex = null;
function blobTexture() {
  if (blobTex) return blobTex;
  const c = document.createElement('canvas'); c.width = c.height = 64; const g = c.getContext('2d');
  const gr = g.createRadialGradient(32, 32, 2, 32, 32, 32); gr.addColorStop(0, 'rgba(0,0,0,0.75)'); gr.addColorStop(0.55, 'rgba(0,0,0,0.4)'); gr.addColorStop(1, 'rgba(0,0,0,0)');
  g.fillStyle = gr; g.fillRect(0, 0, 64, 64); blobTex = new THREE.CanvasTexture(c); return blobTex;
}
function tagTexture(label, color) {
  const c = document.createElement('canvas'); c.width = 128; c.height = 96; const g = c.getContext('2d');
  g.lineJoin = 'round';
  g.fillStyle = color; g.strokeStyle = '#12101f'; g.lineWidth = 8;
  g.beginPath(); g.moveTo(14, 8); g.lineTo(114, 8); g.quadraticCurveTo(122, 8, 122, 16); g.lineTo(122, 50); g.quadraticCurveTo(122, 58, 114, 58); g.lineTo(76, 58); g.lineTo(64, 84); g.lineTo(52, 58); g.lineTo(14, 58); g.quadraticCurveTo(6, 58, 6, 50); g.lineTo(6, 16); g.quadraticCurveTo(6, 8, 14, 8); g.closePath();
  g.stroke(); g.fill();
  g.font = '900 34px "Arial Black", Impact, sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillStyle = '#fff'; g.strokeStyle = 'rgba(0,0,0,0.5)'; g.lineWidth = 5;
  g.strokeText(label, 64, 34); g.fillText(label, 64, 34);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
}

export class Round {
  // game: {fx, cam (GameCamera), getPad(index)}, entrants: [{slot, char, actor, padIndex, bot}]
  constructor(game, arena, entrants, opts = {}) {
    this.game = game; this.fx = game.fx; this.arena = arena; this.world = arena.world; this.scene = arena.scene;
    this.opts = opts; this.attract = !!opts.attract;
    this.duration = opts.duration || ROUND_TIME;
    this.fighters = []; this.banners = []; this.popups = [];
    this.crown = new Crown(this.scene, this.fx);
    this.powerups = new Powerups(this.scene, this.fx);
    this.time = 0; this.phase = 'intro'; this.phaseT = 0; this.running = false; this.frenzy = false; this.done = false;
    this.lastCount = 4; this.timeScale = 1; this.firstCrown = false;
    this.markers = [];
    entrants.forEach((e, i) => {
      const def = { charId: e.char.id, name: e.char.name, title: e.char.title, color: PLAYER_COLORS[e.slot], charColor: e.char.color, hex: PLAYER_HEX[e.slot], padIndex: e.padIndex, bot: e.bot };
      const f = new Fighter(e.slot, def, e.actor);
      f.index = i;
      if (e.bot) f.brain = new Bot(f, e.skill ?? 0.55 + Math.random() * 0.3);
      this.fighters.push(f);
      this.scene.add(e.actor.root);
      // ring + tag
      const ring = new THREE.Mesh(new THREE.RingGeometry(0.5, 0.68, 32), new THREE.MeshBasicMaterial({ color: PLAYER_HEX[e.slot], transparent: true, opacity: 0.9, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide }));
      ring.rotation.x = -Math.PI / 2; ring.renderOrder = 5; this.scene.add(ring);
      const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: tagTexture(e.bot ? 'CPU' : 'P' + (e.slot + 1), PLAYER_COLORS[e.slot]), transparent: true, depthTest: false, depthWrite: false }));
      sprite.scale.set(1.25, 0.94, 1); sprite.renderOrder = 20; this.scene.add(sprite);
      const blob = new THREE.Mesh(new THREE.PlaneGeometry(1.5, 1.5), new THREE.MeshBasicMaterial({ map: blobTexture(), transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2 }));
      blob.rotation.x = -Math.PI / 2; blob.renderOrder = 3; this.scene.add(blob);
      this.markers.push({ ring, sprite, blob });
    });
    this.setupSpawns();
    arena.reset && arena.reset();
    if (arena.sun) arena.sun.castShadow = !game.lowQuality;
    this.game.cam.setArena(arena.cam); this.game.cam.setUiOffset(23);
    this.fx.attach(this.scene);
  }
  async init() { await this.powerups.build(); }

  setupSpawns() {
    this.fighters.forEach((f, i) => {
      const s = this.arena.spawns[i % this.arena.spawns.length];
      f.reset(); f.place(s.x, s.y, s.z, Math.atan2(this.arena.cam.center[0] - s.x, this.arena.cam.center[2] - s.z)); f.grounded = true; f.coyote = 0.1;
    });
  }
  // a spawn is usable when it is not inside a solid prop
  spawnOk(s) {
    for (const c of this.world.colliders) {
      if (!c.wall || !c.enabled || s.y + 1 < c.minY || s.y > c.maxY) continue;
      if (c.kind === 'cyl') { if (Math.hypot(s.x - c.x, s.z - c.z) < c.r + 0.9) return false; }
      else if (s.x > c.minX - 0.9 && s.x < c.maxX + 0.9 && s.z > c.minZ - 0.9 && s.z < c.maxZ + 0.9) return false;
    }
    return true;
  }
  pickSpawn(f) {
    let best = null, bs = -1;
    const list = (this.arena.safe || this.arena.spawns).filter((s) => this.spawnOk(s));
    for (const s of list.length ? list : this.arena.spawns) {
      let m = 99; for (const o of this.fighters) if (o !== f && !o.dead) m = Math.min(m, Math.hypot(o.pos.x - s.x, o.pos.z - s.z));
      const sc = m + Math.random() * 4;
      if (sc > bs) { bs = sc; best = s; }
    }
    return best;
  }
  canRespawn() { return this.phase === 'play' || this.phase === 'countdown'; }
  groundY(f) { const g = this.world.ground(f.pos.x, f.pos.z, f.pos.y + 0.4, 0.2); return g ? g.y : null; }

  banner(text, color = '#fff', dur = 1.2, who = null) {
    if (this.banners.some((b) => b.text === text && b.t < 1.5)) return;
    this.banners = [{ text, color, t: 0, dur: Math.min(dur, 1.4) }];   // one big banner at a time
  }
  popup(pos, text, color = '#fff') { this.popups.push({ pos: pos.clone().setY(pos.y + 1.9), text, color, t: 0 }); if (this.popups.length > 2) this.popups.shift(); }

  onHit(att, vic) { /* stats live on fighters */ }
  onOut(f) {
    const a = f.lastAttacker;
    if (a && this.time - f.lastAttackT < 4 && a !== f) { a.stats.kos++; this.banner(`${a.name} RINGED OUT ${f.name}`, a.color, 1.2); }
  }
  onCrown(f) {}

  slamImpact(f) {
    const r = TUNE.slamRadius * f.scale;
    this.fx.ring(f.pos, 0xffffff, r + 0.6, 0.45, 0.4, 1);
    this.fx.ring(f.pos, f.def.hex, r + 1.4, 0.65, 0.2, 0.7);
    this.fx.dust(f.pos, 18, 1.6);
    this.fx.shake(0.55); audio.sfx('slam');
    let any = false;
    for (const o of this.fighters) {
      if (o === f || o.dead) continue;
      const dx = o.pos.x - f.pos.x, dz = o.pos.z - f.pos.z, d = Math.hypot(dx, dz);
      if (d < r + o.radius && Math.abs(o.pos.y - f.pos.y) < 2.6) {
        const ok = o.takeHit({ dx: d < 0.05 ? Math.random() - 0.5 : dx, dz: d < 0.05 ? Math.random() - 0.5 : dz, force: 13.5 - d * 1.2, up: 8, stun: 0.8, attacker: f, kind: 'slam' }, this);
        any = any || ok;
      }
    }
    this.arena.onSlam && this.arena.onSlam(f, this);
    if (any) this.fx.freeze(0.08);
  }

  inputFor(f) {
    if (f.isBot) return f.brain.update(this.simDt, this);
    const pad = this.game.getPad(f.def.padIndex);
    if (!pad) return { x: 0, y: 0 };
    return { x: pad.x, y: pad.y, jump: pad.p(BTN.A), jumpHeld: pad.held[BTN.A], dash: pad.p(BTN.X), slam: pad.p(BTN.B), taunt: pad.p(BTN.Y) };
  }

  get timeLeft() { return Math.max(0, this.duration - this.time); }

  update(dt) {
    this.simDt = dt;
    this.phaseT += dt;
    const cam = this.game.cam;
    if (this.phase === 'intro') {
      cam.intro(clamp(this.phaseT / 2.6, 0, 1));
      if (this.phaseT > 2.6) { this.setPhase('countdown'); cam.frame(this.fighters.map((f) => f.pos), 0, true); }
    } else if (this.phase === 'countdown') {
      const left = 3.2 - this.phaseT; const n = Math.ceil(left - 0.2);
      if (n !== this.lastCount && n >= 1 && n <= 3) { this.lastCount = n; audio.sfx('beep'); }
      if (this.phaseT >= 3.0) { this.setPhase('play'); this.running = true; audio.sfx('go'); this.fx.shake(0.3); }
    } else if (this.phase === 'play') {
      this.time += dt;
      if (!this.firstCrown && this.time >= 1) { this.firstCrown = true; this.crown.spawnAtDais(this.arena.dais); }
      if (!this.frenzy && this.timeLeft <= FRENZY_AT) { this.frenzy = true; this.banner('CROWN FRENZY!', '#ff5a4a', 2.2); audio.sfx('frenzy'); audio.music('chase'); this.fx.shake(0.35); }
      const wearer = this.crown.holder;
      if (wearer && !wearer.dead) { wearer.rawTime += dt; wearer.score += dt * (this.frenzy ? 2 : 1); }
      if (this.timeLeft <= 0) { this.setPhase('end'); this.timeScale = 0.3; this.banner('TIME!', '#ffd23f', 2); audio.sfx('time'); }
      if (!this.attract && this.timeLeft < 10.05 && Math.floor(this.timeLeft + dt) !== Math.floor(this.timeLeft) && this.timeLeft > 0) audio.sfx('tick');
    } else if (this.phase === 'end') {
      if (this.phaseT > 0.9) this.timeScale = Math.min(1, this.timeScale + dt * 1.5);
      if (this.phaseT > 3.0) { this.done = true; }
    }

    const live = this.phase === 'play' || this.phase === 'end' || this.phase === 'countdown';
    for (const f of this.fighters) {
      const inp = this.phase === 'play' ? this.inputFor(f) : (this.phase === 'end' ? null : null);
      if (live && dt > 0) f.update(dt, inp, this);
    }
    this.arena.update(dt, this);
    this.crown.update(dt, this);
    this.powerups.update(dt, this);
    for (const f of this.fighters) {
      if (dt > 0) f.syncActor(dt, this);
    }
    // markers
    this.fighters.forEach((f, i) => {
      const m = this.markers[i];
      m.ring.visible = !f.dead; m.sprite.visible = !f.dead; m.blob.visible = !f.dead;
      if (f.dead) return;
      const g = this.world.ground(f.pos.x, f.pos.z, f.pos.y + 0.6, 0.1);
      m.ring.position.set(f.pos.x, (g ? g.y : f.pos.y) + 0.06, f.pos.z);
      const hgt = g ? Math.max(0, f.pos.y - g.y) : 4;
      m.blob.visible = !!g; m.blob.position.set(f.pos.x, (g ? g.y : 0) + 0.04, f.pos.z); m.blob.scale.setScalar(f.scale * (1.15 - Math.min(hgt, 5) * 0.08)); m.blob.material.opacity = Math.max(0.15, 0.9 - hgt * 0.12);
      m.ring.scale.setScalar(f.scale * (f.hasCrown ? 1.25 : 1) * (1 + Math.sin(f.t * 5) * (f.hasCrown ? 0.06 : 0)));
      m.ring.material.color.set(f.hasCrown ? 0xffd23f : f.def.hex);
      m.sprite.position.set(f.pos.x, f.pos.y + (f.height + 0.75 + (f.hasCrown ? 0.5 : 0)), f.pos.z);
      const ts = clamp(cam.dist * 0.032, 0.9, 1.5) * Math.sqrt(f.scale);
      m.sprite.scale.set(1.25 * ts, 0.94 * ts, 1);
    });
    for (const b of this.banners) b.t += dt;
    this.banners = this.banners.filter((b) => b.t < b.dur);
    for (const p of this.popups) p.t += dt;
    this.popups = this.popups.filter((p) => p.t < 0.7);
    // camera
    if (this.phase !== 'intro') {
      const pts = [];
      for (const f of this.fighters) if (!f.dead) pts.push(f.pos);
      if (this.crown.state !== 'hidden' && this.crown.state !== 'gone' && this.crown.state !== 'worn') pts.push(this.crown.pos);
      cam.frame(pts, dt);
    }
  }
  setPhase(p) { this.phase = p; this.phaseT = 0; }

  results() {
    const order = [...this.fighters].sort((a, b) => b.score - a.score || b.rawTime - a.rawTime);
    return order.map((f, i) => ({ fighter: f, rank: i, points: PLACE_POINTS[i] ?? 0, score: f.score, raw: f.rawTime }));
  }

  dispose() {
    for (const f of this.fighters) { f.actor.root.removeFromParent(); f.actor.root.visible = true; f.actor.root.scale.setScalar(1); }
    this.markers.forEach((m) => { m.ring.removeFromParent(); m.sprite.removeFromParent(); m.blob.removeFromParent(); });
    this.crown.group.removeFromParent();
    this.powerups.items.forEach((i) => i.g.removeFromParent());
  }
}
