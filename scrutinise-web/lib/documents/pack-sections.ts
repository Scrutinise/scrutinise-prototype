// ─────────────────────────────────────────────────────────────────────────────
// 26-T2 — SECTIONS SHARED BY THE ACTIONS PACK AND THE BACKGROUND REPORT: "Incentives" (decision 152, §3c) and "Considered, not taken" (decision
// 150, §5c). One copy, so the two documents cannot say different things about the same implementer or the same rejected idea.
//
// ⚠ NOTHING HERE GENERATES CONTENT. The incentives paragraphs come from the step-2 slots through `lib/lex/incentive-map.ts` (the unanswered is
// shown as unanswered); "considered, not taken" is what the notebook and the action list already hold, each with its reason and date.
// ─────────────────────────────────────────────────────────────────────────────

import type { Block, Run } from './model'
import type { ActionsPackData, PackAction, PackSetAside } from './actions-pack-types'
import { buildIncentiveMap, incentiveAnnexe, type MapSource } from '@/lib/lex/incentive-map'

export const text = (s: string): Run[] => [{ text: s }]

/** A paragraph that carries its own number, so a reviewer can say "B.3.6 is wrong" on paper or by email. */
export const numbered = (label: string, runs: Run[]): Block => ({ kind: 'paragraph', runs: [{ text: `${label}  `, bold: true }, ...runs] })

/** A, B, … Z, AA, AB … */
export function letterFor(i: number): string {
  let n = i, s = ''
  do { s = String.fromCharCode(65 + (n % 26)) + s; n = Math.floor(n / 26) - 1 } while (n >= 0)
  return s
}

/** The step-2 data an action carries, in the form the incentive map reads. Only what the owner wrote or accepted (the pack never holds a proposal). */
export function toMapSource(a: PackAction): MapSource {
  const inc = a.slots.incentiveNow, chg = a.slots.whatChangesIt
  return {
    id: a.id, number: a.number, title: a.title, practicalStep: a.statement, whoImplements: a.slots.who?.text ?? null,
    record: {
      ...(inc ? { incentiveNow: { text: inc.text, by: 'USER', at: '', direction: inc.direction ?? null } } : {}),
      ...(chg ? { whatChangesIt: { text: chg.text, by: 'USER', at: '', linkActionId: chg.linkActionId ?? null } } : {}),
    },
  }
}

/** "Incentives": one numbered paragraph per implementer (INC.1, INC.2 …). */
export function incentiveBlocks(actions: PackAction[], prefix = 'INC'): Block[] {
  if (!actions.length) return [{ kind: 'note', text: 'No actions are in this printing, so there are no incentives to read.' }]
  const rows = buildIncentiveMap(actions.map(toMapSource))
  const blocks: Block[] = [{
    kind: 'note',
    text: 'One paragraph per implementer, read from what is recorded on each action (Who, Incentive now, What changes it). Where an answer is missing it is shown as missing. An action that names two implementers shows the same answer under both, because the record holds one answer for the action.',
  }]
  incentiveAnnexe(rows).forEach((p, i) => blocks.push(numbered(`${prefix}.${i + 1}`, [{ text: p.implementer, bold: true }, { text: ` — ${p.text}` }])))
  return blocks
}

const dateWords = (iso: string | null): string => {
  if (!iso) return 'date not recorded'
  const d = new Date(iso)
  return Number.isNaN(d.getTime()) ? 'date not recorded' : d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' })
}
export { dateWords }

/** "Considered, not taken": ruled-out actions (under the headings printed) and the notebook's set-aside notes, findings and policy options, each with its reason and date. */
export function notTakenBlocks(data: ActionsPackData, opts: { headingIds?: Set<string | null>; includeNotebook: boolean; prefix?: string }): Block[] {
  const prefix = opts.prefix ?? 'NOT'
  const blocks: Block[] = [{
    kind: 'note',
    text: 'What was considered and not taken is nearly as useful to a reviewer as what was kept. Each entry gives the reason it was set aside and when the record last changed. Nothing here has been deleted.',
  }]
  let n = 0
  const ruled = data.ruledOut.filter((r) => !opts.headingIds || opts.headingIds.has(r.headingId))
  if (ruled.length) {
    blocks.push({ kind: 'heading', level: 2, runs: text('Actions ruled out') })
    for (const r of ruled) {
      n++
      blocks.push(numbered(`${prefix}.${n}`, [
        { text: `#${r.number}${r.title ? ` ${r.title}` : ''}: `, bold: true }, { text: r.statement },
        { text: ` — ruled out${r.reason ? `: ${r.reason}` : ' (no reason was recorded)'} (last changed ${dateWords(r.lastChanged)}).`, italic: true },
      ]))
    }
  }
  if (opts.includeNotebook) {
    const groups: Array<[PackSetAside['kind'], string]> = [['POLICY_OPTION', 'Policy options ruled out'], ['NOTE', 'Notes set aside'], ['FINDING', 'Findings set aside or dismissed']]
    for (const [kind, label] of groups) {
      const items = data.setAside.filter((s) => s.kind === kind)
      if (!items.length) continue
      blocks.push({ kind: 'heading', level: 2, runs: text(label) })
      for (const s of items) {
        n++
        blocks.push(numbered(`${prefix}.${n}`, [
          { text: s.text.length > 600 ? `${s.text.slice(0, 599)}…` : s.text }, ...(s.ref != null ? [{ text: ` [Ref: ${s.ref}]` }] : []),
          { text: ` — ${s.reason ? s.reason : 'no reason was recorded'} (${dateWords(s.at)}).`, italic: true },
        ]))
      }
    }
  }
  if (n === 0) blocks.push({ kind: 'paragraph', runs: text('Nothing has been ruled out or set aside yet.') })
  return blocks
}
