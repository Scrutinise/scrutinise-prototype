# SCRUTINISE — CLAUDE CODE CONTEXT FILE

*Read this first, every session, before touching any code.* *Last updated: 22 March 2026 — v3. Updated with UX/voice build notes, Lex welcome message, AI style descriptions, amendment UX, prototype fixes.*

## CONTENTS

1.  Start of Session Checklist
2.  Project Overview
3.  The Five Stages
4.  Key Terminology
5.  Repository Structure
6.  Critical Architecture Decisions
7.  Security Rules
8.  Coding Patterns
9.  Environment Variables
10. Out of Scope for Sprint 1

***

## 1. START OF SESSION CHECKLIST

Before writing any code:

1.  Read `entity_list_v5.md` — know every entity and field
2.  Read `process_list_v2.md` — for the specific feature area you are building
3.  Read `system_mechanics_v0.7.md` — the rules behind what you are building
4.  Read `CC_Sprint1_Briefing.md` — confirm what week/day you are on and what is in scope
5.  Run `git status` — know where the codebase is before changing it
6.  Never assume — if a spec is ambiguous, stop and ask Charlie before building

***

## 2. PROJECT OVERVIEW

Scrutinise is a not-for-profit civic engagement platform enabling citizens, aspiring politicians, and engaged professionals to develop policy ideas into Parliament-ready legislation through a structured, AI-guided collaborative process.

Stack: Next.js 14 (App Router), TypeScript, Prisma, PostgreSQL (Railway EU West Amsterdam), Cloudflare R2, Clerk Auth, Vercel, Resend (email), Gemini 2.5 Flash / Grok 4.1 Fast (AI)

***

## 3. THE FIVE STAGES

Stage 1 — CREATE: Owner develops basic idea and strategic kernel with Lex. Visibility: private. Stage 2 — DRAFT: Owner invites collaborators, refines with small team. Visibility: invited only. Stage 3 — DEVELOP: Opens via referral link, public scrutiny. NO voting. Visibility: link-only. Stage 4 — CAMPAIGN: Listed publicly, voting opens, full community engagement. Visibility: platform-listed. Stage 5 — LEGISLATE: Parliamentary submission, MP endorsements, committee tracking. Visibility: public.

**Stage 1→2:** AUTOMATIC — fires on every idea PATCH when title + summaryDescription are both non-empty. **Stage 2→3:** MANUAL — "Take Public." Gate: diagnosis + guidingPolicy + 1 CoherentAction + 3 Research. Warning modal required. **Stage 3→4:** MANUAL — "Begin Campaign." Gate: 12 IdeaReview records + avg quality 2.5+. **Stage 4→5:** MANUAL — "Submit to Parliament." Gate: 3 MP + 3 Peer endorsements (separate) + 1 DraftsmanEndorsement + all proposedWording complete.

***

## 4. KEY TERMINOLOGY — USE EXACTLY, NEVER SUBSTITUTE

-   AI assistant = **Lex** (never "Claude", "the AI", "AI assistant")
-   Reputation = **Credibility / Credibility Score** (never "reputation")
-   Stage 5 = **Legislate** (never "Parliament" as a stage name — in all UI, badges, referral pages, Five Steps panels)
-   Comments in UI = **Contributions** (DB field stays "comment")
-   Voting = hidden at Stages 1, 2, 3. Visible only from **Stage 4**
-   Group types = MY_TEAM / COMMUNICATIONS / POLICY_DEVELOPMENT
-   "Problem" in UI = **Challenge** (DB field name stays "diagnosis" — UI label only changes)
-   Lex AI mode default = **Collaborative** (not Socratic)
-   Points = Strategist, Thinker, Rallymaster, Rainmaker, Teambuilder (never "Dealweaver")

***

## 5. REPOSITORY STRUCTURE

