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
    (§8) starts unprompted.
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
the decision log (§12, 6 Aug afternoon); this section is how they behave. Full account: `CHANGE_LOG.md`
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

## 5. Stage 2b — Question library **[BUILT 11 Aug 2026]**

A library of the hard questions members actually get asked, with community-rated answers, and a pack
builder that turns a filtered slice into a field aid. Built to the CD handoff in
`docs/design_handoff_central_question_library/`, which is the visual source of truth. Full account:
`CHANGE_LOG.md` "CENTRAL Stage 2b". Verified by `npm run check:central` (189/189, live DB).

### 5.1 Three vote-ish mechanisms, deliberately not one

The single most important thing to preserve here is that these are **different mechanisms** and must
not be collapsed into a shared one:

| | direction | self-vote | visible to others | affects ranking |
|---|---|---|---|---|
| **QuestionVote** — "I get asked this too" | up only | **allowed** | yes, as a count | orders the library |
| **AnswerVote** — quality | up **or** down, mutually exclusive | **refused** | yes, as a net score | orders the answers |
| **AnswerFavourite** — a private shortlist | n/a | n/a | **never, to anyone** | **never** |

A question vote records **frequency, not quality** — which is why there is no downvote, and why the
asker may vote for their own question: they demonstrably were asked it. An answer vote records
quality, so self-voting is refused under the Stage 2 no-marking-own-content rule, and switching
direction **withdraws** the previous vote rather than stacking (the count moves by two).

🔒 **Favourites are private and must stay private.** No count, no ranking effect, no aggregation, no
exposure through any admin view including §5.6. The only place a favourite surfaces is the owner's own
pack. If a change ever makes a favourite countable, that is a privacy regression, not a feature.

`AnswerVote.voteWeight` exists, defaults to `1.0` and **is applied in the sort**, but no weighting
logic is implemented: flat votes for the pilot. The column is there so credibility weighting can be
switched on later without a migration.

**Vote recency: no expiry.** "Top this month" filters on *when the vote was cast*, rather than
decaying old votes — a question asked constantly last year and not since should drop out of the
monthly view, not linger at a discount.

### 5.2 Scope

Questions default to **COMMUNITY** and are always tagged with the author's branch, recorded even on a
Community-scoped question so "which branch is asking this" stays answerable. A **BRANCH**-scoped
question is visible only within that branch's tree — so from a sibling branch it does not exist, and
from the root it does, because the root's subtree is the whole Community.

Promotion to Community scope: the question's **author**, or anyone with manage rights. One-way by
design — a question other branches have already answered should not vanish from under them.

### 5.3 Flags, hiding and edit suggestions

-   **AnswerFlag** — `DO_NOT_USE` or `USE_WITH_CARE`, with a **required reason**. A flag without a
    stated reason is an unaccountable veto. Settable only by branch managers and Community admins.
    The author is told, and told why.
-   `DO_NOT_USE` answers are **excluded from packs**. `USE_WITH_CARE` answers stay packable and the
    **flag and reason travel with them into the output**, in every format.
-   Managers can also **hide** an answer outright — the heavier alternative to a flag.
-   **EditSuggestion** goes to the **answer's author**, who applies or dismisses it. There is
    deliberately **no admin path**: a suggested rewording is a conversation between two members, not a
    moderation action. A Community admin trying to decide one is refused.

### 5.4 The near-match step

The lookup runs **live as the user types**, so step 2 is never a surprise when they reach it. Jaccard
overlap on content words against that Community's questions — deliberately not the corpus-search
stack, which is a different scale and a different problem.

The framing is a **shortcut, never a rejection**: "your answer is worth more on a question people are
already reading". The escape — "Mine is different — carry on" — sits at equal visual weight, and
nothing blocks posting. That copy carries the product's intent and should not be softened.

### 5.5 Packs

Built from the library's current filter rather than a re-specified one. Sizes 10 / 25 / 50, with the
request reconciled against reality ("6 of a possible 10"). Pinned questions **hold their position as
the ranking moves**; removed ones stay out.

