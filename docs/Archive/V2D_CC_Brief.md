# CC BRIEF — SPRINT V2-D

*Prepared by CCh — 14 April 2026* *Read CLAUDE.md and handoff_summary.md (v24) first. V2-C is the last completed sprint.*

***

## BEFORE STARTING ANY CODE

1.  Run `git status` — confirm on Main
2.  Run `npx prisma generate`
3.  Read `UX_and_voice_build_notes.md` for context on the chat input and mobile requirements

***

## OVERVIEW — 7 COMMITS THIS SPRINT

| \# | Commit                                                        | Area       |
|----|---------------------------------------------------------------|------------|
| 1  | Fix async params build error on legislation [itemId] route    | API fix    |
| 2  | Teal proposal card visible on desktop + swipe gesture fix     | UI fix     |
| 3  | Mobile sidebar — swipe-right-to-panel navigation              | Mobile UI  |
| 4  | Desktop sidebar — filled answers + open/close + expand button | Desktop UI |
| 5  | Whoosh animation — field value transition to sidebar          | Animation  |
| 6  | Lex flow update — structured field-by-field system prompt     | AI         |
| 7  | Docs update                                                   | Docs       |

***

## COMMIT 1 — Fix async params build error

The Vercel production build is failing. This is the immediate priority.

### File: `app/api/legislation/[itemId]/route.ts`

In Next.js 16, dynamic route params are a `Promise` and must be awaited. Fix the GET handler signature:

```typescript
export async function GET(
  req: Request,
  { params }: { params: Promise<{ itemId: string }> }
) {
  const { itemId } = await params
  // rest of function unchanged — just replace params.itemId with itemId
}
```

### File: `app/legislation/[itemId]/page.tsx`

Same fix:

```typescript
export default async function LegislationItemPage({
  params,
}: {
  params: Promise<{ itemId: string }>
}) {
  const { itemId } = await params
  // rest of function unchanged
}
```

Check for any other `[itemId]`, `[id]`, `[ideaId]`, `[username]`, `[token]` dynamic route files that may have been written with synchronous params in this sprint — fix all of them with the same `await params` pattern if found.

Run `tsc --noEmit` — must be clean before proceeding.

Commit tag: `V2D-fix-params`

***

## COMMIT 2 — Teal proposal card visible on desktop + swipe gesture threshold fix

### 2a. Teal proposal card on desktop

The `FieldProposalCard` component (the teal card Lex generates when proposing a field value, with Accept/Edit buttons) is rendering correctly on mobile but not on desktop. Find the component — likely in `components/FieldProposalCard.tsx` or rendered inside `CreateIdeaClient.tsx`.

The issue is almost certainly a CSS breakpoint class hiding it on large screens (e.g. `lg:hidden` or `hidden lg:block` applied incorrectly). Fix it so the card renders on all screen sizes.

**Desktop layout for the proposal card:**

On desktop, the card should appear inline in the chat — below Lex's message, above the user input box. It should be visually distinct: teal left border, slightly inset background, full width of the chat column.

```tsx
// Target appearance on desktop:
<div className="rounded-lg border-l-4 border-teal-500 bg-teal-50 dark:bg-teal-950/30 p-4 my-3">
  <p className="text-sm font-medium text-teal-800 dark:text-teal-200 mb-1">
    Proposed answer:
  </p>
  <p className="text-sm text-gray-800 dark:text-gray-200 mb-3">
    {proposedText}
  </p>
  <div className="flex items-center gap-3">
    <button
      onClick={handleEdit}
      className="text-xs px-3 py-1.5 rounded border border-teal-400 text-teal-700 dark:text-teal-300 hover:bg-teal-100 dark:hover:bg-teal-900 transition-colors"
    >
      Edit
    </button>
    <span className="text-xs text-muted-foreground">or swipe left</span>
    <button
      onClick={handleAccept}
      className="text-xs px-3 py-1.5 rounded bg-teal-600 text-white hover:bg-teal-700 transition-colors"
    >
      Accept
    </button>
    <span className="text-xs text-muted-foreground">or swipe right</span>
  </div>
</div>
```

