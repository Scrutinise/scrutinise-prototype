// ─────────────────────────────────────────────────────────────────────────────
// deepening-retrieval.ts — BRIEF_SEARCH_S7 §2. The two retrieval jobs the Deepening needs.
//
// Two are buildable now and two are not. The two that are not are named at the bottom with
// reasons, because "not yet" with a reason is a decision and "not yet" without one is a backlog
// item that quietly stops happening — which is the reason S7 exists at all.
// ─────────────────────────────────────────────────────────────────────────────

import { prisma } from '@/lib/prisma'
import { runSearch } from './search-gateway'
import type { SearchResult } from './page1-config'

// ════════════════════════════════════════════════════════════════════════════════════════════
// PRECEDENT — has this been tried, and what happened?
// ════════════════════════════════════════════════════════════════════════════════════════════

/**
 * Three documents read TOGETHER, around one instrument:
 *
 *   INTENDED   the explanatory note — what the provision was FOR
 *   PREDICTED  the impact assessment — what was expected of it
 *   OBSERVED   the post-implementation review — what actually happened
 *
 * ⚠⚠ RETURNED AS A GROUP, NOT A RANKED LIST, and this is the whole design. §2: "The value is the
 * comparison — intended, predicted, observed — and a flat ranking destroys it." A ranked list of
 * twenty documents about an instrument answers a different question; three documents about ONE
 * instrument, in that order, is the question the Deepening is asking.
 *
 * ⚠ THERE IS NO SEPARATE COLLECTION OF POST-IMPLEMENTATION REVIEWS, and looking for one is how
 * this gets written up as impossible. The "what happened" leg lives INSIDE `impact-assessments`,
 * distinguished by section title. Measured: **1,014 sections** whose title names a
 * post-implementation review — the brief says 1,235, and the smaller number is what the corpus
 * actually holds today.
 */
export interface PrecedentLeg {
  leg: 'intended' | 'predicted' | 'observed'
  /** What this leg IS, in words the prompt can use. */
  whatItIs: string
  id: string
  title: string
  snippet: string
  url: string | null
  date: string | null
}

export interface Precedent {
  /** The instrument these documents are about, e.g. `uksi/2013/687`. */
  gid: string
  instrumentTitle: string | null
  legs: PrecedentLeg[]
  /** ⚠ Which legs are MISSING. Stated, because two of three is a different finding from three. */
  missing: Array<'intended' | 'predicted' | 'observed'>
  /** The honest line for the prompt when a leg is absent. Null when all three are present. */
  note: string | null
}

const LEG_MEANING: Record<PrecedentLeg['leg'], string> = {
  intended: 'what the provision was FOR — the department\'s own statement of purpose, laid alongside it',
  predicted: 'what the government EXPECTED it to do, before it did it — costs, benefits, options weighed',
  observed: 'what actually HAPPENED — the post-implementation review, written after the fact',
}

/**
 * ⚠ THE SECTION-TITLE RULE THAT SEPARATES "PREDICTED" FROM "OBSERVED".
 *
 * Both live in `impact-assessments`. A row whose section title names a post-implementation review
 * is the OBSERVED leg; everything else in that collection is PREDICTED. Exported so it can be
 * tested without a database, because getting this backwards would present a prediction as an
 * outcome — the single most misleading thing this intent could do.
 */
export function legForImpactSection(sectionTitle: string | null): 'predicted' | 'observed' {
  return /post[-\s]?implementation|pir\b|review of the (regulation|order|instrument)/i
    .test(sectionTitle ?? '') ? 'observed' : 'predicted'
}

/**
 * Assemble the three legs for one instrument.
 *
 * ⚠ NEVER INVENTS A LEG. A missing post-implementation review is extremely common — most
 * instruments have never had one — and the honest output says so. Filling the gap with the impact
 * assessment's own predictions, which is the tempting move, would turn "nobody has checked whether
 * this worked" into "here is what it achieved".
 */
