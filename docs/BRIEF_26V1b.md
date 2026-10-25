# BRIEF 26-V1b — LEX: the document view, the action record restructured, textual amendments, the card board

**From CCh-Lex, 23 October 2026.** Sits between 26-V1 (live at `39bebee`) and 26-V2 (held). Decisions 255–263 (§1). Charlie's finding on the live record, verbatim: *"It sits right at the bottom of the list when it's almost the most important thing, after the core statement of the CA … there is quite a lot of untidy information here, it's not at all clear what to do, what the information is, and how it fits together."* 26-V2 would pour more documents into that view; this brief fixes the view first.

---

## §0 Run mode

- As BRIEF_26S §0: continuous; diagnose → CHANGE_LOG → proceed; batch the report (`docs/LEX_26V1b_REPORT.md`); stop only for spend or scope; CLAUDE.md §25–§31; cold reads; scratch-idea run before done; `check:prompt-examples`; Charlie's screen is the last check; handoff_summary at every push.
- **Size first; two halves expected.** **V1b-a** = §2 the record restructured, §3 the document view, §6 the Law panel fixes. **V1b-b** = §4 textual amendments and the three views, §5 the explanatory note, §7 the card board. Report the split before building.
- **Schema before code, always** (§0 of 25-C; the V1 data move on 23 Oct ran ahead of the code that read it and the live site showed no draft on #38 and #202 for an hour). Any data move in this brief ships in the same push as, or after, the code that reads it — never before.
- **Nothing deletes; proposals beside, never over; every rejection worded; limits with counters; no colour alone** (Charlie is colour blind: shape + word on every state).
- **Plain words on screen.** "Document", "version", "accepted", "as it stands / marked up / as amended". No "artifact", "node", "diff".
- **Prices from measurement**; asks-first above ~5p.

---

## §1 Decisions

| # | Decision |
|---|---|
| 255 | A **card board** as a toggle beside List in step 1 (columns = the instruments; drag to re-head, drag onto another to merge, "possible merges" list beside it, click one and both cards are outlined and named) — §7 |
| 256 | A **jump band** under the statement, above the policy test: *Detail · Documents · Law · Who, how and against · Costs · Order · Comments*, each with its state in words, plus the heading dropdown; overflow into a ≡ menu — §2 |
| 257 | **"Commentary" is renamed "Detail"** everywhere (the box is already labelled "Detail, parts, tables — no limit"); "Comments" stays the name of the thread — §2 |
| 258 | **Three views of a textual amendment**: as it stands · marked up · as amended, generated from the held text and the clause; Lex drafts amendments in textual form (OPC Drafting Guidance Part 6) — §4 |
| 259 | **Explanatory note** as a document kind: plain English, one paragraph per subsection, drafted by Lex from the instruction and the Detail — §5 |
| 260 | **Order:** this brief before 26-V2 |
| 261 | "What this touches" gains two blocks per target: **statutory instruments made under it** and **judgments interpreting it** (from the citator), each shown only where data exists, otherwise "none held" — §3c |
| **262** | **Now / Next / Later is retired.** Step 4 "Order" keeps only dependencies ("must come after #N, because …"); the order is derived from them. The three words were vague and nobody found a use for them. Existing `sequence` values are kept in the data and not shown — §7b |
| **263** | **"Used" and "accepted" stay two acts, and the screen says so.** Using Lex's proposal makes it version 1 and writes law rows; Accept is the owner's sign-off on the document. After use, the header strip reads "Version 1 saved · 7 law rows written · not yet accepted — Accept when you are content" — §3a |

---

## §2 The action record, restructured (256, 257)

**2a. Order of sections, top to bottom:** Statement → **jump band** → policy test → Detail → **Documents** → Law → Who, how and against → Costs → Order → Comments. Why Documents second: the statement says *what*; the documents are the *thing itself*; everything else is about them.

**2b. The jump band.** One row of buttons directly under the statement box: each names its section and its state in words — "Detail · 7 parts", "Documents · 2 needed, 1 drafted", "Law · 7 rows", "Who, how and against · 1 of 7", "Costs · not answered", "Order · after #59", "Comments · 3". Clicking scrolls to and opens that section. The heading dropdown (Primary legislation …) sits at the right of the band. Where the band overflows, the remainder goes into a ≡ menu labelled "More". The band is sticky while the record is open, so it is also the way back up.

**2c. Rename.** Every "Commentary" label, heading, tooltip, pack section title and Lex instruction becomes "Detail". The database column keeps its name (no migration for a label). `check:prompt-examples` and the 26-S2/26-T/26-U suites are updated by name. Report the count of strings changed.

**2d. Imported blocks.** The "— More on this action, imported … —" blocks in Detail (26-U §2) are shown as a collapsible list "Parts of this action, quoted (7)", one line per part with the source `[Ref: n]`, expanding to the quote. Today they are a wall of text (Charlie's first screenshot).

---

## §3 The document view (261, 263)

Opening a document — from the record's Documents section, from the tree, or from a D-number anywhere — shows one page with a **header strip** and **five tabs**.

**3a. Header strip.** "D.38.1 · Drafting instruction and clause · version 2, yours (from Lex's v1) · **not yet accepted** · 7 law rows written: FOI Sch 1, Procurement Act 2023, CRaG s.3, NAA 1983, + 3 precedents". Buttons: **Accept** (sign-off; status → accepted; a later edit → "accepted, then changed — accept again") · **Edit** (opens the instruction form and the clause for a new version) · **Ask Lex to redraft** (asks-first, measured) · **Versions**. The strip answers "what did my save do" (263) without a question.

**3b. Tab: Text.** The clause, numbered subsections, each a part (38.1.1 …) with a comment count. For a textual amendment the three views of §4; otherwise "as proposed" only, with the line "a new section — nothing to mark up". The caveat is the first line always.

**3c. Tab: Instruction.** The fields as a **form and a table**, never prose:

| Act | Provision | What we do | Why |
|---|---|---|---|
| CRaG 2010 | s.3 | relies on | the Minister's existing management power is the basis for issuing the Code |

Then Duty on whom · Enforced how · Commencement · Extent · Precedents (a second table: Act · provision · what we take from it). Lex's reasoning (the grey block in Charlie's screenshot) moves out of the fields into a collapsible "Why Lex drafted it this way" under the table. Migration: existing versions whose provision `note` holds reasoning are left as they are (nothing rewritten); new drafts put reasoning in the collapsible and a one-line *why* in the table.

**3d. Tab: What it touches.** Per target, in this order, each block only where data exists and "none held" in words otherwise:
1. the held text (`read_section`);
2. changes already made to it, from the official record (GRAPH 6 figures, as V1);
3. **statutory instruments made under it** (261) — the corpus's `uksi` rows naming this Act as their enabling power, title and year, linked;
4. **judgments interpreting it** (261) — from the citator, case name, court, year, the paragraph that cites the provision, linked; for *constrains* and *amends* targets;
5. near provisions with their question (26-U §4);
6. the collision rows (D.38.2) at depth 1, with "depths 2–3 wait on the graph" until GRAPH answers.

**3e. Tab: Versions.** Every version with author, time, what changed (a word count and the provision lines added or dropped), and the law rows it wrote or withdrew. A dismissed proposal is listed as "Lex's proposal v1 — set aside on 23 Oct when v2 arrived" (nothing deletes).

**3f. Tab: Issues.** What the five review passes have raised on this document and its parts (counts by pass; each issue with the part number it concerns). Read-only here; answered in the Risks view or by a redraft. Where V1 has not yet re-attached issues to documents, the tab says "issues are still attached to the action — see the Risks view".

**3g. Lex's proposal beside the current version.** A **three-column comparison**: *as it stands* (the current version) · *Lex proposes* · *your working copy*. Per subsection: **Take this** (copies that part into the working copy) · and at the top **Take all** · **Set aside** (proposal marked set-aside, kept) · **Save as version N**. Lex's reasoning paragraph is collapsible above the columns. Nothing in the proposal column is editable; the working copy is.

**3h. The Documents section on the record** (what the jump band's "Documents" lands on): one line per document — number, kind, status in words, version, law-row count — and the derived "needs" lines ("collision report — none yet · generate"), each opening the view. "Add a document" (kind chosen from the list) and "Draft what this action needs" (V2's button, shown disabled with "coming in the next sprint" until V2 lands — §31 says show only the current step's tools; this is the current step).

---

## §4 Textual amendments and the three views (258)

**4a. Lex drafts amendments in textual form.** When the instruction's relation is *amends* or *repeals*, the clause is written as the OPC does it: "In section 5 of the Constitutional Reform and Governance Act 2010, for subsection (2) substitute— …", "omit paragraph (b)", "after subsection (3) insert— …". Lex reads OPC Drafting Guidance Part 6 (held) and is told the forms. A non-textual modification ("has effect as if …", as #202's v2 subsection (2) does for SI 2011/2260) is allowed — it is the *modifies* relation — and the clause carries the line "a non-textual modification: the Regulations are not amended, they are read differently for these bodies", because a reviewer should see the choice.

**4b. The three views**, generated, never typed:
- **As it stands** — the held text of the provision (`read_section`), unchanged.
- **Marked up** — the held text with the omitted words struck through and the inserted words underlined, each change labelled in words beside it ("omitted", "inserted", "substituted") — never colour alone.
- **As amended** — the held text with the change applied.
A toggle of three buttons above the text. Where the amendment cannot be applied mechanically (the words to substitute are not found in the held text), the view says so in words — "the words 'X' were not found in section 5 as held; the marked-up view cannot be drawn — check the clause" — and shows as-it-stands and the clause side by side. That line is a finding for the owner, not an error.

**4c. Parser.** A small, deterministic reader of the OPC forms (substitute / omit / insert / after … insert / for … substitute) over subsection and paragraph addresses in the held text's structure. Report its coverage on the real clauses on 452c5ade (how many amendments parse; which do not and why). No model call.

**4d. Check:** a fixture clause with one substitute, one omit, one insert against a held section renders all three views correctly, with the labels; an unmatched substitute renders the "not found" line; a *modifies* clause renders "as proposed" with the non-textual line.

---

## §5 The explanatory note (259)

**5a.** A document kind, D.38.3 by default when a clause exists: one plain-English paragraph per subsection — what it does, who it binds, what changes for them — plus an opening paragraph on the purpose and a closing one on commencement and extent. Drafted by Lex (asks-first, measured on scratch before the button shows a price) from the instruction, the clause and the Detail; cited `[Ref: n]` where it draws on a source; the caveat first ("Drafted by Lex from the clause; not settled; not the Explanatory Notes Parliament will receive"). It is derived as "needed" for every legislative action with an accepted clause.

**5b.** Printed in the Actions Pack after its clause; the Introductory Summary may quote its opening paragraph.

---

## §6 The Law panel fixes (from CC's 23 Oct read-back)

**6a. Source label.** "From a drafting instruction (f333354f-… v1)" becomes "From #38's drafting instruction, version 1" — the action's number and title, never the internal id, anywhere on screen.

**6b. Merging rules shown in words.** A hand row for the whole Act and an instruction row for one of its schedules are different targets and rightly separate lines; the panel says so: under the whole-Act line, "also named at: Schedule 1, by #38's instruction (relies on)". Likewise where relations differ ("CRaG 2010 — amends, by hand · relies on s.3, by #38"). The reader sees one Act once, with its parts and relations beneath, rather than hunting two groups.

**6c. A question the panel should ask.** Charlie's hand row says the idea **amends** CRaG 2010; no accepted instruction yet does — #38 as drafted is a new Act that *relies on* CRaG s.3. The panel prints, under a hand *amends* row with no instruction row behind it: "no action's instruction yet amends this Act — which action will?" That is the gap between the stated position and the drafted one, and it is exactly what a reviewer looks for.

---

## §7 The card board and the Order step (255, 262)

**7a. Step 1 board.** Toggle *List · Board* on the step-1 toolbar. Columns = the idea's headings in list order (+ "Unsorted"); cards = live actions (number, title, "needs N documents: M drafted", conditions as small chips). Drag a card to another column = re-head (the existing `assignHeading`, with its worded refusal). Drag a card onto another = the existing merge dialogue opens with both. Beside the board, the existing "possible merges" list; clicking one outlines both cards (thick outline + the word "pair" on each) and scrolls them into view. The find box filters cards. Ruled-out and Later-phase actions are not on the board (as the list).

**7b. Step 4 Order, by dependency only (262).** The Now / Next / Later control and columns are removed from the screen; `sequence` stays in the data, unshown. The step shows each action with "must come after: #59 (the Code must exist before the duty bites)" — the existing `beforeIds` with a *because* line (new, optional, 300 characters, counter). The derived order is printed as a numbered list with the reasons, and the Actions Pack's Order section prints the same. A cycle (A after B after A) is refused in words naming both actions.

---

## §8 Verification — `check:lex-26v1b`

1. The record's section order and the jump band's states match the data (browser); the band's ≡ menu appears at a narrow width.
2. "Commentary" appears nowhere on screen or in a prompt; count of strings changed reported; suites green by name.
3. The document view: header strip text matches the database (version, status, law-row count) on D.38.1 after Charlie's use and after an Accept (two states, 263).
4. The instruction tab renders the provision lines as a table; reasoning is in the collapsible, not the cells (fixture).
5. SIs and judgments blocks: present where the corpus holds them for CRaG s.10 and Equality Act s.149; "none held" for a provision with none; never an empty block.
6. The three views on the §4d fixture; the "not found" line on the unmatched case; the non-textual line on a *modifies* clause.
7. The three-column comparison: Take this, Take all, Set aside, Save — the set-aside proposal is kept and listed in Versions.
8. Explanatory note drafted on scratch; price measured and reported; caveat first; printed after its clause in the pack.
9. Law panel: no internal id on screen; the "also named at" lines; the "which action will?" question appears for CRaG and disappears when a fixture instruction amends it.
10. Board: drag to re-head and drag to merge call the existing paths (browser); a merge-pair click outlines both.
11. Order: no Now/Next/Later on screen; a cycle refused in words.
12. Regression: 26-S2, 26-T, 26-U, 26-V suites green; `check:prompt-examples` green; `check:client-boundary` green.

## §9 Only Charlie can confirm

The record for #38 top to bottom; D.38.1's header strip before and after Accept; the three views on the first textual amendment Lex drafts (likely #202 on Equality Act s.149 — if its v2 is non-textual, redraft one amendment textually to see the mark-up); the explanatory note read cold; the board on Primary legislation; the Law panel's "which action will?" line.

## §10 Not in this sprint

26-V2 (templates for the other kinds, "Draft what this heading needs" on the worker, review passes re-pointed); a combined "Law & Docs" control on the working panels (Charlie: review after this lands); depths 2–3 of the cascade (GRAPH); the radial map; Stage 4 roles.
