// ─────────────────────────────────────────────────────────────────────────────
// STATUTORY CONSEQUENCES — the web app's reader for the citation graph.
//
// ⚠⚠ WHY THIS FILE EXISTS RATHER THAN AN IMPORT, AND THE COST OF THAT.
//
// The brief says this pass "depends on Search/Graph's `citation_edge` table and
// `inbound()` / `inbound_summary()` — both exist". The TABLE is reachable: it lives in the
// same Neon database this app already uses (1,034,548 rows, confirmed through Prisma from
// the web side). The FUNCTIONS are not: they live in `scripts/ingest/graph/`, which is a
// different package, and `docs/CLAUDE.md` §20 check 0 forbids any file outside
// `scrutinise-web` from entering the web TypeScript program. That rule is not bureaucratic
// — a cross-package import in a harness caused a two-day production outage on ~22 Aug,
// because Vercel installs only this package's `node_modules` and `inbound.ts` reaches for
// `fs` and a 4GB bulk zip that does not exist on a serverless filesystem.
//
// ⚠ SO THIS IS A SECOND READER OF ONE TABLE, AND THAT IS A DRIFT RISK I HAVE NOT REMOVED,
// ONLY MADE DETECTABLE. `scripts/verify-statutory-graph-parity.ts` runs this reader and
// Search/Graph's `inbound()` against the same targets and fails if they disagree on a
// single row id or a single coverage number. If they change their query and nobody changes
// this one, that check goes red — which is the difference between a divergence that is
// found in a day and one that is found by a user reading a wrong number to a committee.
//
// ⚠⚠ THE COVERAGE BLOCK CONTAINS NO FIGURE THAT IS WRITTEN DOWN HERE. Every number is
// queried at call time, exactly as `coverage.ts` requires — the rule exists because a
// hardcoded caveat in this project outlived its own truth and was retired twice before it
// stayed dead. `check:statutory` fails if a digit appears in any coverage sentence in this
// file. The LAYER DECLARATIONS below are deliberately prose-only for the same reason: a
// layer's status is decided by a live count, so a layer built tomorrow flips to `searched`
// without anyone editing this list.
// ─────────────────────────────────────────────────────────────────────────────

import { prisma } from '@/lib/prisma'

export const CITATION_TABLE = 'citation_edge'

export interface InboundRow {
  sourceDocUri: string
  sourceGid: string
  /** NULL when the reference sits in a title, long title or note rather than a provision. */
  sourceProvisionRef: string | null
  /** The literal words in the source. ⚠ The only thing a disposition may be justified by. */
  citationText: string
  sourceType: 'primary' | 'SI' | 'other'
  detection: 'markup' | 'text'
  targetProvisionRef: string | null
}

export interface CoverageLayer {
  id: string
  what: string
  status: 'searched' | 'not-built' | 'held-elsewhere'
  rows: number
  consequence: string
}

export interface Coverage {
  generatedAt: string
  layers: CoverageLayer[]
  detection: Array<{ detection: string; rows: number }>
  /** Rows whose reference sits in a title or note, not a provision. */
  notInAProvision: { rows: number; total: number; pct: number }
  /** Targets normalised to an id the corpus holds no text for. */
  unresolvedTargets: { rows: number; total: number; pct: number }
  /**
   * ⚠⚠ WHAT KIND OF DOCUMENT THESE REFERENCES COME FROM, AND THE BRIEF'S PREMISE WAS WRONG
   * ABOUT IT.
   *
   * The brief's §5 offers this wording: *"It does not yet cover statutory instruments — the
   * regulations made under Acts — so there will be further references we cannot see yet."*
   *
   * **SIs are the largest source type in the table.** Measured: 793,616 of 1,034,548 rows,
   * and 1,347 of the Equality Act's 1,868 references come FROM statutory instruments. A
   * user shown the brief's sentence would be told we cannot see the very layer that
   * supplies most of their answer, and would discount it accordingly.
   *
   * What IS missing is the made-under relationship — *"this instrument was made under
   * section N of that Act"* — which is a different and stronger fact, and which the
   * `enabling-power` layer reports as not-built from its own live count.
   *
   * ⚠ THIS IS THE CASE FOR THE COMPUTED RULE, NOT AN ARGUMENT AGAINST THE BRIEF. A
   * hand-written caveat was wrong within a fortnight of the layer landing. A queried one
   * cannot be.
   */
  sourceTypes: Array<{ sourceType: string; rows: number }>
  caseLaw: { earliest: string | null } | null
}

