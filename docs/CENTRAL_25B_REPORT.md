
---

# CENTRAL 25-B — report

**Written:** 1 September 2026, late. **Deployed commit while this was written:** `f9d9eb5`.

## §0 — ⚠⚠ TWO BLOCKERS, AND THE SECOND CHANGES WHAT §1 CAN HONESTLY BE

**1. §8a is not done.** It was reported and nothing was built, because it waits on three decisions of
yours: the mechanism, the tier for six existing rows, and §8h. §0 of this brief says not to start
§1 until it is.

**2. ⚠⚠ NONE OF 25-A IS DEPLOYED.** Production serves `f9d9eb5` — the Lex stream's 25-S commit —
and `lib/invite-gate.ts` has never been committed at all. **So the premise of §1a step 1 is false:
the two-email problem is not fixed on the site; it is fixed in the working tree.**

**What I did instead of stopping, and why.** Four invited branch chairs hold live platform
invitations expiring **15 September**, and they will walk **today's** production, not my tree. The
most useful thing this brief can produce right now is an honest account of the journey **as it
currently stands**. So §1 below is a walk of the deployed flow, labelled as such throughout —
⚠ **not the flow 25-A builds.** Where the two differ I say so.

⚠ **It is also a partial walk, and here is exactly where it stops.** Steps 1–3 are publicly
reachable and were fetched from production. **Steps 4–6 need an account**, and the only way to get
one is to consume a real invitation belonging to a real person, which I will not do. Those steps are
read from source and labelled `[source]`, never `[observed]`.

---

## §1 — the first ten minutes, as production serves them today

### 1a. Step by step

**Step 1 — the email.** ⚠ **Not observed. §6 is right: only Charlie can read a real inbox.** Two
different emails exist in the deployed code and which one arrives decides everything that follows:

- `sendSignUpInviteEmail` — subject **"You're invited to join Scrutinise"**, body *"This invite is
  locked to <address> and expires in 14 days"*, one button, **"Accept invitation"** → `/sign-up?invite=<token>`.
- `sendCommunityInviteEmail` — subject **"<name> has invited you to join <community> on Scrutinise"**,
  button **"Open the invitation →"** → `/community-invite/<code>`.

⚠ **The four outstanding invitees were sent BOTH**, minutes apart on 1 September — the platform one
at 15:22–15:23 and the community one on 26 Aug–1 Sep. **That is the two-email problem, live.** Which
they open first decides whether they get in.

**Step 2 — they open the COMMUNITY email.** `[observed]` `GET /community-invite/<lindsey's code>` →
200. On screen: **"You're invited to join"**, the community name and description, an amber box
**"What earns points here"**, and *"Community membership does not give you access to any Idea"*. Two
buttons: **"Create a Scrutinise account to join"** and **"I already have an account — sign in"**.

⚠ **The first button still points at `/sign-up?email_address=lindsey.sharratt%40raven-oak.co.uk&redirect_url=…`
— no invite token.** Read off production just now.

**Step 3 — they press it.** `[observed]` That exact URL returns **"Scrutinise is invite only"**, the
paragraph beginning *"We are building a community dedicated to bringing high standards of quality to
policy development…"*, and **a contact form asking them to apply**. ⚠ **A person Charlie has already
invited is asked to apply for an invitation.** They then press "I already have an account — sign in",
and Clerk tells them their account cannot be found. **That is 25-A §1, still live.**

**Step 3′ — if instead they open the PLATFORM email.** `[observed]` `GET /sign-up?invite=<real token>`
→ 200 and the real Clerk sign-up form; the invite-only landing does **not** appear. ⚠ I re-read the
token afterwards: **still unused — a GET consumes nothing.** The page carries
`forceRedirectUrl":"/dashboard"`.

**Step 4 — where they land.** ⚠ **This is the step you said you most needed, and the answer is
`/dashboard`.** `[observed]` in the rendered page above.

⚠⚠ **And they skip onboarding entirely.** `app/layout.tsx` sets `afterSignUpUrl="/onboarding"` on
the Clerk provider, but the sign-up component passes `forceRedirectUrl="/dashboard"`, which takes
precedence. So a new branch chair is **never asked to confirm their age, accept the terms, or set
their experience level** — those are only collected later, and only if they happen to visit
`/ideas/create` or `/ideas/build`.

