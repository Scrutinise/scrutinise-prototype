/**
 * audit-s18-keys.ts — BRIEF_SEARCH_S18 §1, THE PART THAT OVERTURNS THE BRIEF'S PREMISE.
 *
 * ════════════════════════════════════════════════════════════════════════════════════════════════
 * WHAT THIS IS FOR
 * ════════════════════════════════════════════════════════════════════════════════════════════════
 * §1 says: *"Impact assessments are the worst-performing collection we have … the right stream is
 * never searched"*, and instructs that nothing else in the sprint matters until routing is fixed.
 *
 * ⚠⚠ THE COLLECTION-SCOPED CONTROL IN `audit-s18-routing.ts` REFUSES THAT PREMISE, so this file
 * exists to establish what is actually true, by reading documents rather than by reasoning. The
 * control asks the ONE question that separates a routing failure from every other kind: with every
 * other collection removed from the race, does the key come back? For 16 of 18 keys it does not —
 * not at rank 20, not at rank 200 — while the RIGHT ASSESSMENT comes back at ranks 1–3.
 *
 * That is not a routing failure. It is the S16 committees finding arriving in a second collection:
 * **the ruler is broken, not the retriever.**
 *
 * ════════════════════════════════════════════════════════════════════════════════════════════════
 * THE THREE MEASUREMENTS, AND WHY EACH IS SEPARATE
 * ════════════════════════════════════════════════════════════════════════════════════════════════
 *
 * §A KEY KIND — what each answer key actually IS, read out of R2, not inferred from its title.
 *    ⚠ S17 swept all 76 keys for the wrong-kind defect and published *"committees 52.6% off-kind,
 *    every other collection 0.0%"*. That sweep could not have found this one: its `kindOf()`
 *    returns the single string `'impact assessment'` for every row of this collection, so a cover
 *    sheet and a 1,748-word rationale are the same kind to it. The finding is not that S17 was
 *    wrong; it is that **the axis it measured collapses inside this collection**, and a second axis
 *    is needed. This is that axis, and it is computed from the BODY.
 *
 * §B GRANULARITY — the same question scored at SECTION level (today) and at DOCUMENT level.
 *    An impact assessment is held as ~18 sections (18,759 rows over 1,049 documents). A hit on a
 *    different section of the RIGHT assessment scores WRONG today. S17 named this hazard for
 *    legislation and debates and could not compute whether it had fired; here it can be computed,
 *    because for this collection the sections of one assessment ARE about one measure — which is
 *    exactly the property S17 said it could not claim for an Act's sections or a sitting day's
 *    speeches. The distinction is stated rather than assumed away.
 *
 * §C DID THE FIGURES SURVIVE — a costing block cannot render a number the corpus does not hold.
 *    ⚠ THIS IS AN INGEST FINDING AND IS REPORTED, NEVER FIXED HERE. `BRIEF_INGEST_IMPACT_NUMBERS`
 *    §1.1 asks exactly this question and is running in parallel; this measures only the part S18
 *    depends on, so that §2's block is built against what is there rather than what should be.
 *
 * ⚠ EVERY LINE STATES WHAT IT COUNTED. "Cover sheet" is a body matching a declared shape, with the
 * count of matched markers printed; it is never an inference from a section title.
 *
 * Usage (from scrutinise-web):
 *   npx tsx --env-file=.env --tsconfig tsconfig.json scripts/audit-s18-keys.ts
 *   …                                                                        --self-test
 */
import fs from 'node:fs'
import path from 'node:path'
import { prisma } from '../lib/prisma'
import { r2Get } from '../lib/r2'
import { capabilityLine } from '../lib/env-flags'
import { GOLD_CORPUS, type GoldQuestion } from './gold/s10-gold-set'

export {}

const OUT = path.join(__dirname, '../../docs/census/s18-keys.json')
const FTS = (process.env.FTS_SEARCH_URL ?? '').replace(/\/$/, '')
const DEPTH = 200

const QUESTIONS: GoldQuestion[] = GOLD_CORPUS.filter(
  (q) => q.collection === 'impact-assessments' && q.verdict === 'ACCEPT' && q.keys.length > 0,
)

// ════════════════════════════════════════════════════════════════════════════════════════════════
// §A — WHAT KIND OF THING IS THIS KEY?
// ════════════════════════════════════════════════════════════════════════════════════════════════

