# SCRUTINISE — CHANGE LOG
*Pending and applied changes to all spec documents.*
*PENDING section: cleared after each batch application.*
*APPLIED section: permanent audit trail, never deleted.*
*Last updated: March 2026*

---

## PENDING CHANGES
*(Changes decided but not yet applied to spec docs)*

| Date | Document | Change Required | Source |
|------|----------|----------------|--------|
| 2026-03-06 | entity_list_v3.md | Add DisputedLogicFlag entity — referenced in lex_system_prompt_v2.md Section 5 but missing from entity list. Fields needed: id, ideaId, userId, lexFlag (text), userDispute (text), status (PENDING/REVIEWED), adminVerdict (nullable), createdAt | lex_system_prompt_v2.md cross-reference |
| 2026-03-06 | entity_list_v3.md | Confirm UserAIKey entity is correctly marked deferred (bring-your-own-key, v1.1). Currently in entity list — verify deferred status matches implementation_plan | handoff_summary |
| 2026-03-06 | CLAUDE.md | Add temporary instruction: "Audit existing CC build against spec before continuing Sprint 1. Produce gap report: what matches spec / what needs correcting / what doesn't exist yet. Fix all 'needs correcting' items before new build." [REMOVE AFTER: audit complete] | March 2026 session |
| 2026-03-06 | wireframes_v3.md | Add ASCII layout sketches for key pages where spatial layout is load-bearing: WF-11 (Lex two-panel interface), WF-13 (idea detail tabs), WF-33 (admin dashboard) | March 2026 session |
| 2026-03-06 | entity_list_v3.md | Clarify ProposedWording location — confirm it is per CoherentAction (not a single field on Idea). If so, update CoherentAction entity to make proposedWording the primary field and demote Idea.proposedWording to a computed/display field | handoff_summary |
| 2026-03-06 | system_mechanics_v0.6.md | Clarify 70/30 AI credit split mechanic — confirmed as 70/30 but exact mechanic (how user pays their 30%) is TBC. Add placeholder with TBC note. | handoff_summary |
| 2026-03-06 | README.md | This document — created this session, first entry | March 2026 session |
| 2026-03-06 | CHANGE_LOG.md | This document — created this session, first entry | March 2026 session |

---

## APPLIED CHANGES
*(Permanent audit trail of all changes applied to spec docs)*

| Date Applied | Document | Change Made | Originally Decided |
|-------------|----------|-------------|-------------------|
| 2026-03-06 | All docs | Initial creation of complete 9-document library from scattered architecture docs, wireframe audits, process lists, system mechanics, AI integration spec, Lex system prompt v2, and implementation plan. Consolidated two months of decisions. | March 2026 reconciliation session |
| 2026-03-06 | README.md | Added Section 4a: Concurrent Working — the critical rule. CC edits files directly on disk; CCh works from uploaded copies. They must never work on the same file simultaneously. Charlie is the gatekeeper. CCh holds decisions in context and batch-applies at handoff. | Reply 26–27, March 2026 session |
| 2026-03-06 | README.md | Clarified file access for each actor in Section 4: CC reads/writes disk directly; CCh only sees uploaded files and produces outputs for Charlie to save manually. | Reply 25–26, March 2026 session |
| 2026-03-06 | scrutinise-web/components/RevolutHero.tsx | Stage names corrected in homepage hero: Stage 1–5 → Create / Draft / Develop / Campaign / Parliament | CC build audit |
| 2026-03-06 | scrutinise-web/lib/mockData.ts | Comment rating structure changed from numeric {quality, evidence, civility} to multi-flag arrays: positiveFlags: string[], negativeFlags: string[]. Valid flags defined per spec. | CC build audit |
| 2026-03-06 | scrutinise-web/app/about/page.tsx | "burnish the reputation of parties" → "enhance the standing of parties" to avoid conflict with platform Credibility Score terminology | CC build audit |
| 2026-03-06 | scrutinise-docs/scrutinise_prototype_brief.md | Created — comprehensive prototype build guide covering codebase state, file structure, mock data, scripted Lex conversation (19 exchanges), component specs, five user journeys, terminology, styling guidelines, deployment notes, and build order | CC session |
| 2026-03-07 | scrutinise-web/app/prototype/profile/[username]/page.tsx | Created — user profile page (WF-30): credibility score display, points breakdown (Strategist/Thinker/Rallymaster/Teambuilder), expert badges, user's ideas grid, recent contributions, Follow toggle button (visual only in prototype) | Phase 2 build |
| 2026-03-08 | scrutinise-web/components/VoteWidget.tsx | Strength slider updated to step={0.5} (11 stops: 0–5 in 0.5 increments). strengthLabels changed from 6-entry array to 11-entry Record<number, string>. Display updated to toFixed(1). | Spec correction |
| 2026-03-08 | scrutinise-web/.dropboxignore | Created — excludes .next/ and node_modules/ from Dropbox sync to prevent file locking conflicts with Next.js dev server (EPERM rename errors) | Dev environment fix |

---

*CHANGE_LOG.md — Scrutinise — March 2026*
*PENDING entries are cleared after batch application.*
*APPLIED entries are never deleted — this is the audit trail.*
