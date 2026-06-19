# CC BRIEFING — SPRINT 2

*Produced by CCh — 22 March 2026 v1* *Read README.md and this file before writing any code.* *Sprint 1 is complete and deployed. scrutinise.org is live with real Railway DB.*

***

## CRITICAL — READ FIRST

>   **Stage 5 = "Legislate". Voting hidden at Stages 1–3. "Comments" = "Contributions" in UI. "Problem" = "Challenge" in UI. Lex default mode = Collaborative. preferredName injected into every Lex call.** **SuperAdmin: cl@scrutinise.org — seeded in Railway DB. clerkId = PENDING_CLERK_LINK (update after Charlie registers).**

***

## 1. CURRENT STATE

Sprint 1 complete and deployed to production (scrutinise.org, commit 81275f1 + Prisma/adapter fixes).

**What works:**

-   Full Prisma schema live in Railway (30 tables)
-   Clerk middleware protecting /prototype/\* and /api/\*
-   Clerk webhook creating User records on sign-up
-   All idea CRUD API routes (POST, GET, PATCH)
-   Lex AI endpoint (Gemini 2.5 Flash + Grok fallback)
-   Stage gates (1→2 auto, 2→3 manual)
-   Collaborator invite API + magic link + unsubscribe pages
-   Email via Resend with EmailSuppression check
-   Seed: SuperAdmin + 9 PlatformConfig defaults
-   All 8 prototype fixes deployed

**What is NOT yet wired:**

-   Clerk sign-up custom fields (preferredName, age confirmation, T&Cs, community rules)
-   afterSignUpUrl/afterSignInUrl returning to originating URL (currently hardcoded to /prototype/dashboard)
-   Auto-save frontend (the 30-second debounced PATCH on the Lex chat page)
-   Real Lex chat UI connected to the API endpoint
-   Rate limiting
-   SuperAdmin clerkId needs updating after Charlie registers cl@scrutinise.org in Clerk

***

## 2. SPRINT 2 TASK LIST

### Priority 1 — Complete Auth Wiring (Days 1–2)

**Task 1a — Clerk custom sign-up fields**

Add these fields to the Clerk sign-up form via Clerk Dashboard (not code):

-   Go to Clerk Dashboard → User & Authentication → Email, Phone, Username
-   Add custom attribute: `preferredName` (label: "How would you like Lex to address you?", optional, default = firstName)
-   Add custom attribute: `ageConfirmed` (boolean checkbox: "I confirm I am 18 or over", required)
-   Add custom attribute: `tcAgreed` (boolean checkbox: "I agree to the Terms of Service", required)
-   Add custom attribute: `rulesAgreed` (boolean checkbox: "I agree to the Community Rules", required)

Then update `app/api/webhooks/clerk/route.ts` to read these custom attributes from the webhook payload and write them to the User record:

```typescript
const { preferredName, ageConfirmed, tcAgreed, rulesAgreed } = evt.data.unsafe_metadata
// or evt.data.public_metadata depending on where Clerk stores custom fields
```

**Task 1b — afterSignUpUrl/afterSignInUrl to originating URL**

Currently: `signInFallbackRedirectUrl="/prototype/dashboard"` in layout.tsx Required: User returns to where they were before sign-in/sign-up

Replace the static fallback with dynamic redirect using Clerk's `redirectUrl` param:

-   On any protected page, if user is not logged in, redirect to Clerk sign-in with `?redirect_url=` set to the current page URL
-   On the homepage Sign Up / Get Started buttons, pass `?redirect_url=/prototype/create/stage1`

Update `app/layout.tsx`:

```tsx
<ClerkProvider
  signInFallbackRedirectUrl="/prototype/dashboard"
  signUpFallbackRedirectUrl="/prototype/create/stage1"
>
```

And update middleware to pass the current URL as redirect_url when redirecting unauthenticated users.

**Task 1c — Update SuperAdmin clerkId**

Charlie will provide the clerkId after registering cl@scrutinise.org in Clerk. When provided, run:

```typescript
await prisma.user.update({
  where: { email: 'cl@scrutinise.org' },
  update: { clerkId: 'user_XXXX' }
})
```

Via `npx prisma studio` or a one-off script.

***

### Priority 2 — Lex Chat UI (Days 3–5)

This is the most important Sprint 2 deliverable. The API endpoint exists — it needs a real frontend.

**Task 2a — Real Lex chat interface on /ideas/create**

Build the real idea creation page (not the prototype mock) at `app/ideas/create/page.tsx`.

Key requirements from `UX_and_voice_build_notes.md` and `lex_system_prompt_v4.md`:

**Layout:**

-   Left panel (75%): Lex conversation
-   Right panel (25%): Field completion sidebar (7 fields with completion state)
-   Mobile: stacked, chat on top, sidebar collapsed/expandable

**Chat behaviour:**

