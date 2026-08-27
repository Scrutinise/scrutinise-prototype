/**
 * rekey-s17-committees.ts — S17 §1. RE-KEY THE TEN COMMITTEES QUESTIONS, AND VERIFY EVERY KEY BY
 * READING THE DOCUMENT OUT OF STORAGE.
 *
 * ════════════════════════════════════════════════════════════════════════════════════════════════
 * WHY THIS EXISTS
 * ════════════════════════════════════════════════════════════════════════════════════════════════
 * S16 §3.3 established that committees' 2-of-10 is an INSTRUMENT defect, not a retrieval defect:
 * the keyed documents come back at ranks 1, 1, 2 and 4 when asked for by their own titles, while
 * **10 of committees' 19 answer keys are `Correspondence:` ministerial letters** — 0 of 19
 * everywhere else — against questions that ask what a COMMITTEE said. Three more are one written
 * submission out of 525, 115 and 54 equally valid ones.
 *
 * ⚠⚠ THE TWO DEFECTS ARE DIFFERENT AND THE FIX IS DIFFERENT FOR EACH.
 *
 *   1. WRONG KIND. "What did the committee say about X" keyed to a minister's letter. A letter to
 *      a committee is not the committee's view: *"a water company says the rules work"* is not
 *      *"the committee found the rules work"*. The fix is to key a document of the right kind.
 *   2. ONE OF MANY. "What did people submitting evidence say about X" keyed to submission 679 of
 *      525-in-the-corpus. With a 20-wide window and 525 equally good documents, PERFECT retrieval
 *      scores wrong ~96% of the time. The fix is NOT a better single key — there is no such thing.
 *      Either the question is re-worded so one document can be correct, or every document that
 *      answers it is keyed, or it is unscoreable.
 *
 * ════════════════════════════════════════════════════════════════════════════════════════════════
 * THE RULE THIS FILE APPLIES, STATED ONCE SO IT CAN BE ARGUED WITH
 * ════════════════════════════════════════════════════════════════════════════════════════════════
 * **A key set must contain every document in the corpus that answers the question as posed.**
 * If that set is small and enumerable, key all of it. If it is large, the question is
 * under-specified and the QUESTION is what is wrong. Keying one arbitrary member of a large set is
 * the defect — it marks the platform wrong every time the platform is right.
 *
 * ⚠ NOTHING HERE IS SCORED. §1 of the brief is explicit: this produces a file for Charlie. The
 * gold set itself (`scripts/gold/s10-gold-set.ts`) is NOT edited by this sprint — the re-key lands
 * only if Charlie validates it, exactly as the debates re-key did.
 *
 * ⚠ EVERY PROPOSED KEY IS READ BACK OUT OF R2 AND MUST CONTAIN ITS OWN CONFIRMING TERM. The term
 * is declared next to the key BEFORE the read; a key whose body does not contain it is reported as
 * UNCONFIRMED and its extract is still printed, so a bad proposal is visible rather than absent.
 * The run prints what it counted: keys proposed, bodies read, terms found.
 *
 * Usage:
 *   npm run rekey:s17
 *   tsx --env-file=.env --tsconfig tsconfig.json scripts/rekey-s17-committees.ts [--out <path>]
 */
import fs from 'node:fs'
import path from 'node:path'
import { prisma } from '../lib/prisma'
import { r2Get } from '../lib/r2'
import { GOLD_CORPUS } from './gold/s10-gold-set'

type Kind = 'committee report' | 'written evidence' | 'correspondence'

interface ProposedKey {
  id: string
  /** Declared BEFORE the body is read. Lower-cased substring the body must contain. */
  confirm: string
}

interface Proposal {
  /** S10 question number. */
  n: number
  code: string
  /** The question as it stands in the gold set today. */
  oldQuestion: string
  /** The question after this sprint's re-wording, or the same string if unchanged. */
  newQuestion: string
  verdict: 'RE-KEY' | 'RE-WORD AND RE-KEY' | 'KEEP, KEYS WIDENED' | 'KEEP, KEYS NARROWED'
  /** What the question asks for, decided first — the whole point of the exercise. */
  asks: Kind
  /** What the CURRENT keys are. */
  oldKind: Kind
  /** Reasoning, one paragraph, printed into the file. */
  why: string
  /** Every document in the corpus that answers the question as posed, at DOCUMENT level. */
  answeringDocs: string[]
  /** The chunk-level keys proposed, each read back and confirmed. */
  keys: ProposedKey[]
  /** Documents that also answer and are deliberately NOT keyed, with the reason. */
  notKeyed?: string
}

