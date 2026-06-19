# V2-HOMEPAGE-RESTRUCTURE-2 — CC Brief (follow-up)

**Sprint:** V2-HOMEPAGE-RESTRUCTURE-2 **Scope:** Four refinements to the homepage restructure deployed in V2-HOMEPAGE-RESTRUCTURE. **Estimated size:** Very small. Copy and layout adjustments only.

***

## Context

V2-HOMEPAGE-RESTRUCTURE has been deployed. Charlie has reviewed and identified four refinements needed.

***

## Change 1 — Hero intro paragraph width

The intro paragraph under the "Shape the Nation" headline currently spans the full content width.

Constrain its width to match the width of the Five Steps graphic that sits below it, so the two elements visually align as a column. Apply the same constraint to the bold "How will you use it?" line and the four navigation buttons row, so the entire hero text-and-button stack reads as one centred column matching the graphic's width.

If the Five Steps graphic uses a max-width container, reuse the same value. The intro paragraph itself can remain centre-aligned text (or left-aligned if that matches the graphic's internal alignment — pick whichever looks cleaner).

## Change 2 — Restore "The Five Steps" title and reorder the subtitle

Currently the Five Steps area in the hero shows the graphic followed by the subtitle and CTAs. The "The Five Steps" title was lost in the V2-HOMEPAGE-RESTRUCTURE refactor and needs restoring.

Final order of the Five Steps area, top to bottom:

1.  **Heading: "The Five Steps"** (restore — use the same heading style as before)
2.  **Subtitle: "Turn any idea into Parliament-ready law in 5 stages"** (moved from below the graphic to above it)
3.  **The Five Steps graphic** (the numbered 1–5 Create / Draft / Develop / Campaign / Legislate sequence)
4.  **CTAs: "Get Started" and "Vote" buttons** (unchanged position — directly below the graphic)

So the order changes from `graphic → subtitle → CTAs` to `title → subtitle → graphic → CTAs`.

## Change 3 — Reorder: "Quality legislation — open sourced" above "The Five Steps"

Currently the block order is:

1.  Hero (containing Five Steps)
2.  Quality legislation — open sourced
3.  What is it?
4.  ...

The Five Steps area should sit **after** "Quality legislation — open sourced", not within the hero before it.

Move the entire Five Steps area (title, subtitle, graphic, CTAs) **out of the hero** and place it as its own block **after** the "Quality legislation — open sourced" block.

New block order:

1.  Hero — "Shape the Nation" + intro paragraph + "How will you use it?" + four navigation buttons (Five Steps area removed)
2.  Quality legislation — open sourced
3.  **The Five Steps** (title, subtitle, graphic, CTAs)
4.  What is it?
5.  Who is it for?
6.  How does it work?
7.  Stay calm and move quickly through the chaos
8.  Is this you?
9.  If you're serious about wanting a better-run country
10. Footer

## Change 4 — Copy edit in "How does it work?"

In the third paragraph of the "How does it work?" block, change:

>   The scrutiny is human. Every serious proposal needs people with real experience to pressure-test it — to catch **the dumb thing** before it becomes law, to bring the perspective the AI can't.

To:

>   The scrutiny is human. Every serious proposal needs people with real experience to pressure-test it — to catch **that embarrassing mistake** before it becomes law, to bring the perspective the AI can't.

***

## Acceptance criteria

1.  The intro paragraph, "How will you use it?" line, and four navigation buttons in the hero are width-constrained to match the Five Steps graphic width below them.
2.  "The Five Steps" title is visible above the subtitle and graphic.
3.  Subtitle "Turn any idea into Parliament-ready law in 5 stages" sits between the title and the graphic.
4.  "Quality legislation — open sourced" block appears before "The Five Steps" block in the page flow.
5.  "How does it work?" reads "that embarrassing mistake" not "the dumb thing".
6.  Mobile rendering remains correct — the width constraint should not break narrow viewports.
7.  Lighthouse / Vercel build passes; no TypeScript errors.

## Git discipline

CC does **not** call git during this sprint. At the end of the sprint, CC produces `commit-all.sh` in the project root containing:

-   All `git add` commands for files modified
-   A single commit with message `V2-HOMEPAGE-RESTRUCTURE-2: Hero width, Five Steps title and reorder, copy edit`
-   `git push origin Main` (capital M)

Charlie reviews the Vercel preview deployment. After Charlie approves, CC executes `commit-all.sh` immediately, then deletes it.

## Out of scope

-   Any further copy changes
-   Restyling of the Five Steps graphic itself
-   Any changes to Block 7 / Block 8 overlap (Charlie has noted this for a later pass)
