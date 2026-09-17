# LEX — pilot feedback, Angus Barry, 16 September: diagnosis and the decision-78 design

**Thread:** LEX. **Written:** 2026-09-17 00:05 UTC. **Nothing fixed** — the brief says diagnose first.
**Idea:** `2ef5358b` *Streamlining Illegal Immigrant Deportation*, one build (`f9b695c2`, v1, DONE,
16:35–16:46 UTC, `B_CONTEXTUALISED`, worker). **Elicitation:** `goalKind = LAW_CHANGE` ("A change in
the law"), `goalDetail = "Illegal immigrants deported."`, no ruled-outs, no own knowledge, a Reform
policy URL captured and not read, profile "Policy official and party adviser".

**Evidence base:** the build's row, pass log, 26 field states, 77 fork rows, 81 evidence rows and 28
issues read off Neon; the same for **all 28 DONE builds on 17 ideas** (11 with `LAW_CHANGE`); the
five retrieval queries the build recorded **re-run against the live services with production's flag
set** (`/api/health` read first: router, vector, reranker, tier fusion, stats, judged merge all ON);
and a corpus-scoped read of `bills-api`. Scratch scripts deleted.

---

## The one-paragraph version

**None of the four suspects put SROs and dashboards in Angus's proposal. Something the brief did not
name did, and three of the four then failed to stop it.** The DIAGNOSIS pass declared the pivotal
obstacle to be *"the pervasive culture within the civil service that prioritizes avoiding direct
responsibility and finding excuses"* and wrote *"The proposer reports that the current system takes
'four years to do what a private solicitor did in an afternoon'"*. Angus reported no such thing. Both
sentences are **Charlie's own testimony from the August walk-throughs, quoted verbatim inside the
build prompts as worked examples** (`build-client.ts:383-389`, `testimony.ts:43-44`,
`build-client.ts:572`), and on a 110-character problem statement the model took the examples for the
proposer's account. With the diagnosis pointed at civil-service accountability, the APPROACH pass
chose *"Organisational change within the Home Office"* and a *"named outcome owner"* system — Charlie's
own idea's approach, on Angus's idea. **The four suspects, in order:** (1) `intent` is decorative,
confirmed, and so is `goalKind` — it reaches four prompts as one label line and no code branches on it,
so nothing bound the instrument; (2) the existing-power question keys off the *drafted* instrument and
never the stated one, so on this idea it **did not run at all** — it is not the cause, and it could not
have been; (3) SMART did not originate the switch here, it **ratified** it (*"This policy rules out
seeking a legislative solution"*), and across the corpus it softens the legislative route on a minority
of builds — a tendency, prompt-explicable, not the origin; (4) **0 bills and 14 explanatory notes in
1,249 retrieved** on this idea's own queries, reproduced, while the corpus holds the bill papers for the
Illegal Migration Act 2023 and the Border Security, Asylum and Immigration Act 2025 — the "law as it
stands" Angus was shown stops at 2003. There is **no amendments corpus at all**.

⚠ A fifth defect surfaced on the way and it is separate: **the problem gate overwrites the account.**
Angus's original statement was replaced in `IdeaElicitation.problem` by his reply to the press
(*"Your reading is right. There is also too much legislation…"*), and that reply is what every pass,
the confirmation and the `yourAccount` card were built from. §5.

---

## §1 — Is intent still decorative? Does anything branch on the stated method?

**Yes, decorative; and no, nothing branches.** Two different things are called "intent" here and both
are labels.

**1a. The search `intent`.** Re-verified: no `intent ===` branch exists in `lib/lex`. `search-gateway.ts`
carries `q.intent` into fourteen log lines and the result envelope and never reads it; the router
(`query-router.ts`, `query-expansion.ts`) is not handed it; the only function that receives it as a
parameter is `retrieveStatistics()` (`search-gateway.ts:103-105`), which logs it. 25-B's finding stands
unchanged.

**1b. The user's stated method — `IdeaElicitation.goalKind`.** Every read, from the grep:

| where it is read | what it becomes | what it changes |
|---|---|---|
| `elicitation.ts:131,445,546,745` | the label ("A change in the law") | display, the transcript bubble, and `goalKindLabel` on the context |
| `build-config.ts:558` `frameQuery()` | one line in the arm-B prompt block: `WHAT THEY WANT TO HAPPEN: A change in the law — Illegal immigrants deported.` | prose the model may weigh |
| `elicitation-client.ts:133` | the same line in the confirmation prompt | prose |
| `testimony.ts:78` `testimonyBlock()` | the same line — ⚠ **only when `goalDetail` is non-empty** | prose; a user who picks the button and types nothing sends **no method at all** to SMART, the sift, the gather or the facts pass |
| `page-one.ts:79` | the label on the page-one card | display |

That is the whole list. **`goalKind` reaches no `firesWhen`, no retrieval call, no schema constraint, no
post-pass guard and no rewrite rule.** The retrieval keywords are `termsFrom(ctx.problem)` — the goal is
not even in the query. The APPROACH pass is told to pick from six instruments with the instruction
*"An idea that needs a funding decision and gets drafted as a Bill is wrong in a way no amount of good
drafting fixes"* (`build-client.ts:544-548`) and no counterpart sentence for the reverse error.

**Did it cause the outcome?** It permitted it. Angus's `WHAT THEY WANT TO HAPPEN` line was in the
APPROACH prompt and the model chose organisational change anyway, because the diagnosis it had just
written was about civil-service culture (§0). Across the other ten `LAW_CHANGE` ideas — all with a
statute named in `goalDetail` (*"Repeal the Equality Act 2010…"*) — the approach pass chose primary
legislation on every build. **The label works as a hint when the goal text carries an instrument, and
does nothing when it carries an outcome** (*"Illegal immigrants deported."*).

## §2 — Does the existing-power question fire regardless of the stated preference?

**It fires regardless of the stated preference and entirely on the drafted instrument** —
`firesWhen: (d) => d.instrumentIsPrimary` (`interrogation-library.ts:152`), where `instrumentIsPrimary`
is read off the approach pass's own `instrument` string (`build-research.ts:170-172`: unnamed, "not
named", or contains "primary" and not "secondary"). `DraftFacts` has no field for the user's method.

Measured over the 17 built ideas (`DeepeningPass` rows `question:EXISTING_POWER`):

| stated method | drafted primary → question ran | drafted non-primary → did not run |
|---|---|---|
| `LAW_CHANGE` (11) | 10 | **1 — Angus** |
| `APPLICATION_CHANGE` (2) | 1 (`9209fd61`, gender self-ID: draft chose a new Act against the user's stated method) | 1 |
| `UNSURE` (3) | 1 | 2 |
| `CHANGE_BEHAVIOUR` (1) | 0 | 1 |

So on Angus's idea **the question never asked whether a power exists** — the approach pass had already
left the legislative route one pass earlier, and the question that exists to test the legislative route
was switched off by the very drift it should have caught. `9209fd61` is the mirror image: user said
application change, draft chose an Act, the question fired, found the Equality Act guidance power, and
SMART rewrote to "use existing powers" — the right answer, reached by accident.

**Where it did fire (12 ideas; a power was found and written on 14 builds across 10 of them), it did not substitute.** `recordInstrumentRetirement()`
(`build.ts:2374-2500`) adds *"Use the existing power: s.X…"* as an **alternative** on the
`guidingPolicy:instrument` fork with the chosen instrument copied unchanged, plus an uncertainty
(*"decide whether you need a new Act at all"*). That is already the decision-78 shape at the fork. ⚠ But
the research carry handed to REVISE opens with *"⚠ AN EXISTING POWER MAY REMOVE THE NEED FOR PRIMARY
LEGISLATION … This must be reconsidered before anything else in the revision"*
(`build-research.ts:757-760`), which is an instruction to reconsider, not to report.

## §3 — Does SMART discount legislative actions for being less feasible?

**On Angus's idea SMART did not originate the switch; it ratified it.** The kernel it was given already
had an organisational instrument and administrative actions. Its three rewrites: `summaryGuidingPolicy`
(added conditions), `summaryCoherentActions` (added cost ranges — the actions themselves unchanged), and
`whatItRulesOut`, written from empty: *"This policy rules out seeking a legislative solution (e.g.,
amending the Human Rights Act) as the primary step, on the grounds that 40% of delays are due to
avoidable internal errors which no law can fix."* The user's stated method was in the prompt
(`WHAT THEY WANT TO HAPPEN (A change in the law)`) and the critique ruled it out in writing.

**Across the corpus — a tendency, a minority, and the prompt explains it.** SMART rewrote
`summaryCoherentActions` on 31 build-rows. Read one by one (not by keyword), the rewrite **moved the
legislative step later, made it conditional, or replaced it with existing powers or administration on
7**: `452c5ade` v6 (*"starting with administrative changes and then moving to parliamentary
procedure"*) and v7 (*"through administrative and management changes"* — Charlie's instance);
`31055aef` v2 (*"first use existing powers (Statutory Instrument), then adapt existing rules… and
finally legislate to fill the remaining gap"*); `8c216e8e` v1 (*"only then legislate if there is
support"*); `5c7287d2` v1 (Bill dropped for audit → debate → green paper); `e4ece7d7` v1 (*"more
feasible than a joint one … 'invites' rather than 'mandates'"*); `9209fd61` v1 (Act → existing powers,
consistent with that user's stated method). **Four of those seven are on `LAW_CHANGE` ideas — 4 of the
15 `LAW_CHANGE` builds SMART rewrote.** The other 11 kept or sharpened the legislative route
(`72a29705` ×4, `282806fe` ×2, `b9628162`, `6aa6d116`, `3e797bad`, `a379e439`, `31055aef` v1). And
where the goal named a statute, `whatItRulesOut` rewrites ruled out the *non*-legislative options
(`31055aef` v1, `282806fe`, `b9628162`). ⚠ One outright override: `e4ece7d7` *"explicitly rules out the
proposer's goal (abolition)"*.

Where the tendency comes from, in the prompt text: the outside-panel shape says *"If the obvious answer
(a new Act) is wrong, say so and say what is right"* (`build-smart.ts:154`); the critique is asked
*"how hard will this actually be to pass … Name the stage it is most likely to die at"* and
`likelihoodOfSuccess` (`build-smart.ts:738-745`); `M_GENERAL` names *"impracticable objectives"* as a
bad-strategy smell. Nothing says the stated method is not the critique's to change. So: **general
tendency, minority incidence, and not the cause on this idea.**

## §4 — What proportion of retrieved sources on a legislative idea are bills, amendments or ENs?

**Retrieved (reproduced):** the five queries the build recorded, re-run with production's flags —
1,249 distinct results: **BILL 0 (0.0%), EXPLANATORY_NOTE 14 (1.1%)**; CASE_LAW 280, COMMITTEE 332,
DEBATE 297, GUIDANCE 158, PRIMARY_LEGISLATION 118, SI 50. Per query: ORIENT 478 → 0 bills / 2 ENs;
LEGAL_LANDSCAPE 99 → 0 / 10; CASE_INTERPRETATION 100 → 0 / 0; LINEAGE 453 → 0 / 10 (its query literally
contained "explanatory notes", "second reading", "committee stage", "amendment"); CAUSAL_EVIDENCE
400 → 0 / 3.

**Kept (from the row):** 68 sourced evidence rows: **BILL 2 (both from SMART's entity search for
"Illegal Migration Act 2023" — a named-entity query, not a topical one), EXPLANATORY_NOTE 3**, all three
ENs to the 1999 and 2002 Acts. Across the 11 `LAW_CHANGE` ideas, 1,398 kept rows: 17 bills (1.2%),
71 ENs (5.1%); five of the eleven kept **zero** bills. Charlie's "1 bill of ~180" is `31055aef` (1 of 98).

**Why, and it is documented in the code as a known shape.** (a) **There is no amendments corpus** —
`bills-api` is bill *papers* (6,574 sections, 0.035% of 18.5M); nothing ingested holds tabled
amendments. (b) `bills-api` carries tier `parliamentary` in the index, so it enters the `legislation`
stream only as an `extraCorpora` leg (`stream-scopes.ts:118`) — and the divisions note beside it
(`stream-scopes.ts:136-158`) records that **an extra leg guarantees a retrieval call, not slots**:
`mergeLegs` sorts both legs together by score, so 6.5k bill rows lose the merge to ~600k Act and SI
sections on the same vocabulary. That is exactly what the re-run shows. (c) Intent is decorative (§1),
so `LAW_CHANGE` cannot bias any stream toward bills.

**The cost, on this idea.** Corpus-scoped BM25 on `bills-api` for the ORIENT terms returns the
**Border Security, Asylum and Immigration Act 2025** and the **Illegal Migration Act 2023** bill papers
at ranks 1–15; scoped on the EN corpora, the 2014, 2016, 2022 and 2025 Acts' notes. The
`legalLandscape` drafted for Angus cites the 1971, 1999 and 2003 Acts and names none of 2014, 2016,
2022, 2023 or 2025. The 2023 Act reached him only because an outside model named it.

## §5 — What actually caused it (not in the brief's list)

**5a. The prompts carry Charlie's idea as worked examples, and on a thin account they become the
proposer's testimony.** Four sites:

- `build-client.ts:383-389` (DIAGNOSIS `causes`): *"The user put it like this: 'because civil servants
  like cushy jobs with power but no responsibility … the entire culture is designed to provide endless
  excuses.'"*
- `testimony.ts:43-44` (`TESTIMONY_INSTRUCTION`, injected into **every** pass via `GROUNDING`):
  *"'Four years to do what a private solicitor did in an afternoon' is a better cause than…"*
- `build-client.ts:572` (APPROACH `conditionsForSuccess`): *"the Cabinet Office can compel departments
  to publish outcome owners, which s.3(1) CRaG may or may not reach"*
- `build-query.ts:237`, `build-smart.ts:164` (query writer, SMART entities): *"Accounting Officer",
  "Carltona", "Osmotherly Rules", "Senior Responsible Owner"*.

Measured over all 17 ideas, elicitation text checked for each phrase first: *"the proposer reports …
'four years to do what a private solicitor did in an afternoon'"* appears in `whoAffectedImpactCost`
on **three ideas whose proposer never said it** — Angus's (`2ef5358b`), gender self-ID (`9209fd61`),
and Charlie's own civil-service idea (`452c5ade`, where it is not in the elicitation row either).
*"'cushy jobs' culture"* is in the DEI idea's pivotal-obstacle fork (`f73f3928`). *"Accountability
vacuum: no single person or office has the duty"* is the pivotal obstacle on the charities idea
(`a6473880`, goal UNSURE). On Angus's idea the diagnosis fork's `recommendationReason` says *"the
culture of delay and excuse-making reported by the proposer"*. **The four rich CCW ideas with a
statute in the goal resisted it; the thin ones did not.** This is fabricated testimony, attributed by
name, in a document built to go to an MP.

**5b. The problem gate overwrites the account.** `elicitation.ts:401` and `:425` both write
`data: { problem: text }` — on the press and on the reply to the press. Angus wrote *"Create a system to
identify, detain and deport people who entered the UK unlawfully, including new large detention
centres, limits on appeals, and powers for the Home Secretary to override local authority planning
objections"*; the column, `yourAccount`, `ideaNarrative`, the confirmation and every pass got *"Your
reading is right. There is also too much legislation that would block any genuine attempt to do
this."* (`problemPresses = 1`). The original survives only in `aiChatHistory`. Detention centres,
appeal limits and planning override — three concrete legislative measures — never reached the build.

**5c. Sequence, on this build.** Thin account (5b) → DIAGNOSIS fills the gap with the prompt's example
(5a) → APPROACH follows its own diagnosis to organisational change, the goal line notwithstanding (§1)
→ EXISTING_POWER does not fire (§2) → ACTIONS drafts the dashboard and the weekly review → SMART
ratifies and rules legislation out (§3) → KERNEL_CHECK 9/9, LOGIC_CHECK "the chain holds". Every
check passed because every check tests the kernel against itself and none against the stated method.

---

## §6 — The design, per decision 78

> A stated preference for legislation is binding on the output, and an existing power that would remove
> the need for a Bill is reported as a finding alongside it, never as a silent substitution.

Five parts. **A–C are the decision; D and E are what the diagnosis says must go in with it or the
decision is honoured on a fabricated diagnosis.** Nothing built.

**A. The method is a fact of the build, not a prose line.**
`DraftFacts` gains `statedMethod: GoalKind | null`, read from the elicitation row, and
`ElicitationContext` exposes it directly. `testimonyBlock()` emits `WHAT THEY WANT TO HAPPEN (A change
in the law)` **whenever `goalKind` is set**, detail or not (`testimony.ts:77` is a bug under any
design). For `LAW_CHANGE` the goal step adds one sub-choice, in Charlie's copy, so the binding has a
shape: *a new Act · amend an Act · regulations under an existing power · not sure which*. Stored as
`goalInstrument`; absent means "legislation, form open".

**B. The instrument is bound at APPROACH and guarded after it.**
The APPROACH prompt, for `LAW_CHANGE`: *"THE PROPOSER HAS CHOSEN LEGISLATION. `instrument.chosen` is
primary or secondary legislation. If you believe a non-legislative route is better, say so in
`alternatives` with its case — never in `chosen`."* The reverse sentence to the one at
`build-client.ts:546`. Then a **deterministic guard** in `approachPass()`, because a schema is a request
(`feedback-declared-contract-not-guarantee`): if `statedMethod === 'LAW_CHANGE'` and the chosen
instrument does not match `/primary|secondary|legislation|Act\b|regulations/i`, the chosen is rewritten
to the stated method, the model's pick is filed as alternative 0 with its own case, an uncertainty says
*"I would have drafted this as organisational change; you asked for legislation, so it is drafted as
legislation and the case for the other route is in the fork"*, and `[lex-diag]` logs `instrument
overridden by stated method`. ACTIONS already says *"THE STEPS MUST FIT THE INSTRUMENT"*; with the
instrument bound, add: *"for legislation, the actions include the vehicle — the Bill or the SI, who
introduces it, and what it amends; administrative steps are implementation of the enactment, not a
substitute for it."*

**C. The existing power is a finding beside the route.**
- `EXISTING_POWER.firesWhen` becomes `(d) => d.instrumentIsPrimary || d.statedMethod === 'LAW_CHANGE'`,
  so it runs on every legislative idea whatever the draft did (on Angus's it would have run).
- `researchSummary()`'s lead line changes from *"This must be reconsidered before anything else in the
  revision"* to *"Report it beside the route. The proposer chose legislation; do not change the
  instrument, the guiding policy or the actions on its account."*
- The fork alternative and uncertainty stay as they are (they are already the right shape). Add one
  visible card at the top of `LAW_NOW`: *"A power to do this may already exist — s.X of the Y Act
  (covers / reaches part / unclear). It could remove the need for a Bill. Your stated method stands
  until you decide otherwise."* with the two buttons the fork already has.
- REVISE and SMART carry a **method clause** in their system prompts: *"The proposer chose legislation.
  You may doubt that choice in `forkDoubts` / `methodDoubt`; you may not remove it from `rewrite`,
  `whatItRulesOut` or the actions."* And a **post-rewrite guard**: on a `LAW_CHANGE` idea a SMART or
  REVISE rewrite of `whatItRulesOut` / `summaryCoherentActions` / `summaryGuidingPolicy` whose text rules
  out or removes the legislative route is **not applied**; it is filed as a `DeepeningIssue` (*"The
  critique would have dropped the legislative route: …"*) so the disagreement is on the record and the
  kernel is not. The `e4ece7d7` "rules out the proposer's goal" instance is the test case.
- `UNSURE`, `APPLICATION_CHANGE`, `INSTITUTIONAL_PRESSURE`: current behaviour. The binding is for a stated
  preference, and "not sure yet" is the absence of one.

**D. Testimony that is not the proposer's must not read as the proposer's.**
Remove the four quotations in §5a from the prompts. Where an illustration is needed, use one in a domain
no Scrutinise idea is likely to occupy and label it *"ILLUSTRATION — not this proposer's account"*; better,
state the rule without an example (*"prefer a concrete instance the proposer gave to an abstraction"*).
Then a **deterministic attribution check** after DIAGNOSIS and REVISE: any quoted span following
*"the proposer reports/said/describes"* in `whoAffectedImpactCost`, `causes`, `pivotalObstacle` must be a
substring of the elicitation text (problem + goalDetail + ownKnowledge + ruledOut) after whitespace
normalisation; a miss strips the attribution, logs, and files an issue. `check:build-*` control: a
build on an unrelated topic must never emit "private solicitor", "cushy", "outcome owner" — watched
failing first on the current prompts.

**E. The account is kept, and the legislative sources are asked for.**
- `elicitation.ts`: the first answer stays in `problem`; press replies append to a `problemReplies`
  column (or are appended to `problem` under a `— then, when pressed:` line). The build reads both. Angus's
  three measures would then have been in every prompt.
- For `LAW_CHANGE` ideas the research pass asks one more library question, `LEGISLATIVE_VEHICLE`
  (*"What Bills, Acts and explanatory notes already touch this?"*), whose retrieval is **corpus-scoped**
  (`runFtsSearch(terms, n, { corpora: ['bills-api','explanatory-notes','explanatory-memoranda'] })`,
  plus the vector leg scoped the same way) so bills reach the sift by construction rather than by
  winning a merge they cannot win. The divisions note already establishes that an extra leg is not
  enough; a scoped question is the interleave's slot allocation by another route. Its findings feed
  `LAW_NOW` and the instrument fork's alternatives (*"a Bill on this is at committee stage"*).
- **Amendments:** name it as an ingest gap. There is no corpus; `bills-api` is publication PDFs. A
  legislative-amendment user cannot be shown tabled amendments until one exists.

**Order:** E1 (account overwrite) and D (testimony) first — they are bugs in every build, whatever the
method; then A–C together as one sprint with a check that builds Angus's idea from its real account and
asserts a legislative instrument, an existing-power card, and no "outcome owner"; then E2 (the scoped
question) with the bill count as its measure.

---

## §7 — What this report does not settle

- Whether `goalDetail` outcomes like *"Illegal immigrants deported."* should be pressed once for an
  instrument, the way the problem is pressed for a problem. The binding in B works without it; the
  sub-choice in A is the cheaper version.
- The research pass on this build stopped at its own spend ceiling after 4 of 6 written questions
  (CAUSE_SEEDING and DOMAIN_TRANSFER written, not run). Not a cause here; noted because the `EXISTING_POWER`
  question, once it fires on stated method, will be the seventh in the queue and leads by `leads: true`.
- The Reform policy URL was captured and not read (25-D's rule, said plainly in the transcript). Angus's
  "limits on appeals" and "override planning objections" are in that document; the build never saw them.
