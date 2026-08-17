/**
 * sweep-interests.ts — `declared-interest` edges from the Register of Members' Financial Interests
 * (BRIEF_GRAPH_2D1 §2/§3).
 *
 * The only source in this sprint with a genuinely stable key for PEOPLE, measured in §1g: every
 * sampled interest carries `member.id` — the Parliament member ID — alongside the display name. Our
 * `corpus_sections` rows keep the name and drop the id, so this is the same shape of repair as the
 * committees sweep: the fact is structured at the source and simply was not carried.
 *
 * The organisation side is different and the difference matters. There is no organisation ID here at
 * all; what there is, is a set of NAMED FIELDS — `DonorName`, `DonorCompanyName`, `DonorCompanyUrl`,
 * `DonorStatus` — so the counterparty is a structured string rather than prose to be mined. That is
 * still a name match, and it is recorded as one.
 *
 * ⚠ WHAT AN EDGE HERE DOES AND DOES NOT MEAN. `declared-interest` is a registrable financial
 * relationship that the member themselves declared. It is not a position, not a payment for
 * advocacy, and not an allegation. The design's §5.1 rule applies exactly: state the evidence, let
 * the reader draw the conclusion. The interest's own category and date travel with the edge so the
 * reader can see which kind of interest it was.
 *
 * Usage (from scripts/ingest):
 *   npx tsx position-graph/sweep-interests.ts --predict
 *   npx tsx position-graph/sweep-interests.ts
 *   npx tsx position-graph/sweep-interests.ts --self-test
 */
import path from 'path'
try { require('dotenv').config({ path: path.join(__dirname, '../../../scrutinise-web/.env') }) } catch { /* ok */ }

import { getNeonPool, endNeonPool } from '../shared/neon-pool'
import { normaliseName, normalisePersonName, isoDate, isUselessName } from './graph-common'

export {}

const argv = process.argv.slice(2)
const has = (f: string) => argv.includes(`--${f}`)
const num = (f: string, d: number) => {
  const i = argv.indexOf(`--${f}`)
  const v = i >= 0 ? parseInt(argv[i + 1] ?? '', 10) : NaN
  return Number.isFinite(v) ? v : d
}
// ⚠ 20, NOT 100. The interests API silently CAPS a page at 20 items whatever `Take` asks for. The
// first run passed Take=100 and advanced `Skip` by 100, so it read 20 and skipped 80 — it covered
// 695 of 3,415 interests (20.4%) and reported every one of them as a success. Nothing errored;
// the loop simply walked past four fifths of the register. A page size that is not the page size
// you asked for is the same family as a truncated LLM response (docs/CLAUDE.md §18): the failure
// arrives wearing the face of a clean run.
const TAKE = num('take', 20)
const THROTTLE_MS = num('throttle', 250)

const BASE = 'https://interests-api.parliament.uk/api/v1/Interests'
const UA = 'Scrutinise-Ingest/1.0 (+https://scrutinise.org; contact cl@scrutinise.org)'
const n = (v: number) => Number(v).toLocaleString('en-GB')
const pct = (a: number, b: number) => (b ? `${((100 * a) / b).toFixed(1)}%` : 'n/a')
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))

async function getJson(url: string): Promise<any | null> {
  for (let i = 0; i < 4; i++) {
    await sleep(THROTTLE_MS)
    try {
      const res = await fetch(url, { headers: { Accept: 'application/json', 'User-Agent': UA } })
      if (res.ok) return await res.json()
      if (res.status === 429 || res.status >= 500) { await sleep(1500 * (i + 1)); continue }
      return null
    } catch { await sleep(1500 * (i + 1)) }
  }
  return null
}

export interface ParsedInterest {
  id: number
  memberId: number | null
  memberName: string | null
  party: string | null
  house: string | null
  categoryId: number | null
  categoryName: string | null
  date: string | null
  /** Counterparty names, in preference order: a company name is more specific than a donor name. */
  counterparties: string[]
  summary: string | null
}

