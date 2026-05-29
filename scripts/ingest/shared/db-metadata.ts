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
  id: string          // "{corpus}:{docId}:{sectionRef}"
  corpus: string
  sourceUrl?: string
  r2Key?: string
  r2RawKey?: string
  wordCount?: number
  status: 'pending' | 'compiled' | 'failed' | 'skipped'
  errorMsg?: string
}

export async function upsertSection(meta: SectionMeta): Promise<void> {
  const db = getPrisma()
  await (db as unknown as {
    corpusSection: {
      upsert: (args: {
        where: { id: string }
        create: Record<string, unknown>
        update: Record<string, unknown>
      }) => Promise<void>
    }
  }).corpusSection.upsert({
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
    },
    update: {
      r2Key: meta.r2Key ?? null,
      r2RawKey: meta.r2RawKey ?? null,
      wordCount: meta.wordCount ?? null,
      status: meta.status,
      errorMsg: meta.errorMsg ?? null,
      ...(meta.status === 'compiled' ? { compiledAt: new Date() } : {}),
    },
  })
}

export function sectionId(corpus: string, docId: string, sectionRef: string): string {
  return `${corpus}:${docId}:${sectionRef}`
}

export function countWords(text: string): number {
  return text.split(/\s+/).filter(Boolean).length
}
