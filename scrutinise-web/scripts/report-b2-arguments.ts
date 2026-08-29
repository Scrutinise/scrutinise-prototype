/**
 * report-b2-arguments.ts — CC BRIEF B2. Historic objections for the report's §9.
 *
 * ════════════════════════════════════════════════════════════════════════════
 * WHY THIS FILE EXISTS RATHER THAN AN INVOCATION OF argument-questions.ts
 * ════════════════════════════════════════════════════════════════════════════
 * The brief asked me to read that script's interface and report it. It has
 * none. `argument-questions.ts` is a hardcoded set of ten gold questions with
 * hand-picked chunk ids, which writes a markdown file from constants; it takes
 * no query and no measure, which is why `argument:questions` is absent from
 * package.json while ARGUMENT_1A_REPORT.md refers to it. There is nothing to
 * parameterise.
 *
 * What IS runnable is the two-arm instrument in `argument-seed-draw.ts`, and
 * this file uses it in the same shape with measure-specific queries:
 *
 *   dense arm   — probe queries against vector-serve, parliamentary corpora
 *   keyword arm — literal phrases against fts-serve, body fetched from R2
 *
 * ⚠⚠ AND THE CONFIRM STEP IS THE TAXONOMY'S OWN REGEX, ON BOTH ARMS. A retrieval
 * hit is a passage about the subject; an OBJECTION is a passage that makes an
 * argumentative move. `patternHits()` decides which, and it is the arm ARGUMENT
 * 1A measured at 90% against the dense arm's 0% recall on independently found
 * arguments. FTS and the embedding propose; the regex disposes. Every confirmed
 * row records the pattern that confirmed it, so a runaway pattern is visible in
 * the numbers rather than hidden in a total.
 *
 * ⚠ THE ARMS ARE NEVER MERGED INTO ONE COUNT. Proposed and confirmed are
 * reported per arm, per measure.
 *
 * ⚠ NOTHING HERE INTERPRETS. `why_it_bears_on_this_measure` states which query
 * retrieved the passage and which pattern confirmed it. Whether the objection
 * lands is the analysis track's call.
 *
 * ⚠ TWO FIELDS THE BRIEF ASKS FOR THAT THE CORPUS DOES NOT HOLD: `party` and
 * `column`. `corpus_sections` carries no party and no Hansard column. They are
 * emitted as null with a note saying so. Inventing either would put an
 * unsourced fact in a document whose first rule is that every assertion
 * resolves to a corpus row.
 *
 * Usage (no npm entry, per the brief):
 *   ./node_modules/.bin/tsx --env-file=.env --tsconfig tsconfig.json scripts/report-b2-arguments.ts
 */
import fs from 'node:fs'
import path from 'node:path'
import { Prisma } from '@prisma/client'
import { prisma } from '../lib/prisma'
import { r2Get } from '../lib/r2'
import { PATTERNS, TAGS, TAG_MOVE, PARLIAMENTARY_CORPORA, patternHits, type Tag } from './argument/taxonomy'

const V = (process.env.VECTOR_SEARCH_URL ?? '').replace(/\/$/, '')
// ⚠ FTS_SEARCH_URL is not in .env (a standing local gap — see the memory note
// on local search flags). The production host is taken from the repo and NAMED
// in every output file, so no reader has to guess which index answered.
const F = (process.env.FTS_SEARCH_URL ?? 'https://fts-serve-production.up.railway.app').replace(/\/$/, '')

const OUT_DIR = path.join(__dirname, '../../docs/report_run')
const PER_QUERY = 40
const FRAGMENT_FLOOR = 30

// ── the measures, and what is asked of the record ───────────────────────────

