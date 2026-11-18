// Title, character select, cup select, rounds, results, podium and attract mode.
import * as THREE from 'three';
import { W, H, text, rr, panel, crownIcon, measure, FONT } from './ui.js';
import { BTN } from './input.js';
import { ROSTER, PLAYER_COLORS, PLAYER_HEX } from './roster.js';
import { buildStage } from './stage.js';
import { ARENAS, loadArena } from './arenas/index.js';
import { Round, PLACE_POINTS } from './round.js';
import { drawRoundHUD, project } from './hud.js';
import { audio } from './audio.js';
import { makeCrownMesh } from './crown.js';
import { clamp, damp, easeOut, shuffle, pick, rand } from './util.js';
import { glowTexture } from './powerups.js';
import { progress } from './assets.js';

const TITLE_IDLE = Number(new URLSearchParams(location.search).get('idle')) || 25;
const STATS_KEY = 'crownfall.stats';
function loadStats() { try { return JSON.parse(localStorage.getItem(STATS_KEY)) || { wins: {}, best: 0, rounds: 0, cups: 0 }; } catch (e) { return { wins: {}, best: 0, rounds: 0, cups: 0 }; } }
function saveStats(s) { try { localStorage.setItem(STATS_KEY, JSON.stringify(s)); } catch (e) { /* storage is optional */ } }

export class Menus {
  constructor(game) {
    this.game = game; this.mode = 'title'; this.t = 0; this.modeT = 0; this.idle = 0;
    this.stats = loadStats();
    this.slots = [0, 1, 2, 3].map(() => ({ joined: false, ci: 0, ready: false, pad: null, actor: null }));
    this.cpuMode = 'fill'; this.cupSel = 0; this.round = null; this.session = null; this.attract = false;
    this.titleActors = [];
    this.nameTagSprites = [];
  }

  async init() {
    const g = this.game;
    this.stage = await buildStage();
    g.fx.setCamera(g.cam.cam, 720);
    this.menuCam = new THREE.PerspectiveCamera(40, 16 / 9, 0.5, 600);
    // preload the arenas lazily (first one in the background)
    this.enterTitle();
    const a = g.qs.get('arena');
    if (a && g.qs.get('skip')) await this.quickStart(a);
  }

  // ------------------------------------------------------------------ helpers
  setMode(m) { this.mode = m; this.modeT = 0; }
  actorsOnStage() { return this.titleActors.concat(this.slots.map((s) => s.actor).filter(Boolean)); }

  // ------------------------------------------------------------------ title
  enterTitle() {
    const g = this.game, S = this.stage;
    this.leaveRound();
    g.pool.releaseAll(); this.titleActors = []; this.slots.forEach((s) => { s.actor = null; s.joined = false; s.ready = false; });
    g.fx.attach(S.scene);
    S.pedestals.visible = false; S.podium.visible = false; S.titleCrown.visible = true;
    const anims = ['Dance_Loop', 'Idle_Loop', 'Yes', 'Idle_FoldArms_Loop', 'Dance_Loop', 'Idle_FoldArms_Loop', 'Yes', 'Idle_Loop', 'Dance_Loop'];
    ROSTER.forEach((c, i) => {
      const a = g.pool.acquire(c.id); if (!a) return;
      const x = (i - 4) * 2.15;
      a.root.position.set(x, 0, -2.2 + Math.abs(x) * 0.2 + (i % 2) * 0.5); a.root.rotation.y = -x * 0.05; a.root.scale.setScalar(1);
      a.fixedBase = anims[i]; S.scene.add(a.root); this.titleActors.push(a);
    });
    this.setMode('title'); this.idle = 0; this.attract = false;
    audio.music('title');
  }
  updateTitle(dt, pads) {
    this.idle += dt;
    for (const p of pads) if (p.held.some(Boolean) || Math.abs(p.x) > 0.3 || Math.abs(p.y) > 0.3) this.idle = 0;
    for (const p of pads) {
      if (p.a || p.start) { audio.sfx('select'); this.enterSelect(p); return; }
    }
    if (this.idle > TITLE_IDLE) this.startAttract();
  }
  drawTitle(g, t) {
    const S = this.stage;
    // logo
    g.save(); g.translate(W / 2, 128); g.rotate(-0.04);
    const word = 'CROWNFALL', size = 118;
    g.font = `${size}px ${FONT}`; g.textAlign = 'center'; g.textBaseline = 'middle'; g.lineJoin = 'round'; g.miterLimit = 2;
    if ('letterSpacing' in g) g.letterSpacing = '4px';
    g.fillStyle = '#1a0f33'; g.fillText(word, 7, 12);
    g.strokeStyle = '#2a1646'; g.lineWidth = 30; g.strokeText(word, 0, 0);
    g.strokeStyle = '#ff7a2a'; g.lineWidth = 16; g.strokeText(word, 0, 0);
    const gr = g.createLinearGradient(0, -60, 0, 60); gr.addColorStop(0, '#fff6a8'); gr.addColorStop(0.45, '#ffd23f'); gr.addColorStop(0.55, '#ffb21a'); gr.addColorStop(1, '#ff8a1a');
    g.fillStyle = gr; g.fillText(word, 0, 0);
    g.restore();
    text(g, 'ONE CROWN.  FIVE ARENAS.  NO MERCY.', W / 2, 206, { size: 22, align: 'center', color: '#e9e2ff', spacing: 4 });
    const blink = 0.55 + Math.sin(t * 4) * 0.45;
    text(g, 'PRESS  A  TO PLAY', W / 2, 632, { size: 44, align: 'center', color: '#fff', alpha: 0.4 + blink * 0.6 });
    const st = this.stats;
    const best = st.wins && Object.entries(st.wins).sort((a, b) => b[1] - a[1])[0];
    const line = [];
    if (st.best > 0) line.push(`BEST CROWN TIME  ${st.best.toFixed(1)}s`);
    if (best) line.push(`MOST WINS  ${ROSTER.find((r) => r.id === best[0])?.name || ''} (${best[1]})`);
    if (line.length) text(g, line.join('     '), W / 2, 678, { size: 16, align: 'center', color: '#bdb4e6', spacing: 2 });
    text(g, 'Music: Kevin MacLeod (CC BY 4.0)  -  see CREDITS', W - 16, H - 14, { size: 11, align: 'right', color: 'rgba(255,255,255,0.45)', shadow: false, sw: 0 });
  }

