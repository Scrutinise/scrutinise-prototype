// ─────────────────────────────────────────────────────────────────────────────
// LEX Z2 (BRIEF_26Z §6.3; decisions 362 and 363) — WHAT WAS DONE OFFLINE, KEPT ON THIS DEVICE UNTIL IT CAN BE SENT. Client only.
//
//   · Edits (free writes): an action's statement and details, a comment. Kept in order; on reconnection sent IN ORDER, each through its
//     normal route and refusal rules, BEFORE the page fetches anything fresh (363: the queue goes first). An action edit carries the
//     value it was made on (`expect`); if the server's copy changed meanwhile, the route answers 409 and the item becomes a CONFLICT,
//     shown with both versions for the owner to choose. A refusal (422 …) is kept and shown in its own words. Nothing is dropped silently.
//   · Lex messages (they spend): kept, and on reconnection NOT sent until the owner taps once, with the estimate (362).
//   · Kept per user: offline.ts clears it on sign-out and when a different user signs in (361).
// ─────────────────────────────────────────────────────────────────────────────

import { safeStore } from './where-am-i'
import { OFFLINE_KEY } from './offline'
import { EXPECTABLE, type Conflict, type Expect, type ExpectField } from './offline-conflict'

export interface QueuedEdit {
  id: string; kind: 'edit'; ideaId: string; url: string; body: Record<string, unknown>
  /** What it is, in words: "the statement of #3". */
  words: string
  at: string
  status: 'waiting' | 'conflict' | 'refused'
  conflict?: Conflict[]
  refusal?: string
}
export interface QueuedLex { id: string; kind: 'lex'; ideaId: string; text: string; clientTurnId: string; at: string; status: 'waiting' }
export type Queued = QueuedEdit | QueuedLex

const local = safeStore(() => (typeof window === 'undefined' ? null : window.localStorage))
const EVT = 'lex-offline-queue'

export function readQueue(ideaId?: string): Queued[] {
  try {
    const all = JSON.parse(local.get(OFFLINE_KEY.queue) ?? '[]') as Queued[]
    return Array.isArray(all) ? (ideaId ? all.filter((q) => q.ideaId === ideaId) : all) : []
  } catch { return [] }
}
function writeQueue(all: Queued[]) {
  local.set(OFFLINE_KEY.queue, all.length ? JSON.stringify(all) : null)
  try { window.dispatchEvent(new Event(EVT)) } catch { /* no window */ }
}
export const onQueueChange = (f: () => void) => { window.addEventListener(EVT, f); window.addEventListener('storage', f); return () => { window.removeEventListener(EVT, f); window.removeEventListener('storage', f) } }

const newId = () => (typeof crypto !== 'undefined' && 'randomUUID' in crypto ? crypto.randomUUID() : `q${Date.now()}${Math.random().toString(36).slice(2)}`)

export function enqueueEdit(ideaId: string, url: string, body: Record<string, unknown>, words: string): QueuedEdit {
  const item: QueuedEdit = { id: newId(), kind: 'edit', ideaId, url, body, words, at: new Date().toISOString(), status: 'waiting' }
  writeQueue([...readQueue(), item])
  return item
}
export function enqueueLex(ideaId: string, text: string, clientTurnId: string): QueuedLex {
  const item: QueuedLex = { id: newId(), kind: 'lex', ideaId, text, clientTurnId, at: new Date().toISOString(), status: 'waiting' }
  writeQueue([...readQueue(), item])
  return item
}
export function removeQueued(id: string) { writeQueue(readQueue().filter((q) => q.id !== id)) }
function patchQueued(id: string, p: Partial<QueuedEdit>) { writeQueue(readQueue().map((q) => (q.id === id && q.kind === 'edit' ? { ...q, ...p } : q))) }

/**
 * The action edit the page is about to make, as a queued edit: the patch plus `expect`, each edited field's value as the page holds it now
 * (the server's copy as last read, or an earlier queued edit's — so edits made one after another offline apply one after another).
 */
export function actionEditBody(body: Record<string, unknown>, current: Partial<Record<ExpectField, string | null>> | undefined): Record<string, unknown> {
  const expect: Expect = {}
  for (const f of Object.keys(EXPECTABLE) as ExpectField[]) if (f in body && current) expect[f] = current[f] ?? null
  return Object.keys(expect).length ? { ...body, expect } : body
}

