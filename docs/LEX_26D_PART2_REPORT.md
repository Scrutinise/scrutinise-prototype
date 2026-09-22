# LEX 26-D PART 2 + DECISION 92 — grouping, and Lex files material from chat

**Date:** 2026-09-22 07:06 UTC. Continues `docs/LEX_26D_REPORT.md` (§1/§2, ordering, shipped
2026-09-20). This sprint built §3–§6 of `docs/BRIEF_26D.md` (grouping), reaffirmed §7 needs no
further work, and built the separate "Lex files material into the idea" feature (Charlie's
decision 92), verifying two of its own preconditions before building on them, as instructed.

## §3 — Manage mode

Built. A **Manage** toggle beside the "My ideas" heading puts a checkbox on every active-list
card (replacing the drag handle in that slot — dragging and bulk-selecting are different
intentions, so the two controls never show together) and reveals two actions: **Delete
selected** and **Group selected**, both disabled until at least one idea is ticked, both stating
the count once something is (§3b). Turning Manage off clears the selection (§3c).

## §4 — Delete selected

Built, and it does **not** re-implement the single delete. §4b asked this to be confirmed, not
assumed: the delete logic (owner check, idempotent re-delete, refusal once an idea is public and
carries other people's votes — `STAGE_4`/`STAGE_5`) was lifted out of the single-idea `DELETE`
route into one function, `deleteIdeaForOwner` (`lib/lex/idea-lifecycle.ts`), and **both** the
single route and the new bulk route (`PATCH /api/ideas/bulk`) call it — there is one delete
mechanism, imported twice, not two. Asserted in `check:lex-25r`: the bulk route contains no
`deletedAt: new Date()` literal of its own, and does call `deleteIdeaForOwner`.

§4a — the confirmation names the count and lists every title (`BulkDeleteDialog`, modelled on
the existing `DeleteIdeaDialog`, one dialog for the whole batch, not one per idea). Recoverable
exactly as a single delete is, through the same "N deleted → Restore" route, because it is the
same `deletedAt` mechanism. Partial success is reported, not swallowed: if one selected idea is
public and refused while nine others delete, the response says which one and why, rather than
either failing the whole batch or silently dropping the refusal.

§4c — the bulk delete control lives in the toolbar, never inside an `<a href>`, so the
anchor-nested-dialog bug class (26-C addendum §17/§21) has no surface to recur on here; it was a
structural property of where the control sits, not a rule to remember to re-apply.

## §5 — Group selected

Built. Choosing to group offers a text box for a new heading and, only when at least one group
already exists (§5b — absent, not an empty dropdown, otherwise), a dropdown of existing ones.
Moving an idea into a group removes it from whichever group it was in (§5c) — the bulk-group
route computes the set of vacated groups before the move and checks each afterwards.

§5d — an empty group (its last idea moved out, or its last idea deleted) is removed silently,
as recommended in this sprint's own §1 report and confirmed again here: `cleanupGroupIfEmpty`
(`lib/lex/idea-lifecycle.ts`) runs after every mutation that could empty a group — bulk-group
reassignment, explicit ungroup, and bulk/single delete — and is read-cold-checked by
`check:lex-25r`: every `IdeaGroup` row that exists in production is asserted to have at least one
live member (none did yet at the time of the check — see "What was checked" below).

## §6 — How groups appear

Built. A group renders as a named heading with its ideas beneath it, and three controls:
**Rename**, **Hide**, **Ungroup** (§6c — ungrouping returns its ideas to the ungrouped list;
nothing is deleted). Ungrouped ideas render above the groups (§6b); both are still governed by
the same drag order from §2 — grouping only changes which visual section a row's existing
position falls into, it does not touch `ownerOrderIndex` or the drag mechanism.

§6a — hiding a group removes its ideas from the open list, exactly as archiving used to, and it
is named, visible and reversible: a "N hidden groups (M ideas)" toggle, symmetrical with the
existing "N archived"/"N deleted" toggles, lists each hidden group by name and count with a
**Show** button.

§6d — the header count is `active.length`, computed before any group-visibility filtering is
applied to the render, so an idea inside a hidden group is still counted in "My ideas (49)".

## Data model (as reported in §1, confirmed as built)

One new table, `IdeaGroup` (id, ownerId, name, hidden, timestamps), and one new nullable column,
`Idea.groupId` — a single FK, so an idea belongs to at most one group by construction, matching
§1's recommendation of "one group at a time" without needing a uniqueness constraint to enforce
it. `onDelete: SetNull` so deleting a group (which happens only via the empty-group cleanup, or
implicitly via `ungroup`) never touches the ideas themselves. Migration `prisma/lex_26d_groups.sql`
applied to production Neon and committed together with the schema change, ahead of the rest of
the sprint, per the shared-tree rule.

## §7 — reaffirmed, not re-investigated

The 26-D §1/§2 report already answered this by querying production directly: no field
distinguishes an idea's owner or project beyond `creatorId` itself, so grouping is the only
existing mechanism that can separate "David's Starkey Thesis ideas" from Charlie's own. Nothing
new to add; no further work done here.

---

## Decision 92 — Lex files material into the idea, from the chat

### §4 — verified before building on it, as instructed

**Confirmed fixed.** The brief named the exact risk: findings extracted from a user's own
document used to be written at `runVersion: 1` and become invisible to every build after the
first (measured 3 September: 38 findings from four documents on one idea, all stranded against a
v9 build). This was fixed in **25-Y §1c**, before this sprint, via `evidenceForBuild()`
(`lib/lex/evidence-scope.ts`) — a read-scope predicate that exempts `USER_DOCUMENT` findings from
the per-build `runVersion` filter, imported (not re-implemented) by both `lib/lex/build.ts` and
`lib/lex/build-highlights.ts`. Re-ran `check:lex-25y` this sprint to confirm it still holds rather
than trusting the historical record: **18/0**, including a cold read against the same real idea
(`452c5ade`) — 38 of 38 user-document findings visible to a v10 build, and the finished-build
screen for v10 does carry them. **This had apparently never been reported to Charlie** despite
being fixed; it is reported now, with the evidence, precisely because the brief was right to ask
rather than assume.

### §5 — gov.uk fetchability, tested live, not assumed

Fetched five real government URLs from this environment just now:

| URL | Result |
|---|---|
| `gov.uk/government/publications` | 200 |
| `legislation.gov.uk/ukpga/2010/15/contents` | 200 |
| `parliament.uk/` | **403** |
| `bills.parliament.uk/` | **403** |
| `hansard.parliament.uk/` | **403** |

**Confirmed exactly as the brief described: `gov.uk` and `legislation.gov.uk` fetch cleanly;
every `parliament.uk` subdomain tried returns 403 to a plain fetch.** This was not newly built —
`extractUrl` (`lib/lex/user-material.ts`, from 25-D/25-L) already classifies a 403 as
`'paywalled'` and returns the honest sentence *"That page answered HTTP 403 — it is refusing us
rather than missing. If you can see it, paste the text or upload the PDF and I'll read that"*
rather than a generic failure — so a link that was filed and could not be read has never looked
like one that was, at the mechanism level. What this sprint added is that the **chat-filing path
inherits this for free**, because it calls the identical `extractUrl` function — a Parliament link
pasted into chat gets the same honest refusal, filed as a gap (`logRejection`) and reported to the
user in the same turn (see §1/§2 below), not silently dropped.

### §1/§2/§3 — built

A URL in the user's chat message is filed **deterministically**, by the platform, before Lex is
ever called — not as a model tool-call Lex might or might not choose to make.
`lib/lex/chat-material.ts`'s `fileUrlsFromChat()` finds up to two URLs per turn (a conservative
cap on cost and wait), skips ones already filed on the idea (no duplicate fetch of a link
mentioned twice), and for each new one calls the **exact same** `extractUrl` → `createLinkMaterial`
→ `runMaterialFindings` pipeline the upload panel uses (`createLinkMaterial` was lifted out of the
upload route into `lib/lex/user-material.ts` this sprint specifically so both paths call one
function, not two that happen to agree today). The outcome — filed and how many findings, filed
but nothing useful, or refused and why — is handed to Lex as a new prompt block
(`materialFiledBlock`, `lib/lex/lex-client.ts`) that states plainly: *the platform already acted;
report this, never say you will file it, never invent what it contains, never send the user to
paste or upload something already listed here as done or refused.* This is what makes "Lex either
files it or says plainly why it cannot" (§1) a property of the system rather than a hope about the
model's judgement — Lex is never asked to decide whether to act, only to report what already
happened.

