/**
 * extract-madeunder-edges.ts — SI → enabling Act/section edges (`made-under`)
 * from SecondaryPreamble/EnactingText in the whole-doc CLML we already hold
 * (scripts/legislation/v276-bulk/best-collection-xml.zip, May 2026 vintage).
 *
 * The per-section corpus ingest dropped preambles (audit finding), but the bulk
 * ZIP's whole-doc CLML has them: "…in exercise of the powers conferred by
 * sections 70(1), 105(7) … of the National Health Service (Scotland) Act
 * 1978<FootnoteRef f00001/>…" where footnote f00001's FIRST <Citation URI>
 * is the enabling act. Modern SIs may carry inline <Citation> in the
 * EnactingText instead. Both are handled:
 *   from = the SI (act-level)
 *   to   = enabling act (act-level), plus section-level edges where a
 *          "section(s)/article(s)/regulation(s) N … of" list precedes the anchor
 *   detail = the start of the enacting text (provenance for review)
 *
 * Revised SIs whose preamble TNA elided ("… . . . .") are counted, not silent.
 *
 * Zip access via graph/zip-reader.ts (streaming central directory) — adm-zip's
 * whole-file 1.4 GB Buffer fails allocation on this machine.
 *
 *   npx tsx graph/extract-madeunder-edges.ts --pilot [N=500]  — stats only, no writes
 *   npx tsx graph/extract-madeunder-edges.ts                  — full run (checkpointed)
 */
import fs from 'fs'
import path from 'path'
import { ZipReader } from './zip-reader'
import { endNeonPool } from '../shared/neon-pool'
import { EdgeRow, dedupeEdges, edgeId, granularityOf, insertEdges, parseLegUri } from './graph-common'

const ZIP_PATH = 'C:/Code/scrutinise-prototype/scripts/legislation/v276-bulk/best-collection-xml.zip'
const CHECKPOINT = path.join(__dirname, 'madeunder-checkpoint.json')
const SOURCE = 'clml-si-preamble'
const SI_TYPES = new Set(['uksi', 'ssi', 'nisr', 'wsi', 'nisro'])

type Stats = {
  siDocs: number
  noPreamble: number
  elidedPreamble: number
  noTarget: number
  recitalFallback: number
  actEdges: number
  sectionEdges: number
  written: number
}
const stats: Stats = { siDocs: 0, noPreamble: 0, elidedPreamble: 0, noTarget: 0, recitalFallback: 0, actEdges: 0, sectionEdges: 0, written: 0 }

const stripTags = (s: string) => s.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim()

/**
 * "sections 70(1), 105(7) and 108(1) of" → ['section-70','section-105','section-108'].
 *
 * ⚠⚠ TWO DEFECTS FIXED HERE ON 2026-08-28 (GRAPH 4B §2.1), BOTH FOUND BY READING
 * THE PARSER'S OUTPUT RATHER THAN ITS CODE, AND BOTH ALREADY PRESENT IN THE
 * 230,681 `made-under` rows this file wrote in July.
 *
 * 1. **A SUBSECTION WAS READ AS A SECTION.** `\d+[A-Z]*` over the raw list
 *    matched the bracketed subsection too, so "sections 191(2) and 195(3) of"
 *    produced `section-191`, `section-2`, `section-195` — and `section-2` is an
 *    edge to a provision the instrument was never made under. Every enabling
 *    power written with a subsection, which is most of them, carried one or more
 *    of these. Parentheses are stripped before the numerals are read.
 *
 * 2. **A REF LIST WAS ATTACHED TO THE WRONG ACT.** A preamble naming several
 *    enabling Acts — "section 2(2) of the European Communities Act 1972, section
 *    379A of the Financial Services and Markets Act 2000 and sections 204(6) …
 *    of the Banking Act 2009" — has one anchor per Act, and the old regex
 *    matched the EARLIEST list in the window for every one of them. So FSMA's
 *    anchor was given the European Communities Act's section 2. The window is
 *    now cut at the last COMPLETED act citation ("… Act 1972"), because the
 *    anchor's own year sits inside the <Citation> element and so cannot appear
 *    in the text before it. What is left is the list that belongs to this Act.
 *
 * ⚠ Act-level rows were never affected — only the section-level ones, which are
 * the rows a repeal analysis actually reads.
 */
