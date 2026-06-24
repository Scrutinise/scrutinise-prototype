/**
 * v30-seed-scottish-or-pre2016.ts — V30 §4. Pre-2016 Scottish Parliament Official
 * Report (sessions 1–4, 1999–2016) from the Wayback archive of the legacy
 * report.aspx site. Same corpus + sourceType as the modern build
 * (scottish-parliament-or); docId = "arch:{r}|{waybackId_Url}". Licence SPCB.
 *
 *   --pilot     enumerate; fetch + parse 2 reports end-to-end (turns, words,
 *               date); predict. Seeds nothing.
 *   --measure   enumerate + parse a 10-report sample for avg turns/report. Predict.
 *   --seed      ⚠️ POST-PUSH only. One row per distinct pre-2016 r id; EXTEND the
 *               scottish-parliament-or target (do not shrink the modern est).
 */
import { getNeonPool, endNeonPool } from './shared/neon-pool'
import { bulkInsertQueueRows } from './shared/queue-client'
import { countWords } from './shared/db-metadata'
import { enumerateLegacyReports, fetchBestLegacyReport } from './sources/scottish-or-archive'

const CORPUS = 'scottish-parliament-or'

async function main() {
  const mode = process.argv.includes('--seed') ? 'seed' : process.argv.includes('--measure') ? 'measure' : 'pilot'
  const reports = await enumerateLegacyReports((host, n) => console.log(`  …${host}: ${n} distinct pre-2016 r ids`))
  console.log(`enumerated ${reports.length} distinct pre-2016 OR reports (sessions 1–4)`)
  if (reports.length === 0) { console.log('NO reports enumerated — CDX route failed'); await endNeonPool(); return }
  console.log(`  r range: ${reports[0].r}…${reports[reports.length - 1].r}`)

  if (mode !== 'seed') {
    const sampleN = mode === 'measure' ? 10 : 2
    const step = Math.max(1, Math.floor(reports.length / sampleN))
    const sample = reports.filter((_, i) => i % step === 0).slice(0, sampleN)
    let turns = 0, words = 0, ok = 0, empty = 0
    for (const rep of sample) {
      const p = await fetchBestLegacyReport(rep.r)
      if (!p) { console.log(`  ✗ r=${rep.r} — no usable capture`); continue }
      const w = p.items.reduce((s, it) => s + countWords(it.text), 0)
      ok++; turns += p.items.length; words += w
      if (p.items.length === 0) empty++
      console.log(`  ✓ r=${rep.r} | ${p.date ?? '?'} | ${p.items.length} turns | ${w} words` +
        (p.items[1] ? ` | e.g. "${(p.items[1].speaker ?? '—')}" → ${p.items[1].text.slice(0, 60).replace(/\s+/g, ' ')}…` : ''))
      await new Promise(r => setTimeout(r, 500))
    }
    const withContent = ok - empty
    const avgTurns = withContent ? Math.round(turns / withContent) : 0
    const avgWords = withContent ? Math.round(words / withContent) : 0
    console.log(`\nsample ${ok}/${sample.length}: ${withContent} with contributions, ${empty} empty (non-debate/poorly-archived → markers); avg ${avgTurns} turns, ${avgWords} words per content report`)
    const contentReports = Math.round(reports.length * (withContent / Math.max(ok, 1)))
    console.log(`PREDICTION: ~${contentReports} content reports × ~${avgTurns} turns ≈ ${(contentReports * avgTurns / 1000).toFixed(0)}k sections / ~${(contentReports * avgWords / 1e6).toFixed(1)}M words (+ ~${reports.length - contentReports} marker rows)`)
    await endNeonPool(); return
  }

  // ── seed (POST-PUSH) ─────────────────────────────────────────────────────────
  const rows = reports.map(rep => ({
    id: `${CORPUS}:arch:${rep.r}`, corpus: CORPUS, docId: `arch:${rep.r}`,
    sourceType: CORPUS, priority: 3,
  }))
  const { affected } = await bulkInsertQueueRows(rows)
  const pool = getNeonPool()
  // EXTEND coverage: bump est by the new pre-2016 reports' expected sections,
  // keeping est_is_confirmed=false (re-baseline at drain per §1c). Modern est is
  // a 320k placeholder; do not overwrite with a smaller number.
  await pool.query(`
    UPDATE corpus_targets
    SET notes = 'V28 sessions 5–6 (sitemap) + V30 §4 sessions 1–4 (Wayback archive of legacy report.aspx); SPCB. 1999→present.',
        est_is_confirmed = false, updated_at = NOW()
    WHERE corpus_key = $1
  `, [CORPUS])
  console.log(`\n[scottish-or pre-2016] seeded ${affected}/${rows.length} legacy report rows into ${CORPUS}`)
  await endNeonPool()
}
main().catch(e => { console.error('FATAL', e); process.exit(1) })
