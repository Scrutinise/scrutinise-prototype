# GRAPH 8 — the onward reader (`onwardFrom()`)

**Written:** 2026-10-23 23:56 UTC. Brief: `docs/BRIEF_GRAPH_8_ONWARD.md`.
**State:** built, `tsc` clean (whole project, exit 0), `check:onward` **22/22, 2,790 assertions over 200,983 rows + 53 inputs, controls 8/8 fired**. Regression: `check:effects` 30/30, `check:lex-26p` 116/116 (14/14 controls; Part B not run), `check:statutory` 17/0, `check:llm-guards` 9/0, `check:prompt-examples` clean, `check:client-boundary` ✓. **Not committed, not pushed, not live.** No schema change.

## What was built

| | file | what |
|---|---|---|
| 1 | `scrutinise-web/lib/lex/onward-pure.ts` | pure: kinds → strengths (`STRENGTH_OF`, a table with no default arm), target parsing, Part/Chapter detection, the three text states, the marked display of stored words, the depth-strengthened caveat, the one renderer (`describeKindLine` / `describeOnwardSummary`), the four rules, and the depth limits |
| 2 | `scrutinise-web/lib/lex/onward.ts` | `onwardFrom(target, opts)` — one step, inbound, read-only, beside `effectsFor()` |
| 3 | `scrutinise-web/lib/lex/agent/onward-tool.ts` | `statute_onward` — category `search`, no idea/user argument — with the four rules **verbatim in the description**, and rule 2 **enforced** in code, not just described |
| 3a | `scrutinise-web/lib/lex/agent/tools.ts` | **registration only**: one import, one list entry. Done after LEX's `13538ec` committed this file, so the file carried no other stream's work when I edited it |
| 4 | `scrutinise-web/scripts/check-onward.ts` | `npm run check:onward` |
| 5 | `scrutinise-web/scripts/measure-onward-branching.ts` | `npm run measure:onward-branching` — §1's table; JSON at `docs/census/graph8-branching.json` |
| 6 | `scrutinise-web/lib/lex/statutory-graph.ts` | **three words added**: `export` on `gidCandidates`, `provisionPredicate`, `resolveActForms`. No logic changed |
| 7 | `scrutinise-web/package.json` | two script lines |

**Shape returned**, as briefed, plus three additions the data made necessary (§7): `scope` on every row and every count (provision vs Act-wide), `notWalked` (counted, deliberately not returned, with the reason), and `next` (distinct nodes to walk). `split` moved from the row to the per-kind count (§7.8).

## 0. The prediction, recorded before measuring

**Recorded 2026-10-23 23:38 UTC, before any multi-depth walk was run.** I adopted the brief's own §2.1 prediction unchanged:

> On a well-cited Act, depth 3 by `cites` returns a substantial fraction of the statute book, because the statute book is densely interlinked. On a lightly-cited Act like CRaG 2010 it returns hundreds. Either way the set is not reviewable by a human, and the proportion of it that genuinely needs amending approaches zero.

At the time I also recorded my own expectation: by the brief's `cites` edge alone, depth 3 would come out *smaller* than predicted, because that edge is thin, and it would reach the predicted scale only if text-detected references were counted.

## 1. The measured branching factor — and the prediction

Breadth-first walk at instrument grain, **de-duplicated** (a node reached at depth 1 is not counted again later), identity-bridged at every hop. Denominator: **250,808 instruments** in `corpus_acts`. Each cell shows the instruments new at that depth, then the cumulative total and its share of the statute book.

