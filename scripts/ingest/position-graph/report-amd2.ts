/**
 * report-amd2.ts — AMENDMENT 2 §6: the two halves, reported separately, never averaged.
 *
 * ════════════════════════════════════════════════════════════════════════════════════════════════
 * WHY THIS SCRIPT EXISTS RATHER THAN A COLUMN ADDED TO report.ts
 * ════════════════════════════════════════════════════════════════════════════════════════════════
 *
 * §6: *"2D-1 resolved 30.6% of entities on a stable key. That reads as poor, and for people it is —
 * 99.6% of person entities rest on a name match. For organisations it substantially understates the
 * position… So the two halves should be reported and treated separately, not averaged."*
 *
 * A single blended figure is not a rounding problem, it is a claim about a population that does not
 * exist. Organisations are usable now; people are not. Averaging them produces a number that is
 * wrong about both, and it is the number that has been quoted.
 *
 * ⚠ AND THE AMENDMENT'S OWN FIGURE IS NOW STALE IN THE GOOD DIRECTION, which is why this prints the
 * measurement rather than repeating it: §6 says 99.6% of people rest on a name match, from 2D-1.
 * 2D-2's member sweep moved keyed people from 438 to 2,603. The gap between the halves is still
 * twelve-fold and §6's argument is unaffected — but the number should come from the database.
 *
 * Usage (from scripts/ingest):  npx tsx position-graph/report-amd2.ts
 */
import path from 'path'
try { require('dotenv').config({ path: path.join(__dirname, '../../../scrutinise-web/.env') }) } catch { /* ok */ }
import { getNeonPool, endNeonPool } from '../shared/neon-pool'

export {}

const pool = getNeonPool()
const head = (s: string) => console.log(`\n════ ${s} ${'═'.repeat(Math.max(0, 74 - s.length))}`)
async function q(sql: string, params: unknown[] = []) { return (await pool.query(sql, params)).rows }
const pct = (n: number, d: number) => (d ? ((100 * n) / d).toFixed(1) + '%' : '—')

