// In-round HUD drawn on the 2D overlay: timer, player cards, banners, countdown, popups, off-screen arrows.
import * as THREE from 'three';
import { W, H, text, rr, panel, crownIcon, powerIcon, FONT, measure } from './ui.js';
import { POWERS } from './player.js';
import { PLAYER_COLORS } from './roster.js';
import { FRENZY_AT } from './round.js';
import { clamp, easeOut } from './util.js';

const _v = new THREE.Vector3();
export function project(cam, p, out = {}) {
  _v.copy(p).project(cam);
  out.x = (_v.x * 0.5 + 0.5) * W; out.y = (-_v.y * 0.5 + 0.5) * H; out.behind = _v.z > 1;
  return out;
}

export function drawRoundHUD(g, round, cam, t) {
  const fs = round.fighters;
  // frenzy vignette
  if (round.frenzy && round.phase === 'play') {
    const a = 0.25 + Math.sin(t * 6) * 0.1;
    const gr = g.createRadialGradient(W / 2, H / 2, H * 0.45, W / 2, H / 2, H * 0.95);
    gr.addColorStop(0, 'rgba(255,40,20,0)'); gr.addColorStop(1, `rgba(255,40,20,${a})`);
    g.fillStyle = gr; g.fillRect(0, 0, W, H);
  }
  // speed lines for a hasted human
  for (const f of fs) if (f.power === 'speed' && !f.dead) {
    g.save(); g.strokeStyle = 'rgba(120,235,255,0.18)'; g.lineWidth = 3;
    for (let i = 0; i < 14; i++) { const a = (i / 14) * 6.283 + t * 0.3; const r0 = 330 + ((t * 700 + i * 97) % 200), r1 = r0 + 90; g.beginPath(); g.moveTo(W / 2 + Math.cos(a) * r0 * 1.5, H / 2 + Math.sin(a) * r0 * 0.9); g.lineTo(W / 2 + Math.cos(a) * r1 * 1.5, H / 2 + Math.sin(a) * r1 * 0.9); g.stroke(); }
    g.restore(); break;
  }
  drawTimer(g, round, t);
  drawCards(g, round, t);
  // popups
  for (const p of round.popups) {
    const s = project(cam, p.pos); if (s.behind) continue;
    s.y = Math.min(s.y, 570); s.x = Math.max(80, Math.min(W - 160, s.x));
    const k = p.t / 0.7, sc = k < 0.15 ? 0.5 + k / 0.15 * 0.7 : 1.2 - (k - 0.15) * 0.2;
    g.save(); g.translate(s.x + 34, s.y - k * 24); g.scale(sc, sc);
    text(g, p.text, 0, 0, { size: 22, color: p.color, align: 'center', alpha: 1 - Math.max(0, (k - 0.6) / 0.4) });
    g.restore();
  }
  drawArrows(g, round, cam, t);
  if (round.arena.hudDraw) round.arena.hudDraw(g, round, cam, t);
  drawBanners(g, round, t);
  if (round.phase === 'intro') drawIntro(g, round);
  if (round.phase === 'countdown') drawCountdown(g, round);
}

function drawTimer(g, round, t) {
  const left = round.timeLeft, urgent = left <= 10 && round.phase === 'play';
  const secs = Math.ceil(left);
  const m = Math.floor(secs / 60), s = secs % 60;
  const label = `${m}:${String(s).padStart(2, '0')}`;
  const pulse = round.frenzy ? 1 + Math.sin(t * 8) * 0.06 : 1;
  g.save(); g.translate(W / 2, 46); g.scale(pulse, pulse);
  panel(g, -92, -34, 184, 68, { fill: round.frenzy ? 'rgba(120,10,10,0.85)' : 'rgba(14,12,30,0.78)', stroke: round.frenzy ? '#ff6a5a' : 'rgba(255,255,255,0.3)', r: 20 });
  text(g, label, 0, 4, { size: 50, align: 'center', color: urgent || round.frenzy ? '#ff7b6a' : '#fff' });
  g.restore();
  text(g, round.arena.name, W / 2, 98, { size: 16, align: 'center', color: '#d8d4ff', spacing: 3 });
  if (round.frenzy && round.phase === 'play') text(g, 'CROWN x2', W / 2, 118, { size: 15, align: 'center', color: '#ffd23f', spacing: 2 });
}

