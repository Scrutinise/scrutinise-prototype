# LEX 26-P — Lex, rebuilt: §3 tool report (written before the build)

*Written 2 October 2026. Evidence is from reading the repository, not from running it. Where a fact could
not be read from this machine it says so (CLAUDE.md §19).*

## 1. What the current Lex is, measured by reading it

| | finding | where |
|---|---|---|
| Reply shape | One Gemini JSON call. `RESPONSE_SCHEMA` = `chatText` + nullable `proposal` (22-key `fieldKey` enum) + `extracted` (12 slots). Not literally 30 fields; the same thing. | `lib/lex/lex-client.ts:195-277` |
| Actions | **Keyword detectors in the route**, run before the model speaks: `isContinueIntent`, `isCorpusSearchRequest`, `fileUrlsFromChat`, `statesPurpose`, `isPlainAssent`, `requestedDraftField`, `looksLikeAReplacement`. The model is then *told* what the platform did. | `app/api/ideas/[id]/lex/route.ts` |
| Tool-decider | Separate Gemini function-calling request, gated by a `looksStatistical` regex, one tool (`query_stats`). | `lib/lex/tools/tool-runner.ts` |
| Chat "yes" | `isPlainAssent` against a stored `offer` files a consolidation. **This is exactly what §9-12 forbids** and is not carried over. | `lib/lex/stage-relevance.ts:103` |
| Model | `PASS_DEFAULTS['lex.chat']` says `gemini-2.5-flash` **but `callGemini` hard-codes it** — the registry only labels the ledger. | `lex-client.ts:513` |
| Caching | **None.** No `cache_control`, no `cachedContent` anywhere in `lib/`. | grep |
| Anthropic | `@anthropic-ai/sdk` is in `package.json` and **imported nowhere**; every Anthropic call is raw `fetch`. There is no `tool_use`/`tool_result` loop. | `model-call.ts:302` |
| Controls source | `lib/lex/product-facts.ts` (`PRODUCT_FACTS`) and `lib/lex/platform-controls.ts`, **both hand-maintained prose**. Neither is generated from the UI. | §6b below |
| Web search in chat | Built (S21 step 7), **gated OFF** (`LEX_CHAT_WEB_SEARCH`, default off, "unmeasured"), reachable only through `runGeneralCorpusChat`, with its own separate decision call. `webSearch()` itself is a clean provider-neutral function. | `general-chat.ts`, `orientation/web-search.ts:626` |
| Snapshot | `computeCanonicalState` has pages/fields/status/proposal/stage but **not** candidates, actions, sources, challenges or current page. A new builder is needed. | `lib/lex/state.ts:43` |
| Per-user switch | **None.** All flags are env-global. | `lib/env-flags.ts` |

## 2. Decisions taken (no stop needed — each is reversible and inside the brief)