**Step 5 — are they in the community?** `[source]` **No.** Nothing in the platform-invitation path
touches community membership. The community invitation is still sitting unredeemed in their other
email. **Nothing on the dashboard mentions it**, because a `CommunityInvite` is not a notification
and nothing renders one.

**Step 6 — what the dashboard says.** `[source]`, quoted exactly from `app/dashboard/DashboardClient.tsx`:

- **"My ideas"** → *"You have not created any ideas yet."* with a button **"Start your first idea"**.
- **"My communities and teams"** → *"You're not in any Communities or teams yet."* with a button
  **"Find a Community"** → `/communities`.

⚠ **On `/communities` a person in no community sees a heading "Central", the line "My communities and
branches.", an input placeholder "Have an invite code?" and a button "Create Community".** So the
most prominent thing a lost branch chair can do is **found a rival community**. The invite-code box
would work — but only if they still have the email with the code in it, which is the email they have
just been bounced out of.

**So, as deployed: a branch chair invited by Charlie lands on an empty personal dashboard that
invites them to write a policy idea, is not in the community, is told they are in no communities, and
is offered "Create Community" as the strongest next step.** Nothing anywhere names the branch they
were invited to chair.

⚠ **Confusing rather than broken, and worth logging as such:** the word **"Central"** appears as the
page title with no explanation; the dashboard's language is entirely about *ideas* while the thing
they were invited to is a *community*; and "Start your first idea" is the largest, darkest control on
their first screen.

### 1b. Group member vs branch member

⚠ **Their first screens are identical, and will still be identical after §8.** Measured: the
dashboard renders from `ideas`, `notifications` and `myGroups` only — there is no tier, no role and
no branch anywhere in what it draws. §8b names the two tiers and §8f gives an *admin* a view of them;
**nothing in this sprint or the last gives the member a different first screen.** If their first
screens should differ, that is unbuilt and undesigned.

### 1c. What is missing — reported, not built

1. **Nothing tells them why they are here.** No line naming the community or the person who invited
   them survives sign-up.
2. **No route back to the invitation.** The community invitation exists as a row and appears on no
   screen they can reach.
3. **Onboarding is skipped**, so consent and experience level are never collected.
4. **No first-run guidance at all** — no "here is your branch", no "here is what a branch chair does".
5. **"Create Community" outranks "join the one that invited you"** on the only page they are pointed at.

⚠ 25-A's §7c closes 1 and 2 *once deployed* — the invitation is accepted at first sign-in and they
land back on the invitation screen. **3, 4 and 5 are untouched by anything built so far.**

### 1d. What I fixed, listed separately from what I observed

⚠ **The live defects in the journey above are all fixed in the tree already (25-A) and cannot be
fixed again; they need a deploy, not a change.** One thing outside that set was plainly wrong and is
now fixed:

- **`lib/training.ts` told people a payment was pending when it had already been made.** Logging a
  training session notified the other party: *"…your activity claim is with your branch admin."*
  **Stage 2e removed pre-approval on 24 August** — the claim is `AWARDED` on creation, and
  `decidedByUserId` is null on both claims in the database. Now reads *"…your points for it have
  been awarded."* ⚠ A message that says a payment is pending when it has already been made is the
  kind of wrong nobody reports, because it reads as normal.

Nothing else in the walk was broken in a way a change could fix without a deploy.

---

## §2 — points

### 2a. The audit, numbers first

| | |
|---|---|
| `ActivityClaim` rows, all time | **2** |
| `PointsEvent` rows, all time | **3**, totalling **64** points |
| points from activity claims | **60** — 94% of every point that exists |
| largest single claim | **40**, `cl@scrutinise.org`, `GAVE_TRAINING` |
| the other | **20**, `charlie@whatmusic.com`, `COMPLETED_TRAINING` |
| both logged | 24 Aug 2026 12:53:31, same second |
| evidence on either | **none** |
| decided by | **nobody** — `decidedByUserId` null on both |
| reversed | neither |

**Both accounts are Charlie's own. Nobody else has ever logged a claim.**

### 2b. What a claim actually is

**There are two ways one comes into being, and they are not equally exposed.**

