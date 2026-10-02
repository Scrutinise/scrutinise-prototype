// 26-P §4b — HONESTY, IN CODE.
//
//   "Lex may describe an action in the past tense ONLY when a tool result in that turn confirms it —
//    checked before the reply is shown. A failed tool is reported with its reason; Lex never invents one.
//    Lex names only controls in the controls source."
//
// ⚠⚠ THIS FILE IS PURE: text and tool outcomes in, verdict out. It calls nothing, reads no database and
// does not import a model, which is what lets `check:lex-26p` replay the real failure transcripts through
// the REAL function (CLAUDE.md §25.3 — import the function under test; never re-implement it in a check).
//
// WHAT IT CATCHES, each from this week's transcripts (BRIEF_26P §9):
//   • "you should see it added now" with no add          → §9-4   (claim without a confirming tool)
//   • "I've edited it" when the edit is waiting on a button → §9-12 (pending is NOT done)
//   • "I've filed all three" when one link was refused      → §9-1   (a total the results do not support)
//   • "click the 'Redraft from what I found' button"        → §9-5   (a control not on the controls source)
//
// ⚠ IT ERRS TOWARD FLAGGING. A flagged sentence costs one corrective retry; an unflagged false claim is
// the failure this sprint exists to end. The retry names the discrepancy, so a correct reply that was
// flagged by mistake is repaired in one call, not lost.

export type ToolCategory = 'file' | 'draft' | 'change' | 'run' | 'search' | 'see' | 'explain'

export interface ToolOutcome {
  name: string
  category: ToolCategory
  /** The tool ran and did what it says. FALSE for a failure AND for `pending` (waiting on a button). */
  ok: boolean
  /** Returned a confirmation token: nothing has happened yet. */
  pending?: boolean
  /** Per-item results for a tool that handles several (file_url): used to test "all three". */
  items?: Array<{ ok: boolean; label?: string }>
}

export interface Violation {
  kind: 'unconfirmed-claim' | 'pending-claimed-done' | 'overstated-total' | 'unknown-control' | 'phantom-pending'
  sentence: string
  detail: string
}

// ── sentence handling ─────────────────────────────────────────────────────────────────────────

