// ─────────────────────────────────────────────────────────────────────────────
// THE ONWARD READER — pure half (GRAPH 8, docs/BRIEF_GRAPH_8_ONWARD.md).
//
// Kinds, strengths, target parsing, the citing-text states and the words a reader is given. No
// database: everything here is a property of a VALUE, so `check:onward` can call it, and break it.
//
// ⚠⚠ A CITATION IS NOT A CONSEQUENCE. If X cites Y and Y is amended, it does not follow that X
// changes; it follows that a drafter should READ X. This file is where that distinction lives, as
// a strength on every row, and as the only words the reader has for each strength.
// ─────────────────────────────────────────────────────────────────────────────

/**
 * The kinds walked by default. Order is strength order, strongest first.
 *
 * ⚠⚠ DECISION 271 (24 Oct 2026): `made-under` is a row whose enacting words name this as THE POWER EXERCISED
 * (`citation_edge.enabling_role = 'power'`). An instrument's enacting words that name it any other way — "the
 * requirements of section 20 … have been complied with", "laid before Parliament under section 20(1)(a)", a
 * designation, a consent — are `enacting-mention`: a reference, for review. Before 271 both were `made-under`, and
 * every "made under CRaG s.20" row was the second kind (GRAPH_8_REPORT §5).
 */
export const ONWARD_KINDS = ['made-under', 'amends', 'repeals', 'modifies', 'commences', 'cites', 'enacting-mention'] as const
/** ⚠ Requestable, never walked by default (§5d): a judgment citing a provision is interpretation, not drafting. */
export const CASELAW_KIND = 'caselaw-markup' as const
export type OnwardKind = typeof ONWARD_KINDS[number] | typeof CASELAW_KIND
export const ALL_ONWARD_KINDS: readonly OnwardKind[] = [...ONWARD_KINDS, CASELAW_KIND]

export type Strength = 'dependency' | 'operation' | 'reference' | 'interpretation'

/**
 * ⚠ ONE KIND, ONE STRENGTH — A TABLE, NOT A TERNARY (§5e). A kind this build does not know has no
 * strength, and `strengthOf` returns null for it rather than whichever strength an else-arm named.
 * That is how a citation would quietly become a consequence.
 */
export const STRENGTH_OF: Readonly<Record<OnwardKind, Strength>> = {
  'made-under': 'dependency',
  amends: 'operation',
  repeals: 'operation',
  modifies: 'operation',
  commences: 'operation',
  cites: 'reference',
  'enacting-mention': 'reference',
  'caselaw-markup': 'interpretation',
}

/**
 * `citation_edge.enabling_role` — read by the extractor from the enacting words (scripts/ingest/graph/
 * extract-madeunder-edges.ts `enablingRole`, validated against 211 hand-labelled hits). Only `power` is a dependency.
 *   power     the words name this as the power exercised            → made-under
 *   mention   they name it as a procedure, consent, designation, …  → enacting-mention
 *   unstated  they say neither                                      → enacting-mention
 */
export type EnablingRole = 'power' | 'mention' | 'unstated'
export const ENABLING_ROLE_WORDS: Readonly<Record<EnablingRole, string>> = {
  power: 'the enacting words name this as the power exercised',
  mention: 'the enacting words mention this, but not as the power exercised',
  unstated: 'the enacting words do not say whether this is the power exercised',
}

export function strengthOf(kind: string): Strength | null {
  return Object.prototype.hasOwnProperty.call(STRENGTH_OF, kind) ? STRENGTH_OF[kind as OnwardKind] : null
}

export const STRENGTH_ORDER: readonly Strength[] = ['dependency', 'operation', 'reference', 'interpretation']

/**
 * The ONLY heading each strength is given. ⚠ `reference` never says consequence, knock-on or
 * consequential — `check:onward` asserts that against `CONSEQUENCE_WORDS` below.
 */
export const STRENGTH_HEADING: Readonly<Record<Strength, { heading: string; meaning: string }>> = {
  dependency: {
    heading: 'Made under this — depends on it',
    meaning: 'instruments made under this power; if the power is repealed or narrowed, each one is directly in question',
  },
  operation: {
    heading: 'Operates on this — the official record',
    meaning: 'provisions recorded by legislation.gov.uk as amending, repealing, modifying or commencing this one',
  },
  reference: {
    heading: 'Provisions that refer to this — for review',
    meaning: 'they mention it; a drafter should read each one, and most will not need to change',
  },
  interpretation: {
    heading: 'Judgments that cite this — interpretation, not drafting',
    meaning: 'a court referred to it; useful for how it is read, and not drafting work',
  },
}

/** Words that describe a CONSEQUENCE. A `reference` row must never be described with any of them. */
export const CONSEQUENCE_WORDS = /\bconsequen|\bknock[- ]on|\bconsequential schedule|\bmust (?:be )?(?:amend|change)|\bwill (?:need to )?change/i

