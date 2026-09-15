# Volume 2 — what was recovered, and the audit that confirmed nothing else is missing

**15 September 2026. Source: `docs\report_run\report_src_v2\`. Output: `RESTORATION_2_The_measures_worked.docx` / `.pdf`, 126 pages (was 120).**

---

## 1. Six pages of 6.1 were recovered from the correction scan, not from disk

The drafted clauses, the scale-of-amendment material and the operational-actions table shown on printed pages 7–13 of the 10 September Volume 2 are **not on disk in any form**. Confirmed three ways:

| Route | Result |
|---|---|
| Every `.md` file under `report_run` | No match for `mechanical amendment`, `draft clause`, `Illustrative clauses`, `absorption problem`, `not an accident of drafting`, `Repeal of the Human Rights Act 1998` |
| Every `.pdf` on the machine, converted to text | Same probes, no match. The Volume 2 PDF on disk is a 14 September rebuild without the material |
| `git log --all -S` on three probe strings, and on `draft_clauses.md` at any path | 0 commits (CC, 14 September) |

**The text was recovered from `Starkey vol 2 corrections.pdf`** — the 56-page scan of the printed volume. Printed pages 7 to 13 are photographs of the lost text, and it was transcribed from the images.

⚠ **This is recovery, not regeneration.** The wording is the wording David read. Where a printed defect was carried over, it is named in section 3 below and fixed.

### What came back

- **The nineteen rights table** — each Article of Schedule 1, its position outside the Act, and a verdict. Fourteen survive repeal by another route; five need a decision; two of those five turn on the Equality Act measure.
- **Illustrative clauses** — Clause 1 (the repeal, and the four subsections where the difficulty lives), Clause 2 (the absorption problem; *Osborn*, *Kennedy*, *A v BBC*, *UNISON*; the six lines of attack; Options A / B / C with the recommendation of C), Clause 3 (the three devolution deletions).
- **The scale** — 382 statutory instruments, 1,013 references, the order-of-a-thousand consequential amendments with worked examples A, B and C.
- **The operational actions table** — seven items with named owners, HMCTS through to the territorial offices.

### The two marks on printed page 13, applied

| Mark | Applied as |
|---|---|
| "delegated" → **"automated"** | "…why the thousand cannot simply be **automated**." |
| "I don't understand — you just said they were examples of the thousand?" | The printed sentence said "the three above are not among the mechanical thousand" directly after listing three examples *of* the thousand. It meant the three **clauses**. Rewritten to say so, and to state explicitly that examples A, B and C *are* illustrations of the thousand. |

---

## 2. Two further gaps found by the audit

**The eight-actions honesty note (printed page 6) was missing from source.** It reads: *"Four distinct actions, listed eight times. The list below repeats… That repetition is not a transcription error — it is what the strategy test meant by a list, not a coordinated plan, and it is printed as it stands so the defect is visible rather than tidied away."* Restored at the head of 6.1's Coherent actions. It is the note Volume 1 Part 5 refers to when it records "eight actions where there are four".

**The 6.1 challenge count contradicted Volume 1.** Source said **89**; Volume 1 Part 5 publishes the correction to **59**, on the ground that 89 counted revisions rather than distinct challenges. Volume 2 now says 59, with one line recording that the group subtotals beneath it add to 89 because they count entries as revised.

---

## 3. A printing defect that was in the copy David read

**A literal `****` printed 149 times across Volume 2** — 75 in Part 6, 74 in Part 7 — at the head of challenge entries. Cause: the data export left the label field empty, and the builder emitted the empty bold markers rather than nothing. The empty prefix has been stripped. No text was lost; there was no label to restore.

---

## 4. The audit itself

Both correction scans were OCR'd in full — `Starkey vol 2 corrections.pdf` (56 pages, printed 1–56) and `Vol 2 part 2 - no corrections.pdf` (62 pages, printed 57–118). Every line of ten words or more was normalised and matched against the rebuilt volume on 8-word overlapping fragments. Lines matching below one third were read by hand.

**208 weak matches in the first scan and 106 in the second.** After triage:

| Category | Count (approx.) | Status |
|---|---|---|
| Running headers and OCR noise | ~180 | Ignored |
| "Understanding the terrain" / "Evidence base" retrieval lines | ~24 | Deleted on instruction (p.4 mark, "not helpful to the reader") |
| "Where the sources disagree" claim/against blocks | ~45 | Reframed as "The methods used by the Establishment to block change". Substance checked and present, including the section 75 / ECNI enforcement point, the "cry-baby response of the weak Minister" and the poll tax counter-example |
| "The research changed my mind" passages | ~20 | Deleted on instruction (p.15 and p.31 marks) |
| "The proposer misidentifies the target" | 1 | Deleted on instruction; Northcote-Trevelyan added as a material cause instead |
| Table rows broken across cells by the text extractor | ~30 | Checked individually against the build — all present |
| Consequential-decisions note in Part 7, reworded from "Part 4" to "Part 6" | 9 | Present, renumbered |
| **Genuine losses** | **2** | The eight-actions note and the challenge count, both fixed above |

**Volume 1 was checked the same way** against the 9 September build. The only contents-list difference is a renamed Part: "Part 6 · The questions only David can answer" is now **Part 4.2 · Strategic choices — the questions only David can answer**, and has grown from 20 numbered questions to 26. Nothing is missing.

---

## 5. State of play

**Ready to send:** Volume 1, 64 pages. Volume 2, 126 pages.

**Outstanding, not blocking:**

- The three Equality Act scope questions (whether the substantive protections go, whether "protected characteristics" goes with them, whether devolved and arm's-length bodies are forbidden positive discrimination or merely not required to practise it). 6.2 is worked on the narrow reading and says so on the page. These are questions **for** David.
- Volume 3: Appendix B compression (a Bill key with abbreviations, one-line rows) and the stakeholder map of organisations and named voices for and against.
- Volume 1's title page reads "revised 14 September" and Volume 2's "revised 15 September". Both are accurate — Volume 1 has not changed since the 14th.
