// The crown: procedural model, light beam, and the state machine dais -> worn -> loose -> (gone -> dais).
import * as THREE from 'three';
import { audio } from './audio.js';
import { rand } from './util.js';

export function makeCrownMesh() {
  const g = new THREE.Group();
  const gold = new THREE.MeshStandardMaterial({ color: 0xffc933, metalness: 1, roughness: 0.28, emissive: 0xffa400, emissiveIntensity: 0.55 });
  const band = new THREE.Mesh(new THREE.CylinderGeometry(0.27, 0.23, 0.17, 24, 1, true), gold); band.material.side = THREE.DoubleSide; band.position.y = 0.085; g.add(band);
  const rim = new THREE.Mesh(new THREE.TorusGeometry(0.255, 0.03, 8, 28), gold); rim.rotation.x = Math.PI / 2; rim.position.y = 0.01; g.add(rim);
  const rim2 = rim.clone(); rim2.scale.setScalar(1.04); rim2.position.y = 0.17; g.add(rim2);
  const gems = [0xff3355, 0x2dd36f];
  for (let i = 0; i < 5; i++) {
    const a = (i / 5) * Math.PI * 2;
    const sp = new THREE.Mesh(new THREE.ConeGeometry(0.065, 0.3, 8), gold); sp.position.set(Math.cos(a) * 0.255, 0.31, Math.sin(a) * 0.255); g.add(sp);
    const gem = new THREE.Mesh(new THREE.SphereGeometry(0.05, 10, 8), new THREE.MeshStandardMaterial({ color: gems[i % 2], emissive: gems[i % 2], emissiveIntensity: 0.9, roughness: 0.2 }));
    gem.position.set(Math.cos(a) * 0.255, 0.47, Math.sin(a) * 0.255); g.add(gem);
    const big = new THREE.Mesh(new THREE.SphereGeometry(0.045, 8, 6), new THREE.MeshStandardMaterial({ color: 0xff3355, emissive: 0xff3355, emissiveIntensity: 0.7 }));
    big.position.set(Math.cos(a + 0.63) * 0.262, 0.09, Math.sin(a + 0.63) * 0.262); g.add(big);
  }
  g.traverse((o) => { if (o.isMesh) o.castShadow = true; });
  return g;
}

let beamTex = null;
function beamTexture() {
  if (beamTex) return beamTex;
  const c = document.createElement('canvas'); c.width = 8; c.height = 128; const g = c.getContext('2d');
  const gr = g.createLinearGradient(0, 0, 0, 128); gr.addColorStop(0, 'rgba(255,230,120,0)'); gr.addColorStop(0.7, 'rgba(255,220,90,0.16)'); gr.addColorStop(1, 'rgba(255,240,170,0.42)');
  g.fillStyle = gr; g.fillRect(0, 0, 8, 128);
  beamTex = new THREE.CanvasTexture(c); beamTex.colorSpace = THREE.SRGBColorSpace; return beamTex;
}

