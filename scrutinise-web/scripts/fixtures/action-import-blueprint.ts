// THE FIXTURE FOR check:lex-26s — a HAND-MADE blueprint document and the list of what is in it.
//
// ⚠ WHAT THIS IS NOT. It is not Charlie's OpenAI blueprint. That document is not on this machine and was not filed on idea 452c5ade
// when 26-S was built (15 Oct 2026), so the full run is measured on THIS document, which has the same SHAPE (numbered clauses grouped
// under instruments, background, a few policy-level claims, a couple of fragments that cannot be placed) and the overlaps with the
// existing actions that the brief names. The figures in LEX_26S_REPORT.md say so. Charlie's own run on his own document is the real test.
//
// The document is BUILT from `FIXTURE`, so every marker is word for word in it by construction. `expect` is what a careful reader
// would call each item; the check reports agreement and asserts the properties the brief fixes (the overlaps are not new; "Could not
// place" appears only where the fixture says; every item has a row).

export type Expect =
  | { kind: 'NEW' }
  | { kind: 'ADDS_TO'; actions: number[] }       // says what an existing action says (any of these numbers is acceptable)
  | { kind: 'POLICY' }
  | { kind: 'NOT_ACTION' }
  | { kind: 'UNPLACED' }

export interface FixtureItem { section: string; text: string; expect: Expect }

