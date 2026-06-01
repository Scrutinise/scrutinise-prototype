import path from 'path'
try { require('dotenv').config({ path: path.join(__dirname, '../../scrutinise-web/.env') }) } catch { /* ok */ }

import { PrismaClient } from '@prisma/client'
import { r2Get, r2Put, rawKey, compiledKey } from './shared/r2-client'
import { upsertSection, countWords } from './shared/db-metadata'
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
  const db = new PrismaClient({ datasource: { db: { url: process.env.DATABASE_URL } } })
  const throttle = new AdaptiveThrottle({ floor: 200 })

  let totalProcessed = 0
  let totalSucceeded = 0
  let totalFailed = 0
  let lastId = ''

  console.log('retry-failed: scanning corpus_sections for status=failed...')

  // Cursor-based pagination ordered by id so updates (failed→compiled) don't
  // shift the result window — each row is visited exactly once per run.
  while (true) {
    const rows = await (db as unknown as {
      corpusSection: {
        findMany: (args: {
          where: Record<string, unknown>
          take: number
          orderBy: Record<string, string>
        }) => Promise<FailedRow[]>
      }
    }).corpusSection.findMany({
      where: { status: 'failed', id: { gt: lastId } },
      take: BATCH_SIZE,
      orderBy: { id: 'asc' },
    })

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
        await upsertSection({
          id: row.id,
          corpus,
          r2Key: cKey,
          r2RawKey: rawR2Key,
          wordCount: countWords(compiled),
          status: 'compiled',
        })

        throttle.success()
        totalSucceeded++
        console.log(`  ✓ ${row.id}`)
      } catch (err: unknown) {
        throttle.backoff()
        totalFailed++
        const msg = String(err).slice(0, 500)
        // Preserve the discovered rawR2Key so the next retry run can find the raw content
        await upsertSection({ id: row.id, corpus, r2RawKey: rawR2Key, status: 'failed', errorMsg: msg })
        console.error(`  ✗ ${row.id} — ${msg}`)
      }
    }
  }

  console.log(`\nretry-failed complete: ${totalSucceeded} compiled, ${totalFailed} still failed (${totalProcessed} total)`)
  await db.$disconnect()
}

main().catch(err => { console.error('[retry-failed] fatal:', err); process.exit(1) })
