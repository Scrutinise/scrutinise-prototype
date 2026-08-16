/**
 * signal-behaviour.ts — AMENDMENT 2 §2, "behaviour is identity evidence".
 *
 * ════════════════════════════════════════════════════════════════════════════════════════════════
 * WHAT THIS COMPUTES, AND THE ONE THING IT REFUSES TO DO
 * ════════════════════════════════════════════════════════════════════════════════════════════════
 *
 * §2: *if two clusters sharing a name take consistently different positions, that is evidence they
 * are different people. If they take the same positions across the same questions, the distinction
 * may not matter for anything we report.* And: **splitting may be flagged; merging on behavioural
 * similarity is forbidden.**
 *
 * The signal is free in exactly the sense §2 claims — the positions are already the graph's content,
 * so this is a query, not a new source. `division_votes` holds 2,528,032 rows: the most concrete
 * position record we have.
 *
 * ⚠ THE CALIBRATION IS NOT OPTIONAL AND IS THE REASON THIS SCRIPT IS LONGER THAN THE QUERY.
 * "These two agree 96% of the time" reads as suggestive of identity until you know what two
 * DEFINITELY DIFFERENT people score. So the script measures that too, on random pairs drawn from
 * the same register, split same-party / cross-party. If same-party pairs of unrelated members also
 * score in the nineties — and they do — then `concordant` says nothing about identity, and the
 * amendment's ban on merging behaviourally is a measured conclusion rather than a caution.
 *
 * ════════════════════════════════════════════════════════════════════════════════════════════════
 * WHAT THE WORK LIST TURNED OUT TO BE — established by probe-amd2c BEFORE this was written
 * ════════════════════════════════════════════════════════════════════════════════════════════════
 *
 *   500 name clusters (one normalised surface, ≥2 MNIS ids), of which 99 have ≥2 members who voted
 *     80 episcopal sees   (74 testable)   ← "Bishop of Durham" is an OFFICE held in succession
 *    117 peerage titles   ( 4 testable)
 *    303 plain names      (21 testable)
 *
 * That changed the design. On an episcopal see the question is not "do they disagree" but "did they
 * ever sit at the same time" — successive holders of one title are different people for a reason
 * that has nothing to do with how they voted. So `disjoint-service` is a first-class finding and is
 * reported apart from `divergent`, because collapsing the two would credit a date range as though
 * it were a political disagreement.
 *
 * ⚠ AND A TRAP IN THE WORK LIST ITSELF, worth stating because the raw numbers look dramatic:
 * many "plain name" clusters are register SHORT FORMS, not names — `jones`, `david`, `brown` come
 * from the Lords address style and a Commons short form. Those pairs are not identity questions at
 * all: the register has already decided they are different people. What the signal says about them
 * is how DANGEROUS a name match on that surface would be, which is the second, useful half of §2.
 *
 * Usage (from scripts/ingest):
 *   npx tsx position-graph/signal-behaviour.ts --dry-run   # compute and print, write nothing
 *   npx tsx position-graph/signal-behaviour.ts             # compute, print, and persist
 */
import path from 'path'
try { require('dotenv').config({ path: path.join(__dirname, '../../../scrutinise-web/.env') }) } catch { /* ok */ }
import { getNeonPool, endNeonPool } from '../shared/neon-pool'

export {}

const argv = process.argv.slice(2)
const DRY = argv.includes('--dry-run')

const pool = getNeonPool()
const head = (s: string) => console.log(`\n════ ${s} ${'═'.repeat(Math.max(0, 74 - s.length))}`)

/**
 * The floor below which an agreement rate is not reported as one. 20 shared divisions is not a
 * tuned number and is not presented as one — it is the point below which a single whipped afternoon
 * dominates the score. Every row records `shared_divisions` so the floor can be re-argued from the
 * data rather than from this comment.
 */
const MIN_SHARED = 20
/** Bands. Deliberately WIDE, with the calibration printed beside them so a reader can disagree. */
const DIVERGENT_BELOW = 0.70
const CONCORDANT_AT_OR_ABOVE = 0.90
/** How many random pairs to score per cohort for the calibration. */
const BASELINE_PAIRS = 150
/** Divisions kept as evidence behind a `divergent` row. §5.1: no summary claim without a basis. */
const EVIDENCE_PER_SIGNAL = 6

type Vote = { house: string; divisionId: number; vote: string; date: string; party: string | null }

