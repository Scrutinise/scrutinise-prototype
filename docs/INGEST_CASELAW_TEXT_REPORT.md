# INGEST — THE CASE-LAW TEXT WAS A STYLESHEET WITH A JUDGMENT UNDERNEATH

**Executes** `docs/BRIEF_INGEST_CASELAW_TEXT.md` §1–§5. **Written** 20 August 2026 by CC-Ingest.
**Cost $0 — no LLM call anywhere in this sprint.**

---

## THE ONE-PARAGRAPH ANSWER

The writer stored `rawToText(judgmentXml)` — the *whole* Akoma Ntoso document with its tags
removed. `rawToText` deletes tags and keeps text nodes, and the National Archives puts the
stylesheet it renders judgments with in a text node, inside `<meta><presentation><html:style>`. So
every stored judgment opened with the court code, the citation, a SHA-256 build hash and 2.0k–3.4k
characters of `#judgment { font-family: 'Times New Roman'; … }`. **The brief's premise is right
about the head of the document and wrong about the rest: the judgment was never lost.** It sat
underneath, and the stylesheet was a median 5.7% of the characters. That is still the failure the
brief describes, because the head of a body is exactly what is served as a snippet and what fills
chunk 0 of the embedding.

**Everything needed was already on disk** — all 74,896 rows carry their raw AKN — so this was a
**re-compile, not a re-fetch: 0 requests to the National Archives.**

**74,896 of 74,896 case-law bodies now carry the judgment and no stylesheet**, hand-read **30 of 30
correct against judgments re-fetched live from the National Archives**, with the same three checks
scoring **0 of 30** against the old writer's output. **74,896 of 74,896 dates moved** from the
citation year to the day the judgment was handed down, residual **zero**.

⚠⚠ **And the sprint found something nobody was looking for: the keyword index carried 0 of 74,896
case-law titles.** Last night's title recovery reached the database and stopped there, because
nothing refreshes `corpus_fts` after a backfill. Until this morning **no user had ever seen a
recovered case name.** The index refresh here carries the title, the date and the body together.

⚠ **The meaning-based half is NOT fixed and is still serving the stylesheet.** See §3 and
Decision 1.

---

## §1 — THE SCOPING AUDIT, ON ITS OWN

`scripts/ingest/caselaw-text/audit-caselaw-text.ts`. Writes nothing; re-runnable.

### §1.1 Where the stylesheet comes from — a real document, end to end

Not a rendered HTML form, not the wrong node, not the first text node. It is **every** text node.
`tna-caselaw:[2013] EWHC 803 (Admin):1`, raw AKN 139,567 characters:

| node | begins at |
|---|---:|
| `<meta>` | 200 |
| `<presentation source="#">` | 2,965 |
| `<html:style>` | **2,992** |
| `<header>` | 6,294 |
| `<judgmentBody>` | 11,830 |

Raw, verbatim from byte 2,992:

```
<html:style>
#judgment { font-family: 'Times New Roman'; font-size: 12pt; }
#judgment .Normal { font-size: 12pt; }
#judgment .Heading1 { font-weight: bold; font-family: Arial; font-size: 16pt; }
```

Stored, verbatim from character 0 — this is what was indexed and served:

```
EWHC-QBD-Admin 2013 803 [2013] EWHC 803 (Admin) 0.26.0 1e14932c6af436682aeca23173680e2901ad9904afe…
6.0.2 #judgment { font-family: 'Times New Roman'; font-size: 12pt; } #judgment .Normal { font-size:
12pt; } #judgment .Heading1 { font-weight: bold; font-family: Arial; font-size: 16pt; } …
```

and the judgment, which begins 2,871 characters later **in the same stored body**:

```
Judgment Approved by the court for handing down. Haney Jarvis v SSJ Neutral Citation Number: [2013]
EWHC 803 (Admin) Case Nos. CO/414/2012, CO/4543/2012 IN THE HIGH COURT OF JUSTICE QUEEN'S BENCH
DIVISION ADMINISTRATIVE COURT …
```

⚠ **Note the three things before the CSS**: `EWHC-QBD-Admin`, the citation, and
`1e14932c6af4…` — a build hash. Those are `<meta>` too. Any fix that removes only the stylesheet
leaves them stored as if they were the judgment, which is why §2.1's rule against a pattern match
matters, and why the fix built here cuts more than a CSS-stripper would.

