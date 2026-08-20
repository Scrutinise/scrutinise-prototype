# BRIEF — INGEST: THE CASE-LAW TEXT IS A STYLESHEET

**For:** CC-Ingest
**Written:** 20 August 2026, by CCh-Search
**Context:** `docs/INGEST_NAMES_REPORT.md` — decisions **D-4** (stored text) and **D-3** (dates)
**Format:** audit-then-build. **§1 is a scoping audit to report before any rebuild starts.** No git
during the sprint; one **`commit-ingest-caselaw-text.sh`** at the end (standing rule: commit scripts
named per stream and per sprint). **Scoped commits by explicit path only** — three threads share this
tree and `git add -A` is how one session commits another's half-finished work.

---

## §0 — WHY THIS IS THE TOP OF THE QUEUE

**What a user sees.** They search for a court judgment. The title is now correct — that was fixed
last night. The text beneath it is **CSS**. The platform's evidence for *R (Miller) v The Prime
Minister* begins `#judgment { font-family: 'Times New Roman'; … }`. Sampled at **200 of 200
documents**, so the working assumption is the whole collection.

**Why it is worse than it looks.** Case law is one of five retrieval streams. Every judgment that has
ever reached a user, and every judgment ever handed to Lex as evidence, has been formatting code. A
model given formatting code will not say "this is formatting code" — it will find nothing useful and
either fall silent or reach for something else. That means:

- Any measurement of case-law retrieval quality we hold is void. The keyword index was built over
  stylesheet text, so what it matched on was never the judgment.
- The +12.5 percentage-point gain measured for meaning-based search on case law was measured over
  this same text and cannot be trusted either.
- ⚠ **Do not assume last night's title recovery caused or worsened this.** It did not; it made it
  visible, by putting a correct name above meaningless text.

Fixing it requires re-compiling the stored text and rebuilding the index over it. **How big that is
is not yet known, and §1 exists to find out before anything starts.**

---

## §1 — SCOPE IT BEFORE YOU REBUILD. REPORT AND STOP.

Answer these, with numbers read off the system rather than estimated, and **report before building**:

1. **Where does the stylesheet come from?** The source publishes judgments as AKN XML (Akoma Ntoso —
   the legal-document XML standard the National Archives uses). Establish whether we are storing a
   rendered HTML form that includes a `<style>` block, extracting the wrong node, or taking the first
   text node in the document. Print two real examples end to end.
2. **Is the good text still on disk?** This is the question that decides the size of the job. If the
   raw source (R2 object storage) still holds the original AKN XML, this is a re-compile from what we
   have. If only the compiled bad text survives, it is a **re-fetch** from the National Archives, and
   that is a different sprint with a different cost. Say which, with evidence.
3. **How wide is it?** 200 of 200 in `tna-caselaw` is the sample. Check the same question on
   `ni-judgments`, `scottish-courts`, `et-decisions`, `tax-tribunals`, `echr-hudoc`. ⚠ The names
   report already flags that `scottish-courts` stores a truncated slug as prose — related failure
   class, possibly the same writer bug, and worth checking together.
4. **What does the rebuild cost?** Document count, estimated compile time, index build time, and
   which machine it runs on. ⚠ **Heavy index builds run on the rented large-memory compute, never on
   the always-on serving host** — standing rule, and this is exactly the size of job it exists for.
5. **What breaks while it runs?** State whether case-law search degrades or goes dark during the
   rebuild, and whether the rebuild can be staged so the live index is only swapped at the end.

**If the answer to (2) is "re-fetch", stop and report.** Do not begin a bulk re-fetch of 74,896
judgments on your own authority — that is a decision for Charlie, with the National Archives' rate
limits and our own time cost stated.

---

## §2 — FIX THE WRITER FIRST, THEN THE BACKLOG

Order matters. The same mistake was made last night's way round and it worked well: correct the code
that writes new rows, then sweep the existing ones.

1. **Fix the extraction** so a newly ingested judgment stores the judgment text and no stylesheet.
   ⚠ **Do not solve this by stripping CSS from the output with a pattern match.** Stripping treats
   the symptom; the writer is selecting the wrong content and will select something else wrong next
   time. Extract the correct node from the source structure.
2. **A check that watches itself fail:** assert that no stored case-law body begins with, or is
   predominantly, style-sheet content — and prove the check fires by planting one. Then assert the
   positive: a known judgment's stored text contains a phrase that appears only in the judgment
   itself. **A check that only tests for the absence of the bad thing passes on an empty string.**
3. **Then the backlog**, per §1's scoping — re-compile, then rebuild the index, then verify.

---

## §3 — VERIFY THROUGH THE PLATFORM, NOT THE DATABASE

Last night's sprint got this right and it is the standard here: a field fixed in the database that
never reaches a user is the pattern this project keeps paying for.

- Sample **30 judgments**, hand-read the stored text against the source, and report how many are
  right. A parser's own success count is not evidence.
- Then run three case-law questions **through the platform's own retrieval** and quote what comes
  back. That is the number that matters.
- ⚠ **Report the keyword and meaning-based halves separately.** The index is rebuilt from the new
  text; if one half still returns stylesheet content, the rebuild did not cover it.
- Record the prediction in the change log **before** the rebuild runs (predict–measure–compare).

---

## §4 — D-3: THE CASE-LAW DATES, AUTHORISED

**Charlie has authorised the 13-minute rerun.** Judgments ingested before 19 August carry the
citation *year* as their date (`[2019] UKSC 41` stored as 1 January 2019, handed down 24 September
2019); rows written since carry the true date. Two date conventions in one collection means anything
sorted or filtered by date is quietly wrong.

- Run it. Report the count moved and the residual — how many rows still cannot be dated, **as a
  percentage of the collection** — and what a user would see for those.
- ⚠ **Sequence it with §2 deliberately and say which order you chose and why.** If the text
  re-compile rewrites the same rows, running the date sweep first may be wasted work, or may be the
  safer isolation. Your call, reasoned in the report.

---

## §5 — HOUSEKEEPING

- **Commit `docs/BRIEF_*.md` by explicit path.** Several briefs (including this one) sit untracked
  because no session will commit another's files. Our own rule is that a brief written to disk is
  what survives a session clear, and untracked is not that. Commit them by name — do not sweep the
  directory, and do not touch `AMENDMENT_25B.md` or anything under `Archive/`.
- ⚠ Two other sessions are live in this tree (CC-Lex on the Deepening display fixes, CC-Graph on
  3B). Nothing owned by them is edited here; report needed changes instead.

## §6 — STANDING RULES AND THE REPORT

- Every check watched failing first. A check that cannot fail is not a check.
- Bytes before hypotheses: read stored text and rendered results back; never infer from the writer.
- **Report `docs/INGEST_CASELAW_TEXT_REPORT.md`:** §1's scoping first and on its own, since it may
  change the whole shape of the sprint. Then what was fixed, then the before/after with what each
  figure is a percentage OF and what a user would now see. Then what is NOT done, named. Any
  decision for Charlie as a numbered question with a recommendation and the consequence of each
  option.
- Name exactly what Charlie should click, since Vercel is unreadable from your machine.
- Change-log and handoff entries labelled **INGEST**.
