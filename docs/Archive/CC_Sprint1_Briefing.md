# CC BRIEFING — SPRINT 1
*Produced by CCh — 22 March 2026 v2. Updated with prototype fixes, UX notes, AI modes, amendment counter-proposal, preferred name.*
*Read CLAUDE.md, entity_list_v4.md, and system_mechanics_v0.7.md before reading this.*

---

## CRITICAL — READ FIRST

> **Stage 5 = "Legislate" everywhere. Voting hidden at Stages 1–3. "Comments" = "Contributions" in UI. "Problem" = "Challenge" in UI (DB field stays `diagnosis`). Lex default mode = Collaborative.**
> **SuperAdmin: cl@scrutinise.org — seed on first migration.**

---

## 1. START-OF-SESSION CHECKLIST

1. `bash start-session.sh` — confirm clean `Main` branch.
2. Read `CLAUDE.md` in full.
3. Read this entire briefing.
4. Read `entity_list_v4.md`.
5. Read `system_mechanics_v0.7.md`.
6. `cd scrutinise-web && npm run dev` — zero build errors before touching anything.
7. Confirm 6 env vars live in Vercel: DATABASE_URL, NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY, CLERK_SECRET_KEY, CLERK_WEBHOOK_SECRET, GEMINI_API_KEY, GROK_API_KEY.

---

## 2. CURRENT STATE

Prototype fully built and styled (commit 388ec92, `Main`). All pages mock data only. Homepage live at scrutinise.org.

**Prototype issues to fix — required before Sprint 1 is complete:**
See Section 7 below.

---

## 3. LOCKED TERMINOLOGY

| Use | Never Use |
|-----|-----------|
| Legislate (Stage 5) | Parliament (as stage name) |
| Contributions (UI) | Comments (UI) |
| Challenge / issue (UI) | Problem (UI — DB field stays `diagnosis`) |
| Collaborative (Lex default mode) | Socratic (as default) |
| My Team / Communications / Policy Development Group | Collaborators / Supporters / Public |
| Hidden vote widget at Stages 1–3 | Disabled vote widget |

---

## 4. STAGE GATE RULES

**1→2:** AUTOMATIC on PATCH when title + summaryDescription non-empty. Lex achievement message fires.

**2→3:** MANUAL. Gate: diagnosis + guidingPolicy + ≥1 CoherentAction + ≥3 Research. Warning modal required.

**3→4:** MANUAL. Gate: ≥12 IdeaReview records + avg quality ≥ 2.5. Vote widget appears at Stage 4.

**4→5:** MANUAL. Gate: ≥3 MP + ≥3 Peer endorsements (separate) + ≥1 DraftsmanEndorsement + proposedWording complete.

---

## 5. SCHEMA CHANGES — APPLY ALL BEFORE FIRST `prisma db push`

### User — new/changed fields

```prisma
preferredName       String?   // "How would you like Lex to address you?" — defaults to firstName
ageConfirmed        Boolean   @default(false)
tcAgreedAt          DateTime?
rulesAgreedAt       DateTime?
tcVersion           String?
politicalSpectrumX  Decimal?
politicalSpectrumY  Decimal?
manualCredibilityOverride Decimal?
aiPreferredStyle    String?   // COLLABORATIVE | SOCRATIC | DIRECT — default COLLABORATIVE
```

Remove: `politicalParty String`, `partyMembership String` → replaced by PartyMembership entity.

### New entity: PartyMembership

```prisma
model PartyMembership {
  id               String    @id @default(uuid())
  userId           String
  user             User      @relation(fields: [userId], references: [id])
  partyName        String
  membershipNumber String?
  memberSince      DateTime?
  isPrimary        Boolean   @default(false)
  createdAt        DateTime  @default(now())
}
```

### New entity: PlatformConfig

```prisma
model PlatformConfig {
  key             String   @id
  value           Json
  updatedByUserId String
  updatedBy       User     @relation(fields: [updatedByUserId], references: [id])
  updatedAt       DateTime @updatedAt
}
```

### New entity: IdeaReview

