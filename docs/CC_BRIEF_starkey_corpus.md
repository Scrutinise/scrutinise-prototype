# CC BRIEF — Starkey transcript corpus

**Prepared by:** Cowork session, 30 Aug 2026
**Owner:** CC on the Windows box (this needs unrestricted network access and credentials — the Cowork sandbox has neither)
**Input file:** `video_ids.txt` — 285 unique YouTube video IDs, already deduplicated and length-validated (2 duplicates removed from Charlie's list of 287)

---

## Objective

Build a searchable transcript corpus of the David Starkey Talks YouTube channel, timestamped, so that any passage can be found by keyword and checked against the source recording in seconds.

**Why this matters:** it feeds the Restoration Programme scrutiny report (print deadline Thu 3 Sep 2026), where every quote must be verified against the recording before print. Timestamps are therefore not decoration — they are the verification mechanism. Do not discard them at any stage.

---

## Phase 1 — Fetch (do this first, it is the only time-critical part)

Use `yt-dlp`. Fetch **subtitles only** — never the video or audio streams. 285 subtitle files is a few MB; 285 videos is hundreds of GB.

```bash
# --skip-download: we want captions, not media. Downloading video would be
# ~1000x the bandwidth for zero added value.
# --write-auto-subs: YouTube's machine-generated captions (ASR). Most of this
# channel will have these and nothing else.
# --write-subs: human-authored captions where they exist — always better than
# ASR, so prefer them when both are present.
# --sub-format vtt: WebVTT keeps start AND end timestamps per cue. Plain-text
# transcript formats throw the timing away, which would break quote verification.
# --sleep-requests 2: YouTube throttles or blocks rapid sequential requests.
# 2s x 285 adds ~10 minutes and avoids losing the run halfway.
yt-dlp \
  --skip-download \
  --write-auto-subs \
  --write-subs \
  --sub-langs "en.*" \
  --sub-format vtt \
  --write-info-json \
  --sleep-requests 2 \
  --ignore-errors \
  -o "raw/%(id)s.%(ext)s" \
  -a video_ids.txt
```

`--write-info-json` gives title, upload date, duration and channel per video. We need the titles — see the open question at the end about identifying the six-part "David Starkey thesis" series.

**Expected runtime:** 10–20 minutes for all 285.

**Report back:** how many succeeded, how many had human captions vs auto-captions only, and the ID of anything that failed. A failed ID may mean I mistyped it when I built the list — that is the main risk in this file, and a 404 is how it will show up.

The four Shorts (`aRO-UdLC3L8`, `5MQq_WlGpe0`, `qnyeiHLhroQ`, `Ef5yktOArxc`) work through the same command; no special handling needed.

## Phase 2 — Store

**Raw `.vtt` and `.info.json` files are the source of truth. Keep them.** Everything in the database is derived and must be rebuildable from them without re-scraping. This is the point: if we change the schema, we re-derive in seconds rather than going back to YouTube and risking a block.

Target: Neon Postgres, in a **separate schema** called `starkey` — see open question 2 before creating it.

```sql
CREATE SCHEMA IF NOT EXISTS starkey;

-- One row per video.
CREATE TABLE starkey.video (
  video_id        text PRIMARY KEY,          -- YouTube's 11-char ID
  url             text NOT NULL,
  title           text,
  published_on    date,
  duration_s      integer,
  is_short        boolean NOT NULL DEFAULT false,
  caption_source  text NOT NULL,             -- 'human' | 'asr'
  fetched_at      timestamptz NOT NULL DEFAULT now()
);

-- One row per caption cue, exactly as it came out of the VTT file.
-- Cues are 3-8 seconds each, too granular to read but exactly right for
-- locating a quote in the recording. This table is never edited by hand.
CREATE TABLE starkey.cue (
  id        bigserial PRIMARY KEY,
  video_id  text NOT NULL REFERENCES starkey.video(video_id) ON DELETE CASCADE,
  start_s   numeric(10,3) NOT NULL,
  end_s     numeric(10,3) NOT NULL,
  text      text NOT NULL
);
CREATE INDEX ON starkey.cue (video_id, start_s);

-- Consecutive cues glued into readable chunks of roughly 60-90 seconds,
-- carrying the start time of their first cue. This is the unit we SEARCH.
-- Rationale: a 5-second cue is too short to contain an argument, and a full
-- transcript is too long to be a search result. A minute of speech is one point.
CREATE TABLE starkey.passage (
  id        bigserial PRIMARY KEY,
  video_id  text NOT NULL REFERENCES starkey.video(video_id) ON DELETE CASCADE,
  start_s   numeric(10,3) NOT NULL,
  end_s     numeric(10,3) NOT NULL,
  text      text NOT NULL,
  tsv       tsvector GENERATED ALWAYS AS (to_tsvector('english', text)) STORED
);
CREATE INDEX ON starkey.passage USING gin (tsv);
CREATE INDEX ON starkey.passage (video_id, start_s);
```

Notes on the design:

- **`tsvector` / GIN index** — Postgres's built-in full-text search. It turns text into indexed word-stems so `WHERE tsv @@ plainto_tsquery('english', 'human rights act')` returns matching passages instantly across the whole corpus. It is free, needs no external service, and is the right first tool.
- **No embeddings yet, deliberately.** Semantic search (pgvector) costs money to build and adds a dependency. Build keyword search first, measure whether it finds what Charlie needs, and only add embeddings if it demonstrably does not. If keyword search on a single speaker's 285-video corpus is adequate — and it very likely is, because Starkey's vocabulary is distinctive — we save the cost entirely.
- **Size:** roughly 1.5M words total, about 10–15 MB of text. Trivial for Postgres. Storage is not a consideration here.

## Phase 3 — Verification (required, not optional)

1. Row counts: `starkey.video` should be 285 minus any confirmed failures. Report the number.
2. For three videos picked at random, open the video at a passage's `start_s` and confirm the words on screen match the stored text. This is testing the timestamp alignment, which is the thing the report depends on.
3. Confirm a keyword search returns sane results: `human rights act`, `common law`, `sovereignty`.
4. Report any video where the caption file is present but under ~200 words — that usually means the ASR failed or the video is mostly music, and it should be flagged rather than silently included.

## What NOT to do

- Do not download video or audio.
- Do not republish or expose this corpus publicly. It is a private research corpus of another person's published work, gathered for a report. Keeping it private is both the polite position and the safe one.
- Do not "clean up" ASR text by guessing at words. Where the machine transcript is wrong, it must stay visibly wrong so that Charlie knows to check it. A tidied transcript that reads well is more dangerous than a rough one, because it hides the errors.

## Open question for CC to answer from the data

Charlie says the core material is a **six-part series called "The David Starkey thesis"**. I cannot identify which six of the 285 those are from the URLs alone. Once Phase 1 has the titles from the `.info.json` files, list every video whose title contains "thesis" (case-insensitive) with its ID, title and duration, and send that list back. That resolves it without Charlie having to hunt.
