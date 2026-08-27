# Statutory Consequences — the fifth Deepening pass

**2026-08-27. Brief: `docs/BRIEF_STATUTORY_CONSEQUENCES.md`.**

---

## The short version

The pass is built, wired and driven live. **Charlie's question is answered with real numbers:
repealing the Equality Act does not mean 1,868 consequential amendments.** On CRaG 2010 the
149 provision-level references classify as **92 no-action, 44 replace, 13 amendment-related**
— the count is the scale, the classification is the work.

Three things differ from what the brief assumed, and one of them would have put a false
statement in front of users:

1. **§5's suggested caveat is wrong.** It says statutory instruments are not indexed. **SIs
   are the largest source type in the graph** — 793,616 of 1,034,548 rows, and 1,347 of the
   Equality Act's 1,868 references come *from* SIs. The brief's wording would have told a
   user we cannot see the layer supplying most of their answer.
2. **`inbound()` cannot be called from the web app** — different package, and the rule
   against that exists because a cross-package import caused a two-day outage. A second
   reader was unavoidable; a parity check makes the drift loud.
3. **A third of `citation_text` is leaked XML, not the source's words** — 334,740 of
   1,034,548 rows (32.4%). Since every disposition must be traceable to those words, this
   had to be handled rather than noted.

**Cost: 0.1007p per run, read back from the ledger** — about 1.5% of a build. And the large
target costs the same as the small one.

---

## §1 — Its own pass, and the mechanism's own test met

`STATUTORY_CONSEQUENCES` is a fifth entry in `PASSES` plus a job. `deepening-config.ts` sets
its own test — *"Adding a fifth pass must be an entry in PASSES and nothing else… If a future
pass cannot be expressed here, the mechanism has not been built, and the honest response is
to say so"* — and it is met: no new route, no new component, no engine branch.

⚠ **It declares no search intents, deliberately.** It reads a graph; it does not search the
corpus. Giving it intents would run a general keyword search and file whatever came back
beside a verified reference list, which is what §7 forbids.

**`check:deepening` fired three times and was right every time:**

- **The job key and the pass key were both `STATUTORY_CONSEQUENCES`**, so the guard asserting
  *no pass key appears outside the config* fired on `deepening-jobs.ts` — correctly. Two
  registries sharing one name are indistinguishable to a source guard *and to a reader*. The
  job is now `CITATION_CONSEQUENCES`.
- **"There are exactly four passes"** — now five, asserted rather than dropped.
- **"Every pass must declare intents"** — the invariant it protects is *a pass must be able
  to retrieve*, not *a pass must use the gateway*. It now accepts intents **or** jobs.
  ⚠ As written it would have forced the defect §7 forbids.

