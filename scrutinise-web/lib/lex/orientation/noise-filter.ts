// ─────────────────────────────────────────────────────────────────────────────
// §6d.2 — the noise filter (the extraction contract).
//
// X carries substantive argument buried in noise. The filter has TWO halves and
// they are deliberately kept separate, because only one of them can be tested:
//
//   1. THE PROMPT HALF (below, exported as text) — discards ad hominem, sarcasm-
//      only remarks, straw-man restatements of the other side, irrelevant segues
//      and pile-ons. These are semantic judgements; no regex does them, and a
//      lexical blocklist would fail on the interesting cases (a well-argued post
//      that quotes an insult) while catching innocent ones. The model does this.
//
//   2. THE DETERMINISTIC HALF (below, as code) — the rules that CAN be checked:
//      required fields, undated items dropped (§6d.1), claims with no reason
//      dropped (§6d.2 "keeps: claims accompanied by reasons or evidence"),
//      deduplication to one exemplar per argument, and caps.
//
// The split is stated rather than blurred: if this layer under-performs, half of
// it is a prompt to tune and half is code to fix, and it matters which.
//
// FLAG: LEX_ORIENTATION_NOISE_FILTER. Defaults ON when orientation is on; set it
// to 'false' to run the layer raw, which is how its contribution is measured in
// isolation (§6d.2 requires its own on/off flag). With the filter OFF, the
// prompt half is replaced by a neutral instruction and the deterministic half
// enforces only what the type contract cannot do without: a date and a source.
// ─────────────────────────────────────────────────────────────────────────────

import type { ArgumentItem, RecencyItem, VoiceItem } from './types'

export function noiseFilterEnabled(): boolean {
  return process.env.LEX_ORIENTATION_NOISE_FILTER !== 'false'
}

/** The prompt half. Injected into the X extraction prompts when the flag is on. */
export const NOISE_FILTER_PROMPT = `EXTRACTION CONTRACT — apply strictly.

DISCARD, without exception:
- ad hominem: anything attacking the person rather than the position
- sarcasm-only or purely derisive remarks that carry no argument
- straw-man restatements of the opposing view (a characterisation of the other side rather than a position held by the poster)
- irrelevant segues, and posts riding the topic to argue something else
- pile-ons and pure virality: reply-chains and dunks that repeat a point already captured

KEEP only:
- claims that come WITH a reason or evidence — the reason must be stated in the post, not supplied by you
- ONE exemplar per distinct argument. If twenty people make the same argument, return the clearest single statement of it and say how many times you saw it. Repetition is a measure of how widely it circulates, NEVER of how strong it is.
- clearly attributed positions: a real handle or name, and a real post date

Flag anything that looks anonymous-viral or bot-like as low credibility rather than dropping it silently.

You are reporting WHAT IS BEING ARGUED. You are not adjudicating whether it is true, and you must not repair, strengthen or complete a weak argument.`

/** The neutral replacement used when the filter is OFF, so the A/B is a fair one:
 *  same task, same schema, no extraction contract. */
export const NOISE_FILTER_PROMPT_OFF = `Return what you find. Do not filter for quality.`

// ── the deterministic half ────────────────────────────────────────────────────

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/

/** Normalise a model-written date to yyyy-mm-dd, or null if it is not a real date. */
export function normaliseDate(raw: unknown): string | null {
  if (typeof raw !== 'string') return null
  const s = raw.trim()
  if (!s) return null
  const iso = ISO_DATE.test(s) ? s : (/^\d{4}-\d{2}-\d{2}T/.test(s) ? s.slice(0, 10) : null)
  const candidate = iso ?? (() => {
    const d = new Date(s)
    return Number.isNaN(d.getTime()) ? null : d.toISOString().slice(0, 10)
  })()
  if (!candidate || !ISO_DATE.test(candidate)) return null
  const t = Date.parse(`${candidate}T00:00:00Z`)
  if (Number.isNaN(t)) return null
  // A date in the future is a model artefact, not a post date.
  if (t > Date.now() + 36 * 3600 * 1000) return null
  // Nothing before X existed can be an X post; nothing before the web can be a web source.
  if (candidate < '1990-01-01') return null
  return candidate
}

