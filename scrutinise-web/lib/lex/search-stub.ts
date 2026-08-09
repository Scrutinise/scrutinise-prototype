// Stub legislation search + Initial Background (§8.3, §8.4).
//
// Sprint 1 ships stub data shaped EXACTLY as SearchResult[] so that wiring the
// real FTS in Sprint 3 is a one-line source swap (§8.3). The server groups by
// type, takes 2–3 per type and caps ~20; Lex grounds the briefing on these.

import type { SearchResult, SearchResultType } from './page1-config'
import type { OrientationResult } from './orientation/types'
import { renderOrientationChecked } from './orientation/render'

const PER_TYPE_CAP = 3
const TOTAL_CAP = 20

// A realistic sample set (road-safety flavour) so the panel renders something
// convincing on any idea during Sprint 1. Deterministic — no randomness.
//
// `scorer: 'stub'` is stamped on the whole set at the bottom rather than repeated ten times.
// It matters that these are NOT labelled 'bm25': the numbers below are hand-written to look
// plausible, so a list that silently mixed them with real BM25 would sort by which fixture an
// author liked. score-scope.ts refuses that comparison rather than leaving it to be noticed.
const STUB_CORPUS: SearchResult[] = ([
  {
    id: 'ukpga-1988-52-s36',
    type: 'PRIMARY_LEGISLATION',
    title: 'Road Traffic Act 1988',
    citation: 'Road Traffic Act 1988, s.36',
    snippet:
      'A person driving a motor vehicle on a road must comply with the indication given by a traffic sign…',
    score: 18.4,
    url: 'https://www.legislation.gov.uk/ukpga/1988/52/section/36',
    date: '1988-05-15',
  },
  {
    id: 'ukpga-1984-27-s1',
    type: 'PRIMARY_LEGISLATION',
    title: 'Road Traffic Regulation Act 1984',
    citation: 'Road Traffic Regulation Act 1984, s.1',
    snippet:
      'A traffic authority may make an order in respect of a road for which they are the authority…',
    score: 15.1,
    url: 'https://www.legislation.gov.uk/ukpga/1984/27/section/1',
    date: '1984-06-26',
  },
  {
    id: 'ukpga-2006-49-s2',
    type: 'PRIMARY_LEGISLATION',
    title: 'Road Safety Act 2006',
    citation: 'Road Safety Act 2006, s.2',
    snippet:
      'Provision about graduated fixed penalties and the powers of authorised persons…',
    score: 12.7,
    url: 'https://www.legislation.gov.uk/ukpga/2006/49/section/2',
    date: '2006-11-08',
  },
  {
    id: 'uksi-2002-3113-r36',
    type: 'STATUTORY_INSTRUMENT',
    title: 'The Traffic Signs Regulations and General Directions 2002',
    citation: 'SI 2002/3113, reg.36',
    snippet:
      'The significance of the traffic sign shown in diagram 670 (maximum speed) is that no person shall…',
    score: 11.9,
    url: 'https://www.legislation.gov.uk/uksi/2002/3113/regulation/36',
    date: '2002-12-17',
  },
  {
    id: 'uksi-1999-2864-r104',
    type: 'STATUTORY_INSTRUMENT',
    title: 'The Motor Vehicles (Construction and Use) Regulations 1986',
    citation: 'SI 1986/1078, reg.104',
    snippet:
      'No person shall drive a motor vehicle on a road if he is in such a position that he cannot have proper control…',
    score: 9.3,
    url: 'https://www.legislation.gov.uk/uksi/1986/1078/regulation/104',
    date: '1986-06-26',
  },
  {
    id: 'hansard-2021-roadsafety',
    type: 'DEBATE',
    title: 'Road Safety — Westminster Hall debate',
    citation: 'HC Deb, 18 Nov 2021, col. 201WH',
    snippet:
      '…the case for a national road safety investigation branch, modelled on the air and rail equivalents…',
    score: 8.8,
    url: 'https://hansard.parliament.uk/commons/2021-11-18',
    date: '2021-11-18',
  },
  {
    id: 'hansard-2019-20mph',
    type: 'DEBATE',
    title: '20 mph Speed Limits — debate',
    citation: 'HC Deb, 27 Feb 2019, col. 122WH',
    snippet:
      '…evidence from authorities that introduced default 20 mph limits in residential areas…',
    score: 7.5,
    url: 'https://hansard.parliament.uk/commons/2019-02-27',
    date: '2019-02-27',
  },
  {
    id: 'committee-transport-2022-roadsafety',
    type: 'COMMITTEE',
    title: 'Transport Committee — Road safety: the police response',
    citation: 'Transport Committee, HC 175, 2022',
    snippet:
      'The Committee recommends that the Government set out a clear road safety strategy with measurable targets…',
    score: 7.1,
    url: 'https://committees.parliament.uk/work/road-safety',
    date: '2022-03-30',
  },
  {
    id: 'committee-pac-2019-roadsafety',
    type: 'COMMITTEE',
    title: 'Public Accounts Committee — Reducing road traffic casualties',
    citation: 'PAC, HC 1175, 2019',
    snippet:
      'Progress in reducing road deaths has stalled since 2010; the Department lacks a coherent plan…',
    score: 6.2,
    url: 'https://committees.parliament.uk/work/reducing-road-casualties',
    date: '2019-06-12',
  },
  {
    id: 'caselaw-dpp-v-smith',
    type: 'CASE_LAW',
    title: 'DPP v Smith',
    citation: '[2017] EWHC 962 (Admin)',
    snippet:
      '…the proper construction of the statutory duty on drivers to comply with a traffic sign…',
    score: 5.9,
    url: 'https://caselaw.nationalarchives.gov.uk/ewhc/admin/2017/962',
    date: '2017-04-28',
  },
] as Omit<SearchResult, 'scorer'>[]).map((r) => ({ ...r, scorer: 'stub' as const }))