const ITEM_RX = /\b(section|sections|article|articles|regulation|regulations|paragraph|paragraphs)\s+([0-9][0-9A-Za-z()]*(?:\s*(?:,|and|to)\s*[0-9][0-9A-Za-z()]*)*)\s+of\b/gi

/**
 * The ref list belonging to the anchor at the END of `text`.
 *
 * ⚠ The LAST list wins, not the first — a preamble naming several Acts has one
 * anchor each and the first list belongs to the first Act. ⚠ But a `paragraph`
 * list is skipped over rather than accepted, because "sections 126(1) and
 * 128(1) OF, AND BY PARAGRAPH 2A OF SCHEDULE 12 TO, the Act" ends with a
 * schedule paragraph whose schedule number we deliberately do not record — and
 * taking it would throw away the two sections that are the real answer.
 */
function pickList(text: string): RegExpMatchArray | null {
  const cands = [...text.matchAll(ITEM_RX)].filter(m => {
    const after = text.slice(m.index! + m[0].length)
    return after.length <= 120 && !after.includes('.')
  })
  for (let i = cands.length - 1; i >= 0; i--) {
    if (cands[i][1].toLowerCase().replace(/s$/, '') !== 'paragraph') return cands[i]
  }
  return cands.length > 0 ? cands[cands.length - 1] : null
}

export function refListBefore(plainBefore: string): string[] {
  return refListDetail(plainBefore).refs
}

/** Same answer, plus the phrase it was read from — so an audit can tell a
 *  DROPPED ref (same phrase, fewer numbers) from a RE-ATTRIBUTED one (a
 *  different phrase entirely) without re-implementing the picker. */
export function refListDetail(plainBefore: string): { refs: string[]; listText: string | null } {
  const tail = plainBefore.slice(-260)
  // ⚠ Prefer the window after the last COMPLETED citation of another instrument
  // ("… Act 1972"), because the anchor's own year sits inside the <Citation>
  // element and so can never appear in the text before it — anything with a
  // year attached therefore belongs to a DIFFERENT Act.
  // ⚠⚠ But only when a list survives the cut. The instrument's own title
  // ("… Order 2009") also matches that pattern and sits inside the window, and
  // cutting at it removed every real ref list on the first attempt.
  let m: RegExpMatchArray | null = null
  const completed = [...tail.matchAll(/\b(?:Act|Order|Regulations|Rules|Measure)\s+\d{4}\b/g)]
  if (completed.length > 0) {
    const last = completed[completed.length - 1]
    m = pickList(tail.slice(last.index! + last[0].length))
  }
  if (!m) m = pickList(tail)
  if (!m) return { refs: [], listText: null }
  const kw = m[1].toLowerCase().replace(/s$/, '')
  if (kw === 'paragraph') return { refs: [], listText: m[2] } // schedule paragraphs need the schedule number too — act-level is honest
  // ⚠ strip bracketed subsections BEFORE reading numerals: 191(2) is one
  // section, not sections 191 and 2.
  const nums = m[2].replace(/\([0-9a-zA-Z]+\)/g, '').match(/\d+[A-Z]*/gi) ?? []
  return { refs: [...new Set(nums.map(n => `${kw}-${n.toUpperCase()}`))], listText: m[2] }
}

