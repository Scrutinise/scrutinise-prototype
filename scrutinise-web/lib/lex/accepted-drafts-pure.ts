// ─────────────────────────────────────────────────────────────────────────────
// LEX 26-X X3 (decision 311) — WHAT A REVIEW READ, IN WORDS. PURE; CLIENT-SAFE (imports types and the kind words only), so the digest panel,
// the policy-test verdict and the review runner say it in one wording. The server half (the reader) is lib/lex/accepted-drafts.ts.
// ─────────────────────────────────────────────────────────────────────────────

import { KIND_WORD, type DocumentKind } from './action-documents-pure'

/** What a review read for one action, in a form that can be stored and said. `chars` is the length of the text read, before any cut. */
export type ReadMark = { what: 'draft'; d: string; kind: DocumentKind; v: number; newerV: number | null; chars: number } | { what: 'statement'; chars: number }

/** "the accepted draft D.207.2 (code text), version 1" / "the statement (no accepted draft)". */
export function readWords(r: ReadMark | null | undefined): string {
  if (!r) return 'what it read was not recorded'
  if (r.what === 'statement') return 'the statement (no accepted draft)'
  return `the accepted draft ${r.d} (${KIND_WORD[r.kind] ?? r.kind}), version ${r.v}${r.newerV ? ` — version ${r.newerV} is newer and not accepted` : ''}`
}

/** The policy test's verdict line (311, 6b): "tested against the draft D.38.1, v2" / "tested against the statement". */
export function testedAgainstWords(r: ReadMark | null | undefined): string {
  if (!r) return 'tested against the statement, before drafts were read'
  if (r.what === 'statement') return 'tested against the statement'
  return `tested against the draft ${r.d}, v${r.v}${r.newerV ? ` (v${r.newerV} is newer and not accepted)` : ''}`
}

/** Is `stored` (what a test read) the same as what would be read now? A test of the statement is out of date once a draft is accepted. */
export function sameRead(stored: ReadMark | null | undefined, now: ReadMark): boolean {
  if (!stored || stored.what !== now.what) return false
  if (stored.what === 'statement') return true
  return now.what === 'draft' && stored.d === now.d && stored.v === now.v
}

/**
 * Is a policy verdict still a test of what would be read now? A verdict from before X3 carries no mark: it was a test of the statement (every
 * test then read title and statement), so it stays current until a draft is accepted. Without this, every old verdict would read "out of date"
 * and the button would test them all again.
 */
export function testIsCurrent(stored: ReadMark | null | undefined, now: ReadMark): boolean {
  if (!stored) return now.what === 'statement'
  return sameRead(stored, now)
}

/** Parse a stored ReadMark defensively (it lives in JSON). */
export function parseReadMark(x: unknown): ReadMark | null {
  if (!x || typeof x !== 'object') return null
  const o = x as Record<string, unknown>
  const chars = typeof o.chars === 'number' ? o.chars : 0
  if (o.what === 'statement') return { what: 'statement', chars }
  if (o.what === 'draft' && typeof o.d === 'string' && typeof o.kind === 'string' && typeof o.v === 'number') {
    return { what: 'draft', d: o.d, kind: o.kind as DocumentKind, v: o.v, newerV: typeof o.newerV === 'number' ? o.newerV : null, chars }
  }
  return null
}

/** "1 accepted draft (#207 D.207.2 v1) and 57 statements" — the digest's one line of what it read. */
export function readsLine(reads: ReadonlyArray<{ n: number; read: ReadMark }>): string {
  const drafts = reads.filter((r) => r.read.what === 'draft')
  const st = reads.length - drafts.length
  const list = drafts.map((r) => (r.read.what === 'draft' ? `#${r.n} ${r.read.d} v${r.read.v}` : '')).join(', ')
  const dWords = drafts.length ? `${drafts.length} accepted draft${drafts.length === 1 ? '' : 's'} (${list})` : 'no accepted drafts'
  return `${dWords} and ${st} statement${st === 1 ? '' : 's'} (the actions with no accepted draft)`
}
