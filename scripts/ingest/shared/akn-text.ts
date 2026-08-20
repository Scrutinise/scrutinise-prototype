/**
 * akn-text.ts — WHERE A JUDGMENT'S TEXT COMES FROM, in one place.
 * BRIEF_INGEST_CASELAW_TEXT §2.1. Used by the live writer AND by the backlog re-compile, so the
 * two cannot drift — the same arrangement `shared/caselaw-name.ts` uses for the case name.
 *
 * ════════════════════════════════════════════════════════════════════════════════════════════
 * THE BUG THIS REPLACES, stated exactly
 * ════════════════════════════════════════════════════════════════════════════════════════════
 * `processTnaCaselaw` stored `rawToText(judgmentXml)` — the WHOLE Akoma Ntoso document with its
 * tags removed. `rawToText` deletes tags and keeps text nodes, and the National Archives puts a
 * rendering stylesheet in a text node:
 *
 *     <akomaNtoso><judgment name="judgment">
 *       <meta>                                   ← offset 200
 *         <identification source="#tna"> … FRBRname, FRBRdate, hashes …
 *         <presentation source="#">              ← offset 2,965
 *           <html:style>                         ← offset 2,992   THE STYLESHEET
 *             #judgment { font-family: 'Times New Roman'; font-size: 12pt; } …
 *       <header>                                 ← offset 6,294   the cover page
 *       <judgmentBody>                           ← offset 11,830  the judgment
 *
 * so every stored document opened with the identifiers, the build hashes and then 2.0k–3.4k
 * characters of CSS, before a word of the judgment. Measured on `tna-caselaw:[2013] EWHC 803
 * (Admin):1` and 59 others: 60 of 60 open that way.
 *
 * ⚠ THE FIX IS NOT A CSS STRIPPER, AND §2.1 SAYS SO. Pattern-matching the stylesheet out of the
 * output would leave the writer selecting the wrong content — the identifiers and the SHA-256
 * build hash would still be stored as if they were the judgment, and the next thing the generator
 * puts in `<meta>` would be stored too. What is selected here is the DOCUMENT: the `<judgment>`
 * element without its `<meta>` child. In Akoma Ntoso `<meta>` is by definition the non-content
 * metadata block; every other child of `<judgment>` — `<coverPage>`, `<header>`, `<judgmentBody>`,
 * `<conclusions>`, `<attachments>` — is the document, and all five are kept.
 *
 * ⚠ WHY NOT NAME THE FIVE CHILDREN INSTEAD. An allow-list would silently drop whatever the
 * National Archives adds next; a deny-list of exactly `<meta>` cannot. The shapes were counted
 * before this was written (`caselaw-text/probe-akn-shape.ts`, 300 documents):
 *
 *     <meta> 300/300   <presentation> 300/300   <style> 300/300   <header> 300/300
 *     <judgmentBody> 300/300   <coverPage> 25   <conclusions> 6   <mainBody> 4   <attachments> 4
 *     root child: judgment name=judgment 268 · name=decision 32
 *     style elements outside <meta>: 0
 *
 * The last line is the one this module rests on: in 300 documents there is no stylesheet anywhere
 * except inside `<meta>`. `<attachments>` embeds a nested `<doc>` with its own `<meta>`, which is
 * removed by the same rule.
 */
import { rawToText } from './compile'
import { styleChars, firstStyleOffset } from './style-detect'

/**
 * `<meta>…</meta>`, with or without a namespace prefix, matched with a backreference so
 * `<akn:meta>` closes against `</akn:meta>` and not against a bare `</meta>`. AKN never nests a
 * `<meta>` inside a `<meta>`, so the non-greedy body is exact; an attachment's own `<meta>` is a
 * separate, later match and is removed by the same pass.
 */
const META_ELEMENT = /<((?:\w+:)?meta)(?:\s[^>]*)?>[\s\S]*?<\/\1\s*>/g

/** The body element every judgment must have — the positive assertion that we found a document. */
const BODY_ELEMENT = /<(?:\w+:)?(?:judgmentBody|mainBody)[\s/>]/

export interface JudgmentText {
  text: string
  /** How it was obtained, stored in `notes` so a row's provenance is readable off the database. */
  route: 'akn:judgment-minus-meta' | 'akn:empty-at-source'
}

/**
 * The `<judgmentBody>`/`<mainBody>` element's OWN text — what the source publishes as the judgment,
 * with nothing else. Used to tell "the extraction lost the judgment" apart from "the source
 * publishes almost nothing", which look identical from the output alone and are opposite problems.
 *
 * ⚠ THIS DISTINCTION IS NOT THEORETICAL. Twenty judgments in this collection have a `<judgmentBody>`
 * containing the single word **withdrawn**; two have one that is completely EMPTY, with
 * `uk:hash = e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855` — the SHA-256 of the
 * empty string — so the National Archives is telling us plainly that it holds no text. Returns null
 * only when there is no body element at all.
 */
