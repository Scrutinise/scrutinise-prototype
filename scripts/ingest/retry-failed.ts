import path from 'path'
try { require('dotenv').config({ path: path.join(__dirname, '../../scrutinise-web/.env') }) } catch { /* ok */ }

import { Pool } from 'pg'
import { r2Get, r2Put, rawKey, compiledKey } from './shared/r2-client'
import { countWords } from './shared/db-metadata'
import { rawToText } from './shared/compile'
import { AdaptiveThrottle } from './shared/adaptive-throttle'

const BATCH_SIZE = 100

interface FailedRow {
  id: string
  corpus: string
  r2RawKey: string | null
  r2Key: string | null
}

function parseId(id: string): { corpus: string; docId: string; sectionRef: string } | null {
  const first = id.indexOf(':')
  const last = id.lastIndexOf(':')
  if (first === -1 || first === last) return null
  return {
    corpus: id.slice(0, first),
    docId: id.slice(first + 1, last),
    sectionRef: id.slice(last + 1),
  }
}

// Resolve raw content: use stored r2RawKey if present, otherwise reconstruct
// from the section ID using common extensions (xml → html → txt).
async function resolveRaw(row: FailedRow): Promise<{ content: string; key: string } | null> {
  if (row.r2RawKey) {
    const content = await r2Get(row.r2RawKey)
    if (content !== null) return { content, key: row.r2RawKey }
  }

  const parsed = parseId(row.id)
  if (!parsed) return null
  const { corpus, docId, sectionRef } = parsed

  for (const ext of ['xml', 'html', 'txt'] as const) {
    const key = rawKey(corpus, docId, sectionRef, ext)
    const content = await r2Get(key)
    if (content !== null) return { content, key }
  }
  return null
}

async function main(): Promise<void> {
  const pool = new Pool({ connectionString: process.env.DATABASE_URL })
  const throttle = new AdaptiveThrottle({ floor: 200 })

  let totalProcessed = 0
  let totalSucceeded = 0
  let totalFailed = 0
  let lastId = ''

  console.log('retry-failed: scanning corpus_sections for status=failed...')

  // Cursor-based pagination ordered by id so updates (failed→compiled) don't
  // shift the result window — each row is visited exactly once per run.
  while (true) {
    const { rows } = await pool.query<FailedRow>(
      `SELECT id, corpus, "r2RawKey", "r2Key"
       FROM corpus_sections
       WHERE status = 'failed' AND id > $1
       ORDER BY id ASC
       LIMIT $2`,
      [lastId, BATCH_SIZE]
    )

    if (rows.length === 0) break

    console.log(`\n[batch] ${rows.length} sections (cursor after "${lastId}")`)
    lastId = rows[rows.length - 1].id

    for (const row of rows) {
      totalProcessed++
      await throttle.wait()

      const resolved = await resolveRaw(row)
      if (!resolved) {
        console.warn(`  [skip] ${row.id} — raw not found in R2 (r2RawKey=${row.r2RawKey ?? 'null'})`)
        totalFailed++
        continue
      }

      const { content, key: rawR2Key } = resolved
      const parsed = parseId(row.id)
      if (!parsed) {
        console.warn(`  [skip] ${row.id} — cannot parse section ID`)
        totalFailed++
        continue
      }

      const { corpus, docId, sectionRef } = parsed
      const cKey = row.r2Key ?? compiledKey(corpus, docId, sectionRef)

      try {
        const compiled = rawToText(content)
        await r2Put(cKey, compiled)
        await pool.query(
          `UPDATE corpus_sections
           SET "r2Key" = $1, "r2RawKey" = $2, "wordCount" = $3,
               status = 'compiled', "compiledAt" = NOW(), "errorMsg" = NULL
           WHERE id = $4`,
          [cKey, rawR2Key, countWords(compiled), row.id]
        )
        throttle.success()
        totalSucceeded++
        console.log(`  ✓ ${row.id}`)
      } catch (err: unknown) {
        throttle.backoff()
        totalFailed++
        const msg = String(err).slice(0, 500)
        await pool.query(
          `UPDATE corpus_sections
           SET "r2RawKey" = $1, status = 'failed', "errorMsg" = $2
           WHERE id = $3`,
          [rawR2Key, msg, row.id]
        )
        console.error(`  ✗ ${row.id} — ${msg}`)
      }
    }
  }

  console.log(`\nretry-failed complete: ${totalSucceeded} compiled, ${totalFailed} still failed (${totalProcessed} total)`)
  await pool.end()
}

main().catch(err => { console.error('[retry-failed] fatal:', err); process.exit(1) })