```prisma
model IdeaReview {
  id                String            @id @default(uuid())
  ideaId            String
  idea              Idea              @relation(fields: [ideaId], references: [id])
  userId            String
  user              User              @relation(fields: [userId], references: [id])
  outcome           IdeaReviewOutcome
  timeOnPageSeconds Int?
  createdAt         DateTime          @default(now())
  @@unique([ideaId, userId])
}

enum IdeaReviewOutcome { VIEWED ENDORSED BELOW_STANDARD }
```

### Amendment entity — new fields

```prisma
isCounterProposal    Boolean  @default(false)
parentAmendmentId    String?
parentAmendment      Amendment? @relation("CounterProposal", fields: [parentAmendmentId], references: [id])
counterProposals     Amendment[] @relation("CounterProposal")
```

### ActivityLog — new fields

```prisma
accessType        ActivityAccessType?
accessReason      String?
accessedByUserId  String?

enum ActivityAccessType { OWNER COLLABORATOR LEX_AI SYSTEM ADMIN_ACCESS }
```

### CredibilityScore — new field

```prisma
lexLogicScore  Decimal?
```

### Idea — new fields

```prisma
maturityIndex             Decimal  @default(0)
maturityIndexDetail       Json?
maturityLastUpdated       DateTime?
credibilityWeightedRating Decimal?
```

### CoherentAction — new field

```prisma
implementationSubQuestions Json?
// { who: string, what: string, where: string, how: string, why: string, when: string }
```

### Research — type change

`researchType`: String? → `ResearchType` enum: `EVIDENCE CASE_STUDY CAUSES PERSPECTIVES OTHER`

### Group — groupType enum

`MY_TEAM COMMUNICATIONS POLICY_DEVELOPMENT` — remove COLLABORATORS, SUPPORTERS, PUBLIC.

---

## 6. DATABASE SEEDING — `prisma/seed.ts`

```typescript
// SuperAdmin
await prisma.user.upsert({
  where: { email: 'cl@scrutinise.org' },
  update: {},
  create: {
    clerkId: 'PENDING_CLERK_LINK', // TODO: Charlie to update after Clerk registration
    email: 'cl@scrutinise.org',
    firstName: 'Charlie',
    preferredName: 'Charlie',
    role: 'SUPER_ADMIN',
    referralCode: crypto.randomUUID(),
  }
})

// PlatformConfig defaults
const configs = [
  { key: 'credibilityWeightingActive', value: false },
  { key: 'peerReviewRequired', value: false },
  { key: 'minReviewersForStage4', value: 12 },
  { key: 'minRatingForStage4', value: 2.5 },
]

// Stage display names
// stageNumber 1-5: Create, Draft, Develop, Campaign, Legislate
```

---

## 7. PROTOTYPE FIXES — REQUIRED THIS SPRINT

These are errors or inconsistencies found in the live prototype at scrutinise.org. Fix during Day 5 or alongside the relevant feature build.

### Fix 1 — Referral page: "Parliament" → "Legislate"
**File:** `app/prototype/referral/idea/[id]/page.tsx`
**Change:** In the "What is Scrutinise?" section, the five stages currently read "Create, Draft, Develop, Campaign, **Parliament**." Change "Parliament" to "**Legislate**."
**Also check:** `app/prototype/referral/user/[username]/page.tsx` for the same text.

### Fix 2 — Stage 2 Lex: Wrong opening message
**File:** `app/prototype/create/stage2/page.tsx`
**Current:** "Before we go any further, I want to understand the **problem** you're trying to solve."
**Required:** Opening message at Stage 1 must be exactly: *"I'm Lex, your researcher and guide. What's the **challenge** you want to fix?"*
Stage 2 entry uses the welcome message from `lex_system_prompt_v4.md` Section 13.

### Fix 3 — Stage 2 Lex: Wrong RH sidebar field list
**File:** `app/prototype/create/stage2/page.tsx`
**Current sidebar shows:** Problem Statement, Evidence Base, Proposed Solution, Who Is Affected, Coherent Actions
**Required sidebar shows** (7 items):
1. What's the Challenge? (`diagnosis`)
2. What's Causing It? (`rootCause`)
3. How Will We Solve It? (`guidingPolicy`)
4. A Practical Step (`coherentActions`)
5. Who's Affected? (`whoAffected`)
6. Evidence Base (`research`)
7. Proposed Wording (`proposedWording`)

