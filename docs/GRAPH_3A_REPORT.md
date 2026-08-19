# GRAPH 3A — THE POSITION GRAPH, FACTUAL LAYER

**Executes:** `docs/BRIEF_GRAPH_3A.md` §1–§7, against `docs/POSITION_GRAPH_DESIGN.md` §2–§6.
**Date:** 2026-08-19. **Cost: $0** — no LLM call was made anywhere in this sprint. Every number
below is arithmetic over data already in Neon.
**Run to reproduce every figure:** `npx tsx report-3a.ts` from `scripts/graph`.

---

## THE SHORT VERSION

**The graph now holds 2,317,523 factual position signals and 2,304,748 estimates, and the people it
puts at the top are the right people.** The highest-confidence records in the whole graph are
Richard Burgon, Bell Ribeiro-Addy, Nadia Whittome, Ian Byrne, Apsana Begum and Rachael Maskell — the
Labour left, correctly identified as such by nothing more than the arithmetic of who voted against
their own party's majority. Nobody told it who they were.

Five things are worth Charlie's attention, and three of them are things the brief expected to go
differently:

1. ⚠⚠ **The free-vote heuristic works, and the brief's own expectation of it is half wrong.** The
   ten most-split divisions it flags are all the assisted dying Bill, and the Assisted Dying Bills
   of 2006 and 2015, the 2003 Hunting Bill and House of Lords Reform are all in the list. But
   **abortion is 0 of 11**, and that is not a failure — *the abortion divisions we hold are not free
   votes.* They are Northern Ireland abortion **Regulations**, which the Government whipped: Labour
   cohesion on them runs 0.92 to 0.99. The classic conscience votes on abortion predate our Commons
   coverage, which starts on 9 March 2016.
2. ⚠⚠ **The brief expected party-at-time-of-vote to need inferring. It does not — we already store
   it**, on every one of 2,527,966 vote rows, and it was verified rather than assumed. So the
   rebellion derivation is a plain fact with no inference caveat attached, which is a materially
   better error profile than the brief was planning for.
3. ⚠⚠ **Two of the five P0 signal types have no source data at all.** Amendment sponsorship
   (§3.3) and committee membership (§3.4) cannot be derived from anything we hold. Neither is a
   small gap and neither is fixable inside 3A's "no new data" constraint. See §A-2.
4. ⚠ **`position_estimate` cost 596 MB and takes the database to 99.2% of the ops alert line.**
   It fits, and the *enforced* ceiling is 16 TiB rather than 17.5 GiB, so nothing breaks — but 90%
   of those rows summarise exactly one vote each. Decision **D-1**.
5. ⚠⚠ **Do not roll several divisions on one Bill into one number yet.** Of 453 members with three
   or more votes on the assisted dying Bill, 448 come out as a "divided record" — because voting
   *for* the Bill and *against* an amendment to it are opposite directions once rolled up. The
   direction of an amendment vote is meaningless until 3B classifies amendments. Decision **D-2**.

**Checks:** `check-3a.ts` **33/33**, with all **15** self-test breaks firing (`--self-test`).
`verify-positions-api.ts` **21/21** against the live graph. `tsc` clean in both trees;
`next build` compiled successfully with `/admin/positions` and `/api/admin/positions` present.

▶ **CHARLIE: the thing to click is `/admin` → "Position Graph"** (`/admin/positions`). Search
"Terminally Ill Adults", tick the Second and Third Reading divisions, press *Show positions*, and
open the evidence on anyone you have a view about. That page exists for exactly one purpose: so you
can disagree with it before anyone else sees it.

---

## §A — THE AUDIT (reported before anything was built)

### A-1 · The entity layer, and what it excludes

The actors are `graph_entity` from the GRAPH 2D-2 sweep — **88,981 rows**, `id` is a `bigint`:

| kind | key source | n | what the user is told |
|---|---|---:|---|
| person | `parl-member-id` | 2,603 | "This person, identified" |
| person | `name-match` | 788 | "Probably this person" |
| person | `singleton` | 45,072 | "The name as it appeared, and nothing more" |
| organisation | `parl-cis-id` | 26,111 | "This body, identified" |
| organisation | `singleton` | 14,407 | "The name as it appeared, and nothing more" |

**Exclusion rates, with what each is a percentage OF:**

| source | rows at source | resolve to an entity | excluded | rate |
|---|---:|---:|---:|---:|
| `division_votes` | 2,528,032 | 2,477,541 | **50,491** | **2.00% of vote rows** |
| distinct voting members | 2,735 | 2,615 | **120** | **4.39% of members** |
| `edm_sponsor` | 60,995 | 59,925 | **1,070** | **1.75% of sponsorships** |
| `declared-interest` organisations | 1,505 | 1,505 | **0** | **0%** |

