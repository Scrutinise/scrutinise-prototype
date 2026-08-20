/**
 * verify-s10-keys.ts — S10 §1. ASSERT THE ANSWER KEY EXISTS BEFORE SCORING ANYTHING AGAINST IT.
 *
 * ════════════════════════════════════════════════════════════════════════════════════════════════
 * WHY THIS RUNS FIRST
 * ════════════════════════════════════════════════════════════════════════════════════════════════
 * A recall figure is "of the N questions where a known-correct document EXISTS, X% returned it".
 * That sentence has a precondition nobody has checked on this set: that the key rows are actually
 * in `corpus_sections` today. If a key is absent, its question scores 0 for a reason that has
 * nothing to do with retrieval, and the average silently absorbs it — a floor effect wearing the
 * costume of a result.
 *
 * The keys were read back from the store on 19 Aug 2026, one day before this runs. That is recent
 * enough to expect them all present and NOT recent enough to assume it: CC-Ingest has been
 * rewriting case-law rows in between (BRIEF_INGEST_CASELAW_TEXT), and `docs/CLAUDE.md` §0 says a
 * consequential claim gets verified rather than inherited.
 *
 * ⚠ THIS SCRIPT DOES NOT GO THROUGH `runSearch()` AND MUST NOT. It queries `corpus_sections`
 * directly by primary key — the same method the keys were built with (GOLD_CANDIDATES_S8.md,
 * "Building an answer key meant querying corpus_sections directly, never through runSearch()").
 * Checking a key's existence by searching for it would make every key "present" that retrieval
 * happens to return, which is the circularity the whole gold set exists to avoid.
 *
 * Usage (from scrutinise-web):
 *   npx tsx --env-file=.env scripts/verify-s10-keys.ts
 *   npx tsx --env-file=.env scripts/verify-s10-keys.ts --self-test
 */
import { Prisma } from '@prisma/client'
import { prisma } from '../lib/prisma'
import { GOLD_CORPUS, SCOREABLE, REJECTED, NEGATIVE_CONTROLS, collectionCounts } from './gold/s10-gold-set'

export {}

const argv = process.argv.slice(2)
const selfTest = argv.includes('--self-test')

/** ⚠ NO `tier` COLUMN, AND THAT IS NOT AN OMISSION. `corpus_sections` has no tier: the tier is
 *  computed by `tierFor(corpus)` and BAKED INTO THE FTS INDEX at build time, which is why
 *  stream-scopes.ts warns that the server-side prefilter matches the index rather than the map as
 *  it reads today. Selecting a `tier` column here fails outright (42703) — recorded because the
 *  obvious next reader will reach for it too. */
interface KeyRow { id: string; corpus: string; status: string; wordCount: number | null; sectionTitle: string | null }