/** True when `date` falls inside the recency window ending now. */
export function withinWindow(date: string, days: number): boolean {
  const t = Date.parse(`${date}T00:00:00Z`)
  if (Number.isNaN(t)) return false
  return t >= Date.now() - days * 24 * 3600 * 1000
}

const STOPWORDS = new Set([
  'the', 'a', 'an', 'and', 'or', 'but', 'of', 'to', 'in', 'on', 'for', 'is', 'are', 'be', 'been',
  'that', 'this', 'it', 'as', 'by', 'with', 'from', 'at', 'was', 'were', 'will', 'would', 'should',
  'could', 'has', 'have', 'had', 'not', 'no', 'they', 'their', 'them', 'we', 'our', 'you', 'your',
])

function tokenSet(s: string): Set<string> {
  return new Set(
    s.toLowerCase()
      .replace(/[^a-z0-9\s]/g, ' ')
      .split(/\s+/)
      .filter((w) => w.length > 2 && !STOPWORDS.has(w)),
  )
}

function jaccard(a: Set<string>, b: Set<string>): number {
  if (!a.size || !b.size) return 0
  let inter = 0
  for (const t of a) if (b.has(t)) inter++
  return inter / (a.size + b.size - inter)
}

/** Two claims are the same argument when their content words overlap this much. */
const DEDUPE_THRESHOLD = 0.6

/**
 * Deduplicate to ONE exemplar per distinct argument (§6d.2). The exemplar kept is
 * the EARLIEST-dated one — the first person to make an argument, not the loudest
 * — and `repetitions` counts what collapsed into it.
 *
 * Deliberately not sorted by `repetitions` anywhere downstream: repetition is
 * salience, never strength.
 */
export function dedupeArguments(items: ArgumentItem[]): ArgumentItem[] {
  const kept: { item: ArgumentItem; tokens: Set<string> }[] = []
  const ordered = [...items].sort((a, b) => a.date.localeCompare(b.date))
  for (const item of ordered) {
    const tokens = tokenSet(`${item.claim} ${item.reason}`)
    const match = kept.find((k) => k.item.stance === item.stance && jaccard(k.tokens, tokens) >= DEDUPE_THRESHOLD)
    if (match) {
      match.item.repetitions += Math.max(1, item.repetitions)
      continue
    }
    kept.push({ item: { ...item, repetitions: Math.max(1, item.repetitions) }, tokens })
  }
  return kept.map((k) => k.item)
}

/** The same collapse for dated narrative items (developments, controversies, risks). */
export function dedupeRecency<T extends RecencyItem | VoiceItem>(items: T[], key: (t: T) => string): T[] {
  const kept: { item: T; tokens: Set<string> }[] = []
  for (const item of [...items].sort((a, b) => b.date.localeCompare(a.date))) {
    const tokens = tokenSet(key(item))
    if (kept.some((k) => jaccard(k.tokens, tokens) >= DEDUPE_THRESHOLD)) continue
    kept.push({ item, tokens })
  }
  return kept.map((k) => k.item)
}

export interface FilterCounts { kept: number; discarded: number }

/**
 * Apply the deterministic half to a mined argument set.
 * `enabled === false` keeps everything that is structurally usable (dated +
 * attributed + non-empty claim) but applies no quality rule and no dedupe — the
 * measurable-in-isolation control.
 */
export function filterArguments(
  items: ArgumentItem[],
  opts: { enabled: boolean; cap: number },
): { items: ArgumentItem[]; counts: FilterCounts } {
  const before = items.length
  // Structural minimum, applied either way: without a date and a source there is
  // nothing to attribute and §6d.1 says drop it.
  let out = items.filter((i) => i.claim.trim() && i.date && i.source.url && i.source.label)

  if (opts.enabled) {
    // §6d.2 "keeps: claims accompanied by reasons or evidence".
    out = out.filter((i) => i.reason.trim().length > 0)
    out = dedupeArguments(out)
  }

  // Stable, meaning-free presentation order: stance groups, then oldest first.
  // NOT by repetitions — see the rule above.
  const stanceRank = { for: 0, against: 1, nuanced: 2 } as const
  out.sort((a, b) => stanceRank[a.stance] - stanceRank[b.stance] || a.date.localeCompare(b.date))
  out = out.slice(0, opts.cap)

  return { items: out, counts: { kept: out.length, discarded: before - out.length } }
}
