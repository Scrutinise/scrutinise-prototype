# STAGE 2D SPRINT 1 — THE ENTITY SPINE AND THE OBSERVED EDGES

**Executes:** `docs/BRIEF_GRAPH_2D1.md` (build steps 1 and 2 of `POSITION_GRAPH_DESIGN.md` §8)
**Written:** 11 August 2026
**Status:** the committees sweep is COMPLETE (48.3 min, 0 gaps); the interests sweep must be RE-RUN
(see defect 3 below). Session paused here at Charlie's request with nothing running and nothing
billing — verified: no Hetzner server exists, no sweep process is writing.

**Headline counts, read back from the tables:** 85,941 entities (39,766 organisations · 46,175
people) · 163,052 edges · 178,832 evidence rows · **100% of edges carry evidence** · 30.6% of
entities rest on a stable external key.

**Prediction vs actual**, recorded before the run: predicted 143,986 items at source and ~162,000
submitter mentions; actual **143,674 items (99.8%) and 184,693 mentions (+14%)**. 140,315 of 140,567
held items attached (99.8%); 0 windows failed.

**Generated counts:** `docs/POSITION_GRAPH_2D1_TABLES.md`, produced by
`scripts/ingest/position-graph/report.ts` reading the tables back. This file is the argument; that
file is the evidence.

**The finding that shapes the sprint, in one line:** every identity this sprint needs is **already
structured at the source and was simply not carried into our columns** — so this is a metadata
sweep, not an extraction problem, and **no LLM was used anywhere.**

---

## §1 — What the corpus actually holds. Bytes before hypotheses.

### 1a. The collections

| corpus | sections | compiled |
|---|---:|---:|
| pwdata-debates | 6,391,345 | 6,387,304 |
| historic-hansard | 4,641,117 | 4,641,085 |
| pwdata-wrans | 1,235,159 | 1,232,894 |
| pwdata-lords | 754,546 | 752,805 |
| committees-reports | 344,773 | 323,922 |
| pwdata-westminster | 240,582 | 239,262 |
| pwdata-lordswrans | 176,099 | 175,560 |
| **committees-evidence** | **142,315** | **140,567** |
| pwdata-wms | 24,962 | 23,863 |
| pwdata-lordswms | 21,463 | 20,932 |
| members-interests | 3,448 | 3,448 |
| inquiry-evidence | 90 | 89 |

⚠ The brief describes committees evidence as "322k sections across the committees corpora". The
measured split is **142,315 evidence + 344,773 reports = 487,088**, of which the *evidence* — the
part where organisations state positions in their own words — is 142,315. The larger number is
reports, which are the committee's voice, not the submitters'.

### 1b. Which structured columns are populated

| corpus | rows | sectionTitle | speaker | itemDate | parentDocId |
|---|---:|---:|---:|---:|---:|
| pwdata-debates | 6,391,345 | 99.9% | 89.1% | 100.0% | 100.0% |
| historic-hansard | 4,641,117 | 100.0% | 64.2% | 99.9% | 100.0% |
| committees-reports | 344,773 | 94.6% | **0.0%** | 94.6% | 100.0% |
| **committees-evidence** | **142,315** | **88.0%** | **0.0%** | 98.8% | 100.0% |
| members-interests | 3,448 | 100.0% | 100.0% | 97.1% | 100.0% |

### 1c. Question 1 — is the submitting organisation carried in structured metadata?

**In our database: no. Not at all.** `speaker` is **0.0% populated** across all 142,315
committees-evidence rows, and `sectionTitle` is the *inquiry*, not the submitter — the processor
writes `{committeeBusiness.title} — {internalReference}`, e.g. `My Science Inquiry — MSI0007`. The
separator is present on **125,303 of 125,303** titled rows (100%), so the format is uniform; it just
does not contain an organisation.

**At the source: yes, fully structured.** The committees API carries `witnesses[]`, each with
`organisations[] {name, role, idmsId, cisId}` and a `submitterType`. Measured on 40 written and 40
oral items sampled from ids we hold:

| | written | oral |
|---|---:|---:|
| carry `witnesses[]` | 40/40 (100%) | 35/40 (87.5%) |
| carry an organisation | 33/40 (82.5%) | 31/40 (77.5%) |
| identify the inquiry (by id) | 40/40 (100%) | 40/40 (100%) |
| identify the committee | 40/40 (100%) | 40/40 (100%) |
| flagged `anonymous` | 0 | 0 |
| `submitterType` | Organisation 33, Individual 7 | Individual 69, Organisation 34 |

