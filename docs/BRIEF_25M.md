# BRIEF — Sprint 25-M: the outputs, where the work is

**Thread:** LEX. **Written:** 28 August 2026.

## §0 — Run mode

**Continuous.** Diagnose, record in the CHANGE_LOG, proceed — including where a finding contradicts
this brief. Batch the rest into one report. **Stop only for** spend beyond a ceiling or a change of
scope. Shell per CLAUDE.md §22. Everything here is behind sign-in, so verify by check and render
harness and **say plainly what only Charlie's browser can confirm.**

**The point of this sprint:** a user finishes a build and there is nothing to take away without
leaving the page they are working on. **The documents exist; they are in the wrong place and they are
missing half the material.**

---

## §1 — Outputs belong in the right-hand panel, alongside everything else

The documents currently live only in the idea's Documents tab, reached from the dashboard. Charlie:
*"It's a bit disjointed having to go to the dashboard to find it."*

- **Add an "Outputs" item to the right-hand panel's contents list** (25-L §3a), alongside Relevant
  legislation, How hard will this be, Key sources and the rest.
- It lists what can be produced, what has been produced, and **when each was last generated** — the
  existing staleness fingerprint from Sprint 2.5.
- **Generating and downloading both happen there.** Leaving the working view to fetch your own work is
  the friction this removes.
- **The Documents tab remains** as the permanent home — same documents, same records, two doors. ⚠ **One
  generator, two places to reach it.** Two generators would drift, as two copies of anything here
  always have.

## §2 — The two documents

Both were built in 20-B over the shared snapshot. **This sprint is about what goes in them, not how
they render.**

**2a. The summary — about two pages.** The first thirty seconds of someone's attention: the problem,
the pivotal obstacle, the chosen approach, what it rules out, the headline cost against the problem's
cost, and the ask. ⚠ **Short on purpose, and it points at the full version for depth** — a committee
clerk reads two pages and follows a link.

**2b. The full write-up — everything.** The strategic kernel *and* everything the right-hand panel
holds:

- The kernel: problem, diagnosis and causes, the pivotal obstacle, the guiding policy, what it rules
  out, the coherent actions with their costs.
- **The prognosis** — how hard this will be to achieve, the barriers, the likelihood, what is most
  likely to go wrong, and what the smart pass cut and why. ⚠ *(Filed under the wrong heading until the
  backfill runs — see §5.)*
- **What else refers to this law** — the statutory consequences, grouped, with the coverage statement.
- What was tried before and what happened · where this mechanism works elsewhere · how the courts have
  read it · who has taken a position *(marked beta)* · the numbers · what is devolved · the strongest
  case against.
- **The user's own account, verbatim and attributed**, and their uploaded material's findings.
- The declared gaps and known unknowns — ⚠ **a gap stated is a strength; a gap omitted is a
  misrepresentation.**
- Sources: **priority sources in the body, the full list as an annex**, and set-aside sources listed
  as set aside with their reasons (25-L §3d).

## §3 — The snapshot has to carry everything the panel shows

`buildProposalSnapshot()` is the single thing the documents read (20-B §1). It predates the smart
pass's prognosis, the statutory-consequences pass and 25-L's tagging.

- **Audit what the right-hand panel can show against what the snapshot carries, and report the gaps.**
- Extend the snapshot to cover them.
- ⚠ **The renderers still read only the snapshot** — no document generator reaches into the deepening
  modules directly. That seam is what has kept the document stack stable through six sprints of change
  underneath it.

## §4 — The pilot allowance

Designed in 25-K §6, unbuilt, and **the last hard blocker on letting anyone else in.**

- **One free build per user.** Re-runs cost less, counted in thirds, because they reuse the research
  (measured at 48%).
- ⚠ **A failed build does not spend the allowance** — Charlie's decision. Spent means the build reached
  DONE **and** drafted the kernel. Failed, cancelled, or died before producing anything usable: not
  spent. **Ambiguous: not spent.**
- **The balance shows before a build starts**, beside the existing cost and duration line.
- **A hard stop when spent**, with a plain message and a way to ask for more — an email link is enough
  for a pilot. Reuse the existing `blockedReason` path rather than inventing a second one.
- **Admin can grant allowance** to a user.
- The counter is over `LlmSpend`, which already carries the user and the cost. **No new source of
  truth.**

## §5 — Loose ends from the format change

**5a. Run the prognosis backfill** — `prisma/lex_25l_backfill_prognosis.sql`. Until it runs, existing
builds file *"how hard will this be to achieve"* under **The strongest case against**, which is why it
could not be found. It prints its scope before writing. **Report the counts.**

**5b. Confirm `drivenBy` is populated in a live build.** The fix is a prompt change and reaching the
prompt has twice not been sufficient. ⚠ **Assert the value, not the schema** — `""` satisfies
`required`, which is how this was invisible for three sprints. **One build; report whether the causes
nest.**

**5c. Two rules for CLAUDE.md**, from that finding:
- **`required` means the key is present, not that the value is meaningful.** Where a populated value
  matters, the check tests the value.
- **When two passes write the same records and the second replaces the first, the second must be told
  everything the first was told.** A replace between passes with different instructions destroys work
  silently, and it looks like the field was never filled rather than like it was deleted.

## §6 — Acceptance criteria

- An **Outputs** item appears in the right-hand panel's contents; both documents can be generated and
  downloaded there; the Documents tab shows the same records; **one generator, not two.**
- The summary is about two pages and points at the full version.
- The full write-up contains the kernel **and** every section the right-hand panel holds, including the
  prognosis and the statutory consequences, with priority sources in the body and the full list
  annexed.
- The snapshot audit is reported, gaps named, and **no renderer reads anything but the snapshot.**
- One free build per user; a **failed build does not spend it**; the balance shows before starting;
  the hard stop is plain and offers a route to more; admin can grant.
- The backfill is run and its counts reported.
- A live build is run and **`drivenBy` is asserted by value** — report whether causes nest.
- The two rules are in CLAUDE.md.
- ⚠ **Say plainly which of the above only Charlie's browser can confirm**, rather than reporting a
  route probe Clerk answers identically for subject and control.
