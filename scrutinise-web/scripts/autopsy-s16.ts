/**
 * autopsy-s16.ts — S16 §2. WHY DOES EACH OF THE 32 FAILING QUESTIONS FAIL?
 *
 * ⚠⚠ THIS IS THE SPRINT. Not a summary statistic — a table, one row per failing question, each
 * classified by PROBING rather than by reasoning. Nobody has ever looked at these one at a time,
 * and the class distribution decides the next three sprints: a guess at it would misdirect all
 * three.
 *
 * The six classes, from BRIEF_SEARCH_S16 §2, and the order they are tested in — which matters,
 * because several are true at once and the FIRST one that applies is the one that must be fixed:
 *
 *   1 ABSENT      the answer key is not in `corpus_sections`, or its stored body is a placeholder.
 *                 ⚠ AN INGEST FINDING, NOT A SEARCH FAILURE. Reported separately so it cannot
 *                 contaminate the search number — and a search sprint that "fixed" this by
 *                 loosening matching would have made the platform worse.
 *   2 UNREACHABLE in the corpus, in a collection NO stream admits. Nothing routed can find it.
 *   3 NOT-ROUTED  in the corpus and reachable, but the stream that admits it was not routed for
 *                 this question.
 *   4 RANKING     retrieved by its stream and ranked at or beyond 20 in that stream's own list.
 *   5 NOT-MATCHED the right stream WAS searched, the document IS reachable, and it still did not
 *                 come back at all — a query/matching failure (§4).
 *   6 UNIT        the key is a long document scored as a whole while the answer is a paragraph
 *                 inside it. Reported as a MODIFIER on 4/5 rather than a class of its own,
 *                 because it is a property of the document, not of what the retriever did.
 *
 * ⚠ EVERY LINE STATES WHAT IT COUNTED (§1's standing rule). "Absent" means a row count of 0 from
 * `corpus_sections`, not an inference from a 404. "Unreachable" is computed from the live
 * `STREAM_SCOPES`, not from memory of which streams exist.
 *
 * ⚠ THE INPUT IS S15'S ARMS FILE, whose own metadata records the flag string and the degraded
 * state (`degraded: []`, `streams=legislation,caselaw,guidance,committees`). This script REFUSES
 * to run against a degraded artefact — S14's numbers were read for a fortnight as though dense
 * retrieval were live when its own file said `streams=NONE … DEGRADED(1)`, and that must not be
 * possible twice.
 *
 * Usage:
 *   tsx --env-file=.env --tsconfig tsconfig.json scripts/autopsy-s16.ts [--json ../docs/census/s16-autopsy.json]
 */
import fs from 'node:fs'
import path from 'node:path'
import { Prisma } from '@prisma/client'
import { prisma } from '../lib/prisma'
import { STREAM_SCOPES, STREAM_SCOPES_V2, type StreamScope } from '../lib/lex/stream-scopes'
import { corpusToType } from '../lib/lex/corpus-type-map'

const ARMS = path.join(__dirname, '../../docs/census/s15-arms.json')
/**
 * ⚠ THE TIER COMES FROM `corpus_reachability.json`, AND THAT IS DELIBERATE.
 *
 * `corpus_sections` has NO tier column — tier is a property of the INDEX, baked in at build time.
 * `stream-scopes.ts` says so in terms: *"Matched against the tier BAKED INTO THE INDEX at build
 * time — not against `tierFor(corpus)` as it reads today. A corpus seeded after the tier map last
 * changed carries the OLD tier in the live index, and the router filters on the index."*
 *
 * `corpus-reachability.ts` already measures that by scanning `corpus_fts` and `corpus_vec` and
 * projecting (corpus, tier). This reads its artefact rather than recomputing (two full scans of
 * 18M and 22M rows) or — far worse — deriving the tier from the corpus name and producing a table
 * that says a collection is reachable when the live index has it somewhere no stream can see.
 *
 * ⚠ ONLY the tier is taken from the artefact. `router_stream` is RECOMPUTED here from the LIVE
 * `STREAM_SCOPES`, so a scope change since the artefact was generated is reflected rather than
 * inherited. The artefact's own date is printed on every run.
 */
const REACH = path.join(__dirname, '../../docs/corpus_reachability.json')
const jsonOut = process.argv.includes('--json') ? process.argv[process.argv.indexOf('--json') + 1] : null

type Cls = 'ABSENT' | 'UNREACHABLE' | 'NOT-ROUTED' | 'RANKING' | 'NOT-MATCHED'

interface KeyFact {
  id: string
  corpus: string | null
  tier: string | null
  chars: number
  words: number
  /** ⚠ A stored body of dot leaders is how legislation.gov.uk renders a REPEALED provision, and
   *  it counts as ABSENT: there is no text to retrieve. Measured, not guessed. */
  hollow: boolean
  status: string | null
  /** How many rows of this collection are in the FTS index at all — 0 means indexed nowhere. */
  indexedRows: number
  admittedBy: string[]
  admittedByV2: string[]
}

