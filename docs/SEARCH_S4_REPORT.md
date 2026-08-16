# SEARCH S4 — REPORT

**Executes:** `BRIEF_SEARCH_S4.md` §1 and §2. §3 (batching, deepening intents) is **not started**.
**Date:** 2026-08-16
**Code:** `scrutinise-web/scripts/audit-s4-tier-scope.ts`,
`scrutinise-web/scripts/measure-s4-fusion-decision.ts`
**Config for every number below:** `fts=fts-serve-production.up.railway.app`
`vector=vector-serve-production.up.railway.app`
`streams=legislation,debates,committees,caselaw,guidance` `router=ON` — **fully configured**, asserted
at start-up by `assertRetrievalConfig` and printed beside every result (S3 §7.2).

⚠ **Those flags were set by the harness.** Production's values are unreadable from this machine
(SAML-blocked Vercel token — `docs/CLAUDE.md` §19) and are **not asserted anywhere in this report**.
Where a finding depends on flag state, it says so.

---

## §1 — THE SCOPE AUDIT. CHARLIE IS RIGHT, AND IT IS WORSE THAN THE BRIEF SUPPOSED

### The system already knows the answer, and the caller overrules it

The strongest single line in the audit is not about coverage. For each probe the harness also asked
the router, directly, which streams the question belongs to:

| question | router picked | caller forces |
|---|---|---|
| what have select committees said about water company sewage discharge | **`committees`** | `legislation` |
| what evidence did witnesses give on leasehold reform | **`committees`** | `legislation` |
| what did MPs argue in the debate on assisted dying | **`debates`** | `legislation` |
| has parliament scrutinised the rollout of universal credit | **`debates,committees,guidance`** | `legislation` |
| what was said about buy now pay later regulation in parliament | **`debates,committees,guidance`** | `legislation` |
| government guidance on procurement social value | `legislation,debates,committees,guidance` | `legislation` |

The router names the right part of the corpus, the tier-scoped branch keeps its **query rewrite**
and **discards its stream selection**, and the caller retrieves legislation anyway. This is not a
tuning problem. **The system's own judgement about where the answer lives is being thrown away by a
constant.**

### What the user actually gets

| question | route returns | the corpus offers and the route cannot show |
|---|---|---|
| select committees on sewage discharge | 12 results — `ukpga×7 uksi×4 nisi×1` | *Report: Fourth Report — Water quality in rivers (Environmental Audit)*; *Water Quality in Rivers — WQR0085* |
| the debate on assisted dying | 12 results — `uksi×8 ukpga×4` | *Assisted Dying Law* and *Assisted Dying* (Hansard) |
| witnesses on leasehold reform | 12 results — `uksi×12` | *12th Report — Leasehold Reform*; *Pre-legislative scrutiny of the draft Commonhold Bill* |
| universal credit scrutiny | 12 results — `uksi×10 asp×1 nisr×1` | *Universal Credit inquiry — UCR0119*; DWP debates |
| courts on reasonable adjustments | 12 results — `ukpga×12` | *Equality Act 2010 and Disability Committee — EQD0075* |

Across the seven non-legislation probes, between **36 and 146 non-legislation documents per
question** exist in the corpus that the route cannot return. Not one committee document, debate or
judgment reaches a user on the Lex chat route, on any question, ever.

### ⚠ THE PART THE BRIEF DID NOT HAVE: THERE ARE TWO GATES, IN SERIES

S4 §1 treats the tier as the scope. It is the first of two:

1. **`tier: 'legislation'`** — `gateway-legacy.ts:162`, passed by all three callers.
2. **`LEGISLATION_TYPES` filter** — `gateway-legacy.ts:166`, applied *after* the tier, keeping only
   `PRIMARY_LEGISLATION` / `STATUTORY_INSTRUMENT` / `EU_LEGISLATION`.

Measured, on every one of the ten probes: the gateway returned 36 results tier-scoped and the caller
received 12. **The type filter drops 24 of 36 every time.**

**Widening the tier alone would measure as a no-op**, because gate 2 discards whatever gate 1
admits. Anyone who widens the tier, sees no change, and concludes the scope was not the problem will
be wrong for a reason nothing in the logs would show them.

⚠ **And neither gate depends on any flag.** Both are unconditional. The flags change how well the
legislation tier is searched, never whether anything outside it can be returned — so this finding
holds regardless of what production has set.

