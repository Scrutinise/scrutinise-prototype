# GRAPH 5 — CASE LAW TO LEGISLATION, AND HOW COURTS HAVE TREATED IT

**Executes** `docs/BRIEF_GRAPH_5.md` §0–§5. **Written** 8 September 2026 by CC-Graph.
**Predictions** logged in `CHANGE_LOG.md` at 2026-09-08 13:46 UTC, before the full audit ran, and
scored below.
**Database** Neon `ep-old-dust-aboxi69a` / `neondb`. **Spend** US$0.00 — no model call was made; the
whole sprint is R2 reads and Postgres writes over infrastructure already running.

---

## THE SHORT VERSION

1. ⚠⚠ **The extraction design is the opposite of its sibling's, and the audit is what decided it.**
   GRAPH 4A needed a text detector because legislation's own `<Citation URI>` markup covers 2–5% of
   act-name mentions. TNA's case-law Akoma Ntoso covers **90.5%**. So this extractor is
   markup-only — a measured decision, not a shortcut.
2. ⚠⚠ **The back-reference problem §2.1 warned about does not exist here: the publisher already
   solved it.** 55.8% of legislation references are words naming only a provision (*"Section
   11(2)"*, *"s. 31(7)"*), and in **100.0%** of those the href carries the Act as well. Nothing of
   ours has to resolve *"the 1994 Act"*.
3. ⚠⚠ **§2.2's answer is NO, and it is unambiguous. 74,896 of 74,896 judgments — 100.00% — carry
   `<decision>` and nothing else.** There is no `<background>`, no `<motivation>`, no procedural
   division anywhere in the corpus. The structure cannot tell a provision the case turned on from
   one recited in the history, so **the reference is stored without the distinction** and no column
   pretends otherwise.
4. **1,288,630 case-law citation edges**, from 52,861 of 74,896 judgments, 99.0% resolving to an
   instrument we hold. Inside the predicted 0.9M–1.4M band. **$0.52/month.**
5. ⚠ **GRAPH 4A's counter-intuitive result carries over almost exactly, and my prediction that it
   would not was wrong.** Short-form resolution addresses **9.8%** of unresolved names here against
   4A's 9.3%. The lever is not short forms — again.
6. ⚠⚠ **Five defects were found by reading output rather than by reading code, and four were
   mine**: a lost-update race that under-reported the row count by 24%; a `doubted` pattern firing
   on doubt about *facts*; **193,226 stored quotes (15.0%) opening with XML debris**, caught only
   by the round-trip assertion that looks for the quote *in* the judgment; a cause classifier
   comparing a normalised span to a raw title; and — the worst — **a treatment edge naming the
   case that did the overruling as the case overruled**, because the overruled cases were cited by
   name only. ⚠⚠ The guard written for that last one **shipped dead**: a heredoc turned its `\b`
   into a literal backspace, so it matched nothing and reported *"0 refusals"* on the very
   judgment it was written for.
7. ⚠⚠ **`coverage.ts` had been naming two case-law corpora that do not exist and omitting the
   entire English holding.** Its boundary was computed over what was left and answered **1989**.

---

## §0 — THE GATE, RE-MEASURED

The brief gates the sprint on re-confirming the 20 August case-law text repair against live tables,
because *"building a citation extractor over formatting code would produce a large, confident,
empty graph"*. `check:graph5-prereq` — **8 passed, 0 failed**, and every gate assertion was first
watched rejecting the real BEFORE-state body under `--self-test`.

⚠ Three surfaces, reported apart, because they were repaired by different work and two can be clean
while the third is not:

| | what it is | measured |
|---|---|---|
| **A** `corpus_sections` | provenance + titles | 74,894 of 74,896 carry the new extractor's route (**99.997%** — the check prints 100.00% at two decimals, and the two exceptions are named below); **74,883 titled (99.98%)** |
| **B** the stored **body** in R2 — *the gate* | what an extractor reads | **0 of 400** bodies open with a stylesheet · **0 of 20,540,760 characters** are stylesheet · 400 of 400 accepted as judgment text |
| **C** `corpus_chunks` chunk 0 | what the **embedder** read | **0 of 300** more than half stylesheet · **0** carrying any CSS |

⚠ **C is the one worth naming.** The August report left it explicitly NOT fixed — it was Decision 1,
a ~$31 re-embed, and the "77%" figure in the brief's §0 was measured on this surface while it was
still broken. It is now clean, so the re-chunk and re-embed were carried out after that report was
written. **§0's claim is confirmed on all three surfaces, and it was worth checking all three
rather than the one the sentence happened to describe.**

⚠ **The two rows that carry no re-compile provenance are `empty-at-source`** —
`[2017] UKUT 135 (LC)` and `[2018] EWHC 1178 (QB)`, whose `<judgmentBody>` the publisher serves
empty. 74,896 − 2 = 74,894, which is exactly the brief's figure. The 13 untitled rows carry the new
route and are mostly genuinely tiny documents (5–9 words).

---

## §1 — THE COVERAGE BOUNDARY, BUILT FIRST

Built before the extraction, as instructed, so it cannot be forgotten afterwards.
`scripts/ingest/graph/caselaw-coverage.ts` · `check:graph5-boundary` — **18 passed, 0 failed, 5
controls, 0 dead**.

### ⚠⚠ The finding: the boundary that already existed was wrong, and wrong reassuringly

`coverage.ts` shipped `CASE_LAW_CORPORA = ['caselaw', 'caselaw-fcl', 'et-decisions',
'tax-tribunals']`. Measured live:

- **`caselaw` holds 0 rows. `caselaw-fcl` holds 0 rows.** Neither has ever existed under that name.
- The list **omitted `tna-caselaw` — all 74,896 judgments, the entire English holding** — and
  `scottish-courts`, `ni-judgments`, `echr-hudoc` and `cma-cases`.

So the block computed `MIN("itemDate")` across the two collections spelled correctly and reported a
case-law boundary of **1989**. ⚠ **A corpus name that matches nothing is indistinguishable from a
corpus that is empty**, and the resulting figure looked entirely normal. `caseLawCoverage()` now
reports a named collection it cannot find rather than letting it vanish out of the aggregate.

### ⚠⚠ MIN(date) is a decoy, and the cliff is derived rather than written down

There is no `2003` anywhere in `caselaw-coverage.ts`. The brief names that year and the year is
right, but a hardcoded floor is the retired "17.5 GB alert line" again. `continuousFrom` is computed
from the live annual histogram by one stated rule — and **the derivation independently reproduces
2003 for `tna-caselaw` and 1999 for `scottish-courts`**, which is the strongest evidence available
that the rule is measuring the thing the brief measured by hand.

⚠ **The earliest item held is not the floor.** `tna-caselaw`'s earliest is 1965-08-09 and it holds
239 items before 2003 against 74,657 from 2003 on. A statement reading *"our case law runs from
1965"* is true of the minimum and false of the holding — and false in the reassuring direction.

**Live reading, 2026-09-08:**

| collection | documents | shape | continuous from | older items held |
|---|---:|---|---:|---:|
| `et-decisions` | 161,753 | cliff | **2017** | 0 |
| `tna-caselaw` | 74,896 | cliff | **2003** | 239, back to 1965-08-09 |
| `cma-cases` | 22,898 | cliff | 2003 | 15 · ⚠ 20,336 undated |
| `tax-tribunals` | 13,099 | cliff | 2003 | 34, back to 1989-11-09 |
| `scottish-courts` | 13,070 | cliff | **1999** | 0 |
| `ni-judgments` | 7,927 | cliff | 2002 | 244, back to 1984-09-07 |
| `echr-hudoc` | 4,460 | **ramp** | **none** | — |

⚠ **The pre-2001 holding reconciles to the brief's figure exactly:** 210 + 1,203 + 235 + 2 + 2,053 =
**3,703**.

### ⚠⚠ Three shapes, not two, and the third is what keeps it honest

The rule's first version was wrong twice and both failures are pinned as fixtures in the check:

1. **A partial final year ended the walk-back.** Ingest stops at a date, not at a new year's eve —
   `tax-tribunals` runs to 2024-06-11, so its 2024 holds 102 against a typical 649. The rule
   reported *"continuous from 2024 to 2024"* with an 11,987-document "tail". **The floor it named
   was the cut-off of our own ingest run.**
2. **`echr-hudoc` has no cliff at all.** It climbs from a single 1956 decision to a plateau in the
   1990s and falls away again; 98.7% of it sits below any year the cliff test picks. Reporting
   *"continuous from 2025"* would have been a confident wrong answer of exactly the kind §1 exists
   to prevent. It now reports **no floor**, out loud, with the span and the unevenness instead.

---

## §2 — CASE LAW TO LEGISLATION

### §2.1 — How judgments actually cite legislation

`audit-g5-citation-forms.ts`, over **all 74,896 judgments** (no sampling).

⚠⚠ **The structural finding that decided everything: the compiled body is plain text with the
markup stripped, but the raw Akoma Ntoso is held for 74,896 of 74,896 rows (100%)** and carries the
publisher's own `<ref uk:type="legislation" href="http://www.legislation.gov.uk/id/…">`, resolved
down to the section. `<ref uk:type>` separates `legislation` from `case` at source.

**Twenty real examples are printed in full in `graph/audit-g5-forms.log`.** The forms the brief said
to expect are all present, and quantified — classified by the reference's **own words**, never by
what the publisher resolved it to:

| form | example | rows | share |
|---|---|---:|---:|
| **bare-provision** | *"Section 11(2)"*, *"s. 31(7)"* | 715,814 | **55.8%** |
| **full-title** | *"Trade Marks Act 1994"* | 226,621 | 17.7% |
| other (abbreviation) | *"FA 2003"*, *"CA 1989"* | 176,371 | 13.7% |
| **short-form / back-reference** | *"the 1994 Act"* | 164,768 | 12.8% |

⚠⚠ **The back-reference is resolved by the publisher, not by us.** Of the 715,814 references whose
words name only a provision, the href carries the Act in **715,814 — 100.0%**. The form the brief
singled out as the hard one (*"the bare provision once the Act has been named earlier"*) needs no
resolver of ours at all.

**Markup completeness — the GRAPH 4A question.** 252,195 act-name spans found by the **shared**
`ACT_NAME_RX`; **228,326 (90.5%)** already wear a `<ref>`. Against 4A's 2–5% for legislation. ⚠ This
is why the extractor is markup-only and why the ~9.5% residual is declared rather than silently
dropped.

### ⚠ §2.1 item 2 — the unresolved-name breakdown, and my prediction was wrong

The residual is **12,276 spans over 5,647 distinct names — 4.9% of all act-name spans**. ⚠ Unlike
4A, this is not the main population; it is what is left over after the markup.

| cause | spans | share | 4A's figure |
|---|---:|---:|---:|
| **title-absent** — no instrument of that name, normalised or loose | 1,539 | **61.0%** | 59.2% |
| **mis-cited-year** — the right Act, the wrong year | 606 | **24.0%** | *(no such bucket)* |
| **short-form** — a strict suffix of a held title | 247 | **9.8%** | 9.3% |
| title-mismatch — held, differing only by punctuation | 133 | 5.3% | 31.6% |

▶ **Short-form resolution addresses 9.8%** (12.9% on 4A's three-bucket scheme). **The brief asked
whether 4A's counter-intuitive answer carries over. It does, almost exactly** — and my prediction
that short-form would come out *below* 9.3% is **refuted**: it is slightly above on both schemes.

⚠ **A bucket 4A did not have, and it is a quarter of the residual: the source mis-cites the year.**
*"human rights act 1988"*, *"crime and disorder act 1988"*, *"criminal justice act 1998"*,
*"companies act 1986"* — a judge's slip or an OCR artefact. 4A's scheme would have filed every one
as a corpus coverage gap. It is a mis-citation in the source, which is a different fact and a
different piece of work.

⚠⚠ **A defect in my own instrument, found by reading its output.** The first version asked
`corpus_acts` with `lower(title) LIKE '%' || span` — comparing a **normalised** span against a
**raw** title. Every name differing by punctuation failed and was filed `title-absent`:
*"magistrates courts act 1980"* reported as an Act we do not hold, when the Magistrates' Courts Act
1980 is right there and the judgment simply omitted the apostrophe. It produced **title-absent 78.1%
and title-mismatch 0.0%** — and a bucket that cannot ever be non-zero is the shape of an instrument
that cannot produce one of its own answers. Two literal comparisons agreeing is not corroboration
when they share the assumption.

⚠ **An honest limit that remains:** the short-form test is a strict suffix, so *abbreviations* are
not caught — *"nhs act 2006"*, *"nia act 2002"*, *"eu (withdrawal) act 2018"* are filed
`title-absent`. The load-bearing division (short-form ~10% vs everything else ~90%) is unaffected,
because the test errs against the short-form bucket.

### §2.2 — ⚠⚠ Can we tell the reasoning from the background? **No, measured, at 100%**

| | |
|---|---:|
| judgments carrying a division other than `<decision>` | **0  (0.00%)** |
| judgments carrying only `<decision>` | **74,896  (100.00%)** |

Akoma Ntoso defines `<introduction>`, `<background>`, `<motivation>` and `<arguments>`. **TNA emits
none of them**, in any of 74,896 documents; `<decision>` covers 99.7–100% of every `<judgmentBody>`
examined. It is the wrapper, not a division.

▶ **So, exactly as §2.2 instructs: the structure does not support it, we say so, and the reference
is stored without the distinction.** `check:graph5-citation` asserts that **no column exists**
named for ratio, obiter, reasoning, centrality, weight or rank. **An honest flat list beats a
confident wrong ranking**, and this project has produced two of the latter.

⚠ What *is* available and is stored: the judge's own paragraph number, on **916,564 of 1,288,630
rows (71.1%)**. The remainder sit in paragraphs the source does not number, and are stored NULL —
never back-filled with a running index, because a number a reader can check against the judgment is
a different fact from one we invented.

### §2.3 and the volume

| | measured | predicted |
|---|---:|---|
| legislation `<ref>` elements | **1,288,630** | — |
| rows built and **stored** | **1,288,630** | 0.9M–1.4M ✓ |
| judgments carrying at least one | 52,861 of 74,896 (70.6%) | — |
| href did not parse to a gid | **0 (0.0%)** | — |
| target held in the corpus | 1,275,877 (**99.0%**) | — |
| naming a target provision | 728,531 (56.5%) | 52–60% ✓ |
| storage | 1.49 GB → **$0.52/month** | $0.45 ✓ |

⚠ **The storage alarm is not re-raised.** It has been retired three times; storage is a bill, not a
wall, and no threshold is implied by the figure above.

### ⚠⚠ The defect that only the round trip could find, and the rebuild

The first full run passed every structural check: 0 blank quotes, 0 unparsed URIs, every constraint
satisfied, and a count that reconciled exactly. **193,226 of its quotes — 15.0%, one in seven —
opened with XML debris:**

> `uk:origin="TNA" uk:type="legislation">section 138 D of the Act (and each of those rules is…`

The 400-character evidence window lands wherever it lands and very often begins **inside an
attribute list**; `/<[^>]*>/` needs an opening bracket, so the tail of the tag survives. ⚠ Nothing
failed, because nothing was structurally wrong — the words were all present. It was caught by the
one assertion that re-reads the original XML out of R2 and requires the quoted words to be **found
in it**, and that assertion failed 1 of 19 on its first run.

**Rows rebuilt** (`redo-g5-citation-edges.ts`, scoped by `source_type` *and* the exact
`extracted_from` stamp, refusing if the count moved between reads, and re-reading the 1,225,806
out-of-scope rows to confirm they were untouched). **After: attribute remnants 0 of 1,288,630**, the
round trip **80 of 80**, and the row counter now reports 1,288,630 written against 1,288,630 built.

⚠ *"The extractor wrote a row"* and *"the row is true of the document"* are different claims, and
only the second is about the corpus.

**§2.3's rules, and how each is met:**
- **Every edge quotes the words that make it** — `citation_text` and `raw_fragment`, asserted
  non-blank on all 1,288,630 rows. NOT NULL permits `''`, so this is checked as a content rule.
- **The identity resolver is shared, not reimplemented** — `parseLegUri` and `identitiesFor` are
  imported. ⚠ The regnal-year trap has appeared in four code paths, each time because a fix went
  into one of two places that had to agree. **This file adds no fifth**, and `check:graph5-citation`
  confirms **90,587 regnal-form targets are present and 79,942 resolve** — a zero there would have
  meant the trap had fired again.
- **Never merge two identities on similarity** — an unresolved target is counted, never guessed.

⚠⚠ **The provenance caveat that travels with every row.** Every legislation ref carries
`uk:origin="TNA"` — **100% of them**. **The court did not mark these up; The National Archives'
enrichment did.** That is stronger evidence than our own name-matching and weaker than a source
asserting its own meaning. Hence `detection = 'caselaw-markup'`, not `'markup'`: **a measured fact
and an inferred one must not look identical in a count.** The *words* are the court's own and are
quoted verbatim; the *identity* is TNA's assertion.

---

### §2.4 — CITED BUT NOT HELD

**A judgment we do not hold can still be a target.** References to pre-2003 authorities appear in
the post-2003 judgments we *do* hold, so the edges are buildable — the direction that is
unavailable is **outbound**, from a judgment we lack. Inbound to it is exactly what our corpus
supplies.

`caselaw_case_edge` · `extract-caselaw-case-edges.ts` · `check:graph5-case-edges` — **24 passed,
0 failed, 6 controls, 0 dead**.

| | |
|---|---:|
| citation occurrences (self-citations excluded: 138) | 625,806 |
| **edges stored** | **565,931** |
| distinct authorities reached | **137,153** |
| citing judgments | 60,523 of 74,896 (80.8%) |
| ⚠ dropped: the passage did not contain its own citation | 59,406 (9.5%) |
| carrying the judge's paragraph number | 98.0% |
| carrying a derived BAILII link | 42.4% |

### ⚠⚠ Held is THREE-valued, and the third value is the one that matters

§2.4 requires the unheld target to be *visibly marked*. Two states would have been wrong in a
measurable band, and the pilot found the proof in one pair:

> `[2011] 1 WLR 2900` — **not held** · `[2011] UKSC 50` — **held**
> **The same case.** *Rainy Sky SA v Kookmin Bank*, cited in both forms.

| state | meaning | distinct authorities |
|---|---|---:|
| **held** | a neutral citation matching a `tna-caselaw` row | **32,990 (24.1%)** |
| **not-held** | a law-report citation before the derived English floor. A permanent boundary, not a backlog | **75,366 (54.9%)** |
| **unknown** | ⚠⚠ a law-report citation *at or after* the floor. We MAY hold it under its neutral citation, unlinked | **28,797 (21.0%)** |

⚠ **Calling `unknown` "not held" would tell a user we lack something we have** — for one authority
in five. An unknown fact is unknown, not absent. The floor itself is **read from live state**
(`caselaw-coverage.ts`), never written into this file.

The database enforces the mark rather than trusting the writer: a `held` row must name the judgment
it resolves to, and a non-`held` row **may not carry a judgment id at all**. Both halves are watched
being refused.

### ⚠ Identity is the citation, never the name

We cannot verify a resolution against a document we do not hold, so nothing is merged on
resemblance. The measurement that justifies the rule:

- **180,740 distinct observed names** across 137,153 citations — a mean of **2.1 name variants per
  authority, and a maximum of 119** (*Investors Compensation Scheme v West Bromwich BS*).
- **22,184 observed names appear against more than one citation.** Had the name been the identity,
  every one of those would have merged two different cases.
- ⚠ **13.6% of observed names are unusable as a display name** — 11.2% run past 70 characters
  because they carry the citing sentence with them (*"well-known principles of interpretation for
  commercial documents (Investors Compensation Scheme v…"*), 3.2% begin mid-sentence in lower case.

▶ **The name is stored as an OBSERVATION with its variants, and nothing joins on it.** For display,
the **modal** variant is markedly better than the longest — *"Investors Compensation Scheme Ltd v
West Bromwich Building Society"*, *"In re H (Minors) (Sexual Abuse: Standard of Proof)"*,
*"R v Lucas"*. That is a surface decision (Q8), not a storage one.

### ⚠⚠ BAILII: link only, and the abstinence is asserted on the source

Their terms forbid storing search results or HTML versions of judgments and forbid robot access;
the register already records them as blocked. **Nothing in this sprint fetched anything from
BAILII.** A comment saying so is worth nothing, so `check:graph5-case-edges` **reads the
extractor's own source, with comments stripped, and fails if it contains any network call at all** —
and that rule is watched firing on a planted `fetch`.

⚠ **The link is derived from the citation alone and declines rather than guesses.** A first version
read the division only where it precedes the number, so `[2004] EWHC 254 (Admin)` — division in
trailing parentheses — produced `…/EWHC/QB/2004/254.html`: **a confident link to the wrong
division**, for every Administrative Court case. Now both forms are read, and an `EWHC`/`EWCA`
citation carrying **no** division yields **null** rather than a guess. **A wrong deep link is worse
than none**: the reader follows it, lands elsewhere, and stops trusting the record.

### ▶ What is shown instead of a headnote

The passage from **our own** judgment — which is our document, and which tells the reader what the
case is being cited *for*. There is **no column** in `caselaw_case_edge` that could hold a headnote,
a summary, or an extract of a judgment we do not hold, and the check asserts that over the table's
text columns.

⚠ The passage is required to **contain the citation it is evidence for** — the same invariant the
treatment layer needed. **59,406 candidate edges (9.5%) were dropped for failing it**, and all
565,931 stored rows pass. *(A naive `position(target_raw in passage)` reports 2,499 false misses,
because `target_raw` preserves the source's own spacing while `passage` is collapsed; the check
normalises both sides and the control confirms the un-normalised form really does mis-report.)*

Rendered from real data, the most-cited authority we do not hold:

> **Investors Compensation Scheme Ltd v West Bromwich Building Society** — `[1998] 1 WLR 896`
> **NOT HELD.** Our English case law is continuous from 2003.
> Cited in **760** judgments we hold, 845 times.
> *What our judgments say when citing it:* "…the inherent circumstances to which the court may have
> regard extend beyond those which may be adduced in evidence for the purposes of determining the
> true interpretation of the agreement under the well known test…"
> → search BAILII for `[1998] 1 WLR 896` *(the citation determines no path, so no deep link is offered)*

### Predictions, scored

| # | predicted | measured | |
|---|---|---|---|
| P-1 | `unknown` between 10% and 25% of distinct | **21.0%** | ✓ |
| P-2 | not-held + unknown 60–75%; not-held alone 35–50% | **75.9%** and **54.9%** | ✗ **refuted on magnitude, both above the band** — the gap is larger than I predicted |
| P-3 | edges 550k–700k; distinct 150k–200k | **565,931** ✓ ; **137,153** ✗ below | ~ half |
| P-4 | ≥15% of observed names unusable | **13.6%** | ✗ narrowly below — but the finding stands: mean 2.1 variants, max 119 |
| P-5 | usable passage for >95% of edges | **90.5%** of occurrences yield one | ✗ below, because the invariant is stricter than "non-empty" |

**Three of five refuted, all on magnitude and none on direction.** ⚠ P-5's miss is the instructive
one: I predicted against "a usable passage" and then built a *stricter* test than the one I had in
mind — the passage must contain the citation, not merely exist. The 9.5% it drops are real failures
I would otherwise have stored.

---

## §3 — HOW COURTS HAVE TREATED IT

*(Gated on §2's measurement, which is complete. §3.1's premise — patterns, not similarity — is
inherited from ARGUMENT 1A's 0-of-20 recall against 90% for literal phrases, and is not
re-litigated. ⚠ The reason applies with extra force here: **treatment turns entirely on polarity,
and polarity is what meaning-based matching is worst at.** *"We decline to follow"* and *"we
follow"* sit almost on top of each other in meaning-space and mean opposite things.)*

### §3.2 — What was built

`treatment-patterns.ts` (15 patterns, 9 treatments) → `caselaw_treatment_edge`, over all 74,896
judgments.

**1,756 edges built, 1,749 stored** — the 7 difference is the unique index collapsing duplicates,
and the table is the authority, not the counter. Every figure below is re-read from the table.

⚠⚠ **The delta from the first run IS the finding, so both are shown.** The first run stored 2,413
edges before the uncited-name refusal existed, and a known share of its case-subject rows named the
**overruling** case rather than the overruled one. Those rows were deleted and the layer rebuilt.

| | first run | **after the guard** | |
|---|---:|---:|---|
| treatment phrases found | 18,211 | **18,211** | unchanged, as expected |
| edges built | 2,422 (13.3%) | **1,756 (9.6%)** | |
| **subject is a case** | 1,593 | **923** | ⚠ **−42%** — the projection said −40% |
| subject is a provision | 829 | **826** | unchanged, as expected |
| rows carrying a court | 99.4% | **1,737 of 1,749 (99.3%)** | |
| rows carrying a date | 100% | **1,749 (100%)** | |
| rows carrying the judge's paragraph number | 98.6% | **1,721 (98.4%)** | |
| rows with a blank quote | 0 | **0** | |
| distinct judgments | — | **1,535** | |

⚠ **That the provision count barely moved (829 → 826) while the case count fell 42% is the
corroboration that matters**: the guard is about *uncited case names*, so it should touch case
subjects almost exclusively, and it did. A guard that had cut both equally would have been cutting
something else.

All nine treatments occur under both subject types — `case:distinguished` 339, `provision:read-down`
242, `case:applied` 179 … down to `provision:disapproved` 9.

⚠⚠ **The refusals are counted and reported, because a refusal that is merely absent from the output
is indistinguishable from a phrase nobody wrote:**

| refusal | | |
|---|---:|---:|
| no subject on the declared side | 13,710 | **75.3%** |
| **more than one candidate subject — refused, not guessed** | 2,079 | **11.4%** |
| **an uncited case name sits nearer the phrase** | **666** | **3.7%** |
| only the judgment's own citation | 0 | 0.0% |
| sentence did not contain its own phrase | 0 | 0.0% |

▶ **16,455 of 18,211 phrases — 90.4% — produce no edge at all.** That is the design working, not a
gap: most citations are not treatments, and a refusal is an honest result.

**§3.2's four requirements, each met:**
- **The verbatim sentence is on every edge** — `NOT NULL` *and* a CHECK against `''`, because
  `required` is a shape contract and the empty value always satisfies it. Mean length 829 chars.
- **The court and the date are attached.** A Supreme Court statement and a first-instance aside are
  not the same fact.
- **Treatment-of-a-case and treatment-of-a-provision are separate**, via a `NOT NULL`
  `subject_type` with no row that is both. All nine treatments occur under both.
- **"Considered" and "mentioned" are not treatments** and there is no pattern for either. The check
  asserts they are absent from the enum. 18,211 phrases yielded 1,756 edges: **most citations are
  unclassified, and that is the honest result.**

⚠⚠⚠ **And the line from §0 is enforced structurally, not by care.** `check:graph5-treatment`
asserts that **no column exists** matching `good_law|still_good|status|valid|authority_score|
superseded|overturned`. There is nowhere in this schema to put "no longer good law", so nothing can
compute one by accident.

### ⚠⚠ §3.3 — the two numbers, and why I have not produced them

`docs/GRAPH_5_VALIDATION.md` — **15 rows, sampled `ORDER BY md5(id)` and not by rank**, each with
the court's verbatim sentence, the matched phrase, the court, the date and the paragraph, and a
blank verdict line. **Nothing is scored, as §3.3 requires.** Two verdicts per row, asked separately:

- **A — is the treatment right?** Given this citation deserves a label, is *this* the right one?
- **B — should it have been classified at all?** Or is the court merely mentioning the case?

⚠⚠ **B is where this will fail, and I can already say so from reading the sample I generated — but
I have deliberately NOT tuned the patterns in response.** Fitting the extractor to the validation
set destroys the only instrument that can measure it. Two of the first four rows drawn are, on my
reading, false positives on B:

- *"But even if another court or tribunal **could decline to follow** our decision…"* —
  `[2024] EWCA Civ 1381` at ¶25, recorded as `not-followed` of section 3 of the Human Rights Act.
  **The clause is hypothetical and about a different, future court.** The court is not declining to
  follow anything.
- *"…a personal characteristic by which persons or groups of persons **are distinguishable** from
  each other"* — `[2004] EWHC 299 (Admin)` at ¶16, recorded as `distinguished` of *Kjeldsen Madsen*.
  **"Distinguishable" here means telling people apart.** It is a different word sense entirely.

And the regenerated, stratified set's `overruled` row is a third:

- *"…for him to have the opportunity of making objections and: '… if such **Objections are
  overruled**, the Local Authority, if they deem it necessary, shall cause to be prepared a Plan…'"*
  — `[2003] EWHC 2479 (Admin)` ¶38, recorded as `overruled` of **section 6 of the Human Rights Act
  1998**. ⚠⚠ The court is **quoting Victorian public-health statute**, where "overruled" means an
  objection being rejected; and the attributed provision is not even the one under discussion — it
  is the nearest legislation `<ref>` that happened to fall inside the window.

▶ **This is precisely the shape the position work found and §3.3 predicted: direction was wrong on
only 2 of 50 there, and the system claimed a position far too often.** A single blended accuracy
figure would hide it completely, which is why the two questions are on separate lines.

⚠⚠ **I stopped fixing at one round, deliberately.** The uncited-name guard was worth adding after
peeking because §0 makes a wrong "overruled" the most costly error available. A *second* round of
patch-look-patch would leave the validation set measuring a extractor that had been fitted to it,
and then nobody could say what the accuracy is. **The remaining false positives are reported, not
patched** — they are the answer to question B, and Q2 in §5 is the decision they feed.

### ⚠⚠⚠ A fifth defect, found in the validation set itself — and the direction rule was not enough

Building the set stratified by treatment (see below) surfaced the first `overruled` row, and it
named the wrong case:

> *"…Manchester Crown Court ex parte DPP **[1994] 1 AC 9**), during the course of which, both
> **ex parte Belsham** and a similar decision in **Reg v Central Criminal Court ex parte Randle**
> were expressly overruled…"* — `[2013] EWHC 191 (Admin)` ¶16

The cases overruled are **Belsham** and **Randle**. `[1994] 1 AC 9` is *Re Ashton* — **the case that
did the overruling.** ⚠ The direction rule was working correctly and still produced the wrong
answer, because **Belsham and Randle are named without citations**, so the citation parser cannot
see them and the only visible candidate on the declared side belongs to the overruling vehicle.

▶ **A new refusal:** where a case NAME carrying no citation of its own sits between the candidate
and the phrase, that name is the likelier subject, we cannot identify it, and the row is refused.
It can only ever remove rows. §0 makes the trade obvious — **naming the wrong case as overruled is
the most consequential error available on this platform.**

⚠⚠ **And the guard shipped dead on its first attempt.** Written through a shell heredoc, its `\b`
became a **literal backspace character (0x08)**, so the pattern required a control byte and matched
nothing at all. It reported **0 refusals on the exact judgment it was written for** — and a zero
there reads as *"this shape is rare"*, not *"this pattern is dead"*. `grep`, `sed` and every editor
view render 0x08 invisibly; only `od -c` showed it. **Run every new guard against the case that
motivated it before believing its zero.**

**With the guard working: 32 of 843 phrases refused (3.8%) in a 3,000-judgment pilot — and
case-subject attributions fell by 40%, from 79 to 47.** The defect was widespread, not a one-off.

### ⚠ The validation set is stratified, and the first version was not

A flat `ORDER BY md5(...) LIMIT 15` drew 6 `applied`, 5 `distinguished`, 2 `not-followed` and 2
`read-down`. **`overruled` did not appear at all**, nor `doubted`, `disapproved` or `per-incuriam`.
Those are the rarest treatments *and* the most consequential, so a proportional sample under-tests
exactly the rows where being wrong costs most — and §3.3 asks by name for *"a case overruled by a
named later case, one distinguished, one applied"*. The set is now stratified by treatment: **all
nine appear**, and it was the `overruled` row that exposed the defect above.

⚠ The sheet also carries a **refusals** mode (`--refusals`), because a set drawn only from rows the
extractor produced measures precision and is blind to recall. Reading a sample of the 75.3%
refusals is how we learn whether the conservatism is honest or merely lossy — and it has already
paid: three of the first four refusals sampled were my own `doubted` pattern firing on doubt about
**facts** (*"There is doubt as to when the claimant applied for transfer"*), surviving only because
no citation happened to sit nearby. **A false positive that survives by luck of adjacency is a
false positive**; the pattern now requires the participle or doubt expressly directed at an
authority's correctness.

### The checks

`check:graph5-treatment` — **48 passed, 0 failed, 15 controls, 0 dead.** Every polarity pair is
asserted **in both directions**, because a suite that only ever feeds the extractor *"we follow X"*
cannot see the failure that matters:

| positive | negative twin | must read |
|---|---|---|
| *we follow Smith* | *we **decline to** follow Smith* | followed / **not-followed** |
| *was overruled in Brown* | *was **not** overruled in Brown* | overruled / **nothing** |
| *that case **is distinguishable*** | *that case is **not** distinguishable* | distinguished / **nothing** |
| *has been doubted* | *has **not** been doubted* | doubted / **nothing** |

⚠⚠ **Direction is asserted on the sentence that makes it matter.** For *"Alpha v Beta [1998] AC 100
was overruled in Gamma v Delta [2015] UKSC 9"*, the check confirms the declared side holds the
**overruled** case, and a control confirms **the wrong answer really is sitting on the other side** —
so the rule is load-bearing rather than decorative. Taking the nearest citation would have recorded
*Gamma v Delta*, the case that did the overruling, as the case overruled.

---

## §4 — WHAT IS NOT DONE, NAMED

1. ~~**Case-to-case citation is out of scope.**~~ **BUILT — §2.4**, 565,931 edges over 137,153
   distinct authorities. ⚠ **But only INBOUND.** We can say what cites *Wednesbury*; we cannot say
   what *Wednesbury* cited, because we do not hold it. A line of authority can be walked forwards
   from a case we hold and never backwards through one we do not.
2. **Six of seven case-law collections carry no legislation edges at all.** `r2RawKey` is populated
   for 74,896 of 74,896 `tna-caselaw` rows and for **0** rows of `et-decisions` (161,753),
   `cma-cases` (22,898), `tax-tribunals` (13,099), `scottish-courts` (13,070), `ni-judgments`
   (7,927) and `echr-hudoc` (4,460). ⚠ **218,207 case-law documents — 74% of the case-law corpus by
   document count — are outside this graph**, and the coverage block says so.
3. **The ~9.5% of act names carrying no markup are not extracted.** A text detector for case law is
   not built.
4. **No judgment before 2003** for the English courts. The House of Lords archive is approved and
   unfetched; that is ingest, not this.
5. **No user-facing surface.** Nothing under `scrutinise-web/` reads either graph table.
6. **No statement about whether anything is good law**, by construction (§0).

---

## §5 — STANDING RULES

- **Predictions logged before the measurement** (`CHANGE_LOG.md`, 13:46 UTC) and scored above,
  including one refuted.
- **Every guard states what it counted**, never whether something exists.
- **Every check was watched failing against the real broken state**, not against a synthetic one:
  the §0 gate was run against the verbatim BEFORE-state body; the boundary rule against the two
  real histograms that broke it; the polarity patterns against their own negative twins.
- **Bytes before hypotheses** — the extraction design was decided by reading raw judgments, and it
  came out the opposite of what the sibling extractor does.
- **Scoped commits by explicit path**; `commit-graph-5.sh`; **additive migrations only** (both CHECK
  constraints accept strictly more than before; nothing dropped, no column retyped, no data moved).
- **Nothing owned by search, ingest, lex or the argument stream was edited.** One change is needed
  elsewhere and is reported rather than made — see Q4.

### Predictions, scored

| # | predicted | measured | |
|---|---|---|---|
| P-1 | markup completeness 80–92%, and the shared regex moves it UP from the pilot's 82.4% | **90.5%** | ✓ both halves |
| P-2 | bare-provision-with-resolved-href above 45%; ~zero for us to resolve | **55.8%, and 100.0% carry the Act**; exactly zero | ✓ |
| P-3 | short-form **below** 9.3%; title-absent largest and above 50% | short-form **9.8%** (12.9% on 4A's scheme); title-absent **61.0%** | ✗ **refuted on short-form** — it is slightly *above* 4A's figure, not below. ✓ on title-absent |
| P-4 | 0.9M–1.4M rows; ~$0.45/month | **1,288,630 rows**, 1.49 GB, **$0.52/month** | ✓ |
| P-5 | under 2% of judgments carry any division but `<decision>` | **0.00% — 0 of 74,896** | ✓, and stronger than predicted |
| P-6 | raw XML in `tna-caselaw` only, 100%/0% | 74,896/74,896 and **0** in all six others | ✓ |

**One of six refuted, and it is the interesting one.** I predicted short-form resolution would
matter *even less* for case law than for legislation. It matters very slightly *more* — and the
brief's underlying point survives intact either way: **short forms are ~10% of the problem in both
corpora, and the lever everyone reaches for is the wrong one twice.**

### The checks, named in full — every check in the suite, run or not

`check:graph5-prereq` **8**  ·  `check:graph5-boundary` **18** (5 controls)  ·
`check:graph5-citation` **19** (3 controls)  ·  `check:graph5-treatment` **48** (15 controls)  ·
`check:graph5-case-edges` **24** (6 controls).
**117 assertions, 29 controls, 0 dead, 0 not run.**

⚠ `check:graph5-citation` **failed 1 of 19 on its first run** — the round-trip assertion, which
found the markup debris. That failure is the reason the rows were rebuilt.

⚠ **`tsc` on the ingest program: 20 errors, none in any file this sprint created or edited.** They
are pre-existing, in `scrutinise-web/lib/lex/*`, `search/corpus-reachability.ts`,
`s3-drop-readiness.ts` and five others. ⚠ Two errors in `graph/check-4a-coverage.ts` **were** mine —
the `caseLawBoundary` shape changed under it — and are fixed.

### ⚠ Delivery position, stated rather than implied (docs/CLAUDE.md §20)

`scripts/check-clean-build.sh --fast` **PASS** — 0 cross-package files in the web program.

⚠⚠ **§20's checks 3 and 4 — "the deployment is green AND is Production" and "the running site
serves your change" — DO NOT APPLY to this sprint, and I am saying so rather than quietly omitting
them.** Nothing under `scrutinise-web/` was touched and nothing under `scrutinise-web/` reads either
graph table, so there is no user-visible string to read back. **The honest closing sentence is:
"built and verified against the production database by re-reading the rows; NOT verified on the
running site, because this sprint puts nothing on it."**

What *was* verified against live production state, by re-reading rather than by trusting a counter:
the 1,288,630 stored rows and their provenance stamp; the 1,749 treatment rows; the 1,225,806
out-of-scope rows confirmed untouched by the rebuild's delete; both widened CHECK constraints read
back off `pg_constraint`; and 80 sampled quotes found in the judgments they name.

---

## DECISIONS FOR CHARLIE

**Q1 — Score the 15 rows in `docs/GRAPH_5_VALIDATION.md`?** *(Recommended: yes, and it is the only
thing that unblocks a judgement about §3.)* Two verdicts per row, A and B, as the sheet explains.
⚠ I have deliberately not tuned the patterns after reading the sample, because fitting the
extractor to its own validation set would destroy the measurement. *Consequence of no:* §3 ships
with 1,749 edges and **no accuracy number at all**, which is worse than a bad one, because a
citator with an unmeasured error rate will be quoted.

**Q2 — Given what §3.3 will almost certainly show, does the treatment layer go to a user surface?**
*(Recommended: not yet — hold it behind the citation layer.)* §2 is strong evidence (the
publisher's own markup, 99.0% resolving, quotes that round-trip). §3 is 1,749 rows of which some
known share are word-sense and hypothetical-clause false positives. *Consequence of shipping both
together:* the weakest layer discredits the strongest, on a surface whose entire job is to be
trusted about the law. *Consequence of holding:* "how has it been treated" stays unanswered, which
is the half that makes it a citator rather than an index.

**Q3 — The six case-law collections with no raw XML: 218,207 documents, 74% of the case-law corpus.**
*(Recommended: ask INGEST to retain raw for `scottish-courts` and `ni-judgments` only.)* Those two
are real courts of record; `et-decisions`, `cma-cases` and `tax-tribunals` are tribunals and a
regulator, and `echr-hudoc` is a different legal order. ⚠ **It is not a re-fetch — it is a decision
about what ingest keeps**, and until it changes, a coverage statement that says "England and Wales
only" is doing real work. *Consequence of no:* Scottish and NI authority is invisible to this graph
permanently, and the boundary block has to keep saying so.

**Q4 — `export` `COURT_FROM_NEUTRAL` from `caseref/build-records.ts`.** *(Recommended: yes, one
word.)* That file is INGEST's and this sprint did not edit it, so there are currently **two copies
of the same court map**. ⚠ The regnal-year trap reached four code paths exactly this way. I have
added a check that reads `build-records.ts` and fails if the copies diverge, which makes the
duplication *detectable* — but two copies with a check is a stopgap and one copy is the fix.
*Consequence of no:* the check keeps them honest until somebody edits one of them under a
different filename.

**Q5 — 24% of unresolved act names are the source citing the wrong year** (*"human rights act 1988"*,
*"criminal justice act 1998"*, *"companies act 1986"*). *(Recommended: record them, do not
"correct" them.)* This is a bucket GRAPH 4A did not have and would have filed as a corpus coverage
gap. ⚠ **Resolving them means deciding a judge meant a different Act from the one they named**,
which is a legal inference wearing a data-cleaning costume. *Consequence of recording only:* a real
signal about source quality, and 606 spans stay unresolved. *Consequence of correcting:* we would
be silently amending judgments.

**Q7 — The 28,797 `unknown` authorities: link them to their neutral citations?** *(Recommended:
yes, and it is cheap.)* These are law-report citations at or after our floor which we may already
hold under a neutral citation — one authority in five. Matching them needs a party-name + year
join, ⚠ **which is exactly the similarity merge §2.3 forbids** unless a second fact agrees. The
safe form is: propose a link only where the case NAME and the YEAR both agree and the proposal is
recorded as a proposal. *Consequence of no:* 21% of authorities stay in a state that reads as
uncertainty when many are simply unlinked. *Consequence of doing it loosely:* two different cases
merged, which is the one outcome §2.3 exists to prevent.

**Q8 — Which name to display for an unheld authority?** *(Recommended: the modal variant, and show
the variant count.)* Mean 2.1 variants per authority, max 119, and **13.6% of observed names are
unusable** — they carry the citing sentence with them. The modal variant is markedly better than
the longest or the first. *Consequence of picking naively:* the platform displays *"well-known
principles of interpretation for commercial documents (Investors Compensation Scheme v…"* as a case
name. *Consequence of showing none:* a citation with no name cannot be found by a user typing the
name, which was the original complaint.

**Q6 — Build a text detector for the ~9.5% of act names with no markup?** *(Recommended: no.)*
The residual is **12,276 spans, 4.9% of all act-name spans**, and 61% of it is Acts we do not hold
under any title — foreign statutes (*"corporations act 2001"*, *"canadian maritime liability act
2001"*), local Acts, and NI legislation. *Consequence of no:* the coverage block keeps declaring
it, which it does. *Consequence of yes:* the same 4A lesson learned a third time.
