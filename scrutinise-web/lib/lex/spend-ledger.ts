// ─────────────────────────────────────────────────────────────────────────────
// spend-ledger.ts — BRIEF_SEARCH_S6 §3: METER THE SPEND, DO NOT BUILD THE CHARGING.
//
// ⚠ WHAT THIS IS NOT. It is not a fifth cost mechanism. Sprint 25-A already built
// `build-llm.ts` (usage from the API's own counters) and `build-cost.ts` (the rate card,
// with the unpriced-is-null rule). Both are correct and neither is touched. This adds the
// one thing they cannot do: **an append-only record of EVERY call, across every stream,
// attributable to a user and to an idea.** 25-A totals a build; this totals a platform.
//
// ⚠ ONE PLACE, NOT PER CALLER — §3's instruction, and the truncation guard is why:
// a check written per-caller was missing in seven of them (docs/CLAUDE.md §18). Every
// stream records through `recordSpend()`.
//
// ⚠ TWO WRITERS, ONE TABLE, AND THAT IS A BUILD BOUNDARY RATHER THAN A CHOICE.
// `scripts/ingest` sets `rootDir: "."`, so it cannot import anything under
// `scrutinise-web/`. The ingest and graph streams therefore write the SAME table through
// `scripts/ingest/shared/spend-ledger.ts`, which is a thin twin of this file. The rate
// card and the column names are the shared contract; a second copy of the *rates* would
// be the actual danger, so the twin imports nothing and asserts nothing — it writes rows
// and lets this side price them.
//
// ⚠ NULL PENCE MEANS UNPRICED, NOT FREE. Inherited from build-cost.ts and worth repeating
// because this is where it will bite: a Claude or Grok pass has NO RATE ON FILE today
// (docs/MODEL_CONTRACT.md §3), so it records tokens and a null cost. A ceiling that
// treated null as zero would silently stop holding the moment someone switched a pass to
// Claude — which is exactly the change 25-A §7 makes easy.
//
// ⚠ THE CHARGING IS DELIBERATELY ABSENT. Charlie's design (a free allowance, then payment,
// 75% funding the payer's own use and 25% pooled) needs the not-for-profit entity to exist
// before money moves, and accounting advice before that. **But you cannot charge for what
// you cannot measure, and the measurement is worth having on its own: right now nobody
// knows what one proposal costs to produce.**
// ─────────────────────────────────────────────────────────────────────────────

import { prisma } from '@/lib/prisma'
import { rates, type ModelRate } from './build-cost'
import type { LlmUsage } from './build-llm'

/** Which part of the platform spent this. Ingest's cost is not a user's, but it is Charlie's. */
export type SpendStream = 'lex' | 'build' | 'deepening' | 'orientation' | 'graph' | 'ingest' | 'admin'

export interface SpendEntry {
  stream: SpendStream
  /** The pass name from model-registry.ts where there is one — the join to what was configured. */
  pass: string
  model: string
  tokensIn: number
  tokensOut: number
  /** Thinking tokens, which bill at the OUTPUT rate and are counted as output here. */
  tokensThinking?: number
  /** Who this is attributable to. NULL for platform work with no user (ingest, admin sweeps). */
  userId?: string | null
  /** Which idea it was spent on. NULL for work that is not about one idea. */
  ideaId?: string | null
  /** Free-form: a build id, a run id, a section id — whatever makes the row traceable. */
  ref?: string | null
  /** TRUE when the call failed. ⚠ A failed call still costs money. */
  failed?: boolean
}

export interface PricedSpend {
  /** NULL when the model has no rate on file. NEVER zero-as-a-substitute. */
  pence: number | null
  usd: number | null
  unpriced: boolean
}

const USD_TO_GBP = Number(process.env.LEX_BUILD_USD_GBP ?? '0.79')

/** Price one entry. Thinking tokens bill at the output rate — the only honest total. */
export function priceEntry(e: Pick<SpendEntry, 'model' | 'tokensIn' | 'tokensOut' | 'tokensThinking'>): PricedSpend {
  const rate: ModelRate | undefined = rates()[e.model]
  if (!rate) return { pence: null, usd: null, unpriced: true }
  const out = e.tokensOut + (e.tokensThinking ?? 0)
  const usd = (e.tokensIn / 1_000_000) * rate.inPerM + (out / 1_000_000) * rate.outPerM
  return { pence: usd * USD_TO_GBP * 100, usd, unpriced: false }
}

/**
 * Record one call. Never throws into the caller's path — a ledger failure must not take
 * down the work it was measuring, and a silent one is worse than a logged one.
 */
export async function recordSpend(e: SpendEntry): Promise<PricedSpend> {
  const priced = priceEntry(e)
  try {
    await prisma.$executeRaw`
      INSERT INTO "LlmSpend" ("stream", "pass", "model", "tokensIn", "tokensOut", "tokensThinking",
                              "estCostPence", "unpriced", "userId", "ideaId", "ref", "failed")
      VALUES (${e.stream}, ${e.pass}, ${e.model}, ${e.tokensIn}, ${e.tokensOut}, ${e.tokensThinking ?? 0},
              ${priced.pence}, ${priced.unpriced}, ${e.userId ?? null}, ${e.ideaId ?? null},
              ${e.ref ?? null}, ${e.failed ?? false})`
  } catch (err) {
    console.warn('[spend-ledger] could not record spend', {
      stream: e.stream, pass: e.pass, model: e.model,
      error: err instanceof Error ? err.message : String(err),
    })
  }
  return priced
}

