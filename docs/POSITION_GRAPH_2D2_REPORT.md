# GRAPH 2D-2 — THE EDGES THAT WERE ALREADY PAID FOR

**Executes:** `docs/BRIEF_GRAPH_2D2.md`
**Design:** `docs/POSITION_GRAPH_DESIGN.md` + Amendment 1
**Follows:** 2D-1 (`docs/POSITION_GRAPH_2D1_REPORT.md`) — 86,816 entities, 164,135 edges
**Written:** 2026-08-16
**Code:** `scripts/ingest/position-graph/` — `schema-2d2.sql`, `setup-2d2.ts`, `sweep-members.ts`,
`sweep-edm-sponsors.ts`, `verify-2d2.ts`, `handcheck-2d2.ts`, `report-2d2.ts`, and the probes.

---

## 0 — The headline, including the part that is a refusal

`voted` is built and reaches **2,478,613 edges over 2,616 people and all 5,645 divisions**, from
1999-11-24 to 2026-07-22, at **100% evidence coverage with a negative control that fires**.
`signed-motion` reaches **59,996 edges over 1,675 sponsors** (1989-11-21 → 2026-06-18), keyed on the
member id our ingest was throwing away. **All 16 verification checks pass and every negative control
fired.** The person sweep ran, and **its honest result is that the graph's people are still mostly
name clusters** — which is what §2 asked to be told, not a shortfall against it.

Three things in this report are more important than any of the counts:

1. **§1 could not be built the way the brief describes, and the reason was measured before anything
   was written.** Writing 2.53M edges into `graph_edge` costs **2.21 GiB** at this database's own
   measured per-row cost. Neon had **0.93 GiB** of headroom, at 94.7% of its documented line. The
   edges are therefore a **view** over `division_votes`, which already holds the same fact at a
   third of the cost. Nothing in §1's requirements was dropped to achieve that; §2.1 sets out each
   one and where it is now checked.
2. **The sweep found a defect in 2D-1's spine.** `graph_entity.first_seen` equals `last_seen` on
   **100% of the 46,298 person entities** — the column records the last sighting under the name
   "first". It is repaired.
3. **The brief's premise about the Hansard person id is right for recent files and wrong for the
   archive**, and the difference decides whether `spoke-in` is reachable. Measured: **16.2%** of
   sampled speeches carry a person id; **67.6%** carry a *membership* id, which is a seat-term and
   not a person. Converting those needs a crosswalk whose data licence is unstated.

---

## 1 — The storage finding, first, because everything else sits on it

`probe-2d2-cost.ts` priced §1 against this database's own measured bytes-per-row **before** any
edge was written:

| | rows | bytes/row (measured) | total |
|---|---|---|---|
| `graph_edge` | 2,528,032 | 584.5 | **1.376 GiB** |
| `graph_evidence` | 2,528,032 | 355.8 | **0.838 GiB** |
| | | | **2.21 GiB** |

Against a database measured at **16.57 GiB of the documented 17.5 GiB line — 94.7%**, leaving
**0.93 GiB**. The ask is 2.4× the space that exists, and the database is already above the 90%
threshold the ops observer alerts on. (The line's provenance: `CHANGE_LOG.md` and
`handoff_summary.md` both record "Neon 15.93 GB / 17.5 GB = 91%" from a live alert.)

⚠ **The wrong three answers, and why each is wrong.** Shrink the work until it fits — root
`CLAUDE.md` §17 names that as the failure mode, not the fix. Store a summary — §1 forbids it in
terms ("store the vote itself, not a summary"). Ask for more space — for a second copy of data we
already hold.

**`division_votes` is already the edge table.** One row per member per division at **193.2
bytes/row**, carrying the member id, the vote, the teller flag, the party as at the division date,
and the date. Copying it into a generic edge table would spend 2.21 GiB to hold a staler duplicate
of 450 MB, and create the possibility of the two disagreeing. So `voted` is a **view**, and the
general rule is written into `schema-2d2.sql`:

> **Store the fact we do not already have; derive the edge from it.** A graph whose edges are views
> over their sources cannot drift from those sources, which is worth more than the row count.

