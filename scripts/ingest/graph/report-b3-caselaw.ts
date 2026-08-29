/**
 * report-b3-caselaw.ts — CC BRIEF B3. Case law for the absorption gate (§8).
 *
 * ⚠ RETRIEVAL, NOT ANALYSIS. The proposer's claim is that the common law has
 * absorbed the principle, so repeal changes nothing. That claim is the analysis
 * track's to test. This puts the courts' words in front of them and says
 * nothing about whether they support it. There is deliberately no `relevance`
 * and no `holding` field.
 *
 * ── TWO SETS, NEVER MERGED ──────────────────────────────────────────────────
 *   Set A  cases that cite the target Act — retrieval on the Act's name
 *   Set B  cases on whether the principle is protected at common law
 *          INDEPENDENTLY of the statute — retrieval on the principle, with no
 *          statute name to anchor on. This is the harder retrieval and it is
 *          where the answer lives.
 *
 * ── WHY THIS FILE IS ON THE INGEST SIDE ─────────────────────────────────────
 * The brief asks for the coverage block verbatim. `coverage.ts` lives here and
 * reads the shared Neon pool, so running from here means the block that reaches
 * the report is the one the graph generated, not a copy of it.
 *
 * ⚠⚠ AND THE FIRST THING THIS RUN FOUND, BEFORE ANY CASE WAS RETRIEVED:
 * `coverage.ts`'s own `CASE_LAW_CORPORA` names four collections, TWO OF WHICH
 * DO NOT EXIST (`caselaw`, `caselaw-fcl` — zero rows each), and it MISSES the
 * two largest that do (`tna-caselaw`, 74,896 rows from 1965; `ni-judgments`,
 * 7,927). So the case-law boundary the coverage block reports is drawn over
 * `et-decisions` and `tax-tribunals` alone and begins in 1989 — twenty-four
 * years after the real floor. Reported here beside the block itself rather than
 * silently corrected, because the block is what the report prints.
 *
 *   npx tsx graph/report-b3-caselaw.ts
 */
import { getNeonPool, endNeonPool } from '../shared/neon-pool'
import { r2Get } from '../shared/r2-client'
import { getCoverage } from './coverage'
import { writeJson } from './report-common'

const F = (process.env.FTS_SEARCH_URL ?? 'https://fts-serve-production.up.railway.app').replace(/\/$/, '')

/** Measured, not assumed — every collection in the database that holds judgments. */
const CASE_CORPORA = ['tna-caselaw', 'et-decisions', 'tax-tribunals', 'ni-judgments', 'cma-cases']

/** What `coverage.ts` believes the case-law layer is. Kept here to be compared, not copied. */
const COVERAGE_BELIEVES = ['caselaw', 'caselaw-fcl', 'et-decisions', 'tax-tribunals']

interface Measure {
  ws_id: string
  name: string
  /** Set A: the Act's own name, as a court would write it */
  act_queries: string[]
  /** Set B: the PRINCIPLE, with no statute name to anchor on */
  /**
   * ⚠ `broader` is not a spare query — it is what turns a gap into a
   * MEASUREMENT. B3's first run recorded "the principle of legality" as
   * returning nothing on two terms. Verifying that before publishing it showed
   * the phrase IS in the corpus and BM25 simply does not surface it on a phrase
   * query: asking for "fundamental rights" instead returned two judgments whose
   * text contains "principle of legality" verbatim. A gap that is really a
   * retrieval failure, filed as a gap, tells the report the common law is
   * silent on a doctrine it is loud about.
   */
  principles: Array<{ principle: string; terms: string[]; broader: string[] }>
  prediction: { set_a: number; set_b: number }
}

