# V36 — THE MISSING INSTRUMENTS: WHAT §1 FOUND

**Executes:** `docs/BRIEF_INGEST_V36_MISSING_INSTRUMENTS.md`
**Stream:** INGEST · **Written:** 12 August 2026

---

## The short version

The brief asked for §1 before §2, and §1 changed §2. Seven things, all measured:

1. **17,261 is the right number for the question it answers, and the wrong number for
   the question we care about.** It is "instruments the legacy `LegislationItem` table knows
   about that have no compiled section in `corpus_sections`". Walking legislation.gov.uk's own
   published set instead — which is what the brief's §1.3 asked for — gives a **larger** gap,
   because the legacy table never knew about most of it.

2. **77,000 sections belong to 9,859 of those instruments, not to all 17,261.** The other
   **7,402 have no legacy text at all** (7,276 of them `ukpga`). Migrating from
   `LegislationSection` could not have recovered them under any plan.

3. **Migrating the legacy text is the wrong route anyway.** On a random n=25 sample of gap
   instruments that DO have legacy text, the live source returned text for **25 of 25**, and
   was **richer than the legacy copy in 11 of 25** — never poorer, never empty. The Companies
   Act 2006 is **2,093 sections at the source against 1,665 in the legacy table**; UK GDPR is
   **140 against 61**. `LegislationSection` is a stale snapshot, and re-fetching costs the same
   fetch either way while landing in the normal pipeline.

4. **A live defect produced part of the gap and would have reproduced it.** `enumerateSections`
   reached TNA through a helper that discards the retryable/deterministic distinction, so a
   429, a 503 or a timeout arrived at the caller looking exactly like a 404. After three such
   non-answers the instrument was stamped `No CLML/HTML/PDF found on TNA` with
   `availability_status = 'no-provisions'` — **a permanent claim about the document, made out
   of one minute's fetch outcome**, and thereafter skipped by the reseed dedup because a row
   existed. **8,583 instruments carry that marker**, every one written during the June 2026
   sweep, and **27.5% of a random sample of them return real CLML on a plain re-fetch today**.

5. **The recoverable population is instruments from 1987 onwards that were never enumerated, and
   nothing else in the work list yields text.** 1987 is legislation.gov.uk's digitisation boundary
   and it was measured, not read off a docs page: `unseen` uksi **0/14 in 1980–86** and **11/12 in
   1987+**. Everything earlier returns CLML declaring `NumberOfProvisions="0"`.

6. **117,667 instruments told users a PDF exists. 0 of 52 sampled had one.** `specialist_queue` has
   one writer, no consumer, and has been `pending` since June. The classification came from a HEAD
   request, and **legislation.gov.uk answers HEAD on `data.pdf` with 405** — a probe that cannot say
   yes. Probe and note fixed; the 117,667 existing rows are not, and that is the next sprint.

7. **The pilot's best-looking instrument was 137 sections of nothing.** `uksi/1999/303` recovered
   137 sections and 4,521 "words", every one of them `1 . . . . . . . .` — how the source renders a
   **repealed** provision. **139 of 210 sections the pilots wrote (66.2%) were dot leaders**, each
   of which would have been embedded at full price and retrievable as a document that says nothing.
   Fixed, retro-fixed, and it forced the recovery estimate down from 16.9 sections per instrument
   to **5.8**.

⚠ **The consequence for the DROP is unchanged and reinforced: `LegislationSection` must not be
dropped yet** — but not because it is the only copy of anything worth keeping. It is a stale
copy. It should be dropped *after* the recovery run, not before, so there is a fallback while
the corpus is being repaired.

⚠ **Three of these seven were found by re-reading a result I had already reported.** The
hand-picked recovery pilot said 6/6 until a random draw said 27.5%; the `unseen` rate said 1.0
until it was run against the real work list and said 0/12; the 1987+ yield said 16.9 sections until
the R2 objects were read back and it said 5.8. **Every one of those corrections came from reading
the artefact rather than the counter**, and that is the method this report would ask to be judged
on more than any single number in it.

---

## §1.1 — Is the gap a coherent set or a scatter?

`corpus_acts` was **rebuilt** first (it was 8 days stale) and reconciles exactly: 250,808 rows,
1,760,981 compiled legislation sections, **0 unattributed**. The gap it reports is 17,261, which
matches what CC-Search reported. Splitting it:

