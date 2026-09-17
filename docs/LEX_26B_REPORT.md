# LEX 26-B — the instrument comes out of the kernel, not in before it

**Executes:** `docs/BRIEF_26B.md` §0–§9, plus the two addenda of 17 September (§10–§11 the four
states and the backward-looking weakness; §12 web-sourced options; §6b decided). **Thread:** LEX.
**Written:** 2026-09-17 12:37 UTC. **Supersedes decision 78** — nothing of that design was built.
**Guards:** `check:lex-26b` (new) **49/0, 9 controls, 0 dead, 4 NOT CHECKED** · `check:export` (+0,
still green) · `check:documents` · `verify:lex-25e-ui` 17/0 · `check:client-boundary` ·
`check:prompt-examples` (one pre-existing rule `text:`, not this sprint's) · web `tsc`,
`check:scripts` clean.
**Live:** two full builds on this working tree with production's flag set — a scratch idea and
Angus's rebuild — 30.2p and 29.9p.
**Schema, first and alone:** `BuildAvenue` (`b9f4ee5e`) and its `state`/`restsOn`/`debate`
columns (`9b61f010`), each applied to Neon and read back off the catalogue before a reader existed.

---

## §0 — Run mode, and the two contamination bugs

Continuous; nothing stopped for. Spend: two builds, ~60p.

**The two contamination bugs had NOT shipped when this sprint started.** Both are addressed
here to the extent §7b requires and no further:

- **Charlie's testimony in the build prompts** — the four quotations (`build-client.ts` causes
  and conditions-for-success examples, `testimony.ts`, `build-query.ts`, `build-smart.ts`) are
  replaced with shape-only instructions (§27) and a sentence forbidding attribution of anything
  not in the proposer's account. `check:lex-26b` asserts none of *cushy jobs / private solicitor
  / outcome owners / Osmotherly / Carltona* survives in a prompt string, comments stripped.
  **Shipped in this sprint's commit.**
- **The account overwrite** — the mechanism (`elicitation.ts:401`/`:425` writing `problem` on
  every press) is **not fixed**, per the brief. Angus's row was **repaired by hand** from
  `aiChatHistory[1]` (his original statement, with his reply to the press kept beneath it),
  re-read and printed before the rebuild. Any other user pressed twice is still overwritten.

## §1 — What existed before this sprint, section by section

**§2 — Did the elicitation ask only the problem and an optional addition? No.** Five steps
(`elicitation-config.ts`): *The problem* · *What you want* (four buttons — "A change in the law",
"A change in how a rule is applied", "Pressure on an institution", "Not sure yet" — stored as
`goalKind`, required: *"Pick one of the four above to carry on."*) · *What you know* (optional)
· *Anything to read* (optional) · *About you* (optional, skipped for a returning user) ·
*Confirm*. **`goalKind` was read in exactly six places and branched on in none**:
`elicitation.ts` (label lookup ×3, `case 'goal': return !!row.goalKind` for step completion,
`isGoalKind` validation), `elicitation-client.ts:133` and `build-config.ts:558` (one prompt line
`WHAT THEY WANT TO HAPPEN: <label> — <detail>`), `testimony.ts:78` (the same line, only when
`goalDetail` was non-empty), `page-one.ts:79` (the card). **`intent` is not part of the
elicitation at all** — it is the search gateway's parameter, measured decorative twice, and it is
owned by the Search contract; see §2 below for why it was not removed here.

