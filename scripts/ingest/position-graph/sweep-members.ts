/**
 * sweep-members.ts — BRIEF_GRAPH_2D2 §2: make people real.
 *
 * 2D-1 left 99.6% of person entities resting on a name match at 0.7 confidence, and said so in its
 * own report rather than burying it. This is the fix: Parliament's own register (members-api,
 * OPL v3.0) supplies a stable id and EVERY DATED NAME FORM per member, and those name forms are
 * what decide the two questions a name match cannot answer —
 *
 *   MERGE  two entities that are one person   ("Theresa May" / "Baroness May of Maidenhead", MNIS 8)
 *   SPLIT  one entity that is two people      (two members really called John Smith)
 *
 * ⚠ §2's rule, and the reason the split path is longer than the merge path: **a split is more
 * important than a merge and harder to notice.** A wrongly merged entity is one visible row that
 * looks odd. A wrongly single entity silently attributes half its edges to the wrong person, and
 * nothing about it looks wrong. So an entity whose name matches MORE THAN ONE member is never
 * resolved here — it is logged, counted, and reported in the headline.
 *
 * Usage (from scripts/ingest):
 *   npx tsx position-graph/sweep-members.ts --fetch          # populate the register from the API
 *   npx tsx position-graph/sweep-members.ts --resolve        # DRY RUN: report what it would do
 *   npx tsx position-graph/sweep-members.ts --resolve --apply
 *   npx tsx position-graph/sweep-members.ts --fetch --resolve --apply
 *
 * --apply does nothing without --resolve, and --resolve without --apply writes nothing at all.
 */
import path from 'path'
try { require('dotenv').config({ path: path.join(__dirname, '../../../scrutinise-web/.env') }) } catch { /* ok */ }

import { getNeonPool, endNeonPool } from '../shared/neon-pool'
import { normaliseName, normalisePersonName } from './graph-common'

export {}

const argv = process.argv.slice(2)
const DO_FETCH = argv.includes('--fetch')
const DO_RESOLVE = argv.includes('--resolve')
const APPLY = argv.includes('--apply')

const BASE = 'https://members-api.parliament.uk/api'
const UA = 'Scrutinise-Ingest/1.0 (+https://scrutinise.org; contact cl@scrutinise.org)'
const PAGE = 20          // the API caps take at 20 regardless of what is asked for (measured)
const CONCURRENCY = 4    // polite against a public API; the whole sweep is ~520 calls

const pool = getNeonPool()
const head = (s: string) => console.log(`\n════ ${s} ${'═'.repeat(Math.max(0, 78 - s.length))}`)

/**
 * ⚠ A single-token normalised name is not an identification.
 *
 * normalisePersonName strips honorifics, so "Lord Smith" becomes "smith" — and so does a committee
 * witness recorded only as "Smith". Matching on that would hand one peer every edge belonging to
 * every unrelated Smith in the corpus, which is the invisible contaminating direction the whole
 * design rules out. Two tokens is the floor, and the number rejected by this rule is REPORTED
 * rather than silently dropped, because a screen you cannot see the cost of is a screen you cannot
 * judge.
 */
const isIdentifying = (norm: string) => norm.split(' ').filter(Boolean).length >= 2

async function getJson(url: string, attempts = 4): Promise<any | null> {
  for (let i = 0; i < attempts; i++) {
    try {
      const res = await fetch(url, { headers: { Accept: 'application/json', 'User-Agent': UA } })
      if (res.ok) return await res.json()
      // 4xx other than 429 is an answer, not a rate limit — retrying it is the V36 defect.
      if (res.status !== 429 && res.status < 500) { console.log(`   HTTP ${res.status} ${url}`); return null }
    } catch { /* transient */ }
    if (i < attempts - 1) await new Promise((r) => setTimeout(r, 900 * (i + 1)))
  }
  console.log(`   gave up: ${url}`)
  return null
}

/** Run `fn` over `items` at fixed concurrency, preserving nothing but the side effects. */
async function pooled<T>(items: T[], fn: (t: T, i: number) => Promise<void>, n = CONCURRENCY) {
  let idx = 0
  await Promise.all(Array.from({ length: Math.min(n, items.length) }, async () => {
    for (;;) { const i = idx++; if (i >= items.length) return; await fn(items[i], i) }
  }))
}

const isoDay = (v: any): string | null =>
  typeof v === 'string' && /^\d{4}-\d{2}-\d{2}/.test(v) ? v.slice(0, 10) : null

// ══════════════════════════════════════════════════════════════════════════════════════════════
// PHASE 1 — the register
// ══════════════════════════════════════════════════════════════════════════════════════════════

interface NameRow { mnis: number; surface: string; start: string | null; end: string | null; source: string }

