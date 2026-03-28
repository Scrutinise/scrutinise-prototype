# SCRUTINISE — CONVERSATION HANDOFF SUMMARY
*Last updated: 28 March 2026 v21*

---

## CURRENT STATE — 28 MARCH 2026 SPRINT (TEAM INVITES, NAV BARS, EDIT BUTTON, LEX V5.1) COMPLETE ✅

Four commits to Main. All `tsc --noEmit` clean. Pushed to Main.

### team-invite-1: Team invite flows
- `GET /api/users/search?q=` — search users by name/username, min 2 chars, excludes self + historical accounts
- `POST /api/ideas/[id]/collaborators` extended: body with `userId` → add existing user as IdeaCollaborator immediately; body with `email+firstName+lastName` → UserInvite + Resend email (existing flow unchanged)
- **TeamTab UI:** "Add existing user" (debounced search modal with Invite button) + "Invite by email" form (firstName/lastName/email). Success states shown.
- `sendInviteMismatchNotificationEmail` added to `lib/email.ts`
- Clerk `user.created` webhook: detects pending invite to same email; if name differs, sends mismatch email to inviter + creates in-app Notification

### nav-lex-1: Nav bars on Lex editing page
- `CreateIdeaClient.tsx`: replaced minimal inline header with `PublicNav` (full site nav). Added Lex toolbar strip (Save & Exit, View your idea, Sign in). Added `SiteFooter` at bottom.
- `components/SiteFooter.tsx` created: minimal footer with Home, Browse, Dashboard, About, Privacy, Contact

### edit-button-1: Edit button
- "Edit with Lex" → "Edit" (label change)
- Changed from `variant="outline"` to `variant="default"` (solid dark, white text — same as Take Public)
- Owner only, Stage 1–2

### Lex v5.1: System prompt (6 changes)
- 4a: Stage 2 team unlocked message — exact new wording
- 4b: OFFER HELP PROACTIVELY — follow navigation/research suggestions with "just ask"
- 4c: RETURN NAVIGATION — dashboard nav hint for aiSessionCount < 3; aiSessionCount now in runtime context (already in schema), incremented on first message of new session
- 4d: No false praise — no hollow affirmations, no "strong foundation" on thin work, don't thank user for answering
- 4e: RETURNING SESSION — welcome back opening: idea title + stage + last 1–2 messages summary + next unpopulated field question
- 4f: TEAM NAME SUGGESTION — suggest "[title] Working Group" or "[keyword] Team" on Stage 2 entry
- `lex_system_prompt_v5.0.md` → **v5.1** (renamed/updated in place)

**Deploy actions needed:** None — no schema changes (aiSessionCount already existed in schema), no new env vars.

---

## CURRENT STATE — UX-MOBILE-1 (THREE MOBILE UX FIXES) COMPLETE ✅

**UX-mobile-1 — Mobile UX fixes:**
- **FIX 1 (swipe hint):** Already correctly implemented in `FieldProposalCard.tsx`. `showSwipeHint` state initialises `false`, useEffect reads `localStorage.hasSeenSwipeHint` on client, sets true if not seen. `lg:hidden` class hides on ≥lg. Hint dismissed on acceptance. No code change needed.
- **FIX 2 (connection retry):** `isConnectionError?: boolean` added to `ChatMessage`. `lastSentMessageRef` stores raw messageText before every send. Error catch now flags `isConnectionError: true`. `handleRetry` function removes error message and re-sends via same API path. "Try again" button renders inside error Lex bubble, shows "Retrying…" during loading.
- **FIX 3 (accepted card position — Option B):** Saved card state restyled from green to teal (`#2da8a8`). Left border + background fill matches Lex's pending card palette. Visually associates accepted field with the Lex message block it renders inside, not the input below.
- `tsc --noEmit` clean. One commit. Pushed to Main.

**Deploy actions needed:** None — no schema changes, no new env vars.

---

## CURRENT STATE — SPRINT L4-EDITORIAL (8 EDITORIAL SEED IDEAS) COMPLETE ✅