interface Measure {
  ws_id: string
  name: string
  /** the SHAPE of the measure, which is what an objection objects to */
  shape: string
  /** dense probes: how a person would state the objection, not the subject */
  probes: string[]
  /** literal phrases for BM25; the regex still has to confirm them */
  phrases: string[]
  /**
   * ⚠ THE MEASURE'S OWN SUBJECT VOCABULARY — used for a MECHANICAL field, never
   * for a filter.
   *
   * Reading B2's first output showed the two things a confirmed row can be, and
   * they look identical in a JSON file. One is the cross-subject objection this
   * whole instrument exists to find: the unbounded-duty argument made in 2005
   * about advertising marches, which transfers to a public sector equality duty
   * without modification. The other is pattern noise: a COST pattern firing on
   * "burden on small businesses" in a question about fuel protesters, which has
   * nothing to do with equality law at all.
   *
   * Deciding which is which is the analysis track's call and this file does not
   * make it. What it can do is record a FACT that separates them — whether the
   * passage uses any of the measure's own subject words. A row with none is
   * connected to the measure only by the argumentative move. That is exactly the
   * cross-subject case AND exactly the noise case, so the field sorts the pile
   * without ruling on any row in it.
   */
  subject_terms: RegExp[]
  prediction: { objections_expected: number; expected_over_floor: number }
}

const MEASURES: Measure[] = [
  {
    ws_id: 'WS-01',
    name: 'Human Rights Act 1998',
    shape: 'incorporating a rights instrument into domestic law, with a duty on public authorities and a judicial power to declare legislation incompatible',
    probes: [
      'the courts will be drawn into deciding political questions that belong to Parliament',
      'incorporating a charter of rights transfers power from Parliament to unelected judges',
      'a general declaration of rights is too vague for a court to enforce',
      'this will produce a flood of litigation against public authorities',
      'rights are better protected by Parliament and the common law than by a written instrument',
      'the judges will be politicised by having to decide these questions',
    ],
    phrases: [
      'transfer power from Parliament to the judges',
      'unelected judges',
      'flood of litigation',
      'politicise the judiciary',
      'a charter of rights',
      'incorporation of the Convention',
    ],
    subject_terms: [
      /human rights/i, /convention/i, /\bECHR\b/i, /Strasbourg/i, /bill of rights/i,
      /charter of rights/i, /fundamental rights/i, /incorporat\w+ the convention/i,
      /declaration of incompatibility/i, /public authorit/i,
    ],
    prediction: { objections_expected: 30, expected_over_floor: 24 },
  },
  {
    ws_id: 'WS-04',
    name: 'Equality Act 2010',
    shape: 'a general statutory duty to have due regard to equality, owed by public authorities to an open class, consolidating several earlier regimes',
    probes: [
      'a duty to have regard imposes a burden without achieving anything',
      'equality legislation places an unreasonable burden on small businesses',
      'you cannot legislate to change people\'s attitudes',
      'this creates a duty owed to an unbounded class of people',
      'consolidating several Acts into one will lose distinctions that matter',
      'this will be a charter for lawyers and for vexatious claims',
    ],
    phrases: [
      'burden on small businesses',
      'you cannot legislate for',
      'due regard to the need',
      'a charter for lawyers',
      'vexatious claims',
      'political correctness',
    ],
    subject_terms: [
      /equality/i, /equal opportunit/i, /discriminat/i, /protected characteristic/i,
      /race relations/i, /sex discrimination/i, /disability discrimination/i,
      /due regard/i, /public sector equality duty/i, /\bEHRC\b/i,
    ],
    prediction: { objections_expected: 25, expected_over_floor: 20 },
  },
  {
    ws_id: 'WS-05',
    name: 'Constitutional Reform and Governance Act 2010, Part 1',
    shape: 'putting the civil service on a statutory footing — a statutory code, a Civil Service Commission, and statutory recognition of special advisers, replacing prerogative management',
    probes: [
      'putting the civil service on a statutory basis would damage its flexibility',
      'a Civil Service Act would make officials accountable to a commission rather than to ministers',
      'the prerogative works well and legislating would rigidify it',
      'special advisers should not have executive power over permanent civil servants',
      'codifying a convention turns it into something the courts can adjudicate',
      'the political neutrality of the civil service cannot be secured by statute',
    ],
    phrases: [
      'Civil Service Act',
      'statutory footing',
      'political impartiality of the civil service',
      'special advisers',
      'Civil Service Commission',
      'Civil Service Code',
    ],
    subject_terms: [
      /civil service/i, /civil servant/i, /special adviser/i, /permanent secretary/i,
      /civil service commission/i, /civil service code/i, /whitehall/i,
      /impartialit/i, /prerogative/i, /Northcote/i,
    ],
    prediction: { objections_expected: 15, expected_over_floor: 12 },
  },
]

