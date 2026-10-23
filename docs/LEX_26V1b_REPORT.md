# LEX 26-V1b — Report

**Status, 2026-10-24: V1b-b BUILT — see "V1b-b" below for the push and live verification.** V1b-a LIVE at `009198f`.

## V1b-b — size first (24 Oct, before building)

- **§6 had nothing left.** 6a, 6b and 6c all went live in V1b-a.
- **No split needed.** The work is about V1b-a's size, which went in one push. Built in this order: §7 and §4 (no spend, no schema), then §5 (one schema change, a priced scratch run).
- **Measured before building:**
  - Only #202 on 452c5ade carries textual amendments: v1 "at the end insert", v2 "after subsection (1) insert". v2(2) is non-textual (*modifies*). No substitute or omit exists yet, so the §4d fixture carries those.
  - The corpus holds a section's text FLATTENED ("149 1 A public authority … a eliminate …"). The parser reads subsection numbers and paragraph letters in sequence, never as bare numbers.
  - `action_document.kind` is a CHECK list, so the explanatory note needs one schema change. It ships in the same push as the code.
  - `parseRecord` drops any key it does not know, so the new `orderBecause` had to be added there or a slot save would wipe it.
- **Settings:** `.claude/settings.local.json` holds no legacy Railway password lines (no `rlwy`, connection string or password match). Already done; nothing to remove.

## V1b-b — what was built

- **§7a, the card board** (255; `components/lex/ActionsBoard.tsx`).
  - Step 1's views are List · **Board** · Coverage grid · Conditions.
  - Columns are the headings in list order, then "Unsorted". Cards show the number, the title, "needs N documents: M drafted" (from the documents tree) and the conditions as chips.
  - The find box filters the cards. Ruled-out and Later-phase actions are not on the board.
  - **Drag to a column** re-heads through the existing `assignHeading`. **Drag onto a card** opens the existing merge dialogue with both, and nothing merges until it is confirmed there. Each card also has a "Move to…" menu, so nothing needs a drag.
  - Beside the board is "Possible merges" (Find duplicates, free). Clicking a pair outlines both cards with a thick border **and the word "pair"**, then scrolls them into view.
- **§7b, Order by dependency only** (262; `lib/lex/action-order-pure.ts`, `components/lex/ActionsOrder.tsx`).
  - Now / Next / Later is gone from the screen, the pack, Lex's tools and Lex's step-4 classify. `sequence` keeps its values in the data, unshown. An old proposal's sequence is dropped on accept, never written.
  - An opened record shows "Must come after #59" with a **because line** (optional, 300 characters, counter), Remove, and Add.
  - Storage: the edge is the existing `beforeIds`. The because line is `record.orderBecause` on the later action, keyed by the earlier one. No migration.
  - Step 4's view is **"The order, derived"**: a numbered list with the reasons. Ties keep the list's order, and actions caught in a circle are named apart.
  - **A circle is refused in words naming both:** "#59 cannot come after #202: #202 already has to come after #59. An order cannot go round in a circle…". The refusal runs on all three paths that write `beforeIds`: the screen's `setAfter`, `setFacets` (Lex's `set_action_facets` too), and accepting Lex's proposals (a refused one is said, not written).
  - Lex has a new tool, `set_action_order` (the same server function). `list_actions` gives "mustComeAfter" with the reasons.
  - **Actions Pack:** paragraph 9 keeps its number and reads "Order: must come after #59 (because …)". A new ORDER section prints the derived order.
  - The step-4 checklist counts actions placed by nothing, and says so if there is a circle.
- **§4, textual amendments and the three views** (258; `lib/lex/textual-amendment-pure.ts`, `components/lex/AmendmentViews.tsx`).
  - **The parser** is deterministic, with no model call. It reads "In section N of the X Act YYYY (…)," followed by: for subsection/paragraph … substitute—; omit …; after … insert—; at the end insert—; for “a” substitute “b”; omit “a”; after “a” insert “b”; "is repealed"; a lettered list under one head; and "in subsection (n)," scoping.
  - **The views** sit on the Text tab: a toggle of three buttons, **As it stands · Marked up · As amended**. Marked up strikes omitted words (`<del>`), underlines inserted ones (`<ins>`), and labels each changed line in words: "substituted", "omitted", "inserted", "repealed".
  - **Findings, in words:**
    - "the words ‘X’ were not found in section 149 as held; the marked-up view cannot be drawn for it — check the clause". The view then shows as-it-stands and the clause side by side.
    - The section is not held.
    - The instruction does not name the section.
    - **A new one:** an inserted subsection whose number the section already uses.
  - **Non-textual** ("has effect as if …") shows "as proposed" with "A non-textual modification: the … Regulations … are not amended; they are read differently for these bodies."
  - **§4a, the prompt.** Lex is told the Part 6 forms, to quote old words exactly, to number inserted provisions so they do not collide, and that non-textual is for *modifies* only (with the line). On a redraft it now receives the **held text** of each section its instruction amends.
  - The server returns that held text in the document view (`held`), as a free read.
