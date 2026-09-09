# BRIEF — INGEST COMPLETION C2: close the corpus, in parallel lanes

**Stream:** CC-Ingest · **Written:** 23 Aug 2026 · **Author:** CCh for Charlie
**Runs alongside / after:** `BRIEF_INGEST_CENSUS_C1.md` (the census + honest-email sprint).
**Read first:** `docs/SCRUTINISE_CORPUS_REGISTER_v4.xlsx` (Master Register, Licences & Letters, Quangos, Issues Log tabs), `docs/INGEST_PLAYBOOK.md` §21–24 (new — the denominator doctrine, what a completeness audit must cover, licence doctrine), `docs/CORPUS_COVERAGE_AUDIT_22_AUG.md`, `scripts/ingest/v36/worklist.jsonl`.

**Charlie's decisions, already made — do not re-ask:**
- Pre-2001 case law: **authorised**, subject only to the BAILII letter (LIC02).
- `et-decisions` landing pages: **delete and re-fetch now**.
- Corpus target: **everything**. Storage is not a constraint — the Neon 20 GB alarm was confirmed a false alarm on 23 Aug. Remove that warning from the daily email.
- Lanes run **in parallel**, not in sequence. The corpus is to be completed as fast as source politeness allows.

**Spend ceiling: US$400 of embedding for this brief.** Use the Gemini **batch** endpoint (`$0.075/1M tokens`, half the standard rate). Stop and report if any lane exceeds its estimate by more than 2×.

---

## 0. What this sprint is

C1 measures. **C2 fills.** The register now names **125 sources**, of which **42 hold nothing** and **31 have never been proposed before**. This brief turns that register into seeded, walked, licensed collections.

The lanes below are independent by design — different hosts, different rate limits, different failure modes — so they run concurrently. The only hard ordering is: **a licence letter clears before its lane's bulk fetch starts** (Lane 0), and **a walk precedes its own backfill** so we can tell when the backfill is finished.

Report progress per lane, never as one aggregate. A lane at 100% and a lane at 0% average to 50% and that number describes nothing.

---

## Lane 0 — LICENCES (gates three other lanes; Charlie's action, CC's evidence)

CC does not write the letters. CC produces the evidence pack that makes each letter one page, and blocks the dependent fetch until Charlie confirms the reply.

| # | Source | State | Gates |
|---|---|---|---|
| LIC01 | Find Case Law | **We are outside the licence today** — OJL v2.0 excludes computational analysis; we index and embed 74,896 judgments | nothing new, but it is a live exposure |
| LIC03 | FCA Handbook | **We are outside the licence today** — storage in a retrieval system needs written permission | Lane 5 (a ~146,000-section backfill) |
| LIC02 | BAILII | courtesy, not breach | **Lane 3** — the largest gap in the corpus |

**CC deliverable for each:** a one-page pack in `docs/licences/` stating exactly what we hold today (rows, sections, whether embedded, whether in the FTS index), what we propose to hold, the rate we propose to fetch at, and the attribution string we already carry per section. Charlie sends; CC records the reply date in the licence map and only then unblocks the lane.

Also in this lane, no letter needed: date-split the 505 `oecd` rows into pre- and post-July-2024 (the pre-2024 half is CC-BY-**NC**), and flag `nao-nc`, `echr-nc` and the IMF entry as commercial-excluded at the row level rather than in a document.

---

## Lane 1 — CLOSE CORE A: the legislation work list

`scripts/ingest/v36/worklist.jsonl` — **41,913 instruments**, already enumerated, published, with text at source, and not among the 139,440 the publisher declares have no provisions.

Five commit-scoped runs so a failure in one cannot stall the others:

| run | instruments |
|---|---:|
| Acts 2000+ | 5 |
| Acts pre-2000 | 5,783 |
| Statutory Instruments | 27,413 |
| Retained EU | 7,082 |
| Devolved / local / church | 1,630 |

Confirm the five sum to 41,913 against the file before starting.

**Identity rule, non-negotiable.** Pre-1963 Acts carry a regnal citation — the Vagrancy Act 1824 is `ukpga/Geo4/5/83`, not `ukpga/1824/83`. A calendar-id lookup returns zero rows and manufactures a false gap; that is precisely what produced the incorrect GOLD V2 absence claim. Match on **either** id, as `v36-reconcile.ts` does.

