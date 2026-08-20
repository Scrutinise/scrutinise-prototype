# BRIEF — INGEST: THE MISSING NAMES (CASE TITLES AND COMMITTEE SPEAKERS)

**For:** CC-Ingest
**Written:** 19 August 2026, by CCh-Search
**Context:** `SEARCH_S8_REPORT.md` §2 (attribution) and `GOLD_CANDIDATES_S8.md` (case-law keys)
**Format:** audit-then-build. No git during the sprint. **One `commit-ingest-names.sh` at the end**
— new standing rule: commit scripts are named per stream and per sprint, because two sessions
sharing `commit-all.sh` raced today and one deleted the other's script mid-use. Scoped commits by
explicit path only.

---

## §0 — WHY THIS SPRINT EXISTS, IN USER TERMS

Two things a user sees today, both the same underlying failure — **we stored the document and
threw away who or what it was:**

1. A user reading select-committee evidence gets a quote and **no name**. They cannot tell whether
   they are reading a water company, a campaign group, or the committee's own conclusion. Search
   now has a field to carry the name (S8 §2) and committees fills **0 of 800 sampled rows**.
2. Every court judgment we hold has a **blank title**. The only stored identifier is the citation
   (`ewhc/2021/123`). Nobody — user or machine — can tell what a case is *about* without opening
   it. This also blocks the search test questions: ten case-law questions cannot have their answer
   keys verified.

Neither is a search defect. Both are ingest: the information exists at source (or inside the text
we already hold) and was never captured into a field.

**Order matters:** §1 is small, unblocks Charlie's validation session, and should be delivered
first even if §2 runs long.

---

## §1 — CASE LAW: RECOVER THE CASE NAME

### §1.1 Audit before building

Sample 100 random `tna-caselaw` rows and report:

- Where the case name actually lives. Expect it near the head of the judgment text, but **check**:
  the neutral citation line, the party line (`X v Y`), a court/date line, and the metadata block
  the source publishes may all be present or absent independently. Report the shapes you find and
  their frequencies, with two or three examples printed in full.
- Whether any structured field at source (the National Archives Find Case Law API) carries the
  name and we discarded it. If it does, **that is the route** — parsing text we already hold is a
  fallback, not a preference, because a parsed name is an inference and a fetched one is a fact.
- Coverage: the same question for `ni-judgments`, `scottish-courts`, `et-decisions`,
  `tax-tribunals`, `echr-hudoc`, and `cma-cases`. Report per collection; a fix that only covers
  England and Wales should say so rather than be described as "case law".

**Report the audit before building.** If the source carries the name, §1.2's method changes.

### §1.2 Build

- Populate a title field for every case-law row where the name can be established **from a
  structured source field first, from stored text second**.
- ⚠ **Provenance is required, not optional.** Record which route produced each title (`source` vs
  `parsed:v1`). A parsed title is an inference; when we later find a wrong one, we need to know
  which population to re-do. This is the standing rule that an inference must never travel as a
  measurement.
- ⚠ **A miss stays a miss.** Where the name cannot be established, the field stays null and the
  row is counted. Do not synthesise a title from the citation — `ewhc/2021/123` rendered as
  "EWHC 2021 123" is not a case name, and a placeholder that looks like data is worse than a blank.
- Make the recovered title reach the places a user meets it: the search result title for case-law
  documents, and anywhere the platform lists a judgment. Coordinate the display change with
  CC-Search's type map if it lives there — **do not edit search-owned files**; if the change
  belongs to them, report the exact one-line change needed and leave it.

### §1.3 The gold-question pre-task — deliver this first

Ten questions in `docs/GOLD_CANDIDATES_S8.md` are keyed to judgments whose subject nobody can
verify. Before anything else in this sprint:

- For each of those ten keyed judgments, extract the **first ~200 words** of the judgment text and
  the case name if §1.1 has established one, and write them into the gold document beneath the
  question they key, clearly marked as an extract for verification.
- Purpose: Charlie can confirm at a glance that the keyed case is actually about the question's
  subject, without leaving the document. Twenty minutes of work that unblocks his validation
  session.

### §1.4 Verify

Report: rate of titles recovered per collection, **stated as a percentage of the rows in that
collection**, with the route breakdown (source vs parsed) and the residual null count. Hand-read
**30 random recovered titles against their judgment text** and report how many are right — a
parser's own success count is not evidence that the names are correct. Every new check watched
failing first.

---

## §2 — COMMITTEE EVIDENCE: RECOVER WHO SAID IT

### §2.1 Audit before building

For `committees-evidence` and `committees-reports`:

- **What does the source actually publish?** For written evidence, the submitting organisation or
  individual is normally on the record. For oral evidence, each contribution has a speaker and the
  witnesses are listed for the session. Establish, with real API responses printed in the report,
  what fields exist and how reliably they are populated. ⚠ Node's `fetch` is refused by
  `committees.parliament.uk` (Cloudflare TLS fingerprinting) — this is documented in our own
  `sources/committees-portal.ts`; read it before probing, because a previous sprint burned 300
  probes on 403s by not doing so.
- **Which of our stored rows could carry it?** Report how many `committees-evidence` sections are
  written evidence vs oral evidence vs committee report text — the three need different treatment,
  and a committee's own report conclusion must **never** be attributed to a witness (2D-5 found
  exactly this confusion: two published inquiry "scopes" were the committee's own conclusions).
- **What can be recovered without a full re-fetch?** State the cost of each route: a metadata-only
  API sweep, versus re-fetching document text. A sweep of 45,610 publications is cheap; re-fetching
  508 million words is not.

**Report the audit and the recommended route before building.** If the honest answer is "written
evidence yes, oral evidence needs a different pipeline", say so and scope §2.2 to the achievable
half rather than starting both.

### §2.2 Build

- Capture the attribution into a structured field on the section or its metadata, in the shape
  CC-Search's S8 `attribution` field expects (`{ name, role }` or as built — read their code, do
  not guess; if the shapes disagree, report it as a decision for Charlie rather than bending one
  side silently).
- Distinguish the role: **who submitted** (a witness or organisation) versus **the committee
  itself**. A committee's conclusion carries the committee as author, not a witness. This is the
  difference between "a water company says the rules work" and "the committee found the rules
  work", and getting it backwards is the most damaging error available here.
- Where we hold a register number for the submitting organisation, link to the existing entity —
  but **never merge two identities on similarity** (standing rule). An unresolved name displays as
  the name and nothing more.

### §2.3 Verify

- Coverage rate **as a percentage of committee-evidence sections**, split by written / oral /
  report text, against the audit's prediction (predict-measure-compare — write the prediction into
  the change log before the sweep runs).
- **Hand-read 30 recovered attributions against the source document** and report accuracy,
  separately for "is the name right" and "is the role right".
- End-to-end: run three committee questions through the platform's own search and report how many
  returned results now carry a name. **This is the number that matters** — a field populated in the
  database that never reaches a user is the pattern this project keeps paying for.

---

## §3 — STANDING RULES AND THE REPORT

- Scoped commits by explicit path; `commit-ingest-names.sh`; nothing under search-stream or
  graph-stream ownership edited (report needed changes instead).
- Every check watched failing first. A check that cannot fail is not a check.
- Predictions in the change log before sweeps run.
- Bytes before hypotheses: hand-read samples, not counters.
- **Report `docs/INGEST_NAMES_REPORT.md`:** audit findings first, then per-section rates with what
  each is a percentage OF and what a user would now see, then what is NOT done, named. Any decision
  for Charlie as a numbered question with a recommendation and the consequence of each option.
- Change-log and handoff entries labelled **INGEST**.
