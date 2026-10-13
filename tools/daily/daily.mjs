// The README's daily row, from the live band on thcol.in and the film page on beta.cinetropes.com.
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
const API = 'https://beta.cinetropes.com/api'
const BETA = 'https://beta.cinetropes.com'
const HOLO_FRAMES = 60
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms))

const TRANSPARENT = `
  html, body, body *:not(.cd *):not(.cinetropes__tip, .cinetropes__tip *) { background: transparent !important; }
  .band.cd, .scrub { background: transparent !important; }
  .cd__backdrop, .cd__confetti { display: none !important; }
  .cd__hero-title, .cd__hero-title * { animation: none !important; opacity: 1 !important; transform: none !important; filter: none !important; }
`

// The beta speaks French only. Atmosphere's moods translate through the two apps' own tables, level by level
// (cinetropes: atmosphere-constants.ts ATMOSPHERE_ADAPTED_LABELS; thcol.in: cinetropes-radars.jsx EMOTIONS);
// Reception's verdicts come from the band's popin for the same film, the band having three levels to the beta's seven
const AXES = { Notation: 'Reception', 'Atmosphère': 'Atmosphere', Ton: 'Tone', Rythme: 'Pace', Esprit: 'Spirit', 'Sensibilité': 'Sensitivity', Ambiance: 'Ambience' }
const MOODS = [
  [['Sinistre', 'Triste', 'Mélancolique', 'Neutre', 'Positif', 'Enthousiasmant', 'Solaire'], ['Grim', 'Sad', 'Melancholic', 'Neutral', 'Upbeat', 'Uplifting', 'Radiant']],
  [['Immobile', 'Contemplatif', 'Cadencé', 'Captivant', 'Entraînant', 'Intense', 'Haletant'], ['Still', 'Contemplative', 'Measured', 'Gripping', 'Rousing', 'Intense', 'Breathless']],
  [['Chaleureux', 'Harmonieux', 'Bienveillant', 'Révoltant', 'Indigné', 'Percutant', 'Rageur'], ['Warm', 'Harmonious', 'Kind', 'Outrageous', 'Indignant', 'Hard-hitting', 'Furious']],
  [['Sublimé', 'Épuré', 'Lisse', 'Dérangeant', 'Viscéral', 'Macabre', 'Répugnant'], ['Sublimated', 'Pared-back', 'Smooth', 'Disturbing', 'Visceral', 'Macabre', 'Repulsive']],
  [['Jovial', 'Léger', 'Distrayant', 'Touchant', 'Émouvant', 'Poignant', 'Déchirant'], ['Jovial', 'Light', 'Diverting', 'Touching', 'Moving', 'Poignant', 'Heartbreaking']],
  [['Paisible', 'Calme', 'Détendu', 'Angoissant', 'Tendu', 'Effrayant', 'Terrifiant'], ['Peaceful', 'Calm', 'Relaxed', 'Unsettling', 'Tense', 'Frightening', 'Terrifying']],
  [['Oppressant', 'Inquiétant', 'Suspect', 'Intrigant', 'Sûr', 'Rassurant', 'Réconfortant'], ['Oppressive', 'Disquieting', 'Suspicious', 'Intriguing', 'Safe', 'Reassuring', 'Comforting']],
  [['Linéaire', 'Attendu', 'Prévisible', 'Inattendu', 'Surprenant', 'Déroutant', 'Sidérant'], ['Linear', 'Expected', 'Predictable', 'Unexpected', 'Surprising', 'Disorienting', 'Stunning']],
]
const ENGLISH = { ...AXES, ...Object.fromEntries(MOODS.flatMap(([fr, en]) => fr.map((word, i) => [word, en[i]]))) }
// cinetropes: notation-constants.ts NOTATION_ADAPTED_LABELS and NOTATION_IMPACT_LABELS
const VERDICTS = new Set(['Assassiné', 'Descendu', 'Boudé', 'Estimé', 'Salué', 'Acclamé', 'Triomphe', 'Détesté', 'Oublié', 'Ignoré', 'Apprécié', 'Validé', 'Populaire', 'Adoré', 'Méprisé', 'Méconnu', 'Conventionnel', 'Reconnu', 'Défendu', 'Culte', 'Intouchable'])

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

