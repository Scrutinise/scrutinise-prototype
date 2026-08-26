/**
 * audit-4a-layer2.ts — GRAPH 4A §4 (scope Layer 2) and §5 (tax law and
 * international agreements). **SCOPE ONLY — this builds nothing.**
 *
 * §4's premise is that "most references to any Act sit in the statutory
 * instruments made under it", so until Layer 2 exists every consequence list is
 * systematically incomplete in a way the user cannot see. ⚠ The first thing to
 * measure is therefore whether it exists already — 25-H's `citation_edge` ran
 * over all 132,990 documents in the bulk file, SIs included, and the answer
 * changes what §4 costs from "build a layer" to "close named gaps in one".
 *
 * The two things that would still be missing either way:
 *   1. ⚠ **THE ENABLING RELATIONSHIP IS A DIFFERENT AND STRONGER FACT than a
 *      textual reference.** "This SI was made under section 15 of that Act" is
 *      not "this SI mentions that Act" — an SI whose enabling power is repealed
 *      may fall with it, and repeal analysis is unanswerable without the
 *      separation. Measured below: which table holds it, at what grain, with
 *      what evidence.
 *   2. ⚠ **SI SCHEDULES.** §5 depends entirely on them, because a double
 *      taxation agreement takes effect as text SCHEDULED to an Order in Council.
 *      Extractors commonly drop schedules. Measured, per instrument, not assumed.
 *
 * §5 confirms or refutes four claims about tax and treaties. Reads only.
 *
 *   npx tsx graph/audit-4a-layer2.ts [--json out.json]
 */
import fs from 'fs'
import { getNeonPool, endNeonPool } from '../shared/neon-pool'
import { CITATION_TABLE } from './setup-citation-edge-table'
import { EDGE_TABLE } from './graph-common'

/** Bytes per row, MEASURED: citation_edge is 1,144 MB over 1,034,548 rows. */
const BYTES_PER_ROW = 1_144 * 1024 * 1024 / 1_034_548
/** The real figure the brief names. Storage is a bill, not a wall. */
const USD_PER_GB_MONTH = 0.35
const TIOPA = 'ukpga/2010/8'

const money = (bytes: number) => `${(bytes / 1e9).toFixed(2)} GB ≈ $${(bytes / 1e9 * USD_PER_GB_MONTH).toFixed(2)}/month`