// ════════════════════════════════════════════════════════════════════════════════════════════════
// THE PROPOSAL. Ten entries, one per committees question.
// ════════════════════════════════════════════════════════════════════════════════════════════════
const PROPOSALS: Proposal[] = [
  {
    n: 1, code: 'C1',
    oldQuestion: 'What did the Lords say about how badly water and sewage regulation was failing?',
    newQuestion: 'What did the Lords say about how badly water and sewage regulation was failing?',
    verdict: 'KEEP, KEYS NARROWED', asks: 'committee report', oldKind: 'committee report',
    why:
      'The one committees question whose kind was right all along, and it is the one that is FOUND. ' +
      '⚠ But it is found on the wrong page: the current key `…-0001` is the report\'s COVER — the ' +
      'Lords crest, the list of members, the clerk\'s telephone number and the table of contents. It ' +
      'contains the report\'s title, which is why it retrieves, and it answers nothing. `…-0002` ' +
      'straddles the contents list and the Summary; `…-0003` is squarely the committee\'s finding. ' +
      'Keys narrowed to the two substantive chunks. ⚠ THIS MAY TURN A PASS INTO A FAIL, and if it ' +
      'does that is the truer reading: retrieving a report\'s cover sheet is not answering a question.',
    answeringDocs: ['publication:34458'],
    keys: [
      { id: 'committees-reports:publication:34458:189872-0002', confirm: 'lowest ever level' },
      { id: 'committees-reports:publication:34458:189872-0003', confirm: 'ofwat has failed' },
    ],
    notKeyed: '`…-0001` (the cover and contents) is dropped, not moved.',
  },
  {
    n: 2, code: 'C2',
    oldQuestion: 'Has a committee looked at the Post Office Horizon compensation scheme?',
    newQuestion: 'Has a committee looked at the Post Office Horizon compensation scheme?',
    verdict: 'RE-KEY', asks: 'committee report', oldKind: 'correspondence',
    why:
      'The question asks whether a COMMITTEE has looked at the redress schemes. Both current keys ' +
      'are letters — one from the committee to a minister asking for improvements, one from the ' +
      'Post Office. A letter is evidence that somebody wrote in, not that a committee examined ' +
      'anything. The Business and Trade Committee\'s Sixteenth Report of Session 2024–26 is exactly ' +
      'what the question asks for: it examines all three Horizon redress schemes and reports on them.',
    answeringDocs: ['publication:52110', 'publication:47183'],
    keys: [
      { id: 'committees-reports:publication:52110:290159-0004', confirm: 'redress' },
      { id: 'committees-reports:publication:52110:290159-0005', confirm: 'redress' },
    ],
    notKeyed:
      '`publication:47183` (4th Report — *Post Office Horizon scandal redress: Unfinished business: ' +
      'Government response*) also answers and is NOT keyed: its substance is the government\'s reply, ' +
      'printed by the committee. Listed as an answering document for the document-level rule (D-1).',
  },
  {
    n: 3, code: 'C3',
    oldQuestion: "What has Parliament been told about the government's response to the Grenfell Inquiry?",
    newQuestion: "What has Parliament been told about the government's response to the Grenfell Inquiry?",
    verdict: 'KEEP, KEYS WIDENED', asks: 'correspondence', oldKind: 'correspondence',
    why:
      '⚠ THE ONE CORRESPONDENCE KEY THAT WAS ALWAYS RIGHT, AND S16 SWEPT IT UP WITH THE OTHERS. ' +
      '"What has Parliament been TOLD" asks precisely for what was written to a committee, and a ' +
      'ministerial letter is the answering kind. The defect here is the second one, not the first: ' +
      'the corpus holds EIGHT letters to the committee about the government\'s response to, and ' +
      'implementation of, the Grenfell Inquiry, and the gold set named one of them. All eight are ' +
      'keyed. ⚠ Two further `%Grenfell%` matches are excluded deliberately: `publication:22805` is ' +
      'correspondence from **Michael Grenfell** of the CMA about EU-exit regulation — a surname, not ' +
      'the tower — and `publication:52542` concerns the Grenfell Tower Memorial (Expenditure) Bill, ' +
      'which is a different subject. A title-substring re-key would have taken both.',
    answeringDocs: [
      'publication:53422', 'publication:51973', 'publication:50962', 'publication:50290',
      'publication:49716', 'publication:49441', 'publication:47864', 'publication:46883',
    ],
    keys: [
      { id: 'committees-reports:publication:53422:298600', confirm: 'grenfell' },
      { id: 'committees-reports:publication:51973:288454', confirm: 'grenfell' },
      { id: 'committees-reports:publication:50962:282251', confirm: 'grenfell' },
      { id: 'committees-reports:publication:50290:271753', confirm: 'grenfell' },
      { id: 'committees-reports:publication:49716:266488', confirm: 'grenfell' },
      { id: 'committees-reports:publication:49441:263245', confirm: 'grenfell' },
      { id: 'committees-reports:publication:47864:250397', confirm: 'grenfell' },
      { id: 'committees-reports:publication:46883:241779', confirm: 'grenfell' },
    ],
  },
  {
    n: 4, code: 'C4',
    oldQuestion: 'What did the committee say about moving people onto Universal Credit?',
    newQuestion: 'What did the committee say about moving people onto Universal Credit?',
    verdict: 'RE-KEY', asks: 'committee report', oldKind: 'correspondence',
    why:
      'The question names the committee as the speaker. The current key is *Correspondence with the ' +
      'Secretary of State relating to managed migration* — the department writing to the committee, ' +
      'the opposite direction. The Public Accounts Committee\'s Twenty-Ninth Report, *Progress in ' +
      'implementing Universal Credit*, has moving legacy claimants onto Universal Credit as its ' +
      'second and third chapters and states the committee\'s own conclusions.',
    answeringDocs: ['publication:44438'],
    keys: [
      // ⚠ `moving 900,000 claimants` and not `universal credit`: this chunk straddles the contents
      // list and the Summary, and the shorter term matches the contents line first — the confirming
      // sentence came back as "Contents Summary 3 Introduction 4 …", which proves the document and
      // answers nothing.
      { id: 'committees-reports:publication:44438:220821-0002', confirm: 'moving 900,000 claimants' },
      { id: 'committees-reports:publication:44438:220821-0003', confirm: 'universal credit' },
    ],
  },
  {
    n: 5, code: 'C5',
    oldQuestion: 'Has anyone in Parliament raised leasehold reform with ministers?',
    newQuestion: 'What have MPs said about the plan to bring leasehold to an end?',
    verdict: 'RE-WORD AND RE-KEY', asks: 'committee report', oldKind: 'correspondence',
    why:
      '⚠ THE QUESTION IS THE PROBLEM HERE, NOT ONLY THE KEY. "Has anyone in Parliament raised X with ' +
      'ministers" is answered by any of a large and constantly growing set of letters — the corpus ' +
      'holds a dozen on leasehold alone — and it also has a near-vacuous answer ("yes"). The current ' +
      'key is a letter FROM the minister TO the chair, which is not anyone in Parliament raising ' +
      'anything with anyone. Re-worded to the question a user actually wants answered, and keyed to ' +
      'the Housing, Communities and Local Government Committee\'s pre-legislative scrutiny of the ' +
      'draft Commonhold and Leasehold Reform Bill, whose Conclusions and recommendations chapter is ' +
      'the committee speaking in its own voice.',
    answeringDocs: ['publication:53249', 'publication:53273', 'publication:53529'],
    keys: [
      { id: 'committees-reports:publication:53249:297864-0002', confirm: 'five million leaseholders' },
      { id: 'committees-reports:publication:53249:297864-0070', confirm: 'universal cap on ground rents' },
    ],
    notKeyed:
      '⚠ `publication:53273` (Large Print, 114 chunks) and `publication:53529` (Easy Read, 2 chunks) ' +
      'are THE SAME REPORT in other formats, held as separate documents. They answer the question and ' +
      'are not keyed, because their chunks were not read. **A hit on the Large Print copy would score ' +
      'WRONG today while giving the user the right report** — an instance of exactly this sprint\'s ' +
      'defect, arriving from the ingest side. Reported to ingest, not fixed here.',
  },
  {
    n: 6, code: 'C6',
    oldQuestion: 'What did people submitting evidence say about how AI should be governed?',
    newQuestion: 'What did the Ada Lovelace Institute tell MPs about how AI should be governed?',
    verdict: 'RE-WORD AND RE-KEY', asks: 'written evidence', oldKind: 'written evidence',
    why:
      'The KIND was right and the question was still unscoreable: the corpus holds **115 submissions** ' +
      'to the Science, Innovation and Technology Committee\'s governance-of-AI inquiry and the gold ' +
      'set named GAI0001 and GAI0002. Every one of the 115 answers "what did people submitting ' +
      'evidence say", so retrieval that returns any of the other 113 is marked wrong for being right. ' +
      'Re-worded to name a submitter, which makes exactly one document correct and is a question ' +
      'people genuinely ask.',
    answeringDocs: ['writtenevidence:113850'],
    keys: [
      { id: 'committees-evidence:writtenevidence:113850:179508', confirm: 'ada lovelace' },
    ],
  },
  {
    n: 7, code: 'C7',
    oldQuestion: 'What evidence was submitted about net zero and trade?',
    newQuestion: 'What evidence was submitted about net zero and trade?',
    verdict: 'KEEP, KEYS WIDENED', asks: 'written evidence', oldKind: 'written evidence',
    why:
      'The set-answered archetype, kept deliberately — "what did people tell the committee about X" ' +
      'is a real question and the platform should answer it. It is scoreable here because the set is ' +
      'ENUMERABLE: the corpus holds 26 submissions to this inquiry, and all 26 are keyed. ' +
      '⚠ SAY WHAT THIS MEASURES. With 26 correct answers in a 20-wide window it tests whether the ' +
      'collection is REACHABLE, not whether ranking is good. It was the collection\'s only found ' +
      'evidence question in S16 for exactly that reason (1 of 26, the smallest class), and that ' +
      'control is superseded by this re-key rather than quietly lost.',
    answeringDocs: ['(all 26 submissions to the Net zero and trade inquiry)'],
    keys: [
      { id: 'committees-evidence:writtenevidence:129004:219332', confirm: 'trade' },
      { id: 'committees-evidence:writtenevidence:129526:219440', confirm: 'trade' },
      { id: 'committees-evidence:writtenevidence:129643:219935', confirm: 'trade' },
      { id: 'committees-evidence:writtenevidence:129721:220091', confirm: 'trade' },
      { id: 'committees-evidence:writtenevidence:129751:220212', confirm: 'trade' },
      { id: 'committees-evidence:writtenevidence:129770:220211', confirm: 'trade' },
      { id: 'committees-evidence:writtenevidence:129792:220328', confirm: 'trade' },
      { id: 'committees-evidence:writtenevidence:129829:220658', confirm: 'trade' },
      { id: 'committees-evidence:writtenevidence:129833:220659', confirm: 'trade' },
      { id: 'committees-evidence:writtenevidence:129838:220660', confirm: 'trade' },
      { id: 'committees-evidence:writtenevidence:129843:220661', confirm: 'trade' },
      { id: 'committees-evidence:writtenevidence:129866:220663', confirm: 'trade' },
      { id: 'committees-evidence:writtenevidence:129870:220664', confirm: 'trade' },
      { id: 'committees-evidence:writtenevidence:129871:220666', confirm: 'trade' },
      { id: 'committees-evidence:writtenevidence:129872:220668', confirm: 'trade' },
      { id: 'committees-evidence:writtenevidence:129873:220671', confirm: 'trade' },
      { id: 'committees-evidence:writtenevidence:129874:220672', confirm: 'trade' },
      { id: 'committees-evidence:writtenevidence:129876:220673', confirm: 'trade' },
      { id: 'committees-evidence:writtenevidence:129877:221044', confirm: 'trade' },
      { id: 'committees-evidence:writtenevidence:129880:220677', confirm: 'trade' },
      { id: 'committees-evidence:writtenevidence:129902:220528', confirm: 'trade' },
      { id: 'committees-evidence:writtenevidence:129907:220547', confirm: 'trade' },
      { id: 'committees-evidence:writtenevidence:129908:220550', confirm: 'trade' },
      { id: 'committees-evidence:writtenevidence:129927:220733', confirm: 'trade' },
      { id: 'committees-evidence:writtenevidence:129963:220994', confirm: 'trade' },
      { id: 'committees-evidence:writtenevidence:130008:221220', confirm: 'trade' },
    ],
  },
  {
    n: 8, code: 'C8',
    oldQuestion: 'What did witnesses tell the committee about special educational needs?',
    newQuestion: 'What did the National Association of Head Teachers tell MPs about support for children with special educational needs?',
    verdict: 'RE-WORD AND RE-KEY', asks: 'written evidence', oldKind: 'written evidence',
    why:
      'The worst instance of the second defect in the set: **525 submissions** to the Education ' +
      'Committee\'s SEND inquiry are held, and the gold set named SCN0679 and one other. A 20-wide ' +
      'window over 525 equally valid documents marks perfect retrieval wrong about 96% of the time. ' +
      'Re-worded to name a submitter whose evidence a user might plausibly ask for; the NAHT ' +
      'submission is the largest in the inquiry and speaks for 29,000 school leaders.',
    answeringDocs: ['writtenevidence:91783'],
    keys: [
      { id: 'committees-evidence:writtenevidence:91783:142535', confirm: 'naht' },
    ],
  },
  {
    n: 9, code: 'C9',
    oldQuestion: 'What was the committee told about serious violence?',
    newQuestion: "What did the National Police Chiefs' Council tell the committee about serious violence?",
    verdict: 'RE-WORD AND RE-KEY', asks: 'written evidence', oldKind: 'written evidence',
    why:
      'Same defect, 54 submissions. "What was the committee told about serious violence" is answered ' +
      'by every one of them. Re-worded to name the submitter; the NPCC submission is the police ' +
      'service\'s own account and is what a user asking this usually wants.',
    answeringDocs: ['writtenevidence:93654'],
    keys: [
      { id: 'committees-evidence:writtenevidence:93654:141537', confirm: 'national police chiefs' },
    ],
  },
  {
    n: 10, code: 'C10',
    oldQuestion: 'Has Parliament examined NHS waiting times for planned operations?',
    newQuestion: 'Has Parliament examined NHS waiting times for planned operations?',
    verdict: 'RE-KEY', asks: 'committee report', oldKind: 'correspondence',
    why:
      'The question asks whether Parliament has EXAMINED something, which a report answers and a ' +
      'letter does not. The current keys are two letters from permanent secretaries. The corpus holds ' +
      'FIVE Public Accounts Committee reports on NHS waiting times for elective care, spanning 2014 ' +
      'to 2025, every one of which answers the question — so all five are keyed rather than the most ' +
      'recent one, which would have been the same arbitrary-member choice in a smaller set.',
    answeringDocs: [
      'publication:50242', 'publication:34131', 'publication:9266', 'publication:20216', 'publication:10612',
    ],
    keys: [
      // ⚠ The four `-0004`s are DELIBERATE. `-0002` in each of these reports is the contents list,
      // and the first run's confirming sentences came back as "Contents Summary 3 Introduction 4
      // Conclusions and recommendations 5" — C1's defect, reproduced by my own choice of key. The
      // contents guard below now catches it and these keys were moved rather than the guard relaxed.
      { id: 'committees-reports:publication:50242:271529-0002', confirm: 'waiting' },
      { id: 'committees-reports:publication:34131:187908-0004', confirm: 'waiting' },
      { id: 'committees-reports:publication:9266:160332-0004', confirm: 'waiting' },
      { id: 'committees-reports:publication:20216:arc-0006', confirm: 'waiting' },
      { id: 'committees-reports:publication:10612:arc-0004', confirm: 'waiting' },
    ],
  },
]

