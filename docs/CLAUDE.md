# SCRUTINISE — CLAUDE CODE CONTEXT FILE

*Read this first, every session, before touching any code.* *Last updated: 25 April 2026 — v4. Added Section 0 (verify before asserting), updated Section 1 boot checklist, current-state pointer, current sprint pointer.*

## SESSION PERMISSIONS
The .claude/settings.json in this project pre-approves Bash(*), Read(*), Write(*), Edit(*) for all operations. These permissions apply to this entire session. Do not pause for confirmation on bash commands, file reads/writes/edits, Railway API calls, SQL operations, or tsx script runs. Only pause for: permanently destructive schema changes (DROP TABLE), deleting Railway services, or actions explicitly marked STOP in the sprint brief.

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

1.  Read `docs/handoff_summary.md` first. The top section ("CURRENT STATE") is authoritative for what is in progress and what just happened. If it conflicts with anything below in this file, the handoff wins.
2.  Read `docs/CHANGE_LOG.md` top entries — last 5–10 changes provide recent context.
3.  Read `docs/entity_list_v5.md` — when working on schema or DB changes.
4.  Read `docs/process_list_v2.md` — for the specific feature area being built.
5.  Read `docs/system_mechanics_v0_8.md` — when working on credibility, voting, points, stage gates.
6.  If a brief from CCh references specific files (e.g. `V2.75_architecture_audit.md`), read those before any code work.
7.  **Do NOT run** `git status` **mid-session.** See Section 12. Git is end-of-sprint only via `commit-all.sh`.
8.  Never assume — if a spec is ambiguous, stop and ask Charlie before building.

***

## 2. PROJECT OVERVIEW

Scrutinise is a not-for-profit civic engagement platform enabling citizens, aspiring politicians, and engaged professionals to develop policy ideas into Parliament-ready legislation through a structured, AI-guided collaborative process.

Stack: Next.js 14 (App Router), TypeScript, Prisma, PostgreSQL (Railway EU West Amsterdam), Cloudflare R2, Clerk Auth, Vercel, Resend (email), Gemini 2.5 Flash / Grok 4.1 Fast / Claude Haiku 4.5 fallback (AI), Sentry (errors), GA4 + Vercel Web Analytics.

Production: scrutinise.org. Active platform with V1 features live. V2 sprint development in progress. Authoritative status: `docs/handoff_summary.md`.

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
-   The Page-2 diagnosis field in UI = **The problem** (never "Challenge"). **REVERSED on 11 Aug 2026 by §19-D Task 1a** — this line previously read *"Problem" in UI = **Challenge***, and that label is what let a user enter a *solution* ("I want to change the amount charged for plastic bags in shops") and have it accepted as the diagnosis. *A vague label invites a vague answer.* DB field names are unchanged: `Idea.diagnosis` (legacy surface) and `Idea.challenge` / field key `challenge` (Lex rebuild) both stay as they are — this is a label change only.
-   Lex AI mode default = **Collaborative** (not Socratic)
-   Points = Strategist, Thinker, Rallymaster, Rainmaker, Teambuilder (never "Dealweaver")

***

## 5. REPOSITORY STRUCTURE

```
scrutinise-prototype/
├── CLAUDE.md                           (this file — root)
├── commit-all.sh                       (transient, end of sprint only)
├── ecosystem.config.js                 (PM2 unattended runner)
├── docs/                    (specs and handoff)
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

Railway PostgreSQL (volume resized to 20GB after 5GB crash on 4 Jun 2026 — HARD LIMIT):

-   Stores ONLY: FTS fields (`originalText`, `sectionTitle`, `policyArea`), pointer keys (`rawXmlKey`, `compiledTextKey`, `lexSummaryKey`), metadata, user data.
-   NEVER stores: compiledText, tnaCompiledText, lexSummary, rawXml.
-   Before any schema change, estimate Railway size impact.
-   If Railway DB exceeds 4GB (old limit) / 16GB (80% of 20GB), alert Charlie before proceeding.
-   Scheduler emails now include DB size % in every hourly email — ⚠️ at 80%, ⚠️ CRITICAL at 90%.

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

-   cd target is always `C:/Code/scrutinise-prototype` or a subdirectory
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

**Always date *and time* stamp in UTC** (`YYYY-MM-DD HH:MM UTC`), from the actual system clock (`[DateTime]::UtcNow.ToString("yyyy-MM-dd HH:mm")`), in BOTH (a) the commit message as a `Date:` trailer alongside `Co-Authored-By:`, and (b) the heading of the matching `CHANGE_LOG.md` entry — so the history lines up with when a commit/error occurred. **Use UTC for all log timestamps/comparisons too** (a BST↔UTC mixup once caused a false "build hung" call). Applies to every commit, including each one inside `commit-all.sh`. See root `CLAUDE.md` → "Git — commit & CHANGE_LOG timestamping".

**Exception — build-breaking fixes ship immediately.** A fix for a broken build/deploy (e.g. a type error failing the Vercel build) is NOT batched into the next `commit-all.sh`: commit it on its own and push to `Main` at once (still with the `Date:` trailer). This is the one sanctioned mid-sprint git action.

**IMPORTANT — DO NOT call git during a sprint build.** Claude Code's security layer prompts for approval on every compound `cd + git` command, which interrupts runs. Instead, follow this pattern at the end of every sprint:

1.  Write all code changes to disk during the sprint — no git calls.
2.  Run `tsc --noEmit` to confirm clean.
3.  At the very end, produce a file called `commit-all.sh` in the project root containing all git commands in sequence:

```bash
#!/bin/bash
set -e
cd C:/Code/scrutinise-prototype

