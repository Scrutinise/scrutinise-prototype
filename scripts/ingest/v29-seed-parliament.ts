/**
 * v29-seed-parliament.ts — V29 §3: the Parliament remainder (4 new corpora, all
 * Open Parliament Licence v3.0). One driver, four sources:
 *
 *   erskine-may        Erskine May procedure treatise (one row per Section)
 *   early-day-motions  EDMs (list-page rows, one section per motion)
 *   petitions          e-petitions open + archived (list-page rows)
 *   members-interests  Register of Members' Financial Interests (list-page rows)
 *
 * Usage:  --source=<name>  with one of --pilot | --measure | --seed
 *         (omit --source to act on ALL four).
 *
 * New sourceTypes — SEED POST-PUSH (the processors must deploy first or the live
 * worker markSkips the rows). Idempotent (ON CONFLICT DO NOTHING; the worker
 * skips content already in R2 / upserts by stable item id).
 */
import { getNeonPool, endNeonPool } from './shared/neon-pool'
import { bulkInsertQueueRows } from './shared/queue-client'
import { countWords } from './shared/db-metadata'

import { enumerateErskineSections, fetchErskineSection } from './sources/erskine-may'
import { edmTotal, fetchEdmPage, compileEdm } from './sources/early-day-motions'
import { petitionPageCount, fetchPetitionPage, type PetitionKind } from './sources/petitions'
import { interestsTotal, fetchInterestsPage } from './sources/members-interests'

type Mode = 'pilot' | 'measure' | 'seed'
const SOURCES = ['erskine-may', 'early-day-motions', 'petitions', 'members-interests'] as const
type Source = typeof SOURCES[number]

const LABEL: Record<Source, string> = {
  'erskine-may': 'Erskine May — parliamentary procedure',
  'early-day-motions': 'Early Day Motions',
  'petitions': 'UK e-petitions (open + archived)',
  'members-interests': "Register of Members' Financial Interests",
}

async function upsertTarget(corpus: string, label: string, est: number, confirmed: boolean) {
  const pool = getNeonPool()
  await pool.query(`
    INSERT INTO corpus_targets (corpus_key, display_label, est_sections, est_is_confirmed, priority, blocked, retired, notes, updated_at)
    VALUES ($1, $2, $3, $4, 3, false, false, 'V29 §3 Parliament remainder — Open Parliament Licence v3.0', NOW())
    ON CONFLICT (corpus_key) DO UPDATE SET
      display_label = $2, est_sections = $3, est_is_confirmed = $4, blocked = false, blocked_reason = NULL, updated_at = NOW()
  `, [corpus, label, est, confirmed])
}

// ── erskine-may ───────────────────────────────────────────────────────────────
async function erskine(mode: Mode) {
  const corpus = 'erskine-may'
  if (mode === 'pilot') {
    const sec = await fetchErskineSection(5616)
    console.log(`[erskine-may] pilot section 5616: "${sec?.title}" — ${sec ? countWords(sec.text) : 0} words`)
    if (sec) console.log('  ---\n  ' + sec.text.slice(0, 400).replace(/\n/g, '\n  ') + '\n  ---')
    return
  }
  const ids = await enumerateErskineSections(5, (c, s) => process.stdout.write(`  chapters ${c}, sections ${s}\r`))
  console.log(`\n[erskine-may] enumerated ${ids.length} sections`)
  if (mode === 'measure') return
  const rows = ids.map(id => ({ id: `${corpus}:sec:${id}`, corpus, docId: `sec:${id}`, sourceType: corpus, priority: 3 }))
  const { affected } = await bulkInsertQueueRows(rows)
  await upsertTarget(corpus, LABEL[corpus], ids.length, true)
  console.log(`[erskine-may] seeded ${affected}/${rows.length} rows; target est=${ids.length}`)
}

