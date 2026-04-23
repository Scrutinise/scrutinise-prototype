# CC BRIEF — SPRINT V2-B

*Prepared by CCh — 13 April 2026* *Read CLAUDE.md and handoff_summary.md (v23) first. V2-A is the last completed sprint.*

***

## BEFORE STARTING ANY CODE

1.  Run `git status` — confirm on Main
2.  Run `npx prisma generate`
3.  Confirm `GEMINI_API_KEY` and `GROK_API_KEY` are present in Vercel Production env vars

***

## OVERVIEW — 7 COMMITS THIS SPRINT

| \# | Commit                                                      | Area     |
|----|-------------------------------------------------------------|----------|
| 1  | Streaming Lex AI route + throbber component                 | API + UI |
| 2  | Credibility score calculation wired to points               | Lib      |
| 3  | Sidebar field labels + Coherent Actions title               | UI       |
| 4  | Lex edit toolbar + orienteering fixes                       | UI + API |
| 5  | Idea page layout — Take Public, Campaign in a Box, WhatNext | UI       |
| 6  | Notifications — stage labels, idea name, layout             | UI       |
| 7  | Referral view-only link under Team                          | UI       |

***

## COMMIT 1 — Streaming Lex AI route + throbber component

### Why streaming

Vercel Hobby plan has a 10-second function timeout. Gemini 2.5 Flash can take 15–20 seconds on a long system prompt. Streaming solves this: Vercel sees the first byte within 1–2 seconds, which resets the timeout. The user also sees Lex's response appearing word by word, which feels faster.

### File: `app/api/ai/[ideaId]/route.ts`

Replace the current non-streaming response with a streaming response using `ReadableStream`.

The current flow: `await callGemini()` → parse JSON → return `NextResponse.json()`.

The new flow: open a `ReadableStream`, pipe AI tokens through it as they arrive, flush the complete text at the end for JSON parsing (field updates etc).

**Implementation pattern:**

```typescript
import { NextResponse } from 'next/server'

export async function POST(req: Request, { params }: Params) {
  // ... existing auth, idea fetch, system prompt build (unchanged) ...

  // Build the encoder for the stream
  const encoder = new TextEncoder()

  const stream = new ReadableStream({
    async start(controller) {
      let fullText = ''

      try {
        // ── Gemini streaming ──────────────────────────────────────────────
        const geminiStream = await callGeminiStream(systemPrompt, userMessage, idea.aiProvider)

        for await (const chunk of geminiStream) {
          const token = chunk.text()
          fullText += token
          // Send each token to client immediately
          controller.enqueue(encoder.encode(`data: ${JSON.stringify({ type: 'token', text: token })}\n\n`))
        }

      } catch (geminiError) {
        // ── Grok fallback (non-streaming) ─────────────────────────────────
        // Grok fallback can be non-streaming for now — send a single chunk
        try {
          const grokResult = await callGrok(systemPrompt, userMessage)
          fullText = grokResult.text
          controller.enqueue(encoder.encode(`data: ${JSON.stringify({ type: 'token', text: fullText })}\n\n`))
        } catch (grokError) {
          controller.enqueue(encoder.encode(`data: ${JSON.stringify({ type: 'error', errorType: 'both_failed' })}\n\n`))
          controller.close()
          return
        }
      }

      // ── Parse JSON field updates from complete response ───────────────
      // (same logic as before — strip fieldUpdates before sending to client)
      let displayText = fullText
      let fieldUpdates = null

      const jsonMatch = fullText.match(/```json\s*([\s\S]*?)\s*```/)
      if (jsonMatch) {
        try {
          const parsed = JSON.parse(jsonMatch[1])
          fieldUpdates = parsed.fieldUpdates ?? null
          displayText = fullText.replace(/```json[\s\S]*?```/g, '').trim()
          
          // Handle insightFlag (fire and forget)
          if (parsed.insightFlag) {
            prisma.lexInsight.create({ data: { ...parsed.insightFlag, status: 'DRAFT' } }).catch(() => {})
          }
        } catch {}
      }

      // ── Apply field updates to DB ─────────────────────────────────────
      if (fieldUpdates) {
        await applyFieldUpdates(idea.id, fieldUpdates)
      }

      // ── Save chat history ─────────────────────────────────────────────
      await saveChatHistory(idea.id, userMessage, displayText)

      // ── Send final done event with field update info ──────────────────
      controller.enqueue(encoder.encode(`data: ${JSON.stringify({ 
        type: 'done', 
        hasFieldUpdates: !!fieldUpdates,
        completedFields: fieldUpdates ? Object.keys(fieldUpdates) : []
      })}\n\n`))

      controller.close()
    }
  })

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
    }
  })
}
```

