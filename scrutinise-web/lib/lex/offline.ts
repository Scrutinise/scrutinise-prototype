// ─────────────────────────────────────────────────────────────────────────────
// LEX Z2 (BRIEF_26Z §6.3; decisions 361–363) — OFFLINE, THE PAGE'S HALF. Client only. The worker is public/lex-sw.js.
//
//   registerLexWorker()   the worker, scope /ideas/ (never Central's pages)
//   keepForUser(userId)   361: a different user (or none) on this device → everything kept is cleared first
//   clearLexOffline()     everything kept: the worker's copies, the queue. Called on sign-out, and exported for Central's sign-out.
//   cachedAtOf(document)  when the page on screen was fetched, if it came from the kept copy (the worker marks it)
//   offlineWrite(...)     a write attempted with no connection: refused in words (Z2a), or queued (Z2b, edits and Lex messages)
//
// ⚠ STORAGE AND THE CACHE API MAY BE MISSING OR MAY THROW (private windows, blocked storage, an old browser): every call is wrapped, and the
//   page then works online exactly as it did before Z2, and simply keeps nothing.
// ─────────────────────────────────────────────────────────────────────────────

import { safeStore } from './where-am-i'

export const LEX_SW_URL = '/lex-sw.js'
export const LEX_SW_SCOPE = '/ideas/'
export const OFFLINE_KEY = { user: 'lex.offline.user', queue: 'lex.offline.queue.v1' } as const
export const CACHED_AT_META = 'lex-offline-cached-at'

const local = safeStore(() => (typeof window === 'undefined' ? null : window.localStorage))

export async function registerLexWorker(): Promise<boolean> {
  try {
    if (typeof navigator === 'undefined' || !('serviceWorker' in navigator)) return false
    await navigator.serviceWorker.register(LEX_SW_URL, { scope: LEX_SW_SCOPE })
    return true
  } catch { return false }
}

/** Everything Lex keeps on this device for offline: the worker's copies and the queue of writes. */
export async function clearLexOffline(): Promise<void> {
  local.set(OFFLINE_KEY.queue, null)
  try {
    if (typeof caches !== 'undefined') for (const k of await caches.keys()) if (k.startsWith('lex-')) await caches.delete(k)
  } catch { /* the Cache API is unavailable: nothing was kept */ }
  try { navigator.serviceWorker?.controller?.postMessage({ type: 'lex-clear' }) } catch { /* no worker */ }
}

/** 361 — kept data belongs to one signed-in user. Signed out (null), or a different user from last time: clear first. Returns whether it cleared. */
export async function keepForUser(userId: string | null): Promise<boolean> {
  const was = local.get(OFFLINE_KEY.user)
  if (userId && was === userId) return false
  await clearLexOffline()
  local.set(OFFLINE_KEY.user, userId)
  return was != null || !userId
}

/** When the page on screen was fetched, if the worker served it from its kept copy; null when it came from the network. */
export function cachedAtOf(doc: Document): Date | null {
  const v = doc.querySelector(`meta[name="${CACHED_AT_META}"]`)?.getAttribute('content')
  const d = v ? new Date(v) : null
  return d && !Number.isNaN(d.getTime()) ? d : null
}

/** "14:02" in the reader's own clock. */
export function clockWords(d: Date): string {
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
}

/** A write is Lex's when it goes to Lex's API. Only these are answered here; anything else goes to the network as it always did. */
export function isLexWrite(url: string, method: string): boolean {
  if (/^(GET|HEAD|OPTIONS)$/i.test(method)) return false
  try { return new URL(url, 'http://x').pathname.startsWith('/api/ideas/') } catch { return false }
}

/**
 * Installs the offline answer for Lex's writes, once per page. With no connection (navigator.onLine false, or the request failing to reach
 * the server at all) a Lex write is answered here instead of failing as "Failed to fetch": `handle` returns the Response the caller sees
 * (refused in words, or queued). Returns the uninstaller.
 */
export function installOfflineWrites(handle: (url: string, init: RequestInit | undefined) => Promise<Response>): () => void {
  if (typeof window === 'undefined') return () => {}
  const w = window as Window & { __lexOfflineFetch?: boolean }
  if (w.__lexOfflineFetch) return () => {}
  const original = window.fetch.bind(window)
  w.__lexOfflineFetch = true
  window.fetch = async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = typeof input === 'string' ? input : input instanceof URL ? input.toString() : input.url
    const method = init?.method ?? (typeof input === 'object' && 'method' in input ? input.method : 'GET')
    if (!isLexWrite(url, method)) return original(input, init)
    if (typeof navigator !== 'undefined' && navigator.onLine === false) return handle(url, init)
    try { return await original(input, init) }
    catch (e) { if (e instanceof TypeError) return handle(url, init); throw e }
  }
  return () => { window.fetch = original; w.__lexOfflineFetch = false }
}

/** Z2a: every write refused, in words, with nothing changed. The caller shows `error` as it shows any refusal. */
export function refusedOffline(words: string): Response {
  return new Response(JSON.stringify({ error: words, offline: true }), { status: 503, headers: { 'content-type': 'application/json' } })
}
