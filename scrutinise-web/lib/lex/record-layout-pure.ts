// ─────────────────────────────────────────────────────────────────────────────
// 26-V1b §2 (decisions 256, 257) — THE ACTION RECORD'S LAYOUT, its PURE half: the section order, the jump band's states in words, and the
// Detail box cut into the owner's own text and the quoted parts below it.
//
// ⚠ PURE (CLAUDE.md §28). ⚠ Every state is a WORD (Charlie is colour blind; §21).
// ⚠ 257 — "Commentary" became "Detail" on screen; 266 (24 Oct) made it "Explanation", in the action box only. The column keeps its name (`commentary`).
// ─────────────────────────────────────────────────────────────────────────────

import { FOLD_HEADER, isImportedHeadLine } from './action-resort-pure'

export const DETAIL_LABEL = 'Explanation'

/** 2a — top to bottom. The jump band names every section but the statement (it sits under it). */
export const RECORD_SECTIONS = [
  { key: 'detail', label: 'Explanation' },
  { key: 'documents', label: 'Documents' },
  { key: 'law', label: 'Law' },
  { key: 'who', label: 'Who, how and against' },
  { key: 'costs', label: 'Costs' },
  { key: 'order', label: 'Order' },
  { key: 'comments', label: 'Comments' },
] as const
export type RecordSection = (typeof RECORD_SECTIONS)[number]['key']

// ── 2d: the Detail box — the owner's text, then "Parts of this action, quoted (N)" ────────────────────────────
export interface QuotedPart { title: string; source: string | null; body: string }
const LEGACY_FOLD_HEADER = 'Components folded in:'

/** Split a Detail into the owner's own text and the quoted parts (folded components and imported blocks). Lossless in content. */
export function detailParts(detail: string | null | undefined): { text: string; parts: QuotedPart[] } {
  const lines = (detail ?? '').replace(/\r\n/g, '\n').split('\n')
  const at = lines.findIndex((l) => l.trim() === FOLD_HEADER || l.trim() === LEGACY_FOLD_HEADER)
  if (at < 0) return { text: (detail ?? '').trim(), parts: [] }
  const text = lines.slice(0, at).join('\n').trim()
  const parts: QuotedPart[] = []
  let cur: { head: string; rest: string[]; imported: boolean } | null = null
  const flush = () => {
    if (!cur) return
    if (cur.imported) {
      // "— More on this action, imported 2026-10-20 (From: [Ref: 7] …) —", then the summary, then the document's words
      const src = /\((.*)\) —$/.exec(cur.head.trim())?.[1] ?? null
      const [summary, ...words] = cur.rest.filter((l) => l.trim())
      parts.push({ title: summary?.trim() || 'an imported passage', source: src, body: words.join('\n').trim() || (summary ?? '').trim() })
    } else {
      // "• [#12] “the component's words” (its title) — the reason"
      const m = /^• \[#(\d+)\]\s*(.*)$/.exec(cur.head.trim())
      // the title is the parenthesis straight after the closing quote (foldLine's shape), never one inside the quoted words
      const t = /”\s*\(([^)]*)\)(?:\s—\s|\s*$)/.exec(m?.[2] ?? '')?.[1]
      const quoted = /^“([\s\S]*?)”/.exec(m?.[2] ?? '')?.[1]
      parts.push({ title: (t?.trim() || quoted?.trim() || m?.[2] || cur.head).slice(0, 120), source: m ? `#${m[1]}, merged in` : null, body: [m?.[2] ?? cur.head, ...cur.rest].join('\n').trim() })
    }
    cur = null
  }
  for (const l of lines.slice(at + 1)) {
    if (isImportedHeadLine(l)) { flush(); cur = { head: l, rest: [], imported: true } }
    else if (/^• \[#\d+\]/.test(l.trim())) { flush(); cur = { head: l, rest: [], imported: false } }
    else if (cur) cur.rest.push(l)
    else if (l.trim()) parts.push({ title: l.trim().slice(0, 120), source: null, body: l.trim() })
  }
  flush()
  return { text, parts }
}

// ── 2b: the jump band's states, in words ─────────────────────────────────────────────────────────────────────
export interface BandInput {
  detail: string | null | undefined
  documents: { needed: number; drafted: number; accepted: number; total: number } | null
  lawRows: number | null
  whoAnswered: number
  whoOf: number
  costs: 'answered' | 'no cost' | 'not answered'
  /** Numbers of the actions this one must come after. */
  after: Array<number | null>
  comments: number | null
}
/** The Explanation's state in words: the band's and the closed box's own summary say the same thing (265). */
export function detailState(detail: string | null | undefined): string {
  const d = detailParts(detail)
  const words = d.text ? d.text.split(/\s+/).length : 0
  return d.parts.length ? `${d.parts.length} part${d.parts.length === 1 ? '' : 's'}` : words ? `${words} words` : 'empty'
}

export function bandStates(b: BandInput): Record<RecordSection, string> {
  return {
    detail: detailState(b.detail),
    documents: !b.documents ? 'reading…' : b.documents.needed
      ? `${b.documents.needed} needed, ${b.documents.drafted} drafted${b.documents.accepted ? `, ${b.documents.accepted} accepted` : ''}`
      : b.documents.total ? `${b.documents.total} document${b.documents.total === 1 ? '' : 's'}` : 'none needed',
    law: b.lawRows == null ? 'reading…' : `${b.lawRows} row${b.lawRows === 1 ? '' : 's'}`,
    who: b.whoAnswered ? `${b.whoAnswered} of ${b.whoOf}` : 'not answered',
    costs: b.costs,
    order: b.after.length ? `after ${b.after.map((n) => `#${n ?? '?'}`).join(', ')}` : 'no order set',
    comments: b.comments == null ? 'reading…' : String(b.comments),
  }
}

/** How many band buttons fit beside the heading menu at a width; the rest go under "≡ More". */
export const bandFits = (width: number): number => (width < 480 ? 2 : width < 720 ? 4 : RECORD_SECTIONS.length)
