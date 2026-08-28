# GRAPH 4B — REPORT

**Executes** `docs/BRIEF_GRAPH_4B.md` §1–§6. **Written** 28 August 2026.
**Predictions** logged in `docs/CHANGE_LOG.md` at 2026-08-27 23:56 UTC, before the Layer-2
extraction had read a single document, and scored below.

---

## THE SHORT VERSION

1. **The identity bridge is built and the join it fixes was watched returning zero first.** Three
   known pre-1963 Acts return **0** rows today and **59 / 50 / 50** through the bridge — exactly the
   figures GRAPH 4A measured under the other id form. `check-4b-identity` **30 passed, 0 failed**.
2. ⚠⚠ **THE BRIDGE FOUND A DEFECT IN BOTH THE COPIES IT REPLACED.** **419 calendar-year ids name
   TWO DIFFERENT ACTS EACH** — 41 Geo 3 and 42 Geo 3 are both 1801, and each session numbers its
   chapters from one. Both old copies wrote the map in a single pass, so **the last entry seen
   silently won**. That is a merge on similarity, arrived at by accident, in the code that exists to
   prevent one. The shared bridge **refuses** them and **records the refusal as a row**.
3. **Layer 2 is built: 191,258 enabling rows over 70,576 instruments**, every one carrying the
   enacting words that granted the power. It is a **separate `detection` value**, never summed with
   a mention. ⚠ **P1 and P2 are REFUTED** — I predicted at least 230,681 and got 191,258, for a
   reason that is itself the sprint's second finding.
4. ⚠⚠ **AND THAT REASON IS A SECOND DEFECT, FOUND BY READING THE PARSER'S OUTPUT.** **36.1% of the
   old preamble parser's SECTION-level refs were wrong** — a bracketed subsection read as a section
   (`sections 191(2) and 195(3)` → `section-191`, **`section-2`**, `section-195`), and a ref list
   attached to the wrong Act in a preamble naming several. **`legislation_edges` still holds them.**
5. **§2.2's gate PASSES, and it is the two-sided answer that makes it useful.** Schedules are in the
   corpus (271,860 sections) *and* in the bulk CLML. But matched on the **same documents**,
   **retention is 41.3%** — 118 of 201 schedule-bearing instruments reached the corpus without their
   schedule.
6. ▶▶ **§3.1's REAL ANSWER: 127 of the 247 missing double taxation agreements are already on this
   machine.** Not recoverable by Layer 2 — an enabling row is a preamble fact — but present in the
   bulk CLML the corpus dropped. **No fetch is needed for those 127; an ingest pass is.**
7. **The coverage block now carries §1's residual and §2.2's schedules, live.** `check-4a-coverage`
   **30 passed, 0 failed** — and one of its own assertions had to change, **after being watched
   failing**, because 4A wrote it to pin a layer this sprint built.
8. **Nothing was retired.** `legislation_edges` still holds all 230,681 `made-under` rows and
   2.23M rows of five other edge types.

---

## §1 — THE IDENTITY BRIDGE

`scripts/ingest/graph/identity.ts` · `setup-identity-table.ts` · `audit-4b-identity.ts` ·
`check-4b-identity.ts` → `audit-4b-identity.json`.

### The join, watched failing, then fixed

The brief asked for the check to be watched failing against today's implementation. It was, and the
failing state is now **pinned permanently** rather than described: `check-4b-identity` asserts that
the unbridged join returns **zero** and that the bridged one returns the right number. If someone
later "fixes" this by rewriting one table's id forms, the first three assertions fail and say so.

| Act | `citation_edge`'s form | `cites` rows under it TODAY | under the URI's calendar form | **through the bridge** |
|---|---|---|---|---|
| Factories Act 1961 | `ukpga/Eliz2/9-10/33` | **0** | 59 | **59** |
| Coast Protection Act 1949 | `ukpga/Geo6/12-13-14/54` | **0** | 50 | **50** |
| Public Health Act 1936 | `ukpga/Geo5and1Edw8/26/49` | **0** | 50 | **50** |

⚠ **A zero there does not look like a bug. It looks like an Act nothing cites.**

