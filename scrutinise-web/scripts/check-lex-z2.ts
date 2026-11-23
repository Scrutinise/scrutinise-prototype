// ─────────────────────────────────────────────────────────────────────────────
// check:lex-z2 — LEX Z2 (BRIEF_26Z §6.3, §7 item 8; decisions 361–363). Counts what RAN (§23.2): ran, passed, controls fired, dead, not run.
// Spends NOTHING (no model call: the Lex route in the browser part is the check's own stand-in, and only its request ORDER is measured).
//
//   A · the pure rules: conflicts (offline-conflict), the overlay and the base an edit carries (offline-queue), the worker's page key
//   B · the real route: /api/ideas/[id]/actions refuses an offline edit whose base changed (409, both versions, nothing written), and
//       applies one whose base did not — on a scratch copy of 452c5ade (452c5ade itself is never written)
//   C · the REAL worker (public/lex-sw.js) in Chromium, on the check's own HTTP server: offline reload shows the kept page with its time; an
//       edit made offline is queued, shown, survives a reload; back online THE QUEUE GOES FIRST (the edit reaches the server before any
//       fresh read); a server change made meanwhile is a CONFLICT with both versions, nothing overwritten; "Use mine" then saves it; a
//       write that cannot queue is refused in words; a Lex message waits for one tap; a different user clears what is kept; a page never
//       opened says so; a signed-out answer clears everything; a "deploy" is served fresh, never hidden behind the kept copy.
//
//   npm run check:lex-z2
// ─────────────────────────────────────────────────────────────────────────────

import http from 'node:http'
import { readFileSync, existsSync } from 'node:fs'
import { join } from 'node:path'
import vm from 'node:vm'
import { build } from 'esbuild'
import { conflictsOf, conflictWords } from '../lib/lex/offline-conflict'
import { overlayActions, actionEditBody, type Queued } from '../lib/lex/offline-queue'
import { OFFLINE_UI } from '../lib/lex/screen-labels'
import { STORE_KEY } from '../lib/lex/where-am-i'
import manifest from '../app/manifest'
import { guideEntries } from '../lib/lex/field-guide'

let pass = 0, fail = 0, ran = 0, controls = 0, dead = 0, notRun = 0
function ok(name: string, cond: boolean, detail = '') { ran++; if (cond) { pass++; console.log(`  ✓ ${name}`) } else { fail++; console.log(`  ✗ ${name}${detail ? `\n      ${detail}` : ''}`) } }
function control(name: string, propertyHolds: boolean) { controls++; if (propertyHolds) { dead++; console.log(`  ✗ DEAD CONTROL — ${name}`) } else console.log(`  · control fired — ${name}`) }
function skip(name: string, why: string) { notRun++; console.log(`  – NOT RUN — ${name} (${why})`) }
const section = (s: string) => console.log(`\n── ${s} ──`)
const ROOT = join(__dirname, '..')
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))

