// ─────────────────────────────────────────────────────────────────────────────
// 26-V1b §3 — THE DOCUMENT VIEW, its PURE half: the header strip's words, a document's status in words, what changed between two versions,
// a clause cut into its subsections (for the three-column comparison), and a court read off a neutral citation.
//
// ⚠ PURE (CLAUDE.md §28): imported by the client view. Types only from the other modules.
// ⚠ 263 — "USED" AND "ACCEPTED" ARE TWO ACTS, AND THE STRIP SAYS SO. Using Lex's proposal makes it a version and writes law rows; Accept is the
//   owner's sign-off on the document. A version saved after an Accept reads "accepted at version N, then changed — accept again".
// ⚠ Plain words (BRIEF_26V1b §0): version, accepted, as it stands; never "diff" or "node".
// ─────────────────────────────────────────────────────────────────────────────

import type { DraftInstruction, DraftProvision } from './action-draft-pure'
import type { DocumentStatus } from './action-documents-pure'

const STATUS_PLAIN: Record<DocumentStatus, string> = { DRAFTED: 'drafted, not accepted', ACCEPTED: 'accepted', SUPERSEDED: 'superseded' }

/** A document's status in words, everywhere it is shown (the tree, the record, the strip). */
export function statusWords(status: DocumentStatus, acceptedV: number | null, currentV: number | null): string {
  if (status === 'ACCEPTED') return `accepted${acceptedV ? ` (version ${acceptedV})` : ''}`
  if (status === 'DRAFTED' && acceptedV != null && currentV != null && currentV > acceptedV) return `accepted at version ${acceptedV}, then changed — accept again`
  if (status === 'DRAFTED' && currentV == null) return 'no version yet'
  return STATUS_PLAIN[status]
}

/** True where the owner's sign-off is wanted: a version exists and it is not the accepted one. */
export const wantsAccept = (status: DocumentStatus, currentV: number | null): boolean => status === 'DRAFTED' && currentV != null

export type VersionAuthor = 'LEX' | 'OWNER' | 'COLLABORATOR' | 'GENERATED' | string
/** Where a version came from: "Lex’s proposal v2, used by you" · "yours, edited from version 1" · "yours". */
export function versionWords(v: { v: number; author: VersionAuthor; fromProposal: number | null; previousAuthor: VersionAuthor | null }): string {
  if (v.author === 'LEX') return `version ${v.v}, Lex’s draft${v.fromProposal ? ` (proposal ${v.fromProposal})` : ''}, used by you`
  if (v.author === 'GENERATED') return `version ${v.v}, generated from the data`
  const who = v.author === 'COLLABORATOR' ? 'a collaborator’s' : 'yours'
  if (v.previousAuthor === 'LEX') return `version ${v.v}, ${who} (from Lex’s version ${v.v - 1})`
  return `version ${v.v}, ${who}`
}

export interface StripLaw { live: number; targets: string[]; precedents: number }
/** "7 law rows written: FOI 2000, schedule 1, …, + 3 precedents" — the answer to "what did my save do". */
export function lawRowsWords(l: StripLaw): string {
  if (!l.live) return 'no law rows written'
  const named = l.targets.length ? `: ${l.targets.join(', ')}${l.precedents ? `, + ${l.precedents} precedent${l.precedents === 1 ? '' : 's'}` : ''}` : ''
  return `${l.live} law row${l.live === 1 ? '' : 's'} written${named}`
}

export interface StripInput {
  d: string; title: string; status: DocumentStatus; acceptedV: number | null
  current: { v: number; author: VersionAuthor; fromProposal: number | null; previousAuthor: VersionAuthor | null } | null
  law: StripLaw | null
  /** A proposal from Lex waiting to be used or set aside. */
  proposalWaiting?: number | null
}
/** The header strip's pieces, in order. The status piece is the one the screen sets in bold. */
export function headerStrip(s: StripInput): { pieces: string[]; status: string; prompt: string | null } {
  const status = statusWords(s.status, s.acceptedV, s.current?.v ?? null)
  const waiting = s.proposalWaiting ? `Lex’s proposal ${s.proposalWaiting} is waiting — use it or set it aside below` : null
  if (!s.current) return { pieces: [s.d, s.title], status: 'no version yet', prompt: waiting }
  const pieces = [s.d, s.title, versionWords(s.current), ...(s.law ? [lawRowsWords(s.law)] : [])]
  const prompt = [wantsAccept(s.status, s.current.v) ? 'Accept when you are content' : null, waiting].filter(Boolean).join(' · ') || null
  return { pieces, status: status === 'drafted, not accepted' ? 'not yet accepted' : status, prompt }
}