  // ------------------------------------------------------------------ attract
  async startAttract() {
    const g = this.game;
    this.attract = true;
    const chars = shuffle(ROSTER).slice(0, 4);
    g.pool.releaseAll(); this.titleActors = [];
    const arena = pick(ARENAS).id;
    this.setMode('loading'); this.loadLabel = 'LOADING';
    const ents = [];
    for (let i = 0; i < 4; i++) ents.push({ slot: i, char: chars[i], actor: await g.pool.acquireAsync(chars[i].id), padIndex: null, bot: true, skill: 0.6 + Math.random() * 0.3 });
    await this.beginRound(arena, ents, { attract: true, duration: 35 });
  }

  // ------------------------------------------------------------------ select
  enterSelect(joinPad = null) {
    const g = this.game, S = this.stage;
    for (const a of this.titleActors) { g.pool.release(a); }
    this.titleActors = [];
    S.pedestals.visible = true; S.titleCrown.visible = false; S.podium.visible = false;
    g.fx.attach(S.scene);
    this.setMode('select');
    if (joinPad) this.join(joinPad);
    audio.music('title');
  }
  slotOf(pad) { return clamp((pad.seat || pad.index + 1) - 1, 0, 3); }
  join(pad) {
    const s = this.slots[this.slotOf(pad)];
    if (s.joined) return;
    s.joined = true; s.ready = false; s.pad = pad.index;
    if (s.ci === undefined) s.ci = 0;
    // start on an avatar nobody else has
    const taken = this.slots.filter((o) => o !== s && o.joined).map((o) => o.ci);
    let tries = 0; while (taken.includes(s.ci) && tries++ < 9) s.ci = (s.ci + 1) % ROSTER.length;
    if (!this.slots.some((o) => o !== s && o.joined) && !this.joinedBefore) { s.ci = this.slotOf(pad) * 2 % ROSTER.length; }
    this.setSlotChar(s, s.ci, true);
    audio.sfx('join');
  }
  setSlotChar(s, ci, first = false) {
    const g = this.game;
    if (s.actor) { g.pool.release(s.actor); s.actor = null; }
    s.ci = (ci + ROSTER.length) % ROSTER.length;
    s.want = ROSTER[s.ci].id; s.hello = true;
  }
  leave(s) {
    if (s.actor) this.game.pool.release(s.actor);
    s.actor = null; s.joined = false; s.ready = false; s.pad = null; s.want = null;
  }
  updateSelect(dt, pads) {
    const g = this.game, S = this.stage;
    const joined = this.slots.filter((s) => s.joined);
    for (const p of pads) {
      const s = this.slots[this.slotOf(p)];
      if (!s.joined) { if (p.a || p.start) this.join(p); continue; }
      if (s.pad !== p.index) continue;
      if (!s.ready) {
        if (p.nav.left) { this.setSlotChar(s, s.ci - 1); audio.sfx('menu'); }
        if (p.nav.right) { this.setSlotChar(s, s.ci + 1); audio.sfx('menu'); }
        if (p.a) { s.ready = true; audio.sfx('ready'); if (s.actor) { s.actor.play('Yes', { speed: 1.5 }); } }
        else if (p.b) { this.leave(s); audio.sfx('back'); if (!this.slots.some((o) => o.joined)) { this.enterTitle(); return; } }
        if (p.p(BTN.Y) && this.slotOf(p) === this.firstJoined()) { this.cycleCpu(); }
      } else {
        const all = this.slots.every((o) => !o.joined || o.ready);
        if (p.b) { s.ready = false; audio.sfx('back'); }
        else if (p.start || (p.a && all)) { if (all) { audio.sfx('select'); this.enterCup(); return; } }
        if (p.p(BTN.Y) && this.slotOf(p) === this.firstJoined()) this.cycleCpu();
      }
    }
    // acquire actors (a second copy of an avatar may still be loading)
    this.slots.forEach((s, i) => {
      if (s.joined && !s.actor && s.want) {
        const a = g.pool.acquire(s.want);
        if (a) { s.actor = a; S.scene.add(a.root); const sp = S.pedSpots[i]; a.root.position.set(sp.x, sp.y, sp.z); a.root.rotation.y = 0; a.root.scale.setScalar(1); a.fixedBase = 'Idle_Loop'; a.play('Yes', { speed: 1.4, fade: 0.1 }); }
      }
      if (s.actor) { s.actor.fixedBase = s.ready ? 'Dance_Loop' : 'Idle_Loop'; s.actor.root.rotation.y = damp(s.actor.root.rotation.y, 0, 6, dt); }
    });
  }
  firstJoined() { return this.slots.findIndex((s) => s.joined); }
  cycleCpu() {
    const order = ['fill', 0, 1, 2, 3]; const i = order.indexOf(this.cpuMode); this.cpuMode = order[(i + 1) % order.length]; audio.sfx('menu');
  }
  cpuCount() {
    const humans = this.slots.filter((s) => s.joined).length;
    if (this.cpuMode === 'fill') return Math.max(0, 4 - humans);
    return Math.min(this.cpuMode, 4 - humans);
  }
  drawSelect(g, t) {
    const cam = this.menuCam;
    text(g, 'CHOOSE YOUR FIGHTER', W / 2, 52, { size: 46, align: 'center', color: '#ffd23f' });
    const all = this.slots.every((o) => !o.joined || o.ready) && this.slots.some((o) => o.joined);
    this.slots.forEach((s, i) => {
      const sp = this.stage.pedSpots[i];
      const sc = project(cam, new THREE.Vector3(sp.x, 0, sp.z + 1.6));
      const cx = sc.x, y = 452, cw = 290, col = PLAYER_COLORS[i];
      const pad = this.game.input.list.find((p) => this.slotOf(p) === i);
      panel(g, cx - cw / 2, y, cw, 215, { fill: 'rgba(14,12,30,0.84)', stroke: s.ready ? '#7dffb0' : col, lw: s.ready ? 5 : 3, r: 18 });
      g.fillStyle = col; rr(g, cx - cw / 2 + 10, y + 10, 72, 30, 10); g.fill();
      text(g, 'P' + (i + 1), cx - cw / 2 + 46, y + 26, { size: 22, align: 'center', stroke: '#12101f' });
      if (s.joined) {
        const c = ROSTER[s.ci];
        text(g, c.name, cx, y + 70, { size: 38, align: 'center', color: '#fff' });
        text(g, c.title, cx, y + 104, { size: 16, align: 'center', color: c.color, spacing: 1 });
        g.fillStyle = c.color; rr(g, cx - 60, y + 120, 120, 6, 3); g.fill();
        const wins = this.stats.wins[c.id] || 0;
        text(g, `WINS ${wins}`, cx, y + 142, { size: 14, align: 'center', color: '#bdb4e6', spacing: 2 });
        if (s.ready) text(g, 'READY!', cx, y + 182, { size: 34, align: 'center', color: '#7dffb0' });
        else {
          text(g, '<', cx - cw / 2 + 24, y + 182, { size: 38, color: '#fff', align: 'center', alpha: 0.6 + Math.sin(t * 6) * 0.3 });
          text(g, '>', cx + cw / 2 - 24, y + 182, { size: 38, color: '#fff', align: 'center', alpha: 0.6 + Math.sin(t * 6) * 0.3 });
          text(g, 'A: READY    B: LEAVE', cx, y + 182, { size: 14, align: 'center', color: '#e9e2ff', spacing: 1 });
        }
      } else if (pad) {
        text(g, 'PRESS A', cx, y + 100, { size: 36, align: 'center', color: '#fff', alpha: 0.5 + Math.sin(t * 5) * 0.4 });
        text(g, 'TO JOIN', cx, y + 140, { size: 24, align: 'center', color: col });
      } else {
        text(g, 'CPU', cx, y + 100, { size: 34, align: 'center', color: 'rgba(255,255,255,0.45)' });
        text(g, this.cpuCount() > this.slots.filter((o, j) => j < i && !o.joined).length ? 'WILL JOIN' : 'EMPTY', cx, y + 140, { size: 16, align: 'center', color: 'rgba(255,255,255,0.35)', spacing: 2 });
      }
    });
    const cpuTxt = this.cpuMode === 'fill' ? 'FILL' : String(this.cpuMode);
    text(g, `CPUs: ${cpuTxt}  (Y on first player)`, W / 2, 678, { size: 20, align: 'center', color: '#d8d4ff', spacing: 1 });
    if (all) text(g, 'PRESS START TO CONTINUE', W / 2, 98, { size: 30, align: 'center', color: '#7dffb0', alpha: 0.6 + Math.sin(t * 6) * 0.4 });
    else text(g, 'EVERYONE PRESS A TO GET READY', W / 2, 98, { size: 22, align: 'center', color: '#bdb4e6', spacing: 2 });
  }

