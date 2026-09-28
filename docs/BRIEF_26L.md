# BRIEF — LEX 26-L: the guiding-policy screen in use, and Lex telling the truth

**Thread:** LEX. **Written:** 28 September 2026.
**Source:** Charlie's first real session on the guiding-policy screen after 26-I and 26-K.

## §0 — Run mode and ordering

**Continuous.** Diagnose, record in the CHANGE_LOG, proceed — including where a finding contradicts
this brief. Batch the report. **Stop only for** spend or scope.

⚠ **§1–§3 block Charlie's work right now** — he is sorting guiding policies and cannot see the ones
he creates. **Do them first.** §4–§5 are Lex honesty. §6–§10 are the screen. §11 is report-only.

⚠ **CLAUDE.md §25–§28 apply. Cold reads on Charlie's real idea for every section.** Read-back list for
every string.

---

## §1 — New candidates do not appear

**Charlie added candidate 29 by hand. It exists — the screen says *"1 of these has not been sorted
yet"* — and it renders nowhere.** A merge of 3 and 6 succeeded and its result is also invisible.

⚠ **Hypothesis to test, not accept:** the list renders by sort group — *Guiding policies (11)*,
*Really coherent actions (16)* — **and an unsorted candidate belongs to no group, so it has nowhere to
render.** Report the actual cause.

**1a. Every candidate always renders.** An unsorted one appears in an **"Not yet sorted"** group at
the top, where the user will see it first.
**1b.** ⚠ **Cold read: create a candidate, then find it on the screen without sorting.** A check that
asserts the row exists is the check that has passed eight times this month on things users could not
see.

## §2 — A merge must say what it did

**The merge of 3 and 6 returned *"Not a merge — one contains the other"* and then nothing visible.**

**2a.** The result states the outcome in the user's terms: ***"#3 has been enhanced to include #6.
#6 has been archived."***
**2b.** The enhanced #3 shows **its originals beneath it, both clickable** — the wording of #3 before
the merge and of #6 — so the user can see what was combined and undo it.
**2c.** ⚠ Report whether *"one contains the other"* wrote anything at all, or only reported.

## §3 — A guiding policy the user adds becomes a full card

**Charlie typed a policy. He got a warning and no card** — nothing to edit, nowhere to add what it
rules out.

**3a.** A typed policy **becomes a candidate card immediately**, numbered, in §1a's unsorted group.
**3b.** ⚠ **Every candidate card — built, typed, drafted by Lex or by consolidation — carries the same
editable fields:** the statement · **what it rules out** · what it fixes · how likely it is to happen.
⚠ **Charlie: *"all proposed GPs should have a section: what it rules out."***
**3c.** The compound warning appears **on the card**, as advice. **It never prevents the card from
existing.**

## §4 — Lex claims actions it has not taken

**Verbatim, from Charlie's session:** *"I've drafted a new candidate approach… You should see it
added to the list of candidate approaches in the middle panel now."* Then, asked which number: *"No
new candidate was actually added to the list."*

⚠⚠ **This is 26-I's A3, which CC reported as enforced by prompt instruction only. It failed exactly as
predicted.** Charlie's rule: **Lex always checks it can do something before claiming to have done it.**
**Make it structural:**

**4a. Lex acts only through tools**, and every action it can take is a tool whose result comes back to
it in the same turn.
**4b. Lex may describe an action in the past tense only when a tool result in that turn confirms it.**
⚠ **Enforce this in code, not in the prompt:** a check on Lex's reply against the turn's tool log. A
reply claiming an action with no confirming result is **not shown** — it is regenerated, or replaced
with a plain *"I wasn't able to do that."*
**4c. Lex sees the middle panel.** Every turn carries a current snapshot of the kernel and the
candidate list — numbers, wording, dispositions, what is accepted. ⚠ **Report what Lex currently
sees each turn.** It cannot manage what it cannot see.

## §5 — The flattery survived

**Two examples from this session, after the no-preamble rule shipped:** *"That's excellent feedback,
Charlie"* and *"That's a very pertinent question, Charlie."*

⚠⚠ **Report whether these came from a prompt the rule never reached, or a prompt the model ignored.**
Either way: **the prompt-only rule has failed. Make it structural** — the §8 detector from 26-I runs on
every reply **before display**, and an evaluative opener is removed or the reply regenerated.

## §6 — The compound test is too crude

⚠ **It split Charlie's candidate on every "and"** and called it four things. **The presence of "and"
is not the presence of a compound.** *"Individually attributable and externally visible"* is one
approach with two properties.

**6a.** The deterministic test **flags for review only.** The **verdict** comes from the judge, with
its reasoning, on the card.
**6b.** ⚠ **Never split a sentence on "and" and present the fragments as the user's policy.**

## §7 — The sort shows its reasons, and is consistent

**"Sort these for me" returned one line — *"16 of these were not guiding policies"* — and no reasons
where Charlie could see them.**

**7a.** Every moved card shows **why it moved**, on the card, not in a summary above.
**7b.** ⚠ **Report why these two were classified differently:**
- **#1** *Implement a statutory framework for individual civil servant accountability, linking
  performance to clear, measurable outcomes and consequences* — **moved to coherent actions**
