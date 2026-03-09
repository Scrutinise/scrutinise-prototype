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
| 2026-03-08 | scrutinise-web/lib/mockData.ts | Expanded MockIdea interface with diagnosis, rootCause, guidingPolicy, research, history, endorsements, qualityFlags, targetLegislation, wordingLocked, version, proposedWording. Rewrote CoherentAction interface (title/description/proposedWording). Updated all 3 mock ideas with realistic content. Added MOCK_TRAINING (5 entries), MOCK_GROUPS (2 groups), expanded MOCK_NOTIFICATIONS to 8 entries. Added isOwnerReply and stance to Comment. | 2026-03-08 prototype build session |
| 2026-03-08 | scrutinise-web/components/CommentRatingForm.tsx | Created new component: multi-flag positive/negative rating UI for comments. Positive flags: constructive, insightful, relevant, fresh_perspective, balanced, helpful_facts, direct_experience, good_question. Negative flags: ad_hominem, straw_man, red_herring, false_dilemma, slippery_slope, moving_goalposts, motte_bailey, tu_quoque, cherry_picking, not_relevant. Optional note field. Submit state. | 2026-03-08 prototype build session |
| 2026-03-08 | scrutinise-web/app/prototype/idea/[id]/page.tsx | Complete rebuild. 6 tabs (Overview, Amendments, Comments, Research, Wording, History). Owner vs guest view detection. Owner panel: stage gate checklist, vote analytics with bars, quality flag tallies, Broadcast to Voters button. Tab 1 Overview: diagnosis, rootCause, guidingPolicy, expandable coherent actions, target legislation card, endorsements with required count. Tab 2 Amendments: filter bar, DiffView on expand, owner Accept/Reject/Consult buttons on PENDING. Tab 3 Comments: stance filter, sort, CommentRatingForm inline, stance badges, Report button. Tab 4 Research: filter bar, sourceType badges, for/against indicator, Add Research link. Tab 5 Wording: locked/unlocked notice, version, edit button. Tab 6 History: type icons, chronological list. | 2026-03-08 prototype build session |
| 2026-03-08 | scrutinise-web/app/prototype/settings/page.tsx | New page. Account section (display name, username, email read-only, bio, expertType, politicalParty). Status Claims (parliamentary modal with MP/Lords roles; professional modal with firm/credentials/file upload). Privacy (download data, delete account with warning). Notifications (global email toggle + 8 individual type toggles). AI section (interaction style dropdown, credit balance bar, top-up button). | 2026-03-08 prototype build session |
| 2026-03-08 | scrutinise-web/app/prototype/notifications/page.tsx | New page. Filter tabs (All/Votes/Amendments/Stage/System). Mark all as read state. Per-notification mark-read on click. Type icons. Unread blue dot and blue-tinted card. Click navigates to idea. | 2026-03-08 prototype build session |
| 2026-03-08 | scrutinise-web/app/prototype/groups/page.tsx | New page. Group cards with type badge, role badge (Owner/Member), member count. Manage/View links. Create Group button. | 2026-03-08 prototype build session |
| 2026-03-08 | scrutinise-web/app/prototype/groups/create/page.tsx | New page. Group name (required), description, type radio (Collaborators/Supporters/Public), email chip input with add/remove, submit success state. | 2026-03-08 prototype build session |
| 2026-03-08 | scrutinise-web/app/prototype/groups/[id]/page.tsx | New page. Header with type badge, member count. Invite link with clipboard copy button. Member list with Remove buttons (owner only). Add member email input. Settings accordion (owner only): edit name/description, delete group. | 2026-03-08 prototype build session |
| 2026-03-08 | scrutinise-web/app/prototype/propose-amendment/[ideaId]/page.tsx | New page. Section dropdown (CoherentAction titles + Guiding Policy + Diagnosis). Current text auto-populated read-only. Proposed text with live word count diff. Rationale (required). Research URL multi-row input. Relevant legislation. Submit success state. | 2026-03-08 prototype build session |
| 2026-03-08 | scrutinise-web/app/prototype/add-research/[ideaId]/page.tsx | New page. Title, snippet, relevance, summary, source URL, source type dropdown. For policy Yes/No toggle. For action Yes/No toggle. Quality self-assessment 1–5 star buttons. PDF file input (visual). Submit success state. | 2026-03-08 prototype build session |
| 2026-03-08 | scrutinise-web/app/training/page.tsx | Complete rebuild. Dark mode. Filter bar: Stage (All/Create/Draft/Develop/Campaign/Parliament), Difficulty (All/Beginner/Intermediate/Advanced), Type (All/Video/Article). Resource cards with type badge, stage badge, difficulty badge. Video cards: Watch button triggers inline iframe embed. Article cards: Read → external link. | 2026-03-08 prototype build session |
| 2026-03-08 | scrutinise-web/app/prototype/referral/idea/[id]/page.tsx | New page. "Shared by [owner]" attribution banner. Idea title, summary, vote counts. VoteWidget. Diagnosis, guiding policy, coherent actions. Endorsements section. What is Scrutinise? explainer. Login/signup prompt with links. | 2026-03-08 prototype build session |
| 2026-03-08 | scrutinise-web/app/prototype/referral/user/[username]/page.tsx | New page. User avatar initials circle, display name, role badge, verified badge, Credibility Score. Their ideas list with stage badge, vote count, passion score. What is Scrutinise? explainer. Login/signup prompt. | 2026-03-08 prototype build session |
| 2026-03-08 | scrutinise-web/app/prototype/layout.tsx | Added sticky prototype nav bar with links to Dashboard, Groups, Training, Settings. Added notification bell icon with red unread count badge (reads from MOCK_NOTIFICATIONS). | 2026-03-08 prototype build session |
| 2026-03-08 | scrutinise-web/components/ui/Navbar.tsx | Updated links array from plain strings to {label, href} objects with correct routes (Create→/prototype/create/stage1, Browse→/prototype/browse, Training→/training, About→/about). | 2026-03-08 prototype build session |
| 2026-03-08 | scrutinise-web/app/prototype/page.tsx | Added Journey 6 (Explore dashboard → /prototype/dashboard) and Journey 7 (Browse training → /training). | 2026-03-08 prototype build session |
| 2026-03-08 | scrutinise-web/app/prototype/dashboard/page.tsx | Added header shortcut links to Notifications, Groups, Settings pages. | 2026-03-08 prototype build session |
| 2026-03-06 | README.md | Added Section 4a: Concurrent Working — the critical rule. CC edits files directly on disk; CCh works from uploaded copies. They must never work on the same file simultaneously. Charlie is the gatekeeper. CCh holds decisions in context and batch-applies at handoff. | Reply 26–27, March 2026 session |
| 2026-03-06 | README.md | Clarified file access for each actor in Section 4: CC reads/writes disk directly; CCh only sees uploaded files and produces outputs for Charlie to save manually. | Reply 25–26, March 2026 session |
| 2026-03-06 | scrutinise-web/components/RevolutHero.tsx | Stage names corrected in homepage hero: Stage 1–5 → Create / Draft / Develop / Campaign / Parliament | CC build audit |
| 2026-03-06 | scrutinise-web/lib/mockData.ts | Comment rating structure changed from numeric {quality, evidence, civility} to multi-flag arrays: positiveFlags: string[], negativeFlags: string[]. Valid flags defined per spec. | CC build audit |
| 2026-03-06 | scrutinise-web/app/about/page.tsx | "burnish the reputation of parties" → "enhance the standing of parties" to avoid conflict with platform Credibility Score terminology | CC build audit |
| 2026-03-06 | scrutinise-docs/scrutinise_prototype_brief.md | Created — comprehensive prototype build guide covering codebase state, file structure, mock data, scripted Lex conversation (19 exchanges), component specs, five user journeys, terminology, styling guidelines, deployment notes, and build order | CC session |
| 2026-03-07 | scrutinise-web/app/prototype/profile/[username]/page.tsx | Created — user profile page (WF-30): credibility score display, points breakdown (Strategist/Thinker/Rallymaster/Teambuilder), expert badges, user's ideas grid, recent contributions, Follow toggle button (visual only in prototype) | Phase 2 build |
| 2026-03-08 | scrutinise-web/components/VoteWidget.tsx | Strength slider updated to step={0.5} (11 stops: 0–5 in 0.5 increments). strengthLabels changed from 6-entry array to 11-entry Record<number, string>. Display updated to toFixed(1). | Spec correction |
| 2026-03-08 | scrutinise-web/.dropboxignore | Created — excludes .next/ and node_modules/ from Dropbox sync to prevent file locking conflicts with Next.js dev server (EPERM rename errors) | Dev environment fix |
| 2026-03-09 | scrutinise-web/app/prototype/create/stage1/page.tsx | Rebuilt: 8-field Basic Info form (title, ideaType toggle, govtArea dropdown, summaryDescription, summaryDiagnosis, summaryGuidingPolicy, summaryCoherentActions, connectedIdeas). Stage progress indicator. Conditional "Ready for Stage 2" button. | CC_briefing_next_session.md Priority 1 |
| 2026-03-09 | start-session.sh | Created: session logging script — appends timestamp and branch to session-log.txt, runs git status | CC_briefing_next_session.md Priority 2 |
| 2026-03-09 | scrutinise-web/app/prototype/page.tsx | Converted from journey-selector hub to WF-10 proper dashboard: welcome greeting, My Ideas section, quick actions, notifications sidebar, following/watching placeholder, groups section | CC_briefing_next_session.md Priority 3 |
| 2026-03-09 | scrutinise-web/app/prototype/testing-guide/page.tsx | Created: tester-facing checklist with 8 journeys, step-by-step verification items per journey, full page inventory table with checkboxes | CC_briefing_next_session.md Priority 4 |
| 2026-03-09 | scrutinise-docs/entity_list_v4.md | Added to repo: replaces entity_list_v3.md. 54 entities. CommentRating redesigned with positiveFlags/negativeFlags JSON + dispute flow. DisputedLogicFlag entity added. Follow entity added. Training entity added. CredibilityScore canonical (InfluenceScore retired). User.mobile required. BroadcastMessage expanded with co-signatory fields. | CCh session 09-03-26 |
| 2026-03-09 | scrutinise-docs/CC_briefing_next_session.md | Created: CCh-produced briefing document for this CC session | CCh session 09-03-26 |
| 2026-03-09 | scrutinise-docs/CLAUDE.md | Updated: Section 1 checklist references entity_list_v4; Section 5 repo structure updated to v4 (54 entities); Section 12 Field Preservation Rule added (immutable, CCh-only entity list); Section 11/13 renumbered | CCh session 09-03-26 |

---

*CHANGE_LOG.md — Scrutinise — March 2026*
*PENDING entries are cleared after batch application.*
*APPLIED entries are never deleted — this is the audit trail.*