// ── front matter, because a cover page that carries the report's title retrieves well and answers
//    nothing. Heuristic, and it is reported as a FLAG for a human rather than acted on. ────────────
const FRONT_MATTER = [
  /current membership/i, /ordered to be printed/i, /all correspondence should be addressed/i,
  /declaration of interests/i, /^contents\b/im,
]
function looksLikeFrontMatter(body: string): string[] {
  return FRONT_MATTER.filter((r) => r.test(body.slice(0, 2500))).map((r) => String(r))
}

/**
 * ⚠⚠ THE FRONT-MATTER FLAG IS NOT ENOUGH, AND MY OWN FIRST RUN PROVED IT. It reported 0 across all
 * fifty keys — correctly, by its own definition — while FOUR of C10's five confirming sentences
 * were a table of CONTENTS: *"Contents Summary 3 Introduction 4 Conclusions and recommendations 5"*.
 * That is C1's defect, the one this sprint drops a key for, reproduced by my own choice of key.
 *
 * A cover page and a contents run are different shapes, and the thing that matters is not whether
 * the CHUNK contains a contents list — several substantive chunks straddle one — but whether the
 * SENTENCE PRINTED INTO THE FILE is prose. So the test is applied to the quote, which is the thing
 * a reader will judge the re-key by.
 *
 * The signature is `word number` repeated: a heading followed by its page number, four or more
 * times. Page numbers are 1–3 digits, which is why a year (2021) does not trip it.
 */
