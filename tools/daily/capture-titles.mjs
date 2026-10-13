import { chromium, proxyApi, sleep } from './lib.mjs'

// The band's onboarding title, its own Spectral italic, with the README's words: "Guess the Movie" over today's
// cards, "Yesterday · #190" over yesterday's reveal. On a transparent ground
const PARTS = new URL('./parts/', import.meta.url).pathname
const TITLES = { 'hero-guess': ['Guess', 'the Movie'], 'hero-yesterday': ['Yesterday · #190'] }
const browser = await chromium.launch()
const page = await browser.newPage({ viewport: { width: 1440, height: 1100 }, deviceScaleFactor: 2 })
await proxyApi(page)
await page.goto('http://localhost:8082/#projects', { waitUntil: 'networkidle' })
await page.evaluate(() => document.getElementById('cinetropes-daily').scrollIntoView({ behavior: 'instant' }))
await sleep(1200)
await page.addStyleTag({ content: 'html, body, .band.cd, .scrub { background: transparent !important } .cd__backdrop, .cd__confetti { display: none !important } .cd__hero-title, .cd__hero-title * { animation: none !important; opacity: 1 !important; transform: none !important; filter: none !important }' })
await page.mouse.move(0, 0)
for (const [name, lines] of Object.entries(TITLES)) {
  await page.evaluate((lines) => {
    document.querySelector('article.cd').style.visibility = 'hidden'
    const title = document.querySelector('.cd__hero-title')
    title.style.visibility = 'visible'
    for (let n = title.parentElement; n; n = n.parentElement) { n.style.setProperty('background', 'transparent', 'important'); n.style.setProperty('backdrop-filter', 'none', 'important'); n.style.setProperty('box-shadow', 'none', 'important') }
    // One line for a single label
    Object.assign(title.style, lines.length === 1 ? { maxWidth: 'none', whiteSpace: 'nowrap', width: 'max-content' } : { maxWidth: '', whiteSpace: '', width: '' })
    title.querySelector('i').replaceChildren(...lines.map((text) => Object.assign(document.createElement('span'), { textContent: text })))
  }, lines)
  await sleep(400)
  const box = await page.locator('.cd__hero-title').boundingBox()
  await page.screenshot({ path: `${PARTS}${name}.png`, omitBackground: true, clip: { x: box.x - 60, y: box.y - 60, width: box.width + 120, height: box.height + 120 } })
}
await browser.close()
