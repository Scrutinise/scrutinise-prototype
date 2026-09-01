# BRIEF — Sprint 25-S: make the diagnosis workable and the sort visible

**Thread:** LEX. **Written:** 1 September 2026, evening.
**Source:** Charlie's decisions of 1 September, following 25-R.

## §0 — Run mode and ordering

**Continuous.** Diagnose, record in the CHANGE_LOG, proceed — including where a finding contradicts
this brief. Batch the rest into one report. **Stop only for** spend beyond a ceiling or a change of
scope. Shell per CLAUDE.md §22.

⚠ **CLAUDE.md §26, the cold read, applies to every check in this sprint.** A check takes a subject it
did not create and did not touch, and calls only what the browser calls. It was written this
afternoon because three sprints in a row shipped features that passed their checks and rendered
nothing. **This is the first sprint that has it available from the start — use it.**

**§1 is the highest value and the reason for the sprint. §2 and §3 in order. If the sprint runs
long, stop at a section boundary.**

**Must not be disturbed:** the collapse behaviour set by the 25-R addendum — sections collapsed after
a build, with the worklist as the entry point and the minimal Lex welcome. The stable policy
numbering. The commentary at the top of the causes. Everything 25-Q shipped on Stage 1.

⚠ **A CENTRAL session may be running in this repository.** Commit by explicit file path only. Never
`git add -A`. `package.json` is contended — if you need to add a script, say so and report the
conflict rather than resolving it.

---

## §1 — The sort has to show its working

⚠ **Charlie's finding, and it is the right one: he cannot tell whether the sort ran, because a sorted
list looks exactly like an unsorted list.** His own suggestion is the fix — a line on each card
showing where it came from.

⚠ **This is the same failure as the three in 25-R, one level up.** Those three produced correct data
that never reached the screen. This one reaches the screen and says nothing about itself. **A result
the user cannot distinguish from no result is not a result.**

### 1.1 Group the list under headings that state the sort

The guiding policy section renders as groups, each with a count:

- **Guiding policies (5)**
- **These are really coherent actions (3)**
- **These restate your goal (2)**

⚠ **The headings are the sort.** A user seeing three named groups knows immediately that something
sorted them; a flat list tells them nothing however good the sorting was.

### 1.2 Every card carries one line of its own history

Charlie's phrase: *"a footer on the card saying 'moved from Guiding Policy' or something else to show
its journey."* One short line, in plain words, on every card that has a history:

- **Kept:** *"Guiding policy · attacks cause 3."*
- **Demoted:** *"Was a candidate guiding policy. Moved because it names a specific instrument rather
  than an approach — it implements policy 4."*
- **Set aside:** *"Set aside — this restates what you want, not how to get there."*
- **Clustered:** *"Alternative to 2 and 5 — all three attack cause 3."*
- **Merged:** *"Merged from 4 and 8."*
- **Restored:** *"Restored. Was rejected on 1 September because …"*

**A card with no history carries no line.** Do not invent one.

### 1.3 Every move Lex made can be undone

⚠ **25-P found the causal link was set on zero of eighteen rows, so the sort is Lex's judgement, not
a fact read off the chain.** A judgement the user cannot overturn is an imposition.

Every demotion, set-aside and cluster has an **undo** that returns the item to the guiding-policy
group with its original number. **Assert both directions:** undo restores it, and the item is
genuinely gone from the group it left.

### 1.4 Report whether the sort ran at all

⚠ `sortedAt` was null on every policy option in the database — the sort had never run outside a
check. **Report, from a real build, whether it now runs and what it produced**, and say plainly if no
build has run since. Do not report the code path as evidence that the build executes it.

---

## §2 — Causes: numbers, order, and nesting by dragging

**2a. Every cause carries a number**, shown on the card. ⚠ **Stable, exactly like the policies: the
number never changes when a cause is moved, nested or removed.** A removed 3 leaves a gap. **Why:**
Charlie refers to causes by number when instructing Lex, and a number that moves when the list moves
turns "cause 3 is wrong" into an instruction about a different cause.

**2b. Causes can be dragged into a new order.** The order changes; the numbers do not.

**2c. Dragging one cause onto another makes it a sub-cause of that one.** ⚠ **Report first what
nesting the data model already supports** — 25-M introduced nesting, and 25-O settled the direction:
stored root-down, displayed material-cause-up. Build the drag onto the structure that exists rather
than a second one beside it.

**2d.** ⚠ **Guard the loops.** A cause cannot become a sub-cause of its own descendant. Report what
happens today if it is attempted.

**2e. Undo.** A drag that nests can be undone, and the cause returns to where it was.

---

## §3 — The Map view should be a map

Today the List / Map toggle changes indentation. ⚠ **Charlie's words: "'map' just indents some a
bit."** That is a second list, not a map.

**3a. Map renders the causal hierarchy as a diagram** — Mermaid, or an SVG if Mermaid proves awkward
inside the panel. Report which and why.

**3b. The diagram follows the display convention already settled**: material cause upward, root
below. Do not introduce a second convention.

**3c.** ⚠ **Charlie is colour blind. Nothing in the diagram may be encoded by colour alone** — use
shape, position, and text labels. Numbers from §2a appear on the nodes, so the diagram and the list
refer to the same things by the same names.

**3d.** ⚠ **Report the panel width the diagram has to live in before building it.** The middle column
is narrow and resizable, and a diagram that only works at full width is a diagram Charlie cannot use.
If it will not fit, say so and propose what would — an expand control, or the diagram opening in the
research panel.

**3e. Indentation stays where it belongs.** Once Map is a diagram, the List view keeps the
indentation that shows nesting.

---

## §4 — Acceptance criteria

- The guiding policy section renders as named groups with counts, and the group names state the sort.
- Cards carry a one-line history where they have one, and none where they do not.
- Every move Lex made can be undone, asserted both directions.
- The report states, from a real build, whether the sort ran and what it produced.
- Causes are numbered; the number survives reordering, nesting and the removal of other causes.
- A cause can be dragged to reorder and dragged onto another to nest, and both can be undone.
- Nesting a cause under its own descendant is refused.
- Map renders a diagram, not an indented list, with no meaning carried by colour alone.
- Every check in this sprint is a cold read.

## §5 — Say what only Charlie's browser can confirm

Expect this to include the drag interactions, whether the diagram is legible at the panel's real
width, and whether the group headings and history lines make the sort visible to someone who did not
build it. **List them rather than reporting render assertions as user-confirmed.**
