# POSITION GRAPH — AMENDMENT 2 REPORT

**Executes:** `POSITION_GRAPH_DESIGN_AMENDMENT_2.md` in full.
**Date:** 2026-08-16
**Code:** `scripts/ingest/position-graph/` — `schema-amd2.sql`, `setup-amd2.ts`,
`signal-behaviour.ts`, `verify-amd2.ts`, `report-amd2.ts`, `handcheck-amd2.ts`,
`probe-amd2{,b,c,d}.ts`
**Design:** Amendments 1 and 2 are now **folded into `POSITION_GRAPH_DESIGN.md`**; both amendment
files carry a banner saying so and are kept unchanged as the record.
**State:** `tsc` clean for the directory. **`verify-amd2.ts`: 16 checks pass, 0 fail, 0 broken
negative controls.** Storage added: 88 kB.

---

## THE HEADLINE

**Behavioural agreement cannot support a merge, and that is now measured rather than asserted.**
Random SAME-PARTY pairs of members who are certainly different people agree **97.9%** of the time
(n=150, ≥20 shared divisions); cross-party pairs agree 10.5%. Agreement is a party signal, not an
identity signal.

The cleanest case in the data is two **successive Archbishops of Canterbury** — MNIS 4252 and 4696,
an **identical register display name**, 21 shared divisions, **100% agreement**. A matcher that
merged on name would merge them; a matcher that then checked behaviour would be reassured. Both
would be wrong, and the result would be a person who does not exist.

That is the amendment's own warning, and it turns out to be the strongest argument the sprint has
for the rule it protects.

---

## §1 — THE MENTION IS THE UNIT OF DISPLAY ✅

`graph_mention` is a view over `graph_edge_all` joined to `graph_entity_identity`, with **no
resolution filter of any kind**. That absence is the whole point of the view, so it is asserted
rather than trusted: the check proves `count(graph_mention) == count(graph_edge_all)` exactly, and
its **negative control is the design as it stood before the amendment** — the same comparison with
tier-3 actors filtered out. The control fires at **73,829 mentions lost**.

**What the old gate cost, per half:**

| half | actors with a mention | shown under the old gate | mentions | mentions shown under the old gate |
|---|---|---|---|---|
| person | 48,409 | 2,603 (5.4%) | 2,598,875 | 1,779,168 (68.5%) |
| organisation | 39,490 | 26,111 (66.1%) | 103,865 | 86,339 (83.1%) |

⚠ **Read those two columns in opposite directions, and note that a single "coverage" number would
have said whichever the author preferred.** Gating on resolution hides **94.6% of the people** and
keeps **68.5% of the mentions**, because the 2.5M derived vote edges all sit on keyed MPs.

**"Thin record" is now a measurement, not a reassurance.** Of the 45,018 unresolved people,
**38,903 (86.4%) hold exactly one mention**; 3,891 hold two. Amendment 2's "three unresolved Andrew
Robertses are three thin records" is literally what the data looks like.

### ⚠ One thing §1 asked for that we cannot supply, and did not fake

§1 wants **"name as it appeared"** on the mention. It is not recoverable per appearance:

- `graph_edge` has no surface column;
- `corpus_sections.speaker` — the obvious recovery route — is **NULL on 5,000 of 5,000 sampled
  `committees-evidence` sections** that `graph_evidence` actually points at;
- the surfaces we hold live in `graph_alias`, keyed on (entity, source), not on the appearance.

So `graph_mention.display_name` is the ENTITY's canonical name and carries
`surface_is_per_entity = TRUE` beside it. Picking a surface per appearance and presenting it as the
one used would be an invented fact of exactly the kind §5.1 forbids. **The fix belongs in the
sweeps: record the surface on the edge when the edge is written.**

---

## §3 — CONFIDENCE REACHES THE SCREEN ✅

Three tiers, defined **once**, in SQL, so a screen cannot invent its own wording:
`graph_identity_tier()` → `graph_identity_statement()` → `graph_identity_caveat()`, surfaced through
`graph_entity_identity`.

| tier | wording | person | organisation |
|---|---|---|---|
| `identified` | "This person / body, identified" | 2,603 | 26,111 |
| `probable` | "Probably this person / body" | 788 | 0 |
| `mention-only` | "The name as it appeared, and nothing more" | 45,018 | 14,407 |

