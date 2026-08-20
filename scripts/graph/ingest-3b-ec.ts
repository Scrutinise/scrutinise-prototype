/**
 * ingest-3b-ec.ts — GRAPH 3B §2.2. The Electoral Commission donations register.
 *
 * Fetch → parse → resolve by exact key only → store → emit direction-0 signals → report coverage
 * and every exclusion rate with what it is a percentage OF.
 *
 * Re-runnable: `position_donation` is keyed on the Commission's own reference and upserted, and the
 * signal insert is `ON CONFLICT DO NOTHING` against 3A's (actor, target, type, date) unique index.
 *
 * ════════════════════════════════════════════════════════════════════════════════════════════════
 * THE ONE RULE THIS SCRIPT EXISTS TO OBEY
 * ════════════════════════════════════════════════════════════════════════════════════════════════
 * Brief §2: *"Never merge two identities on similarity. Register data is full of near-matches and
 * this is exactly where a wrongly merged identity gets created — a person who does not exist,
 * holding contradictory views, with nothing visibly wrong."*
 *
 * So neither end is ever resolved on a similarity score, and the two ends use different keys for
 * different reasons:
 *
 *   DONOR — `CompanyRegistrationNumber` only. An exact external key. A donor with no number, or a
 *           number we do not hold, is unresolved and counted. The donor's NAME is never consulted.
 *
 *   DONEE — the Commission publishes a free-text name and no member id, so there is no external
 *           key to use. The rule is therefore made structural instead: a donee resolves only when
 *           the normalised name matches EXACTLY ONE person in `graph_entity` that carries an MNIS
 *           id, AND the row's `RegulatedDoneeType` is one where an exact name match to a sitting
 *           member is the likely reading. Two Gareth Thomases produce two candidates and the row is
 *           left unresolved — the collision is what protects us, and it is counted rather than
 *           resolved by picking one.
 *
 *   ⚠ The donee link is still an INFERENCE, and it travels as one: every signal carries
 *   `derivation = 'ec-donee-name-match:v1'`. Design §3 — *"a signal with `derivation` set is an
 *   inference travelling as an inference"*. Nothing here is presented as a plain fact.
 *
 * ⚠⚠ AND THE DONEE-TYPE EXCLUSION IS THE LOAD-BEARING ONE. `RegulatedDoneeType` includes Mayor,
 * Councillor, MSP, Candidate and Members Association. A councillor who shares a name with an MP is
 * exactly the wrongly-merged identity the rule is about, and there is nothing in the row to tell
 * them apart. Only the types in ACCEPTED_DONEE_TYPES are resolved; the rest are stored, counted,
 * and produce no signal.
 *
 * Usage (from scripts/graph):
 *   npx tsx ingest-3b-ec.ts --dry-run     # fetch, resolve, report — write nothing
 *   npx tsx ingest-3b-ec.ts               # and write
 */
import fs from 'fs'
import path from 'path'
try { require('dotenv').config({ path: path.join(__dirname, '../../scrutinise-web/.env') }) } catch { /* ok */ }

import { getNeonPool, endNeonPool } from '../ingest/shared/neon-pool'
import { POSITION_CONFIG } from '../../scrutinise-web/lib/graph/position-config'

export {}

const DRY = process.argv.includes('--dry-run')
const CACHE = path.join(__dirname, '.ec-donations.csv')

const EC_CSV = 'https://search.electoralcommission.org.uk/api/csv/Donations'
  + '?start=0&rows=200000&query=&sort=AcceptedDate&order=desc'
  + '&et=pp&et=ppm&et=tp&et=perpar&et=rd'
  + '&date=Accepted&from=&to=&rptPd=&prePoll=false&postPoll=true&register=gb&isIrishSourceYes=true&isIrishSourceNo=true'

const EC_SEARCH = 'https://search.electoralcommission.org.uk/English/Donations/'

/**
 * The donee types where an exact name match to an MNIS-identified person is the reading a careful
 * person would make. Everything else is stored and counted, never resolved.
 *
 * ⚠ 'Members Association' is deliberately absent even though 1,174 rows carry it: an association is
 * an organisation, not the member, and treating "Labour Housing Group" as a person would be the
 * invented-identity failure in its purest form.
 */
const ACCEPTED_DONEE_TYPES = new Set([
  'MP - Member of Parliament',
  'Leadership Candidate',
  'Member of Registered Political Party',
])