### §1.2 Is the good text still on disk — **RE-COMPILE. No re-fetch. This did not need Charlie.**

| | |
|---|---:|
| `tna-caselaw` rows | 74,896 |
| rows carrying an `r2RawKey` | **74,896 (100.0%)** |
| sampled raw objects present in R2 | 60/60 |
| …that are Akoma Ntoso | 60/60 |
| …that carry `<FRBRname>` | 60/60 |
| …that carry `<judgmentBody>` | 60/60 |
| mean raw object | 89,588 bytes |

The §1 decision gate — "if the answer is re-fetch, stop and report" — **did not fire.**

### §1.3 How wide is it — **one collection, and only one**

60 documents per collection, sampled deterministically (`ORDER BY md5(id||'q3')`), read out of R2
and measured with a source-agnostic CSS-run detector (`shared/style-detect.ts`), not with the
TNA-specific `#judgment` anchor:

| collection | sampled | opens with CSS | CSS anywhere | CSS share of characters |
|---|---:|---:|---:|---:|
| `tna-caselaw` | 60 | **60 (100.0%)** | **60 (100.0%)** | **4.9%** |
| `ni-judgments` | 60 | 0 | 0 | 0.0% |
| `scottish-courts` | 60 | 0 | 0 | 0.0% |
| `et-decisions` | 60 | 0 | 0 | 0.0% |
| `tax-tribunals` | 60 | 0 | 0 | 0.0% |
| `echr-hudoc` | 60 | 0 | 0 | 0.0% |
| `cma-cases` | 60 | 0 | 0 | 0.0% |

**The brief's "200 of 200, so assume the whole collection" is right about `tna-caselaw` and does
not generalise.** The other six have a different writer each and none stores markup as prose.

⚠ **The `scottish-courts` slug problem is NOT the same bug.** The brief asks whether it is the same
writer failure "worth checking together". It is not: `scottish-courts` stores 0 CSS characters in
60 of 60 documents. Its failure is in the **title**, composed from a URL slug — same family (a
display string a rule composed, stored as if it were a fact from the source), different code, and
out of scope here as it was in the names report.

### §1.4 What the rebuild cost — measured, not estimated

| | |
|---|---:|
| documents re-compiled | 74,896 |
| bytes moved (GET raw + GET old + PUT new) | ~10 GB |
| re-compile rate | 22–41 documents/second (concurrency 24) |
| **re-compile wall time** | **~55 min**, in chunks (see §2.3) |
| index refresh, 500-row batches | 14 rows/s |
| index refresh, 2,000-row batches | **47 rows/s** |
| **index refresh wall time** | **29.2 min** for 74,896 rows |
| date sweep (§4) | 172 rows/s, **7.2 min** |
| machine | **this workstation.** Neither job is memory-bound |
| money | **£0** |

⚠ **The standing rule about the rented large-memory box applies to the `createIndex` rebuild, and
that is NOT what this sprint ran.** Re-compiling is a streaming job with a 500-row working set;
refreshing 74,896 index rows is delete-and-append, also streaming. The memory-bound job — the
`fts-index` `createIndex` over 18 M rows, measured four times at 18.0–19.8 GB peak — is **named as
a follow-up for the rented box** (Decision 2) and was not run here, on the serving host or anywhere
else.

### §1.5 What breaks while it runs — **nothing went dark**

- **The re-compile touched no index.** It rewrote R2 bodies and two database columns. Keyword and
  meaning-based search kept serving the old index throughout.
- **The index refresh was staged by construction.** Each batch reads its bodies first, and only
  then deletes and re-adds *those ids*. ⚠ **I used 2,000-row batches, not the 500 I predicted** —
  500 measured 14 rows/s against 47 at 2,000, and 2,000 of ~18 M rows is 0.011% of the index absent
  for under a second, 38 times. The count was checked at the end of every chunk:
  **74,896 before → 74,896 after, five times running, no row lost or duplicated.**
- **A batch whose bodies could not be read is skipped entirely** rather than deleted, so a read
  failure can never turn a stale row into a missing one. 0 batches were skipped.
