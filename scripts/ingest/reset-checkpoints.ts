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

const KEYS = [
  'ingest-checkpoint/worker-1.json',
  'ingest-checkpoint/worker-2.json',
  'ingest-checkpoint/worker-3.json',
  'ingest-checkpoint/worker-4.json',
]

async function main() {
  for (const key of KEYS) {
    try {
      await r2.send(new DeleteObjectCommand({ Bucket: bucket, Key: key }))
      console.log(`deleted: ${key}`)
    } catch (err) {
      console.error(`failed: ${key} — ${err}`)
    }
  }
  console.log('done — workers 1–4 will start Phase 1 from scratch on next restart')
}

main().catch(err => { console.error(err); process.exit(1) })