/**
 * ⚠⚠ GRAPH 4B §2.1. ONE PARSER, TWO WRITERS.
 *
 * The enabling relationship is now extracted TWICE — once into
 * `legislation_edges` as a `made-under` edge (this file's `main()`), and once
 * into `citation_edge` with the enacting words attached as evidence
 * (`extract-enabling-edges.ts`). ⚠ **Two writers sharing one fact is exactly
 * the shape that produced the regnal-year trap in four code paths**, so the
 * PARSING lives here, in one exported function, and neither writer restates it.
 *
 * `anchor` is the citation element or footnote reference that names the
 * enabling instrument. `refs` are the provisions the words before it name.
 * `citationText` is those words — the source's own sentence, which is what
 * `legislation_edges` structurally cannot hold and `citation_edge` requires.
 */
export type EnablingHit = {
  targetGid: string
  /** section-level refs named in the words before the anchor; [] = act-level only */
  refs: string[]
  /** ⚠ the source's own words granting the power — the evidence for this edge */
  citationText: string
  /** surrounding preamble XML, for hand-checking the parse */
  rawFragment: string
  /** true when the anchor was found in the recitals rather than the enacting
   *  words: lower precision, and it must be visible on the row */
  recitalFallback: boolean
  /** ⚠ the exact input `refListBefore` was given, so an audit can re-run a
   *  different parser over IDENTICAL bytes rather than over the truncated quote */
  beforeWindow: string
  /** ⚠ DECISION 271 — whether the words name this anchor as the power exercised. See `enablingRole`. */
  role: EnablingRole
  /** the phrase the role was read from, verbatim from the enacting words; null for `unstated` */
  roleWords: string | null
  /** true when the power is named by back-reference ("of that Act") rather than at an anchor — see `enablingRole` */
  backReference: boolean
}

/**
 * ⚠⚠ DECISION 271 (Charlie, 24 Oct 2026): AN ENABLING ROW IS A DEPENDENCY ONLY WHEN THE ENACTING WORDS NAME THE
 * PROVISION AS THE POWER EXERCISED. A procedural mention is a reference, for review.
 *
 * Every anchor in the enacting words became an enabling hit, so "the requirements of section 20 of the Constitutional
 * Reform and Governance Act 2010 have been complied with" was filed exactly as "in exercise of the powers conferred by
 * section 20" would have been — all 11 "made under CRaG s.20" rows were of that kind (GRAPH_8_REPORT §5). The role is
 * read from the CLAUSE the anchor sits in (back to the last sentence end): whichever formula ENDS nearest the anchor
 * governs it, so "in exercise of the powers conferred by section 2 of X[a], a draft having been laid in
 * accordance with section 3 of X[b]" makes [a] a power and [b] a mention.
 *
 *   power     a power formula governs the anchor ("in exercise of", "powers conferred by", "by virtue of", …)
 *   mention   a non-power formula governs it — procedure ("requirements of", "laid before", "in accordance with",
 *             "consulted"), consent, definition ("within the meaning of") or amendment ("as amended by")
 *   unstated  neither appears in the clause. ⚠ NOT a dependency (the rule needs the words to SAY so), and not a
 *             mention either: the words are shown and a reader decides.
 *
 * ⚠⚠ AND A POWER CAN BE NAMED WITHOUT AN ANCHOR OF ITS OWN — commonly. "The Secretary of State is designated for the
 * purposes of section 2(2) of the European Communities Act 1972[a] … . Accordingly, the Secretary of State makes the
 * following Regulations in exercise of the powers conferred by section 2(2) of THAT ACT" (uksi/2016/912), or "Under
 * section 58(4) of the 2009 Act[a] (“the Act”) the Commission published a report … . The Commission makes the
 * following Order in exercise of the power conferred by section 59(1) of THE ACT" (uksi/2022/131). Anchor [a] is
 * rightly a mention, and before this the power was simply lost. So `parseEnabling` turns a power formula that ends in
 * "of that Act / of the Act / of the said Order / by that section" into a hit of its OWN — `backReference: true`,
 * role `power`, its own provision list (s.59, not s.58) — resolved to the anchor it refers back to. "the Act" is
 * resolved only through an anchor the text itself defines as (“the Act”); an unresolvable one writes nothing.
 */
