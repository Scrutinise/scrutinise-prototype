# SCRUTINISE — CONVERSATION HANDOFF SUMMARY
*Last updated: 22 March 2026 v3*

---

## CURRENT STATE

Sprint 1 Week 1 complete. All 8 prototype fixes applied. Full infrastructure built: schema, auth, API routes, Lex AI endpoint, collaborator invite flow. Build passes `npx tsc --noEmit` (only pre-existing errors from ungenerated Prisma client — expected until `prisma generate` runs).

**Awaiting from Charlie before the app can run end-to-end:**
1. `DATABASE_URL` — Railway PostgreSQL connection string → add to `.env` and Vercel
2. `RESEND_API_KEY` — add to Vercel
3. Run `cd scrutinise-web && npx prisma db push` then `npx prisma generate`
4. Run `npm run db:seed` (creates SuperAdmin + PlatformConfig defaults)
5. ✅ SuperAdmin clerkId set: `user_3BIGzFJCth6bdtHpXmwCcXPuYVR`

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
| SuperAdmin = cl@scrutinise.org | LOCKED — registered in Clerk |
| 2FA = mandatory ADMIN + SUPER_ADMIN | LOCKED |
| Privacy Log = admin access logged + visible to owner | LOCKED |
| Lex default AI mode = Collaborative | LOCKED |
| Preferred name field on sign-up | LOCKED |
| Stage 2 welcome message = confirmed wording in Lex prompt v4.1 | LOCKED |
| Amendment counter-proposal = new flow added | LOCKED |
| Chat input position = follows conversation, not pinned to viewport | LOCKED |
| RH sidebar = 7 correct fields per Lex prompt Section 16 | LOCKED |

---

## SPEC DOCUMENTS — CURRENT VERSIONS

| Document | Version | Notes |
|----------|---------|-------|
| CLAUDE.md | v3 (22-03-26) | ✅ Current |
| entity_list_v4.md | v4 | ⚠️ Needs new fields applied by CCh (see below) |
| process_list_v2.md | v2 | ⚠️ Needs amendment counter-proposal + contributions updates |
| system_mechanics | v0.7 (22-03-26) | ✅ Current |
| lex_system_prompt | v4.1 (22-03-26) | ✅ Current |
| wireframes | v3 | ⚠️ Needs UX fixes logged (input position, progress bar, etc.) |
| CC_Sprint1_Briefing.md | v2 (22-03-26) | ✅ Current |
| UX_and_voice_build_notes.md | 13-03-26 | ✅ Queue for Lex UI sprint — do not action Sprint 1 |
| handoff_summary | v2 (22-03-26) | ✅ This file |

---

## ENTITY LIST — PENDING ADDITIONS (CCh to apply)

New fields and entities from pre-build review + prototype feedback:

**User:** preferredName, ageConfirmed, tcAgreedAt, rulesAgreedAt, tcVersion, politicalSpectrumX, politicalSpectrumY, manualCredibilityOverride
**Remove from User:** politicalParty, partyMembership
**New entities:** PartyMembership, PlatformConfig, IdeaReview
**Amendment:** isCounterProposal, parentAmendmentId
**ActivityLog:** accessType, accessReason, accessedByUserId
**CredibilityScore:** lexLogicScore
**Idea:** maturityIndex, maturityIndexDetail, maturityLastUpdated, credibilityWeightedRating
**CoherentAction:** implementationSubQuestions
**Research:** researchType → Enum (EVIDENCE, CASE_STUDY, CAUSES, PERSPECTIVES, OTHER)
**Group:** groupType → MY_TEAM / COMMUNICATIONS / POLICY_DEVELOPMENT
**User.aiPreferredStyle:** clarify values as COLLABORATIVE / SOCRATIC / DIRECT, default COLLABORATIVE

---

## OUTSTANDING ITEMS