| leg_type | never attempted | attempted, produced nothing | total | legacy sections |
|---|---:|---:|---:|---:|
| `ukpga` | 8,514 | 382 | 8,896 | 31,039 |
| `uksi` | 4,042 | 626 | 4,668 | 34,904 |
| `eur` | 1,769 | 499 | 2,268 | 5,869 |
| `ssi` | 0 | 732 | 732 | 4,083 |
| `eudn` | 0 | 419 | 419 | 1,019 |
| `nisr` | 0 | 198 | 198 | 866 |
| `wsi` | 0 | 58 | 58 | 204 |
| `eudr` | 0 | 21 | 21 | 71 |
| `asp` | 1 | 0 | 1 | 31 |
| **total** | **14,326** | **2,935** | **17,261** | **78,086** |

**It is not a scatter and it is not one systematic failure. It is two, plus a red herring.**

### The `ukpga` shape, and the red herring inside it

Every one of the 8,514 never-attempted `ukpga` is **pre-1963**. For 1963 onwards the
never-attempted count is **zero**. The year histogram is unambiguous: `in_corpus` is 0 for every
year from 1801 to 1962 (one exception, 1916), then 39 of 59 in 1963, and effectively complete
from 1988.

That is the regnal boundary. Pre-1963 Acts are cited by **regnal session**, and
legislation.gov.uk's canonical id follows: the Law of Property Act 1925 is
`ukpga/Geo5/15-16/20`. `LegislationItem` stores the **calendar** id `ukpga/1925/20`. They are the
same Act.

**The corpus already holds 1,610 instruments under regnal ids, carrying 33,231 sections, and not
one of them has a `LegislationItem` row.** Spot-checking against the gap list, matched by section
count:

| gap row (calendar id) | legacy sections | corpus row (regnal id) | corpus sections |
|---|---:|---|---:|
| `ukpga/1925/20` Law of Property Act 1925 | 207 | `ukpga/Geo5/15-16/20` | 245 |
| `ukpga/1894/60` Merchant Shipping Act 1894 | 391 | `ukpga/Vict/57-58/60` | 391 |
| `ukpga/1907/51` Sheriff Courts (Scotland) Act 1907 | 758 | `ukpga/Edw7/7/51` | 776 |
| `ukpga/1908/69` Companies (Consolidation) Act 1908 | 296 | `ukpga/Edw7/8/69` | 410 |

⚠ **The Law of Property Act 1925 is named in the brief as missing. It is in the corpus.** So is
the Merchant Shipping Act 1894. They were counted absent because the audit joined on the id the
legacy table happens to use, and nothing has ever joined the two id spaces.

**This does not make the pre-1963 gap disappear** — see §1.3, where the source's own set is
walked and most of those years turn out to be genuinely thin. It does mean the 17,261 cannot be
read as an instrument count without that join, and neither can any successor number.

---

## §1.2 — Were they attempted?

Two states, and the second is the finding.

### 2,935 were attempted and produced nothing

| TNA said | instruments | of which legacy holds text | legacy sections |
|---|---:|---:|---:|
| `no-provisions` | 2,311 | 2,305 | 11,332 |
| `metadata-only` | 319 | 0 | 0 |
| `pdf-only` | 161 | 2 | 2 |
| `full` | 144 | 144 | 2,565 |

**2,305 of the 2,311 "no provisions" instruments have real text in the legacy table.** Both
cannot be true. The `errorMsg` on every one of them is the same string:
`No CLML/HTML/PDF found on TNA`.

### That string is a fetch outcome wearing a document's clothes

`enumerateSections` has two routes to an `unavailable` row:

- **(a)** the CLML *was* fetched and declares `NumberOfProvisions="0"` → `hasNoProvisions —
  classified as {commencement|revoked|pdf-only|metadata-only}`. A real state of a real document.
- **(b)** nothing came back from `data.xml`, `data.htm` or `data.pdf` → `No CLML/HTML/PDF found
  on TNA`, written with `availability_status` defaulting to **`'no-provisions'`** — the same
  value (a) uses.

From outside the table the two are indistinguishable. Across all seven legislation corpora:

| class | rows | instruments |
|---|---:|---:|
| (a) CLML fetched, declares 0 provisions | 146,372 | 146,372 |
| **(b) nothing came back — a fetch outcome** | **8,583** | **8,583** |

**7,940 of the class (b) instruments have no compiled section anywhere** — `eur` 4,263 ·
`eudn` 969 · `ssi` 924 · `uksi` 812 · `nisr` 500 · `ukpga` 272 · `wsi` 120 · `eudr` 80. Only
2,935 of them are inside the 17,261; the rest were invisible to a `LegislationItem`-keyed audit
because they have no legacy row.

### The source answers for them today

Running the **real ingest code path** (`enumerateSections`, not curl) against instruments the
table says have no text:

```
ukpga/2006/46   Companies Act 2006      2,093 CLML sections   (legacy: 1,665)
eur/2016/679    UK GDPR                   140 CLML sections   (legacy:    61)
uksi/2012/3038  Greenhouse Gas ETS Regs   214 CLML sections   (legacy:   107)
ssi/2015/94     NHS Pension (Scotland)    261 CLML sections   (legacy:   150)
uksi/1991/2768  Building Regulations 1991  75 CLML sections   (legacy:    57)
ukpga/1925/20   Law of Property Act 1925  245 CLML sections   (legacy:   207)
```

⚠ **Those six were hand-picked as the largest, and a hand-picked pilot agrees with whoever
picked it.** On a **random n=40 sample** of the class (b) population, drawn with a fixed seed:

- **RECOVERED 11/40 — 27.5%**, writing 324 sections.
- The other 29 came back `hasNoProvisions — classified as no-provisions/metadata-only`, i.e. the
  CLML **was** fetched this time and genuinely declares no provisions. Re-running does not lose
  them; it **upgrades their marker from a fetch outcome to an honest classification**.
- Recovery rate is not uniform by type — `uksi` 5/6, `ssi` 2/3, `eudn` 1/4, `nisr` 1/6, `eur`
  2/21 — but the per-type samples are single digits and are reported as such, not projected.

### It was not one outage

The 8,583 markers were all written in June 2026, spread across **2,027 distinct minutes**, mean
4.2 per minute, with only 963 of them inside the 70 heaviest minutes. Per SI year the loss rate
sits at a steady **1–2.5%** with no window and no cliff. That is the signature of a per-request
failure probability across the whole sweep, not a single bad hour — which is exactly what a
helper that swallows 429/503/timeout would produce.

---

## §1.3 — Is 17,261 the whole gap? No. It is smaller AND larger than the truth.

The brief said this was the question it most wanted answered, and it was right to. Reconciling
`ukpga` against **legislation.gov.uk's own published set**, walked year by year (221 years,
17,367 Acts) rather than against `LegislationItem`:

| | instruments | |
|---|---:|---|
| published by legislation.gov.uk | **17,367** | the honest denominator |
| corpus holds text for | **4,302** | **24.8%** |
| …of which held ONLY under a regnal id | **1,610** | invisible to a `LegislationItem`-keyed audit |
| absent — class (a), CLML says 0 provisions | 7,257 | see the `pdf-only` finding below |
| absent — class (b), fetch outcome | 272 | recoverable, ~27.5% of them carry text |
| absent — never seen at all | **5,536** | never enumerated, never fetched |

**Both corrections land at once.** 1,610 Acts the 17,261 counts as missing are in the corpus under
their regnal ids — so that number overstates. And 5,536 Acts were never seen by anything, most of
which have no `LegislationItem` row either — so it also understates. The two do not cancel; they
are different populations, and only a walk of the source could separate them.

**Coverage of UK primary legislation is 24.8%, not the 99.12% "reachability" figure that has stood
for two sprints.** Those measure different things — §5 exists because of exactly this.

### The walk finished. Here is the whole of it.

**804 year-feeds, 0 throttled, 324,622 instruments enumerated.** Every doctype
legislation.gov.uk publishes that this corpus targets:

| type | years | published | present | only-regnal | classB | classA | unseen | coverage |
|---|---:|---:|---:|---:|---:|---:|---:|---:|
| `eur` | 69 | 124,855 | 22,980 | 0 | 4,263 | 95,842 | 1,770 | **18.4%** |
| `uksi` | 79 | 109,190 | 73,558 | 0 | 809 | 8,219 | 26,604 | 67.4% |
| `eudn` | 69 | 30,750 | 13,478 | 0 | 969 | 16,303 | 0 | 43.8% |
| `nisr` | 105 | 18,527 | 11,572 | 0 | 500 | 6,413 | 42 | 62.5% |
| `ukpga` | 226 | 17,560 | 4,493 | 1,612 | 259 | 7,279 | 5,529 | **25.6%** |
| `ssi` | 28 | 11,402 | 8,499 | 0 | 924 | 1,947 | 32 | 74.5% |
| `wsi` | 28 | 6,763 | 4,694 | 0 | 120 | 1,941 | 8 | 69.4% |
| `eudr` | 69 | 4,168 | 2,610 | 0 | 80 | 1,478 | 0 | 62.6% |
| `nisi` | 55 | 691 | 673 | 0 | 0 | 18 | 0 | 97.4% |
| `asp` | 28 | 402 | 401 | 0 | 0 | 0 | 1 | 99.8% |
| `nia` | 27 | 236 | 233 | 0 | 0 | 0 | 3 | 98.7% |
| `anaw` | 15 | 44 | 44 | 0 | 0 | 0 | 0 | 100.0% |
| `asc` | 7 | 34 | 34 | 0 | 0 | 0 | 0 | 100.0% |
| **total** | **804** | **324,622** | **143,269** | **1,612** | **7,924** | **139,440** | **33,989** | **44.1%** |

**The corpus holds 44.1% of the instruments its own source publishes.**

⚠ **But read the columns before reading the headline.** 139,440 of the 181,353 absences are
class (a) — the CLML *was* fetched and declares `NumberOfProvisions="0"`. Those are not a fetch
failure; they are instruments legislation.gov.uk holds no provisions for, overwhelmingly `eur`
(95,842) and `eudn` (16,303). **The recoverable work list is 41,913**: 33,989 never seen plus
7,924 class (b) fetch outcomes.

Per collection, which is the shape that matters operationally: `primary-acts-2000plus` **99.5%**,
`regional` **68.6%**, `si-2010plus` **68.6%**, `si-pre-2010` **66.9%**, `retained-eu` **24.5%**,
`primary-acts-pre-2000` **21.4%**. Devolved primary legislation is essentially complete (`anaw` and
`asc` 100%, `asp` 99.8%, `nia` 98.7%, `nisi` 97.4%).

---

## The finding that outgrows the brief: 117,667 instruments carry a promise nobody can keep

`specialist_queue` holds **117,667 rows, every one `pdf-only`, every one `pending`, none newer
than June 2026**. It has exactly one writer — `process-row.ts:214` — and **no consumer anywhere in
the codebase**. Nothing has ever drained it.

That would be a dormant backlog. What makes it a defect is what sits underneath it.

`pdf-only` is assigned when `headRequest('{id}/data.pdf')` returns ok. **legislation.gov.uk answers
HEAD on that path with `405 Method Not Allowed`** — so the probe cannot return true today, and
whatever it returned in June, it was not measuring what it claimed to. Testing the classification
against the source on a **random sample of 52**:

```
0 of 52 have a PDF.
/{id}/data.pdf  →  301  →  /{id}/made/data.pdf  →  404
```

And the note Lex shows a user for one of these instruments read, verbatim:

> *"The text of this instrument exists as a PDF on legislation.gov.uk but has not yet been
> extracted. It is queued for PDF processing."*

**Both halves are false.** The file is not there, and the queue it refers to has no processor. This
is the never-claim discipline broken in the quietest place available — inside an availability note
that only appears when we already have nothing to show.

**Fixed:** the probe is now a ranged GET that follows redirects, checks the content type and
verifies the `%PDF-` magic (legislation.gov.uk honours `Range`, so it costs 1 KB, not the 23 MB the
Companies Act PDF actually is). The note no longer asserts that a PDF exists or that anything is
queued. `headRequest` is left in place, unused, with a comment saying why it cannot be used against
TNA — deleting it invites the next person to write it again.

**Watched failing first** (`v36-check-pdf-probe.ts`, live against the source, 5 cases):

```
old probe:  3/5   — both positive controls FAIL (Companies Act 2006's 23 MB PDF classified no-provisions)
new probe:  5/5
```

