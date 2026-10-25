# BRIEF 26-T — LEX: making sense of the set — the digest, the Actions Pack, the incentive map, the Background Report

**From CCh-Lex, 18 October 2026.** Follows 26-S2. Decisions carried: 145–147, 150, 152, 196; new 200–203 (§1). Charlie's idea stands at 58 live actions under seven instrument headings, ten conditions, causes and avenues classified. The unit is settled: an action is a mechanism; its parts are quoted in its Commentary.

---

## §0 Run mode

- As BRIEF_26S §0: continuous; diagnose → CHANGE_LOG → proceed; batch the report (`docs/LEX_26T_REPORT.md`); stop only for spend or scope; CLAUDE.md §25–§31; cold reads; scratch-idea full run before done; `check:prompt-examples`; Charlie's screen is the last check; handoff_summary updated at every push.
- **Size first.** Expected split: **26-T1** = §2 digest + §3 incentive map; **26-T2** = §4 Actions Pack + §5 Background Report and Introductory Summary + §6 comments; §7 housekeeping where it fits. Report the split before building.
- **Prices from measurement.** Every button in this brief shows "measured (n=…)" or "estimate". Runs over ~5p ask first (decision 121). Long runs go on the build worker (no 300 s limit) and survive a closed tab, as the import does.
- **Plain words on screen.** No "component", "mechanism", "synthesis", "facet". The vocabulary: *action*, *heading* (an instrument), *parts of a bigger action*, *condition*, *cause*, *who / how / against*.

---

## §1 Decisions

| # | Decision | Where |
|---|---|---|
| 146 | Four-model digest per heading, judge, visible disagreements, measured before priced | §2 |
| 152 | Incentive map as a view and an annexe | §3 |
| 145 | Actions Pack: any selection, numbered paragraphs, Word and PDF | §4 |
| 150 | "Considered, not taken" printed from the notebook | §5 |
| 147 | Comment thread on each action, into the notebook; Word-comment import deferred | §6 |
| 196 | Remaining hard-delete paths; old-Lex removal after the second-account test | §7 |
| **200** | The digest's questions are the six Charlie asked Lex on 17 Oct (verbatim in §2b): they produced the most useful analysis the product has given him | §2 |
| **201** | The digest tests against the idea's **conditions** list, not against a model's own list; a model may propose a missing condition as a proposal | §2 |
| **202** | The Actions Pack is a ninth document kind with the stage banner (decision 101) and `[Ref: n]` on every source line, like the others | §4 |
| **203** | The incentive direction (with / against / indifferent) on each action's *Who* slot is the data the map reads; the map never stores a judgement of its own | §3 |

---

## §2 The digest — one per heading, and one for the whole set (146, 200, 201)

**2a. Control.** On each heading row in step 1: **"Ask four models about this heading"** (asks first, price shown). On the toolbar: **"Ask four models about the whole set"**. Both produce a *Digest* stored on the idea (`ActionDigest`: scope = heading or set, created, model outputs, judge output, cost, the live action ids it read — so a stale digest says "written when this heading had 5 actions; it now has 7").

**2b. The questions — verbatim, to every model.** For a heading, "these actions" = the heading's live actions with their statements, Commentary parts, who/how/against where answered, causes, conditions; for the set, all live actions grouped by heading. The idea's Guiding Policy, diagnosis causes and conditions list are given in full. The questions are Charlie's own from 17 October:

> 1. List the conditions this proposal must meet and show which of these actions deliver each one.
> 2. List any action that does not directly deliver at least one condition.
> 3. Which conditions are delivered by legislation, and which are left to codes, software, money or practice?
> 4. For those not delivered by legislation: how do they change behaviour, how will they be measured, and how will they be enforced, as the actions are written now?
> 5. Are the non-legislative elements strong enough to change the culture? Say what would strengthen them.
> 6. Assume everybody misunderstands or mis-implements all of it, through ignorance or deliberate malice. How will it mainly go wrong, and what is in place to prevent that?

