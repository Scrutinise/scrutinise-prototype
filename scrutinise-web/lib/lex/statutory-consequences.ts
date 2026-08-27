// ─────────────────────────────────────────────────────────────────────────────
// STATUTORY CONSEQUENCES — group by what a reference DOES, then classify the group.
//
// §3: the graph returns a FACT — *section 12 of the Housing Act 2004 contains the words
// "within the meaning of section 3 of the Equality Act 2010"*. That is a reference. It does
// not say what to do about it. Classification is Lex reading the reference and saying what
// would have to happen to it if the target changed.
//
// ⚠⚠ THE REASON THIS MATTERS, IN CHARLIE'S OWN QUESTION: repealing the Equality Act does
// NOT mean all 1,868 references "need amending". Some become dead letters, some need a
// substitute reference, some must be expressly saved, and some are untouched. **The count
// tells you the scale; only the classification tells you the work.** A proposal that says
// "1,868 consequential amendments" is wrong in a way a select committee would find in a
// minute.
//
// ⚠ GROUP BEFORE CLASSIFY, AND GROUP DETERMINISTICALLY. 1,868 rows classified one at a time
// is ruinous and unreadable. Grouping is done in code, by what the words DO — no model call
// — and only the groups go to the model. That is what makes the cost a function of the
// number of KINDS of reference rather than the number of references.
// ─────────────────────────────────────────────────────────────────────────────

import { callJson, llmOk } from './build-llm'
import { modelFor } from './model-registry'
import { recordSpend } from './spend-ledger'
import type { InboundRow } from './statutory-graph'

export type Disposition = 'repeal' | 'amend' | 'save' | 'replace' | 'no_action'

export const DISPOSITIONS: Record<Disposition, string> = {
  repeal: 'this provision exists only to serve the target; if the target goes, it goes',
  amend: 'it needs rewording — typically a section number that would move',
  save: 'it must be preserved despite the change (transitional protection, accrued rights)',
  replace: 'it needs a substitute reference to whatever replaces the target',
  no_action: 'it mentions the target but nothing breaks',
}

/**
 * ⚠⚠ A THIRD OF `citation_text` IS NOT THE SOURCE'S WORDS — IT IS LEAKED XML.
 *
 * Measured across the whole table: **334,740 of 1,034,548 rows (32.4%)** contain XML
 * attributes, e.g. `IdURI="http://…/uksi/2010/1277/body" NumberOfProvisions="3"> Citation 1
 * This Order may be cited as…`. For CRaG 2010 it is 34.9% of provision-level rows.
 *
 * This matters more here than anywhere else in the platform, because §3 requires **every
 * disposition to be traceable to the citation text that produced it** — *"a disposition
 * with no visible source words is Lex putting confident prose on top of a verified fact and
 * destroying its verifiability, which is the one thing this graph exists to prevent."* A
 * quotation that renders as XML soup does not discharge that; it looks like a bug and
 * teaches the reader to distrust the whole panel.
 *
 * ⚠ SO IT IS CLEANED, AND WHAT CANNOT BE CLEANED IS COUNTED — never dropped silently (§7).
 * Reported upstream to Search/Graph rather than fixed here: the extractor owns the column,
 * and repairing it at read time in one consumer would leave every other consumer wrong.
 */