export type EnablingRole = 'power' | 'mention' | 'unstated'
export const ENABLING_ROLES: readonly EnablingRole[] = ['power', 'mention', 'unstated']

// ⚠ "in pursuance of section 150(4) …" and "having … power under section 55" are how older Orders and rules name
// their power; "make the following Regulations pursuant to section 1" names it too, and must beat the bare
// "pursuant to" inside it (the formula that ENDS last governs — see `enablingRole`).
const POWER_RX = /\b(?:in exercise of|exercis(?:e|es|ing) (?:the |his |her |its |their |all )?(?:powers?|functions?)|powers? (?:conferred|given|contained|vested|exercisable|under)|conferred (?:on|upon|in)|vested in (?:it|him|her|them) by|authority conferred|by virtue of|(?<!\b(?:has|have|had|having|been|was|were),?\s)in pursuance of|powers? exercised|those conferred by|enabling powers?|makes? (?:the following|these|this)\b[^.]{0,60}?\b(?:under|pursuant to|in pursuance of))\b/gi
const MENTION_RX = /\b(?:requirements? (?:of|in|under)|complied with|in accordance with|(?:as )?required (?:by virtue of|by|under)|pursuant to|laid (?:before|in draft)|approved by (?:a )?resolution|consult(?:ed|ing|ation)|having regard to|consent of|with the (?:consent|approval|agreement)|has been (?:laid|published|given)|designated (?:for the purposes?|in relation|under)|referred to in|within the meaning of|as defined (?:in|by)|as (?:amended|inserted|substituted) by|whereas|(?:has|have|had|having|been|was|were),?\s+in pursuance of|proposals? (?:submitted|made)|for the purpose of giving effect to|after (?:reference|agreement)|referred to it)\b/gi
/** A sentence ends at a full stop followed by a capital — not "c. 68", "No. 2", "S.I. 1991/…", or the "etc." of
 *  "the Health and Safety at Work etc. Act 1974", which cut a real power's clause in two in the first pilot. */
const SENTENCE_END_RX = /(?<!\b(?:etc|No|Nos|art|arts|reg|regs|para|paras|s|ss|c|Sch|St|Co|Ltd|vol|Vol))\.\s+(?=[A-Z])/g

const lastMatch = (rx: RegExp, s: string): RegExpMatchArray | null => {
  let last: RegExpMatchArray | null = null
  for (const m of s.matchAll(rx)) last = m
  return last
}

/**
 * ⚠ "now vested in him" is bound to the ONE anchor it precedes (the transfer-of-functions Order that moved the power),
 * so it is read only from the words since the previous anchor. Read from the whole clause, it carried onto the next
 * power list — "…and now vested in it[a], and sections 5 and 17 of the State Pension Credit Act[b]" made [b] a
 * mention (validation sample, #41).
 */
/** Words that name a provision: "section 5", "Article 3", "Schedule 2", "Part IV" — or the bare tail of a list a
 *  footnote split, "…and 428(3) of the Act" or "…and 189(1) and (4) of" (brackets already dropped). */
const PROVISION_RX = /\b(?:(?:sections?|subsections?|articles?|regulations?|paragraphs?|schedules?|rules?|parts?|chapters?)\s+(?:[0-9]|[IVX]+\b|[A-Z]\b)|\d+[A-Z]*\b[\s,]*(?:and\s+)?(?:of|to)\b)/i
const ANCHOR_BOUND_RX = /\bnow vested in (?:it|him|her|them)\b(?! by)/gi
/** ⚠ Bracketed words are an aside: "powers conferred by section 3(3) (having regard to the definition … in section
 *  3(4)) of the Act" is a power, and the bracket's "having regard to" outranked it before they were dropped (#57).
 *  Repeated until nothing changes: that aside has a bracket inside it, and one pass left it standing. */
const dropAsides = (s: string) => { let t = s, prev: string; do { prev = t; t = t.replace(/\([^()]*\)/g, ' ') } while (t !== prev); return t }

