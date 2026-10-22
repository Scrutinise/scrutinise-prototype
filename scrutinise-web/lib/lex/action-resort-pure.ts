// ─────────────────────────────────────────────────────────────────────────────
// 26-S2 decisions 186, 187, 190 — RE-SORT INTO HEADINGS and CONSOLIDATE THIS HEADING: THE PURE HALF. Client-safe (no imports).
//
// ⚠ NOTHING DELETES. A re-sort moves an action and remembers where it was (`headingWasId`) and why it moved (`headingReason`); a retired
// heading is ARCHIVED. A consolidate FOLDS a component into its mechanism's commentary — as a QUOTE the code copies from the row, never
// text the model wrote — and the component stays, archived, with a pointer; Restore unfolds it. A true duplicate goes through the existing
// merge (originals kept).
// ─────────────────────────────────────────────────────────────────────────────

export interface HeadingTarget {
  name: string
  /** What belongs under it, in the user's words; shown to the model and kept as the heading's purpose. */
  purpose: string
  /** Earlier names this heading replaces: a heading with one of these names is RENAMED (keeping its id and its actions), not archived. */
  formerly?: string[]
}
export interface HeadingPlan { targets: HeadingTarget[]; source: string | null }

export const norm = (s: string) => s.replace(/\s+/g, ' ').trim().toLowerCase()

/** Tolerant read of `Idea.headingPlan`. null = no plan, and the Re-sort button does not show. */
export function parseHeadingPlan(raw: unknown): HeadingPlan | null {
  const r = (raw && typeof raw === 'object' ? raw : null) as Record<string, unknown> | null
  if (!r || !Array.isArray(r.targets)) return null
  const seen = new Set<string>()
  const targets: HeadingTarget[] = []
  for (const x of r.targets) {
    const o = x as Record<string, unknown>
    const name = typeof o?.name === 'string' ? o.name.replace(/\s+/g, ' ').trim() : ''
    if (!name || seen.has(norm(name))) continue
    seen.add(norm(name))
    targets.push({
      name,
      purpose: typeof o.purpose === 'string' ? o.purpose.trim() : '',
      ...(Array.isArray(o.formerly) ? { formerly: o.formerly.filter((f): f is string => typeof f === 'string' && !!f.trim()) } : {}),
    })
  }
  return targets.length >= 2 ? { targets, source: typeof r.source === 'string' ? r.source : null } : null
}

// ── Re-sort ───────────────────────────────────────────────────────────────────────────────────────────────
/** Actions per model call. Small enough that a truncated answer is rare; the screen loops the batches and each is applied as it completes. */
export const RESORT_BATCH = 40

/**
 * The price of the pass. ⚠ `RESORT_RUNS` is what was MEASURED on a scratch copy (scripts/measure-lex-resort.ts); until a run is recorded
 * here the estimate is flagged as a guess on the card, in words. Pence per action.
 */
export const RESORT_RUNS: Array<{ actions: number; calls: number; pence: number; seconds: number; on: string }> = [
  // n=1, 18 Oct 2026, scripts/measure-lex-resort.ts on a scratch copy of 452c5ade (gemini-2.5-pro, batches of 40): 174 actions, 5 calls, 26.33p, 242 s = 0.151p per action
  { actions: 174, calls: 5, pence: 26.33, seconds: 242, on: '452c5ade scratch copy, 18 Oct 2026' },
]
export const RESORT_PENCE_GUESS = 0.05 // pence per action, before any measurement
export function resortEstimate(actions: number): { pence: number; measured: boolean; calls: number } {
  const calls = Math.max(1, Math.ceil(actions / RESORT_BATCH))
  if (RESORT_RUNS.length) {
    const per = RESORT_RUNS.reduce((s, r) => s + r.pence, 0) / RESORT_RUNS.reduce((s, r) => s + r.actions, 0)
    return { pence: Math.round(per * actions * 100) / 100, measured: true, calls }
  }
  return { pence: Math.round(RESORT_PENCE_GUESS * actions * 100) / 100, measured: false, calls }
}
export const CONSOLIDATE_RUNS: Array<{ actions: number; calls: number; pence: number; seconds: number; on: string }> = [
  // n=1, same scratch copy, one call per heading (seven headings, 13 to 47 actions each): 174 actions, 7 calls, 28.33p, 268 s = 0.163p per action; 174 -> 66 live
  { actions: 174, calls: 7, pence: 28.33, seconds: 268, on: '452c5ade scratch copy, 18 Oct 2026' },
]
export const CONSOLIDATE_PENCE_GUESS = 0.1
export function consolidateEstimate(actions: number): { pence: number; measured: boolean } {
  if (CONSOLIDATE_RUNS.length) {
    const per = CONSOLIDATE_RUNS.reduce((s, r) => s + r.pence, 0) / CONSOLIDATE_RUNS.reduce((s, r) => s + r.actions, 0)
    return { pence: Math.round(per * actions * 100) / 100, measured: true }
  }
  return { pence: Math.round(CONSOLIDATE_PENCE_GUESS * actions * 100) / 100, measured: false }
}
/** Above this the card asks before it spends (the same line as Classify's). */
export const RESORT_CONFIRM_ABOVE_PENCE = 20

