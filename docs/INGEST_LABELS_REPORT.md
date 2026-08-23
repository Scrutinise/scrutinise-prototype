# INGEST — THE LEDGER, AND LABELS THAT DO NOT DESCRIBE THEIR CONTENT

**Executes:** `docs/BRIEF_INGEST_LABELS.md`
**Written:** 2026-08-23 00:32 UTC
**Code:** `scripts/ingest/labels/*`, `scripts/ingest/sources/senedd-cofnod.ts`,
`scripts/ingest/shared/progress-reporter.ts`, `scripts/ingest/ops.ts`
**Data:** `docs/label_audit.json` · `docs/label_retrieval_probe.json` · `docs/senedd_audit.json`

---

## §4 — THE MEASUREMENT, FIRST

### §4.1 Legislation section titles — 4.6% wrong, and the retrieval cost is ZERO

**n = 240, sampled at random from rows that HAVE a stored title, 60 per collection.** The
adjudicator is the source, not a judgement call: legislation.gov.uk publishes the heading itself,
and for a section it is exactly one thing — the `<Title>` of the `<P1group>` that directly wraps
`<P1 id="section-N">`. So the comparison is stored-title vs published-heading, and the rate is
counted rather than adjudicated.

| collection | rows | titled | % titled | sampled | mismatches | **error rate** |
|---|---:|---:|---:|---:|---:|---:|
| `primary-acts-2000plus` | 147,975 | 55,413 | 37.4% | 60 | 8 | **13.3%** |
| `primary-acts-pre-2000` | 179,435 | 60,730 | 33.8% | 60 | 2 | **3.3%** |
| `si-2010plus` | 287,078 | 47,906 | 16.7% | 60 | 0 | **0.0%** |
| `si-pre-2010` | 489,450 | 85,128 | 17.4% | 60 | 1 | **1.7%** |
| **all four** | 1,103,938 | 249,177 | 22.6% | **240** | **11** | **4.6%** |

Zero fetch failures, zero "no heading at source". Applied to the titled population that is roughly
**11,000 sections carrying a wrong title** — but the per-collection confidence intervals at n=60 are
wide (13.3% is 8/60; its 95% CI runs about 6%–25%), so treat the collection ordering as established
and the absolute counts as indicative.

**⚠ The 4.6% is a rate over TITLED rows, which are 22.6% of these collections. The larger fact is
that 77.4% of legislation sections have no title at all** — the `v28` back-fill joined on
`(gid, sectionNumber)` and the 854,761 schedule/paragraph sub-units have no legacy equivalent.

**THE SHAPE — it is a displacement, inherited, not introduced.**

- **All 11 of 11 mismatches are same-instrument displacements.** The stored title is a real heading
  from that Act or SI, attached to the wrong unit. Zero were foreign to the instrument.
- **It is concentrated in low-numbered sections.** Median section number: mismatch **9**, match
  **18**; 10 of 11 mismatches are at s.30 or below against 140 of 229 matches (61%). Suggestive,
  not established at n=11.
- **The displaced titles are overwhelmingly SCHEDULE crossheadings** — `"Taking of Hostages Act
  1982"` on Criminal Justice Act 2003 s.28, `"Building Act 1984 (c. 55)"` on Education Act 2002 s.6,
  `"Water Act 1989 (c. 15)"` on DMCC Act 2024 s.9. Amendment schedules list the Acts they amend, and
  those list headings have landed on low-numbered sections.
- **Provenance: `scripts/ingest/v28-title-extract.ts`** copied titles out of legacy
  `LegislationSection` joined on `(gid, sectionNumber)`. Its `(array_agg(...))[1]` "one arbitrary
  title per pair" dedup was the obvious suspect and is **NOT the cause** — checked directly: the
  Online Safety Act rows have exactly one legacy row per section number. **The legacy table itself
  is wrong**, and `v28` copied it faithfully. Online Safety Act 2023 legacy sections 1–16 are *all*
  schedule-paragraph headings, while s.100–125 are all correct.

**⚠ THE RETRIEVAL COST IS ZERO, AND THAT IS THE ANSWER TO WHETHER THIS IS URGENT.**

Both arms query the SECTION HEADING ALONE, scoped to the section's own collection, limit 50. The
only difference between arms is whether the stored title matches that heading.

