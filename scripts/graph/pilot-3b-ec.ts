/**
 * pilot-3b-ec.ts — GRAPH 3B §2.2. Pilot the Electoral Commission donations register BEFORE
 * building anything on it.
 *
 * Charlie's standing discipline (docs/CHANGE_LOG, predict-measure-commit): the prediction goes in
 * writing before the run, and the report scores it. A register that turns out to hold 400 usable
 * rows is a different sprint from one that holds 40,000.
 *
 * ⚠ Nothing is stored. This downloads, counts, and reports resolution rates against the entity
 * layer we already have.
 *
 * ════════════════════════════════════════════════════════════════════════════════════════════════
 * PREDICTIONS, WRITTEN BEFORE THE FIRST RUN
 * ════════════════════════════════════════════════════════════════════════════════════════════════
 *   P1  total donation rows in the register            ~85,000
 *   P2  rows whose recipient is an INDIVIDUAL (a "Regulated Donee" — an MP, a candidate, a member
 *       association), not a party                       ~12%
 *   P3  of those, the share whose recipient name resolves to exactly ONE graph_entity carrying an
 *       MNIS id — i.e. an identified sitting or former member, no similarity matching anywhere
 *                                                        ~35%
 *   P4  share of ALL rows carrying a CompanyRegistrationNumber (the only safe donor key)  ~22%
 *   P5  of those, the share whose number matches a graph_entity.companies_house_no we already hold
 *                                                        ~4%   (we hold 5,496 numbered orgs, and
 *                                                               they were gathered for a different
 *                                                               reason — committee witnesses)
 *
 * Usage (from scripts/graph):  npx tsx pilot-3b-ec.ts
 */
import fs from 'fs'
import path from 'path'
try { require('dotenv').config({ path: path.join(__dirname, '../../scrutinise-web/.env') }) } catch { /* ok */ }

import { getNeonPool, endNeonPool } from '../ingest/shared/neon-pool'

export {}

const CACHE = path.join(__dirname, '.ec-donations.csv')

/**
 * The EC's own CSV export endpoint, with the filter set the search UI uses.
 *
 * ⚠ `rows=` is IGNORED by this endpoint — asking for 3 returned the whole 18.6 MB file. Noted
 * because a pilot that thinks it fetched 3 rows and actually fetched everything is a pilot that
 * measured nothing.
 */
const EC_CSV = 'https://search.electoralcommission.org.uk/api/csv/Donations'
  + '?start=0&rows=200000&query=&sort=AcceptedDate&order=desc'
  + '&et=pp&et=ppm&et=tp&et=perpar&et=rd'
  + '&date=Accepted&from=&to=&rptPd=&prePoll=false&postPoll=true&register=gb&isIrishSourceYes=true&isIrishSourceNo=true'

const PREDICTIONS = { total: 85000, pctDonee: 12, pctDoneeResolved: 35, pctWithCrn: 22, pctCrnMatched: 4 }

function report(name: string, predicted: number, measured: number, unit = '%') {
  const err = predicted === 0 ? 0 : (100 * (measured - predicted)) / predicted
  console.log(`   ${Math.abs(err) < 25 ? '≈' : '✗'} ${name.padEnd(46)} predicted ${String(predicted).padStart(8)}${unit}   measured ${measured.toFixed(unit === '%' ? 1 : 0).padStart(9)}${unit}   ${err >= 0 ? '+' : ''}${err.toFixed(0)}%`)
}

/** RFC4180-ish parser. The EC file quotes values containing commas ("£5,000.00") and that is the
 *  whole reason a naive split(',') would silently shift every column after Value. */
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

