# BRIEF — SURFACE 1: TELL THE USER WHEN A LAW IS NO LONGER IN FORCE

**Owner:** CC-Surface (new stream)
**Stream:** SURFACE
**Written:** 17 August 2026
**Plan:** `docs/PLAN_SURFACING.md`. Read §1 and §4 — they define what this stream is and is not.

**Where this sits:**
- *The problem:* a fortnight of excellent work, almost none of it reaching a user
- **This: the first surfacing job, and the most correctness-critical**
- *Then:* the corpus made visible · how your MP voted · explicit search

---

## §0 — What this stream is for

**It builds nothing new.** If a job needs new data, new retrieval or new inference, it belongs to
another stream. The test is: *does the data already exist?*

Every other stream's job is to add capability. Nobody's job is to make it visible, and when those
compete, adding wins — because it is what is in front of you and it always feels like progress.
**This stream exists to lose that argument on purpose.**

---

## §1 — The problem, and it is a live wrongness

**Lex can cite a provision as current law when it has been repealed** — with a real citation, a
working link, and nothing to tell the user otherwise. Someone could take that to an MP.

This has been the most serious unexamined risk in the corpus for two weeks. **It is now fixable
because the data exists**: the V36 repeal census holds **178,826 repealed sections**, 25,138 of them
naming the instrument that did the repealing.

⚠ **This is a correctness defect, not a missing feature.** A missing feature disappoints. A confident
citation of a dead provision misleads, and does it in the one place the platform's whole claim
rests.

---

## §2 — What to build

**Join the repeal data to search results and label them.** No new screen.

Three states, and the third is the one that will be got wrong:

| state | what the user sees |
|---|---|
| **repealed, and we know by what** | plainly repealed, with the date and the instrument that did it |
| **repealed, instrument unknown** | plainly repealed, and we do not know by what |
| **no repeal recorded** | ⚠ **not "in force"** — see below |

⚠⚠ **"No repeal recorded" is NOT "in force", and the difference is the whole point of this job.**
We hold repeal records where the source published them. Absence of a record is absence of a record.
Saying "in force" would replace one confident wrong claim with another, and it would be *our* claim
rather than the source's.

**Say what we know. The user can tell the difference; the system cannot.**

### Where it has to appear

- **Every surface that shows a legislation result.** The source panel, the Lex conversation, the
  legislation search panel, the Page-1 briefing. ⚠ **Audit them rather than assuming there are
  three** — the last four audits in this project each found more callers than the brief predicted.
- **In what Lex reads, not only in what the user sees.** If the repeal status is in the panel but
  not in the prompt, Lex will still describe the provision as current while the panel says
  otherwise. **That is worse than not showing it at all**, because the two disagree on screen.

---

## §3 — Verify through the product

**Open the page.** Every stream has learned this the same way: a row existing and a user seeing it
are different claims.

- Find a provision that is definitely repealed, search for it as a user would, and read what comes
  back — in the panel *and* in Lex's answer.
- Do the same for a provision that is definitely in force, and confirm it is not labelled as
  repealed.
- ⚠ **Then ask Lex directly whether the repealed provision is current law**, and read the answer.
  That is the test that matters, because it is the failure this job exists to prevent.

---

## §4 — Report

- Which surfaces show it, and the audit that found them
- Counts: how many results in a normal search carry a repeal record, and how many carry the
  instrument
- The three states, each seen working, with a screenshot or a transcript
- ⚠ **Anything that shows legislation and does NOT now carry the status**, named — a partial fix that
  looks complete is the worst outcome available here

---

## §5 — Standing

- Label change-log and handoff entries **SURFACE**.
- Scoped commits by explicit path; four streams now share this tree.
- ⚠ **One job per sprint, finished.** A half-surfaced feature is worse than none: it looks done and
  behaves badly. If this turns out to be bigger than it looks, report that rather than shipping half.
