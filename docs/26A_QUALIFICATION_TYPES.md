# 26-A §5 — can the "one object" trick be applied to the other four?

Written 4 September 2026. **Report only; nothing in this document is built.**

> Five times in one week, correct data reached the output stripped of the thing that made it
> correct. Three rules were written — §25, §26, §27 — and each was followed by another instance.
> A rule asks an author to remember. A type that cannot be split removes the possibility.

---

## §5c first, because it is the answer that changes what to do

⚠⚠ **The five are not one fault, and a shared type would not touch three of them.** That is the
honest view and it is worth more than an agreeable one, so it goes first.

The positions case has a specific shape: **a claim and its justification are produced together,
by one function, and travel together to one renderer.** The type works there because there is a
single construction point to put it at. Sort the five by whether they have that shape:

| # | what travelled | what was dropped | one construction point? | would a type fix it? |
|---|---|---|---|---|
| 1 | a likely position | its grounds | **yes** — `positionForDocument` | ✅ **done, and it works** |
| 2 | a challenge | its title | **yes** — `SnapshotIssue` in one map | ✅ **yes** |
| 3 | a policy | its sort and reasoning | **yes** — `SnapshotOption` in one map | ✅ **yes, but weaker** |
| 4 | a citation | its real address | **no** — the URL was *constructed*, not dropped | ❌ **no** |
| 5 | an accepted field | the acceptance | **no** — a status overwritten by a later write | ❌ **no** |

### Why 4 and 5 are different faults wearing the same coat

⚠ **The citation (25-V) was not a dropped qualification. It was a WRONG VALUE.** The builder
composed `committees.parliament.uk/publications/{n}/html/` from an id belonging to a different
address space, and produced a working link to somebody else's document. Nothing was stripped;
something was manufactured. A non-empty-tuple type cannot help — the field was populated, and
populated wrongly. **What that class needs is a verifier, and 25-V built one**
(`npm run verify:citations`).

⚠ **The accepted field (25-X) was not a rendering fault at all.** The acceptance was destroyed
at the *write* path — `setStatus` had no ACCEPTED guard — before any renderer saw it. A type
binding a value to its qualification would have travelled a correct object to a screen that
never got the chance to be wrong. **What that class needed was the guard, and 25-X built it.**

▶ **So the honest count is two, not five.** The recurring shape is real but it is **a seam
between a producer and a renderer where a field is optional and gets forgotten** — and only
challenges and policies still have it.

---

## §5a — the two that could take the same treatment, and the cost

### Candidate A — the challenge title *(recommended, see §5b)*

**Today:** `SnapshotIssue.title` is `string | null`, mapped in `proposal-snapshot.ts` and read by
three renderers. It was null on 186 of 225 rows until 25-W backfilled them, and **the field was
dropped by the mapper entirely for three sprints** — the row had a title and no document ever
printed one.

**The type:** a challenge becomes a discriminated union rather than an object with a nullable
field —

```
type SnapshotIssue =
  | { kind: 'titled';   title: string; text: string; … }
  | { kind: 'untitled'; text: string; … }
```

A renderer must handle both arms; there is no way to *forget* the title, because reading it
requires having narrowed to the arm that has it.

⚠ **And it keeps the honest case honest.** "Untitled" is a real state — 25-Q's rule is that a
title guessed downstream from the text is exactly what 25-D spent a sprint removing — so the
union preserves it rather than forcing a placeholder.

**Cost:** one interface, one mapper, three renderers, one fixture. **Roughly 60 lines, no
migration, no model call, no build.** Half a sprint section.

### Candidate B — the policy sort and its reasoning

**Today:** `kind`, `kindReason`, `sorted`, `mergedFrom` are all optional on `SnapshotOption` —
*deliberately*, because a stored snapshot published before 25-P has none of them and a required
field would be a lie the type tells about old rows. 25-V found the report printing one sentence
over 24 sorted, reasoned candidates.

⚠⚠ **This is where the trick gets harder, and the reason is worth stating: the optionality is
carrying real information — the snapshot's own version.** Making `kind` required would break
every historic document. The union has to be over the *snapshot version*, not over the option:

```
type SnapshotOption =
  | { sorted: true;  kind: string; kindReason: string; … }
  | { sorted: false; … }          // pre-25-P, or the sort has not run
```

**Cost:** larger — the option type has ten optional fields and they were added by four different
sprints. **A day, and it touches `assertRenderableSnapshot`.** Not this sprint.

---

## §5b — recommendation: the challenge title, and why it rather than the policy

**Do candidate A first.**

1. **It is the smallest and the cleanest.** One nullable field, one construction point, three
   readers. The policy case has ten optional fields put there by four sprints and needs a
   version-shaped union before it needs anything else.
2. **It has already failed once, visibly, and been fixed by hand.** 25-W backfilled 186 titles
   and widened the seam. ⚠ **Nothing stops the next field added to `SnapshotIssue` going the same
   way** — `sourceModel` and `runVersion` went through the identical mapper in the same commit,
   and either could have been forgotten. The type is what makes the *next* one impossible, which
   is the whole argument for doing this at all.
3. **It is the one where the failure is most visible to a reader and least visible to us.** A
   challenge with no title still renders; it just renders badly, in a wall of 79 paragraphs.
   There is no error, no empty box, nothing a check that reads the database would notice.
4. ⚠ **And it proves or disproves the idea cheaply.** If a union over titled/untitled turns out
   to be ceremony that authors route around with a helper that flattens it back to
   `title ?? ''`, we will know in sixty lines rather than in a day — and that finding is itself
   worth having, because it would mean the positions case worked for reasons that do not
   generalise.

⚠ **Do not attempt all four.** Two of the five are not this fault, and forcing them into it would
produce a type that fits neither.

---

## What this does not fix, and should be said plainly

⚠ **A type cannot make a qualification *good*.** It can only make it *present*. The positions
type guarantees that grounds exist; it does not guarantee that the grounds are relevant — and
§1's finding today is precisely that: a well-formed claim, carrying real dated acts, about a
machinery-safety regulation, under a civil-service proposal. **The type held perfectly and the
output is still wrong.**

That is the boundary of this idea, and it is where the next one has to start.
