# SCRUTINISE — CONVERSATION HANDOFF SUMMARY
*Last updated: 23 March 2026 v4*

---

## CURRENT STATE

Sprint 2 complete. The live site at scrutinise.org has a working end-to-end flow:
sign-up → onboarding → /ideas/create → Lex chat (unauthenticated via /api/ai/public, authenticated via /api/ai/[ideaId]).

All Sprint 2 production bugs resolved. Clerk webhook firing and creating User records. JIT user sync in place as fallback. AI endpoints (Gemini primary, Grok fallback) operational with structured logging.

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
| handoff_summary | v4 (23-03-26) | ✅ This file |

---

## SPRINT 2 — COMPLETE ✅

### Built this sprint

| File | What it does |
|------|-------------|
| `app/onboarding/page.tsx` | Post-sign-up onboarding: preferredName input, age/T&Cs/rules checkboxes, PATCH to DB, redirect to /ideas/create |
| `app/api/user/onboarding/route.ts` | PATCH handler — writes preferredName, ageConfirmed, tcAgreedAt, rulesAgreedAt, tcVersion |
| `app/ideas/create/page.tsx` | Full Lex chat UI — 75/25 layout, progress bar, 7-field sidebar, voice dictation, file attachment, 3s auto-save, unauthenticated + authenticated paths |
| `app/api/ai/public/route.ts` | Unauthenticated Lex — IP rate limit 20/hr, Gemini+Grok fallback, history in body |
| `app/api/ai/[ideaId]/route.ts` | Updated — completedFields boolean map, structured logging, explicit provider tracking |
| `lib/auth.ts` | JIT user sync — creates User from Clerk API if webhook missed |
| `app/api/webhooks/clerk/route.ts` | Username null fallback, structured error logging |
| `app/api/ideas/route.ts` | summaryDescription/govtArea default to '' (required in schema, populated by Lex) |
| `middleware.ts` | /api/webhooks/clerk → public; /onboarding + /api/user → protected; /ideas/create + /api/ai/public → public |
| `app/layout.tsx` | signUpFallbackRedirectUrl → /onboarding |
| `app/sign-in/[[...sign-in]]/page.tsx` | Updated styling to match design system |
| `app/sign-up/[[...sign-up]]/page.tsx` | Updated styling to match design system |

### Production bugs resolved this sprint

1. Webhook 307 redirect — /api/webhooks/clerk was in `isProtectedRoute`; moved to public
2. Webhook 500 on null username — added firstName fallback matching JIT sync pattern
3. POST /api/ideas empty 500 — summaryDescription + govtArea are `String` (not nullable) in Prisma but were undefined in chat-first creation; now default to ''
4. AI connection error — `getAuthenticatedUser` returned 404 when webhook hadn't fired; JIT sync resolves this
5. Grok silent failure — non-2xx Grok responses were silently converted to 200 with fallback string; now returns 503 with structured log

---

## SPRINT 3 — OUTSTANDING ITEMS

### Priority 1 — Middleware codemod (Charlie to run when ready)
```
npx @next/codemod@latest middleware-to-proxy
```
Next.js 16 deprecates `middleware.ts` in favour of `proxy.ts`. This is a warning, not an error — safe to defer. Do NOT rename manually; use the codemod.

### Priority 2 — Rate limiting
Per CLAUDE.md security rules — not yet implemented on live routes:
- AI endpoints: 50 requests/hr per authenticated user (public endpoint already has 20/hr IP limit)
- Upload endpoints: 10/day per user
- Vote endpoint: 20/hr per IP

### Priority 3 — afterSignInUrl returning to originating URL
Currently `signInFallbackRedirectUrl="/prototype/dashboard"` — signed-in users are always sent to the dashboard after login regardless of where they came from. Should return to the URL they were on when auth was triggered (the `redirect_url` param is already set by middleware for protected routes, but Clerk needs `afterSignInUrl` wired to read it).

