import { chromium, proxyApi, openDaily, sleep } from './lib.mjs'

// For the card backs: each chart and its popin as the site opens it, for today (#195, live) and yesterday (#190, the
// frozen sample, API cut). The tropes keep their first four, first occurrence of each, titles only
const PARTS = new URL('./parts/', import.meta.url).pathname
const TRANSPARENT = `
  html, body, body *:not(.cd *):not(.cinetropes__tip, .cinetropes__tip *) { background: transparent !important; }
  .band.cd, .scrub { background: transparent !important; }
  .cd__backdrop, .cd__confetti { display: none !important; }
  .cinetropes__tip { animation: none !important; max-height: none !important; }
  .cinetropes__tropes { max-height: none !important; overflow: visible !important; }
`
const names = ['reception', 'atmosphere', 'tropes']
const browser = await chromium.launch()
for (const [day, skips, live] of [['195', 3, true], ['190', 6, false]]) {
  const page = await browser.newPage({ viewport: { width: 1440, height: 1400 }, deviceScaleFactor: 2 })
  if (live) await proxyApi(page)
  else await page.route('https://beta.cinetropes.com/api/**', (route) => route.abort())
  const band = await openDaily(page, skips)
  await sleep(live ? 300 : 3000)
  await page.addStyleTag({ content: TRANSPARENT })
  await page.mouse.move(0, 0)
  await sleep(500)
  const figures = band.locator('.cd__signature figure')
  for (let i = 0; i < 3; i++) {
    const glyph = await figures.nth(i).locator('.cinetropes__glyph').boundingBox()
    await page.screenshot({ path: `${PARTS}glyph-${names[i]}-${day}.png`, omitBackground: true, clip: { x: glyph.x - 16, y: glyph.y - 16, width: glyph.width + 32, height: glyph.height + 32 } })
    await figures.nth(i).locator('.cinetropes__glyph').click()
    await sleep(600)
    await page.evaluate(() => {
      document.getElementById('cinetropes-daily').style.visibility = 'hidden'
      const tip = document.querySelector('.cinetropes__tip')
      const seen = new Set()
      tip.querySelectorAll('.cinetropes__tropes > li').forEach((li) => {
        li.classList.remove('is-open')
        li.querySelectorAll('.cinetropes__trope-body').forEach((b) => { b.style.display = 'none' })
        const name = li.innerText.split('\n')[0]
        if (seen.has(name) || seen.size >= 4) li.style.display = 'none'
        else seen.add(name)
      })
      tip.style.top = '40px'; tip.style.bottom = 'auto'; tip.style.left = '720px'
      tip.style.setProperty('height', 'auto', 'important')
    })
    await sleep(300)
    const tip = page.locator('.cinetropes__tip')
    console.log(day, names[i], (await tip.innerText()).replace(/\n/g, ' | ').slice(0, 160))
    await page.screenshot({ path: `${PARTS}tip-${names[i]}-${day}.png`, omitBackground: true, clip: await tip.boundingBox() })
    await page.evaluate(() => { document.getElementById('cinetropes-daily').style.visibility = '' })
    await page.keyboard.press('Escape')
    await page.mouse.move(0, 0)
    await sleep(400)
  }
  await page.close()
}
await browser.close()