/**
 * The IA front sheet. Every impact assessment on legislation.gov.uk opens with the standard HMG
 * summary sheet: title, IA number, RPC reference, lead department, contact for enquiries, stage.
 * It is the cover of the document — the exact analogue of the committee report cover page S17
 * found passing C1 while answering nothing.
 *
 * ⚠ MARKERS, PLURAL, AND A THRESHOLD — NOT ONE REGEX. A single marker fires on a rationale section
 * that happens to name the department. Three of these together only occur on the front sheet.
 * ⚠ AND THE SHAPE IS THE TEST, NOT A WORD COUNT. S17 tuned a length threshold to four examples and
 * it flagged three real eleven-word submissions; the same mistake is available here, because the
 * front sheets happen to be short. Length is REPORTED beside the verdict and never decides it.
 */
const COVER_MARKERS: Array<[string, RegExp]> = [
  ['IA No', /\bIA\s*No\b/i],
  ['RPC Reference No', /\bRPC\s*Reference\s*No\b/i],
  ['Lead department or agency', /\bLead\s+department\s+or\s+agency\b/i],
  ['Contact for enquiries', /\bContact\s+for\s+enquir/i],
  ['Source of intervention', /\bSource\s+of\s+intervention\b/i],
  ['Type of measure', /\bType\s+of\s+measure\b/i],
  ['Summary: Intervention and Options', /Summary:\s*Intervention\s+and\s+Options/i],
  ['Stage:', /\bStage:\s*(Final|Development|Consultation|Enactment)/i],
]

/**
 * ⚠⚠ TWO OPPOSITE FACTS WEAR THE SAME SHAPE, AND TELLING THEM APART IS THE WHOLE SPRINT.
 *
 * An appraisal table with its labels and no figures can mean either of two things, and they are
 * the reverse of one another:
 *
 *   STRIPPED-TABLE   the department PUBLISHED a number and OUR EXTRACTION LOST IT.
 *                    `impact-assessments:2020-57:2`, seventeen words: *"Cost of Preferred Option
 *                    (2016 prices, 2017 present value) / Total Net Present Value / Business Net
 *                    Present Value"* — the column headings of the table, and not one digit under
 *                    any of them. A gap in what WE hold.
 *
 *   DECLARED-ABSENT  the department PUBLISHED THE ABSENCE. `impact-assessments:2017-78:3`:
 *                    *"Net cost to business per year (EANDCB in 2014 prices, 2015 present value)
 *                    … **Not estimated** N/A N/A Not in scope Non qualifying provision"*. Nothing
 *                    was lost. The government's own answer to "what will this cost business" is
 *                    THAT NOBODY WORKED IT OUT — which is a finding, with a citation, and it is
 *                    the single most valuable sentence §3 says this platform can produce.
 *
 * ⚠ THE FIRST VERSION OF THIS FILE CALLED BOTH `STRIPPED-TABLE` and both `UNANSWERABLE`, which
 * would have reported the platform's best available answer as a defect in the corpus. That is
 * BRIEF §2 rule 3 — *"'Not monetised' is not zero"* — failing inside the instrument written to
 * measure it, and it is exactly the direction the brief warns is systematically unfair to good
 * legislation. Separated here, counted apart, and never summed.
 */
const COST_LABELS = /(Net\s+Present\s+Value|Cost\s+of\s+Preferred\s+Option|Business\s+Net\s+Present|EANDCB|Equivalent\s+Annual|Total\s+Net\s+Present|One-In,?\s*(Two|Three)-Out|Annual\s+cost|Net\s+cost\s+to\s+business)/i
/**
 * The department saying, in the table, that the figure does not exist.
 *
 * ⚠ ANCHORED TO THE APPRAISAL VOCABULARY, NOT TO A BARE "N/A". A lone `N/A` appears in these
 * documents for a dozen reasons (an absent IA number, an absent RPC reference) and matching it
 * alone would convert every incompletely-filled front sheet into a declaration about cost.
 */
