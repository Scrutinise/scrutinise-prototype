/**
 * pilot-pwdata-perspeech.ts — V18 §2 pilot: run the rewritten per-speech
 * processor over one month of day-files BEFORE the full ~50k-file reseed.
 * "Predict, measure, then commit."
 *
 * Scope: 2026-03 across all 7 corpora (modern formats), plus debates 1950-03
 * and 1985-03 (historic format + ISO-8859-1 encoding drift — debates is 16k of
 * the 20k files pre-2000, so the old-era rate dominates the projection).
 *
 * Writes REAL sections to Neon/R2 via the exact production path
 * (processPwdataFile). Reports per-corpus sections/file, avg section size,
 * Neon bytes/section, and implied totals for the full archive.
 *
 * Run:
 *   NODE_PATH=scrutinise-web/node_modules scrutinise-web/node_modules/.bin/tsx \
 *     --tsconfig scripts/tsconfig.json scripts/ingest/pilot-pwdata-perspeech.ts
 */
import { getNeonPool, endNeonPool } from '../../ingest/shared/neon-pool'
import { listPwdataFiles, PWDATA_CORPUS_CONFIG } from '../../ingest/sources/twfy-pwdata'
import { processPwdataFile } from '../../ingest/workers/process-row'

const MODERN_MONTH = '2026-03'
const HISTORIC: Array<{ corpus: string; month: string }> = [
  { corpus: 'pwdata-debates', month: '1950-03' },
  { corpus: 'pwdata-debates', month: '1985-03' },
]

interface CorpusStat {
  label: string
  files: number
  sections: number
  words: number
  ms: number
}

async function dbSize(): Promise<number> {
  const r = await getNeonPool().query<{ b: string }>(
    `SELECT pg_total_relation_size('corpus_sections')::text AS b`
  )
  return parseInt(r.rows[0].b, 10)
}

async function runBatch(label: string, corpus: string, docIds: string[]): Promise<CorpusStat> {
  const stat: CorpusStat = { label, files: 0, sections: 0, words: 0, ms: 0 }
  for (const docId of docIds) {
    const t0 = Date.now()
    try {
      const written = await processPwdataFile(corpus, docId)
      stat.files++
      stat.sections += written
      stat.ms += Date.now() - t0
    } catch (err: any) {
      console.error(`  [pilot] ${corpus}/${docId} FAILED: ${err.message}`)
    }
    // polite pacing for TWFY (the pool's token bucket does this in production)
    await new Promise(r => setTimeout(r, 250))
  }
  return stat
}

async function main() {
  const pool = getNeonPool()
  const sizeBefore = await dbSize()
  const stats: CorpusStat[] = []

  for (const corpus of Object.keys(PWDATA_CORPUS_CONFIG)) {
    const files = await listPwdataFiles(corpus)
    const monthFiles = files.filter(f => f.docId.includes(MODERN_MONTH)).map(f => f.docId).sort()
    console.log(`\n[pilot] ${corpus} ${MODERN_MONTH}: ${monthFiles.length} files`)
    stats.push(await runBatch(`${corpus} ${MODERN_MONTH}`, corpus, monthFiles))
  }
  for (const h of HISTORIC) {
    const files = await listPwdataFiles(h.corpus)
    const monthFiles = files.filter(f => f.docId.includes(h.month)).map(f => f.docId).sort()
    console.log(`\n[pilot] ${h.corpus} ${h.month}: ${monthFiles.length} files`)
    stats.push(await runBatch(`${h.corpus} ${h.month}`, h.corpus, monthFiles))
  }

  const sizeAfter = await dbSize()
  const totalSections = stats.reduce((s, c) => s + c.sections, 0)
  const totalFiles = stats.reduce((s, c) => s + c.files, 0)

  // word counts for avg section size
  const ws = await pool.query<{ avg_words: string; avg_chars: string }>(`
    SELECT ROUND(AVG("wordCount"))::text AS avg_words,
           ROUND(AVG("wordCount") * 6.2)::text AS avg_chars
    FROM corpus_sections
    WHERE "parentDocId" IS NOT NULL AND status = 'compiled'
  `)

  console.log('\n================ PILOT RESULTS ================')
  console.log('batch                              files  sections  sec/file   ms/file')
  for (const s of stats) {
    const spf = s.files ? (s.sections / s.files).toFixed(1) : '-'
    const mpf = s.files ? Math.round(s.ms / s.files) : 0
    console.log(`${s.label.padEnd(34)} ${String(s.files).padStart(5)} ${String(s.sections).padStart(9)} ${String(spf).padStart(9)} ${String(mpf).padStart(9)}`)
  }
  console.log(`\nTOTAL: ${totalFiles} files → ${totalSections.toLocaleString()} sections`)
  console.log(`avg section: ~${ws.rows[0].avg_words} words (~${parseInt(ws.rows[0].avg_chars, 10).toLocaleString()} chars)`)
  const deltaBytes = sizeAfter - sizeBefore
  console.log(`corpus_sections size delta: ${(deltaBytes / 1048576).toFixed(1)} MB for ${totalSections.toLocaleString()} sections`)
  if (totalSections > 0) {
    console.log(`→ Neon bytes/section: ~${Math.round(deltaBytes / totalSections).toLocaleString()}`)
  }
  await endNeonPool()
}
main().catch(e => { console.error(e); process.exit(1) })
