# CC BRIEFING — NEXT SESSION
*Produced by CCh — Charlie must save this before issuing to CC*
*Date: 10-03-26*

---

## WHAT HAS CHANGED SINCE LAST CC SESSION

### v0 Design System — FULLY APPLIED ✅

The entire prototype has been restyled with the v0 design system. All 22 pages now use:
- Light background design tokens from `globals.css` (oklch civic trust palette)
- Shadcn UI components: `Button`, `Badge`, `Card`, `Input`, `Textarea`, `Label`, `Separator`
- CSS variable stage colours (`--stage-create` through `--stage-parliament`) via inline `stageBadgeStyle` on all pages
- `text-foreground` / `text-muted-foreground` throughout — no more hardcoded `text-white` / `text-gray-*`
- `border-border` throughout — no more `border-gray-*`
- `bg-card border border-border rounded-lg` for cards — no more `bg-gray-900`
- Filter/tab active state: `bg-primary border-primary text-primary-foreground`

**New files added:**
- `scrutinise-web/lib/utils.ts` — `cn()` helper
- `scrutinise-web/components/ui/button.tsx`, `badge.tsx`, `card.tsx`, `input.tsx`, `textarea.tsx`, `label.tsx`, `separator.tsx`
- `scrutinise-web/components/ui/empty.tsx`, `field.tsx`, `item.tsx`, `spinner.tsx`, `button-group.tsx`

**Homepage:** Fully replaced with v0 design. Sticky nav, hero, Parliament video band, research video band (placeholder — Charlie to supply URL), Five Stages, stats, trust copy, footer. No `/prototype` entry-point link on public homepage.

---

## WHAT TO BUILD THIS SESSION

### Priority 1 — Mobile Optimisation Pass (375px)

Test every page at 375px viewport width. Fix any layout breaks. Key things to check:

- Nav must collapse to hamburger on public homepage (already implemented)
- Prototype layout nav must collapse at mobile — currently shows all links horizontally, needs a hamburger or wrapping at 375px
- Dashboard grid: `lg:grid-cols-3` — verify it stacks cleanly on mobile
- Browse page card grid: `md:grid-cols-2 lg:grid-cols-3` — should be 1-column at 375px ✓
- Idea detail page: tabs `overflow-x-auto` — verify horizontal scroll works
- Filters row (browse, idea detail tabs): flex-wrap should prevent overflow
- Forms (settings, create stage1, propose-amendment, add-research): inputs should be full-width
- Groups create page: email chip input must not overflow

Fix any issues found. One commit per page fixed: `fix: mobile layout [page name]`

---

### Priority 2 — Sprint 1 per implementation_plan.md

Once mobile pass is complete, begin Sprint 1. Read `implementation_plan.md` for the sprint plan. Priorities are database schema, API routes, and real Clerk auth replacing the mock UserSwitcher.

---

## WHAT NOT TO TOUCH THIS SESSION
- Do not modify `entity_list_v4.md` (CCh-only document)
- Do not modify `lib/mockData.ts`
- Do not modify routing or navigation logic

---

## COMMIT INSTRUCTIONS
One commit per page fixed: `fix: mobile layout [page name]`
Update CHANGE_LOG.md and handoff_summary.md at session end.

---

*CC_briefing_next_session.md — produced by CCh — 10-03-26*
