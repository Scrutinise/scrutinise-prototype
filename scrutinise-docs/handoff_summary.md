# SCRUTINISE — CONVERSATION HANDOFF SUMMARY
*Compact summary of current prototype build state and outstanding items.*
*Use this at the start of the next CC session before briefing CC.*
*Last updated: 2026-03-08*

---

## CURRENT STATE OF THE PROTOTYPE BUILD

### Phase 1 — Core Journeys: COMPLETE ✅

All five prototype journeys are built and navigable:

| Page | Route | Status |
|------|-------|--------|
| Prototype hub | `/prototype` | ✅ Complete (now shows 7 journeys) |
| Create — Stage 1 | `/prototype/create/stage1` | ✅ Complete |
| Create — Stage 2 (Lex) | `/prototype/create/stage2` | ✅ Complete |
| Browse ideas | `/prototype/browse` | ✅ Complete |
| Idea detail | `/prototype/idea/[id]` | ✅ Rebuilt (6 tabs, owner/guest views) |
| Amendment review | `/prototype/amendment/[id]` | ✅ Complete |
| Dashboard | `/prototype/dashboard` | ✅ Complete (links added) |
| Admin moderation | `/prototype/admin` | ✅ Complete |

### Phase 2 — Supporting Pages: COMPLETE ✅

All supporting pages built this session (2026-03-08):

| Page | Route | Status |
|------|-------|--------|
| User profile | `/prototype/profile/[username]` | ✅ Complete (previous session) |
| Account settings | `/prototype/settings` | ✅ Built 2026-03-08 |
| Notifications | `/prototype/notifications` | ✅ Built 2026-03-08 |
| Groups dashboard | `/prototype/groups` | ✅ Built 2026-03-08 |
| Create group | `/prototype/groups/create` | ✅ Built 2026-03-08 |
| Group detail | `/prototype/groups/[id]` | ✅ Built 2026-03-08 |
| Propose amendment | `/prototype/propose-amendment/[ideaId]` | ✅ Built 2026-03-08 |
| Add research | `/prototype/add-research/[ideaId]` | ✅ Built 2026-03-08 |
| Referral — idea | `/prototype/referral/idea/[id]` | ✅ Built 2026-03-08 |
| Referral — user | `/prototype/referral/user/[username]` | ✅ Built 2026-03-08 |
| Training | `/training` | ✅ Rebuilt 2026-03-08 |

### Phase 3 — Polish: COMPLETE ✅

All Phase 3 polish completed this session:

| Item | Status |
|------|--------|
| CommentRatingForm component | ✅ Built 2026-03-08 |
| Training page with inline video embeds | ✅ Rebuilt 2026-03-08 |
| Referral landing pages | ✅ Built 2026-03-08 |
| Notification bell in prototype layout | ✅ Added 2026-03-08 |
| Training link in Navbar | ✅ Added 2026-03-08 |
| Dashboard shortcut links | ✅ Added 2026-03-08 |

---

## MOCK DATA ADDITIONS (2026-03-08)

### Expanded MockIdea interface

New fields added to all 3 mock ideas:
- `diagnosis` — what is the real problem (full text)
- `rootCause` — underlying cause
- `guidingPolicy` — the approach
- `coherentActions` — rewritten with `title`, `description`, `proposedWording`
- `targetLegislation` — specific legislation with changeType, clauses, URL
- `endorsements` — parliamentary endorsements with public statements
- `qualityFlags` — doesntGoFarEnough, goesTooFar, poorlyWorded vote counts
- `research` — research items with sourceType, forPolicy, relevance
- `history` — chronological event log
- `wordingLocked`, `version`, `proposedWording`

### New mock data objects

- `MOCK_TRAINING` — 5 training resources (4 videos, 1 article) with stage/difficulty/topic tags
- `MOCK_GROUPS` — 2 groups (Housing Policy Network, Digital Rights Coalition) with members
- `MOCK_NOTIFICATIONS` — expanded from 2 to 8 entries covering all notification types

---

