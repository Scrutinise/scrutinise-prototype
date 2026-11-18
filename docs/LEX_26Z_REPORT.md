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
