# Volume 1 — corrections applied, and what had to be recovered first

**14 September 2026. Source: `docs\report_run\report_src_v2\`. Output: `RESTORATION_1_The_programme_and_the_argument.docx` / `.pdf`, 57 pages.**

---

## 1. The source did not match the volume that was printed

`report_src_v2` was one revision behind the 10 September build Charlie marked up, in four identifiable places. All four were repaired before any correction was applied.

| Gap | Evidence | Repair |
|---|---|---|
| Part 6.1, the opponent test (printed pp.39–42), absent from source | No file contained `47 and 49`, `143 readings`, or `when the proposals were tested`. CC confirmed `12_part6_tests.md` was never committed and does not exist in any git object | Rebuilt as `12_part6_tests.md` **from the primary run data** in `critique\OPPONENT_three_runs.md` and `critique\B22_FOUR_TESTS_INDEX.md`, not from the scan. Every printed figure was checked against those files and every one matched |
| `04_part3.md` carried `## 3.2 · The Great Repeal as a single instrument`, ~194 lines of raw kernel export, absent from the printed volume | Printed p.38 ends Part 3; p.39 begins Part 6 | Deleted |
| Part 1 section titled "The argument underneath all twelve"; printed reads "The Common Thread" | Standing editorial rule 4 | Renamed in `02_framework.md` and `titles.txt` |
| Part 7 missing two printed sections — "The transcript corpus, and how far it has been checked" and "Two corrections made to this paper's own figures" | Neither `Disraeli` nor `74,896` appeared in `13_part7_limitations.md` | Restored, figures checked against the handover's verified corpus counts |

The PDF on disk (`RESTORATION_1_…pdf`, "Second draft, 9 September") was a **third**, still earlier state: its Part 7 is entirely different text. It has been overwritten by the new build.

## 2. Errors found and fixed beyond the mark-up

- **`287 transcripts` → `285 recordings`** in three places. Part 7 already said 285; the handover records 287 as a wrong figure. The document contradicted itself.
- **Measure 6 (civil service) was listed as "Register and summary"** in the twelve-measures table while being worked in full in Volume 2 and appearing as one of the three worked measures in the Part 4.1 results table. Corrected to "Worked in full — Part 6.3", and "Two are worked all the way down" corrected to "Three".
- **Part 7's loose line spacing** was not a spacing setting. `13_part7_limitations.md` was hard-wrapped at ~100 characters, and the builder turns every physical line into its own paragraph with 120 twips of space after it. The file has been unwrapped; no build setting was changed.

## 3. Structural changes

- **Parts renumbered.** Volume 1 now runs Parts 1–5: Part 6 → **Part 4 · Assessing resilience — threat analysis** (4.1 How opponents would overturn it, 4.2 Strategic choices); Part 7 → **Part 5 · Limitations of this analysis**.
- **Volume 2 must take 6 and 7 in exchange.** All cross-references in Volume 1 to the worked measures have already been changed to Part 6.1 / 6.2 / 6.3, and `titles.txt` renumbers Volume 2's Part 5.x to 7.x. **`08_part4.md` and `09_part5_rest.md` have not been touched and still carry the old numbers.** Until they are changed, Volume 1's cross-references point at numbers Volume 2 does not use.
- **Part divider pages.** `build.js` now emits a divider page carrying the Part name, followed by a blank page, before each Part's first section. Dividers carry no running header and no page number.
- **`PARTNAMES` is now per-volume**, set on the volume's entry in `VOLUMES`, because Volume 1's Part 4 and Volume 2's Part 4 are different things.
- **`mkpagemap.py` skips divider and blank pages** (they carry no "FIRST SCRUTINY" running line), so the contents point at content pages.
- Title page now reads "Second draft, revised 14 September 2026".

## 4. Wording chosen where the mark-up asked for words it did not supply

Four places needed a form of words rather than a substitution. These are the ones to read with an eye on.

| Page | Mark | Wording used |
|---|---|---|
| 2 | 6.1 retitled | **"How opponents would overturn it"** (Charlie's longer version: "Testing the risks that these measures are overturned or reversed by opponents") |
| 10 | "find better words" against "Both halves of this must print" | **"Both sides of this have to be stated."** |
| 13 | "[New label]" against "the widely circulated list" | **Not changed.** The source of that list is not known here, and naming one would be invention. Open. |
| 40 | "Not clear. Just give an example or 3 to show why it's weak" | Replaced the abstract passage with the three concrete failures, one per measure |

**"David's Programme" substitution:** 49 non-possessive instances of "the programme" became "David's Programme"; 17 possessives became "the Programme's" rather than "David's Programme's", which does not read. Where two would have fallen in one sentence, the second is "the Programme".

## 5. Not done

- Volume 2 renumbering (Parts 4 and 5 → 6 and 7).
- The `[New label]` question above.
- Appendix B reshape, the fourteen citator validation rows, and the `New Lex First Test - Accountability.docx` rename check — all still outstanding from the session-3 handover.
