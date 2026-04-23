# CC BRIEFING — SPRINT 3

*Produced by CCh — 22 March 2026 v1* *Read README.md and this file before writing any code.* *Sprint 2 is complete and deployed. scrutinise.org has working auth, onboarding, and Lex chat.*

***

## CRITICAL — READ FIRST

>   **Stage 5 = "Legislate". Voting hidden at Stages 1–3. "Comments" = "Contributions" in UI. "Problem" = "Challenge" in UI. Lex default mode = Collaborative. preferredName injected into every Lex call.** **All webhook, auth, and Lex endpoints are confirmed working. Railway has live data.**

***

## 1. CURRENT STATE

Sprint 2 complete. End-to-end flow verified on production:

-   Sign up → Onboarding → `/ideas/create` → Lex responds using `preferredName` ✅
-   Clerk webhook working (`www.scrutinise.org/api/webhooks/clerk`) ✅
-   Railway User + Idea records created ✅
-   Gemini 2.5 Flash responding correctly ✅

**Still outstanding from Sprint 2 (carry into Sprint 3):**

1.  `middleware.ts` → `proxy.ts` migration (Next.js codemod — see Priority 4)
2.  Rate limiting on AI + invite endpoints
3.  `afterSignInUrl` returning to originating URL for returning users (currently fallback to `/prototype/dashboard`)

***

## 2. SPRINT 3 GOAL

Make ideas publicly visible and make it possible to receive contributions from other users. By end of Sprint 3, a user can: create an idea with Lex, progress it to Stage 3, share a referral link, and receive contributions from others.

***

## 3. TASK LIST

### Priority 1 — Real Idea Detail Page (Days 1–2)

Replace the prototype mock at `app/prototype/idea/[id]/page.tsx` with a real data-driven page at `app/ideas/[id]/page.tsx`.

**Layout (per wireframes_v3.md):**

-   Five-stage progress stepper at top (wired to real `idea.stage`)
-   Title, summaryDescription, owner, created date, credibility score
-   Stage requirements card (gate checklist for current stage)
-   Tabs: Overview \| Contributions \| Research \| Amendments \| Team
-   Overview tab: diagnosis summary, guiding policy summary, coherent actions list
-   Stage-appropriate action button: "Progress to Stage 3" (if Stage 2 gate met) or "Begin Campaign" (Stage 4 gate) etc.
-   Vote widget: **hidden entirely at Stages 1, 2, 3** — rendered only at Stage 4+

**Data fetching:**

-   `GET /api/ideas/[id]` already exists — use it
-   Owner sees full edit controls; other users see read-only view
-   Stage 3+: visible to anyone with the link (LINK_ONLY visibility)
-   Stage 4+: publicly listed (PLATFORM_LISTED)

**Privacy log middleware already wired** — admin access creates ActivityLog record automatically.

***

### Priority 2 — Stage 2→3 Manual Progression (Day 2)

Wire the "Take Public" button on the idea detail page.

**Gate criteria (system_mechanics_v0.7.md Section 1.2):**

-   diagnosis non-empty
-   guidingPolicy non-empty
-   ≥1 CoherentAction record
-   ≥3 Research records
-   Warning modal required before proceeding

`POST /api/ideas/[id]/progress` **already exists** — it validates the Stage 2→3 gate. The frontend just needs to call it with a confirmation modal.

**After progression:**

-   stage = STAGE_3, visibility = LINK_ONLY
-   referralLinkActive = true
-   Referral link shown to owner: `scrutinise.org/ideas/[id]?ref=[user.referralCode]`

***

### Priority 3 — Contributions (Days 3–4)

Build the Contributions tab on the idea detail page. UI label throughout: **"Contributions"** (never "Comments").

`POST /api/ideas/[id]/contributions` — new route needed:

```typescript
// Zod schema
const ContributionSchema = z.object({
  content: z.string().min(1).max(5000),
  contributionType: z.enum([
    'NEW_INFORMATION',
    'RED_TEAM_CHALLENGE', 
    'MINOR_ADJUSTMENT',
    'ADDITIONAL_COHERENT_ACTION',
    'AMENDMENT',
    'OTHER'
  ]),
  stance: z.enum(['SUPPORTIVE', 'CRITICAL', 'NEUTRAL', 'QUESTION']),
})
```

-   Creates Comment record with `contributionType` and `commentNumber` (sequential per idea)
-   Owner notified (in-app notification record)
-   Available at Stage 3+

`GET /api/ideas/[id]/contributions` — new route needed:

-   Returns contributions ordered by `helpfulCount DESC`, then `createdAt ASC`
-   First 10 shown as snippets; "Show more" at 10+
-   Owner can see all; others see only published contributions

**Contribution display card:**

