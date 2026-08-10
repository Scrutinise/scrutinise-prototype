/**
 * corpus-reachability.ts — WHICH PART OF THE CORPUS ANY QUERY CAN ACTUALLY REACH.
 * BRIEF_SEARCH_S2B §1. Produces `docs/CORPUS_REACHABILITY.md` + `docs/corpus_reachability.json`.
 *
 * THE QUESTION. The router selects from five streams. The corpus holds ~68 collections. A
 * collection that no stream can select is unreachable by any query, however good the ranking is
 * — and every ordering improvement we have measured has been an improvement to the part of the
 * corpus that happens to be wired up, with no instrument saying how large that part is. This is
 * the instrument. It is a MEASUREMENT, not a design: the stream set gets decided from the table,
 * and that decision is Charlie's.
 *
 * WHAT IT DERIVES FROM, and what it refuses to assume:
 *   · `sections`   — Neon `corpus_sections`, grouped by corpus. The ingest-side truth.
 *   · `fts_rows`   — a FULL SCAN of the Lance `corpus_fts` table projecting (corpus, tier).
 *   · `vec_rows`   — the same over `corpus_vec`.
 *   · `tier`       — ⚠ READ OUT OF THE INDEX, never computed from `tierFor(corpus)`. The tier is
 *                    BAKED IN at index-build time, so a corpus seeded after the tier map last
 *                    changed carries the OLD tier in the live index — and the router filters on
 *                    the index, not on the map. Computing it from corpus-map.ts would produce a
 *                    table that says `scottish-parliament-or` is parliamentary and reachable,
 *                    when the live index has it under `other` where no stream can see it.
 *                    A corpus split across two tiers is reported as split rather than collapsed.
 *   · `type`       — corpus-type-map.ts's `corpusToType`, evaluated over a SAMPLE of that
 *                    collection's real ids (the legislation tier's type depends on the gid
 *                    doctype, so one corpus can yield PRIMARY_LEGISLATION and STATUTORY_INSTRUMENT
 *                    both). A collection whose every sample maps to `null` is dropped by the FTS
 *                    adapter before any stream sees it — retrieved, paid for, discarded.
 *   · `router_stream` — computed by `streamCanSelect` from the LIVE STREAM_SCOPES the router
 *                    itself dispatches on (lib/lex/stream-scopes.ts), imported, not copied.
 *   · `gold_questions` — MEASURED, by running the gold set and seeing which collection actually
 *                    satisfied each answer key. See §2 below.
 *
 * THE VERDICT COLUMN is the point; everything else is evidence for it.
 *   reachable     — some router stream can select it.
 *   keyword-only  — no stream can, but the UNROUTED path (router off, or its fail-open) searches
 *                   every tier unfiltered and the adapter gives it a display type. So it surfaces
 *                   only when routing is off or has just failed — which is not a retrieval policy,
 *                   it is an accident of a degraded mode.
 *   tier-only     — reachable only by a caller that passes an explicit tier (gateway-legacy.ts),
 *                   which gets neither routing nor dense retrieval.
 *   excluded-by-design — no path at all, ON PURPOSE. The collection is named in
 *                   `EXCLUDED_BY_DESIGN` (corpus-type-map.ts) with its reason. ⚠ This verdict
 *                   exists because the first run of this matrix printed UNREACHABLE for
 *                   `members-interests`, which is deliberately out of general search, right
 *                   beside three collections that were lost by accident — identical word,
 *                   opposite meaning. The next person doing a sweep of the nulls would have
 *                   "fixed" the decision along with the defects.
 *   deferred-to-graph — destined for a DIFFERENT CONSUMER (the position graph), so retrieval is
 *                   the wrong door rather than a broken one. Named in `DEFERRED_TO_GRAPH`.
 *                   ⚠ Unlike excluded-by-design this is NOT enforced anywhere: these collections
 *                   keep their display type and their existing reachability. The `note` therefore
 *                   states what retrieval still does with them, because a verdict that hid "the
 *                   unrouted path still returns this" would trade one silent fact for another.
 *   UNREACHABLE   — no path at all, and nobody chose that. Either the display type is null for
 *                   a reason no longer stated anywhere, or nothing selects its tier.
 *
 * §2 — THE GOLD-KEY PROVENANCE CHECK. Four committee gold questions score a flat 100% while
 * returning zero committee documents: Hansard satisfies the key by accident. Restated as a
 * general property: for each gold question, WHICH COLLECTION the documents that satisfied the key
 * actually came from, versus which the key intends. A question satisfied entirely from a
 * different collection family than intended is not testing what it claims to test, and there may
 * be more than the four we know about. Retrieval here is the untiered top-20 BM25 the scoring
 * harness uses (`rankedSearch`), so the numbers are comparable with the existing gold reports.
 *
 * Run from scripts/ingest:
 *   npx tsx search/corpus-reachability.ts              full run (~2–4 min; two full Lance scans)
 *   npx tsx search/corpus-reachability.ts --no-gold    skip the gold pass (no LLM, no top-20 runs)
 *   npx tsx search/corpus-reachability.ts --sample 50  ids sampled per corpus for typing (default 200)
 */
