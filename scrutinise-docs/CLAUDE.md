# SCRUTINISE — CLAUDE CODE CONTEXT FILE
*Read this first, every session, before touching any code.*
*Last updated: March 2026*

## CONTENTS
1. Start of Session Checklist
2. Project Overview
3. The Five Stages
4. Key Terminology
5. Repository Structure
6. Critical Architecture Decisions
7. Security Rules
8. Coding Patterns
9. Environment Variables
10. Out of Scope for Sprint 1

---

## 1. START OF SESSION CHECKLIST

Before writing any code, run this checklist:

1. Read `/docs/entity_list_v3.md` — know every entity and field
2. Read `/docs/process_list_v2.md` — know every process you are implementing
3. Read `/docs/system_mechanics_v0.6.md` — know the rules behind what you are building
4. Check `/docs/implementation_plan.md` — confirm what week/day you are on and what is in scope
5. Run `git status` — know where the codebase is before changing it
6. Never assume — if a spec is ambiguous, stop and ask Charlie before building

---

## 2. PROJECT OVERVIEW

Scrutinise is a not-for-profit civic engagement platform enabling citizens, aspiring politicians, and engaged professionals to develop policy ideas into Parliament-ready legislation through a structured, AI-guided collaborative process.

The platform rewards quality contribution through a Credibility Score and five-category points system. The primary user interface for idea development is a conversational AI guide named Lex, not a form.

Stack: Next.js 14 (App Router), TypeScript, Prisma, PostgreSQL (Railway), Cloudflare R2, Clerk Auth, Vercel, Resend (email), Gemini 2.5 Flash / Grok 4.1 Fast (AI)

---

## 3. THE FIVE STAGES

Stage 1 — CREATE: Owner develops basic idea and strategic kernel with Lex. Visibility: private.
Stage 2 — DRAFT: Owner invites collaborators, refines with small team. Visibility: invited only.
Stage 3 — DEVELOP: Opens via referral link, public voting begins, not yet in browse. Visibility: link-only.
Stage 4 — CAMPAIGN: Listed publicly on platform, full community engagement. Visibility: platform-listed.
Stage 5 — PARLIAMENT: Parliamentary submission, MP endorsements, committee tracking. Visibility: public.

---

## 4. KEY TERMINOLOGY — USE EXACTLY, NEVER SUBSTITUTE

- AI assistant = Lex (never "Claude", "the AI", "AI assistant")
- Reputation = Credibility / Credibility Score (never "reputation")
- Points categories = Strategist, Thinker, Rallymaster, Rainmaker, Teambuilder (never "Dealweaver")
- Stage names in UI = Create / Draft / Develop / Campaign / Parliament
- Voting = direction (FOR / AGAINST / UNDECIDED) + strength slider 0–5 in 0.5 increments (NOT a single -5/+5 scale, NOT Support/Oppose/Abstain, NOT upvote/downvote)
- Passion score = average strength across all votes, displayed publicly on idea pages
- All votes are raw and equal (NO vote weighting of any kind)
- SummaryDescription (not "summary" alone)
- ProposedWording (not "draft wording" or "proposed legislation")

---

## 5. REPOSITORY STRUCTURE

```
scrutinise/
├── CLAUDE.md                        (this file — auto-read by CC)
├── docs/
│   ├── entity_list_v3.md            (47 entities, all fields)
│   ├── process_list_v2.md           (processes P01-P55)
│   ├── system_mechanics_v0.6.md     (algorithms, points, credibility, rules)
│   ├── lex_system_prompt_v2.md      (Lex AI system prompt — confidential)
│   ├── wireframes_v3.md             (all 34 wireframe pages with corrections)
│   └── implementation_plan.md      (4-week sprint plan)
├── prisma/
│   └── schema.prisma
├── app/
│   ├── layout.tsx
│   ├── page.tsx                     (homepage — public)
│   ├── (auth)/                      (Clerk sign-in/sign-up)
│   ├── dashboard/page.tsx
│   ├── ideas/
│   │   ├── page.tsx                 (browse — Stage 4+ only)
│   │   ├── [id]/page.tsx            (idea detail)
│   │   └── create/page.tsx          (Lex chat interface)
│   ├── user/[username]/page.tsx     (public profile / referral LP)
│   ├── invite/[token]/page.tsx      (magic link landing)
│   ├── unsubscribe/[token]/page.tsx
│   ├── admin/
│   └── api/
│       ├── webhooks/clerk/          (sync Clerk user to our DB)
│       ├── ideas/
│       ├── votes/
│       ├── comments/
│       ├── amendments/
│       ├── endorsements/
│       ├── groups/
│       ├── notifications/
│       ├── messages/
│       ├── ai/                      (Lex chat endpoint)
│       ├── admin/
│       └── cron/
├── components/
│   ├── ui/                          (shadcn/ui)
│   ├── lex/                         (Lex chat interface)
│   ├── ideas/
│   ├── voting/
│   └── admin/
└── lib/
    ├── prisma.ts
    ├── auth.ts
    ├── stage-gates.ts
    ├── points.ts
    ├── credibility.ts
    ├── notifications.ts
    ├── email.ts
    ├── r2.ts
    └── ai.ts
```

---

## 6. CRITICAL ARCHITECTURE DECISIONS

