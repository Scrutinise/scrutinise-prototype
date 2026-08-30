# CCW-B11 — the five sessions in `David Starkey.docx`, located

**Run 2026-08-30.** **All five found.** Table appended to
`docs/report_run/sources/youtube/_README.md`; full output in
`docs/report_run/b11_sessions_located.json` (no transcript text — ids, scores and metadata only, so
it is safe to commit while the corpus itself stays ignored).
**Tool:** `scripts/starkey/b11-locate-sessions.ts` + a split step, both new.

| # | Session | Video | Published | Length | Score | Band |
|---|---|---|---|---|---|---|
| 1 | *(unlabelled opening)* | `1xsdGfHlIeU` "British state has been WEAPONISED…" | 2026-08-22 | 50:28 | **0.900** | independent engine |
| 2 | Disraeli conference | `tl4DJ50RMuk` "How liberalism poisoned England" | 2026-07-25 | 46:24 | **0.999** | scraped caption copy |
| 3 | With Stephen Barratt | `L820LrgK7Hg` "THIS is why Keir Starmer is so hated" | 2026-06-27 | 42:59 | **0.999** | scraped caption copy |
| 4 | With Danny Kruger | `vDFvOWh6bvM` "This is how Reform will SMASH the Blob" | 2026-05-01 | 43:13 | **0.940** | independent engine |
| 5 | Brexit Started a revolution | `VaPKzYLcZ7Y` "…Historical Importance of Brexit" | 2026-05-20 | 35:04 | **0.990** | scraped caption copy |

**Runner-up scores were 0.157–0.179 in every case except session 5.** The margin is not close, and
`not found` was never in question for any of the five.

---

## 1. The split was established twice, and the two agreed

B11 says to split at the timestamp resets. I used that **and** a second, independent signal — the
session label appearing as its own paragraph — because one signal is a guess:

| join | clock reset at ¶ | label at ¶ | |
|---|---|---|---|
| Disraeli conference | 1133 | 1131 | agree |
| With Stephen Barratt | 1996 | 1993 | agree |
| With Danny Kruger | 3004 | 3003 | agree |
| Brexit Started a revolution | 3995 | 3993 | agree |

The resulting session run-times — **50:00, 46:17, 42:36, 42:49** — reproduce CCW's hand-read table
exactly, which is a third confirmation from outside this run.

⚠ **A first pass found only one of the four joins.** The document uses **two** timestamp notations —
prose (`4 seconds`, `1 minute, 4 seconds`) for the first 1,133 paragraphs and `M:SS` thereafter — and
a parser that knew only the colon form was blind to three quarters of the document. It also carries
literal escaped XML (`<w:rPr>…`) as visible text, 1,042 paragraphs of it, which is structure and is
dropped before matching.

## 2. Session 5 is on the channel twice — and it is the one that matters

B11 flags session 5 as most important: it carries the absorption claim the report's central section
is built to test. Two candidates cleared the band:

| | score vs session 5 | published | length |
|---|---|---|---|
| `VaPKzYLcZ7Y` | **0.990** | 2026-05-20 | 35:04 |
| `dgZ4gyMQ2o8` | **0.959** | 2026-05-22 | 35:26 |

Scored against **each other** they are **0.964** — the same talk, uploaded twice, two days apart.

**Reporting only the winner would have been wrong in a way that costs something.** Both ids are
valid for verifying a quote from that session. Someone checking a citation who found the other
upload would conclude the quote could not be verified. Both are in the README and both are in the
JSON.

## 3. Two sessions are independent re-transcriptions, not copies

Sessions 1 (0.900) and 4 (0.940) sit in B8's *independent engine* band, not the *scraped copy* band.
**Their wording will differ from the ASR held in the corpus**, exactly as the TurboScribe documents
do — and B7 already caught the ASR naming the wrong man in one such divergence ("Israeli" for
"Disraeli"). A quote taken from those two sessions of the `.docx` must be checked against the
**recording**, not against the corpus text, before it is printed.

Sessions 2 and 3 are 0.999 — reformatted copies of the same caption track, carrying no independent
information.

## 4. The metric is imported, not restated — and a second metric checks it

The calibration B11 tells me to reuse belongs to one specific function over one specific window:
`lcsRatio` on `norm()` tokens capped at 2,000 words, from `scripts/starkey/text.ts`, which is what
`docx-disposition.ts` used for B8. **Both are imported.** A re-implemented similarity would produce
numbers B8's bands do not describe — the copied-function trap, and that module's own header says so.

A second, independent metric was computed as a cross-check. Since 5-gram containment ≈ (per-word
agreement)⁵, the two should imply the same per-word rate:

| session | containment | implies per-word | lcs | |
|---|---|---|---|---|
| 1 | 0.548 | 0.887 | 0.900 | consistent |
| 2 | 1.000 | 1.000 | 0.999 | consistent |
| 3 | 1.000 | 1.000 | 0.999 | consistent |
| 4 | 0.754 | 0.945 | 0.940 | consistent |
| 5 | 0.941 | 0.988 | 0.990 | consistent |

**Session 1's containment of 0.548 looks alarming and is not.** It is what an 0.89 word-level match
becomes when raised to the fifth power. Without this check I would have had to either explain the
number away or treat a correct match as doubtful.

## 5. The prefilter cannot hide the answer

`lcsRatio` is O(n·m); five sessions against 285 transcripts at 2,000 tokens is ~5.7×10⁹ cell
operations. A 5-gram containment prefilter shortlists 30 of 285, and `lcsRatio` scores only those.

**The risk is a prefilter whose scope is narrower than the thing it guards** — the shape that cost
this project repeatedly today. So the script reports the **best containment among the excluded**:
0.002–0.005 across all five sessions, against 0.548–1.000 for the winners. There is no near-miss at
the cutoff, and that is measured rather than assumed.
