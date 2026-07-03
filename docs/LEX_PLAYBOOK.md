# LEX PLAYBOOK — as-built operational reference

*The operational companion to `LEX_REBUILD_DESIGN v.1.md` (the spec). The design doc says
**why** and **what**; this says **how it is wired and how to work on it**. The Lex equivalent of
`INGEST_PLAYBOOK.md`. Update this whenever the conversation layer changes.*

**Status:** The FULL KERNEL is built — Page 1 (Orientation / "The Basic Idea") + Page 2 (Diagnosis) + Page 3
(Guiding Policy) + Page 4 (Coherent Actions + costing shell). Sprint 1 (state layer + panels) + Sprint 1.1
(orchestration) + Sprint 1.2 (markdown background, intro reword, failure logging) + Sprint 1.3
(save-before-advance guards §3a, "How this works" tour §3b, `preferredName ?? firstName`) + Sprint 1.4 (UX
polish — prominent pill trigger, auto-open on first idea, modal copy, "The Basic Idea" rename) + Sprint 2
(Diagnosis / Page 2 + the search gateway + the Page 1→2 transition — §10) + **Sprint 3** (method layer, Page 2
refinements + causal tree, Page 3, Page 4 + costing — §11 below). All preview, NOT promoted. Real FTS is still
stubbed behind the gateway; the costing benchmark set is hand-seeded placeholders (Phase-2 research pending).

---

## 1. The contract in one screen (non-negotiable — design §2)

1. **Canonical state is server-authoritative.** `GET /api/ideas/{id}/state` returns the whole truth.
   The frontend renders it and holds **no** progress state of its own — only an in-flight spinner +
   the chat transcript.
2. **Lex is never in the control loop.** Lex returns content (`chatText` + an optional `proposal` +
   `extracted` slots) via Gemini structured output. The **platform** owns sequence, completion, the
   search trigger, and every write of `value`/`currentField`/`stage`.
3. **Panels are pure renderers** of a slice of canonical state. If the state is right, the panels are right.

If you are about to make the frontend compute progress, or let Lex decide "what's next", stop — that is
the class of bug this rebuild exists to remove.

---

## 2. The field state machine (design §3.2)

Persisted in **`IdeaFieldState`** (one row per `(ideaId, fieldKey)`), the single source of truth for
"where we are". Statuses: `EMPTY → AWAITING_CONFIRMATION → ACCEPTED | SKIPPED` (and reopen →
`AWAITING_CONFIRMATION`). The confirmation **surface renders iff `status === AWAITING_CONFIRMATION`** —
no timers, no local flags (that was the 20s-revert bug).

**Accept-surface model (revised in §3.2/§5, Sprint 1.1):**
- **Narrative boxes** (`ideaNarrative`, `youAndIdeaNarrative`, `aboutYou`): the **box is the accept
  surface**. Two write paths, both server-side:
  - *Form:* type + **Save** → `ACCEPTED`.
  - *Chat:* user answers in chat → Lex tidies it into a `proposal` → box `AWAITING_CONFIRMATION` → the
    box renders the proposed text (marked "proposed") → **Save** accepts. No chat accept-card for boxes.
- **Title / Keywords** (a row, no box): Lex proposes → **inline confirm in chat** (the `AcceptCard`).

Accepted values are also **mirrored** onto canonical columns per the write-ownership table (design §3.4):
`ideaNarrative`/`youAndIdeaNarrative`/`title`/`keywords` → Idea; `aboutYou` → User (reused across ideas).
Behind-box slots Lex infers go to `Idea.ideaSlots` / `User.profileSlots` / `User.experienceLevel`
(`storeExtracted`), never carded.

---

## 3. The orchestrator — the conductor (design §13 Task 3/4)

`lib/lex/orchestrator.ts → orchestrateAfterWrite(ideaId, userId)` runs **after every field write** and
makes Lex speak the next step. It owns sequence. Rules:

