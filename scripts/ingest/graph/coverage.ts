/**
 * coverage.ts — GRAPH 4A §7. What the citation graph COULD NOT SEE, generated
 * from live state on every call.
 *
 * ── WHY THIS IS NON-NEGOTIABLE ───────────────────────────────────────────────
 *
 * `inbound()` returns rows. A list of rows is a claim about completeness, and
 * this graph is knowingly incomplete in named, quantified ways: the markup
 * detector sees 2–5% of the references actually in the text, 6.6% of act-name
 * spans resolve to nothing, 11.3% of rows sit in a document's title rather than
 * a provision, and whole layers — enabling powers with their evidence, case law,
 * treaties — are not in this table at all.
 *
 * **A gap that announces itself is better than a gap that looks like an absence
 * of evidence.** A user reading a list of 29 must be able to see what is not in
 * it. That is the platform's existing rule (`docs/CLAUDE.md` §18, §19) on a new
 * surface.
 *
 * ⚠⚠ **EVERY NUMBER HERE IS QUERIED, NOT WRITTEN DOWN.** The one exception is
 * the two extraction-run statistics, which are not properties of any row — those
 * live in `graph_coverage_fact` **with their measurement date**, and a fact past
 * its freshness window is reported as STALE, by name, inside the block. There is
 * no string in this file containing a figure about the corpus, and
 * `check-4a-coverage.ts` fails the build if one appears.
 *
 * The rule exists because the "17.5 GB Neon alert line" was a hardcoded caveat
 * that outlived its own truth, was retired twice, and came back a third time.
 *
 *   import { getCoverage, describeCoverage } from './coverage'
 */
import { getNeonPool } from '../shared/neon-pool'
import { CITATION_TABLE } from './setup-citation-edge-table'
import { COVERAGE_TABLE } from './setup-coverage-table'
import { EDGE_TABLE } from './graph-common'
import { IDENTITY_TABLE } from './identity'

/** The two corpora that hold statutory instruments. */
const SI_CORPORA = ['si-2010plus', 'si-pre-2010']

/** How old a recorded extraction statistic may be before the block says so. */
export const FRESHNESS_DAYS = 30

export type LayerStatus = 'searched' | 'not-built' | 'held-elsewhere'

export type Layer = {
  id: string
  what: string
  status: LayerStatus
  rows: number
  /** where the rows are, when status is 'held-elsewhere' */
  where?: string
  /** ⚠ what a reader loses because of this layer's status */
  consequence: string
}

export type RecordedFact = {
  key: string
  n: number | null
  note: string
  measuredAt: string
  measuredBy: string
  ageDays: number
  stale: boolean
}

export type Coverage = {
  generatedAt: string
  /** every layer, searched or not — a layer that is missing is NAMED */
  layers: Layer[]
  /** detector split within the searched layers; never summed unnamed */
  detection: Array<{ detection: string; rows: number; sourceDocs: number }>
  /** rows whose reference sits in a document's title or note, not a provision */
  notInAProvision: { rows: number; total: number; pct: number }
  /** targets normalised to an id the corpus holds no text for */
  unresolvedTargets: { rows: number; total: number; pct: number }
  /** extraction-run statistics, with their age */
  recorded: RecordedFact[]
  /** ⚠ any recorded fact past FRESHNESS_DAYS, by key */
  staleFacts: string[]
  /** case-law boundary, present only when case law is in scope for the caller */
  caseLawBoundary: { corpora: string[]; earliest: string | null; latest: string | null } | null
  /** ⚠⚠ GRAPH 4B §1 + §4. The identity bridge's RESIDUAL. Every figure live.
   *  A result that joined the two graph tables is only as complete as this. */
  identityBridge: {
    /** the bridge table is present and populated */
    built: boolean
    bridgedForms: number
    /** ⚠ id forms that name MORE THAN ONE instrument and were refused a bridge:
     *  two parliamentary sessions in one calendar year, each numbering its
     *  chapters from one. A question asked under one of these is ambiguous. */
    ambiguousTargets: number
    /** ⚠ regnal-form targets with no calendar twin — they cannot be joined
     *  against a table that keeps calendar forms, and never will be from here */
    unbridgeableTargets: number
    regnalTargets: number
  }
  /** ⚠ GRAPH 4B §2.2 + §4. Schedule coverage, because a scheduled treaty that
   *  is absent presents as a SHORT DOCUMENT, not as an error. */
  schedules: {
    instruments: number
    instrumentsWithASchedule: number
    pct: number
  }
}