  // ------------------------------------------------------------------ cup select
  enterCup() { this.setMode('cup'); this.cupSel = 0; }
  updateCup(dt, pads) {
    for (const p of pads) {
      const s = this.slots[this.slotOf(p)];
      if (!s.joined) continue;
      if (p.nav.left) { this.cupSel = (this.cupSel + 5) % 6; audio.sfx('menu'); }
      if (p.nav.right) { this.cupSel = (this.cupSel + 1) % 6; audio.sfx('menu'); }
      if (p.b) { this.setMode('select'); audio.sfx('back'); for (const sl of this.slots) sl.ready = false; return; }
      if (p.a || p.start) { audio.sfx('select'); this.startSession(this.cupSel); return; }
    }
  }
  drawCup(g, t) {
    g.fillStyle = 'rgba(8,6,20,0.62)'; g.fillRect(0, 0, W, H);
    text(g, 'CHOOSE YOUR BATTLEFIELD', W / 2, 62, { size: 44, align: 'center', color: '#ffd23f' });
    const n = 6, cw = 196, ch = 380, gap = 14, total = n * cw + (n - 1) * gap, x0 = (W - total) / 2, y0 = 130;
    const items = [{ id: 'cup', name: 'GRAND CUP', tagline: '3 rounds, random arenas', hazard: 'EVERYTHING', color: '#ffd23f' }, ...ARENAS];
    // selection index 0..5 -> cards; index 6 unused (wrap) -> map to 6 cards
    this.cupSel = this.cupSel % n;
    items.forEach((it, i) => {
      const x = x0 + i * (cw + gap), sel = i === this.cupSel, lift = sel ? -16 + Math.sin(t * 5) * 3 : 0;
      g.save(); g.translate(0, lift);
      panel(g, x, y0, cw, ch, { fill: 'rgba(14,12,30,0.9)', stroke: sel ? '#fff' : it.color, lw: sel ? 6 : 3, r: 20, glow: sel ? it.color : null });
      g.save(); rr(g, x + 10, y0 + 10, cw - 20, 190, 14); g.clip(); drawArenaArt(g, it.id, x + 10, y0 + 10, cw - 20, 190, t); g.restore();
      text(g, it.name, x + cw / 2, y0 + 236, { size: 26, align: 'center', color: '#fff', maxW: cw - 24 });
      g.fillStyle = it.color; rr(g, x + cw / 2 - 40, y0 + 258, 80, 5, 2); g.fill();
      wrap(g, it.tagline, x + cw / 2, y0 + 292, cw - 28, 16, '#d8d4ff');
      text(g, it.hazard, x + cw / 2, y0 + ch - 34, { size: 13, align: 'center', color: it.color, spacing: 1, maxW: cw - 24 });
      g.restore();
    });
    text(g, 'LEFT / RIGHT: CHOOSE      A: GO      B: BACK', W / 2, 640, { size: 20, align: 'center', color: '#d8d4ff', spacing: 2 });
  }
  startSession(sel) {
    const humans = this.slots.map((s, i) => ({ s, i })).filter((q) => q.s.joined);
    const ents = humans.map((q) => ({ slot: q.i, char: ROSTER[q.s.ci], actor: q.s.actor, padIndex: q.s.pad, bot: false, human: true }));
    const used = new Set(ents.map((e) => e.char.id));
    const free = shuffle(this.slots.map((s, i) => i).filter((i) => !this.slots[i].joined));
    const nCpu = this.cpuCount();
    const cpuChars = shuffle(ROSTER.filter((c) => !used.has(c.id)));
    for (let k = 0; k < nCpu && k < free.length; k++) ents.push({ slot: free[k], char: cpuChars[k], actor: null, padIndex: null, bot: true, skill: 0.5 + Math.random() * 0.35 });
    ents.sort((a, b) => a.slot - b.slot);
    const arenas = sel === 0 ? shuffle(ARENAS.map((a) => a.id)).slice(0, 3) : [ARENAS[sel - 1].id];
    this.session = { kind: sel === 0 ? 'cup' : 'single', arenas, round: 0, ents, totals: new Map(ents.map((e) => [e.slot, { points: 0, raw: 0, score: 0 }])), cupSel: sel };
    this.attract = false;
    this.nextRound();
  }