| Act | edge set | depth 1 | depth 2 | depth 3 |
|---|---|--:|--:|--:|
| **CRaG 2010** | `cites` (what the reader returns) | 8 | +7 → 15 | +68 → **83** (0.03%) |
| | cites + text references | 75 | +7,493 → 7,568 (3.0%) | +42,062 → **49,630 (19.8%)** |
| | made-under | 16 | **ends** | — |
| | made-under + official effects | 32 | +641 → 673 (0.3%) | +2,310 → 2,983 (1.2%) |
| **Civil Service (MF) Act 1992** | `cites` | **0 — ends** | — | — |
| | cites + text | 3 | +1,598 → 1,601 (0.6%) | +31,447 → **33,048 (13.2%)** |
| | made-under | **0 — ends** | — | — |
| | made-under + effects | 7 | +1,312 → 1,319 (0.5%) | +10,283 → 11,602 (4.6%) |
| **GRAA 2000** | `cites` | 5 | +10 → 15 | +0 → **15 — ends** |
| | cites + text | 164 | +4,109 → 4,273 (1.7%) | +41,764 → **46,037 (18.4%)** |
| | made-under | 74 | **ends** | — |
| | made-under + effects | 96 | +1,284 → 1,380 (0.6%) | +8,684 → 10,064 (4.0%) |
| **Equality Act 2010** | `cites` | 56 | +254 → 310 | +423 → **733** (0.3%) |
| | cites + text | 530 | +16,190 → 16,720 (6.7%) | +39,718 → **56,438 (22.5%)** |
| | made-under | 74 | **ends** | — |
| | made-under + effects | 198 | +2,190 → 2,388 (1.0%) | +2,597 → 4,985 (2.0%) |

The identity bridge met 0 ambiguous-refused forms on any frontier.

**Did the prediction hold? It depends on which edge set "by `cites`" means, so both answers are here.**
- **By the `cites` edge type the brief names, it did NOT hold.** Depth 3 for CRaG is **83 instruments, not hundreds**. GRAA's walk **ends at 15**. The Civil Service Act has **no inbound `cites` at all**. The Equality Act reaches 733 (0.3%), which is large but nowhere near a substantial fraction of the statute book. The reason is §7.1: `cites` holds only marked-up citations.
- **Once the references `cites` never received are counted, it held, and sooner than predicted.** Depth 2 is already **1,601 to 16,720 instruments**, and depth 3 is **13–22% of the statute book** for all four Acts, including the lightly cited ones.
- **The brief did not predict the next one: official effects saturate too.** Made-under plus effects reaches **673–2,388 instruments at depth 2** and up to 4.6% at depth 3. "Walk official effects as far as they go" (brief §4 rule 2) would hand a user thousands of rows by depth 2.
- **Made-under ends after one step for all four Acts.** Nothing in the record is made under any instrument that was made under these Acts. This is the data, not a gap in the extraction: 25,682 made-under rows do target a `uksi`.

**The design consequence, as the brief asked.** The stopping rule is **strength, not depth**, and no depth-3 citation view is built. The rule is now **enforced in the tool, not only described**: at depth ≥ 3, `reference` and `operation` rows are **counted and withheld**, with the count stated. At depth 2, references carry a *weak* label. Made-under walks freely. I rewrote rule 2 accordingly; the brief's version is quoted in §7.2.

## 2. `made-under` and `cites` inbound — the three marquee Acts

| Act | made-under rows (`legislation_edges`) | made-under instruments, old parser / **fixed parser (what the reader uses)** | `cites` rows = instruments |
|---|--:|--:|--:|
| CRaG 2010 (`ukpga/2010/25`) | 29 | 16 / **16** | **8** |
| Civil Service (Management Functions) Act 1992 (`ukpga/1992/61`) | **0** | 0 / **0** | **0** |
| Government Resources and Accounts Act 2000 (`ukpga/2000/20`) | 147 | 74 / **74** | **5** |

The 1992 Act has **nothing** pointing at it by either extracted kind. Its only inbound rows are official effects (4 amends, 1 repeal, 3 modifies, 3 commences) and 7 text-detected references. A depth-1 review set for it is empty, and that is a stated zero.

## 3. The truncation determination — `citation_edge.citation_text`

**Verdict: truncated by construction, at both ends. No stored text is a whole sentence.**

- **The limit, from the data.** The maximum is 300. The top lengths are 300: **144**, 299: **21,029**, 298: **21,990**, 297: **21,450**, 296: 17,542 … 286: 3,081. A natural distribution thins out toward its maximum. This one piles up against it, which is the signature of a cut. `check:onward` B13 asserts that the most populated length among the top twenty is within 3 of the limit.
- **The limit, from the code.** `extract-citation-edges.ts` takes 400 characters of raw XML *before* the reference, strips tags, keeps the last `300 − len(reference) − 1` characters, drops the first partial word, and appends the reference. Two consequences:
  1. **Nothing after the reference is ever stored.** *"section 5 of the 2010 Act does not apply"* and *"section 5 of the 2010 Act applies"* are stored identically. The brief's own example is decided by words before the reference, so the window does catch it. A qualifier that follows the reference is always lost.
  2. **The start is cut mid-text**, often inside a tag. **334,741 of 1,034,548** markup/text rows (32%) begin with tag debris such as `id="schedule-4-paragraph-25-4" RestrictStartDate="2026-04-01">…`.
