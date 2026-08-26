# CITATION AUDIT — Sprint 25-H

*Task 1 of `docs/CC_BRIEF_25-H_citation_graph.md`. Predictions logged in `CHANGE_LOG.md`
(2026-08-26 00:15 UTC and 00:35 UTC) **before** any count was run; scored below.*
*Code: `scripts/ingest/graph/audit-25h-citations.ts`. Raw numbers: `docs/citation_audit_25h.json`.*

---

## In plain English, before the numbers

We can now list what points at an Act. But the audit found something that matters more than the
list, and it changes what the Starkey programme should expect:

**Legislation.gov.uk's XML marks up only a small fraction of the cross-references that are actually
in the text.** Where an Act says *"has the same meaning as in the Human Rights Act 1998"*, the words
are usually just words — there is no `<Citation>` element, no URI, nothing a machine can follow.
Measured across a 6,045-document sample: **5.4%** of body mentions of the Human Rights Act carry
markup, **1.8%** of the Equality Act, and **0%** of the Constitutional Reform and Governance Act
itself.

So a citation graph built the obvious way — from the `<Citation URI>` attributes — is roughly **2%
complete**. It does not fail loudly. It returns a short, confident, wrong answer. For a repeal
programme whose central deliverable is *"every provision that refers to this Act"*, that is the
worst possible failure mode: an under-count that looks like an answer.

This sprint therefore built **two** detectors and keeps them apart in the data:

| `detection` | what it is | how much to trust it |
|---|---|---|
| `markup` | a `<Citation URI="…">` attribute | the **document itself** asserts the identity |
| `text` | the Act's name in running prose, resolved against `corpus_acts` titles | **we** inferred the identity |

They are never summed without being named. A measured fact and an inferred one must not look
identical on the page.

---

## Q1 — Do stored legislation documents retain `Citation` / `CitationSubRef`?

**Yes for `Citation`, in the R2 per-section store — and this REFUTES what we recorded in July.**

`docs/GRAPH_TIER1_REPORT.md` §1.1 (5 Jul 2026) states the per-section `raw.xml` objects carry
"**no `<Citation>` markup at all**", on the evidence of 30 random fragments. That conclusion is
wrong, and the reason it looked right is instructive: a *random* sample of provisions is dominated
by tiny repealed stubs. The 40 objects drawn at random for this audit averaged **2.1 KB** and many
were `. . . . . .` dot-leader husks. Nothing cites anything in 2 KB of nothing.

Sampling the provisions where a citation could actually live changes the answer:

| sample (40 objects each, spread over 4 legislation corpora) | bytes read | `<Citation>` | `<CitationSubRef>` | `<CommentaryRef>` | objects with a citation |
|---|---:|---:|---:|---:|---:|
| random (`ORDER BY md5(id)`) | 85,848 | **0** | 0 | 39 | 0 / 40 |
| the largest sections | 8,613,182 | **122** | 0 | 470 | 8 / 40 |
| explicitly amending/repealing sections | 1,269,563 | **22** | 0 | 67 | 4 / 40 |

⚠ `<CommentaryRef>` is **not** a citation — it is a pointer into an annotation block. It appears in
18–43% of sampled objects and counting it as a citation would have produced a false positive in
every one of them. It is counted separately for exactly that reason.

**Sample raw fragment, from the stored corpus** (`si-2010plus:uksi/2016/765:schedule-1-paragraph-1`,
R2 object read live):

```xml
…<Term><Addition ChangeId="key-REDACTED-CLML-COMMENTARY-HANDLE-1759498455967"
CommentaryRef="key-REDACTED-CLML-COMMENTARY-HANDLE">Balloon Regulation</Addition></Term>
<Addition …>” means Commission </Addition>
<Citation URI="http://www.legislation.gov.uk/european/regulation/2018/0395" id="c00001"
  Year="2018" Number="395" Class="EuropeanUnionRegulation">
  <Addition …>Regulation (EU) 2018/395</Addition>
</Citation>…
```

and a second, from primary legislation (`primary-acts-2000plus:ukpga/2022/32:section-38`):

```xml
…<Text>a person authorised under an intervention order under section 53 of the Adults with
Incapacity (Scotland) Act <Citation URI="http://www.legislation.gov.uk/id/asp/2000/4" id="c00006"
  Class="ScottishAct" Year="2000" Number="0004">2000 (asp 4)</Citation> who may make decisions…</Text>
```