// ⚠ `(been\s+)?` IS THERE BECAUSE THE CHECK CAUGHT ITS ABSENCE. The first version matched only the
// adjacent form "Not estimated" and the commonest phrasing in these documents is the passive —
// *"benefits have not been monetised"*. It read as a STRIPPED-TABLE, i.e. as our defect rather than
// the department's statement, which is the exact direction this whole distinction exists to prevent.
const DECLARED_ABSENT = /(Not\s+(been\s+)?(estimated|quantified|monetised|monetized|applicable|assessed)|have\s+not\s+been\s+(estimated|quantified|monetised|monetized)|No\s+(significant\s+)?(costs?|impacts?)\s+(are\s+)?(anticipated|expected|identified)|Non[\s-]?qualifying\s+provision|Not\s+in\s+scope|unable\s+to\s+(monetise|quantify))/i
/** A monetary figure in the shapes these documents use: £3.5m, £3,500,000, 3.5 million, -£0.4bn. */
const MONEY = /(£\s?-?[\d,]+(\.\d+)?\s*(m|bn|billion|million|k|thousand)?)|(-?[\d,]+(\.\d+)?\s*(million|billion)\s*(pounds|£))/i
/** Any digit sequence long enough to be a value rather than a year fragment or a bullet number. */
const ANY_NUMBER = /\d/

export type KeyKind = 'COVER-SHEET' | 'STRIPPED-TABLE' | 'DECLARED-ABSENT' | 'SUBSTANTIVE' | 'EMPTY'

export interface KeyVerdict {
  kind: KeyKind
  /** Which cover markers matched, by name — so the verdict can be audited without re-running. */
  markers: string[]
  hasMoney: boolean
  hasCostLabels: boolean
  /** ⚠ The department's own statement that the figure was never produced. NOT a missing figure. */
  declaresAbsent: boolean
  words: number
}

/** ⚠ EXPORTED AND SELF-TESTED. Getting this wrong in the lenient direction would let a cover sheet
 *  count as an answer; getting it wrong in the STRICT direction would report the government's own
 *  "we did not estimate this" as a hole in our corpus. Both are watched failing. */
export function classifyKeyBody(body: string | null, words: number): KeyVerdict {
  const text = (body ?? '').trim()
  const base = { markers: [] as string[], hasMoney: false, hasCostLabels: false, declaresAbsent: false, words }
  if (!text) return { kind: 'EMPTY', ...base }
  const markers = COVER_MARKERS.filter(([, re]) => re.test(text)).map(([n]) => n)
  const hasMoney = MONEY.test(text)
  const hasCostLabels = COST_LABELS.test(text)
  const declaresAbsent = DECLARED_ABSENT.test(text)
  const f = { markers, hasMoney, hasCostLabels, declaresAbsent, words }
  // Three co-occurring front-sheet markers do not occur anywhere else in these documents.
  if (markers.length >= 3) return { kind: 'COVER-SHEET', ...f }
  // ⚠ THE DECLARATION IS TESTED BEFORE THE STRIP, because both are true of the same text and only
  // the first order gives the department credit for having said so.
  if (hasCostLabels && declaresAbsent && !hasMoney) return { kind: 'DECLARED-ABSENT', ...f }
  if (hasCostLabels && !ANY_NUMBER.test(text.replace(/\b(19|20)\d{2}\b/g, ''))) {
    return { kind: 'STRIPPED-TABLE', ...f }
  }
  return { kind: 'SUBSTANTIVE', ...f }
}

// ════════════════════════════════════════════════════════════════════════════════════════════════
// §B — GRANULARITY
// ════════════════════════════════════════════════════════════════════════════════════════════════

/** `impact-assessments:2020-57:12` → `impact-assessments:2020-57`. The DOCUMENT, not the section.
 *  ⚠ Taken off the id rather than off `parentDocId`: `parentDocId` is the INSTRUMENT the assessment
 *  is about (`uksi/2020/971`), and two different assessments of the same instrument would collapse
 *  into one document under it. The id's own middle segment is the assessment. */
export function documentOf(id: string): string {
  const p = id.split(':')
  return p.length >= 2 ? `${p[0]}:${p[1]}` : id
}

interface Hit { id: string; corpus: string; tier: string; sectionTitle: string | null; score: number }

async function fts(query: string, limit: number, corpora?: string[]): Promise<Hit[]> {
  if (!FTS) throw new Error('FTS_SEARCH_URL is not set')
  const res = await fetch(`${FTS}/fts-search`, {
    method: 'POST', headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ query, limit, ...(corpora ? { corpora } : {}) }),
  })
  if (!res.ok) throw new Error(`FTS ${res.status}: ${(await res.text()).slice(0, 200)}`)
  return ((await res.json()) as { results?: Hit[] }).results ?? []
}

