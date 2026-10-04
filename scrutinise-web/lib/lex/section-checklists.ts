// ─────────────────────────────────────────────────────────────────────────────
// 26-P ADDENDUM (CCh follow-up) — A CHECKLIST PER KERNEL SECTION, AS A PATTERN.
//
// The worklist ("What to do next") can carry a checklist for each kernel section. This is the registry, as DATA, so
// the worklist, the guide, the FAQ, the "Ask Lex" instruction and the check all read the SAME five sentences and
// cannot say different things (CLAUDE.md §26.5 — one definition). Diagnosis is built; the other two are described in
// docs/LEX_26P_ADDENDUM_REPORT.md and are an entry here plus their own `ask` instructions — not new machinery.
//
// ⚠ THE PRODUCT DOES NOT NAG. A check is a tick box the user may or may not press. "Confirm these causes" stays
// available with every check unticked and says, beside it, how many are not yet done — `notYetDoneLine` — and nothing
// else: no modal, no disabled button, no second warning. The user decides.
//
// ⚠ "ASK LEX" CHANGES NOTHING. Each check carries an instruction Lex follows through a READ-ONLY turn: it applies the
// test to the idea's current rows and reports observations and proposals in its reply. It is not offered a single tool
// that writes, and its reply goes through the same claim-vs-tool-result check as every other reply (agent/honesty.ts).
//
// ⚠ CLAUDE.md §27 — the questions below describe the SHAPE of the test; none supplies a specimen sentence a model could
// lift into an idea.
//
// Pure and import-free: used by a client component (CLAUDE.md §28), by routes and by checks.
// ─────────────────────────────────────────────────────────────────────────────

export type KernelSectionKey = 'DIAGNOSIS' | 'GUIDING_POLICY' | 'COHERENT_ACTIONS'

export interface ChecklistCheck {
  /** Stored as the tick's `itemKey` (`IdeaWorklistTick`, ≤200 chars): `check:<section>:<slug>`. */
  key: string
  /** The name of the test — the one or two words the user sees on the row. */
  title: string
  /** The question, in the user's terms. THE ONE SENTENCE the worklist, the guide and the FAQ all print. */
  question: string
  /** What Lex is asked to do when the user presses "Ask Lex" — a READ-ONLY instruction. */
  askLex: string
  /** A fuller explanation for the "How to find the right cause" guide and the FAQ. Elaborates `question`; never replaces it. */
  guide: string
}

export interface SectionChecklist {
  section: KernelSectionKey
  /** The heading over the checks in the worklist. */
  heading: string
  /** One line under it. */
  blurb: string
  /** The Lex page the checks belong to (`CanonicalPage.key`). */
  page: KernelSectionKey
  /**
   * When the checklist is shown. DATA, so the next section's checklist is a registry entry: it is shown while the
   * named field is NOT in one of `untilStatusIn`, and (if `needsRows` is set) only when that kind of row exists.
   */
  shownWhile: { fieldKey: string; untilStatusIn: string[]; needsRows?: 'causes' | 'policyOptions' | 'actions' }
  /** The button the "N of M checks not yet done" line sits beside, in words — for the check and the FAQ. */
  confirmLabel: string
  checks: ChecklistCheck[]
}

const READ_ONLY =
  ' This is a READ-ONLY request: report what you find as observations, and offer any change only as a proposal in your '
  + 'reply. Do not call any tool that changes the idea. Do not claim you have changed anything. Do not say the test is '
  + 'passed or failed as a verdict — say what you see and what you are unsure of.'

