/**
 * v18-retained-eu-viability.ts — V18 §6 (report only, no seeding/retiring):
 * sample ~200 retained-eu instruments that have never been ingested or
 * classified, measure the hasNoProvisions rate, and estimate the real
 * remaining-section count. Decision is Charlie's.
 *
 * Method: enumerate a stratified sample of TNA years for eur/eudn/eudr,
 * exclude instruments already in corpus_sections (any status), random-sample
 * 200, fetch each CLML root, record NumberOfProvisions.
 *
 * Run:
 *   NODE_PATH=scrutinise-web/node_modules scrutinise-web/node_modules/.bin/tsx \
 *     --tsconfig scripts/tsconfig.json scripts/ingest/v18-retained-eu-viability.ts
 */
import { getNeonPool, endNeonPool } from '../../ingest/shared/neon-pool'
import { listActIds } from '../../ingest/sources/tna-legislation'

const SAMPLE_YEARS = [1975, 1990, 2000, 2008, 2014, 2019]
const TYPES = ['eur', 'eudn', 'eudr']
const SAMPLE_SIZE = 200
const ALL_YEARS_FROM = 1953
const ALL_YEARS_TO = 2020

// True universe size: page 1 of each year feed carries <leg:morePages>; with
// 20 items/page, universe ≈ Σ (morePages+1)×20. Cheap (~200 fetches) and it
// replaces guesswork — needed because the V2–V17 enumeration bug capped every
// eur/eudn/eudr year at 20 instruments (see fetchAllPages fix, V18).
async function universeSize(): Promise<number> {
  let total = 0
  for (const type of TYPES) {
    let typeTotal = 0
    for (let y = ALL_YEARS_FROM; y <= ALL_YEARS_TO; y++) {
      try {
        const res = await fetch(`https://www.legislation.gov.uk/${type}/${y}/data.feed`, {
          headers: { 'User-Agent': 'Scrutinise-Ingest/1.0 (research)' },
          signal: AbortSignal.timeout(20_000),
        })
        if (!res.ok) continue
        const xml = await res.text()
        const entries = (xml.match(/<entry>/g) ?? []).length
        const more = /<leg:morePages>(\d+)<\/leg:morePages>/.exec(xml)
        typeTotal += entries + (more ? parseInt(more[1], 10) * 20 : 0)
      } catch { /* skip year */ }
      await new Promise(r => setTimeout(r, 150))
    }
    console.log(`  universe ${type}: ~${typeTotal.toLocaleString()}`)
    total += typeTotal
  }
  return total
}

function rootAttrs(xml: string): string {
  const afterDecl = xml.trimStart().startsWith('<?') ? xml.indexOf('?>') + 2 : 0
  const end = xml.indexOf('>', afterDecl)
  return end === -1 ? '' : xml.slice(afterDecl, end + 1)
}

