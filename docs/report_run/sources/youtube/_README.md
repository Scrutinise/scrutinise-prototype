# Starkey transcript corpus — what is here and how to use it

Built 30 Aug 2026 for `docs/report_run/briefs/CCW-B7_starkey_transcript_corpus.md`.

**285 videos, 128.4 hours, 1,176,129 words, 2016-07-05 → 2026-08-23.** 287 transcripts across 284
videos (283 YouTube ASR, 1 human-authored, 3 TurboScribe re-transcriptions); one video has no
captions at all. 180,092 cues, 6,157 searchable passages. 314 MB of raw files.
**Zero fetch failures — every one of CCW's 285 IDs resolved**, so nothing in the list was mistyped.

**Backed up to R2:** `r2://scrutinise-legislation/research/starkey/` — `meta/`, `raw/` and `logs/`
under that prefix, 857 objects. Every key was verified by reading its size back from R2 after the
upload (a PUT returning without throwing is not evidence the bytes are there), and a control key
that should not exist was confirmed absent so "all present" is a real result. Re-runnable and
idempotent: `tsx ../scripts/starkey/r2-backup.ts` (add `--verify-only` to check without uploading).
⚠ The seven `.docx` are **not** in the R2 copy — the backup covers `meta/`, `raw/` and `logs/` only.

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

## Before you quote: a search match is not evidence of the wording

Two things about Postgres FTS that this corpus was bitten by, both of which reach the printed page.

**1. A multi-word `plainto_tsquery` is an AND, not a phrase.** `plainto_tsquery('english',
'constitutional reform')` is `constitut & reform` — both lexemes anywhere in the same 60–90 second
passage. Over a passage that long it is a weak constraint: `constitutional reform` had 9 hits across
the eight thesis videos and the phrase occurs **zero** times. Use `phraseto_tsquery` for anything
you will describe as a phrase.

**2. A `phraseto_tsquery` match is adjacent STEMS, not the literal words.** `'equality act'` is
`'equal' <-> 'act'`, which **"the Equalities Act" satisfies**. That is usually a *gain* — it finds a
measure named the way a speaker actually names it, which no literal search does — but it means a
match does not license quoting the term's own wording. `starkey_hits.json` carries `literal_match`
beside `phrase_match` for exactly this.

Of the 87 hits in the current export, 77 are phrase matches and **11 of those are not literal**:

| What it really says | Count | Verdict |
|---|---|---|
| "restore" for `restoration` | 4 | legitimate — same concept |
| "the Equalities Act" for `equality act` | 2 | legitimate — and the *only* way that reference is found |
| the same passage under the bare term `equality` | 2 | legitimate |
| **"equally" for `equality`** | **3** | **spurious — the stem `equal` swallows the adverb** |

So three hits in 87 are noise, and all three are one known cause. ⚠ **The lesson for choosing terms:
check what a short stem swallows.** `equality` stems to `equal`, which covers "equally" — a term
picked to measure a subject was counting a function word.

⚠⚠ **One term is WHOLLY variant-only, and it is a fact the report should state precisely: the
Equality Act is never named literally anywhere in the eight thesis videos.** It is named once, in
Part 2 at **5:17**, as **"the Equalities Act"**, alongside the Human Rights Act. Every other term
with any hits has at least one literal one:

| | phrase hits | of which literal |
|---|---|---|
| `equality act` | 2 | **0 — the statute is only ever named as "the Equalities Act"** |
| `restoration` | 12 | 8 (the other 4 are "restore") |
| `equality` | 6 | 1 (3 are "equally", 2 the Equalities Act passage) |
| all nine others | — | all literal |

A term whose every hit is a variant is a different animal from one that is merely mixed: quoting it
by the term's own wording would put words in the speaker's mouth. Check `literal_match` per term,
not per passage — a passage can be "literal" because a *different* term in it was.

⚠⚠ **Use `match_url`, not `watch_url`, to check a quote.** A passage runs 60–90 seconds, so a link
to its start can open a long way before the words. Measured across the 77 phrase matches: **the
words sit 0–72 seconds after the passage start, median 25 seconds.** The Equalities Act reference is
the worked example — passage 5:05, words 5:17. `match_url` points at the cue that actually carries
the phrase, located by testing each cue **concatenated with the next one**, because a phrase can
straddle the boundary: that reference is literally split `"...the equalities"` / `"Act."` across two
ASR cues. `watch_url` is kept as the passage anchor the brief specified, and is the only link
available for the 10 co-occurrence-only hits, which have no phrase location by definition.

⚠ **Two kinds of looseness, opposite reliability.** *Positional* looseness (AND instead of phrase)
admits words that co-occur without relating, so a hit only the loose form finds deserves suspicion —
that is how `civil service commission`, which is **never uttered**, showed 7 hits. *Morphological*
looseness (stem instead of literal) admits inflections of the same word, so a hit only the loose form
finds is usually a real catch — that is how "the Equalities Act" was found. Do not apply one rule to
both.