**An unknown `key_source` returns `unclassified`, not a safe-looking default.** A new key source
arriving without a tier decision must be visible; the check fails on a single unclassified row and
its control feeds the function a fabricated key source to prove it can fire.

⚠ **A trap found by a negative control that refused to fire.** The first version of "no
mention-only actor carries a stable key" used, as its control, "count keyless rows above tier 3" —
and got **zero**. The reason matters: **all 788 name-matched people DO carry `parl_member_id`.**
2D-2 put the register match in the id column and put its uncertainty in `key_source`/`confidence`.
So a tier derived from "does an id column have a value in it" would promote every one of the 788 to
"identified". The tier is derived from `key_source` alone, and the control was rewritten to test the
predicate rather than a property of today's data.

---

## §2 — BEHAVIOUR IS A SIGNAL, WITH ITS EVIDENCE, AND NEVER A RESOLUTION ✅

**500** normalised name surfaces in `graph_member_name` are held by two or more MNIS ids; **99** of
those clusters have at least two members who actually voted. **187 pairs scored.**

| finding | pairs | episcopal see | peerage title | plain name |
|---|---|---|---|---|
| `disjoint-service` | 150 | 139 | 4 | 7 |
| `insufficient-evidence` | 22 | 16 | 0 | 6 |
| `divergent` | 8 | 2 | 0 | 6 |
| `concordant` | 7 | 1 | 0 | 6 |

### ⚠ The work list is not what the amendment assumed, and that changed the design

Probing the clusters BEFORE writing the schema found them dominated by **episcopal sees** — 80
clusters, 74 of them testable. "Bishop of Durham" is an **office held in succession**, not a name.
For those, the question is not "do they disagree" but "did they ever sit at the same time", so
`disjoint-service` is a first-class finding computed from the voting ranges and reported apart from
`divergent`. Collapsing the two would have credited a date range as though it were a political
disagreement. It is also the great majority of what the signal finds: **150 of 187 pairs**.

⚠ **The `disjoint-service` test is on the ENDPOINTS, not on a clamped overlap.** The first
implementation used `overlapDays === 0`, which is also true of two members whose ranges touch for a
day, or who each voted once, on the same day, in different divisions. Those sat at the same time and
would have been labelled a succession.

### The pairs the signal exists to catch

| surface | A | B | shared divisions | agreement |
|---|---|---|---|---|
| `gerald` | Sir Gerald Howarth (Con) | Sir Gerald Kaufman (Lab) | 32 | **3.1%** |
| `sharma` | Mr Virendra Sharma (Lab) | Lord Sharma (Con) | 868 | **5.4%** |
| `david` | Sir David Amess (Con) | Sir David Crausby (Lab) | 350 | **6.6%** |
| `angela` | Dame Angela Eagle (Lab) | Dame Angela Watkinson (Con) | 78 | **9.0%** |
| `alan` | Sir Alan Duncan (Con) | Sir Alan Meale (Lab) | 87 | 10.3% |
| `campbell` | Mr Ronnie Campbell (Lab) | Mr Gregory Campbell (DUP) | 309 | 22.7% |

A matcher that folded `sharma` into one actor would produce a person who voted both ways on 868
divisions and looked twice as influential as either real member.

### And the pairs behaviour would WRONGLY endorse merging

| surface | A | B | shared | agreement |
|---|---|---|---|---|
| `archbishop of canterbury` | The Lord Archbishop of Canterbury (Bishops) | The Lord Archbishop of Canterbury (Bishops) | 21 | **100.0%** |
| `geoffrey` | Sir Geoffrey Clifton-Brown (Con) | Sir Geoffrey Cox (Con) | 1,393 | 98.9% |
| `jones` | Mr David Jones (Con) | Mr Marcus Jones (Con) | 1,486 | 97.8% |
| `robert` | Sir Robert Syms (Con) | Sir Robert Buckland (Con) | 1,422 | 96.2% |

Read beside the **97.9% same-party baseline**, none of these is remarkable. That is the point.

### How the rule is enforced rather than intended

- `graph_identity_signal` has **no column a resolution could be written into** — asserted against
  `information_schema`, with `graph_merge_log`'s own `kept_entity_id` as the control that fires.
- `finding` **refuses** a merging value. The check attempts `finding = 'same-person'` inside a
  rolled-back transaction and passes only when the database rejects it. *A merge on this evidence
  would have to alter the DDL, which is a decision someone has to take on purpose.*
