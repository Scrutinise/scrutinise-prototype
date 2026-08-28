/**
 * argument-peroration.ts — ARGUMENT 1A §1.1. CHARLIE'S PERORATION HYPOTHESIS, TESTED.
 *
 * ════════════════════════════════════════════════════════════════════════════════════════════════
 * THE HYPOTHESIS AND WHY IT IS WORTH A MEASUREMENT RATHER THAN AN ASSUMPTION
 * ════════════════════════════════════════════════════════════════════════════════════════════════
 * *"The substantive point usually lands in a speech's closing paragraphs, the rest being
 * throat-clearing."* If true, the seed draw should be weighted towards perorations. The brief is
 * explicit that **a prior baked into sampling silently shapes everything built on top of it**, so
 * it is measured before anything is sampled, and the prediction was written down first
 * (`docs/census/argument-1a-predictions.json`).
 *
 * ⚠⚠ IT CANNOT BE TESTED THROUGH THE VECTOR INDEX, AND THAT IS THE FIRST FINDING. The chunker
 * (`scripts/ingest/search/chunk.ts`) emits ONE chunk for any section under 4,096 characters, and
 * caps long sections at 8 windows. So for the overwhelming majority of speeches there is exactly
 * one passage and no "position within the speech" at all; and for the longest, the tail past
 * ~22,000 characters has no vector whatsoever. **A position experiment run over chunks would be
 * measuring the chunker.** So this reads the stored BODY out of R2 and splits it by word count.
 *
 * ⚠ THE CONFOUND IS MEASURED, NOT ASSUMED AWAY. Procedural closers — *"I beg to move"*,
 * *"I commend the amendment"* — concentrate at the end of a speech by parliamentary etiquette. If
 * they were counted as argument they would manufacture the peroration effect out of good manners.
 * They are counted on their own axis and printed beside the markers.
 *
 * ⚠ SAMPLED BY `md5(id)`, NEVER BY `id`. A `pwdata` id embeds its own date
 * (`debates2015-07-15a:466`), so id order is chronological and "the first N" is a decade, not a
 * sample. This cost a whole pilot once: a 400-row draw ordered by id reported 76.1% where the
 * corpus says 26.9%.
 *
 * Usage:
 *   npm run argument:peroration
 *   tsx --env-file=.env --tsconfig tsconfig.json scripts/argument-peroration.ts [--per-stratum 25]
 */
import fs from 'node:fs'
import path from 'node:path'
import { prisma } from '../lib/prisma'
import { r2Get } from '../lib/r2'
import { PATTERNS, PROCEDURAL_CLOSERS, STANCE_MARKERS, TAGS, PARLIAMENTARY_CORPORA, type Tag } from './argument/taxonomy'

const arg = (k: string, d: number) => {
  const i = process.argv.indexOf(`--${k}`)
  return i >= 0 ? parseInt(process.argv[i + 1], 10) : d
}
const PER_STRATUM = arg('per-stratum', 25)
/** A speech shorter than this has no "opening fifth" worth distinguishing from its "closing fifth". */
const LONG_MIN_WORDS = 300
/** The counter-hypothesis arm: an intervention is nothing but the point. */
const SHORT_MAX_WORDS = 100
const SHORT_MIN_WORDS = 15
const OUT = path.join(__dirname, '../../docs/census/argument-1a-peroration.json')

interface Row { id: string; corpus: string; r2Key: string; words: number; decade: string }

/** Count MATCHES, not presence: density is the measurement, and a boolean per passage would make
 *  a passage that says "unworkable" five times identical to one that says it once. */
function countMatches(text: string, patterns: RegExp[]): number {
  let n = 0
  for (const p of patterns) {
    const g = new RegExp(p.source, p.flags.includes('g') ? p.flags : p.flags + 'g')
    n += (text.match(g) ?? []).length
  }
  return n
}

function perPattern(text: string, patterns: RegExp[], into: Map<string, number>) {
  for (const p of patterns) {
    const g = new RegExp(p.source, p.flags.includes('g') ? p.flags : p.flags + 'g')
    const n = (text.match(g) ?? []).length
    if (n) into.set(String(p), (into.get(String(p)) ?? 0) + n)
  }
}

