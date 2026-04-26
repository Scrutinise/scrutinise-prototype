# SCRUTINISE — CLAUDE CODE CONTEXT FILE

*Read this first, every session, before touching any code.* *Last updated: 25 April 2026 — v4. Added Section 0 (verify before asserting), updated Section 1 boot checklist, current-state pointer, current sprint pointer.*

## CONTENTS

**Verify before asserting (READ FIRST)**

Start of Session Checklist

Project Overview

The Five Stages

Key Terminology

Repository Structure

Critical Architecture Decisions

Security Rules

Coding Patterns

Environment Variables

Out of Scope (per-sprint)

Field & Document Preservation

Git Discipline

***

## 0. VERIFY BEFORE ASSERTING

CCh and CC must verify factual claims before stating them as fact. This applies to:

-   URLs, endpoints, and access status (public/private/paywalled/decommissioned)
-   File contents, line counts, and code structure
-   Schema fields, database state, and R2 keys
-   Tool/library behaviour and version-specific features
-   Third-party API responses and rate limits
-   What another instance (CCh or CC) has reportedly found

**The failure mode to avoid:** tool or sub-instance returns a surprising result → build a plan on top of it → discover the result was wrong.

When something is reported that contradicts expectation, verify directly before responding. "CC said X" is not verification; CC's report is itself a claim that needs checking when consequential.

When a claim cannot be verified within reasonable effort, state it as uncertain ("CC reports that…", "this appears to be…", "I haven't confirmed but…") rather than asserting it as fact.

This rule takes precedence over speed. A 30-second verification prevents hours of rework on a wrong premise.

**For CC specifically:** an HTTP 401 on one path does not mean the whole site is invite-only. An HTTP 403 on one S3 prefix does not mean the bucket is decommissioned. Test the homepage and at least one canonical path before drawing site-wide conclusions.

***

## 1. START OF SESSION CHECKLIST

Before writing any code:

1.  Read `scrutinise-docs/handoff_summary.md` first. The top section ("CURRENT STATE") is authoritative for what is in progress and what just happened. If it conflicts with anything below in this file, the handoff wins.
2.  Read `scrutinise-docs/CHANGE_LOG.md` top entries — last 5–10 changes provide recent context.
3.  Read `scrutinise-docs/entity_list_v5.md` — when working on schema or DB changes.
4.  Read `scrutinise-docs/process_list_v2.md` — for the specific feature area being built.
5.  Read `scrutinise-docs/system_mechanics_v0_8.md` — when working on credibility, voting, points, stage gates.
6.  If a brief from CCh references specific files (e.g. `V2.75_architecture_audit.md`), read those before any code work.
7.  **Do NOT run** `git status` **mid-session.** See Section 12. Git is end-of-sprint only via `commit-all.sh`.
8.  Never assume — if a spec is ambiguous, stop and ask Charlie before building.

***

## 2. PROJECT OVERVIEW

Scrutinise is a not-for-profit civic engagement platform enabling citizens, aspiring politicians, and engaged professionals to develop policy ideas into Parliament-ready legislation through a structured, AI-guided collaborative process.

Stack: Next.js 14 (App Router), TypeScript, Prisma, PostgreSQL (Railway EU West Amsterdam), Cloudflare R2, Clerk Auth, Vercel, Resend (email), Gemini 2.5 Flash / Grok 4.1 Fast / Claude Haiku 4.5 fallback (AI), Sentry (errors), GA4 + Vercel Web Analytics.

