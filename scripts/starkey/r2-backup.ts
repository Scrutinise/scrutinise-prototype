// Back the raw Starkey corpus up to R2.
//
// The files are git-ignored on purpose (private research corpus, and 300+ MB),
// which leaves them on exactly one disk. R2 is the project's existing home for
// bulk private artefacts, so that is where the second copy goes.
//
// Idempotent: an object already present with the same byte length is skipped,
// so a re-run after a partial upload finishes the job rather than redoing it.
//
// Verification is a separate pass over EVERY key, reading the size back from
// R2 rather than trusting the upload's own return — a PUT that returns without
// throwing is not evidence the bytes are there.
import * as fs from 'fs'
import * as path from 'path'
import { HeadObjectCommand, PutObjectCommand, S3Client } from '@aws-sdk/client-s3'
import { ROOT } from './manifest'
import { readEnvVar } from './db'

const ACCOUNT = readEnvVar('CLOUDFLARE_R2_ACCOUNT_ID')
const BUCKET = readEnvVar('CLOUDFLARE_R2_BUCKET_NAME') ?? 'scrutinise-legislation'
export const PREFIX = 'research/starkey/'

const r2 = new S3Client({
  region: 'auto',
  endpoint: `https://${ACCOUNT}.r2.cloudflarestorage.com`,
  credentials: {
    accessKeyId: readEnvVar('CLOUDFLARE_R2_ACCESS_KEY_ID')!,
    secretAccessKey: readEnvVar('CLOUDFLARE_R2_SECRET_ACCESS_KEY')!,
  },
})

const CONTENT_TYPE: Record<string, string> = {
  '.json': 'application/json', '.vtt': 'text/vtt', '.log': 'text/plain', '.txt': 'text/plain',
}

interface Item { abs: string; key: string; size: number }

function collect(): Item[] {
  const out: Item[] = []
  for (const dir of ['meta', 'raw', 'logs']) {
    const d = path.join(ROOT, dir)
    if (!fs.existsSync(d)) continue
    for (const f of fs.readdirSync(d)) {
      const abs = path.join(d, f)
      const st = fs.statSync(abs)
      if (!st.isFile()) continue
      out.push({ abs, key: `${PREFIX}${dir}/${f}`, size: st.size })
    }
  }
  return out
}

async function headSize(key: string): Promise<number | null> {
  try {
    const r = await r2.send(new HeadObjectCommand({ Bucket: BUCKET, Key: key }))
    return r.ContentLength ?? null
  } catch { return null }
}

async function pool<T>(items: T[], width: number, fn: (t: T) => Promise<void>) {
  let i = 0
  await Promise.all(Array.from({ length: width }, async () => {
    while (i < items.length) { const k = i++; await fn(items[k]) }
  }))
}

async function main() {
  if (!ACCOUNT || !readEnvVar('CLOUDFLARE_R2_ACCESS_KEY_ID')) throw new Error('R2 credentials not set')
  const verifyOnly = process.argv.includes('--verify-only')
  const items = collect()
  const bytes = items.reduce((n, i) => n + i.size, 0)
  console.log(`[starkey] R2 backup — bucket=${BUCKET} prefix=${PREFIX}`)
  console.log(`[starkey] ${items.length} files, ${(bytes / 1e6).toFixed(1)} MB`)

  let uploaded = 0, skipped = 0, failed: string[] = []
  if (!verifyOnly) {
    await pool(items, 8, async (it) => {
      const existing = await headSize(it.key)
      if (existing === it.size) { skipped++; return }
      try {
        await r2.send(new PutObjectCommand({
          Bucket: BUCKET, Key: it.key, Body: fs.readFileSync(it.abs),
          ContentType: CONTENT_TYPE[path.extname(it.abs)] ?? 'application/octet-stream',
        }))
        uploaded++
        if (uploaded % 100 === 0) console.log(`  uploaded ${uploaded}...`)
      } catch (e) { failed.push(`${it.key}: ${(e as Error).message}`) }
    })
    console.log(`uploaded ${uploaded}, already present ${skipped}, failed ${failed.length}`)
    for (const f of failed.slice(0, 10)) console.log(`  ! ${f}`)
  }

  console.log('\nverifying every key by reading its size back from R2...')
  const missing: string[] = []
  const wrongSize: string[] = []
  await pool(items, 8, async (it) => {
    const s = await headSize(it.key)
    if (s === null) missing.push(it.key)
    else if (s !== it.size) wrongSize.push(`${it.key} local=${it.size} r2=${s}`)
  })
  console.log(`checked ${items.length} keys — missing ${missing.length}, wrong size ${wrongSize.length}`)
  for (const m of missing.slice(0, 10)) console.log(`  MISSING ${m}`)
  for (const m of wrongSize.slice(0, 10)) console.log(`  SIZE    ${m}`)

  // A verify that cannot fail proves nothing: confirm a key that should NOT
  // exist reads back as absent, so "everything present" is a real result.
  const control = await headSize(`${PREFIX}__control_should_not_exist__`)
  console.log(`control key (must be absent): ${control === null ? 'absent — check is live' : '!! PRESENT, the check is not discriminating'}`)

  if (missing.length || wrongSize.length || failed.length) process.exit(1)
  console.log(`\nOK — ${items.length} objects at r2://${BUCKET}/${PREFIX}`)
}

main().catch(e => { console.error('ERROR:', e.message); process.exit(1) })
