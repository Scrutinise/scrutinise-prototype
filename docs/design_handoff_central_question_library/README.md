# Handoff: Scrutinise Central — Question library

## Overview

Scrutinise Central is the navigation destination for everything a member does inside a community. This handoff covers the **Questions** area within it: a library of hard questions members meet in public life (doorstep, media interview, hustings, university AMA, council chamber), each with community-rated answers, plus a pack builder that turns a filtered slice of the library into a field aid for canvassing or training.

Five screens: question library (populated + empty), question detail, add a question, pack builder, pack output, and an admin overview across branches.

## About the Design Files

The files in this bundle are **design references created in HTML** — prototypes showing intended look and behaviour, not production code to copy. The task is to recreate them in `scrutinise-web`'s existing environment: Next.js App Router, React, Tailwind, and the shadcn-style primitives already in `components/ui/`. Do not port the inline styles; translate them to Tailwind classes and existing components.

The prototype is a single self-contained HTML file that runs in a browser with no build step. Open it to click through the flows — the left rail switches screens, and there is a desktop/mobile toggle.

## Fidelity

**High-fidelity.** Colours, typography, spacing and interaction states are final and were taken from the live tokens in `scrutinise-web/app/globals.css`. Recreate the UI faithfully using existing libraries and patterns.

Three deliberate departures from the current codebase, agreed with the design owner, which constitute a proposed upgrade to the generic V0-derived styling:

1. **Card radius moves from 6px (`--radius: 0.375rem`) to 12px.** One hairline border per card, no nested boxes inside.
2. **Teal is promoted from animation-only to the live-state accent.** In the current codebase teal appears only in accept animations. Here it marks live state: local example, pinned, rising, and step-completed. Navy remains the primary action colour.
3. **All counts set in tabular figures** (`font-variant-numeric: tabular-nums`) so numbers don't jitter as they change.

Nothing else in the palette or type stack changes. DM Sans and the navy primary stay exactly as they are.

## Navigation Structure

This was an explicit correction from the design owner and matters for routing:

- **Central** is a top-level nav item, sitting alongside Feed, Ideas and Library.
- Inside Central, the "in the community" areas are sub-tabs: **Questions**, Board, Training, Leaderboard.
- Personal concerns (managing which groups you're in, your points) are separate from these sub-tabs and sit at the Central level, not inside them.

Chrome: sticky white header, 1px bottom border `oklch(0.90 0.005 250)`. Top row holds the wordmark and primary nav; second row holds the sub-tabs. Active tab = `oklch(0.955 0.004 250)` background, inset 1px ring, weight 600. Inactive = transparent, `oklch(0.45 0.01 250)`, weight 500. Right side of the top row shows current branch name and a 28px round avatar.

Page stage is centred, `max-width: 1180px`, matching the existing `max-w-6xl`.

---

## Screens / Views

### 1. Question library

**Purpose.** Find the question you're about to be asked, and see the answer the community rates highest.

**Layout.** Single column at 1180px. Header row: title block left (20px/600 title, 13px muted description, max 520px) and two buttons right — "Add a question" (secondary, white, 1px border) and "Build a pack" (primary navy). Below: a filter block, then a result count row, then the question list at 10px gap.

**Filter block.** Row of controls at 8px gap that wraps: search input (38px tall, flex `1 1 220px`), topic select, sort select ("Top this month" / "Top all time" / "Newest"). Beneath, a wrapping row of context chips: All, Doorstep, Media interview, Hustings, University AMA, Council chamber. Active chip = navy fill, white text, weight 600. Inactive = white, 1px border, `oklch(0.3 0.01 250)`. All chips are pill radius (999px), `min-height: 34px`, `white-space: nowrap`. The block closes with a 1px bottom border.

Selecting a context filters the list live and updates the count line ("6 questions" / "2 questions in doorstep").

**Question row.** 1px border `oklch(0.90 0.005 250)`, 12px radius, white, 14px padding, 14px gap, items aligned to top. Hover raises border to `oklch(0.78 0.01 250)` and adds `0 1px 3px oklch(0.15 0.01 250 / 0.06)`.

Left: the vote control (see Interactions). Right, stacked at 8px:
- Question text — 15px/600, line-height 1.4, `letter-spacing: -0.01em`, `text-wrap: pretty`, ink coloured, links to detail.
- Answer preview — 13px, `oklch(0.42 0.01 250)`, line-height 1.55, with a 2px left rule in `oklch(0.90 0.005 250)` and 10px left padding. Omitted when the question has no answers yet.
- Meta row — tag pills (11px/500, 999px radius, `oklch(0.965 0.004 250)` fill, 1px `oklch(0.92 0.004 250)` border), then answer count, then two optional markers: "Has sources" with a navy 5px dot, "Local example" with a teal 5px dot and `#0f8b7f` text.

**Empty state.** Shown when a community has no questions. Centred in a 12px card, 44px vertical padding: a 44px teal-tinted rounded square holding "?", a 17px/600 heading "No questions here yet", 13px body copy at max 430px, a primary "Add the first question" button, and a muted secondary line offering 10 starter questions from Scrutinise's shared set. The copy frames the library as filling up from the doorstep rather than needing to be seeded by an admin.

**Mobile.** At 402px the "Build a pack" button becomes a sticky 48px bar at the bottom of the scroll area, over a white-to-transparent gradient, with a navy glow shadow.

### 2. Question detail

**Purpose.** Read the best answers, judge them, and add your own.

**Layout.** Back link, then a header block closed by a 1px rule: vote tally box (52px min width, bordered, 10px radius, showing ▲ / count / "VOTES" in 9px uppercase) beside an `<h1>` at 24px/600, `letter-spacing: -0.025em`, line-height 1.3. Below it, context and topic pills plus "2 answers · whole Community".

Then a section header row: "Answers" (13px/600) and "Ranked by weighted votes" right-aligned in muted 12px.

**Top answer card.** 12px radius, 1px border, 16px padding. Left column holds the up/down vote pair. Right column, stacked at 14px:
- Badge row — "TOP ANSWER" in 10px/600 uppercase, `letter-spacing: 0.07em`, `#0f8b7f` on `#14b8a614` with a `#14b8a63d` border, 5px radius; beside it the branch and age in muted 12px.
- Answer body — 16px, line-height 1.6, `text-wrap: pretty`.
- Sources — separated by a 1px top rule, an 11px/600 uppercase label then links at 13px.
- Local example — its own block: 10px radius, `#14b8a60f` fill, 1px `#14b8a64d` border with a 3px teal left border. Holds an uppercase `#0b6f66` label, 13px description, and a teal "Read the example" link. This is the strongest use of teal in the design and should stay visually distinct from sources.
- Action row — the favourite toggle (see Interactions), a "Private to you" hint in 11px muted, then "Suggest an edit" and "Report" pushed right.

**Second answer.** Collapsed to a single 12px card: vote tally, a 13px/500 summary line, branch and age, a favourite toggle and a "Show answer" button. Expanding it reveals the same structure as the top answer.

**Add an answer.** 12px card on `oklch(0.985 0.002 250)`. Label, a 3-row textarea (14px, line-height 1.55, focus ring `0 0 0 3px oklch(0.45 0.12 250 / 0.12)`), then a row with two dashed secondary buttons — "+ Add a source" (grey dashed) and "+ Add a local example" (teal dashed, `#0b6f66` text) — and a navy "Post answer" button pushed right.

### 3. Add a question

**Purpose.** Capture a question in the words it was actually asked, and route it to an existing question where one already exists.

Three steps shown as a pill row: "Write it", "Near matches", "Tags and scope". Current step = navy fill white text; completed = teal tint with `#0b6f66` text; upcoming = grey.

**Step 1.** 20px/600 heading "What were you asked?" with the instruction "Write it the way it was put to you, not the tidied-up version." A large textarea at 18px with the focus ring always on. Beneath, a teal dot and "Checking the library as you type" — the near-match lookup runs live, so step 2 is never a surprise. Primary "Continue".

**Step 2 — the near-match step.** This is the screen that carries the most design intent and the copy should not be softened in implementation. Heading: "Good news — three people have already been asked this". Body: "Your answer is worth more on a question people are already reading. Add it to one of these, or carry on and post yours as new."

The framing is a shortcut, never a rejection — the user is being offered a bigger audience, not told they duplicated something. Matches appear in a 12px card under a teal-tinted "CLOSE MATCHES" header: vote count in a 46px left column, question text at 14px/600, meta line, and a navy outline "Answer this one" button that inverts to filled navy on hover.

Below the card, an escape at equal visual weight: a white bordered "Mine is different — carry on" button, and reassurance in muted 12px — "Nothing is lost either way; you can move an answer later."

**Step 3.** Context chips (Doorstep preselected), a topic select, and a scope choice as two radio cards: "The whole Community" (selected, navy border, navy 5% fill) and "Riverside branch only". Each carries a 12px explanatory line. Closes with a 1px top rule, a navy "Post question" and a secondary "Back to the start".

### 4a. Pack builder

**Purpose.** Turn the current filter into a printable or pocketable top-N pack.

**Layout.** `grid-template-columns: repeat(auto-fit, minmax(290px, 1fr))`, 16px gap, items aligned to start. Left column holds three stacked 12px cards; the preview spans two columns.

**Filters carried over** — read-only summary of Context, Topic, Ranked by, Scope as label/value rows, with a "Change filters" link back to the library. The pack always inherits the library's current filter rather than asking the user to re-specify it.

**Pack size** — three equal-width buttons, Top 10 / Top 25 / Top 50, styled as square-cornered (8px) chips. Below, a line reconciling the request with reality: "The library holds 6 questions matching these filters, so this pack is 6 of a possible 10."

**Include with each question** — checkboxes: Top answer (on), Sources (on), Local examples (off), and **Favourite answers** (on). The last is separated by a 1px top rule and carries the explanation "Where you've favourited an answer, yours is used instead of the top-voted one. Private to you — nobody else sees which you picked."

**Live preview** — a 12px card, header showing "Live preview — N questions" and the pinned count. Each row: index number in a 22px right-aligned column, question text at 14px/500, meta line, then "Pin" and "Remove" buttons. Pinned rows take a `#14b8a60a` background and the pin button goes teal. Rows where a favourited answer will be substituted show a navy outline pill: "★ Your favourite answer". Footer explains "Pinned questions stay put when the ranking moves" and offers Reset.

### 4b. Pack output — three directions

Presented side by side for comparison, full 1180px width, no app chrome. Each shows a 340px phone (10px `oklch(0.2 0.01 250)` bezel, 32px radius) with a title, letter badge and one-line rationale.

**A — Glance cards.** One question per screen, question-first. Progress counter "2 / 10" and a 2px teal progress bar. Question at 22px/600. Answer opening under a "BEST ANSWER" label, visible without tapping. Bottom row: 44px back and forward buttons at the screen edges with "Local example ready" between them. For a doorstep conversation where you glance and look up.

**B — Answer-first flashcards.** Dark shell (`oklch(0.15 0.01 250)`), white card inset. The question is demoted to 12px muted; the line you would actually say is the card at 19px/500. Bottom: "Sources" outline button and a teal "Next question" button. For rehearsal, and for the moment when you need words rather than context.

**C — Continuous list.** The whole pack on one thumb. Sticky header, numbered rows with question at 14px/600 and a 12px preview, hairline separators. Footer holds "Jump to…" and a navy "Save offline". Closest to the print sheet, best for training.

**Print sheet (A4).** 794px wide, 56/64px margins. Header: uppercase 11px kicker "Scrutinise Central · Riverside branch", 26px/600 title "Doorstep pack — top 6", date and ranking right-aligned, closed by a 2px ink rule. Each entry: a 34px column holding the number at 22px/600 in `oklch(0.78 0.01 250)`, then question at 16px/600, answer at 14px/1.6, and an 11px meta line noting sources and local examples. Footer in 10px: "Private to this Community. Answers are community-rated, not official positions."

### 5. Across branches

**Purpose.** Let Community admins see what each branch is valuing, without surveilling individuals.

Header with a period select (This week / month / quarter). A strip of four figures at 24px/600 tabular — Branches active, Questions live, Answers posted, Members voting — bounded by 1px rules top and bottom. Then a responsive grid (`minmax(280px, 1fr)`, 14px gap) of branch cards: name, a stats line, "TOP VOTED" and a teal "RISING" section separated by a hairline. Low-activity branches carry a neutral "Quiet week" pill — deliberately not red or alarming.

Closing note, and this constraint should survive implementation: "Counts are participation only. No per-member activity is shown here, and nothing on this page is visible outside the admin group."

---

## Interactions & Behavior

### Question votes — "I've been asked this too"

One vote per user per question. The control is **upvote only**; there is no downvote on a question, because the vote records frequency ("I get asked this"), not quality.

- Control: 48px wide, 48px min height, 10px radius, 1px border, holding a ▲ glyph above the count.
- Hover shows a tooltip below the button: **"Click if you've been asked this question too"** — 178px wide, ink background, white 11px text, 8px radius, fading in over 120ms.
- Clicking increments by one and turns the control navy with a 7% navy fill. Clicking again removes the vote. When voted, the tooltip changes to **"You've told us you've been asked this. Click to undo."**
- The hovered control lifts to `z-index: 20` so its tooltip is never clipped by adjacent rows.

### Answer votes — quality

One vote per user per answer, up **or** down, mutually exclusive.

- Control: stacked ▲ / count / ▼, each button 44×36px with the pair rounded as one unit (8px outer corners, 4px inner).
- Hover on the group shows a tooltip to the right: **"Click arrows to vote up or down"**.
- Up applies navy border, 8% navy fill, navy glyph. Down applies `oklch(0.55 0.22 25)` border, 7% fill, red glyph.
- Switching from up to down moves the count by 2, not 1 — the previous vote is withdrawn, not stacked. Clicking the active direction again clears the vote and restores the base count.

### Favourites — private

One favourite per user per answer, and **private**: no shared count, no visibility to other members, no effect on ranking. This is the user's own shortlist.

- Control: a bordered pill with a star glyph and label. Off = ☆ / "Favourite", white, grey border. On = ★ / "Favourited", navy border, 7% navy fill, navy text, weight 600.
- The top answer's favourite button sits in the action row beside a persistent "Private to you" hint. Collapsed answers carry the same control beside "Show answer".
- The only place favourites surface is the pack builder: with "Favourite answers" ticked, any question where the user has favourited an answer uses that answer in the pack instead of the top-voted one, flagged in the preview with "★ Your favourite answer".

Because favourites are private, they must never be aggregated, displayed as a count, or exposed through any admin view — including screen 5.

### Other behaviour

- Context chips filter the list immediately and update the result count.
- Pin and Remove in the pack builder mutate the preview live; Reset restores the default selection.
- Add-a-question steps advance forward only, with "Back to the start" as the reset.
- All tooltips are hover-only. On touch, the labels are not reachable, so the controls must be self-evident without them — which is why the vote control shows an explicit ▲ and the favourite shows a labelled star rather than a bare icon.

## State Management

Prototype state, as a guide to what the real implementation needs to track:

| State | Type | Purpose |
| --- | --- | --- |
| `screen` | enum | Prototype navigation only; becomes routes in the real app |
| `device` | enum | Prototype viewport toggle; not a product feature |
| `empty` | boolean | Prototype toggle between populated and empty library |
| `context` | string | Active context filter, `'All'` or a context name |
| `votes` | map keyed by question | Whether the current user has voted this question |
| `answerVote` | `-1 | 0 | 1` | Current user's vote on an answer |
| `favourites` | map keyed by answer | Current user's private favourites |
| `favOption` | boolean | "Favourite answers" toggle in the pack builder |
| `size` | number | Pack size, 10 / 25 / 50 |
| `pinned` | map keyed by question | Questions pinned in the pack |
| `removed` | map keyed by question | Questions removed from the pack |
| `addStep` | 1–3 | Add-a-question step |
| `hoverTip` / `answerTip` | id / boolean | Which tooltip is showing |

Data the real implementation needs: questions with text, tags, context, topic, scope, vote count and answer count; answers with body, author branch, age, vote count, sources and optional local example; per-user vote and favourite records; and for screen 5, per-branch aggregates over a selectable period.

The near-match lookup on add-a-question needs a similarity search over existing question text, running as the user types.

## Design Tokens

Sourced from `scrutinise-web/app/globals.css` unless marked as new.

**Colour**

| Role | Value |
| --- | --- |
| Ink / foreground | `oklch(0.15 0.01 250)` |
| Muted text | `oklch(0.45 0.01 250)` |
| Secondary muted | `oklch(0.5 0.01 250)`, `oklch(0.55 0.01 250)` |
| Body text on cards | `oklch(0.3 0.01 250)`, `oklch(0.42 0.01 250)` |
| Primary (navy) | `oklch(0.45 0.12 250)` |
| Primary hover | `oklch(0.39 0.12 250)` |
| Primary tint | `oklch(0.45 0.12 250 / 0.07)` and `/ 0.08` |
| Focus ring | `0 0 0 3px oklch(0.45 0.12 250 / 0.12)` |
| Border | `oklch(0.90 0.005 250)` |
| Border, subtle | `oklch(0.92 0.004 250)`, `oklch(0.955 0.004 250)` |
| Border, hover | `oklch(0.78 0.01 250)` |
| Page background | `oklch(0.955 0.004 250)` |
| Card background | `#ffffff` |
| Recessed panel | `oklch(0.985 0.002 250)` |
| Chip fill | `oklch(0.965 0.004 250)` |
| Destructive / downvote | `oklch(0.55 0.22 25)` |
| Teal accent | `#14b8a6` |
| Teal text | `#0f8b7f`, `#0b6f66` |
| Teal fills | `#14b8a60a`, `#14b8a60f`, `#14b8a614` |
| Teal borders | `#14b8a633`, `#14b8a63d`, `#14b8a64d`, `#14b8a680` |
| Dark shell (flashcards, bezel) | `oklch(0.15 0.01 250)`, `oklch(0.2 0.01 250)` |

**Typography.** DM Sans throughout, weights 400/500/600/700, loaded from Google Fonts.

| Use | Size / weight / tracking |
| --- | --- |
| Page h1 (detail) | 24px / 600 / `-0.025em` / 1.3 |
| Screen title | 20px / 600 / `-0.02em` |
| Print sheet title | 26px / 600 / `-0.025em` |
| Glance card question | 22px / 600 / `-0.02em` / 1.3 |
| Flashcard answer | 19px / 500 / 1.5 |
| Answer body | 16px / 400 / 1.6 |
| Question row title | 15px / 600 / `-0.01em` / 1.4 |
| Body and controls | 13–14px / 400–500 |
| Meta and captions | 11–12px |
| Uppercase labels | 10–11px / 600 / `0.07em` |
| Print kicker | 11px / `0.12em` |

All counts use `font-variant-numeric: tabular-nums`. All multi-line prose uses `text-wrap: pretty`.

**Radius.** 12px cards · 10px inset blocks and vote controls · 8px buttons, inputs, selects, tooltips · 7px small buttons and tabs · 6px badges · 999px pills · 32px phone bezel.

**Spacing.** 4 / 6 / 8 / 10 / 12 / 14 / 16 / 18 / 20 / 26 px. Screen padding 20px, stage padding 28px 32px. Card padding 14–16px. Print sheet 56px 64px.

**Control heights.** 48px primary mobile actions and vote controls · 44px touch targets (never below) · 40px desktop primary buttons · 38px inputs and selects · 34px chips and small buttons · 32px tertiary buttons.

**Shadow.** Card hover `0 1px 3px oklch(0.15 0.01 250 / 0.06)` · frame `0 6px 28px oklch(0.15 0.01 250 / 0.08)` · phone `0 8px 24px oklch(0.15 0.01 250 / 0.14)` · tooltip `0 4px 14px oklch(0.15 0.01 250 / 0.22)` · print sheet `0 4px 20px oklch(0.15 0.01 250 / 0.08)` · sticky mobile CTA `0 2px 8px oklch(0.45 0.12 250 / 0.28)`.

## Content

All question and answer copy in the prototype is placeholder written to be realistic, not final. Answer previews are deliberately truncated mid-sentence with an ellipsis to signal that they are openings rather than complete answers. Questions 4–6 carry no preview at all, because no answer copy was supplied for them — treat missing previews as a real state to design for, not an oversight.

The empty state, the near-match step and the privacy notes are the copy most worth preserving verbatim; they carry the product's intent.

## Assets

None. No images, icons or illustrations. Glyphs (▲ ▼ ★ ☆ ← →) are Unicode characters set in DM Sans. If the codebase has an icon set, substitute equivalents — but keep the star filled/outlined distinction for favourites and the solid triangles for votes.

## Files

| File | What it is |
| --- | --- |
| `Scrutinise Central - Question library.dc.html` | The prototype. Open in a browser; the left rail switches screens. |
| `support.js` | Runtime the prototype needs to render. Keep it beside the HTML. |
| `github.md` | Records the source repo, branch, and which repo files each screen was built from. |

## Repository context

Built against `Scrutinise/scrutinise-prototype`, branch `Main`, subtree `scrutinise-web`. Relevant existing files:

- `app/globals.css`, `tailwind.config.js` — the tokens above
- `components/ui/button.tsx`, `components/ui/card.tsx` — primitives to extend
- `app/communities/[id]/CommunityDashboardClient.tsx` — where Central's chrome and sub-tabs live
- `app/communities/[id]/Leaderboards.tsx` — existing vote and period-selector patterns
- `app/communities/[id]/BulletinBoard.tsx` — existing empty-state and card patterns

If the three fidelity departures above are adopted, the same treatment should be applied to BulletinBoard, TeamsTree and Leaderboards so the dashboard stays consistent: those panels lose their nested borders and share one 12px card shell.
