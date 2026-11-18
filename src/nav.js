// Walk/jump navigation graph sampled from an arena's colliders. Used by bots.
const CELL = 1.25;

export class Nav {
  constructor(world, bounds, opts = {}) {
    this.w = world; this.cell = CELL;
    const [minX, maxX, minZ, maxZ] = bounds;
    this.minX = minX; this.minZ = minZ;
    this.nx = Math.ceil((maxX - minX) / CELL); this.nz = Math.ceil((maxZ - minZ) / CELL);
    const n = this.nx * this.nz;
    this.h = new Float32Array(n).fill(-1e9);
    for (let i = 0; i < this.nx; i++) for (let k = 0; k < this.nz; k++) {
      const g = world.ground(minX + (i + 0.5) * CELL, minZ + (k + 0.5) * CELL, 1e9);
      if (g && this.headroom(world, minX + (i + 0.5) * CELL, minZ + (k + 0.5) * CELL, g.y)) this.h[i * this.nz + k] = g.y;
    }
    this.jumpRange = opts.jumpRange || 7.2; this.jumpUp = opts.jumpUp || 3.3; this.avoid = opts.avoid || null;
    this.adj = new Array(n); this.edgeCell = new Uint8Array(n);
    this.build();
  }
  headroom() { return true; }
  has(i, k) { return i >= 0 && k >= 0 && i < this.nx && k < this.nz && this.h[i * this.nz + k] > -1e8; }
  pos(id) { const i = Math.floor(id / this.nz), k = id % this.nz; return { x: this.minX + (i + 0.5) * CELL, z: this.minZ + (k + 0.5) * CELL, y: this.h[id] }; }
  idAt(x, z) { return Math.floor((x - this.minX) / CELL) * this.nz + Math.floor((z - this.minZ) / CELL); }
  // nearest walkable node to a world position
  nearest(x, z, y = null) {
    const ci = Math.floor((x - this.minX) / CELL), ck = Math.floor((z - this.minZ) / CELL);
    let best = -1, bd = 1e9;
    for (let r = 0; r < 12 && best < 0; r++) {
      for (let i = ci - r; i <= ci + r; i++) for (let k = ck - r; k <= ck + r; k++) {
        if (Math.max(Math.abs(i - ci), Math.abs(k - ck)) !== r || !this.has(i, k)) continue;
        const id = i * this.nz + k, p = this.pos(id);
        const d = (p.x - x) ** 2 + (p.z - z) ** 2 + (y !== null ? ((p.y - y) * 0.6) ** 2 : 0);
        if (d < bd) { bd = d; best = id; }
      }
    }
    return best;
  }
  build() {
    const { nx, nz, h } = this;
    const R = Math.ceil(this.jumpRange / CELL);
    for (let i = 0; i < nx; i++) for (let k = 0; k < nz; k++) {
      const id = i * nz + k;
      if (h[id] < -1e8) { this.adj[id] = []; continue; }
      const edges = []; let edge = false;
      for (let di = -1; di <= 1; di++) for (let dk = -1; dk <= 1; dk++) {
        if (!di && !dk) continue;
        const ni = i + di, nk = k + dk;
        if (!this.has(ni, nk)) { edge = true; continue; }
        const nid = ni * nz + nk, dh = h[nid] - h[id];
        const dist = Math.hypot(di, dk) * CELL;
        if (dh <= 0.36 && dh >= -2.2) { edges.push({ to: nid, cost: dist + Math.abs(dh) * 0.4, jump: false }); if (dh < -1) edge = true; }
        else if (dh > 0.36 && dh <= this.jumpUp) edges.push({ to: nid, cost: dist + 2 + dh, jump: true });
        else if (dh < -2.2) edge = true;
      }
      this.edgeCell[id] = edge || edges.length < 8 ? 1 : 0;
      if (edge || edges.length < 8) {
        // gap jumps: look for landing cells further out
        for (let di = -R; di <= R; di++) for (let dk = -R; dk <= R; dk++) {
          const d = Math.hypot(di, dk);
          if (d < 1.9 || d > R + 0.01) continue;
          const ni = i + di, nk = k + dk;
          if (!this.has(ni, nk)) continue;
          const nid = ni * nz + nk, dh = h[nid] - h[id];
          if (dh > this.jumpUp || dh < -9) continue;
          if (edges.some((e) => e.to === nid)) continue;
          // only keep when the straight line crosses a gap (otherwise the walk edges already cover it)
          const mi = Math.round(i + di / 2), mk = Math.round(k + dk / 2);
          if (this.has(mi, mk) && Math.abs(h[mi * nz + mk] - h[id]) < 0.5 && d < 3.2) continue;
          // reject if a wall-ish obstacle sits right in between
          edges.push({ to: nid, cost: d * CELL * 1.25 + 3 + Math.max(0, dh), jump: true, gap: true });
        }
      }
      for (const e of edges) if (!e.jump && this.edgeCell[e.to]) e.cost += 0.6;
      if (this.avoid) for (const e of edges) { const q = this.pos(e.to); e.cost += this.avoid(q.x, q.z, q.y); }
      this.adj[id] = edges;
    }
  }
  // A* from node a to node b -> array of node ids (including a), or null
  path(a, b) {
    if (a < 0 || b < 0) return null;
    if (a === b) return [a];
    const open = [[0, a]], came = new Map(), g = new Map([[a, 0]]);
    const bp = this.pos(b);
    const heur = (id) => { const p = this.pos(id); return Math.hypot(p.x - bp.x, p.z - bp.z) * 0.95; };
    let guard = 0;
    while (open.length && guard++ < 6000) {
      let bi = 0; for (let i = 1; i < open.length; i++) if (open[i][0] < open[bi][0]) bi = i;
      const [, cur] = open.splice(bi, 1)[0];
      if (cur === b) { const out = [cur]; let c = cur; while (came.has(c)) { c = came.get(c).from; out.push(c); } return out.reverse(); }
      for (const e of this.adj[cur]) {
        const ng = g.get(cur) + e.cost;
        if (ng < (g.get(e.to) ?? 1e9)) { g.set(e.to, ng); came.set(e.to, { from: cur, jump: e.jump }); open.push([ng + heur(e.to), e.to]); }
      }
    }
    return null;
  }
  isJump(a, b) { const e = this.adj[a].find((q) => q.to === b); return !!(e && e.jump); }
  // random walkable node
  random(interior = true) { let id; let n = 0; do { id = Math.floor(Math.random() * this.h.length); } while ((this.h[id] < -1e8 || (interior && this.edgeCell[id] && n < 300)) && n++ < 400); return id; }
}
