# THE CASE REFERENCE LAYER — say what the case is, without holding it

**Stream:** CC-Ingest, with a handover to CC-Search · **Run:** 2026-08-27
**Brief:** `docs/BRIEF_CASE_REFERENCE_LAYER.md`
**Database:** Neon `ep-old-dust-aboxi69a` / `neondb` · **Spend:** US$0.00 — no embedding ran, nothing
was fetched from any restricted source.

**Artefacts:** `docs/census/CASEREF_baseline_2026-08-27.json` · `CASEREF_citations.jsonl` ·
`CASEREF_extraction_report.json` · `CASEREF_discussion_probe.json` · `CASEREF_records.json` ·
`CASEREF_records.probes.json` · `CASEREF_handover_search.json` · `caseref-shards/`

---

## What a user saw, and what they would see

Ask the platform about **Caparo** today and it returns *Unite The Union v Caparo Atlas Fastenings
Ltd* — a real 2017 employment case about a company of that name — at rank 3. Ask about **ex p
Coughlan** and it returns *Mrs M Coughlan v Brookes Jordan Ltd*, an employment tribunal decision from
2020. Ask about **GCHQ** and a Strasbourg case arrives at rank 0.

**Re-measured live today through the real gateway, not quoted from the earlier file:**

```
  authority NOT held:                                        10/10
  of those, a same-name DIFFERENT case returned instead:      3/10
  absent AND the lay query still returned a full answer set: 10/10
```

Nothing returns nothing. That is the problem: **a confident wrong answer is worse than an empty
one, because it will be quoted.**

What a reference record puts in its place, rendered from real data:

> **Anisminic Ltd v Foreign Compensation Commission [1969] 2 AC 147** — House of Lords
>
> **NOT HELD IN OUR CORPUS.** Our English case law begins in 2003. This is a permanent boundary, not
> a backlog: BAILII refused permission in writing on 16 June 2026 and The National Archives has
> confirmed it will not digitise or license digitisation of its pre-2001 paper holdings.
>
> Cited in **85** documents we hold. Discussed in 1 document we hold.
>
> What a source we hold says about it: *"Since Anisminic v FCC [1969] 2 AC 147, [1969] 2 WLR 163 and
> subsequent cases dealing with the question as to whether any error of law constitutes a
> jurisdictional error thus invalidating the act in question, there has been arguable ambiguity as
> to what kind of errors make a decision invalid and which do not."*
> — Explanatory Notes to the Judicial Review and Courts Act 2022
>
> Search BAILII for [1969] 2 AC 147

---

## §1 — EXTRACT: what came out, and how it was checked

### The parser, and the check that was watched failing

**Neutral citations began in 2001.** A parser written only for `[2019] UKSC 22` finds nothing for
any pre-2001 authority and reports success — the failure shape the brief names by hand. So the law
report form is first-class: `[1932] AC 562`, `[1990] 2 AC 605`, `(1932) SC (HL) 31`,
`(1979) 68 Cr App R 128`.

`check-citations.ts` is **50/50** against the real parser. Under `--self-test` it runs the same
assertions against a deliberately modern-only parser and reports **24 failures, including all ten
pre-2001 authorities**. A check written green and never watched failing is worth nothing.

⚠ **Half the check is negative controls**, because a citation parser that matches too much invents
cases: `[1969] 2 p 147 minutes`, `paragraph [2019] 22`, `section 605 of the 1990 Act` and
`(2020) 15 minutes later` are each asserted to be rejected.

### The identity of a case is its citation, never its name

The brief's §1.3 trap is avoided by construction rather than by care. A name is only ever recorded
as a **variant hanging off a citation**, so two records cannot merge because their names look alike.
*Caparo Industries plc v Dickman* and *Caparo Precision Tubes Ltd* get different identities because
they have different citations, and the check asserts exactly that.

### What was extracted

