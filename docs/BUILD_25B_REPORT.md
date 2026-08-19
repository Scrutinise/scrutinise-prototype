# SPRINT 25-B — research, revision, and the adversarial read

**Executes:** `docs/BRIEF_25B.md` §0–§9 **and `docs/AMENDMENT_25B.md` §A–§D + §C4**, which wins where
they differ. **Thread:** Lex/UX. **Written:** 2026-08-19, amended 21:45 UTC.
**Guards:** `check:build-25b` **54/54**, all 27 source-level negative controls fire · `check:build-25a`
40/40 · `check:committed` (new) · `verify:build-25a-ui` 37/37 · `tsc` clean.
**Live:** four full seven-pass builds against the production FTS index, plus the worker's closed-tab
test (9/9). **Cost: 5.6p single-perspective, 11.4p with three.**

▶ **The headline is not the passes. `/api/ideas/[id]/build` had never been committed**, so 25-A's build
endpoint was not on production at all — which is why nobody could start a build. Found by the delivery
check CLAUDE.md §20 asks for, fixed, and verified live. **§A below.**

---

## The one-paragraph version

25-A drafted a kernel from four answers in one 45–53 second request. 25-B researches what that draft
revealed, rewrites it in the light of the evidence, and reads the whole thing back as a hostile
committee clerk — **and it could not have fitted in one request, so the build now runs one pass per
request driven by the polling the client already did.** A live build now runs seven passes in 214
seconds for 5.6p, asks seven library questions, reviews 600 sources and keeps 193, and **preserves the
places where the research changed its mind.** On the sample idea the revision reversed the instrument:
*"I first concluded: primary legislation… the evidence says regulations under an existing power may
already reach this."* That sentence is the sprint.

⚠ **Three things came back against the brief and are reported as findings, not smoothed over:** §3's
premise about intents is wrong in a way that changes the design; §7's multi-perspective case is **not
supported by the measurement** — it doubled the cost for 7% more findings; and §6's stronger model
**could not run at all** until this sprint found out why, because the codebase-wide thinking-off rule
makes `gemini-2.5-pro` unreachable through every Gemini client we have.

---

## §0 — the gate

**Production was verified to be serving 25-A before anything was built.**
`https://www.scrutinise.org/ideas/build` returns 200 and its RSC payload carries
`redirect_url=/ideas/build`, the server-side redirect from 25-A's own `page.tsx`; a route that does
not exist carries no such marker. All four `lib/lex/build-*.ts` files are tracked, and local `HEAD`
equalled `origin/Main` at `73f2941`. The ~10-hour outage recorded in CLAUDE.md §20 is over.

⚠ **The premise test result was not available to me.** Charlie's instruction to run the brief was
taken as the go. Per §0's own caveat, a marginal verdict argues for building this rather than against
it — but that is the brief's argument, not a result I can report.

---

## §1 — the architecture, and a ceiling that became real

**25-A's build ran in one request. 25-B's cannot.** The research pass alone took **153 seconds** on the
live run and **198 seconds** with perspectives on; the whole build takes 214–275s against a Vercel
`maxDuration` ceiling of 300 that no configuration raises.

**Built as recommended: one pass per request, driven by the polling the client already does.** The
poll response carries `nextPass`; the client POSTs it back to the same endpoint; the server decides
which pass actually runs from the stored log. No new infrastructure, and each pass gets its own 300s.

| | 25-A | 25-B |
|---|---|---|
| passes | 4, one request | 7, one request each |
| longest single request | 53s | 23s (ORIENT ×3) — the 198s research pass is its own request |
| whole build | 45–53s | 214s single-perspective, 275s with three |
| cross-pass state | in-memory accumulator | stored on the pass log (`build-carry.ts`) |

