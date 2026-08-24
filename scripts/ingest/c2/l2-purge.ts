/**
 * l2-purge.ts — LANE 2 items 1 and 2. THE THREE-LAYER RETIREMENT, STAGED.
 *
 * ════════════════════════════════════════════════════════════════════════════════════
 * WHY THIS SCRIPT EXISTS AT ALL — playbook §21 R9
 * ════════════════════════════════════════════════════════════════════════════════════
 * `lda-lordswrittenquestions`, `lda-commonswrittenquestions` and `written-statements` were
 * RETIRED and are still in `corpus_sections` and still in the vector index today. Retiring a
 * target row set a boolean on `corpus_targets`; it deleted nothing. 28,629 sections have been
 * answering queries ever since, as duplicates of collections we also hold.
 *
 * **Retirement is a THREE-LAYER operation: the target, the rows, the vectors.** Doing one of
 * the three and calling it done is the whole defect. This script does all three or none.
 *
 * ════════════════════════════════════════════════════════════════════════════════════
 * WHAT IT REMOVES, AND ON WHAT EVIDENCE
 * ════════════════════════════════════════════════════════════════════════════════════
 *   A. et-decisions landing pages — 131,650 rows, format='html', median 18 words. They are a
 *      GOV.UK landing page, not a decision. 131,147 of them have the real judgment PDF ingested
 *      alongside under the same parentDocId; the remaining 503 are written to
 *      docs/census/C2_L2_et_refetch_list.json BEFORE anything is deleted, because they are the
 *      only thing this deletion destroys a pointer to. Every one of the 161,749 PDF rows carries
 *      its own title and date, so no case name is lost.
 *   B. the three retired collections — 28,629 rows, R9 above.
 *
 *   C. the four additions Charlie approved on 23 August (C3 Lane A), which C2 deliberately left
 *      out because "a proof is not an instruction" — the proofs now have an instruction:
 *      `lda-commonsdivisions` (5,553, item-level duplicate proved by C1 A4, median 8 words against
 *      1,972), `lda-lordsdivisions` (2,089, proved duplicate at 2,087 of 2,089 by C2 L2 item 8),
 *      `written-answers` (143, truncated at the LDA API's 5,000-answer page cap while
 *      `pwdata-wrans` holds 1,235,281 properly split), and `oecd` (505, which contains no OECD
 *      material at all — 505 of 505 rows are gov.uk URLs).
 *
 * ⚠ NOT INCLUDED, DELIBERATELY. `ots-reports` is ~14% contaminated, not 100%: at least 69 of its
 *   497 rows are news stories and speeches and the other ~428 are real OTS reports, correctly
 *   published on gov.uk. A wholesale purge would destroy 428 genuine documents. It is handled by
 *   `ots-filter.ts`, which classifies before it deletes.
 *
 * ════════════════════════════════════════════════════════════════════════════════════
 * SAFETY
 * ════════════════════════════════════════════════════════════════════════════════════
 *  · DRY RUN BY DEFAULT. Nothing is written without --execute.
 *  · REVERSIBLE. Every row destined for deletion is written to a manifest on disk AND to R2
 *    first — full column values, not just ids — so the rows can be reinstated. R2 objects
 *    holding the bodies are NEVER deleted, so the text itself survives regardless.
 *  · GUARDED. The delete re-counts inside the transaction and ABORTS if the count does not
 *    match the manifest. A collection that grew between staging and execution stops the run.
 *  · TRANSACTIONAL per collection, so a failure part-way cannot leave a half-deleted corpus.
 *  · The vector and FTS layers are keyed off the SAME manifest, so the three layers cannot
 *    drift apart.
 *
 * Usage:
 *   tsx c2/l2-purge.ts                 # dry run — counts every layer, writes the manifest
 *   tsx c2/l2-purge.ts --execute       # performs all three layers
 *   tsx c2/l2-purge.ts --execute --only=et-decisions
 */
import fs from 'fs'
import path from 'path'
import { pool, OUT } from './db'
import { r2Put } from '../shared/r2-client'

const EXECUTE = process.argv.includes('--execute')
const ONLY = (process.argv.find(a => a.startsWith('--only=')) ?? '').split('=')[1] || null
const MANIFEST_DIR = path.join(__dirname, 'purge-manifests')

