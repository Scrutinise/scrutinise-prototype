/**
 * sweep-committees.ts — `gave-evidence-to` edges from the committees evidence we already hold
 * (BRIEF_GRAPH_2D1 §2/§3, the build's richest single source).
 *
 * WHAT §1 ESTABLISHED, AND WHY THERE IS NO LLM HERE
 * ------------------------------------------------
 * Measured, not assumed (position-graph/probe-corpus-shape.ts):
 *   · `corpus_sections` carries NO submitter at all for committees-evidence. `speaker` is 0.0%
 *     populated on 142,315 rows and `sectionTitle` is "{inquiry title} — {internalReference}".
 *   · The committees API still carries it, structured: witnesses[] with organisations[]
 *     {name, role, idmsId, cisId}, a submitterType, and the inquiry id — on 100% of the written
 *     items sampled and 87.5% of the oral ones.
 *   · And the LIST endpoints carry the same fields as the detail endpoints. That is the fact that
 *     sets the cost: ~1,440 paged calls rather than 142,315 detail calls (twenty minutes rather
 *     than twenty hours at the 500ms throttle floor).
 *
 * So the submitting organisation is a metadata sweep, exactly like `v34-bills-metadata.ts` did for
 * 6,574 bill rows. Nothing is extracted from prose and nothing is inferred.
 *
 * WHAT IS DELIBERATELY REFUSED
 *   · `anonymous` items are never attributed, whatever a witness field happens to contain.
 *   · `submitterType: 'Individual'` with no organisation is a PERSON edge, not a missing
 *     organisation. Treating it as missing data would understate coverage and invent a gap.
 *   · An edge is only written when the evidence item is in `corpus_sections`. The FK on
 *     graph_evidence enforces it: no edge can rest on a document nobody can open.
 *   · cisId = 0 is the API's "no id"; it is stored NULL, or every unkeyed body would collapse into
 *     one entity with id 0 — the invisible, contaminating direction.
 *
 * Usage (from scripts/ingest):
 *   npx tsx position-graph/sweep-committees.ts --predict     # count only, write nothing
 *   npx tsx position-graph/sweep-committees.ts --pilot 20    # 20 pages per kind, then write
 *   npx tsx position-graph/sweep-committees.ts               # the full sweep
 *   npx tsx position-graph/sweep-committees.ts --self-test   # normaliser + guards. No network, no DB.
 *
 * Idempotent: every write is an upsert on a natural key, so a re-run repairs rather than duplicates.
 */
import path from 'path'
try { require('dotenv').config({ path: path.join(__dirname, '../../../scrutinise-web/.env') }) } catch { /* ok */ }

import { getNeonPool, endNeonPool } from '../shared/neon-pool'
import { normaliseName, normalisePersonName, cleanCisId, isoDate, isUselessName, type EntityKind, type KeySource } from './graph-common'

export {}

const argv = process.argv.slice(2)
const has = (f: string) => argv.includes(`--${f}`)
const num = (f: string, d: number) => {
  const i = argv.indexOf(`--${f}`)
  const v = i >= 0 ? parseInt(argv[i + 1] ?? '', 10) : NaN
  return Number.isFinite(v) ? v : d
}
const PREDICT = has('predict')
const PILOT_PAGES = num('pilot', 0)
const TAKE = num('take', 1000) // 1,000 answered in 31s while 100 500d at the same offset — measured, not preferred
const THROTTLE_MS = num('throttle', 350)

const API = 'https://committees-api.parliament.uk/api'
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
      if (res.status === 429 || res.status >= 500) { await sleep(2000 * (i + 1)); continue }
      return null
    } catch { await sleep(2000 * (i + 1)) }
  }
  return null
}

// ── the shape we take off the wire ───────────────────────────────────────────────────────────────
interface Submitter {
  kind: EntityKind
  name: string
  cisId: number | null
  idmsId: string | null
  role: string | null
}
interface EvidenceItem {
  kind: 'writtenevidence' | 'oralevidence'
  id: number
  date: string | null
  inquiryId: string | null
  inquiryTitle: string | null
  committee: string | null
  anonymous: boolean
  submitters: Submitter[]
}