export async function retrievePrecedent(gid: string): Promise<Precedent> {
  const rows = await prisma.$queryRaw<Array<{
    id: string; corpus: string; sectionTitle: string | null; sourceUrl: string | null
    itemDate: string | null; parentTitle: string | null
  }>>`
    SELECT s.id, s.corpus, s."sectionTitle", s."sourceUrl", s."itemDate"::text AS "itemDate",
           a.title AS "parentTitle"
    FROM corpus_sections s
    LEFT JOIN corpus_acts a ON a.gid = s."parentDocId"
    WHERE s.corpus IN ('explanatory-notes', 'explanatory-memoranda', 'impact-assessments')
      AND s.id LIKE ${'%:' + gid + ':%'}
      AND s.status = 'compiled'
    ORDER BY s.corpus, s.id
    LIMIT 60`

  const legs: PrecedentLeg[] = []
  const seen = new Set<string>()
  for (const r of rows) {
    const leg: PrecedentLeg['leg'] = r.corpus === 'impact-assessments'
      ? legForImpactSection(r.sectionTitle)
      : 'intended'
    // One document per leg — the comparison is between legs, not within them.
    if (seen.has(leg)) continue
    seen.add(leg)
    legs.push({
      leg,
      whatItIs: LEG_MEANING[leg],
      id: r.id,
      title: r.sectionTitle || r.parentTitle || r.id,
      snippet: '',
      url: r.sourceUrl,
      date: r.itemDate,
    })
  }

  const order: Array<PrecedentLeg['leg']> = ['intended', 'predicted', 'observed']
  legs.sort((a, b) => order.indexOf(a.leg) - order.indexOf(b.leg))
  const missing = order.filter((l) => !seen.has(l))

  return {
    gid,
    instrumentTitle: rows[0]?.parentTitle ?? null,
    legs,
    missing,
    note: missing.length ? precedentNote(missing) : null,
  }
}

/** ⚠ Exported and tested: the sentence that stops an absence being read as a finding. */
export function precedentNote(missing: Array<'intended' | 'predicted' | 'observed'>): string {
  const words: Record<string, string> = {
    intended: 'no explanatory note is held for this instrument',
    predicted: 'no impact assessment is held for this instrument',
    observed: 'NO POST-IMPLEMENTATION REVIEW EXISTS for this instrument — nobody has published an '
      + 'assessment of whether it worked',
  }
  return `⚠ ${missing.map((m) => words[m]).join('; ')}. Say so plainly. Do NOT substitute what was `
    + `PREDICTED for what was OBSERVED — a prediction is not an outcome.`
}

// ════════════════════════════════════════════════════════════════════════════════════════════
// DEVOLUTION_SCOPE — is this reserved to Westminster, or devolved?
// ════════════════════════════════════════════════════════════════════════════════════════════

/**
 * ⚠ WHICH PARLIAMENT A DOCUMENT CAME FROM MUST BE UNMISTAKABLE, and §2 says so in terms — the same
 * requirement that applied when Scottish debates joined the search. So jurisdiction is derived
 * from the document's own identifier and carried as a first-class field, never inferred from the
 * title and never left for the reader to work out.
 *
 * Measured coverage, 17 Aug 2026:
 *   Scotland   ssi 87,398 · asp 25,985 · scottish-parliament-or 1,044,188 · scottish-courts 13,070
 *   Wales      wsi 70,062 · anaw 4,717 · asc 4,585 · mwa 1,446
 *   N. Ireland nisr 129,681 · nisi 23,920 · nia 9,367 · ni-judgments 7,927
 */
export type Jurisdiction = 'UK-wide' | 'Scotland' | 'Wales' | 'Northern Ireland' | 'England & Wales' | 'unknown'

const DOCTYPE_JURISDICTION: Record<string, Jurisdiction> = {
  asp: 'Scotland', ssi: 'Scotland',
  anaw: 'Wales', asc: 'Wales', mwa: 'Wales', wsi: 'Wales',
  nia: 'Northern Ireland', nisi: 'Northern Ireland', nisr: 'Northern Ireland', apni: 'Northern Ireland',
  ukpga: 'UK-wide', uksi: 'UK-wide', ukla: 'UK-wide', ukcm: 'UK-wide',
}

/**
 * ⚠ DERIVED FROM THE IDENTIFIER, NOT FROM THE TITLE. A title containing the word "Scotland" may be
 * a UK Act about Scotland (the Scotland Act 1998 is `ukpga`), which is the opposite of a devolved
 * instrument. Exported and tested, because getting this wrong tells a user the wrong Parliament
 * can legislate for them.
 */
