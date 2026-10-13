# tools

The scripts that draw the README's images. All of them except `daily/` read the `thcol.in` checkout next to this
repository (`../thcol.in`, or `THCOL_IN`) for Playwright, three.js and the projects' assets.

| Image | Script | Needs |
|---|---|---|
| `images/daily.webp` | `daily/daily.mjs`, run every day by `.github/workflows/daily.yml` | nothing local: it reads thcol.in and beta.cinetropes.com online |
| `images/head.png`, `images/prompt-*.png` | `readme/render-readme.mjs head,prompt-about,prompt-projects,prompt-3d` | the mock served on port 8093 (below) |
| `images/retro.webp`, `sensorr.webp`, `printing.webp` | `readme/render-readme.mjs retro,sensorr,printing`, then `img2webp -lossy -q 70 -d 50` on each frame folder | the mock served on port 8093, with its media |

## The mock

`readme/tpl.html` is the README's column at 830 px, with `readme/head.inc` as its header. `render-readme.mjs` shoots
each row of `profile.html` (the template with `{{HEAD}}` replaced) from `http://localhost:8093/`, in a folder that also
holds the row's media under `img/`. The animated WebPs are decoded with `ImageDecoder` and drawn at an exact time.

The media come from these scripts:

| Media | Script | Needs |
|---|---|---|
| portrait | `head/lift.swift` (Vision cut-out), then `head/halftone.py` | a photo |
| teevy's screen | `teevy/teevy.mjs` | a production build of thcol.in served on port 8082 |
| teevy on the CRT | `teevy/render.mjs` with `teevy/crt.html` served on port 8091 | the dark mode of the Figma Community file « Retro CRT TV Mockup » exported in `teevy/dark/`, not in this repository |
| the meta-game on the Game Boy | `teevy/metagame.mjs` | the game online, beta.cinetropes.com/play |
| GMCA on the Switch | `apps/gmca.py` | thcol.in's `src/assets/gmca` |
| sensorr | `apps/sensorr.py` | thcol.in's `src/assets/sensorr` |
| sensorr wrapped | `apps/wrapped.mjs`, then `apps/wrapped.py` | thcol.in on port 8082 |
| top-fan, nas | `printing/render.mjs` with `printing/page.html` | `printing/stl/`, exported from the `3d-prints` OpenSCAD files, not in this repository |