### Priority 4 — Stage 2 Lex interface
`app/ideas/[id]/draft/page.tsx` — when an idea advances to Stage 2, the owner continues in the same Lex chat interface but authenticated, with the Stage 2 welcome message from lex_system_prompt_v4.1 Section 13.

### Priority 5 — Legal pages
`/terms` and `/community-rules` are linked from the onboarding checkboxes — pages need to exist. CCh to draft content for solicitor review.

### Priority 6 — API keys confirmation
Verify in Vercel → Settings → Environment Variables (Production):
- `GEMINI_API_KEY` — currently returning "Sorry, Lex is unavailable" (Gemini failing, Grok also failing). Key may be missing or wrong for Production environment specifically.
- `GROK_API_KEY` — same
- `RESEND_API_KEY` — not yet set (email sending not functional)

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
**Research:** researchType → Enum (EVIDENCE, CASE_STUDY, CAUSES, PERSPECTIVES, OTHER)
**Group:** groupType → MY_TEAM / COMMUNICATIONS / POLICY_DEVELOPMENT
**User.aiPreferredStyle:** COLLABORATIVE / SOCRATIC / DIRECT, default COLLABORATIVE

---

## INFRASTRUCTURE — FULL STATUS

| File | Status |
|------|--------|
| prisma/schema.prisma | ✅ Full schema |
| prisma/seed.ts | ✅ SuperAdmin + PlatformConfig |
| middleware.ts | ✅ Clerk auth middleware (proxy.ts migration pending) |
| lib/prisma.ts | ✅ Singleton client with PrismaPg adapter |
| lib/auth.ts | ✅ getAuthenticatedUser() + JIT user sync |
| lib/stage-gates.ts | ✅ All three gates |
| lib/email.ts | ✅ Resend + suppression check |
| app/api/webhooks/clerk/route.ts | ✅ user.created + username fallback |
| app/api/ideas/route.ts | ✅ POST (with empty-string defaults) |
| app/api/ideas/[id]/route.ts | ✅ GET + PATCH |
| app/api/ideas/[id]/progress/route.ts | ✅ Stage 2→3 |
| app/api/ai/[ideaId]/route.ts | ✅ Lex authenticated (Gemini + Grok) |
| app/api/ai/public/route.ts | ✅ Lex unauthenticated (IP rate limited) |
| app/api/user/onboarding/route.ts | ✅ Consent capture |
| app/api/ideas/[id]/collaborators/route.ts | ✅ Invite + email |
| app/onboarding/page.tsx | ✅ Post-sign-up onboarding |
| app/ideas/create/page.tsx | ✅ Full Lex chat UI |
| app/invite/[token]/page.tsx | ✅ Magic link landing |
| app/unsubscribe/[token]/page.tsx | ✅ |
| app/sign-in/[[...sign-in]]/page.tsx | ✅ |
| app/sign-up/[[...sign-up]]/page.tsx | ✅ |

---

## ENVIRONMENT VARIABLES

**Confirmed in Vercel Production:** DATABASE_URL, NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY, CLERK_SECRET_KEY, CLERK_WEBHOOK_SECRET

**Needs verification (may be missing from Production):** GEMINI_API_KEY, GROK_API_KEY

**Not yet set:** RESEND_API_KEY, GOOGLE_SAFE_BROWSING_API_KEY, CLOUDFLARE_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY, R2_PUBLIC_URL, NEXT_PUBLIC_GA4_MEASUREMENT_ID, SENTRY_DSN

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
Sprint 2 is complete. Sprint 3 priorities in order:
1. Confirm GEMINI_API_KEY and GROK_API_KEY are set correctly in Vercel Production
2. Rate limiting on AI (50/hr per user) and upload (10/day) endpoints
3. afterSignInUrl → originating URL
4. Stage 2 Lex interface at app/ideas/[id]/draft/page.tsx
5. /terms and /community-rules placeholder pages
Do not run the proxy.ts codemod manually — use npx @next/codemod@latest middleware-to-proxy when ready.
```

---
*handoff_summary.md — Scrutinise — 23 March 2026 v4*
