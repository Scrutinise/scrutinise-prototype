# LEX 26-V — Report

**Status, 2026-10-23 10:40 UTC: 26-V1 PUSHED AND VERIFIED LIVE at `39bebee`** (`/api/health`; the tree’s find-box text in live chunk `28729d09a063ff78.js`; build-worker `a7cb3837` push-triggered, `meta.commitHash` `39bebee0a20e`, "retrieval configuration OK" 10:39:14). Charlie’s screen is the last check (§5). 26-V2 is not started. The answers to §3's questions are in CCh 23 Oct (9): 250 "Reports"; 251 stored as versions, stale-marked; 252 rows with depth, depth 1 filled, GRAPH asked; 253 the worker (V2); 254 both badges.

## §5 26-V1 — what was built (CHANGE_LOG 2026-10-23 10:32)

- **The store.** Two tables, `action_document` and `action_document_version` (schema `3f7f20c`). `lib/lex/action-documents.ts` is the only store; 26-U's draft is document N.1, and `record.draft` is never written again.
- **The move.** #38 and #202 on 452c5ade (two Lex proposals, no versions) moved and read back identical. #203 holds the schedule `D.203.1`.
- **The collision report** (N.2). Generated, free, stored as versions, rows with depth. Depth 1 only until GRAPH supplies 2–3. It is stale-marked in words.
- **Needs a document.** Derived from avenue + instrument; overridden with a reason.
- **The tree.** Counts, filters and find. A document opens in place, with Accept, Edit, and "Ask Lex to redraft" (asks first).
- **Placement.**
  - Overview: Law and Documents sub-tabs; "Reports"; the seven-stage badge.
  - Deepening: law table → tree → passes.
- **Pack.** Section 14 Documents, plus a Documents list beside Sources.
- **Lex.** The prompt rule, documents in the snapshot, and the honesty check's `dnumber-as-authority`.
- **Checks.**
  - `check:lex-26v` 50/50, with a mutation run.
  - The red checks are fixed: 26s-browser 99/99 (--db); 26s2-structure 105/105; check:scripts 0 errors.
  - The full regression is green.