- **§5, the explanatory note** (259; `lib/lex/explanatory-note.ts`, `explanatory-note-pure.ts`).
  - It is a document kind, `EXPLANATORY_NOTE`, derived as **needed for every legislative action whose clause has been accepted**.
  - Lex drafts it from the instruction, the clause and the Detail, as a **proposal** beside the note's versions. The owner chooses "Use it as version N" or "Set aside" (kept).
  - **The note's shape:** the caveat first ("Drafted by Lex from the clause; not settled; not the Explanatory Notes Parliament will receive."), then Purpose, one part per subsection, and Commencement and extent.
  - **What is said:** a `[Ref: n]` the Detail does not cite is taken out and said. A subsection Lex skipped is said in the note.
  - **Pack:** printed straight after its clause.
  - **Asks first, always**, at the measured price, from the record's Documents section ("draft it with Lex (about 1.9p)") and from the note's own view ("Ask Lex to redraft").
  - **Schema:** `prisma/lex_26v1b_explanatory_note.sql` widens `action_document_kind_check` by one value. It is applied with this push, not before.
  - **Not built:** the Introductory Summary quoting the note's opening paragraph (§5b says "may"). `noteOpening()` exists for it.

### §4c — the parser's coverage on 452c5ade (read, nothing written)

| | |
|---|---|
| Clause texts on the idea | 4 (#38 v1 and its proposal; #202 proposals 1 and 2) |
| Textual amendments | **2, both parse** (one operation each); **0 unread** |
| Non-textual | 1 (#202 v2(2), the 2011 Specific Duties Regulations) |
| **A real finding** | #202's **proposal 1** inserts "(8)" "at the end" of s.149, but s.149 as held already has (8) and (9). The view says so. (Proposal 2, which inserts (1A), is clean.) |

### §5 — the price, measured on a scratch copy (spent: 5.65p)

| Run | Pence | Seconds |
|---|---|---|
| #38 version 1 (16 subsections) | 2.56 | 16.5 |
| #202 proposal 2 | 1.57 | 9.9 |
| #202 proposal 1 | 1.52 | 10.2 |

The mean is **1.9p** (n=3). That is under the 5p threshold, but the button still asks first, as §5a says.
- **The method:** a scratch copy carries no documents, so each clause was read from 452c5ade read-only and composed with `composeNote`, which writes nothing.
- **The spend:** ledgered to the copy, which was deleted after.
- `scripts/measure-26v1b-note.ts` re-measures. **Nothing was spent on Charlie's idea.**

### Choices made, not asked
- **The board's chips** show the conditions an action delivers, "condition 2" or "support". The cards' document counts come from one read of the documents tree.
- **Where the because line is stored:** on the later action (it answers "why must THIS come after that").
- **Old snapshots in the pack:** one with no because lines reads the order back from `beforeNumbers`, without reasons.
- **The explanatory note** drafts from the clause's CURRENT version and says which version in its reason.

### Only Charlie can confirm (§9)
- The board on Primary legislation (drag, merge pair).
- Step 4 with a because line.
- #202's Text tab: the three views on proposal 2 once used; proposal 1's "(8)" finding.
- An explanatory note read cold (a few pence on his own idea; **not run, asks first**).
- The schema pair `befa05c` (263: a document keeps its last accepted version) was pushed first.
- **Verified live:** `/api/health` reports `009198fd…` (production). "Parts of this action, quoted" is in a live chunk, and the control string is in none. build-worker deployed itself as `bf60a5ee`, which went SUCCESS with `meta.commitHash` `009198fd61d6`. Its container printed "retrieval configuration OK" at 19:21:37 UTC.
- The full regression and the clean build pass. The one exception is GRAPH's `check:idea-law` E1, which compares line count with merged rows and is not caused by this code; see CHANGE_LOG.
- V1b-b is not started.

## V1b-a — what was built

- **§2, the record restructured** (`ActionsWorkspace.tsx` OpenAction; `ActionRecordSections.tsx`; `record-layout-pure.ts`).
  - **One order, top to bottom:** Statement → jump band → policy test → Detail → Documents → Law → Who, how and against → Costs → Order → Comments.
  - **Steps:** the current step's section is open; another step's sits in its place under one line (§31).
  - **Step 1's other tools** (Sources, the originals, Later phase, Rule out) sit after Order.
  - **The jump band** (256): one button per section, each with its state in words ("Documents · 2 needed, 1 drafted"). The heading menu is at the right. It is sticky. At narrow widths the rest goes under "≡ More".
  - **The rename** (257): "Commentary" → "Detail". 38 changed lines carried the word, across 13 files: the label, the placeholders, the refusal, the structure tools, the digest, the Proposal heading, and Lex's prompts and tools.
    - Lex's tool is now `set_action_detail`, and `add_action` takes `detail`.
    - The column keeps its name.
    - The *causes* commentary (25-O) is a different feature and keeps its name (question 1 below).
  - **2d:** the quoted parts are one collapsible "Parts of this action, quoted (N)", one line per part with its source, each opening to its quote.
- **§3, the document view** (`DocumentView.tsx`; server `document-view.ts`; pure `document-view-pure.ts`). One view, opened from the record's Documents section and from the tree.
  - **The header strip** (263).
    - Example: "D.38.1 · Drafting instruction and clause · version 1, Lex's draft (proposal 1), used by you · 7 law rows written: … · **not yet accepted** — Accept when you are content".
    - Its buttons: Accept · Edit · Ask Lex to redraft (asks first, measured price) · Versions.
    - ⚠ Schema `befa05c`: a later version keeps `accepted_v`, so the strip can say "accepted at version 1, then changed — accept again". 26-V1's CHECK had forced it to null.
  - **Tabs:**
    - **Text:** caveat first; numbered parts 38.1.1…; "As proposed — a new section; nothing to mark up". An amendment reads "Shown as proposed", because the three views are V1b-b.
    - **Instruction:** a table (Act · Provision · What we do · Why); the fields; a Precedents table; "Why Lex drafted it this way" collapsible. Existing notes are left as written, and the drafting prompt now asks for a one-line note.
    - **What it touches:** five blocks per target, each "none held" in words where empty:
      1. the held text;
      2. official changes;
      3. **SIs made under it** (the citator's `enabling` rows);
      4. **judgments interpreting it** (the citator's case-law rows: name, court, date, citing paragraph, link; the ten most recent);
      5. near provisions.

      Then the collision-report line, "depths 2–3 wait on the graph".
    - **Versions:** each version with author, what changed, and the law rows it wrote or withdrew. "Lex's proposal 1 — set aside on 23 Oct when proposal 2 arrived. Kept."
    - **Issues:** says the passes' issues are on the idea, not yet on documents (V2).
  - **3g, the three-column comparison:**
    - As it stands · Lex proposes · your working copy.
    - "Take this" per subsection, Take all, Set aside (kept), and "Save as version N".
    - Take all saved unchanged uses Lex's whole instruction, so its provision lines write their law rows. A mixed copy keeps your instruction's other fields, and says so beside the button.
  - **3h, the record's Documents section:**
    - one line per document (number, kind, status in words, version, law rows);
    - the missing kinds, with generate / write / "draft it with Lex (about 10.8p)", asks first;
    - Add a document;
    - "Draft what this action needs", disabled, with "coming in the next sprint".
  - **Retired:** the record's old "Draft text and what this touches" block. The tree's in-place view is now this same view.
- **§6, the Law panel** (`law-panel-words.ts`; GRAPH's `IdeaLawPanel.tsx`, display only):
  - **6a:** "From #38's drafting instruction, version 1". No internal id anywhere.
  - **6b:** "Also named at: schedule 1, relies on, by #38" under the whole-Act FOI line. The seven groups stay separate (GRAPH's constraint d), so the cross-reference is said on each line rather than the groups being merged.
  - **6c:** "Question: No action's instruction yet amends this Act — which action will?" under Charlie's CRaG "amends" row. It goes once an instruction amends CRaG (checked on scratch).
- **`check:lex-26v1b`** 42/42, 6 controls fired (0 dead).
  - It covers items 1, 2, 3 (both states), 4, 5, 7 and 9, with a cold read of 452c5ade.
  - Mutation: putting the raw id back into the source line turned it red, with three failures.
  - `check:lex-26v` (50/50) was updated for 263 and the new view. Its cold read now allows for Charlie having used #38's proposal.

### Choices made, not asked
- **Judgments are shown for every held target**, not only *constrains* and *amends* ones as §3d says, because §8.5 asks for them on CRaG s.10, a *relies on* target.
- **"Must come after"** in the band is the inverse of `beforeIds`.
- **Comments on a single part** are not built. The Text tab says so.
- **Opening a document from a D-number in chat** is not built (as in V1).

## §0 Size and split (as the brief's §0 asks, before building)

I agree with the brief's split, with three placements made explicit.

### V1b-a: the record, the document view, the Law panel (no model spend)

- **§2 the record restructured.**
  - The section order, and the sticky jump band with states in words and a ≡ "More" menu.
  - **The rename.** "Commentary" becomes "Detail" in every label, prompt and pack title for the *action's* box.
  - **Imported blocks.** These become a collapsible "Parts of this action, quoted (N)".
  - Files: `ActionsWorkspace.tsx` OpenAction (:791-953), `FieldsPanel.tsx` ActionCard (:1612-1730), and the prompts (`action-draft.ts`, `agent/system-prompt.ts`, `agent/tools.ts`, `action-digest-pure.ts`). The pack and proposal titles are in `build-proposal.ts` :741 and `actions-pack-read.ts`.
- **§3 the document view.** One component, opened from the record, the tree, and a D-number:
  - **Header strip** (263): use and accept are two acts.
  - **Tabs:**
    - **Text:** numbered parts. "As proposed" only until V1b-b brings the three views.
    - **Instruction:** a table, with a collapsible "Why Lex drafted it this way".
    - **What it touches:** the existing 26-U reader, plus SIs made under it and judgments interpreting it.
    - **Versions:** each version's law rows read from `idea_law_link`.
    - **Issues:** the worded "still attached to the action" line, because `DeepeningIssue` has no action tie until V2.
  - **The three-column comparison** (§3g).
  - **The record's Documents section** (§3h).
- **§6 Law panel.**
  - 6a "From #38's drafting instruction, version 1" (display only; the stored `source_detail` is not rewritten).
  - 6b "also named at" lines under one Act.
  - 6c "no action's instruction yet amends this Act — which action will?"
- **`check:lex-26v1b`** items 1–5, 7 and 9, plus the regression.

### V1b-b: textual amendments, the explanatory note, the board and Order (spends a little)

- **§4.** Lex's amendment forms, the deterministic OPC-form parser with its coverage on 452c5ade, and the three views.
- **§5.** The explanatory note kind, priced on scratch first.
- **§7.** The List · Board toggle on the existing re-head and merge paths. Order by dependency only, with a "because" line and refusing a cycle.
- **`check:lex-26v1b`** items 6, 8, 10 and 11.

### Measured before sizing (read off Neon today, not inferred)

- **Judgments interpreting a provision exist.**
  - `citation_edge` holds 1,288,630 `caselaw` rows.
  - Equality Act s.149 is cited by **483 judgments** (3,099 rows), each with the citing paragraph.
  - CRaG s.10 is cited by **0**, so it reads "none held".
  - ⚠ The provision ref is in the form `section-149`, not `section/149`, and the detection is `caselaw-markup`. `detectionOf()` in `statutory-graph.ts` does not recognise that detection, so `inboundFor` would file every one of these rows as unrecognised. The new block reads them directly.
- **SIs made under a provision exist.**
  - 191,258 `enabling` rows. Equality Act s.149 has **0** (it confers no power, so "none held"); s.153 has 6.
  - Where an enabling row names no provision, it is shown only at the Act level, and labelled so.
- **"Must come after" needs no schema.** It is the inverse of the existing `beforeIds`. The new "because" line can live in the action's `record` JSON (as `orderBecause`), so §7b needs no migration.

### Questions (none blocks V1b-a; my default is in brackets)

1. **Which "Commentary" does 257 rename?** The *causes* commentary (25-O, the Diagnosis page: "a short commentary on the causes") is a separate feature with its own route. [Rename only the action's box. The causes commentary keeps its name, and §8.2's "nowhere on screen" is asserted over the action record, its prompts and the pack.]
2. **The jump band's "Comments · 3".** "Comments" here is the 26-T2 thread on the action, which the UI elsewhere calls Contributions (docs/CLAUDE.md §4). [Keep "Comments", as the brief says.]
3. **Spend in V1b-b.**
   - The explanatory note, priced on scratch first: a few pence per run, n≥3.
   - §9's textual redraft, for example #202's s.149 amendment, which is already textual: "after subsection (1) insert —".
     - #202's v2 is textual in (1) and non-textual in (2). So it already exercises both the three views and the non-textual line, and **no redraft may be needed**.
     - If one is, it asks first (about 9p).

## Spend

None yet.
