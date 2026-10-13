import { mkdirSync, rmSync } from 'node:fs'
import { chromium, proxyApi, openDaily, sleep } from './lib.mjs'

// Today's poster card with the band's holo, the one it shows once a game is won: its shine and glare, and the tilt,
// now and then: a rest frame, flat, then one sweep of the pointer across the card. On a transparent ground
const OUT = new URL('./holo/', import.meta.url).pathname
rmSync(OUT, { recursive: true, force: true }); mkdirSync(OUT)
const STEPS = 60
const browser = await chromium.launch()
const page = await browser.newPage({ viewport: { width: 1440, height: 1100 }, deviceScaleFactor: 2 })
await proxyApi(page)
const band = await openDaily(page, 2)
await page.addStyleTag({ content: `
  html, body, body *:not(.cd *) { background: transparent !important; }
  .band.cd, .scrub { background: transparent !important; }
  .cd__backdrop, .cd__confetti { display: none !important; }
  .band.cd { --card-w: 220px; }
  .cd__card-rotator, .cd__card-shine, .cd__card-glare { transition: none !important; }
` })
await page.mouse.move(0, 0)
await sleep(600)
await page.evaluate(() => {
  const card = document.querySelector('.cd__card')
  card.classList.add('is-holo', 'is-interacting')
  const front = card.querySelector('.cd__card-front')
  for (const name of ['cd__card-shine', 'cd__card-glare']) front.appendChild(Object.assign(document.createElement('div'), { className: name }))
})
const box = await band.locator('.cd__card').boundingBox()
const clip = { x: box.x - 30, y: box.y - 30, width: box.width + 60, height: box.height + 60 }
// The shine and the glare are driven here instead of by the class, so they rise and fall with the sweep
const frame = ([x, y, fade]) => {
  const card = document.querySelector('.cd__card')
  card.style.setProperty('--pointer-x', `${x * 100}%`)
  card.style.setProperty('--pointer-y', `${y * 100}%`)
  card.style.setProperty('--rotate-x', `${(x - 0.5) * 24 * fade}deg`)
  card.style.setProperty('--rotate-y', `${(0.5 - y) * 24 * fade}deg`)
  card.querySelector('.cd__card-shine').style.setProperty('opacity', `${0.35 * fade}`, 'important')
  card.querySelector('.cd__card-glare').style.setProperty('opacity', `${0.6 * fade}`, 'important')
}
for (let i = 0; i < STEPS; i++) {
  // The pointer crosses from the top left to the bottom right, eased; the effect fades in and out on sin²
  const p = i / (STEPS - 1)
  const t = (1 - Math.cos(p * Math.PI)) / 2
  const fade = Math.sin(p * Math.PI) ** 2
  await page.evaluate(frame, [0.15 + 0.7 * t, 0.25 + 0.5 * t, fade])
  await sleep(40)
  await page.screenshot({ path: `${OUT}${String(i).padStart(3, '0')}.png`, clip, omitBackground: true })
}
await browser.close()
