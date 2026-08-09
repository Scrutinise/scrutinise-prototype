// ─────────────────────────────────────────────────────────────────────────────
// "Reading legislation: a working guide" — the public FAQ section.
//
// Sourced from docs/FAQ_READING_LEGISLATION.md (CCh, 5 Aug 2026), following the
// same convention as lib/faq-content.ts: the markdown lives in the repo as prose,
// and this module is what the app renders.
//
// TWO DELIBERATE DIFFERENCES FROM THE SOURCE DOCUMENT.
//
//  1. The `<cite index="45-1">…</cite>` markers are STRIPPED. They are CCh's
//     research provenance — an index into the sources the draft was written
//     from — and mean nothing to a reader. They must not be published as-is, and
//     rendering them through dangerouslySetInnerHTML (which is how the FAQ
//     renderer works) would have put stray markup on a public page.
//     `check:legislation-guide` fails if one ever comes back.
//
//  2. Sections are DATA, not headings parsed out of a blob. Every suggestion an
//     expert files is stored against a section `key`, so the keys have to be
//     stable across rewording — a suggestion about "§5 leverage" must not be
//     orphaned the day someone re-titles §5. Add a section by adding an entry;
//     never renumber an existing `key`.
//
// This is a DRAFT SEEKING CORRECTION and the page says so at the top, in the
// middle and at the end. That is not modesty: it is published law-adjacent
// guidance written by non-lawyers, and a reader who mistakes it for settled
// professional advice is the one harm this page can actually do.
// ─────────────────────────────────────────────────────────────────────────────

export interface GuideSection {
  /** Stable identifier — stored on every suggestion. NEVER change one in place. */
  key: string
  /** Display number, purely cosmetic. */
  number: string
  title: string
  /** Markdown-ish body: paragraphs, `-` bullets, `1.` lists, **bold**, *italic*. */
  body: string
}

export const GUIDE_TITLE = 'Reading legislation: a working guide'

export const GUIDE_STATUS =
  'This is a draft, published for correction. It was written for Scrutinise by a non-lawyer in ' +
  'August 2026 and has not yet been reviewed by practising counsel. Use it to find your footing in ' +
  'an Act — not as legal advice, and not as a substitute for taking advice where the answer matters.'

export const GUIDE_INTRO = `**What we are trying to do — and what we are trying not to do.** Scrutinise's position is that legal opacity has a cost to democracy: it concentrates interpretation in a professional class and exhausts everyone else, including most legislators. The answer is *not* to replace the statute with an AI summary — that swaps one intermediary for another and leaves the reader no more capable. The aim is to put an ordinary intelligent person in direct contact with the actual words, moving faster and seeing more, the way they would if a senior practitioner were sitting beside them saying *"read that bit first, and here's why."*

**If you know this material better than we do, please say so.** Corrections are welcome anywhere in the guide, and the questions we most want answered are collected at the end.`