git add [specific files for commit 1]
git commit -m "commit message 1"

git add [specific files for commit 2]
git commit -m "commit message 2"

git push origin Main
echo "Done."
```

4.  Execute commit-all.sh immediately — Charlie approves the single execution prompt.
5.  Delete commit-all.sh after successful push.
6.  **Then run the four delivery checks in §20 — the push is not the delivery.** A clean `tsc` and a
    successful `commit-all.sh` prove nothing about what the running site serves; §20 exists because
    three sprints closed on exactly that evidence while production served older code. In particular
    step 3 above only lists *specific files*, which is how an ignored file gets left behind — §20
    check 1 (`git ls-files` / `git check-ignore -v`, confirming the file and not the pattern) is the
    one that catches it.

**Exception:** `handoff_summary.md` and `CHANGE_LOG.md` may be updated mid-sprint where the working state changes are significant for context preservation across `/clear` boundaries. They are still committed only at end of sprint via `commit-all.sh`.

The last several sprints have ended with mid-sprint commits despite this rule. Every CCh brief must explicitly remind CC of Section 12. If CC reaches for git mid-sprint, CC stops and writes commit-all.sh instead.

### Sprint brief protocol

- CCh writes each sprint brief to `docs/SPRINT.md` before each CC session
- CC reads `docs/SPRINT.md` at session start using a targeted view (not full file dump)
- CC archives completed sprint to `CHANGE_LOG.md` at sprint end and clears `SPRINT.md`
- Never paste the full brief into chat — keep briefs in the file to save context
- When reading large files, always use line-range view or grep — never dump entire files

***

*Update this file immediately whenever a decision changes.*

***

## 13. PARSE FAILURE DIAGNOSTIC PROTOCOL

When ingest code or any tool reports a parse failure (JSON, XML, CSV, or any structured format), **do NOT form hypotheses about cause before inspecting the actual bytes**. The diagnostic path is:

1. **Dump the raw input** that the parser is rejecting to a file using Buffer-level capture (no encoding conversion at the capture point).
2. **Inspect the bytes** — first 200 bytes, last 200 bytes, hex + ASCII representation. Use `Get-Content -Encoding Byte` (PowerShell) or `xxd` (bash) or `[System.IO.File]::ReadAllBytes()` (PowerShell .NET).
3. **Attempt independent parse** — if Node JSON.parse fails, try PowerShell `ConvertFrom-Json`. If PowerShell fails, try Node. Different parsers reveal different things.
4. **If the independent parser also fails**, find the exact character offset of the failure. Most parsers report column or position. Inspect ±50 chars around it byte-by-byte.
5. **Only after seeing the actual contamination should hypotheses about cause be formed.**

### Common contamination patterns to look for

- Unescaped `"` or `\` inside string values (often caused by serialiser bugs or encoding round-trips)
- UTF-8 BOM (`ef bb bf` prefix) on files that shouldn't have one
- CLIXML headers when capturing PowerShell stderr/stdout in mixed-output mode
- Control characters (bytes 0x00-0x1F) embedded inside string values
- Curly Unicode quotes (`"` `"`, codepoints 8220/8221) where ASCII was expected, or vice versa
- Mojibake (UTF-8 bytes read as Windows-1252) — look for `Ã` or `â€` sequences
- Best-fit transcoding (curly quotes silently converted to ASCII straight quotes during stdout output)

### Retry logic policy

**Retry is appropriate for genuinely transient failures** (network timeouts, rate limiting, database lock contention). **Retry is NOT appropriate for parse failures.** A parse failure that recurs three times in identical form is deterministic — retrying it wastes time and obscures diagnosis. Ingest scripts should either succeed on first parse or fail loudly with full byte dump for diagnosis.

### Canonical example

See V.3-B Phase 3 sprint (`docs/v3b_phase3_report.md`) for the worked example of this protocol applied to a Windows PowerShell stdout encoding bug. The diagnostic took ~5 hours of debugging because the protocol was followed inconsistently — hypotheses were formed before bytes were inspected. Following the protocol from the start would have isolated the bug in 15-30 minutes.

### Spawned-process testing caveat

CC's test environment can differ from the production code path in subtle ways. Specifically: CC's tool sandbox may use UTF-8 as default stdout encoding while Charlie's Windows PowerShell terminal uses Windows-1252. **For any code that spawns external processes, verification must run in Charlie's actual terminal** — CC's test results for external-process invocations are advisory only.

***

## 14. WINDOWS POWERSHELL STDOUT ENCODING

Windows PowerShell (5.1 and 7+) defaults `[Console]::OutputEncoding` to the system code page — typically Windows-1252 on English-UK installs, OEM code pages on other locales. This means PowerShell scripts that emit non-ASCII characters via stdout will have those characters **silently best-fit mapped to ASCII equivalents** during the stdout write. Curly Unicode quotes (`"` codepoint 8220) become ASCII straight quotes (`"` codepoint 34). Em-dashes (`—`) become hyphens. Accented characters lose their accents.

This corruption is invisible — no error, no warning, no log entry. The downstream consumer (typically a Node process reading the PowerShell stdout) sees corrupted ASCII content and may produce silent data integrity failures, or visible parse failures when the corruption affects JSON-structural characters.

### Mandatory rule

**Every PowerShell script that emits content via stdout MUST set `[Console]::OutputEncoding` to UTF-8 as its first executable line:**

```powershell
[Console]::OutputEncoding = [System.Text.Encoding]::UTF8
```

Place this line:
- After the header comment block (if present)
- Before any `Add-Type`, function definitions, or content reading
- Before any output statements (`Write-Output`, `Write-Host`, return values)

