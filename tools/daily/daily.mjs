// The README's daily row, from the live band on thcol.in and the daily's API on daily.cinetropes.com.
//
//   node daily.mjs reveal   before the day ends (UTC): today's answer, as the band reveals it, kept in state/
//   node daily.mjs today    once the day has turned: today's riddle, yesterday's answer from state/, images/daily.webp
//
// state/ never reaches the repository: it holds today's answer while today's game is still on
import { execFileSync } from 'node:child_process'
import { existsSync, mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs'
import { chromium } from 'playwright'

const HERE = new URL('.', import.meta.url).pathname
const WORK = `${HERE}work/`
const STATE = `${HERE}state/`
const OUTPUT = `${HERE}../../images/daily.webp`
const SITE = process.env.SITE ?? 'https://thcol.in'
const API = 'https://daily.cinetropes.com/api'
const HOLO_FRAMES = 60
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms))

const TRANSPARENT = `
  html, body, body *:not(.cd *):not(.cinetropes__tip, .cinetropes__tip *) { background: transparent !important; }
  .band.cd, .scrub { background: transparent !important; }
  .cd__backdrop, .cd__confetti { display: none !important; }
  .cd__hero-title, .cd__hero-title * { animation: none !important; opacity: 1 !important; transform: none !important; filter: none !important; }
`

const api = async (path) => {
  const res = await fetch(`${API}${path}`, { headers: { 'Accept-Language': 'en' } })
  if (!res.ok) throw new Error(`${path}: ${res.status}`)
  return res.json()
}

// A shot cut to an element's content rather than its box: the band's panels are wider than what they hold
const tight = (page, selector) => page.evaluate((selector) => {
  const el = document.querySelector(selector)
  const range = document.createRange()
  range.selectNodeContents(el)
  const r = range.getBoundingClientRect()
  return { x: Math.floor(r.x), y: Math.floor(r.y), width: Math.ceil(r.width) + 1, height: Math.ceil(r.height) + 1 }
}, selector)

const shot = async (page, clip, path) => {
  await page.screenshot({ path, clip, omitBackground: true })
}

const box = async (page, selector, pad = 0) => {
  const b = await page.locator(selector).first().boundingBox()
  return { x: b.x - pad, y: b.y - pad, width: b.width + 2 * pad, height: b.height + 2 * pad }
}

// The band as a visitor finds it, Play pressed and `skips` real clicks on Skip
const openBand = async (browser, skips, { play = true } = {}) => {
  const page = await browser.newPage({ viewport: { width: 1440, height: 1100 }, deviceScaleFactor: 2 })
  await page.goto(`${SITE}/#projects`, { waitUntil: 'networkidle' })
  await page.evaluate(() => document.getElementById('cinetropes-daily').scrollIntoView({ behavior: 'instant' }))
  await sleep(1200)
  const band = page.locator('article.cd')
  if (play) {
    await band.getByRole('button', { name: 'Play' }).click()
    await sleep(800)
    for (let i = 0; i < skips; i++) {
      await band.getByRole('button', { name: 'Skip' }).click()
      await sleep(1800)
    }
  }
  await page.evaluate(() => document.fonts.ready)
  return { page, band }
}

// The onboarding's title, its Spectral italic, with the README's words; a single line stays on one line
const heroTitle = async (page, lines, path) => {
  await page.evaluate((lines) => {
    document.querySelector('article.cd').style.visibility = 'hidden'
    const title = document.querySelector('.cd__hero-title')
    title.style.visibility = 'visible'
    for (let n = title.parentElement; n; n = n.parentElement) {
      n.style.setProperty('background', 'transparent', 'important')
      n.style.setProperty('backdrop-filter', 'none', 'important')
      n.style.setProperty('box-shadow', 'none', 'important')
    }
    Object.assign(title.style, lines.length === 1 ? { maxWidth: 'none', whiteSpace: 'nowrap', width: 'max-content' } : { maxWidth: '', whiteSpace: '', width: '' })
    title.querySelector('i').replaceChildren(...lines.map((text) => Object.assign(document.createElement('span'), { textContent: text })))
  }, lines)
  await sleep(400)
  await shot(page, await box(page, '.cd__hero-title', 60), path)
}