⚠ **The most useful thing in this table is the 120.** *All 120 unresolved members are in
`graph_member_register`* — we know exactly who they are. They are excluded because no `graph_entity`
row carries their `parl_member_id`, and 2D-2 declined to create one because their names collide:
there are two Gareth Thomases (MNIS 177 and 532), a John Smith with 207 EDMs, a Lord Jones, a Lady
Hermon. **This is the merge caution working as designed, not a data gap** — but it is a recoverable
one, because MNIS ids do not collide even when names do. It costs the graph 50,491 votes, including
every vote cast by Lord Patel (1,312), Lord Jopling (1,669) and Lord Moynihan (1,622). Decision
**D-5**.

The 1,070 excluded EDM sponsorships split as 812 with no entity for their MNIS id and 258 motions
tabled since the last ingest, for which no corpus section exists to show — 2D-2 refused to emit an
edge that cannot point at its evidence, and 3A inherits that refusal.

### A-2 · The stores — two of the five signal types have no data

| what the brief expected | what is actually there | verdict |
|---|---|---|
| division votes ~2.53M | **2,528,032** in `division_votes` | ✅ exact |
| the division question text | `divisions` 5,645 rows, **title on 5,645 (100%)**, `bill_title` on 4,585, `amendment` on 3,138, and the **full motion text on 3,282 Lords divisions** (`motion_notes`; the Commons publishes no equivalent) | ✅ better than needed — evidence display has a real label |
| EDM sponsorships ~60k | **60,995** in `edm_sponsor` | ✅ exact |
| EDM texts | 60,737 sections in `corpus_sections` | ✅ |
| witness appearances | **162,733** `gave-evidence-to` edges over **178,208 dated evidence rows** | ✅ |
| declared interests ~1,505 | **1,505** edges, all with a resolved organisation | ✅ exact |
| committee memberships | ⛔ **NOT HELD** | ❌ |
| bill sponsorship / amendment rows in `bills-api` | ⛔ **NOT HELD** | ❌ |

⚠⚠ **Committee membership does not exist in this database.** `graph_member_post` holds 7,970 rows,
all *government* (4,010), *opposition* (3,307) or *other* (653) posts. Searching it for committees
returns 165 rows and every one is either the Lords office "Deputy Chairman of Committees" or a party
NEC seat. Select-committee membership was never ingested. The *attention* half of §3.4 is therefore
carried entirely by witness appearances, which are held in full.

⚠⚠ **Amendment sponsorship does not exist either.** The `bills-api` corpus is **6,574 publication
PDFs** — bill texts, amendment papers, explanatory notes — indexed as documents. `bills-parliament.ts`
reads the bill list and each bill's publications and stores neither sponsors nor amendments; a search
of every column in the database for a sponsor or bill id returns only `edm_sponsor` and
`stage_outcomes.bill_id`. **§3.3 cannot be executed**, and it was not stubbed: `derive-signals.ts`
prints why, by name, every time it runs. The API does expose it (`/Bills/{id}` carries `sponsors[]`),
so this is an ingest job of a few hours, not a research problem. Decision **D-6**.

### A-3 · Party at the time of the vote — held, not inferred

The brief allowed for the possibility that we hold only a member's *current* party, in which case
rebellion would have had to be inferred and versioned as such. **We hold the party as at the
division**, on 2,527,966 of 2,528,032 rows (99.997%), across 36 distinct parties.

That was checked rather than taken from the 2D-2 view's comment, because a comment is not a
measurement. Members with more than one party across their votes show **clean, dated transitions**:

| member | party spans, in order |
|---|---|
| Jeremy Corbyn | Labour to 2020-10-23 · Independent 2020-11-03 → 2026-06-09 · **Your Party** 2026-06-10 → |
| Andrew Rosindell | Conservative to 2026-01-14 · **Reform UK** 2026-01-20 → |
| Diane Abbott | Labour · Independent from 2023-04-24 |
| Lindsay Hoyle | Deputy Speaker to 2019-10-31 · **Speaker** from 2019-12-20 |

254 of 361 transitions are clean (the new party starts after the old one ends); the 107 overlaps are
readmissions — Julian Lewis sits Conservative, Independent for five months in 2020, then Conservative
again, which is exactly what the record should show.

