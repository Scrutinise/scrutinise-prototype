# BRIEF — LEX 26-I: one guiding policy, properly arrived at

**Thread:** LEX. **Written:** 27 September 2026.
**Source:** Charlie's design of 27 September, refined in conversation. **This is the feature that
decides whether the guiding-policy screen is a tool or a menu.**

## §0 — Run mode and ordering

**Continuous.** Diagnose, record in the CHANGE_LOG, proceed. Batch the report. **Stop only for** spend
or scope. ⚠ **CLAUDE.md §25–§28 apply.** Run the cold-read instrument.

**§1–§9 are the feature and are one sprint. §10 is what the 27 September log left open and is
separate work — do it after, or report if it cannot fit.**

⚠ **The context finding that governs the design:** Lex produced a compound guiding policy when asked
cold because it had none of the material a good answer needs. **Every model call in this loop is
handed the diagnosis, the causes, the sorted candidates, the user's own attempts and the Rumelt tests
explicitly.** Model quality matters; context matters as much.

---

## §1 — The user can add a guiding policy of their own

⚠ **There is currently no way to add one except by asking Lex, and Lex cannot.** Add an **"Add a
guiding policy"** box at the top of the Guiding Policy section.

**1a.** What the user types is **their words — testimony**, kept verbatim and attributed.
**1b.** It enters the candidate list at **§2, the sort**, alongside the model's candidates, numbered
like them.
**1c.** ⚠ **It is tested like them — §4.** If it is a compound, Lex says so. **That is the grilling
Charlie asked for**, and it is what Lex failed to do when it produced *"a statutory framework…
enforced by transparent performance management and robust parliamentary oversight"* — three things
and an "and".

## §2 — The sort

**Five dispositions on every candidate**, three of which exist:
- **Part of the solution** — new
- **Says roughly the same as [dropdown of other candidates]** — new; ⚠ **reuse the alternative
  relation 25-P already computes** rather than a second mechanism
- **Rule out** — with reason — exists
- **Later phase** — exists
- **Really an action** — the automatic sort exists; **the user may also assert it**

⚠ **"Consolidate" is disabled until every candidate carries a disposition.** A consolidation over an
unsorted list is a consolidation over noise.

## §3 — Consolidate: four models, one draft each

**On Consolidate, four premium models each draft ONE guiding policy**, given: the problem · the
causes · the candidates marked *part of the solution* · the user's own attempts · the Rumelt tests
(§4) stated in full.

**Each draft is in a fixed form, every field required:**
- **The statement** — one approach, not a list
- **What it rules out** — ⚠ **required on every guiding policy, candidate or final**
- **What it fixes** — which causes
- **How likely it is to happen**
- **The chain-link warning**, where the links bind — *delivered without X, this changes nothing*

⚠ **Report the four models used, and the cost per consolidation.** Expect tens of pence; the guiding
policy is the centre of everything downstream and this is the one place in the product where spending
on the best models is obviously right.

## §4 — Judge: every draft tested, failures on the card

**After the four draft, each is tested and the result printed on its card:**
- **Does it rule anything out?** A draft that rules out nothing says *"Rules out: nothing — this is a
  compound."*
- **Is it a compound** — several approaches joined by "and"?
- **Does it answer the pivotal obstacle** named in the diagnosis?
- **Which causes does it attack**, and does that match what it claims?

⚠⚠ **This step is the point.** Four polished sentences from four models will all *sound* like guiding
policies. **Charlie has read Rumelt several times and finds it hard to apply — the user is choosing
between checked sentences, not plausible ones.**

**4a.** ⚠ **Report whether the judge is a model call or deterministic.** The compound test can be
partly mechanical; the obstacle test cannot.

## §5 — The user reacts, and names a favourite

**5a.** The user **chooses a favourite of the four** — ⚠ **that draft's model does the redraft in
§6.** Charlie's decision.
**5b.** The user may also say **what worked and did not, across all four**. ⚠ **This is feedback, not
a splice request.** "The first half of A with C's rules-out" is a brief, not a cut-and-paste.
**5c.** ⚠ **Record which model was chosen, every time.** It is the cheapest experiment the platform
will run, and over time it says which model to make primary.

