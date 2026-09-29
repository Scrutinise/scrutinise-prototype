// ─────────────────────────────────────────────────────────────────────────────
// spend-explore.ts — COST DASHBOARD. Spend over any date range, grouped by provider, model, feature,
// idea, user or build, with a filter per dimension so each grouping drills into the next.
//
// ⚠ UNATTRIBUTED SPEND IS A LINE, NOT A FOOTNOTE. A row with no idea/user/build is grouped under a
// null key and returned as its own row (`key: null`) — the UI labels it "Unattributed" and it can be
// drilled into like any other. Nothing here filters nulls out, and `coverage` states how much of the
// money is attributed so a dashboard of attributed spend can never read as the whole.
// ⚠ THE UNPRICED RULE TRAVELS (spend-ledger.ts `fold`): a group containing an unpriced call returns
// `pence: null` plus the priced part as `penceKnown` and the number of calls it cannot price.
// ⚠ READ-ONLY. No cap, no throttle, no user-facing effect — same instruction as spend-admin.ts.
// ─────────────────────────────────────────────────────────────────────────────

import { prisma } from '@/lib/prisma'
import { spendOriginOf } from './spend-origin'

export const DIMENSIONS = ['provider', 'model', 'feature', 'idea', 'user', 'build'] as const
export type Dimension = (typeof DIMENSIONS)[number]

/** SQL for each dimension's key. Whitelisted — never built from request text. */
const KEY_SQL: Record<Dimension, string> = {
  provider: `CASE WHEN s.model LIKE 'gemini%' THEN 'google' WHEN s.model LIKE 'claude%' THEN 'anthropic'
                  WHEN s.model LIKE 'grok%' THEN 'xai' WHEN s.model LIKE 'gpt%' OR s.model LIKE 'o1%' OR s.model LIKE 'o3%' THEN 'openai'
                  ELSE 'other' END`,
  model: 's.model',
  feature: 's.pass',
  idea: 's."ideaId"',
  user: 's."userId"',
  build: 's."buildId"',
}

/** The sentinel a filter uses to mean "rows where this dimension is NULL" — i.e. drill into Unattributed. */
export const NONE = '__none__'

export interface ExploreParams {
  from: Date
  /** Exclusive upper bound. */
  to: Date
  by: Dimension
  filters: Partial<Record<Dimension, string>>
}

export interface ExploreRow {
  key: string | null
  label: string
  calls: number
  failedCalls: number
  tokensIn: number
  tokensOut: number
  /** NULL when any call in the group is unpriced. */
  pence: number | null
  penceKnown: number
  unpricedCalls: number
  share: number
  /** For the Unattributed line: what it is made of, so it is diagnosable without another click. */
  breakdown?: Array<{ feature: string; pence: number; calls: number; origin: string }>
}

export interface Coverage {
  rows: number
  withUser: number
  withIdea: number
  withBuild: number
  penceTotal: number
  penceWithUser: number
  penceWithIdea: number
  penceUnattributedToUser: number
  /** Money by how the attribution was learned — a fact versus an inference. */
  bySource: Array<{ source: string; pence: number; rows: number }>
}

export interface ReconRow {
  provider: string; day: string; ledgerPence: number; ledgerRows: number
  providerUsd: number | null; gapPence: number | null
  status: 'RECONCILED' | 'NOT_READ' | 'NOT_RECONCILABLE'; reason: string | null; checkedAt: string
}

export interface ExploreResult {
  from: string; to: string; by: Dimension; filters: Record<string, string>
  rows: ExploreRow[]
  totals: { calls: number; tokensIn: number; tokensOut: number; pence: number | null; penceKnown: number; unpricedCalls: number }
  coverage: Coverage
  reconciliation: ReconRow[]
}

const num = (v: unknown) => Number(v ?? 0)