const reveal = async () => {
  const { gameDay } = await api('/daily')
  rmSync(STATE, { recursive: true, force: true })
  mkdirSync(STATE, { recursive: true })
  const browser = await chromium.launch()
  const { page, band } = await openBand(browser, 6)
  await sleep(3000)
  await page.addStyleTag({ content: `${TRANSPARENT} .band.cd { --card-w: 120px; }` })
  await page.mouse.move(0, 0)
  await sleep(800)
  await shot(page, await box(page, '.cd__card'), `${STATE}card.png`)
  // The band keeps a title on one line and clips it at its panel; a long one wraps here instead, whole
  await page.addStyleTag({ content: '.cd__panel, .cd__film-title, .cd__film-title * { overflow: visible !important; } .cd__film-title, .cd__film-title * { white-space: normal !important; } .cd__film-title { max-width: 900px; } .cd__accordion { visibility: hidden !important; }' })
  await sleep(300)
  await shot(page, await tight(page, '.cd__film-title'), `${STATE}title.png`)
  await shot(page, await tight(page, '.cd__meta'), `${STATE}meta.png`)
  await shot(page, await tight(page, '.cd__director'), `${STATE}director.png`)
  const glyphs = band.locator('.cd__signature figure .cinetropes__glyph')
  for (let i = 0; i < 3; i++) {
    const b = await glyphs.nth(i).boundingBox()
    await shot(page, { x: b.x - 8, y: b.y - 8, width: b.width + 16, height: b.height + 16 }, `${STATE}glyph-${i}.png`)
  }
  await page.close()
  // The title of the hero is drawn on the band before a game, where it lives
  const { page: fresh } = await openBand(browser, 0, { play: false })
  await fresh.addStyleTag({ content: TRANSPARENT })
  await heroTitle(fresh, [`Yesterday · #${gameDay}`], `${STATE}hero.png`)
  await browser.close()
  writeFileSync(`${STATE}day.json`, JSON.stringify({ gameDay }))
  console.log('kept the reveal of daily', gameDay)
}

// One section of the band's card back per card, Reception, Atmosphere then Tropes: the band shows it once the game is
// over. Each on the clue cards' own frame, zoomed as far as the card's height allows
const clueCards = async (browser) => {
  const { page, band } = await openBand(browser, 6)
  await sleep(3000)
  await band.locator('.cd__card[role=button]').click()
  await page.locator('.cd__zoom-sheet .cd__sheet-section').first().waitFor()
  await page.mouse.move(0, 0)
  await sleep(1500)
  await page.addStyleTag({ content: `
    .cd__zoom-card { left: 40px !important; top: 40px !important; width: 514px !important; height: 772px !important; transform: none !important; }
    .cd__zoom-rotator, .cinetropes__close { visibility: hidden !important; }
    .cd__zoom-sheet { inset: 0; background: #0a0a0a; }
    .cd__zoom-sheet, .cd__zoom-sheet * { animation: none !important; }
    .cd__sheet-section h4 { text-align: center; }
    /* The chart centred on top, its values under it; Atmosphere's eight axes on two columns; the tropes closed, their first four */
    .cd__zoom-sheet .cinetropes__legend { grid-template-columns: minmax(0, 1fr); justify-items: center; gap: 14px; }
    .cd__zoom-sheet .cinetropes__legend .cinetropes__glyph { width: 140px; }
    .cd__zoom-sheet .cinetropes__legend-body { width: 100%; }
    .cd__zoom-sheet .cinetropes__tip-rows:has(> :nth-child(8)) { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); column-gap: 16px; }
    .cd__zoom-sheet .cinetropes__tip-rows:has(> :nth-child(8)) li { flex-wrap: wrap; row-gap: 4px; }
    .cd__zoom-sheet .cinetropes__tip-rows:has(> :nth-child(8)) .cinetropes__bar { order: 1; flex-basis: calc(100% - 16px); margin-left: 16px; }
    .cd__zoom-sheet .cinetropes__trope-body, .cd__zoom-sheet .cinetropes__tropes > :nth-child(n + 5) { display: none !important; }
  ` })
  const clip = await box(page, '.cd__zoom-card')
  // The band leaves Tropes out of a film with fewer than three, and puts the palette after it
  for (const [i, name] of ['Reception', 'Atmosphere', 'Tropes'].entries()) {
    await page.evaluate((name) => {
      const sheet = document.querySelector('.cd__zoom-sheet')
      const section = [...sheet.querySelectorAll('.cd__sheet-section')].find((s) => s.querySelector('h4').textContent === name)
      if (!section) throw new Error(`the band's card back has no ${name}`)
      ;[...sheet.children].forEach((el) => { el.style.display = el === section ? '' : 'none' })
      sheet.style.zoom = 1
      const zoom = Math.min(2.2, (sheet.clientHeight - 96) / section.getBoundingClientRect().height)
      sheet.style.zoom = zoom
      sheet.style.padding = `${48 / zoom}px ${40 / zoom}px`
      sheet.style.boxShadow = `inset 0 0 0 ${16 / zoom}px #0a0a0a, inset 0 0 0 ${32 / zoom}px #0f0f0f`
      sheet.style.borderRadius = `${22 / zoom}px`
      // Every card's title at the same size whatever its section's zoom
      section.querySelector('h4').style.zoom = 1.6 / zoom
    }, name)
    await sleep(800)
    await page.screenshot({ path: `${WORK}clue-${i}.png`, clip })
  }
  await page.close()
}

