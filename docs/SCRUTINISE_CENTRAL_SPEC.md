# Scrutinise Central — Master Specification

**Version 1.0 — 29 July 2026**

Status key: **[BUILDING]** in current CC sprint · **[DESIGNED]** agreed, awaiting brief · **[ROADMAP]** agreed direction, needs design work · **[GATED]** blocked on data, legal, or external input

***

## 1. Purpose and principles

Central is the social and logistics layer of Scrutinise: where people organise, train, debate, run events, and test ideas in the world. Ideas remain the serious, focused legislative pipeline. The two are deliberately separate object types.

-   **Non-partisan by construction.** All functionality is available to all users and groups on identical terms. Only exception: pilot/beta testing with volunteers before general release.
-   **Communities are invite-only.** Content inside a Community is private to that Community. The tools themselves, and the public knowledge base, are visible to everyone.
-   **No permission crossover.** Community membership grants no access to any Idea, and vice versa (decision 22 Jul 2026, documented in schema comments).
-   **No video hosting.** External links (YouTube etc.) only.
-   **Users own their posts.** Platform responsibility model similar to X.com; an abuse-reporting function is required before any open-growth phase (Online Safety Act awareness noted 22 Jul 2026).

## 2. Object model — built, migrated

-   **Community** — name, description, self-referential `parentCommunityId` giving branches/sub-teams to any depth (same pattern as `RootCause.parentId`).
-   **CommunityMember** — role `OWNER` / `ADMIN` / `MEMBER`, unique per (community, user).
-   **CommunityInvite** — invite code, optional email, max uses, expiry (mirrors `GroupInvite`).
-   **Idea.communityId** — optional link, informational/display only; never grants permissions.
-   Existing Idea-scoped `Group` / `GroupMember` / `GroupInvite` / `IdeaCollaborator` models untouched.

## 3. Stage 1 — Community core **[BUILDING]**

Scope as briefed to CC, 29 Jul 2026:

1.  Any user can create a top-level Community and becomes `OWNER`; `OWNER`/`ADMIN` can create child Communities beneath it.
2.  **My Communities** landing list — every Community the user belongs to, with name, description, unread bulletin count; create and join-by-code entry points.
3.  **Community dashboard** — header (name, description, admin badge) plus three regions: Teams & branches, Bulletin board, Points & leaderboards (stub).
4.  **Teams & branches** — expandable tree; admins can add, rename, assign a manager per node.
5.  **Bulletin board** — thread list with category tags; post, reply, upvote/downvote; keyword search scoped to the Community. Never a cross-Community feed.
6.  **Invite screen** — Community name, rules, and what earns points, shown before joining; joining blocked until seen.
7.  **User dashboard reorg** — "Your ideas" unchanged; new "My Communities and teams" section (cards tagged by type); notifications panel split into "Feed" (recent Central activity) and "Upcoming" (events — empty state until Stage 2b).

Visual language: existing Scrutinise components throughout; Clerk auth; no new design system.

### Stage 1 test checklist

-   [ ] Create a top-level Community; you appear as OWNER
-   [ ] Add a branch (child Community) from the tree; add a sub-branch beneath that; rename one
-   [ ] Assign a manager to a branch
-   [ ] Generate an invite code
-   [ ] Joining account is shown the invite screen (name, rules, points summary) and cannot join without passing through it
-   [ ] Joined account appears as MEMBER; correct role badges shown
-   [ ] Post a thread with a category tag; reply from the second account; upvote and downvote
-   [ ] Content posted in one Community is invisible from another Community and from logged-out/public view
-   [ ] Branch-scoped board shows only that branch's posts
-   [ ] Keyword search returns matches from this Community only
-   [ ] Dashboard shows "My Communities and teams" with Community and Idea-team cards side by side
-   [ ] Feed shows recent posts/replies; "Upcoming" shows an intentional empty state, not an error
-   [ ] Points & leaderboards region visible as a labelled stub

### Explicitly NOT in Stage 1

-   Structured training marketplace — workaround: seed a **"Training — offers & requests"** bulletin category at launch so the behaviour can start as ordinary posts
-   Events and `.ics` calendar downloads
-   Points earning, leaderboards (stub only)
-   Abuse-reporting workflow, admin analytics, semantic search

## 4. Stage 2 — Points & leaderboards **[DESIGNED in part — under discussion]**

Agreed so far (29 Jul 2026):

-   Anchor principle: points ≈ value of time. Basic work ≈ 12 points per estimated hour, skilled work ≈ 20; activities we specifically want to incentivise can carry a premium.
-   Constructive/unconstructive marks on content follow the main Scrutinise allocation system, including negatives for low-quality content.
-   Heads of sub-groups (branch chairmen etc.) hold admin rights over the members of the sub-group they head.
-   Central points are a separate ledger from main Scrutinise legislation points, on the same unit scale, so they can be compared or combined later as separate metrics.

