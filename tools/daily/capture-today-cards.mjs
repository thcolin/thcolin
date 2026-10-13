import { chromium, sleep } from './lib.mjs'

// Today's three clue cards for the README: the card back of cinetropes' film page, one section per card, restyled
// for a narrow card: the chart centred on top, its values under it, the whole zoomed as far as the card's height allows. The header is hidden: the title is the riddle
const PARTS = new URL('./parts/', import.meta.url).pathname
const [slug = 'spirited-away', day = '195', max = '2.2'] = process.argv.slice(2)
// The beta speaks French only; the README speaks English. Each word is the one thcol.in's band shows for the same
// film (#195), in its Reception, Atmosphere and Tropes popins
const ENGLISH = {
  Notation: 'Reception', 'Atmosphère': 'Atmosphere',
  'Acclamé': 'Acclaimed', Populaire: 'Popular', Culte: 'Cult',
  Ton: 'Tone', Rythme: 'Pace', Esprit: 'Spirit', 'Sensibilité': 'Sensitivity', Ambiance: 'Ambience',
  Positif: 'Upbeat', Captivant: 'Gripping', Harmonieux: 'Harmonious', Lisse: 'Smooth',
  Touchant: 'Touching', Angoissant: 'Unsettling', 'Sûr': 'Safe', Inattendu: 'Unexpected',
}
const browser = await chromium.launch()
const page = await browser.newPage({ viewport: { width: 1440, height: 1100 }, deviceScaleFactor: 2 })
await page.goto(`https://beta.cinetropes.com/film/${slug}`, { waitUntil: 'networkidle' })
await sleep(1000)
await page.mouse.click(340, 540)
await sleep(2500)
await page.mouse.click(720, 987)
await sleep(2500)
await page.evaluate((english) => {
  const walker = document.createTreeWalker(document.querySelector('.card__back-content'), NodeFilter.SHOW_TEXT)
  for (let n = walker.nextNode(); n; n = walker.nextNode()) {
    // A word alone, or between the quotes the app sets around an axis' mood
    const word = n.nodeValue.trim().replace(/^["“«\s]+|["”»\s]+$/g, '')
    if (english[word]) n.nodeValue = n.nodeValue.replace(word, english[word])
  }
}, ENGLISH)
const box = await page.evaluate(() => {
  const r = document.querySelector('.card__back-content-overlay').getBoundingClientRect()
  return { x: r.x - 47, y: r.y - 36, width: r.width + 94, height: r.height + 72 }
})
for (let i = 0; i < 3; i++) {
  const used = await page.evaluate(([i, max]) => {
    const content = document.querySelector('.card__back-content')
    const sections = [...content.querySelectorAll('.card__back-section')]
    ;[...content.children].forEach((el) => { el.style.display = el.contains(sections[i]) || el === sections[i] ? '' : 'none' })
    sections.forEach((s, k) => { s.style.display = k === i ? '' : 'none' })
    const row = sections[i].children[1]
    Object.assign(row.style, { flexDirection: 'column', alignItems: 'center', gap: '14px' })
    row.lastElementChild.style.width = '100%'
    // Atmosphere's eight axes on two columns, so the card can zoom as far as the others
    if (row.lastElementChild.children.length === 8) {
      Object.assign(row.lastElementChild.style, { display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', columnGap: '2px' })
      row.lastElementChild.querySelectorAll('*').forEach((el) => { el.style.minWidth = '0' })
      // Each axis on two lines: the dot and its name, then its bar
      row.lastElementChild.querySelectorAll(':scope > * > .flex').forEach((line) => {
        line.style.flexWrap = 'wrap'
        ;[...line.children].slice(2).forEach((bar) => Object.assign(bar.style, { flexBasis: 'calc(100% - 16px)', marginLeft: '16px', flexGrow: '0' }))
      })
    }
    // The tropes keep their first four, first occurrence of each, so the card can zoom
    const seen = new Set()
    if (i === 2) [...row.lastElementChild.children].forEach((el) => {
      const name = el.firstElementChild?.innerText.trim()
      if (!name || seen.has(name) || seen.size >= 4) el.style.display = 'none'
      else seen.add(name)
    })
    sections[i].querySelector('.card__back-section-title').style.textAlign = 'center'
    content.style.zoom = 1
    Object.assign(content.style, { paddingLeft: '6px', paddingRight: '6px' })
    content.scrollTop = 0
    const room = content.clientHeight - 24
    const zoom = Math.min(max, room / sections[i].getBoundingClientRect().height)
    content.style.zoom = zoom
    // Every card's title at the same size whatever its section's zoom
    sections[i].querySelector('.card__back-section-title').style.zoom = 1.6 / zoom
    return { zoom, overflow: content.scrollHeight - content.clientHeight }
  }, [i, Number(max)])
  console.log(day, i, used)
  await sleep(2500)
  await page.screenshot({ path: `${PARTS}clue-${i}-${day}.png`, clip: box })
}
await browser.close()
