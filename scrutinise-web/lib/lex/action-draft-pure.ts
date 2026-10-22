// ─────────────────────────────────────────────────────────────────────────────
// 26-U §3 (decisions 148, 228) — THE DRAFTING INSTRUCTION AND ITS ILLUSTRATIVE CLAUSE, ONE OBJECT. PURE; CLIENT-SAFE (imports nothing).
//
// Stored in the action's additive JSON `record` under `draft` (lib/lex/action-record.ts carries it through every slot write):
//   { versions: DraftVersion[], proposal?: DraftProposal }
// ⚠ VERSIONED: every save is a new version; the previous ones are kept, in order (decision 228).
// ⚠ THE CAVEAT CANNOT BE SEPARATED FROM THE CLAUSE (148): `withCaveat` puts it as the clause's first line on every write, and a clause that
//   arrives without it gets it. A clause is never stored without it.
// ⚠ LEX'S DRAFT IS A PROPOSAL BESIDE the user's own version; accepting makes it a new version; nothing the user wrote is overwritten.
// ─────────────────────────────────────────────────────────────────────────────

export const RELATIONS = ['amends', 'repeals', 'relies_on', 'constrains', 'modifies', 'precedent'] as const
export type Relation = (typeof RELATIONS)[number]
export const RELATION_WORD: Record<Relation, string> = {
  amends: 'amends', repeals: 'repeals', relies_on: 'relies on', constrains: 'is constrained by', modifies: 'modifies (without changing the words)', precedent: 'draws on, as precedent',
}

export const INSTRUMENTS = ['NEW_ACT', 'AMENDING_ACT', 'STATUTORY_CODE', 'STATUTORY_INSTRUMENT', 'MANAGEMENT_CODE', 'GUIDANCE'] as const
export type Instrument = (typeof INSTRUMENTS)[number]
export const INSTRUMENT_WORD: Record<Instrument, string> = {
  NEW_ACT: 'Act (new)', AMENDING_ACT: 'amendment to an existing Act', STATUTORY_CODE: 'statutory code', STATUTORY_INSTRUMENT: 'statutory instrument', MANAGEMENT_CODE: 'management code', GUIDANCE: 'guidance',
}
export const EXTENTS = ['England and Wales', 'Scotland', 'Northern Ireland', 'UK'] as const

/** The caveat, word for word (BRIEF_26U §3a). The clause's first line, always. */
export const CLAUSE_CAVEAT = 'Illustrative, not settled: drafted by Lex to the Parliamentary Counsel’s guidance from the instruction above; not Parliamentary Counsel’s text.'

/** One provision line: legislation.gov.uk form, no host — `ukpga/2010/25` + `section/5` (IDEA_LAW_JOIN_SPEC §1.1). */
export interface DraftProvision { docUri: string; provisionPath: string | null; relation: Relation; note: string }

export interface DraftInstruction {
  instrument: Instrument | null
  provisions: DraftProvision[]
  dutyOnWhom: string
  enforcedHow: string
  commencement: string
  extent: string[]
  /** Which precedent, and which provision of it, and how it was used ("adapted", "cited as the objection"). */
  precedents: Array<{ docUri: string; provisionPath: string | null; how: string }>
  /** Legislative: the illustrative clause, caveat first. Organisational / financial: empty (they get `plainWording`). */
  clause: string
  /** Organisational / financial actions: what is done, in plain English. */
  plainWording: string
  /** One line: why the instruction exists — the `note` of every join row it writes (§5). */
  purpose: string
  /** What Lex cited while drafting: corpus ids (OPC guidance parts, precedent sections). Empty for a user's own version. */
  citations: string[]
}

export interface DraftVersion extends DraftInstruction { v: number; by: 'USER' | 'LEX'; at: string }
export interface DraftProposal extends DraftInstruction { at: string; reason: string; pence: number | null }
export interface ActionDraft { versions: DraftVersion[]; proposal?: DraftProposal }

export const EMPTY_INSTRUCTION: DraftInstruction = {
  instrument: null, provisions: [], dutyOnWhom: '', enforcedHow: '', commencement: '', extent: [], precedents: [], clause: '', plainWording: '', purpose: '', citations: [],
}