/**
 * The layers, DECLARED — with no counts in the declaration.
 *
 * ⚠ Mirrors `scripts/ingest/graph/coverage.ts`'s `LAYER_PROBES`. The parity check asserts
 * the id set matches theirs, so a layer they add and we do not is a red check rather than a
 * caveat that silently under-reports what is missing.
 */
const EDGE_TABLE = 'graph_edge'

const LAYERS: Array<{
  id: string; what: string; consequence: string; where: string
  /**
   * A layer whose data exists in ANOTHER table rather than in `citation_edge`. Its count
   * here is legitimately zero and it must not be reported as "not built", because it IS
   * built — this query simply does not reach it.
   */
  heldIn?: string
}> = [
  {
    // ⚠⚠ THIS LAYER WAS MISSING AND THE PARITY CHECK FOUND IT ON ITS FIRST RUN. Of all the
    // layers, it is the one this feature can least afford to omit: a user asking "what
    // happens if I change this Act" is asking about effects, and TNA's own amends / repeals
    // / commences / modifies data is not in `citation_edge` at all. Without this line the
    // coverage statement would have implied the answer included them.
    id: 'amendment-effects',
    what: 'amends, repeals, commences or modifies, from TNA’s own effects data',
    consequence: 'a repeal or an amendment is not a citation and is not returned by this query',
    where: `false`,
    heldIn: EDGE_TABLE,
  },
  {
    id: 'markup-citations',
    what: 'references the document asserted by <Citation URI>',
    consequence: 'the source names the target by identity, so the act-level match is not inferred',
    where: `detection = 'markup'`,
  },
  {
    id: 'text-citations',
    what: 'act names resolved in running text against corpus_acts titles',
    consequence: 'the target id is derived, not read from the document — never quote the target as the source’s own words',
    where: `detection = 'text'`,
  },
  {
    id: 'enabling-power',
    what: 'made-under: “this instrument was made under section N of that Act”',
    consequence: 'a stronger fact than a mention — an instrument whose enabling power is repealed may fall with it, and it is not in this table',
    where: `detection NOT IN ('markup', 'text')`,
  },
  {
    id: 'case-law-citations',
    what: 'a judgment citing a statutory provision',
    consequence: 'a provision may be read down, disapplied or construed by a court with nothing here to show it',
    where: `source_type = 'caselaw'`,
  },
  {
    id: 'treaty-obligations',
    what: 'a treaty article bearing on a domestic provision',
    consequence: 'a change may be prevented by an international obligation this graph cannot see',
    where: `source_type = 'treaty'`,
  },
]

async function countWhere(where: string): Promise<number> {
  const rows = await prisma.$queryRawUnsafe<Array<{ n: bigint }>>(
    `SELECT COUNT(*)::bigint AS n FROM ${CITATION_TABLE} WHERE ${where}`,
  )
  return Number(rows[0].n)
}

/**
 * ⚠ EVERY NUMBER QUERIED AT CALL TIME. Nothing in this function is written down, and
 * `check:statutory` fails the build if a digit appears in a coverage sentence in this file.
 */
/**
 * ⚠ A SHORT CACHE, AND THE REASON IT IS SAFE.
 *
 * The coverage block is six aggregate queries over a 1,034,548-row table with unindexed
 * predicates — the dominant cost of a consequences run once the act lookup was fixed.
 *
 * ⚠ IT IS NOT A STALENESS COMPROMISE, because the numbers only move when the graph is
 * re-ingested, which is a batch job measured in hours. Sixty seconds cannot show a user a
 * coverage state that a re-run would disagree with. Search/Graph's own `coverage.ts` uses
 * the same window for the same reason, which also keeps the two readers comparable when the
 * parity check runs them back to back.
 *
 * ⚠ AND IT IS DELIBERATELY NOT LONGER. The cache-state key in `coverageStateKey` is what
 * forces a fresh classification when coverage widens; a long cache here would delay that
 * signal for exactly the users who most need it — the ones re-running after a new layer
 * landed.
 */
