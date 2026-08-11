/**
 * probe-corpus-shape.ts — BRIEF_GRAPH_2D1 §1. What does the corpus actually hold?
 *
 * "Bytes before hypotheses, and this is the step most likely to change the rest of the brief." So
 * this answers the brief's questions with counts, and it asks TWO different questions that are easy
 * to run together and fatal to confuse:
 *
 *   1. What is in `corpus_sections` NOW — the only thing the graph can join to today.
 *   2. What the SOURCE still offers. A fact that exists structured on an API we already call, and
 *      was simply not carried into our columns, is a metadata sweep (deterministic, checkable,
 *      ~free — `v34-bills-metadata.ts` is the precedent, 6,574 rows repaired with 0 unmatched). A
 *      fact that exists only inside document prose is an extraction problem, and this brief
 *      explicitly does not authorise an LLM pipeline for it.
 *
 * The difference decides the sprint, so the probe measures both rather than reasoning from one.
 *
 * ⚠ Nothing here writes. No DDL, no upserts, no R2. Read-only against Neon and three public APIs.
 *
 * Usage (from scripts/ingest):
 *   npx tsx position-graph/probe-corpus-shape.ts              # DB shape + live source probes
 *   npx tsx position-graph/probe-corpus-shape.ts --db-only    # skip the network
 *   npx tsx position-graph/probe-corpus-shape.ts --sample 40  # API sample size per evidence kind
 */
import path from 'path'
try { require('dotenv').config({ path: path.join(__dirname, '../../../scrutinise-web/.env') }) } catch { /* ok */ }

import { getNeonPool, endNeonPool } from '../shared/neon-pool'

export {}

const argv = process.argv.slice(2)
const has = (f: string) => argv.includes(`--${f}`)
const num = (f: string, d: number) => {
  const i = argv.indexOf(`--${f}`)
  const v = i >= 0 ? parseInt(argv[i + 1] ?? '', 10) : NaN
  return Number.isFinite(v) ? v : d
}
const SAMPLE = num('sample', 40)

const n = (v: number | string) => Number(v).toLocaleString('en-GB')
const pct = (a: number, b: number) => (b ? `${((100 * a) / b).toFixed(1)}%` : 'n/a')
const head = (s: string) => console.log(`\n${'═'.repeat(4)} ${s} ${'═'.repeat(Math.max(0, 74 - s.length))}`)

const UA = 'Scrutinise-Ingest/1.0 (+https://scrutinise.org; contact cl@scrutinise.org)'
async function getJson(url: string): Promise<any | null> {
  for (let i = 0; i < 3; i++) {
    try {
      const res = await fetch(url, { headers: { Accept: 'application/json', 'User-Agent': UA } })
      if (res.ok) return await res.json()
      if (res.status === 429 || res.status >= 500) await new Promise((r) => setTimeout(r, 1500 * (i + 1)))
      else return null
    } catch { await new Promise((r) => setTimeout(r, 1500 * (i + 1))) }
  }
  return null
}

/** Keys present on an object, recursively one level — what a field ACTUALLY contains, not what our
 *  interface declares it contains. `organisations: unknown[]` in committees-api.ts is precisely the
 *  kind of declaration that hides whether a stable key is on the wire. */
function shapeOf(v: unknown, depth = 1): string {
  if (v === null || v === undefined) return 'null'
  if (Array.isArray(v)) return v.length ? `[${shapeOf(v[0], depth)}] ×${v.length}` : '[] (empty)'
  if (typeof v === 'object') {
    const entries = Object.entries(v as Record<string, unknown>)
    if (depth <= 0) return `{${entries.map(([k]) => k).join(',')}}`
    return `{${entries.map(([k, val]) => `${k}: ${typeof val === 'object' && val !== null ? shapeOf(val, depth - 1) : typeof val}`).join(', ')}}`
  }
  return typeof v
}

