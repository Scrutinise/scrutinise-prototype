# BRIEF 26-S — LEX: the Action import pass, the action record, instruments, and policy notes

**From CCh-Lex, 11 October 2026.** Decisions 138–156 (register at §2). Prior briefs this depends on: 26-Q (the actions workspace), 26-K (the update pass), 26-R sprint 1 (the source registry and the notebook — `docs/LEX_26R_REPORT.md`).

---

## §0 Run mode

- Continuous: diagnose → CHANGE_LOG → proceed. Batch the report (`docs/LEX_26S_REPORT.md`). Stop only for spend or scope.
- CLAUDE.md §25–§30 apply. Cold reads (a check asserts data in the rendered output, with a control that stays false). Anything that writes gets one full run, including the write, on a scratch idea before it is reported done; Charlie's screen is the last check.
- **Report size first.** This brief is probably two sprints. The split I expect: **26-S1** = §1 pre-flight, §3 import pass, §6 policy notes, §8 small fixes; **26-S2** = §4 action record, §5 instruments, §7 financial avenue. Report the size and the split you would make before building; half a feature is worse than none.
- **§1 comes before any new code.** Reason: everything from 4 October onward (26-H, 26-O, 26-Q, 135/136, the 8 and 9 October fixes, 26-R sprint 1) is committed locally or uncommitted, and not pushed. The tree is shared with Search. Uncommitted work in a shared tree is one `git add` from production (1 Sep) or from loss (`git stash`, worktree removal). Building 26-S on top of that pile makes the pile bigger.

---

## §1 Pre-flight: commit, push, deploy, read back

**1a. Commit.** Everything uncommitted from 8–9 October and 26-R, explicit paths, never `git add -A`. A change spans files: commit every file a change depends on or none. List the commits and their files in the report.

**1b. Push.** Agree the push with the Search session first (name both sessions in the CHANGE_LOG entry). Push. Then **name the §20 string** — one string only this build can emit — that Charlie reads off the live site to confirm the deployment. CC cannot read Vercel (SAML 403). Until Charlie reads that string back, nothing below is "deployed".

**1c. State the environment.** Report the current value of `LEX_AGENT` as the code reads it, and list any old-Lex code paths that still exist. Charlie confirms the Vercel value.

**1d. Charlie's browser pass** (his, after 1b). What to look at, in order:
1. Coherent Actions: the list shows ✓ Fits / ✗ Conflicts / ○ Does not fit / ? Not tested on each row; the consolidation box is gone; Group → "By policy test"; the header reads "0 of 4 parts approved · 28 actions".
2. Bulk bar: select two actions, Assign to heading → it works; force an error (e.g. an over-long rule-out reason) → the message names the input and says nothing was changed.
3. Add an action → it lands last.
4. Idea page, Policy tab: no "Candidate approaches"; the Summary of Guiding Policy is in a box.
5. Feedback: "Bug / error report" is first; a screenshot can be attached; the technical block is shown before Yes.
6. Research panel: "Sources" with numbers; Add source; "+ Add research" where "+ Add a file or link" used to be; the notebook.
7. Workspace bar: "The First Pass" / "The First Draft".
8. **Do not run "Title these for me" or "Classify with Lex" yet** — run them once after the import (§3f), so the new rows get them in the same pass.

---

## §2 Decisions recorded in this brief

