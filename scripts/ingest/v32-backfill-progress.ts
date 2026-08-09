/**
 * v32-backfill-progress.ts — read-only: how far has the §2 Wayback backfill got, and how fast.
 * Mirrors the resume filter in v32-backfill-archive.ts exactly, so "remaining" is the same
 * number the next batch would compute for itself.
 */
import fs from 'fs'
import path from 'path'
import { getNeonPool, endNeonPool } from './shared/neon-pool'
import type { ManifestItem } from './v32-enumerate-committees'

async function main() {
  const MANIFEST = path.join(__dirname, 'v32-committees-manifest.json')
  const manifest = JSON.parse(fs.readFileSync(MANIFEST, 'utf8')) as { items: ManifestItem[]; partial: unknown[] }
  const targets = manifest.items.filter(i => !i.downloadable && (i.archiveUrl || i.archiveUrlHtml))

  const p = getNeonPool()

  // EXACTLY the resume filter (no --retry-misses)
  const { rows: done } = await p.query<{ parentDocId: string }>(
    `SELECT DISTINCT "parentDocId" FROM corpus_sections
     WHERE corpus='committees-reports'
       AND ( (status='compiled' AND id LIKE '%:arc-%')
          OR availability_status='archive-miss' )`)
  const doneSet = new Set(done.map(r => r.parentDocId))
  const remaining = targets.filter(i => !doneSet.has(`publication:${i.publicationId}`)).length

  console.log(`\n═══ V32 §2 BACKFILL PROGRESS ══════════════════════════════════════`)
  console.log(`  manifest targets (archive-only)   ${targets.length.toLocaleString()}`)
  console.log(`  settled (fetched or missed)       ${(targets.length - remaining).toLocaleString()}`)
  console.log(`  REMAINING                         ${remaining.toLocaleString()}`)

  // outcome split
  const { rows: split } = await p.query<{ kind: string; n: string }>(
    `SELECT kind, COUNT(DISTINCT "parentDocId")::text AS n FROM (
       SELECT "parentDocId",
         CASE WHEN status='compiled' AND id LIKE '%:arc-%' THEN 'fetched'
              WHEN availability_note LIKE '[retryable]%' THEN 'miss-retryable'
              ELSE 'miss-settled' END AS kind
       FROM corpus_sections
       WHERE corpus='committees-reports'
         AND ((status='compiled' AND id LIKE '%:arc-%') OR availability_status='archive-miss')
     ) t GROUP BY kind ORDER BY kind`)
  console.log(`\n  outcome split (distinct publications):`)
  for (const r of split) console.log(`    ${r.kind.padEnd(16)} ${Number(r.n).toLocaleString()}`)

  // sections landed
  const { rows: sec } = await p.query<{ n: string; words: string }>(
    `SELECT COUNT(*)::text AS n, COALESCE(SUM("wordCount"),0)::text AS words
     FROM corpus_sections WHERE corpus='committees-reports' AND status='compiled' AND id LIKE '%:arc-%'`)
  console.log(`\n  arc- sections landed              ${Number(sec[0].n).toLocaleString()}  (${Number(sec[0].words).toLocaleString()} words)`)

  // throughput: distinct publications first settled, per hour
  const { rows: hourly } = await p.query<{ hr: string; pubs: string; secs: string }>(
    `SELECT to_char(date_trunc('hour', "createdAt"), 'YYYY-MM-DD HH24:MI') AS hr,
            COUNT(DISTINCT "parentDocId")::text AS pubs,
            COUNT(*) FILTER (WHERE status='compiled')::text AS secs
     FROM corpus_sections
     WHERE corpus='committees-reports'
       AND ((status='compiled' AND id LIKE '%:arc-%') OR availability_status='archive-miss')
       AND "createdAt" > now() - interval '26 hours'
     GROUP BY 1 ORDER BY 1`)
  console.log(`\n  publications settled per hour (UTC, last 26h):`)
  for (const r of hourly) console.log(`    ${r.hr}   ${String(Number(r.pubs)).padStart(5)} pubs   ${String(Number(r.secs)).padStart(6)} sections`)

  // most recent write — is it actually still moving?
  const { rows: last } = await p.query<{ t: string }>(
    `SELECT to_char(MAX("createdAt"), 'YYYY-MM-DD HH24:MI:SS') AS t FROM corpus_sections
     WHERE corpus='committees-reports'
       AND ((status='compiled' AND id LIKE '%:arc-%') OR availability_status='archive-miss')`)
  console.log(`\n  most recent write (UTC)           ${last[0].t}`)
  console.log(`  now (UTC)                         ${new Date().toISOString().slice(0, 19).replace('T', ' ')}`)

  await endNeonPool()
}
main().catch(e => { console.error('FATAL', e); process.exit(1) })