⚠ **One correction to GRAPH 4A.** 4A wrote that the two tables disagree such that the regnal form
returns 0. That is true **of the `cites` edge type only**. Across all edge types `legislation_edges`
holds **63,520** rows under regnal forms — the TNA effects CSVs use them — so the same three Acts
return 1,591 / 147 / 266 rows under the regnal form and 109 / 227 / 50 under the calendar one. **Both
forms are in that table, from different code paths, and neither reaches the other.** The bridge
unifies them: 1,700 / 374 / 316, which is exactly the sum, checked as an assertion so a bridge that
invented rows would fail rather than look like a bigger win.

### ⚠⚠ 419 calendar ids name two Acts each, and both old copies picked one at random

This is the finding of §1. `v36/source-entries.json` pairs 14,294 (regnal, calendar) ids. **419 of
those calendar ids are claimed by two different regnal Acts** — `ukpga/1801/16` is both
`ukpga/Geo3/41/16` and `ukpga/Geo3/42/16`, because two parliamentary sessions fell inside 1801 and
each numbered its chapters from one.

Both existing copies built the map with a single pass of `map.set(calendar, regnal)`, so **the last
entry seen won, for 419 ids**. Neither had any way to know. The standing rule is *never merge two
identities on similarity*; this was a merge with no basis at all, reached by iteration order.

▶ The bridge refuses them. ⚠ **And it stores the refusal**, with a NULL canonical and
`basis = 'ambiguous-refused'`, because the brief's rule is that an unresolvable form "stays
unresolved and is **counted**" — and **a form merely absent from a table is indistinguishable from
one nobody has ever seen.** A database constraint enforces the shape: a refusal may not carry a
canonical, and a bridge may not lack one.

### Every equivalence has a named basis, and 'looks similar' is not one

| basis | rows | what it means |
|---|---|---|
| `source-enumeration` | 13,454 | legislation.gov.uk's own year feeds paired the two ids on one entry |
| `ambiguous-refused` | 419 | the form names more than one instrument — refused, recorded |
| `prefix-alias` | 0 today | a declared prefix family (`eud`/`eudn`/`eudr`) |
| `zero-padding` | 0 today | the same numeral with leading zeros |

A `CHECK` constraint rejects any other value; the check plants `'looks-similar'` and watches the
database refuse it.

### One resolver, and a guard that says so

`buildAliasMap`/`identitiesFor` are **deleted** from `extract-citation-edges.ts`,
`audit-25h-citations.ts` and `v37-citation-gaps.ts`. ⚠ **4A named two copies; there were three.**
`check-4b-identity` greps every file the graph reads for the three shapes of the old logic and fails
on any of them — **watched firing on all three real copies before they were removed, and on a
planted fourth afterwards.**

⚠ **`v37-citation-gaps.ts` sits outside `graph/` and I edited it anyway.** GRAPH 4A §6 named it as
one of the two copies the bridge replaces, and leaving a third copy would have made the guard a lie.
The change is an import swap and nothing else. **Flagged here because §6 says nothing owned by
ingest should be edited — if that was the wrong call, reverting it is one line and the guard will
then fail honestly instead of passing.**

### The residual, counted

| | |
|---|---|
| regnal-form targets in `citation_edge` | 783 |
| of those, with **no calendar twin** — unjoinable, permanently | **13** |
| calendar-form targets **refused** as ambiguous | **77** |
| `citation_edge` rows whose target matches `legislation_edges` **only** through the bridge | **95** |
| distinct targets that recovers | **47** |

### §6 re-answered with the bridge in place

| | raw ids | **bridged** |
|---|---|---|
| `cites` pairs in both tables | 109,099 (**98.1%**) | **109,699 (98.7%)** |
| pairs only in `legislation_edges` | 2,094 | **1,494** |

▶ **The bridge moves 600 pairs out of "missing".** 4A recovered 1,980 of the 2,094 by matching on
the raw `target_uri` string; the bridge recovers 600 of them **through a stated identity with a
stated basis**, which is a different and stronger thing than a string match. The remainder are pairs
whose target `citation_edge` genuinely does not hold, plus the ambiguous forms the bridge refuses on
purpose.

⚠ **What retiring the superseded `cites` rows would now take, unchanged from 4A except step 1:**
1. ~~An identity bridge first.~~ **Done.**
2. Repoint `impactSet()`'s `citedBy` group at `citation_edge`, with `edges-query-service.ts` and
   `score-gold-d.ts`.