- **The one thing that does not update by itself** is the deployed `fts-serve`, which calls
  `openTable()` once at boot and holds that snapshot. **Until it is redeployed it keeps serving the
  old rows however well the refresh went.** Decision 3.

---

## §2 — THE WRITER FIRST, THEN THE BACKLOG

### §2.1 The extraction — the document, not a pattern match

`scripts/ingest/shared/akn-text.ts` is the one place a judgment's text comes from, used by the live
writer (`processTnaCaselaw`) and by the backfill, so the two cannot drift.

It selects the **`<judgment>` element without its `<meta>` child.** In Akoma Ntoso `<meta>` is by
definition the non-content metadata block; every other child — `<coverPage>`, `<header>`,
`<judgmentBody>`, `<conclusions>`, `<attachments>` — is the document, and all five are kept.

⚠ **A deny-list of exactly `<meta>`, not an allow-list of the five.** An allow-list silently drops
whatever the National Archives adds next. The shapes were counted before a line was written
(`probe-akn-shape.ts`, 300 documents):

```
<meta> 300/300   <presentation> 300/300   <style> 300/300   <header> 300/300
<judgmentBody> 300/300   <coverPage> 25   <conclusions> 6   <mainBody> 4   <attachments> 4
root child: judgment name=judgment 268 · name=decision 32
style elements outside <meta>: 0
```

⚠ **The earlier recommendation for this fix was `stripAknPreamble()` (INGEST_NAMES D-4) and it is
NOT what was built.** §2.1 forbids solving this with a pattern match and was right to: stripping
the CSS run would have left `EWHC-QBD-Admin`, the citation and the SHA-256 build hash stored as if
they were the judgment.

### §2.2 The checks, and watching each of them fail

| check | watched failing on | result then | result now |
|---|---|---:|---:|
| body guard, over stored bodies | what was in R2 before the sweep | **0 / 200** | **400 / 400** |
| gold phrase + guard, `[2019] UKSC 41` | the same | REFUSED | ACCEPT |
| hand-read against the live source | `rawToText(judgmentXml)`, the old writer | **0 / 30** | **30 / 30** |
| CSS detector, two-sided suite | "always yes" fails 6, "always no" fails 3 | — | 10 / 10 |

**The positive half is a phrase, not an absence.** §2.2 says a check that only tests for the
absence of the bad thing passes on an empty string, so the guard asserts the positive first, and
the gold assertion is that `tna-caselaw:[2019] UKSC 41:1` contains *"a cross party group of 75 MPs
and members of the House of Lords"* — 14 words out of the middle of the reasoning in
*R (Miller) v The Prime Minister*, which cannot occur in a stylesheet, in a metadata block, or in
a truncated extraction.

⚠⚠ **THE GUARD CAUGHT THREE SHAPES MY 300-DOCUMENT CENSUS DID NOT CONTAIN, AND TWO OF THEM WERE MY
OWN BUGS.** 26 documents were refused on the first full pass. Every one was worth the stop:

1. **20 judgments the source publishes as the single word `withdrawn`.** The guard's word floor
   read that as "nothing was extracted". It was faithful. Fixed by giving the guard the source's
   *own* `<judgmentBody>` word count, so "one word" and "one word out of nine thousand" — which
   look identical from the output — are told apart. Both directions are asserted, and the pair is
   what makes it a rule rather than a loophole.
2. **4 anonymised family judgments my CSS detector called a stylesheet.** Anonymisation replaces
   every name with an empty brace pair, so `[2025] EWFC 266 (B)` reads *"1. This case is about { }
   ( "W" ), who was born on { } 2025."* — and my detector counted empty braces as CSS rules. Fixed:
   a run now qualifies only if at least one of its rules has a real `prop: value` body. **The test
   case that used to assert the opposite is now a negative control with the reason written on it.**
3. **2 judgments the National Archives publishes with NO TEXT AT ALL** — `<judgmentBody></judgmentBody>`,
   and `uk:hash = e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855`, which is the
   SHA-256 of the empty string. Refusing these *left a pure stylesheet in place*, which is the
   worst available outcome. They now store an **empty** body, labelled
   `text-route:akn:empty-at-source`.

After those three fixes, all 26 were re-run (`--only-missing`) and stored.

### §2.3 The backlog

