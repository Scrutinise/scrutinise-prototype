/**
 * c2-et503-probe.ts — C3 LANE C2. Is there a real judgment behind the 503, or a dead link?
 *
 * ════════════════════════════════════════════════════════════════════════════════════════════════
 * THE NUMBER IS 503, NOT 131,650. C1 and C2 Lane 2 both measured that 131,147 of the 131,650
 * `et-decisions` landing pages already have the real judgment PDF ingested beside them under the
 * same `parentDocId`. The purge destroys a pointer for the other 503 and nothing else. The brief
 * asks for 200 fetched to a scratch directory first, and the share that resolve REPORTED — not a
 * re-ingest, because whether these are worth re-fetching is the question, not the assumption.
 *
 * ⚠ NOTHING IS WRITTEN TO THE DATABASE OR TO R2. Bodies go to the session scratchpad.
 *
 * ⚠ A 200 IS NOT A JUDGMENT. gov.uk serves a styled 404 page with HTTP 200 in some paths, and a
 * landing page that still exists but has lost its attachment is exactly the case being counted. So
 * the classification is made from the CONTENT API's own fields — does the page still exist, and
 * does it carry a PDF attachment — rather than from the status code:
 *
 *     has-pdf        the content API lists ≥1 application/pdf attachment → re-fetchable, real
 *     no-attachment  the page exists and lists none → nothing to fetch; the landing page IS all
 *                    there is, so deleting it loses a title and a date and no judgment text
 *     gone           404/410 from the content API → a dead link; deleting it loses nothing
 *     error          anything else — counted separately, never folded into `gone`
 *
 * ⚠ THE LAST DISTINCTION IS THE ONE THAT MATTERS AND HAS BEEN GOT WRONG BEFORE. On 17 Aug a
 * freshness probe manufactured two "gone" verdicts out of 403s. An error is not an absence.
 *
 * Usage:
 *   tsx c2/c2-et503-probe.ts --n=200 [--out=<dir>] [--fetch-pdf]
 */
import fs from 'fs'
import path from 'path'
import { OUT } from './db'

const arg = (k: string) => (process.argv.find((a) => a.startsWith(`--${k}=`)) ?? '').split('=')[1] || null
const N = parseInt(arg('n') ?? '200', 10)
const FETCH_PDF = process.argv.includes('--fetch-pdf')
const OUTDIR = arg('out') ?? path.join(
  'C:/Users/charl/AppData/Local/Temp/claude/C--Code-scrutinise-prototype',
  'bf7fc90f-a686-462a-8cb3-32cdc44d81c6/scratchpad/et503')
const LIST = path.join(OUT, 'C2_L2_et_refetch_list.json')
const UA = 'ScrutiniseBot/1.0 (+https://www.scrutinise.org)'
const CONC = 4
const n = (x: number) => x.toLocaleString('en-GB')

type Verdict = 'has-pdf' | 'no-attachment' | 'gone' | 'error'
interface Row { id: string; parentDocId: string; sourceUrl: string }
interface Result {
  id: string; url: string; verdict: Verdict; status: number | null
  title: string | null; documentType: string | null; attachments: number
  firstPdf: string | null; note: string
}

async function classify(r: Row): Promise<Result> {
  const base = { id: r.id, url: r.sourceUrl, title: null, documentType: null, attachments: 0, firstPdf: null }
  let bp: string
  try { bp = new URL(r.sourceUrl).pathname } catch { return { ...base, verdict: 'error', status: null, note: 'unparseable sourceUrl' } }
  let res: Response
  try { res = await fetch(`https://www.gov.uk/api/content${bp}`, { headers: { 'User-Agent': UA } }) }
  catch (e: any) { return { ...base, verdict: 'error', status: null, note: `unreachable: ${e.message}` } }
  if (res.status === 404 || res.status === 410) return { ...base, verdict: 'gone', status: res.status, note: 'the content API says the page no longer exists' }
  if (!res.ok) return { ...base, verdict: 'error', status: res.status, note: `HTTP ${res.status} — an error, NOT an absence` }
  const d = await res.json() as any
  const atts = ((d.details?.attachments ?? []) as any[]).filter((a) => a?.content_type === 'application/pdf' && a?.url)
  return {
    id: r.id, url: r.sourceUrl, status: res.status,
    title: d.title ?? null, documentType: d.document_type ?? null,
    attachments: atts.length, firstPdf: atts[0]?.url ?? null,
    verdict: atts.length ? 'has-pdf' : 'no-attachment',
    note: atts.length ? `${atts.length} PDF attachment(s)` : 'the page exists and carries no PDF — the landing page is all there is',
  }
}