Then seed the four types that hold nothing at all: **`apni`** (NI Parliament Acts 1921–72 — 2,602 inbound citations in our own corpus point at legislation we do not have), **`ukcm`** (Church Measures — 6,803 inbound citations), **`ukci`**, and **`ukla`** (Local and Private Acts — no target row has ever existed). Walk each for a denominator first.

Hetzner, never Railway. R2 writes before Neon. Predict in `CHANGE_LOG` before the run; CCh's estimate is ~0.45–0.6M sections, ~60–90M words, **$6–9 on batch**.

**Prediction to be measured against:** Acts pre-2000 rises from 38.1% to ≥95% of Acts-with-text; SIs from 72.9% to ≥98%; retained EU from 84.7% to ≥98%.

---

## Lane 2 — QUALITY: stop counting things that say nothing

Independent of every other lane; run it immediately.

1. **`et-decisions`** — delete the 131,654 landing-page rows (median 18 words) from `corpus_sections` **and** the vector index, then re-fetch the real decisions behind them. Sample 200 to `/tmp` first and report decisions/minute plus the share that resolve to a real document rather than a dead link. Prove the deletion with a before/after count and one `runSearch()` query that previously returned a stub.
2. **Three retired collections** — delete `lda-lordswrittenquestions` (20,500), `lda-commonswrittenquestions` (8,000), `written-statements` (129) from rows and vectors. 28,629 sections are duplicated in retrieval today. Retiring the target row did not remove them; that is the whole lesson.
3. **`tna-caselaw`** — strip stylesheet, re-embed chunk 0 (>50% markup in 77% of judgments). ~$31 on batch. Verify by sampling 50 judgments and showing chunk 0 is under 5% markup.
4. **Dot leaders** — add `is_dot_leader` to the ~178,826 one-word legislation sections. **Do not delete**: a repealed provision is a real fact about the law. Exclude from usable-text counts; suppress as a retrieval answer.
5. **`written-answers`** — 143 rows at ~306,000 words each. Whole files are stored as single sections. Re-split into one section per answer.
6. **`building-regs`** — 21 rows at ~446 words. Approved Documents run to tens of thousands of words; PDF text is not being captured. Fix extraction, re-fetch. Note in the report that these documents incorporate BSI standards by reference which we cannot hold — the retrieval answer must say so rather than imply completeness.
7. **`senedd-cofnod`** — fix heading inheritance in the **shared parser**, not per caller (61.1% of 191,730 speeches wrong). Report the Welsh-language position to Charlie as a product decision; do not solve it here.
8. **Duplicate pairs** — prove or disprove each with one concrete duplicated item returned by `runSearch()`: `lda-commonsdivisions`/`commons-divisions-votes`; `lda-lordsdivisions`/`lords-divisions-votes`; `uk-treaties`/`uk-treaties-fcdo`; `historic-hansard`/`pwdata-debates` in their overlap window.
9. **Legacy table** — join the 127,790 legacy instrument ids to `corpus_sections` and to the worklist. Report how many are in **neither**. That one number decides whether 914,274 sections matter or are a duplicate.

---

## Lane 3 — CASE LAW BEFORE 2001 (gated on LIC02 only)

The largest known gap. All four `bailii-*` targets were retired as "superseded by `tna-caselaw`"; `tna-caselaw` starts at 2001, so nothing superseded them.

**3.1 Size it first**, because you cannot know when a fetch is finished without a denominator. Walk BAILII's court and tribunal indexes and report **judgment counts per court per decade, pre-2001 only**. The plan's 2,000,000-section estimate is unverified and its unit is ambiguous — `tna-caselaw` averages 9,088 words per "section", so a section there is a whole judgment, and 2M judgments is implausible. CCh's prior: **150,000–250,000 judgments**, 0.7–1.5B words, **$66–146 on batch**. Record it in `CHANGE_LOG`.

**3.2 Structure by court**, not one flat collection — coverage must be reportable per court per decade or we will never know what is missing.

