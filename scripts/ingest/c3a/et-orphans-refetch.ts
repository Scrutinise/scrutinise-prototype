/**
 * et-orphans-refetch.ts — ADDENDUM C3 §8. "Fetch the 53. Declare the remainder as a boundary."
 *
 * ════════════════════════════════════════════════════════════════════════════════════════════════
 * WHAT A USER SEES TODAY
 * 503 `et-decisions` rows are a gov.uk landing page — a title, a date and a URL, median 13 words —
 * with no judgment anywhere in the corpus. Ask about one of those cases and the answer is a name.
 *
 * WHY, AND IT IS TWO DIFFERENT REASONS WEARING ONE LABEL
 * The C3 sample of 200 projected 53 with a judgment PDF behind them. **The whole population has now
 * been read: 51 of 503 (10.1%) carry a PDF; 452 do not; 0 are gone; 0 errored.** The projection was
 * within two, and the measured number replaces it.
 *
 * The other 452 are not a fetch failure. gov.uk publishes pre-~2013 Scottish employment tribunal
 * decisions as a TITLE-ONLY LISTING with no judgment attached, ever. That is a coverage boundary,
 * and it belongs in `CORPUS_SCOPE.md` in the same words B1 uses for case law:
 *
 *      "Scottish employment tribunal decisions before 2013 are not published and are not held."
 *
 * ── HOW THE 51 ARE FETCHED: THE GENERAL PATH, NOT A BESPOKE ONE ────────────────────────────────
 * A queue row with `sourceType='govuk-content'` re-runs `processGovukContent`, which reads the page,
 * fetches each PDF attachment, extracts the text and upserts one section per attachment. That is
 * the same code that ingested the other 131,147 judgments. Writing a private fetcher here would
 * produce rows subtly unlike every other row in the collection — a verification artefact that is
 * not a faithful copy produces findings about itself.
 *
 * ⚠ The landing page keeps `:1`; the judgment lands at `:2`. Nothing is overwritten and nothing is
 * deleted, so this step is reversible by deleting the `:2` rows it creates.
 *
 * Usage:
 *   tsx c3a/et-orphans-refetch.ts            # measure + stage; writes an artefact, no queue rows
 *   tsx c3a/et-orphans-refetch.ts --execute  # + insert the queue rows
 */
import fs from 'fs'
import path from 'path'
import { pool, OUT } from '../c2/db'

const EXECUTE = process.argv.includes('--execute')
const PROBE = path.join(OUT, 'C3_et503_probe.json')
const n = (x: number) => x.toLocaleString('en-GB')

/** `et-decisions:employment-tribunal-decisions/foo-1234-2016:1` → `employment-tribunal-decisions/foo-1234-2016` */
const docIdOf = (sectionId: string) => sectionId.replace(/^et-decisions:/, '').replace(/:\d+$/, '')

/**
 * Scottish ET case numbers begin 1 (Aberdeen/Dundee/Edinburgh/Glasgow) and, before the 2013 fee
 * reform, ran to SIX digits — `114940/2006`. English and Welsh numbers are seven digits. The test
 * is the publisher's own numbering, taken from the case title, not a guess from the party names.
 */
function caseNumberOf(title: string | null): { digits: number; year: number | null } {
  const m = /(\d{5,8})\s*\/\s*(\d{4})/.exec(title ?? '')
  if (!m) return { digits: 0, year: null }
  return { digits: m[1].length, year: parseInt(m[2], 10) }
}

