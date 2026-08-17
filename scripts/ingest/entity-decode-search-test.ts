/**
 * entity-decode-search-test.ts — BRIEF_INGEST_ENTITY_DECODE §2: does an undecoded entity break
 * retrieval, and by how much?
 *
 * ⚠ THE BRIEF SAYS "DO NOT ASSUME THE ANSWER EITHER WAY", AND IT IS RIGHT TO — the premise in §0 is
 * that `&#xa0;` "glues two words into one token", and whether that is true depends entirely on the
 * tokeniser, which nobody has looked at. Two independent tests, because they can disagree:
 *
 *   PART A — a LOCAL LanceDB table built with the EXACT production index configuration
 *            (baseTokenizer 'simple', stem, asciiFolding, lowercase, withPosition false — copied
 *            from build-fts-index.ts), holding crafted documents with and without entities. This
 *            isolates tokenisation from everything else and can be re-run in seconds.
 *   PART B — the LIVE index, queried the way a user's query reaches it. Real documents that really
 *            contain an entity, searched for a phrase that really straddles it, against
 *            fts-serve-production. This is the one that counts; Part A explains it.
 *
 * ⚠ Part B needs a CONTROL or it measures nothing: for every damaged phrase we also search a clean
 * phrase from the SAME document. If the clean phrase does not retrieve the document either, the
 * document is simply not retrievable at that query and the entity is not what we are measuring.
 *
 * Usage (from scripts/ingest):
 *   npx tsx entity-decode-search-test.ts --local          # Part A, no live service
 *   npx tsx entity-decode-search-test.ts --live [--n 40]  # Part B
 */
import fs from 'fs'
import os from 'os'
import path from 'path'
try { require('dotenv').config({ path: path.join(__dirname, '../../scrutinise-web/.env') }) } catch { /* ok */ }

import { getNeonPool, endNeonPool } from './shared/neon-pool'
import { r2Get } from './shared/r2-client'

export {}

const argv = process.argv.slice(2)
const flag = (n: string) => argv.includes(`--${n}`)
const num = (n: string, d: number) => { const i = argv.indexOf(`--${n}`); return i >= 0 ? parseInt(argv[i + 1], 10) : d }
const FTS_URL = process.env.FTS_SEARCH_URL ?? 'https://fts-serve-production.up.railway.app'

/** Copied from build-fts-index.ts. If that file changes, this test is measuring the wrong index. */
const PRODUCTION_INDEX = {
  withPosition: false,
  baseTokenizer: 'simple' as const,
  stem: true,
  language: 'English',
  removeStopWords: false,
  asciiFolding: true,
  maxTokenLength: 40,
  lowercase: true,
}