The same reasoning shapes §3: what we lack for EDMs is the sponsor's *id*, so the id is stored
(`edm_sponsor`, 9.1 MB) and the edge is derived.

**Total cost of this sprint: three tables, 14.2 MB** — `edm_sponsor` 9,072 kB, `graph_member_name`
4,136 kB, `graph_member_register` 984 kB. Neon moved 16.57 → **16.58 GiB (94.8%)**, against the
2.21 GiB the literal reading would have cost. The `voted` and `signed-motion` edges occupy **zero
bytes**.

---

## 2 — §1 `voted`

### 2.1 Every requirement, and where it is now checked

| §1 requires | how | checked by |
|---|---|---|
| the vote itself, not a summary | `qualifier` ∈ aye/no/absent, plus `teller`, one row per member per division | `verify-2d2.ts` |
| absent ≠ against | `absent` is its own value; `absence_known` rides beside it | two checks, below |
| every edge dated | `observed_on` = the division date | check, 0 nulls |
| parent Bill and stage carried | `bill_title`, `stage`, `amendment` **+ `context_provenance`** so a parsed title never reads as a stated one | view columns |
| evidence coverage 100% | `evidence_section_id` derived and **proved to resolve** | check + negative control |
| "passed without a division" still expressible, never inferred | `stage_outcomes` left empty, as V34 left it | check on `method='title-match'` |

### 2.2 The numbers

- **2,478,613 `voted` edges**, 2,616 people, all 5,645 divisions, **1999-11-24 → 2026-07-22**
- Commons: 581,623 aye · 548,836 no · **396,956 absent** (`absence_known = true`) · 8,709 tellers
- Lords: 459,310 aye · 491,888 no · **no absent rows at all** · 11,169 tellers

⚠ **The Lords absence is the finding, not the gap.** The Lords publishes no equivalent of the
Commons `NoVoteRecorded`, so a Lords `absent` row would be invented. `absence_known = false` sits on
every Lords edge, and a check asserts no Lords edge ever claims a measured absence. Reading the
Commons absence count as comparable to the Lords one is the specific error the flag prevents.

### 2.3 Members resolved against members unresolved

| | |
|---|---|
| distinct members in the vote record | **2,735** |
| **resolved** to a graph entity | **2,616 (95.6%)** |
| **unresolved** | **119 (4.4%)** |
| vote rows in `division_votes` | 2,528,032 |
| vote rows reachable as edges | **2,478,613 (98.0%)** |

The shortfall is entirely the unresolved members, and it is reported per member rather than as a
single percentage — a member holding 600 votes and one holding 3 are not the same miss. The largest
are `Gareth Thomas` (2,361 votes), `Lord Jones` (2,129), `Earl Attlee` (1,887), `Ian Paisley`
(1,786).

⚠ **Those four are unresolved for the right reason.** Each is one of the 24 detected splits: two
different members are called Gareth Thomas (MNIS 177 and 532), three are called Ian Paisley (653,
4129, 4149), two Earl Attlee (2454, 3425). **The 119 unresolved members are largely the price of
refusing to guess**, not a coverage failure, and paying it is the correct trade.

### 2.4 A validation the identity work passed that name-matching could not

**105 member ids appear in the vote record under two different names**, because the member moved
from the Commons to the Lords: `Theresa May` / `Baroness May of Maidenhead`, `Eric Pickles` /
`Lord Pickles`, `Philip Hammond` / `Lord Hammond of Runnymede`. Keyed on the member id these are
one actor each. Name-matched they would have been **210 actors**, each holding half a career.

---

## 3 — §2 The person sweep

### 3.1 What it swept, and what it refused to sweep

**Source: `members-api.parliament.uk`, Parliament's own register, OPL v3.0** — the same API family
already mapped OPL3 in `licence-map.ts`. 5,234 members (current and former, both houses), 20,997
dated name forms, 524 API calls.