/** One list item → the submitters it names. The only place the API's shape is interpreted. */
export function parseItem(kind: EvidenceItem['kind'], raw: any): EvidenceItem {
  const biz = raw.committeeBusiness ?? (Array.isArray(raw.committeeBusinesses) ? raw.committeeBusinesses[0] : null)
  const committee = raw.committee?.name ?? (Array.isArray(raw.committees) ? raw.committees[0]?.name : null) ?? null
  const anonymous = raw.anonymous === true
  const submitters: Submitter[] = []
  if (!anonymous) {
    for (const w of Array.isArray(raw.witnesses) ? raw.witnesses : []) {
      const orgs = Array.isArray(w?.organisations) ? w.organisations : []
      for (const o of orgs) {
        if (isUselessName(o?.name)) continue
        submitters.push({ kind: 'organisation', name: String(o.name).trim(), cisId: cleanCisId(o?.cisId), idmsId: typeof o?.idmsId === 'string' ? o.idmsId : null, role: typeof o?.role === 'string' ? o.role : null })
      }
      // A named human is a person edge in their own right — as a witness who appeared, whether or
      // not they appeared FOR someone. `role` on the organisation is what links the two.
      if (!isUselessName(w?.name)) {
        submitters.push({ kind: 'person', name: String(w.name).trim(), cisId: null, idmsId: null, role: orgs.length ? (orgs[0]?.role ?? null) : (w?.submitterType ?? null) })
      }
    }
  }
  return {
    kind, id: Number(raw.id),
    date: isoDate(raw.publicationDate) ?? isoDate(raw.meetingDate) ?? isoDate(raw.activityStartDate),
    inquiryId: biz?.id ? String(biz.id) : null,
    inquiryTitle: biz?.title ?? null,
    committee, anonymous, submitters,
  }
}

// ── the write path, batched PER PAGE ─────────────────────────────────────────────────────────────
// ⚠ WHY BATCHED. The first version resolved and wrote one submitter at a time: ~4 round trips ×
// ~160,000 submitters ≈ 600,000 round trips to Neon, which at even 25ms each is over four hours of
// pure latency for a job whose actual work is eight minutes of API throttle. Per page (~100 items,
// ~150 submitters) this is 6 statements. The correctness rules are unchanged — a stable key still
// wins, a name match is still recorded as one — only the number of round trips moves.
interface Counters { created: number; merges: number; aliasRows: number; edgeRows: number; evidenceRows: number }

interface PendingSubmitter { s: Submitter; norm: string; date: string | null; inquiryId: string; inquiryLabel: string | null; sectionId: string; url: string | null }

