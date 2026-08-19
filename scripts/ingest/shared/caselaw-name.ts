/**
 * caselaw-name.ts — WHERE A CASE NAME COMES FROM, in one place. BRIEF_INGEST_NAMES §1.
 *
 * ════════════════════════════════════════════════════════════════════════════════════════════
 * WHAT THE §1.1 AUDIT FOUND (100 deterministic tna-caselaw rows, 19 Aug 2026)
 * ════════════════════════════════════════════════════════════════════════════════════════════
 * The case name is a STRUCTURED FIELD WE ALREADY HOLD. Every judgment's Akoma Ntoso XML is in
 * R2 under `r2RawKey`, and its `<FRBRname value="…"/>` carries the name the National Archives
 * publishes:
 *
 *     FRBRname   present 100/100      "Tosi Limited v 99 Hippos Limited &amp; Anor"
 *     uk:cite    present  99/100      "[2023] EWHC 852 (Ch)"
 *     uk:court   present 100/100      "EWHC-Chancery-InsolvencyAndCompanies"
 *     docTitle   present   7/100      (and in all 7 it DIFFERS from FRBRname — see below)
 *
 * So §1.2's preference order resolves to the first branch every time: **fetched, not parsed.**
 * The brief allows a text-parsing fallback and this module implements one, but the fallback is
 * expected to fire on approximately nothing, and it labels itself `parsed:v1` when it does.
 *
 * ⚠ WHY NOT `docTitle`. Where both exist they disagree, and `docTitle` is the *cover page* text
 * ("IN THE HIGH COURT OF JUSTICE …", "Approved Judgment"), not the case name. FRBRname is the
 * FRBR work-level name — the identifier the source assigns the judgment — which is the thing a
 * user means by "what case is this". `docTitle` is therefore NOT used, not even as a fallback.
 *
 * ⚠ WHY NOT THE COMPILED TEXT. `rawToText` emits the AKN `<meta>` block, so a tna-caselaw
 * compiled document opens with ~3,000 characters of embedded CSS before the first word of the
 * judgment. 0/100 sampled documents had an "X v Y" line anywhere in their first six lines. A
 * head-of-text parser would have been reading a stylesheet.
 */
import { decodeHtmlEntities } from './html-entities'

/** Which route established a title. `source` is a fetched fact; `parsed:v1` is an inference. */
export type TitleRoute = 'source' | 'parsed:v1'

export interface RecoveredName {
  title: string
  route: TitleRoute
  /** The XML/text element the value was read out of, for the report and for re-doing a population. */
  field: string
}

/**
 * ⚠ The one transform applied to a fetched name: HTML-entity decoding, through the SHARED
 * decoder. `"Tosi Limited v 99 Hippos Limited &amp; Anor"` is what the source publishes and
 * `&amp;` is markup escaping its own container, not part of the name. Nothing else is changed —
 * no case normalisation, no `R v` reordering, no punctuation tidying. Editing a fetched name
 * turns it back into an inference.
 */
function clean(raw: string): string {
  return decodeHtmlEntities(raw).replace(/\s+/g, ' ').trim()
}

/**
 * ROUTE 1 — the structured field. Reads `<FRBRname value="…"/>` from the stored AKN XML.
 *
 * Takes the FIRST occurrence deliberately: AKN nests three FRBR levels (work / expression /
 * manifestation) and the work-level name comes first. The manifestation-level one is the same
 * string in every sampled document, but "the same today" is not a reason to read the later one.
 */
export function nameFromAkn(xml: string): RecoveredName | null {
  const m = /<FRBRname\s+value="([^"]*)"/.exec(xml)
  if (!m) return null
  const title = clean(m[1])
  if (!title) return null
  return { title, route: 'source', field: 'FRBRname@value' }
}

/** The neutral citation as the SOURCE states it — for the report, never as a title. */
export function citationFromAkn(xml: string): string | null {
  const m = /<uk:cite[^>]*>([^<]*)<\/uk:cite>/.exec(xml)
  return m ? clean(m[1]) || null : null
}

/** The court code as the SOURCE states it (`EWHC-Chancery-InsolvencyAndCompanies`). */
export function courtFromAkn(xml: string): string | null {
  const m = /<uk:court[^>]*>([^<]*)<\/uk:court>/.exec(xml)
  return m ? clean(m[1]) || null : null
}

/** The judgment date as the SOURCE states it — the real date, not the citation year. */
export function judgmentDateFromAkn(xml: string): string | null {
  const m = /<FRBRdate\s+date="(\d{4}-\d{2}-\d{2})"[^>]*name="(?:judgment|decision)"/.exec(xml)
    ?? /<FRBRdate\s+date="(\d{4}-\d{2}-\d{2})"/.exec(xml)
  return m ? m[1] : null
}

/**
 * ⚠⚠ A CITATION IS NOT A NAME, AND THIS FUNCTION EXISTS TO SAY SO IN CODE.
 *
 * §1.2: `ewhc/2021/123` rendered as "EWHC 2021 123" is not a case name, and a placeholder that
 * looks like data is worse than a blank. Any candidate that is nothing but court/year/number
 * tokens is REJECTED, whichever route produced it, so the miss stays a miss and gets counted.
 */
