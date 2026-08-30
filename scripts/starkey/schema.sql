-- Starkey transcript corpus schema.
-- Source: docs/CC_BRIEF_starkey_corpus.md Phase 2, with
--         docs/CC_BRIEF_addendum_two_transcripts.md folded in at creation
--         (the addendum says to apply it BEFORE loading if tables are empty,
--         so the ALTERs are not needed — the amended shape is created directly).
--
-- Lives in its own schema on the Neon app database. It is NOT in schema.prisma
-- and must not be: Prisma manages `public` only, and adding these tables there
-- would make every `migrate` run see drift.
--
-- Idempotent: safe to re-run.

CREATE SCHEMA IF NOT EXISTS starkey;

-- One row per video. Describes the VIDEO, not any one transcript of it —
-- which transcripts exist is a property of starkey.transcript (addendum).
CREATE TABLE IF NOT EXISTS starkey.video (
  video_id        text PRIMARY KEY,          -- YouTube's 11-char ID
  url             text NOT NULL,
  title           text,
  published_on    date,
  duration_s      integer,
  is_short        boolean NOT NULL DEFAULT false,
  fetched_at      timestamptz NOT NULL DEFAULT now()
);

-- Which transcripts exist for a video, and what produced each.
CREATE TABLE IF NOT EXISTS starkey.transcript (
  video_id   text NOT NULL REFERENCES starkey.video(video_id) ON DELETE CASCADE,
  source     text NOT NULL,            -- 'asr' | 'human' | engine name
  engine     text,                     -- free text: what actually produced it
  loaded_at  timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (video_id, source)
);

-- One row per caption cue, exactly as it came out of the VTT file.
-- Cues are 3-8 seconds each: too granular to read, exactly right for locating
-- a quote in the recording. Never edited by hand.
CREATE TABLE IF NOT EXISTS starkey.cue (
  id        bigserial PRIMARY KEY,
  video_id  text NOT NULL REFERENCES starkey.video(video_id) ON DELETE CASCADE,
  source    text NOT NULL DEFAULT 'asr',
  start_s   numeric(10,3) NOT NULL,
  end_s     numeric(10,3) NOT NULL,
  text      text NOT NULL
);
-- source is IN the index: without it a single-video query interleaves two
-- transcripts and reads as duplicated text.
CREATE INDEX IF NOT EXISTS cue_video_source_start_idx ON starkey.cue (video_id, source, start_s);

-- Consecutive cues glued into readable 60-90s chunks carrying the start time of
-- their first cue. This is the unit we SEARCH: a 5-second cue is too short to
-- contain an argument, a whole transcript is too long to be a result.
CREATE TABLE IF NOT EXISTS starkey.passage (
  id        bigserial PRIMARY KEY,
  video_id  text NOT NULL REFERENCES starkey.video(video_id) ON DELETE CASCADE,
  source    text NOT NULL DEFAULT 'asr',
  start_s   numeric(10,3) NOT NULL,
  end_s     numeric(10,3) NOT NULL,
  text      text NOT NULL,
  tsv       tsvector GENERATED ALWAYS AS (to_tsvector('english', text)) STORED
);
CREATE INDEX IF NOT EXISTS passage_tsv_idx ON starkey.passage USING gin (tsv);
CREATE INDEX IF NOT EXISTS passage_video_source_start_idx ON starkey.passage (video_id, source, start_s);