// ── plumbing ────────────────────────────────────────────────────────────────────────────────────
const pad = (s: string, n: number) => (s.length > n ? s.slice(0, n - 1) + '…' : s.padEnd(n))
const pct = (n: number, d: number) => (d === 0 ? 'n/a' : `${((100 * n) / d).toFixed(1)}%`)

async function main() {
  if (process.argv.includes('--self-test')) return selftest()

  const CONFIG = `${capabilityLine()} | FTS_SEARCH_URL=${FTS ? 'set' : 'UNSET'}`
  console.log('── S18 §1 · THE ANSWER KEYS FOR IMPACT ASSESSMENTS, READ OUT OF R2 ──')
  console.log(`  config   : ${CONFIG}`)
  console.log(`  ⚠ every rank below is BM25 ONLY — this calls fts-serve directly, so no dense leg`)
  console.log(`    contributes. That is deliberate: it isolates the sparse half, which is the half`)
  console.log(`    a routing change would act on. It is NOT the production ranking.`)
  console.log(`  depth    : top ${DEPTH}, scoped to the collection\n`)

  const shape = await prisma.$queryRawUnsafe<Array<{ n: number; docs: number }>>(
    `SELECT count(*)::int AS n, count(DISTINCT split_part(id, ':', 2))::int AS docs
     FROM corpus_sections WHERE corpus = 'impact-assessments'`)
  console.log(`  collection: ${shape[0].n.toLocaleString()} sections over ${shape[0].docs.toLocaleString()} assessments ` +
    `(${(shape[0].n / shape[0].docs).toFixed(1)} sections per assessment)\n`)

  const allKeys = QUESTIONS.flatMap((q) => q.keys)
  const rows = await prisma.$queryRawUnsafe<Array<{
    id: string; sectionTitle: string | null; wordCount: number | null; r2Key: string | null; parentDocId: string | null
  }>>(`SELECT id, "sectionTitle", "wordCount", "r2Key", "parentDocId" FROM corpus_sections WHERE id = ANY($1::text[])`, allKeys)
  const meta = new Map(rows.map((r) => [r.id, r]))

  // ── §A + §B, per question ─────────────────────────────────────────────────────────────────────
  console.log('── §A KEY KIND · §B GRANULARITY ──')
  const out: Array<Record<string, unknown>> = []
  const kindTally: Record<string, number> = {}
  let sectionHit20 = 0, docHit20 = 0, sectionHitDepth = 0, docHitDepth = 0
  const nQ = QUESTIONS.length

  for (const q of QUESTIONS) {
    const hits = await fts(q.question, DEPTH, ['impact-assessments'])
    const keyDocs = new Set(q.keys.map(documentOf))
    const sectionRank = (() => {
      const i = hits.findIndex((h) => q.keys.includes(h.id))
      return i >= 0 ? i + 1 : -1
    })()
    const docRank = (() => {
      const i = hits.findIndex((h) => keyDocs.has(documentOf(h.id)))
      return i >= 0 ? i + 1 : -1
    })()
    if (sectionRank > 0 && sectionRank <= 20) sectionHit20++
    if (docRank > 0 && docRank <= 20) docHit20++
    if (sectionRank > 0) sectionHitDepth++
    if (docRank > 0) docHitDepth++

    console.log(`\n  ${q.code} · ${q.question}`)
    console.log(`       section-level rank ${sectionRank === -1 ? `NOT-IN-${DEPTH}` : sectionRank}` +
      `      DOCUMENT-level rank ${docRank === -1 ? `NOT-IN-${DEPTH}` : docRank}`)
    if (docRank > 0) {
      const h = hits[docRank - 1]
      console.log(`       what came back at document rank: ${h.id}  ${JSON.stringify(h.sectionTitle)}`)
    }

    const keyOut: Array<Record<string, unknown>> = []
    for (const k of q.keys) {
      const m = meta.get(k)
      const body = m?.r2Key ? await r2Get(m.r2Key) : null
      const v = classifyKeyBody(body, m?.wordCount ?? 0)
      kindTally[v.kind] = (kindTally[v.kind] ?? 0) + 1
      console.log(`       KEY ${pad(k, 32)} ${pad(v.kind, 15)} title=${pad(JSON.stringify(m?.sectionTitle ?? null), 30)}` +
        ` words=${String(v.words).padStart(5)} money=${v.hasMoney ? 'Y' : 'n'} costLabels=${v.hasCostLabels ? 'Y' : 'n'}` +
        ` declaresAbsent=${v.declaresAbsent ? 'Y' : 'n'}` +
        (v.markers.length ? ` markers=${v.markers.length}` : ''))
      if (v.kind !== 'SUBSTANTIVE') {
        console.log(`           body: ${JSON.stringify((body ?? '').replace(/\s+/g, ' ').slice(0, 240))}`)
      }
      keyOut.push({ id: k, sectionTitle: m?.sectionTitle ?? null, ...v, r2Present: body !== null,
        bodyHead: (body ?? '').replace(/\s+/g, ' ').slice(0, 400) })
    }
    out.push({ code: q.code, n: q.n, question: q.question, sectionRank, docRank, keys: keyOut })
  }

  console.log('\n── §A RESULT — WHAT THE NINE QUESTIONS ARE KEYED TO ──')
  const totalKeys = allKeys.length
  for (const [k, v] of Object.entries(kindTally).sort((a, b) => b[1] - a[1])) {
    console.log(`  ${pad(k, 16)} ${String(v).padStart(3)} of ${totalKeys}   ${pct(v, totalKeys)}`)
  }
  // ⚠⚠ THE TWO TALLIES ARE NEVER SUMMED, and that is a decision rather than a formatting choice.
  const unanswerable = (kindTally['COVER-SHEET'] ?? 0) + (kindTally['STRIPPED-TABLE'] ?? 0) + (kindTally['EMPTY'] ?? 0)
  const declared = kindTally['DECLARED-ABSENT'] ?? 0
  console.log(`  ⚠ UNANSWERABLE     ${unanswerable} of ${totalKeys}   ${pct(unanswerable, totalKeys)}` +
    `  — a cover sheet, or an appraisal table whose figures did not survive OUR extraction.`)
  console.log(`     A defect on our side; no retriever can answer from one.`)
  console.log(`  ▶ DECLARED-ABSENT  ${declared} of ${totalKeys}   ${pct(declared, totalKeys)}` +
    `  — the DEPARTMENT wrote "not estimated / not in scope".`)
  console.log(`     ⚠ NOT counted above. Nothing was lost; this IS the answer, and the honest one.`)

  console.log('\n── §B RESULT — THE SAME SEARCH, SCORED TWO WAYS ──')
  console.log(`  section level (today)   recall@20 ${sectionHit20}/${nQ} (${pct(sectionHit20, nQ)})   in top ${DEPTH}: ${sectionHitDepth}/${nQ}`)
  console.log(`  DOCUMENT level          recall@20 ${docHit20}/${nQ} (${pct(docHit20, nQ)})   in top ${DEPTH}: ${docHitDepth}/${nQ}`)
  console.log('  ⚠ These are BM25-only and COLLECTION-SCOPED. They are a ceiling on what routing could')
  console.log('    deliver, not a production recall figure, and must not be quoted as one.')

  // ── §C — did the figures survive? ─────────────────────────────────────────────────────────────
  console.log('\n── §C — DID THE FIGURES SURVIVE INGEST? (an INGEST finding; reported, not fixed) ──')
  const sample = await prisma.$queryRawUnsafe<Array<{ id: string; sectionTitle: string | null; r2Key: string | null }>>(
    `SELECT id, "sectionTitle", "r2Key" FROM corpus_sections
     WHERE corpus = 'impact-assessments' AND "sectionTitle" IN ('Preferred option','Costs and benefits','Summary')
       AND "r2Key" IS NOT NULL
     ORDER BY md5(id) LIMIT 150`)
  // ⚠ ORDERED BY md5(id), NOT BY id. These ids BEGIN with the year, so `ORDER BY id` would sample
  // one year and report it as the collection (the tna-caselaw trap, docs/CHANGE_LOG 2026-08-2x).
  const byTitle: Record<string, { n: number; money: number; labels: number; labelsNoMoney: number }> = {}
  for (const s of sample) {
    const t = s.sectionTitle ?? '(null)'
    byTitle[t] ??= { n: 0, money: 0, labels: 0, labelsNoMoney: 0 }
    const body = s.r2Key ? await r2Get(s.r2Key) : null
    const text = body ?? ''
    byTitle[t].n++
    const money = MONEY.test(text)
    const labels = COST_LABELS.test(text)
    if (money) byTitle[t].money++
    if (labels) byTitle[t].labels++
    if (labels && !money) byTitle[t].labelsNoMoney++
  }
  console.log('  sampled by md5(id) — NOT by id, which begins with the year and would sample one year')
  for (const [t, v] of Object.entries(byTitle)) {
    console.log(`  ${pad(JSON.stringify(t), 24)} n=${String(v.n).padStart(3)}  carries a £ figure ${String(v.money).padStart(3)} (${pct(v.money, v.n)})` +
      `  carries appraisal LABELS ${String(v.labels).padStart(3)} (${pct(v.labels, v.n)})` +
      `  ⚠ labels WITHOUT any figure ${String(v.labelsNoMoney).padStart(3)} (${pct(v.labelsNoMoney, v.n)})`)
  }

  const artefact = {
    takenAt: new Date().toISOString(), config: CONFIG, depth: DEPTH,
    collection: shape[0],
    kindTally, unanswerableKeys: unanswerable, totalKeys,
    granularity: { n: nQ, sectionHit20, docHit20, sectionHitDepth, docHitDepth },
    figureSurvival: byTitle,
    rows: out,
  }
  fs.mkdirSync(path.dirname(OUT), { recursive: true })
  fs.writeFileSync(OUT, JSON.stringify(artefact, null, 2))
  console.log(`\n  → ${path.relative(process.cwd(), OUT)}`)
  await prisma.$disconnect()
}