export function jurisdictionOf(id: string): Jurisdiction {
  const parts = id.split(':')
  const gid = parts.length >= 2 ? parts[1] : ''
  const doctype = gid.split('/')[0]?.toLowerCase() ?? ''
  if (DOCTYPE_JURISDICTION[doctype]) return DOCTYPE_JURISDICTION[doctype]
  if (/scottish-parliament|scottish-courts/.test(parts[0] ?? '')) return 'Scotland'
  if (/^ni-/.test(parts[0] ?? '')) return 'Northern Ireland'
  return 'unknown'
}

export interface DevolutionResult {
  id: string
  jurisdiction: Jurisdiction
  title: string
  snippet: string
  url: string | null
  type: string
}

export interface DevolutionScope {
  query: string
  results: DevolutionResult[]
  /** Counts per jurisdiction — the shape of the answer before anyone reads a single document. */
  byJurisdiction: Record<string, number>
  /** ⚠ The line the prompt needs so a pattern is not read as a legal conclusion. */
  note: string
}

/**
 * Retrieve material across jurisdictions for a subject.
 *
 * ⚠⚠ THIS DOES NOT ANSWER "IS IT RESERVED". It shows WHO HAS LEGISLATED, which is evidence and not
 * a conclusion. The reservation question is settled by Schedule 5 to the Scotland Act, Schedule 7A
 * to the Government of Wales Act and Schedule 2/3 to the Northern Ireland Act — and we hold those
 * as text, not as a structured answer. A retrieval layer that implied otherwise would be answering
 * a constitutional question with a frequency count, which is exactly the kind of confident wrong
 * claim this platform exists not to make.
 */
export async function retrieveDevolutionScope(query: string, limit = 24): Promise<DevolutionScope> {
  const out = await runSearch({
    keywords: query.trim().split(/\s+/).filter(Boolean),
    intent: 'DEVOLUTION_SCOPE',
    limit,
  })
  const results: DevolutionResult[] = out.results.map((r: SearchResult) => ({
    id: r.id,
    jurisdiction: jurisdictionOf(r.id),
    title: r.title || r.citation || r.id,
    snippet: r.snippet,
    url: r.url || null,
    type: String(r.type),
  }))
  const byJurisdiction: Record<string, number> = {}
  for (const r of results) byJurisdiction[r.jurisdiction] = (byJurisdiction[r.jurisdiction] ?? 0) + 1
  return { query, results, byJurisdiction, note: DEVOLUTION_NOTE }
}

export const DEVOLUTION_NOTE =
  '⚠ Each item below is labelled with the parliament or assembly that made it. This shows WHO HAS '
  + 'LEGISLATED on the subject, which is evidence — it is NOT a ruling on whether the subject is '
  + 'reserved or devolved. That question is settled by Schedule 5 to the Scotland Act 1998, '
  + 'Schedule 7A to the Government of Wales Act 2006 and Schedules 2 and 3 to the Northern Ireland '
  + 'Act 1998. Never tell a user a matter is devolved or reserved on the strength of what this '
  + 'search returned; say what the pattern shows and name the schedule that decides it.'

/** Render the group for the prompt, jurisdiction first so it cannot be missed. */
export function devolutionBlock(s: DevolutionScope): string {
  const lines = s.results.map((r) => `- [${r.jurisdiction}] ${r.title}\n    "${r.snippet.slice(0, 200)}"`)
  const shape = Object.entries(s.byJurisdiction)
    .sort((a, b) => b[1] - a[1]).map(([j, n]) => `${j} ${n}`).join(' · ')
  return `WHO HAS LEGISLATED: ${shape}\n\n${lines.join('\n')}\n\n${s.note}`
}

export function precedentBlock(p: Precedent): string {
  const lines = p.legs.map((l) => `- [${l.leg.toUpperCase()}] ${l.title}\n    ${l.whatItIs}`)
  return `PRECEDENT FOR ${p.instrumentTitle ?? p.gid} — intended, predicted, observed:\n`
    + `${lines.join('\n') || '(nothing held)'}${p.note ? `\n\n${p.note}` : ''}`
}