**A — the training flow** (`logSessionForMatch`). Both existing claims are this kind; their note
reads *"Training exchange — Offer of 'Question Time' training over Zoom"*. It requires a
`TrainingMatch` in `ACCEPTED` status — so **the other person agreed** — either party may log it, one
session per match, and it mints **two** claims at once. ⚠ **This path has real two-party protection.**

**B — logging it yourself** (`LogActivity` → `ActivityClaim`). A member asserts *"I did X on date D"*
against a branch they belong to. **Nobody agrees to it, and nothing is verified.**

- **What they assert:** an activity type, a date, an optional free-text `evidenceUrl` and an optional
  note. ⚠ **`evidenceUrl` is optional, unvalidated and unread** — no code fetches it, and both live
  claims have none.
- **What pays:** immediately, `status = 'AWARDED'`, from `PointsTariff`.
- **What stops a double claim:** one partial unique index, read from the database —
  `ActivityClaim_one_per_day` on `(userId, activityType, occurredAt::date)` `WHERE status NOT IN
  ('DECLINED','REVERSED')`.

⚠⚠ **The four self-loggable types and their live tariffs:** `RAN_EVENT` **60**,
`GAVE_TRAINING` **40**, `CANVASSING_SESSION` **24**, `COMPLETED_TRAINING` **20**.

**So one person, unaided, may mint 144 points a day, every day, for activities nobody witnessed** —
and `GAVE_TRAINING`/`COMPLETED_TRAINING` are on **both** lists, so path B walks straight past path
A's two-party protection.

⚠ **What the guard does NOT stop:** the same real activity claimed on consecutive dates; a wholly
invented activity; both parties claiming a session that never happened; or a claim backdated to any
past date (`occurredAt` is only checked against the *future*).

### 2c. Options, with the scaling problem named for each

| | option | scales? |
|---|---|---|
| **1** | **Nothing — visibility only.** Stage 2e's stated principle: the visible log is the anti-abuse mechanism. | ⚠ **Needs nobody's attention, so it is not a review.** It is what exists today, and nobody has ever read the log because there has been nothing in it. |
| **2** | **Pre-approval by the branch manager.** Claim → PENDING → manager approves. | ⚠ **Needs a named person's attention per claim.** Scales with the number of branches, not with Charlie — but it puts a queue in front of every member on day one, and Stage 2e removed exactly this on 24 August. |
| **3** | **Post-hoc digest to the branch manager.** Weekly list of what was claimed in their branch, with a one-click reverse. ⚠ **My recommendation.** | Attention is proportional to activity and **distributed to branch managers**, not to Charlie. Reversal already exists and already requires a reason. |
| **4** | **Cap the ledger.** A weekly points ceiling per member. | Needs nobody's attention — ⚠ **so it is not a review either**; it bounds the damage without detecting it, and it penalises the genuinely active. |
| **5** | **Require evidence on the high-value types** (`RAN_EVENT`, `GAVE_TRAINING`). | ⚠ **The field exists and nothing reads it.** Requiring it is one line; requiring it to be *true* is a review, and we are back to 2 or 3. |

⚠ **The honest summary: only options 2 and 3 are reviews. 2 does not scale past a handful of
branches without annoying every member; 3 scales and detects late.** 1, 4 and 5 are mitigations
dressed as controls.

**A note on ordering, since a conference is the trigger:** option 3's digest is worth nothing without
someone to send it to — it depends on branch managers existing and being identifiable, which is what
§8 is for. **Sequence §8, then 3.**

### 2d. Nothing was changed. The one edit in `lib/training.ts` is a message, not the points system.

---

## §3 — what a branch manager can actually do about conduct

**3a. Can they see who invited whom in their branch?**
⚠ **Deployed: NO.** The column does not exist in production and the members list renders name, role
and nothing else. **In the tree (25-A §7h): yes** — `invitedByName` on every row, saying *"Joined
without an invitation"* in words when nobody did. **It needs the migration and a deploy.**

**3b. Can they eject someone, and does it work?**
**Deployed: yes** — the Members panel's Remove control, gated on `canManageCommunity`, which a branch
OWNER/ADMIN holds for their own branch. ⚠ **But deployed, removal is a hard delete of the membership
row: no record it ever happened.** The tree archives it with who did it and why.
⚠ **The title/ejection gap 25-A found is NOT closed.** A title carries `grantsInvite` and nothing
else, so somebody titled "Branch Chair" who is only a MEMBER of the branch **can invite and cannot
eject**. It is written up as decision 37; it is still a decision, not a fix.

