# BRIEF 26-Z — LEX: Where am I? — mobile, Focus view, and never losing your place

**From CCh-Lex, 17 November 2026.** Decisions 344–348, as amended by Charlie the same evening (§1). Charlie, on mobile: *"The 7 stages dominate and give no signposts to how to navigate this page. It's not obvious how to scroll even … I have about 10mm window on what I'm trying to edit."* Independent of 26-Y; may run in parallel only in a separate worktree (one session per tree).

---

## §0 Run mode

- As BRIEF_26S §0: continuous; CHANGE_LOG; report `docs/LEX_26Z_REPORT.md`; stop only for spend or scope; one session per tree; WIP on `wip/26z` before any idle; Charlie's phone is the last check.
- **Size first; two parts expected.** **Z1** = §2 the structure, §3 the Where am I? menu, §4 the mobile layout and gestures, §5 Focus view, §6.1–6.2 remember your place. **Z2** = §6.3 offline reading (service worker, cached last view, queued edits) and §6.4 installable app. Report the split.
- **Labels in `screen-labels.ts`; a field-guide entry for every new control.** Shape + word, never colour alone. Touch targets ≥ 44 px. No layout that needs two panels side by side below 768 px.
- **Test on real widths** in the browser checks: 360 × 740 (phone), 412 × 915 (large phone), 768 × 1024 (tablet), plus desktop; and touch events, not only clicks.

---

## §1 Decisions

