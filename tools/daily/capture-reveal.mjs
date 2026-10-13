import { chromium, proxyApi, openDaily, sleep } from './lib.mjs'

// Yesterday's reveal: the band's own end state after six skips. The beta serves today only, so the API is cut and the
// band falls back to its frozen daily #190, Nikita, the one the site marks as sample data
const PARTS = new URL('./parts/', import.meta.url).pathname
const TRANSPARENT = `
  html, body, body *:not(.cd *):not(.cinetropes__tip, .cinetropes__tip *) { background: transparent !important; }
  .band.cd, .scrub { background: transparent !important; }
  .cd__backdrop, .cd__confetti { display: none !important; }
`
const shot = async (page, locator, name, pad = 0) => {
  const box = await locator.boundingBox()
  await page.screenshot({ path: `${PARTS}${name}.png`, omitBackground: true, clip: { x: box.x - pad, y: box.y - pad, width: box.width + 2 * pad, height: box.height + 2 * pad } })
  console.log(name, Math.round(box.width), 'x', Math.round(box.height))
}
const browser = await chromium.launch()
const page = await browser.newPage({ viewport: { width: 1440, height: 1000 }, deviceScaleFactor: 2 })
await page.route('https://beta.cinetropes.com/api/**', (route) => route.abort())
const band = await openDaily(page, 6)
await sleep(3000)
console.log(await band.locator('.cd__film-title').innerText(), '|', await band.locator('.cd__meta').innerText())
await page.screenshot({ path: `${PARTS}../band-reveal.png` })
await page.addStyleTag({ content: TRANSPARENT + '.band.cd { --card-w: 112px; }' })
await page.mouse.move(0, 0)
await sleep(800)
await shot(page, band.locator('.cd__card'), 'reveal-poster', 20)
await shot(page, band.locator('.cd__film-title'), 'reveal-title')
await shot(page, band.locator('.cd__meta'), 'reveal-meta')
await shot(page, band.locator('.cd__director'), 'reveal-director')
await page.close()

// Today's band as the site draws it, three skips in, for the proposal that keeps the band whole
const live = await browser.newPage({ viewport: { width: 1440, height: 1000 }, deviceScaleFactor: 2 })
await proxyApi(live)
const band2 = await openDaily(live, 3)
await live.mouse.move(0, 0)
await sleep(800)
await live.screenshot({ path: `${PARTS}../band-today.png` })
await browser.close()
