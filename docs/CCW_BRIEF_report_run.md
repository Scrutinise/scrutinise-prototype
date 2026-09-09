# CCW BRIEF — Restoration Programme report run, 28 Aug – 3 Sep 2026

**Hard deadline: Document B and the summary paper PRINTED by the evening of Thursday 3 September.**
Charlie flies early Friday 4th. A file that exists but is not on paper by Thursday evening has failed.

**Executes against:** `REPORT_SPEC_restoration_programme.md` (what the document contains) and
`CCW_SPEC_starkey_workstreams.md` (per-measure schema, gates, cardinal rule, adversarial rounds).
This brief is the running order only — it does not restate either.

---

## 1. Measures

**Three at full depth, with a fourth conditional.**

| ID | Measure | Status |
|---|---|---|
| WS-05 | CRAG 2010 Part 1 — civil service statutory footing | Full depth. Pilot data exists. |
| WS-01 | Human Rights Act 1998 + ECHR denunciation | Full depth. The keystone. |
| WS-04 | Equality Act 2010, incl. s.149 | Full depth. The volume case. |
| WS-02/03 | Constitutional Reform Act 2005 — Supreme Court, Lord Chancellor | **Conditional. See §3.** |

Why the Equality Act stays despite CRA 2005 being closer to the thesis: it is the measure that
demonstrates pattern collapse at maximum scale, and pattern collapse is the finding that reframes the
whole programme from impossible to large. Without it the report has no answer to "this is obviously
undeliverable".

Why CRA 2005 is worth adding if time allows: its consequential tail is the one the proposer names
himself — roughly 2,000 statutory references to "Lord Chancellor" — and it is cheap to analyse
because that tail is one pattern repeated, not 2,000 problems. It is also where the devolution gate
bites in a way nobody expects: the Supreme Court holds the devolution reference jurisdiction under
Scotland Act 1998 Sch 6 and Northern Ireland Act 1998 Sch 10, and abolishing the court requires that
jurisdiction to go somewhere. Verify that against the corpus before asserting it.

---

## 2. Running order

| Day | Work | Must be true by end of day |
|---|---|---|
| **Fri 28** | Kick off. Sub-agents launched for WS-05, WS-01, WS-04. `inbound()` run on all three; coverage blocks captured. | Reference maps exist for all three |
| **Sat 29** | Gates: devolution, international, Northern Ireland. Case law for the absorption gate. | Gates answered or declared unresolvable |
| **Sun 30** | Argument graph pass — historic objections per measure. Counterparty response clauses where treaties engaged. Part 2 material: absorption, annulment device, Henry VIII analogy. | Part 2 evidence complete |
| **Mon 31** | Pattern collapse and disposition classification, all three. **Time recorded as the work happens.** Typesetting template built and tested on real content. | Pattern tables complete; template proven |
| **Tue 1** | Document B drafted end to end. Part 4 scoping of the remaining measures. Part 5 extrapolation. | Full draft exists |
| **Wed 2** | Adversarial rounds on a different provider. Repairs. **Document B LOCKED end of day.** | Document B final |
| **Thu 3** | Summary paper written from B's finished numbers. Appendices generated. PDF produced **by midday**. Printed. | On paper, in Charlie's hands |

---

## 3. Decision points — dated, with rules stated in advance

**DP-1 — Tuesday 1 Sep, 09:00. Does CRA 2005 go in at full depth?**
- **If** WS-05, WS-01 and WS-04 all have complete pattern tables and gates by Monday evening →
  add CRA 2005 as a fourth worked chapter.
- **If not** → CRA 2005 goes into Part 4 as scoping with its reference count and pattern estimate
  stated, and the report says explicitly that it was scoped rather than worked.

Do not take this decision on Wednesday. Adding a chapter after the red team has run means the new
chapter is untested, which is worse than not having it.

**DP-2 — Wednesday 2 Sep, 18:00. Document B locks regardless of state.**
Anything unresolved at that point goes into the gaps register as a declared limitation, not into
Thursday. Thursday is production, not authorship. A document being edited on print day is how a
deadline is missed.

---

## 4. Production — the risk nobody costs

A 100-page report typeset badly reads as amateur and undoes the work. Three requirements:

1. **Build the template Monday, not Thursday**, and test it on real content — a long pattern table
   and a block-quoted statutory fragment are the two things that break layouts.
2. **Print-first constraints.** No meaning carried by colour alone. No reliance on hyperlinks. Every
   table fits portrait width. Page numbers and running heads on every page — a reader flipping paper
   needs to know where they are.
3. **The data appendix cannot be printed.** Appendix A is a CSV/JSON file of the full reference lists.
   Put a short URL and a QR code in the printed Appendix A pointing at it. Confirm the link resolves
   from a phone before printing.

**PDF by midday Thursday.** Printing fails — toner, page counts, binding. Half a day of slack is the
minimum and it is not optional.

---

## 5. Standing rules for this run

From `CCW_SPEC_starkey_workstreams.md`, restated because they matter most under time pressure:

- **Every assertion resolves to a corpus row.** Under deadline the temptation to write around a gap
  is strongest. A gap recorded is a finding; a gap papered over is a defect that a hostile reader
  will find first.
- **Red team on a different provider than the constructor.** Same-family models miss the same things.
- **Record the numeric prediction before each adversarial round.** A round returning fewer items than
  predicted means the prompt was weak, not that the draft was strong.
- **Time measurement is data, not admin.** Part 5's extrapolation is only defensible if the per-pattern
  times were recorded while the work happened. Reconstructed estimates are worthless and a reader
  will ask.
- **Never present a count as complete.** Every figure carries what it is a count of and what it is a
  fraction of.

---

## 6. Reporting to Charlie

Once daily, end of day, short. What was predicted, what was found, whether they matched, what it
means for tomorrow, and anything that needs a decision. If a day's "must be true by end of day"
condition failed, say so that evening — not the next morning. With six days of slack in total, a
lost day disclosed late is the difference between adjusting and missing.
