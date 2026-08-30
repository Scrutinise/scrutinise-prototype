# CCW-B9 — where are the quotable passages?

**Written:** Sun 30 Aug 2026 by CCW. **Runs after B8.** ~20 minutes.

## Why this exists

Charlie gets three free TurboScribe re-transcriptions a day and has used today's three (Parts 1–3).
Four videos remain unverified: Parts 4, 5, 6 and the 46-minute September lecture. At three a day
they all fit before Thursday without paying — but only if they are done in the right order, and only
the corpus can say what that order is.

This brief produces the evidence for that decision. **It draws no conclusions** — per the standing
rule, CC produces evidence and CCW interprets it.

## Step 1 — hit counts by video

Run the existing `scripts/starkey/search.ts` across the terms below and report a table of
**passage hits grouped by video**, restricted to the seven thesis-series videos plus `2Khgz5sMMBU`.
Also report the corpus-wide total for each term, so a term that matches everywhere is visible as
uninformative rather than looking significant.

The three worked measures and their conditional fourth, in report terms:

- **CRAG 2010 Part 1** — `treaty`, `ratification`, `royal prerogative`, `parliamentary scrutiny`
- **Human Rights Act 1998** — `human rights act`, `european convention`, `strasbourg`, `european court`
- **Equality Act 2010** — `equality act`, `equality`, `discrimination`, `protected characteristic`
- **Constitutional Reform Act 2005** — `supreme court`, `lord chancellor`, `constitutional reform`, `judicial review`
- **Framing terms** — `blairism`, `repeal`, `restoration`, `sovereignty`, `common law`, `constitution`

## Step 2 — export the passages

Write every matching passage to `docs/report_run/starkey_hits.json` (git-ignored — add it to the
`.gitignore` in `sources/youtube/` or the report_run one, wherever is cleaner). One record per hit:

```
{ video_id, title, source, start_s, end_s, text, term, watch_url }
```

`watch_url` is the `&t=NNNs` deep link, as B7's search already emits. `source` matters: where a video
has both an `asr` and a `turboscribe` transcript, return the hit from **each**, so CCW can see
directly whether the two engines rendered the same passage differently.

Cap the file at the 400 highest-scoring passages if it would otherwise run large — but report the
number capped, so a truncation is never silent.

## Step 3 — report

1. The hit table from Step 1.
2. For the three videos that now have two transcripts (Parts 1–3): the count of passages where the
   `asr` and `turboscribe` texts differ by more than trivial punctuation. A rough measure is fine —
   normalised word-sequence similarity below about 0.95 on the overlapping time window. This is the
   number that tells Charlie how much a second engine is actually buying him per video.
3. Anything in `starkey_hits.json` drawn from `2Khgz5sMMBU` **after 20:20**, which should be nothing —
   if something appears there, the coverage flag from B7 is wrong and needs re-checking.

Then stop. CCW reads `starkey_hits.json` and decides which of the four remaining videos get
TurboScribe credits, and in what order.
