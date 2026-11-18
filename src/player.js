// A fighter: one competitor (human pad or bot brain) with movement, dash, slam, shove, power-ups and crown state.
import * as THREE from 'three';
import { clamp, damp, angDiff, rand, TAU } from './util.js';
import { audio } from './audio.js';

export const TUNE = {
  gravity: 26, jump: 10, djump: 9, run: 7, accel: 45, airAccel: 20, decel: 60,
  dashDist: 7, dashT: 0.22, dashCd: 1.0, dashCdCrown: 1.6, slamSpeed: 28, slamRadius: 2.6,
  radius: 0.35, height: 1.6, ringOut: -12,
};

export const POWERS = {
  speed: { name: 'SPEED', color: 0x37e6ff, css: '#37e6ff', dur: 6 },
  shield: { name: 'SHIELD', color: 0x4d8bff, css: '#4d8bff', dur: 10 },
  mega: { name: 'MEGA', color: 0xff4d4d, css: '#ff4d4d', dur: 7 },
  feather: { name: 'FEATHER', color: 0xf4f4ff, css: '#c9d2ff', dur: 7 },
};

export class Fighter {
  constructor(slot, def, actor) {
    this.slot = slot;                 // 0..3 colour slot (P1..P4)
    this.def = def;                   // {charId, name, title, color(css), padIndex|null, bot}
    this.name = def.name;
    this.actor = actor;
    this.isBot = !!def.bot;
    this.brain = null;
    this.pos = new THREE.Vector3(); this.vel = new THREE.Vector3();
    this.radius = TUNE.radius; this.height = TUNE.height;
    this.grounded = false; this.groundC = null; this.landed = 0;
    this.yaw = 0; this.scale = 1;
    this.reset();
  }
  reset() {
    this.vel.set(0, 0, 0);
    this.coyote = 0; this.jumpBuf = 0; this.airJumps = 1; this.usedDouble = false;
    this.dashT = 0; this.dashCd = 0; this.dashAir = false; this.dashDir = new THREE.Vector3(0, 0, 1);
    this.slam = false; this.slamCd = 0; this.lockT = 0; this.shoveT = 0; this.shoveCd = 0; this.shoveHit = false;
    this.stun = 0; this.invuln = 0; this.dead = false; this.respawnT = 0; this.tauntT = 0;
    this.power = null; this.powerT = 0; this.shield = false; this.mega = false;
    this.hasCrown = false; this.noGrab = 0;
    this.score = 0; this.rawTime = 0;
    this.lastHitT = -9; this.lastAttacker = null; this.lastAttackT = -9;
    this.stats = { kos: 0, steals: 0, outs: 0, hits: 0 };
    this.t = 0; this.moveSpeed = 0; this.moveDir = new THREE.Vector3(0, 0, 1);
    this.setScale(1);
  }
  setScale(s) { this.scale = s; this.radius = TUNE.radius * s; this.height = TUNE.height * s; }
  get alive() { return !this.dead; }
  get color() { return this.def.color; }

  place(x, y, z, yaw = 0) { this.pos.set(x, y, z); this.vel.set(0, 0, 0); this.yaw = yaw; this.grounded = false; }

  givePower(type, round) {
    this.clearPower();
    this.power = type; this.powerT = POWERS[type].dur;
    if (type === 'shield') this.shield = true;
    if (type === 'mega') { this.mega = true; this.setScale(1.45); }
    if (type === 'feather') this.airJumps = Math.max(this.airJumps, 2);
    audio.sfx(type === 'shield' ? 'shield-on' : 'power');
    round.fx.ring(this.pos, POWERS[type].color, 2.6, 0.5);
    round.fx.burst(this.pos.clone().setY(this.pos.y + 0.8), 16, { color: POWERS[type].color, speed: 4, up: 4, size: 0.3, shape: 2, add: 1, life: 0.7 });
  }
  clearPower() { this.power = null; this.powerT = 0; this.shield = false; if (this.mega) { this.mega = false; this.setScale(1); } }

