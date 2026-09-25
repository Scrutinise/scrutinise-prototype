# SEARCH — S22: cost alerts and the orphan marker

**Written:** 2026-09-24/25. **Brief:** given inline by Charlie, same session as S20a close-out and
the S21 amendments (`docs/SEARCH_S21_REPORT.md`'s AMENDMENTS section). No `docs/BRIEF_SEARCH_S22.md`
was filed. `scripts/ingest/search/` not touched; Lex's own routes
(`app/api/ai/[ideaId]/route.ts`, `app/api/ai/public/route.ts`) not touched.

---

## §0 — what could and could not be verified from this machine

Same constraints as S21 (`docs/SEARCH_S21_REPORT.md` §0): no `GROK_API_KEY`/`OPENAI_API_KEY` here,
`api.anthropic.com` blocked by a sandbox TLS issue. New for this brief: **no `RESEND_API_KEY` on
this machine either**, which bears directly on §1's proof step — stated plainly in that section
rather than glossed over.

---

## §1 — Alerts

**Built:**

- `prisma/cost_alert.sql` + matching `schema.prisma` model — `CostAlertSent(month, thresholdUsd)`,
  UNIQUE constraint, additive. **Applied to production** (Charlie's established pattern this
  session: additive migration, applied early, `whichdb`-confirmed `ep-old-dust-aboxi69a`).
- `lib/email.ts`'s `sendCostAlertEmail()` — follows this file's own `SendResult` discipline (25-W
  §A: a caller must be able to tell a real send from a skip before it records anything).
- `scripts/cost-alert.ts` — the daily job. Reads month-to-date `LlmSpend` (UTC calendar month),
  converts stored GBP pence back to USD using the SAME rate `spend-ledger.ts` priced at
  (`USD_TO_GBP`, now exported rather than re-hardcoded), checks each configured threshold
  (default `$20,$50`, env-overridable), and sends **once per (month, threshold)** — the "once"
  guarantee lives entirely in `CostAlertSent`'s UNIQUE constraint plus `ON CONFLICT DO NOTHING`, not
  in application logic that could race.
- ⚠ **An unpriced call is reported, never silently dropped from the total** — same rule
  `spend-ledger.ts`'s own `fold()` uses, restated here because a cost alert is exactly the surface
  where understating spend would matter most.
- **Scheduling itself is NOT built.** The brief asks for "a daily job"; this is that job, runnable
  on demand or from any scheduler. Wiring an actual daily trigger (Railway cron, PM2, GitHub
  Actions) is an infrastructure choice for Charlie once the job itself is proven — building a
  schedule around an unproven job would be the wrong order.

**Proof, live, in three pieces:**

1. `--dry-run` against real production data: **MTD spend $20.49 across 3,203 calls, correctly
   identifies $20 passed / $50 not yet**, sends nothing.
2. **The proof step asked for by name** — `LEX_COST_ALERT_THRESHOLDS=0.01`, for real (not
   dry-run): correctly detects $0.01 passed, attempts the send, and — because **no
   `RESEND_API_KEY` exists on this machine** — `sendEmail` declines exactly as designed, and the
   job reports `"NOT sent: RESEND_API_KEY is not set... Will retry next run (not recorded)"`.
3. **Confirmed directly against the database**: zero rows in `CostAlertSent` after that run — the
   skip-vs-send distinction holds; a declined send is never recorded as done.

**What this proves and what it does not.** The full path — query, threshold logic, the
skip/send/dedupe distinction, and the "retry, don't permanently silence" behaviour on a failed
send — is live-verified against production data. **The one link not verified from here is Resend
actually delivering an email**, because there is no key on this machine to exercise that leg.
Re-run `npx tsx --env-file=.env scripts/cost-alert.ts` (no `--dry-run`, any threshold already
passed) from a machine or Railway service where `RESEND_API_KEY` is set to close that last gap —
it will report a Resend id on success, per `SendResult`.

---

## §2 — Attribution

**⚠⚠ Found by directly querying production, not assumed: `runNextPass` HAS carried both `userId`
and `ideaId` all along** — `nextQueuedBuild()` resolves `userId` from `idea.creatorId` and passes it
as a real argument the whole way in. **The gap was one layer down**: `callModelJson`
(`model-call.ts`), the ONE entry point `reranker.ts`, `build-llm.ts`, every `deepening-*.ts` file and
`search.reranker`/`search.query-router` go through, has no `userId`/`ideaId` parameter at all — so
every `LlmSpend` row written through it, for every build ever run, carries NULL for both. Confirmed
concretely: **27 real `search.reranker` rows written by a genuine build in the two hours after
S20a's flag fix, every one `ideaId=null userId=null`.**

**The fix, and why it is not "add userId/ideaId to every function signature between the build engine
and `recordSpend`":** `runSearch()`'s `GatewayQuery` alone is called from a dozen surfaces —
`general-chat.ts`, orientation, three legacy legislation surfaces, the build engine — and widening
it to carry attribution would touch all of them for a concern only ONE of them (the build) has.
Instead: `lib/lex/build-context.ts` (new), an ambient request-scoped context using Node's
`AsyncLocalStorage` — the standard tool for exactly this, a value a whole call chain needs without
every function in it carrying it explicitly. `runNextPass` calls `enterBuildContext({ userId,
ideaId })` once, at the top, before it does anything else; `recordSpend` (`spend-ledger.ts`) reads it
as the FALLBACK — **an explicit `userId`/`ideaId` always wins**, so chat web search (§7 amendment,
which stamps the chatting admin explicitly) is never overridden by ambient context it is not even
running inside.

**Before/after, live, on one call — not a real build (none could be started from this machine; no
FTS/vector backend locally) but the exact production code path, for real, against `gemini-2.5-flash`:**

```
enterBuildContext({ userId: 'test-s22-attribution-user', ideaId: 'test-s22-attribution-idea' })
await rerankCandidates('sewage pollution enforcement', candidates)   // the REAL reranker.ts function

BEFORE this session's fix (the 27 rows from the actual build, minutes earlier):
  pass=search.reranker  userId=null  ideaId=null   (× 27)

AFTER (this test call, same pass, same code path, only build-context.ts added):
  pass=search.reranker  userId=test-s22-attribution-user  ideaId=test-s22-attribution-idea
```

Test row deleted afterward — it was synthetic attribution on a real Gemini call, not left in
production. **Not yet confirmed on an actual worker-driven build** — that needs this fix pushed and
a real build run afterward; recommended as the closing check once `commit-all.sh` lands (see the
handoff note at the end of this report).

**Files:** `lib/lex/build-context.ts` (new), `lib/lex/spend-ledger.ts` (`recordSpend` reads the
ambient context as fallback), `lib/lex/build.ts` (`runNextPass` enters it).

---

## §3 — Orphan marker

**⚠⚠ Real and currently live, not hypothetical — independently re-verified against production,
not taken on trust.** `fts-search.ts` and `vector-search.ts` each run their search against the
served index, then do ONE batched Postgres hydrate (`WHERE id IN (...)`) for url/date/title. When
a hit's id has no matching row, the existing code silently fell through to the index's own stale
copy, with zero signal — exactly the condition `docs/SEARCH_S19_REPORT.md` §1.1 measured **five
weeks before this session** and left unfixed: *"the product returns a result card titled with the
name of the collection, with no citation, no date and nothing to click… and Lex may cite them."*
Seven whole collections (36,919+ sections) had **zero rows in the database while live in the
served index**: `lda-commonsdivisions`, `lda-commonswrittenquestions`, `lda-lordsdivisions`,
`lda-lordswrittenquestions`, `oecd`, `written-answers`, `written-statements` (plus `et-decisions`
partially). **Queried directly against production just now, independently of the implementation
work: all five spot-checked prefixes still have exactly 0 rows today** — `corpus_sections` —
`lda-commonsdivisions` 0, `lda-lordsdivisions` 0, `oecd` 0, `written-answers` 0,
`written-statements` 0. This is a standing defect, not something S19 already closed.

**Built:**

- `lib/lex/page1-config.ts` — `SearchResult.orphaned?: boolean`, tri-state on purpose:
  `undefined` = the hydrate step never ran for this result (a constructor outside the two search
  adapters, e.g. `search-stub.ts`), `false` = hydrated and the row exists, `true` = hydrated and
  the row is missing. Only `true` is the orphan. `ORPHAN_LABEL` exports the brief's exact text —
  `'in search index, not in database — cannot be opened'` — as one constant, so every caller that
  shows it uses the same words.
- `fts-search.ts` / `vector-search.ts` — `orphaned: !meta` at each adapter's existing hydrate site
  (the one place per adapter that already computes `meta = hydrate.get(h.id)`).
- `search-gateway.ts` — the shared choke point every caller goes through: `meta.orphanCount` on
  `GatewayResult`, a count in the existing `[search-gateway] result` log line, and a `console.warn`
  naming S19 §1.1 whenever `orphanCount > 0`. **Never filters `results` here** — the brief's own
  "why": hiding it would conceal the defect from the only check that can see it.
- `general-chat.ts` — the confirmed numbered-`[n]`-citation renderer: orphaned hits are excluded
  from `context` (what the model is shown) **before** the top-N slice, so they never receive a
  citation number and structurally cannot appear in `cited` — stronger than a prompt instruction,
  the same discipline as this file's existing out-of-range-marker handling. They remain in
  `search.results` (panel-visible, per the brief) and are counted in
  `diagnostics.orphanCount`.

**Verified:** live, against production data — the five collections' zero row counts, twice
independently (the implementation pass and this report's own re-check). **Not verified: an actual
HTTP round-trip through `fts-serve`/`vector-serve`** — `FTS_SEARCH_URL` is unset on this machine,
same constraint as the rest of this session's live-testing. A hand-built simulation of the exact
hydrate query, given one real id and one known-orphaned-shaped id, did correctly return
`orphaned=false`/`orphaned=true` respectively against live Neon data — a real positive-and-negative
control, just not through the HTTP adapters themselves.

**Open, not chased further this session:** the build engine's own evidence pipeline
(`build-research.ts`) does not build a raw numbered `[n]` list directly from `SearchResult[]` the
way `general-chat.ts` does — it goes through an intermediate findings-extraction step first
(`CitedFinding.citation`), a different shape than the one place this session confirmed and fixed.
Whether an orphaned hit can reach a build's own citations through that path, and if so whether it
needs the same `orphaned` filter, is unconfirmed — worth a specific check before this is called
closed platform-wide, not assumed either way here.

---

## Files touched this session (S20a + S21 amendments + S22, combined)

```
scrutinise-web/scripts/s20a-worker-flags.ts          — NEW: read/set build-worker's Railway vars
scrutinise-web/scripts/build-worker.ts               — boot line: + capabilityLine()
scrutinise-web/lib/lex/fetched-content-guard.ts       — NEW: one shared injection-defence wording
scrutinise-web/lib/lex/user-material.ts               — uses the shared guard (was its own wording)
scrutinise-web/lib/lex/orientation/web-orientation.ts — uses the shared guard; STRUCTURE_SYSTEM/SCHEMA exported for the injection test
scrutinise-web/lib/lex/orientation/x-orientation.ts   — uses the shared guard; X post cap 20→30
scrutinise-web/lib/lex/orientation/web-search.ts      — uses the shared guard; userId/ideaId added
scrutinise-web/scripts/check-orientation-injection.ts — extended: structural "one mechanism" assertion
scrutinise-web/scripts/check-lex-25d.ts               — two pre-existing stale assertions fixed
scrutinise-web/lib/lex/general-chat.ts                — NEW: chat web search (§7 amendment), gated off
scrutinise-web/lib/env-flags.ts                       — NEW flag: LEX_CHAT_WEB_SEARCH (default off)
scrutinise-web/lib/lex/model-registry.ts              — NEW pass: lex.chat-web-search-decide
scrutinise-web/app/api/admin/lex-general/route.ts     — passes user.id through
scrutinise-web/lib/lex/build-context.ts               — NEW: AsyncLocalStorage attribution context
scrutinise-web/lib/lex/spend-ledger.ts                — recordSpend reads ambient context as fallback; USD_TO_GBP exported
scrutinise-web/lib/lex/build.ts                       — runNextPass enters the build context
scrutinise-web/lib/email.ts                           — NEW: sendCostAlertEmail()
scrutinise-web/scripts/cost-alert.ts                  — NEW: the daily cost-alert job
scrutinise-web/prisma/cost_alert.sql                  — NEW: CostAlertSent table (APPLIED to production)
scrutinise-web/prisma/schema.prisma                   — matching CostAlertSent model
scrutinise-web/lib/lex/page1-config.ts                — SearchResult.orphaned, ORPHAN_LABEL
scrutinise-web/lib/lex/fts-search.ts                  — sets orphaned at the hydrate site
scrutinise-web/lib/lex/vector-search.ts               — sets orphaned at the hydrate site
scrutinise-web/lib/lex/search-gateway.ts              — orphanCount, log line, never filters
scrutinise-web/lib/lex/general-chat.ts (orphan part)  — excludes orphaned hits from citable context
```

**Checks:** see `docs/SEARCH_S21_REPORT.md`'s AMENDMENTS section for the S21-amendment checks
(`check:model-registry` 28/28, `check:lex-25d` 77/77, `check:orientation-injection` 8/8,
`check:client-boundary`, `check:flags` 54/54 — all re-run and still green after the S22 changes in
this file). `tsc --noEmit` clean, app + scripts, after every change in this report.

## Handoff — what's left for a session with more access

1. **Confirm `RESEND_API_KEY` and run `cost-alert.ts` for real** from a machine/service that has it,
   to see an actual Resend id come back (the query/threshold/dedupe logic is fully proven; the send
   itself is not).
2. **Push this session's commits, then trigger or wait for one real production build**, and confirm
   its `LlmSpend` rows carry `userId`/`ideaId` — the attribution mechanism is proven against the real
   code path but not yet against an actual worker-driven build end to end.
3. Decide where `cost-alert.ts` actually runs daily from (Railway cron on the `Ops` service seems
   the natural fit, given it already runs the hourly DB-size scheduler mentioned in `docs/CLAUDE.md`
   — not investigated this session, out of scope for "prove it can fire").
4. Check whether `build-research.ts`'s findings pipeline (a different shape from
   `general-chat.ts`'s direct numbered-source renderer — see §3's own "open" note) can surface an
   orphaned hit into a build's own citations, and extend the `orphaned` filter there if so.
