import { createRequire } from 'node:module'
const require = createRequire('/Users/thcolin/Projects/perso/thcol.in/package.json')
export const { chromium } = require('playwright')

// Virtual time: page.clock drives timers and rAF; CSS animations are paused and set from the same clock
export const setupClock = async (page) => {
  // install() alone lets the clock flow with real time: paused, it only moves with runFor
  await page.clock.install({ time: new Date('2026-10-13T12:00:00') })
  await page.clock.pauseAt(new Date('2026-10-13T12:00:01'))
}

export const syncAnimations = (page) => page.evaluate(() => {
  const now = performance.now()
  window.__seen ||= new WeakMap()
  for (const a of document.getAnimations()) {
    if (!window.__seen.has(a)) window.__seen.set(a, now)
    a.pause()
    a.currentTime = now - window.__seen.get(a)
  }
})

export const settleImages = (page, scope = 'body') => page.evaluate(async (scope) => {
  await document.fonts.ready
  const imgs = [...document.querySelectorAll(scope + ' img')].filter((i) => i.getBoundingClientRect().width > 0 && !i.complete)
  await Promise.all(imgs.map((i) => new Promise((r) => { i.onload = i.onerror = r })))
}, scope)

// Advance virtual time by ms in rAF-sized steps, keeping CSS animations in sync
export const tick = async (page, ms, step = 16) => {
  for (let t = 0; t < ms; t += step) {
    await page.clock.runFor(Math.min(step, ms - t))
    await syncAnimations(page)
  }
}