-   Auto-expanding textarea input
-   Input positioned IMMEDIATELY below last Lex message — NOT pinned to viewport bottom
-   Previous messages scroll upward
-   Scroll-up arrow button appears when history exists above viewport
-   Enter sends, Shift+Enter for new line
-   Cursor auto-focused on page load — no click required
-   Auto-save every 30 seconds (debounced PATCH to /api/ideas/[id])

**Progress indicator:**

-   Starts at 20% on first message sent
-   30% after background question answered
-   45% after diagnosis populated
-   60% after guidingPolicy populated
-   75% after first coherentAction populated
-   90% after all core fields populated
-   100% on user confirms

**Opening flow:**

1.  Page load: create Idea record (POST /api/ideas) if none exists, get ideaId
2.  If user not signed in: show Lex chat but don't create DB record yet — trigger save prompt after first Strategic Kernel draft (triggerSavePrompt flag in Lex response)
3.  Lex opening message displayed immediately (from lex_system_prompt_v4.md Section 13):

>   "I'm Lex, your researcher and guide. What's the challenge you want to fix?"

**API integration:**

-   POST to /api/ai/[ideaId] on each user message
-   Parse JSON response — strip fieldUpdates before display (already done server-side)
-   Update right-panel completion state based on fieldUpdates received
-   Watch for `triggerSavePrompt: true` in response — surface Clerk sign-up modal

**RH sidebar — 7 fields (in order):**

1.  What's the Challenge? (diagnosis)
2.  What's Causing It? (rootCause)
3.  How Will We Solve It? (guidingPolicy)
4.  A Practical Step (coherentActions — at least one)
5.  Who's Affected? (whoAffected on Diagnosis)
6.  Evidence Base (research — at least one)
7.  Proposed Wording (proposedWording)

Each field shows: grey dot (not started) → amber dot (in progress) → green tick (complete)

**Task 2b — Stage 2 Lex interface on /ideas/[id]/draft**

When a user's idea advances to Stage 2 automatically, show the Stage 2 welcome message and continue the conversation in the same chat interface.

The welcome message is injected by the backend as the first message in the Stage 2 conversation — it comes from the Lex API, not hardcoded in the frontend.

***

### Priority 3 — Middleware → Proxy Migration (Day 5 or separate commit)

Use the official Next.js codemod — do NOT rename manually:

```bash
cd scrutinise-web && npx @next/codemod@latest middleware-to-proxy
```

This will:

-   Rename `middleware.ts` to `proxy.ts`
-   Rename the exported function from `middleware` to `proxy`
-   Update any config references

After running: confirm `npx tsc --noEmit` passes, confirm Clerk auth still protects /prototype/\* routes.

***

### Priority 4 — Rate Limiting (Day 5)

Add rate limiting middleware using Upstash Redis or simple in-memory for MVP:

| Endpoint                                 | Limit                |
|------------------------------------------|----------------------|
| POST /api/ai/[ideaId]                    | 50 per hour per user |
| POST /api/ideas/[id] (votes, when built) | 20 per hour per IP   |
| POST /api/ideas/[id]/collaborators       | 10 per day per user  |

Simple approach for now: use a Map in memory with user ID + timestamp buckets. Upstash Redis for production-grade (add to env vars).

***

## 3. DO NOT BUILD IN SPRINT 2

Voice dictation UI (Sprint 3), Red Team mechanic (Sprint 4), Campaign in a Box (Sprint 5), contributions/comments UI (Sprint 3), voting UI (Sprint 4), amendment flow (Sprint 4), profile pages (Sprint 3), Privacy Log UI (Sprint 3), field encryption (Sprint 5), credibility weighting (Sprint 5).

***

## 4. SPRINT 2 SUCCESS CRITERIA

1.  New user signs up on scrutinise.org — consent fields (preferredName, ageConfirmed, tcAgreedAt, rulesAgreedAt) populate in Railway User table
2.  After sign-up, user returns to where they started (not /prototype/dashboard)
3.  User reaches /ideas/create — Lex opening message appears: "I'm Lex, your researcher and guide. What's the challenge you want to fix?"
4.  User types a response — Lex replies with the background question
5.  Conversation continues — fields populate in DB silently
6.  When title + summaryDescription are populated, idea auto-advances to Stage 2 — Lex welcome message fires
7.  Auto-save confirmed — PATCH fires every 30 seconds, Railway shows updated idea record
8.  middleware → proxy.ts migration complete — no deprecation warning in build log
9.  SuperAdmin clerkId updated — cl@scrutinise.org has correct Clerk ID in Railway

***

## 5. COMMIT DISCIPLINE

```
feat: wire Clerk custom sign-up fields (preferredName, age, T&Cs, rules)
feat: afterSignUpUrl returns to originating URL
feat: real Lex chat UI — Stage 1 idea creation
feat: right-panel field completion sidebar
feat: auto-save debounced PATCH every 30s
feat: progress indicator 20%→100%
chore: migrate middleware.ts → proxy.ts via Next.js codemod
feat: basic rate limiting on AI and invite endpoints
```

Update CHANGE_LOG.md and handoff_summary.md at session end.

***

*CC_Sprint2_Briefing.md — Scrutinise — 22 March 2026 v1*
