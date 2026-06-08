/**
 * classify-no-provisions.ts — Bulk classify existing hasNoProvisions queue rows.
 *
 * Reads Railway queue rows where status='done' and lastError indicates a hasNoProvisions
 * item (including the new 'hasNoProvisions-pending-classification' marker).
 * For each, fetches minimal TNA metadata, classifies it, writes a corpus_sections row
 * to Neon, and inserts specialist_queue rows for commencement/pdf-only items.
 *
 * Checkpointed/resumable — safe to kill and restart. Reports progress every 500 items.
 * Run as a background process — may take hours for thousands of items.
 *
 * Usage:
 *   NODE_PATH=scrutinise-web/node_modules scrutinise-web/node_modules/.bin/tsx \
 *     --tsconfig scripts/tsconfig.json scripts/ingest/classify-no-provisions.ts
 */

import { Pool } from 'pg'
import * as fs from 'fs'
import * as path from 'path'
try { require('dotenv').config({ path: path.join(__dirname, '../../scrutinise-web/.env') }) } catch { /* ok */ }

import { classifyNoProvisionsItem, extractSectionMetadata, AVAILABILITY_NOTES } from './sources/tna-legislation'
import { upsertSection, sectionId } from './shared/db-metadata'

const CHECKPOINT_FILE = path.join(__dirname, 'classify-no-provisions-checkpoint.json')
const PROGRESS_EVERY = 500
const DELAY_MS = 200  // between TNA requests to avoid rate limiting

// Corpora that use TNA legislation (and may have hasNoProvisions items)
const TNA_CORPORA = [
  'si-pre-2010', 'si-2010plus', 'regional', 'retained-eu',
  'primary-acts-pre-2000', 'primary-acts-2000plus',
]

interface Checkpoint {
  lastProcessedId: string | null
  processed: number
  skipped: number
  errors: number
  startedAt: string
}

function loadCheckpoint(): Checkpoint {
  try {
    if (fs.existsSync(CHECKPOINT_FILE)) {
      return JSON.parse(fs.readFileSync(CHECKPOINT_FILE, 'utf8'))
    }
  } catch { /* start fresh */ }
  return { lastProcessedId: null, processed: 0, skipped: 0, errors: 0, startedAt: new Date().toISOString() }
}

function saveCheckpoint(cp: Checkpoint): void {
  fs.writeFileSync(CHECKPOINT_FILE, JSON.stringify(cp, null, 2))
}

async function sleep(ms: number): Promise<void> {
  return new Promise(r => setTimeout(r, ms))
}

async function fetchTnaXml(actId: string): Promise<string | null> {
  try {
    const res = await fetch(`https://www.legislation.gov.uk/${actId}/data.xml`, {
      headers: { 'User-Agent': 'Scrutinise-Ingest/1.0 (legal corpus research)' },
    })
    if (!res.ok) return null
    return res.text()
  } catch {
    return null
  }
}

async function main() {
  const railwayPool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false },
  })

  const cp = loadCheckpoint()
  console.log(`[classify] starting — checkpoint: processed=${cp.processed} errors=${cp.errors} lastId=${cp.lastProcessedId}`)

  const corpusIn = TNA_CORPORA.map((_, i) => `$${i + 2}`).join(',')

  let batchStart = 0

  while (true) {
    // Fetch a batch of queue rows that need classification
    // Targets: done rows that are hasNoProvisions items (either the new marker or legacy patterns)
    const { rows } = await railwayPool.query(`
      SELECT id, corpus, "docId", "sourceType"
      FROM ingest_queue
      WHERE status = 'done'
        AND corpus IN (${TNA_CORPORA.map((_, i) => `$${i + 1}`).join(',')})
        AND (
          "lastError" = 'hasNoProvisions-pending-classification'
          OR "lastError" LIKE '%hasNoProvisions%'
          OR "lastError" LIKE '%enacted-only%'
        )
        AND ($${TNA_CORPORA.length + 1}::text IS NULL OR id > $${TNA_CORPORA.length + 1})
      ORDER BY id
      LIMIT 1000
    `, [...TNA_CORPORA, cp.lastProcessedId])

    if (rows.length === 0) {
      console.log(`[classify] no more rows to process — done.`)
      break
    }

    console.log(`[classify] batch of ${rows.length} rows (offset from checkpoint)`)

    for (const row of rows) {
      try {
        // Fetch TNA XML to get metadata and classify
        await sleep(DELAY_MS)
        const fullXml = await fetchTnaXml(row.docId)

        if (!fullXml) {
          // Can't fetch — write metadata-only entry with what we know
          const secId = sectionId(row.corpus, row.docId, 'unavailable')
          await upsertSection({
            id: secId,
            corpus: row.corpus,
            sourceUrl: `https://www.legislation.gov.uk/${row.docId}`,
            status: 'unavailable',
            errorMsg: 'hasNoProvisions — XML not fetchable during bulk classification',
            format: 'unavailable',
            availabilityStatus: 'no-provisions',
            availabilityNote: AVAILABILITY_NOTES['no-provisions'],
          })
          cp.skipped++
        } else {
          const classifiedAs = await classifyNoProvisionsItem(row.docId, fullXml)
          const { title, year } = extractSectionMetadata(row.docId, fullXml)
          const availabilityNote = AVAILABILITY_NOTES[classifiedAs]

          const secId = sectionId(row.corpus, row.docId, 'unavailable')
          await upsertSection({
            id: secId,
            corpus: row.corpus,
            sourceUrl: `https://www.legislation.gov.uk/${row.docId}`,
            status: 'unavailable',
            errorMsg: `hasNoProvisions — classified as ${classifiedAs}`,
            format: 'unavailable',
            availabilityStatus: classifiedAs,
            availabilityNote,
          })

          // Insert specialist_queue for types needing future processing
          if (classifiedAs === 'commencement' || classifiedAs === 'pdf-only') {
            await railwayPool.query(`
              INSERT INTO specialist_queue
                (id, corpus, "docId", "sourceType", specialist_type, title, "legislationYear", "legislationType")
              VALUES ($1,$2,$3,$4,$5,$6,$7,$8)
              ON CONFLICT (id) DO NOTHING
            `, [
              row.id,
              row.corpus,
              row.docId,
              row.sourceType,
              classifiedAs,
              title ?? null,
              year ?? null,
              row.docId.split('/')[0],
            ])
          }

          cp.processed++
        }

        cp.lastProcessedId = row.id

        if ((cp.processed + cp.skipped) % PROGRESS_EVERY === 0) {
          console.log(`[classify] progress: ${cp.processed} classified, ${cp.skipped} skipped, ${cp.errors} errors`)
          saveCheckpoint(cp)
        }
      } catch (err) {
        console.error(`[classify] error on ${row.id} (${row.docId}): ${err}`)
        cp.errors++
        cp.lastProcessedId = row.id
      }
    }

    saveCheckpoint(cp)
    batchStart += rows.length
  }

  saveCheckpoint(cp)
  console.log(`[classify] COMPLETE — processed=${cp.processed} skipped=${cp.skipped} errors=${cp.errors}`)
  await railwayPool.end()
}

main().catch(err => {
  console.error('[classify] fatal:', err)
  process.exit(1)
})