| Situation | Action |
|---|---|
| current field is a freshly-EMPTY narrative box | Lex acks the prior step + asks this box's question |
| all boxes terminal, `title` EMPTY | Lex proposes **Title** (inline confirm) |
| `title` terminal, `keywords` EMPTY | Lex proposes **Keywords** |
| `keywords` accepted | (handled in the `fields` route) fire search + post pointer + stage → `DIAGNOSIS` |
| current field `AWAITING_CONFIRMATION` | do nothing — the user is mid-decision |

**No path may leave the flow idle.** Every Lex call has a **deterministic fallback** so a Lex hiccup
can't stall: each field carries a platform-authored `question` (page1-config), and Title/Keywords fall
back to `fallbackTitle`/`fallbackKeywords` (so the inline confirm always appears). The `fields` route
returns `{ state, messages }`; the client appends `messages` to the transcript.

### 3a. Save-before-advance — one box finished before the next (Sprint 1.3)

The non-negotiable rule the create flow exists to keep: **`currentField` advances only when the
current box is Saved (`ACCEPTED`) or Skipped — never on a `/lex` turn.** Three guards, all server-side:

1. **State.** `computeCanonicalState.currentField` = the *first non-terminal* field (`state.ts`). An
   `AWAITING_CONFIRMATION` box is non-terminal, so it stays current until the user Saves/Skips it. This
   is the structural guarantee — nothing else can move the pointer.
2. **Orchestrator.** `orchestrateAfterWrite` only speaks for a freshly-`EMPTY` field; it **returns early
   (and never advances)** when the current field is `AWAITING_CONFIRMATION`. It runs from the `fields`
   route only — *not* from `/lex`.
