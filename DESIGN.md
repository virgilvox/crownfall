# CROWNFALL — design doc

A 1 to 4 player couch brawler for HOPPER (hopper.games): one crown, five floating arenas, everybody wants it.
Grab the crown, keep it on your head, and the seconds you wear it are your score. Everyone else is trying to
dash into you, slam down on you, or knock you off the edge so the crown pops loose. Rounds are 90 seconds,
loud, and readable from across a room on a TV with phones as controllers.

## Platform contract (HOPPER jsgame) — hard rules

- Ships as a `.jsgame` (a zip of `dist/`). Entry is `dist/main.js` (named by `dist/package.json` "main").
  It runs as an ES module in a sandboxed iframe with an opaque origin (`sandbox="allow-scripts"`).
- Draw ONLY on `document.getElementById('game-canvas')`. Set `canvas.width = 1280; canvas.height = 720;` at the
  TOP LEVEL of the entry module (before any await). The player scales it to fit.
- There is only one canvas, so the HUD/menus must be rendered inside WebGL: draw them into an offscreen
  2D canvas (`document.createElement('canvas')`, never attached to the DOM) and show it as a CanvasTexture on a
  full screen quad with an orthographic camera rendered after the 3D scene (autoClear off for the 2nd pass).
- Input: ONLY `navigator.getGamepads()`. One pad per seat, W3C standard mapping. Pressed = value >= 0.5.
  buttons 0 A, 1 B, 2 X, 3 Y, 4 L, 5 R, 6 LT, 7 RT, 8 SELECT, 9 START, 12 up 13 down 14 left 15 right;
  axes 0/1 left stick (y positive down). Handle any slot index (pads array may have holes). Use edge detection.
- NEVER add keyboard or mouse listeners in the game code (on HOPPER a cart that listens for keys loses the
  keyboard→pad mapping). The local preview page (`dist/index.html`, dev only) provides a keyboard → fake gamepad
  shim by overriding `navigator.getGamepads` BEFORE importing main.js. Keyboard shim: P1 arrows + Z(A) X(B) A(X)
  S(Y) Enter(START); P2 WASD... use IJKL + U(A) O(B) Y(X) H(Y) RightShift... keep it simple: P1 required, P2 nice.
- Never use SELECT+START for anything (HOPPER pause menu). START or A must start the game from ANY pad.
- Drive everything from `requestAnimationFrame` (pause holds rAF). No setInterval game logic. Clamp dt to 1/20.
- Assets: fetch by RELATIVE paths (`assets/...`). No other hosts, no CDNs. three.js etc. are bundled by esbuild.
- No IndexedDB, cookies, workers from blobs, WebRTC. `localStorage` is OK (wrap in try/catch) — use it for stats.
- Audio: WebAudio. The context may start suspended; call `ctx.resume()` whenever a pad button is pressed.
  The game must be fine if the first seconds are silent.
- Seats: 1..4. Pad ids look like `HOPPER seat 1 (STANDARD GAMEPAD)`.

## Controls (Xbox-layout phone pad, buttons by position)

| input | action |
|---|---|
| Left stick / d-pad | run (analog speed), menu navigation |
| A | JUMP (double jump in air; coyote time 0.1s, jump buffer 0.12s) |
| X | DASH — burst forward ~7m over 0.22s, 1.0s cooldown, also usable in air once. Hitting a player = knockback + 0.6s stun; if they wear the crown it pops off |
| B | SLAM — in air: dive straight down fast; landing makes a shockwave (radius 2.6m) that knocks back and stuns nearby players and pops the crown. On the ground: a short shove (Punch_Cross), small knockback |
| Y | TAUNT — plays Dance_Loop / Yes briefly (pure fun; cancelable) |
| START | menus: confirm / start match |

Labels (hopper block): A "JUMP", B "SLAM", X "DASH", Y "TAUNT", START "START".

## Game flow

1. **Boot / loading** — progress bar drawn on the HUD canvas while VRMs, anims and arena kits load. Load the
   menu stage + all 9 characters first, arenas lazily (cache them).
2. **Title** — big CROWNFALL lockup (drawn in 2D canvas: chunky gold display type with dark outline + shadow;
   use a bold system font stack like `"Arial Black", Impact, sans-serif` — no web fonts), a slowly spinning 3D
   crown, the 9 characters idling/dancing on the menu stage (Kenney mini-arena kit: floor, columns, banners,
   statues, trophy). "PRESS A TO PLAY". If nobody touches anything for 25s, run an ATTRACT demo match with 4 bots.
