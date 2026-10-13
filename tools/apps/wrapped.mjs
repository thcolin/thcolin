// Wrapped: renders the band's phone headless, on virtual time, two stories per look
import fs from 'node:fs'
import { chromium, setupClock, settleImages, tick } from './lib.mjs'

const HERE = new URL('.', import.meta.url).pathname
const RAW = `${HERE}work-wrapped`
fs.rmSync(RAW, { recursive: true, force: true })
fs.mkdirSync(`${RAW}/screen`, { recursive: true })
fs.mkdirSync(`${RAW}/phone`, { recursive: true })

const FPS = 25
// [look, story, seconds], two stories a look, indexes only forward so the segments fill up across the loop
const TOUR = [['tele', 0, 1.4], ['tele', 1, 1.4], ['labo', 2, 1.4], ['labo', 3, 1.4], ['scenario', 4, 1.6], ['scenario', 5, 1.2], ['videoclub', 6, 1.4], ['videoclub', 7, 1.4], ['affiche', 10, 1.4], ['affiche', 13, 1.4]]

const browser = await chromium.launch()
const page = await browser.newPage({ viewport: { width: 1440, height: 1100 }, deviceScaleFactor: 2 })
await setupClock(page)
await page.goto('http://localhost:8082/#sensorr-wrapped')
await page.waitForLoadState('networkidle')
await page.evaluate(() => document.querySelector('#sensorr-wrapped').scrollIntoView())
await tick(page, 500)
await page.waitForSelector('.wrapped__look .stories-page > *')

const go = async (look, index) => {
  await page.evaluate(([look, index]) => {
    const select = document.querySelector('.theme-switch select')
    if (select.value !== look) {
      select.value = look
      select.dispatchEvent(new Event('change', { bubbles: true }))
    }
  }, [look, index])
  await page.waitForFunction((l) => document.querySelector('.wrapped__look').dataset.theme === l, look)
  // One tap per round trip: React renders the next index before the following tap reads it
  const at = () => page.evaluate(() => [...document.querySelectorAll('.stories-segments li')].findIndex((li) => li.hasAttribute('data-current')))
  for (let current = await at(), guard = 0; current !== index && guard < 40; guard++) {
    await page.evaluate((next) => document.querySelector(next ? '.stories-tap-next' : '.stories-tap-previous').click(), current < index)
    await page.waitForFunction((was) => [...document.querySelectorAll('.stories-segments li')].findIndex((li) => li.hasAttribute('data-current')) !== was, current)
    current = await at()
  }
  if (await at() !== index) throw new Error(`story ${index} not reached`)
}

// Warm pass: every look's module and every poster in the cache
for (const [look, index] of TOUR) {
  await go(look, index)
  await tick(page, 200, 50)
  await settleImages(page, '.wrapped__phone')
}

// Transparent around the phone; the badge under it is the band's, not the phone's
await page.evaluate(() => {
  for (let node = document.querySelector('.wrapped__phone').parentElement; node; node = node.parentElement) {
    node.style.setProperty('background', 'none', 'important')
  }
  document.querySelector('.wrapped__badge').style.visibility = 'hidden'
})
const phone = await page.locator('.wrapped__phone').boundingBox()
const look = await page.locator('.wrapped__look').boundingBox()
console.log('phone', phone, 'look', look)
const PAD = { x: 40, top: 8, bottom: 80 }
const phoneClip = { x: phone.x - PAD.x, y: phone.y - PAD.top, width: phone.width + 2 * PAD.x, height: phone.height + PAD.top + PAD.bottom }

// Start on the last story so the first frames are the loop's own cut, segments included
await go(...TOUR.at(-1).slice(0, 2))
await tick(page, 2000, 50)
await settleImages(page, '.wrapped__phone')

let n = 0
for (const [l, index, hold] of TOUR) {
  await go(l, index)
  await settleImages(page, '.wrapped__phone')
  for (let f = 0; f < Math.round(hold * FPS); f++) {
    await tick(page, 1000 / FPS, 1000 / FPS / 2)
    if (process.env.DEBUG && f < 3) console.log(f, await page.evaluate(() => document.getAnimations().filter(a => a.effect?.target?.closest?.('.wrapped__look')).map(a => `${a.animationName || a.transitionProperty}:${Math.round(a.currentTime)}:${a.playState}`).slice(0, 6).join(' ')))
    if (process.env.DEBUG && f >= 3) continue
    const name = String(n).padStart(4, '0') + '.png'
    await page.screenshot({ path: `${RAW}/phone/${name}`, clip: phoneClip, omitBackground: true })
    await page.evaluate(() => {
      document.querySelector('.wrapped__frame').style.visibility = 'hidden'
      document.querySelector('.wrapped__phone').style.filter = 'none'
    })
    await page.screenshot({ path: `${RAW}/screen/${name}`, clip: look, omitBackground: true })
    await page.evaluate(() => {
      document.querySelector('.wrapped__frame').style.visibility = ''
      document.querySelector('.wrapped__phone').style.filter = ''
    })
    n++
  }
  console.log(l, index, n)
}
await browser.close()
