// ─────────────────────────────────────────────────────────────────────────────
// SPRINT 25-F §4 — A QUERY IS WRITTEN, NOT EXTRACTED.
//
// ⚠ THE DIAGNOSIS FIRST, because the brief's description of the symptom is half wrong and
// the wrong half would have sent the fix to the wrong place.
//
// The query pass 1 issued on Charlie's build was:
//
//   B_CONTEXTUALISED :: civil service public failure accountability responsibility cost
//   deliver sector process accountable those system pr
//
// The brief reads that as "truncated mid-word at `pr`". IT IS NOT. The stored value on the
// row is the whole string — `… system private care homes northern lack :: context(1359
// chars)` (docs/LEX_FIRST_BUILD_KERNEL.md line 255). The `pr` is where the BRIEF's own
// blockquote wrapped. There is no character-limit truncation anywhere in the query path:
// `IdeaBuild.queryUsed` is an unbounded `String?`, and `termsFrom` slices a TERM ARRAY, not
// a string, so it cannot cut a word in half.
//
// ⚠ WHAT IS REAL IS THE OTHER HALF, AND IT IS WORSE. `termsFrom()` (build-config.ts) is a
// term-frequency counter over the user's own prose against a 45-word stopword list. So:
//
//   · `those` is in the query because the list does not contain it — and `system`,
//     `process`, `lack`, `deliver` are there because they are frequent, not because they
//     are what anyone would search for.
//   · EVERY LIBRARY QUESTION ISSUES THE SAME QUERY. `withTerms()` in
//     interrogation-library.ts is `termsFrom(d.text, 14)` plus four or five literals, so
//     nine questions sent fourteen identical terms and differed by a handful of words.
//     "231 sources read; 0 cited" is what that looks like from the other end.
//   · A vocabulary problem cannot be solved by better extraction FROM THE SAME
//     VOCABULARY. The user wrote "nobody is accountable"; the terms of art are Carltona,
//     Osmotherly, Accounting Officer, Senior Responsible Owner. No amount of counting the
//     user's words produces any of them. That is §2b's job, and this file is what carries
//     what it finds into retrieval.
//
// SO THIS MODULE DOES TWO THINGS AND KEEPS THEM APART:
//
//   1. `writeQueries()` — ONE model call that composes a purposeful query per job, given
//      what each job is for. One call for all of them rather than one per question: nine
//      extra round trips inside a pass that already hits its 240-second budget would buy
//      a better query and lose two questions.
//   2. `queryDefects()` — the ASSERTION, as a pure function, so `check:lex-25f` can run it
//      over the real historic query and watch it fail. A rule that only exists inside the
//      writer is a rule that stops applying the moment the writer is bypassed.
//
// ⚠ THE FALLBACK IS NAMED, NOT SILENT. When the writer fails, the extraction is used —
// losing the query would lose the question — and the issued query is recorded with
// `provenance: 'extracted'`. §18's rule: a degradation must announce itself. A build where
// every query fell back and a build where every query was written must not read the same.
// ─────────────────────────────────────────────────────────────────────────────

import { callJson } from './build-llm'
import { llmOk, type LlmUsage } from './build-llm'
import { modelForPass, termsFrom, type BuildPassKey } from './build-config'

/** A query as actually issued, with the account of why it looks the way it does. */
export interface IssuedQuery {
  /** The job that issued it — a library question id, or a pass key. */
  by: string
  /** The terms handed to the gateway, in order. */
  terms: string[]
  /** One line: what this query is trying to find, and why those words. */
  purpose: string
  /**
   * `written`   — composed for this job by `writeQueries`.
   * `extracted` — the term-frequency fallback. See the header: recorded, never hidden.
   */
  provenance: 'written' | 'extracted'
}

/**
 * A strict stopword list — the one the extraction should have had.
 *
 * ⚠ IT IS USED AS AN ASSERTION, NOT AS A FILTER. Filtering a bad query into a
 * less-bad one is how a keyword dump survives with its worst three words removed;
 * `queryDefects` reports the presence of any of these so the query is REWRITTEN.
 */
