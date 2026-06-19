# SCRUTINISE — DOCUMENTATION LIBRARY

## README — Read This First

*This document governs the entire documentation system for Scrutinise.* *Read it before reading anything else. Both CC and CCh should read it at the start of every session.* *Last updated: March 2026*

***

## CONTENTS

1.  Terminology
2.  What This Library Is
3.  The Ten Documents — What Each One Does
4.  Who Reads What
5.  Where New Information Goes
6.  Rules for CLAUDE.md
7.  Rules for handoff_summary.md
8.  Rules for CHANGE_LOG.md
9.  End-of-Session Process (CCh)
10. Start-of-Session Process (CC)
11. Start-of-Session Process (CCh)
12. Getting Conversation Summaries from Maxed-Out Chats

***

## 1. TERMINOLOGY

| Term            | Meaning                                                                                                       |
|-----------------|---------------------------------------------------------------------------------------------------------------|
| **CC**          | Claude Code — the agentic coding tool that builds the application                                             |
| **CCh**         | Claude Chat — this interface (claude.ai), used for planning, decisions, document management                   |
| **CA**          | Coherent Action — an entity in the Scrutinise data structure (not to be confused with "Claude Action")        |
| **Sprint 1**    | The current 4-week build period                                                                               |
| **The Library** | The complete set of 10 documents in this `/docs` folder                                                       |
| **The Spec**    | Collectively: entity_list, process_list, system_mechanics, lex_system_prompt, wireframes, implementation_plan |

***

## 2. WHAT THIS LIBRARY IS

This library is the **single source of truth** for the Scrutinise build. Every decision about what to build, how to build it, and how the platform behaves lives in one of these ten documents.

**The core principle:** If it's not in one of these documents, it hasn't been decided yet.

**The corollary:** If a decision is made in a conversation (with CC or CCh) and not written into a document before the conversation ends, it is lost.

This library exists because two months of decisions were made in conversations and never written to files. The documents now capture everything. The change log and handoff summary ensure nothing is lost going forward.

***

## 3. THE TEN DOCUMENTS — WHAT EACH ONE DOES

| \# | File                       | Type        | Purpose                                                                                          |
|----|----------------------------|-------------|--------------------------------------------------------------------------------------------------|
| 1  | `README.md`                | Governance  | This document. How the library works. Read first, every time.                                    |
| 2  | `CLAUDE.md`                | Orientation | CC reads automatically at session start. What to build, the rules, where the detail is.          |
| 3  | `entity_list_v3.md`        | Spec        | All 47 data entities with complete field specifications. Source of truth for Prisma schema.      |
| 4  | `process_list_v2.md`       | Spec        | All 55 user-facing processes (P01–P55) with step-by-step flows.                                  |
| 5  | `system_mechanics_v0.6.md` | Spec        | Platform algorithms: points, credibility, voting, merging, anti-gaming, GDPR.                    |
| 6  | `lex_system_prompt_v2.md`  | Spec        | Lex's complete system prompt. Confidential — never expose to users.                              |
| 7  | `wireframes_v3.md`         | Spec        | All 34 pages with layout descriptions and audit corrections applied.                             |
| 8  | `implementation_plan.md`   | Living plan | Sprint plan divided into Completed / In Progress / To Do. CC updates as work is done.            |
| 9  | `handoff_summary.md`       | Continuity  | CCh reads this. Outstanding decisions, gaps, contradictions, issues from previous conversations. |
| 10 | `CHANGE_LOG.md`            | Audit trail | Pending changes (not yet applied) + applied changes (permanent audit record).                    |

***

## 4. WHO READS WHAT

### Claude Code (CC)