### Pilot validation requirement

Any ingest pipeline that processes non-ASCII content must include **adversarial test fixtures** in its pilot validation. These must include items containing:

- Curly Unicode quotes (`"` `"` `'` `'`)
- Em-dashes and en-dashes (`—` `–`)
- Accented characters (`é` `ñ` `ø`)
- Currency symbols (`£` `€` `¥`)
- Section symbols (`§`)
- Long content (>10,000 characters) to surface buffer-boundary issues

A pilot that completes with 0 errors but doesn't exercise these patterns has not validated the pipeline against the encoding bug class. The V.3-B pilot completed successfully but did not contain items with curly quotes in body text; this is why the encoding bug only surfaced at item 33,942 of the full ingest.

### Related concerns

- **StreamReader** without explicit encoding defaults to system ANSI code page. Always specify: `[System.IO.StreamReader]::new($stream, [System.Text.Encoding]::UTF8)`
- **Out-File** without `-Encoding utf8` writes UTF-16-LE on PowerShell 5.1 and UTF-8-with-BOM on PowerShell 7
- **Get-Content** without `-Encoding utf8` similarly uses system defaults

When in doubt, specify UTF-8 explicitly at every encoding boundary.

### Long-term remediation

The mandatory `[Console]::OutputEncoding` rule is a workaround for a Windows legacy default that bites every cross-language pipeline on Windows. The strategic remediation is to **eliminate PowerShell from ingest pipelines entirely** — write helpers in TypeScript using Node-native libraries (`adm-zip`, `fast-xml-parser`, etc.). This is being addressed in V.3-B-opt (rewrite UKSI pipeline in pure TypeScript). Future ingest sprints (V.3-D, V.3-G, V.4-A) should not introduce new PowerShell helpers.

***

## 15. POSTGRESQL THESAURUS DICTIONARY

A thesaurus synonym file is maintained at `scrutinise-web/prisma/pg_thesaurus/legislation_synonyms.ths`. It maps key policy synonym pairs (GDPR↔data protection, NHS↔national health service, etc.).

**This file must be applied to any new database instance** to enable synonym-aware search. The setup script is `scripts/legislation/apply-fts-config.sql`.

### Self-hosted PostgreSQL (full thesaurus setup)

1. Copy `legislation_synonyms.ths` to `$PGDATA/../share/tsearch_data/` on the server.
2. Run: `psql -d $DATABASE_URL -f scripts/legislation/apply-fts-config.sql`
3. The script creates: `legislation_thesaurus` (TEXT SEARCH DICTIONARY) and `legislation_english` (TEXT SEARCH CONFIGURATION extending 'english' with thesaurus).
4. FTS triggers on `LegislationSection` and `OperationalSection` use `legislation_english`.

### Managed PostgreSQL (Neon) — current deployment

The thesaurus template requires placing `.ths` files on the server filesystem, which is not possible on managed PG services (Neon, RDS, Supabase). On Neon:

- `legislation_english` is created as a plain copy of `english` via `scripts/legislation/neon-fts-setup.ts`.
- Synonym expansion is handled at the **application layer** in `scrutinise-web/lib/search.ts`.
- To extend synonyms: add pairs to `legislation_synonyms.ths` (documentation), and update the synonym map in `search.ts` when application-layer expansion is implemented (V.4-FTS-2 scope).

### FTS query: prefix matching

`scrutinise-web/lib/search.ts` uses `buildTsQuery()` to detect mid-word input (no trailing space) and appends `:*` to the final token, switching from `plainto_tsquery` to `to_tsquery`. This enables "data prot" → "data protection" matching without waiting for a space keystroke.

***

## 16. DATABASE MIGRATION SAFETY — WHICHDB CHECK (mandatory, added 30 Jul 2026)

**Incident:** on 29–30 Jul 2026, `.env` on this machine still pointed `DATABASE_URL` at Railway
(`switchback.proxy.rlwy.net`), a stale value left over from the **18 Jun 2026 Railway→Neon app-database
cutover** that was never propagated locally. Two migrations were run with `prisma migrate deploy`, both
reported success, both were silently applied to the wrong database. Production (Neon) fell behind with no
error until dependent code shipped and threw `P2021` in production, causing a full `/dashboard` outage.
Full writeup: `docs/CHANGE_LOG.md`, "INCIDENT — production `/dashboard` full outage" (2026-07-30 02:10
UTC) and the corrections on the two entries it references.

**The rule this incident produces, no exceptions:**

> Before running `prisma migrate deploy`, `prisma db execute`, or any other schema-altering or destructive
> SQL against any database — including when confident about which database is targeted — run
> `npx tsx scripts/whichdb.ts` first and paste its output (host, database name, last 5
> `_prisma_migrations` rows) before proceeding. If the host isn't the one you expect, stop.

**Current state of record, as of 30 Jul 2026:** local `.env`'s `DATABASE_URL` (pooled) and `DIRECT_URL`
(non-pooled) point at Neon (`ep-old-dust-aboxi69a`) — this is production. The old Railway connection
string is preserved in `.env` as `RAILWAY_DATABASE_URL_LEGACY` for reference only. **`RAILWAY_DATABASE_URL_LEGACY`
is dead and must never be used for schema work again** — Railway (`scrutinise-db`) is scheduled for
decommission (after a `pg_dump` to R2 and a `getRailwayPool` check), and any migration/DDL run against it
between now and then will not reach production and will not be noticed until something depends on it,
exactly as happened here.

This supersedes the "PostgreSQL (Railway EU West Amsterdam)" stack line in §2 and the plain `DATABASE_URL`
description in §9 for anything migration/schema-related — those sections describe the historical setup
and haven't been rewritten; this section is the current authority on which database is production until
they are.

