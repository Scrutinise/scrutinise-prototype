/**
 * gold-preferences.ts — ORDERING constraints for the gold set.
 *
 * Every headline number in this project is recall@20, which is a set metric and cannot see
 * position. `docs/ORDERING_METRIC_PROPOSAL.md` sets out why pairwise preferences are the primary
 * ordering metric here rather than MRR (our own regression scores MRR = 1.0) or nDCG (our answer
 * key is admittedly incomplete, and nDCG grades every unlisted document 0).
 *
 * ⚠ AUTHORED BEFORE ANY RERANKER EXISTS — 2026-08-09. That is the whole point. Pairs written after
 * seeing a candidate's output are fitted to it, and the measurement is then worthless. These are
 * seeded from rankings somebody looked at and judged wrong, or from statements about UK law that
 * are uncontroversial enough to assert in advance.
 *
 * WHY THESE LIVE WEB-SIDE. The metric measures the PRODUCTION ranking, and only the web app can
 * produce it — `runSearch` owns routing, per-stream fusion and the weighting. The ingest-side
 * `gold-queries.ts` scores the serve services directly, which is a different (and also useful)
 * thing. If the two are ever merged, these move there.
 */

/** A side of a preference: patterns that identify a document in the ranking. */
export interface PrefSide {
  label: string
  patterns: RegExp[]
}

/**
 * WHERE a pair can honestly be scored (BRIEF_SEARCH_S2C5 §2).
 *
 * `within-stream` — both sides are retrieved by the SAME router stream, so their relative order is
 *   a real ranking decision made by that stream's own fusion. Round-robin interleaving preserves
 *   each stream's internal order, so this is measurable on the ungrouped `results` list.
 *
 * `cross-stream` — the two sides come from DIFFERENT streams, and there is **no surface anywhere in
 *   the product where their relative order reflects a ranking judgement**. Verified by reading both
 *   candidate surfaces rather than assuming:
 *     · `results` is round-robin (interleave.ts) — position between streams is the `STREAMS`
 *       declaration order and the per-stream floor, by construction;
 *     · `grouped` is a STABLE FILTER over that list — per-type caps, incoming order preserved. The
 *       global cross-stream score sort it used to open with was DELETED on 2026-08-09 (score-scope.ts)
 *       because the scores are not comparable: a fused stream carries an RRF value ~0.008–0.016 while
 *       an unfused one carries raw BM25 ~5–25, so the fused stream lost every comparison for reasons
 *       unrelated to relevance.
 *   Scoring these would therefore measure a construction artefact and report it as ranking quality.
 *   They are EXCLUDED and counted, per the brief: "a metric that silently scores a construction
 *   artefact is worse than a smaller metric."
 *
 * ⚠ These pairs are NOT deleted and their `why` still stands. They become scoreable the moment a real
 * cross-stream ordering exists — which is what a reranker would be — so they are the ready-made
 * acceptance test for one.
 */
export type PrefSurface = 'within-stream' | 'cross-stream'

export interface GoldPreference {
  query: string
  surface: PrefSurface
  above: PrefSide
  below: PrefSide
  /** One line of reasoning. A judgement nobody can see is a judgement nobody can challenge. */
  why: string
}

const ci = (...s: string[]) => s.map((x) => new RegExp(x, 'i'))

