// ─────────────────────────────────────────────────────────────────────────────
// LEX Z2 (BRIEF_26Z §6.3; decisions 361 and 363) — THE SERVICE WORKER FOR LEX'S PAGES. Registered by Lex's page with scope /ideas/ only, so it
// controls Lex's pages and nothing of Central's.
//
//   · Pages under /ideas/: NETWORK FIRST. A fresh page whenever the network answers, so a deploy is never hidden behind an old copy; the
//     last good copy is kept, stamped with when it was fetched, and served only when the network does not answer. A page served from the
//     copy carries <meta name="lex-offline-cached-at">, which the page reads to say "Offline — last updated 14:02".
//   · Lex's reads (GET /api/ideas/…): network first, the last good answer kept for offline.
//   · The app's built files (/_next/static/…, content-hashed, never change): cache first.
//   · WRITES ARE NEVER HANDLED HERE. The page decides (queue or refuse, in words); this worker passes every non-GET straight through.
//   · 361: what is kept HERE is cached reads of signed-in data. A page that answers with a redirect to sign-in, or 401/403, clears all of
//     it at once, and the page clears it on sign-out and when a different user signs in (message 'lex-clear').
//     ⚠ The owner's unsent work (the queue, the drafts) is not here: it is in the page's storage, and the worker never touches it.
// ─────────────────────────────────────────────────────────────────────────────

const VERSION = 'z2-1'
const PAGES = `lex-pages-${VERSION}`
const READS = `lex-reads-${VERSION}`
const STATIC = `lex-static-${VERSION}`
const KEEP = [PAGES, READS, STATIC]
const LIMIT = { [PAGES]: 40, [READS]: 400, [STATIC]: 600 }
const STAMP = 'x-lex-fetched-at'

self.addEventListener('install', () => self.skipWaiting())
self.addEventListener('activate', (e) => e.waitUntil((async () => {
  for (const k of await caches.keys()) if (k.startsWith('lex-') && !KEEP.includes(k)) await caches.delete(k)
  await self.clients.claim()
})()))

async function clearAll() { for (const k of await caches.keys()) if (k.startsWith('lex-')) await caches.delete(k) }

self.addEventListener('message', (e) => {
  if (e.data && e.data.type === 'lex-clear') e.waitUntil(clearAll().then(() => e.source && e.source.postMessage({ type: 'lex-cleared' })))
})

/** The key a page is kept under: the panel number and the hash are where the reader is, not which page it is. */
function pageKey(u) {
  const url = new URL(u)
  url.hash = ''
  url.searchParams.delete('panel')
  url.searchParams.sort()
  return url.toString()
}
self.lexPageKey = pageKey

async function trim(name) {
  const c = await caches.open(name)
  const keys = await c.keys()
  for (let i = 0; i < keys.length - LIMIT[name]; i++) await c.delete(keys[i])
}

async function stamped(res) {
  const h = new Headers(res.headers)
  h.set(STAMP, new Date().toISOString())
  return new Response(await res.clone().blob(), { status: res.status, statusText: res.statusText, headers: h })
}

const signedOut = (res) => res.status === 401 || res.status === 403 || (res.redirected && /\/sign-in\b/.test(res.url))

async function page(req) {
  const key = pageKey(req.url)
  try {
    const res = await fetch(req)
    if (signedOut(res)) { await clearAll(); return res }
    if (res.ok && res.type === 'basic' && !res.redirected && /text\/html/.test(res.headers.get('content-type') || '')) {
      const c = await caches.open(PAGES)
      await c.put(key, await stamped(res))
      trim(PAGES)
    }
    return res
  } catch (err) {
    const hit = await (await caches.open(PAGES)).match(key)
    if (!hit) return offlineNotKept()
    const at = hit.headers.get(STAMP) || ''
    const html = (await hit.text()).replace(/<head([^>]*)>/i, `<head$1><meta name="lex-offline-cached-at" content="${at}">`)
    const h = new Headers(hit.headers)
    h.delete('content-length')
    return new Response(html, { status: 200, headers: h })
  }
}

function offlineNotKept() {
  return new Response(
    '<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><meta name="lex-offline-not-kept" content="1"><title>Offline</title></head>' +
    '<body style="font-family:system-ui,sans-serif;padding:24px;color:#18181b;background:#fff"><h1 style="font-size:20px">Offline</h1>' +
    '<p>This page has not been opened on this device while online, so there is no copy of it to show. It will load when you are back online.</p></body></html>',
    { status: 503, headers: { 'content-type': 'text/html; charset=utf-8' } },
  )
}

async function read(req) {
  try {
    const res = await fetch(req)
    if (signedOut(res)) { await clearAll(); return res }
    // only JSON answers are kept: never a stream (it would never end) or a download (a document is fetched again when wanted)
    if (res.ok && res.type === 'basic' && /application\/json/.test(res.headers.get('content-type') || '')) { const c = await caches.open(READS); await c.put(req.url, await stamped(res)); trim(READS) }
    return res
  } catch (err) {
    const hit = await (await caches.open(READS)).match(req.url)
    if (hit) return hit
    return new Response(JSON.stringify({ error: 'You’re offline, and this has not been read on this device yet.', offline: true }), { status: 503, headers: { 'content-type': 'application/json' } })
  }
}

async function built(req) {
  const c = await caches.open(STATIC)
  const hit = await c.match(req.url)
  if (hit) return hit
  const res = await fetch(req)
  if (res.ok) { await c.put(req.url, res.clone()); trim(STATIC) }
  return res
}

self.addEventListener('fetch', (e) => {
  const req = e.request
  if (req.method !== 'GET') return
  const url = new URL(req.url)
  if (url.origin !== self.location.origin) return
  if (url.pathname.startsWith('/_next/static/')) return e.respondWith(built(req))
  if (req.mode === 'navigate' && url.pathname.startsWith('/ideas/')) return e.respondWith(page(req))
  if (url.pathname.startsWith('/api/ideas/') && !req.headers.get('range') && !/event-stream/.test(req.headers.get('accept') || '')) return e.respondWith(read(req))
})