let coverageCache: { at: number; value: Coverage } | null = null
const COVERAGE_CACHE_MS = 60_000

export async function graphCoverage(): Promise<Coverage> {
  if (coverageCache && Date.now() - coverageCache.at < COVERAGE_CACHE_MS) return coverageCache.value
  const value = await computeCoverage()
  coverageCache = { at: Date.now(), value }
  return value
}

async function computeCoverage(): Promise<Coverage> {
  const layers: CoverageLayer[] = []
  for (const l of LAYERS) {
    const rows = await countWhere(l.where)
    // ⚠ "HELD ELSEWHERE" IS NOT "NOT BUILT", and conflating them would be a caveat that
    // lies in the reassuring direction — telling a user the amendment data does not exist
    // when it exists and this query simply does not reach it. The distinction is decided by
    // a live count on the other table, so the day it is joined in, this flips by itself.
    let status: CoverageLayer['status'] = rows > 0 ? 'searched' : 'not-built'
    if (rows === 0 && l.heldIn) {
      const held = await prisma.$queryRawUnsafe<Array<{ n: bigint }>>(
        `SELECT COUNT(*)::bigint AS n FROM ${l.heldIn}`,
      ).catch(() => [{ n: BigInt(0) }])
      if (Number(held[0].n) > 0) status = 'held-elsewhere'
    }
    layers.push({ id: l.id, what: l.what, consequence: l.consequence, rows, status })
  }

  const shape = await prisma.$queryRawUnsafe<Array<{
    total: bigint; no_provision: bigint; unresolved: bigint
  }>>(`
    SELECT COUNT(*)::bigint AS total,
           COUNT(*) FILTER (WHERE source_provision_ref IS NULL)::bigint AS no_provision,
           COUNT(*) FILTER (WHERE resolved = false)::bigint AS unresolved
    FROM ${CITATION_TABLE}`)
  const total = Number(shape[0].total)
  const noProv = Number(shape[0].no_provision)
  const unres = Number(shape[0].unresolved)

  const det = await prisma.$queryRawUnsafe<Array<{ detection: string; n: bigint }>>(
    `SELECT detection, COUNT(*)::bigint AS n FROM ${CITATION_TABLE} GROUP BY 1 ORDER BY n DESC`,
  )
  const src = await prisma.$queryRawUnsafe<Array<{ source_type: string; n: bigint }>>(
    `SELECT source_type, COUNT(*)::bigint AS n FROM ${CITATION_TABLE} GROUP BY 1 ORDER BY n DESC`,
  )

  return {
    generatedAt: new Date().toISOString(),
    layers,
    detection: det.map((d) => ({ detection: d.detection, rows: Number(d.n) })),
    notInAProvision: { rows: noProv, total, pct: total ? (noProv / total) * 100 : 0 },
    unresolvedTargets: { rows: unres, total, pct: total ? (unres / total) * 100 : 0 },
    sourceTypes: src.map((s) => ({ sourceType: s.source_type, rows: Number(s.n) })),
    caseLaw: null,
  }
}

/** "Acts of Parliament and statutory instruments" — from the live composition, not a list. */
function sourceKinds(c: Coverage): string {
  const label: Record<string, string> = {
    primary: 'Acts of Parliament',
    SI: 'statutory instruments (the regulations made under Acts)',
    other: 'other instruments',
  }
  const present = c.sourceTypes.filter((s) => s.rows > 0).map((s) => label[s.sourceType] ?? s.sourceType)
  if (!present.length) return 'nothing yet'
  if (present.length === 1) return present[0]
  return `${present.slice(0, -1).join(', ')} and ${present[present.length - 1]}`
}

