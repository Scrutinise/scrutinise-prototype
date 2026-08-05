import {
  S3Client, GetObjectCommand, HeadObjectCommand, PutObjectCommand, DeleteObjectCommand,
} from '@aws-sdk/client-s3'
import { getSignedUrl } from '@aws-sdk/s3-request-presigner'

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

export async function r2Get(key: string): Promise<string | null> {
  try {
    const res = await r2.send(new GetObjectCommand({ Bucket: R2_BUCKET, Key: key }))
    return await res.Body?.transformToString() ?? null
  } catch {
    return null
  }
}

/**
 * Write an object. Used by the §8.2 export path; the bucket stays private and
 * the object is reached only through a signed URL (security rule 10).
 */
export async function r2Put(key: string, body: Buffer, contentType: string): Promise<void> {
  await r2.send(new PutObjectCommand({
    Bucket: R2_BUCKET,
    Key: key,
    Body: body,
    ContentType: contentType,
  }))
}

/**
 * A time-limited URL for a private object. 24h is the platform maximum
 * (security rule 10) and is never persisted — a stored URL would be a stored
 * expiry, so the DB holds the KEY and a fresh URL is minted per download.
 */
export async function r2SignedUrl(
  key: string,
  opts: { expiresIn?: number; downloadAs?: string } = {},
): Promise<string> {
  const expiresIn = Math.min(opts.expiresIn ?? 60 * 60 * 24, 60 * 60 * 24)
  return getSignedUrl(
    r2,
    new GetObjectCommand({
      Bucket: R2_BUCKET,
      Key: key,
      ...(opts.downloadAs
        ? { ResponseContentDisposition: `attachment; filename="${opts.downloadAs.replace(/"/g, '')}"` }
        : {}),
    }),
    { expiresIn },
  )
}

/** Remove an object. Used to clean up after end-to-end export checks. */
export async function r2Delete(key: string): Promise<void> {
  await r2.send(new DeleteObjectCommand({ Bucket: R2_BUCKET, Key: key }))
}

export async function r2Exists(key: string): Promise<boolean> {
  try {
    await r2.send(new HeadObjectCommand({ Bucket: R2_BUCKET, Key: key }))
    return true
  } catch {
    return false
  }
}

// V2.75-H2 key scheme
export function originalXmlKey(id: string, sectionNum: string): string {
  return `${id}/sections/${sectionNum}.original.xml`
}

export function tnaXmlKey(id: string, sectionNum: string): string {
  return `${id}/sections/${sectionNum}.tna.xml`
}

export function effectsKey(id: string): string {
  return `${id}/effects.xml`
}

export function compiledKey(id: string, sectionNum: string): string {
  return `${id}/sections/${sectionNum}.compiled.txt`
}

export function summaryKey(id: string, sectionNum: string): string {
  return `${id}/sections/${sectionNum}.summary.txt`
}