// ── the two arms ────────────────────────────────────────────────────────────

async function dense(queries: string[], limit: number): Promise<Array<{ q: string; hits: any[] }>> {
  const out: Array<{ q: string; hits: any[] }> = []
  // ⚠ ONE BATCH AT A TIME, SEQUENTIALLY. vector-serve saturates at four
  // concurrent dense streams and does not recover — a client abort does not
  // cancel queued work, so timed-out legs feed the queue rather than draining
  // it. There is no deadline here worth that risk.
  for (const q of queries) {
    try {
      const res = await fetch(`${V}/vector-search-batch`, {
        method: 'POST', headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ queries: [{ query: q, limit, corpora: PARLIAMENTARY_CORPORA }] }),
      })
      if (!res.ok) { out.push({ q, hits: [] }); continue }
      const j = await res.json() as any
      out.push({ q, hits: j.queries?.[0]?.ok ? (j.queries[0].results ?? []) : [] })
    } catch { out.push({ q, hits: [] }) }
  }
  return out
}

async function keyword(phrases: string[], limit: number): Promise<Array<{ q: string; hits: any[] }>> {
  const out: Array<{ q: string; hits: any[] }> = []
  for (const q of phrases) {
    try {
      const res = await fetch(`${F}/fts-search`, {
        method: 'POST', headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ query: q, limit, corpora: PARLIAMENTARY_CORPORA }),
      })
      out.push({ q, hits: res.ok ? (((await res.json()) as any).results ?? []) : [] })
    } catch { out.push({ q, hits: [] }) }
  }
  return out
}

async function hydrate(ids: string[]): Promise<Map<string, any>> {
  if (!ids.length) return new Map()
  const rows = await prisma.$queryRaw<any[]>`
    SELECT id, corpus, "sectionTitle", speaker, "itemDate", "wordCount", "r2Key", "sourceUrl"
    FROM corpus_sections WHERE id IN (${Prisma.join(ids)})`
  return new Map(rows.map(r => [r.id, r]))
}

/**
 * Which House or chamber the passage was spoken in.
 *
 * ⚠ Derived, and null when the two available signals disagree. The corpus does
 * not carry a house column, so this is inference from the collection and from
 * the title prefix — and a guess presented as a fact is what the cardinal rule
 * exists to stop. Where they conflict, the row says `null` and the reader goes
 * to `source_url`.
 */
function houseOf(corpus: string, id: string, title: string | null): string | null {
  const byCorpus: Record<string, string> = {
    'pwdata-debates': 'House of Commons',
    'pwdata-lords': 'House of Lords',
    'pwdata-westminster': 'Westminster Hall',
    'niassembly-hansard': 'Northern Ireland Assembly',
    'scottish-parliament-or': 'Scottish Parliament',
    'committees-evidence': 'select committee (evidence)',
    'committees-reports': 'select committee (report)',
  }
  if (byCorpus[corpus]) return byCorpus[corpus]
  if (corpus === 'historic-hansard') {
    // the series code sits in the id: S5LV… = Lords, S5CV… = Commons
    const series = id.split(':')[1] ?? ''
    const fromId = /^S\d+LV/.test(series) ? 'House of Lords' : /^S\d+CV/.test(series) ? 'House of Commons' : null
    const fromTitle = title?.startsWith('Lords:') ? 'House of Lords'
      : title?.startsWith('Commons:') ? 'House of Commons' : null
    if (fromId && fromTitle && fromId !== fromTitle) return null   // disagree → say nothing
    return fromId ?? fromTitle
  }
  return null
}