**§3 — Did every kernel evaluate three avenues to comparable depth? No.** The APPROACH pass
named ONE instrument from six (`primary legislation · secondary legislation · regulator rule or
guidance · funding · organisational change · a change to a quango's remit`) with the sentence
*"An idea that needs a funding decision and gets drafted as a Bill is wrong in a way no amount of
good drafting fixes — so NAME the instrument you have assumed"*, and the ACTIONS pass drafted
*"through the instrument named below … ⚠ THE STEPS MUST FIT THE INSTRUMENT"*. Measured over 32
builds with an instrument fork: the chosen instrument's whole treatment (label + reason) was a
**median 718 characters**; each alternative got **372** (one sentence of case-for); alternatives
were legislative 41 · organisational 30 · financial 3 · other 3. **The financial route was
offered as an alternative on 3 of 77 rows.** 3b: nothing said an avenue did not apply — an
unnamed one was silently absent. 3c: `EXISTING_POWER` fired on the drafted instrument only
(`firesWhen: d.instrumentIsPrimary`) and its finding was written as a fork alternative **plus the
carry line** *"⚠ AN EXISTING POWER MAY REMOVE THE NEED FOR PRIMARY LEGISLATION … This must be
reconsidered before anything else in the revision."*

**§4 — Was the choice between avenues a question for the user? Partly.** The instrument fork
appeared in Initial Questions as *"Lex chose: … Taking this rules out: …"* with the route *"your
choice between these"* — one instrument chosen by Lex against two alternatives, never three
routes weighed and left open.

**§5a — Did the first pass draft every kernel field? No, two never.** Across all 17 built ideas:
16 of 18 kernel fields drafted on 17/17; **`costSummary` and `coherenceCheck` drafted on 0/17**
(EMPTY on 6, no row on 11). **§5b — Was the user told what to do next? No.** The build ended on
the model's summary (*"I have drafted a first version … I am least sure about …"*), the
credibility note and the direct-editing note. Nothing said *go through the questions, answer
them, re-run*.

**§6 — Did the re-run sit beneath a checklist? No.** The re-run box (`BuildIdeaClient.tsx`
"Re-run") held the button, the cost sentence and the allowance line. The worklist with tick
boxes existed on the *working area* (`/ideas/create`), a different page.

**§7a** — confirmed: `readKnownUnknowns()` returned `{question, why}` and dropped `kind`, so
`classifyGap()` fell through to `research` on every gap; and the research pass's own producers
never set a kind at all.

## §2 — The elicitation (built to the DECIDED §2 of 17 September; first version superseded mid-sprint)

**Reported before building, as asked.** Step 2 before this sprint asked *"What do you want to
happen — and is there anything you've already ruled out?"* with four required method buttons
(`goalKind`) above a free-text box (`goalDetail`) and a *ruled out* box. **Angus's answer to it
contained both halves:** the button *"A change in the law"* (`LAW_CHANGE`) **and** the text
*"Illegal immigrants deported."* — an outcome. So the present step was NOT only the method
choice; the outcome half is exactly Charlie's new step 2 and survives. **The method half is
removed, not rewritten**, and the wording of step 2 is new: *"What do you want to be different?
Describe the outcome — what you would see if this were fixed — not how it should be done."*
Required text; no instrument, no legislative-or-operational choice.

**The *ruled out* box goes too**, under the governing line (a view of the remedy formed before
the analysis). Its contents, reported: 14 of 37 rows carry text — 5 are the CCW enqueue's *"Not
stated by the proposer."*, 8 are CCW's notes of David's positions on the twelve measures, 1 is
Charlie's own (*"This will emerge as we investigate best practice"*); Angus's is null. The column
and its existing values stay and still reach the prompts for those rows (the CCW measures depend
on them); no new row is asked for one.

**Step 3 merges *What you know* and *Anything to read*** into *"Do you have any other
information about the problem you would like to add?"* with both ways of answering: the free-text
box (→ `ownKnowledge`, testimony) and the composer's **+** (→ the `IdeaUserMaterial` pipeline,
which reads, extracts and files findings — Charlie's four documents, 38 findings, and the only item
ever filed under POSITIONS). **The old `reading` step is removed from the sequence**, and its
contents reported: it captured a URL string onto the row and read nothing — **1 URL ever (Angus's
Reform policy page, `NOT_READ`), 0 files**; every document actually read came through the +. Its
columns stay. The encouragement Charlie asked for is one constant (`UPLOAD_ENCOURAGEMENT`) printed
as a bordered line on that step — *"Have something I could read? Anything you can give me to read
makes the next pass better … Add it with the + and I read it now …"* — and the + carries the same
words in its title; the + itself remains on every question (25-K).