async function fetchRegister() {
  head('§2 PHASE 1 — Parliament Members API (OPL v3.0)')

  const first = await getJson(`${BASE}/Members/Search?skip=0&take=1`)
  const total: number = first?.totalResults ?? 0
  if (!total) { console.error('   ❌ totalResults = 0. Refusing to proceed on an empty register.'); process.exit(1) }
  console.log(`   register size: ${total} members (current + former, both houses)`)
  const pages = Array.from({ length: Math.ceil(total / PAGE) }, (_, i) => i * PAGE)
  console.log(`   ${pages.length} search calls at take=${PAGE}, concurrency ${CONCURRENCY}`)

  const members = new Map<number, any>()
  let done = 0
  await pooled(pages, async (skip) => {
    const d = await getJson(`${BASE}/Members/Search?skip=${skip}&take=${PAGE}`)
    for (const it of d?.items ?? []) if (it?.value?.id != null) members.set(it.value.id, it.value)
    if (++done % 50 === 0) console.log(`     search ${done}/${pages.length} … ${members.size} members`)
  })
  console.log(`   fetched ${members.size} distinct members`)
  if (members.size < total * 0.95) {
    console.error(`   ❌ got ${members.size} of ${total} — more than 5% missing. Refusing to write a partial register.`)
    process.exit(1)
  }

  // ── write the register
  const ids = [...members.keys()].sort((a, b) => a - b)
  for (let i = 0; i < ids.length; i += 500) {
    const chunk = ids.slice(i, i + 500).map((id) => members.get(id))
    const vals: any[] = []
    const ph = chunk.map((m, j) => {
      const h = m.latestHouseMembership ?? {}
      vals.push(m.id, m.nameDisplayAs ?? null, m.nameListAs ?? null, m.nameFullTitle ?? null,
        m.nameAddressAs ?? null, m.gender ?? null, h.house ?? null,
        m.latestParty?.name ?? null, m.latestParty?.abbreviation ?? null,
        h.membershipFrom ?? null, isoDay(h.membershipStartDate), isoDay(h.membershipEndDate),
        h.membershipStatus?.statusIsActive ?? null)
      const b = j * 13
      return `($${b + 1},$${b + 2},$${b + 3},$${b + 4},$${b + 5},$${b + 6},$${b + 7},$${b + 8},$${b + 9},$${b + 10},$${b + 11},$${b + 12},$${b + 13})`
    }).join(',')
    await pool.query(
      `INSERT INTO graph_member_register (mnis_id, name_display, name_list, name_full_title, name_address,
         gender, latest_house, latest_party, latest_party_abbrev, membership_from, membership_start,
         membership_end, is_current)
       VALUES ${ph}
       ON CONFLICT (mnis_id) DO UPDATE SET
         name_display=EXCLUDED.name_display, name_list=EXCLUDED.name_list,
         name_full_title=EXCLUDED.name_full_title, name_address=EXCLUDED.name_address,
         gender=EXCLUDED.gender, latest_house=EXCLUDED.latest_house,
         latest_party=EXCLUDED.latest_party, latest_party_abbrev=EXCLUDED.latest_party_abbrev,
         membership_from=EXCLUDED.membership_from, membership_start=EXCLUDED.membership_start,
         membership_end=EXCLUDED.membership_end, is_current=EXCLUDED.is_current,
         fetched_at=now()`, vals)
  }
  console.log(`   graph_member_register ← ${ids.length} rows`)

  // ── name history, batched 20 ids per call
  const names: NameRow[] = []
  for (const m of members.values()) {
    for (const [f, src] of [[m.nameDisplayAs, 'display'], [m.nameFullTitle, 'full-title'], [m.nameAddressAs, 'address']] as const) {
      if (f) names.push({ mnis: m.id, surface: String(f), start: null, end: null, source: src })
    }
  }
  const batches: number[][] = []
  for (let i = 0; i < ids.length; i += 20) batches.push(ids.slice(i, i + 20))
  console.log(`   ${batches.length} history calls at 20 ids each`)
  let hdone = 0, withHistory = 0
  await pooled(batches, async (b) => {
    const d = await getJson(`${BASE}/Members/History?${b.map((i) => `ids=${i}`).join('&')}`)
    for (const rec of Array.isArray(d) ? d : []) {
      const v = rec?.value ?? rec
      const id = v?.id
      if (id == null) continue
      const nh = v.nameHistory
      if (Array.isArray(nh) && nh.length) {
        withHistory++
        for (const n of nh) {
          const s = n.nameDisplayAs ?? n.displayAs ?? n.nameFullTitle
          if (s) names.push({ mnis: id, surface: String(s), start: isoDay(n.startDate), end: isoDay(n.endDate), source: 'name-history' })
        }
      }
    }
    if (++hdone % 50 === 0) console.log(`     history ${hdone}/${batches.length}`)
  })
  console.log(`   ${withHistory} members returned a nameHistory; ${names.length} name rows before the division-votes fold`)

  // ── fold in the names Parliament itself used AT THE TIME OF EACH DIVISION.
  // Free, dated, and it is the only source here that carries a member's name as at a past date
  // rather than as at today — which is precisely what an entity built from an old document holds.
  const { rows: dvNames } = await pool.query<{ member_id: number; member_name: string; first: string; last: string }>(
    `SELECT member_id, member_name, MIN(division_date)::text AS first, MAX(division_date)::text AS last
       FROM division_votes GROUP BY 1,2`)
  for (const r of dvNames) names.push({ mnis: r.member_id, surface: r.member_name, start: r.first, end: r.last, source: 'division-votes' })
  console.log(`   + ${dvNames.length} (member, name) pairs from division_votes → ${names.length} name rows`)

  // ⚠ Only names whose member is in the register can be written (the FK). A division voter absent
  // from the register is a REAL finding about the register, not a row to force in, so it is counted.
  const known = new Set(ids)
  const orphanNames = names.filter((n) => !known.has(n.mnis))
  const orphanIds = new Set(orphanNames.map((n) => n.mnis))
  if (orphanIds.size) {
    console.log(`   ⚠ ${orphanIds.size} member ids vote in divisions but are ABSENT from the register: ${[...orphanIds].slice(0, 12).join(', ')}${orphanIds.size > 12 ? ' …' : ''}`)
  }
  const writable = names.filter((n) => known.has(n.mnis) && n.surface.trim())

  await pool.query('DELETE FROM graph_member_name')
  let wrote = 0
  for (let i = 0; i < writable.length; i += 400) {
    const chunk = writable.slice(i, i + 400)
    const vals: any[] = []
    const ph = chunk.map((n, j) => {
      vals.push(n.mnis, n.surface.trim(), normalisePersonName(n.surface), n.start, n.end, n.source)
      const b = j * 6
      return `($${b + 1},$${b + 2},$${b + 3},$${b + 4},$${b + 5},$${b + 6})`
    }).join(',')
    const r = await pool.query(
      `INSERT INTO graph_member_name (mnis_id, surface, surface_norm, start_date, end_date, source)
       VALUES ${ph} ON CONFLICT (mnis_id, surface, source) DO NOTHING`, vals)
    wrote += r.rowCount ?? 0
  }
  console.log(`   graph_member_name ← ${wrote} rows`)

  const { rows: [stat] } = await pool.query<{ n: string; m: string; ident: string }>(
    `SELECT COUNT(*)::text AS n, COUNT(DISTINCT mnis_id)::text AS m,
            COUNT(*) FILTER (WHERE array_length(string_to_array(surface_norm,' '),1) >= 2)::text AS ident
       FROM graph_member_name`)
  console.log(`   register now: ${stat.n} name forms over ${stat.m} members (${stat.ident} are ≥2 tokens and can identify)`)
}