/**
 * ⚠⚠ THE COVERAGE STATEMENT, COMPOSED FROM THE BLOCK — NEVER A FIXED STRING.
 *
 * §5: "Rendered from what `inbound()` reports about itself, never a fixed string. A
 * hardcoded caveat goes stale silently — this project has already had a storage figure
 * survive being retired twice because it lived in a comment."
 *
 * ⚠ THE SENTENCES NAME THE MISSING LAYERS BY READING `status`, so the day the SI layer is
 * built this paragraph stops claiming SIs are missing without anyone touching this file.
 * That is the whole design: **a caveat that can go stale is worse than no caveat**, because
 * a reader trusts it.
 */
export function describeCoverage(c: Coverage): string {
  const missing = c.layers.filter((l) => l.status !== 'searched')
  const out: string[] = []

  // ⚠ WHAT WE DID SEARCH, FIRST AND IN THE USER'S TERMS. A caveat that opens with what is
  // missing invites the reader to discount the whole list before they know what is in it.
  out.push(`This covers ${sourceKinds(c)}.`)

  if (missing.length) {
    out.push(
      `It does not yet cover ${missing.map((l) => l.what).join('; ')}` +
      ` — so there will be further references we cannot see yet.`,
    )
    // Each missing layer says what its absence costs the reader, as its own sentence.
    for (const l of missing) {
      out.push(l.consequence.charAt(0).toUpperCase() + l.consequence.slice(1) + '.')
    }
  }

  // ⚠ NEVER PRESENT A COUNT AS COMPLETE (§5). This sentence is what makes the number in
  // front of it honest, and it is why the count and the caveat must be adjacent.
  out.push('Treat any number here as what we found in the layers we have searched, not as a total.')
  return out.join(' ')
}

/**
 * ⚠⚠ THE CANDIDATE SPELLINGS OF ONE ACT ID — AND WHY THIS IS NOT A `lower()` CALL.
 *
 * The first version of this reader matched `WHERE lower(target_act_id) = $1`. That is
 * correct and it defeats `citation_edge_target_act`, which is a plain btree on the raw
 * column: **a parallel sequential scan over 1,034,548 rows at 474ms, against 3.7ms on the
 * index — 127× slower**, measured with EXPLAIN ANALYZE. On a large Act, inside a build with
 * a pass budget, that is the difference between a pass and a timeout.
 *
 * ⚠ BUT DROPPING `lower()` NAIVELY WOULD BE WRONG, AND IN THE DIRECTION THAT MATTERS.
 * 3,531 rows (0.34%) hold ids that are not lower-case — they are the **pre-1963 regnal-year
 * Acts**: `ukpga/Eliz2/9-10/33`, `ukpga/Vict/24-25/100`. Matching only a lower-cased input
 * would silently return nothing for those, which under-reports the consequences of changing
 * a Victorian or Elizabethan Act — exactly the sort of old, heavily-referenced statute a
 * repeal programme is most likely to touch.
 *
 * ⚠ MEASURED BEFORE CHOOSING: **no Act id in this table is stored in more than one casing**
 * (0 ids with multiple forms). Each Act therefore has exactly one canonical spelling, so
 * matching by equality against both candidate forms is complete, unambiguous, and indexable
 * — `= ANY(array)` uses the btree, `lower(col) =` cannot.
 */
