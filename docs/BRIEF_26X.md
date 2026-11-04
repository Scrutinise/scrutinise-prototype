# BRIEF 26-X — LEX: the lifecycle, the Development checklist, the Organising and Drafting pages, a Brief on every draft

**From CCh-Lex, 4 November 2026.** Decisions 300, 308–319 (§1). Charlie, 3 Nov: *"Once you have the Action defined in terms of the legislation or code you want, the very next thing is to get a draft out, and this should be prominent and the natural and obvious progression, both logically and visually in the UI."* And: *"Organising, drafting and the deepening is just the sub-processes of the Coherent action stage."*

**What this brief changes, in one sentence:** the product is reorganised around what a person does (define → brief → draft → review → accept, per action; then deepen the whole), instead of around the tools we built in October.

---

## §0 Run mode

- As BRIEF_26S §0: continuous; CHANGE_LOG; report `docs/LEX_26X_REPORT.md`; stop only for spend or scope; cold reads; scratch run before done; `check:prompt-examples`; Charlie's screen is the last check; one session per tree.
- **Size first; three parts expected.** **X1** = §2 the lifecycle bar, §3 the Development checklist and lock, §4 the Organising page, §5a–b the Drafting page and the flip (318). **X2** = §5c–e the Brief on every draft, the progress strip, the #207 migration. **X3** = §6 the Deepening page (reviews over drafts, who/how/against view), §7 the renames (300, 135). Report the split before building.
- **Labels change only in `lib/lex/screen-labels.ts`**; the field guide follows (26-W-b). Add guide entries for every new control.
- Nothing deletes; proposals beside, never over; every rejection worded; limits with counters; shape + word, never colour alone; schema with or after the code that reads it; §20 read-back; prices from measurement.

---

## §1 Decisions

| # | Decision |
|---|---|
| 300 | What we write for an action is a **Draft**; "Documents" means uploaded files only |
| 308 | The four-step bar goes. Organising keeps step 1's tools. Costs and Order stay as record sections. Who/how/against leaves the record (315) |
| 309 | **A Brief on every draft**: the drafting instruction generalised to every kind — fields per kind plus free text; Lex prefills from Action details; Brief → "Draft it" → Draft, in that order on screen |
| 310 | **Per-action progress strip**: Defined ● → Briefed ● → Drafted ○ → Reviewed ○ → Accepted ○ — on every row and in the tree; counts at the top of the stage |
| 311 | **Reviews run over drafts**: the four-model digest and the policy test read the accepted draft where one exists, the statement where none does, and say which |
| 312 | 26-W-b first (done, live `a2fa9c3`); this brief next |
| 313 | **One instrument per action**; collision report, explanatory note and costing are **companions** of that draft; "needs no draft" is a stated state with a reason |
| 314 | Costs at both levels: lines on the action, analysis on the idea; the analysis is not a gate (its own brief, after this) |
| 315 | **Who/how/against becomes a Deepening view** ("Who delivers and who resists") with the incentive map; it leaves the per-action record |
| 316 | **Seven lifecycle stages:** Creation · Development · Private Scrutiny · Public Scrutiny · Promotion · Submission · In Force. **Development carries a checklist**, not sub-stages. Decision 135 amended; banners and FAQ follow |
| 317 | **The lock:** the Deepening opens when every live action is Accepted or Needs no draft; until then its page shows the count |
| 318 | **The flip:** open an action from Organising → land on Drafting with it open; "Back to Organising" returns to where you were; one list under both |
| 319 | Private Scrutiny is a page first, with print-on-demand (its own brief, after this) |

---

## §2 The lifecycle bar (316)

**2a.** The stage bar at the top of the workspace shows the seven lifecycle stages, the current one marked (● and the word "You are here"), each with one line of state:

| Stage | State line (examples) |
|---|---|
| Creation | "Lex's first pass · 10 runs" |
| Development | "Organising 57 actions · 3 drafted · 0 accepted" (from §3) |
| Private Scrutiny | "not yet open" / "2 reviewers · 14 comments" |
| Public Scrutiny | "not yet open" |
| Promotion | "not yet open" |
| Submission | "not submitted" / "submitted to … on …" |
| In Force | "not yet available" |

