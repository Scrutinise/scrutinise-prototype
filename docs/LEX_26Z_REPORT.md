# LEX 26-Z — Where am I? — mobile, Focus view, never losing your place

**Brief:** `docs/BRIEF_26Z.md` (CCh-Lex, 17 Nov; decisions 344–348). CCh-Lex 17 Nov (1): run in its own worktree (`C:\lex26z`, branch
`wip/26z`) while 26-Y is in progress in the main tree. Built in that worktree; the main tree was not touched.

---

## §0 Sizing (18 Nov 2026 10:55 UTC)

### What exists today (read before sizing)

- **One route serves the Development screen:** `/ideas/create?ideaId=…` with `section=problem|causes|policy`, `view=organising|drafting`,
  `stage=deepening`, and `#N` for a record. `/ideas/[id]/drafting` and `/organising` redirect there. So the address can be derived from
  the URL alone (§2d), and a deep link is already a URL.
- **The stages and the chapters are already computed server-side** (`stageContext` → `lifecycle` with state lines, `checklist` with the
  seven Development lines, their marks and the lock). The Where am I? menu reads that object; nothing is counted twice.
- **The page is three columns (`CreateIdeaClient.tsx`, 1,485 lines).** Below `lg` (1024 px) it already shows one column at a time with a
  three-tab bar at the foot (25-L §6). Every column scrolls inside a fixed-height box (`h-screen`, `overflow-y-auto`) — the "10 mm window"
  Charlie describes.
- **A record opens in place** in the Drafting list (`ActionsWorkspace`), with its sticky jump band (256); `#N` on arrival opens it.

### The seven panels, mapped onto what is there (§2c)

| Panel | What it is | Today, on the desktop |
|---|---|---|
| 1 Where am I? | the seven stages and the seven chapters, with their states | the stage bar and checklist, across the top |
| 2 To-do | the worklist and "what to read / gaps / what you know" | left column, top half |
| 3 Lex | the chat | left column, bottom half, "Lex" tab |
| 4 Notes | private notes | left column, bottom half, "Notes" tab |
| 5 Chapters | the list to work on: the seven chapters; under Organising and Drafting, the live actions by number | centre (the checklist line and the list) |
| 6 The open chapter or record | the chapter's page, or the Drafting list with the record open | centre column |
| 7 Research and sources | the research panel | right column |

⚠ **Panel 5 is new as a list in its own right.** On the desktop the chapter list is the checklist line and the action list is part of the
centre column. In Focus it is drawn as its own panel from the same data (the checklist lines and the live actions), and choosing an item
opens it in panel 6 by its existing URL (`section=…`, `view=…`, `#N`). Panel 6 is the centre column unchanged, so the record and its tools
are the ones already tested.

### The split

**Z1 (this part)**
1. `lib/lex/where-am-i.ts` — pure: the panels, the address from URL state ("S2 · C5 · P6") and its spelled-out form, the menu's level
   order by edge, the swipe rule (threshold and exclusions), the back/forward history, the device-storage keys.
2. `components/lex/FocusShell.tsx` — one component for mobile and Focus view: top bar (Where am I? + address, hides on scroll down),
   bottom bar (Where am I? only, safe-area inset), one panel at a time, gestures, keyboard (← → W Esc), the visual-viewport inset for Lex.
3. `components/lex/WhereAmIMenu.tsx` — the sheet from either edge; Stage · Chapter · Panel in edge order; drag-over expands, lift goes;
   tap-tap; keyboard and screen-reader order; the seven panel blocks; the first-time explainer with "Got it" and "?".
4. `CreateIdeaClient` — the column contents become named slots used by both layouts, so Full view renders exactly what it rendered; the
   Focus · Full toggle in the desktop header; below 768 px Focus is forced. The page scrolls naturally in Focus.
5. §6.1 position and §6.2 unsent typing, on the device, wrapped in try/catch.
6. Labels in `screen-labels.ts`, a field-guide entry for each new control; `check:lex-26z` (pure parts + Chromium at 360 / 412 / 768 /
   1440 with touch).

