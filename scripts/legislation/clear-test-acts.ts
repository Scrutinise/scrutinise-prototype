import * as path from 'path'
import dotenv from 'dotenv'
dotenv.config({ path: path.join(__dirname, '../../scrutinise-web/.env') })

import { prisma } from '../../scrutinise-web/lib/prisma'
import { r2 } from './r2-client'
import { ListObjectsV2Command, DeleteObjectsCommand } from '@aws-sdk/client-s3'

const R2_BUCKET = process.env.CLOUDFLARE_R2_BUCKET_NAME ?? 'scrutinise-legislation'
const TEST_ACT_IDS = ['ukpga/2010/15', 'ukpga/1968/60', 'ukpga/2007/3', 'ukpga/2024/3', 'ukpga/2006/46']

async function main() {
  for (const actId of TEST_ACT_IDS) {
    // Delete DB rows
    const item = await prisma.legislationItem.findFirst({ where: { legislationGovUkId: actId } })
    if (item) {
      const { count } = await prisma.legislationSection.deleteMany({ where: { legislationItemId: item.id } })
      await prisma.legislationItem.update({
        where: { id: item.id },
        data: { effectsKey: null, effectsFetchedAt: null, sectionCount: 0 },
      })
      console.log(`${actId}: deleted ${count} sections from DB (item preserved)`)
    } else {
      console.log(`${actId}: no item in DB`)
    }

    // Delete R2 objects for this act (but NOT .summary.txt)
    let token: string | undefined
    const toDelete: string[] = []
    do {
      const res = await r2.send(new ListObjectsV2Command({
        Bucket: R2_BUCKET, Prefix: actId + '/', MaxKeys: 1000, ContinuationToken: token,
      }))
      for (const obj of res.Contents ?? []) {
        if (obj.Key && !obj.Key.endsWith('.summary.txt')) toDelete.push(obj.Key)
      }
      token = res.IsTruncated ? res.NextContinuationToken : undefined
    } while (token)

    if (toDelete.length > 0) {
      await r2.send(new DeleteObjectsCommand({
        Bucket: R2_BUCKET,
        Delete: { Objects: toDelete.map(Key => ({ Key })), Quiet: true },
      }))
      console.log(`${actId}: deleted ${toDelete.length} R2 objects`)
    } else {
      console.log(`${actId}: no R2 objects to delete`)
    }
  }
  console.log('Clear complete.')
}

main().catch(console.error).finally(() => prisma.$disconnect())
