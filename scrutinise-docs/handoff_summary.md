# SCRUTINISE — CONVERSATION HANDOFF SUMMARY
*Compact summary of current prototype build state and outstanding items.*
*Use this at the start of the next CCh session before briefing CC.*
*Last updated: 2026-03-10*

---

## CURRENT STATE OF THE PROTOTYPE BUILD

### All Phases: COMPLETE ✅ — V0 DESIGN APPLIED ✅

The clickable prototype is fully built and fully styled with the v0 design system. Every page renders with realistic mock data. All navigation links work. All pages use the civic trust design tokens (light background, professional typography, CSS-variable stage colours).

**Branch:** `Main`

**Pages (complete list):**

| Page | Route | Status |
|------|-------|--------|
| Homepage | `/` | ✅ Complete — v0 design applied |
| About | `/about` | ✅ Complete — v0 design applied |
| Training | `/training` | ✅ Complete — v0 design applied |
| Prototype dashboard | `/prototype` | ✅ Complete — v0 design applied |
| Create Stage 1 | `/prototype/create/stage1` | ✅ Complete — v0 design applied |
| Create Stage 2 (Lex) | `/prototype/create/stage2` | ✅ Complete — v0 design applied |
| Browse ideas | `/prototype/browse` | ✅ Complete — v0 design applied |
| Idea detail | `/prototype/idea/[id]` | ✅ Complete — v0 design applied |
| Amendment review | `/prototype/amendment/[id]` | ✅ Complete — v0 design applied |
| Dashboard (legacy) | `/prototype/dashboard` | ✅ Complete — v0 design applied |
| Admin moderation | `/prototype/admin` | ✅ Complete — v0 design applied |
| User profile | `/prototype/profile/[username]` | ✅ Complete — v0 design applied |
| Account settings | `/prototype/settings` | ✅ Complete — v0 design applied |
| Notifications | `/prototype/notifications` | ✅ Complete — v0 design applied |
| Groups | `/prototype/groups` | ✅ Complete — v0 design applied |
| Create group | `/prototype/groups/create` | ✅ Complete — v0 design applied |
| Group detail | `/prototype/groups/[id]` | ✅ Complete — v0 design applied |
| Propose amendment | `/prototype/propose-amendment/[ideaId]` | ✅ Complete — v0 design applied |
| Add research | `/prototype/add-research/[ideaId]` | ✅ Complete — v0 design applied |
| Referral — idea | `/prototype/referral/idea/[id]` | ✅ Complete — v0 design applied |
| Referral — user | `/prototype/referral/user/[username]` | ✅ Complete — v0 design applied |
| Testing guide | `/prototype/testing-guide` | ✅ Complete — v0 design applied |

---

## DESIGN SYSTEM (v0 — applied 2026-03-10)

**Design tokens:** All pages use CSS custom property tokens defined in `globals.css`:
- Light background (`--background`, `--card`, `--secondary`)
- Civic blue primary (`--primary` oklch(0.45 0.12 250))
- Stage colours via CSS variables: `--stage-create`, `--stage-draft`, `--stage-develop`, `--stage-campaign`, `--stage-parliament`
- Dark section support: `--dark-bg`, `--dark-fg`, `.dark-section` utility class

**UI components** (in `components/ui/`):
- `button.tsx`, `badge.tsx`, `card.tsx`, `input.tsx`, `textarea.tsx`, `label.tsx`, `separator.tsx`
- `empty.tsx`, `field.tsx`, `item.tsx`, `spinner.tsx`, `button-group.tsx`

**Stage badge pattern** (used across all prototype pages):
```tsx
const stageBadgeStyle: Record<Stage, React.CSSProperties> = {
  Create:     { backgroundColor: 'var(--stage-create)',     color: 'white' },
  Draft:      { backgroundColor: 'var(--stage-draft)',      color: 'white' },
  Develop:    { backgroundColor: 'var(--stage-develop)',    color: 'white' },
  Campaign:   { backgroundColor: 'var(--stage-campaign)',   color: 'white' },
  Parliament: { backgroundColor: 'var(--stage-parliament)', color: 'white' },
}
```

---

## COMPONENTS

| Component | Status |
|-----------|--------|
| LexChat | ✅ Complete |
| VoteWidget | ✅ Complete (step=0.5, 11 labels) |
| SummaryPanel | ✅ Complete |
| DiffView | ✅ Complete |
| AIFuelGauge | ✅ Complete |
| PrototypeBanner | ✅ Complete |
| UserSwitcher | ✅ Complete |
| CommentRatingForm | ✅ Complete |
| Button / Badge / Card / Input / Textarea | ✅ Added (shadcn, v0 export) |

---

## SPEC DOCUMENTS

| Document | Version | Status |
|----------|---------|--------|
| entity_list | v4 | ✅ Current — 54 entities |
| process_list | v2 | ✅ Current (header still says v3 — update next time touched) |
| system_mechanics | v0.6 | ✅ Current |
| wireframes | v3 | ✅ Current |
| implementation_plan | current | ✅ Current |
| CLAUDE.md | updated 09-03-26 | ✅ Current |

---

## DEV ENVIRONMENT

```bash
cd scrutinise-web
npm run dev
```
Ensure Dropbox paused or `.dropboxignore` active before running. Start from `scrutinise-web/` directory.

Session logging: run `bash start-session.sh` from repo root at start of each CC session.

---

## OUTSTANDING ITEMS

1. **Mobile optimisation pass** — all pages built desktop-first. Next priority: test all pages at 375px viewport, fix layout breaks.
2. **process_list_v2.md header** — still references "Entity List v3". Update to v4 next time this file is touched.
3. **70/30 AI credit split mechanic** — confirmed as 70/30 but exact payment mechanism TBC (CCh decision needed).
4. **wireframes_v3.md** — ASCII layout sketches still needed for WF-11, WF-13, WF-33.
5. **Research video band** — homepage has placeholder. Charlie to supply video URL.
6. **Sprint 1** — prototype is feature-complete and styled. Ready to begin database, API routes, real auth per `implementation_plan.md` after mobile pass.

---

## KEY TERMINOLOGY

| Use | Never use |
|-----|-----------|
| Lex | Claude, the AI, AI assistant |
| Credibility Score | Reputation, InfluenceScore |
| Teambuilder | Dealweaver |
| Create / Draft / Develop / Campaign / Parliament | Stage 1-5 |
| FOR / AGAINST / UNDECIDED + strength 0–5 | Bipolar -5/+5 |

---

## NEXT STEPS

The prototype is feature-complete and fully styled. Recommended next actions:

1. **Charlie reviews Vercel preview** — confirm design looks correct on the deployment
2. **Mobile optimisation** — test at 375px, fix any layout breaks (next CC session priority)
3. **Research video** — Charlie to supply video URL for homepage research band placeholder
4. **Sprint 1** — begin database, API routes, real auth per `implementation_plan.md`

---

## HOW TO START THE NEXT CC SESSION

1. Run `bash start-session.sh` from repo root
2. Give CC this instruction:

> Read `CLAUDE.md` and `CC_briefing_next_session.md` in `scrutinise-docs/`. The prototype is feature-complete and fully styled with the v0 design system. Priority: mobile optimisation pass — test all pages at 375px viewport, fix any layout breaks. Then begin Sprint 1 per `implementation_plan.md`.

---

*handoff_summary.md — Scrutinise — last updated 2026-03-10*