| arm | found | rate |
|---|---:|---:|
| BROKEN (wrong stored title) | 5 of 11 | 45% |
| CONTROL (correct stored title) | 5 of 11 | 45% |
| false positives — the WRONG title alone returns the section | 1 of 11 | 9% |

**Identical.** The reason is in the codebase's own comments, and it makes the brief's premise
("titles are indexed, so this costs retrieval") **wrong as things actually stand**:

- `build-fts-index.ts` line 6: *"index on `body`."* The inverted index covers the body only.
- `fts-query-service.ts` lines 11–12: *"Title-boost only moves rows in tiers that have titles
  (parliamentary/guidance); **it is inert for legislation & caselaw**."*
- The only route by which a heading becomes searchable for legislation is `applyCitationToBody`,
  which prepends `"{Act} {section N} {heading}"` to the indexed body — and **it has fired on only
  ~2 of 50 served legislation rows** (measured across 4 scoped queries, n=200; see §"not done").

So a wrong section title costs nothing in retrieval today because the field is not searched. **What
it costs is DISPLAY, and that cost is certain rather than probabilistic**: the served index carries
`sectionTitle: "Taking of Hostages Act 1982"` on a section whose body is *"Schedule 2 (which makes
provision in relation to the charging or release of persons in police detention) shall have
effect."* That is the label a user reads and the label the model is handed.

**⚠ I CORRECTED MY OWN MEASUREMENT MID-SPRINT.** The first version of the probe queried
`"{heading} {act title}"` at limit 20 and scored CONTROL at 4/11, which read as "section retrieval
is simply weak". It is not: adding `"section N"` puts every one of those sections at **rank 0**.
Naming the Act and the section number turns the probe into a lookup both arms pass, measuring
nothing about the field under test. The number above is from the corrected design.

### §4.2 Senedd headings — 55.2% are wrong, and the source publishes the heading we discarded

**n = 2,915 contributions judged across 12 randomly sampled plenaries**, compared against what is
stored in `corpus_sections` today (not against a simulation).

| | count | rate |
|---|---:|---:|
| stored heading correct | 1,306 | 44.8% |
| **stored heading WRONG** | **1,609** | **55.2%** |
| unjudgeable | 22 | — |

**The source publishes a per-item heading and the parser never looked at it.** Item blocks are
typed, and across the sample they are: `contribution` 2,578, `proceduralText` 262, `subHeading` 154,
`oralQuestion` 122, **`agendaItem` 120**, `voteOutcome` 49, `motion` 32, `amendment` 15,
`footnote` 9, `emergencyQuestion` 1. `senedd-cofnod.ts` treated only `subHeading` (and a `heading`
type that does not occur) as a heading.

So `agendaItem` — *"3. Statement by the Minister for Health and Social Services: Coronavirus
Update"* — was **discarded as a heading AND mis-filed as a speech**, and the running sub-heading was
never reset when the agenda moved on. Every speech under an agenda item with no sub-headings
inherited the last sub-heading of the *previous* item. Real examples from the sample:

| stored heading | the heading the document structure gives |
|---|---|
| `Accessibility of Voting Records` | `10. Short Debate: From service to suffering: RAF veterans and their hidden battle with cancer` |
| `Accessibility of Voting Records` | `8. Welsh Conservatives Debate: Health emergency` |
| `Public Transport` | `2. Questions to the Cabinet Secretary for Social Justice, Trefnydd and Chief Whip` |
| `Disabled People` | `3. Questions to the Senedd Commission` |

That is the mechanism behind GOLD V2's two speeches about oesophageal and stomach cancers filed
under *"Senedd Plenary: The 20 mph Speed Limit"*. **It is not an inheritance quirk; it is a 55%
error rate.**

### §4.3 The Welsh finding — the brief was right, it is our bug

**GOLD V2's conclusion is REFUTED.** The Cofnod publishes every contribution twice:

```
<div class="contributionText">
  <div class="verbatim">     AS SPOKEN — either language
  <div class="translation">  THE OTHER LANGUAGE
```

`contributionEnglish` preferred `translation`, on a premise its own comment stated —
*"English-spoken turns have no translation"* — **which is false**. An English-spoken turn carries a
Welsh translation, and taking it stores the Welsh rendering of an English speech.

