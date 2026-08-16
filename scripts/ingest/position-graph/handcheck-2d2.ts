/**
 * handcheck-2d2.ts — BRIEF_GRAPH_2D2 §5: "Three MPs read by hand… confirm the graph says nothing
 * obviously wrong about them. If it does, the counts are decoration."
 *
 * 2D-1 did this with organisations and the brief says it was worth more than any of the totals, so
 * this is not a formality. Three people are chosen to put pressure on the three things most likely
 * to be wrong, rather than three that would look good:
 *
 *   MNIS 8    Theresa May / Baroness May of Maidenhead — sat in BOTH houses. If the identity work
 *             is wrong, she is two actors, and her Lords votes are attributed to nobody.
 *   MNIS 565  John Morris / Lord Morris of Aberavon — the riskiest MERGE this sprint performed.
 *             Two Lord Morris entities were folded into an entity whose canonical name is
 *             "Dr John Morris", a committee witness. If that witness is a different person, this
 *             merge contaminated a keyed actor, which is the invisible direction the design rules
 *             out. It is here precisely because it is the one I am least sure of.
 *   MNIS 4131 Jim Shannon — the highest-volume EDM sponsor in the corpus (934 motions). If
 *             `signed-motion` is wrong anywhere it will be loudest here.
 *
 * Each is checked three ways: internal consistency that CAN fail, a re-fetch of a real division
 * from votes.parliament.uk compared field by field against what we stored, and a printed public URL
 * so Charlie can look at the same thing without taking my word for it.
 *
 * Usage (from scripts/ingest):  npx tsx position-graph/handcheck-2d2.ts [mnis...]
 */
import path from 'path'
try { require('dotenv').config({ path: path.join(__dirname, '../../../scrutinise-web/.env') }) } catch { /* ok */ }
import { getNeonPool, endNeonPool } from '../shared/neon-pool'

export {}

const ARGS = process.argv.slice(2).map(Number).filter((n) => Number.isFinite(n) && n > 0)
const SUBJECTS = ARGS.length ? ARGS : [8, 565, 4131]
const UA = 'Scrutinise-Ingest/1.0 (+https://scrutinise.org; contact cl@scrutinise.org)'
const pool = getNeonPool()
const head = (s: string) => console.log(`\n${'═'.repeat(96)}\n  ${s}\n${'═'.repeat(96)}`)
let problems = 0

async function getJson(url: string): Promise<any | null> {
  try {
    const r = await fetch(url, { headers: { Accept: 'application/json', 'User-Agent': UA } })
    if (!r.ok) { console.log(`     HTTP ${r.status} ${url}`); return null }
    return await r.json()
  } catch (e) { console.log(`     fetch failed: ${(e as Error).message}`); return null }
}

