// ─────────────────────────────────────────────────────────────────────────────
// LEX 26-X X2 (decision 309, BRIEF_26X §5d) — THE BRIEF ON EVERY DRAFT, its PURE half: the shape, the fields per kind, the defensive reader,
// the checks, the printed text and the block the drafter reads. CLIENT-SAFE (imports only pure modules and the label tables; CLAUDE.md §28).
//
//   Common fields, every kind: What this draft must do (free text, counter) · Modelled on ([Ref: n] or a corpus section, or none) ·
//     Tone and form (statutory · code · guidance · specification · plain rules) · Must include (numbered points) · Must not (numbered points)
//   Per kind: code text — issued by, laid before, applies to, revision rule; specification — users, records, measures; costing — basis,
//     price year; operating text and background note — the common fields only.
//   ⚠ A DRAFT CLAUSE's per-kind fields are the 26-U drafting instruction, READ IN PLACE on the clause's own versions (Charlie, 7 Nov:
//     "read in place"). Nothing of the instruction is copied into the Brief, so there is one store, not two.
//
// STORED as `action_document_version` rows of role BRIEF (every save a version) and BRIEF_PROPOSAL (Lex's prefill, beside), on the action's
// draft document (prisma/lex_26x_brief.sql). A draft version records the Brief version it was drafted from as `payload.briefV`.
// ─────────────────────────────────────────────────────────────────────────────

import type { DocumentKind } from './action-documents-pure'
import { BRIEF_FIELD_WORD, TONE_WORD, BRIEF_UI } from './screen-labels'
import { LIMITS } from './input-limits'

/** The kinds that are a draft and so carry a Brief. Companions (collision report, explanatory note, schedule) are made BESIDE a draft. */
export const BRIEF_KINDS = ['DRAFT_CLAUSE', 'CODE_TEXT', 'SPECIFICATION', 'COSTING', 'OPERATING_TEXT', 'BACKGROUND_NOTE'] as const
export type BriefKind = (typeof BRIEF_KINDS)[number]
export const isBriefKind = (k: unknown): k is BriefKind => typeof k === 'string' && (BRIEF_KINDS as readonly string[]).includes(k)

export const TONES = ['statutory', 'code', 'guidance', 'specification', 'plain-rules'] as const
export type Tone = (typeof TONES)[number]
export const isTone = (t: unknown): t is Tone => typeof t === 'string' && (TONES as readonly string[]).includes(t)

export type KindFieldKey = 'issuedBy' | 'laidBefore' | 'appliesTo' | 'revisionRule' | 'users' | 'records' | 'measures' | 'basis' | 'priceYear'
/** §5d — each kind's own fields, in the order the form shows them. */
export const KIND_FIELDS: Record<BriefKind, readonly KindFieldKey[]> = {
  DRAFT_CLAUSE: [], // the drafting instruction is its per-kind block, read in place
  CODE_TEXT: ['issuedBy', 'laidBefore', 'appliesTo', 'revisionRule'],
  SPECIFICATION: ['users', 'records', 'measures'],
  COSTING: ['basis', 'priceYear'],
  OPERATING_TEXT: [],
  BACKGROUND_NOTE: [],
}

export type ModelledOn = { ref: number } | { corpusId: string } | null

export interface Brief {
  must: string
  modelledOn: ModelledOn
  tone: Tone | null
  mustInclude: string[]
  mustNot: string[]
  /** This kind's own fields (KIND_FIELDS); a key the kind does not have is dropped by parseBrief. */
  kind: Partial<Record<KindFieldKey, string>>
}

export const EMPTY_BRIEF: Brief = { must: '', modelledOn: null, tone: null, mustInclude: [], mustNot: [], kind: {} }

const s = (v: unknown, max: number) => (typeof v === 'string' ? v.replace(/\r\n/g, '\n').trim().slice(0, max) : '')
const points = (v: unknown) => (Array.isArray(v) ? v : []).map((p) => s(p, LIMITS.briefPoint)).filter(Boolean).slice(0, LIMITS.briefPoints)