Each model also returns: the three actions that carry the most weight; what is missing (each item saying what fails without it); conflicts between actions or with the policy; and — labelled as such — any condition it thinks the list lacks (a *proposal*, never added).

**2c. Panel.** The four price-matched models of decision 117 at `DRAFT_REASONING_EFFORT`; judge Opus 5.5. No real user's words in prompts (§27): the idea content is data in the fenced channel, as elsewhere.

**2d. The judge** writes one digest per run: the six answers reconciled, with **a "Where the four disagree" section that keeps each model's position named** (the 26-R synthesis-grid pattern — never a merge that hides disagreement); a table conditions × actions as the four see it, with cells marked "all four" / "3 of 4" / "disputed"; the weight-bearing actions; the gaps, ranked by how many models named them; the conflicts. Every claim about an action cites its number; every claim about a source cites `[Ref: n]`; reasoning is labelled reasoning.

**2e. Where it shows.** A *Digest* panel under the heading (collapsed; "Digest · written 18 Oct · 5 actions then, 7 now"); the whole-set digest at the foot of step 1. Gaps become suggestions into the list with "From: the digest, 3 of 4 models" (as the gap check does); conflicts link to the actions; a model's proposed condition appears in the conditions panel as a proposal to accept or set aside.

**2f. Cost.** Measure on a scratch copy: one heading of ~8 actions; the whole set of 58. Expected order: the gap check (18.4p) to double it per heading; the set several times that. Put the measured figure on the button.

**2g. Check.** Cold read on a scratch idea: six answers present per model; the judge's disagreement section names at least one model where the fixture plants a disagreement; every action number cited exists and is live; a stale digest is marked stale when an action is added; nothing written to actions without accept.

---

## §3 The incentive map (152, 203)

**3a. Data.** Already on each action from 26-S2 step 2: *Who*, inside/outside, *Incentive now* (with / against / indifferent + why), *What changes it* (with a link to the action that does), *How*, *Against*. The map reads these; it stores nothing of its own.

**3b. The view.** In step 2, a third toggle beside List and Coverage grid: **"By who"**. Rows = implementers (bodies or roles, as written in *Who*; Lex may propose merging spellings — "HMT" and "HM Treasury" — the user accepts); columns = actions; cell = the direction as word + shape (▲ with · ▼ against · ○ indifferent · — not answered). A row's summary: "Cabinet Office — 9 actions: 3 with, 5 against, 1 unanswered". A second grouping, **"What changes it"**: each *against* cell shows which action is relied on to turn it, so an *against* with no changer is visible in words: "AGAINST — nothing changes this".

**3c. The annexe.** "Incentives" as a section of the Actions Pack (§4) and the Background Report (§5): one paragraph per implementer — what they must do, which way their incentive pulls today, what in the proposal changes it, and the actions concerned — generated from the slots, with the unanswered shown as unanswered.

**3d. Checklist line (step 2).** "N actions rely on an implementer whose incentive is against and nothing changes it."

---

## §4 The Actions Pack (145, 202)

**4a. What it is.** The ninth document kind: a printable pack of any selection of actions with everything the record holds. Select rows (the bulk bar) → **"Print selected as an Actions Pack"**; or from the heading row, **"Print this heading"**; or the toolbar, **"Print all"**.

**4b. Contents, in order.** The stage banner (101). The Guiding Policy statement and summary. The conditions list. Then, per heading in list order: the heading's name and purpose paragraph; its latest digest if one exists (dated; "none yet" otherwise); then each selected action: title; statement; *Parts of this action, quoted* (from Commentary, each with its number and `[Ref: n]`); who / how / against and the other slots, "not yet answered" where empty; causes and conditions; policy verdict with reason; cost range or "no cost, because"; sequence if set; sources `[Ref: n]`; the owner's notes. Then the Incentives section (§3c). Then "Considered, not taken" (§5c) for ruled-out actions under the selected headings, with reasons. Then the source list, numbered.