// ════════════════════════════════════════════════════════════════════════════════════════════
// ⚠ NOT NOW, WITH REASONS (§2). Named so they are decisions rather than omissions.
// ════════════════════════════════════════════════════════════════════════════════════════════
export const NOT_BUILT = {
  MECHANISM_ANALOGUE:
    'A mechanism solving a similar problem in an UNRELATED field. It wants results that are '
    + 'topically DISTANT, which is the opposite of what BM25 and dense retrieval both reward — '
    + 'neither can be tuned into it. Needs provisions tagged by mechanism first, which is unbuilt.',
  CONTRADICTION:
    'Documents that BEAR ON a claim, including those refuting it. That is a reranker problem, and '
    + 'the reranker is not authorised — S2C-5 measured its preference accuracy at 66.7% but only 4 '
    + 'of 15 pairs compared two documents the system actually returned, so the binding constraint '
    + 'was recall rather than ordering.',
} as const

// ── offline self-test ───────────────────────────────────────────────────────────────────────
// npx tsx lib/lex/deepening-retrieval.ts --self-test
function selftest() {
  const cases: Array<[string, boolean]> = [
    // the leg split — getting this backwards presents a prediction as an outcome
    ['⚠ a post-implementation review section is OBSERVED', legForImpactSection('Post-implementation review') === 'observed'],
    ['⚠ a hyphen-free variant is caught', legForImpactSection('Post implementation review of the Order') === 'observed'],
    ['a costs-and-benefits section is PREDICTED', legForImpactSection('Costs and benefits') === 'predicted'],
    ['an options section is PREDICTED', legForImpactSection('Options considered') === 'predicted'],
    ['⚠ a null title defaults to PREDICTED, not OBSERVED — the safer error', legForImpactSection(null) === 'predicted'],

    // jurisdiction from the identifier
    ['a Scottish SI is Scotland', jurisdictionOf('secondary:ssi/2019/1:regulation-3') === 'Scotland'],
    ['an Act of the Scottish Parliament is Scotland', jurisdictionOf('primary:asp/2010/8:section-1') === 'Scotland'],
    ['a Welsh Measure is Wales', jurisdictionOf('primary:mwa/2011/1:section-1') === 'Wales'],
    ['an anaw is Wales', jurisdictionOf('primary:anaw/2014/4:section-2') === 'Wales'],
    ['a Welsh SI is Wales', jurisdictionOf('secondary:wsi/2020/1:regulation-1') === 'Wales'],
    ['an NI Order is Northern Ireland', jurisdictionOf('secondary:nisi/1998/1504:article-3') === 'Northern Ireland'],
    ['⚠⚠ the SCOTLAND ACT itself is UK-wide, not Scotland — derived from the id, never the title',
      jurisdictionOf('primary-acts-pre-2000:ukpga/1998/46:section-28') === 'UK-wide'],
    ['a Scottish Parliament debate is Scotland', jurisdictionOf('scottish-parliament-or:2020-01-01:1') === 'Scotland'],
    ['an unknown identifier is unknown, not guessed', jurisdictionOf('mystery:zz/1/2:x') === 'unknown'],

    // the notes never let an absence read as a finding
    ['⚠ a missing PIR says nobody has assessed whether it worked',
      /NO POST-IMPLEMENTATION REVIEW EXISTS/.test(precedentNote(['observed']))],
    ['⚠ and forbids substituting the prediction for the outcome',
      /Do NOT substitute what was PREDICTED for what was OBSERVED/.test(precedentNote(['observed']))],
    ['⚠⚠ the devolution note refuses to call the reservation question',
      /NOT a ruling on whether the subject is reserved or devolved/.test(DEVOLUTION_NOTE)],
    ['   …and names the schedules that actually decide it',
      /Schedule 5 to the Scotland Act 1998/.test(DEVOLUTION_NOTE) && /Schedule 7A/.test(DEVOLUTION_NOTE)],
    ['the two unbuilt intents carry reasons, not just names',
      NOT_BUILT.MECHANISM_ANALOGUE.length > 100 && NOT_BUILT.CONTRADICTION.length > 100],
  ]
  let bad = 0
  for (const [n, ok] of cases) { console.log(`  ${ok ? 'PASS' : 'FAIL'}  ${n}`); if (!ok) bad++ }
  console.log(bad ? `\n${bad} FAILED` : `\n${cases.length}/${cases.length} pass`)
  if (bad) process.exit(1)
}
if (require.main === module && process.argv.includes('--self-test')) selftest()