**L4-editorial — Seed 8 editorial seed ideas with full strategic kernels:**
- Script: `scripts/seed/seed-editorial-ideas.ts` — idempotent; upserts User + Ideas; upserts Diagnosis + GuidingPolicy; creates RootCause + CoherentActions only if absent
- User: `editorial_scrutinise` (clerkId), `isHistoricalAccount: false`, role `CITIZEN`
- All 8 ideas: `ideaOrigin: EDITORIAL_SEED`, blue banner `#3B82F6`, `STAGE_3`, `LINK_ONLY`, `LEGISLATION`
- All 8 seeded cleanly: Diagnosis ✓, RootCause ✓, GuidingPolicy ✓, CoherentActions ✓
- Run against production DB — all 8 processed cleanly

**Idea IDs (production):**
- `dd7c0fc0-6777-498b-b444-26c8926f6ec8` — FCA Competitiveness Duty
- `f09c5f19-4a67-481b-acbe-9cbd0c8b87b0` — Pandemic Preparedness Framework
- `3f972309-e4fd-43ca-9bd8-9b3a112424b6` — Defence Industrial Mobilisation Reserve
- `791c1e42-ba10-48a6-a8e4-95641c4e5f87` — ARIA Governance Reform
- `fc3ccff1-7a83-4fac-8ffc-e9f35f37139d` — Pre-Legislative Scrutiny
- `40e351a7-d735-4b11-b19f-f1f3049d402c` — Open Government Procurement Data
- `ab6b9655-1239-4113-a537-407122c93018` — Criminal Courts Digitisation
- `be7d7b70-ba55-4a2a-b5c7-23c14c53b79b` — NHS Diagnostic Waiting Time Guarantee

**Deploy actions needed:** None — no schema changes, no new env vars.

---

## CURRENT STATE — SPRINT L4-KERNELS (STAGE 2 STRATEGIC KERNELS SEEDED) COMPLETE ✅

**L4-kernels — Seed Stage 2 strategic kernels for all 20 historical example ideas:**
- Script: `scripts/seed/seed-historical-kernels.ts` — idempotent; upserts Diagnosis + GuidingPolicy (@@unique per idea); creates RootCause + CoherentActions only if none exist
- All 20 ideas seeded: Diagnosis ✓, RootCause ✓, GuidingPolicy ✓, CoherentActions ✓
- CoherentAction counts: 14 ideas × 1 action, 6 ideas × 2 actions (30 total)
- Run against production DB — all 20 processed cleanly

**Deploy actions needed:** None — no schema changes, no new env vars.

---

## CURRENT STATE — SPRINT L3 BUG FIXES (EDIT WITH LEX BUTTON + SIDEBAR VERIFICATION) COMPLETE ✅

Two bug-fix commits to Main (L3-nav-fix, L3-sidebar-fix). Both `tsc --noEmit` clean. No DB changes.

### L3-nav-fix: Edit with Lex button
- "Continue with Lex →" inline link replaced with proper `<Button variant="outline">` labelled **"Edit with Lex"** in `IdeaDetailClient.tsx`
- href was already correct; page.tsx already reads `ideaId` searchParam and passes `initialIdeaId`, `initialMessages`, `initialStage` to `CreateIdeaClient`
- `CreateIdeaClient` already seeds `ideaId` state, `messages` state, and `currentStage` state from those props on mount
- Button: owner only, STAGE_1 or STAGE_2, placed below idea title

### L3-sidebar-fix: Sidebar field key alignment
- Verified: all keys aligned across `SIDEBAR_FIELDS` (CreateIdeaClient), both `buildCompletedFields` functions (AI route + field-approval route)
- `rootCause` reads from `idea.rootCause` (Idea-level text field) — correct for Stage 1 sidebar
- `whoAffected` reads from `idea.whoAffected` (Idea-level field) — correct for Stage 1 sidebar
- `handleProposalAccept` already calls `setFields(prev => ({ ...prev, ...data.completedFields }))` after every acceptance
- No code changes required — all was already correctly implemented

**Deploy actions needed:** None — no schema changes, no new env vars.

---

## CURRENT STATE — SPRINT L4 (HISTORICAL EXAMPLES + IDEAORIGIN BANNER + SUPERADMIN TRANSFER) COMPLETE ✅