- **So every stored text is `possibly-truncated`, and the `held` state never fires on today's data.** `check:onward` asserts `held = 0` on every walk. The display form strips the leading tag debris (markup, not words of the law) and marks both ends: `“…words” [cut at the start; the words after the reference are not stored]`. `check:onward` A6 asserts the shown words are a verbatim substring of the stored text.
- **The made-under phrase GRAPH_6 left open is truncated as well**: **23,081 rows at exactly 179 characters**, then 286, 365, 554 … at 178, 177, 176. That is a pile-up, so it is a cut. The reader no longer uses those phrases (§7.4).

## 4. How many `cites` rows carry words

- **On the walks reported here (depth 1, the four Acts): 74 of 74** have words held (CRaG 8/8, GRAA 5/5, Equality Act 61/61, CS(MF)A 0/0). All are `possibly-truncated`.
- **Across the whole table: 116,741 of 121,279 (96.3%)** join to a stored markup window; **4,538 (3.7%) have none** and are returned `none-stored`. `check:onward` B3 asserts the reader's none-stored count equals a separate plain-SQL count of unmatched rows, per Act.
- Joined to the **markup** detection only, because `cites` came from marked-up citations. A `text` detection at the same place is weaker evidence and is never borrowed.
- ⚠ **Some of those "sentences" are explanatory notes.** At least **15,934 of 279,243** joined windows (5.7%) contain the note header *"not part of the [Order/Regulations]"*. That is a floor: only windows that happen to include the header are counted. The s.20 example below has one. These are not provisions of the law.

## 5. Worked example — CRaG 2010 **section 20** (treaties laid before Parliament), depth 1

`onwardFrom('ukpga/2010/25/section/20')` — caveat as returned: *"As at 2026-07-05: this is a stored copy of the record, loaded 110 days ago, so anything recorded since is missing from this step."*

**As the reader describes it (strength kept):**

| heading | kind | count | what the rows actually are |
|---|---|---|---|
| **Made under this — depends on it** | made-under | **11** — **3 name this provision, 8 only the Act as a whole** | ⚠ **None of the 11 is made under s.20**, which confers no power. The 3 that name s.20 record that its *procedure* was met: `ssi/2024/101` *"…the requirements of section 20 of the Constitutional Reform and Governance Act 2010"*; `uksi/2020/38` *"…the Agreement … on Access to Electronic Data … under section 20(1)(a) of the Constitutional Reform and Governance Act 2010"*; `uksi/2024/512` *"…by section 203A(2) of the Representation of the People Act 1983 … the requirements of section 20 of the Constitutional Reform and Governance Act 2010"*. The 8 Act-wide rows are made under **s.52, s.45, s.46** of CRaG, and one under **GRAA 2000 s.4A** (`uksi/2026/216`). Their words say so, but the parser stored no section, so they cannot be excluded |
| | — not walked | 5 | instruments whose words name a **different section** (s.52) — counted, not returned |
| **Operates on this — the official record** | modifies | 3 — **0 change the words**, 2 do not, 1 not classified | EU (Withdrawal Agreement) Act 2020 s.32 and EU (Future Relationship) Act 2020 s.36 (both `excluded` — they *disapply* s.20 for those treaties); `uksi/2014/3249` art.2 (Act-wide) |
| | commences | 2 — 0 change the words | `uksi/2010/2703` (s.20 into force); `uksi/2011/1984` (Act-wide) |
| | amends / repeals | 0 / 0 | stated zeros |
| **Provisions that refer to this — for review** | cites | **6 — 0 name this provision, 6 only the Act** | e.g. `anaw/2013/4` s.72 *"…a special adviser within the meaning of — Chapter 1 of Part 1 of the Constitutional Reform and Governance Act 2010 (c. 25)"*; `uksi/2022/77` reg.2 *"…Parliamentary scrutiny of these Conventions prior to accession and ratification took place under the Constitutional Reform and Governance Act 2010 (c. 25)"* (the one row that concerns s.20 in substance, and it is an explanatory note); `uksi/2010/1278` *"…EXPLANATORY NOTE (This note is not part of the Order) …"* |
| | — not walked | 2 | the citing words name a different provision |

