# CROWNFALL

A 1 to 4 player couch brawler for [HOPPER](https://hopper.games). One crown, five floating arenas, everybody wants it.
Grab the crown, keep it on your head, and every second you wear it is score. Everyone else is trying to dash into you,
slam down on you, or knock you off the edge so the crown pops loose. Rounds are 90 seconds; the last 15 are CROWN FRENZY
(crown scores double). Empty seats are filled by CPU fighters.

- 9 playable avatars (original names and titles), 5 arenas, Grand Cup (3 random arenas) or a single arena
- Power-ups: SPEED, SHIELD, MEGA, FEATHER
- Arena hazards: crumbling tiles (Sky Garden), wind gusts (Neon Rooftops), rolling jack-o-lanterns (Pumpkin Hollow),
  meteor showers + low gravity (Orbit Station), hot stoves (Kitchen Chaos)
- Title attract mode (idle for 25 s), character select, results, podium, stats saved to `localStorage` (`crownfall.stats`)

## Controls (Xbox-layout phone pad)

| input | action |
|---|---|
| Left stick / d-pad | run, menu navigation |
| A | JUMP (double jump in the air) / confirm |
| X | DASH (hit a player = knockback + stun, knocks the crown loose) |
| B | SLAM (in air: dive + shockwave) / shove on the ground / back |
| Y | TAUNT / toggle CPU count on the select screen (first player) |
| START | start / confirm |

Input is read only from `navigator.getGamepads()`. The game code never listens to the keyboard or mouse; the dev preview
page (`src/index.html`) installs a keyboard-to-fake-gamepad shim: P1 arrows + Z(A) X(B) A(X) S(Y) Enter(START),
P2 IJKL + U(A) O(B) Y(X) H(Y) P(START). Add `?pads=4` to expose more seats.

## Build and run

```
npm install
npm run build        # dist/ + crownfall.jsgame (zip of dist contents)
npm run serve        # http://localhost:8080 serves dist/
```

`tools/build.mjs --dev` does a fast unminified bundle (the server falls back to `./assets`).

## Testing tools

All use headless Chrome (`/Applications/Google Chrome.app`) via puppeteer-core and fail on any console error.

- `node tools/shot.mjs flow` title -> select -> cup -> round -> results -> podium, screenshots in `shots/`
- `node tools/shot.mjs arenas [secs]` every arena mid-round (`?arena=<id>&bots=4&skip=1`)
- `node tools/shot.mjs one <arena> [secs] [bots] [extra query]`, also `perf`, `attract`, `select`, `frenzy`
- `USE_DIST=1 node tools/shot.mjs flow` runs against the built `dist/` with no asset fallback
- `node tools/sim.mjs [arena ...]` headless bot-vs-bot simulation (ring-outs, steals, scores); `node tools/controls.mjs` checks human controls
- `node tools/hazards.mjs` forces each arena hazard and screenshots it; `node tools/catalog.mjs <kit>` contact sheet of a model kit

Dev URL params: `?arena=garden|rooftops|hollow|orbit|kitchen&bots=0..4&humans=0..4&skip=1&dur=<seconds>&seed=<n>&idle=<seconds>`.

## Source layout

`src/main.js` boot + loop, `input.js`, `assets.js` (loaders, static prop batching), `character.js` (VRM actor + animation blending),
`physics.js` (capsules vs boxes/cylinders), `player.js` (fighters), `bots.js` + `nav.js`, `crown.js`, `powerups.js`, `round.js`,
`camera.js`, `hud.js`, `ui.js` (2D overlay), `menus.js`, `stage.js` (menu/podium plaza), `fx.js`, `audio.js`,
`arenas/*.js` (one per arena), `kits.js` (model kit tokens scanned by the build to decide which assets ship).

## Credits

See [CREDITS.md](CREDITS.md). Characters: VRoid sample avatars (CC0 / VRoid Hub terms); motion: Quaternius (CC0);
environments: Kenney and KayKit (CC0); music: Kevin MacLeod (CC BY 4.0); everything else is original.
