# SPRINT — (empty)

*The search-thread sprint handed over 2026-08-04 16:53 UTC was executed on 2026-08-04 and archived
to `CHANGE_LOG.md` — "SEARCH — the fast index reaches users: freshness, act metadata, legacy call
sites repointed" (2026-08-04 18:34 UTC). `docs/CLAUDE.md` §12 says to clear this file at sprint end.*

## What was completed

- **§0** — expansion fix confirmed live against the deployed runtime, and confirmed still
  load-bearing by a control probe.
- **§1** — freshness reconciled at id level across all 70 corpora and backfilled; Act-level
  metadata table `corpus_acts` built (`docs/ACT_METADATA.md`); all three legacy call sites
  repointed through `search-gateway.ts`.
- **§1a** — index rebuilt to `unindexed=0` via the Heavy Job Runner, `fts-serve` redeployed,
  re-measured (warm p50 1,196 ms).

## What did NOT run, and why

- **§2 gold baseline — blocks on Charlie's human answer-key validation pass**, as the brief itself
  states. The instrument side of the gate is now satisfied (`unindexed=0`, `fts-serve` on the new
  snapshot); the validation pass is not CC's to do.
- **§3 streams one at a time** — sits behind §2 by design.
- **§4 vector fusion** — behind §3. `LEX_SEARCH_VECTOR` untouched, still OFF.

## Carried into the next sprint

1. ~~**Index hygiene before §2's baseline.**~~ **DONE 2026-08-05** — `scripts/ingest/search/fts-hygiene.ts`;
   see CHANGE_LOG "SEARCH — index hygiene" (2026-08-05 08:06 UTC). 13,575 duplicates and **5,586**
   orphans removed (the estimate above said ~1,030 — it was 5.4× under, which is why the counts were
   re-confirmed before deleting); index rebuilt to `unindexed=0` and `fts-serve` redeployed.
   **The warning in this item still stands, and now bites harder:** removing 13,575 duplicate
   documents changed BM25 document frequencies, so **§2's answer key must be validated against the
   post-5-Aug index** — any gold-set numbers gathered before today are not comparable. Two residues:
   15 `stale` rows left in place pending Charlie's call, and `corpus_vec` carries the same
   unreconciled drift.
2. **`LEX_QUERY_ROUTER=true`** — recommended since 30 July, still not flipped, and this sprint
   produced the sharpest evidence for it yet (see the CHANGE_LOG table).
3. **Two Vercel unknowns** that need Charlie because the stored token 403s on the SAML scope:
   production's `LEX_QUERY_EXPANSION` / `LEX_QUERY_ROUTER` values, and whether `FTS_SEARCH_URL` is
   set (if it is not, all three repointed surfaces silently fall back to the legacy index — and
   say so in the logs and in a `degraded: true` response field).
4. **Browse widening** — `/legislation/[itemId]` resolves only by `LegislationItem` uuid, so the
   115,277 corpus-only instruments in `corpus_acts` cannot be linked yet.