Production: scrutinise.org. Active platform with V1 features live. V2 sprint development in progress. Authoritative status: `scrutinise-docs/handoff_summary.md`.

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
scrutinise-prototype/
├── CLAUDE.md                           (this file — root)
├── commit-all.sh                       (transient, end of sprint only)
├── ecosystem.config.js                 (PM2 unattended runner)
├── scrutinise-docs/                    (specs and handoff)
│   ├── handoff_summary.md              (READ FIRST every session)
│   ├── CHANGE_LOG.md                   (recent changes)
│   ├── entity_list_v5.md               (CCh-only — never edit without Charlie)
│   ├── process_list_v2.md
│   ├── system_mechanics_v0_8.md
│   ├── lex_system_prompt_v5_1.md       (confidential — current Lex prompt)
│   ├── wireframes_v3.md
│   ├── UX_and_voice_build_notes.md
│   └── decision-analysis-design-note.md
├── scrutinise-web/                     (Next.js app)
│   ├── prisma/schema.prisma
│   ├── lib/                            (prisma, auth, r2, ai, points, …)
│   ├── components/
│   ├── app/
│   │   ├── page.tsx, layout.tsx
│   │   ├── (auth)/, dashboard/, ideas/, user/[username]/, invite/[token]/
│   │   ├── legislation/, legislation-compare/
│   │   ├── admin/
│   │   └── api/                        (legislation-search, test-sections, …)
│   └── package.json
└── scripts/
    ├── tsconfig.json
    └── legislation/
        ├── ingest.ts                   (R2-first, --full, checkpoint/resume)
        ├── compile.ts                  (R2 round-trip, AI compile + Lex summary)
        ├── r2-client.ts                (R2 utility for scripts)
        └── ingest-checkpoint.json      (state file)
```

***

## 6. CRITICAL ARCHITECTURE DECISIONS

### AUTHENTICATION

-   Clerk handles all auth. `afterSignUpUrl` / `afterSignInUrl` always return to originating URL.
-   Sign-up includes: preferred name field, age confirmation (18+), T&Cs, community rules checkboxes.
-   **Preferred name** (how the user wants Lex to address them) defaults to first name. Stored as `preferredName` on User.
-   2FA: optional for CITIZEN, mandatory for ADMIN and SUPER_ADMIN.
-   Clerk webhook URL must use `www.scrutinise.org` (not bare domain).

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
-   Progress indicator starts at 20% on first message sent (see UX_and_voice_build_notes.md).
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
-   Wrap Prisma calls in `withPrismaRetry()` for ingest/compile scripts (handles P1017/P1001).
-   Build command: `npm run build` with `postinstall: "prisma generate"`.

### STORAGE ARCHITECTURE (V2L onwards)

Railway PostgreSQL (Hobby 5GB — HARD LIMIT):

-   Stores ONLY: FTS fields (`originalText`, `sectionTitle`, `policyArea`), pointer keys (`rawXmlKey`, `compiledTextKey`, `lexSummaryKey`), metadata, user data.
-   NEVER stores: compiledText, tnaCompiledText, lexSummary, rawXml.
-   Before any schema change, estimate Railway size impact.
-   If Railway DB exceeds 4GB, alert Charlie before proceeding.

Cloudflare R2 (`scrutinise-legislation` bucket):

**V2L key scheme (current production):**

```
{legislationGovUkId}/sections/{N}.xml           (raw CLML — current state TNA)
{legislationGovUkId}/sections/{N}.compiled.txt  (AI compiled or TNA direct)
{legislationGovUkId}/sections/{N}.summary.txt   (Lex plain-English summary)
```

**V2.75-H key scheme (in transition):**

```
{legislationGovUkId}/sections/{N}.original.xml  (enacted CLML)
{legislationGovUkId}/sections/{N}.tna.xml       (current revised CLML)
{legislationGovUkId}/effects.xml                (structured effects feed per act)
```

On-demand flow: FTS query Railway → R2 key → r2Get() → user. Analytics flow: copy batch R2→Railway, run analysis, delete source.

R2 client files:

-   `scripts/legislation/r2-client.ts` (for ingest/compile scripts)
-   `scrutinise-web/lib/r2.ts` (for Next.js API routes)

### AI (LEX)

-   Provider locked at Idea level on creation. Primary: Gemini 2.5 Flash. Fallback for compile.ts: Claude Haiku 4.5 (`claude-haiku-4-5-20251001`) on Gemini 429.
-   Lex scope v1: idea creation and contribution pages only — not site-wide.
-   JSON field updates stripped server-side before returning to client.
-   LexInsight: DB table + admin panel; hard cap alert at 50-rule limit; fire-and-forget pattern in API routes.

### EMAIL

-   Resend. Always check EmailSuppression before sending. One-click unsubscribe on every email.

### VERCEL

-   `maxDuration: 60` set in `vercel.json` for compile-heavy routes.
-   Vercel Web Analytics integrated.

### PRIVACY LOG

-   Every ADMIN/SUPER_ADMIN access to another user's idea creates an ActivityLog record.
-   Admin panel shows reason-selection dropdown before loading another user's idea.
-   Privacy Log tab on idea detail — owner-only.

### SUPER_ADMIN

-   Email: cl@scrutinise.org. Role = SUPER_ADMIN.

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

## GIT COMMAND APPROVAL POLICY (legacy, see Section 12)

All git operations in this project are pre-approved for the following conditions:

-   cd target is always `D:/Dropbox/GitHub/scrutinise-prototype` or a subdirectory
-   git commands are limited to: status, add, commit, push, pull, log, branch, checkout
-   No git fetch or clone from remote URLs other than origin (`https://github.com/Scrutinise/scrutinise-prototype.git`)
-   Commits use descriptive messages matching sprint naming conventions