**n = 2,050 contributions with both divs and a confident language reading, 12 plenaries:**

| | count | share |
|---|---:|---:|
| `verbatim`=EN, `translation`=CY — spoken in English | 1,639 | **80.0%** |
| `verbatim`=CY, `translation`=EN — spoken in Welsh | 411 | 20.0% |
| ambiguous | 0 | 0% |

| rule | Welsh stored |
|---|---:|
| **current** (prefer `translation`) | **80.0%** |
| naive fix (prefer `verbatim`) | 20.0% |
| **correct** (pick whichever is English) | **0.0%** |

**⚠ "Just take verbatim instead" is also wrong** — it stores Welsh for every turn actually spoken in
Welsh. Neither div is "the English one"; the language has to be decided per div.

Read back out of R2 — what is actually served today — 66 of 96 confidently-classified bodies are
Welsh (68.8%; 36 of 132 sampled were too short to classify).

**A Welsh devolved question was never unaskable in English. We were storing the wrong field.** And
the separate fact for anyone reading later: Welsh *legislation* is unaffected — it is made in
English and Welsh, both authoritative, and we hold the English.

### §4.4 What was built, and what the measurement did not justify

**BUILT — the Senedd writer is fixed, both defects, in `scripts/ingest/sources/senedd-cofnod.ts`:**
language selected per div by a function-word classifier that abstains rather than guesses; and
`agendaItem` treated as a heading that RESETS the sub-heading, with the stored title composed as
`agenda — sub`.

`scripts/ingest/labels/check-senedd-labels.ts` guards it, **with the previous implementation kept
verbatim as its negative control** (`feedback-checks-that-cannot-fail`, eighth shape: when the
defect lives in the code, the break has to BE the code). Measured live, n=5 plenaries, 970
contributions:

```
PASS  CONTROL: the OLD rule stores Welsh for a MAJORITY of contributions
      old rule Welsh 771/970 = 79.5% (must exceed 50% or the control is inert)
PASS  the NEW rule stores Welsh for under 2% of contributions
      new rule Welsh 0 of 970 comparable contributions = 0.0%
PASS  CONTROL: the sample actually contains agendaItem blocks
      51 agendaItem blocks across 5 plenaries — zero would make the heading assertions vacuous
PASS  the NEW walk labels at least as many contributions as the old
      unlabelled: old 22/1294, new 10/1294
PASS  the NEW walk actually changes the heading on a substantial share of contributions
      heading differs on 1284/1294 = 99.2% across 5 plenaries (floor 20%)
PASS  classifyLanguage separates a real Welsh passage from a real English one
PASS  classifyLanguage ABSTAINS on a passage too short to judge
7/7
```

⚠ One of these assertions was itself a check that could not fail in its first draft — it asserted
`headScored > 0`, i.e. that the loop ran. It now measures the change rate it names.

**NOT BUILT, deliberately — the §4.1 sweep.** §4.4 says *"if it is low or unsystematic, report it
and propose a check rather than a sweep."* 4.6%, and a retrieval cost measured at zero, does not
justify 25,000 source fetches. The option is costed under Decision 2.

---

## §1 — THE LEDGER: TWO NUMBERS, BOTH LABELLED

**The contradiction is resolved and neither number was wrong.** This email counts SECTIONS; the
coverage walk counts INSTRUMENTS. One Act can be five hundred sections.

**⚠ But the section denominator was usually the numerator.** `corpus_targets.est_sections` was set,
for most collections, by copying the compiled count once the queue drained and flagging it
`est_is_confirmed = true`. The mechanism is five scripts in the repo —
`v19-rebaseline-final.ts`, `v19-rebaseline-pwdata.ts`, `v20-rebaseline-drains.ts`,
`v19-align-p1.ts`, `v19-fix-si-residue.ts` — each doing a variant of:

```ts
UPDATE corpus_targets SET est_sections = <compiledCount>, est_is_confirmed = true
```

**62 of 77 live collections printed `[100% complete]`, and 46 of those had `est_sections` exactly
equal to their compiled count.** `historic-hansard` est 4,641,085 / held 4,641,085.
`et-decisions` 293,399 / 293,399. The email was asserting *"we have ingested everything we
ingested"*, with a tick and a ✓source-confirmed flag.