**This works end to end, and there is a live example in the output.** Imran Hussain's two votes on
the assisted dying Bill are classified differently — `unwhipped-group:v1` on 29 Nov 2024 (he had lost
the Labour whip) and `free-vote-heuristic:v1` on 20 Jun 2025 (readmitted). Nothing was told about his
suspension; it falls out of the party recorded against each vote.

### A-4 · Derive from the vote rows, not from the 2D-2 edges

**Decision: from the underlying rows**, as the brief recommended — one derivation, one provenance
chain. The reconciliation the brief asked for as a cross-check is exact and is asserted by
`check-3a.ts`:

```
2,477,541 `voted` edges − 396,956 with qualifier 'absent' = 2,080,585
                                          vote signals   = 2,080,585   ✓
```

⚠ Note the two absence figures differ and both are right: `division_votes` holds **398,919** absent
rows, of which **396,956** belong to members who resolve to an entity. The gap is the 2.00%
exclusion from A-1 showing up again.

---

## §B — SCHEMA (§2), AND THE ONE STRUCTURAL DEPARTURE

Applied to Neon by `scripts/graph/setup-3a.ts`, then **re-applied to prove idempotence** (14 ✓ lines
both times, nothing changed). Three guards run before any statement executes, and the third has been
watched firing:

```
setup-3a.ts --self-test
  unmodified DDL       → PASS (nothing foreign)
  planted ALTER        → PASS (refused: TABLE graph_entity)
  planted CREATE INDEX → PASS (refused: INDEX on division_votes)
```

### The departure: the vote signals are DERIVED, not stored

§2 says build `position_signal` "exactly per design §3". For 2,080,585 of the 2,304,748 signals —
the votes — **the row already exists**, in `division_votes`, at 193 bytes. Priced on this database
before anything was written, with 100,000 real rows through §3's exact column list:

```
position_signal, PK only                190.1 bytes/row
position_signal, with the §2 indexes    247.6 bytes/row
× 2,080,585 vote signals             =  0.48 GiB
headroom to the 17.5 GiB ops line    =  0.82 GiB   (the database was at 16.68 GiB, 95.3%)
```

It would have fitted. It was still declined, for the reason GRAPH 2D-2 declined the identical trade:
**two copies of one fact can disagree and nothing notices which is right.** Two further reasons apply
here and did not apply to 2D-2:

- `raw_weight` is **config**, and design §5 calls every weight provisional until measured. Stored on
  two million immutable rows, every tuning change becomes a two-million-row rewrite — which is the
  exact thing design §2 says the two-layer split exists to prevent.
- The classification that genuinely *is* new is **52,347 rows** (46,702 party×division + 5,645
  divisions), not two million.

So:

| relation | what it is | rows | size |
|---|---|---:|---:|
| `position_signal_stored` | design §3's table, append-only, for everything not already stored | 236,938 | 90 MB |
| `position_division_party` | per division × party: majority side, cohesion, whip status | 46,702 | 5.9 MB |
| `position_division_class` | per division: free-vote-like, and the number it was decided on | 5,645 | 0.7 MB |
| `position_signal_vote` | **view** — design §3's shape over the four tables above | 2,080,585 | — |
| `position_signal` | **view** — stored ∪ vote. The only thing any consumer reads. | 2,317,523 | — |
| `position_estimate` | design §3's table, truncate-and-rebuild | 2,304,748 | 596 MB |
| `position_estimate_meta` | one row per rebuild: config_version, as_of, counts, elapsed | 1 | 16 kB |

Every consumer sees §3's column list and nothing else. Nothing in §3 is given up, and the
losslessness invariant holds *more* strongly: a view over an immutable source cannot drift from it.

**Two column deviations from design §3, both forced by the data:**

- `evidence_ids` is **`text[]`**, not `bigint[]`. The evidence for a vote is a `corpus_sections` row
  and that table's `id` is text (`commons-divisions-votes:2071:1`). A `bigint[]` could not hold it,
  and a numeric surrogate would make the array undrillable — the one thing §3 says it must never be.
- The union view exposes **`signal_ref` (text)** rather than `id`, because a derived vote signal has
  no bigserial. `position_signal_stored.id` *is* a bigserial and `superseded_by` points into it; a
  vote signal is corrected at source instead, and the view carries `supersedable` so a caller can
  tell which is which.

**`position_estimate_meta` is an addition to §3**, and the reason is reproducibility: decay is
measured against an as-at date, so "which numbers produced this table" is (config_version, as_of),
not config_version alone. A rebuild tomorrow on identical config legitimately differs, and without
that row nothing on the page would say so.