async function dbShape() {
  const pool = getNeonPool()
  const host = /@([^/:]+)/.exec(process.env.NEON_DATABASE_URL ?? process.env.DATABASE_URL ?? '')?.[1] ?? '(unknown)'
  console.log(`[probe] Neon host: ${host}`)

  head('§1a — the collections this sprint can draw on')
  const { rows: counts } = await pool.query<{ corpus: string; sections: string; compiled: string }>(`
    SELECT corpus, COUNT(*)::text AS sections,
           COUNT(*) FILTER (WHERE status = 'compiled')::text AS compiled
      FROM corpus_sections
     WHERE corpus LIKE 'committees%' OR corpus LIKE 'pwdata%' OR corpus IN
           ('historic-hansard', 'members-interests', 'inquiry-evidence', 'consultations', 'impact-assessments')
     GROUP BY corpus ORDER BY COUNT(*) DESC`)
  console.log('  corpus                         sections     compiled')
  for (const r of counts) console.log(`  ${r.corpus.padEnd(30)} ${n(r.sections).padStart(9)}   ${n(r.compiled).padStart(9)}`)

  head('§1b — which structured columns are actually populated')
  const { rows: fill } = await pool.query<Record<string, string>>(`
    SELECT corpus,
           COUNT(*)::text AS rows,
           COUNT("sectionTitle")::text AS titled,
           COUNT(speaker)::text        AS speakered,
           COUNT("itemDate")::text     AS dated,
           COUNT("parentDocId")::text  AS parented
      FROM corpus_sections
     WHERE corpus LIKE 'committees%' OR corpus LIKE 'pwdata%' OR corpus IN ('historic-hansard', 'members-interests')
     GROUP BY corpus ORDER BY COUNT(*) DESC`)
  console.log('  corpus                            rows   sectionTitle   speaker    itemDate   parentDocId')
  for (const r of fill) {
    const t = parseInt(r.rows, 10)
    console.log(`  ${r.corpus.padEnd(28)} ${n(r.rows).padStart(9)}   ${pct(+r.titled, t).padStart(10)}   ${pct(+r.speakered, t).padStart(7)}   ${pct(+r.dated, t).padStart(9)}   ${pct(+r.parented, t).padStart(11)}`)
  }
  console.log('  ⚠ a populated column is not the same as a USEFUL one — §1c reads the values.')

  head('§1c — committees-evidence: what is in the values, and can it be joined?')
  const { rows: kinds } = await pool.query<{ kind: string; rows: string; docs: string }>(`
    SELECT split_part("parentDocId", ':', 1) AS kind, COUNT(*)::text AS rows,
           COUNT(DISTINCT "parentDocId")::text AS docs
      FROM corpus_sections WHERE corpus = 'committees-evidence' GROUP BY 1 ORDER BY COUNT(*) DESC`)
  for (const r of kinds) console.log(`  ${(r.kind || '(none)').padEnd(18)} ${n(r.rows).padStart(8)} sections over ${n(r.docs).padStart(7)} evidence items`)

  const { rows: titles } = await pool.query<{ sectionTitle: string; c: string }>(`
    SELECT "sectionTitle", COUNT(*)::text AS c FROM corpus_sections
     WHERE corpus = 'committees-evidence' AND "sectionTitle" IS NOT NULL
     GROUP BY 1 ORDER BY COUNT(*) DESC LIMIT 12`)
  console.log('\n  the 12 most common sectionTitle values (is this an inquiry, a witness, or an organisation?):')
  for (const r of titles) console.log(`    ×${n(r.c).padStart(5)}  ${r.sectionTitle.slice(0, 92)}`)

  // The brief asks whether a submission can be joined to its inquiry and committee. `sectionTitle`
  // is written as `committeeBusiness.title — internalReference`, so measure how many carry the
  // separator: a title without it has no reference, and neither form carries an ID.
  const { rows: [sep] } = await pool.query<{ withref: string; total: string }>(`
    SELECT COUNT(*) FILTER (WHERE "sectionTitle" LIKE '% — %')::text AS withref, COUNT(*)::text AS total
      FROM corpus_sections WHERE corpus = 'committees-evidence' AND "sectionTitle" IS NOT NULL`)
  console.log(`\n  sectionTitle carrying the ' — internalReference' half: ${n(sep.withref)} of ${n(sep.total)} (${pct(+sep.withref, +sep.total)})`)

  head('§1d — members-interests: the person → organisation → category triple')
  // ⚠ NO `ORDER BY id`. With a corpus filter that plans as an index scan on the PRIMARY KEY across
  // all 22M rows looking for 3,448 matches, and it timed out at the 60s client limit on the first
  // run. The corpus index plus an unordered LIMIT answers in milliseconds.
  const { rows: mi } = await pool.query<{ sectionTitle: string | null; speaker: string | null; itemDate: string | null; id: string }>(`
    SELECT id, "sectionTitle", speaker, "itemDate"::text FROM corpus_sections
     WHERE corpus = 'members-interests' LIMIT 6`)
  for (const r of mi) console.log(`  ${r.id}\n     title=${r.sectionTitle ?? 'NULL'} | speaker=${r.speaker ?? 'NULL'} | date=${r.itemDate ?? 'NULL'}`)

  head('§1e — Hansard: is a speaker a member ID or a name string?')
  // Bounded sample, aggregated client-side: a GROUP BY over 8.8M pwdata speaker values is a minute
  // of Neon time to answer a question 50,000 rows answers identically.
  const { rows: sample } = await pool.query<{ speaker: string }>(`
    SELECT speaker FROM corpus_sections
     WHERE corpus = 'pwdata-debates' AND speaker IS NOT NULL LIMIT 50000`)
  const bySpeaker = new Map<string, number>()
  let looksLikeId = 0
  for (const r of sample) {
    bySpeaker.set(r.speaker, (bySpeaker.get(r.speaker) ?? 0) + 1)
    if (/^[0-9]+$/.test(r.speaker) || /publicwhip|uk\.org/i.test(r.speaker)) looksLikeId++
  }
  console.log(`  sampled ${n(sample.length)} pwdata-debates rows with a speaker; ${n(bySpeaker.size)} distinct values`)
  for (const [s, c] of [...bySpeaker.entries()].sort((a, b) => b[1] - a[1]).slice(0, 8)) console.log(`    ×${String(c).padStart(5)}  ${s.slice(0, 60)}`)
  console.log(`  values that look like an ID rather than a name: ${n(looksLikeId)} of ${n(sample.length)} (${pct(looksLikeId, sample.length)})`)

  return { counts, kinds }
}

