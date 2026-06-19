# Handover summary — V.3-B close to V.3-B-opt + V.4-FTS-1

**Date:** 18 May 2026
**Previous conversation:** ~95+ replies covering the V.3-B Phase 3 ingest, the 24-hour encoding bug debug, sprint close, and forward roadmap planning
**Status:** V.3-B closing (step 10 complete pending CC commit), V.3-B-opt brief ready, V.4-FTS-1 brief ready

---

## Where we left off

**Immediate state:**
- V.3-B Phase 3 ingest complete: 60,170 items, 473,828 sections in Railway and R2
- 1 real error in 60k items (transient Railway disconnect on uksi/2016/245, resolved at Phase 4)
- 16 ISBN-overflow items correctly skipped (TNA pre-publication drafts, canonical versions already in Railway)
- 17 stale error records cleared in progress file
- CC has completed steps 1-9 of close-out brief
- CC is paused at step 10 awaiting CCh's two CLAUDE.md sections (provided as `claude_md_additions.md`)
- Charlie's machine: Windows, PS 5.1 + PS 7.5.5, project at `C:/Code/scrutinise-prototype`, progress file `D:\uksi-phase3-progress.json`

**Pending immediate actions for next conversation:**
1. CC executes commit-all.sh Commit 4 (CLAUDE.md additions) — should be done by start of next conversation if not already
2. Charlie reviews V.3-B-opt brief and V.4-FTS-1 brief
3. Decide whether to start both in parallel or sequentially

---

## What was learned in this sprint

### Technical findings

1. **Windows PowerShell stdout encoding bug** — defaults to system code page (Windows-1252 on EN-UK), best-fit-maps Unicode to ASCII silently. Fix: `[Console]::OutputEncoding = [System.Text.Encoding]::UTF8` as first executable line of any PowerShell script emitting non-ASCII content. See claude_md_additions.md §Y.

2. **Parse failure diagnostic protocol** — always inspect actual bytes before forming hypotheses. CC's hypothesis-first approach cost ~5 hours; bytes-first would have been ~30 min. See claude_md_additions.md §X.

3. **CC test environment ≠ Charlie's production environment** for spawned-process behaviour. CC's tool sandbox uses UTF-8 default; Charlie's PowerShell uses Windows-1252. Verification of any spawn-related code must run in Charlie's actual terminal.

