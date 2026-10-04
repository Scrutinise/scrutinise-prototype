// 26-P §2/§5 — ONE LEX TURN, AS A TOOL LOOP.
//
//   user message ──▶ [cached prefix] [cached snapshot] [history] [where-you-are + message]
//        ▲                                                               │
//        └── tool results (same turn) ◀── tool_use ◀── model ◀───────────┘
//
// There is no JSON envelope, no tool-decider call and no keyword detector: the model chooses its own
// tools (§2c) and a tool result returns to it inside the turn (§2a).
//
// ⚠ WHAT THE CODE DOES THAT THE MODEL CANNOT TALK ITS WAY OUT OF:
//   • tools execute ONLY here, inside the handler of the user's own POST — never from text in content;
//   • an asks-first tool never runs from here: `execute` hands back a signed token for the button;
//   • the reply is checked against this turn's tool outcomes BEFORE it is returned (`honesty.ts`), with
//     one corrective retry and then removal — so a false "done" cannot reach the screen;
//   • the evaluative-opener filter runs on whatever survives.
//
// MODEL: `claude-sonnet-5-5`, thinking OFF by default. ⚠ On this model `thinking:{type:'disabled'}` is a
// 400 — the off position is `{type:'between_tools'}` (valid at effort ≤ high, no other field). Forced
// `tool_choice` is also a 400, so it is `auto`. No `temperature`: it is rejected on this family.

import Anthropic from '@anthropic-ai/sdk'
import { z } from 'zod'
import { recordSpend, USD_TO_GBP } from '@/lib/lex/spend-ledger'
import { recordToolCall } from './tool-log'
import { enforceNoPreamble, hasEvaluativePreamble } from '@/lib/lex/no-preamble'
import { SYSTEM_PREFIX } from './system-prompt'
import { buildSnapshot, type UiContext } from './snapshot'
import { MODEL_TOOLS, execute, toolByName, isModelTool } from './tools'
import { checkReply, correctionMessage, stripViolations, type ToolOutcome, type Violation } from './honesty'
import { knownLabels } from './controls'
import type { PendingConfirmation, ToolCtx, ToolLogEntry, ToolResult, TurnState, UiEffect, UndoOffer } from './types'

export const AGENT_MODEL = 'claude-sonnet-5-5'

/** Anthropic's published rates for this model (cached 2026-09-25 in the claude-api reference): $/M tokens. ⚠ NOT verified against an invoice. */
export const AGENT_RATES = { inPerM: 2.0, outPerM: 10.0, cacheReadPerM: 0.2, cacheWritePerM: 2.5 } as const

const MAX_ITERATIONS = 8
const MAX_OUTPUT_TOKENS = 4096
/** Past this, the loop stops and says so — a turn must not be able to spend without limit. */
const MAX_TURN_PENCE = 40
const TURN_DEADLINE_MS = 240_000
const HISTORY_WINDOW = 20

export interface ChatMsg {
  role: string
  content: string
  timestamp?: string
  stage?: string
  [k: string]: unknown
}

export interface AgentTurnInput {
  ideaId: string
  userId: string
  message: string
  ui?: UiContext
  /** Prior messages, oldest first. */
  history: ChatMsg[]
  /** §8a — a summary of everything before the history window. Rides in the cached snapshot block. */
  summary?: string | null
  /** The user pasted a long text; it is held HERE, out of the conversation, and filed by `file_text{fromPaste}`. */
  pastedText?: string | null
  /** Turn thinking on for this turn (§5a: only for chains the report identifies). Default off. */
  thinking?: boolean
  /** The first stage's "Ask" chat: answers, searches and explains, and is not offered a single tool that writes. */
  readOnly?: boolean
  /** Test seam: supply a client. */
  client?: Anthropic
  /** 26-P addendum §8c — the client turn id, so one turn's recorded calls read together. */
  turnId?: string | null
}

export interface TurnCost {
  usd: number
  pence: number
  calls: number
  tokensIn: number
  tokensCacheWrite: number
  tokensCacheRead: number
  tokensOut: number
}