export const QUERY_STOPWORDS: ReadonlySet<string> = new Set([
  'the', 'and', 'that', 'this', 'these', 'those', 'with', 'from', 'have', 'has', 'had',
  'they', 'their', 'them', 'there', 'here', 'about', 'would', 'should', 'could', 'because',
  'which', 'what', 'when', 'where', 'while', 'after', 'before', 'above', 'below', 'between',
  'through', 'during', 'again', 'further', 'once', 'into', 'over', 'under', 'more', 'most',
  'some', 'such', 'than', 'then', 'will', 'been', 'being', 'were', 'your', 'ours', 'also',
  'just', 'very', 'much', 'many', 'need', 'want', 'other', 'others', 'each', 'only', 'both',
  'same', 'own', 'too', 'any', 'all', 'few', 'not', 'nor', 'now', 'does', 'did', 'doing',
  'having', 'must', 'make', 'made', 'take', 'taken', 'give', 'given', 'said', 'says',
  'thing', 'things', 'something', 'anything', 'everything', 'nothing',
])

/**
 * Short strings that are whole words in this domain, so the mid-token rule does not fire
 * on them. Everything else under three characters is treated as a fragment.
 */
const WHOLE_SHORT_WORDS: ReadonlySet<string> = new Set([
  'uk', 'eu', 'mp', 'ai', 'hs', 'vat', 'nao', 'nhs', 'dwp', 'hmt', 'sro', 'act', 'law',
  'tax', 'gdp', 'ico', 'fca', 'hse', 'cma', 'cps', 'mod', 'dfe', 'dhs', 's.', 'si',
])

export type QueryDefectKind = 'empty' | 'mid-token' | 'stopword' | 'keyword-dump'

export interface QueryDefect {
  kind: QueryDefectKind
  detail: string
}

/**
 * §4's assertion, as a pure function over the terms actually issued.
 *
 * FOUR RULES, and each one names a real query that broke it:
 *
 *  · `empty`        — a query with no terms retrieves the whole corpus by relevance to
 *                     nothing. It has to be a failure, not a search.
 *  · `mid-token`    — a fragment: under three characters and not a whole word in this
 *                     domain, or a strict prefix of another term in the same query
 *                     (`pr` beside `process`). This is the shape a character-limited
 *                     truncation leaves behind, and it is asserted whether or not one
 *                     is currently possible — the truncation the brief suspected does
 *                     not exist today, and the cheapest way to keep it that way is a
 *                     rule that fires if it ever comes back.
 *  · `stopword`     — any term in QUERY_STOPWORDS. `those` shipped in a live query.
 *  · `keyword-dump` — ten or more terms, every one a single bare word, not one phrase or
 *                     term of art among them. That is not a query, it is a word count.
 */
export function queryDefects(terms: string[]): QueryDefect[] {
  const out: QueryDefect[] = []
  const clean = (terms ?? []).map((t) => String(t ?? '').trim()).filter(Boolean)

  if (!clean.length) {
    return [{ kind: 'empty', detail: 'the query has no terms' }]
  }

  for (const t of clean) {
    const lower = t.toLowerCase()
    if (QUERY_STOPWORDS.has(lower)) {
      out.push({ kind: 'stopword', detail: `"${t}" is a stopword and carries no retrieval signal` })
    }
  }

  for (const t of clean) {
    const lower = t.toLowerCase()
    if (/\s/.test(t)) continue // a phrase is never a fragment
    if (lower.endsWith('-')) {
      out.push({ kind: 'mid-token', detail: `"${t}" ends in a hyphen, which is a cut word` })
      continue
    }
    if (lower.length < 3 && !WHOLE_SHORT_WORDS.has(lower)) {
      out.push({ kind: 'mid-token', detail: `"${t}" is too short to be a whole word` })
      continue
    }
    // `pr` beside `process` — the signature of a slice.
    const prefixOf = clean.find(
      (o) => o !== t && o.toLowerCase().startsWith(lower) && o.toLowerCase() !== lower && lower.length < 5,
    )
    if (prefixOf) {
      out.push({ kind: 'mid-token', detail: `"${t}" is a truncation of "${prefixOf}" in the same query` })
    }
  }

  const anyPhrase = clean.some((t) => /\s/.test(t))
  if (clean.length >= 10 && !anyPhrase) {
    out.push({
      kind: 'keyword-dump',
      detail: `${clean.length} bare single words and no phrase or term of art — a word count, not a query`,
    })
  }

  return out
}

/** Convenience: is this query fit to issue? */
export function queryIsWellFormed(terms: string[]): boolean {
  return queryDefects(terms).length === 0
}

/**
 * The one line the progress display and the report show for a query.
 * Never invents a purpose it does not have.
 */
export function describeQuery(q: IssuedQuery): string {
  const defects = queryDefects(q.terms)
  return [
    `${q.by}: ${q.terms.join(' · ')}`,
    q.purpose ? `— ${q.purpose}` : '',
    q.provenance === 'extracted' ? '⚠ fell back to term extraction' : '',
    defects.length ? `⚠ ${defects.map((d) => d.detail).join('; ')}` : '',
  ].filter(Boolean).join(' ')
}

