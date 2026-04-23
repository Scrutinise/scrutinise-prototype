# SCRUTINISE — PROJECT README

*The master orientation document for Claude Code (CC).* *Read this first, every session, without exception. Then read CC_Sprint1_Briefing.md.* *Last updated: 22 March 2026*

***

## START EVERY SESSION WITH THESE TWO STEPS ONLY

```bash
# Step 1
bash start-session.sh

# Step 2 — read these two documents, in this order, before writing a single line of code
# 1. This file (README.md) — you are reading it now
# 2. The current sprint briefing: scrutinise-docs/CC_Sprint1_Briefing.md
```

That is all you need to get started. Everything else is referenced below and you will know when to reach for it.

***

## WHAT THIS PROJECT IS

Scrutinise is a not-for-profit civic technology platform that guides policy ideas through a five-stage development pipeline into Parliament-ready legislation. The AI guide is called **Lex**. Users are called **political entrepreneurs**.

The five stages: **Create → Draft → Develop → Campaign → Legislate**

Stage 5 is **Legislate**. Never "Parliament" as a stage name, anywhere in the codebase.

Tech stack: Next.js 14 (App Router) · TypeScript · Prisma · PostgreSQL (Railway EU West Amsterdam) · Cloudflare R2 · Clerk Auth · Vercel · Resend · Gemini 2.5 Flash / Grok 4.1 Fast

Branch: **Main** (capital M). Always confirm you are on Main before touching any code.

***

## THE DOCUMENT LIBRARY — WHAT TO READ AND WHEN

### Mandatory — read every session before writing code

| Document           | Location                                 | Purpose                                                                                       |
|--------------------|------------------------------------------|-----------------------------------------------------------------------------------------------|
| README.md          | `scrutinise-docs/README.md`              | This file. Orientation and document map.                                                      |
| CC Sprint Briefing | `scrutinise-docs/CC_Sprint1_Briefing.md` | Current sprint tasks, schema changes, prototype fixes, success criteria. Updated each sprint. |

### Reference — consult when building in that area

| Document                    | Location                                      | When to read                                                                                                                                                                                         |
|-----------------------------|-----------------------------------------------|------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------|
| CLAUDE.md                   | `scrutinise-docs/CLAUDE.md`                   | Architecture decisions, coding patterns, security rules, environment variables. Read when starting a new feature area or if something architectural is unclear.                                      |
| system_mechanics_v0.7.md    | `scrutinise-docs/system_mechanics_v0.7.md`    | Platform rules — stage gates, points, credibility, voting, amendments, notifications. Read before building any feature that involves scoring, progression, or state transitions.                     |
| entity_list_v4.md           | `scrutinise-docs/entity_list_v4.md`           | Every entity, every field. **CCh-only — CC reads but never edits.** Read before writing any Prisma schema or query.                                                                                  |
| process_list_v2.md          | `scrutinise-docs/process_list_v2.md`          | Step-by-step flows for every user-facing process. Read when building a specific feature to ensure every step is covered.                                                                             |
| lex_system_prompt_v4.md     | `scrutinise-docs/lex_system_prompt_v4.md`     | Lex's complete instruction set — opening messages, field population protocol, stage-specific behaviour, AI modes. Read before building anything that touches the Lex chat interface or AI API calls. |
| wireframes_v3.md            | `scrutinise-docs/wireframes_v3.md`            | Page layouts and UX specs for all 34 prototype pages. Read before building or modifying any UI page.                                                                                                 |
| UX_and_voice_build_notes.md | `scrutinise-docs/UX_and_voice_build_notes.md` | Voice dictation, progress bar, chat input spec, onboarding UX. **Queue for Lex UI sprint — do not action in Sprint 1.** Read when building the Lex chat interface.                                   |
| handoff_summary.md          | `scrutinise-docs/handoff_summary.md`          | Compact state summary — current build status, locked decisions, outstanding items. Read when returning after a gap or starting a new sprint.                                                         |

### CC writes to these at session end

| Document           | What to write                             |
|--------------------|-------------------------------------------|
| CHANGE_LOG.md      | One entry per file changed this session   |
| handoff_summary.md | Update build status and outstanding items |

### Archive — do not read, do not delete

| Location                   | Contents                                                                                                                                |
|----------------------------|-----------------------------------------------------------------------------------------------------------------------------------------|
| `scrutinise-docs/archive/` | Previous versions of spec documents. Kept for reference. Never read for current build decisions — always use the current version above. |

