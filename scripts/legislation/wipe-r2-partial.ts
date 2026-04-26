/**
 * wipe-r2-partial.ts
 * Deletes all *.xml and *.compiled.txt objects from R2.
 * PRESERVES all *.summary.txt objects.
 * Run once before restarting ingest with new three-layer scheme.
 */
import dotenv from 'dotenv'
import path from 'path'
dotenv.config({ path: path.join(__dirname, '../../scrutinise-web/.env') })

import { S3Client, ListObjectsV2Command, DeleteObjectsCommand } from '@aws-sdk/client-s3'

const R2_ACCOUNT_ID = process.env.CLOUDFLARE_R2_ACCOUNT_ID!
const R2_BUCKET     = process.env.CLOUDFLARE_R2_BUCKET_NAME ?? 'scrutinise-legislation'

const r2 = new S3Client({
  region: 'auto',
  endpoint: `https://${R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
  credentials: {
    accessKeyId:     process.env.CLOUDFLARE_R2_ACCESS_KEY_ID!,
    secretAccessKey: process.env.CLOUDFLARE_R2_SECRET_ACCESS_KEY!,
  },
})

function shouldDelete(key: string): boolean {
  // Delete .xml and .compiled.txt; NEVER delete .summary.txt
  if (key.endsWith('.summary.txt')) return false
  if (key.endsWith('.xml'))          return true
  if (key.endsWith('.compiled.txt')) return true
  return false
}

async function main() {
  console.log(`Scanning bucket: ${R2_BUCKET}`)
  console.log('Will DELETE: *.xml, *.compiled.txt')
  console.log('Will PRESERVE: *.summary.txt (and any other keys)')

  const toDelete: string[] = []
  let totalScanned = 0
  let preserved    = 0
  let continuationToken: string | undefined

  // List all objects
  do {
    const cmd = new ListObjectsV2Command({
      Bucket:            R2_BUCKET,
      MaxKeys:           1000,
      ContinuationToken: continuationToken,
    })
    const res = await r2.send(cmd)
    const objects = res.Contents ?? []

    for (const obj of objects) {
      if (!obj.Key) continue
      totalScanned++
      if (shouldDelete(obj.Key)) {
        toDelete.push(obj.Key)
      } else {
        preserved++
      }
    }

    continuationToken = res.IsTruncated ? res.NextContinuationToken : undefined

    if (toDelete.length % 5000 < 1000) {
      console.log(`  Scanned ${totalScanned} objects so far, ${toDelete.length} queued for deletion...`)
    }
  } while (continuationToken)

  console.log(`\nScan complete:`)
  console.log(`  Total scanned:   ${totalScanned}`)
  console.log(`  Queued to delete: ${toDelete.length}`)
  console.log(`  Preserved:        ${preserved}`)

  if (toDelete.length === 0) {
    console.log('Nothing to delete.')
    return
  }

  // Safety: require explicit --confirm flag to actually delete
  if (!process.argv.includes('--confirm')) {
    console.log('\nDRY RUN — no objects deleted.')
    console.log('Re-run with --confirm to perform actual deletion.')
    return
  }

  console.log('\nDeleting...')
  let deleted = 0
  let errors  = 0

  // Delete in batches of 1000 (S3 API limit)
  for (let i = 0; i < toDelete.length; i += 1000) {
    const batch = toDelete.slice(i, i + 1000)
    const cmd = new DeleteObjectsCommand({
      Bucket: R2_BUCKET,
      Delete: {
        Objects: batch.map(Key => ({ Key })),
        Quiet: false,
      },
    })
    const res = await r2.send(cmd)
    deleted += res.Deleted?.length ?? 0
    const batchErrors = res.Errors?.length ?? 0
    if (batchErrors > 0) {
      errors += batchErrors
      console.error(`  Batch ${Math.floor(i / 1000) + 1}: ${batchErrors} errors:`)
      res.Errors?.slice(0, 3).forEach(e => console.error(`    ${e.Key}: ${e.Message}`))
    } else {
      console.log(`  Batch ${Math.floor(i / 1000) + 1}: deleted ${res.Deleted?.length} objects`)
    }
  }

  console.log(`\nDeletion complete:`)
  console.log(`  Deleted: ${deleted}`)
  console.log(`  Errors:  ${errors}`)
  console.log(`  Preserved (not targeted): ${preserved}`)

  // Verify post-wipe count
  console.log('\nPost-wipe scan...')
  let remaining = 0
  let remainingToken: string | undefined
  do {
    const res = await r2.send(new ListObjectsV2Command({
      Bucket: R2_BUCKET, MaxKeys: 1000, ContinuationToken: remainingToken,
    }))
    remaining += res.Contents?.length ?? 0
    remainingToken = res.IsTruncated ? res.NextContinuationToken : undefined
  } while (remainingToken)

  console.log(`  Remaining objects in bucket: ${remaining}`)
  console.log(`  (Expected: ~${preserved} — the .summary.txt files)`)
}

main().catch(console.error)