function looksLikeContentsLine(sentence: string): boolean {
  return (sentence.match(/[A-Za-z]{3,}\s+\d{1,3}(?=\s|$)/g) ?? []).length >= 4
}

/**
 * ⚠ AND A THIRD SHAPE, FOUND THE SAME WAY. With the contents guard satisfied, one C10 quote came
 * back as *"NHS waiting times for elective and cancer treatment 6 3."* — a running header and a
 * paragraph number. It contains the term, it is not a contents list, and it answers nothing.
 * A confirming sentence has to be long enough to BE an answer; twelve words is the floor, and it is
 * a floor a real committee sentence clears without trying.
 */
function looksLikeHeaderFragment(sentence: string): boolean {
  const s = sentence.replace(/^…\s*/, '').trim()
  // ⚠ A LENGTH THRESHOLD ALONE WAS WRONG AND THE RUN SHOWED IT. Twelve words flagged four quotes;
  // three were real submissions saying something in eleven words ("Ensures trade policy accelerates
  // the deployment and take-up of sustainable practices"). Tuning the number until only the bad one
  // failed would have been fitting a threshold to four examples. The bad one has a SHAPE instead:
  // it ends in the running header's page and paragraph numbers — "…elective and cancer treatment 6 3."
  if (/\s\d{1,3}(\s+\d{1,3})*\s*[.:]?$/.test(s)) return true
  return s.split(/\s+/).filter((w) => /[A-Za-z]/.test(w)).length < 8
}

