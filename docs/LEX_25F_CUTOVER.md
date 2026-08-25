# 25-F §9 — THE `/ideas/build` CUTOVER: PREPARED, NOT EXECUTED

*Written 25 August 2026. Thread: LEX. Sprint 25-F §9.*

**The instruction: prepare the cutover, do not execute it.** `/ideas/build` will replace
`/ideas/create` as the entry point for a new idea; the flip happens after Charlie validates
the rebuild.

**Status after this sprint: the switch exists, it is wired to every creation entry on the
platform, and it is set to `create`.** Nothing about the platform's front door behaves
differently today than it did yesterday. `check:lex-25f` asserts that the default is
`create` and fails if it is not — a "prepared" cutover that had quietly happened would be
the worst of both outcomes, because nobody would be watching for it.

---

## §9a — one switch, not a code fork

### What was built

| | |
|---|---|
| **The flag** | `PlatformConfig` row, key `newIdeaDoor`, value `"create"` or `"build"` |
| **The reader** | `scrutinise-web/lib/lex/new-idea-door.ts` |
| **The route** | `scrutinise-web/app/ideas/new/page.tsx` — reads the flag, redirects |
| **The write surface** | `PATCH /api/admin/config` (SUPER_ADMIN only, already logs to `ActivityLog`) |
| **The default** | `create`. Absent row ⇒ `create`. Unreadable value ⇒ `create`, loudly logged. |

### ⚠ Why it is a database row and not an environment variable

§9a's requirement is *"Flipping it must not need a deploy, and flipping it back must be
equally cheap — that is the revert path if the new door fails on a real user."*

**A Vercel environment variable does not satisfy that.** Changing one has no effect until
the project is redeployed. An env flag would make the *revert* — the thing you reach for at
the moment a real user is failing on the new door — a build-and-wait. `PlatformConfig` is
read per request: the flip and the revert are the same single write and take effect on the
next page load.

*(`LEX_NEW_IDEA_DOOR` exists as a second-precedence override, for a preview deployment or a
local run where nobody wants to write to the shared production database to try the other
door. It is not the switch.)*

### ⚠ Why every creation entry points at one URL rather than reading the flag itself

Half the creation entries are **client components** — `PublicNav`, `ui/Navbar`,
`DashboardClient` — which cannot read the database. A flag threaded as a prop would have to
be plumbed through three layouts, and a link somebody forgot to plumb would be a creation
entry silently stuck on the old door with nothing to notice it by.

So all seven now point at `/ideas/new`, which is a server route whose only job is to read
the switch and redirect. `export const dynamic = 'force-dynamic'` — a statically rendered
redirect would keep sending people to the old door after the flip, which is exactly the
failure the "no deploy" requirement exists to prevent.

### How to flip it

```
PATCH /api/admin/config    { "newIdeaDoor": "build" }     # as SUPER_ADMIN
```

Or, equivalently, one row:

```sql
INSERT INTO "PlatformConfig" (key, value, "updatedByUserId", "updatedAt")
VALUES ('newIdeaDoor', '"build"', '<charlie-user-id>', now())
ON CONFLICT (key) DO UPDATE SET value = '"build"', "updatedAt" = now();
```

### How to revert it

The same write with `"create"`, or `DELETE FROM "PlatformConfig" WHERE key = 'newIdeaDoor'`
— the absent row is the default. **Both take effect on the next page load. Neither needs a
deploy.**

---

## §9b — what is being replaced, precisely

`/ideas/create` is **two things**: the creation entry for a new idea *and* the editing
surface for an existing one. **Only the first moves.**

### Moved (creation entries — no `?ideaId=`)

| File | Control |
|---|---|
| `app/dashboard/DashboardClient.tsx` | "Create new idea" |
| `app/dashboard/DashboardClient.tsx` | "Start your first idea" (empty state) |
| `app/ideas/page.tsx` | "develop your idea" (empty state) |
| `app/page.tsx` | "Get Started" (homepage CTA) |
| `components/PublicNav.tsx` | "Create" (desktop) |
| `components/PublicNav.tsx` | "Create" (mobile menu) |
| `components/ui/Navbar.tsx` | "Create" |

### NOT moved (editing surfaces — every one carries `?ideaId=`)

| File | Control | Who touches it |
|---|---|---|
| `app/ideas/[id]/IdeaDetailClient.tsx` | "Edit" | a returning user |
| `components/lex/RecentIdeasPanel.tsx` | the previous-ideas list | a returning user |
| `app/ideas/build/BuildIdeaClient.tsx` | "Open …" after a build | the build's own handoff |
| `lib/email.ts` | the build-complete email | links already in people's inboxes |

**`check:lex-25f` asserts this list has not changed** — specifically, that no link carrying
`?ideaId=` points at `/ideas/new`, and that all four of the above still point at
`/ideas/create`. Nothing a returning user touches changes.

⚠ **The build already hands off to the editing surface and will continue to.** After a
build finishes, `/ideas/build` links to `/ideas/create?ideaId=…`, which is exactly what
§9b asks for. That is unchanged by this sprint.

---

## §9c — THE INVENTORY: what the old door has that the new one does not

This is the section the brief asks for by name, *"Losing the tour because it lived on the
old route would be a silent regression, and the tour was itself a fix from §19-D."*

