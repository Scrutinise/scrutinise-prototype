# Starkey transcript corpus — what is here and how to use it

Built 30 Aug 2026 for `docs/report_run/briefs/CCW-B7_starkey_transcript_corpus.md`.

**285 videos, 128.4 hours, 1,172,546 words, 2016-07-05 → 2026-08-23.** 285 transcripts across 284
videos (283 YouTube ASR, 1 human-authored, 1 TurboScribe re-transcription); one video has no
captions at all. 179,561 cues, 6,138 searchable passages. 75 MB in Postgres, 314 MB of raw files.
**Zero fetch failures — every one of CCW's 285 IDs resolved**, so nothing in the list was mistyped.

## Layout

| Path | What |
|---|---|
| `video_ids.txt` | CCW's input — 285 unique YouTube IDs |
| `meta/<id>.info.json` | yt-dlp metadata, one per video. **Source of truth.** 197 MB |
| `raw/<id>.<lang>.vtt` | YouTube captions (`en`, `en-orig`, one `en-GB`). **Source of truth.** 117 MB |
| `raw/<id>.<engine>.vtt` | re-transcriptions from another engine — currently one: `soNnF0sjF5Y.turboscribe.vtt`, copied from Charlie's `Downloads/THE STARKEY THESIS PART 1 - Restoring the English constitution.vtt` and renamed to the video ID |
| `urls.txt` | derived from `video_ids.txt` by `fetch-subs.sh`; bare 11-char IDs are ambiguous to yt-dlp, full watch URLs are not |
| `logs/fetch.log` | the yt-dlp run |

`meta/`, `raw/` and `logs/` are **git-ignored** (see `.gitignore` here). The brief says do not
republish or expose the corpus, and this repository pushes to GitHub. They are on disk only. If they
should be backed up, R2 is the right home — say the word.

## The six-part thesis series

| ID | Uploaded | Length | Title |
|---|---|---|---|
| `soNnF0sjF5Y` | 2025-12-02 | 12m46s | PART 1 — Restoring the English constitution |
| `jnsiLNNL8s8` | 2025-12-03 | 13m35s | PART 2 — The YooKay just doesn't work |
| `8veLovq5NWQ` | 2025-12-04 | 10m16s | PART 3 — Taking back control of our politics |
| `okJNAMPBRqg` | 2025-12-05 | 15m41s | PART 4 — Erosion of state capacity under the EU |
| `q1Mto3BxMcA` | 2025-12-06 | 10m44s | PART 5 — Preaching the Gospel of Restoration |
| `Mwf_SwRa2F0` | 2025-12-06 | 27m21s | PART 6 — Question & Answer session |

Two further videos carry "thesis" in the title and are **not** part of the numbered series:
`EMbRv6aaQrs` (2025-09-21, 46m23s, *"We must REPUDIATE Blairism" | David outlines THE STARKEY THESIS
in ground-breaking lecture*) and `2Khgz5sMMBU` (2025-10-10, 32m50s, *David is quizzed on The Starkey
Thesis and Conservative Party*). The lecture predates Part 1 by ten weeks and covers the same
material, so it is worth reading before treating the six as the only source.

## Three flags — none of them a fetch failure

1. **`LsGrhLDcz9Q`** (*David Starkey vs remoaners on BREXIT*, 21m34s) has **no caption track of any
   kind** — neither human nor ASR. It is in `starkey.video` with no transcript, so the corpus says
   "we have this video and it has no words" rather than omitting it. Anything quoted from it must be
   transcribed first.
2. **`2Khgz5sMMBU`** — YouTube's ASR **stops at 20:20 of a 32:50 video (62.9% coverage)**. The last
   12½ minutes are not in the corpus and will not appear in any search. Confirmed against YouTube
   twice, in two formats: the VTT ends there and an independent json3 re-fetch ends at the same
   event. This one matters because it is one of the two thesis-adjacent videos.
3. **Five transcripts under 200 words** — the four Shorts and one 84-second clip. All genuinely
   short videos, not failed ASR. Flagged, not excluded, per the brief.

## The database is derived, not authoritative

Everything in the Neon `starkey` schema is rebuilt from the files above. A schema change is a re-run,
never a re-scrape:

```
scrutinise-web> NODE_PATH=./node_modules ./node_modules/.bin/tsx ../scripts/starkey/apply-schema.ts
scrutinise-web> NODE_PATH=./node_modules ./node_modules/.bin/tsx ../scripts/starkey/load.ts
```

`load.ts` is idempotent — it replaces the cues and passages for each `(video_id, source)` it
touches, so re-running never doubles the corpus. `verify.ts` re-runs every Phase 4 check;
`align-check.ts` re-tests timestamp alignment against YouTube.

The schema lives on the **production Neon app database** (`ep-old-dust-aboxi69a`), in its own
`starkey` schema, and is deliberately **not** in `schema.prisma` — Prisma manages `public` only, and
adding these tables there would make every `migrate` run see drift.

## Searching it

```
scrutinise-web> NODE_PATH=./node_modules ./node_modules/.bin/tsx ../scripts/starkey/search.ts "human rights act"
scrutinise-web> NODE_PATH=./node_modules ./node_modules/.bin/tsx ../scripts/starkey/search.ts "common law" --limit 20 --source turboscribe
```

Every hit prints a `youtube.com/watch?v=…&t=NNNs` link that opens the recording at the second the
passage starts. That link is the verification mechanism — the corpus exists to make the check take
seconds, not to be quoted from directly. Current counts: `human rights act` 103 passages,
`common law` 127, `sovereignty` 101.

## What was done to the text, and what was not

The brief forbids "cleaning up" ASR by guessing at words, and nothing here does. Two transforms were
applied, both mechanical, both declared:

1. **YouTube's rolling display was de-duplicated.** Auto-caption VTT is not a list of cues: each cue
   repeats the previous line above its new one, with a 10 ms filler cue between every pair. Stored
   verbatim that triples the text and puts the wrong start time on every line. Carry-over lines are
   dropped; no token is substituted, and a wrong ASR word stays wrong. (`scripts/starkey/vtt.ts`)
2. **A vendor watermark was removed** from the TurboScribe transcript — the literal
   `(Transcribed by TurboScribe. Go Unlimited to remove this message.)` injected into its first cue.
   A fixed string, not speech; one cue affected. (`scripts/starkey/load.ts`, `VENDOR_BANNERS`)

## Two transcripts per video

`starkey.transcript` says which transcripts exist for a video and what produced each. `cue` and
`passage` both carry `source`, and both their indexes lead with `(video_id, source)` so a
single-video query never interleaves two transcripts into what looks like duplicated text.

The error detector already earns its keep. At 5:01 of Part 1, on the same audio:

| source | text |
|---|---|
| `asr` | "…my father who as I always point out was a was was a toolmaker. But **Israeli** in the wake of that gives you I think the best formula" |
| `turboscribe` | "…my father, who, as I always point out, was a toolmaker. But **Disraeli**, in the wake of that, gives you, I think, the best formula" |

One transcript names the wrong man. A quote taken from the ASR alone would have printed it.

Per the brief, **no automated comparison of the two has been built.** Ten quotes are faster to check
by eye than a diff tool is to write. If the count passes roughly twenty, Charlie says so.