Sprint L4 complete. Four commits to Main (L4-1 through L4-4). All `tsc --noEmit` clean. `prisma db push` and `prisma generate` run — DB in sync. Seeding script run against production.

### Sprint L4 Summary

**L4-1 — Schema changes:**
- New `IdeaOrigin` enum: `USER` (default), `HISTORICAL_EXAMPLE`, `EDITORIAL_SEED`
- `isHistoricalAccount Boolean @default(false)` added to User model — marks seed accounts with no real Clerk auth
- `ideaOrigin`, `bannerColour`, `bannerText` added to Idea model
- `prisma db push` + `prisma generate` run clean

**L4-2 — IdeaOrigin banner on idea detail page (`IdeaDetailClient.tsx`):**
- `IdeaOriginBanner` component: inline SVG info icon, dynamic hex colour, left border, 15% opacity background fill
- Renders between stage stepper and idea header; hidden for `USER` origin
- `HISTORICAL_EXAMPLE` default: orange `#F97316`; `EDITORIAL_SEED` default: blue `#3B82F6`
- `bannerColour` and `bannerText` on Idea override defaults

**L4-3 — SuperAdmin ownership transfer:**
- `SuperAdminTransferSection` in `app/admin/page.tsx`: debounced idea/user search (300ms), inline confirmation, success/error
- "Transfer Ownership" tab visible to SUPER_ADMIN only
- `GET /api/admin/ideas/search?q=` — title/ID search, max 5, ADMIN+
- `GET /api/admin/users/search?q=` — email/username/name, excludes `isHistoricalAccount`, max 5, ADMIN+
- `POST /api/admin/ideas/[ideaId]/transfer-ownership` — SUPER_ADMIN only; patches `creatorId`; creates `ActivityLog` ADMIN_ACTION

**L4-4 — Seeding script (`scripts/seed/seed-historical-examples.ts`):**
- 19 User records: `isHistoricalAccount=true`, `clerkId=historical_[slug]`
- 20 Idea records: `STAGE_3`, `LINK_ONLY`, `HISTORICAL_EXAMPLE`, `bannerColour=#F97316`
- Shelter England user shared by ideas 1 and 9
- Script is idempotent; errors per-item are logged without aborting the run
- **Already run against production** — all 20 ideas live

**Deploy actions needed:**
- All already done: `prisma db push` ✅, `prisma generate` ✅, seeding script ✅
- No new env vars required

**Seeded idea IDs (for reference):**
| Title | ID |
|-------|----|
| Homelessness Reduction Act 2017 | cb7498df-8275-4d18-ae85-662887249ecc |
| Modern Slavery Act 2015 | 8bf7ced7-baab-4f72-8765-56a3c6fa4426 |
| Hunting Act 2004 | 5306bb29-480e-4d3c-afc5-448e4f02e2bf |
| Gender Recognition Act 2004 | e72cc67b-8f27-40bb-95c9-6cb2b993887c |
| Gender Pay Gap Reporting in the Equality Act 2010 | 151ddbf1-e356-4cd2-a80a-1dd541e2b100 |
| Countryside and Rights of Way Act 2000 | 7700e3c9-9088-4fa7-993e-ddb53deb7a29 |
| Consumer Rights Act 2015 | 12f20003-6eb0-4edb-a520-e238ae1fb2af |
| Age of Criminal Responsibility (Scotland) Act 2021 | 97dbdc0f-0eca-4cc4-b1f7-f7162dfa7d27 |
| Homes (Fitness for Human Habitation) Act 2018 | d42bbf40-d645-44ef-b711-2646af08050a |
| Domestic Abuse Act 2021 | 3c8441c5-8e53-4c3f-a978-409cdc415a55 |
| Tobacco and Vapes Act 2025 | 0ef5826f-de29-449d-afb7-c3ae236d7856 |
| Academies Act 2010 | f7a74bbb-bdb7-48bd-914c-0abf51ae9f4f |
| Protection of Freedoms Act 2012 | 32426a88-f77f-4cb2-857f-e398d745842a |
| Higher Education (Freedom of Speech) Act 2023 | 6c634e74-e845-4c3c-945e-415118a7c7d8 |
| Tobacco Advertising and Promotion Act 2002 | 945fd544-5538-425f-9808-450edbcd2ef3 |
| Land Reform (Scotland) Act 2003 | 323a51b6-ed30-4eeb-89b1-9f0ced07ccee |
| Well-being of Future Generations (Wales) Act 2015 | d9a75dfc-9b89-45db-be2e-37c9b4b07d1f |
| Organ Donation (Wales) Act 2013 | 3709a536-22af-4443-941b-999201b75003 |
| Domestic Abuse (Scotland) Act 2018 | 99dfa782-9435-4771-a15d-bbca283a606f |
| Planning and Infrastructure Act 2025 | c75db19f-128c-4216-8770-b0d6748a1d3f |

