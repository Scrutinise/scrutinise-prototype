// ─────────────────────────────────────────────────────────────────────────────
// public-sources.ts — BRIEF_SEARCH_S7 §2, the "Public sources" block.
//
// The corpus is UK-only, so international comparisons cannot come from it at all. When a user asks
// how another country handled something, the honest answers are (a) say we do not hold it, or
// (b) go outside the corpus and label it unmistakably as outside.
//
// ⚠⚠ NEVER SHARE A CITATION SEQUENCE WITH CORPUS RESULTS. §2 is explicit and the reason is
// commercial as much as editorial: "The corpus's authority is the platform's main asset, and the
// fastest way to spend it is to make a web claim look like a statutory one."
//
// So: corpus citations are [1] [2] [3]. Public sources are [W1] [W2] [W3]. Different prefix,
// different block, different heading, and a rule that they are never renumbered into one list.
// `check-s7-retrieval.ts` asserts the prefixes cannot collide.
//
// ⚠ INSTITUTIONAL SOURCES ARE PREFERRED, and the preference is expressed as an ordered allow-list
// rather than a vague instruction — foreign legislatures, audit offices, statistics agencies, the
// OECD. A blog that happens to rank well is not a comparator for a legislature.
// ─────────────────────────────────────────────────────────────────────────────

export interface PublicSource {
  /** ⚠ ALWAYS "W"-prefixed. Never a bare integer, which is what a corpus citation looks like. */
  marker: string
  title: string
  publisher: string
  url: string
  /** Why this source is being shown — the reader should not have to infer it. */
  why: string
}

/**
 * ⚠ THE PREFIX IS A CONSTANT, NOT A CONVENTION AT EACH CALL SITE.
 *
 * A convention is something a future caller can forget. `[W1]` comes from here, and the check
 * asserts that no corpus renderer can produce a marker matching this pattern.
 */
export const PUBLIC_MARKER_PREFIX = 'W'
export const publicMarker = (i: number) => `${PUBLIC_MARKER_PREFIX}${i + 1}`

/** A corpus marker is a bare integer. Exported so the separation can be TESTED, not assumed. */
export const corpusMarker = (i: number) => `${i + 1}`

/** Do these two marker schemes overlap anywhere in a realistic range? They must not. */
export function markersCollide(n = 200): boolean {
  const corpus = new Set(Array.from({ length: n }, (_, i) => corpusMarker(i)))
  return Array.from({ length: n }, (_, i) => publicMarker(i)).some((m) => corpus.has(m))
}

/**
 * ⚠ THE PREFERENCE ORDER, AS DATA. §2: "Prefer institutional sources — foreign legislatures, audit
 * offices, the OECD." Written down so it can be checked and argued with rather than restated
 * differently in each prompt.
 */
export const PREFERRED_PUBLISHERS: ReadonlyArray<{ pattern: RegExp; kind: string }> = [
  { pattern: /\b(parliament|congress|bundestag|assembl[ée]e|riksdag|folketing|senate|s[ée]nat)\b/i, kind: 'foreign legislature' },
  { pattern: /\b(audit office|court of auditors|rekenkamer|gao|nao)\b/i, kind: 'audit office' },
  { pattern: /\b(oecd|imf|world bank|eurostat|un\b|who\b)\b/i, kind: 'international body' },
  { pattern: /\b(statistics|statistik|statbank|insee|destatis)\b/i, kind: 'statistics agency' },
  { pattern: /\b(ministry|department|government of|gov\.)/i, kind: 'national government' },
]

export function publisherKind(publisher: string): string | null {
  for (const p of PREFERRED_PUBLISHERS) if (p.pattern.test(publisher)) return p.kind
  return null
}

/**
 * The instruction that must accompany the block.
 *
 * ⚠ It says the two things a model will otherwise get wrong: do not merge the numbering, and do
 * not let a web source acquire the corpus's authority by sitting next to it.
 */
