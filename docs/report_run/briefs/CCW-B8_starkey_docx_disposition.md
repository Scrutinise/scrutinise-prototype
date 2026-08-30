# CCW-B8 (REVISED 11:35) — the seven Starkey .docx: what each one is

**Written:** Sun 30 Aug 2026 by CCW, after B7 completed. **This replaces the 11:25 version, which was
wrong.** That version said all seven documents were scraped copies of YouTube's captions. Three of
them are not: Parts 1, 2 and 3 are genuine TurboScribe re-transcriptions. If you already acted on the
earlier text, only Step 3 changes — nothing has been loaded, so nothing needs unwinding.

**Files:** `docs/report_run/sources/youtube/THE STARKEY THESIS {PART 1..6, Full lecture}.docx`

---

## Step 1 — git-ignore them now, before any commit

Unchanged from the earlier version and still the time-critical step. The seven `.docx` are
**untracked but not ignored** (`git status` shows `??`). They are not in `aa299d0` and nothing has
leaked, but the next `git add` sweeps seven full lecture transcripts into a GitHub-backed repo —
the exact thing B7's "What NOT to do" forbids.

Append to `docs/report_run/sources/youtube/.gitignore`:

```
# Charlie's transcript documents — same rule as meta/ raw/ logs/ above.
# Untracked is not the same as ignored: without this line the next `git add`
# commits seven full lecture transcripts to a GitHub-backed repo.
*.docx
```

## Step 2 — the identification, and the measurement behind it

CCW extracted each document's text and compared it against the YouTube ASR already in the corpus for
that video: word-sequence similarity over the first 2,000 words, after collapsing YouTube's
rolling-caption duplicates. The tool name was read from each document's own footer.

| Document | Video | Engine | Similarity to YouTube ASR | Verdict |
|---|---|---|---|---|
| PART 1 | `soNnF0sjF5Y` | TurboScribe | 0.902 | **independent** |
| PART 2 | `jnsiLNNL8s8` | TurboScribe | 0.893 | **independent** |
| PART 3 | `8veLovq5NWQ` | TurboScribe | 0.839 | **independent** |
| PART 4 | `okJNAMPBRqg` | summarize.ing | 0.987 | scraped copy of the ASR |
| PART 5 | `q1Mto3BxMcA` | summarize.ing | 0.993 | scraped copy of the ASR |
| PART 6 | `Mwf_SwRa2F0` | tactiq.io | 0.975 | scraped copy of the ASR |
| Full lecture | `EMbRv6aaQrs` | tactiq.io | 0.980 | scraped copy of the ASR |

**The number separates the two classes cleanly.** An independent engine listening to the same audio
lands at 0.84–0.90 against YouTube's ASR; a scraper that re-formats YouTube's own caption track lands
at 0.975+. There is no overlap between the groups, and the gap is the useful part: the 10–16% where
TurboScribe and YouTube disagree is exactly the set of places a human must check.

Ignore any match on the string `descript` — it is a substring of "description" in the body text, not
the Descript product.

**Two mislabelled URLs, both harmless — the contents are right in every case:**

- **PART 4** has `8veLovq5NWQ` pasted inside it, which is Part 3's video. Its text matches Part 4
  (`okJNAMPBRqg`) at 0.987 and Part 3 at 0.064. Wrong link, right transcript.
- **Full lecture** carries two links, `EMbRv6aaQrs` and `Mwf_SwRa2F0`. Its text matches
  `EMbRv6aaQrs` — the 46-minute September lecture — at 0.980, and Part 6 at 0.041.

Write this table into `sources/youtube/_README.md` so nobody re-derives it.

## Step 3 — load three, leave four

**Load Parts 2 and 3.** Each document contains its transcript twice: once as prose, once as a
timestamped VTT block. Extract the VTT portion, save as `raw/jnsiLNNL8s8.turboscribe.vtt` and
`raw/8veLovq5NWQ.turboscribe.vtt`, and load with `source = 'turboscribe'` exactly as Part 1 was
loaded. Part 1 is already in from Charlie's `Downloads` copy — do not load it twice; verify the
document and the loaded file are the same transcript and note it if they are not.

Timestamps in these documents are `H:MM:SS` line markers, not VTT `-->` cues, in the prose section;
the VTT section proper should carry real cues. Parse the VTT section. If a document turns out not to
have one, derive cues from the `H:MM:SS` markers and say so in the load report — a start time with no
end time is still usable, an untimed transcript is not.

**Do not load Parts 4, 5, 6 or the Full lecture.** They are the ASR already in `starkey.cue`,
re-formatted. Loading them would make a single-sourced passage look double-sourced — false
confidence is worse than no second source, because it stops a human checking. Leave them on disk as
readable copies, git-ignored, listed in `_README.md`.

## Step 4 — after loading

Report, per video, the number of `turboscribe` cues loaded and the last cue's end time against
`duration_s`, so a truncated transcript cannot pass silently. That check is what caught
`2Khgz5sMMBU` in B7.
