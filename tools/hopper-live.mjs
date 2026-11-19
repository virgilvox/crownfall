// Plays CROWNFALL with a real (trusted) keyboard the way a person at a laptop would, inside HOPPER's player, and
// checks what the game sees. Default target is the local stand-in for HOPPER's player (tools/hopper-harness/), which
// also adds a stand-in phone on seat 1 to check the keyboard and a phone can share a game.
//   node tools/hopper-live.mjs                                     # local stand-in (serves dist/)
//   node tools/hopper-live.mjs https://hopper.games/play/crownfall # the live cart (keyboard only)
import puppeteer from 'puppeteer-core';
import fs from 'node:fs';
import { serveHarness } from './hopper-harness/serve.mjs';

const URL_ = process.argv[2] || 'http://localhost:8090/';
const LOCAL = /localhost:8090/.test(URL_);
const srv = LOCAL ? await serveHarness(8090) : null;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
fs.mkdirSync('shots', { recursive: true });
const browser = await puppeteer.launch({
  executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', headless: false,
  args: ['--autoplay-policy=no-user-gesture-required', '--window-size=1400,850'], defaultViewport: { width: 1380, height: 760 },
});
const page = await browser.newPage();
let texFail = 0, errors = 0;
page.on('console', (m) => {
  const t = m.text();
  if (/texture|blob:/i.test(t) && /fail|couldn't|cannot|refused|violates/i.test(t)) { texFail++; return; }
  if (/CLASP/.test(t)) return;
  if (m.type() === 'error') errors++;
  console.log(`[${m.type()}]`, t.slice(0, 200));
});
page.on('response', (r) => { if (r.status() >= 400) console.log('[http]', r.status(), r.url().slice(0, 150)); });
page.on('pageerror', (e) => { errors++; console.log('[pageerror]', e.message); });
await page.goto(URL_, { waitUntil: 'networkidle2' });
await sleep(2500);

const results = [];
const check = (name, ok, info = '') => { results.push({ name, ok }); console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${info ? '  ' + info : ''}`); };
const snap = (n) => page.screenshot({ path: `shots/live-${n}.png` });
const gameFrame = async () => { for (const f of page.frames()) { try { if (await f.evaluate('!!window.__game')) return f; } catch {} } return null; };
const tap = async (k, ms = 60) => { await page.keyboard.down(k); await sleep(ms); await page.keyboard.up(k); await sleep(200); };
const phone = (i, btns) => LOCAL && page.evaluate((i, b) => window.__harness.phone(i, b), i, btns);
const phoneTap = async (i, b) => { await phone(i, { [b]: true }); await sleep(120); await phone(i, {}); await sleep(200); };
const state = (f) => f.evaluate((KB) => {
  const m = window.__menus, r = m?.round;
  const me = r?.fighters?.find((x) => !x.isBot && x.def.padIndex === KB);
  let mats = 0, untextured = 0;
  (r?.arena?.scene || m?.stage?.scene)?.traverse((o) => { if (o.isSkinnedMesh) for (const mt of [].concat(o.material)) { mats++; if (!mt.map && !mt.uniforms?.map?.value) untextured++; } });
  return {
    mode: m?.mode,
    slots: m?.slots?.map((s) => (s.joined ? `${s.pad === KB ? 'kb' : 'pad' + s.pad}${s.ready ? '*' : ''}` : '-')).join(' '),
    me: me ? { dead: me.dead, sx: me.stick?.x, x: me.pos.x, z: me.pos.z, vy: me.vel.y, dashT: me.dashT, dashCd: me.dashCd, stun: me.stun, grounded: me.grounded, phase: r.phase } : null,
    fighters: r?.fighters?.map((x) => (x.isBot ? 'bot' : x.def.padIndex === KB ? 'kb' : 'pad' + x.def.padIndex)).join(' '),
    white: { mats, untextured },
  };
}, 8);

if (LOCAL) await page.mouse.click(400, 400);   // clicking the game must not steal the keyboard
else await page.mouse.click(535, 200);         // HOPPER lobby: START GAME (keyboard-started, so the keyboard is P1)
let f = null;
for (let i = 0; i < 90 && !f; i++) { await sleep(1000); f = await gameFrame(); }
if (!f) { console.log('no game frame'); await snap('noframe'); process.exit(1); }
for (let i = 0; i < 120; i++) { const s = await state(f).catch(() => null); if (s?.mode === 'title') break; await sleep(1000); }
await sleep(1500);
let s = await state(f);
check('avatars are textured', s.white.mats > 0 && s.white.untextured === 0, JSON.stringify(s.white));
await snap('1-title');

// the title starts its attract demo after 25 s idle; a press drops back to the title
for (let i = 0; i < 5 && (await f.evaluate('!!window.__menus.attract || window.__menus.mode !== "title"')); i++) { await tap('KeyT'); await sleep(1500); }
await tap('Space', 30);                    // a very short tap
s = await state(f); check('Space (30 ms tap) on title opens select, keyboard joins', s.mode === 'select' && /kb/.test(s.slots), s.slots);
check('keyboard is P1 even though HOPPER still lists an idle seat-1 pad', /^kb/.test(s.slots), s.slots);
await tap('KeyD'); await tap('KeyA');
if (LOCAL) {
  await phoneTap(0, 'A');                  // a phone on seat 1 joins while the keyboard sits there
  s = await state(f); check('phone on seat 1 joins its own slot next to the keyboard', /kb/.test(s.slots) && /pad0/.test(s.slots), s.slots);
  await phoneTap(0, 'A');
}
await tap('Space');
s = await state(f); check('keyboard readies', /kb\*/.test(s.slots), s.slots);
await snap('2-select');
await tap('Enter', 30);
s = await state(f); check('Enter (30 ms tap) continues to arena select', s.mode === 'cup', s.mode);
await tap('ArrowRight'); await tap('Space');
for (let i = 0; i < 80; i++) { s = await state(f); if (s.me && s.me.phase === 'play') break; await sleep(250); }
await sleep(400);
s = await state(f); check('round has the keyboard player', !!s.me, s.fighters);
if (s.me) {
  await snap('3-round');
  for (const [k, ax, sign] of [['KeyD', 'x', 1], ['KeyA', 'x', -1], ['KeyW', 'z', -1], ['KeyS', 'z', 1], ['ArrowRight', 'x', 1], ['ArrowLeft', 'x', -1]]) {
    // a bot's shove, a stun or a respawn can eat one attempt, so wait until free and allow a retry
    let d = 0, a, b, held;
    for (let attempt = 0; attempt < 3 && d * sign <= 0.8; attempt++) {
      for (let i = 0; i < 30; i++) { const m = (await state(f)).me; if (!m.dead && m.stun <= 0 && m.grounded) break; await sleep(100); }
      a = (await state(f)).me; await page.keyboard.down(k); await sleep(250); held = await f.evaluate((KB) => { const p = window.__game.input.pads.get(KB); return p ? [p.x, p.y].map((v) => +v.toFixed(2)) : null; }, 8); await sleep(250); await page.keyboard.up(k); b = (await state(f)).me;
      d = b[ax] - a[ax];
    }
    check(`hold ${k} moves ${sign > 0 ? '+' : '-'}${ax}`, d * sign > 0.8, `moved ${d.toFixed(2)} from (${a.x.toFixed(1)}, ${a.z.toFixed(1)}) pad axes ${held} stun ${b.stun.toFixed(2)} dead ${b.dead}`);
    await sleep(500);
  }
  for (let i = 0; i < 20 && !(await state(f)).me.grounded; i++) await sleep(100);
  await page.keyboard.down('Space'); await sleep(25); await page.keyboard.up('Space'); await sleep(60);
  s = await state(f); check('Space (25 ms tap) jumps', s.me.vy > 1 || !s.me.grounded, `vy ${s.me.vy.toFixed(2)}`);
  await sleep(900);
  let dashed = false, why = '';
  for (let attempt = 0; attempt < 3 && !dashed; attempt++) {
    for (let i = 0; i < 30; i++) { const m = (await state(f)).me; if (m.grounded && m.stun <= 0 && m.dashCd <= 0) break; await sleep(100); }
    await page.keyboard.down('ShiftLeft'); await sleep(30); await page.keyboard.up('ShiftLeft');
    for (let i = 0; i < 6 && !dashed; i++) { const m = (await state(f)).me; dashed = m.dashT > 0 || m.dashCd > 0; why = `dashT ${m.dashT.toFixed(2)} cd ${m.dashCd.toFixed(2)} stun ${m.stun.toFixed(2)}`; await sleep(40); }
  }
  check('Shift tap dashes', dashed, why);
  await snap('4-after');
}
check('avatars stayed textured', texFail === 0, `${texFail} texture load failures`);
console.log(`\n${results.filter((r) => r.ok).length}/${results.length} passed, ${errors} console errors`);
await browser.close(); srv?.close();
process.exit(results.every((r) => r.ok) ? 0 : 1);