// ══════════════════════════════════════════════════════════════════════════════════════════════
// PHASE 2 — resolve the graph's people against the register
// ══════════════════════════════════════════════════════════════════════════════════════════════

interface Ent {
  id: number; name_norm: string; canonical_name: string; parl_member_id: number | null
  first_seen: string | null; last_seen: string | null
}

/** Nobody has given evidence to a select committee at 105. The bound is deliberately absurd: it
 *  must only ever fire on an impossibility, never on an unusual but real career. */
const MAX_ACTIVE_AGE_YEARS = 105

/**
 * Could this entity and this member be the same LIVING PERSON?
 *
 * ⚠ A name match against a curated register is STILL A NAME MATCH. This is the one cheap piece of
 * corroboration available, and it is what separates the sweep measuring something from the sweep
 * asserting something.
 *
 * ⚠⚠ IT TESTS LIFESPAN, NOT TENURE, AND THE FIRST VERSION TESTING TENURE WAS WRONG.
 * That version rejected a match whenever the entity was active after the member's seat ended, and
 * it killed 216 rows — including "Dame Joan Ruddock", active 2023→2026 against a Commons window
 * ending 2015. **A former MP giving evidence to a committee after leaving Parliament is the normal
 * case, not a contradiction**; treating it as one would have silently discarded exactly the people
 * this graph is most interested in. The high side of a tenure window carries no information about
 * identity and has been removed.
 *
 * What survives is the part that is actually impossible, tested against the member's DATE OF BIRTH
 * (the register's nameHistory begins there — MNIS 8's first name row starts 1956-10-01):
 *
 *   · activity entirely BEFORE the member was born
 *   · activity beginning more than 105 years after the member was born
 *
 * ⚠⚠ THE WINDOW COMES FROM THE ENTITY'S EDGES, NOT FROM graph_entity.first_seen, and finding out
 * why cost a run. 2D-1's spine has a defect: **`first_seen` equals `last_seen` on 100% of the
 * 46,298 person entities** (the upsert wrote both from whichever row was in hand), while the edges
 * beneath them span 2012–2026. "Mr Andrew Smith" read as a one-day actor in June 2026; his own
 * edges start 2014-12-18. The entity date was the broken instrument, not the match.
 *
 * Returns 'plausible' | 'impossible' | 'untestable'. **'untestable' is not 'pass'** — it is counted
 * and reported separately, because a check that silently waves through every row it cannot evaluate
 * is a check that cannot fail.
 */
function lifespanAllows(
  act: { lo: string; hi: string } | undefined,
  born: string | null | undefined,
): 'plausible' | 'impossible' | 'untestable' {
  if (!act || !born) return 'untestable'
  if (act.hi < born) return 'impossible'                       // active before they existed
  const ceiling = `${String(Number(born.slice(0, 4)) + MAX_ACTIVE_AGE_YEARS).padStart(4, '0')}${born.slice(4)}`
  if (act.lo > ceiling) return 'impossible'                    // still active at 105+
  return 'plausible'
}

