/**
 * audit-s19-reach.ts — BRIEF_SEARCH_S19 §1. THE REACH SWEEP.
 *
 * ════════════════════════════════════════════════════════════════════════════════════════════════
 * WHAT THE BRIEF ASKS FOR, AND THE ONE INSTRUCTION THAT SHAPES THE WHOLE FILE
 * ════════════════════════════════════════════════════════════════════════════════════════════════
 * §1.1: "every collection, with its section count, its display type, its tier, and whether any
 * query can return it in production with the router on. ⚠ Answer by probing the live index, one
 * collection at a time — never by reading a configuration file. `cps-guidance` was found by
 * probing; the others were inferred from its pattern."
 *
 * `docs/CORPUS_REACHABILITY.md` already answers the shape of that question and is NOT what this
 * replaces — it is a fuller instrument (two full Lance scans, vector row counts, gold provenance).
 * What it cannot be is CURRENT: it was generated 2026-08-20 23:59 UTC, S11's re-tier of seven
 * collections landed on 21 August, and S16 published UNREACHABLE=4 off exactly that kind of
 * one-day-stale artefact. So this file re-establishes the two facts that decide reachability —
 * the SERVED tier and the display type — by asking the running service, per collection, and takes
 * `streamCanSelect` from the app rather than restating it.
 *
 * ════════════════════════════════════════════════════════════════════════════════════════════════
 * FOUR THINGS THAT WOULD MAKE THIS TABLE LIE, AND WHAT IS DONE ABOUT EACH
 * ════════════════════════════════════════════════════════════════════════════════════════════════
 *
 * 1. ⚠⚠ A PROBE QUERY THAT MATCHES NOTHING READS AS "UNREACHABLE", AND THE FIRST VERSION OF THIS
 *    FILE FELL INTO IT. A collection of 40 sections (`lgsco`) will not be returned by a generic
 *    word, so each collection is probed with WORDS TAKEN FROM ITS OWN ROWS — a section title
 *    sampled by `md5(id)`. That is necessary and it is not sufficient: the first run reported
 *    `lda-commonsoralquestions` (69,529 sections) as TIER-UNREAD after twelve probes, and the
 *    cause was that **all 69,529 of its rows have a blank `sectionTitle`**, so every probe string
 *    was empty or a bare row number. The collection is in the index and is perfectly reachable.
 *    So the probe now runs in THREE STAGES and records WHICH ONE answered:
 *      title → words from a sampled `sectionTitle`
 *      id    → words from the id, for collections whose ids carry text
 *      generic → four common phrases, corpus-scoped, which will return something from any
 *                collection of any size because the prefilter has removed the competition
 *    A tier still UNREAD after all three is reported as UNREAD and counted (CLAUDE.md §23.2).
 *
 * 1b. ⚠⚠ ENUMERATING FROM `corpus_sections` ALONE MISSES COLLECTIONS THAT ARE IN THE INDEX AND NOT
 *    IN THE DATABASE — and there are seven. The sweep therefore asks about the UNION of three
 *    sources, and records which source produced each name:
 *      neon      — `corpus_sections` GROUP BY corpus
 *      artefact  — names (NAMES ONLY, never tiers or verdicts) from docs/corpus_reachability.json
 *      discovery — distinct `corpus` values seen in unscoped probes of the served index
 *    ⚠ Even so, a collection sitting in the index under a name nobody has ever written down would
 *    still be missed. Closing that hole needs a full index scan, which
 *    `scripts/ingest/search/corpus-reachability.ts` does and this does not. Stated, not implied.
 *
 * 2. ⚠ AN UNHONOURED PREFILTER MAKES EVERY ROW MEANINGLESS. `fts-serve` echoes the `corpora` it
 *    applied; if the echo does not contain the collection asked for, the row is marked
 *    PREFILTER-NOT-HONOURED rather than being reported as a measurement.
 *
 * 3. ⚠ THE DISPLAY TYPE DEPENDS ON THE ID, not only on the collection: `corpusToType` reads the
 *    gid doctype inside the legislation tier, so one collection yields PRIMARY_LEGISLATION and
 *    STATUTORY_INSTRUMENT both. It is evaluated over the ids that actually came back from the
 *    served index, and a collection whose every sample types `null` is reported as dropped by the
 *    adapter before any stream sees it — retrieved, paid for, discarded.
 *
 * 4. ⚠ "REACHABLE" IS A STATEMENT ABOUT PRODUCTION, NOT ABOUT THIS MACHINE. The router arm is run
 *    under production's flag string, read from `/api/health` at the top of the run and printed, so
 *    a number taken under a local `.env` cannot be mistaken for a number about the product.
 *
 * 5. ⚠⚠ REACHABLE IS NOT THE SAME AS USABLE, AND SEVEN COLLECTIONS PROVE IT. `oecd`,
 *    `written-answers`, `written-statements` and the four surviving `lda-*` sets are IN THE SERVED
 *    INDEX, are admitted by real streams, and have ZERO rows in `corpus_sections` — so the adapter
 *    hydrates nothing and the product returns a card whose title is the literal corpus name, with
 *    no citation, no date and no URL. Measured through `runFtsSearch`, not reasoned. A matrix that
 *    printed "reachable" for those and stopped would be describing a defect as health, so every
 *    row carries a `hydrates` column: of the ids the INDEX returned for this collection, how many
 *    exist in the database. That column is the difference between "a query can return it" and "a
 *    user can open it".
 *
 * ════════════════════════════════════════════════════════════════════════════════════════════════
 * §1.3 — THE NOT-ROUTED CLASS
 * ════════════════════════════════════════════════════════════════════════════════════════════════
 * S18 overturned this for impact assessments (routed on 5 of 9). The brief says re-check the
 * others the same way and PRINT THE STREAMS THE ROUTER CHOSE PER QUESTION. Rather than re-checking
 * the three that a stale class list happens to name, this rolls the router over EVERY validated
 * question in both sets and prints the streams — so the not-routed class is recomputed rather than
 * inherited, and a question that has quietly joined it since S17 is visible.
 *
 * ⚠ The router is an LLM and routing is measurably intermittent, so `--repeat` defaults to 3 and
 * every rate below has the CALL count as its denominator, never the question count (S18 §1.1).
 *
 * Usage (from scrutinise-web):
 *   npx tsx --env-file=.env --tsconfig tsconfig.json scripts/audit-s19-reach.ts
 *   …  --no-router     §1.1 only, no LLM spend
 *   …  --repeat 3      router rolls per question
 *   …  --only a,b      restrict the collection sweep (debugging)
 */