`recompile-caselaw.ts`. Reconciles before it reports: every document lands in exactly one bucket,
the buckets must sum to the number attempted, and the run exits non-zero if they do not. **Every
chunk reconciled.** A sample is then read BACK out of R2 and re-checked, because a PUT that returns
200 is not evidence.

**End state, counted over the whole collection rather than by adding up the runs' own tallies**
(`verify-recompile-coverage.ts` — the re-compile ran in six pieces after two background runs were
killed, and three self-reported counters added together is exactly the arithmetic that hides a
gap):

| | before | after |
|---|---:|---:|
| rows | 74,896 | 74,896 |
| carrying `text-route:akn:judgment-minus-meta` | 0 | **74,894** |
| carrying `text-route:akn:empty-at-source` | 0 | **2** |
| **rows with no text-route at all** | 74,896 | **0** |
| stored words | 680,711,377 | **656,751,154** |
| mean words per judgment | 9,089 | **8,769** |
| guard sweep over bodies read back from R2 | 0/200 | **400/400** |

---

## §3 — VERIFIED THROUGH THE PLATFORM, NOT THE DATABASE

### The hand-read: 30 of 30, against the source

⚠ **Against the National Archives, not against our own copy of it.** The obvious version of this
compares the stored body with the AKN already in R2 — the same file the extractor just read, which
can only prove the extractor consistent with itself. `handread-caselaw.ts` re-fetches each
judgment's `data.xml` live and compares against that. Three checks per judgment: the opening 25
words match the source, no stylesheet, a party is named.

- **new text: 30 / 30 right**, 30 of 30 re-fetched successfully
- **old writer, same 30 judgments, same three checks: 0 / 30**

### The keyword half — **fixed, and it fixed the titles too**

| in `corpus_fts`, what keyword search serves | before | after |
|---|---:|---:|
| `tna-caselaw` rows carrying a title | **0 (0.00%)** | **74,883 (99.98%)** |
| rows dated 1 January (the citation year) | 74,066 (98.89%) | **0** |
| returned bodies containing `font-family` | 10 of 10 | **0 of 10** |
| returned bodies containing any CSS run | 10 of 10 | **0 of 10** |

*"was the prorogation of Parliament in 2019 unlawful"* — the same query, before and after:

**BEFORE** — hit 1 of 3, and this is verbatim what a user and Lex were handed as the evidence:

```
(untitled)   [tna-caselaw:[2019] UKSC 41:1]
UKSC 2019 41 [2019] UKSC 41 0.26.19 c08dfb9d3c7e45d2e018e52086a41ff4249f7ed00b927a18959e248d6d36f235
7.4.0 #judgment { font-family: 'Times New Roman'; font-size: 12pt; } #judgment .Normal { font-size:
12pt; } #judgment .Heading1 { font-family: 'Calibri Light';
```

**AFTER**:

```
R (on the application of Miller) v The Prime Minister   [tna-caselaw:[2019] UKSC 41:1]
[2019] UKSC 41 On appeals from: [2019] EWHC 2381 (QB) and [2019] CSIH 49 JUDGMENT R (on the
application of Miller) ( Appellant ) v The Prime Minister ( Respondent ) Cherry and others
(Respondents) v Advocate General for Scotland (Appellant)
stylesheet characters in that body: 0
```

Hits 2 and 3 became *Miller, R (On the Application Of) v The Prime Minister* `[2019] EWHC 2381 (QB)`
and *Liberty, R (On the Application Of) v The Prime Minister & Anor* `[2019] EWCA Civ 1761` — all
three with a name, a judgment snippet and zero stylesheet characters.

⚠ **My stylesheet probe was useless and I had to fix it mid-verification.** It was
`"font-family Times New Roman"`, which BM25 treats as four independent terms — so after a clean
refresh it still returned ten case-law hits, every one matching on *Roman*: "Roman Abramovich v
HarperCollins", "Westminster Roman Catholic Diocese", "Court of Alesd, Romania". A probe a clean
index still answers is not a probe. The probe is now the single token `font-family`, and the
measure is not the hit count but **how many returned bodies actually contain the string: 0 of 10.**

### The meaning-based half — **NOT fixed, and still serving the stylesheet**

Same query, to the deployed vector service, **after** everything above:

