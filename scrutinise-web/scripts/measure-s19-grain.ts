/**
 * measure-s19-grain.ts — BRIEF_SEARCH_S19 §2. WHAT IS THE RIGHT UNIT, PER COLLECTION?
 *
 * ════════════════════════════════════════════════════════════════════════════════════════════════
 * "No code in this section. A table is the deliverable." — the brief. This file produces that
 * table and does not change retrieval anywhere.
 * ════════════════════════════════════════════════════════════════════════════════════════════════
 *
 * THE QUESTION. Three sprints found the same defect from three directions and each named a
 * different unit (S16: the document is scored when the answer is a paragraph; ARGUMENT 1A: half of
 * what dense retrieval returns is a fragment; S18: at document level the right impact assessment
 * comes back 8 times in 9 and at section level the key comes back twice). Read together the
 * finding is that the unit is wrong IN OPPOSITE DIRECTIONS in different collections. Nobody has
 * measured it per collection. This does.
 *
 * ════════════════════════════════════════════════════════════════════════════════════════════════
 * THE THREE GRAINS, AND THE ONE THAT CANNOT BE MEASURED AS ASKED
 * ════════════════════════════════════════════════════════════════════════════════════════════════
 *
 *   SECTION   — what is scored today. `corpus_fts` holds one row per section and BM25 scores the
 *               whole section as one bag of words.
 *   CHUNK     — ⚠ NO SERVED SURFACE RETURNS A RANKED CHUNK LIST (lib/lex/grain.ts,
 *               CHUNK_GRAIN_NOTE). `vector-serve` searches `corpus_vec` at chunk grain and
 *               collapses to one hit per section before replying; the pre-collapse ranking is
 *               discarded inside the service. So the chunk grain is measured as THE DENSE ARM —
 *               a scorer that reads ~3,200-character windows and takes each section's best —
 *               against the sparse arm, which reads the section whole. Two scorers, two grains,
 *               same questions, same scope, no deploy. This is stated in every printout rather
 *               than left for a reader to discover.
 *   DOCUMENT  — computed, because a document is not a unit anything stores. TWO different
 *               operations, reported separately because they answer different questions:
 *                 · COLLAPSE  — dedupe the section ranking to first-occurrence-per-document.
 *                               This is what a DISPLAY change would buy, and it is S18 §B's
 *                               measurement.
 *                 · AGGREGATE — score the document from its sections (max / sum-top3) and rank
 *                               documents. This is what a RETRIEVAL change would buy, and it can
 *                               promote a document that no collapse ever reaches.
 *
 * ════════════════════════════════════════════════════════════════════════════════════════════════
 * FIVE THINGS THAT WOULD MAKE THIS TABLE WRONG
 * ════════════════════════════════════════════════════════════════════════════════════════════════
 *
 * 1. ⚠⚠ THE DOCUMENT KEY. `parentDocId` names the INSTRUMENT for impact assessments and is NULL
 *    for five collections; the id's second segment is the literal word `publication` for every
 *    committee row. Either rule alone produces a number about the wrong unit. The rule is
 *    `lib/lex/grain.ts::documentKeyOf`, IMPORTED — CLAUDE.md §25.3: a check that re-implements the
 *    rule asserts that two pieces of code agree, which they do until one is fixed.
 *
 * 2. ⚠⚠ THE BUILT-IN CONTROL. For caselaw, guidance and consultations one document holds exactly
 *    one section, so section- and document-grain recall MUST be identical. 25 of the 66 scoreable
 *    questions sit there. If they differ, the document rule is broken and every other row is
 *    suspect — so it is asserted here and again in `check:s19-grain`, not merely hoped for.
 *
 * 3. ⚠ DEPTH IS PART OF THE RESULT. A document score aggregated over a top-20 prefix is a
 *    different number from the same aggregation over a top-500 prefix, because sections below the
 *    depth contribute nothing. Every arm states its depth and every miss prints NOT-IN-{depth},
 *    never 0 (S18's convention, and S17's for the same reason).
 *
 * 4. ⚠ THE GATEWAY ARM IS RUN UNDER PRODUCTION'S FLAG STRING, read live off `/api/health`, not
 *    under this machine's `.env`. S14's figures described a keyword-only system for a fortnight
 *    because nobody wrote down what ran; S17's D-6 — a baseline under production's real flag
 *    string — has been open since 27 August. The string is recorded IN the artefact.
 *
 * 5. ⚠ `vector-serve` SATURATES AND DOES NOT RECOVER once tipped, and a client abort does not
 *    cancel queued work — so a hard measurement can make the service worse for the product. The
 *    run is sequential, and `/stats` is re-read every `--watch-every` questions; if warm p95 rises
 *    past `--p95-abort` the run STOPS and says so rather than producing numbers taken off a
 *    degrading service.
 *
 * ⚠ A CAUTION ON EVERY NUMBER (the brief's own). Four sets of re-keyed questions are with Charlie.
 * Recall figures will move when they land for reasons unrelated to this sprint. The set version is
 * stamped into the artefact and named in every table.
 *
 * Usage (from scrutinise-web):
 *   npx tsx --env-file=.env --tsconfig tsconfig.json scripts/measure-s19-grain.ts
 *   …  --arms scoped,dense          skip the gateway arm (no LLM spend, no vector-serve fan-out)
 *   …  --depth 500                  retrieval depth for the scoped arms
 *   …  --only debates,legislation   restrict to some gold collections
 *   …  --p95-abort 20000            stop if vector-serve warm p95 exceeds this (ms)
 */
