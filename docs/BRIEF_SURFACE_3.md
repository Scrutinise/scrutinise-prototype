# BRIEF — SURFACE 3: FOUR THINGS THAT PUT THE GRAPHS IN THE REPORT

**For:** CC-Search / CC-Surface (whichever session is free — this is deliberately one sprint)
**Written:** 3 September 2026, by CCh-Search
**Executes:** Charlie's decision of 3 September — the "shortly" list, for a report in progress
**Reads first:** `CROSS_REFERENCE_GRAPH.md`, `POSITION_GRAPH_DESIGN.md` §6 and §8,
`SEARCH_TO_LEX_POSITION_SOURCES.md`
**Format:** audit-then-build. No git during the sprint; one **`commit-surface-3.sh`** at the end.
Scoped commits by explicit path.

---

## §0 — WHY THIS SPRINT, AND THE ORDER TO DO IT IN

Charlie is writing a report **now**. Two graphs are built and measured; one is on screen but not in
the document, and the other has no caller at all. **Nothing here is new capability.** Every item
connects, labels or enriches something that already exists.

⚠ **Do the sections in order and ship each as it lands.** §1 and §2 are the ones that change the
report; §3 and §4 are valuable and can follow. **If time runs short, §1 and §2 are the sprint.**

⚠ **Do not let this grow.** If a job here needs new retrieval, new inference or a new data source, it
belongs in another sprint. Say so and move on.

---

## §1 — THE COVERAGE STATEMENT ON THE POSITIONS SURFACE

**Do this first. It is half a day and it is the difference between an honest gap and a misleading
silence.**

**What a user sees today:** positions for the people we hold records on, and **nothing at all** about
the people or periods we do not. **A silent gap reads as "nobody has a position", which is the exact
opposite of the truth.**

**What must be said, in ordinary words, wherever positions appear:**

- **The Commons division record we hold begins in March 2016.** Anything earlier is absent, not
  neutral. ⚠ This is why the famous conscience votes of 1966, 1990 and 2008 are missing, and why the
  free-vote detector correctly flags none of the abortion divisions we hold — the ones we have are
  Northern Ireland Regulations, which were whipped.
- Which signal types contributed, and which were searched and found nothing.
- ⚠ **Two signal types have no source data at all** — amendment sponsorship and committee membership.
  They are printed by name on every run rather than silently skipped, and the surface must do the
  same.
- That stance scores are **estimates that have never been scored against a verified answer key**,
  while the recorded acts beneath them are facts.

⚠⚠ **Generated from live state on every call. Never a hardcoded sentence.** The cross-reference graph
already does exactly this and a check fails its build if any string in its coverage module states a
figure about the corpus. **Follow that pattern; do not invent a second one.** A hardcoded caveat goes
stale silently, and this project has had one figure survive being retired twice by living in a
comment.

**Check:** watch it fail against a build with the statement hardcoded, and against a build where a
signal type with no data is omitted rather than named.

---

## §2 — POSITIONS INTO THE GENERATED DOCUMENT

**LEX 25-M's audit found `POSITIONS` is the one heading with no carrier** — 25-L put a live beta
surface there, not a snapshot field. So positions are on screen and **not in the document Charlie is
producing.**

- Give `POSITIONS` a carrier in the snapshot, in the same shape as every other heading.
- ⚠ **The document is frozen at publication; the graph is not.** A position written into a proposal
  version must be **the position as it stood then**, with the date and the config version that
  produced it. A document that silently re-renders against a changed graph is a document that says
  something different to two readers.
- ⚠ **The evidence travels with the claim into the document.** On screen the evidence is one click
  away; in a printed report there are no clicks. **Every position in the document carries its
  supporting acts — the vote, the date, the source — or it does not go in.** A position without its
  evidence is an attribution we cannot defend, and one wrong one costs more than the feature is
  worth.
- ⚠ **Carry §1's coverage statement into the document too**, at least once. Same reason.