// Frequently-referenced instruments, named once.
const UK_GDPR   = { label: 'UK GDPR (Reg (EU) 2016/679)',      patterns: ci('eur/2016/679', 'uk\\s*gdpr') }
const DPA_2018  = { label: 'Data Protection Act 2018',          patterns: ci('ukpga/2018/12') }
const PECR_2003 = { label: 'PECR 2003 (SI 2003/2426)',          patterns: ci('uksi/2003/2426') }
const EQA_2010  = { label: 'Equality Act 2010',                 patterns: ci('ukpga/2010/15') }
const HA_1988   = { label: 'Housing Act 1988',                  patterns: ci('ukpga/1988/50') }
const ERA_1996  = { label: 'Employment Rights Act 1996',        patterns: ci('ukpga/1996/18') }
const CA_2006   = { label: 'Companies Act 2006',                patterns: ci('ukpga/2006/46') }
const FSMA_2000 = { label: 'FSMA 2000',                         patterns: ci('ukpga/2000/8') }
const EA_2002   = { label: 'Enterprise Act 2002',               patterns: ci('ukpga/2002/40') }
const HSWA_1974 = { label: 'Health and Safety at Work etc. Act 1974', patterns: ci('ukpga/1974/37') }
const FOIA_2000 = { label: 'Freedom of Information Act 2000',   patterns: ci('ukpga/2000/36') }
const EPA_1990  = { label: 'Environmental Protection Act 1990', patterns: ci('ukpga/1990/43') }
const WRA_1991  = { label: 'Water Resources Act 1991',          patterns: ci('ukpga/1991/57') }
const LTA_1985  = { label: 'Landlord and Tenant Act 1985',      patterns: ci('ukpga/1985/70') }

/** A statutory instrument or narrow provision that should not outrank its parent regime. */
const anySI = (label: string, ...pat: string[]) => ({ label, patterns: ci(...pat) })