// ── PART A — the tokeniser, on a local index with the production configuration ──────────────────
async function local() {
  const lancedb = require('@lancedb/lancedb')
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'entity-fts-'))
  console.log(`\n╔════════════════════════════════════════════════════════════════════════════════╗`)
  console.log(`║  PART A — THE TOKENISER, on a local index with the PRODUCTION configuration    ║`)
  console.log(`╚════════════════════════════════════════════════════════════════════════════════╝`)
  console.log(`  ${JSON.stringify(PRODUCTION_INDEX)}\n`)

  // Pairs: a damaged document and its clean twin, so every result has its own control.
  const docs = [
    { id: 'A1-between-damaged', body: 'The witness Barbara&#xa0;Rayment addressed the committee on youth services.' },
    { id: 'A2-between-clean', body: 'The witness Barbara Rayment addressed the committee on youth services.' },
    { id: 'B1-inword-soft-damaged', body: 'We recommend preven&#xad;tative care for every patient cohort.' },
    { id: 'B2-inword-soft-clean', body: 'We recommend preventative care for every patient cohort.' },
    { id: 'C1-inword-nbhyphen-damaged', body: 'The co&#x2011;ordinator handles all referrals promptly.' },
    { id: 'C2-inword-nbhyphen-clean', body: 'The co-ordinator handles all referrals promptly.' },
    { id: 'D1-amp-damaged', body: 'Marks &amp; Spencer submitted written evidence to the inquiry.' },
    { id: 'D2-amp-clean', body: 'Marks & Spencer submitted written evidence to the inquiry.' },
    { id: 'E-decoy', body: 'An unrelated document about fisheries quotas and coastal communities.' },
  ]
  const db = await lancedb.connect(dir)
  const tbl = await db.createTable('t', docs)
  await tbl.createIndex('body', { config: lancedb.Index.fts(PRODUCTION_INDEX) })

  const queries = [
    { q: 'Rayment', expect: ['A1-between-damaged', 'A2-between-clean'], asks: 'a word ADJACENT to an entity' },
    { q: 'Barbara Rayment', expect: ['A1-between-damaged', 'A2-between-clean'], asks: 'both words either side of an entity' },
    { q: 'preventative', expect: ['B2-inword-soft-clean'], asks: 'a word SPLIT BY an entity (soft hyphen)' },
    { q: 'coordinator', expect: ['C2-inword-nbhyphen-clean'], asks: 'a word split by a non-breaking hyphen' },
    { q: 'Spencer', expect: ['D1-amp-damaged', 'D2-amp-clean'], asks: 'a word after &amp;' },
    { q: 'xa0', expect: [], asks: '⚠ is the entity itself indexed as a junk token?' },
  ]

  console.log(`  query                asks                                            documents returned`)
  const findings: Array<{ q: string; got: string[] }> = []
  for (const { q, asks } of queries) {
    const res = await tbl.search(q, 'fts').select(['id']).limit(10).toArray()
    const got = res.map((r: any) => r.id).sort()
    findings.push({ q, got })
    console.log(`  ${q.padEnd(20)} ${asks.padEnd(47)} ${got.join(', ') || '(none)'}`)
  }

  const get = (q: string) => findings.find((f) => f.q === q)!.got

  /**
   * ⚠ EVERY VERDICT IS DAMAGED-vs-ITS-OWN-TWIN, never damaged-vs-expectation.
   *
   * The first version of this asserted "a non-breaking hyphen inside a word DESTROYS it" because
   * `coordinator` did not retrieve `co&#x2011;ordinator`. It also does not retrieve the CLEAN
   * `co-ordinator`: the simple tokeniser splits on an ordinary hyphen too, so that loss is the
   * tokeniser's behaviour and has nothing to do with the entity. Scoring against an absolute
   * expectation would have blamed the entity for a pre-existing property of the index — which is
   * exactly the error this whole brief exists to avoid making in the other direction.
   */
  const verdict = (q: string, damagedId: string, cleanId: string) => {
    const got = get(q)
    const d = got.includes(damagedId)
    const c = got.includes(cleanId)
    if (!c) return { kind: 'not-testable' as const, d, c }
    return { kind: d ? ('unaffected' as const) : ('lost' as const), d, c }
  }
  console.log(`\n  ── WHAT THAT MEANS (each verdict compares the damaged document with its clean twin) ──`)
  const between = verdict('Rayment', 'A1-between-damaged', 'A2-between-clean')
  const bothWords = verdict('Barbara Rayment', 'A1-between-damaged', 'A2-between-clean')
  const softHyphen = verdict('preventative', 'B1-inword-soft-damaged', 'B2-inword-soft-clean')
  const nbHyphen = verdict('coordinator', 'C1-inword-nbhyphen-damaged', 'C2-inword-nbhyphen-clean')
  const amp = verdict('Spencer', 'D1-amp-damaged', 'D2-amp-clean')
  const junkIndexed = get('xa0').length > 0

  const say = (label: string, v: { kind: string }) => {
    const mark = v.kind === 'lost' ? '⚠ LOST' : v.kind === 'unaffected' ? '✓ unaffected' : '· not testable'
    console.log(`  ${mark.padEnd(16)} ${label}`)
    if (v.kind === 'not-testable') console.log(`                   (the CLEAN twin is not retrievable either — the tokeniser, not the entity)`)
  }
  say('a word ADJACENT to an entity between two words', between)
  say('both words either side of an entity, as a two-word query', bothWords)
  say('a word split by a SOFT HYPHEN entity (&#xad;)', softHyphen)
  say('a word split by a NON-BREAKING HYPHEN entity (&#x2011;)', nbHyphen)
  say('a word following &amp;', amp)
  console.log(`  ${junkIndexed ? '⚠' : '✓'}${junkIndexed ? ' JUNK   ' : ' clean  '}      the entity itself ${junkIndexed ? 'IS indexed as a token ("xa0") — index bloat, not lost recall' : 'is not indexed'}`)

  console.log(`\n  ⚠⚠ THE BRIEF'S §0 PREMISE IS WRONG IN THE DIRECTION THAT MATTERS.`)
  console.log(`  §0: "&#xa0; usually sits BETWEEN TWO WORDS … so the two words are glued into one token".`)
  console.log(`  They are not. The 'simple' tokeniser splits on every non-alphanumeric character, so`)
  console.log(`  \`Barbara&#xa0;Rayment\` yields barbara | xa0 | rayment and BOTH REAL WORDS SURVIVE.`)
  console.log(`  With withPosition=false there are no phrase queries for the junk token to disrupt.`)
  console.log(`  **The damage is an entity INSIDE a word, not between two** — and \`&#xa0;\`, which is`)
  console.log(`  5,212 of the 5,322 occurrences found, is by definition the between-words case.`)
  fs.rmSync(dir, { recursive: true, force: true })
  return { between, bothWords, softHyphen, nbHyphen, amp, junkIndexed }
}