That second fragment is the whole design problem in one line. **The markup names the Act. "section
53 of" is plain text.** The provision — the thing a repeal programme actually needs — is not in the
attributes at all.

**`<CitationSubRef>`: zero in the stored per-section corpus**, across all 120 objects sampled.
In the whole-document bulk CLML there are 2.37M of them in Acts, and **essentially all sit inside
`<Commentaries>`** — they are amendment provenance ("S. 3 substituted by 2010 c. 15"), not body
cross-references. Of 286,659 body citation elements across every Act and SI in the file, **3**
carried a `SectionRef` on a `CitationSubRef`.

⚠ **A correction to my own first measurement.** `SectionRef` also appears as an attribute on
`<Citation>` itself, and my first pass counted it only on `<CitationSubRef>` elements. Recent Acts
do carry it — `<Citation … Year="2013" Number="25" SectionRef="section-37">section 37 of the Public
Service Pensions Act 2013</Citation>` is real, from `ukpga/2026/23`. Across the full extraction,
**10,853 rows** got their target provision from a `SectionRef` attribute. That is 2.8% of rows, not
zero — small, but it is the difference between "the markup never says" and "the markup rarely says".

**`xmlPreview` (Neon column):** NULL on all 120 sampled rows. It is not a store for these corpora,
so it is not a route to citations either.

---

## Q2 / Q3 / Q4 — Primary legislation

Source: `best-collection-xml.zip`, re-downloaded 2026-08-26 (1,437,177,815 bytes, `Last-Modified:
2026-08-24`, HTTP 200 from `research.legislation.gov.uk`, OGL v3). It was **not** on disk at sprint
open despite `GRAPH_TIER1_REPORT.md` §1.1 recording it as "still on disk"; re-fetching cost **28
seconds** and nothing.

All 4,426 `ukpga` documents in the file, none sampled:

| | predicted | measured | verdict |
|---|---:|---:|---|
| Citation + CitationSubRef elements carrying a URI | 2,000,000 | **2,359,047** | ✅ within 18% |
| …of which `<CitationSubRef>` | — | 1,618,968 | |
| **body** citation elements (outside Commentaries/Footnote/SecondaryPreamble) | 120,000 | **25,060** | ❌ 4.8× high |
| distinct URI values, all zones | — | **485,369** | |
| distinct URI values, body only | 30,000 | **5,723** | ❌ 5.2× high |
| distinct target instruments (gids), body only | — | **3,574** | |
| resolving to an instrument we hold text for | 85% | **70.1%** | ❌ 15pp high |

**Accounting, nothing dropped silently:** 2,359,047 elements = 25,060 body + 2,333,987 excluded.
Of the 25,060 body elements: 23,190 usable + 12 self-citations + 1,858 URIs that name no
legislation.gov.uk instrument (`european/…` class).

**Q4's denominator, stated explicitly because a ratio without one is not a finding:** 3,574 is the
count of *distinct target instruments* named by body citations in Acts — not citation instances
(25,060) and not URIs (5,723), because one instrument is named by many URIs carrying different
provision paths. Numerator 2,507 = **1,949 held directly + 558 resolved only through the
regnal/calendar alias**. Those 558 are the trap `v37-citation-gaps.ts` documents: without the alias
map they read as gaps, and the miss rate would have been reported as 84% instead of 30%.

**The 1,067 that miss, by doctype:** ukpga 645 · ukla 231 · uksi 82 · apni 33 · eudr 16 · apgb 15 ·
uksro 14 · aep 6 · eur 6 · aosp 5 · ukcm 4 · other 10. `ukla` (Local Acts) and `apni` (Acts of the
Parliament of Northern Ireland) are already on the register in `CORPUS_CITATION_GAPS.md` as
`needs-a-decision`; this audit independently reaches the same instruments from a different direction.

**98.9% of citation markup in Acts is amendment commentary, not cross-reference.** That is the
single most useful structural number here. It is also why the July design excluded those zones and
why this sprint keeps that exclusion: those edges already exist, from TNA's own effects data, as
`amends`/`repeals` rows in `legislation_edges`. Including them would double-count them and swamp the
real body references 93-to-1.