3. Repoint `v37-citation-gaps.ts`, which counts `cites` and `made-under` as "ours".
4. Only then delete. ⚠ **Nothing was retired in this sprint**, per the brief — asserted by a check.

---

## §2 — LAYER 2: INSTRUMENTS REFERRING TO LEGISLATION

### §2.2 — THE GATE, answered on both sides

`audit-4b-schedules.ts` → `audit-4b-schedules.json`. **Exit 3 if either side is empty**, so a caller
cannot proceed past it.

| side | measurement |
|---|---|
| the corpus | `si-2010plus` **103,908** schedule sections over 2,605 instruments · `si-pre-2010` **167,952** over 6,813 |
| the bulk CLML the extractor reads | **285 of 800** sampled SI documents carry a `<Schedule>` (35.6%), 643 elements, median 5,757 characters |

▶ **VERDICT: INGESTED.** The gate passes and Layer 2 was built.

⚠⚠ **But the matched comparison — the same documents, both sides — is the number that matters, and
it is not 100%:**

| | documents |
|---|---|
| sampled documents that are in the corpus at all | 574 |
| CLML has a schedule **and** the corpus has one | 83 |
| CLML has a schedule and the corpus has **none** | **118** |
| corpus has one the CLML does not | 0 |

▶ **Schedule retention: 41.3%.** ⚠ A corpus ratio set against a zip ratio would have been two
different denominators and would have hidden this; the first version of this audit did exactly that
and made the drop invisible. **This bounds every answer that depends on scheduled text.**

### §2.1 — the enabling relationship, as its own edge type

`extract-enabling-edges.ts` writes `detection = 'enabling'` into `citation_edge`. The `CHECK`
constraint was **widened** (additive: it accepts strictly more, so no existing row can fail it), and
a check watches the database refuse an undeclared fourth value.

⚠ **The parser is imported, not restated.** `parseEnabling` now lives in
`extract-madeunder-edges.ts` and **both** writers call it — the `legislation_edges` writer and the
`citation_edge` one. Two copies of one parser is the shape that put the regnal-year trap in four code
paths. ⚠ That file's `main()` is now guarded; importing from it previously **started a full
extraction over a 1.4 GB zip that writes to the database.**

**Why the separation is load-bearing, in one row of data:**

| target | mentions (`markup` + `text`) | **made-under** |
|---|---|---|
| `ukpga/1972/68` — European Communities Act 1972 (**repealed**) | 126 | **6,017** |
| `uksi/1981/238` | **0** | **3,459** |
| `ukpga/1977/49` — National Health Service Act 1977 | 3,913 | 4,910 |

▶ A repealed Act that 6,017 instruments **stand on** and 126 merely mention. An instrument that
**nothing mentions** and 3,459 are made under. ⚠⚠ **Flattening those two numbers produces a
confident, wrong consequence list**, which is worse than a short one. `inboundSummary`'s
`byDetection` keeps them apart and a check asserts the enabling count is never the total.

### §2.3 — volume, against 4A's estimate

| | 4A estimated | **measured** |
|---|---|---|
| rows | 230,681 (re-extract) / ~358,563 (every SI) | **191,258** |
| instruments covered | 70,255 | **70,576** |
| distinct enabling Acts | 5,060 | **5,088** |
| naming a provision | 56.5% | **46.1%** |
| storage | 0.27 GB | **0.212 GB** |
| cost at $0.35/GB-month | $0.09/month | **$0.07/month** |
| build time | "a single pass" | **63 seconds** over 83,731 documents |

⚠ **Storage is a bill, not a wall.** The retired alert line is not repeated and must not be.
`citation_edge` is now **1.36 GB over 1,225,806 rows** — 1,107 bytes/row.

### ⚠⚠ Why the row count came in LOW: 36.1% of the old parser's section refs were wrong

Found by reading eight rows of output, not by reading the code. Two defects, both in
`refListBefore`, both **already present in the 230,681 rows `legislation_edges` holds**:

1. **A subsection was read as a section.** `\d+[A-Z]*` over the raw list matched the bracketed
   subsection, so *"sections 191(2) and 195(3) of"* produced `section-191`, **`section-2`**,
   `section-195`. `section-2` is an edge to a provision the instrument was never made under. Most
   enabling powers are written with a subsection.