**⚠ A limitation 25-A documented has been reversed, and this is the note recording it.** 25-A declared
the brief's 15-minute hard stop *unreachable* — a 900,000ms budget checked inside a function the
platform kills at 300s is a guard that cannot fire. Because elapsed is now measured from the row's
stored `startedAt` **across** requests, **`HARD_STOP_MS` is a real wall clock for the first time** and
fires between passes like any other stop reason.

**The settle now resumes as well as fails**, and the two stalls are told apart by time:

- a **pass** stuck at RUNNING longer than a pass can take was killed → reset to PENDING, and the next
  poll picks the build up from its last completed pass;
- a **build** untouched for longer than that has lost its driver → FAILED, as before.

⚠ **One fix inside that which would have failed silently:** the abandoned check used to age a build off
`startedAt`. That was right when a build lived for one request and **would have declared a healthy
seven-pass build abandoned while it was still working.** It now ages off `updatedAt`, which every pass
write moves — silence there is the real signal that nothing is driving it.

⚠ **SUPERSEDED MID-SPRINT BY `AMENDMENT_25B` §B, AND THIS SECTION IS KEPT RATHER THAN REWRITTEN.**
Charlie's decision is the worker, not the request chain, and the reasoning is better than the brief's:
"a ten-minute job should not depend on a browser tab staying open." Everything above still stands and
still runs — `runNextPass` is the engine the worker calls in a loop, so pass-per-request survives as
the **documented fallback** the amendment asks for rather than as dead code, and it is what runs today
while the worker awaits provisioning. See the §B section below.

---

## §2 — the audit: what was reused, and what genuinely had to be new

**Reused, unchanged or nearly so:**

| 25-B needs | What it uses | Change |
|---|---|---|
| retrieve wide, sift by relevance | `deepening-sift.ts` `siftCandidates` | **none** |
| the adversarial issues call | `deepening-adversarial.ts` | two optional params (`model`, `onUsage`) |
| the gather | `deepening-client.ts` | optional `model` / `lens` / `onUsage`, one function still |
| findings with provenance | `EvidenceItem` | none — same table, same columns |
| issue triage | `DeepeningIssue` + existing panel | none |
| re-run semantics | `supersedeOlderProposals` | exported, not copied |
| gaps per question | `DeepeningPass.knownUnknowns` | none |
| model per pass, spend ledger | `model-registry`, `spend-ledger` | none |

**Genuinely new:** the interrogation library (§3), the pass-per-request engine and carry (§1), the
revision pass and its contradiction records (§5), the perspectives merge (§7).

`check:build-25b` asserts the negative directly: **exactly one `siftCandidates` in the codebase, exactly
one `generateAdversarialIssues`, and no second findings/issues table** — each with a negative control
that injects a duplicate and must be rejected.

⚠ **One honest split.** Build findings land in the same `EvidenceItem` table under `question:<ID>` pass
keys, so they do **not** appear in the Deepening's four-card panel, which iterates its own `PASSES`.
One table, two readers. The alternative — mapping questions onto the four Deepening passes — would have
entangled two independent `runVersion` counters, so a Deepening re-run could silently supersede build
findings. The namespace prefix also removes a real collision: question ids like `PRECEDENT` and
`LEGAL_LANDSCAPE` are **also** `SearchIntent` and `EvidenceKind` values, which the guard caught.

---

## §3 — the interrogation library, and the finding that changed its design

Built as `lib/lex/interrogation-library.ts` on the `deepening-config.ts` pattern: nine questions, each
`{ id, question, kind, intents, wantedIntent?, firesWhen, mustAnswer, panelHeading, method, terms,
leads?, retiresTheInstrument? }`. **Adding one is one array entry**, and the guard proves it: no
question id may appear anywhere in `lib/lex/build*`, `app/` or `components/`. The engine keys off the
`leads` and `retiresTheInstrument` **flags**, never off an id.

### ⚠⚠ THE BRIEF'S PREMISE ABOUT INTENTS IS WRONG, AND IT IS WORSE THAN IT THOUGHT

