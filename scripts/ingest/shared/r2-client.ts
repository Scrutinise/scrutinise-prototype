import {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
  HeadObjectCommand,
  ListObjectsV2Command,
} from '@aws-sdk/client-s3'
import path from 'path'

// Load .env for local dev; Railway injects env vars directly
try {
  require('dotenv').config({ path: path.join(__dirname, '../../../scrutinise-web/.env') })
} catch { /* dotenv optional */ }

function buildClient(): S3Client {
  const accountId = process.env.CLOUDFLARE_R2_ACCOUNT_ID
  const accessKey = process.env.CLOUDFLARE_R2_ACCESS_KEY_ID
  const secretKey = process.env.CLOUDFLARE_R2_SECRET_ACCESS_KEY
  if (!accountId || !accessKey || !secretKey) {
    throw new Error('R2 credentials not set: CLOUDFLARE_R2_ACCOUNT_ID, CLOUDFLARE_R2_ACCESS_KEY_ID, CLOUDFLARE_R2_SECRET_ACCESS_KEY required')
  }
  return new S3Client({
    region: 'auto',
    endpoint: `https://${accountId}.r2.cloudflarestorage.com`,
    credentials: { accessKeyId: accessKey, secretAccessKey: secretKey },
  })
}

let _client: S3Client | null = null
function getClient(): S3Client {
  if (!_client) _client = buildClient()
  return _client
}

export function getBucket(): string {
  return process.env.CLOUDFLARE_R2_BUCKET_NAME ?? 'scrutinise-legislation'
}

export async function r2Put(key: string, body: string | Buffer, contentType = 'text/plain'): Promise<void> {
  await getClient().send(new PutObjectCommand({
    Bucket: getBucket(), Key: key, Body: body, ContentType: contentType,
  }))
}

export async function r2Get(key: string): Promise<string | null> {
  try {
    const res = await getClient().send(new GetObjectCommand({ Bucket: getBucket(), Key: key }))
    return await res.Body?.transformToString() ?? null
  } catch {
    return null
  }
}

export async function r2Exists(key: string): Promise<boolean> {
  try {
    await getClient().send(new HeadObjectCommand({ Bucket: getBucket(), Key: key }))
    return true
  } catch {
    return false
  }
}

export async function r2List(prefix: string): Promise<string[]> {
  const keys: string[] = []
  let continuationToken: string | undefined
  do {
    const res = await getClient().send(new ListObjectsV2Command({
      Bucket: getBucket(),
      Prefix: prefix,
      ContinuationToken: continuationToken,
    }))
    for (const obj of res.Contents ?? []) {
      if (obj.Key) keys.push(obj.Key)
    }
    continuationToken = res.NextContinuationToken
  } while (continuationToken)
  return keys
}

// ── Key helpers for corpus ingest ─────────────────────────────────────────────

export function compiledKey(corpus: string, docId: string, sectionRef: string): string {
  return `${corpus}/${docId}/sections/${sectionRef}/compiled.txt`
}

export function rawKey(corpus: string, docId: string, sectionRef: string, ext = 'xml'): string {
  return `${corpus}/${docId}/sections/${sectionRef}/raw.${ext}`
}

export function checkpointKey(workerId: number): string {
  return `ingest-checkpoint/worker-${workerId}.json`
}

export const PROGRESS_KEY = 'ingest-checkpoint/corpus-progress.json'

export function csvKey(date: string): string {
  return `ingest-csv/progress-${date}.csv`
}
