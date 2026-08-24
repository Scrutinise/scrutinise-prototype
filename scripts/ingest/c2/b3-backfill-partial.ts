/**
 * b3-backfill-partial.ts — C3 Lane B3. WRITE THE PARTIAL-REPEAL RECORDS, and the missed hollow ones.
 *
 * ════════════════════════════════════════════════════════════════════════════════════════════════
 * WHAT A USER SEES TODAY
 * Lex quotes a section as the law. Most of it IS the law. One subsection was repealed years ago and
 * the publisher marks it with a dot leader — and nothing anywhere says so, because
 * `section_repeals` has never held a row for this. A measured **32,040 sections [95% CI
 * 25,956–40,088]** are of that kind. The reader cannot tell a gap from a full stop.
 *
 * TWO POPULATIONS, WRITTEN IN ONE PASS BECAUSE THEY ARE FOUND BY THE SAME READ:
 *
 *   `partial-dot-leader`      NEW. Live law with removed subsections. Stays retrievable, gets a
 *                             label, and is NEVER counted as a repeal — that would tell the user
 *                             current law is dead.
 *   `dot-leader-placeholder`  EXISTING, and its 249,256 is a FLOOR, not a total. The B3 census
 *                             found whole-body dot leaders the table does not hold, at a rate
 *                             projecting **~1,487** more. Most are the `12ZA . . . .` class: a
 *                             provision number with a MULTI-LETTER suffix, which defeated
 *                             `isRepealedPlaceholder` until this sprint (V36 caught the bare form,
 *                             C2 caught the `Article` form, this is the third).
 *
 * ⚠ THE CLASSIFICATION IS THE SHARED HELPER, NOT A COPY OF IT. `isRepealedPlaceholder` and
 * `isPartiallyRepealed` come from `shared/compile.ts`, guarded by `check-dot-guard.ts` (13 cases)
 * and `check-partial-guard.ts` (14 cases, including an explicit assertion that no body can satisfy
 * both). A second implementation of a rule this delicate is a second implementation that drifts.
 *
 * ⚠ IT READS BODIES FROM `corpus_fts`, NOT FROM R2. The bodies are already in the index and a
 * Lance scan by id is one round trip per 2,000 rows against ~1.6M individual R2 object reads. A
 * row absent from the index is REPORTED and skipped, never assumed clean.
 *
 * ⚠ IT NEVER OVERWRITES AN EXISTING ROW. `ON CONFLICT (section_id) DO NOTHING` — a section already
 * carrying a `dot-leader-placeholder` record keeps it. This pass may only ADD.
 *
 * ⚠ WRITES INCREMENTALLY, in batches, with a resumable checkpoint. `l2-measure.ts` produced every
 * measurement it was asked for and lost the lot to a single `writeFileSync` at the end.
 *
 * ⚠⚠ AND IT DOES NOT REACH A USER. Writing `section_repeals` changes what `lookupRepeals` returns
 * on the NEXT request — no index rebuild is needed, because the join is live. But the whole-body
 * rows this pass adds also need removing from retrieval, which the gateway does from the same
 * table, so those DO take effect immediately. Both are stated at the end of the run.
 *
 * Usage:
 *   tsx c2/b3-backfill-partial.ts --dry-run --limit=20000     # classify, write nothing
 *   tsx c2/b3-backfill-partial.ts --execute                   # the backfill
 *   tsx c2/b3-backfill-partial.ts --execute --corpus=regional --resume
 */
import fs from 'fs'
import path from 'path'
import { pool, OUT } from './db'
import { connectLance, FTS_TABLE } from '../search/lance'
import { isRepealedPlaceholder, isPartiallyRepealed } from '../shared/compile'

const EXECUTE = process.argv.includes('--execute')
const RESUME = process.argv.includes('--resume')
const arg = (k: string) => (process.argv.find((a) => a.startsWith(`--${k}=`)) ?? '').split('=')[1] || null
const LIMIT = arg('limit') ? parseInt(arg('limit')!, 10) : null
const ONLY = arg('corpus')
const BATCH = parseInt(arg('batch') ?? '2000', 10)

