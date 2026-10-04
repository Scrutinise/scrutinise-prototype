# LEX 26-Q — the size, reported first (4 Oct 2026)

*From a read-only survey of the repository (file:line cited by the surveyor, spot-checked by me). Nothing in this document has been built.*

## The finding that changes the sizing

**`LexCoherentAction` has no title, heading, cause link, avenue, sequence, status, number, or merge fields.** The brief says the cause attacked is "already recorded on each action". It is not: the only cause number that ever exists for an action is `GapSource.addressesCauseNumber`, inside a gap-check suggestion's JSON, and **`acceptGapSuggestion` throws it away**. The build's actions pass, `testHeldActions` and manual adds write no cause either. `PolicyOption.targetCauseIds` is the kernel's one structural cause link, and actions have no twin of it.
So the cause facet, the coverage grid, "ignore causes everything attacks", and the free gap test (today a keyword match on stems) all need a **recorded** link built first — and every existing action needs it proposed by a Lex pass.

## Reuse (what is genuinely there)

| Brief | Reusable | What is missing |
|---|---|---|
| Headings, show/hide, count, rename | `GroupSection`, `GroupSelectedPanel` (`MyIdeasList.tsx`) — portable shape | **no colour, no order**; `IdeaGroup` is per owner, not per idea → new `ActionHeading` table |
| Colour never alone | `state-cues.ts` rules; `accent.ts` is hand-tuned but **not lightness-spread** | a new, measured palette (the check computes L* spread and WCAG) |
| Drag to reorder | pointer-event `DragHandle`/`reorderActiveTo` (touch-safe), `ideas/reorder` rewrite-0..N pattern | no reorder op on actions (`updateAction` never touches `orderIndex`) |
| Multi-select + bulk | `SelectCheckbox`, bulk bar | — |
| Merge (4 verdicts), originals kept | `MergeVerdict`, `writeMerge` / `writeEnhance`, `mergedFrom` / `mergedIntoId`, FieldRevision for the prior wording | all of it is hard-wired to `policyOption`; actions have no `number`, no merge columns; the prompt is policy-specific |
| Find duplicates, closest first | `nearDuplicatePairs`, `pairPolicies`, `universalCauses` (80% rule) — pure | **no pairwise similarity exists for actions** (policies' ranking is the sort model's own opinion) → text similarity from gap-check's `stems`/`jaccard` + shared causes |
| Park / Rule out, restorable | `effectiveDisposition`, `phase`, `ruleOutReason`, `CollapsedSection`, "Restore as N" | the "Later phase" header is **not actually collapsed** on policies today; actions need it collapsed |
| Lex's tools | `ToolDefinition`, `execute`, undo tokens, `rule_out_candidate` / `merge_candidates` as templates | actions are addressed by a short **id prefix**, not a number — "put 7 and 12 under Transparency" needs a stable `number` |
| Coverage grid | gap-check's `detectFreeGaps` (pure) | needs the recorded cause link |
| Sequence view | merge verdict `SEQUENCE` (advisory, unstored) | **nothing stores now/next/later or "must come before"** |
| Binding-link headings (§3c) | `PolicyOption.chainLink`, gap-check already reads the chosen policy's `chainLink`/`rulesOut` | none of Charlie's four links, transparency or transition exist as data → a Lex pass reading the settled policy |

## Hazards found

* **A rebuild deletes every `source:'LEX'` action** (`build.ts:2283`) — and with it titles, headings, facets and merge history. It has to spare rows carrying user structure.
* **Eight other readers** take "all actions": the Lex snapshot, `checklist-state`, `update-pass`, `cost-route`, `build.ts` (three places), `proposal-snapshot`, `build-committee-evidence`, and `IdeaDetailClient`. Each must read **live** actions only once rows can be ruled out or archived.
* **`CostLine` cascades from the action** — a hard delete loses its costing; a merge has to carry the lines. (Delete becomes "Rule out" — nothing deletes.)
* `ActionInput` and `CanonicalAction` are the choke points; every new column goes through both.
* Hand-written migration, `whichdb` first, no `prisma format`, schema + SQL committed together (CLAUDE.md §16, §21, root CLAUDE.md).

## Size

**Large — roughly a week of ordinary work; one sprint on its own, as the brief says.** In build order:

1. **Foundation (schema, state, readers)** — migration (action columns, `ActionHeading`), `number` backfill, `status`, live-only readers, rebuild guard, `ActionInput`/`CanonicalAction`. *~15% — and everything waits on it.*
2. **Titles, headings, titles-only list** — title field + "Title these for me", headings with a measured palette, compact list, open in place, drag, dropdown, multi-select bulk (heading / park / rule out). *~25%*
3. **Cause link + facets** — Lex proposes cause, avenue, link, sequence (+ before) in one pass; user corrects; regroup by any facet; the policy's binding links offered as headings. *~20%, and the main model spend.*
4. **Merge / duplicates / compare** — an action twin of the policy merge, duplicates ranking, side-by-side verdict. *~15%*
5. **Coverage grid and sequence view** — *~10%*
6. **Lex tools + checks + a full write run on a scratch idea** — *~15%*

**Spend:** small and bounded — one facets pass and one titles pass per idea (a few pence each on a Pro-class Gemini), one headings pass, and a merge/compare judgement per use (~1–2p). A scratch full run ≈ 15–25p. No stop for spend.
**Scope decisions I am making (and will say so in the report):** ruled-out and merged-away (archived) actions stay on the idea but leave the documents, the kernel text and the costing; **parked ("Later phase") actions stay in them** — parking defers, it does not drop; "Delete" on an action is replaced by "Rule out" (a reason, restorable); one heading per action, facets are separate columns.