3. **`/lex` route + prompt.** A turn may set a proposal **only for the current field** (`fieldKey ===
   current.key`; off-field proposals are discarded and logged). When the current box is already
   `AWAITING_CONFIRMATION`, the prompt is built with **`awaiting: true`** → Lex refines *that box only*,
   must not ask the next question or propose another field, and points the user to **Save** in the panel.
   On a fresh box proposal the prompt requires Lex's `chatText` to point to the panel and ask the user to
   review and **Save** ("I've drafted that in the panel on the right — have a read, edit it directly… then
   Save it"). So Lex never *reads* as advancing even though it structurally cannot.

**Diagnostics (`[lex-diag]`).** Every `/lex` turn logs `{currentField, status, awaiting, proposalApplied}`
and warns on any `off-field proposal discarded`; the orchestrator logs `advancing` / `holding`; the
`fields` route logs `{action, fieldKey, nextField, nextStatus}`. If the "two proposals / box advanced
unsaved" symptom ever recurs, these show *which* layer moved the pointer — read them before hypothesising.
Editing the box prompt (`lex-client.ts buildLexSystemPrompt`, the `origin === 'box'` branch) changes only
chat wording — never the mechanics.

### 3b. "How this works" tour + FAQ modal (Sprint 1.3)

`components/lex/HowItWorksModal.tsx` is the create-view walkthrough — a **persistent "How this works"
button** (top bar in `CreateIdeaClient`) opens it; it explains the three panels (verbatim tour copy) and
has a **Read the FAQs** button that switches to the existing FAQ content (`lib/faq-content.ts`, incl. the
Strategic-Kernel / Guiding-Policy explanation), rendered with `react-markdown`. The intros offer it
("…say the word…"); a conservative `HELP_INTENT` regex in `CreateIdeaClient.sendMessage` opens the modal
on a plain "how does this work / give me a tour" message instead of a Lex round-trip (it deliberately does
**not** match a bare "yes please" or "explain how this *policy* works"). Keep the regex and the modal copy
in step; the button must always exist (don't silently remove the reference again).

---

## 4. Lex output contract (design §4)

Gemini structured output (`responseMimeType: application/json` + `responseSchema`) → `{ chatText,
proposal, extracted }`. The server **validates `proposal.value`** against the field's zod schema
(`proposal-schema.ts`); on failure it **discards the proposal, keeps `chatText`, retries once**. Lex can
never half-advance state. `proposal.fieldKey` is constrained to the five Page-1 keys; `valueText` for
narratives/title, `valueList` for keywords.

Editing the Lex prompt (`lib/lex/lex-client.ts → buildLexSystemPrompt`) changes only `chatText`/proposal
quality — never the mechanics. (Known prompt nit to tidy whenever: Lex sometimes thanks the user.)

**Failure handling (Sprint 1.2 — bytes before hypotheses).** A failed Lex turn is usually transient
(it self-recovered on resend). `runLexTurn` logs the **cause per attempt** before anything else —
`[lex] gemini call failed` with `{kind, status, bodySnippet}` (kind ∈ `rate_limit` 429 / `upstream_5xx` /
`http_error` / `timeout` / `network` / `empty_response`), and `[lex] structured-output validation failed`
with the raw bytes when the output fails our shape check. The `/lex` route logs a summary and returns
`errorType=kind`. The **client retries the whole turn once** (700 ms) before showing "I lost the
connection". Diagnose from the server logs first; don't tune timeouts/temperature blind.

---

## 5. Search trigger + Initial Background (design §8)

Deterministic, platform-owned: on **keywords accept**, `fireSearchTrigger` runs the search and writes
`Idea.legislationRefs` (`SearchResult[]`) + a `Document(kind:'INITIAL_BACKGROUND')`, then Lex posts a
one-line pointer. **Stubbed now** (`lib/lex/search-stub.ts`) shaped *exactly* as the §8.3 `SearchResult`
interface — wiring real FTS in Sprint 3 is a one-line source swap. Grouped ≤3 per type, capped ~20.

The Initial Background **body is markdown** (the stub emits headings/bold/lists; Lex-generated briefings
later may be richer). `BackgroundPanel` renders it with **`react-markdown`** (added Sprint 1.2 — there was
no existing markdown renderer; checked first to avoid a duplicate). Tailwind v4 has **no typography plugin**
(no `prose` class), so element styling is supplied via a `Components` map (`MD_COMPONENTS`) with `node`
stripped off each element. Don't render Lex/stub markdown as raw text; don't reach for a second markdown lib.

---

## 6. File map

```
lib/lex/
  page1-config.ts    field SoT + AGGREGATOR: PAGE_SEQUENCE/ALL_FIELDS/fieldDef/keys span all pages; canonical-state types; acceptSurfaceOf; SearchResult interface
  page2-config.ts    Page 2 (Diagnosis) fields (§7.1) + structured slot labels
  state.ts           computeCanonicalState (§3.3); currentField scoped to the active lexPage page; nextPage; diagnosisCauses
  field-machine.ts   transitions + mirrors (both pages) + storeExtracted + fireSearchTrigger + initializeFieldStates + advanceLexPage + causes CRUD + buildWhoAffectedSeed
  search-gateway.ts  runSearch — the ONE search seam (intent + capability flags); §14
  lex-client.ts      Gemini structured output + buildLexSystemPrompt (fieldGuidance per kind) + runLexTurn + generateCauseCandidates
  proposal-schema.ts per-field zod validation (both pages; structured objects)
  orchestrator.ts    orchestrateAfterWrite — the conductor (§13), dispatch by field kind
  search-stub.ts     stub SearchResult[] + groupForPanel + Initial Background prose
  authz.ts           owner/collaborator auth for an idea
app/api/ideas/[id]/
  state/route.ts     GET canonical state
  lex/route.ts       POST one Lex turn (sets proposal for the current field)
  fields/route.ts    POST scalar/structured transition (submitBox|accept|skip|reopen) → conduct → {state, messages}
  causes/route.ts    POST causes-loop + root-cause (add|update|remove|confirm|skip|setRoot) → {state, messages}
  page/route.ts      POST {action:'advance'} — advance lexPage → seed next page → {state, messages}
components/lex/       ChatPanel (focusNonce), AcceptCard (chat-surface scalars), FieldsPanel (all field kinds), BackgroundPanel (+ Continue CTA)
app/ideas/create/     CreateIdeaClient (orchestrator client), page.tsx (intro bubbles + firstName)
```

The old `/api/ai/[ideaId]` (streaming prose + embedded JSON) is **left intact for Stage 2** until those
pages are rebuilt; the create flow no longer uses it.

---

## 7. DB & ops — the gotcha that will bite you

The app runs on **Neon** (V26 cutover), but the local `scrutinise-web/.env` still points `DATABASE_URL`
at **Railway**. Therefore:

- **Apply schema changes to Neon only**, with an idempotent SQL file (see `prisma/lex_rebuild_page1.sql`):
  ```
  NEON_URL=<from .env NEON_DATABASE_URL>; DIRECT_URL="$NEON_URL" npx prisma db execute --file ./x.sql
  ```
  Then `npx prisma generate`. **Never `prisma db push`** — it targets Railway and tries to force-reset
  over pre-existing drift (`scheduler_lock`). Railway is the gated V26 DROP rollback path — do not touch it.
- **Local scripts** (migrations, smoke tests) must set `process.env.DATABASE_URL = process.env.NEON_DATABASE_URL`
  *before* importing `@/lib/prisma` (which binds at module load). `tsx` resolves the `@/` alias.
- **Migration (design §9):** `scripts/migrate-lex-fields.ts` (idempotent; dry-run default, `--apply`)
  copies legacy idea fields into `ideaContext` tagged `[migrated: …]`. Applied 21 Jun 2026: 42/56 ideas.

---

## 8. Run / verify

```
cd scrutinise-web
npx tsc --noEmit                 # the build gate (no ESLint configured → TS is the gate)
npx prisma generate              # after any schema.prisma change
```

To smoke the state machine / conductor end-to-end, write a throwaway `scripts/_smoke-*.ts` that sets
`DATABASE_URL=NEON_DATABASE_URL`, drives `field-machine` + `orchestrateAfterWrite`, asserts on
`computeCanonicalState`, and deletes its test idea (cascade). Force the fallback path by setting
`GEMINI_API_KEY=''`. Delete the smoke after.

**Git:** no git mid-sprint; one end-of-sprint `commit-all.sh` (each commit a real UTC `Date:` trailer);
Charlie validates on the preview; commit to `Main`; delete the script after.

---

## 9. Extending to a new page — the pattern to copy

1. Add the page's fields to a page config (mirror `page2-config.ts`); give each a `type`, `scope`,
   `origin`, `slots?` (structured), and a fallback `question`. Register the page in `page1-config`'s
   `PAGE_SEQUENCE` (it aggregates all pages; imports are type-only so there's no cycle).
2. Add child entities where the design calls for a loop — mirror `DiagnosisCause` / CoherentActions
   (its own route under `/api/ideas/[id]/<loop>`); reuse `IdeaFieldState` for scalar/structured fields.
3. Add mirror-column writes in `field-machine.mirrorValue`, and a validator per field in `proposal-schema`.
   Add proposed scalars to the `lex-client` `RESPONSE_SCHEMA` fieldKey enum + a `fieldGuidance` branch.
4. Teach the conductor the new "what next" by field kind (it already dispatches proposed/structured/loop/
   reference/narrative). Render from canonical state; never add a counter or a sequence decision.

---

## 10. Sprint 2 (Diagnosis / Page 2) — as built

**The search gateway (design §14) — `lib/lex/search-gateway.ts`.** The SINGLE point of contact with search.
`runSearch({ keywords, intent, ideaContext?, limit? })` = build → expansion (flag) → web orientation (flag)
→ `runFtsSearch` → `groupForPanel`. **Intent** vocabulary is owned here (`BACKGROUND_BRIEFING`,
`CAUSE_SEEDING`; more reserved). **Capability flags** (`expansion`/`webOrientation`/`vector`/`reranker`/
`graph`) come from env, default OFF; `expansion` is the existing `LEX_QUERY_EXPANSION`. Every caller goes
through it (`fireSearchTrigger` for the briefing, the conductor's `seedCauses` for cause seeding). **When
search grows, only this file changes** — don't call `runFtsSearch`/`runStubSearch` directly again.

**Multi-page state.** `Idea.lexPage` (`ORIENTATION`|`DIAGNOSIS`|…) is the explicit current-page pointer,
**distinct from the 5-stage lifecycle `Idea.stage`**. `computeCanonicalState` scopes `currentField` to the
active page's fields, and sets `nextPage` when the active page is complete and a further built page exists.
Advancing is explicit: `POST /api/ideas/[id]/page {action:'advance'}` → `advanceLexPage` (forward-only, from
a complete page) → conductor seeds the next page's first field. Page 1 no longer dead-ends.

**Accept surfaces by field kind** (`acceptSurfaceOf(def)`): box-authored fields (narrative/structured/loop/
reference) accept **in the Fields panel**; Lex-proposed scalars (title/keywords/challenge/pivotalObstacle/
summaryDiagnosis) accept **inline in chat** (the `AcceptCard`). The conductor **seeds** structured + loop
fields to `AWAITING_CONFIRMATION` (structured = carry-forward/empty slots; loop = corpus candidates) — this
both keeps them current and stops re-seeding on the next write.

**Causes loop (§7.2).** `DiagnosisCause` child rows (source `USER`|`LEX_CORPUS`), CRUD in `field-machine`,
mutated via `POST /api/ideas/[id]/causes` (add/update/remove/confirm/skip/setRoot) — **not** the `/fields`
endpoint (which 422s `causes`/`rootCause`). `confirm` requires ≥1 cause; `setRoot` marks exactly one
`isRootCause` and mirrors the text to `Idea.rootCause`. Seeding = gateway `CAUSE_SEEDING` +
`generateCauseCandidates` (structured Gemini call; resilient → `[]`, so the flow never blocks on it).

**Carry-forward (§7.1).** `buildWhoAffectedSeed` seeds `whoAffectedImpactCost.affectedGroups` from the legacy
`Idea.whoAffected` if present (the only structured Page-1 source today); impact/cost/evidence start blank for
the user. When a structured Page-1 impact/cost source exists later, widen this seed.

**Schema apply.** `prisma/lex_rebuild_page2.sql` (additive, idempotent) via `DIRECT_URL=<NEON> npx prisma db
execute --file …` then `npx prisma generate`. Same rule as §7 — **never `db push`** (targets Railway).

---

## 11. Sprint 3 (the full kernel) — as built

Design source: `LEX_DESIGN_ADDENDUM_16-19.md` (design §16–§19). Preview, NOT promoted. `tsc` clean (react-markdown
only). Schema in `prisma/lex_rebuild_page3_4.sql` (additive, idempotent; **applied to Neon**; seeds 10 placeholder
`CostBenchmark` rows). End-to-end smoke passed 16/16 on the deterministic fallback path.

**Method layer (§16.3) — `lib/lex/method.ts`.** The four Rumelt blocks VERBATIM (edit the design doc §16.3 first,
mirror here). `buildLexSystemPrompt` injects `methodForStage(pageOf(currentField).key)` = M-GENERAL + the active
stage's block, under a METHOD heading. Never quote the book / name it; ideas only, nothing enters the corpus.
`[lex-diag] method blocks` logs which blocks are active. ORIENTATION gets M-GENERAL only.

**Page 2 refinements (§16.1).** `DiagnosisCause.classification` (MATERIAL|CONTRIBUTORY|UNASSESSED, default
UNASSESSED) — chips in the panel + a `classify` action on `/causes`; `rootCause` selection prefers MATERIAL
causes (falls back to all if none marked, so the flow never blocks). Who's-affected reframed to "most acutely
affected". Cui bono ("who benefits from the status quo") asked during the `pivotalObstacle` turn and captured as
the `beneficiariesOfStatusQuo` idea slot (added to `IDEA_SLOT_KEYS` + the extracted schema — no new column).

**Causal tree (§16.2).** `DiagnosisCause.parentCauseId` self-FK (ON DELETE CASCADE → removing a parent removes
its subtree). The causes field has a **List | Map** toggle; Map renders a **dependency-free nested tree** (indent +
left connector; MATERIAL nodes amber), each node edit/classify/remove + "+ cause beneath". Soft depth cap 4
(`MAX_CAUSE_DEPTH`) — "+ beneath" disables at the deepest level with a consolidation nudge. `generateCauseCandidates`
returns optional `classification` + one level of `subCauses`; `createCauses` links them. **Mermaid was deferred**
(no diagram dep existed; adding an uninstalled npm dep would produce new module-not-found tsc errors indistinguishable
from real ones and muddy the gate) — the nested render satisfies acceptance "Map view renders and edits". Swapping to
Mermaid later is a self-contained change to `CauseTreeView` once the dep is installed.

**Page 3 — Guiding Policy (§17) — `lib/lex/page3-config.ts`.** Fields: `policyOptions` (loop → `PolicyOption`
child), `chosenApproach` (reference), `whatItRulesOut` (computed proposed), `leverage` (box), `anticipatedResponses`
(structured), `conditionsForSuccess` + `summaryGuidingPolicy` (proposed). `PolicyOption` table + `/policy-options`
route (add/update/remove/ruleOut/confirm/skip/choose/skipChoose). Lex seeds candidates per material cause with
genuine for/against via `generatePolicyOptions` (resilient → `[]`). `choose` → CHOSEN for one, RULED_OUT for the
rest; the conductor composes `whatItRulesOut` from the ruled-out options + reasons (`seedComputedProposed`). Panels:
`PolicyOptionsField` + `ChosenApproachField`.

**Page 4 — Coherent Actions + costing (§18) — `lib/lex/page4-config.ts`.** Fields: `actions` (loop →
`LexCoherentAction` child), `coherenceCheck` (proposed, Lex commentary), `costSummary` (computed), `summaryCoherentActions`
(proposed). **`LexCoherentAction` is a NEW table, deliberately isolated from the large legacy `CoherentAction` model**
(old Stage-2 UI + many relations) so the Lex rebuild stays self-contained. §18.2 costs per action = `{low,high,unit,
basis,benchmarkId?,userOverride?}` JSON for implementation / enforcement / regulatory-friction. `CostBenchmark` (shared
sourced defaults, hand-seeded placeholders) + `IdeaAssumption` (user overrides w/ evidence). `/actions` route; the panel
estimator has a per-category range editor with a benchmark picker (prefills unit/basis/low/high; user override flips
`userOverride`). `computeCostSummary` sums each category into a range and sets it against the Page 2 problem cost
(`whoAffectedImpactCost.cost`); the conductor seeds it via `seedComputedProposed`.

**Conductor + wiring.** `orchestrateAfterWrite` dispatches: computed proposed (`whatItRulesOut`/`costSummary`) →
`seedComputedProposed`; loops by key (`causes`→seedCauses, `policyOptions`→seedPolicyOptions, `actions`→seedActions);
references (`rootCause`/`chosenApproach`) → askQuestion. `computeCanonicalState` now returns `policyOptions`, `actions`,
`benchmarks` (benchmarks loaded only on Page 4). `field-machine.mirrorValue` + `proposal-schema` extended for every new
field. `/fields` rejects the child-entity keys (`causes`/`rootCause`/`policyOptions`/`chosenApproach`/`actions`).
`LOCKED_PAGES` is now empty (all four pages are real). Page-transition CTA copy generalised (`BackgroundPanel`).

**Extending further — the copy-me pattern is unchanged (§9):** add a page-config, register it in
`page1-config.PAGE_SEQUENCE`, add child entities + their own route where a loop is needed, add mirror + validator +
canonical-state population + a conductor dispatch by field key, and a panel renderer keyed by field key. Never add a
counter or a sequence decision to the client.

### 11a. Sprint 3-A amendments (§19-A) — the important contract change

**A1 — structured fields are PROPOSABLE (the anti-transcribe rule).** The §4 proposal contract now has a THIRD
value shape: `proposal.valueObject` (a `{slot: string}` map) alongside `valueText`/`valueList`. For a structured
field, Lex synthesises the user's chat answer into the slots and returns a valueObject proposal; the `/lex` route
picks `valueObject` when `current.type === 'structured'`, validates it via the field's zod schema (which `.strip()`s
unknown keys), and sets it AWAITING; `StructuredField` renders it ("proposed by Lex — refine") and Save accepts.
The proposable enum in `lex-client` RESPONSE_SCHEMA now includes `whoAffectedImpactCost`/`legalLandscape`/
`anticipatedResponses`. **Hard rule in the prompt:** never ask the user to transcribe/"pop" their own words into a
box — Lex tidies chat into the proposal; the user only reviews and Saves. When adding a new structured field,
add its slot keys to the `valueObject` schema properties too.

**A4 seeding robustness.** `seedCauses` logs `[lex-diag] cause seeding {…}` per stage, retries the generator once,
and has a deterministic corpus-grounded fallback (only fires when the generator yields nothing AND FTS returned
relevant rows). If a preview shows no seeded causes, read that log first — it names the exact failing stage.

**A2/A3 UX.** Chat messages carry a `stage` tag (client-side, set at append from the response's `state.stage`);
`ChatPanel` groups by stage and collapses non-active stages. `FieldsPanel` collapses completed pages into
accordions and scrolls the `currentFieldKey` box to the top on Save. These are pure-render concerns — no canonical
state involved; resumed history without stage tags simply inherits the previous group.

### 11b. Costing engine — COSTING_SCOPE §9 deltas

`CostBenchmark` carries the §3 deltas (`priceYear`, `category`, `region`, `uprateMethod`, `confidence`), and a
new **`DeflatorSeries { year, index }`** table holds the GDP deflator as data. Schema in
`prisma/lex_costing_deltas.sql` (additive, idempotent; **applied to Neon**; seeds an ILLUSTRATIVE placeholder
deflator series 2015–2026). Each `CostRange` may carry a `priceYear` (the benchmark picker stamps it);
`computeCostSummary` uprates every figure from its price year to the latest deflator year (ratio of indices)
before totalling, and states the price base in the summary. **When Phase 2 lands** (COSTING_SCOPE §7): replace
the placeholder deflator rows with the real ONS series, add a GDP-per-head series for VPF (`uprateMethod =
GDP_PER_HEAD` currently falls back to the deflator), and add the optimism-bias uplift + EANDCB ±£5m
RPC-scrutiny flag. The schema is ready for all of it.

**Phase 2a s1 — verified benchmarks are IN, placeholders are OUT.** `docs/cost-benchmarks-seed-v1.json` is the
benchmark source of truth (principle: verified against a primary source or it stays in `_pending`). Loader:
`scrutinise-web/scripts/load-cost-benchmarks.ts` (dry-run default, `--apply`; stable `v1-*` ids, upsert,
deletes `seed-*` placeholders — idempotent). Current DB set: v1-qaly / v1-wellby / v1-vpf / v1-homicide /
v1-crime-total. Appraisal **parameters** live in `lib/lex/costing-params.ts` (mirror of the JSON's
`parameters` — edit the JSON first): STPR + EANDCB threshold are VERIFIED; the health discount rate and
optimism-bias uplifts are **TRAINING_RECALL (`verified:false`) and must not drive user-facing numbers until
Phase 2b verifies them**. The JSON's `_pending` array is the Phase-2b extraction backlog — extend the file +
re-run the loader to add rows; never hand-INSERT into `CostBenchmark`.