⚠ **`submitterType: 'Individual'` is not missing data.** A witness with no organisation because they
submitted in a personal capacity is *correctly* attributed. Reading 82.5% as "17.5% unattributed"
would invent a gap, and the sweep therefore writes a **person** edge in those cases rather than
recording an absence.

⚠ **And a correction to my own first measurement, because it nearly travelled.** The first run of
this probe reported **oral-evidence inquiries at 0.0%**. That was a defect in the probe, not a gap in
the source: evidence items do not carry a `businesses` field (that is the *Publications* field);
written evidence carries `committeeBusiness` (an object) and oral carries `committeeBusinesses` (an
array). Reading the wrong key made a source that identifies **every** inquiry look like one that
identifies none — which would have redirected the whole sprint. Fixed, re-measured, 100% both ways.

### 1d. Question 2 — can a submission be joined to its inquiry and committee?

**Yes, by a stable numeric inquiry id.** Every sampled item carries `committeeBusiness.id` with
`type.isInquiry`, and the committee by name. Written evidence additionally carries `submissionId`,
`internalReference`, and `anonymous` / `anonymousWitnessText` flags.

### 1e. Question 3 — for oral evidence, are witnesses named separately from their organisations?

**Yes.** A witness object carries `name`, `personId`, `submitterType` and `memberInfo` **alongside**
`organisations[]`, and the organisation carries the witness's `role` in it ("Chair", "Head of
Policy"). Oral items average **2.6 witnesses each** (103 across 40 items), so the person→organisation
→inquiry triple is fully available and is stored as two edges plus a role rather than flattened.

### 1f. Hansard — a member ID, or only a name string?

**In our database, a name string only**, and no row looks like an ID (0 of 50,000 sampled
`pwdata-debates` speaker values match an id pattern; 2,738 distinct values, dominated in the sampled
region by early-20th-century names — the sample is physical-order, not random, and is labelled that
way).

**At the source, an ID exists and we discarded it.** The TWFY XML for one recent sitting day
(`debates2026-07-16b.xml`, 542 `<speech>` elements) carries:

```
×542 id   ×542 colnum   ×542 time   ×542 url
×539 speakername   ×534 person_id   ×488 type   ×8 nospeaker
```

`twfy-pwdata.ts` parses `speakername` and nothing else. **`person_id` is present on 98.5% of
speeches and is a stable publicwhip person key**, which is the difference between name-matching
8.8 million speeches and joining them.

### 1g. Members' interests — the person → organisation → category triple

- **person:** `member.id` — the **Parliament member ID** — on **100%** of sampled interests, with
  `nameDisplayAs`, `house`, `memberFrom`, `party`. Our corpus keeps the name and drops the id.
- **category:** `category.id` + `number` + `name`, structured.
- **organisation:** in **named fields**, not prose — `DonorName`, `DonorCompanyName`,
  `DonorCompanyUrl`, `DonorStatus`, `PaymentType`, `Value`, `ReceivedDate`.

So the triple is fully recoverable deterministically. Our own rows encode person and category in
`sectionTitle` as `{member} — {category}` and the counterparty only in the R2 body text.

### 1h. ⚠ The report-before-building answer

The brief said: *"If organisation names turn out to be text-only, the extraction problem is much
larger than the design assumes, and that changes the sprint — say so rather than starting an LLM
pipeline this brief does not authorise."*

**They are not text-only.** All three sources carry structured identity; our ingest dropped it
because it was fetching bodies, not building a graph. That makes this sprint the same shape as
`v34-bills-metadata.ts` — a metadata sweep joined on `parentDocId` — and the cost is API time, not
tokens. **Total LLM spend for this sprint: zero.**

**And one measurement decided the sweep's cost.** The API's *list* endpoints carry the same witness,
organisation and inquiry fields as the per-item detail endpoints — verified, 50/50 items on both
kinds. That is ~1,440 paged calls instead of 142,315 detail calls: minutes rather than a day.

