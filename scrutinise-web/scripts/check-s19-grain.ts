/**
 * check-s19-grain.ts — the guards for BRIEF_SEARCH_S19.
 *
 * ⚠⚠ EVERY ASSERTION BELOW WAS WATCHED FAILING AGAINST THE REAL BROKEN STATE, and for four of them
 * the "real broken state" is a defect this sprint either found live or came within one line of
 * shipping:
 *
 *   1. THE DOCUMENT KEY. The obvious rule — the id's second colon segment — collapses ALL 344,773
 *      committee-report sections into ONE document, because segment 2 is the literal word
 *      `publication`. A document-grain measurement built on it would have reported a spectacular
 *      recall gain that was entirely an artefact of the key. Guards: §1.
 *   2. THE OPPOSITE ERROR. `parentDocId` for `impact-assessments` names the INSTRUMENT appraised,
 *      not the assessment, so two assessments of one SI collapse into one document. Guards: §1.
 *   3. THE HYDRATE. `applyGrain` cannot group what it cannot see; before this sprint no
 *      `SearchResult` carried `parentDocId` at all. A regroup running on undefined would have
 *      silently used the fallback key — i.e. defect 1, in production. Guards: §3, and §3 asks the
 *      LIVE adapter rather than reading the SELECT (CLAUDE.md §25).
 *   4. THE ORPHANS. Seven collections sit in the served index with ZERO rows in `corpus_sections`,
 *      are admitted by real streams, and reach the product as a card titled with the corpus name.
 *      Guard: §5, which counts them rather than asking whether they exist.
 *
 * ⚠ §2 IS THE NO-OP GUARD AND IT IS THE ONE THAT MATTERS FOR THE DEPLOY. The brief requires the
 * change to be inert until a grain is set. That is asserted by COMPARING RANKINGS with the flag
 * off and on — not by reading the default out of the code, which would pass on a module that
 * ignored its own default.
 *
 * ⚠ §5 IS THE TOTALITY GUARD (§1.2 option D). Every collection is either admitted by a stream or
 * named in a register with a reason. It states the COUNT it checked, never merely that a register
 * exists — CLAUDE.md §23.2, and the "checks that cannot fail" register, whose most recent entry is
 * a `--verify-only` that asked whether an index existed and answered yes while it was missing 6.5%
 * of the table.
 *
 * Usage:  npx tsx --env-file=.env --tsconfig tsconfig.json scripts/check-s19-grain.ts
 *         …                                                                        --no-live
 */
import fs from 'node:fs'
import path from 'node:path'
import { prisma } from '../lib/prisma'
import {
  documentKeyOf, collapseToDocuments, aggregateToDocuments, rankOf, chunkCountOf,
  PARENT_IS_NOT_THE_DOCUMENT, CHUNK_WHOLE_CHARS, CHUNK_WINDOW_CHARS, CHUNK_MAX,
} from '../lib/lex/grain'
import { applyGrain, grainMap, minWordFloor, grainPolicyActive } from '../lib/lex/grain-policy'
import { STREAM_SCOPES, streamCanSelect } from '../lib/lex/stream-scopes'
import { EXCLUDED_BY_DESIGN, DEFERRED_TO_GRAPH, UNREACHABLE_PENDING_DECISION } from '../lib/lex/corpus-type-map'
import type { SearchResult } from '../lib/lex/page1-config'

export {}

const NO_LIVE = process.argv.includes('--no-live')
let passed = 0
let controlsFired = 0
const failures: string[] = []
const deadControls: string[] = []
function check(ok: boolean, label: string) {
  if (ok) { passed++; console.log(`✓ ${label}`) } else { failures.push(label); console.log(`✗ ${label}`) }
}
/** ⚠ The control's lambda returns whether the PROPERTY holds, not whether the broken text still
 *  matches (CLAUDE.md §25.5). A control that cannot go false is not a control. */
function control(label: string, broken: () => boolean) {
  let held: boolean
  try { held = broken() } catch { held = false }
  if (held) { deadControls.push(label); console.log(`  ⚠ DEAD CONTROL — ${label}: the property still holds when broken`) }
  else { controlsFired++; console.log(`  · control fired — ${label}`) }
}