/** Mimics the real FTS query/result contract (§8.3). Stub for now. */
export function runStubSearch(_keywords: string[], limit = 8): { results: SearchResult[] } {
  void _keywords
  // Real FTS will rank against `_keywords`; the stub returns a fixed ranked set.
  return { results: STUB_CORPUS.slice(0, limit) }
}

/**
 * Take ≤PER_TYPE_CAP per display type, cap at TOTAL_CAP, PRESERVING THE INCOMING ORDER.
 *
 * ⚠ THIS USED TO OPEN WITH `[...results].sort((a, b) => b.score - a.score)`, and that sort was a
 * landmine with a date on it. `fuseWeightedRrf` OVERWRITES `score` with an RRF value (≈0.01)
 * while an unfused stream carries raw BM25 (≈5–25), so the moment `LEX_VECTOR_STREAMS` names a
 * stream, every fused hit sorts BELOW every unfused hit — and the TOTAL_CAP below then clips the
 * fused stream off the end. Not a truncation bug: a confident ordering with nothing behind it.
 * Stage 2C turns per-stream vector on for four more streams, i.e. it is precisely the action that
 * detonates this, so the sort had to go first. lib/lex/score-scope.ts holds the full account and
 * the assertion that stops it coming back.
 *
 * THE FIX IS A DELETION, NOT A NORMALISATION. Nothing replaces the sort, because nothing needs
 * to: since 2026-08-09 the list arriving here from the routed path is already stream-balanced by
 * construction (interleave.ts round-robins the streams), and on the unrouted path it arrives in
 * BM25 rank order — which the old sort reproduced exactly. So for every single-scorer input this
 * function's output is UNCHANGED; only the mixed-scorer case, which was wrong, moves.
 *
 * Two orders are preserved, both of them the incoming one:
 *   · WITHIN a type — the ≤3 kept are the first 3 to appear, in that order;
 *   · ACROSS types — the output is emitted in incoming order, NOT as type blocks.
 * The second half changed with the sort. Type-blocked output made TOTAL_CAP clip whole types off
 * the tail (≤3 × 9 types = 27 candidates for 20 slots), which is the same "a stream Lex must deny
 * having found" failure as the `perStream.flat()` slice, one layer down. Emitting in incoming
 * order makes the 20-cap drop the weakest tail of a balanced list instead. Nothing downstream
 * wanted type blocks: the panel re-partitions by type itself (`groupLandscape`), and facts.ts
 * re-buckets before sampling.
 */
