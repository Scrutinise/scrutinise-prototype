/**
 * run-govuk-docs.ts — INGEST_LEX_FIVE §1/§2. Runs gov.uk publications through the REAL
 * `processRow` path (sourceType 'govuk-content' → processGovukContent: body + PDF attachments),
 * not a private fetcher, then reads the stored text back from R2 and prints what is in it.
 *
 *   tsx lex-five/run-govuk-docs.ts <corpus> <needle1|needle2|…> <docId> [<docId> …]
 *
 * docId is the gov.uk path without the leading slash. No queue row is created; processRow's
 * markDone updates by id and matches nothing.
 *
 * The read-back is the verification: a section count proves nothing about what is in the section
 * (building-regs is 21 of 21 landing pages). Needles are searched in the STORED text.
 */
import { processRow } from '../workers/process-row'
import { getNeonPool, endNeonPool } from '../shared/neon-pool'
import { r2Get } from '../shared/r2-client'
import type { QueueRow } from '../shared/queue-client'

async function main() {
  const [corpus, needleArg, ...docIds] = process.argv.slice(2)
  if (!corpus || !needleArg || docIds.length === 0) throw new Error('usage: <corpus> <needle|needle> <docId>…')
  const needles = needleArg.split('|')
  const pool = getNeonPool()
  console.log('HOST', new URL(process.env.NEON_DATABASE_URL!).host)

  for (const docId of docIds) {
    const row = {
      id: `lexfive:${corpus}:${docId}`, corpus, docId, sourceType: 'govuk-content', priority: 3,
      status: 'processing', claimedBy: null, claimedAt: null, completedAt: null, attempts: 0, lastError: null,
      formatsAvailable: null,
    } as unknown as QueueRow
    console.log(`\n== ${docId}`)
    await processRow(row)

    const { rows } = await pool.query<{ id: string; r2Key: string | null; status: string; format: string | null; wordCount: number | null; sectionTitle: string | null; sourceUrl: string; itemDate: string | null; availability_note: string | null }>(
      `select id, "r2Key", status, format, "wordCount", "sectionTitle", "sourceUrl", "itemDate"::text, availability_note
         from corpus_sections where corpus = $1 and "parentDocId" = $2 order by id`, [corpus, docId])
    for (const r of rows) {
      const text = r.r2Key ? await r2Get(r.r2Key) : null
      const hits = text ? needles.map(n => `${n}=${(text.toLowerCase().split(n.toLowerCase()).length - 1)}`).join(' ') : 'NO TEXT'
      console.log(`  ${r.id} | ${r.status} ${r.format ?? ''} | words ${r.wordCount} | date ${r.itemDate} | ${r.sectionTitle}`)
      console.log(`    ${r.sourceUrl}`)
      console.log(`    stored chars ${text?.length ?? 0} | needles: ${hits}${r.availability_note ? ' | note: ' + r.availability_note : ''}`)
      if (text) console.log(`    head: ${text.slice(0, 160).replace(/\s+/g, ' ')}`)
    }
  }
  await endNeonPool()
}
main().catch(e => { console.error(e); process.exit(1) })
