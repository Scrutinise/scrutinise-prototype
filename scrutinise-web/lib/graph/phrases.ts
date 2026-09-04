// ─────────────────────────────────────────────────────────────────────────────
// SURFACE 3 §2 — TURNING AN IDEA'S OWN WORDS INTO THINGS THE GRAPH CAN BE ASKED
// ABOUT.
//
// ⚠⚠ WHY THIS FILE EXISTS. MEASURED, ON EVERY LIVE IDEA, BEFORE IT WAS WRITTEN.
//
// `findTargets(query)` runs `title ILIKE '%' || $1 || '%'` with the WHOLE query
// as one pattern. Given a two-word phrase that is a substring match and works;
// given a user's problem statement it is a 200-character pattern that can only
// match if that entire sentence appears verbatim inside a division title. It
// never does.
//
// So `findClaimTarget` returned NO TARGET on **all twelve live ideas in the
// database**, and the title control returned zero candidates on eight of eight.
// 25-Z found this on one idea and called it "the idea→target mapping, not the
// graph". It is not idea-specific: the positions surface has rendered nothing
// for anybody, on every idea, since it shipped.
//
// ── ⚠⚠ AND THE OBVIOUS FIX IS WORSE THAN THE BUG ─────────────────────────────
//
// Splitting the statement into words and matching each one was measured too,
// on the same ideas, and it is not a near miss — it is actively dangerous:
//
//     "diversity"  →  Biodiversity Beyond National Jurisdiction Bill
//     "permanent"  →  Shoemakers Museum shortlisted for Permanent Exhibition
//     "equity"     →  Proposed Energy Equity Commission Bill
//     "appointed"  →  Licensing Act 2003 (Second Appointed Day) Order
//
// Every one of those is a confident, sourced, WRONG attribution: a real member
// really did vote on that division, and presenting it under a user's idea would
// collect judgements about our search while telling them it was a judgement
// about the graph. `findClaimTarget`'s own header says it "returns NULL rather
// than a weak match" for exactly this reason, and a word-level fix would have
// quietly repealed that rule while appearing to fix a bug.
//
// ── THE RULE THIS FILE IMPLEMENTS ────────────────────────────────────────────
//
// Match on PHRASES of two or more words, never on single words, and prefer the
// longest phrase that matches. "civil service", "sentencing guidelines", "Bank
// of England" are subjects; "diversity" and "permanent" are not. A phrase whose
// every word is a parliamentary commonplace ("the bill", "public policy") is
// discarded, because it would match half the corpus.
//
// ⚠ THE MATCHED PHRASE TRAVELS WITH THE MATCH and is shown to the reader. The
// bar this raises is real but it is not high, and the honest thing is to say
// what we matched on so a user can tell us we matched on the wrong thing —
// which is the single most useful judgement they can give us about retrieval.
//
// ⚠ NO NEW DATA SOURCE, NO MODEL CALL, NO NEW INDEX. Brief §0: "If a job here
// needs new retrieval, new inference or a new data source, it belongs in another
// sprint." This is the same two tables queried by the same operator; what
// changes is the pattern handed to it.
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Words that carry no subject on their own. Removed only from the EDGES of a phrase, never from
 * inside it — "Bank of England" and "freedom of information" are subjects and both die if `of` is
 * stripped from the middle.
 */
const EDGE_STOP = new Set([
  'a', 'an', 'the', 'and', 'or', 'but', 'if', 'so', 'that', 'this', 'these', 'those', 'their',
  'there', 'them', 'they', 'it', 'its', 'is', 'are', 'was', 'were', 'be', 'been', 'being', 'has',
  'have', 'had', 'do', 'does', 'did', 'will', 'would', 'can', 'could', 'should', 'may', 'might',
  'must', 'in', 'on', 'at', 'to', 'of', 'for', 'from', 'by', 'with', 'without', 'about', 'into',
  'over', 'under', 'through', 'between', 'because', 'which', 'who', 'whom', 'whose', 'what',
  'when', 'where', 'while', 'than', 'then', 'as', 'not', 'no', 'any', 'all', 'more', 'most',
  'other', 'others', 'such', 'same', 'own', 'very', 'also', 'only', 'both', 'each', 'every',
  'some', 'much', 'many', 'few', 'one', 'two', 'up', 'out', 'off', 'down', 'now', 'here',
  // ⚠ ADDED AFTER MEASURING. The first run produced "during covid" as a phrase and matched it
  // against *Electronic voting in the House of Commons during covid-19* on an idea about
  // government transparency. Every word here is a preposition or conjunction that was missing
  // from the list above and that carries no subject at either end of a phrase.
  'during', 'against', 'within', 'across', 'among', 'amongst', 'before', 'after', 'upon',
  'toward', 'towards', 'per', 'via', 'since', 'until', 'unless', 'although', 'though',
  'however', 'whether', 'therefore', 'thus', 'hence', 'yet', 'still', 'rather', 'instead',
])

