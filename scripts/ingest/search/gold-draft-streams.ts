/**
 * gold-draft-streams.ts — DRAFT gold questions for the three streams that have none.
 *
 * ⚠ EVERY QUERY IN THIS FILE IS UNVALIDATED AND DRAFTED BY CC, NOT BY CCh. ⚠
 * They are kept OUT of `gold-queries.ts` on purpose: `GOLD` is the yardstick every retrieval
 * decision is measured against, and quietly adding CC-invented questions to it would let an
 * unreviewed answer key move a headline number. These live separately, are scored separately,
 * and every report built on them is labelled PROVISIONAL twice over — once for the outstanding
 * answer-key validation pass, once for the questions themselves.
 *
 * WHY THEY EXIST. Auditing the gold set for the per-stream vector work (6 Aug) found:
 *   committees  0 scoreable queries   ← the brief anticipated this and asked for 3–5
 *   caselaw     0 scoreable queries   ← the brief did NOT anticipate this; same gap
 *   guidance    ~1 (B6) + partial C   ← archetype G is 'lesson'-metric, 0 scoreable
 * No gold query anywhere names a caselaw source. So rows 5, 6 and 7 of the bundle could not be
 * scored at all without drafting questions first; the brief's remedy for row 5 is applied to
 * all three.
 *
 * DRAFTING RULE FOR COMMITTEES, per the brief: "does a committee's own report/evidence surface
 * for a question about hypotheses on causes and effects". So each committee question asks WHY
 * something happened or WHAT FOLLOWED from it — the shape a select committee inquiry answers —
 * rather than naming a document, which would test lookup rather than the stream.
 *
 * Expected-source patterns are matched against `id + sectionTitle + body`, the same haystack
 * `score-vector-full.ts` builds, so they are written against wording likely to appear in the
 * text rather than against corpus ids alone.
 */
import type { GoldQuery } from './gold-queries'

