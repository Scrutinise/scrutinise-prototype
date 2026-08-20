/**
 * probe-3b-rank.ts — GRAPH 3B §1.3. Two claims about the ranking, MEASURED before either is
 * written into the report.
 *
 * Both came out of running the 3A verify harness after the sort key changed, and both are about
 * the same thing: **a ranking key is not a neutral presentation choice — it decides which
 * counter-examples a reader ever sees.**
 *
 *   CLAIM 1. 3A's report states, as a fact about the world: *"All 400 who voted in both voted the
 *            same way both times — a settled conscience position, not a bug."* The raw rows say 16
 *            of 587 changed their vote between Second and Third Reading. If the claim survived a
 *            passing check, the check must have been looking at a set the old ranking excluded.
 *
 *   CLAIM 2. The new sort key (confidence first, per brief §1) has a bias of its own, in the
 *            opposite direction: the harmonic discount applies WITHIN (class, direction), so
 *            signals that disagree land in different groups and each counts in full. An actor with
 *            a contradictory record therefore accumulates MORE mass — and more confidence — than
 *            one who voted the same way every time.
 *
 * Read-only. Usage (from scripts/graph):  npx tsx probe-3b-rank.ts
 */
import path from 'path'
try { require('dotenv').config({ path: path.join(__dirname, '../../scrutinise-web/.env') }) } catch { /* ok */ }

import { getNeonPool, endNeonPool } from '../ingest/shared/neon-pool'

export {}

const READINGS = ['commons:1877', 'commons:2071']
const AS_OF = '2026-08-19' // the date 3A's harness used, so this is like-for-like

