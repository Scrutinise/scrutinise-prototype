# V34 — THE POLITICAL-EVIDENCE LAYER: WHAT THE SOURCES ACTUALLY ARE

*2026-08-11 09:15 UTC. Executes `BRIEF_INGEST_POLITICAL_SOURCES.md` §A, §B and §C to the
point where all three are built, piloted against real bytes, measured, and licence-checked.
Nothing is seeded — see "What has NOT happened" at the end, and why that ordering is
deliberate rather than incomplete.*

---

## The one paragraph

All three sources are real, reachable and cheaper than expected. §A was **already built in
V28 and never run**, and re-probing it before trusting it found a bug that would have
ingested **25 of 2,361** Commons divisions while reporting success. §B has a **bulk route**
nobody had looked for — legislation.gov.uk publishes impact assessments as a first-class
legislation type with a per-year feed that also carries the IA→instrument join for free.
§C has no bulk route and is the API path by elimination, at 7,447 documents. One licence
answer is a genuine blocker and it is Public Whip's, not Parliament's.

---

## §A — DIVISIONS

### What was already there, and why it was not working

`sources/division-votes.ts`, `processDivisionVotes`, a licence-map entry and a rate-limit
entry all shipped in V28 (§3, 18 Jun 2026). The seed step never ran. Checked directly
rather than assumed: **0 queue rows, 0 `corpus_targets` rows, 0 sections** for
`commons-divisions-votes` and `lords-divisions-votes`.

That code carried two faults and missed one windfall. All three were found by probing the
live endpoints before touching the file, and all three are now recorded in the source
file's header where the next reader will hit them.

**Fault 1 — the Commons list endpoint is hard-capped at 25.** `queryParameters.take` is
clamped server-side regardless of what is asked for. Measured:

| take asked | Commons returns | Lords returns |
|---:|---:|---:|
| 25 | 25 | 25 |
| 26 | **25** | 26 |
| 50 | **25** | 50 |
| 100 | **25** | 100 |
| 200 | **25** | 200 |

V28's enumerator asked for 100 and then did `if (page.length < take) break`. It would have
taken page 1, seen 25 < 100, stopped, and reported a completed walk of **25 of 2,361
divisions** — a 99% shortfall that looks exactly like success. The replacement breaks on an
*empty* page, dedupes by id, guards against a server that ignores `skip`, and reconciles
the final count against `searchTotalResults`. `--seed` **refuses to run** on an
unreconciled walk rather than seeding a partial universe.

**Fault 2 — `NoVoteRecorded` was being discarded.** The Commons detail payload carries a
third member array beside `Ayes` and `Noes`: the members who sat that day and did not vote.
V28 mapped only ayes, noes and tellers, so absence was indistinguishable from not being a
member — the precise distinction the brief makes a requirement. It is present on every
division sampled across the whole range, so this is not a recent API addition:

| division | date | ayes | noes | NoVoteRecorded |
|---|---|---:|---:|---:|
| 2411 | 2026-07-15 | 330 | 109 | 210 |
| 1809 | 2024-04-30 | 271 | 160 | 215 |
| 1216 | 2022-02-02 | 229 | 302 | 113 |
| 605 | 2019-02-18 | 198 | 137 | 310 |
| 2 | 2016-03-09 | 307 | 57 | 281 |

⚠ **The Lords publishes no equivalent.** A Lords division names only the peers who voted —
159 of roughly 800 eligible on the division sampled. So Lords absence is stored as a
**known unknown** (`divisions.absence_known = false`), never as a measured zero, and the
compiled text says so in words rather than leaving a reader to infer a full House.

**Windfall — the brief's premise about party is wrong, in our favour.** The brief states
that "party affiliations are not recorded in the division lists themselves". That is not
true of the current Commons Votes API: every member record carries `Party`,
`PartyAbbreviation` and `MemberFrom`, and they are the values **as at the division**, not as
at today. Tested against a member who changed party twice — member 172, whose Members API
`partyHistory` runs Labour → Independent (2023-04-23) → Labour (2024-05-28):

| window | division | date | recorded Party |
|---|---|---|---|
| before the switch | 1523 | 2023-04-19 | Labour |
| during the Independent spell | 1809 | 2024-04-30 | **Independent** |
| after the return | 1934 | 2025-02-26 | Labour |