// ── offline self-test ───────────────────────────────────────────────────────────────────────────
// ⚠⚠ ALL FIFTEEN WERE WATCHED FAILING, AND IT TOOK FOUR BREAKS TO GET THERE — which is the point.
// The first break (`classifyKeyBody` returns SUBSTANTIVE unconditionally) failed only 4 of 15: the
// other eleven are assertions in the NEGATIVE direction and a permissive classifier satisfies every
// one of them. The register of checks-that-cannot-fail is full of exactly that shape, so each break
// below was run and its failures counted before this file was trusted:
//
//   1. always SUBSTANTIVE                        →  4 fail   (the positive assertions)
//   2. always COVER-SHEET                        →  6 fail   (the negative ones)
//   3. `documentOf` returns the section; a year  →  3 fail   (granularity + the money regex)
//      reads as money
//   4. the EMPTY guard removed; `documentOf`     →  4 fail   (the last three, plus one)
//      returns the corpus
//
// Union: 15 of 15. A case that no break can fail is not a check, and the four-break sweep is what
// establishes that none of these is one.
function selftest() {
  const COVER = `1 \nTitle: Impact Assessment on the proposal to ban the supply of plastic drinking straws to the end user in England \nIA No: \nRPC Reference No: RPC-4316(3)-DEFRA \nLead department or agency: Department for Environment, Food and Rural Affairs (Defra) \nImpact Assessment (IA) \nDate: 13/05/2020 \nStage: Final \nSource of intervention: Domestic \nType of measure: Secondary legislation \nContact for enquiries: Dan Quinlan \nSummary: Intervention and Options`
  const STRIPPED = `Cost of Preferred Option (2016 prices, 2017 present value) \nTotal Net \nPresent Value \nBusiness Net \nPresent Value`
  // ⚠ Verbatim `impact-assessments:2017-78:3` — the SAME table shape carrying the OPPOSITE fact.
  const DECLARED = `Net cost to business per year (EANDCB in 2014 prices, 2015 present value) \nOne-In, Three-Out \nBusiness Impact Target Status \nNot estimated \nN/A \nN/A \nNot in scope \nNon qualifying provision`
  const REAL = `Information and education could be used to encourage firms and consumers to move away from plastic straws. A taxation or charge policy was rejected as although this would likely be effective in reducing consumption, it would not be as effective as a ban.`
  const REAL_WITH_FIGURES = `Total Net Present Value is estimated at -£3.5m over ten years, with a Business Net Present Value of -£2.1m and an EANDCB of £0.24m.`
  const ONE_MARKER = `The Lead department or agency has published further guidance on the operation of the scheme, and firms are expected to comply within six months.`

  const cases: Array<[string, boolean]> = [
    ['⚠ the IA front sheet is a COVER-SHEET', classifyKeyBody(COVER, 71).kind === 'COVER-SHEET'],
    ['   …and it is called that on MARKERS, not on being short', classifyKeyBody(COVER, 71).markers.length >= 3],
    ['⚠⚠ a cost table whose FIGURES did not survive is STRIPPED-TABLE', classifyKeyBody(STRIPPED, 17).kind === 'STRIPPED-TABLE'],
    ['   …and it is not mistaken for a cover sheet', classifyKeyBody(STRIPPED, 17).markers.length < 3],
    ['⚠⚠ "Not estimated" in the SAME table shape is DECLARED-ABSENT, not stripped — the opposite fact',
      classifyKeyBody(DECLARED, 29).kind === 'DECLARED-ABSENT'],
    ['   …and the two are distinguishable at all (they must not classify alike)',
      classifyKeyBody(DECLARED, 29).kind !== classifyKeyBody(STRIPPED, 17).kind],
    ['⚠ "not monetised" counts as the department declaring it, not as a hole in our corpus',
      classifyKeyBody('Total Net Present Value: benefits have not been monetised for this option.', 12).declaresAbsent],
    ['⚠ a BARE N/A is NOT a declaration about cost — it appears on half the front sheets',
      !DECLARED_ABSENT.test('IA No: N/A RPC Reference No: N/A')],
    ['⚠ a table that declares absence AND carries a figure is SUBSTANTIVE — the figure wins',
      classifyKeyBody('Net cost to business per year (EANDCB) £4.2m. Wider benefits not monetised.', 14).kind === 'SUBSTANTIVE'],
    ['a real rationale section is SUBSTANTIVE', classifyKeyBody(REAL, 1748).kind === 'SUBSTANTIVE'],
    ['⚠ a cost table WITH its figures is SUBSTANTIVE, not stripped', classifyKeyBody(REAL_WITH_FIGURES, 30).kind === 'SUBSTANTIVE'],
    ['   …and its money is seen', classifyKeyBody(REAL_WITH_FIGURES, 30).hasMoney],
    ['⚠ ONE cover marker is not a cover sheet — the threshold is doing work', classifyKeyBody(ONE_MARKER, 25).kind === 'SUBSTANTIVE'],
    ['⚠ a SHORT substantive section is not condemned for its length', classifyKeyBody(REAL.slice(0, 90), 15).kind === 'SUBSTANTIVE'],
    ['an empty body is EMPTY, not substantive', classifyKeyBody('', 0).kind === 'EMPTY'],
    ['a null body is EMPTY', classifyKeyBody(null, 0).kind === 'EMPTY'],
    ['⚠ a year is not a figure — 2016/2017 in the stripped table must not read as money',
      !MONEY.test('Cost of Preferred Option (2016 prices, 2017 present value)')],
    ['the document of a section is the ASSESSMENT, not the instrument',
      documentOf('impact-assessments:2020-57:12') === 'impact-assessments:2020-57'],
    ['⚠ two sections of one assessment share a document',
      documentOf('impact-assessments:2020-57:1') === documentOf('impact-assessments:2020-57:12')],
    ['⚠ two assessments of the SAME instrument do NOT collapse',
      documentOf('impact-assessments:2020-36:1') !== documentOf('impact-assessments:2020-57:1')],
  ]
  let bad = 0
  for (const [n, ok] of cases) { console.log(`  ${ok ? 'PASS' : 'FAIL'}  ${n}`); if (!ok) bad++ }
  console.log(bad ? `\n${bad} FAILED of ${cases.length}` : `\n${cases.length}/${cases.length} pass`)
  if (bad) process.exit(1)
}

// ⚠ RUN ONLY WHEN INVOKED DIRECTLY. `classifyKeyBody` is imported by
// `s18-costing-questions.ts` to validate its own keys — the whole point of sharing the function
// rather than restating it — and without this guard that import fired a live audit as a side
// effect: two hundred R2 reads and a full FTS sweep, interleaved into another script's output.
// A module that DOES something when you import it is the same family as a check that cannot fail.
if (require.main === module) main().catch((e) => { console.error(e); process.exit(1) })