**Edit button behaviour:** Copies the proposed text into the user's chat input field so they can edit it before sending. Do not auto-send — just populate the input.

**Accept button behaviour:** Accepts the field value (same as the existing swipe-right accept logic), sends the value to the sidebar, triggers the whoosh animation (Commit 5).

### 2b. Swipe gesture threshold fix

The horizontal swipe is accidentally triggering when the user scrolls vertically. Fix the swipe detection in the proposal card (or wherever `useSwipe` / touch handlers are implemented):

```typescript
// Current problem: any horizontal movement triggers swipe
// Fix: require horizontal movement to significantly exceed vertical movement

const SWIPE_HORIZONTAL_THRESHOLD = 50  // minimum horizontal pixels
const SWIPE_DIRECTION_RATIO = 2.5      // horizontal must be 2.5x the vertical

const handleTouchEnd = (e: TouchEvent) => {
  const dx = touchEndX - touchStartX
  const dy = touchEndY - touchStartY
  const absDx = Math.abs(dx)
  const absDy = Math.abs(dy)

  // Only register as a swipe if horizontal movement dominates
  if (absDx > SWIPE_HORIZONTAL_THRESHOLD && absDx > absDy * SWIPE_DIRECTION_RATIO) {
    if (dx > 0) handleAccept()   // swipe right = accept
    if (dx < 0) handleEdit()     // swipe left = edit (copies to input)
  }
  // Otherwise: treat as scroll, do nothing
}
```

Also ensure touch event handlers use `passive: true` where possible to avoid interfering with the browser's scroll behaviour.

Commit tag: `V2D-proposal-card-desktop`

***

## COMMIT 3 — Mobile sidebar: swipe-right-to-panel navigation

On mobile there is no space for a sidebar column. Instead, the field panel is accessed via a swipe-right gesture from the chat view — it slides in as a full-screen overlay.

### File: `app/ideas/create/CreateIdeaClient.tsx`

**State additions:**

```typescript
const [mobilePanelOpen, setMobilePanelOpen] = useState(false)
```

**Layout changes for mobile:**

The outer container needs to detect swipe right (from the left edge of the screen) to open the panel, and swipe left (when panel is open) to close it.

```tsx
// Outer wrapper — detect swipe for panel navigation
<div
  className="relative w-full h-full"
  onTouchStart={handleOuterTouchStart}
  onTouchEnd={handleOuterTouchEnd}
>
  {/* Chat area — always rendered, hidden behind panel on mobile when open */}
  <div className={`w-full ${mobilePanelOpen ? 'invisible' : 'visible'} lg:block`}>
    {/* existing chat content */}
  </div>

  {/* Mobile panel overlay */}
  <div
    className={`
      fixed inset-0 z-40 bg-background transition-transform duration-300 ease-in-out
      lg:hidden
      ${mobilePanelOpen ? 'translate-x-0' : 'translate-x-full'}
    `}
  >
    <div className="flex items-center justify-between p-4 border-b">
      <h2 className="font-semibold text-sm">Your Idea</h2>
      <button
        onClick={() => setMobilePanelOpen(false)}
        className="text-muted-foreground hover:text-foreground"
        aria-label="Back to chat"
      >
        ← Back to chat
      </button>
    </div>
    {/* Sidebar content rendered here — see Commit 4 for the content spec */}
    <MobileSidebarContent idea={idea} onEditField={handleEditField} />
  </div>
</div>
```

**Swipe detection for panel navigation (separate from proposal card swipes):**

```typescript
const PANEL_SWIPE_THRESHOLD = 80  // wider threshold for intentional panel open
const PANEL_SWIPE_RATIO = 2.0

const handleOuterTouchStart = (e: TouchEvent) => {
  outerTouchStartX.current = e.touches[0].clientX
  outerTouchStartY.current = e.touches[0].clientY
}

const handleOuterTouchEnd = (e: TouchEvent) => {
  const dx = e.changedTouches[0].clientX - outerTouchStartX.current
  const dy = e.changedTouches[0].clientY - outerTouchStartY.current
  const absDx = Math.abs(dx)
  const absDy = Math.abs(dy)

  if (absDx > PANEL_SWIPE_THRESHOLD && absDx > absDy * PANEL_SWIPE_RATIO) {
    if (dx > 0 && !mobilePanelOpen) setMobilePanelOpen(true)   // swipe right = open panel
    if (dx < 0 && mobilePanelOpen) setMobilePanelOpen(false)   // swipe left = close panel
  }
}
```

