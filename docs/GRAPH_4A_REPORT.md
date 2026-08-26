# GRAPH 4A — REPORT

**Executes** `docs/BRIEF_GRAPH_4A.md` §1–§8. **Written** 26 August 2026.
**Predictions** logged in `CHANGE_LOG.md` at 2026-08-26 12:41 UTC, before any of T1–T3 ran, and
scored below.

⚠ **The handover the brief executes, `HANDOVER_search_graph_citation.md`, is not in this repository.**
Three things the brief takes from it are therefore assumptions of mine, each flagged where it is used
and raised as a decision at the end: the twelve research targets (§3), the five treaty relationship
types (§5.4), and the Layer numbering.

---

## THE SHORT VERSION

1. **The blast radius is small and it is entirely internal.** Six code paths read the graph; four
   touch rows the defective filter built; **nothing under `scrutinise-web/` reads either graph table
   at all**, so no user has ever seen an answer from it.
2. **The hole is 924 edges — 0.76%.** Under the 3% threshold, non-zero, and the brief's warning was
   right: an old Act *does* cite a modern one, 29 times.
3. ⚠⚠ **The T3 number answers the brief's question and then refuses its premise.** 29.9% of
   unresolved spans sit in a target-citing document, so on the rule fixed beforehand short-form
   resolution is *wanted, not urgent*. But classifying the commonest unresolved names by cause shows
   **short-form resolution would fix 9.3% of them.** The other 90.7% is title and corpus coverage.
   **The decision the brief set up is the wrong decision.**
4. ⚠⚠ **§5.1's premise is refuted where it matters: we hold the scheduled treaty text for 39 of 288
   double taxation Orders (13.5%).** The other 249 are present as their three operative articles with
   the agreement itself absent — an absence that presents as a short document.
5. **§6 is answered.** `citation_edge` **supersedes the `cites` rows** of `legislation_edges`
   (98.1% of its pairs, plus 226,516 it never had, plus evidence). `legislation_edges` is **not**
   superseded — it is the sole holder of 2.23M rows of five other edge types. **Retire nothing yet:**
   the two tables do not agree on what a pre-1963 Act is called.
6. **§7 is built.** Every `inbound()` call now returns `{ rows, coverage }`. `check-4a-coverage.ts`
   **29/29**, every negative control watched firing.
7. ⚠ **T4's own check tripped the guard T4 exists to verify** — GitHub push protection rejected a
   literal CLML handle in the test fixture. The data was changed, not the guard.

---

## §1 — T1: THE BLAST-RADIUS AUDIT

`scripts/ingest/graph/audit-4a-blast-radius.ts` → `audit-4a-blast-radius.json`.

### The defect, measured rather than read

`extract-cites-edges.ts:120` filtered zip entries on `/\/([a-z]+)-(\d{4})-(\d+)-\w+-data\.xml$/` — a
**calendar** year. UK Acts were cited by regnal session until 1963.

| | entries |
|---|---|
| `*-data.xml` entries in the bulk file | 132,994 |
| matched by the widened `ENTRY_RX` | 132,990 |
| matched by the **shipped** filter | 130,559 |
| **never opened** | **2,431** |

| doctype | in file | shipped filter read | **skipped** |
|---|---|---|---|
| `ukpga` | 4,426 | 2,776 | **1,650 (37%)** |
| `aep` | 660 | 0 | **660 (all)** |
| `apgb` | 58 | 0 | **58 (all)** |
| `ukcm` | 160 | 122 | 38 |
| `ukla` | 199 | 188 | 11 |
| `aip` | 11 | 0 | 11 |
| `apni` | 286 | 283 | 3 |
| every SI type | 85,971 | 85,971 | **0** |

**Proved by consequence, not by reading the regex.** Of 121,279 `cites` edges, **0** have a
regnal-year source; of 107,034 `repeals` edges built from TNA's in-force CSVs — a code path with no
filename filter — **29,800** do.

**Control:** `citation_edge`, built by 25-H with the widened regex over the same file, holds 8,144
text rows and 1,092 markup rows from 1,393 regnal-year documents. The file was always readable.

### ⚠ "What else did we get wrong the same way"

The brief's real question. Three answers, all measured:

1. **The same filter exists in a second file.** `extract-madeunder-edges.ts:125` carries the
   byte-identical regex. **It costs nothing** — it is restricted to SI types and **0** SI-type
   entries in the file have a regnal filename. A latent copy of a live defect, not a second defect.
   *It is fixed anyway, by sharing one exported constant.*
2. **The widening is strict.** `ENTRY_RX` tightens the suffix group from `\w+` to `[a-z-]+`, which is
   where a "widening" could quietly drop entries. **0** entries matched by the old regex fail the new
   one. Checked because it is not obvious, not because it was doubted.
3. ⚠ **A third divergence, found while looking: the two tables do not agree on identity.**
   `legislation_edges` records a pre-1963 target under the URI's calendar form (`ukpga/1925/86`);
   `citation_edge` normalises to the regnal form legislation.gov.uk treats as canonical
   (`ukpga/Geo5/15-16/86`). **A join or union on gid silently loses every pre-1963 Act**, and the
   result reads as a coverage finding rather than a bug. See §6.

### The consumers, one line each

| consumer | what it does | affected? |
|---|---|---|
| `graph/traverse-edges.ts` | `impactSet()` — the rescission-impact traversal | **YES** — its `citedBy` group is built from `cites` |
| `graph/edges-query-service.ts` | HTTP service over `impactSet()` on :8091 | **YES** — same rows |
| `graph/score-gold-d.ts` | scores the gold-D question set through `impactSet()` | **YES** — same rows |
| `v37-citation-gaps.ts` | the corpus citation-gap census → `CORPUS_CITATION_GAPS.md` | **YES** — counts `cites` + `made-under` as "ours" |
| `v37-repeal-census.ts` | `section_repeals` — the repealing instrument per dead provision | no — reads only `repeals`, from TNA data |
| `c2/l2-recensus-eu.ts` | retained-EU re-census of `section_repeals` | no — same |
| **anything under `scrutinise-web/`** | — | **NONE EXISTS.** 0 files reference either table |

⚠ **The last row is the finding.** The 1,650-Act hole has never reached a user, because the graph has
no user-facing surface. Everything above is internal analysis and two published documents.

**The published artefact the hole moves:** `CORPUS_CITATION_GAPS.md` rests on 151,612 distinct
instruments the graph refers to, of which **12,748 are known only through `cites`/`made-under`**.
T2's 924 edges reach 623 distinct target instruments, so the census can gain entries and shift
counts — by well under 2% either way.

### Prediction 1–5, scored

| # | predicted | measured | |
|---|---|---|---|
| 1 | 6 consumers, **3** affected | 6 consumers, **4** affected | ✗ point wrong — `v37-citation-gaps` reads `*`, which includes both defective types |
| 2 | 0 user-facing | 0 user-facing | ✓ |
| 3 | 0 SI-type entries skipped | 0 | ✓ |
| 4 | widening is strict, 0 lost | 0 | ✓ |
| 5 | census moves under 2% | 924 edges over 623 instruments against a 151,612 denominator | ✓ |

---

## §2 — T2: THE SIZE OF THE HOLE

`scripts/ingest/graph/audit-4a-t2-hole.ts` → `audit-4a-t2-hole.json`. **Nothing was written to the
database.** The script imports `extractDoc` and re-runs the real extractor over the 2,431 skipped
documents; it never calls `insertEdges`. *A control that is a copy tests the copy.*

| | |
|---|---|
| documents re-read | **2,431** (0 errors) |
| `cites` edges recovered | **924** |
| as a share of the shipped 121,279 | **0.76%** |
| distinct target instruments reached | 623 |
| **threshold** | **UNDER 3% → proceed, and record the residual as a declared limitation** |

**Delta on the four control Acts: zero on all four.** Equality Act 61→61, Human Rights Act 28→28,
CRAG 8→8, Down Syndrome Act 0→0. The hole is real and it is nowhere near the Acts this project has
been using as controls.

**Where it lands instead** — the Interpretation Act 1889 (`ukpga/1889/63`, +12), the Public Health
Act 1936 (+9), the Local Government Act 1933 (+7), the Education Act 1944 (+7). Old, general,
foundational Acts.

### ⚠ The brief's trap, tested: an old Act *does* cite a modern one

