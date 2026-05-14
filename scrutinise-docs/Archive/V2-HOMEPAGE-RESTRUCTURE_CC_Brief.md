# V2-HOMEPAGE-RESTRUCTURE — CC Brief

**Sprint:** V2-HOMEPAGE-RESTRUCTURE **Scope:** Homepage copy and structure rewrite. No new components, no schema changes, no API changes. Pure content and section reordering on the marketing homepage. **Estimated size:** Small. One file (the homepage component) and any block-level child components if the existing structure splits into them.

***

## Context

Charlie has rewritten the homepage narrative to ground the proposition more honestly, give MPs and policy entrepreneurs equal billing, and surface the human–AI partnership as a first-class explanation rather than a buried feature. The current page tries to do too many things in the second section and buries the MP audience further down. This sprint resolves that.

There is **no functionality change**. This is pure content restructuring of the existing marketing homepage at `scrutinise.org/`.

***

## Final block order after this sprint

1.  Hero — new headline and intro copy with four navigation buttons
2.  "Quality legislation — open sourced" (the existing video block, moved up)
3.  "What is it?"
4.  "Who is it for?"
5.  "How does it work?"
6.  "Stay calm and move quickly through the chaos" (existing Parliament video block)
7.  "Is this you?" — wrapper title for what is currently the "Be the engine of the change..." block
8.  "If you're serious about wanting a better-run country" (existing block, moved down)
9.  Footer (unchanged)

The current "Scrutinise is a vision and a tool" block is **deleted entirely**. The current "MPs and the road to legislative excellence" block is **deleted as a standalone block** — its bullet points are absorbed into the new "Who is it for?" block. The current "Five Steps" block is **deleted from its current position** — the heading and graphic move into the hero area as described below.

***

## Block 1 — Hero (rewrite)

### Heading

Change from:

>   Master legislation. Shape the nation

To:

>   Shape the Nation

### Subtitle and CTAs

**Remove** the subtitle "Turn any idea into Parliament-ready law in 5 stages" from the hero. **Remove** the "Get Started" and "Vote" buttons from the hero.

Both move into the Five Steps area (see below).

### New body copy directly below the "Shape the Nation" headline

>   Scrutinise is a tool and collaboration platform for those committed to transforming how our countries are governed. A platform designed to support a Movement: individuals challenging the inertia of entrenched systems, working to create laws and policies that truly serve the people.

Then on a new line, in **bold**:

>   How will you use it?

### Four navigation buttons below the bold question

Render four buttons that scroll-anchor to the corresponding sections further down the page. Use smooth-scroll behaviour. Style consistent with existing button styling but visually distinct from the primary CTAs that will sit in the Five Steps block (suggest secondary/outline style — confirm with existing design system).

| Button label      | Anchor target       |
|-------------------|---------------------|
| What is it?       | `#what-is-it`       |
| Who is it for?    | `#who-is-it-for`    |
| How does it work? | `#how-does-it-work` |
| Is this you?      | `#is-this-you`      |

### Five Steps graphic (relocated within hero area)

Below the four navigation buttons, render the existing "Five Steps" graphic (the numbered 1–5 Create / Draft / Develop / Campaign / Legislate sequence currently in its own block).

Directly below the graphic:

-   The relocated subtitle: **"Turn any idea into Parliament-ready law in 5 stages"**
-   Below that, the two relocated CTA buttons: **"Get Started"** (primary, links to `/ideas/create`) and **"Vote"** (secondary, links to `/prototype/browse`).

Use existing button styles and link targets — these are unchanged from the current hero.

The "How it works" small heading currently sitting above the Five Steps in the source page is **removed** — the graphic now sits within the hero context and doesn't need its own pre-heading.

***

## Block 2 — "Quality legislation — open sourced" (moved up)

This is the existing video block currently appearing further down the page (the Pexels video at `videos.pexels.com/video-files/3129671/3129671-uhd_2560_1440_30fps.mp4` with the caption "Citizens crafting legislation, one idea at a time").

Move it to position 2. No content changes. Preserve existing styling, video source, and caption.

***

## Block 3 — "What is it?" (new)

Anchor id: `what-is-it`

### Heading

>   What is it?

### Body copy

>   Legislation is how the country actually changes. But even for MPs, the process can be opaque and challenging.

>   Scrutinise is an AI-guided workspace that takes you through the process step by step. Lex, our AI guide and researcher, helps you think clearly, find the right evidence, sharpen your argument, and identify the legislation that needs to change.

>   What you get at the end is a proposal that's been properly thought through, scrutinised, and ready to put into the hands of those in Parliament who can help take it forward. What happens there is their job. Getting it there in a form they can trust is ours.

Use standard prose styling — no bullets, no callouts. Three paragraphs.

***

## Block 4 — "Who is it for?" (new)

Anchor id: `who-is-it-for`

### Heading

>   Who is it for?

### Body copy

>   This is for the committed few — thought leaders, parliamentarians, and those passionate enough to act — who believe change is possible and are ready to engage deeply with the complexities of governance to make a lasting impact… who believe in duty and putting quality before 'clicks'.

Then a sub-block formatted with a bold lead-in:

>   **For MPs and their teams:** a structured workspace to develop policy, co-ordinate candidates, councillors, and outside experts, and build a pipeline of Parliament-ready proposals — with a central view of everything in flight.

Below this paragraph, render these four bullet points (taken from the deleted "MPs and the road to legislative excellence" block):