⚠ **Not fixed, and it is the largest known unknown in the corpus:** the 117,667 existing rows still
carry the false classification, and 89,129 of them are `retained-eu`. Re-verifying them is 117,667
ranged GETs — about 6.5 hours on the Railway fleet at the TNA budget, no LLM cost. **It is not in
this sprint** and it should be the next one, because until it runs we do not know how many of those
instruments have retrievable text and how many genuinely have none.

---

## §1.4 — Does the legacy text match the source?

n=25, random, drawn from the gap instruments that have legacy text:

| verdict | n |
|---|---:|
| source **richer** than legacy | 11 |
| equal section count | 14 |
| legacy richer than source | **0** |
| source has nothing (legacy is the only copy) | **0** |

**Every one of the 25 fetched. None was a case where migration was the only option.** Where they
differ, the source is ahead — `uksi/1996/476` is 8 legacy sections against 39 at the source;
`ssi/2002/568` is 4 against 20.

**Route: re-fetch, do not migrate.** Migration would import a smaller, older corpus, need bespoke
machinery, and skip the R2 + `corpus_sections` path everything downstream expects.

---

## What was fixed in code

**`enumerateSections` no longer converts a retryable failure into a permanent claim.**
`fetchBinaryWithStatus` was added as the binary twin of the existing
`fetchTextWithStatus`, the retryable flag is now carried through all three format
attempts, and when every format is empty *and any of them failed retryably* it throws
`RetryableSourceError` instead of writing a marker. The worker loop already catches and calls
`markFailed`, so the row lands in the queue as `failed` **with its reason** — visible and
re-runnable — rather than as an invisible, permanent `unavailable` section row.

`processTnaLegislation` also now **retracts** the stale `:unavailable` row when a re-run recovers
real text, so an instrument cannot end up holding 2,093 sections and a row asserting it has none.

**The guard was watched failing first.** `v36-check-retryable-guard.ts` stubs `fetch` and runs
four scenarios. Against the code this replaces it scored **2/4** — the two retryable scenarios
returned `unavailable` exactly as described above — and **4/4** with the fix:

```
PASS  all formats 503 (rate limited)     expected=throw        got=throw
PASS  all formats 500 (upstream error)   expected=throw        got=throw
PASS  all formats 404 (genuine miss)     expected=unavailable  got=unavailable
PASS  CLML returns real content          expected=sections     got=sections
```

The two control scenarios matter as much as the two that fail: a fix that threw on a genuine 404
would have traded one wrong answer for another.

---

## §2 — piloted through the real processor, and the pilot corrected the prediction

The recovery runs through `processRow`, the same function the Railway workers call, so the pilot
exercises the real write path (TNA fetch → R2 raw + compiled → `corpus_sections` upsert → stale
marker retraction). **`ingest_queue` is deliberately NOT seeded yet**: `Ops` restarts `Ingest`
within ~25 minutes of work appearing and `Ingest` runs the *pushed* code, so seeding before the
push would hand the whole work list to the version of `enumerateSections` that turns a 429 into a
permanent "no text" marker — the defect this sprint exists to remove, re-run at scale.

### The correction

The first prediction in `v36-seed-recovery.ts` used a single `unseen` recovery rate of **1.0**,
taken from the n=25 sample in which 25 of 25 instruments fetched. **That sample was drawn from gap
instruments *that have legacy text* — a population selected for having text.** Run against the
actual `unseen` work list, the yield is **0 of 12**.

The reason is in the work list's own shape, which nobody had looked at:

```
ukpga work list 5,808 by decade
1800:1177  1810:1458  1820:1001  1830:945  1840:965   ← 5,546 of 5,808
1850:22  1860:64  1870:41  1880:21  1890:21  1900:21  1910:21  1920:14  1930:28  1950:6 …
post-1963: 3 (all class (b))
```

**95% of the ukpga gap is 1800–1849 local and personal Acts** that legislation.gov.uk lists and
holds no provisions for. A uniform draw measures that stratum and reports it as the whole list.

### Then `uksi` arrived, and it is a different gap entirely

The walk reached `uksi` 1948–2002 mid-sprint. The source publishes **69,483**; the corpus holds
**44,208 (63.6%)**; **24,967 were never seen at all** — and unlike `ukpga`, class (a) is **6**. The
`uksi` absence is almost purely un-enumerated, not fetched-and-empty.