export interface AgentTurnResult {
  reply: string
  ui: UiEffect[]
  pending: PendingConfirmation[]
  undo: UndoOffer[]
  toolLog: ToolLogEntry[]
  outcomes: ToolOutcome[]
  violations: Violation[]
  retried: boolean
  /** Why the loop ended: end_turn | max_tokens | refusal | iterations | budget | deadline | error. */
  ended: string
  tainted: boolean
  cost: TurnCost
  snapshotCounts: Record<string, number>
}

// ── tool definitions as the API wants them ────────────────────────────────────────────────────

function jsonSchemaOf(schema: z.ZodTypeAny): Record<string, unknown> {
  const js = z.toJSONSchema(schema, { target: 'draft-7' }) as Record<string, unknown>
  delete js.$schema
  return js
}

/** Categories that change nothing. The first stage's "Ask" chat (25-Q §3a) answers and writes NOTHING, so it is offered only these. */
const READ_ONLY_CATEGORIES = new Set(['see', 'search', 'explain'])
export const isReadOnlyTool = (name: string) => {
  const def = toolByName(name)
  return !!def && READ_ONLY_CATEGORIES.has(def.category)
}

const TOOL_PARAMS: Record<'full' | 'readonly', Anthropic.Tool[] | null> = { full: null, readonly: null }
/** ⚠ Built once per mode and in a fixed order: the tool list is the first thing the cache prefix covers. */
export function toolParams(readOnly = false): Anthropic.Tool[] {
  const key = readOnly ? 'readonly' : 'full'
  if (!TOOL_PARAMS[key]) {
    TOOL_PARAMS[key] = MODEL_TOOLS.filter((t) => !readOnly || isReadOnlyTool(t.name)).map((t) => ({
      name: t.name, description: t.description,
      input_schema: jsonSchemaOf(t.schema) as Anthropic.Tool.InputSchema,
    }))
  }
  return TOOL_PARAMS[key]!
}

// ── cost ──────────────────────────────────────────────────────────────────────────────────────

export function priceUsage(u: { input_tokens?: number; output_tokens?: number; cache_creation_input_tokens?: number | null; cache_read_input_tokens?: number | null }) {
  const inT = u.input_tokens ?? 0, out = u.output_tokens ?? 0
  const cw = u.cache_creation_input_tokens ?? 0, cr = u.cache_read_input_tokens ?? 0
  const usd = (inT * AGENT_RATES.inPerM + out * AGENT_RATES.outPerM + cw * AGENT_RATES.cacheWritePerM + cr * AGENT_RATES.cacheReadPerM) / 1_000_000
  return { usd, tokensIn: inT, tokensCacheWrite: cw, tokensCacheRead: cr, tokensOut: out }
}

// ── history ───────────────────────────────────────────────────────────────────────────────────

/**
 * ⚠ FOUND LIVE ON 2 OCT. Earlier turns were resent as TEXT ONLY, so the model saw its own past replies —
 * "Your pasted text is filed…" — with no trace of the tool call that made them true. On the next turn it
 * decided those claims were unsupported and spent its reply correcting a statement that was correct. The
 * fix is not to resend tool traffic (§8a: too many tokens) but a one-line RECORD, written by the platform
 * from what the tools returned, so the model can tell what was done from what was only said.
 */
export function platformRecord(m: ChatMsg): string {
  const tools = (Array.isArray(m.tools) ? m.tools : []) as Array<{ name: string; ok: boolean; pending?: boolean; summary?: string; error?: string }>
  const acting = tools.filter((t) => { const c = toolByName(t.name)?.category; return c === 'file' || c === 'draft' || c === 'change' || c === 'run' })
  const lines = acting.map((t) => t.pending ? `${t.name} — NOT DONE, was waiting for the user's confirm button`
    : t.ok ? `${t.name} — done (${(t.summary ?? '').slice(0, 140)})` : `${t.name} — FAILED (${(t.error ?? t.summary ?? '').slice(0, 140)})`)
  if (m.confirmedTool) lines.push(`${m.confirmedTool} — the user pressed the button; ${m.confirmedOk ? 'done' : 'it did not succeed'}`)
  if (!lines.length) return ''
  return `\n\n[Platform record of the actions in that turn — written by the platform from the tool results, not by you: ${lines.join('; ')}]`
}

