import path from 'path'
try { require('dotenv').config({ path: path.join(__dirname, '../../scrutinise-web/.env') }) } catch {}

import { S3Client, ListObjectsV2Command } from '@aws-sdk/client-s3'

function buildClient() {
  return new S3Client({
    region: 'auto',
    endpoint: `https://${process.env.CLOUDFLARE_R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
    credentials: {
      accessKeyId: process.env.CLOUDFLARE_R2_ACCESS_KEY_ID!,
      secretAccessKey: process.env.CLOUDFLARE_R2_SECRET_ACCESS_KEY!,
    },
  })
}

async function countPrefix(client: S3Client, bucket: string, prefix: string): Promise<number> {
  let count = 0
  let token: string | undefined
  do {
    const res = await client.send(new ListObjectsV2Command({
      Bucket: bucket, Prefix: prefix, MaxKeys: 1000, ContinuationToken: token,
    }))
    count += res.KeyCount ?? 0
    token = res.NextContinuationToken
  } while (token)
  return count
}

// List top-level "directories" in the bucket (common prefixes with delimiter '/')
async function listTopPrefixes(client: S3Client, bucket: string): Promise<string[]> {
  const res = await client.send(new ListObjectsV2Command({
    Bucket: bucket, Delimiter: '/', MaxKeys: 1000,
  }))
  return (res.CommonPrefixes ?? []).map(p => p.Prefix ?? '').filter(Boolean)
}

async function main() {
  const client = buildClient()
  const bucket = process.env.CLOUDFLARE_R2_BUCKET_NAME ?? 'scrutinise-legislation'

  console.log('\n=== D2: R2 top-level prefixes ===')
  const topPrefixes = await listTopPrefixes(client, bucket)
  console.log(`  Top-level prefixes (${topPrefixes.length}):`)
  for (const p of topPrefixes) console.log(`    ${p}`)

  // Prefixes from the brief + key prefixes from r2-client.ts key scheme
  const checkPrefixes = [
    // Brief list
    'debates/', 'lords/', 'wrans/', 'westminhall/',
    'caselaw/', 'hansard/', 'fca-regulators/', 'tna-legislation/', 'eur-lex/', 'lda-parliament/',
    // Actual corpus names from DB / r2-client key scheme
    'pwdata-debates/', 'pwdata-lords/', 'pwdata-wrans/', 'pwdata-westminster/',
    'primary-acts-2000plus/', 'primary-acts-pre-2000/', 'si-2010plus/', 'si-pre-2010/',
    'regional/', 'retained-eu/', 'tna-caselaw/', 'hmrc-codes-guidance/', 'hmrc-tiins/',
    'lda-commonsoralquestions/', 'lda-lordswrittenquestions/', 'lda-commonswrittenquestions/',
    'lda-commonsdivisions/', 'lda-lordsdivisions/',
    'uk-treaties/', 'eur-lex/', 'echr-hudoc/',
    'written-statements/', 'nao-reports/', 'scotlawcom/', 'ots-reports/',
    'sentencing-council/', 'college-of-policing/',
    // Checkpoint/progress keys
    'ingest-checkpoint/', 'ingest-csv/',
  ]

  console.log('\n=== D2: Key counts by prefix ===')
  for (const prefix of checkPrefixes) {
    // Only count if it's in the top-level prefix list (avoids slow scans of non-existent prefixes)
    if (!topPrefixes.includes(prefix)) {
      console.log(`  ${prefix.padEnd(42)} (not in bucket)`)
      continue
    }
    const count = await countPrefix(client, bucket, prefix)
    console.log(`  ${prefix.padEnd(42)} ${String(count).padStart(9)} keys`)
  }

  // Show any top-level prefixes not in our check list
  const unchecked = topPrefixes.filter(p => !checkPrefixes.includes(p))
  if (unchecked.length > 0) {
    console.log('\n  Unchecked top-level prefixes:')
    for (const p of unchecked) console.log(`    ${p}`)
  }
}
main().catch(e => { console.error(e); process.exit(1) })