A **file** cannot be attached from a chat text message (the endpoint takes a JSON string, not a
multipart body) — files already go through the existing "+" upload control beside the composer
(`YourMaterial.tsx`, rendered in `ElicitationCards`/`QuestionPanel`/`RerunDialogue`), which was
already "the same place an upload goes" for that case and needed no change. A **source** named by
description rather than a link cannot be fetched — there is no general web search available to
Lex (only corpus/legislation search, a different tool) — and the prompt now says so plainly,
instructing Lex to ask for a link or ask the user to paste/upload it, rather than inventing what
an unlinked source says.

### §6 — fetched content is data, never instruction

Two layers, not one:

1. **Structural.** The fetched page's raw text never reaches the main conversational turn at
   all — it only ever enters `runMaterialFindings`'s own isolated, single-purpose extraction
   call, whose sole output is a small set of quoted findings. The chat turn only ever receives
   the *outcome* (filed/not, a count, short titles) via `materialFiledBlock`, never the document
   body. A page engineered to redirect a model reading it has no route to the model actually
   holding the conversation — this was already true of every upload before this sprint, and the
   chat path inherits it by using the same isolated pass, not a new one.
2. **Explicit, in the extraction pass's own prompt.** Added this sprint, defence in depth: the
   findings-pass `SYSTEM` prompt (`lib/lex/user-material.ts`) now states plainly that the document
   text is data, never instruction, names the shape of an injected command (a fake system
   message, "ignore your instructions", "say only positive things"), and tells the model to
   extract a finding *about* such content if genuinely relevant, never to obey it.