---

## §C — THE SIGNALS (§3): PREDICTED, THEN MEASURED

Predictions were written into the scripts from the audit's reads **before** the first run, and each
script prints prediction against measurement.

### C-1 · The classification (§3.1)

| | predicted | measured | |
|---|---:|---:|---|
| `position_division_party` rows | 46,702 | **46,702** | ✓ exact |
| `position_division_class` rows | 5,645 | **5,645** | ✓ exact |
| free-vote-like divisions | 565 | **34** | ❌ **−94%** |

⚠ **My free-vote prediction was wrong by a factor of sixteen, and the reason is worth more than the
number.** I predicted 10% of divisions on the reasoning that conscience votes are roughly that
common. But the heuristic does not detect *conscience votes* — **it detects divisions where the
parties visibly failed to hold together**, and party discipline in both Houses is far tighter than
that. The two are not the same thing, which is the caveat in §C-2.

### C-2 · What the heuristic actually found, and what it cannot find

The thirty most-split free-vote-like divisions, by the number of members on their own party's
minority side, top ten:

```
 201 split  2025-06-20  commons  Terminally Ill Adults (End of Life) Bill: Third Reading
 185 split  2024-11-29  commons  Terminally Ill Adults (End of Life) Bill: Second Reading
 163 split  2025-05-16  commons  Terminally Ill Adults … Report Stage: Amendment (a) to NC10
 157 split  2025-06-20  commons  Terminally Ill Adults (End of Life) Bill: Amendment 12
 157 split  2025-05-16  commons  Closure motion
 156 split  2025-06-13  commons  Terminally Ill Adults (End of Life) Bill: New Clause 1
 153 split  2025-06-20  commons  Terminally Ill Adults (End of Life) Bill: Amendment 94
 153 split  2025-06-20  commons  Terminally Ill Adults (End of Life) Bill: Amendment 24
 148 split  2025-06-20  commons  Terminally Ill Adults (End of Life) Bill: New Clause 16
 145 split  2025-06-20  commons  Terminally Ill Adults (End of Life) Bill: Amendment 77
```

and further down the same list: **Assisted Dying Bill [HL] 2015**, **Assisted Dying for the
Terminally Ill Bill [HL] 2006**, **Hunting Bill 2003**, **Hunting Trophies (Import Prohibition) Bill
2023**, **House of Lords Reform 2003 and 2010**, **Coroners and Justice Bill 2009** (which carried
the assisted-suicide amendment), **Privileges and Conduct 2018**, and **Recall of MPs (Change of
Party Affiliation)**. These are free votes. The heuristic found them without being told anything
about the subject matter.

The named check the brief asked for:

| expected member | tagged free-vote-like |
|---|---|
| assisted dying / Terminally Ill Adults | ✅ **11 of 14** |
| hunting | ✅ **3 of 27** |
| abortion | ⚠ **0 of 11** |

⚠⚠ **The abortion result is a fact about the corpus, not a fault in the heuristic, and I checked
before saying so.** Every abortion division we hold is on the **Northern Ireland abortion
Regulations** (2020, 2021, 2022) or a Ten Minute Rule motion, and the Government whipped them:
Labour cohesion is 0.921, 0.935, 0.968, 0.978, 0.984, 0.990. Those were not free votes. The classic
free votes on abortion — 1966, 1990, 2008 — are **outside our coverage**: Commons divisions begin on
2016-03-09 (the Lords go back to 1999).

⚠ **The hunting misses are the important caveat, and they generalise.** The Lords hunting divisions
of 2001–2004 show Conservative cohesion of 0.97–0.99. That is real: hunting was a free vote and the
Conservative peers were near-unanimous *by conviction*. **A free vote on which a party happens to
agree is indistinguishable in the record from a whipped vote, and always will be** — whipping
instructions are not published. The heuristic under-detects, and it under-detects in the safe
direction: a missed free vote is scored at the whipped weight (0.2), which understates rather than
overstates.

**Threshold sensitivity**, so the 85% reads as the provisional config value it is rather than a fact:

| cohesion required | divisions tagged | of the 52 named-classic divisions |
|---|---:|---:|
| ≥75% | 13 | 2 |
| ≥80% | 14 | 2 |
| **≥85% (config)** | **34** | **14** |
| ≥90% | 57 | 19 |
| ≥95% | 115 | 22 |

⚠ **8 of the 34 have no whipped party present at all** — thin divisions where no party fielded 20
voters. They are correctly *not* whipped, but calling them "free-vote-like" flatters them; they are
really "unclassifiable, and treated generously". Named here rather than buried.