**3c. Can a member report conduct to their branch manager, or a manager escalate to the owner?**

⚠⚠ **There is nothing. Stated plainly, because the answer is nothing.**

- There is **no way to report a person**, anywhere in Central.
- There is **no way to report a bulletin post, a question or an answer to a branch manager.**
- `ContentReport` — the platform's report mechanism — exists for ideas, comments and users, and it is
  read at `/admin` by platform **ADMIN/SUPER_ADMIN only**. ⚠ **It goes to Charlie, not to the branch
  manager**, and nothing in Central creates one.
- The **one** community-scoped report path is `reportResource`: it reports a *resource*, not a
  person, and notifies that node's OWNER/ADMINs. It is the only thing in Central that reaches a
  branch manager, and it is about a document.
- There is **no escalation path from a branch manager to the community owner.** The only
  manager-facing message channel is the owner's *broadcast to all branch managers* — which runs the
  other way.

**What a branch manager can do about conduct today:** delete a bulletin post in their branch
(`content-deletion.ts`, manage rights), and remove the person. **They cannot be told there is a
problem by anyone, and they cannot tell anyone.**

**3d.** No moderation system built or designed.

---

## §4 — carried from 25-A

**4a. `check:scripts` is green.** It was red on `scripts/check-central-25a.ts` (`tsc --noEmit -p
scripts/tsconfig.json`, a `never`-typed index); fixed this afternoon. Both TypeScript programs are
clean now.

⚠ **NOT COMMITTED, and I think that is right.** `Main` auto-deploys — production moved `3cdede2` →
`f9d9eb5` mid-session, which is the proof — and committing 25-A before the provenance migration is
applied would **break production**, because the generated Prisma client expects columns the database
does not have. Committing the check file alone is worse: its eight `lib/` imports are untracked, so a
clean checkout could not compile it. ⚠ **The red is already gone from the shared tree, because the
fix is on disk** — which is what the "hides the next real failure" concern is actually about.
**The whole 25-A set goes in one commit, by explicit path, the moment the migration lands.**

**4b. The fixture user is NOT gone. Re-read twice — by id and by address — and it is still there.**

```
by id      : STILL PRESENT — check25a+a8652576+owner@example.invalid
by address : STILL PRESENT — 00d96844-3ca6-49a0-9774-9fdd28de876b
```

⚠ **The sweep written to remove it has still never run**, because running the check needs the
migration. Correcting my own earlier sentence for the second time: it is not gone, and I only know
that because I looked rather than trusting the code I wrote.

**The account count, reconciled — 37 rows, of which 9 are other people:**

| | count |
|---|---|
| total rows | **37** |
| seeded / historical (`clerkId` not `user_…`) | 24 |
| test fixtures (`@example.invalid`) | 3 — two `verify25e-…` from 23 Aug, one `check25a+…` from today |
| real Clerk accounts | **13** |
| — Charlie's own | 4 (`cl@scrutinise.org`, `charlieleach1@gmail.com`, `charlie@whatmusic.com`, `scalablefinance@gmail.com`) |
| — ⚠ **other real people** | **9** |

The nine: `johnduggan6@icloud.com`, `paintsdipod@googlemail.com`, `michaeljocallagahan@gmail.com`,
`rossengineering56@gmail.com`, `alexanderfrancisshaw@gmail.com`, `ajaxhms@outlook.com`,
`chair.harrogateknaresborough@reformuk.com`, `mona@monima.co.uk`, `jones.graham7@sky.com`.

---

## §6 — what only Charlie can confirm

1. ⚠ **Which email actually arrives, and what it looks like in a real inbox.** I have quoted the
   templates from the deployed code; I have not seen a delivered message, and the two-email problem
   means *which one they open first* decides whether they get in.
2. **That the four outstanding invitees have not already given up.** Their platform invitations
   expire **15 September**: `chair.tatton@reformuk.com`, `chair.reigate@reformuk.com`,
   `g.davey76@talktalk.net`, `lindsey.sharratt@raven-oak.co.uk` — plus `clare@clarepr.com`.