const today = async () => {
  const { gameDay } = await api('/daily')
  rmSync(WORK, { recursive: true, force: true })
  mkdirSync(`${WORK}holo`, { recursive: true })
  const browser = await chromium.launch()

  // Before a game: the onboarding's title and the Play button, alone on the README's ground
  const { page: fresh } = await openBand(browser, 0, { play: false })
  await fresh.addStyleTag({ content: TRANSPARENT })
  await fresh.mouse.move(0, 0)
  const play = fresh.locator('article.cd').getByRole('button', { name: 'Play' })
  await play.evaluate((b) => { b.dataset.readme = 'play' })
  await heroTitle(fresh, ['Guess', 'the Movie of the Day'], `${WORK}hero-guess.png`)
  await fresh.evaluate(() => {
    document.querySelector('.cd__hero-title').style.visibility = 'hidden'
    document.querySelector('[data-readme="play"]').style.visibility = 'visible'
  })
  await shot(fresh, await box(fresh, '[data-readme="play"]'), `${WORK}play.png`)
  await fresh.close()

  // Two skips in: the dock's number, the riddle's title and facts, the holo poster
  const { page } = await openBand(browser, 2)
  await page.addStyleTag({ content: `${TRANSPARENT} .band.cd { --card-w: 220px; } .cd__card-rotator, .cd__card-shine, .cd__card-glare { transition: none !important; }` })
  await page.mouse.move(0, 0)
  await sleep(600)
  await shot(page, await tight(page, '.cd__dock-header'), `${WORK}logo.png`)
  await shot(page, await box(page, '.cd__film-title .cd__pixelated'), `${WORK}title.png`)
  await shot(page, await tight(page, '.cd__meta'), `${WORK}meta.png`)

  // The holo the band shows once a game is won, driven here: flat, then one sweep of the pointer across the card,
  // the shine and the glare rising and falling on sin²
  await page.evaluate(() => {
    const card = document.querySelector('.cd__card')
    card.classList.add('is-holo', 'is-interacting')
    const front = card.querySelector('.cd__card-front')
    for (const name of ['cd__card-shine', 'cd__card-glare']) front.appendChild(Object.assign(document.createElement('div'), { className: name }))
  })
  const card = await box(page, '.cd__card', 30)
  for (let i = 0; i < HOLO_FRAMES; i++) {
    const p = i / (HOLO_FRAMES - 1)
    const t = (1 - Math.cos(p * Math.PI)) / 2
    const fade = Math.sin(p * Math.PI) ** 2
    await page.evaluate(([x, y, fade]) => {
      const card = document.querySelector('.cd__card')
      card.style.setProperty('--pointer-x', `${x * 100}%`)
      card.style.setProperty('--pointer-y', `${y * 100}%`)
      card.style.setProperty('--rotate-x', `${(x - 0.5) * 24 * fade}deg`)
      card.style.setProperty('--rotate-y', `${(0.5 - y) * 24 * fade}deg`)
      card.querySelector('.cd__card-shine').style.setProperty('opacity', `${0.35 * fade}`, 'important')
      card.querySelector('.cd__card-glare').style.setProperty('opacity', `${0.6 * fade}`, 'important')
    }, [0.15 + 0.7 * t, 0.25 + 0.5 * t, fade])
    await sleep(40)
    await shot(page, card, `${WORK}holo/${String(i).padStart(3, '0')}.png`)
  }
  await page.close()

  await clueCards(browser)

  // Yesterday's answer, kept by the reveal run of the day before
  const kept = existsSync(`${STATE}day.json`) && JSON.parse(readFileSync(`${STATE}day.json`, 'utf8')).gameDay === gameDay - 1
  if (kept) {
    mkdirSync(`${WORK}yesterday`)
    for (const name of readdirSync(STATE).filter((n) => n.endsWith('.png'))) execFileSync('cp', [`${STATE}${name}`, `${WORK}yesterday/${name}`])
  }

  // The row, shot once per holo frame: the first holds while the poster rests
  const compose = await browser.newPage({ viewport: { width: 830, height: 1200 }, deviceScaleFactor: 2 })
  await compose.goto(`file://${HERE}compose.html${kept ? '?yesterday' : ''}`)
  await compose.evaluate(() => window.ready)
  mkdirSync(`${WORK}frames`)
  for (let i = 0; i < HOLO_FRAMES; i++) {
    await compose.evaluate((i) => window.poster(i), i)
    await compose.locator('.daily').screenshot({ path: `${WORK}frames/${String(i).padStart(3, '0')}.png` })
  }
  await browser.close()
  const frames = readdirSync(`${WORK}frames`).sort().map((name) => `${WORK}frames/${name}`)
  execFileSync('img2webp', ['-loop', '0', '-lossy', '-q', '80', '-m', '6', '-d', '3000', frames[0], '-d', '40', ...frames.slice(1), '-o', OUTPUT])
  console.log('daily', gameDay, kept ? `with yesterday, daily ${gameDay - 1}` : 'without yesterday')
}

const mode = process.argv[2]
if (mode === 'reveal') await reveal()
else if (mode === 'today') await today()
else throw new Error('usage: node daily.mjs reveal|today')