/** The sentence that carries the confirming term, trimmed to something quotable.
 *  ⚠ When there is no sentence boundary within reach the cut is marked with an ellipsis and
 *  snapped to a word boundary — a quote that begins mid-word reads as corruption in the corpus
 *  when it is only this function's arithmetic. */
function confirmingSentence(body: string, term: string): string | null {
  const flat = body.replace(/\s+/g, ' ').trim()
  const i = flat.toLowerCase().indexOf(term.toLowerCase())
  if (i < 0) return null
  const back = flat.lastIndexOf('. ', i)
  let start: number
  let cut = false
  if (back >= 0 && i - back < 400) {
    start = back + 2
  } else {
    start = Math.max(0, i - 200)
    if (start > 0) { const sp = flat.indexOf(' ', start); start = sp < 0 ? start : sp + 1; cut = true }
  }
  let end = flat.indexOf('. ', i)
  end = end < 0 || end - i > 400 ? Math.min(flat.length, i + 300) : end + 1
  return (cut ? '… ' : '') + flat.slice(start, end).trim().slice(0, 600)
}

/**
 * ⚠ THE FRONT-MATTER FLAG REPORTS **0** OVER THE FIFTY PROPOSED KEYS, AND A GUARD THAT HAS NEVER
 * FIRED IS NOT A GUARD. `--self-test` runs it against two chunks known to BE front matter — the
 * cover of the water report (the key this sprint drops) and the cover of the Horizon report — and
 * one known to be substantive. It must fire twice and stay silent once, or the zero above means
 * nothing.
 */