async function resolve() {
  head(`§2 PHASE 2 — resolution ${APPLY ? '(APPLYING)' : '(DRY RUN — nothing will be written)'}`)

  const { rows: [rc] } = await pool.query<{ n: string }>(`SELECT COUNT(*)::text AS n FROM graph_member_name`)
  if (Number(rc.n) === 0) { console.error('   ❌ graph_member_name is empty — run --fetch first.'); process.exit(1) }

  // Each member's DATE OF BIRTH, where the register actually supplies one.
  //
  // ⚠ IT DOES NOT ALWAYS SUPPLY ONE, AND THE FIRST VERSION OF THIS ASSUMED IT DID. The register's
  // nameHistory begins at birth for some members (MNIS 8's first row is 1956-10-01) and at the day
  // they took their seat for others — measured, 16 Aug 2026: **1,690 of 5,234 have an earliest name
  // date that PRECEDES their seat by 20–81 years (a birth date); 3,470 have one EQUAL to the seat
  // date (not a birth date at all); 54 have no history**. Taking the second group as a birth date
  // ruled four 2024-intake MPs "impossible" because a witness of the same name was active in 2022 —
  // which is not impossible, it is what a candidate does before being elected. That is the tenure
  // error again in a different hat.
  //
  // So a date only counts as a birth date if it is at least 18 years before the member took a seat,
  // 18 being the minimum age to stand. Everything else is NULL here, and NULL means untestable —
  // which is reported as its own number rather than folded into "passed".
  const { rows: bornRows } = await pool.query<{ mnis_id: number; born: string | null }>(
    `SELECT r.mnis_id,
            (CASE WHEN MIN(n.start_date) FILTER (WHERE n.source='name-history')
                       <= r.membership_start - INTERVAL '18 years'
                  THEN MIN(n.start_date) FILTER (WHERE n.source='name-history') END)::text AS born
       FROM graph_member_register r LEFT JOIN graph_member_name n ON n.mnis_id = r.mnis_id
      GROUP BY r.mnis_id, r.membership_start`)
  const born = new Map<number, string | null>()
  for (const b of bornRows) born.set(b.mnis_id, b.born)
  const withBorn = [...born.values()].filter(Boolean).length
  console.log(`   ${withBorn} of ${born.size} members carry a usable date of birth (the rest make the screen untestable, not passed)`)

  // norm → the members who have ever used that name form. Only identifying (≥2 token) forms match.
  const { rows: nameRows } = await pool.query<{ surface_norm: string; mnis_id: number }>(
    `SELECT DISTINCT surface_norm, mnis_id FROM graph_member_name`)
  const normToMnis = new Map<string, Set<number>>()
  let nonIdentifying = 0
  for (const r of nameRows) {
    if (!isIdentifying(r.surface_norm)) { nonIdentifying++; continue }
    let s = normToMnis.get(r.surface_norm); if (!s) normToMnis.set(r.surface_norm, s = new Set())
    s.add(r.mnis_id)
  }
  console.log(`   ${normToMnis.size} identifying normalised name forms in the register`)
  console.log(`   ${nonIdentifying} single-token forms EXCLUDED by the ≥2-token rule (e.g. "Lord Smith" → "smith")`)

  // ⚠ A register name form that is itself shared by two members is a name that can never identify
  // anybody. Count it: it is the register's own measure of how much name-matching would have merged.
  const sharedForms = [...normToMnis.entries()].filter(([, s]) => s.size > 1)
  console.log(`   ${sharedForms.length} of those forms are shared by MORE THAN ONE member — name-matching would merge distinct people on every one of them`)
  for (const [n, s] of sharedForms.slice(0, 8)) console.log(`      "${n}" → MNIS ${[...s].join(', ')}`)

  // ── the graph's people
  const { rows: ents } = await pool.query<Ent>(
    `SELECT id::int AS id, name_norm, canonical_name, parl_member_id,
            first_seen::text AS first_seen, last_seen::text AS last_seen
       FROM graph_entity WHERE kind='person'`)
  console.log(`\n   ${ents.length} person entities in the graph`)

  // aliases give extra surfaces to try (a cisId merge can leave an entity holding a second norm)
  const { rows: aliasRows } = await pool.query<{ entity_id: number; surface: string }>(
    `SELECT a.entity_id::int AS entity_id, a.surface FROM graph_alias a
       JOIN graph_entity e ON e.id=a.entity_id WHERE e.kind='person'`)
  const aliasNorms = new Map<number, Set<string>>()
  for (const a of aliasRows) {
    const n = normalisePersonName(a.surface)
    if (!isIdentifying(n)) continue
    let s = aliasNorms.get(a.entity_id); if (!s) aliasNorms.set(a.entity_id, s = new Set())
    s.add(n)
  }

  // The REAL activity window of each person: the span of the edges they hold. See dateOverlaps.
  const { rows: actRows } = await pool.query<{ subject_id: number; lo: string; hi: string }>(
    `SELECT g.subject_id::int AS subject_id, MIN(g.first_seen)::text AS lo, MAX(g.last_seen)::text AS hi
       FROM graph_edge g JOIN graph_entity e ON e.id = g.subject_id
      WHERE e.kind='person' AND g.first_seen IS NOT NULL GROUP BY 1`)
  const activity = new Map<number, { lo: string; hi: string }>()
  for (const a of actRows) activity.set(a.subject_id, { lo: a.lo, hi: a.hi ?? a.lo })
  const spans = actRows.filter((a) => a.lo !== a.hi).length
  console.log(`   activity windows from edges: ${activity.size} people, ${spans} of them spanning more than one day`)
  console.log(`   ⚠ graph_entity.first_seen is UNUSABLE for this — it equals last_seen on every person row (2D-1 defect, reported)`)

  const mnisHolder = new Map<number, Ent>()
  for (const e of ents) if (e.parl_member_id != null) mnisHolder.set(e.parl_member_id, e)

  const resolved: Array<{ e: Ent; mnis: number; dated: string }> = []
  const merges: Array<{ e: Ent; into: Ent; mnis: number; dated: string }> = []
  const splits: Array<{ e: Ent; mnis: number[] }> = []
  const disagree: Array<{ e: Ent; held: number; matched: number[] }> = []
  const killedByDate: Array<{ e: Ent; mnis: number; born: any; act: any }> = []
  let unresolved = 0, tooShort = 0, untestable = 0

  for (const e of ents) {
    const surfaces = new Set<string>()
    if (isIdentifying(e.name_norm)) surfaces.add(e.name_norm); else tooShort++
    for (const a of aliasNorms.get(e.id) ?? []) surfaces.add(a)

    // Candidates, each carrying the verdict of the date test on the name form that matched.
    const act = activity.get(e.id)
    const cand = new Map<number, string>()
    for (const s of surfaces) {
      for (const m of normToMnis.get(s) ?? []) {
        if (!cand.has(m)) cand.set(m, lifespanAllows(act, born.get(m)))
      }
    }

    if (e.parl_member_id != null) {
      // Already keyed. A check that can fail: does the register agree with what 2D-1 stored?
      if (cand.size && !cand.has(e.parl_member_id)) disagree.push({ e, held: e.parl_member_id, matched: [...cand.keys()] })
      continue
    }
    if (cand.size === 0) { unresolved++; continue }

    // ⚠ The lifespan screen runs BEFORE the ambiguity screen, not after. Three members named Ian
    // Paisley is only an ambiguity if all three could be the actor; if two of them are impossible,
    // the third is an answer. Running the screens the other way round discards resolvable rows and
    // inflates the split count with cases that are not ambiguous at all.
    for (const [m, v] of [...cand] ) if (v === 'impossible') { killedByDate.push({ e, mnis: m, born: born.get(m), act }); cand.delete(m) }
    if (cand.size === 0) { unresolved++; continue }
    if (cand.size > 1) { splits.push({ e, mnis: [...cand.keys()].sort((a, b) => a - b) }); continue }

    const [mnis, verdict] = [...cand.entries()][0]
    if (verdict === 'untestable') untestable++
    const holder = mnisHolder.get(mnis)
    if (holder) merges.push({ e, into: holder, mnis, dated: verdict })
    else { resolved.push({ e, mnis, dated: verdict }); mnisHolder.set(mnis, e) }
  }

  // ── SECOND PASS: the peers the first pass could not see ───────────────────────────────────────
  //
  // ⚠ FOUND BY READING THE FIRST RUN'S OWN FAILURE, not by review. 212 members who hold votes came
  // out "blocked", and they were overwhelmingly peers: normalisePersonName strips `lord`,
  // `baroness`, `earl` and so on as honorifics, so **"Lord Lilley" normalises to "lilley"** — one
  // token — and the ≥2-token rule then correctly refused to identify anyone on it. That rule is
  // right. What was wrong is treating a peerage title as an honorific at all: for a peer the title
  // IS the name, and stripping it throws away the distinguishing half.
  //
  // The stored `graph_entity.name_norm` cannot be recomputed (it is a UNIQUE index and 2D-1's rows
  // depend on it), so this pass leaves it alone and matches on the RAW SURFACES instead, normalised
  // with `normaliseName`, which keeps the title. That makes the key MORE specific than pass one,
  // not less: "lord lilley" identifies more narrowly than "lilley" ever could. Same ambiguity screen
  // and same lifespan screen apply.
  const titleNormToMnis = new Map<string, Set<number>>()
  const { rows: regSurfaces } = await pool.query<{ surface: string; mnis_id: number }>(
    `SELECT DISTINCT surface, mnis_id FROM graph_member_name`)
  for (const r of regSurfaces) {
    const n = normaliseName(r.surface)
    if (n.split(' ').filter(Boolean).length < 2) continue
    let s = titleNormToMnis.get(n); if (!s) titleNormToMnis.set(n, s = new Set())
    s.add(r.mnis_id)
  }
  const entTitleSurfaces = new Map<number, Set<string>>()
  for (const e of ents) {
    const n = normaliseName(e.canonical_name)
    if (n.split(' ').filter(Boolean).length >= 2) entTitleSurfaces.set(e.id, new Set([n]))
  }
  for (const a of aliasRows) {
    const n = normaliseName(a.surface)
    if (n.split(' ').filter(Boolean).length < 2) continue
    let s = entTitleSurfaces.get(a.entity_id); if (!s) entTitleSurfaces.set(a.entity_id, s = new Set())
    s.add(n)
  }

  const done = new Set<number>([...resolved.map((r) => r.e.id), ...merges.map((m) => m.e.id), ...splits.map((s) => s.e.id)])
  let pass2 = 0, pass2Ambiguous = 0
  for (const e of ents) {
    if (e.parl_member_id != null || done.has(e.id)) continue
    const cand = new Map<number, string>()
    for (const s of entTitleSurfaces.get(e.id) ?? []) {
      for (const m of titleNormToMnis.get(s) ?? []) if (!cand.has(m)) cand.set(m, lifespanAllows(activity.get(e.id), born.get(m)))
    }
    for (const [m, v] of [...cand]) if (v === 'impossible') { killedByDate.push({ e, mnis: m, born: born.get(m), act: activity.get(e.id) }); cand.delete(m) }
    if (cand.size === 0) continue
    if (cand.size > 1) { pass2Ambiguous++; splits.push({ e, mnis: [...cand.keys()].sort((a, b) => a - b) }); continue }
    const [mnis, verdict] = [...cand.entries()][0]
    if (mnisHolder.has(mnis)) { merges.push({ e, into: mnisHolder.get(mnis)!, mnis, dated: verdict }); continue }
    resolved.push({ e, mnis, dated: verdict }); mnisHolder.set(mnis, e); pass2++
    unresolved = Math.max(0, unresolved - 1)
  }
  console.log(`   pass 2 (peerage titles kept rather than stripped): ${pass2} further resolutions, ${pass2Ambiguous} ambiguous`)

  head('§2 RESULT')
  const pct = (n: number) => `${((100 * n) / ents.length).toFixed(2)}%`
  console.log(`   person entities                     ${ents.length}`)
  console.log(`   already keyed before this sweep      ${ents.filter((e) => e.parl_member_id != null).length}`)
  console.log(`   ── RESOLVED to a register member     ${resolved.length}   ${pct(resolved.length)}`)
  console.log(`   ── MERGE (two entities, one person)  ${merges.length}   ${pct(merges.length)}`)
  console.log(`   ── ⚠ SPLIT (one entity, two people)  ${splits.length}   ${pct(splits.length)}`)
  console.log(`   ── unresolved (no register match)    ${unresolved}   ${pct(unresolved)}`)
  console.log(`   ── name too short to identify        ${tooShort}   ${pct(tooShort)}   (≥2-token rule)`)
  console.log(`   ── register DISAGREES with a key we already hold  ${disagree.length}`)
  console.log(`\n   THE LIFESPAN SCREEN — the only part of the register's dates that speaks to identity:`)
  console.log(`   ── candidate matches ruled IMPOSSIBLE  ${killedByDate.length}`)
  console.log(`   ── ⚠ untestable, counted as PASS but not proved  ${untestable}   (no earliest date on the member)`)
  for (const k of killedByDate.slice(0, 12)) {
    console.log(`      #${k.e.id} "${k.e.canonical_name}" active ${k.act?.lo ?? '?'}→${k.act?.hi ?? '?'}  vs MNIS ${k.mnis} born ${k.born ?? '?'}`)
  }
  if (killedByDate.length > 12) console.log(`      … and ${killedByDate.length - 12} more`)

  console.log(`\n   ⚠ WHAT "RESOLVED" MEANS HERE, STATED SO IT CANNOT BE READ UP:`)
  console.log(`     these ${resolved.length} rows are a NAME MATCH AGAINST A CURATED REGISTER, corroborated by a date`)
  console.log(`     window. They are stored as key_source='name-match' at confidence 0.9 — NOT as`)
  console.log(`     key_source='parl-member-id'. The only person entities resting on a stable key are the`)
  console.log(`     ${ents.filter((e) => e.parl_member_id != null).length} already keyed plus the ones phase 3 creates FROM the register.`)

  console.log(`\n   ⚠ SPLITS — one entity whose name matches more than one member. Every edge these`)
  console.log(`     entities hold is attributed to the wrong person some of the time. NOT resolved.`)
  for (const s of splits.slice(0, 20)) console.log(`      #${s.e.id} "${s.e.canonical_name}" → MNIS ${s.mnis.join(', ')}`)
  if (splits.length > 20) console.log(`      … and ${splits.length - 20} more`)

  // ⚠ Every merge is printed, not a sample. A merge deletes a row and moves its edges, and the
  // count is small enough to read — so it gets read rather than trusted.
  console.log(`\n   MERGES — ALL ${merges.length}, because each one deletes an entity and moves its edges:`)
  for (const m of merges) console.log(`      #${m.e.id} "${m.e.canonical_name}" → #${m.into.id} "${m.into.canonical_name}" (MNIS ${m.mnis}, dates ${m.dated})`)

  console.log(`\n   RESOLVED — sample:`)
  for (const r of resolved.slice(0, 15)) console.log(`      #${r.e.id} "${r.e.canonical_name}" → MNIS ${r.mnis} (dates ${r.dated})`)

  if (disagree.length) {
    console.log(`\n   ⚠ DISAGREEMENTS with keys 2D-1 already stored (neither side is assumed right):`)
    for (const d of disagree.slice(0, 20)) console.log(`      #${d.e.id} "${d.e.canonical_name}" holds ${d.held}, register says ${d.matched.join(', ')}`)
  }

  // Whatever happens next, phase 3 must know which entities phase 2 has claimed — otherwise a dry
  // run reports hundreds of spurious "blocked" rows that an apply run would not produce, and the
  // dry run stops being a preview of the apply.
  const claimed = new Set<number>([...resolved.map((r) => r.mnis), ...merges.map((m) => m.mnis)])
  for (const e of ents) if (e.parl_member_id != null) claimed.add(e.parl_member_id)

  if (!APPLY) { console.log(`\n   DRY RUN — nothing written. Re-run with --apply to commit.`); return { claimed } }

  // ── write ────────────────────────────────────────────────────────────────────────────────────
  head('§2 APPLYING')

  // ⚠ key_source stays 'name-match' and confidence stays below 1.0 ON PURPOSE. schema.sql says of
  // this column: "HOW identity was established, so a name-matched row can never be mistaken for a
  // keyed one". The register made the name match far better evidence; it did not turn it into a
  // stable key, and writing 'parl-member-id'/1.0 here would be an inference travelling as a
  // measurement. 0.9 rather than 0.7 because the match is against a curated register AND survived a
  // date test that killed ${killedByDate.length} others.
  let nRes = 0
  for (const r of resolved) {
    await pool.query(
      `UPDATE graph_entity SET parl_member_id=$2, key_source='name-match', confidence=0.9 WHERE id=$1`,
      [r.e.id, r.mnis])
    await pool.query(
      `INSERT INTO graph_merge_log (kind, kept_entity_id, merged_surface, merged_norm, reason, confidence, source)
       VALUES ('person', $1, $2, $3, $4, 0.9, 'members-api')`,
      [r.e.id, r.e.canonical_name, r.e.name_norm, `register-name-match (date test: ${r.dated})`])
    nRes++
  }
  console.log(`   attached a register member id to ${nRes} entities at confidence 0.9, key_source='name-match'`)

  // ⚠ A merge MOVES edges, aliases and evidence off one entity and deletes it. Every step is inside
  // one transaction and every one is logged, because graph_merge_log is what makes it reversible —
  // and because 2D-1's own report is right that some of these will be wrong.
  let nMerged = 0, nEdgeMoved = 0, nEdgeCollided = 0
  for (const m of merges) {
    const c = await pool.connect()
    try {
      await c.query('BEGIN')
      // Edges whose (subject, predicate, object) already exist on the target would violate the
      // unique index; those are the SAME edge seen twice, so the duplicate is dropped, not forced.
      const mv = await c.query(
        `UPDATE graph_edge SET subject_id=$2 WHERE subject_id=$1
           AND NOT EXISTS (SELECT 1 FROM graph_edge g2 WHERE g2.subject_id=$2
             AND g2.predicate=graph_edge.predicate AND g2.object_kind=graph_edge.object_kind
             AND g2.object_ref=graph_edge.object_ref)`, [m.e.id, m.into.id])
      nEdgeMoved += mv.rowCount ?? 0
      const left = await c.query<{ n: string }>(`SELECT COUNT(*)::text AS n FROM graph_edge WHERE subject_id=$1`, [m.e.id])
      nEdgeCollided += Number(left.rows[0].n)
      await c.query(
        `INSERT INTO graph_alias (entity_id, surface, surface_norm, source, n_seen, first_seen, last_seen)
         SELECT $2, surface, surface_norm, source, n_seen, first_seen, last_seen FROM graph_alias WHERE entity_id=$1
         ON CONFLICT (entity_id, surface, source) DO NOTHING`, [m.e.id, m.into.id])
      await c.query(
        `INSERT INTO graph_merge_log (kind, kept_entity_id, merged_surface, merged_norm, reason, confidence, source)
         VALUES ('person', $1, $2, $3, 'merged-on-parl-member-id', 1.0, 'members-api')`,
        [m.into.id, m.e.canonical_name, m.e.name_norm])
      await c.query(`DELETE FROM graph_entity WHERE id=$1`, [m.e.id])   // cascades edges/aliases/evidence
      await c.query('COMMIT')
      nMerged++
    } catch (err) { await c.query('ROLLBACK'); console.error(`   ✗ merge #${m.e.id}→#${m.into.id}: ${(err as Error).message}`) }
    finally { c.release() }
  }
  console.log(`   merged ${nMerged} entities (${nEdgeMoved} edges moved, ${nEdgeCollided} were duplicates of an edge the target already held)`)

  // Splits are logged, never acted on.
  for (const s of splits) {
    await pool.query(
      `INSERT INTO graph_merge_log (kind, kept_entity_id, merged_surface, merged_norm, reason, confidence, source)
       VALUES ('person', $1, $2, $3, $4, 0.0, 'members-api')`,
      [s.e.id, s.e.canonical_name, s.e.name_norm, `SPLIT-DETECTED-NOT-RESOLVED: matches MNIS ${s.mnis.join('|')}`])
  }
  console.log(`   ⚠ logged ${splits.length} splits to graph_merge_log, resolved none of them`)

  // ⚠ REPAIR LAST, AND THE ORDERING IS THE WHOLE POINT.
  //
  // 2D-1 wrote first_seen and last_seen from whichever row was in hand at upsert time, so both hold
  // the LAST sighting and `first_seen` is a lie on every person row. The edges carry the real span,
  // so the span is copied back up.
  //
  // The first version ran this BEFORE the merges and verify-2d2.ts caught it: a merge moves edges
  // onto a target whose window was already computed, so one entity ended up with a one-day window
  // over multi-day edges. Recomputing after the edges have finished moving is the fix, and it is why
  // the check that found it exists. Idempotent — safe to re-run on its own.
  const rep = await pool.query(
    `UPDATE graph_entity e
        SET first_seen = w.lo, last_seen = w.hi
       FROM (SELECT subject_id, MIN(first_seen) AS lo, MAX(last_seen) AS hi
               FROM graph_edge WHERE first_seen IS NOT NULL GROUP BY subject_id) w
      WHERE e.id = w.subject_id AND e.kind = 'person'
        AND (e.first_seen IS DISTINCT FROM w.lo OR e.last_seen IS DISTINCT FROM w.hi)`)
  console.log(`   repaired first_seen/last_seen on ${rep.rowCount} person entities (2D-1 wrote both from one row)`)

  return { claimed }
}

