# BRIEF — Restart: verify 3-D, then build the Deepening (Pilot A)

**Thread:** Lex/UX. **Date:** 12 Aug 2026. **Context:** the laptop restarted after Sprint 3-D was pushed
(44cdb71..483c65b, verified on origin/Main) but **before its browser walkthrough** — the one step §19-D made
mandatory. This brief closes that gap, then builds the Deepening stage.

Production (Main auto-deploys). Shared tree: scoped `git add` paths only; commit script named
`commit-deepening.sh`; re-read shared docs before appending; usual end-of-sprint git discipline.

---

## §0 — Re-orientation and filing (15 minutes)

1. Boot files per `CLAUDE.md`: `handoff_summary.md` top section is current (Ingest V34 and Search 2C-5 have
   landed since your last session — read both entries; V34 matters directly to this brief, see §3).
2. `git status` / `git log` — confirm the tree carries nothing of yours uncommitted; the concurrent Central
   session has pushed since, which is expected.
3. **File the design docs** if not already in `docs/`: `LEX_DESIGN_ADDENDUM_22-23.md` (§22 Review &
   Deepening, §23 reading mode) and `LEX_DESIGN_ADDENDUM_24.md` (credibility redesign). Charlie has both if
   absent. **§24 supersedes §22.3** — there is no depth thermometer and no star rating anywhere in this
   build; §22's passes, issues list and known-unknowns invariant stand.
4. `whichdb` before any DB work, as always.

## §1 — Finish Sprint 3-D: the browser walk (blocking; fix-in-place)

Reconnect the Chrome extension (`list_connected_browsers` must return a browser; if it will not connect,
say so and Charlie drives while you watch logs). Walk, and fix in place anything that fails:

- **9a** Save & exit: saves, spinner while it waits, then actually leaves.
- **9e** material/contributory renders as an obvious choice on each cause card.
- **9f** option cards collapse to title + status + chevron; expand on click.
- **9g** a cause named in chat lands on the loop as a proposal.
- **9h** the quiet "run this search again" link under the briefing.
- **Task 3** "Work on this" on a completed stage moves chat + right panel + save path there together, and
  returning does not disturb later stages.
- **2a** no "Proposed by Lex" badge ever renders over an empty box.
- **Task 1** enter a solution as the problem ("I want to change the amount charged for plastic bags") —
  Lex asks what problem it solves and proposes the problem back; two presses max.
- Legislation links in the briefing panel open (spot-check 5).

Report the walk's results in the CHANGE_LOG before starting §2.

## §2 — The Deepening, Pilot A

### 2.0 What it is (one paragraph, from §22)

The kernel produces a skeleton. Deepening turns it into something that survives scrutiny: **Lex does the
heavy lifting; the user does the judging.** Each *pass* runs as a background gather over corpus + statistics,
producing **findings** (evidence, precedents, comparisons) and **issues** (specific, addressable gaps),
which the user then works through — accepting findings into an evidence layer, resolving issues with Lex.
Entirely voluntary, any pass, any depth, re-runnable.

### 2.1 Architectural invariants (non-negotiable)

1. **A separate evidence layer.** Deepening writes `EvidenceItem` records that **reference** canonical
   fields; it never writes field values. Any change to a field's own content goes through the normal save
   path (proposal → AWAITING_CONFIRMATION → user Save). `// Mixing these reintroduces the multi-source-of-
   truth condition the rebuild removed.`
2. **Known unknowns is an invariant, not a section.** Every pass reports what it searched for and could not
   find, as first-class output. A pass that omits its gaps has failed.
3. **Never-claim applies in full.** A pass that retrieved nothing says so; findings carry their sources;
   the run status shown is the run status stored.
4. **Background gather, guided judgment.** Runs are async (minutes are fine — this is not the interactive
   path); nothing is presented to the user until it is persisted; the user's accept/reject/resolve actions
   are all synchronous and ordinary.

### 2.2 Schema (additive, idempotent SQL; app DB)