export function groupForPanel(results: SearchResult[]): SearchResult[] {
  const perType = new Map<SearchResultType, number>()
  const kept: SearchResult[] = []
  for (const r of results) {
    const n = perType.get(r.type) ?? 0
    if (n >= PER_TYPE_CAP) continue
    perType.set(r.type, n + 1)
    kept.push(r)
    if (kept.length >= TOTAL_CAP) break
  }
  return kept
}

/**
 * Build the Initial Background briefing prose from keywords + grouped refs.
 *
 * §6d — when an orientation result is passed, its Tier B/C segments are appended
 * after the corpus sections. Order is deliberate and is the provenance rule made
 * visible: the law first, from the corpus; background and circulating argument
 * after it, badged. The summary stays corpus-only — nothing from orientation may
 * reach it (quarantine.ts asserts that, it is not left to care).
 */
export function buildInitialBackground(
  keywords: string[],
  refs: SearchResult[],
  orientation?: OrientationResult | null,
): { summary: string; body: string; quarantineOk: boolean } {
  const kw = keywords.length ? keywords.join(', ') : 'this area'
  const acts = refs.filter((r) => r.type === 'PRIMARY_LEGISLATION')
  const sis = refs.filter((r) => r.type === 'STATUTORY_INSTRUMENT')
  const debates = refs.filter((r) => r.type === 'DEBATE')
  const committees = refs.filter((r) => r.type === 'COMMITTEE')

  const summary =
    `The law in ${kw} is anchored by ${acts[0]?.title ?? 'primary legislation'}` +
    (sis[0] ? `, with detailed rules in ${sis[0].title}.` : '.') +
    ` Parliament has returned to it repeatedly — ${debates.length} relevant debate(s) and ` +
    `${committees.length} committee report(s) bear on it.`

  const corpusBody = [
    `## Initial Background — ${kw}`,
    '',
    '### The legal framework',
    acts.length
      ? acts.map((a) => `- **${a.citation}** — ${a.snippet}`).join('\n')
      : '- No UK Act matched directly — this area may be governed by retained/assimilated EU law, secondary legislation, or regulator rules.',
    sis.length ? '\n**Secondary legislation:**\n' + sis.map((s) => `- ${s.citation} — ${s.snippet}`).join('\n') : '',
    '',
    '### What Parliament has said',
    debates.length
      ? debates.map((d) => `- ${d.citation}: ${d.snippet}`).join('\n')
      : '- No directly relevant debates surfaced in the first pass.',
    '',
    '### Committee scrutiny',
    committees.length
      ? committees.map((c) => `- ${c.citation}: ${c.snippet}`).join('\n')
      : '- No committee reports surfaced in the first pass.',
    '',
    '### Threads worth pulling',
    '- Where does the existing framework already cover this, and where does it fall silent?',
    '- Is the gap one of law, of enforcement, or of resourcing?',
    '- Which select committee owns the brief, and when did it last look at this?',
  ]
    .filter(Boolean)
    .join('\n')

  // §6d segments, appended after the corpus sections and provenance-checked.
  let orientationMd = ''
  let quarantineOk = true
  // `calls.length` — not `failed` — is the gate, and the distinction matters.
  // With LEX_WEB_ORIENTATION off, runOrientation attempts nothing and returns
  // failed:false with no calls; gating on `!failed` would have rendered an empty
  // "current context" section into every briefing while the flag was off. No
  // call attempted means no section. All calls attempted and failed means the
  // section says so.
  if (orientation && orientation.calls.length > 0) {
    const rendered = renderOrientationChecked(orientation, summary)
    orientationMd = rendered.markdown
    quarantineOk = rendered.quarantineOk
  }

  const closing =
    '\n\n_This is a first-pass briefing generated from a keyword search of the corpus' +
    (orientationMd ? ', plus a web and X orientation pass' : '') +
    '. It is a starting point for the diagnosis, not a settled account._'

  return { summary, body: corpusBody + orientationMd + closing, quarantineOk }
}