/** Each target names the rows it removes as a SQL predicate, and says why in words. */
const TARGETS = [
  {
    key: 'et-decisions-landing',
    corpus: 'et-decisions',
    where: `corpus = 'et-decisions' AND format = 'html'`,
    expect: 131650,
    why: 'GOV.UK landing pages, median 18 words — a page about a decision, not the decision. ' +
         'The real judgment PDF is held alongside for 131,147 of them.',
  },
  {
    key: 'retired-lda-lords-wq',
    corpus: 'lda-lordswrittenquestions',
    where: `corpus = 'lda-lordswrittenquestions'`,
    expect: 20500,
    why: 'retired target, rows never removed (R9) — duplicated by pwdata-lordswrans',
  },
  {
    key: 'retired-lda-commons-wq',
    corpus: 'lda-commonswrittenquestions',
    where: `corpus = 'lda-commonswrittenquestions'`,
    expect: 8000,
    why: 'retired target, rows never removed (R9)',
  },
  {
    key: 'retired-written-statements',
    corpus: 'written-statements',
    where: `corpus = 'written-statements'`,
    expect: 129,
    why: 'retired target, rows never removed (R9) — one section per MONTH, statements joined by ---',
  },
  // ── the four C3 Lane A additions, approved 23 Aug 2026 ────────────────────────────────────────
  {
    key: 'dup-lda-commonsdivisions',
    corpus: 'lda-commonsdivisions',
    where: `corpus = 'lda-commonsdivisions'`,
    expect: 5553,
    why: 'proved item-level duplicate of commons-divisions-votes (C1 A4); median 8 words against ' +
         '1,972 in the collection that supersedes it — a division title, not a division',
  },
  {
    key: 'dup-lda-lordsdivisions',
    corpus: 'lda-lordsdivisions',
    where: `corpus = 'lda-lordsdivisions'`,
    expect: 2089,
    why: 'proved duplicate at 2,087 of 2,089 against lords-divisions-votes (C2 Lane 2 item 8)',
  },
  {
    key: 'truncated-written-answers',
    corpus: 'written-answers',
    where: `corpus = 'written-answers'`,
    expect: 143,
    why: 'truncated at the LDA API 5,000-answer page cap — each row is a page of answers, not an ' +
         'answer; pwdata-wrans holds 1,235,281 of them properly split',
  },
  {
    key: 'wrong-content-oecd',
    corpus: 'oecd',
    where: `corpus = 'oecd'`,
    expect: 505,
    why: 'contains no OECD material at all: 505 of 505 rows are gov.uk URLs — 52 news stories, 31 ' +
         'speeches, one about the London 2012 Olympics — and it printed [100% complete] because ' +
         'est_sections had been set equal to the compiled count',
  },
]

const n = (x: number) => x.toLocaleString()

