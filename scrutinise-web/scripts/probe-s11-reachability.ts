/**
 * probe-s11-reachability.ts — SEARCH S11 §1. CONFIRM THE UNREACHABLE COLLECTIONS ONE BY ONE.
 *
 * ════════════════════════════════════════════════════════════════════════════════════════════════
 * WHY THIS EXISTS AND WHY IT IS NOT `corpus-reachability.ts`.
 *
 * `scripts/ingest/search/corpus-reachability.ts` computes reachability by SET ARITHMETIC: it reads
 * the indexed tier out of Lance, asks `streamCanSelect` whether any scope admits it, and prints a
 * verdict. That is the right instrument for a sweep of 74 collections and it is the one the matrix
 * is built from. It is also, on its own, an argument rather than an observation — the same shape of
 * claim that had `cps-guidance` recorded as `keyword-only` for ten days without anyone noticing
 * that in production, with routing on, `keyword-only` means *nobody can ever see this*.
 *
 * S10 found the CPS defect by asking the live service instead. This does that for every collection
 * the matrix says no stream can select — **one probe each**, as BRIEF_SEARCH_S11 §1 requires,
 * because eight of the nine were inferred from the ninth's pattern and an inference is not a
 * measurement (docs/CLAUDE.md §19).
 *
 * ── WHAT EACH PROBE ASKS, IN ORDER ──────────────────────────────────────────────────────────────
 *
 *   A. CORPUS-SCOPED, USING THE DOCUMENT'S OWN TITLE.  The most generous query a document will
 *      ever receive: its own name, with the search restricted to its own collection. If the row
 *      does not come back here it is not indexed, and every later result would be explained by
 *      that rather than by routing. This separates "not in the index" from "not reachable".
 *
 *   B. THE PRODUCTION SHAPE, ONE STREAM AT A TIME.  The same query re-issued once per router
 *      stream with EXACTLY the scope that stream sends — tier, `corpora`, `excludeCorpora` — then
 *      the client-side display-type filter applied on top, which is the fourth and last gate
 *      (`streamCanSelect` documents the ordering; `query-router.ts` applies it). A collection no
 *      stream returns here cannot be returned by any routed query, whatever the wording.
 *
 * ⚠ THE STANDARD IS "ITS OWN TITLE, INSIDE ITS OWN COLLECTION, AND STILL NOTHING". A probe that
 * used a topical query would confound unreachability with ranking, which is the confusion this
 * whole sprint exists to end.
 *
 * ── THE CONTROL, WHICH IS THE POINT ─────────────────────────────────────────────────────────────
 *
 * ⚠⚠ A PROBE THAT REPORTS "UNREACHABLE" FOR EVERYTHING IS INDISTINGUISHABLE FROM A BROKEN PROBE.
 * That is this project's most expensive recurring bug (docs/CLAUDE.md §18/§19, and the guard-that-
 * cannot-fail family). So every run also probes CONTROLS: collections the matrix says ARE
 * reachable, chosen to share the display type and differ only in tier — `college-of-policing` is
 * GUIDANCE in tier `guidance` where `cps-guidance` is GUIDANCE in tier `other`. If a control comes
 * back unreachable the run FAILS and reports nothing else, because the instrument is wrong.
 *
 * Exit 0 only when every control was reachable. The unreachable findings are the output; the
 * controls are what make them mean anything.
 *
 * Usage:
 *   npx tsx --env-file=.env scripts/probe-s11-reachability.ts
 *   FTS_SEARCH_URL=… npx tsx scripts/probe-s11-reachability.ts --json out.json
 */
import { Pool } from 'pg'
import { corpusToType } from '../lib/lex/corpus-type-map'
import { STREAM_SCOPES, STREAM_SCOPES_V2, streamCanSelect, type StreamScope } from '../lib/lex/stream-scopes'
import type { SearchResultType } from '../lib/lex/page1-config'

export {}