// ══════════════════════════════════════════════════════════════════════════════════════════════
// PHASE 3 — an entity for every member who actually did something
// ══════════════════════════════════════════════════════════════════════════════════════════════

async function createActorEntities(claimed: Set<number>) {
  head(`§2 PHASE 3 — entities for members who hold an edge ${APPLY ? '(APPLYING)' : '(DRY RUN)'}`)
  // Only members with a `voted` or `signed-motion` edge to hold. Creating all 5,234 register rows
  // would fill the graph with actors that have done nothing in it, which is noise, not coverage.
  const { rows: need } = await pool.query<{ mnis_id: number; name_display: string; src: string }>(
    `WITH actors AS (
        SELECT DISTINCT member_id AS mnis_id, 'voted' AS src FROM division_votes
        UNION
        SELECT DISTINCT mnis_id, 'signed-motion' FROM edm_sponsor WHERE mnis_id IS NOT NULL)
      SELECT a.mnis_id, r.name_display, string_agg(DISTINCT a.src, '+') AS src
        FROM actors a JOIN graph_member_register r ON r.mnis_id = a.mnis_id
       WHERE NOT EXISTS (SELECT 1 FROM graph_entity e WHERE e.parl_member_id = a.mnis_id AND e.kind='person')
       GROUP BY a.mnis_id, r.name_display ORDER BY a.mnis_id`)
  // In a dry run the DB has not been updated, so phase 2's claims are supplied rather than read.
  const outstanding = need.filter((m) => !claimed.has(m.mnis_id))
  console.log(`   ${need.length} members hold an edge and had no entity when phase 2 started`)
  console.log(`   ${need.length - outstanding.length} of them were claimed by phase 2 (resolve or merge)`)
  console.log(`   ${outstanding.length} still need an entity of their own`)
  if (!outstanding.length) return { created: 0, blocked: [] as any[] }

  const blocked: Array<{ mnis: number; name: string; norm: string; existing: number }> = []
  let created = 0
  for (const m of outstanding) {
    if (!m.name_display) continue
    const norm = normalisePersonName(m.name_display)
    // ⚠ A collision on (kind, name_norm) here means an UNKEYED entity already carries this name and
    // phase 2 declined to resolve it — i.e. it is one of the ambiguous clusters. Attaching the key
    // to it anyway would resolve by accident exactly the case we refused to resolve on purpose.
    const { rows: clash } = await pool.query<{ id: string; parl_member_id: number | null }>(
      `SELECT id, parl_member_id FROM graph_entity WHERE kind='person' AND name_norm=$1`, [norm])
    if (clash.length) { blocked.push({ mnis: m.mnis_id, name: m.name_display, norm, existing: Number(clash[0].id) }); continue }
    if (!APPLY) { created++; continue }
    const { rows: [ins] } = await pool.query<{ id: string }>(
      `INSERT INTO graph_entity (kind, canonical_name, name_norm, parl_member_id, key_source, confidence, first_seen, last_seen)
       VALUES ('person', $1, $2, $3, 'parl-member-id', 1.0,
               (SELECT membership_start FROM graph_member_register WHERE mnis_id=$3),
               (SELECT COALESCE(membership_end, CURRENT_DATE) FROM graph_member_register WHERE mnis_id=$3))
       ON CONFLICT (kind, name_norm) DO NOTHING RETURNING id`, [m.name_display, norm, m.mnis_id])
    if (!ins) { blocked.push({ mnis: m.mnis_id, name: m.name_display, norm, existing: -1 }); continue }
    created++
    await pool.query(
      `INSERT INTO graph_alias (entity_id, surface, surface_norm, source, n_seen)
       SELECT $1, surface, surface_norm, 'members-api', 1 FROM graph_member_name WHERE mnis_id=$2
       ON CONFLICT (entity_id, surface, source) DO NOTHING`, [Number(ins.id), m.mnis_id])
  }
  console.log(`   ${APPLY ? 'created' : 'would create'} ${created} entities on a STABLE KEY (key_source='parl-member-id', confidence 1.0)`)
  console.log(`   ⚠ ${blocked.length} BLOCKED — an unkeyed entity already holds that exact name and phase 2 refused to resolve it`)
  console.log(`     (that refusal is the ambiguity screen working; forcing the key here would undo it)`)
  for (const b of blocked.slice(0, 15)) console.log(`      MNIS ${b.mnis} "${b.name}" ↔ existing entity #${b.existing}`)
  return { created, blocked }
}

async function main() {
  if (!DO_FETCH && !DO_RESOLVE) { console.log('nothing to do: pass --fetch and/or --resolve (add --apply to write)'); return }
  try {
    if (DO_FETCH) await fetchRegister()
    if (DO_RESOLVE) { const { claimed } = await resolve(); await createActorEntities(claimed) }
  } finally { await endNeonPool() }
}
main().catch((e) => { console.error('[sweep-members] FATAL', e instanceof Error ? e.message : e); process.exit(1) })