/**
 * ⚠ WORDS THAT ARE EVERYWHERE IN PARLIAMENT AND THEREFORE NAME NOTHING.
 *
 * A phrase made ENTIRELY of these is discarded. A phrase containing one is kept — "civil service
 * reform" and "policy" are not the same query, and it is the pairing that carries the subject.
 *
 * ⚠ This is a list about the CORPUS, not about the graph's contents, so it is a list and not a
 * query: it does not go stale when a row is added. It is deliberately short. A long one becomes a
 * hand-tuned relevance model nobody can audit, which is the thing 3A refused to build.
 */
const COMMONPLACE = new Set([
  'bill', 'bills', 'act', 'acts', 'clause', 'clauses', 'amendment', 'amendments', 'motion',
  'motions', 'reading', 'committee', 'government', 'parliament', 'parliamentary', 'house',
  'commons', 'lords', 'minister', 'ministers', 'ministerial', 'secretary', 'state', 'public',
  'national', 'policy', 'policies', 'system', 'systems', 'people', 'change', 'changes', 'new',
  'order', 'orders', 'regulations', 'regulation', 'scheme', 'schemes', 'body', 'bodies',
  'members', 'member', 'law', 'laws', 'legal', 'legislation', 'legislative', 'proposal',
  'proposals', 'issue', 'issues', 'problem', 'problems', 'case', 'cases', 'way', 'ways',
  'thing', 'things', 'time', 'times', 'year', 'years', 'work', 'working', 'made', 'make',
  'making', 'set', 'sets', 'take', 'taken', 'given', 'give', 'used', 'use', 'need', 'needs',
  // ⚠⚠ THE JURISDICTION IS NOT A SUBJECT. Added after the title rule landed and *The United
  // Kingdom Supreme Court* started matching *Young farmers' organisations across the United
  // Kingdom* — "united kingdom" is a phrase from the proposer's own title, so it outranked
  // "constitutional reform" from the body, and it names everything the corpus is about.
  // ⚠ England, Scotland, Wales and Northern Ireland are deliberately NOT here: those distinguish,
  // and a proposal about Northern Ireland really is about Northern Ireland.
  'united', 'kingdom', 'uk', 'britain', 'british', 'nation', 'country',
])

/** The shortest phrase we will match on, in words and in characters. */
export const MIN_PHRASE_WORDS = 2
export const MIN_PHRASE_CHARS = 8
/** The longest — beyond this a phrase is a clause and will not appear in any title. */
export const MAX_PHRASE_WORDS = 4

export interface Phrase {
  /** The phrase as it will be matched, lowercased and space-normalised. */
  text: string
  words: number
  /**
   * ⚠⚠ WORDS THAT ACTUALLY NAME SOMETHING — the raw count minus stopwords and commonplaces. THIS
   * IS THE RANKING NUMBER, and `words` is not.
   *
   * Measured: ranking on the raw count put "public and private" (three words, one of which names
   * anything) above "civil service" (two words, both of which do), and offered *PUBLIC AND PRIVATE
   * HEALTHCARE PROVISION* under a proposal about civil service accountability. A word count is a
   * measure of length; a content-word count is a measure of specificity, and specificity is what
   * the relevance claim rests on.
   */
  contentWords: number
  /**
   * ⚠ FROM THE PROPOSAL'S TITLE, which the proposer wrote as their own summary of the subject.
   *
   * A lexical matcher over a long problem statement WILL find peripheral subjects — "northern
   * ireland" is genuinely in the text of a civil service proposal, and genuinely not what it is
   * about. Nothing in the words themselves can tell the central subject from the passing mention.
   * The title can, because a human chose it, so a title phrase outranks a body phrase.
   */
  fromTitle: boolean
}

/**
 * An idea's free text → the phrases worth asking the graph about, longest first.
 *
 * ⚠ ORDERED BY LENGTH, LONGEST FIRST, and the caller takes the first that matches. A longer
 * phrase is a narrower claim about relevance, so preferring it is preferring the match we can most
 * easily defend — and it means "sentencing guidelines" wins over "sentencing" wherever both match.
 *
 * ⚠ DETERMINISTIC AND PURE. No database, no model, no clock. That is what lets the check assert
 * on it directly with constructed cases, rather than through a live query whose result moves.
 */
export function extractPhrases(text: string, limit = 400): Phrase[] {
  return extractPhrasesFrom('', text, limit)
}