**Not named either way, kept, for Charlie:** *About you* (User-scoped, skipped for a returning
user, feeds `aboutYou` to every pass). The sequence is now **problem · what you want to be
different · other information (+ upload) · [about you, first time only] · confirm**.

`GOAL_KINDS`, `isGoalKind` and every label read are deleted; `goalKind` is never written; the
outcome reaches every prompt as `WHAT THEY WANT TO BE DIFFERENT — the outcome, in their own words
(testimony, not a setting; how it is achieved is yours to work out)`. `check:lex-26b` asserts the
four-step shape, the merged step's wording, the absence of the reading step and the ruled-out
box, the encouragement constant on the card, and no `goalKind ===` in ten files (with a control);
`check:lex-25e` and `verify:lex-25e-ui` are re-pointed at the decided wording.

**2a — `intent`, reported and not removed.** It is `runSearch({ intent })` — a typed parameter on
the gateway, carried into fourteen log lines and the result envelope, read by nothing. Removing
it is a change to `SEARCH_CONTRACT.md` and the gateway's signature across every caller; that is
CC-Search's surface and it moves through them. Its being decorative costs nothing.

## §3 — Three avenues, always, to the same depth (built)

`lib/lex/build-avenues.ts`; rows in `BuildAvenue`. The APPROACH pass names no instrument; the
ACTIONS pass returns `avenues[]` — LEGISLATIVE, ORGANISATIONAL, FINANCIAL — each with 2–4
steps naming who implements, a difficulty paragraph, trade-offs, rules-in/rules-out and *what
would settle it*, under an instruction demanding comparable length ("a route you judge hard gets
the SAME number of steps and the SAME paragraph of difficulty as one you judge easy"). The
combined `actions` plan stays, told to say which avenue each step belongs to. Every marker after
ACTIONS reads the avenues with the kernel (`kernelText`); the revise pass is told the choice is
the proposer's; the smart critique is told *"THE THREE AVENUES ARE NOT YOURS TO CHOOSE
BETWEEN"* and to put a doubt in `forkDoubts` rather than the rewrite.

**3a — measured.** Each row stores its treatment's length. Scratch build (traffic fixed-penalty
uprating): LEG 1,688 · ORG 1,839 · FIN 2,014 chars, **per-build ratio 0.84**. Angus's rebuild:
LEG 1,906 · ORG 1,863 · FIN 1,768 chars, **ratio 0.93**. `depthReport()` prints the medians across every build with avenues; the
check holds each real build to shortest/longest ≥ 0.5 and NOT-CHECKS builds without rows.
Across both: medians LEG 1,906 · ORG 1,863 · FIN 2,014; shortest/longest median 0.93; per-build ratio median 0.93, worst 0.84. No systematic shortfall on the two builds that exist; two is a floor, not a
measurement.
**3b** — `applies: false` + `whyNotApplicable`, and since §10 a `state`. An avenue the model
leaves out entirely is written as an uncertainty on the actions and printed in the document as
*"not evaluated on this build — a gap in the draft, not a judgement that it does not apply."*
**3c** — `EXISTING_POWER` fires on every build (`instrumentIsPrimary` is true by construction —
there is always a legislative avenue); its verdict lands on the LEGISLATIVE row
(`existingPower`, `existingPowerReach`) and as one uncertainty. **The "reconsidered before
anything else" line is gone**; the carry now says *"Report it beside the legislative avenue. It
does not change the approach, the actions or the choice between avenues."* On the scratch
build it found `s.53(1)(a) Road Traffic Offenders Act 1988` and wrote it on the legislative row;
on Angus's it found the certified-claim out-of-country appeal power (extended by the Immigration Act 2014), wrote it on the legislative row with reach *"partial: it reaches part of this and not the rest … narrowing Article 8 claims to serious irreversible harm would require primary legislation to achieve fully"* — a finding beside the route, and the legislative avenue stayed drafted.