export function cleanCitationText(raw: string): string | null {
  let s = raw
    // XML attributes and the tag remnants around them, which is the dominant shape.
    .replace(/\b[A-Za-z:]+="[^"]*"/g, ' ')
    .replace(/<[^>]*>/g, ' ')
    .replace(/[<>]/g, ' ')
    // A bare URI left behind by the above is not the source's words either.
    .replace(/https?:\/\/\S+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
  // Leading structural crumbs: "1 1 This Order…", "body 3 …"
  s = s.replace(/^(?:\d+\s+)+/, '').trim()
  // ⚠ A FLOOR, because a handful of words is not evidence of anything. Below this the row
  // still exists and is still counted — it just cannot be quoted at the user.
  return s.length >= 40 ? s : null
}

/**
 * What a reference DOES, decided from its words.
 *
 * ⚠ §4: *"Group by what the reference does, not by which Act it sits in. 'Eleven of these
 * are the same borrowed definition' is useful; an alphabetical list of statutes is not."*
 *
 * ⚠ THESE ARE PATTERNS OVER STATUTORY LANGUAGE, NOT A CLASSIFICATION. The bucket says what
 * the words are doing; the DISPOSITION — what would have to happen if the target changed —
 * is the model's judgement and is made per group, downstream. Keeping them apart is what
 * lets the cheap step be deterministic and the expensive step be small.
 */
export type FunctionKind =
  | 'borrowed-definition'
  | 'commencement'
  | 'amendment'
  | 'conferred-power'
  | 'disapplication'
  | 'bare-reference'

const PATTERNS: Array<{ kind: FunctionKind; label: string; rx: RegExp }> = [
  {
    kind: 'borrowed-definition',
    label: 'borrows a definition from the target',
    rx: /within the meaning of|has the same meaning|meaning given (?:by|in)|as defined (?:in|by)|construed in accordance with/i,
  },
  {
    kind: 'commencement',
    label: 'brings the target into force, or is named after it',
    rx: /brings? into force|comes? into force|commencement|may be cited as/i,
  },
  {
    kind: 'amendment',
    label: 'amends or repeals part of the target',
    rx: /\bis amended\b|\bamendments?\b|\binsert\b|\bomit\b|\bsubstitute\b|\brepeals?\b|\brevoke/i,
  },
  {
    kind: 'conferred-power',
    label: 'exercises or relies on a power in the target',
    rx: /in exercise of the powers|conferred by|under section|by virtue of|pursuant to/i,
  },
  {
    kind: 'disapplication',
    label: 'disapplies, qualifies or overrides the target',
    rx: /does not apply|shall not apply|notwithstanding|subject to|except as provided/i,
  },
]

export interface ReferenceGroup {
  kind: FunctionKind
  /** What this group of references is doing, in plain words. */
  label: string
  /** Every member, so "open it to see the members" is a filter and not a second query. */
  members: InboundRow[]
  /**
   * ⚠ THE EXEMPLAR IS A CLEANED, REAL QUOTE FROM A MEMBER — the traceability §3 demands.
   * Null when no member's text survived cleaning, which is itself reported rather than
   * hidden behind a confident group label.
   */
  exemplar: { sourceGid: string; provision: string | null; words: string } | null
  /** How many members had no quotable words at all. Never dropped, always counted. */
  unquotable: number
}

export interface GroupedReferences {
  groups: ReferenceGroup[]
  /** ⚠ §4: "Showing N groups covering M references" — nothing hidden, no number dropped. */
  totalReferences: number
  totalGroups: number
  /** Rows whose reference sits in a title or note rather than a provision. Separate (§7). */
  titleOnly: number
  /** Across all groups. Surfaced so a panel can say the evidence is thinner than the count. */
  unquotable: number
}

export function groupReferences(rows: InboundRow[], titleOnly: number): GroupedReferences {
  const buckets = new Map<FunctionKind, InboundRow[]>()
  for (const r of rows) {
    const cleaned = cleanCitationText(r.citationText)
    // ⚠ MATCH ON THE CLEANED TEXT. Matching the raw string would let an XML attribute
    // containing the word "commencement" decide the bucket for a row whose actual words say
    // something else — a classification driven by markup rather than by law.
    const hay = cleaned ?? ''
    const hit = PATTERNS.find((p) => p.rx.test(hay))
    const kind: FunctionKind = hit?.kind ?? 'bare-reference'
    const list = buckets.get(kind) ?? []
    list.push(r)
    buckets.set(kind, list)
  }

  const groups: ReferenceGroup[] = []
  for (const [kind, members] of buckets) {
    const label = PATTERNS.find((p) => p.kind === kind)?.label
      ?? 'mentions the target without acting on it'
    let exemplar: ReferenceGroup['exemplar'] = null
    let unquotable = 0
    for (const m of members) {
      const c = cleanCitationText(m.citationText)
      if (!c) { unquotable++; continue }
      // Prefer the first quotable member; a longer one is not necessarily clearer.
      if (!exemplar) {
        exemplar = { sourceGid: m.sourceGid, provision: m.sourceProvisionRef, words: c.slice(0, 300) }
      }
    }
    groups.push({ kind, label, members, exemplar, unquotable })
  }

  // Largest first — the biggest block of work is the one a user needs to see.
  groups.sort((a, b) => b.members.length - a.members.length)

  return {
    groups,
    totalReferences: rows.length,
    totalGroups: groups.length,
    titleOnly,
    unquotable: groups.reduce((n, g) => n + g.unquotable, 0),
  }
}

/**
 * ⚠ §4's sentence, composed — "Showing 14 groups covering 1,868 references".
 *
 * It names the tail explicitly, including the two numbers a summary would otherwise lose:
 * references that sit in a title rather than a provision, and references with no quotable
 * words. **Never summarise away the scale** (§7).
 */
export function describeScale(g: GroupedReferences): string {
  const bits = [
    `${g.totalGroups} ${g.totalGroups === 1 ? 'group' : 'groups'} covering `
    + `${g.totalReferences.toLocaleString()} ${g.totalReferences === 1 ? 'reference' : 'references'} `
    + 'inside provisions',
  ]
  if (g.titleOnly > 0) {
    bits.push(
      `${g.titleOnly.toLocaleString()} further ${g.titleOnly === 1 ? 'reference names' : 'references name'} `
      + 'the target in a title, long title or note rather than in a provision — real references, '
      + 'but not provisions that would break',
    )
  }
  if (g.unquotable > 0) {
    // ⚠ "OF THEM" WOULD BE AMBIGUOUS AND WAS, in the first draft: read in sequence it
    // attached to the title-only sentence immediately before it, so a reader would take the
    // unquotable rows to be a subset of the title-only ones. They are a subset of the
    // provision-level references — the ones the work is actually counted from.
    bits.push(
      `${g.unquotable.toLocaleString()} of the ${g.totalReferences.toLocaleString()} have no quotable `
      + 'words in our extract, so they are counted but cannot be shown',
    )
  }
  return bits.join('. ') + '.'
}

// ─────────────────────────────────────────────────────────────────────────────
// CLASSIFICATION — what would have to happen to each group if the target changed.
// ─────────────────────────────────────────────────────────────────────────────

export interface ClassifiedGroup extends ReferenceGroup {
  disposition: Disposition
  /** One line, in the user's terms, saying why. */
  reason: string
  /**
   * ⚠⚠ THE WORDS THAT PRODUCED THE DISPOSITION, carried beside it.
   *
   * §3: *"Every disposition is traceable to the `citation_text` that produced it. A
   * disposition with no visible source words is Lex putting confident prose on top of a
   * verified fact and destroying its verifiability — which is the one thing this graph
   * exists to prevent."*
   *
   * It is the group's own exemplar, copied here so nothing downstream can render a
   * disposition without having the quote in the same object. A renderer that has to go and
   * fetch the evidence is a renderer that will one day ship without it.
   */
  evidence: { sourceGid: string; provision: string | null; words: string } | null
}

const SCHEMA = {
  type: 'object',
  properties: {
    groups: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          kind: { type: 'string' },
          disposition: { type: 'string', enum: Object.keys(DISPOSITIONS) },
          reason: { type: 'string' },
        },
        required: ['kind', 'disposition', 'reason'],
      },
    },
  },
  required: ['groups'],
} as const

