// ─────────────────────────────────────────────────────────────────────────────
// 26-S2 §5 (decision 177) — THE ACTION RECORD: the seven slots of step 2, "Who, how and against". PURE; CLIENT-SAFE (imports nothing).
//
//   Who · Incentive now · What changes it · Skill · How · Against · What tells us it worked
//
// ⚠ STORAGE (CCh's sign-off, 17 Oct): Who STAYS in `LexCoherentAction.whoImplements` (64 rows unchanged); the other six live in ONE additive
// JSON, `record`, each slot `{ text, by, at, proposal? }`. `by` + `at` are the per-field PROVENANCE the database never had (B2 of the field-
// mapping report) — from now on a slot says who wrote it and when. `record.who` carries the same for Who (its text stays in the column).
// ⚠ A PROPOSAL SITS BESIDE the answer; accepting copies it; NOTHING A USER WROTE IS OVERWRITTEN by one (accepting onto a user-written
// answer needs the user's explicit "replace").
// ⚠ Impl / Enforce / Friction are COST columns (decision 179) and are not these slots.
// ─────────────────────────────────────────────────────────────────────────────

export const SLOT_KEYS = ['incentiveNow', 'whatChangesIt', 'skill', 'how', 'against', 'worked'] as const
export type SlotKey = (typeof SLOT_KEYS)[number]
/** Who is a slot of the screen but a COLUMN in the database. */
export type AnySlot = 'who' | SlotKey
export const ALL_SLOTS: readonly AnySlot[] = ['who', ...SLOT_KEYS]

export const SLOT_UI: Record<AnySlot, { label: string; asks: string; placeholder: string }> = {
  who: { label: 'Who', asks: 'Who implements it — a body or a role — and whether it sits inside or outside government.', placeholder: 'e.g. The Cabinet Office (inside government)' },
  incentiveNow: { label: 'Incentive now', asks: 'Does the implementer’s present incentive pull with this action, against it, or neither — and why?', placeholder: 'Why their present incentive pulls with it, against it, or neither' },
  whatChangesIt: { label: 'What changes it', asks: 'What in this proposal changes that incentive — usually another action. Link it where it is one.', placeholder: 'What in the proposal changes their incentive' },
  skill: { label: 'Skill', asks: 'Why they would have the skill to do it.', placeholder: 'Why they would have the skill' },
  how: { label: 'How', asks: 'How it is enforced, by whom, with what consequence.', placeholder: 'How it is enforced, by whom, with what consequence' },
  against: { label: 'Against', asks: 'What will oppose it — strikes, gaming, legal challenge, delay — and the counter to each.', placeholder: 'What will oppose it, and the counter to each' },
  worked: { label: 'What tells us it worked', asks: 'The measure: what we would see if it worked.', placeholder: 'The measure that would tell us it worked' },
}

export const DIRECTIONS = ['WITH', 'AGAINST', 'INDIFFERENT'] as const
export type Direction = (typeof DIRECTIONS)[number]
/** A word AND a shape (never colour alone — CLAUDE.md §21). */
export const DIRECTION_UI: Record<Direction, { glyph: string; word: string }> = {
  WITH: { glyph: '✓', word: 'With' },
  AGAINST: { glyph: '✗', word: 'Against' },
  INDIFFERENT: { glyph: '○', word: 'Indifferent' },
}

/** Lex's proposal for one slot, kept BESIDE the answer. `source` is a [Ref: n] number of a source on the idea, only where Lex used one. */
export interface SlotProposal { text: string; reason: string; source: number | null; at: string; direction?: Direction | null; linkNumber?: number | null }
export interface RecordSlot { text: string; by: 'USER' | 'LEX'; at: string; direction?: Direction | null; linkActionId?: string | null; proposal?: SlotProposal }
export interface WhoMeta { by: 'USER' | 'LEX'; at: string; proposal?: SlotProposal }
export interface ActionRecord { who?: WhoMeta; incentiveNow?: RecordSlot; whatChangesIt?: RecordSlot; skill?: RecordSlot; how?: RecordSlot; against?: RecordSlot; worked?: RecordSlot }

const isObj = (v: unknown): v is Record<string, unknown> => !!v && typeof v === 'object' && !Array.isArray(v)
const str = (v: unknown, n = 4000): string => (typeof v === 'string' ? v.trim().slice(0, n) : '')
const by = (v: unknown): 'USER' | 'LEX' => (v === 'LEX' ? 'LEX' : 'USER')
const dir = (v: unknown): Direction | null => ((DIRECTIONS as readonly string[]).includes(v as string) ? (v as Direction) : null)

function parseProposal(v: unknown): SlotProposal | undefined {
  if (!isObj(v)) return undefined
  const text = str(v.text)
  if (!text) return undefined
  return {
    text, reason: str(v.reason, 400), at: str(v.at, 40), source: typeof v.source === 'number' && Number.isInteger(v.source) && v.source > 0 ? v.source : null,
    direction: dir(v.direction), linkNumber: typeof v.linkNumber === 'number' && Number.isInteger(v.linkNumber) ? v.linkNumber : null,
  }
}