/** Convenience: record straight from 25-A's `LlmUsage`, so a build pass is one line. */
export const recordUsage = (
  usage: LlmUsage, ctx: Omit<SpendEntry, 'model' | 'tokensIn' | 'tokensOut'>,
): Promise<PricedSpend> =>
  recordSpend({ ...ctx, model: usage.model, tokensIn: usage.tokensIn, tokensOut: usage.tokensOut })

// ── Totals ───────────────────────────────────────────────────────────────────

export interface SpendTotal {
  calls: number
  tokensIn: number
  tokensOut: number
  /** NULL when ANY contributing row is unpriced — see below. */
  pence: number | null
  unpricedCalls: number
}

/**
 * ⚠ A TOTAL CONTAINING AN UNPRICED CALL IS NULL, NOT A PARTIAL SUM.
 *
 * This is the rule most likely to be argued with, so: a partial sum reads as a complete
 * one. "This proposal cost £0.31" when two of its nine calls had no rate on file is a
 * number that will be quoted, compared and budgeted against, and nothing on the page says
 * it is short. Returning null plus `unpricedCalls` forces the caller to say
 * "£0.31 plus 2 calls we cannot price", which is the truth.
 */
function fold(rows: Array<{ tokensIn: number; tokensOut: number; estCostPence: unknown; unpriced: boolean }>): SpendTotal {
  const t: SpendTotal = { calls: rows.length, tokensIn: 0, tokensOut: 0, pence: 0, unpricedCalls: 0 }
  for (const r of rows) {
    t.tokensIn += Number(r.tokensIn)
    t.tokensOut += Number(r.tokensOut)
    if (r.unpriced || r.estCostPence == null) { t.unpricedCalls++; continue }
    if (t.pence != null) t.pence += Number(r.estCostPence)
  }
  if (t.unpricedCalls > 0) t.pence = null
  return t
}

type Row = { tokensIn: number; tokensOut: number; estCostPence: unknown; unpriced: boolean }

export async function totalForIdea(ideaId: string): Promise<SpendTotal> {
  const rows = await prisma.$queryRaw<Row[]>`
    SELECT "tokensIn", "tokensOut", "estCostPence", "unpriced" FROM "LlmSpend" WHERE "ideaId" = ${ideaId}`
  return fold(rows)
}

export async function totalForUser(userId: string, since?: Date): Promise<SpendTotal> {
  const rows = since
    ? await prisma.$queryRaw<Row[]>`SELECT "tokensIn", "tokensOut", "estCostPence", "unpriced"
        FROM "LlmSpend" WHERE "userId" = ${userId} AND "createdAt" >= ${since}`
    : await prisma.$queryRaw<Row[]>`SELECT "tokensIn", "tokensOut", "estCostPence", "unpriced"
        FROM "LlmSpend" WHERE "userId" = ${userId}`
  return fold(rows)
}

/**
 * A ceiling that STOPS rather than warns — §3's wording.
 *
 * ⚠ AN UNPRICED CALL BLOCKS RATHER THAN PASSES. If we cannot price what has already been
 * spent we cannot know whether the ceiling is breached, and the safe reading of "unknown"
 * against a hard limit is "stop". 25-A's per-build ceiling already fails the build with a
 * plain reason rather than silently shortening it; this is the same rule per user.
 */
export interface CeilingVerdict { allowed: boolean; reason: string; spentPence: number | null; limitPence: number }

export async function checkUserCeiling(userId: string, limitPence: number, since?: Date): Promise<CeilingVerdict> {
  const t = await totalForUser(userId, since)
  if (t.pence == null) {
    return { allowed: false, spentPence: null, limitPence,
      reason: `${t.unpricedCalls} of ${t.calls} calls have no rate on file, so the spend against your allowance cannot be established` }
  }
  if (t.pence >= limitPence) {
    return { allowed: false, spentPence: t.pence, limitPence,
      reason: `allowance used: ${formatPence(t.pence)} of ${formatPence(limitPence)}` }
  }
  return { allowed: true, spentPence: t.pence, limitPence, reason: '' }
}

/** "£0.42", or the honest alternative. Mirrors build-cost.ts's formatSpend deliberately. */
export function formatPence(pence: number | null): string {
  if (pence == null) return 'not known'
  if (pence < 1) return `£0.00 (under a penny)`
  return `£${(pence / 100).toFixed(2)}`
}

export function formatTotal(t: SpendTotal): string {
  const base = formatPence(t.pence)
  if (t.unpricedCalls === 0) return base
  return `${base} — ⚠ ${t.unpricedCalls} of ${t.calls} calls could not be priced`
}