Piloting it split cleanly on one number:

| stratum | recovery | n |
|---|---:|---:|
| `unseen` uksi **1987+** | **91.7%** — mean **5.8 real sections** | 12 |
| `unseen` uksi 1980–1986 | **0%** | 14 |
| `unseen` uksi pre-1980 | **0%** | 12 |
| `unseen` ukpga pre-1850 | **0%** | 12 |
| `classb` ukpga | 16.7% | 12 |
| `classb` mixed types | 27.5% | 40 |

⚠ **The 1987+ row was first written as 100% at a mean of 16.9 sections, and both halves were
wrong.** Both were carried by `uksi/1999/303` — see the dot-leader finding below. With its 137
placeholder sections retracted the instrument holds nothing, so it is not a recovery, and the mean
it was inflating goes with it. Re-derived from `corpus_sections` across all 51 instruments the
pilots touched: **13 with real text, 71 real sections, mean 5.5 overall** (5.8 for the 1987+
stratum alone). The earlier figure came from a counter, and a counter cannot know that what it
counted was dots.

**1987 is legislation.gov.uk's digitisation boundary, and it was measured rather than read off a
docs page** — 0/14 immediately below it, 12/12 immediately above. Everything before it returns CLML
that declares `NumberOfProvisions="0"` and classifies as `metadata-only` or `no-provisions`.

### What that makes the recovery

**The recoverable population is instruments from 1987 onwards that were never enumerated.** Nothing
else in the work list yields text, and now we know why rather than guessing.

Prediction on the work list as it stands (**partial** — the walk has not reached `uksi` 2008–2026,
`eur`, `eudn`, `eudr`, `ssi`, `nisr`, `wsi`, `asp`, `nia`, `nisi`, `anaw`, `asc`):

```
work list                 : 31,057 instruments (unseen 30,496 · classb 561)
  unseen:pre-1987          22,253    0.0%  (n=26)
  unseen:ukpga:pre-1850     5,525    0.0%  (n=12)
  unseen:1987+              2,718   91.7%  (n=12)   ← the whole recall win lives here
  classb:*                    302   27.5%  (n=40)
  classb:ukpga                259   16.7%  (n=12)
expected to yield text    : 2,618 instruments
expected sections written : ~15,183 at 5.8/instrument (range 9,162–77,223 across strata)
expected wall clock       : 5.2 h at the TNA budget
fetch cost                : £0 — legislation.gov.uk is OGL v3.0
```

⚠ **For scale against the brief:** it anticipated ~77,000 sections and a **$12–15** embed. On the
partial work list the measured expectation is **~15,183 sections** — the sections were never where
the instrument count suggested. The embed will be predicted properly against the final list rather
than carried forward from either figure.

⚠ **The ukpga half of this contributes almost nothing to recall, and that is the honest finding.**
Its value is §2's other requirement: **every instrument fetched gets a classified marker**, so
28,000-odd silent absences become known unknowns. The recall win is the 2,718 modern instruments —
and that number will grow when the walk reaches `uksi` 2008–2026 and the `eur` family.

`v36-seed-recovery.ts` carries these as strata and **will not fold an unmeasured one in at an
assumed rate** — it prints UNMEASURED instead. A plausible fill-in is precisely how "77,000
sections" came to be attached to 17,261 instruments.

### ⚠ The pilot's best-looking instrument was 137 sections of nothing

`uksi/1999/303` recovered **137 sections and 4,521 words** — by far the largest yield in the
sample, and the reason the mean was 16.9. Reading the R2 objects back rather than trusting the row
count:

```
     33w  1 . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . .
     33w  10 . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . .
     33w  11 . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . .
```

The source publishes `<Text>. . . . . . . .</Text>` for each regulation: that is how
legislation.gov.uk renders a **repealed** provision in the revised CLML. The pipeline was faithful.
The corpus was not improved — each of those becomes a chunk, embedded at full price and retrievable
as a document that says nothing. Same family as the placeholder that looked like data.

Measured across everything the pilots wrote: **139 of 210 sections (66.2%)** were dot leaders,
concentrated in one wholly-repealed instrument plus 2 stray regulations in another.

