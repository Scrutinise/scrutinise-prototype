// ─────────────────────────────────────────────────────────────────────────────
// 26-M — LEX SUGGESTS ONLY WHAT THE USER CAN DO NOW, AND WHAT IS SENSIBLE NOW.
//
// Charlie, 2 Oct: asked to search, Lex *"recommended a full re-run and a Deepening pass — the most expensive
// option, and one that cannot currently be reached."* Both are true statements about the product and both
// were wrong advice: the Deepening is locked until all four kernel sections are complete, and a full re-run
// (three credits, a whole new build) is the opposite of what someone halfway through the guiding policy
// needs. Lex had a static map of every control (platform-controls.ts) and no idea which were open.
//
// ⚠⚠ THE MAP SAYS WHERE CONTROLS ARE; THIS SAYS WHICH ARE OPEN. It is computed from the same canonical state
// the screen is drawn from, per turn, so "cannot be reached" is the screen's own fact and not Lex's guess.
//
// ⚠ A LIST OF PERMISSIONS, NOT PROHIBITIONS. The block names what Lex MAY suggest and states, with the reason,
// what it may not — the reason matters, because a bare "do not suggest the Deepening" gets worked around by a
// model that has been told the Deepening exists.
// ─────────────────────────────────────────────────────────────────────────────

import type { CanonicalState } from './page1-config'

export interface AvailabilityInput {
  state: Pick<CanonicalState, 'pages' | 'currentField'>
  /** Items added since the last comparison with the kernel (26-K). */
  pendingNewMaterial: number
}

/** The kernel is complete when every page is — the same test `CreateIdeaClient.kernelComplete` applies. */
export function kernelIsComplete(pages: Array<{ status: string }>): boolean {
  return pages.length > 0 && pages.every((p) => p.status === 'complete')
}

export function availableActionsBlock(input: AvailabilityInput): string {
  const { pages, currentField } = input.state
  const complete = kernelIsComplete(pages)
  const unfinished = pages.filter((p) => p.status !== 'complete')
  const here = pages.find((p) => p.status === 'active') ?? unfinished[0] ?? null

  const lines: string[] = [
    'WHAT YOU MAY SUGGEST RIGHT NOW — computed from the screen the user is on. Suggest ONLY from the first list.',
    '',
    'ALWAYS AVAILABLE, and the right first answer to most requests:',
    '- Talking it through with you, here.',
    '- Searching the corpus: you can do it from this chat — the platform runs it when asked and gives you the results.',
    '- Adding a document or a link with "Add a file or link" above the box, or pasting a link into a message.',
    '- Their private Notes (the second tab beside this chat).',
  ]
  if (input.pendingNewMaterial > 0) {
    lines.push(`- Comparing the ${input.pendingNewMaterial} item${input.pendingNewMaterial === 1 ? '' : 's'} added since the last comparison with the kernel (cheap — about 2p).`)
  }

  lines.push('', 'NOT AVAILABLE OR NOT SENSIBLE RIGHT NOW — do not suggest these, and if asked, say why:')
  if (!complete) {
    const names = unfinished.map((p) => p.label).join(', ')
    lines.push(
      `- THE DEEPENING (further research passes): LOCKED. It opens only when all four kernel sections are complete, and ${names || 'the kernel'} ${unfinished.length === 1 ? 'is' : 'are'} not. Never recommend a Deepening pass now.`,
      `- A FULL RE-RUN of the build: not sensible while the user is part-way through the kernel${here ? ` (they are in ${here.label}${currentField ? `, on "${currentField.key}"` : ''})` : ''}. It costs three of their credits and starts the whole draft again, which is the opposite of what someone mid-way needs. Mention it only if they ask for a fresh start.`,
    )
  } else {
    lines.push(
      '- A full re-run of the build is the most expensive option (three credits). Suggest it ONLY if the user says the whole approach is wrong; a comparison or a Deepening pass is nearly always the better first step.',
    )
  }

  if (complete) {
    lines.splice(lines.indexOf('- Their private Notes (the second tab beside this chat).') + 1, 0,
      '- The Deepening: the kernel is complete, so the passes are open. Offer one only when it answers what the user has just said.')
  }
  lines.push('',
    'A search is never a reason to send the user anywhere. If they ask you to look something up, the answer is to search, not to point them at a stage.')
  return lines.join('\n')
}
