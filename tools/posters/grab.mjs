import { createRequire } from 'module'
const require = createRequire('/Users/thcolin/Projects/perso/thcol.in/package.json')
const { chromium } = require('playwright')
const dir = process.argv[2]
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
const browser = await chromium.launch()
const page = await browser.newPage({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 2 })
await page.goto('http://localhost:8082/', { waitUntil: 'networkidle' })
for (const [id, sel, file] of [['teevy', '.teevy__screen', 'teevy-screen.png'], ['cinetropes', '.cinetropes__slot:not([aria-hidden=true]) .cinetropes__card', 'cinetropes-card.png'], ['gmca', '.gmca__stage', 'gmca-stage.png']]) {
  await page.evaluate((id) => document.getElementById(id).scrollIntoView({ behavior: 'instant' }), id)
  await sleep(2500)
  await page.locator(sel).first().screenshot({ path: `${dir}/${file}`, omitBackground: true })
}
await browser.close()