import fs from 'node:fs'
import path from 'node:path'
import { prisma } from '../lib/prisma'
import { corpusToType, EXCLUDED_BY_DESIGN, DEFERRED_TO_GRAPH } from '../lib/lex/corpus-type-map'
import {
  STREAM_SCOPES, STREAM_SCOPES_V2, streamCanSelect, type StreamScope,
} from '../lib/lex/stream-scopes'
import { routeQueryDetailed } from '../lib/lex/query-expansion'
import { capabilityLine } from '../lib/env-flags'
import type { SearchResultType } from '../lib/lex/page1-config'
import { GOLD_CORPUS } from './gold/s10-gold-set'
import { GOLD_V2 } from './gold/gold-v2-set'

export {}

const argv = process.argv.slice(2)
const has = (n: string) => argv.includes(`--${n}`)
const arg = (n: string) => {
  const i = argv.indexOf(`--${n}`)
  if (i >= 0 && argv[i + 1] && !argv[i + 1].startsWith('--')) return argv[i + 1]
  const eq = argv.find((x) => x.startsWith(`--${n}=`))
  return eq ? eq.split('=').slice(1).join('=') : null
}
const REPEAT = parseInt(arg('repeat') ?? '3', 10)
const ONLY = (arg('only') ?? '').split(',').map((s) => s.trim()).filter(Boolean)
const OUT = path.join(__dirname, '../../docs/census/s19-reach.json')
const FTS = (process.env.FTS_SEARCH_URL ?? '').replace(/\/$/, '')
const HEALTH = 'https://www.scrutinise.org/api/health'
/** How many differently-worded probes to try before calling a collection's tier UNREAD. */
const PROBE_TRIES = 6