| # | Decision | Status |
|---|---|---|
| 138 | One list; policy verdict on each row; Group by policy test | **Built 9 Oct** (not pushed) |
| 139 | "Remove" removed; Rule out is the only route | **Built 9 Oct** (not pushed) |
| 140 | Action import pass: reviewed mapping table, one confirm, provenance on every row. **Amended by Charlie:** a visible control, not a hidden Lex skill — plus the Lex tool, plus the intro sentence | §3 |
| 141 | Two levels: heading = instrument (with a purpose paragraph); action = provision; no parent/child. Definitions into the FAQ and the CA intro | §5 |
| 142 | Policy-level material from imported documents goes to the policy section through the update pass, not into actions. Guiding Policy stays as written | §3e, §6 |
| 143 | #10 (ECHR) ruled out for this idea: outside its scope; cross-reference the Restoration Programme | §8e |
| 144 | CRaG: amend Part 1, not repeal. **Amended by Charlie:** the collision check must also flag *near* provisions (e.g. appointment on merit) and ask whether they are consistent with the idea | 26-U; noted here |
| 145 | Each action gets a structured record; an Actions Pack prints any selection | §4 (record); Pack in 26-T |
| 146 | Four-model digest per heading, judge, visible disagreements; measured before priced | 26-T |
| 147 | Numbered paragraphs now; comment threads via 26-R sprint 2; Word-comment import deferred | 26-T |
| 148 | Drafting in two halves; the consequential-amendments section shows an honest "not yet reachable" state until Search exposes the record | §4f (state); drafting in 26-U |
| 149 | Order: 26-S → 26-T → 26-U → Deepening | — |
| 150 | Findings and notes that bear on the policy are surfaced on the policy section; set aside with reason; "Considered, not taken" in the Background Report | §6 |
| 151 | No placeholder financial action; the gap check proposes concrete ones; Lex proposes "the regime measures itself" | §7 |
| 152 | Research = sources, notes, syntheses. Incentive questions structured into every action; incentive map as a synthesis and a view | §4b (questions); map/view in 26-T |
| 153 | Restore the one hard-deleted action as ruled out, with its verdict as the reason | §8a — **awaiting Charlie** |
| 154 | Build the feedback admin list (status + notes, reusing `Feedback`'s lifecycle) | §8b — **awaiting Charlie** |
| 155 | Size the ~80 routes that still return bare `error.flatten()`; report, do not build | §8c |
| 156 | Decision 135's two interpretations: "entered the Deepening" = a user-started pass exists; briefing documents stay Stage 1 | §8d — **awaiting Charlie** |

---

## §3 The Action import pass (140, 142)

**What it is.** A document full of ideas (the first case: Charlie's OpenAI blueprint, ~8,000 words, twelve instruments, 50–65 separable provisions) becomes rows in the Coherent Actions list — after the user has seen and approved what will be written, and with every row saying where it came from.

**Why not "tell Lex to put it all in".** Sixty silent writes cannot be reviewed; half the provisions overlap the existing actions; and a chat turn sees only a stub of a filed document (26-M). So this runs as a **pass** on the worker, like the update pass, not as a chat turn.

**3a. The control.** Three ways in, one pass behind them:
- A button on the Coherent Actions toolbar, beside "Check for gaps": **"Import actions from a document"**. Reason: a thing we do must be visible as a thing we do; and Lex may only name controls that exist (controls source).
- A Lex tool (`import_actions_from_source`), asks-first.
- When a document is filed at the Coherent Actions stage, Lex offers the import — the same pattern as `extract_quotes` being offered when a document is filed (26-R).
- One sentence added to the CA introduction (verbatim in §5b).

**3b. Input.** A numbered source from the registry (26-R): a filed document, pasted text, or an address that was read. A source saved NOT READ is refused with the reason. Charlie files the OpenAI document through "+ Add research" before pressing the button; the pass reads it from the registry, so provenance is the registry number.

**3c. The mapping table** (shown before anything is written). One row per item the model finds in the document:

| Column | Content |
|---|---|
| Item | The document's own words (quoted, ≤ 60 words) and its section reference (§5.1, Clause 3, table row…) |
| Proposal | One of: **New action under {heading}** · **Adds to #n** (enriches an existing action) · **Part of #n** (a component, goes into #n's Mechanism section) · **For the policy, not an action** (→ update pass) · **Not an action** (with the reason) · **Could not place — needs you** |
| Policy test | ✓ Fits / ✗ Conflicts / ○ Does not fit, one line of reason, tested against the accepted Guiding Policy statement (same test as `testHeldActions`) |
| Title | ≤ 12 words, in the idea's voice |
| Summary | One line |
| Implementer | If the document names one |

Plus two more tables in the same review:
- **Existing actions → proposed heading**, for every live action (the 28), with "no change" where it already has one.
- **Proposed new headings**, each with name, shape, colour from the palette, and a purpose paragraph (§5a).

**Honesty rules.** Every item in the document that reads as a proposal appears in the table — a row the model cannot place is "Could not place — needs you", never dropped. Nothing in the table is the model's paraphrase presented as the document's words: the Item column is the document's text (checked word for word against the stored source, as `add_research_note` does); the Title and Summary are labelled as Lex's wording.

**3d. Review.** The user edits a title, changes a heading, strikes a row, moves a row between dispositions. Then one confirm: **"Import N actions · add to M · send K to the policy — measured (n=…)"** — asks-first, signed token, price from measurement once scratch runs exist, "estimate" until then.

**3e. On confirm.**
- New actions written as `LexCoherentAction` rows, not confirmed ("These are my actions" untouched), landing last (8 Oct ordering rule), with `policyTestVerdict/Reason/From` set, heading assigned, and provenance **"From: [Ref: n] §x.y"** on the row — the same place "parked with policy 2 (item 15)" shows today.
- **Adds to #n**: the imported text goes into #n's record *beside* what is there, labelled with its source; the user's own words are never overwritten (rule 5, decision 59). Until §4 ships, "beside" means appended to the body with the source line; report what you did.
- **Part of #n**: into #n's Mechanism section (§4) — or, before §4, the same as Adds to.
- **For the policy**: written as update-pass findings (26-K's five categories, "contradicts" first), so they appear in the policy review of §6. Nothing on the policy changes until accepted.
- Headings created; existing actions re-headed as approved.
- Every write recorded in Privacy Log & Lex activity.

**3f. After.** The pass ends by offering **"Title these for me"** and **"Classify with Lex"** over the new rows, and says in words that the gap check has not been re-run.

**3g. Scale.** 50–65 items from one document. Decide and report whether the mapping is one model pass or chunked by section with a merge (duplicates across chunks must resolve to one row). Model: Sonnet 5.5 unless you find it cannot hold the table; report. Measure on the scratch idea with the real document; the price goes on the confirm card as measured.

**3h. Dedupe against the existing list.** "Adds to #n" and "Part of #n" must be proposed wherever the document's item and an existing action say the same thing — the handover notes these overlaps on Charlie's idea: Clause 1 ≈ #4; Clause 2 ≈ #12/#27; Clause 10 ≈ #22; the Bill ≈ #20. The check asserts at least these four are not proposed as new.

---

## §4 The action record (145, 152)

**4a. Sections.** Each action's opened view becomes a structured record. The list row is unchanged (title, one-line summary, facets, verdict). Section names and empty states, in words, never blank:

1. **Title and summary** — as the row.
2. **Purpose** — which cause it attacks (`targetCauseIds`), which link in the chain it protects (the policy-link facet). Empty: "Purpose not yet stated".
3. **Mechanism** — the detail: components, fields, rules. Markdown with tables allowed (the OpenAI document's data models and field lists go here). Empty: "No detail yet".
4. **Implementer and incentives** — §4b.
5. **Instrument and route** — which Act, code, letter or scheme; who issues it; laid before Parliament or not; commencement; extent. Empty: "Instrument not yet stated".
6. **Draft text** — the drafting instruction and the illustrative clause with its caveat, one object (26-U fills it). Empty: "Not yet drafted".
7. **What this touches in existing law** — provisions touched, quoted, with [Ref: n] (26-U fills it). Empty: "Not yet checked".
   **Consequential amendments** — sub-section; its honest state until Search exposes the record (verbatim):
   > "The official record of amendments and repeals is held but not yet reachable by Scrutinise. Search is making it reachable; until then this section stays empty rather than guessed."
8. **Risks and safeguards** — Empty: "None recorded".
9. **Evidence and sources** — the [Ref: n] lines; the provenance line from §3e.
10. **Cost range** — the existing "+ add a cost"; basis and price year. Empty: "No cost range yet".
11. **Your notes** — testimony, verbatim, never overwritten; replies beneath (the notebook's rule).

Report what the existing body text, `Who`, `Target`, `Impl`, `Enforce`, `Friction` hold and how each maps onto these sections before moving anything; migrate data, do not retype it.

**4b. The structured questions** (section 4). Named fields, each a slot that says "Not yet answered" until it is:

| Field | What it asks |
|---|---|
| Implementer | Who does this (named body or role) — maps from `Who` |
| Inside or outside government | — |
| Incentive now | **With / Against / Indifferent** (word + shape, never colour) and why |
| What changes it | What in the proposal changes that incentive — the coherence link to another action, if that is what does it (e.g. #28 for most organisational actions on Charlie's idea) |
| Skill | Why they would have the skill to do it |
| If done badly | What happens, and who notices |
| What tells us it worked | The measure |

Rules: "Classify with Lex" proposes answers for every empty slot; the user accepts or edits; a slot the user wrote is never overwritten. **"Specific enough" now means**: implementer + incentive answered (organisational/financial), or draft text present (legislative). The list's "not yet specific" tag and the coverage grid follow this definition. Reason: an action with no implementer and no incentive is an aspiration; the point of the questions is that the gap is visible, not quietly vague.

**4c. ⚠ Lex's snapshot.** The per-turn idea snapshot must hold **rows only** (title, summary, facets, verdict, heading). Records are fetched on demand by a tool (`get_action(n)`). Reason: every Lex turn carries the snapshot in its cached prefix; sixty full records would make every turn dearer for every user. Report the snapshot size in tokens before and after this sprint on Charlie's idea.

**4d. Documents.** The Proposal and Meeting Pack read the action body today; make them read Title + Summary + Purpose until the Actions Pack (26-T) exists, and say in the report what changed in their output.

---

## §5 Headings as instruments (141)

**5a. Purpose paragraph.** A heading gains an optional `purpose` (≤ 120 words): what this instrument does and why it is needed. "Suggest headings from my guiding policy" fills it; the import pass proposes it for new headings; the user edits. Shown at the top of the heading's group in the list and, later, in the Actions Pack.

**5b. Definitions.** Verbatim, into the FAQ and appended to the CA introduction:

> **A heading is an instrument** — the thing that gets made: an Act, a code of conduct, a register, a training scheme. **An action is a provision** — one rule inside it, specific enough to be accepted or rejected on its own. If you have a document full of ideas, use **Import actions from a document**, or give it to Lex.

FAQ question: "What is the difference between a heading and an action?" with the same text and one example (a Bill is a heading; each clause is an action).

**5c. Archived count.** From CC's 9 Oct finding (a): a rebuild archives a heading-assigned action and the heading then reads "0 actions" while the action sits in "Ruled out and merged away" — kept, but it reads as lost. Show **"Legislation · 2 actions · 1 archived"** with the archived word linking to where they are.

**5d. Scale controls.** Headings collapse and expand with counts; a filter on the list: **Unreviewed / Conflicts / Not yet specific**. Reason: sixty rows.

---

## §6 Policy notes and proposals (150)

**What exists.** The update pass (26-K) writes findings in five categories with accept/dismiss, shown in a collapsed box at the end of the kernel. The notebook (26-R) records notes with `bears-on` = cause | policy | action, author, status, and "set aside keeps its reason"; `add_research_note` treats "my own observation" as a valid source. So the *place* for a note about the policy exists. What is missing is that nobody would see it.

**6a. The count on the Guiding Policy header.** Verbatim shape:

> "4 proposals and 2 of your notes bear on this policy · Review"

Expands to the list: update-pass findings (contradicts first) and notebook notes with bears-on = policy, each with **Accept / Dismiss / Set aside** — dismiss and set aside both take a reason (today's dismiss takes none; add it). Set-aside items keep their reason and go to the notebook as "considered, not taken"; the Background Report (26-T) prints them under that name.

**6b. Capture from where the user is.** Saying to Lex "note this for the policy: …" calls `add_research_note` with bears-on = policy and source = own observation. The "+ Add research" form's bears-on offers "the policy" as a choice. Nothing new beyond wiring; report if either is already true.

**6c. The Deepening's opening re-read** (26-J §5) lists, against each kernel field, the notes and proposals that bear on it. If the re-read does not exist as a surface yet, report what it would take and do not build it here.

**6d. Charlie's first policy note.** Not CC's to write. Charlie files it once the notebook is on his screen. For the record, the substance (his words, condensed by CCh):

> Accountability has two interests behind it. The taxpayer's — the task is delivered at a cost no higher than a competitive market would charge, with no more direct cost or overhead than necessary. The beneficiary's — the service standard that was chosen. In business, competition sets the balance; in government the beneficiary does not pay, so the standard (one star or five) is a political choice the Minister makes and answers for. The named owner is accountable for delivering the chosen standard at that cost — not for choosing it.

---

## §7 The financial avenue (151)

**7a.** The gap check's free pass already finds an empty avenue. When the financial avenue is empty, the four-model half must propose **concrete** financial actions (a funding mechanism; a Treasury lever; an evaluation budget; a measurement of the regime's own cost), each saying what fails without it, as suggestions into the list.

**7b.** Lex proposes, by name and as a suggestion, an action of the shape **"the regime measures its own cost, administrative burden and effect, and publishes it"** whenever no action does that — it also answers Lex's own named gap, the review mechanism for gaming.

**7c.** No placeholder action is ever created. An empty avenue shows "NO ACTION" in words, as the coverage grid does.

---

## §8 Small fixes from CC's 8–9 October findings

**8a (153, awaiting Charlie).** The action hard-deleted on 2 Oct ("Establish a statutory duty for specific, named officials to be accountable for the delivery of major government projects…", verdict CONFLICTS) is restored from its `ActionIdea` row as a **ruled-out** action with the verdict's reason, so the record shows it was considered. Reason: "nothing deletes" — the deletion predates the rule; the record should read as if it had not.

**8b (154, awaiting Charlie).** Feedback items are written and emailed but listed nowhere. Build the admin list: every `FeedbackItem`, newest first, with status (new / looked at / fixed / not doing) and admin notes, reusing `Feedback`'s lifecycle shape; attachments openable; bug reports show the technical block. Reason: a report nobody can work through is a row.

**8c (155).** ~80 routes still return bare `error.flatten()` (CLAUDE.md §30 lists them). Size the mechanical fix — route every rejection through `lib/api-rejection.ts` — and report; do not build it here unless the size is under an hour and touches no shared file with Search.

**8d (156, awaiting Charlie).** Decision 135: confirm (a) "entered the Deepening" = a user-started Deepening pass exists, until a stored "opened the Deepening" fact exists; (b) the two briefing documents stay Stage 1 whatever the kernel's progress. If Charlie confirms, change nothing; if not, change `documentStage`'s FIRST_PASS line and report.

**8e (143).** Rule out #10 on Charlie's idea with the reason, verbatim:

> "Outside the scope of this idea. Dismissal for poor performance is lawful under existing employment law; the problem is practice, not the Convention. The ECHR question belongs to the Restoration Programme."

Reversible, as every rule-out is. Do this only after Charlie confirms the 8–9 Oct work on his screen (1d), so he sees the list before and after.

---

## §9 Verification — `check:lex-26s`

Cold reads, controls that stay false, scratch idea for every write. The check asserts:

1. **Import, full run** on a scratch copy of 452c5ade with the real OpenAI document filed as a numbered source: the mapping table has one row per item the fixture lists (fixture = a hand-made list of ≥ 40 items with their section refs); the four known overlaps (§3h) are not proposed as new; "Could not place" rows exist only where the fixture says; after confirm, every new row carries "From: [Ref: n] §x.y", a verdict, a heading, an orderIndex past the previous maximum; nothing confirmed; policy-level rows exist as update-pass findings and the Guiding Policy field is unchanged; "Adds to" rows left the user's text byte-identical.
2. The snapshot's token count on Charlie's idea does not grow with the records (§4c), read before and after.
3. Each record section renders its empty state in words; "Not yet answered" slots count toward "not yet specific" exactly as §4b defines.
4. Heading purpose round-trips; the archived count renders "· 1 archived" on a scratch heading after a rebuild archives one of its actions.
5. The policy header count equals findings + notes bearing on the policy; dismiss and set aside both require a reason; a set-aside note is hidden from the default list and comes back.
6. The gap check on an idea with an empty financial avenue returns ≥ 1 concrete financial suggestion and never writes a placeholder row.
7. 8a: the restored action is listed under "Ruled out and merged away" with the verdict text as its reason (if 153 confirmed).
8. 8b: the admin list shows the scratch feedback row with its technical block and status change read back (if 154 confirmed).
9. Regression: `tsc` 0; `check:lex-26q`, `26r`, `9oct`, `walk-8oct`, `26m-actions`, `26p`, `26h`, `documents`, `export`, `client-boundary` green. Known-red suites (25h, 25i, 25n, 25p, 25s, 25x, sprint3e-ui, 25g, 25f, 20bd): fixed or deliberately retired with the reason in the log — not left red (rule 16). Report which.

Every prompt in this sprint passes `check:prompt-examples` (no real user's words).

---

## §10 What only Charlie can confirm

- The §20 string read off the live site after the push (1b).
- The browser pass (1d), in that order, before the import is run on his idea.
- The import's mapping table on his own idea: the table is the design; what he changes in it on first use is the feedback.
- Filing his policy note (§6d) once the notebook is on his screen.
- 153, 154, 156.

---

## §11 Not in this sprint

26-T: the four-model digest per heading; the Actions Pack (ninth document kind, numbered paragraphs); the incentive map (synthesis + "group by implementer" view with direction); the Background Report and Introductory Summary (26-R sprint 2 §7c–d) and the "Considered, not taken" section; the 26-R sprint 2 team-roles report.
26-U: drafting instructions and illustrative clauses to the OPC Drafting Guidance (Search to ingest); first-order collisions from the corpus; *near* provisions flagged with a consistency question (144 amended); consequential amendments when Search exposes the record.
Deepening: costing in Green Book shape (the costing block has zero callers today); the cost annexe.
Later, if used twice: saved selections ("packages"); Word-comment import.
