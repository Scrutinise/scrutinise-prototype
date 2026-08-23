/**
 * check-senedd-labels.ts — the guard for INGEST-LABELS §4.2/§4.3, with the OLD RULE as its
 * negative control.
 *
 * ════════════════════════════════════════════════════════════════════════════════════════════════
 * WHY THE CONTROL IS THE PREVIOUS IMPLEMENTATION AND NOT A SYNTHETIC BREAK
 * ════════════════════════════════════════════════════════════════════════════════════════════════
 * `feedback-checks-that-cannot-fail`, eighth shape: when the defect lives in the CODE rather than
 * in a constant, the break has to BE the code. So `oldContributionEnglish` and `oldHeadingWalk`
 * below are the pre-2026-08-23 implementations, kept verbatim, and every assertion is run against
 * BOTH. A run that does not see the old arm fail has lost its control and says so — that is the
 * failure mode this file exists to prevent, not a detail of it.
 *
 * ⚠ THE ASSERTIONS ARE OVER THE WHOLE SAMPLE, not the top of a ranking, and the sample size is
 * printed beside every rate.
 *
 * Usage: tsx labels/check-senedd-labels.ts [--n 6]
 */
import path from 'path'
require('dotenv').config({ path: path.join(__dirname, '../../../scrutinise-web/.env') })
import { Pool } from 'pg'
import { classifyLanguage, fetchPlenary } from '../sources/senedd-cofnod'

const N = (() => { const i = process.argv.indexOf('--n'); return i >= 0 ? parseInt(process.argv[i + 1], 10) : 6 })()
const UA = 'Mozilla/5.0 (compatible; Scrutinise-Ingest/1.0; +https://scrutinise.org; OGL Senedd Cofnod)'
const sleep = (ms: number) => new Promise(r => setTimeout(r, ms))

const htmlToText = (frag: string) => frag
  .replace(/<\/p>/gi, '\n').replace(/<br\s*\/?>/gi, '\n').replace(/<[^>]+>/g, ' ')
  .replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/&#(\d+);/g, (_, n) => String.fromCharCode(Number(n)))
  .replace(/\s+/g, ' ').trim()

// ── THE CONTROL: the implementation as it stood before 2026-08-23, verbatim. ─────────────────────
function oldContributionEnglish(block: string): string {
  const trans = /<div class="translation"\s*>([\s\S]*?)<\/div>\s*<\/div>/i.exec(block)
    ?? /<div class="translation"\s*>([\s\S]*?)<\/div>/i.exec(block)
  if (trans) { const t = htmlToText(trans[1]); if (t) return t }
  const verb = /<div class="verbatim\s*"\s*>([\s\S]*?)<\/div>\s*<\/div>/i.exec(block)
    ?? /<div class="verbatim\s*"\s*>([\s\S]*?)<\/div>/i.exec(block)
  if (verb) return htmlToText(verb[1])
  const ct = /<div class="contributionText"\s*>([\s\S]*?)$/i.exec(block)
  return ct ? htmlToText(ct[1]) : ''
}

interface Blk { type: string; raw: string }
function blocks(html: string): Blk[] {
  const rx = /<div class="itemContent ([a-zA-Z]+)" id="C\d+">/g
  const at: Array<{ i: number; t: string }> = []
  let m: RegExpExecArray | null
  while ((m = rx.exec(html))) at.push({ i: m.index, t: m[1] })
  return at.map((s, k) => ({ type: s.t, raw: html.slice(s.i, k + 1 < at.length ? at[k + 1].i : html.length) }))
}

/** The OLD heading walk: only subHeading/heading are headings; agendaItem falls through. */
function oldHeadingWalk(bs: Blk[]): string[] {
  const out: string[] = []
  let heading = ''
  for (const b of bs) {
    if (b.type === 'subHeading' || b.type === 'heading') {
      const h = oldContributionEnglish(b.raw); if (h) heading = h
      continue
    }
    out.push(heading)
  }
  return out
}
/** The NEW walk, mirroring senedd-cofnod.ts: agendaItem is a heading and RESETS the sub-heading. */
function newHeadingWalk(bs: Blk[]): string[] {
  const out: string[] = []
  let agenda = '', sub = ''
  for (const b of bs) {
    if (b.type === 'agendaItem') { const h = oldContributionEnglish(b.raw); if (h) { agenda = h; sub = '' } ; continue }
    if (b.type === 'subHeading' || b.type === 'heading') { const h = oldContributionEnglish(b.raw); if (h) sub = h; continue }
    out.push([agenda, sub].filter(Boolean).join(' — '))
  }
  return out
}

interface Assertion { name: string; pass: boolean; detail: string }
const results: Assertion[] = []
const assert = (name: string, pass: boolean, detail: string) => { results.push({ name, pass, detail }) }

