// ─────────────────────────────────────────────────────────────────────────────
// WHICH MODELS REFUSE TO RUN WITHOUT THINKING — found the hard way, 2026-08-19.
//
// This codebase turns thinking OFF on every Gemini call, and for a good reason: §19-D
// Task 2b, where three generators silently returned nothing because thinking ate the
// whole output budget. That rule is right for Flash and is not being relaxed.
//
// ⚠ IT ALSO MADE `gemini-2.5-pro` UNREACHABLE THROUGH EVERY ONE OF OUR CLIENTS. Asked
// for a stronger adversarial reading (25-B §6), the API answered:
//
//     400 — "Budget 0 is invalid. This model only works in thinking mode."
//
// `model-registry.ts` listed `gemini-2.5-pro` as REACHABLE and `MODEL_CONTRACT.md` §5
// recommended it for exactly that pass. **A capability we believed we had and did not** —
// and it would otherwise have surfaced as a 400 inside whichever pass first pointed at
// it, weeks later, on a fallback path where it only fires once the primary has failed.
//
// ⚠ WHY THIS IS ITS OWN FILE AND NOT PART OF `model-registry.ts`, WHICH IS THE OBVIOUS
// HOME. At commit time `model-registry.ts` was mid-flight in another thread's sprint;
// folding this in would have meant shipping their unfinished changes with 25-B. Same
// reasoning as `evidence-layer.ts`.
//
// ▶ FOLLOW-UP, OWNED BY WHICHEVER THREAD LANDS SECOND: move `REQUIRES_THINKING` and
// `thinkingConfigFor` into `model-registry.ts`, where every other model decision lives,
// and have the remaining Gemini callers use them. **Only the adversarial caller uses this
// today** — `build-llm.ts`, `deepening-client.ts`, `deepening-sift.ts`, `general-chat.ts`
// and `lex-client.ts` still hardcode a zero budget, so pointing any of them at
// `gemini-2.5-pro` still 400s. That is recorded rather than quietly half-fixed.
// ─────────────────────────────────────────────────────────────────────────────

/** Models that reject `thinkingBudget: 0` outright. Verified live, not inferred. */
export const REQUIRES_THINKING: string[] = ['gemini-2.5-pro']

export function requiresThinking(model: string): boolean {
  return REQUIRES_THINKING.includes(model)
}

/**
 * The `thinkingConfig` for a model: OFF by default, and a real budget only for the models
 * that refuse to run without one.
 */
export function thinkingConfigFor(model: string): { thinkingBudget: number } {
  return requiresThinking(model)
    ? { thinkingBudget: parseInt(process.env.LEX_THINKING_BUDGET ?? '2048', 10) }
    : { thinkingBudget: 0 }
}

/**
 * Extra output ceiling for a model that must think.
 *
 * ⚠ NOT OPTIONAL, AND THIS IS THE HALF THAT WOULD BITE NEXT. Thinking tokens are billed as
 * output AND count against `maxOutputTokens`, so a thinking model left on the flat budget
 * truncates before it answers — which is §19-D's failure arriving by the other door.
 * `geminiFinishProblem` catches and names it; this is what stops it happening.
 */
export const THINKING_HEADROOM = parseInt(process.env.LEX_THINKING_HEADROOM ?? '4000', 10)

/** The output ceiling a call should use, given its base budget and its model. */
export function outputBudgetFor(model: string, base: number): number {
  return requiresThinking(model) ? base + THINKING_HEADROOM : base
}