/** Does this stream's scope admit a row with this corpus and tier? Computed from the live scope
 *  objects so a scope change re-runs this correctly rather than dating the report. */
function admits(s: StreamScope, corpus: string, tier: string, id: string): boolean {
  if (s.tier !== tier) return false
  if (s.corpora?.length && !s.corpora.includes(corpus)) return false
  if (s.excludeCorpora?.length && s.excludeCorpora.includes(corpus)) return false
  if (s.types?.length) {
    const t = corpusToType(corpus, tier, id)
    if (!t || !s.types.includes(t)) return false
  }
  return true
}

async function main() {
  const arms = JSON.parse(fs.readFileSync(ARMS, 'utf8'))

  // ── the refusal that S14 earns ────────────────────────────────────────────
  if (!Array.isArray(arms.degraded) || arms.degraded.length) {
    console.error('⛔ REFUSING: the arms artefact records a DEGRADED run:')
    console.error('   ' + JSON.stringify(arms.degraded))
    console.error('   Classifying failures from a degraded retrieval pass would attribute the')
    console.error('   degradation to the corpus. Re-take the baseline first.')
    process.exit(2)
  }
  console.log('── S16 §2 AUTOPSY ──')
  console.log(`  source   ${path.basename(ARMS)}  taken ${arms.takenAt}`)
  console.log(`  config   ${arms.config}`)
  console.log(`  degraded ${JSON.stringify(arms.degraded)}   n=${arms.n}`)

  const reach = JSON.parse(fs.readFileSync(REACH, 'utf8'))
  const tierOfCorpus = new Map<string, string>(reach.rows.map((r: any) => [r.collection, r.tier]))
  const ftsRowsOf = new Map<string, number>(reach.rows.map((r: any) => [r.collection, r.fts_rows ?? 0]))
  console.log(`  tiers    ${path.basename(REACH)} generated ${reach.generatedAt} — tier read from the INDEX, reachability recomputed live\n`)

  const rows: any[] = arms.rows
  const failing = rows.filter((r) => !r.foundInStream || r.inStream < 0 || r.inStream >= 20)
  console.log(`  failing in-stream@20: ${failing.length} of ${rows.length}\n`)

  // One database round trip for every key of every failing question.
  // ⚠ `wordCount` is the stored column; the TEXT itself lives in R2 (docs/CLAUDE.md storage
  // architecture), so this counts what ingest recorded rather than re-reading bodies.
  const allKeys = Array.from(new Set(failing.flatMap((r) => r.keys as string[])))
  const found = await prisma.$queryRaw<Array<{ id: string; corpus: string; words: number | null; status: string; r2Key: string | null }>>`
    SELECT s.id, s.corpus, s."wordCount" AS words, s.status, s."r2Key"
    FROM corpus_sections s
    WHERE s.id IN (${Prisma.join(allKeys)})`
  const factOf = new Map<string, KeyFact>()
  for (const k of allKeys) {
    const hit = found.find((f) => f.id === k)
    const corpus = hit?.corpus ?? null
    const tier = corpus ? (tierOfCorpus.get(corpus) ?? null) : null
    const words = Number(hit?.words ?? 0)
    // ⚠ HOLLOW: present as a row but with no usable text. Two independent signs, both measured:
    // an unusable `status`, or a word count under the playbook's hollow floor. `uksi/1999/303`
    // is the worked example — 137 sections that are all `1 . . . . . .`, how the source renders a
    // REPEALED provision. A row that exists and says nothing is ABSENT for retrieval purposes.
    const hollow = !!hit && (words < 15 || hit.status !== 'compiled' || !hit.r2Key)
    factOf.set(k, {
      id: k, corpus, tier, chars: 0, words, hollow,
      status: hit?.status ?? null,
      indexedRows: corpus ? (ftsRowsOf.get(corpus) ?? 0) : 0,
      admittedBy: corpus && tier ? STREAM_SCOPES.filter((s) => admits(s, corpus, tier, k)).map((s) => s.name) : [],
      admittedByV2: corpus && tier ? STREAM_SCOPES_V2.filter((s) => admits(s, corpus, tier, k)).map((s) => s.name) : [],
    })
  }

  interface Out {
    id: string; collection: string; question: string; inStream: number; routed: string[]
    key: string; corpus: string | null; words: number
    admittedBy: string[]; admittedByV2: string[]
    cls: Cls; unitModifier: boolean; note: string
  }
  const out: Out[] = []

  for (const r of failing) {
    // Take the BEST key: a question with two keys fails only if EVERY key fails, and the least-bad
    // one is the honest one to classify. Classifying the worst key would over-report ABSENT.
    const facts = (r.keys as string[]).map((k) => factOf.get(k)!)
    const live = facts.filter((f) => f.corpus && !f.hollow)
    const best = live[0] ?? facts.find((f) => f.corpus) ?? facts[0]

    let cls: Cls
    let note = ''
    if (!live.length) {
      cls = 'ABSENT'
      note = facts.every((f) => !f.corpus)
        ? `no row in corpus_sections for ${facts.length} key(s): ${facts.map((f) => f.id).join(' , ')}`
        : `row present, no usable text — ${facts.map((f) => `${f.words}w/${f.status ?? 'no-row'}`).join(', ')}`
    } else if (!best.admittedBy.length) {
      cls = 'UNREACHABLE'
      note = `corpus '${best.corpus}' (tier ${best.tier}) is admitted by NO stream${best.admittedByV2.length ? `; V2 stream '${best.admittedByV2.join(',')}' would admit it` : ''}`
    } else if (!best.admittedBy.some((s) => (r.routed as string[]).includes(s))) {
      cls = 'NOT-ROUTED'
      note = `admitted by [${best.admittedBy.join(', ')}] but routed [${(r.routed as string[]).join(', ')}]${best.admittedByV2.length ? ` — V2 '${best.admittedByV2.join(',')}' covers it` : ''}`
    } else if (r.inStream >= 20) {
      cls = 'RANKING'
      note = `retrieved by '${r.foundInStream}' at in-stream rank ${r.inStream} — outside the 20-window`
    } else {
      cls = 'NOT-MATCHED'
      note = `stream '${best.admittedBy.filter((s) => (r.routed as string[]).includes(s)).join(',')}' WAS searched and returned ${r.total} results; the key was not among them`
    }
    // ⚠ A MODIFIER, NOT A CLASS. A long document scored whole while the answer is one paragraph
    // is the shape the argument work exists to fix, and it can coexist with NOT-MATCHED/RANKING.
    const unitModifier = (cls === 'NOT-MATCHED' || cls === 'RANKING') && best.words >= 1500

    out.push({
      id: r.id, collection: r.collection, question: r.query, inStream: r.inStream,
      routed: r.routed, key: best.id, corpus: best.corpus, words: best.words,
      admittedBy: best.admittedBy, admittedByV2: best.admittedByV2, cls, unitModifier, note,
    })
  }

  // ── the table ─────────────────────────────────────────────────────────────
  const order: Cls[] = ['ABSENT', 'UNREACHABLE', 'NOT-ROUTED', 'RANKING', 'NOT-MATCHED']
  out.sort((a, b) => order.indexOf(a.cls) - order.indexOf(b.cls) || a.collection.localeCompare(b.collection) || a.id.localeCompare(b.id))

  console.log('  id        collection          class         unit  words   question')
  for (const o of out) {
    console.log(
      `  ${o.id.padEnd(9)} ${o.collection.padEnd(19)} ${o.cls.padEnd(13)} ${(o.unitModifier ? ' ⚠ ' : '   ').padEnd(5)} ` +
      `${String(o.words).padStart(6)}  ${o.question.slice(0, 62)}`)
    console.log(`            ↳ ${o.note}`)
  }

  console.log('\n  ── CLASS DISTRIBUTION (n = ' + out.length + ') ──')
  for (const c of order) {
    const n = out.filter((o) => o.cls === c).length
    if (!n) continue
    const colls = Object.entries(out.filter((o) => o.cls === c).reduce((a: any, o) => { a[o.collection] = (a[o.collection] || 0) + 1; return a }, {}))
      .map(([k, v]) => `${k} ${v}`).join(' · ')
    console.log(`  ${c.padEnd(13)} ${String(n).padStart(3)}   ${colls}`)
  }
  const unit = out.filter((o) => o.unitModifier).length
  console.log(`  ${'(unit modifier)'.padEnd(13)} ${String(unit).padStart(3)}   long documents scored whole — the argument work's territory`)

  console.log('\n  ── WHO OWNS EACH CLASS (§5) ──')
  const owned = (c: Cls) => out.filter((o) => o.cls === c).length
  console.log(`  ingest          ${owned('ABSENT')}   ABSENT — the document is not in the corpus, or is a placeholder`)
  console.log(`  search          ${owned('UNREACHABLE') + owned('NOT-ROUTED') + owned('RANKING')}   UNREACHABLE + NOT-ROUTED + RANKING`)
  console.log(`  search/argument ${owned('NOT-MATCHED')}   NOT-MATCHED — query and matching, ${unit} of them on long documents`)

  if (jsonOut) {
    // Relative to the CWD the operator typed it from, not to this file's directory — the latter
    // silently wrote into scrutinise-web/docs/ and then failed on a directory that does not exist.
    const p = path.resolve(process.cwd(), jsonOut)
    fs.writeFileSync(p, JSON.stringify({
      takenAt: new Date().toISOString(),
      source: path.basename(ARMS), sourceConfig: arms.config, sourceDegraded: arms.degraded,
      n: arms.n, failing: out.length, rows: out,
    }, null, 2))
    console.log(`\n  wrote ${jsonOut}`)
  }
  await prisma.$disconnect()
}
main().catch(async (e) => { console.error('FAILED', e); await prisma.$disconnect(); process.exit(1) })