/**
 * Pure. `before` = the stripped enacting words up to the anchor; `sincePrevious` = the words since the previous
 * anchor in the same scope (the whole of `before` for the first).
 */
export function enablingRole(before: string, sincePrevious: string = before): { role: EnablingRole; roleWords: string | null } {
  const ends = [...before.matchAll(SENTENCE_END_RX)]
  const clause = dropAsides(ends.length ? before.slice(ends[ends.length - 1].index! + ends[ends.length - 1][0].length) : before)
  const local = dropAsides(sincePrevious).slice(-clause.length)
  // Every candidate measured by how far it ENDS before the anchor: the nearest governs. On a tie the LONGER phrase
  // wins, because one holds the other: "makes the following Regulations pursuant to" (power) holds "pursuant to",
  // and "required by virtue of" (mention) holds "by virtue of" (third holdout, T18).
  const gap = (text: string, m: RegExpMatchArray | null) => (m ? text.length - (m.index! + m[0].length) : Infinity)
  let power = lastMatch(POWER_RX, clause)
  // ⚠ A power formula INHERITED across an earlier anchor reaches this one only if the words since that anchor name a
  // provision of it. "…sections 3 and 13 of the 1992 Act[a], and of all other powers enabling him, after reference to
  // the Social Security Advisory Committee[b]": [b] is a body, cited to the Act that set it up (third holdout, T3, T5).
  if (power && !lastMatch(POWER_RX, local) && !PROVISION_RX.test(local)) power = null
  let mention = lastMatch(MENTION_RX, clause)
  let mentionGap = gap(clause, mention)
  const bound = lastMatch(ANCHOR_BOUND_RX, local)
  if (gap(local, bound) < mentionGap) { mention = bound; mentionGap = gap(local, bound) }
  if (power && (gap(clause, power) < mentionGap || (gap(clause, power) === mentionGap && power[0].length >= mention![0].length))) {
    return { role: 'power', roleWords: power[0] }
  }
  if (mention) return { role: 'mention', roleWords: mention[0] }
  return { role: 'unstated', roleWords: null }
}

/** Primary legislation, for "that Act"; everything else an anchor can name is an instrument, for "that Order". */
const PRIMARY_GID_RX = /^(?:ukpga|asp|nia|anaw|asc|mwa|ukla|apni|aep|aosp|apgb|gbla|ukcm|mnia|aip)\//
const BACK_ACT_RX = /\b(?:of|to) (that|the said|the) (Act|Order)\b(?!\s*\u0001)/g
const BACK_SECTION_RX = /\b(?:by|under|in) (?:that|the said) (?:section|sections|article|articles|regulation|regulations)\b/g
const DEFINED_AS_RX = (noun: string) => new RegExp(`^[^\\u0001]{0,160}?\\(\\s*[“"‘']\\s*the ${noun}\\s*[”"’']\\s*\\)`)

export type EnablingOutcome =
  | { kind: 'no-preamble' }
  | { kind: 'elided' }          // TNA replaced a revised SI's preamble with ". . . ."
  | { kind: 'no-target' }
  | { kind: 'hits'; hits: EnablingHit[] }

/**
 * The powers named by back-reference — see `enablingRole`'s header. `marked` is the scope's stripped words with each
 * anchor kept as \u0001; `anchors` says where each one ends in it and what it names. Only a phrase a POWER formula
 * governs is written, and never one that repeats a power hit already there (same target, same provisions).
 */