function partA() {
  section('A · the pure rules')
  const c1 = conflictsOf({ practicalStep: 'base' }, { practicalStep: 'changed by Lex' }, { practicalStep: 'mine' })
  ok('a field changed on the server since the edit\'s base is a conflict, with both versions', c1.length === 1 && c1[0].server === 'changed by Lex' && c1[0].mine === 'mine' && c1[0].words === 'the action statement')
  ok('…unchanged since the base: no conflict', conflictsOf({ practicalStep: 'base' }, { practicalStep: 'base' }, { practicalStep: 'mine' }).length === 0)
  ok('…the server already holds my text (the same change twice): no conflict', conflictsOf({ practicalStep: 'base' }, { practicalStep: 'mine' }, { practicalStep: 'mine' }).length === 0)
  ok('…no base (an online edit): never a conflict', conflictsOf(undefined, { practicalStep: 'x' }, { practicalStep: 'y' }).length === 0)
  ok('…empty and null details are the same text', conflictsOf({ commentary: null }, { commentary: '' }, { commentary: 'mine' }).length === 0)
  ok('the refusal names the field and says nothing was overwritten', /the action details changed on the server while you were offline.*Nothing has been overwritten/.test(conflictWords(conflictsOf({ commentary: 'a' }, { commentary: 'b' }, { commentary: 'c' }))))
  const body = actionEditBody({ action: 'update', actionId: 'a1', practicalStep: 'new' }, { practicalStep: 'old', commentary: 'd' })
  ok('an offline action edit carries the base of exactly the fields it edits', JSON.stringify(body.expect) === JSON.stringify({ practicalStep: 'old' }), JSON.stringify(body))
  const q: Queued[] = [
    { id: '1', kind: 'edit', ideaId: 'x', userId: null, url: '/api/ideas/x/actions', body: { action: 'update', actionId: 'a1', practicalStep: 'first', expect: { practicalStep: 'old' } }, words: '', at: '', status: 'waiting' },
    { id: '2', kind: 'edit', ideaId: 'x', userId: null, url: '/api/ideas/x/actions', body: { action: 'update', actionId: 'a1', practicalStep: 'second', expect: { practicalStep: 'first' } }, words: '', at: '', status: 'waiting' },
    { id: '3', kind: 'edit', ideaId: 'x', userId: null, url: '/api/ideas/x/actions', body: { action: 'update', actionId: 'a2', practicalStep: 'conflicted' }, words: '', at: '', status: 'conflict' },
  ]
  const over = overlayActions([{ id: 'a1', practicalStep: 'old' }, { id: 'a2', practicalStep: 'server' }], q)
  ok('the overlay shows waiting edits in order (the later one wins), and never a conflicted one (the server\'s copy stays until the owner chooses)', over[0].practicalStep === 'second' && over[1].practicalStep === 'server', JSON.stringify(over))
  ok('…and leaves no `expect` or `action` on the action', !('expect' in over[0]) && !('action' in over[0]))
  // the worker's page key, from the worker's own source
  const sandbox: Record<string, unknown> = { self: { addEventListener: () => {}, location: { origin: 'http://z2.test' } }, URL, Headers, Response, caches: {}, fetch: () => {} }
  vm.runInNewContext(readFileSync(join(ROOT, 'public/lex-sw.js'), 'utf8'), sandbox)
  const key = (sandbox.self as { lexPageKey: (u: string) => string }).lexPageKey
  ok('the worker keeps a page by what it is, not where the reader is in it (panel and hash dropped, parameters sorted)', key('http://z2.test/ideas/create?panel=3&ideaId=fx&view=drafting#12') === 'http://z2.test/ideas/create?ideaId=fx&view=drafting', key('http://z2.test/ideas/create?panel=3&ideaId=fx&view=drafting#12'))
  control('…two different ideas share a key (must be FALSE)', key('http://z2.test/ideas/create?ideaId=a') === key('http://z2.test/ideas/create?ideaId=b'))
  // the words: every new label has its guide entry
  const keys = new Set(guideEntries().map((e) => e.key))
  ok('every OFFLINE_UI label has a field-guide entry', (Object.keys(OFFLINE_UI) as string[]).every((k) => keys.has(`offline.${k}`)), (Object.keys(OFFLINE_UI) as string[]).filter((k) => !keys.has(`offline.${k}`)).join(', '))
  const sw = readFileSync(join(ROOT, 'public/lex-sw.js'), 'utf8')
  ok('361: the worker never handles a write (it returns before respondWith for anything but GET)', /if \(req\.method !== 'GET'\) return/.test(sw))
  const reg = readFileSync(join(ROOT, 'lib/lex/offline.ts'), 'utf8')
  ok('361: the worker is registered with scope /ideas/ — never Central\'s pages', /LEX_SW_SCOPE = '\/ideas\/'/.test(reg) && /register\(LEX_SW_URL, \{ scope: LEX_SW_SCOPE \}\)/.test(reg))

  // §6.4 (364/366) — installable: the manifest opens at My ideas, and every icon it names is a real file of the size it declares
  const m = manifest()
  ok('§6.4: the manifest opens at /ideas/mine, standalone, on the brand background', m.start_url === '/ideas/mine' && m.display === 'standalone' && m.background_color === '#12302E' && m.theme_color === '#12302E', JSON.stringify(m).slice(0, 200))
  const pngSize = (f: string) => { const b = readFileSync(f); return b.toString('ascii', 1, 4) === 'PNG' ? `${b.readUInt32BE(16)}x${b.readUInt32BE(20)}` : 'not a png' }
  const iconFaults = (m.icons ?? []).flatMap((ic) => {
    const f = join(ROOT, 'public', ic.src)
    try { if (ic.type === 'image/png' && pngSize(f) !== ic.sizes) return [`${ic.src}: ${pngSize(f)} not ${ic.sizes}`]; readFileSync(f); return [] } catch { return [`${ic.src}: missing`] }
  })
  ok('…every icon it names exists, at the size it declares (192, 512, a maskable 512, and the SVG)', iconFaults.length === 0 && (m.icons ?? []).some((ic) => ic.purpose === 'maskable' && ic.sizes === '512x512'), iconFaults.join('; '))
  control('…a planted 192 icon declared as 512 is caught', pngSize(join(ROOT, 'public/icons/scrutinise-icon-192.png')) === '512x512')
  // 366 settled (CCh 2212Z, option C): the chosen mark everywhere: the manifest's icons, the tab icon (app/icon.png, every page,
  //   Central's too) and the iPhone icon (app/apple-icon.png, 180). The stock preview and the placeholder scales are archived.
  ok('366: the tab icon is 64 px and the iPhone icon 180 px; the stock preview and the placeholder scales are out of public/', pngSize(join(ROOT, 'app/icon.png')) === '64x64' && pngSize(join(ROOT, 'app/apple-icon.png')) === '180x180' && !existsSync(join(ROOT, 'public/ScalesIcon.webp')) && !existsSync(join(ROOT, 'public/icons/scrutinise-scales.svg')))
  // 2145Z point 6: no C2PA stamp ships (it misdescribes CCh's own drawing): no caBX chunk in a PNG, no <metadata> / c2pa in an SVG
  const chunksOf = (b: Buffer) => { const out: string[] = []; let o = 8; while (o < b.length) { const len = b.readUInt32BE(o); out.push(b.toString('ascii', o + 4, o + 8)); o += 12 + len } return out }
  const chunks = (f: string) => chunksOf(readFileSync(f))
  const shipped = [...(m.icons ?? []).map((ic) => join(ROOT, 'public', ic.src)), join(ROOT, 'app/icon.png'), join(ROOT, 'app/apple-icon.png')]
  const stamped = shipped.filter((f) => (f.endsWith('.png') ? chunks(f).includes('caBX') : /<metadata|c2pa/i.test(readFileSync(f, 'utf8'))))
  ok('2145Z §6: no shipped icon carries a C2PA stamp (PNG caBX chunk, SVG <metadata>)', stamped.length === 0, stamped.join(', '))
  control('…a caBX chunk planted after IHDR goes unseen (must be FALSE)', !(() => {
    const b = readFileSync(join(ROOT, 'app/icon.png')); const ihdrEnd = 8 + 12 + b.readUInt32BE(8)
    const body = Buffer.from('planted'); const head = Buffer.alloc(8); head.writeUInt32BE(body.length, 0); head.write('caBX', 4, 'ascii')
    return chunksOf(Buffer.concat([b.subarray(0, ihdrEnd), head, body, Buffer.alloc(4), b.subarray(ihdrEnd)])).includes('caBX')
  })())
}