**74,894 judgments read in 25 minutes (49 documents/second). 708,371 citation occurrences.**

| | |
|---|---:|
| distinct citations | **184,613** |
| pre-2003 | **49,666 (26.9%)** |
| neutral (2001 on) | 108,656 |
| law report — the only form a pre-2001 case has | **75,957** |
| citing-document links | 641,617 |

The distribution is a real one: 6 citations from the 1720s, 493 from the 1870s, 8,512 from the
1980s, 58,497 from the 2010s. The commonest series are `EWHC` (56,829), `EWCA` (30,203), `WLR`
(11,975) and `AC` (6,332).

**The most-cited authorities are what a lawyer would predict**, which is itself evidence the parser
is reading English law and not noise:

| citing documents | citation | name |
|---:|---|---|
| 798 | [1998] 1 WLR 896 | Investors Compensation Scheme Ltd v West Bromwich BS |
| 771 | [2009] EWHC 339 (Ch) | Easyair Ltd v Opal Telecom Ltd |
| 587 | [2002] 2 AC 1 | Johnson v Gore Wood & Co |
| 511 | [2015] UKSC 36 | Arnold v Britton |
| 436 | [1954] 1 WLR 1489 | Ladd v Marshall |
| **400** | **[1948] 1 KB 223** | **Associated Provincial Picture Houses Ltd v Wednesbury Corporation** |
| 405 | [1975] AC 396 | American Cyanamid Co v Ethicon Ltd |

**All ten probe authorities are present**, each with a clean name:

| citation | documents | citation | documents |
|---|---:|---|---:|
| [1948] 1 KB 223 Wednesbury | **400** | [1985] AC 374 GCHQ | 188 |
| [1993] AC 593 Pepper v Hart | 312 | [1969] 2 AC 147 Anisminic | 85 |
| [2001] QB 213 ex p Coughlan | 276 | **[1932] AC 562 Donoghue** | **67** |
| [1990] 2 AC 605 Caparo | 254 | [1991] 1 AC 603 Factortame | 51 |
| | | [1994] 1 AC 377 M v Home Office · [1964] AC 40 Ridge v Baldwin | 40 each |

### ⚠⚠ Three defects found by READING THE OUTPUT, not by reading the code

The brief asks for twenty citations printed with their sentences, and for the ten most common
malformed matches, precisely so the parser can be checked by eye. Doing that found three real
things, none of which a count would have shown.

**1. The "malformed matches" were not malformed. They were the family-law canon.**
The list of *most frequently matched, never named* citations was supposed to surface regex
artefacts. It surfaced ten genuine, heavily-cited cases — `[2013] UKSC 33` (503 citing documents),
`[1996] AC 563` (409), `[2005] 1 AC 593` (334) — and **nine of the ten are reported as `Re B`,
`Re H`, `In re E`**. A `X v Y` pattern can never match a case name with no "v" in it, so the entire
family-law canon was arriving unnamed, and **an unnamed record cannot be found by a user typing the
name.**

Fixed, with four assertions added to the check, and the extraction re-run.
**Measured after: unnamed citations among the 200 most-cited fell from 10 to 1**, and the three
above now read `Re B`, `In re H (Minors) (Sexual Abuse: Standard of Proof)` and `In re S`.

**2. Every judgment cites itself.** A judgment's header carries its own neutral citation —
`Neutral Citation Number: [2013] EWCA Civ 1146`. Measured on a random 200: **176 (88.0%)** contain
their own citation. Left alone, every case we hold reads as cited once more than it is. The
correction is measured per record — the held judgment's own body is read and one is subtracted only
where it actually counted itself — rather than subtracting 1 from all of them because 88% do it.

