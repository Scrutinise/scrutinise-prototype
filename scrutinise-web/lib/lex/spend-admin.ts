// ─────────────────────────────────────────────────────────────────────────────
// spend-admin.ts — BRIEF_SEARCH_S6 §3 ADDENDUM: the metering has to be VISIBLE.
//
// Charlie: "the metering must surface in the Admin tab, not only in the database.
// Charlie needs to see: daily tokens and cost, for search and for everything else
// separately; average cost per idea; and ideas ranked most to least expensive over a
// chosen period."
//
// ⚠⚠ MEASUREMENT ONLY. NO USER-FACING SPEND CONTROL IS SWITCHED ON, and that is Charlie's
// explicit instruction, not an omission: "until it's the user's own money, the only thing
// being measured is what this costs him." `checkUserCeiling()` exists in spend-ledger.ts
// and is called by NOTHING on a user path. `scripts/check-model-registry.ts` asserts that,
// so a ceiling cannot be quietly wired in without the check failing.
//
// ⚠ THE UNPRICED RULE TRAVELS. Every total here is null-when-any-contributing-call-is-
// unpriced, the same rule as spend-ledger.ts's fold(). A dashboard is exactly where a
// partial sum gets quoted as a complete one, so the page must be able to say
// "£4.12 plus 9 calls we cannot price" rather than "£4.12".
// ─────────────────────────────────────────────────────────────────────────────

import { prisma } from '@/lib/prisma'

/**
 * ⚠ THE SEARCH / EVERYTHING-ELSE SPLIT, AND WHY THERE IS A THIRD BUCKET.
 *
 * Charlie asked for two: search, and everything else. The view returns three, because the
 * split is by pass-name prefix and a pass nobody has classified must be VISIBLE rather than
 * folded into "everything else". If somebody adds `rerank.score` next month and does not
 * touch the view, "everything else" would quietly absorb it and grow for a reason the page
 * could not show. `unclassified` is normally zero; when it is not, that is the signal.
 */
export type SpendKind = 'search' | 'everything-else' | 'unclassified'

export interface DailyKindRow {
  day: string
  kind: SpendKind
  calls: number
  failedCalls: number
  unpricedCalls: number
  tokensIn: number
  tokensOut: number
  /** NULL when any contributing call was unpriced. Never a partial sum. */
  pence: number | null
}

export interface IdeaSpendRow {
  ideaId: string
  title: string | null
  calls: number
  tokensIn: number
  tokensOut: number
  pence: number | null
  unpricedCalls: number
}

export interface SpendOverview {
  since: string
  until: string
  daily: DailyKindRow[]
  /** ⚠ Null when ANY idea in the window has an unpriced call — see averageNote. */
  averagePencePerIdea: number | null
  ideasCounted: number
  averageNote: string
  ideas: IdeaSpendRow[]
  totals: { calls: number; tokensIn: number; tokensOut: number; pence: number | null; unpricedCalls: number }
  /** ⚠ Non-empty when a pass fell into `unclassified` — the page must show this. */
  unclassifiedPasses: string[]
}

const n = (v: unknown) => Number(v ?? 0)

/**
 * ⚠ THE AVERAGE IS THE MOST DANGEROUS NUMBER ON THE PAGE, so it is computed defensively.
 *
 * "Average cost per idea" divides by the number of ideas that spent anything in the window,
 * NOT by the number of ideas that exist. Those differ by a lot — most ideas are idle on any
 * given day — and dividing by all ideas would produce a small, comforting, meaningless
 * figure. The denominator is returned alongside so the page can state it.
 */