async function main() {
  head('AMENDMENT 2 — THE STATE OF THE GRAPH, BY HALF')
  const { rows: [who] } = await pool.query(`SELECT current_database() AS db`)
  console.log(`   ${who.db}`)

  // ── §6 ───────────────────────────────────────────────────────────────────────────────────────
  head('§6 — IDENTITY, PER HALF. These two lines are not averaged anywhere in this file.')
  const halves = await q(
    `SELECT kind,
            COUNT(*)::int AS entities,
            COUNT(*) FILTER (WHERE identity_tier='identified')::int   AS identified,
            COUNT(*) FILTER (WHERE identity_tier='probable')::int     AS probable,
            COUNT(*) FILTER (WHERE identity_tier='mention-only')::int AS mention_only
       FROM graph_entity_identity GROUP BY 1 ORDER BY 2 DESC`)
  console.table(halves.map((r: any) => ({
    half: r.kind,
    entities: r.entities,
    identified: `${r.identified} (${pct(r.identified, r.entities)})`,
    probable: `${r.probable} (${pct(r.probable, r.entities)})`,
    'mention only': `${r.mention_only} (${pct(r.mention_only, r.entities)})`,
  })))
  const person = halves.find((r: any) => r.kind === 'person') as any
  const org = halves.find((r: any) => r.kind === 'organisation') as any
  if (person && org) {
    const pRate = person.identified / person.entities, oRate = org.identified / org.entities
    console.log(`\n   organisations are identified at ${pct(org.identified, org.entities)}, people at ${pct(person.identified, person.entities)}`)
    console.log(`   — a factor of ${(oRate / pRate).toFixed(1)}. The blended figure is ${pct(person.identified + org.identified, person.entities + org.entities)},`)
    console.log(`     which describes neither half and is the number §6 asks us to stop quoting.`)
    console.log(`\n   ⚠ The reason is about LANGUAGE, not data quality: "Shelter" is Shelter, "Andrew Smith" is`)
    console.log(`     nobody in particular. A name match on an organisation is far stronger evidence than the`)
    console.log(`     same match on a person, so the two halves do not even mean the same thing at tier 2.`)
  }

  // ── §1 ───────────────────────────────────────────────────────────────────────────────────────
  head('§1 — WHAT THE OLD DISPLAY GATE WOULD HAVE COST, per half')
  const gate = await q(
    `SELECT i.kind,
            COUNT(DISTINCT m.entity_id)::int AS actors_with_a_mention,
            COUNT(DISTINCT m.entity_id) FILTER (WHERE m.identity_tier='identified')::int AS would_have_shown,
            COUNT(*)::bigint AS mentions,
            COUNT(*) FILTER (WHERE m.identity_tier='identified')::bigint AS mentions_would_have_shown
       FROM graph_mention m JOIN graph_entity_identity i ON i.entity_id = m.entity_id
      GROUP BY 1 ORDER BY 2 DESC`)
  console.table(gate.map((r: any) => ({
    half: r.kind,
    'actors with a mention': r.actors_with_a_mention,
    'shown under the old gate': `${r.would_have_shown} (${pct(r.would_have_shown, r.actors_with_a_mention)})`,
    'mentions': r.mentions,
    'mentions shown under the old gate': `${r.mentions_would_have_shown} (${pct(Number(r.mentions_would_have_shown), Number(r.mentions))})`,
  })))
  console.log(`\n   ⚠ Read the two columns in opposite directions. Gating on resolution hides most ACTORS`)
  console.log(`     and keeps most MENTIONS, because the 2.5M derived vote edges all sit on keyed MPs.`)
  console.log(`     A single "coverage" number would have said whichever of those the author preferred.`)

  head('§1b — the typical unresolved person, so "thin record" is a measurement')
  console.table(await q(
    `SELECT edges AS mentions_held, COUNT(*)::int AS people FROM (
       SELECT e.id, (SELECT COUNT(*) FROM graph_edge g WHERE g.subject_id=e.id)::int AS edges
         FROM graph_entity e
        WHERE e.kind='person' AND graph_identity_tier(e.key_source,e.confidence)='mention-only') x
      GROUP BY 1 ORDER BY 1 LIMIT 6`))
  console.log(`   Amendment 2 §1: "Three unresolved Andrew Robertses are three thin records — visibly`)
  console.log(`   thin, and harmless." Most of them are ONE appearance, which is exactly that.`)

  // ── §2 ───────────────────────────────────────────────────────────────────────────────────────
  head('§2 — THE BEHAVIOURAL SIGNAL, and the calibration that governs how it is read')
  console.table(await q(
    `SELECT finding, COUNT(*)::int AS pairs,
            COUNT(*) FILTER (WHERE cluster_class='episcopal see')::int AS episcopal,
            COUNT(*) FILTER (WHERE cluster_class='peerage title')::int AS peerage,
            COUNT(*) FILTER (WHERE cluster_class='plain name')::int AS plain_name
       FROM graph_identity_signal GROUP BY 1 ORDER BY 2 DESC`))
  console.table(await q(
    `SELECT cohort, pairs_scored::int AS scored,
            ROUND((100*mean_agreement)::numeric,1)::text || '%' AS mean,
            ROUND((100*p10_agreement)::numeric,1)::text || '%' AS p10,
            ROUND((100*p90_agreement)::numeric,1)::text || '%' AS p90
       FROM graph_identity_baseline ORDER BY cohort DESC`))

  head('§2b — the pairs a name match would MERGE INTO A FABRICATED ACTOR')
  console.table((await q(
    `SELECT surface_norm AS surface, name_a, party_a, name_b, party_b,
            shared_divisions AS shared,
            ROUND((100*agreement_rate)::numeric,1)::text || '%' AS agree
       FROM graph_identity_signal WHERE finding='divergent'
      ORDER BY agreement_rate LIMIT 10`)))
  console.log(`   These are the rows §2 is FOR. A matcher that folded "sharma" or "gerald" into one actor`)
  console.log(`   would produce a person who voted both ways on the same questions and looked twice as`)
  console.log(`   influential as either real member.`)

  head('§2c — and the pairs behaviour would WRONGLY endorse merging')
  console.table(await q(
    `SELECT surface_norm AS surface, name_a, party_a, name_b, party_b,
            shared_divisions AS shared,
            ROUND((100*agreement_rate)::numeric,1)::text || '%' AS agree
       FROM graph_identity_signal WHERE finding='concordant'
      ORDER BY agreement_rate DESC LIMIT 10`))
  console.log(`   ⚠ Every one of these is two demonstrably different people, and the first is two`)
  console.log(`   successive Archbishops of Canterbury with an IDENTICAL register display name and a`)
  console.log(`   perfect voting record together. Read beside the same-party baseline above, that is the`)
  console.log(`   measured reason §2 forbids merging on behavioural similarity.`)

  // ── the live risk this sprint found ─────────────────────────────────────────────────────────
  head('⚠ NAME MATCHES STANDING ON A SURFACE THE REGISTER SAYS BELONGS TO MORE THAN ONE MEMBER')
  const risky = await q(
    `SELECT e.id::text AS entity_id, e.canonical_name, e.name_norm, e.parl_member_id, e.confidence,
            (SELECT COUNT(DISTINCT m.mnis_id) FROM graph_member_name m WHERE m.surface_norm = e.name_norm)::int
              AS candidate_members,
            (SELECT STRING_AGG(DISTINCT r.name_display, ' | ') FROM graph_member_name m
               JOIN graph_member_register r ON r.mnis_id = m.mnis_id
              WHERE m.surface_norm = e.name_norm) AS candidates,
            (SELECT s.finding FROM graph_identity_signal s WHERE s.surface_norm = e.name_norm LIMIT 1)
              AS behavioural_finding
       FROM graph_entity e
      WHERE e.kind='person' AND e.key_source='name-match'
        AND (SELECT COUNT(DISTINCT m.mnis_id) FROM graph_member_name m WHERE m.surface_norm = e.name_norm) > 1
      ORDER BY candidate_members DESC, e.canonical_name`)
  console.table(risky)
  console.log(`   ${risky.length} of the 788 register name-matches were made against a surface the register`)
  console.log(`   itself says belongs to several members. NOT unmatched here — unmatching is a resolution`)
  console.log(`   and this sprint does not take those. Flagged for CC-GRAPH with the candidates attached.`)

  head('⚠ WHERE THOSE SURFACES COME FROM — the register\'s own short forms')
  console.table(await q(
    `SELECT source, COUNT(*)::int AS surfaces,
            COUNT(*) FILTER (WHERE surface_norm !~ ' ')::int AS single_word,
            ROUND(100.0*COUNT(*) FILTER (WHERE surface_norm !~ ' ')/COUNT(*), 1)::text || '%' AS pct_single_word
       FROM graph_member_name GROUP BY 1 ORDER BY 3 DESC`))
  console.log(`   MNIS's "address as" for a Commons member is frequently just the surname — "Mr Brown",`)
  console.log(`   "Sir Geoffrey". After honorific stripping those become the match surfaces "brown" and`)
  console.log(`   "geoffrey", which identify nobody. isUselessName() cannot catch them: they look like names.`)

  await endNeonPool()
}
main().catch((e) => { console.error('[report-amd2] FATAL', e instanceof Error ? e.message : e); process.exit(1) })