- **#25** *Strengthen individual accountability through explicit roles and performance metrics,
  making senior civil servants directly answerable for outcomes* — **left as a guiding policy**

⚠ **Suspicion to test: the sort is keying on the verb** — *"Implement"* reads as an action,
*"Strengthen"* as a direction — **rather than on substance.**
**7c. The test the sort applies is stated in its prompt and in the guide (§8), in Charlie's words:**
> **If it is a single action, it is a coherent action. If it is a principle you can test an action
> against, to know whether the action fits, it is a guiding policy.**

## §8 — "How to write a Guiding Policy"

**A button at the top of the Guiding Policy section, in the same colour, font and popup style as
"How this works".** It opens a short guide drawn from Rumelt:
- what a guiding policy is, and what it is not;
- ⚠ **the test in §7c, as the centrepiece;**
- that a guiding policy rules things out — and that one ruling out nothing is not yet a policy;
- the difference between one approach with several parts and a list of approaches;
- why it matters: **it is what makes the coherent actions coherent.**

⚠ **Paraphrase and cite; do not reproduce passages from the book.**

## §9 — "How these relate" measures the wrong thing

**It declares nearly every pair "alternatives — one of these wins" because they share cause 6.**
Charlie: *"all the GPs should and more or less do address this cause."* **Meanwhile #3 and #6, which
are near-identical, appear last.**

⚠⚠ **A cause that every candidate attacks tells you nothing about any pair of them.** Like a word
that appears in every document, it carries no information.

**9a. Relate candidates by the similarity of their approach**, not by overlap of causes attacked.
**9b. Exclude from the relation any cause attacked by all or nearly all candidates.** Report the
threshold.
**9c. Near-duplicates first**, each with a **"Merge?"** action beside it.
**9d.** ⚠ **Report how many pairs remain once 9b is applied.** If it is still dozens, the list is
still noise.

## §10 — Wording and layout

**10a. Replace the text at the top of Guiding Policy** with, verbatim:
> After choosing the right cause, getting the guiding policy right is the next most important task,
> and it's not easy. A good guiding policy brings focus and clarity — essential to the success of your
> mission — by ruling out anything that might confuse your actions. Lex will help bring clarity.
>
> **Next steps.**
>
> First sort the candidate policies below with your comments (and add your own if you wish), then
> click the **Consolidate** button at the end — greyed out until you have sorted every option. This
> gives you suggestions from four premium AI models. You then choose the best and give feedback before
> the final version is chosen.

⚠ **One wording change from Charlie's draft:** *"greyed out until you've commented on each option"*
becomes *"until you have sorted every option"* — **the button waits on a disposition, not a comment.**
**Charlie to confirm.**

**10b. Move "Compare new material with your kernel" out of the top of the middle panel** into the
**Re-run** section at the bottom, which is **retitled "New material and rebuilds".**

**10c. Remove the "Or ask Lex to research an angle" box from the middle panel.** ⚠ **Two entry points
on one page doing the same thing.** Researching an angle becomes **something Lex in the left panel
does** — see §11. ⚠ **Also report: its Research button ran the material comparison instead.**

## §11 — Lex as the one way in. Report only; do not build.

**Charlie asked both Lexes the same question.** The left-panel Lex answered from general knowledge —
honestly labelled — and ended by sending him to the middle panel. **The middle-panel box ran the
wrong function.** Neither searched the corpus.

**Charlie's requirement:** Lex has access to every part of the idea; understands what the user is
trying to do; knows Rumelt's method; **searches the corpus**; can guide the user round the site; **can
do anything the user can do in the interface**; and can bring in material from the web.

**Report the design, and the cost, for:**
**11a. A tool for every action** a user can take in the workspace — add, edit, merge, sort, dispose,
accept, file feedback, run the update pass, research an angle.
**11b.** ⚠ **Asked "how does the private sector deal with this?", Lex searches the corpus first** and
returns what it found as proposed changes — **not an essay from general knowledge.** General reasoning
is allowed, and labelled, **only after the corpus has been searched.**
**11c.** **Site help** from the one source that also renders *How this works*.
**11d.** ⚠ **Web search in chat: report the status of Search's work** — a commit titled *"S21 step 7
+ S22 — chat web search"* suggests it may already exist.
**11e.** ⚠ **Which model Lex's chat runs on, and what this would cost per turn on a stronger one.**

## §12 — Acceptance criteria

- A candidate created by typing, by Lex, by merge or by consolidation appears on screen at once,
  asserted by a cold read.
- A merge states which candidate was enhanced and which archived, with both originals clickable.
- Every candidate card carries "what it rules out", editable.
- The compound test never blocks a card and never splits a policy on "and".
- Lex cannot show a reply claiming an action unless a tool result in that turn confirms it — enforced
  in code.
- No Lex reply reaches the screen with an evaluative opener — enforced in code.
- Every sorted card shows why it was placed where it is.
- "How these relate" leads with near-duplicates and ignores causes every candidate attacks.
- The "How to write a Guiding Policy" guide is live, with the single-action test at its centre.
- The new introduction text is live; Compare sits under "New material and rebuilds"; the angle box is
  gone from the middle panel.
