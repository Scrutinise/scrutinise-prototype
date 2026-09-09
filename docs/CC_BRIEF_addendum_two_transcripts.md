# CC BRIEF — ADDENDUM 1: holding two transcripts per video

**Prepared by:** Cowork session, 30 Aug 2026
**Applies to:** the `starkey` schema in the main brief. Apply this BEFORE loading data if the tables are not yet populated; if they are, the ALTERs below are safe to run on a populated table.

## Decision

Charlie is re-transcribing the six "David Starkey thesis" videos through a higher-quality engine. Those transcripts must be stored **alongside** the YouTube ASR versions, not in place of them.

**Why we keep both rather than replacing:** two independent machine transcripts of the same audio are a free error detector. Where they agree word-for-word, the text is almost certainly what was said. Where they diverge, that is precisely the passage a human has to check against the recording. Given the report requires every quote verified before print, this converts an open-ended listening job into a short list of specific timestamps. Overwriting the ASR version throws that away.

Secondary reason: the two engines segment differently. If the new transcript turns out to have coarser timestamps or no speaker separation, we would have destroyed a working index to get it.

## Schema amendment

```sql
-- 'source' identifies which engine produced the row. Default 'asr' so the
-- existing yt-dlp load is correctly labelled without a backfill.
ALTER TABLE starkey.cue     ADD COLUMN source text NOT NULL DEFAULT 'asr';
ALTER TABLE starkey.passage ADD COLUMN source text NOT NULL DEFAULT 'asr';

-- Indexes must include source, otherwise a query for one video returns both
-- transcripts interleaved and looks like duplicated text.
DROP INDEX IF EXISTS starkey.cue_video_id_start_s_idx;
DROP INDEX IF EXISTS starkey.passage_video_id_start_s_idx;
CREATE INDEX ON starkey.cue     (video_id, source, start_s);
CREATE INDEX ON starkey.passage (video_id, source, start_s);

-- The video table now describes the video, not one transcript of it.
-- Which sources exist is a property of the transcripts, so drop it from here.
ALTER TABLE starkey.video DROP COLUMN IF EXISTS caption_source;

CREATE TABLE starkey.transcript (
  video_id   text NOT NULL REFERENCES starkey.video(video_id) ON DELETE CASCADE,
  source     text NOT NULL,            -- 'asr' | 'human' | engine name e.g. 'whisper-zendocs'
  engine     text,                     -- free text: what actually produced it
  loaded_at  timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (video_id, source)
);
```

## Loading the new transcripts

1. **Required input format: SRT or VTT.** Both carry a start and end time on every line. Plain text, PDF and DOCX exports do not, and a transcript without timestamps cannot be aligned to the recording — it is worth far less for this job regardless of how accurate the words are. If the service only offers timestamped TXT, that is acceptable; parse it.

2. **File naming: `<video_id>.<source>.vtt`** — for example `1xsdGfHlIeU.whisper-zendocs.vtt`. Name by video ID, never by video title: titles contain punctuation that breaks on Windows paths, and the ID is the join key to everything else.

3. Store the raw files beside the yt-dlp output. Same rule as the main brief: raw files are the source of truth, the database is derived and rebuildable.

4. Load into `cue` and `passage` with `source` set to the engine name, and insert the matching row into `starkey.transcript`.

## Comparison — do NOT automate this yet

Once both versions of a video are loaded, the two can be aligned by timestamp and their differences listed. **Do not build that pipeline unless asked.** The report is expected to lean on roughly ten quotes. Ten quotes is faster to check by eye than a diff tool is to write, and a tool built for ten uses is wasted work. If the number of quoted passages passes about twenty, it becomes worth building — Charlie will say so.
