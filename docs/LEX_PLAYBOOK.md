# LEX PLAYBOOK — as-built operational reference

*The operational companion to `LEX_REBUILD_DESIGN v.1.md` (the spec). The design doc says
**why** and **what**; this says **how it is wired and how to work on it**. The Lex equivalent of
`INGEST_PLAYBOOK.md`. Update this whenever the conversation layer changes.*

**Status:** Page 1 (Orientation) shipped — Sprint 1 (state layer + panels) + Sprint 1.1 (orchestration)
+ Sprint 1.2 (markdown background, intro reword, failure logging) + **Sprint 1.3** (save-before-advance
guards §3a, "How this works" tour §3b, `preferredName ?? firstName`). Pages 2–4 (Diagnosis / Guiding
Policy / Coherent Actions) and real FTS are later sprints (design §11).

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
  page1-config.ts    field SoT (keys, type, scope, origin, hints, fallback question) + canonical-state types + SearchResult interface
  state.ts           computeCanonicalState (§3.3); currentField = first non-terminal; stage→DIAGNOSIS + unlock on complete
  field-machine.ts   transitions (submitBox/setProposal/acceptField/skipField/reopenField), mirrors, storeExtracted, fireSearchTrigger, initializeFieldStates
  lex-client.ts      Gemini structured output (responseSchema) + buildLexSystemPrompt + runLexTurn (validate+retry)
  proposal-schema.ts per-field zod validation
  orchestrator.ts    orchestrateAfterWrite — the conductor (§13)
  search-stub.ts     stub SearchResult[] + Initial Background prose
  authz.ts           owner/collaborator auth for an idea
app/api/ideas/[id]/
  state/route.ts     GET canonical state
  lex/route.ts       POST one Lex turn (sets proposal for the current field)
  fields/route.ts    POST transition (submitBox|accept|skip|reopen) → conduct → {state, messages}
components/lex/       ChatPanel, AcceptCard (Title/Keywords only), FieldsPanel (boxes + proposed-in-box), BackgroundPanel
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

## 9. Extending to Sprint 2 (Diagnosis) — the pattern to copy

1. Add the page's fields to a page config (mirror `page1-config.ts`); give each a `type`, `scope`,
   `origin`, and a fallback `question`.
2. Add child entities where the design calls for a loop (`DiagnosisCause`) — mirror the CoherentActions
   per-row pattern; reuse `IdeaFieldState` for scalar fields.
3. Reuse the field machine + `orchestrateAfterWrite` conductor unchanged — just teach the conductor the
   new page's "what next" rules (one branch per terminal/empty transition).
4. Render from canonical state; never add a counter or a sequence decision to the frontend or Lex.