import fs from 'fs'
import path from 'path'
import { Pool } from 'pg'
import { connectLance, FTS_TABLE } from './lance'
import { VEC_TABLE } from './vector-common'
import { rankedSearch } from './fts-core'
import { loadActIndex } from './citation-resolver'
import { GOLD } from './gold-queries'
import { DRAFT_QUERIES } from './gold-draft-streams'
// The web app's live mapping + live stream scopes, imported rather than restated. Both are
// runtime-dependency-free (type-only imports inside), which is what makes this reachable from
// outside the Next.js path alias.
import { corpusToType, EXCLUDED_BY_DESIGN, DEFERRED_TO_GRAPH } from '../../../scrutinise-web/lib/lex/corpus-type-map'
import { STREAM_SCOPES, streamCanSelect } from '../../../scrutinise-web/lib/lex/stream-scopes'
import type { SearchResultType } from '../../../scrutinise-web/lib/lex/page1-config'

const ARGS = process.argv.slice(2)
const NO_GOLD = ARGS.includes('--no-gold')
const SAMPLE_N = (() => {
  const i = ARGS.indexOf('--sample')
  const v = i >= 0 ? parseInt(ARGS[i + 1] ?? '', 10) : NaN
  return Number.isFinite(v) && v > 0 ? v : 200
})()
const TOPN = 20
const DOCS = path.join(__dirname, '../../../docs')

/** The three legacy surfaces pass an explicit tier and so bypass the router entirely
 *  (gateway-legacy.ts). Kept as data so the table names them rather than saying "some callers". */
const TIER_SCOPED_CALLERS: Array<{ tier: string; callers: string[] }> = [
  {
    tier: 'legislation',
    callers: [
      'app/api/ai/[ideaId] (Lex chat grounding)',
      '/api/ideas/[id]/legislation-search (CreateIdea panel)',
      'POST /api/search',
    ],
  },
]

interface GoldProvenance {
  id: string; query: string; intendedStream: string; draft: boolean
  keysTotal: number; keysHit: number
  /** Collections the documents that SATISFIED an answer key came from. */
  satisfyingCorpora: Record<string, number>
  /** Collections the whole top-20 came from — the "0/20 committee documents" measurement. */
  topCorpora: Record<string, number>
  inStreamKeyHits: number
  inStreamTop: number
  /** Satisfying hits from a collection NO caller can ever receive (verdict UNREACHABLE — the
   *  FTS adapter drops the row). The scoring harness reads Lance directly and so sees rows the
   *  app never delivers; recall satisfied by those is recall the product does not have. */
  undeliverableKeyHits: number
  undeliverableFrom: string[]
  /** Satisfying hits from a keyword-only collection: delivered by the UNROUTED path, never by a
   *  routed one. Kept apart from the above because the fix is different — one is a display-type
   *  gap, the other is a stream-coverage gap. */
  unroutableKeyHits: number
  unroutableFrom: string[]
  outcome: 'ok' | 'off-stream' | 'no-router-stream' | 'no-key-hit'
}

interface Row {
  collection: string
  label: string | null
  retired: boolean
  sections: number
  compiled: number
  fts_rows: number
  vec_rows: number
  /** Tier as READ FROM THE LIVE FTS INDEX, with the row count under each. */
  index_tiers: Record<string, number>
  tier: string
  tier_split: boolean
  types: string[]
  /** true when EVERY sampled id maps to null — the adapter drops the whole collection. */
  type_null: boolean
  router_stream: string
  tier_scoped_callers: string[]
  gold_questions: number
  gold_ids: string[]
  verdict: 'reachable' | 'keyword-only' | 'tier-only' | 'excluded-by-design' | 'deferred-to-graph' | 'UNREACHABLE'
  note: string | null
}

const VERDICTS = ['reachable', 'tier-only', 'keyword-only', 'deferred-to-graph', 'excluded-by-design', 'UNREACHABLE'] as const

// ── Lance: one projected scan per table, aggregated in memory ────────────────
async function scanCorpusTier(table: string): Promise<Map<string, Map<string, number>>> {
  const db = await connectLance()
  const t = await db.openTable(table)
  const expected = await t.countRows()
  const out = new Map<string, Map<string, number>>()
  let rows = 0
  const started = Date.now()
  for await (const batch of t.query().select(['corpus', 'tier']) as any) {
    const c = batch.getChild('corpus'), ti = batch.getChild('tier')
    for (let i = 0; i < batch.numRows; i++) {
      const corpus = String(c.get(i) ?? ''), tier = String(ti.get(i) ?? '')
      let m = out.get(corpus)
      if (!m) { m = new Map(); out.set(corpus, m) }
      m.set(tier, (m.get(tier) ?? 0) + 1)
    }
    rows += batch.numRows
  }
  // A short scan is a silently wrong table, not a fast one. Say so rather than reporting it.
  const total = [...out.values()].reduce((n, m) => n + [...m.values()].reduce((a, b) => a + b, 0), 0)
  console.log(`[reachability] ${table}: scanned ${rows.toLocaleString()} rows in ${((Date.now() - started) / 1000).toFixed(1)}s, ${out.size} corpora`)
  if (rows !== expected || total !== expected) {
    throw new Error(`${table} scan is short: countRows()=${expected}, scanned=${rows}, aggregated=${total}. Refusing to report a partial matrix.`)
  }
  return out
}