```
1. tna-caselaw:[2019] UKSC 41:1   score 0.777   snippet 300 chars
   "UKSC 2019 41 [2019] UKSC 41 0.26.19 c08dfb9d3c7e45d2e018e52086a41ff4249f7ed00b927a18959e248d6d36f235
    7.4.0 #judgment { font-family: 'Times New Roman'; font-size: 12pt; } #judgment .Normal { … } …"
```

The vector layer has its own copy of the text in `corpus_chunks`, built from the old bodies, and
nothing in this sprint rebuilds it. What that costs, measured over 300 documents:

| | |
|---|---:|
| of everything ever embedded for case law, stylesheet | **12.7%** |
| documents whose chunk 0 is more than half stylesheet | **231 / 300 (77.0%)** |
| documents hitting the 8-chunk cap | 242 / 300 |
| judgment text that never reached the embedder because the stylesheet used up the cap | **~2,085 characters (~417 words) per capped document** |
| cost to re-embed the collection, Batch API @ $0.075/1M | **~$31** |

That last row is the one that makes this a decision rather than a task. Decision 1.

⚠ **Separately, and not this sprint's doing:** the vector service returns a **300-character snippet
for `[2019] UKSC 41` at `limit=3` and an empty one at `limit=10`** — the same id, the same query,
a minute apart. Its snippet hydration is inconsistent. Named for the search thread; not touched
here.

---

## §4 — D-3: THE CASE-LAW DATES

Authorised in the brief; run. `sweep-caselaw-dates.ts`, 7.2 minutes.

| | |
|---|---:|
| rows processed | 74,896 of 74,896 |
| **dates moved** | **74,896 (100.00%)** |
| already correct | 0 |
| **residual — source states no date** | **0 (0.00% of the collection)** |
| **residual — no raw object** | **0 (0.00%)** |
| reconciliation | RECONCILES |
| mean move | 176 days |
| largest move | 6,236 days |
| rows dated 1 January before | 74,066 (98.89%) |
| **rows dated 1 January after** | **0 (0.00%)** |
| **rows with no date at all after** | **0** |

*R (Miller) v The Prime Minister* was stored as **2019-01-01** and was handed down **2019-09-24** —
wrong by **266 days**, measured before the sweep and asserted after it.

**There is no residual, so there is nothing a user would see for one.** The 830 rows that carried
*no* date before now carry one.

### ⚠ The sequencing, and why

**Dates first, then the text, then ONE index refresh carrying both.** Reasons, in order of weight:

1. They write **different columns** — `itemDate` versus `wordCount`/`notes` — so neither run can
   lose the other's write, whichever order they go in.
2. The date sweep reads a **32 KB range** of each raw object; the text re-compile reads whole
   objects. Doing dates first means that if the text run has to be repeated — and it was, twice,
   after background runs were killed — the date work is not repeated with it.
3. **One index refresh serves both.** The refreshed `corpus_fts` rows carry the new body, the new
   date and the title in a single pass; running the refresh between the two sweeps would have
   meant doing it twice.

The alternative — folding the date write into the re-compile's pass, which already reads the whole
raw object — would have saved one pass of range reads (about 7 minutes). It was **not** taken,
because §4 asks for the date count and residual reported on their own, and a combined write makes
the two impossible to verify separately.

---

## PREDICTIONS, SCORED

Recorded in `CHANGE_LOG.md` at 05:12 UTC, before the re-compile ran.

| # | prediction | outcome |
|---|---|---|
| 1 | re-compile, not re-fetch; 0 requests to TNA | **CORRECT** |
| 2 | all 74,896 pass the guard; **fewer than 20 refused** | **REFUTED — 26**, and the reasons mattered far more than the count (§2.2) |
| 3 | stored text shrinks 9–10% | **REFUTED as a constant.** The 1,000-row pilot's 9.41% did not hold: per-chunk it ranged **4.88%–16.61%** with document age |
| 4 | `wordCount` falls by roughly 8% | **REFUTED — 3.52%** (680,711,377 → 656,751,154). Stripped CSS is fewer "words" than its character count suggests |
| 5 | `font-family` returns case-law hits before and none after | **HALF WRONG, and the fault was my probe** (§3). Corrected measure: 0 of 10 returned bodies contain it |
| 6 | the meaning-based half stays broken until a re-embed is authorised | **CORRECT** — verbatim CSS still served |
| 7 | ~74,800 dates move, mean ~180 days, residual under 1% | **CORRECT, and better: 74,896 (100%), mean 176 days, residual 0** |
| 8 | dates → text → one index refresh | as run |
| 9 | nothing goes dark; 500-row batches | **nothing went dark; batches were 2,000**, on a measurement (§1.5) |

