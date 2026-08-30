# CCW-B7 — Starkey transcript corpus

**Written:** Sun 30 Aug 2026 by the Cowork session.
**Independent of B2–B6.** It shares no input or output with them and can run alongside, or in a
separate CC session. Phase 1 is mostly waiting on the network, so start it early and let it run.
**Input:** `docs/report_run/sources/youtube/video_ids.txt` — 285 unique YouTube video IDs from the
David Starkey Talks channel, deduplicated and length-validated by CCW (2 duplicates removed from
Charlie's list of 287).

---

## Objective

A searchable, timestamped transcript corpus of the David Starkey Talks channel, so any passage can
be found by keyword and checked against the source recording in seconds.

**Why timestamps are non-negotiable:** this feeds the Restoration Programme report, where every
quote must be verified against the recording before print. The timestamp is the verification
mechanism. Do not discard it at any stage, and do not accept a transcript format that lacks it.

---

## Phase 1 — Metadata first, captions second

Charlie says the core material is a six-part series called "The David Starkey thesis". Nobody has
identified which six of the 285 those are. Resolve that from the data before spending time on the
full fetch, because those six are on the report's critical path and the other 279 are not.

```bash
cd docs/report_run/sources/youtube

# Metadata only — no captions, no media. This is fast and tells us which videos
# are the thesis series, so the caption fetch can be ordered by what matters.
yt-dlp --skip-download --no-write-subs --write-info-json \
       --sleep-requests 1 --ignore-errors \
       -o "meta/%(id)s.%(ext)s" -a video_ids.txt
```

Then report back, before going further:

- every video whose title contains "thesis" (case-insensitive), with ID, full title, duration and
  upload date
- the total count of metadata files retrieved, and the ID of anything that failed

**A failed ID probably means CCW mistyped it** when transcribing 285 eleven-character IDs by hand
from Charlie's list. That is the known weak point in the input file, and a 404 is how it surfaces.
Report failures; do not silently skip them.

## Phase 2 — Captions

Fetch the thesis videos first, then the remainder.

```bash
# --skip-download: captions, not media. The video streams are ~1000x the bytes
#   for no added value here.
# --write-subs + --write-auto-subs: prefer human-authored captions where they
#   exist; fall back to YouTube's machine ones (ASR). Most of this channel will
#   be ASR only.
# --sub-format vtt: WebVTT carries a start AND end time on every cue. Plain-text
#   transcript formats throw the timing away, which breaks quote verification.
# --sleep-requests 2: YouTube throttles rapid sequential requests. 2s x 285 adds
#   ~10 min and avoids losing the run halfway through.
yt-dlp --skip-download --write-subs --write-auto-subs \
       --sub-langs "en.*" --sub-format vtt \
       --sleep-requests 2 --ignore-errors \
       -o "raw/%(id)s.%(ext)s" -a video_ids.txt
```

Expect 10–20 minutes for all 285. The four Shorts (`aRO-UdLC3L8`, `5MQq_WlGpe0`, `qnyeiHLhroQ`,
`Ef5yktOArxc`) need no special handling.

## Phase 3 — Store

**The raw `.vtt` and `.info.json` files are the source of truth. Keep them under
`docs/report_run/sources/youtube/`.** Everything in the database is derived and must be rebuildable
from them without re-scraping. That is the point: if the schema changes we re-derive in seconds,
rather than going back to YouTube and risking a block.

Target: Neon, in a **separate schema** called `starkey` — Charlie's decision, so the research corpus
and Scrutinise's production tables never get confused with one another.

```sql
CREATE SCHEMA IF NOT EXISTS starkey;

CREATE TABLE starkey.video (
  video_id      text PRIMARY KEY,        -- YouTube's 11-char ID
  url           text NOT NULL,
  title         text,
  published_on  date,
  duration_s    integer,
  is_short      boolean NOT NULL DEFAULT false,
  fetched_at    timestamptz NOT NULL DEFAULT now()
);

-- One row per transcript of a video. There will be more than one for some:
-- see "Two transcripts per video" below.
CREATE TABLE starkey.transcript (
  video_id   text NOT NULL REFERENCES starkey.video(video_id) ON DELETE CASCADE,
  source     text NOT NULL,      -- 'asr' | 'human' | engine name e.g. 'whisper-zendocs'
  engine     text,               -- free text: what actually produced it
  loaded_at  timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (video_id, source)
);

-- One row per caption cue, exactly as it came out of the VTT. Cues run 3-8
-- seconds: too granular to read, exactly right for locating a quote in the
-- recording. Never edited by hand.
CREATE TABLE starkey.cue (
  id        bigserial PRIMARY KEY,
  video_id  text NOT NULL REFERENCES starkey.video(video_id) ON DELETE CASCADE,
  source    text NOT NULL DEFAULT 'asr',
  start_s   numeric(10,3) NOT NULL,
  end_s     numeric(10,3) NOT NULL,
  text      text NOT NULL
);
CREATE INDEX ON starkey.cue (video_id, source, start_s);

-- Consecutive cues glued into 60-90 second chunks, carrying the start time of
-- their first cue. This is the unit we SEARCH: a 5-second cue is too short to
-- contain an argument, a full transcript is too long to be a search result.
-- Roughly a minute of speech is one point.
CREATE TABLE starkey.passage (
  id        bigserial PRIMARY KEY,
  video_id  text NOT NULL REFERENCES starkey.video(video_id) ON DELETE CASCADE,
  source    text NOT NULL DEFAULT 'asr',
  start_s   numeric(10,3) NOT NULL,
  end_s     numeric(10,3) NOT NULL,
  text      text NOT NULL,
  tsv       tsvector GENERATED ALWAYS AS (to_tsvector('english', text)) STORED
);
CREATE INDEX ON starkey.passage USING gin (tsv);
CREATE INDEX ON starkey.passage (video_id, source, start_s);
```

Design notes:

- **`tsvector` + GIN index** is Postgres's built-in full-text search: text reduced to indexed word
  stems, so `WHERE tsv @@ plainto_tsquery('english','human rights act')` returns matching passages
  instantly across the corpus. Free, no external service, and the right first tool.
- **No embeddings yet, deliberately.** Semantic search costs money and adds a dependency. Build
  keyword search, use it, and add pgvector only if it demonstrably fails to find what Charlie needs.
  On a single speaker with a distinctive vocabulary it very likely will not fail — and if it does,
  the queries it missed are exactly what we would need to configure an embedding layer properly.
- **Size:** roughly 1.5M words, 10–15 MB of text. Storage is not a consideration.

## Two transcripts per video

Charlie is re-transcribing the six thesis videos through a higher-quality engine. Those transcripts
are stored **alongside** the YouTube ASR versions, never in place of them.

**Why keep both:** two independent machine transcripts of the same audio are a free error detector.
Where they agree word for word, the text is almost certainly what was said; where they diverge, that
is precisely the passage a human must check against the recording. Given the rule that every quote
is verified before print, this turns an open-ended listening job into a short list of timestamps.
Overwriting the ASR version throws that away. Secondary reason: the two engines segment differently,
and if the new transcript has coarser timing we would have destroyed a working index to get it.

Loading them:

1. Required input format is **SRT or VTT** — both carry start and end times per line. If the service
   only offers timestamped TXT, parse that. A transcript with no timestamps cannot be aligned to the
   recording and is worth a fraction of what it should be, however accurate the words.
2. File naming: `<video_id>.<source>.vtt`, e.g. `1xsdGfHlIeU.whisper-zendocs.vtt`. Name by video ID,
   never by title: titles contain punctuation that breaks on Windows paths, and the ID is the join
   key to everything else.
3. Store raw beside the yt-dlp output; load into `cue` and `passage` with `source` set to the engine
   name, and insert the matching `starkey.transcript` row.

**Do not build an automated comparison of the two transcripts.** The report is expected to lean on
about ten quotes; ten is faster to check by eye than a diff tool is to write and debug. If the count
passes roughly twenty, Charlie will say so and it becomes worth building.

## Phase 4 — Verification (required)

1. Row counts: `starkey.video` should be 285 minus confirmed failures. Report the number.
2. For three randomly chosen videos, open the video at a passage's `start_s` and confirm the words
   on screen match the stored text. This tests timestamp alignment, which is what the report depends
   on.
3. Confirm keyword search returns sane results for `human rights act`, `common law`, `sovereignty`.
4. Flag any video whose caption file is present but under ~200 words — usually a failed ASR run or a
   mostly-music video. Flag, do not silently include.

## What NOT to do

- Do not download video or audio streams.
- Do not republish or expose this corpus. It is a private research corpus of another person's
  published work, gathered for a report. Private is both the polite position and the safe one.
- Do not "clean up" ASR text by guessing at words. Where the machine transcript is wrong it must
  stay visibly wrong, so Charlie knows to check it. A tidied transcript that reads well is more
  dangerous than a rough one, because it hides its own errors.