**29 of the 924 edges run from a pre-1963 source to a post-2000 target.** legislation.gov.uk serves
*revised* text, so a Victorian Act amended in 2012 carries the 2012 reference inserted by that
amendment — `ukpga/Vict/38/39/17 → uksi/2011/1881`, `ukpga/Geo5/23/24/12 → ukpga/2018/12` (the Data
Protection Act 2018, cited from a 1932 Act). **The intuition that would have made this harmless is
wrong.**

### ⚠ 718 documents produced nothing, and that was checked rather than assumed

All 660 `aep`, all 58 `apgb` and all 11 `aip` yielded **zero** edges. A whole doctype at zero is the
shape of a silent failure, so it was measured: those documents carry 630, 486 and 104 `<Citation>`
elements respectively, and **every one of them sits inside `<Commentaries>`** — amendment-provenance
annotations, which this extractor excludes by design and which are already held as `amends`/`repeals`
edges. Body citations carrying a URI: **0**. By contrast `ukla` carries 2,759 and `ukcm` 387, so the
counter is capable of being non-zero. **The zero is real.**

### Prediction 6–8, scored

| # | predicted | measured | |
|---|---|---|---|
| 6 | 1,000–2,000 edges, ~1.2%, band 0.5–3.0% | **924, 0.76%** | ~ point estimate too high; **inside the band**; the brief's "under 3% and non-zero" holds |
| 7 | EqA ≤10 · HRA ≤5 · CRAG ≤3 · DSA 0 | 0 · 0 · 0 · 0 | ✓ but trivially — all four are zero |
| 8 | **≥50** pre-1963 → post-2000 edges | **29** | ✗ **refuted on magnitude, confirmed on direction.** I said a zero here would mean the dismissal was right; it is not zero |

⚠ **The code is fixed; `legislation_edges` is not re-extracted.** That is a decision, not an
oversight — see Q2.

---

## §3 — T3 AND T4

### T3 — the unresolved spans (OI-18)

`scripts/ingest/graph/audit-4a-t3-spans.ts` → `audit-4a-t3-spans.json`. The 93,772 figure is a
**statistic, not a table** — the spans were counted and thrown away — so the detector was re-run over
all 132,990 documents with an `onUnresolved` callback added to the shipped `extractDocText`. Nothing
was re-implemented.

| | |
|---|---|
| documents read | 132,990 (0 errors) |
| unresolved act-name spans | **97,095** |
| documents carrying at least one | 20,307 |
| **spans in a document that also cites one of the twelve targets** | **29,009 → 29.9%** |
| such documents | 2,704 of 20,307 |
| **decision rule, fixed beforehand: urgent above 40%** | **WANTED, NOT URGENT** |

⚠ **The twelve targets are mine** (listed in the `CHANGE_LOG` prediction entry) because the handover
that defines them is not in the tree. **A single target could have carried the result** — a short
form is a short form *of* something, so including ICTA 1988 pulls its own abbreviations into the
numerator. Leave-one-out, every target removed in turn: the headline ranges **23.0%–28.0%**, most
load-bearing is ICTA 1988, and **the decision survives every leave-one-out.**

⚠ **My pass counted 97,095 where 25-H's counter said 93,772 — a 3.5% difference I have not
explained.** Both runs load an identical title map (135,093 unambiguous, 159 dropped) and 25-H's run
wrote 1,034,548 rows, exactly the table total, so it was not a partial resume. Flagged, not papered
over. The **proportion** is unaffected: numerator and denominator come from the same pass.

### ⚠⚠ T3 answers the question and then refuses the premise

`scripts/ingest/graph/audit-4a-unresolved-cause.ts` → `audit-4a-unresolved-cause.json`.

The commonest unresolved name in the corpus is **"the Interpretation Act (Northern Ireland) 1954"**
— 3,732 spans. That is a full statutory title, not an abbreviation of anything. **Short-form
resolution would recover none of them.** So the top 60 names (30,472 spans, 31% of the total) were
classified by cause:

| cause | spans | share |
|---|---|---|
| **title-absent** — no instrument of that name in `corpus_acts` under any title | 18,025 | **59.2%** |
| **title-mismatch** — held, but under a title that does not normalise to the span | 9,622 | **31.6%** |
| **short-form** — the span is a strict suffix of a held title | 2,825 | **9.3%** |

▶ **Short-form resolution addresses 9.3%.** The rest is corpus and title coverage.