⚠ **It is NOT mySociety's `parlparse/members/people.json`, and that was a decision, not an
oversight.** That file is one 27.7 MB fetch carrying 14,796 persons and — the tempting part — a
`datadotparl_id` crosswalk on 2,952 of them, which would join the TheyWorkForYou person-id space to
MNIS in a single request. **Its licence was checked rather than assumed:** the repo's `LICENSE.txt`
covers "the software in this directory" under AGPL-3.0 and says nothing about the data; GitHub
reports the repo licence as `NOASSERTION`. An unstated data licence attaching to our derived
database is the Public Whip question again (`licence-map.ts`, `publicwhip-divisions`, ODbL
share-alike, flagged and not ingested), and it is **Charlie's call, not an ingest decision.**
Parliament's own API answers the identity question under a licence already accepted.

### 3.2 The result — stated so it cannot be read up

`report-2d2.ts` carries the live numbers. The shape:

| key_source | entities | confidence | |
|---|---|---|---|
| `parl-member-id` | **2,603** | 1.0 | a stable key — up from **438** |
| `name-match` | **788** | 0.9 | a register-corroborated name match |
| `singleton` | **45,018** | 0.7 | still a name cluster |

- **2,603 person entities now rest on a stable key**, up from 438 — a **5.9×** increase. Most are
  entities created *from* the register for members who hold a vote or a sponsorship (2,165 created).
- **788 carry a register member id at `key_source='name-match'`, confidence 0.9** — 691 from the
  first pass, 97 from the peerage pass.
- **45,018 remain unresolved**, and that is the correct answer for most of them: they are committee
  witnesses, and a register of parliamentarians cannot identify a witness who is not one.

⚠ **A name match against a curated register is still a name match.** Those 788 are stored as
`name-match`/0.9 and **not** as `parl-member-id`/1.0, because `schema.sql` says of that column:
*"HOW identity was established, so a name-matched row can never be mistaken for a keyed one."* A
verification check asserts the distinction holds. Writing 1.0 there would have been an inference
travelling as a measurement.

### 3.3 Splits — reported prominently, because §2 says a split matters more than a merge

**24 entities are flagged `SPLIT-DETECTED-NOT-RESOLVED` and none was resolved.** Each is one graph
entity whose name matches more than one real member:

```
#5240  "Brown"                      → MNIS 523, 588, 591, 4470
#23660 "Ian Paisley"                → MNIS 653, 4129, 4149
#24383 "JONES"                      → MNIS 531, 1502, 4024
#40992 "Mr Alan Williams"           → MNIS 536, 569, 1712
#73042 "Viscount Younger of Leckie" → MNIS 1756, 2850, 4169
#12836 "Gareth Thomas"              → MNIS 177, 532
#36715 "Earl Attlee"                → MNIS 2454, 3425
#14254 "Mr John Smith"              → MNIS 564, 681
```

⚠ **The peerage titles in that list are the least obvious and the most dangerous.** `Earl Attlee`,
`Viscount Camrose`, `Lord Ashton of Hyde`, `Viscount Ridley`, `Lord Moynihan` are *inherited*
titles: the same title, held by different people in succession. A name match cannot see a
generation change, and it is not a spelling problem that careful normalisation would catch.

Every edge those entities hold is attributed to the wrong person some of the time. They are logged
to `graph_merge_log` in auditable form, and a check asserts none was quietly given a key afterwards
— *a split is a refusal to decide, and giving it a key later would be deciding.*

⚠⚠ **24 is a FLOOR, not a census.** A split can only be seen where the entity matched the register
at all. Among the ~45,000 unresolved entities, splits are invisible to this method. §3.6 measures
the true rate on a population where it *can* be seen.

**54 merges** were performed across the two passes (**51 distinct surviving entities** — three
absorbed two duplicates each), each moving edges onto a keyed entity and deleting the duplicate,
inside a transaction, fully logged. **All 54 were printed and read rather than sampled** — they are MP-to-peer transitions and honorific variants of one person (`Lord Clarke of
Nottingham` → `Rt Hon Kenneth Clarke Mp`; `Baroness Hodge of Barking` → `Dame Margaret Hodge`;
`Ruth Smeeth` → `Baroness Anderson of Stoke-on-Trent`).

