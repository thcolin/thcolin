// The cinetropes meta-game demo the site embeds, played on a virtual clock: lobby, a customer at the
// cashier, works offered, out to the street, back in through the door. The loop closes on the iris.
import { createRequire } from 'module'
import { mkdirSync, rmSync } from 'fs'
// The thcol.in checkout next to this repository, or THCOL_IN
const THCOL_IN = process.env.THCOL_IN ?? new URL('../../../thcol.in', import.meta.url).pathname
const require = createRequire(`${THCOL_IN}/package.json`)
const { chromium } = require('playwright')

const FACADE = process.env.FACADE || 'scene_cyberpunk_european_urban_berlin_techno'
const FPS = Number(process.env.FPS || 20)
const STEP = 1000 / FPS
const OUT = process.env.OUT || 'raw-metagame'
const NOW = new Date() // the cycle's countdown is read against the real cycle
const X = 3 // the embed draws its 192 px picture at 576 when the window allows it

rmSync(OUT, { recursive: true, force: true }); mkdirSync(OUT, { recursive: true })
const browser = await chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'] })
const page = await browser.newPage({ viewport: { width: 576, height: 576 } })
page.on('pageerror', (e) => console.log('pageerror', e.message))
// A guest save past the prologue, as the e2e of cinetropes seeds it: the street is busy, the lobby repaired
await page.addInitScript(({ facadeId, t }) => {
  let s = 11
  Math.random = () => { s = (s + 0x6D2B79F5) | 0; let r = Math.imul(s ^ (s >>> 15), 1 | s); r = (r + Math.imul(r ^ (r >>> 7), 61 | r)) ^ r; return ((r ^ (r >>> 14)) >>> 0) / 4294967296 }
  localStorage.setItem('cinetropes:guest-game', JSON.stringify({ version: 1, facadeId, wallet: { tickets: 0, popcorn: 0 }, tiers: { hallDecorTier: 2, hallTicketsTier: 0, hallPopcornTier: 0, salleTier: 2, cabineRoomTier: 2, bureauTier: 1, projecteurTier: 1 }, prologueStep: 11, prologueCompletedAtMs: t - 3.6e6, pirateArcStep: 0, lastSeenAtMs: t, createdAtMs: t - 3.6e6, programmations: [], earnedTickets: 0, cyclesPlayed: 0, demoEndedAtMs: null, demoAnnouncedAtMs: null }))
}, { facadeId: FACADE, t: NOW.getTime() })
await page.clock.install({ time: NOW })
await page.clock.pauseAt(new Date(NOW.getTime() + 500))
await page.goto(`https://daily.cinetropes.com/play?embed&facade=${FACADE}`)

const tick = async (ms) => { await page.clock.runFor(ms); await page.waitForTimeout(15) }
// Boot: the clock moves in small steps while assets come in for real
for (let i = 0; i < 80; i++) { await tick(100); await page.waitForTimeout(40) }
const canvas = page.locator('canvas')
await canvas.waitFor()
console.log('canvas', await canvas.boundingBox())

let n = 0
const marks = []
const shoot = async (ms, label) => {
  if (label) marks.push({ label, at: +(n / FPS).toFixed(2) })
  for (let i = 0, k = Math.round(ms / 1000 * FPS); i < k; i++) {
    await canvas.screenshot({ path: `${OUT}/${String(n++).padStart(4, '0')}.png`, animations: 'allow' })
    await tick(STEP)
  }
}
const click = async (x, y) => { await page.mouse.click(x * X, y * X); await page.mouse.move(96 * X, 40 * X) }
const press = (key) => page.keyboard.press(key)

// The street, before the take: the walkers are already out
await page.mouse.move(96 * X, 40 * X)
for (let i = 0; i < 30; i++) await tick(100)
await click(71 + 24, 150 + 12) // the door of the facade
const T = (k, d) => Number(process.env[k] || d)
await shoot(T('LOBBY', 5000), 'door, iris into the lobby')
await click(49 + 17, 73 + 23) // the cashier
await shoot(T('DIALOG', 1200), 'cashier')
await press('Enter') // Faire des travaux
await shoot(T('WORKS', 1800), 'works')
await press('Enter') // Retour
await shoot(T('BACK', 800), 'back in the lobby')
await click(96, 180) // the exit, bottom of the lobby
await shoot(T('STREET', 3000), 'out to the street')
await click(71 + 24, 150 + 12)
await shoot(T('IRIS', 1200), 'door again')
console.log(JSON.stringify(marks), 'frames', n)
await browser.close()