/** The tier the router will actually see for this corpus: the one most of its rows carry. */
function dominantTier(tiers: Map<string, number>): { tier: string; split: boolean } {
  const entries = [...tiers.entries()].sort((a, b) => b[1] - a[1])
  if (!entries.length) return { tier: '(not indexed)', split: false }
  return { tier: entries[0][0], split: entries.length > 1 }
}

async function main() {
  const pool = new Pool({
    connectionString: process.env.NEON_DATABASE_URL,
    ssl: { rejectUnauthorized: false }, max: 3, statement_timeout: 600_000,
  })

  // ── 1. Neon: sections per collection ──────────────────────────────────────
  const { rows: secRows } = await pool.query<{ corpus: string; n: string; compiled: string }>(
    `SELECT corpus, COUNT(*)::text n, COUNT(*) FILTER (WHERE status='compiled')::text compiled
       FROM corpus_sections GROUP BY corpus ORDER BY corpus`)
  console.log(`[reachability] corpus_sections: ${secRows.length} collections, ` +
    `${secRows.reduce((n, r) => n + +r.n, 0).toLocaleString()} rows`)

  const { rows: targetRows } = await pool.query<{ corpus_key: string; display_label: string | null; retired: boolean | null }>(
    `SELECT corpus_key, display_label, retired FROM corpus_targets`)
  const targets = new Map(targetRows.map((r) => [r.corpus_key, r]))

  // ── 2. id samples, for the display-type mapping ───────────────────────────
  // corpusToType reads the gid doctype off the id for the legislation tier, so one corpus can
  // produce several types (`regional` mixes devolved Acts and devolved SIs). Sampled, not
  // exhaustive: SAMPLE_N ids per collection, reported as the SET of types observed.
  const { rows: sampleRows } = await pool.query<{ corpus: string; ids: string[] }>(
    `SELECT c.corpus, (
        SELECT array_agg(s.id) FROM (
          SELECT id FROM corpus_sections s2 WHERE s2.corpus = c.corpus LIMIT $2
        ) s
      ) ids
      FROM unnest($1::text[]) AS c(corpus)`, [secRows.map((r) => r.corpus), SAMPLE_N])
  const samples = new Map(sampleRows.map((r) => [r.corpus, r.ids ?? []]))

  // ── 3. the two Lance scans ────────────────────────────────────────────────
  const fts = await scanCorpusTier(FTS_TABLE)
  const vec = await scanCorpusTier(VEC_TABLE)

  // ── 4. assemble ───────────────────────────────────────────────────────────
  function typesFor(corpus: string, tier: string): Array<SearchResultType | null> {
    const ids = samples.get(corpus) ?? []
    const probe = ids.length ? ids : [`${corpus}:unknown`]
    const seen = new Set<SearchResultType | null>()
    for (const id of probe) seen.add(corpusToType(corpus, tier, id))
    return [...seen]
  }

  const collections = new Set<string>([...secRows.map((r) => r.corpus), ...fts.keys(), ...vec.keys()])
  const rows: Row[] = []

  for (const corpus of [...collections].sort()) {
    const sec = secRows.find((r) => r.corpus === corpus)
    const ftsTiers = fts.get(corpus) ?? new Map<string, number>()
    const vecTiers = vec.get(corpus) ?? new Map<string, number>()
    const ftsRows = [...ftsTiers.values()].reduce((a, b) => a + b, 0)
    const vecRows = [...vecTiers.values()].reduce((a, b) => a + b, 0)
    const { tier, split } = dominantTier(ftsTiers.size ? ftsTiers : vecTiers)
    const typeSet = typesFor(corpus, tier)
    const types = typeSet.filter((t): t is SearchResultType => t !== null)
    const typeNull = types.length === 0

    const streams = STREAM_SCOPES
      .filter((s) => types.some((t) => streamCanSelect(s, corpus, tier, t)))
      .map((s) => s.name)
    const callers = TIER_SCOPED_CALLERS
      .filter((c) => c.tier === tier && !typeNull)
      .flatMap((c) => c.callers)

    let verdict: Row['verdict']
    let note: string | null = null
    // Checked BEFORE `streams.length`, not after the null test, so that the verdict states the
    // DECISION rather than the mechanism that implements it. If the exclusion were ever
    // implemented some other way — or if a stream were widened to include it by mistake — this
    // row would still say excluded-by-design, and the check script would catch the contradiction.
    if (corpus in EXCLUDED_BY_DESIGN) {
      verdict = 'excluded-by-design'
      note = `DELIBERATE: ${EXCLUDED_BY_DESIGN[corpus]}` +
        (streams.length ? ` ⚠ BUT ${streams.join(' + ')} CAN NOW SELECT IT — the exclusion has been broken` : '')
    } else if (corpus in DEFERRED_TO_GRAPH) {
      // Evaluated BEFORE `streams.length` so the verdict states the DESTINATION, which is the
      // decision, rather than the retrieval status, which is a consequence. ⚠ The note carries
      // the retrieval status anyway: this verdict is documentation, not enforcement, and these
      // collections really are still returned by the unrouted path today. Hiding that behind a
      // reassuring word would be the same trade the verdict was invented to stop.
      verdict = 'deferred-to-graph'
      const retrieval = streams.length ? `⚠ a router stream (${streams.join(' + ')}) CAN currently select it`
        : ftsRows > 0 ? 'still returned by the unrouted/fail-open path, as keyword-only'
        : 'not in the FTS index'
      note = `DESTINED FOR THE POSITION GRAPH, not a retrieval stream: ${DEFERRED_TO_GRAPH[corpus]}. Retrieval status unchanged — ${retrieval}.`
    } else if (streams.length) verdict = 'reachable'
    else if (typeNull) {
      verdict = 'UNREACHABLE'
      note = ftsRows > 0
        ? 'indexed and searchable, but corpusToType returns null so the FTS adapter drops every hit before any caller sees it'
        : 'not in the FTS index'
    } else if (callers.length) {
      verdict = 'tier-only'
      note = 'no router stream selects it; reachable only via the explicit-tier legacy callers, which get neither routing nor dense retrieval'
    } else if (ftsRows > 0) {
      verdict = 'keyword-only'
      note = tier === 'other'
        ? `indexed under tier "other", which no stream selects — surfaces only on the unrouted/fail-open path`
        : 'in a tier a stream owns, but excluded by that stream\'s corpus filter — surfaces only on the unrouted/fail-open path'
    } else {
      verdict = 'UNREACHABLE'
      note = 'not in the FTS index'
    }

    rows.push({
      collection: corpus,
      label: targets.get(corpus)?.display_label ?? null,
      retired: !!targets.get(corpus)?.retired,
      sections: sec ? +sec.n : 0,
      compiled: sec ? +sec.compiled : 0,
      fts_rows: ftsRows,
      vec_rows: vecRows,
      index_tiers: Object.fromEntries(ftsTiers),
      tier, tier_split: split,
      types: types.map(String),
      type_null: typeNull,
      router_stream: streams.length ? streams.join(' + ') : 'NONE',
      tier_scoped_callers: callers,
      gold_questions: 0,
      gold_ids: [],
      verdict, note,
    })
  }

  // ── 5. the gold-key provenance pass ───────────────────────────────────────
  // Deliberately AFTER the matrix, so every satisfying hit can be labelled with its
  // collection's verdict. That is what turns "which collection answered" into the sharper
  // question: could a USER ever have received the document that satisfied this key?
  const byCollection = new Map(rows.map((r) => [r.collection, r]))
  const goldProvenance: GoldProvenance[] = []

  if (!NO_GOLD) {
    const queries = [
      ...GOLD.filter((g: any) => g.metric === 'recall@20' && g.scoreable)
        .map((g: any) => ({ id: g.id, query: g.query, expected: g.expected, stream: String(g.stream), draft: false })),
      ...DRAFT_QUERIES.map((d) => ({ id: d.id, query: d.query, expected: d.expected, stream: d.stream, draft: true })),
    ]
    console.log(`[reachability] gold pass: ${queries.length} scoreable questions (${queries.filter((q) => q.draft).length} draft), untiered top-${TOPN}`)

    const conn = await connectLance()
    const ftsTable = await conn.openTable(FTS_TABLE)
    const actIndex = await loadActIndex(pool)

    for (const q of queries) {
      // Untiered — the same retrieval the gold reports use, so the numbers are comparable.
      const top = (await rankedSearch(ftsTable, q.query, { limit: TOPN, actIndex })).slice(0, TOPN)
      const satisfying: Record<string, number> = {}
      const topCorpora: Record<string, number> = {}
      for (const h of top) topCorpora[h.corpus] = (topCorpora[h.corpus] ?? 0) + 1
      let keysHit = 0
      for (const src of q.expected) {
        const matched = top.filter((h) => {
          const hay = `${h.id}\n${h.sectionTitle ?? ''}\n${h.body}`
          return src.patterns.some((p: RegExp) => p.test(hay))
        })
        if (!matched.length) continue
        keysHit++
        for (const h of matched) satisfying[h.corpus] = (satisfying[h.corpus] ?? 0) + 1
      }

      // "Intended" is the stream the gold file declares. A collection counts as in-stream if a
      // router stream of that name could select it — the SAME arithmetic the matrix uses, so the
      // two halves of this report cannot disagree with each other.
      const intendedScopes = STREAM_SCOPES.filter((s) => q.stream.includes(s.name))
      const inStream = (corpus: string) => {
        const r = byCollection.get(corpus)
        if (!r) return false
        const types = typesFor(corpus, r.tier).filter((t): t is SearchResultType => t !== null)
        return intendedScopes.some((s) => types.some((t) => streamCanSelect(s, corpus, r.tier, t)))
      }
      let inStreamKeyHits = 0, inStreamTop = 0, undeliverableKeyHits = 0, unroutableKeyHits = 0
      const undeliverableFrom: string[] = []
      const unroutableFrom: string[] = []
      for (const [corpus, n] of Object.entries(satisfying)) {
        if (inStream(corpus)) inStreamKeyHits += n
        const v = byCollection.get(corpus)?.verdict
        // `excluded-by-design` counts as undeliverable too: the app really does not deliver it,
        // and a gold question leaning on it is measuring the index, not the product. The two are
        // kept distinct in the VERDICT column, where the difference is actionable; here the only
        // question is whether a user could ever have received the document, and the answer is no.
        if (v === 'UNREACHABLE' || v === 'excluded-by-design') { undeliverableKeyHits += n; undeliverableFrom.push(corpus) }
        if (v === 'keyword-only') { unroutableKeyHits += n; unroutableFrom.push(corpus) }
        const r = byCollection.get(corpus)
        if (r) { r.gold_questions += r.gold_ids.includes(q.id) ? 0 : 1; if (!r.gold_ids.includes(q.id)) r.gold_ids.push(q.id) }
      }
      for (const [corpus, n] of Object.entries(topCorpora)) if (inStream(corpus)) inStreamTop += n

      // Three distinct outcomes, kept apart because they call for different actions:
      //   no-router-stream — the question's declared stream has no router stream AT ALL
      //                      (archetype D is "citation graph"). Not a mislabelled answer key:
      //                      a capability we have not built. Flagging it as "off-stream" would
      //                      have buried that under a drafting problem.
      //   off-stream       — the stream exists and NOTHING from it satisfied the key.
      //   ok               — at least one satisfying document came from the declared stream.
      const outcome: GoldProvenance['outcome'] =
        keysHit === 0 ? 'no-key-hit'
        : !intendedScopes.length ? 'no-router-stream'
        : inStreamKeyHits === 0 ? 'off-stream'
        : 'ok'

      goldProvenance.push({
        id: q.id, query: q.query, intendedStream: q.stream, draft: q.draft,
        keysTotal: q.expected.length, keysHit,
        satisfyingCorpora: satisfying, topCorpora,
        inStreamKeyHits, inStreamTop, undeliverableKeyHits, unroutableKeyHits,
        undeliverableFrom: [...new Set(undeliverableFrom)],
        unroutableFrom: [...new Set(unroutableFrom)],
        outcome,
      })
      const flag = outcome === 'off-stream' ? '  ⚠ NOT TESTING ITS OWN STREAM'
        : outcome === 'no-router-stream' ? '  ⚠ NO ROUTER STREAM EXISTS FOR THIS'
        : undeliverableKeyHits ? `  ⚠ ${undeliverableKeyHits} satisfying hit(s) NO caller can receive`
        : unroutableKeyHits ? `  ⚠ ${unroutableKeyHits} satisfying hit(s) a ROUTED query cannot reach`
        : ''
      console.log(`  ${q.id.padEnd(4)} ${String(keysHit).padStart(2)}/${q.expected.length} keys · in-stream ${inStreamTop}/${TOPN} · from ${Object.keys(satisfying).join(', ') || '(nothing)'}${flag}`)
    }
  }

  await pool.end()
  writeOutputs(rows, goldProvenance)
}