function whereFor(p: ExploreParams): { sql: string; args: unknown[] } {
  const args: unknown[] = [p.from, p.to]
  const parts = [`s."createdAt" >= $1`, `s."createdAt" < $2`]
  for (const d of DIMENSIONS) {
    const v = p.filters[d]
    if (v == null || v === '') continue
    if (v === NONE) { parts.push(`(${KEY_SQL[d]}) IS NULL`); continue }
    args.push(v); parts.push(`(${KEY_SQL[d]}) = $${args.length}`)
  }
  return { sql: parts.join(' AND '), args }
}

async function labels(by: Dimension, keys: string[]): Promise<Map<string, string>> {
  const out = new Map<string, string>()
  if (!keys.length) return out
  if (by === 'idea') {
    const rows = await prisma.idea.findMany({ where: { id: { in: keys } }, select: { id: true, title: true } })
    for (const r of rows) out.set(r.id, r.title?.trim() || `(untitled) ${r.id.slice(0, 8)}`)
  } else if (by === 'user') {
    const rows = await prisma.user.findMany({ where: { id: { in: keys } }, select: { id: true, name: true, username: true } })
    for (const r of rows) out.set(r.id, r.name?.trim() || r.username || r.id.slice(0, 8))
  } else if (by === 'build') {
    const rows = await prisma.ideaBuild.findMany({ where: { id: { in: keys } }, select: { id: true, status: true, startedAt: true, idea: { select: { title: true } } } })
    for (const r of rows) {
      out.set(r.id, `${r.idea?.title?.trim() || 'untitled'} · ${r.startedAt ? r.startedAt.toISOString().slice(0, 16).replace('T', ' ') : 'not started'} · ${r.status}`)
    }
  }
  return out
}