**3.3 Fetch** at a deliberately slow rate. Strip stylesheet at compile time (the `tna-caselaw` lesson). Hetzner, R2 before Neon. Record each BAILII database's licence position in the register as we go; **exclude any that are licence-hostile and list them** — the same rule that correctly kept us out of SSRN.

Also in this lane: **First-tier and Upper Tribunal decisions** for the chambers we do not hold (Immigration and Asylum, Social Entitlement, Property, General Regulatory, Health Education and Social Care). Tribunals decide far more cases than the courts, and this is where welfare, immigration and housing law is actually applied. Walk each chamber separately.

---

## Lane 4 — THE BILL MACHINERY (highest product value per section)

Nothing in this lane is large. All of it is directly what a Scrutinise user needs.

1. **Bill amendment papers, marshalled lists, notices of amendments.** `bills-api` holds stage metadata, not amendment text. **An amendment is the exact artefact a user is trying to produce, and we hold none.** Source: the Bills API publications endpoint plus `publications.parliament.uk`.
2. **Public Bill Committee evidence** — determine the overlap with `committees-evidence` before seeding, then take the remainder.
3. **DPRRC, JCSI and SLSC reports** — split out of `committees-reports` into their own collections. Until they are separable, "was this SI ever challenged?" cannot be answered.
4. **Command Papers** — a complete numbered official series covering White Papers, Green Papers, government responses and treaty papers. Plan row 38 existed; no target row was ever created.
5. **Commons Library briefings** — plan row 39; no target row. Neutral, expert, plain-English summaries of every Bill. The best explanatory layer available anywhere.
6. **The London, Edinburgh and Belfast Gazettes** — an open, documented API under OGL, carrying commencement notices, insolvency, statutory notices. Not in the plan at all and unusually cheap to add.
7. **Coroners' Prevention of Future Deaths reports and responses** — ~5,891 reports as at September 2025, ~713 issued in 2024 alone. Full text on webpages since January 2023; earlier ones are PDFs and need extraction. A coroner naming a legal or regulatory failure and demanding change is the purest legislative-reform trigger that exists, at trivial volume.
8. **Select committee correspondence**, **Legislative Consent Motions** (Sewel, across all three devolved legislatures), and **Regulatory Policy Committee opinions**.

---

## Lane 5 — REGULATORS AND GUIDANCE (the largest unmeasured body)

**5.1 The quango universe.** 1,255 organisations are enumerated in the workbook's Quangos tab: **348 live**, **590 closed**, **300 exempt**, 16 joining. 162,004 relevant documents identified on GOV.UK.

The important finding: **"exempt" does not mean exempt from ingest — it means the body is exempt from the requirement to publish on GOV.UK**, so its content lives on its own domain and our GOV.UK crawler has never seen it. Those 300 include the Bank of England, the Care Quality Commission, the Civil Aviation Authority, the Environment Agency, Arts Council England, the British Library and the College of Policing. **An exemption at the publisher looks exactly like completeness at the crawler.** This is why `quangos-govuk` cannot be given a percentage today.

Three waves, in this order: (a) reconcile held sections against the 162,004 GOV.UK relevant documents for the 348 live bodies; (b) scope the 300 exempt bodies' own domains — one row per body, with its domain, whether it has a sitemap, and an estimated document count; (c) archived content for the 590 closed bodies, lowest priority.

Split out the **1,761 statutory-guidance documents** as their own labelled collection. "Statutory guidance" carries a legal duty to have regard and must not be ranked as ordinary guidance.

**5.2 Backfill the under-seeded.** `hmrc-manuals` (69,136 held), `fca-handbook` (3,661 — **gated on LIC03**), `college-of-policing` (332 — **gated on LIC08**), `planning-policy` (64), `sentencing-council` (253), `cps-guidance` (270), `inquiry-reports` (140), `inquiry-evidence` (89). Walk each for a denominator first; the plan estimates behind these are demonstrably unreliable in both directions and must not be used as targets.

