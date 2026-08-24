/**
 * passage.ts — SHOW THE PART OF THE DOCUMENT THAT ANSWERS THE QUESTION. SEARCH S13 §3.
 *
 * ════════════════════════════════════════════════════════════════════════════════════════════════
 * WHAT WAS WRONG, MEASURED RATHER THAN ASSERTED
 *
 * Both retrieval legs displayed `body.slice(0, 300)` — the first ~50 words of the document,
 * whatever the query was:
 *
 *   · sparse — `fts-core.ts::toHit`:              `snippet: body.slice(0, 300)`
 *   · dense  — `vector-query-service.ts::snippets`: the FIRST chunk's body, `.slice(0, 300)`,
 *              because `vectorSearchSections` collapses every chunk hit to its `sectionId` and
 *              throws the winning `chunkId` away (vector-core.ts, the `best` map).
 *
 * On the validated debates set the keyed speeches run 920–5,714 words. For Lord Gardiner's 1969
 * speech on the death penalty (31,657 chars) the user was shown 300 of them — 0.9% of the
 * document, from the top, which for a Lords speech is the opening courtesies. The argument the
 * question asked for was in the store, retrieved, ranked, displayed — and not visible.
 *
 * ── WHY ONE MODULE AND NOT TWO ──────────────────────────────────────────────────────────────────
 * ⚠ THE TWO LEGS MUST AGREE ON WHAT THEY DISPLAY. If the dense leg showed the matched paragraph
 * and the sparse leg the head of the document, the SAME document would appear twice in different
 * clothes depending on which leg found it — the exact defect S11 fixed for case-law titles, and
 * the reason `legislation-url.ts` and `political-title.ts` are each one file with two callers.
 * Fusion keeps the first copy it sees (`fuseWeightedRrf`'s `byId`, vector before bm25), so which
 * leg's text a user gets is not even stable across queries. Both services call THIS function.
 *
 * ── THE RULE, AND WHAT IT REFUSES TO DO ─────────────────────────────────────────────────────────
 * Pick the window of `chars` characters covering the most DISTINCT query terms; break ties on
 * total occurrences, then on the earliest position (so an unmatched document is deterministic).
 * Snap outward to sentence boundaries where that costs little, so the passage reads as prose.
 *
 * ⚠⚠ A PASSAGE THAT MATCHED NOTHING SAYS SO. When no query term appears in the body at all the
 * result is the head of the document — the old behaviour, which is the right fallback — and it is
 * returned with `matched: false` and an empty `terms`. It is NOT dressed up as a match. A caller
 * (and `SEARCH_CONTRACT.md`) can therefore tell "here is the passage that caused this hit" apart
 * from "we could not locate one", which CLAUDE.md §18 requires of every degradation. The count of
 * fallbacks is what makes the §3 verification number honest rather than flattering.
 *
 * ⚠ IT DOES NOT STEM, AND THAT IS DELIBERATE. BM25 matched on the index's own tokenisation, which
 * this module cannot see. A prefix match (`evict` → `evicted`, `evicting`, `eviction`) recovers
 * most of the difference; guessing at a stemmer would make the displayed passage disagree with
 * the reason the document was retrieved, which is worse than a missed inflection.
 */

/** Default passage width. ~500 words of speech, i.e. two or three paragraphs of Hansard — enough
 *  for an argument to be readable, short enough to stay a snippet. Was 300 CHARACTERS. */
export const PASSAGE_CHARS = parseInt(process.env.SEARCH_PASSAGE_CHARS ?? '600', 10)

export interface Passage {
  /** The text to display. Never empty for a non-empty body. */
  text: string
  /** Character offset of `text` within the whitespace-normalised body. */
  start: number
  /** `start + text.length`. */
  end: number
  /** TRUE when at least one query term was located. FALSE means this is the head of the document
   *  and nothing may be claimed about it having matched. */
  matched: boolean
  /** The distinct query terms found inside `text`, lowercased. Empty when `matched` is false. */
  terms: string[]
  /** How far into the document the passage sits, 0..1, so a caller can say "23% of the way in".
   *  0 for a fallback. */
  position: number
}