The Members API is therefore a **cross-check for party, not a dependency**, which takes
roughly 2.3M member-history lookups off the critical path. It is still wanted for the Lords
eligible-peer roll, which is the only way to derive Lords absence, and that remains a
separate job.

### The measured universe

Both houses enumerated to completion and reconciled against the API's own total:

| | Commons | Lords |
|---|---:|---:|
| `searchTotalResults` | 2,361 | 3,284 |
| enumerated, unique ids | **2,361** | **3,284** |
| reconciled | ✓ | ✓ |
| pages / wall clock | 95 / 700s | 33 / 359s |
| date range | 2016-03-09 → 2026-07-15 | **1999-11-24** → 2026-07-22 |
| mean member rows per division | 649 | 312 |

**5,645 divisions; ~2,556,897 `division_votes` rows predicted** (Commons 1,532,289 +
Lords 1,024,608). Recorded here so the actual can be scored against it after the drain,
per the predict-measure-commit discipline.

⚠ Commons division ids are **sparse** — 1, 3, 1500, 2412 and 2500 all 404. Walking 1..N
would produce a corpus full of failures; the list walk is the only correct enumeration.

### What is stored, and why it is three things

`corpus_sections` gets one searchable section per division — the roll-call, which is the
retrieval unit. But "your MP voted against; 78% of their party voted for" is an aggregate,
and no amount of BM25 over a roll-call produces a percentage. So three new ingest-side
tables (migration run, additive, idempotent):

- **`divisions`** — one row per division. Title verbatim, plus `bill_title`, `stage` and
  `amendment` as *separate* columns. Charlie's requirement was explicit: a clause of
  interest may sit in a Bill about something else, and the parent Bill's title can be
  actively misleading about what was voted on. Collapsing the three into one string would
  destroy exactly the distinction that makes them worth storing. `context_provenance`
  records that those three are **parsed**, so a parse can never be read as though the API
  had stated it.
- **`division_votes`** — one row per member per division: party and constituency *at the
  date*, `vote` ∈ {aye, no, absent}, teller flag. There is deliberately **no** `not-a-member`
  value: that state is the absence of a row. Giving it a value would make every MP look
  like they skipped every division held before they were elected.
- **`stage_outcomes`** — the "passed without a division" table. `outcome` ∈
  {`divided`, `without-division`, `unknown`} with `method` recording how it was decided.
  This is the one the brief is most insistent about: if only divisions were stored, "no
  division" would be the absence of a row, indistinguishable from "not ingested yet",
  "the API was down" and "our title parse missed". Those are four different things and a
  user is entitled to know which one they are looking at.

### The Bill/stage link — where it actually comes from

Neither votes API names the Bill or the stage, and the Bills API has **no divisions route**
(`/Bills/{id}/Stages/{stageId}/Divisions` and `/Divisions` both 404). So the link is
parsed, from two different places:

- **Commons** — the division title is structured: `Public Office (Accountability) Bill
  Report Stage: Amendment 19`. 10 of the newest 25 titles name a Bill; the rest are SIs,
  motions and procedural questions, which correctly parse to nulls.
- **Lords** — `amendmentMotionNotes`, present on **50 of 50** sampled, gives prose naming
  the mover, the amendment number and the clause: *"Lord Forsyth of Drumlean moved
  amendment 1A, before clause 10, to insert the new clause Legislative competence…"*.
  Richer than the Commons title, so parsed conservatively.

⚠ The Bills API is also **slow** — 30s per call in the probe. Any stage-level backfill must
budget for that; it is not a tight loop.

### Public Whip — flagged, not ingested

The brief wants it as a historical backfill and cross-check, raw records only, no policy
labels. The bulk route exists and is exactly the right shape:
`publicwhip.org.uk/data/votematrix-{1992,1997,2001,2005,2010,2015,2017,2019,2024}.dat`
plus `votematrix-lords.dat`, with `.txt` key files. That covers the pre-2016 Commons gap the
votes API leaves.