async function writePage(pool: ReturnType<typeof getNeonPool>, pending: PendingSubmitter[], source: string, c: Counters) {
  if (!pending.length) return

  // 1. One row per distinct (kind, norm) on this page. Deduplicating first is not an optimisation:
  //    a multi-row ON CONFLICT DO UPDATE cannot touch the same row twice and errors if asked to.
  const distinct = new Map<string, PendingSubmitter>()
  for (const p of pending) {
    const key = `${p.s.kind}:${p.norm}`
    const prev = distinct.get(key)
    // Prefer the occurrence that carries a stable key, so a keyed row is created keyed.
    if (!prev || (!prev.s.cisId && p.s.cisId)) distinct.set(key, p)
  }
  const rows = [...distinct.values()]

  // 2. Who already exists? Two lookups, one per identity route, in the order §3 requires: a stable
  //    key first, the normalised name second.
  const cisIds = rows.map((r) => r.s.cisId).filter((x): x is number => !!x)
  const byId = new Map<string, { id: number; canonical: string; keyed: boolean }>() // `${kind}:${norm}` → entity
  /** entity id → the cisId already stored on it, so a SECOND, different cisId can be spotted (5a). */
  const cisOf = new Map<number, number>()
  const cisToEntity = new Map<number, number>()
  if (cisIds.length) {
    const { rows: found } = await pool.query<{ id: string; kind: string; name_norm: string; canonical_name: string; parl_cis_id: number }>(
      `SELECT id, kind, name_norm, canonical_name, parl_cis_id FROM graph_entity WHERE parl_cis_id = ANY($1::int[])`, [cisIds])
    for (const f of found) { cisToEntity.set(f.parl_cis_id, Number(f.id)); cisOf.set(Number(f.id), f.parl_cis_id); byId.set(`${f.kind}:${f.name_norm}`, { id: Number(f.id), canonical: f.canonical_name, keyed: true }) }
  }
  const { rows: foundByName } = await pool.query<{ id: string; kind: string; name_norm: string; canonical_name: string; parl_cis_id: number | null }>(
    `SELECT id, kind, name_norm, canonical_name, parl_cis_id FROM graph_entity
      WHERE (kind, name_norm) IN (${rows.map((_, i) => `($${i * 2 + 1},$${i * 2 + 2})`).join(',')})`,
    rows.flatMap((r) => [r.s.kind, r.norm]))
  for (const f of foundByName) {
    byId.set(`${f.kind}:${f.name_norm}`, { id: Number(f.id), canonical: f.canonical_name, keyed: !!f.parl_cis_id })
    if (f.parl_cis_id) cisOf.set(Number(f.id), f.parl_cis_id)
  }

  // 3. Insert what is genuinely new. ON CONFLICT still guards the race with a concurrent run.
  const fresh = rows.filter((r) => !byId.has(`${r.s.kind}:${r.norm}`) && !(r.s.cisId && cisToEntity.has(r.s.cisId)))
  if (fresh.length) {
    const vals: string[] = []
    const params: unknown[] = []
    fresh.forEach((r, i) => {
      const b = i * 8
      vals.push(`($${b + 1},$${b + 2},$${b + 3},$${b + 4},$${b + 5},$${b + 6},$${b + 7},$${b + 8},$${b + 8})`)
      const keySource: KeySource = r.s.cisId ? 'parl-cis-id' : r.s.idmsId ? 'parl-idms-id' : 'singleton'
      params.push(r.s.kind, r.s.name.slice(0, 500), r.norm, r.s.cisId, r.s.idmsId, keySource, r.s.cisId || r.s.idmsId ? 1.0 : 0.7, r.date)
    })
    const { rows: made } = await pool.query<{ id: string; kind: string; name_norm: string; canonical_name: string }>(
      `INSERT INTO graph_entity (kind, canonical_name, name_norm, parl_cis_id, parl_idms_id, key_source, confidence, first_seen, last_seen)
       VALUES ${vals.join(',')}
       ON CONFLICT (kind, name_norm) DO UPDATE SET
         parl_cis_id  = COALESCE(graph_entity.parl_cis_id, EXCLUDED.parl_cis_id),
         parl_idms_id = COALESCE(graph_entity.parl_idms_id, EXCLUDED.parl_idms_id),
         first_seen   = LEAST(graph_entity.first_seen, EXCLUDED.first_seen),
         last_seen    = GREATEST(graph_entity.last_seen, EXCLUDED.last_seen)
       RETURNING id, kind, name_norm, canonical_name`,
      params)
    for (const m of made) byId.set(`${m.kind}:${m.name_norm}`, { id: Number(m.id), canonical: m.canonical_name, keyed: false })
    c.created += made.length
  }

  const entityFor = (p: PendingSubmitter): { id: number; canonical: string; keyed: boolean } => {
    if (p.s.cisId && cisToEntity.has(p.s.cisId)) {
      const id = cisToEntity.get(p.s.cisId)!
      return { id, canonical: p.s.name, keyed: true }
    }
    const e = byId.get(`${p.s.kind}:${p.norm}`)
    if (!e) throw new Error(`unresolved entity for ${p.s.kind} "${p.s.name}" (norm "${p.norm}") — the resolver missed a row it created`)
    return e
  }

  // 4. Aliases — every raw surface, with its own count. The original spelling is evidence.
  const aliasKey = new Map<string, { entityId: number; surface: string; norm: string; n: number; date: string | null }>()
  for (const p of pending) {
    const e = entityFor(p)
    const k = `${e.id}|${p.s.name}`
    const cur = aliasKey.get(k)
    if (cur) { cur.n++; if (p.date && (!cur.date || p.date < cur.date)) cur.date = p.date }
    else aliasKey.set(k, { entityId: e.id, surface: p.s.name.slice(0, 500), norm: p.norm, n: 1, date: p.date })
  }
  {
    const a = [...aliasKey.values()]
    const vals: string[] = []; const params: unknown[] = []
    a.forEach((x, i) => { const b = i * 5; vals.push(`($${b + 1},$${b + 2},$${b + 3},$${b + 4},$${b + 5},$${b + 5})`); params.push(x.entityId, x.surface, x.norm, x.n, x.date) })
    await pool.query(
      // ⚠ Every column CAST explicitly. A bare `VALUES (…) AS v(cols)` gives Postgres nothing to
      // infer parameter types from, and it types them all `text` — "column entity_id is of type
      // bigint but expression is of type text" on the first pilot run.
      `INSERT INTO graph_alias (entity_id, surface, surface_norm, source, n_seen, first_seen, last_seen)
       SELECT v.entity_id::bigint, v.surface::text, v.norm::text, '${source}', v.n::int, v.first_seen::date, v.last_seen::date
         FROM (VALUES ${vals.join(',')}) AS v(entity_id, surface, norm, n, first_seen, last_seen)
       ON CONFLICT (entity_id, surface, source) DO UPDATE SET
         n_seen     = graph_alias.n_seen + EXCLUDED.n_seen,
         first_seen = LEAST(graph_alias.first_seen, EXCLUDED.first_seen),
         last_seen  = GREATEST(graph_alias.last_seen, EXCLUDED.last_seen)`,
      params)
    c.aliasRows += a.length
  }

  // 5a. THE OTHER FOLD, and it took a hand-read to find: a submitter arriving with a cisId that
  //     lands on a row already holding a DIFFERENT cisId. The (kind, name_norm) index makes them one
  //     entity and COALESCE keeps the first key, so the second would be dropped silently.
  //
  //     Measured at source, 11 Aug 2026, over 3,031 organisation entries in four quarterly windows:
  //     58 of 2,161 distinct normal forms (2.68%) carry more than one cisId — "national grid" ×2,
  //     "kings college london" ×3, "electoral commission" ×2, "bar council" ×2. Reading them, each is
  //     ONE body registered more than once in Parliament's CIS, so the fold is RIGHT and cisId alone
  //     would have split King's College London into three actors. But right-by-default is not the
  //     same as recorded, so the fold is logged and the discarded key is named in it.
  {
    const clashes = rows
      .map((r) => ({ r, e: byId.get(`${r.s.kind}:${r.norm}`) }))
      .filter(({ r, e }) => !!e && !!r.s.cisId && !!cisOf.get(e!.id) && cisOf.get(e!.id) !== r.s.cisId)
    if (clashes.length) {
      const vals: string[] = []; const params: unknown[] = []
      clashes.forEach(({ r, e }, i) => {
        const b = i * 5
        vals.push(`($${b + 1},$${b + 2},$${b + 3},$${b + 4},'cis-id-clash',0.8,$${b + 5})`)
        params.push(e!.id, `${r.s.name.slice(0, 440)} [cisId ${r.s.cisId} discarded, kept ${cisOf.get(e!.id)}]`, r.norm, r.s.kind, source)
      })
      await pool.query(
        `INSERT INTO graph_merge_log (kept_entity_id, merged_surface, merged_norm, kind, reason, confidence, source)
         VALUES ${vals.join(',')}`, params)
      c.merges += clashes.length
    }
  }

  // 5. A fold worth logging: an UNKEYED entity acquiring a surface that is not its canonical name.
  //    That is precisely a name match — two spellings, one row, on a judgement rather than a key.
  const folds = [...aliasKey.values()].map((x) => ({ x, e: [...byId.values()].find((e) => e.id === x.entityId) }))
    .filter(({ x, e }) => e && !e.keyed && e.canonical !== x.surface)
  if (folds.length) {
    const vals: string[] = []; const params: unknown[] = []
    folds.forEach(({ x }, i) => { const b = i * 4; vals.push(`($${b + 1},$${b + 2},$${b + 3},$${b + 4},'name-match',0.7,'${source}')`); params.push(x.entityId, x.surface, x.norm, 'organisation') })
    await pool.query(
      `INSERT INTO graph_merge_log (kept_entity_id, merged_surface, merged_norm, kind, reason, confidence, source)
       VALUES ${vals.join(',')}`, params)
    c.merges += folds.length
  }

  // 6. Edges, then evidence. `n_evidence` is NOT incremented here — it is reconciled from
  //    graph_evidence at the end of the run, so it can never drift from what is actually stored.
  // FRESHNESS §2 — the surface travels with the edge, because it cannot be recovered afterwards.
  // `p.s.name` is the exact string this appearance was matched on, the same string that goes into
  // graph_alias. `varies` is set here rather than inferred later: within one run we can SEE the
  // second surface arrive, and across runs the ON CONFLICT below carries the flag forward.
  const edgeKey = new Map<string, {
    subjectId: number; ref: string; label: string | null; date: string | null
    surface: string; varies: boolean
  }>()
  for (const p of pending) {
    const e = entityFor(p)
    const k = `${e.id}|${p.inquiryId}`
    const surface = p.s.name.slice(0, 500)
    const cur = edgeKey.get(k)
    if (!cur) edgeKey.set(k, { subjectId: e.id, ref: p.inquiryId, label: p.inquiryLabel, date: p.date, surface, varies: false })
    else if (cur.surface !== surface) cur.varies = true
  }
  const edgeList = [...edgeKey.values()]
  const edgeIds = new Map<string, number>()
  {
    const vals: string[] = []; const params: unknown[] = []
    edgeList.forEach((x, i) => {
      const b = i * 6
      vals.push(`($${b + 1},'gave-evidence-to','inquiry',NULL,$${b + 2},$${b + 3},$${b + 4},$${b + 4},$${b + 5},$${b + 6})`)
      params.push(x.subjectId, x.ref, x.label, x.date, x.surface, x.varies)
    })
    const { rows: made } = await pool.query<{ id: string; subject_id: string; object_ref: string }>(
      `INSERT INTO graph_edge (subject_id, predicate, object_kind, object_entity_id, object_ref, object_label, first_seen, last_seen, subject_surface, subject_surface_varies)
       VALUES ${vals.join(',')}
       ON CONFLICT (subject_id, predicate, object_kind, object_ref) DO UPDATE SET
         first_seen   = LEAST(graph_edge.first_seen, EXCLUDED.first_seen),
         last_seen    = GREATEST(graph_edge.last_seen, EXCLUDED.last_seen),
         object_label = COALESCE(graph_edge.object_label, EXCLUDED.object_label),
         -- ⚠ THE FIRST SURFACE IS KEPT, NEVER OVERWRITTEN, and \`varies\` is STICKY. Overwriting
         -- would make the displayed name depend on which run happened last; clearing the flag would
         -- turn "one of several forms" back into "the form used", which is the invented fact this
         -- whole column exists to avoid.
         subject_surface = COALESCE(graph_edge.subject_surface, EXCLUDED.subject_surface),
         subject_surface_varies = graph_edge.subject_surface_varies
           OR EXCLUDED.subject_surface_varies
           OR (graph_edge.subject_surface IS NOT NULL
               AND EXCLUDED.subject_surface IS NOT NULL
               AND graph_edge.subject_surface <> EXCLUDED.subject_surface)
       RETURNING id, subject_id, object_ref`,
      params)
    for (const m of made) edgeIds.set(`${m.subject_id}|${m.object_ref}`, Number(m.id))
    c.edgeRows += made.length
  }

  // ⚠ THE EVIDENCE ROW IS WHERE THE SURFACE IS A FACT RATHER THAN A DISPLAY CHOICE: one appearance,
  // one surface, no aggregation. graph_edge.subject_surface is a first-seen copy of this for
  // reading without a join; this is the row that can be checked against the document.
  const evi = new Map<string, { edgeId: number; sectionId: string; url: string | null; date: string | null; surface: string }>()
  for (const p of pending) {
    const e = entityFor(p)
    const edgeId = edgeIds.get(`${e.id}|${p.inquiryId}`)
    if (!edgeId) continue
    evi.set(`${edgeId}|${p.sectionId}`, { edgeId, sectionId: p.sectionId, url: p.url, date: p.date, surface: p.s.name.slice(0, 500) })
  }
  {
    const a = [...evi.values()]
    if (a.length) {
      const vals: string[] = []; const params: unknown[] = []
      a.forEach((x, i) => { const b = i * 5; vals.push(`($${b + 1},$${b + 2},$${b + 3},$${b + 4},$${b + 5})`); params.push(x.edgeId, x.sectionId, x.url, x.date, x.surface) })
      await pool.query(
        `INSERT INTO graph_evidence (edge_id, section_id, source_url, observed_on, subject_surface)
         VALUES ${vals.join(',')}
         ON CONFLICT (edge_id, section_id) DO UPDATE SET
           -- A re-run of an EXISTING evidence row fills the surface where it was missing (the rows
           -- written before this column existed) and never changes one that is already recorded.
           subject_surface = COALESCE(graph_evidence.subject_surface, EXCLUDED.subject_surface)`, params)
      c.evidenceRows += a.length
    }
  }
}