**Fixed** (`isRepealedPlaceholder` in `shared/compile.ts`, applied in the CLML branch of
`processTnaLegislation`): such a section is recorded as `status='unavailable'`,
`availability_status='revoked'` with a note — kept as a record that the provision exists and was
repealed, but out of the chunker, the FTS build and the embed. The R2 writes are skipped too.

**Watched failing first**, and the check is weighted toward false positives because the danger is
throwing away real law: **12/14 under a naive "any letter" rule, 14/14 with the two-letter rule.**
The discriminating cases are lettered section numbers — `5A . . . .`, `13E . . . .` — which the
naive rule misses and then indexes as text. ⚠ One case had to be **corrected rather than the rule**:
`1 . . . a . . .` was first asserted as not-a-placeholder, failed, and on inspection the
implementation was right — a lone letter among dot leaders is sub-paragraph `(a)` with its text
repealed.

**Retro-fixed** (`v36-retract-placeholders.ts`): the fix cannot repair what is already stored,
because `processTnaLegislation` short-circuits on `r2Exists(compiledKey)` before reaching the check,
so a re-run skips the instrument. The retraction is its own pass. Applied to what these pilots
wrote: **139 rows flipped, verified by reading back — 139 revoked, 0 still compiled.**

### ⚠⚠ And it is not confined to the recovery: ~9.75% of the INDEXED corpus is dot leaders

The fix stops new ingests writing them. It says nothing about what is already there — so 400 random
already-compiled legislation sections were read out of R2 and run through the detector:

| corpus | dot leaders | sampled | |
|---|---:|---:|---:|
| `primary-acts-pre-2000` | 9 | 40 | **22.5%** |
| `regional` | 18 | 97 | **18.6%** |
| `si-2010plus` | 6 | 76 | 7.9% |
| `si-pre-2010` | 4 | 99 | 4.0% |
| `primary-acts-2000plus` | 2 | 34 | 5.9% |
| `retained-eu` | 0 | 54 | 0.0% |
| **total** | **39** | **400** | **9.75%** |

**Extrapolated over the 1,760,981 compiled legislation sections: ~171,700 sections that are already
chunked, already embedded at full price, and already retrievable as documents that say nothing.**
Nearly a quarter of the pre-2000 primary Acts corpus.

That is larger than everything else in this sprint put together, and it bears directly on search:
those sections occupy candidate slots against real provisions. It also means a share of the
`ABSENT`/`RANKING` counts in the recall diagnosis may be real provisions displaced by empty ones —
**a hypothesis, stated as one**, and testable by re-running `diagnose-recall.ts` after a corpus-wide
retraction.

**NOT fixed, deliberately.** A corpus-wide pass means reading 1.76M R2 objects, which is a
Railway-scale job, and **an extrapolation from 400 samples is not grounds for flipping 171,700
rows** — that is the discipline this sprint has spent all day defending. The tool exists
(`v36-retract-placeholders.ts`, which is report-only unless `--apply`), the number has its
denominator, and the pass is a scoped next sprint.

⚠ **Found, measured, NOT fixed — a different defect in the same family.** `ukpga/Vict/1-2/118` holds
two sections whose entire compiled body is a number:

```
  section-126.   words=1   bytes=1   "1"
  section-2835.  words=1   bytes=2   "28"
  section-27     words=453 bytes=2540 "27 The provisions and regulations for abridging…"
```

No dots, so the repealed-placeholder guard correctly does not touch them. The malformed
`sectionRef`s (`126.`, `2835.`) point at `CLML_SECTION_RX`'s known nested-same-element boundary
problem rather than at the source. **It is a lead, not a diagnosis** — two rows inspected is not a
root cause, and §13 says the hypothesis comes after the bytes. Recorded here so the next sprint
starts from the evidence.

### The new code, proven live

Two of the class (b) instruments recovered, and the log shows the retraction firing on exactly
those two and no others:

```
[pool] ukpga/Geo5/23-24/17: cleared stale unavailable marker
ukpga/Geo5/23-24/17        OK      compiled=   4 unavailable=0
[pool] ukpga/Vict/1-2/118: cleared stale unavailable marker
ukpga/Vict/1-2/118         OK      compiled=   3 unavailable=0
```

Read back from the database rather than from the function's return value, because the point of a
pilot is that a row exists, not that a call returned.

---

## §4's acceptance test — the BEFORE, taken now, with its flag state stated