/** Layers, DECLARED — but every status is decided by a live count, so a layer
 *  built tomorrow flips to 'searched' without anyone editing this list. */
const LAYER_PROBES: Array<{
  id: string; what: string; consequence: string
  count: () => Promise<{ rows: number; where?: string }>
}> = [
  {
    id: 'markup-citations',
    what: 'references the document asserted by <Citation URI>',
    consequence: 'the source names the target by identity, so the act-level match is not inferred',
    count: async () => ({ rows: await countCitation(`detection = 'markup'`) }),
  },
  {
    id: 'text-citations',
    what: "act NAMES resolved in running text against corpus_acts titles",
    consequence: 'the target id is DERIVED, not read from the document — never quote target_uri as the source’s own words',
    count: async () => ({ rows: await countCitation(`detection = 'text'`) }),
  },
  {
    id: 'enabling-power',
    what: 'made-under: "this instrument was made under section N of that Act", with the enacting words attached',
    // ⚠ State-neutral wording. `consequence` is printed only when the layer is
    // NOT searched, and GRAPH 4B built it — but a sentence that asserts "it is
    // not in this table" would become a lie the moment it was, which is exactly
    // how the retired storage figure survived. It describes what is LOST if the
    // layer is missing, not what the table currently contains.
    consequence: 'a stronger fact than a mention — an instrument that merely mentions an Act survives its repeal, while one whose ENABLING POWER is repealed may fall with it. Without this layer a consequence list cannot tell the two apart',
    // ⚠ The probe is `detection` outside the two textual detectors, NOT a phrase
    // match on citation_text. A first draft counted rows whose words happened to
    // contain "in exercise of the powers" and reported the layer as SEARCHED on
    // 858 incidental matches — a caveat that lied in the reassuring direction,
    // which is precisely what this block exists to prevent. The extractor
    // EXCLUDES <SecondaryPreamble>, so citation_edge structurally cannot hold an
    // enabling edge; building one means a new detection value, which means
    // widening the CHECK constraint, which is what flips this to 'searched'.
    count: async () => {
      const n = await countEdges(`edge_type = 'made-under'`)
      const here = await countCitation(`detection NOT IN ('markup', 'text')`)
      return { rows: here, where: n > 0 ? `${EDGE_TABLE} (${n.toLocaleString()} rows, no evidence column)` : undefined }
    },
  },
  {
    id: 'amendment-effects',
    what: 'amends / repeals / commences / modifies, from TNA’s own effects data',
    consequence: 'a repeal or amendment is not a citation and is not returned by this query',
    count: async () => {
      const n = await countEdges(`edge_type IN ('amends','repeals','commences','modifies')`)
      return { rows: 0, where: n > 0 ? `${EDGE_TABLE} (${n.toLocaleString()} rows)` : undefined }
    },
  },
  {
    id: 'case-law-citations',
    what: 'a judgment citing a statutory provision',
    consequence: 'a provision may be read down, disapplied or construed by a court with nothing here to show it',
    count: async () => ({ rows: await countCitation(`source_type = 'caselaw'`) }),
  },
  {
    id: 'treaty-obligations',
    what: 'a treaty article bearing on a domestic provision',
    consequence: 'a change may be prevented by an international obligation that this graph cannot see',
    count: async () => ({ rows: await countCitation(`source_type = 'treaty'`) }),
  },
]