- Every `divergent` row can show its working: up to six specific divisions with both votes. The
  control counts `disjoint-service` rows, which correctly have **no** division evidence — their
  evidence is the dates.
- No merge anywhere in `graph_merge_log` cites behavioural evidence.

---

## §6 — THE TWO HALVES, REPORTED SEPARATELY ✅

| half | entities | identified | probable | mention only |
|---|---|---|---|---|
| person | 48,409 | **2,603 (5.4%)** | 788 (1.6%) | 45,018 (93.0%) |
| organisation | 40,518 | **26,111 (64.4%)** | 0 (0.0%) | 14,407 (35.6%) |

**A factor of twelve.** The blended figure is 32.3%, which describes neither half. `report-amd2.ts`
prints the blend once, labelled as the number to stop quoting, and nowhere else.

⚠ **Amendment 2 §6's own figure is stale in the good direction.** It says "99.6% of person entities
rest on a name match", which was 2D-1's. After 2D-2's member sweep it is 94.6%. The argument is
unaffected; the number should come from the database, which is why this is a script and not a
sentence.

---

## ⚠⚠ A LIVE DEFECT FOUND ON THE WAY, REPORTED AND NOT FIXED

**MNIS's "address as" for a Commons member is frequently just the surname.** `Mr Brown`,
`Sir Geoffrey`, `Sir David`. After `normalisePersonName` strips the honorific those become the match
surfaces `brown`, `geoffrey`, `david` — which identify nobody, and which `isUselessName()` cannot
catch because they look like names. **30.6% of the `address`-sourced surfaces are a single word**;
across all sources, 1,160 distinct single-word surfaces exist.

**Three of 2D-2's 788 register name-matches stand on a surface the register itself says belongs to
more than one member:**

| entity | matched to | candidates the register offers |
|---|---|---|
| `Baroness Meacher` | MNIS 3810 | Baroness Meacher \| Mr Michael Meacher |
| `Mr  George` | MNIS 317 | Mr Bruce George \| The Lord George |
| `Robinson` | MNIS 1456 | Mr Geoffrey Robinson \| Mrs Iris Robinson |

97 of the 788 matched on a single-word surface at all. `Baroness Meacher` is very likely right;
**`Mr  George` and `Robinson` are coin flips recorded at confidence 0.9.**

**NOT unmatched here.** Unmatching is a resolution, and this sprint does not take those. Flagged for
CC-GRAPH with the candidates attached.

## ⚠ A SECOND THING FOUND BY HAND AND NOT CHASED

**MNIS 3296** — a Lords Spiritual record for "The Lord Archbishop of Canterbury", membership
1991-04-17 → 2002-10-31 — casts **zero rows in `division_votes`**, although its service overlaps our
division window by nearly three years and 310 Bishops' votes exist in that window under other
members. George Carey's archiepiscopal votes are attributed to neither this record nor his life
peerage record (MNIS 2205, whose first vote is 2003-02-04). Either an ingest gap or an MNIS
duplicate; **it is also the one case in the cluster set where identity is genuinely open, and the
behavioural test cannot reach it, because one side has no votes.**

---

## WHAT WAS BUILT

| artefact | what it is |
|---|---|
| `schema-amd2.sql` | 3 functions, 2 views, 3 tables. Idempotent, re-applied to prove it. |
| `graph_identity_tier/statement/caveat` | the three tiers and their wording, defined once |
| `graph_entity_identity` | per-entity: tier, statement, caveat, keys, every surface seen |
| `graph_mention` | every recorded act by every actor, unfiltered by tier |
| `graph_identity_signal` (+`_evidence`) | 187 pairs, 48 evidence rows |
| `graph_identity_baseline` | the same-party / cross-party calibration |
| `verify-amd2.ts` | 16 checks, every negative control fired |
| `report-amd2.ts` | §6, and the risk list above |

## NEXT, FOR CC-GRAPH

1. **Record the surface on the edge** when the sweeps write one. It is the only thing standing
   between us and §1's "name as it appeared".
2. **The three ambiguous name matches**, and a rule that refuses a match on a surface the register
   says is shared. The evidence to write it is in `graph_identity_signal`.
3. **Companies House and the Charity Commission** — Amendment 2 §4's first priority, and the
   columns and tier decisions are already in place waiting for the sweep.
4. **Organisation `first_seen` repair** (40,518 entities, carried from 2D-2) — still outstanding.
5. `holds-position` remains unbuilt, which is what everything user-facing actually waits on.