### Fix 4 — Chat input position
**File:** `app/prototype/create/stage2/page.tsx`
**Current:** Input is pinned to the bottom of the browser window.
**Required:** Input sits immediately below the last Lex message. Previous messages scroll upward. Clear scroll-up arrow button for history. Input follows the conversation, not the viewport.

### Fix 5 — Idea page: No stage progress indicator
**File:** `app/prototype/idea/[id]/page.tsx`
**Issue:** Stage badge shows "Develop" but there is no visual showing where this sits in the five-stage journey.
**Required:** Add a five-step progress bar or stage stepper at the top of the idea page showing: Create → Draft → Develop → Campaign → Legislate, with the current stage highlighted. This applies to all idea pages, owner and public view.

### Fix 6 — Amendment notification routing
**File:** Notification click handler (wherever amendment notifications are rendered)
**Current:** Clicking an amendment notification takes user to the generic notifications page.
**Required:** Amendment notifications must deep-link to `/idea/[id]?tab=amendments` — i.e., the Amendments tab of the specific idea.

### Fix 7 — Settings: AI mode descriptions and default
**File:** `app/prototype/settings/page.tsx`
**Current:** Three unlabelled radio buttons for Socratic, Direct, Collaborative. No descriptions. Default is Socratic.
**Required:**
- Default must be **Collaborative**
- Add user-facing descriptions as help text under each option:
  - **Collaborative** (default): *"Lex will work through each step with you and contribute text suggestions where you are unsure what you want to write. For most users."*
  - **Socratic**: *"Lex will ask you questions to inspire you in ways to improve and strengthen your idea but will leave you in total control of the wording. For experts."*
  - **Direct**: *"Lex will give you the answer, prepare the draft, and prepare the research based on your direction and approvals."*

### Fix 8 — Homepage Step 3 description
**File:** `app/page.tsx`
**Current:** Step 3 (Develop) reads "Add research, develop arguments, first 25 votes."
**Required:** Remove "first 25 votes" — voting opens at Stage 4 not Stage 3. New description: "Add research, develop arguments, open to referral-link scrutiny."

---

## 8. WEEK 1 TASK LIST

**Week 1 goal:** Real auth wired. Database live. Idea creation with Lex working end-to-end. Stage 1→2 auto-progression. Stage 2→3 manual gate with modal. Real user can sign up, create idea, chat with Lex, and see idea advance to Stage 2 automatically.

### Days 1–2: Infrastructure

- [ ] Apply all schema changes (Section 5) to `prisma/schema.prisma`
- [ ] `npx prisma db push`
- [ ] Run seed script — confirm SuperAdmin, PlatformConfig, Stage display names
- [ ] Add Clerk provider to `app/layout.tsx` — replace UserSwitcher with real Clerk auth
- [ ] Add `preferredName` custom field to Clerk sign-up ("How would you like Lex to address you?")
- [ ] Add age confirmation + T&Cs + community rules checkboxes to Clerk sign-up
- [ ] Create `/api/webhooks/clerk/route.ts` — on UserCreated: create User in DB, generate referralCode
- [ ] Wire Clerk middleware — protect `/prototype/*`, allow public homepage
- [ ] Set `afterSignUpUrl`/`afterSignInUrl` to originating URL
- [ ] Enable 2FA in Clerk: optional for CITIZEN, mandatory for ADMIN/SUPER_ADMIN

### Days 3–4: Idea Creation and Lex

- [ ] `POST /api/ideas` — create idea (STAGE_1, PRIVATE, creatorId from Clerk)
- [ ] `GET + PATCH /api/ideas/[id]` — read/update (owner or collaborator only)
- [ ] `POST /api/ai/[ideaId]` — Lex endpoint (Gemini 2.5 Flash primary, Grok 4.1 fallback)
- [ ] Inject `preferredName` and `lexMode` (default COLLABORATIVE) into every Lex API call
- [ ] JSON field update stripping — remove fieldUpdates before returning to client
- [ ] Field update parsing — apply fieldUpdates to Idea record in DB
- [ ] Auto-save every 30 seconds (debounced PATCH)
- [ ] Stage 1→2 automatic gate — `checkAndAdvanceStage()` on every PATCH
- [ ] Stage 2→3 manual gate — validate ≥3 Research + other fields; warning modal
- [ ] `POST /api/ideas/[id]/progress` — progression endpoint

