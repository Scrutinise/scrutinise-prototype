/**
 * ots-filter.ts — LANE A. `ots-reports` is a FILTER, not a purge.
 *
 * ════════════════════════════════════════════════════════════════════════════════════════════════
 * WHAT A USER WOULD HAVE SEEN
 * Ask about tax simplification and get back a gov.uk page for signing in to manage a student loan
 * balance, an algorithmic-transparency record for a pension calculator, or the Welsh investment
 * zones technical document — each presented as an Office of Tax Simplification report.
 *
 * WHY — AND THIS IS NOT WHAT THE BRIEF SAYS IT IS. The brief describes `ots-reports` as "roughly
 * 14% contaminated: at least 69 of 497 rows are news stories and speeches, and the other ~428 are
 * real OTS reports". Read the seeder and that framing does not survive:
 *
 *     sources/gov-scraper.ts:176
 *     yield* searchGovUk('office of tax simplification report', 'ots-reports', 500)
 *
 * It is a FREE-TEXT RELEVANCE SEARCH with no publisher filter, capped at 500. Measured 24 Aug 2026:
 * that query reports **total: 347,938**. We took the first 500 of 347,938 gov.uk pages ranked by
 * relevance to a phrase. Results 481–485 are *Spring Budget 2017: documents*, *Summer Budget 2015*
 * and *Notices made under The Customs (Import Duty) (EU Exit) Regulations 2018*. There is no
 * category of contamination to remove — relevance decays continuously, so the only question is
 * where the cut falls, and a cut has to come from outside the query.
 *
 * ⚠ `document_type` CANNOT MAKE THAT CUT, and the brief anticipated this ("if the type field does
 * not cleanly separate them, read ten bodies before writing the rule"). Measured: the genuine OTS
 * output is `policy_paper` and `corporate_report` — and so is *Spring Budget 2017: documents*. The
 * types overlap completely.
 *
 * ── THE INSTRUMENT THAT DOES WORK: WHO PUBLISHED IT ─────────────────────────────────────────────
 * gov.uk records the publishing organisation on every document.
 * `filter_organisations=office-of-tax-simplification` returns **222** documents — the whole OTS
 * output, from a field the publisher maintains rather than one we inferred. That is the universe
 * this collection was always meant to be.
 *
 * ⚠ The collection page `source-audit.ts` has been checking since V1 —
 * `/government/collections/office-of-tax-simplification-reports` — **404s on the content API.**
 * The audit reads the HTML URL and asserts `minSize: 5000`, which a gov.uk 404 page satisfies. A
 * size floor is not an existence check.
 *
 * ── HOW A ROW IS CLASSIFIED ─────────────────────────────────────────────────────────────────────
 *   KEEP    the content API lists `office-of-tax-simplification` among the document's
 *           organisations (or among `links.organisations` / `links.primary_publishing_organisation`)
 *   DELETE  it does not
 *   HOLD    the content API 404s, errors, or the URL is not a gov.uk content path — NOT deleted.
 *           An unreadable row is an unknown, and deleting unknowns is how 428 genuine documents
 *           would go with the rest.
 *
 * Ten bodies are read and printed before any rule is applied — `--read-ten`, run first and its
 * output quoted in the report, because "the URL test was wrong one time in seven".
 *
 * ⚠ WRITES INCREMENTALLY. The classification is appended to a JSONL as each row is decided, so a
 * crash on request 496 does not lose the other 495 (`l2-measure.ts` lost a whole run to a single
 * writeFileSync at the end).
 *
 * Usage:
 *   tsx c2/ots-filter.ts --read-ten            # read ten bodies, apply no rule
 *   tsx c2/ots-filter.ts --classify            # fetch + classify all 497, write JSONL, no deletes
 *   tsx c2/ots-filter.ts --report              # summarise the JSONL
 *   tsx c2/ots-filter.ts --apply               # delete the DELETE rows (three layers)
 */
import fs from 'fs'
import path from 'path'
import { pool, OUT } from './db'

const MODE = process.argv.find((a) => ['--read-ten', '--classify', '--report', '--apply'].includes(a)) ?? '--report'
const UA = 'ScrutiniseBot/1.0 (+https://www.scrutinise.org)'
const OTS_ORG = 'office-of-tax-simplification'
const JSONL = path.join(OUT, 'C3_ots_classification.jsonl')
const CONC = 4
const n = (x: number) => x.toLocaleString('en-GB')

interface Row { id: string; sourceUrl: string | null; wordCount: number | null; r2Key: string | null }
interface Verdict {
  id: string; url: string | null; basePath: string | null
  status: number | null; title: string | null; documentType: string | null
  orgs: string[]; verdict: 'KEEP' | 'DELETE' | 'HOLD'; reason: string
}

