/**
 * gold-queries.ts — the 30 GOLD_QUERIES queries encoded for automated scoring
 * (Search S1b, brief addition #4).
 *
 * The gold file's expected-sources are NAMED CITATIONS ("HA 1988 s.21"), not
 * corpus ids — so matching is inherently approximate. Each expected source
 * carries `patterns: RegExp[]`; it counts as RETRIEVED if ANY top-20 hit's
 * haystack matches ANY pattern. Haystack = `id \n sectionTitle \n body`.
 *
 * Pattern grounding (verified against live ids 19 Jun):
 *   legislation  id = `{corpus}:{type}/{year}/{number}:{section-ref}`
 *                e.g. primary-acts-pre-2000:ukpga/1988/50:section-21
 *   caselaw      id = `tna-caselaw:[2003] EWCA Civ 1768:N` (neutral citation inline)
 *   parliamentary id carries a date/title; body carries the substance
 * So legislation sources match on the gov.uk path (precise); parliamentary/bills
 * sources match on body/title text (the only signal — bill ids are opaque).
 *
 * These expected-sources are CCh's UNVALIDATED draft (the gold file says so):
 * the eyeball top-20 dump from score-fts.ts is what lets Charlie/CCh validate
 * this key. Numbers are provisional until then.
 */

export type GoldSource = { label: string; patterns: RegExp[] }

// ── v2 stream map (GOLD_QUERIES.md §A) ───────────────────────────────────────
// Every query targets a stream and is scored by that stream's metric. The
// load-bearing split is SPECIFIC-retrieval (want the exact item → recall@20) vs
// PRINCIPLE-retrieval (want a transferable lesson → 0–2 judgement).
export type Archetype = 'A' | 'B' | 'C' | 'D' | 'E' | 'F' | 'G' | 'H' | 'I' | 'J' | 'K'
export type Persona = 'H1' | 'H2'
export type Kind = 'specific' | 'principle'
export type Metric = 'recall@20' | 'lesson' // the two scoring paths (recall@20 vs 0–2 lesson)
export type Flag = 'BILLS' | 'INFORCE' | 'GRAPH' | 'PRINCIPLE-STREAM' | 'FOREIGN' | 'MECHANISM'

/** Per-archetype stream/kind/metric, straight from GOLD_QUERIES.md §A. */
export const ARCHETYPE_META: Record<Archetype, { stream: string; kind: Kind; metric: Metric }> = {
  A: { stream: 'legislation',                 kind: 'specific',  metric: 'recall@20' }, // + exact-pin
  B: { stream: 'legislation',                 kind: 'specific',  metric: 'recall@20' }, // stage-3/vector core target
  C: { stream: 'legislation + guidance',      kind: 'specific',  metric: 'recall@20' }, // breadth
  D: { stream: 'citation graph',              kind: 'specific',  metric: 'recall@20' },
  E: { stream: 'debates',                     kind: 'specific',  metric: 'recall@20' },
  F: { stream: 'bills + debates',             kind: 'specific',  metric: 'recall@20' },
  G: { stream: 'codes / guidance',            kind: 'principle', metric: 'lesson' },
  H: { stream: 'investigations / inquiries',  kind: 'principle', metric: 'lesson' },
  I: { stream: 'parliamentary evaluations',   kind: 'principle', metric: 'lesson' },
  J: { stream: 'web + foreign corpus',        kind: 'specific',  metric: 'recall@20' },
  K: { stream: 'legislation (section-level)', kind: 'specific',  metric: 'recall@20' }, // exact-pin
}

export type GoldQuery = {
  id: string
  archetype: Archetype
  persona: Persona
  query: string
  flags: Flag[]
  /** true = a known v1 engine floor (text search alone cannot answer) — report
   *  as floor, not failure. All archetype D ([GRAPH]); see brief addition #5. */
  floor: boolean
  // ── derived from ARCHETYPE_META at export (see below) ──
  stream: string
  kind: Kind
  metric: Metric
  /** true = counts toward the recall@20 HEADLINE now. false for: principle streams
   *  (G–I, metric 'lesson' — rubric not calibrated), and new SPECIFIC queries whose
   *  expected-sources are still TODO (B6, J1, K1, K2) — present but excluded until
   *  the validated answer-key lands (GOLD_QUERIES.md §C). Defaults to true for the
   *  v1 recall queries, so their numbers are unchanged. */
  scoreable: boolean
  /** principle streams (G–I): the transferable-lesson target the 0–2 rater judges
   *  against. Set by example once a principle-stream result exists (§C.3). */
  lessonTarget?: string
  /** expected-sources are placeholders pending the validated answer-key (§C). */
  todo?: boolean
  expected: GoldSource[]
}