⚠ **Its data licence is ODbL, which is share-alike.** Verified at the licence page
(`publicwhip.org.uk/faq.php#legal`), not from a footer: *"an attribution, share-alike
license… if you build on this data, you must also share the result under a compatible open
data license."*

Every other corpus we hold is attribution-only (OGL/OPL) or non-commercial-restricted. This
would be the first to attach an obligation to the **derived database** — potentially to
Scrutinise's own corpus. Not-for-profit is not the same question as share-alike, and this is
Charlie's call rather than an ingest decision. Recorded in `licence-map.ts` as
`odbl-1.0-FLAGGED`, same treatment as the IMF flag. **Nothing currently depends on
resolving it** — the parliamentary APIs already cover Commons 2016→ and Lords 1999→ under
OPL v3.0.

### The constituency feature — ONS licence answered

Checked rather than assumed, as the brief asked. The ONS Postcode Directory is **OGL v3.0**,
with a triple attribution requirement: *"Contains OS data © Crown copyright and database
right [year]"*, *"Contains Royal Mail data © Royal Mail copyright and database right
[year]"*, and *"Source: Office for National Statistics licensed under the Open Government
Licence v.3.0"*.

⚠ **One real restriction: Northern Ireland postcodes (the "BT" prefix) require a separate
licence from Land & Property Services for commercial users.** ONS supplies only an End User
Licence for internal business use. Not a blocker for a not-for-profit civic surface, but it
is a per-jurisdiction condition rather than a blanket OGL, so it needs a decision before any
BT postcode is resolved to a constituency in a public feature.

### Also worth knowing

- `lda-commonsdivisions` (5,553) and `lda-lordsdivisions` (2,089), already in the corpus,
  are **not** a backfill. They are result stubs averaging 16 and 8 words with no `itemDate`
  and no roll-call. They record that a division happened, not who voted.
- The member list is normally `ayeCount + 2` — tellers vote but are not counted in the
  lobby totals. Both figures are kept: the official count to quote, the member list to
  count over. This is not a discrepancy and should not be "fixed".

---

## §B — IMPACT ASSESSMENTS

### The bulk route exists

Following the priority order (bulk → HTML → API) rather than starting at the API found
something the brief did not anticipate. **legislation.gov.uk publishes impact assessments as
a first-class legislation type, `ukia`, with a per-year Atom feed.** That reuses the TNA
pipeline we already run, and each entry carries structured metadata including the join we
would otherwise have had to reconstruct from prose:

```xml
<link rel="alternate" href=".../uksi/2008/2924/impacts/2023/199"/>
<ukm:DocumentStage Value="Post Implementation"/>
<ukm:Department Value="Department for Transport"/>
<ukm:Date Value="2023-08-14"/>
```

— which instrument, at what stage, from which department, on what date. 16 of 21 sampled
carried the instrument link. IAs attach to both SIs and Acts, including old ones
(`ukpga/1967/87` for an abortion-treatment IA).

⚠ **Take the PDF url from the feed; never construct it.** The natural guess
(`ukia2023199_en.pdf`) 404s. The published form is `ukia_20230199_en.pdf`. Two probe
requests were burnt on that.

### Coverage, including its holes

**1,181 IAs across 2005–2026 — and the years are not continuous:**

| 2005 | 2006 | 2007 | 2008–2016 | 2017 | 2018 | 2019 | 2020 | 2021 | 2022 | 2023 | 2024–2025 | 2026 |
|---:|---:|---:|:---:|---:|---:|---:|---:|---:|---:|---:|:---:|---:|
| 1 | 2 | 37 | **none** | 171 | 184 | 165 | 103 | 92 | 108 | 189 | **none** | 129 |

The 2008–2016 and 2024–2025 gaps are recorded as **known unknowns**, in the source file, in
the seeder's `--measure` output and in the `corpus_targets` note. They are a fact about this
source, not a claim that no impact assessments were published in those years. GOV.UK holds
1,932 documents typed `impact_assessment` and is the second route; **the overlap between
the two has not been measured** and that is stated rather than glossed.

⚠ The gov.uk `impact_assessment` type is **noisy** — the newest three at probe time were
HS2 air-quality and noise monitoring reports, which are not impact assessments of
legislation in the sense this brief means. gov.uk items must carry their document type and
must not be presented as equivalent to a `ukia` deposit.

