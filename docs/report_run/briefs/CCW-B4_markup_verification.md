# CC BRIEF B4 — A markup-only verification sample

**Track:** corpus · **Owner:** CC-Graph · **Run:** Sunday 30 Aug (short — allow 30 minutes)
**Output location:** `docs/report_run/`. Standing rules: `CLAUDE.md`. No git mid-run.

---

## 1. Why this exists — and it is your own finding, not a correction

Your T5 sample returned **20 of 20 correct**, and you were right to flag what it does not establish:
the sample was stratified by measure, `markup` is 2–5% of the table, and **the draw contained no
markup rows at all**. So the report's headline verification rate currently measures the `text`
detector.

That matters because `markup` is the detector the report leans on hardest — it is the source
document asserting the target **by identity**, and it is what every quoted example in §4 will rest
on. The strongest evidence type is the least tested. This brief fixes exactly that and nothing else.

Your supplementary three-per-detector draw returned markup **2 of 3**. Three rows can show a
detector is not systematically broken; they cannot establish a rate, and none is quoted for them.
This run produces the rate.

---

## 2. What to do

**Draw 25 `markup` rows at random across WS-01, WS-04 and WS-05**, proportional to each measure's
markup population (11 CRAG, 37 HRA, 79 EqA — 127 in total, so roughly 2 / 7 / 16). Verify each live
against legislation.gov.uk, exactly as T5 did.

⚠ **Verify the verifier before scoring a single row.** Make it pass once and fail twice on planted
inputs, and say in the output that you did. A verification pass that cannot fail is worth nothing,
and this is the one number the Method section will print.

⚠ **If a row fails, re-examine it against both our copy and the whole live document before recording
it as a failure.** In sprint 25-H the first pass reported two failures and both were the checker's.
A false finding in this report is worse than a missing one.

---

## 3. Output contract

`docs/report_run/verification_markup.md` and `.json`:

- the rate, stated as **n of N**, with N named as *markup rows drawn from a population of 127*
- per row: source document, provision, target, what the live document said, pass or fail
- for every failure: what it has in common with the others, or a statement that it has nothing
- the verifier self-test result, reported explicitly
- ⚠ **kept separate from the T5 text-detector rate everywhere. The two are never averaged into one
  number.** Two rates with two denominators is the honest presentation; one blended figure is not.

## 4. Record a prediction before drawing

State, before you draw: the pass rate you expect, and how many failures you expect to be the
checker's rather than the data's. Then score against it.

## 5. Done means

- [ ] `verification_markup.md` / `.json` exist, with the rate and its denominator
- [ ] the verifier self-test is reported, with its planted pass and two planted failures
- [ ] every failure is re-examined against the whole live document before being recorded
- [ ] the markup rate and the T5 text rate appear separately and are never merged
- [ ] prediction logged before, actual after