**Favourites in a pack are ADDITIVE, not substitutive** (a correction to the CD pack, per the brief).
Where the member has favourited a different answer, the pack carries **both** the community's
top-voted answer and theirs. It never silently replaces the community's choice with a private one —
that would make two members' packs differ without either knowing why.

Four outputs: glance cards, answer-first flashcards, continuous list, and the A4 print sheet. **Every
one carries the line "Community-rated answers, not official positions."** — a single exported
constant, so no format can quietly omit it.

### 5.6 Across branches (Community admins)

Participation counts and per-branch top-voted and rising questions. **Participation figures only** —
no per-member activity is computed, let alone displayed, and favourites are not read at all. Quiet
branches are marked neutrally, not in red. A broadcast composer messages every branch manager by
notification **and** email; both outcomes are reported per recipient, because a mail failure must
never read as delivery.

### 5.7 Tags

Context tags are fixed and split two ways, which is what the toggle above the chips switches between:

-   **Out in the world** — Doorstep · Media interview · Hustings · University AMA · Council chamber
-   **Behind the scenes** — How-to · Party process · Tools & tech

Topics are an **admin-extendable** list, seeded with Local finance · Local services · Organising ·
Energy · Immigration · Housing. Admins can **promote** a tag to a visible filter chip; unpromoted tags
live in the dropdown only, so the chip row stays short as tags multiply.

### 5.8 Sub-tabs

Central's "in the community" areas are sub-tabs: **Questions** (default), Board, Training,
Leaderboard. **Board is hidden for the pilot** (Charlie, 11 Aug) — the bulletin-board code is
untouched and still renders if reached directly, it is simply not linked. Restoring it is deleting one
`hidden` flag in the `TABS` array.

Groups and points stay at the **Central level, above the sub-tabs**: managing which branches you are
in is a personal concern, not one of the in-community areas.

## 6. Central visual language **[ADOPTED 11 Aug 2026]**

Three departures from the generic V0-derived styling, taken from the CD handoff and adopted across
**all of Central**, not only the Questions screens:

1.  **12px card radius, one hairline border, no nested boxes.** Panels that previously wrapped their
    rows in a second bordered div now use a fill-only inset.
2.  **Teal is promoted from animation-only to the live-state accent** — voted, pinned, local example,
    rising, step-completed. **Navy remains the primary action colour**; teal never marks a call to
    action.
3.  **All counts in tabular figures**, so numbers do not jitter as they change.

Nothing else in the palette or type stack changes. Implemented as Central-scoped utilities in
`globals.css` (`.central-card`, `.central-inset`, `.central-live`, `.tabular`) rather than by changing
`--radius`: a global change would restyle Ideas, Lex and the rest of the app, which this sprint has no
mandate to touch.

## 7. Stage 2c — Events **[ROADMAP]**

Create an event within a Community or branch: title, date/time, location or online link, description, downloadable `.ics` file (the standard calendar format Google/Outlook/Apple all import). "Upcoming" dashboard panel populates from this. Event-materials packs (how to run a pub parliament, campus AMA, etc.) live as knowledge-base content, not a separate system.

## 8. Stage 2d — Training marketplace **[ROADMAP]**

Structured request/offer posts (replacing the Stage 1 bulletin-category workaround), browsable within a Community and optionally across the network. Matching stays human and informal — participants arrange their own calls (WhatsApp/Zoom between themselves). Confidentiality rules for practice sessions stated up front. Calendar/Zoom API integration deliberately deferred.

## 9. Stage 3 — Corpus-powered AI features **[DESIGNED]**

Shared pattern for all: search the corpus → generate only from what was retrieved → state plainly when the corpus doesn't cover something → citations required per claim.

