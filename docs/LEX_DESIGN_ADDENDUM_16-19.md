# Append to LEX_REBUILD_DESIGN.md — §16–§19 (the full kernel)

*(Follows §15. References §3 (state), §7 (Diagnosis), §13 (conductor), §14 (gateway). §16–§18 are design; §19 is the CC brief that builds all three.)*

***

## 16. Page 2 refinements, the causal tree, and the method layer

### 16.1 Field order — unchanged; content sharpened

The §7 field order stands: challenge → whoAffectedImpactCost → causes → rootCause → legalLandscape → pivotalObstacle → summaryDiagnosis. Three within-step changes:

1.  **Material vs contributory (the Rumelt spine).** Each `DiagnosisCause` gains `classification: MATERIAL | CONTRIBUTORY | UNASSESSED`. Material = remove it and the problem largely goes away; contributory = worsens it but isn't decisive. Lex must press for this call on every cause — "is this *the* thing, or *a* thing?" — and not accept vagueness. The `rootCause` question becomes: "of the **material** causes, which is the main driver?"
2.  **"Who's affected" reframed.** Hints and Lex prompting change from "who's affected" (answer: everyone) to the two discriminating questions: **who is most acutely affected** (specific groups), and the impact/cost.
3.  **Cui bono moves to the obstacle step.** "Who benefits from things staying as they are?" is asked inside the `pivotalObstacle` conversation (stored as a `beneficiariesOfStatusQuo` slot in its structured value) — it is frequently the route to the obstacle, so it belongs there, not in the affected-groups step.

### 16.2 The causal tree (mind-map)

Real causes can sit more than two steps away (e.g. equalities-claims liability → tribunal payouts → exhausted budget → bin collections cut). So causes become a **tree**, not a flat list:

-   **Schema:** `DiagnosisCause` gains `parentCauseId` (nullable, self-referencing foreign key — a column that points at another row in the same table, which is how a tree is stored in a database). Root-level causes have `parentCauseId = null`; a sub-cause points at its parent. Soft depth cap **4** (Lex nudges consolidation beyond that — diagnosis should get *clear*, not *exhaustive*).
-   **UX:** the causes field gets a **List \| Map toggle**. Map view renders the tree as a **Mermaid** diagram (Mermaid is a text-to-diagram language: the app generates a few lines of diagram code from the cause records and a client library draws it). Nodes are clickable to edit/classify; each node has "add cause beneath this". Material causes render visually distinct (e.g. bold/coloured) so "picking out the credible ones" is literal.
-   **Brainstorm capture:** the user can free-list ideas in the simple form; Lex structures them into the tree ("X because Y because Z" chains create linked records) and proposes corpus-seeded candidates as before.
-   **Selection semantics:** `classification` and `isRootCause` apply at any node — the root cause may be a leaf three levels down (as in the bins example).

### 16.3 The method layer — Rumelt in the room

A new module `lib/lex/method.ts` holds **per-stage methodology blocks** (below) that the platform injects into Lex's system prompt for the active stage. This is the "potted Rumelt": the *ideas* of Good Strategy Bad Strategy distilled in our own words (ideas are not copyright-protected; the book's text is, so no excerpts — and nothing enters the corpus). Gemini already knows Rumelt from its training; these blocks *direct* that knowledge and fix the standard we hold the user to. Maintained here in the design doc as the single source; CC mirrors verbatim into `method.ts`.

**M-GENERAL (all stages):** You are guiding the user through a strategy kernel: diagnosis (what is really going on), guiding policy (the chosen approach to the pivotal obstacle), coherent actions (coordinated steps that execute the approach). Good strategy is scarce because it requires choice: naming one decisive obstacle, choosing one approach, declining others, and concentrating effort. Bad strategy has recognisable smells — fluff (abstract restatement dressed as insight), failure to face the problem, mistaking goals for strategy ("spend more, try harder"), and impracticable objectives (a wish-list with no leverage). Watch for these in the user's input and in your own drafts; name them kindly and push for the sharper version. Never let a list substitute for a choice.