async function countCitation(where: string): Promise<number> {
  const { rows } = await getNeonPool().query(`SELECT COUNT(*)::bigint n FROM ${CITATION_TABLE} WHERE ${where}`)
  return Number(rows[0].n)
}
async function countEdges(where: string): Promise<number> {
  const { rows } = await getNeonPool().query(`SELECT COUNT(*)::bigint n FROM ${EDGE_TABLE} WHERE ${where}`)
  return Number(rows[0].n)
}

const CASE_LAW_CORPORA = ['caselaw', 'caselaw-fcl', 'et-decisions', 'tax-tribunals']

export type CoverageOptions = {
  /** include the case-law date boundary — only relevant when case law is in scope */
  caseLaw?: boolean
}

let cached: { at: number; key: string; value: Coverage } | null = null
const CACHE_MS = 60_000

export async function getCoverage(opts: CoverageOptions = {}): Promise<Coverage> {
  const key = JSON.stringify(opts)
  if (cached && cached.key === key && Date.now() - cached.at < CACHE_MS) return cached.value
  const pool = getNeonPool()

  const layers: Layer[] = []
  for (const p of LAYER_PROBES) {
    const { rows, where } = await p.count()
    layers.push({
      id: p.id, what: p.what, rows, where,
      status: rows > 0 ? 'searched' : where ? 'held-elsewhere' : 'not-built',
      consequence: p.consequence,
    })
  }

  const { rows: det } = await pool.query(
    `SELECT detection, COUNT(*)::bigint n, COUNT(DISTINCT source_gid)::bigint docs
     FROM ${CITATION_TABLE} GROUP BY 1 ORDER BY n DESC`)

  const { rows: shape } = await pool.query(`
    SELECT COUNT(*)::bigint total,
           COUNT(*) FILTER (WHERE source_provision_ref IS NULL)::bigint no_provision,
           COUNT(*) FILTER (WHERE resolved = false)::bigint unresolved
    FROM ${CITATION_TABLE}`)
  const total = Number(shape[0].total)

  const { rows: facts } = await pool.query(
    `SELECT key, n, note, measured_at, measured_by,
            EXTRACT(EPOCH FROM (now() - measured_at)) / 86400 AS age_days
     FROM ${COVERAGE_TABLE} ORDER BY key`)
  const recorded: RecordedFact[] = facts.map((r: {
    key: string; n: string | null; note: string; measured_at: Date; measured_by: string; age_days: string
  }) => ({
    key: r.key, n: r.n === null ? null : Number(r.n), note: r.note,
    measuredAt: new Date(r.measured_at).toISOString(), measuredBy: r.measured_by,
    ageDays: Math.round(Number(r.age_days) * 10) / 10,
    stale: Number(r.age_days) > FRESHNESS_DAYS,
  }))

  let caseLawBoundary: Coverage['caseLawBoundary'] = null
  if (opts.caseLaw) {
    const { rows: cl } = await pool.query(`
      SELECT array_agg(DISTINCT corpus) AS corpora,
             MIN("itemDate")::text AS earliest, MAX("itemDate")::text AS latest
      FROM corpus_sections WHERE corpus = ANY($1::text[])`, [CASE_LAW_CORPORA])
    caseLawBoundary = { corpora: cl[0].corpora ?? [], earliest: cl[0].earliest, latest: cl[0].latest }
  }

  // ── the identity bridge's residual, live ────────────────────────────────────
  // ⚠ Everything here is a query. A bridge that stopped being rebuilt would
  // show up as `built: false` and as a rising unbridgeable count, not as a
  // quietly shorter answer.
  const { rows: bridgeExists } = await pool.query(
    `SELECT COUNT(*)::int n FROM information_schema.tables WHERE table_name = $1`, [IDENTITY_TABLE])
  const built = Number(bridgeExists[0].n) > 0
  let bridgedForms = 0, ambiguousTargets = 0, unbridgeableTargets = 0, regnalTargets = 0
  if (built) {
    bridgedForms = Number((await pool.query(
      `SELECT COUNT(*)::bigint n FROM ${IDENTITY_TABLE} WHERE canonical IS NOT NULL`)).rows[0].n)
    const { rows: r } = await pool.query(`
      SELECT COUNT(DISTINCT c.target_act_id)::bigint regnal,
             COUNT(DISTINCT c.target_act_id) FILTER (WHERE li.form IS NULL AND lc.canonical IS NULL)::bigint unbridgeable
      FROM ${CITATION_TABLE} c
      LEFT JOIN ${IDENTITY_TABLE} li ON li.form = c.target_act_id AND li.canonical IS NOT NULL
      LEFT JOIN ${IDENTITY_TABLE} lc ON lc.canonical = c.target_act_id
      WHERE c.target_act_id ~ '^[a-z]+/[A-Z]'`)
    regnalTargets = Number(r[0].regnal)
    unbridgeableTargets = Number(r[0].unbridgeable)
    // ⚠ A refusal is a ROW, not an absence — `basis = 'ambiguous-refused'` with
    // a NULL canonical. The first version of this query counted every target
    // with no bridge row, which is every post-1963 Act, and reported twenty
    // thousand ambiguous identities where there are a few dozen.
    const { rows: a } = await pool.query(`
      SELECT COUNT(DISTINCT c.target_act_id)::bigint n
      FROM ${CITATION_TABLE} c
      JOIN ${IDENTITY_TABLE} li ON li.form = c.target_act_id
      WHERE li.basis = 'ambiguous-refused'`)
    ambiguousTargets = Number(a[0].n)
  }

  // ── schedule coverage, live ─────────────────────────────────────────────────
  const { rows: sched } = await pool.query(`
    SELECT COUNT(DISTINCT split_part(id, ':', 2))::bigint instruments,
           COUNT(DISTINCT split_part(id, ':', 2)) FILTER (WHERE id ~ ':schedule')::bigint with_schedule
    FROM corpus_sections WHERE corpus = ANY($1::text[])`, [SI_CORPORA])
  const instruments = Number(sched[0].instruments)
  const withSchedule = Number(sched[0].with_schedule)

  const value: Coverage = {
    generatedAt: new Date().toISOString(),
    layers,
    detection: det.map((r: { detection: string; n: string; docs: string }) => ({
      detection: r.detection, rows: Number(r.n), sourceDocs: Number(r.docs),
    })),
    notInAProvision: {
      rows: Number(shape[0].no_provision), total,
      pct: total === 0 ? 0 : 100 * Number(shape[0].no_provision) / total,
    },
    unresolvedTargets: {
      rows: Number(shape[0].unresolved), total,
      pct: total === 0 ? 0 : 100 * Number(shape[0].unresolved) / total,
    },
    recorded,
    staleFacts: recorded.filter(f => f.stale).map(f => f.key),
    caseLawBoundary,
    identityBridge: { built, bridgedForms, ambiguousTargets, unbridgeableTargets, regnalTargets },
    schedules: {
      instruments, instrumentsWithASchedule: withSchedule,
      pct: instruments === 0 ? 0 : 100 * withSchedule / instruments,
    },
  }
  cached = { at: Date.now(), key, value }
  return value
}

