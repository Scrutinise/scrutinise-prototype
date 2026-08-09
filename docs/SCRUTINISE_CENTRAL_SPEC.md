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

| | page | read board | post/mark | moderate | member list, requests & claims |
|---|---|---|---|---|---|
| member of the node | ✓ | ✓ | ✓ | ✓ if they manage it | ✓ if they manage it |
| ancestor admin, not a member | ✓ | ✓ *(Stage 2)* | ✗ | ✓ *(Stage 2)* | ✓ |
| member of the Community, not of this branch | ✓ (front door) | ✗ | ✗ | ✗ | ✗ |
| everyone else | 404 | ✗ | ✗ | ✗ | ✗ |

⚠ **Stage 2 reversed the Stage 1.1 join-first gate on the board**, deliberately: the admin cascade
Charlie settled on 6 Aug includes subtree board moderation, and you cannot moderate what you cannot
see. Reading and removing cascade; **posting and marking still require membership** — an ancestor
admin runs a branch, they do not participate in it as though they had joined.

**Roles** — Members panel on any node you manage: promote MEMBER→ADMIN, demote, remove. OWNER is
fixed in both directions; a co-admin who could demote the owner could take the node. Removing someone
also clears the node's `managerId` if it named them.

### Explicitly NOT in Stage 1

-   Structured training marketplace — workaround: seed a **"Training"** bulletin category at launch,
    described as "Offer or request interview/media training here", so the behaviour can start as
    ordinary posts *(Stage 1 seeded this as "Training — offers & requests"; renamed at Stage 1.1)*
-   Events and `.ics` calendar downloads
-   Points earning, leaderboards (stub only) — *built at Stage 2, §4*
-   Abuse-reporting workflow, admin analytics, semantic search

## 4. Stage 2 — Points & leaderboards **[BUILT 9 Aug 2026]**

Anchor principle (29 Jul): points ≈ value of time. Basic work ≈ 12 points per estimated hour, skilled
work ≈ 20. **This is a background pricing guide only** — no self-reported time exists anywhere in the
system, and none is collected. Every award is a fixed tariff per action type.

### 4.1 The eight settled decisions (Charlie, 6 Aug 2026)

1.  **Tariff-by-action.** Fixed point values per action type; the hour anchor prices them, it does not
    measure anything.
2.  **Posts earn nothing on creation.** Points flow only from constructive marks *received*;
    unconstructive marks deduct.
3.  **Contingent referrals** — three layers, decaying, reboostable (§4.4).
4.  **Offline activity via approved claims** — member logs, branch admin approves, tariff pays, every
    decision visible in the Community activity log.
5.  **Admin cascade — all three powers:** subtree membership, subtree board moderation, subtree claim
    approval. This extends the management carve-out to *reading and moderating* descendant boards, a
    deliberate reversal of the Stage 1.1 join-first gate.
6.  **The leaderboard window is a viewer control**, not an admin setting: monthly / quarterly /
    all-time, switchable by any user.
7.  **Scores can go negative. No floor.**
8.  Central points remain a **separate ledger** from legislation points, on the same unit scale.

### 4.2 Architecture — an event ledger, never balances

`PointsEvent` records every earning and deduction as one signed, timestamped, source-tagged row.
Balances and leaderboards are **computed** from it; no running total is ever the source of truth.
Three consequences, and they are the reason for the choice:

-   any window is a `createdAt` filter, so decision 6 costs nothing to implement;
-   a mispriced tariff is correctable going forward without rewriting history;
-   Central points stay arithmetically compatible with, but separate from, legislation points — the
    source tag keeps them distinguishable, and nothing here writes to `Reputation`, `PointsLedger` or
    `CredibilityScore`.

**The ledger only appends.** A withdrawn mark adds a negative row rather than deleting the original; a
reversal reverses *at the value the original award used*, so a retune cannot be banked by re-marking.
Every event stamps its tariff (`tariffKey`, `tariffPoints`, `tariffId`) at the moment it is written.

`PointsTariff` and `PointsConfig` hold the numbers, so retuning is editing rows rather than shipping
code.

### 4.3 The tariff, and where the mark values came from

Marks were **mirrored from the main system, not invented** (decision 2). `lib/points.ts` prices a
contribution rating at **+4** (3★, the lowest positive tier), +8 (4★), +12 (5★) and **−4** (1–2★). A
Central mark is *binary* — no quality gradation — so it maps to the base positive tier and the
negative tier:

| action | points | source |
|---|---|---|
| Constructive mark received | **+4** | mirrors `CONTRIBUTION_RATED_3` |
| Unconstructive mark received | **−4** | mirrors `CONTRIBUTION_RATED_1_2` |
| Canvassing session | 24 | 2h × 12/hr basic |
| Organised & ran an event | 60 | starter value |
| Gave a training session | 40 | 2h × 20/hr skilled |
| Completed training as a trainee | 20 | starter value |

