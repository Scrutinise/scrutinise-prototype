# SCRUTINISE — CONVERSATION HANDOFF SUMMARY
*Last updated: 26 March 2026 v13*

---

## CURRENT STATE — V1 COMPLETE ✅

Sprint 9 complete. All pre-launch priorities delivered. The live site at scrutinise.co.uk has:
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
- QualityRating component (1–5 slider with thumbs icon) — on contributions + idea detail
- VoteInterceptModal — shown at Stage 2/3 when vote area clicked; offers VOTE_OPEN notification
- IdeaAlert system (VOTE_OPEN + STAGE_CHANGE) with POST/DELETE routes
- POST /api/ideas/[id]/reviews — upsert IdeaReview with qualityRating
- POST /api/ideas/[id]/contributions/[commentId]/rate — per-user CommentRating + avg denormalisation
- Stage 4→5 gate (3 MP + 3 Peer endorsements + 1 DraftsmanEndorsement + all proposedWording)
- Stage4GateCard + SubmitToParliamentModal + Submit to Parliament button
- advanceStage4to5 notifies all STAGE_CHANGE IdeaAlert holders on advance
- EndorsementPanel in Overview tab (Stage 4+) with Endorse + Below Standard buttons
- POST /api/ideas/[id]/endorsements + DELETE .../[endorsementId]
- Groups/Team management: GET/POST /api/ideas/[id]/groups + add/remove members
- TeamTab fully wired: Core Team collaborators + MY_TEAM/COMMUNICATIONS/POLICY_DEVELOPMENT CRUD
- StageTransitionRequest model added to schema (Policy Dev group flag, veto logic deferred)

- DraftsmanEndorsement form UI: POST /api/ideas/[id]/endorsements/draftsman (owner-only, Stage 4+, one per idea)
- DraftsmanEndorsementForm in EndorsementPanel: owner-only, Stage 4+, hidden once submitted, shows existing record as card
- Privacy Log tab (owner-only): green banner if no records; amber banners per admin access event with first+initial, date, reason
- GET /api/ideas/[id]/privacy-log: owner-only, returns ADMIN_ACCESS ActivityLog records
- Admin panel at /admin: auth-guarded layout (ADMIN/SUPER_ADMIN only)
- Content reports queue (3a): GET/PATCH /api/admin/reports and /api/admin/reports/[reportId]
- User list (3b): GET /api/admin/users (paginated) + PATCH /api/admin/users/[userId]/role
- PlatformConfig panel (3c, SUPER_ADMIN only): GET/PATCH /api/admin/config
- Schema: added DraftsmanEndorsement.draftsmanName, organisation; made draftsmanUserId optional; added Idea.draftsmanEndorsementCount
- Note: `prisma generate` must be run on next deploy/restart to resolve TypeScript types for new schema fields (as any casts used temporarily)
- GeneratedOutput model + enums (GeneratedOutputType, GeneratedOutputStatus) added in Sprint 8
- Campaign in a Box: four document types generated via Gemini 2.5 Flash, owner-only at Stage 4+
- Campaign tab added to IdeaDetailClient (Stage 4/5 only)
- Referral link injected into all four document prompts

- Nav links updated to real routes (no /prototype/ links remain)
- Global error boundary (error.tsx) + 404 page (not-found.tsx)
- Loading skeletons (global + per-route for ideas/[id], user/[username], admin)
- Dynamic OG metadata on idea detail and user profile pages
- robots.txt + dynamic sitemap.xml
- Legal pages: Version 1.0 — Draft label on Terms + Community Rules
- GDPR: POST /api/user/export (data download), DELETE /api/user/account (30-day grace deletion)
- GDPR: lib/gdpr.ts anonymiseExpiredAccounts() stub
- Settings page at /settings (account details, export, delete, notifications placeholder)
- Deletion cancellation on login (DELETION_PENDING → ACTIVE)
- Unsubscribe page updated to support UUID token and base64 legacy token
- Real dashboard at /dashboard (ideas, notifications, stats)
- All console.log removed from production code
- New schema fields: User.deletionRequestedAt, User.deletionScheduledFor, User.unsubscribeToken
- Priorities 8 (Sentry) and 9 (GA4) delivered — env vars confirmed in Vercel ✅
- Google Search Console verification file committed ✅
- Clerk `user.updated` webhook enabled ✅
- RESEND_API_KEY added to Vercel — email sending now live ✅