1. **Model id.** `claude-sonnet-5-5` ($2 / $10 per M, cache read $0.20 — Anthropic's published table). The repo's rate table, registry and sampling allow-list know only `claude-sonnet-5` ($3/$15 list). I add `claude-sonnet-5-5` to all three. ⚠ The repo's own comment records that the *list* price, not a promotion, is what the table holds; I record $2/$10 as the published rate for 5.5, **not verified against an invoice**.
2. **"Thinking off".** On Sonnet 5.5 `thinking:{type:'disabled'}` returns 400. The off position is `thinking:{type:'between_tools'}`, valid at effort ≤ `high`. Forced `tool_choice` also 400s, so the loop uses `auto`.
3. **SDK.** The official SDK, with the few 5.5-only fields passed through a typed cast (the installed 0.91 types predate them).
4. **The switch** is `LEX_AGENT` = `off` (default) | `all` | a comma list of user ids/emails. It is the *mechanism of replacement* (brief §0), flipped by Charlie.
5. **"Asks first" confirmation** is a **signed, expiring token** (HMAC over idea, user, tool, input, price, expiry) that Lex *receives in a tool result* and the UI renders as a button. Only `POST …/lex-agent/confirm`, called by that button, executes it. A sentence in a document, or "yes" in chat, has no path to it — there is nothing in the conversation that approves.
6. **Content is data.** Tool results that carry third-party text (documents, web pages, corpus passages) are wrapped in a fenced `<untrusted_content>` block with a standing instruction, and mark the turn **tainted**. Tools fire only inside the route that handles the user's own POST.
7. **Provenance** is a required, *validated* argument on every tool that writes content (§4a). `user_words` must quote the user's actual recent messages; `corpus` ids must have been returned by a search **this turn or already be on the idea**; `web` ids must be `[W]` entries from this turn's search; `filed_document` ids must be this idea's materials. Provenance is recorded as an `EvidenceItem` audit row (the exact pattern `update-pass.ts` already uses for candidates it adds) — **no schema change**.
8. **Honesty in code** (§4b): after the loop, a deterministic check compares past-tense action claims in the reply with this turn's *successful* tool results. A mismatch is retried once with the discrepancy named; if it persists the unsupported sentences are removed and a platform sentence says nothing was changed.
9. **Tool log.** Every call is written to the persisted assistant message (`tools: [{name, input, ok, result}]`) and to the server log. ⚠ A queryable table would be better and needs a migration; I have **not** added a model (CLAUDE.md §11/§16 — schema is Charlie's call).

## 3. THE TOOL LIST (what you asked to see first)

Every tool takes the signed-in **owner** (`creatorId === user.id`). ⚠ The existing `authorizeIdea` also admits collaborators; §3a says owner, so the agent route does its own stricter check. Nothing here can name another idea: `ideaId` is never a tool argument.

### See — free
`get_overview` · `read_field(fieldKey)` · `list_candidates` · `list_actions` · `list_sources` (filed material + the user's include/exclude decisions) · `read_source(materialId)` (its findings, as data) · `list_challenges` (Deepening issues) · `read_history(query?, limit)` · `list_notes`

### Search — free
`search_corpus(query, types?, since?, until?)` — returns **raw ranked results with ids**, not a model-written answer (a thin wrapper on `runSearch`; today's `runGeneralCorpusChat` writes a second answer on top, which would be a second model call and a place for the model to launder numbers) · `search_web(query)` — `webSearch()`, `[W]`-numbered via `markPublicSources`, never renumbered into the corpus sequence · `search_my_documents(query)` — keyword search over the idea's filed material and its findings

### File — free
`file_url(urls[])` — `fileUrlsFromChat`, the same pipeline as the "+" button, one result per URL with its real reason on failure · `file_text(text, label)` — pasted text as material, `runMaterialFindings` · *(uploads arrive through the "+" button and are visible to Lex via `list_sources`; there is no file bytes path through chat)*

### Draft — free (nothing accepted, all undoable)
`draft_field(fieldKey, value, provenance)` — `offerRedraft`, **any** field, open or waiting; returns whether it is waiting on an earlier stage · `add_candidate(approach, caseFor?, caseAgainst?, provenance)` — **a candidate card, source LEX, compound-tested** (26-I A3) · `add_action(practicalStep, …, provenance)` · `write_note(title, body)`

### Explain — free
`explain(topic)` — from the controls source only (§6b)

### Change — **asks first** (button)
`accept_field` · `edit_field(fieldKey | candidate number, text)` (keeps the prior wording as a `FieldRevision`) · `rule_out_candidate(number, reason)` · `restore_candidate(number)` · `merge_candidates(na, nb, mergedApproach)` (the card shows both parents and the merged text — 25-T §2b) · `choose_policy(number)` / `unchoose_policy` · `move_to_actions(number)` · `dismiss_proposal(fieldKey)` · `skip_field` / `reopen_field` · `archive_source(materialId)`

### Run — **asks first above ~5p, price stated**
`run_comparison` (~2p, so *no* confirmation below the line) · `run_gap_check` (~14p) · `run_consolidation` (~11p) · `rerun_build` (30p+)

⚠ **Those four prices are the brief's figures, not measured pre-run estimators.** Only `build-estimate.ts` has a measured estimate (for builds); the comparison, gap check and consolidation report their cost *after* the run. They are held in `lib/lex/agent/run-prices.ts` labelled `source: 'BRIEF_26P §3 — not measured'` so the confirmation card cannot present them as measured.

### Deliberately NOT tools
- **No delete.** "Archive, never delete" (§4c): removal is `rule_out_candidate` / `archive_source`, both reversible. There is no tool that removes a row.
- **Anything about permissions, billing, platform settings, admin, another user's idea, or stage advance by chat.** The stage bar already moves stages for free; I am not building a keyword path back in.
- **The stats tool** (`query_stats`) is folded into `search_corpus` only if the stats stream flag is on; the separate decider goes (§2c).

## 4. Where thinking is ON (§5a)
Nowhere by default. The only chain I expect to need it is `merge_candidates` (judging whether two candidates merge) — and that is the *user's* confirmed decision, so the model only drafts the merged wording. Measured before enabling anything: see §7.

## 5. §6b — can the controls source be generated from the UI?
**Not from the code as it stands, and I have not pretended otherwise.** The labels live as string literals in ~40 components. What I can do honestly: `lib/lex/agent/controls.ts` is the **one source** that Lex's `explain` tool reads, and `check:lex-26p` asserts every label in it appears verbatim in a rendered component file that **has an importer** (CLAUDE.md §23.1) — so a label renamed in the UI fails a check, and a label in the source that is on no screen fails it too. That is *verified-against-the-UI*, not *generated-from-the-UI*. Generating it needs a UI-side registry (`<Control id=… label=…>`) — a refactor across the components, not in this brief.

## 6. §7 — web search status
Built, gated OFF, unmeasured; Google returned results for `parliament.uk` and `bills.parliament.uk` and **zero** for `hansard.parliament.uk` (S24/S25 report). The new tool calls `webSearch()` directly and does **not** depend on `LEX_CHAT_WEB_SEARCH` — the flag guarded a *separate decision call* that no longer exists — but the agent's own switch gates it. Provider policy (S24b): Gemini is the sole default for chat web search; `search_web` passes `provider: 'google'` and does not fall through to xAI.

## 7. Cost (§5d) — MEASURED, 2 Oct, on a scratch idea, 11 turns, real model
**Mean 2.18p/turn (23.95p over 11 turns; range 1.05p–3.32p)** against today's real mean of 0.43p (the brief's figure). It is ~5× today's Lex and is the price of Sonnet 5.5 + tools: it matches the brief's own 2.35p no-thinking measurement. Turns with a tool loop cost 2–3.3p (2–3 model calls); a plain answer ~1–1.4p. Cache reads were 11–49k tokens a turn (the prefix + snapshot cache works). I added top-level auto-caching and the cost is unchanged within noise, so **the cost is not a caching problem; it is calls × output.** Levers not yet tried: `effort: low`, a shorter prefix, a cheaper model for plain answers. ⚠ Pricing is Anthropic's published $2/$10 (cache read $0.20), **not verified against an invoice.** ⚠ This is scratch-idea cost, **not Charlie's real use** — §5d wants that, and it needs the account day of §10 step 2.

## 8. Results (check:lex-26p --live, third run) — 140/140, 14 controls fired, 0 dead
Part A (offline, 90 checks) + Part B (50). The three failures in Charlie's real transcript (three links, the corpus search, "copy this into Rules out") were replayed with his **verbatim messages**; the other nine are written from the brief's description — the original transcripts for those are not in the database.

Real defects the live runs found and this build fixed (none was visible offline):
1. **"waiting for you to confirm" with no tool call** — the model told a user a confirm button was waiting when it had called nothing. New check `phantom-pending`.
2. **The model doubted its own correct claims.** Past turns were resent as text only, so it saw "I filed it" with no tool trace and spent a reply "correcting" it. History now carries a platform-written record of what each turn's tools did.
3. **A connection error after the tools had written** reported only "Connection error" — the user would have filed the links twice. The failure reply now lists what was done.
4. **Web search returned nothing** for the private-sector question: the shared Google grounding call was capped at 2,048 output tokens and was cut off (`MAX_TOKENS`). Raised to 8,192 in `orientation/web-search.ts` (a shared file — it also affects orientation).
5. A replay URL that 404'd (the new Lex correctly reported the real reason); a test regex that flagged the required "you can't edit it until…" sentence. Both were test faults, fixed.

## 9. What is NOT done, and what I did not verify
- **The switch is OFF and nothing is pushed.** §10 steps 2–5 (Charlie's day, the flip, removal) are his.
- **Not run:** the corpus search from Vercel (here it ran against production `fts-serve` with `FTS_SEARCH_URL` set for the process; ⚠ `fts-serve` aborted one query "This operation was aborted" — cold start, not investigated). `rerun_build`, `run_consolidation` and `run_gap_check` were NOT executed live (they cost 11–30p+); only their confirmation gate was exercised. They call the route handlers in-process, so ⚠ **a real browser press of Confirm on Consolidate / Re-run is untested.**
- **No browser verification of the UI cards** (`AgentCards`, the cost line). tsc and `check:client-boundary` pass; nobody has looked at it.
- **Tool log is on the chat message, not a table** (§2 decision 9).
- **`open_panel`/`highlight_field` only open a panel**; they do not scroll or flash a field.
- **Stage-1 "Ask" chat** is offered read-only tools only; it renders no cards.
- **`run_comparison` is ≤5p so it runs without a button, and on "what should I do next?" Lex RAN it unasked** (B10). Within the brief's tier rule, but worth Charlie's eye.
- Not run: §20 delivery checks (nothing is deployed); `check-clean-build.sh`; the 60-odd existing `check:*` suites against the old Lex route, which I edited (a delegate block + schema fields).
- Not done: the old Lex's "yes"-to-consolidate path (`isPlainAssent`) is still live for non-agent users — it is the §9-12 hazard, removed with the old code.