***

## CRITICAL TERMINOLOGY — NON-NEGOTIABLE

Apply these in every file you touch, every commit you make.

| Always use                                          | Never use                                            |
|-----------------------------------------------------|------------------------------------------------------|
| **Lex**                                             | Claude, the AI, AI assistant                         |
| **Credibility Score**                               | Reputation, InfluenceScore                           |
| **Legislate** (Stage 5 name)                        | Parliament (as a stage name)                         |
| **Contributions** (UI label)                        | Comments (in UI — DB field `comment` is fine)        |
| **Challenge / issue** (UI label)                    | Problem (in UI — DB field `diagnosis` is fine)       |
| **Collaborative** (Lex default AI mode)             | Socratic (as the default)                            |
| **Teambuilder**                                     | Dealweaver                                           |
| Create / Draft / Develop / Campaign / **Legislate** | Stage 1, Stage 2, Stage 3, Stage 4, Stage 5          |
| FOR / AGAINST / UNDECIDED + strength 0–5            | upvote / downvote / like / dislike                   |
| My Team / Communications / Policy Development Group | Collaborators / Supporters / Public (as group types) |

***

## CRITICAL RULES — NON-NEGOTIABLE

1.  **Auth on every API route.** `auth()` from Clerk. 401 if no session. 403 if no permission. No exceptions.
2.  **Zod on every input.** Every request body, every query param. No raw user data.
3.  **Always Prisma.** Never raw SQL with user input.
4.  **Never edit entity_list_v4.md.** CCh-only. Read it, never change it.
5.  **Voting is hidden at Stages 1, 2, 3.** Hidden — not disabled. Vote widget appears only from Stage 4.
6.  **Stage 1→2 is automatic.** Fires server-side when title + summaryDescription are both non-empty. No button click.
7.  **Lex default mode is Collaborative.** Not Socratic. Check every Lex API call injects the correct default.
8.  **Strip fieldUpdates before returning Lex response to client.** Always.
9.  **Check EmailSuppression before every email send.** Without exception.
10. **One commit per unit of work.** Never batch unrelated changes. Descriptive messages.

***

## SUPER_ADMIN ACCOUNT

Email: cl@scrutinise.org Role: SUPER_ADMIN Seeded on first migration via prisma/seed.ts. clerkId: to be updated by Charlie after Clerk account confirmed.

***

## ENVIRONMENT VARIABLES

All confirmed in Vercel. See CLAUDE.md Section 9 for full list.

***

## REPOSITORY STRUCTURE

```
scrutinise/
├── README.md                          ← you are here (in scrutinise-docs/)
├── scrutinise-docs/
│   ├── CC_Sprint1_Briefing.md         ← CURRENT SPRINT — read every session
│   ├── CLAUDE.md                      ← architecture, patterns, security
│   ├── entity_list_v4.md              ← CCh-only, read-only for CC
│   ├── process_list_v2.md             ← feature-by-feature flows
│   ├── system_mechanics_v0.7.md       ← platform rules and algorithms
│   ├── lex_system_prompt_v4.md        ← Lex behaviour spec
│   ├── wireframes_v3.md               ← UI layouts
│   ├── UX_and_voice_build_notes.md    ← queue for Lex UI sprint
│   ├── handoff_summary.md             ← build state summary
│   ├── CHANGE_LOG.md                  ← CC writes to this at session end
│   └── archive/                       ← old versions, do not read
├── scrutinise-web/
│   ├── app/
│   ├── components/
│   ├── lib/
│   ├── prisma/
│   └── ...
└── start-session.sh
```

***

## HOW TO END A SESSION

1.  Run `git status` — confirm nothing uncommitted.
2.  Write one entry per changed file to CHANGE_LOG.md.
3.  Update handoff_summary.md with current build state.
4.  Push to Main.

```bash
git add <specific files>
git commit -m "descriptive message"
git push origin Main
```

***

## WHEN TO STOP AND ASK CHARLIE

-   The spec is ambiguous and you cannot infer the correct answer safely.
-   A change would affect multiple entities or processes beyond the current task scope.
-   You encounter a security concern not covered by the rules above.
-   The sprint briefing and spec documents contradict each other.

**Do not build around ambiguity. Ask first.**

***

*README.md — Scrutinise — 22 March 2026* *This file is the first thing CC reads every session. Keep it current. If a decision changes, update this file and the relevant spec document together in one commit.*