async function main() {
  const pool = getNeonPool()
  try {
    const { aggregate } = await import('../../scrutinise-web/lib/graph/position-math')
    const { POSITION_CONFIG } = await import('../../scrutinise-web/lib/graph/position-config')

    // ══════════════════════════════════════════════════════════════════════════════════════════
    console.log('\n════ CLAIM 1 — did the OLD ranking hide the members who changed their minds?\n')
    const { rows: [raw] } = await pool.query<Record<string, string>>(`
      WITH a AS (SELECT member_id, vote FROM division_votes
                  WHERE house='commons' AND division_id=1877 AND vote IN ('aye','no')),
           b AS (SELECT member_id, vote FROM division_votes
                  WHERE house='commons' AND division_id=2071 AND vote IN ('aye','no'))
      SELECT COUNT(*)::text AS voted_in_both,
             COUNT(*) FILTER (WHERE a.vote <> b.vote)::text AS changed
        FROM a JOIN b ON b.member_id = a.member_id`)
    console.log(`   raw rows: ${raw.voted_in_both} members voted in both readings, ${raw.changed} changed side.`)
    console.log(`   3A's report says: "All 400 who voted in both voted the same way both times."`)

    const { rows: sigs } = await pool.query<{
      actor_id: string; name: string; target_id: string; direction: number
      derivation: string; raw_weight: number; observed_at: string
    }>(`SELECT s.actor_id::text, i.canonical_name AS name, s.target_id, s.direction,
               s.derivation, s.raw_weight, s.observed_at::text
          FROM position_signal s
          JOIN graph_entity_identity i ON i.entity_id = s.actor_id
         WHERE s.target_type='division' AND s.target_id = ANY($1::text[]) AND i.kind='person'`,
      [READINGS])

    const byActor = new Map<string, typeof sigs>()
    for (const r of sigs) { const l = byActor.get(r.actor_id); if (l) l.push(r); else byActor.set(r.actor_id, [r]) }

    const rolled = [...byActor.entries()].map(([id, ss]) => {
      const a = aggregate(ss.map((s, k) => ({
        id: `${id}:${k}`, signalType: 'vote' as const, derivation: s.derivation,
        direction: s.direction, rawWeight: s.raw_weight, observedAt: s.observed_at,
      })), AS_OF, POSITION_CONFIG)
      return { id, name: ss[0].name, n: ss.length, ...a }
    })
    console.log(`   positionsFor() matches ${rolled.length} actors on these two divisions.`)

    const changers = rolled.filter((r) => r.n === 2 && Math.abs(r.stanceScore) < 1)
    console.log(`   of those, ${changers.length} have two signals that disagree.`)

    const oldKey = (r: typeof rolled[number]) => Math.abs(r.stanceScore) * r.confidence
    const oldOrder = rolled.slice().sort((a, b) =>
      oldKey(b) - oldKey(a) || b.confidence - a.confidence || (a.name < b.name ? -1 : 1))
    const newOrder = rolled.slice().sort((a, b) =>
      b.confidence - a.confidence || b.n - a.n || (a.name < b.name ? -1 : 1))

    const posOld = changers.map((c) => oldOrder.findIndex((r) => r.id === c.id) + 1)
    const posNew = changers.map((c) => newOrder.findIndex((r) => r.id === c.id) + 1)
    console.log(`\n   rank of the changers under 3A's key (|stance| × confidence):`)
    console.log(`      best ${Math.min(...posOld)}, worst ${Math.max(...posOld)}, of ${rolled.length}`)
    console.log(`   rank of the same people under 3B's key (confidence, then signal count, then name):`)
    console.log(`      best ${Math.min(...posNew)}, worst ${Math.max(...posNew)}, of ${rolled.length}`)
    const HARNESS_LIMIT = 400
    const hiddenOld = posOld.filter((p) => p > HARNESS_LIMIT).length
    const hiddenNew = posNew.filter((p) => p > HARNESS_LIMIT).length
    console.log(`\n   3A's harness passed limit: ${HARNESS_LIMIT}.`)
    console.log(`      under the OLD key, ${hiddenOld} of ${changers.length} changers fell outside it — invisible to the check.`)
    console.log(`      under the NEW key, ${hiddenNew} of ${changers.length} fall outside it.`)
    console.log(`   ⇒ ${hiddenOld === changers.length
      ? 'CONFIRMED: every counter-example was below the cut-off, so the assertion could only pass.'
      : 'NOT confirmed — the old key did not hide all of them; look for another explanation.'}`)
    console.log(`\n   the members concerned, so the claim can be checked by hand:`)
    for (const c of changers.slice(0, 20)) console.log(`      ${c.name}`)

    // ══════════════════════════════════════════════════════════════════════════════════════════
    console.log('\n\n════ CLAIM 2 — does confidence REWARD an inconsistent record?\n')
    console.log('   constructed, from the arithmetic in position-math.ts:')
    const mk = (n: number, dir: number, off = 0) => Array.from({ length: n }, (_, i) => ({
      id: `x${off + i}`, signalType: 'vote' as const, derivation: 'free-vote-heuristic:v1',
      direction: dir, rawWeight: 0.7, observedAt: '2025-06-20',
    }))
    const consistent9 = aggregate(mk(9, 1), AS_OF, POSITION_CONFIG)
    const split54 = aggregate([...mk(5, 1), ...mk(4, -1, 100)], AS_OF, POSITION_CONFIG)
    console.log(`      9 votes, ALL the same way   → mass ${consistent9.mass.toFixed(4)}  confidence ${consistent9.confidence.toFixed(4)}  stance ${consistent9.stanceScore.toFixed(2)}`)
    console.log(`      5 one way + 4 the other     → mass ${split54.mass.toFixed(4)}  confidence ${split54.confidence.toFixed(4)}  stance ${split54.stanceScore.toFixed(2)}`)
    console.log(`   ⇒ ${split54.confidence > consistent9.confidence
      ? `CONFIRMED: the CONTRADICTORY record scores ${(split54.confidence - consistent9.confidence).toFixed(4)} HIGHER.`
      : 'not confirmed.'}`)
    console.log(`   why: the harmonic discount is applied within (signal type, class, DIRECTION), so`)
    console.log(`   signals that disagree land in different groups and each counts in full.`)

    console.log('\n   and on the real Bill — all 11 divisions, real members:')
    const { rows: ad } = await pool.query<{
      actor_id: string; name: string; target_id: string; direction: number
      derivation: string; raw_weight: number; observed_at: string
    }>(`WITH t AS (SELECT house||':'||division_id AS tid FROM divisions
                    WHERE title ILIKE '%Terminally Ill Adults%' OR bill_title ILIKE '%Terminally Ill Adults%')
        SELECT s.actor_id::text, i.canonical_name AS name, s.target_id, s.direction,
               s.derivation, s.raw_weight, s.observed_at::text
          FROM position_signal s JOIN t ON t.tid = s.target_id
          JOIN graph_entity_identity i ON i.entity_id = s.actor_id
         WHERE s.target_type='division' AND i.kind='person'`)
    const adBy = new Map<string, typeof ad>()
    for (const r of ad) { const l = adBy.get(r.actor_id); if (l) l.push(r); else adBy.set(r.actor_id, [r]) }
    const adRolled = [...adBy.entries()].map(([id, ss]) => {
      const a = aggregate(ss.map((s, k) => ({
        id: `${id}:${k}`, signalType: 'vote' as const, derivation: s.derivation,
        direction: s.direction, rawWeight: s.raw_weight, observedAt: s.observed_at,
      })), AS_OF, POSITION_CONFIG)
      return { name: ss[0].name, n: ss.length, ...a }
    }).filter((r) => r.n >= 9)
    const cons = adRolled.filter((r) => Math.abs(r.stanceScore) === 1)
    const mixed = adRolled.filter((r) => Math.abs(r.stanceScore) < 1)
    const mean = (xs: number[]) => xs.reduce((a, b) => a + b, 0) / (xs.length || 1)
    console.log(`      members with 9+ votes on the Bill: ${adRolled.length}`)
    console.log(`      entirely consistent: ${cons.length}, mean confidence ${mean(cons.map((c) => c.confidence)).toFixed(4)}`)
    console.log(`      mixed record:        ${mixed.length}, mean confidence ${mean(mixed.map((c) => c.confidence)).toFixed(4)}`)
    console.log(`      ⇒ ${mean(mixed.map((c) => c.confidence)) > mean(cons.map((c) => c.confidence))
      ? 'CONFIRMED on real data: a mixed record reads as BETTER EVIDENCED than a consistent one.'
      : 'not confirmed on real data.'}`)

    console.log('\n   what that means for the sort key the brief specifies: ranking by confidence')
    console.log('   first puts the LEAST decided members at the top. Reported, not silently fixed —')
    console.log('   brief §1: weight changes must be validated against the §3 answer key.')
  } finally {
    await endNeonPool()
  }
}

main().catch((e) => { console.error(e); process.exit(1) })
