import { createRequire } from 'node:module'
const require = createRequire('/Users/thcolin/Projects/perso/thcol.in/package.json')
export const { chromium } = require('playwright')
export const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

// The beta's CORS answers https://thcol.in only: its requests are made from Node and handed back to the page.
// POST /daily/guess never reaches the beta: `guess` answers it, so no guess is ever recorded
export const proxyApi = (page, { guess } = {}) => page.route('https://beta.cinetropes.com/api/**', async (route) => {
  const req = route.request()
  const cors = { 'access-control-allow-origin': '*', 'access-control-allow-headers': '*', 'access-control-allow-methods': 'GET, POST, OPTIONS' }
  if (req.method() === 'OPTIONS') return route.fulfill({ status: 204, headers: cors })
  if (req.method() === 'POST' && req.url().endsWith('/daily/guess')) {
    if (!guess) return route.abort()
    return route.fulfill({ status: 200, headers: { ...cors, 'content-type': 'application/json' }, body: JSON.stringify(guess(JSON.parse(req.postData()))) })
  }
  const res = await fetch(req.url(), { headers: { 'Accept-Language': 'en' } })
  const body = Buffer.from(await res.arrayBuffer())
  await route.fulfill({ status: res.status, headers: { ...cors, 'content-type': res.headers.get('content-type') ?? 'application/octet-stream' }, body })
})

// The band's state for the README: Play, then `skips` real clicks on Skip
export const openDaily = async (page, skips) => {
  await page.goto('http://localhost:8082/#projects', { waitUntil: 'networkidle' })
  await page.evaluate(() => document.getElementById('cinetropes-daily').scrollIntoView({ behavior: 'instant' }))
  const band = page.locator('article.cd')
  await band.getByRole('button', { name: 'Play' }).click()
  await sleep(800)
  for (let i = 0; i < skips; i++) {
    await band.getByRole('button', { name: 'Skip' }).click()
    await sleep(1800)
  }
  await page.evaluate(() => document.fonts.ready)
  return band
}