So `est_is_confirmed` is no longer rendered as evidence. Provenance is **computed at report time**
from the numbers themselves — `self-referential` (at or below its own numerator), `estimate`, or
`none` — and printed as `⚠ / ~ / ?`. **The instrument line is separate and carries the walk.**

⚠ **The first version of my own fix reproduced the same category error one layer up**: it marked
the six walked collections' SECTION denominators `✓ source-walked`, when the walk counted
instruments. The walk now attaches to the instrument line and to nothing else.

**The new email, verbatim** (rendered by `labels/preview-email.ts`, which calls the real
`buildProgressEmail` — a preview that re-implements the email is a preview of something else):

```
  COMPLETION  (77 corpora, excl. retired):
    ▶ in progress: 15   ○ not started: 5   ⛔ blocked: 1   unsized: 4

  ⚠ THERE IS NO "COMPLETE" COUNT ANY MORE, AND THAT IS THE POINT.
    56 of 77 corpora have a section target that is at or below their own compiled count —
    it was set FROM that count when the queue drained, so it can only ever agree with it. Those
    used to print "100% complete". They now print UNMEASURED, because that is what they are.
    Only 6 collections have been walked against their publisher's own list (walk date 2026-08-12):
      ✓ primary-acts-pre-2000    3,560 of 16,622 published = 21.4% (38.1% excl. 7,279 the source declares have no provisions)
      ✓ primary-acts-2000plus    933 of 938 published = 99.5%
      ✓ si-pre-2010              54,069 of 80,801 published = 66.9% (66.9% excl. 32 the source declares have no provisions)
      ✓ si-2010plus              19,489 of 28,389 published = 68.6% (96.5% excl. 8,187 the source declares have no provisions)
      ✓ regional                 26,150 of 38,099 published = 68.6% (94.1% excl. 10,319 the source declares have no provisions)
      ✓ retained-eu              39,068 of 159,773 published = 24.5% (84.7% excl. 113,623 the source declares have no provisions)
    Every other collection's instrument coverage is UNKNOWN — not 100%, not "probably fine".
```

and per corpus, the two lines side by side:

```
  ▶  primary-acts-pre-2000                    166,290 sections   [⚠ UNMEASURED — the target was set from this count, not from the source]
                                            instruments: 3,560 of 16,622 published = 21.4% (38.1% excl. 7,279 the source declares have no provisions)
  ▶  hmrc-ancillary                               472 sections   [⚠ UNMEASURED — the target was set from this count, not from the source]
                                            instruments: NOT WALKED — no publisher enumeration exists for this source, so coverage is unknown
```

**The storage warning is deleted.** It printed `DB: Neon 18 GB (88.5% of 20GB) ⚠️ WARNING` against a
number invented downstream — the third fictional storage ceiling this project has carried. Replaced
with cost, its source and the date it was checked:

```
  DB: Neon 18 GB = $6.20/month storage (12% of the $50 spending notification)
      rate $0.35/GB-month — Neon Launch plan pricing page, checked 2026-08-16. There is NO storage
      cap on this plan; Neon's enforced ceiling is 16,384 GiB.
```

---

## §2 — THE PLAN NOW ACCOUNTS FOR 100% OF WHAT WE HOLD

**21 plan rows added** to `docs/Legislation_Corpus_Breakdown_v3.xlsx`, covering the **1,981,946
sections** no row named — 89.2% → **100.0%**.

The largest is the entire devolved parliamentary record: Holyrood 1,043,264, Stormont 196,348,
Senedd 191,730. Then `et-decisions` 293,399, `lda-commonsoralquestions` 69,529,
`early-day-motions` 60,737, `petitions` 49,529, `ico` 26,562, and 13 smaller.

**⚠ Every one is UNSIZED by design — column H is left EMPTY.** No publisher enumeration exists for
any of them, and per the brief an honest "unsized" beats a plausible invented number that will be
quoted as fact within a week. Columns Q and S read `UNSIZED — no denominator`; column U reads
`not walked`.

---

## §3 — THE RETIRED COLLECTIONS: STAGED AND VERIFIED, NOT APPLIED