export async function spendOverview(since: Date, until: Date): Promise<SpendOverview> {
  const daily = await prisma.$queryRaw<Array<Record<string, unknown>>>`
    SELECT day::text AS day, kind, calls, failed_calls, unpriced_calls, tokens_in, tokens_out, pence
    FROM "LlmSpendKind"
    WHERE day >= ${since}::date AND day <= ${until}::date
    ORDER BY day DESC, kind`

  const ideas = await prisma.$queryRaw<Array<Record<string, unknown>>>`
    SELECT s."ideaId"                                     AS "ideaId",
           i.title                                        AS title,
           COUNT(*)                                       AS calls,
           SUM(s."tokensIn")                              AS "tokensIn",
           SUM(s."tokensOut" + s."tokensThinking")        AS "tokensOut",
           COUNT(*) FILTER (WHERE s.unpriced)             AS "unpricedCalls",
           CASE WHEN COUNT(*) FILTER (WHERE s.unpriced) > 0 THEN NULL
                ELSE SUM(s."estCostPence") END            AS pence
    FROM "LlmSpend" s
    LEFT JOIN "Idea" i ON i.id = s."ideaId"
    WHERE s."ideaId" IS NOT NULL
      AND s."createdAt" >= ${since} AND s."createdAt" < ${until}
    GROUP BY s."ideaId", i.title
    ORDER BY (CASE WHEN COUNT(*) FILTER (WHERE s.unpriced) > 0 THEN NULL
                   ELSE SUM(s."estCostPence") END) DESC NULLS FIRST`

  const { rows: unclassified } = await (async () => ({
    rows: await prisma.$queryRaw<Array<{ pass: string }>>`
      SELECT DISTINCT pass FROM "LlmSpend"
      WHERE "createdAt" >= ${since} AND "createdAt" < ${until}
        AND pass NOT LIKE 'search.%' AND pass NOT LIKE 'lex.%' AND pass NOT LIKE 'build.%'
        AND pass NOT LIKE 'deepening.%' AND pass NOT LIKE 'orientation.%' AND pass NOT LIKE 'graph.%'
      ORDER BY pass`,
  }))()

  const dailyRows: DailyKindRow[] = daily.map((r) => ({
    day: String(r.day),
    kind: r.kind as SpendKind,
    calls: n(r.calls),
    failedCalls: n(r.failed_calls),
    unpricedCalls: n(r.unpriced_calls),
    tokensIn: n(r.tokens_in),
    tokensOut: n(r.tokens_out),
    pence: r.pence == null ? null : Number(r.pence),
  }))

  const ideaRows: IdeaSpendRow[] = ideas.map((r) => ({
    ideaId: String(r.ideaId),
    title: r.title == null ? null : String(r.title),
    calls: n(r.calls),
    tokensIn: n(r.tokensIn),
    tokensOut: n(r.tokensOut),
    unpricedCalls: n(r.unpricedCalls),
    pence: r.pence == null ? null : Number(r.pence),
  }))

  const totals = dailyRows.reduce(
    (a, r) => ({
      calls: a.calls + r.calls,
      tokensIn: a.tokensIn + r.tokensIn,
      tokensOut: a.tokensOut + r.tokensOut,
      unpricedCalls: a.unpricedCalls + r.unpricedCalls,
      pence: a.pence == null || r.pence == null ? null : a.pence + r.pence,
    }),
    { calls: 0, tokensIn: 0, tokensOut: 0, unpricedCalls: 0, pence: 0 as number | null },
  )

  const { average, note } = averagePerIdea(ideaRows)

  return {
    since: since.toISOString().slice(0, 10),
    until: until.toISOString().slice(0, 10),
    daily: dailyRows,
    ideas: ideaRows,
    averagePencePerIdea: average,
    ideasCounted: ideaRows.length,
    averageNote: note,
    totals,
    unclassifiedPasses: unclassified.map((u) => u.pass),
  }
}

/**
 * ⚠ EXPORTED SO IT CAN BE TESTED WITHOUT A DATABASE, and it needs testing: this is the
 * function that decides whether Charlie sees a number or a refusal.
 *
 * Returns null when ANY idea in the window carries an unpriced call. That is stricter than
 * dropping the unpriced ideas and averaging the rest, and deliberately so: the unpriced
 * calls are the Claude and Grok passes, which are the EXPENSIVE ones. An average that
 * silently excluded them would be biased low in exactly the direction that matters.
 */
export function averagePerIdea(ideas: IdeaSpendRow[]): { average: number | null; note: string } {
  if (!ideas.length) return { average: null, note: 'no idea spent anything in this period' }
  const unpriced = ideas.filter((i) => i.pence == null)
  if (unpriced.length) {
    return {
      average: null,
      note: `${unpriced.length} of ${ideas.length} ideas contain a call with no rate on file, so an average `
        + 'would be biased low — the unpriced models are the expensive ones',
    }
  }
  const total = ideas.reduce((a, i) => a + (i.pence ?? 0), 0)
  return {
    average: total / ideas.length,
    note: `over the ${ideas.length} idea${ideas.length === 1 ? '' : 's'} that spent anything in this period, `
      + 'not over every idea on the platform',
  }
}

/** "£0.42" / "under a penny" / "not known". Mirrors spend-ledger.ts deliberately. */
export function fmtPence(pence: number | null): string {
  if (pence == null) return 'not known'
  if (pence === 0) return '£0.00'
  if (pence < 1) return 'under a penny'
  return `£${(pence / 100).toFixed(2)}`
}