interface Hit { id: string; corpus: string; tier: string; sectionTitle: string | null; score: number }

async function fts(query: string, limit: number, corpora?: string[]): Promise<{ hits: Hit[]; echoed: string[] | null }> {
  const res = await fetch(`${FTS}/fts-search`, {
    method: 'POST', headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ query, limit, ...(corpora ? { corpora } : {}) }),
  })
  if (!res.ok) throw new Error(`FTS ${res.status}: ${(await res.text()).slice(0, 200)}`)
  const j = (await res.json()) as { results?: Hit[]; corpora?: string[] | null }
  return { hits: j.results ?? [], echoed: j.corpora ?? null }
}

/** Words worth searching with, out of a title or a body. Stopwords out, short tokens out — a probe
 *  of "the of and" matches everything and tells you nothing about this collection. */
const STOP = new Set('the of and to in a for on with by is are was were be been at as that this it from or not no its their his her they we you i any all such other than then which who whom what when where how'.split(' '))
function probeTerms(s: string | null): string {
  return (s ?? '').replace(/[^\p{L}\p{N}\s]/gu, ' ').split(/\s+/)
    .filter((w) => w.length >= 4 && !STOP.has(w.toLowerCase())).slice(0, 8).join(' ')
}

interface CollectionRow {
  corpus: string
  /** Rows in `corpus_sections`. 0 with `inIndex: true` is the orphan state — see header note 5. */
  sections: number
  /** Where the NAME came from: the database, the previous artefact, or an unscoped discovery probe. */
  nameSources: string[]
  /** Tier READ BACK OFF THE SERVED INDEX. null = no row came back from any of the three probe
   *  stages, which is reported as UNREAD and is not the same as `other`. */
  servedTier: string | null
  /** WHICH probe stage answered — the first version reported a false UNREAD because it had only
   *  one stage and the collection's titles are all blank. */
  tierSource: 'title' | 'id' | 'generic' | 'UNREAD'
  probesTried: number
  prefilterHonoured: boolean
  /** Display types the adapter yields, evaluated over the ids that came back FROM THE INDEX. */
  types: string[]
  nullTypeShare: number
  /** Of the ids the index returned, how many exist in `corpus_sections`. A collection at 0 is
   *  retrievable and unhydratable: the product returns a card titled with the corpus name. */
  hydrates: { checked: number; found: number } | null
  admittedBy: string[]
  admittedByV2: string[]
  verdict: string
  note: string | null
}

/** Four phrases common enough to return something from ANY collection once the corpus prefilter
 *  has removed the competition. The last-resort stage, and the one that rescued a 69,529-section
 *  collection from a false UNREAD. */
const GENERIC_PROBES = ['the government', 'question answer minister', 'report committee house', 'act section regulation']

