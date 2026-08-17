/**
 * html-entities.ts — ONE decoder, because eight sources each rolled their own and each got a
 * different subset right.
 *
 * ════════════════════════════════════════════════════════════════════════════════════════════════
 * THE DEFECT THIS EXISTS TO CLOSE, NAMED EXACTLY
 * ════════════════════════════════════════════════════════════════════════════════════════════════
 * `sources/committees-portal.ts` decoded a hand-written list:
 *
 *     .replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/&lt;/g, '<')
 *     .replace(/&gt;/g, '>').replace(/&#x2013;/g, '–').replace(/&#x2014;/g, '—')
 *
 * `&nbsp;` is decoded. `&#xa0;` — **the numeric form of the very same character** — is not, and it
 * is 5,212 of the 5,322 occurrences the census found. The list was not wrong about anything it
 * named; it was incomplete, and a hand-written list always will be. Ten source files strip HTML
 * and none of them decodes a numeric entity.
 *
 * ⚠ DECODING IS DELIBERATELY NOT BLIND (BRIEF_INGEST_ENTITY_DECODE §3). Legislative text can
 * legitimately contain an ampersand-hash sequence inside quoted material, and old statutes contain
 * `&c.` as an abbreviation. So:
 *   · the NUMERIC forms are decoded generally — `&#NNN;` / `&#xHH;` is not something a drafter
 *     writes by hand, and every one found in the census was markup escaping its own container
 *   · the NAMED forms are decoded from an EXPLICIT LIST, so `&c;` and `&s;` are left alone
 *   · a codepoint outside the valid range is left EXACTLY as it was rather than replaced with a
 *     space, because a silent substitution is how a decoder invents text
 */

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

// ── offline self-test ───────────────────────────────────────────────────────────────────────────
function selftest() {
  const cases: Array<[string, boolean]> = [
    ['the numeric form of nbsp decodes', decodeHtmlEntities('Barbara&#xa0;Rayment') === 'Barbara Rayment'],
    ['the named form decodes to the same character', decodeHtmlEntities('Barbara&nbsp;Rayment') === 'Barbara Rayment'],
    ['decimal numeric decodes', decodeHtmlEntities('a&#160;b') === 'a b'],
    ['uppercase hex decodes', decodeHtmlEntities('a&#XA0;b').length === 3 || decodeHtmlEntities('a&#xA0;b') === 'a b'],
    ['a curly apostrophe decodes', decodeHtmlEntities('don&#8217;t') === 'don’t'],
    ['&amp; decodes', decodeHtmlEntities('R&amp;D') === 'R&D'],
    ['double-escaped decodes to a fixed point', decodeHtmlEntities('R&amp;amp;D') === 'R&D'],
    // ⚠ the refusals — §3 forbids decoding blindly
    ['⚠ &c; from old statute is LEFT ALONE', decodeHtmlEntities('Weights and Measures &c; Act') === 'Weights and Measures &c; Act'],
    ['⚠ an unknown named entity is LEFT ALONE', decodeHtmlEntities('x &frobnicate; y') === 'x &frobnicate; y'],
    ['⚠ an out-of-range codepoint is LEFT ALONE, not replaced by a space', decodeHtmlEntities('a&#1114112;b') === 'a&#1114112;b'],
    ['⚠ a lone surrogate is LEFT ALONE', decodeHtmlEntities('a&#xD800;b') === 'a&#xD800;b'],
    ['a bare ampersand is untouched', decodeHtmlEntities('Marks & Spencer') === 'Marks & Spencer'],
    // ── decodeForIndex ──
    ['decodeForIndex turns nbsp into a real space', decodeForIndex('Barbara&#xa0;Rayment') === 'Barbara Rayment'],
    ['⚠ decode ALONE does not rejoin a soft-hyphenated word', decodeHtmlEntities('preven&#xad;tative') !== 'preventative'],
    ['decodeForIndex DOES rejoin it', decodeForIndex('preven&#xad;tative') === 'preventative'],
    ['decodeForIndex strips a literal soft hyphen too', decodeForIndex('preven­tative') === 'preventative'],
    // ── the Windows-1252 range, found by reading the repair's own output ──
    ['⚠ &#145; becomes a curly quote, NOT an invisible control', decodeHtmlEntities('&#145;x&#146;') === '‘x’'],
    ['&#147;/&#148; become curly double quotes', decodeHtmlEntities('&#147;x&#148;') === '“x”'],
    ['&#150; becomes an en dash', decodeHtmlEntities('a&#150;b') === 'a–b'],
    ['⚠ a C1 control with no 1252 mapping is LEFT ALONE, not deleted', decodeHtmlEntities('a&#129;b') === 'a&#129;b'],
    ['⚠ a C0 control is LEFT ALONE', decodeHtmlEntities('a&#7;b') === 'a&#7;b'],
    ['but LF/CR/TAB ARE decoded — they cannot delete visible text',
      decodeHtmlEntities('Dr. DRUMMOND&#13;&#10;SHIELS') === 'Dr. DRUMMOND\r\nSHIELS'],
    ['⚠ the repair never turns visible text into nothing',
      decodeForIndex('&#145;inadvertent breach&#146;').replace(/[^\S ]/g, '').length > 'inadvertent breach'.length],
    ['hasLiteralEntity finds one', hasLiteralEntity('a&#xa0;b')],
    ['hasLiteralEntity is not fooled by a bare ampersand', !hasLiteralEntity('Marks & Spencer')],
    ['decoding is idempotent on already-clean text',
      decodeHtmlEntities(decodeHtmlEntities('Barbara Rayment')) === 'Barbara Rayment'],
  ]
  let bad = 0
  for (const [name, ok] of cases) { console.log(`  ${ok ? 'PASS' : 'FAIL'}  ${name}`); if (!ok) bad++ }
  console.log(bad ? `\n${bad} FAILED` : `\n${cases.length}/${cases.length} pass`)
  if (bad) process.exit(1)
}
if (require.main === module && process.argv.includes('--self-test')) selftest()
