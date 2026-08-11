/**
 * v34-divisions-probe4.ts — §A step 1d. Coverage and the backfill route.
 *
 *   Q10. What date range does each votes API actually cover? (Commons starts
 *        2016-03-09 per probe2. Lords?)
 *   Q11. We already hold `lda-commonsdivisions` (5,553) and `lda-lordsdivisions`
 *        (2,089). What IS that content — results only, or per-member? What date
 *        range? It may already be the pre-2016 backfill.
 *   Q12. Public Whip — the brief wants it as a cross-check and historical
 *        backfill, raw records only, no policy labels. Is there a bulk route?
 *   Q13. Lords has no NoVoteRecorded. Confirm, and find what would supply the
 *        eligible-membership denominator instead.
 */
import { getNeonPool, endNeonPool } from './shared/neon-pool'

const COMMONS = 'https://commonsvotes-api.parliament.uk'
const LORDS = 'https://lordsvotes-api.parliament.uk'
const UA = 'Scrutinise-Ingest/1.0 (+https://scrutinise.org; contact cl@scrutinise.org)'

async function get(url: string): Promise<any> {
  try {
    const res = await fetch(url, { headers: { Accept: 'application/json', 'User-Agent': UA }, signal: AbortSignal.timeout(30_000) })
    const t = await res.text()
    try { return JSON.parse(t) } catch { return { __status: res.status, __raw: t.slice(0, 400) } }
  } catch (e: any) { return { __err: e?.message } }
}

async function head(url: string): Promise<string> {
  try {
    const res = await fetch(url, { method: 'GET', headers: { 'User-Agent': UA }, signal: AbortSignal.timeout(25_000) })
    const ct = res.headers.get('content-type') ?? ''
    const len = res.headers.get('content-length') ?? '?'
    const body = ct.includes('html') || ct.includes('text') ? (await res.text()).slice(0, 300).replace(/\s+/g, ' ') : ''
    return `${res.status} ${ct} len=${len}${body ? ` :: ${body}` : ''}`
  } catch (e: any) { return `ERR ${e?.message}` }
}

async function main() {
  console.log('=== Q10. Date range of each votes API ===')
  const cTotal: number = await get(`${COMMONS}/data/divisions.json/searchTotalResults?queryParameters.take=1`)
  const cOld = await get(`${COMMONS}/data/divisions.json/search?queryParameters.take=1&queryParameters.skip=${cTotal - 1}`)
  const cNew = await get(`${COMMONS}/data/divisions.json/search?queryParameters.take=1&queryParameters.skip=0`)
  console.log(`  Commons: ${cTotal} divisions, ${String(cOld?.[0]?.Date).slice(0, 10)} … ${String(cNew?.[0]?.Date).slice(0, 10)}`)

  const lTotal: number = await get(`${LORDS}/data/Divisions/searchTotalResults`)
  const lOld = await get(`${LORDS}/data/Divisions/search?take=1&skip=${lTotal - 1}`)
  const lNew = await get(`${LORDS}/data/Divisions/search?take=1&skip=0`)
  console.log(`  Lords:   ${lTotal} divisions, ${String(lOld?.[0]?.date).slice(0, 10)} … ${String(lNew?.[0]?.date).slice(0, 10)}`)

  console.log('\n=== Q13. Lords absence field — confirm there is none ===')
  const lD = await get(`${LORDS}/data/Divisions/${lNew?.[0]?.divisionId}`)
  const lKeys = lD && typeof lD === 'object' ? Object.keys(lD) : []
  const absenceish = lKeys.filter(k => /novote|absent|abstain|notrecorded/i.test(k))
  console.log(`  Lords detail keys matching absence: ${absenceish.length ? absenceish.join(', ') : 'NONE — absence is NOT supplied; must come from the membership table'}`)
  console.log(`  Lords contents+notContents on that division: ${(lD?.contents?.length ?? 0) + (lD?.notContents?.length ?? 0)} members (of ~800 eligible peers)`)

  console.log('\n=== Q11. What is already in lda-commonsdivisions / lda-lordsdivisions? ===')
  const pool = getNeonPool()
  const cols = await pool.query(`
    SELECT column_name, data_type FROM information_schema.columns
    WHERE table_name = 'corpus_sections' ORDER BY ordinal_position`)
  console.log(`  corpus_sections columns: ${cols.rows.map(r => r.column_name).join(', ')}`)

  for (const corpus of ['lda-commonsdivisions', 'lda-lordsdivisions']) {
    const r = await pool.query(`
      SELECT id, "sectionTitle", "sourceUrl", "itemDate", "wordCount", "r2Key", licence, attribution, format
      FROM corpus_sections WHERE corpus = $1 ORDER BY "itemDate" DESC NULLS LAST LIMIT 2`, [corpus])
    const rng = await pool.query(`
      SELECT MIN("itemDate") AS oldest, MAX("itemDate") AS newest,
             COUNT(*)::int AS n, AVG("wordCount")::int AS avg_words, MAX("wordCount") AS max_words
      FROM corpus_sections WHERE corpus = $1`, [corpus])
    console.log(`\n  --- ${corpus}: ${JSON.stringify(rng.rows[0])}`)
    for (const row of r.rows) {
      console.log(`      id=${row.id} words=${row.wordCount} licence=${row.licence} format=${row.format}`)
      console.log(`      title: ${row.sectionTitle}`)
      console.log(`      url:   ${row.sourceUrl}`)
      console.log(`      r2Key: ${row.r2Key}`)
    }
  }
  await endNeonPool()

  console.log('\n=== Q12. Public Whip — bulk route? ===')
  for (const url of [
    'https://www.publicwhip.org.uk/',
    'https://www.publicwhip.org.uk/data/',
    'https://www.publicwhip.org.uk/project/data.php',
    'https://www.publicwhip.org.uk/data/division-info.csv',
    'https://www.publicwhip.org.uk/data/votematrix-2019.dat',
    'https://www.theyworkforyou.com/pwdata/',
  ]) {
    console.log(`  ${url}\n    ${await head(url)}`)
  }
}
main().catch(e => { console.error('FATAL', e); process.exit(1) })