interface Objection {
  quoted_paragraph: string
  word_count: number
  fragment: boolean
  speaker: string | null
  party: string | null
  date: string | null
  house: string | null
  debate_title: string | null
  column: string | null
  source_key: string
  retrieval_arm: 'dense' | 'keyword'
  subject_of_debate: string | null
  why_it_bears_on_this_measure: string
  // ── beyond the contract, because the contract cannot carry them ──────────
  section_id: string
  corpus: string
  source_url: string | null
  query: string
  confirmed_by_pattern: string
  argument_moves: Array<{ tag: Tag; move: string; pattern: string }>
  also_found_by: string[]
  /** ⚠ MECHANICAL, not a judgement: which of the measure's own subject words the
   *  passage uses. EMPTY means the passage is connected to the measure by the
   *  argumentative move alone — which is both the cross-subject case worth
   *  having and the pattern-noise case worth discarding. Sort on it; this file
   *  does not decide which any row is. */
  subject_terms_present: string[]
  /** ⚠ present and non-null only where a field the brief asks for is absent for
   *  a STRUCTURAL reason, so a blank is never read as an oversight. */
  missing_field_reasons: Record<string, string> | null
  quoted_paragraph_is_extract: boolean
  score: number | null
}

/** A verbatim window around the confirming match — never a paraphrase. */
function windowAround(flat: string, re: RegExp, width = 1200): { text: string; extract: boolean } {
  if (flat.length <= width) return { text: flat, extract: false }
  const m = flat.match(re)
  const at = m?.index ?? 0
  const start = Math.max(0, at - Math.floor(width / 3))
  const end = Math.min(flat.length, start + width)
  return {
    text: (start > 0 ? '… ' : '') + flat.slice(start, end) + (end < flat.length ? ' …' : ''),
    extract: true,
  }
}