⚠ **Honest limit on the split:** the `title-mismatch` bucket's "nearest match" evidence is often not
the same Act (Financial Services Act 1986 → *Dockyard Services Act 1986*), so those two buckets are
not cleanly separated from each other. The load-bearing division — **short-form 9.3% vs everything
else 90.7%** — is sound, because the short-form test is exact: the span must be a strict suffix of a
title actually held.

**What the absent titles are.** `apni` — Northern Ireland primary legislation 1921–1972 — is the
single biggest bucket, and `v37-citation-gaps` already flagged it for Charlie in August with 2,602
references. The European Communities Act 1972, the Army Act 1955, the Air Force Act 1955, the Naval
Discipline Act 1957, the Education Act 1944, the Gaming Act 1968 and the Race Relations Act 1976 all
have **no row in `corpus_acts` under any title**. This is the same family as OI-10.

**As instructed, short-form resolution was NOT built.**

### T4 — export hygiene

Asserted by `check-4a-coverage.ts`, watched failing on a planted handle.

- CLML commentary handles are `key-` + 32 hex, byte-identical in shape to an API key.
- `docs/crag_part1_inbound.json` — **0 live handles**, 128 redaction markers.
- `docs/citation_audit_25h.json` — **0 live**, 7 markers. `docs/citation_pilot_25h.json` — **0 live**.
- This sprint's four new JSON artefacts — **0 live handles**.
- ✅ **`citation_edge` still holds 15,413 rows carrying the true bytes.** The redaction is on the
  export, not on the evidence.
- The pattern was watched matching a real handle, so the passes above are not vacuous.
- **No bypass of secret scanning was used or is proposed.**

⚠⚠ **AND THE CHECK TRIPPED THE GUARD IT EXISTS TO VERIFY.** The first version of the "the pattern
fires on a real handle" assertion embedded a literal `key-` + 32 hex fixture in its own source.
**GitHub push protection rejected the push**, naming `check-4a-coverage.ts:150` as a Mailgun API key —
which is exactly the confusion T4 is about, arriving in the file written to check for it.

**The data was changed, not the guard.** The fixture is now **fetched from `citation_edge` at run
time**, so the check tests against a genuine handle and the repository contains none; a further
assertion requires that the fetched handle **does not appear in the check's own source**, so the
fixture cannot quietly become an embedded one again. No allow-list entry was requested and none is
needed — an allow-listed secret is Charlie's decision and gets recorded with its reason.

▶ The incident is also the strongest available evidence that the redaction matters: the guard is
live, it fires on this exact token shape, and a single 32-hex identifier in one line of a test file
was enough to block an entire sprint's push.

---

## §4 — LAYER 2, SCOPED

`scripts/ingest/graph/audit-4a-layer2.ts` → `audit-4a-layer2.json`. **Nothing built.**

### ⚠ The first measurement changes the shape of the work

The brief expects Layer 2 to be a new build "several times Layer 1's volume". **It is not, because
Layer 1 was never Acts-only.** 25-H ran over all 132,990 documents:

| source type | rows | source docs | distinct targets | sited in a schedule |
|---|---|---|---|---|
| **SI** | **793,616** | **64,189** | 38,645 | 137,296 |
| primary | 225,444 | 4,771 | 7,952 | 108,582 |
| other | 15,488 | 1,668 | 397 | 0 |

**77% of `citation_edge` is already instruments-to-legislation.** The textual half of Layer 2 exists.

**⚠ SI schedules are ingested** — the brief's specific worry. `si-2010plus` holds 103,908 schedule
sections and `si-pre-2010` 167,952, and 137,296 SI-sourced references sit inside a schedule. *(§5.1
qualifies this sharply for one class of instrument.)*

### What is genuinely missing: the enabling relationship

⚠ **"This SI was made under section 15 of that Act" is a different and stronger fact than "this SI
mentions that Act".** An SI whose enabling power is repealed may fall with it.

| | |
|---|---|
| `made-under` rows in `legislation_edges` | 230,681 |
| instruments covered | 70,255 |
| distinct enabling Acts | 5,060 |
| naming the enabling **provision**, not just the Act | 130,430 (**56.5%**) |
| SI instruments the corpus holds | 109,202 → **64.3% covered** |