Regulatory Policy Committee: **826 documents** under `filter_organisations=regulatory-policy-committee`,
including an `rpc-opinions` document collection.

### Extraction quality, measured before committing

There is no CLML for `ukia` (`data.xml` 404s) — it is PDF with an HTML wrapper. So
extraction was measured on **21 real IAs spread across every year with content**, not the
newest N, before the route was committed to:

- **20/21 yielded >1,000 chars**; 1 low-yield (scanned); **0 fetch failures**
- mean **120,180 chars** per IA; largest **542,498 chars over 233 pages**
- mean **6.6 of 9** standard proforma fields present

⚠ The proforma score splits by stage, and this is a property of the documents rather than a
defect: `Final`/`Enactment` IAs scored **9/9**, while `Post Implementation` reviews scored
**3/9** because a PIR uses a different template with different headings. A PIR's low score
must not be "fixed".

⚠ At a mean of 120k chars, one row per IA would be a **V33-shaped trap** — the sprint that
undid `eur-lex:32007B0143:1`, a single row holding 760,509 words of which 0.5% was
embedded. IAs are therefore sectioned on the proforma headings with a paragraph-boundary
fallback and a hard 12k ceiling, so a document that does not match the template still gets
split. Piloted end to end:

| IA | stage | extracted | sections | size min/max |
|---|---|---:|---:|---|
| ukia/2007/37 | Final | 70,301 | 9 | 3,664 / 11,992 |
| ukia/2019/175 | Final | 201,843 | 27 | 90 / 11,989 |
| ukia/2023/199 | Post Implementation | 30,439 | 5 | 365 / 11,520 |
| ukia/2026/143 | Final | 156,309 | 17 | 627 / 11,725 |

The sectioning isolates an **RPC opinion as its own section** — *"RPC Opinion: Green rated;
fit for purpose"* — which is the contested-provenance signal the brief specifically wanted
surfaced.

A scanned IA is stored as `availability_status = 'pdf-only'` with the char count in the
note: a classified, reportable gap, never a silent drop.

---

## §C — CONSULTATIONS

### No bulk route, and that was checked first

GOV.UK publishes a search index and a content API, not a corpus download. So this is the
API path **by elimination**, not by default. The enumerator reuses the shape already proven
in `govuk-content.ts` (deep paging verified past `start=84,000`).

### The measured universe

| document type | count |
|---|---:|
| `open_consultation` | 86 |
| `closed_consultation` | 1,059 |
| `consultation_outcome` | 6,302 |
| **total** | **7,447** |

⚠ `content_store_document_type=consultation` returns **0** — it is not a real type on
GOV.UK. Filtering on it produces a silent empty ingest, which is the sort of thing that
looks like "the source is small" for a month.

Coverage reaches back further than expected: the pilot pulled a `consultation_outcome`
opened **2000-10-25**.

### The three things the brief asks for beyond the text

1. **The responding organisation's name as given, verbatim, plus a normalised form.**
   `rawOrganisationName` is never overwritten. Normalisation is deliberately conservative —
   case, punctuation, whitespace, common legal suffixes — and explicitly does *not* do
   acronym expansion, fuzzy matching or register mapping. An aggressive normaliser silently
   merges two real bodies and there is no way back once the raw string is gone; those
   decisions belong in the graph build where a merge can be reviewed.
2. **Individual vs summarised, as a required field.** Every attachment is classified:
   `consultation-document`, `government-response`, `individual-response`,
   `summarised-responses`, `supporting-document`. The compiled text renders each
   attachment *with* its kind, and where responses are published only in summary it says so
   in words. Rendering the titles without their kind would put a department's
   characterisation of what somebody said on the same footing as what they said — the
   specific thing the brief forbids. Unmatched titles fall through to
   `supporting-document` rather than to a flattering guess.
3. **Dates on everything** — `opening_date`, `closing_date`, `first_public_at`, all off the
   content payload. `itemDate` prefers the closing date: that is when the positions were
   fixed.

Committee consultations are **not** duplicated — `committees-evidence` already holds them.

