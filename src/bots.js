// Bot brain: GO_CROWN / HUNT / HOLD / GRAB_POWERUP, navigating the arena's nav graph with human-ish delays and aim error.
import { rand, clamp, angDiff } from './util.js';

export class Bot {
  constructor(f, skill = 0.6) {
    this.f = f; this.skill = skill;
    this.path = null; this.pi = 0; this.repath = 0; this.goalId = -1; this.think = rand(0, 0.3);
    this.mode = 'idle'; this.stuckT = 0; this.lastPos = { x: 0, z: 0 }; this.stuckCheck = 0;
    this.out = { x: 0, y: 0, jump: false, jumpHeld: false, dash: false, slam: false, taunt: false };
    this.react = 0; this.wanderId = -1; this.jumpPending = 0; this.dashDelay = 0; this.slamDelay = 0;
    this.jumpTarget = null; this.escape = null;
  }
  reset() { this.path = null; this.jumpTarget = null; this.escape = null; this.think = 0; this.fleeP = null; this.wanderId = -1; }

  update(dt, round) {
    const f = this.f, o = this.out, nav = round.arena.nav;
    o.jump = o.dash = o.slam = o.taunt = false;
    if (f.dead || f.stun > 0) { o.x = o.y = 0; return o; }
    this.think -= dt; this.repath -= dt; this.dashDelay -= dt; this.slamDelay -= dt;
    const crown = round.crown;
    const wearer = crown.holder && crown.holder !== f ? crown.holder : null;
    // ---- decide mode + goal position
    let goal = null;
    if (f.hasCrown) this.mode = 'hold';
    else if (wearer) this.mode = 'hunt';
    else if (crown.state === 'dais' || crown.state === 'loose' || crown.state === 'landed') this.mode = 'crown';
    else this.mode = 'wander';
    const pu = round.powerups.items.find((i) => i.active && Math.hypot(i.pos.x - f.pos.x, i.pos.z - f.pos.z) < 11);
    if (this.mode !== 'hold' && pu && (this.mode === 'wander' || (this.mode === 'hunt' && Math.hypot(pu.pos.x - f.pos.x, pu.pos.z - f.pos.z) < 6) || (this.mode === 'crown' && Math.hypot(crown.pos.x - f.pos.x, crown.pos.z - f.pos.z) > 12))) { this.mode = 'power'; goal = pu.pos; }
    if (this.mode === 'crown') goal = crown.pos;
    if (this.mode === 'hunt') goal = wearer.pos;
    if (this.mode === 'hold') goal = this.fleeGoal(round, nav);
    if (this.unreach && round.time > this.unreach) this.unreach = 0;
    if (this.mode === 'wander' || (this.unreach && this.mode !== 'hold')) goal = this.wanderGoal(round, nav);
    // ---- hazards: leave any spot the arena says is about to hurt
    const A = round.arena;
    if (f.grounded && A.dangerAt && A.dangerAt(f.pos.x, f.pos.z, f.pos.y)) {
      if (!this.escape || round.time > this.escape.until) {
        let best = -1, bd = 1e9;
        for (let r = 1; r < 9 && best < 0; r++) for (let q = 0; q < 16; q++) {
          const a = (q / 16) * 6.283, x = f.pos.x + Math.cos(a) * r * 1.25, z = f.pos.z + Math.sin(a) * r * 1.25;
          const id = nav.nearest(x, z, f.pos.y); const p = nav.pos(id);
          if (!A.dangerAt(p.x, p.z, p.y) && Math.abs(p.y - f.pos.y) < 2.5) { const d = (p.x - f.pos.x) ** 2 + (p.z - f.pos.z) ** 2; if (d < bd) { bd = d; best = id; } }
        }
        if (best >= 0) { const p = nav.pos(best); this.escape = { x: p.x, y: p.y, z: p.z, until: round.time + 1.0 }; this.path = null; this.think = 0; }
      }
    }
    if (this.escape && round.time > this.escape.until) this.escape = null;
    if (this.escape) goal = this.escape;
    if (!goal) { o.x = o.y = 0; return o; }

    // ---- path
    if (this.think <= 0 || !this.path) {
      this.think = this.mode === 'hold' ? 0.5 : rand(0.25, 0.45);
      const g2 = nav.nearest(goal.x, goal.z, goal.y);
      const here = nav.nearest(f.pos.x, f.pos.z, f.pos.y);
      if (f.grounded && (g2 !== this.goalId || this.repath <= 0 || !this.path)) {
        this.path = nav.path(here, g2); this.pi = this.path && this.path.length > 1 ? 1 : 0; this.goalId = g2; this.repath = 1.2;
        if (!this.path && here !== g2) { this.unreach = round.time + 1.2; this.wanderId = -1; }
      }
    }
    // ---- follow
    let tx = goal.x, tz = goal.z, jumpNow = false;
    const px = f.pos.x, pz = f.pos.z;
    if (this.path && this.path.length > 1) {
      while (this.pi < this.path.length - 1) {
        const p = nav.pos(this.path[this.pi]);
        if (Math.hypot(p.x - px, p.z - pz) < 0.9 && Math.abs(p.y - f.pos.y) < 1.2) this.pi++; else break;
      }
      const cur = nav.pos(this.path[Math.min(this.pi, this.path.length - 1)]);
      tx = cur.x; tz = cur.z;
      const prev = this.path[Math.max(0, this.pi - 1)], tgt = this.path[this.pi];
      // jump when the segment we are about to walk is a jump edge and we are near its start
      if (f.grounded && nav.isJump(prev, tgt)) {
        const sp = nav.pos(prev); const toLand = Math.hypot(cur.x - px, cur.z - pz);
        const dh = cur.y - f.pos.y;
        if (Math.hypot(sp.x - px, sp.z - pz) < 1.25) { if (this.jumpPending <= 0) { jumpNow = true; this.jumpPending = 0.35; this.jumpTarget = cur; this.jumpT = round.time; } }
      }
    }
    this.jumpPending -= dt;
    // direct approach when close to a live target on the same level
    if ((this.mode === 'hunt' || this.mode === 'crown' || this.mode === 'power') && Math.hypot(goal.x - px, goal.z - pz) < 4 && Math.abs(goal.y - f.pos.y) < 1.5 && f.grounded) {
      const gnd = round.world.ground(px + Math.sign(goal.x - px) * 0.8, pz + Math.sign(goal.z - pz) * 0.8, f.pos.y + 0.5, 0);
      if (gnd) { tx = goal.x; tz = goal.z; }
    }
    if (f.grounded && !jumpNow && this.jumpTarget && round.time - this.jumpT > 0.3) this.jumpTarget = null;
    if (!f.grounded) {
      let at = this.jumpTarget && round.time - this.jumpT < 2.2 ? this.jumpTarget : null;
      if (!at) { const n = nav.nearest(px, pz, f.pos.y); at = nav.pos(n); }
      tx = at.x; tz = at.z;
    }
    let dx = tx - px, dz = tz - pz; const d = Math.hypot(dx, dz) || 1;
    o.x = dx / d; o.y = dz / d;
    if (d < 0.35) { o.x = o.y = 0; }
    // never walk off a ledge by accident (a tile may have crumbled since the path was planned)
    if (f.grounded && !jumpNow && (o.x || o.y)) {
      const ahead = round.world.ground(px + o.x * 1.0, pz + o.y * 1.0, f.pos.y + 0.6, 0.12);
      if (!ahead || ahead.y < f.pos.y - 3.2) { if (!this.path || !nav.isJump(this.path[Math.max(0, this.pi - 1)], this.path[Math.min(this.pi, this.path.length - 1)])) { o.x = o.y = 0; this.path = null; this.think = Math.min(this.think, 0.1); } }
    }
    // aim error
    const err = (1 - this.skill) * 0.35; const ca = Math.cos(rand(-err, err)), sa = Math.sin(rand(-err, err));
    const ox = o.x; o.x = ox * ca - o.y * sa; o.y = ox * sa + o.y * ca;
    // ---- air steering / double jump
    if (!f.grounded) {
      if (this.jumpTarget) {
        const cur = this.jumpTarget;
        if (f.airJumps > 0 && f.vel.y < 0.5 && cur.y > f.pos.y - 0.2 && Math.hypot(cur.x - px, cur.z - pz) > 1.4 && f.pos.y < cur.y + 0.6) o.jump = true;
        else if (f.airJumps > 0 && f.vel.y < -3 && f.pos.y < cur.y - 0.5 && Math.hypot(cur.x - px, cur.z - pz) > 1.0) o.jump = true;
      }
      o.jumpHeld = true;
    }
    if (jumpNow) { o.jump = true; o.jumpHeld = true; } else if (f.grounded) o.jumpHeld = false;

    // ---- combat
    if (wearer && !f.hasCrown) {
      const wx = wearer.pos.x - px, wz = wearer.pos.z - pz, wd = Math.hypot(wx, wz), wy = wearer.pos.y - f.pos.y;
      const facing = Math.cos(angDiff(f.yaw, Math.atan2(wx, wz)));
      if (f.dashCd <= 0 && wd < 5 && wd > 1.2 && facing > 0.6 && Math.abs(wy) < 1.5 && this.dashDelay <= 0 && Math.random() < 0.08 + this.skill * 0.1) {
        o.dash = true; this.dashDelay = rand(0.3, 0.9) * (1.4 - this.skill);
        o.x = wx / wd; o.y = wz / wd;
      }
      if (!f.grounded && wy < -1.5 && wd < 1.8 && this.slamDelay <= 0 && Math.random() < 0.25) { o.slam = true; this.slamDelay = 0.6; }
      if (f.grounded && wd < 1.5 && Math.abs(wy) < 1 && f.shoveCd <= 0 && Math.random() < 0.06) o.slam = true;
      // jump above them to set up a slam
      if (f.grounded && wd < 3 && wd > 1.5 && wy < 0.5 && Math.random() < 0.01 * this.skill) { o.jump = true; o.jumpHeld = true; }
    } else if (!f.hasCrown) {
      // opportunistic swipes at anyone nearby
      for (const e of round.fighters) {
        if (e === f || e.dead) continue;
        const wd = Math.hypot(e.pos.x - px, e.pos.z - pz);
        if (wd < 1.3 && Math.abs(e.pos.y - f.pos.y) < 1 && f.grounded && f.shoveCd <= 0 && Math.random() < 0.02) o.slam = true;
      }
    }
    if (f.hasCrown) {
      for (const e of round.fighters) {
        if (e === f || e.dead) continue;
        const wd = Math.hypot(e.pos.x - px, e.pos.z - pz);
        if (wd < 2.2 && f.dashCd <= 0 && this.dashDelay <= 0 && Math.random() < 0.05) { o.dash = true; this.dashDelay = 1; o.x = (px - e.pos.x) / (wd || 1); o.y = (pz - e.pos.z) / (wd || 1); }
        if (wd < 2.0 && f.grounded && f.shoveCd <= 0 && Math.random() < 0.03) o.slam = true;
      }
    }
    // keep a dash from carrying us over an edge
    if (o.dash) {
      const ex = px + o.x * 5.5, ez = pz + o.y * 5.5;
      if (!round.world.ground(ex, ez, f.pos.y + 3, 0.2)) o.dash = false;
    }
    // idle flair
    if (this.mode === 'wander' && f.grounded && Math.random() < 0.002) o.taunt = true;
    // ---- stuck detection
    this.stuckCheck += dt;
    if (this.stuckCheck > 1.4) {
      const moved = Math.hypot(px - this.lastPos.x, pz - this.lastPos.z);
      if (moved < 0.6 && (o.x || o.y) && f.grounded) { this.path = null; this.wanderId = -1; this.think = 0; o.jump = true; o.jumpHeld = true; }
      this.lastPos = { x: px, z: pz }; this.stuckCheck = 0;
    }
    return o;
  }