async function runMeasure(m: Measure) {
  console.log(`\n══ ${m.ws_id} — ${m.name} ══`)
  console.log(`  prediction: ${m.prediction.objections_expected} confirmed objections, ${m.prediction.expected_over_floor} over the ${FRAGMENT_FLOOR}-word floor`)

  const armStats = {
    dense: { proposed: 0, hydrated: 0, bodyRead: 0, confirmed: 0 },
    keyword: { proposed: 0, hydrated: 0, bodyRead: 0, confirmed: 0 },
  }
  const byId = new Map<string, Objection>()

  for (const arm of ['keyword', 'dense'] as const) {
    const results = arm === 'dense'
      ? await dense(m.probes, PER_QUERY)
      : await keyword(m.phrases, PER_QUERY)

    for (const { q, hits } of results) {
      armStats[arm].proposed += hits.length
      const meta = await hydrate([...new Set(hits.map((h: any) => h.id))])
      for (const h of hits) {
        const md = meta.get(h.id)
        if (!md || !md.r2Key || !PARLIAMENTARY_CORPORA.includes(md.corpus)) continue
        armStats[arm].hydrated++
        if (byId.has(h.id)) { byId.get(h.id)!.also_found_by.push(`${arm}: ${q}`); continue }
        const body = await r2Get(md.r2Key).catch(() => null)
        if (!body) continue
        armStats[arm].bodyRead++
        const flat = body.replace(/\s+/g, ' ').trim()

        // ⚠ THE CONFIRM STEP. Retrieval says the passage is about the subject;
        // this says it makes an argumentative move. Both arms go through it.
        const moves = patternHits(flat)
        if (moves.length === 0) continue
        armStats[arm].confirmed++

        const firstRe = PATTERNS[moves[0].tag].find(p => p.test(flat)) ?? /$^/
        const { text, extract } = windowAround(flat, firstRe)
        // ⚠ the word count is the SECTION's own, not the extract's: it is the
        // measured quantity ARGUMENT 1A's 30-word finding is about, and 92.6%
        // of parliamentary sections are a single chunk.
        const words = md.wordCount ?? flat.split(/\s+/).filter(Boolean).length

        byId.set(h.id, {
          quoted_paragraph: text,
          word_count: words,
          fragment: words < FRAGMENT_FLOOR,
          speaker: md.speaker ?? null,
          party: null,
          date: md.itemDate ? new Date(md.itemDate).toISOString().slice(0, 10) : null,
          house: houseOf(md.corpus, md.id, md.sectionTitle),
          debate_title: md.sectionTitle ?? null,
          column: null,
          source_key: md.r2Key,
          retrieval_arm: arm,
          subject_of_debate: md.sectionTitle ?? null,
          why_it_bears_on_this_measure:
            `retrieved by the ${arm} arm on "${q}"; the passage makes the ${moves[0].tag} move (${TAG_MOVE[moves[0].tag]}), confirmed by ${moves[0].pattern}`,
          section_id: md.id,
          corpus: md.corpus,
          source_url: md.sourceUrl ?? null,
          query: q,
          confirmed_by_pattern: moves[0].pattern,
          argument_moves: moves.map(x => ({ tag: x.tag, move: TAG_MOVE[x.tag], pattern: x.pattern })),
          also_found_by: [],
          subject_terms_present: m.subject_terms.filter(t => t.test(flat)).map(t => String(t)),
          missing_field_reasons: (() => {
            const r: Record<string, string> = {}
            if (!md.speaker) r.speaker = md.corpus.startsWith('committees-')
              ? 'a committee report or written-evidence document is authored by the committee or the witness organisation, not by a speaker; corpus_sections carries no speaker for it'
              : 'no speaker recorded on this section in corpus_sections'
            if (!md.itemDate) r.date = 'no itemDate recorded on this section in corpus_sections'
            if (!md.sectionTitle) r.debate_title = 'no sectionTitle recorded on this section in corpus_sections'
            r.party = 'corpus_sections carries no party for any row'
            r.column = 'no Hansard column number is stored; source_url carries the publisher anchor where one exists'
            return r
          })(),
          quoted_paragraph_is_extract: extract,
          score: h.score ?? null,
        })
      }
    }
    const s = armStats[arm]
    console.log(`  ${arm.padEnd(8)} ${s.proposed} proposed → ${s.bodyRead} bodies read → ${s.confirmed} confirmed by a pattern` +
      (s.bodyRead ? ` (${(100 * s.confirmed / s.bodyRead).toFixed(1)}%)` : ''))
  }

  const objections = [...byId.values()].sort((a, b) => (a.date ?? '').localeCompare(b.date ?? ''))
  const overFloor = objections.filter(o => !o.fragment).length
  const byArm: Record<string, number> = { dense: 0, keyword: 0 }
  for (const o of objections) byArm[o.retrieval_arm]++
  const fragByArm: Record<string, number> = { dense: 0, keyword: 0 }
  for (const o of objections) if (o.fragment) fragByArm[o.retrieval_arm]++

  console.log(`  → ${objections.length} distinct objections (keyword ${byArm.keyword}, dense ${byArm.dense}) — NOT summed as one arm`)
  console.log(`    over the ${FRAGMENT_FLOOR}-word floor: ${overFloor}; fragments kept, not dropped: ${objections.length - overFloor}` +
    ` (dense ${fragByArm.dense}, keyword ${fragByArm.keyword})`)
  console.log(`    predicted ${m.prediction.objections_expected} / ${m.prediction.expected_over_floor} — actual ${objections.length} / ${overFloor}`)

  const tagSpread: Record<string, number> = {}
  for (const o of objections) tagSpread[o.argument_moves[0].tag] = (tagSpread[o.argument_moves[0].tag] ?? 0) + 1
  console.log(`    moves: ${Object.entries(tagSpread).sort((a, b) => b[1] - a[1]).map(([k, v]) => `${k} ${v}`).join(', ') || 'none'}`)

  const noSubjectTerm = objections.filter(o => o.subject_terms_present.length === 0)
  console.log(`    ⚠ passages using NONE of this measure's subject words: ${noSubjectTerm.length} of ${objections.length}` +
    ` — connected by the argumentative move alone. Both the cross-subject find and the pattern noise live here; the field sorts them, this file does not judge them.`)
  const meta = {
    no_speaker: objections.filter(o => !o.speaker).length,
    no_date: objections.filter(o => !o.date).length,
    no_debate_title: objections.filter(o => !o.debate_title).length,
    no_subject_term: noSubjectTerm.length,
  }
  console.log(`    metadata gaps: ${meta.no_speaker} without a speaker, ${meta.no_date} without a date, ${meta.no_debate_title} without a debate title` +
    ` — each row says why in missing_field_reasons`)

  const out = {
    generated_at: new Date().toISOString(),
    measure: `${m.ws_id} — ${m.name}`,
    measure_shape_searched: m.shape,
    invocation:
      './node_modules/.bin/tsx --env-file=.env --tsconfig tsconfig.json scripts/report-b2-arguments.ts',
    instrument: {
      note:
        'argument-questions.ts is NOT a query interface — it is a hardcoded set of ten gold questions ' +
        'with hand-picked chunk ids that writes a markdown file from constants. It takes no query and no ' +
        'measure, which is why argument:questions is absent from package.json. This run uses the two-arm ' +
        'instrument from argument-seed-draw.ts with measure-specific queries, and the confirm step is ' +
        'patternHits() from argument/taxonomy.ts.',
      dense_service: V,
      keyword_service: F,
      keyword_service_note: 'FTS_SEARCH_URL is not set in .env; this is the production host found in the repo.',
      corpora: PARLIAMENTARY_CORPORA,
      per_query_limit: PER_QUERY,
      dense_probes: m.probes,
      keyword_phrases: m.phrases,
      confirm_step:
        'A retrieval hit is a passage about the subject. An OBJECTION is a passage that makes an ' +
        'argumentative move. patternHits() decides which, on BOTH arms, and every confirmed row records ' +
        'the pattern that confirmed it. ARGUMENT 1A measured this arm at 90% against the dense arm\'s 0% ' +
        'recall on independently found arguments.',
    },
    prediction: { ...m.prediction, recorded_before_run: true },
    arms_never_merged: {
      note: 'Proposed and confirmed are reported per arm. The two are never added into one count.',
      dense: armStats.dense,
      keyword: armStats.keyword,
      distinct_objections_by_arm: byArm,
      fragments_by_arm: fragByArm,
    },
    fields_the_corpus_does_not_hold: {
      party: 'corpus_sections carries no party. Emitted as null on every row rather than inferred from the speaker name.',
      column: 'no Hansard column number is stored. source_url carries the publisher anchor where one exists; for pwdata rows that anchor encodes the column reference.',
    },
    subject_term_screen: {
      terms: m.subject_terms.map(t => String(t)),
      passages_using_none_of_them: meta.no_subject_term,
      of_total: objections.length,
      note:
        '⚠ MECHANICAL, AND IT IS THE FIELD TO SORT ON BEFORE DRAFTING. A row with an empty ' +
        'subject_terms_present is connected to this measure by the argumentative MOVE alone. That is ' +
        'both the cross-subject objection this instrument exists to find — the unbounded-duty argument ' +
        'made in 2005 about advertising marches transfers to a public sector equality duty unchanged — ' +
        'AND the pattern-noise case, a COST pattern firing on "burden on small businesses" in a question ' +
        'about fuel protesters. The two are indistinguishable to any mechanical test and telling them ' +
        'apart is a reading, which is the analysis track\'s call. This field sorts the pile; it does not ' +
        'rule on anything in it.',
    },
    metadata_completeness: {
      ...meta,
      note:
        'Every gap is structural and named per row in missing_field_reasons. Committee reports and ' +
        'written evidence have no speaker because the document is authored by a committee or a witness ' +
        'organisation. party and column are held for NO row: the corpus does not carry them.',
    },
    objections,
    objections_over_floor: overFloor,
    fragments_kept: objections.length - overFloor,
    fragment_rule: `fragment = true where the section's own word count is under ${FRAGMENT_FLOOR}. No row is dropped for it. A fragment is material to read; it is not material to quote.`,
    returned_nothing_usable: objections.length === 0,
    coverage_note:
      `Searched ${PARLIAMENTARY_CORPORA.length} parliamentary collections through two live indexes. ` +
      'This is top-K retrieval, not a scan: it says what the queries reached, never what the record contains. ' +
      'A move made in words none of these twelve queries reach is not here, and its absence is not evidence.',
  }
  fs.mkdirSync(OUT_DIR, { recursive: true })
  const p = path.join(OUT_DIR, `argument_${m.ws_id}.json`)
  fs.writeFileSync(p, JSON.stringify(out, null, 2))
  console.log(`  wrote ${p}`)
  return { m, objections, overFloor, armStats }
}

