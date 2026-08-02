# §19-C — Sprint 3-C: fixes from the 2 Aug end-to-end test + the search-truth incident

**Context.** Charlie walked the full kernel (data-protection idea): Pages 1–3 transitions work, causes and
actions capture works, PolicyOption cards work. Remaining: two truth defects (the stub incident), three
generation breaks (P3 crystallise, coherence check, cost engine), the Diagnosis-stage search design, and
polish. Un-promoted preview; usual git discipline; one `commit-all.sh`; do **not** promote. Record rules in
`LEX_PLAYBOOK.md`. Where a task says *diagnose*, pull `[lex-diag]`/data first and record the found cause in
the CHANGE_LOG before fixing.

---

## Task 0 — Clear the contaminated idea (immediate)

Per your trace offer: on idea `06ca807a` delete the stub `legislationRefs`, the road-traffic briefing
document, and the three seeded road-traffic causes. Re-run the briefing **only after** the FTS latency work
lands (otherwise the same timeout reproduces the same substitution).

## Task 1 — Truth and fallback (the stub incident, generalised)

1a. **No silent stub in production.** `runStubSearch` as a timeout/failure fallback manufactured false
statements of law. Remove it from the production path: on FTS timeout or error, store an honest empty result,
panel shows "The corpus search didn't complete — [Retry]", and Lex says so plainly. Stub remains available
only behind an explicit dev env flag. `// An honest "no answer" is always safer than plausible wrong law.`

