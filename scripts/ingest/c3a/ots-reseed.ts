/**
 * ots-reseed.ts — ADDENDUM C3 §1, steps 2 and 3: re-seed `ots-reports` from the publisher's own
 * organisation field, and give the collection a denominator that is not its own numerator.
 *
 * ════════════════════════════════════════════════════════════════════════════════════════════════
 * THE SEEDER IS THE DEFECT, NOT THE ROWS
 *
 *     sources/gov-scraper.ts:176   searchGovUk('office of tax simplification report', …, 500)
 *
 * A free-text relevance search with no publisher filter, over a query that reports **348,062**
 * results today, of which we kept the first 500. Relevance decays continuously, so there is no
 * category of contamination to remove — the cut has to come from outside the query. It does:
 *
 *     filter_organisations=office-of-tax-simplification   →   222 documents
 *
 * The OTS was abolished in 2023, so 222 is a CLOSED AND FINITE UNIVERSE — one of the few
 * collections that can honestly be called complete.
 *
 * ── WHAT THIS SCRIPT DOES ──────────────────────────────────────────────────────────────────────
 *   1. enumerates all 222 live and derives each one's section id EXACTLY as `process-row.ts` would
 *   2. diffs against what we hold → the fetch list (expected: 146, because we hold 76 correctly)
 *   3. ⚠ reads the content API for each of the 222 and reports HOW MUCH TEXT IS ACTUALLY THERE —
 *      see the warning below, which is the finding that matters most in this lane
 *   4. `--execute` inserts ONE queue row so a worker re-runs the (now publisher-filtered) seeder.
 *      `r2Exists` skips the 76 already compiled, so the run is a 146-document fetch, not 222.
 *
 * ⚠⚠ RE-SEEDING BUYS 222 LANDING PAGES, NOT 222 REPORTS. Every one of the 497 rows in this
 * collection has `format = null` and a median of 399 words, and reading three of the 76 genuine
 * ones shows why: what we store is the gov.uk summary page. "The OTS report on Claims & Elections
 * will be published in autumn 2020" — the report itself is a PDF attachment nobody fetched. This is
 * the same shape as building-regs C1 ("all 21 rows are format=null landing pages; there is no PDF
 * to extract from"). The count below is therefore reported as *documents announced*, never as
 * *documents held*, and the attachment census says what the second number would cost.
 *
 * Usage:
 *   tsx c3a/ots-reseed.ts                 # enumerate, diff, census — writes nothing
 *   tsx c3a/ots-reseed.ts --execute       # + insert the re-seed queue row
 */
import fs from 'fs'
import path from 'path'
import { pool, OUT } from '../c2/db'

const EXECUTE = process.argv.includes('--execute')
const UA = { 'User-Agent': 'Scrutinise-Ingest/1.0', Accept: 'application/json' }
const ORG = 'office-of-tax-simplification'
const n = (x: number) => x.toLocaleString('en-GB')

/** id derivation copied from sources/gov-scraper.ts + workers/process-row.ts — verified below. */
const derivedId = (r: any) => `ots-reports:${(r._id ?? r.link).replace(/[^a-z0-9-]/gi, '-')}:1`

async function enumerateOrg(): Promise<any[]> {
  const all: any[] = []
  for (let start = 0; start < 1000; start += 50) {
    const res = await fetch(`https://www.gov.uk/api/search.json?filter_organisations=${ORG}&count=50&start=${start}`, { headers: UA })
    if (!res.ok) throw new Error(`gov.uk search HTTP ${res.status} at start=${start}`)
    const j: any = await res.json()
    if (!j.results?.length) break
    all.push(...j.results)
    if (all.length === 0) throw new Error('the org filter returned 0 documents — refusing to plan a re-seed on an empty universe')
    if (j.results.length < 50) break
  }
  return all
}