⚠ **Stranger still, and the opposite of the usual assumption: the LIST endpoint is RICHER than the
DETAIL endpoint for `cisId`.** Detail fetches returned a usable `cisId` on only 2 of 33 written-
evidence organisations; the list endpoint returned one on **225 of 225** (2025 Q1). Had the sweep been
built on the detail endpoint — the obvious choice — organisation resolution would have fallen back to
name-matching for almost every written submission.

---

## §2 — Storage: five tables in Neon

DDL of record: `scripts/ingest/position-graph/schema.sql`, applied by that directory's `setup.ts`.
Prisma models are declared in `schema.prisma` **solely so `prisma migrate diff` does not propose
dropping tables it does not know about** — the `CorpusAct` precedent. Nothing reads them through the
client.

`graph_entity` · `graph_alias` · `graph_edge` · `graph_evidence` · `graph_merge_log`

Three design points worth defending:

1. **An inquiry is not an entity.** `graph_entity.kind` is closed to person / organisation /
   publication, because those are the things that hold positions. An inquiry or a debate is an
   *event* an actor participated in, so it lives on the edge as `object_kind` + `object_ref`. The
   `declared-interest` case (MP → organisation) is entity→entity and uses `object_entity_id`, with a
   CHECK constraint tying the two representations together so neither can be silently omitted.
2. **Every edge can show its working, enforced rather than intended.** `graph_evidence.section_id`
   is a **foreign key to `corpus_sections`**. An edge can therefore only exist for material we
   actually hold — which enforces the brief's scope ("the corpus we already hold") and its integrity
   rule at the same time.
3. **`n_evidence` is reconciled from `graph_evidence`, never accumulated.** A counter incremented as
   a run proceeds is a number that can report writes which did not land — the "built inert" failure
   this project has already paid for once.

The mandatory §16 check is **inside** `setup.ts` rather than a thing to remember: it prints the host,
`current_database()`, and the last five migrations, and it **refuses to apply DDL** unless the host is
the Neon production endpoint recorded in `docs/CLAUDE.md` §16. A check you have to remember to run is
a check that gets skipped at 3am.

---

## §3 — Entity resolution, and what the two keys actually do

Predictions were recorded before the sweep (`--predict`): 127,890 written and 16,096 oral items at
source, ~1,442 API calls, ~112,000 organisation submissions and ~50,000 person appearances expected;
**distinct organisations deliberately not predicted, because that is the number this sprint exists to
produce.** The measured outcome is in `POSITION_GRAPH_2D1_TABLES.md`.

**The normaliser is conservative by design** (`graph-common.ts`): case, whitespace, punctuation,
`&`→`and`, and a leading "the". It does **not** strip legal suffixes, expand acronyms, or drop
parenthetical qualifiers. Its self-test asserts the distinctions that must survive — `Smith Ltd` /
`Smith plc`, `RTPI` / `Royal Town Planning Institute`, `Law Society` / `Law Society of Scotland` — and
refuses `n/a`, `Anonymous`, `name withheld` as identities.

### ⚠ The two keys correct each other, which was not the expected result

Reading the resolved rows by hand turned up something better than either key alone:

- **`cisId` merges spelling variants that name-matching would split.** One id gathers
  `King's College London` / `King's College  London` / `Kings College London` / `King’s College
  London`; another gathers `Barnardo's` / `Barnardos` / `Barnardo’s`; another `National Farmer's Union
  (NFU)` / `National Farmers Union (NFU)` / `National Farmers' Union (NFU)`.
- **The normalised name merges duplicate CIS registrations that `cisId` alone would split.**
  Measured at source over 3,031 organisation entries in four quarterly windows: **58 of 2,161 distinct
  normal forms (2.68%) carry more than one `cisId`** — `national grid` ×2, `kings college london` ×3,
  `electoral commission` ×2, `bar council` ×2, `foreign commonwealth and development office` ×3.
  Reading them, each is **one body registered more than once** in Parliament's CIS. Trusting `cisId`
  alone would have split King's College London into three separate actors.

So the `(kind, name_norm)` unique index is not merely a fallback — on 2.68% of names it is
*correcting* the stable key. **Zero normalised forms produced more than one entity row**, i.e. no
splits were introduced.

