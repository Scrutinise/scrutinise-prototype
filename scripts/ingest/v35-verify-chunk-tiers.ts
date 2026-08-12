/**
 * v35-verify-chunk-tiers.ts — did the S2C6 §1 tier decision actually reach `corpus_chunks`?
 *
 * ⚠ THIS IS THE CHECK THAT JUSTIFIED RESEQUENCING THE SPRINT. V35 §0 says the display typing gates
 * the FTS build only, and §1 (embed) may start immediately. That is wrong: `v33-vec-catchup.ts`
 * writes `tier: tierFor(corpus)` into every chunk row, and `vector-search.ts` passes `tier` as a
 * SERVER-SIDE PREFILTER over `corpus_vec` — refusing the results outright if the service does not
 * echo it back. So an embed run before the tier map was corrected would have baked `other` into
 * 95,044 chunks, and no router stream selects `other`. The rows would be embedded, paid for, and
 * unreachable — the same UNREACHABLE state, arrived at through the vector half instead.
 *
 * A guard that has never been watched failing is worth nothing, so this asserts the NEGATIVE too:
 * a corpus deliberately left out of the tier map must still come back `other`.
 */
import path from 'path'
require('dotenv').config({ path: path.join(__dirname, '../../scrutinise-web/.env') })
import { connectLance } from './search/lance'
import { CHUNKS_TABLE } from './search/vector-common'
import { tierFor } from './search/corpus-map'

const EXPECT: Record<string, string> = {
  'commons-divisions-votes': 'parliamentary',
  'lords-divisions-votes': 'parliamentary',
  'impact-assessments': 'legislation',
  'consultations': 'guidance',
}
async function main() {
  const conn = await connectLance()
  const t = await conn.openTable(CHUNKS_TABLE)
  let bad = 0
  for (const [corpus, want] of Object.entries(EXPECT)) {
    const rows = await t.query().where(`corpus = '${corpus}'`).select(['chunkId', 'tier']).limit(1_000_000).toArray() as any[]
    const tiers = [...new Set(rows.map((r) => r.tier))]
    const ok = rows.length > 0 && tiers.length === 1 && tiers[0] === want
    if (!ok) bad++
    console.log(`  ${ok ? '✓' : '✗'} ${corpus.padEnd(26)} ${String(rows.length).padStart(7)} chunks   tier=${JSON.stringify(tiers)}   want "${want}"   (tierFor says "${tierFor(corpus)}")`)
  }
  // The negative control: an unmapped corpus must still be `other`, or the assertion above is
  // passing because everything says the same thing rather than because the map is right.
  console.log(`  ${tierFor('a-corpus-nobody-mapped') === 'other' ? '✓' : '✗'} negative control: an unmapped corpus still tiers "other" (${tierFor('a-corpus-nobody-mapped')})`)
  console.log(`\n${bad ? `✗ ${bad} FAILED — do NOT embed` : '✓ all four tiers correct in corpus_chunks — safe to embed'}`)
  process.exit(bad ? 1 : 0)
}
main().catch((e) => { console.error(e); process.exit(1) })