function backReferences(marked: string, anchors: Array<{ at: number; gid: string | null; hit: EnablingHit | null }>,
                        hits: EnablingHit[], recital: boolean): EnablingHit[] {
  const out: EnablingHit[] = []
  const clean = (s: string) => s.replace(/\u0001/g, ' ').replace(/\s+/g, ' ').trim()
  const key = (target: string, refs: string[]) => `${target}|${[...refs].sort().join(',')}`
  const add = (p: number, words: string, targetGid: string, refs: string[]) => {
    const before = clean(marked.slice(0, p))
    const previous = anchors.filter(a => a.at <= p && a.gid !== null).pop()
    const { role, roleWords } = enablingRole(before, clean(marked.slice(previous?.at ?? 0, p)))
    if (role !== 'power') return
    if ([...hits, ...out].some(h => h.role === 'power' && key(h.targetGid, h.refs) === key(targetGid, refs))) return
    out.push({
      targetGid, refs, role, roleWords, backReference: true,
      citationText: `${before} ${words}`.slice(-240).replace(/^\S*\s+/, '').trim(),
      rawFragment: marked.slice(Math.max(0, p - 300), p + 300).replace(/\u0001/g, '[anchor]'),
      recitalFallback: recital, beforeWindow: before.slice(-300),
    })
  }
  for (const m of marked.matchAll(BACK_ACT_RX)) {
    const p = m.index!
    const prior = anchors.filter(a => a.at <= p && a.gid !== null)
    const target = m[1] === 'the'
      ? prior.filter(a => DEFINED_AS_RX(m[2]).test(marked.slice(a.at, a.at + 220))).pop()?.gid
      : prior.filter(a => (m[2] === 'Act') === PRIMARY_GID_RX.test(a.gid!)).pop()?.gid
    if (!target) continue
    // "section 59(1) of the Act" → the list before it, read exactly as at an anchor; "Schedule 2 to the Act" → Act-wide.
    add(p, m[0], target, refListBefore(`${clean(marked.slice(0, p))} ${m[0].split(' ')[0]}`))
  }
  // ⚠ "that section" is the nearest earlier hit that NAMES a section (article, regulation) — not merely the nearest
  // anchor: in "(being the appropriate Minister under subsection (7) of the said section 14[f4]) in exercise of the
  // powers conferred by that section", [f4] names the Minister's appointment and no section at all.
  for (const m of marked.matchAll(BACK_SECTION_RX)) {
    const kind = m[0].split(' ').pop()!.replace(/s$/, '')
    const prior = anchors.filter(a => a.at <= m.index! && a.hit?.refs.some(r => r.startsWith(`${kind}-`))).pop()
    if (prior?.hit) add(m.index!, m[0], prior.hit.targetGid, prior.hit.refs.filter(r => r.startsWith(`${kind}-`)))
  }
  return out
}

