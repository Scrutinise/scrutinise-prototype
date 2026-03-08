# SCRUTINISE — CONVERSATION HANDOFF SUMMARY
*Compact summary of current prototype build state and outstanding items.*
*Use this at the start of the next CCh session before briefing CC.*
*Last updated: 2026-03-08*

---

## CURRENT STATE OF THE PROTOTYPE BUILD

### Phase 1 — Core Journeys: COMPLETE ✅

All five prototype journeys are built and navigable:

| Page | Route | Status |
|------|-------|--------|
| Prototype hub | `/prototype` | ✅ Complete |
| Create — Stage 1 | `/prototype/create/stage1` | ✅ Complete |
| Create — Stage 2 (Lex) | `/prototype/create/stage2` | ✅ Complete |
| Browse ideas | `/prototype/browse` | ✅ Complete |
| Idea detail | `/prototype/idea/[id]` | ✅ Complete |
| Amendment review | `/prototype/amendment/[id]` | ✅ Complete |
| Dashboard | `/prototype/dashboard` | ✅ Complete |
| Admin moderation | `/prototype/admin` | ✅ Complete |

All components built: LexChat, VoteWidget, SummaryPanel, DiffView, AIFuelGauge, PrototypeBanner, UserSwitcher.

### Phase 2 — Supporting Pages: IN PROGRESS 🔄

| Page | Route | Status |
|------|-------|--------|
| User profile | `/prototype/profile/[username]` | ✅ Complete |
| Account settings | `/prototype/settings` | ⚪ Not started |
| Notifications | `/prototype/notifications` | ⚪ Not started |
| Groups dashboard | `/prototype/groups` | ⚪ Not started |
| Create group | `/prototype/groups/create` | ⚪ Not started |

### Phase 3 — Polish: NOT STARTED ⚪

CommentRatingForm component, training page, referral landing pages, mobile optimisation pass.

---

## DEV ENVIRONMENT STATUS: STABLE ✅

**Problem resolved (2026-03-08):** Turbopack FATAL panics and repeated GET/POST refresh loop were caused by Dropbox file locking on the `.next/` directory, not by code errors.

**Fix applied:**
- `.dropboxignore` created at repo root — excludes `.next/` and `node_modules/` from Dropbox sync
- Dropbox must be paused or `.dropboxignore` active before running `npm run dev`
- `package.json` dev script is `"next dev"` (Turbopack default — works fine once Dropbox exclusion is active)

**To run dev server:**
```bash
cd scrutinise-web
npm run dev
```
Start from `scrutinise-web/` directory, not repo root.

---

## SPEC CORRECTIONS APPLIED TO CODEBASE

These were identified in the CC build audit and fixed:

| File | Fix |
|------|-----|
| `RevolutHero.tsx` | Stage 1–5 → Create/Draft/Develop/Campaign/Parliament |
| `mockData.ts` | Comment ratings: numeric → multi-flag arrays (positiveFlags, negativeFlags) |
| `about/page.tsx` | "reputation" → "standing" |
| `VoteWidget.tsx` | Strength slider: step={0.5}, 11 label entries, display as toFixed(1) |

---

## PROTOTYPE BRIEF STATUS

`scrutinise_prototype_brief.md` exists in `/docs/` — written by CC, verified by CCh.

All three corrections requested by CCh were incorporated when the brief was written:
- ✅ VoteWidget spec shows 0.5 increments with 11 label entries
- ✅ MockIdea interface includes `passionScore: number` with example value 3.8
- ✅ Follow button described as "visual only in prototype — functional in production build"

The brief is the authoritative guide for any CC session working on the prototype.

---

## KEY TERMINOLOGY (canonical — never substitute)

| ✅ Use | ❌ Never use |
|--------|-------------|
| Lex | Claude, the AI, AI assistant |
| Credibility Score | Reputation |
| Teambuilder | Dealweaver |
| Create / Draft / Develop / Campaign / Parliament | Stage 1 / 2 / 3 / 4 / 5 |
| FOR / AGAINST / UNDECIDED + strength 0–5 | Bipolar -5/+5 slider, Support/Oppose |
| Passion score | Vote score, net votes |

---

## VOTING MECHANIC (CONFIRMED — supersedes old handoff)

The voting spec is:
- **Direction:** FOR / AGAINST / UNDECIDED (three buttons)
- **Strength:** 0–5 slider in **0.5 increments** (11 stops)
- **Passion score:** average strength across all votes, displayed publicly
- NOT a single bipolar -5 to +5 slider (this was an earlier version — now superseded)

This is correctly implemented in `VoteWidget.tsx` and documented in `scrutinise_prototype_brief.md`.

---

## OUTSTANDING ITEMS FROM PREVIOUS SESSIONS (STILL PENDING)

These were in the old handoff and remain unresolved:

1. **DisputedLogicFlag entity** — referenced in `lex_system_prompt_v2.md` Section 5 but missing from `entity_list_v3.md`. Needs adding (see CHANGE_LOG PENDING section for field spec).
2. **ProposedWording location** — confirm it is per CoherentAction, not per Idea as a single field.
3. **70/30 AI credit split mechanic** — confirmed as 70/30 but exact payment mechanism is TBC.
4. **Expert role verification flow** — no wireframe for how a user claims Expert status. Gap to fill.
5. **wireframes_v3.md** — ASCII layout sketches still needed for WF-11, WF-13, WF-33.
6. **CLAUDE.md** — temporary audit instruction (added 2026-03-06) can now be removed — audit is complete.

---

## WHAT CC SHOULD WORK ON NEXT

Following the prototype build order in `scrutinise_prototype_brief.md` Section 10:

**Next Phase 2 page: `/prototype/settings`** (account settings mock form)
- Mock form: name, email, bio, notification toggles
- Non-functional save button
- Link from user profile and dashboard

Then: `/prototype/notifications`, `/prototype/groups`, `/prototype/groups/create`

After Phase 2 complete: begin Phase 3 (CommentRatingForm, training page, referral LPs).

---

## HOW TO START THE NEXT CC SESSION

Give CC this instruction:

> Read `scrutinise_prototype_brief.md` in `/docs/` and `CLAUDE.md`. Then continue Phase 2 of the prototype build order. The next page to build is `/prototype/settings` — account settings mock form. Use the styling patterns and mock data conventions already established across the prototype.

---

## HOW TO START THE NEXT CCh SESSION

1. Upload: CLAUDE.md, entity_list_v3.md, system_mechanics_v0_6.md, wireframes_v3.md, implementation_plan.md, process_list_v2.md, handoff_summary.md, CHANGE_LOG.md
2. Ask CCh to read via bash tool if any files don't render
3. Ask CCh to review outstanding items list above and advise on priorities

---

*handoff_summary.md — Scrutinise — last updated 2026-03-08*
