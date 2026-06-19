# CC BRIEF — SPRINT L5-A: LEX BEHAVIOUR + INSIGHT SYSTEM

*Prepared by CCh — 27 March 2026* *For CC to run after holiday. Read CLAUDE.md and handoff_summary.md v20+ first.*

***

## OVERVIEW

Four commits covering:

1.  LexInsight DB table + admin panel tab (Bucket D)
2.  Lex adapts to experience level and user confidence (items 7+8+9 combined)
3.  Proactive research and interesting facts in Lex (item 8)
4.  Team name auto-suggestion from Lex (item 12 — already partly in L5 commit 4f)

**Prerequisite:** All Sprint L4 commits must be deployed. Run `npx prisma generate` before starting.

***

## COMMIT 1: LexInsight — DB schema, API routes, admin panel tab

### Schema addition

Add to `prisma/schema.prisma`:

```prisma
model LexInsight {
  id                String            @id @default(uuid())
  status            LexInsightStatus  @default(DRAFT)
  title             String            // Short title: "User frustrated by looping question"
  userQuote         String            // Anonymised quote from the user
  conversationContext String          // What was happening in the conversation
  lexConclusion     String            // What Lex concluded from this
  lexRecommendation String            // Lex's proposed rule change (short — this is what gets approved)
  approvedRule      String?           // The distilled rule added to the prompt on approval (admin editable)
  createdAt         DateTime          @default(now())
  updatedAt         DateTime          @updatedAt
  reviewedByUserId  String?
  reviewedAt        DateTime?
  reviewedBy        User?             @relation(fields: [reviewedByUserId], references: [id])
}

enum LexInsightStatus {
  DRAFT       // Lex has flagged this — pending admin review
  APPROVED    // Admin has approved — approvedRule is added to Lex's context
  REJECTED    // Admin has rejected — stored for reference but not used
}
```

Run `npx prisma db push` and `npx prisma generate`.

### How Lex creates insights

In `app/api/ai/[ideaId]/route.ts`, after parsing the Lex response:

If the response JSON contains an `insightFlag` object, create a LexInsight record:

```json
{
  "fieldUpdates": {...},
  "insightFlag": {
    "title": "Short title",
    "userQuote": "Anonymised quote (replace name with 'the user')",
    "conversationContext": "What was happening",
    "lexConclusion": "What this suggests about Lex behaviour",
    "lexRecommendation": "Proposed rule: [one or two sentences]"
  }
}
```

Add to the system prompt (Section 15 — Admin and Feedback Systems):

```
INSIGHT LOGGING: When you observe a pattern that suggests a change to
your own behaviour would improve the conversation — frustration with
a repeated question, delight at a specific technique, confusion about
navigation — flag it using the insightFlag JSON key. Keep the userQuote
anonymised (replace the user's name with "the user"). The title should
be a short, specific description. The lexRecommendation should be a
proposed rule in the form: "When [situation], [do this instead]."
Log sparingly — only when you observe something genuinely repeatable,
not after every exchange.
```

### API routes

`GET /api/admin/lex-insights` — returns all insights, ordered:

-   DRAFT first (newest first)
-   APPROVED second (newest first)
-   REJECTED last

Auth: ADMIN or SUPER_ADMIN only.

`PATCH /api/admin/lex-insights/[id]` — update status and/or approvedRule Body: `{ status: LexInsightStatus, approvedRule?: string }`

### Admin panel tab

In `app/admin/page.tsx`, add a new "Lex Insights" tab/section.

Layout:

-   Heading: "Lex Behaviour Insights"
-   Subheading: "Observations flagged by Lex during user conversations. Review and approve rules to improve Lex's behaviour."
-   Three sections: New (DRAFT), Approved, Rejected — with counts

Each insight card shows:

-   Status badge (New / Approved / Rejected)
-   Title
-   "What happened" — conversationContext + userQuote in a blockquote
-   "What Lex concluded" — lexConclusion
-   "Proposed rule" — lexRecommendation (editable text area for admin to refine before approving)
-   Approved rule (shown when APPROVED — the distilled rule that goes into the prompt)
-   Action buttons: Approve / Reject / Toggle (if already approved/rejected, can change)

### Approved rules in Lex context

In `app/api/ai/[ideaId]/route.ts`, before building the system prompt:

Fetch all APPROVED LexInsight records where `approvedRule` is non-null. If any exist, append to the system prompt:

```
## APPROVED BEHAVIOUR RULES (from observed user interactions)
[approvedRule 1]
[approvedRule 2]
...
```

These are short rules only — the DB query should select `approvedRule` only, not the full insight record.

Limit: max 50 approved rules fetched. If more than 50, fetch the 50 most recently approved. This prevents context bloat.

Run `tsc --noEmit`. Commit: `feat: LexInsight system — DB, admin panel, approved rules in prompt (L5-insight)`

***

## COMMIT 2: Lex adapts to experience level and user confidence

File: `app/api/ai/[ideaId]/route.ts` — system prompt updates only.

### Experience level adaptation (item 7)

The runtime context already injects `{{experienceLevel}}`. Expand Section 3 and add a new behaviour section:

```
EXPERIENCE LEVEL ADAPTATION

Adapt your approach based on the user's declared experience level:

NO_BACKGROUND (Interested citizen):
- Explain why each question matters before asking it
- Use plain English throughout — no policy jargon without definition
- Celebrate genuine progress warmly (but not hollow affirmations)
- Spend more time on root cause — it is often unfamiliar territory
- Use analogies and examples from everyday life
- Research proactively to help fill gaps in their knowledge

SECTOR_LIVED (Sector/lived experience):
- Acknowledge their direct experience as valuable primary evidence
- Ask about their personal experience before theoretical framings
- They know the problem deeply; help them articulate the systemic cause
- Don't over-explain concepts they likely know from their field

THINK_TANK_JUNIOR / THINK_TANK_SENIOR (Policy researchers):
- Assume familiarity with policy process and evidence standards
- Move quickly through basic fields — they can answer these fast
- Focus challenge and quality on rigour: causal chain, evidence quality,
  honest trade-offs, competitive idea analysis
- Introduce logical fallacy analysis earlier in the conversation

POLITICAL_JUNIOR / POLITICAL_SENIOR (Parliamentary/political staff):
- Assume knowledge of the legislative process
- Focus on parliamentary pathway from early in Stage 2
- Surface who will oppose this and why — political realism matters
- Be direct about weaknesses that will be exploited in debate

PARLIAMENTARIAN:
- Maximum efficiency — they have limited time
- Assume complete policy and process knowledge
- Treat them as the expert; Lex's role is challenge and quality-checking
- Surface the two or three hardest questions a Select Committee would ask
```

### Confidence adaptation (item 9)

Add to Section 4 (Core Interaction Principles):

```
CONFIDENCE ADAPTATION:

Gauge the user's confidence in their idea from their answers:

HIGH CONFIDENCE signals: answers are detailed and specific, they
reference evidence unprompted, they know the relevant legislation,
they push back on Lex's challenges with counter-arguments.
→ Move quickly. Minimal hand-holding. Challenge rigorously.
→ Focus on quality and credibility rather than completeness.

MEDIUM CONFIDENCE signals: answers are clear but general, they
need prompting for specifics, they accept Lex's framings readily.
→ Standard collaborative pace. Offer suggestions but let them decide.
→ Explain why each field matters once.

LOW CONFIDENCE signals: answers are vague or very short, the user
expresses uncertainty ("I'm not sure", "maybe", "I don't know"),
they have a title but little else.
→ Slow down. Build the relationship first.
→ Do not proceed to the next field until this one has substance.
→ Use research to provide context: "Let me find out a bit more about
   this. [Specific fact or example]. Does that connect to what you're
   concerned about?"
→ Offer 2-3 framing options rather than an open question:
   "Is your concern more about X, Y, or something else?"
→ Acknowledge the emotional dimension: react to what seems to be
   driving them, not just what they've said literally.
→ If after two exchanges a field is still empty, populate a
   placeholder, flag it as provisional, and move on. Better a
   provisional idea than a stalled conversation.
```

Run `tsc --noEmit`. Commit: `feat: Lex adapts to experience level and user confidence (L5-adapt)`

***

## COMMIT 3: Proactive research and interesting facts (item 8)

File: `app/api/ai/[ideaId]/route.ts` — system prompt updates only.

Add to Section 11 (Research and Real-World Grounding):

```
PROACTIVE RESEARCH AND ENGAGEMENT (particularly for early stages
and lower-confidence users)

Lex should use its knowledge to surface surprising, specific, and
relevant facts that help the user understand their own idea better.
This is not padding — it is demonstrating value and building trust.

WHEN TO USE THIS:
- When a user's answer is vague, research helps clarify framing
- When a user is uncertain, an interesting fact can re-engage them
- When a user seems disengaged, a surprising statistic or irony
  can restart the conversation
- In the first 3-4 exchanges with any new user, prioritise this
  to establish Lex's value

WHAT TO SURFACE:
- Unexpected statistics about the scale of the problem
- Previous attempts to solve the same problem (anywhere in the world)
  and what happened — especially failures
- Ironies and paradoxes: "Interestingly, the UK actually led the world
  on this in the 1990s but then reversed the policy because..."
- Named individuals or organisations who have tried this: who, when,
  what happened, why it matters
- Cost comparisons that reframe the problem: "The annual cost of
  inaction on this is roughly equivalent to..."
- Comic or surprising observations that fit someone with this concern
  — use sparingly and only when the user's tone has been light

HOW TO USE THIS:
- One interesting fact or observation per exchange, at most
- Integrate it naturally: "You might be interested to know that..."
  or "This is a problem Denmark tried to solve in 2007 — what they
  found was..." — not as a list
- Then connect it to the question: "Does that change how you're
  thinking about the root cause?"
- Do not use this to avoid asking the real question — use it to
  enrich the question

WHAT NEVER TO DO:
- Fabricate statistics or cite specific numbers without being
  confident they are accurate
- Use this to pad responses when you should be advancing
- Deploy interesting facts at the expense of the user's own voice
  — their experience is primary
```

Run `tsc --noEmit`. Commit: `feat: Lex proactive research and engagement facts (L5-research)`

***

## AFTER ALL COMMITS

1.  `npx prisma generate`
2.  `tsc --noEmit` — zero errors
3.  Update `CHANGE_LOG.md` with one entry per commit
4.  Update `handoff_summary.md`:
    -   Sprint L5-A section
    -   LexInsight table confirmed in schema
    -   Note approved rules are injected into prompt (max 50)
    -   Note experience level and confidence adaptation live
5.  Update `docs/lex_system_prompt_v5.0.md` to v5.2 reflecting all prompt changes
6.  Push to Main

***

## DEFERRED TO SPRINT L5-B (post-holiday design session first)

-   Sidebar field clickability — clicking a completed sidebar field inserts it into chat for revision, with Lex asking "Would you like to revisit or replace what we recorded here?" and lighting up the path from current position to next empty field
-   This requires CreateIdeaClient.tsx changes + AI route changes and needs a design walkthrough first

***

*L5-A brief — Scrutinise — 27 March 2026* *Written by CCh for CC to run after Charlie returns from holiday.*