1b. **The never-claim invariant (extends 3-B §12).** Lex's chatText must not assert that content exists, was
written, or was found unless the state says so. Mechanism, not vibes: the conductor/lex route injects a
"facts of this turn" block (what was persisted, what the panel now contains, what searches ran and their
result counts) and the prompt instructs Lex to describe only those facts. The 3-B live failure ("You'll find
an overview in the panel" — pointing at stub data it never checked) and the P3 failure ("I've pulled some
options" before any existed) are the same defect.

1c. **Mid-chat research requests.** Currently /lex runs no search at all, so "can you research X in the
corpus" gets pretence. Add conservative server-side detection (explicit research/search/corpus phrasing —
same conservatism as typed assent) → gateway intent `AD_HOC_RESEARCH` → results appended to the RH panel
under "Your research" (reference-only, as everywhere) → Lex gives a two-sentence overview. Where detection
doesn't fire, Lex's prompt must have it *decline honestly* ("I can't run a corpus search from here yet — the
panel search runs at each stage") rather than improvise.

## Task 2 — Diagnosis-stage focused search (Charlie's points 4–5)

On stage entry to DIAGNOSIS (inside `performStageAdvance`):
- The Initial Background folds to a show/hide line (available, not dominant).
- Fire a deterministic gateway search, new intent `LEGAL_LANDSCAPE`, query built from accepted signals
  (keywords + idea narrative; **refresh once `challenge` is accepted** — the challenge is the best signal).
  Web-orientation informs query construction when its flag is on; debates are treated as an orientation
  source for *finding* the laws discussed, per the design intent.
- RH panel renders grouped sections: (a) possible relevant legislation · (b) relevant principles appearing in
  other legislation · (c) relevant debates · (d) committee hearings · (e) anything else relevant.
- **Storage is references only** (ids/citations/urls/snippets — the existing `legislationRefs` pattern; no
  full-text copied into the ideas DB). Lex posts a brief, intelligent overview of what it found and how it
  bears on the next steps — grounded in the actual result set (Task 1b).
- Same pattern repeats at GUIDING_POLICY and COHERENT_ACTIONS entry with stage-appropriate intents
  (`POLICY_ALTERNATIVES`; the actions stage reuses `LEGAL_LANDSCAPE` results until the amendable-section
  intent matures). RH panel is stage-aware: prior stages' results fold like the background does.

## Task 3 — Page 3 fixes

- **Stale RH panel** (screenshot: road-traffic background still dominating during Guiding Policy) — resolved
  by Task 2's stage-awareness; verify explicitly on replay.
- **Claims before records** — Lex announced options before any existed; Task 1b covers the mechanism, verify
  here: the conductor announces options only after `PolicyOption` rows persist.
- **Card layout:** each option card = **Title / Detail / For / Against**; collapsed state shows title only,
  click to reveal; add / edit / delete / ignore retained.
- **Chosen approach** rendered bold + stage-accent highlighted — unmistakably the next action.
- **Lex's GP orientation** must reiterate the Rumelt aim succinctly and *tied to this discussion* — name the
  user's actual material causes and obstacle when framing the choice (M-GUIDING-POLICY is injected; the
  conductor message must use the idea's specifics, not generic method talk).

## Task 4 — P3 crystallise generation broken (diagnose first)

After the choice, nothing was proposed for the Lex-drafted fields (`whatItRulesOut`, `leverage`,
`anticipatedResponses`, `conditionsForSuccess`, `summaryGuidingPolicy`). Pull `[lex-diag]`: did the conductor
fire the generation step at all; did Lex return proposals that failed schema; or is the dispatch missing for
these field kinds? Fix per §17: `whatItRulesOut` composes from RULED_OUT records; each crystallise field
arrives as a proposal for review; summary generated when priors are terminal.

## Task 5 — Coherence check broken (diagnose first)

Same diagnosis discipline: why did the coherence step produce nothing? Then implement to spec — an
experienced-voice review posted as Lex commentary before `summaryCoherentActions`:
gaps ("have you considered…"), flaws and failure modes, **flag any action missing an implementer or with an
unclear step**, a suggested order of events (sequencing/chain-links), concentration, and the closing test:
*do these actions actually defeat the diagnosed causes and obstacle — and how?* Where the corpus offers
general how-things-go-wrong principles (committee post-mortems, PIR-type material), ground it via the gateway
(flag-gated); otherwise the structured review stands alone.

## Task 6 — Cost engine v0 (line-item capture; supersedes the un-called estimator flow)

Nothing currently fires. Build the simple version Charlie specified and evolve from there:
- New child records: `CostLine { id, actionId, label, costType: STAFF|CAPITAL|PROPERTY|RESEARCH|OTHER,
  category: IMPLEMENTATION|ENFORCEMENT|FRICTION, staffLevel?: JUNIOR|MID|SENIOR, fteCount?, durationMonths?,
  low, high, basis, benchmarkId? }`.
- UX: for each Coherent Action, an add-a-cost-line-at-a-time flow (RH panel walks the action offering cost
  types; lines list under the action; edit/delete). **Staffing lines auto-suggest unit costs from the seeded
  ASHE wage benchmarks** (junior/mid/senior mapping recorded in the playbook); other lines take amounts with
  a stated basis; benchmark picker assists, never auto-asserts.
- Aggregation retained from §18: lines roll up per action → the three categories → `costSummary` set against
  the Page 2 problem cost, uprated to a common price year. EANDCB flag when friction crosses ±£5m/yr.

## Task 7 — UX polish

- **Save button state:** grey until the box is edited (dirty), then black. *Save & accept* (a pending Lex
  proposal) stays black — it genuinely awaits a press.
- **Exit:** button next to "How this works", left-aligned. Single **Exit** (no Save & Exit — simpler): if
  unsaved edits exist, prompt "Save changes before leaving?" [Save & exit / Discard / Stay].
- **Deletable seeded records:** cause cards (and all Lex-seeded child records generally) get edit + delete.
  The three road-traffic causes being undeletable is the live case.

## Acceptance criteria

- FTS failure on the preview shows the honest empty state + Retry; no road-traffic law can appear in a
  data-protection idea by any path.
- "Research X in the corpus" mid-chat returns real grouped results or an honest decline — never pretence.
- Entering Diagnosis folds the background and populates the five grouped landscape sections from a real
  search; refreshes on challenge accept; GP and Actions entries do their stage equivalents.
- P3: options render before Lex mentions them; cards collapse to titles; chosen approach visually
  unmistakable; all five crystallise fields arrive as reviewable proposals.
- Coherence commentary appears and names at least: any missing implementer, a suggested sequence, and the
  actions-vs-causes test.
- Each action can carry multiple cost lines; staffing lines pull ASHE suggestions; totals roll up to the
  three categories and compare against the problem cost.
- Save buttons behave per state; Exit present with unsaved-check; seeded causes deletable.
- Every found cause for Tasks 4/5 (and the Task 1 mechanism) documented in CHANGE_LOG.

**Out of scope, parked:** the FTS compaction/latency work (search workstream — prerequisite for re-running
Task 0's briefing); the publish/output layer (Charlie's point 13 — being designed as §20).