async function main() {
  if (!fs.existsSync(PROBE)) { console.error(`no ${PROBE} — run c2/c2-et503-probe.ts --n=503 first`); process.exit(1) }
  const probe = JSON.parse(fs.readFileSync(PROBE, 'utf8'))
  if (probe.sampled !== probe.population) {
    console.log(`⛔ ABORT — the probe on disk covers ${n(probe.sampled)} of ${n(probe.population)}.`)
    console.log('   §8 asks for the 51 to be FETCHED, and a fetch list drawn from a sample would miss')
    console.log('   the ones that were not sampled. Re-run: c2/c2-et503-probe.ts --n=503')
    process.exit(1)
  }
  const results: any[] = probe.results
  console.log(`probe: ${probe.generated} — all ${n(probe.population)} read`)
  console.log(`  has-pdf ${n(probe.counts['has-pdf'])} · no-attachment ${n(probe.counts['no-attachment'])} · gone ${n(probe.counts.gone)} · error ${n(probe.counts.error)}`)

  // ── the boundary, measured over the WHOLE population rather than the 200-row sample
  const orphans = results.filter((r) => r.verdict === 'no-attachment')
  const withPdf = results.filter((r) => r.verdict === 'has-pdf')
  const stat = (rows: any[]) => {
    const nums = rows.map((r) => caseNumberOf(r.title))
    const six = nums.filter((x) => x.digits === 6).length
    const seven = nums.filter((x) => x.digits === 7).length
    const years = nums.map((x) => x.year).filter(Boolean) as number[]
    const pre2013 = years.filter((y) => y < 2013).length
    return { six, seven, unparsed: nums.filter((x) => !x.digits).length, pre2013, years }
  }
  const o = stat(orphans), w = stat(withPdf)
  const yearHist = new Map<number, number>()
  for (const y of o.years) yearHist.set(y, (yearHist.get(y) ?? 0) + 1)

  console.log('\n── THE BOUNDARY, over all 503 rather than the 200 sampled in C3')
  console.log(`   of the ${n(orphans.length)} with no attachment: ${n(o.six)} carry a SIX-digit case number (the pre-2013 Scottish form),`)
  console.log(`     ${n(o.seven)} seven-digit, ${n(o.unparsed)} no number in the title; ${n(o.pre2013)} are dated before 2013`)
  console.log(`   of the ${n(withPdf.length)} WITH a judgment: ${n(w.six)} six-digit, ${n(w.seven)} seven-digit, ${n(w.pre2013)} before 2013`)
  console.log('   ⚠ the contrast is the finding: the six-digit Scottish numbering and the missing attachment')
  console.log('     travel together, which is what makes this a publisher boundary rather than a fetch failure.')
  const topYears = [...yearHist].sort((a, b) => b[1] - a[1]).slice(0, 8)
  console.log('   years of the no-attachment rows: ' + topYears.map(([y, c]) => `${y}:${c}`).join('  '))

  // ── the fetch list
  const p = pool()
  const docIds = [...new Set(withPdf.map((r) => docIdOf(r.id)))]
  const existing = (await p.query(
    `SELECT split_part(id, ':', 2) d, count(*)::int n FROM corpus_sections
      WHERE corpus='et-decisions' AND split_part(id, ':', 2) = ANY($1) GROUP BY 1`, [docIds])).rows
  const already = new Map(existing.map((r: any) => [r.d, r.n]))
  const multi = docIds.filter((d) => (already.get(d) ?? 0) > 1)
  console.log(`\n── THE FETCH LIST: ${n(docIds.length)} documents`)
  console.log(`   each holds ${n(already.size ? [...already.values()].filter((x) => x === 1).length : 0)} section(s) today; ${n(multi.length)} already hold more than one`)
  if (multi.length) console.log('   ⚠ those already have something beside the landing page — re-check before queueing them')

  const rows = docIds.map((docId) => ({ id: `et-decisions:${docId}`, corpus: 'et-decisions', docId, sourceType: 'govuk-content', priority: 3 }))
  const outPath = path.join(OUT, 'C3A_et_orphans_refetch.json')
  fs.writeFileSync(outPath, JSON.stringify({
    generated: new Date().toISOString(),
    probe: probe.generated,
    population: probe.population, withPdf: withPdf.length, noAttachment: orphans.length,
    boundary: { noAttachment: o, withPdf: w, yearsOfNoAttachment: Object.fromEntries(yearHist) },
    queueRows: rows,
    pdfs: withPdf.map((r) => ({ id: r.id, title: r.title, pdf: r.firstPdf })),
  }, null, 2))
  console.log(`\nwritten: docs/census/C3A_et_orphans_refetch.json`)

  if (!EXECUTE) {
    console.log(`\nDRY RUN — would insert ${n(rows.length)} queue rows (sourceType govuk-content, priority 3).`)
    console.log('   ⚠ A queue row is not a fetch. A worker has to claim it, and the collection is unchanged')
    console.log('     until one does — say "queued", never "fetched", until the sections are re-read.')
  } else {
    const { bulkInsertQueueRows } = await import('../shared/queue-client')
    const { affected } = await bulkInsertQueueRows(rows as any)
    console.log(`\n   inserted/updated ${n(affected)} queue rows`)
    const back = (await p.query(
      `SELECT status, count(*)::int n FROM ingest_queue WHERE corpus='et-decisions' AND "sourceType"='govuk-content' GROUP BY 1`)).rows
    console.log('   re-read from the database: ' + back.map((r: any) => `${r.status}=${r.n}`).join(', '))
  }
  await p.end()
}
main().catch((e) => { console.error('FAIL', e.message ?? e); process.exit(1) })