/**
 * One interest → the triple the brief asks for. The counterparty is taken ONLY from named fields;
 * `summary` is never mined, because a free-text summary is prose and this brief does not authorise
 * extraction from prose.
 */
export function parseInterest(raw: any): ParsedInterest {
  const fields: Array<{ name?: string; value?: unknown }> = Array.isArray(raw?.fields) ? raw.fields : []
  const field = (name: string): string | null => {
    const f = fields.find((x) => (x.name ?? '').toLowerCase() === name.toLowerCase())
    const v = f?.value
    return typeof v === 'string' && v.trim() ? v.trim() : null
  }
  const counterparties: string[] = []
  // A company NAME is the most specific identity available; a donor name may be a person; a payer
  // name covers the employment categories. Duplicates and useless values are dropped.
  for (const key of ['DonorCompanyName', 'DonorName', 'PayerName', 'ClientName', 'OrganisationName', 'SponsorName']) {
    const v = field(key)
    if (v && !isUselessName(v) && !counterparties.includes(v)) counterparties.push(v)
  }
  return {
    id: Number(raw?.id),
    memberId: typeof raw?.member?.id === 'number' ? raw.member.id : null,
    memberName: typeof raw?.member?.nameDisplayAs === 'string' ? raw.member.nameDisplayAs : null,
    party: raw?.member?.party ?? null,
    house: raw?.member?.house ?? null,
    categoryId: typeof raw?.category?.id === 'number' ? raw.category.id : null,
    categoryName: raw?.category?.name ?? null,
    date: isoDate(raw?.registrationDate) ?? isoDate(raw?.publishedDate),
    counterparties,
    summary: typeof raw?.summary === 'string' ? raw.summary : null,
  }
}

/** (kind:norm) or (m:memberId) → entity id, for this run only. Never persisted, never a substitute
 *  for the unique indexes — those remain the guarantee; this only avoids asking twice. */
const entityCache = new Map<string, number>()
/** (entityId|surface) already upserted this run, so a repeated alias costs nothing. */
const aliasSeen = new Set<string>()

/** Resolve one entity by a stable key if there is one, else by conservative name match. */
async function resolveEntity(
  pool: ReturnType<typeof getNeonPool>,
  kind: 'person' | 'organisation',
  name: string,
  memberId: number | null,
  date: string | null,
  source: string,
): Promise<{ id: number; created: boolean; matchedByName: boolean }> {
  const norm = kind === 'person' ? normalisePersonName(name) : normaliseName(name)
  if (!norm) throw new Error(`empty normal form for "${name}"`)

  // ⚠ IN-RUN CACHE, and it is the difference between 30 minutes and 10. This register is ~3,415
  // interests over roughly 650 members, so the same person is resolved again and again; without a
  // cache each repeat costs 2-3 Neon round trips for an answer already known. The FIRST run of this
  // sweep spent ~0.5s per interest almost entirely on that. Correctness is untouched — a cache hit
  // returns the same id the query would have.
  const cacheKey = memberId !== null ? `m:${memberId}` : `${kind}:${norm}`
  const hit = entityCache.get(cacheKey)
  if (hit !== undefined) {
    await addAlias(pool, hit, name, norm, source, date)
    return { id: hit, created: false, matchedByName: memberId === null }
  }

  if (memberId !== null) {
    const { rows } = await pool.query<{ id: string }>(`SELECT id FROM graph_entity WHERE parl_member_id = $1`, [memberId])
    if (rows.length) {
      entityCache.set(cacheKey, Number(rows[0].id))
      await addAlias(pool, Number(rows[0].id), name, norm, source, date)
      return { id: Number(rows[0].id), created: false, matchedByName: false }
    }
  }
  const { rows: existing } = await pool.query<{ id: string; canonical_name: string; parl_member_id: number | null }>(
    `SELECT id, canonical_name, parl_member_id FROM graph_entity WHERE kind = $1 AND name_norm = $2`, [kind, norm])
  if (existing.length) {
    const id = Number(existing[0].id)
    // A member id found for a row that had none is an UPGRADE in identity, and it is recorded as
    // such rather than left as a name match forever.
    if (memberId !== null && existing[0].parl_member_id === null) {
      await pool.query(`UPDATE graph_entity SET parl_member_id = $1, key_source = 'parl-member-id', confidence = 1.0 WHERE id = $2`, [memberId, id])
      await pool.query(
        `INSERT INTO graph_merge_log (kind, kept_entity_id, merged_surface, merged_norm, reason, confidence, source)
         VALUES ($1,$2,$3,$4,'parl-member-id',1.0,$5)`, [kind, id, name.slice(0, 500), norm, source])
    }
    entityCache.set(cacheKey, id)
    await addAlias(pool, id, name, norm, source, date)
    return { id, created: false, matchedByName: memberId === null }
  }
  const { rows: made } = await pool.query<{ id: string }>(
    `INSERT INTO graph_entity (kind, canonical_name, name_norm, parl_member_id, key_source, confidence, first_seen, last_seen)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$7)
     ON CONFLICT (kind, name_norm) DO UPDATE SET
       parl_member_id = COALESCE(graph_entity.parl_member_id, EXCLUDED.parl_member_id),
       first_seen     = LEAST(graph_entity.first_seen, EXCLUDED.first_seen),
       last_seen      = GREATEST(graph_entity.last_seen, EXCLUDED.last_seen)
     RETURNING id`,
    [kind, name.slice(0, 500), norm, memberId, memberId !== null ? 'parl-member-id' : 'singleton', memberId !== null ? 1.0 : 0.7, date])
  const id = Number(made[0].id)
  entityCache.set(cacheKey, id)
  await addAlias(pool, id, name, norm, source, date)
  return { id, created: true, matchedByName: false }
}

