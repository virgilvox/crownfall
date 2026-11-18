// One VRM avatar: baked Quaternius clips blended by weight (locomotion / air / action overlays) plus expressions.
import * as THREE from 'three';
import { buildClips } from './anims.js';
import { clamp, damp } from './util.js';

const _v = new THREE.Vector3();
export const BODY_H = 1.6;

export class Actor {
  constructor(vrm, animData, def) {
    this.vrm = vrm;
    this.def = def;
    this.root = new THREE.Group();
    this.root.name = 'actor-' + def.id;
    this.root.add(vrm.scene);
    vrm.scene.traverse((o) => { if (o.isMesh) { o.frustumCulled = false; o.castShadow = false; o.receiveShadow = false; } });
    const h = vrm.humanoid;
    this.bone = (n) => h.getNormalizedBoneNode(n);
    vrm.scene.updateMatrixWorld(true);
    const head0 = this.bone('head').getWorldPosition(_v).y;
    const s = BODY_H / (head0 + 0.12);
    vrm.scene.scale.setScalar(s);
    vrm.scene.updateMatrixWorld(true);
    this.scale = s;
    const hipsY = this.bone('hips').getWorldPosition(_v).y;
    const footY = this.bone('leftFoot').getWorldPosition(_v).y;
    this.hipsH = (hipsY - footY) / s;
    this.clips = buildClips(vrm, animData, this.hipsH);
    this.mixer = new THREE.AnimationMixer(vrm.scene);
    this.actions = {};
    this.w = {};
    this.os = null;           // one-shot overlay {name,t,dur,fade,hold}
    this.mode = 'normal';
    this.prevGrounded = true;
    this.t = Math.random() * 10;
    this.blinkT = 2 + Math.random() * 3;
    this.expr = { happy: 0, surprised: 0, angry: 0, sad: 0 };
    this.exprT = { happy: 0, surprised: 0, angry: 0, sad: 0 };
    this.fixedBase = null;    // menus: force a looping base clip (Idle, Dance...)
    this.speed = 0;
    this.act('Idle_Loop');
    this.update(0.016, { speed: 0, grounded: true, vy: 0 });
  }

  act(name) {
    if (!this.actions[name]) {
      const clip = this.clips[name];
      if (!clip) { console.warn('no clip', name); return null; }
      const a = this.mixer.clipAction(clip);
      a.play(); a.setEffectiveWeight(0);
      a.time = Math.random() * clip.duration;
      this.actions[name] = a; this.w[name] = 0;
    }
    return this.actions[name];
  }

  // layered one-shot; hold keeps the last pose until release()
  play(name, { fade = 0.12, speed = 1, hold = false, start = 0 } = {}) {
    const a = this.act(name);
    if (!a) return;
    a.reset(); a.timeScale = speed; a.time = start;
    a.setLoop(hold ? THREE.LoopOnce : THREE.LoopRepeat, hold ? 1 : Infinity);
    a.clampWhenFinished = hold;
    a.play();
    this.os = { name, t: 0, dur: a.getClip().duration / speed, fade, hold, free: !hold };
  }
  release() { if (this.os && this.os.hold) { this.os.hold = false; this.os.t = Math.max(this.os.t, this.os.dur - this.os.fade); } }
  cancelOneShot() { this.os = null; }

  setExpr(name, v) { this.exprT[name] = v; }
  flash(name, v = 1, dur = 0.6) { this.exprT[name] = v; this.flashT = { name, t: dur }; }

