# LEX 25-L — The re-run dialogue, the resource library, and mobile

**Run:** 2026-08-28, closing 10:25 UTC. **Thread:** LEX. **Brief:** `docs/BRIEF_25L.md`,
plus two mid-sprint amendments (§5 blind-first validation; two decisions and three rules).
**Mode:** continuous (§0).

---

## The headline

**§1–§6 are built, with three exceptions I did not build and say why. The three amendments
are done. And the two findings that matter most are both about the same thing: a required
field is not a requested one, and a check pointed at nothing passes for ever.**

⚠⚠ **Quality 1's cause was in the prompt, exactly where the amendment said to look — and it
is worse than "the model is not populating `drivenBy`".** Two passes write causes. The
**diagnosis** pass carries eight lines explaining `drivenBy` and builds the chain. The
**revision** pass declares `drivenBy` in its TypeScript type, **requires it in its JSON
schema**, and its prompt has never mentioned the field at all. `build.ts` then
`deleteMany`s the diagnosis pass's causes and replaces them with the revision's — correctly,
because two sets of causes on one idea is a duplicate. **So the chain was built and then
destroyed by a pass that did not know it existed**, and nothing ever errored, because `""`
is a valid string and the diagnosis prompt legitimately sanctions `""` for a root. Three
sprints reported this as a model failure. Fixed: one shared `DRIVEN_BY_INSTRUCTION`, given
to both passes, plus a line telling the revision pass that its causes REPLACE the earlier
ones so the chain must be rebuilt rather than inherited. **Recorded as a class in
CLAUDE.md §24** — third instance, after `citedIds` (29 Jul) and `citedMarkers` (8 Aug).

⚠⚠ **The nav is fixed in the file that renders.** `PublicNav.tsx` now says **My ideas**,
desktop and drawer. `check:lex-25j`'s nav assertion has been repointed at it and now
**proves the file it reads is reachable from a route** before asserting anything — the old
version read `components/ui/Navbar.tsx`, which nothing imports, and passed for a full sprint
with a negative control firing on every run.

---

## The three amendments

**1. A failed build does not spend the allowance.** Recorded, nothing built — §6 of 25-K is
still designed-and-unbuilt and nothing charges. The rule as you gave it: *spent = reached
DONE and drafted the kernel; FAILED, CANCELLED or died-before-output: not spent; ambiguous:
not spent.* That is the opposite of my 25-K recommendation, which was to charge on DONE only
but record failures against the user "so the abuse is visible before it is priced" — your
rule is the same charging behaviour plus an explicit tie-break, and the tie-break is the
part I did not state. It is now the design of record in `docs/LEX_25K_REPORT.md` §6's terms;
**the first line of the allowance implementation should be a test that a FAILED build leaves
the balance unchanged.**

**2. The nav.** Done, above.

**3. Quality 1.** Done, above. Prompt read before code, as instructed.

**4 and 5 are now CLAUDE.md §23** — a check asserting on a source file must also prove that
file is reachable from a rendered entry point (§23.1), and a sweep must report checks **run**
as well as checks **passed** (§23.2). `scripts/reachability.ts` implements the first as
`assertReachable()`; `check:lex-25l` uses it on every component this sprint adds, with the
dead `Navbar.tsx` as its negative control.

---

## §1 — The re-run dialogue

The button no longer fires. Pressing **Re-run this idea…** opens the question, close to your
wording, and everything goes in before anything starts: free text, multiple files, multiple
links, in one place.

- **The critique is an instruction, not a note.** `critiqueBlock()` in `build-config.ts`
  wraps it in *"⚠ ACT ON THIS"* with three things to do per point — change it, add it, or
  say plainly why you did not — because 25-F found that material supplied to a pass without
  an instruction is material the pass ignores. ⚠ **It does not demand agreement**: a user can
  be wrong about what was wrong, and a pass told to obey would produce a draft that flatters
  them. ⚠ It is labelled **testimony** and may never be cited as a source.
