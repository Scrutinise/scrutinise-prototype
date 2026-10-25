# BRIEF 26-V — LEX: The Deepening — documents on actions, the document tree, D-numbers, "draft what this heading needs"

**From CCh-Lex, 23 October 2026.** Stage 3 of the seven, given its content. Decisions 239–246 (§1). Builds on 26-S2 (the action record), 26-T (the Actions Pack), 26-U (drafting instructions, clauses, what each touches, the join), GRAPH 6/7 (effects reader, idea↔law table). Charlie's rule, verbatim: *"Our CAs at the moment are just short summary statements. They are meaningless until they actually include the hard detail — the draft code, the draft legislation, the spec for the software."*

---

## §0 Run mode

- As BRIEF_26S §0: continuous; diagnose → CHANGE_LOG → proceed; batch the report (`docs/LEX_26V_REPORT.md`); stop only for spend or scope; CLAUDE.md §25–§31; cold reads; scratch-idea full run before done; `check:prompt-examples`; Charlie's screen is the last check; handoff_summary at every push.
- **Size first; two halves expected.** **26-V1** = §2 structure (documents, parts, D-numbers), §3 the tree, §6 placement (Law and Documents sub-tabs; the stage chip). **26-V2** = §4 the kinds and their templates, §5 "Draft what this heading needs", §7 the review passes re-pointed at documents. Report the split before building.
- **Nothing deletes**; every document and part versioned; proposals beside, never over.
- **Plain words on screen.** "Document", "part", "kind", "drafted / accepted / no document yet". No "artifact", "node", "entity".
- **Prices from measurement**; asks-first above ~5p; long runs on the worker, resumable.

---

## §1 Decisions

| # | Decision |
|---|---|
| 239 | The detail stage is Stage 3, The Deepening — not a fourth kernel section. The existing issue passes become the review of its documents (§7) |
| 240 | Action → documents → parts, three levels, numbered 38.2.1; kinds with templates; "needs a document" derived from avenue and instrument, overridable with a reason |
| 241 | Outputs carry a D-number series (D.38.1) distinct from `[Ref: n]`; a D-number is never cited as evidence |
| 242 | The working view is a tree; a radial map of the same tree is an Overview view, later |
| 243 | "Draft what this heading needs": every missing document of a derivable kind, as proposals, on the worker, measured |
| 244 | "Law" and "Documents" sub-tabs on the Overview; the law table at the top of the Deepening page; the old "Stage: Create" chip retired |
| **245** | **Consequential effects are rows, not documents.** A collision report is one document per action; the amendments it finds are rows in it, with depth; a row becomes a document only when it is a *decision* (we choose to amend X), and then it is a part of the consequential-schedule action, never a nested report (§2c) |
| **246** | Depth of display is three; beyond that the report says "and N further effects — see the schedule", and the schedule action holds the full flattened list (§2c) |

---

## §2 The structure (240, 241, 245, 246)

**2a. Document.** A record owned by one action: `ActionDocument` — action id, kind (§4), number within the action (1, 2, …), title, status (no document yet · drafted · accepted · superseded), versions (each with author: Lex / owner / collaborator, time, text or file), `[Ref: n]` sources it drew on, and its D-number **D.38.2** = action 38, document 2. Kinds that 26-U already stores (the drafting instruction + clause, "what this touches") are migrated into this shape as documents 38.1 and 38.2; no second store.

**2b. Part.** A section of a document that needs its own identity for citation and review: **38.2.1** = part 1 of document 2 of action 38. A part is not a separate record with its own life; it is a numbered section of the document's current version, addressable for comments, print and review. Rules: three levels only (action.document.part); a part never has parts; anything that would need a fourth level is a new document. Example: 38.2 is #38's collision report; 38.2.1 its analysis of CRaG 2010; 38.2.2 of the 2000 Act; 38.2.3 of the 1992 Act.

**2c. The cascade — rows, never nesting (245, 246).** Charlie's case: an action's collision report finds 10 amendments; two of those knock on to 10 more each; three of those to 5 each. That is 10 + 20 + 15 = 45 effects at three depths. They are **rows** in one report, each row carrying: the provision, the effect type (with the "changes the words / does not / unclassified" split from GRAPH 6), its depth (1, 2, 3), and the row it hangs from. The report prints depth 1 in full, depth 2 beneath each depth-1 row, depth 3 beneath those, and stops: "and N further effects — see the schedule". The **consequential-schedule action** ("Consequential amendments and repeals", decision 233) holds the whole flattened list for the idea as its own document — generated, counted per Act, refreshed when the effects data is. Nothing is typed, nothing nests, and ten thousand rows cost nothing to hold. A row becomes a **document** only when it is a decision: "we will amend Act X, s.5" is a part of the schedule action's clause document (its own numbered part, e.g. 210.1.7) with its own drafting instruction line — and from there it is an ordinary part with an ordinary number, not a report inside a report.

**2d. Needs a document — derived.** From the action's avenue and instrument (26-U §3a): legislative → draft clause + collision report (+ the schedule, idea-wide); platform/software → specification; a code → Code text; financial → costing; organisational → plain-English operating text. The checklist line per action: "needs 2 documents: 0 drafted". Override: a tick "needs nothing" with a reason, recorded. A document can also be added by hand of any kind.