**Gemini streaming call helper** (add alongside existing `callGemini`):

```typescript
async function* callGeminiStream(systemPrompt: string, userMessage: string, provider: string) {
  const apiKey = process.env.GEMINI_API_KEY!
  const model = 'gemini-2.5-flash-preview-04-17'
  
  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${model}:streamGenerateContent?alt=sse&key=${apiKey}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        system_instruction: { parts: [{ text: systemPrompt }] },
        contents: [{ role: 'user', parts: [{ text: userMessage }] }],
        generationConfig: { temperature: 0.7, maxOutputTokens: 8192 }
      })
    }
  )

  if (!response.ok || !response.body) throw new Error(`Gemini error: ${response.status}`)

  const reader = response.body.getReader()
  const decoder = new TextDecoder()
  let buffer = ''

  while (true) {
    const { done, value } = await reader.read()
    if (done) break
    
    buffer += decoder.decode(value, { stream: true })
    const lines = buffer.split('\n')
    buffer = lines.pop() ?? ''

    for (const line of lines) {
      if (line.startsWith('data: ')) {
        try {
          const json = JSON.parse(line.slice(6))
          const text = json.candidates?.[0]?.content?.parts?.[0]?.text
          if (text) yield { text: () => text }
        } catch {}
      }
    }
  }
}
```

**Important:** The existing `callGemini` non-streaming function can remain for any non-chat uses. Only the chat route changes.

### New file: `components/LexThinking.tsx`

```tsx
'use client'

import { useState, useEffect } from 'react'

const MESSAGES = [
  "Lex is thinking...",
  "Reading the question...",
  "Weighing the evidence...",
  "Considering the policy angle...",
  "Checking the research...",
  "Formulating a response...",
  "Thinking through the implications...",
  "Analysing the diagnosis...",
  "Consulting the statute book...",
  "Drawing on the evidence...",
]

interface LexThinkingProps {
  visible: boolean
}

export default function LexThinking({ visible }: LexThinkingProps) {
  const [msgIndex, setMsgIndex] = useState(0)

  useEffect(() => {
    if (!visible) return
    const interval = setInterval(() => {
      setMsgIndex(i => {
        let next = Math.floor(Math.random() * MESSAGES.length)
        while (next === i) next = Math.floor(Math.random() * MESSAGES.length)
        return next
      })
    }, 3000)
    return () => clearInterval(interval)
  }, [visible])

  if (!visible) return null

  return (
    <div className="flex items-center gap-3 text-sm text-muted-foreground py-2">
      <div className="flex gap-1">
        <span className="w-2 h-2 rounded-full bg-current animate-bounce [animation-delay:0ms]" />
        <span className="w-2 h-2 rounded-full bg-current animate-bounce [animation-delay:150ms]" />
        <span className="w-2 h-2 rounded-full bg-current animate-bounce [animation-delay:300ms]" />
      </div>
      <span className="transition-opacity duration-300">{MESSAGES[msgIndex]}</span>
    </div>
  )
}
```

### File: `app/ideas/create/CreateIdeaClient.tsx`

Replace the current loading state with the streaming reader. Key changes:

1.  Remove the `await fetch('/api/ai/...')` pattern — replace with `fetch` that reads a streaming response.
2.  Show `<LexThinking visible={isStreaming} />` while streaming.
3.  Build the assistant message incrementally as tokens arrive.
4.  On `type: 'done'` event, trigger sidebar refresh if `hasFieldUpdates` is true.

