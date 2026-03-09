# CC BRIEFING — NEXT SESSION
*Produced by CCh — Charlie must save this before issuing to CC*
*Date: 09-03-26*

---

## WHAT HAS CHANGED SINCE LAST CC SESSION

### 1. Entity list is now v4 — READ THIS FIRST
`/docs/entity_list_v4.md` replaces `entity_list_v3.md` (archived).

**Key changes CC must know:**

**CommentRating entity — completely redesigned.**
The old fields (constructive/insightful/valuable boolean fields + constructiveScore INT) are gone. The new design is a two-column popup:
- LEFT column "Constructive": tickboxes for `positiveFlags` JSON array
- RIGHT column "Unhelpful": tickboxes for `negativeFlags` JSON array  
- Plus `note` free text field
- Plus `disputeStatus`, `disputeRaisedByUserId`, `disputeVerdict` for the dispute flow
- Each negative flag has an "i" tooltip in the UI (linked to FAQ)
- Rating weight: the single most credible rater's assessment determines Thinker points impact (no pile-on weighting)
- NO sliders, NO numeric scores per flag — checkboxes only

**CredibilityScore is the canonical name.** InfluenceScore is retired. They are the same entity.

**User.mobile is required** (not nullable) for registration.

**BroadcastMessage** now has: `requiresCoSignatory`, `coSignatoryUserId`, `coSignedAt`, `status` (DRAFT/PENDING_COSIGN/SENT/RECALLED), `recalledAt`, `recallReason`.

**Idea.Basic Info fields** confirmed for Stage 1 Create screen:
- title
- summaryDescription
- summaryDiagnosis
- summaryGuidingPolicy  
- summaryCoherentActions
- ideaType (LEGISLATION or ORGANISATION)
- govtArea
- connectedIdeas (optional)

**Strategic Kernel fields** (Phase 2) — when AI is OFF, all fields display as plain text inputs. When AI is ON, Lex populates them progressively through dialogue.

### 2. FIELD PRESERVATION RULE — IMMUTABLE
You may never remove a field, entity, or section from any spec document unless Charlie has explicitly named it for deletion in the current conversation. "Tidying", "consolidating" or "simplifying" are not valid reasons to remove anything. When in doubt: keep it.

**The entity list is CCh-only.** You may read it. You may never edit it. All changes to entity_list_v4.md must be made by CCh and saved by Charlie.

### 3. Process list header update
`process_list_v2.md` header references "Entity List v3" — update this to "Entity List v4" when you next touch that file.

---

## WHAT TO BUILD THIS SESSION

### Priority 1 — Stage 1 Create Screen
Replace the current Stage 1 create screen at `/prototype/create/stage1` with the correct Basic Info form.

Fields to collect (in order):
1. Title (text input, max 200 chars)
2. IdeaType — two large toggle buttons: "Change a Law" (LEGISLATION) / "Change How Something Works" (ORGANISATION)
3. Government Area (dropdown: Housing, Health, Transport, Education, Economy, Environment, Justice, Defence, Foreign Policy, Other)
4. Summary Description (textarea, max 280 chars, shows char count)
5. Summary Diagnosis (textarea — "In one sentence: what is broken?")
6. Summary Guiding Policy (textarea — "In one sentence: what is your approach?")
7. Summary Coherent Actions (textarea — "In one sentence: what are the key steps?")
8. Connected Ideas (optional — search/link field, can skip)

At the bottom: "Save Draft" button (always visible) + "Ready for Stage 2 →" button (enabled only when title + summaryDescription are filled).

**When AI is OFF** (the default for this prototype): All 8 fields appear as plain labelled text inputs with placeholder helper text.
**When AI is ON** (future): Lex takes over and populates these fields through conversation.

Show a clear stage progress indicator at top: Stage 1 (Create) → Stage 2 → Stage 3 → Stage 4 → Stage 5

---

### Priority 2 — start-session.sh
Create `start-session.sh` at repo root:
```bash
#!/bin/bash
echo "=== SESSION START: $(date) ===" >> session-log.txt
echo "Branch: $(git branch --show-current)" >> session-log.txt
git status
echo "Session logged to session-log.txt"
```
Make it executable: `chmod +x start-session.sh`

---

### Priority 3 — Convert /prototype to dashboard
The `/prototype` page currently shows a dev-facing journey selector. Convert it to a proper signed-in dashboard (the WF-10 dashboard experience). Keep UserSwitcher fixed bottom-right and PrototypeBanner at top.

Dashboard should show:
- User greeting ("Welcome back, [name]")
- My Ideas section (cards for each of the 3 mock ideas, with stage badge)
- Quick actions: New Idea / Browse Ideas / Notifications / Settings
- Following/Watching section (placeholder)
- Groups section (placeholder)

---

### Priority 4 — Tester guide page
Build `/prototype/testing-guide` — a tester-facing checklist page listing:
- Every user journey (numbered)
- Every page in each journey with its URL
- Every key field and button on each page to verify
- Visual checkbox per item (state only, no persistence needed)

---

## WHAT NOT TO TOUCH THIS SESSION
- Do not modify entity_list_v4.md (CCh-only document)
- Do not modify process_list_v2.md header (Charlie will do this)
- Do not build anything requiring the Prisma schema yet — prototype only

---

## COMMIT INSTRUCTIONS
One commit per item above. Message format: `feat: [item name]`

Update CHANGE_LOG.md and handoff_summary.md at session end.

---
*CC_briefing_next_session.md — produced by CCh — 09-03-26*
