# BRIEF FOR CC — V32 COMMITTEES COMPLETION

**Written:** 07 Aug 2026, by CCh. Follows the V32 audit (`docs/V32_COMMITTEES_AUDIT.md`, CHANGE_LOG "INGEST V32"). The audit overturned the original brief's premise — the 2020+ report bodies were already fully ingested; the problem is findability (one blob per report + PDF line-break extraction) and a pre-2020 historical gap. The splitter is built and 19/19-verified; the writer is built and dry-run-tested. This brief runs what's built and completes what isn't. Priorities: §1 first (makes held reports findable), then §2 (closes the historical gap), then §3–§4.

## AUTONOMY / DISCIPLINE

Run end-to-end; fix-or-report. No git until commit-all.sh. Losslessness stays an enforced invariant (`assertLossless` throws rather than write a partial report). Predict-then-measure: the scale/cost predictions are already recorded — score against them. Heavy jobs run on Hetzner, **never Railway** (`CLAUDE.md` §17).

## 1. RE-CHUNK THE HELD 2020+ BODIES — as ONE operation with the index merge

The 3,842 held report/response bodies are one blob-row each (up to 455,137 chars), so BM25 buries them and PDF line-breaks defeat literal matching. `v32-rechunk-reports.ts` (built, dry-run: ×20.5, 0 lossy) replaces each blob with per-finding sections. **The mutation and the index work MUST run as a single operation** — landing \~78,776 rows and retiring 3,842 blobs while Lance still holds the superseded blobs would put corpus and index out of step, which is the exact July mistake the base brief named. So, in sequence, without stopping between:

1.  `v32-rechunk-reports.ts --commit` (R2 before Neon; the attempted-vs-stored reconciliation must exit clean).
2.  FTS catch-up **and fold the new rows into the index** (playbook §20).
3.  Embed the new sections (`gemini-embedding-001` @768d). **Predicted \$4.68** — report the sized number and proceed (it is a few dollars, not the \~\$600 full-corpus gate).
4.  Heavy job on Hetzner (measured \~19.8 GB peak), never Railway. **Acceptance:** the 2020+ reports are now findable per-finding; re-run of `v32-committees-phrase-check` shows the previously-buried phrases retrievable; corpus and index reconcile (no orphaned blobs, no unindexed rows).

## 2. WAYBACK BACKFILL — close the pre-2020 historical gap (7,651 documents)

Report/response bodies effectively start in 2020; before that the API lists the publication but serves no document — Carillion (2018) is the canonical casualty. Every one of the 7,651 archive-only documents carries an `additionalContentUrl` to `publications.parliament.uk` / `www.parliament.uk/globalassets`, both behind a Cloudflare bot challenge (403 to `fetch` on any UA *and* to headless Chromium; real Chrome passes — fingerprinting, not an IP ban). **The Wayback Machine mirror works programmatically and was proven on the Carillion report** (Charlie's confirmed route). Build:

-   A backfill source + worker path: `additionalContentUrl` → resolve the Wayback snapshot → fetch the body → the SAME splitter (§1) → sections → R2 → Neon, attach to the existing publication record (ADDENDUM §B: `parentDocId` unchanged, link don't fork).
-   Politeness on the Wayback host; the type-filtered API walk (`publicationTypeId`) is the enumeration — **do not use an unfiltered year walk** (it 500s partway and returns a truncated year silently, understating the gap — the measurement trap the audit hit).
-   Embed the new sections. **Predicted \~156,875 sections, \$9.31.** Report sized cost, proceed.
-   Same index-merge-as-one-operation rule as §1. **Acceptance:** Carillion's report body is in the corpus and its "recklessness, hubris and greed" verdict is retrievable; the held vs source gap is closed or the residual is reported as a known-unknown.

## 3. §B/§D METADATA PASS

Attach the join keys and search metadata onto the report/response rows (they exist on the listing item): stable **inquiry id** (present on 46.1% of reports — the rest genuinely are not inquiries, so record null honestly, don't invent), **committee name + house** (Commons/Lords/Joint — all present), publication date, and the **report ↔ government-response link** (22.3%). Rationale: these are what let the search prefilter target `type=COMMITTEE`, what join evidence ↔ report ↔ response for the loop test, and what the next round of conclusion-shaped gold questions need.

## 4. §E LOOP TEST (after §2 lands)

For Carillion specifically: confirm its evidence, its report conclusions, and the government's response are all retrievable and all linked to the same inquiry id. This proves the scrutiny loop end-to-end — the actual product capability — not merely that a phrase is present.

## 5. HAND BACK

On completion, hand to the search thread to re-test the committees stream against real, findable content and re-draft the committee gold questions against **conclusions** (which is now possible). Note the live post-filter→prefilter fix remains the search thread's call.

## SEPARATE — DO NOT FOLD IN (flagged for Charlie, see reply)

The corpus-wide `chunk.ts MAX_CHUNKS=8` truncation (only 59.4% of body words reach the vector index) is NOT part of this brief. It is a precondition for the vector-search rollout and needs its own scoped decision. Keep it out of V32 so this stays clean.

## GIT

No git mid-sprint; single commit-all.sh; preview; Main.
