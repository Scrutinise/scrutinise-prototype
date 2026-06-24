/**
 * v30-seed-inquiry-evidence.ts — V30 §3. Public-inquiry EVIDENCE, governed by §0
 * (SENSITIVE_EVIDENCE_POLICY.md). New sourceType + corpus 'inquiry-evidence',
 * parent-linked to the inquiry. Per-document rows (docId "{key}#{slug}"); the §0
 * structural exclusion is enforced at the worker (excluded → marker, never text).
 *
 * Pilot inquiry: Post Office Horizon IT Inquiry (OGL v3.0 verified; lower
 * sensitivity). Infected Blood + Grenfell are probed + sequenced in the V30
 * report, not seeded here.
 *
 *   --measure   total universe (pager) + a §0 split on a detail sample. Seeds nothing.
 *   --pilot     measure + extract 2 KEPT documents end-to-end (word count).
 *   --seed      ⚠️ POST-PUSH only. Enumerate the published evidence → one row per
 *               item (the worker applies §0 + extraction). --max-pages N bounds it.
 */
import { getNeonPool, endNeonPool } from './shared/neon-pool'
import { bulkInsertQueueRows } from './shared/queue-client'
import { pdfToText } from './shared/compile'
import { countWords } from './shared/db-metadata'
import {
  INQUIRY_EVIDENCE_SOURCES, pohLastPage, pohListPage, pohFetchItem, classifyEvidence, fetchPdfBuffer,
} from './sources/inquiry-evidence'

const CORPUS = 'inquiry-evidence'
const KEY = 'post-office-horizon'

function argN(flag: string, def: number): number {
  const i = process.argv.indexOf(flag)
  return i >= 0 && process.argv[i + 1] ? Number(process.argv[i + 1]) : def
}

async function main() {
  const mode = process.argv.includes('--seed') ? 'seed' : process.argv.includes('--pilot') ? 'pilot' : 'measure'
  const src = INQUIRY_EVIDENCE_SOURCES.find(s => s.key === KEY)!
  const lastPage = await pohLastPage(src.base)
  // page 1 carried ~10 items; estimate total from the pager.
  const firstPage = await pohListPage(src.base, 0)
  const perPage = firstPage.length || 10
  const totalEst = (lastPage + 1) * perPage
  console.log(`${src.name}: ${lastPage + 1} pages × ~${perPage}/page ≈ ${totalEst} published evidence items (licence OGL v3.0)`)

  if (mode !== 'seed') {
    // §0 split on a sample of detail pages spread across the listing.
    const sampleN = mode === 'measure' ? 30 : 12
    const pageStep = Math.max(1, Math.floor(lastPage / sampleN))
    const sampleSlugs: string[] = []
    for (let p = 0; p <= lastPage && sampleSlugs.length < sampleN; p += pageStep) {
      const refs = await pohListPage(src.base, p)
      if (refs[0]) sampleSlugs.push(refs[0].slug)
      await new Promise(r => setTimeout(r, 200))
    }
    let keep = 0, exclude = 0, flag = 0
    const kept: Array<{ slug: string; pdfUrl: string }> = []
    for (const slug of sampleSlugs) {
      const it = await pohFetchItem(src.base, slug)
      if (!it) continue
      const c = classifyEvidence({ sensitivity: src.sensitivity, refPrefix: it.refPrefix, evidenceType: it.evidenceType, witnessCategory: it.witnessCategory, witness: it.witness, title: it.title })
      if (c.decision === 'keep') { keep++; if (it.pdfUrl) kept.push({ slug, pdfUrl: it.pdfUrl }) }
      else if (c.decision === 'exclude') exclude++; else flag++
      console.log(`  ${c.decision.toUpperCase().padEnd(7)} [${it.refPrefix}/${it.evidenceType ?? '?'}${it.witnessCategory ? '/' + it.witnessCategory : ''}] ${it.title.slice(0, 50)}`)
      await new Promise(r => setTimeout(r, 200))
    }
    const n = keep + exclude + flag
    console.log(`\n§0 split on ${n} sampled: keep ${keep} (${(100 * keep / n).toFixed(0)}%), exclude ${exclude}, flag ${flag}`)
    console.log(`PREDICTION (kept): ~${Math.round(totalEst * keep / Math.max(n, 1))} ingestable evidence documents of ~${totalEst}`)

    if (mode === 'pilot') {
      for (const k of kept.slice(0, 2)) {
        const buf = await fetchPdfBuffer(k.pdfUrl)
        const text = buf ? await pdfToText(buf, k.pdfUrl) : null
        console.log(`PILOT ${k.slug.slice(0, 36)}: ${text ? countWords(text) : 0} words`)
      }
    }
    await endNeonPool(); return
  }

  // ── seed (POST-PUSH) ─────────────────────────────────────────────────────────
  const maxPages = argN('--max-pages', lastPage)
  const rows: Array<{ id: string; corpus: string; docId: string; sourceType: string; priority: number }> = []
  const seen = new Set<string>()
  for (let p = 0; p <= maxPages; p++) {
    const refs = await pohListPage(src.base, p)
    for (const r of refs) {
      if (seen.has(r.slug)) continue
      seen.add(r.slug)
      rows.push({ id: `${CORPUS}:${KEY}#${r.slug}`, corpus: CORPUS, docId: `${KEY}#${r.slug}`, sourceType: CORPUS, priority: 3 })
    }
    if (p % 100 === 0) console.log(`  …page ${p}/${maxPages}, ${rows.length} rows`)
    await new Promise(r => setTimeout(r, 150))
  }
  const { affected } = await bulkInsertQueueRows(rows)
  const pool = getNeonPool()
  await pool.query(`
    INSERT INTO corpus_targets (corpus_key, display_label, est_sections, est_is_confirmed, priority, blocked, retired, notes, updated_at)
    VALUES ($1, 'Public-inquiry evidence (§0-governed)', $2, false, 3, false, false, 'V30 §3 — inquiry evidence behind the reports; §0 sensitive-category exclusion at ingest. Pilot: Post Office Horizon (OGL v3.0). Infected Blood/Grenfell sequenced.', NOW())
    ON CONFLICT (corpus_key) DO UPDATE SET est_sections = $2, est_is_confirmed = false, blocked = false, updated_at = NOW()
  `, [CORPUS, rows.length])
  console.log(`\n[inquiry-evidence] seeded ${affected}/${rows.length} ${KEY} evidence rows (worker applies §0)`)
  await endNeonPool()
}
main().catch(e => { console.error('FATAL', e); process.exit(1) })