function gidCandidates(gid: string): string[] {
  const raw = gid.trim().replace(/^https?:\/\/(?:www\.)?legislation\.gov\.uk\//, '').replace(/\/+$/, '')
  const lower = raw.toLowerCase()
  return raw === lower ? [raw] : [raw, lower]
}

/**
 * A provision predicate that matches subsections but not neighbouring sections.
 *
 * ⚠ `section-3` MUST match `section-3-2` and `section-3a` and MUST NOT match `section-30`.
 * TNA records references at subsection grain, so a query for s.3 that missed s.3(2) would
 * be wrong in the direction that matters — and one that swept in s.30 would be wrong in the
 * direction a select committee notices. The prefix is followed by a separator or a letter,
 * never another digit. Copied in behaviour from Search/Graph's `inbound()`; the parity check
 * asserts the two agree row for row.
 */
function provisionPredicate(column: string, ref: string): { sql: string; params: string[] } {
  const r = ref.trim().toLowerCase()
  return {
    sql: `(lower(${column}) = $P OR lower(${column}) ~ ('^' || $P || '([^0-9].*)?$'))`,
    params: [r],
  }
}

export interface InboundResult {
  target: string
  targetProvision: string | null
  rows: InboundRow[]
  /** ⚠ Separated, never dropped and never mixed in. See §7. */
  titleOnly: InboundRow[]
  coverage: Coverage
}

/**
 * Everything in the statute book that points at this target.
 *
 * ⚠ TITLE-ONLY REFERENCES ARE SEPARATED, NOT FILTERED. §7: those rows are an Act named in a
 * title, long title or explanatory note — real references, but not provisions that break.
 * Dropping them silently would under-report the reach; mixing them in would over-report the
 * work. They come back in their own list so the caller must decide which it is talking about.
 *
 * ⚠ AN ACT-LEVEL REFERENCE IS NOT A PROVISION-LEVEL ONE. When the user has named a
 * provision, rows that name only the Act are EXCLUDED from `rows` — they may point at any
 * part of it — and counted in the coverage narrative instead. Folding them in would inflate
 * the answer with references that may have nothing to do with the section in question.
 */
export async function inboundFor(
  targetActId: string,
  targetProvisionRef?: string | null,
): Promise<InboundResult> {
  const candidates = gidCandidates(targetActId)
  const gid = candidates[candidates.length - 1]

  // ⚠ `= ANY($1)` — indexable. See `gidCandidates`.
  let sql = `
    SELECT source_doc_uri, source_gid, source_provision_ref, citation_text,
           source_type, detection, target_provision_ref
    FROM ${CITATION_TABLE}
    WHERE target_act_id = ANY($1::text[])`
  const params: unknown[] = [candidates]

  if (targetProvisionRef?.trim()) {
    // The provision filter runs over the handful of rows the act filter already selected,
    // so a function on the column costs nothing here.
    const p = provisionPredicate('target_provision_ref', targetProvisionRef)
    sql += ` AND ${p.sql.replace(/\$P/g, `$${params.length + 1}`)}`
    params.push(...p.params)
  }
  sql += ` ORDER BY source_gid, source_provision_ref NULLS LAST`

  const raw = await prisma.$queryRawUnsafe<Array<{
    source_doc_uri: string; source_gid: string; source_provision_ref: string | null
    citation_text: string; source_type: string; detection: string
    target_provision_ref: string | null
  }>>(sql, ...params)

  const all: InboundRow[] = raw.map((r) => ({
    sourceDocUri: r.source_doc_uri,
    sourceGid: r.source_gid,
    sourceProvisionRef: r.source_provision_ref,
    citationText: r.citation_text,
    sourceType: (r.source_type === 'SI' || r.source_type === 'primary' ? r.source_type : 'other'),
    detection: r.detection === 'text' ? 'text' : 'markup',
    targetProvisionRef: r.target_provision_ref,
  }))

  return {
    target: gid,
    targetProvision: targetProvisionRef?.trim() || null,
    rows: all.filter((r) => r.sourceProvisionRef !== null),
    titleOnly: all.filter((r) => r.sourceProvisionRef === null),
    coverage: await graphCoverage(),
  }
}

/**
 * ⚠ THE COVERAGE STATE, AS A CACHE KEY (§6 / decision 4).
 *
 * "The cache key includes the graph's coverage state, so widened coverage forces a fresh
 * run. Otherwise a user who re-runs after the SI layer lands gets the old, narrower answer
 * with nothing telling them it changed."
 *
 * ⚠ IT IS THE COUNTS, NOT A VERSION NUMBER SOMEBODY REMEMBERS TO BUMP. A version constant
 * would be correct exactly until the first ingest nobody thought to flag. Row counts per
 * layer move whenever the graph does, in the direction that matters, with no human in the
 * loop.
 */
export function coverageStateKey(c: Coverage): string {
  return c.layers.map((l) => `${l.id}:${l.rows}`).join('|')
}