async function sweepCollections(): Promise<CollectionRow[]> {
  // ── the union of three name sources ──────────────────────────────────────────────────────────
  const counts = await prisma.$queryRawUnsafe<Array<{ corpus: string; n: bigint }>>(
    `SELECT corpus, count(*) AS n FROM corpus_sections GROUP BY corpus ORDER BY corpus`)
  const sectionsOf = new Map(counts.map((c) => [c.corpus, Number(c.n)]))
  const sources = new Map<string, Set<string>>()
  const note = (c: string, s: string) => { (sources.get(c) ?? sources.set(c, new Set()).get(c)!).add(s) }
  for (const c of counts) note(c.corpus, 'neon')

  // NAMES ONLY out of the previous artefact. ⚠ Its tiers and verdicts are 2026-08-20 and S11's
  // re-tier landed on the 21st — reading either would reproduce exactly the staleness S16 was
  // wrong about. The name list is the one part of it that cannot go stale in a way that matters.
  //
  // ⚠⚠ THE FIELD IS `collection`, NOT `corpus`, AND READING THE WRONG ONE COST A RUN. The first
  // version read `r.corpus`, found nothing, and printed "+0 from the artefact" — which reads as
  // "the artefact agreed" and actually meant "the artefact was never read". A source that
  // contributes zero and a source that failed to load must not print the same line, so each
  // source's OFFERED count is printed below, not just the delta.
  let artefactOffered = 0
  try {
    const prev = JSON.parse(fs.readFileSync(path.join(__dirname, '../../docs/corpus_reachability.json'), 'utf8')) as any
    const list = (prev.rows ?? prev.collections ?? []) as any[]
    for (const r of list) {
      const name = r?.collection ?? r?.corpus
      if (name) { artefactOffered++; note(String(name), 'artefact') }
    }
    if (!artefactOffered) console.log('  ⚠⚠ docs/corpus_reachability.json parsed but offered 0 names — the shape has changed; this source is NOT contributing')
  } catch (e) { console.log(`  ⚠⚠ docs/corpus_reachability.json unreadable (${(e as Error).message}) — the artefact name source contributed nothing`) }

  // Discovery: whatever the served index hands back, unscoped.
  let discoveryOffered = 0
  for (const q of ['the government said', 'regulation section act', 'committee evidence witness',
    'court judgment appeal', 'guidance policy statement', 'treaty agreement ratification',
    'petition signatures debate', 'impact assessment cost benefit']) {
    try { for (const h of (await fts(q, 200)).hits) { discoveryOffered++; note(h.corpus, 'discovery') } } catch { /* reported by the caller */ }
  }

  const names = [...sources.keys()].sort()
  const onlyIndex = names.filter((n) => !sectionsOf.has(n))
  console.log(`  names to probe: ${names.length}`)
  console.log(`    neon      offered ${counts.length} distinct collections`)
  console.log(`    artefact  offered ${artefactOffered} rows (docs/corpus_reachability.json, generated 2026-08-20 — NAMES ONLY)`)
  console.log(`    discovery offered ${discoveryOffered} hits over 8 unscoped probes`)
  console.log(`    ▶ ${onlyIndex.length} names are NOT in corpus_sections at all: ${onlyIndex.join(', ') || '(none)'}`)
  console.log(`    ⚠ a collection in the index under a name none of these three sources knows would still be missed;`)
  console.log(`      closing that needs a full index scan (scripts/ingest/search/corpus-reachability.ts), which this does not do.\n`)

  const rows: CollectionRow[] = []
  for (const corpus of names) {
    if (ONLY.length && !ONLY.includes(corpus)) continue
    const n = sectionsOf.get(corpus) ?? 0
    // Probe words out of the collection's OWN rows — sampled by md5(id) so the sample is not the
    // head of an id-ordered scan (feedback-id-order-is-not-random: tna-caselaw ids BEGIN with the
    // citation, so ORDER BY id gave a 400-row pilot that was entirely from 2003).
    const samples = n ? await prisma.$queryRawUnsafe<Array<{ id: string; t: string | null }>>(
      `SELECT id, "sectionTitle" AS t FROM corpus_sections WHERE corpus = $1 ORDER BY md5(id) LIMIT $2`,
      corpus, PROBE_TRIES * 2) : []
    const stages: Array<{ stage: 'title' | 'id' | 'generic'; q: string }> = [
      ...samples.map((s) => ({ stage: 'title' as const, q: probeTerms(s.t) })).filter((x) => x.q),
      ...samples.map((s) => ({ stage: 'id' as const, q: probeTerms(s.id.split(':').slice(1).join(' ').replace(/[/_-]/g, ' ')) })).filter((x) => x.q),
      ...GENERIC_PROBES.map((q) => ({ stage: 'generic' as const, q })),
    ]
    let servedTier: string | null = null
    let tierSource: CollectionRow['tierSource'] = 'UNREAD'
    let prefilterHonoured = true
    let tried = 0
    const idsBack: string[] = []
    for (const s of stages) {
      tried++
      let hits: Hit[]; let echoed: string[] | null
      try { ({ hits, echoed } = await fts(s.q, 20, [corpus])) } catch { continue }
      if (echoed && !echoed.includes(corpus)) prefilterHonoured = false
      const mine = hits.filter((h) => h.corpus === corpus)
      if (mine.length) {
        if (!servedTier) { servedTier = mine[0].tier; tierSource = s.stage }
        for (const h of mine) if (idsBack.length < 40) idsBack.push(h.id)
      }
      if (servedTier && idsBack.length >= 10) break
      if (tried >= PROBE_TRIES * 3) break
    }

    // ⚠ THE HYDRATION COLUMN. Ids taken FROM THE INDEX, looked up in the DATABASE — the direction
    // matters: asking the database first could never find a row the database does not have.
    let hydrates: CollectionRow['hydrates'] = null
    if (idsBack.length) {
      const found = await prisma.$queryRawUnsafe<Array<{ id: string }>>(
        `SELECT id FROM corpus_sections WHERE id = ANY($1::text[])`, idsBack.slice(0, 20))
      hydrates = { checked: Math.min(idsBack.length, 20), found: found.length }
    }

    const typed = idsBack.map((id) => (servedTier ? corpusToType(corpus, servedTier, id) : null))
    const types = [...new Set(typed.filter(Boolean) as SearchResultType[])].sort()
    const nullTypeShare = typed.length ? typed.filter((t) => t === null).length / typed.length : 1
    const admits = (scopes: StreamScope[]) => {
      if (!servedTier) return []
      const names = new Set<string>()
      for (const t of (types.length ? types : [null])) {
        for (const s of scopes) if (streamCanSelect(s, corpus, servedTier, t as SearchResultType | null)) names.add(s.name)
      }
      return [...names].sort()
    }
    const admittedBy = admits(STREAM_SCOPES)
    const admittedByV2 = admits([...STREAM_SCOPES, ...STREAM_SCOPES_V2])

    let verdict: string
    let note: string | null = null
    if (!prefilterHonoured) { verdict = 'PREFILTER-NOT-HONOURED'; note = 'fts-serve did not echo the corpus prefilter; this row is not a measurement' }
    else if (!servedTier) { verdict = 'TIER-UNREAD'; note = `no row came back from ${tried} probes across all three stages (title, id, generic)` }
    else if (corpus in EXCLUDED_BY_DESIGN) { verdict = 'excluded-by-design'; note = (EXCLUDED_BY_DESIGN as Record<string, string>)[corpus] }
    else if (!types.length) { verdict = 'UNREACHABLE'; note = 'every sampled id types null — the FTS adapter drops the row before any stream sees it' }
    // ⚠ ORPHAN IS TESTED BEFORE REACHABLE, because both are true of the same collection and only
    // this order says the consequential thing. "Reachable" would be the flattering half.
    else if (hydrates && hydrates.found === 0 && admittedBy.length) {
      verdict = 'ORPHANED-IN-INDEX'
      note = `admitted by [${admittedBy.join(',')}] and 0 of ${hydrates.checked} returned ids exist in corpus_sections — the product returns a card titled with the corpus name, no citation, no date, no URL`
    }
    else if (admittedBy.length) { verdict = 'reachable'; note = hydrates && hydrates.found < hydrates.checked ? `⚠ only ${hydrates.found} of ${hydrates.checked} returned ids hydrate` : null }
    else if (corpus in DEFERRED_TO_GRAPH) { verdict = 'deferred-to-graph'; note = (DEFERRED_TO_GRAPH as Record<string, string>)[corpus] }
    else { verdict = 'keyword-only'; note = 'no router stream admits it; it surfaces only when routing is off or has failed open' }

    rows.push({
      corpus, sections: n, nameSources: [...(sources.get(corpus) ?? [])].sort(),
      servedTier, tierSource, probesTried: tried, prefilterHonoured,
      types: types as string[], nullTypeShare, hydrates, admittedBy, admittedByV2, verdict, note,
    })
    console.log(
      `  ${corpus.padEnd(26)} ${String(n).padStart(9)}  tier=${(servedTier ?? 'UNREAD').padEnd(14)}(${tierSource.padEnd(7)})` +
      ` type=${(types.join('/') || 'NONE').padEnd(22)} streams=[${(admittedBy.join(',') || 'NONE').padEnd(11)}]` +
      ` hydr=${hydrates ? `${hydrates.found}/${hydrates.checked}` : '  —'}  ${verdict}${note ? ` — ${note}` : ''}`)
  }
  return rows
}