## §6 — Redraft: one author, two sets of feedback

**The favourite's model redrafts once, given:**
- **the user's feedback** — what they liked, and why the others were not chosen;
- ⚠ **Lex's feedback** — which Rumelt tests each of the four failed, and why. **Charlie's addition,
  and it is the important one:** the redraft is briefed with the judge's findings, not only with the
  user's taste.

⚠⚠ **Never a merge.** One author, informed by four drafts and two kinds of feedback. **A guiding
policy assembled from pieces of four sentences is a compound by construction — Charlie's phrase:
Microsoft packaging, not Apple.**

**6a.** The redraft is **tested again by §4** before it is shown.

## §7 — Accept

**7a.** The user accepts the redraft, or edits it. ⚠ **An edited version is their words, kept, and
tested again.**
**7b.** Accepting sets **Chosen approach**, which opens Leverage, Anticipated responses, Conditions
for success and the Guiding-policy summary — the four fields currently reading *"Waiting on Chosen
approach"*.

## §8 — The flattery goes

⚠⚠ **Prompt rule, every Lex turn, everywhere:** *no evaluative preamble about the user's question or
their thinking.* Not *"That's a very astute observation"*, not *"That's an excellent way to think
about it"*. **Answer, or challenge.** A barrister's opinion opens with the answer, and a scrutiny tool
that compliments the user before scrutinising them has failed at the one thing it exists for.

**8a.** ⚠ **Assert it** — a check that fails on the presence of evaluative openers in Lex's output.
**Report which phrases the check catches.**

## §9 — Acceptance criteria

- A user can type a guiding policy and it enters the sort, numbered, as their words.
- Consolidate is disabled until every candidate is dispositioned.
- Four drafts appear, each in the fixed form, each with "what it rules out".
- Every draft carries the results of the four tests on its card, including failures.
- The user can name a favourite and give feedback; the favourite's model redrafts from both feedbacks.
- The redraft is tested before display; an edited acceptance is tested again.
- Accepting sets Chosen approach and opens the four waiting fields.
- Lex's output contains no evaluative preamble, asserted by a check.
- The chosen model is recorded on every consolidation.

---

## §10 — Carried from the 27 September log. Separate work; report if it cannot fit.

**Approve the commit of what was built** — the shared sort, the mirrored groups, the group-header fix,
and the duplicate list removed.

**10a. The Overview page reads dead tables.** ⚠⚠ It queries the pre-rebuild schema — Diagnosis,
GuidingPolicy, RootCause, Evidence, CoherentAction — while the editor writes elsewhere. **"Problem"
works by coincidence.** **Rebuild the Overview against what the editor actually writes.** This is the
page a user lands on when they click an idea; it currently tells them their work does not exist.

**10b. The Research tab** is stage-gated *and* wired to the wrong model. **Remove the gate and point it
at Document and IdeaBuild.** It lists every source and document, with delete.

**10c. Inbound / Outbound needs a provenance field on Document** — none exists, and the upload model
is orphaned code with no callers. ⚠ **Add the field, populate it at every write site, backfill what
can be inferred, and report what cannot.** Then split the tab.

**10d.** ⚠ **The sort preference lives in the browser (localStorage), so it is per-device, not
per-user.** Charlie's iPad will not know what his desktop chose. **Report whether it should move to
the user record; recommend it does.**

**10e. Decision for Charlie, report only:** the causation commentary is live and correct but sits
inside the Diagnosis section, **which collapses after a build — by his own instruction.** He then
could not find it. ⚠ **Should the commentary sit outside the collapsing section, always visible at
the top of Diagnosis?** Put it to him.

**10f.** ⚠ **Tell Charlie plainly: nothing of his was lost.** His rule-out reasons are intact under
*Candidate policies ruled out*, collapsed since 26-E. The commentary is live. **Both were hidden, not
gone.**
