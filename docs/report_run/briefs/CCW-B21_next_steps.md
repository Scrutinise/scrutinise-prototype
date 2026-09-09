# CCW-B21 — next steps for CC

**9 September 2026, 12:50 BST.** CCW-B20 is complete and the exports are exactly what was needed. This is short, because CC already has the context.

**Four tracks. They touch disjoint files and can run in parallel in separate sessions.** Track 1 is the one that stops the worst failure recurring; track 4 must run alone.

---

## Track 1 — `build-worker` watchPatterns. Do this first, it is ten minutes

`build-worker`'s `watchPatterns` are `[]`. **That is the root cause of the six-day staleness**, and of the trap in §3: sixteen pushes produced no deployment record for the service that runs every build.

Set a watch path that actually covers what the worker runs — at minimum `scrutinise-web/lib/lex/**` and `scrutinise-web/scripts/build-worker.ts` — and confirm by pushing a trivial change and watching a deployment appear for the service without anyone triggering it.

⚠ **And record the §3 finding somewhere a future session will read it, in CLAUDE.md rather than a report.** The wording that matters: *`serviceInstanceDeployV2` takes a third argument. Called with two, it returns SUCCESS with a fresh deployment id while building the old commit. Read `meta.commitHash`. Never the status, never the id.* That is the fourth mutation of the same error pattern and the first one where the fix for the trap was itself trapped.

## Track 2 — re-run the position register, now the signatures are in

`b18-position-register.ts` was run before the INGEST session loaded 2,125,547 early day motion signatures. On eight of the twelve measures the appendix currently reads "tabled an early day motion — signatures not held" and returns exactly one name.

**Re-run it and write the output to the same path**, `docs/report_run/appendices/POSITION_REGISTER.md`. Keep the assembled/extracted split and the 44% interpretation error rate exactly as they are — that separation is the best thing in the appendix.

⚠ Two things to say in the output, not to hide: whether a signature makes someone a supporter is a judgement (a member may sign a motion to get it debated), and the register remains a **candidate list requiring confirmation**, not a finding.

## Track 3 — mine the transcript corpus properly, and build one new appendix

**The corpus is 285 videos, 128.4 hours, 1,172,546 words, 6,138 searchable passages.** The search actually run over it covers **8 videos and 22 terms, producing 87 hits.** Eight of two hundred and eighty-five.

**Two jobs:**

**3a. Widen the pass.** Run the search across all 285 videos, with a term list built from the twelve measures rather than the 22 general terms — every Act named in the register, every institution, and the language David actually uses for each. Keep the existing hit shape: measure, text, video title, date, `start_s`, timestamped `match_url`.

**3b. Export a new appendix**, `docs/report_run/appendices/WHAT_DAVID_SAID.md` — every passage bearing on each of the twelve measures, grouped by measure, in date order, each with the date, the video title, the passage, and a link that starts playing at the right second.

**Why this is worth doing before anything else on the content side.** It is the one body of evidence nobody else has, it is David's team's own principal in his own words organised by proposal, and at present it produces exactly twelve quotations in the register. A reader who disputes a register entry can currently be shown one sentence; after this they can be shown everything he said on that measure and watch him say it.

⚠ **Two transcripts exist per video where possible — YouTube's captions and a separate re-transcription.** Where they diverge, mark the passage rather than picking one. The `Israeli`/`Disraeli` case in Part 1 at 5:01 is why.

## Track 4 — the two product defects. One session, and not while track 3 is running

**4a. "Key sources" emits a blank row.** On all twelve measures the panel produces `| What to read first | — | Undated. No retrievable source record… | _no reason recorded_ |` and nothing else. It runs and fills nothing. That is a defect, not an absence.

Charlie's redesign, which replaces one curation judgement with four concrete slots per measure, each of which either names a document or visibly fails:

| Slot | Content |
|---|---|
| The provision itself | citation and legislation.gov.uk link |
| What David said, and when | passage, date, video title, timestamped link — from track 3 |
| The strongest published case for | one named document, and why |
| The strongest published case against | one named document, and why |

**4b. The renderer maps scaffolding into report headings.** ⚠ **A naming correction first: `docs/report_run/report_src_v2/build.js` is CCW's docx generator and is not the renderer. Do not touch it — that is the collision you were right to avoid, but it was the wrong file.** The renderer at issue is whatever turns a build export into report markdown; it is in the Lex export path and CCW never touches it.

The defect: `passes_by_key/*/carry/*` holds text passed between passes, opening with instructions addressed to the model. The renderer places those blobs under report headings such as *The law as it stands*. 100 of 263 truncated passages traced to `carry` fields against 136 to `deepening/issues[].text`. Read the structured fields; where a carry blob is genuinely the only source, split it on its `[FINDING]` / `[CONTRADICTS]` markers and file each finding under the heading it belongs to. Correctly mapped the output is shorter and more accurate.

---

## Held back, deliberately

**The build-row lease (previous item 3) is parked until the four tracks above are done.** It needs a schema column on production, and a migration should not race three other sessions in the same tree. It is real and it should happen — the M-01 v4 contention was not a one-off — but it is the only item here that can break something else.

## Housekeeping, whoever gets there first

- `check:scripts` is red from `scripts/_b17logs.ts` and `_b17wait.ts` — another session's untracked scratch, which §22 says should have been deleted in the same turn. Delete them.
- `b18-run-consequences.ts:67` is also red and is not CC-B18's.

## What CCW is doing

Building the replacement for the withdrawn Appendix B out of `docs/report_run/critique/`. **Nothing in tracks 1–4 blocks it, and it blocks nothing.** The critique exports are complete and are exactly the right shape — no further export is needed.