  // damage / knockback. h: {dx,dz,force,up,stun,attacker,kind}. returns true when it landed.
  takeHit(h, round) {
    if (this.dead || this.invuln > 0) return false;
    if (this.shield) {
      this.shield = false; if (this.power === 'shield') { this.power = null; this.powerT = 0; }
      audio.sfx('shield'); round.fx.ring(this.pos, 0x4d8bff, 2.4, 0.4); round.fx.burst(this.pos.clone().setY(this.pos.y + 0.9), 14, { color: 0x8fb4ff, speed: 6, up: 2, size: 0.3, shape: 2, add: 1 });
      round.fx.freeze(0.04); round.fx.shake(0.25);
      round.popup(this.pos, 'BLOCKED!', '#8fb4ff');
      return false;
    }
    let force = h.force;
    if (round.time - this.lastHitT < 1.5) force *= 1.3;
    if (h.attacker && h.attacker.mega) force *= 1.6;
    if (this.mega) force *= 0.5;
    this.lastHitT = round.time;
    const d = Math.hypot(h.dx, h.dz) || 1;
    this.vel.x = (h.dx / d) * force; this.vel.z = (h.dz / d) * force; this.vel.y = h.up * (this.mega ? 0.7 : 1);
    this.grounded = false; this.groundC = null; this.coyote = 0;
    this.stun = h.stun * (this.mega ? 0.7 : 1);
    this.dashT = 0; this.slam = false; this.shoveT = 0; this.tauntT = 0; this.lockT = 0;
    this.lastAttacker = h.attacker || null; this.lastAttackT = round.time;
    if (h.attacker) { h.attacker.stats.hits++; }
    this.actor.flash('surprised', 1, 0.6);
    round.fx.hit(this.pos.clone().setY(this.pos.y + 1));
    round.fx.freeze(h.kind === 'slam' ? 0.09 : 0.06); round.fx.shake(h.kind === 'slam' ? 0.6 : 0.4);
    audio.sfx('hit', { pitch: rand(0.9, 1.15) });
    if (h.kind !== 'hazard') round.popup(this.pos, ['BONK!', 'POW!', 'WHAM!', 'OOF!'][(Math.random() * 4) | 0], '#ffe066');
    if (this.hasCrown) round.crown.drop(this, h.dx / d, h.dz / d, h.attacker);
    return true;
  }

  die(round, kind = 'out') {
    if (this.dead) return;
    this.dead = true; this.respawnT = 1.5; this.stats.outs++;
    (round.outLog = round.outLog || []).push({ who: this.name, leave: this.leave, hit: round.time - this.lastAttackT < 3, at: [+this.pos.x.toFixed(1), +this.pos.z.toFixed(1)], t: +round.time.toFixed(1) });
    if (this.hasCrown) round.crown.lose(this);
    this.clearPower();
    this.actor.root.visible = false;
    round.fx.dust(this.pos.clone().setY(Math.max(this.pos.y, round.arena.ringY + 6)), 14, 1.6);
    round.fx.burst(new THREE.Vector3(this.pos.x, round.arena.ringY + 5, this.pos.z), 20, { color: 0xffffff, speed: 6, up: 5, size: 0.35, shape: 2, add: 1 });
    audio.sfx('ringout');
    round.popup(new THREE.Vector3(this.pos.x, round.arena.ringY + 4, this.pos.z), 'RING OUT!', this.color);
    round.onOut(this);
  }

  respawn(round) {
    this.dead = false;
    const sp = round.pickSpawn(this);
    this.pos.set(sp.x, sp.y + 9, sp.z); this.vel.set(0, 0, 0);
    this.stun = 0; this.invuln = 2.0; this.dashT = 0; this.slam = false;
    this.actor.root.visible = true;
    this.yaw = Math.atan2(-sp.x, -sp.z);
    this.airJumps = 1;
    if (this.brain) this.brain.reset();
    round.fx.ring(new THREE.Vector3(sp.x, sp.y, sp.z), this.def.hex ?? 0xffffff, 2.2, 0.7);
  }