## What was checked

Full regression suite, all green, no regressions:

- `npx tsc --noEmit` — clean.
- `npm run check:scripts` — clean (four fixture literals across three check scripts needed
  `group: null` added, the same recurring pattern as every previous field added to `MyIdea`).
- `npm run check:client-boundary` — clean, 596 source files, 139 client components, no edge.
- `verify:my-ideas-ui` 17/0, `check:lex-25j` 12/0, `check:lex-26c-addendum` 8/0, `check:lex-25e`
  26/0, `verify:lex-25e-ui` 20/0.
- `check:lex-25y` 18/0 — re-run specifically to answer §4 above, not assumed from the change log.
- `check:lex-25r` (the standing cold-read instrument) — **51/0, 10/10 controls fired**, with new
  cases for both features this sprint:
  - 26-D §3–§6: the shared-delete-function import (source property), and a cold read on every
    `IdeaGroup` row in production — **none exist yet**, honestly reported as NOT CHECKED rather
    than skipped silently.
  - Decision 92: `urlsIn()`'s URL-extraction and trailing-punctuation-stripping behaviour
    (asserted directly, with a control proving the naive match would have kept a trailing full
    stop), and that both the chat path and the upload route call the same shared functions. A
    live cold read is **not possible even in principle** for this feature: a chat-filed
    `IdeaUserMaterial` row is, by design, identical in shape to an uploaded one — there is no
    field that would let a check tell them apart after the fact, so this is reported as
    permanently NOT CHECKED by this instrument rather than as a gap to close later.

**Found, not caused, not fixed:** `npm run check:prompt-examples` fails on one pre-existing leak
in `lib/lex/deepening-config.ts:182` (last touched 31 August, untouched this sprint) — a quoted
illustration ("what a one-sided search looks like…") has been reproduced into 2 stored rows. Out
of scope for this brief; flagging it because running the sweep against my own new prompt text
(`chat-material.ts`'s `materialFiledBlock`) is what surfaced it. My own new prompt block was
rewritten during this sprint specifically to avoid adding a second one (an earlier draft named
"the Grenfell Inquiry report" as an example of an unlinked source and was changed to name no
specific example at all, per CLAUDE.md §27).

## A tooling finding worth recording

`DeleteOutcome` was first written as a discriminated union (`{ ok: true; ... } | { ok: false;
... }`). Under this project's `tsconfig.json` (`strict: false`, so `strictNullChecks` is off),
`tsc` did not narrow the type on either branch of an `if (outcome.ok)` / `if (!outcome.ok)` check
— confirmed empirically, not assumed, by trying both phrasings and getting the same failure both
times. Rewritten as a flat interface with every field always present (`null` where it does not
apply) instead. Worth knowing before reaching for a discriminated union elsewhere in this
codebase.

## What only Charlie's browser can confirm

- Whether the checkbox hit-target (replacing the drag handle in Manage mode) is comfortably
  tappable on an iPad, the same caveat §2b already carries for the drag handle itself.
- Whether hiding a group and having its ideas disappear from the list reads as expected, versus
  needing a confirming toast or undo — nothing here prompts before hiding, since §6a calls it
  "reversible" rather than destructive, but this is a judgement about feel, not mechanism.
- Whether two bulk actions (Delete selected / Group selected) sitting side by side, both
  disabled until ticked, reads clearly at a glance — a render check can prove the disabled state
  is correct; it cannot judge whether the layout is legible.

## What was not touched

The three-panel workspace, per the brief's explicit instruction. No other in-flight feature
(archived-idea handling, the deleted-items view, ordering) was modified beyond what grouping
required to coexist with it.
