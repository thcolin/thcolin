import { createRequire } from 'module'
const require = createRequire('/Users/thcolin/Projects/perso/thcol.in/package.json')
const { chromium } = require('playwright')
import fs from 'fs'

const OUT = process.argv[2]
const only = process.argv[3]?.split(',')
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

const browser = await chromium.launch()
const page = await browser.newPage({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1 })
await page.goto('http://localhost:8082/', { waitUntil: 'networkidle' })

// Walks a scrub band from its first step to its last over `ms`, capturing its demo
const scrub = async (id, ms, { lead = 600, tail = 900, before, during } = {}) => {
  const box = await page.evaluate((id) => {
    const el = document.getElementById(id)
    el.scrollIntoView({ behavior: 'instant' })
    const top = scrollY + el.getBoundingClientRect().top
    return { top, span: el.getBoundingClientRect().height - innerHeight }
  }, id)
  await sleep(1500)
  if (before) await before()
  const dir = `${OUT}/${id}`
  fs.rmSync(dir, { recursive: true, force: true })
  fs.mkdirSync(dir, { recursive: true })
  const demo = page.locator(`#${id} [data-scrub-demo]`).first()
  const frames = []
  const start = Date.now()
  let last = start
  const playing = during?.()
  while (Date.now() - start < lead + ms + tail) {
    const t = Math.min(1, Math.max(0, (Date.now() - start - lead) / ms))
    const eased = t < 0.5 ? 2 * t * t : 1 - (-2 * t + 2) ** 2 / 2
    if (!during) await page.evaluate((y) => scrollTo({ top: y, behavior: 'instant' }), box.top + eased * box.span)
    const file = `${dir}/${String(frames.length).padStart(4, '0')}.png`
    await demo.screenshot({ path: file, animations: 'allow' })
    const now = Date.now()
    frames.push({ file, ms: now - last })
    last = now
  }
  await playing
  fs.writeFileSync(`${dir}/frames.json`, JSON.stringify(frames))
  console.log(id, frames.length, 'frames')
}

const jobs = {
  sensorr: () => scrub('sensorr', 7000),
  'sensorr-wrapped': () => scrub('sensorr-wrapped', 9000, {
    lead: 0, tail: 0,
    before: async () => { await page.focus('#sensorr-wrapped .stories-frame'); await sleep(1200) },
    during: async () => {
      for (let i = 0; i < 4; i++) { await sleep(1900); await page.keyboard.press('ArrowRight') }
    },
  }),
  gmca: () => scrub('gmca', 7000),
  cinetropes: () => scrub('cinetropes', 5000),
  teevy: () => scrub('teevy', 7000, {
    lead: 0, tail: 0,
    before: async () => { await page.focus('article.teevy'); await sleep(2500) },
    during: async () => {
      await sleep(700)
      await page.keyboard.press('p')
      for (let i = 0; i < 7; i++) { await sleep(650); await page.keyboard.press('p') }
    },
  }),
}
for (const [id, job] of Object.entries(jobs)) if (!only || only.includes(id)) await job()
await browser.close()