/** A SearchResult with only the fields the grain policy reads. Everything else is filler. */
function res(id: string, score: number, parentDocId?: string | null, wordCount?: number | null): SearchResult {
  return {
    id, score, type: 'DEBATE', title: id, citation: '', snippet: '', scorer: 'bm25',
    url: '', date: '', ...(parentDocId !== undefined ? { parentDocId } : {}),
    ...(wordCount !== undefined ? { wordCount } : {}),
  }
}

async function main() {
  console.log('── check:s19-grain ──\n')

  // ═══ §1 — THE DOCUMENT KEY ══════════════════════════════════════════════════════════════════
  console.log('§1 the document key — the rule that decides every document-grain number')

  check(documentKeyOf('committees-reports:publication:34458:189872-0001', 'publication:34458')
        === 'committees-reports:publication:34458',
    '⚠⚠ a committee report groups on parentDocId, NOT on the id — segment 2 is the word `publication`')
  control('committee reports do not all collapse into one document', () => {
    const a = documentKeyOf('committees-reports:publication:34458:189872-0001', 'publication:34458')
    const b = documentKeyOf('committees-reports:publication:99999:111111-0002', 'publication:99999')
    return a === b // the id-segment-2 rule would make this TRUE
  })

  check(documentKeyOf('impact-assessments:2020-57:12', 'uksi/2020/971') === 'impact-assessments:2020-57',
    '⚠⚠ an impact assessment groups on its OWN id, not on parentDocId, which names the instrument')
  control('two assessments of one instrument do not collapse', () => {
    const a = documentKeyOf('impact-assessments:2020-57:12', 'uksi/2020/971')
    const b = documentKeyOf('impact-assessments:2021-03:4', 'uksi/2020/971')
    return a === b // taking parentDocId here would make this TRUE
  })
  check('impact-assessments' in PARENT_IS_NOT_THE_DOCUMENT,
    'the exception is named as data with a reason, not written as an inline `if`')

  check(documentKeyOf('primary-acts-2000plus:ukpga/2008/4:section-1', null) === 'primary-acts-2000plus:ukpga/2008/4',
    'a collection with no parentDocId falls back to the id — the Act, not the section')
  check(documentKeyOf('niassembly-hansard:302713:218', '302713') !== documentKeyOf('scottish-parliament-or:302713:9', '302713'),
    '⚠ the collection is ALWAYS prefixed — two collections both use bare integers as parents')
  control('a bare parentDocId would collide across collections', () =>
    '302713' === '302713' && documentKeyOf('niassembly-hansard:302713:218', '302713') === '302713')

  // The world facts the rule rests on. ⚠ Asserted against the DATABASE, not remembered.
  const shapes = await prisma.$queryRawUnsafe<Array<{ corpus: string; n: bigint; seg2: bigint; parents: bigint }>>(
    `SELECT corpus, count(*) AS n,
            count(DISTINCT split_part(id,':',2)) AS seg2,
            count(DISTINCT "parentDocId") AS parents
     FROM corpus_sections WHERE corpus IN ('committees-reports','impact-assessments','consultations','tna-caselaw')
     GROUP BY corpus`)
  const by = new Map(shapes.map((s) => [s.corpus, s]))
  const cr = by.get('committees-reports')!
  check(Number(cr.seg2) === 1 && Number(cr.parents) > 1000,
    `⚠⚠ measured: committees-reports has ${cr.seg2} distinct id-segment-2 and ${Number(cr.parents).toLocaleString()} distinct parents over ${Number(cr.n).toLocaleString()} sections`)
  const ia = by.get('impact-assessments')!
  check(Number(ia.seg2) > Number(ia.parents),
    `⚠⚠ measured: impact-assessments has ${ia.seg2} assessments and only ${ia.parents} distinct parents — the parent is coarser than the document`)
  for (const c of ['consultations', 'tna-caselaw']) {
    const s = by.get(c)!
    check(Number(s.n) === Number(s.seg2),
      `⚠ measured: ${c} holds one section per document (${Number(s.n).toLocaleString()}) — NO grain change can move this collection`)
  }

  // ═══ §2 — THE NO-OP ═════════════════════════════════════════════════════════════════════════
  console.log('\n§2 the policy is inert until a grain is set')
  const sample = [
    res('pwdata-debates:d1:1', 9, 'd1', 400), res('pwdata-debates:d1:2', 8, 'd1', 500),
    res('pwdata-debates:d2:1', 7, 'd2', 20), res('committees-reports:publication:1:a', 6, 'publication:1', 900),
  ]
  const saveFlag = process.env.LEX_SEARCH_GRAIN
  const saveMap = process.env.LEX_SEARCH_GRAIN_MAP
  const saveFloor = process.env.LEX_SEARCH_MIN_WORDS
  delete process.env.LEX_SEARCH_GRAIN; delete process.env.LEX_SEARCH_GRAIN_MAP; delete process.env.LEX_SEARCH_MIN_WORDS
  const off = applyGrain(sample)
  check(off.results === sample && off.applied === null,
    '⚠ with LEX_SEARCH_GRAIN unset applyGrain returns its ARGUMENT BY REFERENCE — the ranking is byte-identical')
  check(!grainPolicyActive() && Object.keys(grainMap()).length === 0 && minWordFloor() === 0,
    'grainPolicyActive() is false, the map is empty and the floor is 0 — reported, not inferred')

  process.env.LEX_SEARCH_GRAIN = 'true'
  process.env.LEX_SEARCH_GRAIN_MAP = 'pwdata-debates:document'
  const on = applyGrain(sample)
  check(on.results.length === 3 && on.results.map((r) => r.id).join(',') === 'pwdata-debates:d1:1,pwdata-debates:d2:1,committees-reports:publication:1:a',
    '⚠⚠ with a grain set, the second section of the SAME sitting day is dropped and the other collection is untouched')
  check(on.applied?.collectionsRegrouped.join(',') === 'pwdata-debates' && on.applied.before === 4 && on.applied.after === 3,
    'the outcome states what it did — collections regrouped, before and after — rather than only that it ran')
  control('the flag actually changes the ranking', () => off.results.length === on.results.length)

  // The trap: an unrecognised grain must be refused and named, not silently meaning `section`.
  process.env.LEX_SEARCH_GRAIN_MAP = 'pwdata-debates:paragraph'
  check(Object.keys(grainMap()).length === 0,
    "⚠ an unrecognised grain ('paragraph') is REFUSED and warned about, never read as `section`")

  // ⚠⚠ The committee trap, at the policy level: a row that arrived WITHOUT a parent must not be
  // regrouped on the fallback key. Three states, not two.
  process.env.LEX_SEARCH_GRAIN_MAP = 'committees-reports:document'
  const unhydrated = [
    res('committees-reports:publication:1:a', 9), res('committees-reports:publication:2:b', 8),
  ]
  const un = applyGrain(unhydrated)
  check(un.results.length === 2,
    '⚠⚠ rows arriving with parentDocId UNDEFINED are NOT regrouped — the fallback key would merge every committee report')
  const hydrated = [
    res('committees-reports:publication:1:a', 9, 'publication:1'), res('committees-reports:publication:1:b', 8, 'publication:1'),
    res('committees-reports:publication:2:c', 7, 'publication:2'),
  ]
  check(applyGrain(hydrated).results.length === 2,
    'the same rows WITH parents regroup correctly — 3 sections over 2 reports')
  control('undefined and null are told apart', () => applyGrain(unhydrated).results.length === 1)

  // The floor, and its own three-state rule.
  process.env.LEX_SEARCH_GRAIN_MAP = ''
  process.env.LEX_SEARCH_MIN_WORDS = '100'
  const floored = applyGrain([res('a:b:1', 9, null, 400), res('a:b:2', 8, null, 20), res('a:b:3', 7, null)])
  check(floored.results.map((r) => r.id).join(',') === 'a:b:1,a:b:3' && floored.applied?.droppedByFloor === 1,
    '⚠ the floor drops a 20-word row, KEEPS a row whose length was never measured, and counts what it dropped')
  control('an unmeasured row is not treated as short', () =>
    applyGrain([res('a:b:3', 7, null)]).results.length === 0)

  process.env.LEX_SEARCH_GRAIN = saveFlag; process.env.LEX_SEARCH_GRAIN_MAP = saveMap; process.env.LEX_SEARCH_MIN_WORDS = saveFloor
  if (saveFlag === undefined) delete process.env.LEX_SEARCH_GRAIN
  if (saveMap === undefined) delete process.env.LEX_SEARCH_GRAIN_MAP
  if (saveFloor === undefined) delete process.env.LEX_SEARCH_MIN_WORDS

  // ═══ §3 — THE HYDRATE, ASKED OF THE LIVE ADAPTER ════════════════════════════════════════════
  console.log('\n§3 the hydrate carries parentDocId — asked of the running system, not read off the SELECT')
  if (NO_LIVE || !process.env.FTS_SEARCH_URL) {
    console.log('  ⚠ NOT RUN (--no-live, or FTS_SEARCH_URL unset). Reported as not run, never omitted.')
  } else {
    const { runFtsSearch } = await import('../lib/lex/fts-search')
    const live = (await runFtsSearch(['leasehold', 'reform', 'committee'], 20, { corpora: ['committees-reports'] })).results
    check(live.length > 0, `the live probe returned ${live.length} committee-report rows to assert on`)
    const withParent = live.filter((r) => typeof r.parentDocId === 'string' && r.parentDocId.length > 0)
    check(live.length > 0 && withParent.length === live.length,
      `⚠⚠ ${withParent.length} of ${live.length} live rows carry a non-empty parentDocId — without it applyGrain would use the fallback key`)
    const keys = new Set(live.map((r) => documentKeyOf(r.id, r.parentDocId)))
    check(keys.size > 1,
      `⚠⚠ those ${live.length} rows resolve to ${keys.size} distinct documents — the id-segment-2 rule would have resolved them to 1`)
    control('the live rows would collapse under the id rule', () =>
      new Set(live.map((r) => `${r.id.split(':')[0]}:${r.id.split(':')[1]}`)).size > 1)
    const withWords = live.filter((r) => typeof r.wordCount === 'number')
    check(withWords.length === live.length, `${withWords.length} of ${live.length} live rows carry a wordCount for the length floor`)
  }

  // ═══ §4 — THE TWO PURE CONTROLS DECLARED IN grain.ts ════════════════════════════════════════
  console.log('\n§4 the aggregation controls')
  const sorted = [res('c:d1:1', 9, 'd1'), res('c:d2:1', 8, 'd2'), res('c:d1:2', 7, 'd1')]
  const coll = collapseToDocuments(sorted).map((d) => d.documentKey).join(',')
  const aggm = aggregateToDocuments(sorted, 'max').map((d) => d.documentKey).join(',')
  check(coll === aggm && coll === 'c:d1,c:d2',
    '⚠ max-aggregation over a score-sorted list produces the SAME order as first-occurrence collapse')
  control('the equality is not vacuous', () => {
    const unsorted = [res('c:d2:1', 1, 'd2'), res('c:d1:1', 9, 'd1')]
    return collapseToDocuments(unsorted).map((d) => d.documentKey).join(',')
        === aggregateToDocuments(unsorted, 'max').map((d) => d.documentKey).join(',')
  })
  check(aggregateToDocuments(sorted, 'sum').map((d) => d.documentKey).join(',') === 'c:d1,c:d2',
    'sum-aggregation adds a document\'s retrieved sections (9+7 beats 8)')
  check(rankOf(sorted, (r) => r.id === 'c:d1:2') === 3 && rankOf(sorted, (r) => r.id === 'nope') === -1,
    'rankOf is 1-based and returns -1 — never 0 — for not-found at the depth searched')

  // The chunk constants are a COPY (the chunker lives across a package boundary), so the copy is
  // asserted against the original's SOURCE. A copy is allowed to exist; it is not allowed to drift.
  const chunkSrc = fs.readFileSync(path.join(__dirname, '../../scripts/ingest/search/chunk.ts'), 'utf8')
  const num = (name: string) => {
    const m = chunkSrc.match(new RegExp(`${name}\\s*=\\s*parseInt\\(process\\.env\\.[A-Z_]+ \\?\\? '(\\d+)'`))
    return m ? parseInt(m[1], 10) : NaN
  }
  check(num('WHOLE_CHARS') === CHUNK_WHOLE_CHARS && num('WINDOW_CHARS') === CHUNK_WINDOW_CHARS && num('MAX_CHUNKS') === CHUNK_MAX,
    `⚠ grain.ts's chunk constants still match the live chunker (${num('WHOLE_CHARS')}/${num('WINDOW_CHARS')}/${num('MAX_CHUNKS')})`)
  check(chunkCountOf(1000) === 1 && chunkCountOf(4096) === 1 && chunkCountOf(4097) === 2 && chunkCountOf(999999) === CHUNK_MAX,
    'chunkCountOf: a short section is ONE chunk, and a runaway section is capped at 8')

  // ═══ §5 — TOTALITY: NO COLLECTION IS UNREACHABLE BY ACCIDENT ════════════════════════════════
  console.log('\n§5 §1.2 totality — every collection is admitted by a stream or named in a register')
  const collections = await prisma.$queryRawUnsafe<Array<{ corpus: string; n: bigint }>>(
    `SELECT corpus, count(*) AS n FROM corpus_sections GROUP BY corpus`)
  const reach = JSON.parse(fs.readFileSync(path.join(__dirname, '../../docs/census/s19-reach.json'), 'utf8')) as any
  const probed = new Map<string, any>((reach.collections ?? []).map((r: any) => [r.corpus, r]))
  let admitted = 0, registered = 0
  const unowned: string[] = []
  const staleRegister: string[] = []
  const admits = (corpus: string) => {
    const row = probed.get(corpus)
    const tier = row?.servedTier ?? null
    const types = (row?.types ?? []) as string[]
    // ⚠ The tier comes from the PROBE artefact (read off the served index), never from tierFor().
    // That is the exact staleness S16 published UNREACHABLE=4 on.
    return tier !== null && types.some((t) => STREAM_SCOPES.some((s) => streamCanSelect(s, corpus, tier, t as any)))
  }
  for (const { corpus, n } of collections) {
    if (admits(corpus)) { admitted++; continue }
    if (corpus in EXCLUDED_BY_DESIGN || corpus in DEFERRED_TO_GRAPH || corpus in UNREACHABLE_PENDING_DECISION) { registered++; continue }
    unowned.push(`${corpus} (${Number(n).toLocaleString()} sections, tier=${probed.get(corpus)?.servedTier ?? 'UNREAD'})`)
  }
  check(unowned.length === 0,
    `⚠⚠ counted ${collections.length} collections: ${admitted} admitted by a stream, ${registered} named in a register, ${unowned.length} owned by nobody${unowned.length ? ` — ${unowned.join('; ')}` : ''}`)
  control('the totality test can fail', () =>
    STREAM_SCOPES.some((s) => streamCanSelect(s, 'zz-invented-collection', 'other', 'GUIDANCE' as any)))
  check(admitted + registered + unowned.length === collections.length,
    `the three buckets reconcile to the collection count (${admitted}+${registered}+${unowned.length}=${collections.length})`)

  // ⚠⚠ THE REGISTER IS A DEBT, NOT A FILING CABINET. A collection named as unreachable-pending-a-
  // decision that has BECOME reachable is a stale entry, and a register nobody prunes is how
  // "we know about that" outlives the problem it described.
  for (const corpus of Object.keys(UNREACHABLE_PENDING_DECISION)) {
    if (!probed.has(corpus)) { staleRegister.push(`${corpus} (not probed — cannot confirm)`); continue }
    if (admits(corpus)) staleRegister.push(`${corpus} IS now admitted by a stream — delete the register entry`)
  }
  check(staleRegister.length === 0,
    `⚠ every UNREACHABLE_PENDING_DECISION entry is still genuinely unreachable (${Object.keys(UNREACHABLE_PENDING_DECISION).length} checked)${staleRegister.length ? ` — ${staleRegister.join('; ')}` : ''}`)
  control('a stale register entry would be caught', () => admits('uk-treaties-fcdo') === false)

  // ⚠ The orphan class, COUNTED. "Does the index hold rows the database does not" is a question
  // with a number, and the number is what a later reader needs.
  const orphans = (reach.collections ?? []).filter((r: any) => r.verdict === 'ORPHANED-IN-INDEX')
  console.log(`  ▶ ${orphans.length} collections are in the served index with 0 rows in corpus_sections: ${orphans.map((o: any) => o.corpus).join(', ') || '(none)'}`)
  check(Array.isArray(reach.collections) && reach.collections.length >= collections.length,
    `the reach artefact covers at least every database collection (${reach.collections?.length} names vs ${collections.length} in the database)`)

  // ═══ summary ════════════════════════════════════════════════════════════════════════════════
  console.log(`\n── ${passed} passed, ${failures.length} failed · ${controlsFired} controls fired, ${deadControls.length} dead ──`)
  for (const f of failures) console.log(`  ✗ ${f}`)
  for (const d of deadControls) console.log(`  ⚠ dead control: ${d}`)
  await prisma.$disconnect()
  if (failures.length || deadControls.length) process.exit(1)
}
main().catch((e) => { console.error(e); process.exit(1) })