// ── the sweep ────────────────────────────────────────────────────────────────────────────────────
/** Quarterly windows, newest first, so a run interrupted early has covered the current Parliament. */
export function quarters(fromYear: number, toYear: number): Array<{ start: string; end: string; label: string }> {
  const out: Array<{ start: string; end: string; label: string }> = []
  for (let y = toYear; y >= fromYear; y--) {
    for (const [q, s, e] of [['Q4', '10-01', '12-31'], ['Q3', '07-01', '09-30'], ['Q2', '04-01', '06-30'], ['Q1', '01-01', '03-31']] as const) {
      out.push({ start: `${y}-${s}`, end: `${y}-${e}`, label: `${y}${q}` })
    }
  }
  return out
}

/**
 * Walk one evidence kind in DATE WINDOWS, not by global offset.
 *
 * ⚠ MEASURED, 11 Aug 2026 ~04:30 UTC, and it is why this function has the shape it does:
 *   Skip=1000  Take=100/200/500 → HTTP 500 after ~31–36s;  Take=20 → 200 in 16s;  Take=1000 → 200 in 31s
 *   Skip=20,000 / 60,000 / 100,000 / 127,000, Take=100 → HTTP 500 every time
 * That is exactly what committees-api.ts already documents ("deep global offsets die server-side …
 * within a date window Skip stays shallow and the same query answers in ~2s"), so this uses the
 * route that is known to work rather than the one that reads more simply.
 *
 * A window that will not answer is recorded as a GAP and reported. A walk that quietly stops early
 * understates the source, which is worse than a walk that fails.
 */
