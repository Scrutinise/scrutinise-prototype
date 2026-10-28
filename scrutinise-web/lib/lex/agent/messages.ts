// 292/282/289 (CCh-Lex 28 Oct (5)) — THE CONVERSATION TABLE (`LexMessage`), written beside `Idea.aiChatHistory`.
//
// The JSON stays what the chat draws and what the model's 20-message window reads (and is still cut to 200). This table keeps
// every message for good: `read_reply(n)` and `search_conversation(query)` read it, and 282's "Reply N" is its `replyNo`.
//
// ⚠ 289 — THE IN-FLIGHT LOCK. On 28 Oct turn 6a06feb5 ran twice (15.04p + 7.19p): the client retried the POST while the first
// run was still going, and the only guard looked for a SAVED reply. `startTurn` now inserts the user's row when the turn
// STARTS, unique on (idea, turnId, role); a second request for the same send fails that insert and waits for the first run's
// reply (`waitForReply`) instead of running every tool again.

import { prisma } from '@/lib/prisma'
import type { ChatMsg } from './loop'

const isUnique = (err: unknown) => (err as { code?: string })?.code === 'P2002'
/** A stored message worth a row: a real user or Lex line (the confirm route's empty "used" holder is not one). */
const counts = (m: ChatMsg) => (m.role === 'user' || m.role === 'lex') && typeof m.content === 'string' && m.content.trim() !== ''

function metaOf(m: ChatMsg): Record<string, unknown> {
  const { role: _r, content: _c, replyNo: _n, turnId: _t, ...rest } = m
  return rest
}

/**
 * Copy an idea's JSON history into the table the first time a turn touches it (and the 292 backfill calls the same thing).
 * Lex's messages get their reply numbers in order; the numbers are written back onto the JSON too, so the chat can show them.
 * Returns the history as it now stands (with `replyNo`), which the caller must use from here on.
 */
export async function ensureCopied(ideaId: string, history: ChatMsg[]): Promise<{ history: ChatMsg[]; copied: number }> {
  if (await prisma.lexMessage.count({ where: { ideaId } })) return { history, copied: 0 }
  let n = 0, reply = 0
  const rows: Array<{ ideaId: string; n: number; replyNo: number | null; role: string; content: string; turnId: string | null; meta: object; createdAt: Date }> = []
  const numbered = history.map((m) => {
    if (!counts(m)) return m
    n++
    const replyNo = m.role === 'lex' ? ++reply : null
    const at = Date.parse(String(m.timestamp ?? ''))
    rows.push({ ideaId, n, replyNo, role: m.role, content: m.content, turnId: typeof m.turnId === 'string' ? m.turnId : null, meta: metaOf(m), createdAt: Number.isFinite(at) ? new Date(at) : new Date(0) })
    return replyNo ? { ...m, replyNo } : m
  })
  if (!rows.length) return { history, copied: 0 }
  try {
    // ⚠ a duplicated turnId in old JSON (the 6a06feb5 kind is not one — it saved once) would trip the lock's unique: drop the id, keep the text
    const seen = new Set<string>()
    for (const r of rows) { const k = `${r.turnId}|${r.role}`; if (r.turnId && seen.has(k)) r.turnId = null; else if (r.turnId) seen.add(k) }
    await prisma.$transaction([
      prisma.lexMessage.createMany({ data: rows }),
      prisma.idea.update({ where: { id: ideaId }, data: { aiChatHistory: numbered as never } }),
    ])
  } catch (err) {
    if (!isUnique(err)) throw err
    // another request copied it a moment ago
    const now = await prisma.idea.findUnique({ where: { id: ideaId }, select: { aiChatHistory: true } })
    return { history: Array.isArray(now?.aiChatHistory) ? (now!.aiChatHistory as ChatMsg[]) : history, copied: 0 }
  }
  return { history: numbered, copied: rows.length }
}

async function nextNumbers(ideaId: string) {
  const agg = await prisma.lexMessage.aggregate({ where: { ideaId }, _max: { n: true, replyNo: true } })
  return { n: (agg._max.n ?? 0) + 1, replyNo: (agg._max.replyNo ?? 0) + 1 }
}

/** Insert one row with the next free numbers; a collision on the numbers (two tabs at once) takes the next ones. */
async function insertNext(ideaId: string, role: 'user' | 'lex', content: string, turnId: string | null, meta: object, createdAt: Date) {
  for (let attempt = 0; ; attempt++) {
    const next = await nextNumbers(ideaId)
    try {
      return await prisma.lexMessage.create({ data: { ideaId, n: next.n, replyNo: role === 'lex' ? next.replyNo : null, role, content, turnId, meta, createdAt } })
    } catch (err) {
      if (!isUnique(err) || attempt >= 4) throw err
      if (turnId && (await prisma.lexMessage.findFirst({ where: { ideaId, turnId, role }, select: { id: true } }))) throw err
    }
  }
}