function basePathOf(url: string | null): string | null {
  if (!url) return null
  try {
    const u = new URL(url)
    if (u.hostname !== 'www.gov.uk' && u.hostname !== 'gov.uk') return null
    return u.pathname
  } catch { return null }
}

async function classifyOne(r: Row): Promise<Verdict> {
  const bp = basePathOf(r.sourceUrl)
  if (!bp) {
    return { id: r.id, url: r.sourceUrl, basePath: null, status: null, title: null, documentType: null,
      orgs: [], verdict: 'HOLD', reason: 'sourceUrl is not a gov.uk content path — cannot be classified, so it is not deleted' }
  }
  let res: Response
  try {
    res = await fetch(`https://www.gov.uk/api/content${bp}`, { headers: { 'User-Agent': UA } })
  } catch (e: any) {
    return { id: r.id, url: r.sourceUrl, basePath: bp, status: null, title: null, documentType: null,
      orgs: [], verdict: 'HOLD', reason: `content API unreachable (${e.message}) — unknown, not deleted` }
  }
  if (!res.ok) {
    return { id: r.id, url: r.sourceUrl, basePath: bp, status: res.status, title: null, documentType: null,
      orgs: [], verdict: 'HOLD', reason: `content API HTTP ${res.status} — unknown, not deleted` }
  }
  const d = await res.json() as any
  const links = d.links ?? {}
  const orgSets = [links.organisations, links.primary_publishing_organisation, links.original_primary_publishing_organisation, links.worldwide_organisations]
  const orgs = [...new Set(orgSets.flat().filter(Boolean).map((o: any) => String(o.base_path ?? '').replace('/government/organisations/', '')))].filter(Boolean) as string[]
  const isOts = orgs.includes(OTS_ORG)
  return {
    id: r.id, url: r.sourceUrl, basePath: bp, status: res.status,
    title: d.title ?? null, documentType: d.document_type ?? null, orgs,
    verdict: isOts ? 'KEEP' : 'DELETE',
    reason: isOts
      ? `published by ${OTS_ORG}`
      : `published by ${orgs.length ? orgs.join(', ') : '(no organisation recorded)'} — not the OTS`,
  }
}

async function readTen() {
  const p = pool()
  const { r2Get } = await import('../shared/r2-client')
  const rows: Row[] = (await p.query(
    `SELECT id, "sourceUrl", "wordCount", "r2Key" FROM corpus_sections
      WHERE corpus='ots-reports' AND "r2Key" IS NOT NULL ORDER BY md5(id) LIMIT 10`)).rows
  console.log('=== TEN BODIES, READ BEFORE ANY RULE WAS WRITTEN ===')
  console.log('(deterministic sample: ORDER BY md5(id) LIMIT 10 — reproducible, not cherry-picked)\n')
  for (const r of rows) {
    const v = await classifyOne(r)
    let body = ''
    try { body = (await r2Get(r.r2Key!)) ?? '' } catch (e: any) { body = `(r2 read failed: ${e.message})` }
    console.log(`── ${r.id}`)
    console.log(`   url          ${r.sourceUrl}`)
    console.log(`   title        ${v.title}`)
    console.log(`   document_type ${v.documentType}`)
    console.log(`   organisations ${v.orgs.join(', ') || '(none)'}`)
    console.log(`   words        ${r.wordCount}`)
    console.log(`   opening 260  ${body.replace(/\s+/g, ' ').slice(0, 260)}`)
    console.log(`   → ${v.verdict}: ${v.reason}\n`)
  }
  await p.end()
}

async function classify() {
  const p = pool()
  const rows: Row[] = (await p.query(
    `SELECT id, "sourceUrl", "wordCount", "r2Key" FROM corpus_sections WHERE corpus='ots-reports' ORDER BY id`)).rows
  console.log(`classifying ${n(rows.length)} rows against the gov.uk content API (concurrency ${CONC})`)
  fs.writeFileSync(JSONL, '')                       // one output path per run; truncated deliberately
  const stream = fs.createWriteStream(JSONL, { flags: 'a' })
  let done = 0
  const queue = [...rows]
  const workers = Array.from({ length: CONC }, async () => {
    for (;;) {
      const r = queue.shift()
      if (!r) return
      const v = await classifyOne(r)
      stream.write(JSON.stringify(v) + '\n')        // written as decided, not at the end
      done++
      if (done % 25 === 0) process.stdout.write(`\r  ${done}/${rows.length}…   `)
    }
  })
  await Promise.all(workers)
  stream.end()
  process.stdout.write('\n')
  await p.end()
  await report()
}