/** The one defensive reader of a stored Brief (a BRIEF or BRIEF_PROPOSAL row's payload). Unknown keys are dropped. Pure. */
export function parseBrief(kind: BriefKind, payload: unknown): Brief {
  const p = (payload && typeof payload === 'object' ? payload : {}) as Record<string, unknown>
  const m = p.modelledOn as Record<string, unknown> | null | undefined
  const modelledOn: ModelledOn = m && typeof m === 'object'
    ? (Number.isInteger(m.ref) && (m.ref as number) > 0 ? { ref: m.ref as number } : typeof m.corpusId === 'string' && m.corpusId.trim() ? { corpusId: s(m.corpusId, LIMITS.briefCorpusId) } : null)
    : null
  const k = (p.kind && typeof p.kind === 'object' ? p.kind : {}) as Record<string, unknown>
  return {
    must: s(p.must, LIMITS.briefMust), modelledOn, tone: isTone(p.tone) ? p.tone : null,
    mustInclude: points(p.mustInclude), mustNot: points(p.mustNot),
    kind: Object.fromEntries(KIND_FIELDS[kind].map((f) => [f, s(k[f], LIMITS.briefField)]).filter(([, v]) => v)) as Brief['kind'],
  }
}

/** Nothing written in any field. Pure. */
export const isEmptyBrief = (b: Brief): boolean =>
  !b.must.trim() && !b.modelledOn && !b.tone && !b.mustInclude.length && !b.mustNot.length && !Object.values(b.kind).some((v) => v?.trim())

/**
 * What is wrong with a Brief before it is saved, in words, each naming the field the person knows (§30). A Brief may be partial — any one
 * field written is a Brief — but it may not be empty, and a field over its limit is refused rather than cut. Pure.
 */
export function briefProblems(kind: BriefKind, raw: { must?: unknown; mustInclude?: unknown; mustNot?: unknown; kind?: unknown; modelledOn?: unknown; tone?: unknown }): string[] {
  const out: string[] = []
  const over = (label: string, v: unknown, max: number) => { if (typeof v === 'string' && v.trim().length > max) out.push(`“${label}” is ${v.trim().length.toLocaleString('en-GB')} characters; the limit is ${max.toLocaleString('en-GB')}`) }
  over(BRIEF_FIELD_WORD.must, raw.must, LIMITS.briefMust)
  for (const [key, list] of [['mustInclude', raw.mustInclude], ['mustNot', raw.mustNot]] as const) {
    const xs = Array.isArray(list) ? list : []
    if (xs.length > LIMITS.briefPoints) out.push(`“${BRIEF_FIELD_WORD[key]}” has ${xs.length} points; the limit is ${LIMITS.briefPoints}`)
    xs.forEach((x, i) => over(`${BRIEF_FIELD_WORD[key]}, point ${i + 1}`, x, LIMITS.briefPoint))
  }
  const k = (raw.kind && typeof raw.kind === 'object' ? raw.kind : {}) as Record<string, unknown>
  for (const f of Object.keys(k)) {
    if (!(KIND_FIELDS[kind] as readonly string[]).includes(f)) { out.push(`“${f}” is not a field of a ${KIND_SAY[kind]}’s Brief`); continue }
    over(BRIEF_FIELD_WORD[f as KindFieldKey], k[f], LIMITS.briefField)
  }
  if (raw.tone != null && raw.tone !== '' && !isTone(raw.tone)) out.push(`“${BRIEF_FIELD_WORD.tone}” must be one of: ${TONES.map((t) => TONE_WORD[t]).join(', ')}`)
  const m = raw.modelledOn as Record<string, unknown> | null | undefined
  if (m && typeof m === 'object' && m.ref != null && !(Number.isInteger(m.ref) && (m.ref as number) > 0)) out.push(`“${BRIEF_FIELD_WORD.modelledOn}” must be a source number, as in [Ref: 12]`)
  if (m && typeof m === 'object') over(BRIEF_FIELD_WORD.modelledOn, m.corpusId, LIMITS.briefCorpusId)
  if (!out.length && isEmptyBrief(parseBrief(kind, raw))) out.push('the Brief is empty — write at least one field')
  return out
}

const KIND_SAY: Record<BriefKind, string> = {
  DRAFT_CLAUSE: 'draft clause', CODE_TEXT: 'code text', SPECIFICATION: 'specification', COSTING: 'costing', OPERATING_TEXT: 'operating text', BACKGROUND_NOTE: 'background note',
}

export const modelledOnWords = (m: ModelledOn): string => (!m ? 'none' : 'ref' in m ? `[Ref: ${m.ref}]` : `the corpus section ${m.corpusId}`)