/** Is a confirmation from an earlier turn still live and unpressed on the user's screen? */
export function priorPendingLive(history: ChatMsg[], now = Date.now()): boolean {
  const used = new Set(history.flatMap((m) => (Array.isArray(m.used) ? (m.used as string[]) : [])))
  const last = [...history].reverse().find((m) => m.role === 'lex' && Array.isArray(m.pending) && (m.pending as unknown[]).length)
  if (!last) return false
  return (last.pending as Array<{ token: string }>).some((p) => {
    try {
      const exp = JSON.parse(Buffer.from(p.token.split('.')[0], 'base64url').toString()).exp as number
      return exp > now && !used.has(p.token.split('.')[1]?.slice(0, 24) ?? '')
    } catch { return false }
  })
}

/** Prior chat as API messages. Only the text of earlier turns is resent — never their tool traffic (§8a) — plus the platform's record of what its tools did. */
function historyMessages(history: ChatMsg[]): Anthropic.MessageParam[] {
  const out: Anthropic.MessageParam[] = []
  for (const m of history.slice(-HISTORY_WINDOW)) {
    if (m.role !== 'user' && m.role !== 'lex') continue
    const text = (String(m.content ?? '').trim() + (m.role === 'lex' ? platformRecord(m) : '')).trim()
    if (!text) continue
    const role = m.role === 'user' ? 'user' : 'assistant'
    const last = out[out.length - 1]
    if (last && last.role === role) { last.content = `${last.content as string}\n\n${text}`; continue }
    out.push({ role, content: text.slice(0, 6000) })
  }
  // The API requires the first message to be a user turn.
  while (out.length && out[0].role !== 'user') out.shift()
  // …and the history must end on an assistant turn, because the new user message follows it.
  while (out.length && out[out.length - 1].role === 'user') out.pop()
  return out
}

/** §8a — older history is summarised, not resent. `summary` is what the caller stored for everything before the window. */
export function olderHistory(history: ChatMsg[]): ChatMsg[] {
  return history.length > HISTORY_WINDOW ? history.slice(0, history.length - HISTORY_WINDOW) : []
}

// ── the extra evaluative-opener filter ────────────────────────────────────────────────────────

// `enforceNoPreamble` covers the phrases it lists; the live product also produced "That's a very pertinent
// question" (26-L §5), which none of them match. Same rule, applied to the first sentence only, and only
// when it is short and EVALUATES rather than answers.
const EVALUATIVE_FIRST_SENTENCE = /^(?:that(?:[’']s| is)|this is|what an?|it(?:[’']s| is)|good|great|excellent|fair|sharp|valid|nice|smart)\s+(?:(?:a|an|very|really|truly|extremely|quite|such)\s+)*(?:excellent|great|astute|pertinent|insightful|fascinating|thoughtful|interesting|good|fair|valid|sharp|smart|important|helpful|perceptive|useful|relevant|sensible|crucial|key|brilliant|lovely)\b[^.!?\n]{0,80}[.!?—-]+\s*/i

export function stripOpener(text: string): string {
  let t = enforceNoPreamble(text).trimStart()
  for (let i = 0; i < 2; i++) {
    const m = t.match(EVALUATIVE_FIRST_SENTENCE)
    if (!m || m[0].split(/\s+/).length > 16) break
    const rest = t.slice(m[0].length).trimStart()
    if (!rest) break // a reply that is ONLY that sentence is left alone rather than emptied
    t = rest.charAt(0).toUpperCase() + rest.slice(1)
  }
  return t
}

export const hasOpener = (text: string) => hasEvaluativePreamble(text).matched || EVALUATIVE_FIRST_SENTENCE.test(text.trimStart())

// ── the loop ──────────────────────────────────────────────────────────────────────────────────

