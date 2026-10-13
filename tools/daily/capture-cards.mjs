import { chromium, proxyApi, openDaily, sleep } from './lib.mjs'

// Both cards at 220 px, on a transparent ground: today's mystery three skips in, and #190's reveal after six
const PARTS = new URL('./parts/', import.meta.url).pathname
const TRANSPARENT = `
  html, body, body *:not(.cd *):not(.cinetropes__tip, .cinetropes__tip *) { background: transparent !important; }
  .band.cd, .scrub { background: transparent !important; }
  .cd__backdrop, .cd__confetti { display: none !important; }
  .band.cd { --card-w: 220px; }
`
const shot = async (page, locator, name, pad = 0) => {
  const box = await locator.boundingBox()
  await page.screenshot({ path: `${PARTS}${name}.png`, omitBackground: true, clip: { x: box.x - pad, y: box.y - pad, width: box.width + 2 * pad, height: box.height + 2 * pad } })
}
const browser = await chromium.launch()
for (const [name, skips, live] of [['card-today', 3, true], ['card-reveal', 6, false]]) {
  const page = await browser.newPage({ viewport: { width: 1440, height: 1000 }, deviceScaleFactor: 2 })
  if (live) await proxyApi(page)
  else await page.route('https://beta.cinetropes.com/api/**', (route) => route.abort())
  const band = await openDaily(page, skips)
  await sleep(live ? 300 : 3000)
  await page.addStyleTag({ content: TRANSPARENT })
  await page.mouse.move(0, 0)
  await sleep(800)
  await shot(page, band.locator('.cd__card'), name, 24)
  if (!live) await shot(page, band.locator('.cd__director'), 'reveal-director')
  await page.close()
}
await browser.close()
