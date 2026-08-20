/**
 * probe-3b-pair.ts — GRAPH 3B §1. Which two divisions was Charlie actually looking at?
 *
 * The brief reports 555 actors and confidence exactly 0.671. My first guess (Amendment 12 + Third
 * Reading) gives 607 and 0.6227, so the guess is wrong — find the pair that reproduces the page
 * rather than reporting a diagnosis of a case Charlie was not looking at.
 *
 * Read-only. Usage (from scripts/graph):  npx tsx probe-3b-pair.ts
 */
import path from 'path'
try { require('dotenv').config({ path: path.join(__dirname, '../../scrutinise-web/.env') }) } catch { /* ok */ }

import { getNeonPool, endNeonPool } from '../ingest/shared/neon-pool'

export {}

async function main() {
  const pool = getNeonPool()
  try {
    const { aggregate } = await import('../../scrutinise-web/lib/graph/position-math')
    const { POSITION_CONFIG } = await import('../../scrutinise-web/lib/graph/position-config')

    const { rows: divs } = await pool.query<{ tid: string; d: string; title: string; fv: boolean }>(`
      SELECT d.house || ':' || d.division_id AS tid, d.division_date::text AS d, d.title,
             c.free_vote_like AS fv
        FROM divisions d
        JOIN position_division_class c ON c.house = d.house AND c.division_id = d.division_id
       WHERE d.title ILIKE '%Terminally Ill Adults%' OR d.bill_title ILIKE '%Terminally Ill Adults%'
       ORDER BY d.division_date, d.division_id`)
    console.log('the 11 divisions, and whether the heuristic called each one free-vote-like:')
    for (const r of divs) console.log(`   ${r.tid.padEnd(14)} ${r.d}  fv=${String(r.fv).padEnd(5)} ${r.title}`)

    // Every signal for all 11, once.
    const { rows: sig } = await pool.query<{
      actor_id: string; target_id: string; direction: number
      derivation: string; raw_weight: number; observed_at: string
    }>(`SELECT actor_id::text, target_id, direction, derivation, raw_weight, observed_at::text
          FROM position_signal
         WHERE target_type = 'division' AND target_id = ANY($1::text[])`, [divs.map((d) => d.tid)])

    const asOf = new Date().toISOString().slice(0, 10)
    console.log(`\nasOf ${asOf}. Every PAIR, with the actor count and the modal (stance, confidence):\n`)
    console.log('   pair                          actors   modal cell           n   next cell')

    const hits: string[] = []
    for (let i = 0; i < divs.length; i++) {
      for (let j = i + 1; j < divs.length; j++) {
        const pair = [divs[i].tid, divs[j].tid]
        const mine = sig.filter((s) => pair.includes(s.target_id))
        const byActor = new Map<string, typeof mine>()
        for (const r of mine) { const l = byActor.get(r.actor_id); if (l) l.push(r); else byActor.set(r.actor_id, [r]) }
        const cells = new Map<string, number>()
        for (const [id, sigs] of byActor) {
          const a = aggregate(sigs.map((s, k) => ({
            id: `${id}:${k}`, signalType: 'vote' as const, derivation: s.derivation,
            direction: s.direction, rawWeight: s.raw_weight, observedAt: s.observed_at,
          })), asOf, POSITION_CONFIG)
          const key = `${a.stanceScore.toFixed(2)} / ${a.confidence.toFixed(3)}`
          cells.set(key, (cells.get(key) ?? 0) + 1)
        }
        const sorted = [...cells.entries()].sort((a, b) => b[1] - a[1])
        const line = `   ${pair.join(' + ').padEnd(29)} ${String(byActor.size).padStart(6)}   ${sorted[0][0].padEnd(20)} ${String(sorted[0][1]).padStart(3)}   ${sorted[1]?.[0] ?? ''}`
        const match = byActor.size === 555 || sorted.some(([k]) => k.endsWith('0.671'))
        if (match) hits.push(line)
        console.log(line + (match ? '   ← MATCHES THE PAGE' : ''))
      }
    }
    console.log(`\n${hits.length} pair(s) reproduce 555 actors and/or confidence 0.671:`)
    for (const h of hits) console.log(h)
  } finally {
    await endNeonPool()
  }
}

main().catch((e) => { console.error(e); process.exit(1) })