async function main() {
  const pool = getNeonPool()

  console.log('=== current retained-eu state ===')
  const tgt = await pool.query(`SELECT est_sections, est_is_confirmed FROM corpus_targets WHERE corpus_key = 'retained-eu'`)
  console.log(`corpus_targets est_sections: ${tgt.rows[0]?.est_sections?.toLocaleString?.() ?? tgt.rows[0]?.est_sections} (confirmed: ${tgt.rows[0]?.est_is_confirmed})`)
  const cs = await pool.query<{ status: string; n: string; docs: string }>(`
    SELECT status, COUNT(*)::text AS n, COUNT(DISTINCT split_part(id, ':', 2))::text AS docs
    FROM corpus_sections WHERE corpus = 'retained-eu' GROUP BY status
  `)
  for (const r of cs.rows) console.log(`  sections ${r.status}: ${parseInt(r.n, 10).toLocaleString()} across ${parseInt(r.docs, 10).toLocaleString()} instruments`)
  const avgRes = await pool.query<{ avg: string }>(`
    SELECT COALESCE(AVG(cnt), 0)::numeric(10,1)::text AS avg FROM (
      SELECT COUNT(*) AS cnt FROM corpus_sections
      WHERE corpus = 'retained-eu' AND status = 'compiled'
      GROUP BY split_part(id, ':', 2)
    ) sub
  `)
  const avgSectionsPerRealInstrument = parseFloat(avgRes.rows[0].avg)
  console.log(`  avg compiled sections per ingested instrument: ${avgSectionsPerRealInstrument}`)

  const ingestedRes = await pool.query<{ d: string }>(
    `SELECT DISTINCT split_part(id, ':', 2) AS d FROM corpus_sections WHERE corpus = 'retained-eu'`
  )
  const ingested = new Set(ingestedRes.rows.map(r => r.d))
  console.log(`  instruments with ANY corpus_sections row: ${ingested.size.toLocaleString()}`)

  console.log('\n=== sizing the true TNA retained-eu universe (page counts, all years) ===')
  const universe = await universeSize()
  console.log(`  TOTAL universe: ~${universe.toLocaleString()} instruments (vs ${ingested.size.toLocaleString()} ever touched)`)

  console.log(`\n=== enumerating sample years (${TYPES.join('/')} × ${SAMPLE_YEARS.join(', ')}) ===`)
  const unsampled: string[] = []
  let enumerated = 0
  for (const type of TYPES) {
    for (const year of SAMPLE_YEARS) {
      const ids = await listActIds(type, year, year)
      enumerated += ids.length
      const fresh = ids.filter(id => !ingested.has(id))
      unsampled.push(...fresh)
      console.log(`  ${type}/${year}: ${ids.length} instruments, ${fresh.length} never ingested`)
    }
  }
  console.log(`enumerated ${enumerated}, never-ingested pool: ${unsampled.length} (${((unsampled.length / Math.max(1, enumerated)) * 100).toFixed(1)}%)`)

  // random sample
  const shuffled = unsampled.sort(() => Math.random() - 0.5).slice(0, SAMPLE_SIZE)
  console.log(`\n=== fetching CLML for ${shuffled.length} sampled instruments ===`)
  let noProv = 0, withProv = 0, errors = 0
  let provisionSum = 0
  const examples: string[] = []
  for (const [i, docId] of shuffled.entries()) {
    try {
      const res = await fetch(`https://www.legislation.gov.uk/${docId}/data.xml`, {
        headers: { 'User-Agent': 'Scrutinise-Ingest/1.0 (research)' },
        signal: AbortSignal.timeout(15_000),
      })
      if (!res.ok) { errors++; continue }
      const xml = await res.text()
      const attrs = rootAttrs(xml)
      const m = /\bNumberOfProvisions="(\d+)"/.exec(attrs)
      const n = m ? parseInt(m[1], 10) : 0
      if (n === 0) {
        noProv++
        if (examples.length < 5) examples.push(docId)
      } else {
        withProv++
        provisionSum += n
      }
    } catch { errors++ }
    if ((i + 1) % 25 === 0) console.log(`  ${i + 1}/${shuffled.length} (noProv=${noProv} withProv=${withProv} err=${errors})`)
    await new Promise(r => setTimeout(r, 250))
  }

  const total = noProv + withProv
  const rate = total > 0 ? (noProv / total) * 100 : NaN
  const avgProvisions = withProv > 0 ? provisionSum / withProv : 0
  console.log('\n================ §6 RESULTS ================')
  console.log(`sampled: ${total} (errors ${errors})`)
  console.log(`hasNoProvisions rate: ${rate.toFixed(1)}%  (${noProv}/${total})`)
  console.log(`avg NumberOfProvisions when > 0: ${avgProvisions.toFixed(1)}`)
  console.log(`examples (no provisions): ${examples.join(', ')}`)
  const remaining = Math.max(0, universe - ingested.size)
  const estRealRemainingSections = Math.round(remaining * ((100 - rate) / 100) * avgSectionsPerRealInstrument)
  console.log(`\nuniverse ~${universe.toLocaleString()} − ${ingested.size.toLocaleString()} touched = ~${remaining.toLocaleString()} remaining instruments`)
  console.log(`est REAL remaining sections = ${remaining.toLocaleString()} × ${(100 - rate).toFixed(1)}% real × ${avgSectionsPerRealInstrument} sections/instrument`)
  console.log(`                            ≈ ${estRealRemainingSections.toLocaleString()} sections`)
  console.log('\nNO seeding or retiring done — Charlie decides (AI-as-decision-support).')

  await endNeonPool()
}
main().catch(e => { console.error(e); process.exit(1) })
