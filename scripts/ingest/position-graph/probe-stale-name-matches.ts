/**
 * probe-stale-name-matches.ts — the hand-check's finding, generalised and counted.
 *
 * §5's hand-check examined the merge I had flagged as this sprint's riskiest and found it probably
 * wrong. Entity #43723 now carries MNIS 565 (Lord Morris of Aberavon) and these four surfaces:
 *
 *     "Dr John Morris"                            [committees-written]
 *     "Mr John Morris"                            [committees-written]
 *     "Rt Hon Lord Morris of Aberavon"            [committees-written]   ← merged in by 2D-2
 *     "Rt Hon the Lord Morris of Aberavon KG QC"  [committees-oral]      ← merged in by 2D-2
 *
 * The register says MNIS 565 was **"Sir John Morris" until 2001-07-02** and "Lord Morris of
 * Aberavon" after. The entity is active **2015–2019**. So the match was made on a name form the
 * member had stopped using fourteen years before the entity did anything — and when he DID give
 * evidence in that window he was recorded as "Lord Morris of Aberavon", on the two separate entities
 * that were then merged in. The most likely reading is that "Dr John Morris" is a different person
 * whose name merely normalises the same, and that the resolution fused two people.
 *
 * ⚠ THIS IS NOT THE TENURE TEST COMING BACK. That test asked "was the member still in Parliament",
 * which says nothing about identity — a former MP gives evidence all the time. This asks a different
 * and sharper question: **was the member still CALLED that?** A document dated 2015 that says
 * "John Morris" is weak evidence for a man who had been Lord Morris of Aberavon since 2001.
 *
 * ⚠⚠ AND THE GENERALISATION FAILED. THAT IS THE RESULT, AND IT IS RECORDED SO NOBODY BUILDS A
 * SCREEN ON IT.
 *
 * Run over all 788 register name-matched entities, **102 (13%) show the same pattern** — and the
 * list is full of matches the hand-check independently PROVED correct:
 *
 *     #21140 "Mrs Theresa May"          MNIS 8    12.5-year gap  ← verified correct, 3/3 divisions
 *     #68735 "Rt Hon Kenneth Clarke Mp" MNIS 366  29.9-year gap  ← obviously correct
 *     #36713 "Lord Norman Tebbit"       MNIS 952  28.5-year gap  ← obviously correct
 *
 * The cause: `nameHistory` end dates track changes of STYLE (an honorific, a title), not the point
 * at which people stopped using a name. "Mrs Theresa May" ends in 2003 and she was still Theresa May
 * for twenty more years. So a stale-name gap is the normal condition of this data and carries almost
 * no signal about identity. **This screen is not worth building.**
 *
 * What survives is narrower and stands on its own evidence: #43723 is doubtful because it carries
 * the surface "Dr John Morris", and the register records no doctorate for MNIS 565 at any point —
 * not because the gap is 13.7 years, which Theresa May's is too.
 *
 * Usage (from scripts/ingest):  npx tsx position-graph/probe-stale-name-matches.ts
 */
import path from 'path'
try { require('dotenv').config({ path: path.join(__dirname, '../../../scrutinise-web/.env') }) } catch { /* ok */ }
import { getNeonPool, endNeonPool } from '../shared/neon-pool'
export {}

const pool = getNeonPool()
const head = (s: string) => console.log(`\n════ ${s} ${'═'.repeat(Math.max(0, 78 - s.length))}`)

async function main() {
  head('NAME-MATCHED ENTITIES WHOSE MATCHED NAME WAS OUT OF DATE')

  // For each register-name-matched entity, find the name forms of its member that its own
  // normalised name could have matched, and ask when the member last used one.
  const { rows } = await pool.query(`
    WITH matched AS (
      SELECT e.id, e.canonical_name, e.name_norm, e.parl_member_id AS mnis,
             e.first_seen, e.last_seen
        FROM graph_entity e
       WHERE e.kind='person' AND e.key_source='name-match' AND e.parl_member_id IS NOT NULL),
    hits AS (
      SELECT m.*, MAX(n.end_date) AS name_last_used,
             COUNT(*) FILTER (WHERE n.end_date IS NULL) AS still_current
        FROM matched m
        JOIN graph_member_name n
          ON n.mnis_id = m.mnis AND n.source='name-history'
         AND regexp_replace(regexp_replace(lower(n.surface), '[^a-z0-9 ]', ' ', 'g'), '\\s+', ' ', 'g') LIKE '%' || m.name_norm || '%'
       GROUP BY m.id, m.canonical_name, m.name_norm, m.mnis, m.first_seen, m.last_seen)
    SELECT * FROM hits
     WHERE still_current = 0 AND name_last_used IS NOT NULL AND first_seen > name_last_used
     ORDER BY (first_seen - name_last_used) DESC`)

  console.log(`   ${rows.length} of the register name-matched entities were matched on a name form the`)
  console.log(`   member had ALREADY STOPPED USING before the entity was first active.`)
  console.log(`   ⚠⚠ AND THIS TURNS OUT NOT TO BE A USABLE SIGNAL. Read the list: it contains matches`)
  console.log(`      the hand-check proved correct (Theresa May, Kenneth Clarke, Norman Tebbit).`)
  console.log(`      nameHistory end dates track a change of STYLE, not of name-in-use. Nothing is`)
  console.log(`      un-resolved here and no screen should be built on this.\n`)
  const day = (v: any) => (v ? new Date(v).toISOString().slice(0, 10) : '—')
  for (const r of rows.slice(0, 40)) {
    const gapYears = ((new Date(r.first_seen).getTime() - new Date(r.name_last_used).getTime()) / (365.25 * 864e5)).toFixed(1)
    console.log(`   #${r.id} "${r.canonical_name}"  MNIS ${r.mnis}`)
    console.log(`      name last used ${day(r.name_last_used)} · entity active from ${day(r.first_seen)} — a ${gapYears}-year gap`)
  }
  if (rows.length > 40) console.log(`   … and ${rows.length - 40} more`)

  head('THE ONE THE HAND-CHECK FOUND')
  const { rows: ex } = await pool.query(
    `SELECT a.surface, a.source FROM graph_alias a WHERE a.entity_id = (
       SELECT id FROM graph_entity WHERE parl_member_id = 565 AND kind='person') ORDER BY a.source, a.surface`)
  console.table(ex)
  console.log(`   ⚠ Two of those surfaces name a peer and two name a bare "John Morris". The register`)
  console.log(`     never records a doctorate for MNIS 565. Treat this entity as suspect.`)
  await endNeonPool()
}
main().catch((e) => { console.error('FATAL', e instanceof Error ? e.message : e); process.exit(1) })