AUTHENTICATION
- Clerk handles all auth (signup, login, sessions, JWT)
- On Clerk user.created webhook: immediately create our User record in Postgres
- Every protected API route uses auth() from @clerk/nextjs/server

DATABASE
- PostgreSQL on Railway — all relational data
- Prisma ORM — all queries, never raw SQL with user input
- Use prisma.$transaction([...]) for any operation touching multiple tables

FILE STORAGE
- Cloudflare R2 for all user uploads
- Buckets: scrutinise-uploads (private, 24hr signed URLs) and scrutinise-profiles (public CDN)
- ClamAV virus scan on all PDF uploads before storing
- Google Safe Browsing API check on all external URLs submitted by users

AI (LEX)
- Provider assigned at Idea level on creation — locked for the lifetime of that idea
- Primary: Gemini 2.5 Flash (check free tier headroom first)
- Fallback: Grok 4.1 Fast
- Context per call: system prompt + aiChatSummary + last 20 messages + current message
- JSON field updates stripped server-side before returning response to client
- All usage logged in AIUsageLog entity

EMAIL
- Resend for all transactional email
- ALWAYS check EmailSuppression table before sending any email
- Every email includes one-click unsubscribe link
- Double opt-in required on all new accounts

---

## 7. SECURITY RULES — NON-NEGOTIABLE

Apply to every API route, every time:

1. Authenticate: use auth() from Clerk, return 401 if no session
2. Authorise: check this user has permission for this action, return 403 if not
3. Validate inputs: Zod schema on every request body and query param
4. Never raw SQL with user input: always Prisma
5. Sanitise HTML: DOMPurify on all user-generated rich text before storing
6. Hash IPs: SHA-256 hash only, never store raw IP address
7. Rate limit: votes 20/hr per IP; AI 50/hr per user; uploads 10/day per user
8. Check EmailSuppression before every email send, without exception
9. Strip AI JSON: remove fieldUpdates block before returning to client
10. Signed URLs: all private R2 files served via 24hr signed URLs only

---

## 8. CODING PATTERNS

Standard API Route:
```typescript
import { auth } from '@clerk/nextjs/server'
import { prisma } from '@/lib/prisma'
import { z } from 'zod'

const schema = z.object({ title: z.string().min(5).max(200).optional() })

export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  const { userId } = auth()
  if (!userId) return Response.json({ error: 'Unauthorized' }, { status: 401 })
  const parsed = schema.safeParse(await req.json())
  if (!parsed.success) return Response.json({ error: parsed.error }, { status: 400 })
  const [idea, user] = await Promise.all([
    prisma.idea.findUnique({ where: { id: params.id } }),
    prisma.user.findUnique({ where: { clerkId: userId } })
  ])
  if (!idea) return Response.json({ error: 'Not found' }, { status: 404 })
  if (idea.creatorId !== user.id && user.role !== 'ADMIN')
    return Response.json({ error: 'Forbidden' }, { status: 403 })
  return Response.json(await prisma.idea.update({ where: { id: params.id }, data: parsed.data }))
}
```

Prisma Transaction:
```typescript
await prisma.$transaction([
  prisma.vote.create({ data: voteData }),
  prisma.idea.update({ where: { id: ideaId }, data: { voteCount: { increment: 1 } } }),
  prisma.pointsLedger.create({ data: pointsEntry }),
  prisma.reputation.update({ where: { userId: creatorId }, data: { reputationPointsStrategist: { increment: 10 } } })
])
```

---

## 9. ENVIRONMENT VARIABLES

DATABASE_URL=                              (Railway PostgreSQL)
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=
CLERK_SECRET_KEY=
CLERK_WEBHOOK_SECRET=
CLOUDFLARE_ACCOUNT_ID=
R2_ACCESS_KEY_ID=
R2_SECRET_ACCESS_KEY=
R2_BUCKET_UPLOADS=scrutinise-uploads
R2_BUCKET_PROFILES=scrutinise-profiles
R2_PUBLIC_URL=
RESEND_API_KEY=
GEMINI_API_KEY=
GROK_API_KEY=
GOOGLE_SAFE_BROWSING_API_KEY=
NEXT_PUBLIC_GA4_MEASUREMENT_ID=
NEXT_PUBLIC_APP_URL=https://scrutinise.co.uk

---

## 10. OUT OF SCOPE FOR SPRINT 1

Do not build: address book import, offline mode, AI recommendation engine, WhatsApp integration, fundraising/Stripe, SMS verification, Parliament Members API, multi-provider AI beyond Gemini+Grok, bring-your-own API key.

---

## 11. SESSION LOGGING

At the start of every session, remind the user to run:
```bash
bash start-session.sh
```
from the project root before issuing any instructions. This logs the session start and ensures git status is clean before work begins.

---

## 12. GIT DISCIPLINE

After every meaningful piece of work — each component built, each fix applied, each page added — commit immediately with a descriptive message. Do not batch unrelated work into a single commit.

```bash
git add <specific files>
git commit -m "brief description of what was done"
```

**Commit granularity:**
- One component built → one commit
- One bug fixed → one commit
- One page added → one commit
- Spec doc updated → one commit per doc

**Never:**
- Commit multiple unrelated changes together
- Leave a session without committing completed work
- Use vague messages like "updates" or "fixes"

At the end of every session, run `git status` to confirm nothing is left uncommitted.

---
*Update this file immediately whenever a decision changes. Commit the change to GitHub.*