/** Do the evidence items we hold still carry a structured submitter at the source? */
async function probeCommitteesApi(pool: ReturnType<typeof getNeonPool>) {
  head('§1f — LIVE committees API: is the submitting organisation structured at the source?')
  for (const kind of ['writtenevidence', 'oralevidence'] as const) {
    // Sample OUR OWN ids, so the answer is about the material we hold rather than about whatever
    // the API happens to return first.
    const { rows } = await pool.query<{ parentDocId: string }>(
      `SELECT DISTINCT "parentDocId" FROM corpus_sections
        WHERE corpus = 'committees-evidence' AND "parentDocId" LIKE $1
        ORDER BY "parentDocId" DESC LIMIT $2`, [`${kind}:%`, SAMPLE])
    if (!rows.length) { console.log(`  ${kind}: no rows in corpus_sections — nothing to sample`); continue }

    const apiKind = kind === 'writtenevidence' ? 'WrittenEvidence' : 'OralEvidence'
    let fetched = 0, withWitnesses = 0, withOrgs = 0, withInquiry = 0, withCommittee = 0, orgCount = 0, witnessCount = 0
    let anon = 0, withIdms = 0, withCis = 0
    const orgShapes = new Map<string, number>()
    const submitterTypes = new Map<string, number>()
    const examples: string[] = []
    for (const r of rows) {
      const id = r.parentDocId.split(':')[1]
      const item = await getJson(`https://committees-api.parliament.uk/api/${apiKind}/${id}`)
      if (!item) continue
      fetched++
      const w = Array.isArray(item.witnesses) ? item.witnesses : []
      if (w.length) { withWitnesses++; witnessCount += w.length }
      for (const x of w) submitterTypes.set(x?.submitterType ?? '(none)', (submitterTypes.get(x?.submitterType ?? '(none)') ?? 0) + 1)
      if (item.anonymous) anon++
      const orgs = w.flatMap((x: any) => (Array.isArray(x?.organisations) ? x.organisations : []))
      if (orgs.length) { withOrgs++; orgCount += orgs.length }
      for (const o of orgs) {
        if (o?.idmsId) withIdms++
        if (o?.cisId) withCis++ // 0 is the API's "none", so a truthy test is the right one here
      }
      for (const o of orgs.slice(0, 2)) {
        const s = shapeOf(o, 1)
        orgShapes.set(s, (orgShapes.get(s) ?? 0) + 1)
        if (examples.length < 4) examples.push(`${JSON.stringify(o).slice(0, 200)}`)
      }
      // ⚠ FIELD NAMES, corrected after the first run reported oral inquiries at 0.0%. Evidence items
      // do NOT carry `businesses` — that is the Publications field. Written evidence carries
      // `committeeBusiness` (an object), oral carries `committeeBusinesses` (an array). Reading the
      // wrong key made a source that identifies every inquiry look like one that identifies none.
      const biz = item.committeeBusiness ?? (Array.isArray(item.committeeBusinesses) ? item.committeeBusinesses[0] : null)
      if (biz?.id) withInquiry++
      if (item.committee?.name || (Array.isArray(item.committees) && item.committees.length)) withCommittee++
      if (examples.length < 4 && w.length && !orgs.length) examples.push(`witness with no organisations: ${JSON.stringify(w[0]).slice(0, 200)}`)
    }
    console.log(`\n  ${apiKind} — ${fetched}/${rows.length} items fetched`)
    console.log(`    carry witnesses[]           ${withWitnesses} (${pct(withWitnesses, fetched)}), ${witnessCount} witnesses in total`)
    console.log(`    carry an organisation       ${withOrgs} (${pct(withOrgs, fetched)}), ${orgCount} organisation entries`)
    console.log(`    org has idmsId / cisId      ${withIdms} / ${withCis} of ${orgCount} organisation entries`)
    console.log(`    identify the inquiry (id)   ${withInquiry} (${pct(withInquiry, fetched)})`)
    console.log(`    identify the committee      ${withCommittee} (${pct(withCommittee, fetched)})`)
    console.log(`    flagged anonymous           ${anon} (${pct(anon, fetched)})  ← must never be attributed`)
    console.log(`    submitterType: ${[...submitterTypes.entries()].sort((a, b) => b[1] - a[1]).map(([k, v]) => `${k}=${v}`).join(' ')}`)
    console.log('      ⚠ "Individual" is not missing data. A witness with no organisation because they')
    console.log('        submitted in a personal capacity is correctly attributed, not unattributed.')
    for (const [s, c] of [...orgShapes.entries()].sort((a, b) => b[1] - a[1]).slice(0, 3)) console.log(`    organisation shape ×${c}: ${s}`)
    for (const e of examples) console.log(`    e.g. ${e}`)
  }

  // The load-bearing fact for the build plan, measured rather than assumed: if the LIST endpoints
  // carry witnesses, a full sweep is ~1,440 paged calls. If only the per-item details do, it is
  // 142,315 calls at a 500ms floor — twenty hours instead of twenty minutes.
  console.log('\n  does the LIST endpoint carry the same metadata (this decides the sweep cost)?')
  for (const apiKind of ['WrittenEvidence', 'OralEvidence'] as const) {
    const d = await getJson(`https://committees-api.parliament.uk/api/${apiKind}?Skip=0&Take=50`)
    const items: any[] = d?.items ?? []
    if (!items.length) { console.log(`    ${apiKind}: list fetch failed — not evidence of absence`); continue }
    const w = items.filter((i) => (i.witnesses ?? []).length).length
    const o = items.filter((i) => (i.witnesses ?? []).some((x: any) => (x.organisations ?? []).length)).length
    const b = items.filter((i) => (i.committeeBusiness?.id) || (Array.isArray(i.committeeBusinesses) && i.committeeBusinesses[0]?.id)).length
    console.log(`    ${apiKind.padEnd(16)} total=${n(d.totalResults ?? 0)}  witnesses ${w}/${items.length}  organisation ${o}/${items.length}  inquiry id ${b}/${items.length}`)
  }
}