async function report() {
  if (!fs.existsSync(JSONL)) { console.error(`no ${JSONL} — run --classify first`); process.exit(1) }
  const vs: Verdict[] = fs.readFileSync(JSONL, 'utf8').split('\n').filter(Boolean).map((l) => JSON.parse(l))
  const by = (v: string) => vs.filter((x) => x.verdict === v)
  console.log(`\n=== ots-reports, ${n(vs.length)} rows classified by PUBLISHER, not by document_type ===`)
  console.log(`  KEEP   ${n(by('KEEP').length)}   published by ${OTS_ORG}`)
  console.log(`  DELETE ${n(by('DELETE').length)}   published by somebody else`)
  console.log(`  HOLD   ${n(by('HOLD').length)}   unreadable — not deleted`)

  const types = new Map<string, { keep: number; del: number }>()
  for (const v of vs) {
    if (v.verdict === 'HOLD') continue
    const t = v.documentType ?? '(none)'
    const e = types.get(t) ?? { keep: 0, del: 0 }
    if (v.verdict === 'KEEP') e.keep++; else e.del++
    types.set(t, e)
  }
  console.log('\n── why document_type could not have been the rule (types carrying BOTH verdicts)')
  const both = [...types].filter(([, e]) => e.keep > 0 && e.del > 0).sort((a, b) => (b[1].keep + b[1].del) - (a[1].keep + a[1].del))
  if (both.length === 0) console.log('   none — document_type would in fact have separated them cleanly.')
  for (const [t, e] of both) console.log(`   ${t.padEnd(26)} KEEP ${String(e.keep).padStart(4)}   DELETE ${String(e.del).padStart(4)}`)

  const orgCount = new Map<string, number>()
  for (const v of by('DELETE')) for (const o of (v.orgs.length ? v.orgs : ['(no organisation recorded)'])) orgCount.set(o, (orgCount.get(o) ?? 0) + 1)
  console.log('\n── who actually published the rows being removed (top 12)')
  for (const [o, c] of [...orgCount].sort((a, b) => b[1] - a[1]).slice(0, 12)) console.log(`   ${String(c).padStart(4)}  ${o}`)

  console.log('\n── 10 of the rows being removed')
  for (const v of by('DELETE').slice(0, 10)) console.log(`   [${v.documentType}] ${v.title}\n        ${v.url}`)
  if (by('HOLD').length) {
    console.log('\n── every row HELD (unreadable, kept)')
    for (const v of by('HOLD')) console.log(`   ${v.reason}\n        ${v.url}`)
  }
  console.log(`\n${JSONL}`)
}

async function apply() {
  if (!fs.existsSync(JSONL)) { console.error(`no ${JSONL} — run --classify first`); process.exit(1) }
  const vs: Verdict[] = fs.readFileSync(JSONL, 'utf8').split('\n').filter(Boolean).map((l) => JSON.parse(l))
  const del = vs.filter((v) => v.verdict === 'DELETE').map((v) => v.id)
  const p = pool()
  const live = (await p.query(`SELECT count(*)::int n FROM corpus_sections WHERE corpus='ots-reports'`)).rows[0].n
  if (live !== vs.length) {
    console.log(`⛔ ABORT — the collection holds ${n(live)} rows and the classification covers ${n(vs.length)}.`)
    console.log('   Re-classify; a stale verdict list must not drive a delete.')
    await p.end(); process.exit(1)
  }
  console.log(`deleting ${n(del.length)} of ${n(live)} rows from corpus_sections (${n(live - del.length)} survive)`)
  const backup = path.join(__dirname, 'purge-manifests', `ots-reports.${new Date().toISOString().replace(/[:.]/g, '-')}.json`)
  fs.mkdirSync(path.dirname(backup), { recursive: true })
  const rows = (await p.query(`SELECT * FROM corpus_sections WHERE id = ANY($1)`, [del])).rows
  fs.writeFileSync(backup, JSON.stringify({ generated: new Date().toISOString(), count: rows.length, rows }))
  console.log(`  manifest (full rows, reinstatable): ${path.relative(process.cwd(), backup)}`)
  const r = await p.query(`DELETE FROM corpus_sections WHERE id = ANY($1)`, [del])
  const after = (await p.query(`SELECT count(*)::int n FROM corpus_sections WHERE corpus='ots-reports'`)).rows[0].n
  console.log(`  deleted ${n(r.rowCount ?? 0)}; ${n(after)} rows remain  ${after === live - del.length ? '✓' : '⚠ MISMATCH'}`)
  fs.writeFileSync(path.join(path.dirname(backup), `ots-reports.ids.txt`), del.join('\n'))
  console.log('\n⚠ INDEX LAYER NOT DONE HERE — pass these ids to the corpus_fts / corpus_chunks / corpus_vec')
  console.log('  delete, then redeploy fts-serve and vector-serve. Until then a user still gets them.')
  await p.end()
}

async function main() {
  if (MODE === '--read-ten') return readTen()
  if (MODE === '--classify') return classify()
  if (MODE === '--apply') return apply()
  return report()
}
main().catch((e) => { console.error('FAIL', e); process.exit(1) })