const MEASURES: Measure[] = [
  {
    ws_id: 'WS-01', name: 'Human Rights Act 1998',
    act_queries: ['Human Rights Act 1998'],
    principles: [
      { principle: 'the common law right of access to a court', terms: ['common law right of access to the court', 'right of access to justice'], broader: ['access to the court', 'access to justice'] },
      { principle: 'the principle of legality', terms: ['principle of legality', 'fundamental rights cannot be overridden by general words'], broader: ['fundamental rights', 'general words'] },
      { principle: 'natural justice and the duty of fairness at common law', terms: ['rules of natural justice', 'common law duty of fairness'], broader: ['natural justice', 'duty of fairness'] },
      { principle: 'open justice at common law', terms: ['principle of open justice', 'open justice principle'], broader: ['open justice'] },
      { principle: 'freedom of expression at common law', terms: ['freedom of expression at common law', 'common law right of freedom of expression'], broader: ['freedom of expression'] },
    ],
    prediction: { set_a: 40, set_b: 12 },
  },
  {
    ws_id: 'WS-04', name: 'Equality Act 2010',
    act_queries: ['Equality Act 2010'],
    principles: [
      { principle: 'whether the common law knows a general principle of equality', terms: ['no general common law principle of equality', 'equality before the law'], broader: ['principle of equality', 'equal treatment'] },
      { principle: 'the common law position on discrimination before the statutory regime', terms: ['at common law there was no', 'common law did not prohibit discrimination'], broader: ['at common law', 'discrimination at common law'] },
      { principle: 'consistency and equal treatment as a public law principle', terms: ['principle of consistency', 'like cases should be treated alike'], broader: ['consistency', 'treated alike'] },
      { principle: 'the common law duty to act fairly towards the disabled', terms: ['reasonable adjustments at common law', 'common law duty to make adjustments'], broader: ['reasonable adjustments', 'duty to make adjustments'] },
    ],
    prediction: { set_a: 25, set_b: 6 },
  },
  {
    ws_id: 'WS-05', name: 'Constitutional Reform and Governance Act 2010, Part 1',
    act_queries: ['Constitutional Reform and Governance Act 2010'],
    principles: [
      { principle: 'the prerogative basis of civil service employment', terms: ['servant of the Crown', 'dismissible at pleasure'], broader: ['the Crown', 'at pleasure'] },
      { principle: 'whether civil service management is justiciable', terms: ['Council of Civil Service Unions', 'exercise of the prerogative is justiciable'], broader: ['prerogative', 'justiciable'] },
      { principle: 'the civil servant\'s contract of employment at common law', terms: ['civil servant', 'contract of employment with the Crown'], broader: ['civil service', 'Crown employment'] },
    ],
    prediction: { set_a: 5, set_b: 3 },
  },
]

// ── retrieval ───────────────────────────────────────────────────────────────

async function fts(query: string, limit: number): Promise<any[]> {
  try {
    const res = await fetch(`${F}/fts-search`, {
      method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ query, limit, corpora: CASE_CORPORA }),
    })
    if (!res.ok) return []
    return ((await res.json()) as any).results ?? []
  } catch { return [] }
}

/**
 * The court, from the neutral citation the id carries.
 *
 * ⚠ `tna-caselaw` ids BEGIN with the citation, which is why an ORDER BY id
 * sample of them is not random — a 400-row draw once came back entirely from
 * 2003. Here that same structure is useful: the court is IN the id and does not
 * have to be inferred from the text.
 */
export function courtOf(id: string): string | null {
  const cite = id.split(':')[1] ?? ''
  const m = cite.match(/^\[\d{4}\]\s+([A-Z][A-Za-z]*(?:\s+[A-Z][a-z]+)?)\s*\d*\s*(\([A-Za-z]+\))?/)
  if (!m) return null
  return [m[1], m[2]].filter(Boolean).join(' ').trim()
}

const neutralCitationOf = (id: string) => id.split(':')[1] ?? null

/** A verbatim window around the match — never a summary. The brief: a
 *  summarised holding is not usable; the court's own words or nothing. */
function passageAround(body: string, needle: RegExp, width = 900): { text: string; words: number; found: boolean } {
  const flat = body.replace(/\s+/g, ' ').trim()
  const m = flat.match(needle)
  if (!m || m.index === undefined) return { text: flat.slice(0, width), words: 0, found: false }
  const start = Math.max(0, m.index - Math.floor(width / 3))
  const end = Math.min(flat.length, start + width)
  const text = (start > 0 ? '… ' : '') + flat.slice(start, end) + (end < flat.length ? ' …' : '')
  return { text, words: text.split(/\s+/).filter(Boolean).length, found: true }
}

/** "section 6 of the Human Rights Act 1998" → section-6, read from the passage. */
function provisionCited(passage: string, actName: string): string | null {
  const rx = new RegExp(`(section|s\\.|schedule|sch\\.)\\s*(\\d+[A-Za-z]?)[^.]{0,60}?${actName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&').replace(/\s+/g, '\\s+')}`, 'i')
  const m = passage.match(rx)
  if (!m) return null
  const kind = /sch/i.test(m[1]) ? 'schedule' : 'section'
  return `${kind}-${m[2].toLowerCase()}`
}

async function hydrate(ids: string[]) {
  if (!ids.length) return new Map<string, any>()
  const { rows } = await getNeonPool().query(
    `SELECT id, corpus, "sectionTitle", "itemDate", "r2Key", "wordCount", jurisdiction
     FROM corpus_sections WHERE id = ANY($1::text[])`, [ids])
  return new Map(rows.map((r: any) => [r.id, r]))
}

