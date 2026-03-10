# CC BRIEFING — V0 DESIGN INTEGRATION

*Produced by CCh — save to scrutinise-docs/ before issuing to CC* *Date: 10-03-26*

***

## BEFORE YOU START

Run the start-of-session checklist:

```bash
bash start-session.sh
git status
git branch
```

Confirm you are on `Main` before writing a single line of code. If not:

```bash
git checkout Main
```

Then read `CLAUDE.md` and `entity_list_v4.md` as normal before proceeding.

***

## IMMEDIATE FIRST TASK — SECURITY PATCH

Before any design work, resolve the open security PR for React Server Components CVE vulnerabilities. This is a critical remote code execution vulnerability and must be patched first.

```bash
git fetch origin
git checkout -b security/rsc-cve-patch
git merge origin/vercel/react-server-components-cve-vu-7qf32d
```

This will produce conflicts in `scrutinise-web/package.json` and `scrutinise-web/package-lock.json`. Resolve them by accepting the **incoming change** (the security patch versions) for Next.js and React:

-   `next`: accept the patched version from the security branch
-   `react`: accept `^19.2.3`
-   `react-dom`: accept `^19.2.3`
-   Keep all other existing dependencies from `Main` unchanged

After resolving:

```bash
cd scrutinise-web
npm install
cd ..
git add scrutinise-web/package.json scrutinise-web/package-lock.json
git commit -m "fix: resolve React Server Components CVE - upgrade next/react to patched versions"
git push origin security/rsc-cve-patch
git checkout Main
git merge security/rsc-cve-patch
git push origin Main
```

Run `npm run dev` and confirm the site still builds before proceeding to design work.

***

## OBJECTIVE

Apply the v0-generated design system to every page in the prototype. Visual consistency across all pages — same typography, same colour tokens, same component style, same nav. No functionality changes. No mock data changes. No routing changes.

One content change only: remove the prototype entry point link from the public homepage.

***

## REFERENCE FILES

The v0 export is at:

```
scrutinise-docs/v0-export/
├── app/page.tsx              ← homepage design reference
├── app/dashboard/page.tsx    ← dashboard design reference
├── app/globals.css           ← full design token set (source of truth)
└── components/ui/            ← new shadcn components to check
```

**Do not copy these files directly into the project.** Use them as design reference only. The v0 files are a standalone project — they are missing UserSwitcher, PrototypeBanner, mock data wiring, and all Scrutinise routing. You are applying the *style*, not replacing the *content*.

***

## STEP 1 — MERGE THE THEME

Replace the CSS custom property block in `scrutinise-web/app/globals.css` with the full token set from `scrutinise-docs/v0-export/app/globals.css`. Keep any Scrutinise-specific additions already in the file. Copy across exactly:

-   All `:root` CSS variables
-   The `.dark-section` utility class
-   The `@theme inline` block
-   The stage colour variables (`--stage-create` through `--stage-parliament`)
-   The dark section variables (`--dark-bg`, `--dark-fg`, `--dark-muted`, `--dark-border`)

After merging, run `npm run dev` and confirm the homepage renders without errors before proceeding.

Commit: `style: merge v0 design tokens into globals.css`

***

## STEP 2 — COPY NEW UI COMPONENTS

Check `scrutinise-web/components/ui/` and copy any of the following that are missing:

-   `sidebar.tsx`
-   `button-group.tsx`
-   `empty.tsx`
-   `field.tsx`
-   `item.tsx`
-   `spinner.tsx`

Source: `scrutinise-docs/v0-export/components/ui/`

Commit: `style: add missing v0 shadcn components`

***

## STEP 3 — REPLACE THE HOMEPAGE

Replace `scrutinise-web/app/page.tsx` with a new version built from the v0 design reference.

**Keep from v0 exactly:**

-   Sticky nav with backdrop-blur, mobile hamburger menu
-   Hero section (white background, left-aligned headline, two CTA buttons)
-   First dark band (`bg-[#0a0a0f]`) with Parliament video
-   Five Stages section (numbered circles, grid layout)
-   Stats band (3-column: Ideas Created, Active Citizens, Bills in Progress)
-   Trust/Democracy copy section
-   Footer with About / Privacy / Terms / Contact links

