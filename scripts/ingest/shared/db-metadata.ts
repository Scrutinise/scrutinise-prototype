/**
 * db-metadata.ts — corpus_sections writes (Neon).
 *
 * V17: Prisma/Railway-DB usage removed entirely. queryFormatBreakdown() and
 * queryUnrecognisedFormats() queried a Railway table empty since V16 and were
 * the documented cause of scheduler hangs when Railway DB was down. Everything
 * here now runs on the single shared Neon pool (shared/neon-pool.ts).
 */
import { getNeonPool, endNeonPool } from './neon-pool'
import { licenceForCorpus } from './licence-map'
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
  // V18 per-item metadata (pwdata granularity migration): heading, speaker,
  // sitting date, and the parent day-file — so search can aggregate
  // speech → debate → day, and day-blob supersession is traceable.
  sectionTitle?: string
  speaker?: string
  itemDate?: string   // YYYY-MM-DD
  parentDocId?: string
  // V20 licence metadata. licence defaults from shared/licence-map.ts by corpus;
  // attribution is written ONLY when row-specific wording is required (e.g.
  // sentencing-council source-document title, OECD CC-BY per-document credit) —
  // uniform boilerplate lives in the map / INGEST_PLAYBOOK §18, not per row.
  licence?: string
  attribution?: string
}

const SECTION_COLS = `(id, corpus, "sourceUrl", "r2Key", "r2RawKey", "wordCount", status, "errorMsg",
       format, "xmlPreview", notes, availability_status, availability_note,
       "sectionTitle", speaker, "itemDate", "parentDocId", licence, attribution, "compiledAt", "createdAt")`

const SECTION_CONFLICT = `
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
      "sectionTitle"      = EXCLUDED."sectionTitle",
      speaker             = EXCLUDED.speaker,
      "itemDate"          = EXCLUDED."itemDate",
      "parentDocId"       = EXCLUDED."parentDocId",
      licence             = EXCLUDED.licence,
      attribution         = EXCLUDED.attribution,
      "compiledAt"        = CASE WHEN EXCLUDED.status = 'compiled' THEN EXCLUDED."compiledAt" ELSE corpus_sections."compiledAt" END`

function sectionParams(meta: SectionMeta, now: Date): unknown[] {
  return [
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
    meta.sectionTitle ?? null,
    meta.speaker ?? null,
    meta.itemDate ?? null,
    meta.parentDocId ?? null,
    meta.licence ?? licenceForCorpus(meta.corpus),
    meta.attribution ?? null,
    meta.status === 'compiled' ? now : null,
  ]
}

const PARAMS_PER_ROW = 20

export async function upsertSection(meta: SectionMeta): Promise<void> {
  const pool = getNeonPool()
  const placeholders = Array.from({ length: PARAMS_PER_ROW }, (_, i) => `$${i + 1}`).join(',')
  await pool.query(
    `INSERT INTO corpus_sections ${SECTION_COLS} VALUES (${placeholders},NOW()) ${SECTION_CONFLICT}`,
    sectionParams(meta, new Date())
  )
}

// Multi-row upsert for per-item processors (V18) — one round trip per chunk
// instead of one per section. Returns rows written.
export async function bulkUpsertSections(metas: SectionMeta[], chunkSize = 200): Promise<number> {
  if (metas.length === 0) return 0
  const pool = getNeonPool()
  const now = new Date()
  let written = 0
  for (let i = 0; i < metas.length; i += chunkSize) {
    const chunk = metas.slice(i, i + chunkSize)
    const values: string[] = []
    const params: unknown[] = []
    for (let r = 0; r < chunk.length; r++) {
      const base = r * PARAMS_PER_ROW
      const ph = Array.from({ length: PARAMS_PER_ROW }, (_, c) => `$${base + c + 1}`).join(',')
      values.push(`(${ph},NOW())`)
      params.push(...sectionParams(chunk[r], now))
    }
    await pool.query(
      `INSERT INTO corpus_sections ${SECTION_COLS} VALUES ${values.join(',')} ${SECTION_CONFLICT}`,
      params
    )
    written += chunk.length
  }
  return written
}

// Remove sections of a parent doc that a re-parse no longer produced — keeps
// re-processing consistent instead of leaving stale high-seq rows behind.
export async function deleteStaleSections(corpus: string, parentDocId: string, keepIds: string[]): Promise<number> {
  const pool = getNeonPool()
  const res = await pool.query(
    `DELETE FROM corpus_sections WHERE corpus = $1 AND "parentDocId" = $2 AND id <> ALL($3::text[])`,
    [corpus, parentDocId, keepIds]
  )
  return res.rowCount ?? 0
}

// TWFY publishes multiple scrape versions per sitting day (debates2026-03-02a..f);
// only the highest letter is current. After processing a latest version, purge
// compiled sections of earlier versions of the same day. Unavailable marker rows
// are kept — they are what stops the hourly reseed re-inserting those files.
export async function deleteSupersededVersionSections(corpus: string, dayStem: string, currentDocId: string): Promise<number> {
  const pool = getNeonPool()
  const res = await pool.query(
    `DELETE FROM corpus_sections
     WHERE corpus = $1 AND "parentDocId" >= $2 AND "parentDocId" < $3 AND status = 'compiled'`,
    [corpus, dayStem, currentDocId]
  )
  return res.rowCount ?? 0
}

export function sectionId(corpus: string, docId: string, sectionRef: string): string {
  return `${corpus}:${docId}:${sectionRef}`
}

export function countWords(text: string): number {
  return text.split(/\s+/).filter(Boolean).length
}
