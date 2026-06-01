import { PrismaClient } from '@prisma/client'
import path from 'path'

try {
  require('dotenv').config({ path: path.join(__dirname, '../../../scrutinise-web/.env') })
} catch { /* dotenv optional */ }

let _prisma: PrismaClient | null = null

function getPrisma(): PrismaClient {
  if (!_prisma) {
    _prisma = new PrismaClient({ datasources: { db: { url: process.env.DATABASE_URL } } })
  }
  return _prisma
}

export async function disconnectDb(): Promise<void> {
  await _prisma?.$disconnect()
  _prisma = null
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
  format?: 'clml' | 'clml-unparsed' | 'html' | 'pdf' | 'unavailable'
  xmlPreview?: string
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
  const db = getPrisma() as unknown as CorpusSectionClient
  await db.corpusSection.upsert({
    where: { id: meta.id },
    create: {
      id: meta.id,
      corpus: meta.corpus,
      sourceUrl: meta.sourceUrl ?? null,
      r2Key: meta.r2Key ?? null,
      r2RawKey: meta.r2RawKey ?? null,
      wordCount: meta.wordCount ?? null,
      status: meta.status,
      errorMsg: meta.errorMsg ?? null,
      format: meta.format ?? null,
      xmlPreview: meta.xmlPreview ?? null,
    },
    update: {
      r2Key: meta.r2Key ?? null,
      r2RawKey: meta.r2RawKey ?? null,
      wordCount: meta.wordCount ?? null,
      status: meta.status,
      errorMsg: meta.errorMsg ?? null,
      format: meta.format ?? null,
      xmlPreview: meta.xmlPreview ?? null,
      ...(meta.status === 'compiled' ? { compiledAt: new Date() } : {}),
    },
  })
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
  return rows as UnrecognisedFormatRow[]
}

export function sectionId(corpus: string, docId: string, sectionRef: string): string {
  return `${corpus}:${docId}:${sectionRef}`
}

export function countWords(text: string): number {
  return text.split(/\s+/).filter(Boolean).length
}
