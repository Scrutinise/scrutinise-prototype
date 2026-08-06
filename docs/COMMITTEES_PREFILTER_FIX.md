# The committees stream is now scoped at the query, not after it

*6 Aug 2026. Search-side only. No ingest, no flag change, no answer key touched.*

## What was wrong

Four of the five streams were already scoped correctly by `tier` alone, because their tier maps
to exactly one stream. The two sharing the `parliamentary` tier — **debates** and **committees** —
were not. Both retrieved broadly across the whole 14.17M-row tier and were separated *afterwards*,
client-side, by display type in `query-router.ts`.

That is lossy, and the loss is invisible. The live chain is:

```
ftsStream(limit=20) → runFtsSearch(20) → callFts(60)
                    → rankedSearch(limit=60, k=300)
                    → SLICE TO 60  ← truncation happens HERE
                    → HTTP → client-side type filter  ← filter happens HERE, too late
```

Committee content is **1.17%** of the parliamentary tier, so the cutoff falls overwhelmingly on
Hansard and whatever committee rows survive are an accident of ranking.

## Was this contributing to CM1's failure independently of the ingest gap? — **Yes**

The brief asked for this to be ruled in or out explicitly. Measured at the real live depth of 60
(`probe-committee-prefilter.ts`), committee rows reaching the client-side filter:

| query | post-filter (today) | prefilter (fixed) | dropped by truncation |
|---|---|---|---|
| CM1 Carillion | **1** | 60 | **59** |
| CM2 Post Office Horizon | 15 | 60 | 45 |
| CM3 two-child limit | 18 | 60 | 42 |
| CM4 coronavirus response | 53 | 60 | 7 |
| **total** | **87** | **240** | **153** |

CM1 is the decisive case. It got **one** committee row out of 60 candidates, and the prefilter
recovers the actual Carillion inquiry material — e.g.
`committees-evidence:writtenevidence:86441:132227`, *"Sourcing public services: lessons learned
from the collapse of Carillion"*. BM25 had ranked these; truncation discarded them before the
type filter ever ran. No scope leaks in the prefiltered arm (every returned row is a committee
corpus).

**This refines, and partly corrects, GOLD_TEST_09.** That report concluded CM1 scores 100% purely
because Hansard satisfies its answer key. True — but incomplete. There *is* relevant Carillion
committee evidence in the corpus, and the post-filter was hiding almost all of it. Two independent
defects, exactly as the brief suspected. The GOLD_TEST_09 finding that committee **conclusions**
(as opposed to submitted evidence) are essentially not ingested still stands unchanged — the
recovered documents are written evidence, not the committees' own report.

## The fix

A server-side corpus **prefilter**, so the top-N is computed *within* the stream rather than
sampled from outside it. Same argument, and deliberately the same wording, as `vector-core.ts`'s
existing note on why the tier filter must be a prefilter.

- `fts-core.ts` — new `SearchScope` (`tier` / `corpora` / `excludeCorpora`) → one SQL predicate.
- `fts-query-service.ts` / `vector-query-service.ts` — accept, validate and **echo** the scope.
- `fts-search.ts` / `vector-search.ts` — send it and check the echo.
- `query-router.ts` — `committees` declares `corpora`; `debates` declares the complement
  `excludeCorpora`. The `types` post-filter **stays** as a backstop and should now filter nothing.

**Also fixed: a scoping hole in the citation resolver.** `resolveInjections` fetched by `id LIKE`
with no scope predicate at all, so a citation-shaped query against a parliamentary stream could
inject *legislation* rows — and because injections are scored **above** the BM25 list, an
out-of-scope injection would not merely appear, it would appear first. It now takes the same
predicate as the BM25 half.

## One deliberate asymmetry: the corpus scope degrades, the tier scope fails closed

`fts-serve` deploys independently of the app. Between shipping this and redeploying the service
there is a window where it ignores `corpora` and returns the whole tier.

Failing closed there would take **both** parliamentary streams to zero results for the length of
that window — a self-inflicted outage to prevent what is merely today's behaviour. So an
unhonoured *corpus* scope logs a warning and degrades to the client-side type filter. It is safe
because correctness does not rest on this filter: the `types` post-filter still runs, so results
stay correctly typed, just fewer of them. **The prefilter is a recall improvement, not a
correctness guarantee.**

The *tier* check in `vector-search.ts` stays fail-closed, because for legislation there is no
`types` backstop and an unscoped ANN result really would put another tier in front of a user.

Observed working, against the live (not-yet-redeployed) service:

```
[fts-search] service did not honour corpora=["committees-reports","committees-evidence"]
  (echoed undefined) — falling back to client-side type filtering; REDEPLOY fts-serve
```

## Verification

`verify-stream-scoping.ts` extended: its stand-in now honours *and* echoes the corpus scope, and
it asserts the scope reached the wire. Without that assertion the tier check alone is satisfied by
**both** parliamentary streams, so a committees run that silently searched the whole tier would
still have reported success.

Run against the live FTS service for three streams — `committees`, `legislation`, `debates` —
each **SCOPING CONFIRMED**: exactly the target stream changes, every other stream is byte-identical,
and the dense service was only ever asked for that stream's own corpus scope.

## Deployed and re-verified — the prefilter is live

`watchPatterns: ['scripts/ingest/search/**']` meant the push auto-deployed `fts-serve`. Confirmed
by polling the live service until it echoed the parameter rather than by assuming the deploy
landed:

```
POST /fts-search {"query":"Carillion","tier":"parliamentary",
                  "corpora":["committees-reports","committees-evidence"]}
→ corpora echoed: ['committees-reports','committees-evidence']
→ committees-evidence:writtenevidence:89668:135044   (Carillion inquiry evidence)
  committees-evidence:writtenevidence:92252:137079
  … 3 more
```

The same query previously returned Hansard. All three streams re-verified against the redeployed
service — **SCOPING CONFIRMED**, with no degradation warnings.

**Measured end-to-end effect on the probe queries: the committees stream returned 0–1 results
before and returns a full 24 after.** That is the client-side truncation loss, gone.

## Still outstanding

- **The vector-query-service concurrency guard has not landed** (checked, not assumed: zero
  matches in the file, no commit touching it). It was a recommendation in
  `VECTOR_DEPLOY_READINESS.md` that was never authorised. The vector service is not deployed, so
  nothing is at risk today — but it remains a prerequisite for deploying it.
- Committee **conclusions** are still not ingested (`GOLD_TEST_09` D3). This fix improves what can
  be retrieved from the evidence that exists; it does not add reports.
- A re-score of `GOLD_TEST_05` is now worth doing, since the stream retrieves very differently —
  but it needs the answer-key decision first, so it is deliberately not done here.