/** Read the stored JSON defensively: anything malformed reads as "not answered", never as a crash. */
export function parseRecord(json: unknown): ActionRecord {
  const out: ActionRecord = {}
  if (!isObj(json)) return out
  if (isObj(json.who)) out.who = { by: by(json.who.by), at: str(json.who.at, 40), proposal: parseProposal(json.who.proposal) }
  for (const k of SLOT_KEYS) {
    const s = json[k]
    if (!isObj(s)) continue
    const text = str(s.text)
    const proposal = parseProposal(s.proposal)
    if (!text && !proposal) continue
    out[k] = { text, by: by(s.by), at: str(s.at, 40), direction: dir(s.direction), linkActionId: typeof s.linkActionId === 'string' ? s.linkActionId : null, ...(proposal ? { proposal } : {}) }
  }
  return out
}

type RecordLike = { record?: unknown; whoImplements?: string | null }

/** The answer for a slot (Who from its column), or '' when it is not answered. A proposal is NOT an answer. */
export function slotText(a: RecordLike, key: AnySlot): string {
  if (key === 'who') return a.whoImplements?.trim() ?? ''
  return parseRecord(a.record)[key]?.text ?? ''
}
export const slotAnswered = (a: RecordLike, key: AnySlot): boolean => slotText(a, key).length > 0

/** Who wrote the answer, and when — null where it was never recorded (every Who written before 18 Oct; the build and the import write it without a record). */
export function slotWriter(a: RecordLike, key: AnySlot): { by: 'USER' | 'LEX'; at: string } | null {
  const r = parseRecord(a.record)
  const s = key === 'who' ? r.who : r[key]
  if (!s || !s.at) return null
  return { by: s.by, at: s.at }
}
export function slotProposal(a: RecordLike, key: AnySlot): SlotProposal | undefined {
  const r = parseRecord(a.record)
  return (key === 'who' ? r.who?.proposal : r[key]?.proposal)
}
/** How many of the seven are answered (a number, for the row tag and the checklist). */
export const answeredCount = (a: RecordLike): number => ALL_SLOTS.filter((k) => slotAnswered(a, k)).length
export const proposalCount = (a: RecordLike): number => ALL_SLOTS.filter((k) => !!slotProposal(a, k)).length

// ── "specific enough" — computed HERE and shown in step 2 only (BRIEF_26S2 §5) ────────────────────────────────────────────────────
//
//   legislative: draft text present · organisational / financial (and an action with no avenue yet): Who AND Against answered.
// ⚠ This FLIPS the 64 actions that read "specific enough" on 17 Oct (they had a Who and nothing else) to "not yet specific — Against
// unanswered" until Against is answered (CCh signed this off, decision 177c). No data changes — the tag changes.

type SpecificLike = RecordLike & { avenue?: string | null; wording?: string | null }

/** What is missing for the action to be specific enough, in the words the tag uses. Empty = specific enough. */
export function missingForSpecific(a: SpecificLike): string[] {
  if (a.avenue === 'LEGISLATIVE') return a.wording?.trim() ? [] : ['draft text']
  const missing: string[] = []
  if (!slotAnswered(a, 'who')) missing.push('Who')
  if (!slotAnswered(a, 'against')) missing.push('Against')
  return missing
}
export const specificEnough = (a: SpecificLike): boolean => missingForSpecific(a).length === 0

/** The tag: "specific enough" / "not yet specific — Against unanswered" / "… — Who and Against unanswered" / "… — draft text missing". */
export function specificTag(a: SpecificLike): string {
  const m = missingForSpecific(a)
  if (!m.length) return 'specific enough'
  return a.avenue === 'LEGISLATIVE' ? 'not yet specific — draft text missing' : `not yet specific — ${m.join(' and ')} unanswered`
}

/** A dated, human line for the writer chip: "you, 18 Oct" / "Lex (accepted), 18 Oct" / "writer not recorded". */
export function writerWords(w: { by: 'USER' | 'LEX'; at: string } | null): string {
  if (!w) return 'writer not recorded'
  const d = w.at ? new Date(w.at) : null
  const when = d && !Number.isNaN(d.getTime()) ? d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', timeZone: 'UTC' }) : ''
  return `${w.by === 'USER' ? 'you' : 'Lex (accepted)'}${when ? `, ${when}` : ''}`
}

/**
 * MEASURED price of "Classify with Lex" in step 2, one entry per real run on a scratch copy of a real idea (CLAUDE.md §23.2: "n=" is the count).
 * The button's tooltip is computed from this; an empty list says only that the price is shown when the run finishes.
 */
export const SLOT_RUNS: Array<{ actions: number; pence: number; seconds: number; on: string }> = [
  // 18 Oct 2026, gemini-2.5-pro at medium effort, six actions a call: 18 actions, 3 calls, 19.34p, 207 s (n=1)
  { actions: 18, pence: 19.34, seconds: 207.1, on: 'a scratch copy of the service-standard idea (452c5ade), 18 Oct 2026' },
]
/** The price estimate for N actions from the measured runs (pence), or null while nothing is measured. */
export function slotPriceEstimate(actions: number): number | null {
  const a = SLOT_RUNS.reduce((n, r) => n + r.actions, 0)
  return a ? (SLOT_RUNS.reduce((n, r) => n + r.pence, 0) / a) * actions : null
}
/** Above this (pence) the screen asks before it spends. */
export const SLOT_CONFIRM_ABOVE_PENCE = 20