async function main() {
  if (!fs.existsSync(LIST)) { console.error(`no ${LIST} — run c2/l2-et-503.ts first`); process.exit(1) }
  const doc = JSON.parse(fs.readFileSync(LIST, 'utf8'))
  const all: Row[] = doc.list
  console.log(`refetch list: ${n(all.length)} landing pages with nothing behind them (generated ${doc.generated})`)
  // Deterministic, reproducible, and NOT the first N — the list is id-ordered, so the first N would
  // sample one alphabetic slice of tribunal names.
  const sample = [...all].sort((a, b) => (a.id < b.id ? -1 : 1))
    .filter((_, i) => i % Math.max(1, Math.floor(all.length / N)) === 0).slice(0, N)
  console.log(`probing ${n(sample.length)} (every ${Math.max(1, Math.floor(all.length / N))}th, id-ordered — a systematic sample, not the head)\n`)
  fs.mkdirSync(OUTDIR, { recursive: true })

  const results: Result[] = []
  const queue = [...sample]
  const jsonl = fs.createWriteStream(path.join(OUTDIR, 'verdicts.jsonl'), { flags: 'w' })
  await Promise.all(Array.from({ length: CONC }, async () => {
    for (;;) {
      const r = queue.shift(); if (!r) return
      const v = await classify(r)
      results.push(v); jsonl.write(JSON.stringify(v) + '\n')     // written as decided
      if (results.length % 25 === 0) process.stdout.write(`\r  ${results.length}/${sample.length}…   `)
      if (FETCH_PDF && v.firstPdf) {
        try {
          const pr = await fetch(v.firstPdf, { headers: { 'User-Agent': UA } })
          if (pr.ok) fs.writeFileSync(path.join(OUTDIR, `${v.id.replace(/[^a-z0-9]/gi, '_').slice(-100)}.pdf`),
            Buffer.from(await pr.arrayBuffer()))
        } catch { /* the byte fetch is a bonus; the verdict above is the measurement */ }
      }
    }
  }))
  jsonl.end()
  process.stdout.write('\n\n')

  const by = (v: Verdict) => results.filter((r) => r.verdict === v)
  console.log(`=== ${n(results.length)} of the 503 probed ===`)
  for (const v of ['has-pdf', 'no-attachment', 'gone', 'error'] as Verdict[]) {
    const k = by(v).length
    console.log(`  ${v.padEnd(15)} ${String(k).padStart(4)}   ${((100 * k) / results.length).toFixed(1)}%`)
  }
  const projected = Math.round((by('has-pdf').length / results.length) * all.length)
  console.log(`\n→ projected across all ${n(all.length)}: ${n(projected)} have a real judgment PDF to re-fetch.`)
  console.log(`  ⚠ the other ${n(all.length - projected)} would lose only a landing page — a title, a date and a URL,`)
  console.log('    with no judgment text behind it, which is what the purge was always going to remove.')

  const types = new Map<string, number>()
  for (const r of results) types.set(r.documentType ?? '(none)', (types.get(r.documentType ?? '(none)') ?? 0) + 1)
  console.log('\n── document_type of what came back')
  for (const [t, c] of [...types].sort((a, b) => b[1] - a[1])) console.log(`   ${String(c).padStart(4)}  ${t}`)

  if (by('error').length) {
    console.log('\n── every ERROR, listed rather than folded into "gone"')
    for (const r of by('error')) console.log(`   ${r.status ?? '—'}  ${r.note}  ${r.url}`)
  }
  console.log('\n── 6 that DO have a judgment behind them')
  for (const r of by('has-pdf').slice(0, 6)) console.log(`   ${r.title}\n        ${r.firstPdf}`)
  console.log('\n── 6 with the page but no attachment')
  for (const r of by('no-attachment').slice(0, 6)) console.log(`   [${r.documentType}] ${r.title}\n        ${r.url}`)

  const outFile = path.join(OUT, 'C3_et503_probe.json')
  fs.writeFileSync(outFile, JSON.stringify({
    generated: new Date().toISOString(), listGenerated: doc.generated, population: all.length,
    sampled: results.length,
    counts: Object.fromEntries((['has-pdf', 'no-attachment', 'gone', 'error'] as Verdict[]).map((v) => [v, by(v).length])),
    projectedHasPdf: projected, outDir: OUTDIR, results,
  }, null, 2))
  console.log(`\n${path.relative(process.cwd(), outFile)}\nbodies/verdicts: ${OUTDIR}`)
}
main().catch((e) => { console.error('FAIL', e); process.exit(1) })
