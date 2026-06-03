/**
 * reseed-si-gaps.ts — one-off script to fill confirmed queue gaps from census 3 Jun 2026.
 *
 * Gaps addressed:
 *   A) UKSI 2010–2026: under-seeded for 2015–2026 (~5k–8k missing SIs)
 *   B) UKPGA pre-1963: 7,427 Neon items with 0 sections, never seeded in new pipeline
 *   C) Regional SSI + WSI: not included in original WORKER_CORPORA run
 *
 * Safe to re-run — all inserts use ON CONFLICT DO NOTHING.
 *
 * Run:
 *   NODE_PATH=scrutinise-web/node_modules \
 *   scrutinise-web/node_modules/.bin/tsx --tsconfig scripts/tsconfig.json \
 *   scripts/ingest/reseed-si-gaps.ts
 */
import path from 'path'
try { require('dotenv').config({ path: path.join(__dirname, '../../scrutinise-web/.env') }) } catch { /* ok */ }

import { listActIds } from './sources/tna-legislation'
import { bulkUpsertQueueRows, getAllDocIdsForCorpus, disconnectQueue } from './shared/queue-client'
import { Pool } from 'pg'

// ── A) UKSI 2010–2026 ────────────────────────────────────────────────────────

async function reseedSi2010Plus(): Promise<number> {
  console.log('\n[reseed] A) UKSI 2010–2026 …')
  const existing = await getAllDocIdsForCorpus('si-2010plus')
  console.log(`[reseed]   existing queue rows: ${existing.size}`)

  const allActIds = await listActIds('uksi', 2010, 2026)
  console.log(`[reseed]   TNA total: ${allActIds.length} UKSI 2010–2026`)

  const missing = allActIds
    .filter(id => !existing.has(id))
    .map(id => ({
      id: `si-2010plus:${id}`,
      corpus: 'si-2010plus',
      docId: id,
      sourceType: 'tna-legislation',
      priority: 1,
    }))

  console.log(`[reseed]   missing: ${missing.length} rows to insert`)
  if (missing.length === 0) return 0

  const inserted = await bulkUpsertQueueRows(missing)
  console.log(`[reseed]   inserted: ${inserted} new queue rows`)
  return inserted
}

// ── B) UKPGA pre-1963 from Neon ──────────────────────────────────────────────

async function reseedPreNormanPga(): Promise<number> {
  console.log('\n[reseed] B) UKPGA pre-1963 (Neon items with 0 sections) …')

  const neonUrl = process.env.NEON_DATABASE_URL
  if (!neonUrl) {
    console.log('[reseed]   NEON_DATABASE_URL not set — skipping')
    return 0
  }

  const neon = new Pool({
    connectionString: neonUrl,
    ssl: { rejectUnauthorized: false },
    statement_timeout: 30_000,
  })

  // Find UKPGA items in Neon with 0 LegislationSections (the 7,427 gap)
  const res = await neon.query<{ legislationGovUkId: string }>(`
    SELECT li."legislationGovUkId"
    FROM "LegislationItem" li
    WHERE li."legislationType" = 'UKPGA'
      AND li.year < 1963
      AND NOT EXISTS (
        SELECT 1 FROM "LegislationSection" ls WHERE ls."legislationItemId" = li.id
      )
    ORDER BY li.year, li.number
  `)
  await neon.end()

  const neonIds = res.rows.map(r => r.legislationGovUkId)
  console.log(`[reseed]   Neon UKPGA pre-1963 with 0 sections: ${neonIds.length}`)

  if (neonIds.length === 0) return 0

  const existing = await getAllDocIdsForCorpus('primary-acts-pre-2000')
  const missing = neonIds
    .filter(id => !existing.has(id))
    .map(id => ({
      id: `primary-acts-pre-2000:${id}`,
      corpus: 'primary-acts-pre-2000',
      docId: id,
      sourceType: 'tna-legislation',
      priority: 3, // lower priority — older, less user-relevant
    }))

  console.log(`[reseed]   not yet in queue: ${missing.length}`)
  if (missing.length === 0) return 0

  const inserted = await bulkUpsertQueueRows(missing)
  console.log(`[reseed]   inserted: ${inserted} new queue rows`)
  return inserted
}

// ── C) Regional SSI + WSI ────────────────────────────────────────────────────

async function reseedRegionalSsiWsi(): Promise<number> {
  console.log('\n[reseed] C) Regional SSI (ssi) + WSI (wsi) …')
  const existing = await getAllDocIdsForCorpus('regional')
  console.log(`[reseed]   existing regional queue rows: ${existing.size}`)

  let total = 0
  for (const type of ['ssi', 'wsi'] as const) {
    const actIds = await listActIds(type, 1999, 2030)
    console.log(`[reseed]   TNA ${type}: ${actIds.length} items`)
    const missing = actIds
      .filter(id => !existing.has(id))
      .map(id => ({
        id: `regional:${id}`,
        corpus: 'regional',
        docId: id,
        sourceType: 'tna-legislation',
        priority: 2,
      }))
    if (missing.length === 0) { console.log(`[reseed]   ${type}: none missing`); continue }
    const inserted = await bulkUpsertQueueRows(missing)
    console.log(`[reseed]   ${type}: ${inserted} new rows inserted (${missing.length} were missing)`)
    total += inserted
  }
  return total
}

// ── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  console.log('[reseed] Starting queue gap reseed …')

  const [a, b, c] = await Promise.all([
    reseedSi2010Plus(),
    reseedPreNormanPga(),
  ]).then(async ([a, b]) => [a, b, await reseedRegionalSsiWsi()])

  console.log('\n[reseed] ── COMPLETE ──────────────────────────────────')
  console.log(`  A) UKSI 2010–2026:    ${a} new rows`)
  console.log(`  B) UKPGA pre-1963:    ${b} new rows`)
  console.log(`  C) SSI + WSI:         ${c} new rows`)
  console.log(`  Total:                ${a + b + c} rows inserted`)

  await disconnectQueue()
}

main().catch(e => { console.error('[reseed] fatal:', e); process.exit(1) })
