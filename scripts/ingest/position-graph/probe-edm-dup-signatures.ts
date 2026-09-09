/**
 * probe-edm-dup-signatures.ts — the pilot found 3 motions in 400 where one member appears TWICE in
 * the Sponsors array. Read them before designing the signal, because "a member signs a motion once"
 * is the assumption the signal's natural key would rest on.
 *
 * ⚠ READ-ONLY, API only, no database.
 *
 * Usage (from scripts/ingest):
 *   npx tsx position-graph/probe-edm-dup-signatures.ts
 */
import path from 'path'
try { require('dotenv').config({ path: path.join(__dirname, '../../../scrutinise-web/.env') }) } catch { /* ok */ }
import { getNeonPool, endNeonPool } from '../shared/neon-pool'

export {}

const BASE = 'https://oralquestionsandmotions-api.parliament.uk'
const UA = 'Scrutinise-Ingest/1.0 (+https://scrutinise.org; contact cl@scrutinise.org)'
const pool = getNeonPool()

async function main() {
  const { rows: todo } = await pool.query<{ motion_id: number }>(
    `SELECT motion_id FROM edm_sponsor ORDER BY md5(motion_id::text) LIMIT 1500`)
  let scanned = 0, dupMotions = 0, dupRows = 0
  let sameDate = 0, diffDate = 0, oneWithdrawn = 0, bothWithdrawn = 0, neitherWithdrawn = 0
  const shown: string[] = []
  let idx = 0
  const worker = async () => {
    for (;;) {
      const i = idx++
      if (i >= todo.length) return
      const id = todo[i].motion_id
      let body: any = null
      try {
        const res = await fetch(`${BASE}/EarlyDayMotion/${id}`, { headers: { Accept: 'application/json', 'User-Agent': UA } })
        if (res.ok) body = await res.json()
      } catch { /* counted as not scanned */ }
      if (!body) continue
      scanned++
      const sponsors: any[] = body?.Response?.Sponsors ?? []
      const byMember = new Map<number, any[]>()
      for (const s of sponsors) {
        const m = s?.Member?.MnisId ?? s?.MemberId
        if (m == null) continue
        const l = byMember.get(m); if (l) l.push(s); else byMember.set(m, [s])
      }
      let motionHasDup = false
      for (const [m, list] of byMember) {
        if (list.length < 2) continue
        motionHasDup = true
        dupRows += list.length - 1
        const dates = list.map((s) => String(s.CreatedWhen).slice(0, 10))
        if (new Set(dates).size === 1) sameDate++; else diffDate++
        const w = list.filter((s) => s.IsWithdrawn).length
        if (w === 0) neitherWithdrawn++
        else if (w === list.length) bothWithdrawn++
        else oneWithdrawn++
        if (shown.length < 10) {
          shown.push(`motion ${id}  MNIS ${m}  "${list[0]?.Member?.Name}"  ×${list.length}\n` +
            list.map((s) => `        sigId ${s.Id}  order ${s.SponsoringOrder}  signed ${String(s.CreatedWhen).slice(0, 19)}  withdrawn ${s.IsWithdrawn}${s.WithdrawnDate ? ' on ' + String(s.WithdrawnDate).slice(0, 10) : ''}`).join('\n'))
        }
      }
      if (motionHasDup) dupMotions++
    }
  }
  await Promise.all(Array.from({ length: 4 }, worker))

  console.log(`\n════ ONE MEMBER, TWO SIGNATURES ON THE SAME MOTION ${'═'.repeat(28)}`)
  console.log(`   motions scanned                 ${scanned}`)
  console.log(`   motions with a repeated member  ${dupMotions}   ${((100 * dupMotions) / Math.max(1, scanned)).toFixed(2)}%`)
  console.log(`   extra rows this accounts for    ${dupRows}`)
  console.log(`\n   of the repeated members:`)
  console.log(`     both signatures SAME date     ${sameDate}   ← one signal either way; no double count`)
  console.log(`     ⚠ DIFFERENT dates             ${diffDate}   ← two dated acts, so two signals`)
  console.log(`     exactly one withdrawn         ${oneWithdrawn}   ← signed, withdrew, re-signed (or the reverse)`)
  console.log(`     both withdrawn                ${bothWithdrawn}`)
  console.log(`     ⚠ NEITHER withdrawn           ${neitherWithdrawn}   ← two live signatures for one member`)
  console.log(`\n   examples:`)
  for (const s of shown) console.log(`     ${s}`)
  await endNeonPool()
}
main().catch(async (e) => { console.error('FATAL', e instanceof Error ? e.stack : e); await endNeonPool().catch(() => {}); process.exit(1) })
