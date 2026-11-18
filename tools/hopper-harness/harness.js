// A stand-in for HOPPER's /play page + player frame, rebuilt from its shipped code (2026-11-18): the same sandboxed
// srcdoc frame and real jsgame-shim.js, the same keyboard-as-pad table, the START/SELECT combo hold (START reaches the
// cart only on release when tapped under 120 ms, for one host frame), and pads posted once per host frame on change.
(() => {
  const BTN = { A: 0, B: 1, X: 2, Y: 3, L: 4, R: 5, SELECT: 8, START: 9, UP: 12, DOWN: 13, LEFT: 14, RIGHT: 15 };
  const KEYS = { ArrowUp: 'UP', ArrowDown: 'DOWN', ArrowLeft: 'LEFT', ArrowRight: 'RIGHT', KeyZ: 'A', KeyX: 'B', KeyA: 'X', KeyS: 'Y', KeyQ: 'L', KeyE: 'R', Enter: 'START', ShiftLeft: 'SELECT', ShiftRight: 'SELECT' };
  const held = new Set();
  let raw = false; // HOPPER: a cart that listens for keys gets raw keys and the keyboard pad goes away
  const mods = (e) => (e.shiftKey ? 1 : 0) | (e.ctrlKey ? 2 : 0) | (e.altKey ? 4 : 0) | (e.metaKey ? 8 : 0);
  const fwd = (e, down) => { port?.postMessage({ type: 'keys', keys: [{ code: e.code, key: e.key, down, repeat: e.repeat, mods: mods(e) }] }); };
  const browserKey = (e) => e.ctrlKey || e.metaKey || e.altKey || /^F\d+$/.test(e.code) || (e.code === 'Tab' && e.shiftKey) || e.code === 'Escape';
  addEventListener('keydown', (e) => { if (raw) { if (!browserKey(e)) { fwd(e, true); e.preventDefault(); } return; } if (KEYS[e.code]) { held.add(e.code); e.preventDefault(); } });
  addEventListener('keyup', (e) => { if (raw) { if (!browserKey(e)) fwd(e, false); return; } if (KEYS[e.code]) { held.delete(e.code); e.preventDefault(); } });
  addEventListener('blur', () => { held.clear(); if (raw) port?.postMessage({ type: 'focus', on: false }); });
  addEventListener('focus', () => { if (raw) port?.postMessage({ type: 'focus', on: true }); });
  // stand-in phones: __harness.phone(i, {A: true}) holds buttons on pad i (seat i+1)
  const phones = [null, null, null, null];
  const bit = (n) => 1 << BTN[n];
  const COMBO = bit('START') | bit('SELECT');
  const hold = { state: 'idle', since: 0, pending: 0 };
  function step(buttons, t) { // HOPPER's Pi class
    const n = buttons & COMBO; let r = buttons & ~COMBO;
    if (n === 0) { if (hold.state === 'waiting') r |= hold.pending; hold.state = 'idle'; hold.pending = 0; }
    else if (n === COMBO || hold.state === 'combo') hold.state = 'combo';
    else if (hold.state === 'idle') { hold.state = 'waiting'; hold.since = t; hold.pending = n; }
    else if (hold.state === 'waiting' && t - hold.since < 120) hold.pending |= n;
    else { hold.state = 'through'; r |= n; }
    return r >>> 0;
  }
  const nonce = Math.random().toString(36).slice(2);
  const f = document.createElement('iframe');
  f.setAttribute('sandbox', 'allow-scripts'); f.setAttribute('allow', 'autoplay'); f.tabIndex = -1; f.style.pointerEvents = 'none';
  f.srcdoc = `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta http-equiv="Content-Security-Policy" content="script-src 'nonce-${nonce}' 'strict-dynamic' 'unsafe-eval'"><style>html, body { margin: 0; height: 100%; background: #000; overflow: hidden; } #game-canvas { display: block; width: 100%; height: 100%; object-fit: contain; }</style></head><body><canvas id="game-canvas" width="640" height="480"></canvas><script nonce="${nonce}" src="${location.origin}/jsgame-shim.js"><\/script></body></html>`;
  let port = null;
  addEventListener('message', (e) => {
    if (e.source !== f.contentWindow || e.data?.type !== 'hopper-jsgame-hello') return;
    const ch = new MessageChannel(); port = ch.port1;
    port.onmessage = (m) => { if (m.data?.type === 'keyboard' && !raw) { raw = true; held.clear(); console.log('HARNESS: cart reads raw keys'); port.postMessage({ type: 'focus', on: true }); } };
    f.contentWindow.postMessage({ type: 'hopper-jsgame-port' }, '*', [ch.port2]);
    port.postMessage({ type: 'init', base: location.origin + '/game/', entry: location.origin + '/game/main.js', save: [] });
  });
  document.getElementById('stage').append(f);
  window.__harness = { held, phones, get raw() { return raw; }, phone(i, btns) { phones[i] = btns ? { ...btns } : null; } };
  let last = '';
  (function tick(t) {
    requestAnimationFrame(tick);
    if (!port) return;
    const toPad = (b) => { const buttons = Array(17).fill(0); for (let i = 0; i < 17; i++) if (b & (1 << i)) buttons[i] = 1; return { buttons, axes: [0, 0, 0, 0] }; };
    const pads = phones.map((p) => (p ? toPad(Object.keys(p).filter((k) => p[k]).reduce((a, k) => a | bit(k), 0)) : null));
    if (!raw && !pads[0]) { let b = 0; for (const c of held) b |= bit(KEYS[c]); pads[0] = toPad(step(b, t)); }
    const s = JSON.stringify(pads);
    if (s !== last) { last = s; port.postMessage({ type: 'pads', pads }); }
  })(0);
})();