async function partB() {
  section('B · the real route, on a scratch copy of 452c5ade')
  const { prisma } = await import('../lib/prisma')
  const { scratchCopy, deleteScratch } = await import('./lib/scratch-copy')
  let scratch: { id: string; userId: string } | null = null
  try { scratch = await scratchCopy('452c5ade', 'z2-offline') } catch (e) { skip('the route', `no scratch copy: ${(e as Error).message.slice(0, 120)}`); return }
  try {
    ;(globalThis as { __STUB_AUTH_USER?: unknown }).__STUB_AUTH_USER = await prisma.user.findUnique({ where: { id: scratch.userId } })
    const params = { params: Promise.resolve({ id: scratch.id }) }
    const { POST } = await import('../app/api/ideas/[id]/actions/route')
    const call = async (body: unknown) => { const r = await POST(new Request('http://x', { method: 'POST', body: JSON.stringify(body) }), params); return { status: r.status, json: (await r.json()) as { error?: string; conflict?: Array<{ server: string; mine: string }> } } }
    const a = await prisma.lexCoherentAction.findFirst({ where: { ideaId: scratch.id, status: 'LIVE' }, orderBy: { number: 'asc' }, select: { id: true, practicalStep: true } })
    if (!a) { skip('the route', 'the scratch copy has no live action'); return }
    const base = a.practicalStep
    await prisma.lexCoherentAction.update({ where: { id: a.id }, data: { practicalStep: 'Changed by Lex while the owner was offline (z2 check)' } })
    const r1 = await call({ action: 'update', actionId: a.id, practicalStep: 'Mine, written offline (z2 check)', expect: { practicalStep: base } })
    const after1 = (await prisma.lexCoherentAction.findUnique({ where: { id: a.id }, select: { practicalStep: true } }))!.practicalStep
    ok('an offline edit whose base changed is refused 409, with both versions', r1.status === 409 && r1.json.conflict?.[0]?.server === 'Changed by Lex while the owner was offline (z2 check)' && r1.json.conflict?.[0]?.mine === 'Mine, written offline (z2 check)', JSON.stringify(r1).slice(0, 300))
    ok('…and nothing was written: the server keeps the other change', after1 === 'Changed by Lex while the owner was offline (z2 check)', after1)
    const r2 = await call({ action: 'update', actionId: a.id, practicalStep: 'Mine, written offline (z2 check)', expect: { practicalStep: 'Changed by Lex while the owner was offline (z2 check)' } })
    const after2 = (await prisma.lexCoherentAction.findUnique({ where: { id: a.id }, select: { practicalStep: true } }))!.practicalStep
    ok('an offline edit whose base is unchanged applies, through the normal route', r2.status === 200 && after2 === 'Mine, written offline (z2 check)', `${r2.status} ${after2}`)
    const r3 = await call({ action: 'update', actionId: a.id, practicalStep: 'Online edit (z2 check)' })
    ok('an online edit (no base) is unchanged by Z2: it applies as before', r3.status === 200)
    const r4 = await call({ action: 'update', actionId: a.id, practicalStep: 'x'.repeat(5000), expect: { practicalStep: 'Online edit (z2 check)' } })
    ok('…and a queued edit still meets the route\'s own refusal rules (an over-long statement is refused, 422)', r4.status === 422, String(r4.status))
  } finally {
    ;(globalThis as { __STUB_AUTH_USER?: unknown }).__STUB_AUTH_USER = undefined
    console.log(`  (scratch copy deleted: ${await deleteScratch(scratch.id)})`)
  }
}