/** The live index is what retrieval reads. Probing Postgres would answer a different question. */
const FTS = process.env.FTS_SEARCH_URL ?? 'https://fts-serve-production-4cea.up.railway.app'
const JSON_OUT = (() => {
  const i = process.argv.indexOf('--json')
  return i >= 0 ? process.argv[i + 1] : null
})()
/** How many documents to try before giving up on finding one that ranks 0–2 in its own corpus. */
const CANDIDATES = 8

/**
 * The nine the matrix says no stream can select, plus the reason each is expected to fail — stated
 * BEFORE the run so the probe can contradict it. Two distinct mechanisms, and keeping them apart
 * matters because they need different fixes:
 *
 *   `tier-other`   — `tierFor()` has no entry, so the collection was indexed under `other`, which
 *                    no `StreamScope` names. Fixed by a tier-map entry plus a rebuild.
 *   `type-excluded`— indexed under a tier a stream owns, and then excluded by that stream's own
 *                    corpus/type filter. A tier entry would NOT fix these; the stream has to admit
 *                    the display type, or the collection has to move tier.
 */
const SUSPECTS: Array<{ corpus: string; mechanism: 'tier-other' | 'type-excluded'; note: string }> = [
  { corpus: 'cma-cases', mechanism: 'tier-other', note: 'competition decisions; 22,898 sections, the largest of the nine' },
  { corpus: 'ofgem', mechanism: 'tier-other', note: 'energy regulator decisions and licence conditions' },
  { corpus: 'ofcom', mechanism: 'tier-other', note: 'communications regulator; carries a gold question (GD4)' },
  { corpus: 'independent-reviews', mechanism: 'tier-other', note: 'statutory and independent reviews' },
  { corpus: 'cps-guidance', mechanism: 'tier-other', note: 'S10 §1 — the one already confirmed; re-probed as the method control' },
  { corpus: 'inquiry-evidence', mechanism: 'tier-other', note: 'public inquiry evidence' },
  { corpus: 'lgsco', mechanism: 'tier-other', note: 'Local Government and Social Care Ombudsman' },
  { corpus: 'uk-treaties', mechanism: 'type-excluded', note: 'tier parliamentary, typed TREATY, named in NON_DEBATE_PARLIAMENTARY' },
  { corpus: 'tax-treaties-dta', mechanism: 'type-excluded', note: 'double-taxation agreements; same shape as uk-treaties' },
]

/**
 * Controls. Each shares its display TYPE with a suspect and differs in the thing under test, so a
 * control failure means the probe is broken rather than the corpus being unreachable.
 *   college-of-policing — GUIDANCE, tier `guidance`     (vs cps-guidance: GUIDANCE, tier `other`)
 *   uk-treaties-fcdo    — DEBATE,   tier parliamentary  (vs uk-treaties: TREATY, same tier)
 *   erskine-may         — GUIDANCE, tier `other`, reachable ONLY via `extraCorpora` — the control
 *                         that proves the probe honours the extra-leg path rather than assuming
 *                         tier `other` is always fatal.
 */
const CONTROLS = ['college-of-policing', 'uk-treaties-fcdo', 'erskine-may']

interface Hit {
  id: string; corpus: string; tier: string; sectionTitle: string | null; score: number
}

async function fts(query: string, scope: { tier?: string; corpora?: string[]; excludeCorpora?: string[]; limit?: number }): Promise<Hit[]> {
  const res = await fetch(`${FTS.replace(/\/$/, '')}/fts-search`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      query,
      limit: scope.limit ?? 60,
      ...(scope.tier ? { tier: scope.tier } : {}),
      ...(scope.corpora?.length ? { corpora: scope.corpora } : {}),
      ...(scope.excludeCorpora?.length ? { excludeCorpora: scope.excludeCorpora } : {}),
    }),
  })
  if (!res.ok) throw new Error(`fts ${res.status}: ${(await res.text()).slice(0, 200)}`)
  return ((await res.json()) as { results?: Hit[] }).results ?? []
}