export const PREFERENCES: GoldPreference[] = [
  // ── the observed regression, 4 Aug benchmark ──────────────────────────────
  {
    query: 'what is the law on data protection currently?',
    surface: 'within-stream',
    above: DPA_2018, below: PECR_2003,
    why: 'a reader asking what the law IS wants the principal statute before a sector-specific SI made under a different regime',
  },
  {
    query: 'what is the law on data protection currently?',
    surface: 'within-stream',
    above: UK_GDPR, below: PECR_2003,
    why: 'UK GDPR is the general data-protection regime; PECR is the electronic-communications overlay',
  },
  {
    query: 'what is the law on data protection currently?',
    surface: 'within-stream',
    above: UK_GDPR,
    below: anySI('DPPEC (EU Exit) Regs 2019', 'uksi/2019/419'),
    why: 'the amending SI is only meaningful via the instrument it amends — the amended regime should lead',
  },

  // ── principal statute before subordinate detail, across areas ─────────────
  {
    query: 'what are the rules on unfair dismissal?',
    surface: 'within-stream',
    above: ERA_1996,
    below: anySI('Employment Tribunals procedure rules', 'uksi/(2013|2004)/'),
    why: 'the right and its qualifying conditions sit in the Act; tribunal procedure is downstream of it',
  },
  {
    query: 'what protection does the law give against discrimination at work?',
    surface: 'within-stream',
    above: EQA_2010,
    below: anySI('Equality Act 2010 commencement/consequential SIs', 'uksi/20\\d\\d/\\d+.*equality', 'equality act 2010 \\(commencement'),
    why: 'commencement and consequential instruments carry no substantive rule; the Act does',
  },
  {
    query: 'what are a landlord\'s repairing obligations?',
    surface: 'within-stream',
    above: LTA_1985, below: HA_1988,
    why: 'the repairing covenant is LTA 1985 s.11; HA 1988 governs the tenancy type, not the repair duty',
  },
  {
    query: 'what duties do employers have for health and safety?',
    surface: 'within-stream',
    above: HSWA_1974,
    below: anySI('sector-specific safety regulations', 'uksi/\\d{4}/\\d+'),
    why: 'the general duties in ss.2–3 are the frame every sector regulation hangs off',
  },
  {
    query: 'what are directors duties under company law?',
    surface: 'within-stream',
    above: CA_2006,
    below: anySI('Insolvency Act 1986', 'ukpga/1986/45'),
    why: 'the general duties are CA 2006 ss.171–177; insolvency duties are a distinct, later-stage regime',
  },

  // ── the right Act, not merely a relevant one ──────────────────────────────
  {
    query: 'what powers do regulators have to compel disclosure of information from companies?',
    surface: 'within-stream',
    above: EA_2002, below: DPA_2018,
    why: 'compulsory information-gathering powers are competition/regulatory; DPA 2018 constrains processing, it does not confer them',
  },
  {
    query: 'what powers do regulators have to compel disclosure of information from companies?',
    surface: 'within-stream',
    above: FSMA_2000, below: PECR_2003,
    why: 'FSMA Part XI is an actual information-gathering power; PECR is not about regulator powers at all',
  },
  {
    query: 'how can the public get information held by a public authority?',
    surface: 'within-stream',
    above: FOIA_2000, below: DPA_2018,
    why: 'FOIA is the access regime; DPA/UK GDPR governs personal data and is the exception, not the route',
  },
  {
    query: 'what is the law on water pollution from sewage discharge?',
    surface: 'within-stream',
    above: WRA_1991, below: EPA_1990,
    why: 'water-quality offences and discharge consents are WRA 1991; EPA 1990 is the general pollution-control frame',
  },

  // ── citation queries: the cited provision must lead its own Act ───────────
  {
    query: 'Section 21 Housing Act 1988',
    surface: 'within-stream',
    above: { label: 'HA 1988 s.21 itself', patterns: ci('ukpga/1988/50:section-21\\b') },
    below: { label: 'any other HA 1988 section', patterns: ci('ukpga/1988/50:section-(?!21\\b)') },
    why: 'an exact citation must pin the cited section above its neighbours — this is what the resolver exists for',
  },
  {
    query: 'section 172 Companies Act 2006',
    surface: 'within-stream',
    above: { label: 'CA 2006 s.172 itself', patterns: ci('ukpga/2006/46:section-172\\b') },
    below: { label: 'any other CA 2006 section', patterns: ci('ukpga/2006/46:section-(?!172\\b)') },
    why: 'same rule, different Act — a citation query that returns the right Act but the wrong section has failed',
  },
  {
    query: 'Equality Act 2010 section 149',
    surface: 'within-stream',
    above: { label: 'EqA 2010 s.149 (PSED)', patterns: ci('ukpga/2010/15:section-149\\b') },
    below: { label: 'any other EqA 2010 section', patterns: ci('ukpga/2010/15:section-(?!149\\b)') },
    why: 'the public sector equality duty is a named, frequently-cited provision; it must pin exactly',
  },

  // ── primary legislation before commentary about it ────────────────────────
  {
    query: 'what does the law say about zero hours contracts?',
    surface: 'cross-stream',
    above: ERA_1996,
    below: { label: 'a debate or committee discussion of the topic', patterns: ci('^(pwdata|historic-hansard|committees)') },
    why: 'asked what the LAW says, statute outranks parliamentary discussion of it — the reverse is right for "what have MPs said"',
  },
  {
    query: 'what is the legal definition of personal data?',
    surface: 'cross-stream',
    above: UK_GDPR,
    below: { label: 'ICO or regulator guidance', patterns: ci('^(ico|quangos-govuk|fca-handbook)') },
    why: 'a definition question wants the definition in the instrument; guidance interprets it and should follow',
  },

  // ── the inverse, so the set cannot be satisfied by "always prefer statute" ─
  {
    query: 'what have select committees said about water company pollution?',
    surface: 'cross-stream',
    above: { label: 'a committee report or evidence session', patterns: ci('^committees-') },
    below: WRA_1991,
    why: 'deliberately inverted: asked what COMMITTEES said, a committee document must outrank the statute',
  },
  {
    query: 'what have MPs said in debate about leasehold reform?',
    surface: 'cross-stream',
    above: { label: 'a Hansard debate', patterns: ci('^(pwdata-debates|historic-hansard|pwdata-lords)') },
    below: { label: 'any Act or SI', patterns: ci('^(primary-acts|si-)') },
    why: 'same inversion for debates — a set of pairs that always prefers legislation would measure nothing',
  },
  {
    query: 'what guidance has the ICO published on direct marketing?',
    surface: 'cross-stream',
    above: { label: 'ICO guidance', patterns: ci('^ico') },
    below: PECR_2003,
    why: 'asked for the GUIDANCE specifically; the underlying SI is context, not the answer',
  },
]

/** The distinct queries the preference set covers. */
export const PREFERENCE_QUERIES = [...new Set(PREFERENCES.map((p) => p.query))]