### 3.4 Two screens, and what each cost

**The ≥2-token rule.** `normalisePersonName` strips honorifics, so `Lord Smith` normalises to
`smith` — and so does a witness recorded only as `Smith`. Matching on one token would hand a peer
every edge belonging to every unrelated Smith in the corpus. 1,589 single-token register forms are
excluded, and the count is reported rather than hidden.

**The lifespan screen — and the first two versions of it were wrong.**

- *Version 1* tested tenure and killed **216** matches, including `Dame Joan Ruddock`, active
  2023–2026 against a Commons window ending 2015. **A former MP giving evidence after leaving
  Parliament is the normal case**, not a contradiction. The high side of a tenure window carries no
  information about identity; it was removed.
- *Version 2* tested against the register's earliest date, assuming it was a birth date. Measured:
  **1,690 of 5,234 members have an earliest name date preceding their seat by 20–81 years (a birth
  date); 3,470 have one equal to the seat date (not a birth date at all)**. Taking the second group
  as birth ruled four 2024-intake MPs "impossible" because a witness of that name was active in 2022
  — which is what a candidate does before being elected.
- *What ships* tests only what is actually impossible, against a date that is genuinely a birth date
  (≥18 years before the seat): active before birth, or still active at 105+. It fires on **6**
  candidates, every one a member born 1905–1915 against an entity active 2016–2026, and reports
  **419 untestable as untestable rather than as passes.**

⚠ The screen runs **before** the ambiguity screen, not after: three members named Ian Paisley is
only an ambiguity if all three could be the actor.

### 3.5 The 2D-1 defect this uncovered

The date test needed an activity window and `graph_entity.first_seen` could not supply one:
**`first_seen` equals `last_seen` on 100% of the 46,298 person entities.** 2D-1's upsert wrote both
from whichever row was in hand, so the column records the *last* sighting under the name "first",
while the edges beneath span 2012–2026. `Mr Andrew Smith` read as a one-day actor in June 2026 and
was ruled out of being an MP who left in 2017 — his own edges start 2014-12-18.

**Repaired: 7,739 person entities now carry the true span of their edges.** ⚠ The repair must run
*after* merges, because a merge moves edges onto a target whose window was already computed —
`verify-2d2.ts` caught exactly that, one entity, on the first pass.

⚠ **Organisations were not repaired.** The same defect very likely affects the 40,518 organisation
entities; that is 2D-1's lane and is flagged rather than silently changed.

### 3.6 The Hansard person id — the brief's premise, measured

§2 states the id "sits on 98.5% of Hansard speeches". Measured over a 120-file spread of
`pwdata-debates` (1919 → 2026, 41,752 speeches):

| | share |
|---|---|
| carrying a **person** id (`person_id="…/person/N"`) | **16.2%** |
| carrying a **membership** id (`speakerid="…/member/N"`) | **67.6%** |
| either | 83.7% |
| id present but literally `"unknown"` | 1,518 speeches |

By decade the seam is stark: **2020s 93.1% person · 2000s 0% person / 92.6% membership · 1980s 0% /
93.3%.** The attribute changes name and id-space around 2010.

⚠ **The first version of this probe searched only for `person_id` and reported whole decades at
exactly 0.0%.** Whole decades at exactly zero is what a parser gap looks like, not a source gap;
dumping the bytes (`probe-speech-markup.ts`, per `docs/CLAUDE.md` §13) found the attribute renamed.

⚠⚠ **A membership is not a person.** One person holds many memberships across a career, so a
membership id identifies a seat-term; treating it as an identity would split every long-serving
member into one actor per Parliament. Converting membership → person needs `people.json`, whose data
licence is unstated (§3.1). **So the older majority of Hansard cannot be person-resolved until
Charlie rules on that licence, and Parliament's own Members API does not publish the crosswalk.**

**What name-matching would do to this population**, over the speeches that *do* carry a person id
(1,412 names, 1,134 people):

- **merge risk** — names used by more than one person: **22 (1.6% of names)**
  (`"Mr. WILLIAMS"` → 4 people; `"Mr. SPEAKER"` → 3)
