# BRIEF — CENTRAL 25-C: the decisions, written down

**Thread:** CENTRAL. **Written:** 2 September 2026.
**Follows:** CENTRAL 25-A and 25-B, both shipped and live on `b0df15d`.

⚠ **Why this brief exists.** The 25-B handoff records §8, the tier for existing rows and §8h as
"waiting on Charlie". **They are not — he answered all three.** The answers lived only in a chat
window and never reached the repository. This brief is that correction, and it is the same failure
the LEX session named an hour earlier: *what exists only in a conversation is destroyed by a clear.*

## §0 — Run mode, and the lesson that cost the most

**Continuous.** Diagnose, record in the CHANGE_LOG, proceed — including where a finding contradicts
this brief. Batch the report. **Stop only for** spend or a change of scope.

⚠⚠ **Add to `CLAUDE.md`, from the 25-A/25-B session's own post-mortem:** *a Prisma schema reached
production twelve hours before its migration, swept in by another session's `git add`. The Central
session held its own commit back specifically to prevent that, and holding back did not prevent it.*
**In a shared tree, uncommitted work is not protected work. Commit the schema and its migration
together, as early as possible, rather than waiting.**

⚠ **A LEX session shares this repository.** Commit by explicit file path only. Never `git add -A`,
never a directory-level add — the rule exists and it was broken, which is how the schema shipped
early.

⚠ **CLAUDE.md §25, §26 and §27 apply**: assert rendered data; cold reads; and what a prompt shows
reaches the output as readily as what it asks for.

**§1 is the sprint. §2 and §3 follow. §4 holds for Charlie.**

---

## §1 — The two-tier membership model. All decided; build it.

**1a. The mechanism — CC's own recommendation, accepted.** A **tier on the root membership: GROUP or
BRANCH.** A membership created *on the root* is GROUP; a root row created as the side-effect of a
branch join is BRANCH. ⚠ **The row is still created, so `check:central`'s invariant stays green and
unmodified, and a branch member can still see the community they belong to.** Do not delete the root
row — that breaks twelve gates.

**Only the rights detach.** Ten of the twelve gates do not move; `canCreateBranchUnder` and
`inviteRightFor` do.

**1b. The two tiers, named in the UI:**
- **Group member** — invited at top level. May found a branch and become its manager; may invite at
  top level; may invite into branches.
- **Branch member** — invited into one branch. May invite others **into that branch**. May not found
  a branch; may not invite at top level.

**1c. Who may invite at top level:** community owner, community admin, and **branch managers**.
⚠ **A branch manager must be able to bring in another branch manager** — this is Charlie's decision
and it deliberately reverses CC's earlier branch-only recommendation. **Move `check:central`'s
assertion that a branch manager's right does not reach the community deliberately, with the reason
recorded. Do not relax it quietly.**

**1d. Who may invite into a branch: any member of that branch.** Deliberately open.
⚠ **Ejection is not.** Only the branch manager, community admin and owner may eject.
⚠ **And the trap CC found: `requireInviteRight` also guards revoke and restore.** Widening creation
must not widen those — **create opens; revoke and restore stay with the manager.**

**1e. Nobody joins any community or branch without an invitation or an approved request.**

**1f. Tier for the six existing rows: derived from how each joined, not defaulted to GROUP.**
⚠ It demotes exactly one row — `charlie@whatmusic.com`, who arrived through the Bermondsey branch
link on 6 August. **Expected and accepted.**

**1g. The dead controls.** `TeamsTree.tsx:257` and `FindYourBranch.tsx:55` must become tier-aware, or
"Create your own branch" appears and the API refuses.

**1h. The correction surface — Charlie's model depends on this, not on the gates.** An admin view
listing **everyone at group level**: who invited them, when, which branches they manage, and whether
they manage any. ⚠ **Sortable so that group members managing no branch — the anomaly Charlie is
watching for — surface without hunting.** He has chosen monitoring over gates, so the monitoring has
to be good enough to actually get used.

**1i. Vacant branches appear in the same view as an action item.**

## §2 — Branch ownership can move. Decided; build it.

