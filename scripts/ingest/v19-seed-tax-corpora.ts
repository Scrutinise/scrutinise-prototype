/**
 * v19-seed-tax-corpora.ts — V19 §3.1 + §3.2: the IBFD-replication seed pass.
 *
 * Universe sizes measured live 11 Jun 2026 before seeding (per brief §3.1):
 *   revenue-and-customs-briefs collection 63 + free-text backfill ~200 total
 *   statements-of-practice 135 | extra-statutory-concessions 4 (consolidated)
 *   vat-notices-numerical-order 109 | excise notice collections ~67
 *   tax-treaties collection 172 (per-country DTA pages, PDFs attached)
 *   filter_format=international_treaty 1,685 (full gov.uk treaty universe)
 *
 * Seeds:
 *  - `hmrc-ancillary` (P1): RCBs, SoPs, ESCs, VAT + excise notices.
 *  - `tax-treaties-dta` (P1): the per-country DTA collection. Also the
 *    uk-treaties unblock (same docs, working host — brief §3.2).
 *  - `uk-treaties` (P3) re-pointed to govuk-content international_treaty,
 *    minus links already in tax-treaties-dta; corpus_targets unblocked.
 *
 * All rows sourceType 'govuk-content' (V18 processor: body + PDF attachments;
 * zero-output breaker already armed for this sourceKey).
 */
import { getNeonPool, endNeonPool } from './shared/neon-pool'
import { bulkInsertQueueRows } from './shared/queue-client'
import { searchWhere } from './sources/govuk-content'

const HMRC_COLLECTIONS = [
  'revenue-and-customs-briefs',
  'statements-of-practice',
  'extra-statutory-concessions',
  'vat-notices-numerical-order',
  'oils-notices',
  'alcohols-notices',
  'holdings-and-movement-notices',
  'tobacco-notices',
  'climate-change-levy-notices',
  'gambling-duty-notices',
  'aggregates-levy-notices',
]

async function collect(gen: AsyncGenerator<{ link: string; title: string }[]>): Promise<Map<string, string>> {
  const out = new Map<string, string>()
  for await (const hits of gen) for (const h of hits) out.set(h.link.replace(/^\//, ''), h.title)
  return out
}

async function seedCorpus(
  pool: ReturnType<typeof getNeonPool>,
  corpus: string, docIds: string[], priority: number, label: string,
) {
  const ingestedRes = await pool.query<{ d: string }>(
    `SELECT DISTINCT split_part(id, ':', 2) AS d FROM corpus_sections WHERE corpus = $1`, [corpus])
  const ingested = new Set(ingestedRes.rows.map(r => r.d))
  const rows = docIds.filter(d => !ingested.has(d)).map(docId => ({
    id: `${corpus}:${docId}`, corpus, docId, sourceType: 'govuk-content', priority,
  }))
  const { affected } = await bulkInsertQueueRows(rows)
  await pool.query(`
    INSERT INTO corpus_targets (corpus_key, display_label, est_sections, est_is_confirmed, priority, blocked, blocked_reason)
    VALUES ($1, $2, $3, false, $4, false, NULL)
    ON CONFLICT (corpus_key) DO UPDATE
      SET display_label = EXCLUDED.display_label, est_sections = EXCLUDED.est_sections,
          priority = EXCLUDED.priority, blocked = false, blocked_reason = NULL
  `, [corpus, label, docIds.length, priority])
  console.log(`${corpus}: ${docIds.length} docs in universe, ${affected} queue rows seeded (P${priority})`)
}

async function main() {
  const pool = getNeonPool()

  // ── hmrc-ancillary ──
  const ancillary = new Map<string, string>()
  for (const slug of HMRC_COLLECTIONS) {
    const hits = await collect(searchWhere({ filter_document_collections: slug }))
    for (const [k, v] of hits) ancillary.set(k, v)
    console.log(`  collection ${slug}: ${hits.size} docs (cumulative ${ancillary.size})`)
  }
  // Free-text backfill for pre-collection RCBs (2013-era briefs are not in the
  // collection); keep only canonical RCB publication links.
  const rcbFree = await collect(searchWhere({ q: '"Revenue and Customs Brief"' }, 200))
  let backfill = 0
  for (const [link, title] of rcbFree) {
    if (/revenue-and-customs-brief/.test(link) && !ancillary.has(link)) { ancillary.set(link, title); backfill++ }
  }
  console.log(`  RCB free-text backfill: +${backfill} (universe now ${ancillary.size})`)
  await seedCorpus(pool, 'hmrc-ancillary', [...ancillary.keys()], 1, 'HMRC Ancillary Instruments (RCB/SoP/ESC/Notices)')

  // ── tax-treaties-dta ──
  const dta = await collect(searchWhere({ filter_document_collections: 'tax-treaties' }))
  await seedCorpus(pool, 'tax-treaties-dta', [...dta.keys()], 1, 'Double Taxation Agreements (gov.uk)')

  // ── uk-treaties re-point ──
  const treaties = await collect(searchWhere({ filter_format: 'international_treaty' }))
  const treatyIds = [...treaties.keys()].filter(d => !dta.has(d))
  await seedCorpus(pool, 'uk-treaties', treatyIds, 3, 'UK Treaties (gov.uk)')
  console.log(`uk-treaties overlap excluded (already in tax-treaties-dta): ${treaties.size - treatyIds.length}`)

  await endNeonPool()
}

main().catch(e => { console.error(e); process.exit(1) })