function classifyCluster(surfaceNorm: string): string {
  if (/(bishop|archbishop)/.test(surfaceNorm)) return 'episcopal see'
  if (/^(lord|lady|baroness|baron|earl|viscount|duke|marquess|countess)\b/.test(surfaceNorm)) return 'peerage title'
  return 'plain name'
}

/** Deterministic pseudo-random, seeded, so the baseline is reproducible run to run. */
function mulberry32(seed: number) {
  return function () {
    seed |= 0; seed = (seed + 0x6D2B79F5) | 0
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

function quantile(sorted: number[], p: number): number | null {
  if (!sorted.length) return null
  const i = (sorted.length - 1) * p
  const lo = Math.floor(i), hi = Math.ceil(i)
  return lo === hi ? sorted[lo] : sorted[lo] + (sorted[hi] - sorted[lo]) * (i - lo)
}

/** Shared divisions and agreement between two members' vote maps. */
function compare(a: Map<string, Vote>, b: Map<string, Vote>) {
  let shared = 0, agreed = 0
  const disagreements: Array<{ key: string; a: Vote; b: Vote }> = []
  const [small, large] = a.size <= b.size ? [a, b] : [b, a]
  for (const [key, va] of small) {
    const vb = large.get(key)
    if (!vb) continue
    shared++
    const first = a.get(key)!, second = b.get(key)!
    if (first.vote === second.vote) agreed++
    else disagreements.push({ key, a: first, b: second })
  }
  return { shared, agreed, disagreements }
}

async function main() {
  head('WHICH DATABASE')
  const { rows: [who] } = await pool.query(`SELECT current_database() AS db, current_user AS usr`)
  console.log(`  ${who.db} / ${who.usr}${DRY ? '   [--dry-run: nothing will be written]' : ''}`)

  // ── 1. the work list ────────────────────────────────────────────────────────────────────────
  head('1. NAME CLUSTERS — one normalised surface, several members in the register')
  const { rows: clusters } = await pool.query<{ surface_norm: string; ids: number[] }>(
    `SELECT surface_norm, ARRAY_AGG(DISTINCT mnis_id ORDER BY mnis_id) AS ids
       FROM graph_member_name GROUP BY 1 HAVING COUNT(DISTINCT mnis_id) > 1
      ORDER BY surface_norm`)
  const byClass = new Map<string, number>()
  for (const c of clusters) byClass.set(classifyCluster(c.surface_norm), (byClass.get(classifyCluster(c.surface_norm)) ?? 0) + 1)
  console.log(`  clusters ${clusters.length}`)
  for (const [k, v] of [...byClass].sort((x, y) => y[1] - x[1])) console.log(`    ${k.padEnd(16)} ${v}`)

  // ── 2. pull the votes ONCE for every member that appears in a cluster ───────────────────────
  // One query rather than one per pair: division_votes is 2.5M rows and a per-pair scan of it was
  // the first thing to blow the client timeout on this database.
  const clusterMembers = [...new Set(clusters.flatMap((c) => c.ids))]
  head(`2. VOTES for the ${clusterMembers.length} members named in a cluster`)
  const { rows: voteRows } = await pool.query<{
    member_id: number; house: string; division_id: number; vote: string; division_date: string; party: string | null
  }>(
    `SELECT member_id, house, division_id, vote, division_date::text AS division_date, party
       FROM division_votes WHERE member_id = ANY($1::int[]) AND vote IN ('aye','no')`,
    [clusterMembers])
  const votesByMember = new Map<number, Map<string, Vote>>()
  for (const r of voteRows) {
    let m = votesByMember.get(r.member_id)
    if (!m) { m = new Map(); votesByMember.set(r.member_id, m) }
    m.set(`${r.house}:${r.division_id}`, {
      house: r.house, divisionId: r.division_id, vote: r.vote, date: r.division_date, party: r.party,
    })
  }
  console.log(`  ${voteRows.length.toLocaleString()} aye/no votes across ${votesByMember.size} of ${clusterMembers.length} members`)

  const { rows: regRows } = await pool.query<{ mnis_id: number; name_display: string | null; latest_party: string | null }>(
    `SELECT mnis_id, name_display, latest_party FROM graph_member_register WHERE mnis_id = ANY($1::int[])`,
    [clusterMembers])
  const reg = new Map(regRows.map((r) => [r.mnis_id, r]))

  // ── 3. score every testable pair ────────────────────────────────────────────────────────────
  head('3. SCORING every pair a name match could confuse')
  type Row = {
    surface_norm: string; cluster_class: string; a: number; b: number
    shared: number; agreed: number; rate: number | null
    aFirst: string | null; aLast: string | null; bFirst: string | null; bLast: string | null
    overlapDays: number | null; finding: string; observation: string
    disagreements: Array<{ key: string; a: Vote; b: Vote }>
  }
  const rows: Row[] = []
  let clustersTestable = 0, clustersUntestable = 0

  for (const c of clusters) {
    const withVotes = c.ids.filter((id) => (votesByMember.get(id)?.size ?? 0) > 0)
    if (withVotes.length < 2) { clustersUntestable++; continue }
    clustersTestable++
    const cls = classifyCluster(c.surface_norm)
    for (let i = 0; i < withVotes.length; i++) {
      for (let j = i + 1; j < withVotes.length; j++) {
        const a = withVotes[i], b = withVotes[j]
        const va = votesByMember.get(a)!, vb = votesByMember.get(b)!
        const { shared, agreed, disagreements } = compare(va, vb)
        const rate = shared > 0 ? agreed / shared : null

        const aDates = [...va.values()].map((v) => v.date).sort()
        const bDates = [...vb.values()].map((v) => v.date).sort()
        const aFirst = aDates[0] ?? null, aLast = aDates[aDates.length - 1] ?? null
        const bFirst = bDates[0] ?? null, bLast = bDates[bDates.length - 1] ?? null
        // Overlap of the two VOTING ranges. Not the register's membership dates: the register
        // records only the LATEST membership (schema-2d2.sql), and 105 of these members sat in
        // both houses, so its start date would understate service for exactly the people this
        // test is about. A measured range beats a partially-recorded one.
        let overlapDays: number | null = null
        if (aFirst && aLast && bFirst && bLast) {
          const start = Math.max(Date.parse(aFirst), Date.parse(bFirst))
          const end = Math.min(Date.parse(aLast), Date.parse(bLast))
          overlapDays = Math.max(0, Math.round((end - start) / 86_400_000))
        }

        // ⚠ STRICTLY non-overlapping, not "overlapDays === 0". The overlap is clamped at zero, so
        // two members whose ranges touch on a single day — or who each voted once, on the same day,
        // in different divisions — would both score 0 and be labelled a succession when they sat at
        // the same time. `disjoint-service` is a claim about time and has to be tested on the
        // endpoints, not on a clamped difference.
        const strictlyDisjoint = !!(aLast && bFirst && aLast < bFirst) || !!(bLast && aFirst && bLast < aFirst)

        let finding: string
        if (shared === 0 && strictlyDisjoint) finding = 'disjoint-service'
        else if (shared < MIN_SHARED) finding = 'insufficient-evidence'
        else if (rate! < DIVERGENT_BELOW) finding = 'divergent'
        else if (rate! >= CONCORDANT_AT_OR_ABOVE) finding = 'concordant'
        else finding = 'mixed'

        const nameA = reg.get(a)?.name_display ?? String(a)
        const nameB = reg.get(b)?.name_display ?? String(b)
        const observation =
          finding === 'disjoint-service'
            ? `${nameA} (voting ${aFirst}→${aLast}) and ${nameB} (voting ${bFirst}→${bLast}) never voted in the same division and their voting periods do not overlap. The shared surface "${c.surface_norm}" is held in succession.`
            : shared === 0
              ? `${nameA} and ${nameB} share the surface "${c.surface_norm}" and their voting periods overlap by ${overlapDays} days, but they never both voted in the same division. Nothing is measurable from this.`
              : `${nameA} and ${nameB} both voted in ${shared} division${shared === 1 ? '' : 's'} and agreed in ${agreed} of them (${(100 * rate!).toFixed(1)}%).`

        rows.push({
          surface_norm: c.surface_norm, cluster_class: cls, a, b, shared, agreed, rate,
          aFirst, aLast, bFirst, bLast, overlapDays, finding, observation, disagreements,
        })
      }
    }
  }
  console.log(`  clusters testable ${clustersTestable}, untestable (fewer than two voting members) ${clustersUntestable}`)
  console.log(`  pairs scored      ${rows.length}`)
  const findingCounts = new Map<string, number>()
  for (const r of rows) findingCounts.set(r.finding, (findingCounts.get(r.finding) ?? 0) + 1)
  console.table([...findingCounts].sort((x, y) => y[1] - x[1]).map(([finding, n]) => ({ finding, n })))

  // ── 4. the calibration ──────────────────────────────────────────────────────────────────────
  head('4. CALIBRATION — what two DEFINITELY DIFFERENT members score')
  // A random sample of members, so pairs can be drawn within the sample without a second big pull.
  const rnd = mulberry32(20260816)
  const { rows: allMembers } = await pool.query<{ member_id: number }>(
    `SELECT DISTINCT member_id FROM division_votes WHERE vote IN ('aye','no') ORDER BY member_id`)
  const pool120 = [...allMembers.map((m) => m.member_id)]
  for (let i = pool120.length - 1; i > 0; i--) { const j = Math.floor(rnd() * (i + 1));[pool120[i], pool120[j]] = [pool120[j], pool120[i]] }
  const sample = pool120.slice(0, 140)
  const { rows: sVotes } = await pool.query<{ member_id: number; house: string; division_id: number; vote: string; party: string | null }>(
    `SELECT member_id, house, division_id, vote, party FROM division_votes
      WHERE member_id = ANY($1::int[]) AND vote IN ('aye','no')`, [sample])
  const sByMember = new Map<number, Map<string, Vote>>()
  const modalParty = new Map<number, string>()
  const partyTally = new Map<number, Map<string, number>>()
  for (const r of sVotes) {
    let m = sByMember.get(r.member_id)
    if (!m) { m = new Map(); sByMember.set(r.member_id, m) }
    m.set(`${r.house}:${r.division_id}`, { house: r.house, divisionId: r.division_id, vote: r.vote, date: '', party: r.party })
    if (r.party) {
      let t = partyTally.get(r.member_id); if (!t) { t = new Map(); partyTally.set(r.member_id, t) }
      t.set(r.party, (t.get(r.party) ?? 0) + 1)
    }
  }
  for (const [id, t] of partyTally) modalParty.set(id, [...t].sort((x, y) => y[1] - x[1])[0][0])

  const cohorts: Record<string, number[]> = { 'same-party': [], 'cross-party': [] }
  const cohortAttempts: Record<string, number> = { 'same-party': 0, 'cross-party': 0 }
  const ids = [...sByMember.keys()]
  for (let i = 0; i < ids.length && (cohorts['same-party'].length < BASELINE_PAIRS || cohorts['cross-party'].length < BASELINE_PAIRS); i++) {
    for (let j = i + 1; j < ids.length; j++) {
      const pa = modalParty.get(ids[i]), pb = modalParty.get(ids[j])
      if (!pa || !pb) continue
      const cohort = pa === pb ? 'same-party' : 'cross-party'
      if (cohorts[cohort].length >= BASELINE_PAIRS) continue
      cohortAttempts[cohort]++
      const { shared, agreed } = compare(sByMember.get(ids[i])!, sByMember.get(ids[j])!)
      if (shared >= MIN_SHARED) cohorts[cohort].push(agreed / shared)
    }
  }
  const baselines = Object.entries(cohorts).map(([cohort, vals]) => {
    const s = [...vals].sort((x, y) => x - y)
    return {
      cohort,
      pairs_sampled: cohortAttempts[cohort],
      pairs_scored: s.length,
      mean: s.length ? s.reduce((t, v) => t + v, 0) / s.length : null,
      p10: quantile(s, 0.1), median: quantile(s, 0.5), p90: quantile(s, 0.9),
    }
  })
  console.table(baselines.map((b) => ({
    cohort: b.cohort, sampled: b.pairs_sampled, scored: b.pairs_scored,
    mean: b.mean === null ? '—' : (100 * b.mean).toFixed(1) + '%',
    p10: b.p10 === null ? '—' : (100 * b.p10).toFixed(1) + '%',
    median: b.median === null ? '—' : (100 * b.median).toFixed(1) + '%',
    p90: b.p90 === null ? '—' : (100 * b.p90).toFixed(1) + '%',
  })))
  const sameMean = baselines.find((b) => b.cohort === 'same-party')?.mean ?? null
  if (sameMean !== null) {
    console.log(`\n  ⚠ READ THIS BEFORE READING ANY 'concordant' ROW. Random SAME-PARTY pairs of members`)
    console.log(`    who are definitely different people agree ${(100 * sameMean).toFixed(1)}% of the time. Agreement is`)
    console.log(`    therefore a party signal, not an identity signal, and §2's ban on merging`)
    console.log(`    behaviourally is a measured conclusion rather than a caution.`)
  }

  // ── 5. the interesting rows ─────────────────────────────────────────────────────────────────
  head('5. DIVERGENT — pairs that voted together often and disagreed')
  const divergent = rows.filter((r) => r.finding === 'divergent').sort((x, y) => x.rate! - y.rate!)
  console.table(divergent.slice(0, 15).map((r) => ({
    surface: r.surface_norm, class: r.cluster_class,
    a: reg.get(r.a)?.name_display ?? r.a, b: reg.get(r.b)?.name_display ?? r.b,
    shared: r.shared, agree: (100 * r.rate!).toFixed(1) + '%',
  })))
  head('5a. CONCORDANT — and why this is NOT evidence of identity; read §4 beside it')
  const concordant = rows.filter((r) => r.finding === 'concordant').sort((x, y) => y.rate! - x.rate!)
  console.table(concordant.map((r) => ({
    surface: r.surface_norm, class: r.cluster_class,
    a: `${reg.get(r.a)?.name_display ?? r.a} (${reg.get(r.a)?.latest_party ?? '—'})`,
    b: `${reg.get(r.b)?.name_display ?? r.b} (${reg.get(r.b)?.latest_party ?? '—'})`,
    shared: r.shared, agree: (100 * r.rate!).toFixed(1) + '%',
  })))

  head('5b. DISJOINT SERVICE — one surface, held in succession')
  const disjoint = rows.filter((r) => r.finding === 'disjoint-service')
  console.table(disjoint.slice(0, 15).map((r) => ({
    surface: r.surface_norm, class: r.cluster_class,
    a: `${reg.get(r.a)?.name_display ?? r.a} ${r.aFirst}→${r.aLast}`,
    b: `${reg.get(r.b)?.name_display ?? r.b} ${r.bFirst}→${r.bLast}`,
  })))

  // ── 6. persist ──────────────────────────────────────────────────────────────────────────────
  if (DRY) { head('--dry-run: nothing written'); await endNeonPool(); return }

  head('6. WRITING')
  const client = await pool.connect()
  try {
    await client.query('BEGIN')
    // Recompute-and-replace: this is a derived measurement, and a stale row from a previous corpus
    // state sitting beside a fresh one is the kind of quiet disagreement the whole graph avoids.
    await client.query(`DELETE FROM graph_identity_signal WHERE signal = 'behavioural-divergence'`)
    await client.query(`DELETE FROM graph_identity_baseline`)
    let written = 0, evidenceWritten = 0
    for (const r of rows) {
      const { rows: [ins] } = await client.query<{ id: string }>(
        `INSERT INTO graph_identity_signal
           (signal, surface_norm, member_a, member_b, name_a, name_b, party_a, party_b,
            shared_divisions, agreed, agreement_rate, service_overlap_days,
            a_first, a_last, b_first, b_last, finding, observation, cluster_class)
         VALUES ('behavioural-divergence',$1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18)
         RETURNING id`,
        [r.surface_norm, r.a, r.b, reg.get(r.a)?.name_display ?? null, reg.get(r.b)?.name_display ?? null,
         reg.get(r.a)?.latest_party ?? null, reg.get(r.b)?.latest_party ?? null,
         r.shared, r.agreed, r.rate, r.overlapDays, r.aFirst, r.aLast, r.bFirst, r.bLast,
         r.finding, r.observation, r.cluster_class])
      written++
      if (r.finding === 'divergent') {
        const keep = r.disagreements.slice(0, EVIDENCE_PER_SIGNAL)
        for (const d of keep) {
          await client.query(
            `INSERT INTO graph_identity_signal_evidence
               (signal_id, house, division_id, division_title, division_date, vote_a, vote_b)
             SELECT $1, $2, $3, dv.title, $4::date, $5, $6
               FROM divisions dv WHERE dv.house = $2 AND dv.division_id = $3
             ON CONFLICT DO NOTHING`,
            [ins.id, d.a.house, d.a.divisionId, d.a.date, d.a.vote, d.b.vote])
          evidenceWritten++
        }
      }
    }
    for (const b of baselines) {
      await client.query(
        `INSERT INTO graph_identity_baseline
           (cohort, pairs_sampled, pairs_scored, min_shared, mean_agreement, p10_agreement, median_agreement, p90_agreement)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8)`,
        [b.cohort, b.pairs_sampled, b.pairs_scored, MIN_SHARED, b.mean, b.p10, b.median, b.p90])
    }
    await client.query('COMMIT')
    console.log(`  signals ${written}, evidence rows ${evidenceWritten}, baselines ${baselines.length}`)
  } catch (e) {
    await client.query('ROLLBACK'); throw e
  } finally {
    client.release()
  }

  console.log('\n  ⚠ NOTHING WAS MERGED, SPLIT OR RESOLVED. These rows are evidence for a human, and')
  console.log('    graph_identity_signal has no column a resolution could be written into.')
  await endNeonPool()
}
main().catch((e) => { console.error('[signal-behaviour] FATAL', e instanceof Error ? e.message : e); process.exit(1) })