/**
 * Words that are three characters or longer and still carry no retrieval signal.
 *
 * ⚠⚠ THIS LIST EXISTS BECAUSE THE CHECK CAUGHT ITS ABSENCE, and the failure was not cosmetic.
 * The first version of `passageTerms` was a copy of `fts-core.ts::queryTerms` — "identical, so
 * the two cannot drift" — which keeps every token of three characters or more. So the terms for
 * *"mackerel quota reallocation in the north sea"* included **`the`**, `the` appears in every
 * English document ever written, and the selector reported `matched: true` with a passage centred
 * on a definite article. The §3 verification number — *what proportion of displayed results
 * contain the words that caused the result to be retrieved* — would have come back near 100% for
 * a system that had located nothing at all. A metric inflated by stopwords is worse than no
 * metric, because it reads as a result.
 *
 * ⚠ AND IT IS FAITHFUL TO BM25, NOT A DIVERGENCE FROM IT. BM25 weights a term by its inverse
 * document frequency, so `the` contributes essentially nothing to the score that retrieved the
 * document. Dropping it here selects the passage on the terms that ACTUALLY scored it. What would
 * be a divergence is stemming, which is why this module still does not stem.
 *
 * ⚠ `fts-core.ts::queryTerms` IS DELIBERATELY UNCHANGED. It feeds the title boost, which is part
 * of ranking; narrowing it would move results, and this sprint changes what is DISPLAYED, not
 * what is ranked. The two functions are now different on purpose, and this is the purpose.
 */
const STOPWORDS = new Set([
  'the', 'and', 'for', 'are', 'but', 'not', 'you', 'all', 'any', 'can', 'her', 'was', 'one',
  'our', 'out', 'has', 'have', 'had', 'his', 'she', 'him', 'they', 'them', 'their', 'there',
  'this', 'that', 'these', 'those', 'with', 'from', 'into', 'onto', 'upon', 'over', 'under',
  'about', 'after', 'before', 'when', 'what', 'which', 'who', 'whom', 'whose', 'why', 'how',
  'been', 'being', 'were', 'will', 'would', 'shall', 'should', 'could', 'may', 'might', 'must',
  'does', 'did', 'done', 'doing', 'its', 'it’s', 'than', 'then', 'also', 'such', 'some', 'more',
  'most', 'much', 'many', 'other', 'others', 'each', 'every', 'both', 'own', 'same', 'very',
  'just', 'only', 'still', 'yet', 'get', 'got', 'make', 'made', 'say', 'said', 'says',
])

/**
 * The query's CONTENT terms — three characters or more, stopwords removed, de-duplicated.
 *
 * ⚠ If the query is nothing but stopwords the unfiltered list is returned rather than an empty
 * one: an empty term list would make every document report `matched: false`, which is a claim
 * about the documents when the fact is about the query.
 */
export function passageTerms(q: string): string[] {
  const all = [...new Set(q.toLowerCase().split(/[^a-z0-9]+/).filter((t) => t.length >= 3))]
  const content = all.filter((t) => !STOPWORDS.has(t))
  return content.length ? content : all
}

/** Whitespace-normalised body. The chunker does the same (`chunk.ts`), so offsets computed here
 *  are comparable with chunk offsets. */
export function normaliseBody(raw: string): string {
  return (raw ?? '').replace(/\s+/g, ' ').trim()
}

/** Occurrences of `term` as a word PREFIX, so `evict` finds `evicted`. Returns start offsets. */
function occurrences(hay: string, term: string): number[] {
  const out: number[] = []
  let i = 0
  for (;;) {
    const at = hay.indexOf(term, i)
    if (at < 0) break
    // word start: preceded by a non-alphanumeric (or the string start). No requirement on the
    // END, which is what makes this a prefix match.
    const before = at === 0 ? ' ' : hay[at - 1]
    if (!/[a-z0-9]/.test(before)) out.push(at)
    i = at + 1
  }
  return out
}