const SYSTEM = [
  'You are advising a non-lawyer who wants to change an existing Act of Parliament.',
  'You are given GROUPS of references to that Act from elsewhere in the statute book.',
  'Each group is a set of references that do the same kind of thing, with one real quotation.',
  '',
  'For each group say what would have to happen to those provisions if the target changed:',
  ...Object.entries(DISPOSITIONS).map(([k, v]) => `  ${k} — ${v}`),
  '',
  '⚠ ONE SHORT REASON PER GROUP, in plain words, referring to what the quoted words do.',
  '⚠ DO NOT ASSERT ANYTHING THE QUOTATION DOES NOT SUPPORT. You are reading a reference,',
  'not the whole provision. If the words do not tell you enough to be sure, say so in the',
  'reason and choose the disposition that assumes the least — that is usually no_action or',
  'amend, never repeal.',
  '⚠ DO NOT SAY EVERY REFERENCE NEEDS AMENDING. That is the specific error this exists to',
  'prevent: some become dead letters, some need a substitute reference, some must be',
  'expressly saved, and many are untouched.',
].join('\n')

/**
 * Classify the groups. ONE call, whatever the size of the target.
 *
 * ⚠ THE MODEL NEVER SEES THE 1,868 ROWS. It sees a handful of group descriptions with one
 * quotation each. That is the whole cost argument for this pass, and it is also why the
 * classification is honest about its own limits: a disposition here is a judgement about a
 * KIND of reference, not a legal opinion on each provision, and the reason has to read that
 * way.
 *
 * ⚠ A FAILED CALL RETURNS THE GROUPS UNCLASSIFIED RATHER THAN GUESSING. `no_action` as a
 * fallback would be a silent claim that nothing breaks, which is the most dangerous of the
 * five to assert without grounds.
 */
