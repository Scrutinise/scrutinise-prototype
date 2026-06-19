/**
 * v28-seed-scottish-parliament-or.ts — V28 §7. Scottish Parliament Official
 * Report (HTML scrape; supersedes the V27 §5 gated stub — no capture needed).
 *
 *   --pilot     parse ONE report end-to-end (base + all agenda-item iob pages);
 *               report contributions + words. Predict the corpus. Seeds nothing.
 *   --measure   enumerate the full report universe via the date-indexed browse;
 *               report the count + date span. Seeds nothing.
 *   --measure --pages N   bounded enumeration (first N browse pages) for a quick
 *               rate estimate without walking the whole archive.
 *   --seed      enumerate all reports, bulk-insert one content row per report
 *               ("{meetingId}|{slug}"), upsert the corpus_target.
 *
 * New sourceType 'scottish-parliament-or' + corpus 'scottish-parliament-or' —
 * seed POST-PUSH (processor must deploy first). Idempotent.
 */
import { getNeonPool, endNeonPool } from './shared/neon-pool'
import { bulkInsertQueueRows } from './shared/queue-client'
import {
  enumerateReportsFromSitemap, listReportPage, fetchReport, type ReportEntry,
} from './sources/scottish-parliament-or'

const CORPUS = 'scottish-parliament-or'
const SOURCE = 'scottish-parliament-or'

async function pilot() {
  const p1 = await listReportPage(1)
  if (!p1 || p1.length === 0) { console.log('browse page 1 empty'); return }
  const entry = p1.find(e => e.slug.startsWith('meeting-of-parliament')) ?? p1[0]
  console.log(`pilot report: ${entry.slug} (meeting=${entry.meetingId}, ${entry.date})`)
  const rep = await fetchReport(entry)
  if (!rep) { console.log('fetch failed'); return }
  const words = rep.items.reduce((s, i) => s + i.text.split(/\s+/).filter(Boolean).length, 0)
  const heads = [...new Set(rep.items.map(i => i.heading))]
  console.log(`"${rep.title}" — ${rep.items.length} contributions / ${words} words / ${heads.length} agenda items`)
  console.log(`avg ${Math.round(words / Math.max(rep.items.length, 1))} words/contribution`)
}

async function measure() {
  const capIdx = process.argv.indexOf('--pages')
  const cap = capIdx >= 0 ? Number(process.argv[capIdx + 1]) : 0
  if (cap > 0) {
    const all = new Map<number, ReportEntry>()
    for (let page = 1; page <= cap; page++) {
      const e = await listReportPage(page)
      if (!e || e.length === 0) break
      for (const r of e) all.set(r.meetingId, r)
      await new Promise(r => setTimeout(r, 350))
    }
    const list = [...all.values()]
    const dates = list.map(r => r.date).filter(Boolean).sort() as string[]
    console.log(`first ${cap} browse pages: ${list.length} reports; date span ${dates[0]} … ${dates[dates.length - 1]}`)
    return
  }
  const all = await enumerateReportsFromSitemap()
  const dates = all.map(r => r.date).filter(Boolean).sort() as string[]
  console.log(`FULL universe (sitemap): ${all.length} reports; date span ${dates[0]} … ${dates[dates.length - 1]}`)
  console.log('(pre-2016 sessions 1–4 live on the legacy archive host — follow-up)')
}

async function seed() {
  const all = await enumerateReportsFromSitemap()
  console.log(`enumerated ${all.length} reports (sitemap)`)
  const rows = all.map(e => ({
    id: `${CORPUS}:${e.meetingId}`,
    corpus: CORPUS,
    docId: `${e.meetingId}|${e.slug}`,
    sourceType: SOURCE,
    priority: 4,
  }))
  const { affected } = await bulkInsertQueueRows(rows)
  console.log(`bulkInsertQueueRows: ${affected} new rows`)
  const pool = getNeonPool()
  await pool.query(`
    INSERT INTO corpus_targets (corpus_key, display_label, est_sections, est_is_confirmed, blocked, blocked_reason, notes, updated_at)
    VALUES ($1, 'Scottish Parliament Official Report', $2, false, false, NULL,
            'V28 §7: per-contribution OR scrape (Scottish Parliament Copyright Licence). One row per sitting report; worker aggregates base + iob pages.', NOW())
    ON CONFLICT (corpus_key) DO UPDATE SET
      display_label = EXCLUDED.display_label, est_sections = EXCLUDED.est_sections,
      blocked = false, blocked_reason = NULL, notes = EXCLUDED.notes, updated_at = NOW()
  `, [CORPUS, all.length])
  console.log(`corpus_target '${CORPUS}' set (est rows=${all.length})`)
}

async function main() {
  const mode = process.argv.find(a => ['--pilot', '--measure', '--seed'].includes(a)) ?? '--pilot'
  if (mode === '--pilot') await pilot()
  else if (mode === '--measure') await measure()
  else await seed()
  await endNeonPool()
}
main().catch(e => { console.error('FATAL', e); process.exit(1) })