2. **A ref list was attached to the wrong Act.** *"section 2(2) of the European Communities Act 1972,
   section 379A of the Financial Services and Markets Act 2000 and sections 204(6) … of the Banking
   Act 2009"* has one anchor per Act, and the old regex matched the **earliest** list in the window
   for every one of them — so FSMA's anchor was given the European Communities Act's section 2.

Measured over 2,000 sampled documents, both parsers fed **identical bytes** (the exact window the
parser saw, not the truncated quote):

| | |
|---|---|
| section refs, old parser | 3,094 |
| section refs, fixed parser | 2,059 |
| **dropped as subsection artefacts** | **975** |
| **re-attributed away from the wrong Act** | **142** |
| **share of the old parser's section refs that were wrong** | **36.1%** |

⚠ **Act-level rows were never affected** — only the section-level ones, which are the rows a repeal
analysis actually reads. ⚠ **My first attempt to measure this reported 0 subsection artefacts and
1,117 re-attributions**, because it compared the two regexes' whole matched spans, which are
structurally different and can never be equal. The comparison is now on the numeral list.

⚠⚠ **`legislation_edges` still holds the defective rows.** Re-extracting it is a decision, not a
side effect — Q2 below.

### §2.3 — quality: twenty hand-checked against legislation.gov.uk, live

⚠ **Against the source, not against our own zip.** A check that re-reads the same bytes the extractor
read proves the extractor is deterministic, which nobody doubted. Twenty stored rows were re-fetched
from legislation.gov.uk and the enabling Act and provision read out of the source's own current XML.

| | |
|---|---|
| enabling Act correct | **18 of 18 fetched** (2 unfetchable) |
| provision correct, where one is named | **9 of 9** |

⚠ **The first run scored 9 of 9 and FAILED**, because eleven of twenty timed out — the source rate
limits, and the check's floor of ten checked cases caught it. One request at a time with a pause and
a retry fixed it. ⚠ **The same fragility was live in `check-25h-verify.ts`**, which fired four
requests back to back with no retry and **died on an HTTP 500 that moved to a different document on
each attempt** — every one of its URLs returns 200 when asked for alone. A check that dies on
someone else's throughput reports a fault in our data; it now records a case as unchecked and fails
only if too few were reached to prove anything.

**Scale control: PASSES.** European Communities Act 1972 (broad, old) 6,143 inbound vs
`wsi/2020/92` (narrow, recent, a Welsh food-labelling amendment) 0.

---

## §3 — WHAT LAYER 2 UNLOCKS FOR TAX AND TREATIES

`audit-4b-tax.ts` → `audit-4b-tax.json`. **Report only — nothing fetched, ingested or written.**

### 1. Does Layer 2 with schedules recover any of the missing agreements?

**286 double taxation Orders** (4A said 288, counting two EU Council Decisions; the operative set is
286 `uksi`). **39 hold a schedule section — 13.6%.** 4A's 39-of-288 reproduces exactly.

⚠⚠ **The question has two readings and they give different numbers. Both are answered.**

**(a) Does the enabling layer recover them? ZERO — and not by accident.** An enabling row is a
**preamble** fact: which Act granted the power. The missing thing is a **schedule**. 182 of the 247
now carry an enabling row, so they are visible to the graph; the treaty still is not in it. ⚠ Counted
anyway rather than argued from construction, because "by construction" is how a wrong assumption
survives.

**(b) Are the bytes already on this machine? ▶▶ 127 OF THE 247 ARE.**

| | Orders |
|---|---|
| missing the schedule in the corpus | 247 |
| **carrying a ≥4,000-character schedule in the bulk CLML we hold** | **127** |
| carrying no substantial schedule in the CLML either | 120 |
| absent from the bulk file | 0 |

▶ **127 need no fetch at all — they need an ingest pass over a file already on disk.** The other 120
need the source. ⚠ This is §2.2's 41.3% retention arriving where it matters most.

### 2. Is the reverse direction answerable today? ▶ YES

TIOPA 2010 s.6 gives these agreements effect *despite anything in any enactment*, so the useful
question is not only *"what does my change break"* but *"does a treaty already prevent this"*.

`citation_edge` is indexed on **both** `source_gid` and `target_act_id` (read from `pg_indexes`, not
assumed). Outbound from the 286 Orders: 856 rows. Inbound to them: 98. The worked query —
*"which instruments are made under TIOPA 2010?"* — returns **110 instruments**.