It **is** already a separate `edge_type`, which is the right shape. What it lacks is **evidence**:
`legislation_edges` has no text column at all, so an enabling edge cannot be quoted, only asserted.
And `citation_edge` cannot hold it — the extractor **excludes `<SecondaryPreamble>`**, which is
exactly where the enabling words live.

### Sizing, at $0.35/GB-month — the real figure

Measured from the live table: `citation_edge` is **1,144 MB over 1,034,548 rows = 1,160 bytes/row**
including indexes.

| | rows | storage | cost |
|---|---|---|---|
| re-extract `made-under` into the `citation_edge` shape, evidence on every row | 230,681 | 0.27 GB | **$0.09/month** |
| extend to every SI the corpus holds, at the same rate | ~358,563 | 0.42 GB | **$0.15/month** |

**Build time:** a preamble-only pass reads the same 1.4 GB file and does far less work per document
than 25-H's two detectors, which completed in a single pass.

⚠ **There is no storage question here.** Storage is a bill, not a wall. The retired "17.5 GB alert
line" is not repeated and must not be.

---

## §5 — TAX LAW AND INTERNATIONAL AGREEMENTS

**Nothing built. Four claims, confirmed or refuted.**

### 1. "The treaty text is scheduled to the Order, so it is already in the corpus" — ⚠⚠ REFUTED IN PRACTICE

The mechanism is exactly as the brief describes: 288 instruments titled *"Double Taxation …"* are in
`corpus_acts`, all 288 hold text, and 238 `made-under` edges run from them to TIOPA 2010. But:

| | |
|---|---|
| DTA-titled instruments | 288 |
| holding **no** text | 0 |
| holding text but **no schedule section** | **249 (86.5%)** |
| holding at least one schedule section | **39 (13.5%)** |

By era: 13 of 32 from 2018 onward; **26 of 256 before 2018**.

▶ **For 249 Orders we hold the three operative articles and not the agreement.** The Order looks
present. It is a short document rather than an error — **the silent-incompleteness failure again, one
level down from the 2% markup problem.**

### 2. "The direction reverses" — CONFIRMED, and the graph already answers it

TIOPA 2010 s.6 gives a double taxation agreement effect *despite anything in any enactment*, so the
useful query is *"does a treaty already prevent this"*, not only *"what does my change break"*.

- `citation_edge` is symmetric: `inbound()` filters `target_act_id`; the reverse is a filter on
  `source_gid`, and **both columns are indexed**. No new structure is needed.
- Measured: TIOPA 2010 has **374 inbound rows from 95 documents**, of which **4 name s.2** (the
  Order-in-Council power) and **4 name s.6**. Outbound from a DTA Order: 275 rows across 109 Orders
  reaching 129 distinct targets, plus 841 `made-under` edges from 211 Orders.
- ⚠ **But the answer is only as good as claim 1.** With the agreement text absent from 249 of 288
  Orders, *"does a treaty prevent this"* today reads the Order's three articles and not the treaty.

### 3. MLI positions — ⚠ NOT HELD, AND THE COVERAGE BLOCK MUST SAY SO

The OECD Multilateral Instrument modifies many agreements at once without amending each Order, so an
agreement read off legislation.gov.uk can be out of date **without saying so**.

Twenty `corpus_acts` titles match "multilateral" and **none is the MLI** — they are EU banking
directives, a fisheries convention, the Multilateral Investment Guarantee Agency Act 1988, a 1951
reciprocal social-security Order. Section titles matching are debates, committee reports and Hansard
**mentioning** it. **MLI positions — the per-country reservations and notifications saying which
articles of which agreement are modified — are published by the OECD, not legislation.gov.uk, and
nothing in this database is shaped like one.**

### 4. The five relationship types — assessable only in part

⚠ **The five types are named in the missing handover.** Only `permits_suspension` is named in the
brief, and I will not invent the other four. What can be reported is the substrate:

| corpus | sections | docs | reachable? |
|---|---|---|---|
| `uk-treaties-fcdo` | 23,372 | 21,843 | yes — typed DEBATE, which is why it is reachable at all |
| `uk-treaties` | 3,264 | 1,519 | ⚠⚠ **no** |
| `tax-treaties-dta` | 324 | 172 | ⚠⚠ **no** |
| `parliament-treaties` | 328 | 328 | not measured |

