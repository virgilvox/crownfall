import * as THREE from 'three';
export const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
export const lerp = (a, b, t) => a + (b - a) * t;
export const damp = (cur, target, rate, dt) => cur + (target - cur) * (1 - Math.exp(-rate * dt));
export const TAU = Math.PI * 2;
export const angDiff = (a, b) => ((b - a + Math.PI * 3) % TAU) - Math.PI;
export const rand = (a = 1, b) => (b === undefined ? Math.random() * a : a + Math.random() * (b - a));
export const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];
// seeded rng (?seed=)
let seed = 0;
export function seedRng(s) { seed = s >>> 0 || 1; }
export function srand() { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 4294967296; }
export const V3 = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z);
export const easeOut = (t) => 1 - Math.pow(1 - clamp(t, 0, 1), 3);
export const easeInOut = (t) => { t = clamp(t, 0, 1); return t * t * (3 - 2 * t); };
export function shuffle(a) { a = a.slice(); for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; }
