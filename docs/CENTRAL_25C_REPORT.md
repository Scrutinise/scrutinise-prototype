# CENTRAL 25-C — REPORT

**Run:** 2 September 2026, 11:00–12:00 UTC. **Mode:** continuous, per §0.
**Schema + migration:** `6495ead`, pushed together and first.
**Checks:** `check:central-25c` 43/0 (16 controls fired, 0 dead) · `check:central-25a` 134/0 (27
controls, 0 dead) · `check:central` **727/727**.

---

## 1. What shipped

| § | Built | Note |
|---|---|---|
| 1a | `CommunityMember.tier` GROUP \| BRANCH | ⚠ the root row is **still created**; only two rights detach |
| 1b | Both tiers named in the UI | header badge + the group-level table, with the rule in the title text |
| 1c | Branch managers may invite at top level | ⚠ the assertion was **moved with its reason recorded**, not relaxed |
| 1d | Any branch member may create an invitation into their branch | ⚠ revoke/restore/resend/eject did **not** move |
| 1e | unchanged — nobody joins without an invitation or an approved request | 25-A §3b already enforces it |
| 1f | Tier derived for the live rows | 1 demotion, **0 not determined** |
| 1g | The two dead controls are tier-aware | gated on the predicate the API decides with |
| 1h | `/communities/[id]/group-level` | the correction surface |
| 1i | Vacant branches in the same view | with the pending nomination named |
| 2e | Demotion resigns branch ownership | in the same action, through the one vacate path |
| 2i | Resign and nominate, subject to admin approval | asserted in **both** directions |
| 3a | The link generator now asks for 1 | the live rows already read 1 |
| 3b | Fixture user confirmed gone by re-read | ⚠ two *other* fixtures remain — see §4 |
| 4c | `GAVE_TRAINING` off the self-log list | ⚠ and it was **two lists**; now one |

§2a–2d, 2f–2h and 2j were built in 25-B. They were verified live and re-built nothing.

---

## 2. §1f — the derivation, row by row

Five ordered signals. Each row prints the one that decided it; a row no signal reaches is reported
**NOT DETERMINED** and left alone. **This is the output, not a summary of it:**

```
cl@scrutinise.org                         GROUP (unchanged)  FOUNDER — holds the OWNER row on the Community itself
rossengineering56@gmail.com               GROUP (unchanged)  ROOT_FIRST — joined the Community 43s before "Cramlington and Killingworth"
charlie@whatmusic.com                     GROUP → BRANCH ⚠   CO_CREATED_WITH_BRANCH — root row and "Bermondsey" written 0ms apart
chair.harrogateknaresborough@reformuk.com GROUP (unchanged)  INVITE_PROVENANCE — invitedVia an invitation to "Reform Branch Community"
ajaxhms@outlook.com                       GROUP (unchanged)  INVITE_PROVENANCE — invitedVia an invitation to "Reform Branch Community"

1 change, 0 not determined
```

⚠ **FIVE root membership rows, not the six the brief expected.** There are 8 `CommunityMember` rows
in total (5 on the root, 3 on branches) across 5 people. The one demotion is the one §1f predicted.

---

## 3. Three things found that the brief did not predict

### 3a. ⚠⚠ `check:central` has been RED since 25-B shipped, and it was leaking rows onto production

`check-central-stage1.ts` still asserted *"someone who owns a branch cannot leave the Community out
from under it"* — the refusal **25-B deliberately removed** when it fixed `leaveCommunity`'s dead
end. That one stale assertion failed; the teardown then died on
`CommunityMembershipArchive_communityId_fkey` — a foreign key that has existed since 25-A §3c and
that the teardown never handled — which **aborted the rest of the teardown and left three fixture
Communities on production per run.** The next run then counted those leaked rows as real
Communities and failed four *more* assertions about missing seeded categories.

One stale assertion → six red lines → rows on production. Assertion moved with its reason recorded,
teardown fixed, six leaked `zz-check-*` Communities swept, sweep re-read to zero. **727/727.**

### 3b. §3a was half done, and it was the half that mattered least that was done

All 12 live invitations already read `maxUses: 1` — 25-B decision 46 applied that. But
`CommunityDashboardClient.tsx` still generated new links with `maxUses: 10`, so the **next** link
Charlie made would have read 10 again. That is the half that was outstanding, and it is now 1.

### 3c. §4c was two lists, and taking the activity off one would have changed nothing

`LogActivity.tsx` held its own hard-coded copy of the four activities, with its own point values,
because the real list lived in `lib/central-points.ts` which imports `prisma` and so cannot be
imported by a client component. Removing `GAVE_TRAINING` from the server list would have left the
form still offering it, and vice versa. The list moved to `lib/activity-types.ts` (pure), both sides
import it, and ⚠ **the refusal is in `createActivityClaim`** — not only in the form, because the
route accepts any key a caller sends.

---

## 4. ⚠ Still on production, and not mine to sweep

Two fixture accounts from **23 August**, both LEX 25-E artefacts:

- `verify25e-7ab5eda9@example.invalid`
- `verify25e-fe656373@example.invalid`

`check:central-25c` prints them on every run so they cannot go quiet again. The 25-A fixture the
brief asked about — `check25a+a8652576+owner@example.invalid` — **is gone, confirmed by re-reading
the exact address.**

---

## 5. §4 — the three open decisions

### 4a. ⚠⚠ Onboarding is NOT skipped entirely. The brief's premise is measurably wrong.