```
scrutinise/
├── CLAUDE.md
├── docs/
│   ├── entity_list_v5.md           (CCh-only — never edit)
│   ├── process_list_v2.md
│   ├── system_mechanics_v0.7.md
│   ├── lex_system_prompt_v4.md     (confidential)
│   ├── wireframes_v3.md
│   ├── UX_and_voice_build_notes.md (queue for Lex UI sprint)
│   └── CC_Sprint1_Briefing.md      (current sprint — read every session)
├── prisma/schema.prisma
├── app/
│   ├── layout.tsx
│   ├── page.tsx                    (homepage — public)
│   ├── about/page.tsx
│   ├── training/page.tsx
│   ├── (auth)/
│   ├── dashboard/page.tsx
│   ├── ideas/
│   │   ├── page.tsx                (browse — Stage 4+)
│   │   ├── [id]/page.tsx           (idea detail)
│   │   └── create/page.tsx         (Lex chat)
│   ├── user/[username]/page.tsx
│   ├── invite/[token]/page.tsx
│   ├── unsubscribe/[token]/page.tsx
│   ├── admin/
│   └── api/
└── lib/
    ├── prisma.ts, auth.ts, stage-gates.ts
    ├── points.ts, credibility.ts
    ├── notifications.ts, email.ts, r2.ts, ai.ts
```

***

## 6. CRITICAL ARCHITECTURE DECISIONS

### AUTHENTICATION

-   Clerk handles all auth. `afterSignUpUrl` / `afterSignInUrl` always return to originating URL.
-   Sign-up includes: preferred name field, age confirmation (18+), T&Cs, community rules checkboxes.
-   **Preferred name** (how the user wants Lex to address them) defaults to first name. Stored as `preferredName` on User.
-   2FA: optional for CITIZEN, mandatory for ADMIN and SUPER_ADMIN.

### STAGE 1 ONBOARDING — NO UPFRONT REGISTRATION GATE

-   User lands on Create page and Lex is already there, already asking. Zero forms before value.
-   Account creation is triggered AFTER Lex produces the first Strategic Kernel draft.
-   The `triggerSavePrompt: true` flag in Lex JSON signals the frontend to surface the save prompt → Clerk signup.

### LEX CHAT INPUT SPEC (Stage 1)

-   Auto-expanding textarea. Enter sends, Shift+Enter for new line.
-   URL pasting accepted and passed to Lex as context.
-   File upload (PDF/doc) accepted for background context.
-   Voice dictation via Web Speech API — mic button conditionally rendered (hide if unsupported).
-   Auto-save every 3 seconds of inactivity after first input.
-   Progress indicator starts at 20% on first message sent (see UX_and_voice_build_notes.md Section 4).
-   **Chat input position:** immediately below the last Lex message. Previous messages scroll upward. Clear scroll-up arrow button for history. Input is NOT pinned to the bottom of the browser window.
-   Cursor auto-focused in input on page load — no click required.
-   Mobile: input must not be obscured by keyboard — test on iOS Safari.

### LEX AI MODES

Three modes selectable in Settings and on idea creation. **Default is Collaborative.**

| Mode                    | Description shown to user                                                                                                                                |
|-------------------------|----------------------------------------------------------------------------------------------------------------------------------------------------------|
| Collaborative (default) | "Lex will work through each step with you and contribute text suggestions where you are unsure what you want to write. For most users."                  |
| Socratic                | "Lex will ask you questions to inspire you in ways to improve and strengthen your idea but will leave you in total control of the wording. For experts." |
| Direct                  | "Lex will give you the answer, prepare the draft, and prepare the research based on your direction and approvals."                                       |

### DATABASE

-   PostgreSQL on Railway. Prisma ORM always. `prisma.$transaction` for multi-table ops.

### FILE STORAGE

-   Cloudflare R2. Private bucket: 24hr signed URLs. Public CDN: profile images.
-   ClamAV virus scan all PDFs. Google Safe Browsing API all external URLs.

### AI (LEX)

-   Provider locked at Idea level on creation. Primary: Gemini 2.5 Flash. Fallback: Grok 4.1 Fast.
-   Lex scope v1: idea creation and contribution pages only — not site-wide.
-   JSON field updates stripped server-side before returning to client.

### EMAIL

-   Resend. Always check EmailSuppression before sending. One-click unsubscribe on every email.

### PRIVACY LOG