export const PARTS: Array<{ heading: string; rationale: string; items: FixtureItem[] }> = [
  {
    heading: 'Part A — The Accountability Bill',
    rationale: 'The Bill puts the duties in statute because a duty that rests on guidance can be withdrawn by the next circular. Each clause is meant to stand on its own, so that Parliament can amend or reject one without unpicking the rest.',
    items: [
      { section: 'Clause 1', expect: { kind: 'ADDS_TO', actions: [4] }, text: 'Every major project or programme in a publicly funded body shall have one named senior responsible owner, identified by name in a published notice, who is personally and publicly accountable in law for its delivery against the objectives stated when it was approved.' },
      { section: 'Clause 2', expect: { kind: 'ADDS_TO', actions: [12, 27] }, text: 'Each department shall publish, within six months of Royal Assent, a short statement of what matters most to it and how each priority will be measured, and each individual shall set their own goals on a single page that their line manager reviews every quarter.' },
      { section: 'Clause 3', expect: { kind: 'ADDS_TO', actions: [28] }, text: 'A manager in the line beneath a Minister may appoint, promote, discipline and dismiss anyone in their direct line, subject to employment law, so that authority matches the duty to deliver.' },
      { section: 'Clause 4', expect: { kind: 'NEW' }, text: 'Where a Minister directs an official to proceed against that official’s written advice, the direction shall be given in writing and published within thirty days unless the Cabinet Secretary certifies that publication would endanger national security.' },
      { section: 'Clause 5', expect: { kind: 'NEW' }, text: 'An accounting officer who disagrees with a decision on grounds of value for money, regularity, propriety or feasibility shall record that disagreement in writing before the decision takes effect.' },
      { section: 'Clause 6', expect: { kind: 'NEW' }, text: 'The protections for people who disclose wrongdoing shall be extended to an official who reports, in good faith, that a named owner is failing to deliver or is concealing a failure to deliver.' },
      { section: 'Clause 7', expect: { kind: 'NEW' }, text: 'The duties in this Bill apply to projects approved after Royal Assent, and to every existing major project within eighteen months of Royal Assent.' },
      { section: 'Clause 8', expect: { kind: 'NEW' }, text: '“Publicly funded body” includes an arm’s-length body, a non-ministerial department and any company in which a public body holds a majority of the shares or voting rights.' },
      { section: 'Clause 9', expect: { kind: 'NEW' }, text: 'Each department shall lay before Parliament every year a statement listing each named owner, the project they own, its approved budget and its forecast cost at completion.' },
      { section: 'Clause 10', expect: { kind: 'ADDS_TO', actions: [22] }, text: 'There shall be an independent Accountability Board, reporting to Parliament and not to Ministers, with power to investigate alleged failures of individual accountability, to recommend disciplinary action including dismissal, and to review promotions into senior posts.' },
      { section: 'Clause 11', expect: { kind: 'NEW' }, text: 'The Board shall have nine members, appointed by the Speaker’s Committee on merit after open competition, each serving a single non-renewable term of seven years.' },
      { section: 'Clause 12', expect: { kind: 'NEW' }, text: 'The Board may require any public body to produce documents, and any official to attend and answer questions, and a body or official that fails to comply within twenty-eight days commits an offence.' },
      { section: 'Clause 13', expect: { kind: 'NEW' }, text: 'The Board shall publish each report within three months of completing an investigation, and the Government shall respond to each report in writing within sixty days.' },
      { section: 'Clause 14', expect: { kind: 'NEW' }, text: 'The Board shall publish every year a table showing, for each department, the share of its major projects delivered on time and to budget.' },
    ],
  },
  {
    heading: 'Part B — The Code of Conduct for Named Owners',
    rationale: 'A statute sets the duty but cannot describe good conduct in the detail a person needs on a Monday morning. The Code does that, is laid before Parliament, and is enforced through the ordinary disciplinary route rather than a new tribunal.',
    items: [
      { section: 'Code 1', expect: { kind: 'NEW' }, text: 'A named owner shall report progress honestly and in plain words, shall escalate a problem to the person above as soon as it is known, and shall not describe a project as on track when the evidence shows otherwise.' },
      { section: 'Code 2', expect: { kind: 'NEW' }, text: 'A breach of the Code is grounds for a formal disciplinary process, with sanctions from a written warning to removal from the post.' },
      { section: 'Code 3', expect: { kind: 'NEW' }, text: 'No bonus shall be paid to a named owner for a year in which a finding of breach of the Code is outstanding against them.' },
      { section: 'Code 4', expect: { kind: 'NEW' }, text: 'Each named owner shall publish a one-page progress note every quarter, in a standard form, on the register described in Part C.' },
      { section: 'Code 5', expect: { kind: 'NEW' }, text: 'A project’s stated objectives shall not be rewritten after approval unless the reason is published at the same time.' },
      { section: 'Code 6', expect: { kind: 'NEW' }, text: 'No exit agreement with an official may contain a confidentiality clause that prevents the official from disclosing a failure to deliver a public project.' },
      { section: 'Code 7', expect: { kind: 'NEW' }, text: 'A named owner shall keep a dated log of each significant decision and the reasons for it, and shall hand the log to their successor.' },
      { section: 'Code 8', expect: { kind: 'NEW' }, text: 'A named owner shall declare any financial or personal interest in a supplier to the project before taking up the post and again each year.' },
    ],
  },
  {
    heading: 'Part C — The Register of Named Owners',
    rationale: 'Accountability that cannot be looked up is accountability in name only. The Register is the single public place where anyone can see who owns what, since a citizen should not need to file a request to learn who is responsible for a public project.',
    items: [
      { section: 'Register 1', expect: { kind: 'NEW' }, text: 'The Cabinet Office shall maintain a public register listing every named owner with their project, its budget and its start date.' },
      { section: 'Register 2', expect: { kind: 'NEW' }, text: 'The register shall be updated within fourteen days of any change of named owner.' },
      { section: 'Register 3', expect: { kind: 'ADDS_TO', actions: [13] }, text: 'Each entry on the register shall link to the department’s published organisational chart, so that the line of authority above the named owner can be seen.' },
      { section: 'Register 4', expect: { kind: 'NEW' }, text: 'Each entry shall carry the owner’s brief written statement of the task, the purpose it serves and how success will be judged.' },
      { section: 'Register 5', expect: { kind: 'NEW' }, text: 'No project may be without a named owner for more than thirty days, and a change of owner shall be accompanied by a published handover record.' },
      { section: 'Register 6', expect: { kind: 'NEW' }, text: 'Any member of the public may put a question about an entry, and the department shall answer it in writing within twenty working days.' },
    ],
  },
  {
    heading: 'Part D — The Training Scheme',
    rationale: 'People are being asked to carry a duty most of them have never been taught to carry. The Scheme is deliberately practical: short, repeated, and built from cases in which delivery went wrong.',
    items: [
      { section: 'Training 1', expect: { kind: 'ADDS_TO', actions: [24] }, text: 'Every named owner shall complete a mandatory induction on their accountability duties within three months of appointment.' },
      { section: 'Training 2', expect: { kind: 'NEW' }, text: 'An accredited professional qualification in major project delivery shall be required for the owner of any project above a budget threshold set by the Treasury.' },
      { section: 'Training 3', expect: { kind: 'NEW' }, text: 'Each named owner shall complete refresher training every year, built around published case studies of projects that failed.' },
      { section: 'Training 4', expect: { kind: 'NEW' }, text: 'A secondment scheme shall place officials for six months in private-sector delivery organisations, with the department keeping their post open.' },
      { section: 'Training 5', expect: { kind: 'ADDS_TO', actions: [5] }, text: 'The scheme shall train owners and their teams to recognise and challenge a bad strategy, meaning a plan that lists aspirations without a diagnosis or a coherent set of actions.' },
      { section: 'Training 6', expect: { kind: 'NEW' }, text: 'The scheme shall be paid for from a central levy of one tenth of one per cent of the budget of each major project.' },
    ],
  },
  {
    heading: 'Part E — Funding and Measurement',
    rationale: 'A regime that asks others to measure their results must be willing to measure its own. This Part supplies the money, the levers and the review that keep the scheme honest about what it costs and what it achieves.',
    items: [
      { section: 'Funding 1', expect: { kind: 'NEW' }, text: 'The regime shall publish every year its own running cost, the administrative burden it places on departments and an assessment of its effect on delivery.' },
      { section: 'Funding 2', expect: { kind: 'NEW' }, text: 'One per cent of the spending on each major programme shall be ring-fenced for independent evaluation of that programme.' },
      { section: 'Funding 3', expect: { kind: 'NEW' }, text: 'The Treasury shall set unit-cost benchmarks for each category of project, and each department shall report its projects’ costs against them.' },
      { section: 'Funding 4', expect: { kind: 'NEW' }, text: 'The Treasury shall not release funds for a major project that has no named owner on the register.' },
      { section: 'Funding 5', expect: { kind: 'NEW' }, text: 'An independent review of the whole regime shall be completed five years after Royal Assent and laid before Parliament.' },
      { section: 'Funding 6', expect: { kind: 'NEW' }, text: 'The regime shall be piloted in three departments for two years before it is extended to the rest of government.' },
    ],
  },
]

