/**
 * backfill-compiled-to-r2.ts
 * Writes compiledText from Railway corpus_sections to R2 for rows where R2 is missing it.
 * Runs before TRUNCATE — source data is Railway corpus_sections.
 * Architecture principle: compiled text belongs in R2 not Postgres.
 *
 * Usage:
 *   NODE_PATH=scrutinise-web/node_modules scrutinise-web/node_modules/.bin/tsx \
 *     --tsconfig scripts/tsconfig.json scripts/ingest/backfill-compiled-to-r2.ts
 */
import { Pool } from 'pg'
import {
  S3Client,
  PutObjectCommand,
  HeadObjectCommand,
} from '@aws-sdk/client-s3'
import * as fs from 'fs'
import * as path from 'path'

try {
  require('dotenv').config({ path: path.join(__dirname, '../../scrutinise-web/.env') })
} catch { /* ok */ }

const CHECKPOINT_FILE = path.join(__dirname, 'backfill-compiled-checkpoint.json')
const BATCH_SIZE = 500
const HEAD_CONCURRENCY = 50  // parallel HEAD checks per batch

function buildS3Client(): S3Client {
  const accountId = process.env.CLOUDFLARE_R2_ACCOUNT_ID
  const accessKey = process.env.CLOUDFLARE_R2_ACCESS_KEY_ID
  const secretKey = process.env.CLOUDFLARE_R2_SECRET_ACCESS_KEY
  if (!accountId || !accessKey || !secretKey) {
    throw new Error('R2 credentials not set (CLOUDFLARE_R2_ACCOUNT_ID, CLOUDFLARE_R2_ACCESS_KEY_ID, CLOUDFLARE_R2_SECRET_ACCESS_KEY)')
  }
  return new S3Client({
    region: 'auto',
    endpoint: `https://${accountId}.r2.cloudflarestorage.com`,
    credentials: { accessKeyId: accessKey, secretAccessKey: secretKey },
  })
}

async function headExists(s3: S3Client, bucket: string, key: string): Promise<boolean> {
  try {
    await s3.send(new HeadObjectCommand({ Bucket: bucket, Key: key }))
    return true
  } catch {
    return false
  }
}

async function processWithConcurrency<T, R>(
  items: T[],
  concurrency: number,
  fn: (item: T) => Promise<R>,
): Promise<R[]> {
  const results: R[] = []
  for (let i = 0; i < items.length; i += concurrency) {
    const batch = items.slice(i, i + concurrency)
    const batchResults = await Promise.all(batch.map(fn))
    results.push(...batchResults)
  }
  return results
}

async function backfill() {
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false },
  })
  const s3 = buildS3Client()
  const bucket = process.env.CLOUDFLARE_R2_BUCKET_NAME ?? 'scrutinise-legislation'

  // Load checkpoint
  let lastId = 0
  if (fs.existsSync(CHECKPOINT_FILE)) {
    lastId = JSON.parse(fs.readFileSync(CHECKPOINT_FILE, 'utf8')).lastId
    console.log(`[backfill] resuming from id > ${lastId}`)
  }

  // Count eligible rows (r2Key present + compiledText present = we know where to write)
  const { rows: [{ count }] } = await pool.query<{ count: string }>(
    `SELECT COUNT(*) FROM corpus_sections
     WHERE "compiledText" IS NOT NULL AND "r2Key" IS NOT NULL AND id > $1`, [lastId]
  )
  console.log(`[backfill] ${count} rows with compiledText and r2Key to process`)

  let written = 0, skipped = 0, total = 0

  while (true) {
    const { rows } = await pool.query<{
      id: number
      r2Key: string
      compiledText: string
    }>(
      `SELECT id, "r2Key", "compiledText"
       FROM corpus_sections
       WHERE "compiledText" IS NOT NULL AND "r2Key" IS NOT NULL AND id > $1
       ORDER BY id LIMIT $2`,
      [lastId, BATCH_SIZE]
    )
    if (rows.length === 0) break

    // Check existence in parallel
    const existsResults = await processWithConcurrency(
      rows,
      HEAD_CONCURRENCY,
      row => headExists(s3, bucket, row.r2Key),
    )

    // Write missing ones sequentially to avoid overwhelming R2
    for (let i = 0; i < rows.length; i++) {
      const row = rows[i]
      if (!existsResults[i]) {
        await s3.send(new PutObjectCommand({
          Bucket: bucket,
          Key: row.r2Key,
          Body: row.compiledText,
          ContentType: 'text/plain',
        }))
        written++
      } else {
        skipped++
      }
      total++
    }

    lastId = rows[rows.length - 1].id
    fs.writeFileSync(CHECKPOINT_FILE, JSON.stringify({ lastId }))

    if (total % 5000 < BATCH_SIZE) {
      console.log(`[backfill] ${total.toLocaleString()} processed, ${written.toLocaleString()} written to R2, ${skipped.toLocaleString()} already existed`)
    }
  }

  // Count rows with compiledText but no r2Key (can't backfill without a target key)
  const { rows: [{ nokey }] } = await pool.query<{ nokey: string }>(
    `SELECT COUNT(*) AS nokey FROM corpus_sections WHERE "compiledText" IS NOT NULL AND "r2Key" IS NULL`
  )
  const noR2Key = parseInt(nokey, 10)

  console.log(`[backfill] complete — ${written.toLocaleString()} written to R2, ${skipped.toLocaleString()} already in R2, ${total.toLocaleString()} total`)
  if (noR2Key > 0) {
    console.log(`[backfill] ${noR2Key.toLocaleString()} rows had compiledText but no r2Key — skipped (no target key)`)
  }

  await pool.end()
  try { fs.unlinkSync(CHECKPOINT_FILE) } catch { /* ok */ }
}

backfill().catch(e => { console.error('[backfill] fatal:', e.message); process.exit(1) })