**Why each was retired — all three SUPERSEDED, none for a licence reason.** Stated prominently
because a licence retirement would be a compliance exposure needing a different response:

| collection | sections | retired because |
|---|---:|---|
| `lda-lordswrittenquestions` | 20,500 | *"Retired V16 — content covered by pwdata-wrans bulk XML from TWFY (2001–present)"* |
| `lda-commonswrittenquestions` | 8,000 | *"Retired V16 — content covered by pwdata-wrans bulk XML from TWFY (2001–present)"* |
| `written-statements` | 129 | *"superseded by pwdata-wms/lordswms per-speech corpora (V20 audit)"* |

**The decisions still stand, re-verified through retrieval rather than assumed.** A distinctive
string from a retired row, queried against the superseding collection on the live index:

- Lord Hylton's Hong Kong detainees question → `pwdata-lordswrans` **rank 0** — and richer: the
  retired row is the QUESTION ONLY (337 chars), pwdata carries the answer.
- The April 2021 COVID-status certification statement → `pwdata-wms` **rank 0** — and richer: the
  retired row is a **month BLOB** (26,387 chars, many statements joined by `---`), pwdata is
  per-statement.

**They are reachable by a user today, and that is the correctness problem.** All three map to
display type `DEBATE` in the `parliamentary` tier, which is inside the `debates` stream's scope
(`stream-scopes.ts` excludes only `NON_DEBATE_PARLIAMENTARY`, which does not include them). A
scoped query returns 10 of 10 for each.

Held now:

| collection | `corpus_sections` | `corpus_fts` | `corpus_vec` | `corpus_chunks` |
|---|---:|---:|---:|---:|
| `lda-lordswrittenquestions` | 20,500 | 20,500 | 20,500 | 20,500 |
| `lda-commonswrittenquestions` | 8,000 | 8,000 | 8,000 | 8,000 |
| `written-statements` | 129 | 129 | 994 | 994 |
| **total** | **28,629** | 28,629 | 29,494 | 29,494 |

**Sequencing check: nothing is in flight.** The ingest queue is drained (0 pending), the ops
service is alive and locking normally, and no vector or FTS build is running.

**❌ THE REMOVAL WAS NOT APPLIED — the destructive step was blocked by this session's permission
classifier, and I did not work around it.** Everything up to it is done:

- `labels/remove-retired.ts` — dry-run clean, deletes DB first then the three Lance tables
  (that order matters: `fts-catchup` re-adds any id it finds in `corpus_sections`, so deleting the
  index first would resurrect them on the next run).
- Its refusal guard was **watched failing**: `--self-test` points the preconditions at live
  `pwdata-wrans`/`pwdata-wms` and requires them to refuse. It refused.
- It backs up every deleted row to `labels/retired-removed-backup.json` and **does not touch R2**,
  so the operation is reversible from the dump plus the surviving objects.
- `labels/verify-retired-gone.ts` — the acceptance test, and it does not count rows. Run now,
  against the pre-removal state, it fails **0/3** exactly as it should, with both sides returning
  10 (a run where both sides return nothing is a broken probe, not a successful removal).

**▶ To finish: `npx tsx labels/remove-retired.ts --apply`, then redeploy `fts-serve` and
`vector-serve`, then `npx tsx labels/verify-retired-gone.ts` (must go 0/3 → 3/3).** The redeploy is
not optional: both services hold their Lance tables open from boot, so until they restart they serve
the pre-delete snapshot.

---

## WHAT IS NOT DONE, NAMED