**2e. Sources and outputs (241).** The register's `[Ref: n]` series is evidence only. Documents carry D-numbers. The Actions Pack prints "Sources" and "Documents" as two lists. A D-number in any prose is rendered with its status ("D.38.1, drafted, not accepted") so nobody reads a draft as settled. Lex's honesty check refuses a reply that cites a D-number as authority.

---

## §3 The tree (242)

**3a.** The Deepening page's working view: a collapsible tree — heading → action → documents → parts — every node with its number, its kind as a shape (action ■, document ●, part ▸), its state in words, and for an action the "needs N: M drafted" line. Filters: *missing* (needs a document and has none), *drafted, not accepted*, *accepted*. The find box searches titles and numbers.

**3b.** Clicking a document opens it in place (the current version, its versions list, its sources, its parts with their numbers, Accept / Edit / Ask Lex to redraft). Clicking an action opens its record as in step 1.

**3c.** Counts at the top: "58 actions · 31 need documents · 9 drafted · 2 accepted · 22 missing". These are the Deepening's progress, and the stage bar's chip reads from them.

**3d.** The radial map: not in this brief. The tree's data is shaped so the map is a view over it.

---

## §4 The kinds and their templates (26-V2)

| Kind | What it holds | Lex drafts from | Template |
|---|---|---|---|
| Draft clause | the drafting instruction + the illustrative clause (26-U §3) | the action, Commentary, who/how/against, OPC guidance, precedents | as 26-U |
| Collision report | what the clause touches: held text, effects rows with depth, near provisions with their questions, unresolved states (26-U §4) | the effects reader, the join | generated, not drafted |
| Consequential schedule | the idea-wide flattened list (one document on the schedule action) | the effects reader | generated |
| Code text | wording for a statutory or management code: paragraph, duty, on whom, consequence | the action; the existing Code's text where held | short paragraphs, numbered |
| Specification | for the platform or any system: purpose, users, records, rules, measures, what it must not do | the action; the register's data model if filed | sectioned; tables allowed |
| Costing | range, basis, price year, one-off/recurring; Green Book shape where the corpus has it | the action's cost lines, the Green Book | the Deepening's cost annexe reads these |
| Operating text | plain-English rules for an organisational action | the action | numbered rules |
| Background note | what the sources say on this action's question, cited | the notebook, the corpus | cited paragraphs |

Each template is a stored instruction (no real user's words, §27); each drafted document opens with its caveat ("Drafted by Lex from the action and its commentary; not settled") and, where the action had no Commentary, "drafted from a statement with no commentary — expect gaps".

---

## §5 "Draft what this heading needs" (243)

On a heading row in the Deepening: lists the missing documents by action and kind with the measured price per kind (26-U measured a clause at 10.7p, n=5), asks first, runs on the worker, saves each as it finishes, resumable; every result a proposal. "Draft what this action needs" on a single action. Collision reports and schedules are generated without a model call and cost nothing. Report the measured price per kind on scratch before the button shows one.

---

## §6 Placement (244)

- **Overview page:** sub-tabs **Law** (the GRAPH 7 panel, moved from the foot of the page) and **Documents** (the tree, read-only, with counts) beside Coherent Actions. The old "Stage: Create" chip is removed; the stage comes from the seven-stage scheme (decision 135).
- **The Deepening page** (Stage 3 in the workspace bar): the law table at the top; the tree below; the review panel (§7) below that.
- **The Actions Pack** prints each action's documents in number order after its record; Sources and Documents as two lists at the end.

---

## §7 The review passes, re-pointed (239)

The five existing passes (evidence/precedent, legal, financial, political risk, statutory consequences) run over *documents*, not over the kernel: an issue they raise is attached to the document and part it concerns (38.2.1), shown in the tree as a count on the node, answered in the Risks view (225) or by a redraft. The 176 open issues on 452c5ade are re-attached where a document now exists, and otherwise stay on the action. Report counts before and after. No new pass in this brief.

---

## §8 Verification — `check:lex-26v`

1. Migration: 26-U's instruction + clause and "what this touches" appear as documents 38.1 and 38.2 with D-numbers; nothing lost; versions kept.
2. The cascade fixture (10 → 2×10 → 3×5): one collision report with 45 rows at three depths; display stops at depth three with the "see the schedule" line; the schedule document holds all 45 flattened; nothing nested as a document.
3. "Needs a document" derived correctly for each avenue; the override records a reason.
4. D-numbers never appear as `[Ref: n]`; the pack prints two lists; Lex's honesty check refuses a D-number cited as authority.
5. The tree renders counts and filters; a document opens in place; accept and redraft keep versions (browser).
6. "Draft what this heading needs" on scratch: proposals only, resumable, prices recorded.
7. Issues re-attached: counts before/after; none lost.
8. Regression: 26-S2, 26-T, 26-U suites green; `check:prompt-examples` green.

## §9 Only Charlie can confirm

The tree on 452c5ade; opening 38.1 and 38.2; the Law and Documents tabs on the Overview; one "Draft what this heading needs" on Primary legislation; the schedule document's counts against the law panel.

## §10 Not in this sprint

The radial map; Stage 4 review roles and the first recorded review; Word-comment import; the demonstration page.