const ci = (...ss: string[]): RegExp[] => ss.map((s) => new RegExp(s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i'))

export type DraftStream = 'committees' | 'caselaw' | 'guidance'

export type DraftQuery = Pick<GoldQuery, 'id' | 'query' | 'expected'> & {
  stream: DraftStream
  /** One line on why this question tests the stream, for the report's review table. */
  rationale: string
}

export const DRAFT_QUERIES: DraftQuery[] = [
  // ── committees — causes and effects, where a committee's own work is the answer ──
  {
    id: 'CM1', stream: 'committees',
    query: 'What did MPs conclude were the causes of the collapse of Carillion?',
    rationale: 'A joint-committee inquiry IS the authoritative account of the causes; no statute or judgment answers it.',
    expected: [
      { label: 'Carillion inquiry report (BEIS + Work and Pensions)', patterns: ci('carillion') },
      { label: 'The inquiry’s own findings on audit/pensions', patterns: ci('kpmg', 'the pensions regulator', 'aggressive accounting', 'reverse factoring') },
    ],
  },
  {
    id: 'CM2', stream: 'committees',
    query: 'Why were failures in the Post Office Horizon IT system not addressed for so long?',
    rationale: 'Tests whether committee evidence sessions surface for a causal question about institutional failure.',
    expected: [
      { label: 'Post Office / Horizon committee work', patterns: ci('horizon', 'post office') },
      { label: 'The Horizon-specific findings', patterns: ci('sub-postmaster', 'subpostmaster', 'fujitsu', 'group litigation') },
    ],
  },
  {
    id: 'CM3', stream: 'committees',
    query: 'What evidence was given about the effects of the two-child limit on child poverty?',
    rationale: 'An effects question whose best source is submitted written/oral evidence rather than a report conclusion.',
    expected: [
      { label: 'Two-child limit evidence', patterns: ci('two-child', 'two child limit') },
      { label: 'The policy-specific evidence', patterns: ci('rape clause', 'non-consensual conception', 'benefit cap', 'universal credit') },
    ],
  },
  {
    id: 'CM4', stream: 'committees',
    query: 'What did committees find caused the failures in the UK response to the coronavirus pandemic?',
    rationale: 'The "lessons learned" joint report is a pure causes-and-effects artefact of the committee stream.',
    expected: [
      { label: 'Coronavirus: lessons learned to date', patterns: ci('lessons learned', 'coronavirus', 'covid-19') },
      { label: 'The inquiry’s named conclusions', patterns: ci('test and trace', 'herd immunity', 'lessons learned') },
    ],
  },

  // ── caselaw — the stream has no gold coverage at all; these test doctrine retrieval ──
  // ⚠ CALIBRATION NOTE (6 Aug). The first drafts of these paired a NAMED authority with a
  // generic doctrinal phrase ('unreasonable', 'consultation', 'worker'). A smoke run scored
  // 100% on all four at EVERY fusion weight — because inside tier='caselaw' the generic half
  // matches almost any judgment, so the question could not distinguish BM25 from vector from
  // fusion. A test everything passes measures nothing. Each expected source is now a
  // DISTINCTIVE identifier — a case name or a term of art that only the right authority uses.
  {
    id: 'CL1', stream: 'caselaw',
    query: 'What is the test for whether a public body’s decision is so unreasonable that a court will overturn it?',
    rationale: 'Plain-language route to Wednesbury — the H2 vocabulary bridge, but into caselaw rather than statute.',
    expected: [
      { label: 'Associated Provincial Picture Houses v Wednesbury', patterns: ci('wednesbury') },
      { label: 'The reformulated GCHQ/irrationality standard', patterns: ci('so outrageous', 'defies logic', 'gchq', 'council of civil service unions') },
    ],
  },
  {
    id: 'CL2', stream: 'caselaw',
    query: 'When is a consultation by a public authority unlawful because it was inadequate?',
    rationale: 'Tests retrieval of a named doctrinal line (Gunning/Moseley) from a question naming neither.',
    expected: [
      { label: 'R (Moseley) v Haringey LBC', patterns: ci('moseley') },
      { label: 'The Gunning/Sedley criteria', patterns: ci('gunning', 'sedley') },
    ],
  },
  {
    id: 'CL3', stream: 'caselaw',
    query: 'Can the government suspend Parliament to avoid scrutiny?',
    rationale: 'A constitutional question with one decisive authority; a strong signal if vector finds it from lay wording.',
    expected: [
      { label: 'R (Miller) v The Prime Minister; Cherry v Advocate General', patterns: ci('prorogation', 'prorogue') },
      { label: 'The named 2019 authority', patterns: ci('cherry', 'advocate general for scotland') },
    ],
  },
  {
    id: 'CL4', stream: 'caselaw',
    query: 'How do courts decide if someone driving for an app is an employee or self-employed?',
    rationale: 'Gig-economy status; tests whether the leading authority surfaces from entirely non-legal wording.',
    expected: [
      { label: 'Uber BV v Aslam', patterns: ci('aslam') },
      { label: 'The limb (b) worker / Autoclenz line', patterns: ci('limb \\(b\\)', 'autoclenz') },
    ],
  },

  // ── guidance — regulator guidance/codes, distinct from the statute behind them ──
  {
    id: 'GD1', stream: 'guidance',
    query: 'How does HMRC decide whether a contractor counts as employed or self-employed for tax?',
    rationale: 'The answer lives in HMRC manuals, not in the Act — tests that guidance wins where it should.',
    expected: [
      { label: 'HMRC employment status manual', patterns: ci('employment status', 'esm', 'ir35', 'off-payroll') },
      { label: 'The named status tests', patterns: ci('cest', 'mutuality of obligation', 'ready mixed concrete') },
    ],
  },
  {
    id: 'GD2', stream: 'guidance',
    query: 'What must a financial firm do when a customer complains?',
    rationale: 'FCA DISP is the operative rulebook; statute alone would be the wrong answer.',
    expected: [
      { label: 'FCA Handbook DISP', patterns: ci('disp', 'complaint') },
      { label: 'The DISP time limits', patterns: ci('final response', 'eight weeks', 'six months') },
    ],
  },
  {
    id: 'GD3', stream: 'guidance',
    query: 'When do I have to tell the regulator about a personal data breach?',
    rationale: 'ICO guidance carries the operational 72-hour rule; tests guidance-over-statute retrieval.',
    expected: [
      { label: 'ICO personal data breach guidance', patterns: ci('personal data breach', 'ico') },
      { label: 'The 72-hour reporting duty', patterns: ci('72 hours', 'seventy-two hours') },
    ],
  },
  {
    id: 'GD4', stream: 'guidance',
    query: 'What are the rules about political advertising on television?',
    rationale: 'Ofcom Broadcasting Code; a lay question whose answer is a regulator code section.',
    expected: [
      { label: 'Ofcom Broadcasting Code', patterns: ci('broadcasting code', 'ofcom') },
      { label: 'Section 320 / the political-advertising ban', patterns: ci('political advertising', 'section 321', 'political nature') },
    ],
  },
]

export function draftFor(stream: DraftStream): DraftQuery[] {
  return DRAFT_QUERIES.filter((q) => q.stream === stream)
}