import fs from 'node:fs'
import path from 'node:path'
import { prisma } from '../lib/prisma'
import { capabilityLine } from '../lib/env-flags'
import {
  documentKeyOf, collapseToDocuments, aggregateToDocuments, rankOf, chunkCountOf,
  CHUNK_GRAIN_NOTE, type DocumentAggregation,
} from '../lib/lex/grain'
import { GOLD_CORPUS } from './gold/s10-gold-set'
import { GOLD_V2 } from './gold/gold-v2-set'

export {}

const argv = process.argv.slice(2)
const arg = (n: string) => {
  const i = argv.indexOf(`--${n}`)
  if (i >= 0 && argv[i + 1] && !argv[i + 1].startsWith('--')) return argv[i + 1]
  const eq = argv.find((x) => x.startsWith(`--${n}=`))
  return eq ? eq.split('=').slice(1).join('=') : null
}
const ARMS = (arg('arms') ?? 'scoped,dense,gateway').split(',').map((s) => s.trim()).filter(Boolean)
const DEPTH = parseInt(arg('depth') ?? '500', 10)
const DENSE_DEPTH = parseInt(arg('dense-depth') ?? '200', 10)
const ONLY = (arg('only') ?? '').split(',').map((s) => s.trim()).filter(Boolean)
const WATCH_EVERY = parseInt(arg('watch-every') ?? '10', 10)
const P95_ABORT = parseInt(arg('p95-abort') ?? '25000', 10)
/** ⚠ THE OUTPUT PATH CARRIES THE ARMS THAT PRODUCED IT. A run of `--arms gateway` writes a
 *  different file from a run of `--arms scoped,dense`, because sharing one path between two runs is
 *  how a completed measurement gets overwritten by a narrower one — which happened once in this
 *  project already, to a file that was newer than the run that clobbered it. `--out` overrides. */
const OUT = path.join(__dirname, '../../docs/census',
  arg('out') ?? `s19-grain-${(arg('arms') ?? 'scoped,dense,gateway').split(',').map((s) => s.trim()).filter(Boolean).join('-')}.json`)
const FTS = (process.env.FTS_SEARCH_URL ?? '').replace(/\/$/, '')
const VEC = (process.env.VECTOR_SEARCH_URL ?? '').replace(/\/$/, '')
const HEALTH = 'https://www.scrutinise.org/api/health'
/** The version of the question set these numbers describe. Bump when Charlie's re-keys land. */
const SET_VERSION = 'S10 GOLD_CANDIDATES_S8 (validated 20 Aug) + GOLD_CANDIDATES_V2 (validated 22 Aug), pre-re-key'

// ════════════════════════════════════════════════════════════════════════════════════════════════
// the questions
// ════════════════════════════════════════════════════════════════════════════════════════════════
interface Q { id: string; collection: string; question: string; keys: string[]; set: 's10' | 'v2' }
const QUESTIONS: Q[] = [
  ...GOLD_CORPUS.filter((q) => q.verdict === 'ACCEPT' && q.scoring !== 'negative-control')
    .map((q): Q => ({ id: `S10-Q${q.n}`, collection: q.collection, question: q.question, keys: q.keys, set: 's10' })),
  ...GOLD_V2.filter((q) => q.scoring === 'recall')
    .map((q): Q => ({ id: `V2-${q.id}`, collection: q.collection ?? 'unknown', question: q.query, keys: q.keys, set: 'v2' })),
].filter((q) => !ONLY.length || ONLY.includes(q.collection))