### The third gate, which is the contract, and which is why this is not a one-line fix

`searchLegislationViaGateway` returns `LegacySearchResult` — `actId`, `actTitle`, `sectionNumber`.
The Lex chat route maps those straight into `legislationContext` as `actTitle` / `sectionNumber` /
`compiledText` / `legislationGovUkId`, and hands them to Lex as the law that governs the question.
**A committee transcript admitted through a widened scope would be presented to Lex as a section of
an Act** — precisely the "cited law must be real" failure `gateway-legacy.ts` already guards against
elsewhere.

So the fix is a second context channel with its own rendering and its own prompt block, not a
changed constant. **Nothing was widened in this sprint**, per §1's instruction.

### Per caller, the answer to "what should this search?"

| caller | what it is | is a legislation-only scope right? |
|---|---|---|
| `app/api/ai/[ideaId]` | **the Lex chat route** | ❌ **No.** It is the platform's main conversation and it is blind to committees, Hansard, case law and guidance. The largest finding in the sprint. |
| `app/api/ideas/[id]/legislation-search` | the legislation side panel | ✅ **Yes — measured, not assumed.** Asked the sewage committee question it returns *Sewerage (Scotland) Act 1968 s.39* and *Water Industry Act 1991 s.141A*, which is the right answer for a legislation panel. Its `PanelResult` contract has `actTitle` / `sectionNumber` / `isTnaVerified` / `amendmentCount` and no field a transcript could occupy. **Widening it would be a regression dressed as a fix.** |
| `POST /api/search` | the general search API | ⚠ **Scoped by its own contract, and that contract is the thing to decide.** Its Zod schema takes `filters.type ∈ {ukpga, uksi, operational}` and its results carry `actId`/`actTitle`/`sectionNumber`. It is a legislation search endpoint that is *named* like a general one. Auth-gated and described in-code as "Lex and future UI"; **no first-party UI calls it today** (the only callers of `searchLegislationViaGateway` are this route and the Lex chat route). So it is a naming and roadmap decision for Charlie, not a defect. |

---

## §2 — THE FLAG, MEASURED. `LEX_TIER_FUSION` SHOULD GO ON

### The population had to be established before the measurement

`LEX_TIER_FUSION` is read in exactly one place: `search-gateway.ts`'s `flags.router && q.tier`
branch. It governs **tier-scoped callers only**, and the only tier any caller passes is
`legislation`. Running the whole gold set through the untiered routed path and toggling the flag
would have produced two identical numbers and a confident verdict of "no effect".

The population is therefore the **16 scoreable, legislation-targeted gold queries** (A1–A5, B1–B6,
C1–C5 — 46 expected sources), run through the tier-scoped path exactly as the three legacy surfaces
run.

⚠⚠ **AND THE FLAG IS INERT UNLESS `LEX_QUERY_ROUTER` IS ALSO ON.** The branch that reads it is
guarded by `flags.router`; with the router off, every tier-scoped call goes to `runFtsSearch` and the
fusion flag is never consulted. **Turning `LEX_TIER_FUSION` on in Vercel while the router is off
would do nothing at all, silently** — §18's corollary again, one level up. Whether the router is on
in production cannot be read from here.

### Both run orders

| condition | order | recall@20 | preference | pref excluded | p50 ms | p95 ms |
|---|---|---|---|---|---|---|
| FUSION OFF | 1st | 20/46 (43.5%) | 1/1 (100%) | 19 | 5,381 | 5,847 |
| FUSION ON | 2nd | 30/46 (65.2%) | 4/6 (67%) | 14 | 5,446 | 7,782 |
| FUSION ON | 1st | 29/46 (63.0%) | 4/6 (67%) | 14 | 5,881 | 6,622 |
| FUSION OFF | 2nd | 19/46 (41.3%) | 1/1 (100%) | 19 | 5,079 | 6,031 |

**Pooled across both orders: recall@20 OFF 42.4% → ON 64.1%, Δ +21.7pp. p50 5,307 ms → 5,666 ms,
Δ +359 ms (+7%).**

The reversal changes nothing material: OFF reads 43.5% then 41.3%, ON reads 65.2% then 63.0%. The
recall gain is not a run-order artefact.

### ⚠ The latency answer is different from S3's, and S3's was not wrong — it was measuring something else