**5.3 Split `govuk-core-docs`.** One 175-section collection is standing in for four plan rows. Split into `pace-codes`, `civil-service-codes` (Civil Service Code, Ministerial Code, Cabinet Manual, Special Advisers Code, Osmotherly Rules), `treasury-guidance` (Green Book, Magenta Book) and `white-papers`. Charlie asked specifically for the police and civil service codes; they are technically held but indistinguishably mixed and almost certainly incomplete.

**5.4 Seed the regulators that were never seeded at all.** Ofwat and Ofsted (named in plan row 26, never built). NHS England guidance. HSE Approved Codes of Practice (special legal status — non-compliance is evidence of breach). EHRC statutory codes (admissible in evidence under the Equality Act 2010). Electoral Commission. Charity Commission. IOPC. Committee on Standards in Public Life. Then scope, with volume and licence, before seeding: the PRA Rulebook, Financial Ombudsman Service decisions (potentially 400,000+ — could be larger than every other regulator combined), PHSO and Housing Ombudsman, the Pensions Regulator, Ofqual, ORR, CAA, Gambling Commission, FSA, MHRA, NICE, CQC, Companies House and the IPO.

**5.5 Public inquiries.** `inquiry-reports` holds 140 sections and `inquiry-evidence` 89. Grenfell, Covid-19, Infected Blood, Post Office/Horizon and IICSA each published thousands of pages and made direct legislative recommendations. Walk each live inquiry's evidence index separately.

---

## Lane 6 — LOCAL GOVERNMENT (scope only; do not build yet)

Entirely absent from the plan and the tier of democracy most users can actually reach. Byelaws are enforceable local law made under statutory power with no central register; local plans decide planning outcomes more than the NPPF does.

**Deliverable is a scoping report, not an ingest.** Answer: is there any aggregated source, or is this a per-council crawl of ~380 authorities? What does the LGA say about a common licence position? Run a pilot on **five** councils of different types and report documents found, formats, and effort per council. **Do not write 380 letters** — default to OGL only where the council states it, and record the licence per council.

---

## Lane 7 — DEVOLVED AND INTERNATIONAL

Walk and add plan rows for `scottish-parliament-or` (1,043,264 sections), `niassembly-hansard` (196,348) and `senedd-cofnod` (191,730) — 1.43M sections the Corpus Plan did not know existed. Scope the NI Assembly record before 2012 and the pre-1972 Stormont record. Seed Scottish and Welsh Government statutory guidance, which we hold none of despite holding their legislation.

Separately: **CJEU case law** as retained authority (determine the overlap with `eur-lex` first), **pre-1801 statute** (Statutes of the Realm, Acts of the Parliament of Scotland pre-1707 — scope what legislation.gov.uk actually holds), **UN/UNCITRAL** (plan row 52, no target row), and **ILO conventions and UK ratifications**.

---

## Reporting

Per lane, in this order, in plain English: what a user would have seen → what was actually wrong → what we did → what it cost → what is still open. Then the three lists: solved / not solved / next. Decisions for Charlie as numbered questions with a recommendation and the consequence of each option. Every percentage states what it is a fraction of.

Update `docs/SCRUTINISE_CORPUS_REGISTER_v4.xlsx` as each walk lands — the Master Register is the live artefact, not a snapshot.

**Every lesson from this sprint goes into `docs/INGEST_PLAYBOOK.md`.** §21–24 were added on 23 Aug and set the pattern: state what a user would have seen, then the cause, then the rule, in words a non-engineer can act on.

## Standing rules

- `whichdb` before any DDL; `prisma db execute --file` against the direct Neon URL; never `db push`; `NODE_OPTIONS=--no-network-family-autoselection`.
- A walk before a backfill, always — otherwise you cannot tell when the backfill is finished.
- A 5xx storm is a rate signal, not a retry signal: halve the rate, record old → new, resume.
- No git during the sprint; one commit script per lane at the end, scoped by explicit path, executed once, deleted. Verify with `git ls-files` and `git check-ignore -v <path>`.
- A push is not a deploy. A flag flip is not a flag in effect — verify with a positive signal.
- Fix a failure class in the shared helper, not per caller.
- Heavy compute on Hetzner, never Railway. R2 before Neon.
- Predictions in `CHANGE_LOG` before every run.
- Open items into `docs/OPEN_ITEMS.md`.