**4c. Numbering.** Every paragraph numbered **B.3.6** = heading B, action 3 in print order, section 6 — so a reviewer can say "B.3.6 is wrong" on paper or by email. The scheme is printed in a one-line key at the top.

**4d. Output.** Word and PDF through the existing document route; `[Ref: n]` on every source line; tables rendered as tables (the Commentary allows them — report what the generator does with a markdown table and fix it if it flattens). Stored as a version like the others (minting assigns numbers, as 26-R established).

**4e. Check.** Cold read on a scratch idea with two headings, three actions, one folded part, one ruled-out, one unanswered slot: the rendered .docx contains the numbering key, B.2.3, the quoted part with its number, "not yet answered", the ruled-out item under "Considered, not taken", and `[Ref: n]` lines; the PDF text matches.

---

## §5 The Background Report and the Introductory Summary (26-R sprint 2 §7c–d; 150)

**5a. Background Report.** From the notebook and the registry: what was read, what it said, where sources disagree (the `find_disagreements` tool exists; the *report* does not), the conditions and where they came from (cited), the issues the research flushed out and which actions meet each (the "third view" from Reply 16 — issue → actions), and the Incentives section. Generated on demand; a document kind; stage banner; `[Ref: n]`.

**5b. Introductory Summary.** One page for a reader new to the idea: the problem in the user's words, the policy, the seven instruments with one line each, what it costs if known, what is not yet settled. Generated from the kernel, never from the model's general knowledge; every figure cited or absent.

**5c. "Considered, not taken".** A section of both: ruled-out actions and set-aside notes and proposals, each with its reason and date. Why: for scrutiny, what was rejected and why is nearly as valuable as what was kept.

**5d. Team roles.** The report CC asked for before 26-R sprint 2's curation controls: how contributor / reviewer map onto the Team tab and the Private Scrutiny stage. **Report only**, as the last item; the controls wait for Stage 4.

---

## §6 Comments on an action (147)

A **"Comments"** thread at the foot of each action's record, using the notebook's reply rules (nobody edits another's words; replies beneath; nothing deletes; a comment is a note with bears-on = this action). Visible to whoever can see the idea. Lex may summarise a thread on request; it never writes into it unasked. Word-comment import stays deferred until a reviewer returns a marked-up file.

---

## §7 Housekeeping in this sprint

- **196 / 183:** the five remaining hard-delete paths (policy option, cost line, heading — now done — evidence rows, private notes): archive with restore; numbers never reused; ~8–10 hours by CC's sizing, built where it fits between T1 and T2.
- **11d:** remove the old Lex code path and retire its tests by name — **only after Charlie reports the second-account test**.
- **Known-red suites:** none left red at the end of the sprint (rule 16).
- **Snapshot:** rows-only still; digests and maps are fetched on demand, never in the per-turn prefix. Report token count before and after.
- **entity_list_v5.md** Section 24: `ActionDigest`, the comment/note links, any new columns.

---

## §8 What only Charlie can confirm

- A heading digest on his idea: does it read like the 17 October answer, and does the disagreement section say anything the single answer did not.
- The "By who" view: are the *against* cells with nothing changing them the ones he expected (the Permanent Secretaries question).
- The Actions Pack for one heading, opened in Word: numbering, the quoted parts, the unanswered slots.
- The Introductory Summary read cold by someone who has not seen the idea (Angus).
- The second-account Lex test, then 11d.

---

## §9 Not in this sprint

26-U: drafting instructions and illustrative clauses to the OPC guidance; what each clause touches in existing law, near provisions flagged (144); consequential amendments when Graphs exposes the record. The Deepening: the opening re-read; Green Book costing (Managing Public Money once Ingest has it); the cost annexe; research on demand per action. Stage 4: review roles and the first recorded review. Later: saved selections ("packages"); Word-comment import; export of the Order step.
