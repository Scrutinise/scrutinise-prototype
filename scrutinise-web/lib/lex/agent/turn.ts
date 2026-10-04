// 26-P — THE SERVER SIDE OF ONE TURN AND OF ONE CONFIRMATION. Everything that touches the chat history
// and the request lives here, so the old route's delegate, the confirm route and the replay harness all
// run the SAME code (CLAUDE.md §25.3 — import the function under test, never re-implement it).

import { prisma } from '@/lib/prisma'
import { computeCanonicalState } from '@/lib/lex/state'
import { CHAT_MESSAGE_LIMIT, MIN_PASTE_CHARS } from '@/lib/lex/chat-material'
import { recordSpend } from '@/lib/lex/spend-ledger'
import { verifyConfirm } from './confirm-token'
import { recordToolCall } from './tool-log'
import { runAgentTurn, olderHistory, priceUsage, type ChatMsg, type AgentTurnResult } from './loop'
import { execute, toolByName } from './tools'
import type { ToolCtx, UiEffect, PendingConfirmation, UndoOffer } from './types'
import type { UiContext } from './snapshot'
import Anthropic from '@anthropic-ai/sdk'

/** Messages kept per idea. The model sees only the last window; older ones are summarised (§8a), not dropped. */
const KEEP_MESSAGES = 200
const SUMMARY_MODEL = 'claude-haiku-4-5'
const SUMMARY_MARK = /^\[\[through:(\d+)\]\]\n/

export interface AgentHttpResult { status: number; body: Record<string, unknown> }

type Owner = { id: string; email?: string | null }
type IdeaRow = { id: string; creatorId: string; aiChatHistory: unknown }

/** §3a — the OWNER, not "owner or collaborator" as `authorizeIdea` admits. A collaborator's Lex cannot act on the owner's idea. */
export function isOwner(user: Owner, idea: { creatorId: string }): boolean {
  return idea.creatorId === user.id
}

const asHistory = (v: unknown): ChatMsg[] => (Array.isArray(v) ? (v as ChatMsg[]) : [])

// ── memory (§8a) ──────────────────────────────────────────────────────────────────────────────

async function readSummary(ideaId: string): Promise<{ text: string | null; through: number }> {
  const row = await prisma.idea.findUnique({ where: { id: ideaId }, select: { aiChatSummary: true } })
  const raw = row?.aiChatSummary ?? ''
  const m = raw.match(SUMMARY_MARK)
  return m ? { text: raw.slice(m[0].length), through: Number(m[1]) } : { text: raw || null, through: 0 }
}

/**
 * Summarise everything before the window, incrementally: the existing summary plus the newly-aged
 * messages. ⚠ Runs only when at least 10 messages have aged out since the last summary, so it is a rare,
 * small call (Haiku) rather than a per-turn cost — and its cost is on the ledger like every other.
 */
async function maybeSummarise(ideaId: string, userId: string, history: ChatMsg[], client?: Anthropic): Promise<{ text: string | null; through: number }> {
  const prior = await readSummary(ideaId)
  const aged = olderHistory(history)
  if (aged.length - prior.through < 10) return prior
  try {
    const fresh = aged.slice(prior.through).map((m) => `${m.role === 'user' ? 'USER' : 'LEX'}: ${String(m.content ?? '').slice(0, 1500)}`).join('\n')
    const c = client ?? new Anthropic({ timeout: 60_000, maxRetries: 1 })
    const res = await c.messages.create({
      model: SUMMARY_MODEL, max_tokens: 900,
      system: 'You compress a conversation between a user and Lex (an assistant on a policy platform) into notes Lex can rely on later. Keep: what the user wants, decisions they made, what was filed or drafted, what they rejected and why, anything promised. Drop pleasantries. Plain text, under 350 words. Do not add anything that is not in the conversation.',
      messages: [{ role: 'user', content: `${prior.text ? `EARLIER NOTES:\n${prior.text}\n\n` : ''}NEW MESSAGES:\n${fresh}` }],
    })
    const text = res.content.filter((b): b is Anthropic.TextBlock => b.type === 'text').map((b) => b.text).join('').trim()
    if (!text) return prior
    const u = priceUsage(res.usage as never)
    await recordSpend({ stream: 'lex', pass: 'lex.agent.summary', model: SUMMARY_MODEL, tokensIn: u.tokensIn, tokensOut: u.tokensOut, userId, ideaId }).catch(() => {})
    await prisma.idea.update({ where: { id: ideaId }, data: { aiChatSummary: `[[through:${aged.length}]]\n${text}` } })
    return { text, through: aged.length }
  } catch (err) {
    // A failed summary is not a failed turn: the window still goes through, and the cause is logged.
    console.error('[lex-agent] summary failed — continuing without it', err instanceof Error ? err.message : err)
    return prior
  }
}