/** Background paragraphs (no proposal in them) and the policy-level and unplaceable fragments. Positions in the document are fixed below. */
export const BACKGROUND: FixtureItem[] = [
  { section: 'Background 1', expect: { kind: 'NOT_ACTION' }, text: 'Over the last forty years most of the large public projects reviewed by the National Audit Office reported cost growth, and in most of them nobody could be named as having been in charge when the decisive choices were made.' },
  { section: 'Background 2', expect: { kind: 'NOT_ACTION' }, text: 'In the private sector a chief executive answers to a board, a board answers to shareholders, and a failure to deliver is visible within a year or two. Public bodies have no equivalent signal.' },
  { section: 'Background 3', expect: { kind: 'NOT_ACTION' }, text: 'Several other countries have tried a named senior owner for each major project, with mixed results that depend heavily on whether the owner kept the post long enough to see the work finished.' },
]

export const POLICY_ITEMS: FixtureItem[] = [
  { section: 'Principles 1', expect: { kind: 'POLICY' }, text: 'Accountability must attach to one named individual and never to a committee, a board or a department as a whole, because a duty shared by many is in practice owned by nobody.' },
  { section: 'Principles 2', expect: { kind: 'POLICY' }, text: 'In very large programmes a collective model, in which a board of directors shares responsibility for delivery, is preferable to any scheme that rests on a single person.' },
  { section: 'Principles 3', expect: { kind: 'POLICY' }, text: 'Frequent reorganisation of departments, more than any single individual’s failure, is the main reason that delivery goes wrong, because it destroys the knowledge that delivery depends on.' },
]

export const UNPLACEABLE: FixtureItem[] = [
  { section: 'Other measures 1', expect: { kind: 'UNPLACED' }, text: 'Further measures of this kind should be considered in due course.' },
  { section: 'Other measures 2', expect: { kind: 'UNPLACED' }, text: 'A mechanism of the sort described above should apply, with the necessary changes, where appropriate.' },
]

export const FIXTURE_TITLE = 'Draft blueprint for named accountability in public delivery (hand-made fixture)'

/** The whole document, built from the lists so every marker is in it word for word. */
export function buildBlueprint(): string {
  const out: string[] = [FIXTURE_TITLE, '', 'Introduction', 'This draft sets out twelve instruments that together would put one named person behind every major public project. It is written as a set of separable provisions so that each can be accepted, amended or rejected on its own.', '']
  out.push('Background', '', ...BACKGROUND.flatMap((b) => [`${b.text}`, '']))
  out.push('Principles', '', ...POLICY_ITEMS.flatMap((p) => [`${p.text}`, '']))
  for (const part of PARTS) {
    out.push(part.heading, '', part.rationale, '')
    for (const it of part.items) out.push(`${it.section}. ${it.text}`, '')
  }
  out.push('Other measures', '', ...UNPLACEABLE.flatMap((u) => [`${u.text}`, '']))
  return out.join('\n')
}

export const ALL_ITEMS: FixtureItem[] = [...BACKGROUND, ...POLICY_ITEMS, ...PARTS.flatMap((p) => p.items), ...UNPLACEABLE]
