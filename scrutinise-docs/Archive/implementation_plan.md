# SCRUTINISE — 4-WEEK IMPLEMENTATION PLAN
*Sprint 1 Development Plan*
*Stack: Next.js 14 (App Router) · TypeScript · Prisma · PostgreSQL (Railway) · Cloudflare R2 · Clerk Auth · Vercel*
*Last updated: March 2026*

---

## CONTENTS

1. [Tools & Workflow](#1-tools--workflow)
2. [Pre-Sprint: Clickable Prototype](#2-pre-sprint-clickable-prototype-days-1-3)
3. [Week 1: Foundation](#3-week-1-foundation)
4. [Week 2: Public Features](#4-week-2-public-features)
5. [Week 3: Endorsements, Files, Advanced Features](#5-week-3-endorsements-files-advanced-features)
6. [Week 4: GDPR, Groups, Polish & Launch Prep](#6-week-4-gdpr-groups-polish--launch-prep)
7. [Deferred to Sprint 2](#7-deferred-to-sprint-2)
8. [Environment Variables Checklist](#8-environment-variables-checklist)
9. [Key Dependencies](#9-key-dependencies)
10. [Week-by-Week Success Criteria](#10-week-by-week-success-criteria)

---

## 1. TOOLS & WORKFLOW

| Tool | Role |
|------|------|
| **v0 (Vercel)** | UI design and component generation. Use for every page layout and component before writing logic. Paste wireframe descriptions or screenshots; it generates Tailwind/shadcn components. |
| **Cursor** | Implementation and logic. All business logic, API routes, Prisma queries, and wiring. |
| **Claude.ai** | Architecture decisions, complex logic planning, debugging strategy. |
| **GitHub** | Version control. Commit at end of each day minimum. |
| **Railway** | PostgreSQL database hosting. Free tier sufficient for sprint. |
| **Vercel** | Frontend deployment. Connected to GitHub; auto-deploys on push to main. |

### Sprint Philosophy

Build in vertical slices — each week delivers working, deployable features. Avoid building infrastructure without UI, or UI without wiring. Every day should produce something you can click through.

---

## 2. PRE-SPRINT: CLICKABLE PROTOTYPE (Days 1–3)

**Goal:** All wireframes as real Next.js pages. Hard-coded data. Every nav link works.

Before any database work: create hard-coded HTML pages in Next.js with real navigation but static data. Every link works, every page exists, but no database behind it. This lets you validate UX before investing in database work.

### Setup (Day 1)

```bash
npx create-next-app@latest scrutinise --typescript --tailwind --app
cd scrutinise
npx shadcn-ui@latest init
npm install prisma @prisma/client @clerk/nextjs
npm install @aws-sdk/client-s3 @aws-sdk/s3-request-presigner
npm install resend zod
```

### Pages to Create (Days 1–3)

All pages use hard-coded `const data = {...}` at the top — no API calls yet.

```
app/
  page.tsx                          # Landing / home
  dashboard/page.tsx                # Logged-in dashboard
  ideas/
    page.tsx                        # Browse ideas
    [id]/page.tsx                   # Idea detail
    create/page.tsx                 # Create idea (Lex chat interface)
  user/[username]/page.tsx          # Public profile
  invite/[token]/page.tsx           # Magic link landing
  unsubscribe/[token]/page.tsx      # Email unsubscribe
  admin/
    page.tsx                        # Admin dashboard
    moderation/page.tsx
    users/page.tsx
    verification/page.tsx
```

### v0 Usage for Prototype

For each page, go to v0.dev and describe it. Example prompt:
"Create a Next.js page for a civic platform showing an idea detail page. Include: idea title, 'Campaign' stage badge, vote count, vote direction (FOR/AGAINST/UNDECIDED) + strength slider 0-5, Parliamentary Endorsements section, Comments tab, Amendments tab. Use Tailwind and shadcn/ui. Dark text on white background, clean government-adjacent aesthetic."

Copy generated JSX into your page file and replace placeholder text with your hard-coded data object.

---

## 3. WEEK 1: FOUNDATION

**Goal:** Auth, database, core idea CRUD, Stages 1 & 2 complete.

### Day 1–2: Infrastructure

- [ ] Railway: create PostgreSQL database, copy DATABASE_URL
- [ ] Clerk: create application, copy keys
- [ ] Vercel: connect GitHub repo, add environment variables
- [ ] Create `prisma/schema.prisma` from entity_list_v3.md
- [ ] Run `npx prisma db push` to create all tables
- [ ] Add Clerk provider to `app/layout.tsx`
- [ ] Create `/api/webhooks/clerk/route.ts` to sync Clerk user to our User table on signup

**Why the Clerk webhook matters:** Clerk handles authentication, but we need our own User record in Postgres for all our relational data. The webhook fires when a user signs up in Clerk; we create a matching User record with a generated referralCode.

```typescript
// app/api/webhooks/clerk/route.ts
// On UserCreated event: create User in DB
// referralCode = crypto.randomUUID() — do this here, not later
```

### Day 3–4: Idea Creation (Lex Interface)

- [ ] `/api/ideas` POST — create idea (stage=STAGE_1, visibility=PRIVATE)
- [ ] `/api/ideas/[id]` GET / PATCH — read and update idea
- [ ] `/api/ideas/[id]/progress` POST — stage progression with gate check
- [ ] `/api/ai/[ideaId]` POST — Lex chat endpoint (Gemini Flash primary, Grok fallback)
- [ ] Lex chat UI: two-panel layout (chat left, summary panel right)
- [ ] Auto-save every 30 seconds (debounced PATCH call)
- [ ] Stage gate validation on server — return list of missing fields if not met
- [ ] JSON field update stripping: remove `{"fieldUpdates": {...}}` before returning Lex response to client
- [ ] Field update parsing: apply fieldUpdates to Idea record in DB

**Stage gate pattern:**
```typescript
// lib/stage-gates.ts
export function checkStage1To2(idea: Idea): GateResult {
  const errors: string[] = []
  if (!idea.title?.trim()) errors.push('Title is required')
  if (!idea.summaryDescription?.trim()) errors.push('Summary description is required')
  return { passed: errors.length === 0, errors }
}
```

### Day 5: Idea Collaborators (Stage 2)

- [ ] `IdeaCollaborator` API — invite by email
- [ ] `UserInvite` creation — magicLinkToken generation (crypto.randomUUID())
- [ ] Magic link landing page `/invite/[token]` — account creation + collaborator accept
- [ ] Email sending via Resend (`npm install resend`)
- [ ] Check EmailSuppression table before sending any email

**Why Resend:** Built for Next.js, generous free tier (3,000 emails/month), React email templates. Much simpler than SendGrid for this stack.

---

## 4. WEEK 2: PUBLIC FEATURES

**Goal:** Voting, comments, amendments, Stage 3 public access, referral links.

### Day 1: Voting

- [ ] `Vote` API — POST (create/update), DELETE (withdraw)
- [ ] Vote UI: direction selector (FOR / AGAINST / UNDECIDED) + strength slider (0–5 in 0.5 increments) + optional quality flag checkboxes
- [ ] Update Idea.voteCount and related denormalised fields on every vote (use Prisma transaction)
- [ ] Set wordingLocked=true on first vote received
- [ ] Stage 3→4 eligibility check: when voteCount hits 25, set eligibleForNextStage=true, send notification
- [ ] Guest vote flow: email capture modal → redirect to signup → return to vote (store destination in session)

**Prisma transaction pattern — atomic vote + metric update:**
```typescript
await prisma.$transaction([
  prisma.vote.create({ data: voteData }),
  prisma.idea.update({
    where: { id: ideaId },
    data: { voteCount: { increment: 1 } }
  }),
  prisma.pointsLedger.create({ data: { userId: idea.creatorId, pointsDelta: 10, category: 'STRATEGIST', ... } }),
  prisma.reputation.update({ where: { userId: idea.creatorId }, data: { reputationPointsStrategist: { increment: 10 } } })
])
// All four operations succeed together or none do.
```

### Day 2: Comments

- [ ] `Comment` API — POST, GET (paginated), DELETE (own comments)
- [ ] Owner reply: same endpoint, parentId set (validates that user is idea owner before setting isOwnerReply=true)
- [ ] Comments display: flat list, owner replies indented under parent
- [ ] Comment stance selection: SUPPORTIVE / CRITICAL / NEUTRAL / QUESTION
- [ ] `CommentRating` API — create rating, calculate points

### Day 3: Amendments

- [ ] `Amendment` API — propose, list, get detail
- [ ] `AmendmentVote` API — vote on amendment (SUPPORT/OPPOSE/ABSTAIN)
- [ ] Owner amendment review: accept (Mode A/B), reject, request revision
- [ ] Mode A (consult): create ConsultationVote records, notify voters via Notification helper
- [ ] Mode B (accept): update proposedWording, create WordingHistory, notify voters, open withdrawal window
- [ ] Diff view: display current vs proposed wording side by side
- [ ] Mode B warning: show modal when skipping Mode A

### Day 4: Referral System

- [ ] Referral link format: `/idea/[id]?ref=[referralCode]`
- [ ] Middleware: on any page load with `?ref=` param, write to cookie (60 days) + DB session
- [ ] ReferralEvent creation on vote when referral cookie present
- [ ] 30-day qualification check (cron job): if user has 3+ actions in 30 days, mark qualified, award points

**Cron jobs on Vercel (free tier):**
```json
// vercel.json
{ "crons": [{ "path": "/api/cron/qualify-referrals", "schedule": "0 2 * * *" }] }
```

### Day 5: SEO & GA4

- [ ] GA4 tag in `app/layout.tsx` via `next/script`
- [ ] `trackEvent(name, params)` helper function
- [ ] `generateMetadata()` for idea pages (dynamic title/description)
- [ ] Open Graph image via Vercel OG (`@vercel/og`) — generates preview images dynamically
- [ ] Schema.org Article JSON-LD on idea detail pages
- [ ] `sitemap.ts` — generates sitemap for Stage 4+ ideas
- [ ] `robots.ts` — allow Stage 3+, disallow Stage 1/2

**Why Vercel OG:** When someone shares an idea on social media, Vercel OG generates a beautiful preview image dynamically (title, vote count, stage badge) without pre-generating anything.

---

## 5. WEEK 3: ENDORSEMENTS, FILES, ADVANCED FEATURES

**Goal:** Parliamentary endorsements, file uploads, notifications, admin dashboard basics.

### Day 1: Parliamentary Endorsements

- [ ] `UserParliamentaryVerification` API — claim MP/Peer status
- [ ] Admin verification queue page (`/admin/verification`)
- [ ] `Endorsement` API — give/withdraw (gated: parliamentary_verified=true only)
- [ ] `UserProfessionalVerification` API — claim Draftsman status
- [ ] `DraftsmanEndorsement` API — same pattern, separate entity
- [ ] Endorsements section on idea page (visible to guests)
- [ ] Stage 4→5 gate: checks for 3 Endorsements + 1 DraftsmanEndorsement

### Day 2: File Uploads (Cloudflare R2)

- [ ] R2 client setup (`@aws-sdk/client-s3` pointed at Cloudflare endpoint)
- [ ] Upload API route: validate → ClamAV scan → upload to R2 → create Attachment record
- [ ] Signed URL API route: generate 24hr download URL for private R2 objects
- [ ] Profile image upload: resize to 400×400 (use `sharp` package) → upload to public bucket
- [ ] File display components with download buttons

**ClamAV on Railway:** Add as a Railway service (separate container) or sidecar via Docker. Scan takes 2–5 seconds — show loading indicator.

### Day 3: Notifications

- [ ] Notification create helper function (`lib/notifications.ts`) — use everywhere, never inline
- [ ] Notification API — GET (paginated, filter by type), PATCH (mark read)
- [ ] Bell icon with unread count (polling every 30 seconds, or WebSocket if time allows)
- [ ] Email notifications via Resend — triggered by same helper (checks user notification preferences first)
- [ ] Unsubscribe link in every email → `/unsubscribe/[token]` → adds to EmailSuppression

### Day 4: Private Messaging & Broadcast

- [ ] `MessageThread` + `Message` API — create thread, send, get messages
- [ ] DM UI: inbox list + thread view
- [ ] `BroadcastMessage` API — owner sends to all voters (rate limit: 1 per idea per 7 days)
- [ ] Merge proposal: auto-create MessageThread when merge proposed

### Day 4b: Training & Follow/Watch

- [ ] `Training` API — GET list (with filters), GET detail (admin: POST/PATCH/DELETE)
- [ ] Training page UI (WF-35) — filter bar, resource cards, YouTube inline embed
- [ ] `Follow` API — POST (follow user or watch idea), DELETE (unfollow/unwatch)
- [ ] "Follow" button on user profiles, "Watch" button on idea pages
- [ ] Dashboard sections: "Watching" + "Following" with recent activity
- [ ] Notification triggers: new idea from followed user; stage change/amendment/comment on watched idea

### Day 5: Admin Dashboard

- [ ] Platform overview: total users, ideas by stage, votes cast, comments
- [ ] Idea management: list all ideas with filters, force stage change, hide/remove
- [ ] User management: list users, search, suspend/reinstate
- [ ] Moderation queue: flagged content, take action per permissions matrix
- [ ] Activity log viewer

---

## 6. WEEK 4: GDPR, GROUPS, POLISH & LAUNCH PREP

**Goal:** GDPR compliance, groups, credibility score, merging, QA, launch readiness.

### Day 1: GDPR

- [ ] Double opt-in: send verification email on signup; account inactive until verified
- [ ] Magic link flow handles verification in one click
- [ ] Account deletion: request → 30-day grace → anonymise → suppress email
- [ ] Data export: compile all user records → JSON → upload to R2 → send signed download link
- [ ] EmailSuppression checks in every email-sending function
- [ ] Consent restoration: invitation to suppressed address → special consent page

### Day 2: Groups

- [ ] `Group` CRUD API
- [ ] `GroupInvite` — generate invite link with inviteCode
- [ ] `GroupMember` join via invite link
- [ ] Group invitation email (same magic link flow as individual invites)
- [ ] Associate group with idea (for Stage 3 wider sharing)

### Day 3: Credibility Score & Merging

- [ ] Credibility score calculation: nightly cron job aggregates all inputs, writes to CredibilityScore
- [ ] Phase 1/2 display logic on profile page
- [ ] Merge proposal flow: UI + API (MergedIdea entity)
- [ ] Merge negotiation via MessageThread (auto-created)
- [ ] 14-day voter withdrawal window after merge acceptance
- [ ] Lapse detection cron (30 days)

### Day 4: Polish & Performance

- [ ] Loading states on all async operations
- [ ] Error boundaries on all pages
- [ ] Form validation — client and server side (Zod throughout)
- [ ] Mobile responsiveness check (all pages)
- [ ] Image optimisation (`next/image` everywhere)
- [ ] Lighthouse audit — target 90+ on all metrics
- [ ] Rate limiting on API routes (`@upstash/ratelimit` — Redis-based, pairs well with Vercel Edge)

**Why Zod:** Define data shapes once, use them for both TypeScript types and runtime validation. Define once, use everywhere.

### Day 5: Launch Prep

- [ ] Environment variables: audit all `.env` values are in Railway + Vercel production
- [ ] `prisma migrate deploy` on production DB
- [ ] Seed data: create 3–5 example ideas at various stages for browse page
- [ ] Final QA: user journey end-to-end (create → invite → develop → vote → endorse → Stage 5)
- [ ] robots.txt and sitemap verified
- [ ] GA4 events verified in DebugView
- [ ] Error monitoring: add Sentry (`npm install @sentry/nextjs`) — free tier, essential

---

## 7. DEFERRED TO SPRINT 2

| Feature | Notes |
|---------|-------|
| Address book import (Google Contacts / Outlook OAuth) | P-D1 |
| Offline mode (Dexie.js + service worker) | P-D7 |
| Vector search / AI recommendation engine | P-D2 |
| WhatsApp integration | P-D3 |
| Fundraising (Stripe Connect) | P-D4 |
| Phone (SMS) verification (Twilio) | P-D5 |
| Parliament Members API (automated MP verification) | P-D6 |
| Multi-provider AI (Sprint 1 uses Gemini + Grok only) | |
| Bring-your-own API key (UserAIKey entity) | |

---

## 8. ENVIRONMENT VARIABLES CHECKLIST

```bash
# Database
DATABASE_URL=                              # Railway PostgreSQL

# Auth (Clerk)
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=
CLERK_SECRET_KEY=
CLERK_WEBHOOK_SECRET=

# Cloudflare R2
CLOUDFLARE_ACCOUNT_ID=
R2_ACCESS_KEY_ID=
R2_SECRET_ACCESS_KEY=
R2_BUCKET_UPLOADS=scrutinise-uploads
R2_BUCKET_PROFILES=scrutinise-profiles
R2_PUBLIC_URL=                             # CDN URL for public profiles bucket

# Email (Resend)
RESEND_API_KEY=

# AI Providers
GEMINI_API_KEY=
GROK_API_KEY=

# Security
GOOGLE_SAFE_BROWSING_API_KEY=

# Analytics
NEXT_PUBLIC_GA4_MEASUREMENT_ID=

# Error Monitoring
SENTRY_DSN=

# App
NEXT_PUBLIC_APP_URL=https://scrutinise.co.uk
```

---

## 9. KEY DEPENDENCIES

```json
{
  "dependencies": {
    "next": "14.x",
    "@clerk/nextjs": "latest",
    "@prisma/client": "latest",
    "@aws-sdk/client-s3": "latest",
    "@aws-sdk/s3-request-presigner": "latest",
    "resend": "latest",
    "zod": "latest",
    "isomorphic-dompurify": "latest",
    "sharp": "latest",
    "@vercel/og": "latest",
    "@upstash/ratelimit": "latest",
    "@sentry/nextjs": "latest"
  },
  "devDependencies": {
    "prisma": "latest",
    "typescript": "latest",
    "tailwindcss": "latest"
  }
}
```

---

## 10. WEEK-BY-WEEK SUCCESS CRITERIA

### Pre-Sprint
- [ ] All wireframe pages exist as Next.js pages
- [ ] Every nav link works (even if it goes to a hard-coded page)
- [ ] Charlie has reviewed and approved the UX before database work begins

### Week 1
- [ ] User can sign up and their record appears in the database
- [ ] User can create an idea and chat with Lex
- [ ] Lex responses populate idea fields in the background
- [ ] User can progress idea from Stage 1 to Stage 2
- [ ] User can invite a collaborator via email

### Week 2
- [ ] User can vote on an idea (authenticated)
- [ ] Guest can vote (email capture → signup → vote)
- [ ] User can comment on an idea
- [ ] User can propose and vote on an amendment
- [ ] Owner can accept amendment with voter notification
- [ ] Referral links work and create ReferralEvent records

### Week 3
- [ ] MP/Peer can claim and have status verified
- [ ] Verified MP can endorse an idea
- [ ] Files can be uploaded (virus-scanned, stored in R2)
- [ ] Notifications arrive in-app and by email
- [ ] Admin dashboard shows platform overview

### Week 4
- [ ] Account deletion with 30-day grace period works
- [ ] Data export delivers a downloadable file
- [ ] Groups can be created and joined
- [ ] Credibility Score calculates and displays correctly
- [ ] Merge proposal and execution flow works end-to-end
- [ ] Lighthouse score 90+ on all public pages
- [ ] End-to-end user journey QA passed

---

*implementation_plan.md — Scrutinise — March 2026*