/**
 * Query terms from a document's own title. Entity-decoded first: several of these collections
 * store `&#039;` and `&amp;` literally (the ENTITY_DECODE work did not reach all 74), and feeding
 * `&#039;Honour&#039;-Based` to BM25 searches for tokens the body does not contain.
 */
function titleQuery(title: string): string {
  const decoded = title
    .replace(/&#0?39;|&apos;/g, "'").replace(/&quot;/g, '"')
    .replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>')
  const stop = new Set(['the', 'and', 'for', 'of', 'in', 'on', 'to', 'a', 'an', 'with', 'from', 'by'])
  return decoded
    .replace(/[^\p{L}\p{N}\s]/gu, ' ')
    .split(/\s+/)
    .filter((w) => w.length > 2 && !stop.has(w.toLowerCase()))
    .slice(0, 8)
    .join(' ')
}

/** Every stream the router can address today, base five first. V2's three are included because a
 *  mapping decision has to know whether the flag would already have solved it. */
const ALL_SCOPES: Array<{ scope: StreamScope; v2: boolean }> = [
  ...STREAM_SCOPES.map((s) => ({ scope: s, v2: false })),
  ...STREAM_SCOPES_V2.map((s) => ({ scope: s, v2: true })),
]

interface Result {
  corpus: string
  role: 'suspect' | 'control'
  mechanism?: string
  probeDoc: string
  probeTitle: string
  query: string
  /** A: found corpus-scoped, and at what rank (0-based). -1 = not found at all. */
  scopedRank: number
  indexedTier: string | null
  displayType: string | null
  /** B: streams whose real scope returned this document. */
  reachedBy: string[]
  /** The set-arithmetic answer, for comparison with the observation. */
  canSelect: string[]
  verdict: 'reachable' | 'UNREACHABLE-BY-ROUTING' | 'NOT-INDEXED'
}

async function probe(pool: Pool, corpus: string, role: 'suspect' | 'control', mechanism?: string): Promise<Result | null> {
  // ⚠ THE FIRST VERSION OF THIS TOOK THE LONGEST TITLE IN THE COLLECTION AND IT WAS WRONG — the
  // `uk-treaties-fcdo` CONTROL CAUGHT IT, which is the entire reason the controls exist.
  //
  // "Longest" is not "most distinctive". The longest FCDO title is *"Exchange of Notes between the
  // Government of the United Kingdom and the Turkish Government regarding Commercial Relations"*,
  // and so is most of the other 23,371: corpus-scoped, its own title returned rank −1, because
  // every sibling matches the same nine common terms and the one discriminating word (`Turkish`)
  // is outranked by the crowd. The probe reported a REACHABLE collection as unreachable.
  //
  // So the document is now CHOSEN BY THE MEASUREMENT rather than by a proxy for it: several
  // candidates are tried and the first that comes back at RANK 0–2 SCOPED TO ITS OWN CORPUS is
  // used. That is S10's own standard ("all five CPS keys return at rank 0–2 scoped to their own
  // corpus"), and it makes probe B's silence mean something — the document is demonstrably
  // retrievable by this query, so a stream that does not return it is not merely out-ranking it.
  const { rows: candidates } = await pool.query<{ id: string; sectionTitle: string }>(
    `SELECT id, "sectionTitle" FROM corpus_sections
      WHERE corpus = $1 AND "sectionTitle" IS NOT NULL AND length("sectionTitle") BETWEEN 25 AND 160
        AND "wordCount" > 40
      ORDER BY md5(id)
      LIMIT $2`, [corpus, CANDIDATES])
  if (!candidates.length) {
    console.log(`  ${corpus.padEnd(24)} SKIPPED — no titled row to probe with`)
    return null
  }

  let doc = candidates[0]
  let query = titleQuery(doc.sectionTitle)
  let scoped: Hit[] = []
  let scopedRank = -1
  let tried = 0
  for (const c of candidates) {
    tried++
    const q = titleQuery(c.sectionTitle)
    if (!q) continue
    const hits = await fts(q, { corpora: [corpus], limit: 20 })
    const rank = hits.findIndex((h) => h.id === c.id)
    // Keep the best attempt even if none qualifies, so a failure reports a real rank rather
    // than an artefact of which candidate happened to be first.
    if (rank >= 0 && (scopedRank < 0 || rank < scopedRank)) { doc = c; query = q; scoped = hits; scopedRank = rank }
    if (rank >= 0 && rank <= 2) break
  }
  if (scopedRank < 0) { doc = candidates[0]; query = titleQuery(doc.sectionTitle); scoped = await fts(query, { corpora: [corpus], limit: 20 }) }
  if (scopedRank > 2) {
    console.log(`      ⚠ best corpus-scoped rank across ${tried} candidates was ${scopedRank}, not 0–2 — probe B's silence would be ambiguous`)
  }
  const self = scoped[scopedRank] ?? scoped[0] ?? null
  const indexedTier = self?.tier ?? null
  const displayType = indexedTier ? corpusToType(corpus, indexedTier, doc.id) : null

  // ── PROBE B: the production shape, one stream at a time ────────────────────────────────────
  const reachedBy: string[] = []
  for (const { scope, v2 } of ALL_SCOPES) {
    // The extra leg is a SECOND, corpus-only call that skips the tier filter — reproduced here
    // rather than approximated, because it is exactly what makes erskine-may reachable.
    const legs: Array<{ tier?: string; corpora?: string[]; excludeCorpora?: string[] }> = [
      { tier: scope.tier, corpora: scope.corpora, excludeCorpora: scope.excludeCorpora },
    ]
    if (scope.extraCorpora?.length) legs.push({ corpora: scope.extraCorpora })

    let found = false
    for (const leg of legs) {
      const hits = await fts(query, { ...leg, limit: 60 })
      // The client-side display-type filter is the last gate and it is applied in the app, not in
      // the service, so it has to be applied here too or the probe would over-report reachability.
      const admitted = hits.filter((h) => {
        if (h.id !== doc.id) return false
        const t = corpusToType(h.corpus, h.tier, h.id)
        if (t === null) return false
        return !scope.types || scope.types.includes(t)
      })
      if (admitted.length) { found = true; break }
    }
    if (found) reachedBy.push(v2 ? `${scope.name} (V2)` : scope.name)
  }

  // The set-arithmetic answer, computed from the SAME live scopes, so the observation and the
  // matrix can be compared rather than assumed to agree.
  const canSelect = ALL_SCOPES
    .filter(({ scope }) => displayType !== null && indexedTier !== null &&
      streamCanSelect(scope, corpus, indexedTier, displayType as SearchResultType))
    .map(({ scope, v2 }) => (v2 ? `${scope.name} (V2)` : scope.name))

  const verdict: Result['verdict'] =
    scopedRank < 0 ? 'NOT-INDEXED' : reachedBy.length ? 'reachable' : 'UNREACHABLE-BY-ROUTING'

  const mark = role === 'control'
    ? (verdict === 'reachable' ? '✅ control OK' : '❌❌ CONTROL FAILED — the probe is wrong, not the corpus')
    : (verdict === 'reachable' ? '⚠ reachable after all — the matrix disagrees' : 'confirmed unreachable')

  console.log(
    `  ${corpus.padEnd(24)} rank ${String(scopedRank).padStart(2)}  tier=${(indexedTier ?? '?').padEnd(14)}` +
    ` type=${(displayType ?? 'null').padEnd(18)} streams=[${reachedBy.join(', ') || 'NONE'}]  ${mark}`)
  if (verdict !== 'NOT-INDEXED' && role === 'suspect') {
    console.log(`      probe: "${query}"  →  ${doc.id}`)
  }
  // A disagreement between what the arithmetic says and what the service does is itself a finding:
  // it means the matrix and the product have drifted, which is the failure mode §1 exists to catch.
  const arith = [...canSelect].sort().join(',')
  const obs = [...reachedBy].sort().join(',')
  if (arith !== obs) {
    console.log(`      ⚠ ARITHMETIC SAYS [${canSelect.join(', ') || 'NONE'}] BUT THE SERVICE SAYS [${reachedBy.join(', ') || 'NONE'}]`)
  }

  return {
    corpus, role, mechanism, probeDoc: doc.id, probeTitle: doc.sectionTitle, query,
    scopedRank, indexedTier, displayType: displayType ?? null, reachedBy, canSelect, verdict,
  }
}

async function main() {
  const pool = new Pool({
    connectionString: process.env.NEON_DATABASE_URL ?? process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }, max: 2, statement_timeout: 120_000,
  })

  console.log('═'.repeat(112))
  console.log('SEARCH S11 §1 — ONE PROBE PER COLLECTION, AGAINST THE LIVE INDEX')
  console.log('═'.repeat(112))
  console.log(`  service: ${FTS}`)
  console.log('  Each document is searched by its OWN TITLE, first inside its own collection, then')
  console.log('  once per router stream with exactly the scope that stream sends.\n')

  console.log('── CONTROLS (these MUST come back reachable, or the probe is broken) ──')
  const controls: Result[] = []
  for (const c of CONTROLS) {
    const r = await probe(pool, c, 'control')
    if (r) controls.push(r)
  }

  const failedControls = controls.filter((c) => c.verdict !== 'reachable')
  if (failedControls.length) {
    console.log(`\n❌❌ ${failedControls.length} CONTROL(S) FAILED: ${failedControls.map((c) => c.corpus).join(', ')}`)
    console.log('   Refusing to report the suspects. A probe that cannot find a document it is')
    console.log('   supposed to find would report every collection as unreachable, which is exactly')
    console.log('   the false result this run exists to avoid.')
    await pool.end()
    process.exit(1)
  }
  console.log(`\n  ${controls.length}/${controls.length} controls reachable — the probe can succeed, so a failure below means something.\n`)

  console.log('── SUSPECTS ──')
  const results: Result[] = []
  for (const s of SUSPECTS) {
    const r = await probe(pool, s.corpus, 'suspect', s.mechanism)
    if (r) results.push(r)
  }

  const unreachable = results.filter((r) => r.verdict === 'UNREACHABLE-BY-ROUTING')
  const surprises = results.filter((r) => r.verdict === 'reachable')
  const missing = results.filter((r) => r.verdict === 'NOT-INDEXED')

  console.log('\n' + '═'.repeat(112))
  console.log(`CONFIRMED UNREACHABLE BY ANY ROUTED QUERY: ${unreachable.length} of ${results.length}`)
  console.log(`  by mechanism: tier-other ${unreachable.filter((r) => r.mechanism === 'tier-other').length}` +
    ` · type-excluded ${unreachable.filter((r) => r.mechanism === 'type-excluded').length}`)
  if (surprises.length) console.log(`⚠ REACHABLE AFTER ALL (the matrix is wrong about these): ${surprises.map((r) => r.corpus).join(', ')}`)
  if (missing.length) console.log(`⚠ NOT IN THE INDEX AT ALL (a different defect): ${missing.map((r) => r.corpus).join(', ')}`)
  console.log('═'.repeat(112))

  if (JSON_OUT) {
    const fs = await import('fs')
    fs.writeFileSync(JSON_OUT, JSON.stringify({ service: FTS, generatedAt: new Date().toISOString(), controls, results }, null, 2))
    console.log(`\nwrote ${JSON_OUT}`)
  }

  await pool.end()
  process.exit(0)
}

main().catch((e) => { console.error(e); process.exit(1) })