export type TurnStart = { ok: true } | { ok: false; startedAt: Date }

/**
 * 289 — claim this send. `ok: false` means a request for the same `turnId` is already running (or ran): the caller waits for
 * its reply rather than running the turn again. A claim older than `staleMs` with no reply is a run that died; it is taken over.
 */
export async function startTurn(ideaId: string, turnId: string | null, content: string, meta: object, staleMs = 300_000): Promise<TurnStart> {
  try {
    await insertNext(ideaId, 'user', content, turnId, meta, new Date())
    return { ok: true }
  } catch (err) {
    if (!isUnique(err) || !turnId) throw err
    const held = await prisma.lexMessage.findFirst({ where: { ideaId, turnId, role: 'user' }, select: { createdAt: true } })
    if (!held) throw err
    const replied = await prisma.lexMessage.findFirst({ where: { ideaId, turnId, role: 'lex' }, select: { id: true } })
    if (!replied && Date.now() - held.createdAt.getTime() > staleMs) return { ok: true }
    return { ok: false, startedAt: held.createdAt }
  }
}

/** 289 — wait for the reply of the run that holds this send. Null if none arrived in time. */
export async function waitForReply(ideaId: string, turnId: string, maxMs = 270_000, everyMs = 1500): Promise<{ replyNo: number | null; content: string; createdAt: Date } | null> {
  const until = Date.now() + maxMs
  for (;;) {
    const r = await prisma.lexMessage.findFirst({ where: { ideaId, turnId, role: 'lex' }, select: { replyNo: true, content: true, createdAt: true } })
    if (r) return r
    if (Date.now() >= until) return null
    await new Promise((res) => setTimeout(res, everyMs))
  }
}

/** Lex's reply, numbered. Returns its reply number (282), which the caller also puts on the JSON message. */
export async function addReply(ideaId: string, m: ChatMsg): Promise<number> {
  const at = Date.parse(String(m.timestamp ?? ''))
  const row = await insertNext(ideaId, 'lex', m.content, typeof m.turnId === 'string' ? m.turnId : null, metaOf(m), Number.isFinite(at) ? new Date(at) : new Date())
  return row.replyNo!
}

// ── what Lex reads (read_reply, search_conversation) ──────────────────────────────────────────

export interface ReadReply { replyNo: number; at: string; reply: string; asked: string | null; askedAt: string | null }

/** Reply N, with the user's message it answered (the last user row before it). */
export async function readReply(ideaId: string, replyNo: number): Promise<ReadReply | null> {
  const r = await prisma.lexMessage.findFirst({ where: { ideaId, replyNo }, select: { n: true, content: true, createdAt: true } })
  if (!r) return null
  const q = await prisma.lexMessage.findFirst({ where: { ideaId, role: 'user', n: { lt: r.n } }, orderBy: { n: 'desc' }, select: { content: true, createdAt: true } })
  return { replyNo, at: r.createdAt.toISOString(), reply: r.content, asked: q?.content ?? null, askedAt: q?.createdAt.toISOString() ?? null }
}

export interface ConversationHit { n: number; replyNo: number | null; role: string; at: string; snippet: string }

/**
 * Search the whole conversation (Postgres text search, English stemming; a quoted phrase and -word work as on the web).
 * Falls back to a plain substring match when the words are all stop words. Newest first.
 */
export async function searchConversation(ideaId: string, query: string, limit = 8): Promise<{ hits: ConversationHit[]; total: number }> {
  const q = query.trim().slice(0, 200)
  if (!q) return { hits: [], total: 0 }
  type Row = { n: number; replyNo: number | null; role: string; createdAt: Date; snippet: string; total: bigint }
  let rows = await prisma.$queryRaw<Row[]>`
    SELECT "n", "replyNo", "role", "createdAt",
           ts_headline('english', "content", websearch_to_tsquery('english', ${q}), 'MaxWords=40, MinWords=15, StartSel=«, StopSel=»') AS snippet,
           count(*) OVER () AS total
      FROM "LexMessage"
     WHERE "ideaId" = ${ideaId} AND to_tsvector('english', "content") @@ websearch_to_tsquery('english', ${q})
     ORDER BY "n" DESC LIMIT ${limit}`
  if (!rows.length) {
    rows = await prisma.$queryRaw<Row[]>`
      SELECT "n", "replyNo", "role", "createdAt", left("content", 300) AS snippet, count(*) OVER () AS total
        FROM "LexMessage" WHERE "ideaId" = ${ideaId} AND "content" ILIKE ${'%' + q.replace(/[%_\\]/g, (c) => '\\' + c) + '%'}
       ORDER BY "n" DESC LIMIT ${limit}`
  }
  return {
    total: rows.length ? Number(rows[0].total) : 0,
    hits: rows.map((r) => ({ n: r.n, replyNo: r.replyNo, role: r.role, at: r.createdAt.toISOString(), snippet: r.snippet })),
  }
}