4. **Adversarial pilot fixtures required** — pilot completed with 0 errors but didn't contain curly quotes in body text. Future pilots must explicitly include items with `"` `'` `—` `é` `£` `§` characters.

5. **TNA ISBN drafts** — TNA's bulk ZIP contains pre-publication draft versions of SIs identified by ISBN (13-digit number in the actId slot). These have `Number: 0000` in their XML. The 16 we hit were all "Superseded by" the proper numbered versions which ingested fine. Filter rule: `parseInt(numberSegment) > 2_147_483_647` → SKIPPED_ISBN_DRAFT. Note for V.3-G script.

### Performance findings

- Current pipeline: ~700-750 items/hour (PowerShell-spawn-per-item, no batching, no parallelism)
- 24 hours for 60,167 UKSI items
- V.3-G at 37,000 devolved SIs would take ~50 hours at current rate
- Three sources of overhead (spawn, DB writes, R2 writes) all addressable

### Process findings

- Sprint-buckets-of-CCh-briefs pattern continues to work well
- Long-running ingests must run in Charlie's PowerShell terminal directly, NOT via CC tool calls
- CC writing commit-all.sh discipline (one script, run once, deleted) continues to work well
- CCh role: design + diagnose + brief CC, not implementation

---

## Forward roadmap (agreed in this sprint)

### Immediate (next 1-2 sprints, in parallel)

**Stream A: V.3-B-opt** (CC session 1)
- Rewrite UKSI ingest pipeline in pure TypeScript
- Eliminates encoding bug class
- Target 15-25× speedup
- See `brief_v3b_opt.md`
- Estimated 2 sprints

**Stream B: V.4-FTS-1** (CC session 2, parallel)
- Postgres native full-text search with tsvector + GIN
- Adds `searchLegislation` tool for Lex
- See `brief_v4_fts_1.md`
- Estimated 1 sprint
- Touches `scrutinise-web/`, different files from V.3-B-opt — safe to run in parallel

### Near-term (sprints 3-5)

| Sprint | Focus | Stream A (Backend) | Stream B (Search) |
|---|---|---|---|
| 3 | V.3-D + FTS Phase 2 | Devolved primary (~1,363 items, using new pipeline) | pgvector + Gemini embeddings |
| 4 | V.3-G + FTS Phase 3 | Devolved secondary (~37,000 items) | Hybrid FTS+vector with RRF |
| 5 | V.4-A + Lex analytical | HMRC manuals full ingest (~80) | Cross-corpus analytical mode |

### Mid-term (sprints 6+)

- V.3-F UKPGA NEW_TO_RAILWAY backfill (1,657 items)
- V.3-E Effects feed catch-up (6 months stale)
- V.3-H UKSI metadata-only (47,619 items, needs TNA catalogue scrape)
- V.4-B Civil service codes, Ministerial Code, Cabinet Manual, Treasury Green/Magenta Books, etc.
- V.4-C Hansard (modern XML), Erskine May, committee material

### Charlie's stated priorities

1. **Hansard / Erskine May / committee material** prioritised over case law — enables Lex's "last time this was discussed..." capability
2. **HMRC tax code first**, then HMRC manuals, then civil service codes
3. **Foundation work in parallel with feature work** — V.3-B-opt while FTS goes live
4. **Search quality is non-negotiable** — go hybrid (FTS + vectors) early
5. Case law (BAILII) is later — possibly V.3-V or V.4-D

---

## Outstanding decisions / open items

### Charlie to decide

- **Start V.3-B-opt and V.4-FTS-1 in parallel, or sequentially?**
  - Parallel: faster to value, but two CC sessions + two backlogs to manage
  - Sequential: lower cognitive load, V.4-FTS-1 (1 sprint) first then V.3-B-opt (2 sprints) — search live in 1 sprint
  - Recommendation: sequential — FTS first, fast win, then V.3-B-opt while FTS users explore

- **Bucket B remains blocked** awaiting field table from Charlie
- **Buckets C, D** on hold per memory — to be addressed on return from holiday

### Technical questions to confirm with CC during V.3-B-opt

- adm-zip vs alternative ZIP libraries — adm-zip recommended
- fast-xml-parser vs xml2js — fast-xml-parser recommended for performance
- vitest vs jest — vitest recommended (TypeScript-native, faster)
- WORKER_COUNT default — 4 recommended (Railway Hobby tier safe)

### Embedded learnings for CC sessions

CC should read `docs/CLAUDE.md` at session start (per Section 0). The two new sections added at V.3-B close are:
1. Parse failure diagnostic protocol
2. Windows PowerShell stdout encoding rule

These are now standing engineering rules.

---

## Files in this handover

1. `claude_md_additions.md` — CLAUDE.md text for V.3-B Commit 4 (already given to CC, expected committed by start of next conversation)
2. `brief_v3b_opt.md` — Full formal brief for V.3-B-opt sprint
3. `brief_v4_fts_1.md` — Full formal brief for V.4-FTS-1 sprint
4. `search_training_lesson.md` — Apprentice-mode education on FTS, vector search, and search-related technical terms

---

## Key reference paths

| Resource | Path |
|---|---|
| Project root | `C:/Code/scrutinise-prototype` |
| Web app | `scrutinise-web/` |
| Scripts | `scripts/legislation/` and `scripts/operational/` |
| Docs | `docs/` |
| Schema | `scrutinise-web/prisma/schema.prisma` |
| Progress (live) | `D:\uksi-phase3-progress.json` (V.3-B ingest) |
| Skills | `.claude/skills/` |
| R2 bucket | `scrutinise-legislation` |
| Railway project | `scrutinise-db` (Hobby tier) |

---

## Anything else next-conversation Claude needs

- **CC has memory** — uses CLAUDE.md plus saved memory files. Don't repeat learnings already captured there.
- **CCh has memory** — userMemories block summarises Scrutinise context, but the V.3-B saga isn't yet there. This handover plus the next conversation's memory generation should cover it.
- **Charlie is an experienced business owner, not a developer.** Treats CCh as senior engineer, himself as apprentice. Appreciates explanations of why decisions are made. Appreciates being asked rather than guessed at. See userPreferences for the exact format expectations (numbered replies, timestamp, dash separator at top of each Reply).
- **Charlie is in Lisburn, Northern Ireland (BST or GMT depending on season).**
- **Charlie tends to ask interesting deep questions** mid-conversation. Welcome those.
- **Charlie may be approaching holiday** per memory — confirm before assuming uninterrupted sprint cadence.

---

## Apprentice-mode education delivered in this sprint

- UTF-8 byte structure and why curly quotes are 3 bytes
- The encoding boundary problem (UTF-8 vs Windows-1252 transcoding)
- "Top 10 characteristics of world-class code"
- Tests: unit vs integration
- Technical debt, refactoring, Boy Scout rule
- Parallelism trade-offs
- Pipeline architecture (PowerShell-spawn vs pure-TypeScript)
- Search architecture overview (FTS vs vectors vs hybrid)

Continuing apprentice education in next conversation: more on search (full lesson attached), Postgres internals if Charlie asks, deployment patterns when V.3-B-opt nears production.
