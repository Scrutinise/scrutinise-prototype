// ─────────────────────────────────────────────────────────────────────────────
// Lex tool invocation — the pattern, and why it is shaped this way.
//
// AUDIT RESULT (2026-08-02): before this file, Lex had NO tool-calling anywhere.
// `/api/ideas/[id]/lex` (the rebuild chat) and `/api/ai/[ideaId]` (the legacy chat)
// both call Gemini with `responseMimeType: 'application/json'` + `responseSchema`
// and no `tools` block. Retrieval has always been platform-owned and pre-fetched
// (the search gateway, query-router), never model-invoked.
//
// The obvious move — add `tools` to the main /lex turn — is IMPOSSIBLE, not merely
// undesirable. Probed directly against gemini-2.5-flash:
//     tools + responseMimeType 'application/json'
//       → HTTP 400 INVALID_ARGUMENT
//         "Function calling with a response mime type: 'application/json' is unsupported"
// The structured-output contract is load-bearing for the whole proposal/field
// machine, so it wins; function calling moves to its own call.
//
// So: a SEPARATE tools-enabled model call decides whether to invoke a tool and with
// what arguments (genuine native function calling — the model chooses), the platform
// executes it, and the result is injected into the main turn as grounded context.
// This keeps the house rule intact — the platform retrieves, Lex narrates — and it
// costs one extra call only on turns that look like they need data.
//
// If the main turn ever moves off responseSchema, this becomes a normal in-turn tool
// loop with no change to the declaration or the handler.
// ─────────────────────────────────────────────────────────────────────────────

import { QUERY_STATS, runQueryStats, formatStatsForPrompt, type QueryStatsArgs, type QueryStatsResult } from './query-stats'
import { statsConfigured } from '@/lib/stats/stats-db'

const MODEL = process.env.LEX_TOOL_MODEL ?? 'gemini-2.5-flash'
const TIMEOUT_MS = parseInt(process.env.LEX_TOOL_TIMEOUT_MS ?? '10000', 10)

/**
 * Cheap pre-filter so we don't spend a model call on every conversational turn.
 * Deliberately generous on recall (a missed lookup just means Lex answers without
 * data, as it does today) and it only gates the DECIDER — the model still chooses
 * whether to call the tool.
 */
const STATS_SIGNAL =
  /\b(how much|how many|what does .{0,30}\b(cost|spend)|cost(s|ing)?|spend(ing|s)?|expenditure|budget|£|gbp|billion|million|per cent|percent|%|gdp|deficit|debt|tax(es|ation)?|revenue|receipts|statistic|figures?|data on|numbers?|rate of|average|forecast|inflation)\b/i

export function looksStatistical(message: string): boolean {
  return STATS_SIGNAL.test(message)
}

export interface ToolOutcome {
  called: boolean
  name?: string
  args?: QueryStatsArgs
  result?: QueryStatsResult
  /** The block to inject into the Lex system prompt. */
  block?: string
}

interface GeminiPart {
  text?: string
  functionCall?: { name: string; args?: Record<string, unknown> }
}

/** Ask the model — with the real FunctionDeclaration — whether to call a tool. */
async function decideToolCall(
  message: string,
  history: { role: string; content: string }[],
): Promise<{ name: string; args: Record<string, unknown> } | null> {
  const apiKey = process.env.GEMINI_API_KEY
  if (!apiKey) return null

  const ctrl = new AbortController()
  const timer = setTimeout(() => ctrl.abort(), TIMEOUT_MS)
  try {
    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent?key=${apiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        signal: ctrl.signal,
        body: JSON.stringify({
          system_instruction: {
            parts: [{
              text:
                'You decide whether a user\'s message needs a lookup in the UK official-statistics ' +
                'database before it can be answered with real figures. If it does, call the tool with ' +
                'the best arguments. If the message is conversational, or asks for something the tool ' +
                'plainly does not cover, reply with a single word: NO. Never answer the question ' +
                'yourself and never invent a figure.',
            }],
          },
          contents: [
            ...history.slice(-6).map((m) => ({
              role: m.role === 'lex' ? 'model' : 'user',
              parts: [{ text: m.content }],
            })),
            { role: 'user', parts: [{ text: message }] },
          ],
          tools: [{ functionDeclarations: [QUERY_STATS] }],
          toolConfig: { functionCallingConfig: { mode: 'AUTO' } },
          generationConfig: { temperature: 0, maxOutputTokens: 256 },
        }),
      },
    )
    if (!res.ok) {
      console.warn('[lex-tools] decider HTTP', res.status, (await res.text()).slice(0, 200))
      return null
    }
    const data = await res.json()
    const parts: GeminiPart[] = data?.candidates?.[0]?.content?.parts ?? []
    const call = parts.find((p) => p.functionCall)?.functionCall
    return call ? { name: call.name, args: call.args ?? {} } : null
  } catch (err) {
    console.warn('[lex-tools] decider failed:', err instanceof Error ? err.message : err)
    return null
  } finally {
    clearTimeout(timer)
  }
}

/**
 * The one entry point the chat routes call. Returns `{called:false}` cheaply for
 * ordinary conversation; otherwise runs the tool and returns the grounding block.
 * Never throws.
 */
export async function runLexTools(
  message: string,
  history: { role: string; content: string }[] = [],
): Promise<ToolOutcome> {
  // No stats DB in this environment ⇒ the tool does not exist as far as the turn is
  // concerned. Deliberately NOT a "the database doesn't hold that" answer: an
  // unconfigured environment must not put words in Lex's mouth about what the data
  // does or doesn't contain. Behaviour is then byte-for-byte today's.
  if (!statsConfigured()) return { called: false }
  if (!looksStatistical(message)) return { called: false }

  const decision = await decideToolCall(message, history)
  if (!decision) {
    console.log('[lex-diag] tool decider: no call', { preFiltered: true })
    return { called: false }
  }
  if (decision.name !== QUERY_STATS.name) {
    console.warn('[lex-diag] tool decider named an unknown tool', { name: decision.name })
    return { called: false }
  }

  const args: QueryStatsArgs = {
    series: String(decision.args.series ?? ''),
    cofogFunction: decision.args.cofogFunction ? String(decision.args.cofogFunction) : undefined,
    dateFrom: decision.args.dateFrom ? String(decision.args.dateFrom) : undefined,
    dateTo: decision.args.dateTo ? String(decision.args.dateTo) : undefined,
  }
  if (!args.series) return { called: false }

  const result = await runQueryStats(args)
  console.log('[lex-diag] query_stats', {
    args,
    ok: result.ok,
    kind: result.kind,
    rows: result.spending?.rows.length ?? result.series?.length ?? 0,
  })
  return { called: true, name: QUERY_STATS.name, args, result, block: formatStatsForPrompt(result) }
}