⚠⚠ **OI-3 stands and it binds this section:** `uk-treaties` and `tax-treaties-dta` **can be returned
by no query at any setting** — verified live and two-sided on 24 August, 0/20 through debates and
0/20 through committees. The text is held and unreachable, on a display-type distinction no user
made. **Any relationship type built over those two collections would be built over text the platform
cannot retrieve.** That is the binding constraint on §5, not the graph.

On `permits_suspension` specifically — the type the brief says is most likely to be skipped and worth
the most: it turns *"the other side might react badly"* into *"this article permits suspension of
these obligations on this notice"*. It needs **article-level treaty text**, which is precisely what
§5.1 shows we do not hold for 86.5% of the tax treaties, and what OI-3 shows we cannot retrieve for
the two dedicated treaty collections. **It is not answerable today.**

---

## §6 — THE OPEN QUESTION THAT BLOCKS LAYERS

`scripts/ingest/graph/audit-4a-tables.ts` → `audit-4a-tables.json`.

**Answer: `citation_edge` SUPERSEDES the `cites` rows of `legislation_edges`. It supersedes nothing
else, and `legislation_edges` is not going anywhere.**

### The measurement, at (source gid → target gid) grain

The two tables have different row semantics — `legislation_edges` is one row per
(from, to, type, sub_type); `citation_edge` is one row per citation *instance* — so they are
comparable only as pairs.

| | pairs |
|---|---|
| `legislation_edges` `cites` | 111,193 |
| `citation_edge` | 335,615 |
| **in both** | **109,099 (98.1% of `cites`)** |
| only in `legislation_edges` | 2,094 (1.9%) |
| only in `citation_edge` | 226,516 |

**Of the 2,094 "missing" pairs, 1,980 (94.6%) are the same edge under a different identity string** —
recovered by matching on `citation_edge`'s raw `target_uri` instead of its normalised id. 970 have a
pre-1963 target. **Genuinely absent from `citation_edge`: 114 pairs.**

So `citation_edge` holds 98.1% of what `cites` holds, **plus 226,516 pairs it never had, plus
`citation_text` and `raw_fragment` on every row.** `legislation_edges` has no text column at all: an
edge there can be asserted but not quoted.

### ⚠⚠ What blocks retiring anything: the two tables disagree on identity

| | distinct regnal-form targets |
|---|---|
| `legislation_edges` `cites` | **0** |
| `citation_edge` | **717** (3,531 rows) |

Worked examples — the same Act, looked up both ways in `legislation_edges`:

| `citation_edge` calls it | the source URI says | rows under the URI form | rows under the `citation_edge` form |
|---|---|---|---|
| `ukpga/Eliz2/9-10/33` | `ukpga/1961/33` | 59 | **0** |
| `ukpga/Geo6/12-13-14/54` | `ukpga/1949/54` | 50 | **0** |
| `ukpga/Geo5and1Edw8/26/49` | `ukpga/1936/49` | 50 | **0** |

Neither is wrong. `legislation_edges` keeps the URI verbatim; `citation_edge` normalises to the form
legislation.gov.uk treats as canonical. **But a join or a union on gid drops every pre-1963 Act, and
the result looks like a coverage finding rather than a bug.**

### What retiring the `cites` rows would take

1. **An identity bridge first.** The alias map exists inside `extract-citation-edges.ts`
   (`buildAliasMap`, 14,083 regnal/calendar pairs) and in `v37-citation-gaps.ts` (`identitiesFor`).
   It needs to be one shared module, not a third copy — *the shape of OI-15 was two places that must
   agree with no check that they agree.*
2. **Repoint `impactSet()`'s `citedBy` group** at `citation_edge`, and with it
   `edges-query-service.ts` and `score-gold-d.ts`.
3. **Repoint `v37-citation-gaps.ts`,** which counts `cites` and `made-under` as "ours".
4. Only then delete. **Nothing is retired in this sprint**, per the brief.

**And the other five edge types are not in question.** `amends` (1,015,960), `commences` (477,946),
`made-under` (230,681), `repeals` (322,346), `modifies` (180,781) — **2,227,714 rows, held nowhere
else.** `legislation_edges` is the effects graph; `citation_edge` is the citation graph. Calling
either "the graph" is how the layers get added twice.

---

## §7 — THE COVERAGE BLOCK