- **Stored on the build that received it**, not on the idea — so version N carries what N was
  asked to fix about N-1. Four critiques on the idea would be a heap with nothing saying
  which attempt each was about, which is the information that makes it a quality signal.
- **Shown back to the user**, above the findings, because someone who wrote three paragraphs
  and then watched a progress bar has no other evidence any of it was carried.
- **Visible to us** at `GET /api/admin/lex-signals` — verbatim, admin-gated, no email. It
  does not mail because a re-run critique happens on every re-run, and mailing each would
  train us to filter the address that also carries the rare ones.
- **Both prices are stated before go**, and the reuse answer **recomputes** — adding a
  document is exactly the thing that can change it, and it is the thing the dialogue invites.
- ⚠ **The box may be left empty**, and the copy says so. A gate would make a user invent a
  criticism, and an invented one would then be fed to the passes as an instruction.

## §2 — Material we cannot read

A video link is now refused **before the fetch**, naming the way in: *"I can't watch video.
If there's a transcript — YouTube usually has one under the video — paste it or upload it
and I'll read that."* ⚠ **Nothing fetches a transcript**, and `check:lex-25l` greps the whole
sprint's source for `youtubei|timedtext|get_video_info|youtube-transcript` to keep it that
way. §2 defers that decision and this is the evidence base for it.

- ⚠ **The old path refused a YouTube link with "that page had no readable text — it may be
  built entirely in JavaScript."** True (it is an app shell), useless, and it sent the user
  looking for a fault in their own link.
- **Eight kinds, each a different thing to do next** — video, paywalled, unreadable-format,
  no-text, too-large, unfetchable, not-a-url, too-many. Detection is a **host list plus the
  server's own `content-type`**, never a keyword: a false positive refuses something we could
  have read and tells the user we cannot do something we can.
- **Every refusal is logged with its kind and its target**, and the per-idea cap is logged
  too — the one rate we already knew and had never recorded.
- **The gap survives the moment.** Refusals render in `YourMaterial` under *"Given to me, and
  not read"*, and the actionable kinds become agenda gaps tagged **`only-you`** — a video's
  transcript is theirs to fetch, and filing it as `research` would put it on our list where
  nothing would happen to it.
- `/api/admin/lex-signals` breaks the log down **by kind and by host**, with **every kind
  present including the zeroes** — "we have had no video links at all" is precisely the
  answer §2 is waiting for, and a `groupBy` alone would omit it.

## §3 — The right-hand panel is a resource library

**3a.** It opens on a **contents list**; choosing an item shows that item; **Contents** takes
you home. ⚠ The home control is a **word, not a bare chevron**: a user two items deep needs
to know what it returns them to.

**3b.** The contents are **driven from the passes**. `headingsWithProducers()` computes, from
the interrogation library and the deepening pass configs, which headings something can
actually write under — so a new pass appears without a code change, and "nothing can answer
this" is no longer a hand-maintained list that could only be right by accident. Every empty
item stays on the list and says **which kind of empty** it is — never a `0`, which beside
"How the courts have read it" would be a false statement about the world.

