/**
 * v32-backfill-eta.ts — read-only: finer-grained throughput and composition of the remaining tail,
 * so the ETA is based on the rate for the work that is actually LEFT rather than the average so far.
 */
import fs from 'fs'
import path from 'path'
import { getNeonPool, endNeonPool } from './shared/neon-pool'
import { isArchivableHost } from './sources/committees-archive'
import type { ManifestItem } from './v32-enumerate-committees'

async function main() {
  const manifest = JSON.parse(fs.readFileSync(path.join(__dirname, 'v32-committees-manifest.json'), 'utf8')) as { items: ManifestItem[] }
  const targets = manifest.items.filter(i => !i.downloadable && (i.archiveUrl || i.archiveUrlHtml))
  const p = getNeonPool()

  const { rows: done } = await p.query<{ parentDocId: string }>(
    `SELECT DISTINCT "parentDocId" FROM corpus_sections
     WHERE corpus='committees-reports'
       AND ((status='compiled' AND id LIKE '%:arc-%') OR availability_status='archive-miss')`)
  const doneSet = new Set(done.map(r => r.parentDocId))
  const left = targets.filter(i => !doneSet.has(`publication:${i.publicationId}`))

  // Which of the remaining cost a real Wayback fetch, and which are settled for free?
  let free = 0, fetchable = 0
  for (const i of left) {
    const url = i.archiveUrl || i.archiveUrlHtml
    if (!url || !isArchivableHost(url)) free++; else fetchable++
  }
  console.log(`\n  REMAINING ${left.length.toLocaleString()}`)
  console.log(`    need a real archive fetch      ${fetchable.toLocaleString()}`)
  console.log(`    settled for free (host never crawled / no URL)  ${free.toLocaleString()}`)

  // Same split across what has ALREADY been done, for a like-for-like rate comparison
  const doneTargets = targets.filter(i => doneSet.has(`publication:${i.publicationId}`))
  let dFree = 0
  for (const i of doneTargets) { const u = i.archiveUrl || i.archiveUrlHtml; if (!u || !isArchivableHost(u)) dFree++ }
  console.log(`  done so far ${doneTargets.length.toLocaleString()} — of which free ${dFree.toLocaleString()} (${((dFree / doneTargets.length) * 100).toFixed(1)}%)`)

  // 15-minute throughput for the last 4 hours, split fetched vs miss
  const { rows: fine } = await p.query<{ b: string; pubs: string; fetched: string }>(
    `SELECT to_char(date_trunc('hour',"createdAt") + interval '15 min' * floor(extract(minute from "createdAt")/15), 'MM-DD HH24:MI') AS b,
            COUNT(DISTINCT "parentDocId")::text AS pubs,
            COUNT(DISTINCT "parentDocId") FILTER (WHERE status='compiled')::text AS fetched
     FROM corpus_sections
     WHERE corpus='committees-reports'
       AND ((status='compiled' AND id LIKE '%:arc-%') OR availability_status='archive-miss')
       AND "createdAt" > now() - interval '5 hours'
     GROUP BY 1 ORDER BY 1`)
  console.log(`\n  15-min buckets (UTC) — pubs settled / of which fetched:`)
  for (const r of fine) console.log(`    ${r.b}   ${String(Number(r.pubs)).padStart(4)}  (${r.fetched} fetched)`)

  await endNeonPool()
}
main().catch(e => { console.error('FATAL', e); process.exit(1) })