**Video source for the first dark band — use this URL directly, do not download:**

```
https://videos.pexels.com/video-files/3129671/3129671-uhd_2560_1440_30fps.mp4
```

**Add a second dark band immediately after the first video band:**

```tsx
{/* Research Band */}
<section className="bg-[#0a0a0f]">
  <div className="mx-auto max-w-5xl px-4 py-12 sm:px-6 sm:py-16">
    <h2 className="mb-6 text-2xl font-semibold text-white sm:text-3xl">
      We'll handle the research for you
    </h2>
    <div className="relative aspect-video overflow-hidden rounded-lg">
      {/* Charlie to supply video URL — placeholder for now */}
      <div className="flex size-full items-center justify-center bg-zinc-800">
        <p className="text-sm text-gray-400">Video coming soon</p>
      </div>
    </div>
  </div>
</section>
```

**Scrutinise-specific routing (override v0 defaults):**

-   "Get Started" → `/prototype/create/stage1`
-   "Vote" / "Browse" → `/prototype/browse`
-   Nav links must use Scrutinise routes, not v0's `/dashboard`

**Remove from the homepage entirely:**

-   Any link, button, card, or nav item pointing to `/prototype` as an entry point
-   Any "View Prototype", "Try the prototype", or "Journey selector" element
-   PrototypeBanner must NOT appear on the public homepage — keep it on `/prototype/*` pages only

Commit: `feat: replace homepage with v0 design + research video band`

***

## STEP 4 — RESTYLE THE PROTOTYPE LAYOUT

Edit `scrutinise-web/app/prototype/layout.tsx`. This wraps every `/prototype/*` page — styling it once applies to all of them.

-   Header: `sticky top-0 z-50 border-b border-border bg-background/95 backdrop-blur-sm`
-   Inner wrapper: `mx-auto max-w-5xl px-4 sm:px-6`
-   Nav links: `text-sm text-muted-foreground transition-colors hover:text-foreground`
-   Notification bell: keep existing bell + unread badge, `size-5` icon
-   UserSwitcher: keep fixed bottom-right
-   PrototypeBanner: keep at top of all `/prototype/*` pages

Commit: `style: apply v0 nav pattern to prototype layout`

***

## STEP 5 — RESTYLE THE DASHBOARD

File: `scrutinise-web/app/prototype/page.tsx`

Use `scrutinise-docs/v0-export/app/dashboard/page.tsx` as layout and spacing reference only. Do not replace mock data, routing, or any existing content.

-   Section headings: `text-xs font-medium uppercase tracking-wider text-muted-foreground`
-   Cards: `border border-border rounded-lg bg-card p-4`
-   Stage badges: use `--stage-[name]` CSS variables
-   Quick action buttons: `<Button variant="outline">` with icon + label

Commit: `style: apply v0 design to prototype dashboard`

***

## STEP 6 — STYLE PASS: ALL REMAINING PAGES

For each page, apply v0 design tokens only. **No content, mock data, logic, or routing changes.**

### Rules for every page:

**Backgrounds:** `bg-background` for pages, `bg-card border border-border rounded-lg` for cards, remove all `bg-gray-900` / `bg-zinc-*` / `bg-slate-*`

**Typography:** Titles `text-xl font-semibold tracking-tight`, section labels `text-xs font-medium uppercase tracking-wider text-muted-foreground`, remove all hardcoded `text-white` / `text-gray-*` / `text-zinc-*`

**Buttons:** Default `<Button>`, secondary `<Button variant="outline">`, destructive `<Button variant="destructive">`, nav `<Button variant="ghost">`

**Stage badges:**

```tsx
const stageBadgeStyle = {
  Create:     { backgroundColor: 'var(--stage-create)',     color: 'white' },
  Draft:      { backgroundColor: 'var(--stage-draft)',      color: 'white' },
  Develop:    { backgroundColor: 'var(--stage-develop)',    color: 'white' },
  Campaign:   { backgroundColor: 'var(--stage-campaign)',   color: 'white' },
  Parliament: { backgroundColor: 'var(--stage-parliament)', color: 'white' },
}
```

**Tabs:** List `border-b border-border`, active `border-b-2 border-primary text-foreground font-medium`, inactive `text-muted-foreground hover:text-foreground`