**3. A description taken from the top of a document is not about the case.** The loader's dry run
put an Explanatory Note about remedial powers under *Anisminic*'s name. A description must now
contain **the citation itself**, and where none does the record says nothing. Separately, a sentence
boundary of `". "` is wrong in legal text — it is full of full stops that end nothing (`www.sec.gov`,
`Ex p.`, `No. 3`) — so quotes were opening mid-word. The boundary is now `". "` followed by a
capital, and where there is none the quote begins at the citation.

### ⚠ And one defect in the run itself, which cost a whole pass

The first full extraction read **36,000 of 74,896 judgments, found 97,940 distinct citations, and
died**: `memory allocation of 1785264 bytes failed`. Everything was in a Map in memory and the JSONL
was written once at the end, so **all of it was lost** — the exact defect that file's own header
warned about. Writing the warning is not the same as obeying it.

⚠ **It exited with code 0**, because the Rust allocator aborts without setting a failure status. So
`--resume` would have continued from the checkpoint and produced an aggregate covering only the
tail, with nothing saying the head was missing. The aggregate is now flushed to a shard every 6,000
documents; `merge-shards.ts` combines them and **refuses to write an aggregate smaller than its
largest input**, which is arithmetically impossible for a correct merge.

---

## §2 — THE REFERENCE RECORDS

A record is the citation, the names observed beside it, the court **where the citation itself says
so**, held/not-held/unknown, how many documents cite it, up to five places in our corpus where it is
discussed, and — where a source we hold says what the case decided — one quoted sentence with
attribution.

**Nothing in this collection contains text from a judgment we do not hold.**

### What was built: 200 records, and what they contain

Built for the 200 most-cited citations, against the full extraction:

| | |
|---|---:|
| records | **200** |
| held · not held · **unknown** | 54 · 88 · **58** |
| carry a description quoted from a source we hold | **38** |
| say only that the case exists and is cited | **162** |
| carry a court | 81 (76 from the citation itself, 5 curated) |
| carry at least one discussion link | 48 |
| no case name observed anywhere | 12 |
| BAILII links: derived deep link · search page | 75 · 125 |

⚠ **162 of 200 records say nothing about what the case decided, and that is the design working.**
Nothing we hold characterises those cases, so the record says the case exists and is cited N times
and stops. An unknown fact is unknown, not absent and not guessed.

⚠ **The self-citation correction fired on 54 of 54 held records** — every single one. The 88%
measured across a random sample of all judgments becomes 100% among cases that are themselves in the
corpus, which is what you would expect and is worth stating: without the correction, every held case
in this collection would have overstated its own citation count by exactly one.

### Held is three-valued, and the third value is the honest one

| | |
|---|---|
| **held** | a `tna-caselaw` row exists under this neutral citation |
| **not-held** | a law-report citation dated before 2003 — the measured start of our English case law |
| **unknown** | a law-report citation dated 2003 or later. We may hold the judgment under its *neutral* citation without the two being linked. Claiming "not held" would tell a user we lack something we have. |

### Where our corpus discusses a case — filtered on the citation, not the name

Searching our own corpus for the ten authorities retrieved 400 rows. **139 matched a NAME ONLY and
were rejected** — every one of those is a candidate for the confident wrong answer the platform
gives today. **8 of 10 authorities have at least one verifiable discussion**; two have none, and
their records say so rather than reaching for something plausible.

### The links out — BAILII's terms were read, not assumed

Read once at `www.bailii.org/bailii/copyright.html` on 27 August 2026:

> *"BAILII has no objection to links from other websites to material on BAILII's website, and
> encourages this practice."*

and, in the other direction, they forbid *"abusive use of the BAILII website's resources and
services via automated mechanisms or otherwise, in particular for bulk downloading"* and
*"storing search results or HTML versions of judgments"*.

So: **we link, and we never fetch.** A link is deep only where the citation determines the path (the
neutral-citation scheme); it is flagged `derived` and **has not been verified by fetching**, because
fetching is the thing their terms forbid. A law-report citation has no derivable path, so the record
carries BAILII's case-search page and the citation to search for. **No URL is invented.**