### C-3 · The five weight classes

| derivation | signals | share | weight | what it means |
|---|---:|---:|---:|---|
| `whipped-with:v1` | 1,865,002 | 89.64% | 0.2 | voted with their own party's majority |
| `unwhipped-group:v1` | 127,039 | 6.11% | 0.7 | Crossbench, Bishops, Independents, the Speakers — no whip exists |
| `small-party-unclassified:v1` | 61,919 | 2.98% | 0.2 | fewer than 20 of their party voted; "their party's side" means nothing |
| `rebellion:v1` | **18,493** | **0.89%** | 0.9 | voted against their own party's majority |
| `free-vote-heuristic:v1` | 8,132 | 0.39% | 0.7 | in a division no whipped party held together |

Two of these classes are **not in design §5's table** and were added by this sprint, because the
alternative was to describe the act falsely rather than cautiously:

- **`unwhipped-group:v1`** — a crossbench peer is unwhipped however many crossbenchers turned out.
  Calling their vote "whipped, with the whip" at 0.2 would be a false description. It carries the
  free-vote weight because it is the same fact: an unwhipped member voting their own view.
  Decision **D-3**.
- **`small-party-unclassified:v1`** — at n=3 a party's "majority side" is a coin toss, so calling
  the odd one out a rebel would be noise sold as a finding. It carries the whipped weight, so it can
  only ever understate, but under its own name so the count stays visible.

⚠ **This distinction was a real bug for one run.** The first draft separated "no whip exists" from
"too few voted" with a `≥20` test on the unwhipped branch, which silently demoted crossbenchers in
thin divisions into `small-party-unclassified` — 39,534 signals in the wrong class. Fixed with a
second column (`is_unwhipped_group`) whose meaning is exactly one thing.

### C-4 · The other signal types (§3.2–§3.5)

| signal | predicted | measured | delta | why |
|---|---:|---:|---:|---|
| `edm_signature` | 59,925 | **59,925** | ✓ exact | 1:1 with the 2D-2 view |
| `witness_appearance` | 162,733 | **175,290** | +12,557 (+7.7%) | predicted an EDGE count; a body that appeared before one inquiry on three dates is one edge and **three dated appearances** |
| `declared_interest` | 1,505 | **1,723** | +218 (+14.5%) | same shape: one relationship, several dated declarations |
| `amendment_sponsorship` | — | **0** | — | ⛔ no source data (§A-2) |
| `committee_membership` | — | **0** | — | ⛔ no source data (§A-2) |

⚠ **EDM signatures are PRIMARY SPONSORS ONLY.** 2D-2 recorded that **97.1% of the 2,125,547
signatures are still absent** from the corpus. The signal name does not say so; this report does, and
so does the code comment. Design §3 calls an EDM signature "the highest-confidence position signal
anywhere in this design" — we currently have 2.9% of them.

**The whole signal layer:**

```
derived  vote                dir +1   1,040,134
derived  vote                dir -1   1,040,451
stored   witness_appearance  dir  0     175,290
stored   edm_signature       dir +1      59,925
stored   declared_interest   dir  0       1,723
                             TOTAL    2,317,523
signals with no evidence: 0   ·   undated: 0   ·   with no weight: 0
```

### C-5 · Fifty signals read back against their source rows

Brief §3 asks for it and it is printed by `derive-signals.ts --sample`. **50 of 50 agreed with their
source row.** The vote sample is **stratified by derivation, four per class** — a plain random draw
returns 18 whipped votes out of 20 and never looks at a rebellion at all, so it would check the one
class needing checking least. Four of the twenty:

```
✓ v:commons:1787:4249  no →dir -1 w0.9  rebellion:v1        2024-04-16  Conservative  party-maj aye  coh 0.754  Tobacco and Vapes Bill: Second Reading
✓ v:commons:902:4132   no →dir -1 w0.9  rebellion:v1        2020-11-04  Conservative  party-maj aye  coh 0.899  Health Protection (Coronavirus, Restrictions) (England)
✓ v:lords:1924:3767    no →dir -1 w0.7  unwhipped-group:v1  2015-07-21  Crossbench    party-maj aye  coh 0.677  Cities and Local Government Devolution Bill [HL]
✓ v:commons:2070:5051  aye→dir +1 w0.7  free-vote-heuristic 2025-06-20  Labour        party-maj aye  coh 0.621  Terminally Ill Adults … Amendment 94
```

