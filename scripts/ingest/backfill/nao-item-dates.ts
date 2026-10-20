/**
 * nao-item-dates.ts — INGEST_LEX_FIVE §3. Repair `nao-reports.itemDate` (all 3,983 rows were null).
 *
 * The date was never in the body: it is the WP REST record's `date` that `listNaoReports` already
 * walks. The writer (`processNao`) is fixed separately; this sweeps the backlog.
 *
 * Dry run by default; `--write` updates. Only rows whose itemDate IS NULL are touched, and only
 * with a date for their own slug — nothing is guessed, and a slug the API no longer lists stays null
 * and is counted.
 *
 * Cross-check printed before any write: the year in the report's PDF upload path
 * (/wp-content/uploads/YYYY/MM/) against the year of the WP date. A WP `date` could be a migration
 * date rather than a publication date; the agreement rate says which.
 */
import { getNeonPool, endNeonPool } from '../shared/neon-pool'
import { listNaoReports } from '../sources/nao'

const WRITE = process.argv.includes('--write')

async function main() {
  const pool = getNeonPool()
  console.log('HOST', new URL(process.env.NEON_DATABASE_URL!).host, WRITE ? 'WRITE' : 'dry run')

  const reports = await listNaoReports()
  const dateBySlug = new Map<string, string>()
  for (const r of reports) if (r.date) dateBySlug.set(r.slug, r.date)
  console.log(`enumerated ${reports.length} reports, ${dateBySlug.size} with a date`)

  const { rows } = await pool.query<{ id: string; parentDocId: string; sourceUrl: string; itemDate: string | null }>(
    `select id, "parentDocId", "sourceUrl", "itemDate" from corpus_sections where corpus = 'nao-reports'`,
  )
  const nullRows = rows.filter(r => !r.itemDate)
  console.log(`rows ${rows.length}, undated ${nullRows.length}`)

  const ids: string[] = []
  const dates: string[] = []
  let noSlugDate = 0
  let yrCompared = 0
  let yrAgree = 0
  let yrWithin1 = 0
  const disagreeSample: string[] = []
  for (const r of nullRows) {
    const d = dateBySlug.get(r.parentDocId)
    if (!d) { noSlugDate++; continue }
    ids.push(r.id)
    dates.push(d)
    const m = /\/wp-content\/uploads\/(\d{4})\//.exec(r.sourceUrl)
    if (m) {
      yrCompared++
      const diff = Math.abs(Number(m[1]) - Number(d.slice(0, 4)))
      if (diff === 0) yrAgree++
      if (diff <= 1) yrWithin1++
      else if (disagreeSample.length < 5) disagreeSample.push(`${r.parentDocId}: wp ${d} vs path ${m[1]}`)
    }
  }
  console.log(`to date ${ids.length}; no API date for slug ${noSlugDate}`)
  console.log(`year cross-check vs upload path: compared ${yrCompared}, same year ${yrAgree}, within 1 year ${yrWithin1}`)
  if (disagreeSample.length) console.log('differ by >1yr, sample:', disagreeSample)

  if (!WRITE) { await endNeonPool(); return }

  let updated = 0
  for (let i = 0; i < ids.length; i += 500) {
    const r = await pool.query(
      `update corpus_sections s set "itemDate" = v.d::date
         from unnest($1::text[], $2::text[]) as v(id, d)
        where s.id = v.id and s.corpus = 'nao-reports' and s."itemDate" is null`,
      [ids.slice(i, i + 500), dates.slice(i, i + 500)],
    )
    updated += r.rowCount ?? 0
  }
  console.log(`updated ${updated}`)
  const after = await pool.query(`select count(*)::int total, count("itemDate")::int dated, min("itemDate")::text mn, max("itemDate")::text mx from corpus_sections where corpus = 'nao-reports'`)
  console.log('after', JSON.stringify(after.rows[0]))
  await endNeonPool()
}
main().catch(e => { console.error(e); process.exit(1) })
