# BRIEF FOR CC-SEARCH — COMPLETE THE LEGACY DROP UNBLOCK (the last six web-app readers)
**Written:** 09 Aug 2026, by CCh-Ingest. This is the search/web side of the legacy DROP: repoint the last runtime readers of `LegislationItem`/`LegislationSection` onto `corpus_acts`/`corpus_sections`, then confirm to the ingest thread, which archives the tables and runs the DROP (~1.73GB Neon reclaim). Read `V26_LEGACY_DROP_RECHECK.md` §(a) for the exact six paths.

## DECISIONS TAKEN (CCh's calls — change any before you hand this to CC)
CC-Search surfaced three product decisions. My resolutions, with reasoning, baked into the sections below:
1. **Gateway failure with no legacy fallback → FAIL HONESTLY.** A visible "search unavailable" error, never a silent fallback or stale serve. This is the project's core doctrine — no fail-open, no invisible failure (the exact class the recent truncation bugs kept hitting). For a tool users must trust, a visible failure beats a quietly-wrong result.
2. **The one `IdeaLegislation` row → MIGRATE to a gid reference** (unless inspection shows it's test/junk, in which case delete and record which). Rationale: it's user data — a saved Idea linked to a piece of legislation — and preserving user data is the default. It's one row, so migration is trivial; deleting a real user's link to save nothing is the wrong trade.
3. **Filtered search (type/year/actId) → MOVE the filters to `corpus_acts`, don't retire the UI.** ⚠ This is the one I'd want you to confirm — see the reply. Rationale: per CC-Search's own sizing, `corpus_acts` has far broader coverage (250,808 instruments vs the legacy path), so moving the filters there *widens* the feature rather than just preserving it, and filtering by type/year/act is genuinely useful for legislative research. Retire only if you'd rather drop the feature to save the work.

## SIZING — the repoint is much smaller than the audit implied (CC-Search's finding)
The public detail page serves real content for only **432 of 135,531 Acts (0.3%)**, and `corpus_sections` covers all 432. So this is not a large migration — it's a small repoint that *widens* browse (up to `corpus_acts`'s 250,808 instruments) rather than costing anything. Treat it as a net-positive change, not a risky one.

## §1 — Repoint the six web-app read paths
Move each of the six `V26_LEGACY_DROP_RECHECK.md` §(a) paths off `LegislationItem`/`LegislationSection` onto `corpus_acts` (act titles/metadata) and `corpus_sections` (section bodies). The pattern is proven — it's the same `corpus_acts` drop-in the three search-side reads used on 7 Aug (135,531 titled rows, 0 missing, 0 differing). For each: repoint, verify the rendered output is identical (title resolution, citation formatting, deep links), and note any divergence.

## §2 — Gateway failure behaviour (decision 1)
On gateway/index failure with no legacy fallback, **fail honestly**: return a clear unavailable state to the caller, log it (with the `degraded:true` signal already in use), and do NOT fall back to stale data or a silent empty. No fail-open.

## §3 — The `IdeaLegislation` row (decision 2)
Inspect the single row. If it's a real saved Idea→legislation link, **migrate** its reference to the gid/`corpus_acts` form (preserve the link). If it's test/junk, delete it. Record which, and why, so the DROP isn't blocked by an unexplained row.

## §4 — Filtered search (decision 3)
**Move** the type/year/actId filters onto `corpus_acts` (it carries, or can derive, the act type and year; confirm the fields exist and index them if needed). Verify the filter UI returns correct results against the new source and that coverage is at least as wide as before (it should be wider). *If Charlie chose retire instead:* remove the filter UI and its legacy query path cleanly, leaving no dangling reference.

## §5 — Prove no runtime reader remains, then confirm to ingest
After the repoints, grep/trace the whole `scrutinise-web/` tree (plus anything else at runtime) for `LegislationItem` / `LegislationSection` / the `_DEPRECATED_2026-06-19` names — there must be **zero runtime readers** left (build-time-only references, if any, are fine but note them). Then send the ingest thread an explicit **repoint-confirm**: "all runtime readers of the legacy tables are repointed; safe to archive and DROP." Ingest owns the `pg_dump`-to-R2 archive and the DROP from there.

## OUT OF SCOPE / HANDOFF
The archive + DROP execution is ingest's (gated on your repoint-confirm). The `withPosition:false` ranking fix and the `callGeminiJson` truncation-guard class are separate search-thread items, not this brief.

## GIT
No git mid-sprint; single **scoped** commit-all.sh (explicit paths; this is `scrutinise-web/` work — don't sweep in ingest's or any other thread's uncommitted files); preview; Main.