3. **The dashboard as a new person sees it.** I could not create an account without consuming a real
   invitation. ⚠ **If you want a proper walk of steps 4–6, issue one platform invitation to an
   address you control and walk it yourself** — it is ten minutes and it is the only way anyone will
   see what they see.

---

# CENTRAL 25-B §5 — decisions 39/43/44/45/46

*2026-09-02. §5c is a report, as instructed. 46 and 39/45 are built.*

## 39/45 — Fraser Robertson, and both rows authorised

**Done.** `ajaxhms@outlook.com` read `firstName: "User", name: "User", preferredName: "User"` —
Clerk sent no name at sign-up and the webhook falls back to `'User'`. Now `Fraser Robertson`, with
`preferredName: "Fraser"` so Lex addresses him properly. ⚠ Re-read after the write, not assumed.
⚠ It survives his next sign-in: the name sync uses `clerkUser.firstName ?? storedFirst`, so a null
from Clerk cannot clobber it.

The §7j list now reads:

| person | email | invited to | invited by | would create |
|---|---|---|---|---|
| **Jon Swales** | chair.harrogateknaresborough@reformuk.com | "Reform Branch Community" | Charles Leach | member of "Reform Branch Community" |
| **Fraser Robertson** | ajaxhms@outlook.com | "Reform Branch Community" | Charles Leach | member of "Reform Branch Community" |

**Both authorised, both correctly group tier** — both were invited at top level, by you, and §43
derives the tier from how the row joined, which for these two is a root invitation.

⚠ **The `--write` still cannot run**: it writes `invitedByUserId` and `acceptedOnBehalfAt`, and
`prisma/central_25a_provenance.sql` is not applied. **This is the fourth thing now queued behind
that one command.**

## 43 — tier derived, not defaulted

Recorded for the §8a migration: **derive from how each row joined.** A row created on the root is
`GROUP`; a root row created as the side-effect of a branch join is `BRANCH`.

That demotes exactly one existing row — `charlie@whatmusic.com`, who arrived through the Bermondsey
branch link on 6 August — **which you have accepted**. The other five keep what they have:
`cl@scrutinise.org` (owner), `rossengineering56@gmail.com` (founded Cramlington, so GROUP is right),
and the three branch rows, which are branch rows either way.

## 46 — one use by default, capped low

**Built.** `maxUses` was `min(1).max(10_000).default(1)`; the cap is now **10**. The dashboard's
"generate a shareable link" asked for **50** and now asks for 10.

⚠ **Why the cap matters more than the default:** the default was already 1. **A link advertising
fifty uses reads as a door fifty people may walk through**, which is exactly the mental model §8e
exists to remove — and since §3b each use only raises a *request*, so a high number bought nothing
except a misleading sentence on the owner's own screen.

⚠ **Four existing links still carry `maxUses: 50`.** The cap applies to new ones; I have not
rewritten live rows. Each of their uses now produces a request rather than an admission, so the
number is cosmetic — but it is cosmetic *and wrong*, and one `UPDATE` would fix it if you want it.

---

## 44 / §5c — what it takes to make ownership transferable and vacatable

### The finding: it is much less work than §8h implied, and I should have measured it then

**§8h said option C "cannot be built". That was true of the functions that exist and false about the
data.** Measured now:

**1. ⚠ A Community has no owner column at all.** The `ownerId` fields in `schema.prisma` belong to
`Group` (idea teams) and `Pack`. **Ownership of a Community or branch is one row —
`CommunityMember.role = 'OWNER'` — and nothing else.** There is no constraint that a node has an
owner, no uniqueness rule on how many it has, and no foreign key pointing at one.

**2. Only two code paths in the whole application ever write `OWNER`:**

- `app/api/communities/route.ts:71` — creating a Community makes the creator its owner;
- `app/api/communities/[id]/children/route.ts:76` — creating a branch makes the creator its owner.

⚠⚠ **Nothing anywhere can make an existing member the owner of anything.** Ownership is granted once,
at creation, and never again. That — not the refusals — is the real gap.

**3. Three guards refuse to touch an owner**, all in `lib/community.ts`:

