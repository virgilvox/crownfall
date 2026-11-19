# CROWNFALL handoff

Last updated 2026-11-19.

## Where things stand

- **Live:** https://hopper.games/cart/crownfall, public, version **1.0.4** (sha256 `0055842d38…`).
  Play link: https://hopper.games/play/crownfall
- **Source:** https://github.com/virgilvox/crownfall, branch `main`, commit `f99a3a1` plus this file.
- **Live check:** `node tools/hopper-live.mjs https://hopper.games/play/crownfall` passes 15/15 on 1.0.4 with 0 console
  errors. It covers textured avatars, the keyboard joining as P1, menus, WASD and arrows moving, Space jumping and
  Shift dashing.
- **Local check:** `node tools/hopper-live.mjs`, the stand-in player with a simulated phone, passes 16/16.

### Version history

| Version | What changed |
|---|---|
| 1.0.0 | First release. |
| 1.0.1 | Keyboard hint on the title screen. |
| 1.0.2 | Avatars textured on HOPPER instead of white. The game reads the keyboard itself (WASD/arrows, Space, Shift, L, T, Enter). |
| 1.0.3 | Avatars slimmed and gzipped: 31 MB down to 9.7 MB before the title. The loading bar counts bytes and shows MB. |
| 1.0.4 | The keyboard player is P1 when nothing else is connected (it was P2). |

## HOPPER player facts that shaped the code

Each of these was observed on the live player, not taken from documentation.

- **The CSP has no `blob:` in `connect-src`.** GLTFLoader's default ImageBitmapLoader `fetch()`es the blob URLs it
  makes for embedded textures, so every texture failed silently and the avatars rendered white.
  - Fix: `imgTextures` in `src/assets.js` swaps in `TextureLoader`, which decodes through `<img>`; `img-src` allows
    `blob:`.
  - Never `fetch()` a `blob:` URL in this cart.
- **Raw keys once the cart listens.** As soon as the cart adds a `keydown`/`keyup` listener, the shim tells the host
  `{type:'keyboard'}`.
  - The host then forwards raw key events and stops sending its own keyboard pad (arrows plus Z/X/A/S).
  - `src/input.js` reads the keys itself and presents them as pad index 8 (`KB_INDEX`).
- **An idle seat-1 pad stays in the gamepad list.** When the lobby is started from the keyboard, HOPPER gives the
  keyboard seat 1. After the cart switches to raw keys, `getGamepads()` still lists "HOPPER seat 1" with no input.
  - The keyboard therefore ignores pads nobody has pressed anything on (`PadState.used`) when choosing its seat.
  - A phone that joins after the keyboard gets the next free slot (`slotOf` in `src/menus.js`).
- **The CDN is slow and uncompressed.**
  - Cart files come from `cdn.hopper.games/hopper/public/files/<sha>/…` with no gzip, at roughly 100 KB/s to a few
    MB/s per file, varying from file to file.
  - The build therefore gzips the avatars and `anims.json`; the game unpacks them with `DecompressionStream`, or
    three's fflate where that's missing.
  - The build bakes exact file sizes (`__SIZES__`) into the bundle, so the loading bar starts out right.
  - First-boot download is about 9.7 MB plus `main.js`; arenas load their kits (≤1.6 MB each) when picked.
- **Frame quirks.** The game iframe is sandboxed srcdoc, with `pointer-events: none` and `tabIndex -1`.
  - Escape opens HOPPER's pause menu.
  - A START tap shorter than 120 ms only reaches the cart on key release, for one frame. The keyboard latch in
    `input.js` covers this.
- **The lobby menu remembers focus.** In automation, click START GAME at about (535, 200) rather than pressing Enter.

## Releasing a new version

1. `npm run build` writes `dist/` and `crownfall.jsgame`. It slims and gzips the avatars and fails on missing assets.
2. Test locally:
   - `USE_DIST=1 node tools/shot.mjs flow`: full flow, must report no console errors.
   - `node tools/hopper-live.mjs`: HOPPER stand-in, all checks pass.
   - `node tools/slow-load.mjs 250`: boot at 250 KB/s; the bar should move, and the title came up after about 43 s
     last time.
3. Upload with the HOPPER MCP tools:
   1. `shasum -a 256` and `wc -c` the cart.
   2. `start_cart_upload`, run the curl PUT it returns, then `finish_upload`.
   3. `get_ingest_report` until it passes.
   4. `prepare_version` with `gameId 01a1ee40-89a5-7596-8991-5c19b12a44a4`, the next semver, `license MIT`,
      `native 1280x720`, `par 1`.
4. **The owner confirms the version via the link**; never confirm it yourself.
5. After the owner confirms, run `node tools/hopper-live.mjs https://hopper.games/play/crownfall`.

## Tools added for HOPPER

| File | Does |
|---|---|
| `tools/hopper-harness/` | Local stand-in for HOPPER's player, built on HOPPER's shipped `jsgame-shim.js`. It reproduces the CSP, the sandboxed frame, pad posting, the START hold, the raw-key switch and the idle seat-1 pad, plus `window.__harness.phone(i, btns)` for fake phones. |
| `tools/hopper-live.mjs [url]` | Plays the game with real, trusted key presses. With no URL it runs the local stand-in; given the live URL it tests the real cart. |
| `tools/slow-load.mjs [KB/s]` | Throttled boot in the stand-in, with loading-bar screenshots in `shots/`. |
| `tools/slim-vrm.mjs` | Removes unused VRM 0.x blendshape groups and morph targets, and compacts the binary. Expressions kept: blink, joy, angry, sorrow, Surprised. |

## Open items

- **Original mascots.** The user asked where the characters from the virgilvox/sonic-at-high-school-3d repo went. They
  were left out because they are SEGA's characters, and original mascot characters were offered instead. The user
  hasn't picked a direction yet.
- **Faster first load (optional).** Slower connections still take about 40 s to the title. Options:
  - Load only the avatars on screen first and stream the rest.
  - Quantize meshes (`KHR_mesh_quantization`).
  - Gzip the arena kits.
- **Phone + keyboard on the live site.** This was checked only in the stand-in; the live test is keyboard only. Worth a
  real couch test with a phone joining after the keyboard.
- **Source avatars are unslimmed.** `assets/chars/` keeps the full source VRMs; only the build output is slimmed, so the
  dev server (`--dev`) still loads the big files.