⚠ One thing the sample shows that is worth naming: the actor's canonical name and the source's
surface often differ — "Sir Alan Meale" against `Mr Alan Meale`, "Rt Hon Keith Vaz MP" against
`Keith Vaz`. That is the identity layer working (the edge is keyed on the MNIS id, not the name), not
a mismatch.

---

## §D — THE ESTIMATE ENGINE (§4)

`scripts/graph/build-position-estimates.ts`. Truncate-and-rebuild, 225 seconds for 2,317,523 signals
into 2,304,748 estimates at ~8,600 signals/second.

**The arithmetic lives in `scrutinise-web/lib/graph/position-math.ts`, not in the build script**,
because the read API has to do the same arithmetic across the several targets a search returns. Two
implementations of one formula drift silently — both halves keep returning plausible numbers and
nothing says which is right.

### The one non-obvious rule, and why it is not a tuning choice

Design §5 requires that **one rebellion outweighs ten whipped votes**. Under a plain weighted mean it
does not: 0.9 against 10 × 0.2 = 2.0, and the whip wins by more than two to one. That is a modelling
error, not a tuning problem — **ten whipped votes are not ten observations of the member, they are
ten observations of the same whip.** Correlated evidence must not accumulate like independent
evidence.

So within one weight class and one direction, signals are ranked by decayed weight and the *i*-th
contributes `weight / i`. Ten whipped votes are then worth 0.2 × (1 + ½ + … + ⅒) = 0.586, and one
rebellion at 0.9 outweighs them. The property the design asked for arrives by saying what the
evidence actually is, rather than by choosing numbers until a test passed.

Confidence saturates: `1 − 2^(−mass / 0.9)`, so one full-weight rebellion gives 0.5 — a single act,
however costly, is a coin-flip's worth of evidence, and it takes a pattern to get past 0.7.
Direction-0 signals combine through a probabilistic OR after being capped at 0.15, so attention can
never manufacture certainty.

### `config_version` is a hash of the constants, not a string somebody bumps

`3a.4ee358f542ea`. Change any weight, half-life or threshold and it changes; change nothing and it
does not. A hand-maintained version string is true only while everybody remembers, and the failure is
silent — estimates rebuilt with new weights carrying the old version, and a reported number that can
no longer be reproduced.

### The estimates

| target type | rows | mean confidence | max | "some recorded signals" (≥0.35) | "strong" (≥0.65) |
|---|---:|---:|---:|---:|---:|
| division | 2,080,585 | 0.095 | 0.497 | 29,670 | **0** |
| edm | 59,925 | 0.071 | 0.363 | 829 | **0** |
| inquiry | 162,733 | 0.049 | 0.150 | 0 | **0** |
| organisation | 1,505 | 0.078 | 0.150 | 0 | **0** |

⚠ **Nothing in `position_estimate` ever reaches "strong recorded record", and that is correct rather
than broken.** A division holds exactly one vote per member, so a per-target estimate aggregates
exactly one signal; the ceiling for a single undecayed rebellion is 0.5. The strong band is reachable
only by rolling several targets together, which is what the read API does and what the deepening will
always pass. Verified live: one free vote reads 0.386 → *"some recorded signals"*; the same member's
two consistent votes read 0.614.

### The sanity check nobody designed

The ten highest-confidence records in the entire graph, in order: **Richard Burgon, Bell
Ribeiro-Addy, Nadia Whittome, Grahame Morris, Ian Byrne, Imran Hussain, Apsana Begum, Rachael
Maskell**. The arithmetic identified the Labour left from nothing but who voted against their own
party's majority, most recently and most often.

### The checks — 33/33, and 15 of 15 breaks fire

`check-3a.ts` covers every constructed case §4 names, plus the database invariants:

- one rebellion outweighs ten whipped votes · a 15-year-old vote counts less than a 1-year-old one ·
  40 attention signals never pass the ceiling · aggregation is order-independent across three
  orderings · a signal type with no half-life does not decay · a future-dated signal is clamped ·
  changing a weight or a half-life changes `config_version` · exactly three forms of words ·
  a near-zero stance is a "divided record", never neutral;
- `position_raw_weight()` in SQL agrees with the TypeScript config on all 10 classes · an
  unrecognised class gets **NULL**, not a silent 0.2 · every signal has evidence, a date, a weight
  and a real entity · absent votes produce no signal · one `config_version` on the table · **no
  estimate exists for an (actor, target) with no signals** · no estimate carries confidence exactly 0
  · the vote/edge reconciliation above · 3A created no relation outside its own seven.

