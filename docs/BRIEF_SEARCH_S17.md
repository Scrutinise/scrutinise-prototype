# BRIEF — SEARCH S17: FIX THE INSTRUMENT, FINISH THE REACHABILITY, MAKE FLAGS VISIBLE

**For:** CC-Search
**Written:** 28 August 2026, by CCh-Search
**Executes:** `SEARCH_S16_REPORT.md` D-2 and D-3, plus the `/api/health` capability offer
**Format:** audit-then-build. **§1 produces a file for Charlie and scores nothing.** No git during
the sprint; one **`commit-search-s17.sh`** at the end. Scoped commits by explicit path.

⚠ **This is a small sprint on purpose.** `BRIEF_ARGUMENT_1A.md` runs in parallel and carries the
largest class of failure (12 of 32). Nothing here should grow to compete with it.

---

## §0 — WHAT S16 ESTABLISHED, AND WHY IT CHANGES THE JOB

S16 classified all 32 failing questions individually. The distribution is the finding:

| class | n | owner |
|---|---:|---|
| not matched (12 of them long documents scored whole) | 19 | search / argument |
| ranking | 4 | search |
| not routed | 4 | search |
| unreachable | 4 | search |
| absent from the corpus | 1 | ingest |

**And the result that changes what the headline number means.** Probing committees' failures against
the live index, the keyed documents come back at **ranks 1, 1, 2 and 4** when asked for by their own
titles. **The retriever is working.** The keys are not: **10 of committees' 19 keys are ministerial
correspondence** — against 0 of 19 everywhere else — while the questions ask what a *committee* said;
three more are one evidence submission out of 54, 115 and 525 equally valid ones.

⚠ **8 of 10 committees questions cannot be scored fairly as posed.** Our largest evidence collection
has been reporting 2 of 10 while working, and three sprints have been aimed at a retriever that was
not the problem.

---

## §1 — RE-KEY COMMITTEES (D-3). THE HIGHEST-VALUE ITEM.

`scripts/audit-s16-gold-keys.ts` already reproduces the count. Use it as the starting list.

**For each of the 10 committees questions:**

- Decide what the question actually asks for — **what a committee concluded** (a report), or **what a
  witness told it** (evidence). ⚠ These are different claims and confusing them is the single most
  damaging error available in this collection: *"a water company says the rules work"* is not
  *"the committee found the rules work"*.
- Re-key to a document of that kind. ⚠ **Verify by reading the document body back out of storage** and
  confirming it answers the question. Print the confirming sentence in the file.
- ⚠ **Where a question is answerable by any of 525 equally valid submissions, the question is wrong,
  not the key.** Re-word it so a single document can be correct, or mark it unscoreable. **Do not
  key it to one arbitrary member of a large set** — that is what created this defect.

**Deliver `docs/GOLD_COMMITTEES_REKEY.md`**: numbered, one VERDICT line each, the keyed document's
text printed underneath, in the format Charlie has now completed three times. **Score nothing.**

⚠ **Ask the same question of every other collection before closing this section.** The committees
defect was found by noticing a distribution — 10 of 19 keys of one document type, against 0 of 19
elsewhere. **Print the key-type distribution per collection.** If another collection shows a similar
skew, that is a second instance of the same defect and it is worth more than the re-key itself.

---

## §2 — THE `other` TIER (D-2): ENUMERATE BEFORE WIDENING

`cps-guidance` and `scottish-parliament-or` are ingested, compiled, indexed — **and unreachable by
any query.** They account for 4 of the 32 failures, including 3 of guidance's.

⚠ **S16 declined to widen a stream to admit a tier called `other` without knowing what else is in it.
That was right.** Widening blind is how a stream ends up owning nine unrelated collections and
retrieving worse for all of them.

**So: enumerate first.** List every collection in the `other` tier with its section count and display
type. **Report the list, then propose a mapping per collection with one line of reasoning each** —
which stream should own it, or none.

**Then make the smaller change.** A scope change is a line in `stream-scopes.ts`; a re-tier means
rebuilding index rows. ⚠ **Measure the effect on the collections already in the receiving stream.**
S11 established that a tier move costs nothing but an *extra leg* is zero-sum inside a stream — say
which of the two this is, with numbers, not by analogy.

---

## §3 — MAKE FLAG STATE READABLE IN ONE REQUEST

⚠ **This is small and it closes a blindness that has cost this project repeatedly.** A capitalised
`TRUE` once disabled the router silently for an unknown period; a variable was set eight hours before
anyone realised it could not take effect; and every sprint report since June carries a sentence
saying the live flag state cannot be read from the machine.

`capabilitySnapshot()` already exists. Add it to `/api/health`, alongside the deployed commit that is
already there.

- **Flag names and boolean states only.** No secrets, no keys, no model strings that reveal account
  configuration. The commit SHA is already public; a list of capability names is the same class.
- ⚠ **Read the values through the same path the code reads them**, not from `process.env` directly —
  otherwise the endpoint reports what was set rather than what is in force, which is precisely the
  distinction that makes it worth building.
- Add a line to `SEARCH_CONTRACT.md` §4 replacing *"the live flag state is NOT readable from a
  development machine"* with the request that now answers it.

---

## §4 — MEASURE, AND STATE THE CONFIGURATION

- Re-run the 64-question baseline after §1's re-keys are **validated by Charlie**, not before.
  ⚠ If they are not back in time, **report without them and say so** — do not score against
  unvalidated keys.
- ⚠ **Record the flag string and the degraded state in the artefact itself.** S14's figures described
  a keyword-only system for a fortnight because nobody wrote down what ran.
- Report per collection with **n stated every time**.
- **Name what this supersedes.**

⚠ **Expect the headline to rise for a reason that is not an improvement in search.** Re-keying
committees fairly should raise the number because the instrument was wrong, not because retrieval got
better. **Say that in the report, in those words.** A number that rises for the right reason and is
reported as a win is how a project starts believing its own instrument again.

---

## §5 — STANDING RULES AND THE REPORT

- Scoped commits by explicit path; `commit-search-s17.sh`; nothing owned by ingest, graph, lex or the
  argument stream edited — report needed changes instead.
- Every guard states **what it counted**, never whether something exists.
- Every check watched failing against the real broken state.
- ⚠ **Auto-deploy is now live on `vector-serve` for pushes touching `scripts/ingest/search/`.**
  A push during a measurement will restart the service mid-run. **Check nothing is measuring before
  pushing to that path**, and say in the report that you did.
- **Report `docs/SEARCH_S17_REPORT.md`:** §1's key-type distribution per collection first — that is
  the durable artefact, because it is how a second instance would be found. Then the `other` tier
  enumeration and mapping. Then §3. Then what is NOT done, named. Decisions for Charlie as numbered
  questions with a recommendation and the consequence of each option.
- Change-log, contract and handoff entries labelled **SEARCH**.
