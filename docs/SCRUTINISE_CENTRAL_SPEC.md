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

## 3.1 Stage 1.1 — user-test fixes **[BUILT 6 Aug 2026]**

Charlie ran the Stage 1 checklist on 6 Aug 2026: **10/13 passed**. This sub-stage fixes the four
failures and applies the UX corrections that came out of the test. Full account: `CHANGE_LOG.md`
"CENTRAL Stage 1.1" (2026-08-06 14:26 UTC). Verified by `npm run check:central` (38/38, live DB).

**The four failures, and what each turned out to be:**

1.  **Vote controls not discoverable** — *already built, never found*. Two bare `▲`/`▼` glyphs in
    muted grey; **0 `BulletinVote` rows in the database**. Now a bordered, labelled control with the
    count always visible on every thread and reply. (Real bug found alongside: the thread-list
    endpoint never returned the caller's own vote.)
2.  **Keyword search not discoverable** — *already built, never found*. Now a full-width labelled
    field at the top of the board. Still a plain ILIKE; the corpus-search stack is not involved.
3.  **Invite lookup failed on email** — *a real defect*. `/api/users/search` matched name and
    username but not email. Email is now matched **exactly, case-insensitively** — never as a
    substring, which would let anyone enumerate accounts from a domain fragment. An address with no
    account behind it creates a `CommunityInvite` against that address.
4.  **Idea teams missing from the dashboard** — *a real defect, upstream of the dashboard*. Group
    creation never wrote a `GroupMember` row for the creator, so every team had 0 members and a
    membership-keyed query returned nothing.

**Agreed model changes:**

-   **Category set (replaces the Stage 1 defaults).** In order: **Canvassing · Building Members ·
    Public Debates · Training · Running Councils · Questions**. "Announcements" removed. Stored on
    `Community.bulletinCategories` and seeded at creation; **no admin category-management UI at this
    stage** — defaults only. `Training` replaces the Stage 1 "Training — offers & requests" workaround
    and carries the line *"Offer or request interview/media training here"* so the Stage 2c behaviour
    (§6) starts unprompted.
-   **Post scope.** `BulletinPost.scope` is `BRANCH` (default — the board being viewed) or
    `COMMUNITY`. A Community-wide post **stays owned by the node it was written on**; only its
    visibility widens. Every board in the tree shows it tagged "Community-wide". Replies inherit the
    thread's node and reach.
-   **Hierarchy admin.** OWNER/ADMIN of any ancestor may administer a descendant node (add branch,
    rename, assign manager). This is the minimum that makes per-node tree buttons work. It grants
    **management only** — viewing a board or its members still requires a membership row on that node,
    and the no-crossover rule at the Idea boundary (§1) is untouched.
-   **Nav label.** The module is **Central**; "Community" remains the name of the things created
    inside it.
-   **Dashboard collapse.** "Your ideas" shows 3, "My Communities and teams" shows 4, each with a
    `Show all (N)` toggle.

## 3.3 Stage 1.2 — membership, join requests & roles **[BUILT 6 Aug 2026]**

The branch-membership model, settled by Charlie on 6 Aug and built the same day. The decisions are in
the decision log (§10, 6 Aug afternoon); this section is how they behave. Full account: `CHANGE_LOG.md`
"CENTRAL Stage 1.2". Verified by `npm run check:central` (83/83, live DB).

**Membership**

-   `joinCommunityAndRoot()` is the only way in. A branch membership always brings a root membership
    with it, at MEMBER — owning a branch does not make you an owner of the Community. The invariant
    is asserted across every live membership row by the check script, not just the ones the migration
    touched.
-   Leaving is self-serve and needs nobody's permission. Two refusals, both to stop something being
    orphaned: an OWNER must hand over first, and leaving the root — which leaves the whole Community
    — is refused while you still own a branch inside it.
-   The **switch-or-add chooser** appears on arrival at a branch you have just joined, when you are
    already in others. It is raised by a `?joined=1` flag on the link (set by the invite redemption
    and by the approval notification) rather than by guessing at "first visit": deterministic, and
    the link can be followed again. Nothing is ticked by default — doing nothing keeps every branch.

**Join requests** — `CommunityJoinRequest`

-   Open to members of the Community, for branches they are not in. The Community root itself takes
    invitations, not requests.
-   Requests reach everyone who can act on them: the node's own OWNER/ADMINs **and every ancestor
    admin** — the same set `canManageCommunity()` authorises. They arrive in the Requests panel on
    the node and in those people's Feed.
-   Approve creates the membership (and the root membership with it) and tells the requester.
    Decline tells them too, and they may ask again.
-   The duplicate-pending guard is a **partial unique index** on (communityId, userId) WHERE
    status = 'PENDING'. Partial on purpose: a plain unique would make a declined request permanently
    un-repeatable. Prisma cannot declare it, so it lives in `prisma/central_stage1_2.sql` and is
    flagged in the model comment — a `migrate diff` will want to drop it.

**Who reaches a branch page**

| | page | board | member list & requests |
|---|---|---|---|
| member of the node | ✓ | ✓ | ✓ if they manage it |
| ancestor admin, not a member | ✓ | ✗ | ✓ |
| member of the Community, not of this branch | ✓ (front door) | ✗ | ✗ |
| everyone else | 404 | ✗ | ✗ |

**Roles** — Members panel on any node you manage: promote MEMBER→ADMIN, demote, remove. OWNER is
fixed in both directions; a co-admin who could demote the owner could take the node. Removing someone
also clears the node's `managerId` if it named them.

### Explicitly NOT in Stage 1

-   Structured training marketplace — workaround: seed a **"Training"** bulletin category at launch,
    described as "Offer or request interview/media training here", so the behaviour can start as
    ordinary posts *(Stage 1 seeded this as "Training — offers & requests"; renamed at Stage 1.1)*
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

*Chronological, oldest first. (The 6 Aug entries sat above 29 Jul until Stage 1.2 fixed the order.)*

-   **21 Jul** — Module conceived. Surveillance-at-scale review feature cut. Equal-terms-for-all-parties rule adopted. PPERA s.52(1)(g) volunteer carve-out confirmed.
-   **22 Jul** — "Community" chosen as model name (existing `Group` = Idea sub-teams, untouched). Hierarchy via self-referential parent. No permission crossover. Schema built and validated. Chancellor game cancelled. Central nav: Content / Training / Events tabs, group switcher, content-category cards.
-   **23 Jul** — 25% pool clarified as redistribution to users, not platform income. Corpus checks: OTS abolished 2023 (any ingested material is historical archive); division lists probably not ingested — verify.
-   **29 Jul** — Migration + Stage 1 build briefed to CC. V30 ingest fixes committed. Token split confirmed 75/25/0 on separate keys. Points principles agreed (12/20 per hour anchor, constructive marks follow main system, sub-group heads hold admin over their sub-group). This spec created.
-   **6 Aug (morning)** — Stage 1 user test run: 10/13. Stage 1.1 briefed and built (§3.1). Category
    set agreed and "Announcements" dropped. Post-scope selector agreed. Nav renamed to Central.
    Hierarchy admin extended to ancestors (management only). Admin category-management UI explicitly
    deferred.
-   **6 Aug (afternoon)** — Branch-membership model settled; Stage 1.2 briefed and built (§3.3):
    1.  A branch invite makes you a member of that branch **and** of the root Community.
    2.  Branches are invite-only; non-members **request to join**, and anyone with manage rights on
        that node decides — a generalisation of "the branch owner approves", consistent with the
        co-admin decision below.
    3.  **Multi-branch membership is allowed.** Joining a new branch interactively offers the choice
        to also leave existing ones ("switch or add"); the default is add. Leaving is always
        self-serve.
    4.  A Community-level invitee lands at the root, then requests an existing branch or founds
        their own.
    5.  **Any Community member may found a TOP-LEVEL branch** — the deliberate growth mechanic.
        Sub-branches under an existing branch stay manage-gated, because that is a structural
        decision belonging to that branch's admins. A root-admin approval gate can be added later if
        sprawl appears; not now.
    6.  Node owners may promote members to ADMIN alongside them, demote, and remove. OWNER is fixed.
    7.  **Carve-out to the visibility rule:** manage rights include seeing a node's member list and
        its join requests — those are management surfaces. The node's **board stays
        membership-gated**.
    8.  An email-tied invite is emailed via Resend. The copy-link panel stays regardless, because
        delivery is never guaranteed.
    9.  Re-requesting after a decline is allowed — no permanent block this sprint.