One defect found and fixed in the pilot: `final_outcome_attachments` routinely carries
placeholder entries with neither title nor url, which rendered as blank
`[government-response]` lines — a document that does not exist, presented as the
government's response. Dropped at the parse.

---

## Costs, in full — storage *and* write operations *and* embedding

Estimates from the measured universe, at `INGEST_PLAYBOOK` §1a rates. Ranges rather than
points where a mean is doing the work.

| | §A divisions | §B impact assessments | §C consultations |
|---|---|---|---|
| documents | 5,645 | 1,181 | 7,447 |
| `corpus_sections` rows | 5,645 | ~9,400 (mean 8 sections) | 7,447 |
| mean section size | ~18 KB | ~11 KB | ~7 KB |
| **R2 storage** | ~102 MB → **$0.0015/mo** | ~103 MB → **$0.0015/mo** | ~52 MB → **$0.0008/mo** |
| **R2 Class A writes** | 5,645 | ~9,400 | 7,447 |
| write-op charge @ $4.50/M | **$0.03** | **$0.04** | **$0.03** |
| source fetches | 5,645 detail calls | 1,181 PDFs (~0.9 GB in) | 7,447 content calls |
| Railway egress | negligible | negligible | negligible |
| **Neon storage** | **~500 MB** (2.56M `division_votes` rows + 3 indexes) → **~$0.18/mo** | metadata only, ~3 MB | metadata only, ~3 MB |
| est. tokens to embed | ~25.4 M | ~26 M | ~13 M |

**Totals: ~257 MB R2 (~$0.004/month), ~22,500 Class A writes (~$0.10 one-off), ~500 MB
Neon (~$0.18/month), ~64 M tokens to embed.**

⚠ **The embedding line is the one that is not small, and it is the one I can least
pin down.** 64M tokens is roughly a quarter of the whole `corpus_vec` delta embed currently
in flight. The per-token rate is not recorded in `INGEST_PLAYBOOK` §1a — which prices
Railway, Neon and R2 but not embedding — so I have deliberately given the **token count
rather than a pound figure I would be inventing**. The V33 `--max-cost` mechanism is where
the real rate lives; the embed for these three should be run under the same ceiling.

⚠ Wall-clock, from measured rates: divisions ~56 min single-threaded at 3 workers;
impact assessments are the slow one (1,181 large PDF downloads at 700ms/2 workers ≈ 1.5–3
hours); consultations ~35 min at 500ms/3 workers.

---

## The write path had two bugs a clean build hid — found before the drain, not during it

`tsc` was clean, the pilots all passed, and the structured write path was still broken in two
ways. Both were found by `v34-dv-smoke.ts`, which writes to the **real** `divisions` /
`division_votes` tables, reads back, and deletes what it wrote — the
"built-inert-hides-write-path-bugs" check done *before* 5,645 rows go through it.

**1. The Lords lists every teller twice.** Once in `contents`/`notContents`, and again in
`contentTellers`/`notContentTellers`. Measured on division 3698:

| array | rows |
|---|---:|
| `contents` | 64 |
| `contentTellers` | 2 |
| `notContents` | 95 |
| `notContentTellers` | 2 |
| **total concatenated** | **163** |
| **actual distinct peers** | **159** |

Four members appear in two arrays each. **The Commons does not do this** — the same check on
division 2411 found zero. Concatenating produced a duplicate `member_id` inside a single
division, so Postgres rejected the entire roll-call with *"ON CONFLICT DO UPDATE command
cannot affect row a second time"*. **One duplicate would have failed every Lords division —
all 3,284 of them.** It also double-counted tellers in the compiled text, rendering aye/no
totals above the official ones.

Deduped at the source so the text and the structured rows agree, with the teller flag merged
rather than a second row appended. After the fix the member list matches the API's own
authoritative counts exactly — division 3698 → 64/95, division 19 → 164/168.

⚠ **The two houses differ for a real reason, now documented rather than smoothed over:**
Commons tellers are *excluded* from the lobby totals and appear only in the teller arrays;
Lords tellers are *included* in the totals and appear in both. My earlier Lords figures in
the §A pilot (aye=66, no=97 on division 3698) were the double-counted ones.