**M-DIAGNOSIS (Page 2):** A diagnosis is a simplification that names what is pivotal — not an inventory of everything wrong. Press every cause to a classification: material (remove it and the problem largely goes) or contributory (worsens it, not decisive). Insist the root cause and the pivotal obstacle are distinct findings: the root cause explains why the problem *happens*; the pivotal obstacle explains why it *persists unsolved* — often enforcement failure, a coordination gap, a cost nobody will bear, or a party who benefits from the status quo (always ask who benefits). A diagnosis is complete only when a reader could say in one sentence what must be defeated for anything else to matter.

**M-GUIDING-POLICY (Page 3):** The guiding policy is an approach, not a goal and not an action list. It is designed, not picked: generate candidate approaches per material cause, argue each genuinely for and against, then choose — the rejected candidates, with reasons, are what the policy rules out, and a policy that rules nothing out is fluff. The chosen approach must have leverage: it concentrates effort on the pivotal obstacle and exploits some asymmetry (anticipation of behaviour, a pivot point, concentration). Anticipate responses — avoidance, gaming, enforcement burden, legal challenge, political attack vectors — and state conditions for success as testable bets ("for this to work, X must be true"). Never present a menu without driving to a choice.

**M-COHERENT-ACTIONS (Page 4):** Actions must be coordinated, not merely listed: each consistent with the policy and with each other, resources concentrated rather than smeared across everything. Check concentration (does the set focus effort where the leverage is?) and sequencing (what must happen first — chain-link steps where one failure breaks the chain). Every action names who implements it and what it costs to implement, to enforce, and in friction imposed on the economy; benefits are weighed against the Page 2 problem cost. Estimates are ranges with stated sources and assumptions the user can challenge — never unexplained point figures.

*(Why prompt-injection and not fine-tuning: fine-tuning — training a model's internal weights on documents — would require licensing the book's text, costs real money per model version, and teaches phrasing more than judgment. The distillation-plus-trained-knowledge route is cheaper, legally clean, editable in minutes, and survives model upgrades. If we later want more depth, we add our own-authored method notes to the corpus and retrieve them per stage — same RAG pattern as legislation.)*

***

## 17. Page 3 — Guiding Policy (evaluation-driven)

The section is a designed choice, not a questionnaire. Flow: orient → evaluate options → choose & rule out → crystallise. Fields:

| \# | Field                    | Type                    | Notes                                                                                                                                                                                                                                                                                                                                                                                        |
|----|--------------------------|-------------------------|----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------|
| —  | *(orientation)*          | conductor message       | Lex restates the pivotal obstacle + material causes and sets the frame: "good strategy means choosing one approach and deliberately not others — let's work out which cause to tackle and how."                                                                                                                                                                                              |
| 1  | `policyOptions`          | **loop / child entity** | One `PolicyOption` per candidate approach. Lex seeds candidates **per material cause** (toolkit: incentives, rules, transparency, market design, institutional restructuring), argues each **for and against** genuinely; the user reacts, adds, edits. This is where feasibility (held over from Page 2) is evaluated — including whether a cause's own sub-causes must be addressed first. |
| 2  | `chosenApproach`         | reference               | The user commits: this cause, this approach. Remaining options are marked `RULED_OUT` with a reason (the residue of choosing).                                                                                                                                                                                                                                                               |
| 3  | `whatItRulesOut`         | Lex-drafted, editable   | Composed from the RULED_OUT options + reasons; the user confirms/edits. Never asked cold.                                                                                                                                                                                                                                                                                                    |
| 4  | `leverage`               | text                    | Why this approach hits the pivotal obstacle specifically — the asymmetry it exploits.                                                                                                                                                                                                                                                                                                        |
| 5  | `anticipatedResponses`   | structured              | Avoidance, gaming, enforcement burden, legal challenge, **political attack vectors**. Lex proposes; user reacts.                                                                                                                                                                                                                                                                             |
| 6  | `conditionsForSuccess`   | structured              | Testable bets: "for this to work, X must be true." Lex proposes from the evaluation; user confirms/adds.                                                                                                                                                                                                                                                                                     |
| —  | → `summaryGuidingPolicy` | Lex-generated           | The approach, its leverage, what it rules out and why, anticipated responses, conditions.                                                                                                                                                                                                                                                                                                    |

