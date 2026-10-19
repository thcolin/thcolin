// cinetropes tcg: the band's booster opened to the end, headless on virtual time, one frame every 1/FPS s
import fs from 'node:fs'
import { chromium, setupClock, settleImages, tick } from './lib.mjs'

const HERE = new URL('.', import.meta.url).pathname
const RAW = `${HERE}frames-tcg`
fs.rmSync(RAW, { recursive: true, force: true })
fs.mkdirSync(RAW, { recursive: true })

const FPS = 15

const browser = await chromium.launch()
const page = await browser.newPage({ viewport: { width: 1180, height: 820 }, deviceScaleFactor: 1 })
await setupClock(page)
await page.goto('http://localhost:8082/#cinetropes-tcg')
await page.waitForLoadState('networkidle')
await page.evaluate(() => document.querySelector('.band.tcg').scrollIntoView({ block: 'start', behavior: 'instant' }))
// The README writes its own line under the image: the band's text, stack and link leave it
await page.addStyleTag({ content: '.tcg__lead, .tcg__text { display: none !important }' })
await tick(page, 500)
await settleImages(page, '.band.tcg')

const table = await page.locator('.tcg__table').boundingBox()
const clip = { x: table.x - 24, y: table.y - 24, width: table.width + 48, height: table.height + 48 }

let n = 0
const hold = async (seconds) => {
  for (let f = 0; f < Math.round(seconds * FPS); f++) {
    await tick(page, 1000 / FPS, 1000 / FPS / 2)
    await page.screenshot({ path: `${RAW}/${String(n++).padStart(4, '0')}.png`, clip })
  }
}

// A tap where a finger would land, off the sachet's centre so each crinkle lands elsewhere
const tap = async (selector, dx = 0, dy = 0) => {
  const box = await page.locator(selector).boundingBox()
  await page.mouse.click(box.x + box.width * (0.5 + dx), box.y + box.height * (0.5 + dy))
}

await hold(0.8)
const spots = [[-0.15, -0.2], [0.18, 0.05], [-0.1, 0.25], [0.12, -0.1], [0, 0.15], [-0.2, 0], [0.15, 0.2]]
for (const [dx, dy] of spots) {
  if (!(await page.locator('.tcg-pack__button:not([disabled])').count())) break
  await tap('.tcg-pack__button', dx, dy)
  await hold(0.3)
}
await hold(1)

for (let i = 0; i < 5; i++) {
  await tap('.tcg__card')
  await hold(i >= 3 ? 2.1 : 1.1)
  await tap('.tcg__card')
  await hold(0.6)
}
await hold(1.4)

console.log(n, 'frames', clip)
await browser.close()
