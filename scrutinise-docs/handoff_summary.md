# SCRUTINISE — CONVERSATION HANDOFF SUMMARY
*Last updated: 23 March 2026 v8*

---

## CURRENT STATE

Sprint 5 complete. The live site at scrutinise.co.uk has:
- Real idea detail pages at `/ideas/[id]` (five-stage stepper, full content, tabs)
- Stage 2→3 "Take Public" flow with warning modal and gate validation
- Stage 3→4 "Begin Campaign" flow with gate checklist (12 reviews + avg quality 2.5) and warning modal
- IdeaReview(VIEWED) creation server-side on every Stage 3+ page visit by authenticated user
- Contributions tab: full form + cards (#N, type/stance badges, truncation, replies, pagination)
- Research tab: full form + cards (type/source badges, relevance toggle, forPolicy/forAction)
- Vote widget: real data-driven VoteWidget at Stage 4/5 only (hidden at Stages 1–3)
- Vote API (GET aggregate + POST upsert with quality flags)
- Amendment flow: POST propose, PATCH owner actions (Accept/Consult/Request Revision/Counter/Reject), POST counter-proposal; full AmendmentsTab UI
- Amendment notifications deep-link to Amendments tab via ?tab=amendments
- Public profile pages at `/user/[username]`
- In-memory rate limiting on AI (50/hr) and invite (10/day) endpoints
- afterSignInUrl returns to originating URL for protected routes

**Branch:** Main (Vercel auto-deploys from Main)

---

## LOCKED DECISIONS

| Decision | Status |
|----------|--------|
| Stage 5 = "Legislate" | LOCKED |
| Voting hidden until Stage 4 | LOCKED |
| "Contributions" not "Comments" in UI | LOCKED |
| "Challenge" not "Problem" in UI (DB stays `diagnosis`) | LOCKED |
| Stage 1→2 = automatic trigger | LOCKED |
| Stage 4→5 = 3 MP + 3 Peer (separate) | LOCKED |
| Minimum age = 18 | LOCKED |
| Group types = MY_TEAM / COMMUNICATIONS / POLICY_DEVELOPMENT | LOCKED |
| SuperAdmin = cl@scrutinise.org | LOCKED |
| 2FA = mandatory ADMIN + SUPER_ADMIN | LOCKED |
| Privacy Log = admin access logged + visible to owner | LOCKED |
| Lex default AI mode = Collaborative | LOCKED |
| Preferred name collected at onboarding (not Clerk custom fields) | LOCKED — Sprint 2 decision |
| Opening message = "I'm Lex, your researcher and guide. What's the challenge you want to fix?" | LOCKED — lex_system_prompt_v4.1 Section 13 |
| Chat input position = follows conversation, not pinned to viewport | LOCKED |
| RH sidebar = 7 fields per lex_system_prompt_v4.1 Section 16 | LOCKED |
| No registration gate before Lex — auth triggered by save prompt | LOCKED |
| /api/webhooks/clerk = public route (Svix-signed, no Clerk session) | LOCKED |
| Stage 2 contributions = internal (isInternal:true), owner + collaborators only; Stage 3+ public contributions are non-internal | LOCKED — 23 Mar 2026 |

---

## SPEC DOCUMENTS — CURRENT VERSIONS

| Document | Version | Notes |
|----------|---------|-------|
| CLAUDE.md | v3 (22-03-26) | ✅ Current |
| entity_list_v4.md | v4 | ⚠️ Needs new fields applied by CCh (see below) |
| process_list_v2.md | v2 | ⚠️ Needs amendment counter-proposal + contributions updates |
| system_mechanics | v0.7 (22-03-26) | ✅ Current |
| lex_system_prompt | v4.1 (22-03-26) | ✅ Current |
| wireframes | v3 | ⚠️ Needs UX fixes logged |
| UX_and_voice_build_notes.md | 13-03-26 | ✅ Incorporated into Sprint 2 build |
| handoff_summary | v5 (23-03-26) | ✅ This file |

---

## SPRINT 3 — COMPLETE ✅

| File | What it does |
|------|-------------|
| `prisma/schema.prisma` | ContributionType enum, Comment.commentNumber/contributionType, Research.forAction |
| `app/ideas/[id]/page.tsx` | Server component: fetches idea, optional auth, visibility gate |
| `app/ideas/[id]/IdeaDetailClient.tsx` | Client: five-stage stepper, tabs, gate checklist, Take Public modal, referral link |
| `app/api/ideas/[id]/route.ts` | Updated GET: public for LINK_ONLY/PLATFORM_LISTED, auth for PRIVATE |
| `app/api/ideas/[id]/contributions/route.ts` | GET (public Stage 3+) + POST (auth, Stage 3+) |
| `app/api/ideas/[id]/contributions/[commentId]/reply/route.ts` | POST owner reply |
| `app/api/ideas/[id]/research/route.ts` | GET (public Stage 3+) + POST (Safe Browsing check) |
| `app/api/users/[username]/route.ts` | GET public profile |
| `app/user/[username]/page.tsx` | Public profile page |
| `lib/rateLimit.ts` | In-memory Map rate limiter |
| `middleware.ts` | /ideas(.*) and /user(.*) public; contributions/research/users API public |
| `app/sign-in/[[...sign-in]]/page.tsx` | forceRedirectUrl from redirect_url query param |

---

## SPRINT 4 — COMPLETE ✅

| File | What it does |
|------|-------------|
| `app/api/ideas/[id]/vote/route.ts` | GET aggregate counts + userVote; POST upsert (Stage 4+ only) with strength, qualityFlags, denormalised voteCount |
| `components/VoteWidget.tsx` | Full rewrite: {ideaId, currentUserId} props, real API, CSS tokens, sign-in prompt, existing vote + Change flow, optimistic updates |
| `app/ideas/[id]/ContributionsTab.tsx` | Full contributions tab: form, cards (#N/type/stance/truncation/author/replies), pagination |
| `app/ideas/[id]/ResearchTab.tsx` | Full research tab: form (all fields + radio groups), cards (type/source badges, relevance toggle) |
| `app/ideas/[id]/IdeaDetailClient.tsx` | Stubs replaced with real imports; VoteWidget at Stage 4/5 only; onResearchAdded + commentCount callbacks |
| `middleware.ts` | /api/ideas/(.*)/vote(.*) added to public routes |

### Not yet built (deferred to Sprint 6)

- Stage 4→5 gate UI ("Submit to Parliament") — 3 MP + 3 Peer + 1 DraftsmanEndorsement + all proposedWording complete
- Endorsement UI (MP/Peer/Draftsman)
- Admin panel
- Credibility calculation
- Groups/team management

---

## SPRINT 5 — COMPLETE ✅

| File | What it does |
|------|-------------|
| `lib/stage-gates.ts` | checkStage3to4Gate, advanceStage3to4, getStage3GateData added |
| `app/api/ideas/[id]/progress/route.ts` | STAGE_3→STAGE_4 branch added |
| `app/ideas/[id]/page.tsx` | IdeaReview(VIEWED) upsert on page visit (Stage 3+, auth only); gate data fetch (Stage 3 + owner only) |
| `app/ideas/[id]/IdeaDetailClient.tsx` | Stage3GateCard + BeginCampaignModal + Begin Campaign button; useSearchParams ?tab= deep-link; AmendmentsTab wired |
| `app/api/ideas/[id]/amendments/route.ts` | GET list (public) + POST propose (auth, Stage 3+), notifications deep-link to Amendments tab |
| `app/api/ideas/[id]/amendments/[amendmentId]/route.ts` | PATCH owner actions: accept/circulate/request_revision/reject |
| `app/api/ideas/[id]/amendments/[amendmentId]/counter/route.ts` | POST counter-proposal (owner only) |
| `app/ideas/[id]/AmendmentsTab.tsx` | Full amendments tab: propose form, expandable cards, owner action panel (5 actions), counter-proposal form |
| `middleware.ts` | /api/ideas/(.*)/amendments added to public routes |

### Design decision logged for Charlie

**Stage 3→4 quality rating:** `system_mechanics_v0.7` specifies "average quality rating ≥ 2.5" but `IdeaReview` has no numeric field. Built as: VIEWED=3, ENDORSED=5, BELOW_STANDARD=0, averaged across all reviews. Passes if avg ≥ 2.5. An idea with 12 pure VIEWED reviews scores 3.0 (passes). Please confirm or advise if a numeric `qualityRating` field should be added to `IdeaReview`.

---

## ENTITY LIST — PENDING ADDITIONS (CCh to apply)

Carried from Sprint 1:

**User:** preferredName ✅ (built), ageConfirmed ✅, tcAgreedAt ✅, rulesAgreedAt ✅, tcVersion ✅, politicalSpectrumX, politicalSpectrumY, manualCredibilityOverride
**Remove from User:** politicalParty, partyMembership
**New entities:** PartyMembership, PlatformConfig ✅ (seeded), IdeaReview
**Amendment:** isCounterProposal, parentAmendmentId
**ActivityLog:** accessType, accessReason, accessedByUserId
**CredibilityScore:** lexLogicScore
**Idea:** maturityIndex, maturityIndexDetail, maturityLastUpdated, credibilityWeightedRating
**CoherentAction:** implementationSubQuestions
**Research:** researchType → Enum ✅ (built), forAction ✅ (Sprint 3)
**Group:** groupType → MY_TEAM / COMMUNICATIONS / POLICY_DEVELOPMENT
**User.aiPreferredStyle:** COLLABORATIVE / SOCRATIC / DIRECT, default COLLABORATIVE
**Comment:** commentNumber ✅ (Sprint 3), contributionType ✅ (Sprint 3)

---

## INFRASTRUCTURE — FULL STATUS

| File | Status |
|------|--------|
| prisma/schema.prisma | ✅ Full schema + Sprint 3 fields |
| prisma/seed.ts | ✅ SuperAdmin + PlatformConfig |
| middleware.ts | ✅ Clerk auth middleware |
| lib/prisma.ts | ✅ Singleton client with PrismaPg adapter |
| lib/auth.ts | ✅ getAuthenticatedUser() + JIT user sync |
| lib/stage-gates.ts | ✅ Stage 1→2 auto, Stage 2→3, Stage 3→4 gate + advance |
| lib/email.ts | ✅ Resend + suppression check |
| lib/rateLimit.ts | ✅ In-memory rate limiter |
| app/api/webhooks/clerk/route.ts | ✅ user.created + username fallback |
| app/api/ideas/route.ts | ✅ POST (with empty-string defaults) |
| app/api/ideas/[id]/route.ts | ✅ GET (public/private visibility) + PATCH |
| app/api/ideas/[id]/progress/route.ts | ✅ Stage 2→3 + Stage 3→4 |
| app/api/ideas/[id]/contributions/route.ts | ✅ GET + POST |
| app/api/ideas/[id]/contributions/[commentId]/reply/route.ts | ✅ POST owner reply |
| app/api/ideas/[id]/research/route.ts | ✅ GET + POST (Safe Browsing) |
| app/api/users/[username]/route.ts | ✅ GET public profile |
| app/api/ai/[ideaId]/route.ts | ✅ Lex authenticated + 50/hr rate limit |
| app/api/ai/public/route.ts | ✅ Lex unauthenticated (IP rate limited) |
| app/api/user/onboarding/route.ts | ✅ Consent capture |
| app/api/ideas/[id]/collaborators/route.ts | ✅ Invite + email + 10/day rate limit |
| app/ideas/[id]/page.tsx | ✅ Real idea detail page |
| app/ideas/[id]/IdeaDetailClient.tsx | ✅ Tabbed UI + Take Public modal + Begin Campaign modal + Stage3GateCard + ContributionsTab + ResearchTab + AmendmentsTab + VoteWidget (Stage 4/5) + DevelopmentHistory (owner, Stage 3+) |
| app/ideas/[id]/ContributionsTab.tsx | ✅ Full form + cards + replies + pagination + Internal badge + Stage 2 support |
| app/ideas/[id]/ResearchTab.tsx | ✅ Full form + cards |
| app/ideas/[id]/AmendmentsTab.tsx | ✅ Full tab: propose form, expandable cards, owner action panel (5 actions), counter-proposal form |
| app/api/ideas/[id]/amendments/route.ts | ✅ GET list + POST propose |
| app/api/ideas/[id]/amendments/[amendmentId]/route.ts | ✅ PATCH owner actions |
| app/api/ideas/[id]/amendments/[amendmentId]/counter/route.ts | ✅ POST counter-proposal |
| app/api/ideas/[id]/vote/route.ts | ✅ GET aggregate + POST upsert (Stage 4+) |
| components/VoteWidget.tsx | ✅ Real API + CSS tokens + auth gate |
| app/ideas/create/page.tsx | ✅ Full Lex chat UI |
| app/user/[username]/page.tsx | ✅ Public profile page |
| app/onboarding/page.tsx | ✅ Post-sign-up onboarding |
| app/invite/[token]/page.tsx | ✅ Magic link landing |
| app/unsubscribe/[token]/page.tsx | ✅ |
| app/sign-in/[[...sign-in]]/page.tsx | ✅ forceRedirectUrl from query param |
| app/sign-up/[[...sign-up]]/page.tsx | ✅ |
| app/sign-out/page.tsx | ✅ |
| app/terms/page.tsx | ✅ |
| app/community-rules/page.tsx | ✅ |

---

## ENVIRONMENT VARIABLES

**Confirmed in Vercel Production:** DATABASE_URL, NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY, CLERK_SECRET_KEY, CLERK_WEBHOOK_SECRET

**Needs verification (may be missing from Production):** GEMINI_API_KEY, GROK_API_KEY, GOOGLE_SAFE_BROWSING_API_KEY

**Not yet set:** RESEND_API_KEY, CLOUDFLARE_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY, R2_PUBLIC_URL, NEXT_PUBLIC_GA4_MEASUREMENT_ID, SENTRY_DSN

---

## KEY TERMINOLOGY

| Use | Never Use |
|-----|-----------|
| Lex | Claude, the AI |
| Credibility Score | Reputation |
| Teambuilder | Dealweaver |
| Create / Draft / Develop / Campaign / Legislate | Stage 1–5, Parliament (as stage name) |
| Contributions (UI) | Comments (UI) |
| Challenge / issue (UI) | Problem (UI) |
| Collaborative (Lex default) | Socratic (as default) |

---

## HOW TO START THE NEXT CC SESSION

```
Read CLAUDE.md and this handoff_summary.md first.
Sprint 5 complete. Sprint 6 priorities:
1. Charlie to confirm Stage 3→4 quality rating interpretation (VIEWED=3/ENDORSED=5/BELOW_STANDARD=0)
   or advise adding qualityRating field to IdeaReview schema.
2. Stage 4→5 gate UI ("Submit to Parliament") — gate: 3 MP + 3 Peer + 1 DraftsmanEndorsement + all proposedWording complete.
3. Endorsement UI (MP/Peer "Below Standard" button, Draftsman endorsement form).
4. Admin panel basics.
Do not build: credibility weighting, groups/team management, fundraising.
```

---
*handoff_summary.md — Scrutinise — 23 March 2026 v8*
