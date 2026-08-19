/**
 * derive-signals.ts — GRAPH 3A §3.2–§3.5: every P0 signal that is NOT a vote.
 *
 * Votes are derived through `position_signal_vote` (see schema-3a.sql's header for why). Everything
 * else lands as a row in `position_signal_stored`:
 *
 *   §3.2  EDM signatures        direction +1 toward the motion, weight 0.6
 *   §3.3  amendment sponsorship direction 0, weight recorded but inert  → ⚠ NO SOURCE DATA (audit)
 *   §3.4  witness appearances   direction 0, weight 0.1
 *   §3.4  committee membership  direction 0, weight 0.1                 → ⚠ NO SOURCE DATA (audit)
 *   §3.5  declared interests    direction 0, weight 0.1, target = the organisation
 *
 * Idempotent: `ON CONFLICT DO NOTHING` against the natural key, so a re-run adds only what is new
 * and never duplicates. Nothing is ever updated or deleted — the signal layer is append-only
 * (design §2), and a correction is a new row with `superseded_by` set on the old one.
 *
 * PREDICT-MEASURE-COMPARE. Predictions are written below from the §1 audit's reads, BEFORE this
 * script was first run, and every one is printed against its measurement.
 *
 * ⚠ Where a prediction is an EDGE count and the measurement is an APPEARANCE count, the delta is
 * the point rather than an error: a body that gave evidence to one inquiry on three dates is one
 * edge and three appearances, and three dated appearances are three signals.
 *
 * Usage (from scripts/graph):
 *   npx tsx derive-signals.ts             # derive all available signal types
 *   npx tsx derive-signals.ts --dry-run   # count what WOULD be written, write nothing
 *   npx tsx derive-signals.ts --sample    # read 50 random signals back against their sources
 */
import path from 'path'
try { require('dotenv').config({ path: path.join(__dirname, '../../scrutinise-web/.env') }) } catch { /* ok */ }

import { getNeonPool, endNeonPool } from '../ingest/shared/neon-pool'
import { POSITION_CONFIG } from '../../scrutinise-web/lib/graph/position-config'

export {}

const argv = process.argv.slice(2)
const DRY = argv.includes('--dry-run')
const SAMPLE_ONLY = argv.includes('--sample')

const W = POSITION_CONFIG.weights

/** Written from the §1 audit reads, before the first run. */
const PREDICTIONS: Record<string, { n: number; basis: string }> = {
  edm_signature: {
    n: 59_925,
    basis: 'graph_signed_motion_edge row count — the 2D-2 view, primary sponsors only',
  },
  witness_appearance: {
    n: 162_733,
    basis: "graph_edge WHERE predicate='gave-evidence-to' — an EDGE count, so the measurement should come in HIGHER: 178,208 evidence rows exist, i.e. some actors appeared before one inquiry on more than one date",
  },
  declared_interest: {
    n: 1_505,
    basis: "graph_edge WHERE predicate='declared-interest' — 1,822 evidence rows, so again expect higher",
  },
}

interface Derivation {
  signalType: string
  sql: string
  /** Counted separately and reported: rows that exist at source and produce no signal, and why. */
  exclusionSql?: { label: string; sql: string }
}

