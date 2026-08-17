/**
 * fix-ambiguous-matches.ts — BRIEF_GRAPH_2D4 §3, carried from 2D-2.
 *
 * 2D-2 keyed 788 people to a Parliament member id at `key_source='name-match'`, confidence 0.9 —
 * deliberately NOT 1.0, because a name match against a curated register is still a name match.
 * Three of those stand on a surface **the register itself says is shared**: `Mr George`,
 * `Robinson`. Two or more MNIS ids carry that same normalised surface, so the match was a coin
 * flip recorded at 0.9.
 *
 * The rule is small and its direction is the important part: **an ambiguous surface loses its
 * member id and keeps its name.** Charlie's standing instruction is that every name is kept and
 * displayed; what is removed is our CLAIM about which person it is. The entity, its aliases and its
 * edges are untouched — only `parl_member_id` is cleared, `key_source` returns to `name-match` and
 * the confidence drops to the unkeyed level.
 *
 * ⚠ Cleared, not deleted, and logged to `graph_merge_log` first so the claim is recoverable.
 *
 * Usage (from scripts/ingest):
 *   npx tsx position-graph/fix-ambiguous-matches.ts            # dry run
 *   npx tsx position-graph/fix-ambiguous-matches.ts --apply
 */
import path from 'path'
try { require('dotenv').config({ path: path.join(__dirname, '../../../scrutinise-web/.env') }) } catch { /* ok */ }

import { getNeonPool, endNeonPool } from '../shared/neon-pool'

export {}

const APPLY = process.argv.includes('--apply')
/** The confidence an unkeyed person name match carries in 2D-1's spine. */
const UNKEYED_CONFIDENCE = 0.7

async function main() {
  const pool = getNeonPool()
  try {
    // An entity keyed by NAME MATCH whose normalised surface is carried by more than one member.
    const { rows } = await pool.query<{ id: string; canonical_name: string; name_norm: string; parl_member_id: number; confidence: number; ids: string; names: string; edges: string }>(`
      WITH shared AS (
        SELECT surface_norm, COUNT(DISTINCT mnis_id) n,
               string_agg(DISTINCT mnis_id::text, ',' ORDER BY mnis_id::text) ids,
               string_agg(DISTINCT surface, ' | ') names
        FROM graph_member_name GROUP BY surface_norm HAVING COUNT(DISTINCT mnis_id) > 1
      )
      SELECT e.id::text, e.canonical_name, e.name_norm, e.parl_member_id, e.confidence,
             s.ids, s.names,
             (SELECT COUNT(*)::text FROM graph_edge g WHERE g.subject_id = e.id) edges
      FROM graph_entity e JOIN shared s ON s.surface_norm = e.name_norm
      WHERE e.kind = 'person' AND e.parl_member_id IS NOT NULL AND e.key_source = 'name-match'
      ORDER BY e.canonical_name`)

    console.log(`\n════ §3 — NAME MATCHES ON A REGISTER-AMBIGUOUS SURFACE ${APPLY ? '(APPLYING)' : '(dry run)'} ════`)
    console.log(`  A surface the register itself gives to more than one member cannot identify one of them.\n`)
    if (!rows.length) { console.log('  none found — nothing to do'); return }

    for (const r of rows) {
      console.log(`  ${r.canonical_name.padEnd(26)} keyed to MNIS ${String(r.parl_member_id).padEnd(6)} at ${r.confidence}`)
      console.log(`      surface "${r.name_norm}" is shared by MNIS ${r.ids}`)
      console.log(`      register spellings: ${r.names.slice(0, 96)}`)
      console.log(`      the entity carries ${r.edges} edges — none of them is touched`)
    }
    console.log(`\n  ${rows.length} claim(s) to clear. The name, the aliases and every edge stay.`)

    if (!APPLY) { console.log(`\n  dry run — nothing written. Re-run with --apply.`); return }
    for (const r of rows) {
      await pool.query(
        `INSERT INTO graph_merge_log (kind, kept_entity_id, merged_surface, merged_norm, reason, confidence, source)
         VALUES ('person', $1, $2, $3, $4, $5, 'fix-ambiguous-matches-2d4')`,
        [r.id, r.canonical_name, r.name_norm,
          `cleared parl_member_id ${r.parl_member_id}: surface shared by MNIS ${r.ids}`, r.confidence])
      await pool.query(
        `UPDATE graph_entity SET parl_member_id = NULL, key_source = 'name-match', confidence = $2
          WHERE id = $1`, [r.id, UNKEYED_CONFIDENCE])
    }
    // Read it back rather than trusting the write.
    const { rows: after } = await pool.query<{ n: string }>(`
      WITH shared AS (SELECT surface_norm FROM graph_member_name GROUP BY 1 HAVING COUNT(DISTINCT mnis_id) > 1)
      SELECT COUNT(*)::text n FROM graph_entity e JOIN shared s ON s.surface_norm = e.name_norm
      WHERE e.kind='person' AND e.parl_member_id IS NOT NULL AND e.key_source='name-match'`)
    console.log(`\n  applied · ${rows.length} logged to graph_merge_log and cleared · ${after[0].n} remain (expected 0)`)
    if (after[0].n !== '0') console.log(`  ⚠ MISMATCH — read back ${after[0].n}, expected 0`)

    const { rows: [keyed] } = await pool.query<{ n: string; nm: string }>(`
      SELECT COUNT(*) FILTER (WHERE parl_member_id IS NOT NULL)::text n,
             COUNT(*) FILTER (WHERE parl_member_id IS NOT NULL AND key_source='name-match')::text nm
      FROM graph_entity WHERE kind='person'`)
    console.log(`  people carrying a member id: ${keyed.n} (${keyed.nm} of them by name match, down from 788)`)
  } finally { await endNeonPool() }
}
if (require.main === module) main().catch((e) => { console.error('[fix-ambiguous-matches] FATAL', e instanceof Error ? e.message : e); process.exit(1) })
