/**
 * run-ara.ts — INGEST_LEX_FIVE §2.2. Fetches the audited set (docs/ingest_traces/lex_five_s2_fetchset.json)
 * through the real processRow path into corpus `departmental-accounts`, one document at a time,
 * resumable (a document with compiled sections already is skipped), then reads every document back.
 *
 *   tsx lex-five/run-ara.ts            # fetch + read back
 *   tsx lex-five/run-ara.ts --verify   # read back only
 *
 * Verification is on the STORED text: each document's largest section must contain the words that
 * identify an annual report and accounts, not merely exist. Failures are listed by name.
 */
import fs from 'fs'
import path from 'path'
import { processRow } from '../workers/process-row'
import { getNeonPool, endNeonPool } from '../shared/neon-pool'
import { r2Get } from '../shared/r2-client'
import type { QueueRow } from '../shared/queue-client'

const CORPUS = 'departmental-accounts'
const VERIFY_ONLY = process.argv.includes('--verify')

async function main() {
  const set: Array<{ org: string; fy: string; title: string; link: string; date: string }> =
    JSON.parse(fs.readFileSync(path.join(__dirname, '../../../docs/ingest_traces/lex_five_s2_fetchset.json'), 'utf8'))
  const pool = getNeonPool()
  console.log('HOST', new URL(process.env.NEON_DATABASE_URL!).host, VERIFY_ONLY ? 'verify only' : 'FETCH', `${set.length} documents`)

  const failures: string[] = []
  let done = 0, skipped = 0
  const t0 = Date.now()
  for (const doc of set) {
    const docId = doc.link.replace(/^\//, '')
    const have = await pool.query(`select count(*)::int n from corpus_sections where corpus=$1 and "parentDocId"=$2 and status='compiled'`, [CORPUS, docId])
    if (!VERIFY_ONLY && have.rows[0].n === 0) {
      const row = { id: `lexfive:${CORPUS}:${docId}`, corpus: CORPUS, docId, sourceType: 'govuk-content', priority: 3,
        status: 'processing', claimedBy: null, claimedAt: null, completedAt: null, attempts: 0, lastError: null, formatsAvailable: null } as unknown as QueueRow
      try { await processRow(row); done++ } catch (e) { failures.push(`${docId}: threw ${(e as Error).message}`); continue }
      if (done % 10 === 0) console.log(`  fetched ${done}, ${((Date.now() - t0) / 60000).toFixed(1)} min`)
    } else skipped++
  }
  console.log(`fetched ${done}, already held ${skipped}, threw ${failures.length}`)

  // read-back
  const { rows } = await pool.query<{ parentDocId: string; id: string; r2Key: string; format: string; wordCount: number; status: string; itemDate: string | null }>(
    `select "parentDocId", id, "r2Key", format, "wordCount", status, "itemDate"::text from corpus_sections where corpus=$1`, [CORPUS])
  const byDoc = new Map<string, typeof rows>()
  for (const r of rows) byDoc.set(r.parentDocId, [...(byDoc.get(r.parentDocId) ?? []), r])
  let sections = 0, words = 0, chars = 0, ok = 0
  const dupFlag: string[] = []
  for (const doc of set) {
    const docId = doc.link.replace(/^\//, '')
    const secs = (byDoc.get(docId) ?? []).filter(s => s.status === 'compiled')
    if (!secs.length) { failures.push(`${docId}: no compiled sections`); continue }
    const main = secs.filter(s => s.format === 'pdf').sort((a, b) => b.wordCount - a.wordCount)[0]
    if (!main) { failures.push(`${docId}: no PDF section (HTML body only, ${secs.map(s => s.wordCount).join('/')} words)`); sections += secs.length; continue }
    const text = await r2Get(main.r2Key)
    const lc = (text ?? '').toLowerCase()
    chars += text?.length ?? 0
    sections += secs.length
    words += secs.reduce((a, s) => a + (s.wordCount ?? 0), 0)
    const isAccounts = lc.includes('statement of financial position') || lc.includes('statement of comprehensive net expenditure') || lc.includes('statement of financial')
    if (!text || main.wordCount < 5000 || !isAccounts) failures.push(`${docId}: largest PDF ${main.wordCount} words, accounts statements ${isAccounts ? 'present' : 'ABSENT'}`)
    else ok++
    if (secs.filter(s => s.format === 'pdf').length > 1) dupFlag.push(`${docId}: ${secs.filter(s => s.format === 'pdf').map(s => s.wordCount).join('/')}`)
  }
  console.log(`\nREAD BACK: ${ok} of ${set.length} documents have a PDF section of ≥5,000 words containing the financial statements' headings`)
  console.log(`sections ${sections}, words ${words.toLocaleString('en-GB')}, stored chars of the main PDFs ${chars.toLocaleString('en-GB')}`)
  console.log(`undated sections: ${rows.filter(r => !r.itemDate).length}`)
  console.log(`documents with more than one PDF section: ${dupFlag.length}`, dupFlag.slice(0, 15))
  console.log(`\nNOT VERIFIED (${failures.length}):`)
  for (const f of failures) console.log('  ', f)
  await endNeonPool()
}
main().catch(e => { console.error(e); process.exit(1) })