---

## CURRENT STATE — SPRINT L3 (IDEA PAGE UX + OWNERSHIP TRANSFER) COMPLETE ✅

Sprint L3 complete. Two commits to Main (L3-1, L3-2). All `tsc --noEmit` clean. `prisma db push` and `prisma generate` run — DB in sync.

### Sprint L3 Summary

**L3-1 — Idea page layout and UX improvements (`IdeaDetailClient.tsx`):**
- `Stage2GateCard` restructured to two columns: requirements list on left, two info chips on right ("🗳 Voting opens at Campaign stage" / "📦 Campaign in a Box available on idea completion")
- Idea sub-tab nav changed from underline style to pill/chip row — visually distinct from main tabs
- Overview sub-tab redesigned to two-column layout: left 2/3 = Summary + content fields; right 1/3 = metadata stack (Stage, Idea Type, Govt Area, Created, Owner with link to /user/[username])
- "Solution (summary)" label corrected to "Approach (summary)"
- "Continue with Lex →" confirmed already present from L2

**L3-2 — Ownership transfer:**
- Schema: 3 new fields on Idea — `ownershipTransferToken String? @unique`, `ownershipTransferToId String?`, `ownershipTransferExpiry DateTime?`
- `lib/email.ts`: `sendOwnershipTransferEmail()` added
- `POST /api/ideas/[id]/transfer/initiate` — owner-only; new owner must be existing collaborator; generates UUID token; 48hr expiry; sends email
- `POST /api/ideas/[id]/transfer/accept` — validates token/recipient/expiry; transfers `creatorId`; upserts old owner as EDITOR collaborator; creates SYSTEM notification for old owner
- `POST /api/ideas/[id]/transfer/cancel` — owner or recipient can cancel; clears transfer fields
- `app/ideas/[id]/transfer/accept/page.tsx` — server component; auth-gated; calls Prisma directly (no self-API call); success → redirect to `/ideas/[id]?transferSuccess=1`; error → message with back link
- `TeamTab` in `IdeaDetailClient.tsx`: Transfer Ownership section at bottom (owner-only, ≥1 collaborator required); dropdown; confirm modal; pending amber banner

**Deploy actions needed:**
- `prisma db push` already run (26 March 2026) ✅
- `prisma generate` already run ✅
- No new env vars required

---

## CURRENT STATE — SPRINT L2 (LEX UX AND EXPERIENCE LEVEL) COMPLETE ✅

Sprint L2 complete. Seven commits to Main. All `tsc --noEmit` clean. Prisma Client regenerated.
**Deploy actions needed:** `npx prisma db push` (new `ExperienceLevelEnum` + `experienceLevel` field on User) + env vars unchanged.

### Sprint L2 Summary

**ExperienceLevelEnum added to User:**
- New Prisma enum: `NO_BACKGROUND`, `SECTOR_LIVED`, `THINK_TANK_JUNIOR`, `THINK_TANK_SENIOR`, `POLITICAL_JUNIOR`, `POLITICAL_SENIOR`, `PARLIAMENTARIAN`
- `experienceLevel ExperienceLevelEnum?` added to User model.
- Lex runtime context block now includes `User experience level: …` so Stage 1 and Stage 2 prompts can adapt language to the user's background.
- Settings page (`/settings`) shows experience level dropdown with auto-save.
- Onboarding form includes experience level as a required field for all new and returning users.