  // ------------------------------------------------------------------ rounds
  async nextRound() {
    const g = this.game, S = this.session;
    this.setMode('loading');
    const id = S.arenas[S.round];
    this.loadLabel = ARENAS.find((a) => a.id === id).name;
    for (const e of S.ents) if (!e.actor) e.actor = await g.pool.acquireAsync(e.char.id);
    for (const e of S.ents) { e.actor.fixedBase = null; }
    await this.beginRound(id, S.ents, {});
  }
  async beginRound(id, ents, opts) {
    const g = this.game;
    progress.label = 'Loading arena';
    opts = { ...opts, duration: opts.duration || Number(g.qs.get('dur')) || undefined };
    const arena = await loadArena(id, { fx: g.fx });
    this.leaveRound();
    if (g.qs.get('mind')) { arena.cam.minDist = Number(g.qs.get('mind')); arena.cam.maxDist = Number(g.qs.get('maxd') || g.qs.get('mind')); }
    this.round = new Round(g, arena, ents.map((e) => ({ slot: e.slot, char: e.char, actor: e.actor, padIndex: e.padIndex, bot: e.bot, skill: e.skill })), opts);
    await this.round.init();
    g.renderer.setClearColor(arena.scene.background || 0x000000, 1);
    this.setMode('round'); this.shakeT = 0;
    audio.music(arena.music, { fade: 1.2 });
    if (opts.attract) audio.music('action', { vol: 0.8 });
  }
  leaveRound() { if (this.round) { this.round.dispose(); this.round = null; } }
  async quickStart(id) {
    const g = this.game;
    const n = Math.max(0, Math.min(4, Number(g.qs.get('bots') ?? 3)));
    const humans = Number(g.qs.get('humans') ?? 0);
    const chars = shuffle(ROSTER);
    const ents = [];
    for (let i = 0; i < Math.min(4, n + humans); i++) ents.push({ slot: i, char: chars[i], actor: await g.pool.acquireAsync(chars[i].id), padIndex: i < humans ? i : null, bot: i >= humans, skill: 0.7 });
    this.titleActors = [];
    this.session = { kind: 'single', arenas: [id], round: 0, ents, totals: new Map(ents.map((e) => [e.slot, { points: 0, raw: 0, score: 0 }])), cupSel: 1 };
    this.attract = false;
    this.setMode('loading'); await this.beginRound(id, ents, { duration: Number(g.qs.get('dur')) || undefined, quick: true });
    if (g.qs.get('intro') !== '1') { this.round.phase = 'play'; this.round.running = true; this.round.phaseT = 0; this.round.time = 0.1; this.round.game.cam.frame(this.round.fighters.map((f) => f.pos), 0, true); }
  }