  // input: {x,y (stick), jump, jumpHeld, dash, slam, taunt}
  update(dt, input, round) {
    this.t += dt;
    const A = round.arena, T = TUNE;
    if (this.dead) {
      this.respawnT -= dt;
      if (this.respawnT <= 0 && round.canRespawn()) this.respawn(round);
      return;
    }
    // power-up clock
    if (this.power) { this.powerT -= dt; if (this.powerT <= 0) this.clearPower(); }
    this.invuln = Math.max(0, this.invuln - dt);
    this.noGrab = Math.max(0, this.noGrab - dt);
    this.dashCd = Math.max(0, this.dashCd - dt * (this.power === 'speed' ? 2 : 1));
    this.slamCd = Math.max(0, this.slamCd - dt); this.shoveCd = Math.max(0, this.shoveCd - dt);
    // carried by the platform we stand on
    if (this.groundC && (this.groundC.dx || this.groundC.dz || this.groundC.dy)) { this.pos.x += this.groundC.dx; this.pos.z += this.groundC.dz; this.pos.y += this.groundC.dy; }

    const inp = input || {};
    const stunned = this.stun > 0;
    if (stunned) this.stun -= dt;
    let ix = inp.x || 0, iz = inp.y || 0;
    const mag = Math.hypot(ix, iz);
    const canAct = !stunned && this.lockT <= 0;
    this.lockT = Math.max(0, this.lockT - dt);

    // ---- buffers
    if (inp.jump) this.jumpBuf = 0.12; else this.jumpBuf = Math.max(0, this.jumpBuf - dt);
    if (this.grounded) { this.coyote = 0.1; this.airJumps = this.power === 'feather' ? 2 : 1; this.usedDouble = false; this.dashAir = false; }
    else this.coyote = Math.max(0, this.coyote - dt);

    if (canAct && inp.taunt && this.grounded && this.dashT <= 0 && this.shoveT <= 0 && !this.slam) { if (this.tauntT <= 0) { audio.sfx('taunt'); } this.tauntT = 1.3; }
    if (this.tauntT > 0) { this.tauntT -= dt; if (mag > 0.4 || inp.jump || stunned) this.tauntT = 0; }

    // ---- jump
    if (canAct && this.jumpBuf > 0 && !this.slam && this.dashT <= 0) {
      if (this.coyote > 0) {
        this.vel.y = T.jump; this.jumpBuf = 0; this.coyote = 0; this.grounded = false; this.groundC = null; this.tauntT = 0;
        audio.sfx('jump'); round.fx.dust(this.pos, 5, 0.8);
      } else if (this.airJumps > 0) {
        this.vel.y = T.djump; this.airJumps--; this.jumpBuf = 0; this.usedDouble = true; this.tauntT = 0;
        audio.sfx('djump'); round.fx.ring(this.pos.clone().setY(this.pos.y + 0.1), 0xffffff, 1.3, 0.3, 0.2, 0.6);
        round.fx.burst(this.pos, 6, { color: 0xffffff, speed: 2, up: 0, size: 0.3, life: 0.4, grav: 0, add: 0.5 });
        this.actor.play('NinjaJump_Start', { speed: 2.6, fade: 0.06 });
      }
    }
    if (!inp.jumpHeld && this.vel.y > 4.5 && !this.slam && !stunned && this.dashT <= 0) this.vel.y -= 55 * dt;   // variable jump height

    // ---- dash
    if (canAct && inp.dash && this.dashCd <= 0 && this.dashT <= 0 && !this.slam && this.shoveT <= 0 && (this.grounded || !this.dashAir)) {
      if (mag > 0.3) this.dashDir.set(ix / mag, 0, iz / mag); else this.dashDir.set(Math.sin(this.yaw), 0, Math.cos(this.yaw));
      this.dashT = T.dashT; this.dashCd = this.hasCrown ? T.dashCdCrown : T.dashCd; this.dashAir = !this.grounded; this.tauntT = 0;
      this.yaw = Math.atan2(this.dashDir.x, this.dashDir.z); this.dashHit = false;
      audio.sfx('dash'); round.fx.dust(this.pos, 6, 1);
    }
    // ---- slam / shove
    if (canAct && inp.slam && this.dashT <= 0) {
      if (!this.grounded && !this.slam && this.slamCd <= 0 && this.pos.y - (round.groundY(this) ?? -99) > 0.9) {
        this.slam = true; this.vel.y = -T.slamSpeed; this.vel.x *= 0.2; this.vel.z *= 0.2; this.tauntT = 0; audio.sfx('dive');
      } else if (this.grounded && this.shoveCd <= 0 && this.shoveT <= 0) {
        this.shoveT = 0.34; this.shoveCd = 0.55; this.shoveHit = false; this.tauntT = 0;
        this.actor.play('Punch_Cross', { speed: 2.4, fade: 0.05 }); audio.sfx('shove');
      }
    }

    // ---- horizontal control
    const sp = T.run * (this.hasCrown ? 0.92 : 1) * (this.power === 'speed' ? 1.5 : 1) * (this.mega ? 0.95 : 1);
    if (this.dashT > 0) {
      this.dashT -= dt;
      const ds = (T.dashDist / T.dashT) * (this.power === 'speed' ? 1.1 : 1) * (this.mega ? 0.9 : 1);
      this.vel.x = this.dashDir.x * ds; this.vel.z = this.dashDir.z * ds; this.vel.y = Math.max(this.vel.y, 0) * 0.0 + (this.grounded ? 0 : Math.max(this.vel.y, -1));
      if (this.dashT <= 0) { this.vel.x *= 0.3; this.vel.z *= 0.3; }
      if (Math.random() < 0.7) round.fx.emit({ x: this.pos.x, y: this.pos.y + 0.8, z: this.pos.z, color: 0xffffff, size: 0.5, life: 0.25, shape: 0, add: 0.7, a: 0.5, grow: -0.5 });
      this.doDashHit(round);
    } else if (!this.slam && canAct) {
      const acc = (this.grounded ? T.accel : T.airAccel) * (this.shoveT > 0 ? 0.4 : 1);
      const wv = A.wind && A.wind.on ? A.wind : null;
      const tx = (this.tauntT > 0 ? 0 : ix * sp) + (wv ? wv.x * 6 : 0), tz = (this.tauntT > 0 ? 0 : iz * sp) + (wv ? wv.z * 6 : 0);
      let dx = tx - this.vel.x, dz = tz - this.vel.z; const dl = Math.hypot(dx, dz);
      const rate = (mag < 0.05 && this.grounded && !wv ? T.decel : acc) * dt;
      if (dl > rate) { dx = (dx / dl) * rate; dz = (dz / dl) * rate; }
      this.vel.x += dx; this.vel.z += dz;
      if (mag > 0.25 && this.shoveT <= 0) { const ty = Math.atan2(ix, iz); this.yaw += angDiff(this.yaw, ty) * (1 - Math.exp(-16 * dt)); }
    } else if (this.slam) {
      this.vel.x = damp(this.vel.x, ix * 2.5, 6, dt); this.vel.z = damp(this.vel.z, iz * 2.5, 6, dt);
    } else if (stunned) {
      const k = this.grounded ? 3.5 : 0.3; this.vel.x = damp(this.vel.x, 0, k, dt); this.vel.z = damp(this.vel.z, 0, k, dt);
    } else { // landing lock
      this.vel.x = damp(this.vel.x, 0, 14, dt); this.vel.z = damp(this.vel.z, 0, 14, dt);
    }
    if (this.shoveT > 0) { this.shoveT -= dt; if (!this.shoveHit && this.shoveT < 0.24) { this.shoveHit = true; this.doShove(round); } }

    // ---- gravity
    if (this.dashT <= 0) {
      const g = T.gravity * A.gravity * (this.power === 'feather' ? 0.5 : 1);
      if (this.slam) this.vel.y = -T.slamSpeed; else this.vel.y = Math.max(-38, this.vel.y - g * dt);
    }

    // ---- physics
    const wasGrounded = this.grounded;
    round.world.step(this, dt);
    if (this.landed > 0) this.onLand(round, wasGrounded);
    if (this.hitWall && this.dashT > 0) { this.dashT = 0; this.vel.x *= 0.2; this.vel.z *= 0.2; round.fx.dust(this.pos, 6, 1); }
    // soft push apart
    for (const o of round.fighters) {
      if (o === this || o.dead) continue;
      const dx = this.pos.x - o.pos.x, dz = this.pos.z - o.pos.z, r = this.radius + o.radius;
      const d2 = dx * dx + dz * dz;
      if (d2 < r * r && d2 > 1e-6 && Math.abs(this.pos.y - o.pos.y) < 1.4 && this.dashT <= 0 && o.dashT <= 0) {
        const d = Math.sqrt(d2), push = (r - d) * 0.5;
        this.pos.x += (dx / d) * push; this.pos.z += (dz / d) * push;
      }
    }
    // ring out
    if (this.pos.y < A.ringY && !this.dead) this.die(round);
    if (wasGrounded && !this.grounded) this.leave = { x: this.pos.x, y: this.pos.y, z: this.pos.z, vy: this.vel.y, stun: this.stun > 0, dash: this.dashT > 0, mode: this.brain ? this.brain.mode : 'human', t: round.time };
    this.moveSpeed = Math.hypot(this.vel.x, this.vel.z);
    if (this.moveSpeed > 0.5) this.moveDir.set(this.vel.x, 0, this.vel.z).normalize();
  }