***

## 17. HEAVY JOBS — MEMORY-BOUND WORK DOES NOT RUN ON RAILWAY (4 Aug 2026)

**The rule: if a job is single-process and memory-hungry — index builds, index merges, embedding runs,
corpus-wide rewrites — it runs through the Heavy Job Runner (`scripts/ops/heavy-job/`, documented in
`docs/HEAVY_JOBS.md`). Never on Railway, never locally, and never by shrinking the work until it fits.**

### Why — the evidence, so this isn't relitigated

The FTS index rebuild failed **three times in three different ways**, each a symptom of the same gap: there
was no standard home for memory-bound work.

1. **June:** `createIndex` OOM-looped until `withPosition:false` shrank it enough to fit the then-24 GB
   container.
2. **2 Aug:** `optimize()` OOM'd, then crash-looped **eight times** — deployed with `ON_FAILURE` on a job
   that restarts from zero. ~25 minutes of burnt container time.
3. **3 Aug:** the no-compaction `createIndex` path ran cleanly for 6.5 minutes, climbed smoothly to 6.1 GB,
   and was SIGKILLed against Railway's **measured 8 GB per-replica cap** (`LIMIT=8000000000`).

**The measured peak of that job is 19.8 GB.** No Railway setting could ever have run it. Railway's
"48 GB per service" headline is an **aggregate across replicas** — a single-process job only ever gets the
per-replica limit, and replicas give you more *copies*, not a bigger heap. When it finally ran on a rented
32 GB box it took minutes and cost **€0.049**.

### When to reach for it

Any of these is enough:

- A job dies with no error line (silent SIGKILL = OOM, not a bug in your code).
- You are about to write "let me reduce the batch size / skip a step so it fits".
- You are about to ask Charlie to raise a Railway memory limit.
- The work touches the whole corpus at once (index build/merge, embeddings, a full rewrite).

### How

Jobs are registered by name in `scripts/ops/heavy-job/jobs.ts` — **adding a heavy job is an entry there, not
a new script.** The runner provisions → runs → verifies → **destroys** → reports cost, in one command.

- **Teardown is the default**, in a `finally`. Only `--keep` overrides it, and only for debugging. *A manual
  teardown is how a box billed for four days in July.*
- **Size from evidence.** `jobs.ts` records each job's observed `expectedPeakGb` — fill it in from the run's
  own report. Leave it null until something is measured; never guess a size upward or downward.
- **Placement is read from the API, not assumed.** Three real failures are already handled: dedicated-core
  account quota, out-of-stock server types, and the `datacenter` field deprecated Dec 2025. If placement
  fails, read availability — don't cycle through guesses.
- **Every run prints a cost line** (size, minutes, charge) so spend is visible per run rather than discovered
  on a bill.
- **`plan` before `run`.** `run.ts plan <job>` validates and prices without creating anything.
- **Check whether the job is already done before running it.** `fts-optimize.ts --verify-only` is a metadata
  read that costs nothing; on 4 Aug it reported `unindexed=0`, which is how a duplicate rebuild was avoided.

### Traps that have already cost us time

- **`optimize()` is the pathological step, not `createIndex`.** It bundles compaction with the index merge and
  has an independent v0.30 memory cost. `FTS_SKIP_COMPACT=true` / `VECTOR_SKIP_COMPACT` exist for exactly
  this — the answer both times was to stop compacting, not to buy memory. *(This was already documented in
  `build-fts-index.ts` and got missed by reading the LanceDB docs first. **Read our own code before the
  internet.**)*
- **`restartPolicy: NEVER` for anything without a checkpoint.** `ON_FAILURE` on a job that restarts from zero
  produces a crash loop, not a retry.
- **Restart `fts-serve` after any index work.** It calls `openTable()` once at boot with no
  `readConsistencyInterval`, so it holds a fixed snapshot — without a restart it keeps serving the old index
  and any after-measurement is meaningless.
- **Match the live index configuration when rebuilding** (currently `withPosition: false`, the no-positions v1
  build). Rebuilding with different settings silently changes ranking. Confirm before running; never assume.
- **`/stats` counters are since-boot**, so a redeploy resets them. Keep the pre-change numbers as the baseline
  of record and compare like-for-like.

### The standing rule this pairs with

`INGEST_PLAYBOOK.md` §20: **after any backfill or large append, rebuild/merge the index before it serves
users.** A LanceDB append leaves the new rows searchable by brute-force scan — correct, but every subsequent
query pays for them forever. That is what made warm p50 26 seconds while everything still "worked".

***

## 18. A TRUNCATED LLM RESPONSE MUST NAME ITSELF AS TRUNCATED, EVERYWHERE (8 Aug 2026)

**The rule: check `finishReason` before you parse, and put the guard in the shared helper, not in
each caller.** `lib/lex/gemini-finish.ts` is that helper. `npm run check:llm-guards` enforces it.

### Why this is a numbered rule and not a bug fix

Four times, the same failure, each time wearing a different face:

| when | call site | how it presented | what it actually was |
|---|---|---|---|
| 29 Jul | `query-expansion` | every call "failed to parse" | thinking mode ate the whole budget |
| 6 Aug | `web-orientation` | Tier B half silently discarded | truncating on every call |
| 8 Aug | `general-chat` | `Unterminated string in JSON at position 2488` | 16 sources over a 2,048 ceiling |
| 8 Aug | `query-router` | fail-open, logged as `bad-json` | five stream queries over a 512 ceiling |