async function walk(kind: EvidenceItem['kind'], onPage: (items: EvidenceItem[]) => Promise<void>): Promise<{ total: number; fetched: number; calls: number; gaps: string[] }> {
  const apiKind = kind === 'writtenevidence' ? 'WrittenEvidence' : 'OralEvidence'
  const first = await getJson(`${API}/${apiKind}?Skip=0&Take=1`)
  const total = first?.totalResults ?? 0
  const wins = quarters(num('from-year', 2010), num('to-year', new Date().getUTCFullYear()))
  const windows = PILOT_PAGES > 0 ? wins.slice(0, PILOT_PAGES) : wins
  let fetched = 0, calls = 0
  const gaps: string[] = []
  const seen = new Set<number>()

  for (const w of windows) {
    let skip = 0
    for (;;) {
      const d = await getJson(`${API}/${apiKind}?Skip=${skip}&Take=${TAKE}&StartDate=${w.start}&EndDate=${w.end}`)
      calls++
      const items: any[] = d?.items ?? []
      if (!d) { gaps.push(`${apiKind} ${w.label} skip=${skip}`); console.log(`  ⚠ GAP ${apiKind} ${w.label} skip=${skip} — the API would not answer after 4 attempts`); break }
      if (!items.length) break
      // Ids are deduped across windows: a StartDate/EndDate boundary that includes an item twice
      // would double-count it, and the count is the deliverable.
      const fresh = items.filter((raw) => !seen.has(Number(raw.id)))
      for (const raw of items) seen.add(Number(raw.id))
      fetched += fresh.length
      if (fresh.length) await onPage(fresh.map((raw) => parseItem(kind, raw)))
      if (items.length < TAKE) break
      skip += TAKE
      if (skip >= 20000) { gaps.push(`${apiKind} ${w.label} truncated at skip=${skip}`); console.log(`  ⚠ ${apiKind} ${w.label}: window exceeds 20,000 items — truncated rather than risking the deep-offset 500`); break }
    }
    console.log(`  ${apiKind} ${w.label}: ${n(fetched)} items so far (${calls} calls)`)
  }
  return { total, fetched, calls, gaps }
}