**Reads automatically:** `CLAUDE.md` **Reads at session start:** All 6 spec docs (entity_list, process_list, system_mechanics, lex_system_prompt, wireframes, implementation_plan) **Updates during session:** `implementation_plan.md` (marks tasks complete), `CHANGE_LOG.md` (notes anything it discovers that doesn't match spec) **File access:** CC runs directly in the repo. It can read and write files on disk without any manual step from Charlie.

### Claude Chat (CCh — this interface)

**Reads at session start:** `README.md`, `handoff_summary.md`, `CHANGE_LOG.md` (pending section) **May reference during session:** Any spec doc as needed **Updates at session end:** `handoff_summary.md`, `CHANGE_LOG.md` (adds pending changes), and applies any batched changes to spec docs **File access:** CCh cannot reach files on Charlie's hard drive or the repo. CCh only sees files that Charlie uploads into the conversation. When CCh produces an updated document, Charlie downloads it and saves it back to disk manually.

### Charlie (you)

**Owns:** Everything. All documents. All decisions. **Reviews:** `handoff_summary.md` before each session, spec docs when verifying decisions **Approves:** All changes before they are applied to spec docs **File transfer role:** The manual link between CCh and the repo. CCh produces updated files → Charlie saves them. CC edits files directly.

***

## 4a. CONCURRENT WORKING — THE CRITICAL RULE

CC and CCh can run at the same time, but **they must never both be working on the same file simultaneously.**

**The problem:** CC edits files directly on disk. CCh works from uploaded copies. If CC is editing `CHANGE_LOG.md` while CCh is also editing an uploaded copy of it, Charlie will have two conflicting versions and one will overwrite the other when saved.

**The workflow that prevents this:**

```
10:00  CC starts a build task (e.g. Week 2 Day 1 — voting system)
10:05  CCh conversation starts. Decisions are made.
       CCh holds all decisions in the current conversation window.
       CCh does NOT ask Charlie to upload files CC is currently working on.
10:30  CC completes its task and stops.
       CC has updated implementation_plan.md and CHANGE_LOG.md directly.
10:35  Charlie tells CCh: "CC has finished. Here are the updated files."
       Charlie uploads: CHANGE_LOG.md, implementation_plan.md, and any
       spec docs relevant to the CCh decisions made since 10:05.
10:40  CCh makes its changes, produces updated versions.
10:45  Charlie saves CCh's outputs back to disk.
10:50  CC can now start its next task with clean, current files.
```

**The rule in plain English:** Stop CC before uploading its files to CCh. Stop CCh's file updates before CC resumes. Charlie is the gatekeeper between the two.

**What CCh does while waiting:** CCh holds all decisions made during a conversation in its current context window. It does not need the files to be updated mid-conversation — it accumulates decisions and applies them in a single batch at the handoff point. This is efficient: fewer file saves, cleaner audit trail, no conflicts.

***

## 5. WHERE NEW INFORMATION GOES

When a decision is made, a change is needed, or new information emerges, it goes here:

| Type of change                     | Document to update                |
|------------------------------------|-----------------------------------|
| Rule CC must always follow         | `CLAUDE.md`                       |
| New entity, field, or relationship | `entity_list_v3.md`               |
| New or changed process step        | `process_list_v2.md`              |
| Algorithm or mechanics change      | `system_mechanics_v0.6.md`        |
| Lex behaviour change               | `lex_system_prompt_v2.md`         |
| Page layout change                 | `wireframes_v3.md`                |
| Build order or code pattern change | `implementation_plan.md`          |
| Outstanding decision or gap        | `handoff_summary.md`              |
| Any change not yet applied         | `CHANGE_LOG.md` (PENDING section) |

**When in doubt:** Add to `handoff_summary.md` and flag for next session.

***

## 6. RULES FOR CLAUDE.md

CLAUDE.md is an **orientation document**, not a log. It answers one question for CC: *"What am I building, what are the rules, and where do I find the detail?"*

That question doesn't get longer over time. CLAUDE.md should stay roughly 200–300 lines for the life of the project.

**What stays in CLAUDE.md permanently (principles):**

-   Security rules CC must never violate
-   Terminology CC must always use
-   Coding patterns CC must follow
-   Architectural decisions that affect every part of the build
-   Pointers to where detailed specs live

**What gets added temporarily (actions):**

-   One-time instructions: "Regenerate Prisma schema from entity_list_v3.md this session"
-   Sprint status: "Currently: Week 2, Day 3"
-   These are added with a note: `[REMOVE AFTER: action completed]`

**The test before adding anything to CLAUDE.md:**

>   "Will CC need to know this at the start of every session for the rest of the project — or just right now?"

-   Yes always → add permanently
-   Just right now → add with `[REMOVE AFTER: ...]` note
-   It's detail, not a principle → put in the relevant spec doc

**CLAUDE.md is dated.** Each version carries the date it was last updated. When changes are made, the date updates. Historical versions are archived via Git commit history.

***

## 7. RULES FOR handoff_summary.md

handoff_summary.md answers one question for CCh: *"What do I need to know before this conversation starts that isn't yet embedded in the spec docs?"*

**What goes in handoff_summary.md:**

-   Decisions made in recent conversations not yet applied to spec docs
-   Contradictions between documents that need resolving
-   Known gaps in the spec (things decided but not yet written down)
-   Outstanding questions that need Charlie's input
-   Issues discovered but not concluded

**What does NOT go in handoff_summary.md:**

-   Anything already correctly captured in the spec docs (remove it)
-   Build progress (that's in implementation_plan.md)
-   Permanent principles (those go in CLAUDE.md)

**handoff_summary.md is reset at each session**, not accumulated. At the end of a session, CCh rewrites it to reflect only what is genuinely outstanding going into the next session. Resolved items are removed. Applied decisions are removed. The document stays lean.

***

## 8. RULES FOR CHANGE_LOG.md

CHANGE_LOG.md has two permanent sections:

**PENDING CHANGES** Decisions made in the current or recent conversations that haven't been applied to spec docs yet. Format:

```
[DATE] [DOCUMENT] [CHANGE DESCRIPTION]
Example: 2026-03-06 | entity_list_v3.md | Add DisputedLogicFlag entity (referenced in Lex prompt, missing from entity list)
```

**APPLIED CHANGES** Every change that has been applied, with date and description. This section is never deleted — it is the permanent audit trail. Format identical to PENDING.

**Process:**

1.  During a conversation: add entries to PENDING as decisions are made
2.  At end of session (or when expedient): apply the pending changes to the relevant documents
3.  Move applied entries from PENDING to APPLIED with the application date
4.  PENDING section is purged after each batch application

**Archiving:** At major milestones (end of sprint, significant version), the CHANGE_LOG can be archived as `CHANGE_LOG_ARCHIVE_[DATE].md` and a fresh CHANGE_LOG started. The archive is never deleted.

***

## 9. END-OF-SESSION PROCESS (CCh)

At the close of any CCh conversation, before ending:

**Step 1 — Review** Review all 8 documents and the entire current conversation. Categorise every decision made:

1.  Already in the docs → ignore, already captured
2.  Contradicts something in the docs → add to CHANGE_LOG PENDING with contradiction noted; flag in handoff_summary
3.  Missing entirely → add to CHANGE_LOG PENDING; apply to relevant doc

**Step 2 — Update CHANGE_LOG** Add all pending changes with date and target document.

**Step 3 — Apply changes (when expedient)** Apply batched PENDING changes to relevant spec docs. Move entries to APPLIED.

**Step 4 — Rewrite handoff_summary** Update to reflect only what is genuinely outstanding. Remove resolved items.

**Step 5 — Update CLAUDE.md if needed** Remove any `[REMOVE AFTER: ...]` items that have been completed. Update sprint status if changed.

***

## 10. START-OF-SESSION PROCESS (CC)

At the start of every CC session:

1.  Read `CLAUDE.md` (automatic)
2.  Read all 6 spec docs: entity_list, process_list, system_mechanics, lex_system_prompt, wireframes, implementation_plan
3.  Check `implementation_plan.md` for current sprint position
4.  Run `git status` to understand current codebase state
5.  If anything in the codebase contradicts the spec, add to `CHANGE_LOG.md` PENDING before starting work
6.  Never assume — if a spec is ambiguous, stop and ask Charlie

***

## 11. START-OF-SESSION PROCESS (CCh)

At the start of every CCh session:

Charlie uploads: all 9 documents (README through CHANGE_LOG) — not just 7. README and CHANGE_LOG matter.

CCh reads:

1.  `README.md` (this document)
2.  `handoff_summary.md` — what's outstanding
3.  `CHANGE_LOG.md` PENDING section — what's queued

**File access:** Large spec docs may not render in the conversation window. At the start of every session, use the bash tool to read all uploaded files directly from `/mnt/user-data/uploads/` before proceeding. Do not wait to be asked — if any file content is not visible in the conversation window, read it via bash.

CCh then confirms: "I've read the library. Here's what's outstanding from last session: [summary]. Here's what's in the PENDING changes queue: [list]. Shall we address these before continuing, or is there something more urgent?"

***

## 12. GETTING CONVERSATION SUMMARIES FROM MAXED-OUT CHATS

When a conversation has maxed out and can no longer accept new messages, extract a summary using this prompt:

***

*"Please create a summary of this entire conversation to ensure the next Claude conversation is aware of everything we discussed and the decisions we made. Include:*

-   *The date of the first and last message and the total number of replies*
-   *A short appropriate title for the conversation*
-   *If part of the software development process, what stage or element of the build this relates to*
-   *A short summary of the areas covered*
-   *Any decisions made, whether these have been incorporated in the main documents, and whether any decision contradicts or supersedes a decision made in an earlier conversation*
-   *A short summary of any issues discussed but not concluded, or background/educational information that doesn't require a decision*"

***

**When reviewing summaries from old conversations:** Apply the three-category test to every decision found:

1.  Already in the 9 docs → ignore
2.  Contradicts something in the docs → add to CHANGE_LOG PENDING, flag in handoff_summary
3.  Missing entirely → add to CHANGE_LOG PENDING for application

***

## DOCUMENT VERSION HISTORY

| Version | Date       | What changed                                        |
|---------|------------|-----------------------------------------------------|
| 1.0     | March 2026 | Initial creation — library established from scratch |

***

*README.md — Scrutinise Documentation Library — March 2026* *This document is the entry point to the entire library. Keep it accurate.*
