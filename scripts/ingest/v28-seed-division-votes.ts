/**
 * v28-seed-division-votes.ts — V28 §3. Per-member Commons/Lords division votes.
 *
 *   --pilot     fetch ONE division per house end-to-end (detail → compiled text)
 *               and print it; report totals. Seeds nothing.
 *   --measure   report the universe (searchTotalResults + a full enumeration
 *               count) per house. Seeds nothing.
 *   --seed      enumerate every division id per house, bulk-insert one content
 *               row each ("{house}:{id}"), upsert the corpus_targets.
 *
 * New sourceType 'division-votes' + new corpora commons-divisions-votes /
 * lords-divisions-votes — seed POST-PUSH (processor must deploy first).
 * Idempotent: queue ids ON CONFLICT DO NOTHING; the worker skips divisions
 * already in R2.
 */
import { getNeonPool, endNeonPool } from './shared/neon-pool'
import { bulkInsertQueueRows } from './shared/queue-client'
import {
  divisionTotal, enumerateDivisions, fetchDivisionDetail, compileDivisionText, type House,
} from './sources/division-votes'

const SOURCE = 'division-votes'
const CORPUS: Record<House, string> = { commons: 'commons-divisions-votes', lords: 'lords-divisions-votes' }

async function pilot() {
  for (const house of ['commons', 'lords'] as House[]) {
    console.log(`\n=== PILOT ${house} ===`)
    const total = await divisionTotal(house)
    console.log(`searchTotalResults: ${total}`)
    const page = await enumerateDivisionsFirst(house)
    if (!page) { console.log('  no divisions listed'); continue }
    const detail = await fetchDivisionDetail(house, page.divisionId)
    if (!detail) { console.log(`  detail fetch FAILED for ${page.divisionId}`); continue }
    const text = compileDivisionText(detail)
    console.log(`  division ${detail.divisionId}: ${detail.members.length} members, ${text.length} chars`)
    console.log('  ---'); console.log(text.split('\n').slice(0, 12).join('\n')); console.log('  ---')
  }
}

// just the newest division for the pilot (take=1)
async function enumerateDivisionsFirst(house: House) {
  const { listDivisionsPage } = await import('./sources/division-votes')
  const p = await listDivisionsPage(house, 0, 1)
  return p && p.length ? p[0] : null
}

async function measure() {
  for (const house of ['commons', 'lords'] as House[]) {
    const total = await divisionTotal(house)
    const all = await enumerateDivisions(house, 100, 250, c => process.stdout.write(`  ${house} enumerated ${c}\r`))
    console.log(`\n${house}: searchTotalResults=${total}, enumerated=${all.length} divisions`)
    const dated = all.filter(d => d.date)
    if (dated.length) console.log(`  date range: ${dated[dated.length - 1].date} … ${dated[0].date}`)
  }
}

async function seed() {
  const pool = getNeonPool()
  let grand = 0
  for (const house of ['commons', 'lords'] as House[]) {
    const all = await enumerateDivisions(house, 100, 250, c => process.stdout.write(`  ${house} enumerated ${c}\r`))
    const corpus = CORPUS[house]
    const rows = all.map(d => ({
      id: `${corpus}:${d.divisionId}`,
      corpus,
      docId: `${house}:${d.divisionId}`,
      sourceType: SOURCE,
      priority: 3,
    }))
    const { affected } = await bulkInsertQueueRows(rows)
    console.log(`\n${house}: ${rows.length} divisions, ${affected} new rows`)
    const label = house === 'commons' ? 'Commons division votes (per-member)' : 'Lords division votes (per-member)'
    await pool.query(`
      INSERT INTO corpus_targets (corpus_key, display_label, est_sections, est_is_confirmed, notes, updated_at)
      VALUES ($1, $3, $2, true, 'V28 §3: per-member division votes (Open Parliament Licence)', NOW())
      ON CONFLICT (corpus_key) DO UPDATE SET
        display_label = $3, est_sections = $2, est_is_confirmed = true, blocked = false, blocked_reason = NULL,
        notes = 'V28 §3: per-member division votes (Open Parliament Licence)', updated_at = NOW()
    `, [corpus, all.length, label])
    grand += all.length
  }
  console.log(`\nTOTAL division-vote rows seeded: ${grand}`)
}

async function main() {
  const mode = process.argv.find(a => ['--pilot', '--measure', '--seed'].includes(a)) ?? '--pilot'
  if (mode === '--pilot') await pilot()
  else if (mode === '--measure') await measure()
  else await seed()
  await endNeonPool()
}
main().catch(e => { console.error('FATAL', e); process.exit(1) })
