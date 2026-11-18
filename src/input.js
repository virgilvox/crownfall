// Gamepad polling. navigator.getGamepads() is the ONLY input source. Pads are keyed by their array index.
const DEAD = 0.2;
export const BTN = { A: 0, B: 1, X: 2, Y: 3, L: 4, R: 5, LT: 6, RT: 7, SELECT: 8, START: 9, UP: 12, DOWN: 13, LEFT: 14, RIGHT: 15 };

class PadState {
  constructor(index) {
    this.index = index; this.seat = index + 1; this.id = '';
    this.x = 0; this.y = 0;
    this.held = new Array(17).fill(false);
    this.pressed = new Array(17).fill(false);   // rising edge this frame
    this.nav = { left: false, right: false, up: false, down: false };
    this._navHeld = { left: 0, right: 0, up: 0, down: 0 };
    this._navT = { left: 0, right: 0, up: 0, down: 0 };
  }
  p(b) { return this.pressed[b]; }
  get a() { return this.pressed[0]; }
  get b() { return this.pressed[1]; }
  get start() { return this.pressed[9]; }
}

export class Input {
  constructor() { this.pads = new Map(); this.list = []; this.any = false; this.time = 0; }

  poll(dt) {
    this.time += dt;
    let pads = [];
    try { pads = navigator.getGamepads ? Array.from(navigator.getGamepads()) : []; } catch (e) { pads = []; }
    const seen = new Set();
    this.any = false;
    for (const gp of pads) {
      if (!gp || gp.connected === false) continue;
      seen.add(gp.index);
      let st = this.pads.get(gp.index);
      if (!st) { st = new PadState(gp.index); this.pads.set(gp.index, st); }
      const m = /seat\s*(\d)/i.exec(gp.id || '');
      st.id = gp.id; st.seat = m ? Number(m[1]) : gp.index + 1;
      const bt = gp.buttons || [];
      for (let i = 0; i < 17; i++) {
        const v = bt[i] ? (bt[i].pressed || bt[i].value >= 0.5) : false;
        st.pressed[i] = v && !st.held[i];
        st.held[i] = v;
        if (st.pressed[i]) this.any = true;
      }
      let x = gp.axes[0] || 0, y = gp.axes[1] || 0;
      const mag = Math.hypot(x, y);
      if (mag < DEAD) { x = 0; y = 0; } else { const k = (mag - DEAD) / (1 - DEAD) / mag; x *= Math.min(1, k * 1.0); y *= Math.min(1, k * 1.0); const m2 = Math.hypot(x, y); if (m2 > 1) { x /= m2; y /= m2; } }
      if (st.held[BTN.LEFT]) x = -1; if (st.held[BTN.RIGHT]) x = 1;
      if (st.held[BTN.UP]) y = -1; if (st.held[BTN.DOWN]) y = 1;
      st.x = x; st.y = y;
      const dirs = { left: x < -0.55, right: x > 0.55, up: y < -0.55, down: y > 0.55 };
      for (const d in dirs) {
        st.nav[d] = false;
        if (dirs[d]) {
          if (!st._navHeld[d]) { st.nav[d] = true; st._navT[d] = this.time + 0.4; }
          else if (this.time > st._navT[d]) { st.nav[d] = true; st._navT[d] = this.time + 0.14; }
        }
        st._navHeld[d] = dirs[d] ? 1 : 0;
      }
    }
    for (const k of [...this.pads.keys()]) if (!seen.has(k)) this.pads.delete(k);
    this.list = [...this.pads.values()].sort((a, b) => a.index - b.index);
    return this.list;
  }
  // true when any pad pressed A or START this frame
  confirm() { return this.list.some((p) => p.a || p.start); }
}