const DERIVATIONS: Derivation[] = [
  // ── §3.2 EDM signatures ─────────────────────────────────────────────────────────────────────
  //
  // Direction +1 toward the EDM as target. NOT toward any wider idea: whether the motion's subject
  // supports or opposes some proposal is query-time synthesis, and the stored fact is only
  // "signed this motion" (brief §3.2, design §3 on `signed-motion`).
  //
  // ⚠ PRIMARY SPONSORS ONLY. 2D-2 recorded that 97.1% of the 2,125,547 signatures are still absent
  // from the corpus; the full signatory scrape is outstanding. The signal name does not say
  // "primary sponsor", so the report must, and 3B's ingest half is where the rest comes from.
  {
    signalType: 'edm_signature',
    sql: `
      INSERT INTO position_signal_stored
        (actor_id, target_type, target_id, signal_type, direction, raw_weight, derivation, evidence_ids, observed_at)
      SELECT m.subject_id, 'edm', m.object_ref, 'edm_signature', 1, ${W.edm_signature}::real,
             'primary-sponsor:v1', ARRAY[m.evidence_section_id]::text[], m.observed_on
        FROM graph_signed_motion_edge m
       WHERE m.observed_on IS NOT NULL
      ON CONFLICT (actor_id, target_type, target_id, signal_type, observed_at) DO NOTHING`,
    exclusionSql: {
      label: 'EDM sponsorships with no resolved entity, or no corpus section to show',
      sql: `SELECT ((SELECT COUNT(*) FROM edm_sponsor) - (SELECT COUNT(*) FROM graph_signed_motion_edge)) AS count`,
    },
  },

  // ── §3.4 witness appearances ────────────────────────────────────────────────────────────────
  //
  // Direction 0: giving evidence records attention, never a side. Design §5's own words — "attention,
  // not stance" — and it is why the confidence ceiling on direction-0 signals exists at all.
  //
  // One signal per dated APPEARANCE, not per edge: `observed_at` is the evidence row's date, so a
  // body that appeared before the same inquiry twice carries two dated signals and its evidence
  // drills to the right session each time.
  {
    signalType: 'witness_appearance',
    sql: `
      INSERT INTO position_signal_stored
        (actor_id, target_type, target_id, signal_type, direction, raw_weight, derivation, evidence_ids, observed_at)
      SELECT ge.subject_id, 'inquiry', ge.object_ref, 'witness_appearance', 0, ${W.witness_appearance}::real,
             NULL, ARRAY_AGG(DISTINCT ev.section_id), ev.observed_on
        FROM graph_edge ge
        JOIN graph_evidence ev ON ev.edge_id = ge.id
       WHERE ge.predicate = 'gave-evidence-to' AND ev.observed_on IS NOT NULL
       GROUP BY ge.subject_id, ge.object_ref, ev.observed_on
      ON CONFLICT (actor_id, target_type, target_id, signal_type, observed_at) DO NOTHING`,
    exclusionSql: {
      label: 'gave-evidence-to evidence rows with no date (cannot be a dated signal)',
      sql: `SELECT COUNT(*) AS count FROM graph_evidence ev JOIN graph_edge ge ON ge.id=ev.edge_id
             WHERE ge.predicate='gave-evidence-to' AND ev.observed_on IS NULL`,
    },
  },

  // ── §3.5 declared interests ─────────────────────────────────────────────────────────────────
  //
  // Direction 0 and target = the ORGANISATION, per brief §3.5. A declared interest is an alignment
  // prior, not a stance: it says an MP has a relationship with a body, and says nothing whatever
  // about whether they agree with it. The design is emphatic that this must never read as a
  // position, which is what direction 0 plus the 0.15 confidence ceiling together enforce.
  {
    signalType: 'declared_interest',
    sql: `
      INSERT INTO position_signal_stored
        (actor_id, target_type, target_id, signal_type, direction, raw_weight, derivation, evidence_ids, observed_at)
      SELECT ge.subject_id, 'organisation', ge.object_entity_id::text, 'declared_interest', 0,
             ${W.declared_interest}::real, NULL, ARRAY_AGG(DISTINCT ev.section_id), ev.observed_on
        FROM graph_edge ge
        JOIN graph_evidence ev ON ev.edge_id = ge.id
       WHERE ge.predicate = 'declared-interest'
         AND ge.object_entity_id IS NOT NULL
         AND ev.observed_on IS NOT NULL
       GROUP BY ge.subject_id, ge.object_entity_id, ev.observed_on
      ON CONFLICT (actor_id, target_type, target_id, signal_type, observed_at) DO NOTHING`,
    exclusionSql: {
      label: 'declared-interest edges whose organisation does not resolve to an entity (brief §3.5)',
      sql: `SELECT COUNT(*) AS count FROM graph_edge WHERE predicate='declared-interest' AND object_entity_id IS NULL`,
    },
  },
]