`PolicyOption` **table:** `{ id, ideaId, approach, mechanismTypes[], targetCauseIds[], caseFor, caseAgainst, status: CANDIDATE | CHOSEN | RULED_OUT, ruleOutReason, source: USER | LEX }`. Link-to-diagnosis is structural (`targetCauseIds`), no longer a question. Mechanism types live per-option, not as a page field.

***

## 18. Page 4 — Coherent Actions + the costing shell

### 18.1 Fields

**Actions loop** (`CoherentAction` records, one per action): `practicalStep`, `mechanismType`, `whoImplements`, `targetOrganisation` *(legislative actions)*, `wording` *(legislative actions — capture intent now; precise section-level drafting graduates when the AMENDABLE_SECTION search intent matures)*, `benefits` *(financial / social / ongoing — ranges + basis)*, `costs` *(§18.2 structure)*.

**After the loop:**

-   `coherenceCheck` — Lex-run commentary: mutual consistency, **concentration** (focused or smeared?), and **sequencing** (what must precede what; chain-link dependencies). No new user labour.
-   `costSummary` — aggregated totals (§18.3) set against the **Page 2 problem cost**: "the problem costs \~X/yr; this plan costs \~Y one-off + Z/yr." The proposal's cost-benefit spine.
-   → `summaryCoherentActions` (Lex-generated).

### 18.2 Cost structure (per action)

Three categories, replacing the generic net-cost fields:

| Category             | Meaning                                                | Falls on          |
|----------------------|--------------------------------------------------------|-------------------|
| `implementationCost` | One-off cost to set up (systems, guidance, transition) | Government        |
| `enforcementCost`    | Ongoing cost to police and administer                  | Regulator / state |
| `regulatoryFriction` | Ongoing compliance burden imposed on those regulated   | The economy       |

Each stored as `{ low, high, unit, basis, benchmarkId?, userOverride? }` — a **range with a stated basis**, optionally tied to a benchmark record (§18.3), optionally overridden by the user with their own evidence.

### 18.3 The costing engine — pilot architecture

**Principle: every number is transparent, sourced, and challengeable.** Nothing outputs an unexplained figure.