1. **§3's `--apply`** — blocked by the permission classifier (above). Staged, guarded, reversible.
2. **The Senedd backlog sweep.** The writer is fixed; the 713 plenaries / 191,756 stored sections
   are still wrong. ⚠ **The re-parse RENUMBERS ids** — `agendaItem` no longer consumes a `seq`, so
   every later section id in a plenary shifts. `deleteStaleSections` handles the database, but the
   FTS and vector indexes hold the old ids and would need a scoped replace. **That is an index
   change and must be sequenced with CC-Search** (§3's own rule). Cost: ~713 page fetches (~15 min),
   then a re-embed of ~191,756 sections. Not started.
3. **The §4.1 title sweep** — not started, deliberately. See Decision 2.
4. **A guard for §4.1.** I built the audit (`labels/audit-section-titles.ts`, re-runnable) but not a
   CI-shaped check, because there is nothing to regress against until a fix exists.
5. **The `written-answers` collection (143 rows, 43.7M words, mean 305,936 words per row)** is the
   same month-blob defect as `written-statements` and is **NOT retired** — it is live, in the
   `parliamentary` tier, typed DEBATE. The change log already flagged it in V20 (*"272 legacy
   month-blob rows… the tsvector-1MB offenders"*). Out of this brief's scope; named here because it
   is the fourth instance of the pattern §3 exists to remove.
6. **The citation rewrite is missing from most served legislation rows** — CC-Search's file, so
   reported not edited. `buildCitation` is what puts the Act title and the section heading into the
   searchable body; it fired on ~2 of 50 rows in `primary-acts-2000plus` and 0 of 50 in
   `primary-acts-pre-2000` (n=200 across 4 scoped queries — thin, but one-directional). **One cause
   is established and is the regnal/calendar trap again:** the act-title map keys on
   `LegislationItem.legislationGovUkId`, which is the CALENDAR id, while the corpus holds pre-1963
   Acts under the REGNAL id. Measured over all gids in each collection:

   | collection | gids | resolve to an act title | |
   |---|---:|---:|---:|
   | `primary-acts-2000plus` | 938 | 925 | 98.6% |
   | `primary-acts-pre-2000` | 16,622 | 2,329 | **14.0%** |
   | `si-2010plus` | 28,401 | 17,468 | 61.5% |
   | `si-pre-2010` | 80,801 | 42,702 | 52.8% |

   That does not explain the 2000-plus figure, so there is a second cause I did not establish.

---

## DECISIONS FOR CHARLIE

**1. Apply §3's removal?**
▶ **Recommend: yes, apply, then redeploy both serve services.** It is 28,629 sections of duplicated,
poorer-quality material that a user can reach today; the supersession is verified at rank 0 on both
probes; it is backed up and R2 is untouched, so it is reversible.
*If not:* the material stays returnable and the daily email's denominator stays honest about it,
but a user can still be handed a month-blob written statement instead of the per-statement copy.

**2. The §4.1 title sweep — fix ~11,000 wrong titles, or leave them?**
▶ **Recommend: fix, but not as a sweep — fold it into the citation-rewrite work in item 6 above.**
The fix needs a fetch (our stored `raw.xml` is the bare `<P1>`; the writer discarded the
`<P1group>` wrapper the heading lives in), but only **25,000 instruments carry titled sections**, so
one whole-instrument CLML fetch each is ~3.5 hours at the 500ms politeness floor and £0 in API cost.
The same fetch would also supply headings for the 77.4% of legislation rows that have none, which is
worth far more than correcting 4.6% of the 22.6% that do.
*If we do the sweep alone:* we spend 3.5 hours of fetching to correct a display label that costs no
retrieval, and leave the larger gap untouched.
*If we do nothing:* ~11,000 sections keep a wrong label in every result list and every model prompt.

**3. Fix the writer that DISCARDS the heading, so this stops recurring?**
The legislation writer stores `raw.xml` as the bare `<P1>`. The source returns the enclosing
`<P1group>` with its `<Title>` in the same response — we fetch it and throw it away, exactly as the
case-law writer threw away the judgment name.
▶ **Recommend: yes, and before any sweep**, so re-fetched instruments store the heading rather than
needing a third pass. Same order that worked for case-law titles and committee names.

**4. Who owns the citation-rewrite gap (item 6)?**
▶ **Recommend: CC-Search**, since `fts-record.ts`, `citation.ts` and the index build are theirs. The
regnal/calendar half is an ingest-shaped bug in a search-owned file; I have not touched it.
*Consequence if unowned:* section headings remain absent from the searchable field for legislation,
which is why §4.1's retrieval cost measured zero — and it will keep any future title fix from
producing a retrieval gain.

**5. The Senedd backlog re-parse (item 2) — schedule it when?**
▶ **Recommend: after §3's removal and its redeploys land**, so the index is touched once. It needs
CC-Search sequencing for the id renumbering.
*Consequence if deferred:* 191,756 speeches keep a Welsh body (80% of them) and a wrong heading
(55% of them), and no Welsh devolved question is answerable in English.