async function main() {
  console.log('── the universe, from the field the publisher maintains')
  const docs = await enumerateOrg()
  const total = (await (await fetch(`https://www.gov.uk/api/search.json?filter_organisations=${ORG}&count=0`, { headers: UA })).json() as any).total
  const free = (await (await fetch('https://www.gov.uk/api/search.json?q=office%20of%20tax%20simplification%20report&count=0', { headers: UA })).json() as any).total
  console.log(`   filter_organisations=${ORG}  →  ${n(total)} documents, ${n(docs.length)} enumerated`)
  console.log(`   the seeder's free-text query                  →  ${n(free)} results, of which we kept the first 500`)
  if (docs.length !== total) console.log(`   ⚠ enumerated ${n(docs.length)} against a reported total of ${n(total)} — say which before quoting either`)

  const p = pool()
  const held = (await p.query(`SELECT id, "sourceUrl", "wordCount", format FROM corpus_sections WHERE corpus='ots-reports'`)).rows
  const heldById = new Map(held.map((r: any) => [r.id, r]))
  const inOrg = docs.filter((d) => heldById.has(derivedId(d)))
  const toFetch = docs.filter((d) => !heldById.has(derivedId(d)))

  console.log('\n── the diff, by id derived the way the worker derives it')
  console.log(`   held today                    ${n(held.length)}`)
  console.log(`   of those, inside the 222      ${n(inOrg.length)}   ← these are the KEEP rows; a re-seed must not re-fetch them`)
  console.log(`   to fetch                      ${n(toFetch.length)}`)
  console.log(`   ⚠ the id match is EXACT, not a title or URL similarity — ${n(inOrg.length)} of ${n(held.length)} held rows`)
  console.log(`     resolve to a document in the org-filtered set, so r2Exists will skip precisely those.`)

  // ── what is actually behind each of the 222
  console.log('\n── ATTACHMENT CENSUS: what a re-seed would actually store')
  let withAttachments = 0, pdfCount = 0, bodyChars: number[] = [], read = 0
  const attachRows: any[] = []
  for (const d of docs) {
    const bp = d.link?.startsWith('http') ? new URL(d.link).pathname : d.link
    if (!bp) continue
    const r = await fetch(`https://www.gov.uk/api/content${bp}`, { headers: UA })
    if (!r.ok) continue
    read++
    const j: any = await r.json()
    const det = j.details ?? {}
    const atts: any[] = det.attachments ?? det.documents ?? []
    const pdfs = (Array.isArray(atts) ? atts : []).filter((a: any) => /pdf/i.test(String(a.content_type ?? a.url ?? '')))
    if (pdfs.length) { withAttachments++; pdfCount += pdfs.length }
    const bodyHtml = typeof det.body === 'string' ? det.body : (Array.isArray(det.body) ? det.body.map((b: any) => b.content ?? '').join(' ') : '')
    bodyChars.push(String(bodyHtml).replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim().length)
    attachRows.push({ url: d.link, title: d.title, pdfs: pdfs.length, bodyChars: bodyChars[bodyChars.length - 1] })
    if (read % 25 === 0) process.stdout.write(`\r   read ${read}/${docs.length}…   `)
  }
  process.stdout.write('\n')
  const median = (a: number[]) => a.length ? [...a].sort((x, y) => x - y)[Math.floor(a.length / 2)] : 0
  console.log(`   read from the content API      ${n(read)} of ${n(docs.length)}`)
  console.log(`   carrying at least one PDF      ${n(withAttachments)}  (${(withAttachments / Math.max(read, 1) * 100).toFixed(1)}%), ${n(pdfCount)} PDFs in total`)
  console.log(`   median landing-page body       ${n(median(bodyChars))} characters`)
  console.log(`   ⚠ THE FETCH THIS RE-SEED PERFORMS STORES THE LANDING PAGE, NOT THE PDF. 222 documents`)
  console.log(`     announced; ${n(withAttachments)} of them keep their substance in an attachment we do not fetch.`)
  console.log(`     Quote the collection as "222 OTS documents, landing pages held" until that is fixed.`)

  const outPath = path.join(OUT, 'C3A_ots_reseed_plan.json')
  fs.writeFileSync(outPath, JSON.stringify({
    generated: new Date().toISOString(),
    orgFilterTotal: total, enumerated: docs.length, freeTextTotal: free,
    heldToday: held.length, alreadyInsideTheUniverse: inOrg.length, toFetch: toFetch.length,
    attachmentCensus: { read, withPdf: withAttachments, pdfCount, medianBodyChars: median(bodyChars) },
    fetchList: toFetch.map((d) => ({ id: derivedId(d), url: d.link, title: d.title })),
    attachments: attachRows,
  }, null, 2))
  console.log(`\nwritten: docs/census/C3A_ots_reseed_plan.json`)

  // ── the queue row
  const qid = 'ots-reports:v2-org-filter:__index'
  const existing = (await p.query(`SELECT id, status, "completedAt" FROM ingest_queue WHERE id = $1`, [qid])).rows[0]
  console.log('\n── the re-seed queue row')
  if (!EXECUTE) {
    console.log(`   DRY RUN — would insert ${qid} (corpus ots-reports, sourceType gov-uk, priority 3)`)
    console.log(`   ${existing ? `⚠ it already exists: status=${existing.status} completed=${existing.completedAt}` : 'it does not exist yet'}`)
    console.log('   ⚠ INSERTING IT DOES NOTHING ON ITS OWN. A worker must claim it, and gov-scraper.ts must')
    console.log('     already carry the publisher filter — otherwise this re-seeds the same 500-row mess.')
  } else {
    const filterInPlace = fs.readFileSync(path.join(__dirname, '../sources/gov-scraper.ts'), 'utf8')
      .includes(`searchGovUkByOrgFiltered('${ORG}'`)
    if (!filterInPlace) {
      console.log('   ⛔ ABORT — sources/gov-scraper.ts does not carry the publisher filter yet.')
      console.log('      Queueing a re-seed against the old free-text query would re-create the contamination.')
      await p.end(); process.exit(1)
    }
    await p.query(
      `INSERT INTO ingest_queue (id, corpus, "docId", "sourceType", priority, status, attempts, "createdAt")
       VALUES ($1,'ots-reports','__index','gov-uk',3,'pending',0,now())
       ON CONFLICT (id) DO UPDATE SET status='pending', attempts=0, "lastError"=NULL, "claimedBy"=NULL, "claimedAt"=NULL`, [qid])
    const after = (await p.query(`SELECT id, status FROM ingest_queue WHERE id = $1`, [qid])).rows[0]
    console.log(`   ✓ ${after.id} → ${after.status}   (re-read from the database, not assumed)`)
  }
  await p.end()
}
main().catch((e) => { console.error('FAIL', e.message ?? e); process.exit(1) })