-   Every ADMIN/SUPER_ADMIN access to another user's idea creates an ActivityLog record.
-   Admin panel shows reason-selection dropdown before loading another user's idea.
-   Privacy Log tab on idea detail — owner-only. Sprint 2 UI; log events from Sprint 1.

### SUPER_ADMIN

-   Email: cl@scrutinise.org. Role = SUPER_ADMIN. Seeded on first migration.

***

## 7. SECURITY RULES — NON-NEGOTIABLE

1.  `auth()` from Clerk — 401 if no session
2.  Authorise — 403 if no permission for this resource
3.  Zod on every request body and query param
4.  Always Prisma — never raw SQL with user input
5.  DOMPurify on all user-generated rich text
6.  SHA-256 hash IPs — never store raw
7.  Rate limits: votes 20/hr per IP; AI 50/hr per user; uploads 10/day per user
8.  Check EmailSuppression before every send
9.  Strip `fieldUpdates` from Lex response before returning to client
10. All private R2 files via 24hr signed URLs only

***

\#\# GIT COMMAND APPROVAL POLICY

***

All git operations in this project are pre-approved for the following conditions:

***

\- cd target is always D:/Dropbox/GitHub/scrutinise-prototype or a subdirectory

***

\- git commands are limited to: status, add, commit, push, pull, log, branch, checkout

***

\- No git fetch or clone from remote URLs other than origin (https://github.com/Scrutinise/scrutinise-prototype.git)

***

\- Commits use descriptive messages matching sprint naming conventions (e.g. V2C-leg-ingest)

***

***

CC should proceed with all git commands meeting the above criteria without pausing for approval.

***

***

## 8. CODING PATTERNS

Standard API route, stage gate, and privacy log patterns: see CC_Sprint1_Briefing.md Section 8.

***

## 9. ENVIRONMENT VARIABLES

```
DATABASE_URL=
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=
CLERK_SECRET_KEY=
CLERK_WEBHOOK_SECRET=
GEMINI_API_KEY=
GROK_API_KEY=
CLOUDFLARE_ACCOUNT_ID=
R2_ACCESS_KEY_ID=
R2_SECRET_ACCESS_KEY=
R2_BUCKET_UPLOADS=scrutinise-uploads
R2_BUCKET_PROFILES=scrutinise-profiles
R2_PUBLIC_URL=
RESEND_API_KEY=
GOOGLE_SAFE_BROWSING_API_KEY=
NEXT_PUBLIC_GA4_MEASUREMENT_ID=
NEXT_PUBLIC_APP_URL=https://scrutinise.co.uk
```

***

## 10. OUT OF SCOPE FOR SPRINT 1

Red Team mechanic, Campaign in a Box, site-wide Lex, credibility-weighted ratings, political spectrum UI (store fields only), team roles, Policy Development Group veto, Privacy Log UI (log events only), field encryption, voice dictation UI (queue for Lex UI sprint), address book import, offline mode, WhatsApp, fundraising, SMS verification, Parliament Members API.

***

## 11. FIELD & DOCUMENT PRESERVATION

Never remove a field, entity, or section without Charlie's explicit instruction. `entity_list_v5.md` is CCh-only.

## 12. GIT DISCIPLINE

One logical unit of work per commit. Descriptive commit messages matching sprint naming conventions.

**IMPORTANT — DO NOT call git during a sprint build.** Claude Code's security layer prompts for approval on every compound cd + git command, which interrupts runs. Instead, follow this pattern at the end of every sprint:

1. Write all code changes to disk during the sprint — no git calls.
2. Run tsc --noEmit to confirm clean.
3. At the very end, produce a file called commit-all.sh in the project root containing all git commands in sequence:

```bash
#!/bin/bash
set -e
cd D:/Dropbox/GitHub/scrutinise-prototype

git add [specific files for commit 1]
git commit -m "commit message 1"

git add [specific files for commit 2]
git commit -m "commit message 2"

git push origin Main
echo "Done."
```

4. Execute commit-all.sh immediately — Charlie approves the single execution prompt.
5. Delete commit-all.sh after successful push.

Update CHANGE_LOG.md and handoff_summary.md content during the sprint, but include those files in commit-all.sh rather than committing mid-session.

***

*Update this file immediately whenever a decision changes.*