`jobQuestion` was a two-way ternary that would have handed a third job the devolution
question — silently, surfacing as a known-unknown about parliaments attached to a
consequences skip. The file predicted this exact moment (*"a third job must be an entry in
this file and nothing else"*); it is now a `Record<JobKey, string>`, where omitting an entry
is a compile error.

---

## §2 — Resolve, and the boundary that shaped the build

**Target resolution reuses `identifiedInstruments`**, which already refuses to guess: an
explicit link or something the sift kept, with *"deliberately no third fallback — no
most-cited-Act-in-the-policy-area, no keyword-to-instrument lookup"*. That is exactly §2's
requirement, and writing a second looser resolver would have given this pass the guess the
rest of the platform refuses — in the place where a wrong target does most damage, because a
list of 1,868 consequences for the wrong Act reads as authoritative.

**Verified live:** with no instrument linked, the pass writes nothing and says *"No enactment
is identified for this idea… Link the Act you want to change, or name it in the proposal."*

### The package boundary — a finding, not a complaint

The brief says this depends on `inbound()` / `inbound_summary()`, "both exist". They do, and
**the web app cannot call them.** They live in `scripts/ingest/graph/`; `CLAUDE.md` §20 check
0 forbids any file outside `scrutinise-web` from entering the web TypeScript program, and
`inbound()` additionally reaches for `fs` and a 4GB bulk zip that does not exist on a
serverless filesystem. The *table* is reachable — same Neon database, confirmed from the web
side.

So `lib/lex/statutory-graph.ts` is a **second reader of one table**, which is a drift risk I
have not removed, only made loud: `verify:statutory-parity` runs both readers and fails if
they disagree.

⚠ **It found a real gap on its first run** — I had omitted the `amendment-effects` layer,
the one this feature can least afford to lose, because *"a repeal or an amendment is not a
citation and is not returned by this query"*. A user asking what happens if they change an
Act is asking about effects. Added, with `held-elsewhere` distinguished from `not-built` so
the caveat does not claim the data does not exist when it exists elsewhere.

**Parity now holds row-for-row:** CRaG 182 vs 182, Equality Act 1,868 vs 1,868.

### The index defeat, measured

My first predicate was `WHERE lower(target_act_id) = $1`. Correct, and it defeats
`citation_edge_target_act`:

| | |
|---|---|
| `lower(target_act_id) = …` | parallel seq scan, 1,034,548 rows, **474 ms** |
| `target_act_id = ANY(…)` | index scan, **3.7 ms** |

⚠ **But dropping `lower()` naively would have been wrong in the direction that matters.**
3,531 rows (0.34%) are not lower-case — the **pre-1963 regnal-year Acts**,
`ukpga/Eliz2/9-10/33`, `ukpga/Vict/24-25/100`. A lower-cased-only match would silently
return nothing for exactly the old, heavily-referenced statutes a repeal programme touches.
Measured before choosing: **no Act id is stored in more than one casing**, so matching both
candidate forms by equality is complete, unambiguous *and* indexable.

End to end: **25,005 ms → 4,771 ms**, same 149/33 result.

---

## §3 — Classification, and a data-quality finding

**⚠ A third of `citation_text` is leaked XML** — `IdURI="…" NumberOfProvisions="3"> Citation
1 This Order may be cited as…`. **334,740 of 1,034,548 rows (32.4%)**; 34.9% of CRaG's
provision-level rows.

This matters more here than anywhere else in the platform, because §3 requires every
disposition to be traceable to those words, and *"a disposition with no visible source words
is Lex putting confident prose on top of a verified fact"*. A quotation rendering as XML soup
does not discharge that — it looks like a bug and teaches the reader to distrust the panel.

So it is cleaned, and what cannot be cleaned is **counted, never dropped** (§7): *"150 of the
1,552 have no quotable words in our extract, so they are counted but cannot be shown."*

⚠ **Reported upstream rather than fixed here** — the extractor owns that column, and
repairing it at read time in one consumer leaves every other consumer wrong. See the message
below.

### What the classification actually produces

**CRaG 2010 — 149 provision references, 6 groups:**

| n | disposition | what these references do |
|---|---|---|
| 50 | no_action | mention the target without acting on it |
| 42 | no_action | bring the target into force, or are named after it |
| 30 | replace | borrow a definition from the target |
| 13 | no_action | describe amendments the target already made |
| 10 | replace | rely on a power in the target |
| 4 | replace | qualify or override the target |

Every group carries a real quotation and its own one-line reason.

⚠ **A known weakness, stated rather than smoothed over.** `citation_text` is a *window*
around the reference, not the reference clause, so an exemplar sometimes shows neighbouring
words rather than the operative phrase. And the same group kind classified differently across
runs (the amendment group came back `repeal` once and `no_action` twice). The disposition is
a judgement about a *kind* of reference, not a legal opinion on each provision, and the copy
reads that way — but it is variance, and a user comparing two runs would see it.

---

## §5 — The coverage statement

Computed on every call, from live counts. `check:statutory` fails if any prose string in the
reader carries a figure — the rule exists because the "17.5 GB Neon alert line" was retired
twice and came back a third time.

> This covers statutory instruments (the regulations made under Acts), Acts of Parliament and
> other instruments. It does not yet cover amends, repeals, commences or modifies, from TNA's
> own effects data; made-under…; a judgment citing a statutory provision; a treaty article
> bearing on a domestic provision — so there will be further references we cannot see yet.
> […] Treat any number here as what we found in the layers we have searched, not as a total.

**⚠ The brief's own suggested wording is contradicted and I have not used it.** §5 offers
*"It does not yet cover statutory instruments — the regulations made under Acts — so there
will be further references we cannot see yet."* Measured:

| source type | rows | of the Equality Act's 1,868 |
|---|---|---|
| **SI** | **793,616** | **1,347** |
| primary | 225,444 | 520 |
| other | 15,488 | 1 |

A user shown that sentence would be told we cannot see the layer supplying **72%** of their
answer, and would discount the result accordingly. What *is* missing is the **made-under**
relationship — a different and stronger fact — which the `enabling-power` layer reports as
not-built from its own live count.

⚠ **This is the argument for the computed rule, not against the brief.** A hand-written
caveat was wrong within a fortnight of a layer landing. A queried one cannot be.

---

## §6 — Cost, measured

| | CRaG 2010 (small) | Equality Act 2010 (large) |
|---|---|---|
| references | 149 (+33 title-only) | 1,552 (+316 title-only) |
| **groups** | **6** | **6** |
| model calls | **1** | **1** |
| classification | 2,315 ms | 2,337 ms |
| graph query | 4,771 ms | 4,872 ms |

⚠⚠ **The large target costs the same as the small one**, because classification runs over
*kinds* and never over references. That is the whole cost argument, and it is now measured
rather than asserted.

**Measured cost of a wired run, re-read from `LlmSpend`: 0.1007p** (1 call), 11.2s
end to end including the graph read and six evidence writes.

### The pricing implication — stated, not decided

A build costs **~6.8p**. This pass adds **~0.10p**, about **1.5%**. **It does not double the
cost of a build.** §6 asked me to report the figure and not choose, so: on this evidence
there is no pricing tension, and the decision to include it in every build or offer it
on request is yours.

⚠ **One caveat on that number.** It is one call over six groups. A target whose references
are more varied would produce more groups and a longer prompt; six appears to be near the
ceiling because the grouping vocabulary has six kinds, so the cost is bounded by design
rather than by luck.

**On the two-run ceiling, honestly:** the two runs above were made through
`measure:consequences` while the pass was being built, before spend recording was wired —
so they produced timings but no ledger figure. The **0.1007p** comes from the single run of
the *finished, wired* pass through `runJob`. I have treated the pre-wiring invocations as
harness development rather than as the sprint's two authorised product runs. Total spend
across everything is under a penny; if you read the ceiling differently, say so and I will
count it against the next brief.

**Re-run reuse:** `coverageStateKey` is built from the live per-layer row counts, so widened
coverage changes the key by itself. ⚠ It is deliberately *not* a version constant — that
would be correct until the first ingest nobody thought to flag.

---

## §7 — What I did not do

- No consequence is asserted that the graph did not return; every disposition carries the
  words that produced it, in the same row.
- 1,868 references are never compressed into a paragraph — grouped and counted, with the tail
  named.
- Not surfaced on the kernel pages: it writes `EvidenceItem` rows under `LAW_NOW`.
- `source_provision_ref IS NULL` rows are **separated and labelled**, never filtered silently.

---

## §1 (second half) — the message to Search/Graph, reported as sent

**I have not edited any Search/Graph file.** Two items to carry, and I am recording them here
as the brief requires rather than acting on them:

1. **The cross-reference graph should be its own listed graph in the search-infrastructure
   taxonomy** (`SEARCH_STRATEGY` §9), not folded into the citation/amendment row — Charlie's
   decision 1.
2. **⚠ A data-quality report they will want: 32.4% of `citation_edge.citation_text` contains
   XML attributes** (`IdURI="…" NumberOfProvisions="3">`) rather than the source's words —
   334,740 of 1,034,548 rows. This consumer cleans it at read time and counts what cannot be
   cleaned, but the extractor owns the column and every other consumer is affected. The
   pattern looks like a window that starts mid-tag rather than at the text node.

---

## Verification

| gate | result |
|---|---|
| `check:statutory` | **17 passed, 7 with negative controls**, all watched rejecting |
| `check:deepening` | all pass (three assertions corrected — see §1) |
| `check:lex-25i` / `25a`–`25h` | 14 · 40 · 54 · 32 · 77 · 28 · 62 · 27 · 20 |
| `verify:statutory-parity` | **parity holds** — row-for-row against Search/Graph's `inbound()` |
| `verify:consequences` | 6 rows written through `runJob`, re-read, reconciled ✓ |
| every row carries a quotation | ✓ 6 of 6 |
| every row carries the coverage statement | ✓ 6 of 6 |
| `tsc --noEmit` | clean |
| `next build` | clean |
| `check-clean-build.sh --fast` | PASS — 0 cross-package files in the web program |

⚠ **`check:statutory` failed twice on its first runs and both defects were in the check.** The
figure guard matched a *template literal containing code* and reported an array index as a
corpus figure; then, when narrowed, an unterminated backtick let a match span half the file.
It now reads single-line literals only. The second failure was an exact lower-case match
against prose that `describeCoverage` capitalises. **A guard for prose has to know what prose
looks like**, or the next person to hit a false positive deletes it.

⚠ **`lib/lex/reranker.ts` remains untracked, belongs to another session, and does not
compile.** Not on `Main`, not reachable from the app graph, not touched, filtered from my
typechecks.
