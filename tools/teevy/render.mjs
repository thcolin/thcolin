import { createRequire } from 'module'
import { readdirSync, mkdirSync } from 'fs'
const require = createRequire('/Users/thcolin/Projects/perso/thcol.in/package.json')
const { chromium } = require('playwright')
const [framesDir, outDir, only] = process.argv.slice(2)
mkdirSync(outDir, { recursive: true })
const frames = readdirSync(framesDir).filter((f) => f.endsWith('.png')).sort()
const pick = only ? only.split(',').map(Number) : frames.map((_, i) => i)
const browser = await chromium.launch()
const page = await browser.newPage({ viewport: { width: 900, height: 900 }, deviceScaleFactor: 1 })
await page.goto('http://localhost:8091/crt.html')
for (const i of pick) {
  await page.evaluate((src) => new Promise((resolve) => { const img = document.getElementById('screen'); img.onload = resolve; img.src = src }), 'http://localhost:8091/frames-teevy/' + frames[i])
  await page.locator('#tv').screenshot({ path: `${outDir}/${String(i).padStart(4, '0')}.png`, omitBackground: true })
}
await browser.close()
