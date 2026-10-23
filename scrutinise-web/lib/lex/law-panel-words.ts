// ─────────────────────────────────────────────────────────────────────────────
// 26-V1b §6 — THE LAW PANEL'S WORDS: who named a line, where else the same Act is named, and the question a hand "amends" row asks.
//
// ⚠ PURE (CLAUDE.md §28): IdeaLawPanel renders inside a client component. Imports types only.
// ⚠ 6a — NEVER AN INTERNAL ID ON SCREEN. An instruction row's stored source_detail is "<action uuid> v<n>" (26-U §5); it is read here for
//   its version number and the ACTION's number and title are printed instead. The stored value is not rewritten.
// ⚠ 6b — SEPARATE LINES STAY SEPARATE. A whole-Act hand row and an instruction row for one of its schedules are different targets (GRAPH's
//   merge is by relation + exact target, and is right). Each line says where else the same Act is named, so the reader need not hunt.
// ⚠ 6c — the gap between the stated position and the drafted one: a hand "amends"/"repeals" row with no instruction row doing so on that Act.
// ─────────────────────────────────────────────────────────────────────────────

import type { IdeaLawRow, IdeaLawSourceEntry, LawRelation } from './idea-law-pure'

export const RELATION_WORD: Record<LawRelation, string> = {
  amends: 'amends', repeals: 'repeals', modifies: 'modifies', relies_on: 'relies on', constrains: 'is constrained by', precedent: 'precedent', context: 'context',
}

/** "section/3" → "section 3"; "schedule/1/paragraph/2" → "schedule 1, paragraph 2". */
export function provisionWords(path: string): string {
  return path.split('/').reduce<string[]>((out, seg, i, all) => (i % 2 === 0 ? [...out, `${seg} ${all[i + 1] ?? ''}`.trim()] : out), []).join(', ')
}

/** The version number an instruction row was written from, or null where the detail does not carry one. */
export function instructionVersion(sourceDetail: string | null): number | null {
  const m = /\bv(\d+)\s*$/.exec(sourceDetail ?? '')
  return m ? Number(m[1]) : null
}

/** "#38" for an action with a number, else "an action" — never its id. */
const actionRef = (s: Pick<IdeaLawSourceEntry, 'action'>): string => (s.action?.number != null ? `#${s.action.number}` : 'an action')

/** 6a — the source line, in words. A hand row keeps its own detail (who attached it, when); an instruction row names the action and version. */
export function sourceWords(s: Pick<IdeaLawSourceEntry, 'source' | 'sourceDetail' | 'action'>): string {
  if (s.source === 'drafting_instruction') {
    const v = instructionVersion(s.sourceDetail)
    return `From ${actionRef(s)}’s drafting instruction${v != null ? `, version ${v}` : ''}`
  }
  if (s.source === 'hand') return `Attached by hand${s.sourceDetail ? ` (${s.sourceDetail})` : ''}`
  return `Found by extraction${s.sourceDetail ? ` (${s.sourceDetail})` : ''}`
}

/** Who named a line, short: "by hand" or "by #38". */
const byWho = (s: Pick<IdeaLawSourceEntry, 'source' | 'action'>): string => (s.source === 'hand' ? 'by hand' : s.source === 'drafting_instruction' ? `by ${actionRef(s)}` : 'by extraction')

/** 6b — every OTHER line on the same Act (a different provision, or a different relation), in words: "schedule 1, relies on, by #38". */
export function alsoNamedAt(rows: IdeaLawRow[], r: IdeaLawRow): string[] {
  return rows
    .filter((o) => o !== r && o.docUri === r.docUri && (o.provisionPath !== r.provisionPath || o.relation !== r.relation))
    .flatMap((o) => o.sources.map((s) => `${o.provisionPath ? provisionWords(o.provisionPath) : 'the whole Act'}, ${RELATION_WORD[o.relation]}, ${byWho(s)}`))
}

/** 6c — a hand amends/repeals line on an Act that no action's instruction yet amends or repeals (at any provision). */
export function unansweredAmendment(rows: IdeaLawRow[], r: IdeaLawRow): string | null {
  if (r.relation !== 'amends' && r.relation !== 'repeals') return null
  if (!r.sources.some((s) => s.source === 'hand')) return null
  const drafted = rows.some((o) => o.docUri === r.docUri && o.relation === r.relation && o.sources.some((s) => s.source === 'drafting_instruction'))
  return drafted ? null : `No action’s instruction yet ${r.relation === 'amends' ? 'amends' : 'repeals'} this Act — which action will?`
}