async function main() {
  // ── fetch (cached, so a rerun does not hammer a public service) ─────────────────────────────
  let csv: string
  if (fs.existsSync(CACHE)) {
    csv = fs.readFileSync(CACHE, 'utf8')
    console.log(`   using cached ${CACHE} (${(csv.length / 1e6).toFixed(1)} MB) — delete it to refetch`)
  } else {
    console.log('   fetching the Electoral Commission donations export…')
    const t0 = Date.now()
    const r = await fetch(EC_CSV, {
      headers: { 'User-Agent': 'Scrutinise/1.0 (research; cl@scrutinise.org)', Accept: 'text/csv' },
      signal: AbortSignal.timeout(180_000),
    })
    if (!r.ok) { console.error(`   ❌ HTTP ${r.status}`); process.exit(1) }
    csv = await r.text()
    fs.writeFileSync(CACHE, csv)
    console.log(`   ${(csv.length / 1e6).toFixed(1)} MB in ${((Date.now() - t0) / 1000).toFixed(1)}s → ${CACHE}`)
  }

  const rows = parseCsv(csv)
  const header = rows[0]
  const body = rows.slice(1).filter((r) => r.length >= header.length - 2 && r[0])
  const col = (name: string) => header.indexOf(name)
  console.log(`\n   columns (${header.length}): ${header.join(', ')}`)
  console.log(`   data rows: ${body.length.toLocaleString()}`)
  report('P1 total rows', PREDICTIONS.total, body.length, '')

  const cType = col('RegulatedEntityType')
  const cName = col('RegulatedEntityName')
  const cDoneeType = col('RegulatedDoneeType')
  const cCrn = col('CompanyRegistrationNumber')
  const cDonor = col('DonorName')
  const cValue = col('Value')
  const cDate = col('AcceptedDate')
  const cDonType = col('DonationType')

  console.log('\n   RegulatedEntityType breakdown — who receives the money')
  const types = new Map<string, number>()
  for (const r of body) types.set(r[cType], (types.get(r[cType]) ?? 0) + 1)
  for (const [k, v] of [...types].sort((a, b) => b[1] - a[1])) {
    console.log(`      ${(k || '(blank)').padEnd(30)} ${v.toLocaleString().padStart(8)}  ${(100 * v / body.length).toFixed(1)}%`)
  }

  // ⚠ "Regulated Donee" is the row type that names an individual — an MP, a candidate, a member
  // association. A donation to "the Labour Party" tells us nothing about any one member and must
  // never become a member-level signal.
  const donee = body.filter((r) => /donee/i.test(r[cType] ?? ''))
  console.log(`\n   individual-recipient rows: ${donee.length.toLocaleString()}`)
  report('P2 % of rows that name an individual', PREDICTIONS.pctDonee, 100 * donee.length / body.length)

  console.log('\n   RegulatedDoneeType within those')
  const dt = new Map<string, number>()
  for (const r of donee) dt.set(r[cDoneeType], (dt.get(r[cDoneeType]) ?? 0) + 1)
  for (const [k, v] of [...dt].sort((a, b) => b[1] - a[1])) {
    console.log(`      ${(k || '(blank)').padEnd(30)} ${v.toLocaleString().padStart(8)}`)
  }

  const withCrn = body.filter((r) => (r[cCrn] ?? '').trim().length > 3)
  report('P4 % of rows with a company number', PREDICTIONS.pctWithCrn, 100 * withCrn.length / body.length)

  // ══════════════════════════════════════════════════════════════════════════════════════════
  // RESOLUTION AGAINST THE ENTITY LAYER WE ALREADY HAVE. NO NEW PEOPLE ARE CREATED ANYWHERE.
  // ══════════════════════════════════════════════════════════════════════════════════════════
  const pool = getNeonPool()
  try {
    // People, keyed on the NORMALISED name, but ONLY where the normalised name is UNIQUE and the
    // entity carries an MNIS id. A colliding name (there are two Gareth Thomases) yields two
    // candidates and is therefore left unresolved and counted — design §3's standing rule, applied
    // by construction rather than by intention.
    const { rows: people } = await pool.query<{ n: string; id: string; c: string }>(`
      SELECT name_norm AS n, MIN(id::text) AS id, COUNT(*)::text AS c
        FROM graph_entity
       WHERE kind='person' AND parl_member_id IS NOT NULL
       GROUP BY name_norm`)
    const byName = new Map<string, { id: string; n: number }>()
    for (const p of people) byName.set(normName(p.n), { id: p.id, n: Number(p.c) })
    console.log(`\n   entity layer: ${people.length.toLocaleString()} MNIS-identified people, normalised to ${byName.size.toLocaleString()} distinct names`)

    let resolved = 0, ambiguous = 0, unresolved = 0
    const misses = new Map<string, number>()
    for (const r of donee) {
      const k = normName(r[cName] ?? '')
      const hit = byName.get(k)
      if (!hit) { unresolved++; misses.set(r[cName], (misses.get(r[cName]) ?? 0) + 1) }
      else if (hit.n > 1) ambiguous++
      else resolved++
    }
    console.log(`\n   ── donee resolution (exact normalised name, unique, MNIS-identified only)`)
    console.log(`      resolved            ${resolved.toLocaleString().padStart(8)}  ${(100 * resolved / donee.length).toFixed(1)}% of individual-recipient rows`)
    console.log(`      ambiguous (a name that is more than one member) ${ambiguous.toLocaleString().padStart(6)}  — LEFT UNRESOLVED by design`)
    console.log(`      no entity at all    ${unresolved.toLocaleString().padStart(8)}  ${(100 * unresolved / donee.length).toFixed(1)}%`)
    report('P3 % of individual rows resolved', PREDICTIONS.pctDoneeResolved, 100 * resolved / donee.length)
    console.log(`\n      the ten most common unresolved recipients — so the miss can be argued with:`)
    for (const [k, v] of [...misses].sort((a, b) => b[1] - a[1]).slice(0, 10)) {
      console.log(`        ${String(v).padStart(4)} × ${k}`)
    }

    // Donors, keyed on Companies House number ONLY. An exact external key, never a name.
    const { rows: orgs } = await pool.query<{ no: string; id: string }>(`
      SELECT companies_house_no AS no, MIN(id::text) AS id
        FROM graph_entity WHERE kind='organisation' AND companies_house_no IS NOT NULL
       GROUP BY companies_house_no`)
    const byCrn = new Map(orgs.map((o) => [o.no.replace(/^0+/, '').toUpperCase(), o.id]))
    console.log(`\n   ── donor resolution (Companies House number only — an exact key, never a name)`)
    console.log(`      organisations we hold with a CH number: ${orgs.length.toLocaleString()}`)
    let crnHit = 0
    const hitNames = new Map<string, number>()
    for (const r of withCrn) {
      const k = (r[cCrn] ?? '').trim().replace(/^0+/, '').toUpperCase()
      if (byCrn.has(k)) { crnHit++; hitNames.set(r[cDonor], (hitNames.get(r[cDonor]) ?? 0) + 1) }
    }
    console.log(`      rows with a CH number:                 ${withCrn.length.toLocaleString()}`)
    console.log(`      of those, matched to an org we hold:   ${crnHit.toLocaleString()}  ${(100 * crnHit / withCrn.length).toFixed(2)}%`)
    report('P5 % of CH-numbered rows matched', PREDICTIONS.pctCrnMatched, 100 * crnHit / withCrn.length)
    console.log(`      the matches, most frequent first:`)
    for (const [k, v] of [...hitNames].sort((a, b) => b[1] - a[1]).slice(0, 10)) {
      console.log(`        ${String(v).padStart(4)} × ${k}`)
    }

    // The signal that would actually be emitted: a resolved donee AND (a resolved donor OR a
    // company number we can name). Count it, because that is the sprint's coverage figure.
    let emittable = 0, bothEnds = 0
    for (const r of donee) {
      const hit = byName.get(normName(r[cName] ?? ''))
      if (!hit || hit.n > 1) continue
      emittable++
      const k = (r[cCrn] ?? '').trim().replace(/^0+/, '').toUpperCase()
      if (k && byCrn.has(k)) bothEnds++
    }
    console.log(`\n   ══ WHAT A SIGNAL LAYER WOULD ACTUALLY HOLD`)
    console.log(`      member←donation signals emittable:      ${emittable.toLocaleString()}`)
    console.log(`      …of which BOTH ends resolve to entities: ${bothEnds.toLocaleString()}`)
    console.log(`      distinct members with at least one:      ${new Set(donee
      .filter((r) => { const h = byName.get(normName(r[cName] ?? '')); return h && h.n === 1 })
      .map((r) => normName(r[cName]))).size.toLocaleString()}`)

    // Sanity: print five real rows so the shape can be eyeballed rather than trusted.
    console.log(`\n   five real individual-recipient rows:`)
    for (const r of donee.slice(0, 5)) {
      console.log(`      ${(r[cDate] ?? '').padEnd(11)} ${(r[cName] ?? '').slice(0, 24).padEnd(25)} ← ${(r[cDonor] ?? '').slice(0, 34).padEnd(35)} ${(r[cValue] ?? '').padStart(12)}  ${r[cDonType]}`)
    }
  } finally {
    await endNeonPool()
  }
}

main().catch((e) => { console.error(e); process.exit(1) })