**The cost of that fold, stated rather than hidden:** when a second, different `cisId` lands on an
existing row, `COALESCE` keeps the first and the second key is dropped. That is right by default in
every case read by hand, but right-by-default is not the same as recorded — so the sweep now writes a
`cis-id-clash` row to `graph_merge_log` naming the discarded key. ⚠ **That logging was added after the
run reported here had already started**, so this report's merge-log counts under-state clashes; the
next run will carry them. Retaining *both* keys (a `graph_entity_key` side table) is the proper fix
and is a follow-up, not a silent omission.

---

## §4 — The policy-area candidate table

The ranked table is in `POSITION_GRAPH_2D1_TABLES.md`. Two choices in it need defending here.

**Policy area = the committee.** Charlie's instruction is that the area is chosen *from the data, not
from political judgement*. The committee structure is **Parliament's own division of policy**, it is
carried on 100% of evidence items at source, and it requires no judgement from us. Any clustering of
inquiry titles that we invented would be precisely the curation act the brief rules out.

**The contestation proxy is submissions per inquiry, and it is weaker than the brief's suggestion.**
The brief proposes counting organisations in inquiries whose recommendations were *not accepted in
full*, "or another countable signal you can defend". Acceptance is not derivable from anything
structured we hold — it lives inside the prose of government responses, and mining prose is what this
sprint refuses. Submissions per inquiry is a proxy for **salience**, not contestation: an inquiry many
bodies felt the need to be heard on is where positions are most likely to divide. It is labelled that
way rather than dressed up as the thing it approximates.

**Ranking is by organisations appearing in more than one inquiry** — the brief's own primary signal,
and the right one: repeat participation gives the most edges per unit of extraction cost when
proposition extraction is proved on a single area.

**Charlie picks from the table. This report does not pick.**

---

## ⚠ Three defects the first full run found in its own output — read these before the counts

None of these was found by review. Each was found by reading what the run actually stored, which is
the whole reason `report.ts` reads the tables back instead of trusting the sweep's counters.

**1. `A Member of the Public` became a person entity carrying six spellings.** That is an unknown
number of unrelated individuals merged into one actor — exactly the invisible, contaminating
direction the brief rules out. The junk-name filter listed `member of the public`, but the
normaliser strips a leading "the" and not a leading "a", so `a member of the public` walked through
an exact-match test. **Fixed** (article-stripping plus narrow patterns, asserted in the self-test on
the four forms that got through), but the fix landed *after* this run, so **the entity counts below
still include it and its siblings.** They are removable by name and the next run will not create
them. Nothing about the *edges* is wrong — those submissions exist and are correctly cited; the
error is that they are attributed to a person who does not exist.

**2. Person name-matching merges distinct people, and the numbers show it.**
`Mr Andrew Smith` carries `Andrew Smith` / `Dr Andrew Smith` / `Professor Andrew Smith`. Some of
those are one person with a changing honorific; some are certainly not. **45,983 of 46,175 person
entities (99.6%) rest on a name match at confidence 0.7** — only 192 have a Parliament member id.
This is why person confidence is 0.7 and not 1.0, and it is a **known limitation, not a solved
problem**: witness `personId` is available on the committees API and is the fix, in the same shape as
the organisation `cisId` that worked. It was not wired in this sprint. **Until it is, person entities
should be treated as name clusters rather than as people.**

**3. The interests sweep silently covered 20% of the register.** The API caps a page at 20 items
whatever `Take` requests; the run passed `Take=100` and advanced `Skip` by 100, so it read 20 and
skipped 80 — **695 of 3,415 interests (20.4%)**, and it reported every one of those 695 as a clean
success with no error anywhere. That is why `declared-interest` shows only 359 edges below. Fixed
(`TAKE=20`) and **the sweep must be re-run** before any `declared-interest` count is quoted. Same
family as a truncated LLM response, §18: a page size that is not the page size you asked for is a
failure wearing the face of a clean run.

---

## §5 — What the corpus cannot support

Stated so the next sprint is not designed against capability we do not have.

1. **`spoke-in` is NOT built, and building it on names alone would contaminate the graph.** Hansard
   speakers are name strings in our columns; `person_id` exists at source on 98.5% of speeches but
   would require re-reading ~30,000 XML files. Name-matching 8.8M speeches would create thousands of
   variant entities ("Mr. CHURCHILL", "Mr Churchill", "Winston Churchill") and, worse, would merge
   distinct people who share a surname-and-honorific form. The brief's rule decides it: *one row for
   two organisations is an invisible, contaminating problem*. **The measured plan** is a `person_id`
   sweep of the pwdata XML, which is cheap per file and bounded by file count rather than by speech
   count — recommended for the next sprint, scoped to the current Parliament first.