**3c. ⚠⚠ The smart pass's output was filed under `AGAINST` — "The strongest case against" —
which is why you could not find it.** "How hard will this be to pass", the barriers, the
likelihood, what is most likely to go wrong and what the critique would cut were written by
`recordPrognosis` with `headingKey: 'AGAINST'`, among the objections. **A prognosis is not an
objection**: an objection is something to answer, a prognosis is something to plan around,
and a user looking for "how hard will this be" had no reason to open a heading about the case
against their own idea. Two new headings: **How hard will this be to achieve?** and **Key
sources** (the critique's own reading list, which was in the same pile).

⚠ **Rows written before today keep `AGAINST`**, because the stored tag wins over the lookup —
that rule exists so a re-filing cannot rewrite history. **A scoped, reversible backfill is
prepared but NOT run**: `prisma/lex_25l_backfill_prognosis.sql`. One command, yours.

**3d.** Sources can now be **priority · listed · set aside**, and the tag is **not
decorative**: `PRIORITY` is a third enum value (one fact, three states — a separate boolean
would have allowed "excluded AND priority" to exist), the snapshot carries
`prioritySources`, and the proposal document prints them under *"The sources this rests on"*
before the annex. ⚠ **A frozen pre-sprint snapshot has no such key**, and re-rendering one
would have thrown — three cases, not two: absent (say nothing), empty (say nobody has
chosen), populated. Caught by `check:20bd`'s fixture; it would otherwise have been caught by
a user opening last week's PDF.

## §4 — Panel behaviour

All three panels hide and restore individually, each with a labelled edge; dividers drag
(pointer capture, so the drag survives leaving a four-pixel target, and arrow keys for anyone
who cannot drag); the layout **persists per user** in `User.lexPanelLayout` — ⚠ a column, not
`localStorage`, because §4 says per USER and a browser store is per DEVICE. There is a reset,
in the persistent bar rather than inside a panel you may have just collapsed.

⚠⚠ **`normaliseLayout` had a real bug that `check:lex-25l` found and reading did not.**
Clamping the small columns up to the minimum and then re-normalising pushed them straight
back below it — `{0.01, 0.01, 0.98}` returned a left column at **0.117** against a floor of
0.15. The arithmetic looks right until you run it. It now takes the deficit from the columns
that can afford it, iterated, with an explicit answer for the case where no layout can
satisfy the constraint.

**The roles are on screen**, from one shared table, because §4 is right that they were
inferred: *Lex · the draft · the resources*.

## §5 — The graphs, in beta, judged blind first

Built as amended. `POSITIONS` — the one heading that has never had a producer — now carries
the review surface.

- **The user sees the member, the question and the sourced record first**: what they did,
  when, and a link to each. ⚠ **Facts are never gated.**
- **They judge before we tell them**: supports · opposes · unclear · not enough here, with an
  optional reason. ⚠ *"Unclear"* and *"not enough here"* are kept apart deliberately — one
  says the record is mixed, the other says **our coverage** is the problem, which is the most
  useful signal this experiment can produce.
- **⚠⚠ Our assessment is not in the response until they have answered.** Not hidden in a
  field, not greyed out — **absent from the GET**. `claimFor()` returns the two halves
  separately and the route destructures only the question. A client-side reveal is one
  `view-source` away from being no experiment at all, and worse, it would have looked like one
  in every report written afterwards. `check:lex-25l` asserts it, with a control that plants
  the leak.
- **Both sides are stored, in order**, and the order is enforced **in the database** by two
  CHECK constraints — a reveal cannot precede a judgement, an agreement cannot precede a
  reveal — because the second writer added in six months will not have read the route.
- **Our claim is copied in at reveal time**, not joined later: the graph decays on every read,
  so a judgement scored against a live query weeks later would be scored against a claim that
  has moved.
- **Corroboration, not verification.** A disagreement flags for review and the UI says so —
  implying their answer had corrected the graph would be a claim we cannot honour. The
  agreement rate is returned **with its caveat attached**, because a number returned alone is
  a number quoted alone: *a partisan sample agrees with itself.* The denominator is **answered
  judgements**, not all of them — counting an abandoned tab as a disagreement would make the
  rate a measure of how many people finish a form.
- **Coverage is computed** from what the graph reported, never a written sentence.

## §6 — Mobile

The tab bar **moved to the bottom** — it was at the top, which is the one part of a phone
screen a thumb cannot reach, so switching mode meant a two-handed reach every time. Three
tabs, always visible, not swipe-only. **The draft tab carries a count** of what is waiting,
reported by the worklist itself so the badge and the list cannot disagree; ⚠ a **number and a
word**, never a coloured dot. Stage 1 has no tabs and needs none. Resources opens on its
contents.

---

## What I did not build, and why

⚠ **Citations opening as a sheet (§6).** **There are no citations in Lex's answers on this
surface to tap.** `components/lex/ChatPanel.tsx` contains no occurrence of `citation`,
`source` or a marker of any kind, and `lex-client.ts`'s prompt instructs *"Never put JSON or
field names in chatText"* — the idea-chat returns prose. The general-chat (`general-chat.ts`)
does carry `citedMarkers`, but that is a different surface. Building a sheet would have meant
first making the idea-chat cite, which is a feature in its own right and not one this brief
asks for. **Reported rather than faked.**

⚠ **"Case studies" as its own contents item (§3b).** It has **no producer distinct from
`TRIED_BEFORE` and `ELSEWHERE`**, both of which §3b lists separately. Adding it would have
created a permanently empty heading, and `HEADINGS_WITH_NO_PRODUCER`'s own rule is that an
entry there is a promise to remove it — a promise we would have no plan to keep. **Your call:
is "Case studies" a third question, or the two you already have?**

⚠ **A real-device test (§6).** Not possible from a CC session. The mobile layout is verified
by source assertion only; the bottom bar, the badge and the tab behaviour need your phone.
Everything else desktop-side has the same limit §0 states.

⚠ **The prognosis backfill.** Prepared and unrun — see §3c.

---

## Verification

✅ `check:lex-25l` **19 passed, 0 failed, 0 without a negative control** — every control
watched rejecting a broken copy. **Three of its assertions failed on first run and two were
real defects in this sprint's own code** (the layout clamp; one refusal thrown without a
kind), the third a check artefact fixed in the check.

