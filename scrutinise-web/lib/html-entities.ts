// html-entities.ts (WEB) — THE READ-SIDE HALF OF THE SAME DECODER THE INGEST USES.
//
// ════════════════════════════════════════════════════════════════════════════════════════════════
// WHY THIS FILE EXISTS, AND WHY IT IS A COPY
// ════════════════════════════════════════════════════════════════════════════════════════════════
// `docs/ENTITY_DECODE_REPORT.md` measured the contamination and repaired every user-visible value
// that lives in Neon — 16,805 of them. What it did NOT repair is the ~184,000 R2 objects, and
// therefore the FTS/vector indexes built from them: a snippet served out of the index still carries
// `&#8217;` where the source had a curly apostrophe. Decoding those in place costs $0.90 plus a
// full index rebuild and buys ZERO recall (the `simple` tokeniser splits on the entity anyway), so
// the repair Charlie chose is this one: DECODE AT RENDER, on the way out.
//
// ⚠ THIS IS A RENDERING REPAIR AND NOTHING ELSE. It cannot recover a token the index does not hold,
// it does not change what is stored, and it must never be described as fixing recall. What it fixes
// is `Barbara&#xa0;Rayment` appearing in a panel, a briefing, a DOCX or a model prompt.
//
// ⚠ AND IT IS A COPY OF A FILE, NOT AN IMPORT OF ONE. The Next build root is `scrutinise-web/`, so
// `scripts/ingest/shared/html-entities.ts` is not in the deployment and cannot be imported. The
// duplication is therefore forced; what is NOT forced is letting the two drift, so the shared core
// below is compared byte-for-byte from both sides — `npm run check:render-decode` here and
// `npm run check:entity-decode` in `scripts/ingest`. Change it in one place and BOTH checks fail
// until the copy is made.
// ════════════════════════════════════════════════════════════════════════════════════════════════

// SHARED CORE — BYTE-IDENTICAL ACROSS scripts/ingest/shared/html-entities.ts
//                                 AND scrutinise-web/lib/html-entities.ts
//
// ⚠ Everything from here to the END SHARED CORE marker is compared byte-for-byte, from BOTH
// sides (`check:entity-decode` in the ingest, `check:render-decode` in the web app). Edit it in
// one file and copy it across; never edit one side alone.
//
// The reason it is duplicated rather than imported: the Next.js build root is `scrutinise-web/`,
// so a file above it is not in the deployment. The reason it is CHECKED rather than merely
// duplicated: the ingest side decides what is STORED and the web side decides what is SHOWN,
// and two components disagreeing about what a document says is the exact defect class this
// whole line of work exists to remove.
// ══════════════════════════════════════════════════════════════════════════════════════════════

/** The named entities we decode. Anything not here is left alone, on purpose. */
const NAMED: Record<string, string> = {
  amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ',
  ldquo: '“', rdquo: '”', lsquo: '‘', rsquo: '’',
  mdash: '—', ndash: '–', hellip: '…', bull: '•',
  pound: '£', euro: '€', deg: '°', sect: '§',
  copy: '©', reg: '®', trade: '™', middot: '·',
  frac12: '½', frac14: '¼', times: '×', minus: '−',
  shy: '­', ensp: ' ', emsp: ' ', thinsp: ' ',
}

/** Characters that are invisible by definition and carry no meaning in indexed text. */
const INVISIBLE = /[­​‌‍⁠﻿]/g

/**
 * Decode HTML entities in text that should already be plain.
 *
 * `&amp;amp;` is a real thing in doubly-escaped feeds, so decoding runs to a fixed point — but at
 * most three passes, because an unbounded loop over hostile input is a hang.
 */