  onLand(round, wasGrounded) {
    const impact = this.landed;
    if (this.slam) {
      this.slam = false; this.slamCd = 0.45; this.lockT = 0.28;
      round.slamImpact(this);
      this.actor.play('Jump_Land', { speed: 2.2, fade: 0.05 });
    } else if (impact > 7) {
      audio.sfx('land'); round.fx.dust(this.pos, 6, 0.9);
      this.actor.play('Jump_Land', { speed: 3.2, fade: 0.05 });
    }
  }

  doDashHit(round) {
    if (this.dashHit) return;
    for (const o of round.fighters) {
      if (o === this || o.dead || o.invuln > 0) continue;
      const dx = o.pos.x - this.pos.x, dz = o.pos.z - this.pos.z, dy = o.pos.y - this.pos.y;
      const rr = (this.radius + o.radius) + 0.45;
      if (dx * dx + dz * dz < rr * rr && dy > -1.4 && dy < 1.5) {
        this.dashHit = true;
        const ok = o.takeHit({ dx: this.dashDir.x * 0.85 + (dx * 0.15), dz: this.dashDir.z * 0.85 + dz * 0.15, force: 12.5, up: 6.5, stun: 0.6, attacker: this, kind: 'dash' }, round);
        this.dashT = 0; this.vel.x *= ok ? 0.25 : -0.3; this.vel.z *= ok ? 0.25 : -0.3;
        if (ok) round.onHit(this, o);
        break;
      }
    }
  }