**However:** per Section 12, CC does NOT call git mid-sprint. The above approval policy exists so that the single end-of-sprint `commit-all.sh` execution does not need re-approval per command. CC produces commit-all.sh, Charlie approves the single execution, then CC deletes commit-all.sh.

***

## 8. CODING PATTERNS

Standard API route, stage gate, and privacy log patterns: see process_list_v2.md and entity_list_v5.md. Refer to existing routes (`app/api/ideas/[id]/legislation-search/route.ts` etc.) as canonical examples.

***

## 9. ENVIRONMENT VARIABLES

```
DATABASE_URL=
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=
CLERK_SECRET_KEY=
CLERK_WEBHOOK_SECRET=
GEMINI_API_KEY=
GROK_API_KEY=
ANTHROPIC_API_KEY=                          (Claude Haiku fallback)
CLOUDFLARE_R2_ACCESS_KEY_ID=
CLOUDFLARE_R2_SECRET_ACCESS_KEY=
CLOUDFLARE_R2_ACCOUNT_ID=
CLOUDFLARE_R2_BUCKET_NAME=scrutinise-legislation
R2_ACCESS_KEY_ID=                            (legacy — uploads/profiles buckets)
R2_SECRET_ACCESS_KEY=
R2_BUCKET_UPLOADS=scrutinise-uploads
R2_BUCKET_PROFILES=scrutinise-profiles
R2_PUBLIC_URL=
RESEND_API_KEY=
GOOGLE_SAFE_BROWSING_API_KEY=
NEXT_PUBLIC_GA4_MEASUREMENT_ID=
NEXT_PUBLIC_APP_URL=https://www.scrutinise.org
SENTRY_DSN=
```

***

## 10. OUT OF SCOPE (per-sprint)

The current "out of scope" list is sprint-specific and lives in the active CCh brief, not in this static file. Refer to handoff_summary.md "CURRENT STATE" section for what is in scope right now.

Long-term out-of-scope items (no firm sprint date):

-   Red Team mechanic, Campaign in a Box, site-wide Lex
-   Credibility-weighted ratings (mechanics designed, UI deferred)
-   Political spectrum UI (store fields only)
-   Address book import, offline mode, WhatsApp integration, SMS verification, Parliament Members API integration

***

## 11. FIELD & DOCUMENT PRESERVATION

Never remove a field, entity, or section without Charlie's explicit instruction. `entity_list_v5.md` is CCh-only.

***

## 12. GIT DISCIPLINE

One logical unit of work per commit. Descriptive commit messages matching sprint naming conventions.

**IMPORTANT — DO NOT call git during a sprint build.** Claude Code's security layer prompts for approval on every compound `cd + git` command, which interrupts runs. Instead, follow this pattern at the end of every sprint:

1.  Write all code changes to disk during the sprint — no git calls.
2.  Run `tsc --noEmit` to confirm clean.
3.  At the very end, produce a file called `commit-all.sh` in the project root containing all git commands in sequence:

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

4.  Execute commit-all.sh immediately — Charlie approves the single execution prompt.
5.  Delete commit-all.sh after successful push.

**Exception:** `handoff_summary.md` and `CHANGE_LOG.md` may be updated mid-sprint where the working state changes are significant for context preservation across `/clear` boundaries. They are still committed only at end of sprint via `commit-all.sh`.

The last several sprints have ended with mid-sprint commits despite this rule. Every CCh brief must explicitly remind CC of Section 12. If CC reaches for git mid-sprint, CC stops and writes commit-all.sh instead.

***

*Update this file immediately whenever a decision changes.*