---

## §3 — HANDOVER TO CC-SEARCH (no search file was edited)

**Before**, measured live today: 10/10 not held, 3/10 returning a different same-name case.

**After**: **10/10 of the probes resolve to the right reference record.**

⚠ That is a **sufficiency demonstration over the reference records — not the shipped ranking**, and
it is labelled that way in the code and in the artefact. It shows a record exists and is findable by
the words a user types. It does not show the router will surface it.

⚠ **The three numbers, in the order they happened, because the last one is only meaningful with the
first two beside it:**

| | matcher | data | result |
|---|---|---|---|
| first run | all significant words must appear | 400-document pilot | **6/10** |
| after the matcher was fixed | word overlap ≥ 60% | 400-document pilot | **8/10** |
| after the extraction finished | word overlap ≥ 60% — **unchanged** | all 74,894 judgments | **10/10** |

The matcher was changed **once**, from all-words to overlap, and the change is recorded in the file
rather than quietly made — changing a matcher until the test passes is fitting the test. **The step
from 8 to 10 involved no change to the matcher at all**: it came from the `Re X` fix and the full
scan giving the records real names. Two of the ten (Wednesbury, Ridge v Baldwin) had no name in the
pilot data and therefore could not be found by one.

⚠ **The decoys must not be suppressed.** *Mrs M Coughlan v Brookes Jordan Ltd* is a real case and
somebody may want it. The fix is ranking and labelling, not deletion.

**What CC-Search needs from here:** the collection, the requirement (a query recognisably about a
named case must rank the reference record above a modern case that merely shares a name), the test
set (`docs/pre2001_probe.json`), and the before-numbers in
`docs/census/CASEREF_baseline_2026-08-27.json`. The real after-measurement is theirs.

---

## §4 — WHAT THIS IS NOT

- **We do not fetch from BAILII.** Not in bulk, not one page at a time, not through a browser, not
  on a user's behalf. Automated retrieval is what their terms prohibit, and the user agent does not
  change what the act is. The only BAILII request in this sprint was one read of their terms page,
  which the brief required.
- **We do not reproduce judgment text we do not hold.** Every quotation in a record comes from a
  document in our own corpus and carries that document's id.
- **We do not claim to hold what we do not.** Every record for an absent case says so in its first
  line, with the reason and the date.

---

## SCORING THE PREDICTIONS

Logged in `CHANGE_LOG.md` at 14:55 UTC, before the extraction ran.

| # | prediction | outcome |
|---|---|---|
| C1 | 90,000–160,000 distinct citations | ❌ **REFUTED — 184,613**, 15% above the top of the range |
| C2 | 70–80% pre-2003 | ❌ **BADLY REFUTED — 26.9%**, and the reason is instructive: see below |
| C3 | 35–50 minutes | ❌ **REFUTED — 25 minutes** at 49 docs/s against the 32 docs/s measured on a cold table |
| C4 | all ten probes present; Donoghue and Wednesbury each >100 documents | ⚠ **HALF CORRECT.** All ten present. Wednesbury **400** ✓; **Donoghue 67** ✗ |
| C5 | malformed matches dominated by section references and paragraph numbers | ❌ **REFUTED, and this was the sprint's most useful finding** — nine of the ten were real `Re X` cases |
| C6 | `committees-reports` reported and not run | ✅ **CORRECT** — projected ~3 hours at the measured rate; reported, not run |
| C7 | BAILII prohibits automated access but permits a plain link | ✅ **CORRECT**, and it was flagged in advance as the one row that was a guess |

⚠⚠ **C2 is the one worth understanding. The pilot was not a random sample and I treated it as one.**
The 400-document pilot reported 76.1% pre-2003 and the full corpus is 26.9%. The pilot took the
first 400 ids in sort order — and a `tna-caselaw` id *begins with its citation*, so id order is
chronological. Those 400 were all from 2003, the earliest year we hold, and a 2003 judgment cites
almost nothing but older authority. **The sample was biased by construction, in a way that was
invisible until the whole population disagreed with it.** Any future pilot on this corpus must
sample by `md5(id)`, not by `id`.