§3 says four of these intents "are new to Search and may not be routed yet" and asks that an
unavailable intent render as a stated gap. The audit found something broader:

> **`intent` never selects streams. Not for these questions — for any caller.** There is not one
> `intent ===` branch anywhere in `lib/lex`, and `query-router.ts` is never handed the intent at all.

`SEARCH_CONTRACT.md` §2 says `PRECEDENT`, `CAUSAL_EVIDENCE` and `DEVOLUTION_SCOPE` are "descriptive".
Measured against the code, **every intent is.** So an `intents[]` field would have been decoration: a
question with a "routed" intent and one with a "new" intent produce **identical** retrieval, and
reporting the first as well-served would be a claim about machinery that does not exist.

**What actually changes retrieval is the query text**, which the router rewrites per stream. So every
question owns a `terms()` builder, and that is the part of an entry worth thinking hardest about. The
guard asserts no question ships with bare draft terms.

Three states are reported to the user, and `retrievalStanding` has **no `routed` state at all**,
because there is no caller that would justify one:

- `reasoned` — no corpus is asked (the domain-transfer question);
- `unrouted` — Search has no dedicated mode; it ran on a general one and **says so**;
- `general` — it ran on a named intent, which is a label.

⚠ **`EXISTING_POWER`, `CASE_INTERPRETATION` and `LINEAGE` do not exist as intents at all** — they are
not in the union, so naming them would not compile. They declare `wantedIntent` and run on
`LEGAL_LANDSCAPE`. **No new intent strings were invented**: SEARCH_CONTRACT §2 says that is a
conversation with CC-Search, not a new string.