/** Parse one SI's enacting words. Pure: no counters, no writes. */
export function parseEnabling(gid: string, xml: string): EnablingOutcome {
  const pre = xml.match(/<SecondaryPreamble>[\s\S]*?<\/SecondaryPreamble>/)
  if (!pre) return { kind: 'no-preamble' }
  const enacting = pre[0].match(/<EnactingText>[\s\S]*?<\/EnactingText>/)?.[0] ?? pre[0]
  const plain = stripTags(enacting)
  if (/(\.\s+){8,}/.test(plain) || plain.replace(/[.\s]/g, '').length < 20) return { kind: 'elided' }

  // footnote id → first Citation gid in that footnote
  const footnoteGid = new Map<string, string>()
  for (const f of xml.matchAll(/<Footnote id="([^"]+)"[\s\S]*?<\/Footnote>/g)) {
    const cite = f[0].match(/<Citation\b[^>]*\sURI="([^"]+)"/)
    const parsed = cite ? parseLegUri(cite[1]) : null
    if (parsed) footnoteGid.set(f[1], parsed.gid)
  }

  const anchorRx = /<Citation\b[^>]*\sURI="([^"]+)"[^>]*>|<FootnoteRef\b[^>]*\sRef="([^"]+)"[^>]*\/?>/g
  const scan = (scope: string, recital: boolean): EnablingHit[] => {
    const out: EnablingHit[] = []
    // The stripped words with every anchor kept as \u0001, and what each one names — for the back-references below.
    let marked = ''
    const anchors: Array<{ at: number; gid: string | null; hit: EnablingHit | null }> = []
    let previous = 0
    // ⚠ Only an anchor that NAMES something splits the words for `enablingRole`: "sections 23, 312(1) and 59(1)[f2]
    // of the Water Act 1945[f3]" has a footnote [f2] that resolves to nothing, and splitting there left [f3] with
    // " of the Water Act 1945" — no provision, so the power was refused (final holdout, F35).
    let previousNaming = 0
    for (const a of scope.matchAll(anchorRx)) {
      marked += ` ${stripTags(scope.slice(previous, a.index))} \u0001`
      previous = a.index ?? 0
      const targetGid = a[1] ? parseLegUri(a[1])?.gid : footnoteGid.get(a[2] ?? '')
      const usable = !!targetGid && targetGid !== gid
      anchors.push({ at: marked.length, gid: usable ? targetGid! : null, hit: null })
      if (!usable) continue
      const sincePrevious = stripTags(scope.slice(previousNaming, a.index))
      previousNaming = a.index ?? 0
      const before = stripTags(scope.slice(0, a.index))
      // ⚠ Newer instruments mark EVERY fragment of one reference — "sections 5[c] (1)[c] (i)[c], 15[c] (1)[c] (a)[c]
      // … of the Social Security Administration Act 1992" (uksi/2026/201) — so the words between two anchors can be
      // "(1)". An anchor that continues the previous anchor's target, in the same sentence, is the same reference and
      // takes its role when its own words decide nothing; read alone, the fragments fell to `unstated`.
      const last = anchors.slice(0, -1).filter(x => x.gid !== null).pop() ?? null
      const continues = last?.hit && last.gid === targetGid && !new RegExp(SENTENCE_END_RX.source).test(sincePrevious)
      const own = enablingRole(before, sincePrevious)
      out.push({
        ...(own.role === 'unstated' && continues ? { role: last!.hit!.role, roleWords: last!.hit!.roleWords } : own),
        backReference: false,
        targetGid: targetGid!,
        refs: refListBefore(before),
        // ⚠ the words that GRANT the power, not the document's opening line.
        // A fixed slice of the preamble would quote the same sentence for every
        // anchor in a multi-power instrument and read as evidence for each.
        // ⚠ start at a word boundary — a fixed slice cuts mid-word and the
        // quote then reads as if the source said "he application of…"
        citationText: before.slice(-240).replace(/^\S*\s+/, '').trim(),
        rawFragment: scope.slice(Math.max(0, (a.index ?? 0) - 300), (a.index ?? 0) + 300),
        recitalFallback: recital,
        beforeWindow: before.slice(-300),
      })
      anchors[anchors.length - 1].hit = out[out.length - 1]
    }
    marked += ` ${stripTags(scope.slice(previous))}`
    return [...out, ...backReferences(marked, anchors, out, recital)]
  }
  let hits = scan(enacting, false)
  if (hits.length === 0 && pre[0] !== enacting) {
    // enacting words cite indirectly ("the Order of 1978", "powers in Schedule 1")
    // — the defining citation sits in the preamble recitals. Lower precision.
    hits = scan(pre[0], true)
  }
  return hits.length === 0 ? { kind: 'no-target' } : { kind: 'hits', hits }
}

function extractDoc(gid: string, xml: string): EdgeRow[] {
  stats.siDocs++
  const outcome = parseEnabling(gid, xml)
  if (outcome.kind === 'no-preamble') { stats.noPreamble++; return [] }
  if (outcome.kind === 'elided') { stats.elidedPreamble++; return [] }
  if (outcome.kind === 'no-target') { stats.noTarget++; return [] }

  const fromId = edgeId(gid)
  const edges: EdgeRow[] = []
  let sawRecital = false
  for (const h of outcome.hits) {
    if (h.recitalFallback) sawRecital = true
    const detail = ((h.recitalFallback ? '[preamble-recital] ' : '') + h.citationText).slice(0, 200)
    for (const ref of h.refs) {
      edges.push({ fromId, toId: edgeId(h.targetGid, ref), edgeType: 'made-under', subType: '', source: SOURCE, granularity: granularityOf(false, true), detail })
    }
    stats.sectionEdges += h.refs.length
    edges.push({ fromId, toId: edgeId(h.targetGid), edgeType: 'made-under', subType: '', source: SOURCE, granularity: granularityOf(false, false), detail })
    stats.actEdges++
  }
  if (sawRecital) stats.recitalFallback++
  return edges
}

function loadCheckpoint(): Set<string> {
  if (!fs.existsSync(CHECKPOINT)) return new Set()
  return new Set(JSON.parse(fs.readFileSync(CHECKPOINT, 'utf8')).done as string[])
}

async function main() {
  const pilotIx = process.argv.indexOf('--pilot')
  const pilot = pilotIx >= 0
  const pilotN = pilot ? parseInt(process.argv[pilotIx + 1] ?? '500', 10) || 500 : 0
  if (process.argv.includes('--reset') && fs.existsSync(CHECKPOINT)) fs.unlinkSync(CHECKPOINT)
  const done = pilot ? new Set<string>() : loadCheckpoint()

  console.log(`[made-under] opening ${ZIP_PATH}…`)
  const zip = new ZipReader(ZIP_PATH)
  const entries = zip.entries.filter(e => {
    const m = e.name.match(/\/([a-z]+)-\d{4}-\d+-\w+-data\.xml$/)
    return m != null && SI_TYPES.has(m[1])
  })
  console.log(`[made-under] ${entries.length} SI docs in zip${pilot ? ` (PILOT: first ${pilotN}, no writes)` : ''}`)

  let buffer: EdgeRow[] = []
  let processed = 0
  const t0 = Date.now()
  for (const entry of entries) {
    if (pilot && processed >= pilotN) break
    const m = entry.name.match(/\/([a-z]+)-(\d{4})-(\d+)-\w+-data\.xml$/)!
    const gid = `${m[1]}/${m[2]}/${m[3]}`
    if (done.has(gid)) continue
    buffer.push(...extractDoc(gid, zip.readText(entry)))
    done.add(gid)
    processed++
    if (!pilot && buffer.length >= 5000) {
      stats.written += await insertEdges(dedupeEdges(buffer))
      buffer = []
      fs.writeFileSync(CHECKPOINT, JSON.stringify({ done: [...done] }))
      console.log(`  ${processed} docs, written=${stats.written}, ${((Date.now() - t0) / 1000).toFixed(0)}s`)
    }
  }
  if (!pilot && buffer.length > 0) {
    stats.written += await insertEdges(dedupeEdges(buffer))
    fs.writeFileSync(CHECKPOINT, JSON.stringify({ done: [...done] }))
  }

  console.log('\n[made-under] stats:', JSON.stringify(stats, null, 1))
  console.log(`[made-under] accounted: siDocs=${stats.siDocs} = with-edges(${stats.siDocs - stats.noPreamble - stats.elidedPreamble - stats.noTarget}) + noPreamble(${stats.noPreamble}) + elided(${stats.elidedPreamble}) + noTarget(${stats.noTarget})`)
  if (pilot) {
    const perDoc = (stats.actEdges + stats.sectionEdges) / Math.max(1, stats.siDocs - stats.noPreamble - stats.elidedPreamble)
    console.log(`[made-under] PILOT: ${perDoc.toFixed(2)} edges per preambled doc → extrapolate over full SI count before the full run`)
  }
  await endNeonPool()
}
// ⚠ GUARDED. `parseEnabling` is imported by extract-enabling-edges.ts, and an
// unguarded main() means importing the parser STARTS A FULL EXTRACTION over a
// 1.4 GB zip that writes to the database. GRAPH 4A had to add this same guard to
// extract-cites-edges.ts for exactly the same reason.
if (require.main === module) {
  main().catch(e => { console.error('[made-under] FATAL', e); process.exit(1) })
}