// ── ids ───────────────────────────────────────────────────────────────────────────────────────────────────────
// legislation.gov.uk type/year/number; a Bill as `bill/<id>`; a non-statutory document as `doc/<corpus>/<doc id>` — the corpus's own
// document id, never a free slug (IDEA_LAW_JOIN_SPEC as amended; GRAPH 7's resolveLawTarget refuses anything else).
const DOC_URI = /^(?:(?:ukpga|uksi|asp|ssi|anaw|asc|nia|nisr|wsi|ukla|ukcm|apni|mwa|aep|aosp|aip|apgb|gbla|ukppa|eur|eudr|eudn)\/\d{4}\/\d+|bill\/\d+|doc\/[a-z0-9-]+\/\S+)$/
const PROVISION_PATH = /^(?:section|part|chapter|schedule|paragraph|article|regulation|rule|crossheading)\/[0-9A-Za-z]+(?:\/(?:section|part|chapter|schedule|paragraph|article|regulation|rule|subsection)\/[0-9A-Za-z]+)*$/
export const isDocUri = (s: string) => DOC_URI.test(s)
export const isProvisionPath = (s: string) => PROVISION_PATH.test(s)
/** `section/5` → `section-5` (the effects reader's and the corpus's provision form). `part/1` and deeper paths have no corpus id form. */
export const corpusProvision = (path: string | null): string | null => (path && /^section\/[0-9A-Za-z]+$/.test(path) ? path.replace('/', '-') : null)
export const targetKind = (docUri: string, path: string | null): 'act' | 'provision' | 'instrument' | 'bill' | 'document' =>
  docUri.startsWith('bill/') ? 'bill' : docUri.startsWith('doc/') ? 'document' : path ? 'provision' : /^(uksi|ssi|wsi|nisr)\//.test(docUri) ? 'instrument' : 'act'

// ── the caveat ────────────────────────────────────────────────────────────────────────────────────────────────
export function withCaveat(clause: string): string {
  const body = clause.replace(/\r\n/g, '\n').trim()
  if (!body) return ''
  const rest = body.startsWith(CLAUSE_CAVEAT) ? body.slice(CLAUSE_CAVEAT.length).replace(/^\s+/, '') : body
  return `${CLAUSE_CAVEAT}\n\n${rest}`.trim()
}

// ── reading the stored JSON defensively ──────────────────────────────────────────────────────────────────────
const isObj = (v: unknown): v is Record<string, unknown> => !!v && typeof v === 'object' && !Array.isArray(v)
const str = (v: unknown, n = 4000) => (typeof v === 'string' ? v.trim().slice(0, n) : '')

function parseInstruction(v: Record<string, unknown>): DraftInstruction {
  const provisions = (Array.isArray(v.provisions) ? v.provisions : []).filter(isObj).map((p) => ({
    docUri: str(p.docUri, 60), provisionPath: str(p.provisionPath, 80) || null,
    relation: (RELATIONS as readonly string[]).includes(p.relation as string) ? (p.relation as Relation) : 'amends', note: str(p.note, 300),
  })).filter((p) => p.docUri)
  const precedents = (Array.isArray(v.precedents) ? v.precedents : []).filter(isObj).map((p) => ({ docUri: str(p.docUri, 60), provisionPath: str(p.provisionPath, 80) || null, how: str(p.how, 300) })).filter((p) => p.docUri)
  return {
    instrument: (INSTRUMENTS as readonly string[]).includes(v.instrument as string) ? (v.instrument as Instrument) : null,
    provisions, dutyOnWhom: str(v.dutyOnWhom, 600), enforcedHow: str(v.enforcedHow, 600), commencement: str(v.commencement, 600),
    extent: (Array.isArray(v.extent) ? v.extent : []).map((e) => str(e, 40)).filter((e) => (EXTENTS as readonly string[]).includes(e)),
    precedents, clause: str(v.clause, 12000) ? withCaveat(str(v.clause, 12000)) : '', plainWording: str(v.plainWording, 4000), purpose: str(v.purpose, 300),
    citations: (Array.isArray(v.citations) ? v.citations : []).map((c) => str(c, 200)).filter(Boolean).slice(0, 40),
  }
}

export function parseDraft(json: unknown): ActionDraft | undefined {
  if (!isObj(json)) return undefined
  const versions = (Array.isArray(json.versions) ? json.versions : []).filter(isObj).map((v, i) => ({
    ...parseInstruction(v), v: typeof v.v === 'number' ? v.v : i + 1, by: v.by === 'LEX' ? 'LEX' as const : 'USER' as const, at: str(v.at, 40),
  }))
  const proposal = isObj(json.proposal) ? { ...parseInstruction(json.proposal), at: str(json.proposal.at, 40), reason: str(json.proposal.reason, 600), pence: typeof json.proposal.pence === 'number' ? json.proposal.pence : null } : undefined
  if (!versions.length && !proposal) return undefined
  return { versions, ...(proposal ? { proposal } : {}) }
}