const SELF_TEST: Array<{ id: string; expectFrontMatter: boolean; what: string }> = [
  { id: 'committees-reports:publication:34458:189872-0001', expectFrontMatter: true, what: 'water report cover + contents (C1\'s dropped key)' },
  { id: 'committees-reports:publication:52110:290159-0001', expectFrontMatter: true, what: 'Horizon report cover + membership' },
  { id: 'committees-reports:publication:34458:189872-0003', expectFrontMatter: false, what: 'water report, the committee\'s finding' },
]

async function selfTest(): Promise<number> {
  let bad = 0
  console.log('── front-matter detector, watched failing and passing ──')
  for (const t of SELF_TEST) {
    const rows = await prisma.$queryRawUnsafe<any[]>(`SELECT "r2Key" FROM corpus_sections WHERE id = $1`, t.id)
    const body = rows[0]?.r2Key ? await r2Get(rows[0].r2Key) : null
    if (body === null) { console.log(`  ⚠ ${t.id} — no body, cannot test`); bad++; continue }
    const hits = looksLikeFrontMatter(body)
    const got = hits.length > 0
    const ok = got === t.expectFrontMatter
    if (!ok) bad++
    console.log(`  ${ok ? 'ok  ' : 'FAIL'} ${t.what}: expected ${t.expectFrontMatter ? 'FLAG' : 'no flag'}, ` +
      `got ${got ? `FLAG (${hits.length} patterns)` : 'no flag'}`)
  }
  console.log(`  ${SELF_TEST.length - bad}/${SELF_TEST.length} as expected`)
  return bad
}