// RAW carries everything except the ARCHETYPE_META-derived stream/kind/metric,
// which are grafted on in the GOLD export so each query need not repeat them.
// `scoreable` defaults to (metric === 'recall@20') unless a query overrides it.
type RawQuery = Omit<GoldQuery, 'stream' | 'kind' | 'metric' | 'scoreable'> & { scoreable?: boolean }

const ci = (...s: string[]) => s.map((x) => new RegExp(x, 'i'))

const RAW: RawQuery[] = [
  // ── Archetype A — known-item / citation lookup ───────────────────────────
  {
    id: 'A1', archetype: 'A', persona: 'H1', flags: ['INFORCE'], floor: false,
    query: 'Section 21 Housing Act 1988',
    expected: [
      { label: 'HA 1988 s.21 text', patterns: ci('ukpga/1988/50:section-21\\b') },
      { label: 'HA 1988 prospective abolition (Renters’ Rights Act 2025) [INFORCE]', patterns: ci('renters.{0,3}rights act 2025', 'ukpga/2025/') },
    ],
  },
  {
    id: 'A2', archetype: 'A', persona: 'H2', flags: [], floor: false,
    query: 'What does section 1 of the Theft Act 1968 actually say?',
    expected: [
      { label: 'TA 1968 s.1', patterns: ci('ukpga/1968/60:section-1\\b') },
      { label: 'TA 1968 ss.2–6 (dishonesty/appropriation defs)', patterns: ci('ukpga/1968/60:section-[2-6]\\b') },
    ],
  },
  {
    id: 'A3', archetype: 'A', persona: 'H1', flags: [], floor: false,
    query: 'Working Time Regulations 1998',
    expected: [
      { label: 'SI 1998/1833', patterns: ci('uksi/1998/1833') },
      { label: 'reg 4 / regs 13–13A', patterns: ci('uksi/1998/1833:regulation-(4|13)') },
    ],
  },
  {
    id: 'A4', archetype: 'A', persona: 'H1', flags: [], floor: false,
    query: 'Equality Act 2010 section 149',
    expected: [
      { label: 'EqA 2010 s.149 (PSED)', patterns: ci('ukpga/2010/15:section-149\\b') },
      { label: 'Sch 18 exceptions', patterns: ci('ukpga/2010/15:schedule-18') },
    ],
  },
  {
    id: 'A5', archetype: 'A', persona: 'H2', flags: [], floor: false,
    query: 'Find me the law that says you have to wear a seatbelt',
    expected: [
      { label: 'RTA 1988 ss.14–15', patterns: ci('ukpga/1988/52:section-1[45]\\b') },
      { label: 'Motor Vehicles (Wearing of Seat Belts) Regs 1993', patterns: ci('uksi/1993/176', 'wearing of seat belts.{0,40}1993') },
    ],
  },

  // ── Archetype B — concept search (vocabulary bridge) ──────────────────────
  {
    id: 'B1', archetype: 'B', persona: 'H2', flags: [], floor: false,
    query: 'Can my landlord kick me out without giving a reason?',
    expected: [
      { label: 'HA 1988 s.21', patterns: ci('ukpga/1988/50:section-21\\b') },
      { label: 'HA 1988 s.8 / Sch 2', patterns: ci('ukpga/1988/50:(section-8\\b|schedule-2)') },
      { label: 'Renters’ Rights Act 2025', patterns: ci('renters.{0,3}rights act 2025', 'ukpga/2025/') },
      { label: 'Deregulation Act 2015 ss.33–41 (retaliatory eviction)', patterns: ci('ukpga/2015/20:section-3[3-9]\\b', 'ukpga/2015/20:section-4[01]\\b') },
    ],
  },
  {
    id: 'B2', archetype: 'B', persona: 'H2', flags: [], floor: false,
    query: 'I want to stop people renting out whole houses as Airbnbs all year round',
    expected: [
      { label: 'Levelling-up and Regeneration Act 2023 (short-term lets)', patterns: ci('ukpga/2023/55', 'levelling.up and regeneration act 2023') },
      { label: 'Use Classes Order', patterns: ci('use classes.{0,20}order') },
      { label: 'Deregulation Act 2015 s.44 (London 90-night)', patterns: ci('ukpga/2015/20:section-44\\b') },
    ],
  },
  {
    id: 'B3', archetype: 'B', persona: 'H2', flags: [], floor: false,
    query: 'Is it illegal to take a photo of someone in public without their permission?',
    expected: [
      { label: 'Sexual Offences Act 2003 ss.67–67A (voyeurism)', patterns: ci('ukpga/2003/42:section-67') },
      { label: 'Protection from Harassment Act 1997', patterns: ci('ukpga/1997/40', 'protection from harassment act 1997') },
      { label: 'UK GDPR / DPA 2018', patterns: ci('ukpga/2018/12', 'data protection act 2018') },
    ],
  },
  {
    id: 'B4', archetype: 'B', persona: 'H1', flags: ['BILLS'], floor: false,
    query: 'Statutory duty of candour — who does it bind and where is it heading?',
    expected: [
      { label: 'HSCA 2008 (Regulated Activities) Regs 2014 reg 20', patterns: ci('uksi/2014/2936', 'duty of candour') },
      { label: 'Public Office (Accountability) Bill / Hillsborough Law [BILLS]', patterns: ci('hillsborough law', 'public office.{0,30}accountability') },
    ],
  },
  {
    id: 'B5', archetype: 'B', persona: 'H2', flags: [], floor: false,
    query: 'What are the rules about how much noise my neighbours can make at night?',
    expected: [
      { label: 'EPA 1990 Part III (statutory nuisance)', patterns: ci('ukpga/1990/43:(section-7[9-9]|section-80|part-3|part-iii)', 'statutory nuisance') },
      { label: 'Noise Act 1996', patterns: ci('ukpga/1996/37', 'noise act 1996') },
      { label: 'Control of Pollution Act 1974 s.60', patterns: ci('ukpga/1974/40:section-60\\b') },
    ],
  },

  // ── Archetype C — policy-area sweep ───────────────────────────────────────
  {
    id: 'C1', archetype: 'C', persona: 'H1', flags: [], floor: false,
    query: 'Everything currently regulating short-term holiday lets in England',
    expected: [
      { label: 'Levelling-up and Regeneration Act 2023', patterns: ci('ukpga/2023/55', 'levelling.up and regeneration act 2023') },
      { label: 'Deregulation Act 2015 s.44 (London 90-night)', patterns: ci('ukpga/2015/20:section-44\\b') },
      { label: 'FHL tax treatment (Finance Act)', patterns: ci('furnished holiday let') },
    ],
  },
  {
    id: 'C2', archetype: 'C', persona: 'H2', flags: [], floor: false,
    query: 'What laws govern e-scooters?',
    expected: [
      { label: 'RTA 1988 (motor vehicle classification)', patterns: ci('ukpga/1988/52', 'road traffic act 1988') },
      { label: 'Electrically Assisted Pedal Cycles Regs 1983', patterns: ci('uksi/1983/1168', 'electrically assisted pedal cycles') },
      { label: 'e-scooter trial SIs (2020–)', patterns: ci('e-scooter', 'electric scooter trial') },
    ],
  },
  {
    id: 'C3', archetype: 'C', persona: 'H1', flags: ['INFORCE'], floor: false,
    query: 'The statutory framework for adult social care funding in England',
    expected: [
      { label: 'Care Act 2014 Part 1 (ss.14–18)', patterns: ci('ukpga/2014/23:section-1[4-8]\\b') },
      { label: 'Care and Support (Charging) Regs 2014', patterns: ci('uksi/2014/2672', 'care and support.{0,40}charging') },
      { label: 'cap provisions / commencement [INFORCE]', patterns: ci('ukpga/2014/23:section-15\\b', 'care cap') },
    ],
  },
  {
    id: 'C4', archetype: 'C', persona: 'H1', flags: [], floor: false,
    query: 'What duties do water companies have about sewage discharges, and where do they come from?',
    expected: [
      { label: 'Water Industry Act 1991 (s.94 etc.)', patterns: ci('ukpga/1991/56:section-94\\b', 'water industry act 1991') },
      { label: 'Environment Act 2021 storm overflow duties', patterns: ci('ukpga/2021/30:section-141', 'storm overflow') },
      { label: 'Urban Waste Water Treatment Regs 1994', patterns: ci('uksi/1994/2841', 'urban waste water') },
    ],
  },
  {
    id: 'C5', archetype: 'C', persona: 'H2', flags: [], floor: false,
    query: 'What protections do people who live in park homes / mobile homes have?',
    expected: [
      { label: 'Mobile Homes Act 1983', patterns: ci('ukpga/1983/34', 'mobile homes act 1983') },
      { label: 'Mobile Homes Act 2013', patterns: ci('ukpga/2013/14', 'mobile homes act 2013') },
      { label: 'Caravan Sites Act 1968', patterns: ci('ukpga/1968/52', 'caravan sites act 1968') },
    ],
  },

  // ── Archetype D — graph (amendments/powers/applications) — ALL [GRAPH] FLOOR
  {
    id: 'D1', archetype: 'D', persona: 'H1', flags: ['GRAPH'], floor: true,
    query: 'What has amended section 21 of the Housing Act 1988 since 2015?',
    expected: [
      { label: 'Deregulation Act 2015 ss.33–41', patterns: ci('ukpga/2015/20:section-3[3-9]\\b') },
      { label: 'Renters’ Rights Act 2025 (prospective repeal)', patterns: ci('ukpga/2025/', 'renters.{0,3}rights act 2025') },
    ],
  },
  {
    id: 'D2', archetype: 'D', persona: 'H1', flags: ['GRAPH'], floor: true,
    query: 'List the statutory instruments made under the Building Safety Act 2022',
    expected: [
      { label: 'Building Safety Act 2022', patterns: ci('ukpga/2022/30', 'building safety act 2022') },
      { label: 'Higher-Risk Buildings regs', patterns: ci('higher.risk buildings') },
    ],
  },
  {
    id: 'D3', archetype: 'D', persona: 'H1', flags: ['GRAPH', 'INFORCE'], floor: true,
    query: 'Which provisions of the Environment Act 2021 are not yet in force?',
    expected: [
      { label: 'Environment Act 2021', patterns: ci('ukpga/2021/30', 'environment act 2021') },
    ],
  },
  {
    id: 'D4', archetype: 'D', persona: 'H2', flags: ['GRAPH'], floor: true,
    query: 'Has the Dangerous Dogs Act 1991 been changed since it was passed — what changed and why?',
    expected: [
      { label: 'Dangerous Dogs Act 1991', patterns: ci('ukpga/1991/65', 'dangerous dogs act 1991') },
      { label: 'ABCPA 2014 s.106', patterns: ci('ukpga/2014/12:section-106\\b', 'anti-social behaviour, crime and policing act 2014') },
      { label: 'XL Bully designation order 2023', patterns: ci('xl bully', 'dangerous dogs.{0,30}designated types') },
    ],
  },
  {
    id: 'D5', archetype: 'D', persona: 'H1', flags: ['GRAPH'], floor: true,
    query: "What case law has considered 'philosophical belief' under section 10 of the Equality Act 2010?",
    expected: [
      { label: 'Grainger plc v Nicholson', patterns: ci('grainger', 'nicholson') },
      { label: 'Forstater v CGD Europe', patterns: ci('forstater') },
    ],
  },

  // ── Archetype E — legislative intent (Hansard) ────────────────────────────
  {
    id: 'E1', archetype: 'E', persona: 'H1', flags: [], floor: false,
    query: 'What did ministers say the under-occupancy provisions of the Welfare Reform Act 2012 were intended to achieve?',
    expected: [
      { label: 'Welfare Reform Act 2012', patterns: ci('ukpga/2012/5', 'welfare reform act 2012') },
      { label: 'Hansard 2011–12 (under-occupancy / bedroom tax)', patterns: ci('under-occupancy', 'bedroom tax', 'spare room subsidy') },
    ],
  },
  {
    id: 'E2', archetype: 'E', persona: 'H2', flags: [], floor: false,
    query: 'Why was the sugar tax designed as a levy on manufacturers instead of a tax at the till?',
    expected: [
      { label: 'Finance Act 2017 Part 2 (Soft Drinks Industry Levy)', patterns: ci('ukpga/2017/10', 'soft drinks industry levy') },
      { label: 'Budget 2016 / Finance Bill 2017 debate', patterns: ci('soft drinks', 'sugar') },
    ],
  },
  {
    id: 'E3', archetype: 'E', persona: 'H1', flags: [], floor: false,
    query: 'What assurances were given during the passage of the Investigatory Powers Act 2016 about safeguards on bulk powers?',
    expected: [
      { label: 'Investigatory Powers Act 2016', patterns: ci('ukpga/2016/25', 'investigatory powers act 2016') },
      { label: 'Hansard double-lock / IPC oversight', patterns: ci('double.lock', 'bulk powers', 'investigatory powers commissioner') },
    ],
  },
  {
    id: 'E4', archetype: 'E', persona: 'H2', flags: [], floor: false,
    query: 'Why does the indoor smoking ban not apply to private homes? What was said when it was passed?',
    expected: [
      { label: 'Health Act 2006 Part 1', patterns: ci('ukpga/2006/28', 'health act 2006') },
      { label: '2005–06 debate on scope/exemptions', patterns: ci('smoke.free', 'smoking ban', 'enclosed public') },
    ],
  },
  {
    id: 'E5', archetype: 'E', persona: 'H1', flags: [], floor: false,
    query: 'When the Hunting Act 2004 was passed, what did ministers say about how it would be enforced?',
    expected: [
      { label: 'Hunting Act 2004 ss.1–6', patterns: ci('ukpga/2004/37', 'hunting act 2004') },
      { label: 'Hansard 2003–04 enforcement passages', patterns: ci('hunting with dogs', 'fox.?hunting') },
    ],
  },

  // ── Archetype F — precedent / prior attempts ([BILLS], score for real) ─────
  {
    id: 'F1', archetype: 'F', persona: 'H2', flags: ['BILLS'], floor: false,
    query: 'Has anyone tried to ban single-use plastics completely? What happened?',
    expected: [
      { label: 'Plastics / Wet Wipes PMBs', patterns: ci('wet wipes', 'single.use plastic') },
      { label: 'EPA 1990 s.140 SIs (straws/stirrers/plates)', patterns: ci('uksi/2020/', 'plastic straws', 'single.use plastic') },
    ],
  },
  {
    id: 'F2', archetype: 'F', persona: 'H1', flags: ['BILLS'], floor: false,
    query: 'Previous Private Members’ Bills attempting to restrict fireworks sales, and why they failed',
    expected: [
      { label: 'Repeated Fireworks Bills', patterns: ci('fireworks bill', 'fireworks') },
      { label: 'Fireworks Act 2003', patterns: ci('ukpga/2003/22', 'fireworks act 2003') },
    ],
  },
  {
    id: 'F3', archetype: 'F', persona: 'H2', flags: ['BILLS'], floor: false,
    query: 'I want a law making landlords accept tenants with pets. Has this been tried?',
    expected: [
      { label: 'Dogs and Domestic Animals (Accommodation) Bill', patterns: ci('domestic animals.{0,30}accommodation', 'pets.{0,20}tenan') },
      { label: 'Renters (Reform) Bill 2023 / Renters’ Rights Act 2025 pets', patterns: ci('renters.{0,10}reform', 'renters.{0,3}rights act 2025') },
    ],
  },
  {
    id: 'F4', archetype: 'F', persona: 'H1', flags: ['BILLS'], floor: false,
    query: 'Attempts since 2010 to introduce proportional representation for Westminster elections',
    expected: [
      { label: 'PR / PMB attempts', patterns: ci('proportional representation') },
      { label: 'Parliamentary Voting System and Constituencies Act 2011', patterns: ci('ukpga/2011/1\\b', 'parliamentary voting system') },
    ],
  },
  {
    id: 'F5', archetype: 'F', persona: 'H2', flags: ['BILLS'], floor: false,
    query: 'Has Parliament ever tried to make first aid training compulsory in schools?',
    expected: [
      { label: 'Emergency First Aid Education Bill 2015', patterns: ci('first aid.{0,20}education', 'emergency first aid') },
      { label: 'Children and Social Work Act 2017 s.34 (statutory RSHE)', patterns: ci('ukpga/2017/16:section-34\\b', 'relationships.{0,10}sex.{0,10}education', 'RSHE') },
    ],
  },

  // ══ v2 additions (GOLD_QUERIES.md v2, 2026-06-30) ═══════════════════════════
  // B6 + J/K carry TODO expected-sources (scoreable:false) → present but excluded
  // from the headline until the validated answer-key lands (§C). G–I are the
  // principle streams (metric 'lesson', scoreable:false) — scaffold only.

  // ── B6 — validated MiFID lay-vocabulary test · legislation · recall@20 ─────
  //    Answer-key filled + verified present in corpus_sections (2026-07-01). NO
  //    coverage gaps — all 6 sources are ingested (incl. fca-handbook). NOTE:
  //    FSMA 2023 uses enacted-CLML paragraph refs (ukpga/2023/29:pNNNNN), not
  //    :section-N, so the pin is on the act gid (recall@20 counts any leaf).
  {
    id: 'B6', archetype: 'B', persona: 'H2', flags: [], floor: false, scoreable: true,
    query: 'I want to revoke MiFID II',
    expected: [
      { label: 'FSMA 2023 — revocation framework (ukpga/2023/29; s.1+Sch 1, Sch 2 UK MiFID amendments)', patterns: ci('ukpga/2023/29:') },
      { label: 'FSMA 2000 (Markets in Financial Instruments) Regs 2017 (uksi/2017/701)', patterns: ci('uksi/2017/701:') },
      { label: 'Retained/assimilated MiFIR — Reg (EU) 600/2014 (eur/2014/600)', patterns: ci('eur/2014/600:') },
      { label: 'FCA Handbook COBS + SYSC (fca-handbook)', patterns: ci('fca-handbook:cobs', 'fca-handbook:sysc') },
      { label: 'FSMA 2000 — framework Act (ukpga/2000/8)', patterns: ci('ukpga/2000/8:') },
      { label: 'Post-Brexit onshoring SIs (uksi/2019/1390; uksi/2021/1388)', patterns: ci('uksi/2019/1390:', 'uksi/2021/1388:') },
    ],
  },

  // ── Archetype G — implementation pattern · codes/guidance · 0–2 lesson [PRINCIPLE-STREAM]
  {
    id: 'G1', archetype: 'G', persona: 'H1', flags: ['PRINCIPLE-STREAM'], floor: false,
    query: 'A regulator is handed a new statutory duty with no extra budget — how has that gone before?',
    lessonTarget: 'Under-resourced-duty patterns drawn from across domains (the transferable lesson, not the topic).',
    expected: [],
  },
  {
    id: 'G2', archetype: 'G', persona: 'H2', flags: ['PRINCIPLE-STREAM', 'MECHANISM'], floor: false,
    query: 'If we make companies report something, how do we make sure they actually do it?',
    lessonTarget: 'Enforcement/compliance patterns from duty-to-report regimes (financial, safeguarding, environmental).',
    expected: [],
  },
  {
    id: 'G3', archetype: 'G', persona: 'H1', flags: ['PRINCIPLE-STREAM', 'MECHANISM'], floor: false,
    query: "How is a 'fit and proper person' test typically operated by regulators in practice?",
    lessonTarget: 'Cross-domain implementation of a recurring mechanism.',
    expected: [],
  },

  // ── Archetype H — institutional behaviour · investigations/inquiries · 0–2 lesson [PRINCIPLE-STREAM]
  {
    id: 'H1', archetype: 'H', persona: 'H1', flags: ['PRINCIPLE-STREAM'], floor: false,
    query: 'When an arms-length body fails, how do departments typically respond, and how fast?',
    lessonTarget: 'Behavioural regularity across inquiries (e.g. Horizon and others) — the pattern, not one case.',
    expected: [],
  },
  {
    id: 'H2', archetype: 'H', persona: 'H2', flags: ['PRINCIPLE-STREAM'], floor: false,
    query: 'What usually goes wrong when government runs a big IT programme?',
    lessonTarget: 'Cross-inquiry IT-failure patterns (not one named project).',
    expected: [],
  },
  {
    id: 'H3', archetype: 'H', persona: 'H1', flags: ['PRINCIPLE-STREAM', 'MECHANISM'], floor: false,
    query: 'Where inquiries have examined regulatory capture, what mechanisms recur?',
    lessonTarget: 'Transferable regulatory-capture patterns.',
    expected: [],
  },

  // ── Archetype I — evaluation / what works · parliamentary evaluations · 0–2 lesson [PRINCIPLE-STREAM]
  {
    id: 'I1', archetype: 'I', persona: 'H1', flags: ['PRINCIPLE-STREAM'], floor: false,
    query: "What distinguishes regulatory-enforcement laws that worked from ones that didn't?",
    lessonTarget: 'PAC/NAO/post-legislative-scrutiny patterns of effective vs ineffective enforcement law.',
    expected: [],
  },
  {
    id: 'I2', archetype: 'I', persona: 'H2', flags: ['PRINCIPLE-STREAM', 'MECHANISM'], floor: false,
    query: 'Do sunset clauses actually work — do laws get reviewed when they are meant to?',
    lessonTarget: 'Cross-domain evaluation of a mechanism (sunset/review clauses).',
    expected: [],
  },
  {
    id: 'I3', archetype: 'I', persona: 'H1', flags: ['PRINCIPLE-STREAM'], floor: false,
    query: 'When has post-legislative scrutiny found a law had significant unintended consequences, and of what kind?',
    lessonTarget: 'Transferable unintended-consequence patterns.',
    expected: [],
  },

  // ── Archetype J — comparative / foreign law · web + foreign corpus · recall@20 [FOREIGN] (deferred)
  {
    id: 'J1', archetype: 'J', persona: 'H1', flags: ['FOREIGN'], floor: false, scoreable: false, todo: true,
    query: 'How do other countries regulate short-term lets — and what worked?',
    expected: [
      { label: 'TODO (deferred): comparator regimes — EU registration models, US city caps', patterns: [] },
    ],
  },

  // ── Archetype K — precise amendable section · legislation (section-level) · exact-pin
  {
    id: 'K1', archetype: 'K', persona: 'H2', flags: [], floor: false, scoreable: false, todo: true,
    query: 'I want to remove the no-fault eviction route — which exact provision do I amend?',
    expected: [
      { label: 'TODO (validate): HA 1988 s.21 (exact-pin) + Renters’ Rights Act 2025 repealing provision', patterns: [] },
    ],
  },
  {
    id: 'K2', archetype: 'K', persona: 'H1', flags: ['BILLS'], floor: false, scoreable: false, todo: true,
    query: 'To add a statutory duty of candour for public bodies, where would it slot in?',
    expected: [
      { label: 'TODO (validate): HSCA 2008 (Regulated Activities) Regs reg 20 + Public Office (Accountability) Bill', patterns: [] },
    ],
  },
]

/** GOLD = RAW with per-archetype stream/kind/metric grafted on, and `scoreable`
 *  defaulted to (metric === 'recall@20') unless the query overrides it. The v1
 *  recall queries thus keep scoreable=true, so their scores are unchanged; the new
 *  principle (G–I) and TODO (B6/J1/K1/K2) queries land scoreable=false. */
export const GOLD: GoldQuery[] = RAW.map((q) => {
  const meta = ARCHETYPE_META[q.archetype]
  return { ...q, ...meta, scoreable: q.scoreable ?? (meta.metric === 'recall@20') }
})
