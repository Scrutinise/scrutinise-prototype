// ─────────────────────────────────────────────────────────────────────────────
// LEX 26-V2 / decision 267 — THE COLLISION REPORT'S TWO PARTS, walked over GRAPH 8's `onwardFrom()`.
//
// Under each provision the clause amends, repeals or modifies:
//   "What depends on this" — made-under, walked until it ends; and the official record (amends / repeals / modifies / commences) at
//                             steps 1 and 2, never 3 (GRAPH 8 §1: by step 3 it reaches thousands of instruments; the tool withholds it).
//   "Provisions that refer to this — for review" — cites at step 1 with the stored words, step 2 labelled weak, never step 3.
// Judgments (case law) are not walked: interpretation, not drafting (GRAPH 8 §1.1).
//
// ⚠ STOP BY STRENGTH, NOT DEPTH: the limits are GRAPH's own (`withheldAt`), read here rather than restated, so the report and the tool
//   cannot disagree. 246's display depth is withdrawn.
// ⚠ COUNT WHAT WAS NOT WALKED (GRAPH 8 rule 3): every cap and every stop is a WalkNote in words, with its number.
// ⚠ The schedule is NEVER filled from these rows (GRAPH 8 rule 4; 267).
// ⚠ Free: no model call. The walker is injectable so a check can feed a fixture cascade.
// ─────────────────────────────────────────────────────────────────────────────

import { onwardFrom, type OnwardResult, type OneStep } from './onward'
import { citingTextForDisplay, withheldAt, STRENGTH_OF, type OnwardKind } from './onward-pure'
import type { EffectRow, ReportPart, WalkNote } from './action-documents-pure'

export type Walker = (target: string, opts: { kinds: OnwardKind[]; limit: number; depth: number }) =>
  Promise<Pick<OnwardResult, 'rows' | 'perKind' | 'unaddressable' | 'freshness'>>

const OPERATION: OnwardKind[] = ['amends', 'repeals', 'modifies', 'commences']
/** The clause's lines that change a provision; a "relies on" or "precedent" line changes nothing, so it has no parts. */
export const WALKED_RELATIONS: ReadonlySet<string> = new Set(['amends', 'repeals', 'modifies'])
export const WALK_LIMITS = {
  /** Rows returned per kind per node (the reader counts the rest and says so). */
  perNode: 50,
  /** Step 2 is walked from at most this many step-1 nodes per part; the rest are counted. */
  step2From: 10,
  /** Made-under walks until it ends; this only stops a cycle in the data, and is said when it fires. */
  madeUnderSafety: 8,
} as const

const CHANGE_WORD: Record<string, string> = { textual: 'changes the words', 'not-textual': 'does not change the words', unclassified: 'not classified' }
const plural = (n: number, w: string) => `${n} ${w}${n === 1 ? '' : 's'}`
const pathOf = (s: OneStep) => (s.provision.startsWith(`${s.act}/`) ? s.provision.slice(s.act.length + 1) : null)
const counted = (res: Awaited<ReturnType<Walker>>, kinds: OnwardKind[]) =>
  res.perKind.filter((k) => kinds.includes(k.kind)).reduce((a, k) => ({ counted: a.counted + k.counted, returned: a.returned + k.returned, provision: a.provision + k.scope.provision, actWide: a.actWide + k.scope.actWide }), { counted: 0, returned: 0, provision: 0, actWide: 0 })

