// teevy's screen, as the site renders it, zapped through four channels on a virtual clock
import { createRequire } from 'module'
import { mkdirSync, rmSync } from 'fs'
// The thcol.in checkout next to this repository, or THCOL_IN
const THCOL_IN = process.env.THCOL_IN ?? new URL('../../../thcol.in', import.meta.url).pathname
const require = createRequire(`${THCOL_IN}/package.json`)
const { chromium } = require('playwright')

const W = Number(process.env.W || 480)          // CSS width of the page; the screen is W x 3W/4
const OUT_W = 660                                // 2x for a 330 px display
const DSF = OUT_W / W
const FPS = Number(process.env.FPS || 25)
const STEP = 1000 / FPS
const OUT = process.env.OUT || 'frames-teevy'
// Each segment opens on the zap: the site's own snow (SNOW_MS = 320) then the channel
const SEGMENTS = (process.env.SEGMENTS || '14:6000,00:3600,09:10800,06:2400').split(',').map((s) => { const [ch, ms] = s.split(':'); return { ch, ms: Number(ms) } })

rmSync(OUT, { recursive: true, force: true }); mkdirSync(OUT, { recursive: true })
const browser = await chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] })
const page = await browser.newPage({ viewport: { width: W, height: Math.round(W * 0.75) + 200 }, deviceScaleFactor: DSF })
page.on('pageerror', (e) => console.log('pageerror', e.message))
// Seeded randomness: the face's blinks and glances come out the same on every run
await page.addInitScript(() => {
  let s = 7
  Math.random = () => { s = (s + 0x6D2B79F5) | 0; let t = Math.imul(s ^ (s >>> 15), 1 | s); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296 }
})
await page.clock.install({ time: new Date('2026-10-13T21:47:12') })
await page.goto('http://localhost:8082/#teevy', { waitUntil: 'networkidle' })
// The screen alone, at the CRT's 4:3; nothing else of the page over it
await page.addStyleTag({ content: '.teevy__stage{height:calc(100vw*3/4)!important} .teevy-prints,.teevy-osd{display:none!important} .teevy-prog__youtube{visibility:hidden}' })
await page.clock.pauseAt(new Date('2026-10-13T21:47:20'))
const band = page.locator('article.band.teevy')
await band.scrollIntoViewIfNeeded()
await page.evaluate(() => document.querySelector('.teevy__screen').scrollIntoView({ block: 'start' }))
await page.waitForTimeout(500)
await band.focus()

let vt = 0
const sync = () => page.evaluate((vt) => {
  for (const a of document.getAnimations()) {
    if (a.__t0 === undefined) a.__t0 = vt
    a.pause()
    a.currentTime = vt - a.__t0
  }
}, vt)
const tick = async (ms) => { await page.clock.runFor(ms); vt += ms; await page.waitForTimeout(25); await sync() }
const zap = async (ch) => { await page.keyboard.press(ch[0]); await page.keyboard.press(ch[1]) }
// Kanshi's own rail, "Machine": after its boot and Kyoto, the take goes to Tokyo then Akihabara, as a visitor would
const KANSHI = [[5100, 'TOKYO'], [7900, 'AKIHABARA']]
const machine = (name) => page.evaluate((name) => [...document.querySelectorAll('.kanshi__rail button')].find((b) => b.textContent.includes(name))?.click(), name)

// Warm-up: every channel once, so chunks, models and images are loaded before the take
for (const { ch } of SEGMENTS) { await zap(ch); for (let i = 0; i < 40; i++) await tick(100); await page.waitForTimeout(800) }
await zap('02'); for (let i = 0; i < 60; i++) await tick(100)

const box = await page.locator('.teevy__screen').boundingBox()
const clip = { x: box.x, y: box.y, width: W, height: Math.round(W * 0.75) }
console.log('clip', clip, 'dsf', DSF)
let n = 0
const marks = []
for (const { ch, ms } of SEGMENTS) {
  await zap(ch)
  await page.waitForTimeout(ch === '14' ? 1500 : 300) // real time for the model to be parsed; the virtual clock stands still
  await sync()
  marks.push({ ch, from: n / FPS })
  const frames = Math.round(ms / 1000 * FPS)
  for (let i = 0; i < frames; i++) {
    if (ch === '09') for (const [at, name] of KANSHI) if (i === Math.round(at / STEP)) { await machine(name); await sync() }
    await page.screenshot({ path: `${OUT}/${String(n++).padStart(4, '0')}.png`, clip, animations: 'allow', caret: 'hide' })
    await tick(STEP)
  }
}
console.log(JSON.stringify(marks), 'frames', n, 'seconds', n / FPS)
await browser.close()
