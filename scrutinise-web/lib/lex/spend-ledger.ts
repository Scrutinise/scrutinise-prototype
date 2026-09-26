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
import { currentBuildContext } from './build-context'

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
  /**
   * ⚠ ON BEHALF OF A GROUP, AND IT IS HERE BEFORE THE FEATURE THAT NEEDS IT.
   *
   * Buying tokens for a community group is planned and not built. The column exists anyway,
   * because a column added after there is history is not the same column: every row written
   * before it existed carries NULL, and NULL is indistinguishable from "an individual spent
   * this". The group attribution of the platform's first months would be gone for good.
   *
   * NULL means "not on behalf of a group" — a reading that is only safe because the column
   * has been there since the first row. Nothing reads it yet. It is being kept warm.
   */
  groupId?: string | null
  /** Free-form: a build id, a run id, a section id — whatever makes the row traceable. */
  ref?: string | null
  /** TRUE when the call failed. ⚠ A failed call still costs money. */
  failed?: boolean
  /**
   * S21 §6 — server-side tool invocations the provider itself billed for (xAI's
   * `web_search`/`x_search`, Gemini's `google_search`). NULL where the vendor
   * does not report this or the call made none.
   */
  toolCalls?: number | null
  /**
   * S21 §3/§6 — items an X/web search tool actually fetched, read off the
   * provider's own usage block (xAI: `usage.server_side_tool_usage_details.
   * x_posts_fetched`), never counted client-side. This is what the per-briefing
   * post cap (§3) is enforced and logged against.
   */
  postsFetched?: number | null
  /**
   * S21 §6 — the provider's OWN reported USD cost for this call (xAI's
   * `cost_in_usd_ticks`), where the vendor bills tool invocations as well as
   * tokens and a token-rate estimate would understate it. When present this
   * REPLACES the rate-card estimate rather than supplementing it — see
   * `priceEntry`.
   */
  actualUsd?: number | null
}

export interface PricedSpend {
  /** NULL when the model has no rate on file. NEVER zero-as-a-substitute. */
  pence: number | null
  usd: number | null
  unpriced: boolean
}

// Exported so a reader converting stored GBP pence back to USD (scripts/cost-alert.ts — the
// thresholds in S22 "Alerts" are USD, and only pence is persisted) uses the SAME rate this
// file priced the row at, rather than a second hardcoded 0.79 that could drift from it.
export const USD_TO_GBP = Number(process.env.LEX_BUILD_USD_GBP ?? '0.79')

/** Price one entry. Thinking tokens bill at the output rate — the only honest total. */
export function priceEntry(
  e: Pick<SpendEntry, 'model' | 'tokensIn' | 'tokensOut' | 'tokensThinking' | 'actualUsd'>,
): PricedSpend {
  // ⚠ S21 §6 — A PROVIDER-REPORTED ACTUAL COST WINS OVER THE RATE CARD. xAI bills
  // tool invocations (web_search/x_search) as well as tokens, so a token-rate
  // estimate would silently exclude the tool charge — the exact "flattering bug"
  // the S6 §3 header warns about, one layer up. `actualUsd` is what the vendor's
  // own `usage` block says this call cost; when the vendor states it, that is
  // the number, not an estimate built on top of it.
  if (e.actualUsd != null && Number.isFinite(e.actualUsd)) {
    return { pence: e.actualUsd * USD_TO_GBP * 100, usd: e.actualUsd, unpriced: false }
  }
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
  // S22 — ATTRIBUTION. An explicit userId/ideaId always wins; the ambient build context
  // (build-context.ts) is read ONLY as the fallback, so a call that runs outside a build (or
  // that already knows better, like chat web search stamping the chatting admin) is never
  // overridden by context it is not even inside. This is the ONE place the fallback applies —
  // every caller of recordSpend, recordGeminiUsage and recordXaiUsage gets it for free.
  const ctx = currentBuildContext()
  const userId = e.userId ?? ctx?.userId ?? null
  const ideaId = e.ideaId ?? ctx?.ideaId ?? null
  try {
    await prisma.$executeRaw`
      INSERT INTO "LlmSpend" ("stream", "pass", "model", "tokensIn", "tokensOut", "tokensThinking",
                              "estCostPence", "unpriced", "userId", "ideaId", "groupId", "ref", "failed",
                              "toolCalls", "postsFetched")
      VALUES (${e.stream}, ${e.pass}, ${e.model}, ${e.tokensIn}, ${e.tokensOut}, ${e.tokensThinking ?? 0},
              ${priced.pence}, ${priced.unpriced}, ${userId}, ${ideaId},
              ${e.groupId ?? null}, ${e.ref ?? null}, ${e.failed ?? false},
              ${e.toolCalls ?? null}, ${e.postsFetched ?? null})`
  } catch (err) {
    console.warn('[spend-ledger] could not record spend', {
      stream: e.stream, pass: e.pass, model: e.model,
      error: err instanceof Error ? err.message : String(err),
    })
  }
  return priced
}