`chair.harrogateknaresborough@reformuk.com` signed up on **1 September at 15:33 and completed all of
it**: `tcAgreedAt` set, `ageConfirmed` true, `experienceLevel: THINK_TANK_JUNIOR`. Three people who
signed up within the same 75 minutes recorded none of it — `ajaxhms@` (13:27), `mona@` (15:41),
`jones.graham7@` (15:48).

**So `/onboarding` works.** What routes past it is two lines in
`app/sign-up/[[...sign-up]]/page.tsx`:

- the community-invitation path: `forceRedirectUrl={landingFor(credential)}`
- the platform-invitation path: `forceRedirectUrl="/dashboard"`

A sign-up that reaches Clerk any other way still gets `ClerkProvider`'s
`signUpFallbackRedirectUrl="/onboarding"` from `app/layout.tsx`, which is how that one person got
there.

**How many accounts have no terms acceptance recorded: 27 of 36.** Nine have `tcAgreedAt`, all
version `1.0`; eight of those are from March–June, one from 1 September. **Of the seven accounts
created since 1 August, one has it.**

**What it would take to fix.** The naive change — point both redirects at `/onboarding` — costs the
thing 25-A §7a bought: an invitee currently lands back on the invitation they came from, one click
from being in, instead of on a dashboard that says nothing about why they signed up. The version
that keeps both is a **middleware gate**: send everyone to `/onboarding` and have onboarding carry
the intended destination forward, so the invitation is still where they land, after the three
questions rather than instead of them. That is roughly: one redirect param through
`app/onboarding/page.tsx`, the two `forceRedirectUrl` values, and a decision about the 27 existing
accounts — whether they are prompted on next sign-in or left alone. **Charlie's call; not built.**

### 4b. The empty dashboard. Reported only, as instructed.

Unchanged since 25-B measured it: a new member lands on `/dashboard`, is told *"You're not in any
Communities or teams yet"*, and the most prominent onward control points at `/communities`, whose
strongest control is **Create Community**. A lost branch chair's best-signposted next step is
founding a rival community. The shape of a first-run experience is Charlie's design call and nothing
was built.

⚠ One thing 25-C changes about it incidentally: a branch member no longer sees "Create your own
branch" inside a Community. It does **not** touch `/communities`' Create Community button, which is
the one 4b is about.

### 4c. Points — one change made, the rest sequenced behind §1.

**Made:** `GAVE_TRAINING` cannot be self-logged. Confirmed on the rows — the 40 points came from a
single claim by `cl@scrutinise.org` on 24 August with **no evidence attached**, and are 40 of the 64
points in the whole ledger. The training exchange still pays it, through `raiseClaim`, which is
untouched and requires both parties.

⚠ **This was built under §4's "build nothing" heading**, because §4c names it as available
immediately and independently and gives the reason. It is one flag on one list and is trivially
reversible. Flagging it rather than burying it.

**Still recommended, still not built:** the post-hoc digest to branch managers with one-click
reversal. §1 has now shipped, so there are managers to send it to — the sequencing reason for
holding it is gone.

---

## 6. ⚠ What only Charlie can confirm — he is the only person who can act as a community owner

Everything below is **asserted in code and unverified in a browser.** These are render and route
assertions, not user-confirmed behaviour, and they are reported as such.

1. **`/communities/28c84ed1-…/group-level`** — open it from Teams → "Group level". Expect: a count
   sentence at the top, "Branches with no manager" (should say every branch has one), and a table of
   five members. ⚠ **`charlie@whatmusic.com` should read "Branch member"** and everyone else "Group
   member". That row is the whole §1f result, on screen.
2. **Sign in as `charlie@whatmusic.com`** and open the Community. Expect: **no "Create your own
   branch" button** anywhere, and the "Find your branch" panel's sentence ending at "ask to join
   one." with no offer to start one. That is §1g; it is the change most likely to look wrong if I
   have got the plumbing wrong, because it is an *absence*.
3. **The Members panel on Bermondsey**, as its owner — expect "Stand down as branch manager" **and**
   "Resign and nominate a replacement" on your own OWNER row. The second is new.
4. **Make a nomination and do not approve it.** Expect the branch to read as having no manager, the
   amber card to say the nominee is still an ordinary member, and Approve/Decline to be present.
   ⚠ **This writes real rows on the live Bermondsey branch** — it is reversible (approve it back to
   yourself, or decline) but it is not a dry run.
5. **Generate a shareable link** and check it reads **"used 0 of 1"**.
6. **Log offline activity** — expect **three** options, with "Gave a training session" absent.
7. Anything about a *branch member inviting into their branch* (§1d) needs a second real account in
   a branch; I could not confirm it in a browser and it is asserted in code only.

---

## 7. Judgment calls made, so they can be reversed

1. **Resend stays with the manager.** §1d names creation, revoke and restore; it does not name
   resend. Kept narrow. Cost: a branch member who created an invitation cannot send it again.
2. **`decideJoinRequest` keeps the narrow gate.** Approving a join request is admission, and
   widening `canInvite` would have widened it silently. §1d did not ask for that.
3. **A title's scope did not widen with §1c.** The role scope reaches the whole tree at the root;
   the title scope stays node-and-ancestors, because 25-A §7e's "rights only within it" is a
   separate decision.
4. **The tier is mirrored onto branch rows** and read only from the root row, so the table never
   shows two answers for one person. `setMembershipTier` writes them together.
5. **§4c was built** under a "build nothing" heading. See §5.