async function drawStratified(minWords: number, maxWords: number | null, perStratum: number): Promise<Row[]> {
  // One query per (corpus, decade) stratum so the sample is genuinely spread rather than
  // dominated by whichever collection is largest. The brief: "report the strata and the counts".
  const strata = await prisma.$queryRawUnsafe<any[]>(`
    SELECT corpus, (EXTRACT(YEAR FROM "itemDate")::int / 10 * 10)::text AS decade, count(*) AS n
    FROM corpus_sections
    WHERE corpus = ANY($1) AND status = 'compiled' AND "r2Key" IS NOT NULL
      AND "itemDate" >= '1800-01-01' AND "wordCount" >= $2 ${maxWords ? 'AND "wordCount" <= $3' : ''}
    GROUP BY 1, 2 HAVING count(*) >= 20 ORDER BY 1, 2`,
    ...(maxWords ? [PARLIAMENTARY_CORPORA, minWords, maxWords] : [PARLIAMENTARY_CORPORA, minWords]))

  const out: Row[] = []
  for (const s of strata) {
    const rows = await prisma.$queryRawUnsafe<any[]>(`
      SELECT id, corpus, "r2Key", "wordCount" AS words
      FROM corpus_sections
      WHERE corpus = $1 AND status = 'compiled' AND "r2Key" IS NOT NULL
        AND "wordCount" >= $2 ${maxWords ? 'AND "wordCount" <= $5' : ''}
        AND "itemDate" >= $3::date AND "itemDate" < $4::date
      ORDER BY md5(id) LIMIT ${perStratum}`,
      ...(maxWords
        ? [s.corpus, minWords, `${s.decade}-01-01`, `${Number(s.decade) + 10}-01-01`, maxWords]
        : [s.corpus, minWords, `${s.decade}-01-01`, `${Number(s.decade) + 10}-01-01`]))
    for (const r of rows) out.push({ ...r, words: Number(r.words), decade: s.decade })
  }
  return out
}

async function readBodies(rows: Row[], concurrency = 8): Promise<Map<string, string>> {
  const bodies = new Map<string, string>()
  let i = 0
  await Promise.all(Array.from({ length: concurrency }, async () => {
    while (i < rows.length) {
      const r = rows[i++]
      const b = await r2Get(r.r2Key).catch(() => null)
      if (b) bodies.set(r.id, b)
    }
  }))
  return bodies
}

