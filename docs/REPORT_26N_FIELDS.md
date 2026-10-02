# 26-N addendum item 1 — the Guiding Policy section's fields, and everywhere each is read

*2 October 2026. Read-only research (every claim file:line-cited by the mapping pass); nothing relabelled.
**§3 (the rename) is held until Charlie has decided on the "Decision needed" section at the end.***

## 0. Where a "guiding policy" can live — four stores

| Store | What | Written by |
|---|---|---|
| **`IdeaFieldState`** | per field: `value` (accepted text), `proposal` (pending `{value, rationale}`), `status` (EMPTY / AWAITING_CONFIRMATION / ACCEPTED / SKIPPED), `stale` + `staleReason`, and — new in 26-N — `redraft` | the build and Lex write `proposal`; a user accept writes `value` |
| **`Idea` column mirror** | `chosenApproach`, `whatItRulesOut`, `leverage`, `anticipatedResponses` (Json), `conditionsForSuccessLex`, `summaryGuidingPolicy`, `summaryDiagnosis`, `summaryCoherentActions`, `coherenceCheck`, `costSummary` | `mirrorValue` (`field-machine.ts:65`), only from `acceptField`, `submitBox`, `choosePolicyApproach` — **never by the build** (`build.ts:3512–3546`) |
| **`PolicyOption` row** | `approach`, `caseFor/Against`, `status` (CANDIDATE / CHOSEN / RULED_OUT), `ruleOutReason`, `kind`, `chainLink`, `rulesOut`, `likelihood`, `number`, `disposition` | the build, the user, the guiding-policy screen, consolidation accept |
| **`Idea.guidingPolicy`** | the **legacy Stage-1 column** | legacy routes only — **the Lex path never writes it** |

## 1. The fields

| Field | Type / origin | What it holds | Written by | Mirror |
|---|---|---|---|---|
| **policyOptions** | loop | the candidate rows (`PolicyOption`); the field's proposal is only a numbered rendering of them (`syncPolicyField`) | build, user, screen ops | none |
| **chosenApproach** ("Chosen approach") | reference, required | **the guiding policy's statement** — plain text | old route `choosePolicyApproach` (sets the field ACCEPTED); the build proposes it; **before 26-N, consolidation-accept's `settle` never wrote it** | `Idea.chosenApproach` |
| **whatItRulesOut** | text, proposed | 2–4 sentences: what choosing the policy puts off the table | build prompt; conductor composes from the RULED_OUT rows (`orchestrator.ts:558`); chat | `Idea.whatItRulesOut` |
| **leverage** | narrative box, required | why the approach hits the pivotal obstacle (the asymmetry/pivot it exploits) | build; the user's box | `Idea.leverage` |
| **anticipatedResponses** | structured, 5 slots | JSON `{avoidance, gaming, enforcementBurden, legalChallenge, politicalAttack}` | build; conductor seed (`orchestrator.ts:387`) | `Idea.anticipatedResponses` |
| **conditionsForSuccess** | text, proposed | `•`-bulleted testable bets (3–5) | build (`build.ts:2222`) | `Idea.conditionsForSuccessLex` (the plain `Idea.conditionsForSuccess` is an older column on another model) |
| **summaryGuidingPolicy** ("Guiding-policy summary") | inferred, proposed | **prose summarising the whole section**: approach, leverage, rules-out, responses, conditions (≤6000 chars) | build; conductor/chat, composed from the other five when they are ACCEPTED (`accepted-context.ts:53`) | `Idea.summaryGuidingPolicy` (and the legacy route copies it into `Idea.guidingPolicy`) |

**The other three sections' summaries.** *Orientation has no summary field* (nearest: `ideaNarrative`, the user's own box, and `Idea.summaryDescription`, outside the field config).
**`summaryDiagnosis`** — prose naming root cause and pivotal obstacle; composed from challenge, who-affected, root cause, legal landscape, pivotal obstacle; mirror `Idea.summaryDiagnosis`.
**`summaryCoherentActions`** — "what happens, in what order, and why that order"; composed from chosenApproach, coherenceCheck, costSummary, summaryDiagnosis; mirror `Idea.summaryCoherentActions`.
**`coherenceCheck`** (inferred) — the review `generateCoherenceReview` writes from the actions + chosenApproach + rootCause + pivotalObstacle. **`costSummary`** — platform-computed.