/**
 * Record straight from a Gemini response body — the one-liner every call site needs.
 *
 * ⚠⚠ THIS EXISTS BECAUSE THE LEDGER WAS INERT. S6 built `recordSpend` and wired it into
 * nothing on the web side: after the sprint the table held rows from two ingest scripts and
 * from no user-facing path at all. The Admin tab added in the §3 addendum would have shown a
 * platform that spends almost nothing, which is the most flattering possible bug.
 *
 * ⚠ There is no single shared Gemini caller in `lib/lex` — eleven files each run their own
 * fetch. So the recording cannot be centralised without a refactor those files' owners have
 * not asked for. This is the next best thing: ONE implementation, called from each site, with
 * `check-model-registry.ts` asserting that every file which reads `usageMetadata` also records
 * or is on a named exception list. A per-caller check is what caught the truncation guard
 * missing in seven callers (docs/CLAUDE.md §18); the same shape of check applies here.
 *
 * ⚠ `thoughtsTokenCount` is read and billed as OUTPUT. A model with thinking enabled that
 * reported only `candidatesTokenCount` would understate its own cost by most of it.
 */
export function recordGeminiUsage(
  body: unknown, ctx: Omit<SpendEntry, 'tokensIn' | 'tokensOut' | 'tokensThinking'>,
): Promise<PricedSpend> {
  const u = (body as { usageMetadata?: Record<string, unknown> } | null)?.usageMetadata ?? {}
  const num = (v: unknown) => (typeof v === 'number' && Number.isFinite(v) ? v : 0)
  return recordSpend({
    ...ctx,
    tokensIn: num(u.promptTokenCount),
    tokensOut: num(u.candidatesTokenCount),
    tokensThinking: num(u.thoughtsTokenCount),
  })
}

/** xAI reports actual billed spend as ticks; 1 USD = 1e10 ticks (docs, cost tracking,
 *  the same constant probed live and used in orientation/x-orientation.ts). */
const XAI_TICKS_PER_USD = 1e10

/**
 * Record straight from an xAI Responses-API body — the one-liner every xAI call site
 * needs, matching `recordGeminiUsage`'s shape and purpose.
 *
 * ⚠ S21 §6 — THIS EXISTS BECAUSE THE LEDGER WAS INERT FOR THIS VENDOR TOO. Every xAI
 * call in `orientation/x-orientation.ts` already computed its own `costUsd` from
 * `usage.cost_in_usd_ticks` and returned it up to the caller — and nothing wrote it to
 * `LlmSpend`. The S6 §3 ledger measured Gemini and ingest spend only; a platform total
 * read off the Admin tab was missing the whole X/Tier-C stream without saying so, which
 * is the identical "most flattering possible bug" `recordGeminiUsage`'s own header
 * describes for the web side. `check:model-registry`'s unmetered-caller sweep is widened
 * to `api.x.ai` alongside `generativelanguage.googleapis.com` so this cannot recur silently.
 *
 * `postsFetched` reads `usage.server_side_tool_usage_details.x_posts_fetched` — the
 * provider's own count, never a client-side tally — because that is the number the §3
 * per-briefing cap is enforced and logged against.
 */
export function recordXaiUsage(
  body: unknown, ctx: Omit<SpendEntry, 'tokensIn' | 'tokensOut' | 'actualUsd' | 'toolCalls' | 'postsFetched'>,
): Promise<PricedSpend> {
  const b = body as {
    usage?: {
      input_tokens?: number
      output_tokens?: number
      cost_in_usd_ticks?: number
      server_side_tool_usage_details?: { x_posts_fetched?: number; x_users_fetched?: number; web_search_calls?: number }
    }
  } | null
  const u = b?.usage ?? {}
  const num = (v: unknown) => (typeof v === 'number' && Number.isFinite(v) ? v : 0)
  const tools = u.server_side_tool_usage_details
  const postsFetched = tools ? num(tools.x_posts_fetched) + num(tools.x_users_fetched) : null
  const toolCalls = tools ? num(tools.web_search_calls) || null : null
  return recordSpend({
    ...ctx,
    tokensIn: num(u.input_tokens),
    tokensOut: num(u.output_tokens),
    actualUsd: typeof u.cost_in_usd_ticks === 'number' ? u.cost_in_usd_ticks / XAI_TICKS_PER_USD : null,
    postsFetched: postsFetched || null,
    toolCalls,
  })
}

