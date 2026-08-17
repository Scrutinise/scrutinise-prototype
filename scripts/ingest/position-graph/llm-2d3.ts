/**
 * llm-2d3.ts — the ONE place this sprint talks to a model.
 *
 * Three rules are enforced here rather than in each caller, because a guard in a caller is a guard
 * that the next caller forgets:
 *
 *  1. **finishReason is checked BEFORE the body is parsed** (docs/CLAUDE.md §18). A truncated
 *     payload is broken JSON, so parsing first turns a length limit into a parse error and sends
 *     the reader after the wrong fault. `truncated`, `blocked` and `bad-json` are three distinct
 *     outcomes with three distinct log lines.
 *  2. **`thinkingBudget: 0`.** gemini-2.5-flash otherwise spends the whole output budget thinking
 *     and returns nothing — the 29 Jul query-expansion failure. Thought tokens are billed at the
 *     OUTPUT rate, so they are also metered when present.
 *  3. **Every call is metered from the API's OWN `usageMetadata`**, never from our estimate. The
 *     estimate is what gets scored; scoring it against another estimate would measure nothing.
 */
import type { Meter } from './cost-2d3'

/**
 * The §18 guard itself.
 *
 * ⚠ `scrutinise-web/lib/lex/gemini-finish.ts` is the same guard for the Next app. It is NOT
 * imported here and that is a build boundary, not a choice: `scripts/ingest/tsconfig.json` sets
 * `rootDir: "."`, so a file outside `scripts/ingest` cannot be compiled into this project. The rule
 * §18 actually states is that the guard lives in the SHARED HELPER rather than in each caller —
 * this module is that helper for the scripts runtime, there is exactly one copy of it per runtime,
 * and `--self-test` exercises all four outcomes.
 *
 * An ABSENT finishReason is fine: some responses omit it, and failing closed on a missing field
 * turns a working call into an outage.
 */
export function geminiFinishProblem(
  candidate: { finishReason?: string; content?: { parts?: Array<{ text?: string }> } } | undefined,
  budget: number,
  opts: { label?: string } = {},
): { reason: 'truncated' | 'blocked'; detail: string } | null {
  const finish = candidate?.finishReason
  if (!finish || finish === 'STOP') return null
  const text = candidate?.content?.parts?.[0]?.text
  const tail = typeof text === 'string' && text.length ? ` …ends: ${JSON.stringify(text.slice(-80))}` : ''
  const where = opts.label ? `[${opts.label}] ` : ''
  if (finish === 'MAX_TOKENS') {
    return { reason: 'truncated', detail: `${where}cut off at maxOutputTokens=${budget} — raise the budget or shorten the input${tail}` }
  }
  return { reason: 'blocked', detail: `${where}finishReason=${finish}${tail}` }
}

export const MODEL = process.env.GRAPH_2D3_MODEL ?? 'gemini-2.5-flash'
const ENDPOINT = 'https://generativelanguage.googleapis.com/v1beta/models'
const TIMEOUT_MS = parseInt(process.env.GRAPH_2D3_TIMEOUT_MS ?? '180000', 10)
const RETRIES = parseInt(process.env.GRAPH_2D3_RETRIES ?? '5', 10)

export type LlmResult<T> =
  | { kind: 'ok'; value: T; raw: string }
  | { kind: 'truncated' | 'blocked' | 'bad-json' | 'http-error' | 'network'; detail: string }

const RETRYABLE = /429|RESOURCE_EXHAUSTED|50[0234]|UNAVAILABLE|INTERNAL|ECONNRESET|ETIMEDOUT|fetch failed|timed? ?out|aborted/i

interface GeminiResp {
  candidates?: Array<{ finishReason?: string; content?: { parts?: Array<{ text?: string }> } }>
  usageMetadata?: { promptTokenCount?: number; candidatesTokenCount?: number; thoughtsTokenCount?: number }
  promptFeedback?: { blockReason?: string }
}

export interface CallOpts {
  system: string
  user: string
  schema: unknown
  maxOutputTokens: number
  label: string
  meter: Meter
  temperature?: number
}