-   `CostBenchmark` **table (the contract — built now, populated by research):** `{ id, domain, metric, unit, low, high, source, sourceUrl, year, method, notes }`. Examples of what will live here: HM Treasury **Green Book** appraisal values (the government's own manual for valuing costs and benefits), **QALY** values (quality-adjusted life year — how the NHS prices a year of healthy life, \~£20–30k range historically), value of a prevented fatality, value of time, standard admin- burden costs, unit-cost databases for social outcomes.
-   `IdeaAssumption` **table:** `{ id, ideaId, benchmarkId, userValue, userEvidence }` — the user's overrides, with their evidence, kept alongside the defaults. This is the **transparent project space**: the briefing/ report shows which numbers are defaults, which are overridden, and every source link.
-   **Estimator flow:** Lex helps the user pick benchmarks per action, produces indicative **ranges** flagged as estimates, aggregates per §18.1, and always shows its working.
-   **Research programme (runs in parallel, outside CC's build):** **Phase 1 — scoping (CCh task, next deliverable):** survey the field — Green Book + supplementary guidance, NICE/QALY practice, departmental appraisal values, the Regulatory Policy Committee and published impact assessments (many already in the corpus), unit-cost databases — and deliver `COSTING_SCOPE.md`: the benchmark schema validated against reality, the source list, and how corpus + web research feed it. **Phase 2 — build the benchmark set:** systematic extraction into `CostBenchmark` rows (corpus first — past impact assessments are gold — then web), each row sourced. Gated on Phase 1. The sprint below builds the **shell** (tables, per-action capture, aggregation, override UX) with a small hand-seeded benchmark set so the flow is testable before Phase 2 lands.

***

## 19. CC Brief — Sprint 3: the full kernel (Pages 2 refinements + 3 + 4)

**Goal:** complete the kernel end-to-end so Charlie can evaluate the whole process: §16 (Page 2 refinements, causal tree, method layer), §17 (Guiding Policy), §18 (Coherent Actions + costing shell).

**Why one sprint:** the field machine is proven multi-page; Pages 3–4 are mostly config + child entities + prompts on existing patterns. Execute **§16 → §17 → §18 sequentially** (each section's acceptance verified by smoke before the next begins), one `commit-all.sh` at the end. Un-promoted preview. Usual git discipline. Record new rules in `LEX_PLAYBOOK.md`.

### Task 1 — Method layer (§16.3)

`lib/lex/method.ts` with the four blocks **verbatim from §16.3**; conductor/lex-route injects M-GENERAL + the active stage's block into the system prompt. `// Blocks are maintained in the design doc §16.3 — edit there first, mirror here.`

### Task 2 — Page 2 refinements (§16.1)

`classification` enum on `DiagnosisCause` (+ UI chip on each cause; Lex presses for the call); `rootCause` selects among MATERIAL causes; reframed who's-affected hints; `beneficiariesOfStatusQuo` slot in `pivotalObstacle`'s structured value + Lex asks cui bono there.

### Task 3 — Causal tree (§16.2)

`parentCauseId` self-FK on `DiagnosisCause` (additive, idempotent SQL to Neon — not db push); List \| Map toggle in the causes field; Map = Mermaid render of the tree (client lib; check for an existing diagram dependency before adding one), nodes clickable, "add cause beneath this", material nodes visually distinct; Lex can propose chains ("X because Y because Z") creating linked records; soft depth cap 4 with a consolidation nudge.

### Task 4 — Page 3 (§17)

`page3-config.ts`; `PolicyOption` table + CRUD + route; Lex option-seeding per material cause (gateway intent `POLICY_ALTERNATIVES` — add to §14.2 vocabulary; flag-gated like the others, corpus-seeded where useful); choose/rule-out semantics; `whatItRulesOut` Lex-drafted from RULED_OUT records; crystallise fields; `summaryGuidingPolicy`. Conductor extension under save-before-advance. Orientation message per §17.

### Task 5 — Page 4 (§18)

`page4-config.ts`; `CoherentAction` records with the §18.2 cost structure; `CostBenchmark` + `IdeaAssumption` tables (additive SQL); hand-seed \~10 plausible benchmark rows (clearly marked `method: "placeholder — Phase 2 research pending"`) so the flow is testable; estimator capture + aggregation + `costSummary` vs Page 2 problem cost; coherence check incl. concentration + sequencing; `summaryCoherentActions`; page transition CTAs (Diagnosis→Guiding Policy→Coherent Actions, same pattern as §15 Task 4).

### Acceptance criteria

-   End-to-end on the preview: Orientation → Diagnosis → Guiding Policy → Coherent Actions with save-before- advance throughout and no dead-ends (skip paths included).
-   Causes: classifiable, tree-buildable to depth 4, Map view renders and edits; root cause selectable at any depth among material causes.
-   Page 3: options seeded per material cause with genuine for/against; choosing marks the rest RULED_OUT with reasons; `whatItRulesOut` composes from them; summary states approach, leverage, ruled-out, anticipated responses (incl. political attack vectors), conditions.
-   Page 4: costs captured as ranges with basis; benchmark picker + user override with evidence works; totals aggregate and compare against the Page 2 problem cost; coherence check names concentration + sequencing.
-   Method blocks demonstrably in the prompt per stage (visible in [lex-diag] logging).
-   Editing prompts/method text cannot break mechanics (per §4).

**Git discipline:** no git mid-sprint; one `commit-all.sh` at the end; Charlie validates on the preview; CC runs it once and deletes it; commit to `Main`. Do **not** promote.