---

## Q5 — Statutory instruments

All 61,996 `uksi` documents in the file:

| | predicted | measured | verdict |
|---|---:|---:|---|
| Citation elements carrying a URI | 900,000 | **1,923,524** | ❌ 2.1× low |
| body citation elements | 130,000 | **261,599** | ❌ 2.0× low |
| distinct URI values, body only | 20,000 | **29,856** | ✅ within 50% |
| distinct target instruments, body only | — | **28,627** | |
| resolving to an instrument we hold | 88% | **83.2%** | ✅ within 5pp |

**Accounting:** 1,923,524 = 261,599 body + 1,661,925 excluded. Body: 212,129 usable + 285 self +
49,185 non-legislation URIs.

⚠ **SIs, not Acts, are where the cross-references are.** 261,599 body citations against the Acts'
25,060 — ten times as many, from documents that are individually far smaller. 25,126 of 61,996 SIs
(41%) carry at least one, against 638 of 4,426 Acts (14%). If you repeal an Act, the instruments
that break are mostly secondary legislation, and any programme that reads only the primary statute
book will miss the bulk of the damage.

---

## Q6 — Were citations stripped during ingest, and what would recovery cost?

**No, and there is nothing to re-ingest.** Three separate findings, and only the third costs anything:

1. **The per-section R2 store retains `<Citation>`** (Q1). Nothing stripped it. The July report's
   contrary claim was a sampling artefact, not a pipeline fact.
2. **`<CitationSubRef>` was never at the source** for per-provision fetches. TNA's per-provision
   `data.xml` does not emit the commentary blocks those elements live in. There is no version of our
   ingest that would have preserved them, so "re-ingesting with them preserved" is not a thing that
   can be done — it is a different source, not a different ingest.
3. **The whole-document bulk CLML is the right source and costs nothing to refresh** — 1.34 GiB,
   28 seconds, HTTP Basic against `research.legislation.gov.uk`, OGL v3.0. **No corpus re-ingest is
   proposed or required, and none was performed.**

---

## What the audit found that nobody asked for

Three things, all on `docs/OPEN_ITEMS.md`.

### 1. The shipped `cites` extractor never opened 37% of the Acts

`scripts/ingest/graph/extract-cites-edges.ts` selects zip entries with
`/\/([a-z]+)-(\d{4})-(\d+)-\w+-data\.xml$/`. That `\d{4}` requires a **calendar** year, so every
**regnal**-year filename — `ukpga-Geo3-41-52-revised-data.xml` — fails to match and the document is
never read.

**2,431 of 132,990 documents were skipped: 1,650 ukpga (37% of every Act in the file), all 660
`aep`, all 58 `apgb`, plus `ukcm`, `ukla`, `apni`, `aip`.** All of them pre-1963.

Verified by consequence, not by reading the regex: of the 121,279 `cites` edges in
`legislation_edges`, **exactly 0** have a regnal-year document as their source, while **29,800**
edges of other types do. The other extractors were fixed for regnal ids in July (the URI *parser*
was widened — `GRAPH_TIER1_REPORT.md` §3.1); the entry *filter* is a separate code path and was
never carried across.

This sprint's extractor uses a widened `ENTRY_RX` and reads all 132,990.

### 2. Markup coverage is 2–5%, and that is the finding of the sprint

Set out at the top. It is not a defect in our code — it is a property of legislation.gov.uk's data.
The consequence is that **any inbound-citation number sourced from `<Citation URI>` alone is a
floor, not a count**, and must be reported as one.

### 3. ⚠⚠ RETRACTED — I raised a storage alarm against a fiction this project had already retired

**What this section originally said:** *"Neon is past its alert line before this table existed —
`pg_database_size` reads 18 GB against the 17.5 GB alert line recorded in `setup-edges-table.ts`."*

**That is wrong, and it was wrong before I wrote it.** There is no Neon storage ceiling:
`neon.max_cluster_size` is **16 TiB**. Storage is a **bill, not a wall** — $0.35/GB-month against a
$15/month budget. At 19 GB that is **~$6.65/month, about 44% of budget, quiet.** `citation_edge`'s
1,144 MB costs roughly **$0.40 a month**.