/**
 * The best `chars`-wide window of `body` for `terms`.
 *
 * ⚠ THE SCAN IS OVER EVERY CANDIDATE WINDOW, NOT A SAMPLE. Candidates are anchored at each term
 * occurrence, so the window maximising distinct-term coverage is always among them: any optimal
 * window can be slid until its left edge sits on an occurrence without losing a term.
 */
export function bestPassage(rawBody: string, terms: string[], chars: number = PASSAGE_CHARS): Passage {
  const body = normaliseBody(rawBody)
  if (!body) return { text: '', start: 0, end: 0, matched: false, terms: [], position: 0 }
  const lower = body.toLowerCase()
  const wanted = [...new Set(terms.map((t) => t.toLowerCase()).filter((t) => t.length >= 3))]

  // Every occurrence of every term, once.
  const hits: Array<{ at: number; term: string }> = []
  for (const t of wanted) for (const at of occurrences(lower, t)) hits.push({ at, term: t })
  hits.sort((a, b) => a.at - b.at)

  const head = () => {
    const cut = snapEnd(body, Math.min(chars, body.length))
    return { text: body.slice(0, cut), start: 0, end: cut, matched: false, terms: [], position: 0 }
  }
  if (!hits.length) return head()
  if (body.length <= chars) {
    return { text: body, start: 0, end: body.length, matched: true, terms: [...new Set(hits.map((h) => h.term))], position: 0 }
  }

  let best: { start: number; distinct: number; total: number } | null = null
  for (const anchor of hits) {
    // Centre the window on the anchor, then clamp — a term at the very start of a window reads as
    // if the passage began mid-argument.
    let start = Math.max(0, Math.min(anchor.at - Math.floor(chars / 3), body.length - chars))
    const end = start + chars
    const inWindow = hits.filter((h) => h.at >= start && h.at < end)
    const distinct = new Set(inWindow.map((h) => h.term)).size
    const total = inWindow.length
    if (!best || distinct > best.distinct || (distinct === best.distinct && total > best.total)) {
      best = { start, distinct, total }
    }
  }
  const s = snapStart(body, best!.start)
  const e = snapEnd(body, Math.min(body.length, s + chars))
  const text = body.slice(s, e)
  const lowerText = text.toLowerCase()
  return {
    text,
    start: s,
    end: e,
    matched: true,
    terms: wanted.filter((t) => occurrences(lowerText, t).length > 0),
    position: body.length ? Math.round((s / body.length) * 100) / 100 : 0,
  }
}

/** Move the start forward to just after the previous sentence end, if one is close. Keeps the
 *  passage from opening mid-word or mid-clause. */
function snapStart(body: string, start: number): number {
  if (start <= 0) return 0
  const back = body.slice(Math.max(0, start - 160), start)
  const m = back.lastIndexOf('. ')
  if (m >= 0) return Math.max(0, start - 160) + m + 2
  const sp = body.indexOf(' ', start)
  return sp >= 0 && sp - start < 40 ? sp + 1 : start
}

/** Move the end forward to the next sentence end, if one is close; otherwise back to a word
 *  boundary, so the passage never ends mid-word. */
function snapEnd(body: string, end: number): number {
  if (end >= body.length) return body.length
  const fwd = body.slice(end, Math.min(body.length, end + 160))
  const m = fwd.indexOf('. ')
  if (m >= 0) return end + m + 1
  const sp = body.lastIndexOf(' ', end)
  return sp > 0 ? sp : end
}

/**
 * A one-line human statement of where the passage sits. Rendered beside the text because a
 * paragraph pulled out of the middle of a long speech is disorienting without it — and because
 * §3 requires the passage to carry its place in the document, not just its words.
 * Returns null for a fallback: there is no "matched here" to state.
 */
export function passageLocation(p: Passage, bodyChars: number): string | null {
  if (!p.matched) return null
  if (p.start === 0 && p.end >= bodyChars) return 'the whole document'
  const pctIn = Math.round(p.position * 100)
  return pctIn <= 5 ? 'from the opening' : `about ${pctIn}% of the way through`
}
