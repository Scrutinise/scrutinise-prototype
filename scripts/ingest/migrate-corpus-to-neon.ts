/**
 * migrate-corpus-to-neon.ts
 * Reads corpus_sections from Railway, writes to Neon in batches of 200.
 * Checkpoint/resume — safe to interrupt and restart.
 * Run ONCE after Part 2 (Neon writes) is confirmed working.
 *
 * Usage:
 *   NODE_PATH=scrutinise-web/node_modules scrutinise-web/node_modules/.bin/tsx \
 *     --tsconfig scripts/tsconfig.json scripts/ingest/migrate-corpus-to-neon.ts
 */
import { Pool } from 'pg'
import path from 'path'
import fs from 'fs'
try { require('dotenv').config({ path: path.join(__dirname, '../../scrutinise-web/.env') }) } catch { /* ok */ }

const BATCH = 200
const CHECKPOINT_FILE = path.join(__dirname, 'migrate-corpus-checkpoint.json')

const railwayPool = new Pool({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } })
const neonPool    = new Pool({ connectionString: process.env.NEON_DATABASE_URL, ssl: { rejectUnauthorized: false } })

function loadCheckpoint(): { lastId: string } {
  try { return JSON.parse(fs.readFileSync(CHECKPOINT_FILE, 'utf8')) } catch { return { lastId: '' } }
}
function saveCheckpoint(lastId: string) {
  fs.writeFileSync(CHECKPOINT_FILE, JSON.stringify({ lastId }))
}

async function main() {
  const totalRes = await railwayPool.query<{ n: string }>('SELECT COUNT(*) as n FROM corpus_sections')
  const total = parseInt(totalRes.rows[0].n, 10)
  console.log(`[migrate] Railway corpus_sections: ${total.toLocaleString()} rows to migrate`)

  let { lastId } = loadCheckpoint()
  let migrated = 0

  while (true) {
    const res = await railwayPool.query<{
      id: string; corpus: string; sourceUrl: string | null; r2Key: string | null;
      r2RawKey: string | null; compiledAt: Date | null; wordCount: number | null;
      status: string; errorMsg: string | null; format: string | null;
      xmlPreview: string | null; notes: string | null; compiledText: string | null;
      createdAt: Date;
    }>(`
      SELECT id, corpus, "sourceUrl", "r2Key", "r2RawKey", "compiledAt", "wordCount",
             status, "errorMsg", format, "xmlPreview", notes, "compiledText", "createdAt"
      FROM corpus_sections
      WHERE id > $1
      ORDER BY id ASC
      LIMIT $2
    `, [lastId, BATCH])

    if (res.rows.length === 0) break

    // Build bulk INSERT for Neon
    const values: unknown[] = []
    const placeholders = res.rows.map((r, i) => {
      const b = i * 14
      values.push(r.id, r.corpus, r.sourceUrl, r.r2Key, r.r2RawKey, r.compiledAt,
        r.wordCount, r.status, r.errorMsg, r.format, r.xmlPreview, r.notes,
        r.compiledText, r.createdAt)
      return `($${b+1},$${b+2},$${b+3},$${b+4},$${b+5},$${b+6},$${b+7},$${b+8},$${b+9},$${b+10},$${b+11},$${b+12},$${b+13},$${b+14})`
    })

    await neonPool.query(`
      INSERT INTO corpus_sections
        (id, corpus, "sourceUrl", "r2Key", "r2RawKey", "compiledAt", "wordCount",
         status, "errorMsg", format, "xmlPreview", notes, "compiledText", "createdAt")
      VALUES ${placeholders.join(',')}
      ON CONFLICT (id) DO NOTHING
    `, values)

    lastId = res.rows[res.rows.length - 1].id
    migrated += res.rows.length
    saveCheckpoint(lastId)

    if (migrated % 1000 < BATCH) {
      console.log(`[migrate] ${migrated.toLocaleString()} / ${total.toLocaleString()} migrated`)
    }
  }

  const neonCountRes = await neonPool.query<{ n: string }>('SELECT COUNT(*) as n FROM corpus_sections')
  console.log(`[migrate] done — ${migrated.toLocaleString()} rows migrated. Neon total: ${neonCountRes.rows[0].n}`)
  console.log('[migrate] Verify Neon count matches Railway before running TRUNCATE on Railway.')

  await railwayPool.end()
  await neonPool.end()
  try { fs.unlinkSync(CHECKPOINT_FILE) } catch { /* ok */ }
}

main().catch((e: any) => { console.error('[migrate] fatal:', e.message); process.exit(1) })