```
DeepeningPass    { id, ideaId, passKey, status: NOT_RUN|RUNNING|RUN|FAILED, runVersion Int,
                   startedAt?, completedAt?, failureReason?, knownUnknowns Json }
EvidenceItem     { id, ideaId, passKey, runVersion, fieldRef?,            // e.g. "causes:<causeId>", "challenge"
                   kind: FINDING|PRECEDENT|SUPPORTS|CONTRADICTS|COMPARISON,
                   title, body Text, sourceType?, sourceId?, citation?, url?,
                   status: PROPOSED|ACCEPTED|REJECTED, createdAt }
DeepeningIssue   { id, ideaId, passKey, text Text,
                   status: OPEN|ADDRESSED|DEFERRED|DISMISSED, dismissReason?,
                   resolutionNote?, resolutionEvidenceId?,
                   reviewFindingId?,                                       // §24-ready: review findings land here later
                   createdAt, resolvedAt? }
```

Re-running a pass increments `runVersion`; prior PROPOSED items from older runs are marked superseded
(REJECTED with a note), ACCEPTED items are never touched by a re-run.

### 2.3 The four Pilot A passes

*(Reconciles Charlie's "Legal, Financial, Political first" with the search-thread's Pilot A: the mechanism
makes a pass cheap, so we ship four. Mechanism analogues and the full claims-check pass are explicitly NOT
in Pilot A.)*

| passKey | What the gather does | Intents |
|---|---|---|
| `EVIDENCE_PRECEDENT` | Evidence the diagnosis (is the problem real, how big, who measured it — statistics layer + committee findings), and find precedents: **has this been tried — what was it for (Explanatory Notes), what was predicted (Impact Assessments), what actually happened (evaluations/PIRs)**. The triangulation is a named artefact. | `PRECEDENT`, `CAUSAL_EVIDENCE`, existing `LEGAL_LANDSCAPE` |
| `LEGAL` | What law this touches, in depth: the interlocking provisions, case law on the key sections, **devolved or reserved**, primary vs secondary needed, drafting hurdles. | `LEGAL_LANDSCAPE`, `DEVOLUTION_SCOPE` |
| `FINANCIAL` | Scrutinise the costing: benchmark fit per line, missing cost categories, sensitivity (what moves the total most), the EANDCB position, and precedent costs from IAs where searchable. Mostly reasoning over existing cost lines + benchmarks. | `PRECEDENT` (cost-focused) |
| `POLITICAL_RISK` | Who resists and on what grounds; the attack lines and their strongest form; what killed similar attempts — grounded in Hansard debate and committee material now in the corpus. *(Position-graph enrichment is a later flag.)* | `CAUSE_SEEDING`-style debate retrieval |

**Gateway:** add intents `PRECEDENT`, `CAUSAL_EVIDENCE`, `DEVOLUTION_SCOPE` to §14.2 (descriptive, routed
like the others; `MECHANISM_ANALOGUE` stays reserved). For `CAUSAL_EVIDENCE`, findings are typed
SUPPORTS / CONTRADICTS / (silence → a known unknown) — **a CONTRADICTS finding is as valuable as a SUPPORTS
one and must never be filtered out.**

### 2.4 Run mechanics

- `POST /api/ideas/{id}/deepening/{passKey}/run` starts a run (one active run per idea); status by polling
  the pass record; `maxDuration` set on the route; the gather persists findings/issues incrementally so a
  timeout loses the tail, not the run — and a partial run is marked FAILED with what it managed kept.
- Each pass = **configuration**: a method block (below), an intent set, and issue templates. Adding pass
  five later must be config, not construction — that is the acceptance test of the mechanism.

### 2.5 UI

- A **Deepening** stage section in the middle panel after Coherent Actions (unlocks when the kernel's four
  stages are complete; the stage label per §24.1 moves Skeleton → Deepened when at least one pass is RUN
  and its issues triaged).