/** One JSON call. Returns a typed result; never throws for a model-side outcome. */
export async function geminiJson<T>(opts: CallOpts): Promise<LlmResult<T>> {
  const apiKey = process.env.GEMINI_API_KEY
  if (!apiKey) throw new Error('GEMINI_API_KEY not set')

  let lastDetail = ''
  for (let attempt = 0; attempt < RETRIES; attempt++) {
    const ctrl = new AbortController()
    const timer = setTimeout(() => ctrl.abort(), TIMEOUT_MS)
    try {
      const res = await fetch(`${ENDPOINT}/${MODEL}:generateContent?key=${apiKey}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          system_instruction: { parts: [{ text: opts.system }] },
          contents: [{ role: 'user', parts: [{ text: opts.user }] }],
          generationConfig: {
            temperature: opts.temperature ?? 0.1,
            maxOutputTokens: opts.maxOutputTokens,
            responseMimeType: 'application/json',
            responseSchema: opts.schema,
            thinkingConfig: { thinkingBudget: 0 },
          },
        }),
        signal: ctrl.signal,
      })
      if (!res.ok) {
        const body = await res.text().catch(() => '')
        lastDetail = `HTTP ${res.status} ${body.slice(0, 300)}`.trim()
        if (RETRYABLE.test(String(res.status)) && attempt < RETRIES - 1) { await backoff(attempt, opts.label, lastDetail); continue }
        opts.meter.errors++
        return { kind: 'http-error', detail: lastDetail }
      }
      const data = await res.json() as GeminiResp

      // METER FIRST — a blocked or truncated call still costs money, and a bill that only counts
      // successes understates the spend by exactly the calls you most want to know about.
      opts.meter.calls++
      opts.meter.inTokens += data.usageMetadata?.promptTokenCount ?? 0
      opts.meter.outTokens += data.usageMetadata?.candidatesTokenCount ?? 0
      opts.meter.thoughtTokens += data.usageMetadata?.thoughtsTokenCount ?? 0

      const candidate = data.candidates?.[0]
      // §18, rule 1: BEFORE parsing.
      const problem = geminiFinishProblem(candidate, opts.maxOutputTokens, { label: opts.label })
      if (problem) { opts.meter.errors++; return { kind: problem.reason, detail: problem.detail } }
      if (!candidate && data.promptFeedback?.blockReason) {
        opts.meter.errors++
        return { kind: 'blocked', detail: `[${opts.label}] promptFeedback.blockReason=${data.promptFeedback.blockReason}` }
      }

      const text = candidate?.content?.parts?.map((p) => p.text ?? '').join('') ?? ''
      if (!text.trim()) { opts.meter.errors++; return { kind: 'bad-json', detail: `[${opts.label}] empty body, finishReason=${candidate?.finishReason ?? '(absent)'}` } }
      try {
        return { kind: 'ok', value: JSON.parse(text) as T, raw: text }
      } catch (e) {
        opts.meter.errors++
        return { kind: 'bad-json', detail: `[${opts.label}] ${(e as Error).message} · starts: ${JSON.stringify(text.slice(0, 120))}` }
      }
    } catch (e) {
      lastDetail = (e as Error).message ?? String(e)
      if (RETRYABLE.test(lastDetail) && attempt < RETRIES - 1) { await backoff(attempt, opts.label, lastDetail); continue }
      opts.meter.errors++
      return { kind: 'network', detail: `[${opts.label}] ${lastDetail}` }
    } finally { clearTimeout(timer) }
  }
  opts.meter.errors++
  return { kind: 'network', detail: `[${opts.label}] exhausted ${RETRIES} attempts: ${lastDetail}` }
}

async function backoff(attempt: number, label: string, why: string) {
  const wait = Math.min(60_000, 2000 * 2 ** attempt) + Math.floor(Math.random() * 1000)
  console.warn(`  [llm] ${label} attempt ${attempt + 1} failed: ${why.slice(0, 140)} — retrying in ${Math.round(wait / 1000)}s`)
  await new Promise((r) => setTimeout(r, wait))
}

// ── offline self-test — every assertion below was watched FAILING first ─────────────────────────
function selftest() {
  const cases: Array<[string, boolean]> = [
    ['STOP is not a problem', geminiFinishProblem({ finishReason: 'STOP' }, 512) === null],
    ['absent finishReason is not a problem', geminiFinishProblem({}, 512) === null],
    ['undefined candidate is not a problem', geminiFinishProblem(undefined, 512) === null],
    ['MAX_TOKENS is truncated, not blocked', geminiFinishProblem({ finishReason: 'MAX_TOKENS' }, 512)?.reason === 'truncated'],
    ['truncated names the budget', /maxOutputTokens=512/.test(geminiFinishProblem({ finishReason: 'MAX_TOKENS' }, 512)!.detail)],
    // ⚠ the FIXTURE was corrected here, not the rule: the tail is the last 80 characters, so a
    // 200-character filler in front of the marker is inside the window and correctly shown.
    ['truncated shows the tail', /ends: ".*the right to "$/.test(
      geminiFinishProblem({ finishReason: 'MAX_TOKENS', content: { parts: [{ text: 'x'.repeat(200) + 'the right to ' }] } }, 512)!.detail)],
    ['tail is capped at 80 chars', (() => {
      const d = geminiFinishProblem({ finishReason: 'MAX_TOKENS', content: { parts: [{ text: 'y'.repeat(500) }] } }, 512)!.detail
      return (d.match(/y+/)?.[0].length ?? 0) === 80
    })()],
    ['SAFETY is blocked, not truncated', geminiFinishProblem({ finishReason: 'SAFETY' }, 512)?.reason === 'blocked'],
    ['RECITATION is blocked', geminiFinishProblem({ finishReason: 'RECITATION' }, 512)?.reason === 'blocked'],
    ['label rides in the detail', /\[extract:99\]/.test(geminiFinishProblem({ finishReason: 'SAFETY' }, 512, { label: 'extract:99' })!.detail)],
  ]
  let bad = 0
  for (const [name, ok] of cases) { console.log(`  ${ok ? 'PASS' : 'FAIL'}  ${name}`); if (!ok) bad++ }
  console.log(bad ? `\n${bad} FAILED` : `\n${cases.length}/${cases.length} pass`)
  if (bad) process.exit(1)
}
if (require.main === module && process.argv.includes('--self-test')) selftest()

/** A crude global pacer: N calls in flight at once, and no more. */
export async function mapLimit<T, R>(items: T[], limit: number, fn: (item: T, i: number) => Promise<R>): Promise<R[]> {
  const out: R[] = new Array(items.length)
  let next = 0
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (true) {
      const i = next++
      if (i >= items.length) return
      out[i] = await fn(items[i], i)
    }
  }))
  return out
}