/** Drop the memo — for a check that changes state and re-reads. */
export function resetCoverageCache(): void { cached = null }

/**
 * The block in words. ⚠ Every figure is interpolated from `c`; no sentence in
 * this function contains a number about the corpus. That is asserted by
 * `check-4a-coverage.ts`, which fails on a digit in any template literal here.
 */
export function describeCoverage(c: Coverage): string[] {
  const lines: string[] = []
  const searched = c.layers.filter(l => l.status === 'searched')
  const missing = c.layers.filter(l => l.status !== 'searched')
  lines.push(`COVERAGE — what this answer could NOT see (generated ${c.generatedAt.slice(0, 16)}Z)`)

  lines.push(`  searched:`)
  for (const l of searched) lines.push(`    ${l.id} — ${l.what} (${l.rows.toLocaleString()} rows)`)
  lines.push(`  NOT searched:`)
  for (const l of missing) {
    lines.push(`    ${l.id} — ${l.what}`)
    lines.push(`        ${l.status === 'held-elsewhere' ? `held in ${l.where}, not joined here` : 'NOT BUILT'}`)
    lines.push(`        consequence: ${l.consequence}`)
  }

  lines.push(`  detector split (never summed unnamed):`)
  for (const d of c.detection) lines.push(`    ${d.detection} — ${d.rows.toLocaleString()} rows from ${d.sourceDocs.toLocaleString()} documents`)

  lines.push(`  rows whose reference is not inside a provision: ${c.notInAProvision.rows.toLocaleString()} of ${c.notInAProvision.total.toLocaleString()} (${c.notInAProvision.pct.toFixed(1)}%)`)
  lines.push(`    — an Act named in a title, long title or explanatory note. A real reference; not a provision that breaks.`)
  lines.push(`  rows whose target is an instrument the corpus holds no text for: ${c.unresolvedTargets.rows.toLocaleString()} (${c.unresolvedTargets.pct.toFixed(1)}%)`)

  if (c.recorded.length === 0) {
    lines.push(`  ⚠ NO extraction statistics are recorded — the unresolved-span count and the OI-15`)
    lines.push(`    residual are UNKNOWN to this block. Run the 4A audits to record them.`)
  } else {
    lines.push(`  measured at extraction time:`)
    for (const f of c.recorded) {
      lines.push(`    ${f.key}: ${f.n === null ? '—' : f.n.toLocaleString()} — ${f.note}`)
      lines.push(`        measured ${f.ageDays} days ago by ${f.measuredBy}${f.stale ? '  ⚠ STALE — past the freshness window, re-measure before quoting' : ''}`)
    }
  }
  if (c.staleFacts.length > 0) lines.push(`  ⚠ STALE FACTS: ${c.staleFacts.join(', ')}`)

  // ⚠⚠ GRAPH 4B §4. Without this block a consequence list that joined the two
  // graph tables would present a silently short answer as a complete one.
  lines.push(`  identity bridge (pre-1963 Acts are cited by regnal year, and the two graph tables disagree):`)
  if (!c.identityBridge.built) {
    lines.push(`    ⚠⚠ NOT BUILT — any join between the two graph tables silently DROPS every pre-1963`)
    lines.push(`       Act, and the loss reads as a coverage result rather than as a bug.`)
  } else {
    lines.push(`    ${c.identityBridge.bridgedForms.toLocaleString()} id forms resolve to a canonical identity`)
    lines.push(`    regnal-form targets in this table: ${c.identityBridge.regnalTargets.toLocaleString()}, of which ${c.identityBridge.unbridgeableTargets.toLocaleString()} have no calendar twin`)
    lines.push(`        — those cannot be joined against a table that keeps calendar forms, and are counted, not guessed at.`)
    lines.push(`    ⚠ calendar-form targets REFUSED a bridge because they name more than one Act: ${c.identityBridge.ambiguousTargets.toLocaleString()}`)
    lines.push(`        — two parliamentary sessions inside one calendar year, each numbering its chapters from the start.`)
  }
  lines.push(`  schedule coverage: ${c.schedules.instrumentsWithASchedule.toLocaleString()} of ${c.schedules.instruments.toLocaleString()} instruments hold a schedule section (${c.schedules.pct.toFixed(1)}%)`)
  lines.push(`    — ⚠ a scheduled agreement that was not ingested presents as a SHORT DOCUMENT, not as an error.`)

  if (c.caseLawBoundary) {
    const b = c.caseLawBoundary
    lines.push(`  case-law boundary: ${b.corpora.length === 0 ? 'NO case-law corpus is held' : `${b.corpora.join(', ')} — ${b.earliest ?? 'unknown'} to ${b.latest ?? 'unknown'}`}`)
    lines.push(`    — an authority outside that window cannot appear, and its absence is not evidence.`)
  }
  return lines
}