const outArg = process.argv.indexOf('--out')
const OUT = outArg >= 0 ? process.argv[outArg + 1] : path.join(__dirname, '../../docs/GOLD_COMMITTEES_REKEY.md')

async function main() {
  if (process.argv.includes('--self-test')) {
    const bad = await selfTest()
    await prisma.$disconnect()
    process.exit(bad === 0 ? 0 : 1)
  }
  const stamp = new Date().toISOString().replace('T', ' ').slice(0, 16) + ' UTC'
  const goldByN = new Map(GOLD_CORPUS.map((q) => [q.n, q]))

  let proposed = 0, read = 0, confirmed = 0, missing = 0, frontMatter = 0, contentsQuotes = 0, headerFragments = 0
  const out: string[] = []
  const json: any[] = []

  out.push('# GOLD SET — THE TEN COMMITTEES QUESTIONS, RE-KEYED')
  out.push('')
  out.push(`*Generated by \`scripts/rekey-s17-committees.ts\` at ${stamp}. Every key below was read`)
  out.push('back out of R2 by this run; the confirming sentence printed under each one is that stored')
  out.push('text, not a summary of it. **Nothing is scored here** — the gold set is unchanged until')
  out.push('Charlie validates this file.*')
  out.push('')
  out.push('## The defect, and the rule')
  out.push('')
  out.push('S16 found that **10 of committees\' 19 answer keys are `Correspondence:` ministerial letters**')
  out.push('— against **0 of 19** in every other collection — while the questions ask what a *committee*')
  out.push('said; and that three more are one written submission out of **525, 115 and 54** equally valid')
  out.push('ones. The keyed documents retrieve perfectly well when asked for by their own titles. **The')
  out.push('ruler was broken, not the retriever.**')
  out.push('')
  out.push('The rule applied to all ten, stated so it can be argued with:')
  out.push('')
  out.push('> **A key set must contain every document in the corpus that answers the question as posed.**')
  out.push('> If that set is small and enumerable, key all of it. If it is large, the QUESTION is')
  out.push('> under-specified and the question is what changes. Keying one arbitrary member of a large')
  out.push('> set marks the platform wrong every time it is right.')
  out.push('')
  out.push('⚠ **Two different defects, two different fixes.** *Wrong kind* (a minister\'s letter answering')
  out.push('"what did the committee say") is fixed by keying a document of the right kind. *One of many*')
  out.push('is not fixable by a better single key — there is no such thing — so either the question is')
  out.push('re-worded until one document can be correct, or every answering document is keyed.')
  out.push('')

  for (const p of PROPOSALS) {
    const g = goldByN.get(p.n)
    out.push('---')
    out.push('')
    out.push(`## ${p.n}. ${p.code} — ${p.verdict}`)
    out.push('')
    out.push(`**VERDICT:** ${p.verdict} · asks for **${p.asks}** · current keys are **${p.oldKind}**`)
    out.push('')
    out.push(`- **Question today:** ${p.oldQuestion}`)
    if (p.newQuestion !== p.oldQuestion) out.push(`- **Question proposed:** ${p.newQuestion}`)
    else out.push('- **Question proposed:** *unchanged*')
    out.push(`- **Keys today:** ${(g?.keys ?? []).map((k) => `\`${k}\``).join(', ') || '(none)'}`)
    out.push(`- **Answering documents:** ${p.answeringDocs.map((d) => `\`${d}\``).join(', ')}`)
    out.push(`- **Keys proposed:** ${p.keys.length}`)
    out.push('')
    out.push(p.why)
    out.push('')
    if (p.notKeyed) { out.push(`⚠ **Not keyed:** ${p.notKeyed}`); out.push('') }

    const keyJson: any[] = []
    for (const k of p.keys) {
      proposed++
      const rows = await prisma.$queryRawUnsafe<any[]>(
        `SELECT id, corpus, "sectionTitle", "wordCount" AS w, "r2Key", attribution, "itemDate"
         FROM corpus_sections WHERE id = $1`, k.id)
      const m = rows[0]
      if (!m) {
        missing++
        out.push(`- \`${k.id}\` — ⚠ **ABSENT from \`corpus_sections\`. NOT A USABLE KEY.**`)
        keyJson.push({ id: k.id, status: 'absent' })
        continue
      }
      const body = m.r2Key ? await r2Get(m.r2Key) : null
      if (body === null) {
        missing++
        out.push(`- \`${k.id}\` — ⚠ **body not readable from R2 (\`${m.r2Key ?? 'no r2Key'}\`). NOT A USABLE KEY.**`)
        keyJson.push({ id: k.id, status: 'no-body' })
        continue
      }
      read++
      const sentence = confirmingSentence(body, k.confirm)
      const fm = looksLikeFrontMatter(body)
      if (sentence) confirmed++
      if (fm.length) frontMatter++
      const day = m.itemDate ? new Date(m.itemDate).toISOString().slice(0, 10) : 'undated'
      out.push(`- \`${k.id}\` — ${m.w ?? '?'} words, ${day}` +
        `${m.attribution ? `, ${m.attribution}` : ''}${fm.length ? ' — ⚠ **reads as front matter**' : ''}`)
      out.push(`  <br>*${String(m.sectionTitle ?? '').slice(0, 160)}*`)
      out.push('')
      if (sentence) {
        const contentsy = looksLikeContentsLine(sentence)
        const fragment = looksLikeHeaderFragment(sentence)
        if (contentsy) contentsQuotes++
        if (fragment) headerFragments++
        out.push(`  > ${sentence}`)
        if (contentsy) {
          out.push('')
          out.push('  ⚠ **The confirming sentence reads as a table of CONTENTS, not as prose.** The term')
          out.push('  is present and the chunk is the right document, but a heading followed by a page')
          out.push('  number is not the document answering the question. Choose a later chunk.')
        }
        if (fragment) {
          out.push('')
          out.push('  ⚠ **The confirming sentence ends in a bare page or paragraph number, or is under')
          out.push('  eight words** — a running header rather than the document answering anything. The')
          out.push('  KEY is still the right document; the quote is weak and a better term would fix it.')
        }
      } else {
        out.push(`  > ⚠ **UNCONFIRMED — the declared term \`${k.confirm}\` is not in the stored body.**`)
        out.push(`  > First 300 characters as read: ${body.replace(/\s+/g, ' ').trim().slice(0, 300)}`)
      }
      out.push('')
      keyJson.push({
        id: k.id, status: sentence ? 'confirmed' : 'unconfirmed', words: m.w,
        title: m.sectionTitle, frontMatter: fm.length > 0,
      })
    }
    json.push({
      n: p.n, code: p.code, verdict: p.verdict, asks: p.asks, oldKind: p.oldKind,
      oldQuestion: p.oldQuestion, newQuestion: p.newQuestion,
      oldKeys: g?.keys ?? [], answeringDocs: p.answeringDocs, keys: keyJson,
    })
  }

  out.push('---')
  out.push('')
  out.push('## What this run counted')
  out.push('')
  out.push(`- Questions re-keyed: **${PROPOSALS.length}**`)
  out.push(`- Keys proposed: **${proposed}**`)
  out.push(`- Bodies read out of R2: **${read}**`)
  out.push(`- Bodies containing their declared confirming term: **${confirmed}**`)
  out.push(`- Keys with no row or no readable body: **${missing}**`)
  out.push(`- Keys whose body reads as front matter: **${frontMatter}**`)
  out.push(`- Keys whose confirming sentence reads as a table of contents: **${contentsQuotes}**`)
  out.push(`- Keys whose confirming sentence is a header fragment (ends in a bare number, or under eight words): **${headerFragments}**`)
  out.push('')
  out.push('*This states what it counted. It does not assert that the re-key is right — that is')
  out.push('Charlie\'s validation, and until it happens the gold set is unchanged and no figure in any')
  out.push('report is scored against these keys.*')
  out.push('')

  fs.writeFileSync(OUT, out.join('\n'), 'utf8')
  const jsonPath = path.join(__dirname, '../../docs/census/s17-committees-rekey.json')
  fs.writeFileSync(jsonPath, JSON.stringify({ generatedAt: stamp, proposals: json }, null, 2), 'utf8')

  console.log(`wrote ${OUT}`)
  console.log(`wrote ${jsonPath}`)
  console.log(`questions ${PROPOSALS.length} · keys proposed ${proposed} · bodies read ${read} · ` +
    `confirmed ${confirmed} · missing ${missing} · front-matter ${frontMatter}`)
  await prisma.$disconnect()
  if (missing > 0 || confirmed !== read) process.exitCode = 1
}
main().catch(async (e) => { console.error('FAILED', e); await prisma.$disconnect(); process.exit(1) })