async function probeInterestsApi() {
  head('§1g — LIVE interests API: is the MP a stable member ID, and where is the organisation?')
  const d = await getJson('https://interests-api.parliament.uk/api/v1/Interests/?Take=25&ExpandChildInterests=true')
  const items: any[] = d?.items ?? []
  if (!items.length) { console.log('  no items returned — probe inconclusive, do not infer from this'); return }
  let withMemberId = 0
  const fieldNames = new Map<string, number>()
  for (const it of items) {
    if (it.member?.id !== undefined && it.member?.id !== null) withMemberId++
    for (const f of it.fields ?? []) fieldNames.set(f.name ?? f.description ?? '(unnamed)', (fieldNames.get(f.name ?? f.description ?? '(unnamed)') ?? 0) + 1)
  }
  console.log(`  items sampled                 ${items.length} of ${n(d.totalResults ?? 0)}`)
  console.log(`  carry member.id (Parliament)  ${withMemberId} (${pct(withMemberId, items.length)})`)
  console.log(`  member object shape           ${shapeOf(items[0].member, 1)}`)
  console.log(`  category object shape         ${shapeOf(items[0].category, 1)}`)
  console.log('  fields[] names, by frequency (the organisation is wherever this says it is):')
  for (const [k, c] of [...fieldNames.entries()].sort((a, b) => b[1] - a[1]).slice(0, 12)) console.log(`    ×${String(c).padStart(3)}  ${k}`)
  console.log(`  a whole item, for reading:\n    ${JSON.stringify(items[0]).slice(0, 700)}`)
}