2. **No Companies House or Charity Commission number is populated.** The columns exist; the registers
   are §6 of the design and were not in this sprint. Until they are, an organisation's identity is
   Parliament's view of it, not a legal entity.
3. **No `holds-position` edge exists**, by design. Nothing in this sprint infers what anyone thinks.
4. **The register is a lower bound, not a census.** We hold **3,448** interests where the live API now
   returns **3,415** — the corpus outlives entries the register drops. That is information, not error,
   and it is why "no evidence" must remain an output rather than becoming "no interest".
5. **Our committees corpus stops at 2026-06-12** (range 2012-12-07 → 2026-06-12), so items published
   since are at source but unheld. The sweep writes no edge for them, deliberately.
6. **Anonymous submissions are never attributed**, whatever a witness field contains.

### And the thing that is not a count: three organisations read by hand

*"If the graph says something obviously wrong about a body you can check, the counts are decoration."*

`position-graph/verify-edges.ts` makes this repeatable and **able to fail**: for each organisation it
asks the committees API what `object_ref` actually is and compares the title the source returns
against the title we stored, then confirms the cited `corpus_sections` row exists and prints its
title, date and URL so a person can open the submission. It exits non-zero on any mismatch.

Three bodies anyone can check — **Local Government Association**, **Which?**, **Shelter** — all three
resolved by `parl-cis-id` at confidence 1.0 (cis 52255, 85976, 74309). Nine most-recent edges read:

| organisation | inquiry (as we stored it) | source title for that id | our cited section |
|---|---|---|---|
| LGA | Modernising Elections *(Housing, Communities and Local Government Cttee)* | ✓ "Modernising Elections" | `…writtenevidence:166202:295466` |
| LGA | National Resilience *(National Resilience Cttee)* | ✓ "National Resilience" | `…writtenevidence:166087:293956` |
| LGA | Children and Young Adults in the Secure Estate *(Justice Cttee)* | ✓ matches | `…writtenevidence:163896:294053` |
| Which? | Competition and market functioning in the UK live music industry | ✓ matches | `…writtenevidence:162313:289868` |
| Which? | FCA and PRA's secondary competitiveness and growth objective | ✓ matches | `…writtenevidence:137506:243166` |
| Which? | Retrofitting homes for net zero *(Energy Security and Net Zero Cttee)* | ✓ matches | `…writtenevidence:131583:226993` |
| Shelter | Realising potential: Delivering the Child Poverty Strategy | ✓ matches | `…writtenevidence:163527:288825` |
| Shelter | Black homelessness *(Women and Equalities Cttee)* | ✓ matches | `…writtenevidence:161228:282761` |
| Shelter | Access to Justice *(Justice Cttee)* | ✓ matches | `…writtenevidence:149056:268328` |

**9 of 9 inquiry ids resolved at the source to the title we stored, and all 9 cited sections exist**
with matching titles, dates and live `committees.parliament.uk/writtenevidence/{id}/` URLs. The edges
are also plausible on their face, which matters as much as the join being valid: the LGA on elections
administration and resilience, Which? on consumer competition and financial-services objectives,
Shelter on child poverty, homelessness and access to justice. Nothing here says anything a person who
knows these bodies would find surprising.

The generated tables in `POSITION_GRAPH_2D1_TABLES.md` add the three busiest organisations by edge
count, every recorded surface form for each, and up to eight inquiries apiece.

---

## Working rules, as applied

- **Bytes before hypotheses** — §1 ran first, and it changed the sprint: it turned a feared LLM
  extraction problem into a metadata sweep, and it caught a probe defect of mine that would have
  redirected the design.
- **Prove a check can fail before trusting it passes** — both sweeps carry a `--self-test` that
  asserts the normaliser's must-not-fold cases, the parser against both API shapes, and that an
  anonymous item yields no submitters.
- **An inference must not travel as a measurement** — the `cisId` collision rate, the list-vs-detail
  difference, and the 2.68% figure are all sampled counts with their sample size stated.
- **Predict before any expensive run** — `--predict` on both sweeps, recorded before writing.
- **Scoped commits only** — three threads share this tree; every commit names its paths.