**Onboarding routing fixes:**
- `afterSignUpUrl="/onboarding"` added to ClerkProvider — Google SSO users now always land on onboarding.
- `app/onboarding/page.tsx` converted to async server component with server-side redirect: fully-onboarded users (`ageConfirmed && experienceLevel`) are redirected immediately.
- `promptOnly` mode: existing users who completed original onboarding but have no `experienceLevel` are sent to onboarding showing only the experience level question.
- `/ideas/create` gates on `ageConfirmed`; users missing `experienceLevel` redirected to onboarding with `?from=create` param.

**Continue with Lex — session resume flow:**
- `/ideas/create` now accepts `?ideaId=` query param.
- When present, the server component fetches `aiChatHistory` and `stage` for that idea (owner only) and passes them as `initialIdeaId`, `initialMessages`, `initialStage` to `CreateIdeaClient`.
- `CreateIdeaClient` restores the conversation and stage state from these props.
- IdeaDetailClient shows "Continue with Lex →" link (owner-only, STAGE_1 or STAGE_2) linking to `/ideas/create?ideaId=${idea.id}`.
- Save & Exit button in the chat UI navigates to `/dashboard` if an `ideaId` is set, otherwise shows an inline message.
- View Idea link (opens new tab) appears once `ideaId` is set.

**Sidebar completedFields alignment:**
- `SIDEBAR_FIELDS` in `CreateIdeaClient` updated to 7 Stage 1 fields with correct keys: `title`, `summaryDiagnosis`, `rootCause`, `summaryGuidingPolicy`, `summaryCoherentActions`, `whoAffected`, `proposedWording`.
- `FieldCompletion` interface extended with 12 Stage 2 fields across diagnosis and guidingPolicy groups.
- Both `field-approval` route and AI route now return `{ completedFields, currentStage, coherentActionsCount }`.

**Stage 2 sidebar progressive disclosure:**
- `Stage2Sidebar` component in `CreateIdeaClient` replaces the Stage 1 flat list when `currentStage` is STAGE_2+.
- Three sections: Diagnosis (7 sub-fields), Guiding Policy (5 sub-fields), Coherent Actions (count badge).
- Sections expand/collapse independently; completed fields shown with tick marks.

**Keyboard shortcuts for FieldProposalCard:**
- Enter accepts the pending proposal when no input/textarea is focused.
- Escape switches to edit mode.
- After acceptance, a `lex-field-accepted` custom event is dispatched and caught by `CreateIdeaClient` to refocus the chat input.

**Lex Stage 1 prompt fixes:**
- SECOND RESPONSE RULE: Lex does not re-introduce itself after the first exchange.
- Title proposal precedes background question.
- HANDLING UNCERTAINTY section added for out-of-scope or unclear inputs.
- EXPERIENCE LEVEL ADAPTATION: language and framing adjusts to the user's stated background.

---

## CURRENT STATE — SPRINT L1 (LEX OVERHAUL) COMPLETE ✅

Sprint L1 complete. Six commits to Main. All tsc --noEmit clean. Deploy actions needed: `npx prisma db push` + `npx prisma generate` + any new env vars.

### Sprint L1 Summary

**Architecture change — FieldProposalCard approval flow:**
- Lex responses no longer write field values to DB immediately.
- Instead, `pendingProposals` are returned to the client (fieldKey, fieldLabel, proposedValue).
- User approves/edits each proposal via `FieldProposalCard` component.
- On approval: POST to `/api/ideas/[id]/field-approval` which writes to DB and returns updated `completedFields`.
- This applies to both Stage 1 and Stage 2 Lex interactions.

**Two-stage Lex model:**
- Stage 1 (CREATE): Basic Info only. 3–5 exchanges. Fields: title, summaryDescription, summaryDiagnosis, summaryGuidingPolicy, summaryCoherentActions, govtArea, ideaType. triggerSavePrompt fires when summaryDiagnosis + summaryGuidingPolicy both proposed/saved.
- Stage 2 (DRAFT): Full Strategic Kernel via two-pass model. Pass 1: diagnosis.text, rootCause.text (5 Whys), guidingPolicy.text, coherentActions[0]. Pass 2: supporting detail (whoAffected, whyPersisted, impactCost, competitiveIdeaAnalysis, practicalExecution, keyRisks). Aha-moment reflection after Pass 1.
- All sub-entity fields use dot notation in fieldUpdates JSON: `{"diagnosis.text": "..."}`.