3. **Character select** — each connected pad presses A to join its seat (P1..P4 colors: P1 #ff4d6d red, P2 #4dabff
   blue, P3 #ffd23f yellow, P4 #5ef38c green). Left/right cycles the 9 characters (two players may pick the same one;
   then tint the second one's player ring/outline). A = ready, B = un-ready/leave. Characters stand on 4 pedestals
   and do Yes/Dance when picked. Empty seats are filled by bots ("CPU" — toggle number of CPUs with Y on P1, 0..3,
   default fill to 4). When all joined humans are ready, P1 (or any ready player) presses START/A → arena pick.
   With 1 human and 0 CPUs, still allow (practice).
4. **Cup select** — "GRAND CUP" (3 rounds: random 3 different arenas) or pick one arena (5 cards). Left/right + A.
5. **Round** — intro fly-over camera (2s) showing arena name card, then 3-2-1-GO countdown (characters in place on
   spawn points), 90s round. Crown appears on its dais 1s after GO with a beam of light.
6. **Round results** — slow-mo on the final second, "TIME!", then a scoreboard: crown seconds per player, placement
   points (1st 5, 2nd 3, 3rd 2, 4th 1). Next round or final.
7. **Podium** — Kenney mini-arena stage, 1st/2nd/3rd on podium blocks; winner wears the crown and plays Dance_Loop,
   others Yes / Idle_FoldArms_Loop / Hit_Head (sulking). Confetti. Stats saved to localStorage
   (`crownfall.stats`: wins per character, best crown time). "A: REMATCH  B: CHARACTER SELECT".

## Core rules

- **Crown**: one crown (build it procedurally: gold torus band + 5 cone spikes with small ruby/emerald spheres,
  MeshStandardMaterial metalness 1, emissive gold glow, plus a soft point light). Walk into it to grab. While worn:
  attached above the head bone, +1 point per second (shown as decimal seconds), wearer moves at 92% speed and their
  dash cooldown is 1.6s. A gold sparkle trail follows the wearer. When knocked loose it flies in an arc (random
  horizontal dir + up), bounces once, and lands; the player who lost it can't regrab for 1.0s. If it falls off the
  arena it respawns on the dais after 2s.
- **Fall out**: below y = -12 → "RING OUT" puff, respawn after 1.5s dropping in from above a random safe spawn with
  2s invulnerability (flicker). Losing the crown this way also drops it (respawns on dais).
- **Knockback**: velocity impulse away from the attacker + up; stunned players play Hit_Knockback and can't act.
  Being hit twice in 1.5s increases knockback by 30% (combo feel). Mega players hit 1.6x harder and receive 0.5x.
- **Frenzy**: last 15 seconds the crown scores 2x, music switches to the "chase" track, the HUD timer pulses red,
  announcer banner "CROWN FRENZY!".
- **Power-ups**: every ~10-14s a floating gem spawns at a random pickup point (use KayKit `Coin_A/B/C` or Kenney
  `coin.glb`, tinted, spinning, bobbing, with a colored glow). Grab it for:
  - SPEED (cyan) — 1.5x run speed + dash cooldown halved, 6s, speed lines
  - SHIELD (blue) — a translucent bubble that blocks the next hit or slam (pops with a sound), 10s
  - MEGA (red) — scale 1.45x, hits harder, heavier (less knockback), 7s
  - FEATHER (white) — gravity 0.5x + one extra air jump, 7s
  Show the active power-up as an icon + draining bar under the player's HUD card.

## Physics (custom, no physics library)

- Characters are vertical capsules (radius 0.35, height 1.6). Arena collision = a list of axis-aligned or
  rotated boxes + cylinders authored per arena (the "collision layout") — NOT the render meshes. Render meshes are
  placed to match the collision layout. Keep it simple and robust: ground check by sampling the highest walkable
  top under the capsule; push out of walls on XZ.
- Gravity 26 m/s², jump velocity 10, double jump 9, max run 7 m/s, accel 45, air accel 20, friction high on
  ground. Slam dive speed -28.
- Player vs player: soft push apart so they don't overlap.
- Moving / crumbling platforms carry players standing on them.

## Arenas (5) — each a compact floating island that fits one shared camera; each has one signature hazard

Use the environment kits in `assets/env/` (all CC0, see CREDITS.md). Every arena should look *dressed*: kit
pieces for the structure plus plenty of props, a sky background (gradient sky sphere or scene.background +
fog), and lighting that fits the mood. Scale kit pieces as needed (Kenney pieces are 1 unit tiles; KayKit
pieces are ~2 units). Check each model's bounding box at load time and normalize.

1. **SKY GARDEN** (day, bright blue sky, puffy clouds) — Kenney platformer kit (`kenney-platformer`:
   platform-grass-large-round as the central island, platform/platform-medium/platform-large as surrounding islands,
   flag, grass, cloud.glb drifting below), Kenney FPS kit grass/platform pieces, KayKit hex tiles
   (`kenney-hex`: hex_forest/hex_rock + detail_forestA, mountain) as distant floating islands for depth.
   Hazard: **crumbling platforms** — `platform-falling.glb` tiles shake 0.8s after someone stands on them, fall, and
   respawn 5s later.
2. **NEON ROOFTOPS** (dusk → magenta/teal sky, city lights) — KayKit City Builder `building_*_withoutBase`
   rooftops of different heights packed close together (jumpable gaps), watertower, streetlight, trafficlight, a
   bench, boxes and trash as props on the roofs; far below a street with roads (KayKit road_* + Kenney city builder
   road pieces) and cars (KayKit car_* and Kenney racing vehicle-truck-*) driving along it. Hazard: **wind gusts** —
   a warning arrow + streak particles, then 2.5s of sideways push.
3. **PUMPKIN HOLLOW** (night, big moon, fog, orange lantern light) — KayKit Halloween: floor_dirt tiles island,
   crypt as the central raised dais (the crown spawns on it), graves, gravestones, fences (with gaps), dead trees,
   pine trees, lanterns (with real point lights), candles, jack-o-lanterns, arch_gate. Hazard: **rolling pumpkins**
   — giant `pumpkin_orange_jackolantern` (scaled 3x) roll across the island on a lane telegraphed by a glowing line
   1s before; hit = big knockback.
4. **ORBIT STATION** (space: black-blue starfield, a big ringed planet made procedurally, sun rim light) — KayKit
   Space Base: landingpad_large center, landingpad_small satellites, terrain_* pieces, basemodule_* and
   cargodepot as walls/cover, solarpanel, windturbine, lander, spacetruck, rocks. **Low gravity (0.6x)** all round.
   Hazard: **meteor showers** — shadows/target rings appear, 1.2s later a `rock_A`/`rock_B` slams down with a
   shockwave.
5. **KITCHEN CHAOS** (warm interior light — characters are tiny: scale the KayKit Restaurant kit up ~4x so counters
   are platforms) — kitchentable / kitchencounter pieces as platforms, crates of food as steps, stoves, pots, pans,
   giant food props (burger, cheese, tomatoes), plates. Floor is "lava"... i.e. the kitchen floor far below is the
   ring-out zone. Hazard: **hot stoves** — stove tops glow orange then red; standing on a red stove = launch up + stun.

Bonus kits for set dressing anywhere they fit: `kaykit-prototype` (barrels, crates, targets, pallets),
`kenney-racing` (tents, forest decorations), `kenney-city` (buildings for distant skylines), `kenney-arena`
(menu/podium stage).

## Characters (9 CC0 VRoid avatars in `assets/chars/`)

Load with GLTFLoader + `VRMLoaderPlugin` from `@pixiv/three-vrm`; `VRMUtils.rotateVRM0(vrm)`,
`VRMUtils.removeUnnecessaryVertices`, `VRMUtils.combineSkeletons` if available. Normalize every model to ~1.6m tall.
Call `vrm.update(dt)` every frame AFTER the mixer (spring bones make hair/skirts bounce — keep them).
Animations: `assets/anims.json` holds baked CC0 Quaternius clips for VRM normalized rigs. `src/anims.js`
(`decodeAnimData`, `buildClips`) turns them into THREE.AnimationClips for one VRM — this works, reuse it.
`reference/character.loveStory.js` shows how the previous project measured hipsH, crossfaded layers, etc.
Useful clips: Idle_Loop, Jog_Fwd_Loop, Sprint_Loop, Jump_Start, Jump_Loop, Jump_Land, NinjaJump_Start,
NinjaJump_Idle_Loop (double jump flip-ish), Roll, Shield_Dash or Sword_Dash (dash), Punch_Cross / Punch_Jab (shove),
Hit_Knockback, Hit_Chest, Death01, Dance_Loop, Yes, Idle_FoldArms_Loop, Hit_Head, Slide_Loop, Swim_Idle_Loop (falling
flail), Walk_Carry_Loop.

Give each avatar an ORIGINAL name, a one-line flavor title and a signature color (shown on select). Look at each
model (render a quick screenshot of all 9) and assign names that fit their look, e.g. "NOVA — Skyline Sprinter".
Do not use any existing franchise names.

## Bots

State machine per bot: GO_CROWN (crown loose) → path to it; HUNT (someone else wears it) → chase the wearer, dash
when within 5m and facing, slam when above them; HOLD (wearing it) → run away from the nearest threat while staying
away from edges; GRAB_POWERUP when one is close. Edge safety: never run toward a spot with no ground under it unless
jumping a known gap (author jump links per arena or sample ground ahead and jump when it ends and ground exists
further along). Add small reaction delays and aim error so humans win sometimes.

## Camera

One shared camera: perspective, fov ~40, looking down ~50°, framing the bounding box of all living players + crown,
smoothly damped zoom (min/max distance per arena), slight shake on slams/hits. Intro fly-around per arena.

## Juice (make it feel GREAT)

Hitstop (60ms freeze) on hits, screen shake, dust puffs on land/jump (Kenney `dust.glb` or sprites), speed lines,
shockwave rings on slam, crown sparkles, confetti, player-colored ring under each character + floating "P1" arrow
tag above head, big bold banners ("GO!", "CROWN FRENZY!", "RING OUT!", "STOLEN!"), countdown beeps, crowd cheer
when the crown is stolen. Toon-ish look: MeshToonMaterial or keep kit materials with good lighting; ACES tone
mapping, sRGB output, soft shadows from one directional light (shadow map 2048, tight frustum around the arena).

## Audio

Music (Kevin MacLeod, CC-BY 4.0 — credited): `assets/music/title.mp3` (title/select), `happy.mp3`, `action.mp3`,
`epic.mp3`, `tense.mp3`, `sneaky.mp3` (per-arena round music), `chase.mp3` (frenzy). Loop with gain fades.
SFX: synthesize with WebAudio (jump boing, dash whoosh noise burst, hit thump, slam boom, crown ding/chime, steal
jingle, power-up arpeggio, countdown beeps, shield pop, ring-out whistle). `assets/sfx/amb-crowd.mp3` and
`laugh-crowd.mp3` (CC0) can be used for crowd cheers.

## HUD

Bottom of the screen: 4 player cards (portrait color block, character name, crown seconds big, power-up icon).
Top center: round timer (big), arena name small. Crown wearer's card glows gold. Offscreen indicator arrow for any
player outside the view. Font: bold system stack; heavy outlines so it reads on a TV.

## Build / layout

- `src/` game source (ES modules). `tools/build.mjs`: esbuild bundle `src/main.js` → `dist/main.js` (format esm,
  minify, target es2020), copy ONLY the assets actually referenced (scan for asset paths used by arena definitions;
  copy their .bin and texture dependencies too) into `dist/assets/`, write `dist/package.json` with
  `{"name":"crownfall","main":"main.js","hopper":{...}}`, copy `src/index.html` (dev preview with keyboard shim and a
  `<canvas id="game-canvas">`) to `dist/index.html`, and zip `dist/` contents (files at zip root) to
  `crownfall.jsgame`.
- `tools/serve.mjs`: static server for dist on localhost:8080.
- `tools/shot.mjs`: puppeteer-core with `/Applications/Google Chrome.app/Contents/MacOS/Google Chrome` (use
  `--use-angle=metal` or default GPU flags, `--autoplay-policy=no-user-gesture-required`) loads the dev page,
  drives the fake gamepads via `window.__pads` (the shim exposes a way to set button/axis state), and saves
  screenshots of: title, character select, each arena mid-round, results, podium. Must also capture console
  errors and fail loudly on any.
- Dev-only URL params (read via `location.search`, harmless on HOPPER): `?arena=<id>&bots=4&skip=1` jumps straight
  into a round with 4 bots for testing; `?seed=`.