  // dev/test: run the live round headlessly for `sec` seconds and report stats
  simulate(sec) {
    const r = this.round; const g = this.game;
    for (let t = 0; t < sec; t += 1 / 60) { r.update(1 / 60); g.fx.update(1 / 60); }
    window.__outLog = r.outLog;
    return r.fighters.map((f) => ({ name: f.name, score: +f.score.toFixed(1), outs: f.stats.outs, steals: f.stats.steals, hits: f.stats.hits, kos: f.stats.kos, y: +f.pos.y.toFixed(1), dead: f.dead }));
  }
  updateRound(dt, pads) {
    const g = this.game, r = this.round;
    // adaptive quality: if the machine struggles, drop the shadow map
    if (r.phase === 'play') {
      this.fpsAcc = (this.fpsAcc || 0) + dt; this.fpsN = (this.fpsN || 0) + 1;
      if (this.fpsAcc > 3) { const fps = this.fpsN / this.fpsAcc; this.fpsAcc = 0; this.fpsN = 0; this.lowCount = fps < 38 ? (this.lowCount || 0) + 1 : 0; if (this.lowCount >= 2 && r.arena.sun && r.arena.sun.castShadow) { r.arena.sun.castShadow = false; g.lowQuality = true; } }
    }
    if (this.attract) {
      if (pads.some((p) => p.p(BTN.A) || p.p(BTN.START) || p.p(BTN.B) || p.p(BTN.X) || p.p(BTN.Y))) { audio.sfx('select'); this.attract = false; this.enterTitle(); return; }
    }
    let sdt = dt * r.timeScale;
    if (g.fx.hitstop > 0) { g.fx.hitstop -= dt; sdt = 0; }
    r.update(sdt);
    g.fx.update(sdt);
    if (r.phase !== 'intro') g.cam.apply(g.fx.shakeOffset(new THREE.Vector3(), g.time));
    if (r.done) {
      if (this.attract) { this.startAttract(); this.mode = 'loading'; return; }
      this.endRound();
    }
  }
  endRound() {
    const S = this.session, r = this.round, g0 = this.game;
    const res = r.results();
    this.results = res;
    for (const x of res) { const t = S.totals.get(x.fighter.slot); t.points += x.points; t.raw += x.raw; t.score += x.score; }
    const st = this.stats; st.rounds++;
    for (const x of res) if (!x.fighter.isBot) st.best = Math.max(st.best || 0, x.raw);
    saveStats(st);
    S.round++;
    r.markers.forEach((m) => { m.sprite.visible = false; m.ring.visible = false; m.blob.visible = true; });
    g0.cam.setUiOffset(0, -250);
    this.setMode('results');
    audio.music('sneaky', { vol: 0.8 });
    // winner dances, the rest sulk
    // line the fighters up on the arena's dais for the results camera
    const dais = r.arena.dais;
    res.forEach((x, i) => {
      const f = x.fighter, a = f.actor;
      const sp = i === 0 ? dais : r.arena.spawns[(i - 1) % r.arena.spawns.length];
      f.dead = false; f.stun = 0; f.hasCrown = false; f.invuln = 0; f.vel.set(0, 0, 0); f.clearPower(); f.setScale(1);
      f.pos.set(sp.x, sp.y, sp.z); f.yaw = 0;
      a.root.position.copy(f.pos); a.root.rotation.y = 0; a.root.scale.setScalar(1);
    });
    r.crown.holder = res[0].fighter; r.crown.state = 'worn'; r.crown.group.visible = true; r.crown.beam.visible = false;
    res.forEach((x, i) => { x.fighter.actor.root.visible = true; x.fighter.actor.fixedBase = i === 0 ? 'Dance_Loop' : (i === res.length - 1 && res.length > 2 ? 'Hit_Head' : 'Idle_FoldArms_Loop'); x.fighter.dead = false; x.fighter.stun = 0; });
    audio.sfx('fanfare');
  }
  updateResults(dt, pads) {
    const g = this.game, r = this.round, S = this.session;
    r.fx.update(dt); g.fx.update(dt);
    for (const f of r.fighters) f.actor.update(dt, { speed: 0, grounded: true, mode: 'normal', hasCrown: false });
    r.crown.update(dt, r);
    const w = this.results[0].fighter;
    const cam = g.cam;
    cam.target.x = damp(cam.target.x, w.pos.x, 2, dt); cam.target.y = damp(cam.target.y, w.pos.y + 1.4, 2, dt); cam.target.z = damp(cam.target.z, w.pos.z, 2, dt);
    cam.dist = damp(cam.dist, 15, 1.5, dt); cam.pitch = damp(cam.pitch, 0.42, 1.5, dt); cam.yaw = Math.sin(this.modeT * 0.35) * 0.35;
    cam.apply();
    if (this.modeT > 0.8 && Math.random() < dt * 1.2) g.fx.confetti(new THREE.Vector3(w.pos.x, w.pos.y + 4, w.pos.z), 20, 4);
    for (const p of pads) {
      if (this.modeT < 1.2) break;
      if (p.a || p.start) {
        audio.sfx('select');
        cam.yaw = 0; g.cam.setUiOffset(23, 0);
        if (S.round >= S.arenas.length) this.enterPodium(); else this.nextRound();
        return;
      }
    }
  }
  drawResults(g, t) {
    const S = this.session, res = this.results, k = clamp(this.modeT / 1.4, 0, 1);
    const x = 70, y = 70, w = 560, rows = res.length, rh = 92, h = 100 + rows * rh + 40;
    panel(g, x, y, w, h, { fill: 'rgba(10,8,26,0.93)', stroke: '#ffd23f', lw: 4, r: 22 });
    const total = S.arenas.length;
    text(g, S.kind === 'cup' ? `ROUND ${Math.min(S.round, total)} OF ${total}` : 'RESULTS', x + 30, y + 40, { size: 30, color: '#ffd23f' });
    text(g, this.round.arena.name, x + w - 30, y + 40, { size: 20, color: '#d8d4ff', align: 'right' });
    const max = Math.max(1, ...res.map((q) => q.score));
    res.forEach((q, i) => {
      const yy = y + 80 + i * rh, f = q.fighter, tot = S.totals.get(f.slot);
      g.fillStyle = i === 0 ? 'rgba(255,210,63,0.13)' : 'rgba(255,255,255,0.05)'; rr(g, x + 14, yy, w - 28, rh - 10, 14); g.fill();
      const medal = ['#ffd23f', '#e3e8f0', '#e0a678', '#7d7a98'][i];
      g.fillStyle = medal; g.beginPath(); g.arc(x + 54, yy + 41, 25, 0, 7); g.fill(); g.lineWidth = 4; g.strokeStyle = '#12101f'; g.stroke();
      text(g, String(i + 1), x + 54, yy + 43, { size: 28, align: 'center', color: '#12101f', sw: 0, shadow: false });
      text(g, (f.isBot ? 'CPU ' : 'P' + (f.slot + 1) + ' ') + f.name, x + 100, yy + 22, { size: 22, color: f.color });
      g.fillStyle = 'rgba(255,255,255,0.12)'; rr(g, x + 100, yy + 44, 210, 16, 8); g.fill();
      g.fillStyle = f.def.charColor; rr(g, x + 100, yy + 44, Math.max(8, 210 * (q.score / max) * k), 16, 8); g.fill();
      text(g, `${(q.score * k).toFixed(1)}s`, x + 322, yy + 52, { size: 20, color: '#fff' });
      if (k > 0.9) { text(g, `+${q.points}`, x + w - 34, yy + 30, { size: 34, align: 'right', color: '#7dffb0' }); }
      if (S.kind === 'cup') text(g, `${tot.points} PTS`, x + w - 34, yy + 62, { size: 17, align: 'right', color: '#cfc9ff' });
      if (f.stats.steals || f.stats.kos) text(g, `STEALS ${f.stats.steals}   RING-OUTS ${f.stats.kos}`, x + 100, yy + 76, { size: 12, color: '#9a96c8', spacing: 1 });
    });
    if (this.modeT > 1.2) text(g, S.round >= total ? 'PRESS A FOR THE PODIUM' : 'PRESS A FOR NEXT ROUND', x + w / 2, y + h - 22, { size: 22, align: 'center', color: '#fff', alpha: 0.5 + Math.sin(t * 5) * 0.4 });
  }