**Two of nine right as stated, four refuted, one half-wrong through my own instrument.** The
refutations are the useful part: 2 and 5 both found real defects, in the guard and in the probe.

---

## DECISIONS FOR CHARLIE

### 1. The meaning-based half — re-chunk and re-embed case law? **Recommendation: YES.**

| option | cost | consequence |
|---|---|---|
| **(a) re-chunk + re-embed** — recommended | **~$31** Batch API + one `vector-index` heavy-job run (~€1–2, hours) | The 12.7% stylesheet leaves the embedding, chunk 0 becomes the judgment in the 77% of documents where it is currently mostly CSS, and ~417 words per capped document that never reached the embedder do |
| (b) re-chunk only, no re-embed | £0 | Snippets become clean, **but every vector then describes text that is no longer at that chunk index.** A retrieval that matched on one passage would display another. Worse than either endpoint |
| (c) do nothing | £0 | Case-law meaning-based search keeps being computed over, and displaying, a stylesheet. The +12.5 pp gain measured for meaning-based search on case law stays unmeasurable |

The corpus embed was gated at ~$600 and came in at ~$430–520; this is **~6% of one such run**.

### 2. Absorb the un-indexed tail — run the `fts-index` heavy job? **Recommendation: YES, but not urgent.**

The refresh appended **74,896 un-indexed rows** (0 before → 74,896 after). LanceDB brute-force-scans
un-indexed fragments alongside the FTS index on every query. The measured precedent is 1,191,345
un-indexed of 17.7 M taking warm p50 from 4.5 s to 25–32 s; this is **a sixteenth of that**. The
fix is `tsx ../ops/heavy-job/run.ts run fts-index` on the rented box — 18.0–19.8 GB peak, ~9
minutes, **€0.05**. It is the standing rule's own use case and must not run on the serving host.

### 3. ⚠⚠ **NOTHING ABOVE REACHES A USER UNTIL `fts-serve` IS REDEPLOYED.** Recommendation: do this first.

`fts-serve` calls `openTable()` once at boot and holds that snapshot, so it is still serving the
stylesheet bodies and the blank titles. **Railway → project → service `fts-serve`
(`c268ec09-e489-4cfa-837a-7740d95c24c7`, https://fts-serve-production-4cea.up.railway.app) →
Deployments → ⋮ on the latest SUCCESS → Redeploy.** Nothing in Vercel needs touching for this
sprint, which is just as well — the Vercel token here is SAML-blocked and I cannot read it.

### 4. `et-decisions`: 131,654 rows are a landing page, not a decision. **Recommendation: a brief of its own.**

Found by the §1.3 audit, out of scope, and larger in row terms than the bug this sprint fixed:

| `et-decisions`, by `sourceUrl` | rows | median words |
|---|---:|---:|
| the PDF (`assets.publishing.service.gov.uk`) | 161,749 | 159 |
| **the landing page (`www.gov.uk`)** | **131,654 (44.9%)** | **18** |

36 of 40 sampled landing-page bodies begin, in their entirety, *"Read the full decision in Ms A
Walker v Ampulla Ltd: 2406400/2019 - Partial Dismissal ."* — the link text on gov.uk, stored as if
it were the decision. **Same failure class as this sprint's**: a page's furniture kept because the
writer took whatever text it found.

⚠ **And the opposite finding, so nobody over-corrects:** the *short* bodies among the 161,749 PDF
rows are mostly genuine. A withdrawal judgment really is 41 words. Length alone does not identify
this bug — `sourceUrl` does.

### 5. Nothing refreshes `corpus_fts` after a backfill. **Recommendation: make it part of the ingest sprint checklist.**

This sprint only found the missing titles by accident, in a "before" measurement taken for another
purpose. `fts-catchup` appends ids the index lacks and has no concept of a row whose *content*
changed, so **any backfill that rewrites a field the index carries is invisible to users until
someone notices.** `refresh-fts-caselaw.ts` is the pattern; generalising it is a small job and
belongs to whoever owns search.

---

## WHAT IS NOT DONE, NAMED

1. **The meaning-based half of case-law retrieval is still serving a stylesheet.** Decision 1.
   Everything in §3's "after" column is the keyword half only.
2. **The `fts-index` rebuild** — 74,896 rows searchable but un-indexed. Decision 2.
3. **`fts-serve` has not been redeployed**, so as of writing, users still see the old index.
   Decision 3.
4. **`et-decisions`' 131,654 landing-page rows.** Decision 4.
5. **`scottish-courts` and `cma-cases` display titles** — a slug and a composed label stored as if
   they were names. Confirmed here as a *different* bug from this one; still not fixed, as the
   names report also said.
6. **The vector service's inconsistent snippet hydration** (300 characters at `limit=3`, 0 at
   `limit=10`, same id). Not this sprint's code; named for the search thread.