async function main() {
  console.log('═'.repeat(96))
  console.log('S10 §1 — ANSWER-KEY PRESENCE CHECK (direct corpus_sections read, NOT through runSearch)')
  console.log('═'.repeat(96))

  // ── the set, stated before anything is measured ──────────────────────────────────────────────
  console.log('\nTHE SET AS CHARLIE VALIDATED IT')
  for (const c of collectionCounts()) {
    console.log(`  ${c.collection.padEnd(20)} scoreable=${String(c.scoreable).padStart(2)}  rejected=${c.rejected}  negative-controls=${c.controls}`)
  }
  console.log(`  ${'TOTAL'.padEnd(20)} scoreable=${SCOREABLE.length + 9} (${SCOREABLE.length} corpus + 9 statistics)  rejected=${REJECTED.length}  controls=${NEGATIVE_CONTROLS.length}`)

  // Every key in the corpus half, deduplicated. The REJECTED four are included deliberately: §5
  // preserves them, and whether their (wrong) keys are present is itself part of the finding.
  const allKeys = Array.from(new Set(GOLD_CORPUS.flatMap((q) => q.keys)))
  console.log(`\nChecking ${allKeys.length} distinct key ids across ${GOLD_CORPUS.length} corpus questions…`)

  const rows = await prisma.$queryRaw<KeyRow[]>`
    SELECT id, corpus, status, "wordCount", "sectionTitle"
    FROM corpus_sections
    WHERE id IN (${Prisma.join(allKeys)})`
  const present = new Map(rows.map((r) => [r.id, r]))

  // ── SELF-TEST: the check must be able to fail ────────────────────────────────────────────────
  // "Every new check watched failing first. A check that cannot fail is not a check." (§7)
  // A key-presence check whose query silently matched everything would report 100% present on a
  // set of pure nonsense, so a row that CANNOT exist is asked for alongside the real ones.
  if (selfTest) {
    const fake = 'committees-reports:publication:00000:000000-DOES-NOT-EXIST'
    const fakeRows = await prisma.$queryRaw<KeyRow[]>`
      SELECT id, corpus, status, "wordCount", "sectionTitle" FROM corpus_sections WHERE id IN (${Prisma.join([fake, allKeys[0]])})`
    const sawFake = fakeRows.some((r) => r.id === fake)
    const sawReal = fakeRows.some((r) => r.id === allKeys[0])
    console.log('\n── SELF-TEST ────────────────────────────────────────────────────────────────────')
    console.log(`  planted absent id returned a row?  ${sawFake ? 'YES ✗ THE CHECK IS BROKEN' : 'no ✓'}`)
    console.log(`  real id alongside it returned?     ${sawReal ? 'yes ✓' : 'NO ✗ THE QUERY IS BROKEN'}`)
    // ⚠ BOTH ARMS MATTER. "planted id absent" passes just as well if the query returns nothing at
    // all — which is exactly how a broken query certifies itself. The real id is the control that
    // makes the negative meaningful.
    if (sawFake || !sawReal) { console.error('\nSELF-TEST FAILED — the presence check cannot be trusted.'); process.exit(1) }
    console.log('  → the check can distinguish present from absent.')
  }

  // ── per question ─────────────────────────────────────────────────────────────────────────────
  let fullyPresent = 0
  let partial = 0
  let absent = 0
  const problems: string[] = []

  console.log('\n── PER QUESTION ──────────────────────────────────────────────────────────────────')
  for (const q of GOLD_CORPUS) {
    const found = q.keys.filter((k) => present.has(k))
    const missing = q.keys.filter((k) => !present.has(k))
    const tag = q.verdict === 'REJECT' ? ' [REJECTED]' : ''
    if (!missing.length) {
      fullyPresent++
    } else if (found.length) {
      partial++
      problems.push(`Q${q.n} ${q.code}: ${missing.length}/${q.keys.length} key(s) ABSENT — ${missing.join(', ')}`)
      console.log(`  Q${String(q.n).padStart(2)} ${q.code.padEnd(4)} ⚠ PARTIAL  ${found.length}/${q.keys.length} present${tag}`)
    } else {
      absent++
      problems.push(`Q${q.n} ${q.code}: ALL ${q.keys.length} key(s) ABSENT — ${missing.join(', ')}`)
      console.log(`  Q${String(q.n).padStart(2)} ${q.code.padEnd(4)} ✗ ABSENT   0/${q.keys.length} present${tag}`)
    }
  }
  console.log(`  …${fullyPresent} question(s) had every key present (not listed individually).`)

  // ── what the key rows actually look like ─────────────────────────────────────────────────────
  // ⚠ §0 dependency 1: case law is mid-repair. `sectionTitle` on tna-caselaw was NULL on every row
  // as of the S8 key build; CC-Ingest's names work has since populated titles. Which of those two
  // states is live RIGHT NOW changes what a case-law recall number means, so it is read rather
  // than assumed.
  const byCorpus = new Map<string, { n: number; titled: number; compiled: number; words: number }>()
  for (const r of rows) {
    const e = byCorpus.get(r.corpus) ?? { n: 0, titled: 0, compiled: 0, words: 0 }
    e.n++
    if (r.sectionTitle && r.sectionTitle.trim()) e.titled++
    if (r.status === 'compiled') e.compiled++
    e.words += r.wordCount ?? 0
    byCorpus.set(r.corpus, e)
  }
  console.log('\n── THE KEY ROWS, AS THEY STAND TODAY ─────────────────────────────────────────────')
  for (const [corpus, e] of [...byCorpus].sort()) {
    console.log(`  ${corpus.padEnd(24)} rows=${String(e.n).padStart(2)}  compiled=${e.compiled}/${e.n}  titled=${e.titled}/${e.n}  mean words≈${Math.round(e.words / e.n)}`)
  }

  // Case law specifically, because a titled row and an untitled one retrieve completely differently.
  const caselawRows = rows.filter((r) => r.corpus === 'tna-caselaw')
  if (caselawRows.length) {
    console.log('\n  tna-caselaw key rows in full (the §0 dependency):')
    for (const r of caselawRows) console.log(`    ${r.id.padEnd(38)} sectionTitle=${r.sectionTitle === null ? 'NULL' : JSON.stringify(r.sectionTitle)}`)
  }

  // ── verdict ──────────────────────────────────────────────────────────────────────────────────
  console.log('\n' + '═'.repeat(96))
  console.log(`KEY PRESENCE: ${fullyPresent} fully present · ${partial} partial · ${absent} wholly absent (of ${GOLD_CORPUS.length} corpus questions)`)
  if (problems.length) {
    console.log('\n⚠ HEADROOM LOST — every question below can score at most partial recall for reasons that')
    console.log('  have NOTHING to do with retrieval. Any average that includes them understates the system.')
    for (const p of problems) console.log(`    · ${p}`)
  } else {
    console.log('✓ Every answer-key row is present. A zero on any question is a retrieval result, not a missing row.')
  }
  console.log('═'.repeat(96))

  await prisma.$disconnect()
}

main().catch(async (e) => { console.error(e); await prisma.$disconnect(); process.exit(1) })