// ── The writer ───────────────────────────────────────────────────────────────

/** One job a query is wanted for. */
export interface QueryJob {
  id: string
  /** The question this query is meant to answer, in words. */
  question: string
  /** What counts as a hit — one or two lines from the job's own method. */
  lookingFor: string
  /** Terms of art this job always wants alongside whatever is composed. */
  anchors?: string[]
}

interface WrittenQuerySet {
  queries: Array<{ id: string; terms: string[]; purpose: string }>
}

const WRITER_SCHEMA = {
  type: 'object',
  properties: {
    queries: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          id: { type: 'string' },
          terms: { type: 'array', items: { type: 'string' } },
          purpose: { type: 'string' },
        },
        required: ['id', 'terms', 'purpose'],
      },
    },
  },
  required: ['queries'],
}

const WRITER_SYSTEM = [
  'You write SEARCH QUERIES against a corpus of UK legislation, case law, committee reports, debates,',
  'impact assessments, statutory guidance and official statistics. You are not summarising and you are',
  'not answering — you are choosing the words most likely to RETRIEVE the right documents.',
  '',
  '⚠ THE FAILURE YOU ARE REPLACING. The previous version of this step counted word frequencies in the',
  "user's own prose and sent the top fourteen. It sent `those`, `system`, `process` and `lack`, it sent",
  'the SAME fourteen words for every question, and it retrieved 231 documents of which none was worth',
  'citing. Do not reproduce it.',
  '',
  'FOR EACH JOB, WRITE ONE QUERY. Rules, in order of importance:',
  '',
  '1. TERMS OF ART BEAT THE USER\'S WORDS. A user writes "nobody is accountable"; the record says',
  '   "Accounting Officer", "Carltona", "Osmotherly Rules", "Senior Responsible Owner", "accounting',
  '   direction". If you know the name the field actually uses, USE IT — that is the single most',
  '   valuable thing you can contribute here. Where you are not sure the term is right, include it',
  '   anyway alongside the plainer wording: a query is a net, not an assertion.',
  '2. WRITE FOR THE JOB, NOT FOR THE IDEA. Two jobs about the same proposal must not produce the same',
  '   query. A question about whether a power already exists wants enabling words ("may by regulations",',
  '   "confer", "direction"); a question about what happened when it was tried wants evaluation words',
  '   ("post-implementation review", "impact assessment", "evaluation").',
  '3. PHRASES ARE ALLOWED AND ARE USUALLY BETTER. "duty of candour" retrieves what "duty" and "candour"',
  '   separately do not. Include at least one multi-word phrase in every query.',
  '4. NO STOPWORDS. Not one. `the`, `those`, `with`, `should`, `many`, `thing` and their kind carry no',
  '   retrieval signal and dilute everything beside them.',
  '5. NO FRAGMENTS. Every term is a whole word or a whole phrase. Never abbreviate to fit.',
  '6. SIX TO TWELVE TERMS. Fewer is usually better. A long query retrieves the average of its words.',
  '7. `purpose` is ONE SENTENCE saying what this query is trying to surface and why those words. It is',
  '   read by a human diagnosing a bad search, so "relevant documents" is useless and',
  '   "the enabling provision, so the words are the ones a conferring section actually uses" is not.',
  '',
  '⚠ ONE ENTRY PER JOB ID, using the id EXACTLY as given. A job you cannot write a distinct query for',
  'still gets an entry — write the best you can and say so in `purpose`. Silently dropping a job means',
  'that question is asked with a fallback nobody chose.',
].join('\n')

/**
 * Compose a query for every job in one call.
 *
 * ⚠ ONE CALL, NOT ONE PER JOB, and the reason is the research pass's 240-second budget:
 * nine extra round trips inside it would buy better queries at the cost of two questions
 * never being asked, which is a worse trade than it looks.
 *
 * Returns a map keyed by job id. A job the writer omitted, or wrote a defective query for,
 * is simply absent — the caller falls back and RECORDS that it did.
 */
