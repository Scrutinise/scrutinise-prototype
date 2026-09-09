# SCRUTINISE CORPUS — the daily email, rebuilt (V31)

**Part A** is tomorrow's email, filled in with today's real numbers, every collection listed.
**Part B** is the renderer rules that make it impossible for the email to print a tautology again.

Reading rule for the whole email: **every percentage prints the two numbers it is made of beside it.** If a line has no percentage, that is because no denominator exists yet — the word UNMEASURED is the honest answer and the census (Brief C1 Part B) is what turns it into a number.

---

# PART A — tomorrow's email

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
SCRUTINISE CORPUS — 24 Aug 2026, 08:01 BST
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

SEARCHABLE TODAY  (what a user's search can actually reach)
  18,243,806 sections in 71 live collections · 99.998% have a vector · ~6.3 billion words
  Not counted above:
     28,629 sections in 3 RETIRED collections — still being served, duplicates   (to delete)
    914,274 sections in the legacy LegislationSection table — reachable by no search path

COVERAGE — of everything each publisher lists, how much do we hold?
  MEASURED      6 collections   publisher's own list walked; % is a fact
  CLAIMED       4 collections   target differs from held, but nobody can say where the target came from
  DECLARED      0 collections   counted against a scope we wrote down ourselves
  UNMEASURED   61 collections   no denominator yet → NO % is printed
  NOT STARTED  12 collections   target or plan row exists, 0 held
  BLOCKED       1 collection    ssrn (licence)

  The one headline we can prove:
    UK legislation with text at source ........ 77.4%   143,269 held of 185,182 published instruments
    (44.1% if the 139,440 instruments the publisher marks as having NO text are kept in the denominator)

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
CORE A — THE LAW   (legislation.gov.uk · unit = instrument, i.e. a whole Act or SI)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
                                         held /  published    raw    excl.no-text   not held
  M  UK Acts 2000 to date                  933 /      938    99.5%     99.5%            5
  M  UK Acts 1801–1999                   3,560 /   16,622    21.4%     38.1%        5,783   ⚠ 11.4% of held sections are one-word dot-leaders (repealed)
  M  Statutory Instruments (both)      73,558 /  109,190    67.4%     72.9%       27,413   (census splits pre-2010 / 2010+)
  M  Retained EU law                   39,068 /  159,773    24.5%     84.7%        7,082
  M  Devolved + other types            26,150 /   38,099    68.6%     94.1%        1,630   (census prints asp/ssi/anaw/wsi/nia/nisr separately)
  C  impact-assessments                18,756 /   18,759   100.0%     —                3   target provenance unproven
  U  explanatory-notes                 18,651 sections      UNMEASURED                   old target was 410 — 4,549% — meaningless
  U  explanatory-memoranda             21,984 sections      UNMEASURED                   old target was 5,420 — 406% — meaningless
  N  apni  (NI Parliament Acts 1921–72)     0                NOT STARTED                  2,602 inbound citations point here
  N  ukcm  (Church Measures)                0                NOT STARTED                  6,803 inbound citations point here
  N  ukci  (Church Instruments)             0                NOT STARTED
  N  ukla  (Local & Private Acts)           0                NOT STARTED                  no target row exists
  ── WORK LIST TO CLOSE CORE A: 41,913 instruments · scripts/ingest/v36/worklist.jsonl · SEEDING AUTHORISED 23 Aug

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
CORE B — PARLIAMENT   (unit = sitting-day file / publication / item)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  U  pwdata-debates             6,387,304 sections   UNMEASURED   walk: ParlParse scrapedxml index
  U  historic-hansard           4,641,085 sections   UNMEASURED   walk: api.parliament.uk sittings index · overlaps pwdata, not de-duplicated
  U  pwdata-wrans               1,232,999 sections   UNMEASURED
  U  pwdata-lords                 752,805 sections   UNMEASURED
  U  committees-reports           323,922 sections   UNMEASURED   old target 24,876 — 1,302% — meaningless
  U  pwdata-westminster           239,262 sections   UNMEASURED
  U  pwdata-lordswrans            175,592 sections   UNMEASURED   1 failed fetch (HTTP 503, retryable)
  U  committees-evidence          140,567 sections   UNMEASURED
  U  lda-commonsoralquestions      69,529 sections   UNMEASURED   LDA service scheduled for retirement — confirm it still answers
  U  early-day-motions             60,737 sections   UNMEASURED
  U  petitions                     49,529 sections   UNMEASURED   internal estimate ~66,075 (75%) — not a publisher number
  U  pwdata-wms                    23,863 sections   UNMEASURED
  U  pwdata-lordswms               20,932 sections   UNMEASURED
  U  bills-api                      6,535 sections   UNMEASURED
  U  lda-commonsdivisions           5,553 sections   UNMEASURED   duplicates commons-divisions-votes?
  U  members-interests              3,448 sections   UNMEASURED
  U  lords-divisions-votes          3,284 sections   UNMEASURED
  U  commons-divisions-votes        2,361 sections   UNMEASURED
  U  lda-lordsdivisions             2,089 sections   UNMEASURED   duplicates lords-divisions-votes?
  C  erskine-may                    1,873 / 2,038    91.9%        target provenance unproven
  U  written-answers                  143 sections   UNMEASURED   ⚠ 143 rows at ~306,000 words each — whole files stored as one section
  N  commons-library-briefings          0             NOT STARTED  no target row
  N  post-legislative-memoranda         0             NOT STARTED  ~1,235 live inside impact-assessments, not separable

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
CORE C — COURTS   (unit = judgment / decision)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  U  et-decisions                 293,399 decisions  UNMEASURED   ⚠ 131,654 (44.9%) are landing pages, median 18 words — DELETE + RE-FETCH authorised 23 Aug
  U  tna-caselaw                   74,896 judgments  UNMEASURED   2001 onwards · ⚠ 12.7% of embedded text is stylesheet; chunk 0 >50% markup in 77% of judgments
  C  scottish-courts               13,056 / 13,070   99.9%        target provenance unproven
  U  tax-tribunals                 12,089 decisions  UNMEASURED
  U  ni-judgments                   7,772 judgments  UNMEASURED
  U  echr-hudoc                     4,410 judgments  UNMEASURED   UK respondent only
  N  bailii-pre-2001                    0             NOT STARTED  LARGEST KNOWN GAP — retired as "superseded by tna-caselaw", which starts at 2001 · FETCH AUTHORISED 23 Aug
  N  leading-cases (curated)            0             NOT STARTED

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
SUPPORTING — DEVOLVED LEGISLATURES   (unit = sitting / meeting)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  U  scottish-parliament-or     1,043,264 sections   UNMEASURED   absent from the Corpus Plan entirely
  U  niassembly-hansard           196,348 sections   UNMEASURED   absent from the Corpus Plan entirely
  U  senedd-cofnod                191,730 sections   UNMEASURED   absent from the Plan · ⚠ 61.1% carry a wrong inherited heading · Welsh-language bodies unaskable

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
SUPPORTING — GOVERNMENT, REGULATORS, GUIDANCE   (unit = page / document)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  U  quangos-govuk                171,030 sections   UNMEASURED   external-site tail for exempt organisations never scoped
  U  hmrc-manuals                  69,136 sections   UNMEASURED   plan guessed 500,000 — held is 16.7% of a guess
  C  ico                           26,562 / 26,576   99.9%        target provenance unproven
  U  cma-cases                     21,525 sections   UNMEASURED   internal estimate ~22,898 (94%) — not a publisher number
  U  ofgem                         17,143 sections   UNMEASURED
  U  hmrc-codes-guidance           14,067 sections   UNMEASURED
  U  consultations                  7,448 sections   UNMEASURED
  U  ofcom                          4,169 sections   UNMEASURED
  U  fca-handbook                   3,661 sections   UNMEASURED   plan guessed 150,000 — held is 2.4% of a guess
  U  nao-reports                    2,570 sections   UNMEASURED
  U  hmrc-tiins                       791 sections   UNMEASURED
  U  independent-reviews              657 sections   UNMEASURED
  U  ots-reports                      497 sections   UNMEASURED
  U  hmrc-ancillary                   472 sections   UNMEASURED
  U  scotlawcom                       350 sections   UNMEASURED
  U  college-of-policing              332 sections   UNMEASURED   plan guessed 8,000 — 4.2% of a guess
  U  tax-treaties-dta                 324 sections   UNMEASURED
  U  cps-guidance                     270 sections   UNMEASURED
  U  lawcom                           262 sections   UNMEASURED
  U  sentencing-council               253 sections   UNMEASURED   plan guessed 2,000 — 12.7% of a guess
  U  govuk-core-docs                  175 sections   UNMEASURED   one collection standing in for PACE + Codes + Green/Magenta Book + White Papers — split it
  U  inquiry-reports                  140 sections   UNMEASURED
  U  inquiry-evidence                  89 sections   UNMEASURED
  U  planning-policy                   64 sections   UNMEASURED   plan guessed 5,000 — 1.3% of a guess
  U  lgsco                             40 sections   UNMEASURED   1 failed fetch · published is likely tens of thousands, not ~100
  U  building-regs                     21 sections   UNMEASURED   ⚠ 21 rows at ~446 words — Approved Documents are tens of thousands of words: PDF text not captured
  U  nilawcom                          17 sections   UNMEASURED
  N  ofwat                              0             NOT STARTED  never seeded
  N  ofsted                             0             NOT STARTED  never seeded
  N  nhs-contracts-guidance             0             NOT STARTED  no target row ever created
  N  financial-corpus                   0             NOT STARTED  scope never defined — Charlie to define

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
SUPPORTING — EU & INTERNATIONAL
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  U  eur-lex                      241,571 sections   UNMEASURED   old target 90,260 — 268% — meaningless · walk CELLAR
  U  uk-treaties-fcdo              23,372 sections   UNMEASURED
  U  uk-treaties                    3,250 sections   UNMEASURED   duplicates uk-treaties-fcdo?
  U  oecd                             505 sections   UNMEASURED   licence CC-BY, commercial use permitted
  U  parliament-treaties              328 sections   UNMEASURED
  B  ssrn                               0             BLOCKED      author copyright, no open licence — plan row closed
  O  IBFD · OECD Model Tax Commentary · Halsbury's · Westlaw · LexisNexis · HeinOnline   OUT OF SCOPE (private IP)

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
HOLLOW CONTENT   (held, counted, says nothing — excluded from "usable" once flagged)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  legislation dot-leaders        178,826 sections   11.4% of legislation · source's rendering of a repealed provision · keep, flag, never surface as an answer
  et-decisions landing pages     131,654 rows       44.9% of et-decisions · DELETE + RE-FETCH
  tna-caselaw stylesheet chunks  ~12.7% of embedded case-law text · RE-EMBED chunk 0
  written-answers                143 of 143         whole files stored as single sections
  building-regs                  21 of 21           PDF text not captured

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
YESTERDAY
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  Sections added:                 +0
  Core A work list:               41,913 remaining of 41,913  (0 closed yesterday)
  Census walks completed:         6 of 77 collections  (0 new yesterday)
  Ingest service:                 stopped (exit-on-empty) · last heartbeat 07:17 · starts today: 1

QUEUE      pending 0 · claimed 0 · done 5,173 · failed 4   (7-day rolling window — NOT a ledger)
FAILURES   primary-acts-pre-2000 ×2  ukpga/Geo5Sess2/13/4 has no CLML, HTML or PDF at source
           lgsco ×1                  children-s-care-services p109 fetch failed
           pwdata-lordswrans ×1      lordswrans2026-08-11 HTTP 503 — retryable

STORAGE    Neon 18.0 GB · R2 ~38 GB
           ⚠ the "20 GB" this alarm fires against is a threshold we typed, not a wall Neon imposes —
             Neon storage is metered at $0.35/GB-month with no fixed cap (verify plan: Brief C1 A6)
           Core A work list adds an estimated 0.4–0.6 GB to Neon. Pre-2001 case law adds an estimated 1.5–3 GB.
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
CENSUS C1 · renderer reads corpus_census, never corpus_targets.est_sections
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

Legend for the first column: **M** measured · **C** claimed · **U** unmeasured · **N** not started · **B** blocked · **O** out of scope.

As census walks land, **U** rows turn into **M** rows with `held / published  %` in the same columns as Core A. Nothing else about the layout changes. That is the mechanism by which Charlie gets "the total possible number in each section and the % we have ingested" — one walk per collection, one row per collection, same columns every day.

---

# PART B — renderer rules (what the code must do)

### B1. The defect

`scripts/ingest/shared/progress-reporter.ts`:

```ts
if (est != null && compiled >= est) {
  parts.push(`  ✅ ${target.corpus_key.padEnd(38)} ${compiled.toLocaleString()}  [100% complete]`)
  continue
}
```

`est` is `corpus_targets.est_sections`. For 46 of the 62 ticked collections, `est_sections` was **set equal to the compiled count** by `v19-rebaseline-*.ts`, `v20-rebaseline-drains.ts`, `v19-align-p1.ts`, `v19-fix-si-residue.ts`, then stamped `est_is_confirmed = true`. The printed figure is `compiled / compiled`. It is 100% for any corpus including an empty one.

Three further defects in the same branch: no upper clamp (explanatory-notes prints "100%" at 4,549% of target); an empty 7-day-reaped queue is read as completeness; sections and instruments are mixed in one column.

### B2. The replacement

```ts
type CoverageState = 'MEASURED' | 'CLAIMED' | 'DECLARED' | 'UNMEASURED' | 'NOT_STARTED' | 'BLOCKED' | 'RETIRED'

// The renderer reads corpus_census. It never reads corpus_targets.est_sections.
// A percentage is printed ONLY for MEASURED (publisher walk on disk, dated) and
// DECLARED (counted against a scope we wrote in docs/CORPUS_SCOPE.md, labelled as such).
// CLAIMED prints held / target with "provenance unproven". UNMEASURED prints the held
// count and the word UNMEASURED — no number, not 0%, not "unknown%".
// "100% complete" may appear only when state is MEASURED and
//   published_units <= held_units <= published_units * 1.02.
// Held above 102% of published prints "⚠ denominator suspect (N% of published)".
```

Every printed percentage carries its numerator and denominator on the same line. Sections and units never share a column. The footer carries the sprint string `CENSUS C1` so the **production** email can be verified by reading that string off it — a local render is not the deployed email.

### B3. Schema

New table `corpus_census` (DDL via `prisma db execute --file` against the direct Neon URL, `whichdb` first): `corpus_key, state, unit, method, walked_at, published_units, held_units, hollow_units, walk_artifact_path, notes`. `corpus_targets.est_is_confirmed` is not repaired; it is ignored by the renderer and dropped in a later sprint. It meant "a rebaseline script ran", which is a fact about our code, not about the publisher.

### B4. The test that must fail first

Run the renderer against a fixture where `est == compiled` for every collection. It must print UNMEASURED everywhere and `100%` nowhere. Paste that output into `docs/census/` **before** backfilling the six legislation walks; then paste the passing output after. A check that cannot fail is not a check.