Every quotation is shown as the reader displays it, marked as cut, and none is shown as a whole sentence.

**The same set, wrongly described if the kinds were merged:**

> *"Changing section 20 of the Constitutional Reform and Governance Act 2010 has **22 consequential effects across 21 instruments**, including **11 statutory instruments made under section 20** that would fall with it."*

Every clause of that sentence is false. **No instrument is made under s.20.** **No provision changes** (0 of 5 official rows change the words). The 6 references are things to read, and only one of them concerns s.20 in substance. The merged count adds a commencement order, two disapplications, six mentions of an unrelated Part, and eight instruments made under other sections, then calls the total "consequences". It is the failure this brief exists to prevent, built from real rows.

⚠ **What the reader still gets wrong here, and does not hide.** Its top line still reads *"Made under this — depends on it · made-under: 11"*. The scope split now says *"3 name this provision, 8 only the Act as a whole"*, and every row carries its words. But **the kind itself is wrong for all 11**: the extractor files procedural mentions as enabling powers (§7.4). The reader does not reclassify them, because no rule for that has been validated.

## 6. The mutation run

Two deliberate breaks to the **real** code, run one at a time, each reverted exactly (`grep MUTATION` = 0 in both files; clean run afterwards 21/21, 8/8; B15, the registration case, was added after):