/** The Brief as text: the stored row's body, the printed form, and what the screen shows when it is closed. Pure. */
export function briefBody(kind: BriefKind, b: Brief): string {
  const lines: string[] = []
  if (b.must.trim()) lines.push(`## ${BRIEF_FIELD_WORD.must}`, b.must.trim(), '')
  lines.push(`${BRIEF_FIELD_WORD.modelledOn}: ${modelledOnWords(b.modelledOn)}`, `${BRIEF_FIELD_WORD.tone}: ${b.tone ? TONE_WORD[b.tone] : 'not said'}`)
  for (const f of KIND_FIELDS[kind]) if (b.kind[f]?.trim()) lines.push(`${BRIEF_FIELD_WORD[f]}: ${b.kind[f]!.trim()}`)
  for (const key of ['mustInclude', 'mustNot'] as const) {
    if (!b[key].length) continue
    lines.push('', `## ${BRIEF_FIELD_WORD[key]}`, ...b[key].map((p, i) => `${i + 1}. ${p}`))
  }
  return lines.join('\n').trim()
}

/**
 * The block the drafter reads FIRST (§5d: "the drafter reads the Brief first, then Action details"). It names the version, so the draft can
 * say which it followed. ⚠ It describes what to do with each field and supplies no specimen of any (CLAUDE.md §27). Pure.
 */
export function briefPromptBlock(kind: BriefKind, b: Brief, v: number): string {
  return [
    `THE BRIEF (version ${v}) — the owner’s instructions for this draft. Read it before the Action details and follow it within the rules above:`,
    '- Carry out every point under "Must include"; say in gaps any point you could not carry out, and why.',
    '- Nothing listed under "Must not" may appear in the draft.',
    '- "Modelled on", where given, is the form to follow; take its form, never its duties.',
    '- Where the Brief and the Action details differ, the Brief decides; say so in reason.',
    `<brief>\n${briefBody(kind, b)}\n</brief>`,
  ].join('\n')
}

/** "Brief changed since this draft" (§5d): a Brief saved after the version the draft was drafted from, or a draft written before any Brief. */
export function briefChanged(draftedFromV: number | null, latestBriefV: number | null, hasDraft: boolean): boolean {
  if (!hasDraft || latestBriefV == null) return false
  return draftedFromV == null || draftedFromV < latestBriefV
}

/** The words under a draft that name its Brief: "drafted from Brief version 2", or "Brief changed since this draft". */
export function draftedFromWords(draftedFromV: number | null, latestBriefV: number | null, hasDraft: boolean): string | null {
  if (!hasDraft || latestBriefV == null) return null
  if (briefChanged(draftedFromV, latestBriefV, hasDraft)) return `${BRIEF_UI.briefChanged}${draftedFromV != null ? ` (it was drafted from version ${draftedFromV}; the Brief is at version ${latestBriefV})` : ' (it was written before the Brief)'}`
  return BRIEF_UI.draftedFrom.replace(/\bN\b/, String(draftedFromV))
}

/** The kind of document an action's Brief is for: its draft, never a companion (313). Null when nothing is derived yet. */
export function briefKindOf(draftKinds: readonly DocumentKind[]): BriefKind | null {
  return draftKinds.find(isBriefKind) ?? null
}

// ── Lex's prefill: the MEASURED price (§5d: "free or a few pence, measured"), one entry per real run on a scratch copy ──────────────
// 7 Nov 2026 (UTC), claude-sonnet-5-5 at effort low, scripts/measure-26x-brief.ts on scratch copies of 452c5ade (write:false). Two further
// runs that day failed before any model call (a TLS fault on the network path, SELF_SIGNED_CERT_IN_CHAIN) and cost nothing; not counted.
export const PREFILL_RUNS: Array<{ pence: number; seconds: number; on: string }> = [
  { pence: 0.83, seconds: 6, on: 'scratch copy of 452c5ade, 2026-11-07 (#101, operating text, 1,996 chars of details)' },
  { pence: 2.83, seconds: 15.5, on: 'scratch copy of 452c5ade, 2026-11-07 (#207, code text, 17,946 chars of details)' },
  { pence: 1.64, seconds: 5.9, on: 'scratch copy of 452c5ade, 2026-11-07 (#38, draft clause, 14,872 chars of details)' },
  { pence: 0.85, seconds: 5.1, on: 'scratch copy of 452c5ade, 2026-11-07 (#101 again)' },
]
export function prefillPrice(): { pence: number | null; n: number } {
  if (!PREFILL_RUNS.length) return { pence: null, n: 0 }
  return { pence: Math.round((PREFILL_RUNS.reduce((a, r) => a + r.pence, 0) / PREFILL_RUNS.length) * 10) / 10, n: PREFILL_RUNS.length }
}
