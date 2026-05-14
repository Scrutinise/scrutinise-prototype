# V2-LEX-FLOW-AND-LEGPANEL — CC Brief

**Sprint:** V2-LEX-FLOW-AND-LEGPANEL **Scope:** Two related workstreams: (A) fix three bugs in the Lex field-sequence flow exposed by live testing; (B) revive and build the LegislationPanel originally designed in V2J/V2.5 but paused when V2.75 began. **Estimated size:** Medium. The Lex flow fixes are surgical (prompt + frontend guard). The LegislationPanel is a moderate component build with API and Lex-trigger plumbing — but it was already fully specified in a V2J brief that exists, so the work is mostly execution rather than design.

***

## Context

Charlie tested the full Stage 1 flow on a cycling-related idea and recorded three bugs in screenshots:

1.  **Lex skipped a field.** After confirming "What's the Challenge?", Lex jumped straight to "How Will We Solve It?", silently missing "What's Causing It?". The user had to prompt "I think you've missed a field" before Lex backtracked.
2.  **Lex stalled with fields outstanding.** After confirming Idea Type and Government Area, Lex said "We've now captured the basic shape of your idea…" and stopped — even though 2 of 7 fields were still unfilled ("Who's Affected" and "Proposed Wording"). It treated mid-flow checkpoint commentary as a conversation endpoint.
3.  **Lex jumped into evidence base out of sequence.** After being prompted to continue, Lex skipped "Who's Affected" and went straight into asking for research and evidence — the wrong field entirely.

All three bugs are variations of the same underlying issue: **Lex is not strictly bound to advance through** `FIELD_SEQUENCE` **in order, one field at a time, without pausing for user prompting.**

Additionally, Charlie wants the **LegislationPanel** (originally designed in conversation chat `5cd26b1c-f376-45bd-b99b-67adb689a359` on 24 April 2026, sprint codename V2J-B2/C1, paused when V2.75 began) to be revived and built in this sprint. The design is complete; the work is execution.

***

## Workstream A — Lex flow fixes

### A1 — Strengthen field-sequence enforcement in the system prompt

In `lex_system_prompt_v5.2.md` (or whichever version is currently in `buildSystemPrompt` in `app/api/ai/[ideaId]/route.ts`), add a new top-level section above LEX MODE BEHAVIOUR titled **"FIELD SEQUENCE — ABSOLUTE RULES"**.

Content (verbatim):

>   FIELD SEQUENCE — ABSOLUTE RULES

>   The platform exposes a strict ordered list of fields (`FIELD_SEQUENCE`) for each idea. You MUST follow these rules without exception:

>   **Always work on the lowest-indexed unfilled field.** Identify the current target field by scanning `FIELD_SEQUENCE` in order and selecting the first one that is empty or has no substantive content. That is your only permitted target.

>   **Never skip a field.** Do not write to, propose to, or move the conversation toward a field whose index is higher than the current target while the current target is unfilled. Skipping a field is a critical error.

>   **Never stall mid-sequence.** After a field is confirmed and saved, you MUST immediately formulate and ask the question for the next unfilled field in the same response. Do not pause for the user to prompt you. Do not summarise progress mid-flow. Do not say "we've now captured…" or similar phrases unless every field in `FIELD_SEQUENCE` is filled.

>   **Summary commentary is reserved for completion.** A statement like "We've now captured the basic shape of your idea" is only permitted when every required field is non-empty. Until then, every field-confirmation message ends with the next question.

>   **If the user introduces material relevant to a later field, acknowledge briefly and defer.** Example: if during the Diagnosis the user says "and obviously this affects pedestrians most", Lex notes it ("I'll come back to who's affected when we get there") but does NOT write to that field yet.

>   **Self-check before sending.** Before producing any response, ask yourself: "What is the lowest-indexed unfilled field, and am I asking about it?" If the answer is no, regenerate.

### A2 — Frontend guard against out-of-sequence field writes