**Where I got it:** the header comment of `scripts/ingest/graph/setup-edges-table.ts`, written
5 July, which I read while studying the existing edge table and took as authority without asking
whether it was still true.

**Why that was careless rather than unlucky.** The project had already investigated this exact
figure and killed it:

- **GRAPH 3B §4.1** — *"⚠ IT IS OURS, AND ITS PROVENANCE IS CIRCULAR."* The constant lived in
  `search/serve-observer.ts` calling itself a "Neon plan ceiling"; its comment cited the handoff,
  and the handoff's percentage was emitted *by that same observer*. Neither end of the citation was
  a source.
- **GRAPH 3C §5** — *"THE 17.5 GB CEILING IS RETIRED AND REPLACED BY A BILL."*
- **`serve-observer.ts` today**, in the live code, prints: *"There is NO storage ceiling to hit:
  `neon.max_cluster_size` is 16 TiB. This is a bill, not a wall."*

So I did not merely repeat a stale number — **I contradicted our own running monitoring code, and
re-raised an alarm the project had spent a sprint dismantling.** The stale comment in
`setup-edges-table.ts` has now been corrected in place, with the reason, because leaving it is
exactly how it came back.

⚠ The family this belongs to is `docs/CLAUDE.md` §19: *a fact that was measured and a fact that was
inherited must not look identical on the page.* **18 GB was measured. The line it was measured
against was inherited, and I presented both in the same sentence at the same confidence.**

---

## Task 2 — the `citation_edge` table

`scripts/ingest/graph/setup-citation-edge-table.ts` · `extract-citation-edges.ts`

Every column the brief specifies, plus two the audit made necessary:

| column | note |
|---|---|
| `source_doc_uri`, `source_provision_ref` | the provision containing the reference; the nearest enclosing CLML provision id, so it joins straight to `corpus_sections` |
| `target_uri` | **the raw URI, unmodified** — a normalisation bug is recoverable by re-deriving from this instead of re-extracting from 1.4 GB |
| `target_act_id`, `target_provision_ref` | normalised; `target_act_id` is the identity the corpus **holds** when a regnal/calendar alias resolves it |
| `citation_text`, `raw_fragment` | **`NOT NULL`.** An edge with no quotable source is a claim, not a fact |
| `resolved` | the target names an instrument we hold compiled text for |
| `source_type` | `primary` / `SI` / `other` |
| **`detection`** *(added)* | `markup` or `text` — see the top of this document |
| **`extracted_from`** *(added)* | `best-collection-xml.zip@2026-08-26`, so a stale row is identifiable without guesswork |

Indexes on `target_act_id` and `target_uri`, plus `(target_act_id, target_provision_ref)` and
`source_gid`. The dominant query is inbound. Rows are per citation **instance**, not per
(source, target) pair.

### The extraction, and its accounting

Both detectors, all 132,990 documents, one pass. Every input accounted for:

```
MARKUP  elements(5,688,308) = rows(385,346) + excludedZone(5,302,525) + selfCite(437)
        badUri (kept, target_act_id NULL): 92,586
        target provision on  25,030 / 385,346 rows (6.5%) — 10,853 from SectionRef markup

TEXT    spans(1,429,037)    = rows(649,202) + excludedZone(650,777) + alreadyMarkedUp(8,716)
                              + unresolvedName(93,772) + selfReference(26,570)
        resolving to a held instrument: 590,241 / 649,202
        target provision on 281,098 / 649,202 rows (43.3%)
```

**1,034,548 rows · 1,144 MB · the database moves 18 GB → 19 GB — about $0.40 a month.** (Storage is
a bill, not a wall: `neon.max_cluster_size` is 16 TiB and 19 GB is ~44% of the $15/month budget. See
the retraction above.) Three numbers worth stopping on:

- **8,716 spans were already inside `<Citation>` markup** and were left to the markup detector.
  Counting them twice would have double-counted every reference that *is* properly marked up —
  precisely the ones most likely to be spot-checked.
- **The text detector recovers a target provision on 43% of its rows against the markup detector's
  6.5%.** The weaker evidence carries the more useful field, because the provision was always in the
  words and never in the attributes.
- **93,772 spans named something unresolvable** — counted, not discarded quietly. This is the single
  biggest lever on completeness from here.