async function probePwdata() {
  head('§1h — LIVE TWFY pwdata: does the raw XML carry a person ID we did not keep?')
  // One recent debates file. The parser reads `speakername` only; the question is whether
  // `speakerid`/`person_id` are on the wire, because that is the difference between a name-match
  // problem and a stable key.
  const idx = await fetch('https://www.theyworkforyou.com/pwdata/scrapedxml/debates/', { headers: { 'User-Agent': UA } })
    .then((r) => (r.ok ? r.text() : null)).catch(() => null)
  if (!idx) { console.log('  directory listing unreachable — probe not run, and that is not evidence of absence'); return }
  const files = [...idx.matchAll(/href="(debates\d{4}-\d{2}-\d{2}[a-z]\.xml)"/g)].map((m) => m[1]).sort()
  const file = files[files.length - 1]
  if (!file) { console.log('  no debates file found in the listing'); return }
  const xml = await fetch(`https://www.theyworkforyou.com/pwdata/scrapedxml/debates/${file}`, { headers: { 'User-Agent': UA } })
    .then((r) => (r.ok ? r.text() : null)).catch(() => null)
  if (!xml) { console.log(`  ${file} unreachable`); return }
  const speeches = [...xml.matchAll(/<speech\b[^>]*>/g)].map((m) => m[0])
  const attrCount = new Map<string, number>()
  for (const s of speeches) for (const a of s.matchAll(/\s([a-z_]+)="/g)) attrCount.set(a[1], (attrCount.get(a[1]) ?? 0) + 1)
  console.log(`  ${file}: ${speeches.length} <speech> elements`)
  console.log('  attributes present, by frequency:')
  for (const [k, c] of [...attrCount.entries()].sort((a, b) => b[1] - a[1])) console.log(`    ×${String(c).padStart(4)}  ${k}`)
  console.log(`  first element: ${speeches[0]?.slice(0, 200)}`)
}

async function main() {
  const pool = getNeonPool()
  try {
    await dbShape()
    if (!has('db-only')) {
      await probeCommitteesApi(pool)
      await probeInterestsApi()
      await probePwdata()
    }
    head('what this changes')
    console.log('  Read §1f/§1g/§1h against §1b: a fact that is structured AT THE SOURCE but absent from')
    console.log('  our columns is a metadata sweep, not an extraction problem. Only a fact that exists')
    console.log('  nowhere but in prose forces the question this brief refuses to answer with an LLM.')
  } finally {
    await endNeonPool()
  }
}
main().catch((e) => { console.error('[probe] FATAL', e); process.exit(1) })