Open design questions being resolved in conversation before the CC brief: tariff mechanics, quality-bonus split, referral points, offline-activity verification, admin-power cascade, leaderboard windows, negative floors.

## 5. Stage 2b — Events **[ROADMAP]**

Create an event within a Community or branch: title, date/time, location or online link, description, downloadable `.ics` file (the standard calendar format Google/Outlook/Apple all import). "Upcoming" dashboard panel populates from this. Event-materials packs (how to run a pub parliament, campus AMA, etc.) live as knowledge-base content, not a separate system.

## 6. Stage 2c — Training marketplace **[ROADMAP]**

Structured request/offer posts (replacing the Stage 1 bulletin-category workaround), browsable within a Community and optionally across the network. Matching stays human and informal — participants arrange their own calls (WhatsApp/Zoom between themselves). Confidentiality rules for practice sessions stated up front. Calendar/Zoom API integration deliberately deferred.

## 7. Stage 3 — Corpus-powered AI features **[DESIGNED]**

Shared pattern for all: search the corpus → generate only from what was retrieved → state plainly when the corpus doesn't cover something → citations required per claim.

-   **Instant Expert** — "Make me an instant expert on…": key legislation, key debates summarised, key statistics, expenditure trends, and a "Not a lot of people know this but…" section (every claim in it must carry a corpus citation or be dropped). One-page and five-page versions.
-   **Fact checker** — three outcomes only: *supported by the corpus / contradicted by the corpus / not covered by the corpus*. Never bare true/false. "Based only on our data" caveat prominent on every result.
-   **Steelman generator** — paste a draft answer, get the strongest good-faith counter-argument grounded in real recorded opposition.
-   **Precedent finder** — how similar hard questions were handled before; scoped to select-committee evidence and written parliamentary questions (more direct than floor debate), with cross-speech triangulation for chamber material.
-   **Local council briefing generator** — "Brief me on [constituency/council]": local spending, relevant SIs, Hansard mentions.
-   **[GATED] Clause-level voting statistics** ("majority of Party X voted for this sub-clause") — requires division-list ingestion joined to specific clauses. First step: CC to verify whether division lists are in the corpus at all.
-   **[GATED] Pledge delivery tracker** — pledge vs. legislative/spending/outcome record. Requires an outcome-statistics ingestion strand not currently in the corpus.

## 8. Stage 4 — Token economy **[ROADMAP — accountant question first]**

-   Split: **75%** usable by the purchasing Community · **25%** to the general Scrutinise pool (any user) · **0%** personal use.
-   Runs on a dedicated API key set used for nothing else.
-   Candidate rails: Stripe for incoming payments; OpenRouter Management API for per-Community capped keys (note: \~5.5% surcharge on loaded credit; credit expiry after 12 months' inactivity).
-   Sequencing rule: build only once Stage 3 features exist and show real usage — there is nothing to meter before then.
-   Open items before build: accountant question on turnover/disbursement treatment; FCA payment-intermediary check.

## 9. Deferred or dropped

-   **The Chancellor** strategy game — dropped for now (scope; design notes retained in conversation).
-   Real archive footage licensing — deferred indefinitely (cost; real-person depiction risk).
-   Group-admin analytics/oversight — build only if a group requests and funds it; legally gated on consent structure.
-   Semantic search on bulletin boards — trigger is observed vocabulary-mismatch failures in real use, not a document count. Design notes recorded: event-triggered embedding per post; confirm ANN index type (HNSW vs IVFFlat) before build; re-validate fusion weighting on this content type; tenant isolation enforced at query level.

## 10. Decision log

-   **21 Jul** — Module conceived. Surveillance-at-scale review feature cut. Equal-terms-for-all-parties rule adopted. PPERA s.52(1)(g) volunteer carve-out confirmed.
-   **22 Jul** — "Community" chosen as model name (existing `Group` = Idea sub-teams, untouched). Hierarchy via self-referential parent. No permission crossover. Schema built and validated. Chancellor game cancelled. Central nav: Content / Training / Events tabs, group switcher, content-category cards.
-   **23 Jul** — 25% pool clarified as redistribution to users, not platform income. Corpus checks: OTS abolished 2023 (any ingested material is historical archive); division lists probably not ingested — verify.
-   **29 Jul** — Migration + Stage 1 build briefed to CC. V30 ingest fixes committed. Token split confirmed 75/25/0 on separate keys. Points principles agreed (12/20 per hour anchor, constructive marks follow main system, sub-group heads hold admin over their sub-group). This spec created.