In `app/api/ai/[ideaId]/route.ts`, in `applyFieldUpdatesAndSave` (the function that parses Lex's `fieldUpdates` JSON block and writes to the database):

Before applying any `fieldUpdates`, compute the current target field index:

```typescript
const currentTargetIndex = FIELD_SEQUENCE.findIndex(field => {
  const value = currentIdea[field.dbColumn];
  return !value || (typeof value === 'string' && value.trim().length === 0);
});
```

For each entry in `fieldUpdates`, look up its index in `FIELD_SEQUENCE`. Reject any update whose index is **greater than** `currentTargetIndex` (i.e. an update writing ahead). Apply updates at or below `currentTargetIndex` as normal.

When an update is rejected, log it (`[V2-LEX-FLOW] Out-of-sequence update rejected: field=X, currentTarget=Y`) and append a system note to the Lex conversation context for the next turn:

>   "NOTE: The previous response attempted to write to field '{rejected_field}' but the current target field is '{current_target}'. Please ask about '{current_target}' in your next response."

This creates a closed-loop self-correction without requiring the user to notice.

### A3 — Eliminate "checkpoint stall" responses

Search Lex's system prompt for any encouragement to provide mid-flow summaries (e.g. "after completing a section, summarise what's been captured so far"). Remove or rewrite to ensure summaries happen only at stage transitions.

If the prompt contains language like "celebrate progress" or "acknowledge what's been done", reframe it so the celebration happens *as part of the next question* rather than as a standalone summary turn. Example rewrite:

>   Old: "After confirming a field, acknowledge what's been captured." New: "After confirming a field, briefly acknowledge it (one short sentence) AS PART OF the same response that asks the next field's question. Never end a response after confirmation — always continue to the next field."

### A4 — Acceptance test scenario for the Lex flow fix

After deploying A1–A3, manually walk through a fresh Stage 1 idea:

1.  Start a new idea with the same opening as Charlie's test: a cycling red light enforcement idea.
2.  At every Lex turn, verify:
    -   The field being asked about is the lowest-indexed unfilled field
    -   No fields are silently skipped
    -   Every confirmation message ends with the next field's question, never with a standalone summary
3.  After completing all 7 fields, confirm the final summary message appears only at that point.

If any of the three bugs reappear, the fix is incomplete — flag rather than ship.

***

## Workstream B — LegislationPanel (revived from V2J)

The V2J brief (in conversation `5cd26b1c-f376-45bd-b99b-67adb689a359`) defined this component in detail. Reproducing the spec here for self-containment.

### B1 — `LegislationPanel.tsx` component

Create `components/LegislationPanel.tsx` with the following interface:

```typescript
interface LegislationPanelProps {
  results: LegislationResult[]
  isOpen: boolean
  onClose: () => void
  currentCoherentActionId: string | null
  ideaId: string
  onLinkSaved: () => void
}

interface LegislationResult {
  legislationItemId: string
  legislationGovUkId: string
  actTitle: string
  sectionNumber: string
  sectionTitle: string
  compiledText: string  // fetched from R2 via compiledTextKey
  isTnaVerified: boolean
}
```

Panel structure (slide-over from the right, full height, \~420px wide on desktop, full width on mobile):

1.  **Header**: "Relevant Legislation" heading + close button (`bg-foreground text-background` style matching the existing Back to chat button).
2.  **Disclaimer banner** (amber/yellow, compact, always visible at the top of the scrollable area):

>   "AI compilation for reference only. Always verify at legislation.gov.uk. Seek professional legal advice for formal work." With a `View on legislation.gov.uk` link to the source.

3.  **For each result**, render a card containing:
    -   Act title + section number + year, e.g. "Equality Act 2010 — s.13"
    -   Section title in bold
    -   Compiled text in a scrollable container (max-height 200px, monospace font, with `isTnaVerified` shown as a small green tick + "TNA-verified" label, otherwise an amber "AI-compiled" label)
    -   A "View on legislation.gov.uk" link (URL constructed from `legislationGovUkId` and `sectionNumber`: `https://www.legislation.gov.uk/{legislationGovUkId}/section/{sectionNumber}`)
    -   A "Change type" selector (radio or dropdown): **Amend \| Repeal \| Add**
    -   A textarea for "Proposed wording" with placeholder "Draft your proposed amendment here…"
    -   An "Attach to this action" button — only visible when `currentCoherentActionId` is set. Calls `POST /api/ideas/[id]/legislation-link` (B3 below).
4.  **If results is empty**: render the disclaimer banner and below it the message "No relevant legislation found in the database. As our legislation corpus grows, more will appear here."

Styling: teal accents for section headings; scrollable within a fixed-height container; slide-in animation from the right (300ms ease-out).

### B2 — Integrate the panel into `CreateIdeaClient.tsx`

Add state for the panel:

```typescript
const [showLegislationPanel, setShowLegislationPanel] = useState(false);
const [legislationResults, setLegislationResults] = useState<LegislationResult[]>([]);
const [legislationLoading, setLegislationLoading] = useState(false);
const [currentCoherentActionId, setCurrentCoherentActionId] = useState<string | null>(null);
```

Render the `<LegislationPanel>` component conditionally on `showLegislationPanel`, positioned as a slide-over on both mobile and desktop (over the main content, with a semi-transparent backdrop on mobile that dismisses on tap).

Add a "Legislation" button to the toolbar (small book/law icon or text "Legislation" in teal). Only visible when `legislationResults.length > 0 || legislationLoading`. Toggles `showLegislationPanel`.

### B3 — `POST /api/ideas/[id]/legislation-link` API route

Create `app/api/ideas/[id]/legislation-link/route.ts`. Accepts:

```typescript
{
  coherentActionId: string
  legislationItemId: string
  sectionNumber: string
  changeType: 'AMEND' | 'REPEAL' | 'ADD'
  proposedWording: string
}
```

Creates a `TargetLegislation` record linked to the specified `CoherentAction`. Validates that the user owns the idea or has edit rights. Returns the created record.

If the `TargetLegislation` schema doesn't yet support these fields (`changeType`, `proposedWording`), add them:

```prisma
model TargetLegislation {
  // existing fields…
  changeType       ChangeType?  // AMEND | REPEAL | ADD
  proposedWording  String?      @db.Text
}

enum ChangeType {
  AMEND
  REPEAL
  ADD
}
```

Migration: `prisma migrate dev --name v2_legislation_link_fields`.

### B4 — Lex search triggers (the three moments)

In `CreateIdeaClient.tsx`, add three trigger moments that call `POST /api/ideas/[id]/legislation-search`:

-   **Moment 1**: After Title and Summary Description are both filled. Search query = title + first sentence of summary. Light-touch: results populated into `legislationResults` but the panel is NOT auto-opened. Instead, Lex is given the top result in its `legislationContext` system-prompt input for the next turn so it can flag it conversationally ("this is likely to involve X Act").
-   **Moment 2**: When the user enters or confirms a root cause within the Diagnosis. Search query = the root cause text. Same handling as Moment 1 — context to Lex, panel not auto-opened.
-   **Moment 3**: After "A Practical Step" is filled for any CoherentAction. Search query = the action text. This is the deep moment: results populated, the "Legislation" button in the toolbar pulses for 2 seconds to draw attention, and Lex's next message explicitly invites the user to open the panel: "I've found legislation that's likely relevant — open the Legislation panel (right side) to see and propose amendments." `currentCoherentActionId` is set to the CoherentAction being worked on so the "Attach to this action" button is enabled.

### B5 — Inject legislation context into Lex's system prompt

In `app/api/ai/[ideaId]/route.ts`:

Extend `MessageSchema` (Zod) to include:

```typescript
legislationContext: z.array(z.object({
  actTitle: z.string(),
  sectionNumber: z.string(),
  sectionTitle: z.string(),
  compiledText: z.string(),
})).optional()
```

In `buildSystemPrompt`, add a `legislationContext` parameter. When non-empty, append a section to the system prompt:

>   RELEVANT LEGISLATION (from corpus search)

>   The following sections may be relevant to the user's idea. Reference them naturally where appropriate; do not list them mechanically.

>   [for each section:] **{actTitle} — s.{sectionNumber}: {sectionTitle}** {compiledText (truncated to 500 chars)}

Lex now has context to reference legislation conversationally without the user having to open the panel.

***

## What is NOT in this sprint

-   **Funding-route guidance** (Appropriation Bills, Spending Reviews, departmental estimates). Charlie flagged this as a real gap exposed by the cycling-enforcement test idea — the user proposed a public safety campaign requiring new money, which is largely a non-legislative pathway. The platform doesn't currently hold the data or guidance to advise on this. **Add to roadmap** (see below).
-   **Appropriation Bills are in the corpus** (they're UKPGA), but the underlying Estimates documents, departmental spending plans, and Spending Review materials are NOT in the corpus — they're published as PDFs on gov.uk and parliament.uk, not as legislation. A separate workstream would be needed to ingest those.
-   The "Legislation" navigation entry visibility. Charlie's question: "the Legislation navigation entry is only visible on my login, right?" — confirm in the CC sprint that this nav item is gated to admin/superadmin users only. If it's visible to all users, that's a leak; raise it as a separate quick fix before the V2-LEX-FLOW-AND-LEGPANEL work ships.

***

## Roadmap additions

Add to `roadmap.md`:

>   **Funding-route guidance for non-legislative ideas.** Many policy proposals require new money or reallocation rather than (or in addition to) statutory change. The platform should be able to recognise this and surface the relevant non-legislative pathways:

>   Departmental Spending Review bids

>   Estimates / Supply and Appropriation Bill line items

>   Departmental Annual Report and Accounts

>   HM Treasury "Green Book" appraisal requirements

>   First step: an information page explaining the funding pathways for users whose ideas need money rather than (or as well as) law. Later: ingest Spending Review documents and Departmental Annual Reports into a parallel corpus to enable Lex to reference current departmental spending and identify realistic funding routes.

>   Target: design after V2-LEX-FLOW-AND-LEGPANEL ships.

***

## Acceptance criteria

**Workstream A:**

1.  A fresh Stage 1 walk-through completes all 7 fields without skipping any.
2.  After each field confirmation, Lex's same response asks the next field's question — no standalone summary turns mid-flow.
3.  If Lex's `fieldUpdates` JSON tries to write to a field ahead of the current target, the update is rejected, logged, and Lex self-corrects on the next turn.
4.  The "We've now captured…" style summary appears only when all 7 fields are filled.

**Workstream B:** 5. The `LegislationPanel` component renders with disclaimer banner, section cards, change-type selector, proposed wording textarea, and Attach button. 6. The Legislation button appears in the toolbar when results are available. 7. The three trigger moments fire and populate results without blocking the chat flow. 8. Lex references legislation conversationally when `legislationContext` is non-empty in the system prompt. 9. Attaching a section to a CoherentAction creates a TargetLegislation record with `changeType` and `proposedWording` correctly saved. 10. The Legislation nav item is gated to admin/superadmin users only (or a separate quick-fix is filed if not).

**Build hygiene:** 11. `tsc --noEmit` clean. Vercel build passes. Prisma migrate runs cleanly.

## Git discipline

CC does **not** call git during this sprint. At the end of the sprint, CC produces `commit-all.sh` in the project root containing:

-   All `git add` commands for files modified
-   A single commit with message `V2-LEX-FLOW-AND-LEGPANEL: Fix Lex field sequence; revive LegislationPanel from V2J`
-   `git push origin Main` (capital M)

Charlie reviews the Vercel preview deployment. After Charlie approves, CC executes `commit-all.sh` immediately, then deletes it.