export function splitSentences(text: string): string[] {
  // Keep list bullets and paragraph breaks as sentence boundaries too: a claim in a bullet is a claim.
  return text
    .split(/(?<=[.!?])\s+(?=[A-Z“"‘'(\[])|\n+/)
    .map((s) => s.trim())
    .filter(Boolean)
}

// A sentence that is NOT asserting something happened: a question, a refusal, a plan, a condition.
const NOT_A_CLAIM = /\?\s*$|\b(?:haven[’']?t|hasn[’']?t|have not|has not|did not|didn[’']?t|can[’']?t|cannot|couldn[’']?t|could not|unable|won[’']?t|will not|wasn[’']?t|was not|weren[’']?t|nothing (?:was|has|had)|not yet|no (?:link|file|document|source)s? (?:was|were|has|have)|if you(?:[’']d)? like|shall I|would you like|want me to|I(?:[’']ll| will| can| could| would| might)|once you|when you|after you|waiting (?:for|on) you|ready for you to|needs? (?:your|you to)|press (?:the )?(?:confirm|button)|confirm (?:it|this|below))\b/i

type Claim = { category: ToolCategory[]; label: string }

// Past-tense / completed-state phrasings. First-person OR passive — never a bare verb ("file it" is an
// instruction, not a claim). Each maps to the tool categories whose SUCCESS would make it true.
const CLAIMS: Array<{ re: RegExp; tools: string[]; label: string }> = [
  { re: /\b(?:I(?:[’']ve| have)?|we(?:[’']ve| have)?)\s+(?:\w+ly\s+|now\s+)*(?:filed|attached|uploaded|logged)\b|\b(?:has|have|was|were|is|are)\s+(?:\w+ly\s+|now\s+|been\s+|also\s+|just\s+)*(?:filed|attached|uploaded)\b|\bfiled (?:it|them|that|both|all|the)\b/i,
    tools: ['file_url', 'file_text'], label: 'filed something' },
  { re: /\b(?:I(?:[’']ve| have)?|we(?:[’']ve| have)?)\s+(?:\w+ly\s+|now\s+)*added\b|\b(?:has|have|was|were|is|are)\s+(?:\w+ly\s+|now\s+|been\s+|also\s+|just\s+)*added\b|\badded (?:it|them|that|this|both|all|the|a|an)\b|\bnow (?:added|in your sources|on your list)\b/i,
    tools: ['file_url', 'file_text', 'add_candidate', 'add_action', 'write_note', 'draft_field'], label: 'added something' },
  { re: /\byou(?:[’']ll| will| should| can| ought to)\s+(?:now\s+)?(?:see|find)\b[^.?!]{0,60}\b(?:added|there|in (?:your|the)|appear|listed|filed|saved)\b/i,
    tools: ['file_url', 'file_text', 'add_candidate', 'add_action', 'write_note', 'draft_field'], label: 'said the user will now see it' },
  { re: /\b(?:I(?:[’']ve| have)?)\s+(?:now\s+)?(?:drafted|written|put (?:that|it|this) in|put together|composed|proposed)\b|\b(?:has|have|was|were) (?:now |been )?drafted\b|\bdrafted (?:it|that|this|a|the)\b/i,
    tools: ['draft_field', 'add_candidate', 'add_action', 'write_note'], label: 'drafted something' },
  // ⚠ "noted" is deliberately NOT here: "I've noted your point" is conversation, not a write, and flagging it
  // would repair correct replies. A claim of SAVING is what a write has to back.
  { re: /\b(?:I(?:[’']ve| have)?)\s+(?:now\s+)?(?:saved|recorded|stored)\b|\b(?:has|have|was|were|is|are) (?:now |been )?(?:saved|recorded|stored)\b/i,
    tools: ['file_url', 'file_text', 'draft_field', 'add_candidate', 'add_action', 'write_note'], label: 'saved something' },
  { re: /\b(?:I(?:[’']ve| have)?)\s+(?:now\s+)?(?:edited|changed|updated|rewritten|rewrote|reworded|replaced|amended)\b|\b(?:has|have|was|were) (?:now |been )?(?:edited|changed|updated|rewritten|reworded|replaced|amended)\b/i,
    tools: ['edit_field'], label: 'edited something' },
  { re: /\b(?:I(?:[’']ve| have)?)\s+(?:now\s+)?(?:accepted|approved|confirmed|chosen|settled)\b|\b(?:has|have|was|were) (?:now |been )?(?:accepted|approved|chosen|settled)\b/i,
    tools: ['accept_field', 'choose_policy'], label: 'accepted something' },
  { re: /\b(?:I(?:[’']ve| have)?)\s+(?:now\s+)?(?:ruled out|rejected|restored|merged|moved|archived|dismissed|removed|skipped|reopened|un-?chosen)\b|\b(?:has|have|was|were) (?:now |been )?(?:ruled out|rejected|restored|merged|moved|archived|dismissed|removed|skipped|reopened)\b/i,
    tools: ['rule_out_candidate', 'restore_candidate', 'merge_candidates', 'move_to_actions', 'archive_source', 'dismiss_proposal', 'skip_field', 'reopen_field', 'unchoose_policy'], label: 'changed or removed something' },
  { re: /\b(?:I(?:[’']ve| have)?)\s+(?:now\s+)?(?:run|ran|started|kicked off|completed)\b[^.?!]{0,50}\b(?:comparison|gap check|consolidation|build|re-?run|check|pass)\b|\bthe (?:comparison|gap check|consolidation|re-?run) (?:has |have )?(?:been )?(?:run|completed|finished|done)\b/i,
    tools: ['run_comparison', 'run_gap_check', 'run_consolidation', 'rerun_build'], label: 'ran a process' },
  { re: /\b(?:I(?:[’']ve| have)?)\s+(?:now\s+)?(?:searched|looked (?:up|through|in)|checked the (?:corpus|web))\b|\bmy search (?:found|returned|turned up)\b|\b(?:the )?search (?:found|returned|turned up)\b/i,
    tools: ['search_corpus', 'search_web', 'search_my_documents'], label: 'ran a search' },
]

export function claimsIn(sentence: string): Array<{ tools: string[]; label: string }> {
  if (NOT_A_CLAIM.test(sentence)) return []
  return CLAIMS.filter((c) => c.re.test(sentence)).map(({ tools, label }) => ({ tools, label }))
}

const TOTAL_WORD = /\b(?:all|both|each|every|all (?:two|three|four|five|six)|the (?:two|three|four|five|six) (?:links|files|sources|documents))\b/i

// ── the controls check ────────────────────────────────────────────────────────────────────────

const CONTROL_CUE = /\b(?:button|click|press|tap|tab|panel|menu|toggle|select|choose|dropdown|box|checkbox|link|switch|titled|labelled|labeled|called|screen|section|option|options|use the|under|go to|stage)\b/i
// ⚠ A single quote counts as a quotation mark only when it is not inside a word — otherwise "wasn't … you'll"
// pairs the two apostrophes and reads a stretch of ordinary prose as a control name.
const QUOTED = /(?<![A-Za-z])[“"‘']([^“”"‘’']{3,60})[”"’'](?![A-Za-z])/g
const NAMED_CONTROL = /\bthe\s+((?:[A-Z][\w’'-]*\s*){1,6}?)\s+(?:button|tab|panel|toggle|link|menu|dropdown|checkbox)\b/g

export const normaliseLabel = (s: string) => s.toLowerCase().replace(/[^a-z0-9 ]+/g, ' ').replace(/\s+/g, ' ').trim()

export function controlsNamedIn(sentence: string): string[] {
  const out: string[] = []
  if (CONTROL_CUE.test(sentence)) {
    for (const m of sentence.matchAll(QUOTED)) {
      if (m[1].trim().split(/\s+/).length <= 8) out.push(m[1].trim())
    }
  }
  for (const m of sentence.matchAll(NAMED_CONTROL)) out.push(m[1].trim())
  return out
}

// ── the check ─────────────────────────────────────────────────────────────────────────────────

/**
 * ⚠ THE MIRROR OF `pending-claimed-done`, FOUND LIVE ON 2 OCT. Asked to rule a candidate out, the model
 * called NO tool and wrote "Ruling out candidate 1 is waiting for you to confirm." There was no button and
 * nothing waiting: a user would have looked for a card that did not exist. A claim that something is
 * waiting on the confirm button is true only if a tool returned one this turn, or one from an earlier turn
 * is still live on screen.
 */
const WAITING_ON_BUTTON = /\bwaiting for you to confirm\b|\bawait(?:s|ing) your (?:confirmation|approval)\b|\bconfirm button\b|\bpress(?:ing)? (?:its |the |that )?confirm\b|\bneeds? your confirmation\b|\bfor you to confirm\b/i

export interface CheckInput {
  reply: string
  outcomes: ToolOutcome[]
  /** A confirmation from an EARLIER turn is still live on the user's screen, so "waiting for you" can be true without a tool this turn. */
  priorPending?: boolean
  /** normaliseLabel()'d. Labels on the controls source, plus field labels and stage names. */
  knownLabels: ReadonlySet<string>
  /** What the user said this turn: a control the USER named is allowed to be echoed back. */
  userMessage?: string
}

export function checkReply(input: CheckInput): Violation[] {
  const { reply, outcomes, knownLabels } = input
  const violations: Violation[] = []
  const okNames = new Set(outcomes.filter((o) => o.ok).map((o) => o.name))
  const pendingNames = new Set(outcomes.filter((o) => o.pending).map((o) => o.name))
  const userNorm = normaliseLabel(input.userMessage ?? '')

  const anyPending = outcomes.some((o) => o.pending) || !!input.priorPending

  for (const sentence of splitSentences(reply)) {
    if (!anyPending && WAITING_ON_BUTTON.test(sentence) && !/\?\s*$/.test(sentence) && !/\b(?:I(?:[’']ll| will| can| could| would)|once|if|when|until)\b/i.test(sentence)) {
      violations.push({ kind: 'phantom-pending', sentence, detail: 'says something is waiting for the user to press a confirm button, but no tool returned a confirmation this turn and none from an earlier turn is on screen — if you want to propose the action, call the tool so the button exists; otherwise do not say it is waiting' })
    }
    const claims = claimsIn(sentence)
    for (const c of claims) {
      const satisfied = c.tools.some((t) => okNames.has(t))
      if (satisfied) continue
      const wasPending = c.tools.some((t) => pendingNames.has(t))
      violations.push(wasPending
        ? { kind: 'pending-claimed-done', sentence, detail: `${c.label}, but that action is waiting for the user to press the confirm button — nothing has happened yet` }
        : { kind: 'unconfirmed-claim', sentence, detail: `${c.label}, but no tool this turn confirms it (${c.tools.join(' / ')})` })
    }

    // "all three filed" — a total the per-item results do not support. Only checked where the filing
    // tool DID run, because otherwise the unconfirmed-claim above already covers it.
    if (claims.some((c) => c.label === 'filed something' || c.label === 'added something') && TOTAL_WORD.test(sentence)) {
      const fileRuns = outcomes.filter((o) => (o.name === 'file_url' || o.name === 'file_text') && o.items)
      const unfiled = fileRuns.flatMap((o) => o.items!).filter((i) => !i.ok)
      if (unfiled.length) {
        violations.push({
          kind: 'overstated-total', sentence,
          detail: `says all were filed, but ${unfiled.length} was not (${unfiled.map((i) => i.label ?? 'one item').join('; ')}) — each unfiled one must be reported with its real reason`,
        })
      }
    }

    for (const label of controlsNamedIn(sentence)) {
      const n = normaliseLabel(label)
      if (!n) continue
      if (knownLabels.has(n)) continue
      if (userNorm && userNorm.includes(n)) continue
      violations.push({
        kind: 'unknown-control', sentence,
        detail: `names “${label}”, which is not a control on the controls source — name only controls you were given, or say you are not sure what it is called`,
      })
    }
  }
  return violations
}

/** The note handed back to the model for the one corrective retry. */
export function correctionMessage(violations: Violation[]): string {
  return [
    'Your reply was NOT shown. The platform checked it against this turn\'s tool results and found:',
    ...violations.map((v, i) => `${i + 1}. "${v.sentence}" — ${v.detail}.`),
    'Write the reply again. Describe an action in the past tense ONLY if a tool result in this turn says it succeeded. '
    + 'If an action is waiting on a confirm button, say it is waiting, not done. If something failed, say so with the tool\'s own reason. '
    + 'Do not mention this check.',
  ].join('\n')
}

/**
 * The last resort when the retry still fails: drop the offending sentences and say plainly what is true.
 * ⚠ It never rewrites a claim into a different claim — it removes it and adds a platform sentence.
 */
export function stripViolations(reply: string, violations: Violation[], outcomes: ToolOutcome[]): string {
  const bad = new Set(violations.map((v) => v.sentence))
  const kept = splitSentences(reply).filter((s) => !bad.has(s)).join(' ').trim()
  const anyChange = outcomes.some((o) => o.ok && (o.category === 'file' || o.category === 'draft' || o.category === 'change' || o.category === 'run'))
  const pending = outcomes.some((o) => o.pending)
  const note = pending
    ? 'Nothing has been changed yet — what I proposed is waiting for you to press its confirm button.'
    : anyChange
      ? 'I removed part of that reply because I could not confirm it; the record of what was actually done this turn is in the action list.'
      : 'Nothing was changed on your idea this turn.'
  return [kept, note].filter(Boolean).join('\n\n')
}