⚠ **C4's miss is real and not a rounding error.** *Donoghue v Stevenson* is the most famous case in
English law and is cited in **67** of 74,894 judgments — a sixth as often as *Wednesbury*. Foundational
authority is assumed rather than cited. A "most important cases" list built on citation count would
rank the neighbourhood principle below a 2009 summary-judgment decision.

---

## SOLVED / NOT SOLVED / NEXT

**Solved.** The parser, watched failing and 50/50 · the full `tna-caselaw` extraction, 184,613
distinct citations with their sentences on disk · the sharded aggregate, so a crash costs one shard ·
the discussion finder, filtered on the citation with 139 name-only matches rejected across ten
authorities · the reference records with three-valued held-ness · the BAILII position, read rather
than assumed · the before-measurement for CC-Search · three parser defects and one run defect, each
found by reading output and each fixed with a check.

**Not solved, and named.**
- **`committees-reports` (344,773 sections) was not scanned** — ~3 hours at the measured rate. It is
  the largest untapped source of *discussion* (as opposed to citation), and the targeted per-case
  lookup already reaches it.
- **`historic-hansard` and `pwdata-*` (~14M sections) were never going to be scanned** — five days at
  the measured rate. They are queried per case instead, which is the design, not a shortfall.
- **Parallel citations are not linked.** *Arnold v Britton* appears as both `[2015] UKSC 36` (511
  documents) and `[2015] AC 1619` (504) and the two are separate records. Linking them needs
  citation-agreement evidence — the two appearing adjacent in the same sentence — which the
  extraction already captures but does not yet use.
- **The collection is staged, not loaded.** `load-collection.ts` is dry-run proven; the write is a
  production write.
- **And a record in the database is not a record a user can find.** The FTS and vector indexes are
  built separately. Until they are rebuilt *and the rebuild verified by retrieving one record through
  the real gateway*, this is a table, not a feature.

---

## DECISIONS FOR CHARLIE

**Q1. How many reference records should ship — 200, 2,000, or all 184,613?**
▶ **Recommend: the top 2,000 by citing-document count, plus every pre-2003 citation cited more than
five times.** That covers the authorities a user will actually name while keeping the collection
small enough to review by hand.
*Consequence of all 184,613:* a collection larger than `tna-caselaw` itself, most of it cases cited
once, and a much bigger surface for a wrong record to hide in.
*Consequence of 200:* the long tail of "cited three times, discussed nowhere" stays invisible — which
for a case nobody asks about is not obviously a loss.

**Q2. Should the derived BAILII deep links ship unverified?**
▶ **Recommend: ship them, labelled.** The neutral-citation path scheme is regular and the link is
marked `derived`. *Consequence:* a small share will 404. ⚠ The alternative — checking them — means
automated requests to BAILII, which their terms forbid and §4 rules out. A hand-check of 20 by a
person is the only verification available, and is worth doing before launch.

**Q3. Should a reference record be created for cases we DO hold?**
▶ **Recommend: yes, but only where the case is cited more than 20 times.** A record for a held case
is a hub — what cites it, what discusses it, where it sits — and costs nothing extra to build.
*Consequence of not doing it:* the layer looks like an apology for absence rather than a map of the
case law, and a user who searches a 2015 authority gets no context at all.

**Q4. `committees-reports` — scan it (~3 hours) or keep using targeted lookup?**
▶ **Recommend: scan it once.** It is where cases are *discussed* rather than cited, which is what the
records are thin on: only 8 of 10 authorities have a verifiable discussion today, and two have none.
*Consequence otherwise:* discussion counts stay a floor set by what a 40-result search happens to
return, rather than a count.