⚠ **Answerable is not the same as answered well.** The query runs; what it can say is bounded by the
127+120 Orders whose agreement text is absent, and by OI-3 — `uk-treaties` and `tax-treaties-dta`
can still be returned by no search query at any setting.

### 3. MLI positions? ▶ NOT HELD, unchanged, and Layer 2 cannot change it

55 `corpus_acts` titles contain "multilateral"; the tax/treaty-shaped ones are an EC competition
decision and two stamp-duty instruments about clearing houses. **None is the MLI.** ⚠ The MLI
modifies many agreements at once **without amending each Order**, so nothing in any Order's preamble
can carry it — this is structurally outside what Layer 2 reads. The coverage block declares
`treaty-obligations` NOT BUILT with its consequence.

---

## §4 — THE COVERAGE BLOCK EXTENDS TO THE NEW LAYER

**Extended, not bypassed.** Three additions, **every figure a live query**:

- **Layer 2's status.** ⚠ The probe was **not edited**. 4A wrote it to flip to `searched` the moment
  a `detection` value outside the two textual detectors exists — precisely so that building the layer
  would need no edit here. It flipped on its own.
- **§1's identity-bridge residual** — forms bridged, regnal targets, those with no calendar twin, and
  those refused as ambiguous, each reported separately.
- **§2.2's schedule coverage** — instruments holding a schedule section, out of all instruments.

⚠ **All three reach the RENDERED WORDS**, asserted, not just the object — the distinction 4A's own
check had to make about a planted fact.

⚠⚠ **ONE OF 4A's ASSERTIONS HAD TO CHANGE, AND IT WAS WATCHED FAILING FIRST.** 4A pinned the
enabling layer as `held-elsewhere` with zero rows. This sprint built it, so that assertion failed on
the first run after the extraction — **which is the pin working.** It now asserts the layer reads
`searched` **on rows this table really holds**, and the original regression it existed for is pinned
directly: the layer's row count must differ from the count of incidental *"in exercise of the powers"*
phrase matches (191,258 vs 2,356), so 4A's 858-row false positive cannot return. A third assertion
requires every enabling row to carry non-empty evidence.

Four new facts recorded in `graph_coverage_fact` **from the audits' own JSON, never re-keyed** —
`si_schedule_retention_pct` 41.3, `dta_orders_recoverable_from_held_bytes` 127,
`madeunder_section_refs_wrong_pct` 36.1, `identity_ambiguous_calendar_forms` 419. Each carries its
measurement date and announces itself STALE past the window.

⚠ Nothing that is a property of a **row** was recorded as a fact — the bridge residual, schedule
coverage and Layer 2's size are all live queries. **Two sources for one figure is how they drift.**

---

## §5 — THE CROSS-REFERENCE GRAPH AS ITS OWN LISTED CAPABILITY

CC-Lex's message is accepted and acted on. **`docs/CROSS_REFERENCE_GRAPH.md`** is a new standing
document naming the cross-reference graph as a distinct capability, with its own coverage statement,
and stating plainly what it is **not** — the effects graph is a different question over a different
grain with different provenance, and calling either "the graph" is how a layer gets built twice.

⚠ The coverage block inside it is a **dated reading**, regenerable with `npm run graph:coverage`, and
labelled as such — a caveat copied by hand goes stale silently.

---

## PREDICTIONS, SCORED

| # | prediction | outcome |
|---|---|---|
| P1 | ≥ 230,681 rows | ❌ **REFUTED** — 191,258. The fixed parser writes fewer, correct, section rows |
| P2 | 250,000–400,000 rows | ❌ **REFUTED** — 191,258, below the band |
| P3 | storage within ±50% of 0.27 GB, under $0.50/month | ✅ **CONFIRMED** — 0.212 GB, $0.07/month, and under 1,160 bytes/row as reasoned (1,107) |
| P4 | provision share within ±10pp of 56.5% | ❌ **REFUTED, narrowly** — 46.1%, 10.4pp below. The parser fix is the whole difference |
| P5 | instruments > 70,255, by < 15% | ✅ **CONFIRMED** — 70,576, +0.5% |
| P6 | hand-check ≥ 17 of 20 | ✅ **CONFIRMED** — 18 of 18 fetched, and 9 of 9 on provisions |
| P7 | scale control passes | ✅ **CONFIRMED** |
| P8 | §3.1 recovers fewer than 20 | ✅ on reading (a) — **0**. ⚠ **My own flagged caveat came true**: on reading (b), the one anyone actually wants, it is **127** |
| P9 | reverse direction answerable | ✅ **CONFIRMED** |
| P10 | MLI not held | ✅ **CONFIRMED** |