```typescript
// Replace the current handleSend fetch block with:

const handleSendStreaming = async (messageText: string) => {
  setIsLoading(true)
  setRetryCount(0)
  
  // Append user message immediately
  const userMsg = { role: 'user' as const, content: messageText, timestamp: new Date().toISOString() }
  setMessages(prev => [...prev, userMsg])
  
  // Add empty assistant message that will be filled by stream
  const assistantMsgId = Date.now().toString()
  setMessages(prev => [...prev, { role: 'assistant' as const, content: '', id: assistantMsgId, isStreaming: true }])

  try {
    const response = await fetch(`/api/ai/${ideaId}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message: messageText })
    })

    if (!response.ok || !response.body) throw new Error('Stream failed')

    const reader = response.body.getReader()
    const decoder = new TextDecoder()
    let buffer = ''

    while (true) {
      const { done, value } = await reader.read()
      if (done) break

      buffer += decoder.decode(value, { stream: true })
      const lines = buffer.split('\n\n')
      buffer = lines.pop() ?? ''

      for (const line of lines) {
        if (!line.startsWith('data: ')) continue
        try {
          const event = JSON.parse(line.slice(6))
          
          if (event.type === 'token') {
            // Append token to assistant message
            setMessages(prev => prev.map(m => 
              (m as any).id === assistantMsgId 
                ? { ...m, content: m.content + event.text }
                : m
            ))
          } else if (event.type === 'error') {
            setMessages(prev => prev.map(m =>
              (m as any).id === assistantMsgId
                ? { ...m, content: 'Lex is temporarily unavailable — please try again.', isConnectionError: true, isStreaming: false }
                : m
            ))
          } else if (event.type === 'done') {
            // Mark streaming complete, refresh sidebar if fields updated
            setMessages(prev => prev.map(m =>
              (m as any).id === assistantMsgId ? { ...m, isStreaming: false } : m
            ))
            if (event.hasFieldUpdates) {
              fetchSidebarData() // trigger sidebar refresh — use existing pattern
            }
          }
        } catch {}
      }
    }

  } catch (err) {
    // Remove streaming placeholder, show error
    setMessages(prev => prev.filter(m => (m as any).id !== assistantMsgId))
    setMessages(prev => [...prev, { 
      role: 'assistant' as const, 
      content: 'Lex lost connection — please try again.',
      isConnectionError: true 
    }])
  } finally {
    setIsLoading(false)
  }
}
```

Show `<LexThinking visible={isLoading && lastMessageIsStreaming} />` in the chat — where `lastMessageIsStreaming` checks whether the last message has `isStreaming: true` but empty/short content (i.e. still waiting for first tokens).

Run `tsc --noEmit`. Commit: `feat: streaming Lex AI route, LexThinking throbber component (V2B-streaming)`

***

## COMMIT 2 — Credibility score calculation wired to points

### Problem

`lib/points.ts` updates `Reputation` (the denormalised point totals per category) but never updates `CredibilityScore.rawScore`. The dashboard shows 0 because `rawScore` is never written after the initial 0 seed.

### Fix: `lib/points.ts`

Add a `recalculateCredibility` function and call it at the end of `awardPoints`:

```typescript
// Credibility weights — Phase 1 (rawScore < 350): rawScore IS the displayed score
// These weights determine how each category contributes to rawScore
const CREDIBILITY_WEIGHTS = {
  THINKER:     0.40,
  STRATEGIST:  0.30,
  RALLYMASTER: 0.10,
  TEAMBUILDER: 0.10,
  RAINMAKER:   0.10,
}

