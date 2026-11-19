// Input: every navigator.getGamepads() pad (HOPPER phones and plugged-in pads), plus the keyboard as one more pad.
// Pads are keyed by their array index; the keyboard is pad KB_INDEX.
//
// Keyboard: listening for keys tells HOPPER to hand this cart raw keys (its own fixed keyboard-as-pad layout, arrows +
// Z X A S, is switched off), so the game can offer the layout laptop players expect: WASD or arrows, Space to jump.
// Key presses are latched between frames so a tap shorter than a frame is never lost.
const DEAD = 0.2;
export const BTN = { A: 0, B: 1, X: 2, Y: 3, L: 4, R: 5, LT: 6, RT: 7, SELECT: 8, START: 9, UP: 12, DOWN: 13, LEFT: 14, RIGHT: 15 };
export const KB_INDEX = 8;
const KEYMAP = {
  KeyW: BTN.UP, ArrowUp: BTN.UP, KeyS: BTN.DOWN, ArrowDown: BTN.DOWN, KeyA: BTN.LEFT, ArrowLeft: BTN.LEFT, KeyD: BTN.RIGHT, ArrowRight: BTN.RIGHT,
  Space: BTN.A, KeyK: BTN.A, KeyZ: BTN.A,                         // jump / confirm
  ShiftLeft: BTN.X, ShiftRight: BTN.X, KeyJ: BTN.X, KeyX: BTN.X,  // dash
  KeyL: BTN.B, KeyC: BTN.B, Backspace: BTN.B,                     // slam / back
  KeyT: BTN.Y, KeyI: BTN.Y, KeyV: BTN.Y,                          // taunt / CPU count
  Enter: BTN.START, NumpadEnter: BTN.START,
};
class Keyboard {
  constructor() {
    this.held = new Set(); this.latched = new Set(); this.used = false;
    const down = (e) => {
      const b = KEYMAP[e.code];
      if (b === undefined || e.ctrlKey || e.metaKey || e.altKey) return;
      e.preventDefault();
      this.used = true; this.held.add(e.code); if (!e.repeat) this.latched.add(e.code);
    };
    const up = (e) => { if (KEYMAP[e.code] !== undefined) { this.held.delete(e.code); e.preventDefault(); } };
    try {
      window.addEventListener('keydown', down);
      window.addEventListener('keyup', up);
      window.addEventListener('blur', () => this.held.clear());
    } catch (e) { /* no window: tests */ }
  }
  // fills held[]/pressed[] for one frame, then forgets the latched taps
  read(held, pressed) {
    held.fill(false); pressed.fill(false);
    for (const c of this.held) held[KEYMAP[c]] = true;
    for (const c of this.latched) { pressed[KEYMAP[c]] = true; held[KEYMAP[c]] = true; }
    this.latched.clear();
  }
}

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
  constructor() { this.pads = new Map(); this.list = []; this.any = false; this.time = 0; this.kb = new Keyboard(); this.kbHeld = new Array(17).fill(false); this.kbPressed = new Array(17).fill(false); }

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
      if (x || y || st.held.some(Boolean)) st.used = true;
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
    if (this.kb.used) {
      seen.add(KB_INDEX);
      let st = this.pads.get(KB_INDEX);
      if (!st) { st = new PadState(KB_INDEX); st.id = 'KEYBOARD'; st.keyboard = true; st.seat = 0; this.pads.set(KB_INDEX, st); }
      // sit in the lowest seat no real pad is using. HOPPER keeps reporting the keyboard's own lobby seat as an idle pad
      // after the cart takes raw keys, so a pad only counts once someone has pressed something on it.
      const taken = new Set([...this.pads.values()].filter((p) => !p.keyboard && p.used && seen.has(p.index)).map((p) => p.seat));
      if (!st.seat || taken.has(st.seat)) { st.seat = 1; while (taken.has(st.seat) && st.seat < 4) st.seat++; }
      this.kb.read(this.kbHeld, this.kbPressed);
      for (let i = 0; i < 17; i++) {
        st.pressed[i] = this.kbPressed[i] || (this.kbHeld[i] && !st.held[i]);
        st.held[i] = this.kbHeld[i];
        if (st.pressed[i]) this.any = true;
      }
      let x = (st.held[BTN.RIGHT] ? 1 : 0) - (st.held[BTN.LEFT] ? 1 : 0), y = (st.held[BTN.DOWN] ? 1 : 0) - (st.held[BTN.UP] ? 1 : 0);
      if (x && y) { x *= Math.SQRT1_2; y *= Math.SQRT1_2; }
      st.x = x; st.y = y;
      // a tapped direction counts as a menu step even if it was released before this frame
      const tap = { left: this.kbPressed[BTN.LEFT], right: this.kbPressed[BTN.RIGHT], up: this.kbPressed[BTN.UP], down: this.kbPressed[BTN.DOWN] };
      const dirs = { left: x < -0.55, right: x > 0.55, up: y < -0.55, down: y > 0.55 };
      for (const d in dirs) {
        st.nav[d] = false;
        if (tap[d]) { st.nav[d] = true; st._navT[d] = this.time + 0.4; }
        else if (dirs[d] && st._navHeld[d] && this.time > st._navT[d]) { st.nav[d] = true; st._navT[d] = this.time + 0.14; }
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