**Panel indicator on mobile:**

When the panel is closed, show a subtle visual hint at the right edge of the screen (a thin teal strip, \~8px wide, 60px tall, vertically centred). This communicates that there is something to the right without cluttering the chat. Tapping it opens the panel.

```tsx
{/* Panel indicator — mobile only, shown when panel is closed */}
{!mobilePanelOpen && (
  <button
    className="lg:hidden fixed right-0 top-1/2 -translate-y-1/2 w-3 h-16 bg-teal-500 rounded-l-full z-30 opacity-60"
    onClick={() => setMobilePanelOpen(true)}
    aria-label="Open field panel"
  />
)}
```

**Mobile panel field actions:**

In `MobileSidebarContent`, each completed field shows:

-   Field label (user-friendly, from `field-labels.ts`)
-   Field value (truncated to 2 lines, expandable)
-   Two icon buttons:
    -   ✏️ Edit — copies the field value into the chat input and closes the panel, with a note to Lex: "I want to revisit [field label]"
    -   💬 Chat — sends a message to Lex: "I'd like to revisit [field label]" and closes the panel

Empty/unfilled fields show just the label with a grey dot.

Commit tag: `V2D-mobile-panel`

***

## COMMIT 4 — Desktop sidebar: filled answers + open/close + expand button

### File: `app/ideas/create/CreateIdeaClient.tsx` (Stage2Sidebar component or equivalent)

The sidebar currently shows field labels with completion dots. It needs to also show the field values for completed fields, with a toggle to show/hide each one.

**State additions:**

```typescript
const [sidebarExpanded, setSidebarExpanded] = useState(false)
const [openFields, setOpenFields] = useState<Set<string>>(new Set())
```

**Sidebar layout changes:**

```tsx
<div
  className={`
    hidden lg:flex flex-col border-l bg-background transition-all duration-300
    ${sidebarExpanded ? 'w-1/2' : 'w-72'}
  `}
>
  {/* Sidebar header */}
  <div className="flex items-center justify-between px-4 py-3 border-b">
    <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
      Your Idea
    </h3>
    <button
      onClick={() => setSidebarExpanded(e => !e)}
      className="text-xs text-muted-foreground hover:text-foreground transition-colors"
      title={sidebarExpanded ? 'Collapse sidebar' : 'Expand sidebar'}
    >
      {sidebarExpanded ? '⊟ Collapse' : '⊞ Expand'}
    </button>
  </div>

  {/* Field sections */}
  <div className="flex-1 overflow-y-auto px-4 py-3 space-y-4">
    {SIDEBAR_SECTIONS.map(section => (
      <SidebarSection
        key={section.key}
        section={section}
        idea={idea}
        isActive={currentSection === section.key}
        openFields={openFields}
        onToggleField={(fieldKey) => setOpenFields(prev => {
          const next = new Set(prev)
          next.has(fieldKey) ? next.delete(fieldKey) : next.add(fieldKey)
          return next
        })}
        expanded={sidebarExpanded}
      />
    ))}
  </div>
</div>
```

**SidebarSection component** (extract or update within CreateIdeaClient):

