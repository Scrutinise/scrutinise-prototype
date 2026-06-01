/**
 * reset-checkpoints.ts — delete worker checkpoint files from R2 so workers
 * restart Phase 1 from scratch on next Railway redeploy.
 *
 * Usage:
 *   npx tsx scripts/ingest/reset-checkpoints.ts          # resets workers 1–4 (default)
 *   npx tsx scripts/ingest/reset-checkpoints.ts 3 4      # resets only workers 3 and 4
 *   npx tsx scripts/ingest/reset-checkpoints.ts 1 2 3 4  # explicit full reset
 */
import path from 'path'
import { DeleteObjectCommand, S3Client } from '@aws-sdk/client-s3'
try { require('dotenv').config({ path: path.join(__dirname, '../../scrutinise-web/.env') }) } catch { /* ok */ }

const accountId = process.env.CLOUDFLARE_R2_ACCOUNT_ID!
const bucket = process.env.CLOUDFLARE_R2_BUCKET_NAME ?? 'scrutinise-legislation'

const r2 = new S3Client({
  region: 'auto',
  endpoint: `https://${accountId}.r2.cloudflarestorage.com`,
  credentials: {
    accessKeyId: process.env.CLOUDFLARE_R2_ACCESS_KEY_ID!,
    secretAccessKey: process.env.CLOUDFLARE_R2_SECRET_ACCESS_KEY!,
  },
})

// Parse worker IDs from args, defaulting to 1–4
const argIds = process.argv.slice(2).map(Number).filter(n => n >= 1 && n <= 10)
const workerIds = argIds.length > 0 ? argIds : [1, 2, 3, 4]

const KEYS = workerIds.map(id => `ingest-checkpoint/worker-${id}.json`)

async function main() {
  console.log(`Resetting checkpoints for worker(s): ${workerIds.join(', ')}`)
  for (const key of KEYS) {
    try {
      await r2.send(new DeleteObjectCommand({ Bucket: bucket, Key: key }))
      console.log(`deleted: ${key}`)
    } catch (err) {
      console.error(`failed: ${key} — ${err}`)
    }
  }
  console.log(`done — worker(s) ${workerIds.join(', ')} will start Phase 1 from scratch on next restart`)
}

main().catch(err => { console.error(err); process.exit(1) })