## COMPONENTS BUILT OR CHANGED

| Component | Status | Notes |
|-----------|--------|-------|
| `CommentRatingForm.tsx` | ✅ New | Multi-flag positive/negative rating, submit state |
| `VoteWidget.tsx` | ✅ Unchanged | Correct — direction + 0-5 strength |
| `DiffView.tsx` | ✅ Unchanged | Used in idea detail amendments tab |
| `LexChat.tsx` | ✅ Unchanged | |
| `SummaryPanel.tsx` | ✅ Unchanged | |
| `AIFuelGauge.tsx` | ✅ Unchanged | |
| `UserSwitcher.tsx` | ✅ Unchanged | |
| `PrototypeBanner.tsx` | ✅ Unchanged | |
| `RevolutHero.tsx` | ✅ Unchanged | Stage names correct |
| `ui/Navbar.tsx` | ✅ Updated | Links now have correct hrefs including /training |

---

## DEV ENVIRONMENT STATUS: STABLE ✅

**To run dev server:**
```bash
cd scrutinise-web
npm run dev
```
Start from `scrutinise-web/` directory. Ensure Dropbox paused or `.dropboxignore` active to prevent `.next/` folder locking.

---

## SPEC CORRECTIONS APPLIED TO CODEBASE

| File | Fix |
|------|-----|
| `RevolutHero.tsx` | Stage 1–5 → Create/Draft/Develop/Campaign/Parliament |
| `mockData.ts` | Comment ratings: numeric → multi-flag arrays (positiveFlags, negativeFlags) |
| `about/page.tsx` | "reputation" → "standing" |
| `VoteWidget.tsx` | Strength slider: step={0.5}, 11 label entries, display as toFixed(1) |
| `mockData.ts` (2026-03-08) | CoherentAction rewritten with title/description/proposedWording |

---

## OUTSTANDING ITEMS (STILL PENDING)

1. **DisputedLogicFlag entity** — referenced in `lex_system_prompt_v2.md` Section 5 but missing from `entity_list_v3.md`. Needs adding.
2. **ProposedWording location** — confirm it is per CoherentAction (already modelled this way in prototype) vs per Idea as a single field.
3. **70/30 AI credit split mechanic** — confirmed as 70/30 but exact payment mechanism TBC.
4. **wireframes_v3.md** — ASCII layout sketches still needed for WF-11, WF-13, WF-33.
5. **CLAUDE.md** — temporary audit instruction (added 2026-03-06) can now be removed — audit complete.
6. **Mobile optimisation pass** — all new pages built desktop-first; should be tested at 375px.
7. **`/prototype/profile/[username]`** — user public profile page (built previous session, not yet linked from all comment author names — idea detail page now links to it).

---

## KEY TERMINOLOGY (canonical — never substitute)

| Use | Never use |
|-----|-----------|
| Lex | Claude, the AI, AI assistant |
| Credibility Score | Reputation |
| Teambuilder | Dealweaver |
| Create / Draft / Develop / Campaign / Parliament | Stage 1 / 2 / 3 / 4 / 5 |
| FOR / AGAINST / UNDECIDED + strength 0–5 | Bipolar -5/+5 slider, Support/Oppose |
| Passion score | Vote score, net votes |

---

## HOW TO START THE NEXT CC SESSION

Give CC this instruction:

> Read `scrutinise_prototype_brief.md` and `CLAUDE.md` in `/docs/`. The prototype is now substantially complete (all Phase 1-3 pages built). Focus on: (1) mobile optimisation pass — test all pages at 375px; (2) verify `/prototype/profile/[username]` exists and is linked correctly; (3) any remaining gaps identified in outstanding items above.

---

## HOW TO START THE NEXT CCh SESSION

1. Upload: CLAUDE.md, entity_list_v3.md, wireframes_v3.md, handoff_summary.md, CHANGE_LOG.md
2. Ask CCh to review outstanding items list above and advise on priorities

---

*handoff_summary.md — Scrutinise — last updated 2026-03-08*