/** Which evidence items do we actually hold? The sweep can only build edges for these. */
async function heldSections(pool: ReturnType<typeof getNeonPool>): Promise<Map<string, { sectionId: string; url: string | null }>> {
  const out = new Map<string, { sectionId: string; url: string | null }>()
  const { rows } = await pool.query<{ id: string; parentDocId: string; sourceUrl: string | null }>(
    `SELECT id, "parentDocId", "sourceUrl" FROM corpus_sections
      WHERE corpus = 'committees-evidence' AND status = 'compiled'`)
  // One section per evidence item in this corpus (measured: 142,315 sections over 142,315 items),
  // but keep the FIRST deterministically rather than assuming it.
  for (const r of rows) if (!out.has(r.parentDocId)) out.set(r.parentDocId, { sectionId: r.id, url: r.sourceUrl })
  return out
}

function selfTest() {
  const cases: Array<[string, string, string]> = [
    ['organisation', 'The Chartered Institute of Housing', 'chartered institute of housing'],
    ['organisation', 'Humanity & Inclusion UK', 'humanity and inclusion uk'],
    ['organisation', "St John's Ambulance", 'st johns ambulance'],
    ['organisation', 'NHS  Providers', 'nhs providers'],
    ['person', 'Professor Gavin Philipson', 'gavin philipson'],
    ['person', 'Rt Hon Sir Keir Starmer MP', 'keir starmer'],
  ]
  let ok = 0
  for (const [kind, input, want] of cases) {
    const got = kind === 'person' ? normalisePersonName(input) : normaliseName(input)
    console.log(`  ${got === want ? '✓' : '✗'} ${JSON.stringify(input)} → ${JSON.stringify(got)}${got === want ? '' : ` (wanted ${JSON.stringify(want)})`}`)
    if (got === want) ok++
  }
  // The distinctions that MUST survive: folding any of these is the unrecoverable direction.
  const mustDiffer: Array<[string, string]> = [
    ['Smith Ltd', 'Smith plc'],
    ['RTPI', 'Royal Town Planning Institute'],
    ['Law Society', 'Law Society of Scotland'],
    ['Which?', 'Which Ltd'],
  ]
  let kept = 0
  for (const [a, b] of mustDiffer) {
    const same = normaliseName(a) === normaliseName(b)
    console.log(`  ${same ? '✗ FOLDED' : '✓ kept apart'}  ${a} / ${b}`)
    if (!same) kept++
  }
  // Names that must never become entities.
  // The last four are the ones the first full run proved were getting through: 'A Member of the
  // Public' became a person entity with six spellings before this was tightened.
  const junk = ['n/a', 'Anonymous', 'name withheld', '', '  ', 'NONE',
    'A Member of the Public', 'a member of the general public', 'Name Redacted', 'Anonymous submission']
  let refused = 0
  for (const j of junk) {
    const r = isUselessName(j)
    console.log(`  ${r ? '✓ refused' : '✗ ACCEPTED'}  ${JSON.stringify(j)}`)
    if (r) refused++
  }
  // And the parser, on the two shapes §1 found on the wire.
  const written = parseItem('writtenevidence', {
    id: 1, publicationDate: '2026-07-01T00:00:00', anonymous: false,
    committeeBusiness: { id: 9845, title: 'New Towns: Bricks and Mortar' },
    committees: [{ name: 'Housing Committee' }],
    witnesses: [{ submitterType: 'Organisation', name: null, organisations: [{ name: 'Royal Town Planning Institute', role: 'Policy Advisor', idmsId: 'https://id.parliament.uk/ap8ZKGXo', cisId: 71426 }] }],
  })
  const oral = parseItem('oralevidence', {
    id: 2, meetingDate: '2026-07-01T00:00:00', anonymous: false,
    committeeBusinesses: [{ id: 9498, title: 'Delivering the Neighbourhood Health Service: Estates' }],
    committees: [{ name: 'Health Committee' }],
    witnesses: [{ submitterType: 'Individual', name: 'Sir John Armitt', organisations: [{ name: 'National Infrastructure Commission', role: 'Chair', idmsId: null, cisId: 58586 }] }],
  })
  const anon = parseItem('writtenevidence', { id: 3, anonymous: true, witnesses: [{ name: 'Someone', organisations: [{ name: 'Somewhere', cisId: 5 }] }] })
  const checks: Array<[string, boolean]> = [
    ['written: inquiry id read from committeeBusiness', written.inquiryId === '9845'],
    ['written: organisation with cisId', written.submitters[0]?.name === 'Royal Town Planning Institute' && written.submitters[0]?.cisId === 71426],
    ['written: no person invented from a null witness name', written.submitters.length === 1],
    ['oral: inquiry id read from committeeBusinesses[]', oral.inquiryId === '9498'],
    ['oral: both the organisation and the named witness', oral.submitters.length === 2 && oral.submitters.some((s) => s.kind === 'person')],
    ['anonymous item yields NO submitters', anon.submitters.length === 0],
  ]
  for (const [label, pass] of checks) console.log(`  ${pass ? '✓' : '✗'} ${label}`)
  const allOk = ok === cases.length && kept === mustDiffer.length && refused === junk.length && checks.every(([, p]) => p)
  console.log(`\n[sweep] self-test ${allOk ? 'PASSED' : 'FAILED'}`)
  process.exit(allOk ? 0 : 1)
}