**2. `division_date` was interpolated as a bare `''::date` when a division had no date**,
which Postgres rejects outright. Fixed with `NULLIF`, and the smoke test carries a synthetic
null-date division so the case stays covered.

Corrected prediction: the Lords member-row estimate was inflated by roughly the teller count
per division (~4), so **~2.55M rather than 2.56M** — under 1%, but the number to score
against is the corrected one.

---

## What actually happened when it was seeded

Pushed (`6759dea..deddb38`, then the fix as `0ee4158`), Railway redeployed `Ingest` and `Ops`
at 18:36 UTC, and only then were the seeds run — in that order, because Ops starts `Ingest`
as soon as pending > 0 and seeding first would have run Lords rows against the pre-fix worker.

| corpus | predicted | seeded | reconciled |
|---|---:|---:|---|
| `commons-divisions-votes` | 2,361 | **2,361** (95 pages) | ✓ exact |
| `lords-divisions-votes` | 3,284 | **3,284** (33 pages) | ✓ exact |
| `impact-assessments` | 1,181 | **1,181** | ✓ exact |
| `consultations` | 7,447 | **7,448** | ✓ +1 published between the measure and the seed |
| **total pending** | | **14,274** | |

The consultation `+1` is the reconciliation tolerance doing its job rather than a fault: the
search index shifts under a deep walk, which is why the check allows 2% drift and why an
*exact* match was never the test.

### The Lords path, confirmed live — and a source inconsistency it exposed

Lords divisions store cleanly in production: **0 failures**, and the decisive measurement is the
stored member list against the House's own count.

| house | divisions checked | member list == official count | member list == official + 2 |
|---|---:|---:|---:|
| commons | 2,355 | 208 | **704** |
| lords | 136 | **132** | **0** |

That is exactly the shape the fix predicts and the bug would have destroyed. Lords tellers *are*
counted in the totals, so after dedupe the roll-call equals the official figure — **132 of 136
exact, 0 at +2**. Commons tellers are *not* counted, so 704 sit at +2/+2. Had the teller
duplication survived, every Lords division would have failed outright rather than matching.

⚠ **The 10 Lords divisions that do not match are a fault in the SOURCE, not in the storage**, and
the difference is always ±1 — never ±2, which is what makes it clearly not the teller bug:

| division | date | official | stored |
|---|---|---|---|
| 1068 Armed Forces Bill | 2006-11-06 | 60/**227** | 60/**226** |
| 1092 House of Lords Reform (option 4) | 2007-03-14 | 46/**409** | 46/**410** |
| 1112 Serious Crime Bill [HL] | 2007-04-25 | **182**/121 | **183**/121 |
| 1183 Parliamentary Voting System | 2011-02-08 | **262**/266 | **261**/266 |

I assumed a peer listed in both lobbies and checked instead of asserting. **Wrong: there are no
duplicates and no cross-lobby members.** On division 1068 the API reports
`authoritativeNotContentCount: 227` while the `notContents` array it serves holds **226 peers**;
on 1092 it reports 409 against an array of 410. Parliament's own recorded tally disagrees with its
own roll-call, in both directions, on historic divisions.

**This is why both figures are stored rather than one.** `aye_count`/`no_count` is the official
result — the number to quote. The `division_votes` rows are the roll-call — the thing to count
over. Had the schema kept only one, this disagreement would be invisible, and any "78% of their
party voted for" computed from it would silently inherit whichever of the two happened to be wrong.

### The drain, and the first predictions scored against it

`Ops` started `Ingest` at 19:00 UTC and all three sources drain in parallel. **0 failures**, and
`division_votes` carries `absent` rows from the first division, so the `NoVoteRecorded` recovery
works in production and not just in the pilot.

First measured sample (171 divisions, 35 IAs, 138 consultations):

| | predicted | measured | verdict |
|---|---|---|---|
| member rows per division (Commons) | 649 | **648** | ✓ |
| **sections per impact assessment** | **8** | **23.1** | ✗ **out by 2.9×** |
| words per impact assessment | — | 28,628 | — |
| words per consultation | ~1,200 | **307** | ✗ 4× smaller |

