import { S3Client, PutObjectCommand, GetObjectCommand, HeadObjectCommand } from '@aws-sdk/client-s3'
import dotenv from 'dotenv'
import path from 'path'
dotenv.config({ path: path.join(__dirname, '../../scrutinise-web/.env') })

const R2_ACCOUNT_ID = process.env.CLOUDFLARE_R2_ACCOUNT_ID!
const R2_BUCKET = process.env.CLOUDFLARE_R2_BUCKET_NAME ?? 'scrutinise-legislation'

export const r2 = new S3Client({
  region: 'auto',
  endpoint: `https://${R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
  credentials: {
    accessKeyId: process.env.CLOUDFLARE_R2_ACCESS_KEY_ID!,
    secretAccessKey: process.env.CLOUDFLARE_R2_SECRET_ACCESS_KEY!,
  },
})

export async function r2Put(key: string, body: string | Buffer | Uint8Array, contentType = 'text/plain'): Promise<void> {
  await r2.send(new PutObjectCommand({
    Bucket: R2_BUCKET, Key: key, Body: body, ContentType: contentType,
  }))
}

export async function r2Get(key: string): Promise<string | null> {
  try {
    const res = await r2.send(new GetObjectCommand({ Bucket: R2_BUCKET, Key: key }))
    return await res.Body?.transformToString() ?? null
  } catch {
    return null
  }
}

export async function r2Exists(key: string): Promise<boolean> {
  try {
    await r2.send(new HeadObjectCommand({ Bucket: R2_BUCKET, Key: key }))
    return true
  } catch {
    return false
  }
}

// V2.75-H2 key scheme — three files per act, two per section
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
