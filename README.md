# Velocity Run

Synthwave endless racer for the browser, now in real 3D (Three.js). Weave
through traffic at 300+ km/h, chain near-miss combos, charge the nitro and hold
the throttle for as long as you last. UI in Indonesian and English.

The game rules — speed curve, traffic, near-miss scoring, nitro, shield, the
crash window — are carried over unchanged from the original 2D canvas build.
Only the way the world is drawn is new: a real road mesh with hills and bends,
a neon city either side, lamp posts, palms and billboards, low-poly cars with
lit tail lights, a striped synth sun over a mountain horizon, and bloom.

## Run it

No build step is required. The folder is a self-contained static site (three.js
is vendored in `vendor/` and wired up with an import map), so any static file
server pointed at the project root works — `Buka Aplikasi Lokal.bat` does
exactly that with Python on port 8950.

```bash
npm run serve        # same thing via node, http://localhost:8950
```

Development with hot reload, and an optional minified production build:

```bash
npm install
npm run dev          # vite, http://localhost:8950
npm run build        # outputs dist/
npm run preview      # serves the build on http://localhost:8951
```

## Controls

| Input | Action |
| --- | --- |
| `←` `→` / `A` `D` | Steer |
| `Shift` / `↑` / `W` | Nitro |
| `↓` / `S` | Brake |
| `Space` / `Enter` | Start / retry |
| `P` / `Esc` | Pause |
| `M` | Mute |
| Drag (touch) | Steer; the round button is nitro |

## Graphics quality

Picked from the device at boot (`tinggi` / `sedang` / `rendah`), switchable
from the pause menu, and dropped one step automatically if the frame rate can't
hold up during a run. Profiles live in `src/config.js` (`QUALITY`).

## Layout

```
index.html            HUD, overlays, styles, import map, module entry
src/
  config.js           tuning: gameplay constants (unchanged), render scale, camera, palette, quality
  track.js            procedural track (segments with curve + height)
  game.js             rules + state machine
  input.js audio.js   keyboard/touch, Web Audio synth
  ui.js fx.js i18n.js DOM HUD, 2D overlay effects (sparks, pops, countdown), copy
  main.js             boot + loop + quality switching
  render/
    path.js           the visible window of track as a 3D curve; everything samples it
    road.js           road + ground meshes rebuilt from the path each frame
    sky.js            dome, sun, stars, mountain ridges (camera-following backdrop)
    city.js           instanced neon buildings
    props.js          lamp posts, palms, billboards
    vehicles.js       low-poly car/truck geometry and materials
    items.js          coins and pickups
    world.js          poses everything from game state; chase camera
    renderer.js       WebGL renderer + bloom
vendor/               three.module.js + the post-processing addons used
tests/e2e/            playthrough smoke test and screenshot capture (Playwright)
```

Two coordinate systems meet in `config.js`: gameplay runs in the original 2D
units; the renderer stretches the z axis (`Z_STRETCH`) and tames hills
(`Y_SCALE`) so the world reads well in perspective, and draws traffic slightly
ahead of its logical spot so bumpers touch exactly when the crash triggers.

## Tests

```bash
npm run serve                 # in one terminal
npm run test:e2e              # boot, race, crash, game over, retry, pause, phone framing
npm run shots                 # writes review screenshots to tests/e2e/shots/
```

Both need Google Chrome installed (Playwright uses the `chrome` channel).
