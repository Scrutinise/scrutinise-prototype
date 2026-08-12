/**
 * v36-probe-fetch.ts — V36 §1, bytes before hypotheses.
 *
 * corpus_sections records `No CLML/HTML/PDF found on TNA` for instruments that
 * legislation.gov.uk answers with HTTP 200 and megabytes of CLML today. This runs
 * the REAL ingest code path (enumerateSections) against those exact ids, so the
 * answer is what our own fetcher does, not what curl does.
 */
process.env.TNA_THROTTLE_FLOOR_MS = process.env.TNA_THROTTLE_FLOOR_MS ?? '500'
import path from 'path'
require('dotenv').config({ path: path.join(__dirname, '../../scrutinise-web/.env') })

const IDS = process.argv.slice(2).filter(a => !a.startsWith('--'))
const DEFAULT_IDS = [
  'ukpga/2006/46',   // Companies Act 2006 — availability 'full', 1,665 legacy sections
  'eur/2016/679',    // UK GDPR — 'no-provisions', 61 legacy sections
  'uksi/2012/3038',  // Greenhouse Gas ETS Regs — 'no-provisions', 107 legacy sections
  'ssi/2015/94',     // NHS Pension Scheme (Scotland) — 'full', 150 legacy sections
  'uksi/1991/2768',  // Building Regulations 1991 — 'no-provisions', 57 legacy sections
  'ukpga/1925/20',   // Law of Property Act 1925 — calendar id; regnal copy IS in corpus
]

async function main() {
  const { enumerateSections, discoverFormats } = await import('./sources/tna-legislation')
  for (const id of (IDS.length ? IDS : DEFAULT_IDS)) {
    const t = Date.now()
    let formats: string[] = []
    try { formats = await discoverFormats(id) } catch (e) { console.log(`  discoverFormats threw: ${e}`) }
    let out = ''
    try {
      const secs = await enumerateSections(id)
      const byFormat = secs.reduce<Record<string, number>>((a, s) => { a[s.format] = (a[s.format] ?? 0) + 1; return a }, {})
      const unavailable = secs.find(s => s.format === 'unavailable')
      out = `${secs.length} sections ${JSON.stringify(byFormat)}` +
        (unavailable ? ` errorMsg="${unavailable.errorMsg}" classifiedAs=${unavailable.classifiedAs}` : '')
    } catch (e) {
      out = `THREW ${e}`
    }
    console.log(`${id.padEnd(16)} formats=[${formats.join(',')}]  ${((Date.now() - t) / 1000).toFixed(1)}s  ${out}`)
  }
}

main().catch(e => { console.error(e); process.exitCode = 1 })
