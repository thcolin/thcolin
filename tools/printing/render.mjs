// Renders the top-fan and nas loops from their STLs, headless.
// Usage: node render.mjs [--color '#d9d9d9'] [--only top-fan|nas] [--quality 80]
// Placed STLs come from scad/export.sh (run it first if stl/ is empty).
import { createRequire } from 'node:module'
import { execFileSync } from 'node:child_process'
import { mkdirSync, readFileSync, rmSync, existsSync } from 'node:fs'
import { dirname, join, extname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { parseArgs } from 'node:util'
// The thcol.in checkout next to this repository, or THCOL_IN
const THCOL_IN = process.env.THCOL_IN ?? new URL('../../../thcol.in', import.meta.url).pathname

const require = createRequire(`${THCOL_IN}/package.json`)
const { chromium } = require('playwright')
const THREE_DIR = `${THCOL_IN}/node_modules/three`
const HERE = dirname(fileURLToPath(import.meta.url))

const { values: args } = parseArgs({
  options: {
    color: { type: 'string', default: '#d9d9d9' },
    only: { type: 'string' },
    quality: { type: 'string', default: '80' },
  },
})
if (!/^#[0-9a-f]{6}$/i.test(args.color)) throw new Error(`--color must be #rrggbb, got ${args.color}`)

const FPS = 20
const SECONDS = 8
const FRAMES = FPS * SECONDS
const TIMELINE = { explode: [0.16, 0.4], collapse: [0.62, 0.86] }
const HARDWARE = '#2a2c30'

// top-fan, main.scad exploded(): e = 55, guards +2e, frame +e, fans -e, clamps down to -2.4e.
// The four corners also part a little so the four quadrants read as four prints.
const corners = [[1, 1], [-1, 1], [-1, -1], [1, -1]]
const R = 16
const TOP_FAN = [
  ...corners.map(([x, y], i) => ({ file: `guard${i}`, offset: [x * R, y * R, 110], delay: 0 })),
  ...corners.map(([x, y], i) => ({ file: `quadrant${i}`, offset: [x * R, y * R, 55], delay: 0.08 })),
  ...corners.map(([x, y], i) => ({ file: `fan${i}`, offset: [x * R, y * R, -55], hardware: true, delay: 0.16 })),
  { file: 'clamps', offset: [0, 0, -124], delay: 0.25 },
]

// nas, main.scad assembly(exp): halves ±exp in X, fan wall +2exp in Y (segments ±exp/2), PSU tray +3exp in Y
const EXP = 60
const NAS = [
  { file: 'half_l', offset: [-EXP, 0, 0], delay: 0 },
  { file: 'half_r', offset: [EXP, 0, 0], delay: 0 },
  { file: 'fan_wall_l', offset: [-EXP / 2, 2 * EXP, 0], delay: 0.1 },
  { file: 'fan_wall_r', offset: [EXP / 2, 2 * EXP, 0], delay: 0.1 },
  { file: 'fans', offset: [0, 2 * EXP, 0], hardware: true, delay: 0.1 },
  { file: 'psu_tray_l', offset: [0, 3 * EXP, 0], delay: 0.2 },
  { file: 'psu_tray_r', offset: [0, 3 * EXP, 0], delay: 0.2 },
]

const PIECES = {
  // 4-fold symmetric: a quarter turn per loop is a seamless turntable
  'top-fan': { parts: TOP_FAN, elevation: 34, azimuth: 30, turn: 90 },
  // Not symmetric: a ±35° sway around the three-quarter view, sine-eased, back to its start each loop
  nas: { parts: NAS, elevation: 26, azimuth: -38, sway: 35, fit: { assembled: 0.85, all: 0.97 } },
}

const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.stl': 'model/stl' }
const browser = await chromium.launch({ args: ['--use-angle=metal', '--enable-gpu', '--ignore-gpu-blocklist'] })

for (const [piece, config] of Object.entries(PIECES)) {
  if (args.only && args.only !== piece) continue
  const page = await browser.newPage({ viewport: { width: 640, height: 640 }, deviceScaleFactor: 1 })
  page.on('console', (m) => m.type() === 'error' && console.error(piece, m.text()))
  page.on('pageerror', (e) => console.error(piece, e))
  await page.route('http://render.local/**', (route) => {
    const path = new URL(route.request().url()).pathname
    const file = path.startsWith('/three/') ? join(THREE_DIR, path.slice(7)) : join(HERE, path)
    if (!existsSync(file)) return route.fulfill({ status: 404 })
    route.fulfill({ body: readFileSync(file), contentType: TYPES[extname(file)] || 'application/octet-stream' })
  })
  await page.goto('http://render.local/page.html')
  await page.waitForFunction(() => window.ready)
  await page.evaluate((options) => window.setup(options), { piece, ...config, color: args.color, hardware: HARDWARE, frames: FRAMES, timeline: TIMELINE })

  const dir = join(HERE, `frames-${piece}`)
  rmSync(dir, { recursive: true, force: true })
  mkdirSync(dir)
  const canvas = page.locator('canvas')
  const files = []
  for (let f = 0; f < FRAMES; f++) {
    await page.evaluate((u) => window.renderAt(u), f / FRAMES)
    const file = join(dir, `${String(f).padStart(3, '0')}.png`)
    await canvas.screenshot({ path: file })
    files.push(file)
  }
  await page.close()

  const out = join(HERE, `${piece}.webp`)
  execFileSync('img2webp', ['-loop', '0', '-lossy', '-q', args.quality, '-m', '6', '-d', String(1000 / FPS), ...files, '-o', out])
  console.log(piece, `${(readFileSync(out).length / 1e6).toFixed(2)} MB`)
}
await browser.close()

// Contact sheet: 8 key frames per piece, one row each
const keys = Array.from({ length: 8 }, (_, i) => Math.round((i * FRAMES) / 8))
const rows = Object.keys(PIECES).filter((p) => existsSync(join(HERE, `frames-${p}`)))
execFileSync('magick', [
  ...rows.flatMap((p) => ['(', ...keys.map((k) => join(HERE, `frames-${p}`, `${String(k).padStart(3, '0')}.png`)), '-resize', '320x320', '+append', ')']),
  '-append', join(HERE, 'sheet.png'),
])
console.log('sheet.png, frames', keys.join(' '))