export async function recalculateCredibility(userId: string): Promise<void> {
  const rep = await prisma.reputation.findUnique({ where: { userId } })
  if (!rep) return

  // Weighted sum of all point categories
  const rawScore = Math.round(
    (rep.reputationPointsThinker     * CREDIBILITY_WEIGHTS.THINKER) +
    (rep.reputationPointsStrategist  * CREDIBILITY_WEIGHTS.STRATEGIST) +
    (rep.reputationPointsRallymaster * CREDIBILITY_WEIGHTS.RALLYMASTER) +
    (rep.reputationPointsTeambuilder * CREDIBILITY_WEIGHTS.TEAMBUILDER) +
    (rep.reputationPointsRainmaker   * CREDIBILITY_WEIGHTS.RAINMAKER)
  )

  const phase = rawScore >= 350 ? 'ESTABLISHED' : 'BUILDING'

  await prisma.credibilityScore.upsert({
    where: { userId },
    create: {
      userId,
      rawScore,
      phase,
      thinkerComponent:     rep.reputationPointsThinker     * CREDIBILITY_WEIGHTS.THINKER,
      strategistComponent:  rep.reputationPointsStrategist  * CREDIBILITY_WEIGHTS.STRATEGIST,
      rallymasterComponent: rep.reputationPointsRallymaster * CREDIBILITY_WEIGHTS.RALLYMASTER,
      teambuilderComponent: rep.reputationPointsTeambuilder * CREDIBILITY_WEIGHTS.TEAMBUILDER,
      rainmakerComponent:   rep.reputationPointsRainmaker   * CREDIBILITY_WEIGHTS.RAINMAKER,
      lastCalculatedAt: new Date(),
    },
    update: {
      rawScore,
      phase,
      thinkerComponent:     rep.reputationPointsThinker     * CREDIBILITY_WEIGHTS.THINKER,
      strategistComponent:  rep.reputationPointsStrategist  * CREDIBILITY_WEIGHTS.STRATEGIST,
      rallymasterComponent: rep.reputationPointsRallymaster * CREDIBILITY_WEIGHTS.RALLYMASTER,
      teambuilderComponent: rep.reputationPointsTeambuilder * CREDIBILITY_WEIGHTS.TEAMBUILDER,
      rainmakerComponent:   rep.reputationPointsRainmaker   * CREDIBILITY_WEIGHTS.RAINMAKER,
      lastCalculatedAt: new Date(),
    }
  })
}
```

At the end of `awardPoints` (after updating Reputation), add:

```typescript
// Recalculate credibility score after every point award
await recalculateCredibility(params.userId)
```

Also call `recalculateCredibility` at the end of `cascadeTeambuilderPoints` for the cascade recipients.

**Back-fill for existing users:** After deploying, run a one-time recalculation for all users who have Reputation records. Add a script `scripts/backfill-credibility.ts`:

```typescript
import { prisma } from '../scrutinise-web/lib/prisma'
import { recalculateCredibility } from '../scrutinise-web/lib/points'

async function main() {
  const users = await prisma.reputation.findMany({ select: { userId: true } })
  console.log(`Recalculating credibility for ${users.length} users...`)
  for (const { userId } of users) {
    await recalculateCredibility(userId)
    console.log(`  ✓ ${userId}`)
  }
  console.log('Done.')
}

main().catch(console.error).finally(() => prisma.$disconnect())
```

Run: `cd scrutinise-web && npx ts-node ../scripts/backfill-credibility.ts`

Commit: `feat: credibility score calculation wired to points, backfill script (V2B-credibility)`

***

## COMMIT 3 — Sidebar field labels + Coherent Actions title

### Problem

The RH sidebar in `CreateIdeaClient.tsx` is showing raw DB field names (`diagnosisText`, `diagnosisObstacleDefined` etc.) instead of user labels. The `lib/field-labels.ts` file was created in V2-A but was not fully wired into the sidebar rendering.

### Fix: `app/ideas/create/CreateIdeaClient.tsx`

Find the `Stage2Sidebar` component (or equivalent sidebar rendering section). It should be using `FIELD_LABELS` from `lib/field-labels.ts`. Ensure:

1.  Import `{ FIELD_LABELS, getFieldLabel }` from `@/lib/field-labels`
2.  For every field key rendered in the sidebar, replace the raw key with `getFieldLabel(key)`:

```typescript
// Wrong:
<span>{fieldKey}</span>