**Built.** `graph/coverage.ts`, `graph/setup-coverage-table.ts`, wired into `graph/inbound.ts`.

`inbound()` now returns **`{ rows, coverage }`**, not a bare array. The signature change is the
point: an array lets a caller present a short list as a complete one.

The block reports, on every call: which layers were **searched**; which are **not built** or **held
elsewhere**, each with **what the reader loses by it**; the markup/text detector split, never summed
unnamed; the share of rows not sited in a provision; the share whose target is an instrument we hold
no text for; the extraction statistics **with their age**; and the case-law date boundary when asked
for.

### ⚠⚠ Generated from live state — and that is enforced, not intended

- Every layer's status comes from a **live count**, so a layer built tomorrow flips to `searched`
  with nobody editing a list.
- Two facts cannot be live queries — the unresolved-span count and the OI-15 residual are properties
  of an extraction run over a 1.4 GB zip, not of any row. They live in a new additive table,
  **`graph_coverage_fact`, with the date they were measured and the script that measured them**, and
  a fact past a 30-day window **reports itself STALE, by name, inside the block**.
  ⚠ *A stale fact announcing its age is the whole difference between this and a constant.*
  Values are read from the audits' own JSON — **not re-keyed by hand**, because a re-keyed number is
  a constant with extra steps.
- `check-4a-coverage.ts` **greps `coverage.ts` itself** and fails if any string states a figure about
  the corpus. **This rule was watched firing** on a planted `"the corpus holds 17.5 GB of data"`.

### ⚠ The check caught a real defect in the block, on its first run

The `enabling-power` layer's first probe counted `citation_edge` rows whose text happened to contain
*"in exercise of the powers"* — **858 incidental matches — and reported the layer as SEARCHED.** A
caveat that lied in the reassuring direction, which is exactly what this block exists to prevent. The
probe now tests for a `detection` value outside the two textual detectors (structurally 0, and
buildable only by widening the CHECK constraint — which is what building the layer means), and the
layer correctly reads `held-elsewhere · 0 rows here · legislation_edges (230,681 rows, no evidence
column)`. An assertion pinning that regression is in the check.

**`check-4a-coverage.ts` — 29 passed, 0 failed.** Every negative control watched firing: the planted
fact moved the block *and reached the rendered words*; the back-dated fact announced itself stale in
prose; the hardcoded-figure grep caught its planted violation; the handle pattern matched a real
handle. Existing 25-H checks after the signature change: `check-25h-parser` 37/37,
`check-25h-inbound` 12/12 (up from 11 — a new assertion that an **empty** result still carries the
block, because an empty list is the answer most easily misread as *"nothing refers to this"*),
`check-25h-verify` 8/8. `tsc` clean on every file this sprint touched.

---

## WHAT IS NOT DONE, NAMED

1. **`legislation_edges` is not re-extracted.** The code defect is fixed; the 924 edges are not in the
   table. Deliberate — see Q2.
2. **Short-form resolution is not built**, as instructed. And on §3's evidence it is not the thing to
   build.
3. **Layer 2's enabling half is not built.** Scoped and priced only, as instructed.
4. **Nothing was retired.** As instructed.
5. **The identity bridge is not built.** It is the prerequisite for everything in §6.
6. **The 3.5% discrepancy between my unresolved-span count and 25-H's is unexplained.**
7. **The five treaty relationship types cannot be assessed**, because the handover defining them is
   not in the repository.
8. **No browser or live-site verification.** None is possible or applicable: the graph has no
   user-facing surface, which §1 measured.
9. **`title-absent` vs `title-mismatch` are not cleanly separated** — see the honest limit in §3.

---

## DECISIONS FOR CHARLIE

**Q1 — Is my list of twelve research targets the right one?**
The handover that defines them is missing. Mine is in the `CHANGE_LOG` entry, fixed before the
measurement.
▶ **Recommendation: accept it, or send the real list and I re-run — it is one command.**
*Consequence either way:* small. Leave-one-out puts the headline between 23.0% and 28.0% and the
decision does not flip on any single target.