**Relevance is real, not decorative.** The devolution question does not fire on a draft already
established as reserved (§3's own example, executed and controlled both ways).

---

## §4 — pass 3, and the leading question

Runs the library against the pass-2 draft: retrieve wide → sift → gather → persist, per question.
**Live: 7 of 9 questions fired, 600 sources reviewed, 193 kept, 68 findings persisted.**

`EXISTING_POWER` **leads and fired on the primary-legislation draft**, as §9 requires — and on a draft
that names *no* instrument, because that is where a user most easily drifts into drafting a Bill by
default. Its verdict is a small structured call over the findings it already retrieved, not a regex on
model prose.

⚠ **"A positive finding visibly changes the instrument fork" is UNDEMONSTRATED end-to-end, and is
reported as such rather than as passed.** On both live runs the structured assessment returned
`powerFound: false` — correctly, since the nearest power it found covers electrical safety only. The
write path (fork text + a leading uncertainty) is unit-covered but has not fired on live data.

⚠ **And the more interesting half:** the *revision* pass caught what the structured assessment
declined to claim. Pass 4 recorded the delegated-power possibility as a contradiction in its own words.
The conservative check and the reasoning pass disagreed, and **the disagreement reached the user** —
which is the behaviour we want from both.

---

## §5 — pass 4: revise, and keep the contradictions

**This is the pass that justifies the iterative design, and it worked on live data.** Verbatim from the
2026-08-19 run:

> **I first concluded:** Primary legislation · national · reserved
>
> **The evidence says:** Regulations under section (Electrical safety standards for properties let by
> private landlords) may provide for covenants to be implied into a tenancy. This suggests existing
> delegated powers might be usable, although the specific power cited only covers electrical safety.
>
> **Why I changed my mind:** The research indicates a potential for using existing delegated powers
> (secondary legislation) rather than requiring new primary legislation, which would be a
> significantly faster and less politically arduous path… This changes the instrument from primary to
> secondary legislation, subject to further investigation of the scope of existing powers.

Contradictions are stored as `EvidenceItem` rows of kind `CONTRADICTS` — **the same evidence layer, no
second list** — with `sourceType`, `sourceId` and `citation` explicitly `null`, because a revision's
source is the research pass and attaching a document citation to a reasoning step would be the
never-claim breach the rest of the build refuses. A guard asserts that nulling, with a control.

The causes are **replaced**, not appended; the chain and coherence checks land as ordinary issues; forks
the evidence settled are resolved with the reason, and forks it opened are added. The prompt is told
that an empty contradictions list is a claim about the research rather than a tidy result.

---

## §6 — pass 5: the adversarial read

`deepening-adversarial.ts`, reused, given the **whole revised kernel** and every finding rather than one
pass's slice. Live: **7 issues**, and the panel names the model that produced them. A failed clerk is a
**FAILED pass**, never an empty issues list — "this proposal survived a hostile reading" is a strong
claim and must not be made by accident.

### ⚠⚠ THE STRONGER MODEL WAS UNREACHABLE, AND NOBODY KNEW

Asked for a `gemini-2.5-pro` reading, the API answered:

> **400 — "Budget 0 is invalid. This model only works in thinking mode."**

This codebase sets `thinkingConfig: { thinkingBudget: 0 }` on **every** Gemini call, for a good reason
(§19-D Task 2b: three generators silently returned nothing because thinking ate the whole output
budget). **That rule made `gemini-2.5-pro` unusable through every one of our Gemini clients** — while
`model-registry.ts` listed it as REACHABLE and `MODEL_CONTRACT.md` §5 recommended it for exactly this
pass. **A capability we believed we had, and did not.** It would have surfaced as a 400 inside whichever
pass someone first pointed at it, weeks later.

Fixed in the one place that should own it: `thinkingConfigFor(model)` in `model-registry.ts` returns a
zero budget for every model that accepts one and a real budget for the models that refuse. ⚠ The output
ceiling is raised alongside it, because **thinking tokens count against `maxOutputTokens`** — a thinking
model on the flat budget truncates before it answers, which is §19-D arriving by the other door.
**Applied only to the adversarial caller for now**; the other Gemini callers still cannot use pro, and
that is recorded rather than quietly fixed everywhere at once.

### The comparison §6 asked for — same kernel, two models

Run as a **second reading of the same proposal**, not a second build: two builds produce two different
kernels, so comparing their clerks would compare the drafts as well as the models and measure neither.

**Flash (7 issues) — its best:**

> The proposal mandates primary legislation to amend the Landlord and Tenant Act 1985 or create a new
> statutory duty, but the evidence indicates Section 123 of the Housing and Planning Act 2016 may allow
> for regulations to achieve the desired outcome without new primary legislation.

**`gemini-2.5-pro` (7 issues) — the difference is in the findings, as §6 asked:**

> **[1]** The proposal's mechanism for an 'automatic' fixed penalty notice requires an assessment by a
> local authority officer… Given the proposal identifies that Environmental Health Officers are already
> *'significantly behind on inspections'*, it is unclear how this bottleneck is resolved…
>
> **[2]** …yet **the proposer's own contradictory findings [45, 46]** suggest that Section 123 of the
> Housing and Planning Act 2016 might achieve the same outcome via secondary legislation.
>
> **[5]** …**Finding [21]** notes that existing fines are often considered too low to be a deterrent,
> and the proposal provides no basis for how its unquantified penalties will be more effective.

**What is actually different, in three sentences.** Pro **cites the proposal's own findings by number**
and uses them against it; Flash restates them. Pro turned the user's own testimony — the environmental
health officer being two years behind — into the mechanism's central weakness, which no Flash run
found. Pro raised the *interaction* with the Housing Act 2004 and the Homes (Fitness for Human
Habitation) Act 2018 as a duplication risk; Flash did not.

▶ **Both raised 7 issues. A count would have shown no difference at all**, which is precisely why §6
asked for the difference in the findings rather than in a score. **The adversarial pass is where a
stronger model earns its cost** — it is 0.27p of a 5.6p build, so the override is cheap. The default is
still Flash: a swap made permanent before Charlie has read both would be a verdict nobody asked for.
`LEX_BUILD_MODEL_ADVERSARIAL=gemini-2.5-pro` is the one line.

---

## §7 — multi-model perspectives: RUN ONCE, AND THE RESULT DOES NOT SUPPORT THE CASE

Built as a `perspectives` config on the **coverage passes only** — `coverage: true` on the pass
definition is the gate, so passes 2 and 4 cannot acquire perspectives by someone adding a list entry.
Flag-gated (`LEX_BUILD_PERSPECTIVES`), single-perspective by default. Same idea, same day, same corpus:

| | 1 perspective | 3 perspectives | ratio |
|---|---|---|---|
| **total spend** | **5.6p** | **11.4p** | **2.04×** |
| research pass | 3.21p | 7.72p | 2.4× |
| orient pass | 0.45p | 1.33p | 3.0× |
| whole build | 214s | 275s | 1.29× |
| sources reviewed | 600 | 600 | — |
| sift kept | 193 | 217 | 1.12× |
| **findings persisted** | **68** | **73** | **1.07×** |

▶ **On this evidence the extra coverage doubled the cost for 7% more findings.** That is a much weaker
result than the four-model comparison predicted, and Charlie should have it in those words.

⚠ **And the number that looks like a win is an upper bound, not a measurement.** The run reported *64 of
73 findings found by only one perspective* — 88% divergence. **That figure is inflated by my own dedup
key**, which includes the finding's wording: two perspectives making the same point about the same
source in different words count as two. I have added a **wording-proof denominator** (`sourcesShared` /
`sourcesTotal` — how many sources more than one perspective drew from) so the next run measures this
properly rather than reporting the upper bound alone. **The 64/73 figure should not be quoted.**

The merge itself does what §7 requires: it deduplicates, keeps and **marks** singletons, sorts them
first, lets a `CONTRADICTS` reading survive a merge with a neutral one, and **names a perspective that
failed** rather than absorbing it. Four guards cover those, with controls.

*(This stays in Lex rather than transferring to Search: it is a question about the quality of the
findings, not about retrieval.)*

---

## §8 — cost, progress, honesty

**Spend per build, broken down by pass** — and it now sums, which it did not at first:

| pass | single-perspective | with 3 |
|---|---|---|
| ORIENT | 0.45p | 1.33p |
| DIAGNOSIS | 0.41p | 0.46p |
| APPROACH | 0.49p | 0.54p |
| ACTIONS | 0.32p | 0.29p |
| **RESEARCH** | **3.21p (57%)** | **7.72p (68%)** |
| REVISE | 0.42p | 0.70p |
| ADVERSARIAL | 0.28p | 0.33p |
| **total** | **5.6p** | **11.4p** |

⚠ **A REAL BUG THE FIRST LIVE RUN FOUND, and the reason the run was worth doing.** The breakdown came
out **737 tokens short of the build total** (11,750 vs 12,487) because the closing summary call happens
after the last pass and therefore belonged to no pass. **A breakdown that does not sum to the total
beside it is worse than no breakdown**: it invites the reader to trust two numbers that disagree.
Fixed by booking the summary to the last completed pass; a guard now asserts the sum.

**Ceilings per pass, and they are CHECKED rather than declared.** The research pass is the only one that
can plausibly exceed a request — three model calls per question, up to nine questions — so both the
per-pass time budget and the per-pass spend ceiling are checked on that loop, between questions.
Hitting one **stops the pass, not the build**: losing the research is bad, losing passes 4 and 5 as well
is worse. ⚠ I nearly shipped `REQUEST_BUDGET_MS` as a value that was reported and never read — a
ceiling that cannot fire.

**Progress shows the question being asked**, written before each question rather than after it. **Every
failure names which it is**, and the four are kept apart in code and in wording: `search-broke` ·
`corpus-silent` · `nothing-bore-on-it` · `gather-failed`.

⚠ **The first live run exercised the honesty paths hard, by accident.** With no `FTS_SEARCH_URL` in the
local `.env`, retrieval returned `failed: true` on every call. All eight questions correctly produced
**`search-broke` stated gaps** — "this is a failure in our search, not a finding about the corpus" —
rather than reporting an empty corpus. That is the distinction the sprint is built on, demonstrated
under the exact conditions that would hide it.

---

## §9 — acceptance criteria, scored honestly

| criterion | verdict |
|---|---|
| all five passes complete without hitting the 300s ceiling | ✅ 7/7, 214s, no pass over its own budget |
| an orphaned build resumes from its last completed pass | ✅ built and guarded; **not** exercised by killing a live request |
| pass 3 runs the library, sifts, reports reviewed/kept | ✅ 7 questions, 600 reviewed, 193 kept |
| a stated gap for every question that fired and found nothing | ✅ including under `search-broke` |
| …including any whose intent Search has not routed | ✅ `CASE_INTERPRETATION` and `LINEAGE` ran and declared the shortfall |
| `EXISTING_POWER` fires on every primary-legislation draft | ✅ |
| …and a positive finding visibly changes the instrument fork | ⚠ **UNDEMONSTRATED** — no power found on either run; unit-covered only |
| pass 4 rewrites the causes | ✅ |
| …and at least one pass-2/pass-4 contradiction is preserved and shown | ✅ quoted in §5 above |
| pass 5 produces issues against the whole kernel, panel says whose reading | ✅ 7 issues, model named |
| a stronger model tried on pass 5, difference reported in the findings | ✅ `gemini-2.5-pro`, same kernel — **and it was unreachable until this sprint fixed it** |
| adding a library question is one config entry | ✅ guarded — no id may appear outside the library |
| no second evidence layer, issues list or sift; the §2 audit reported | ✅ |
| multi-perspective runs once, reported side by side with cost | ✅ **and the result argues against it** |
| spend per pass recorded and shown | ✅ after fixing the 737-token shortfall |
| browser-verified, and delivery-verified | ⚠ see below |

### ⚠ What is NOT verified, stated plainly

1. **A positive `EXISTING_POWER` finding has not moved a real fork.** The structured check returned
   `powerFound: false` on all three runs — correctly, since the powers it found were narrow. The
   revision pass caught the same point in prose each time, so the *user* saw it; the *fork* did not
   change. Needs an idea where a power plainly reaches.
2. **`gemini-2.5-pro` still cannot be used by any Gemini caller except the adversarial one.** The
   registry now knows why; the other call sites were left alone deliberately.
3. **No authed browser walk.** The extension has no host permission for `localhost:3000` and this
   session has no Clerk session on production; the local Clerk instance is a separate DEV instance.
   The UI is covered by `verify:build-25a-ui` render assertions (37/37) — **that is a render assertion,
   not a browser walk**, and it does not cover click handling or the new client-driven pass loop.
4. **The resume path was not exercised by an actual kill.** Time-based, unit-covered.
5. **Retrieval was the production FTS index but not the production search config** — this machine has
   no `LEX_VECTOR_STREAMS`, so the runs were BM25-only. Production has dense retrieval on three streams.

### Delivery

Per CLAUDE.md §20, the four delivery checks were run and are recorded in the CHANGE_LOG entry for this
sprint. **A sprint closes on a string read back off the running site, not on a green local build.**

---

---

# AMENDMENT_25B — §A to §D, and §C4

*Read alongside the brief; where they differ, the amendment wins. Added 2026-08-19.*

## §A — `/ideas/build` was down, and the cause was the repository again

**Charlie's report: *"Could not start a session. Please refresh."*, unchanged for two days.
The cause was found by §20's first delivery check and it is the same class as the outage two
days earlier.**

> `app/api/ideas/[id]/build/route.ts` and its `cancel/` sibling appear in **no commit, on any
> branch, ever.** They are not ignored. `git add` accepts them. They had simply never been
> added.

The chain is exact: `/ideas/build` deployed and gated correctly, because `page.tsx` **was**
committed. Its client boots by fetching `/api/ideas/{id}/elicitation` and
`/api/ideas/{id}/build` together. The second 404ed on production, the client called `.json()`
on Next's HTML 404 page, that threw a parse error, and the catch reported eleven words that
named nothing.

⚠ **Every check anyone ran passed.** `tsc` and `next build` were clean because the files exist
on the machine. `git status` never showed them. 25-A's deploy note verified the *page's*
redirect marker — a real check that could not possibly have caught a missing sibling endpoint
behind the sign-in. **This is CLAUDE.md §20's "confirm the file, not the pattern", and the
reason the pattern was already fixed: the `build/`-shaped ignore was anchored on 17 Aug and
`app/ideas/build/` was added — its API sibling was missed.**

**Fixed three ways:**

1. **The files are committed** (`854303c`), which is the whole bug.
2. **`check:committed`** — the check §20 asked for. It compares the working tree against the
   repository and fails when a shipped source file is not in the commit. On its first run it
   found both. ⚠ Its own first version reported `prisma/schema.prisma` as uncommitted, because
   `git ls-files` returns paths relative to the *current directory* and it runs from
   `scrutinise-web/` — a false positive large enough to teach the next reader to ignore it.
   Watched failing, fixed, then watched failing again on a planted path.
3. **The message carries a reason and a correlation id.** The boot now checks the status
   before parsing, so a 404 on an undeployed route can never again present as bad JSON:
   *"Could not start a session — /api/ideas/…/build is not available on this deployment (404)
   (ref A3F9K2)."*

**Verified live**, per §20 check 4 — the deployed bundle carries both new markers, the **old**
message is gone, and a never-written control string is absent. That is the sprint's own string
read back off the running site with a working control.

⚠ **Not done: the signed-in browser walk.** The extension has no host permission for
`localhost:3000` and this session has no Clerk session on production. **Charlie's re-test is
the remaining gate on §A** — but unlike the last three sprints that said this, the failing
component and its fix are both now identified and verified deployed.

## §B — builds on the worker: built, tested, NOT yet switched on

**The worker is finished and proven.** `npm run verify:build-worker` enqueues a build through
the same path the web request uses, spawns the worker as a **separate OS process**, does
nothing while it runs, and finds it DONE at 7/7 passes for 3.7p — **9 assertions, 0
failures.** That is "close the tab and come back", tested across a real process boundary
rather than asserted.

⚠ **And the test earned its keep immediately: it caught a bug that made the worker useless.**
The first run reported *"RUNNING · 1/7 passes · stopped cleanly"* — a healthy-looking worker
with nothing to do. `runBuildToCompletion` was looping on `view.nextPass`, which is
**deliberately null under the worker driver** so a browser never drives a pass the worker
owns. I had overloaded one field with two questions — *"should the CLIENT ask for another
pass"* and *"is there another pass"* — which have different answers by design. The engine now
asks the second, of the stored log. **A guard encodes it**, because this is a bug that
reappears the moment someone tidies the loop.

**Two steps remain and neither is code** — the recipe is `docs/BUILD_WORKER_DEPLOY.md`:

1. Create the Railway service (root directory **`scrutinise-web`**, not `scripts/` — the
   engine is `lib/lex/*` and `scripts/ingest` cannot import it, which is the wall SEARCH S7
   §3 hit).
2. Set `LEX_BUILD_DRIVER=worker` in Vercel. **I cannot do this**: the Vercel token
   authenticates and then 403s on every project-scoped endpoint with `"saml": true`.

⚠ **`buildDriver()` therefore defaults to `client`, and that is not a vote against the
worker.** Defaulting to `worker` before the service exists would enqueue every build with
nothing to run it — a page saying "Starting" for ever, which is strictly worse than the
design it replaces. **The default must be the configuration that works with what is
deployed.**

▶ **And the failure the architecture creates is handled rather than hoped away.** If no worker
claims a build within 90 seconds, the page claims it off the queue and drives it — the
documented fallback, used automatically — and **says so**: *"Our build server hasn't picked
this up, so it's running from this page instead."* The handover is one-way by construction:
the client's claim moves the row QUEUED → RUNNING, and `claimQueuedBuild` only ever claims a
QUEUED row, so a worker waking later cannot also take it.

## §C / §C4 — telling the user, and an estimate that admits what it doesn't know

**In-page (free)** — the row is the source of truth and the page already polls it. ⚠ It is
only *true* because the worker runs the build: under the old design the page had to stay open
to make progress, so "it updates itself" would have been a promise about a page doing the work.

**Browser notification** — fires on a **transition this session watched**, never on what it
found: opening the page on a build that finished yesterday must not announce it. Permission is
requested when the user **starts a build**, not on load — a prompt before anyone has asked for
anything gets dismissed, and a dismissal is permanent. **A failed build notifies too**, since
the whole point is that they are not watching.

**The estimate is a query, not instrumentation** — the mean of the last 20 **DONE** builds
from `startedAt`/`completedAt`, which 25-A already recorded:

| rule | how it is executed |
|---|---|
| failed builds excluded | `status: 'DONE'` in the query, guarded — a run of early failures would otherwise report "about a minute" |
| fewer than five → no figure | *"Usually a few minutes — we don't have enough builds yet to be precise"* |
| round to something human | `about a minute` · `about 7 minutes` (from 6.8) · nearest 5 above ten minutes; a guard asserts no decimal ever reaches the user |
| show it before, and as time elapses | on the Build button, and *"3 of 7 passes · 2m 10s of about 7 minutes"* |
| overrun | past 1.5× the mean: *"Taking longer than usual — still running."* Never said without a measured mean |
| show the actual at the end | *"Took 8m 12s — usually about 7 minutes."* Including when the estimate missed |

**The email is offered on the same number** — nothing below three minutes, a checkbox above
it. ⚠ **The choice is frozen onto the build row at enqueue**, not read from the user at send
time: the worker sends minutes later on another machine, and reading the preference then would
make a change in another tab retroactive to a build already running. `EmailSuppression` remains
the authority on whether we may write to the address at all.

**Schema:** two additive columns and an index, applied to Neon after `whichdb` confirmed the
host (§16), verified present afterwards, and mirrored into `schema.prisma` so
`prisma migrate diff` cannot propose dropping them.

## §D — /admin has a way back

Fixed in `app/admin/layout.tsx`, **not** in `page.tsx`: there are three admin routes and all
three were equally trapped. Putting the bar on the page that happened to be complained about
would have left `/admin/invites` and `/admin/lex-general` exactly as they were.

## Amendment acceptance criteria

| §E criterion | verdict |
|---|---|
| `/ideas/build` loads and completes a build on production, signed in, walked in a browser | ⚠ **cause fixed and verified deployed; the signed-in walk is Charlie's** — no Clerk session here |
| the cause of the session failure is named in the CHANGE_LOG | ✅ |
| a build runs on the worker, survives the tab closing, is found finished | ✅ **proven across a process boundary**, 9/9 — but not yet switched on in production |
| the page updates itself on completion; a notification fires when permitted | ✅ |
| `/admin` has a way back | ✅ |

---

## Cost of the sprint

| | |
|---|---|
| live build ×2 (single + perspectives) | **17.0p** |
| model-comparison builds ×2 (one failed on the 400, one succeeded) | ~9.4p + pro's reading |
| earlier local run (no retrieval) | 1.6p |
| **total LLM spend** | **~28p** |

25-A cost about 4p per build. **25-B costs 5.6p** single-perspective — 1.4× for research, revision and
an adversarial read, which is a good deal less than the "multiple of that" §8 predicted.