**IMPORTANT — BEFORE NEXT DEPLOY:**
- Run `npx prisma db push` to apply new User schema fields to Railway DB
- Run `npx prisma generate` to update TypeScript client types
- Remove `as any` casts in: lib/auth.ts, lib/gdpr.ts, app/api/user/account/route.ts, app/unsubscribe/[token]/page.tsx

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

## SPRINT 9 — COMPLETE ✅ (V1 LAUNCH SPRINT)

| File | What it does |
|------|-------------|
| `components/PublicNav.tsx` | /prototype/* links replaced with /ideas/create, /ideas, /dashboard. "Profile" → "Dashboard" |
| `app/layout.tsx` | signInFallbackRedirectUrl → /dashboard; full Metadata export (title template, description, OG) |
| `app/error.tsx` | Global error boundary — "Something went wrong" + Try again button |
| `app/not-found.tsx` | 404 page with home link |
| `app/loading.tsx` | Global spinner loading skeleton |
| `app/ideas/[id]/loading.tsx` | Idea detail loading skeleton |
| `app/user/[username]/loading.tsx` | Profile loading skeleton |
| `app/admin/loading.tsx` | Admin loading skeleton |
| `app/ideas/[id]/page.tsx` | generateMetadata: dynamic OG for Stage 3+ public ideas |
| `app/user/[username]/page.tsx` | generateMetadata: user name + bio |
| `app/terms/page.tsx` | Version 1.0 — Draft label |
| `app/community-rules/page.tsx` | Version 1.0 — Draft label |
| `public/robots.txt` | SEO crawl rules |
| `app/sitemap.ts` | Dynamic sitemap: static pages + Stage 4+ ideas + public profiles |
| `app/api/user/export/route.ts` | POST data export (rate limited 1/24h) — returns JSON; R2 upload stubbed |
| `app/api/user/account/route.ts` | DELETE account — DELETION_PENDING + 30-day scheduled; confirmation email |
| `app/settings/page.tsx` | Account details, data export, delete account, notifications placeholder |
| `app/dashboard/page.tsx` | Real dashboard: ideas, notifications, quick stats, Create button |
| `lib/gdpr.ts` | anonymiseExpiredAccounts() stub for scheduled job |
| `lib/auth.ts` | Deletion cancellation on login + console.log removed |
| `middleware.ts` | /dashboard + /settings added to protected routes |
| `app/unsubscribe/[token]/page.tsx` | UUID token support added (legacy base64 preserved) |
| `app/api/webhooks/clerk/route.ts` | console.log removed |
| `prisma/schema.prisma` | User: deletionRequestedAt DateTime?, deletionScheduledFor DateTime?, unsubscribeToken String @unique @default(uuid()) |

### Post-UAT infrastructure (26 March 2026)
- Priority 8: Sentry ✅ — @sentry/nextjs installed; sentry.{client,server,edge}.config.ts + withSentryConfig in next.config.js
- Priority 9: GA4 ✅ — NEXT_PUBLIC_GA4_MEASUREMENT_ID (G-E81CSK3BLK) wired via next/script in layout.tsx
- Google Search Console verification file committed (google7ed72e522d97f652.html) ✅
- Clerk user.updated webhook enabled ✅
- RESEND_API_KEY added to Vercel — email sending now live ✅

---

## SPRINT 8 — COMPLETE ✅

| File | What it does |
|------|-------------|
| `prisma/schema.prisma` | GeneratedOutputType enum (MP_BRIEFING, ONE_PAGER, PRESS_RELEASE, SOCIAL_KIT), GeneratedOutputStatus enum (PENDING, COMPLETE, FAILED), GeneratedOutput model with @@unique([ideaId, documentType]); generatedOutputs relation on Idea |
| `lib/campaign-prompts.ts` | Four prompt builder functions — each takes idea object + referral link, returns complete prompt string for Gemini |
| `app/api/ideas/[id]/generate/route.ts` | POST — owner-only, Stage 4+ gate, Zod validated body {documentType, force?}, Gemini 2.5 Flash call, upsert PENDING→COMPLETE/FAILED, force-regenerate support |
| `app/api/ideas/[id]/campaign-outputs/route.ts` | GET — owner-only, returns all GeneratedOutput records with 200-char preview |
| `app/ideas/[id]/CampaignTab.tsx` | Four document cards (MP Briefing, One Pager, Press Release, Social Kit), generate/regenerate, 3s polling while PENDING, copy to clipboard, download .txt, regenerate confirmation, non-owner locked message |
| `app/ideas/[id]/IdeaDetailClient.tsx` | Campaign tab added to Tab type + isValidTab + tabs array (Stage 4/5) + tab panel |

### Not built in Sprint 8 (deferred per spec)

- PDF download (R2 not wired for this use case)
- Email distribution of generated documents
- Sharing generated documents with collaborators
- Credibility calculation
- Endorsement verification

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

**Stage 3→4 quality rating (RESOLVED Sprint 6):** `qualityRating Int?` added to `IdeaReview` in Sprint 6. The existing VIEWED=3/ENDORSED=5/BELOW_STANDARD=0 fallback logic is preserved for reviews without an explicit qualityRating. Users can now rate via POST /api/ideas/[id]/reviews.

---

## SPRINT 6 — COMPLETE ✅

| File | What it does |
|------|-------------|
| `prisma/schema.prisma` | qualityRating on IdeaReview + Comment + CommentRating; AlertType enum + IdeaAlert model; Group.ideaId + StageTransitionRequest; removed helpfulCount/notHelpfulCount from Comment |
| `lib/stage-gates.ts` | checkStage4to5Gate, getStage4GateData, advanceStage4to5 (notifies STAGE_CHANGE alerts) |
| `app/api/ideas/[id]/progress/route.ts` | STAGE_4→STAGE_5 branch added |
| `app/api/ideas/[id]/reviews/route.ts` | POST upsert IdeaReview qualityRating (Stage 3+) |
| `app/api/ideas/[id]/contributions/[commentId]/rate/route.ts` | POST upsert CommentRating qualityRating + avg denormalisation |
| `app/api/ideas/[id]/alerts/route.ts` | POST upsert IdeaAlert (VOTE_OPEN/STAGE_CHANGE) |
| `app/api/ideas/[id]/alerts/[alertType]/route.ts` | DELETE IdeaAlert |
| `app/api/ideas/[id]/endorsements/route.ts` | GET public + POST endorse/below-standard (Stage 4+) |
| `app/api/ideas/[id]/endorsements/[endorsementId]/route.ts` | DELETE withdraw endorsement |
| `app/api/ideas/[id]/groups/route.ts` | GET + POST idea-scoped groups |
| `app/api/ideas/[id]/groups/[groupId]/members/route.ts` | POST add member |
| `app/api/ideas/[id]/groups/[groupId]/members/[userId]/route.ts` | DELETE remove member |
| `components/QualityRating.tsx` | Shared 1–5 rating component (idle/expanded states) |
| `components/VoteInterceptModal.tsx` | Vote intercept modal at Stage 2/3 |
| `app/ideas/[id]/ContributionsTab.tsx` | QualityRating per contribution; helpfulCount removed |
| `app/ideas/[id]/IdeaDetailClient.tsx` | Stage4GateCard + SubmitToParliamentModal + EndorsementPanel + TeamTab rewrite + QualityRating + VoteInterceptModal |
| `app/ideas/[id]/page.tsx` | stage4GateData + currentUserCanEndorse fetched and passed |
| `middleware.ts` | /api/ideas/(.*)/endorsements added to public routes |

### Not yet built after Sprint 6 (carried to Sprint 7)

- Admin panel ✅ Sprint 7
- Privacy Log UI ✅ Sprint 7
- DraftsmanEndorsement form UI ✅ Sprint 7
- Credibility calculation (deferred)
- Endorsement verification (MP/Peer badge confirmation — deferred)
- Fundraising (deferred)
- StageTransitionRequest veto logic (record created, not enforced — deferred)

---

## SPRINT 7 — COMPLETE ✅

| File | What it does |
|------|-------------|
| `prisma/schema.prisma` | Added draftsmanName String?, organisation String? to DraftsmanEndorsement; made draftsmanUserId optional; added draftsmanEndorsementCount to Idea |
| `app/api/ideas/[id]/endorsements/draftsman/route.ts` | POST /api/ideas/[id]/endorsements/draftsman — owner-only, Stage 4+, one per idea, increments draftsmanEndorsementCount |
| `app/api/ideas/[id]/endorsements/route.ts` | Updated GET to include draftsmanName/organisation in select |
| `app/api/ideas/[id]/IdeaDetailClient.tsx` | DraftsmanEndorsementForm in EndorsementPanel (owner, Stage 4+); PrivacyLogTab component; privacy-log tab (owner-only) |
| `app/api/ideas/[id]/privacy-log/route.ts` | GET owner-only privacy log (ADMIN_ACCESS events, first+initial name masking) |
| `app/admin/layout.tsx` | Server layout — auth + ADMIN/SUPER_ADMIN role guard |
| `app/admin/page.tsx` | Admin panel client page — reports, users, config sections |
| `app/api/admin/reports/route.ts` | GET content reports — PENDING first |
| `app/api/admin/reports/[reportId]/route.ts` | PATCH report action (DISMISS/HIDE/REMOVE/WARN) + notifies content owner |
| `app/api/admin/users/route.ts` | GET paginated user list |
| `app/api/admin/users/[userId]/role/route.ts` | PATCH role — ADMIN sets CITIZEN/MODERATOR; SUPER_ADMIN sets any |
| `app/api/admin/config/route.ts` | GET (Admin+) + PATCH (SUPER_ADMIN only) platform config |
| `middleware.ts` | Added /admin(.*) and /api/admin(.*) to protected routes |

### Not yet built (deferred)

- Credibility calculation
- Endorsement verification (MP/Peer badge confirmation)
- Fundraising
- StageTransitionRequest veto logic
- `prisma generate` note: run `npx prisma generate` on next deploy to fully resolve new schema type fields

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
| prisma/schema.prisma | ✅ Full schema + Sprint 7 fields (draftsmanName, organisation, draftsmanEndorsementCount) |
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
| app/api/ideas/[id]/progress/route.ts | ✅ Stage 2→3 + Stage 3→4 + Stage 4→5 |
| app/api/ideas/[id]/contributions/route.ts | ✅ GET + POST |
| app/api/ideas/[id]/contributions/[commentId]/reply/route.ts | ✅ POST owner reply |
| app/api/ideas/[id]/research/route.ts | ✅ GET + POST (Safe Browsing) |
| app/api/users/[username]/route.ts | ✅ GET public profile |
| app/api/ai/[ideaId]/route.ts | ✅ Lex authenticated + 50/hr rate limit |
| app/api/ai/public/route.ts | ✅ Lex unauthenticated (IP rate limited) |
| app/api/user/onboarding/route.ts | ✅ Consent capture |
| app/api/ideas/[id]/collaborators/route.ts | ✅ Invite + email + 10/day rate limit |
| app/ideas/[id]/page.tsx | ✅ Real idea detail page |
| app/ideas/[id]/IdeaDetailClient.tsx | ✅ Tabbed UI + Take Public modal + Begin Campaign modal + Stage3GateCard + ContributionsTab + ResearchTab + AmendmentsTab + VoteWidget (Stage 4/5) + DevelopmentHistory (owner, Stage 3+) + DraftsmanEndorsementForm + PrivacyLogTab |
| app/api/ideas/[id]/endorsements/draftsman/route.ts | ✅ POST draftsman endorsement (owner-only, Stage 4+) |
| app/api/ideas/[id]/privacy-log/route.ts | ✅ GET privacy log (owner-only, ADMIN_ACCESS events) |
| app/admin/layout.tsx | ✅ Auth guard (ADMIN/SUPER_ADMIN) |
| app/admin/page.tsx | ✅ Admin panel (reports + users + config) |
| app/api/admin/reports/route.ts | ✅ GET content reports |
| app/api/admin/reports/[reportId]/route.ts | ✅ PATCH report action |
| app/api/admin/users/route.ts | ✅ GET paginated users |
| app/api/admin/users/[userId]/role/route.ts | ✅ PATCH user role |
| app/api/admin/config/route.ts | ✅ GET + PATCH platform config |
| app/ideas/[id]/ContributionsTab.tsx | ✅ Full form + cards + replies + pagination + Internal badge + Stage 2 support |
| app/ideas/[id]/ResearchTab.tsx | ✅ Full form + cards |
| app/ideas/[id]/AmendmentsTab.tsx | ✅ Full tab: propose form, expandable cards, owner action panel (5 actions), counter-proposal form |
| app/api/ideas/[id]/amendments/route.ts | ✅ GET list + POST propose |
| app/api/ideas/[id]/amendments/[amendmentId]/route.ts | ✅ PATCH owner actions |
| app/api/ideas/[id]/amendments/[amendmentId]/counter/route.ts | ✅ POST counter-proposal |
| app/api/ideas/[id]/vote/route.ts | ✅ GET aggregate + POST upsert (Stage 4+) |
| app/api/ideas/[id]/reviews/route.ts | ✅ POST upsert IdeaReview qualityRating |
| app/api/ideas/[id]/contributions/[commentId]/rate/route.ts | ✅ POST upsert CommentRating qualityRating |
| app/api/ideas/[id]/alerts/route.ts | ✅ POST upsert IdeaAlert |
| app/api/ideas/[id]/alerts/[alertType]/route.ts | ✅ DELETE IdeaAlert |
| app/api/ideas/[id]/endorsements/route.ts | ✅ GET + POST endorse/below-standard |
| app/api/ideas/[id]/endorsements/[endorsementId]/route.ts | ✅ DELETE withdraw |
| app/api/ideas/[id]/progress/route.ts | ✅ Stage 2→3 + Stage 3→4 + Stage 4→5 |
| app/api/ideas/[id]/generate/route.ts | ✅ POST generation (owner, Stage 4+, Gemini 2.5 Flash) |
| app/api/ideas/[id]/campaign-outputs/route.ts | ✅ GET outputs list (owner-only) |
| app/ideas/[id]/CampaignTab.tsx | ✅ Four document cards + generate/download/copy |
| lib/campaign-prompts.ts | ✅ Four prompt builders (MP Briefing, One Pager, Press Release, Social Kit) |
| app/api/ideas/[id]/groups/route.ts | ✅ GET + POST idea-scoped groups |
| app/api/ideas/[id]/groups/[groupId]/members/route.ts | ✅ POST add member |
| app/api/ideas/[id]/groups/[groupId]/members/[userId]/route.ts | ✅ DELETE remove member |
| components/QualityRating.tsx | ✅ Shared 1–5 rating component |
| components/VoteInterceptModal.tsx | ✅ Vote intercept modal (Stage 2/3) |
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

**Confirmed in Vercel Production:** DATABASE_URL, NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY, CLERK_SECRET_KEY, CLERK_WEBHOOK_SECRET, RESEND_API_KEY, NEXT_PUBLIC_GA4_MEASUREMENT_ID (G-E81CSK3BLK), SENTRY_DSN

**Needs verification (may be missing from Production):** GEMINI_API_KEY, GROK_API_KEY, GOOGLE_SAFE_BROWSING_API_KEY

**Not yet set:** CLOUDFLARE_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY, R2_PUBLIC_URL

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
V1 COMPLETE — Sprint 9 delivered all pre-launch priorities.

BEFORE STARTING ANY CODE:
1. Run: npx prisma db push (apply User GDPR fields to Railway DB)
2. Run: npx prisma generate (update TypeScript types)
3. Remove all `as any` casts added in Sprint 9 (see IMPORTANT note in CURRENT STATE)
4. After deploy: verify Search Console ownership in Google Search Console + submit sitemap.

Sprint 9 complete. All pre-launch priorities delivered:
  1. Prototype link audit — all /prototype/* links replaced in nav + layout ✅
  2. Error boundaries (error.tsx, not-found.tsx) ✅
  3. Loading skeletons (global + route-level) ✅
  4. Dynamic SEO metadata + robots.txt + sitemap.ts ✅
  5. Legal pages verified (Version 1.0 — Draft) ✅
  6. GDPR data export + account deletion (30-day grace) ✅
  7. Settings page + real dashboard ✅
  8. Sentry ✅ (SENTRY_DSN confirmed in Vercel; @sentry/nextjs wired)
  9. GA4 ✅ (NEXT_PUBLIC_GA4_MEASUREMENT_ID = G-E81CSK3BLK; wired in layout.tsx)

Deferred (do not build without explicit instruction):
- PDF download of generated documents (R2 not wired)
- Email distribution of generated documents
- Credibility calculation
- Endorsement verification (MP/Peer badge confirmation)
- Fundraising
- StageTransitionRequest veto logic
- Legislation database (separate post-holiday project)
- lib/gdpr.ts anonymiseExpiredAccounts() scheduler (Railway/Vercel cron)
```

## PREVIOUS SESSION START (SPRINT 8)

```
Read CLAUDE.md and this handoff_summary.md first.
Sprint 8 complete. Campaign in a Box delivered:
  1. GeneratedOutput schema (db push + generate done) ✅
  2. lib/campaign-prompts.ts (4 document type builders) ✅
  3. POST /api/ideas/[id]/generate (Gemini 2.5 Flash) ✅
  4. GET /api/ideas/[id]/campaign-outputs ✅
  5. CampaignTab.tsx (generate/poll/copy/download) ✅
  6. Campaign tab wired into IdeaDetailClient (Stage 4/5) ✅

Run git status before touching any code. Confirm on Main.

Deferred (do not build without explicit instruction):
- PDF download of generated documents (R2 not wired)
- Email distribution of generated documents
- Sharing generated documents with collaborators
- Credibility calculation
- Endorsement verification (MP/Peer badge confirmation)
- Fundraising
- StageTransitionRequest veto logic
- Legislation database (separate post-holiday project)
```

---
*handoff_summary.md — Scrutinise — 26 March 2026 v13*