export const DIAGNOSIS_CHECKLIST: SectionChecklist = {
  section: 'DIAGNOSIS',
  page: 'DIAGNOSIS',
  heading: 'Before you confirm the causes',
  blurb: 'Five checks on the causes. Tick each when you are satisfied; none is required.',
  shownWhile: { fieldKey: 'causes', untilStatusIn: ['ACCEPTED', 'SKIPPED'], needsRows: 'causes' },
  confirmLabel: 'Confirm these causes',
  checks: [
    {
      key: 'check:diagnosis:five-whys',
      title: 'Five whys',
      question: 'For each cause, have you kept asking why until you reached something you could actually change?',
      askLex:
        'Apply the five-whys test to each of my current causes: for each, say whether the chain of whys stops at something '
        + 'that could actually be changed, or stops earlier, and what the next why might be. Use only the causes and evidence '
        + 'already on the idea.' + READ_ONLY,
      guide:
        'Start from the problem and ask why it happens. Then ask why of that answer, and again. Five is a guide, not a rule: '
        + 'stop when the next “why” has nothing to support it, and write each step down so someone else can challenge it. '
        + 'A chain you can inspect is worth more than one answer you cannot.',
    },
    {
      key: 'check:diagnosis:symptom-or-cause',
      title: 'Symptom or cause',
      question: 'If we solved this cause, would the problem go?',
      askLex:
        'Apply the symptom-or-cause test to each of my current causes: if this cause were solved, would the problem go away, '
        + 'or would it return in another form? Say which causes look like symptoms or contributing factors, and why.' + READ_ONLY,
      guide:
        'This is the test that matters most. If solving a cause would not make the problem go — or it would come back in '
        + 'another form — you have found a symptom, or one contributing factor. Go one “why” deeper.',
    },
    {
      key: 'check:diagnosis:coverage',
      title: 'Coverage',
      question: 'People, process, incentives, information, resources, rules: is there an area nobody has looked at?',
      askLex:
        'Check coverage of my current causes across six areas: people, process, incentives, information, resources and rules. '
        + 'For each area say whether any cause covers it, and name the areas nobody has looked at. An empty area is a finding, '
        + 'not a failure.' + READ_ONLY,
      guide:
        'Look for candidate causes under each of six headings: people, process, incentives, information, resources and '
        + 'rules. If a heading turns up nothing, say so rather than skipping it — an empty heading is a finding.',
    },
    {
      key: 'check:diagnosis:contributing-or-root',
      title: 'Contributing or root',
      question: 'Several causes may be real; which one, removed, changes most?',
      askLex:
        'Separate my current causes into contributing and root: several may be real. Say which one, if removed, you think would '
        + 'change the problem most, and what evidence would overturn that. Do not claim a proved single root cause; this is '
        + 'a candidate, and choosing the pivotal obstacle is mine.' + READ_ONLY,
      guide:
        'A contributing cause helped the problem happen; a root cause is the reason that condition was there at all. Keep '
        + 'the two apart: dealing only with contributing causes rarely stops the problem returning. Many problems have '
        + 'several contributing causes and no single root, so this is a candidate you choose, not a result you prove.',
    },
    {
      key: 'check:diagnosis:systems-before-blame',
      title: 'Systems before blame',
      question: 'Is any cause really “a person failed” where the system let them?',
      askLex:
        'Look at my current causes for any that put the failure on a person or a group where the process, incentives, rules or '
        + 'information may have allowed or encouraged it. For each, say what in the system might sit behind it.' + READ_ONLY,
      guide:
        '“Someone got it wrong” is almost never the cause. Ask why the system let it happen: what in the process, the '
        + 'incentives, the rules or the information made that mistake easy, or the right choice hard? A cause in a person can '
        + 'only be fixed by replacing the person; a cause in a system can be fixed.',
    },
  ],
}

/** The registry. A section with no entry has no checklist; the worklist asks this, it never hard-codes Diagnosis. */
export const SECTION_CHECKLISTS: Readonly<Partial<Record<KernelSectionKey, SectionChecklist>>> = {
  DIAGNOSIS: DIAGNOSIS_CHECKLIST,
}

export const allChecklists = (): SectionChecklist[] => Object.values(SECTION_CHECKLISTS).filter((c): c is SectionChecklist => !!c)

/** Every tick key the registry owns — the PATCH route refuses anything else, so this cannot be used to tick arbitrary keys. */
export const allCheckKeys = (): string[] => allChecklists().flatMap((c) => c.checks.map((k) => k.key))

export function findCheck(key: string): { checklist: SectionChecklist; check: ChecklistCheck } | null {
  for (const checklist of allChecklists()) {
    const check = checklist.checks.find((k) => k.key === key)
    if (check) return { checklist, check }
  }
  return null
}

/** How many of a checklist's checks are not ticked. */
export const checksNotDone = (c: SectionChecklist, ticked: ReadonlySet<string>): number => c.checks.filter((k) => !ticked.has(k.key)).length

/** The ONLY thing said beside "Confirm these causes": a count, in words, and no instruction. null when all are done. */
export function notYetDoneLine(notDone: number, total: number): string | null {
  return notDone > 0 ? `${notDone} of ${total} checks not yet done` : null
}

/** The five questions as the FAQ and the guide print them — generated from the registry, so they cannot drift. */
export const checksAsLines = (c: SectionChecklist): string[] => c.checks.map((k) => `**${k.title}** — ${k.question}`)