// ════════════════════════════════════════════════════════════════════════════════════════════════
// §1.3 — the router, rolled over every validated question
// ════════════════════════════════════════════════════════════════════════════════════════════════
interface Q { id: string; collection: string; question: string; keys: string[] }
function questions(): Q[] {
  const a: Q[] = GOLD_CORPUS.filter((q) => q.verdict === 'ACCEPT' && q.scoring !== 'negative-control')
    .map((q) => ({ id: `S10-Q${q.n}`, collection: q.collection, question: q.question, keys: q.keys }))
  const b: Q[] = GOLD_V2.filter((q) => q.scoring === 'recall')
    .map((q) => ({ id: `V2-${q.id}`, collection: q.collection ?? 'unknown', question: q.query, keys: q.keys }))
  return [...a, ...b]
}

/** Which stream would have to be routed for a key to be reachable — computed from the key's own
 *  collection with the served tier from the sweep, never assumed from the collection's label. */
function streamsThatCouldAnswer(keys: string[], byCorpus: Map<string, CollectionRow>): string[] {
  const out = new Set<string>()
  for (const k of keys) {
    const row = byCorpus.get(k.split(':')[0])
    for (const s of row?.admittedBy ?? []) out.add(s)
  }
  return [...out].sort()
}

async function main() {
  if (!FTS) throw new Error('FTS_SEARCH_URL is not set — §1.1 cannot probe the served index at all')

  // ⚠ Production's flag string, read off the running site. A number taken here under a local .env
  // is not a number about production, and CLAUDE.md §19 says the difference must be visible in the
  // same sentence rather than in a footnote.
  let prod: Record<string, unknown> | null = null
  try { prod = (await (await fetch(HEALTH)).json()) as Record<string, unknown> } catch { /* reported below */ }
  const served = (await (await fetch(`${FTS}/stats`)).json()) as Record<string, unknown>

  console.log('── S19 §1 · THE REACH SWEEP ──')
  console.log(`  local flags   : ${capabilityLine()}`)
  console.log(`  production    : ${prod ? `commit=${String(prod.commit).slice(0, 7)} flags=${JSON.stringify(prod.capabilities)}` : '⚠ /api/health UNREADABLE — production configuration is NOT established by this run'}`)
  console.log(`  fts-serve     : ${FTS}  build=${served.build} served=${served.served} uptime_s=${served.uptime_s}`)
  console.log(`  ⚠ every tier below is READ BACK OFF THAT SERVICE, one collection at a time, using`)
  console.log(`    words taken from the collection's own titles. Nothing here is read from a map.\n`)

  console.log('── §1.1 · EVERY COLLECTION, PROBED ──')
  const rows = await sweepCollections()
  const byCorpus = new Map(rows.map((r) => [r.corpus, r]))

  const tally: Record<string, { n: number; sections: number }> = {}
  for (const r of rows) {
    const t = (tally[r.verdict] ??= { n: 0, sections: 0 })
    t.n++; t.sections += r.sections
  }
  console.log('\n── §1.1 · BY VERDICT ──')
  for (const [v, t] of Object.entries(tally).sort((a, b) => b[1].sections - a[1].sections)) {
    console.log(`  ${v.padEnd(24)} ${String(t.n).padStart(3)} collections   ${t.sections.toLocaleString().padStart(12)} sections`)
  }
  const total = rows.reduce((a, r) => a + r.sections, 0)
  const reach = rows.filter((r) => r.verdict === 'reachable').reduce((a, r) => a + r.sections, 0)
  console.log(`  ▶ ${reach.toLocaleString()} of ${total.toLocaleString()} database sections (${((100 * reach) / total).toFixed(2)}%) sit in a collection some router stream can select.`)
  const orphans = rows.filter((r) => r.verdict === 'ORPHANED-IN-INDEX')
  if (orphans.length) {
    console.log(`  ⚠⚠ AND THAT PERCENTAGE IS TAKEN OVER THE DATABASE, WHICH CANNOT SEE ${orphans.length} COLLECTIONS:`)
    console.log(`     ${orphans.map((o) => o.corpus).join(', ')}`)
    console.log(`     They are in the SERVED INDEX, admitted by real streams, and hold 0 rows in corpus_sections.`)
    console.log(`     Their size is unknown from here — counting them needs a full index scan. INGEST FINDING, not fixed here.`)
  }
  // ⚠ THE TOTALITY GUARD (§1.2 option D). Every collection is either admitted by a stream, or
  // named in a register with a reason. A collection admitted by nothing and named nowhere is the
  // failure this whole section exists to make impossible to reach by accident.
  const unowned = rows.filter((r) => !r.admittedBy.length && !(r.corpus in EXCLUDED_BY_DESIGN) && !(r.corpus in DEFERRED_TO_GRAPH) && r.verdict !== 'TIER-UNREAD')
  console.log(`\n── §1.2 TOTALITY · collections admitted by NO stream and named in NO register ──`)
  if (!unowned.length) console.log('  (none)')
  for (const u of unowned) console.log(`  ⚠ ${u.corpus.padEnd(26)} ${String(u.sections).padStart(8)} sections  tier=${u.servedTier} type=${u.types.join('/')} — nothing can return it and nobody wrote down that this was intended`)

  // ── §1.3 ──────────────────────────────────────────────────────────────────────────────────────
  const routing: Array<Record<string, unknown>> = []
  if (!has('no-router') && process.env.GEMINI_API_KEY) {
    console.log(`\n── §1.3 · THE STREAMS THE ROUTER CHOSE, PER QUESTION (${REPEAT} rolls each, LEX_ROUTER_STREAMS_V2=false as in production) ──`)
    process.env.LEX_ROUTER_STREAMS_V2 = 'false'
    for (const q of questions()) {
      const could = streamsThatCouldAnswer(q.keys, byCorpus)
      const rolls: string[][] = []
      let failOpen = 0
      for (let i = 0; i < REPEAT; i++) {
        const d = await routeQueryDetailed(q.question.trim().split(/\s+/).filter(Boolean), '')
        if (!d?.route) { failOpen++; rolls.push([]) } else rolls.push(Object.keys(d.route as Record<string, string>))
      }
      // "Routed" means: on this roll the model named at least one stream that ADMITS one of the
      // question's keys. Naming a stream that cannot reach the key is not routing to it.
      const hitRolls = rolls.filter((r) => r.some((s) => could.includes(s))).length
      const cls = could.length === 0 ? 'NO-STREAM-ADMITS-THE-KEY'
        : hitRolls === 0 ? 'NOT-ROUTED'
          : hitRolls < REPEAT ? 'INTERMITTENT'
            : 'ROUTED'
      routing.push({ id: q.id, collection: q.collection, question: q.question, couldAnswer: could, rolls, failOpen, hitRolls, repeat: REPEAT, cls })
      console.log(`  ${q.id.padEnd(9)} ${q.collection.padEnd(19)} ${cls.padEnd(24)} ${hitRolls}/${REPEAT}  needs=[${could.join(',') || 'NONE'}]`)
      console.log(`            rolls: ${rolls.map((r) => r.join('+') || 'FAIL-OPEN').join('  |  ')}`)
    }
    const clsTally: Record<string, number> = {}
    for (const r of routing) clsTally[r.cls as string] = (clsTally[r.cls as string] ?? 0) + 1
    console.log(`\n  ▶ ${JSON.stringify(clsTally)}   over ${routing.length} questions × ${REPEAT} rolls`)
  } else {
    console.log('\n── §1.3 · SKIPPED (--no-router or no GEMINI_API_KEY) — reported as NOT RUN, not omitted ──')
  }

  fs.mkdirSync(path.dirname(OUT), { recursive: true })
  fs.writeFileSync(OUT, JSON.stringify({
    takenAt: new Date().toISOString(),
    localFlags: capabilityLine(),
    productionHealth: prod,
    ftsServe: { url: FTS, build: served.build, served: served.served, uptime_s: served.uptime_s },
    probeTries: PROBE_TRIES,
    collections: rows,
    byVerdict: tally,
    routing: routing.length ? routing : null,
    routingRun: routing.length > 0,
  }, null, 2))
  console.log(`\n  → ${path.relative(process.cwd(), OUT)}`)
  await prisma.$disconnect()
}
main().catch((e) => { console.error(e); process.exit(1) })