  // s: {speed, grounded, vy, mode:'normal'|'dash'|'slam'|'stun'|'taunt'|'out'|'spawn'|'shove', hasCrown}
  update(dt, s) {
    this.t += dt;
    const mode = s.mode || 'normal';
    const fb = this.fixedBase;
    const tw = {};
    const sp = s.speed || 0;
    if (fb) { this.act(fb); tw[fb] = 1; }
    else if (mode === 'out') tw.NinjaJump_Idle_Loop = 1;
    else if (mode === 'taunt') tw.Dance_Loop = 1;
    else if (mode === 'dash') tw.Shield_Dash = 1;
    else if (mode === 'slam') tw.Roll = 1;
    else if (mode === 'stun') tw.Hit_Knockback = 1;
    else if (!s.grounded) { tw[s.doubleJump ? 'NinjaJump_Idle_Loop' : 'Jump_Loop'] = 1; }
    else {
      const jogW = clamp((sp - 0.4) / 1.2, 0, 1) * (1 - clamp((sp - 4.2) / 1.6, 0, 1));
      const sprW = clamp((sp - 4.2) / 1.6, 0, 1);
      tw.Idle_Loop = 1 - clamp(sp / 0.8, 0, 1);
      tw.Jog_Fwd_Loop = jogW; tw.Sprint_Loop = sprW;
      const a = this.act('Jog_Fwd_Loop'); a.timeScale = clamp(sp / (this.clips.Jog_Fwd_Loop.userData.speed * this.scale), 0.6, 1.8);
      const b = this.act('Sprint_Loop'); b.timeScale = clamp(sp / (this.clips.Sprint_Loop.userData.speed * this.scale), 0.8, 2.1);
      this.act('Idle_Loop');
    }
    if (mode === 'dash') { const a = this.act('Shield_Dash'); if (this.mode !== 'dash') { a.reset(); a.time = 0.1; a.timeScale = 1.6; a.play(); } }
    if (mode === 'slam' && this.mode !== 'slam') { const a = this.act('Roll'); a.reset(); a.time = 0.15; a.timeScale = 0.7; a.play(); }
    if (mode === 'stun' && this.mode !== 'stun') { const a = this.act('Hit_Knockback'); a.reset(); a.timeScale = 1.6; a.setLoop(THREE.LoopRepeat, Infinity); a.play(); }
    if (mode === 'stun') { const a = this.act('Hit_Knockback'); if (a.time >= 0.24) { a.time = 0.24; a.paused = true; } }
    if (mode === 'taunt' && this.mode !== 'taunt') { const a = this.act('Dance_Loop'); a.timeScale = 1.2; }
    
    for (const k in this.actions) if (this.actions[k].isRunning() === false && tw[k]) this.actions[k].play();
    // one-shot overlay
    let osW = 0;
    if (this.os) {
      const os = this.os;
      os.t += dt;
      const fin = os.hold ? 1 : clamp((os.dur - os.t) / os.fade, 0, 1);
      osW = Math.min(clamp(os.t / os.fade, 0, 1), fin);
      if (!os.hold && os.t >= os.dur) { this.os = null; osW = 0; }
    }
    const rate = mode === 'normal' ? 12 : 22;
    for (const k of Object.keys(this.actions)) {
      const tgt = (tw[k] || 0) * (1 - osW) + (this.os && this.os.name === k ? osW : 0);
      this.w[k] = damp(this.w[k] || 0, tgt, rate, dt);
    }
    let sum = 0; for (const k in this.w) sum += this.w[k];
    for (const k in this.actions) this.actions[k].setEffectiveWeight(sum > 1e-4 ? this.w[k] / sum : (k === 'Idle_Loop' ? 1 : 0));
    this.mode = mode;
    this.mixer.update(dt);
    // expressions
    const em = this.vrm.expressionManager;
    if (em) {
      this.blinkT -= dt;
      let blink = 0;
      if (this.blinkT < 0) { blink = this.blinkT > -0.12 ? 1 - Math.abs(this.blinkT + 0.06) / 0.06 : 0; if (this.blinkT < -0.12) this.blinkT = 2 + Math.random() * 3; }
      if (this.flashT) { this.flashT.t -= dt; if (this.flashT.t <= 0) { this.exprT[this.flashT.name] = 0; this.flashT = null; } }
      const happyBase = (s.hasCrown || mode === 'taunt' || fb === 'Dance_Loop') ? 0.9 : 0;
      for (const k in this.expr) {
        this.expr[k] = damp(this.expr[k], k === 'happy' ? Math.max(this.exprT[k], happyBase) : this.exprT[k], 14, dt);
        em.setValue(k, this.expr[k]);
      }
      em.setValue('blink', mode === 'stun' ? 0.7 : blink);
    }
    this.vrm.update(dt);
  }

  headWorld(out = new THREE.Vector3()) { return this.bone('head').getWorldPosition(out); }

  dispose() { this.mixer.stopAllAction(); this.root.removeFromParent(); }
}