export const GUIDE_SECTIONS: GuideSection[] = [
  {
    key: 'what-am-i-holding',
    number: '1',
    title: 'Before you read a word: what am I actually holding?',
    body: `Three questions, in this order, before reading any provision:

- **Is this in force?** An Act on the page may not be law yet. Commencement provisions often bring an Act into force in stages, sometimes years apart, sometimes never for particular sections.
- **Is this the current text?** Legislation is amended constantly. The version you are reading may predate amendments that change the answer entirely.
- **Does it apply here?** Extent (which of the four nations) and application (to whom, in what circumstances) are usually near the end of an Act and routinely missed.

*Getting these wrong wastes more time than any other error, because the reading itself may be flawless.*`,
  },
  {
    key: 'anatomy',
    number: '2',
    title: "The anatomy — and what is and isn't the law",
    body: `An Act is not prose; it is a structured instrument, and the parts do different jobs.

The body divides into sections, subsections, paragraphs and sub-paragraphs, and section headings are meant to indicate what the section covers — though not always clearly. Parts and Chapters group sections thematically, and the arrangement itself carries meaning: a provision read outside its Part can mislead.

What counts as part of the Act matters for interpretation:

- **Schedules are part of the Act.** They sit at the end containing supplementary detail, forms or exceptions, are fully part of the statute, and can clarify or expand the main body. They routinely carry the substance — the rates, the lists, the exemptions — and are the single most-skipped component.
- **Headings and marginal notes are a grey area.** How far they may be used in interpretation is not settled. Useful for navigation; treat with care in argument.
- **Explanatory Notes are not the Act.** Modern statutes have them, they explain each section in plain English, and they are hugely helpful — but they are not technically part of the statute. Excellent for orientation; never a substitute for the words.`,
  },
  {
    key: 'definitions',
    number: '3',
    title: 'Definitions first — the habit that saves the most time',
    body: `Always check the definitions before the operative provisions. A statute frequently uses ordinary words in ways that are anything but ordinary, and the defining provision may sit far from the section you care about — sometimes in a different Part, sometimes in a schedule glossary, sometimes in a different Act altogether.

The distinction that changes outcomes:

- **"means"** — exhaustive. The term covers that and nothing else.
- **"includes"** — non-exhaustive. The listed items are examples; the term may extend further.

Reading the statute as a whole — long title, structure of Parts and Chapters — and checking the interpretation section for defined terms, noting "means" versus "includes", is the standard opening sequence.`,
  },
  {
    key: 'duty-and-power',
    number: '4',
    title: 'Duty, power, and the small words that do the heavy lifting',
    body: `- **"must"** creates an obligation. **"may"** confers a discretion. In policy terms this is often the whole argument: a regulator that *may* act and doesn't is a different problem from one that *must* act and fails.
- **"shall"** appears throughout older legislation and is ambiguous between duty and mere futurity. The Office of the Parliamentary Counsel — which has drafted government bills since 1869 — now advises against it. When you meet it in an older Act, the sense has to be read from context.
- **"and" versus "or"**, and where a qualifier attaches, decide whether conditions are cumulative or alternative — and whether an exception swallows the rule.
- Punctuation is read alongside syntax, headings and structure: a misplaced comma can decide whether a limitation applies to every preceding category or only the last.`,
  },
  {
    key: 'leverage',
    number: '5',
    title: 'Where the leverage is',
    body: `For someone trying to *change* the law rather than merely apply it, the practical question is: what is the smallest textual change that produces the intended effect? In our experience the candidates are consistent:

1. **A definition** — alter what a term covers and every provision using it moves at once.
2. **A threshold or figure** — a rate, limit, period or floor. Frequently the smallest viable amendment.
3. **A duty/power switch** — "may" to "must".
4. **An existing delegated power** — if a Minister can already act by regulation, no new primary legislation is needed. *Checking this first can make an entire legislative proposal unnecessary.*
5. **An exemption or exclusion** — often more tractable than the main rule.
6. **The enforcement provision** — a right without a remedy changes little; behaviour follows enforcement.
7. **Commencement and sunset** — timing as a lever.

*This list is the part of the guide we are least confident about, and the part we would most value being corrected.*`,
  },
  {
    key: 'reading-sequence',
    number: '6',
    title: 'Reading a provision: a working sequence',
    body: `1. Confirm it is in force, current, and applies (§1).
2. Read the Part it sits in, and the section headings around it — what job does this provision do here?
3. Collect the controlling definitions before parsing the operative words.
4. Parse the sentence structure: who must/may do what, on what trigger, subject to what exception.
5. Follow every cross-reference and every schedule the section invokes — the exception usually lives there.
6. Ask what happens if the duty is breached: is there a sanction, a remedy, a regulator, or nothing?
7. Only then consult the Explanatory Notes and any commentary — as a check on your reading, not a substitute.
8. Finally, look for how courts have read it. A provision with settled interpretation and one that is contested are different objects for a proposal.`,
  },
  {
    key: 'ambiguity',
    number: '7',
    title: "When the words genuinely don't settle it",
    body: `Courts approach ambiguity through established techniques — reading purposively rather than only literally, reading provisions in the context of the whole Act, and applying long-standing presumptions (against retrospective effect, against ousting the courts' jurisdiction, in favour of construing penal provisions strictly). External materials, including Parliamentary debate in defined circumstances, may be admissible within limits.

*This section is deliberately thin. It is where lay confidence most exceeds lay competence, and we would rather it were written by counsel than by us. We would particularly welcome guidance on what a non-lawyer should attempt themselves and where they should stop and take advice.*`,
  },
  {
    key: 'traps',
    number: '8',
    title: 'Common traps',
    body: `- Reading an unamended version and not knowing it.
- Missing a schedule that contains the actual rule.
- Assuming a defined term means what it means in ordinary speech.
- Treating Explanatory Notes as the law.
- Reading a section without its exceptions.
- Assuming a duty implies a remedy.
- Assuming primary legislation is needed when a delegated power already exists.
- Assuming UK-wide application.`,
  },
]

/** The open questions, shown at the end and offered as the default in the form. */
export const REVIEWER_QUESTIONS: string[] = [
  '**The leverage list (§5)** — what have we got wrong, and what have we missed? This is the section that most directly shapes what users propose.',
  '**§7** — what is the right amount for a non-lawyer to attempt, and what is the clearest honest statement of where to stop?',
  '**The reading sequence (§6)** — is this how you actually do it, or is it how it gets taught?',
  '**What would you tell a bright non-lawyer that nobody writes down?** The tacit craft is precisely what we are trying to make available, and it is the hardest to find in print.',
  '**Where is this guidance actively dangerous** — where would following it produce a confident wrong answer?',
  '**Anything here that is simply incorrect.** Please be blunt; it will be published and it will be used.',
]

// ── the section list the suggestion form and the API agree on ────────────────

/** "Not about one section" — the default, and the home for a general correction. */
export const GENERAL_SECTION_KEY = 'general'

export interface SectionOption {
  key: string
  label: string
}

/**
 * Every value the form may submit and the API will accept, in display order.
 * ONE source of truth: the API validates against this list, so a suggestion can
 * never be stored against a section that does not exist.
 */
export const SECTION_OPTIONS: SectionOption[] = [
  { key: GENERAL_SECTION_KEY, label: 'The guide as a whole / not about one section' },
  ...GUIDE_SECTIONS.map((s) => ({ key: s.key, label: `§${s.number}. ${s.title}` })),
]

export function sectionLabel(key: string): string | null {
  return SECTION_OPTIONS.find((o) => o.key === key)?.label ?? null
}
