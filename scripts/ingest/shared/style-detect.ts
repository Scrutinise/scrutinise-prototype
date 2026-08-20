/**
 * style-detect.ts — "is this stored text a stylesheet?", asked of ANY collection.
 *
 * BRIEF_INGEST_CASELAW_TEXT §1.3 asks the same question of six collections, and only one of them
 * is Akoma Ntoso. `shared/caselaw-name.ts::stripAknPreamble` cuts the TNA preamble and is anchored
 * on the literal `#judgment` selector the TNA generator emits — correct there, useless on a
 * BAILII page or a HUDOC document. This module is the source-agnostic half: it finds a run of CSS
 * rules ANYWHERE in a plain-text document, whatever produced them.
 *
 * ⚠ THIS IS A MEASURING INSTRUMENT, NOT A REPAIR. Nothing in the ingest path may use it to strip
 * CSS out of stored text — §2.1 forbids exactly that, because stripping the symptom leaves the
 * writer selecting the wrong node. It is used by the audit, and by the §2.2 guard that refuses to
 * store a body that is predominantly style.
 *
 * ⚠ SCANNED WITH indexOf, NOT WITH A REGEX, AND THAT IS NOT A STYLE PREFERENCE. The first version
 * of this file matched rules with /([^{}]*)\{([^{}]*)\}/g. On a document containing no braces at
 * all — which is most of `et-decisions` — a global regex whose first token is `[^{}]*` retries
 * from every character position, so the scan is quadratic in document length. The §1 audit ran for
 * 12 minutes at 100% CPU on a 2 MB judgment before it was killed. A linear scan over brace
 * positions gives the identical answer in microseconds.
 */

/** A CSS rule body is `prop: value` pairs — or empty, which the TNA generator emits by the dozen. */
const LOOKS_LIKE_DECLARATIONS = /[a-z-]+\s*:\s*[^:;{}]+/i
/**
 * ⚠⚠ AN EMPTY BRACE PAIR COUNTS ONLY IN THE COMPANY OF A REAL RULE, AND THAT CAVEAT COST FOUR
 * JUDGMENTS TO LEARN. The TNA generator emits `#judgment .PageNumber { }` among its real rules, so
 * empty bodies must be allowed inside a run — INGEST-NAMES lost 8 of 30 verification samples to a
 * version that stopped at the first one. But a run of NOTHING BUT empty braces is not a stylesheet:
 * an ANONYMISED family judgment redacts every name to `{ }`, and
 *
 *   "1. This case is about { } ( “W” ), who was born on { } 2025. W is 6 months old. 2. On 17
 *    February 2025 Nottingham City Council ( “the Local Authority” ) applied for a Care Order…"
 *
 * — [2025] EWFC 266 (B), verbatim — was called a stylesheet by the first version of this file and
 * refused by the §2.2 guard. So a run qualifies only if at least ONE of its rules has a real
 * `prop: value` body. Empty braces ride along; they cannot carry a run on their own.
 */
const MIN_DECLARATION_RULES = 1
/** Longest run of characters between two rules of the same stylesheet before we call it prose. */
const MAX_SELECTOR_LEN = 200
/** A single stray `{...}` in prose is not a stylesheet; three in a row is. */
const MIN_RUN_RULES = 3
/** A rule body longer than this is prose in braces, not declarations. */
const MAX_BODY_LEN = 2000

export interface StyleSpan { start: number; end: number; rules: number; declarationRules: number }

function looksLikeCssBody(body: string): boolean {
  if (body.length > MAX_BODY_LEN) return false
  return body.trim() === '' || LOOKS_LIKE_DECLARATIONS.test(body)
}

/**
 * Every contiguous run of >= MIN_RUN_RULES CSS-shaped rules in `text`, as character spans.
 *
 * A rule joins the current run when it begins within MAX_SELECTOR_LEN characters of the end of
 * the previous one — that gap is the selector. A run's reported `start` reaches back over its
 * first selector by the same distance, so "the body opens with a stylesheet" can be asked as
 * "does the first span start near character 0".
 */
export function styleSpans(text: string): StyleSpan[] {
  const spans: StyleSpan[] = []
  let cur: StyleSpan | null = null
  let i = 0
  const flush = () => {
    if (cur && cur.rules >= MIN_RUN_RULES && cur.declarationRules >= MIN_DECLARATION_RULES) spans.push(cur)
    cur = null
  }

  for (;;) {
    const open = text.indexOf('{', i)
    if (open < 0) break
    const close = text.indexOf('}', open + 1)
    if (close < 0) break
    const nextOpen = text.indexOf('{', open + 1)
    if (nextOpen >= 0 && nextOpen < close) { i = nextOpen; continue }   // nested/unbalanced — not a rule

    const body = text.slice(open + 1, close)
    if (looksLikeCssBody(body)) {
      const isDeclaration = body.trim() !== ''
      if (cur && open - cur.end <= MAX_SELECTOR_LEN) {
        cur.end = close + 1
        cur.rules++
        if (isDeclaration) cur.declarationRules++
      } else {
        flush()
        const lead = text.slice(Math.max(0, open - MAX_SELECTOR_LEN), open)
        cur = { start: open - lead.trimStart().length, end: close + 1, rules: 1, declarationRules: isDeclaration ? 1 : 0 }
      }
    } else {
      flush()
    }
    i = close + 1
  }
  flush()
  return spans
}

/** Characters of `text` that sit inside a CSS run. */
export function styleChars(text: string): number {
  return styleSpans(text).reduce((n, s) => n + (s.end - s.start), 0)
}

/** Where the first CSS run starts, or -1. Used to answer "does the body OPEN with a stylesheet?". */
export function firstStyleOffset(text: string): number {
  const spans = styleSpans(text)
  return spans.length ? spans[0].start : -1
}
