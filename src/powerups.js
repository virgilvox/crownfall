// Floating power-up gems: spawn at the arena's pickup points every 10 to 14 seconds.
import * as THREE from 'three';
import { loadModel } from './assets.js';
import { POWERS } from './player.js';
import { audio } from './audio.js';
import { rand, pick, shuffle } from './util.js';

let glowTex = null;
export function glowTexture() {
  if (glowTex) return glowTex;
  const c = document.createElement('canvas'); c.width = c.height = 64; const g = c.getContext('2d');
  const gr = g.createRadialGradient(32, 32, 0, 32, 32, 32); gr.addColorStop(0, 'rgba(255,255,255,1)'); gr.addColorStop(0.35, 'rgba(255,255,255,0.45)'); gr.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = gr; g.fillRect(0, 0, 64, 64);
  glowTex = new THREE.CanvasTexture(c); glowTex.colorSpace = THREE.SRGBColorSpace; return glowTex;
}

export class Powerups {
  constructor(scene, fx) {
    this.scene = scene; this.fx = fx; this.items = []; this.timer = 7; this.t = 0; this.built = false;
  }
  async build() {
    const coin = await loadModel('proto:Coin_A');
    for (const [type, P] of Object.entries(POWERS)) {
      const g = new THREE.Group();
      const m = coin.clone(true);
      m.traverse((o) => { if (o.isMesh) { o.material = new THREE.MeshStandardMaterial({ color: P.color, emissive: P.color, emissiveIntensity: 0.65, roughness: 0.35, metalness: 0.3 }); o.castShadow = true; } });
      m.scale.setScalar(1.0);
      g.add(m);
      const glow = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTexture(), color: P.color, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, opacity: 0.9 }));
      glow.scale.setScalar(2.6); g.add(glow);
      const ring = new THREE.Mesh(new THREE.TorusGeometry(0.75, 0.04, 6, 24), new THREE.MeshBasicMaterial({ color: P.color, transparent: true, opacity: 0.8 })); g.add(ring);
      g.visible = false; this.scene.add(g);
      this.items.push({ type, g, m, ring, active: false, pos: new THREE.Vector3(), spot: null });
    }
    this.built = true;
  }
  reset() { this.timer = 7; for (const it of this.items) { it.active = false; it.g.visible = false; } }
  update(dt, round) {
    if (!this.built) return;
    this.t += dt;
    if (round.phase === 'play') {
      this.timer -= dt;
      if (this.timer <= 0) { this.spawn(round); this.timer = rand(10, 14); }
    }
    for (const it of this.items) {
      if (!it.active) continue;
      const bob = Math.sin(this.t * 3 + it.pos.x) * 0.15;
      it.g.position.set(it.pos.x, it.pos.y + 1.2 + bob, it.pos.z);
      it.m.rotation.y += dt * 2.4; it.ring.rotation.x = Math.PI / 2 + Math.sin(this.t * 2) * 0.25; it.ring.rotation.z += dt;
      for (const f of round.fighters) {
        if (f.dead) continue;
        const dx = f.pos.x - it.pos.x, dz = f.pos.z - it.pos.z, dy = f.pos.y + 0.8 - (it.pos.y + 1.2);
        if (dx * dx + dz * dz < 1.0 + f.radius && Math.abs(dy) < 1.6) {
          it.active = false; it.g.visible = false; f.givePower(it.type, round); round.banner(POWERS[it.type].name + '!', POWERS[it.type].css, 0.8, f);
          break;
        }
      }
    }
  }
  spawn(round) {
    const free = this.items.filter((i) => !i.active);
    if (!free.length || this.items.filter((i) => i.active).length >= 2) return;
    const spots = shuffle(round.arena.pickups);
    const taken = this.items.filter((i) => i.active).map((i) => i.spot);
    const spot = spots.find((s) => !taken.includes(s)) || spots[0];
    const it = pick(free);
    it.active = true; it.spot = spot; it.pos.set(spot.x, spot.y, spot.z); it.g.visible = true;
    this.fx.ring(it.pos, POWERS[it.type].color, 2.2, 0.6);
    this.fx.burst(it.pos.clone().setY(it.pos.y + 1), 14, { color: POWERS[it.type].color, speed: 4, up: 4, size: 0.3, shape: 2, add: 1 });
    audio.sfx('spawn');
  }
}