- **split risk** — people appearing under more than one name: **191 (16.8% of people)**
  (`person/18140` → five surfaces including `"Mr. LOCKER - LAMPSON"` and
  `"Mr. GODFREY LOCKER-LAMPSON (for the FIRST COMMISSIONER of WORKS)"`)

This is the measured argument for §2's own instruction not to build `spoke-in` from names, and it is
a floor from one corpus, not a census of the 8.8M-speech population.

---

## 4 — §3 `signed-motion`

`PrimarySponsor.MnisId` **is on the wire and we were dropping it** — confirmed live before the
sweep (motion → `MnisId 4394`, "Imran Hussain"), exactly as the brief said. `edm_sponsor` now stores
it, and `graph_signed_motion_edge` derives a keyed person → motion edge.

**60,995 motions swept, 100% carrying a `PrimarySponsor.MnisId` — not one NULL.** From those,
**59,996 `signed-motion` edges over 1,675 sponsors**, 1989-11-21 → 2026-06-18.

**The corroboration that makes the recovery worth anything:** on the 60,637 motions where we hold
both the recovered id and the sponsor name our ingest stored years ago, **the name agrees on 60,637
and disagrees on 0.** The id and the name are telling the same story.

⚠ **The API reports 60,995 motions; we hold 60,737 sections.** The 258-motion gap is motions tabled
since the last ingest. **The view excludes them** — an edge is only derived where we hold the
section that evidences it, and `verify-2d2.ts` failed on exactly those 258 before the view was
corrected, which is how they were found rather than shipped.

⚠ **One page of the sweep failed and cost exactly 100 motions, and finding out why was worth more
than the 100 rows.** `skip=5200` returns **HTTP 200 wrapping `{"StatusCode":400,"Success":false}`** —
so `res.ok` is TRUE and every retry rule in our fetch helpers waves it through. I first called it
deterministic by analogy with V36's "a 300 is an answer"; six consecutive requests to the identical
URL settled it instead — **400, 400, 400, 400, 200, 200.** It is a transient wearing a permanent
failure's clothes, inside a success's clothes. The gap is now closed (**60,995 of 60,995; zero held
motions without a sponsor row**) and the rule this produces is in `fill-edm-gap.ts`: **on this API,
check the BODY's StatusCode, not the transport's.**

⚠ A second lesson, cheaper to record than to repeat: the gap-finder hit a *different* failing offset
(`skip=2700`) and I took that for the culprit. Refetching it recovered 50 rows, **none of them
ours**. More than one offset is flaky, so "a page failed here" is not evidence that "the missing rows
are here" — the real window was found by binary search on the list ordering.

⚠⚠ **`signed-motion` is far wider than what this contains, and that gap is the thing most likely to
be misread later.** Amendment 1 §1 defines it as person → motion for a **signature**. A primary
sponsor is one signatory — the first. The numbers, which the report prints so the gap cannot be
overlooked:

| | |
|---|---|
| signatures in the record | **2,125,547** |
| signatures this graph can name | **60,995** (the primary sponsors) |
| **signatures NOT in this graph** | **2,064,552 — 97.1%** |

A sponsor count printed beside a sponsor edge invites exactly the reading that the edges are the
signatures. They are 2.9% of them.

Busiest primary sponsors: Jim Shannon 934 · Jeremy Corbyn 871 · John McDonnell 824 · Paul Flynn 800
· Keith Vaz 742.

Full signatories remain a separate job, as §3 says: a 60,737-page scrape of `edm.parliament.uk` with
its own licence and rate-limit questions — and **a withdrawn signature is a changed position**, which
the design treats as a finding.

---

## 5 — §4 Consultation responders: report only, edge NOT built

**Answer: not structured, and not in the text we hold. It is inside linked PDFs. That is a fetch job
plus an extraction job, and a different sprint.**

**The structured side** (60 consultations through the gov.uk content API):

- `document_type`: `consultation_outcome` 55, `closed_consultation` 5
- **fields whose name suggests a responder: 0.** `details.*` carries `attachments`, `body`,
  `closing_date`, `emphasised_organisations`, `final_outcome_*`, `public_feedback_*`, `tags`;
  `links.*` carries `organisations` — which is the **publishing department**, not the responders.