// ── early-day-motions ─────────────────────────────────────────────────────────
async function edm(mode: Mode) {
  const corpus = 'early-day-motions'
  const total = await edmTotal()
  console.log(`[early-day-motions] total motions: ${total}`)
  if (mode === 'pilot') {
    const page = await fetchEdmPage(0, 2)
    for (const m of page ?? []) {
      const t = compileEdm(m)
      console.log(`  EDM ${m.uin} "${m.title.slice(0, 50)}" — ${m.sponsorsCount} sigs, ${countWords(t)} words`)
    }
    return
  }
  if (mode === 'measure') return
  const TAKE = 100
  const rows = []
  for (let skip = 0; skip < total; skip += TAKE) rows.push({ id: `${corpus}:list:${skip}`, corpus, docId: `list:${skip}`, sourceType: corpus, priority: 3 })
  const { affected } = await bulkInsertQueueRows(rows)
  await upsertTarget(corpus, LABEL[corpus], total, false)
  console.log(`[early-day-motions] seeded ${affected}/${rows.length} list-page rows; target est≈${total}`)
}

// ── petitions ─────────────────────────────────────────────────────────────────
async function petitions(mode: Mode) {
  const corpus = 'petitions'
  const openPages = await petitionPageCount('open')
  const archPages = await petitionPageCount('archived')
  const est = (openPages + archPages) * 25
  console.log(`[petitions] open pages: ${openPages}, archived pages: ${archPages} → est ≈ ${est} petitions`)
  if (mode === 'pilot') {
    const p = await fetchPetitionPage('open', 1)
    for (const it of (p ?? []).slice(0, 2)) console.log(`  "${it.action.slice(0, 50)}" — ${it.signatureCount} sigs, ${countWords(it.text)} words`)
    return
  }
  if (mode === 'measure') return
  const rows: any[] = []
  for (let p = 1; p <= openPages; p++) rows.push({ id: `${corpus}:list:open:${p}`, corpus, docId: `list:open:${p}`, sourceType: corpus, priority: 3 })
  for (let p = 1; p <= archPages; p++) rows.push({ id: `${corpus}:list:archived:${p}`, corpus, docId: `list:archived:${p}`, sourceType: corpus, priority: 3 })
  const { affected } = await bulkInsertQueueRows(rows)
  await upsertTarget(corpus, LABEL[corpus], est, false)
  console.log(`[petitions] seeded ${affected}/${rows.length} list-page rows; target est≈${est}`)
}

// ── members-interests ─────────────────────────────────────────────────────────
async function interests(mode: Mode) {
  const corpus = 'members-interests'
  const total = await interestsTotal()
  console.log(`[members-interests] total interests (incl. child): ${total}`)
  if (mode === 'pilot') {
    const page = await fetchInterestsPage(0, 2)
    for (const it of page ?? []) console.log(`  ${it.member} — ${it.category} — ${countWords(it.text)} words`)
    return
  }
  if (mode === 'measure') return
  // V30: interests-api.parliament.uk caps Take at 20 regardless of what's
  // requested (verified live) — skip must step by the true page size or 80% of
  // each intended window is silently skipped. See process-row.ts's matching note.
  const TAKE = 20
  const rows = []
  for (let skip = 0; skip < total; skip += TAKE) rows.push({ id: `${corpus}:list:${skip}`, corpus, docId: `list:${skip}`, sourceType: corpus, priority: 3 })
  const { affected } = await bulkInsertQueueRows(rows)
  await upsertTarget(corpus, LABEL[corpus], total, false)
  console.log(`[members-interests] seeded ${affected}/${rows.length} list-page rows; target est≈${total}`)
}

const RUN: Record<Source, (m: Mode) => Promise<void>> = {
  'erskine-may': erskine, 'early-day-motions': edm, 'petitions': petitions, 'members-interests': interests,
}

async function main() {
  const mode: Mode = process.argv.includes('--seed') ? 'seed' : process.argv.includes('--measure') ? 'measure' : 'pilot'
  const srcArg = process.argv.find(a => a.startsWith('--source='))?.split('=')[1] as Source | undefined
  const sources = srcArg ? [srcArg] : [...SOURCES]
  for (const s of sources) {
    console.log(`\n=== ${s} [${mode}] ===`)
    await RUN[s](mode)
  }
  await endNeonPool()
}
main().catch(e => { console.error('FATAL', e); process.exit(1) })