⚠⚠ **The self-test was itself wrong first, and that is the useful part.** Its first version broke one
thing — flat weights, no decay, no ceiling — and expected all twelve cases to fail. **Ten said DID
NOT FIRE**, correctly: determinism, version stability and "attention has no side" are structural, and
no config change can falsify them. *A blanket break tests the checks it happens to reach and quietly
certifies the rest.* Rewritten with one purpose-built break per property — an order-dependent
aggregation, a frozen version string, a counter in the version, a fourth confidence band, a moved
band boundary, "neutral" reintroduced, a 0.2 fallback weight — and all 15 now fire.

---

## §E — THE READ API (§5)

`scrutinise-web/lib/graph/positions.ts`, new and CC-Graph-owned. `positionsFor(targets[], opts)`
returns, per actor: the rolled-up estimate, confidence, the fixed wording for both, the signal
breakdown, the per-target estimates, and every signal as a dated, drillable citation with a label a
human can read.

`describeConfidence()` maps confidence to exactly three phrases — *"strong recorded record"* /
*"some recorded signals"* / *"weak indication"* — so callers cannot each invent their own adjectives.
`describeStance()` does the same for the score and **refuses the middle**: a near-zero score is a
"divided record", never "neutral". There is no band for "no signals", because that case must never
reach the function: an actor with no signals is absent, and absence is the caller's to render.

**21/21 against the live graph** (`npm run verify:positions`), asserting content rather than shape.
Two findings came out of running it:

⚠⚠ **1. Do not roll several divisions on one Bill into one number.** Of 453 members with three or
more votes on the assisted dying Bill, **448 come out as a "divided record"** — because voting *for*
the Bill and *against* an amendment to it are opposite directions once summed. The direction of a
vote is *relative to the division question*, and an amendment's question is the amendment. This is
exactly the gap §3.3 and 3B exist to close (strengthening vs wrecking). Decision **D-2**.

⚠ **2. My own test was wrong about the world before the code was.** It asserted that some members
must have changed their minds between the Bill's two readings. **All 400 who voted in both voted the
same way both times** — a settled conscience position, not a bug. The assertion was rewritten to test
the mechanism (which does separate consistent from divided records) rather than to demand something
of the record.

Two errors found by *running* the SQL rather than reading it, both recorded in the code:

- `(target_type, target_id) = ANY($1::record[])` is refused outright by Postgres — *"input of
  anonymous composite types is not implemented"* — and it fails at execution, so it reads as a data
  problem. Replaced with two parallel arrays through `unnest`.
- A numeric cast guarded by `AND s.target_type = 'division'` **is not safe**: the planner may
  evaluate the cast before the guard, and an EDM id in the same result set kills the query with
  *"invalid input syntax for type bigint"*. Only `CASE` guarantees the branch is not evaluated.

### The integration snippet — NOT applied, per §0

The political-risk hook is deliberately out of this sprint because SEARCH S8 was editing the
deepening pass configuration today. **S8 has since landed** (`3060c43`, 2026-08-19 09:35 UTC), so the
follow-up commit is now unblocked — it was still not made here, because §0 scoped it out and the
deepening config is not 3A's to touch. Ready to apply:

```ts
// in the deepening's political-risk pass, after the gateway has found the relevant artefacts
import { positionsFor, parseTarget } from '@/lib/graph/positions'

const targets = retrieved.divisions.map((d) => ({ type: 'division' as const, id: `${d.house}:${d.divisionId}` }))
const graph = await positionsFor(targets, { minConfidence: 0.3, limit: 20, actorKind: 'person' })
const lines = graph.actors.map((a) =>
  `${a.name} — ${a.stanceWording} (${a.confidenceWording}): ` +
  a.grounds.slice(0, 3).map((g) => `${g.derivation ?? g.signalType} on ${g.targetLabel} (${g.date})`).join('; '))
// graph.targetsWithNoSignals MUST be reported as "no record", never omitted and never as "no view".
```

⚠ Pass only the divisions the search identified as being *on the proposition*, not every division on
a bill — see finding 1 above.

---

## §F — THE ADMIN SURFACE (§6)

`/admin/positions`, linked from the `/admin` tab bar as **"Position Graph"** (a page nothing links to
is a page nobody opens). Gated by `app/admin/layout.tsx`'s existing Clerk + role gate; the API route
re-checks the role independently, because one gate covering two paths is a gate that silently stops
covering one of them.

