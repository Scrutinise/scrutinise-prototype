/**
 * audit-caselaw.ts — BRIEF_INGEST_NAMES §1.1.
 * Sample tna-caselaw rows; report where the case name actually lives:
 *  - stored AKN raw XML in R2  (structured source fields: FRBRname / docTitle / neutralCitation)
 *  - stored compiled text      (head-of-document shapes)
 * Nothing is written. Prints shape frequencies + full examples.
 */
import { getNeonPool, endNeonPool } from '../shared/neon-pool'
import { r2Get } from '../shared/r2-client'

const N = parseInt(process.argv.find(a => a.startsWith('--n='))?.split('=')[1] ?? '100', 10)
const CORPUS = process.argv.find(a => a.startsWith('--corpus='))?.split('=')[1] ?? 'tna-caselaw'

function pick(rx: RegExp, s: string): string | null {
  const m = rx.exec(s)
  return m ? (m[1] ?? '').trim() || null : null
}

;(async () => {
  const p = getNeonPool()
  // Deterministic sample: hash the id so re-runs read the same rows (S8 §2's LIMIT-without-ORDER-BY bug).
  const rows = (await p.query(
    `SELECT id, "sourceUrl", "r2Key", "r2RawKey", "wordCount", "sectionTitle", "itemDate", status
       FROM corpus_sections WHERE corpus = $1
       ORDER BY md5(id) LIMIT $2`, [CORPUS, N])).rows

  console.log(`sampled ${rows.length} ${CORPUS} rows (deterministic: ORDER BY md5(id))\n`)

  const tally: Record<string, number> = {}
  const bump = (k: string) => { tally[k] = (tally[k] ?? 0) + 1 }
  const examples: string[] = []
  let rawPresent = 0, compiledPresent = 0

  for (const r of rows) {
    const raw = r.r2RawKey ? await r2Get(r.r2RawKey) : null
    const compiled = r.r2Key ? await r2Get(r.r2Key) : null
    if (raw) rawPresent++
    if (compiled) compiledPresent++

    // ── structured fields in the AKN (Akoma Ntoso) XML the source publishes ──
    const frbrName   = raw ? pick(/<FRBRname\s+value="([^"]*)"/, raw) : null
    const docTitle   = raw ? pick(/<docTitle[^>]*>([\s\S]*?)<\/docTitle>/, raw)?.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim() ?? null : null
    const ncn        = raw ? pick(/<uk:cite[^>]*>([^<]*)<\/uk:cite>/, raw) ?? pick(/<neutralCitation[^>]*>([^<]*)<\/neutralCitation>/, raw) : null
    const court      = raw ? pick(/<uk:court[^>]*>([^<]*)<\/uk:court>/, raw) : null
    const docDate    = raw ? pick(/<FRBRdate\s+date="([^"]*)"[^>]*name="(?:judgment|decision|transform)"/, raw) ?? pick(/<FRBRdate\s+date="([^"]*)"/, raw) : null

    bump(`raw:${raw ? 'present' : 'MISSING'}`)
    if (raw) {
      bump(`FRBRname:${frbrName ? 'present' : 'absent'}`)
      bump(`docTitle:${docTitle ? 'present' : 'absent'}`)
      bump(`uk:cite:${ncn ? 'present' : 'absent'}`)
      bump(`uk:court:${court ? 'present' : 'absent'}`)
      if (frbrName && docTitle) bump(frbrName === docTitle ? 'FRBRname==docTitle' : 'FRBRname!=docTitle')
    }
    // ── head of the compiled text we already hold ──
    const head = (compiled ?? '').replace(/\r/g, '').split('\n').map(l => l.trim()).filter(Boolean).slice(0, 6)
    if (compiled) {
      const hasVLine = head.some(l => /\sv\.?\s/i.test(l) && l.length < 200)
      bump(`compiled head has "X v Y" line:${hasVLine ? 'yes' : 'no'}`)
    }

    if (examples.length < 3 && raw) {
      examples.push([
        `── EXAMPLE ${examples.length + 1} ─────────────────────────────`,
        `id           ${r.id}`,
        `sourceUrl    ${r.sourceUrl}`,
        `r2RawKey     ${r.r2RawKey}`,
        `wordCount    ${r.wordCount}   status ${r.status}   sectionTitle ${JSON.stringify(r.sectionTitle)}   itemDate ${r.itemDate}`,
        `FRBRname     ${JSON.stringify(frbrName)}`,
        `docTitle     ${JSON.stringify(docTitle)}`,
        `uk:cite      ${JSON.stringify(ncn)}`,
        `uk:court     ${JSON.stringify(court)}`,
        `FRBRdate     ${JSON.stringify(docDate)}`,
        `compiled head:`,
        ...head.map(l => `   | ${l.slice(0, 160)}`),
      ].join('\n'))
    }
  }

  console.log('SHAPE FREQUENCIES (n=' + rows.length + ')')
  for (const [k, v] of Object.entries(tally).sort()) console.log(`  ${k.padEnd(40)} ${v}`)
  console.log(`\nR2 objects present: raw ${rawPresent}/${rows.length}, compiled ${compiledPresent}/${rows.length}\n`)
  console.log(examples.join('\n\n'))
  await endNeonPool()
})().catch(e => { console.error(e); process.exit(1) })