⚠ **This file is Lex-owned.** If the carrier belongs in their code, **report the exact change and
coordinate — do not edit their files.** Charlie can relay it in one message.

---

## §3 — COMPANIES HOUSE ENRICHMENT (CHARLIE IS SETTING UP THE ACCOUNT)

**89,861 Electoral Commission records currently produce 244 usable signals** because organisations
resolve on an exact key only. **14,879 of those records already carry a Companies House number we do
not hold** — roughly **eleven times** the current yield.

⚠ **The important property: we are not searching for matches. We already hold the exact identifier.**
This is a lookup by key, not a fuzzy match, so it **cannot** create the wrongly-merged identity that
is the real danger with register data. **Keep it that way: never merge two identities on similarity,
and never fall back to name matching when a number fails to resolve.** A number that resolves to
nothing is recorded as unresolved and **counted**.

- Use the public Companies House API. Report the rate limit, the elapsed time, and the resolution
  rate as a percentage of the 14,879.
- ⚠ **Persist the identifier and the canonical name, not a judgement.** A company record is not a
  position; it is what makes a position attributable to a real, checkable organisation.
- Report the signal count before and after. **The prediction is ~11×; record it before running.**

---

## §4 — DONATIONS AS A GRADED, USER-CHECKABLE SIGNAL

Charlie's design, and the beta loop is the right place for it because **users can answer this better
than we can.**

**The tiers, and they are the whole of the design:**

| pattern | what may be said | confidence |
|---|---|---|
| sole-party donor, repeated over years | likely sympathetic to that party's general direction | moderate |
| single one-off donation | the same, weakly | low |
| **donations to more than one party** | ⚠⚠ **no direction at all — and say so explicitly.** That is a fact about seeking access, not about belief | **none** |

⚠⚠ **The hard line, and it must be enforced in code rather than in wording.** A party-level alignment
**can never support a claim about a specific proposal.** Trade unions donate to Labour and campaign
against particular Labour policies; corporate donors frequently give for access rather than
agreement. *"Likely sympathetic to this party's general direction"* is defensible. *"Supports your
bill"* is not, and is the sentence that would be quoted back at Charlie.

- Assert it: **a donation-derived signal cannot contribute direction to a position on a specific
  target.** Construct the case and watch the check fail without the guard.
- **Separate the fact from the guess on screen.** *"Donated £50,000 to X in 2019, and to no other
  party"* is a fact with a citation. The inference sits beneath it, labelled, and is never the
  headline.
- **Beta, opt-in, with the one-click verdict** — right · wrong · not sure. ⚠ **Show the donation
  record first and our guess second**, exactly as LEX 25-L did for positions: the sourced record, the
  user's judgement, *then* our assessment revealed. That design is right and this must not weaken it.
- ⚠ **A verdict is a signal, not a truth.** Store verdicts as observations with who, when, and the
  config version. **One verdict must not overwrite an estimate**, and how they aggregate is Charlie's
  decision — put it to him with options.

---

## §5 — STANDING RULES AND THE REPORT

- Scoped commits by explicit path; `commit-surface-3.sh`; nothing owned by Lex, ingest, graph or the
  argument stream edited — report the change needed instead.
- Every check watched failing against the real broken state; **every guard states what it counted**,
  never whether something exists.
- ⚠ Auto-deploy is live on `vector-serve` for pushes touching `scripts/ingest/search/` — check nothing
  is measuring before pushing there.
- ⚠ **A redeploy is not a rebuild.** `/api/health` returns the deployed commit and the capability
  flags — use it to prove what is running.
- **Report `docs/SURFACE_3_REPORT.md`:** what a user sees now, per surface, in ordinary words. Then
  §3's before-and-after signal counts against the prediction. Then what is NOT done, named. Decisions
  for Charlie as numbered questions with a recommendation and the consequence of each.
- ▶ **Name what Charlie must click, and the signal that proves each part is live.** He is writing a
  report against this; a change he cannot confirm is a change he cannot use.
- Change-log and handoff entries labelled **SURFACE**.