-   Contribution number (\#1, \#2...)
-   Contribution type badge
-   Stance indicator
-   Content (truncated to 200 chars with "Read more")
-   Author name + credibility score
-   Helpful/not helpful count
-   "Reply" button (owner only)

**Owner reply:**

-   `POST /api/ideas/[id]/contributions/[commentId]/reply`
-   Creates Comment with `parentId` and `isOwnerReply: true`
-   Displayed indented under original

***

### Priority 4 — Research Tab (Day 4)

`POST /api/ideas/[id]/research` — new route:

```typescript
const ResearchSchema = z.object({
  title: z.string().min(1).max(200),
  snippet: z.string().min(1).max(500),
  relevanceExplanation: z.string().min(1).max(500),
  sourceUrl: z.string().url(),
  researchType: z.enum(['EVIDENCE', 'CASE_STUDY', 'CAUSES', 'PERSPECTIVES', 'OTHER']),
  sourceType: z.enum(['ACADEMIC', 'GOVERNMENT', 'NEWS', 'CASE_STUDY', 'LEGISLATION', 'OTHER']),
  forOrAgainstPolicy: z.boolean().optional(),
  forOrAgainstAction: z.boolean().optional(),
})
```

-   Google Safe Browsing check on `sourceUrl` (use `GOOGLE_SAFE_BROWSING_API_KEY`)
-   Available to owner+editors at Stage 2+; all users at Stage 3+
-   Required for Stage 2→3 gate (≥3 records)

`GET /api/ideas/[id]/research` — list all research for an idea

***

### Priority 5 — Basic Profile Page (Day 5)

Build `app/user/[username]/page.tsx` — public profile.

**Shows:**

-   Display name, username, bio, join date
-   Credibility score (phase-appropriate display)
-   Ideas owned by this user (Stage 3+ only, public)
-   Contribution count

**No editing on this page** — editing is in Settings.

***

### Priority 6 — Remaining Sprint 2 Items (Day 5)

**6a — proxy.ts migration** Run the official Next.js codemod — do NOT rename manually:

```bash
cd scrutinise-web && npx @next/codemod@latest middleware-to-proxy
```

Confirm `npx tsc --noEmit` passes. Confirm Clerk auth still protects routes.

**6b — Rate limiting** Add simple in-memory rate limiting to AI and invite endpoints:

```typescript
// lib/rateLimit.ts
const limits = new Map<string, { count: number; reset: number }>()

export function checkRateLimit(key: string, max: number, windowMs: number): boolean {
  const now = Date.now()
  const entry = limits.get(key)
  if (!entry || now > entry.reset) {
    limits.set(key, { count: 1, reset: now + windowMs })
    return true
  }
  if (entry.count >= max) return false
  entry.count++
  return true
}
```

Apply to:

-   `POST /api/ai/[ideaId]`: 50 per hour per userId
-   `POST /api/ideas/[id]/collaborators`: 10 per day per userId

**6c — afterSignInUrl to originating URL** In `middleware.ts` (or `proxy.ts` after migration), when redirecting unauthenticated users to sign-in, pass the current URL as `redirect_url`:

```typescript
const signInUrl = new URL('/sign-in', req.url)
signInUrl.searchParams.set('redirect_url', req.nextUrl.pathname)
return NextResponse.redirect(signInUrl)
```

Update `app/sign-in/[[...sign-in]]/page.tsx` to pass `forceRedirectUrl` from the query param.

***

## 4. NEW API ROUTES SUMMARY

| Method | Route                                           | Auth             | Description         |
|--------|-------------------------------------------------|------------------|---------------------|
| GET    | /api/ideas/[id]/contributions                   | Optional         | List contributions  |
| POST   | /api/ideas/[id]/contributions                   | Required         | Create contribution |
| POST   | /api/ideas/[id]/contributions/[commentId]/reply | Required (owner) | Owner reply         |
| GET    | /api/ideas/[id]/research                        | Optional         | List research       |
| POST   | /api/ideas/[id]/research                        | Required         | Add research        |
| GET    | /api/users/[username]                           | Optional         | Public profile data |

***

## 5. DO NOT BUILD IN SPRINT 3

Voting widget (Sprint 4), amendment flow (Sprint 4), groups/team management (Sprint 4), credibility score calculation (Sprint 4), endorsements (Sprint 5), admin panel (Sprint 6), Privacy Log UI (Sprint 6), campaign page (Sprint 4).

***

## 6. SPRINT 3 SUCCESS CRITERIA

1.  User creates an idea with Lex → advances to Stage 2 automatically → idea detail page at `/ideas/[id]` shows real data with five-stage stepper
2.  User adds ≥3 Research records via the Research tab
3.  User clicks "Take Public" → warning modal → Stage 2→3 gate validates → idea advances to Stage 3 → referral link appears
4.  Another user visits the referral link → sees the idea → can leave a Contribution (Stage 3+)
5.  Owner sees the Contribution on the Contributions tab with notification
6.  Owner replies to the Contribution
7.  Public profile page at `/user/[username]` shows user's public ideas
8.  `proxy.ts` migration complete — no deprecation warning in build log
9.  Rate limiting active on AI endpoint — rapid repeated calls return 429

***

## 7. COMMIT DISCIPLINE

```
feat: real idea detail page at /ideas/[id]
feat: Stage 2→3 progression modal and gate validation
feat: contributions API (create, list, owner reply)
feat: research API (create, list, Safe Browsing check)
feat: public profile page at /user/[username]
chore: migrate middleware.ts → proxy.ts via Next.js codemod
feat: in-memory rate limiting on AI and invite endpoints
fix: afterSignInUrl returns to originating URL
```

Update CHANGE_LOG.md and handoff_summary.md at session end.

***

*CC_Sprint3_Briefing.md — Scrutinise — 22 March 2026 v1*