// One section of the beta's card back per card: the chart centred on top, its values under it, zoomed as far as the
// card's height allows, in English
const clueCards = async (browser, slug, verdicts) => {
  const page = await browser.newPage({ viewport: { width: 1440, height: 1100 }, deviceScaleFactor: 2 })
  await page.goto(`${BETA}/film/${slug}`, { waitUntil: 'networkidle' })
  await sleep(1000)
  await page.mouse.click(340, 540)
  await sleep(2500)
  await page.mouse.click(720, 987)
  await sleep(2500)
  await page.evaluate(([english, verdicts, known]) => {
    const content = document.querySelector('.card__back-content')
    const walker = document.createTreeWalker(content, NodeFilter.SHOW_TEXT)
    let v = 0
    for (let n = walker.nextNode(); n; n = walker.nextNode()) {
      const word = n.nodeValue.trim().replace(/^["“«\s]+|["”»\s]+$/g, '')
      if (known.includes(word) && verdicts[v]) n.nodeValue = n.nodeValue.replace(word, verdicts[v++])
      else if (english[word]) n.nodeValue = n.nodeValue.replace(word, english[word])
    }
  }, [ENGLISH, verdicts, [...VERDICTS]])
  const clip = await page.evaluate(() => {
    const r = document.querySelector('.card__back-content-overlay').getBoundingClientRect()
    return { x: r.x - 47, y: r.y - 36, width: r.width + 94, height: r.height + 72 }
  })
  for (let i = 0; i < 3; i++) {
    await page.evaluate((i) => {
      const content = document.querySelector('.card__back-content')
      const sections = [...content.querySelectorAll('.card__back-section')]
      ;[...content.children].forEach((el) => { el.style.display = el.contains(sections[i]) || el === sections[i] ? '' : 'none' })
      sections.forEach((s, k) => { s.style.display = k === i ? '' : 'none' })
      const row = sections[i].children[1]
      Object.assign(row.style, { flexDirection: 'column', alignItems: 'center', gap: '14px' })
      const list = row.lastElementChild
      list.style.width = '100%'
      // Atmosphere's eight axes on two columns, each axis on two lines, its name then its bar
      if (list.children.length === 8) {
        Object.assign(list.style, { display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', columnGap: '2px' })
        list.querySelectorAll('*').forEach((el) => { el.style.minWidth = '0' })
        list.querySelectorAll(':scope > * > .flex').forEach((line) => {
          line.style.flexWrap = 'wrap'
          ;[...line.children].slice(2).forEach((bar) => Object.assign(bar.style, { flexBasis: 'calc(100% - 16px)', marginLeft: '16px', flexGrow: '0' }))
        })
      }
      // The tropes keep their first four, first occurrence of each
      const seen = new Set()
      if (i === 2) [...list.children].forEach((el) => {
        const name = el.firstElementChild?.innerText.trim()
        if (!name || seen.has(name) || seen.size >= 4) el.style.display = 'none'
        else seen.add(name)
      })
      sections[i].querySelector('.card__back-section-title').style.textAlign = 'center'
      content.style.zoom = 1
      Object.assign(content.style, { paddingLeft: '6px', paddingRight: '6px' })
      content.scrollTop = 0
      const zoom = Math.min(2.2, (content.clientHeight - 24) / sections[i].getBoundingClientRect().height)
      content.style.zoom = zoom
      // Every card's title at the same size whatever its section's zoom
      sections[i].querySelector('.card__back-section-title').style.zoom = 1.6 / zoom
    }, i)
    await sleep(2500)
    await page.screenshot({ path: `${WORK}clue-${i}.png`, clip })
  }
  await page.close()
}

const today = async () => {
  const { gameDay } = await api('/daily')
  const { slug } = await api('/daily/reveal')
  rmSync(WORK, { recursive: true, force: true })
  mkdirSync(`${WORK}holo`, { recursive: true })
  const browser = await chromium.launch()

  // Before a game: the onboarding's title and the Play button, alone on the README's ground
  const { page: fresh } = await openBand(browser, 0, { play: false })
  await fresh.addStyleTag({ content: TRANSPARENT })
  await fresh.mouse.move(0, 0)
  const play = fresh.locator('article.cd').getByRole('button', { name: 'Play' })
  await play.evaluate((b) => { b.dataset.readme = 'play' })
  await heroTitle(fresh, ['Guess', 'the Movie'], `${WORK}hero-guess.png`)
  await fresh.evaluate(() => {
    document.querySelector('.cd__hero-title').style.visibility = 'hidden'
    document.querySelector('[data-readme="play"]').style.visibility = 'visible'
  })
  await shot(fresh, await box(fresh, '[data-readme="play"]'), `${WORK}play.png`)
  await fresh.close()

  // Two skips in: the dock's number, the riddle's title and facts, the popins' verdicts, the holo poster
  const { page, band } = await openBand(browser, 2)
  await page.addStyleTag({ content: `${TRANSPARENT} .band.cd { --card-w: 220px; } .cd__card-rotator, .cd__card-shine, .cd__card-glare { transition: none !important; }` })
  await page.mouse.move(0, 0)
  await sleep(600)
  await shot(page, await tight(page, '.cd__dock-header'), `${WORK}logo.png`)
  await shot(page, await box(page, '.cd__film-title .cd__pixelated'), `${WORK}title.png`)
  await shot(page, await tight(page, '.cd__meta'), `${WORK}meta.png`)
  await band.locator('.cd__signature figure .cinetropes__glyph').first().click()
  await sleep(600)
  const verdicts = await page.locator('.cinetropes__tip-rows li small').allInnerTexts()
  await page.keyboard.press('Escape')
  await page.mouse.move(0, 0)
  await sleep(400)

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

  await clueCards(browser, slug, verdicts)

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