// Correct:
<span>{getFieldLabel(fieldKey)}</span>
```

3.  The three section headings should show in dual format:
    -   **DIAGNOSIS — The Challenge**
    -   **GUIDING POLICY — Your Approach** (collapsed if not yet reached)
    -   **COHERENT ACTIONS — What Is to Be Changed** (collapsed if not yet reached — currently missing entirely)
4.  Add Coherent Actions as a third sidebar section. It should appear collapsed (showing title only) until the user reaches it. Show a count badge if any Coherent Actions exist: "Coherent Actions — What Is to Be Changed (1)".
5.  Fields currently shown in Diagnosis section should be the user-label versions:
    -   The Challenge
    -   Describe the Challenge
    -   What's Blocking Progress
    -   Who Is Affected
    -   How They're Affected
    -   Why Has This Gone Unsolved
    -   The Impact
    -   The Cost of Inaction

Commit: `fix: sidebar field labels using FIELD_LABELS, add Coherent Actions section (V2B-sidebar)`

***

## COMMIT 4 — Lex edit toolbar + orienteering fixes

### 4a. Toolbar button changes: `app/ideas/create/CreateIdeaClient.tsx`

Three changes to the toolbar strip:

1.  **"View your idea →" link** — rename to "Back to idea" and change from a Link to a `<Button variant="outline" size="sm">` styled consistently with the other toolbar buttons.
2.  **"Save & Exit" button** — change from outline/ghost style to primary (blue, `variant="default"`). This makes it the dominant action in the toolbar, which is correct — it's what most users want to do.
3.  **Button order** (left to right): "Back to idea" \| "My Dashboard" \| **"Save & Exit"** (blue, rightmost)

### 4b. Lex orienteering on return: `app/api/ai/[ideaId]/route.ts`

The ORIENTEERING ON RETURN instruction is in the system prompt but Lex is not following it correctly — it's saying "let's develop another idea" which is the Stage 1 opening message, not a returning session message.

Two things to check and fix:

**Check 1:** In the route, confirm that `aiSessionCount` is being incremented correctly. The orienteering instruction only fires when `aiSessionCount > 0`. If the session count is not being incremented, Lex will always behave as if it's a new session.

Find where `aiSessionCount` is incremented in the route. It should fire on the **first message of a new session** (when the conversation resumes, not on every message). If this increment is missing or not happening before the system prompt is built, add it:

```typescript
// At the start of POST handler, after fetching the idea:
// Increment session count on first message if this is a new session
// (detect new session by checking if the last message in aiChatHistory was > 30 mins ago)
const lastMessageTime = idea.aiChatHistory?.length
  ? new Date((idea.aiChatHistory as any[]).at(-1)?.timestamp ?? 0)
  : null
const isNewSession = !lastMessageTime || (Date.now() - lastMessageTime.getTime() > 30 * 60 * 1000)

if (isNewSession) {
  await prisma.idea.update({
    where: { id: ideaId },
    data: { aiSessionCount: { increment: 1 } }
  })
}
```

**Check 2:** In `buildSystemPrompt`, confirm the runtime context is injecting `{{aiSessionCount}}` with the *updated* value (after the increment above). If it's reading the value before the increment, fix the ordering.

**Check 3:** Strengthen the ORIENTEERING ON RETURN instruction to be more explicit, since Lex is ignoring it:

Replace the current ORIENTEERING ON RETURN block with:

```
ORIENTEERING ON RETURN — THIS IS MANDATORY when aiSessionCount > 0:

You MUST NOT use the Stage 1 opening question ("What is the challenge you want to overcome?") 
when returning to an existing idea. This idea already exists. The user has been here before.

Your FIRST message when aiSessionCount > 0 must follow this EXACT structure:
1. "Welcome back, [preferredName]."
2. One sentence: what was last worked on (draw from chatSummary or last message in aiChatHistory).
   If aiChatHistory has entries referencing the overview/title/summary, say "Last time we worked on the overview."
   If diagnosis fields have content, say "Last time we made progress on the diagnosis."
3. One sentence: what comes next. Name the next empty field using its user-friendly label.
4. "Shall we continue?"

EXAMPLE (Stage 1, overview complete, diagnosis not started):
"Welcome back, Charles. Last time we worked on the overview and gave your idea its first shape. 
Next up is the Diagnosis — identifying the challenge you want to address and its root causes. 
Shall we continue?"