| line | function | what it refuses |
|---|---|---|
| 742 | `leaveCommunity` | an owner cannot leave |
| 756 | `leaveCommunity` | ⚠ nor can anyone who owns a **branch inside** the Community they are leaving |
| 964 | `setMemberRole` | the owner's role cannot be changed |
| 994 | `removeMember` | the owner cannot be removed |

**4. ⚠ A vacant branch is NOT an orphan, and this is the fact that makes 5b cheap.** I traced every
manage path:

- `canManageCommunity` walks the node **and its ancestors**, so a branch with no owner is still fully
  manageable by the Community's owner and admins;
- `getNodeManagerIds` returns those same ancestor admins, so **join requests on a vacant branch are
  still decidable** and the people who can decide them are still notified;
- `branch-deletion.ts:134` admits the branch owner **or** anyone with manage rights from above, so a
  vacant branch can still be deleted;
- nothing in `getCommunityTree`, the dashboard or the Teams tree assumes an owner exists.

**So "vacant" is already a representable state. Nothing breaks. There is simply no way to reach it.**

**5. ⚠ `check:central` asserts the two refusals** — *"the OWNER cannot be demoted"* (line 856) and
*"the OWNER cannot be removed"* (858). **Keep both guards and add a separate deliberate path, and
the check stays green** — the same shape as §8a, where the invariant survives because the row does.
Relaxing `setMemberRole` instead would turn a co-admin into someone who can take a node, which is
what those guards are for.

### What it takes, in order, with what each costs

| # | step | migration? | notes |
|---|---|---|---|
| 1 | **`vacateBranchOwnership(branchId, actorId, reason?)`** — demote the OWNER row to MEMBER, in a transaction, recording who and why | **no** | ⚠ **branches only.** Vacating the root would leave a Community with no owner, and `inviteRightFor`'s "the owner always holds the right" would find nobody. Guard on `parentCommunityId !== null` |
| 2 | **`appointBranchOwner(branchId, userId, actorId)`** — promote a member to OWNER, **demoting any incumbent in the same transaction** | **no** | ⚠ without the same-transaction demotion a node can carry two owners; nothing forbids it and several reads would show both |
| 3 | **relax `leaveCommunity`'s branch-ownership guard (756)** so leaving vacates the branches you own rather than refusing | **no** | today it is a dead end: you cannot leave and you cannot hand over |
| 4 | **the Members panel needs the controls** — it currently renders no role or removal control at all for an OWNER row | **no** | ⚠ **this is the bulk of the UI work**, and without it steps 1–3 exist and are unreachable |
| 5 | **5e nomination** — `BranchOwnershipNomination` (branch, nominee, nominatedBy, status, decidedBy, decidedAt, reason) | ⚠ **yes** | a nomination confers nothing; approval calls step 2. Foldable into the pending migration file so it stays **one** command |
| 6 | **5d surfacing** — vacant branches in the §8f monitoring view | ⚠ **blocked** | §8f is part of §8, which waits on §8a |

**Steps 1–4 need no migration and no decision beyond this one.** They are the whole of "transferable
and vacatable", and they are ready to build.

### ⚠ The larger gap you named, confirmed exactly

**A branch chair who leaves, goes quiet or is removed can never be replaced.** Not "with difficulty"
— at all. There is no code path that writes `OWNER` to an existing membership, and the two that
write it run only at creation. Today the only way to replace a branch chair is to delete the branch
and have somebody else create it again, which loses the branch's board, questions, resources and
every membership in it.

⚠ **And it is already live**, not hypothetical: `rossengineering56@gmail.com` owns *Cramlington and
Killingworth*, and `cl@scrutinise.org` owns *Bermondsey*. **Neither can be replaced by anything the
product can do.**

### Two things for you to decide before I build it

1. **Who may vacate.** A branch manager resigning their own branch is clearly theirs to do. **May a
   community admin vacate a branch manager who has gone quiet — without their agreement?** Your
   governing principle says the product mirrors the party rather than deciding for it, which argues
   yes: if the party has replaced a chair, the product must be able to say so. I have not assumed it.
2. **Whether a vacate needs a reason.** Removal already requires one to be *reversible*
   (`ActivityClaim`) or *archived* (`CommunityMembershipArchive`). ⚠ A vacancy with no recorded
   reason is the kind of state that later looks like a bug rather than a decision. I would require
   one, and record it on the archive row the demotion already writes.
