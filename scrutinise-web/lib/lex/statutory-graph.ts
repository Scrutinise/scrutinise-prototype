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
import { readEffect, originOf, EDGE_SOURCES, type ChangeKind, type EdgeOrigin } from '@/lib/lex/effect-kinds'
import {
  PROVISION_PATH_SHAPE, provisionRefOf, isUnaddressableProvision, emptyGroups, mergeLawLines,
  type IdeaLawSet, type IdeaLawRow, type LawResolution, type LawResolutionState, type LawEffectsSummary,
  type LawRelation, type LawSource, type LawTargetKind,
} from '@/lib/lex/idea-law-pure'

export const CITATION_TABLE = 'citation_edge'

/**
 * ⚠⚠ THREE KINDS, NEVER FLATTENED — SURFACE 5 §1 AND §4.
 *
 * This type had TWO members and the mapper read `r.detection === 'text' ? 'text' : 'markup'`,
 * so every row that was neither became `markup` — *the source asserted this identity itself*,
 * which is the strongest thing this table can say. On 8 September that silently relabelled
 * every `enabling` row in the graph, including the ones bearing on the Equality Act.
 *
 * The kinds are different STRENGTHS OF EVIDENCE, and the difference is the whole point:
 *
 *   · `enabling` — the instrument's own enacting words say it was MADE UNDER the target.
 *     ⚠⚠ The strongest and the most consequential. An instrument that merely mentions an Act
 *     survives its repeal; one whose enabling power is repealed may fall with it.
 *   · `markup`   — the source document asserted the target's identity in a Citation URI.
 *   · `text`     — we resolved the Act's NAME in running prose. ⚠ The target is DERIVED, not
 *     read, and must never be presented as though the document asserted it.
 *
 * §4: *"Never flatten the three kinds into one number. Merging them produces a confident
 * wrong answer, which is worse than a short one."* A default arm in a ternary is how a
 * flattening happens without anybody deciding to flatten anything.
 */
export type Detection = 'markup' | 'text' | 'enabling'

/**
 * The kind of a stored `detection` value, or null.
 *
 * ⚠ NULL RATHER THAN A DEFAULT. The table's CHECK constraint permits exactly these three
 * today; a fourth landing tomorrow must arrive as a COUNTED UNKNOWN, not as whichever member
 * the ternary's else-branch happened to name. `inboundFor` returns those rows in their own
 * list so they are reported, never merged and never dropped (§7).
 */
export function detectionOf(raw: string): Detection | null {
  return raw === 'markup' || raw === 'text' || raw === 'enabling' ? raw : null
}

/**
 * How a kind should be described to a reader, and what it is NOT.
 *
 * ⚠ ORDERING LIVES HERE TOO, AS `strength`. SURFACE 5 §1 asks for an ordering the data can
 * honestly support: this one rests on a stored column with a CHECK constraint behind it, not
 * on a score anybody invented. Lower sorts first.
 */
export const DETECTION_KINDS: Record<Detection, {
  strength: number
  /** What the row IS, in a reader's words. */
  what: string
  /** ⚠ What it is not. Never dropped — this is the never-claim rule at the kind level. */
  gloss: string
}> = {
  enabling: {
    strength: 0,
    what: 'made under the target — the instrument’s own enacting words name the power it was made under',
    gloss: 'the strongest kind here, and the most consequential: an instrument that merely mentions '
      + 'an Act survives its repeal, while one whose enabling power is repealed may fall with it',
  },
  markup: {
    strength: 1,
    what: 'a reference the source document asserted itself, by identifying the target in its own markup',
    gloss: 'the source said which instrument it meant, so the match is read rather than inferred',
  },
  text: {
    strength: 2,
    what: 'the target’s NAME found in running text and resolved against the titles we hold',
    gloss: 'the target is derived by us, not asserted by the document — never read it as the source’s own identification',
  },
}

export interface InboundRow {
  sourceDocUri: string
  sourceGid: string
  /** NULL when the reference sits in a title, long title, preamble or note rather than a provision. */
  sourceProvisionRef: string | null
  /** The literal words in the source. ⚠ The only thing a disposition may be justified by. */
  citationText: string
  sourceType: 'primary' | 'SI' | 'other'
  detection: Detection
  targetProvisionRef: string | null
}

/** A row whose stored `detection` is not one this build knows. Counted, never merged. */
export interface UnrecognisedRow {
  sourceGid: string
  rawDetection: string
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
  /**
   * ⚠⚠ SURFACE 5 §3 — THE IDENTITY BRIDGE'S RESIDUAL, AND A REFUSAL IS NOT AN ABSENCE.
   *
   * Pre-1963 Acts are cited by regnal year, and the two graph tables record them under
   * different forms. Some calendar-year forms name MORE THAN ONE Act — two parliamentary
   * sessions inside one calendar year, each numbering its chapters from the start — and those
   * are REFUSED a bridge and recorded as refusals rather than resolved by first-wins.
   *
   * §3: *"A refusal is not an absence and must not read as one."* A refusal that were merely
   * missing from the table could not be counted, and a question asked under one of those
   * forms would come back short with nothing saying why.
   */
  identityBridge: { built: boolean; ambiguousTargets: number }
  /**
   * ⚠ THE FACTS THAT CANNOT BE COUNTED ON A PAGE LOAD, WITH THEIR AGE.
   *
   * Schedule retention is a nineteen-second aggregate over the whole corpus — measured, not
   * assumed — and it belongs to an extraction run rather than to any row. Search/Graph record
   * exactly these in `graph_coverage_fact` with a measurement date, and this reads theirs
   * rather than keeping a second copy. A fact past its freshness window says STALE by name.
   *
   * ⚠ THIS IS THE ONLY PART OF THE BLOCK THAT IS NOT LIVE, and it says when it was taken. A
   * measured fact and an inferred one must not look identical on the page (CLAUDE.md §19).
   */
  recorded: RecordedFact[]
  /** ⚠ Any recorded fact past the freshness window, by key. */
  staleFacts: string[]
}

export interface RecordedFact {
  key: string
  n: number | null
  note: string
  measuredAt: string
  measuredBy: string
  ageDays: number
  stale: boolean
}

/** How old a recorded extraction statistic may be before the block says so. */
export const FRESHNESS_DAYS = 30

/**
 * The recorded facts this surface quotes, and the words a reader gets for each.
 *
 * ⚠ AN EXPLICIT LIST, NOT EVERYTHING IN THE TABLE. `graph_coverage_fact` holds audit
 * residuals written for the graph's own sprints; dropping all of them into a proposer's
 * document would bury the two that bear on the answer in front of them. The keys are named
 * so a fact that stops being recorded goes MISSING BY NAME rather than shrinking the block.
 */
const QUOTED_FACTS: Record<string, string> = {
  si_schedule_retention_pct:
    'of the instruments sampled had their scheduled text reach our corpus as well — ⚠ a scheduled '
    + 'agreement that was not ingested presents as a SHORT DOCUMENT, not as an error',
  // ⚠ THE ILLUSTRATION USED TO NAME A YEAR — *short forms such as "the 1998 Act"* — and the
  // figure guard fired on it, correctly. It was not a corpus figure, but a guard for prose
  // cannot tell one digit from another, and a guard that has to be argued with gets deleted by
  // whoever hits it next. The shape of the short form teaches the same thing with no number in
  // it (CLAUDE.md §27: illustrate the shape, never supply a specimen).
  unresolved_act_name_spans:
    'act names found in running text resolved to no instrument we hold a title for — short forms '
    + 'that name only a year, and Acts the corpus does not hold. Counted, never dropped',
  madeunder_section_refs_wrong_pct:
    'of the OLD preamble parser’s section-level made-under references were wrong — the effects '
    + 'table still holds those, while the enabling rows quoted here came from the fixed parser',
}

/**
 * The layers, DECLARED — with no counts in the declaration.
 *
 * ⚠ Mirrors `scripts/ingest/graph/coverage.ts`'s `LAYER_PROBES`. The parity check asserts
 * the id set matches theirs, so a layer they add and we do not is a red check rather than a
 * caveat that silently under-reports what is missing.
 */