### Day 5: Collaborators + Prototype Fixes

- [ ] IdeaCollaborator API — invite by email, UserInvite with magicLinkToken
- [ ] Magic link landing `/invite/[token]`
- [ ] Resend email — invite email (check EmailSuppression first)
- [ ] **Fix 1** — Referral pages: "Parliament" → "Legislate"
- [ ] **Fix 2** — Stage 2 Lex: opening message and "challenge" terminology
- [ ] **Fix 3** — Stage 2 Lex: RH sidebar correct field list
- [ ] **Fix 4** — Chat input position: follows conversation, not pinned to viewport
- [ ] **Fix 5** — Idea page: five-stage progress stepper
- [ ] **Fix 6** — Amendment notifications: deep-link to Amendments tab
- [ ] **Fix 7** — Settings: AI mode descriptions + Collaborative as default
- [ ] **Fix 8** — Homepage Step 3 description: remove "first 25 votes"
- [ ] Auto-focus cursor on all search inputs

---

## 9. PRIVACY LOG MIDDLEWARE

In `GET /api/ideas/[id]`:

```typescript
if (['ADMIN', 'SUPER_ADMIN'].includes(requestingUser.role) && idea.creatorId !== requestingUser.id) {
  await prisma.activityLog.create({
    data: {
      ideaId: idea.id,
      accessedByUserId: requestingUser.id,
      accessType: 'ADMIN_ACCESS',
      accessReason: req.headers.get('x-access-reason') ?? 'No reason provided',
    }
  })
}
```

Admin panel: reason dropdown before loading another user's idea. Privacy Log tab UI: Sprint 2.

---

## 10. SECURITY CHECKLIST

1. auth() from Clerk — 401 if no session
2. Authorise — 403 if no permission
3. Zod on every request body and query param
4. Always Prisma — never raw SQL with user input
5. DOMPurify on all user-generated rich text
6. SHA-256 hash IPs
7. Rate limits: votes 20/hr per IP; AI 50/hr per user; uploads 10/day per user
8. Check EmailSuppression before every send
9. Strip fieldUpdates from Lex response
10. Private R2 files via 24hr signed URLs only

---

## 11. DO NOT TOUCH THIS SPRINT

Voice dictation UI, Red Team, Campaign in a Box, site-wide Lex, credibility weighting, political spectrum UI, team roles, Policy Development Group, Privacy Log UI, field encryption, homepage videos.

Queue for Lex UI sprint: `UX_and_voice_build_notes.md` — voice API, progress bar, one-time mic tooltip, full chat input spec.

---

## 12. WEEK 1 SUCCESS CRITERIA

1. New user signs up via Clerk with preferred name, age confirmation, T&Cs, community rules. User record in Railway with all consent fields.
2. Signed-in user creates idea, chats with Lex. Fields update in DB. Lex uses preferredName.
3. Lex uses Collaborative mode by default.
4. title + summaryDescription complete → idea auto-advances to Stage 2. Lex achievement message.
5. Stage 2→3 modal appears. Gate blocks if <3 Research records.
6. Collaborator invite email sent (check Resend). Magic link creates account.
7. Admin accessing another user's idea → ActivityLog record created.
8. All 8 prototype fixes applied and visible on scrutinise.org.

---

## 13. COMMIT DISCIPLINE

```
feat: wire Clerk webhook and create User on sign-up
feat: inject preferredName and lexMode into Lex API calls
feat: stage 1→2 automatic gate in stage-gates.ts
fix: referral page Parliament → Legislate
fix: chat input position follows conversation not viewport
fix: settings AI modes descriptions and Collaborative default
fix: idea page add five-stage progress stepper
```

Update CHANGE_LOG.md and handoff_summary.md at session end.

---

*CC_Sprint1_Briefing.md — Scrutinise — 22 March 2026 v2*