function drawCards(g, round, t) {
  const fs = round.fighters, n = fs.length;
  const cw = 262, ch = 92, gap = 18, total = n * cw + (n - 1) * gap;
  const x0 = (W - total) / 2, y0 = H - ch - 18;
  fs.forEach((f, i) => {
    const x = x0 + i * (cw + gap), y = y0;
    const crown = f.hasCrown;
    const bob = crown ? Math.sin(t * 6) * 2 : 0;
    g.save(); g.translate(0, bob);
    panel(g, x, y, cw, ch, { fill: crown ? 'rgba(70,50,6,0.9)' : 'rgba(14,12,30,0.8)', stroke: crown ? '#ffd23f' : f.color, lw: crown ? 5 : 3, r: 18, glow: crown ? '#ffd23f' : null });
    // portrait block
    rr(g, x + 8, y + 8, 76, ch - 16, 12); g.fillStyle = f.def.charColor; g.fill();
    const gr = g.createLinearGradient(0, y + 8, 0, y + ch - 8); gr.addColorStop(0, 'rgba(255,255,255,0.35)'); gr.addColorStop(1, 'rgba(0,0,0,0.3)'); g.fillStyle = gr; rr(g, x + 8, y + 8, 76, ch - 16, 12); g.fill();
    text(g, f.isBot ? 'CPU' : 'P' + (f.slot + 1), x + 46, y + 28, { size: 22, align: 'center', color: '#fff', stroke: f.color, sw: 6 });
    if (crown) crownIcon(g, x + 46, y + 62, 22); else text(g, f.name.slice(0, 1), x + 46, y + 64, { size: 36, align: 'center', color: 'rgba(255,255,255,0.9)', stroke: 'rgba(0,0,0,0.35)', shadow: false });
    text(g, f.name, x + 94, y + 24, { size: 19, color: '#fff', spacing: 1 });
    const sc = f.score.toFixed(1);
    text(g, sc, x + 94, y + 56, { size: 36, color: crown ? '#ffd23f' : '#fff' });
    text(g, 's', x + 94 + measure(g, sc, 36) + 4, y + 62, { size: 18, color: '#cfc9ff' });
    if (f.dead) { text(g, 'OUT', x + cw - 14, y + 24, { size: 18, color: '#ff6a6a', align: 'right' }); }
    // dash cooldown bar
    const cdMax = f.hasCrown ? 1.6 : 1.0, cd = clamp(1 - f.dashCd / cdMax, 0, 1);
    g.fillStyle = 'rgba(255,255,255,0.15)'; rr(g, x + 94, y + ch - 18, 100, 7, 3); g.fill();
    g.fillStyle = cd >= 1 ? '#7dffb0' : '#9a96c8'; rr(g, x + 94, y + ch - 18, 100 * cd, 7, 3); g.fill();
    g.restore();
    // power-up chip under the card
    if (f.power) {
      const P = POWERS[f.power], px = x + cw - 62, py = y + 54;
      g.save(); g.translate(0, bob);
      powerIcon(g, f.power, px, py + 3, 17);
      g.fillStyle = 'rgba(255,255,255,0.18)'; rr(g, px - 24, py + 22, 48, 7, 3); g.fill();
      g.fillStyle = P.css; rr(g, px - 24, py + 22, 48 * clamp(f.powerT / P.dur, 0, 1), 7, 3); g.fill();
      g.restore();
    }
  });
}

function drawArrows(g, round, cam, t) {
  const m = 38;
  for (const f of round.fighters) {
    if (f.dead) continue;
    const p = f.pos.clone(); p.y += 1;
    const s = project(cam, p);
    const out = s.behind || s.x < m || s.x > W - m || s.y < m || s.y > H - 120;
    if (!out) continue;
    let x = clamp(s.x, m + 10, W - m - 10), y = clamp(s.y, 130, H - 130);
    const a = Math.atan2(s.y - y, s.x - x);
    g.save(); g.translate(x, y); g.rotate(s.behind ? Math.PI : a);
    g.fillStyle = f.color; g.strokeStyle = '#12101f'; g.lineWidth = 4; g.lineJoin = 'round';
    g.beginPath(); g.moveTo(22, 0); g.lineTo(-12, -16); g.lineTo(-6, 0); g.lineTo(-12, 16); g.closePath(); g.stroke(); g.fill();
    g.restore();
  }
  // crown pointer when it is loose and off-screen
  const c = round.crown;
  if (c.state === 'loose' || c.state === 'landed' || c.state === 'dais') {
    const s = project(cam, c.pos);
    if (s.behind || s.x < 0 || s.x > W || s.y < 0 || s.y > H) {
      const x = clamp(s.x, 40, W - 40), y = clamp(s.y, 140, H - 130);
      crownIcon(g, x, y, 22);
    }
  }
}

function drawBanners(g, round, t) {
  round.banners.forEach((b, i) => {
    const k = b.t / b.dur;
    const sc = b.t < 0.18 ? 0.3 + easeOut(b.t / 0.18) * 0.85 : b.t < 0.3 ? 1.15 - (b.t - 0.18) / 0.12 * 0.15 : 1;
    const a = k > 0.8 ? 1 - (k - 0.8) / 0.2 : 1;
    const size = 58;
    g.save(); g.translate(W / 2, 175 + i * 56); g.scale(sc, sc);
    text(g, b.text, 0, 0, { size, align: 'center', color: b.color, alpha: a, sw: size * 0.2, maxW: 1000 });
    g.restore();
  });
}

function drawIntro(g, round) {
  const k = round.phaseT / 2.6;
  const a = k < 0.15 ? k / 0.15 : k > 0.85 ? (1 - k) / 0.15 : 1;
  const slide = (1 - easeOut(clamp(k / 0.2, 0, 1))) * 400;
  g.save(); g.globalAlpha = a; g.translate(-slide, 0);
  panel(g, 0, 260, 620, 150, { fill: 'rgba(10,8,24,0.82)', stroke: null, r: 0 });
  g.fillStyle = round.arena.color || '#ffd23f'; g.fillRect(0, 260, 14, 150);
  text(g, round.arena.name, 50, 312, { size: 58, color: '#fff' });
  text(g, round.arena.tagline, 54, 372, { size: 24, color: round.arena.color || '#ffd23f', spacing: 1 });
  g.restore();
}

function drawCountdown(g, round) {
  const left = 3 - round.phaseT;
  if (left <= 0) return;
  const n = Math.ceil(left), f = 1 - (left - Math.floor(left));
  const sc = 1.6 - Math.min(1, f * 2.2) * 0.6;
  g.save(); g.translate(W / 2, H / 2 - 40); g.scale(sc, sc);
  text(g, String(n), 0, 0, { size: 220, align: 'center', color: n === 1 ? '#ff7b6a' : n === 2 ? '#ffd23f' : '#7dffb0', sw: 28, alpha: 1 - Math.max(0, f - 0.75) * 3 });
  g.restore();
}
