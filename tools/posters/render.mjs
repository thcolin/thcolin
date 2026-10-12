import { createRequire } from 'module'
const require = createRequire('/Users/thcolin/Projects/perso/thcol.in/package.json')
const { chromium } = require('playwright')
const dir = process.argv[2]
const browser = await chromium.launch()
const page = await browser.newPage({ viewport: { width: 1400, height: 1400 }, deviceScaleFactor: 2 })
await page.goto(`file://${dir}/posters.html`, { waitUntil: 'networkidle' })
await page.evaluate(() => document.fonts.ready)
for (const id of ['sensorr', 'gmca', 'oleoo', 'cinetropes', 'teevy']) await page.locator(`#p-${id}`).screenshot({ path: `${dir}/out-${id}.png` })
await page.screenshot({ path: `${dir}/all.png`, fullPage: true })
await browser.close()