async function one(mnis: number) {
  const { rows: [reg] } = await pool.query(
    `SELECT * FROM graph_member_register WHERE mnis_id=$1`, [mnis])
  if (!reg) { console.log(`  ❌ MNIS ${mnis} is not in the register`); problems++; return }
  head(`MNIS ${mnis} — ${reg.name_display}`)
  console.log(`  register: ${reg.name_full_title} · latest house ${reg.latest_house} · ${reg.latest_party} · ${reg.membership_from}`)
  const day = (v: any) => (v ? new Date(v).toISOString().slice(0, 10) : '—')
  console.log(`            ${day(reg.membership_start)} → ${reg.membership_end ? day(reg.membership_end) : 'current'}`)

  const { rows: names } = await pool.query(
    `SELECT surface, source, start_date, end_date FROM graph_member_name WHERE mnis_id=$1 ORDER BY start_date NULLS FIRST`, [mnis])
  console.log(`\n  names the register knows (${names.length}):`)
  for (const n of names) console.log(`    "${n.surface}"  [${n.source}]  ${day(n.start_date)} → ${day(n.end_date)}`)

  const { rows: ents } = await pool.query(
    `SELECT id, kind, canonical_name, name_norm, key_source, confidence, first_seen, last_seen
       FROM graph_entity WHERE parl_member_id=$1`, [mnis])
  console.log(`\n  entity in the graph:`)
  for (const e of ents) {
    console.log(`    #${e.id} "${e.canonical_name}"  key_source=${e.key_source} confidence=${e.confidence}`)
    console.log(`      active ${day(e.first_seen)} → ${day(e.last_seen)}`)
  }
  if (ents.length !== 1) { console.log(`  ❌ expected exactly one entity, found ${ents.length}`); problems++; return }
  const entityId = ents[0].id

  const { rows: aliases } = await pool.query(
    `SELECT surface, source, n_seen FROM graph_alias WHERE entity_id=$1 ORDER BY n_seen DESC LIMIT 12`, [entityId])
  console.log(`\n  surfaces attached to that entity (${aliases.length} shown):`)
  for (const a of aliases) console.log(`    "${a.surface}" [${a.source}] ×${a.n_seen}`)

  // ── the record ────────────────────────────────────────────────────────────────────────────────
  const { rows: byHouse } = await pool.query(
    `SELECT house, qualifier, COUNT(*)::int AS n, MIN(observed_on)::text AS first, MAX(observed_on)::text AS last
       FROM graph_voted_edge WHERE subject_id=$1 GROUP BY 1,2 ORDER BY 1,2`, [entityId])
  console.log(`\n  voting record as the graph has it:`)
  console.table(byHouse)

  const { rows: parties } = await pool.query(
    `SELECT party, MIN(observed_on)::text AS first, MAX(observed_on)::text AS last, COUNT(*)::int AS votes
       FROM graph_voted_edge WHERE subject_id=$1 GROUP BY 1 ORDER BY 2`, [entityId])
  console.log(`  party as at each vote (never rewritten to "current party"):`)
  console.table(parties)

  const { rows: edms } = await pool.query(
    `SELECT COUNT(*)::int AS motions, MIN(observed_on)::text AS first, MAX(observed_on)::text AS last,
            SUM(sponsors_count)::int AS signatures_on_those_motions
       FROM graph_signed_motion_edge WHERE subject_id=$1`, [entityId])
  console.log(`  EDMs sponsored (primary sponsor only):`)
  console.table(edms)

  // ── internal checks that can fail ─────────────────────────────────────────────────────────────
  console.log(`\n  CHECKS:`)
  // ⚠ NOT "before they took their seat". `membership_start` is the LATEST house membership, so for
  // an MP who became a peer it is the day they entered the LORDS — and every one of their Commons
  // votes then reads as impossible. The first version of this check fired 1,786 times on Theresa
  // May and every one was the check being wrong. What is genuinely impossible is a vote before the
  // member existed, so that is what is tested.
  const { rows: [oob] } = await pool.query(
    `SELECT COUNT(*)::int AS n, MIN(observed_on)::text AS earliest FROM graph_voted_edge g
      WHERE g.subject_id=$1 AND g.observed_on < (
        SELECT MIN(start_date) FROM graph_member_name WHERE mnis_id=$2 AND source='name-history')`,
    [entityId, mnis])
  console.log(`    votes dated before the member existed: ${oob.n}${oob.n ? `  ⚠ earliest ${oob.earliest}` : ''}`)
  if (oob.n) problems++

  const { rows: [dup] } = await pool.query(
    `SELECT COUNT(*)::int AS n FROM (
       SELECT object_ref FROM graph_voted_edge WHERE subject_id=$1 GROUP BY 1 HAVING COUNT(*) > 1) x`, [entityId])
  console.log(`    the same division counted twice: ${dup.n}`)
  if (dup.n) problems++

  const { rows: [nodate] } = await pool.query(
    `SELECT COUNT(*)::int AS n FROM graph_voted_edge WHERE subject_id=$1 AND observed_on IS NULL`, [entityId])
  console.log(`    undated votes: ${nodate.n}`)
  if (nodate.n) problems++

  // ── the independent look: re-fetch a real division and compare field by field ─────────────────
  const { rows: recent } = await pool.query(
    `SELECT object_ref, object_label, qualifier, teller, observed_on::text AS d, house, source_url
       FROM graph_voted_edge WHERE subject_id=$1 AND qualifier IN ('aye','no')
      ORDER BY observed_on DESC LIMIT 3`, [entityId])
  console.log(`\n  RE-FETCHED FROM votes.parliament.uk AND COMPARED (not taken from our own copy):`)
  for (const r of recent) {
    const divId = r.object_ref.split(':')[1]
    const isLords = r.house === 'lords'
    const url = isLords
      ? `https://lordsvotes-api.parliament.uk/data/Divisions/${divId}`
      : `https://commonsvotes-api.parliament.uk/data/division/${divId}.json`
    const pub = `https://votes.parliament.uk/Votes/${isLords ? 'Lords' : 'Commons'}/Division/${divId}`
    const d = await getJson(url)
    if (!d) { console.log(`    ${r.d}  ${r.object_label}  — could not re-fetch; ${pub}`); continue }
    // ⚠ THE TWO HOUSES PUBLISH DIFFERENT SHAPES, and reading one with the other's field names
    // produces "(not listed)" for every member — which looks exactly like a data error and is not
    // one. Commons: Ayes/Noes + AyeTellers/NoTellers, PascalCase, MemberId.
    // Lords: contents/notContents + contentTellers/notContentTellers, camelCase, memberId.
    const ayes: any[] = isLords ? [...(d.contents ?? []), ...(d.contentTellers ?? [])] : [...(d.Ayes ?? []), ...(d.AyeTellers ?? [])]
    const noes: any[] = isLords ? [...(d.notContents ?? []), ...(d.notContentTellers ?? [])] : [...(d.Noes ?? []), ...(d.NoTellers ?? [])]
    const has = (list: any[]) => list.some((m: any) => (m.MemberId ?? m.memberId) === mnis)
    const live = has(ayes) ? 'aye' : has(noes) ? 'no' : '(not listed)'
    const agree = live === r.qualifier
    console.log(`    ${agree ? '✓' : '✗'} ${r.d}  ${String(r.object_label).slice(0, 58)}`)
    console.log(`        we say "${r.qualifier}", the source says "${live}"   (${ayes.length} for / ${noes.length} against, live)`)
    console.log(`        check it: ${pub}`)
    if (!agree) problems++
  }

  const { rows: sampleEdm } = await pool.query(
    `SELECT object_ref, object_label, observed_on::text AS d, sponsors_count
       FROM graph_signed_motion_edge WHERE subject_id=$1 ORDER BY observed_on DESC LIMIT 3`, [entityId])
  if (sampleEdm.length) {
    console.log(`\n  EDMs to eyeball:`)
    for (const e of sampleEdm) console.log(`    ${e.d}  EDM ${e.object_label}  ${e.sponsors_count} signatures  https://edm.parliament.uk/early-day-motion/${e.object_ref}`)
  }
}

async function main() {
  for (const m of SUBJECTS) await one(m)
  head(problems ? `⚠ ${problems} PROBLEM(S) FOUND — read them above` : '✓ nothing obviously wrong in the three read by hand')
  await endNeonPool()
  if (problems) process.exit(1)
}
main().catch((e) => { console.error('[handcheck-2d2] FATAL', e instanceof Error ? e.message : e); process.exit(1) })
