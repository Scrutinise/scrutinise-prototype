# BRIEF — CENTRAL 25-A: a real invited user cannot log in, and nobody can see why

**Thread:** CENTRAL. **Written:** 1 September 2026.
**For:** a separate CC session from the Lex stream.
**Urgency:** a named person Charlie invited today is locked out right now. §1 is live-user-blocking.

## §0 — Run mode, and the shared-repository rule

**Continuous.** Diagnose, record in the CHANGE_LOG, proceed — including where a finding contradicts
this brief. Batch the rest into one report. **Stop only for** spend beyond a ceiling or a change of
scope.

⚠ **A second CC session is running sprint 25-R on the Lex stream in this same repository right now.**

- **Commit by explicit file path only.** Never `git add -A`, never a directory-level add.
- **Do not touch anything under the Lex build, panel or kernel paths**, and do not edit
  `CLAUDE.md`, `CHANGE_LOG.md` or `OPEN_ITEMS.md` other than by appending.
- If a file you need is also being edited by the Lex stream, **stop and report it** rather than
  resolving it yourself.

⚠ **Today's standing lesson, three hours old:** three features in three consecutive sprints shipped
with passing checks and rendered nothing to the user. **Every check in this brief must assert the
data present in the rendered page** — CLAUDE.md §25 — **with a control that stays false.** Where you
build a new surface, show one assertion red before the surface exists and green after.

---

## §1 — Diagnose the login failure. Do not build anything until this is reported.

**The symptom, exactly:** Charlie invited a person to a community. They followed the invitation. At
sign-in they are told **"couldn't find your account"**. A previous invitee, on the same flow, joined
successfully and created a branch.

⚠ **"Couldn't find your account" is Clerk's wording, not ours** — Clerk being the service that
handles sign-in. That matters: the failure may be happening before our code is reached at all.

**1a. Establish where the failure occurs**: at Clerk before our application sees the request, or in
our own membership lookup after it. Report which, with the evidence.

**1b. Report what actually exists for this person**, in both places and named separately:
- Is there a Clerk user? Under which email address and which sign-in method?
- Is there an invitation record on our side? For which email, in which community, with what status?
- Is there a membership row?

⚠ **Report each as a separate finding. "The invite exists" is not "the account exists".**

**1c. Rule in or out the four likeliest causes**, by measurement rather than by argument:
1. They were invited at one email address and are signing in with another — for instance invited at
   a work address and signing in with a personal Google account.
2. They are on the **sign-in** form when they have no account yet and need the **sign-up** form.
3. The invitation created our membership record but never created, or never triggered, a Clerk
   account.
4. The invitation expired or was consumed.

**1d. Compare against the one that worked.** The earlier invitee joined and created a branch.
⚠ **Diff the two journeys and report what differs** — this is the cheapest available evidence and it
should be gathered before any theory.

**1e. Report the fix, and separately report what Charlie can tell this person to do today** to get
in. He needs a sentence he can send them, not a code change.

## §2 — There is nowhere to see who has been invited

⚠ **Charlie's finding, and it is the real one: the main site's admin has a list of invitations and
their status; a community or branch owner has nothing.** He is running an invitation process blind.

**On the Teams page of a community or branch the owner owns, build a single list showing:**

**2a. Everyone invited directly**, with: name or email, when invited, by whom, and **status** —
invited / opened / signed up / joined / expired / revoked. ⚠ **The statuses must be distinguishable.**
"Invited" and "signed up but not joined" are different problems with different fixes, and today's
failure is exactly the case that falls between them.

**2b. Everyone who arrived through an invite link**, listed separately from direct invitations, with
when they arrived and what they are now.

**2c. Everyone who is currently a member**, with their role and when they joined.

**2d. Resend and revoke** on any pending invitation. ⚠ **Assert both directions:** a revoked
invitation can no longer be used, and a live one still can. A revoke that only hides a row from a
list is not a revoke.

**2e.** ⚠ **Report first whether the underlying records exist to populate this.** If invitations are
not recorded, or link arrivals are not attributed, say so — **that is a bigger finding than the
missing page, and it changes §3 completely.** Do not infer status from a membership row's existence.

## §3 — Held for Charlie's decisions

⚠ **Do not build §3 until Charlie has answered.** Report on it, build nothing.

**3a. Who may invite.** Charlie's rule is that only branch chairmen invite, and he cannot enforce it
because the link is open to anyone who has it. **Report what the permission model actually is today**
— who can invite, and whether the invite link is per-person or a single shared link anyone can pass
on. Those two are different products and the answer determines what can be enforced at all.

**3b. Removing a member from a community without removing them from the platform.** Report whether
this is possible today, and what happens to their contributions if it is. ⚠ **Archive, never
hard-delete** — a removed member's own writing is still theirs, and the standing rule is that
archiving hides something from the product without un-giving someone their own words.

**3c.** ⚠ **The question Charlie asked and it must be answered by measurement, not reasoning:** *if
person A invited person B, and A is later removed from the community, does B remain a member?*
**Membership must not cascade from the inviter** — an invitation is a single past act, not an ongoing
dependency. **Test it on real records and report what actually happens.** If any query joins
membership to its inviter, removal will silently take other people with it, and Charlie would find
out from a locked-out branch chairman rather than from us.

## §4 — Acceptance criteria

- The login failure's location is stated as measured — Clerk or our own lookup — not inferred.
- The presence or absence of a Clerk user, an invitation record and a membership row are each
  reported separately for the affected person.
- Charlie has a sentence he can send that person today.
- A community or branch owner can see, on one page: direct invitations with distinguishable
  statuses, link arrivals listed separately, and current members with roles.
- Resend and revoke both work, and revoke is asserted to actually prevent use.
- The report states plainly whether invitation and link-arrival records exist to build on.
- The inviter-removal cascade question is answered from real records.
- Every check asserts rendered data, with a control that stays false.

## §5 — Say what only Charlie's browser can confirm

He is the only person who can sign in as a community owner and see the Teams page as an owner sees
it. **List what he must check rather than reporting render assertions as user-confirmed.**