**Q2 — Re-extract `legislation_edges`' `cites` rows, or leave them and retire them later?**
The fix is committed; the 924 edges are not in the table. §6 says `citation_edge` already holds 98.1%
of those pairs plus 226,516 more, with evidence.
▶ **Recommendation: do NOT re-extract. Retire the `cites` rows instead, after the identity bridge.**
*Consequence of re-extracting:* a few minutes of compute to add 924 rows to a table whose whole
`cites` population is superseded — and it would make retiring them later feel wasteful, which is how
a superseded table survives.
*Consequence of leaving them:* `impactSet()` and the gap census stay 0.76% short and 37%-of-Acts
blind until step 2 of §6 happens. **Nothing a user can see is affected.**

**Q3 — Build the identity bridge?** *(prerequisite for Q2 and for every layer)*
One shared module resolving calendar↔regnal and the zero-padded EU forms, replacing the two existing
copies.
▶ **Recommendation: yes, and next — it is the smallest thing that unblocks the most.**
*Consequence of not doing it:* any join between the two graphs silently drops every pre-1963 Act and
presents the loss as a coverage result. That is the OI-15 failure shape, already in place, waiting.

**Q4 — Given §3, is short-form resolution still the thing to build?**
It addresses 9.3% of the commonest unresolved spans. Title and corpus coverage is 90.7%, and the
largest single bucket is `apni` — fifty years of Northern Ireland primary legislation, already
flagged in `v37-citation-gaps` with 2,602 references and still open.
▶ **Recommendation: no. Ingest the absent Acts first — `apni` above all — and re-measure.**
*Consequence of building short-form resolution now:* real work, correctly executed, recovering under
a tenth of the gap, while the eight-times-larger cause stays open and invisible.

**Q5 — The 249 double taxation Orders whose scheduled agreement we do not hold.**
The mechanism works; the text is missing for 86.5% of them, and worse before 2018.
▶ **Recommendation: treat as a named coverage boundary now, and scope the re-fetch separately.** The
Orders are on legislation.gov.uk and the fetch is free.
*Consequence of leaving it silent:* a tax question about a treaty returns the Order's three operative
articles and reads as an answer. **This is the 2% markup failure, one level down.**

**Q6 — MLI positions: acquire, or declare the boundary?**
Not held, and not obtainable from legislation.gov.uk — the OECD publishes them.
▶ **Recommendation: declare the boundary in the coverage block now; decide on acquisition
separately.** The block already names `treaty-obligations` as NOT BUILT with its consequence.
*Consequence of neither:* an agreement read off legislation.gov.uk can be out of date without saying
so — which is the failure the brief predicted, arriving exactly where it said it would.

**Q7 — OI-3 blocks §5 more than anything in this sprint does.**
`uk-treaties` (3,264 sections) and `tax-treaties-dta` (324) can be returned by no query at any
setting. The stated blocker on that item is already gone.
▶ **Recommendation: settle OI-3 before scoping any treaty relationship type.**
*Consequence of building first:* five relationship types over text the platform cannot retrieve.

---

## ARTEFACTS

| file | what |
|---|---|
| `scripts/ingest/graph/audit-4a-blast-radius.ts` · `.json` | §1 T1 |
| `scripts/ingest/graph/audit-4a-t2-hole.ts` · `.json` | §2 T2 — no writes |
| `scripts/ingest/graph/audit-4a-t3-spans.ts` · `.json` | §3 T3 |
| `scripts/ingest/graph/audit-4a-unresolved-cause.ts` · `.json` | §3 follow-up — cause of the unresolved spans |
| `scripts/ingest/graph/audit-4a-tables.ts` · `.json` | §6 |
| `scripts/ingest/graph/audit-4a-layer2.ts` · `.json` | §4 and §5 |
| `scripts/ingest/graph/coverage.ts` | §7 — the block |
| `scripts/ingest/graph/setup-coverage-table.ts` | §7 — `graph_coverage_fact`, additive |
| `scripts/ingest/graph/record-4a-facts.ts` | §7 — facts from the audits' JSON, not re-keyed |
| `scripts/ingest/graph/check-4a-coverage.ts` | §7 + T4 — 29/29 |
| `scripts/ingest/graph/extract-cites-edges.ts` | **OI-15 fixed** — shares `ENTRY_RX`, `main()` guarded |
| `scripts/ingest/graph/extract-citation-edges.ts` | `extractDocText` gains `onUnresolved`; `loadActTitles` exported |
| `scripts/ingest/graph/inbound.ts` | returns `{ rows, coverage }` |
