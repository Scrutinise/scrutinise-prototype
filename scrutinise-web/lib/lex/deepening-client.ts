// ─────────────────────────────────────────────────────────────────────────────
// The Deepening's one model call: turn what retrieval returned into FINDINGS, ISSUES
// and, most importantly, an honest account of what it could NOT answer.
//
// Written to the rules the four §18 incidents produced:
//   • `finishReason` is checked BEFORE parsing, via the shared helper. A truncated
//     payload is broken JSON, so parsing first converts a length limit into a parse
//     error and hides it.
//   • thinking is OFF (`thinkingBudget: 0`). §19-D Task 2b: three generators were
//     silently returning nothing because thinking ate the whole output budget.
//   • the budget is generous. Output tokens are billed on what is generated, so a
//     large ceiling on a call that emits a small object costs nothing, and a tight one
//     buys nothing and eventually fires.
//   • failure returns null and SAYS so. The caller marks the run FAILED and keeps its
//     retrieval; it never presents an empty gather as a completed one.
//
// GROUNDING: the model is given ONLY the retrieved results and the user's own text. It
// must cite a sourceId from that list for every finding, and the engine drops any
// finding whose sourceId is not in it — so a fabricated citation cannot be persisted
// even if the model produces one.
// ─────────────────────────────────────────────────────────────────────────────

import type { SearchResult } from './page1-config'
import { geminiFinishProblem } from './gemini-finish'
import { modelFor } from './model-registry'
import { recordGeminiUsage, type SpendStream } from './spend-ledger'

const MAX_TOKENS = parseInt(process.env.LEX_DEEPENING_MAX_TOKENS ?? '8000', 10)
const TIMEOUT_MS = parseInt(process.env.LEX_DEEPENING_TIMEOUT_MS ?? '60000', 10)

export interface RawFinding {
  kind: 'FINDING' | 'PRECEDENT' | 'SUPPORTS' | 'CONTRADICTS' | 'COMPARISON'
  title: string
  body: string
  /** MUST be one of the supplied result ids. Anything else is dropped by the engine. */
  sourceId: string
  /** Optional canonical field this bears on: "challenge", "causes:<id>", "actions:<id>". */
  fieldRef?: string
}

export interface GatherResult {
  findings: RawFinding[]
  /**
   * ⚠ 25-V §7 — AN ISSUE NOW CARRIES A TITLE, and the shape is a UNION on purpose.
   *
   * 221 of 225 stored challenges have no title, and the cause was not that titling failed: it was
   * that `title` was only ever asked for in ONE of the seven places a challenge is created. Here —
   * the research pass, which writes most of them — the contract was a bare string, so there was
   * nothing to store.
   *
   * ⚠⚠ THE STRING FORM IS KEPT AND STILL ACCEPTED. A model that returns the old shape is not
   * wrong, it is answering the contract it was given; rejecting it would turn a missing title into
   * a lost challenge, and the challenges are the best content in the document.
   */
  issues: Array<{ title: string | null; text: string }>
  /** Which of the pass's mustAnswer questions this run actually answered — verbatim. */
  answered: string[]
  /** Gaps the pass itself names, beyond the unanswered mustAnswer questions. */
  gaps: string[]
}

const SCHEMA = {
  type: 'object',
  properties: {
    findings: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          kind: { type: 'string', enum: ['FINDING', 'PRECEDENT', 'SUPPORTS', 'CONTRADICTS', 'COMPARISON'] },
          title: { type: 'string' },
          body: { type: 'string' },
          sourceId: { type: 'string' },
          fieldRef: { type: 'string' },
        },
        required: ['kind', 'title', 'body', 'sourceId'],
      },
    },
    // ⚠ 25-V §7 — an object, so there is somewhere for a title to go. `text` is required and
    // `title` is not: a challenge without a heading is worth having, a heading without a
    // challenge is not.
    issues: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          title: { type: 'string' },
          text: { type: 'string' },
        },
        required: ['text'],
      },
    },
    answered: { type: 'array', items: { type: 'string' } },
    gaps: { type: 'array', items: { type: 'string' } },
  },
  required: ['findings', 'issues', 'answered', 'gaps'],
}