The brief's acceptance test is the new ABSENT count from `diagnose-recall.ts`. Measured today,
against the live services, at `--limit 16`:

| | IN_TOP_K | RANKING | CANDIDATES | ROUTING | TYPING | **ABSENT** |
|---|---:|---:|---:|---:|---:|---:|
| **dense ON** (`LEX_VECTOR_STREAMS=legislation`, as production) | 12 | 2 | 5 | 0 | 0 | **11 / 30** |
| dense OFF (local default) — negative control | 8 | 4 | 5 | 0 | 0 | 13 / 30 |
| S2C6's figure, 12 Aug | 13 | 5 | 3 | 0 | 0 | 9 / 30 |

⚠ **The first run of this went out with `LEX_VECTOR_STREAMS` unset and would have been reported as
a regression.** `VECTOR_SEARCH_URL` is in `.env`; `LEX_VECTOR_STREAMS` is not, and it is the flag
that actually dispatches the dense leg. The run completed, printed a full table, and
`vector-serve`'s `served` counter stayed at **0** for the whole thing — the dense half never
participated. It was caught by reading that counter, not by anything the harness said.

**A recall measurement that does not state its flag state is not a measurement**, and this is
`docs/CLAUDE.md` §19 arriving through a harness rather than a config file. The number of record for
V36 is **ABSENT 11/30, dense ON**, and the BM25-only row is kept as the control that makes the
dense half's contribution visible (it recovers 2 of the 11).

---

## Instruments built

| file | what it is |
|---|---|
| `scripts/ingest/v36-gap-analysis.ts` | the 17,261 split by attempt state, type, year, legacy text |
| `scripts/ingest/v36-unavailable-census.ts` | class (a) vs class (b) across every legislation corpus |
| `scripts/ingest/v36-classb-timing.ts` | whether class (b) is a property of documents or of minutes |
| `scripts/ingest/v36-probe-fetch.ts` | the real ingest path run against instruments recorded as textless |
| `scripts/ingest/v36-recovery-pilot.ts` | random, seeded, per-type recovery rate with its denominator |
| `scripts/ingest/v36-legacy-freshness.ts` | legacy `LegislationSection` vs the live source, per instrument |
| `scripts/ingest/v36-source-census.ts` | walks legislation.gov.uk's own published set, per type per year |
| `scripts/ingest/v36-reconcile.ts` | the §1.3 reconciliation and the §2 work list |
| `scripts/ingest/v36-seed-recovery.ts` | seeds the work list into `ingest_queue`; dry-run by default |
| `scripts/ingest/v36-attempted-analysis.ts` | attempted-but-empty, split by what TNA actually said |
| `scripts/ingest/v36-recovery-run.ts` | drives `processRow` itself, stratified, DB read back after each |
| `scripts/ingest/v36-verify-writes.ts` | reads the compiled objects back out of R2 — how the dot leaders surfaced |
| `scripts/ingest/v36-dotrot-check.ts` | how much of what the recovery writes is dot leaders |
| `scripts/ingest/v36-retract-placeholders.ts` | the retro-fix, plus `--sample N` for the corpus-wide estimate |
| `scripts/ingest/v36-rederive-yield.ts` | the pilot's yield recomputed from the DB after retraction |
| `scripts/ingest/v36-inspect-thin.ts` | byte-level read when two of my own detectors disagreed |
| `scripts/ingest/v36-check-retryable-guard.ts` | the guard, watched failing first (2/4 → 4/4) |
| `scripts/ingest/v36-check-pdf-probe.ts` | the PDF probe, live against the source (3/5 → 5/5) |
| `scripts/ingest/v36-check-repealed-placeholder.ts` | the dot-leader guard (12/14 → 14/14), weighted to false positives |
| `scripts/ingest/search/corpus-completeness.ts` | §5: reachability is not completeness |

⚠ **`--totals` is not the instrument to reconcile on, and this cost a pass to learn.**
legislation.gov.uk emits `<openSearch:totalResults>` only on year feeds without range buckets.
`ukpga/1925` has it; `uksi/2010`, `ssi/2010` and `eur/2016` do not — precisely the dense years
where a count matters. A first pass recorded 226 `ukpga` years and **zero** `uksi` years. The
reconciliation therefore runs off a full entry walk, which yields the ids themselves and so
supports a diff rather than a comparison of two numbers.