```tsx
function SidebarSection({ section, idea, isActive, openFields, onToggleField, expanded }) {
  const fields = getSectionFields(section.key) // returns field keys for this section
  const completedFields = fields.filter(f => getFieldValue(idea, f))
  const isComplete = completedFields.length === fields.length

  return (
    <div>
      {/* Section heading */}
      <div className="flex items-center gap-2 mb-2">
        <span className={`w-2 h-2 rounded-full flex-shrink-0 ${
          isComplete ? 'bg-teal-500' :
          isActive ? 'bg-blue-500' :
          'bg-gray-300'
        }`} />
        <span className={`text-xs font-semibold uppercase tracking-wide ${
          isActive ? 'text-foreground' : 'text-muted-foreground'
        }`}>
          {section.label}
        </span>
      </div>

      {/* Fields — show all if active or expanded, otherwise just completed ones */}
      {(isActive || expanded ? fields : completedFields).map(fieldKey => {
        const value = getFieldValue(idea, fieldKey)
        const label = getFieldLabel(fieldKey)
        const isOpen = openFields.has(fieldKey)

        return (
          <div key={fieldKey} className="ml-4 mb-1">
            <div
              className="flex items-center justify-between cursor-pointer group"
              onClick={() => value && onToggleField(fieldKey)}
            >
              <div className="flex items-center gap-1.5">
                <span className={`w-1.5 h-1.5 rounded-full ${value ? 'bg-teal-400' : 'bg-gray-200'}`} />
                <span className="text-xs text-muted-foreground group-hover:text-foreground transition-colors">
                  {label}
                </span>
              </div>
              {value && (
                <span className="text-xs text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity">
                  {isOpen ? '▲' : '▼'}
                </span>
              )}
            </div>

            {/* Field value — shown when open */}
            {value && isOpen && (
              <div className="mt-1 ml-3 text-xs text-foreground bg-muted/40 rounded p-2 leading-relaxed">
                {value.length > 200 && !expanded
                  ? value.substring(0, 200) + '...'
                  : value
                }
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}
```

**Auto-open most recent field:**

The most recently completed field should auto-open in the sidebar (so the user can see what was just accepted). This means: when a new field value arrives (after an Accept), add that fieldKey to `openFields` automatically.

In the streaming handler, after `event.type === 'done'` with `hasFieldUpdates: true`:

```typescript
if (event.completedFields?.length > 0) {
  setOpenFields(prev => {
    const next = new Set(prev)
    // Close any previously auto-opened fields beyond the last 2
    event.completedFields.forEach((f: string) => next.add(f))
    return next
  })
}
```

Commit tag: `V2D-sidebar-answers`

***

## COMMIT 5 — Whoosh animation: field value transition to sidebar

When a field value is accepted (either via the Accept button or swipe right), animate the value "flying" from the proposal card position to the sidebar.

### Implementation approach

Use a CSS keyframe animation triggered when `completedFields` is updated. The animation is a visual flourish — it does not need to literally move a DOM element across the screen (which is complex). Instead, use a two-part effect:

1.  **In the chat**: the proposal card briefly highlights (teal pulse, 300ms) before the value is accepted
2.  **In the sidebar**: the newly-opened field value fades in with a subtle slide-in from the right (200ms)

```css
/* Add to globals.css or as a Tailwind arbitrary animation */
@keyframes fieldAccept {
  0% { opacity: 0; transform: translateX(12px); }
  100% { opacity: 1; transform: translateX(0); }
}

@keyframes proposalPulse {
  0% { background-color: rgb(20 184 166 / 0.1); }
  50% { background-color: rgb(20 184 166 / 0.3); }
  100% { background-color: rgb(20 184 166 / 0.1); }
}

.field-accept-animation {
  animation: fieldAccept 200ms ease-out forwards;
}

.proposal-pulse-animation {
  animation: proposalPulse 300ms ease-in-out;
}
```

Apply `.field-accept-animation` to the field value div in the sidebar when it first appears (i.e. when `isOpen` becomes true due to auto-open after accept).

Apply `.proposal-pulse-animation` to the proposal card when the Accept button is clicked, just before it disappears.

In Tailwind terms, you can use `animate-pulse` for the proposal card and a custom animation class for the sidebar entry.

Commit tag: `V2D-whoosh-animation`

***

## COMMIT 6 — Lex flow update: structured field-by-field system prompt

### File: `app/api/ai/[ideaId]/route.ts` — system prompt updates only

Add a new section to `buildSystemPrompt` called **FIELD CONVERSATION PROTOCOL**. This replaces the ad-hoc field-gathering behaviour with a structured flow for each field.

Insert this section after the EXPERIENCE LEVEL ADAPTATION section:

```
FIELD CONVERSATION PROTOCOL

For each field you are working on, follow this exact sequence:

STEP 1 — ORIENTATION
Before asking the question, give one sentence naming the field and explaining what we are trying to achieve with it. End with "if you need any help just ask me."

Example: "Next we need your Diagnosis Title — a short, clear name for the challenge you're tackling. If you need any help just ask me."

STEP 2 — QUESTION
Ask one clear, specific question to gather the information for this field. One question only.

STEP 3 — ASSESS THE ANSWER
- If the answer is clear and specific enough: proceed to Step 4.
- If the answer is vague, short, or unclear: ask one follow-up question to clarify. Maximum two follow-up questions before proceeding anyway with a provisional answer.
- If the user says they don't know or want to skip: accept gracefully, mark the field as provisional ("I'll note this as provisional for now — we can come back to it"), and move to the next field.

STEP 4 — CONFIRMATION
Before populating the field, ask: "Would you be happy with this answer?"

Then — as a SEPARATE message immediately after — present the proposed field value in the fieldProposal JSON key:

Your response JSON should include:
{
  "fieldUpdates": {},
  "fieldProposal": {
    "fieldKey": "diagnosisTitle",
    "fieldLabel": "The Challenge",  
    "proposedValue": "The proposed text for this field goes here"
  }
}

The frontend will render this as a teal card with Accept and Edit buttons. Do NOT populate fieldUpdates yet — only populate fieldUpdates after the user accepts (the frontend sends a confirmation message when the user taps Accept).

STEP 5 — NEXT FIELD
After the user accepts (you receive a message like "Accepted: [field label]"), say:
"The next question is [field label]." Then begin Step 1 for the next field.

IMPORTANT RULES FOR THIS PROTOCOL:
- Never ask two questions at once
- Never skip the orientation step
- Never populate fieldUpdates without the user accepting first (except for triggerSavePrompt and insightFlag which are always fire-and-forget)
- If the user asks a question mid-flow, answer it and then return to the current field
- If the user volunteers information for a future field, acknowledge it briefly and save it in your context, but continue with the current field
- Keep orientation sentences short — one sentence maximum
- The "Would you be happy with this answer?" line should be conversational and warm, not bureaucratic
```

### Handle the Accept confirmation message

In `buildSystemPrompt`, add to the RETURNING SESSION / CONTEXT section:

```
FIELD ACCEPTANCE: When the user sends a message starting with "Accepted: ", treat this as confirmation that the previously proposed field value has been accepted. Populate fieldUpdates with that value, then immediately begin Step 1 for the next unpopulated field. Do not ask for confirmation of the acceptance — it is already confirmed.
```

### Frontend: send Accept confirmation to Lex

In `CreateIdeaClient.tsx`, when the user clicks Accept on the proposal card:

```typescript
const handleProposalAccept = async (fieldKey: string, fieldLabel: string, value: string) => {
  // 1. Trigger whoosh animation
  triggerAcceptAnimation(fieldKey)
  
  // 2. Update the sidebar immediately (optimistic update)
  updateSidebarField(fieldKey, value)

  // 3. Send confirmation message to Lex
  await handleSendStreaming(`Accepted: ${fieldLabel}`, { isSystemMessage: true })
}
```