const SYSTEM = [
  'You are Lex, running one DEEPENING PASS over a UK policy proposal. You do the heavy lifting;',
  'the user does the judging. You produce material for them to accept or reject — never conclusions',
  'they must take on trust.',
  '',
  'ABSOLUTE RULES:',
  '1. Every finding MUST carry `sourceId`, copied exactly from the SOURCES list. A statement you',
  '   cannot attribute to a supplied source is not a finding — leave it out, or raise it as an issue',
  '   or a gap. Never invent a citation, a statistic, a date or a case name.',
  '2. A finding that CONTRADICTS the proposal is as valuable as one that supports it. Type it',
  '   CONTRADICTS and report it plainly. Suppressing it is the worst thing you can do here.',
  '3. `answered` must contain, VERBATIM, only those of the MUST-ANSWER questions this run genuinely',
  '   answered from the sources. Omitting a question is how the user learns what is still unknown,',
  '   so omission is useful and over-claiming is not.',
  '4. `gaps` is for what you looked for and could not find. A named gap is a strength.',
  // ══════════ ⚠⚠ 25-U — THE EXAMPLE HERE CAME BACK AS DATA, ON AN UNRELATED PROPOSAL ══════════
  //
  // This rule used to illustrate itself with a concrete sentence about plastic bags in waterways.
  // A model copied it verbatim into its output for the CIVIL SERVICE ACCOUNTABILITY proposal, it
  // was stored in `DeepeningPass.knownUnknowns`, and it rendered in the outward-facing 45,000-word
  // report under "Questions the research could not answer" as a genuine gap in the research:
  //
  //     "No source quantifies how many bags enter waterways each year."
  //
  // ⚠ It is not a stale row. The build of 2 September 2026 07:50 rewrote that row and put it back.
  //
  // ⚠⚠ SO THE EXAMPLE IS NOW ABSTRACT AND SELF-DESCRIBING RATHER THAN A QUOTABLE SENTENCE. The
  // rule needs to convey "name a specific missing measurement", and it can do that by describing
  // the SHAPE of a good issue instead of supplying prose that can be lifted. Anything concrete
  // enough to copy is concrete enough to be copied onto the wrong proposal — and a reader has no
  // way to tell our illustration from our finding.
  //
  // (Family: CLAUDE.md §24 — schema permits ≠ prompt requires. This is the mirror image: what the
  // prompt SHOWS is as capable of reaching the output as what the prompt ASKS FOR.)
  '5. `issues` are SPECIFIC and ADDRESSABLE — something the user can go and do. An issue that says',
  '   only "consider the evidence base" is useless. A good one names the exact measurement,',
  '   definition or comparison that is missing FROM THIS PROPOSAL and that the user could go and',
  '   look for. Do not raise an issue that merely restates a finding.',
  '   ⚠ Every issue must be about the proposal in front of you. Never carry over an example, a',
  '   subject or a figure from these instructions or from any other proposal.',
  '   ⚠ Give every issue a `title`: at most eight words, naming what is missing or unresolved, in',
  '   the language of the proposal rather than a category. "No baseline for delivery times" is a',
  '   title; "Evidence gap" is not. The title is what a reader scans; the text is what they read',
  '   when the title has earned it.',
].join('\n')

/**
 * ⚠ 25-B §2 — THIS IS THE ONE GATHER, AND THE BUILD USES IT TOO.
 *
 * Sprint 25-B's research pass asks the same question of the same corpus in the same
 * shape; the only differences are that it runs per LIBRARY QUESTION rather than per
 * Deepening pass, that it may carry a §7 perspective lens, and that its spend has to
 * come back to the caller for the build's per-pass cost ceiling.
 *
 * All three are optional parameters rather than a second copy of this function. "Two
 * systems doing the same job is how the drift we have twice fixed begins" — and a
 * duplicate gather would have been the third.
 */
export interface GatherOptions {
  /** §6/§7 — override the model for this call. Defaults to the registry's. */
  model?: string
  /**
   * §7 — a perspective's framing, appended to the system prompt. It biases WHAT IS
   * NOTICED; it never relaxes a rule, and the never-claim contract above still binds.
   */
  lens?: string
  /** Diagnostic label and ledger `pass` name, so build spend is attributable per pass. */
  label?: string
  stream?: SpendStream
  /**
   * Usage out-channel. A callback rather than a changed return type: the Deepening's own
   * caller reads `GatherResult | null` and must keep doing so, and a build cost ceiling
   * that silently missed this call's tokens would be a ceiling that does not hold.
   */
  onUsage?: (usage: { model: string; tokensIn: number; tokensOut: number }) => void
}

