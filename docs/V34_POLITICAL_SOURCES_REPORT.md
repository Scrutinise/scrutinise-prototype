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
