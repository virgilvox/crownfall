// The 2D overlay: an offscreen canvas drawn every frame and shown on a full-screen quad after the 3D pass.
import * as THREE from 'three';

export const W = 1280, H = 720;
export const FONT = '"Arial Black", Impact, "Helvetica Neue", Arial, sans-serif';

export class Overlay {
  constructor(renderer) {
    this.renderer = renderer;
    this.canvas = document.createElement('canvas'); this.canvas.width = W; this.canvas.height = H;
    this.g = this.canvas.getContext('2d');
    this.tex = new THREE.CanvasTexture(this.canvas);
    this.tex.colorSpace = THREE.SRGBColorSpace; this.tex.minFilter = THREE.LinearFilter; this.tex.generateMipmaps = false;
    this.scene = new THREE.Scene();
    this.cam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
    const m = new THREE.MeshBasicMaterial({ map: this.tex, transparent: true, depthTest: false, depthWrite: false, toneMapped: false });
    this.scene.add(new THREE.Mesh(new THREE.PlaneGeometry(2, 2), m));
  }
  begin() { this.g.setTransform(1, 0, 0, 1, 0, 0); this.g.clearRect(0, 0, W, H); return this.g; }
  render() {
    this.tex.needsUpdate = true;
    const r = this.renderer; const ac = r.autoClear; r.autoClear = false; r.clearDepth(); r.render(this.scene, this.cam); r.autoClear = ac;
  }
}

export function rr(g, x, y, w, h, r) {
  g.beginPath(); g.moveTo(x + r, y); g.arcTo(x + w, y, x + w, y + h, r); g.arcTo(x + w, y + h, x, y + h, r); g.arcTo(x, y + h, x, y, r); g.arcTo(x, y, x + w, y, r); g.closePath();
}

// chunky outlined text. opts: size, color, stroke, sw, align, base, shadow, font, alpha, spacing
export function text(g, str, x, y, o = {}) {
  let size = o.size || 28;
  if (o.maxW) { const w = measure(g, str, size, o.font); if (w > o.maxW) size = Math.max(8, size * o.maxW / w); }
  g.save();
  g.font = `${o.weight || ''} ${size}px ${o.font || FONT}`.trim();
  g.textAlign = o.align || 'left'; g.textBaseline = o.base || 'middle';
  if (o.spacing !== undefined && 'letterSpacing' in g) g.letterSpacing = o.spacing + 'px';
  g.lineJoin = 'round'; g.miterLimit = 2;
  if (o.alpha !== undefined) g.globalAlpha = o.alpha;
  if (o.shadow !== false) { g.fillStyle = 'rgba(0,0,0,0.45)'; g.fillText(str, x + size * 0.06, y + size * 0.08); }
  if (o.sw !== 0) { g.strokeStyle = o.stroke || '#12101f'; g.lineWidth = o.sw || Math.max(3, size * 0.16); g.strokeText(str, x, y); }
  g.fillStyle = o.color || '#fff'; g.fillText(str, x, y);
  g.restore();
}
export function measure(g, str, size, font = FONT) { g.save(); g.font = `${size}px ${font}`; const w = g.measureText(str).width; g.restore(); return w; }

export function crownIcon(g, x, y, s, color = '#ffd23f', stroke = '#5a3d00') {
  g.save(); g.translate(x, y); g.scale(s, s);
  g.beginPath(); g.moveTo(-1, 0.6); g.lineTo(-1.1, -0.7); g.lineTo(-0.5, -0.1); g.lineTo(0, -0.9); g.lineTo(0.5, -0.1); g.lineTo(1.1, -0.7); g.lineTo(1, 0.6); g.closePath();
  g.fillStyle = color; g.fill(); g.lineWidth = 0.14; g.strokeStyle = stroke; g.lineJoin = 'round'; g.stroke();
  g.fillStyle = '#ff4d6d'; g.beginPath(); g.arc(0, 0.2, 0.18, 0, 7); g.fill();
  g.restore();
}

export function panel(g, x, y, w, h, { fill = 'rgba(14,12,30,0.78)', stroke = 'rgba(255,255,255,0.25)', r = 16, lw = 3, glow } = {}) {
  g.save();
  if (glow) { g.shadowColor = glow; g.shadowBlur = 24; }
  rr(g, x, y, w, h, r); g.fillStyle = fill; g.fill();
  g.shadowBlur = 0;
  if (stroke) { g.lineWidth = lw; g.strokeStyle = stroke; g.stroke(); }
  g.restore();
}

export function powerIcon(g, kind, x, y, s) {
  g.save(); g.translate(x, y); g.scale(s, s); g.lineJoin = 'round';
  const col = { speed: '#37e6ff', shield: '#4d8bff', mega: '#ff4d4d', feather: '#f4f4ff' }[kind];
  g.fillStyle = col; g.strokeStyle = '#10101e'; g.lineWidth = 0.16;
  if (kind === 'speed') { g.beginPath(); g.moveTo(0.2, -1); g.lineTo(-0.7, 0.15); g.lineTo(-0.05, 0.15); g.lineTo(-0.3, 1); g.lineTo(0.7, -0.2); g.lineTo(0.05, -0.2); g.closePath(); }
  else if (kind === 'shield') { g.beginPath(); g.moveTo(0, -1); g.lineTo(0.8, -0.65); g.quadraticCurveTo(0.8, 0.5, 0, 1); g.quadraticCurveTo(-0.8, 0.5, -0.8, -0.65); g.closePath(); }
  else if (kind === 'mega') { g.beginPath(); g.arc(0, 0, 0.95, 0, 7); g.moveTo(0, 0); }
  else { g.beginPath(); g.moveTo(-0.7, 0.9); g.quadraticCurveTo(-0.8, -0.6, 0.7, -0.95); g.quadraticCurveTo(0.9, 0.3, -0.7, 0.9); g.closePath(); }
  g.fill(); g.stroke();
  if (kind === 'mega') { text(g, 'M', 0, 0.06, { size: 1.4, color: '#fff', stroke: '#10101e', sw: 0.16, shadow: false, align: 'center' }); }
  if (kind === 'feather') { g.beginPath(); g.moveTo(-0.6, 0.8); g.lineTo(0.5, -0.6); g.strokeStyle = '#9fb3ff'; g.lineWidth = 0.1; g.stroke(); }
  g.restore();
}