// ── Consolidate ───────────────────────────────────────────────────────────────────────────────────────────
// 199 - plain words. Commentary written before 199 carries the old header; it is still recognised and is rewritten to the new one.
export const FOLD_HEADER = 'Parts of this action, quoted'
const LEGACY_FOLD_HEADER = 'Components folded in:'
const isFoldHeader = (l: string) => l.trim() === FOLD_HEADER || l.trim() === LEGACY_FOLD_HEADER
/** Show old commentary under the new header (display and documents; the stored text is rewritten the next time a part is added or taken out). */
export const plainFoldHeader = (commentary: string | null | undefined): string => (commentary ?? '').split('\n').map((l) => (l.trim() === LEGACY_FOLD_HEADER ? FOLD_HEADER : l)).join('\n')
const oneLine = (s: string) => s.replace(/\s+/g, ' ').trim()

/** One bullet: the citation [#n], the component's own words in quotes, the reason. The text is the ROW's, never the model's. */
export function foldLine(number: number, title: string | null, statement: string, reason: string | null): string {
  return `• [#${number}] “${oneLine(statement)}”${title?.trim() ? ` (${oneLine(title)})` : ''}${reason?.trim() ? ` — ${oneLine(reason)}` : ''}`
}
export function addFoldLines(commentary: string | null | undefined, lines: string[]): string {
  const base = plainFoldHeader(commentary).replace(/\s+$/, '')
  if (!lines.length) return base
  const has = base.split('\n').some(isFoldHeader)
  return has ? `${base}\n${lines.join('\n')}` : `${base ? `${base}\n\n` : ''}${FOLD_HEADER}\n${lines.join('\n')}`
}
// ── 26-U §2 (decision 227) — imported material is Commentary, never statement ─────────────────────────────────
// The import pass (26-S1 §3e) APPENDED "— More on this action, imported <date> (From: [Ref: n] …) —" blocks to the statement. On #38 that
// made a 462-character sentence 3,196 characters, and editing it cut 90% of the text. The blocks now live under FOLD_HEADER in Commentary,
// verbatim (head line, summary, the document's words); the statement keeps only what was there before the first block.
const IMPORTED_HEAD = /\n*— (?:More on this action|A component of this action), imported \d{4}-\d{2}-\d{2} \([^\n]*\) —\n/g
export const isImportedHeadLine = (l: string) => /^— (?:More on this action|A component of this action), imported \d{4}-\d{2}-\d{2} \(.*\) —$/.test(l.trim())

/** Split a statement into the user's text and the imported blocks appended to it. Pure; lossless (statement + blocks = the input, modulo the blank lines between). */
export function splitImportedBlocks(statement: string): { statement: string; blocks: string[] } {
  const heads = [...statement.matchAll(IMPORTED_HEAD)]
  if (!heads.length) return { statement, blocks: [] }
  const blocks = heads.map((m, i) => statement.slice(m.index!, heads[i + 1]?.index ?? statement.length).trim())
  return { statement: statement.slice(0, heads[0].index!).trimEnd(), blocks }
}

