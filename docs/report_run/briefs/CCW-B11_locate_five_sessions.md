# CCW-B11 — find the five sessions in `David Starkey.docx` inside the corpus

**Written:** Sun 30 Aug 2026 by CCW. **Runs any time after B7.** ~15 minutes.
**Output:** appended to `docs/report_run/sources/youtube/_README.md`, plus a short report.

---

## Why this exists — it removes a job from Charlie

`docs/report_run/sources/David Starkey.docx` is an auto-generated compilation of **five** sessions,
stitched end to end with per-segment timestamps that reset at each join. CCW identified the joins by
watching the clock reset:

| # | Label in the document | Runs to |
|---|---|---|
| 1 | *(unlabelled opening — Cecil / Westminster Abbey material)* | 50:00 |
| 2 | Disraeli conference | 46:17 |
| 3 | With Stephen Barratt *(Barrett, the barrister)* | 42:36 |
| 4 | With Danny Kruger | 42:49 |
| 5 | Brexit Started a revolution — Freedom Association | — |

**None of them carries a URL.** Charlie was asked to find five links by hand. He should not have to:
the corpus now holds 285 videos of the same channel, so the match can be measured instead.

⚠ **Session 5 matters most.** It carries the absorption claim — the sentence the report's most
important section is built to test — and the "Great Statute of Westminster" passage.

---

## What to do

Reuse B8's method exactly, because it worked and its threshold is already calibrated: extract each
session's text, compare against every ASR transcript in `starkey.cue`, and report the best match by
normalised word-sequence similarity.

1. **Split the .docx into its five sessions** at the timestamp resets. The timestamps are their own
   paragraphs (`0:04`, then `4 seconds`, then the text), so a reset is a paragraph whose time is
   lower than the previous one.
2. **Match each session** against the corpus. Report the top three candidates per session with their
   scores, not just the winner — a weak best match is a finding, and CCW needs to see the margin.
3. **Report the score.** B8's calibration holds: a genuinely different recording scores low; the same
   audio through a different engine lands **0.84–0.90**; a scraped copy of the same caption track
   lands **0.975+**. Say which band each session falls in.

## Output

Per session: the label, the winning `video_id`, title, publish date, duration, the similarity score,
the two runners-up with their scores, and the `watch_url`.

Then append the table to `sources/youtube/_README.md` so nobody re-derives it.

## ⚠ Two things to watch

- **A session may not be in the corpus at all.** The 285 are one channel; a conference recording
  hosted elsewhere will not match anything. If the best score is low across all candidates, say
  **"not found in corpus"** and give the best score anyway — that is the honest answer and it tells
  CCW to fall back to asking Charlie for that one link only.
- **Do not force a match.** A confident wrong video id would send a human to verify a quote against
  the wrong recording, which is worse than no id at all.

## Done means

- [ ] five sessions split, with the paragraph index of each join recorded
- [ ] top three candidates and scores reported per session
- [ ] each session classified: found (with id and deep link) or not found (with best score)
- [ ] table appended to `_README.md`