1. **entity_list_v4.md** — CCh to apply all new fields above before next CC session.
2. **process_list_v2.md** — CCh to update: P02 (auto-trigger), P17 (counter-proposal option), P20 (Contributions + types), new P13a (preferred name/welcome message onboarding), amendment notification routing rule.
3. **wireframes_v3.md** — CCh to update: chat input position, five-stage progress bar on idea page, RH sidebar correct fields, settings AI mode descriptions, referral page Legislate fix, amendment notification routing note.
4. **Age risk assessment** — Charlie requested formal ICO Children's Code assessment. CCh to produce.
5. **T&Cs / Privacy Policy / Community Rules** — CCh to draft templates for solicitor review. Sprint 2.
6. **Homepage videos** — Charlie sourcing two replacement videos. Spec: 16:9, 2560×1440, cinematic loop.
7. **Research video URL** — homepage has placeholder. Charlie to supply URL.
8. **process_list_v2.md header** — references v3 entity list. Update to v4 next touch.
9. **70/30 AI credit split** — confirmed 70/30 but payment mechanism TBC.
10. **wireframes_v3.md** — ASCII sketches still needed for WF-11, WF-13, WF-33.
11. **Contribution wireframes** — confirm creating/rating/replying-to-contribution pages exist.

---

## PROTOTYPE FIXES — ALL COMPLETE ✅

1. ✅ Referral pages: "Parliament" → "Legislate"
2. ✅ Stage 2 Lex: opening message ("What's the challenge you want to fix?")
3. ✅ Stage 2 Lex: RH sidebar — 7 correct fields
4. ✅ Chat input: follows conversation, not pinned to viewport
5. ✅ Idea page: five-stage progress stepper
6. ✅ Amendment notifications: deep-link to ?tab=amendments
7. ✅ Settings: AI mode descriptions + Collaborative as default
8. ✅ Homepage Step 3: "open to referral-link scrutiny" (voting removed)

---

## SPRINT 1 INFRASTRUCTURE — COMPLETE ✅

| File | Status |
|------|--------|
| prisma/schema.prisma | ✅ Full Sprint 1 schema |
| prisma/seed.ts | ✅ SuperAdmin + PlatformConfig |
| middleware.ts | ✅ Clerk auth middleware |
| lib/prisma.ts | ✅ Singleton client |
| lib/auth.ts | ✅ getAuthenticatedUser() |
| lib/stage-gates.ts | ✅ All three gates |
| lib/email.ts | ✅ Resend + suppression check |
| app/api/webhooks/clerk/route.ts | ✅ |
| app/api/ideas/route.ts | ✅ POST |
| app/api/ideas/[id]/route.ts | ✅ GET + PATCH |
| app/api/ideas/[id]/progress/route.ts | ✅ Stage 2→3 |
| app/api/ai/[ideaId]/route.ts | ✅ Lex (Gemini + Grok fallback) |
| app/api/ideas/[id]/collaborators/route.ts | ✅ Invite + email |
| app/invite/[token]/page.tsx | ✅ Magic link landing |
| app/unsubscribe/[token]/page.tsx | ✅ |

**Still outstanding (Sprint 1 → next session):**
- Auto-save every 30s debounced PATCH (frontend wiring — Stage 2 chat page)
- Add Clerk sign-up custom fields: preferredName, age confirmation, T&Cs, community rules
- Wire `afterSignUpUrl`/`afterSignInUrl` to originating URL (currently set to /prototype/dashboard fallback)
- Enable 2FA in Clerk dashboard for ADMIN/SUPER_ADMIN
- Rate limiting middleware (votes 20/hr, AI 50/hr, uploads 10/day)

## ENVIRONMENT VARIABLES

Confirmed in Vercel: DATABASE_URL, NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY, CLERK_SECRET_KEY, CLERK_WEBHOOK_SECRET, GEMINI_API_KEY, GROK_API_KEY

Still to add: GOOGLE_SAFE_BROWSING_API_KEY, RESEND_API_KEY, CLOUDFLARE env vars, GA4, SENTRY_DSN

---

## KEY TERMINOLOGY

| Use | Never Use |
|-----|-----------|
| Lex | Claude, the AI |
| Credibility Score | Reputation |
| Teambuilder | Dealweaver |
| Create / Draft / Develop / Campaign / Legislate | Stage 1–5, Parliament (as stage) |
| Contributions (UI) | Comments (UI) |
| Challenge / issue (UI) | Problem (UI) |
| Collaborative (Lex default) | Socratic (as default) |

---

## HOW TO START THE NEXT CC SESSION

```
Read CLAUDE.md, CC_Sprint1_Briefing.md, entity_list_v4.md, and system_mechanics_v0.7.md
in scrutinise-docs/. Sprint 1 Week 1 is complete.
Next session: wire Clerk sign-up custom fields, auto-save frontend, rate limiting.
Confirm DATABASE_URL is set and prisma db push + seed have been run.
```

---
*handoff_summary.md — Scrutinise — 22 March 2026 v3*
