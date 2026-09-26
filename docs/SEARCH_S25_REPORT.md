# SEARCH — S25

**Written:** 2026-09-25. Continues `docs/SEARCH_S24B_REPORT.md` in the same sprint window —
S24b's two Vercel-blocked items are finished here as §5.

---

## §1 — Confirm the cause

**Root cause confirmed, with hard evidence, not inference.**

Railway's `environmentHistory(environmentId)` query — reachable with the existing
Project-Access-Token, where `auditLogs` is not (it needs a `workspaceId` a project token
cannot obtain) — records `slept`/`resumed`/`deployed` events per service, timestamped to the
millisecond. New script: `scripts/ingest/ops/who-changed-sleep.ts`.

- **`sleepApplication` was `true` on both `fts-serve` and `vector-serve`.** A dashboard-sourced
  `EnvironmentPatch` at **2026-09-25T17:53:02.791Z** touched exactly these two services;
  `sleepApplication` reads `false` on both as of this session. `EnvironmentPatch.payload`/
  `activityPayload` are empty objects through this API — no field-level diff is exposed, so
  "by whom" is only "a human, via the dashboard" (the `actor.principal` is a Railway-internal
  UUID this token cannot resolve to a name) — stated as such, not guessed further.
- **Every single `resumed` event in a 100-entry sample (spanning ~2.5 hours) lands within 1–2
  seconds of the observer's 15-minute tick marks** (`:00:30`/`:15:30`/`:30:30`/`:45:30` —
  confirmed against `ops.ts`'s actual `runQuarterHour()`/`msUntilNextQuarter()` logic, not the
  file's own header comment, which wrongly says "hourly"). Each `slept` follows roughly 10–12
  minutes after a `resumed` — consistent with Railway's idle timeout, and with this project's
  own prior finding (`ops/who-is-knocking.ts`) that a health-check poll IS inbound traffic and
  resets that timer. **The observer's own `/stats` poll was the mechanism keeping the
  sleep/wake cycle — and therefore the RESTARTED flood — going.**
- **Confirmed live, not just correlated**: both services' `/stats` `started_at` matches the R2
  state exactly (17:54:24.672Z / 17:54:04.756Z) and has not changed across ~54 minutes and
  three further 15-minute ticks since the settings change, spanning the production observer's
  own last-alert record (`fts-serve:restart` / `vector-serve:restart` both stamped
  `2026-09-25T18:00:31.120Z` — the LAST restart alert, correctly triggered by the legitimate
  redeploy the settings change caused, not by a further sleep/wake cycle). **Zero further
  RESTARTED emails since.**

## §2 — Restart classification

`serve-observer.ts`'s restart-detection block now classifies every boot-time change using the
same `environmentHistory` events from §1, via `classifyRestart()`:

- `wake` — a `resumed` event for that service within 60s of the new boot time.
- `deploy` — a `deployed` event in the same window.
- `crash` — neither, and the evidence query succeeded.
- `unknown` — the evidence query itself failed, or the service has no known Railway id.
  **Never `crash`** — a failed lookup is not evidence of a crash (same OFF-vs-FAILED
  discipline as CLAUDE.md §18's corollary, one level up).

Only `crash` can alert, and only at **3+ within a rolling hour** (`CRASH_LOOP_THRESHOLD` /
`CRASH_LOOP_WINDOW_MS`). `deploy`/`wake`/`unknown` are logged (`ServeState.restartLog`, bounded
per service) but never emailed.

## §3 — Alert rules

The brief names exactly four immediate-email rules; **everything else that used to alert
immediately (memory>70%, p95>5s, rejections>0, Neon storage over budget, Neon check failures)
now folds into a new pure `summarizeHealth()` function instead** — the digest's one-line
health summary, not an email of its own. This was not itself asked for in so many words, but
follows directly from "immediate email only for: [the four]... everything else goes to the
digest."

1. **Down > 5 minutes.** Gated on the condition persisting across at least one full 15-minute
   tick (`downSince` tracked in state) before the first email; announces its own resolution
   when it recovers, but only if it was ever loud enough to have alerted (a blip under 5
   minutes needs no all-clear either).
2. **Crash loop.** §2's 3-in-an-hour rule. Also announces resolution — checked every tick
   (not only when a new restart happens), since resolving is the passage of time (old crashes
   aging out of the window), not an event.
3. **Spend threshold.** Already live: `cost-alert-cron`, a Railway cron service (`0 8 * * *`,
   `npx tsx scripts/cost-alert.ts`), confirmed via its own service config and a `SUCCESS`
   latest deployment. No work needed — found, not built.
4. **Build failure.** New: `scripts/ingest/ops/build-failure-observer.ts` polls
   `build-worker`'s latest deployment status (`c0d9fd39-9226-4d85-a9c5-a616341a542f` —
   confirmed live via `project(id){services{...}}`, and added to `sleep-state.ts`'s `SERVICES`
   map alongside `cost-alert-cron`, both previously missing from it). Same
   open/resolve/6h-reminder cadence. Wired into `ops.ts`'s existing 15-minute cycle.