async function main() {
  if (has('self-test')) return selfTest()
  const pool = getNeonPool()
  try {
    console.log('[sweep] reading which committees-evidence items we hold…')
    const held = await heldSections(pool)
    console.log(`[sweep] ${n(held.size)} evidence items in corpus_sections (compiled)`)

    if (PREDICT) {
      // Predict before the run, so the outcome can be scored rather than admired.
      const w = await getJson(`${API}/WrittenEvidence?Skip=0&Take=1`)
      const o = await getJson(`${API}/OralEvidence?Skip=0&Take=1`)
      const pagesW = Math.ceil((w?.totalResults ?? 0) / TAKE), pagesO = Math.ceil((o?.totalResults ?? 0) / TAKE)
      console.log('\n════ PREDICTION (nothing written) ════')
      console.log(`  written evidence at source   ${n(w?.totalResults ?? 0)}  → ${n(pagesW)} pages`)
      console.log(`  oral evidence at source      ${n(o?.totalResults ?? 0)}  → ${n(pagesO)} pages`)
      console.log(`  API calls                    ${n(pagesW + pagesO + 2)} at ${THROTTLE_MS}ms ⇒ ~${(((pagesW + pagesO) * THROTTLE_MS) / 60000).toFixed(0)} min of throttle alone`)
      console.log(`  items we hold and can attach ${n(held.size)}`)
      console.log(`  expected gave-evidence-to edges: at the §1 sample rates (82.5% of written items`)
      console.log(`  name an organisation, oral items average 2.6 witnesses) roughly`)
      console.log(`    organisations  ~${n(Math.round(held.size * 0.8))} submissions attributed to a body`)
      console.log(`    people         ~${n(Math.round(15806 * 2.6 * 0.67 + 126509 * 0.175))} witness/individual appearances`)
      console.log('  distinct organisations is NOT predicted here — it is the number this sprint exists to find.')
      return
    }

    const c: Counters = { created: 0, merges: 0, aliasRows: 0, edgeRows: 0, evidenceRows: 0 }
    let items = 0, attached = 0, unheld = 0, anonymous = 0, noInquiry = 0, noSubmitter = 0, submitters = 0
    const t0 = Date.now()

    for (const kind of ['writtenevidence', 'oralevidence'] as const) {
      const source = kind === 'writtenevidence' ? 'committees-written' : 'committees-oral'
      const res = await walk(kind, async (parsed) => {
        const pending: PendingSubmitter[] = []
        for (const it of parsed) {
          items++
          if (it.anonymous) anonymous++
          const sec = held.get(`${kind}:${it.id}`)
          if (!sec) { unheld++; continue }
          attached++
          if (!it.inquiryId) { noInquiry++; continue }
          if (!it.submitters.length) { noSubmitter++; continue }
          for (const s of it.submitters) {
            const norm = s.kind === 'person' ? normalisePersonName(s.name) : normaliseName(s.name)
            if (!norm) continue
            submitters++
            pending.push({
              s, norm, date: it.date, inquiryId: it.inquiryId,
              inquiryLabel: it.inquiryTitle ? `${it.inquiryTitle}${it.committee ? ` (${it.committee})` : ''}` : it.committee,
              sectionId: sec.sectionId, url: sec.url,
            })
          }
        }
        await writePage(pool, pending, source, c)
      })
      console.log(`  ${kind}: ${n(res.fetched)} of ${n(res.total)} at source over ${n(res.calls)} calls; ${res.gaps.length} gap(s)`)
    }

    // n_evidence reconciled from what is actually STORED, never accumulated as the run goes. An
    // incremented counter and a row count that disagree is the "built inert" failure mode: a number
    // reporting success for writes that did not land.
    console.log('\n[sweep] reconciling graph_edge.n_evidence from graph_evidence…')
    const { rowCount: reconciled } = await pool.query(
      `UPDATE graph_edge e SET n_evidence = x.c
         FROM (SELECT edge_id, COUNT(*)::int AS c FROM graph_evidence GROUP BY edge_id) x
        WHERE x.edge_id = e.id AND e.n_evidence <> x.c`)

    const mins = (Date.now() - t0) / 60000
    console.log('\n════ SWEEP — ATTEMPTED ════')
    console.log(`  items seen at source          ${n(items)}`)
    console.log(`  attached to a held section    ${n(attached)} (${pct(attached, items)})`)
    console.log(`  not in our corpus             ${n(unheld)} — no edge written, by design`)
    console.log(`  anonymous                     ${n(anonymous)} — never attributed`)
    console.log(`  held but no inquiry id        ${n(noInquiry)}`)
    console.log(`  held but no named submitter   ${n(noSubmitter)}`)
    console.log(`  submitter mentions            ${n(submitters)}`)
    console.log(`  entity rows created           ${n(c.created)}`)
    console.log(`  name-match folds logged       ${n(c.merges)}`)
    console.log(`  alias upserts                 ${n(c.aliasRows)}`)
    console.log(`  edge upserts                  ${n(c.edgeRows)}`)
    console.log(`  evidence rows attempted       ${n(c.evidenceRows)}`)
    console.log(`  n_evidence rows reconciled    ${n(reconciled ?? 0)}`)
    console.log(`  elapsed                       ${mins.toFixed(1)} min`)
    console.log('\n  ⚠ ATTEMPTED, not stored. position-graph/report.ts reads the tables back, and only')
    console.log('    that number is a result — a tsc-clean write path reported SUCCESS on six real bugs')
    console.log('    the last time this project trusted its own counters (docs/CLAUDE.md, "built inert").')
  } finally {
    await endNeonPool()
  }
}
main().catch((e) => { console.error('[sweep] FATAL', e instanceof Error ? e.message : e); process.exit(1) })