**New sub-entity models (Prisma):**
- `Diagnosis` — @@unique([ideaId]), upsert via POST /api/ideas/[id]/diagnosis
- `RootCause` — multiple per idea, GET+POST /api/ideas/[id]/root-causes
- `GuidingPolicy` — @@unique([ideaId]), upsert via POST /api/ideas/[id]/guiding-policy
- `Evidence` — multiple per idea, POST /api/ideas/[id]/evidence
- `EvidenceOutcome` enum (SUCCESS, FAILURE, MIXED)
- New CoherentAction fields: legislationDraftWording, organisationalChangeDraftWording, costFinancial, costSocial, costOngoing, benefits, keyChallenges, oppositionWho, oppositionWhy, oppositionAnswers

**Idea tab restructure:**
- "Overview" tab renamed to "Idea" tab.
- Tab order: Idea | Research | Contributions | Amendments | Team | Campaign (Stage 4+) | Privacy Log (owner)
- Idea tab has 4 sub-tabs: Overview | Diagnosis | Policy | Coherent Actions
- Each field has inline edit (owner/collaborator) via ✎ icon → field-approval route
- Empty field placeholder: "Not yet completed — [description]"

**Campaign in a Box button:**
- Owner-only, visible at all stages.
- Stages 1–3: disabled/greyed, tooltip.
- Stages 4–5: active, navigates to Campaign tab.

**Browse Ideas page (/ideas):**
- Real server-side listing: Stage 3+ ACTIVE ideas.
- Cursor pagination (20/page).
- "Your Ideas" section for authenticated users (max 3 ideas).
- IdeaCard component: title link, summary, stage badge, govtArea, creator, votes, contributions, relative time.

**Legacy sidebar compatibility:**
- summaryDiagnosis is mirrored to `diagnosis` (Idea-level legacy field) on approval.
- summaryGuidingPolicy is mirrored to `guidingPolicy` on approval.
- completedFields checks `summaryDiagnosis OR diagnosis` (and same for guidingPolicy).

---

## CURRENT STATE — POST-UAT BUG FIXES APPLIED ✅

Post-UAT fixes complete (26 March 2026). Six bug fixes committed to Main and pushed.

### Post-UAT fixes delivered

| Bug | Fix |
|-----|-----|
| B1 | `/ideas/create` requires auth — unauthenticated users redirected to sign-in. Client extracted to `CreateIdeaClient.tsx`; `page.tsx` is now a server component. |
| B2 | `/ideas` browse holding page — PublicNav, Sign Up button, back link. |
| B3 | `/privacy` holding page — PublicNav + footer nav bar. |
| B4 | `/contact` holding page — email link + footer nav bar. |
| B5 | Post-onboarding redirect → `/dashboard` (was `/ideas/create`). Respects `?redirect_url` param for users arriving via `/ideas/create` flow. |
| B6 | Get Started button + Navbar.tsx Create link fixed: `/prototype/create/stage1` → `/ideas/create`. |
| B8 | Lex v5.0 full system prompt applied to `app/api/ai/[ideaId]/route.ts`: commit-and-advance, three-exchange limit, field completion reference, Stage 1 aha moment, background-question guidance. |
| B10 | Dynamic opening message (first visit vs return visit, personalised by preferredName + time of day). Computed server-side in `page.tsx`, passed as prop to `CreateIdeaClient`. Auto-focus on input after each Lex response confirmed. |

**Locked decision updated:** Opening message is now dynamic (first visit vs return). The v4.1 locked wording applies to the fallback only (unauthenticated edge case).

---

## SPRINT 9 + V1 LAUNCH — COMPLETE ✅

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
| Opening message = dynamic per v5.0 (first visit / return visit / fallback). Fallback: "I'm Lex…" | UPDATED — 26 Mar 2026 post-UAT fix |
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
| lex_system_prompt | v5.0 (24-03-26) | ✅ Current — inline prompt updated 26 Mar 2026 |
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
*handoff_summary.md — Scrutinise — 26 March 2026 v14*
