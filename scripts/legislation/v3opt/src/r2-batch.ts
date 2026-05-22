import { S3Client, PutObjectCommand, GetObjectCommand } from './runtime-deps'
import dotenv from 'dotenv'
import path from 'path'
dotenv.config({ path: path.resolve(__dirname, '../../../../scrutinise-web/.env') })

export const R2_BUCKET = process.env.CLOUDFLARE_R2_BUCKET_NAME ?? 'scrutinise-legislation'

export const r2 = new S3Client({
  region: 'auto',
  endpoint: `https://${process.env.CLOUDFLARE_R2_ACCOUNT_ID!}.r2.cloudflarestorage.com`,
  credentials: {
    accessKeyId: process.env.CLOUDFLARE_R2_ACCESS_KEY_ID!,
    secretAccessKey: process.env.CLOUDFLARE_R2_SECRET_ACCESS_KEY!,
  },
})

export interface R2PutItem {
  key: string
  content: string
  contentType: string
}

export interface R2PutResult {
  succeeded: R2PutItem[]
  failed: { item: R2PutItem; error: string }[]
}

export async function batchR2Put(items: R2PutItem[]): Promise<R2PutResult> {
  const results = await Promise.allSettled(
    items.map(item =>
      r2.send(new PutObjectCommand({
        Bucket: R2_BUCKET,
        Key: item.key,
        Body: Buffer.from(item.content, 'utf8'),
        ContentType: item.contentType,
      }))
    )
  )

  const succeeded: R2PutItem[] = []
  const failed: { item: R2PutItem; error: string }[] = []

  results.forEach((result, i) => {
    if (result.status === 'fulfilled') {
      succeeded.push(items[i])
    } else {
      failed.push({ item: items[i], error: result.reason?.message ?? String(result.reason) })
    }
  })

  return { succeeded, failed }
}

export async function r2KeyExists(key: string): Promise<boolean> {
  try {
    const res = await r2.send(new GetObjectCommand({ Bucket: R2_BUCKET, Key: key }))
    const body = await res.Body?.transformToString('utf8')
    return !!body && body.length > 0
  } catch {
    return false
  }
}
