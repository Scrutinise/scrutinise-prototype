# LEX 26-O + the 26-P addendum + CCh's follow-ups — report

*4 October 2026. Everything below was run, not read; where something was not run it says so. Spend this session: **≈ £3.26** on the ledger
(builds £2.15 including two abandoned runs, panel/judge probes 53p, the three processes' real runs and checks 43p, agent turns 15p).*

**State: committed locally, NOT pushed beyond the two schema commits. Reason in §F5.** `check:lex-26o` 99/99, 12 controls fired, 0 dead; `tsc` 0;
`check:client-boundary` ✓; `check:llm-guards` 9/9; `check:lex-26p` 91/91 (Part B not run); `check-clean-build.sh --fast` ✓.
**All 99 `check:*` suites were run** (§F1).

---

## BRIEF_26O

| § | Done | Notes |
|---|---|---|
| 1a/1b | "Guiding Policy" / "Summary of Guiding Policy" in the field config (so the screen, Lex's snapshot and every document that prints a label), `GuidingPolicyScreen`, the build progress, the public proposal page, Meeting Pack, Committee Evidence, One-page summary, Lex's prompts | the field **key** stays `chosenApproach` (never shown) |
| 1c | the build summary's "The guiding policy" now prints the **statement**; the summary has its own row, "Summary of Guiding Policy" | |
| 1d | **Current labels were** "Diagnosis summary", "Guiding-policy summary", "Coherent-actions summary". Now "Summary of Diagnosis", "Summary of Guiding Policy", "Summary of Coherent Actions" — Charlie did not object, so done | also the idea page's Overview |
| 2a | `kernelText` (`lib/lex/build.ts`): **THE GUIDING POLICY = the statement**; the summary rides as `SUMMARY OF THE GUIDING POLICY (context only — test actions against THE GUIDING POLICY above, not this)`. "THE APPROACH" is gone | read cold off Charlie's idea by `check:lex-26o` |
| 2b | **No verdict changed.** Kernel check + logic check on 452c5ade, BEFORE ×2 / AFTER ×2: 7 of 9 tests identical in all four runs; 2 (`OBSTACLE_DISTINCT`, `NO_BAD_STRATEGY_SMELL`) are **unstable — the model disagrees with itself on the same input**; the chain does not hold either way (3–5 vs 4–5 defects). 21.6p. `scripts/measure-26o-kernel-check.ts` | the instability is itself a finding about these two tests |
| 3 | One answer on the idea page: `guidingPolicyStatement()` — the CHOSEN row, else `Idea.chosenApproach`, else (legacy ideas only) `Idea.guidingPolicy`. Overview "Approach (summary)" → **Guiding Policy** + **Summary of Guiding Policy**; the Stage-2 gate (client and `stage-gates.ts`) uses it. **The 29 legacy showcase ideas keep their legacy read** — a Lex-built idea never falls back to it | not browser-verified |
| 3a | already done in 26-N (verified by `check-lex-26n`) | |
| 3b | "Alternatives ruled out" (Evidence Pack) and "What it rules out" (Proposal) list a settled policy's other candidates **"not chosen"**, keeping any reason the user gave (`lib/documents/not-chosen.ts`) | |
| 4a | Panel: `claude-opus-5-5`, `gpt-6.1-sol`, `gemini-3.1-pro-preview`, `grok-4.7`; judge `claude-opus-5-5` | |
| 4b | **Structured output (`output_config.format`, json_schema), not `tool_choice: auto`** — for `claude-opus-5-5`, `claude-sonnet-5-5`, `claude-fable-5-1`. Why: `auto` lets the model answer in prose (Fable did in the 30 Sep probe), and a draft that is not JSON is a lost draft; constrained decoding cannot return a malformed object. Every other Claude model keeps the forced tool, unchanged (never probed). Verified live: all four drafts and the judge | |
| 4c | Length flag (`lib/lex/statement-length.ts`): > 2 sentences or > 60 words → "⚠ Flagged for review (wording check, not a verdict)". Computed from the statement, so old verdicts get it too. The draft prompt now says *ruthlessly brief* | the live panel run: Opus 5.5's draft was flagged (1 sentence, 61 words) |
| 4d | Gemini preview falls back to `gemini-2.5-pro` and the card says so (`GuidingPolicyDraft.servedBy`, **migration applied** and committed with the schema) | **not exercised live** — 3.1 Pro answered every time, so the fallback path ran only in a check |
| 4e | Record restarts: `PANEL_RECORD_STARTS = 2026-10-04`; `scripts/panel-choice-record.ts` counts only the new panel | |
| 4f | **Judge agreement on the new panel, identical input, run to run:** 16/16 verdicts identical over four runs on one draft set; 3/3 over two runs on another; **but 1 of 3 sets flipped 2 of 3 verdicts** (Gemini and Grok drafts `N`→`Y`). So **8 of 10 drafts stable**; the instability is real and was in the same direction as the old judge's. Judge ≈ 2.0–2.7p a run | `gpt-6.1-sol` and `gpt-6-astra` **reject `temperature`** (HTTP 400, measured) — added to the no-temperature list |
| 5a | `LlmSpend.tokensCached`, `.tokensCacheWrite` (**migration applied**, committed with the schema); each provider's shape normalised once (`cacheFromAnthropic` folds the reads/writes that Anthropic reports **outside** `input_tokens` back into `tokensIn`); priced uncached / cached / write separately (`priceTokens`) | the agent loop and every `record*Usage` pass them |
| 5b | Every rate is dated (`rateAt(model, day)`); **Gemini 3.6/3.7/3.8 Flash $0.75/$3.75 → $1.50/$7.50 on 1 Jan 2027**, asserted by a check | |
| 5c | **Cannot be recomputed from the ledger, and says so.** Rows before today carry no cached count. What can be said: last 7 days = **318.7p** (non-test). Only OpenAI rows were overstated (**7.1p total**) — xAI rows use the vendor's own billed cost, the agent's Anthropic rows were already cache-aware, Gemini caches nothing. So the correction is **≤ 6.4p (≤ 2%)** | recorded from today forward |
| 5d | Explicit caching saves most on **builds at the Jan-2027 Flash rate** (input 44% of spend; modelled −24%, ≈ −14p of 59p — MODEL_REVIEW §4). On the ledger today the agent is the one place a cache is already used (Anthropic, 247,684 cached input tokens recorded this afternoon). Gemini `cachedContents` is the unbuilt one | modelled, not built |
| 6 | §G below | |

## §G — does the newer Flash build better? (BRIEF_26O §6)

**Method.** Three real ideas — 452c5ade (Charlie's accountability idea), a6473880 (publicly funded charities), 5c7287d2 (Bank of England) — each copied
to a scratch idea (inputs kept, derived rows cleared), then built twice on this working tree with the worker's retrieval stack (read off Railway): once with
**every Gemini pass on `gemini-3.8-flash`** (the SMART panel's outside Claude member left in), once on the **current build models**. Six fresh builds, same day.
Three ran in parallel per arm, so times are comparable between arms and not with production. Scratch copies deleted; originals untouched.
`scripts/measure-26o-builds.ts`. (A first Flash run hit the 900 s hard stop at 8/12 passes under load and was discarded; the six reported ran with the stop raised to 45 min.)

| | Flash 3.8 | current models |
|---|---|---|
| status | 3 / 3 DONE | 3 / 3 DONE |
| cost at **today's** rates (row) | 24.1p · 18.1p · 17.9p (mean **20.0p**) | 32.2p · 28.8p · 36.2p (mean **32.4p**) |
| cost at **Jan-2027** rates | 42.0p · 32.0p · 31.9p (mean **35.3p**) | same: 32.4p |
| output tokens | 34.4k · 25.9k · 27.2k | 46.3k · 41.9k · 49.2k |
| time (3 in parallel) | 744 s · 799 s · 738 s | 822 s · 838 s · 937 s |
| kernel check (of 9) | 8 · 8 · 5 | 9 · 9 · 8 |
| after the repair pass | 8 · 8 · 4 | — (not captured) |
| findings | 25 · 26 · 22 (**73**) | 63 · 50 · 38 (**151**) |
| "citation accuracy"¹ | 51 / 73 = **70%** | 128 / 151 = **85%** |

¹ **Defined here as the share of findings carrying both a corpus `sourceId` and a citation** — traceable, not "true". Whether the cited passage says what the finding says
is a reading, and is yours. **Real token volume was the same order** (input 117–156k either way), so the Jan-2027 doubling lands at equal tokens: **+9% dearer than today's
build models, −38% cheaper at the introductory rate.** The case for moving is therefore quality, not price — and the numbers above lean the other way: **half the findings, a weaker
kernel-check pass rate, a Logic Check that said "the chain does NOT hold" on all three** (the current models were not asked that on a fresh build here, so I cannot say it is new).

**6b — the kernels, unlabelled:** `docs/REPORT_26O_FLASH_SIDE_BY_SIDE.md` (A and B per idea; which is which is hashed per idea, not always the cheaper one).
**Open the key — `docs/REPORT_26O_FLASH_KEY.md` — only afterwards.** The raw per-build JSON in `docs/report_26o_builds/` is named by arm; leave it unopened until you have read the kernels.
6c — all six scratch copies deleted; no `ZZ-` idea remains (re-read: 0).

## The 26-P addendum

* **§6a — RCA inside the Rumelt kernel.** `M_RCA` (`lib/lex/method.ts`) at the Diagnosis stage and in the agent's stable prefix: five whys, symptom-or-cause, the six coverage categories
  (people, process, incentives, information, resources, rules), contributing vs root, systems before blame — and the boundary, in words: *RCA finds and tests candidate causes; Rumelt chooses
  the pivotal obstacle; Lex never claims a proved single root cause.* **Grounded in Charlie's two filed RCA guides** (instituteprojectmanagement.com, qualitycoach.net — read from the database; both
  teach the five whys "as a guideline, not a rule", root-vs-contributing, and "blaming people instead of processes" as the commonest mistake; QualityCoach's categories are manufacturing's 6Ms, so the six
  here are adapted to policy). A **third** he tried to file (leansixsigmaexperts.com) was never filed — it is the 2-link-cap failure fixed in 26-M. The method block is in the cached prefix and cannot depend on
  the idea, so the per-idea grounding is in the **snapshot**: `ROOT-CAUSE-ANALYSIS SOURCES THE USER HAS FILED …` names them for Lex to read and cite (cold-read asserted on 452c5ade).
* **§6d — "How to find the right cause"**, a button at the top of Diagnosis, same style as the other two guides. It renders **the five checks from the registry** (below), so it cannot say something different.
* **§8c — Lex's actions, visible to the owner.** New table `LexToolCall` (**migration applied**, committed with the schema): one row per tool call — **time, the instruction it followed (the owner's own message), tool, input, result summary, ok / the real failure reason, tier, "made in a turn that had read a document", `confirmedVia: 'button'`** — and a **named actor** on every row (`Lex`). Written for every call in the loop **and** for every confirmed action (the owner pressing Confirm is recorded as the instruction). Shown to the owner only (`GET /api/ideas/[id]/lex-activity` → 403 for anyone else) in the **Privacy Log tab, now "Privacy Log & Lex activity"**, below the team-access log. Third-party text is never stored in the row. A write that fails says so on the server log and returns `false` rather than throwing. Value-tested: three rows written through the real recorder, read back through the real reader, scoped to the idea, cascade-deleted. **Not browser-verified.**

## CCh's second addition — the Diagnosis checklist, as a pattern

* **What shows:** while the causes exist and are not confirmed, the worklist ("What to do next") carries five tickable checks — Five whys · Symptom or cause · Coverage · Contributing or root · Systems before blame — each with the brief's question verbatim. Ticks are per user (`IdeaWorklistTick`, no schema change); a PATCH refuses any key the registry does not own.
* **"Ask Lex"** on each check: `POST /api/ideas/[id]/checklists/ask` runs a **read-only agent turn** — the model is not *offered* a tool that writes, a write tool named anyway is refused in the loop, and the instruction says so — and the reply goes through the same claim-vs-tool-result check as every other reply. It is **gated by `LEX_AGENT`** (it is the tool-calling Lex): off for an account, the button is disabled and says *"not switched on for your account yet"* — OFF is not made to look like FAILED. **Not run live** (no signed-in session; `cl@` would need the switch on).
* **"Confirm these causes"** stays enabled with every check unticked and says, beside it, **"N of 5 checks not yet done"** — a count and nothing else.
* **The same five** are in the FAQ (new entry under Stage 2 — the FAQ has no "The First Draft" heading, so it sits beside "What are the five stages") and in the guide — all rendered from `DIAGNOSIS_CHECKLIST`, asserted verbatim.
* ⚠ **It shows only once a build has produced something**: the worklist returns null before a build (`agenda.buildVersion`), so the checks do not appear on an idea that has causes but no build.

### What the other two checklists would take (CCh item 5)

**The pattern:** one entry in `SECTION_CHECKLISTS` — a heading, a `shownWhile` rule (field + terminal statuses + the kind of row that must exist), the checks (title, question, read-only `askLex`, guide text) — and the line beside the section's own confirm control. The worklist block, the tick route, the ask route, the guide/FAQ rendering and the check all read the registry; **nothing hard-codes Diagnosis** (asserted).

* **Guiding Policy** (rules something out · not a compound · answers the pivotal obstacle). **Small — about half a day.** Registry entry (`fieldKey: 'chosenApproach'`, `needsRows: 'policyOptions'`); one `notYetDoneLine` mounted where the policy is accepted in `GuidingPolicyScreen`. **Two of the three are already computed** — `testIsCompound` and `testRulesOutNothing` (mechanical) and the judge's `answersObstacle` (semantic) — so "Ask Lex" on this section should **reuse `judgeDrafts` on the user's own candidate (~2p)** instead of an agent turn, and the check can show the machine's flag beside the tick without ticking it for them. Cost of waiting: none; no migration.
* **Coherent Actions** (specific · coherent with the policy · coherent with each other · covers all three avenues). **Medium — about a day, one decision first.** Specificity ("who does what by when") and the two coherences are agent judgements of the same shape as Diagnosis's. **"Covers all three avenues" cannot be answered from the data**: `LexCoherentAction` has no avenue tag (legislative / organisational / financial) — `mechanismType` and `targetOrganisation` are not a reliable proxy. Either a column (a migration, and the build's actions pass told to fill it — CLAUDE.md §24), or Lex's judgement only, labelled as such. I recommend the column; it also lets the avenue-coverage line the gap check lacks be computed rather than asked.

## CCh's follow-up on 26-P

1. **The other suites against the old `/lex` route — run.** All 99 `check:*` ran. **33 exited non-zero** — `check:committed` (it is red by design while files are uncommitted), `check:scripts` (below) and 31 others. **Every one of the 31 was also red on the commit before 26-P** (`044b8aa`, run in a worktree; `surface-4` timed out there, so it has no baseline), **except two**: `check:lex-25z` — **a real 26-P regression**: 26-P added a `.filter` to `ChatPanel`'s `visibleMessages` and the assertion matched the old text; the behaviour is right (a view filter on empty bookkeeping rows), the assertion moved with its reason, now 50/50 — and `check:model-reachability`, which began probing the models I added and found **`gpt-6-astra` rejects `temperature`** (fixed) and a one-off TLS failure (below). The remaining 29 reds are the standing ones the handoff already lists plus data-state counts (`spend-attribution`, `lex-25s`, `lex-25x`, `central` 726/727) that drift with the database. `check:scripts` has 4 errors in other threads' files (`MyIdea.createdAt`); mine are clean, and I fixed 5 `.reason` type errors in `check-lex-26p.ts`.
2. **§8c — built** (above).
3. **A real Confirm on the actions behind the buttons — run, for three of four.** `scripts/verify-lex-26p-run.ts` runs on a scratch copy of 452c5ade: **gap check** (a real agent turn offered it, `handleConfirm` ran it: 12 suggestions written), **consolidation** (via the product's own route handler — 4 drafts, judged, status JUDGED), **comparison**, each with the tool log read back (offered → confirmed, `confirmedVia: button`). The one substitution: the route handlers call Clerk, which has no session in a script, so `scripts/lib/stub-auth.cjs` replaces **only** `getAuthenticatedUser()`. **Re-run of the build was run as a build, not through the Confirm button** — the in-process route would have run it locally with no search (`FTS_SEARCH_URL` unset); the three FULL builds in §G are its measurement. **A real browser press of Confirm is still untested.**
   *Found on the way:* on some runs Lex answers "Consolidate my candidates" with "the guiding policy is already settled" instead of offering the button — correct, but it means the token for a measurement has to be minted through `execute` (which is the same function the model's call goes through).
4. **Measured prices replace the estimates**, with provenance on the card (`measured, n=1 real run, 2026-10-04`): gap check **14p → 18.4p**, consolidation **11p → 9.0p**, comparison **2p → 1.5p**, re-run **30p+ → 32.4p** (mean of three FULL builds; a REUSE re-run is cheaper and unmeasured). Each is a **sample**, and the card says "n=1" in words; `runs[]` in `run-prices.ts` takes the next real run.
5. **Who owns the uncommitted reasoning-effort edits in `guiding-policy-consolidate.ts` and `model-call.ts`? I could not determine it, and I will not guess.** Facts: they were in the tree before I started; the last commit to either file is `bd055a2` (2 Oct 00:29); no stash, no `CHANGE_LOG` or handoff entry mentions them; the comments say "probed 2 Oct" and "pending the high-vs-medium draft comparison". **Evidence they belong to the LEX stream's 26-N session:** three already-committed callers (`gap-check.ts`, `action-ideas.ts`, `policy-fields.ts`) pass `reasoningEffort: 'medium'` to Anthropic, OpenAI and Gemini models whose committed client **ignores it** — the committed code does not do what it says. **I built on them** (the new structured-output path and the Gemini budget share their hunks), so they cannot now be dropped without breaking 26-O. Recommendation: **commit them with 26-O, named in the message** — but CLAUDE.md says a shared file's commit is agreed between the streams first, so **I have committed locally and not pushed**; say the word and it goes.

## What is NOT done / not verified

* **Nothing is verified live** (§20): not pushed, so no deploy, no string read back off the site.
* **No browser has looked at any of it**: the Diagnosis guide, the checklist, the Privacy Log & Lex activity tab, the new card wording, the panel cards.
* **`gemini-3.1-pro-preview` fallback** ran only in a check. **`LexToolCall` is empty in production** until someone uses the agent (the switch is off).
* `entity_list_v5.md` is CCh-only and **not updated**: `LexToolCall`, `LlmSpend.tokensCached/tokensCacheWrite`, `GuidingPolicyDraft.servedBy` (and, from 26-M, `ActionIdea`).
* **A TLS fault on this machine, not in the product:** calls to `api.anthropic.com` intermittently die with `SELF_SIGNED_CERT_IN_CHAIN` ("fetch failed") — in the sandbox, and less often outside it. It cost one Opus draft and one judge call during testing. I added **one retry on a transient transport failure to the judge** (a consolidation whose judge dies stays DRAFTING with every draft paid for) and made `callModelJson` name the cause (`err.cause`) in its failure line. Not reproduced from Vercel; not investigated further.
* The brief's "citation accuracy" is **traceability**, as defined above.
* `docs/` carries untracked files that are not mine (briefs, `Licences/`, a video, two `.docx`) and a modified `SPRINT.md` — **not touched, not committed**.

## Footnote — a mistake of mine, for the record

Removing a `git worktree` whose `node_modules` was a **junction** to the real one **emptied the real `node_modules`** (git followed the junction). Restored with `npm ci` — 421 packages, lockfile unchanged, `tsc` clean — but for several minutes the shared tree had no dependencies. Recorded in `docs/CLAUDE.md` §29. The same entry notes the other trap: **ES imports are hoisted**, so an environment variable set at the top of a script is too late for any module that reads it at load (the first Flash build ran with search silently off for that reason and was discarded).