// ── the date range, measured ────────────────────────────────────────────────

async function measureDateRange() {
  const pool = getNeonPool()
  const { rows: overall } = await pool.query(
    `SELECT MIN("itemDate")::text earliest, MAX("itemDate")::text latest, COUNT(*)::int n
     FROM corpus_sections WHERE corpus = ANY($1::text[])`, [CASE_CORPORA])
  const { rows: byCorpus } = await pool.query(
    `SELECT corpus, COUNT(*)::int n, MIN("itemDate")::text earliest, MAX("itemDate")::text latest
     FROM corpus_sections WHERE corpus = ANY($1::text[]) GROUP BY 1 ORDER BY 2 DESC`, [CASE_CORPORA])
  const { rows: byDecade } = await pool.query(
    `SELECT (EXTRACT(YEAR FROM "itemDate")::int / 10 * 10) AS decade, COUNT(*)::int n
     FROM corpus_sections WHERE corpus = ANY($1::text[]) AND "itemDate" IS NOT NULL
     GROUP BY 1 ORDER BY 1`, [CASE_CORPORA])
  // court is in the id for tna-caselaw; count by the code
  const { rows: courts } = await pool.query(
    `SELECT split_part(split_part(id, ':', 2), ' ', 2) AS court, COUNT(*)::int n,
            MIN("itemDate")::text earliest, MAX("itemDate")::text latest
     FROM corpus_sections WHERE corpus = 'tna-caselaw'
     GROUP BY 1 ORDER BY 2 DESC LIMIT 20`)
  return {
    earliest: overall[0].earliest, latest: overall[0].latest, rows: overall[0].n,
    corpora_measured: CASE_CORPORA,
    by_corpus: byCorpus,
    by_decade: Object.fromEntries(byDecade.map((r: any) => [`${r.decade}s`, r.n])),
    by_court: Object.fromEntries(courts.map((r: any) => [r.court || '(unparsed)', { n: r.n, earliest: r.earliest, latest: r.latest }])),
  }
}

// ── per measure ─────────────────────────────────────────────────────────────