⚠ **The impact-assessment section estimate was wrong, and wrong in the expensive direction.**
1,181 IAs × 23.1 ≈ **27,300 sections**, not the ~9,400 seeded into `corpus_targets`. That is why
that row went in as `est_is_confirmed = false`, and it must be re-baselined from the real count
after the drain rather than left as a number that will read as confirmed once nobody remembers.

**Revised costs from the measured rates** (superseding the estimates below, which were built on
the 8-sections figure):

| | §A divisions | §B impact assessments | §C consultations |
|---|---|---|---|
| sections | 5,645 | **~27,300** (was ~9,400) | 7,448 |
| mean section size | ~21 KB | ~7.4 KB | **~1.9 KB** (was ~7 KB) |
| R2 storage | ~119 MB | **~202 MB** (was ~103 MB) | **~14 MB** (was ~52 MB) |
| R2 Class A writes | 5,645 | **~27,300** | 7,448 |
| tokens to embed | ~25 M | **~45 M** (was ~26 M) | **~3.5 M** (was ~13 M) |

**Revised totals: ~335 MB R2 (~$0.005/month), ~40,400 Class A writes (~$0.18 one-off), ~73 M
tokens to embed.** The embedding line moved less than the section count did, because §B grew and
§C shrank against each other — but §B is now two-thirds of it on its own.

---

## THE DRAIN IS COMPLETE — final numbers, and every prediction scored

All 14,274 rows processed. **0 failed rows.**

| corpus | documents | sections | words | reconciled |
|---|---:|---:|---:|---|
| `commons-divisions-votes` | 2,361 | 2,361 | 8,521,953 | ✓ 2,361/2,361 |
| `lords-divisions-votes` | 3,284 | 3,284 | 6,558,318 | ✓ 3,284/3,284 |
| `impact-assessments` | 1,181 | **18,759** | 17,302,731 | ✓ |
| `consultations` | 7,448 | 7,448 | 2,098,490 | ✓ |
| **total** | **14,274** | **31,852** | **34,481,492** | |

`division_votes`: **2,528,032 rows** — 1,061,541 aye, 1,067,572 no, **398,919 absent**.
Commons `absence_known` on all 2,361; Lords on 0 of 3,284, as designed.
Bill titles parsed on 1,617 of 2,361 Commons and **2,968 of 3,284 Lords** divisions.
Impact assessments link to **1,049 distinct instruments**.

**Predictions scored:**

| prediction | actual | verdict |
|---|---|---|
| 5,645 divisions | 5,645 | ✓ exact |
| ~2,556,897 `division_votes` | **2,528,032** | ✓ within 1.1% |
| 649 member rows per Commons division | 648 | ✓ |
| **8 sections per impact assessment** | **15.9** | ✗ out by 2× |
| *(mid-drain revision: 23.1/IA → ~27,300)* | *18,759* | ✗ **that revision was also wrong**, in the other direction |
| ~64 M tokens to embed | **~46 M** | over-estimated |

⚠ **I revised the IA estimate mid-drain off an early sample and the revision was wrong too** —
23.1 sections/IA measured on the first 35 documents, 15.9 across all 1,181. Early IAs drain in feed
order, not in size order, so a partial sample is not a small version of the whole. `est_sections`
is now **re-baselined to the real 18,759 with `est_is_confirmed = true`**; both the original 9,448
and the 27,300 revision are recorded in the `corpus_targets` note so neither can be mistaken for a
measurement later.

**Revised-again costs, from the completed drain:** ~250 MB R2, ~31,900 Class A writes (~$0.14
one-off), ~500 MB Neon (~$0.18/month, almost all `division_votes`), **~46 M tokens to embed**.

### Three classified gaps, surfaced rather than dropped

`impact-assessments` holds 3 sections with `status = 'unavailable'`: **2 scanned image-only PDFs**
(`pdf-only`, with the extracted char count) and **1 PDF the feed advertises that the source 404s**
(`no-pdf`, with the URL and status). Each is a countable, reportable absence rather than a missing
row — which is the whole point of the classification.

### And one more bug, found by the reconciliation rather than by a failure

The queue read `consultations done=7448` against **7,446 sections**. Two rows short, and nothing
had failed.