| # | Decision |
|---|---|
| 344 | **Stage / Chapter / Panel** is the navigation structure. Address shown as "S2 · C5 · P6", spelled out in words the first time a user sees it ("Stage 2 Development · Chapter 5 Drafting · Panel 6 Working on #38") and on hover/long-press thereafter |
| 345 | **Mobile shows one panel at a time.** The top bar and the bottom bar each carry **one button only: "Where am I?"** (Charlie's amendment). The top bar hides on scroll down and returns on scroll up |
| 346 | **"Where am I?" is a dynamic menu in three levels — Stage, Chapter, Panel.** As the finger moves over a level it opens to show that level's detail. Stages and chapters show as lists with their state; **panels show as visual blocks** (a small picture of the desktop layout with the seven panels). Opened from the **top bar** it runs **Stage → Chapter → Panel** downwards; opened from the **bottom bar** it runs **Panel → Chapter → Stage** upwards, so the nearest level is always under the thumb |
| 347 | **Focus view on desktop is identical to the mobile view** (one panel, the two Where am I? buttons, the same gestures by keyboard). **Full view** is today's three columns, where panels can already be hidden |
| 348 | **Never lose your place.** Remember position and unsent typing on the device (Z1); offline reading of the last view with edits queued (Z2) |
| — | **Gestures (Charlie's amendment):** swipe **left** → the last panel chosen (back); swipe **right** → forward if there is a forward, otherwise **Where am I?** |

---

## §2 The structure

**2a. Stages (7):** Creation · Development · Private Scrutiny · Public Scrutiny · Promotion · Submission · In Force — from `SEVEN_STAGES`. Sentence: *"Your idea passes through 7 stages from creation to enactment."*

**2b. Chapters (7), within Development:** Problem · Causes · Guiding policy · Organising · Drafting · The Deepening · Promotional plan — from the Development checklist (26-X §3), each with its state line and lock. Sentence: *"Within the Development stage you have 7 chapters to develop a mature proposal."* Outside Development, the Chapter level shows that stage's content (e.g. Private Scrutiny: "not yet open") rather than Development's chapters.

**2c. Panels (7):** 1 Where am I? · 2 To-do · 3 Lex · 4 Notes · 5 Chapters (the list to work on) · 6 The open chapter or record · 7 Research and sources. Sentence: *"Tap a panel to work in it."* Each panel's block in the visual shows where it sits on the desktop (left / centre / right).

**2d. The address** "S2 · C5 · P6" is derived from the URL state (stage, `section`/`view`, panel, `#N`), so it is shareable and survives a reload. A deep link opens the right panel on mobile.

---

## §3 The Where am I? menu (346)

- **Open:** tap either bar's button; opens as a sheet from that edge (top sheet / bottom sheet), covering the panel, dismissable by tapping outside, the button again, or swiping it back.
- **Levels and order:** top → Stage, Chapter, Panel; bottom → Panel, Chapter, Stage. Each level shows its current item marked (● + "You are here").
- **Dynamic detail:** moving the finger over (or focusing, on desktop) a level expands it: Stage → the seven with state lines; Chapter → the seven with states and the lock; Panel → the visual of seven blocks. Lifting the finger on an item goes there. A plain tap also works (expand on first tap, go on second), for users who don't drag.
- **Accessibility:** every item reachable by keyboard and screen reader in the same order; the visual blocks carry text labels ("Panel 3 · Lex · left on desktop").
- **The first-time explainer:** the three sentences of §2 shown once at the top of the menu, with "Got it" to collapse them; re-openable from a "?" in the menu.

---

## §4 The mobile layout (345)

- **Below 768 px:** one panel fills the screen between the two bars. No side-by-side columns, no fixed-height inner boxes that trap scroll; the page scrolls naturally. The record's own sticky jump band (256) stays, under the top bar.
- **Top bar:** one line, "Where am I?" plus the address ("S2 · C5 · P6"); hides on scroll down, returns on scroll up.
- **Bottom bar:** "Where am I?" only, fixed, clear of the phone's home indicator (safe-area insets).
- **Gestures:** swipe left = back to the last panel chosen (a per-session history stack); swipe right = forward if any, else open Where am I? A horizontal swipe must not fire inside a horizontally scrollable element (a table, the board); the threshold and the exclusion are tested.
- **Panel 5 → 6:** choosing a chapter or an action in panel 5 opens it in panel 6; back returns to 5 at the same scroll.
- **Lex (panel 3):** the typing box sits above the bottom bar and above the on-screen keyboard (visual viewport handling), never behind either.

---

## §5 Focus view (347)

- A toggle in the desktop header: **Focus view · Full view**, remembered per browser.
- **Focus view** renders exactly the mobile composition at desktop size (one panel, centred, max width ~760 px; both bars; the same menu). Keyboard: ← / → for back/forward, `W` (or `Esc` then `W`) opens Where am I?
- **Full view** is unchanged.
- One component tree for mobile and Focus view; the breakpoint simply forces Focus below 768 px.

---

## §6 Never lose your place (348)

**6.1 Position (Z1).** On every change of stage, chapter, panel, open record, filter, and on scroll (throttled), save to the device: the address, the open record, the panel's scroll offset, the board/list choice, the find box. On load, restore it before first paint where possible; show "Back where you were" briefly. Wrapped in try/catch; works with storage unavailable (simply doesn't restore).

**6.2 Unsent typing (Z1).** Every text box that can hold unsaved text (Lex's message, Edit the action, Edit the action details, the Brief fields, comments, Add research) keeps a draft on the device, keyed by idea + field, cleared on successful save. After a reload: "You had unsent text here — restore it?" Never auto-submitted.

**6.3 Offline reading (Z2).** A service worker caches the app shell and the last-fetched data for pages the user has opened. Offline, a reload shows the cached view marked "Offline — last updated 14:02"; controls that write are disabled with that reason, or queue (Lex messages and edits) with "will send when you're back online" and a count; on reconnection, queued writes go in order, each through its normal route and refusal rules (a conflict is reported in words, never silently overwritten).

**6.4 Installable (Z2).** A web app manifest and icons, so "Add to Home Screen" gives a full-screen app; standalone display; theme colours with sufficient contrast.

---

## §7 Verification — `check:lex-26z`

1. At 360 px: one panel only; no element wider than the viewport; the page scrolls; top bar hides/returns on scroll (browser, touch).
2. Where am I? from top: order Stage → Chapter → Panel; from bottom: Panel → Chapter → Stage; the current item marked; drag-over expands; tap-tap works; keyboard and screen-reader order matches.
3. Panel level renders seven labelled blocks; tapping each opens that panel.
4. Gestures: left = last panel; right = forward else Where am I?; no swipe fires inside a horizontally scrollable table (fixture).
5. Address "S2 · C5 · P6" matches the URL state; a deep link opens the right panel at 360 px; spelled out on first sight only.
6. Focus view at 1440 px renders the same composition as 360 px (DOM structure compared) and Full view is unchanged.
7. 6.1/6.2: reload restores panel, record and scroll; a typed Lex message survives a reload and is offered back, never sent; storage-blocked context still loads.
8. Z2: offline reload shows the cached view with its time; a queued edit sends on reconnect through the normal route; a conflict is reported.
9. Regression: 26-X suites, 26-W-b (field guide covers new labels), prompt-examples.

## §8 Only Charlie can confirm

On his phone: the two Where am I? buttons; dragging through the menu from the top and from the bottom; the panel blocks; swiping back and forward; editing an action with the keyboard up; leaving the browser and coming back (on a plane, for Z2).

## §9 Not in this sprint

Native apps; push notifications; offline Lex (it needs the network by nature).