/**
 * S24b — Anthropic's web_search tool, verified live 2026-09-25 against a real call
 * (docs.anthropic.com pricing: $10 per 1,000 `web_search_requests`, billed on top of tokens —
 * unlike xAI, Anthropic's `usage` block reports NO single all-in cost, so it has to be
 * composed here from the rate card plus the tool fee rather than read straight off the vendor.
 *
 * ⚠ ONLY COMPOSED WHEN A RATE IS ON FILE FOR THE MODEL. A tool fee added to a silently-missing
 * token cost would look like a real total and understate it — the same "most flattering
 * possible bug" `recordGeminiUsage`'s header warns about. No rate ⇒ `actualUsd` stays null and
 * the row records as unpriced, same as any other unrated model, rather than a partial number
 * dressed as a whole one.
 */
const ANTHROPIC_WEB_SEARCH_USD_PER_CALL = 0.01 // $10 / 1,000 requests

export function recordAnthropicUsage(
  body: unknown, ctx: Omit<SpendEntry, 'tokensIn' | 'tokensOut' | 'actualUsd' | 'toolCalls'>,
): Promise<PricedSpend> {
  const b = body as {
    usage?: { input_tokens?: number; output_tokens?: number; server_tool_use?: { web_search_requests?: number } }
  } | null
  const u = b?.usage ?? {}
  const num = (v: unknown) => (typeof v === 'number' && Number.isFinite(v) ? v : 0)
  const tokensIn = num(u.input_tokens)
  const tokensOut = num(u.output_tokens)
  const toolCalls = num(u.server_tool_use?.web_search_requests) || null
  const rate = rates()[ctx.model]
  const actualUsd = toolCalls && rate
    ? (tokensIn / 1_000_000) * rate.inPerM + (tokensOut / 1_000_000) * rate.outPerM + toolCalls * ANTHROPIC_WEB_SEARCH_USD_PER_CALL
    : null
  return recordSpend({ ...ctx, tokensIn, tokensOut, actualUsd, toolCalls })
}

/**
 * S25 — OpenAI's `web_search` tool via the Responses API. Confirmed from
 * developers.openai.com/api/docs/pricing (25 Sep 2026, not a live call — see
 * model-registry.ts's REACHABLE.openai comment): **$10.00 per 1,000 calls**, "search content
 * tokens billed at model rates" — i.e. unlike Anthropic's flat per-request fee, the tokens
 * OpenAI's own search fetches ALSO count in `usage.output_tokens`, so only the per-call
 * SURCHARGE is added on top of the ordinary rate-card token cost, not a second token cost.
 *
 * ⚠ SAME "ONLY COMPOSED WHEN A RATE IS ON FILE" RULE AS `recordAnthropicUsage`, for the
 * identical reason: a tool fee stacked on a silently-missing token cost would look like a
 * real total while understating it.
 *
 * `toolCalls` is not in OpenAI's `usage` block the way Anthropic's is — it is counted from
 * the response's own `output` array (entries of `type: 'web_search_call'`), so the caller
 * passes the full response body, same convention as `recordXaiUsage`.
 */
const OPENAI_WEB_SEARCH_USD_PER_CALL = 0.01 // $10 / 1,000 calls