✅ **Every check in the suite, run and reported (CLAUDE.md §23.2)** — not a selection:

| check | result | | check | result |
|---|---|---|---|---|
| `lex-25c` | 32 | | `lex-25k` | 18 |
| `lex-25d` | 77 | | `lex-25l` | **19** |
| `lex-25e` | 28 | | `deepening` | pass |
| `lex-25f` | 62 | | `panel-claims` | pass |
| `lex-25g` | 27 | | `documents` | pass |
| `lex-25h` | 20 | | `20bd` | 47 |
| `lex-25i` | 14 | | `never-claim` | pass |
| `lex-25j` | 12 | | `statutory` | 17 |
| `build-25a` | 40 | | `build-25b` | 54 |

Render harnesses, all four **executed**: `verify:stages-ui` 23, `verify:lex-25e-ui` 16,
`verify:lex-25g-ui` 14, `verify:my-ideas-ui` 15.

⚠ **Seven guards from five earlier sprints fired on this sprint's changes and were repointed,
not relaxed** — 25-D (heading count 11→13; the stated-gap property under the new layout;
the unbuildable-heading note), 25-G (both prices, now in the dialogue), 25-H and 25-J (the
panel-open shape gained a third panel), 25-K (the worklist's JSX wraps; the re-run's two
modes moved). Each still asserts the property it was written for, in the file that now
carries it.

✅ `tsc --noEmit` clean · `next build` clean · `check-clean-build.sh --fast` clean ·
`prisma validate` clean.

**Database:** `prisma/lex_25l.sql` applied to Neon `ep-old-dust-aboxi69a` — host checked with
`scripts/whichdb.ts` first, per §16. Additive only: two columns, two tables, one widened
enum, one JSON column. No drops, no rewrites, no backfill.

⚠ **NOT verified on the running site at the time of writing.** The schema is live and ahead
of the code, which is safe because every addition is additive and nothing reads the new
columns until this deploys.

---

## One contradiction between briefs, for you to settle

§6 names the middle mobile tab **"Proposal"**. 25-K §1 **retired "proposal" as navigation** —
that was your own diagnosis of why you got lost in your own product, and `check:lex-25k`
sweeps every screen for it. Two briefs cannot both be obeyed, so I kept the older rule about
**navigation** over the newer use of the **word**, and the tab and panel are called **"The
draft"**. Recorded at `lib/lex/panel-layout.ts`. Say the word and it changes.