export function isCitationShaped(title: string): boolean {
  const s = title.trim()
  if (!s) return true
  // No " v " / " v. " / " and " / "Re " / "In the matter of" — i.e. nothing that names a party.
  const namesAParty = /\sv\.?\s|\bv\.?$|^\s*(re|in re|in the matter of)\b|\bapplication by\b/i.test(s)
  if (namesAParty) return false
  // Strip citation furniture; if nothing but digits and court letters remain, it is a citation.
  const stripped = s
    .replace(/\[?\d{4}\]?/g, ' ')
    .replace(/\b(ewhc|ewca|uksc|ukpc|ukut|ukft|ukait|ukeat|civ|crim|admin|ch|qb|kb|pat|comm|tcc|fam|no|case|number)\b/gi, ' ')
    .replace(/[^a-z]/gi, '')
  return stripped.length < 3
}

/**
 * ROUTE 2 — the fallback, from the text we already hold. `parsed:v1`, an INFERENCE.
 *
 * Only reached when the AKN carries no `FRBRname` (0 of 100 sampled). It looks for the party
 * line in the cover-page region AFTER the CSS block, and returns null rather than a guess for
 * anything it is not sure about. A null here is the correct output — §1.2's "a miss stays a
 * miss".
 */
export function nameFromCompiledText(compiled: string): RecoveredName | null {
  const body = stripAknPreamble(compiled)
  const window = decodeHtmlEntities(body.slice(0, 3000))
  // "Between : X Claimant - and - Y Defendant" is the standard EWHC cover-page shape.
  const between = /\bBetween\s*:?\s+(.{3,120}?)\s+(?:Claimant|Appellant|Applicant|Petitioner|Pursuer)s?\b.{0,40}?\band\b.{0,20}?\s+(.{3,120}?)\s+(?:Defendant|Respondent|Interested Party)s?\b/is.exec(window)
  if (between) {
    const title = clean(`${between[1]} v ${between[2]}`)
    if (!isCitationShaped(title)) return { title, route: 'parsed:v1', field: 'compiled:Between-line' }
  }
  return null
}

/**
 * Cut the AKN `<meta>` residue — identifiers, hashes and the embedded stylesheet — off the front
 * of a compiled tna-caselaw document, so what is left starts at the judgment.
 *
 * ⚠ THE CUT FOLLOWS THE CSS RUN, NOT THE LAST `}` IN THE FILE. Stylesheet length varies from
 * document to document (2.0k–3.4k characters in the sample), so a fixed offset is wrong; and
 * "the last `}` in the first 20k characters" is ALSO wrong, because a judgment quoting a statute
 * or an email address can contain a brace and that version would swallow the opening of the
 * judgment. Instead the contiguous run of `selector { … }` rules is walked, and the cut is made
 * at the end of the last rule that is still adjacent to the previous one. If no CSS is found the
 * text is returned untouched rather than blindly trimmed.
 */
const CSS_RULE = /([^{}]{0,400})\{([^{}]*)\}/y
const MAX_RULE_GAP = 120
/** A CSS rule body is `prop: value` pairs. A brace in prose (`"{sic}"`, `{name}`) has no colon. */
const LOOKS_LIKE_DECLARATIONS = /[a-z-]+\s*:\s*[^:;{}]+/i

/**
 * ⚠ AN EMPTY BODY IS STILL CSS. The generator emits `#judgment .PageNumber { }` for a style it
 * declared and never used, and many documents OPEN with a run of them. An earlier version of this
 * function required `prop: value` in every rule, so it stopped at the very first empty one and
 * returned the whole stylesheet as if it were the judgment — which is how eight of thirty §1.4
 * verification samples came back showing CSS instead of their party line. `{ }` cannot be prose;
 * `{sic}` can, and still is refused.
 */
function looksLikeCss(body: string): boolean {
  return body.trim() === '' || LOOKS_LIKE_DECLARATIONS.test(body)
}

export function stripAknPreamble(compiled: string): string {
  const cssStart = compiled.indexOf('#judgment')
  if (cssStart < 0 || cssStart > 20_000) return compiled
  let pos = cssStart
  let end = -1
  for (;;) {
    CSS_RULE.lastIndex = pos
    const m = CSS_RULE.exec(compiled)
    if (!m) break
    // Two ways this stops being CSS and starts being the judgment: the gap before the brace gets
    // long (prose, not a selector), or the braced content is not a rule body at all.
    if (!looksLikeCss(m[2])) break
    if (end >= 0 && m[1].length > MAX_RULE_GAP) break
    end = m.index + m[0].length
    pos = end
  }
  if (end < 0) return compiled
  return compiled.slice(end).replace(/^\s+/, '')
}

/** First `n` words of the judgment itself, entity-decoded. Used by §1.3's gold extract. */
export function firstWords(compiled: string, n = 200): string {
  const body = decodeHtmlEntities(stripAknPreamble(compiled)).replace(/\s+/g, ' ').trim()
  const words = body.split(' ')
  const cut = words.slice(0, n).join(' ')
  return words.length > n ? `${cut} …` : cut
}
