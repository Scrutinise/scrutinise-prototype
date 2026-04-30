import 'dotenv/config'
import { S3Client, ListObjectsV2Command, GetObjectCommand } from '@aws-sdk/client-s3'
import { prisma } from '../../scrutinise-web/lib/prisma'

const R2_ACCOUNT_ID = process.env.CLOUDFLARE_R2_ACCOUNT_ID!
const R2_BUCKET = process.env.CLOUDFLARE_R2_BUCKET_NAME ?? 'scrutinise-legislation'

const r2 = new S3Client({
  region: 'auto',
  endpoint: `https://${R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
  credentials: {
    accessKeyId: process.env.CLOUDFLARE_R2_ACCESS_KEY_ID!,
    secretAccessKey: process.env.CLOUDFLARE_R2_SECRET_ACCESS_KEY!,
  },
})

async function r2Get(key: string): Promise<string | null> {
  try {
    const res = await r2.send(new GetObjectCommand({ Bucket: R2_BUCKET, Key: key }))
    return await res.Body?.transformToString() ?? null
  } catch {
    return null
  }
}

async function listAllSummaryKeys(): Promise<string[]> {
  const keys: string[] = []
  let continuationToken: string | undefined

  do {
    const res = await r2.send(new ListObjectsV2Command({
      Bucket: R2_BUCKET,
      ContinuationToken: continuationToken,
    }))

    for (const obj of res.Contents ?? []) {
      if (obj.Key?.endsWith('.summary.txt')) {
        keys.push(obj.Key)
      }
    }

    continuationToken = res.IsTruncated ? res.NextContinuationToken : undefined
    process.stdout.write(`\r  Listed ${keys.length} summary keys so far...`)
  } while (continuationToken)

  console.log('')
  return keys
}

function parseKey(key: string): { legislationGovUkId: string; sectionNumber: string } {
  // Format: {legislationGovUkId}/sections/{N}.summary.txt
  // e.g. ukpga/2017/3/sections/107EC.summary.txt
  const match = key.match(/^(.+)\/sections\/(.+)\.summary\.txt$/)
  if (!match) throw new Error(`Cannot parse key: ${key}`)
  return { legislationGovUkId: match[1], sectionNumber: match[2] }
}

function pickRandom<T>(arr: T[], n: number): T[] {
  const shuffled = [...arr].sort(() => Math.random() - 0.5)
  return shuffled.slice(0, n)
}

async function main() {
  console.log('Listing all .summary.txt keys from R2...')
  const allKeys = await listAllSummaryKeys()
  console.log(`Total .summary.txt keys: ${allKeys.length}`)

  const picks = pickRandom(allKeys, 3)
  console.log('\nSelected keys:')
  picks.forEach((k, i) => console.log(`  ${i + 1}. ${k}`))

  const results: Array<{
    key: string
    legislationGovUkId: string
    sectionNumber: string
    xmlContent: string | null
    summaryContent: string | null
    compiledContent: string | null
    dbRow: {
      sectionTitle: string | null
      compiledBy: string | null
      lexSummaryKey: string | null
      compiledTextKey: string | null
      actTitle: string
      actYear: number
    } | null
  }> = []

  for (const key of picks) {
    const { legislationGovUkId, sectionNumber } = parseKey(key)
    console.log(`\nFetching data for ${legislationGovUkId} s.${sectionNumber}...`)

    const xmlKey = `${legislationGovUkId}/sections/${sectionNumber}.xml`
    const compiledKey = `${legislationGovUkId}/sections/${sectionNumber}.compiled.txt`

    const [xmlContent, summaryContent, compiledContent] = await Promise.all([
      r2Get(xmlKey),
      r2Get(key),
      r2Get(compiledKey),
    ])

    const section = await prisma.legislationSection.findFirst({
      where: {
        sectionNumber,
        legislationItem: { legislationGovUkId },
      },
      select: {
        sectionTitle: true,
        compiledBy: true,
        lexSummaryKey: true,
        compiledTextKey: true,
        legislationItem: { select: { title: true, year: true } },
      },
    })

    results.push({
      key,
      legislationGovUkId,
      sectionNumber,
      xmlContent,
      summaryContent,
      compiledContent,
      dbRow: section ? {
        sectionTitle: section.sectionTitle,
        compiledBy: section.compiledBy,
        lexSummaryKey: section.lexSummaryKey,
        compiledTextKey: section.compiledTextKey,
        actTitle: section.legislationItem.title,
        actYear: section.legislationItem.year,
      } : null,
    })

    console.log(`  XML: ${xmlContent ? xmlContent.length + ' chars' : 'NOT FOUND'}`)
    console.log(`  Summary: ${summaryContent ? summaryContent.length + ' chars' : 'NOT FOUND'}`)
    console.log(`  Compiled: ${compiledContent ? compiledContent.length + ' chars' : 'NOT FOUND'}`)
    console.log(`  DB: ${section ? `${section.legislationItem.title} ${section.legislationItem.year}, compiledBy=${section.compiledBy}` : 'NOT FOUND'}`)
  }

  console.log('\n\n=== FINAL RESULTS ===\n')
  console.log(JSON.stringify(results, null, 2))
}

main().catch(console.error).finally(() => prisma.$disconnect())
