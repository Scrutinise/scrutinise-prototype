# Conversation Summary

**Date of first reply:** 20-02-26 **Date of last reply:** 20-02-26 **Total replies:** 4

***

## Title

Pre-Sprint Planning: UI Tooling, Prototyping Strategy, and Build Sequence

***

## Build Stage

Pre-development / Sprint Preparation — specifically covering UI/design tooling decisions and the agreed sequence of steps before the 4-week development sprint begins.

***

## Areas Covered

-   Vercel v0 as a UI generation tool: what it is, how it works, and its pricing structure
-   Shadcn/ui as the component library underpinning v0 output
-   The existing Revolut-inspired aesthetic and how it relates to Shadcn/ui theming
-   Clickable prototype strategy: skeleton pages with mocked data, real navigation, hosted on Vercel
-   The recommended pre-sprint sequence of work
-   How v0 aesthetic generation and clickable prototype build can be combined into a single step

***

## Decisions Made

1.  **Vercel v0** will be used for UI/aesthetic generation, with output integrated into the Scrutinise codebase. Charlie to use v0.dev (free tier available, paid from \~\$20/month).
2.  **Clickable prototype** will be built before the sprint begins — Next.js pages with hardcoded mock data, fully wired navigation, and a visible PROTOTYPE banner.
3.  **v0 aesthetics and clickable prototype will be built together** in a single pass, so each screen is only built once.
4.  **Agreed pre-sprint sequence:**
    -   Step 1: Finalise entity list and process/user story map
    -   Step 2: Consistency check across DB schema, wireframes, and processes
    -   Step 3: Build clickable prototype with v0 aesthetics integrated
    -   Step 4: Begin 4-week development sprint

***

## Background / Unresolved Items

-   **Revolut aesthetic:** Charlie has already replicated this design style. No decision needed — noted as a solid baseline. Can be refined once v0 components are generated.
-   **v0 workflow:** The recommended pattern is to use v0 for component/page aesthetic generation and Claude for logic, architecture, and integration. Not a decision but an agreed working method.
-   **Consistency check value:** Flagged that DB/wireframe/process mismatches are a common source of expensive problems. When bringing documents for review, Charlie to flag areas of uncertainty proactively.
-   **User story mapping vs process list:** Charlie noted these might be the same thing — not resolved, left for Charlie to determine during document finalisation.