- **Charlie's screen (§9):**
  - the tree on 452c5ade;
  - opening D.38.1 and D.202.1 (each "drafted, not accepted", with Lex's proposal waiting);
  - the Law and Documents tabs;
  - the "Reports" tab;
  - the badge "Stage N of 7 · …".
  - "Draft what this heading needs" is V2.
- **Not in V1:** part comments; opening the full record from the tree; status words added automatically after a D-number in chat; a platform avenue (for a derived specification).

**Earlier status, 09:1x UTC (superseded): SIZED, NOT STARTED.** As BRIEF_26V §0 asks, this is the size report and the split.

---

## §1 What exists today (read from the code, file:line)

- **26-U's drafting instruction + clause** is JSON on the action: `LexCoherentAction.record.draft` = `{ versions[], proposal? }`. Each version carries the instruction fields plus `v`, `by` (USER/LEX) and `at`. Versions are only ever appended (`lib/lex/action-draft-pure.ts:31-52`, `addVersion` :110; writes through `writeDraft`, `lib/lex/action-draft.ts:49-89`). §5's join rows are written from these versions (`lib/lex/action-law-rows.ts`).
- **"What this touches" is not stored.** It is computed on request and again at print time (`lib/lex/action-touches.ts:2`, `lib/documents/actions-pack-read.ts:113-115`). It is depth 1 only: each provision with GRAPH 6's per-type counts of changes made **to** that Act. There is no row tree and no onward effects.
- **No document store.** No `ActionDocument`, no D-numbers. The existing `Document` model (schema :2646) is the idea-level briefing; `OperationalDocument` (:3859) is a corpus source.
- **Overview** (`app/ideas/[id]/IdeaDetailClient.tsx`):
  - The Idea tab's sub-tabs are Overview · Diagnosis · Policy · Coherent Actions (:1448-1453).
  - The GRAPH 7 law panel sits at the foot of the Idea tab, outside the sub-tabs (:2835).
  - ⚠ **A top-level tab is already labelled "Documents"** (key `exports`, :2549), the generated outputs.
- **The stage chip.** The literal "Stage: Create" does not exist. Two badges read `Idea.stage` through the old five-stage `STAGES` map, where STAGE_1 = "Create": the header badge (:2600-2602) and the Overview's "Stage" badge (:1551-1553). The seven-stage scheme is `SEVEN_STAGES` in `lib/documents/stage-banner.ts:32-46`.
- **The Deepening page** (`/ideas/create?stage=deepening`; `CreateIdeaClient.tsx:1248-1263`, `components/lex/DeepeningPanel.tsx`):
  - Under "THE PASSES": the update-pass panel, then one card per pass (findings, issues, known unknowns).
  - No law table, no tree.
- **The review passes.** Five are defined in `PASSES` (`lib/lex/deepening-config.ts:121`). Issues are `DeepeningIssue` rows tied only to `ideaId` + `passKey` + `runVersion` (schema :4350). **There is no action, document or part field.**
- **The worker** runs one job kind, `IdeaBuild` (`scripts/build-worker.ts`).
  - "Draft this clause" runs **in the request** (`action-structure/route.ts:104`, maxDuration 300).
  - "Draft all" under a heading is a stoppable, re-pressable client loop (`ActionDraftSection.tsx:128-147`).
  - The digest is a resumable row advanced by the client (`lib/lex/action-digest.ts`).
- **Actions Pack:**
  - Sections 1–13 per action; section 10 prints its `[Ref: n]` sources.
  - Then the incentives, "considered not taken", the consequential-schedule annexe, and one numbered Sources list (`lib/documents/build-actions-pack.ts:31-37, 130-161, 258-266`).
  - There is no Documents list.
- **Honesty check.** Five violation kinds, checked per sentence in `checkReply` (`lib/lex/agent/honesty.ts:34-38, 132-181`). A D-number rule fits as a sixth kind.

## §2 The split

Agreed with the brief's §0, with one move: the needs-a-document derivation (§2d) goes into V1, because the tree's counts and the "needs N: M drafted" line read from it.

### 26-V1 — structure, tree, placement (no model spend)

1. **Schema + migration, committed together and first** (root CLAUDE.md):
   - `ActionDocument`: action, kind, number within the action, title, status, D-number derived as `D.<action>.<n>`, "needs nothing" override + reason.
   - `ActionDocumentVersion`: author (Lex / owner / collaborator), time, text or file key, `[Ref: n]` sources drawn on.
   - Parts are numbered sections of the current version's text, so they get no table (decision 240: three levels, never a fourth).
2. **26-U moves in; no second store.**
   - `record.draft` becomes document N.1 "Draft clause", with every version kept and the proposal beside it.
   - Its writers move with it: `action-draft.ts`, `saveVersion`/`acceptProposal` → `writeInstructionRows`, Lex's draft tool, `ActionDraftSection`, pack section 12.
   - A one-off migration script with a read-back: every version count matches; nothing lost.
3. **The collision report** becomes document N.2, a *generated* kind: rows with depth, the "changes the words / does not / unclassified" split, display stopping at depth 3 with "and N further effects — see the schedule". **The consequential schedule** is a generated document on #203 (233), flattened and counted per Act. See question 3: depth 2–3 needs data we do not hold yet.
4. **Needs a document:**
   - Derived from avenue + instrument: legislative → clause + collision report; platform → specification; code → Code text; financial → costing; organisational → operating text.
   - The override records a reason; a document of any kind can be added by hand.
5. **D-numbers:**
   - Rendered with their status everywhere they appear in prose ("D.38.1, drafted, not accepted").
   - Never in the `[Ref: n]` series.
   - The pack prints Sources and Documents as two lists, and each action's documents in number order after its record.
   - Honesty check: a sixth violation kind, a D-number cited as authority.
6. **The tree** (§3):
   - heading → action → document → part, with numbers, shapes (■ ● ▸), states in words, "needs N: M drafted";
   - the filters *missing / drafted, not accepted / accepted*, and find by title or number;
   - a document opens in place (current version, versions list, sources, parts, Accept / Edit / Ask Lex to redraft);
   - counts at the top.
7. **Placement** (§6):
   - Overview sub-tabs Law (the panel moved up from the foot) and Documents (the tree, read-only) — see question 1;
   - the old badge(s) retired for `SEVEN_STAGES` — see question 5;
   - Deepening page: law table, then tree, then passes.
8. **`check:lex-26v` §8 items 1–5**, cold read included. Regression: 26-S2, 26-T, 26-U, `check:idea-law`, `check:prompt-examples`, plus a browser check of the tree.

**Size:** one schema pair, one data migration, about 6 product files changed and about 4 new (the tree, the document view, the derivation, the D-number renderer), plus the check. Comparable to 26-U §2–§5. **Spend: none** (no model calls; the migration is a copy).

### 26-V2 — kinds, "draft what this heading needs", passes re-pointed (spends)

1. **§4 templates** for the five new drafted kinds: Code text, Specification, Costing, Operating text, Background note. Each is a stored instruction (§27: no real user's words), opening with the caveat ("drafted from a statement with no commentary — expect gaps" where that applies). **Each kind is priced on scratch before its button shows a price** (only the clause is measured: about 10.8p, n=6).
2. **§5 "Draft what this heading needs" / "…this action needs":**
   - lists the missing documents with the measured price per kind, asks first above about 5p, saves each as it finishes, resumable;
   - every result is a proposal;
   - generated kinds cost nothing.
   - See question 4 (worker vs. the existing client loop).
3. **§7 passes re-pointed:**
   - `DeepeningIssue` gains action / document / part ties (schema + migration pair);
   - the five passes run over documents;
   - the open issues on 452c5ade are re-attached where a document exists and otherwise stay on the action, with counts before and after and none lost;
   - an issue count shows on each tree node.
   - ⚠ Re-attaching existing issues means judging which action each concerns. That is a model call per batch, to be measured; it is not free.
4. **`check:lex-26v` §8 items 6–7**, plus the full regression.

**Size:** larger in spend than in code. Five prompt templates, one job path, one schema pair, the re-attach. **Spend:** per-kind measurement runs (a few pence each), the re-attach (to measure), and whatever Charlie presses.

## §3 Questions before building (CCh / Charlie)

1. **"Documents" is already a top-level tab** (the generated outputs). A "Documents" sub-tab under the Idea tab would mean two different things with one name. One should be renamed, e.g. the top tab to "Outputs" (it already holds the Actions Pack and the Background Report). Which?
2. **Collision report: generated on every read, or saved as versions?** §0 says every document is versioned. Today "what this touches" is computed and never written. Proposed: save a version each time it is generated (when the clause or the effects load date changes), so a reviewer's comment on 38.2.1 points at fixed text.
3. ⚠ **Depth 2 and 3 of the cascade need data we do not hold in that shape.** GRAPH 6/7 give per-type counts of changes made **to** an Act, not what a change to it knocks on to (GRAPH_7_REPORT §6 point 7 says so). Depth 2 means walking from each amended provision to the provisions that cite or depend on it (`inboundFor` / `legislation_edges`). That is GRAPH's reader to extend, or a LEX walk over GRAPH's tables. The fixture (10 → 2×10 → 3×5) can be built either way, but real depth-2 rows need GRAPH's say on the edge type. Ask GRAPH first?
4. **§5 "on the worker":** the build-worker runs only `IdeaBuild` today. Either (a) add a document-drafting job kind to the worker, which is resumable and survives a closed tab but needs a worker deploy (verified by sha, as always); or (b) reuse the stoppable, re-pressable client loop "Draft all" already uses, which is cheaper to build and stops when the tab closes. The brief says the worker. Confirm (a)?
5. **The stage chip:** retire both old badges (the header and the Overview's "Stage") in favour of the seven-stage label? `Idea.stage` still drives the old stage gates (Take Public etc.), so the column stays and only the label changes.

## §4 Done before this (23 Oct (8))

233, 238 (Commentary only; the redraft is Charlie's), 235 and 237. 236 was dropped (decision 247). See CHANGE_LOG 2026-10-23 09:01 UTC.