export async function exploreSpend(p: ExploreParams): Promise<ExploreResult> {
  const { sql, args } = whereFor(p)
  const keyExpr = KEY_SQL[p.by]

  const grouped = await prisma.$queryRawUnsafe(
    `SELECT (${keyExpr}) AS key, count(*)::int calls, count(*) FILTER (WHERE s.failed)::int failed,
            coalesce(sum(s."tokensIn"),0)::float8 tin, coalesce(sum(s."tokensOut" + s."tokensThinking"),0)::float8 tout,
            coalesce(sum(s."estCostPence"),0)::float8 pence_known,
            count(*) FILTER (WHERE s.unpriced OR s."estCostPence" IS NULL)::int unpriced
       FROM "LlmSpend" s WHERE ${sql} GROUP BY 1 ORDER BY pence_known DESC, calls DESC`,
    ...args,
  ) as Array<{ key: string | null; calls: number; failed: number; tin: number; tout: number; pence_known: number; unpriced: number }>

  const lab = await labels(p.by, grouped.map((g) => g.key).filter((k): k is string => !!k))
  const totalKnown = grouped.reduce((s, g) => s + g.pence_known, 0)

  // What the Unattributed line is made of (only when it exists, and only for the dimension being grouped).
  let breakdown: ExploreRow['breakdown']
  if (grouped.some((g) => g.key == null)) {
    const b = await prisma.$queryRawUnsafe(
      `SELECT s.pass feature, s.stream, count(*)::int calls, coalesce(sum(s."estCostPence"),0)::float8 pence
         FROM "LlmSpend" s WHERE ${sql} AND (${keyExpr}) IS NULL GROUP BY 1,2 ORDER BY pence DESC LIMIT 12`,
      ...args,
    ) as Array<{ feature: string; stream: string; calls: number; pence: number }>
    breakdown = b.map((r) => ({ feature: r.feature, pence: r.pence, calls: r.calls, origin: spendOriginOf(r.stream, r.feature) }))
  }

  const rows: ExploreRow[] = grouped.map((g) => ({
    key: g.key,
    label: g.key == null
      ? `Unattributed (no ${p.by})`
      : p.by === 'provider' || p.by === 'model' || p.by === 'feature' ? g.key : lab.get(g.key) ?? `${g.key.slice(0, 8)}…`,
    calls: g.calls, failedCalls: g.failed, tokensIn: g.tin, tokensOut: g.tout,
    pence: g.unpriced > 0 ? null : g.pence_known, penceKnown: g.pence_known, unpricedCalls: g.unpriced,
    share: totalKnown ? g.pence_known / totalKnown : 0,
    ...(g.key == null && breakdown ? { breakdown } : {}),
  }))

  const totals = rows.reduce(
    (t, r) => ({ calls: t.calls + r.calls, tokensIn: t.tokensIn + r.tokensIn, tokensOut: t.tokensOut + r.tokensOut,
      penceKnown: t.penceKnown + r.penceKnown, unpricedCalls: t.unpricedCalls + r.unpricedCalls }),
    { calls: 0, tokensIn: 0, tokensOut: 0, penceKnown: 0, unpricedCalls: 0 },
  )

  // Coverage over the SAME filtered window, so it describes what is on screen.
  const cov = (await prisma.$queryRawUnsafe(
    `SELECT count(*)::int rows, count(s."userId")::int with_user, count(s."ideaId")::int with_idea, count(s."buildId")::int with_build,
            coalesce(sum(s."estCostPence"),0)::float8 total,
            coalesce(sum(s."estCostPence") FILTER (WHERE s."userId" IS NOT NULL),0)::float8 with_user_p,
            coalesce(sum(s."estCostPence") FILTER (WHERE s."ideaId" IS NOT NULL),0)::float8 with_idea_p
       FROM "LlmSpend" s WHERE ${sql}`, ...args,
  ) as Array<Record<string, number>>)[0]
  const src = await prisma.$queryRawUnsafe(
    `SELECT coalesce(s."attrSource",'none') source, count(*)::int rows, coalesce(sum(s."estCostPence"),0)::float8 pence
       FROM "LlmSpend" s WHERE ${sql} GROUP BY 1 ORDER BY pence DESC`, ...args,
  ) as Array<{ source: string; rows: number; pence: number }>

  const recon = await prisma.$queryRawUnsafe(
    `SELECT provider, to_char("day",'YYYY-MM-DD') AS day_str, "ledgerPence"::float8 ledger_pence, "ledgerRows" ledger_rows,
            "providerUsd"::float8 provider_usd, "gapPence"::float8 gap_pence, status, reason, "checkedAt"
       FROM "SpendReconciliation" WHERE "day" >= $1::date AND "day" < $2::date ORDER BY "day" DESC, provider`,
    p.from, p.to,
  ) as Array<{ provider: string; day_str: string; ledger_pence: number; ledger_rows: number; provider_usd: number | null; gap_pence: number | null; status: ReconRow['status']; reason: string | null; checkedAt: Date }>

  return {
    from: p.from.toISOString(), to: p.to.toISOString(), by: p.by,
    filters: Object.fromEntries(Object.entries(p.filters).filter(([, v]) => v)) as Record<string, string>,
    rows,
    totals: { ...totals, pence: totals.unpricedCalls > 0 ? null : totals.penceKnown },
    coverage: {
      rows: num(cov.rows), withUser: num(cov.with_user), withIdea: num(cov.with_idea), withBuild: num(cov.with_build),
      penceTotal: num(cov.total), penceWithUser: num(cov.with_user_p), penceWithIdea: num(cov.with_idea_p),
      penceUnattributedToUser: num(cov.total) - num(cov.with_user_p),
      bySource: src.map((r) => ({ source: r.source, pence: r.pence, rows: r.rows })),
    },
    reconciliation: recon.map((r) => ({
      provider: r.provider, day: r.day_str, ledgerPence: r.ledger_pence, ledgerRows: r.ledger_rows,
      providerUsd: r.provider_usd, gapPence: r.gap_pence, status: r.status, reason: r.reason, checkedAt: r.checkedAt.toISOString(),
    })),
  }
}
