import { PrismaClient } from '@prisma/client'
import { Pool } from 'pg'
import path from 'path'

try {
  require('dotenv').config({ path: path.join(__dirname, '../../../scrutinise-web/.env') })
} catch { /* dotenv optional */ }

// Railway Prisma client — used for analytics queries (format breakdown, unrecognised formats)
let _prisma: PrismaClient | null = null

function getPrisma(): PrismaClient {
  if (!_prisma) {
    _prisma = new PrismaClient()
  }
  return _prisma
}

// Neon pool — used for corpus_sections writes (upsertSection).
// Queue operations stay on Railway via queue-client.ts.
let _neonPool: Pool | null = null

function getNeonPool(): Pool {
  if (!_neonPool) {
    const url = process.env.NEON_DATABASE_URL
    if (!url) throw new Error('NEON_DATABASE_URL not set')
    _neonPool = new Pool({ connectionString: url, ssl: { rejectUnauthorized: false } })
  }
  return _neonPool
}

export async function disconnectDb(): Promise<void> {
  await _prisma?.$disconnect()
  _prisma = null
  await _neonPool?.end()
  _neonPool = null
}

export interface SectionMeta {
  id: string
  corpus: string
  sourceUrl?: string
  r2Key?: string
  r2RawKey?: string
  wordCount?: number
  status: 'pending' | 'compiled' | 'failed' | 'skipped' | 'unavailable'
  errorMsg?: string
  format?: 'clml' | 'clml-unparsed' | 'html' | 'pdf' | 'unavailable' | 'effects'
  xmlPreview?: string
  notes?: string
  availabilityStatus?: 'full' | 'commencement' | 'revoked' | 'pdf-only' | 'metadata-only' | 'no-provisions'
  availabilityNote?: string
}

type CorpusSectionClient = {
  corpusSection: {
    upsert: (args: {
      where: { id: string }
      create: Record<string, unknown>
      update: Record<string, unknown>
    }) => Promise<void>
    findMany: (args: Record<string, unknown>) => Promise<Array<Record<string, unknown>>>
  }
}

export async function upsertSection(meta: SectionMeta): Promise<void> {
  const pool = getNeonPool()
  const now = new Date()
  await pool.query(`
    INSERT INTO corpus_sections
      (id, corpus, "sourceUrl", "r2Key", "r2RawKey", "wordCount", status, "errorMsg",
       format, "xmlPreview", notes, availability_status, availability_note, "compiledAt", "createdAt")
    VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,NOW())
    ON CONFLICT (id) DO UPDATE SET
      "r2Key"             = EXCLUDED."r2Key",
      "r2RawKey"          = EXCLUDED."r2RawKey",
      "wordCount"         = EXCLUDED."wordCount",
      status              = EXCLUDED.status,
      "errorMsg"          = EXCLUDED."errorMsg",
      format              = EXCLUDED.format,
      "xmlPreview"        = EXCLUDED."xmlPreview",
      notes               = EXCLUDED.notes,
      availability_status = EXCLUDED.availability_status,
      availability_note   = EXCLUDED.availability_note,
      "compiledAt"        = CASE WHEN EXCLUDED.status = 'compiled' THEN $14 ELSE corpus_sections."compiledAt" END
  `, [
    meta.id,
    meta.corpus,
    meta.sourceUrl ?? null,
    meta.r2Key ?? null,
    meta.r2RawKey ?? null,
    meta.wordCount ?? null,
    meta.status,
    meta.errorMsg ?? null,
    meta.format ?? null,
    meta.xmlPreview ?? null,
    meta.notes ?? null,
    meta.availabilityStatus ?? 'full',
    meta.availabilityNote ?? null,
    meta.status === 'compiled' ? now : null,
  ])
}

export interface FormatCount {
  format: string | null
  count: number
}

export async function queryFormatBreakdown(): Promise<FormatCount[]> {
  const db = getPrisma()
  const rows = await db.$queryRaw<Array<{ format: string | null; count: number }>>`
    SELECT format, COUNT(*)::int AS count
    FROM corpus_sections
    GROUP BY format
    ORDER BY count DESC
  `
  return rows
}

export interface UnrecognisedFormatRow {
  sourceUrl: string | null
  xmlPreview: string | null
}

export async function queryUnrecognisedFormats(sinceHours = 4): Promise<UnrecognisedFormatRow[]> {
  const db = getPrisma() as unknown as CorpusSectionClient
  const since = new Date(Date.now() - sinceHours * 3_600_000)
  const rows = await db.corpusSection.findMany({
    where: {
      format: 'clml-unparsed',
      createdAt: { gte: since },
    } as Record<string, unknown>,
    select: { sourceUrl: true, xmlPreview: true },
  })
  return (rows as unknown) as UnrecognisedFormatRow[]
}

export function sectionId(corpus: string, docId: string, sectionRef: string): string {
  return `${corpus}:${docId}:${sectionRef}`
}

export function countWords(text: string): number {
  return text.split(/\s+/).filter(Boolean).length
}