/**
 * The same, with the proposal's TITLE separated from its body so title phrases can outrank body
 * phrases. See `Phrase.fromTitle` for why that distinction is load-bearing rather than cosmetic.
 */
export function extractPhrasesFrom(title: string, body: string, limit = 400): Phrase[] {
  const fromTitle = harvest(title, true)
  const seenInTitle = new Set(fromTitle.map((p) => p.text))
  const fromBody = harvest(body, false).filter((p) => !seenInTitle.has(p.text))
  const out = [...fromTitle, ...fromBody]

  // ⚠ TITLE FIRST, THEN SPECIFICITY, then length in characters, then alphabetically so the order
  // is reproducible. `words` is deliberately NOT a key here — see `contentWords`.
  out.sort((a, b) =>
    Number(b.fromTitle) - Number(a.fromTitle)
    || b.contentWords - a.contentWords
    || b.text.length - a.text.length
    || (a.text < b.text ? -1 : a.text > b.text ? 1 : 0))

  // ⚠⚠ EVERY PHRASE IS TRIED. THE CAP IS A SAFETY VALVE, NOT A SELECTION RULE, AND THE
  // DIFFERENCE BETWEEN THOSE TWO THINGS WAS A BUG THIS FILE HAD TWICE.
  //
  // The sort above ranks phrases so that the best MATCH wins. It is the wrong rule for deciding
  // which phrases to TRY, and using it for both is what broke it:
  //
  //   · v1 sorted longest-first and took the first 40. On a proposal of any length the four-word
  //     phrases fill that quota outright, so the two-word phrases — the ones that actually match
  //     a division title — never reached the query.
  //   · v2 capped per word-count band instead, and it was STILL WRONG, because within a band the
  //     sort is by character length: *Enhancing Civil Service Accountability and Performance* —
  //     the very proposal this sprint exists to put positions into — generated "civil service"
  //     and then dropped it behind "delivering accountability" and "organisational structures",
  //     and reported NO TARGET while a shorter proposal matched the identical phrase.
  //
  // ⚠ Both versions were a RANKING rule quietly acting as a FILTER. There is no selection rule
  // here worth defending, so there is no selection rule: the query takes them all, and only the
  // ranking decides. The cap remains as a bound on a pathological input, and it is high enough
  // that no real proposal reaches it — `findTargetsByPhrases` was restructured to make a query of
  // this width cheap, which is what made removing the filter affordable.
  return out.slice(0, limit)
}

function harvest(text: string, fromTitle: boolean): Phrase[] {
  if (!text) return []
  // Clause boundaries matter: a phrase must not straddle a comma or a full stop, or we would
  // generate "bureaucracy the civil" out of "…bureaucracy. The civil service…".
  const clauses = text
    .toLowerCase()
    .replace(/[’']/g, '')
    .split(/[.,;:!?()\[\]"“”\/–—]+|\s-\s/)

  const seen = new Set<string>()
  const out: Phrase[] = []

  for (const clause of clauses) {
    const words = clause.split(/\s+/).map((w) => w.replace(/[^a-z0-9-]/g, '')).filter(Boolean)
    for (let n = MAX_PHRASE_WORDS; n >= MIN_PHRASE_WORDS; n--) {
      for (let i = 0; i + n <= words.length; i++) {
        let slice = words.slice(i, i + n)
        // Trim stopwords off both ends only.
        while (slice.length && EDGE_STOP.has(slice[0])) slice = slice.slice(1)
        while (slice.length && EDGE_STOP.has(slice[slice.length - 1])) slice = slice.slice(0, -1)
        if (slice.length < MIN_PHRASE_WORDS) continue
        // ⚠ Every word a commonplace → the phrase names nothing and would match half the corpus.
        if (slice.every((w) => COMMONPLACE.has(w) || EDGE_STOP.has(w))) continue
        // ⚠ And a phrase that is ALL stopwords in the middle ("out of the") is not a subject.
        if (slice.every((w) => EDGE_STOP.has(w))) continue
        const phrase = slice.join(' ')
        if (phrase.length < MIN_PHRASE_CHARS) continue
        if (seen.has(phrase)) continue
        // ⚠ AT LEAST TWO WORDS THAT NAME SOMETHING. "public and private" clears MIN_PHRASE_WORDS
        // on a raw count and names one thing; requiring two content words is what stops a long
        // string of connectives from passing as a specific subject.
        const content = slice.filter((w) => !EDGE_STOP.has(w) && !COMMONPLACE.has(w)).length
        if (content < MIN_PHRASE_WORDS) continue
        seen.add(phrase)
        out.push({ text: phrase, words: slice.length, contentWords: content, fromTitle })
      }
    }
  }

  return out
}