  wanderGoal(round, nav) {
    const f = this.f;
    if (this.wanderId < 0 || Math.hypot(nav.pos(this.wanderId).x - f.pos.x, nav.pos(this.wanderId).z - f.pos.z) < 1.5) this.wanderId = nav.random();
    return nav.pos(this.wanderId);
  }

  // run away from threats while staying on solid ground
  fleeGoal(round, nav) {
    const f = this.f;
    if (this.fleeT === undefined || round.time > this.fleeT || !this.fleeP) {
      this.fleeT = round.time + 0.9;
      let best = null, bs = -1e9;
      for (let i = 0; i < 18; i++) {
        const id = nav.random(); const p = nav.pos(id);
        const dh = p.y - f.pos.y; if (dh > 2.4 || nav.edgeCell[id]) continue;
        const dist = Math.hypot(p.x - f.pos.x, p.z - f.pos.z);
        if (dist > 14 || dist < 2) continue;
        let threat = 1e9;
        for (const e of round.fighters) { if (e === f || e.dead) continue; threat = Math.min(threat, Math.hypot(p.x - e.pos.x, p.z - e.pos.z)); }
        const s = Math.min(threat, 16) * 1.0 - dist * 0.25 - Math.max(0, dh) * 1.5;
        if (s > bs) { bs = s; best = p; }
      }
      this.fleeP = best || nav.pos(nav.random());
    }
    return this.fleeP;
  }
}