Same-condition p50 swing between first and second position: **OFF 302 ms, ON 435 ms.** The OFF-vs-ON
difference is **359 ms**, which is *smaller than the ON condition's own cache swing*. **By the
harness's own rule the latency difference is not distinguishable from cache warming.**

S3 reported 2,295 ms → 3,710 ms (+62%) and was right about the two retrieval calls it compared
directly. End to end through the gateway the same change is +7%, because **the router's LLM call
dominates the user-visible latency** — roughly five seconds of it, whichever retrieval runs
underneath. The fusion's cost is real and it is small relative to what the user waits for.

### ⚠ The preference metric moved its own denominator, and must not be read as a regression

`1/1 (100%)` OFF against `4/6 (67%)` ON looks like a quality loss and is not one. Of 15
within-stream gold pairs, **one was scoreable with fusion off and six with it on** — fusion retrieves
more of the pair sides, which is the same effect as the recall gain. A rate computed on a
six-fold-larger denominator is not comparable with the one before it. This is exactly the S2C5 trap
(*"only 4 of 15 scoreable pairs compared two documents the system actually returned"*), and the
honest statement is: **fusion made five more ordering judgements visible, and got four of six
right.** Nothing here argues against the flag; nothing here argues for it either.

### Per-query recall (order-1 pair)

| id | query | OFF | ON | Δ | top-20 overlap |
|---|---|---|---|---|---|
| A2 | What does section 1 of the Theft Act 1968 actually say? | 1/2 | 2/2 | +1 | 5/20 |
| A4 | Equality Act 2010 section 149 | 1/2 | 2/2 | +1 | 7/20 |
| B2 | I want to stop people renting out whole flats… | 1/3 | 2/3 | +1 | 11/20 |
| B4 | Statutory duty of candour — who does it bind? | 0/2 | 1/2 | +1 | 11/20 |
| C2 | What laws govern e-scooters? | 1/3 | **3/3** | +2 | 9/20 |
| C3 | The statutory framework for adult social care | 0/3 | **2/3** | +2 | 9/20 |
| C5 | What protections do people in park homes have? | 2/3 | 3/3 | +1 | 6/20 |
| B6 | I want to revoke MiFID II | 1/6 | 2/6 | +1 | 2/20 |
| — | *(A1, A3, A5, B1, B3, B5, C1, C4 unchanged)* | | | 0 | 6–11/20 |

**No query got worse.** Eight of sixteen improved; two went from zero to answered. Top-20 overlap
runs 2/20 to 11/20, so the flag changes most of the result set — consistent with S3's "~20 of 48
results change", now with a direction attached.

### Recommendation, separated from the verdict

> **Turn `LEX_TIER_FUSION` on — and check `LEX_QUERY_ROUTER` is on first, or it will do nothing.**
>
> +21.7pp recall@20, no query regressed, and the latency cost is inside this harness's own cache
> noise. §2's "if quality holds and only latency moves, that is a trade for Charlie" does not
> arise: quality moved and latency did not, measurably.
>
> ▶ **Charlie's, because it is a production flag on a SAML-blocked dashboard** — and because the
> honest caveat is that the recall gain is measured against the gold answer key, which remains the
> binding constraint on all of these numbers.

---

## §3 — NOT STARTED

**Batching per-stream vector calls** and **the `PRECEDENT` / `DEVOLUTION_SCOPE` intents** are
carried forward unstarted, as they were from S3.

⚠ §3 says batching "stops being an optimisation and becomes a prerequisite" if §1 widens the Lex
chat route to all five streams. §1 did **not** widen it — §1 forbade widening before reporting, and
the audit above is the report. **The dependency is live the moment that widening is authorised**:
five streams per query against `vector-serve`'s concurrency cap of 4 means one user saturates it.

---

## FOR CHARLIE — THE THREE DECISIONS

1. **The Lex chat route's scope.** It is legislation-only and should not be. The fix is a second
   context channel with its own rendering, not a constant — because of the two-gates-in-series
   finding and because the response contract has nowhere to put a committee document. Sizeable, and
   it needs authorising before it is built.
2. **`LEX_TIER_FUSION` → on**, after confirming `LEX_QUERY_ROUTER` is on in Vercel. Both are
   unreadable from here.
3. **What `POST /api/search` is for.** Today it is a legislation search endpoint with a general
   name and no first-party caller. Widening it or renaming it are both defensible; leaving it
   ambiguous is what produced this audit item.