## §4 — The choice is a question (built)

Initial Questions now **leads** with *"Which route: legislative, organisational, or financial —
your choice"*: each avenue with its state (§10), steps, difficulty, trade-offs, *taking it rules
in / rules out*, the existing-power finding where there is one, and *"What would settle it:"*
carrying the actions pass's own evidence sentence (e.g. *"Evidence of existing statutory powers
that allow for the amendment of fixed penalty amounts via secondary legislation"*). The worklist
gains a *Choose the route* decision row linking to the document. No fork, no `chosen`: Lex does
not decide.

## §5 — Complete draft, and what to do next (built / reported)

**5a — reported, not built.** Sixteen of eighteen kernel fields are drafted on every build;
`costSummary` and `coherenceCheck` never. The cost route (`cost-route.ts`) writes `CostLine`
rows against actions, a different surface from the field, and the coherence check is a
user-triggered pass. Drafting either from the build is a design decision (the B22 note asks
whether costing should appear in the panel at all); not made here.
**5b — built.** `NEXT_STEPS_NOTE` is the last bubble of every build (*"What to do next: go
through the questions … answer the ones you can and add what you know — then re-run …"*) and the
first line inside the re-run box. Confirmed as the final transcript entry on both live builds.

## §6 — The re-run beneath a checklist (built; 6b decided: inform only)

`lib/lex/rerun-checklist.ts` → `rerunChecklist` on the worklist GET → `RerunChecklist.tsx`
inside the re-run box, above the button, allowance line untouched (6c). Rows are of two honest
kinds and say which: **derived** (decisions answered *n of m*, kernel fields settled *n of m*,
challenges responded *n of m* — ticked by the work, not clickable) and **recorded** (*I have read
the Initial Background Briefing* / *… the Initial Questions* — a checkbox the user ticks, stored
as an `IdeaWorklistTick`). A kind with nothing to count is omitted, so no box is always unticked
(6a; asserted on a fixture with nothing, then with one of each). **6b: informs only** — no
control is disabled; `complete` is on the response if Charlie ever wants the other behaviour.

## §7 — Carried items

**7a — fixed.** `readKnownUnknowns` keeps `kind` and `subjects`; the research pass's three
producers now tag (`unanswered` / `named-gap` / `search-failed`), `gapsFor` tags a broken search
or failed gather as `search-failed`; and rows written before today are classified from the
producer's own sentence by ONE shared `kindOf()` used by the agenda and the document. On the
fixture, two failed searches file as *our limitation* and one unanswered question as research;
the control strips kind and sentence and watches all three collapse to research.
**7b — done, in that order.** Account restored from `aiChatHistory[1]` (re-read: `problem` now
begins *"Create a system to identify, detain and deport…"*, the press reply kept beneath); the
four quotations out; then the rebuild, in-process on this tree with production's flags. Build v2: DONE 11/11 in 703 s, 29.9p. **The diagnosis is now about his problem**: root cause *"Existing legislation provides multiple avenues for appeals and challenges"*, pivotal obstacle *"the political and legal will to significantly curtail existing appeal rights and override local planning objections"* — his three measures, back in the kernel. **Three avenues, ratio 0.93**, states LEGISLATIVE DRAFTED · ORGANISATIONAL DRAFTED · FINANCIAL INSUFFICIENT (the financial one says so and ends on what would settle it). The legislative avenue drafts *"an amendment to the Border Security, Asylum and Immigration Act 2025 to explicitly narrow the application of human rights claims"* plus SIs defining "clearly unfounded"; the plan the smart pass settled on opens *"First, pass primary legislation to narrow the scope of human rights appeals for unlawful entrants…"*. **No "outcome owner", no dashboard, no civil-service culture** in any v2 field; the four bleed phrases appear in 0 kernel fields and in exactly 1 evidence row — SMART's *"It was saying:"* quotation of the v1 draft it replaced. ⚠ The build ran in-process on this tree; Railway's worker was still on pre-26-B code.

## §10–§11 — The four states and the backward-looking weakness (built)

Each avenue row carries `state` — DRAFTED (with `restsOn`) · FROM_DEBATE (with a `debate` record:
what was tried and what happened; what was recommended and never implemented; what is still
unsolved; the off-list note) · NOT_NEEDED (Charlie's sentence, verbatim, plus the reason) ·
INSUFFICIENT (Charlie's sentence, verbatim, then *what would settle it*). One renderer
(`avenueStateLine`) prints them; the two sentences are distinct constants; a missing state is
never defaulted to INSUFFICIENT. **Asserted with controls that stay false:** a renderer that
swapped 3 and 4, or printed the finding for the absence, is caught; the §11 paragraph appears
only on the avenue with a debate (a control counts it on all three and fires). On the two live
builds the states were scratch: three DRAFTED (rows written before §10 shipped, so the state is inferred and labelled so); Angus v2: LEGISLATIVE DRAFTED · ORGANISATIONAL DRAFTED · FINANCIAL INSUFFICIENT — no FROM_DEBATE on either, so §11's paragraph appeared on neither, which is the rule working rather than the feature unproven; the fixture in `check:lex-26b` exercises it; the ACTIONS pass now receives the orientation and the ORIENT
sources so FROM_DEBATE rests on the record rather than a guess.

## §12 — Web-sourced options: told Search, not built

`docs/FINDING_FOR_SEARCH_26b-web-sourced-options.md`. The boundary as Charlie set it — the web
may surface that a debate exists and who is in it, the corpus supplies the substance, a
web-only option is drawn as web-sourced, marked `[Wn]` under its own heading and never renumbered
into the corpus sequence — is written down for CC-Search with two questions before anything is
started. **Not built:** `LEX_WEB_ORIENTATION` is `false` on production, so the pass that would
find a web debate is not running for any user; state 2 is built corpus-only.

## §8 — Acceptance, line by line

- §1 answered, wording quoted — yes, above.
- Elicitation asks the problem and the outcome, then other information with upload; nothing
  branches — yes (decided §2; *About you* kept pending Charlie).
- Every build evaluates three avenues to comparable depth, medians reported — yes on the two
  builds that exist; ratio 0.84 and 0.93.
- An inapplicable avenue states that it is and why — yes (`NOT_NEEDED` + reason; a missing one
  is announced, not filled).
- The choice appears in Initial Questions with rules-in/out and what would settle it — yes,
  first section.
- The existing-power finding sits within the legislative avenue and overrides nothing — yes.
- The re-run sits beneath a checklist from the idea's state — yes; informs only.
- A corpus gap is no longer the user's research — yes.

## §9 — What only Charlie can confirm, and the question Angus actually raised

Only Charlie can confirm: the checklist and the next-steps line in the browser on the build page
(the worker on Railway is still on the pre-26-B code until this push deploys; both live builds
here ran in-process); the goal card without buttons; Initial Questions for Angus's idea as a
downloaded file.

**Would a user asking for a legislative route now recognise the answer as one?** **On his rebuild, yes — and it is the first time the product has produced one for him.** He wrote *"limits on appeals"* and *"powers for the Home Secretary to override local authority planning objections"*; the kernel now diagnoses the appeal routes as the root cause, the legislative avenue drafts an amendment to the 2025 Act narrowing Article 8 claims with the difficulty stated (*"strong opposition … particularly in the House of Lords … risk of legal challenges"*), and the plan opens with primary legislation. The organisational and financial routes are there beside it at the same depth, the existing-power finding is beside it as *partial*, and the choice is his. What no check can answer is whether HE reads it that way — the answer leads with the route question rather than with a Bill, and a user who wanted the Bill first may still feel asked rather than answered. That is the walkthrough only Charlie can run, and it needs the push to deploy first.