export async function classifyGroups(
  target: string,
  g: GroupedReferences,
  ctx?: { ideaId?: string; userId?: string },
): Promise<{
  groups: ClassifiedGroup[]; classified: boolean; note: string | null
  /** ⚠ What this run actually cost, priced — see the `recordSpend` call below. */
  spend: { tokensIn: number; tokensOut: number; pence: number } | null
}> {
  if (!g.groups.length) {
    return { groups: [], classified: false, note: 'No references to classify.', spend: null }
  }

  const user = [
    `THE TARGET THE USER WANTS TO CHANGE: ${target}`,
    '',
    'THE GROUPS:',
    ...g.groups.map((grp) => [
      `- kind: ${grp.kind}`,
      `  what these references do: ${grp.label}`,
      `  how many: ${grp.members.length}`,
      grp.exemplar
        ? `  one of them, quoted: "${grp.exemplar.words}"`
        : '  ⚠ no quotable words survived extraction for this group',
    ].join('\n')),
  ].join('\n')

  const res = await callJson<{ groups?: Array<{ kind?: unknown; disposition?: unknown; reason?: unknown }> }>({
    model: modelFor('deepening.consequences'),
    system: SYSTEM,
    user,
    schema: SCHEMA,
    maxOutputTokens: 2000,
    timeoutMs: 90_000,
    temperature: 0.1,
    label: `consequences:${target}`,
  })

  // ⚠ RECORDED WHETHER IT SUCCEEDED OR NOT. A failed call is still billed, and a ledger that
  // only counts successes under-reports what the platform spends — which is the number
  // pricing decisions get made on.
  const priced = await recordSpend({
    stream: 'deepening',
    pass: 'deepening.consequences',
    model: res.usage.model,
    tokensIn: res.usage.tokensIn,
    // ⚠ NO `tokensThinking` HERE ON PURPOSE. `LlmUsage.tokensOut` already folds thinking
    // tokens in (see `model-call.ts`), so passing them again would double-count the most
    // expensive half of the bill on any model where thinking is on.
    tokensOut: res.usage.tokensOut,
    ideaId: ctx?.ideaId ?? null,
    userId: ctx?.userId ?? null,
    ref: target,
    failed: !llmOk(res),
  }).catch(() => null)
  const spend = {
    tokensIn: res.usage.tokensIn,
    tokensOut: res.usage.tokensOut,
    pence: priced?.pence ?? 0,
  }

  if (!llmOk(res)) {
    return {
      groups: g.groups.map((grp) => ({
        ...grp, disposition: 'no_action', reason: '', evidence: grp.exemplar,
      })),
      classified: false,
      note: `The references were found and grouped, but reading them for consequences did not complete (${res.reason}). The groups and counts below are the graph's; the dispositions are not filled in.`,
      spend,
    }
  }

  const byKind = new Map<string, { disposition: Disposition; reason: string }>()
  for (const r of res.value.groups ?? []) {
    const kind = typeof r.kind === 'string' ? r.kind : ''
    const d = typeof r.disposition === 'string' ? r.disposition : ''
    // ⚠ THE ENUM IS ENFORCED HERE, NOT TRUSTED FROM THE SCHEMA. A JSON schema is a REQUEST:
    // a model that returns "amend/replace" or "unclear" would otherwise flow through into a
    // disposition the UI has no rendering for.
    if (!kind || !(d in DISPOSITIONS)) continue
    byKind.set(kind, {
      disposition: d as Disposition,
      reason: typeof r.reason === 'string' ? r.reason.trim() : '',
    })
  }

  let missing = 0
  const groups: ClassifiedGroup[] = g.groups.map((grp) => {
    const got = byKind.get(grp.kind)
    if (!got) missing++
    return {
      ...grp,
      disposition: got?.disposition ?? 'no_action',
      // ⚠ AN UNCLASSIFIED GROUP SAYS SO rather than borrowing the neighbouring reason.
      reason: got?.reason ?? 'Not classified — the reading pass did not return a disposition for this group.',
      evidence: grp.exemplar,
    }
  })

  return {
    groups,
    classified: missing === 0,
    spend,
    note: missing > 0
      ? `${missing} of ${g.groups.length} groups came back without a disposition and are shown unclassified.`
      : null,
  }
}