**2b. Submission is defined**: the idea has been lodged with a decision-maker (an MP for a Private Member's Bill, a committee as evidence, a consultation, a department). It is recorded with the body, the date and the form, by the owner. The platform's job then changes (track the Bill), which is why it is a stage and not a step of Promotion.

**2c. The old names.** "The First Pass" and "The First Draft" are no longer stage names. The First Pass is Creation's content ("Lex's first draft of the whole"). Every generated document's stage banner (26-H, decision 101/135) and the FAQ's stage text are rewritten to the seven names. Report the count of strings changed. Historic documents keep the banner they were printed with (they are versions).

---

## §3 The Development checklist and the lock (317)

**3a.** Inside Development, a checklist with state in words and shape, one line each, each opening its page:

1. The problem — "written"
2. The causes — "7 causes · 7 with actions"
3. The guiding policy — "chosen · v3"
4. Organising the actions — "57 live · 7 headings · 10 conditions · 16 untested against the policy"
5. Drafting — "57 actions: 41 accepted · 3 need no draft · 13 to go"
6. The Deepening — **locked** until 5 reads "0 to go"; then "collision 12 · four models: not run · passes 5/5 on 38 drafts · costs: not rolled up · who delivers: 20 of 57 answered"
7. Promotional plan — "not yet available"

**3b. The lock** (317): item 6's page is reachable but shows only the count and the list of actions still to go, each a link to its Drafting record. Nothing in the Deepening runs until the count is zero. The owner may **override** with a reason ("deepen now — 13 actions are minor"), recorded; the override is shown on the Deepening page and in every output it produces ("Deepened with 13 actions undrafted — reason: …").

**3c.** The checklist replaces the stage bar's old "Stage N of 3" content; the seven-stage lifecycle bar sits above it.

---

## §4 The Organising page (308)

**4a.** Stage 2's tools, and only those (§31): List · Board · Coverage grid · Conditions; group by heading; headings (rename, kind, hide, retire); Classify with Lex; Find duplicates; Re-sort; Consolidate; Test against the policy; Suggest headings; Import; the find box (284); the bulk bar; Rule out; Later phase; Print all.
**4b.** Each row shows the progress strip (310) so Organising already shows how drafting stands, but no drafting control is on this page.
**4c.** Removed from this page: the step tabs ("1 Sort and prune · 2 Who, how and against · 3 Costs · 4 Order") and the per-step toolbars. The data behind steps 2–4 is untouched.

---

## §5 The Drafting page (309, 310, 313, 318)

**5a. The page.** The same action list, by heading, each row with its progress strip, filters *to brief · to draft · to review · to accept · needs no draft · accepted*, counts at the top ("57 actions: 41 accepted · 3 need no draft · 13 to go"). Opening a row opens the record **with the Drafts section open at the top**.

**5b. The flip (318).** From Organising, clicking an action's title (or "Open") goes to Drafting with that action open; "← Back to Organising" at the top of the record returns to the same scroll position and filters. Deep links `/ideas/[id]/drafting#38`.

**5c. The record on this page, top to bottom:**
1. Statement (Edit the action) and title.
2. **The Brief** (new): see 5d.
3. **"Draft it"** — one button between the Brief and the Draft: asks first with the measured price for this kind; disabled with the reason when the Brief is empty ("write the Brief first — or ask Lex to prefill it"). Beside it: "Needs no draft, because…" (a stated reason, 300 characters, counter).
4. **The Draft** — the instrument: D.38.1 with its header strip (versions, status, law rows), the three views for amendments, Accept / Edit / Ask Lex to redraft / Review this draft. Below it, its **companions** (313): collision report (generate, free), explanatory note (draft, measured), costing (from the cost lines). Each companion says what it is a companion *of*.
5. Action details (explanation; the quoted parts).
6. Law (rows this action wrote).
7. Costs (the lines; 314).
8. Order (dependencies).
9. Comments.
The jump band (256) is updated to this order; "Who, how and against" leaves the band (315).

**5d. The Brief (309).** The drafting instruction (26-U §3a) generalised:
- **Common fields:** *What this draft must do* (free text, no limit, with counter); *Modelled on* (a `[Ref: n]` held in full, or a corpus section, or none); *Tone and form* (short list: statutory · code · guidance · specification · plain rules); *Must include* (numbered points); *Must not* (numbered points).
- **Per-kind fields:** draft clause — the 26-U instruction fields unchanged (instrument, provisions, duty on whom, enforced how, commencement, extent, precedents); code text — issued by, laid before, applies to, revision rule; specification — users, records, measures; costing — basis, price year; operating text and background note — common fields only.
- **Lex prefills** ("Ask Lex to write the Brief", free or a few pence, measured): from the statement, Action details, the slots and the conditions; the prefill is a proposal beside an empty or owner-written Brief; the owner accepts or edits. A Brief the owner wrote is never overwritten.
- **Every save is a version**; the Draft records which Brief version it was drafted from, and says "Brief changed since this draft" when it has.
- The drafter (26-W §4a) reads the Brief first, then Action details; the clause drafter's existing instruction *is* the Brief for that kind, so no second store: `ActionDocument.brief` holds the common fields and the per-kind block, and the 26-U instruction versions migrate into it.

**5e. The #207 migration.** Charlie's text at the head of #207's Action details ("THE ITEMS THE ACCOUNTABILITY AND DELIVERY CODE MUST CARRY …", 17,946 characters) is a Brief, not an explanation. CC **proposes** the split — which paragraphs go to the Brief's *Must include*, which stay as explanation — as a proposal on both fields for Charlie to accept; nothing moves until he does. FieldRevision on acceptance. Report the same for every action on 452c5ade whose Action details open with instrument-like text (26-W's `instrumentLike`).

**5f. The progress strip (310).** States, derived, never stored by hand: *Defined* (statement + heading + kind) → *Briefed* (a Brief version exists, or "needs no draft") → *Drafted* (a draft version exists) → *Reviewed* (all five passes read the current version) → *Accepted* (accepted at the current version). Shapes ● done · ◐ in progress · ○ not yet, each with its word. "Needs no draft" renders as "Defined ● · needs no draft ✓". Shown on every row in Organising and Drafting, in the tree, and in the Development checklist's counts.

---

## §6 The Deepening page (311, 315, 317)

**6a.** Reached from the checklist; locked as §3b. When open, in this order:
1. **Collision** — the schedule document (#203) and every draft's collision report, with counts; "What depends on this" and "for review" as 267/269.
2. **Four models** — the digest (26-T §2) **over drafts** (311): each model is given, per action, the accepted draft where one exists, else the statement, and the digest says per action which it read. The whole-set digest runs here; heading digests stay in Organising. Re-measure the price on scratch (drafts are longer than statements); the button shows it.
3. **Review passes** — the five passes (26-V2d) over every accepted draft; the Risks view (225) grouped by draft.
4. **Coherence and gaps** — the gap check and the conditions × actions table, from the digest.
5. **Costs** — the cost lines rolled up by heading and by year, as a table; "cost–benefit analysis: not yet available" until its brief lands (314).
6. **Who delivers and who resists** (315) — the step-2 slots (Who, Incentive now, What changes it, Skill, How, Against, What tells us it worked) edited here per action, the incentive map "By who" (26-T §3), and "N actions rely on an implementer whose incentive is against and nothing changes it". The stated-positions data (Ingest) joins here when it lands.
**6b.** The policy test (311) reads the accepted draft where one exists; its verdict says "tested against the draft, v2" or "tested against the statement".

---

## §7 Renames (300, 316)

- "Document(s)" → "Draft(s)" wherever it means what we write: the Overview tab, the Deepening tree ("Drafts on actions"), "Draft D.38.1", "Review this draft", "Draft what this action needs", the Actions Pack paragraph, Lex's tools' descriptions and the field guide. "Documents" stays for uploaded files (Sources). Done once in `screen-labels.ts`; report the count.
- Stage names per §2c.
- "Action details" stays.

---

## §8 Verification — `check:lex-26x`

1. The lifecycle bar shows seven stages with state lines from the data (cold read 452c5ade).
2. The checklist's counts equal the data; the lock holds at "N to go" and opens at 0; the override is recorded and printed on every Deepening output (mutation: remove the printed line → red).
3. Organising shows only §4a's tools; no step tabs (browser).
4. The flip: Organising → Drafting with the action open → back to the same scroll and filters (browser).
5. The Brief: per-kind fields; prefill is a proposal; an owner-written Brief is never overwritten; versions kept; the draft names its Brief version and flags a changed Brief.
6. 26-U instruction versions migrated into the Brief with nothing lost (count before/after, text equal).
7. The progress strip's five states derived correctly on fixtures for each kind and for "needs no draft".
8. #207's split is a proposal only; nothing moved until accepted.
9. The digest over drafts: the fixture plants an accepted draft on one action and none on another; the digest says which it read for each; price re-measured.
10. Renames: no "document" label on screen where "draft" is meant; the field guide follows; banners and FAQ carry the seven names; historic documents unchanged.
11. Regression: 26-S2, 26-T, 26-U, 26-V*, 26-W*; `check:prompt-examples`.

## §9 Only Charlie can confirm

The lifecycle bar and the checklist on 452c5ade; the Organising page without the steps; the flip; #207 with its Brief above its Draft and the "Draft it" button between them; the proposed split of #207's Action details; the progress strips; the Deepening page locked, with the count.

## §10 Not in this sprint

The cost–benefit analysis (Ingest brief first, then its own Lex brief); the Private Scrutiny page and print-on-demand (319); the promotional plan; Lex tools for causes editing.