- attachments present on **55/60 (92%)**, 231 attachments in total

**The text side** (random sample of 300 compiled documents from R2, all readable):

| signal | documents | worth |
|---|---|---|
| named-list heading (`Annex A: list of respondents`) | 0 (0.0%) | one edge per line |
| `list of respondents` / `list of organisations that responded` | 5 (1.7%) | one edge per line |
| `organisations that responded` | 2 (0.7%) | one edge per line |
| `we received N responses` | 13 (4.3%) | aggregate — a number, not an actor |
| bare mention of respondents | 75 (25.0%) | nothing on its own |

**At most 2.3% carry any named-list signal — and reading those hits shows they are pointers, not
lists**: *"includes a summary of the responses we received and the list of organisations that
responded"*, *"includes a list of respondents in Annex A"*, followed by a link to a
`[government-response]` PDF. The list is one hop away in every case.

**So the responder is recoverable, but not from anything we currently hold**, and the cost is now
measurable: ~7,448 consultations × ~4 attachments to fetch, then PDF text extraction, then
organisation-name extraction from a list whose formatting varies per department. ⚠ And the field
family literally named for responses — `public_feedback_attachments` — is present on only
**8/60 (13%)**; the responder list usually rides inside the department's own outcome document.

⚠ Note also that a departmental summary of responses is **not** a quotation from a responder. V34's
attachment classification exists for this reason, and any future extraction must keep the two apart.

---

## 6 — Three read by hand

§5: *"pick people whose voting records you can check against a public source, and confirm the graph
says nothing obviously wrong about them. If it does, the counts are decoration."*

Chosen to put pressure on what is most likely to be wrong, not to look good — see
`handcheck-2d2.ts` for the run and the public URLs:

- **MNIS 8, Theresa May / Baroness May of Maidenhead** — sat in both houses. If the identity work is
  wrong she is two actors and her Lords votes belong to nobody.
- **MNIS 565, Lord Morris of Aberavon** — **the riskiest merge this sprint performed.** Two
  `Lord Morris` entities were folded into an entity whose canonical name is `Dr John Morris`, a
  committee witness. It is in the hand-check precisely because it is the one I am least sure of.
- **MNIS 4131, Jim Shannon** — the highest-volume EDM sponsor in the corpus (934 motions). If
  `signed-motion` is wrong anywhere it will be loudest here.

Each is checked three ways: internal consistency that can fail, a **re-fetch of real divisions from
`votes.parliament.uk` compared field by field** against what we stored, and a printed public URL so
the claim can be checked without taking this report's word for it.

### 6.1 The result

**9 of 9 re-fetched divisions agree with what we stored**, across both houses, and every internal
check is zero. Nothing obviously wrong.

- **MNIS 8** — one entity holding **1,786 Commons votes (2016-03-09 → 2024-05-24, including 853
  absences)** and **120 Lords votes (2024-11-05 → 2026-07-22)**. **The Commons-to-Lords transition is
  carried as one career by one actor**, which is exactly what §2 was for. Lords divisions 3698, 3697
  and 3695 all re-fetched as `aye`, matching.
- **MNIS 565** — 1,141 Lords votes 2001-10-23 → 2023-03-07. Divisions 2902, 2889, 2888 re-fetched and
  matched.
- **MNIS 4131** — 2,361 Commons votes and **934 EDMs sponsored**, the corpus's busiest sponsor.
  Divisions 2410, 2411, 2409 re-fetched and matched. This entity is `key_source='parl-member-id'`,
  confidence 1.0, created from the register.

### 6.2 ⚠ And the check found what it was pointed at

**The merge I flagged as riskiest is probably wrong, and the hand-check is how that surfaced.**
Entity #43723 now holds MNIS 565 and these four surfaces:

```
"Dr John Morris"                            [committees-written]
"Mr John Morris"                            [committees-written]
"Rt Hon Lord Morris of Aberavon"            [committees-written]   ← merged in by 2D-2
"Rt Hon the Lord Morris of Aberavon KG QC"  [committees-oral]      ← merged in by 2D-2
```