⚠ **The gap, confirmed live:** ownership is a single `CommunityMember.role = 'OWNER'` row, written by
only two code paths — creating a community and creating a branch. **Nothing can make an existing
member the owner of anything.** `rossengineering56@` owns Cramlington and Killingworth, `cl@` owns
Bermondsey, and none of the three can change hands except by deleting the branch and losing its
board, questions, resources and every membership.

**2a. Build vacate and appoint**, keeping the existing guards. ⚠ **Do not relax `setMemberRole`** —
that would make a node takeable by a co-admin, which is what the guards are for.

**2b. Vacate applies to branches only.** ⚠ Vacating the root leaves `inviteRightFor`'s "the owner
always holds the right" with nobody.

**2c. Appoint demotes any incumbent in the same transaction.**

**2d. The Members panel renders no role or removal control for an OWNER row.** ⚠ **This is the bulk
of the work, and without it 2a–2c exist and are unreachable.**

**2e. Demotion from GROUP to BRANCH includes resigning any branch ownership in the same action.** The
person becomes an ordinary member of that branch.

**2f. The branch is not deleted and does not change hands automatically. Its manager position becomes
vacant** and stays vacant until someone is appointed. ⚠ **Real branches sometimes have no chair; the
product must be able to represent that.** A vacant branch is not an orphan — ancestors still manage
it.

**2g. Decision 50 — a community admin may vacate a chair without their agreement.** ⚠ Charlie's
governing principle: *who the branch manager is sits outside this system; it is a matter for the
party, and the product reflects that reality rather than deciding it.* A system that can only record
a consented resignation cannot represent a real organisation.

**2h. Decision 51 — a vacate must record a reason, required.** ⚠ A vacancy with no recorded reason
later reads as a bug rather than a decision, and Charlie has made branch chairs accountable, so why
one was removed is part of that record.

**2i. Resign and nominate.** A branch manager may resign and nominate a replacement, **subject to
admin approval.** ⚠ **Assert both directions:** a pending nomination confers nothing; an approved one
transfers.

**2j.** Fix `leaveCommunity`'s dead end.

## §3 — Carried over, small

**3a.** Four live invite links still advertise 50 uses. **Set them to 1.** Since every use raises a
request rather than joining, the number buys nothing and misleads whoever reads it.

**3b.** Confirm by **re-reading the row** that the fixture user
`check25a+a8652576+owner@example.invalid` is gone. ⚠ CC has corrected itself on this twice and the
sweep it wrote has never run.

## §4 — Three decisions still open. Report on them; build nothing.

⚠ **These have been put to Charlie and not answered. Put them to him again in the report, briefly.**

**4a. Onboarding is skipped entirely.** The sign-up component's redirect overrides the onboarding
page, so **age, terms and experience level have never been collected from anybody.** Report what it
would take to fix, and how many existing accounts have no terms acceptance recorded.

**4b. A new member's dashboard says "You're not in any Communities or teams yet"** and its most
prominent onward control is **Create Community** — so a lost branch chair's best-signposted next step
is founding a rival community. ⚠ **Report only; the shape of a first-run experience is Charlie's
design call.**

**4c. Points.** One person may mint 144 a day unaided, evidence optional and read by nothing.
CC's recommendation is a post-hoc digest to branch managers with one-click reversal, sequenced after
§1 so there are managers to send it to. ⚠ **One change is available immediately and independently:
take `GAVE_TRAINING` off the self-log list**, since the training flow already requires both parties
to agree and self-logging walks straight past it. **That is how 40 of the 64 points in the database
exist.**

## §5 — Acceptance criteria

- A branch member cannot found a branch or invite at top level; a group member can do both.
- A branch manager can invite at top level; the moved assertion is recorded with its reason.
- Any branch member can invite into their branch; none but the manager can eject, revoke or restore.
- The six existing rows are tiered by derivation, and `charlie@whatmusic.com` is BRANCH.
- "Create your own branch" does not appear where the API would refuse it.
- A branch can be vacated and re-owned, from the Members panel, by a real click.
- A vacate records a reason and cannot complete without one.
- A nomination confers nothing until approved; an approved one transfers.
- The group-level view surfaces members managing no branch, and vacant branches, without hunting.
- Invite links read 1.
- The fixture user is confirmed gone by a re-read.

## §6 — Say what only Charlie can confirm

⚠ **He is the only person who can act as a community owner in a browser.** List what he must check
rather than reporting render assertions as user-confirmed.