/** Queued action edits laid over the actions the page holds, so what was done offline shows until it is sent (and after a reload). */
export function overlayActions<A extends { id: string }>(actions: readonly A[], queue: readonly Queued[]): A[] {
  let out = [...actions]
  for (const q of queue) {
    if (q.kind !== 'edit' || q.status !== 'waiting' || !/\/actions$/.test(q.url) || q.body.action !== 'update') continue
    const { action, actionId, expect, ...patch } = q.body as Record<string, unknown>
    void action; void expect
    out = out.map((a) => (a.id === actionId ? { ...a, ...patch } : a))
  }
  return out
}

type ActionNow = { id: string; number?: number | null; practicalStep?: string | null; commentary?: string | null }

/**
 * The page's write to one of its routes (CreateIdeaClient's `post`), offline-aware. Online: sent as it always was, the response handed
 * back. Offline (OfflineStrip's answer: 503, `offline`): an action's statement or details is QUEUED with the value it was made on; any
 * other write is refused, with the words to show.
 */
export async function postOrQueue(ideaId: string, path: string, body: Record<string, unknown>, actions: readonly ActionNow[] = []): Promise<{ res?: Response; queued?: QueuedEdit; refused?: string }> {
  const url = `/api/ideas/${ideaId}${path}`
  const res = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
  if (res.status !== 503) return { res }
  const j = (await res.clone().json().catch(() => ({}))) as { offline?: boolean; error?: string }
  if (!j.offline) return { res }
  if (path === '/actions' && body.action === 'update') {
    const now = actions.find((a) => a.id === body.actionId)
    const words = `#${now?.number ?? '?'} — ${'commentary' in body ? EXPECTABLE.commentary : EXPECTABLE.practicalStep}`
    return { queued: enqueueEdit(ideaId, url, actionEditBody(body, now), words) }
  }
  return { refused: j.error ?? 'You’re offline. Nothing was changed.' }
}

export interface FlushResult { sent: number; conflicts: number; refused: number; stopped: boolean; lastJson: unknown }

/**
 * 363 — the queue goes first: every waiting edit, IN ORDER, through its route. Stops at the first item that cannot reach the server (still
 * offline): what is left stays queued. A 409 with `conflict` marks the item a conflict; any other refusal marks it refused with its words.
 * Lex messages are not touched here (they wait for the owner's tap).
 */
export async function flushEdits(ideaId: string, send: (url: string, body: Record<string, unknown>) => Promise<Response> = defaultSend): Promise<FlushResult> {
  const r: FlushResult = { sent: 0, conflicts: 0, refused: 0, stopped: false, lastJson: null }
  for (const q of readQueue(ideaId)) {
    if (q.kind !== 'edit' || q.status !== 'waiting') continue
    let res: Response
    try { res = await send(q.url, q.body) } catch { r.stopped = true; break }
    const j = (await res.json().catch(() => ({}))) as { error?: string; conflict?: Conflict[]; offline?: boolean }
    if (res.status === 503 && j.offline) { r.stopped = true; break }
    if (res.ok) { removeQueued(q.id); r.sent++; r.lastJson = j; continue }
    if (res.status === 409 && Array.isArray(j.conflict) && j.conflict.length) { patchQueued(q.id, { status: 'conflict', conflict: j.conflict }); r.conflicts++; continue }
    patchQueued(q.id, { status: 'refused', refusal: typeof j.error === 'string' ? j.error : `refused (${res.status})` }); r.refused++
  }
  return r
}

/** A conflict resolved: "use mine" sends the edit again without its base (the owner has seen the server's copy and chose theirs). */
export async function resolveConflict(id: string, choice: 'mine' | 'theirs', send: (url: string, body: Record<string, unknown>) => Promise<Response> = defaultSend): Promise<{ ok: boolean; error?: string; json?: unknown }> {
  const q = readQueue().find((x) => x.id === id)
  if (!q || q.kind !== 'edit') return { ok: true }
  if (choice === 'theirs') { removeQueued(id); return { ok: true } }
  const { expect, ...body } = q.body
  void expect
  try {
    const res = await send(q.url, body)
    const j = (await res.json().catch(() => ({}))) as { error?: string }
    if (res.ok) { removeQueued(id); return { ok: true, json: j } }
    return { ok: false, error: j.error ?? `refused (${res.status})` }
  } catch { return { ok: false, error: 'You’re still offline. Nothing was changed.' } }
}

function defaultSend(url: string, body: Record<string, unknown>): Promise<Response> {
  return fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
}
