// ─────────────────────────────────────────────────────────────────────────────
// model-registry.ts — BRIEF_SEARCH_S6 §2: model choice per call, in ONE place.
//
// 25-A §7 asks for model choice per pass to be configurable. This is that, and it is
// deliberately a LOOKUP WHERE A STRING WAS HARDCODED rather than a rewrite: callers
// keep their own clients and their own prompts, and take the model id from here.
//
// ⚠ THE REASON THIS IS ONE FILE. The truncation guard taught the lesson the hard way —
// a check written per-caller was missing in seven of them (docs/CLAUDE.md §18). A model
// string scattered across a dozen `process.env.X ?? 'gemini-2.5-flash'` expressions has
// the same shape: the moment someone wants a stronger model for one pass, they discover
// there is no single place to say so, and the twelfth caller keeps the old default
// forever.
//
// ⚠ AN UNKNOWN MODEL IS REFUSED AT RESOLVE TIME, NOT AT CALL TIME. A typo in an env var
// otherwise surfaces as a provider 404 inside one pass, hours later, in a log nobody
// reads — and on a fallback path it only fails when the primary has already failed.
//
// ⚠ AND THE REGISTRY DOES NOT MAKE A PROVIDER REACHABLE. `providerFor()` exists so a
// caller can fail loudly instead of sending a Claude model id to Google's endpoint.
// build-llm.ts speaks Gemini only; pointing a pass at Claude without a Claude client is
// a configuration error and should read as one.
//
// Verified model lists: docs/MODEL_CONTRACT.md, from a live /v1/models call on 17 Aug 2026.
// ─────────────────────────────────────────────────────────────────────────────

export type Provider = 'google' | 'anthropic' | 'xai' | 'openai'

/**
 * Models each account could actually reach, read off `/v1/models` on 17 Aug 2026 and corrected
 * by live 1-token calls on 19 Aug 2026 (S8 §7.2).
 *
 * ⚠ THIS IS AN ALLOW-LIST, AND ITS JOB IS TO SAY NO — but it must say no for a reason that is
 * true. `claude-haiku-4-5-20251001` was excluded because the list endpoint did not return it,
 * and a live call proved it answers perfectly well. **Absence from a model list is evidence
 * about the list, not about the model.** Anything added here on the strength of a list read
 * alone should be probed before it is trusted to reject a caller.
 */
export const REACHABLE: Record<Provider, string[]> = {
  google: ['gemini-2.5-flash', 'gemini-2.5-pro'],
  // `claude-haiku-4-5-20251001` is the dated form compile.ts names as its Gemini-429 fallback;
  // verified LIVE on 19 Aug 2026 (HTTP 200, echoing its own id).
  anthropic: ['claude-opus-5', 'claude-sonnet-5', 'claude-fable-5', 'claude-opus-4-8', 'claude-opus-4-7',
    'claude-haiku-4-5', 'claude-haiku-4-5-20251001'],
  // ⚠ 25-D §1a — `grok-4.20-multi-agent-0309` WAS REMOVED, and it is worth saying why rather
  // than leaving a silent absence for someone to "fix" by adding it back.
  //
  // The 25-C sweep found it REJECTED on the chat-completions endpoint every other xAI model
  // answers on — *"Multi Agent requests are not allowed on chat completions"*. Charlie's
  // decision was to drop it, not to route it: multi-vendor multi-agent is not authorised, no
  // pass depends on it, and a specialised endpoint whose contract differs from the one we call
  // is exactly the shape that produced this vendor's worst failure — `grok-3-fast-beta`
  // returning HTTP 200 for months while a different model answered. xAI stays a vendor here
  // because its standard models are reachable; the endpoint we do not call is not listed.
  xai: ['grok-4.6', 'grok-4.5', 'grok-4.3', 'grok-4.20-0309-reasoning',
    'grok-4.20-0309-non-reasoning', 'grok-build-0.1'],
  // ⚠ No key on this machine (probe-model-access.ts, 17 Aug 2026). Listed so that pointing
  // a pass at OpenAI fails with "no key" rather than "unknown model".
  openai: [],
}

/**
 * Model ids that are hardcoded in production today and are NOT in the account's list.
 *
 * ⚠⚠ BOTH ORIGINAL ENTRIES WERE WRONG, AND THE ERROR WAS THE SAME ONE TWICE: A MODEL-LIST READ
 * IS NOT A CALLABILITY TEST. S8 §7.2 made a live 1-token call against each on 19 Aug 2026 and
 * both returned **HTTP 200**. The two failed in opposite directions:
 *
 *   `claude-haiku-4-5-20251001`  200, and the body echoes back `"model":"claude-haiku-4-5-20251001"`.
 *                                It is simply CALLABLE and was never stale — absent from the list
 *                                endpoint, present at the inference endpoint. Now in REACHABLE.
 *
 *   `grok-3-fast-beta`           200 — and the body echoes `"model":"grok-4.3"`. ⚠⚠ xAI SILENTLY
 *                                SUBSTITUTES. The call never failed, no error was ever logged, and
 *                                the model our config named was not the model any user got, on
 *                                every Lex turn that path served since the id was retired. The two
 *                                routes now name `grok-4.3` explicitly.
 *
 * The lesson generalises past these two: **a 200 is not proof you got the model you asked for.**
 * The only reliable check is comparing the request's model to the one the response echoes, which
 * is what `check:s8-config --probe` now asserts.
 *
 * Empty is the correct state. Adding an entry means: hardcoded somewhere, and PROVEN uncallable
 * or silently substituted by a live call — not merely missing from a `/v1/models` response.
 */