/** The rules a caller is held to — the tool description repeats them verbatim (§4). */
export const ONWARD_RULES: readonly string[] = [
  'A cites row is a provision to read, not a provision that changes. Describe such a set as “provisions that refer to this — for review”, never as consequences, knock-ons or a consequential schedule. An enacting-mention row is the same: the instrument’s enacting words name this, but not as the power it was made under.',
  'Walk made-under as far as it goes. Do NOT walk official effects or citations past depth 2: measured, both reach thousands of instruments by depth 3. Stop citations at depth 1, or depth 2 with the set labelled weak, and never show a depth-3 citation set to a user.',
  'Count and say what was not walked. A truncated set, an unaddressable provision, and a step with no rows are three different facts.',
  'Never put a figure from this reader in the “Consequential amendments and repeals” annexe. That annexe records drafted amendments; this reader produces candidates.',
]

// ── the target ──────────────────────────────────────────────────────────────────

export interface ParsedTarget { gid: string; provision: string | null; error: string | null }

/**
 * Read a target in any of the forms a caller holds: `ukpga/2010/25`, `ukpga/2010/25/section/20`,
 * a legislation.gov.uk URL, our own `corpus:gid:section-20`, or a pre-1963 regnal form
 * (`ukpga/Vict/24-25/100/section/18`). A separate `provision` argument wins over one in the path.
 *
 * ⚠ The gid's length is read from its SHAPE: three segments when the second is a calendar year,
 * four when it is a regnal year. Splitting at a fixed position would read `section` as an Act number.
 */
