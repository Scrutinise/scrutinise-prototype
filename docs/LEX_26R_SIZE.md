# LEX 26-R — size-first report (8 Oct 2026, 02:53 UTC)

Brief §0: *report size first; first task of all is the status of 26-E §3, the `[Ref: n]` source registry.*

## 1. 26-E §3 — the source registry: NOT BUILT (verified, not assumed)

- `CHANGE_LOG` 2026-09-24 02:36 UTC (26-E): "§3 — SIZED, NOT BUILT". Nothing since built it.
- `[Ref: …]` appears in **no** `.ts/.tsx/.prisma/.sql` file under `scrutinise-web/`. No "Add source" or "Create snippet" control exists. The research panel heading is still "Key sources" (`lib/lex/question-headings.ts:201`).
- So Charlie's belief is correct. **The notebook has nothing to stand on yet.**

## 2. What a source is today — three representations, none numbered

| Where | Identity | Notes |
|---|---|---|
| `IdeaSourceDecision` | `sourceKey` = corpus `SearchResult.id`, unique per (idea, key) | status INCLUDED / EXCLUDED / PRIORITY; self-sufficient title/citation/url; 25-D/25-L |
| `EvidenceItem` | `sourceType` + `sourceId` + `citation` + `url`, per finding | no stable per-idea source; the same document can be many rows |
| `IdeaUserMaterial` | its own `id`; `kind` FILE or LINK; `text` is the only copy | uploads and links; findings read from it; `archivedAt` already exists (26-J) |
| `ProposalSnapshot.sources` | `SnapshotSourceRef.id`, grouped by corpus type | derived, frozen into stored versions |

A registry is therefore a **fourth** table that the other three point at, not a rename of one of them.

## 3. Size

**Registry on its own (the "first task"): one sprint, as 26-E already said.** It is the larger half of Sprint 1.

| Piece | What it touches |
|---|---|
| Schema | new `IdeaSource` (idea, **number never reused**, kind CORPUS / URL / DOCUMENT / OWN_OBSERVATION, title, url, citation, snippet, `readStatus` READ / NOT_READ with reason, link to `IdeaSourceDecision.sourceKey` / `IdeaUserMaterial.id`, `archivedAt`). Unique (ideaId, number). Per-idea counter — needs a trigger or a transactional max+1, as `lex_action_number_trg` did for actions (26-Q) |
| Backfill | every existing idea: one registry row per distinct source across the three tables. Charlie's idea alone carries 185 Lex findings. Must be re-readable by exact address, not counted |
| Reading | `[Ref: n]` in the snapshot assembler, the eight document builders, the evidence pack, the printed report; frozen snapshots predating the registry must render without it (the `prioritySources` three-case rule, 25-L) |
| UI | "Sources" rename; "Add source" in the research panel; an "Add source" dropdown in **every editable box in the middle panel** (insert at cursor) — the widest part |
| Lex | "Create snippet" (20–80 words) with the honest-fetch rule: gov.uk / legislation.gov.uk return, parliament.uk 403s → say unread, user writes it |

**Notebook (§1–§6, §8 schema): a further sprint on top**, reusing 26-Q's list, 26-P's tool loop and the upload pipeline. New: `ResearchNote` + thread replies + status + private layer; the "Add research" form on four surfaces; fetched readable view with select-to-quote; a bookmarklet; ~9 Lex tools.

**Recommendation:** three deliverables, in this order, each green and read back before the next:
1. **Registry + `[Ref: n]`** (26-E §3 completed) — schema+migration together, backfill, documents, Add source.
2. **Notebook** (brief Sprint 1, §1–§6 + §8 schema).
3. **Synthesis, outputs, curation** (brief Sprint 2).

This is the brief's own two-sprint split with the registry named as its precondition rather than folded in. It is not a re-scope — it makes the dependency the brief already states into a step.

## 4. Open points that change what is built (not guessed)

1. **Prerequisite state.** The brief runs "after 26-Q is on Charlie's screen and 26-P's switch has flipped". Memory records 26-Q as built and committed locally, *not seen in a browser*; nothing in the repo says the `LEX_AGENT` switch is on. I cannot read the production flag from here (CLAUDE.md §19). Needs Charlie's word.
2. **Push state.** 26-H/26-O/26-Q are committed locally and per the CHANGE_LOG **not pushed**; the registry migration would be the first schema on top of unpushed work. Decide the order of the push.
3. **Number reuse (26-E §3e).** Recommended: never reused, deleting a source archives it and its number stays as a gap — a `[Ref: 7]` that silently becomes another document is worse than a gap. Matches the policy numbers. Confirm.
4. **iPad Safari bookmarklet** (brief §3 asks for a report): not researched; belongs with the notebook sprint.

## 5. Not started

No schema, no migration, no UI. Nothing was written for 26-R beyond this report.