export const KNOWN_STALE: Array<{ model: string; where: string; note: string }> = []

/** Every pass that calls a model, with the model it uses today. */
export const PASS_DEFAULTS = {
  // ── Lex conversation and field machine ──
  'lex.chat': 'gemini-2.5-flash',
  'lex.field': 'gemini-2.5-flash',
  'lex.general-chat': 'gemini-2.5-flash',
  'lex.feedback': 'gemini-2.5-flash',
  // ── retrieval support ──
  'search.query-expansion': 'gemini-2.5-flash',
  'search.query-router': 'gemini-2.5-flash',
  // ── the build (25-A) ──
  'build.draft': 'gemini-2.5-flash',
  'build.settle': 'gemini-2.5-flash',
  // ── the user's own documents and links (25-D §4 / §25.6) ──
  // ⚠ ONE CALL PER DOCUMENT, EVER — at ingest. The document is read once into findings and
  // is never sent again, which is what makes a fifty-page report cost nothing per turn.
  'lex.material': 'gemini-2.5-flash',
  // ── the Deepening (§22) ──
  'deepening.gather': 'gemini-2.5-flash',
  'deepening.sift': 'gemini-2.5-flash',
  /** ⚠ The adversarial read is the pass most likely to want a different model — see
   *  MODEL_CONTRACT.md §5. It is a one-line override away, and it is NOT changed here,
   *  because a model swap belongs behind an A/B on a gold set. */
  'deepening.adversarial': 'gemini-2.5-flash',
  // ── orientation ──
  'orientation.web': 'gemini-2.5-flash',
  'orientation.x': 'grok-4.3',
  // ── the graph ──
  'graph.position-extract': 'gemini-2.5-flash',
  'graph.proposition-derive': 'gemini-2.5-flash',
} as const

export type PassName = keyof typeof PASS_DEFAULTS

/** `deepening.adversarial` → `LEX_MODEL__DEEPENING__ADVERSARIAL` */
export function envVarFor(pass: PassName): string {
  return `LEX_MODEL__${pass.replace(/[.-]/g, '_').toUpperCase()}`
}

export function providerFor(model: string): Provider | null {
  for (const [p, list] of Object.entries(REACHABLE) as Array<[Provider, string[]]>) {
    if (list.includes(model)) return p
  }
  if (/^gemini-/.test(model)) return 'google'
  if (/^claude-/.test(model)) return 'anthropic'
  if (/^grok-/.test(model)) return 'xai'
  if (/^(gpt-|o\d)/.test(model)) return 'openai'
  return null
}

const isReachable = (model: string) =>
  (Object.values(REACHABLE) as string[][]).some((list) => list.includes(model))

export interface ModelChoice {
  model: string
  provider: Provider
  /** TRUE when an env var overrode the registry default. */
  overridden: boolean
}

/**
 * The model for a pass: env override, else the registry default.
 *
 * Throws on an unknown pass, an unroutable model string, or an override naming a model
 * no account lists. ⚠ Throwing is the point — see the header. The one exception is a
 * registry DEFAULT that has gone stale, which is reported by `check:model-registry`
 * rather than by exploding at runtime and taking a working pass down with it.
 */
export function resolveModel(pass: PassName): ModelChoice {
  const dflt = PASS_DEFAULTS[pass]
  if (!dflt) throw new Error(`[model-registry] unknown pass "${pass}" — add it to PASS_DEFAULTS`)

  const raw = process.env[envVarFor(pass)]?.trim()
  if (!raw) {
    const provider = providerFor(dflt)
    if (!provider) throw new Error(`[model-registry] default "${dflt}" for ${pass} has no known provider`)
    return { model: dflt, provider, overridden: false }
  }

  const provider = providerFor(raw)
  if (!provider) {
    throw new Error(`[model-registry] ${envVarFor(pass)}="${raw}" names no known provider. `
      + `Reachable: ${Object.values(REACHABLE).flat().join(', ')}`)
  }
  if (!isReachable(raw)) {
    const stale = KNOWN_STALE.find((s) => s.model === raw)
    throw new Error(`[model-registry] ${envVarFor(pass)}="${raw}" is not in any account's model list `
      + `(verified 17 Aug 2026, docs/MODEL_CONTRACT.md)${stale ? ` — and it is a KNOWN STALE id: ${stale.note}` : ''}. `
      + `Reachable for ${provider}: ${REACHABLE[provider].join(', ') || '(no key on this deployment)'}`)
  }
  if (!REACHABLE[provider].length) {
    throw new Error(`[model-registry] ${envVarFor(pass)}="${raw}" is a ${provider} model and there is `
      + `no ${provider} key on this deployment`)
  }
  return { model: raw, provider, overridden: true }
}

/** The common case: just the string. */
export const modelFor = (pass: PassName): string => resolveModel(pass).model

/** Every pass and what it resolves to right now — for a startup log or a report. */
export function registrySnapshot(): Array<ModelChoice & { pass: PassName; envVar: string }> {
  return (Object.keys(PASS_DEFAULTS) as PassName[]).map((pass) => {
    try {
      return { pass, envVar: envVarFor(pass), ...resolveModel(pass) }
    } catch {
      return { pass, envVar: envVarFor(pass), model: PASS_DEFAULTS[pass], provider: 'google' as Provider, overridden: false }
    }
  })
}