export async function writeQueries(input: {
  jobs: QueryJob[]
  /** What the proposal is, in the user's own words where possible. */
  context: string
  model?: string
  onUsage?: (u: LlmUsage) => void
}): Promise<Map<string, IssuedQuery>> {
  const out = new Map<string, IssuedQuery>()
  if (!input.jobs.length) return out

  const model = input.model ?? modelForPass('RESEARCH')
  const result = await callJson<WrittenQuerySet>({
    model,
    system: WRITER_SYSTEM,
    user: [
      'THE PROPOSAL THESE QUERIES ARE FOR:',
      input.context.slice(0, 6000) || '(nothing supplied)',
      '',
      'THE JOBS. One query each, `id` copied exactly:',
      ...input.jobs.map((j) => [
        `[id=${j.id}]`,
        `  question: ${j.question}`,
        `  what counts as a hit: ${j.lookingFor}`,
        j.anchors?.length ? `  terms this job always wants: ${j.anchors.join(', ')}` : '',
      ].filter(Boolean).join('\n')),
    ].join('\n'),
    schema: WRITER_SCHEMA,
    maxOutputTokens: 4000,
    timeoutMs: parseInt(process.env.LEX_BUILD_TIMEOUT_MS ?? '90000', 10),
    temperature: 0.3,
    label: 'build-query-writer',
  })
  if (input.onUsage) input.onUsage(result.usage)

  if (!llmOk(result)) {
    console.warn('[25f:query] the query writer failed — every job falls back to extraction', {
      reason: result.reason, detail: result.detail, jobs: input.jobs.length,
    })
    return out
  }

  const byId = new Map(input.jobs.map((j) => [j.id, j]))
  for (const q of result.value.queries ?? []) {
    const job = byId.get(String(q?.id ?? '').trim())
    if (!job) continue
    const terms = mergeAnchors((q.terms ?? []).map((t) => String(t ?? '').trim()).filter(Boolean), job.anchors)
    const defects = queryDefects(terms)
    if (defects.length) {
      // ⚠ NOT REPAIRED. A query with a stopword removed is still a query nobody wrote for
      // this job, and quietly patching it would make the assertion unfalsifiable.
      console.warn('[25f:query] the writer produced a defective query — falling back for this job', {
        job: job.id, terms, defects,
      })
      continue
    }
    out.set(job.id, {
      by: job.id,
      terms,
      purpose: String(q.purpose ?? '').trim() || '(the writer gave no purpose)',
      provenance: 'written',
    })
  }

  console.log('[25f:query] queries written', {
    model, asked: input.jobs.length, written: out.size,
    fallingBack: input.jobs.filter((j) => !out.has(j.id)).map((j) => j.id),
  })
  return out
}

/** The job's own anchors, added without duplicating anything the writer already chose. */
function mergeAnchors(terms: string[], anchors?: string[]): string[] {
  if (!anchors?.length) return terms
  const seen = new Set(terms.map((t) => t.toLowerCase()))
  return [...terms, ...anchors.filter((a) => !seen.has(a.toLowerCase()))]
}

/**
 * The fallback, named.
 *
 * ⚠ IT IS STILL `termsFrom`, AND THAT IS DELIBERATE. The point of this sprint is not that
 * extraction is banned; it is that extraction must not be able to pass itself off as a
 * written query. So the fallback keeps the old behaviour exactly — a question asked with a
 * bad query beats a question not asked — and marks itself.
 */
export function extractedQuery(by: string, text: string, anchors: string[] = [], cap = 12): IssuedQuery {
  return {
    by,
    terms: mergeAnchors(termsFrom(text, cap), anchors),
    purpose: 'The query writer did not produce a query for this job, so these are the most frequent '
      + "content words in the draft. They are not a written query and should not be read as one.",
    provenance: 'extracted',
  }
}

/**
 * §4 — "a truncated query is logged as such".
 *
 * Nothing in the current path slices a query string, so this exists to keep it that way:
 * any future caller that does slice one has a function to call, and the defect travels with
 * the query rather than being discovered by reading a wrapped blockquote in a brief.
 */
export function noteQueryDefects(q: IssuedQuery, buildId?: string): QueryDefect[] {
  const defects = queryDefects(q.terms)
  if (defects.length) {
    console.warn('[25f:query] A DEFECTIVE QUERY WAS ISSUED', {
      buildId, by: q.by, provenance: q.provenance, terms: q.terms, defects,
    })
  }
  return defects
}

/** The queries a pass issued, summarised for the pass log's one-line output. */
export function queryProvenanceLine(queries: IssuedQuery[]): string {
  if (!queries.length) return 'no queries issued'
  const written = queries.filter((q) => q.provenance === 'written').length
  const defective = queries.filter((q) => queryDefects(q.terms).length).length
  return `${written} of ${queries.length} queries written`
    + (written < queries.length ? `, ${queries.length - written} fell back to extraction` : '')
    + (defective ? ` — ⚠ ${defective} issued with a defect` : '')
}

/** Re-exported so callers do not have to import a pass key type from two places. */
export type { BuildPassKey }