export function parseTarget(given: string, provision?: string | null): ParsedTarget {
  let s = given.trim().replace(/^https?:\/\/(?:www\.)?legislation\.gov\.uk\//, '').replace(/^id\//, '').replace(/\/+$/, '')
  let prov: string | null = null
  if (s.includes(':')) {
    const p = s.split(':')
    s = p.length >= 3 ? p[1] : p.length === 2 && p[0].includes('/') ? p[0] : p[1]
    prov = p.length >= 3 ? p[2] : p.length === 2 && p[0].includes('/') ? p[1] : null
  }
  const t = s.split('/')
  const calendar = /^\d{4}$/.test(t[1] ?? '')
  const n = calendar ? 3 : 4
  if (t.length < n || !/^[a-z]+$/.test(t[0]) || !/^\d+$/.test(t[n - 1] ?? '')) {
    return { gid: s, provision: null, error: `“${given}” is not a legislation.gov.uk id such as ukpga/2010/25 or ukpga/2010/25/section/20` }
  }
  const gid = t.slice(0, n).join('/')
  const rest = t.slice(n).filter((x) => x !== 'enacted' && x !== 'made' && x !== 'contents')
  if (rest.length) prov = rest.join('-')
  if (provision?.trim()) prov = provision.trim().replace(/\//g, '-')
  if (prov && !/^[A-Za-z0-9-]+$/.test(prov)) {
    return { gid, provision: null, error: `“${prov}” is not a provision id such as section-20 (letters, digits and hyphens only)` }
  }
  return { gid, provision: prov || null, error: null }
}

/**
 * ⚠ §2.4 — A Part or Chapter cannot start a walk: the corpus holds the sections inside it, never a
 * row for it. The walk returns `unaddressable`, never an empty list.
 */
export function isUnaddressableRef(provisionRef: string | null): boolean {
  if (!provisionRef) return false
  return /^(part|chapter|crossheading)-[^-]+$/i.test(provisionRef) || /^(part|chapter)-[^-]+-chapter-[^-]+$/i.test(provisionRef)
}

/** The legislation.gov.uk path of a node: `asp/2010/13` + `section-179` → `asp/2010/13/section/179`. */
export function legPath(gid: string, provisionRef: string | null): string {
  return provisionRef ? `${gid}/${provisionRef.split('-').join('/')}` : gid
}

/** `section-3` matches `section-3-2` and `section-3a`, never `section-30` — the same rule as `provisionPredicate`. */
export function provisionMatches(ref: string | null, target: string): boolean {
  if (!ref) return false
  const r = ref.toLowerCase()
  const p = target.toLowerCase()
  return r === p || (r.startsWith(p) && /^[^0-9]/.test(r.slice(p.length)))
}

// ── the citing words ────────────────────────────────────────────────────────────

export type CitingTextState = 'held' | 'none-stored' | 'possibly-truncated'

/**
 * ⚠⚠ THE TRUNCATION DETERMINATION (§2.2), AND WHY `held` DOES NOT FIRE ON TODAY'S DATA.
 *
 * `extract-citation-edges.ts` stores a WINDOW, not a sentence: up to 300 characters that END at the
 * reference, cut from 400 characters of raw XML before it, with tags stripped and the first partial
 * word dropped. Measured: 300 is the maximum, and the lengths pile up just below it (21,029 rows at
 * 299, 21,990 at 298, …) — the signature of a limit, not of a natural distribution. And by
 * construction NOTHING AFTER the reference is ever stored, so "section 5 of the 2010 Act does not
 * apply" and "section 5 of the 2010 Act applies" can be stored identically.
 *
 * So no stored text can be shown to be a whole sentence, and every one is `possibly-truncated`.
 * `held` is kept for an extractor that records sentence bounds. It is not reachable here, and
 * `check:onward` asserts that it is not reached.
 */
export function citingTextStateOf(stored: string | null): CitingTextState {
  return stored && stored.trim() ? 'possibly-truncated' : 'none-stored'
}

/** A fragment of a tag left at the start of the window when the 400-character cut fell inside one. */
const TAG_DEBRIS = /^[^<>]*?="[^<>]*?>\s*/

/**
 * The stored words as a reader may see them: MARKED at both ends. ⚠ A truncated quotation shown
 * without a mark is an invented quotation. The leading tag debris (a third of all rows) is markup,
 * not words of the law, and is removed; the words themselves are never altered.
 */
export function citingTextForDisplay(stored: string | null): string | null {
  if (!stored || !stored.trim()) return null
  const words = stored.replace(TAG_DEBRIS, '').trim()
  return `“…${words}” [cut at the start; the words after the reference are not stored]`
}

// ── freshness ──────────────────────────────────────────────────────────────────

/**
 * ⚠ §2.3 — THE CAVEAT GETS STRONGER WITH DEPTH. At depth 1 a stale record means some rows are
 * missing and this says so. At depth 2 and beyond one missing edge removes everything beneath it,
 * and nothing in the output can show the gap. No digit is written here; every figure is passed in.
 */
export function onwardCaveat(loadDate: string | null, ageDays: number | null, depth: number): string {
  const base = loadDate && ageDays !== null
    ? `As at ${loadDate}: this is a stored copy of the record, loaded ${ageDays} days ago, so anything recorded since is missing from this step.`
    : 'We hold no load date for this record, so treat it as possibly out of date and check legislation.gov.uk.'
  return depth >= 2
    ? `${base} This is step ${depth} of a walk: any row missing at a step above hides everything that would have been reached through it, and nothing here can show that gap.`
    : base
}

// ── the words a reader is given ─────────────────────────────────────────────────

export interface KindLineInput {
  kind: OnwardKind; strength: Strength; counted: number; returned: number; instruments: number
  /** Omitted for a whole-Act target; given for a provision, where the difference is the answer. */
  scope?: { provision: number; actWide: number }
  split: { total: number; changeWords: number; doNot: number; unclassified: number } | null
}

/**
 * One line per kind, under its strength's heading. ⚠ THE ONE RENDERER: the tool and the report both
 * call it, so a citation cannot be called a consequence in one place and a reference in another.
 */
export function describeKindLine(c: KindLineInput): string {
  const shown = c.returned < c.counted ? ` (${c.returned} shown of ${c.counted})` : ''
  const split = c.split
    ? ` — ${c.split.changeWords} change the words, ${c.split.doNot} do not, ${c.split.unclassified} not classified`
    : ''
  // ⚠ For a provision, the count is split at once: "11 made under s.20" when 8 of them name only the Act is false.
  const scope = c.scope && c.counted
    ? ` — ${c.scope.provision} name this provision, ${c.scope.actWide} only the Act as a whole`
    : ''
  return `${STRENGTH_HEADING[c.strength].heading} · ${c.kind}: ${c.counted} from ${c.instruments} instrument${c.instruments === 1 ? '' : 's'}${shown}${scope}${split}`
}

/** The summary, strongest first; a strength with nothing in it is still stated, as a zero. */
export function describeOnwardSummary(perKind: readonly KindLineInput[]): string[] {
  const out: string[] = []
  for (const s of STRENGTH_ORDER) {
    const lines = perKind.filter((c) => c.strength === s)
    if (!lines.length) continue
    out.push(`${STRENGTH_HEADING[s].heading} — ${STRENGTH_HEADING[s].meaning}`)
    for (const c of lines) out.push(`  ${describeKindLine(c)}`)
  }
  return out
}

/** Depth limits the tool enforces, not merely describes (rule 2). Measured in docs/GRAPH_8_REPORT.md §1. */
export const WITHHELD_FROM_DEPTH: Readonly<Partial<Record<Strength, number>>> = { reference: 3, operation: 3 }
export function withheldAt(strength: Strength, depth: number): boolean {
  const d = WITHHELD_FROM_DEPTH[strength]
  return d !== undefined && depth >= d
}
