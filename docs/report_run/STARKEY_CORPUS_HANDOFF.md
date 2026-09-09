# Starkey transcript corpus — handoff to the main project conversation

**Written:** Sun 30 Aug 2026, 11:35 BST, by the CCW session that commissioned the corpus.
**For:** whichever conversation is managing the Restoration Programme report overall.
**Status:** corpus built and loaded. Verification of the six thesis videos is part-done.

---

## What exists now

A searchable, timestamped transcript corpus of the David Starkey Talks YouTube channel, built by CC
on 30 Aug from a list of 285 video URLs Charlie assembled.

- **285 videos, 128.4 hours, 1,172,546 words**, spanning 2016-07-05 to 2026-08-23
- **179,561 caption cues** and **6,138 searchable passages** in Neon, in a schema of its own called
  `starkey` on the production app database — deliberately not in `schema.prisma`
- Raw source files (314 MB) under `docs/report_run/sources/youtube/`, **git-ignored**: the repo
  pushes to GitHub and this is another person's published work held for private research
- Full technical account in `docs/report_run/sources/youtube/_README.md`
- Zero fetch failures across all 285 IDs

Search is keyword-based (Postgres full-text). No embeddings, deliberately: the cheap tool was built
first so the expensive one is only added if it demonstrably fails. It has not failed yet.

## The six-part thesis series

Uploaded on consecutive days, 2–6 December 2025:

| Part | ID | Length | Subject |
|---|---|---|---|
| 1 | `soNnF0sjF5Y` | 12m46s | Restoring the English constitution |
| 2 | `jnsiLNNL8s8` | 13m35s | "The YooKay just doesn't work" |
| 3 | `8veLovq5NWQ` | 10m16s | Taking back control of our politics |
| 4 | `okJNAMPBRqg` | 15m41s | Erosion of state capacity under the EU |
| 5 | `q1Mto3BxMcA` | 10m44s | Preaching the Gospel of Restoration |
| 6 | `Mwf_SwRa2F0` | 27m21s | Question & Answer session |

**Do not treat the six as the whole thesis.** `EMbRv6aaQrs` is a 46-minute lecture from 21 September
2025 — ten weeks earlier, longer than any single part, on the same material, and very likely the
source the six were cut from. A second thesis-adjacent video, `2Khgz5sMMBU` (10 Oct 2025), is a
Q&A on the thesis and the Conservative Party.

## Quote verification — the method, and where it stands

The report requires every quote checked against the recording before print. The corpus makes that
tractable by holding **two independent transcripts** of the same audio where possible: YouTube's own
machine captions, and a re-transcription by a genuinely separate engine. Where the two agree, the
text is almost certainly right; where they diverge, that passage needs a human ear. The divergences
are the checking list.

**This is not a theoretical benefit.** In Part 1 at 5:01, YouTube's captions render the name as
"Israeli"; TurboScribe renders it "Disraeli". A quote taken from the machine captions alone would
have printed the wrong man in a constitutional report.

An empirical rule emerged while sorting Charlie's transcript documents, and it is worth keeping:

- a genuinely independent engine scores **0.84–0.90** word-sequence similarity against YouTube's ASR
- a *scraper* that merely re-formats YouTube's own caption track scores **0.975+**

The two groups do not overlap. Anything at 0.975+ is the same transcript in a different coat and adds
no verification value at all — worse, it makes a single-sourced passage look double-sourced.

**Verified with a second engine (TurboScribe):** Parts 1, 2, 3.
**Not yet verified:** Parts 4, 5, 6, and the September lecture `EMbRv6aaQrs`.

Charlie's documents for Parts 4 and 5 came from summarize.ing and for Part 6 and the lecture from
tactiq.io. Both are scrapers, so those four remain single-sourced despite appearances.

## Two gaps in the corpus, neither blocking

1. **`2Khgz5sMMBU`** — YouTube's captions stop at 20:20 of a 32:50 video. The last 12½ minutes are
   not in the corpus and will not appear in any search. It is YouTube's gap, confirmed twice in two
   formats. This is a thesis-adjacent video, so anything quoted from its tail must be transcribed
   first. Note that a naive "is the transcript suspiciously short" check passes this video — 20
   minutes of speech is not thin. Only comparing the last cue's time against the video's duration
   catches it, and that check found nothing else across all 285.
2. **`LsGrhLDcz9Q`** (21m34s) has no caption track of any kind. It is recorded in `starkey.video`
   with no transcript, so the corpus says "we hold this video and it has no words" rather than
   staying silent about it. Not one of the six.

## Open items

1. **TurboScribe the remaining four** — Parts 4, 5, 6 and `EMbRv6aaQrs`. The free tier allows three
   a day and today's three are spent, so this is two more days: comfortably before Thursday, and no
   payment needed. Brief `CCW-B9_quote_concentration.md` determines the order by finding where the
   report's quotable material actually concentrates, so if only some get done, the right ones do.
2. **Back up the raw corpus to R2.** 314 MB on one machine, git-ignored by design, produced by a
   scrape that YouTube may rate-limit if repeated. CC holds the credentials. Recommended.
3. **`register_proposals.json` still does not exist**, so brief B5 remains blocked. Unrelated to the
   corpus, but it is the one thing holding up the report's register resolution.

## Briefs, in order

`docs/report_run/briefs/` — B7 built the corpus (done, pushed as `aa299d0`); B8 disposes of Charlie's
seven transcript documents; B9 locates the quotable passages. `_INDEX.md` carries the running order.