  // ------------------------------------------------------------------ podium
  enterPodium() {
    const g = this.game, S = this.session, St = this.stage;
    this.leaveRound();
    for (const e of S.ents) { e.actor.root.removeFromParent(); }
    const ranked = [...S.ents].sort((a, b) => {
      const ta = S.totals.get(a.slot), tb = S.totals.get(b.slot);
      return tb.points - ta.points || tb.score - ta.score;
    });
    this.podiumOrder = ranked;
    ranked.forEach((e, i) => {
      const sp = St.podiumSpots[i]; const a = e.actor;
      St.scene.add(a.root); a.root.position.set(sp.x, sp.y, sp.z); a.root.rotation.y = i === 3 ? -0.5 : 0; a.root.scale.setScalar(1);
      a.fixedBase = ['Dance_Loop', 'Yes', 'Idle_FoldArms_Loop', 'Hit_Head'][i];
    });
    St.podium.visible = true; St.pedestals.visible = false; St.titleCrown.visible = false;
    if (!this.podiumCrown) { this.podiumCrown = makeCrownMesh(); this.podiumCrown.scale.setScalar(1.3); }
    St.scene.add(this.podiumCrown);
    g.fx.attach(St.scene);
    // stats
    const w = ranked[0], st = this.stats;
    if (!w.bot) st.wins[w.char.id] = (st.wins[w.char.id] || 0) + 1;
    if (S.kind === 'cup') st.cups = (st.cups || 0) + 1;
    saveStats(st);
    this.setMode('podium'); audio.music('epic'); audio.sfx('fanfare');
    this.podiumT = 0;
  }
  updatePodium(dt, pads) {
    const g = this.game, St = this.stage, S = this.session;
    this.podiumT += dt;
    this.podiumOrder.forEach((e, i) => e.actor.update(dt, { speed: 0, grounded: true, mode: 'normal', hasCrown: i === 0 }));
    g.fx.update(dt);
    const w = this.podiumOrder[0].actor;
    w.headWorld(this.podiumCrown.position); this.podiumCrown.position.y += 0.12; this.podiumCrown.rotation.y += dt * 2;
    if (Math.random() < dt * 3) g.fx.confetti(new THREE.Vector3(rand(-6, 6), 8, rand(-3, 1)), 14, 3);
    if (this.podiumT < dt * 2) g.fx.confetti(new THREE.Vector3(0, 7, 0), 120, 7);
    // camera
    const cam = this.menuCam, t = this.podiumT;
    const k = easeOut(clamp(t / 3, 0, 1));
    cam.position.set(Math.sin(t * 0.25) * 2.5, 3.2 + (1 - k) * 2.5, 12 - k * 1.5); cam.lookAt(0, 1.7, -0.5);
    for (const p of pads) {
      if (this.podiumT < 1.0) break;
      if (p.a || p.start) { audio.sfx('select'); this.removePodiumCrown(); this.rematch(); return; }
      if (p.b) { audio.sfx('back'); this.removePodiumCrown(); this.backToSelect(); return; }
    }
  }
  removePodiumCrown() { this.podiumCrown.removeFromParent(); }
  rematch() {
    const S = this.session;
    for (const e of S.ents) { e.actor.fixedBase = null; }
    const sel = S.cupSel;
    S.arenas = sel === 0 ? shuffle(ARENAS.map((a) => a.id)).slice(0, 3) : S.arenas;
    S.round = 0; S.totals = new Map(S.ents.map((e) => [e.slot, { points: 0, raw: 0, score: 0 }]));
    this.stage.podium.visible = false;
    this.nextRound();
  }
  backToSelect() {
    const g = this.game, S = this.session, St = this.stage;
    for (const e of S.ents) { if (e.bot) g.pool.release(e.actor); e.actor.fixedBase = 'Idle_Loop'; }
    St.podium.visible = false; St.pedestals.visible = true;
    for (const s of this.slots) { s.ready = false; s.actor = null; }
    // humans keep their avatar; re-seat them on the pedestals
    for (const e of S.ents) if (!e.bot) {
      const s = this.slots[e.slot]; s.actor = e.actor; s.want = e.char.id;
      const sp = St.pedSpots[e.slot]; St.scene.add(e.actor.root); e.actor.root.position.set(sp.x, sp.y, sp.z); e.actor.root.rotation.y = 0;
    }
    this.session = null;
    this.setMode('select'); audio.music('title');
  }
  drawPodium(g, t) {
    const o = this.podiumOrder, w = o[0], St = this.stage, S = this.session;
    const k = easeOut(clamp(this.podiumT / 1.2, 0, 1));
    g.save(); g.translate(W / 2, 90 - (1 - k) * 100);
    text(g, S.kind === 'cup' ? 'GRAND CUP CHAMPION' : 'ROUND WINNER', 0, -38, { size: 24, align: 'center', color: '#e9e2ff', spacing: 5 });
    text(g, w.char.name, 0, 20, { size: 84, align: 'center', color: w.char.color, sw: 16 });
    g.restore();
    text(g, w.char.title, W / 2, 168, { size: 22, align: 'center', color: '#fff', spacing: 2 });
    const cam = this.menuCam;
    const heights = [1.3, 0.85, 0.55];
    St.podiumSpots.slice(0, 3).forEach((sp, i) => {
      if (!o[i]) return;
      const s = project(cam, new THREE.Vector3(sp.x, heights[i] * 0.5, sp.z + 1.26));
      text(g, ['1', '2', '3'][i], s.x, s.y, { size: 54, align: 'center', color: ['#ffd23f', '#e3e8f0', '#e0a678'][i], alpha: 0.95 });
    });
    o.forEach((e, i) => {
      const sp = St.podiumSpots[i]; const s = project(cam, new THREE.Vector3(sp.x, sp.y, sp.z + (i < 3 ? 0.55 : 0.9)));
      const tot = S.totals.get(e.slot);
      s.x = clamp(s.x, 90, W - 90);
      text(g, (e.bot ? 'CPU ' : 'P' + (e.slot + 1) + ' ') + e.char.name, s.x, s.y + 18, { size: 17, align: 'center', color: PLAYER_COLORS[e.slot] });
      if (S.kind === 'cup') text(g, `${tot.points} PTS`, s.x, s.y + 38, { size: 14, align: 'center', color: '#fff' });
    });
    if (this.podiumT > 1) text(g, 'A: REMATCH        B: CHARACTER SELECT', W / 2, 664, { size: 26, align: 'center', color: '#fff', alpha: 0.6 + Math.sin(t * 5) * 0.3 });
  }

