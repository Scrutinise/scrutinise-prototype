// ─────────────────────────────────────────────────────────────────────────────
// LEX 26-V2c (268, 24 Oct (4, revised)) — LEX PROPOSES A KIND FOR EACH EXISTING HEADING. PURE; CLIENT-SAFE (imports only pure modules).
//
// The owner sets a heading's kind on the heading row; for headings that have none, Lex proposes one with a reason, and the owner accepts it
// or says "not this". A proposal never sets the kind (§0: every result a proposal). Rules bind to the kind, never to the name.
// ⚠ §27: the instructions describe what each kind MEANS; they carry no specimen heading, action or sentence to lift.
// ─────────────────────────────────────────────────────────────────────────────

import { HEADING_KINDS, HEADING_KIND_WORD, isHeadingKind, type HeadingKind } from './action-documents-pure'

/** What each kind means, as Lex is told it and as the heading row's hint shows it. */
export const HEADING_KIND_MEANS: Record<HeadingKind, string> = {
  PRIMARY_LEGISLATION: 'its actions are made by an Act of Parliament: new duties or powers, or changes to existing Acts',
  CODE: 'its actions are a code with a footing in law, issued under an Act, which those it covers must have regard to or follow',
  MANAGEMENT_CODE: 'its actions are internal rules an employer or department issues to its own staff, without a separate Act',
  PLATFORM: 'its actions build or run a system: software, a register, a shared record or data service (each needs a specification)',
  BUDGET: 'its actions are about money: funding, budgets, spending controls, prices or financial standards',
  TRANSPARENCY: 'its actions publish, report, or open work to scrutiny by others',
  GUIDANCE_PILOT: 'its actions are guidance, training, a pilot or a trial, with no binding force of their own',
  OTHER: 'none of the above fits; say why in the reason',
}

export const KIND_PROPOSAL_SYSTEM = [
  'You are Lex. Each heading below groups some of a policy proposal’s coherent actions. Propose the ONE kind of instrument that best describes',
  'what the heading’s actions make, from this list only:',
  ...HEADING_KINDS.map((k) => `- ${k} (${HEADING_KIND_WORD[k]}): ${HEADING_KIND_MEANS[k]}.`),
  'Judge by the actions listed under the heading, and by its purpose where one is written; the heading’s name is a label the owner chose and',
  'may be loose. Where the actions are mixed, choose the kind that most of them share and say what does not fit. Give a reason of one or two',
  'sentences that names what in the actions decided it. Answer for every heading given, by its number. Never carry over an example, a subject',
  'or a phrase from these instructions or from any other proposal.',
].join('\n')

export const KIND_PROPOSAL_SCHEMA = {
  type: 'object', additionalProperties: false, required: ['headings'],
  properties: {
    headings: {
      type: 'array',
      items: {
        type: 'object', additionalProperties: false, required: ['n', 'kind', 'reason'],
        properties: { n: { type: 'integer' }, kind: { type: 'string', enum: [...HEADING_KINDS] }, reason: { type: 'string' } },
      },
    },
  },
} as const

export interface KindProposalAnswer { headings: Array<{ n: number; kind: string; reason: string }> }
export interface KindHeadingInput { n: number; id: string; name: string; purpose: string | null; actions: string[]; more: number }

/** The user message: each heading numbered, with its purpose and (at most) its first ACTIONS_PER_HEADING actions. */
export const ACTIONS_PER_HEADING = 15
export function kindProposalUser(heads: KindHeadingInput[], policy: string | null): string {
  return [
    `THE GUIDING POLICY:\n${(policy ?? '(not settled)').slice(0, 2000)}`,
    ...heads.map((h) => [
      `<heading n="${h.n}">\nName: ${h.name}${h.purpose ? `\nPurpose: ${h.purpose.slice(0, 800)}` : ''}`,
      h.actions.length ? `Actions:\n${h.actions.map((a) => `- ${a}`).join('\n')}${h.more ? `\n(and ${h.more} more)` : ''}` : 'Actions: none yet.',
      '</heading>',
    ].join('\n')),
  ].join('\n\n')
}

/** Keeps only answers for headings that were asked about, with a known kind; says what it dropped. */
export function acceptedProposals(heads: KindHeadingInput[], ans: KindProposalAnswer): { kept: Array<{ id: string; kind: HeadingKind; reason: string }>; dropped: string[] } {
  const kept: Array<{ id: string; kind: HeadingKind; reason: string }> = []
  const dropped: string[] = []
  const seen = new Set<number>()
  for (const a of ans.headings ?? []) {
    const h = heads.find((x) => x.n === a.n)
    if (!h) { dropped.push(`an answer for heading ${a.n}, which was not asked about`); continue }
    if (seen.has(a.n)) { dropped.push(`a second answer for “${h.name}”`); continue }
    if (!isHeadingKind(a.kind)) { dropped.push(`“${h.name}”: “${String(a.kind).slice(0, 30)}” is not one of the kinds`); continue }
    seen.add(a.n)
    kept.push({ id: h.id, kind: a.kind, reason: String(a.reason ?? '').replace(/\s+/g, ' ').trim().slice(0, 600) })
  }
  for (const h of heads) if (!seen.has(h.n) && !dropped.some((d) => d.includes(`“${h.name}”`))) dropped.push(`“${h.name}”: no answer came back`)
  return { kept, dropped }
}

/**
 * MEASURED price of "Propose kinds" for a set of headings, one entry per real run on a scratch copy of a real idea (§23.2: n is the count).
 * Empty = not measured, and the button is not offered with a price it does not have.
 */
export const KIND_PROPOSAL_RUNS: Array<{ headings: number; pence: number }> = [
  // 24 Oct, scripts/measure-26v2c.ts on 452c5ade's 7 headings (63 numbered actions), Sonnet effort low: 7s and 5.3s
  { headings: 7, pence: 0.98 },
  { headings: 7, pence: 0.97 },
]
export function kindProposalPrice(): { pence: number | null; n: number } {
  if (!KIND_PROPOSAL_RUNS.length) return { pence: null, n: 0 }
  const per = KIND_PROPOSAL_RUNS.reduce((a, r) => a + r.pence, 0) / KIND_PROPOSAL_RUNS.length
  return { pence: Math.round(per * 10) / 10, n: KIND_PROPOSAL_RUNS.length }
}