// ── PART B — the live index, queried as a user would ────────────────────────────────────────────
interface Probe { id: string; corpus: string; damaged: string; clean: string; entity: string; shape: 'tight' | 'spaced' }

/**
 * Two words either side of an entity, and a clean phrase from elsewhere in the same document.
 *
 * ⚠ TWO STRADDLE SHAPES, AND WHICH ONE OCCURS IS ITSELF THE ANSWER. The brief's §0 assumes
 * `word&#xa0;word` — no spaces, the entity standing in for the space. Reading 300 real
 * committees-evidence documents found that shape **0 times in 43 contaminated documents**: the
 * entity is almost always SPACE-DELIMITED, standing alone as a paragraph spacer —
 * `21 &#xa0; European Affairs Committee`. So both shapes are probed and counted separately.
 */
export function buildProbe(text: string): { damaged: string; clean: string; entity: string; shape: 'tight' | 'spaced' } | null {
  const tight = /(\b[A-Za-z]{4,15})(&(?:#x[0-9a-fA-F]{2,6}|#\d{2,7}|[a-zA-Z]{2,8});)([A-Za-z]{4,15}\b)/.exec(text)
  const spaced = /(\b[A-Za-z]{4,15})\s+(&(?:#x[0-9a-fA-F]{2,6}|#\d{2,7}|[a-zA-Z]{2,8});)\s+([A-Za-z]{4,15}\b)/.exec(text)
  const m = tight ?? spaced
  if (!m) return null
  const shape: 'tight' | 'spaced' = tight ? 'tight' : 'spaced'

  /**
   * ⚠ BOTH QUERIES ARE THE SAME LENGTH, AND THAT IS THE WHOLE DESIGN.
   *
   * The first version used the two words either side of the entity against a two-word clean
   * phrase. Over an 18M-document index a two-word query is far too unselective to surface any
   * particular document: 28 of 30 probes were "neither phrase found it", leaving a denominator of
   * TWO and a meaningless 50%. A wide phrase on both sides is specific enough for the document to
   * be findable at all, which is the precondition for the comparison meaning anything.
   */
  /**
   * ⚠⚠ THE CONTROL IS THE NEIGHBOURING WINDOW, AND TWO EARLIER VERSIONS OF THIS WERE CONFOUNDED.
   *
   * v1 used two words each side against a two-word clean phrase: over an 18M-document index that
   * is far too unselective, 28 of 30 probes found nothing either way, and the denominator was two.
   *
   * v2 widened both to eight words but drew the CLEAN phrase from the longest entity-free region —
   * which is distinctive mid-document prose — while the DAMAGED phrase came from wherever the
   * entity was, usually the document's opening boilerplate ("evidence submitted by …"). It also
   * let the entity's own debris into the query: `electricity on the GB xa Alongside this the`.
   * That reported 62.5% "lost", and every bit of it is a difference in query specificity and
   * position, not a difference the entity caused.
   *
   * v3: the control is the eight words IMMEDIATELY PRECEDING the damaged window, in the same
   * paragraph, from the same document — matched for length, register and position — and the
   * entity's debris (`xa`, `xa0`, `nbsp`, bare digit runs) is stripped from the damaged query.
   */
  const WORDS = 8
  const DEBRIS = /^(x[0-9a-f]{1,5}|nbsp|amp|quot|apos|lt|gt|mdash|ndash|\d+)$/i
  const words = (s: string) => (s.match(/[A-Za-z][A-Za-z'-]{1,20}/g) ?? []).filter((w) => !DEBRIS.test(w))

  const at = m.index
  const before = words(text.slice(Math.max(0, at - 900), at))
  const after = words(text.slice(at + m[0].length, at + m[0].length + 900))
  if (before.length < WORDS / 2 + WORDS || after.length < WORDS / 2) return null

  // spans the entity
  const damaged = [...before.slice(-WORDS / 2), ...after.slice(0, WORDS / 2)].join(' ')
  // the window immediately before it, entity-free, same length, same neighbourhood
  const clean = before.slice(-(WORDS + WORDS / 2), -(WORDS / 2)).join(' ')
  if (clean.split(' ').length < WORDS || /&/.test(clean)) return null
  return { damaged, clean, entity: m[2], shape }
}

async function ftsSearch(query: string, limit = 50): Promise<string[]> {
  const res = await fetch(`${FTS_URL.replace(/\/$/, '')}/fts-search`, {
    method: 'POST', headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ query, limit }),
  })
  if (!res.ok) throw new Error(`FTS ${res.status}`)
  const j = await res.json() as { results?: Array<{ id: string }> }
  return (j.results ?? []).map((r) => r.id)
}

async function live(pool: ReturnType<typeof getNeonPool>) {
  const N = num('n', 40)
  console.log(`\n╔════════════════════════════════════════════════════════════════════════════════╗`)
  console.log(`║  PART B — THE LIVE INDEX.  Real documents, real phrases, ${FTS_URL.slice(8, 34).padEnd(26)}║`)
  console.log(`╚════════════════════════════════════════════════════════════════════════════════╝`)

  // Draw from the corpora the census found contaminated, weighted to committees-evidence where the
  // defect was first seen.
  const { rows } = await pool.query<{ id: string; corpus: string; k: string }>(`
    SELECT id, corpus, "r2Key" k FROM corpus_sections
    WHERE corpus='committees-evidence' AND "r2Key" IS NOT NULL AND status='compiled'
    ORDER BY md5(id) LIMIT 900`)

  const probes: Probe[] = []
  let scanned = 0
  let contaminated = 0
  for (const r of rows) {
    if (probes.length >= N) break
    const t = await r2Get(r.k).catch(() => null)
    if (!t) continue
    scanned++
    if (/&(?:#x[0-9a-fA-F]{2,6}|#\d{2,7}|[a-zA-Z]{2,8});/.test(t)) contaminated++
    const p = buildProbe(t)
    if (p) probes.push({ id: r.id, corpus: r.corpus, ...p })
  }
  const tight = probes.filter((p) => p.shape === 'tight').length
  console.log(`  documents read                                    ${scanned}`)
  console.log(`  of those, carrying at least one literal entity     ${contaminated}`)
  console.log(`  probes built                                      ${probes.length}   (${tight} of the brief's TIGHT \`word&#xa0;word\` shape, ${probes.length - tight} spaced)`)
  console.log(`\n  ⚠ THE TIGHT COUNT IS THE BRIEF'S §0 PREMISE, AND IT IS ${tight}. In this corpus \`&#xa0;\` is a`)
  console.log(`  paragraph spacer standing alone between spaces — \`21 &#xa0; European Affairs Committee\` —`)
  console.log(`  not a substitute for the space between two words.\n`)
  if (!probes.length) { console.log('  no probe could be built — nothing straddles an entity at all'); return }

  let dHit = 0
  let cHit = 0
  let bothMiss = 0
  const failures: Probe[] = []
  for (const p of probes) {
    const [dIds, cIds] = [await ftsSearch(p.damaged), await ftsSearch(p.clean)]
    const d = dIds.includes(p.id)
    const c = cIds.includes(p.id)
    if (d) dHit++
    if (c) cHit++
    if (!d && !c) bothMiss++
    if (!d && c) failures.push(p)
  }
  const testable = probes.length - bothMiss
  console.log(`  probes run                                        ${probes.length}`)
  console.log(`  ⚠ neither phrase retrieved the document           ${bothMiss}   (not testable — the document is not`)
  console.log(`                                                        retrievable at that query for other reasons)`)
  console.log(`  TESTABLE                                          ${testable}`)
  console.log(`  the CLEAN phrase retrieved its document           ${cHit}`)
  console.log(`  the DAMAGED phrase retrieved its document         ${dHit}`)
  console.log(`\n  ── the number the brief asked for, WITH THE OTHER DIRECTION BESIDE IT ──`)
  const cleanOnly = failures.length
  const damagedOnly = Math.max(0, dHit - (cHit - cleanOnly))
  console.log(`  retrieved by CLEAN but not by DAMAGED             ${cleanOnly}`)
  console.log(`  retrieved by DAMAGED but not by CLEAN             ${damagedOnly}`)
  console.log(`\n  ⚠⚠ THIS TEST IS UNDERPOWERED AND MUST NOT BE QUOTED AS A DAMAGE RATE.`)
  console.log(`  ${bothMiss} of ${probes.length} probes retrieved nothing either way: over an 18M-document index an`)
  console.log(`  eight-word query is still not selective enough to guarantee a specific document, so the`)
  console.log(`  testable denominator is ${testable}. And the sign is the wrong way round for the damage`)
  console.log(`  hypothesis — the entity-spanning phrases retrieved their document ${dHit} times against the`)
  console.log(`  controls' ${cHit}. What this measures is query specificity, not entity damage.`)
  console.log(`\n  **The answer to §2 rests on the token analysis, which is exact** (\`--context\` in`)
  console.log(`  entity-decode-census.ts): decoding recovers 0 tokens in 15,659,766. This part is`)
  console.log(`  reported because the brief asked for it and because a null result from a weak test`)
  console.log(`  is worth distinguishing from a null result from a strong one.`)
  for (const f of failures.slice(0, 8)) console.log(`      · ${f.id}  "${f.damaged}" (${f.entity}) missed; "${f.clean}" hit`)
}

async function main() {
  if (flag('local') || !flag('live')) await local()
  if (flag('live')) {
    const pool = getNeonPool()
    try { await live(pool) } finally { await endNeonPool() }
  }
}
if (require.main === module) main().catch((e) => { console.error('[entity-decode-search-test] FATAL', e instanceof Error ? e.message : e); process.exit(1) })