  // ------------------------------------------------------------------ frame
  update(dt, pads) {
    this.t += dt; this.modeT += dt;
    // nothing but a pad press resumes audio; handled in main
    switch (this.mode) {
      case 'title': this.updateTitle(dt, pads); this.animateStage(dt); break;
      case 'select': this.updateSelect(dt, pads); this.animateStage(dt); break;
      case 'cup': this.updateCup(dt, pads); this.animateStage(dt); break;
      case 'round': this.updateRound(dt, pads); break;
      case 'results': this.updateResults(dt, pads); break;
      case 'podium': this.updatePodium(dt, pads); break;
      default: break;
    }
  }
  animateStage(dt) {
    const g = this.game, S = this.stage;
    const m = S.titleCrown.userData.mesh; m.rotation.y += dt * 1.4; S.titleCrown.position.y = 3.5 + Math.sin(this.t * 1.6) * 0.15;
    const cam = this.menuCam;
    if (this.mode === 'title') { cam.position.set(Math.sin(this.t * 0.2) * 1.5, 3.4, 15.2); cam.lookAt(0, 2.0, -1); }
    else { cam.position.set(0, 3.2, 13.6); cam.lookAt(0, 0.7, 0); }
    for (const a of this.titleActors.concat(this.slots.map((s) => s.actor).filter(Boolean))) a.update(dt, { speed: 0, grounded: true, mode: 'normal' });
    g.fx.update(dt);
    if (this.mode === 'title' && Math.random() < dt * 0.6) g.fx.sparkle(new THREE.Vector3(rand(-6, 6), rand(0.5, 3), rand(-4, 1)), 3, 0xffe27a);
  }

  render(g, dt) {
    const r = this.game.renderer, game = this.game;
    const t = this.t;
    if (this.mode === 'round' && this.round) {
      r.render(this.round.scene, game.cam.cam);
      game.stats = { calls: r.info.render.calls, tris: r.info.render.triangles };
      drawRoundHUD(g, this.round, game.cam.cam, t);
      if (this.attract) {
        text(g, 'DEMO', 40, 40, { size: 26, color: '#ffd23f', spacing: 3 });
        text(g, 'PRESS ANY BUTTON', W / 2, H - 150, { size: 30, align: 'center', color: '#fff', alpha: 0.5 + Math.sin(t * 5) * 0.4 });
      }
    } else if (this.mode === 'results' && this.round) {
      r.render(this.round.scene, game.cam.cam); this.drawResults(g, t);
    } else if (this.mode === 'loading') {
      r.setClearColor(0x0b0a1a, 1); r.clear();
      text(g, 'LOADING', W / 2, 300, { size: 40, align: 'center', color: '#d8d4ff', spacing: 6 });
      text(g, this.loadLabel || '', W / 2, 370, { size: 64, align: 'center', color: '#ffd23f' });
      const p = progress.total ? progress.done / progress.total : 0;
      g.fillStyle = 'rgba(255,255,255,0.15)'; g.fillRect(W / 2 - 200, 430, 400, 12);
      g.fillStyle = '#ffd23f'; g.fillRect(W / 2 - 200, 430, 400 * (0.15 + 0.85 * (Math.sin(t * 3) * 0.5 + 0.5)), 12);
    } else {
      r.setClearColor(0x0b0a1a, 1);
      r.render(this.stage.scene, this.menuCam);
      if (this.mode === 'title') this.drawTitle(g, t);
      else if (this.mode === 'select') this.drawSelect(g, t);
      else if (this.mode === 'cup') { this.drawSelectBackdrop(g); this.drawCup(g, t); }
      else if (this.mode === 'podium') this.drawPodium(g, t);
    }
  }
  drawSelectBackdrop() {}
}

