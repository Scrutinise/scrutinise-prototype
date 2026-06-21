# LEX PLAYBOOK — as-built operational reference

*The operational companion to `LEX_REBUILD_DESIGN v.1.md` (the spec). The design doc says
**why** and **what**; this says **how it is wired and how to work on it**. The Lex equivalent of
`INGEST_PLAYBOOK.md`. Update this whenever the conversation layer changes.*

**Status:** Page 1 (Orientation) shipped — Sprint 1 (state layer + panels) + Sprint 1.1 (orchestration).
Pages 2–4 (Diagnosis / Guiding Policy / Coherent Actions) and real FTS are later sprints (design §11).

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

---

## 4. Lex output contract (design §4)

Gemini structured output (`responseMimeType: application/json` + `responseSchema`) → `{ chatText,
proposal, extracted }`. The server **validates `proposal.value`** against the field's zod schema
(`proposal-schema.ts`); on failure it **discards the proposal, keeps `chatText`, retries once**. Lex can
never half-advance state. `proposal.fieldKey` is constrained to the five Page-1 keys; `valueText` for
narratives/title, `valueList` for keywords.

Editing the Lex prompt (`lib/lex/lex-client.ts → buildLexSystemPrompt`) changes only `chatText`/proposal
quality — never the mechanics. (Known prompt nit to tidy whenever: Lex sometimes thanks the user.)

---

## 5. Search trigger + Initial Background (design §8)

Deterministic, platform-owned: on **keywords accept**, `fireSearchTrigger` runs the search and writes
`Idea.legislationRefs` (`SearchResult[]`) + a `Document(kind:'INITIAL_BACKGROUND')`, then Lex posts a
one-line pointer. **Stubbed now** (`lib/lex/search-stub.ts`) shaped *exactly* as the §8.3 `SearchResult`
interface — wiring real FTS in Sprint 3 is a one-line source swap. Grouped ≤3 per type, capped ~20.

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