async function main() {
  const started = Date.now()
  console.log('── ARGUMENT 1A §1.1 · THE PERORATION HYPOTHESIS ──')
  console.log('  prediction logged first: docs/census/argument-1a-predictions.json')
  console.log(`  long arm: >= ${LONG_MIN_WORDS} words · short arm: ${SHORT_MIN_WORDS}-${SHORT_MAX_WORDS} words`)
  console.log(`  sampling ORDER BY md5(id) within (corpus, decade), <= ${PER_STRATUM} per stratum\n`)

  // ⚠ A DATE FLOOR, AND THE ROWS IT EXCLUDES ARE A FINDING RATHER THAN A NUISANCE. The first run
  // produced strata labelled `historic-hansard 1050s` and `1100s`: `corpus_sections.itemDate` on
  // that collection runs back to 1013, which is nine centuries before Hansard existed. Counted and
  // reported to ingest; excluded here because a "decade" stratum built from a corrupt date is not
  // a stratum.
  const badDates = await prisma.$queryRawUnsafe<any[]>(`
    SELECT corpus, count(*) AS n, min("itemDate") AS earliest FROM corpus_sections
    WHERE corpus = ANY($1) AND "itemDate" < '1800-01-01' GROUP BY 1 ORDER BY 2 DESC`, PARLIAMENTARY_CORPORA)
  if (badDates.length) {
    console.log('  ⚠ rows excluded by the 1800 date floor (an ingest finding, reported not fixed):')
    for (const b of badDates) console.log(`      ${String(b.corpus).padEnd(24)} ${Number(b.n).toLocaleString().padStart(8)} rows, earliest ${String(b.earliest).slice(0, 15)}`)
    console.log('')
  }

  const long = await drawStratified(LONG_MIN_WORDS, null, PER_STRATUM)
  const short = await drawStratified(SHORT_MIN_WORDS, SHORT_MAX_WORDS, PER_STRATUM)
  console.log(`  drawn: ${long.length} long speeches · ${short.length} short interventions`)

  const byStratum = new Map<string, number>()
  for (const r of long) byStratum.set(`${r.corpus} ${r.decade}s`, (byStratum.get(`${r.corpus} ${r.decade}s`) ?? 0) + 1)
  console.log('  strata drawn (long arm):')
  for (const [k, v] of [...byStratum.entries()].sort()) console.log(`    ${k.padEnd(34)} ${v}`)

  const bodies = await readBodies(long)
  const shortBodies = await readBodies(short)
  console.log(`\n  bodies read from R2: ${bodies.size} of ${long.length} long · ${shortBodies.size} of ${short.length} short`)

  // ── the long arm, by fifth ────────────────────────────────────────────────────────────────────
  const FIFTHS = 5
  const markerHits = Array(FIFTHS).fill(0)
  const stanceHits = Array(FIFTHS).fill(0)
  const proceduralHits = Array(FIFTHS).fill(0)
  const wordsIn = Array(FIFTHS).fill(0)
  const perTagByFifth: Record<Tag, number[]> = Object.fromEntries(TAGS.map((t) => [t, Array(FIFTHS).fill(0)])) as any
  const patternTotals = new Map<string, number>()
  const ALL_PATTERNS = TAGS.flatMap((t) => PATTERNS[t])

  // ⚠⚠ A CONFOUND THAT WOULD HAVE ANSWERED THE WRONG QUESTION. Charlie's hypothesis is about a
  // SPEECH — a person saving their point for the end. But `committees-reports` and
  // `committees-evidence` are not speeches: a committee report's *Conclusions and recommendations*
  // chapter sits at the end BY STRUCTURE, and a written submission ends with its asks. Pooled, they
  // would manufacture a closing peak for a reason that has nothing to do with rhetoric.
  // So the two groups are measured apart and both are printed.
  const isSpeech = (corpus: string) => !corpus.startsWith('committees-')
  const speechHits = Array(FIFTHS).fill(0), speechWords = Array(FIFTHS).fill(0)
  const docHits = Array(FIFTHS).fill(0), docWords = Array(FIFTHS).fill(0)
  const speechStance = Array(FIFTHS).fill(0), docStance = Array(FIFTHS).fill(0)
  let speechN = 0, docN = 0

  let analysed = 0
  for (const r of long) {
    const body = bodies.get(r.id)
    if (!body) continue
    analysed++
    const words = body.replace(/\s+/g, ' ').trim().split(' ')
    const size = Math.floor(words.length / FIFTHS)
    if (size < 20) continue
    perPattern(body, ALL_PATTERNS, patternTotals)
    for (let f = 0; f < FIFTHS; f++) {
      const slice = words.slice(f * size, f === FIFTHS - 1 ? words.length : (f + 1) * size).join(' ')
      wordsIn[f] += slice.split(' ').length
      markerHits[f] += countMatches(slice, ALL_PATTERNS)
      stanceHits[f] += countMatches(slice, STANCE_MARKERS)
      proceduralHits[f] += countMatches(slice, PROCEDURAL_CLOSERS)
      for (const t of TAGS) perTagByFifth[t][f] += countMatches(slice, PATTERNS[t])
      const n = countMatches(slice, ALL_PATTERNS), s = countMatches(slice, STANCE_MARKERS)
      const w = slice.split(' ').length
      if (isSpeech(r.corpus)) { speechHits[f] += n; speechStance[f] += s; speechWords[f] += w }
      else { docHits[f] += n; docStance[f] += s; docWords[f] += w }
    }
    if (isSpeech(r.corpus)) speechN++; else docN++
  }

  const per1k = (hits: number, words: number) => words ? (hits * 1000) / words : 0
  const NAMES = ['opening', '2nd', 'middle', '4th', 'closing']
  console.log(`\n  ── LONG SPEECHES, ${analysed} analysed, by position ──`)
  console.log('    TWO INSTRUMENTS, REPORTED APART AND NEVER SUMMED:')
  console.log('      narrow = the ten tags\' own MOVE patterns (what §2 propagates on)')
  console.log('      stance = the broader constructions with which a speaker asserts rather than narrates')
  console.log('    fifth      words   narrow  per 1k    stance  per 1k   procedural  per 1k')
  const density: number[] = []
  const stanceDensity: number[] = []
  for (let f = 0; f < FIFTHS; f++) {
    const d = per1k(markerHits[f], wordsIn[f])
    const s = per1k(stanceHits[f], wordsIn[f])
    density.push(d); stanceDensity.push(s)
    console.log(`    ${NAMES[f].padEnd(8)}${String(wordsIn[f]).padStart(10)}${String(markerHits[f]).padStart(9)}` +
      `${d.toFixed(3).padStart(9)}${String(stanceHits[f]).padStart(10)}${s.toFixed(3).padStart(9)}` +
      `${String(proceduralHits[f]).padStart(13)}${per1k(proceduralHits[f], wordsIn[f]).toFixed(3).padStart(9)}`)
  }
  const ratio = (a: number[], i: number, j: number) => (a[i] / (a[j] || 1)).toFixed(2)
  console.log(`\n    narrow  opening/middle ${ratio(density, 0, 2)}x · closing/middle ${ratio(density, 4, 2)}x · closing/opening ${ratio(density, 4, 0)}x`)
  console.log(`            densest fifth: ${NAMES[density.indexOf(Math.max(...density))]}` +
    `   ⚠ ${markerHits.reduce((a, b) => a + b, 0)} hits in total — read the count before the ratio`)
  console.log(`    stance  opening/middle ${ratio(stanceDensity, 0, 2)}x · closing/middle ${ratio(stanceDensity, 4, 2)}x · closing/opening ${ratio(stanceDensity, 4, 0)}x`)
  console.log(`            densest fifth: ${NAMES[stanceDensity.indexOf(Math.max(...stanceDensity))]}` +
    `   (${stanceHits.reduce((a, b) => a + b, 0)} hits in total)`)

  // ── the confound, separated: speeches vs documents ────────────────────────────────────────────
  console.log('\n  ── SPEECHES ONLY (Hansard and the devolved records), the population the hypothesis is about ──')
  console.log(`    ${speechN} speeches. fifth densities per 1,000 words:`)
  const sd = speechHits.map((h, f) => per1k(h, speechWords[f]))
  const ss = speechStance.map((h, f) => per1k(h, speechWords[f]))
  console.log(`      narrow ${sd.map((d, f) => `${NAMES[f]} ${d.toFixed(3)}`).join(' · ')}`)
  console.log(`             opening/middle ${ratio(sd, 0, 2)}x · closing/middle ${ratio(sd, 4, 2)}x · closing/opening ${ratio(sd, 4, 0)}x · ${speechHits.reduce((a, b) => a + b, 0)} hits`)
  console.log(`      stance ${ss.map((d, f) => `${NAMES[f]} ${d.toFixed(3)}`).join(' · ')}`)
  console.log(`             opening/middle ${ratio(ss, 0, 2)}x · closing/middle ${ratio(ss, 4, 2)}x · closing/opening ${ratio(ss, 4, 0)}x · ${speechStance.reduce((a, b) => a + b, 0)} hits`)
  console.log(`\n  ── COMMITTEE DOCUMENTS (reports and written evidence), where a closing peak is STRUCTURAL ──`)
  console.log(`    ${docN} documents. A report's Conclusions chapter is at the end by construction, so a`)
  console.log('    peak here says nothing about how anybody argues.')
  const dd = docHits.map((h, f) => per1k(h, docWords[f]))
  const ds = docStance.map((h, f) => per1k(h, docWords[f]))
  console.log(`      narrow ${dd.map((d, f) => `${NAMES[f]} ${d.toFixed(3)}`).join(' · ')}`)
  console.log(`             closing/opening ${ratio(dd, 4, 0)}x · ${docHits.reduce((a, b) => a + b, 0)} hits`)
  console.log(`      stance ${ds.map((d, f) => `${NAMES[f]} ${d.toFixed(3)}`).join(' · ')}`)
  console.log(`             closing/opening ${ratio(ds, 4, 0)}x · ${docStance.reduce((a, b) => a + b, 0)} hits`)

  // ── the counter-hypothesis: short interventions ───────────────────────────────────────────────
  let shortWords = 0, shortHits = 0, shortStance = 0, shortAnalysed = 0
  for (const r of short) {
    const body = shortBodies.get(r.id)
    if (!body) continue
    shortAnalysed++
    shortWords += body.replace(/\s+/g, ' ').trim().split(' ').length
    shortHits += countMatches(body, ALL_PATTERNS)
    shortStance += countMatches(body, STANCE_MARKERS)
  }
  const longOverall = per1k(markerHits.reduce((a, b) => a + b, 0), wordsIn.reduce((a, b) => a + b, 0))
  const longStanceOverall = per1k(stanceHits.reduce((a, b) => a + b, 0), wordsIn.reduce((a, b) => a + b, 0))
  console.log(`\n  ── SHORT INTERVENTIONS (${SHORT_MIN_WORDS}-${SHORT_MAX_WORDS} words), ${shortAnalysed} analysed ──`)
  console.log(`    ${shortWords} words`)
  console.log(`    narrow  ${shortHits} hits · ${per1k(shortHits, shortWords).toFixed(3)} per 1k` +
    `  vs long ${longOverall.toFixed(3)}  →  ${(per1k(shortHits, shortWords) / (longOverall || 1)).toFixed(2)}x`)
  console.log(`    stance  ${shortStance} hits · ${per1k(shortStance, shortWords).toFixed(3)} per 1k` +
    `  vs long ${longStanceOverall.toFixed(3)}  →  ${(per1k(shortStance, shortWords) / (longStanceOverall || 1)).toFixed(2)}x`)

  // ── per tag, and per pattern, so a runaway is visible rather than buried in a total ───────────
  console.log('\n  ── marker hits by tag and fifth (long arm) ──')
  console.log('    tag                opening   2nd  middle   4th  closing   total')
  for (const t of TAGS) {
    const a = perTagByFifth[t]
    console.log(`    ${t.padEnd(18)}${a.map((n) => String(n).padStart(6)).join('')}${String(a.reduce((x, y) => x + y, 0)).padStart(8)}`)
  }
  console.log('\n  ── the ten highest-firing patterns, so an over-firing one is visible ──')
  for (const [p, n] of [...patternTotals.entries()].sort((a, b) => b[1] - a[1]).slice(0, 10)) {
    console.log(`    ${String(n).padStart(5)}  ${p}`)
  }

  fs.writeFileSync(OUT, JSON.stringify({
    takenAt: new Date().toISOString(), perStratum: PER_STRATUM,
    longDrawn: long.length, longAnalysed: analysed, shortDrawn: short.length, shortAnalysed,
    strata: Object.fromEntries(byStratum),
    fifths: { markerHits, stanceHits, proceduralHits, wordsIn, density, stanceDensity },
    speeches: { n: speechN, hits: speechHits, stance: speechStance, words: speechWords },
    documents: { n: docN, hits: docHits, stance: docStance, words: docWords },
    perTagByFifth, patternTotals: Object.fromEntries(patternTotals),
    shortArm: { words: shortWords, narrowHits: shortHits, stanceHits: shortStance,
      narrowPer1k: per1k(shortHits, shortWords), stancePer1k: per1k(shortStance, shortWords) },
    longOverallPer1k: longOverall, longStanceOverallPer1k: longStanceOverall,
  }, null, 2))
  console.log(`\n  wrote ${OUT}   (${((Date.now() - started) / 1000).toFixed(0)}s)`)
  await prisma.$disconnect()
}
main().catch(async (e) => { console.error('FAILED', e); await prisma.$disconnect(); process.exit(1) })