export const currentVersion = (d: ActionDraft | undefined): DraftVersion | null => (d?.versions.length ? d.versions[d.versions.length - 1] : null)

/** Append a version (never replace one). Pure. */
export function addVersion(d: ActionDraft | undefined, ins: DraftInstruction, by: 'USER' | 'LEX', at: string): ActionDraft {
  const versions = d?.versions ?? []
  const v: DraftVersion = { ...ins, clause: ins.clause ? withCaveat(ins.clause) : '', v: (versions[versions.length - 1]?.v ?? 0) + 1, by, at }
  return { versions: [...versions, v], ...(d?.proposal ? { proposal: d.proposal } : {}) }
}

/** What is still missing, in the words the screen uses. Legislative actions need the full set; others the short set (§3a). */
export function missingFields(ins: DraftInstruction | null, legislative: boolean): string[] {
  if (!ins) return ['the drafting instruction']
  const m: string[] = []
  if (!ins.instrument) m.push('Instrument')
  if (!ins.dutyOnWhom) m.push('Duty on whom')
  if (!ins.enforcedHow) m.push('Enforced how')
  if (legislative) {
    if (!ins.provisions.length) m.push('Amends / inserts into / repeals')
    if (!ins.commencement) m.push('Commencement')
    if (!ins.extent.length) m.push('Extent')
    if (!ins.clause) m.push('The clause')
  } else if (!ins.plainWording) m.push('Wording')
  return m
}

/** Validate a user's or Lex's instruction; refusals in words (§30). */
export function validateInstruction(ins: DraftInstruction): string[] {
  const out: string[] = []
  ins.provisions.forEach((p, i) => {
    if (!isDocUri(p.docUri)) out.push(`provision line ${i + 1}: “${p.docUri}” is not in legislation.gov.uk form (for example ukpga/2010/25, bill/3812, or for a document doc/<collection>/<document id>)`)
    if (p.provisionPath && !isProvisionPath(p.provisionPath)) out.push(`provision line ${i + 1}: “${p.provisionPath}” is not a provision path such as section/5 or schedule/2/paragraph/3`)
  })
  return out
}

/** One line for a provision, as the screen and the documents print it. */
export const provisionLine = (p: DraftProvision) => `${RELATION_WORD[p.relation]} ${p.docUri}${p.provisionPath ? ` · ${p.provisionPath}` : ''}${p.note ? ` — ${p.note}` : ''}`

/**
 * MEASURED price of "Draft this clause", one entry per real run on a scratch copy (CLAUDE.md §23.2: "n=" is the count). Empty means
 * the price is not yet measured and the button says "estimate".
 */
export const DRAFT_RUNS: Array<{ pence: number; seconds: number; on: string }> = [
  // 22 Oct 2026, claude-sonnet-5-5 at effort high, one action a call, OPC Parts 5.1/6/9.2 + five precedents supplied (scripts/measure-26u-draft.ts).
  // #59 the Code, #38 the named-owner duty (the whole Bill), #202 the PSED action, twice (the second after the "state what remains" line).
  // ⚠ Two earlier #38/#202 calls were cut off at an 8,000-token ceiling (10.0p + 9.7p, recorded as failed); the ceiling is now 16,000.
  { pence: 7.34, seconds: 37.2, on: 'scratch copy of 452c5ade, 22 Oct 2026 (#59)' },
  { pence: 15.41, seconds: 143, on: 'scratch copy of 452c5ade, 22 Oct 2026 (#38)' },
  { pence: 10.0, seconds: 62.8, on: 'scratch copy of 452c5ade, 22 Oct 2026 (#202)' },
  { pence: 10.16, seconds: 98.2, on: 'scratch copy of 452c5ade, 22 Oct 2026 (#202 again)' },
]
export const DRAFT_PENCE_ESTIMATE = 6
export function draftPrice(): { pence: number; measured: boolean; n: number } {
  if (!DRAFT_RUNS.length) return { pence: DRAFT_PENCE_ESTIMATE, measured: false, n: 0 }
  return { pence: Math.round((DRAFT_RUNS.reduce((s, r) => s + r.pence, 0) / DRAFT_RUNS.length) * 10) / 10, measured: true, n: DRAFT_RUNS.length }
}
/** §0: asks first above ~5p. */
export const DRAFT_CONFIRM_ABOVE_PENCE = 5