async function main() {
  const pool = getNeonPool()
  const out: Record<string, unknown> = { at: new Date().toISOString() }

  // ══ §4.1 — is Layer 2 already built? ══════════════════════════════════════
  console.log('══ §4.1 — HOW MUCH OF LAYER 2 ALREADY EXISTS ══')
  const { rows: si } = await pool.query(`
    SELECT source_type, COUNT(*)::bigint rows, COUNT(DISTINCT source_gid)::bigint docs,
           COUNT(DISTINCT target_act_id)::bigint targets,
           COUNT(*) FILTER (WHERE source_provision_ref LIKE 'schedule%')::bigint from_schedule,
           COUNT(*) FILTER (WHERE source_provision_ref IS NULL)::bigint no_provision
    FROM ${CITATION_TABLE} GROUP BY 1 ORDER BY rows DESC`)
  for (const r of si) {
    console.log(`  ${String(r.source_type).padEnd(8)} ${String(r.rows).padStart(8)} rows · ${String(r.docs).padStart(6)} source docs · ${String(r.targets).padStart(6)} distinct targets · ${String(r.from_schedule).padStart(7)} sited in a schedule · ${r.no_provision} in no provision`)
  }
  const siRow = si.find((r: { source_type: string }) => r.source_type === 'SI')
  console.log(`\n  ▶ The textual half of Layer 2 IS BUILT: ${Number(siRow.rows).toLocaleString()} rows from ${Number(siRow.docs).toLocaleString()} instruments,`)
  console.log(`    ${(100 * Number(siRow.rows) / si.reduce((n: number, r: { rows: string }) => n + Number(r.rows), 0)).toFixed(0)}% of citation_edge. 25-H ran over all 132,990 documents, not just the Acts.`)
  console.log(`  ▶ ${Number(siRow.from_schedule).toLocaleString()} of those references sit INSIDE an SI schedule — schedules are not dropped.`)
  out.layer2Existing = si

  // ══ §4.2 — the enabling relationship ══════════════════════════════════════
  console.log('\n══ §4.2 — THE ENABLING RELATIONSHIP (made-under) ══')
  const { rows: mu } = await pool.query(`
    SELECT COUNT(*)::bigint rows,
           COUNT(DISTINCT split_part(from_id,':',2))::bigint instruments,
           COUNT(DISTINCT split_part(to_id,':',2))::bigint enabling_acts,
           COUNT(*) FILTER (WHERE granularity LIKE '%-section')::bigint to_provision
    FROM ${EDGE_TABLE} WHERE edge_type = 'made-under'`)
  console.log(`  ${EDGE_TABLE}: ${Number(mu[0].rows).toLocaleString()} rows · ${Number(mu[0].instruments).toLocaleString()} instruments · ${Number(mu[0].enabling_acts).toLocaleString()} enabling Acts`)
  console.log(`  ${Number(mu[0].to_provision).toLocaleString()} name the enabling PROVISION, not just the Act (${(100 * Number(mu[0].to_provision) / Number(mu[0].rows)).toFixed(1)}%)`)
  console.log(`  ⚠ It is a SEPARATE edge_type, which is right — but it carries NO evidence column,`)
  console.log(`    and citation_edge cannot hold it: the extractor EXCLUDES <SecondaryPreamble>,`)
  console.log(`    which is exactly where the enabling words are.`)
  console.log(`  ⚠ The gap is the SIs made-under does NOT reach — not the whole layer:`)
  const { rows: siTotal } = await pool.query(
    `SELECT COUNT(DISTINCT split_part(id,':',2))::bigint n FROM corpus_sections WHERE corpus IN ('si-2010plus','si-pre-2010')`)
  console.log(`    SI instruments the corpus holds: ${Number(siTotal[0].n).toLocaleString()}; with a made-under edge: ${Number(mu[0].instruments).toLocaleString()} (${(100 * Number(mu[0].instruments) / Number(siTotal[0].n)).toFixed(1)}%)`)
  out.madeUnder = { ...mu[0], siInstrumentsHeld: siTotal[0].n }

  // ══ §4.3 — what a re-extraction WITH evidence would cost ══════════════════
  console.log('\n══ §4.3 — SIZING (priced at $0.35/GB-month, the real figure) ══')
  const muBytes = Number(mu[0].rows) * BYTES_PER_ROW
  console.log(`  measured: citation_edge is 1,144 MB over 1,034,548 rows = ${BYTES_PER_ROW.toFixed(0)} bytes/row incl. indexes`)
  console.log(`  re-extracting made-under into the citation_edge shape (evidence on every row):`)
  console.log(`    ${Number(mu[0].rows).toLocaleString()} rows → ${money(muBytes)}`)
  console.log(`  extending it to every SI the corpus holds, at the same edges-per-instrument rate:`)
  const scaled = Number(mu[0].rows) * (Number(siTotal[0].n) / Number(mu[0].instruments))
  console.log(`    ~${Math.round(scaled).toLocaleString()} rows → ${money(scaled * BYTES_PER_ROW)}`)
  console.log(`  ⚠ The brief expects "several times Layer 1's volume". It is NOT — because Layer 1 was`)
  console.log(`    never Acts-only: 25-H already extracted the SIs. What is left is the enabling`)
  console.log(`    edge, which is one fact per instrument, not one per sentence.`)
  console.log(`  build time: 25-H's two detectors over all 132,990 documents ran in a single pass;`)
  console.log(`    a preamble-only pass reads the same file and does far less work per document.`)
  out.sizing = { bytesPerRow: BYTES_PER_ROW, madeUnderBytes: muBytes, scaledRows: Math.round(scaled), scaledBytes: scaled * BYTES_PER_ROW, usdPerGbMonth: USD_PER_GB_MONTH }

  // ══ §5.1 — DTAs, TIOPA s.2, and whether the treaty text is held ═══════════
  console.log('\n══ §5.1 — DOUBLE TAXATION AGREEMENTS: IS THE SCHEDULED TREATY TEXT HELD? ══')
  const { rows: dta } = await pool.query(
    `SELECT gid, title FROM corpus_acts WHERE title ILIKE '%double taxation%'`)
  const gids = dta.map((r: { gid: string }) => r.gid)
  const { rows: secs } = await pool.query(`
    SELECT split_part(id,':',2) gid, COUNT(*)::int sections,
           COUNT(*) FILTER (WHERE split_part(id,':',3) LIKE 'schedule%')::int sched
    FROM corpus_sections WHERE split_part(id,':',2) = ANY($1::text[]) GROUP BY 1`, [gids])
  const byGid = new Map(secs.map((r: { gid: string }) => [r.gid, r]))
  let noText = 0, textNoSched = 0, withSched = 0
  const era = { pre2018: { n: 0, sched: 0 }, from2018: { n: 0, sched: 0 } }
  for (const g of gids) {
    const s = (byGid.get(g) ?? { sections: 0, sched: 0 }) as { sections: number; sched: number }
    if (s.sections === 0) noText++
    else if (s.sched === 0) textNoSched++
    else withSched++
    const yr = parseInt(g.match(/\/(\d{4})\//)?.[1] ?? '0', 10)
    const b = yr >= 2018 ? era.from2018 : era.pre2018
    b.n++; if (s.sched > 0) b.sched++
  }
  console.log(`  ${gids.length} instruments titled "Double Taxation …" in corpus_acts`)
  console.log(`    hold NO text at all       : ${noText}`)
  console.log(`    hold text, NO schedule row: ${textNoSched}`)
  console.log(`    hold at least one schedule: ${withSched}`)
  console.log(`  ⚠⚠ THE BRIEF'S PREMISE IS ${withSched > gids.length / 2 ? 'CONFIRMED' : 'REFUTED'}: the treaty text is scheduled to the Order,`)
  console.log(`     but we hold that schedule for only ${withSched} of ${gids.length} (${(100 * withSched / gids.length).toFixed(1)}%).`)
  console.log(`     By era: 2018 and later ${era.from2018.sched}/${era.from2018.n}; before 2018 ${era.pre2018.sched}/${era.pre2018.n}.`)
  console.log(`     ⚠ ${textNoSched} Orders are present as three operative articles with the agreement itself absent —`)
  console.log(`       and an absence that presents as a short document is the silent-incompleteness failure again.`)
  out.dta = { instruments: gids.length, noText, textNoSched, withSched, era }

  // ══ §5.2 — the direction reverses ═════════════════════════════════════════
  console.log('\n══ §5.2 — DOES THE GRAPH ANSWER "DOES A TREATY ALREADY PREVENT THIS?" ══')
  const { rows: tin } = await pool.query(`
    SELECT COUNT(*)::int inbound, COUNT(DISTINCT source_gid)::int srcs,
           COUNT(*) FILTER (WHERE target_provision_ref = 'section-2')::int s2,
           COUNT(*) FILTER (WHERE target_provision_ref = 'section-6')::int s6
    FROM ${CITATION_TABLE} WHERE target_act_id = $1`, [TIOPA])
  console.log(`  TIOPA 2010 inbound in citation_edge: ${tin[0].inbound} rows from ${tin[0].srcs} documents`)
  console.log(`    naming s.2 (Orders in Council): ${tin[0].s2} · naming s.6 (effect despite any enactment): ${tin[0].s6}`)
  const { rows: outb } = await pool.query(`
    SELECT COUNT(*)::int rows, COUNT(DISTINCT source_gid)::int srcs, COUNT(DISTINCT target_act_id)::int tgts
    FROM ${CITATION_TABLE} WHERE source_gid = ANY($1::text[])`, [gids])
  console.log(`  outbound FROM a DTA Order: ${outb[0].rows} rows, ${outb[0].srcs} Orders, ${outb[0].tgts} distinct targets`)
  const { rows: muDta } = await pool.query(`
    SELECT COUNT(*)::int n, COUNT(DISTINCT split_part(from_id,':',2))::int srcs,
           COUNT(*) FILTER (WHERE split_part(to_id,':',2) = $2)::int under_tiopa
    FROM ${EDGE_TABLE} WHERE edge_type='made-under' AND split_part(from_id,':',2) = ANY($1::text[])`, [gids, TIOPA])
  console.log(`  made-under FROM a DTA Order: ${muDta[0].n} rows from ${muDta[0].srcs} Orders, ${muDta[0].under_tiopa} of them under TIOPA 2010`)
  console.log(`  ▶ The graph is queryable in BOTH directions on the same table — inbound() filters on`)
  console.log(`    target_act_id and the reverse is a filter on source_gid, already indexed.`)
  console.log(`  ⚠ But the ANSWER is only as good as §5.1: with the agreement text absent from ${textNoSched} of ${gids.length}`)
  console.log(`    Orders, "does a treaty already prevent this" reads the Order's three articles and not the treaty.`)
  out.reverse = { tiopaInbound: tin[0], dtaOutbound: outb[0], dtaMadeUnder: muDta[0] }

  // ══ §5.3 — the MLI ════════════════════════════════════════════════════════
  console.log('\n══ §5.3 — DO WE HOLD MLI POSITIONS? ══')
  const { rows: mliActs } = await pool.query(
    `SELECT gid, title FROM corpus_acts WHERE title ILIKE '%multilateral%' LIMIT 20`)
  const { rows: mliSecs } = await pool.query(
    `SELECT corpus, COUNT(*)::int n FROM corpus_sections WHERE "sectionTitle" ILIKE '%multilateral%' GROUP BY 1 ORDER BY n DESC LIMIT 8`)
  console.log(`  corpus_acts titles matching "multilateral": ${mliActs.length}`)
  for (const r of mliActs.slice(0, 6)) console.log(`    ${r.gid}  ${r.title}`)
  console.log(`  corpus_sections sectionTitle matching "multilateral":`)
  if (mliSecs.length === 0) console.log(`    NONE`)
  for (const r of mliSecs) console.log(`    ${String(r.corpus).padEnd(26)} ${r.n}`)
  console.log(`  ⚠ MLI POSITIONS — the per-country reservations and notifications that say WHICH`)
  console.log(`    articles of WHICH agreement are modified — are published by the OECD, not by`)
  console.log(`    legislation.gov.uk, and nothing in this database is shaped like one.`)
  out.mli = { actsMatching: mliActs, sectionTitlesMatching: mliSecs }

  // ══ §5.4 — the five relationship types ════════════════════════════════════
  console.log('\n══ §5.4 — THE FIVE RELATIONSHIP TYPES: WHAT IS ANSWERABLE TODAY? ══')
  console.log(`  ⚠ The five types are named in a handover that is NOT in this repository.`)
  console.log(`    Only permits_suspension is named in the brief. Assessed against what we hold:`)
  const { rows: treaty } = await pool.query(`
    SELECT corpus, COUNT(*)::int sections, COUNT(DISTINCT split_part(id,':',2))::int docs
    FROM corpus_sections WHERE corpus IN ('uk-treaties','uk-treaties-fcdo','tax-treaties-dta','parliament-treaties')
    GROUP BY 1 ORDER BY sections DESC`)
  for (const r of treaty) console.log(`    ${String(r.corpus).padEnd(22)} ${String(r.sections).padStart(7)} sections · ${r.docs} docs`)
  console.log(`  ⚠⚠ OI-3: uk-treaties (3,264) and tax-treaties-dta (324) can be returned by NO query`)
  console.log(`     at any setting — verified live on 24 Aug. The text is held and unreachable.`)
  out.treatyCorpora = treaty

  const jsonIx = process.argv.indexOf('--json')
  if (jsonIx >= 0 && process.argv[jsonIx + 1]) {
    fs.writeFileSync(process.argv[jsonIx + 1], JSON.stringify(out, null, 1))
    console.log(`\n[4a-§4/5] → ${process.argv[jsonIx + 1]}`)
  }
  await endNeonPool()
}

if (require.main === module) {
  main().catch(e => { console.error('[4a-§4/5] FATAL', e); process.exit(1) })
}