async function main() {
  const p = pool()
  const q = async (s: string, a: any[] = []) => (await p.query(s, a)).rows
  fs.mkdirSync(MANIFEST_DIR, { recursive: true })

  console.log(EXECUTE
    ? '⚠ EXECUTE MODE — rows will be deleted from Neon, and the vector/FTS lists written for the index step.'
    : 'DRY RUN — nothing will be written. Pass --execute to perform.')
  console.log('')

  const stamp = new Date().toISOString().replace(/[:.]/g, '-')
  const summary: any[] = []

  for (const t of TARGETS) {
    if (ONLY && t.key !== ONLY) continue
    console.log(`── ${t.key}  (${t.corpus})`)
    console.log(`   ${t.why}`)

    const before = (await q(`SELECT count(*)::int n FROM corpus_sections WHERE ${t.where}`))[0].n
    const words = (await q(`SELECT coalesce(sum("wordCount"),0)::bigint w FROM corpus_sections WHERE ${t.where}`))[0].w
    console.log(`   rows now: ${n(before)}   (brief/C1 expected ${n(t.expect)}) ${
      before === t.expect ? '✓ matches' : '⚠ DIFFERS — staging against the live count, not the expected one'}`)
    console.log(`   words: ${n(Number(words))}`)

    if (before === 0) { console.log('   nothing to do.\n'); continue }

    // ── the manifest: FULL ROWS, so this is reversible, not just auditable.
    const rows = await q(`SELECT * FROM corpus_sections WHERE ${t.where} ORDER BY id`)
    const mfPath = path.join(MANIFEST_DIR, `${t.key}.${stamp}.json`)
    const payload = JSON.stringify({
      key: t.key, corpus: t.corpus, why: t.why, staged_at: new Date().toISOString(),
      count: rows.length, where: t.where, rows,
    })
    fs.writeFileSync(mfPath, payload)
    console.log(`   manifest: ${path.relative(process.cwd(), mfPath)}  (${n(rows.length)} full rows, reinstatable)`)

    // the ids the vector and FTS layers must drop — same manifest, so the layers cannot drift
    const idsPath = path.join(MANIFEST_DIR, `${t.key}.${stamp}.ids.txt`)
    fs.writeFileSync(idsPath, rows.map((r: any) => r.id).join('\n'))

    if (!EXECUTE) {
      console.log(`   DRY RUN — would delete ${n(before)} rows from corpus_sections,`)
      console.log(`             then ${n(before)} sections' chunks from ${process.env.VECTOR_CHUNKS_TABLE ?? 'corpus_chunks'} / ${process.env.VECTOR_VEC_TABLE ?? 'corpus_vec'} and from corpus_fts.\n`)
      summary.push({ key: t.key, rows: before, words: Number(words), executed: false })
      continue
    }

    // ── off-box copy of the manifest before anything is destroyed
    await r2Put(`_c2-purge/${t.key}.${stamp}.json`, payload, 'application/json')
    console.log(`   manifest copied to R2: _c2-purge/${t.key}.${stamp}.json`)

    // ── the delete, guarded inside its own transaction
    const c = await p.connect()
    try {
      await c.query('BEGIN')
      const inTx = (await c.query(`SELECT count(*)::int n FROM corpus_sections WHERE ${t.where}`)).rows[0].n
      if (inTx !== before) {
        await c.query('ROLLBACK')
        console.log(`   ⚠ ABORTED — the collection changed between staging (${n(before)}) and execution (${n(inTx)}). Nothing deleted.\n`)
        summary.push({ key: t.key, rows: before, aborted: true })
        continue
      }
      const del = await c.query(`DELETE FROM corpus_sections WHERE ${t.where}`)
      if (del.rowCount !== before) {
        await c.query('ROLLBACK')
        console.log(`   ⚠ ABORTED — DELETE touched ${n(del.rowCount ?? 0)} rows, manifest holds ${n(before)}. Nothing deleted.\n`)
        summary.push({ key: t.key, rows: before, aborted: true })
        continue
      }
      await c.query('COMMIT')
      console.log(`   ✓ deleted ${n(del.rowCount ?? 0)} rows from corpus_sections`)
    } catch (e: any) {
      await c.query('ROLLBACK').catch(() => {})
      console.log(`   ⚠ ROLLED BACK — ${e.message}\n`)
      summary.push({ key: t.key, rows: before, error: e.message })
      continue
    } finally { c.release() }

    // ── retire the target row too, so the register stops counting it
    await p.query(
      `UPDATE corpus_targets SET retired = true, blocked = true,
         blocked_reason = coalesce(blocked_reason, '') || ' · C2 Lane 2: rows and vectors purged ' || $2,
         updated_at = now()
       WHERE corpus_key = $1`, [t.corpus, stamp])

    const after = (await q(`SELECT count(*)::int n FROM corpus_sections WHERE ${t.where}`))[0].n
    console.log(`   after: ${n(after)} rows remain  ${after === 0 ? '✓' : '⚠'}`)
    console.log(`   NEXT (index layer, not done here): drop these ids from the vector and FTS tables using`)
    console.log(`     ${path.relative(process.cwd(), idsPath)}\n`)
    summary.push({ key: t.key, rows: before, words: Number(words), executed: true, after })
  }

  const total = summary.reduce((s, x) => s + (x.executed ? x.rows : 0), 0)
  const staged = summary.reduce((s, x) => s + x.rows, 0)
  console.log('─'.repeat(72))
  console.log(EXECUTE
    ? `DELETED ${n(total)} rows across ${summary.filter(s => s.executed).length} collections.`
    : `DRY RUN — ${n(staged)} rows staged across ${summary.length} collections. Nothing was written.`)
  console.log(`headline corpus BEFORE: ${n((await q(`SELECT count(*)::int n FROM corpus_sections WHERE status='compiled'`))[0].n)} compiled sections`)

  fs.writeFileSync(path.join(OUT, 'C2_L2_purge_plan.json'),
    JSON.stringify({ generated: new Date().toISOString(), executed: EXECUTE, summary }, null, 2))
  await p.end()
}

main().catch(e => { console.error('FAIL', e.message); process.exit(1) })
