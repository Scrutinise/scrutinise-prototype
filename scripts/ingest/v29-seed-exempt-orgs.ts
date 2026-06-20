/**
 * v29-seed-exempt-orgs.ts — V29 §6: Ofgem + Ofcom (exempt-org own-domain builds).
 *
 *   Ofgem  ogl-3.0  (VERIFIED ofgem.gov.uk/copyright) — 12,899 /publications/ leaves
 *   Ofcom  ofcom-open (VERIFIED ofcom.org.uk/about-ofcom/website/terms-of-use) —
 *          sitemap-enumerated regulatory pages (statements/consultations/studies)
 *
 * Usage: --source=ofgem|ofcom (omit for both) with --pilot | --measure | --seed.
 * New sourceTypes — SEED POST-PUSH. Idempotent.
 */
import { getNeonPool, endNeonPool } from './shared/neon-pool'
import { bulkInsertQueueRows } from './shared/queue-client'
import { pdfToText } from './shared/compile'
import { countWords } from './shared/db-metadata'
import { enumerateOfgemPublications, fetchOfgemPage, fetchOfgemPdf } from './sources/ofgem'
import { enumerateOfcomPages, fetchOfcomPage, fetchOfcomPdf } from './sources/ofcom'

type Mode = 'pilot' | 'measure' | 'seed'

interface Cfg {
  corpus: string; label: string; note: string
  enumerate: () => Promise<Array<{ url: string; path: string }>>
  fetchPage: (p: string) => Promise<any>
  fetchPdf: (u: string) => Promise<Buffer | null>
}

const CFG: Record<string, Cfg> = {
  ofgem: {
    corpus: 'ofgem', label: 'Ofgem publications',
    note: 'V29 §6 — ofgem.gov.uk /publications, OGL v3.0 (verified /copyright)',
    enumerate: enumerateOfgemPublications, fetchPage: fetchOfgemPage, fetchPdf: fetchOfgemPdf,
  },
  ofcom: {
    corpus: 'ofcom', label: 'Ofcom publications',
    note: 'V29 §6 — ofcom.org.uk sitemap-enumerated regulatory pages, ofcom-open (verified terms-of-use)',
    enumerate: enumerateOfcomPages, fetchPage: fetchOfcomPage, fetchPdf: fetchOfcomPdf,
  },
}

async function run(key: string, mode: Mode) {
  const c = CFG[key]
  console.log(`\n=== ${key} [${mode}] ===`)
  const leaves = await c.enumerate()
  console.log(`enumerated ${leaves.length} ${key} pages`)

  if (mode === 'pilot') {
    let words = 0, ok = 0
    for (const l of leaves.slice(0, 4)) {
      const page = await c.fetchPage(l.path)
      if (!page) { console.log(`  ✗ ${l.path} — fetch failed`); continue }
      let w = 0, via = 'none'
      for (const u of (page.pdfUrls ?? []).slice(0, 1)) {
        const buf = await c.fetchPdf(u)
        if (buf) { const t = await pdfToText(buf, u); if (t) { w = countWords(t); via = 'pdf'; break } }
      }
      if (w === 0 && page.mainText.length >= 200) { w = countWords(page.mainText); via = 'html' }
      if (w > 0) { ok++; words += w }
      console.log(`  ✓ [${via}] ${w} words | ${(page.title ?? '').slice(0, 55)}`)
      await new Promise(r => setTimeout(r, 600))
    }
    const avg = ok ? Math.round(words / ok) : 0
    console.log(`  extract ${ok}/4; avg ${avg} words → PREDICTION ~${leaves.length} sections / ~${(leaves.length * avg / 1e6).toFixed(1)}M words`)
    return
  }
  if (mode === 'measure') return

  const rows = leaves.map(l => ({ id: `${c.corpus}:${l.path}`, corpus: c.corpus, docId: l.path, sourceType: c.corpus, priority: 4 }))
  const { affected } = await bulkInsertQueueRows(rows)
  const pool = getNeonPool()
  await pool.query(`
    INSERT INTO corpus_targets (corpus_key, display_label, est_sections, est_is_confirmed, priority, blocked, retired, notes, updated_at)
    VALUES ($1, $2, $3, false, 4, false, false, $4, NOW())
    ON CONFLICT (corpus_key) DO UPDATE SET est_sections = $3, est_is_confirmed = false, blocked = false, blocked_reason = NULL, notes = $4, updated_at = NOW()
  `, [c.corpus, c.label, leaves.length, c.note])
  console.log(`[${key}] seeded ${affected}/${rows.length} rows; target est≈${leaves.length}`)
}

async function main() {
  const mode: Mode = process.argv.includes('--seed') ? 'seed' : process.argv.includes('--measure') ? 'measure' : 'pilot'
  const srcArg = process.argv.find(a => a.startsWith('--source='))?.split('=')[1]
  const sources = srcArg ? [srcArg] : ['ofgem', 'ofcom']
  for (const s of sources) await run(s, mode)
  await endNeonPool()
}
main().catch(e => { console.error('FATAL', e); process.exit(1) })