export class Crown {
  constructor(scene, fx) {
    this.fx = fx;
    this.mesh = makeCrownMesh(); this.mesh.scale.setScalar(1.5);
    this.group = new THREE.Group(); this.group.add(this.mesh);
    this.beam = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.55, 5.5, 20, 1, true), new THREE.MeshBasicMaterial({ map: beamTexture(), transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide, fog: false }));
    this.beam.position.y = 2.7; this.beam.renderOrder = 8; this.group.add(this.beam);
    this.light = new THREE.PointLight(0xffd25a, 6, 9, 1.6); this.light.position.y = 0.6; this.group.add(this.light);
    this.group.visible = false;
    scene.add(this.group);
    this.state = 'hidden'; this.pos = new THREE.Vector3(); this.vel = new THREE.Vector3();
    this.holder = null; this.bounces = 0; this.t = 0; this.goneT = 0; this.daisPos = new THREE.Vector3(); this.lastHolder = null;
    this.noGrabFor = null;
  }
  spawnAtDais(dais) {
    this.daisPos.set(dais.x, dais.y, dais.z);
    this.state = 'dais'; this.pos.copy(this.daisPos).setY(this.daisPos.y + 1.1); this.vel.set(0, 0, 0);
    this.holder = null; this.group.visible = true; this.beam.visible = true;
    this.fx.ring(this.daisPos, 0xffd25a, 4, 0.8); this.fx.burst(this.pos, 24, { color: 0xffd25a, speed: 6, up: 6, size: 0.4, shape: 2, add: 1, life: 0.9 });
    audio.sfx('spawn');
  }
  wear(f, round, stolen) {
    this.state = 'worn'; this.holder = f; f.hasCrown = true; this.beam.visible = false;
    if (this.lastHolder && this.lastHolder !== f && stolen) { f.stats.steals++; round.banner('STOLEN!', f.color, 1.1); audio.sfx('steal'); }
    else { audio.sfx('crown'); round.banner(`${f.name} HAS THE CROWN`, f.color, 1.0); }
    this.lastHolder = f;
    f.actor.flash('happy', 1, 2);
    this.fx.ring(f.pos, 0xffd25a, 3, 0.5);
    this.fx.burst(f.pos.clone().setY(f.pos.y + 1.6), 18, { color: 0xffd25a, speed: 5, up: 3, size: 0.32, shape: 2, add: 1 });
    round.onCrown(f);
  }
  drop(f, dx, dz, attacker) {
    f.hasCrown = false; f.noGrab = 1.0; this.holder = null; this.state = 'loose'; this.bounces = 0;
    this.pos.copy(f.pos).setY(f.pos.y + 1.7 * f.scale);
    const a = Math.atan2(dz, dx) + rand(-0.8, 0.8), sp = rand(2.5, 4.5);
    this.vel.set(Math.cos(a) * sp, rand(8, 11), Math.sin(a) * sp);
    this.beam.visible = true; audio.sfx('drop');
    this.fx.burst(this.pos, 16, { color: 0xffd25a, speed: 6, up: 4, size: 0.35, shape: 2, add: 1 });
  }
  lose(f) { // wearer fell out of the arena
    f.hasCrown = false; this.holder = null; this.state = 'gone'; this.goneT = 2.0; this.group.visible = false;
  }
  update(dt, round) {
    this.t += dt;
    const f = this.holder;
    if (this.state === 'worn' && f) {
      f.actor.headWorld(this.pos); this.pos.y += 0.1 * f.scale + 0.02;
      this.group.position.copy(this.pos);
      this.mesh.rotation.y += dt * 2.2; this.mesh.scale.setScalar(0.8 * f.scale + 0.08);
      this.mesh.rotation.z = 0;
      this.light.intensity = 3;
      if (Math.random() < 0.5) this.fx.emit({ x: this.pos.x + rand(-0.3, 0.3), y: this.pos.y + rand(-0.1, 0.4), z: this.pos.z + rand(-0.3, 0.3), vy: rand(0.5, 1.5), color: 0xffe27a, size: rand(0.18, 0.3), life: 0.7, shape: 2, add: 1 });
      return;
    }
    this.mesh.scale.setScalar(1.5);
    this.light.intensity = 6;
    if (this.state === 'gone') { this.goneT -= dt; if (this.goneT <= 0 && round.running) this.spawnAtDais(round.arena.dais); return; }
    if (this.state === 'dais') {
      this.pos.copy(this.daisPos); this.pos.y += 1.1 + Math.sin(this.t * 2.5) * 0.18;
      this.mesh.rotation.y += dt * 1.6;
    } else if (this.state === 'loose') {
      this.vel.y -= 24 * dt;
      this.pos.addScaledVector(this.vel, dt);
      this.mesh.rotation.y += dt * 8; this.mesh.rotation.x = Math.sin(this.t * 9) * 0.25;
      const g = round.world.ground(this.pos.x, this.pos.z, this.pos.y + 0.3);
      if (g && this.pos.y < g.y + 0.35 && this.vel.y < 0) {
        if (this.bounces < 1) { this.bounces++; this.vel.y *= -0.4; this.vel.x *= 0.6; this.vel.z *= 0.6; this.pos.y = g.y + 0.36; audio.sfx('bounce'); this.fx.dust(this.pos, 3, 0.6); }
        else { this.vel.set(0, 0, 0); this.pos.y = g.y + 0.36; this.state = 'landed'; this.mesh.rotation.x = 0; }
      }
      if (this.pos.y < -7) { this.state = 'gone'; this.goneT = 2; this.group.visible = false; round.banner('CROWN LOST!', '#ffd25a', 1); return; }
    } else if (this.state === 'landed') {
      this.mesh.rotation.y += dt * 2; this.pos.y += Math.sin(this.t * 4) * 0.003;
      // landed on a surface that has since disappeared (crumbling tile)?
      const g = round.world.ground(this.pos.x, this.pos.z, this.pos.y + 0.5);
      if (!g) { this.state = 'loose'; this.vel.set(0, 0, 0); }
    }
    // never let it rest inside a solid prop (water tower, burger...) where nobody could reach it
    if (this.state === 'loose' || this.state === 'landed') {
      for (const c of round.world.colliders) {
        if (!c.wall || !c.enabled || this.pos.y > c.maxY || this.pos.y < c.minY - 1) continue;
        let nx, nz, d, rr;
        if (c.kind === 'cyl') { nx = this.pos.x - c.x; nz = this.pos.z - c.z; d = Math.hypot(nx, nz) || 0.01; rr = c.r + 0.95; if (d < rr) { this.pos.x = c.x + (nx / d) * rr; this.pos.z = c.z + (nz / d) * rr; } }
        else {
          const cx = Math.max(c.minX, Math.min(this.pos.x, c.maxX)), cz = Math.max(c.minZ, Math.min(this.pos.z, c.maxZ));
          nx = this.pos.x - cx; nz = this.pos.z - cz; d = Math.hypot(nx, nz);
          if (d < 0.95) { if (d < 1e-4) { nx = 1; nz = 0; d = 1; } this.pos.x = cx + (nx / d) * 0.95; this.pos.z = cz + (nz / d) * 0.95; }
        }
      }
    }
    this.group.position.copy(this.pos);
    // pickup
    if (this.state === 'dais' || this.state === 'loose' || this.state === 'landed') {
      for (const p of round.fighters) {
        if (p.dead || p.noGrab > 0 || p.stun > 0.25) continue;
        const dx = p.pos.x - this.pos.x, dz = p.pos.z - this.pos.z, dy = this.pos.y - p.pos.y;
        const r = 0.8 + p.radius;
        if (dx * dx + dz * dz < r * r && dy > -0.3 && dy < 2.2 * p.scale) { this.wear(p, round, this.state !== 'dais' && !!this.lastHolder); break; }
      }
    }
  }
}