**Z2 (next part):** §6.3 the service worker, the cached last view marked "Offline — last updated", the write queue with its count and
conflict reporting through the normal routes; §6.4 the manifest and icons. Z2 is separate because it adds a new runtime layer (a service
worker on every page of the site, not only Lex) whose failure modes — a stale shell served after a deploy — need their own check and their
own delivery read-back.

### Decided while sizing (say if wrong)

- **Breakpoint 768 forces Focus; 768–1023 in Full view keeps today's tab layout** (it already shows one column at a time), so Full view is
  unchanged everywhere.
- **The default panel** when the URL names none: 6 when it names a chapter (`section`, `view`, `stage=deepening`) or a record, otherwise 2
  (To-do) — today's mobile default is the To-do-and-Lex column.
- **The address omits the chapter when none is open** ("S2 · P2"), rather than printing a placeholder.
- **Gestures follow the brief literally** (left = back, right = forward or the menu), although it is the reverse of the iOS edge-swipe; the
  field guide says so.

---

## Z1 — built (18 Nov 2026)

### What a user sees

**Below 768 px, always, and on a desktop when "Focus view" is chosen:**
- **One panel at a time** between two bars. The page itself scrolls; no column is a fixed-height box any more (the "10 mm window").
  The exception is Lex (panel 3): a conversation keeps its typing box in view. That panel is sized to the visual viewport (what the
  keyboard leaves) less the two bars, and the bottom bar rides above the keyboard.
- **Top bar:** "◎ Where am I?" and the address ("S2 · C5 · P6"). It hides on scroll down and returns on scroll up, and comes back on any
  panel change. A scroll the page makes itself (putting you back) does not hide it. The first time, the address is spelled out beside
  itself; after that on hover or a long press.
