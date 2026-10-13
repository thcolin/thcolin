import { chromium, proxyApi, openDaily, sleep } from './lib.mjs'

// Each native element of the band, as the site renders it, on a transparent ground at 2x
const PARTS = new URL('./parts/', import.meta.url).pathname
const TRANSPARENT = `
  html, body, body *:not(.cd *):not(.cinetropes__tip, .cinetropes__tip *) { background: transparent !important; }
  .band.cd, .scrub { background: transparent !important; }
  .cd__backdrop, .cd__confetti { display: none !important; }
  .cd__glass { background: none !important; border-color: transparent !important; box-shadow: none !important; backdrop-filter: none !important; }
`

const shot = async (page, locator, name, pad = 0) => {
  const box = await locator.boundingBox()
  await page.screenshot({ path: `${PARTS}${name}.png`, omitBackground: true, clip: { x: box.x - pad, y: box.y - pad, width: box.width + 2 * pad, height: box.height + 2 * pad } })
  console.log(name, Math.round(box.width), 'x', Math.round(box.height))
}

const browser = await chromium.launch()

// The day's band at 3/6, three real clicks on Skip
const page = await browser.newPage({ viewport: { width: 1440, height: 1600 }, deviceScaleFactor: 2 })
await proxyApi(page)
const band = await openDaily(page, 3)
const day = await band.locator('.cd__dock-daily').innerText()
console.log('daily', day, '|', await band.locator('.cd__attempts').innerText(), '|', (await band.locator('.cd__meta').innerText()).replace(/\n/g, ' '))
await page.addStyleTag({ content: TRANSPARENT })
await page.mouse.move(0, 0)
await sleep(300)

await shot(page, band.locator('.cd__dock-header'), 'logo')
await shot(page, band.locator('.cd__film-title .cd__pixelated'), 'title')
await shot(page, band.locator('.cd__meta'), 'meta')

const figures = band.locator('.cd__signature figure')
const names = ['reception', 'atmosphere', 'tropes']
for (let i = 0; i < 3; i++) await shot(page, figures.nth(i), `${names[i]}`, 24)

// Each popin as a visitor opens it: a click on its glyph. Its glass lets the band through at 12%: the band is hidden
// under it for the shot. The tropes' list scrolls past 360 px on the site; it is unrolled so all of them show
await page.addStyleTag({ content: '.cinetropes__tropes, .cinetropes__tip { max-height: none !important; }' })
for (let i = 0; i < 3; i++) {
  await figures.nth(i).locator('.cinetropes__glyph').click()
  await sleep(600)
  await page.evaluate(() => { document.getElementById('cinetropes-daily').style.visibility = 'hidden' })
  const tip = page.locator('.cinetropes__tip')
  const scroll = await tip.evaluate((t) => t.scrollHeight - t.clientHeight)
  if (scroll > 0) console.log('WARN tip scrolls', names[i], scroll)
  console.log(names[i], 'tip:', (await tip.innerText()).replace(/\n/g, ' | ').slice(0, 400))
  await shot(page, tip, `${names[i]}-tip`)
  await page.evaluate(() => { document.getElementById('cinetropes-daily').style.visibility = '' })
  await page.keyboard.press('Escape')
  await page.mouse.move(0, 0)
  await sleep(400)
}

// The poster card at the size of the README, through the band's own --card-w
await page.addStyleTag({ content: '.band.cd { --card-w: 112px; }' })
await sleep(500)
await shot(page, band.locator('.cd__card'), 'poster', 20)
await page.close()

// Yesterday's card: the HistoryCard of a guess, turned onto daily #190's poster, Nikita. The API serves no other
// day than today's, so the guess's answer is written here and the beta never sees it
const history = await browser.newPage({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 4 })
await proxyApi(history, { guess: () => ({ correct: false, guessFilm: { id: 9322, title: 'Nikita', year: 1990, posterUrl: 'http://localhost:8082/poster.2fde3295.webp' } }) })
const band2 = await openDaily(history, 0)
await band2.locator('.cd__input').fill('Nikita')
await band2.locator('.cd__option').first().waitFor()
console.log('options', await band2.locator('.cd__option').allInnerTexts())
await band2.locator('.cd__option', { hasText: /^Nikita/ }).first().click()
await band2.getByRole('button', { name: 'Send' }).click()
await sleep(5500)
await history.addStyleTag({ content: TRANSPARENT })
await history.mouse.move(0, 0)
await sleep(300)
console.log('mini class', await band2.locator('.cd__mini').getAttribute('class'))
await shot(history, band2.locator('.cd__mini'), 'yesterday')
await browser.close()