Not one of them said "I ran out of output tokens". Every diagnosis started at the wrong end —
looking for a fault in the JSON, when the fault was a number in the request. The router instance
cost most: it made routing intermittent in production, which then made a benchmark regression
impossible to attribute.

### What the rule requires

1. **Check `finishReason` BEFORE parsing.** A truncated payload is broken JSON, so parsing first
   converts a length limit into a parse error and hides it. `check:llm-guards` asserts the ordering.
2. **Name the reason distinctly.** `truncated` (hit `MAX_TOKENS`) is not `bad-json`, and not
   `blocked` (SAFETY, RECITATION). A caller that degrades gracefully must still log WHICH.
3. **Report the budget and the tail.** `cut off at maxOutputTokens=512 …ends: "…right to "` is
   diagnosable at a glance; "parse failed" is not.
4. **An absent `finishReason` is fine.** Some responses omit it; failing closed on a missing field
   turns a working call into an outage.
5. **Size the budget to the output.** Output tokens are billed on what is generated, so a generous
   ceiling on a call that emits a small JSON object costs nothing. A tight one buys nothing and
   eventually fires.

### The family this belongs to

The same shape as the **silent stub**, the **placeholder that looked like data**, and the
**invisible fail-open**: *a failure that looks like something else*. The house rule across all of
them is the same — **a degradation must announce itself, with its cause attached.** Graceful
degradation is correct; silent degradation is a bug with a good disguise.

⚠ **Corollary, learned from the router:** when a component can be OFF by configuration and can also
FAIL, the two must not look identical from outside. The router being disabled and the router failing
open both produced exactly one untiered search, which is why it took four rounds of measurement to
tell them apart.

***

## 19. A FLAG STATE YOU CANNOT READ IS NOT A FLAG STATE YOU MAY WRITE DOWN (10 Aug 2026)

**The rule: when a fact about production configuration cannot be read from this machine, say so and
ask for it. Where it has already been inferred, the inference must be labelled as one — in the same
sentence, not in a footnote.**

### The specific blocker, so it is recognised on sight

`VERCEL_TOKEN` in `scrutinise-web/.env` **authenticates** — `GET /v2/user` returns 200 — and then
**403s on every project-scoped endpoint with `"saml": true` in the body**. Env vars, deployments and
runtime logs are all unreadable from here, permanently, until Charlie completes a SAML SSO
authorisation for the token. **Railway is unaffected** — its token is a separate credential with a
separate failure mode (`Project-Access-Token`, not `Bearer`; see the Railway Operations section of
the root `CLAUDE.md`).

**A 200 on `/v2/user` followed by a 403 elsewhere reads exactly like an expired credential.** It is
not. Do not spend a session rotating tokens.

### What that means for anything written down

`docs/RAILWAY_ROLE.md` (9 Aug) recorded "`VECTOR_SEARCH_URL` is unset in Vercel". Nobody on this
machine could have known that. It was derived from the local `.env` plus a code read of
`vector-search.ts:111`, and it was **wrong** — Charlie read the dashboard on 10 Aug and both
`VECTOR_SEARCH_URL` and `LEX_VECTOR_STREAMS=legislation` were set. The consequence was not
cosmetic: it made a **live** cross-stream scoring defect look latent for a day.

1. **Ask.** `vercel env ls` run by Charlie, or a screenshot, settles it in seconds. One question
   beats a day of inference.
2. **Label the inference where it lives.** "`VECTOR_SEARCH_URL` is unset in Vercel" and
   "`VECTOR_SEARCH_URL` is unset locally, and I infer Vercel matches — unverified, SAML-blocked"
   are different claims. Only the second is honest from here.
3. **Record provenance on the corrected value.** Who read it, from where, on what date. Without
   that the next reader faces the same unresolvable contradiction and has no way to break the tie.
4. **Prefer a counter to a config read.** The one thing that *was* readable — `vector-serve`'s
   `served` counter moving +1 per routed query, and not scaling with stream count — pinned the
   config exactly. A behavioural measurement taken from a reachable surface beats an unreachable
   config file every time.

### The family this belongs to

§18's corollary says a component that is OFF and a component that has FAILED must not look
identical from outside. This is the same rule one level up: **a fact that was measured and a fact
that was inferred must not look identical on the page.** Both failures are a true-looking sentence
with its provenance stripped off.

***

## 20. DELIVERY — A SPRINT IS NOT DONE UNTIL THE RUNNING SITE SAYS SO (19 Aug 2026)

**The rule: every local check proves the CODE. Only a string read back off the running site proves
the DELIVERY. A sprint closes on the second, never the first.**

Three separate incidents, three different mechanisms, one shape — the code was correct, `tsc` was
clean, every check passed, and **the thing was not on the site**:

| When | What happened | Why nothing caught it |
|---|---|---|
| 6–9 Aug | Production served **three-day-old code** for a week. Every sprint in that window closed with "Charlie's browser re-test is the remaining gate" — **and none of those gates could have passed.** | Pushes were building as Previews, not Production. Every deployment was green. |
| 12 Aug | `build/` unanchored in `.gitignore` silently excluded a **whole new route directory** from the repository. | `git status` does not list ignored files. `git add` refusing it was the only signal. |
| 17–18 Aug | `lib/lex/build-cost.ts` was never committed. Production failed to build for ~10 hours; the live site fell back to a build predating the sprint. **Both Lex routes appeared broken to the user.** | `tsc` and `next build` were clean **locally**, because the file existed on the machine. |

⚠ **The third one is the instructive one: the local build passed on code the repository does not
contain.** A green local build says the files on this machine are consistent with each other. It says
nothing about what a clean checkout would do.

### Check 0 — build the way the platform builds. Run this BEFORE you push.