No scaling against the hour anchor was needed: 4 points ≈ 20 minutes of basic work. **If a
constructive mark should feel weightier, +8 is the next rung the main system already defines** — one
row edit, no code.

⚠ **A consequence of two settled numbers meeting, flagged not hidden:** 10% of a 4-point mark floors
to zero, so **a mark never pays the referral chain anything**. Bonuses only materialise on
claim-sized events (24/40/60). Flooring is the conservative choice — a bonus is a share, never a
rounding-up gift. Raising the mark value or the L1 rate would change this; both are row edits.

### 4.4 Referrals

A chain link is created **only** by redeeming a specific person's invite, per Community; a join
request creates none, because nobody introduced them. Cycles are refused at creation.

-   Three layers: **L1 10% · L2 5% · L3 2.5%** of what the invitee earns.
-   **Decay:** each link starts at 100% and halves every 6 months from its `decayFrom`, floor 25%.
-   **Reboost:** when an invitee first crosses 50 points, the link *above them* — their inviter's link
    — resets to 100%. That rewards the person who recruited a producer, which is the point. Fires once.
-   Bonuses are **minted, never deducted** from the earner. Only positive, non-bonus events pay a
    chain: a bonus on a bonus would compound the tree, and paying on a deduction would punish an
    inviter for their invitee's bad post.

🔒 **HARD CONSTRAINT.** Referral layers apply to **reputation points only**. They must never be
extended to anything monetisable — tokens, credits, or anything in Stage 4.

### 4.5 Guardrails v1

No marking your own content · one mark per user per item (changeable, emitting a reversal plus a new
event) · a per-user daily budget of **20 distinct items** marked.

The budget is counted **from the ledger, not from live vote rows** — withdrawing a mark deletes its
vote, so counting votes would let anyone refund their own budget. Counting distinct items means
changing your mind about something you already marked today does not cost a second slot.

### 4.6 Claims and the activity log

`ActivityClaim`: self-claims only — the claimant is taken from the session, never from the request
body. You cannot approve your own claim. The duplicate guard is an **expression partial unique index**
on (userId, activityType, occurredAt::date) `WHERE status <> 'DECLINED'`, which Prisma cannot declare;
it lives in `prisma/central_stage2.sql`. Scoped to exclude declined rows for the same reason the
Stage 1.2 join-request guard is partial: a flat guard would make a declined claim permanently
un-correctable, and a declined claim paid nothing, so nothing is at risk.

`/communities/[id]/activity` shows every decided claim across the tree — who claimed, who decided,
what it paid — **to every member of the Community, not only admins**. That visibility is the
anti-abuse mechanism at this stage, and it is what makes tariff-paying approval safe to hand to branch
admins.

### 4.7 Leaderboards

Per Community only — no cross-Community or global boards. Individuals and Branches tabs, window
switcher, branches rankable by total or per-member average (both derived, so both are free). Scores
display signed, and a negative score is **ranked, not hidden**.

Branch attribution is by `PointsEvent.sourceCommunityId`, the node the activity happened on — not by
current membership. A membership-derived total would double-count anyone in two branches and would
silently rewrite a branch's history whenever someone joined or left it.

### 4.8 Open items — recorded, not built

-   **Penalties for sustained negativity — TBC.** Scores go negative with no floor and nothing else
    happens. Deferred by Charlie; nothing built.
-   **Collusion detection.** Guardrails v1 are the three above; reciprocal-marking and ring analytics
    are a later item.
-   **Knowledge tests** — deferred, no content exists to test against yet.
-   **Cross-Community and global leaderboards** — deliberately out of scope.

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
-   **Penalties for sustained negativity — TBC** (Stage 2 open item, §4.8). Scores go negative with no
    floor; what, if anything, follows from that is undecided and nothing is built.
-   **Collusion detection** beyond guardrails v1 — reciprocal-marking and ring analytics (§4.8).
-   **Knowledge tests** — deferred, no content to test against yet.
-   **Cross-Community and global leaderboards** — out of scope at Stage 2.
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
-   **6 Aug (evening)** — Stage 2 points design settled; built 9 Aug (§4). Tariff-by-action, with the
    12/20 pts-per-hour formula demoted to a background pricing guide (no self-reported time exists).
    Posts earn nothing on creation — points flow only from marks received. Mark values **mirrored from
    the main system** rather than invented (+4 / −4). Contingent referrals, three layers, decaying and
    reboostable, **reputation points only and never anything monetisable**. Offline activity via
    approved claims, with a Community activity log visible to all members as the anti-abuse mechanism.
    **Admin cascade takes all three powers**, which reverses the Stage 1.1 join-first gate for reading
    and moderating descendant boards. Leaderboard window is a viewer control. Scores go negative with
    no floor; penalties for sustained negativity explicitly deferred. Architecture decided as an
    **event ledger, never stored balances**.