async function main() {
  if (!V) { console.error('VECTOR_SEARCH_URL is required'); process.exit(2) }
  console.log('── B2 · historic objections, two arms, regex-confirmed ──')
  console.log(`  dense  : ${V}`)
  console.log(`  keyword: ${F}${process.env.FTS_SEARCH_URL ? '' : '   ⚠ FTS_SEARCH_URL unset in .env — host taken from the repo'}`)
  console.log(`  ten argument moves: ${TAGS.join(', ')}`)

  const results = []
  for (const m of MEASURES) results.push(await runMeasure(m))

  console.log('\n══ B2 PREDICTIONS SCORED ══')
  let propAll = 0, confAll = 0, objAll = 0, floorAll = 0
  for (const r of results) {
    const prop = r.armStats.dense.bodyRead + r.armStats.keyword.bodyRead
    const conf = r.armStats.dense.confirmed + r.armStats.keyword.confirmed
    propAll += prop; confAll += conf; objAll += r.objections.length; floorAll += r.overFloor
    console.log(`  ${r.m.ws_id}: predicted ${r.m.prediction.objections_expected}/${r.m.prediction.expected_over_floor}` +
      `  actual ${r.objections.length}/${r.overFloor}`)
  }
  console.log(`  rate 1 — confirmed as a share of candidates whose body was read: ${confAll} of ${propAll} = ` +
    `${propAll ? (100 * confAll / propAll).toFixed(1) : '0'}% (predicted >=25%)`)
  console.log(`  rate 2 — over the ${FRAGMENT_FLOOR}-word floor as a share of confirmed objections: ${floorAll} of ${objAll} = ` +
    `${objAll ? (100 * floorAll / objAll).toFixed(1) : '0'}% (predicted >=70%)`)
  const denseFrag = results.reduce((n, r) => n + r.objections.filter(o => o.retrieval_arm === 'dense' && o.fragment).length, 0)
  const denseAll = results.reduce((n, r) => n + r.objections.filter(o => o.retrieval_arm === 'dense').length, 0)
  const kwFrag = results.reduce((n, r) => n + r.objections.filter(o => o.retrieval_arm === 'keyword' && o.fragment).length, 0)
  const kwAll = results.reduce((n, r) => n + r.objections.filter(o => o.retrieval_arm === 'keyword').length, 0)
  console.log(`  the split predicted: dense carries the fragments, keyword the quotable rows.`)
  console.log(`    dense   ${denseFrag} of ${denseAll} are fragments${denseAll ? ` (${(100 * denseFrag / denseAll).toFixed(1)}%)` : ''}`)
  console.log(`    keyword ${kwFrag} of ${kwAll} are fragments${kwAll ? ` (${(100 * kwFrag / kwAll).toFixed(1)}%)` : ''}`)

  await prisma.$disconnect()
}

main().catch(e => { console.error('[b2] FATAL', e); process.exit(1) })