function wrap(g, str, x, y, maxW, size, color) {
  const words = str.split(' '); let line = '', yy = y;
  for (const w of words) {
    const test = line ? line + ' ' + w : w;
    if (measure(g, test, size) > maxW && line) { text(g, line, x, yy, { size, align: 'center', color, shadow: false, sw: 0 }); line = w; yy += size + 4; } else line = test;
  }
  text(g, line, x, yy, { size, align: 'center', color, shadow: false, sw: 0 });
}

// little painted thumbnails for the cup select cards
function drawArenaArt(g, id, x, y, w, h, t) {
  const sky = (a, b) => { const gr = g.createLinearGradient(0, y, 0, y + h); gr.addColorStop(0, a); gr.addColorStop(1, b); g.fillStyle = gr; g.fillRect(x, y, w, h); };
  const blob = (cx, cy, rx, ry, col) => { g.fillStyle = col; g.beginPath(); g.ellipse(cx, cy, rx, ry, 0, 0, 7); g.fill(); };
  if (id === 'garden') {
    sky('#2f7dff', '#d6f1ff'); blob(x + 40, y + 45, 34, 14, '#fff'); blob(x + 130, y + 70, 40, 15, '#fff');
    blob(x + w / 2, y + 140, 70, 18, '#7a6350'); blob(x + w / 2, y + 126, 70, 18, '#5fd08a'); blob(x + 38, y + 120, 24, 8, '#f7c24a'); blob(x + w - 40, y + 100, 22, 7, '#f7c24a');
  } else if (id === 'rooftops') {
    sky('#1a0b3d', '#ff6a9c');
    g.fillStyle = '#12082e'; [[0, 110, 40], [48, 80, 40], [96, 125, 36], [138, 95, 40]].forEach(([bx, by, bw]) => g.fillRect(x + bx, y + by, bw, h - by));
    g.fillStyle = '#ff4fd8'; g.fillRect(x + 0, y + 110, 40, 3); g.fillRect(x + 48, y + 80, 40, 3); g.fillStyle = '#4ff3ff'; g.fillRect(x + 96, y + 125, 36, 3); g.fillRect(x + 138, y + 95, 40, 3);
    blob(x + w / 2, y + 50, 26, 26, '#ffb36b');
  } else if (id === 'hollow') {
    sky('#0e1236', '#3a2a5e'); blob(x + w - 50, y + 40, 22, 22, '#fff3c4');
    g.fillStyle = '#2a1a1a'; g.fillRect(x, y + 140, w, 60);
    blob(x + 60, y + 140, 30, 24, '#ff8a1a'); g.fillStyle = '#1a0c00'; g.fillRect(x + 48, y + 134, 8, 8); g.fillRect(x + 66, y + 134, 8, 8);
    g.fillStyle = '#6b6f86'; rr(g, x + 120, y + 100, 26, 44, 10); g.fill();
  } else if (id === 'orbit') {
    sky('#02030c', '#101a40'); g.fillStyle = '#fff'; for (let i = 0; i < 30; i++) g.fillRect(x + ((i * 53) % w), y + ((i * 37) % h), 2, 2);
    blob(x + w / 2 + 20, y + 150, 80, 80, '#c8793a'); g.strokeStyle = '#f0d6a0'; g.lineWidth = 5; g.beginPath(); g.ellipse(x + w / 2 + 20, y + 150, 100, 18, -0.3, 0, 7); g.stroke();
    g.fillStyle = '#cfd6e6'; g.fillRect(x + 30, y + 82, 70, 8); g.fillStyle = '#ff7a2a'; g.fillRect(x + 30, y + 90, 70, 5);
  } else if (id === 'kitchen') {
    sky('#7a3a1a', '#ffd9a0'); g.fillStyle = '#b8c0cc'; g.fillRect(x + 10, y + 110, w - 20, 14); g.fillStyle = '#8a95a6'; g.fillRect(x + 20, y + 124, 10, 66); g.fillRect(x + w - 30, y + 124, 10, 66);
    blob(x + 60, y + 96, 26, 16, '#4a4a55'); blob(x + 120, y + 100, 24, 12, '#d83a2a'); g.fillStyle = '#ff7a2a'; g.fillRect(x + 100, y + 108, 40, 4);
  } else { // cup
    sky('#2a1650', '#7a2f7e'); crownIcon(g, x + w / 2, y + 95, 58);
    g.fillStyle = '#fff'; for (let i = 0; i < 12; i++) g.fillRect(x + ((i * 61) % w), y + ((i * 43) % 120), 3, 3);
    text(g, '3 ROUNDS', x + w / 2, y + 170, { size: 20, align: 'center', color: '#ffd23f' });
  }
}
