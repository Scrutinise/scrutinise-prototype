/**
 * handcheck-edm-signatures.ts — BRIEF_INGEST_EDM_SIGNATURES §3: print what we hold for a handful of
 * motions, so 30 signatures can be checked against Parliament's OWN page rather than against the
 * API we loaded them from.
 *
 * ⚠ CHECKING THE API AGAINST ITSELF PROVES NOTHING. `edm.parliament.uk` is the page a member of the
 * public sees and it is a different surface from `oralquestionsandmotions-api.parliament.uk`. It is
 * behind a Cloudflare challenge to plain `fetch()` (403 "Just a moment…", measured), so the pages are
 * opened in a browser and the names read off them by eye. This script produces the sheet to read
 * against, in the order the page shows them.
 *
 * ⚠ READ-ONLY.
 *
 * Usage (from scripts/ingest):
 *   npx tsx position-graph/handcheck-edm-signatures.ts             # pick motions, print the sheet
 *   npx tsx position-graph/handcheck-edm-signatures.ts --motions 39066,60227
 */
import path from 'path'
try { require('dotenv').config({ path: path.join(__dirname, '../../../scrutinise-web/.env') }) } catch { /* ok */ }

import { getNeonPool, endNeonPool } from '../shared/neon-pool'

export {}

const argv = process.argv.slice(2)
const ONLY = (() => {
  const i = argv.indexOf('--motions')
  return i >= 0 ? argv[i + 1].split(',').map((s) => parseInt(s.trim(), 10)).filter(Boolean) : []
})()
/** Enough motions to cover at least this many signatures — §3 asks for 30. */
const TARGET_SIGS = 30

const pool = getNeonPool()

async function main() {
  let motions: number[] = ONLY
  if (!motions.length) {
    // ⚠ Chosen for SIZE, not at random, and that is a deliberate bias with a reason: a motion with
    // 4 signatures gives 4 chances to spot an error and a motion with 40 gives 40, and the failure
    // being looked for (an off-by-one in the list, a name mapped to the wrong row) shows up in the
    // MIDDLE of a long list. The spread across years is what keeps it from being one session.
    const { rows } = await pool.query<{ motion_id: number; c: string }>(`
      SELECT s.motion_id, COUNT(*)::text AS c
        FROM edm_signatory s
       GROUP BY 1 HAVING COUNT(*) BETWEEN 8 AND 60
       ORDER BY md5(s.motion_id::text)
       LIMIT 6`)
    let acc = 0
    for (const r of rows) { motions.push(r.motion_id); acc += Number(r.c); if (acc >= TARGET_SIGS) break }
  }

  console.log(`\n════ §3 HAND-CHECK SHEET ${'═'.repeat(54)}`)
  console.log(`   ${motions.length} motions. Open each URL in a browser (plain fetch is Cloudflare-blocked)`)
  console.log(`   and compare the names, the ORDER, and the dates against the rows below.\n`)

  let total = 0
  for (const id of motions) {
    const { rows: [m] } = await pool.query<Record<string, string>>(`
      SELECT s.uin, s.sponsor_name, s.date_tabled::text AS tabled, s.sponsors_count::text AS published,
             c."sectionTitle" AS title, c."sourceUrl" AS src
        FROM edm_sponsor s
        LEFT JOIN corpus_sections c ON c.id = 'early-day-motions:' || s.motion_id || ':1'
       WHERE s.motion_id = $1`, [id])
    const { rows: sigs } = await pool.query<Record<string, string>>(`
      SELECT sponsoring_order::text AS ord, mnis_id::text, signatory_name,
             signed_at::date::text AS signed, is_withdrawn::text AS withdrawn, withdrawn_on::text
        FROM edm_signatory WHERE motion_id = $1
       ORDER BY CASE WHEN sponsoring_order = 99999 THEN 2 ELSE 1 END, sponsoring_order NULLS LAST, signed_at`, [id])
    total += sigs.filter((s) => s.withdrawn === 'false').length

    console.log(`── motion ${id} · UIN ${m?.uin ?? '?'} · tabled ${m?.tabled ?? '?'} ${'─'.repeat(30)}`)
    console.log(`   title      ${(m?.title ?? '(no section held)').slice(0, 90)}`)
    console.log(`   PAGE       https://edm.parliament.uk/early-day-motion/${id}`)
    console.log(`   published signature count (list endpoint): ${m?.published ?? '?'}    we hold: ${sigs.length}`)
    console.log(`   sponsor per edm_sponsor: ${m?.sponsor_name ?? '?'}`)
    console.log(`   ${'ord'.padEnd(6)}${'mnis'.padEnd(7)}${'name'.padEnd(30)}${'signed'.padEnd(12)}withdrawn`)
    for (const s of sigs) {
      console.log(`   ${(s.ord === '99999' ? '(none)' : s.ord ?? '—').padEnd(6)}${(s.mnis_id ?? '—').padEnd(7)}${(s.signatory_name ?? '—').slice(0, 28).padEnd(30)}${(s.signed ?? '—').padEnd(12)}${s.withdrawn === 'true' ? 'WITHDRAWN ' + (s.withdrawn_on ?? '') : ''}`)
    }
    console.log('')
  }
  console.log(`   live (non-withdrawn) signatures on the sheet: ${total}   ${total >= TARGET_SIGS ? `✓ ≥ ${TARGET_SIGS}` : `⚠ FEWER THAN ${TARGET_SIGS}`}`)
  await endNeonPool()
}
main().catch(async (e) => { console.error('FATAL', e instanceof Error ? e.stack : e); await endNeonPool().catch(() => {}); process.exit(1) })