// ── C · the browser, on the check's own HTTP server ──
type A = { id: string; number: number; practicalStep: string; commentary: string | null }
async function partC() {
  section('C · the REAL worker in Chromium')
  let chromium: typeof import('playwright').chromium
  try { chromium = (await import('playwright')).chromium } catch (e) { skip('the browser section', `playwright is not loadable: ${(e as Error).message}`); return }
  const bundle = (await build({ entryPoints: [join(ROOT, 'scripts/fixtures/offline-harness-entry.tsx')], bundle: true, write: false, format: 'iife', jsx: 'automatic', platform: 'browser', define: { 'process.env.NODE_ENV': '"production"' }, logLevel: 'silent', tsconfig: join(ROOT, 'tsconfig.json') })).outputFiles[0].text
  const sw = readFileSync(join(ROOT, 'public/lex-sw.js'), 'utf8')

  // the server: what a fresh page and a fresh read return, the log of what reached it, and its switches
  const srv = {
    actions: [{ id: 'a1', number: 1, practicalStep: 'Register every landlord', commentary: null }, { id: 'a2', number: 2, practicalStep: 'Fine unregistered landlords', commentary: null }] as A[],
    version: 'v1', down: false, signedOut: false, log: [] as string[],
  }
  const page = (v: string) => `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>z2</title></head><body data-build="${v}"><div id="root"></div><script src="/_next/static/chunks/harness.js"></script></body></html>`
  const server = http.createServer(async (req, res) => {
    const url = new URL(req.url!, 'http://localhost')
    if (srv.down) { req.socket.destroy(); return }
    let body = ''
    for await (const chunk of req) body += chunk
    srv.log.push(`${req.method} ${url.pathname}`)
    const json = (s: number, o: unknown) => { res.writeHead(s, { 'content-type': 'application/json' }); res.end(JSON.stringify(o)) }
    if (url.pathname === '/_next/static/chunks/harness.js') { res.writeHead(200, { 'content-type': 'text/javascript' }); res.end(bundle); return }
    if (url.pathname === '/lex-sw.js') { res.writeHead(200, { 'content-type': 'text/javascript' }); res.end(sw); return }
    if (url.pathname.startsWith('/ideas/')) {
      if (srv.signedOut) { res.writeHead(401, { 'content-type': 'text/html' }); res.end('<!doctype html><html><head></head><body>sign in</body></html>'); return }
      res.writeHead(200, { 'content-type': 'text/html; charset=utf-8' }); res.end(page(srv.version)); return
    }
    if (url.pathname === '/api/ideas/fx/state') return json(200, { actions: srv.actions, v: srv.version })
    if (url.pathname === '/api/ideas/fx/actions' && req.method === 'POST') {
      const b = JSON.parse(body) as { actionId: string; practicalStep: string; expect?: { practicalStep?: string } }
      const a = srv.actions.find((x) => x.id === b.actionId)!
      const conflicts = conflictsOf(b.expect, a, b)
      if (conflicts.length) return json(409, { error: conflictWords(conflicts), conflict: conflicts })
      a.practicalStep = b.practicalStep
      return json(200, { state: { actions: srv.actions, v: srv.version } })
    }
    if (url.pathname === '/api/ideas/fx/lex') return json(200, { chatText: 'ok' })
    return json(404, { error: 'not here' })
  })
  await new Promise<void>((r) => server.listen(0, '127.0.0.1', () => r()))
  const port = (server.address() as { port: number }).port
  const ORIGIN = `http://localhost:${port}`
  const IDEA = `${ORIGIN}/ideas/create?ideaId=fx`

  let browser
  try { browser = await chromium.launch() } catch (e) { skip('the browser section', `Chromium would not launch: ${(e as Error).message.slice(0, 120)}`); server.close(); return }
  const errors: string[] = []
  try {
    const context = await browser.newContext({ viewport: { width: 390, height: 844 } })
    const p = await context.newPage()
    p.on('pageerror', (e) => errors.push(e.message))
    const offline = async (on: boolean) => { srv.down = on; await context.setOffline(on); await sleep(150) }
    const text = (sel: string) => p.locator(sel).first().innerText().catch(() => '')
    const statementOf = (id: string) => text(`[data-action="${id}"]`)
    const cacheNames = () => p.evaluate(() => caches.keys())
    const queueOf = () => p.evaluate(() => JSON.parse(localStorage.getItem('lex.offline.queue.v1') ?? '[]') as Array<{ status: string; userId: string | null; body: { expect?: unknown } }>)

    // 1 · online first: the worker registers (scope /ideas/) and, after one reload, controls the page and has kept it
    await p.goto(IDEA); await p.waitForSelector('[data-action="a1"]')
    await p.evaluate(() => navigator.serviceWorker.ready)
    await p.reload(); await p.waitForSelector('[data-action="a1"]')
    const scope = await p.evaluate(async () => (await navigator.serviceWorker.getRegistration())?.scope ?? '')
    ok('the worker is registered, scope /ideas/', scope === `${ORIGIN}/ideas/`, scope)
    ok('…and controls Lex\'s page', await p.evaluate(() => !!navigator.serviceWorker.controller))
    const keptAt = new Date()

    // 2 · offline: a reload shows the kept page, marked with its time
    await offline(true)
    await p.reload(); await p.waitForSelector('[data-action="a1"]', { timeout: 8000 })
    const strip = await text('[data-offline-state]')
    const hhmm = (d: Date) => `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
    ok('offline, a reload shows the kept page and its data, marked "Offline — last updated HH:MM" (the time it was fetched)', strip.includes('Offline — last updated') && [hhmm(keptAt), hhmm(new Date(keptAt.getTime() - 60000))].some((t) => strip.includes(t)) && (await statementOf('a1')) === 'Register every landlord', strip)
    ok('…the page came from the worker\'s copy (it carries the stamp)', await p.evaluate(() => !!document.querySelector('meta[name="lex-offline-cached-at"]')))

    // 3 · an edit made offline is queued, with its base, and shown
    await p.evaluate(() => (window as unknown as { __edit: (i: string, t: string) => Promise<void> }).__edit('a1', 'Register every landlord within 30 days'))
    await sleep(200)
    ok('an action edit made offline is shown at once and says it will send', (await statementOf('a1')) === 'Register every landlord within 30 days' && (await text('[data-msg]')) === OFFLINE_UI.queued)
    const q1 = await queueOf()
    ok('…it is queued with the value it was made on (its base)', q1.length === 1 && JSON.stringify(q1[0].body.expect) === JSON.stringify({ practicalStep: 'Register every landlord' }), JSON.stringify(q1))
    ok('…the strip counts it', (await text('[data-offline-state]')).includes(OFFLINE_UI.waiting(1)))
    await p.reload(); await p.waitForSelector('[data-action="a1"]', { timeout: 8000 })
    ok('…and it survives a reload offline (still shown, still waiting)', (await statementOf('a1')) === 'Register every landlord within 30 days' && (await text('[data-offline-state]')).includes(OFFLINE_UI.waiting(1)))

    // 4 · a write that cannot queue is refused in words, and never reaches the server
    const before = srv.log.length
    await p.evaluate(() => (window as unknown as { __other: () => Promise<void> }).__other()); await sleep(200)
    ok('a write that cannot wait is refused in words ("this needs the connection … nothing was changed")', (await text('[data-msg]')) === OFFLINE_UI.needsConnection, await text('[data-msg]'))
    ok('…and nothing reached the server', srv.log.length === before)

    // 5 · meanwhile, the server's copy changes (another device, or Lex); then back online — the queue goes first
    srv.actions[0].practicalStep = 'Register every landlord and letting agent'
    srv.log = []
    await offline(false)
    await p.waitForSelector('[data-offline-conflict]', { timeout: 8000 })
    const firstAfter = srv.log.filter((l) => !/harness|lex-sw/.test(l))
    ok('363: back online, THE QUEUE GOES FIRST: the queued edit reached the server before any fresh read', firstAfter[0] === 'POST /api/ideas/fx/actions', JSON.stringify(firstAfter))
    const conflictText = await text('[data-offline-conflict]')
    ok('the server\'s change made meanwhile is a CONFLICT, shown with both versions', conflictText.includes(OFFLINE_UI.conflictHead) && conflictText.includes('Register every landlord and letting agent') && conflictText.includes('Register every landlord within 30 days'), conflictText.replace(/\n/g, ' | '))
    ok('…nothing was overwritten: the server keeps its change, and the edit is still kept on the device', srv.actions[0].practicalStep === 'Register every landlord and letting agent' && (await queueOf()).length === 1 && (await queueOf())[0].status === 'conflict')
    ok('…and while the owner chooses, the page shows the server\'s copy (no version is presented as saved when it is not)', (await statementOf('a1')) === 'Register every landlord and letting agent', await statementOf('a1'))
    await p.click('[data-conflict-use-mine]'); await sleep(400)
    ok('"Use mine" saves the offline version through the route, and the conflict is gone', srv.actions[0].practicalStep === 'Register every landlord within 30 days' && (await p.locator('[data-offline-conflict]').count()) === 0 && (await queueOf()).length === 0)

    // 6 · no conflict: an offline edit simply sends on reconnection
    await offline(true)
    await p.evaluate(() => (window as unknown as { __edit: (i: string, t: string) => Promise<void> }).__edit('a2', 'Fine unregistered landlords £5,000'))
    srv.log = []
    await offline(false)
    await p.waitForFunction(() => document.querySelector('[data-offline-note]')?.textContent?.includes('Sent 1'), null, { timeout: 8000 })
    ok('an offline edit with no conflict sends on reconnection, in order, through the route', srv.actions[1].practicalStep === 'Fine unregistered landlords £5,000' && srv.log.filter((l) => /POST/.test(l)).length === 1)

    // 7 · a Lex message written offline waits for one tap, with the estimate
    await offline(true)
    await p.evaluate(() => (window as unknown as { __lex: (t: string) => void }).__lex('What does this cost?')); await sleep(150)
    ok('a Lex message written offline is kept and says it will ask first', (await text('[data-msg]')) === OFFLINE_UI.lexWaiting)
    srv.log = []
    await offline(false)
    await p.waitForSelector('[data-offline-lex-ask]', { timeout: 8000 })
    await sleep(500)
    ok('362: back online, it is NOT sent by itself: the owner is asked once, with the estimate', !srv.log.some((l) => l === 'POST /api/ideas/fx/lex') && (await text('[data-offline-lex-ask]')).includes(OFFLINE_UI.lexAsk(1, OFFLINE_UI.estimate(4))), JSON.stringify(srv.log))
    await p.click('[data-offline-lex-send]'); await sleep(300)
    ok('…one tap sends it', srv.log.filter((l) => l === 'POST /api/ideas/fx/lex').length === 1)

    // 8 · a deploy is never hidden behind the kept copy (network first)
    srv.version = 'v2'
    await p.reload(); await p.waitForSelector('[data-action="a1"]')
    ok('online, a reload is the fresh page (a "deploy" shows at once; the kept copy is only for offline)', (await p.evaluate(() => document.body.dataset.build)) === 'v2' && !(await p.evaluate(() => !!document.querySelector('meta[name="lex-offline-cached-at"]'))))

    // 9 · a page never opened on this device, offline, says so
    await offline(true)
    await p.goto(`${ORIGIN}/ideas/create?ideaId=never-opened`).catch(() => {})
    ok('offline, a page never opened on this device says there is no copy of it (never a blank or a browser error)', (await p.content()).includes('has not been opened on this device'))
    await offline(false)

    // 10 · 361 AMENDED (21 Nov): THE OWNER'S WORK IN PROGRESS IS KEPT through sign-out; the cached reads are not
    type W = { __edit: (i: string, t: string) => Promise<void>; __signOut: () => Promise<string>; __signedOut?: boolean }
    const kept = () => p.evaluate(async () => { let n = 0; for (const k of await caches.keys()) if (k.startsWith('lex-pages') || k.startsWith('lex-reads')) n += (await (await caches.open(k)).keys()).length; return n })
    const editOffline = async (t: string) => { await offline(true); await p.evaluate((x) => (window as unknown as W).__edit('a1', x), t); await sleep(150) }
    const signOutWith = async (button: 'keep' | 'send') => {
      const done = p.evaluate(() => (window as unknown as W).__signOut())
      await p.waitForSelector('[data-signout-ask]', { timeout: 5000 })
      const words = await text('[data-signout-ask]')
      await p.click(`[data-signout-${button}]`)
      return { words, choice: await done, signedOut: await p.evaluate(() => !!(window as unknown as W).__signedOut) }
    }
    const DRAFT = STORE_KEY.draft('u1', 'fx', 'lexMessage')
    await p.goto(IDEA); await p.waitForSelector('[data-action="a1"]')
    ok('(kept copies exist before the sign-out)', (await kept()) > 0)
    await p.evaluate((k) => localStorage.setItem(k, 'half a sentence, typed and not sent'), DRAFT)
    await editOffline('u1 offline text')
    ok('(u1\'s edit is waiting on the device, marked as u1\'s)', (await queueOf()).length === 1 && (await queueOf())[0].userId === 'u1', JSON.stringify(await queueOf()))
    const so = await signOutWith('keep')
    ok('361a: signing out with an edit unsent ASKS FIRST, in words ("1 edit not yet sent"), with Send now / Keep for when you sign back in', so.words.includes(OFFLINE_UI.signOutAsk(1, 0)) && so.words.includes(OFFLINE_UI.signOutSend) && so.words.includes(OFFLINE_UI.signOutKeep), so.words.replace(/\n/g, ' | '))
    ok('…"Keep" signs out and keeps the edit on the device, still u1\'s', so.choice === 'keep' && so.signedOut && (await queueOf()).length === 1 && (await queueOf())[0].userId === 'u1')
    ok('…the text being typed is kept too (sign-out never discards a draft)', (await p.evaluate((k) => localStorage.getItem(k), DRAFT)) === 'half a sentence, typed and not sent')
    ok('…and the cached page reads ARE cleared at sign-out', (await kept()) === 0, String(await kept()))
    await p.goto('about:blank'); await context.setOffline(false); srv.down = false
    // signed out, the page opens: nothing is sent (the work waits for its owner)
    srv.log = []
    await p.goto(`${IDEA}&user=none`); await p.waitForSelector('[data-workspace]'); await sleep(800)
    ok('…signed out, nothing is sent and nothing is removed', !srv.log.includes('POST /api/ideas/fx/actions') && (await queueOf()).length === 1, JSON.stringify(srv.log))

    // 11 · a DIFFERENT user signs in on this device: u1's work is never shown or sent as u2, a warning, removed only on u2's tap
    srv.log = []
    // Clerk takes a moment to say who is signed in (userDelay): nothing may be sent before it has
    await p.goto(`${IDEA}&user=u2&userDelay=600`); await p.waitForSelector('[data-offline-foreign]', { timeout: 5000 }); await sleep(600)
    ok('361b: when u2 opens Lex on this device, u1\'s edit is NOT sent as u2', srv.actions[0].practicalStep !== 'u1 offline text' && !srv.log.includes('POST /api/ideas/fx/actions'), `${srv.actions[0].practicalStep}; ${JSON.stringify(srv.log)}`)
    ok('…nor shown to u2 (the page shows the server\'s copy)', (await statementOf('a1')) !== 'u1 offline text', await statementOf('a1'))
    ok('…u2 is warned, in words', (await text('[data-offline-foreign]')).includes(OFFLINE_UI.foreignHead(1)), await text('[data-offline-foreign]'))
    ok('…and it is NOT removed by the warning alone (still on the device, still u1\'s)', (await queueOf()).length === 1 && (await queueOf())[0].userId === 'u1')
    ok('…the pages kept before are gone (u2 starts from what u2 fetches)', await p.evaluate(async () => { for (const k of await caches.keys()) if (k.startsWith('lex-pages')) for (const r of await (await caches.open(k)).keys()) { const t = await (await (await caches.open(k)).match(r))!.headers.get('x-lex-fetched-at'); if (t && new Date(t).getTime() < Date.now() - 1500) return false } return true }))
    // u1 signs back in on this device: the kept edit goes, as u1, first
    await p.goto('about:blank'); srv.log = []
    await p.goto(`${IDEA}&user=u1`); await p.waitForFunction(() => document.querySelector('[data-offline-note]')?.textContent?.includes('Sent 1'), null, { timeout: 8000 })
    ok('361c: when u1 signs back in, the edit kept through sign-out is sent, as u1', srv.actions[0].practicalStep === 'u1 offline text' && (await queueOf()).length === 0, `${srv.actions[0].practicalStep}; ${JSON.stringify(srv.log)}`)
    // and the Remove: u1 leaves another edit, u2 signs in and taps Remove
    await editOffline('u1 second text'); await signOutWith('keep')
    await p.goto('about:blank'); await context.setOffline(false); srv.down = false; srv.log = []
    await p.goto(`${IDEA}&user=u2`); await p.waitForSelector('[data-offline-foreign-remove]', { timeout: 5000 })
    // before removing, u2 works offline too: u2's own queue grows without touching u1's, and only u2's goes when the connection returns
    await editOffline('u2 offline text')
    const both = await queueOf()
    ok('…u2\'s own offline edit is kept beside u1\'s, never in place of it', both.length === 2 && both.some((q) => q.userId === 'u1') && both.some((q) => q.userId === 'u2'), JSON.stringify(both.map((q) => q.userId)))
    srv.log = []
    await offline(false)
    await p.waitForFunction(() => document.querySelector('[data-offline-note]')?.textContent?.includes('Sent 1'), null, { timeout: 8000 })
    ok('…back online, only u2\'s goes (as u2); u1\'s stays, unsent', srv.actions[0].practicalStep === 'u2 offline text' && (await queueOf()).length === 1 && (await queueOf())[0].userId === 'u1', `${srv.actions[0].practicalStep}; ${JSON.stringify(await queueOf())}`)
    srv.log = []
    await p.click('[data-offline-foreign-remove]'); await sleep(200)
    ok('361d: u2\'s tap on Remove removes u1\'s unsent work from the device, after the warning; nothing was sent', (await queueOf()).length === 0 && (await p.locator('[data-offline-foreign]').count()) === 0 && srv.actions[0].practicalStep === 'u2 offline text' && !srv.log.includes('POST /api/ideas/fx/actions'))

    // 12 · "Send now" at sign-out: u2 makes an edit the server could not take (it stopped answering), then signs out and chooses Send now
    await p.reload(); await p.waitForSelector('[data-action="a1"]')
    srv.down = true
    await p.evaluate(() => (window as unknown as W).__edit('a2', 'u2 edit, sent at sign-out')); await sleep(200)
    ok('(u2\'s edit is waiting: the server did not answer)', (await queueOf()).length === 1 && (await queueOf())[0].userId === 'u2')
    srv.down = false; srv.log = []
    const so2 = await signOutWith('send')
    ok('361e: "Send now, then sign out" sends the edit through the route before signing out', so2.choice === 'send' && so2.signedOut && srv.actions[1].practicalStep === 'u2 edit, sent at sign-out' && (await queueOf()).length === 0, `${srv.actions[1].practicalStep}; ${JSON.stringify(srv.log)}`)

    // 13 · 361: a signed-out answer clears the cached reads at once — and keeps the owner's unsent work
    await p.goto(`${IDEA}&user=u2`); await p.waitForSelector('[data-action="a1"]'); await sleep(300)
    srv.down = true
    await p.evaluate(() => (window as unknown as W).__edit('a2', 'u2 kept through a 401')); await sleep(200)
    srv.down = false
    srv.signedOut = true
    await p.goto(IDEA).catch(() => {}); await sleep(400)
    const left = await p.evaluate(async () => { let n = 0; for (const k of await caches.keys()) if (k.startsWith('lex-pages') || k.startsWith('lex-reads')) n += (await (await caches.open(k)).keys()).length; return n })
    ok('361: a page that answers "signed out" (401) clears the cached reads, at once', left === 0, String(left))
    ok('…and keeps the owner\'s unsent edit', (await queueOf()).length === 1 && (await queueOf())[0].userId === 'u2', JSON.stringify(await queueOf()))
    srv.signedOut = false

    // 14 · CCh 2145Z point 4: the typing DeviceDraft keeps is PER USER — another account on the device never sees it, nothing discards it
    const typedAs = async (u: string, words: string) => { await p.goto(`${IDEA}&user=${u}`); await p.waitForSelector('[data-note]'); await sleep(300); await p.fill('[data-note]', words); await sleep(700) }
    const offerOn = async (u: string, delay = 0) => { await p.goto(`${IDEA}&user=${u}${delay ? `&userDelay=${delay}` : ''}`); await p.waitForSelector('[data-note]'); await sleep(delay + 600); return (await p.locator('[data-draft-offer]').count()) ? await text('[data-draft-offer]') : '' }
    await typedAs('u1', 'u1 was typing this (device-draft check)')
    ok('2145Z §4: u1\'s typing is kept under u1\'s own key', (await p.evaluate((k) => localStorage.getItem(k), STORE_KEY.draft('u1', 'fx', 'harnessNote'))) === 'u1 was typing this (device-draft check)')
    // while Clerk is still saying who is signed in (the first 600 ms here), nothing may be offered on a guess: sample INSIDE that window
    await p.goto(`${IDEA}&user=u2&userDelay=1500`); await p.waitForSelector('[data-note]'); await sleep(500)
    const early = await p.locator('[data-draft-offer]').count()
    const u2sees = await offerOn('u2', 600)
    ok('…u2, on the same device, is NOT offered u1\'s typing: not while Clerk is still loading, and not after', early === 0 && u2sees === '', `early ${early}; after: ${u2sees}`)
    ok('…and it is not removed: still on the device under u1', (await p.evaluate((k) => localStorage.getItem(k), STORE_KEY.draft('u1', 'fx', 'harnessNote'))) === 'u1 was typing this (device-draft check)')
    const u1sees = await offerOn('u1')
    ok('…u1, back, is offered it', u1sees.includes('u1 was typing this'), u1sees)
    await p.click('[data-draft-discard]'); await sleep(200)
    // a draft kept under the OLD key (no user), from before this change: offered once to the confirmed user and moved to their key
    await p.evaluate((k) => localStorage.setItem(k, 'kept before the user key (device-draft check)'), STORE_KEY.legacyDraft('fx', 'harnessNote'))
    const legacy = await offerOn('u1')
    ok('…a draft kept under the old key is offered to the confirmed user and moved to their key', legacy.includes('kept before the user key') && (await p.evaluate((k) => localStorage.getItem(k), STORE_KEY.legacyDraft('fx', 'harnessNote'))) == null && (await p.evaluate((k) => localStorage.getItem(k), STORE_KEY.draft('u1', 'fx', 'harnessNote'))) === 'kept before the user key (device-draft check)', legacy)
    control('…the OLD key shape (no user) would have shown u1\'s typing to u2 (must be FALSE)', STORE_KEY.draft('u1', 'fx', 'harnessNote') === STORE_KEY.draft('u2', 'fx', 'harnessNote'))
    await context.close()
  } finally {
    await browser.close(); server.close()
  }
  ok('no page errors in the browser', errors.length === 0, errors.slice(0, 3).join(' | '))
}

;(async () => {
  console.log('check:lex-z2 — Z2: offline reading, the queue, conflicts, the one tap before Lex spends')
  partA()
  await partB()
  await partC()
  console.log(`\n${ran} ran · ${pass} passed · ${fail} failed · ${controls} controls (${dead} dead) · ${notRun} not run`)
  process.exit(fail || dead ? 1 : 0)
})().catch((e) => { console.error(e); process.exit(1) })