export function decodeHtmlEntities(input: string): string {
  let out = input
  for (let pass = 0; pass < 3; pass++) {
    const next = out
      .replace(/&#x([0-9a-fA-F]{1,6});/g, (whole, hex) => codePoint(parseInt(hex, 16), whole))
      .replace(/&#(\d{1,7});/g, (whole, dec) => codePoint(parseInt(dec, 10), whole))
      .replace(/&([a-zA-Z][a-zA-Z0-9]{1,9});/g, (whole, name) => NAMED[name.toLowerCase()] ?? whole)
    if (next === out) break
    out = next
  }
  return out
}

/**
 * Decode, then remove the invisible characters and normalise the space-like ones.
 *
 * ⚠ THIS, NOT DECODING ALONE, IS WHAT RECOVERS A SEARCHABLE WORD. `preven&#xad;tative` decodes to
 * `preven­tative`, and the FTS tokeniser splits on U+00AD exactly as it split on the entity —
 * so decode-only leaves the word just as unfindable. Measured: over the affected corpora, decoding
 * alone recovers 0 tokens and decode-plus-strip recovers 98.
 */
export function decodeForIndex(input: string): string {
  return decodeHtmlEntities(input)
    .replace(INVISIBLE, '')
    .replace(/[    ]/g, ' ')
}

/**
 * ⚠ 0x80–0x9F MAP THROUGH WINDOWS-1252, NOT STRAIGHT TO UNICODE — and this was found by reading
 * the fix's own output, not by knowing the spec.
 *
 * A real Hansard title reads `&#145;inadvertent breach&#146;`. Decoded naively, `&#145;` is
 * U+0091 PRIVATE USE ONE — an INVISIBLE C1 control character. The repair would have replaced a
 * visible `&#145;` with nothing at all, which is worse than leaving it: the quotation marks would
 * simply have vanished from the title.
 *
 * These references come from documents authored in Windows-1252, where 145 and 146 are the curly
 * single quotes. The HTML standard specifies exactly this mapping for numeric references in that
 * range, and it is what every browser does. 73 titles carry one.
 */
const CP1252: Record<number, string> = {
  128: '€', 130: '‚', 131: 'ƒ', 132: '„', 133: '…', 134: '†', 135: '‡', 136: 'ˆ', 137: '‰',
  138: 'Š', 139: '‹', 140: 'Œ', 142: 'Ž', 145: '‘', 146: '’', 147: '“', 148: '”', 149: '•',
  150: '–', 151: '—', 152: '˜', 153: '™', 154: 'š', 155: '›', 156: 'œ', 158: 'ž', 159: 'Ÿ',
}

/** A valid codepoint, or the original text untouched. Never a silent space, never a control char. */
function codePoint(n: number, whole: string): string {
  if (!Number.isFinite(n) || n <= 0 || n > 0x10ffff) return whole
  if (n >= 0xd800 && n <= 0xdfff) return whole            // lone surrogate — not a character
  if (CP1252[n]) return CP1252[n]                          // see the note above
  // ⚠ TAB, LF and CR ARE DECODED, and the exception is not cosmetic. 28 `pwdata-debates` speaker
  // values read `&#10;   Dr. DRUMMOND&#13;&#10;   SHIELS&#10;` — the newlines of the source HTML,
  // escaped. Refusing them left a speaker name unreadable in exactly the place a user sees it.
  // They decode to whitespace, so they cannot delete visible text, which is what the rule below
  // is actually protecting against.
  if (n === 9 || n === 10 || n === 13) return String.fromCodePoint(n)
  // Any other C0/C1 control is left as it was: decoding it would delete visible text.
  if (n < 0x20 || (n >= 0x7f && n <= 0x9f)) return whole
  try { return String.fromCodePoint(n) } catch { return whole }
}

/** Does this text still contain something that looks like an undecoded entity? */
export const hasLiteralEntity = (s: string) =>
  /&(#x[0-9a-fA-F]{2,6}|#\d{2,7}|[a-zA-Z][a-zA-Z0-9]{1,9});/.test(s)

// ══════════════════════════════════════════════════════════════════════════════ END SHARED CORE

// ── WEB-ONLY, BELOW THE SHARED CORE ─────────────────────────────────────────────────────────────

/**
 * The repair applied to anything on its way to a user or a model.
 *
 * ⚠ IT IS `decodeForIndex`, DELIBERATELY, AND THE ALIAS IS THE POINT. The ingest side uses this
 * exact function to decide what a document says; if the read side used a weaker one (decode
 * without the invisible-character strip, say), then a soft-hyphenated word would read one way in
 * the index and another on the page — two components disagreeing about a document, which is the
 * failure this repair exists to prevent, reintroduced by the repair itself.
 *
 * Idempotent on clean text, so it is safe to apply to values that were already repaired in Neon:
 * the 16,805 titles/speakers/attributions fixed on 17 Aug pass through unchanged.
 */
export const decodeForDisplay = decodeForIndex

/** `decodeForDisplay` over a nullable value, preserving null/undefined rather than inventing ''. */
export function decodeMaybe<T extends string | null | undefined>(value: T): T {
  return (typeof value === 'string' ? (decodeForDisplay(value) as T) : value)
}

/**
 * ⚠ SAFE ONLY BECAUSE CORPUS TEXT IS NEVER RENDERED AS HTML. Decoding turns `&lt;script&gt;` back
 * into `<script>`, which would be an injection vector the moment a snippet reached
 * `dangerouslySetInnerHTML`. Today every corpus surface renders through React as text (the only
 * `dangerouslySetInnerHTML` in the app is the static support page rendering its own markdown), and
 * `check:render-decode` holds that as an allowlist so this stays true rather than merely being
 * true. If a corpus surface ever needs raw HTML, it must escape AFTER decoding, not skip decoding.
 */
export const DECODE_IS_SAFE_BECAUSE_NO_RAW_HTML = true