**Ambiguous titles are dropped, not guessed** (159 names). A name resolved by coin toss is a wrong
edge *with evidence attached*, which is worse than no edge.

⚠ **11.3% of text rows sit in a document's TITLE or metadata, not in a provision.** An SI called
*"The Down Syndrome Act 2022 (Commencement) Regulations 2024"* names that Act in its title, its long
title and its explanatory note. Those are references, but they are not *provisions that break*.
`source_provision_ref IS NULL` identifies them; for a repeal work-list, filter them out. CRAG's 182
becomes **149**; the Equality Act's 1,868 becomes 1,552.

---

## Tasks 4 and 5 — the pilot and the controls

⚠ **The controls ran first and their verdict is printed before the pilot numbers**, per brief §6. A
pilot figure presented first and reassured about afterwards is a different document.

### Negative control — Down Syndrome Act 2022 (`ukpga/2022/18`)

Chosen because it is recent (four years), genuinely single-purpose (seven sections requiring the
Secretary of State to issue guidance), creates no concept, office or definition another Act would
borrow, and amends nothing — so no consequential chain points back at it.

| | predicted | measured |
|---|---:|---:|
| inbound references | 0–3 | **13** (8 inside a provision), from **2** instruments |

**Above prediction, and correct.** All 13 were read by hand: every one is a genuine reference, and
both citing instruments are *about* that Act — its own commencement Regulations (`uksi/2024/373`)
and a consequential amendment (`uksi/2025/1312`). The prediction was wrong because I forgot that
every Act has a commencement SI naming it. **This is what a narrow Act's tail should look like:
small, and made entirely of instruments whose subject is that Act.** Nothing here suggests the query
is matching on anything but identity.

### Scale control

| | predicted | measured | inside a provision | instruments |
|---|---:|---:|---:|---:|
| Equality Act 2010 | 700 | **1,868** | 1,552 | 530 |
| Human Rights Act 1998 | 450 | **938** | 892 | 368 |
| CRAG 2010 *(for comparison)* | 120 | **182** | 149 | 75 |
| Down Syndrome Act 2022 | 0–3 | **13** | 8 | 2 |

**ORDERING HOLDS: EqA > HRA > CRAG > Down Syndrome Act.** That is prediction 7, the load-bearing one.
Both scale predictions were low by ~2×, in the same direction as CRAG's and for the same reason —
below.

### The pilot — CRAG 2010 Part 1

`expandPart` read Part 1 from the Act's own CLML as **sections 1–19**. Confirmed independently
against legislation.gov.uk: Part 1 runs 1–19, and Part 2 begins at section 20.

| | predicted | measured |
|---|---:|---:|
| inbound naming a Part 1 provision | 15 | **29** |
| inbound naming CRAG with no provision | 120 | **88** |
| inbound naming CRAG with *some* provision | — | **94** |
| CRAG total | — | **182**, from 75 instruments |

Of the 29 Part-1 rows, **2 were asserted by URI markup and 27 were resolved from the Act's name in
running text.** On markup alone, the answer to this sprint's central question would have been **two
references**. That is the 2% problem in one line.

The 29 are recognisably one story: the statutory definition of "civil servant". *"…within the
meaning of Chapter 1 of Part 1 of the Constitutional Reform and Governance Act 2010"* appears in the
Scotland Act 1998, the Government of Wales Act 2006, the Northern Ireland Act 1998, the Freedom of
Information Act 2000, the Utilities Act 2000 and a dozen more; five Scottish SIs carry *"'civil
servant' has the meaning given by section 1(4)"*; the Welsh and Senedd Acts borrow the Part 1
definition of "special adviser". **Repeal Part 1 and every one of those definitions loses its
referent.**

### Hand verification — 20 rows against legislation.gov.uk

**20 of 20 correct.** Each row was fetched live from `legislation.gov.uk/{gid}/{provision}/data.xml`
and required to name CRAG *and* — where a `target_provision_ref` was parsed — to name that provision
**in the same phrase** as the Act.

⚠⚠ **The first run reported 18/20, and both "failures" were the verifier's fault, not the data's.**
It anchored on the *first* occurrence of the Act's name and looked only there. `ukpga/2006/32` s.52
names CRAG **six** times; the first is *"See Part 1 of the…"* and the one that mattered — *"…by
section 3 of the…"* — is the second. Reporting those as parse errors would have put a false finding
in this sprint's headline result.