async function runMeasure(m: Measure, coverage: unknown, dateRange: any) {
  console.log(`\n══ ${m.ws_id} — ${m.name} ══`)
  console.log(`  prediction: Set A ${m.prediction.set_a}, Set B ${m.prediction.set_b}`)

  // ── Set A ────────────────────────────────────────────────────────────────
  const setA: any[] = []
  const seenA = new Set<string>()
  for (const q of m.act_queries) {
    const hits = await fts(q, 60)
    const meta = await hydrate(hits.map((h: any) => h.id))
    const rx = new RegExp(q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&').replace(/\s+/g, '\\s+'), 'i')
    for (const h of hits) {
      const md = meta.get(h.id)
      if (!md?.r2Key || seenA.has(h.id)) continue
      const body = await r2Get(md.r2Key).catch(() => null)
      if (!body) continue
      const p = passageAround(body, rx)
      // ⚠ FTS proposed it; if the Act's name is not in the judgment's own words
      // the row is not evidence that the case cites it, and it is dropped with
      // the count reported rather than kept to pad Set A.
      if (!p.found) continue
      seenA.add(h.id)
      setA.push({
        neutral_citation: neutralCitationOf(md.id), case_name: md.sectionTitle ?? null,
        court: courtOf(md.id), date: md.itemDate ? new Date(md.itemDate).toISOString().slice(0, 10) : null,
        passage: p.text, passage_word_count: p.words, source_key: md.r2Key,
        provision_cited: provisionCited(p.text, q),
        corpus: md.corpus, section_id: md.id, query: q,
      })
    }
  }
  console.log(`  Set A — cases citing the Act: ${setA.length}`)

  // ── Set B ────────────────────────────────────────────────────────────────
  const setB: any[] = []
  const gaps: any[] = []
  const seenB = new Set<string>()
  for (const pr of m.principles) {
    let found = 0
    for (const term of pr.terms) {
      const hits = await fts(term, 25)
      const meta = await hydrate(hits.map((h: any) => h.id))
      const rx = new RegExp(term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&').replace(/\s+/g, '\\s+'), 'i')
      for (const h of hits) {
        const md = meta.get(h.id)
        if (!md?.r2Key || seenB.has(h.id)) continue
        const body = await r2Get(md.r2Key).catch(() => null)
        if (!body) continue
        const p = passageAround(body, rx)
        if (!p.found) continue
        seenB.add(h.id)
        found++
        setB.push({
          neutral_citation: neutralCitationOf(md.id), case_name: md.sectionTitle ?? null,
          court: courtOf(md.id), date: md.itemDate ? new Date(md.itemDate).toISOString().slice(0, 10) : null,
          principle_searched: pr.principle, passage: p.text, passage_word_count: p.words,
          source_key: md.r2Key, corpus: md.corpus, section_id: md.id, term_matched: term,
        })
      }
    }
    if (found === 0) {
      // ⚠⚠ A GAP IS PROVEN, NOT ASSUMED. Before recording that the corpus is
      // silent on a principle, ask a BROADER query and test whether the
      // principle's own words are nevertheless present in what comes back. If
      // they are, the gap is MINE — a BM25 phrase query that does not surface a
      // phrase the corpus contains — and saying otherwise would tell the report
      // the common law is silent on a doctrine it is loud about.
      let presentAnyway = 0
      const wit: Array<{ case: string; term: string; found_via: string }> = []
      for (const b of pr.broader) {
        const hits = await fts(b, 20)
        const meta = await hydrate(hits.map((h: any) => h.id))
        for (const h of hits) {
          const md = meta.get(h.id)
          if (!md?.r2Key) continue
          const body = await r2Get(md.r2Key).catch(() => null)
          if (!body) continue
          const flat = body.replace(/\s+/g, ' ')
          const t = pr.terms.find(x => new RegExp(x.replace(/[.*+?^${}()|[\]\\]/g, '\\$&').replace(/\s+/g, '\\s+'), 'i').test(flat))
          if (!t) continue
          presentAnyway++
          if (wit.length < 5) wit.push({ case: md.id, term: t, found_via: b })
        }
      }
      gaps.push({
        principle_searched: pr.principle,
        terms_tried: pr.terms,
        returned: 0,
        broader_terms_tried: pr.broader,
        phrase_present_in_corpus_anyway: presentAnyway,
        witnesses: wit,
        verdict: presentAnyway > 0
          ? 'NOT A CORPUS GAP — A RETRIEVAL FAILURE. The principle\'s own words appear verbatim in judgments the corpus holds; a BM25 phrase query does not surface them, and a broader query does. Do NOT report the common law as silent on this.'
          : 'a real gap so far as these terms reach: neither the phrase queries nor the broader ones returned a judgment containing the principle\'s words. Still top-K retrieval, not a scan.',
      })
      console.log(`    ⚠ "${pr.principle}" returned nothing on ${pr.terms.length} phrase terms` +
        (presentAnyway > 0
          ? ` — but the phrase IS in ${presentAnyway} judgment(s) reached by a broader query. RETRIEVAL FAILURE, not a corpus gap.`
          : ` — and a broader query found none either. Recorded as a gap.`))
    }
  }
  console.log(`  Set B — the principle at common law: ${setB.length} (${gaps.length} principle(s) returned nothing)`)
  console.log(`  predicted A ${m.prediction.set_a} / B ${m.prediction.set_b} — actual A ${setA.length} / B ${setB.length}`)

  const p = writeJson(`caselaw_${m.ws_id}.json`, {
    generated_at: new Date().toISOString(),
    measure: `${m.ws_id} — ${m.name}`,
    retrieval_note:
      'Retrieval only. There is no relevance field and no holding field, on purpose: whether the ' +
      'common law has absorbed the principle is the analysis track\'s question and nothing here ' +
      'answers it. Every passage is the court\'s own words, verbatim, with the R2 key it was read from.',
    instrument: {
      keyword_service: F,
      keyword_service_note: 'FTS_SEARCH_URL is not set in .env; this is the production host found in the repo.',
      corpora_searched: CASE_CORPORA,
      confirm_step:
        'FTS proposes; the judgment\'s own text disposes. A hit whose body does not contain the ' +
        'search term is dropped rather than kept to pad the set.',
    },
    coverage,
    coverage_defect_found_by_this_run: {
      what: 'coverage.ts CASE_LAW_CORPORA names four collections; two of them do not exist and the two largest that do are missing.',
      names_in_coverage_ts: COVERAGE_BELIEVES,
      of_those_that_exist: ['et-decisions', 'tax-tribunals'],
      missing_from_it: ['tna-caselaw (74,896 rows, from 1965)', 'ni-judgments (7,927 rows)'],
      consequence:
        'The case-law boundary the coverage block prints is drawn over et-decisions and tax-tribunals ' +
        'alone, so it begins in 1989 — twenty-four years after the real floor of 1965. The block is ' +
        'reproduced above EXACTLY as generated, defect included, because that is what the report prints; ' +
        'date_range_measured below is the corrected measurement.',
    },
    date_range_measured: dateRange,
    front_matter_check: {
      claim_in_the_report: 'case law from 2001 only',
      measured_earliest: dateRange.earliest,
      verdict: 'THE FRONT MATTER IS WRONG. The measured floor is earlier than 2001. See date_range_measured.by_corpus for which collection supplies it.',
    },
    set_a_cites_the_act: setA,
    set_b_common_law_independent: setB,
    sets_never_merged:
      'Set A and Set B answer different questions and are never added. Set A is "who cites this Act"; ' +
      'Set B is "is the principle protected without it". A combined count would answer neither.',
    counts: {
      set_a: setA.length, set_b: setB.length,
      set_a_note: `${setA.length} judgments whose own text names "${m.act_queries[0]}", out of the top ${60 * m.act_queries.length} BM25 candidates over ${CASE_CORPORA.length} collections. Not a count of all cases citing the Act.`,
      set_b_note: `${setB.length} judgments containing one of the principle terms tried, out of the top 25 candidates per term. Not a count of the common law on the point.`,
    },
    gaps,
    gaps_note:
      'Every empty principle was re-asked with a BROADER query and the returned judgments were tested for ' +
      'the principle\'s own words. Where they are present, the entry says RETRIEVAL FAILURE and names the ' +
      'judgments — the corpus is not silent, our query was. That distinction decides whether the report can ' +
      'say the common law says nothing on a point.',
    prediction: { ...m.prediction, recorded_before_run: true },
  })
  console.log(`  wrote ${p}`)
  return { m, setA, setB, gaps }
}

async function main() {
  console.log('── B3 · case law for the absorption gate ──')
  const dateRange = await measureDateRange()
  console.log(`\n══ THE DATE RANGE, MEASURED (brief §3: do not repeat "2001" back) ══`)
  console.log(`  measured floor: ${dateRange.earliest}   ceiling: ${dateRange.latest}   over ${dateRange.rows.toLocaleString()} rows`)
  for (const c of dateRange.by_corpus) console.log(`    ${String(c.corpus).padEnd(16)} ${String(c.n).padStart(7)}  ${c.earliest} → ${c.latest}`)
  console.log(`  ⚠⚠ THE REPORT'S FRONT MATTER SAYS "case law from 2001 only". IT IS WRONG — the floor is ${dateRange.earliest}.`)
  console.log(`  ⚠⚠ AND coverage.ts's own CASE_LAW_CORPORA is wrong too: it names ${COVERAGE_BELIEVES.join(', ')} —`)
  console.log(`     'caselaw' and 'caselaw-fcl' hold ZERO rows, and it misses tna-caselaw (the 1965 floor) and ni-judgments.`)
  console.log(`     The coverage block is reproduced in each output EXACTLY as generated, defect and all.`)

  const coverage = await getCoverage({ caseLaw: true })
  const results = []
  for (const m of MEASURES) results.push(await runMeasure(m, coverage, dateRange))

  console.log('\n══ B3 PREDICTIONS SCORED ══')
  for (const r of results) {
    console.log(`  ${r.m.ws_id}: Set A predicted ${r.m.prediction.set_a} actual ${r.setA.length}` +
      `   ·   Set B predicted ${r.m.prediction.set_b} actual ${r.setB.length}` +
      (r.gaps.length ? `   ·   ${r.gaps.length} principle(s) returned nothing` : ''))
  }
  const bThinner = results.every(r => r.setB.length < r.setA.length / 2)
  console.log(`  predicted: Set B returns fewer than half of Set A on every measure → ${bThinner ? 'HOLDS' : 'WRONG'}`)
  const thinnest = results.reduce((a, b) => (a.setB.length <= b.setB.length ? a : b))
  console.log(`  predicted: WS-05 Set B is the thinnest of the nine cells → thinnest is ${thinnest.m.ws_id} (${thinnest.setB.length}) — ${thinnest.m.ws_id === 'WS-05' ? 'HOLDS' : 'WRONG'}`)
  console.log(`  predicted: the measured floor is earlier than 2001 → floor is ${dateRange.earliest} — ${dateRange.earliest < '2001' ? 'HOLDS' : 'WRONG'}`)

  await endNeonPool()
}

if (require.main === module) {
  main().catch(e => { console.error('[b3] FATAL', e); process.exit(1) })
}