⚠ **Read the two columns before the list.** After a build completes, `/ideas/build` hands
off to `/ideas/create?ideaId=…`. So a feature that lives in the three-panel view is not
*lost* by the cutover — it arrives **later**, after the build, instead of being present
from the first keystroke. That distinction decides which of these are blockers.

### A. GENUINELY LOST at the creation entry — nothing on `/ideas/build` provides them

| # | What | Where it lives | Why it matters |
|---|---|---|---|
| **A1** | **"How this works" — the guided tour** | `components/lex/HowItWorksModal.tsx`, opened by a prominent blue pill in `CreateIdeaClient`'s header | ⚠⚠ **The brief's named risk.** The tour was restored as a fix in Sprint 1.3 Task 2 and made prominent in 1.4. **`/ideas/build` has no help affordance of any kind.** |
| **A2** | **The FAQ view** | the same modal's second view ("Read the FAQs →") | The only FAQ surface inside the product. |
| **A3** | **The first-idea modal** | `CreateIdeaClient`: `showHelp = isFirstIdea`, where `isFirstIdea = ideaCount === 0` | On a user's very first idea the walkthrough opens unprompted. Nothing equivalent exists on the new door. |
| **A4** | **The first-idea intro bubble** | `app/ideas/create/page.tsx` `FIRST_IDEA_INTRO` — the verbatim three-panel explanation, then the first question as a separate bubble | §13 Task 5. This is what tells a first-time user what the platform *is*. |
| **A5** | **The returning-user greeting** | `app/ideas/create/page.tsx` — *"Good {morning\|afternoon\|evening} {preferredName}. What's the problem you want to fix? …"* | Addresses the user by their **preferred name** (`preferredName` → `firstName`). The elicitation's opening ask is impersonal and carries no greeting. |
| **A6** | **"Say the word" → the tour** | `CreateIdeaClient` `HELP_INTENT` | Typing *"how does this work"* opens the walkthrough rather than burning a Lex turn. |
| **A7** | **Feedback capture** | `CRITIQUE_INTENT` + `FeedbackDialog` (§20.5) | The offer appears where the criticism was made, plus a permanent affordance above the input. **The new door has no feedback route at all** — which is a strange thing to lose on the door whose whole purpose is being validated by a user. |
| **A8** | **Exit, with an unsaved-work guard** | `CreateIdeaClient` §19-C Task 7 — Save & exit / Discard / Stay | `/ideas/build` has no Exit control. |

### B. DEFERRED, not lost — the handoff restores them after the build

| # | What | Note |
|---|---|---|
| B1 | The three panels + mobile tab bar (chat / progress / background) | present at `/ideas/create?ideaId=` |
| B2 | `FieldsPanel` — direct field editing, the causes/options/actions loops, cost lines, "Change" | ditto |
| B3 | `BackgroundPanel` — legislation panel, stage search, retry-after-failure, "Ask Lex about this" | ditto |
| B4 | `DeepeningPanel` + `AgendaPanel` (25-C's review agenda) | ditto — and the agenda renders nothing until a build has completed anyway |
| B5 | Free-form chat with Lex (`/api/ideas/[id]/lex`), with a one-shot retry | ditto |
| B6 | "Continue to …" page advance, and §19-D Task 3's go-to-page | ditto |
| B7 | The in-chat accept card for Lex-proposed scalars | ditto |

### C. What the NEW door has that the old one does not

The four-question elicitation and its confirmation step; the build harness with named
passes, spend and cancel; the resume-by-URL behaviour (25-E §2); the temporary
previous-ideas panel; and — new in this sprint — `BuildFindings`, the cited findings and
named sources on the screen.

### ▶ The recommendation

**A1–A6 should be built onto `/ideas/build` before the flag is flipped.** They are the
first-run experience, and losing them means a first-time user's introduction to the platform
becomes a bare question with no explanation of what they have walked into. A1 in particular
is a regression the brief has already named.

**A7 (feedback) should be built too, and arguably first**: the entire point of the flip is
to find out whether the new door works on real users, and it would ship without the control
that lets them say it does not.

**A8 (Exit) is a smaller item** — the build page is a single column with browser navigation
intact and no unsaved-box state to lose — but it is not nothing.

**None of these are in 25-F's scope.** They are the work the flip is waiting on, and this
section exists so that the flip is not made without them.

---

## §9d — the old elicitation stays

Nothing has been deleted. `/ideas/create`, `CreateIdeaClient`, `HowItWorksModal`, the
orchestrator, the field machine and every route behind them are untouched by this sprint
except for the seven link hrefs listed under §9b.

**Removing the old door is a later, separate commit** — and it cannot happen at all until
the flag has been at `build` long enough for the revert path to have stopped mattering.
Until then the revert is one write, and it only works because the old door is still there.

---

## The runbook, for the day of the flip

1. Build A1–A6 (and A7) onto `/ideas/build`. This document's §9c is the checklist.
2. Confirm the current state: `GET /api/admin/config` → `newIdeaDoor` reads `"create"`.
3. Flip: `PATCH /api/admin/config { "newIdeaDoor": "build" }`.
4. **Verify on the running site, not locally** (CLAUDE.md §20 check 4): load
   `https://www.scrutinise.org/ideas/new` signed out and confirm it lands on the sign-in
   page for `/ideas/build`; signed in, confirm it lands on the build door.
5. Watch. The revert is `PATCH … { "newIdeaDoor": "create" }` and takes effect on the next
   page load.
6. Only once it has served real ideas without incident, open the separate commit that
   removes the old elicitation.
