# SPRINT — SEARCH S25 (2026-09-25)

> Handed over in chat, written to disk per the sprint-brief protocol (`docs/CLAUDE.md` §12).
> Continues `docs/SEARCH_S24B_REPORT.md` / handoff_summary.md SEARCH THREAD (S24b, 2026-09-25).
> S24b items 1–2 (Grok key proof, orientation engagement proof) were blocked purely on
> Charlie's own Vercel action (`GROK_API_KEY` added, redeployed) — S25 finishes them as
> Phase 5 below, alongside new work.

## Why

Charlie received ~80 false "RESTARTED" emails in one morning, and the daily digest reports
engineering counters rather than cost. The owner needs one daily answer — what did
yesterday cost in £, and on what — and immediate emails only when something needs him.

## Scope

1. **Confirm the cause.** From Railway's activity log: when Serverless (sleeping) was
   enabled on `fts-serve` and `vector-serve`, and by whom. Confirm the restarts coincide
   with the observer's 15-minute checks. After Charlie turns sleeping off, show the restart
   emails stopped.
2. **Restart classification.** The observer labels every restart as `deploy` (new commit),
   `wake from sleep`, or `crash` (read Railway's deployment status and exit reason). Only
   crashes alert, and only three or more in an hour.
3. **Alert rules.** Immediate email only for: service down more than five minutes; crash
   loop; spend threshold; build failure. One email per incident, one when resolved, a
   reminder after six hours if still open. Everything else goes to the digest. Prove each
   rule fires once on a forced test.
4. **Daily digest, rewritten, replacing the current one** (`serve-observer.ts`'s
   `renderDigest` — the only daily digest email in this codebase, and the one reporting
   memory/concurrency/throughput/cache/Neon "engineering counters"):
   - Yesterday's total in £, and month to date against the $20/$50 thresholds with a
     projected month-end.
   - Split by purpose: user builds, Lex chat, web orientation, search (router, reranker,
     embeddings), ingest and maintenance, tests and measurement. Map each ledger pass name
     to one purpose; list any pass not mapped rather than hiding it.
   - Split by supplier: Gemini, Anthropic, xAI, OpenAI, Railway per service (from Railway's
     usage API), Neon (storage and compute), Vercel if its API allows.
   - Top five ideas and users by cost.
   - Health in one line ("all services healthy") unless there is an exception.
   - Report which costs cannot be captured automatically, so Charlie knows what the total
     excludes.
   - Raw counters move to a link, not the email body.
5. **S24b finish (Grok key now in Vercel, redeployed).** Prove the key from production and
   show a real orientation briefing with both web and X tiers, cost and time each.
6. **OpenAI Luna adapter.** Add `gpt-6-luna` with OpenAI's web search as a third provider,
   through the model registry. Run the same ten questions; report cost, time and
   reviewer-acceptable sources against Google and Anthropic. Confirm xAI's web-search fee
   from `docs.x.ai`.
7. **False corroboration.** Google returning seven URLs with one identical sentence: fix
   before orientation is relied on. A snippet must come from its own page; identical
   snippets across different URLs are flagged and collapsed to one.
8. **Admin link.** Add "Corpus chat (test)" to the admin panel navigation, pointing to
   `/admin/lex-general`. If the admin navigation belongs to another stream, write the
   one-line change for them instead — checked this session: `app/admin/layout.tsx` carries
   no stream-ownership marker, so this is done directly.

## Out of scope this sprint (per the brief)

- S23 step 2 (amends/repeals into Lex chat) — waits for the graphs conversation's function.
- Git worktree per stream — not started while any stream has uncommitted work.

## Known blockers going in

- No script has ever queried a Railway activity/audit log — needs fresh GraphQL
  introspection; may not exist on this API at all (Railway's audit log may be UI-only).
- `VERCEL_TOKEN` is SAML-blocked on every project-scoped endpoint (docs/CLAUDE.md §19) —
  Vercel's own usage cannot be pulled programmatically; will be reported as an uncaptured
  cost, not silently omitted.
- `OPENAI_API_KEY` is unset in the local `.env` (checked 2026-09-25) — the brief says the
  key is in Vercel; needed locally too (or a production-only proof path) to build/verify
  the Luna adapter.
- No Neon compute-billing API exists anywhere in this repo or was found live — compute is
  reported as uncaptured, same as Vercel.