⚠ **The corrected check was then made to fail on purpose**, because 20/20 immediately after changing
the checker is not evidence. `check-25h-verify.ts` feeds the pilot's own function four true claims
and four false ones about the same live documents: **4 accepted, 4 rejected.** It *imports*
`provisionNamedWithAct` rather than re-implementing it — an earlier version of that control was a
copy, a shell heredoc ate its regex escapes, and for several minutes it "disproved" a result that
was right.

**What the wrong ones have in common: nothing, because there were none.** The honest caveat is that
20 of 29 is a high sampling fraction of a small and homogeneous population — most rows are the same
"within the meaning of Chapter 1 of Part 1" formula. A 20-row sample of the Equality Act's 1,868
would be a much harder test, and has not been run.

---

## Task 3 — the query surface

Documented in `SEARCH_STRATEGY.md` §9 "Tier 1a". `inbound()` returns exactly the four fields the
brief names; `inboundEvidence()` returns the proof alongside; `inboundSummary()` groups by
`source_type`, by source Act, and by `detection`.

`check-25h-inbound.ts` tests the surface rather than the data — **11/11**, every assertion with a
paired opposite:

- a non-existent Act returns 0 rows, **and** CRAG returns 182 (so the zero is not a broken query)
- Part 1 expands to sections 1–19; Part 2 excludes section 19 **and** includes section 20
- the Part-scoped result is a strict subset (29 < 182), and every row names a Part 1 provision
- `byDetection` sums to the total

⚠ One rule is **declared untested**: no CRAG or HRA row exercises the subsection-prefix match
(`section-3` matching `section-3-2`), so the run says so rather than counting it as passed.

---

## Predictions, scored

| # | prediction | actual | |
|---|---|---|---|
| 1 | R2 per-section store retains **no** citations | **122 `<Citation>` in 40 large sections** | ✗ wrong, and it refuted the July report too |
| 2 | `xmlPreview` carries no citations | NULL throughout | ✓ (for a reason I did not predict) |
| 3 | citations not stripped by our pipeline; recovery cost zero | confirmed; 28-second re-download | ✓ |
| 4 | ukpga citation elements 2,000,000 | 2,359,047 | ✓ |
| 5 | ukpga **body** citations 120,000 | 25,060 | ✗ 4.8× |
| 6 | ukpga distinct body URIs 30,000 | 5,723 | ✗ 5.2× |
| 7 | ukpga targets resolving 85% | 70.1% | ✗ 15pp |
| 8 | uksi 900,000 / 130,000 / 20,000 / 88% | 1,923,524 / 261,599 / 29,856 / 83.2% | ✗ 2×, ✗ 2×, ✓, ✓ |
| — | *predicted blocker: existing `cites` edges are act-level and cannot answer the pilot* | confirmed — 118,865 of 121,279 are `section-act` | ✓ |
| 1p | CRAG Part 1 inbound 15 | 29 | ✗ ~2× |
| 2p | CRAG act-level inbound 120 | 88 | ✓ |
| 3p | 17 of 20 verified correct, errors in the provision parse | **20 of 20** | ✗ — and the two apparent errors were mine, in the checker |
| 4p | negative control 0–3 | 13, all genuine | ✗ |
| 5p | Equality Act 700 | 1,868 | ✗ 2.7× |
| 6p | Human Rights Act 450 | 938 | ✗ 2.1× |
| **7p** | **ordering EqA > HRA > CRAG > negative** | **holds** | **✓** |

**The pattern in the misses is worth more than the hits.** Every body-citation prediction was too
high and every pilot prediction was too low, and both have one cause: I estimated how much
cross-referencing is in the *statute book* and then attributed all of it to the *markup*. The
statute-book estimates were roughly right — my 450 for the Human Rights Act sits between the
markup's 37 and the measured 938. The markup estimate was wrong by a factor of twenty.

⚠ **One honesty note on 5p and 6p.** Predictions 4p–7p were logged at 00:35 UTC against a
markup-only table. The text detector was built afterwards, in response to the coverage finding, so
the numbers they are scored against come from a system that did not exist when they were written.
They are a fair test of *the statute book*, and **not** a blind test of the text detector.