The register records MNIS 565 as **"Sir John Morris" until 2001** and "Lord Morris of Aberavon"
after — **never "Dr"**. The two peer surfaces are unambiguously him. The two bare "John Morris"
surfaces are not confirmable, and when he *did* give evidence in the entity's active window
(2015–2019) he was recorded as "Lord Morris of Aberavon" — on the very entities that were then merged
in. **The most likely reading is that one entity now fuses two people.** Its member id and its votes
are right; its written-evidence edges are suspect. Flagged, not silently kept.

⚠⚠ **The obvious generalisation was tested and it FAILED — recorded so nobody builds it.** The
tempting rule is "distrust a match made on a name the member had stopped using". Run over all 788
register name-matches (`probe-stale-name-matches.ts`), **102 (13%) show that pattern — and the list
is full of matches proven correct**, including `Mrs Theresa May` (12.5-year gap, verified above),
`Rt Hon Kenneth Clarke Mp` (29.9 years) and `Lord Norman Tebbit` (28.5 years). The cause:
`nameHistory` end dates track a change of *style*, not the point at which a name fell out of use.
**The screen is worthless and must not be built.** The doubt about #43723 stands on the "Dr", which
the register never records — not on the gap, which Theresa May's exceeds.

---

## 7 — Verification, and the guard that caught itself

`verify-2d2.ts` runs every check twice: once against the real data, and once against a deliberately
corrupted copy of the same query that **must** come back failing. If a negative control does not
fire, the script reports the check as proving nothing and exits non-zero **even when the real data
is clean** — per `docs/CLAUDE.md`'s "a guard that cannot fail is not a guard".

**Final state: 16 checks passed, 0 failed, 0 broken negative controls.**

It earned its place three times before getting there:

- the **`first_seen` repair check failed (bad=1)**, which is how the repair-before-merge ordering bug
  was found rather than shipped — a merge moves edges onto a target whose window was already
  computed, so the repair has to run last;
- the **`signed-motion` evidence-coverage check failed (bad=258)**, catching edges for motions we do
  not hold a section for — a violation of the design's "an edge with no evidence row is a claim we
  cannot show our working for", fixed in the view rather than in the check;
- the **`signed-motion` negative control did not fire** while `edm_sponsor` was still empty,
  correctly reporting that a check over zero rows proves nothing. That is the guard catching itself,
  which is the entire reason the controls exist.

---

## 8 — What is open, and whose it is

1. **⚠ CHARLIE — the `people.json` licence.** mySociety's `parlparse` data licence is unstated
   (AGPL-3.0 covers the software; GitHub says `NOASSERTION`). It is the only crosswalk from the
   TheyWorkForYou person id to MNIS, and **without it the 67.6% of Hansard speeches carrying a
   membership id cannot become people.** Same class of decision as the Public Whip ODbL flag.
2. **⚠ CHARLIE / storage — Neon is at 94.8% of the 17.5 GiB line.** This sprint added 14.2 MB by
   deliberate design, but the next thing that wants to write millions of rows will not have that
   option. The 93,014+ V36 sections still awaiting indexing sit in front of the same wall.
3. **CC-GRAPH — organisation `first_seen`.** The 2D-1 date defect was repaired for people only;
   40,518 organisation entities are very likely affected in the same way.
4. **CC-GRAPH — the unresolved members.** Members holding votes but blocked from a keyed entity
   because an ambiguous unkeyed entity already holds their exact name. That refusal is the ambiguity
   screen working; resolving them needs evidence the register does not carry.
5. **CC-GRAPH — full EDM signatories**, per §3: a scrape with its own licence and rate-limit
   questions, and the place where withdrawn signatures (a changed position, therefore a finding)
   live.
6. **CC-GRAPH — `spoke-in` remains NOT built**, per §2's instruction, and §3.6 now supplies the
   measured reason rather than the asserted one.
7. **Nothing here is user-facing**, per §5. Person entities below confidence 1.0 are name clusters
   and must not be presented as people.
