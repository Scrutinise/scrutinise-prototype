import {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
  HeadObjectCommand,
  DeleteObjectCommand,
  ListObjectsV2Command,
} from '@aws-sdk/client-s3'
import { NodeHttpHandler } from '@smithy/node-http-handler'
import { Agent as HttpsAgent } from 'node:https'
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
  // Connection pool + per-request timeout are env-tunable. DEFAULT maxSockets (50)
  // matches the AWS SDK's NodeHttpHandler default, so the live ingest worker behaves
  // identically unless R2_MAX_SOCKETS is set — the FTS bulk build sets R2_MAX_SOCKETS=256
  // to lift the per-row fetch ceiling. requestTimeout bounds a single request so a
  // stuck socket can't silently wedge a whole batch (the failure mode behind the
  // earlier false 'hang'); 120s is well above any legit R2 op, so it only fires on a
  // genuine stall.
  const maxSockets = parseInt(process.env.R2_MAX_SOCKETS ?? '50', 10)
  const requestTimeout = parseInt(process.env.R2_REQUEST_TIMEOUT_MS ?? '120000', 10)
  return new S3Client({
    region: 'auto',
    endpoint: `https://${accountId}.r2.cloudflarestorage.com`,
    credentials: { accessKeyId: accessKey, secretAccessKey: secretKey },
    requestHandler: new NodeHttpHandler({
      httpsAgent: new HttpsAgent({ keepAlive: true, maxSockets }),
      requestTimeout,
    }),
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

// V19 — used by cleanup scripts to remove superseded/garbage objects
// (e.g. the pre-1963 chrome-boilerplate captures). Deletes are free on R2.
export async function r2Delete(key: string): Promise<void> {
  await getClient().send(new DeleteObjectCommand({ Bucket: getBucket(), Key: key }))
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

// ── Source-specific key helpers ───────────────────────────────────────────────

// Sanitize a string for use as an R2 key path component.
// Allows alphanumeric, hyphens, underscores, dots, and forward-slashes;
// replaces everything else (brackets, spaces, colons, etc.) with hyphens.
function safeKeyPart(s: string): string {
  return s
    .replace(/[[\]()]/g, '')
    .replace(/[^a-zA-Z0-9\-_.]/g, '-')
    .replace(/-{2,}/g, '-')
    .replace(/^-|-$/g, '')
    .toLowerCase()
    .slice(0, 200)
}

// TNA Find Case Law: caselaw/{safe-citation}/compiled.txt
export function caselawKey(citation: string): string {
  return `caselaw/${safeKeyPart(citation)}/compiled.txt`
}

export function caselawRawKey(citation: string): string {
  return `caselaw/${safeKeyPart(citation)}/raw.xml`
}

// BAILII: caselaw/bailii/{safe-ref}/compiled.txt
export function bailiiKey(courtRef: string): string {
  return `caselaw/bailii/${safeKeyPart(courtRef)}/compiled.txt`
}

// Hansard / Parliament: hansard/{YYYY-MM-DD}/{safe-id}/compiled.txt
export function hansardKey(date: string, debateId: string): string {
  const safeDate = (date ?? '').slice(0, 10).replace(/[^0-9-]/g, '') || 'unknown'
  return `hansard/${safeDate}/${safeKeyPart(debateId)}/compiled.txt`
}