async function main() {
  const pool = getNeonPool()
  try {
    const host = /@([^/:?]+)/.exec(process.env.NEON_DATABASE_URL ?? '')?.[1] ?? '(unparsed)'
    if (!/ep-old-dust-aboxi69a/.test(host)) { console.error(`❌ not Neon production (${host}) — refusing`); process.exit(1) }
    console.log(`host ${host}`)

    if (SAMPLE_ONLY) { await sample(pool); return }

    console.log(`\n════ PREDICTIONS (written before this run) ════`)
    for (const [k, p] of Object.entries(PREDICTIONS)) {
      console.log(`  ${k.padEnd(20)} ${p.n.toLocaleString().padStart(9)}`)
      console.log(`      basis: ${p.basis}`)
    }

    console.log(`\n════ NOT DERIVABLE — reported, not silently skipped ════`)
    console.log(`  amendment_sponsorship  §3.3 — bills-api holds 6,574 publication PDFs in`)
    console.log(`                         corpus_sections and NO structured sponsorship or amendment`)
    console.log(`                         rows anywhere in the database. Nothing to derive from.`)
    console.log(`  committee_membership   §3.4 — graph_member_post holds 7,970 GOVERNMENT/OPPOSITION`)
    console.log(`                         posts; a search for committee memberships in it returns 165`)
    console.log(`                         rows, and every one is a Lords "Deputy Chairman of`)
    console.log(`                         Committees" office or a party NEC seat. Select-committee`)
    console.log(`                         membership is not held. Witness appearances ARE.`)

    for (const d of DERIVATIONS) {
      const before = await countOf(pool, d.signalType)
      const t0 = Date.now()
      let written = 0
      if (DRY) {
        // Count what the SELECT would produce, without writing. Wrap the INSERT's SELECT.
        const select = d.sql.slice(d.sql.indexOf('SELECT'), d.sql.indexOf('ON CONFLICT'))
        const { rows: [c] } = await pool.query<{ n: string }>(`SELECT COUNT(*)::text AS n FROM (${select}) x`)
        written = Number(c.n)
      } else {
        const r = await pool.query(d.sql)
        written = r.rowCount ?? 0
      }
      const after = DRY ? before + written : await countOf(pool, d.signalType)
      const p = PREDICTIONS[d.signalType]
      console.log(`\n──── ${d.signalType} ${DRY ? '(dry run)' : ''}  ${((Date.now() - t0) / 1000).toFixed(1)}s`)
      if (p) {
        const delta = after - p.n
        console.log(`  predicted ${p.n.toLocaleString().padStart(9)}   measured ${after.toLocaleString().padStart(9)}   ` +
          (delta === 0 ? '✓ exact' : `${delta > 0 ? '+' : ''}${delta.toLocaleString()} (${((100 * delta) / p.n).toFixed(1)}%)`))
      } else {
        console.log(`  measured ${after.toLocaleString()}`)
      }
      console.log(`  rows written this run: ${written.toLocaleString()}  (table held ${before.toLocaleString()} before)`)
      if (d.exclusionSql) {
        const { rows: [x] } = await pool.query<{ count: string }>(d.exclusionSql.sql)
        console.log(`  ⚠ EXCLUDED ${Number(x.count).toLocaleString()} — ${d.exclusionSql.label}`)
      }
    }

    if (DRY) { console.log('\n--dry-run: nothing written.'); return }

    console.log(`\n════ THE WHOLE SIGNAL LAYER (position_signal) ════`)
    const { rows: all } = await pool.query<{ storage: string; signal_type: string; direction: number; n: string }>(
      `SELECT storage, signal_type, direction, COUNT(*)::text AS n FROM position_signal
        GROUP BY 1,2,3 ORDER BY 4::bigint DESC`)
    let total = 0
    for (const r of all) {
      total += Number(r.n)
      console.log(`  ${r.storage.padEnd(8)} ${r.signal_type.padEnd(20)} dir ${String(r.direction).padStart(2)}  ${Number(r.n).toLocaleString().padStart(11)}`)
    }
    console.log(`  ${'TOTAL'.padEnd(30)}         ${total.toLocaleString().padStart(11)}`)

    // Invariants that the database enforces, read back rather than assumed.
    const { rows: [inv] } = await pool.query<{ no_evidence: string; undated: string; bad_weight: string }>(`
      SELECT (SELECT COUNT(*)::text FROM position_signal WHERE evidence_ids IS NULL OR array_length(evidence_ids,1) IS NULL) AS no_evidence,
             (SELECT COUNT(*)::text FROM position_signal WHERE observed_at IS NULL) AS undated,
             (SELECT COUNT(*)::text FROM position_signal WHERE raw_weight IS NULL OR raw_weight <= 0) AS bad_weight`)
    console.log(`\n  signals with no evidence: ${inv.no_evidence}   undated: ${inv.undated}   with no weight: ${inv.bad_weight}`)

    await sample(pool)
  } finally {
    await endNeonPool()
  }
}