  doShove(round) {
    const fx = Math.sin(this.yaw), fz = Math.cos(this.yaw);
    for (const o of round.fighters) {
      if (o === this || o.dead || o.invuln > 0) continue;
      const dx = o.pos.x - this.pos.x, dz = o.pos.z - this.pos.z; const d = Math.hypot(dx, dz);
      if (d > 1.6 * this.scale + o.radius * 0.5 || Math.abs(o.pos.y - this.pos.y) > 1.4) continue;
      if (d > 0.2 && (dx * fx + dz * fz) / d < 0.3) continue;
      const ok = o.takeHit({ dx: fx, dz: fz, force: 7, up: 3.5, stun: 0.4, attacker: this, kind: 'shove' }, round);
      if (ok) round.onHit(this, o);
    }
  }

  // visuals
  syncActor(dt, round) {
    const a = this.actor;
    if (this.dead) return;
    a.root.position.copy(this.pos);
    a.root.rotation.y = this.yaw;
    a.root.scale.setScalar(this.scale);
    let mode = 'normal';
    if (this.stun > 0) mode = 'stun';
    else if (this.dashT > 0) mode = 'dash';
    else if (this.slam) mode = 'slam';
    else if (this.tauntT > 0) mode = 'taunt';
    else if (!this.grounded && this.vel.y < -15) mode = 'out';
    // flicker when invulnerable
    a.root.visible = !(this.invuln > 0 && Math.floor(this.t * 14) % 2 === 0);
    a.update(dt, { speed: this.moveSpeed, grounded: this.grounded || this.coyote > 0.05 && this.vel.y <= 0.1, vy: this.vel.y, mode, hasCrown: this.hasCrown, doubleJump: this.usedDouble });
  }
}