function toolResultBlock(id: string, r: ToolResult): Anthropic.ToolResultBlockParam {
  const body: Record<string, unknown> = { ok: r.ok }
  if (r.pending) body.status = 'needs_confirmation'
  if (r.error) body.error = r.error
  if (r.data !== undefined) body.data = r.data
  if (r.items) body.items = r.items
  if (r.undo) body.undoAvailable = r.undo.label
  const content: Anthropic.ToolResultBlockParam['content'] = [{ type: 'text', text: JSON.stringify(body) }]
  if (r.untrusted) content.push({ type: 'text', text: r.untrusted })
  return { type: 'tool_result', tool_use_id: id, content, ...(r.ok || r.pending ? {} : { is_error: true }) }
}

export async function runAgentTurn(input: AgentTurnInput): Promise<AgentTurnResult> {
  const started = Date.now()
  // maxRetries 4: a "Connection error" on 2 Oct, after three slow link fetches in the same turn, threw away a
  // turn whose tools had ALREADY WRITTEN. The cause was not reproduced; more retries are the cheap defence and
  // the catch below reports what was done regardless.
  const client = input.client ?? new Anthropic({ timeout: 120_000, maxRetries: 4 })

  const turn: TurnState = {
    tainted: false, corpusIds: new Set(), webSources: new Map(), pastedText: input.pastedText ?? null,
    userMessages: [input.message, ...input.history.filter((m) => m.role === 'user').slice(-HISTORY_WINDOW).map((m) => String(m.content ?? '')).reverse()],
  }
  const ctx: ToolCtx = { ideaId: input.ideaId, userId: input.userId, turn, confirmed: false }

  const snap = await buildSnapshot(input.ideaId, input.ui)
  const labels = knownLabels()

  const system = [
    { type: 'text' as const, text: SYSTEM_PREFIX, cache_control: { type: 'ephemeral' as const } },
    {
      type: 'text' as const,
      text: `THE IDEA, AS IT STANDS\n${snap.stable}${input.summary?.trim() ? `\n\nEARLIER IN THIS CONVERSATION (summary of what came before the messages below)\n${input.summary.trim()}` : ''}`,
      cache_control: { type: 'ephemeral' as const },
    },
  ]
  const messages: Anthropic.MessageParam[] = [
    ...historyMessages(input.history),
    { role: 'user', content: [{ type: 'text', text: snap.volatile }, { type: 'text', text: `THE USER’S MESSAGE:\n${input.message}` }] },
  ]

  const cost: TurnCost = { usd: 0, pence: 0, calls: 0, tokensIn: 0, tokensCacheWrite: 0, tokensCacheRead: 0, tokensOut: 0 }
  const outcomes: ToolOutcome[] = []
  const toolLog: ToolLogEntry[] = []
  const uiEffects: UiEffect[] = []
  const pending: PendingConfirmation[] = []
  const undo: UndoOffer[] = []
  let ended = 'end_turn'
  let retried = false

  async function call(): Promise<Anthropic.Message> {
    // ⚠ Fields the installed SDK types predate (`thinking: between_tools`, `output_config`) are passed
    // through the cast; the API, not the types, is the authority for Sonnet 5.5.
    const params = {
      model: AGENT_MODEL, max_tokens: MAX_OUTPUT_TOKENS, system, tools: toolParams(!!input.readOnly),
      tool_choice: { type: 'auto' }, messages,
      // Top-level auto-cache: caches the LAST cacheable block, so each call in the tool loop (and the next
      // turn's history) reads the growing conversation from cache. Measured: uncached input was the biggest
      // line of a turn's cost (8–11k tokens on the longer ones). The two `system` breakpoints cover the
      // prefix and the snapshot; this is the third of the four allowed.
      cache_control: { type: 'ephemeral' },
      thinking: input.thinking ? { type: 'adaptive' } : { type: 'between_tools' },
      output_config: { effort: 'medium' },
    }
    const res = await client.messages.create(params as unknown as Anthropic.MessageCreateParamsNonStreaming)
    const p = priceUsage(res.usage as never)
    cost.calls++; cost.usd += p.usd
    cost.tokensIn += p.tokensIn; cost.tokensCacheWrite += p.tokensCacheWrite; cost.tokensCacheRead += p.tokensCacheRead; cost.tokensOut += p.tokensOut
    cost.pence = cost.usd * USD_TO_GBP * 100
    return res
  }

  /** Run every tool_use in one assistant message, in order (writes may depend on an earlier search). */
  async function runTools(content: Anthropic.ContentBlock[]): Promise<Anthropic.ToolResultBlockParam[]> {
    const blocks: Anthropic.ToolResultBlockParam[] = []
    for (const b of content) {
      if (b.type !== 'tool_use') continue
      const t0 = Date.now()
      const def = toolByName(b.name)
      let r: ToolResult
      if (!def || !isModelTool(b.name)) r = { ok: false, error: `there is no tool called "${b.name}".` }
      // Defence in depth: a read-only turn is not OFFERED writing tools, and one named anyway is refused here.
      else if (input.readOnly && !isReadOnlyTool(b.name)) r = { ok: false, error: 'this chat only answers questions; it cannot change anything.' }
      else r = await execute(def, ctx, b.input)
      outcomes.push({ name: b.name, category: def?.category ?? 'see', ok: r.ok, pending: !!r.pending, items: r.items })
      toolLog.push({
        name: b.name, input: b.input, ok: r.ok, pending: !!r.pending, error: r.error,
        summary: r.pending ? `waiting for confirmation: ${r.pending.summary}` : r.ok ? clipJson(r.data) : (r.error ?? 'failed'),
        ms: Date.now() - t0,
      })
      // §8c — recorded for the OWNER, per idea, with the instruction it followed. Awaited: the row exists before the
      // reply does. A call the model named that does not exist is recorded too — it is something Lex tried.
      await recordToolCall({
        ideaId: input.ideaId, userId: input.userId, turnId: input.turnId ?? null, tool: b.name,
        tier: def?.runKind ? 'run' : def?.tier === 'ask' ? 'asks-first' : 'free',
        instruction: input.message, input: b.input, ok: r.ok || !!r.pending,
        summary: toolLog[toolLog.length - 1].summary, failureReason: r.ok || r.pending ? null : (r.error ?? 'failed'),
        pending: !!r.pending, tainted: turn.tainted,
      })
      if (r.ui) uiEffects.push(...r.ui)
      if (r.pending) pending.push(r.pending)
      if (r.undo) undo.push(r.undo)
      blocks.push(toolResultBlock(b.id, r))
    }
    return blocks
  }

  let last: Anthropic.Message | null = null
  try {
    for (let i = 0; ; i++) {
      if (i >= MAX_ITERATIONS) { ended = 'iterations'; break }
      if (cost.pence > MAX_TURN_PENCE) { ended = 'budget'; break }
      if (Date.now() - started > TURN_DEADLINE_MS) { ended = 'deadline'; break }
      last = await call()
      if (last.stop_reason !== 'tool_use') { ended = last.stop_reason ?? 'end_turn'; break }
      messages.push({ role: 'assistant', content: last.content })
      messages.push({ role: 'user', content: await runTools(last.content) })
    }

    let reply = textOf(last)

    // §4b — claims checked against tool outcomes BEFORE the reply is shown. One corrective retry, then removal.
    const priorPending = priorPendingLive(input.history)
    let violations = last ? checkReply({ reply, outcomes, knownLabels: labels, userMessage: input.message, priorPending }) : []
    if (violations.length && last && ended === 'end_turn') {
      retried = true
      messages.push({ role: 'assistant', content: last.content })
      messages.push({ role: 'user', content: correctionMessage(violations) })
      for (let i = 0; i < 4; i++) {
        last = await call()
        if (last.stop_reason !== 'tool_use') break
        messages.push({ role: 'assistant', content: last.content })
        messages.push({ role: 'user', content: await runTools(last.content) })
      }
      reply = textOf(last)
      violations = checkReply({ reply, outcomes, knownLabels: labels, userMessage: input.message, priorPending })
    }
    if (violations.length) reply = stripViolations(reply, violations, outcomes)

    // §18 — a stop that is not a clean end names itself.
    if (ended === 'max_tokens') reply = `${reply}\n\n(That reply was cut off at the length limit — ask me to carry on.)`.trim()
    else if (ended === 'refusal') reply = reply || 'I was not able to help with that request.'
    else if (ended === 'iterations') reply = `${reply}\n\nI stopped after ${MAX_ITERATIONS} steps without finishing — what is done is listed below.`.trim()
    else if (ended === 'budget') reply = `${reply}\n\nI stopped because this one request had already cost more than ${MAX_TURN_PENCE}p. What is done is listed below.`.trim()
    else if (ended === 'deadline') reply = `${reply}\n\nI ran out of time on this request. What is done is listed below.`.trim()

    reply = stripOpener(reply)
    if (!reply.trim()) reply = outcomes.some((o) => o.pending) ? 'That is waiting for you to confirm.' : 'I did not have anything to add to that.'

    await recordSpend({
      stream: 'lex', pass: 'lex.agent.turn', model: AGENT_MODEL,
      tokensIn: cost.tokensIn + cost.tokensCacheWrite + cost.tokensCacheRead, tokensOut: cost.tokensOut,
      tokensCached: cost.tokensCacheRead, tokensCacheWrite: cost.tokensCacheWrite, // 26-O §5a
      actualUsd: cost.usd, userId: input.userId, ideaId: input.ideaId, ref: `calls=${cost.calls} cacheRead=${cost.tokensCacheRead}`,
    }).catch((err) => console.error('[lex-agent] ledger write failed', err instanceof Error ? err.message : err))

    console.log('[lex-agent] turn', {
      ideaId: input.ideaId, ended, calls: cost.calls, pence: Number(cost.pence.toFixed(2)),
      cacheRead: cost.tokensCacheRead, cacheWrite: cost.tokensCacheWrite, uncachedIn: cost.tokensIn, out: cost.tokensOut,
      tools: toolLog.map((t) => `${t.name}${t.pending ? '(pending)' : t.ok ? '' : '(failed)'}`), retried, violations: violations.length, tainted: turn.tainted,
    })

    return { reply, ui: uiEffects, pending, undo, toolLog, outcomes, violations, retried, ended, tainted: turn.tainted, cost, snapshotCounts: snap.counts }
  } catch (err) {
    // A failure announces itself with its cause (CLAUDE.md §18). It is not dressed up as an answer.
    const reason = err instanceof Error ? err.message : String(err)
    const cause = err instanceof Error && (err as { cause?: unknown }).cause ? String((err as { cause?: { message?: string } }).cause?.message ?? (err as { cause?: unknown }).cause) : null
    console.error('[lex-agent] turn FAILED', { ideaId: input.ideaId, reason, cause })
    // ⚠ A FAILURE AFTER THE TOOLS HAVE WRITTEN MUST SAY SO. On 2 Oct three links were filed and the reply
    // then failed; the user was told only "Connection error" and would have filed them again. The record of
    // what was done comes from the tool results, not from a reply that never arrived.
    const done = toolLog.filter((t) => t.ok && ['file', 'draft', 'change', 'run'].includes(toolByName(t.name)?.category ?? ''))
    const waiting = toolLog.filter((t) => t.pending)
    const record = [
      ...done.map((t) => `${t.name}: ${t.summary}`),
      ...waiting.map((t) => `waiting for your confirmation: ${t.summary.replace(/^waiting for confirmation: /, '')}`),
    ]
    return {
      reply: record.length
        ? `I could not finish writing that reply (${reason}), but this was done before it failed:\n- ${record.join('\n- ')}`
        : `I could not complete that: ${reason}. Nothing was changed.`,
      ui: uiEffects, pending, undo, toolLog, outcomes, violations: [], retried,
      ended: 'error', tainted: turn.tainted, cost, snapshotCounts: snap.counts,
    }
  }
}

function textOf(m: Anthropic.Message | null): string {
  if (!m) return ''
  return m.content.filter((b): b is Anthropic.TextBlock => b.type === 'text').map((b) => b.text).join('').trim()
}

function clipJson(v: unknown): string {
  const s = typeof v === 'string' ? v : JSON.stringify(v ?? null)
  return s.length > 300 ? `${s.slice(0, 299)}…` : s
}