export function recordOpenaiUsage(
  body: unknown, ctx: Omit<SpendEntry, 'tokensIn' | 'tokensOut' | 'actualUsd' | 'toolCalls'>,
): Promise<PricedSpend> {
  const b = body as {
    usage?: { input_tokens?: number; output_tokens?: number }
    output?: Array<{ type?: string }>
  } | null
  const num = (v: unknown) => (typeof v === 'number' && Number.isFinite(v) ? v : 0)
  const tokensIn = num(b?.usage?.input_tokens)
  const tokensOut = num(b?.usage?.output_tokens)
  const toolCalls = (b?.output ?? []).filter((o) => o.type === 'web_search_call').length || null
  const rate = rates()[ctx.model]
  const actualUsd = toolCalls && rate
    ? (tokensIn / 1_000_000) * rate.inPerM + (tokensOut / 1_000_000) * rate.outPerM + toolCalls * OPENAI_WEB_SEARCH_USD_PER_CALL
    : null
  return recordSpend({ ...ctx, tokensIn, tokensOut, actualUsd, toolCalls })
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

// ─────────────────────────────────────────────────────────────────────────────
// S25 — the cost digest's "purpose" split. Charlie's own six categories: user builds, Lex
// chat, web orientation, search, ingest and maintenance, tests and measurement.
//
// ⚠ KEYED BY PASS NAME, NOT `stream` — the brief asks to "map each ledger PASS NAME to one
// purpose," and `stream` is coarser (e.g. `'lex'` covers both idea-chat and idea-building
// passes). A pass queried from `LlmSpend` that has no entry here is reported as UNMAPPED by
// the digest, never folded into a purpose silently — same rule as `KNOWN_STALE` in
// model-registry.ts and the `unclassifiedPasses` list in spend-admin.ts.
//
// ⚠ Deepening (`deepening.*`) is filed under 'user builds', not 'Lex chat': it gathers and
// sifts evidence FOR an idea's build in the background, not a chat turn — closer in kind to
// `build.draft`/`build.settle` than to `lex.chat`. This is a judgement call on a lookup
// table, not an architectural claim; move an entry here if Charlie reads it differently.
//
// ⚠ EMBEDDINGS ARE NOT IN THIS MAP, AND CANNOT BE. Vector search's Gemini embedding calls
// happen inside `vector-serve` (a separate Railway service) and are never stamped into
// `LlmSpend` — there is no rate card entry for an embedding model in build-cost.ts either.
// The digest reports vector-serve's own "embed calls/day" counter (from its live `/stats`,
// the same figure the old serve-observer digest printed) as an UNPRICED count alongside this
// purpose split, not folded into a £ total it cannot honestly produce.
export type SpendPurpose = 'user builds' | 'Lex chat' | 'web orientation' | 'search' | 'ingest and maintenance' | 'tests and measurement'

export const PASS_PURPOSE: Record<string, SpendPurpose> = {
  // 'user builds' — producing/checking a user's idea build, including its research and
  // adversarial passes and Deepening's evidence-gathering (see the header note above).
  'build.draft': 'user builds',
  'build.settle': 'user builds',
  'build-research.gather': 'user builds',
  'build-adversarial.adversarial': 'user builds',
  'build-adversarial-strong.adversarial': 'user builds',
  'b22-adversarial.adversarial': 'user builds',
  'deepening.gather': 'user builds',
  'deepening.sift': 'user builds',
  'deepening.adversarial': 'user builds',
  'deepening.consequences': 'user builds',

  'lex.chat': 'Lex chat',
  'lex.field': 'Lex chat',
  'lex.material': 'Lex chat',
  'lex.feedback': 'Lex chat',
  'lex.general-chat': 'Lex chat',
  'lex.chat-web-search-decide': 'Lex chat',
  'lex.chat-web-search': 'Lex chat',

  'orientation.web': 'web orientation',
  'orientation.web-search': 'web orientation',
  'orientation.web-fallback': 'web orientation',
  'orientation.x': 'web orientation',

  'search.reranker': 'search',
  'search.query-expansion': 'search',
  'search.query-router': 'search',
  // LEX_ROUTER_BILL_VOCAB (S24) — the router's bill-publication vocabulary pass.
  'smart-vocabulary.gather': 'search',

  'graph.position-extract': 'ingest and maintenance',
  'graph.proposition-derive': 'ingest and maintenance',

  's24b.web-search-comparison': 'tests and measurement',
  's24b.retry-probe': 'tests and measurement',
  's24b.smoke': 'tests and measurement',
  'BACKFILL_TITLE': 'tests and measurement',
  'CLASSIFY_STALE': 'tests and measurement',
  'CLASSIFY_STALE_V2': 'tests and measurement',
  'MERGE_TIGHTENED': 'tests and measurement',
  'reachability': 'tests and measurement',
  // '-test' in its own name — a quality probe on the EDM extraction pass, not the pass itself.
  'graph.edm-test': 'tests and measurement',
}

/** The purpose for a pass, or `null` if it is not in `PASS_PURPOSE` — callers must report an
 *  unmapped pass, never silently fold it into a default bucket. */
export function purposeFor(pass: string): SpendPurpose | null {
  return PASS_PURPOSE[pass] ?? null
}