It searches divisions and EDMs by title, takes pasted ids, and shows ranked actors with the score,
the fixed wording, the signal breakdown, and a drillable evidence table with the date, the
classification, the side, the weight, the source link and the `corpus_sections` id. Every actor
carries its **identity tier** in the wording defined once in SQL, colour-coded, so a mention-only
actor can never be presented as an identified one. The config that produced every number on the page
is on the same page, and the header states in plain words that none of it has been scored against a
validation set.

⚠ **NOT browser-verified, and it is not claimed.** The Chrome extension has no host permission for
`localhost:3000` and the browser holds no Clerk session on production, so no authenticated walk was
possible from here. What *is* verified: `next build` compiled successfully with `/admin/positions`
and `/api/admin/positions` both present, `tsc` is clean, and every number the page renders comes from
`positionsFor()`, which is exercised 21/21 against the live database. **The click is Charlie's.**

---

## §G — DECISIONS FOR CHARLIE

**D-1 · `position_estimate` costs 596 MB and takes the database to 99.2% of the ops alert line.**
348 MB of rows and 248 MB of indexes. It fits; the enforced ceiling is 16 TiB (`neon.max_cluster_size`),
so 17.5 GiB is a *warning* line and the observer has been red since before this sprint (95.3%). But
**2,080,585 of the 2,304,748 rows summarise exactly one vote each** and could be computed at read
time in microseconds — and, being decay-baked, they go slightly stale every day, while a read-time
computation is always current. Only **12,775** estimates aggregate more than one signal.
*Recommendation:* keep it for now — it makes the admin surface instant and it is what the brief
asked for — and revisit in 3B when the registers add rows. Reversal is one command
(`TRUNCATE position_estimate`) plus a small change to have the read API compute `byTarget` from
signals. **Say if you would rather have the 596 MB back now.**

**D-2 · Amendment divisions currently poison a Bill-level rollup, and nothing stops a caller doing
it.** 448 of 453 members read as "divided" on the assisted dying Bill for a purely structural reason.
Until 3B classifies amendments, the read API should only ever be passed divisions that are *on the
proposition*. *Recommendation:* accept as a documented constraint for 3A (it is, above and in the
code), and make amendment classification the first thing 3B does. The alternative — refusing
multi-division rollups in code — would also block the legitimate case.

**D-3 · `unwhipped-group:v1` at weight 0.7 (127,039 signals, 6.1%).** Design §5's table has no row
for Crossbench peers, Bishops, Independents or the Speakers. I gave them the free-vote weight because
they genuinely have no whip. The alternative is the whipped weight 0.2, which would be a *false*
description rather than a cautious one. *Recommendation:* keep 0.7. **Your call; it is one number.**

**D-4 · Witness appearances and committee membership have no half-life in design §5.** I gave them
the vote half-life (8 years) as the one I could defend, and labelled it `[NOT IN DESIGN]` in the
config rather than passing it off as settled. Both are direction-0 and capped at 0.15 confidence, so
the practical effect is small. *Recommendation:* leave until the validation set measures it.

**D-5 · 120 members are excluded from the graph although we know exactly who they are.** All 120 are
in `graph_member_register`; they have no `graph_entity` row because their names collide. It costs
50,491 votes (2.00%), including every vote by Lord Patel, Lord Jopling and Lord Moynihan. MNIS ids do
not collide even when names do, so an entity keyed on `parl_member_id` is safe by construction.
⚠ **It is the entity sweep's job, not 3A's** — design §3: the graph never creates people.
*Recommendation:* a small addition to the 2D-2 sweep in 3B.

**D-6 · Amendment sponsorship needs an ingest job before §3.3 can ever run.** `bills-api` exposes
`sponsors[]` on `/Bills/{id}`; we store only publication PDFs. A few hours of ingest work, no LLM
cost, and it unlocks both §3.3 and the 3B classification that D-2 depends on.
*Recommendation:* put it in 3B's ingest half alongside the registers.

---

## §H — WHAT IS NOT DONE

- **The deepening wiring.** Deliberate — §0 holds it until SEARCH S8's commit lands. The snippet is
  in §E, ready.
- **§3.3 amendment sponsorship** and **§3.4 committee membership** — no source data (§A-2). Reported
  in the script's own output every run, not silently skipped.
- **3B's amendment classification**, so amendment signals stay direction 0 and D-2 stands.
- **The §8 validation set.** Nothing here has been scored against a hand-labelled answer key. That is
  the gate on any of this reaching a user, and it is why the only surface is admin-only.
- **97.1% of EDM signatures** — still primary sponsors only, pending the signatory scrape.
- **A browser walk of `/admin/positions`** — not possible from here (§F); Charlie's.
- **Any user-facing surface at all.** By design.