**Added 23 Aug 2026, after a two-day production outage that three sessions pushed into without
knowing.** `scrutinise-web/scripts/measure-s12-baseline.ts` imported across the package boundary
into `scripts/ingest/`, which imports `@lancedb/lancedb` — a package installed in the *ingest*
package's `node_modules`. Vercel installs only `scrutinise-web`'s. Every deployment since ~22 Aug
failed on a file none of those sessions had touched, while `tsc` and `next build` were green on
every machine, because a developer machine has both `node_modules` trees.

⚠ **`check:committed` cannot catch this — the file IS committed.** What is missing is the
dependency, in the place the build runs. And the 18 Aug outage was the mirror image: the dependency
was there and the *file* was not.

`scripts/check-clean-build.sh` reproduces the deployment's two constraints, which is the only thing
that catches both:

| | what it reproduces | catches |
|---|---|---|
| **A** (`--fast`, seconds) | no file outside `scrutinise-web` may enter the web TypeScript program | the boundary crossing |
| **B** (full, minutes) | a `git worktree` checkout of HEAD — committed state only — then `npm ci` in `scrutinise-web` alone, then `tsc` | an uncommitted file, a lockfile drift, a missing dependency |

**Run `--fast` before every push. Run it in full before a release, or after touching `tsconfig.json`,
`package.json`, or any import that crosses a package boundary.** Check A is a COUNT, not a list of
known-bad files, so the next harness that imports across the boundary fails it without anyone having
to remember to add it.

⚠ **Do not fix a boundary crossing by adding the missing package to the web app.** That ships a
heavy native module into a serverless bundle to satisfy a file the web app must never compile. Fix
the crossing import, or exclude the directory from the web tsconfig.

### The four checks that close a sprint

Run check 0 first, then all four below, in this order, and report each:

1. **Every file you created is committed.** Not `git status` — an ignored file never appears in it.
   Take the list of files the sprint created and run `git ls-files` against it, and
   `git check-ignore -v <path>` on anything missing. **Confirm the file, not the pattern**: a
   `build`-shaped rule swallows the directory `build/` *and* the file `build-cost.ts`, and reading
   the pattern is how the second one gets missed after the first is fixed.
2. **The remote has your commits.** `git merge-base --is-ancestor` against the server ref, not local
   `git status`. Three threads share this tree and one of them will have pushed since.
3. **The deployment is green AND is Production.** A green Preview is not a deploy. Read the
   environment column, not just the status.
4. **The running site serves your change.** Fetch a string that *this sprint* introduced and confirm
   it comes back — with a control that carries no such marker. **This is the only step that proves
   anything**, and the three incidents above would each have been caught here in under a minute.

### Two rules that follow

**Never report a sprint "done" on local evidence alone.** The honest sentences are *"pushed, and
verified live at <url> by reading back <string>"* or *"pushed; NOT verified live because <reason>"*.
Both are fine. *"Built, tsc clean, checks pass"* as a closing line is not, because it is the exact
report all three incidents produced.

**Never diagnose a user-visible fault before confirming what is deployed.** On 18 Aug two Lex routes
looked broken to Charlie and produced a plausible application-level hypothesis; the actual cause was
that production had been failing to build for ten hours and was serving code from before the sprint.
**Establish what is running, then debug it** — otherwise you are debugging code the user is not using.

### And a check worth building once

A CI or pre-push check that **fails when a source file imported by committed code is not itself
committed** would have caught incidents two and three outright. It is a short script against the
import graph, and it turns the whole class into something that cannot recur.

*(Companion rules: §12 on scoped commits, and the standing note that a push is not a deploy — this
section is that note, given the evidence and the procedure to go with it.)*

---

## 21. THE INDEXES PRISMA CANNOT SEE — A STANDING HAZARD REGISTER (24 Aug 2026)

`schema.prisma` cannot declare a **partial** index (`WHERE …`) or an **expression** index
(`(("occurredAt")::date)`). Several of Central's most important rules are exactly that, so they live
only in the hand-written SQL — and `prisma migrate diff` does not merely fail to generate them, it
**proposes dropping them**, because to Prisma they are drift.

Accept such a diff and nothing breaks visibly. The guard is simply gone, and the first evidence is
duplicate rows in production weeks later.

### The register

| Index | Table | What it guards | Where it lives |
|---|---|---|---|
| `CommunityJoinRequest_pending_unique` | `CommunityJoinRequest` | One PENDING request per (user, community). Partial on `status = 'PENDING'`, so a declined request can be made again. | `prisma/central_stage1_2.sql` |
| `ActivityClaim_one_per_day` | `ActivityClaim` | One claim per (user, activity type, calendar day). **Expression** (`("occurredAt")::date`) **and partial** (`status NOT IN ('DECLINED','REVERSED')`), so a declined or reversed claim frees the day again. | `prisma/central_stage2.sql`, predicate widened by `prisma/central_stage2e.sql` |
| `Question_live_idx` | `Question` | The live-row index for the library list. Partial on `deletedAt IS NULL`, so it stays small as deleted rows accumulate. | `prisma/central_content_delete.sql` |
| `Answer_live_idx` | `Answer` | The same, for answers under a question. | `prisma/central_content_delete.sql` |
| `BulletinPost_live_idx` | `BulletinPost` | The same, for a board's threads and replies. | `prisma/central_content_delete.sql` |
| `Idea_creatorId_live_idx` | `Idea` | The live-row index for a creator's dashboard list. Partial on `deletedAt IS NULL`. Predates Central and was missing from this register until 27 Aug. | `prisma/idea_soft_delete.sql` |
| `Community_live_children_idx` | `Community` | The live-children index behind `getSubtreeIds` and the Teams tree. Partial on `deletedAt IS NULL`, so a deleted branch drops out of every tree walk. Added with item 11 and, like the row above it, missed this register on the day — which is why the check below now enumerates every one of these rather than two of them. | `prisma/central_branch_delete.sql` |
| `Resource_live_idx` | `Resource` | The live-row index for the Resources card grid. Partial on `deletedAt IS NULL`. | `prisma/central_2g_resources.sql` |

