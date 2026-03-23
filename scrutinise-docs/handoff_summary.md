# SCRUTINISE — CONVERSATION HANDOFF SUMMARY
*Last updated: 23 March 2026 v5*

---

## CURRENT STATE

Sprint 3 complete. The live site at scrutinise.co.uk has:
- Real idea detail pages at `/ideas/[id]` (five-stage stepper, full content, tabs)
- Stage 2→3 "Take Public" flow with warning modal and gate validation
- Contributions API (create, list, owner reply) — tab shows stub pending UI
- Research API (create, list, Safe Browsing check) — tab shows existing research
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

### Built this sprint

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
| `app/api/ai/[ideaId]/route.ts` | 50/hr per-user rate limit added |
| `app/api/ideas/[id]/collaborators/route.ts` | 10/day per-user rate limit added |
| `middleware.ts` | /ideas(.*) and /user(.*) public; contributions/research/users API public |
| `app/sign-in/[[...sign-in]]/page.tsx` | forceRedirectUrl from redirect_url query param |

### Not yet built (deferred)

- `proxy.ts` migration (Next.js codemod — Charlie to run locally: `cd scrutinise-web && npx @next/codemod@latest middleware-to-proxy`)
- Contribution form UI in the Contributions tab (API is ready)
- Research submission form UI in the Research tab (API is ready)
- Vote widget (Sprint 4 — Stage 4+ only)
- Amendment flow (Sprint 4)

---

## SPRINT 4 — OUTSTANDING ITEMS

### Priority 1 — Contribution form UI on idea detail page
The Contributions tab in `IdeaDetailClient.tsx` shows a stub. Wire it to `POST /api/ideas/[id]/contributions` with a form (content textarea, contributionType select, stance select). Display returned contributions using the card spec from CC_Sprint3_Briefing.md Priority 3.

### Priority 2 — Research form UI on idea detail page
The Research tab shows existing research but no add form. Wire `POST /api/ideas/[id]/research` with the full form (title, snippet, relevanceExplanation, sourceUrl, researchType, sourceType, forOrAgainstPolicy, forOrAgainstAction).

### Priority 3 — Vote widget (Stage 4+)
Per system_mechanics_v0.7 — render VoteWidget only when `idea.stage === 'STAGE_4' || idea.stage === 'STAGE_5'`. VoteWidget component already exists in components/.

### Priority 4 — proxy.ts migration (Charlie to run locally)
```
cd scrutinise-web && npx @next/codemod@latest middleware-to-proxy
```

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
| middleware.ts | ✅ Clerk auth middleware (proxy.ts migration pending — Charlie to run) |
| lib/prisma.ts | ✅ Singleton client with PrismaPg adapter |
| lib/auth.ts | ✅ getAuthenticatedUser() + JIT user sync |
| lib/stage-gates.ts | ✅ All three gates |
| lib/email.ts | ✅ Resend + suppression check |
| lib/rateLimit.ts | ✅ In-memory rate limiter |
| app/api/webhooks/clerk/route.ts | ✅ user.created + username fallback |
| app/api/ideas/route.ts | ✅ POST (with empty-string defaults) |
| app/api/ideas/[id]/route.ts | ✅ GET (public/private visibility) + PATCH |
| app/api/ideas/[id]/progress/route.ts | ✅ Stage 2→3 |
| app/api/ideas/[id]/contributions/route.ts | ✅ GET + POST |
| app/api/ideas/[id]/contributions/[commentId]/reply/route.ts | ✅ POST owner reply |
| app/api/ideas/[id]/research/route.ts | ✅ GET + POST (Safe Browsing) |
| app/api/users/[username]/route.ts | ✅ GET public profile |
| app/api/ai/[ideaId]/route.ts | ✅ Lex authenticated + 50/hr rate limit |
| app/api/ai/public/route.ts | ✅ Lex unauthenticated (IP rate limited) |
| app/api/user/onboarding/route.ts | ✅ Consent capture |
| app/api/ideas/[id]/collaborators/route.ts | ✅ Invite + email + 10/day rate limit |
| app/ideas/[id]/page.tsx | ✅ Real idea detail page |
| app/ideas/[id]/IdeaDetailClient.tsx | ✅ Tabbed UI + Take Public modal |
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
Sprint 3 complete. Sprint 4 priorities:
1. Contribution form UI on the Contributions tab (API is live at POST /api/ideas/[id]/contributions)
2. Research form UI on the Research tab (API is live at POST /api/ideas/[id]/research)
3. Vote widget — render VoteWidget only at Stage 4+
4. proxy.ts migration — Charlie to run locally, not a CC task
Do not build: voting widget before confirming Stage 4, amendment flow, groups/team management.
```

---
*handoff_summary.md — Scrutinise — 23 March 2026 v5*