-   Your own team of trained researchers at no cost
-   Build a policy portfolio that positions you for power
-   Mentor candidates into legislators-in-waiting
-   Battle-test and strengthen your policy positions

Then the second sub-block:

>   **For policy entrepreneurs and experts:** an AI guide through a process most people never see inside, that helps you structure a credible proposal and connect with others who can scrutinise and strengthen it.

No bullet list under this second sub-block.

***

## Block 5 — "How does it work?" (new)

Anchor id: `how-does-it-work`

### Heading

>   How does it work?

### Body copy

>   This is a human–AI partnership by design. Our goal is to make meaningful change faster, smarter, and more accessible — amplifying the collective power of those dedicated to high-quality governance.

>   The AI does the structural work — research, drafting, finding the relevant legislation, organising the argument, checking for logical and evidential flaws. That's the part that used to take weeks and now takes hours.

>   The scrutiny is human. Every serious proposal needs people with real experience to pressure-test it — to catch the dumb thing before it becomes law, to bring the perspective the AI can't.

>   Scrutinise lets you build your own network of people you trust to scrutinise your work privately, and as the platform grows, those networks help each other. The goal is to fix, earlier, what most of our bad laws have in common: not enough people who knew what they were talking about looked at them hard enough, soon enough.

>   This platform alone won't turn a weak idea into a strong one. But if you have something worth saying, it will help you say it properly — and put it somewhere it can be found, scrutinised, and backed.

Use em-dashes (—) not double hyphens. Use the curly ellipsis (…) where written above. Five paragraphs.

***

## Block 6 — "Stay calm and move quickly through the chaos" (existing, relocated)

This is the existing Parliament video block (R2 video at `pub-74d3bbbcb050497b8a69f8c0045bb893.r2.dev/Grok_Parliament_Ready_video.mp4`).

No content changes. Preserve existing styling, video source, and heading. Confirm correct ordering after Block 5.

***

## Block 7 — "Is this you?" (new wrapper title for existing content)

Anchor id: `is-this-you`

### Heading

>   Is this you?

### Body content

The body of this block is the existing "Be the engine of the change you want to see in the world" content, currently the last text block on the page:

>   A 'policy entrepreneur' is someone who identifies a challenge that can be overcome through changes in legislation or government operations and then builds the coalition, the evidence, and the argument to fix it. They don't wait for permission.

The existing sub-heading "Be the engine of the change you want to see in the world" can either be retained as a sub-heading under "Is this you?" or removed — Charlie's preference TBD. **For this sprint, retain it as a sub-heading** to preserve continuity; can be revisited later.

***

## Block 8 — "If you're serious about wanting a better-run country" (existing, moved down)

The existing block currently appearing above "Be the engine of the change":

>   Scrutinise is a civic technology platform for 'policy entrepreneurs' — legislators, experts and engaged citizens.

>   Develop, test and refine your good ideas to help build better legislation and stronger public systems.

>   We are building an online community around craft, expertise and a common interest in better quality laws and government.

No content changes. Move to position 8.

***

## Footer

Unchanged.

***

## Implementation notes

-   Anchor scrolling: implement smooth-scroll on the four hero navigation buttons. If the existing site already has smooth-scroll behaviour configured globally (e.g. `scroll-behavior: smooth` on `html`), the buttons just need correct `href="#anchor-id"` values. If not, add the CSS rule.
-   Section ids must match exactly: `what-is-it`, `who-is-it-for`, `how-does-it-work`, `is-this-you`.
-   Em-dashes (—) and curly ellipsis (…) in the copy must be preserved as Unicode characters, not converted to `--` or `...`.
-   The apostrophe in 'clicks' and 'policy entrepreneur' should be a curly apostrophe (') matching existing site typography conventions.
-   No changes to nav bar, footer, routing, or any non-homepage page.
-   No new dependencies.

## Acceptance criteria

1.  Visiting `scrutinise.org/` shows the new hero with "Shape the Nation" as the H1 and the new intro paragraph.
2.  The four navigation buttons in the hero scroll smoothly to the correct sections.
3.  The Five Steps graphic, subtitle, and CTAs all sit within the hero area, in that vertical order.
4.  The old "Scrutinise is a vision and a tool" block is gone.
5.  The standalone "MPs and the road to legislative excellence" block is gone; its bullets appear inside the new "Who is it for?" block.
6.  Block order on scroll matches the spec (1–8) above.
7.  All copy matches the spec exactly, including em-dashes and ellipsis.
8.  Existing video sources (R2 Parliament video, Pexels citizens video) still play correctly in their new positions.
9.  No regressions on mobile — verify the new hero with four buttons + Five Steps + two CTAs doesn't break on narrow viewports.
10. Lighthouse / Vercel build passes; no TypeScript errors.

## Git discipline

CC does **not** call git during this sprint. At the end of the sprint, CC produces `commit-all.sh` in the project root containing:

-   All `git add` commands for files modified
-   A single commit with message `V2-HOMEPAGE-RESTRUCTURE: Restructure homepage copy and block order`
-   `git push origin Main` (capital M)

Charlie reviews the Vercel preview deployment. After Charlie approves, CC executes `commit-all.sh` immediately, then deletes it.

## Out of scope

-   The "Be the engine" sub-heading wording (kept for now, can be revisited)
-   Any styling changes beyond what's needed for the new hero buttons
-   A/B testing infrastructure
-   New images, video re-shoots, or replacement of the "stay calm" video script (Charlie has flagged this for later)
-   Any changes to the Five Steps individual step copy (Create/Draft/Develop/Campaign/Legislate descriptions are unchanged)