- **Bottom bar:** "◎ Where am I?" only, above the home indicator.
- **The menu** opens as a sheet from the bar it came from: Stage → Chapter → Panel from the top, Panel → Chapter → Stage from the bottom,
  the nearest level open first. Drag over a level to open it, lift on an item to go; or tap a level, then an item. Stages and chapters
  are lists with their states (from the same `stageContext` the desktop's stage bar reads); a stage with nothing built says so and
  cannot be chosen. Panels are a small picture of the desktop: seven blocks, each labelled "Panel 3 · Lex · left on desktop". The three
  sentences show once at the top, with "Got it", and come back with "?". It closes by tapping outside, Esc, Close, or swiping it back
  toward its edge. While it is open the page behind it cannot scroll.
- **Gestures:** swipe left goes back to the last panel chosen; swipe right goes forward, or opens Where am I? when there is nothing
  forward. A swipe never fires inside a box that scrolls sideways (a table, the board), a text box, a drag handle or a dialog.
- **Keys (Focus view on a desktop):** ← back, → forward, W opens Where am I?, Esc closes it. Never while typing.
- **Panel 5 → 6:** panel 5 lists the chapters and, under Organising and Drafting, the actions by number. Choosing one opens it in
  panel 6 (the centre column as it is). Choosing #38 while already on Drafting opens the record in place, with no page load, through a
  new `hashchange` listener in `ActionsWorkspace`. Back returns to panel 5 where it was.
- **The address is the URL:** `panel=N` is written into it (replaceState), so a copied link or a reload opens the same panel.

**Full view** (a desktop's default) is the three columns as before. The toggle "● Focus view · ○ Full view" sits in the header beside
"How this works" (≥ 768 px), filled and bold when chosen, remembered per browser.

### Never lose your place (§6.1, §6.2)

- **Position, per idea, on the device:** the URL (stage, chapter, record), the panel, each panel's scroll, and the Organising list's
  list/board choice, find box and Drafting filter. A **bare** link to the idea (`/ideas/create?ideaId=…`, as the dashboard gives) is
  sent back to that place before the idea is drawn, and the shell says "Back where you were". A link that names a place goes there.
  `restoreOnArrival` is one exported function; the workspace and the check both call it.
- **Unsent typing, per idea and field, on the device**, offered back after a reload with "You had unsent text here — restore it?" ·
  Restore it · Discard it, and never sent by itself. Wired into: Lex's message, Edit the action, Edit the action details, the Brief
  form, a comment on an action, and Add research (the typed fields, not a fetched page's text, which can be fetched again). Cleared when
  sent or saved.
  ⚠ "Edit the action" and "Edit the action details" save through an API that returns nothing to the card. So the device copy is dropped
  when the box **matches the saved text again**: after a save that worked (the action re-reads), or Cancel. A refused save keeps it.
- Storage missing or throwing (a private window, blocked site data): every read and write is wrapped. The page works and simply does not
  restore. The check runs a page whose `localStorage` and `sessionStorage` throw.

### Found and fixed on the way (both measured in Chromium before the fix)

1. **Swiping the menu closed scrolled the page underneath it by a screen or more**, so the user's place moved. The page is now locked
   while the menu is open (and overscroll contained in the sheet). It has an assertion: open from the bottom bar at 300 px, swipe the
   sheet down, the page is still at 300.
2. **A restore's own scroll hid the top bar,** as if the user had scrolled down. Programmatic scrolls are now quiet. Assertion: after a
   reload that puts the scroll back, the bar shows.

### Measured, not passed — for Charlie's phone

In headless Chromium, after the sheet is closed **by a swipe**, the next tap is sometimes dropped: pointerdown and pointerup arrive,
but no click (2–3 of 5 in the check's own loop). Closing by tap or Esc never does this. I chased it through three hypotheses, each
measured and each wrong or only partly right:
- unmounting the sheet before the touch ended: deferring the close did not change it;
- `touch-action: none` on the sheet's header: switching to touch events cut it from 5/5 to 1–2/5;
- left-over gesture state from CDP's synthetic touch: a `touchCancel` flush stopped it after a drag-and-lift navigation, 0 of 8,
  against 1 in 4 without.

I cannot tell a synthetic-input effect from a real one here, so the check prints the rate as NOT RUN. §8's "swiping it back" on
Charlie's phone settles it. If it is real, it reads as "I tapped the bar and nothing happened, the first time".

### Decided while building (say if wrong)

- **The Creation screen (`/ideas/build`) is not in Z1.** It is one column already. The address can describe it (S1), but it has no
  bars yet.
- **Panel 1** is the desktop's stage bar and checklist, drawn as a panel. The menu shows the same lines.
- **Every panel stays mounted** (hidden when not shown), so a half-typed message or an open record survives a switch.
- **Panels 3 and 4** are separate panels in Focus view, although on the desktop they are two tabs of one half-column.

## Z1b — Charlie's phone findings (CCh's GO, 18 Nov 23:40)

Charlie: "It works but a little buggy. The different sections all work very well though and open up nicely when you touch them. The
desktop switched between focus and full nicely." Four changes. The dropped tap after a swipe-close (my measured residual) was not
reported on his phone; CCh said leave it.

### What a user sees now

1. **One bar, at the bottom (decision 353).** The top bar is gone. Before, you could only see it after scrolling all the way back up.
   The bottom bar has "Where am I?" on the left and the address ("S2 · C4 · P6") right-aligned. The menu rises from the bottom,
   Panel → Chapter → Stage. On a desktop in Focus view, W opens it from the bottom too.
2. **The bar stays on the screen's bottom edge.** The cause, found in the code: the bar was positioned from the *visual* viewport.
   When Edge's toolbar slid away, the bar stayed where the toolbar's edge had been, and page content showed underneath it. The bar is
   now `position: fixed; bottom: 0` on the layout viewport, with the safe-area inset. The visual viewport is read only for the
   on-screen keyboard, and only while you are typing with a gap of at least 150 px (`keyboardLift`). A toolbar is about 56 px; a phone
   keyboard is 250 px or more. Lex's panel is one screen tall (`100dvh` less the bar and the site header), or the part the keyboard
   leaves while you type.
3. **Tapping the address opens a panel that stays open.** It closes with Close, a second tap on the address, or Esc, and nothing
   else. It is a real bulleted list, one line per level:
   - S2: Stage 2 Development
   - C4: Chapter 4 Organising the actions
   - P6: Organising the actions

   "Working on" is gone everywhere: panel 6 is now named by its chapter, or by its record ("P6: #38").
4. **On a desktop (Full view and Focus view), the page opens at the workspace.** The stage bar and the checklist sit above it, out of
   view, and scrolling up reveals them. In Full view the workspace is exactly one screen tall under the site header, and the columns
   scroll inside it as before. A mouse wheel over a column at its top carries on to the page. Arrival is skipped when a remembered
   place has already scrolled the page, so "Back where you were" still wins. A panel never visited in desktop Focus view also opens at
   the workspace, not at the top of the page. When shown:
   - all seven stages are in one row at 768 px and up: the cards share the width and their state text is smaller;
   - each row has a label at its left, "Stages" and "Chapters", from `STAGEBAR_ROW_WORD`. Decision 352 may rename them in one line.

   Below 768 px, panel 1 is unchanged: the cards wrap and the row labels are not drawn.

### Decided while building (say if wrong)

- **"Spelled out the first time" (§2d)** used to be inline on the top bar. With that bar gone, the address panel opens by itself once,
  the first time on a device, and then only when tapped.
- **The site header was hiding things.** The site's own header (PublicNav) is sticky, so the shell now allows for it. Lex's panel, the
  record's jump band and the Organising strip stick below it rather than behind it, and the desktop arrival scrolls to just under it.
- **The Exit / How this works / Focus · Full toolbar is part of the workspace**, so it is in view on arrival. The run-in-progress banner
  and any error line moved from above the stage bar to the top of the workspace, so arrival does not scroll them out of view.
- **"Desktop" means 768 px and up**, the same breakpoint as Z1. The stage bar container widened from `max-w-3xl` to `max-w-5xl`, so
  the one row has room.

### The check (`check:lex-26z`, extended)

- **The harness page** is now built the way the workspace builds it, with the same hooks (`useSiteHeader`, `useArriveAtWorkspace`,
  `workspaceY`). It has a sticky 56 px site header, the stage bar above the workspace on a desktop, and `?hview=full` for three
  scrolling columns standing in for Full view.
- **New assertions per item:**
  - (1) no top bar; one button, on the left; the address right-aligned; both at least 44 px tall; at 360, 412, 768 and 1440.
  - (2) the bar's foot is the screen's foot, and the last row of pixels at both edges and the middle is the bar. Checked at 360 × 740
    and 360 × 796 (the toolbar shown and hidden), with a stand-in visual viewport reporting a 56 px toolbar gap, and with a 300 px
    keyboard while typing. The stand-in proves it is in place before the toolbar assertion counts. The first draft's stand-in never
    installed, and the toolbar assertion passed against the real viewport.
  - (3) it opens by itself the first time and not again; CCh's three lines exactly; a disc list with three lines stacked; no "Working
    on"; still open 2.6 s later and after a scroll; closed by a second tap, by Close and by Esc.
  - (4) at 768 × 1024, 1024 × 768 and 1440 × 900, in Focus and in Full: the stage bar is out of view on arrival; the Full workspace
    exactly fills the screen; the wheel scrolls a column and, at its top, the page; seven stages share one top; nothing is cut off
    sideways; the labels sit at the left of their rows. Control: on a 360 px phone the same bar wraps. A remembered place at 1440 wins
    over the arrival.
- **Mutations, each red then restored:**

  | Mutation | Failed assertions |
  |---|---|
  | M1: the address before the button | 4, one per width |
  | M2: the old whole-gap lift | 4 |
  | M3: the panel closes itself after 1.5 s | 2 |
  | M4a: the stage row as it was | 2 |
  | M4b: no arrival scroll | 9 |
  | M4c: nowrap without letting the cards shrink | 3, a horizontal page scroll at 768 among them |

  A first M4, `flex-nowrap` removed alone, stayed **green**: the row already fits because the cards may shrink. It was not a break,
  so it was replaced by M4a (both changes undone, which is the original bug) and M4c.
- **Taps.** Headless Chromium sometimes drops a synthetic tap after a CDP gesture. On 19 Nov two whole-suite runs on an idle machine
  each died on one at a different step: CCh's request to run Z1's check alone found this. Opening the menu, and the address tap after
  a drag, now try a second time when the first did not take, and every second try is counted and printed: 1 in the green run. The
  swipe-close rate is still printed as NOT RUN: 1 of 5 in that run.