NEVER say "let's develop another idea" or "What is the challenge" to a returning user.
NEVER re-introduce yourself to a returning user.
```

Commit: `feat: toolbar button changes, Lex orienteering fix (V2B-toolbar-lex)`

***

## COMMIT 5 — Idea page layout changes

All changes in `app/ideas/[id]/IdeaDetailClient.tsx`.

### 5a. "Take Public" button — move into Requirements box

Currently "Take Public" is a standalone button. Move it inside the `Stage2GateCard` component (or equivalent Requirements box), right-aligned on the same line as the box title "Requirements to Take Public". The button should only appear when the gate is met (existing logic unchanged). Remove the standalone "Take Public" button from wherever it currently is.

Layout within the box header row:

```
[Requirements to Take Public]          [Take Public →]
```

### 5b. "Campaign in a Box" button — move next to "What Next?"

Find where "Campaign in a Box" is currently rendered. Move it to sit immediately to the right of the "What Next?" button in the button row below the author/date line.

Button row (left to right): `[Edit]` `[What Next?]` `[Campaign in a Box]`

"Campaign in a Box" should only show at Stage 4+ (existing visibility logic unchanged).

### 5c. WhatNext panel status text — stage-aware messages

In `components/WhatNextPanel.tsx`, replace the static "Start with your Diagnosis" text in Section 3 with stage-aware template text. Update the status message logic:

```typescript
function getStatusMessage(idea: WhatNextPanelProps['idea']): string {
  const { stage, diagnosis, guidingPolicy, coherentActions } = idea

  if (stage === 'STAGE_3') {
    return "Your idea is now public. We encourage you to send a link to prominent experts and invite them to contribute feedback and possible improvements before you start campaigning."
  }

  if (stage === 'STAGE_4') {
    return "You are in the campaigning phase. The objective now is to build as much support and Parliamentary endorsements as possible to allow your idea to be picked up in the Parliamentary process."
  }

  if (stage === 'STAGE_5') {
    return "Your idea has reached Parliament. Focus on supporting your Parliamentary sponsors and responding to committee questions."
  }

  // Stage 1-2: field-based progress messages
  const diagnosisComplete = !!(diagnosis?.diagnosisTitle && diagnosis?.diagnosisDescription)
  const guidingPolicyComplete = !!(guidingPolicy?.guidingPolicyTitle)
  const hasActions = coherentActions.length > 0

  if (!diagnosisComplete) {
    return "The next step is to complete your Diagnosis. Click Edit to describe the challenge you want to address and work with Lex to identify its root causes."
  }

  if (diagnosisComplete && !guidingPolicyComplete) {
    return "You have completed your Diagnosis. The next step is your Guiding Policy — the broad approach that will address the root causes you've identified. Click Edit to continue."
  }

  if (diagnosisComplete && guidingPolicyComplete && !hasActions) {
    return "Your Diagnosis and Guiding Policy are in place. The next step is to define your Coherent Actions — the specific changes you want to make. Click Edit to continue."
  }

  // All core fields done
  return "You have filled out the basics of the idea. You can now decide whether to do more work on research and refinement before making your idea public — or click 'Take Public' when you're ready."
}
```

### 5d. WhatNext Section 3 — add paragraph about Stage 3 templates

In the "Ways to improve" section (Section 4 of the WhatNext panel), add this as an additional paragraph after the existing team invitation text:

>   "Once your idea moves to Stage 3, you will be able to access various templates designed to help you promote your idea for support in different contexts such as social media or to Parliamentarians, and trackable links to enable you to build a marketing team over multiple levels to campaign and build support for your idea."

### 5e. WhatNext — text change

Find and replace this exact sentence in `WhatNextPanel.tsx`:

Old: `"You can't solve a problem if you don't know what's causing it, and if you identify the wrong causes you'll get the wrong solution."`

New: `"The key to solving any challenge or problem is figuring out what's causing it. This is critically important because if we identify the wrong causes we'll end up with the wrong solution."`

Commit: `feat: idea page layout — Take Public in gate box, Campaign button, WhatNext stage messages (V2B-idealayout)`

***

## COMMIT 6 — Notifications: stage labels, idea name, layout

### Problem

Three things still wrong in the dashboard notification cards:

1.  Notification *titles* still show stage names like "Draft" — the `normaliseStages()` function is applied to the displayed text but the notification title text in the DB was written with stage names (e.g. "Your idea has advanced to Draft!"). Need to normalise at display time.
2.  Idea name missing below the headline.
3.  Layout needs: headline → idea name → [date left \| What Next? right].

### Fix: `components/NotificationCard.tsx`

The `normaliseStages` function needs to map not just `STAGE_X` enum values but also the human-readable stage names that were written into notification messages:

```typescript
function normaliseStages(text: string): string {
  return text
    .replace(/\b(STAGE_1|Create)\b/g, 'Stage 1')
    .replace(/\b(STAGE_2|Draft)\b/g, 'Stage 2')
    .replace(/\b(STAGE_3|Develop)\b/g, 'Stage 3')
    .replace(/\b(STAGE_4|Campaign)\b/g, 'Stage 4')
    .replace(/\b(STAGE_5|Legislate)\b/g, 'Stage 5')
}
```

Update the notification card layout to match the spec:

```tsx
<div className={`rounded-lg border p-3 text-sm transition-colors hover:bg-muted/40 ${
  n.isRead ? 'border-border opacity-60' : 'border-primary/30 bg-primary/5'
}`}>
  {/* Headline */}
  {n.title && <p className="font-medium leading-snug">{normaliseStages(n.title)}</p>}
  
  {/* Idea name — muted, below headline */}
  {n.ideaTitle && (
    <p className="mt-0.5 text-xs text-muted-foreground font-medium">{n.ideaTitle}</p>
  )}
  
  {/* Message body — if different from title */}
  {n.message && n.message !== n.title && (
    <p className="mt-0.5 text-xs text-muted-foreground">{normaliseStages(n.message)}</p>
  )}

  {/* Date left, What Next? right */}
  <div className="mt-1.5 flex items-center justify-between gap-2">
    <p className="text-xs text-muted-foreground">
      {new Date(n.createdAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}
    </p>
    {n.relatedIdeaId && (
      <Link
        href={`/ideas/${n.relatedIdeaId}?whatnext=true`}
        className="text-xs text-muted-foreground underline underline-offset-2 hover:text-foreground"
        onClick={e => e.stopPropagation()}
      >
        What Next?
      </Link>
    )}
  </div>
</div>
```

### Fix: `app/dashboard/page.tsx`

The notification query needs to also fetch the idea title so it can be passed to the card. Update the Prisma query for notifications:

```typescript
// In the notifications query, add a join to get the idea title:
notifications: {
  orderBy: { createdAt: 'desc' },
  take: 10,
  select: {
    id: true,
    title: true,
    message: true,
    linkUrl: true,
    relatedIdeaId: true,
    isRead: true,
    createdAt: true,
    // Join to get idea title:
    relatedIdea: {
      select: { title: true }
    }
  }
}
```

Then pass `ideaTitle: n.relatedIdea?.title ?? null` in the notification data to `NotificationCard`.

Update the `NotificationItem` interface in `NotificationCard.tsx` to include `ideaTitle: string | null`.

Commit: `fix: notifications — stage label normalisation, idea name, layout (V2B-notifications)`

***

## COMMIT 7 — Referral view-only link under Team

### Spec

In `IdeaDetailClient.tsx`, in the Team tab, in the "Core Team" box, add a view-only referral link right-aligned on the same row as the idea owner's name.

This link should be:

-   The idea's referral link: `https://www.scrutinise.org/ideas/${idea.id}?ref=${currentUserReferralCode}`
-   Tracked: any user who signs up or votes via this link is attributed to the idea owner
-   Label: "View-only link" with a copy-to-clipboard button
-   Only visible to the idea owner

### Implementation

In the Team tab's Core Team section, find where the idea owner is displayed. Add to the same row:

```tsx
{isOwner && currentUser?.referralCode && (
  <div className="ml-auto flex items-center gap-2">
    <span className="text-xs text-muted-foreground">View-only link</span>
    <button
      onClick={() => {
        const link = `https://www.scrutinise.org/ideas/${idea.id}?ref=${currentUser.referralCode}`
        navigator.clipboard.writeText(link)
        setReferralLinkCopied(true)
        setTimeout(() => setReferralLinkCopied(false), 2000)
      }}
      className="text-xs px-2 py-1 rounded border border-border hover:bg-muted transition-colors"
    >
      {referralLinkCopied ? 'Copied!' : 'Copy link'}
    </button>
  </div>
)}
```

The `referralLinkCopied` state already exists in `IdeaDetailClient` from Sprint L4. If `currentUser.referralCode` is not already available in scope, it needs to be fetched — check whether the current user object includes `referralCode`. If not, add it to the user fetch in `app/ideas/[id]/page.tsx`.

Commit: `feat: view-only referral link in Team tab Core Team box (V2B-referral-link)`

***

## AFTER ALL COMMITS

```bash
cd scrutinise-web && npx ts-node ../scripts/backfill-credibility.ts  # back-fill existing users
tsc --noEmit        # must be zero errors
git status          # confirm nothing uncommitted
git push origin Main
```

***

## DEFERRED — DO NOT BUILD

-   Sprint V2-C (Legislation DB) — pending R2 bucket creation and 20 test sections from Charlie
-   Vanity referral URLs (`scrutinise.org/[userNumber]`) — V3 backlog

***

*CC Brief — Sprint V2-B — 13 April 2026 — Prepared by CCh* *Read CLAUDE.md and handoff_summary.md before starting.*