-   **Instant Expert** — "Make me an instant expert on…": key legislation, key debates summarised, key statistics, expenditure trends, and a "Not a lot of people know this but…" section (every claim in it must carry a corpus citation or be dropped). One-page and five-page versions.
-   **Fact checker** — three outcomes only: *supported by the corpus / contradicted by the corpus / not covered by the corpus*. Never bare true/false. "Based only on our data" caveat prominent on every result.
-   **Steelman generator** — paste a draft answer, get the strongest good-faith counter-argument grounded in real recorded opposition.
-   **Precedent finder** — how similar hard questions were handled before; scoped to select-committee evidence and written parliamentary questions (more direct than floor debate), with cross-speech triangulation for chamber material.
-   **Local council briefing generator** — "Brief me on [constituency/council]": local spending, relevant SIs, Hansard mentions.
-   **[GATED] Clause-level voting statistics** ("majority of Party X voted for this sub-clause") — requires division-list ingestion joined to specific clauses. First step: CC to verify whether division lists are in the corpus at all.
-   **[GATED] Pledge delivery tracker** — pledge vs. legislative/spending/outcome record. Requires an outcome-statistics ingestion strand not currently in the corpus.

## 10. Stage 4 — Token economy **[ROADMAP — accountant question first]**

-   Split: **75%** usable by the purchasing Community · **25%** to the general Scrutinise pool (any user) · **0%** personal use.
-   Runs on a dedicated API key set used for nothing else.
-   Candidate rails: Stripe for incoming payments; OpenRouter Management API for per-Community capped keys (note: \~5.5% surcharge on loaded credit; credit expiry after 12 months' inactivity).
-   Sequencing rule: build only once Stage 3 features exist and show real usage — there is nothing to meter before then.
-   Open items before build: accountant question on turnover/disbursement treatment; FCA payment-intermediary check.

## 11. Deferred or dropped

-   **The Chancellor** strategy game — dropped for now (scope; design notes retained in conversation).
-   Real archive footage licensing — deferred indefinitely (cost; real-person depiction risk).
-   Group-admin analytics/oversight — build only if a group requests and funds it; legally gated on consent structure.
-   **Penalties for sustained negativity — TBC** (Stage 2 open item, §4.8). Scores go negative with no
    floor; what, if anything, follows from that is undecided and nothing is built.
-   **Collusion detection** beyond guardrails v1 — reciprocal-marking and ring analytics (§4.8).
-   **Knowledge tests** — deferred, no content to test against yet.
-   **Cross-Community and global leaderboards** — out of scope at Stage 2.
-   Semantic search on bulletin boards — trigger is observed vocabulary-mismatch failures in real use, not a document count. Design notes recorded: event-triggered embedding per post; confirm ANN index type (HNSW vs IVFFlat) before build; re-validate fusion weighting on this content type; tenant isolation enforced at query level.

## 12. Decision log

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
-   **11 Aug** — Question library designed (CD handoff) and built as **Stage 2b** (§5). Stages
    renumbered: question library 2b, Events 2c, training marketplace 2d.
    1.  **Three vote-ish mechanisms stay separate.** A question vote is **up only** and records
        *frequency* — self-voting allowed, because the asker demonstrably was asked. An answer vote is
        up/down, mutually exclusive, self-voting refused. A favourite is **private**.
    2.  🔒 **Favourites are never counted, ranked, aggregated or shown to anyone else** — including
        admins and the across-branches view.
    3.  `AnswerVote.voteWeight` ships defaulted to 1.0 and applied in the sort, with **no weighting
        logic**: flat votes for the pilot, so weighting is a later switch rather than a migration.
    4.  **Vote recency: no expiry.** "Top this month" filters on when the vote was cast.
    5.  **Flags need a reason.** `DO_NOT_USE` is excluded from packs; `USE_WITH_CARE` stays packable
        and its reason travels into every output. Managers may also hide outright.
    6.  **Edit suggestions have no admin path** — the answer's author decides, full stop.
    7.  **Favourites in packs are ADDITIVE, not substitutive** (a correction to the CD pack): the
        pack carries the community's top answer *and* the member's, never one instead of the other.
    8.  **Every pack output carries "Community-rated answers, not official positions."**
    9.  **Across branches is participation only** — no per-member activity, ever.
    10. **Board is hidden for the pilot.** The code stays; only the tab link goes. One-line reversal.
    11. **The CD visual upgrade is adopted across all of Central** (§6), scoped as Central-only
        utilities rather than a global `--radius` change.