// ════════════════════════════════════════════════════════════════════════════════════════════════
// retrieval
// ════════════════════════════════════════════════════════════════════════════════════════════════
interface Unit { id: string; score: number; corpus: string; parentDocId?: string | null }

async function ftsScoped(query: string, corpora: string[], limit: number): Promise<Unit[]> {
  const res = await fetch(`${FTS}/fts-search`, {
    method: 'POST', headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ query, limit, corpora }),
  })
  if (!res.ok) throw new Error(`FTS ${res.status}: ${(await res.text()).slice(0, 200)}`)
  const j = (await res.json()) as { results?: Array<{ id: string; corpus: string; score: number }>; corpora?: string[] | null }
  // ⚠ Stated, never swallowed: an unhonoured prefilter makes every rank meaningless.
  if (j.corpora && corpora.some((c) => !j.corpora!.includes(c))) {
    throw new Error(`fts-serve did not honour corpora=${JSON.stringify(corpora)} (echoed ${JSON.stringify(j.corpora)})`)
  }
  return (j.results ?? []).map((r) => ({ id: r.id, score: r.score, corpus: r.corpus }))
}

async function vecScoped(query: string, corpora: string[], limit: number): Promise<Unit[]> {
  const res = await fetch(`${VEC}/vector-search`, {
    method: 'POST', headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ query, limit, corpora }),
  })
  if (!res.ok) throw new Error(`VEC ${res.status}: ${(await res.text()).slice(0, 200)}`)
  const j = (await res.json()) as { results?: Array<{ id: string; corpus: string; score: number; chunkId?: string }> }
  return (j.results ?? []).map((r) => ({ id: r.id, score: r.score, corpus: r.corpus }))
}

// ════════════════════════════════════════════════════════════════════════════════════════════════
// scoring — one function, four grains, so an arm cannot be scored two different ways by accident
// ════════════════════════════════════════════════════════════════════════════════════════════════
interface GrainRanks {
  depth: number
  returned: number
  section: number
  documentCollapse: number
  documentMax: number
  documentSumTop3: number
  /** ⚠⚠ THE NUMBER THAT DECIDES §3, AND THE ONE A DOCUMENT-GRAIN TABLE WOULD FLATTER WITHOUT.
   *
   *  Recall at document grain says the right DOCUMENT came back. It does not say the user is shown
   *  the right passage — a debates document is a 318-speech sitting day. §3's shape is "retrieve at
   *  the grain that finds it; display the passage that matched", so what a user would actually
   *  receive is: the top 20 DOCUMENTS, each rendered as its best-scoring retrieved section. This is
   *  the rank of the key in THAT list.
   *
   *  It can be far better than the section rank (a key at section rank 92 that is the best section
   *  of a document ranked 3rd arrives at 3) and it can be far worse than the document rank (the
   *  right day found, the wrong speech shown). Which of those happens is a fact about the corpus,
   *  not something to reason about — so it is measured. */
  documentBestMember: number
  /** S18 §B's definition, reproduced exactly so this sprint's numbers can be compared with the
   *  published ones rather than quietly superseding them: the position IN THE SECTION LIST of the
   *  first hit belonging to a key's document. Not the same as `documentCollapse`, which is the
   *  position in the DEDUPLICATED document list, and always ≥ it. */
  documentInSectionSlots: number
}

function score(ranked: Unit[], keys: string[], parents: Map<string, string | null>, depth: number): GrainRanks {
  const withParents = ranked.map((u) => ({ ...u, parentDocId: parents.get(u.id) ?? null }))
  const keyDocs = new Set(keys.map((k) => documentKeyOf(k, parents.get(k) ?? null)))
  const collapsed = collapseToDocuments(withParents)
  const aggMax = aggregateToDocuments(withParents, 'max' as DocumentAggregation)
  const aggSum3 = aggregateToDocuments(withParents, 'sum-top3' as DocumentAggregation)
  return {
    depth,
    returned: ranked.length,
    section: rankOf(withParents, (u) => keys.includes(u.id)),
    documentCollapse: rankOf(collapsed, (d) => keyDocs.has(d.documentKey)),
    documentMax: rankOf(aggMax, (d) => keyDocs.has(d.documentKey)),
    documentSumTop3: rankOf(aggSum3, (d) => keyDocs.has(d.documentKey)),
    documentBestMember: rankOf(aggMax, (d) => keys.includes(d.best.id)),
    documentInSectionSlots: rankOf(withParents, (u) => keyDocs.has(documentKeyOf(u.id, u.parentDocId))),
  }
}

const hitAt = (rank: number, n: number) => rank > 0 && rank <= n

