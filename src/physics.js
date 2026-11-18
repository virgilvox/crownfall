// Custom character physics: capsules vs a list of axis-aligned boxes and vertical cylinders.
// Collider: {kind:'box', minX,maxX,minY,maxY,minZ,maxZ} | {kind:'cyl', x,z,r,minY,maxY}; enabled flag; dx/dy/dz = motion this frame.
export const STEP = 0.36;

export function box(cx, topY, cz, w, d, thick = 3) {
  return { kind: 'box', enabled: true, minX: cx - w / 2, maxX: cx + w / 2, minZ: cz - d / 2, maxZ: cz + d / 2, minY: topY - thick, maxY: topY, dx: 0, dy: 0, dz: 0 };
}
export function cyl(x, topY, z, r, thick = 3) {
  return { kind: 'cyl', enabled: true, x, z, r, minY: topY - thick, maxY: topY, dx: 0, dy: 0, dz: 0 };
}
// a wall only pushes players sideways (props such as water towers): it is never stood on
export function wallBox(cx, cz, w, d, y0, y1 = y0 + 40) { const c = box(cx, y1, cz, w, d, y1 - y0); c.wall = true; return c; }
export function wallCyl(x, z, r, y0, y1 = y0 + 40) { const c = cyl(x, y1, z, r, y1 - y0); c.wall = true; return c; }
export function moveCollider(c, dx, dy, dz) {
  if (c.kind === 'box') { c.minX += dx; c.maxX += dx; c.minZ += dz; c.maxZ += dz; } else { c.x += dx; c.z += dz; }
  c.minY += dy; c.maxY += dy; c.dx = dx; c.dy = dy; c.dz = dz;
}

// circle (x,z,r) overlap with the collider footprint
function overlaps(c, x, z, r) {
  if (c.kind === 'box') {
    const nx = Math.max(c.minX, Math.min(x, c.maxX)), nz = Math.max(c.minZ, Math.min(z, c.maxZ));
    const dx = x - nx, dz = z - nz;
    return dx * dx + dz * dz < r * r;
  }
  const dx = x - c.x, dz = z - c.z; const rr = c.r + r;
  return dx * dx + dz * dz < rr * rr;
}
function contains(c, x, z) {
  if (c.kind === 'box') return x >= c.minX && x <= c.maxX && z >= c.minZ && z <= c.maxZ;
  const dx = x - c.x, dz = z - c.z; return dx * dx + dz * dz <= c.r * c.r;
}

export class World {
  constructor(colliders) { this.colliders = colliders; }

  // highest walkable surface under (x,z) that is not above maxY. returns {y, c} or null
  ground(x, z, maxY = Infinity, r = 0) {
    let best = null;
    for (const c of this.colliders) {
      if (!c.enabled || c.wall || c.maxY > maxY) continue;
      if (best && c.maxY <= best.y) continue;
      if (r > 0 ? overlaps(c, x, z, r) : contains(c, x, z)) best = { y: c.maxY, c };
    }
    return best;
  }

  // move an actor {pos(Vector3 feet), vel, radius, height} one step. sets grounded, groundC, landed (impact speed), hitWall
  step(a, dt) {
    const sp = Math.max(Math.abs(a.vel.x), Math.abs(a.vel.z), Math.abs(a.vel.y)) * dt;
    const n = Math.max(1, Math.min(6, Math.ceil(sp / 0.3)));
    a.landed = 0; a.hitWall = false;
    const h = dt / n;
    for (let i = 0; i < n; i++) this.sub(a, h);
  }

  sub(a, dt) {
    const p = a.pos, r = a.radius, H = a.height;
    const prevY = p.y;
    p.x += a.vel.x * dt; p.z += a.vel.z * dt; p.y += a.vel.y * dt;
    // walls
    for (const c of this.colliders) {
      if (!c.enabled) continue;
      if (p.y >= c.maxY - STEP || p.y + H <= c.minY) continue;
      if (c.kind === 'box') {
        const nx = Math.max(c.minX, Math.min(p.x, c.maxX)), nz = Math.max(c.minZ, Math.min(p.z, c.maxZ));
        let dx = p.x - nx, dz = p.z - nz;
        const d2 = dx * dx + dz * dz;
        if (d2 >= r * r) continue;
        if (d2 > 1e-8) { const d = Math.sqrt(d2); p.x += (dx / d) * (r - d); p.z += (dz / d) * (r - d); this.wall(a, dx / d, dz / d); }
        else { // centre inside the box: push out the shortest way
          const l = p.x - c.minX, rt = c.maxX - p.x, f = p.z - c.minZ, b = c.maxZ - p.z; const m = Math.min(l, rt, f, b);
          if (m === l) { p.x = c.minX - r; this.wall(a, -1, 0); } else if (m === rt) { p.x = c.maxX + r; this.wall(a, 1, 0); } else if (m === f) { p.z = c.minZ - r; this.wall(a, 0, -1); } else { p.z = c.maxZ + r; this.wall(a, 0, 1); }
        }
      } else {
        const dx = p.x - c.x, dz = p.z - c.z, rr = c.r + r; const d2 = dx * dx + dz * dz;
        if (d2 >= rr * rr) continue;
        const d = Math.sqrt(d2) || 1e-4; p.x = c.x + (dx / d) * rr; p.z = c.z + (dz / d) * rr; this.wall(a, dx / d, dz / d);
      }
    }
    // ceiling
    if (a.vel.y > 0) {
      for (const c of this.colliders) {
        if (!c.enabled || c.wall) continue;
        if (prevY + H <= c.minY + 0.01 && p.y + H > c.minY && overlaps(c, p.x, p.z, r * 0.8)) { p.y = c.minY - H; a.vel.y = 0; break; }
      }
    }
    // ground
    a.grounded = false; a.groundC = null;
    if (a.vel.y <= 0) {
      let best = null;
      for (const c of this.colliders) {
        if (!c.enabled || c.wall) continue;
        const top = c.maxY;
        if (top > prevY + STEP + 0.001 || p.y > top + 0.0001) continue;   // not reachable / still above
        if (best && top <= best.maxY) continue;
        if (overlaps(c, p.x, p.z, r * 0.75)) best = c;
      }
      if (best) {
        if (a.vel.y < -1) a.landed = Math.max(a.landed, -a.vel.y);
        p.y = best.maxY; a.vel.y = 0; a.grounded = true; a.groundC = best;
      }
    }
  }
  wall(a, nx, nz) {
    a.hitWall = true;
    const vn = a.vel.x * nx + a.vel.z * nz;
    if (vn < 0) { a.vel.x -= vn * nx; a.vel.z -= vn * nz; }
  }
}