// ── the turn ──────────────────────────────────────────────────────────────────────────────────

export interface AgentTurnArgs {
  ideaId: string
  user: Owner
  idea: IdeaRow
  message: string
  ui?: UiContext
  /** Client-generated id for this send. A repeat (a network retry) returns the stored reply instead of acting twice. */
  clientTurnId?: string | null
  thinking?: boolean
  /** The first stage's "Ask" chat — answers only. */
  readOnly?: boolean
  client?: Anthropic
}

export async function handleAgentTurn(a: AgentTurnArgs): Promise<AgentHttpResult & { result?: AgentTurnResult }> {
  if (!isOwner(a.user, a.idea)) return { status: 403, body: { error: 'Lex acts only on your own ideas.' } }

  const history = asHistory(a.idea.aiChatHistory)

  // Idempotency: the client retries a failed POST once, and every tool here can write.
  if (a.clientTurnId) {
    const done = history.find((m) => m.role === 'lex' && m.turnId === a.clientTurnId)
    if (done) return { status: 200, body: { chatText: done.content, agent: agentPayload(done as never), replayed: true, state: await computeCanonicalState(a.ideaId) } }
  }

  // A long paste is HELD OUT of the conversation (§4c): the model sees a note, the platform holds the text,
  // and `file_text{fromPaste}` files it. Same reason the old route stubbed it: a document is never injected
  // wholesale, and it would otherwise be resent to the model on every later turn.
  let message = a.message
  let pastedText: string | null = null
  if (message.length > CHAT_MESSAGE_LIMIT || (message.length >= MIN_PASTE_CHARS * 4 && !/https?:\/\//.test(message) && message.split('\n').length > 6)) {
    pastedText = message
    message = `[The user pasted ${message.length.toLocaleString('en-GB')} characters of text. It is held by the platform, not shown to you. If they want it kept, file it with file_text (fromPaste=true).]`
  }

  const summary = await maybeSummarise(a.ideaId, a.user.id, history, a.client)
  const result = await runAgentTurn({
    ideaId: a.ideaId, userId: a.user.id, message, ui: a.ui, history, summary: summary.text, pastedText,
    thinking: a.thinking, readOnly: a.readOnly, client: a.client, turnId: a.clientTurnId ?? null,
  })

  const now = new Date().toISOString()
  const state = await computeCanonicalState(a.ideaId)
  const stage = state?.stage
  const lexMsg: ChatMsg = {
    role: 'lex', content: result.reply, timestamp: now, stage,
    turnId: a.clientTurnId ?? null,
    tools: result.toolLog, pending: result.pending, undo: result.undo, ui: result.ui,
    costPence: Number(result.cost.pence.toFixed(3)), ended: result.ended,
  }
  const next = [...history, { role: 'user', content: message, timestamp: now, stage }, lexMsg].slice(-KEEP_MESSAGES)
  await prisma.idea.update({ where: { id: a.ideaId }, data: { aiChatHistory: next as never } })

  return {
    status: 200, result,
    body: { chatText: result.reply, state, agent: agentPayload(lexMsg as never, result) },
  }
}

function agentPayload(m: { pending?: PendingConfirmation[]; undo?: UndoOffer[]; ui?: UiEffect[]; costPence?: number; tools?: unknown }, r?: AgentTurnResult) {
  return {
    pending: m.pending ?? [], undo: m.undo ?? [], ui: m.ui ?? [], costPence: m.costPence ?? 0,
    tools: m.tools ?? [], ...(r ? { ended: r.ended, tainted: r.tainted } : {}),
  }
}

// ── the session cost (§8b) ────────────────────────────────────────────────────────────────────

/** What this idea's conversation has cost, in pence — summed from what each turn stored. */
export async function conversationCostPence(ideaId: string): Promise<number> {
  const row = await prisma.idea.findUnique({ where: { id: ideaId }, select: { aiChatHistory: true } })
  return asHistory(row?.aiChatHistory).reduce((s, m) => s + (typeof m.costPence === 'number' ? m.costPence : 0), 0)
}

// ── the button ────────────────────────────────────────────────────────────────────────────────

const sigOf = (token: string) => token.split('.')[1]?.slice(0, 24) ?? ''

/**
 * §3b/§4c — THE ONLY PATH THAT RUNS AN ASKS-FIRST ACTION. Called by the confirm route, which is called by
 * a button. It verifies the signed token (idea, user, expiry, input), refuses a token already used, runs
 * the tool with `confirmed: true`, and writes a PLATFORM-WRITTEN line into the chat — so the record of
 * what was done is never the model's own description of it.
 */
export async function handleConfirm(a: { ideaId: string; user: Owner; idea: IdeaRow; token: string }): Promise<AgentHttpResult> {
  if (!isOwner(a.user, a.idea)) return { status: 403, body: { error: 'Lex acts only on your own ideas.' } }

  let v
  try { v = verifyConfirm(a.token, { ideaId: a.ideaId, userId: a.user.id }) } catch (err) {
    return { status: 500, body: { error: err instanceof Error ? err.message : 'confirmation is not configured' } }
  }
  if (!v.ok) {
    const why: Record<string, string> = {
      malformed: 'That confirmation is not valid.', 'bad-signature': 'That confirmation is not valid.',
      expired: 'That confirmation has expired — ask me again and I will offer it afresh.',
      'wrong-idea': 'That confirmation belongs to a different idea.', 'wrong-user': 'That confirmation was not issued to you.',
    }
    return { status: v.reason === 'expired' ? 410 : 403, body: { error: why[v.reason] ?? 'That confirmation could not be used.' } }
  }

  // Single use. The signature prefix is stored on the history message the user acted on.
  const history = asHistory(a.idea.aiChatHistory)
  const sig = sigOf(a.token)
  if (history.some((m) => Array.isArray(m.used) && (m.used as string[]).includes(sig))) {
    return { status: 409, body: { error: 'That has already been done.' } }
  }

  const def = toolByName(v.payload.tool)
  if (!def) return { status: 422, body: { error: `Unknown action "${v.payload.tool}".` } }

  const ctx: ToolCtx = {
    ideaId: a.ideaId, userId: a.user.id, confirmed: true,
    turn: { tainted: false, corpusIds: new Set(), webSources: new Map(), userMessages: history.filter((m) => m.role === 'user').map((m) => String(m.content ?? '')), pastedText: null },
  }

  // Marked used BEFORE it runs: a double-click must not double-act. A failure is reported, and the user asks again.
  const holder = [...history].reverse().find((m) => m.role === 'lex' && JSON.stringify([m.pending, m.undo]).includes(a.token.slice(0, 40)))
  const marked = history.map((m) => (m === holder ? { ...m, used: [...(Array.isArray(m.used) ? (m.used as string[]) : []), sig] } : m))
  if (!holder) marked.push({ role: 'lex', content: '', used: [sig], timestamp: new Date().toISOString() } as ChatMsg)
  await prisma.idea.update({ where: { id: a.ideaId }, data: { aiChatHistory: marked as never } })

  const r = await execute(def, ctx, v.payload.input)
  const summary = def.describe ? def.describe(def.schema.safeParse(v.payload.input).data) : def.name
  // §8c — the confirmed action is Lex's action too, run because the OWNER PRESSED THE BUTTON: recorded with that as its
  // instruction (and the user's last message that led to the offer), `confirmedVia: 'button'`. The pending row from the
  // turn that offered it stays, so the log reads "offered … confirmed … done".
  const lastAsk = [...history].reverse().find((m) => m.role === 'user')
  await recordToolCall({
    ideaId: a.ideaId, userId: a.user.id, turnId: null, tool: def.name, tier: def.runKind ? 'run' : 'asks-first',
    instruction: `The owner pressed Confirm on: ${summary}${lastAsk ? ` — after they wrote: ${String(lastAsk.content ?? '').slice(0, 600)}` : ''}`,
    input: v.payload.input, ok: r.ok,
    summary: r.ok ? `Done — ${summary}` : `Could not be done: ${r.error ?? 'no reason was given'}`,
    failureReason: r.ok ? null : (r.error ?? 'no reason was given'), confirmedVia: 'button',
  })
  const line = r.ok ? `Done — ${summary}` : `That could not be done: ${r.error ?? 'no reason was given'}`
  const after = asHistory((await prisma.idea.findUnique({ where: { id: a.ideaId }, select: { aiChatHistory: true } }))?.aiChatHistory)
  const lexMsg: ChatMsg = { role: 'lex', content: line, timestamp: new Date().toISOString(), undo: r.undo ? [r.undo] : [], ui: r.ui ?? [], confirmedTool: def.name, confirmedOk: r.ok }
  await prisma.idea.update({ where: { id: a.ideaId }, data: { aiChatHistory: [...after, lexMsg].slice(-KEEP_MESSAGES) as never } })
  console.log('[lex-agent] confirmed', { ideaId: a.ideaId, tool: def.name, ok: r.ok, error: r.error })

  const state = await computeCanonicalState(a.ideaId)
  return {
    status: r.ok ? 200 : 422,
    body: { ok: r.ok, chatText: line, state, agent: { pending: [], undo: r.undo ? [r.undo] : [], ui: r.ui ?? [], costPence: 0, tools: [] } },
  }
}