7. **`itemDate` on other case-law collections** was not audited. This sprint's date work was
   `tna-caselaw` only, because that is what D-3 covered.
8. **The 2 empty-at-source judgments now store an empty body.** That is the honest value, but they
   are also not marked `unavailable` in the way `tna-legislation` marks a provision it cannot
   fetch. Using that mechanism would be right and touches a column three threads share, so it is
   reported rather than done.

---

## FILES

**Shared, used by the live writer and the backfill**
- `scripts/ingest/shared/akn-text.ts` — the extraction, the guard, and the source-aware rules
- `scripts/ingest/shared/style-detect.ts` — the source-agnostic CSS-run detector
- `scripts/ingest/workers/process-row.ts` — `processTnaCaselaw`, fixed

**The sweeps** — `scripts/ingest/caselaw-text/`
- `recompile-caselaw.ts` (`--dry-run` `--limit` `--resume` `--only-missing` `--verify`)
- `sweep-caselaw-dates.ts` (`--controls` `--measure` `--apply`)
- `refresh-fts-caselaw.ts` (`--dry-run` `--limit` `--resume` `--batch`)

**The checks**
- `check-style-detect.ts`, `check-caselaw-body.ts`, `handread-caselaw.ts` (`--old-writer`),
  `verify-caselaw-retrieval.ts`, `verify-recompile-coverage.ts`

**The audit and probes** — `audit-caselaw-text.ts`, `probe-akn-shape.ts`, `measure-embed-delta.ts`,
`preview-recompile.ts`, `dump-recompiled.ts`, `probe-refused.ts`, `probe-nobody.ts`,
`probe-fts-titles.ts`, `probe-vector-response.ts`, `probe-caselaw-sizes.ts`,
`probe-et-stubs.ts`, `probe-et-landing-stubs.ts`, `probe-r2-speed.ts`, `probe-query-speed.ts`,
`probe-id-prefix.ts`

---

## THREE THINGS THAT COST TIME, RECORDED SO THEY DO NOT AGAIN

1. **A quadratic regex hung the audit for 12 minutes at 100% CPU.** `/([^{}]*)\{([^{}]*)\}/g` on
   brace-free text retries from every character position. Most of `et-decisions` is brace-free. The
   linear `indexOf` scan gives the identical answer in microseconds.
2. **`WHERE corpus='tna-caselaw' AND id > ''` made Postgres walk the primary key of an 18-million-row
   table**, discarding 6,139,777 rows and 1.5 M block reads before reaching the first judgment —
   35.9 s per batch, and the date sweep ran at **6 rows/second**. Bounding the id range to the
   collection's own slice took it to **158/s**. The bound was verified before use: 74,896 of 74,896
   ids sit inside it, because a bound that is wrong skips rows in silence.
3. **`parseInt(String(Infinity))` is `NaN`,** and a NaN `LIMIT` reaches Postgres as the string
   `'NaN'` on a bigint parameter. Every pilot passed an explicit `--limit` and never touched the
   default, so the first full run failed instantly. The argument parser now refuses a
   non-finite value instead of passing one on.

⚠ **And one about this environment, for the next session:** two long background runs were killed
mid-flight with no error, at 38,500 and 3,500 rows. Both were recoverable only because the sweeps
checkpoint every batch. **Any sweep here that takes more than a few minutes needs a checkpoint and
a `--resume`, or it needs to be run in chunks that fit inside a single foreground call.**