/** Add imported blocks to a commentary, under FOLD_HEADER (added if absent), after whatever is there. Pure. */
export function addImportedBlocks(commentary: string | null | undefined, blocks: string[]): string {
  const base = plainFoldHeader(commentary).replace(/\s+$/, '')
  if (!blocks.length) return base
  const has = base.split('\n').some(isFoldHeader)
  return `${base ? `${base}\n\n` : ''}${has ? '' : `${FOLD_HEADER}\n`}${blocks.join('\n\n')}`
}

/** Unfold one component: its bullet goes; the header goes with the last bullet (an imported block counts as one). Returns null when nothing is left. */
export function removeFoldLine(commentary: string | null | undefined, number: number): string | null {
  const lines = (commentary ?? '').split('\n')
  const prefix = `• [#${number}] `
  const kept = lines.filter((l) => !l.startsWith(prefix))
  const bullets = kept.filter((l) => l.startsWith('• [#') || isImportedHeadLine(l))
  const out = bullets.length ? kept.map((l) => (isFoldHeader(l) ? FOLD_HEADER : l)) : kept.filter((l) => !isFoldHeader(l))
  const text = out.join('\n').replace(/\n{3,}/g, '\n\n').trim()
  return text || null
}
export const foldedNumbers = (commentary: string | null | undefined): number[] => (commentary ?? '').split('\n').flatMap((l) => { const m = /^• \[#(\d+)\] /.exec(l); return m ? [Number(m[1])] : [] })

export interface ConsolidationAnswer {
  mechanisms: Array<{ leadNumber: number; componentNumbers: number[]; reason: string }>
  duplicates: Array<{ keepNumber: number; duplicateNumber: number; reason: string }>
}
export interface ValidatedConsolidation {
  mechanisms: Array<{ lead: number; components: number[]; reason: string }>
  duplicates: Array<{ keep: number; duplicate: number; reason: string }>
  /** What the model said that could not be applied, in words (shown, not hidden). */
  refused: string[]
}

/**
 * Hold the model to the rules the code depends on. `live` = the numbers of the live actions ON THIS HEADING. Every action takes part in at
 * most ONE group (a lead, a component, a kept original or a duplicate); a lead is never a component; a number the heading does not hold
 * is refused. Anything refused is reported, never silently dropped.
 */
export function validateConsolidation(raw: Partial<ConsolidationAnswer> | null | undefined, live: Set<number>): ValidatedConsolidation {
  const used = new Set<number>()
  const refused: string[] = []
  const mechanisms: ValidatedConsolidation['mechanisms'] = []
  const duplicates: ValidatedConsolidation['duplicates'] = []
  const int = (v: unknown) => (typeof v === 'number' && Number.isInteger(v) ? v : NaN)
  for (const m of raw?.mechanisms ?? []) {
    const lead = int(m?.leadNumber)
    if (!live.has(lead)) { refused.push(`#${m?.leadNumber} is not a live action on this heading, so its group was not applied`); continue }
    if (used.has(lead)) { refused.push(`#${lead} appeared in two groups; the second was not applied`); continue }
    const comps: number[] = []
    for (const c of m.componentNumbers ?? []) {
      const n = int(c)
      if (!live.has(n) || n === lead) { refused.push(`#${c} cannot be a component of #${lead}`); continue }
      if (used.has(n) || comps.includes(n)) { refused.push(`#${n} was already in another group, so it was not folded into #${lead}`); continue }
      comps.push(n)
    }
    if (!comps.length) continue
    used.add(lead); comps.forEach((c) => used.add(c))
    mechanisms.push({ lead, components: comps, reason: oneLine(String(m.reason ?? '')).slice(0, 240) })
  }
  for (const d of raw?.duplicates ?? []) {
    const keep = int(d?.keepNumber), dup = int(d?.duplicateNumber)
    if (!live.has(keep) || !live.has(dup) || keep === dup) { refused.push(`the pair #${d?.keepNumber} / #${d?.duplicateNumber} is not two live actions on this heading`); continue }
    if (used.has(keep) || used.has(dup)) { refused.push(`#${keep} / #${dup} overlapped another group, so the pair was not merged`); continue }
    used.add(keep); used.add(dup)
    duplicates.push({ keep, duplicate: dup, reason: oneLine(String(d.reason ?? '')).slice(0, 240) })
  }
  return { mechanisms, duplicates, refused }
}