/**
 * ⚠⚠ SURFACE 5 — THIS WAS THE WRONG TABLE, AND THE STATUS IT DECIDED WAS RIGHT BY ACCIDENT.
 *
 * It read `graph_edge`, which is the POSITION graph's subject/predicate/object table and
 * holds no statutory effect of any kind. TNA's amends / repeals / commences / modifies live
 * in `legislation_edges`. The layer therefore reported `held-elsewhere` on a count of
 * something unrelated: it would have gone on saying "held elsewhere" with the effects table
 * empty, and would have said "NOT BUILT" if the position graph were ever cleared.
 *
 * ⚠ A guard whose evidence is unrelated to its subject cannot fail for the right reason.
 * `check:surface-5` now asserts the count moves with the effects table specifically.
 */
const EFFECTS_TABLE = 'legislation_edges'
const EFFECTS_TYPES = "edge_type IN ('amends','repeals','commences','modifies')"
const IDENTITY_TABLE = 'legislation_identity'
const COVERAGE_FACT_TABLE = 'graph_coverage_fact'

const LAYERS: Array<{
  id: string; what: string; consequence: string; where: string
  /**
   * A layer whose data exists in ANOTHER table rather than in `citation_edge`. Its count
   * here is legitimately zero and it must not be reported as "not built", because it IS
   * built — this query simply does not reach it.
   */
  heldIn?: { table: string; where: string }
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
    heldIn: { table: EFFECTS_TABLE, where: EFFECTS_TYPES },
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
      // ⚠ THE PREDICATE TRAVELS WITH THE TABLE. A bare row count over the effects table would
      // report `held-elsewhere` on its `cites` rows alone, which are not effects at all.
      const held = await prisma.$queryRawUnsafe<Array<{ n: bigint }>>(
        `SELECT COUNT(*)::bigint AS n FROM ${l.heldIn.table} WHERE ${l.heldIn.where}`,
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

  // ── the identity bridge's residual, live ────────────────────────────────────
  //
  // ⚠ A REFUSAL IS A ROW, NOT AN ABSENCE — `basis = 'ambiguous-refused'`. Counting targets
  // with no bridge row instead would count every post-1963 Act and report tens of thousands
  // of ambiguous identities where there are a few dozen. And it is restricted to targets
  // THIS TABLE actually holds, because a refusal recorded about an Act nobody references is
  // not a limit on any answer we give.
  const bridge = await prisma.$queryRawUnsafe<Array<{ n: bigint }>>(`
    SELECT COUNT(DISTINCT c.target_act_id)::bigint AS n
    FROM ${CITATION_TABLE} c
    JOIN ${IDENTITY_TABLE} li ON li.form = c.target_act_id
    WHERE li.basis = 'ambiguous-refused'`).catch(() => null)

  // ── the recorded facts, with their age ──────────────────────────────────────
  const factRows = await prisma.$queryRawUnsafe<Array<{
    key: string; n: string | null; note: string; measured_at: Date; measured_by: string; age_days: string
  }>>(`
    SELECT key, n, note, measured_at, measured_by,
           EXTRACT(EPOCH FROM (now() - measured_at)) / 86400 AS age_days
    FROM ${COVERAGE_FACT_TABLE} WHERE key = ANY($1::text[]) ORDER BY key`,
  Object.keys(QUOTED_FACTS)).catch(() => [])
  const recorded: RecordedFact[] = factRows.map((r) => ({
    key: r.key,
    n: r.n === null ? null : Number(r.n),
    note: QUOTED_FACTS[r.key] ?? r.note,
    measuredAt: new Date(r.measured_at).toISOString(),
    measuredBy: r.measured_by,
    ageDays: Math.round(Number(r.age_days) * 10) / 10,
    stale: Number(r.age_days) > FRESHNESS_DAYS,
  }))

  return {
    generatedAt: new Date().toISOString(),
    layers,
    detection: det.map((d) => ({ detection: d.detection, rows: Number(d.n) })),
    notInAProvision: { rows: noProv, total, pct: total ? (noProv / total) * 100 : 0 },
    unresolvedTargets: { rows: unres, total, pct: total ? (unres / total) * 100 : 0 },
    sourceTypes: src.map((s) => ({ sourceType: s.source_type, rows: Number(s.n) })),
    caseLaw: null,
    identityBridge: { built: bridge !== null, ambiguousTargets: bridge ? Number(bridge[0].n) : 0 },
    recorded,
    staleFacts: recorded.filter((f) => f.stale).map((f) => f.key),
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

  // ⚠⚠ SURFACE 5 §3 — "HELD ELSEWHERE" IS NOT "NOT BUILT", AND THE PROSE SAID NEITHER.
  // The status told the two apart and the sentence a user reads lumped them together as
  // "does not yet cover", which tells a reader the amendment data does not exist when it
  // exists and this query does not reach it. The brief asks for the distinction in words:
  // "amendment effects are held elsewhere and are not joined here".
  const elsewhere = missing.filter((l) => l.status === 'held-elsewhere')
  const notBuilt = missing.filter((l) => l.status !== 'held-elsewhere')
  if (elsewhere.length) {
    out.push(
      `We hold ${elsewhere.map((l) => l.what).join('; ')} — but not in this search, `
      + 'so they are not joined into any number here.')
  }
  if (notBuilt.length) {
    // ⚠ THE LIST GOES LAST IN THE SENTENCE. Joining several layers with semicolons and then
    // trailing "at all yet" put the qualifier after the last item only, so it read as though
    // it applied to the treaty layer and not to the case-law one.
    out.push(
      `We do not hold ${notBuilt.length === 1 ? 'this at all yet' : 'any of these at all yet'}: `
      + `${notBuilt.map((l) => l.what).join('; ')}. There will be further references we cannot see.`)
  }
  // Each missing layer says what its absence costs the reader, as its own sentence.
  for (const l of missing) {
    out.push(l.consequence.charAt(0).toUpperCase() + l.consequence.slice(1) + '.')
  }

  // ══ ⚠⚠ SURFACE 5 §3 — THE FOUR FACTS THAT WERE COMPUTED AND NEVER SAID ═══════════════
  //
  // `notInAProvision` and `unresolvedTargets` were queried on every call and rendered
  // nowhere: the block held them and the sentence a user read did not. A figure computed and
  // not printed is indistinguishable, on the page, from a figure never computed — which is
  // the same family as the coverage row that reached one document out of three.
  //
  // ⚠ EVERY NUMBER BELOW IS INTERPOLATED FROM `c`. No sentence in this function states a
  // figure about the corpus, and `check:statutory` fails the build if one appears.
  out.push(
    `${pct(c.notInAProvision.pct)} of the references we hold sit in a title, long title, preamble `
    + 'or explanatory note rather than inside a provision — real references, but not provisions '
    + 'that would break.',
  )
  out.push(
    `${pct(c.unresolvedTargets.pct)} point at an instrument we hold no text for, so we can count `
    + 'them and cannot show you what they say.',
  )

  // ⚠ A REFUSAL IS NOT AN ABSENCE (§3), and it has to be said in those words. A form that
  // names more than one Act was refused a bridge rather than resolved by first-wins, so a
  // question asked under one of them comes back short — and this is the only thing that
  // tells the reader why.
  if (c.identityBridge.built && c.identityBridge.ambiguousTargets > 0) {
    out.push(
      `${c.identityBridge.ambiguousTargets.toLocaleString()} of the Acts referred to here are named `
      + 'by an identifier that fits more than one Act, because two parliamentary sessions can fall '
      + 'inside one calendar year. We refused to guess between them, so those are recorded as '
      + 'refusals — a refusal, not an absence, and not evidence that nothing refers to them.',
    )
  }

  // ⚠ THE RECORDED FACTS SAY WHEN THEY WERE TAKEN. Everything above moves with the graph;
  // these were measured at an extraction run, and a reader is entitled to know which is which.
  for (const f of c.recorded) {
    // ⚠ A PERCENTAGE WITHOUT ITS SIGN IS A COUNT. The first rendering printed "36.1: of the
    // old preamble parser's references were wrong", which reads as thirty-six references. The
    // suffix on the graph's own key is what says which it is — their contract, not our guess.
    const isPct = f.key.endsWith('_pct')
    const value = f.n === null ? 'An unrecorded number' : `${f.n.toLocaleString()}${isPct ? '%' : ''}`
    out.push(
      `${value} ${f.note}`
      + ` (measured ${f.ageDays} days ago${f.stale ? ', ⚠ past the point where we would re-measure before quoting it' : ''}).`,
    )
  }

  // ⚠ NEVER PRESENT A COUNT AS COMPLETE (§5). This sentence is what makes the number in
  // front of it honest, and it is why the count and the caveat must be adjacent.
  out.push('Treat any number here as what we found in the layers we have searched, not as a total.')
  return out.join(' ')
}

/** A percentage as a reader reads it. ⚠ Only the FORMAT is written here; the value is `c`'s. */
function pct(n: number): string {
  return `${n.toFixed(1)}%`
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
export function gidCandidates(gid: string): string[] {
  const raw = gid.trim().replace(/^https?:\/\/(?:www\.)?legislation\.gov\.uk\//, '').replace(/\/+$/, '')
  const lower = raw.toLowerCase()
  return raw === lower ? [raw] : [raw, lower]
}

/**
 * ⚠ THE TARGET'S OWN TITLE, SO A QUOTATION CAN BE CHECKED AGAINST IT.
 *
 * Read from `corpus_acts`, which is the graph's own register of what an id names — the same table
 * the `text` detector resolves titles against, so the two agree by construction. Null when the
 * corpus holds no title for the id, and the caller SAYS SO rather than reporting an unanswerable
 * question as a pass.
 *
 * ⚠⚠ IT EXISTS BECAUSE THE FIRST WORKED EXAMPLE FAILED ITS OWN QUOTATION. `nisr/2010/381` is
 * recorded as made under the Constitutional Reform Act 2005, and its whole enacting text names
 * only the Judicature (Northern Ireland) Act 1978 — which is not among its recorded targets at
 * all. A reader who checks one quotation against legislation.gov.uk and finds a different Act
 * distrusts the panel, and would be right to.
 */
export async function targetTitle(targetActId: string): Promise<string | null> {
  const rows = await prisma.$queryRawUnsafe<Array<{ title: string | null }>>(
    `SELECT title FROM corpus_acts WHERE gid = ANY($1::text[]) AND title IS NOT NULL LIMIT 1`,
    gidCandidates(targetActId),
  ).catch(() => [])
  return rows[0]?.title ?? null
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
export function provisionPredicate(column: string, ref: string): { sql: string; params: string[] } {
  const r = ref.trim().toLowerCase()
  return {
    sql: `(lower(${column}) = $P OR lower(${column}) ~ ('^' || $P || '([^0-9].*)?$'))`,
    params: [r],
  }
}

export interface InboundResult {
  target: string
  targetProvision: string | null
  /**
   * ⚠⚠ SURFACE 5 §1 — THE STRONGEST KIND, IN ITS OWN LIST, BECAUSE THE OLD SPLIT BURIED IT.
   *
   * Every enabling row in the graph has a NULL `source_provision_ref` — measured, all of
   * them — because the enacting words sit in an instrument's preamble, above any provision.
   * The two-way split therefore filed one hundred per cent of them under `titleOnly`, whose
   * own description reads *"real references, but not provisions that would break"*. For an
   * enabling power that is exactly backwards: it is the one kind that may FALL with the
   * target. The split was correct for its own rule and wrong for this kind, which is why the
   * kind gets a list rather than the rule getting an exception.
   */
  enabling: InboundRow[]
  /** References inside a provision — the ones a change would send someone to go and edit. */
  rows: InboundRow[]
  /** ⚠ Separated, never dropped and never mixed in. See §7. Excludes enabling rows. */
  titleOnly: InboundRow[]
  /**
   * ⚠ Rows whose stored `detection` this build does not know. Counted and surfaced rather
   * than folded into whichever kind a default arm named. Normally empty.
   */
  unrecognised: UnrecognisedRow[]
  coverage: Coverage
}

/**
 * ⚠⚠ THE PARTITION, AS ONE PURE FUNCTION, SO NOTHING CAN RECONSTRUCT IT DIFFERENTLY.
 *
 * `enabling`, `rows` and `titleOnly` are disjoint and together exhaust the input. It is
 * separated from the query for two reasons and both are the point:
 *
 *   1. A CHECK CAN CALL IT. The rule this enforces — an enabling row is an enabling row
 *      whatever its provision ref — is a property of a VALUE, and the assertion that used to
 *      guard it was a regex over this file's source. A grep agreed with the old split right up
 *      to the moment the split was wrong, and would have gone on agreeing with a rewrite that
 *      reintroduced the fault in different words (CLAUDE.md §25).
 *   2. THE ORDER OF THE TESTS IS THE WHOLE BUG. Testing `sourceProvisionRef` first put one
 *      hundred per cent of the enabling rows into the list described as *"real references, but
 *      not provisions that would break"*. The kind is tested first, here, once.
 */
export function splitInbound(all: InboundRow[]): {
  enabling: InboundRow[]; rows: InboundRow[]; titleOnly: InboundRow[]
} {
  return {
    enabling: all.filter((r) => r.detection === 'enabling'),
    rows: all.filter((r) => r.detection !== 'enabling' && r.sourceProvisionRef !== null),
    titleOnly: all.filter((r) => r.detection !== 'enabling' && r.sourceProvisionRef === null),
  }
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

  // ⚠⚠ THE MAPPER IS WHERE THE FLATTENING HAPPENED. It read
  // `detection: r.detection === 'text' ? 'text' : 'markup'`, so every enabling row came back
  // claiming the source document had asserted the target's identity itself. Nothing failed,
  // nothing logged, and the count was right — only the KIND was wrong, on the one kind whose
  // consequence differs from every other.
  const all: InboundRow[] = []
  const unrecognised: UnrecognisedRow[] = []
  for (const r of raw) {
    const detection = detectionOf(r.detection)
    if (!detection) {
      unrecognised.push({ sourceGid: r.source_gid, rawDetection: r.detection })
      continue
    }
    all.push({
      sourceDocUri: r.source_doc_uri,
      sourceGid: r.source_gid,
      sourceProvisionRef: r.source_provision_ref,
      citationText: r.citation_text,
      sourceType: (r.source_type === 'SI' || r.source_type === 'primary' ? r.source_type : 'other'),
      detection,
      targetProvisionRef: r.target_provision_ref,
    })
  }

  return {
    target: gid,
    targetProvision: targetProvisionRef?.trim() || null,
    // ⚠ ONE PARTITION, CALLED — never restated here. See `splitInbound`.
    ...splitInbound(all),
    unrecognised,
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

// ═════════════════════════════════════════════════════════════════════════════════════════
// THE EFFECTS READER — what a change to an Act knocks on to (26-U, BRIEF_GRAPH_6).
//
// `inboundFor` answers "what REFERS to this Act" from `citation_edge`. This answers "what has
// CHANGED, REPEALED, COMMENCED or MODIFIED it" from `legislation_edges` — the official record
// of amendments, which this file has so far only COUNTED (the `amendment-effects` layer reports
// `held-elsewhere`). Read-only, no schema change, one table.
//
// ⚠⚠ FOUR THINGS THIS READER REFUSES TO DO, each of which an earlier reader of this data did:
//
//   1. COLLAPSE `sub_type` INTO THE TYPE. Every row carries its verbatim `subType` AND an
//      additive `changeKind` (see `effect-kinds.ts`). "705 amends" is a count of rows filed under
//      that type; some are `excluded` or `applied by …` and change no word of the Act.
//   2. LET THE TWO KINDS OF EVIDENCE LOOK ALIKE. `origin` is `official` (the publisher's own
//      structured record — NO quotable text) or `extracted` (our reading of prose — the words
//      kept, where any were, are in `quote`). A row never has a quote it does not hold.
//   3. RETURN A WHOLE-CORPUS FIGURE. Counts are for the Act (and provision) asked about, queried
//      with that Act's id; nothing here counts the table. "2.3 million links" is a statement about
//      us, not an answer to anyone's question.
//   4. PASS OFF A STALE COPY AS CURRENT. `freshness` is read from the rows' own `extracted_at`.
//
// ⚠ COUNTS ARE TRUE TOTALS, NOT `rows.length`. They come from a grouped COUNT in SQL, so a
// per-type cap on the rows returned cannot shrink a number, and `truncated` says when it did.
// ═════════════════════════════════════════════════════════════════════════════════════════

export const EFFECTS_TABLE_NAME = EFFECTS_TABLE

/** The four types TNA's effects feed files under. */
export const EFFECT_EDGE_TYPES = ['amends', 'repeals', 'commences', 'modifies'] as const
/** The two relationships OUR extractors wrote into the same table. */
export const EXTRACTED_EDGE_TYPES = ['made-under', 'cites'] as const
export type EffectEdgeType = typeof EFFECT_EDGE_TYPES[number]
export type EdgeTypeName = EffectEdgeType | typeof EXTRACTED_EDGE_TYPES[number]
export const ALL_EDGE_TYPES: readonly EdgeTypeName[] = [...EFFECT_EDGE_TYPES, ...EXTRACTED_EDGE_TYPES]

/**
 * What a call asks for when it names no types: the three that change or qualify an Act's
 * text. ⚠ `commences` is a statement about WHEN, not WHAT, and on a heavily commenced Act
 * (hundreds of rows) it would crowd the answer; it is one argument away.
 */
export const DEFAULT_EFFECT_TYPES: readonly EdgeTypeName[] = ['amends', 'repeals', 'modifies']

export type EffectDirection = 'inbound' | 'outbound'

export interface EffectRow {
  direction: EffectDirection
  edgeType: EdgeTypeName
  /** ⚠ VERBATIM, never altered, never replaced by `changeKind`. */
  subType: string
  changeKind: ChangeKind
  changeRule: string
  /** What this row does, and for a not-textual row what it does NOT do — in a reader's words. */
  changeReason: string
  /** Recorded but not yet in force. */
  prospective: boolean
  temporary: boolean
  /** The instrument / provision at the OTHER end of the edge. */
  otherEnd: { corpus: string | null; gid: string; provision: string | null; title: string | null }
  /** The provision of THE ACT ASKED ABOUT this row bears on; null = recorded against the Act as a whole. */
  thisEndProvision: string | null
  scope: 'provision' | 'act-wide'
  granularity: string
  /** The stored source label, verbatim. */
  source: string
  /** ⚠ null = a source this build does not know. Counted, never defaulted. */
  origin: EdgeOrigin | null
  /**
   * ⚠⚠ ONLY AN `extracted` ROW THAT KEPT WORDS HAS ONE, AND IT IS OURS.
   * An `official` row has none: `detail` on those is a date, a qualification and a flag.
   */
  quote: { text: string; kind: 'preamble-words' } | null
  /** An official row's structured in-force fields. Not text; not a quotation. */
  inForce: { date: string | null; qualification: string | null; applied: boolean } | null
  /** `detail` that matched neither shape. Reported rather than dropped or promoted to a quote. */
  detailUnparsed: string | null
  extractedAt: string
}

export interface EffectTypeCounts {
  edgeType: EdgeTypeName
  /** TRUE rows for this Act (and provision) — counted in SQL, never `rows.length`. */
  total: number
  byKind: Record<ChangeKind, number>
  /** How many rows each classification rule read — so a count can be explained, not just stated. */
  byRule: Record<string, number>
  bySource: Array<{ source: string; origin: EdgeOrigin | null; rows: number }>
  byOrigin: { official: number; extracted: number; unrecognised: number }
  /** Rows recorded against the Act as a whole (no provision) vs against a provision. */
  byScope: { provision: number; actWide: number }
  prospective: number
  returned: number
  truncated: boolean
}

export interface EffectsFreshness {
  newestRowAt: string | null
  ageDays: number | null
  stale: boolean
  /** ⚠ Generated from the figures above, never a fixed string. */
  caveat: string
}

export interface EffectsResult {
  target: { given: string; gid: string; provision: string | null; title: string | null }
  resolution: {
    /** The form the Act is named by in this answer: the bridge's canonical form where there is one. */
    canonical: string
    /** Every id form searched. */
    candidates: string[]
    bridge: 'not-needed' | 'bridged' | 'ambiguous-refused' | 'unavailable'
    note: string | null
  }
  direction: EffectDirection
  requestedTypes: EdgeTypeName[]
  /** One entry per requested type, in the order asked — a zero is a stated zero, not an omission. */
  perType: EffectTypeCounts[]
  rows: EffectRow[]
  freshness: EffectsFreshness
  /** What this reader does NOT include. */
  coverage: string
  /** ⚠ WHAT WAS COUNTED. Rows read to produce the counts, and rows handed back. */
  examined: { rowsCounted: number; rowsReturned: number }
}

export const EFFECTS_COVERAGE_STATEMENT =
  'Official-record rows only (legislation.gov.uk’s own changes record, as stored here), plus our own '
  + 'extraction where made-under or cites are asked for; Bills-API amendments are not included.'

/**
 * ⚠ THE CAVEAT IS BUILT FROM THE FIGURES. No digit is written in this template — every number
 * is interpolated — and `check:statutory`'s no-hardcoded-figure rule covers this file.
 */
export function effectsFreshnessCaveat(newestRowAt: string | null, ageDays: number | null, stale: boolean): string {
  if (!newestRowAt || ageDays === null) {
    return 'We hold no dated record for this answer, so do not describe it as current — check legislation.gov.uk.'
  }
  const date = newestRowAt.slice(0, 10)
  const base = `This is a stored copy of legislation.gov.uk’s changes record, last refreshed on ${date} (${ageDays} days ago)`
  return stale
    ? `${base}, so it will not show amendments, repeals or commencements made since then — check legislation.gov.uk before relying on it as current.`
    : `${base}; it is not live.`
}

function freshnessOf(newest: Date | string | null): EffectsFreshness {
  if (!newest) return { newestRowAt: null, ageDays: null, stale: true, caveat: effectsFreshnessCaveat(null, null, true) }
  const d = new Date(newest)
  const ageDays = Math.floor((Date.now() - d.getTime()) / 86_400_000)
  const stale = ageDays > FRESHNESS_DAYS
  const iso = d.toISOString()
  return { newestRowAt: iso, ageDays, stale, caveat: effectsFreshnessCaveat(iso, ageDays, stale) }
}

/**
 * The newest row in the table, for the case where the Act has NO rows and so cannot date itself.
 * ⚠ A DATE, NEVER A COUNT — this is the one query here that is not scoped to the Act, and it
 * returns a timestamp only. Cached: it moves only when an ingest runs.
 */
let tableNewestCache: { at: number; value: Date | null } | null = null
async function tableNewest(): Promise<Date | null> {
  if (tableNewestCache && Date.now() - tableNewestCache.at < 300_000) return tableNewestCache.value
  const r = await prisma.$queryRawUnsafe<Array<{ newest: Date | null }>>(
    `SELECT MAX(extracted_at) AS newest FROM ${EFFECTS_TABLE}`)
  const value = r[0]?.newest ?? null
  tableNewestCache = { at: Date.now(), value }
  return value
}

/**
 * The effects record's load date (YYYY-MM-DD): the newest `extracted_at` in the table, i.e. the law as we hold it.
 * This is the `as_at` LEX 26-U §5 writes on a drafting-instruction row (BRIEF_26U decision 226). Null when the
 * table holds no date. ⚠ It is the record's last refresh, so a change made after it is invisible to every reader here.
 */
export async function effectsLoadDate(): Promise<string | null> {
  const d = await tableNewest()
  return d ? new Date(d).toISOString().slice(0, 10) : null
}

/**
 * ⚠ THE ID FORMS OF ONE ACT, THROUGH THE IDENTITY BRIDGE — AND A REFUSAL IS NOT AN ABSENCE.
 *
 * Pre-1963 Acts are recorded under a regnal form (`ukpga/Vict/24-25/100`) by the effects feed and
 * under a calendar form (`ukpga/1861/100`) by our citation extractor; the same table holds both.
 * `legislation_identity` records that they are one instrument (basis and all). A form that fits
 * MORE THAN ONE Act is stored as `ambiguous-refused`: we do not guess between them, and the caller
 * is told so rather than handed an empty answer that reads as "nothing affects it".
 */
export async function resolveActForms(given: string): Promise<EffectsResult['resolution']> {
  const base = gidCandidates(given)
  let rows: Array<{ form: string; canonical: string | null; basis: string }>
  try {
    rows = await prisma.$queryRawUnsafe(`
      SELECT form, canonical, basis FROM ${IDENTITY_TABLE}
      WHERE form = ANY($1::text[]) OR canonical = ANY($1::text[])
         OR canonical IN (SELECT canonical FROM ${IDENTITY_TABLE}
                           WHERE form = ANY($1::text[]) AND canonical IS NOT NULL)`, base)
  } catch {
    return {
      canonical: base[0], candidates: base, bridge: 'unavailable',
      note: 'the year-form identity table could not be read, so rows recorded under a different year form of this Act may be missing',
    }
  }
  const baseLower = new Set(base.map((b) => b.toLowerCase()))
  const refused = rows.find((r) => r.basis === 'ambiguous-refused' && baseLower.has(r.form.toLowerCase()))
  if (refused) {
    return {
      canonical: base[0], candidates: base, bridge: 'ambiguous-refused',
      note: `“${refused.form}” fits more than one Act (two parliamentary sessions can fall inside one calendar year), `
        + 'so we have not guessed between them. This is a refusal, not an absence: it does not mean nothing affects the Act you meant. '
        + 'Ask again with the regnal-year form of the Act.',
    }
  }
  const forms = new Set(base)
  for (const r of rows) { forms.add(r.form); if (r.canonical) forms.add(r.canonical) }
  const candidates = [...forms]
  // The canonical form named for a form the caller gave; failing that, what the caller gave.
  const canonical = rows.find((r) => r.canonical && baseLower.has(r.form.toLowerCase()))?.canonical
    ?? rows.find((r) => r.canonical && baseLower.has(r.canonical.toLowerCase()))?.canonical
    ?? base[0]
  return {
    canonical, candidates,
    bridge: candidates.length > base.length ? 'bridged' : 'not-needed',
    note: candidates.length > base.length
      ? 'this Act is recorded under more than one year form; rows under every form are included'
      : null,
  }
}

const IN_FORCE_SHAPE = /^(\d{4}-\d{2}-\d{2})?\|([^|]*)\|(true|false)$/

function parseEnd(id: string): { corpus: string | null; gid: string; provision: string | null } {
  const p = id.split(':')
  return { corpus: p.length > 1 ? p[0] : null, gid: p[1] ?? id, provision: p[2] ? p[2] : null }
}

interface RawEffectRow {
  from_id: string; to_id: string; edge_type: string; sub_type: string; source: string
  granularity: string; detail: string | null; extracted_at: Date
}

function toEffectRow(r: RawEffectRow, direction: EffectDirection): EffectRow {
  const edgeType = r.edge_type as EdgeTypeName
  const other = parseEnd(direction === 'inbound' ? r.from_id : r.to_id)
  const thisEnd = parseEnd(direction === 'inbound' ? r.to_id : r.from_id)
  const reading = readEffect(r.edge_type, r.sub_type)
  const origin = originOf(r.source)

  // ⚠ A QUOTE IS NEVER MANUFACTURED. Only our own extraction of `made-under` keeps words, and
  // what it kept is the stored phrase — which may be cut short. A `cites` row in this table keeps
  // none; an official row's `detail` is structured, not prose; an unknown source gets nothing.
  let quote: EffectRow['quote'] = null
  let inForce: EffectRow['inForce'] = null
  let detailUnparsed: string | null = null
  const detail = r.detail && r.detail.trim() ? r.detail : null
  if (detail) {
    if (origin === 'extracted' && edgeType === 'made-under') {
      quote = { text: detail, kind: 'preamble-words' }
    } else if (origin === 'official') {
      const m = IN_FORCE_SHAPE.exec(detail)
      if (m) inForce = { date: m[1] ?? null, qualification: m[2] || null, applied: m[3] === 'true' }
      else detailUnparsed = detail
    } else {
      detailUnparsed = detail
    }
  }

  return {
    direction, edgeType, subType: r.sub_type,
    changeKind: reading.kind, changeRule: reading.rule, changeReason: reading.reason,
    prospective: reading.prospective, temporary: reading.temporary,
    otherEnd: { ...other, title: null },
    thisEndProvision: thisEnd.provision,
    scope: thisEnd.provision === null ? 'act-wide' : 'provision',
    granularity: r.granularity, source: r.source, origin, quote, inForce, detailUnparsed,
    extractedAt: new Date(r.extracted_at).toISOString(),
  }
}

const emptyKinds = (): Record<ChangeKind, number> => ({ textual: 0, 'not-textual': 0, unclassified: 0 })

/**
 * The recorded effects on an Act (or one provision of it), per type, with their sources.
 *
 * ⚠ A PROVISION QUERY RETURNS ACT-WIDE ROWS TOO, MARKED AS SUCH. An effect recorded against the
 * Act as a whole bears on every provision in it (an Act-level repeal is not "about" section 5 and
 * is still the biggest thing that can happen to it). `inboundFor` excludes the equivalent rows and
 * counts them in prose; here they stay in the answer, counted separately in `byScope`, because a
 * clerk asking about one section would otherwise never learn the whole Act was repealed.
 *
 * ⚠ `provision` must be an id (`section-149`), not a pattern. A character outside `[A-Za-z0-9-]`
 * is REFUSED rather than stripped: it would otherwise reach the regex in `provisionPredicate`.
 */
export async function effectsFor(
  act: string,
  opts: {
    provision?: string | null
    direction?: EffectDirection
    edgeTypes?: readonly EdgeTypeName[]
    limitPerType?: number
  } = {},
): Promise<EffectsResult> {
  const direction: EffectDirection = opts.direction ?? 'inbound'
  const requestedTypes = [...new Set(opts.edgeTypes?.length ? opts.edgeTypes : DEFAULT_EFFECT_TYPES)]
  for (const t of requestedTypes) {
    if (!ALL_EDGE_TYPES.includes(t)) throw new Error(`"${t}" is not an edge type this reader knows (${ALL_EDGE_TYPES.join(', ')})`)
  }
  const limit = Math.min(Math.max(Math.trunc(opts.limitPerType ?? 100), 1), 500)
  const provision = opts.provision?.trim() || null
  if (provision && !/^[A-Za-z0-9-]+$/.test(provision)) {
    throw new Error(`"${provision}" is not a provision id such as section-149 (letters, digits and hyphens only)`)
  }

  const resolution = await resolveActForms(act)
  const gid = resolution.canonical
  const empty =(): EffectTypeCounts[] => requestedTypes.map((edgeType) => ({
    edgeType, total: 0, byKind: emptyKinds(), byRule: {}, bySource: [],
    byOrigin: { official: 0, extracted: 0, unrecognised: 0 }, byScope: { provision: 0, actWide: 0 },
    prospective: 0, returned: 0, truncated: false,
  }))

  // ⚠ A REFUSED FORM RETURNS NO ROWS AND SAYS WHY. Querying the literal form would attach rows to
  // "this Act" that may belong to either of the two it fits.
  if (resolution.bridge === 'ambiguous-refused') {
    return {
      target: { given: act, gid, provision, title: null }, resolution, direction, requestedTypes,
      perType: empty(), rows: [], freshness: freshnessOf(await tableNewest()),
      coverage: EFFECTS_COVERAGE_STATEMENT, examined: { rowsCounted: 0, rowsReturned: 0 },
    }
  }

  const thisCol = direction === 'inbound' ? 'to_id' : 'from_id'
  const otherCol = direction === 'inbound' ? 'from_id' : 'to_id'
  const thisGid = `split_part(${thisCol}, ':', 2)`
  const thisProv = `split_part(${thisCol}, ':', 3)`

  // `= ANY($1)` over the expression index on (split_part(…, 2), edge_type) — see `gidCandidates`.
  const provClause = (idx: number): { sql: string; params: string[] } => {
    if (!provision) return { sql: '', params: [] }
    const p = provisionPredicate(thisProv, provision)
    return { sql: ` AND (${p.sql.replace(/\$P/g, `$${idx}`)} OR ${thisProv} = '')`, params: p.params }
  }

  const gp = provClause(3)
  const grouped = await prisma.$queryRawUnsafe<Array<{
    edge_type: string; source: string; sub_type: string; act_wide: boolean; n: bigint; newest: Date
  }>>(
    `SELECT edge_type, source, sub_type, (${thisProv} = '') AS act_wide,
            COUNT(*)::bigint AS n, MAX(extracted_at) AS newest
     FROM ${EFFECTS_TABLE}
     WHERE ${thisGid} = ANY($1::text[]) AND edge_type = ANY($2::text[])${gp.sql}
     GROUP BY 1, 2, 3, 4`,
    resolution.candidates, requestedTypes, ...gp.params)

  const perType = new Map<EdgeTypeName, EffectTypeCounts>(empty().map((c) => [c.edgeType, c]))
  let newest: Date | null = null
  let rowsCounted = 0
  for (const g of grouped) {
    const c = perType.get(g.edge_type as EdgeTypeName)
    if (!c) continue
    const n = Number(g.n)
    const reading = readEffect(g.edge_type, g.sub_type)
    const origin = originOf(g.source)
    c.total += n
    rowsCounted += n
    c.byKind[reading.kind] += n
    c.byRule[reading.rule] = (c.byRule[reading.rule] ?? 0) + n
    if (reading.prospective) c.prospective += n
    if (g.act_wide) c.byScope.actWide += n; else c.byScope.provision += n
    if (origin === 'official') c.byOrigin.official += n
    else if (origin === 'extracted') c.byOrigin.extracted += n
    else c.byOrigin.unrecognised += n
    const s = c.bySource.find((x) => x.source === g.source)
    if (s) s.rows += n; else c.bySource.push({ source: g.source, origin, rows: n })
    if (!newest || g.newest > newest) newest = g.newest
  }

  // The rows themselves: one capped query per type, so a heavily-amended type cannot crowd the others.
  const rowSets = await Promise.all(requestedTypes.map(async (t) => {
    if (!perType.get(t)!.total) return [] as RawEffectRow[]
    const rp = provClause(3)
    return prisma.$queryRawUnsafe<RawEffectRow[]>(
      `SELECT from_id, to_id, edge_type, sub_type, source, granularity, detail, extracted_at
       FROM ${EFFECTS_TABLE}
       WHERE ${thisGid} = ANY($1::text[]) AND edge_type = $2${rp.sql}
       ORDER BY ${otherCol}, sub_type
       LIMIT ${limit}`,
      resolution.candidates, t, ...rp.params)
  }))
  const rows: EffectRow[] = []
  requestedTypes.forEach((t, i) => {
    const c = perType.get(t)!
    c.returned = rowSets[i].length
    c.truncated = c.total > c.returned
    for (const r of rowSets[i]) rows.push(toEffectRow(r, direction))
  })

  // Titles: one query for the distinct instruments at the other end and the target. A miss is null.
  const gids = [...new Set([gid, ...rows.map((r) => r.otherEnd.gid)])]
  const titles = new Map<string, string>()
  for (const t of await prisma.$queryRawUnsafe<Array<{ gid: string; title: string | null }>>(
    `SELECT gid, title FROM corpus_acts WHERE gid = ANY($1::text[]) AND title IS NOT NULL`,
    [...new Set(gids.flatMap((g) => gidCandidates(g)).concat(resolution.candidates))],
  ).catch(() => [])) {
    if (t.title) titles.set(t.gid, t.title)
  }
  for (const r of rows) r.otherEnd.title = titles.get(r.otherEnd.gid) ?? null
  const targetTitleFound = resolution.candidates.map((c) => titles.get(c)).find(Boolean) ?? null

  return {
    target: { given: act, gid, provision, title: targetTitleFound },
    resolution, direction, requestedTypes,
    perType: requestedTypes.map((t) => perType.get(t)!),
    rows,
    freshness: freshnessOf(newest ?? await tableNewest()),
    coverage: EFFECTS_COVERAGE_STATEMENT,
    examined: { rowsCounted, rowsReturned: rows.length },
  }
}

/** The recognised sources, for a caller that wants to say what each one is. */
export const KNOWN_EDGE_SOURCES = EDGE_SOURCES

// ═════════════════════════════════════════════════════════════════════════════════════════
// THE IDEA↔LAW JOIN — which laws an idea concerns, and what the graph says about each (GRAPH 7).
//
// `idea_law_link` holds the rows (prisma/graph_7_idea_law_link.sql); this reads them, resolves every target
// against the corpus, and hangs the effects reader off the amends / repeals rows. Read-only.
//
// ⚠⚠ THREE THINGS THIS READER REFUSES TO DO:
//   1. CONFLATE THE FOUR RESOLUTION STATES. Held / named-not-held / no-such-id / lookup-failed are different
//      facts, and a row that is not held is RETURNED in `unresolved` with its state — never dropped.
//   2. PASS A BILL TO THE EFFECTS READER. A Bill is not law and has no effects (constraint f).
//   3. LET AN IDEA'S `modifies` MEET THE CORPUS'S. The idea's row is an author's drafting choice; the corpus's
//      `modifies` edges are frequently unclassified. The corpus figures appear only inside an amends / repeals
//      row's `effects`, per type and split; nothing here adds them to anything an author wrote.
// ═════════════════════════════════════════════════════════════════════════════════════════

/** The fetch the resolver uses for the publisher checks — injectable so a check can make it fail. */
export type LawFetch = (url: string, init: { method: 'GET' | 'HEAD' }) => Promise<{ status: number }>

const defaultFetch: LawFetch = (url, init) =>
  fetch(url, { ...init, redirect: 'follow', signal: AbortSignal.timeout(6_000), headers: { 'User-Agent': 'Scrutinise/1.0' } })

const escapeLike = (s: string) => s.replace(/[\\%_]/g, (c) => `\\${c}`)

/**
 * The publisher's answer for an id we do not hold.
 * ⚠ legislation.gov.uk answers **400**, not 404, for an id that names nothing (measured 22 Oct 2026 on
 * `ukpga/2099/999/data.xml`). Both are read as "no such id"; anything else that is not a 200 is a failed lookup.
 */
async function askPublisher(url: string, f: LawFetch, method: 'GET' | 'HEAD' = 'HEAD'):
  Promise<{ state: 'named-not-held' | 'no-such-id' | 'lookup-failed'; said: string }> {
  try {
    const r = await f(url, { method })
    if (r.status === 200) return { state: 'named-not-held', said: `${url} answered 200` }
    if (r.status === 404 || r.status === 400) return { state: 'no-such-id', said: `${url} answered ${r.status}` }
    return { state: 'lookup-failed', said: `${url} answered ${r.status}, which says neither yes nor no` }
  } catch (e) {
    return { state: 'lookup-failed', said: `${url} could not be reached (${e instanceof Error ? e.message : String(e)})` }
  }
}

/**
 * Resolve one stored target against the corpus — and, only on a miss, against its publisher.
 *
 * ⚠ THE CORPUS FIRST, ALWAYS. "Held" can only be said by our own tables. The publisher is asked only to tell
 * "named, not held" from "no such id", which no table of ours can do for something it has never seen.
 * `external: false` skips that question and says so (`lookup-failed`), rather than guessing either way.
 */
export async function resolveLawTarget(
  targetKind: LawTargetKind,
  docUri: string,
  provisionPath: string | null,
  opts: { external?: boolean; fetch?: LawFetch } = {},
): Promise<LawResolution> {
  const external = opts.external ?? true
  const f = opts.fetch ?? defaultFetch
  const base = { title: null, canonical: null, provision: null } as const
  try {
    // ── a Bill: the Bills API corpus, by bill id ──────────────────────────────────────────
    if (targetKind === 'bill') {
      const m = /^bill\/(\d+)$/.exec(docUri)
      if (!m) return { ...base, state: 'no-such-id', reason: `“${docUri}” is not a Bill id of the form bill/<number>`, checkedAgainst: [] }
      const r = await prisma.$queryRawUnsafe<Array<{ n: number; compiled: number }>>(
        `SELECT COUNT(*)::int AS n, COUNT(*) FILTER (WHERE status = 'compiled')::int AS compiled
         FROM corpus_sections WHERE corpus = 'bills-api' AND split_part(id, ':', 2) = $1`, m[1])
      if (r[0].compiled > 0) {
        return { ...base, state: 'held', reason: `${r[0].compiled} of ${r[0].n} publications of Bill ${m[1]} held as text (bills-api)`, checkedAgainst: ['corpus'] }
      }
      if (!external) return { ...base, state: 'lookup-failed', reason: `no text of Bill ${m[1]} in our corpus (${r[0].n} rows, none compiled); the Bills API was not asked`, checkedAgainst: ['corpus'] }
      const p = await askPublisher(`https://bills-api.parliament.uk/api/v1/Bills/${m[1]}`, f, 'GET')
      return { ...base, state: p.state, reason: `no text of Bill ${m[1]} in our corpus (${r[0].n} rows, none compiled); ${p.said}`, checkedAgainst: ['corpus', 'bills-api'] }
    }

    // ── a document: doc/<corpus>/<document id>, which is the corpus's own key ───────────
    if (targetKind === 'document') {
      const m = /^doc\/([a-z0-9-]+)\/(.+)$/.exec(docUri)
      if (!m) return { ...base, state: 'no-such-id', reason: `“${docUri}” is not a document id of the form doc/<corpus>/<document id>`, checkedAgainst: [] }
      const r = await prisma.$queryRawUnsafe<Array<{ n: number }>>(
        `SELECT COUNT(*)::int AS n FROM corpus_sections WHERE corpus = $1 AND id LIKE $2 ESCAPE '\\' AND status = 'compiled'`,
        m[1], `${escapeLike(`${m[1]}:${m[2]}:`)}%`)
      return r[0].n > 0
        ? { ...base, state: 'held', reason: `${r[0].n} held sections under ${m[1]}:${m[2]}`, checkedAgainst: ['corpus'] }
        // ⚠ A document has no public register to ask, so "named, not held" cannot be established for one.
        : { ...base, state: 'no-such-id', reason: `no held text under ${m[1]}:${m[2]} — a document has no public register to ask, so this cannot be told apart from one we never ingested`, checkedAgainst: ['corpus'] }
    }

    // ── legislation: an Act or instrument, and perhaps one provision of it ────────────────
    if (!/^[a-z]+\/[A-Za-z0-9-]+(\/[A-Za-z0-9-]+)+$/.test(docUri)) {
      return { ...base, state: 'no-such-id', reason: `“${docUri}” is not a legislation id of the form type/year/number`, checkedAgainst: [] }
    }
    const resolution = await resolveActForms(docUri)
    if (resolution.bridge === 'ambiguous-refused') {
      return { ...base, state: 'lookup-failed', reason: resolution.note ?? 'this id fits more than one Act', checkedAgainst: ['corpus'] }
    }
    const acts = await prisma.$queryRawUnsafe<Array<{ gid: string; title: string | null; corpus: string | null; section_count: number; in_corpus: boolean }>>(
      `SELECT gid, title, corpus, section_count, in_corpus FROM corpus_acts WHERE gid = ANY($1::text[])`, resolution.candidates)
    const heldAct = acts.find((a) => a.in_corpus && a.section_count > 0 && a.corpus)
    const bridgeNote = resolution.bridge === 'unavailable' ? ` (${resolution.note})` : ''

    if (!heldAct) {
      const known = acts[0]
        ?? (await prisma.$queryRawUnsafe<Array<{ g: string }>>(
          `SELECT split_part(to_id, ':', 2) AS g FROM ${EFFECTS_TABLE} WHERE split_part(to_id, ':', 2) = ANY($1::text[]) LIMIT 1`,
          resolution.candidates))[0]
      if (known) {
        return {
          ...base, state: 'named-not-held', title: acts[0]?.title ?? null, canonical: resolution.canonical,
          reason: acts[0]
            ? `${docUri} is in our register of Acts, with no text held${bridgeNote}`
            : `${docUri} is named in the official changes record, and we hold no text of it${bridgeNote}`,
          checkedAgainst: ['corpus'],
        }
      }
      if (!external) return { ...base, state: 'lookup-failed', reason: `${docUri} is not in our corpus; legislation.gov.uk was not asked${bridgeNote}`, checkedAgainst: ['corpus'] }
      const p = await askPublisher(`https://www.legislation.gov.uk/${docUri}/data.xml`, f)
      return { ...base, state: p.state, reason: `${docUri} is not in our corpus; ${p.said}${bridgeNote}`, checkedAgainst: ['corpus', 'legislation.gov.uk'] }
    }

    const actHeld = {
      title: heldAct.title, canonical: heldAct.gid !== docUri ? heldAct.gid : null,
      reason: `${heldAct.gid} held: ${heldAct.section_count.toLocaleString()} sections in ${heldAct.corpus}${bridgeNote}`,
    }
    if (targetKind !== 'provision' || !provisionPath) {
      return { ...actHeld, state: 'held', provision: null, checkedAgainst: ['corpus'] }
    }

    // ── the provision ───────────────────────────────────────────────────────────────────
    const path = provisionPath.trim()
    if (!PROVISION_PATH_SHAPE.test(path)) {
      return { ...actHeld, state: 'no-such-id', checkedAgainst: ['corpus'],
        provision: { path, ref: path, state: 'not-held', reason: `“${path}” is not a provision path such as section/149 or schedule/2/paragraph/3` },
        reason: `${actHeld.reason}; the provision path is malformed` }
    }
    const ref = provisionRefOf(path)
    if (isUnaddressableProvision(path)) {
      return { ...actHeld, state: 'held', checkedAgainst: ['corpus'],
        provision: { path, ref, state: 'unaddressable', reason: 'a Part or Chapter is not a row of its own in our corpus, so the Act is checked and the provision is not' } }
    }
    const pp = provisionPredicate(`split_part(id, ':', 3)`, ref)
    const rows = await prisma.$queryRawUnsafe<Array<{ exact: number; n: number }>>(
      `SELECT COUNT(*) FILTER (WHERE lower(split_part(id, ':', 3)) = $3)::int AS exact, COUNT(*)::int AS n
       FROM corpus_sections WHERE corpus = $1 AND id LIKE $2 ESCAPE '\\' AND ${pp.sql.replace(/\$P/g, '$3')}`,
      heldAct.corpus, `${escapeLike(`${heldAct.corpus}:${heldAct.gid}:`)}%`, ...pp.params)
    if (rows[0].n > 0) {
      return { ...actHeld, state: 'held', checkedAgainst: ['corpus'],
        provision: { path, ref, state: 'held', reason: rows[0].exact ? `${ref} held` : `${ref} held as ${rows[0].n} rows beneath it` } }
    }
    if (!external) {
      return { ...actHeld, state: 'lookup-failed', checkedAgainst: ['corpus'],
        provision: { path, ref, state: 'not-held', reason: `no row for ${ref}; legislation.gov.uk was not asked` },
        reason: `${actHeld.reason}; the provision is not held and was not checked` }
    }
    const p = await askPublisher(`https://www.legislation.gov.uk/${heldAct.gid}/${path}/data.xml`, f)
    return { ...actHeld, state: p.state, checkedAgainst: ['corpus', 'legislation.gov.uk'],
      provision: { path, ref, state: 'not-held', reason: `no row for ${ref} in ${heldAct.corpus}; ${p.said}` },
      reason: `${actHeld.reason}; the provision is not held` }
  } catch (e) {
    return { ...base, state: 'lookup-failed', reason: `the lookup itself failed: ${e instanceof Error ? e.message : String(e)}`, checkedAgainst: [] }
  }
}

/** GRAPH_6's per-type counts, as the panel shows them. ⚠ A failure is a sentence, never a zero. */
async function lawEffects(gid: string, provisionRef: string | null): Promise<LawEffectsSummary> {
  try {
    const e = await effectsFor(gid, { provision: provisionRef, limitPerType: 1 })
    return {
      perType: e.perType.map((t) => ({
        edgeType: t.edgeType, total: t.total,
        textual: t.byKind.textual, notTextual: t.byKind['not-textual'], unclassified: t.byKind.unclassified,
      })),
      caveat: e.freshness.caveat,
      rowsCounted: e.examined.rowsCounted,
      failed: null,
    }
  } catch (err) {
    return { perType: [], caveat: '', rowsCounted: 0, failed: `the effects record could not be read: ${err instanceof Error ? err.message : String(err)}` }
  }
}

/**
 * Official changes to a target coming into force AFTER the date a link was attached against.
 * ⚠ It can only see what the stored record holds: a change made after the record's last refresh is invisible,
 * and `freshness.basis` says so in the same breath as the result.
 */
async function changesInForceAfter(gid: string, provisionRef: string | null, asAt: string): Promise<number> {
  const thisProv = `split_part(to_id, ':', 3)`
  let provSql = ''
  const params: unknown[] = [gidCandidates(gid), asAt]
  if (provisionRef) {
    const p = provisionPredicate(thisProv, provisionRef)
    provSql = ` AND (${p.sql.replace(/\$P/g, '$3')} OR ${thisProv} = '')`
    params.push(...p.params)
  }
  const r = await prisma.$queryRawUnsafe<Array<{ n: number }>>(
    `SELECT COUNT(*)::int AS n FROM ${EFFECTS_TABLE}
     WHERE split_part(to_id, ':', 2) = ANY($1::text[]) AND edge_type IN ('amends','repeals','modifies')
       AND detail ~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}[|]' AND substr(detail, 1, 10)::date > $2::date${provSql}`, ...params)
  return r[0].n
}

/**
 * Everything the idea concerns in law: its own rows and its actions' rows, resolved, grouped by relation.
 *
 * ⚠ READ-ONLY. ⚠ A failure to read the link table THROWS — an idea with no links and an idea whose links could
 * not be read must never look the same, so the caller says which (the page does). A failure on one target is
 * that row's `lookup-failed`, and the rest of the set still answers.
 */
export async function ideaLawSet(ideaId: string, opts: { external?: boolean; fetch?: LawFetch } = {}): Promise<IdeaLawSet> {
  const all = await prisma.ideaLawLink.findMany({
    where: { OR: [{ ideaId }, { action: { ideaId } }] },
    include: { action: { select: { id: true, ideaId: true, number: true, title: true, practicalStep: true } } },
    orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
  })
  // Live = neither superseded nor withdrawn (prisma/graph_7_idea_law_link_withdrawn.sql).
  const live = all.filter((l) => l.supersededById === null && l.withdrawnAt === null)

  // One resolution and one effects read per distinct target, however many rows name it.
  const resolutions = new Map<string, Promise<LawResolution>>()
  const resolve = (k: LawTargetKind, d: string, p: string | null) => {
    const key = `${k}|${d}|${p ?? ''}`
    if (!resolutions.has(key)) resolutions.set(key, resolveLawTarget(k, d, p, opts))
    return resolutions.get(key)!
  }
  const effects = new Map<string, Promise<LawEffectsSummary>>()

  const rows: IdeaLawRow[] = await Promise.all(live.map(async (l) => {
    const targetKind = l.targetKind as LawTargetKind
    const relation = l.relation as LawRelation
    const resolution = await resolve(targetKind, l.docUri, l.provisionPath)
    let fx: LawEffectsSummary | null = null
    // ⚠ CONSTRAINT f: a Bill (and a document) never reaches the effects reader.
    const isLegislation = targetKind === 'act' || targetKind === 'instrument' || targetKind === 'provision'
    if ((relation === 'amends' || relation === 'repeals') && isLegislation && resolution.state === 'held') {
      const gid = resolution.canonical ?? l.docUri
      const ref = resolution.provision && resolution.provision.state !== 'unaddressable' ? resolution.provision.ref : null
      const key = `${gid}|${ref ?? ''}`
      if (!effects.has(key)) effects.set(key, lawEffects(gid, ref))
      fx = await effects.get(key)!
    }
    const entry = {
      id: l.id,
      source: l.source as LawSource, sourceDetail: l.sourceDetail, note: l.note,
      action: l.action ? { id: l.action.id, number: l.action.number, title: l.action.title || l.action.practicalStep } : null,
      asAt: l.asAt.toISOString().slice(0, 10), createdAt: l.createdAt.toISOString(),
    }
    return {
      ...entry, ideaId: l.ideaId,
      targetKind, docUri: l.docUri, provisionPath: l.provisionPath, relation,
      resolution, effects: fx, sources: [entry],
    }
  }))

  // ⚠ An action row must belong to this idea's action AND to this idea. A mismatch is reported, never merged.
  const actionIdea = new Map(live.map((l) => [l.id, l.action?.ideaId ?? null]))
  const inconsistent = rows.filter((r) => r.ideaId !== ideaId || (r.action !== null && actionIdea.get(r.id) !== ideaId))
  // A hand row and an instruction row naming the same (relation, target) are ONE line with both sources (BRIEF_26U §5).
  const consistent = mergeLawLines(rows.filter((r) => !inconsistent.includes(r)))

  const grouped = emptyGroups()
  for (const r of consistent) grouped[r.relation].push(r)

  const counts: Record<LawResolutionState, number> = { held: 0, 'named-not-held': 0, 'no-such-id': 0, 'lookup-failed': 0 }
  for (const r of consistent) counts[r.resolution.state]++

  // Freshness: which held legislation has an official change coming into force after its as_at.
  const changed: IdeaLawRow[] = []
  for (const r of consistent) {
    const isLegislation = r.targetKind === 'act' || r.targetKind === 'instrument' || r.targetKind === 'provision'
    if (!isLegislation || r.resolution.state !== 'held') continue
    const ref = r.resolution.provision && r.resolution.provision.state !== 'unaddressable' ? r.resolution.provision.ref : null
    if (await changesInForceAfter(r.resolution.canonical ?? r.docUri, ref, r.asAt).catch(() => 0) > 0) changed.push(r)
  }
  // ⚠ An idea with no links (most of them) pays for one indexed read and nothing else — this panel is on every idea page.
  const recordRefreshedAt = consistent.length ? await effectsLoadDate().catch(() => null) : null
  const asserted = consistent.length ? consistent.map((r) => r.asAt).sort()[0] : null

  return {
    ideaId, rows: consistent, grouped,
    freshness: {
      asserted_as_at: asserted,
      changed_since: changed,
      recordRefreshedAt,
      basis: !consistent.length
        ? 'nothing is attached, so there is nothing to check for changes'
        : recordRefreshedAt
        ?`a row counts as changed if the official changes record holds an amendment, repeal or modification to its target coming into force after the date it was attached against; that record was last refreshed on ${recordRefreshedAt}, so a change made after then cannot be seen here`
        : 'the official changes record holds no date, so no row can be shown as changed since it was attached',
    },
    unresolved: consistent.filter((r) => r.resolution.state !== 'held'),
    inconsistent,
    counts,
    examined: {
      linkRows: all.length,
      superseded: all.filter((l) => l.supersededById !== null).length,
      withdrawn: all.filter((l) => l.withdrawnAt !== null).length,
      mergedIntoALine: rows.length - inconsistent.length - consistent.length,
      // Per distinct target, so an Act named by two rows is not counted twice.
      effectRowsCounted: (await Promise.all([...effects.values()])).reduce((s, e) => s + e.rowsCounted, 0),
    },
  }
}