export async function onwardRows(clause: EffectRow[], walk: Walker = onwardFrom as unknown as Walker): Promise<{ rows: EffectRow[]; notes: WalkNote[]; caveat: string | null; walked: number }> {
  const rows: EffectRow[] = []
  const notes: WalkNote[] = []
  let next = clause.reduce((m, r) => Math.max(m, r.i), -1) + 1
  let caveat: string | null = null
  let walked = 0
  const add = (s: OneStep, part: Exclude<ReportPart, 'clause'>, step: number, parent: number): EffectRow => {
    const r: EffectRow = {
      i: next++, depth: 1 + step, parent, relation: s.kind, docUri: s.act, provisionPath: pathOf(s), actTitle: s.actTitle, state: 'held',
      note: s.changeKind ? CHANGE_WORD[s.changeKind] ?? s.changeKind : '', effects: [], part, step, scope: s.scope,
      words: part === 'refers' ? citingTextForDisplay(s.citingText) : null, weak: part === 'refers' && step >= 2,
    }
    rows.push(r)
    return r
  }
  const call = async (node: string, kinds: OnwardKind[], limit: number, depth: number) => { walked++; return walk(node, { kinds, limit, depth }) }

  for (const c of clause) {
    if (!WALKED_RELATIONS.has(c.relation)) continue
    if (c.state !== 'held') {
      for (const part of ['depends', 'refers'] as const) notes.push({ from: c.i, part, line: `Not read: this provision is ${c.state === 'lookup-failed' ? 'one we could not look up' : 'not law we hold'}, so nothing is recorded against it here.` })
      continue
    }
    const target = c.provisionPath ? `${c.docUri}/${c.provisionPath}` : c.docUri

    // ── What depends on this (1): made-under, until it ends ──
    let frontier: Array<{ node: string; parent: number }> = [{ node: target, parent: c.i }]
    let step = 1
    const perStep: number[] = []
    let first: ReturnType<typeof counted> | null = null
    while (frontier.length && step <= WALK_LIMITS.madeUnderSafety) {
      const nextFrontier: typeof frontier = []
      let n = 0
      for (const f of frontier) {
        const res = await call(f.node, ['made-under'], WALK_LIMITS.perNode, step)
        if (step === 1) { caveat = res.freshness.caveat; first = counted(res, ['made-under']) }
        if (res.unaddressable && step === 1) notes.push({ from: c.i, part: 'depends', line: `Not walked: ${res.unaddressable.reason}.` })
        for (const s of res.rows) { const r = add(s, 'depends', step, f.parent); nextFrontier.push({ node: s.provision, parent: r.i }); n++ }
      }
      perStep.push(n)
      frontier = nextFrontier
      step++
    }
    const mu = first ?? { counted: 0, returned: 0, provision: 0, actWide: 0 }
    notes.push({
      from: c.i, part: 'depends',
      line: mu.counted
        ? `Made under it: ${plural(mu.counted, 'instrument')} at step 1 — ${mu.provision} name this provision, ${mu.actWide} only the Act as a whole${mu.returned < mu.counted ? ` (${mu.returned} shown)` : ''}; ${frontier.length ? `the walk was stopped at step ${WALK_LIMITS.madeUnderSafety} with ${frontier.length} still to walk` : `the walk ended after step ${perStep.filter((x) => x > 0).length}`}. ⚠ A procedural mention can be recorded as a power (GRAPH 8 §5): read the words.`
        : 'Made under it: nothing is recorded as made under this provision.',
    })

    // ── What depends on this (2): the official record, steps 1 and 2 ──
    const op1 = await call(target, OPERATION, WALK_LIMITS.perNode, 1)
    const op1Rows = op1.rows.map((s) => ({ s, r: add(s, 'depends', 1, c.i) }))
    const opNodes = [...new Map(op1Rows.map((x) => [x.s.provision, x])).values()]
    let op2 = 0
    if (!withheldAt(STRENGTH_OF.amends, 2)) {
      for (const x of opNodes.slice(0, WALK_LIMITS.step2From)) {
        const res = await call(x.s.provision, OPERATION, 20, 2)
        for (const s of res.rows) { add(s, 'depends', 2, x.r.i); op2++ }
      }
    }
    const opc = counted(op1, OPERATION)
    notes.push({
      from: c.i, part: 'depends',
      line: `The official record: ${plural(opc.counted, 'row')} operate on it at step 1${opc.returned < opc.counted ? ` (${opc.returned} shown)` : ''}; step 2 walked from ${Math.min(opNodes.length, WALK_LIMITS.step2From)} of ${opNodes.length} (${plural(op2, 'row')}). Not walked past step 2: measured, the official record reaches thousands of instruments by step 3 (GRAPH 8 §1).`,
    })

    // ── Provisions that refer to this — for review: step 1 with the words, step 2 weak, never step 3 ──
    const ref1 = await call(target, ['cites'], WALK_LIMITS.perNode, 1)
    const refRows = ref1.rows.map((s) => ({ s, r: add(s, 'refers', 1, c.i) }))
    const refNodes = [...new Map(refRows.map((x) => [x.s.provision, x])).values()]
    let ref2 = 0
    for (const x of refNodes.slice(0, WALK_LIMITS.step2From)) {
      const res = await call(x.s.provision, ['cites'], 10, 2)
      for (const s of res.rows) { add(s, 'refers', 2, x.r.i); ref2++ }
    }
    const rc = counted(ref1, ['cites'])
    notes.push({
      from: c.i, part: 'refers',
      line: rc.counted
        ? `${plural(rc.counted, 'reference')} at step 1 — ${rc.provision} name this provision, ${rc.actWide} only the Act as a whole${rc.returned < rc.counted ? ` (${rc.returned} shown)` : ''}; step 2, weak, from ${Math.min(refNodes.length, WALK_LIMITS.step2From)} of ${refNodes.length} (${plural(ref2, 'row')}). Never shown past step 2. The words are the stored window before each reference, cut at both ends. These are marked-up citations only: a mention in plain text is not here (GRAPH 8 §7.1).`
        : 'No marked-up citation of this provision is held. A mention in plain text would not be here (GRAPH 8 §7.1).',
    })
  }
  return { rows, notes, caveat, walked }
}