async function countOf(pool: ReturnType<typeof getNeonPool>, signalType: string): Promise<number> {
  const { rows: [c] } = await pool.query<{ n: string }>(
    `SELECT COUNT(*)::text AS n FROM position_signal_stored WHERE signal_type = $1`, [signalType])
  return Number(c.n)
}

/**
 * Brief §3: "verify totals by count AND by sampling 50 random signals read back against their
 * source rows by hand-checkable join, printed in the report."
 *
 * The join is done here in SQL rather than by eye: each row prints the signal beside the SOURCE row
 * it claims to come from, and a mismatch is marked. A sample that only printed the signal would
 * prove the signal exists, which was never in doubt.
 */
async function sample(pool: ReturnType<typeof getNeonPool>) {
  console.log(`\n════ 50 RANDOM SIGNALS, READ BACK AGAINST THEIR SOURCE ROWS ════`)

  // ⚠ STRATIFIED BY DERIVATION ON PURPOSE. A plain random draw of 20 votes returns 18 whipped
  // ones, because 89.6% of votes are whipped — so it would check the one class that needs checking
  // least and never look at a rebellion at all. Four of each class, and the interesting classes are
  // the ones a reader can argue with.
  console.log(`\n── 20 votes, four per derivation class (source: division_votes ⋈ divisions) ──`)
  const { rows: votes } = await pool.query<Record<string, string>>(`
    WITH picked AS (
      SELECT s.*, ROW_NUMBER() OVER (PARTITION BY s.derivation ORDER BY random()) AS rn
        FROM position_signal_vote s
       WHERE s.observed_at > '2015-01-01')
    SELECT s.signal_ref, s.direction::text, s.derivation, s.raw_weight::text, s.observed_at::text,
           v.vote AS source_vote, v.party AS source_party, v.division_date::text AS source_date,
           p.majority_side AS source_party_majority, ROUND(p.cohesion::numeric,3)::text AS source_cohesion,
           left(d.title, 52) AS division,
           (SELECT COUNT(*)::text FROM corpus_sections c WHERE c.id = s.evidence_ids[1]) AS evidence_exists
      FROM picked s
      JOIN graph_entity e ON e.id = s.actor_id
      JOIN division_votes v ON v.house = split_part(s.target_id, ':', 1)
                           AND v.division_id = split_part(s.target_id, ':', 2)::int
                           AND v.member_id = e.parl_member_id
      JOIN divisions d ON d.house = v.house AND d.division_id = v.division_id
      LEFT JOIN position_division_party p ON p.house=v.house AND p.division_id=v.division_id AND p.party=v.party
     WHERE s.rn <= 4
     ORDER BY s.derivation, s.signal_ref`)
  let bad = 0
  for (const r of votes) {
    const dirOk = (r.source_vote === 'aye' && r.direction === '1') || (r.source_vote === 'no' && r.direction === '-1')
    const dateOk = r.observed_at === r.source_date
    const evOk = r.evidence_exists === '1'
    const ok = dirOk && dateOk && evOk
    if (!ok) bad++
    console.log(`  ${ok ? '✓' : '✗'} ${r.signal_ref.padEnd(26)} ${r.source_vote.padEnd(4)}→dir ${r.direction.padStart(2)} w${r.raw_weight}  ${r.derivation.padEnd(28)} ${r.observed_at}  ${(r.source_party ?? '').slice(0, 18).padEnd(18)} party-maj ${(r.source_party_majority ?? '—').padEnd(4)} coh ${(r.source_cohesion ?? '—').padStart(5)}  ev ${evOk ? 'ok' : 'MISSING'}  ${r.division}`)
  }

  console.log(`\n── 15 EDM signatures (source: edm_sponsor) ──`)
  const { rows: edms } = await pool.query<Record<string, string>>(`
    SELECT s.id::text, s.target_id, s.direction::text, s.raw_weight::text, s.observed_at::text,
           es.sponsor_name AS source_sponsor, es.date_tabled::text AS source_date, es.uin,
           e.canonical_name AS actor,
           (SELECT COUNT(*)::text FROM corpus_sections c WHERE c.id = s.evidence_ids[1]) AS evidence_exists
      FROM position_signal_stored s
      JOIN graph_entity e ON e.id = s.actor_id
      JOIN edm_sponsor es ON es.motion_id = s.target_id::int
     WHERE s.signal_type = 'edm_signature'
     ORDER BY random() LIMIT 15`)
  for (const r of edms) {
    const ok = r.observed_at === r.source_date && r.evidence_exists === '1' && r.direction === '1'
    if (!ok) bad++
    console.log(`  ${ok ? '✓' : '✗'} EDM ${r.target_id.padStart(7)} ${(r.uin ?? '').padEnd(6)} ${r.observed_at}  dir ${r.direction} w${r.raw_weight}  actor "${(r.actor ?? '').slice(0, 26)}" vs source "${(r.source_sponsor ?? '').slice(0, 26)}"  ev ${r.evidence_exists === '1' ? 'ok' : 'MISSING'}`)
  }

  console.log(`\n── 10 witness appearances (source: graph_edge ⋈ graph_evidence) ──`)
  const { rows: wit } = await pool.query<Record<string, string>>(`
    SELECT s.id::text, s.target_id, s.direction::text, s.raw_weight::text, s.observed_at::text,
           e.canonical_name AS actor, left(ge.object_label, 48) AS inquiry,
           (SELECT COUNT(*)::text FROM graph_evidence ev2
             WHERE ev2.edge_id = ge.id AND ev2.observed_on = s.observed_at) AS source_rows
      FROM position_signal_stored s
      JOIN graph_entity e ON e.id = s.actor_id
      JOIN graph_edge ge ON ge.subject_id = s.actor_id AND ge.predicate='gave-evidence-to'
                        AND ge.object_ref = s.target_id
     WHERE s.signal_type = 'witness_appearance'
     ORDER BY random() LIMIT 10`)
  for (const r of wit) {
    const ok = Number(r.source_rows) >= 1 && r.direction === '0'
    if (!ok) bad++
    console.log(`  ${ok ? '✓' : '✗'} inquiry ${r.target_id.padStart(6)} ${r.observed_at} dir ${r.direction} w${r.raw_weight}  ${(r.actor ?? '').slice(0, 30).padEnd(30)} ${r.source_rows} source rows  ${r.inquiry}`)
  }

  console.log(`\n── 5 declared interests (source: graph_edge ⋈ graph_entity) ──`)
  const { rows: ints } = await pool.query<Record<string, string>>(`
    SELECT s.id::text, s.target_id, s.direction::text, s.observed_at::text,
           p.canonical_name AS person, o.canonical_name AS org, o.key_source
      FROM position_signal_stored s
      JOIN graph_entity p ON p.id = s.actor_id
      JOIN graph_entity o ON o.id = s.target_id::bigint
     WHERE s.signal_type = 'declared_interest'
     ORDER BY random() LIMIT 5`)
  for (const r of ints) {
    const ok = r.direction === '0' && !!r.org
    if (!ok) bad++
    console.log(`  ${ok ? '✓' : '✗'} ${r.observed_at} dir ${r.direction}  ${(r.person ?? '').slice(0, 24).padEnd(24)} → ${(r.org ?? '').slice(0, 40).padEnd(40)} (${r.key_source})`)
  }

  console.log(`\n  ${bad === 0 ? '✓' : '❌'} ${bad} of 50 sampled signals disagreed with their source row.`)
}

if (require.main === module) {
  main().catch((e) => { console.error('[derive-signals] FATAL', e instanceof Error ? e.message : e); process.exit(1) })
}
