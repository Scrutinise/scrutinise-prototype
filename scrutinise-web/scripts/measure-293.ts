// ─────────────────────────────────────────────────────────────────────────────
// 293 (CCh-Lex 28 Oct (5)) — measure, on a SCRATCH copy of 452c5ade carrying Charlie's real conversation, what a typical turn costs:
//   A · today: the tools + system prompt cached for 5 minutes
//   B · the same prefix cached for 1 hour
//   C · 5-minute cache, offering only the tools for the actions step the idea is on (and the tools every step uses)
// Each arm is two read-only turns 6 minutes apart (Charlie's turns are mostly further apart than 5 minutes), and each arm starts
// 6 minutes after the last, so no arm reads another's cache. Prints each turn's pence and token split; writes JSON to --out.
// Real spend: about 6 turns of ≈10–15p. Never touches a live idea.
//
//   npx tsx --tsconfig tsconfig.json --env-file=.env scripts/measure-293.ts [--out <file>] [--gap-min 6]
// ─────────────────────────────────────────────────────────────────────────────

import { writeFileSync } from 'node:fs'
import { prisma } from '../lib/prisma'
import { handleAgentTurn } from '../lib/lex/agent/turn'
import type { ChatMsg } from '../lib/lex/agent/loop'
import { enterPurpose } from '../lib/lex/build-context'
import { scratchCopy, deleteScratch } from './lib/scratch-copy'

const SOURCE = '452c5ade-3153-400a-bf48-3b71aaa52773'
const arg = (k: string) => (process.argv.includes(k) ? process.argv[process.argv.indexOf(k) + 1] : null)
const OUT = arg('--out')
const GAP_MS = Number(arg('--gap-min') ?? 6) * 60_000

/** Tools that belong to ONE place on the screen; everything not listed here is offered everywhere. */
const ONLY_IN: Record<string, string[]> = {
  'actions-1': ['title_actions', 'classify_actions', 'suggest_action_headings', 'create_action_heading', 'assign_action_heading', 'group_actions', 'find_action_duplicates', 'causes_without_action', 'compare_actions', 'park_actions', 'restore_actions', 'rule_out_actions', 'merge_actions', 'test_actions_against_policy', 'conditions_coverage', 'propose_condition', 'import_actions_from_source', 'run_gap_check'],
  'actions-2': ['set_action_slot', 'propose_action_slots', 'set_action_facets'],
  'actions-4': ['set_action_order'],
  policy: ['add_candidate', 'rule_out_candidate', 'restore_candidate', 'merge_candidates', 'choose_policy', 'unchoose_policy', 'move_to_actions', 'run_comparison', 'run_consolidation'],
  kernel: ['draft_field', 'accept_field', 'edit_field', 'dismiss_proposal', 'skip_field', 'reopen_field', 'rerun_build'],
  notebook: ['add_research_note', 'list_research_notebook', 'extract_quotes', 'suggest_tags_and_links', 'update_research_note', 'find_similar_notes', 'find_disagreements', 'what_have_i_read_on', 'summarise_source'],
}
const placeOf = new Map(Object.entries(ONLY_IN).flatMap(([p, names]) => names.map((n) => [n, p] as const)))
export const stepFilter = (place: string) => (name: string) => { const p = placeOf.get(name); return !p || p === place }

const QUESTIONS = ['In two sentences, what is action #59 for?', 'Which of my live actions do not yet say who implements them? Just the numbers.']

type Turn = { arm: string; turn: number; at: string; pence: number; calls: number; cacheWrite: number; cacheRead: number; uncached: number; out: number; tools: string[] }

async function main() {
  enterPurpose('measurement')
  const copy = await scratchCopy(SOURCE, '293')
  const results: Turn[] = []
  try {
    const src = (await prisma.idea.findUnique({ where: { id: SOURCE }, select: { aiChatHistory: true, actionsStep: true } }))!
    await prisma.idea.update({ where: { id: copy.id }, data: { aiChatHistory: src.aiChatHistory as never } })
    const place = `actions-${src.actionsStep ?? 1}`
    console.log(`scratch ${copy.id.slice(0, 8)}; the idea is on ${place}; gap ${GAP_MS / 60000} min`)
    const arms: Array<{ arm: string; prefixCacheTtl: '5m' | '1h'; toolFilter?: (n: string) => boolean }> = [
      { arm: 'A 5-minute cache', prefixCacheTtl: '5m' },
      { arm: 'B 1-hour cache', prefixCacheTtl: '1h' },
      { arm: `C only ${place}'s tools`, prefixCacheTtl: '5m', toolFilter: stepFilter(place) },
    ]
    let first = true
    for (const a of arms) {
      for (let t = 0; t < QUESTIONS.length; t++) {
        if (!first) { console.log(`  … waiting ${GAP_MS / 60000} min`); await new Promise((r) => setTimeout(r, GAP_MS)) }
        first = false
        const idea = await prisma.idea.findUniqueOrThrow({ where: { id: copy.id }, select: { id: true, creatorId: true, aiChatHistory: true } })
        const r = await handleAgentTurn({
          ideaId: copy.id, user: { id: copy.userId }, idea, message: QUESTIONS[t], clientTurnId: `measure293-${a.arm[0]}${t}-${Date.now()}`,
          ui: { stage: 'strategy' }, prefixCacheTtl: a.prefixCacheTtl, toolFilter: a.toolFilter,
        })
        const c = r.result?.cost
        const row: Turn = { arm: a.arm, turn: t + 1, at: new Date().toISOString(), pence: Number((c?.pence ?? 0).toFixed(2)), calls: c?.calls ?? 0, cacheWrite: c?.tokensCacheWrite ?? 0, cacheRead: c?.tokensCacheRead ?? 0, uncached: c?.tokensIn ?? 0, out: c?.tokensOut ?? 0, tools: (r.result?.toolLog ?? []).map((x) => x.name) }
        results.push(row)
        console.log(`  ${row.arm} · turn ${row.turn}: ${row.pence}p · ${row.calls} calls · cache write ${row.cacheWrite} · read ${row.cacheRead} · uncached ${row.uncached} · out ${row.out} · tools ${row.tools.join(',') || '-'}`)
      }
    }
  } finally {
    await deleteScratch(copy.id)
    if (OUT) writeFileSync(OUT, JSON.stringify(results, null, 2))
  }
  for (const arm of [...new Set(results.map((r) => r.arm))]) {
    const rs = results.filter((r) => r.arm === arm)
    console.log(`${arm}: ${rs.map((r) => `${r.pence}p`).join(' + ')} = ${rs.reduce((s, r) => s + r.pence, 0).toFixed(2)}p; the second turn (after the gap): ${rs[1]?.pence ?? '-'}p`)
  }
}
main().finally(() => prisma.$disconnect())