| break | what it did | cases red |
|---|---|---|
| **M1 — a citation row presented as a consequence** | `STRENGTH_OF.cites: 'reference'` → `'dependency'` in `onward-pure.ts` | **4**: A1 (strength table), A2 (the reference heading on the cites line), **B4** (every `cites` row on four Acts now under *"Made under this — depends on it"*), **B11** (the tool's output: cites rows lose the reference heading, and depth-3 citations are no longer withheld) |
| **M2 — the identity bridge dropped at the hop** | `resolution.candidates = gidCandidates(parsed.gid)` in `onward.ts` | **1**: B7 (the 1861 Act under its regnal form loses its 8 `cites`; calendar loses 7 amends and 13 repeals) |

⚠ M2 turned only one case red. B8 tests the bridge at the *other* end (the returned row's form), which is separate code, so it stayed green, correctly. Only the 1861 Act exercises the hop bridge on a live table. A second pre-1963 subject would make that case less of a single point of failure.

**The check caught three defects in my own work, and the worked example a fourth:**
1. My *interpretation* gloss said *"never a drafting consequence"*. The consequence-word guard cannot read negation, and fired (A2). The wording now avoids it.
2. My first pile-up test (299 > 10× 280) was a guessed threshold and failed at 7.9×. It is now the principled form: the mode sits at the limit.
3. A `cites` row whose words named *"Part 1"* excluded it from a walk on **s.20**, but we cannot tell from here which Part s.20 is in. Part, Chapter and `contents` now keep a row as Act-wide and never exclude it.
4. **Caught reading the worked example:** *"made-under: 11"* for s.20 read as *"11 made under s.20"* when 8 name only the Act. GRAPH_6 made the same mistake (its §1.4). The fix is the `scope` split, asserted against SQL in B14 and guarded by control K8.

**Controls (8/8 fired):** cites→dependency, a knock-on word on a reference, an unmarked quotation, a naive prefix match (section-30 for section-3), a depth-blind caveat, a fixed-position gid split on a regnal Act, a tool that shows depth-3 citations, a provision headline without its split.

**Counted, per case:** every case prints rows examined, synthetic inputs and assertions, and a case that read nothing fails. Live cases are cold reads against a separate plain-SQL query written in the check. The check writes nothing.

## 7. What the data said that this brief got wrong

Eight things. Each changed a decision.

1. **`cites` is not "provisions that refer to this". It is the marked-up subset.** `legislation_edges.cites` came from `<Citation>` markup only. For the Equality Act that is **61 rows**, while `citation_edge` holds **~1,180 provisions** in 530 instruments that refer to it (markup + text). So the brief’s review set is **about one in nineteen of the references we hold**. For the Civil Service Act it is **empty**, against 7 text references. This is why the §2.1 prediction failed on `cites` and held on cites + text. **Decision for Charlie / Lex, not taken here:** whether the review set should also return text-detected references as their *own* kind (`mentions`, weaker than `cites`). They must never be merged into `cites`, because a `text` detection is a target *we* derived, not one the document asserted (SURFACE 5).
2. **Official effects do not "walk as far as they go".** Brief rule 2 said: *"Walk `made-under` and official effects as far as they go."* Measured, made-under + effects reaches **673–2,388 instruments at depth 2**, up to 4.6% of the statute book at depth 3. The rule now reads: walk made-under until it ends; stop effects and citations at depth 2. The tool enforces it.
3. **"Walk the dependency chain until it ends" is a one-step walk.** For all four Acts, nothing is made under the instruments made under them. The reader still lets Lex walk it; it will stop at once.
4. **The brief's `made-under` source is the broken one.** `legislation_edges.made-under` (`clml-si-preamble`) came from the preamble parser **before its 28 August fix**: `graph_coverage_fact.madeunder_section_refs_wrong_pct` records **36.1%** of its section refs wrong. On CRaG, *"section 52(2)"* is filed as **section-52 and section-2**, so a walk from s.2 would have returned s.52's commencement orders. **The reader reads `citation_edge` `enabling` rows (the fixed parser) instead**: the same instruments (16 / 74 / 74 against 16 / 74 / 73), plus the words up to the reference. ⚠ **The fixed parser is not clean either.** It files *procedural* mentions as powers (all three s.20 rows, §5). Separately, **23,375 of 100,251** Act-level made-under rows in `legislation_edges` (23%) store words with no power formula ("in exercise of", "conferred by", …). That is noisy (the stored phrase is the *start* of the enacting text, which is not always the power clause), so I report it and did not build a classifier on it.
5. **There is no "sentence" to join** (§3). The stored text is a window that ends at the reference, is cut at the start, and is 32% tag debris at its head. "Return the sentence on every `cites` row" is achievable only as "return a marked fragment".
6. **`cites` rows point at Acts, not provisions: 121,268 of 121,279.** A walk by `cites` from a provision is a walk from the whole Act. Only the words' parsed provision can narrow it, and the reader does narrow it, counting what it drops. That is why every s.20 `cites` row is Act-wide.
7. **Explanatory notes are in the review set.** At least 5.7% of joined windows carry the note header. The `cites` extractor's exclusion zones (Commentaries / Footnotes / Preamble) do not cover `ExplanatoryNotes`. That is an extractor fix for the Graph stream, not something the reader should filter.
8. **`split` belongs on the count, not the row.** On a row it is just `changeKind`. On the per-kind count it is GRAPH_6's change-the-words split, which is where it means something. The per-kind count also carries the **provision / Act-wide `scope`**, which the brief did not ask for and §5 shows is necessary.

## 8. Not done — and for Charlie

- **Not committed, not pushed, not live.** Commit by explicit path: the files in *What was built* (including the three-line `tools.ts` registration), plus `docs/GRAPH_8_REPORT.md`, `docs/census/graph8-branching.json`, and the `CHANGE_LOG.md` / `handoff_summary.md` entries. When edited, `statutory-graph.ts`, `package.json` and `tools.ts` held no other stream's uncommitted work. ⚠ **Diff each one again before committing.** LEX is live in this tree, and `tools.ts` is a file it edits often.
- **`statute_onward` is registered**, so Lex can call it as soon as this deploys. It is `search` / `free`: it reads the law, nothing of the user's.
- **Not run through a live model turn.** Suggested after deploy: one Lex turn on *"what else would I need to look at if I changed s.20 of CRaG?"*. Read the answer for the words *consequence*, *knock-on*, or "made under s.20".
- **Decisions waiting:** (a) §7.1 — add text-detected references as a separate `mentions` kind? (b) §7.4 — commission a validated rule that tells an enabling power from a procedural mention (CRaG s.20 is the test case)? (c) §7.7 — exclude `ExplanatoryNotes` in the `cites` extractor and re-extract?
- **The 233 annexe** ("Consequential amendments and repeals") is not filled from this reader, and rule 4 in the tool description says it must never be.
