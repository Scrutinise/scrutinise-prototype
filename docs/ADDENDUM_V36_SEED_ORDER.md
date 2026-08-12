# ADDENDUM TO V36 — SEED IN CITATION ORDER, AND THREE SCOPE DECISIONS

**Owner:** CC-Ingest
**Stream:** INGEST
**Written:** 12 August 2026, after reading `V37_CORPUS_INTEGRITY_REPORT.md`
**Amends:** `BRIEF_INGEST_V36_MISSING_INSTRUMENTS.md` §2. Everything else in V36 stands.

---

## §0 — Why this addendum exists

V37 measured something V36 could not have known: **the citation-ranked queue and the completeness
work list point at different ends of the same corpus.** The citation queue's top entry is the
Companies Act 2006. V36's completeness list is 95% Georgian local and personal Acts that yield no
text.

You wrote that comparison down as a finding rather than leaving it implicit, and it is the most
useful sentence in either report. It should now change what gets seeded first.

---

## §1 — The sequence is unchanged; the ordering within it is not

**Still: commit and push, then seed.** The workers run pushed code and the scheduler wakes them
within about 25 minutes, so seeding an unpushed fix recreates the defect across the whole list.

**Changed: seed the work list in descending citation-reference order**, using
`CORPUS_CITATION_GAPS.md` as the sort key, rather than as a flat list or in identifier order.

Reasoning, and it is worth stating because it is not only about speed. A run of this size will be
interrupted — by a laptop closing, a throttle, a failure. **The order determines what we have when
that happens.** Sorted by citation count, an interruption at 10% leaves the corpus holding the
instruments the rest of the corpus most often refers to. Sorted any other way, it leaves an
arbitrary tenth.

⚠ **Instruments with no citations at all still get fetched** — they go last, not never. The value
of fetching a Georgian local Act is not its text, which does not exist; it is that a silent absence
becomes a classified known unknown. That was V36 §2's second requirement and it still holds.

---

## §2 — Three scope decisions, answered

You flagged these rather than assigning them a reason, after a first draft nearly mislabelled `mwa`
as out of scope when the corpus holds 22 of them. That was the right call and the right reason.

### `apni` — Acts of the Parliament of Northern Ireland, 1921–1972. **INGEST.**

1,264 instruments, 2,602 references. **This is fifty years of Northern Irish primary legislation and
the corpus has nothing for the period** — we hold `nia` from 2000 and `nisi` Orders in Council, and
a five-decade hole between them.

It is not a marginal call. Much of that legislation is still in force, it is cited 2,602 times by
material we already hold, and a platform that cannot answer a question about Northern Irish law from
before 1972 while claiming UK coverage is making a claim it cannot support. **Verified present at
source.**

### `ukcm` — Church Measures. **INGEST.**

245 instruments, 6,803 references — `ukcm/1969/2` alone carries 1,108. A Measure is passed by General
Synod and has **the force of an Act of Parliament**. It is primary legislation by any test that
matters, whatever its subject, and the reference count says our own corpus treats it as such.

### `ukci` — Church Instruments. **INGEST, alongside `ukcm`.**

Same family, same pipeline, small volume. Splitting them would leave the Measures without their
subordinate instruments, which is the same mistake as holding an Act without its regulations.

⚠ **These three are additions to the corpus targets, not to the V36 recovery run.** Scope them as
their own ingest, priced and predicted separately. Folding a new source into a recovery sprint is
how a run stops being attributable.

---

## §3 — Everything else in V37, unchanged

- **§3 (live miss logging) and the monthly scheduling of §2 are not done, and that is fine for now.**
  They are worth doing and neither blocks anything.
- **The filler stays refusing to run.** Exiting 3 with the six unwired steps listed — including the
  two service restarts — is the correct behaviour, and the reasoning is right: a gap half-filled
  stops appearing in the report while still missing from the answers.
- **The dot-leader census is still outstanding** and is now the highest-value item after the
  recovery. Read the objects, count them properly, and act on the census rather than on the
  400-sample extrapolation.

⚠ **And one extension to the dot-leader work, which turns it from a cleanup into a capability.**
Those dots are the source telling us **which provisions have been repealed** — dated and identified.
Currently the platform cannot tell a user that a section is no longer in force, and I have been
calling that the most serious unexamined risk in the corpus for a week. Capture the repeal as
structured data rather than only suppressing the empty text, and a liability becomes the answer to a
question we could not previously answer at all.

---

## §4 — One thing worth saying about the numbers

**44.1% coverage reads worse than it is, and the report is careful about this in a way a summary
would not be.** 139,440 of the 181,353 absences are instruments where the source itself holds no
provisions — the text does not exist to be fetched. The recoverable population is **41,913**.

Modern law is in good shape: `primary-acts-2000plus` 99.5%, `anaw` and `asc` 100%, `asp` 99.8%,
`nia` 98.7%. The gaps are historic material and the EU family, and most of the historic gap is the
source having nothing rather than us having missed it.

**That distinction should survive into anything user-facing.** "We hold 44% of published instruments"
and "we hold 44% of published *text*" are very different claims, and only the first is true.