// ── what changed between two versions (the Versions tab) ────────────────────────────────────────────────────
const words = (s: string) => (s.trim() ? s.trim().split(/\s+/).length : 0)
const lineKey = (p: Pick<DraftProvision, 'relation' | 'docUri' | 'provisionPath'>) => `${p.relation} ${p.docUri}${p.provisionPath ? ` ${p.provisionPath}` : ''}`
const FIELD_WORD: Array<[keyof DraftInstruction, string]> = [
  ['instrument', 'instrument'], ['dutyOnWhom', 'duty on whom'], ['enforcedHow', 'enforced how'], ['commencement', 'commencement'], ['purpose', 'purpose'], ['plainWording', 'wording'],
]
export interface VersionChange { words: number; wordsBefore: number; added: string[]; dropped: string[]; fields: string[] }
export function versionChange(prev: DraftInstruction | null, cur: DraftInstruction): VersionChange {
  const body = (x: DraftInstruction) => x.clause || x.plainWording
  const before = new Set((prev?.provisions ?? []).map(lineKey)), now = new Set(cur.provisions.map(lineKey))
  return {
    words: words(body(cur)), wordsBefore: prev ? words(body(prev)) : 0,
    added: [...now].filter((k) => !before.has(k)), dropped: [...before].filter((k) => !now.has(k)),
    fields: prev ? FIELD_WORD.filter(([k]) => JSON.stringify(prev[k]) !== JSON.stringify(cur[k])).map(([, w]) => w)
      .concat(JSON.stringify([...prev.extent].sort()) !== JSON.stringify([...cur.extent].sort()) ? ['extent'] : []) : [],
  }
}
export function changeWords(c: VersionChange, first: boolean): string {
  if (first) return `${c.words} words; ${c.added.length} provision line${c.added.length === 1 ? '' : 's'}`
  const bits = [`${c.words} words (${c.words - c.wordsBefore >= 0 ? '+' : ''}${c.words - c.wordsBefore})`]
  if (c.added.length) bits.push(`added: ${c.added.join('; ')}`)
  if (c.dropped.length) bits.push(`dropped: ${c.dropped.join('; ')}`)
  if (c.fields.length) bits.push(`changed: ${c.fields.join(', ')}`)
  if (!c.added.length && !c.dropped.length && !c.fields.length) bits.push('no change to the provision lines or fields')
  return bits.join(' · ')
}

// ── a clause cut into its subsections (3g, the three-column comparison) ─────────────────────────────────────
export interface ClauseCut { head: string; parts: Array<{ n: number; text: string }> }
/** The caveat and any heading lines above "(1)" are the head; each "(n)" at a line start opens part n. A clause with no "(n)" is all head. */
export function cutClause(clause: string): ClauseCut {
  const text = clause.replace(/\r\n/g, '\n').trim()
  const hits = [...text.matchAll(/^\((\d+)\)\s/gm)]
  if (!hits.length) return { head: text, parts: [] }
  return {
    head: text.slice(0, hits[0].index!).trim(),
    parts: hits.map((m, i) => ({ n: Number(m[1]), text: text.slice(m.index!, hits[i + 1]?.index ?? text.length).trim() })),
  }
}
export const joinClause = (c: ClauseCut): string => [c.head, ...c.parts.map((p) => p.text)].filter((x) => x.trim()).join('\n')

/** "Take this": part n of Lex's proposal replaces part n of the working copy, or is inserted in number order where the copy has none. */
export function takePart(working: ClauseCut, proposal: ClauseCut, n: number): ClauseCut {
  const p = proposal.parts.find((x) => x.n === n)
  if (!p) return working
  const parts = working.parts.some((x) => x.n === n) ? working.parts.map((x) => (x.n === n ? p : x)) : [...working.parts, p].sort((a, b) => a.n - b.n)
  return { head: working.head || proposal.head, parts }
}
/** Every subsection number present in either column, in order. */
export const partNumbers = (...cuts: ClauseCut[]): number[] => [...new Set(cuts.flatMap((c) => c.parts.map((p) => p.n)))].sort((a, b) => a - b)

// ── judgments: the court, read off the neutral citation ─────────────────────────────────────────────────────
const COURTS: Array<[RegExp, string]> = [
  [/\bUKSC\b/, 'Supreme Court'], [/\bUKHL\b/, 'House of Lords'], [/\bUKPC\b/, 'Privy Council'],
  [/\bEWCA Civ\b/, 'Court of Appeal (Civil Division)'], [/\bEWCA Crim\b/, 'Court of Appeal (Criminal Division)'],
  [/\bEWHC\b.*\(Admin\)/, 'High Court (Administrative Court)'], [/\bEWHC\b.*\(KB\)|\bEWHC\b.*\(QB\)/, 'High Court (King’s/Queen’s Bench)'],
  [/\bEWHC\b.*\(Ch\)/, 'High Court (Chancery)'], [/\bEWHC\b.*\(Fam\)/, 'High Court (Family)'], [/\bEWHC\b/, 'High Court'],
  [/\bUKUT\b/, 'Upper Tribunal'], [/\bUKFTT\b/, 'First-tier Tribunal'], [/\bUKEAT\b|\bEAT\b/, 'Employment Appeal Tribunal'],
  [/\bEWFC\b/, 'Family Court'], [/\bCSIH\b|\bCSOH\b/, 'Court of Session'], [/\bNICA\b/, 'Court of Appeal in Northern Ireland'],
]
export function courtOf(citation: string): string {
  for (const [re, name] of COURTS) if (re.test(citation)) return name
  return /\]\s*([A-Z]+)/.exec(citation)?.[1] ?? 'court not recorded'
}
/** "tna-caselaw:[2024] EWHC 843 (Admin):1" → "[2024] EWHC 843 (Admin)". */
export const citationOfGid = (gid: string): string => gid.replace(/^[a-z-]+:/, '').replace(/:\d+$/, '')
/** "paragraph-5" → "para 5"; null → "paragraph not recorded". */
export const paragraphWords = (ref: string | null): string => (ref ? ref.replace(/^paragraph-/, 'para ').replace(/-/g, '.') : 'paragraph not recorded')