export const PUBLIC_SOURCES_INSTRUCTION =
  'The PUBLIC SOURCES below are NOT from our corpus. They are cited [W1], [W2] and so on, and that '
  + 'numbering is SEPARATE from the numbered corpus citations — never merge the two sequences, never '
  + 'renumber a public source into the corpus list, and never present a public source as though it '
  + 'carried the same authority as a statutory or parliamentary document. Say where each one comes '
  + 'from in the sentence that uses it ("the OECD reports…", "the Danish parliament\'s own summary '
  + 'says…"). If the user asked about another country, remind them our corpus is UK-only.'

/** The line to use when the honest answer is that we hold nothing and went nowhere. */
export const NO_PUBLIC_SOURCES =
  'Our corpus is UK-only and no public sources were retrieved for this question. Say plainly that '
  + 'you cannot speak to how other countries have handled it from our sources. Do NOT answer from '
  + 'general knowledge and present it as though it were researched.'

/** Render the block. Returns the no-sources line rather than an empty string, deliberately. */
export function publicSourcesBlock(sources: PublicSource[]): string {
  if (!sources.length) return NO_PUBLIC_SOURCES
  const lines = sources.map((s) => {
    const kind = publisherKind(s.publisher)
    return `[${s.marker}] ${s.title} — ${s.publisher}${kind ? ` (${kind})` : ' ⚠ not an institutional source'}\n`
      + `      ${s.url}\n      ${s.why}`
  })
  return `=== PUBLIC SOURCES (NOT our corpus — separate numbering) ===\n${lines.join('\n')}\n\n${PUBLIC_SOURCES_INSTRUCTION}`
}

/** Attach W-markers in order. The only sanctioned way to number a public source. */
export function markPublicSources(raw: Array<Omit<PublicSource, 'marker'>>): PublicSource[] {
  return raw.map((s, i) => ({ ...s, marker: publicMarker(i) }))
}

// ── offline self-test ───────────────────────────────────────────────────────────────────────
// npx tsx lib/lex/public-sources.ts --self-test
function selftest() {
  const marked = markPublicSources([
    { title: 'Assisted dying in the Netherlands', publisher: 'Tweede Kamer (Dutch Parliament)', url: 'https://x', why: 'a comparator jurisdiction' },
    { title: 'Some blog post', publisher: 'Dave\'s Policy Thoughts', url: 'https://y', why: 'ranked well' },
  ])
  const block = publicSourcesBlock(marked)
  const cases: Array<[string, boolean]> = [
    ['⚠⚠ public markers NEVER collide with corpus markers', !markersCollide()],
    ['a public marker is W-prefixed', marked[0].marker === 'W1'],
    ['a corpus marker is a bare integer', corpusMarker(0) === '1'],
    ['⚠ the block says in its heading that it is NOT our corpus', /NOT our corpus/.test(block)],
    ['⚠ and that the numbering is separate', /separate numbering/i.test(block)],
    ['the instruction forbids merging the sequences', /never merge the two sequences/i.test(block)],
    ['⚠ a foreign legislature is recognised as institutional', publisherKind('Tweede Kamer (Dutch Parliament)') === 'foreign legislature'],
    ['an audit office is recognised', publisherKind('National Audit Office') === 'audit office'],
    ['the OECD is recognised', publisherKind('OECD') === 'international body'],
    ['⚠⚠ a blog is FLAGGED rather than silently accepted', /not an institutional source/.test(block)],
    ['⚠ an empty list produces the honest line, not an empty block',
      publicSourcesBlock([]) === NO_PUBLIC_SOURCES && /corpus is UK-only/.test(NO_PUBLIC_SOURCES)],
    ['   …and that line forbids answering from general knowledge',
      /Do NOT answer from general knowledge/.test(NO_PUBLIC_SOURCES)],
  ]
  let bad = 0
  for (const [n, ok] of cases) { console.log(`  ${ok ? 'PASS' : 'FAIL'}  ${n}`); if (!ok) bad++ }
  console.log(bad ? `\n${bad} FAILED` : `\n${cases.length}/${cases.length} pass`)
  if (bad) process.exit(1)
}
if (require.main === module && process.argv.includes('--self-test')) selftest()