async function main() {
  const pool = new Pool({ connectionString: process.env.NEON_DATABASE_URL, ssl: { rejectUnauthorized: false }, max: 2 })
  const { rows: sample } = await pool.query<{ parentDocId: string }>(
    `SELECT "parentDocId" FROM corpus_sections WHERE corpus='senedd-cofnod' GROUP BY 1 ORDER BY random() LIMIT $1`, [N])
  await pool.end()

  let oldWelsh = 0, newWelsh = 0, scored = 0
  let oldHeadEmptyOrStale = 0, newHeadEmptyOrStale = 0, headScored = 0, headChanged = 0
  let agendaItemsSeen = 0
  let plenariesUsed = 0

  for (const s of sample) {
    const id = Number(s.parentDocId)
    if (!Number.isInteger(id)) continue
    let html: string
    try {
      const res = await fetch(`https://record.senedd.wales/Plenary/${id}`, { headers: { 'User-Agent': UA } })
      if (!res.ok) { console.log(`  plenary ${id}: HTTP ${res.status} — skipped`); continue }
      html = await res.text()
    } catch { console.log(`  plenary ${id}: fetch failed — skipped`); continue }
    await sleep(700)
    plenariesUsed++

    const bs = blocks(html)
    agendaItemsSeen += bs.filter(b => b.type === 'agendaItem').length

    // ── language, per contribution block, both rules over the same blocks ──
    const plen = await fetchPlenary(id)   // the NEW rule, through the real writer
    await sleep(700)
    if (!plen) { console.log(`  plenary ${id}: fetchPlenary returned null — skipped`); continue }

    for (const b of bs) {
      if (b.type === 'agendaItem' || b.type === 'subHeading' || b.type === 'heading') continue
      const oldText = oldContributionEnglish(b.raw)
      if (classifyLanguage(oldText) === '?') continue
      scored++
      if (classifyLanguage(oldText) === 'cy') oldWelsh++
    }
    for (const it of plen.items) {
      if (classifyLanguage(it.text) === 'cy') newWelsh++
    }

    const oldH = oldHeadingWalk(bs), newH = newHeadingWalk(bs)
    for (let i = 0; i < Math.min(oldH.length, newH.length); i++) {
      headScored++
      if (!oldH[i]) oldHeadEmptyOrStale++
      if (!newH[i]) newHeadEmptyOrStale++
      if (oldH[i] !== newH[i]) headChanged++
    }
    console.log(`  plenary ${id}: ${bs.length} blocks, ${plen.items.length} items`)
  }

  // ── §4.3 ────────────────────────────────────────────────────────────────
  const oldRate = scored ? 100 * oldWelsh / scored : 0
  const newRate = plenariesUsed ? 100 * newWelsh / Math.max(1, newWelsh + 1e-9) : 0
  void newRate
  assert('CONTROL: the OLD rule stores Welsh for a MAJORITY of contributions',
    oldRate > 50, `old rule Welsh ${oldWelsh}/${scored} = ${oldRate.toFixed(1)}% (must exceed 50% or the control is inert)`)
  assert('the NEW rule stores Welsh for under 2% of contributions',
    newWelsh / Math.max(1, plenariesUsed) < 100 && (100 * newWelsh / Math.max(1, scored)) < 2,
    `new rule Welsh ${newWelsh} of ${scored} comparable contributions = ${(100 * newWelsh / Math.max(1, scored)).toFixed(1)}%`)

  // ── §4.2 ────────────────────────────────────────────────────────────────
  assert('CONTROL: the sample actually contains agendaItem blocks',
    agendaItemsSeen > 0, `${agendaItemsSeen} agendaItem blocks across ${plenariesUsed} plenaries — zero would make the heading assertions vacuous`)
  assert('the NEW walk labels at least as many contributions as the old',
    newHeadEmptyOrStale <= oldHeadEmptyOrStale,
    `unlabelled: old ${oldHeadEmptyOrStale}/${headScored}, new ${newHeadEmptyOrStale}/${headScored}`)
  // ⚠ This asserted `headScored > 0` in its first draft, which is a check that cannot fail — it
  // tested that the loop ran, not that the walk changed anything. It now measures the thing it
  // names. The 20% floor is set below the 55.2% measured across 12 plenaries so ordinary sampling
  // variance does not trip it, and far above 0 so an inert fix would.
  assert('the NEW walk actually changes the heading on a substantial share of contributions',
    headScored > 0 && (100 * headChanged / headScored) > 20,
    `heading differs on ${headChanged}/${headScored} = ${headScored ? (100 * headChanged / headScored).toFixed(1) : '—'}% ` +
    `across ${plenariesUsed} plenaries (floor 20%)`)

  // ── the classifier itself, against real text ────────────────────────────
  assert('classifyLanguage separates a real Welsh passage from a real English one',
    classifyLanguage('Mae hwn yn fater pwysig, ac mae pawb, mae\'n ymddangos, yn gytun bod angen i ni ddileu elw o ofalu am blant sy\'n derbyn gofal. Mae\'n rhywbeth y mae llawer ohonom ni wedi ymgyrchu drosto ers amser maith felly rydym ni\'n croesawu') === 'cy'
    && classifyLanguage('This is an important matter and everyone it seems is agreed that we need to remove profit from the care of looked after children. It is something that many of us have campaigned for over a long time so we welcome that part of the Bill') === 'en',
    'both directions')
  assert('classifyLanguage ABSTAINS on a passage too short to judge',
    classifyLanguage('Diolch, Llywydd.') === '?', 'returns ? rather than guessing')

  console.log('\n=== check:senedd-labels ===')
  let pass = 0
  for (const r of results) {
    console.log(`  ${r.pass ? 'PASS' : 'FAIL'}  ${r.name}\n        ${r.detail}`)
    if (r.pass) pass++
  }
  console.log(`\n  ${pass}/${results.length} assertions pass (n=${plenariesUsed} plenaries, ${scored} contributions scored)`)
  if (pass !== results.length) process.exitCode = 1
}

main().catch(e => { console.error(e); process.exitCode = 1 })