const PARTIAL_EVIDENCE = 'partial-dot-leader'
const HOLLOW_EVIDENCE = 'dot-leader-placeholder'
const LEG = ['primary-acts-pre-2000', 'primary-acts-2000plus', 'si-pre-2010', 'si-2010plus', 'regional', 'retained-eu']
const CKPT = path.join(__dirname, 'b3-backfill-checkpoint.json')
const n = (x: number) => x.toLocaleString('en-GB')
const esc = (s: string) => s.replace(/'/g, "''")

interface Ckpt { done: Record<string, string> }   // corpus -> last id written
const readCkpt = (): Ckpt => (RESUME && fs.existsSync(CKPT) ? JSON.parse(fs.readFileSync(CKPT, 'utf8')) : { done: {} })

async function main() {
  const p = pool()
  const db = await connectLance()
  const tbl = await db.openTable(FTS_TABLE)
  const ckpt = readCkpt()

  const url = process.env.NEON_DATABASE_URL_NO_POOLED || process.env.NEON_DATABASE_URL || ''
  console.log(`host: ${url.replace(/^[^@]*@/, '').split('/')[0]}`)
  console.log(EXECUTE ? '\n⚠ EXECUTE — rows will be INSERTed into section_repeals.\n' : '\nDRY RUN — classifying only. Pass --execute to write.\n')

  const totals = { read: 0, partial: 0, hollowNew: 0, missingFromIndex: 0, written: 0 }
  const corpora = ONLY ? [ONLY] : LEG

  for (const corpus of corpora) {
    let after = ckpt.done[corpus] ?? ''
    let readHere = 0
    console.log(`── ${corpus}${after ? `   (resuming after ${after})` : ''}`)
    for (;;) {
      // ⚠ Keyset pagination on `id`, NOT OFFSET. This pass INSERTs into a table the WHERE clause
      //   reads, so an OFFSET walk would shift under itself and skip rows silently.
      const rows: Array<{ id: string }> = (await p.query(
        `SELECT s.id FROM corpus_sections s
          WHERE s.corpus = $1 AND s.status = 'compiled' AND s.id > $2
            AND NOT EXISTS (SELECT 1 FROM section_repeals r WHERE r.section_id = s.id)
          ORDER BY s.id LIMIT $3`, [corpus, after, BATCH])).rows
      if (!rows.length) break

      const ids = rows.map((r) => r.id)
      const bodies = await tbl.query()
        .where(`id IN (${ids.map((i) => `'${esc(i)}'`).join(',')})`)
        .select(['id', 'body']).toArray() as Array<{ id: string; body: string }>
      const byId = new Map(bodies.map((b) => [b.id, String(b.body ?? '')]))

      const partial: string[] = []
      const hollow: string[] = []
      for (const id of ids) {
        const body = byId.get(id)
        if (body == null) { totals.missingFromIndex++; continue }   // reported, never assumed clean
        totals.read++; readHere++
        if (isRepealedPlaceholder(body)) hollow.push(id)
        else if (isPartiallyRepealed(body)) partial.push(id)
      }
      totals.partial += partial.length
      totals.hollowNew += hollow.length

      if (EXECUTE && (partial.length || hollow.length)) {
        for (const [list, evidence] of [[partial, PARTIAL_EVIDENCE], [hollow, HOLLOW_EVIDENCE]] as Array<[string[], string]>) {
          if (!list.length) continue
          const res = await p.query(
            `INSERT INTO section_repeals (section_id, gid, section_ref, corpus, evidence, repealed_by, source_url, detected_at)
             SELECT s.id,
                    split_part(s.id, ':', 2),
                    split_part(s.id, ':', 3),
                    s.corpus, $2, NULL, s."sourceUrl", now()
               FROM corpus_sections s WHERE s.id = ANY($1)
             ON CONFLICT (section_id) DO NOTHING`, [list, evidence])
          totals.written += res.rowCount ?? 0
        }
      }

      after = ids[ids.length - 1]
      ckpt.done[corpus] = after
      fs.writeFileSync(CKPT, JSON.stringify(ckpt))          // after every batch, not at the end
      process.stdout.write(`\r   read ${n(readHere)}   partial ${n(totals.partial)}   new hollow ${n(totals.hollowNew)}   written ${n(totals.written)}…   `)
      if (LIMIT && totals.read >= LIMIT) break
    }
    process.stdout.write('\n')
    if (LIMIT && totals.read >= LIMIT) { console.log(`   (--limit=${LIMIT} reached)`); break }
  }

  console.log('\n' + '─'.repeat(78))
  console.log(`bodies read                     ${n(totals.read)}`)
  console.log(`partially repealed found        ${n(totals.partial)}`)
  console.log(`whole-body dot leaders B2 MISSED ${n(totals.hollowNew)}`)
  console.log(`rows absent from corpus_fts     ${n(totals.missingFromIndex)}${totals.missingFromIndex ? '   ⚠ the index lags corpus_sections; these were skipped, NOT classified clean' : ''}`)
  console.log(EXECUTE ? `rows written                    ${n(totals.written)}` : 'DRY RUN — nothing written.')

  if (EXECUTE) {
    const after = (await p.query(
      `SELECT evidence, count(*)::int n FROM section_repeals GROUP BY 1 ORDER BY n DESC`)).rows
    console.log('\nsection_repeals now:')
    for (const r of after) console.log(`   ${String(r.n).padStart(9)}  ${r.evidence}`)
    console.log('\n⚠ THE EXCLUSION TAKES EFFECT IMMEDIATELY — search-gateway.ts reads section_repeals live,')
    console.log('  so the newly-found whole-body dot leaders stop being returned on the next request. No')
    console.log('  index rebuild, no redeploy. The partial LABELS likewise appear on the next request.')
    console.log('⚠ The rows are still in corpus_fts and still cost a query. Removing them from the index')
    console.log('  is a separate decision with a BM25 cost — see the C3 report.')
  }
  fs.writeFileSync(path.join(OUT, `C3_b3_backfill.${EXECUTE ? 'execute' : 'dryrun'}.json`),
    JSON.stringify({ generated: new Date().toISOString(), executed: EXECUTE, totals }, null, 2))
  await p.end()
}
main().catch((e) => { console.error('FAIL', e); process.exit(1) })
