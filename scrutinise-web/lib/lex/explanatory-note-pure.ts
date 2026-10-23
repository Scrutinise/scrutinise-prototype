// ─────────────────────────────────────────────────────────────────────────────
// 26-V1b §5 (decision 259) — THE EXPLANATORY NOTE, its pure half: the body Lex's answer is set into, the checks on it, and the MEASURED
// price the button shows. PURE; CLIENT-SAFE (imports nothing but a constant).
//
//   The note: the caveat first; an opening paragraph on the purpose; ONE plain-English paragraph per subsection of the clause (what it does,
//   who it binds, what changes for them); a closing paragraph on commencement and extent. Each is a "## " part, so it is numbered 38.3.1 …
//   [Ref: n] only where it draws on a source the action's Detail already cites — never a new one, and never a D-number (241).
// ─────────────────────────────────────────────────────────────────────────────

import { NOTE_CAVEAT } from './action-documents-pure'

export interface NoteAnswer { purpose: string; subsections: Array<{ n: number; text: string }>; commencementAndExtent: string }

const REF = /\[Ref:\s*(\d+)\s*\]/gi

/**
 * Set Lex's answer into the note's body, keeping only [Ref: n] numbers the Detail cites (others are taken out and SAID), and saying which
 * of the clause's subsections got no paragraph. Pure.
 */
export function noteBody(ans: NoteAnswer, clauseParts: number[], allowedRefs: ReadonlySet<number>): { body: string; dropped: number[]; missing: number[]; extra: number[] } {
  const dropped: number[] = []
  const keep = (s: string) => s.replace(REF, (m, n) => { if (allowedRefs.has(Number(n))) return m; dropped.push(Number(n)); return '' }).replace(/\s+([.,;:])/g, '$1').replace(/[ \t]{2,}/g, ' ').trim()
  const byN = new Map(ans.subsections.map((s) => [s.n, keep(s.text)]))
  const missing = clauseParts.filter((n) => !byN.get(n))
  const extra = ans.subsections.map((s) => s.n).filter((n) => !clauseParts.includes(n))
  const lines = [NOTE_CAVEAT, '', '## Purpose', keep(ans.purpose) || 'Not written.']
  for (const n of clauseParts) lines.push('', `## Subsection (${n})`, byN.get(n) || 'Lex wrote no paragraph for this subsection.')
  lines.push('', '## Commencement and extent', keep(ans.commencementAndExtent) || 'Not written.')
  return { body: lines.join('\n'), dropped: [...new Set(dropped)], missing, extra }
}

/** The opening paragraph of a note's body, for the Introductory Summary to quote (§5b). */
export function noteOpening(body: string): string | null {
  const m = /^## Purpose\n([\s\S]*?)(?:\n## |\s*$)/m.exec(body)
  return m ? m[1].trim() || null : null
}

/**
 * MEASURED price of "Draft the explanatory note", one entry per real run on a scratch copy (§23.2: n is the count). The button shows a
 * price only from these; while the list is empty it says the price is not yet measured and still asks first.
 */
export const NOTE_RUNS: Array<{ pence: number; seconds: number; on: string }> = [
  // 23 Oct 2026 (UTC), claude-sonnet-5-5 at effort medium, scripts/measure-26v1b-note.ts — the clause read from 452c5ade, the note composed on a scratch copy.
  { pence: 2.56, seconds: 16.5, on: 'scratch copy of 452c5ade, 2026-10-23 (#38 version 1, 16 subsections)' },
  { pence: 1.57, seconds: 9.9, on: 'scratch copy of 452c5ade, 2026-10-23 (#202 proposal 2)' },
  { pence: 1.52, seconds: 10.2, on: 'scratch copy of 452c5ade, 2026-10-23 (#202 proposal 1)' },
]
export function notePrice(): { pence: number | null; n: number } {
  if (!NOTE_RUNS.length) return { pence: null, n: 0 }
  return { pence: Math.round((NOTE_RUNS.reduce((s, r) => s + r.pence, 0) / NOTE_RUNS.length) * 10) / 10, n: NOTE_RUNS.length }
}