**Reminder cadence tightened to match the brief's "six hours"**: `REALERT_HOURS` default
changed from 12 to 6 — it now governs exactly the two rules left that can alert on their own
(down, crash-loop), so this one window IS that reminder.

**Proof each rule fires once, forced** (constructed inputs, no real outage):
`serve-observer.ts --force-test crash-loop` demonstrates 4 consecutive crashes producing
exactly 1 alert (on the 3rd) and correct dedup on the 4th; `check-serve-observer.ts` (51
assertions) and `check-build-failure-observer.ts` (11 assertions) cover every rule
automatically, including the down->5min gate, the resolve/reminder cadence, and that
`build-failure-observer.ts` — run live (`--dry`) against production `build-worker` — reports
0 events on a healthy build.

## §4 — Daily digest, rewritten

**Replaces `serve-observer.ts`'s old daily digest** — confirmed to be the only daily digest
email anywhere in this codebase (a separate `progress-reporter.ts` email exists but reports
ingest/corpus-pipeline counters, an unrelated domain, out of scope). `renderDigest()` itself
is NOT deleted — it is now the source for the new digest's raw-counters link instead of an
auto-fired email.

New: `scrutinise-web/scripts/cost-digest.ts` (the daily job, same "deploy as your own Railway
cron, like `cost-alert-cron`" pattern) + `lib/lex/cost-digest-data.ts` (the shared
data-gathering, also used by the new `/api/admin/cost-digest` route/page) + `sendCostDigestEmail`
in `lib/email.ts`.

- **£ yesterday, MTD vs $20/$50, projected month-end.** Verified against real production data:
  yesterday £0.33, MTD £16.23 ($20.55 — already past the $20 threshold this month), projected
  $25.68.
- **Purpose split** — new `PASS_PURPOSE` map in `spend-ledger.ts`, keyed by the REAL pass
  names found in production (queried directly, not assumed from a grep — several differed
  from what a code search alone would have found: `build-research.gather`,
  `smart-vocabulary.gather`, `orientation.web-search` not `orientation.web-fallback`,
  `s24b.retry-probe`/`s24b.smoke`, etc.). Any pass not in the map is listed as unmapped,
  never folded silently.