Eight entries today. **Add a row here the moment a ninth exists** — the register is only useful if it
is complete, and a partial index nobody wrote down is the whole failure mode.

⚠ Two of the eight were added without a register row and only found on a later sweep of
`pg_indexes`. Rule 5 below is now enforced against the WHOLE list rather than the two entries it
originally named, so the next omission fails a check instead of waiting for a sweep.

### The rules

1. **Never run `prisma migrate diff` against this database and apply the result.** §16 already says
   so for the 914k-row `LegislationSection_DEPRECATED` table and `specialist_queue`; this is the
   second reason and it is quieter, because dropping an index produces no error at all.
2. **Every migration that adds a partial or expression index must say so in a `⚠` comment at the
   index**, naming this section. Both entries above do.
3. **The model's doc comment in `schema.prisma` must carry the same warning**, because that is where
   someone reading the code will be — not in a `.sql` file they have no reason to open.
4. **If the predicate changes, DROP and CREATE.** Do not add a second overlapping partial unique on
   the same columns: two of them will both be satisfied by rows that violate the rule you meant.
5. **`npm run check:central` asserts these indexes exist**, with their predicates. That is the
   backstop for all of the above — a dropped guard fails a check rather than waiting for the
   duplicate row that proves it is gone.

### Colour is never the only cue (2h item 6, 27 Aug 2026)

Charlie is colour blind. A state that differs from its opposite only by hue is a state he cannot
read — including whether his own click registered.

**The rule: every state carries a second, non-colour cue.** The vocabulary lives in
`lib/state-cues.ts` so surfaces cannot invent their own:

1. **Shape** — a filled glyph on, a hollow glyph off (▲/△, ▼/▽, ★/☆). Four different
   characters, not one character recoloured; survives greyscale and a photocopier.
2. **Weight** — `border-2` and bolder type on the active state. The same 2px the approval frame
   uses, and nothing in Central's resting state draws it.

A **filled background against a white one** already counts (it is a lightness difference, which
colour blindness preserves), as does **text in the badge**, a **sign** on a number, and a
**stroke-width** change. Colour stays — it is the fastest cue for people who can see it. It is just
never alone.

`check:central` asserts this per surface: every vote control draws its glyph from the vocabulary,
**and no state-carrying file contains a bare ▲ or ▼ at all**. The narrow first version of that guard
(a triangle in quotes, or between `>` and `<`) missed a planted bare glyph in JSX text — assert the
absence totally, and route even explanatory copy through the vocabulary so the hint cannot drift
from the control.

⚠ **Measure the palette, do not eyeball it.** The check computes WCAG contrast for every accent's
text on white and fails below 4.5:1. It immediately found that the platform's OWN teal text
(`--central-teal-text: #0f8b7f`) scored **4.18:1** and had never been measured; it is now `#0d7a6f`
at 5.21. A "pre-vetted palette" that has not been measured is the same unreadable-combination
problem free hex entry was rejected for, arrived at more slowly.

---

### Never run `prisma format` either

Unrelated to indexes, same file, same class of damage: `prisma format` (v7.5) realigns every trailing
comment in the schema and rewrites the line endings. A 123-line addition came back as a 1,359-line
diff on 24 Aug 2026, sweeping three other threads' work into one commit. Hand-edit the schema, then
`prisma validate` and `prisma generate`. Never `prisma format`.

---

## 22. SHELL COMMANDS: WRITE A SCRIPT, RUN THE SCRIPT (26 Aug 2026)

**Every long, compound, quote-nested shell command trips the auto-approval classifier and
stops the session for a permission prompt. That is an interruption for Charlie, every time,
for work he has already pre-authorised.**

The classifier is not judging whether the command is dangerous — it is judging whether it can
*read* it. Three shapes set it off, all of them avoidable, and all of them things a file would
have held better anyway:

| shape | example of the problem | what to do instead |
|---|---|---|
| brace-with-quote expansion | `for f in a b; do ... "$(...)" ... done` inline | put the loop in a `.ts`/`.sh` file |
| over-length commands | a 400-character one-liner doing real logic | `tsx scripts/_probe.ts` — one short command |
| `cd X && …` compounds with redirection | `cd web && node x.ts > out 2>&1` | absolute paths, or set the directory once |

### The rule

1. **Write the logic to a file, then run the file.** `tsx scripts/_probe.ts` is one short,
   scannable command. The identical logic as an inline one-liner is not — and the file is
   re-runnable, diffable, and can be fixed with `Edit` instead of retyped.
2. **No `cd X && …` compounds with redirection.** Use absolute paths, or set the working
   directory once and leave it. (This also avoids the cwd-drift trap: the Bash tool's cwd
   resets between calls, so a `cd` inside a compound is doing two unrelated jobs at once.)
3. **No heredocs, brace expansion or nested quoting in anything that could be a file.**
   Heredocs additionally mangle escapes, and backticks inside one are executed — see §12.
4. **Keep commands short. If it is too long to scan, it is long enough to be a script.**

⚠ **Prefer the dedicated tools first.** `Read`, `Grep`, `Glob`, `Edit` and `Write` never trip
the classifier at all. Reach for the shell only for things that genuinely run — `git`, `npm`,
`tsx`, `curl` — and even then, for anything with logic in it, write the file.

