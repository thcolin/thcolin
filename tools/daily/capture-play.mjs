import { chromium, proxyApi, sleep } from './lib.mjs'

// The band's own Play button, before a game starts, on a transparent ground
const PARTS = new URL('./parts/', import.meta.url).pathname
const browser = await chromium.launch()
const page = await browser.newPage({ viewport: { width: 1440, height: 1100 }, deviceScaleFactor: 2 })
await proxyApi(page)
await page.goto('http://localhost:8082/#projects', { waitUntil: 'networkidle' })
await page.evaluate(() => document.getElementById('cinetropes-daily').scrollIntoView({ behavior: 'instant' }))
await sleep(800)
await page.addStyleTag({ content: 'html, body, .band.cd, .scrub { background: transparent !important } .cd__backdrop, .cd__confetti { display: none !important }' })
const play = page.locator('article.cd').getByRole('button', { name: 'Play' })
await page.mouse.move(0, 0)
// The button is glass: everything behind it is hidden, so it lies on the README's own ground
await play.evaluate((b) => { document.querySelector('article.cd').style.visibility = 'hidden'; b.style.visibility = 'visible'; b.dataset.readme = 'play' })
await sleep(400)
const box = await page.locator('[data-readme="play"]').boundingBox()
await page.screenshot({ path: `${PARTS}play.png`, omitBackground: true, clip: box })
console.log('play', box.width, box.height)
await browser.close()