**7 confirmed, 3 refuted.** ⚠ **The three refutations share one cause and it is a good one:** I sized
Layer 2 from a parser that was producing 36.1% wrong section refs, so every row-count prediction was
anchored to a defect. P4 is the clearest signal — the provision share fell by almost exactly the
share of section refs that were wrong.

---

## WHAT IS NOT DONE, NAMED

1. **`legislation_edges` is not re-extracted.** Its 230,681 `made-under` rows still carry the
   36.1% defective section refs. Decision Q2.
2. **The 127 recoverable double taxation schedules are not ingested.** §3 is report-only by
   instruction, and the fetch — here, the *re-read* — is an ingest job. Decision Q3.
3. **Nothing was retired.** As instructed, and asserted by a check.
4. **The 120 Orders whose agreement is in neither the corpus nor the bulk file are not investigated.**
   They may be on legislation.gov.uk under a different path, or genuinely never scheduled.
5. **The 13 regnal targets with no calendar twin are not resolved**, and will not be from this
   source. Counted, not guessed at.
6. **No user-facing surface.** Nothing under `scrutinise-web/` reads either graph table; this was
   true before the sprint and is unchanged. **No live-site verification is possible or applicable.**
7. **The 3.5% discrepancy 4A flagged between its unresolved-span count and 25-H's is still
   unexplained.** Not in scope here, still open.
8. **OI-3 is untouched** and still binds §3 harder than anything in this sprint: `uk-treaties` and
   `tax-treaties-dta` can be returned by no query at any setting.
9. **`extract-madeunder-edges.ts`'s `detail` column semantics changed** — it now records the words
   immediately before the anchor rather than the first 160 characters of the enacting text. Existing
   rows are untouched; a future run would write different `detail` values. Better, but a change.

---

## DECISIONS FOR CHARLIE

**Q1 — I edited `v37-citation-gaps.ts`, which lives outside `graph/`.**
GRAPH 4A §6 named it as one of the two copies the identity bridge replaces, and it carried a third
copy of the alias map with the 419-id defect. The change is an import swap; behaviour is unchanged
except that ambiguous ids now resolve to nothing instead of to one of two Acts at random.
▶ **Recommendation: keep it.** A guard that says "no file the graph reads builds its own identity
map" while a file the graph reads does exactly that is worse than no guard.
*Consequence of reverting:* one line, and the check then fails honestly rather than passing on a
narrowed scope. *Consequence of keeping:* an ingest-owned file carries a graph change; the ingest
lane should know.

**Q2 — Re-extract `legislation_edges`' `made-under` rows with the fixed parser?**
36.1% of their section-level refs are wrong. The act-level rows are fine. `citation_edge` now holds
the same relationship, correctly parsed, with evidence.
▶ **Recommendation: yes, and soon — but as a REPLACE, not an append.** The defective rows do not
overwrite themselves: the primary key includes `to_id`, so a corrected run **adds** the right rows
and leaves the wrong ones beside them. It needs a scoped delete of `source = 'clml-si-preamble'`
first.
*Consequence of not doing it:* every consumer of `made-under` — `impactSet()`, the gap census —
reads a third of its section-level answers off a subsection number or the wrong Act. **Silently.**
*Consequence of doing it:* a few minutes of compute and one scoped delete against production, which
per CLAUDE.md is a staged, guarded, reversible step I hand over rather than run.

**Q3 — The 127 double taxation agreements already on disk.**
Their schedules are in `best-collection-xml.zip`; the corpus dropped them. No network fetch needed.
▶ **Recommendation: yes, as an ingest job, and scope it to the whole 41.3% retention problem rather
than to these 127.** They are a symptom.
*Consequence of leaving it:* a tax question about a treaty returns the Order's three operative
articles and **reads as an answer**. That is the 2% markup failure one level down, and it is now
measured rather than suspected.