Both had been SIGTERM'd mid-write by my own mid-drain redeploy — `attempts: 2`,
`lastError: "reclaimed by ops — process SIGTERM or crash"`. The write order is `r2Put` **then**
`upsertSection`, so a process killed between the two leaves **the R2 object present and the
metadata row absent**. On retry the `r2Exists` short-circuit saw the object, marked the row `done`,
and the section was never written. The queue then reconciles as complete while the corpus is
quietly short — a silent hole that looks exactly like success.

The gov.uk content for both still returns HTTP 200 with `details`, so nothing about the source was
wrong; only the resume logic was. **Both processors now require the R2 object AND the
`corpus_sections` row before skipping.** `processDivisionVotes` already did the equivalent against
the `divisions` table, which is why not one division was lost to the same redeploy.

⚠ **This is the argument against pushing mid-drain**, which I did and should not have. It cost a
container restart and put two rows in a state only a reconciliation would have caught.

---

## What has NOT happened, and why

**Nothing is seeded.** That is the playbook's own ordering, not an unfinished job:
`INGEST_PLAYBOOK` §8 — *"A NEW sourceType must be seeded POST-PUSH, never before"*.
`impact-assessments` and `consultations` are new sourceTypes, and `division-votes`, while it
already exists in the deployed worker, now writes structured rows that the deployed code
knows nothing about. Seeding any of them before the push would have workers process rows
with the old processor and mark them `done` — which is worse than not seeding, because a
`done` row does not come back.

**So the immediate next actions, in order, after `commit-all.sh` pushes and Railway
redeploys:**

1. `npx tsx scripts/ingest/seed-rate-limits.ts` — registers the two new sources.
2. `npx tsx scripts/ingest/v34-seed-division-votes.ts --seed` (5,645 rows; refuses on an
   unreconciled walk).
3. `npx tsx scripts/ingest/v34-seed-impact-assessments.ts --seed` (1,181 rows).
4. `npx tsx scripts/ingest/v34-seed-consultations.ts --seed` (7,447 rows).
5. After each drain, the matching `--verify` — attempted-vs-stored, not a SUCCESS line.

**Also not done, and deliberately left rather than half-built:**

- **`stage_outcomes` is created but empty.** Populating it needs a Bills API stage crawl at
  30s per call, and the match from a parsed division title to a Bill stage is fuzzy. Writing
  `without-division` rows off a fuzzy match would manufacture exactly the false certainty
  the table exists to prevent. The schema records `method` so that when it is populated the
  basis travels with the row.
- **Lords absence** needs the Members API eligible-peer roll at a date. Until then
  `absence_known = false` says so.
- **The gov.uk IA route and RPC opinions** are measured (1,932 and 826) and licence-cleared
  but have no seeder — the `ukia` bulk route is strictly better and should drain first so
  the overlap can be measured against something real.
- **`docs/POSITION_GRAPH_DESIGN.md`, referenced by the brief as what consumes all this,
  does not exist in the repo.** Flagging rather than guessing at its contents — the storage
  decisions above were made from the brief's own text.

---

## Files

**New:** `migrations/create-division-votes.ts`, `sources/impact-assessments.ts`,
`sources/consultations.ts`, `v34-seed-division-votes.ts`,
`v34-seed-impact-assessments.ts`, `v34-seed-consultations.ts`,
`v34-political-state-check.ts`, and the four probes
(`v34-divisions-probe{,2,3,4}.ts`, `v34-ia-consult-probe.ts`, `v34-ukia-probe.ts`,
`v34-ukia-pdf-quality.ts`) with their raw payloads under `docs/v34_probe/`.

**Changed:** `sources/division-votes.ts` (rewritten), `workers/process-row.ts`
(structured division writes + two new processors), `shared/licence-map.ts`,
`seed-rate-limits.ts`.

**Deleted:** `v28-seed-division-votes.ts` — superseded, never run, and carrying the 25-cap
bug. Left in place it is a script someone could run.

`tsc --noEmit` clean over `scripts/ingest` apart from the documented pre-existing errors
(`diag-db`/`run-cleanup` `@prisma/adapter-pg`, `test-fca-playwright` `playwright`,
`v26-pooled-smoke`/`search/*` rootDir).