## 2. Which field each document presents as "the guiding policy"

| Document | Heading it prints | Field / column it reads | file:line |
|---|---|---|---|
| **Proposal (full)** | "Guiding Policy" | **`chosenApproach`** (IdeaFieldState, ACCEPTED/SKIPPED only), else the candidate list | `build-proposal.ts:627–631` |
| | "Why this hits the obstacle" / "What it rules out" / "Anticipated responses" / "Conditions for success" | `leverage` / `whatItRulesOut` + the RULED_OUT rows' reasons / `anticipatedResponses` / `conditionsForSuccess` | `:636–674` |
| | — | **never reads `summaryGuidingPolicy`**, `summaryDiagnosis`, `summaryCoherentActions` or `coherenceCheck` | — |
| **One-page summary** (`buildProposalSummary`) | "Guiding Policy" | **`chosenApproach`**, else "Current leading approach, of N" | `build-proposal.ts:1165–1186` |
| **Meeting Pack** | "The guiding policy" ("Not settled yet." when empty) | **`chosenApproach`** | `build-meeting-pack.ts:216–226` |
| **Build-time one-pager** | "The approach" (+ "strongest argument for" from the CHOSEN row's `caseFor`) | **`chosenApproach`** (ACCEPTED only) | `build-one-page-summary.ts:71,98,122` |
| **Committee evidence** | "The proposed approach" (else "*No guiding policy has been settled…*") | **`chosenApproach`**; then `whatItRulesOut` unheaded; `summaryDiagnosis`, `summaryCoherentActions` elsewhere | `build-committee-evidence.ts:105–127` |
| **Initial Questions** | "Candidate approaches" (each tagged *(chosen by Lex)* / *(ruled out)* / *(candidate)*) and "Kernel fields drafted and not yet settled" | the **PolicyOption rows**; and every AWAITING kernel field with its **label** ("Chosen approach", "Guiding-policy summary"…) | `build-initial-questions.ts:142,216–250` |
| **Public proposal page / API** | "The approach" | frozen snapshot `chosenApproach` | `proposals/[token]/page.tsx:152` |
| **Build summary (BuildFindings)** | "**The guiding policy**" | **`summaryGuidingPolicy`** (+ `whatItRulesOut`, `conditionsForSuccess`); never `chosenApproach` | `build-highlights.ts:127–136` |
| **Initial Background** | no reader found | — | — |

**Net: five documents call `chosenApproach` the guiding policy; one place (the build summary) calls `summaryGuidingPolicy` "The guiding policy"; the full Proposal never prints the summary field at all.**

## 3. Everywhere else it is read

**UI.** Idea detail → Policy tab: `chosenApproach` is drawn from the **CHOSEN `PolicyOption`** (`IdeaDetailClient.tsx:1137`), the other fields from the field's `value`. Overview → "Approach (summary)" reads the **`Idea.summaryGuidingPolicy` column** (`:1498`). The legacy Overview tab and the stage-2 gate read **`Idea.guidingPolicy`** (`:1617,2448`; `stage-gates.ts:116`) — which Lex never writes. Workspace: `ChosenApproachField` (CHOSEN row, else field value); `GuidingPolicyScreen` "Settled:" reads `Idea.chosenApproach`. **No reader in dashboard cards, My Ideas, search, email or admin.** Referral/prototype pages read the legacy column.

**Lex's context.** The "already captured" ledger, the source-values block and the conductor's `acceptedValue` read **IdeaFieldState ACCEPTED only**. `kernelText` (every kernel check, repair, adversarial and spawn pass) uses `chosenApproach` for "THE APPROACH" and `summaryGuidingPolicy` for "THE GUIDING POLICY", accepted value else standing proposal — and does **not** include `whatItRulesOut`, `leverage`, `conditionsForSuccess` or `anticipatedResponses`. Research facts and stage-search read the **Idea columns**. Deepening, the update pass, the chat's numbered list, the consolidation drafters and the coherent-action step read the **`PolicyOption` row**.

**The coherence check.** The build's `ACTIONS_COHERE` / `HAS_LEVERAGE` / `POLICY_RULES_OUT` tests mark the `kernelText` string (`build-verify.ts:101–140`). The `coherenceCheck` *field* is produced from IdeaFieldState ACCEPTED `chosenApproach`, `rootCause`, `pivotalObstacle` + the action rows (`orchestrator.ts:627–636`).

## 4. Divergences found (what a user would call "the guiding policy")

1. **Settling did not accept the field** (the cause of Charlie's symptoms): consolidation-accept's `settle` set `PolicyOption` CHOSEN + `Idea.chosenApproach` and **never touched IdeaFieldState `chosenApproach`**. Every document and Lex's context read the field, so they printed "Not settled yet" / the old build text while the screen said "Settled". **Fixed in 26-N.**
2. **The accept route's comment claimed `settle` "opens Leverage, Anticipated responses, Conditions for success and the Guiding-policy summary"** — no such write existed. They stayed as the build left them. **Fixed: they are redrafted as proposals.**
3. **Un-choose** (the screen's op) reset the policy but not the field, so the documents kept printing an un-chosen policy. **Fixed.** **Editing the settled policy's card** rewrote `PolicyOption.approach` only, so documents/Lex kept the old wording. **Fixed.**
4. **The Idea page gives three different answers**: Policy tab = CHOSEN row; Overview "Approach (summary)" = `Idea.summaryGuidingPolicy`; legacy tab/gate = `Idea.guidingPolicy` (never written by Lex). **Not changed — see decision.**
5. **"The guiding policy" means different fields** (§2 above). **Not changed — see decision.**
6. **Initial Questions** hard-codes *(chosen by Lex)* on the CHOSEN row (wrong for a user-consolidated policy) and can list `chosenApproach` as "not yet settled" in the next block. **Not changed.**
7. **Meeting Pack / Proposal fallback** says "N approaches… none has been committed to" when one row is CHOSEN (the live list includes it). **Not changed.**
8. **`PolicyOption.rulesOut` / `likelihood`** are read by **no document** and are not in the snapshot; before 26-N they never reached `whatItRulesOut`. **Rules-out now reaches the field; likelihood now feeds Anticipated responses and Conditions.**
9. **Mirror columns with no reader:** `Idea.whatItRulesOut`, `leverage`, `anticipatedResponses`, `conditionsForSuccessLex`, `coherenceCheck` are written and read by nothing outside `field-machine.ts`. Only `costSummary` is read by a document.
10. **`settle` leaves the other candidates CANDIDATE**, whereas the old route RULED_OUT the rest — so "Alternatives ruled out" / "Already ruled out, and why" can be empty after a consolidation.

## 5. Decision needed from Charlie before §3 (the rename)

"Chosen approach" → "Guiding Policy" would make **two fields carry the name**: the statement (`chosenApproach`) and the summary (`summaryGuidingPolicy`, today "Guiding-policy summary"), and the build summary already calls the *summary* "The guiding policy". Two questions:

- **A. Which field IS "the guiding policy"?** *Recommended: `chosenApproach` (the statement)* — it is what five documents already print under that name and what the rest of the system reads.
- **B. What does the summary field become?** *Recommended: keep it, relabel it "Summary of this section"* (or fold it into the Proposal as the section's lead), and change the build summary's heading from "The guiding policy" to the statement.
- **C. The Idea page** — make the Overview "Approach (summary)" read the same source as the Policy tab, and retire the legacy `Idea.guidingPolicy` gate check for Lex-built ideas?

Nothing is relabelled until these are answered.
