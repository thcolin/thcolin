import { createRequire } from 'module'
import { mkdirSync, rmSync } from 'fs'
// The thcol.in checkout next to this repository, or THCOL_IN
const THCOL_IN = process.env.THCOL_IN ?? new URL('../../../thcol.in', import.meta.url).pathname
const require = createRequire(`${THCOL_IN}/package.json`)
const { chromium } = require('playwright')

// Every image of the README, shot from the mock (profile.html) on GitHub's dark ground. Animated WebPs are swapped for
// canvases fed by ImageDecoder, so each row is drawn at an exact time and shot frame by frame
const here = new URL('.', import.meta.url).pathname
const OUT = `${here}out/`
const [only] = process.argv.slice(2)
const ROWS = [
  { name: 'head', sel: '.img.head', dsf: 2 },
  { name: 'prompt-about', sel: 'img.prompt[src$="prompt-about.svg"]', dsf: 2 },
  { name: 'prompt-projects', sel: 'img.prompt[src$="prompt-projects.svg"]', dsf: 2 },
  { name: 'prompt-3d', sel: 'img.prompt[src$="prompt-3d.svg"]', dsf: 2 },
  { name: 'retro', sel: '.img.retro', dsf: 1, fps: 20 },
  { name: 'daily', sel: '.img.daily', dsf: 2, fps: 25 },
  { name: 'sensorr', sel: '.img.sensorr', dsf: 2, fps: 20 },
  { name: 'printing', sel: '.img.printing', dsf: 1, fps: 20 },
].filter((r) => !only || only.split(',').includes(r.name))

const browser = await chromium.launch()
for (const row of ROWS) {
  const page = await browser.newPage({ viewport: { width: 980, height: 1200 }, deviceScaleFactor: row.dsf })
  await page.goto(`http://localhost:8093/profile.html`, { waitUntil: 'networkidle' })
  await page.evaluate(() => document.fonts.ready)
  // The prompts lose their negative margin so the shot holds the whole line
  await page.addStyleTag({ content: '.prompt { margin: 0 !important } .gh__body { gap: 56px }' })
  const duration = await page.evaluate(async (sel) => {
    const root = document.querySelector(sel)
    const anims = []
    for (const img of root.querySelectorAll('img[src$=".webp"]')) {
      const data = await (await fetch(img.src)).arrayBuffer()
      const decoder = new ImageDecoder({ data, type: 'image/webp' })
      await decoder.tracks.ready
      const count = decoder.tracks.selectedTrack.frameCount
      const frames = []
      let t = 0
      for (let i = 0; i < count; i++) {
        const { image } = await decoder.decode({ frameIndex: i })
        const d = (image.duration ?? 40000) / 1000
        frames.push({ from: t, bitmap: await createImageBitmap(image) })
        t += d
        image.close()
      }
      const canvas = document.createElement('canvas')
      canvas.width = frames[0].bitmap.width
      canvas.height = frames[0].bitmap.height
      canvas.className = img.className
      canvas.style.cssText = img.style.cssText
      const cs = getComputedStyle(img)
      canvas.style.width = cs.width
      canvas.style.height = cs.height
      canvas.style.display = 'block'
      img.replaceWith(canvas)
      anims.push({ canvas, frames, total: t })
    }
    window.seek = (ms) => {
      for (const { canvas, frames, total } of anims) {
        const t = ms % total
        let f = frames[0]
        for (const x of frames) if (x.from <= t) f = x
        const ctx = canvas.getContext('2d')
        ctx.clearRect(0, 0, canvas.width, canvas.height)
        ctx.drawImage(f.bitmap, 0, 0)
      }
    }
    window.seek(0)
    return anims.length ? Math.max(...anims.map((a) => a.total)) : 0
  }, row.sel)
  const el = page.locator(row.sel).first()
  if (!duration) {
    await el.screenshot({ path: `${OUT}${row.name}.png` })
    console.log(row.name, 'static')
  } else {
    const dir = `${OUT}${row.name}/`
    rmSync(dir, { recursive: true, force: true }); mkdirSync(dir, { recursive: true })
    const step = 1000 / row.fps
    const n = Math.round(duration / step)
    for (let i = 0; i < n; i++) {
      await page.evaluate((ms) => window.seek(ms), i * step)
      await el.screenshot({ path: `${dir}${String(i).padStart(4, '0')}.png` })
    }
    console.log(row.name, n, 'frames', Math.round(duration), 'ms')
  }
  await page.close()
}
await browser.close()