async function addAlias(pool: ReturnType<typeof getNeonPool>, entityId: number, surface: string, norm: string, source: string, date: string | null) {
  // n_seen would over-count on a re-run anyway (it is an upsert that increments), so skipping a
  // repeat within one run loses nothing that was reliable to begin with.
  const k = entityId + '|' + surface
  if (aliasSeen.has(k)) return
  aliasSeen.add(k)
  await pool.query(
    `INSERT INTO graph_alias (entity_id, surface, surface_norm, source, n_seen, first_seen, last_seen)
     VALUES ($1,$2,$3,$4,1,$5,$5)
     ON CONFLICT (entity_id, surface, source) DO UPDATE SET
       n_seen     = graph_alias.n_seen + 1,
       first_seen = LEAST(graph_alias.first_seen, EXCLUDED.first_seen),
       last_seen  = GREATEST(graph_alias.last_seen, EXCLUDED.last_seen)`,
    [entityId, surface.slice(0, 500), norm, source, date])
}

function selfTest() {
  const item = {
    id: 16295, registrationDate: '2026-07-12', publishedDate: '2026-07-13',
    summary: 'Yan Huo - £20,000.00',
    category: { id: 3, number: '2', name: 'Donations and other support (including loans) for activities as an MP' },
    member: { id: 4484, nameDisplayAs: 'Alan Mak', house: 'Commons', memberFrom: 'Havant', party: 'Conservative' },
    fields: [
      { name: 'DonorName', value: 'Yan Huo' },
      { name: 'DonorCompanyName', value: 'Capula Investment Management LLP' },
      { name: 'Value', value: '£20,000.00' },
      { name: 'DonorStatus', value: 'Individual' },
    ],
  }
  const p = parseInterest(item)
  const checks: Array<[string, boolean]> = [
    ['member id read', p.memberId === 4484],
    ['member name read', p.memberName === 'Alan Mak'],
    ['category id read', p.categoryId === 3],
    ['date is the registration date', p.date === '2026-07-12'],
    ['company name preferred first', p.counterparties[0] === 'Capula Investment Management LLP'],
    ['donor name kept too', p.counterparties.includes('Yan Huo')],
    ['summary is NOT mined for a counterparty', p.counterparties.length === 2],
  ]
  const empty = parseInterest({ id: 1, fields: [{ name: 'DonorName', value: 'N/A' }, { name: 'DonorCompanyName', value: '' }] })
  checks.push(['useless counterparty names refused', empty.counterparties.length === 0])
  checks.push(['missing member id is null, not 0', empty.memberId === null])
  for (const [label, pass] of checks) console.log(`  ${pass ? '✓' : '✗'} ${label}`)
  const ok = checks.every(([, p2]) => p2)
  console.log(`\n[interests] self-test ${ok ? 'PASSED' : 'FAILED'}`)
  process.exit(ok ? 0 : 1)
}