// ── 6. output ────────────────────────────────────────────────────────────────
function fmt(n: number) { return n.toLocaleString('en-GB') }

function writeOutputs(rows: Row[], gold: GoldProvenance[]) {
  const stamp = new Date().toISOString().slice(0, 16).replace('T', ' ') + ' UTC'
  const by = (v: string) => rows.filter((r) => r.verdict === v)
  const totals = {
    collections: rows.length,
    sections: rows.reduce((n, r) => n + r.sections, 0),
    fts_rows: rows.reduce((n, r) => n + r.fts_rows, 0),
    vec_rows: rows.reduce((n, r) => n + r.vec_rows, 0),
  }
  const reachSections = by('reachable').reduce((n, r) => n + r.sections, 0)

  fs.writeFileSync(
    path.join(DOCS, 'corpus_reachability.json'),
    JSON.stringify({ generatedAt: stamp, totals, streams: STREAM_SCOPES.map((s) => s.name), rows, gold }, null, 2),
  )

  const md: string[] = []
  md.push('# Corpus reachability matrix')
  md.push('')
  md.push(`*Generated ${stamp} by \`scripts/ingest/search/corpus-reachability.ts\`. Machine-readable`)
  md.push('twin: `docs/corpus_reachability.json`. Regenerate rather than edit — every number here is')
  md.push('measured, and a hand-corrected row is a row that will be wrong after the next ingest.*')
  md.push('')
  md.push('**The one number.** ' +
    `${fmt(reachSections)} of ${fmt(totals.sections)} sections (${(reachSections / totals.sections * 100).toFixed(1)}%) ` +
    `sit in a collection some router stream can select. ` +
    `${by('UNREACHABLE').length} ${by('UNREACHABLE').length === 1 ? 'collection is' : 'collections are'} ` +
    `reachable by no path at all and nobody chose that; ` +
    `${by('excluded-by-design').length} ${by('excluded-by-design').length === 1 ? 'is' : 'are'} unreachable ON PURPOSE, ` +
    `named in \`EXCLUDED_BY_DESIGN\` with a reason; ` +
    `${by('keyword-only').length} surface only when routing is off or has failed open; ` +
    `${by('tier-only').length} only via an explicit-tier caller.`)
  md.push('')
  const broken = by('excluded-by-design').filter((r) => r.router_stream !== 'NONE')
  if (broken.length) {
    md.push(`⚠ **${broken.length} deliberate exclusion(s) are no longer exclusions** — a stream can now select ` +
      broken.map((r) => `\`${r.collection}\` (${r.router_stream})`).join(', ') +
      '. Either the decision changed and this table has not been told, or a stream was widened without noticing it.')
    md.push('')
  }
  md.push('`tier` is read OUT OF THE LIVE FTS INDEX, not computed from `corpus-map.ts` — the tier is')
  md.push('baked in at build time, so a collection seeded after the map last changed carries the old')
  md.push('tier in the index and the router filters on the index. `router_stream` is computed by')
  md.push('`streamCanSelect` from the same `STREAM_SCOPES` the router dispatches on.')
  md.push('')

  // ── the table ──
  md.push('| collection | sections | fts_rows | vec_rows | type | tier | router_stream | tier-scoped callers | gold Qs | verdict |')
  md.push('|---|---:|---:|---:|---|---|---|---|---:|---|')
  for (const r of rows) {
    const type = r.type_null ? '**null (dropped)**' : r.types.join(', ')
    const tier = r.tier_split ? `${r.tier} ⚠split` : r.tier
    const callers = r.tier_scoped_callers.length ? `${r.tier_scoped_callers.length} legacy` : '—'
    const verdict = r.verdict === 'UNREACHABLE' ? '**UNREACHABLE**'
      : r.verdict === 'excluded-by-design' ? '*excluded-by-design*' : r.verdict
    md.push(`| \`${r.collection}\` | ${fmt(r.sections)} | ${fmt(r.fts_rows)} | ${fmt(r.vec_rows)} | ${type} | ${tier} | ${r.router_stream === 'NONE' ? '**NONE**' : r.router_stream} | ${callers} | ${r.gold_questions || '—'} | ${verdict} |`)
  }
  md.push('')

  // ── verdict roll-up ──
  md.push('## By verdict')
  md.push('')
  md.push('| verdict | collections | sections | fts_rows |')
  md.push('|---|---:|---:|---:|')
  for (const v of VERDICTS) {
    const g = by(v)
    md.push(`| ${v} | ${g.length} | ${fmt(g.reduce((n, r) => n + r.sections, 0))} | ${fmt(g.reduce((n, r) => n + r.fts_rows, 0))} |`)
  }
  md.push('')
  if (by('excluded-by-design').length) {
    md.push('**The deliberate exclusions, with their reasons** — so that "nobody can reach this" and')
    md.push('"nobody is meant to reach this" never again print the same word:')
    md.push('')
    for (const r of by('excluded-by-design')) {
      md.push(`- \`${r.collection}\` (${fmt(r.sections)} sections) — ${EXCLUDED_BY_DESIGN[r.collection]}`)
    }
    md.push('')
  }
  if (by('deferred-to-graph').length) {
    md.push('**Routed to the position graph, not to retrieval** — the third case: not a defect, and')
    md.push('not a decision that it should never be seen, but a decision that retrieval is the wrong')
    md.push('door. ⚠ Documentation only: nothing enforces this, and the unrouted path still returns')
    md.push('these today. See the `note` column for each one\'s actual retrieval status.')
    md.push('')
    for (const r of by('deferred-to-graph')) {
      md.push(`- \`${r.collection}\` (${fmt(r.sections)} sections) — ${DEFERRED_TO_GRAPH[r.collection]}`)
    }
    md.push('')
  }

  // ── §3 of BRIEF_SEARCH_S2C3: deferred, by name, with a date on it ──────────
  // The point of listing these is that "deferred" should be a decision somebody took on a day,
  // not an omission nobody owns. Computed from the live table rather than typed out, so the
  // sections figures cannot drift from the matrix they sit in.
  const DEFERRED_PENDING_RERANKER = [
    'cma-cases', 'ofgem', 'ofcom', 'uk-treaties', 'independent-reviews',
    'tax-treaties-dta', 'cps-guidance', 'inquiry-evidence', 'lgsco',
  ]
  const pending = rows.filter((r) => DEFERRED_PENDING_RERANKER.includes(r.collection))
  if (pending.length) {
    md.push('## Deferred pending the reranker decision (recorded 2026-08-10, BRIEF_SEARCH_S2C3 §3)')
    md.push('')
    md.push('*No action taken on these. Listed so that "deferred" carries a date and an owner rather')
    md.push('than being an omission nobody owns. Revisit after the reranker decision.*')
    md.push('')
    md.push('| collection | sections | verdict | type |')
    md.push('|---|---:|---|---|')
    for (const r of pending.sort((a, b) => b.sections - a.sections)) {
      md.push(`| \`${r.collection}\` | ${fmt(r.sections)} | ${r.verdict} | ${r.types.join(', ') || '**null**'} |`)
    }
    md.push(`| **total** | **${fmt(pending.reduce((n, r) => n + r.sections, 0))}** | | |`)
    md.push('')
  }

  // ── the named suspects ──
  md.push('## The named suspects, individually')
  md.push('')
  md.push('*The brief asked for the status of each of these one at a time rather than as a total,')
  md.push('because a total hides which of them is the expensive one.*')
  md.push('')
  const SUSPECTS: Array<{ name: string; keys: string[]; absent?: string }> = [
    { name: 'treaties', keys: ['uk-treaties', 'tax-treaties-dta', 'uk-treaties-fcdo', 'parliament-treaties'] },
    { name: "members' interests", keys: ['members-interests'] },
    { name: 'written answers', keys: ['written-answers', 'pwdata-wrans', 'pwdata-lordswrans', 'lda-commonswrittenquestions', 'lda-lordswrittenquestions'] },
    { name: 'ministerial statements', keys: ['written-statements', 'pwdata-wms', 'pwdata-lordswms'] },
    { name: 'impact assessments', keys: ['impact-assessments'], absent: 'no collection, and no `corpus_targets` row — never scoped, not merely unseeded' },
    { name: 'explanatory notes', keys: ['explanatory-notes', 'explanatory-memoranda'] },
    { name: 'NAO and evaluation reports', keys: ['nao-reports', 'ots-reports', 'independent-reviews', 'inquiry-reports', 'inquiry-evidence'] },
    { name: 'consultations', keys: ['consultations', 'govuk-consultations'], absent: 'no collection, and no `corpus_targets` row — never scoped' },
    { name: 'quango rulebooks', keys: ['quangos-govuk'] },
    { name: 'statutory codes', keys: ['college-of-policing', 'sentencing-council', 'building-regs', 'planning-policy'] },
    { name: 'sector rulebooks (FCA Handbook)', keys: ['fca-handbook'] },
    { name: 'HMRC manuals', keys: ['hmrc'] },
    {
      name: 'statistics catalogue', keys: ['statistics-catalogue', 'ons-statistics', 'stats-catalogue'],
      absent: 'NOT IN THE SEARCHABLE CORPUS AT ALL — it lives in a separate database ' +
        '(`STATS_DATABASE_URL`: `stat_dataset` / `stat_series` / `stat_observation`), reached by ' +
        'the stats layer, never by `corpus_sections`. So no stream change could make it ' +
        'retrievable; that would be an ingest or a federation decision, not a routing one.',
    },
  ]
  md.push('| suspect | collection(s) found | sections | router_stream | verdict |')
  md.push('|---|---|---:|---|---|')
  for (const s of SUSPECTS) {
    const matches = rows.filter((r) => s.keys.some((k) => r.collection === k || r.collection.startsWith(`${k}-`)))
    if (!matches.length) {
      md.push(`| ${s.name} | — | — | — | **absent** — ${s.absent ?? 'no collection with any of these keys'} |`)
      continue
    }
    for (const m of matches) {
      md.push(`| ${s.name} | \`${m.collection}\` | ${fmt(m.sections)} | ${m.router_stream === 'NONE' ? '**NONE**' : m.router_stream} | ${m.verdict === 'UNREACHABLE' ? '**UNREACHABLE**' : m.verdict} |`)
    }
  }
  md.push('')

  // ── gold provenance ──
  if (gold.length) {
    const off = gold.filter((g) => g.outcome === 'off-stream')
    const noStream = gold.filter((g) => g.outcome === 'no-router-stream')
    const undeliverable = gold.filter((g) => g.undeliverableKeyHits > 0)
    const unroutable = gold.filter((g) => g.unroutableKeyHits > 0)
    md.push('## Gold-key provenance — is each question testing what it claims to test?')
    md.push('')
    md.push(`*Untiered top-${TOPN} BM25 (\`rankedSearch\`), the same retrieval the gold reports use, so`)
    md.push('these numbers are comparable with them. "intended" is the stream the gold file declares')
    md.push('for the question; "satisfied from" is the collection the documents that actually matched')
    md.push('the answer key came from; "in-stream" counts how much of the whole top-20 came from a')
    md.push('collection the declared stream can select. One pass — a single sample, not a repeat.*')
    md.push('')
    md.push(`- **${off.length} of ${gold.length}** questions are satisfied ENTIRELY from outside their declared stream. Those are not testing what they claim to test.`)
    md.push(`- **${noStream.length}** declare a stream that DOES NOT EXIST in the router at all — a missing capability, not a drafting error, and it would have been hidden inside the previous line.`)
    md.push(`- **${undeliverable.length}** are satisfied in part by an UNREACHABLE collection — the scoring harness reads Lance directly, the app's FTS adapter drops those rows for having no display type. To that extent the recall number measures the index rather than the product.`)
    md.push(`- **${unroutable.length}** are satisfied in part by a keyword-only collection: delivered when the router is off or has failed open, never by a routed query. Turning routing ON therefore *costs* recall on those questions — which is worth knowing before the router's gold-set gain is read as unambiguous.`)
    md.push('')
    md.push('| id | intended stream | keys hit | in-stream | satisfied from | outcome |')
    md.push('|---|---|---:|---:|---|---|')
    for (const g of gold) {
      const from = Object.entries(g.satisfyingCorpora)
        .sort((a, b) => b[1] - a[1])
        .map(([c, n]) => `\`${c}\`×${n}${g.undeliverableFrom.includes(c) ? ' ✗' : g.unroutableFrom.includes(c) ? ' ⚠' : ''}`).join(', ') || '—'
      const outcome = g.outcome === 'no-key-hit' ? 'no key hit'
        : g.outcome === 'off-stream' ? '**NOT TESTING ITS STREAM**'
        : g.outcome === 'no-router-stream' ? '**NO ROUTER STREAM EXISTS**'
        : g.undeliverableKeyHits ? 'ok (✗ partly undeliverable)'
        : g.unroutableKeyHits ? 'ok (⚠ partly unroutable)' : 'ok'
      md.push(`| ${g.id}${g.draft ? ' *(draft)*' : ''} | ${g.intendedStream} | ${g.keysHit}/${g.keysTotal} | ${g.inStreamTop}/${TOPN} | ${from} | ${outcome} |`)
    }
    md.push('')
    md.push('✗ marks a satisfying collection with verdict UNREACHABLE — no caller ever receives it.')
    md.push('⚠ marks one with verdict keyword-only — only the unrouted/fail-open path delivers it.')
    md.push('')

    // The committees case the brief asked about, stated as its own measurement.
    const cm = gold.filter((g) => g.id.startsWith('CM'))
    if (cm.length) {
      md.push('### The four committee questions, re-measured')
      md.push('')
      md.push('*GOLD_TEST_09 (6 Aug) recorded CM1 scoring 100% while returning **0/20 committee**')
      md.push('**documents** — Hansard satisfied the key by accident. `committees-reports` held 24,876')
      md.push('rows then. It holds ' + fmt(rows.find((r) => r.collection === 'committees-reports')?.fts_rows ?? 0) +
        ' now, after the V32/V33 committee ingest. So the same')
      md.push('measurement, repeated:*')
      md.push('')
      md.push('| id | committee docs in top-20 | keys hit | satisfied from a committee collection |')
      md.push('|---|---:|---:|---|')
      for (const g of cm) {
        const committeeTop = Object.entries(g.topCorpora).filter(([c]) => c.startsWith('committees')).reduce((n, [, v]) => n + v, 0)
        const committeeKey = Object.entries(g.satisfyingCorpora).filter(([c]) => c.startsWith('committees')).reduce((n, [, v]) => n + v, 0)
        md.push(`| ${g.id} | ${committeeTop}/${TOPN} | ${g.keysHit}/${g.keysTotal} | ${committeeKey ? `yes (${committeeKey} hit(s))` : '**no**'} |`)
      }
      md.push('')
      md.push('⚠ **One pass, one sample.** BM25 over a fixed index is deterministic, so this is not an')
      md.push('intermittent measurement — but it is still a single retrieval configuration (untiered,')
      md.push('BM25 only, no router rewrite). It says the 0/20 result no longer reproduces on this')
      md.push('path. It does not say the committees stream is now good, and it does not revisit')
      md.push("GOLD_TEST_09's separate finding that committee CONCLUSIONS are largely not ingested.")
      md.push('')
    }
  } else {
    md.push('## Gold-key provenance')
    md.push('')
    md.push('*Not run (`--no-gold`).*')
    md.push('')
  }

  // ── tier-scoped bypass ──
  md.push('## Tier-scoped bypass')
  md.push('')
  md.push('*`gateway-legacy.ts` passes an explicit tier, so these callers get neither routing nor')
  md.push('dense retrieval. Collections reachable ONLY this way are invisible to every measurement')
  md.push('taken through the routed path.*')
  md.push('')
  for (const c of TIER_SCOPED_CALLERS) {
    md.push(`**tier \`${c.tier}\`** — ${c.callers.map((x) => `\`${x}\``).join(', ')}`)
    const only = rows.filter((r) => r.verdict === 'tier-only')
    const also = rows.filter((r) => r.tier_scoped_callers.length && r.verdict === 'reachable')
    md.push('')
    md.push(`- reachable by these callers AND by the router: ${also.length} collections (${fmt(also.reduce((n, r) => n + r.sections, 0))} sections)`)
    md.push(`- reachable ONLY by these callers: ${only.length} collections${only.length ? ` — ${only.map((r) => `\`${r.collection}\``).join(', ')}` : ''}`)
    md.push('')
  }
  md.push('⚠ **`tier-only` is structurally empty today, and that is a fact about the config rather')
  md.push('than a clean bill of health.** The only tier any caller scopes to is `legislation`, and the')
  md.push('`legislation` router stream selects that whole tier — so every collection the legacy')
  md.push('callers can reach, the router can reach too. The bypass costs those three surfaces routing')
  md.push('and dense retrieval; it does not currently expose anything the routed path cannot see. Add')
  md.push('a second tier-scoped caller on any other tier and this column starts carrying rows.')
  md.push('')

  fs.writeFileSync(path.join(DOCS, 'CORPUS_REACHABILITY.md'), md.join('\n'))
  console.log(`\n[reachability] wrote docs/CORPUS_REACHABILITY.md and docs/corpus_reachability.json`)
  console.log(`[reachability] ${rows.length} collections · ` + VERDICTS.map((v) => `${v} ${by(v).length}`).join(' · '))
}

main().catch((e) => { console.error(e); process.exit(1) })
