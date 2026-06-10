/**
 * db-metadata.ts — corpus_sections writes (Neon).
 *
 * V17: Prisma/Railway-DB usage removed entirely. queryFormatBreakdown() and
 * queryUnrecognisedFormats() queried a Railway table empty since V16 and were
 * the documented cause of scheduler hangs when Railway DB was down. Everything
 * here now runs on the single shared Neon pool (shared/neon-pool.ts).
 */
import { getNeonPool, endNeonPool } from './neon-pool'
import path from 'path'

try {
  require('dotenv').config({ path: path.join(__dirname, '../../../scrutinise-web/.env') })
} catch { /* dotenv optional */ }

export async function disconnectDb(): Promise<void> {
  await endNeonPool()
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

export function sectionId(corpus: string, docId: string, sectionRef: string): string {
  return `${corpus}:${docId}:${sectionRef}`
}

export function countWords(text: string): number {
  return text.split(/\s+/).filter(Boolean).length
}