**Forms:** Labels `text-sm font-medium text-foreground`, use shadcn `<Input>` / `<Textarea>` / `<Select>` components throughout

### Pages — one commit per page:

| \# | File                                                | Commit message                                  |
|----|-----------------------------------------------------|-------------------------------------------------|
| 1  | `app/prototype/browse/page.tsx`                     | `style: apply v0 design to browse page`         |
| 2  | `app/prototype/idea/[id]/page.tsx`                  | `style: apply v0 design to idea detail page`    |
| 3  | `app/prototype/create/stage1/page.tsx`              | `style: apply v0 design to create stage1`       |
| 4  | `app/prototype/create/stage2/page.tsx`              | `style: apply v0 design to create stage2 (Lex)` |
| 5  | `app/prototype/profile/[username]/page.tsx`         | `style: apply v0 design to profile page`        |
| 6  | `app/prototype/settings/page.tsx`                   | `style: apply v0 design to settings page`       |
| 7  | `app/prototype/notifications/page.tsx`              | `style: apply v0 design to notifications page`  |
| 8  | `app/prototype/groups/page.tsx`                     | `style: apply v0 design to groups page`         |
| 9  | `app/prototype/groups/create/page.tsx`              | `style: apply v0 design to create group page`   |
| 10 | `app/prototype/groups/[id]/page.tsx`                | `style: apply v0 design to group detail page`   |
| 11 | `app/prototype/propose-amendment/[ideaId]/page.tsx` | `style: apply v0 design to propose amendment`   |
| 12 | `app/prototype/add-research/[ideaId]/page.tsx`      | `style: apply v0 design to add research`        |
| 13 | `app/prototype/admin/page.tsx`                      | `style: apply v0 design to admin page`          |
| 14 | `app/prototype/dashboard/page.tsx`                  | `style: apply v0 design to legacy dashboard`    |
| 15 | `app/prototype/amendment/[id]/page.tsx`             | `style: apply v0 design to amendment detail`    |
| 16 | `app/prototype/referral/idea/[id]/page.tsx`         | `style: apply v0 design to referral idea page`  |
| 17 | `app/prototype/referral/user/[username]/page.tsx`   | `style: apply v0 design to referral user page`  |
| 18 | `app/prototype/testing-guide/page.tsx`              | `style: apply v0 design to testing guide`       |
| 19 | `app/training/page.tsx`                             | `style: apply v0 design to training page`       |
| 20 | `app/about/page.tsx`                                | `style: apply v0 design to about page`          |

***

## STEP 7 — FINAL CHECK

1.  Run `npm run dev`
2.  Navigate every page — confirm no page retains old dark styling
3.  Check stage badges use CSS variable colours on all pages
4.  Check all form elements use shadcn components
5.  Test at 375px viewport — nav must collapse to hamburger on all pages
6.  Confirm PrototypeBanner visible on all `/prototype/*` pages but NOT on public homepage
7.  Confirm UserSwitcher visible and functional on all `/prototype/*` pages
8.  Confirm no link on the public homepage points to `/prototype` directly
9.  Run `git status` — confirm nothing uncommitted
10. Push to `Main` — Charlie will review the Vercel preview and promote to production when ready

Commit any fixes as `fix: [description]`

***

## STEP 8 — DOCS UPDATE

-   `CHANGE_LOG.md`: one entry per file changed this session
-   `handoff_summary.md`: rewrite to reflect fully-styled prototype state and `Main` branch
-   `CC_briefing_next_session.md`: next priority is mobile optimisation pass (375px), then Sprint 1 per `implementation_plan.md`

***

## DO NOT TOUCH THIS SESSION

-   `docs/entity_list_v4.md` — CCh-only, never edit
-   `lib/mockData.ts` — content unchanged
-   Any API routes or `lib/` files
-   `CLAUDE.md`
-   Any routing or navigation logic

***

## NOTE ON VERCEL DEPLOYMENTS

Charlie reviews Preview deployments and promotes to Production manually. Push to `Main` as normal after each commit — no special deployment steps needed from CC.

***

*CC_briefing_v0_design_FINAL.md — produced by CCh — 10-03-26* *Save to scrutinise-docs/ before issuing to CC*