- **Supplier split** — grouped by `providerFor(model)`.
- **Railway per-service** — `railwayCosts()`, a twin of `ops/cost-estimate.ts`'s calibrated
  usage query (package-boundary reasons documented in both files' headers).
- **Neon storage** priced (same $0.35/GB-month formula as the old digest); **Neon compute and
  Vercel are both explicitly flagged as uncaptured**, not silently omitted — no Neon
  compute-billing API exists anywhere, and `VERCEL_TOKEN` remains SAML-blocked on every
  project-scoped endpoint (re-confirmed, unresolved).
- **Top 5 ideas/users** — ⚠⚠ **measured, not assumed: only 18 of 7,823 `LlmSpend` rows
  (0.23%) carry a `userId`, 42 (0.54%) an `ideaId`.** The digest computes and shows the top 5
  anyway (the brief's own ask), but states plainly, every time, that this is a thin slice, not
  a representative one — the number of attributed ideas/users is printed alongside it.
- **Health, one line** — `summarizeHealth()` (§3), collapsed to `"all services healthy"`
  unless there's an exception, which is named.
- **Raw counters → `/admin/cost-digest`** (new admin-gated page + API route), replacing the
  old digest's inline JSON dump.

Rendered email body reviewed by eye against constructed data (see the session's own render
check) — matches every section the brief asked for.

## §5 — S24b finish: Grok key + orientation proof

**Partially blocked on deploying THIS sprint** — `/api/health`'s `xaiKey` field (added in
S24b) is still uncommitted, per the no-mid-sprint-git rule, so production's current `/api/health`
(commit `a7124ce9`, checked live) does not yet show it. This is expected, not a new blocker:
the same live-production proof this section needs will run as part of this sprint's own §20
delivery check, after `commit-all.sh`, not before.

## §6 — OpenAI ("Luna") adapter

**Code-complete; live verification blocked on `OPENAI_API_KEY`, which is in Vercel (Charlie's
own action) but not in this machine's local `.env`.**

- `searchOpenAI()` added to `web-search.ts`, modelled on `searchXai` (OpenAI's Responses API
  is close in shape to xAI's — `tools:[{type:'web_search'}]`, `output` array with
  `url_citation` annotations) rather than Anthropic's two-tool pattern. `tool_choice:
  'required'` (unlike xAI's `'auto'`) since this adapter's only purpose is to search.
- `WebSearchProvider` extended to include `'openai'`. **Not added to `DEFAULT_ORDER`** — same
  status as Anthropic post-S24b: built and measurable, never a live fallback (confirmed
  against this session's own policy memory: Gemini stays the sole default).
- New `recordOpenaiUsage()` in `spend-ledger.ts`: composes rate-card token cost with OpenAI's
  own $10/1,000-calls `web_search` tool fee (confirmed live from
  `developers.openai.com/api/docs/pricing`, 25 Sep 2026) — counted from the response's own
  `output` array (`type: 'web_search_call'` entries), since OpenAI's `usage` block (unlike
  Anthropic's) does not report a tool-call count directly.
- `gpt-6-luna` added to `model-registry.ts`'s `REACHABLE.openai` and to `build-cost.ts`'s rate
  card ($0.10/$0.50 per 1M tokens, Standard short-context tier — confirmed real and priced on
  the same pricing page, alongside gpt-6/Astra). **Listed on the strength of a docs read
  alone, exactly like `grok-4.7`'s entry — NOT a live call**, and explicitly not made any
  pass's default, per this file's own rule that a docs read is weaker evidence than a live
  probe.
- Live-checked (no key): `webSearch({provider:'openai', ...})` returns `ok:false` with a
  named reason rather than throwing — the graceful no-key path works.
- `scripts/s24b-web-search-comparison.ts`'s `PROVIDERS` extended with `'openai'` — no other
  structural change needed. Not yet re-run (needs the key).
- **xAI's fee, confirmed from `docs.x.ai/docs/pricing`**: `web_search` $5/1,000 calls;
  `x_search` $5/1,000 posts + $10/1,000 profiles (billed per item, not per call) — consistent
  with the existing `cost_in_usd_ticks`-based actual-cost mechanism already in
  `recordXaiUsage`, which reports the vendor's own all-in figure rather than needing this
  rate separately.

**Outstanding, blocked on Charlie:** the live 1-token reachability probe for `gpt-6-luna`
(this file's own rule: a docs read is not a callability test) and the 10-question
comparison's `openai` column.

## §7 — False corroboration

Fixed in `web-search.ts`'s `searchGoogle()`: new `dedupeFalseCorroboration()`, exported and
unit-tested (`scripts/check-web-search-corroboration.ts`, 7/7). **The correct invariant,
confirmed against both real shapes from the original measurement**: identical snippet text
across DIFFERENT urls collapses to one (the defect — reproduced exactly: 7 urls, 1 sentence
→ 1 result); different snippet text from the SAME url survives untouched (the legitimate
case — reproduced exactly: 4 different Irish minimum-wage figures, 1 url → all 4 survive).
An ordinary same-url/same-text duplicate also collapses, correctly. Applied only to Google's
adapter, which is where the defect was measured — deliberately NOT extended to xAI/OpenAI
without a measurement of the same defect there.

`general-chat.ts`'s chat web search and `web-orientation.ts`'s primary Gemini tier both funnel
through this one function, so one fix covers both; the xai-pinned fallback path is untouched,
correctly.

## §8 — Admin link

`app/admin/layout.tsx` had no existing nav array (a single static back-link) and no
stream-ownership marker, so edited directly: "Corpus chat (test)" → `/admin/lex-general`.

---

## Verification summary

- `tsc --noEmit` clean across both `scripts/tsconfig.json` and `scrutinise-web`'s own program,
  throughout.
- `check:llm-guards` 9/9, `check:model-registry` 28/28 (both re-run after touching
  `web-search.ts` and `model-registry.ts`).
- `check-serve-observer.ts` 51/51 (all new S25 assertions plus every pre-existing one,
  rewritten where the brief changed the behaviour being tested).
- `check-build-failure-observer.ts` 11/11 (new).
- `check-web-search-corroboration.ts` 7/7 (new).
- `cost-digest.ts --dry-run` run against real production `LlmSpend`/Railway/Neon data.
- `build-failure-observer.ts --dry` run live against production `build-worker` (0 events, a
  healthy build, correctly reported).
- `who-changed-sleep.ts` run live against production Railway; both services' `/stats`
  fetched live to confirm no further restarts since the settings change.

## What is NOT yet done, stated plainly

- §5's live production proofs (xAI key, orientation briefing) — need this sprint deployed
  first, per the no-mid-sprint-git rule; scheduled as part of this sprint's own §20 delivery
  check.
- §6's live OpenAI probe and comparison column — needs `OPENAI_API_KEY` locally, or a
  production-run equivalent; blocked on Charlie.
- §1's "by whom" — the Railway API cannot resolve the actor UUID to a name with this token;
  only "a human, via the dashboard" is provable from here.
