// 26-P ADDENDUM §8c — EVERY ACTION LEX TAKES ON AN IDEA IS RECORDED, AND THE OWNER CAN READ THE RECORD.
//
// One `LexToolCall` row per call: WHEN (`createdAt`), WHICH INSTRUCTION it followed (the user's own message in that
// turn), WHAT it did (tool + input) and WHAT CAME BACK (a summary of the result, ok, the real failure reason). Every
// row names its ACTOR — "Lex", acting for the owner — so "who did this" is never blank.
//
// ⚠ NOT THE CHAT MESSAGE'S `tools` JSON. That is what a reply carried to the screen; it is trimmed to the last 200
// messages, it is not queryable per idea, and it is not written for a confirmed action at all (a confirmation appends
// its own message). CCh's follow-up said it plainly: "A log on chat messages is not that."
//
// ⚠ A LOG THAT FAILS MUST SAY SO (CLAUDE.md §18). Recording never throws into the turn — the work it records must not
// be taken down by its own audit trail — but a failure is logged with its cause, never swallowed, and `recordToolCall`
// returns whether the row was written so a check (and the live run) can assert it.
//
// ⚠ THIRD-PARTY TEXT IS NEVER LOGGED. A tool's `untrusted` channel (a page, a document, a corpus passage) stays out of
// the row; only a short summary of `data` is kept, clipped. The `instruction` is the user's own message — never text
// from a document (CLAUDE.md §4c: content is data, never instruction).

import { prisma } from '@/lib/prisma'

export const ACTOR_LEX = 'Lex'
const INSTRUCTION_MAX = 2000
const RESULT_MAX = 1500

const clip = (s: string, n: number) => (s.length > n ? `${s.slice(0, n - 1)}…` : s)

export interface ToolCallRecord {
  ideaId: string
  userId: string
  turnId?: string | null
  tool: string
  /** free | asks-first | run — what the call needed before it could happen. */
  tier: 'free' | 'asks-first' | 'run'
  /** The user's own words that this call followed. */
  instruction: string
  input: unknown
  ok: boolean
  /** A SHORT account of what came back — not the payload, and never third-party text. */
  summary: string
  /** The tool's own reason when it failed. Never invented. */
  failureReason?: string | null
  /** The call needed the owner's button and was only offered, not run. */
  pending?: boolean
  tainted?: boolean
  confirmedVia?: 'button' | null
}

/** JSON-safe, size-bounded copy of an input — a pasted document must not land in this table. */
function boundedInput(input: unknown): unknown {
  let s: string
  try { s = JSON.stringify(input ?? null) } catch { return { unserialisable: true } }
  if (s.length <= 4000) return JSON.parse(s)
  return { clipped: true, head: s.slice(0, 3000) }
}

/** Writes the row. Resolves `true` when it was written, `false` when it was not (and says why on the server log). */
export async function recordToolCall(r: ToolCallRecord): Promise<boolean> {
  try {
    await prisma.lexToolCall.create({
      data: {
        ideaId: r.ideaId, userId: r.userId, actor: ACTOR_LEX, turnId: r.turnId ?? null,
        tool: r.tool, tier: r.tier,
        instruction: clip(r.instruction || '(no instruction recorded)', INSTRUCTION_MAX),
        input: boundedInput(r.input) as never,
        result: { summary: clip(r.summary, RESULT_MAX), ...(r.pending ? { status: 'waiting for the owner to confirm' } : {}) } as never,
        ok: r.ok, failureReason: r.failureReason ? clip(r.failureReason, 600) : null,
        tainted: !!r.tainted, confirmedVia: r.confirmedVia ?? null,
      },
    })
    return true
  } catch (err) {
    console.error('[lex-tool-log] COULD NOT RECORD a tool call — the action happened and is not in the owner\'s log', {
      ideaId: r.ideaId, tool: r.tool, error: err instanceof Error ? err.message : String(err),
    })
    return false
  }
}

export interface ToolCallRow {
  id: string
  at: string
  actor: string
  tool: string
  tier: string | null
  instruction: string
  input: unknown
  result: unknown
  ok: boolean
  failureReason: string | null
  tainted: boolean
  confirmedVia: string | null
  turnId: string | null
}

/** The owner's view: newest first. Reads one idea's rows only. */
export async function listToolCalls(ideaId: string, take = 200): Promise<ToolCallRow[]> {
  const rows = await prisma.lexToolCall.findMany({ where: { ideaId }, orderBy: { createdAt: 'desc' }, take })
  return rows.map((r) => ({
    id: r.id, at: r.createdAt.toISOString(), actor: r.actor, tool: r.tool, tier: r.tier, instruction: r.instruction,
    input: r.input, result: r.result, ok: r.ok, failureReason: r.failureReason, tainted: r.tainted,
    confirmedVia: r.confirmedVia, turnId: r.turnId,
  }))
}