// ── length ──────────────────────────────────────────────────────────────────────────────────────
interface Lengths { n: number; median: number; p25: number; under30: number; under100: number; over1500: number }
function lengths(words: number[]): Lengths {
  const s = [...words].sort((a, b) => a - b)
  const at = (p: number) => (s.length ? s[Math.min(s.length - 1, Math.floor(p * s.length))] : 0)
  return {
    n: s.length, median: at(0.5), p25: at(0.25),
    under30: s.filter((w) => w < 30).length,
    under100: s.filter((w) => w < 100).length,
    over1500: s.filter((w) => w > 1500).length,
  }
}

// ════════════════════════════════════════════════════════════════════════════════════════════════
async function main() {
  if (!FTS) throw new Error('FTS_SEARCH_URL is not set — the scoped arm cannot run')

  let prod: { commit?: string; capabilities?: Record<string, boolean>; retrieval?: { vectorStreams?: string[] } } | null = null
  try { prod = await (await fetch(HEALTH)).json() } catch { /* reported */ }

  // ⚠ THE GATEWAY ARM RUNS UNDER PRODUCTION'S FLAG STRING, not this machine's. Set BEFORE the
  // gateway module is imported so nothing has read a flag at module scope. S17's D-6.
  const flagNote: string[] = []
  if (ARMS.includes('gateway')) {
    if (!prod?.capabilities) throw new Error('/api/health unreadable — refusing to run the gateway arm under an unknown flag string (CLAUDE.md §19)')
    for (const [k, v] of Object.entries(prod.capabilities)) process.env[k] = v ? 'true' : 'false'
    const streams = prod.retrieval?.vectorStreams ?? []
    if (streams.length) process.env.LEX_VECTOR_STREAMS = streams.join(',')
    flagNote.push(`gateway arm forced to production's flag string from /api/health (commit ${String(prod.commit).slice(0, 7)}); LEX_VECTOR_STREAMS=${process.env.LEX_VECTOR_STREAMS}`)
  }
  // ── §4: the ARM THAT MEASURES WHAT §3 BUILT ─────────────────────────────────────────────────
  // ⚠ SET AFTER the production flag string, deliberately. Production is on a commit that predates
  // `LEX_SEARCH_GRAIN`, so /api/health does not report it and the loop above would not clear it —
  // but relying on that would be relying on a deploy lag. This is explicit, and it is printed.
  const GRAIN_MAP = arg('grain-map')
  if (GRAIN_MAP) {
    process.env.LEX_SEARCH_GRAIN = 'true'
    process.env.LEX_SEARCH_GRAIN_MAP = GRAIN_MAP
    flagNote.push(`⚠⚠ THIS RUN IS THE GRAIN-ON ARM: LEX_SEARCH_GRAIN=true LEX_SEARCH_GRAIN_MAP=${GRAIN_MAP}`)
  } else {
    // ⚠ Cleared rather than assumed absent, so a stray value in `.env` cannot silently make the
    // OFF arm into an ON arm — which is how two arms come to be the same arm.
    delete process.env.LEX_SEARCH_GRAIN
    delete process.env.LEX_SEARCH_GRAIN_MAP
    flagNote.push('grain policy OFF for this run (LEX_SEARCH_GRAIN cleared, not merely unset)')
  }

  const { runSearch } = await import('../lib/lex/search-gateway')

  const vecStats = async () => { try { return (await (await fetch(`${VEC}/stats`)).json()) as Record<string, any> } catch { return null } }
  const vec0 = await vecStats()

  console.log('── S19 §2 · THE UNIT, PER COLLECTION ──')
  console.log(`  question set  : ${SET_VERSION}`)
  console.log(`  questions     : ${QUESTIONS.length} scoreable (negative controls excluded, by design)`)
  console.log(`  arms          : ${ARMS.join(', ')}    scoped depth ${DEPTH}, dense depth ${DENSE_DEPTH}`)
  console.log(`  local flags   : ${capabilityLine()}`)
  console.log(`  production    : ${prod ? `${String(prod.commit).slice(0, 7)} ${JSON.stringify(prod.capabilities)}` : '⚠ UNREADABLE'}`)
  for (const f of flagNote) console.log(`  ⚠ ${f}`)
  console.log(`  vector-serve  : ${vec0 ? `build=${vec0.build} served=${vec0.served} warm_p95=${vec0.warm_p95_ms}ms inFlight=${vec0.concurrency?.inFlight}` : 'UNREADABLE'}`)
  console.log(`  ⚠ chunk grain : ${CHUNK_GRAIN_NOTE}`)
  console.log()

  // ── every key's parent, and every key's own shape ───────────────────────────────────────────
  const allKeys = [...new Set(QUESTIONS.flatMap((q) => q.keys))]
  const keyRows = await prisma.$queryRawUnsafe<Array<{ id: string; parentdocid: string | null; wordcount: number | null }>>(
    `SELECT id, "parentDocId" AS parentdocid, "wordCount" AS wordcount FROM corpus_sections WHERE id = ANY($1::text[])`, allKeys)
  const keyMeta = new Map(keyRows.map((r) => [r.id, r]))
  const missing = allKeys.filter((k) => !keyMeta.has(k))
  if (missing.length) console.log(`  ⚠⚠ ${missing.length} answer keys are NOT IN corpus_sections — a zero on these is an INGEST result, not a retrieval one: ${missing.join(', ')}\n`)

  // ── the structural fact that decides which collections a grain change can even touch ────────
  console.log('── §2.0 · SECTIONS PER DOCUMENT, PER COLLECTION HOLDING A KEY (measured, not assumed) ──')
  const keyCorpora = [...new Set(allKeys.map((k) => k.split(':')[0]))].sort()
  const shape: Record<string, { sections: number; documents: number; perDoc: number; collapses: boolean }> = {}
  for (const c of keyCorpora) {
    const r = await prisma.$queryRawUnsafe<Array<{ n: bigint; docs: bigint }>>(
      `SELECT count(*) AS n,
              count(DISTINCT coalesce(${c === 'impact-assessments' ? 'split_part(id,\':\',2)' : '"parentDocId"'}, split_part(id,':',2))) AS docs
       FROM corpus_sections WHERE corpus = $1`, c)
    const sections = Number(r[0].n); const documents = Number(r[0].docs)
    shape[c] = { sections, documents, perDoc: documents ? sections / documents : 0, collapses: sections === documents }
    console.log(`  ${c.padEnd(24)} ${String(sections).padStart(9)} sections / ${String(documents).padStart(8)} documents = ${(sections / (documents || 1)).toFixed(1)} per document` +
      `${sections === documents ? '   ⚠ DOCUMENT == SECTION — no grain change can move this collection' : ''}`)
  }
  console.log()

  // ════════════════════════════════════════════════════════════════════════════════════════════
  const rows: Array<Record<string, unknown>> = []
  let done = 0
  let aborted: string | null = null
  /** Ids the INDEX returned that `corpus_sections` does not hold — §1.1's orphan class, counted
   *  here because they enter every ranking these numbers are computed over. */
  const unhydrated = new Set<string>()

  // ⚠ ONE metadata cache for the whole run, not one per question. Every arm needs the parent of
  // every id it retrieved, and three arms × 65 questions × up to 500 ids is 100k lookups if each
  // question starts empty — most of them for ids another question already fetched.
  const parents = new Map<string, string | null>()
  for (const [id, m] of keyMeta) parents.set(id, m.parentdocid)
  async function ensureMeta(ids: string[]) {
    const need = [...new Set(ids)].filter((id) => !parents.has(id))
    if (!need.length) return
    for (let i = 0; i < need.length; i += 1000) {
      const batch = need.slice(i, i + 1000)
      const pr = await prisma.$queryRawUnsafe<Array<{ id: string; parentdocid: string | null; wordcount: number | null }>>(
        `SELECT id, "parentDocId" AS parentdocid, "wordCount" AS wordcount FROM corpus_sections WHERE id = ANY($1::text[])`, batch)
      for (const r of pr) { parents.set(r.id, r.parentdocid); keyMeta.set(r.id, r) }
      // ⚠ An id the index returned and the database does not hold is CACHED AS NULL rather than
      // re-queried every arm. It is also the orphan state §1.1 found seven collections in, so it
      // is counted rather than absorbed.
      for (const id of batch) if (!parents.has(id)) { parents.set(id, null); unhydrated.add(id) }
    }
  }

  for (const q of QUESTIONS) {
    if (aborted) break
    const corpora = [...new Set(q.keys.map((k) => k.split(':')[0]))]

    const arms: Record<string, GrainRanks & { error?: string; topWords?: Lengths }> = {}
    const armIds: Record<string, string[]> = {}

    for (const armName of ARMS) {
      try {
        let ranked: Unit[]
        let depth: number
        if (armName === 'scoped') { ranked = await ftsScoped(q.question, corpora, DEPTH); depth = DEPTH }
        else if (armName === 'dense') {
          if (!VEC) { arms[armName] = { ...score([], q.keys, parents, 0), error: 'VECTOR_SEARCH_URL unset — NOT RUN' }; continue }
          ranked = await vecScoped(q.question, corpora, DENSE_DEPTH); depth = DENSE_DEPTH
        } else {
          const g = await runSearch({ keywords: q.question.trim().split(/\s+/).filter(Boolean), intent: 'BACKGROUND_BRIEFING', limit: 34 })
          ranked = g.results.map((r) => ({ id: r.id, score: r.score, corpus: r.id.split(':')[0] }))
          depth = ranked.length
          if (g.failed) arms[armName] = { ...score([], q.keys, parents, 0), error: `gateway FAILED: ${g.failureReason}` }
          if (g.meta.denseDegraded?.length) console.log(`    ⚠ dense degraded on ${g.meta.denseDegraded.map((d) => `${d.stream}:${d.reason}`).join(', ')}`)
        }
        // ⚠ Parents for the RETRIEVED ids. Without them every retrieved row would fall back to its
        // id's second segment, which is the literal word `publication` for every committee row —
        // i.e. the document grain would silently score one giant document.
        await ensureMeta(ranked.map((u) => u.id))
        const s = score(ranked, q.keys, parents, depth)
        const topWords = lengths(ranked.slice(0, 20).map((u) => keyMeta.get(u.id)?.wordcount ?? 0).filter((w) => w > 0))
        arms[armName] = { ...s, ...(arms[armName]?.error ? { error: arms[armName].error } : {}), topWords }
        armIds[armName] = ranked.slice(0, 20).map((u) => u.id)
      } catch (e) {
        arms[armName] = { ...score([], q.keys, parents, 0), error: (e as Error).message }
      }
    }

    const keyShape = q.keys.map((k) => {
      const m = keyMeta.get(k)
      return { key: k, words: m?.wordcount ?? null, chunks: chunkCountOf(Math.round((m?.wordcount ?? 0) * 6.1)) }
    })
    rows.push({ ...q, corpora, keyShape, arms, armTop20: armIds })

    const fmt = (a: GrainRanks & { error?: string } | undefined) => {
      if (!a) return 'NOT RUN'
      if (a.error) return `ERROR ${a.error.slice(0, 60)}`
      const r = (x: number) => (x > 0 ? String(x).padStart(4) : `>${a.depth}`.padStart(4))
      return `sec ${r(a.section)}  docColl ${r(a.documentCollapse)}  docSum3 ${r(a.documentSumTop3)}  docBest ${r(a.documentBestMember)}  s18def ${r(a.documentInSectionSlots)}`
    }
    console.log(`  ${q.id.padEnd(9)} ${q.collection.padEnd(19)} ${q.question.slice(0, 52).padEnd(53)}`)
    for (const a of ARMS) console.log(`      ${a.padEnd(8)} ${fmt(arms[a])}`)

    done++
    if (ARMS.includes('dense') || ARMS.includes('gateway')) {
      if (done % WATCH_EVERY === 0) {
        const s = await vecStats()
        const p95 = Number(s?.warm_p95_ms ?? 0)
        console.log(`      · vector-serve after ${done}: warm_p95=${p95}ms inFlight=${s?.concurrency?.inFlight} queued=${s?.concurrency?.queued} rejections=${s?.concurrency?.rejections}`)
        if (p95 > P95_ABORT) {
          aborted = `vector-serve warm p95 ${p95}ms exceeded --p95-abort ${P95_ABORT}ms after ${done} questions — STOPPING. Numbers taken off a degrading service are not numbers.`
          console.log(`      ⚠⚠ ${aborted}`)
        }
      }
    }
  }

  // ════════════════════════════════════════════════════════════════════════════════════════════
  // the table
  // ════════════════════════════════════════════════════════════════════════════════════════════
  const collections = [...new Set(QUESTIONS.map((q) => q.collection))]
  const summary: Array<Record<string, unknown>> = []
  /** Arms whose output is genuinely ranked by score. The gateway's is interleaved round-robin, so
   *  a score aggregation over it re-sorts a list the platform deliberately did not sort. */
  const SORTED_ARMS = new Set(['scoped', 'dense'])
  console.log('\n══ §2 · RECALL@20 AT EACH GRAIN, PER COLLECTION ══')
  console.log(`   ⚠ n is questions with at least one key; a miss prints as a miss, never as absent from the corpus.`)
  for (const arm of ARMS) {
    console.log(`\n── arm: ${arm}${arm === 'dense' ? '  (the CHUNK-grain scorer — collapses to sections before replying)' : arm === 'scoped' ? '  (BM25, scoped to the key\'s own collection — the SECTION-grain scorer)' : '  (the real gateway, production flag string)'} ──`)
    console.log(`   ${'collection'.padEnd(20)} ${'n'.padStart(3)}  ${'section'.padStart(8)} ${'doc(coll)'.padStart(10)} ${'doc(sum3)'.padStart(10)} ${'doc→best§'.padStart(10)} ${'S18 def'.padStart(8)}   ${'med words'.padStart(9)} ${'<30w'.padStart(5)} ${'>1500w'.padStart(6)}`)
    for (const c of collections) {
      const qs = rows.filter((r) => r.collection === c)
      const ok = qs.filter((r) => { const a = (r.arms as any)[arm]; return a && !a.error })
      const n = ok.length
      const cnt = (f: (a: GrainRanks) => number) => ok.filter((r) => hitAt(f((r.arms as any)[arm]), 20)).length
      const words = ok.flatMap((r) => { const t = ((r.arms as any)[arm].topWords as Lengths | undefined); return t ? [t.median] : [] })
      const under30 = ok.reduce((a, r) => a + (((r.arms as any)[arm].topWords as Lengths | undefined)?.under30 ?? 0), 0)
      const topN = ok.reduce((a, r) => a + (((r.arms as any)[arm].topWords as Lengths | undefined)?.n ?? 0), 0)
      const over1500 = ok.reduce((a, r) => a + (((r.arms as any)[arm].topWords as Lengths | undefined)?.over1500 ?? 0), 0)
      const medMed = words.length ? [...words].sort((a, b) => a - b)[Math.floor(words.length / 2)] : 0
      const errs = qs.length - n
      // ⚠ `doc(sum3)` is withheld on the gateway arm — see the score-ordering control below.
      const sum3 = SORTED_ARMS.has(arm) ? `${cnt((a) => a.documentSumTop3)}/${n}` : 'n/a'
      console.log(`   ${c.padEnd(20)} ${String(n).padStart(3)}  ${`${cnt((a) => a.section)}/${n}`.padStart(8)} ${`${cnt((a) => a.documentCollapse)}/${n}`.padStart(10)} ${sum3.padStart(10)} ${`${cnt((a) => a.documentBestMember)}/${n}`.padStart(10)} ${`${cnt((a) => a.documentInSectionSlots)}/${n}`.padStart(8)}   ${String(medMed).padStart(9)} ${`${topN ? ((100 * under30) / topN).toFixed(0) : '—'}%`.padStart(5)} ${`${topN ? ((100 * over1500) / topN).toFixed(0) : '—'}%`.padStart(6)}${errs ? `   ⚠ ${errs} NOT MEASURED` : ''}`)
      summary.push({
        arm, collection: c, n, notMeasured: errs,
        section20: cnt((a) => a.section), documentCollapse20: cnt((a) => a.documentCollapse),
        documentMax20: SORTED_ARMS.has(arm) ? cnt((a) => a.documentMax) : null,
        documentSumTop3_20: SORTED_ARMS.has(arm) ? cnt((a) => a.documentSumTop3) : null,
        scoreAggregationsValid: SORTED_ARMS.has(arm),
        documentBestMember20: cnt((a) => a.documentBestMember),
        documentInSectionSlots20: cnt((a) => a.documentInSectionSlots),
        sectionDepth: ok.filter((r) => (r.arms as any)[arm].section > 0).length,
        documentCollapseDepth: ok.filter((r) => (r.arms as any)[arm].documentCollapse > 0).length,
        medianWordsOfTop20: medMed, under30Share: topN ? under30 / topN : null,
        over1500Share: topN ? over1500 / topN : null, top20Counted: topN,
      })
    }
  }

  // ── the control ─────────────────────────────────────────────────────────────────────────────
  console.log('\n── §2.0 CONTROL · WHERE ONE DOCUMENT IS ONE SECTION, THE TWO GRAINS MUST AGREE ──')
  let controlFired = 0, controlBroken = 0
  for (const r of rows) {
    const allCollapse = (r.corpora as string[]).every((c) => shape[c]?.collapses)
    if (!allCollapse) continue
    controlFired++
    for (const arm of ARMS) {
      const a = (r.arms as any)[arm]
      if (!a || a.error) continue
      if (hitAt(a.section, 20) !== hitAt(a.documentCollapse, 20)) {
        controlBroken++
        console.log(`  ⚠⚠ ${r.id} (${(r.corpora as string[]).join(',')}) arm=${arm}: section@20=${hitAt(a.section, 20)} but documentCollapse@20=${hitAt(a.documentCollapse, 20)} — the document rule is WRONG`)
      }
    }
  }
  console.log(`  ${controlFired} questions sit entirely in collapse-collections; ${controlBroken} disagreements. ${controlBroken === 0 ? '✅ the document rule holds where it must.' : '❌ every document-grain number above is suspect.'}`)

  // ── the second control, declared in lib/lex/grain.ts, AND WHAT IT FOUND ──────────────────────
  //
  // `max` aggregation over a score-sorted list must produce the same ORDER as first-occurrence
  // collapse. On the two SCOPED arms the input comes straight off one service in score order, so
  // any disagreement means the list was not sorted and every document number would be off.
  //
  // ⚠⚠ ON THE GATEWAY ARM THE CONTROL IS INVERTED, AND IT FIRED — 42 of 65 on the first run.
  // `runRoutedSearch` returns `results` INTERLEAVED ROUND-ROBIN across streams (interleave.ts),
  // deliberately, so that any prefix is stream-balanced. It is therefore NOT in score order, and
  // `score-scope.ts` exists precisely to stop anything sorting it. So on that arm:
  //   · `section` and `documentCollapse` are valid — they read the order the product produced;
  //   · `documentMax` and `documentSumTop3` are NOT, because computing them re-sorts a list the
  //     platform deliberately did not sort, across scorers it forbids comparing.
  // They are therefore withheld from the gateway table rather than printed with a caveat. A number
  // that should not be read is better absent than footnoted.
  const SCORE_SORTED_ARMS = SORTED_ARMS
  let sortBroken = 0, sortChecked = 0, interleavedSeen = 0
  for (const r of rows) for (const arm of ARMS) {
    const a = (r.arms as any)[arm]
    if (!a || a.error) continue
    if (!SCORE_SORTED_ARMS.has(arm)) {
      if (a.documentMax !== a.documentCollapse) interleavedSeen++
      continue
    }
    sortChecked++
    if (a.documentMax !== a.documentCollapse) {
      sortBroken++
      console.log(`  ⚠⚠ ${r.id} arm=${arm}: doc(max)=${a.documentMax} ≠ doc(collapse)=${a.documentCollapse} — the retrieved list was NOT sorted by score`)
    }
  }
  console.log(`  ${sortChecked} score-sorted arm-results checked; ${sortBroken} disagreements. ${sortBroken === 0 ? '✅ the scoped arms returned score-sorted lists.' : '❌ a scoped arm returned an unsorted list — its document numbers are suspect.'}`)
  if (ARMS.some((a) => !SCORE_SORTED_ARMS.has(a))) {
    console.log(`  ▶ the gateway arm disagreed on ${interleavedSeen} results, WHICH IS THE EXPECTED RESULT: its output is interleaved round-robin, not ranked by score.`)
    console.log(`    doc(max) and doc(sum3) are therefore NOT REPORTED for that arm — they would re-sort a list the platform deliberately did not sort.`)
  }

  if (unhydrated.size) {
    console.log(`\n  ⚠⚠ ${unhydrated.size} retrieved ids are IN THE INDEX AND NOT IN corpus_sections — they entered these rankings with a null parent and no word count. §1.1's orphan class; INGEST finding.`)
    console.log(`     e.g. ${[...unhydrated].slice(0, 4).join('  ')}`)
  }

  const vec1 = await vecStats()
  fs.writeFileSync(OUT, JSON.stringify({
    takenAt: new Date().toISOString(),
    setVersion: SET_VERSION,
    arms: ARMS, depth: DEPTH, denseDepth: DENSE_DEPTH,
    grainMap: GRAIN_MAP ?? null,
    localFlags: capabilityLine(),
    productionHealth: prod,
    flagNote,
    chunkGrainNote: CHUNK_GRAIN_NOTE,
    vectorServeBefore: vec0, vectorServeAfter: vec1,
    aborted,
    missingKeys: missing,
    collectionShape: shape,
    control: {
      questionsInCollapseCollections: controlFired, disagreements: controlBroken,
      sortOrderChecked: sortChecked, sortOrderDisagreements: sortBroken,
    },
    unhydratedRetrievedIds: [...unhydrated],
    summary, rows,
  }, null, 2))
  console.log(`\n  → ${path.relative(process.cwd(), OUT)}`)
  if (aborted) console.log(`  ⚠⚠ RUN INCOMPLETE: ${aborted}`)
  await prisma.$disconnect()
}
main().catch((e) => { console.error(e); process.exit(1) })