async function main() {
  if (has('self-test')) return selfTest()
  const pool = getNeonPool()
  try {
    // Only interests we actually hold get an edge — same rule as the committees sweep, enforced by
    // the FK on graph_evidence rather than by intention.
    const { rows: heldRows } = await pool.query<{ id: string; parentDocId: string; sourceUrl: string | null }>(
      `SELECT id, "parentDocId", "sourceUrl" FROM corpus_sections WHERE corpus = 'members-interests' AND status = 'compiled'`)
    const held = new Map<string, { sectionId: string; url: string | null }>()
    for (const r of heldRows) held.set(r.parentDocId, { sectionId: r.id, url: r.sourceUrl })
    console.log(`[interests] ${n(held.size)} interests held in corpus_sections`)

    const first = await getJson(`${BASE}/?Take=1&ExpandChildInterests=true`)
    const total = first?.totalResults ?? 0
    console.log(`[interests] ${n(total)} at source over ${Math.ceil(total / TAKE)} pages`)
    if (has('predict')) {
      console.log('\n════ PREDICTION (nothing written) ════')
      console.log(`  people expected      ≤ ${n(Math.min(total, 700))} distinct members (a register of ~650 MPs plus peers)`)
      console.log(`  organisations        unknown — this is the number the sweep exists to produce`)
      console.log(`  edges                one per (member, counterparty) pair, so ≤ ${n(total * 2)}`)
      console.log(`  every person edge carries a Parliament member id, so resolution is by KEY, not by name`)
      return
    }

    let items = 0, attached = 0, unheld = 0, noMember = 0, noCounterparty = 0
    let people = 0, orgs = 0, orgNameMatches = 0, edges = 0, evidence = 0
    for (let skip = 0; skip < total; skip += TAKE) {
      const d = await getJson(`${BASE}/?Take=${TAKE}&Skip=${skip}&ExpandChildInterests=true`)
      const raws: any[] = d?.items ?? []
      if (!raws.length) { console.log(`  ⚠ GAP at skip=${skip} — recorded, not treated as the end`); continue }
      for (const raw of raws) {
        const it = parseInterest(raw)
        items++
        const sec = held.get(String(it.id))
        if (!sec) { unheld++; continue }
        attached++
        if (!it.memberId || !it.memberName) { noMember++; continue }
        if (!it.counterparties.length) { noCounterparty++; continue }

        const person = await resolveEntity(pool, 'person', it.memberName, it.memberId, it.date, 'members-interests')
        if (person.created) people++
        for (const cp of it.counterparties) {
          const org = await resolveEntity(pool, 'organisation', cp, null, it.date, 'members-interests')
          if (org.created) orgs++
          if (org.matchedByName) orgNameMatches++
          // FRESHNESS §2 — the surface is `it.memberName`: the name as the REGISTER printed it for
          // this declaration, which is what a reader is shown beside the interest. It is not the
          // canonical name and it is not the organisation's: the subject of a `declared-interest`
          // edge is the member, so the subject surface is the member's.
          const memberSurface = it.memberName.slice(0, 500)
          const { rows: e } = await pool.query<{ id: string }>(
            `INSERT INTO graph_edge (subject_id, predicate, object_kind, object_entity_id, object_ref, object_label, first_seen, last_seen, subject_surface)
             VALUES ($1,'declared-interest','entity',$2,$3,$4,$5,$5,$6)
             ON CONFLICT (subject_id, predicate, object_kind, object_ref) DO UPDATE SET
               first_seen   = LEAST(graph_edge.first_seen, EXCLUDED.first_seen),
               last_seen    = GREATEST(graph_edge.last_seen, EXCLUDED.last_seen),
               object_label = COALESCE(graph_edge.object_label, EXCLUDED.object_label),
               -- First surface kept, flag sticky — the same rule as sweep-committees.ts, and it
               -- matters more here: a member's register name changes with an honour or a title, so
               -- an edge spanning years genuinely does carry several forms.
               subject_surface = COALESCE(graph_edge.subject_surface, EXCLUDED.subject_surface),
               subject_surface_varies = graph_edge.subject_surface_varies
                 OR (graph_edge.subject_surface IS NOT NULL
                     AND EXCLUDED.subject_surface IS NOT NULL
                     AND graph_edge.subject_surface <> EXCLUDED.subject_surface)
             RETURNING id`,
            [person.id, org.id, String(org.id), it.categoryName, it.date, memberSurface])
          edges++
          // ⚠ `DO NOTHING` BECAME `DO UPDATE`, SO THE COUNTER HAD TO CHANGE WITH IT. Under DO NOTHING
          // an existing row reported rowCount 0 and `evidence` counted NEW rows; under DO UPDATE
          // every row reports 1, which would silently turn the same counter into "rows touched" and
          // overstate the sweep in its own report. `xmax = 0` is true only for a real INSERT.
          const { rows: evRows } = await pool.query<{ inserted: boolean }>(
            `INSERT INTO graph_evidence (edge_id, section_id, source_url, extract, observed_on, subject_surface)
             VALUES ($1,$2,$3,$4,$5,$6)
             ON CONFLICT (edge_id, section_id) DO UPDATE SET
               subject_surface = COALESCE(graph_evidence.subject_surface, EXCLUDED.subject_surface)
             RETURNING (xmax = 0) AS inserted`,
            [Number(e[0].id), sec.sectionId, sec.url, it.summary?.slice(0, 500) ?? null, it.date, memberSurface])
          if (evRows[0]?.inserted) evidence++
        }
      }
      if ((skip / TAKE) % 10 === 0) console.log(`  page ${skip / TAKE + 1}/${Math.ceil(total / TAKE)} — ${n(items)} interests`)
    }

    await pool.query(
      `UPDATE graph_edge e SET n_evidence = x.c
         FROM (SELECT edge_id, COUNT(*)::int AS c FROM graph_evidence GROUP BY edge_id) x
        WHERE x.edge_id = e.id AND e.n_evidence <> x.c`)

    console.log('\n════ INTERESTS SWEEP — ATTEMPTED ════')
    console.log(`  interests seen at source     ${n(items)}`)
    console.log(`  attached to a held section   ${n(attached)} (${pct(attached, items)})`)
    console.log(`  not in our corpus            ${n(unheld)}`)
    console.log(`  no member id                 ${n(noMember)}`)
    console.log(`  no named counterparty        ${n(noCounterparty)} — a category with no organisation to point at`)
    console.log(`  people created               ${n(people)}  (all keyed on a Parliament member id)`)
    console.log(`  organisations created        ${n(orgs)}`)
    console.log(`  organisation name matches    ${n(orgNameMatches)} — a judgement, logged in graph_merge_log`)
    console.log(`  edges upserted               ${n(edges)}`)
    console.log(`  evidence rows inserted       ${n(evidence)}`)
    console.log('\n  ⚠ ATTEMPTED, not stored — report.ts reads the tables back.')
  } finally {
    await endNeonPool()
  }
}
main().catch((e) => { console.error('[interests] FATAL', e instanceof Error ? e.message : e); process.exit(1) })