/**
 * ⚠ RFC4180 parsing, not `split(',')`. The EC file quotes every money value ("£5,000.00"), so a
 * naive split shifts every column after `Value` by one and the whole ingest silently stores the
 * wrong fields in the right columns — the failure that looks like data rather than a bug.
 */
function parseCsv(text: string): string[][] {
  const rows: string[][] = []
  let row: string[] = [], field = '', inQ = false
  for (let i = 0; i < text.length; i++) {
    const c = text[i]
    if (inQ) {
      if (c === '"') { if (text[i + 1] === '"') { field += '"'; i++ } else inQ = false }
      else field += c
    } else if (c === '"') inQ = true
    else if (c === ',') { row.push(field); field = '' }
    else if (c === '\n') { row.push(field); rows.push(row); row = []; field = '' }
    else if (c !== '\r') field += c
  }
  if (field || row.length) { row.push(field); rows.push(row) }
  return rows
}

const normName = (s: string) =>
  s.toLowerCase()
    .replace(/[’']/g, '')
    .replace(/\b(rt hon|right honourable|hon|mr|mrs|ms|miss|dr|sir|dame|lord|lady|baroness|earl|viscount|the|mp)\b/g, ' ')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()

/** "£5,000.00" → 500000 pence. Returns null rather than 0 for anything unparseable — a donation of
 *  unknown size is not a donation of nothing. */
function pence(s: string): number | null {
  const m = (s ?? '').replace(/[£,\s]/g, '')
  if (!m || !/^-?\d+(\.\d+)?$/.test(m)) return null
  return Math.round(parseFloat(m) * 100)
}

/** "01/04/2026" (dd/mm/yyyy) → "2026-04-01". */
function isoDate(s: string): string | null {
  const m = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec((s ?? '').trim())
  return m ? `${m[3]}-${m[2]}-${m[1]}` : null
}

async function main() {
  console.log(`════ GRAPH 3B §2.2 — ELECTORAL COMMISSION DONATIONS${DRY ? '  (DRY RUN)' : ''} ════\n`)

  // ── 1. fetch ────────────────────────────────────────────────────────────────────────────────
  let csv: string
  if (fs.existsSync(CACHE)) {
    csv = fs.readFileSync(CACHE, 'utf8')
    console.log(`  cache  ${CACHE} (${(csv.length / 1e6).toFixed(1)} MB) — delete to refetch`)
  } else {
    const t0 = Date.now()
    const r = await fetch(EC_CSV, {
      headers: { 'User-Agent': 'Scrutinise/1.0 (research; cl@scrutinise.org)', Accept: 'text/csv' },
      signal: AbortSignal.timeout(180_000),
    })
    if (!r.ok) { console.error(`  ❌ HTTP ${r.status} from the Electoral Commission`); process.exit(1) }
    csv = await r.text()
    fs.writeFileSync(CACHE, csv)
    console.log(`  fetched ${(csv.length / 1e6).toFixed(1)} MB in ${((Date.now() - t0) / 1000).toFixed(1)}s`)
  }

  const all = parseCsv(csv)
  const header = all[0]
  const C = Object.fromEntries(header.map((h, i) => [h, i])) as Record<string, number>
  const body = all.slice(1).filter((r) => r[C.ECRef])
  console.log(`  rows   ${body.length.toLocaleString()}`)

  const pool = getNeonPool()
  try {
    // ── 2. the resolution keys, read from the entity layer. NOTHING IS CREATED. ───────────────
    const { rows: people } = await pool.query<{ n: string; id: string; c: string }>(`
      SELECT name_norm AS n, MIN(id::text) AS id, COUNT(*)::text AS c
        FROM graph_entity WHERE kind='person' AND parl_member_id IS NOT NULL GROUP BY name_norm`)
    const byName = new Map<string, { id: string; n: number }>()
    for (const p of people) {
      const k = normName(p.n)
      const prev = byName.get(k)
      // Two DIFFERENT graph_entity rows normalising to the same string is exactly the collision the
      // rule is about, and it must make the name UNusable, not pick the first.
      byName.set(k, prev ? { id: prev.id, n: prev.n + Number(p.c) } : { id: p.id, n: Number(p.c) })
    }

    const { rows: orgs } = await pool.query<{ no: string; id: string; c: string }>(`
      SELECT companies_house_no AS no, MIN(id::text) AS id, COUNT(*)::text AS c
        FROM graph_entity WHERE kind='organisation' AND companies_house_no IS NOT NULL
        GROUP BY companies_house_no`)
    const byCrn = new Map<string, { id: string; n: number }>()
    for (const o of orgs) byCrn.set(o.no.replace(/^0+/, '').toUpperCase(), { id: o.id, n: Number(o.c) })
    console.log(`  keys   ${people.length.toLocaleString()} MNIS-identified people · ${orgs.length.toLocaleString()} orgs with a Companies House number\n`)

    // ── 3. resolve ────────────────────────────────────────────────────────────────────────────
    interface Row {
      ecRef: string; entityName: string; entityType: string; doneeType: string | null
      donorName: string | null; donorStatus: string | null; crn: string | null
      valuePence: number | null; acceptedDate: string | null; donationType: string | null
      nature: string | null; isSponsorship: boolean | null
      doneeId: string | null; donorId: string | null
      doneeRes: string; donorRes: string
    }
    const out: Row[] = []
    const tally = (m: Map<string, number>, k: string) => m.set(k, (m.get(k) ?? 0) + 1)
    const doneeTally = new Map<string, number>()
    const donorTally = new Map<string, number>()
    const unresolvedNames = new Map<string, number>()

    for (const r of body) {
      const entityType = r[C.RegulatedEntityType] ?? ''
      const doneeType = (r[C.RegulatedDoneeType] ?? '').trim() || null
      const name = r[C.RegulatedEntityName] ?? ''

      let doneeId: string | null = null
      let doneeRes: string
      if (!/donee/i.test(entityType)) {
        // A donation to a party tells us nothing about any individual member and must never become
        // a member-level signal. 79,391 of 89,861 rows are this.
        doneeRes = 'unresolved:not-an-individual'
      } else if (!doneeType || !ACCEPTED_DONEE_TYPES.has(doneeType)) {
        doneeRes = 'unresolved:donee-type-excluded'
      } else {
        const hit = byName.get(normName(name))
        if (!hit) { doneeRes = 'unresolved:no-entity'; tally(unresolvedNames, name) }
        else if (hit.n > 1) doneeRes = 'unresolved:ambiguous-name'
        else { doneeId = hit.id; doneeRes = 'resolved:unique-mnis-name' }
      }
      tally(doneeTally, doneeRes)

      const crn = (r[C.CompanyRegistrationNumber] ?? '').trim() || null
      let donorId: string | null = null
      let donorRes: string
      if (!crn) donorRes = 'unresolved:no-number'
      else {
        const hit = byCrn.get(crn.replace(/^0+/, '').toUpperCase())
        if (!hit) donorRes = 'unresolved:number-not-held'
        else if (hit.n > 1) donorRes = 'unresolved:ambiguous-number'
        else { donorId = hit.id; donorRes = 'resolved:companies-house-no' }
      }
      tally(donorTally, donorRes)

      out.push({
        ecRef: r[C.ECRef], entityName: name, entityType, doneeType,
        donorName: (r[C.DonorName] ?? '').trim() || null,
        donorStatus: (r[C.DonorStatus] ?? '').trim() || null,
        crn, valuePence: pence(r[C.Value]), acceptedDate: isoDate(r[C.AcceptedDate]),
        donationType: (r[C.DonationType] ?? '').trim() || null,
        nature: (r[C.NatureOfDonation] ?? '').trim() || null,
        isSponsorship: /true/i.test(r[C.IsSponsorship] ?? '') ? true : /false/i.test(r[C.IsSponsorship] ?? '') ? false : null,
        doneeId, donorId, doneeRes, donorRes,
      })
    }

    // ── 4. the coverage report, with what each figure is a percentage OF ──────────────────────
    const individuals = out.filter((r) => /donee/i.test(r.entityType))
    const eligible = individuals.filter((r) => r.doneeType && ACCEPTED_DONEE_TYPES.has(r.doneeType))
    const resolvedDonee = out.filter((r) => r.doneeId)
    const emittable = out.filter((r) => r.doneeId && r.donorId && r.acceptedDate)

    console.log('  ── DONEE RESOLUTION, as a share of ALL 89,861 published records')
    for (const [k, v] of [...doneeTally].sort((a, b) => b[1] - a[1])) {
      console.log(`     ${k.padEnd(34)} ${v.toLocaleString().padStart(8)}  ${(100 * v / out.length).toFixed(2)}%`)
    }
    console.log(`\n  ── and as a share of the ${eligible.length.toLocaleString()} rows that name an ELIGIBLE individual`)
    console.log(`     resolved                           ${resolvedDonee.length.toLocaleString().padStart(8)}  ${(100 * resolvedDonee.length / eligible.length).toFixed(1)}%`)
    console.log(`     left unresolved                    ${(eligible.length - resolvedDonee.length).toLocaleString().padStart(8)}  ${(100 * (eligible.length - resolvedDonee.length) / eligible.length).toFixed(1)}%`)
    console.log(`\n  ── EXCLUDED BY DONEE TYPE — stored, counted, never resolved`)
    const excludedTypes = new Map<string, number>()
    for (const r of individuals) if (!r.doneeType || !ACCEPTED_DONEE_TYPES.has(r.doneeType)) tally(excludedTypes, r.doneeType ?? '(blank)')
    for (const [k, v] of [...excludedTypes].sort((a, b) => b[1] - a[1])) {
      console.log(`     ${k.padEnd(46)} ${v.toLocaleString().padStart(6)}`)
    }
    console.log(`\n  ── the ten most frequent UNRESOLVED eligible recipients, so the miss can be argued with`)
    for (const [k, v] of [...unresolvedNames].sort((a, b) => b[1] - a[1]).slice(0, 10)) {
      console.log(`     ${String(v).padStart(4)} × ${k}`)
    }

    console.log('\n  ── DONOR RESOLUTION, as a share of ALL records')
    for (const [k, v] of [...donorTally].sort((a, b) => b[1] - a[1])) {
      console.log(`     ${k.padEnd(34)} ${v.toLocaleString().padStart(8)}  ${(100 * v / out.length).toFixed(2)}%`)
    }

    console.log(`\n  ══ SIGNALS THIS WOULD EMIT`)
    console.log(`     both ends resolved AND dated       ${emittable.length.toLocaleString().padStart(8)}`)
    console.log(`     distinct members                   ${new Set(emittable.map((r) => r.doneeId)).size.toLocaleString().padStart(8)}`)
    console.log(`     distinct donor organisations       ${new Set(emittable.map((r) => r.donorId)).size.toLocaleString().padStart(8)}`)
    console.log(`     ⚠ a signal is (member, donor org, date). Several donations from one donor to`)
    console.log(`       one member on one date collapse to ONE signal with several evidence refs —`)
    console.log(`       the same shape 3A used for declared interests.`)

    if (DRY) { console.log('\n  --dry-run: nothing written.'); return }

    // ── 5. write the register ─────────────────────────────────────────────────────────────────
    console.log('\n  ── writing position_donation')
    const CHUNK = 500
    let written = 0
    for (let i = 0; i < out.length; i += CHUNK) {
      const slice = out.slice(i, i + CHUNK)
      const vals: any[] = []
      const tuples = slice.map((r, k) => {
        const b = k * 17
        vals.push(r.ecRef, r.entityName, r.entityType, r.doneeType, r.donorName, r.donorStatus,
          r.crn, r.valuePence, r.acceptedDate, r.donationType, r.nature, r.isSponsorship,
          r.doneeId, r.donorId, r.doneeRes, r.donorRes, EC_SEARCH)
        return `($${b + 1},$${b + 2},$${b + 3},$${b + 4},$${b + 5},$${b + 6},$${b + 7},$${b + 8}::bigint,$${b + 9}::date,$${b + 10},$${b + 11},$${b + 12}::boolean,$${b + 13}::bigint,$${b + 14}::bigint,$${b + 15},$${b + 16},$${b + 17})`
      }).join(',')
      await pool.query(`
        INSERT INTO position_donation (ec_ref, regulated_entity_name, regulated_entity_type,
          regulated_donee_type, donor_name, donor_status, company_registration_number, value_pence,
          accepted_date, donation_type, nature_of_donation, is_sponsorship, donee_entity_id,
          donor_entity_id, donee_resolution, donor_resolution, source_url)
        VALUES ${tuples}
        ON CONFLICT (ec_ref) DO UPDATE SET
          donee_entity_id = EXCLUDED.donee_entity_id, donor_entity_id = EXCLUDED.donor_entity_id,
          donee_resolution = EXCLUDED.donee_resolution, donor_resolution = EXCLUDED.donor_resolution,
          value_pence = EXCLUDED.value_pence, ingested_at = now()`, vals)
      written += slice.length
      if (written % 10000 < CHUNK) console.log(`     ${written.toLocaleString()} / ${out.length.toLocaleString()}`)
    }
    console.log(`     ✓ ${written.toLocaleString()} rows`)

    // ── 6. emit the signals ───────────────────────────────────────────────────────────────────
    //
    // Straight out of the stored register, so the signal layer cannot disagree with the register it
    // came from. `evidence_ids` are the Commission's own references — the row is drillable to
    // `position_donation` and from there to a public URL, which is what design §3 requires of it.
    console.log('\n  ── emitting political_donation signals')
    const weight = POSITION_CONFIG.weights.political_donation
    const { rows: [ins] } = await pool.query<{ n: string }>(`
      WITH grouped AS (
        SELECT donee_entity_id, donor_entity_id, accepted_date,
               array_agg('ec-donation:' || ec_ref ORDER BY ec_ref) AS refs
          FROM position_donation
         WHERE donee_entity_id IS NOT NULL AND donor_entity_id IS NOT NULL AND accepted_date IS NOT NULL
         GROUP BY 1,2,3)
      INSERT INTO position_signal_stored
        (actor_id, target_type, target_id, signal_type, direction, raw_weight, derivation,
         evidence_ids, observed_at)
      SELECT donee_entity_id, 'organisation', donor_entity_id::text, 'political_donation',
             0, $1::real, 'ec-donee-name-match:v1', refs, accepted_date
        FROM grouped
      ON CONFLICT (actor_id, target_type, target_id, signal_type, observed_at) DO NOTHING
      RETURNING 1`, [weight])
      .then((r) => ({ rows: [{ n: String(r.rowCount ?? 0) }] }))
    console.log(`     ✓ ${Number(ins.n).toLocaleString()} signals inserted (weight ${weight}, direction 0)`)

    const { rows: [tot] } = await pool.query<{ n: string; actors: string; orgs: string; d0: string; d1: string }>(`
      SELECT COUNT(*)::text AS n, COUNT(DISTINCT actor_id)::text AS actors,
             COUNT(DISTINCT target_id)::text AS orgs,
             MIN(observed_at)::text AS d0, MAX(observed_at)::text AS d1
        FROM position_signal_stored WHERE signal_type='political_donation'`)
    console.log(`     total in the graph: ${Number(tot.n).toLocaleString()} signals · ${Number(tot.actors).toLocaleString()} members · ${Number(tot.orgs).toLocaleString()} donor organisations · ${tot.d0} → ${tot.d1}`)

    // ── 7. read the signals back against the register they came from ─────────────────────────
    console.log('\n  ── reading ten signals back against their source rows')
    const { rows: back } = await pool.query<Record<string, string>>(`
      SELECT p.canonical_name AS member, o.canonical_name AS donor, s.observed_at::text AS d,
             s.direction::text, s.raw_weight::text, array_length(s.evidence_ids,1)::text AS n_ev,
             s.evidence_ids[1] AS ev,
             (SELECT SUM(value_pence)/100 FROM position_donation dn
               WHERE ('ec-donation:' || dn.ec_ref) = ANY(s.evidence_ids))::text AS gbp
        FROM position_signal_stored s
        JOIN graph_entity p ON p.id = s.actor_id
        JOIN graph_entity o ON o.id = s.target_id::bigint
       WHERE s.signal_type='political_donation'
       ORDER BY s.observed_at DESC LIMIT 10`)
    for (const r of back) {
      console.log(`     ${r.d}  ${r.member.slice(0, 26).padEnd(27)} ← ${r.donor.slice(0, 34).padEnd(35)} £${Number(r.gbp).toLocaleString().padStart(9)}  dir ${r.direction} w${r.raw_weight}  ${r.n_ev} ref(s)  ${r.ev}`)
    }
    const bad = back.filter((r) => r.direction !== '0')
    console.log(`     ${bad.length === 0 ? '✓ every one is direction 0 — a donation is not a position' : `❌ ${bad.length} carry a direction`}`)
  } finally {
    await endNeonPool()
  }
}

main().catch((e) => { console.error(e); process.exit(1) })