- Per pass, a card: **training panel** (copy below, collapsible), workflow chip (*Not run · Running ·
  Run — n findings, m issues open*), **Run** (and **Re-run**), then:
  - **Findings list** — each with source + citation; Accept / Reject. Accepted items render under the field
    they reference (read-only evidence chips on the field card) and in the future evidence annex.
  - **Issues to-do** — each: **Address** (opens a focused chat thread with the issue as context; resolving
    attaches a note and optionally an EvidenceItem, or hands into the normal field-edit path), **Defer**,
    **Dismiss with a reason** (reason required; dismissed issues remain visible).
  - **Known unknowns** — always rendered, even when empty ("nothing was unfindable" is itself information).
- Right panel: while a pass is open, show that pass's retrieval (same grouped renderer).
- **Evidence facts strip** on the idea header (owner-visible now; public with §20-D): issues raised /
  resolved / open · known unknowns declared · sources by type · last deepening run. **No aggregate score
  anywhere.**

### 2.6 Training-panel copy (verbatim; one per pass)

- **Evidence & precedents:** *"This pass checks whether the problem is real and measured, and whether
  anything like your proposal has been tried. For each precedent it assembles three things almost nobody
  compares: what the measure was for, what it was predicted to cost and achieve, and what actually
  happened. Expect it to find gaps — a gap named is a strength, not a failure."*
- **Legal:** *"This pass maps the law your idea touches: which Acts and rules interlock, how courts have
  read the key provisions, whether the subject is devolved, and whether your change needs primary
  legislation or could be done by regulation. The last question matters most — if a Minister can already
  act, your proposal may not need a new law at all."*
- **Financial:** *"This pass stress-tests your numbers the way the Treasury would: are the benchmarks the
  right ones, what's missing, which assumption moves the total most, and what similar interventions
  actually cost. Ranges with stated sources beat confident points."*
- **Political risk:** *"This pass anticipates the opposition: who loses from your proposal, the strongest
  form of the attacks it invites, and what killed similar attempts before. A proposal that has answered the
  hostile case in advance is what survives committee."*

## §3 — Dependencies and flags (read before building)

- **V34 changes this brief's fuel supply:** Impact Assessments (18,759 sections), consultations and
  division votes are now **ingested but NOT searchable** — no `corpus-map` type, absent from FTS/vector
  indexes. Typing + index build is a **Search-thread decision in flight**. Until it lands, `PRECEDENT`
  retrieval runs against what is searchable and **declares the IA gap as a known unknown on every
  EVIDENCE_PRECEDENT run** — never silently. Wire nothing that assumes the IA corpus is reachable; when
  Search types it, the pass improves with zero changes here.
- **Check and report:** do `explanatory-notes` and any PIR/evaluation corpora exist in `corpus_sections`?
  One query; the answer goes in the CHANGE_LOG and to the Ingest thread — it decides whether the
  triangulation is two-legged or three-legged for now.
- Political-risk retrieval uses Hansard/committee (searchable); division votes join when typed.

## §4 — Acceptance criteria

- §1 walk done first, results logged, failures fixed in place.
- A pass runs in the background, survives its own timeout with partials kept, and its status never lies.
- Findings carry sources; CONTRADICTS findings appear; every run renders a known-unknowns block; the
  EVIDENCE_PRECEDENT runs name the IA gap until Search closes it.
- Accepting a finding attaches evidence to the referenced field **without touching the field's value**;
  editing a field still goes through the normal save path (checked by a script, not by intention).
- Issues: address / defer / dismiss-with-reason all work; dismissed stay visible; an addressed issue can
  attach its resolution.
- Re-run increments `runVersion`, supersedes old PROPOSED items, never touches ACCEPTED ones.
- Adding a fifth pass is demonstrably configuration (show the diff shape in the CHANGE_LOG).
- Evidence facts strip renders counts only — grep-check that no aggregate score or star exists.
- Browser-verified end to end, per the standing CLAUDE.md rule.