**Q4 — Schedule retention is 41.3%. Whose problem is it?**
The bulk CLML carries schedules for 35.6% of instruments; the corpus holds them for 8.6%. Matched on
the same documents, 118 of 201 schedule-bearing instruments lost their schedule in ingest.
▶ **Recommendation: an ingest sprint, sized from this measurement.** §2.2 told me to stop and report
if schedules were absent; they are not absent, they are **incomplete**, which the brief did not
anticipate and which I have therefore reported rather than worked around.
*Consequence of leaving it:* every answer that depends on scheduled text is short by an unknown
amount, and the coverage block can now say so but cannot fix it.

**Q5 — Retire the superseded `cites` rows now that the bridge exists?**
The prerequisite is met. 98.7% of `cites` pairs are in `citation_edge` bridged, plus 226,516 more,
plus evidence. Three repointings remain (§6 above).
▶ **Recommendation: not yet — do Q2 first.** Re-extracting `made-under` and retiring `cites` both
touch `legislation_edges`, and doing them in one sprint with one verification is cheaper and safer
than twice.
*Consequence of retiring now:* `impactSet()` and the gap census break until repointed.
*Consequence of waiting:* the 924-edge OI-15 residual and the 37%-of-Acts blindness stay in the
`cites` rows. **Nothing a user can see is affected** — the graph has no user-facing surface.

**Q6 — The 419 ambiguous calendar ids.**
`ukpga/1801/16` names two Acts. The bridge refuses them; 77 of them are live targets in
`citation_edge`.
▶ **Recommendation: leave them refused, and surface the ambiguity to the user when one is asked
about.** The information to disambiguate is in the citing document's own words, not in the id.
*Consequence of resolving them by rule:* a wrong answer half the time, presented as a right one.
*Consequence of leaving them:* 77 targets whose inbound list is split across two identities.

---

## ARTEFACTS

| file | what |
|---|---|
| `scripts/ingest/graph/identity.ts` | §1 — **the one resolver**; canonical, forms, basis, refusals |
| `scripts/ingest/graph/setup-identity-table.ts` | §1 — `legislation_identity`, additive; refuses a degraded rebuild |
| `scripts/ingest/graph/audit-4b-identity.ts` · `.json` | §1 + §6 re-answered — no writes |
| `scripts/ingest/graph/check-4b-identity.ts` | §1 — **30/30**, the broken join pinned |
| `scripts/ingest/graph/audit-4b-schedules.ts` · `.json` | §2.2 — the gate, two-sided; exit 3 if empty |
| `scripts/ingest/graph/extract-enabling-edges.ts` | §2 — Layer 2, `detection = 'enabling'` |
| `scripts/ingest/graph/extract-madeunder-edges.ts` | §2.1 — **the shared parser**; two defects fixed; `main()` guarded |
| `scripts/ingest/graph/audit-4b-layer2.ts` · `.json` | §2.3 — volume, storage, the parser defect, the scale control |
| `scripts/ingest/graph/audit-4b-tax.ts` · `.json` | §3 — the three answers, report only |
| `scripts/ingest/graph/check-4b-layer2.ts` | §2 + §4 — **18/18**, hand-check live against legislation.gov.uk |
| `scripts/ingest/graph/coverage.ts` | §4 — bridge residual + schedule coverage, live |
| `scripts/ingest/graph/record-4b-facts.ts` | §4 — four facts, from the audits' JSON |
| `scripts/ingest/graph/print-coverage.ts` | §5 — regenerates the dated reading |
| `scripts/ingest/graph/check-4a-coverage.ts` | §4 — **30/30**; one assertion updated after being watched failing |
| `scripts/ingest/graph/check-25h-verify.ts` | fixed: retries, and an unreachable case is not a failing one |
| `scripts/ingest/graph/setup-citation-edge-table.ts` | §2.1 — `detection` widened to admit `enabling` |
| `scripts/ingest/v37-citation-gaps.ts` | §1 — third alias copy removed (see Q1) |
| `docs/CROSS_REFERENCE_GRAPH.md` | §5 — the capability document |

**Checks:** `check-4b-identity` 30/30 · `check-4b-layer2` 18/18 · `check-4a-coverage` 30/30 ·
`check-25h-parser` 37/37 · `check-25h-inbound` 12/12 · `check-25h-verify` 8/8.
`tsc --noEmit` clean on every `graph/` and `v37` file. `check-clean-build.sh --fast` PASS.