⚠ **Name scratch scripts with a leading underscore (`scripts/_probe.ts`) and delete them in
the same turn**, so a throwaway never gets committed or mistaken for a check.

*(Related: §12 on heredocs and backticks in commit messages; §14 on PowerShell stdout.)*

---

## 23. A CHECK MUST PROVE ITS SUBJECT IS REACHABLE — AND A SWEEP MUST REPORT CHECKS *RUN*, NOT ONLY CHECKS *PASSED* (28 Aug 2026)

Two rules from one sprint, and they are the same failure seen from two sides: **a check
that is disconnected from the product is indistinguishable, in every report we write, from
a check that is working.**

### 23.1 — Any assertion about what a USER sees must first prove the file is rendered

**The rule: before asserting on a source file, assert that something imports it, all the
way back to a route. A check whose subject has no importer must FAIL, not pass.**

LEX 25-J §1 was a whole-app sweep to make the product speak in one voice, and it reported
*"nav Create → My ideas"*. The rename went into `components/ui/Navbar.tsx`. That file has
**no importer anywhere** — `grep -rn "Navbar" app components lib` returns its own
`export default`, two check scripts asserting on it, and one comment. The nav every
signed-in page actually draws is `components/PublicNav.tsx`, and it still said "Create".

⚠ **`check:lex-25j` passed for a full sprint, with a negative control that fired**, because
the control corrupts the same dead file the assertion reads. **A negative control cannot
catch this.** Breaking the file and watching the check reject it proves the assertion reads
the file; it says nothing about whether anything else does. The whole apparatus was
self-consistent and disconnected from the product.

**What to do, and it is one line:**

```ts
// A component nothing imports cannot be what a user sees.
const importers = grepRepo(`from '@/components/${name}'|from '.*/${name}'`)
if (!importers.length) return `${name} has no importer — this assertion is over dead code`
```

⚠ **The same rule applies to a route, a config constant and a prompt block.** "It is written
down" and "it is reached" are different claims, and only the second is about the product.
This is the same family as CLAUDE.md §19 (a fact measured and a fact inferred must not look
identical on the page) and §20 (a local build proves the machine, not the deployment).

### 23.2 — Report checks RUN, not only checks PASSED

**The rule: a sprint report states how many checks EXECUTED. A check that did not run is
reported as not run, never omitted.**

`verify:lex-25e-ui` — the render harness for the elicitation cards, the one kind of check
that could have caught the defect that stopped the product for eight sprints — died on
`ReferenceError: React is not defined` before its first assertion, because it never
imported React while the two harnesses beside it do. **It appears in no sprint's reported
results.** Its silence read exactly like success: nobody had claimed it passed, and nobody
had noticed it was missing from the list either.

**So the closing line of a sprint names the suite, not a selection**: *"25-c 32, 25-d 77,
25-e 28 … verify:lex-25e-ui 16"* — and any check in the suite that is absent from that list
is a finding, not a formatting choice. If a check cannot run, say so with the reason; a
suite of twelve reporting eleven passes is eleven passes and one unknown.

*(Related: the "checks that cannot fail" register — this is the twenty-third and
twenty-fourth shape in it.)*

---

## 24. A REQUIRED FIELD IS A SHAPE CONTRACT, NEVER A CONTENT ONE — SCHEMA PERMITS ≠ PROMPT REQUIRES (28 Aug 2026)

**The rule: if the CONTENT of a model's field matters, every pass that writes it must be
told so in its PROMPT. `required` in a JSON schema guarantees the key is present and
nothing else — and the empty value is always valid.**

Third instance, and this one cost five sprints of misdiagnosis:

| when | field | what the schema said | what the prompt said | what came back |
|---|---|---|---|---|
| 29 Jul | `citedIds` | required | nothing about transcribing ids | mangled ids matching no source |
| 8 Aug | `citedMarkers` | optional | cite as you go | field omitted entirely — "0 cited" under a fully-cited answer |
| 28 Aug | `drivenBy` | **required in two passes** | explained in ONE of them | `""` on every cause; 0 of 4 nested, in every build ever measured |

⚠ **The 28 Aug case is the instructive one, because the code was correct throughout.**
`nestByDrivenBy` existed, `check:lex-25h` asserted it, and §25.7's quality 1 measured 0 of 4
nested across 25-H, 25-I and 25-K. Three reports concluded *"the model is not populating
`drivenBy`"*. It was not a model failure:

- the **diagnosis** pass carried eight lines explaining `drivenBy`, and built the chain;
- the **revision** pass declared `drivenBy` in its type and REQUIRED it in its schema, and
  its prompt had **never mentioned the field**;
- `build.ts` then **deletes** the diagnosis pass's causes and replaces them with the
  revision's — correctly, because two sets of causes on one idea is a duplicate.

So the chain was built and then destroyed by a pass that did not know it existed, and
nothing errored, because `""` is a valid string.

**What to do:**

1. **Check the prompt before the code.** When a field arrives empty, read every prompt that
   writes it before reading the function that consumes it. A schema field with no prose is
   a field the model has no reason to fill.
2. **One instruction, shared by every pass that writes the field.** Not copied — imported.
   Two copies of a rule is one copy that will be updated.
3. **A required field whose empty value is explicitly sanctioned needs a counter-instruction.**
   "A root cause gets an empty string" makes `""` always safe; the prompt has to add "a list
   in which every entry is empty is a list you have not asked the question of".
4. **Where a later pass REPLACES an earlier pass's output, say so in that pass's prompt.**
   It cannot inherit what it was not told to rebuild.
