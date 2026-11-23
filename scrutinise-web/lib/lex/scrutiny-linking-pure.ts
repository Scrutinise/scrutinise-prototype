// LEX 26-AC part (a) — the source-linking exercise, PURE: which sections are offered for linking, and the measured price.
// No imports from the database or a model; check:lex-26ac runs this directly.

import type { Block, Run } from '@/lib/documents/model'
import type { EditionView } from './scrutiny-edition-pure'
import type { LinkTarget } from './scrutiny-edition-pure'

export interface LinkTargetRow { key: string; kind: LinkTarget; id: string | null; label: string; text: string }

const clip = (s: string, n: number) => (s.length > n ? `${s.slice(0, n - 1)}…` : s)
const runsText = (rs: Run[]) => rs.map((r) => r.text).join('')

/** A summary's blocks as plain text (the notes, headings and paragraphs; source lists left out). */
export function blocksText(blocks: readonly Block[]): string {
  return blocks.map((b) => {
    switch (b.kind) {
      case 'heading': case 'paragraph': return runsText(b.runs)
      case 'bullets': return b.items.map((i) => `- ${runsText(i)}`).join('\n')
      case 'note': return b.text
      case 'section': return b.title
      default: return ''
    }
  }).filter(Boolean).join('\n')
}

/** Every section of the page a source could support: the idea in one page, each heading, each action, and each action's draft. */
export function linkTargets(view: EditionView): LinkTargetRow[] {
  const out: LinkTargetRow[] = []
  if (view.summary) out.push({ key: 'S', kind: 'SUMMARY', id: null, label: 'The idea in one page', text: clip(blocksText(view.summary.blocks), 4000) })
  for (const h of view.headings) {
    if (h.id) out.push({ key: `H:${h.id}`, kind: 'HEADING', id: h.id, label: `Heading “${h.name}”`, text: clip([h.purpose ?? '', ...h.notes].filter(Boolean).join('\n') || h.name, 1500) })
    for (const a of h.actions) {
      out.push({ key: `A:${a.id}`, kind: 'ACTION', id: a.id, label: `Action #${a.number}`, text: clip([a.statement, a.explanatory?.body ?? '', ...a.costs, ...a.notes].filter(Boolean).join('\n'), 2500) })
      if (a.drafts.length) out.push({ key: `D:${a.id}`, kind: 'DRAFT', id: a.id, label: `The draft of #${a.number}`, text: clip(a.drafts.map((d) => d.body).join('\n\n'), 2500) })
    }
  }
  return out
}

/**
 * MEASURED runs of the whole exercise on scratch copies of real ideas, read off the spend ledger: pence and the words sent. The price per
 * 1,000 words is their mean; an estimate is that times the words this edition would send. Empty = not measured, and the exercise is not
 * offered (it is never run at a guessed price).
 */
export const LINK_RUNS: ReadonlyArray<{ pence: number; words: number; on: string; what: string }> = [
  // scripts/measure-26ac-linking.ts, 23 Nov 2026 01:3x UTC: 4.917p on the ledger; 7 links proposed, 0 dropped, 8 s
  { pence: 4.9, words: 10300, on: '2026-11-23', what: 'one run on a scratch copy of 452c5ade (69 sections, 218 filed sources, 7 links proposed), Sonnet 5.5, read off the spend ledger' },
]

export function linkPrice(words: number): { pence: number | null; basis: string } {
  if (!LINK_RUNS.length) return { pence: null, basis: 'its price has not been measured yet' }
  const per1k = LINK_RUNS.reduce((t, r) => t + (r.pence / r.words) * 1000, 0) / LINK_RUNS.length
  const n = LINK_RUNS.length
  return { pence: Math.max(0.1, Math.round(per1k * (words / 1000) * 10) / 10), basis: `measured, ${n === 1 ? 'n=1' : `mean of n=${n}`} real run${n === 1 ? '' : 's'}, ${LINK_RUNS[n - 1].on}; about ${Math.round(per1k * 10) / 10}p per 1,000 words sent` }
}
