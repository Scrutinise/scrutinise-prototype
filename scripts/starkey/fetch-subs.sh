#!/bin/bash
# Starkey transcript corpus — CCW-B7 Phases 1 and 2, in one pass.
#
# Subtitles and metadata ONLY. Never video or audio: the caption tracks for all
# 285 come to a few hundred MB, the videos would be hundreds of GB, and the
# video stream adds nothing a transcript corpus can use.
#
# The brief splits metadata (Phase 1, to identify the thesis series) from
# captions (Phase 2). yt-dlp fetches both from the same page load, so splitting
# them would double the requests to YouTube for no gain; the thesis list is
# reported off the metadata as soon as the run finishes.
#
# Re-runnable: --no-overwrites means a repeat run resumes rather than refetches.
set -u
cd "$(dirname "$0")/../.."

DEST=docs/report_run/sources/youtube
mkdir -p "$DEST/meta" "$DEST/raw" "$DEST/logs"
LOG="$DEST/logs/fetch.log"

# Bare 11-character IDs are ambiguous to yt-dlp; full watch URLs are not.
tr -d '\r' < "$DEST/video_ids.txt" | awk 'NF' | sed 's#^#https://www.youtube.com/watch?v=#' > "$DEST/urls.txt"

# --skip-download    captions, not media
# --write-auto-subs  YouTube ASR — 283 of the 285 have nothing else
# --write-subs       human captions where they exist; with both flags yt-dlp
#                    prefers the human track for a given language tag
# --sub-langs en.*   every English track, so an en-GB human track is not missed
# --sub-format vtt   WebVTT carries start AND end times per cue. Timestamps are
#                    the quote-verification mechanism; plain text loses them.
# --sleep-requests 2 YouTube throttles rapid sequential requests
# --ignore-errors    one dead ID must not kill the run; failures are reported by
#                    manifest.ts as ids with no .info.json, never silently skipped
python -m yt_dlp \
  --skip-download \
  --write-auto-subs \
  --write-subs \
  --sub-langs "en.*" \
  --sub-format vtt \
  --write-info-json \
  --sleep-requests 2 \
  --ignore-errors \
  --no-overwrites \
  --no-progress \
  --no-colors \
  -P "subtitle:$DEST/raw" \
  -P "infojson:$DEST/meta" \
  -o "%(id)s.%(ext)s" \
  -a "$DEST/urls.txt" \
  >> "$LOG" 2>&1

echo "yt-dlp exit=$? at $(date -u +'%Y-%m-%d %H:%M:%S UTC')" >> "$LOG"
echo "info.json files: $(ls "$DEST/meta"/*.info.json 2>/dev/null | wc -l)" >> "$LOG"
echo "vtt files:       $(ls "$DEST/raw"/*.vtt 2>/dev/null | wc -l)" >> "$LOG"
tail -3 "$LOG"