## The seven .docx — what each one is (CCW-B8)

All seven are **git-ignored**, in two places: `sources/youtube/.gitignore` covers the copies here,
and `docs/report_run/.gitignore` covers the second set sitting in `report_run/` root — a directory
`.gitignore` governs its own directory and below, so the first rule alone would not have reached
them. Both were confirmed with `git check-ignore -v` against the real paths, not the pattern.

Identification re-derived from the text, not taken on trust and not taken from the URLs in the
documents — two of those point at the wrong video. Metric: longest-common-subsequence ratio over the
first 2,000 words against the YouTube ASR already in the corpus, structure (timestamps, headers,
speaker markers) stripped first.

| Document | Video | Engine | LCS vs ASR | 2nd best | Verdict |
|---|---|---|---|---|---|
| PART 1 | `soNnF0sjF5Y` | TurboScribe | 0.938 | 0.161 | **independent — loaded** |
| PART 2 | `jnsiLNNL8s8` | TurboScribe | 0.899 | 0.164 | **independent — loaded** |
| PART 3 | `8veLovq5NWQ` | TurboScribe | 0.943 | 0.154 | **independent — loaded** |
| PART 4 | `okJNAMPBRqg` | summarize.ing | 0.993 | 0.163 | scraped copy of the ASR — not loaded |
| PART 5 | `q1Mto3BxMcA` | summarize.ing | 0.996 | 0.160 | scraped copy of the ASR — not loaded |
| PART 6 | `Mwf_SwRa2F0` | tactiq.io | 0.995 | 0.169 | scraped copy of the ASR — not loaded |
| Full lecture | `EMbRv6aaQrs` | tactiq.io | 0.996 | 0.155 | scraped copy of the ASR — not loaded |

**The classes separate with no overlap:** independent engines land at 0.899–0.943 against YouTube's
ASR, scrapers that re-format YouTube's own caption track at 0.993–0.996. Gap 0.050, nothing between
them. The four scraped documents are **deliberately not loaded**: they are the ASR already in
`starkey.cue`, and loading them would make a single-sourced passage look double-sourced. False
confidence is worse than no second source, because it stops a human checking.

Every mapping is unambiguous — best-vs-second is 0.899–0.996 against 0.154–0.169.

⚠ **Two documents carry a link to the wrong video, and in both cases the visible URL and the
embedded hyperlink disagree.** PART 4 shows `8veLovq5NWQ` (Part 3) in its text while its hyperlink
points at `okJNAMPBRqg`; the Full lecture shows `Mwf_SwRa2F0` (Part 6) while its hyperlink points at
`EMbRv6aaQrs`. The transcripts themselves are right in every case — which is why the mapping is done
on the words, not the links.

Extraction: `scripts/starkey/docx-extract.py` (stdlib only — a .docx is a zip) writes prose, SRT and
metadata to `_docx_extract/`; `scripts/starkey/docx-disposition.ts` measures and dispositions.

## Adding another TurboScribe transcript

Charlie gets three free TurboScribe re-transcriptions a day. When a new one arrives:

1. Save it as `raw/<video_id>.turboscribe.vtt` — **named by video ID, never by title**. Titles carry
   punctuation that breaks on Windows paths, and the ID is the join key to everything else. If it
   comes as a `.docx`, drop it in this directory and run `docx-extract.py` then `docx-disposition.ts`,
   which will identify the video from the words and write the file for you.
2. `tsx ../scripts/starkey/load.ts <video_id>` — it is picked up by filename and loaded with
   `source = 'turboscribe'`, replacing any previous load for that pair rather than appending.
3. `tsx ../scripts/starkey/turboscribe-report.ts` — cue count and last-cue end against `duration_s`
   for every TurboScribe transcript. **A transcript covering under 90% of its video is flagged.**
   That comparison, not a word count, is what caught `2Khgz5sMMBU`.
4. `tsx ../scripts/starkey/r2-backup.ts` to put the new raw file in R2.

Currently loaded, all essentially complete:

| Video | Cues | ASR cues | Last cue | Duration | Coverage |
|---|---|---|---|---|---|
| `soNnF0sjF5Y` P1 | 289 | 298 | 765.1s | 766s | 99.9% |
| `jnsiLNNL8s8` P2 | 302 | 321 | 815.1s | 815s | 100.0% |
| `8veLovq5NWQ` P3 | 229 | 245 | 615.7s | 616s | 99.9% |

Still single-sourced: `okJNAMPBRqg` P4, `q1Mto3BxMcA` P5, `Mwf_SwRa2F0` P6, `EMbRv6aaQrs` lecture,
`2Khgz5sMMBU` interview.