export function aknBodyText(xml: string): string | null {
  const m = /<((?:\w+:)?(?:judgmentBody|mainBody))\b[^>]*>([\s\S]*?)<\/\1\s*>/.exec(xml)
  if (m) return rawToText(m[2])
  if (/<(?:\w+:)?(?:judgmentBody|mainBody)\s*\/>/.test(xml)) return ''   // self-closing = empty
  return null
}

export function aknBodyWordCount(xml: string): number | null {
  const t = aknBodyText(xml)
  return t === null ? null : (t ? t.split(/\s+/).filter(Boolean).length : 0)
}

/** The `<judgment>` element with its `<meta>` child removed — still XML, for tests and diffs. */
export function stripAknMeta(xml: string): string {
  return xml.replace(META_ELEMENT, ' ')
}

/**
 * The judgment as plain text, or null when this XML is not a judgment we recognise.
 *
 * ⚠ NULL MEANS "THIS IS NOT A JUDGMENT DOCUMENT", NOT "THE JUDGMENT IS EMPTY". A document with no
 * `<judgmentBody>` and no `<mainBody>` is a shape we have not seen (0 of 300), and storing
 * `rawToText` of it "just in case" is how a stylesheet got stored in the first place.
 *
 * ⚠ AN EMPTY STRING IS RETURNED, NOT NULL, when the body element is there and holds nothing. An
 * earlier version conflated the two and sent two real judgments — whose `<judgmentBody>` the
 * National Archives publishes empty — down the "unrecognised shape" path, where they kept the
 * stylesheet that was already stored. Deciding what to do about an empty judgment is the guard's
 * job (`checkJudgmentBody`, `emptyAtSource`), not this function's.
 */
export function aknJudgmentText(xml: string): JudgmentText | null {
  if (!BODY_ELEMENT.test(xml)) return null
  return { text: rawToText(stripAknMeta(xml)), route: 'akn:judgment-minus-meta' }
}

// ── §2.2 The guard ────────────────────────────────────────────────────────────────────────────

/**
 * ⚠⚠ A CHECK THAT ONLY TESTS FOR THE ABSENCE OF THE BAD THING PASSES ON AN EMPTY STRING.
 * §2.2 is explicit about this, so this guard asserts BOTH halves: the stylesheet is gone AND
 * there is a judgment there. The positive half is first, because it is the one that a broken
 * extractor trips and a naive "no CSS" assertion sails through.
 */
export const MIN_JUDGMENT_WORDS = 50
/** A stylesheet in the first 2,000 characters is the failure this sprint exists to end. */
export const HEAD_WINDOW = 2000
/** Above this share of the body being CSS, the extraction picked the wrong content. */
export const MAX_STYLE_SHARE = 0.02

export interface BodyVerdict {
  ok: boolean
  /** Named so a rejection reads as a sentence in a log, not as a boolean. */
  reason: string
  words: number
  styleChars: number
  styleShare: number
  firstStyleOffset: number
  /**
   * The source publishes NO judgment text for this document. Not a failure and not a body: the
   * caller should store an empty body rather than leave whatever was there before, because what
   * was there before is a stylesheet and nothing else.
   */
  emptyAtSource: boolean
}

export interface BodyCheckOptions {
  /**
   * Words in the source's own `<judgmentBody>` (see `aknBodyWordCount`). Supply it wherever the raw
   * AKN is in hand. Without it a short body can only be read as a failed extraction; with it, "the
   * judgment is the word *withdrawn*" is told apart from "we extracted one word out of nine
   * thousand", which is the difference between a faithful row and a broken one.
   */
  sourceBodyWords?: number | null
}

export function checkJudgmentBody(text: string | null | undefined, opts: BodyCheckOptions = {}): BodyVerdict {
  const t = (text ?? '').trim()
  const words = t ? t.split(/\s+/).filter(Boolean).length : 0
  const sc = styleChars(t)
  const off = firstStyleOffset(t)
  const share = t.length ? sc / t.length : 0
  const verdict = (ok: boolean, reason: string, emptyAtSource = false): BodyVerdict =>
    ({ ok, reason, words, styleChars: sc, styleShare: share, firstStyleOffset: off, emptyAtSource })

  const src = opts.sourceBodyWords

  // POSITIVE FIRST. An empty or near-empty body contains no stylesheet either.
  if (words < MIN_JUDGMENT_WORDS) {
    if (src === undefined || src === null) {
      return verdict(false, `body has ${words} words, fewer than ${MIN_JUDGMENT_WORDS} — nothing was extracted`)
    }
    if (src === 0) {
      return verdict(false, 'the source publishes no judgment text at all — its <judgmentBody> is empty', true)
    }
    if (words >= src) {
      return verdict(true, `body is judgment text — the source publishes only ${src} word(s) of it`)
    }
    return verdict(false, `body has ${words} words where the source's <judgmentBody> has ${src} — the extraction lost content`)
  }
  if (off >= 0 && off < HEAD_WINDOW) return verdict(false, `body opens with a stylesheet — CSS run begins at character ${off}`)
  if (share > MAX_STYLE_SHARE) return verdict(false, `body is ${(100 * share).toFixed(1)}% stylesheet, over the ${(100 * MAX_STYLE_SHARE).toFixed(0)}% ceiling`)
  return verdict(true, 'body is judgment text')
}