export async function generateDeepeningFindings(input: {
  method: string
  mustAnswer: string[]
  idea: string
  costLines: string[]
  results: SearchResult[]
}, opts: GatherOptions = {}): Promise<GatherResult | null> {
  const label = opts.label ?? 'deepening'
  const apiKey = process.env.GEMINI_API_KEY
  if (!apiKey) {
    console.warn(`[${label}] no GEMINI_API_KEY — the gather cannot run`)
    return null
  }
  // S6 §2 — default via lib/lex/model-registry.ts; legacy env vars still take precedence.
  const model = opts.model ?? process.env.LEX_DEEPENING_MODEL ?? process.env.QUERY_EXPANSION_MODEL ?? modelFor('deepening.gather')

  const sources = input.results
    .map((r, i) => `[${i + 1}] id=${r.id}\n    type: ${r.type}\n    title: ${r.title}\n    citation: ${r.citation}\n    date: ${r.date}\n    extract: ${r.snippet}`)
    .join('\n')

  const user = [
    `THIS PASS'S METHOD:\n${input.method}`,
    '',
    `MUST-ANSWER QUESTIONS (copy verbatim into \`answered\` only those you actually answered):\n- ${input.mustAnswer.join('\n- ')}`,
    '',
    `THE PROPOSAL AS THE USER HAS WRITTEN IT:\n${input.idea || '(nothing recorded yet)'}`,
    input.costLines.length ? `\nCOST LINES AS ENTERED:\n- ${input.costLines.join('\n- ')}` : '',
    '',
    `SOURCES — the ONLY material you may cite. Use the \`id=\` value as \`sourceId\`:\n${sources}`,
  ].filter(Boolean).join('\n')

  const ctrl = new AbortController()
  const t = setTimeout(() => ctrl.abort(), TIMEOUT_MS)
  try {
    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          // §7 — the lens is APPENDED, never substituted. Every perspective is bound by
          // the same never-claim rules above; what differs is what it looks hardest for.
          system_instruction: { parts: [{ text: opts.lens ? `${SYSTEM}\n\n${opts.lens}` : SYSTEM }] },
          contents: [{ role: 'user', parts: [{ text: user }] }],
          generationConfig: {
            temperature: 0.3,
            maxOutputTokens: MAX_TOKENS,
            responseMimeType: 'application/json',
            responseSchema: SCHEMA,
            thinkingConfig: { thinkingBudget: 0 },
          },
        }),
        signal: ctrl.signal,
      },
    )
    if (!res.ok) {
      console.error(`[${label}] gather HTTP`, res.status, await res.text().catch(() => ''))
      return null
    }
    type Resp = {
      usageMetadata?: Record<string, unknown>
      candidates?: Array<{ finishReason?: string; content?: { parts?: Array<{ text?: string }> } }>
    }
    const data = (await res.json()) as Resp
    // BRIEF_SEARCH_S6 §3 addendum — recorded before any truncation check, because a call
    // cut off at maxOutputTokens was billed in full. Fire-and-forget: a ledger write must
    // never take down the work it is measuring.
    void recordGeminiUsage(data, {
      stream: opts.stream ?? 'deepening',
      pass: opts.label ? `${opts.label}.gather` : 'deepening.gather',
      model: model,
    })
    // ⚠ REPORTED BEFORE THE TRUNCATION CHECK, for the same reason the ledger write is: a
    // call cut off at maxOutputTokens was billed in full, and a cost ceiling that only
    // counts successful calls is a ceiling a failing loop walks straight through.
    if (opts.onUsage) {
      const n = (v: unknown) => (typeof v === 'number' && Number.isFinite(v) ? v : 0)
      const u = data?.usageMetadata
      opts.onUsage({
        model,
        tokensIn: n(u?.promptTokenCount),
        tokensOut: n(u?.candidatesTokenCount) + n(u?.thoughtsTokenCount),
      })
    }

    // BEFORE parsing (CLAUDE.md §18.1). A truncated gather is broken JSON, and reporting it as
    // a parse error would send the next reader looking for a serialiser bug.
    const cut = geminiFinishProblem(data?.candidates?.[0], MAX_TOKENS, { label: `${label}-gather` })
    if (cut) {
      console.error(`[${label}] gather ${cut.reason} — ${cut.detail}`)
      // Truncation is a FAILED run, not a partial one: half a findings array parsed out of a
      // cut-off payload would silently drop the tail and look complete.
      return null
    }

    const text = data?.candidates?.[0]?.content?.parts?.[0]?.text
    if (typeof text !== 'string') return null
    const obj = JSON.parse(text) as Partial<GatherResult>

    const findings = (Array.isArray(obj.findings) ? obj.findings : [])
      .filter((f): f is RawFinding =>
        !!f && typeof f === 'object' &&
        typeof f.title === 'string' && !!f.title.trim() &&
        typeof f.body === 'string' && !!f.body.trim() &&
        typeof f.sourceId === 'string' && !!f.sourceId.trim())
      .map((f) => ({
        kind: (['FINDING', 'PRECEDENT', 'SUPPORTS', 'CONTRADICTS', 'COMPARISON'] as const).includes(f.kind) ? f.kind : 'FINDING',
        title: f.title.trim(),
        body: f.body.trim(),
        sourceId: f.sourceId.trim(),
        fieldRef: typeof f.fieldRef === 'string' && f.fieldRef.trim() ? f.fieldRef.trim() : undefined,
      }))

    return {
      findings,
      // ⚠ BOTH SHAPES. A string is the pre-25-V contract and is still honoured, titleless; an
      // object carries the title. Neither is an error, and a model that mixes them in one array
      // still gets every issue through.
      issues: (Array.isArray(obj.issues) ? obj.issues : []).map((raw: unknown) => {
        if (typeof raw === 'string') return { title: null, text: raw.trim() }
        const o = raw as { title?: unknown; text?: unknown }
        return {
          title: typeof o?.title === 'string' && o.title.trim() ? o.title.trim().slice(0, 120) : null,
          text: typeof o?.text === 'string' ? o.text.trim() : '',
        }
      }).filter((x) => x.text),
      answered: (Array.isArray(obj.answered) ? obj.answered : []).map(String).map((s) => s.trim()).filter(Boolean),
      gaps: (Array.isArray(obj.gaps) ? obj.gaps : []).map(String).map((s) => s.trim()).filter(Boolean),
    }
  } catch (err) {
    console.error(`[${label}] gather failed:`, err instanceof Error ? err.message : err)
    return null
  } finally {
    clearTimeout(t)
  }
}