The `isSystemMessage: true` flag should suppress rendering this message in the chat (it's a system signal, not a user message the user typed). The user should just see Lex's response to the acceptance.

### Frontend: handle fieldProposal in streaming response

In the streaming response handler, add handling for `fieldProposal` events:

```typescript
// After parsing fieldUpdates and done events, also check for fieldProposal:
if (event.type === 'done' && fullText.includes('"fieldProposal"')) {
  try {
    const jsonMatch = fullText.match(/```json\s*([\s\S]*?)\s*```/)
    if (jsonMatch) {
      const parsed = JSON.parse(jsonMatch[1])
      if (parsed.fieldProposal) {
        setCurrentProposal(parsed.fieldProposal) // triggers the teal card rendering
      }
    }
  } catch {}
}
```

Add state:

```typescript
const [currentProposal, setCurrentProposal] = useState<{
  fieldKey: string
  fieldLabel: string
  proposedValue: string
} | null>(null)
```

Render the proposal card when `currentProposal` is non-null, positioned below the most recent Lex message and above the input box.

Commit tag: `V2D-lex-flow`

***

## COMMIT 7 — Docs update

### `docs/CHANGE_LOG.md`

Add one entry per commit.

### `docs/handoff_summary.md`

Add Sprint V2-D section at the top. Include:

-   All 7 commits
-   Production build error fixed (async params)
-   Teal card now renders on desktop and mobile
-   Swipe gesture threshold fixed (no more accidental accepts on scroll)
-   Mobile: swipe-right-to-panel with teal edge indicator
-   Desktop: sidebar shows filled answers with expand button
-   Whoosh animation on field accept
-   Lex field conversation protocol active (orientation → question → confirm → card → next)
-   Next: V2-E (to be specified)

Commit tag: `V2D-docs`

***

## AFTER ALL COMMITS

```
tsc --noEmit — must be zero errors
```

Then produce `commit-all.sh` in the project root:

```bash
#!/bin/bash
set -e
cd D:/Dropbox/GitHub/scrutinise-prototype
export GIT_TMPDIR="D:/tmp"

git add scrutinise-web/app/api/legislation/[itemId]/route.ts scrutinise-web/app/legislation/[itemId]/page.tsx
git commit -m "fix: async params in legislation [itemId] routes for Next.js 16 (V2D-fix-params)"

git add scrutinise-web/components/FieldProposalCard.tsx scrutinise-web/app/ideas/create/CreateIdeaClient.tsx
git commit -m "fix: teal proposal card visible on desktop, swipe gesture threshold raised (V2D-proposal-card-desktop)"

git add scrutinise-web/app/ideas/create/CreateIdeaClient.tsx
git commit -m "feat: mobile sidebar panel — swipe-right navigation, teal edge indicator, field edit/chat actions (V2D-mobile-panel)"

git add scrutinise-web/app/ideas/create/CreateIdeaClient.tsx
git commit -m "feat: desktop sidebar shows filled answers with open/close toggles and expand button (V2D-sidebar-answers)"

git add scrutinise-web/app/globals.css scrutinise-web/app/ideas/create/CreateIdeaClient.tsx
git commit -m "feat: whoosh animation on field accept — proposal pulse + sidebar slide-in (V2D-whoosh-animation)"

git add scrutinise-web/app/api/ai/[ideaId]/route.ts scrutinise-web/app/ideas/create/CreateIdeaClient.tsx
git commit -m "feat: Lex field conversation protocol — orientation, confirmation, proposal card, accept flow (V2D-lex-flow)"

git add docs/CHANGE_LOG.md docs/handoff_summary.md
git commit -m "docs: V2-D CHANGE_LOG, handoff v25 (V2D-docs)"

git push origin Main
echo "Sprint V2-D complete."
```

Execute `commit-all.sh`, confirm push, then delete it.

***

## NOTES FOR CC

**On the git add commands in commit-all.sh:** Several commits touch `CreateIdeaClient.tsx`. Since git stages by file not by change, CC should produce the commit-all.sh with the correct file lists based on what was actually modified. The lists above are indicative — adjust to match the actual files changed.

**On the fieldProposal JSON key:** This is a new key alongside the existing `fieldUpdates` and `insightFlag` keys in Lex's response JSON. The system prompt already instructs Lex to return structured JSON. The fieldProposal key follows the same pattern — it is stripped server-side before returning the display text to the client, but the frontend reads it from the streaming done event.

**On CreateIdeaClient.tsx multiple commits:** Since several commits modify the same file, CC should handle this carefully in the commit-all.sh — each `git add` of that file will stage the current state of the file at that point. The cleanest approach is to complete all code changes to CreateIdeaClient first, then structure the commits to reflect the logical units, using `git add -p` (interactive staging by hunk) if needed. Alternatively, stage all changes to CreateIdeaClient in a single commit — the logical separation matters less than clean build and clean TypeScript.

***

## DEFERRED — DO NOT BUILD

-   Voice dictation UI (Web Speech API) — queued, see UX_and_voice_build_notes.md
-   V2-E (Lex context injection from legislation DB, correction flow UI) — to be specified

***

*CC Brief — Sprint V2-D — 14 April 2026 — Prepared by CCh* *Read CLAUDE.md and handoff_summary.md before starting.*
