# §19-E — Sprint 3-E: fixes from the 13 Aug walk (the first full kernel + Deepening test)

**Context.** Charlie ran a complete new idea (Civil Service accountability) through all four kernel pages and
into the Deepening. **What worked:** the Guiding Policy stage, Lex proposing four crystallise fields in one
pass, the Deepening running and producing a genuinely good issues list and known-unknowns block. **The
problems are concentrated in two places** — text being silently truncated, and Lex refusing to answer a
direct question — and Task 1 and Task 2 are the whole sprint in importance terms.

Production. Usual git discipline; scoped paths; browser-verify anything with UI before reporting done.
Record in `LEX_PLAYBOOK.md`.

---

## Task 1 — Text is being cut off mid-sentence (severity: highest; diagnose before fixing)

**Symptom, verbatim from the guiding-policy summary as rendered to the user:**

> "This policy rules out a direct mandate **f**. Its leverage is that it closes the gate on the pivotal
> point: where an individual in the bureaucracy**.** … senior civil servants will seek to define 'major
> policy initiatives' narrowly, or break **th**. For this to succeed…"

Three separate clauses end **mid-word**. This is not a model writing badly; it is a **hard character cut**,
and the summary is assembled from several stored field values, so the truncation is happening to the
*stored or composed* values rather than to one generation.

**Diagnose first, and report the found cause before fixing.** Candidates, in the order I'd check:

1. **A `.slice(n)` / `substring` on field values** when composing the summary or building context — the
   most likely cause given the cut lands mid-word at what look like round-ish lengths. Grep the compose
   path and every `slice(0,` on user-facing text.
2. **A database column length limit** truncating on write (check the affected fields are `Text`, not a
   bounded `VarChar`).
3. **`maxOutputTokens`** on the generation that produced the underlying fields — but note this would cut
   *once at the end*, not three times mid-clause, so it is the least likely.

Whichever it is, the rule that follows is general and belongs in the playbook: **never truncate
user-facing prose silently.** If a limit must exist, cut at a sentence boundary and mark it, or refuse and
say so — the same principle as the never-claim invariant, applied to text integrity. A silently truncated
sentence is a claim the user cannot tell is incomplete.

## Task 2 — Lex must answer the question it was asked

**What happened.** Charlie asked a substantive, well-posed question: *does this need a "Charter" — is that
the right instrument? How is accountability handled in the Civil Service now? Is anything written down? Is
there anything in the Civil Service Code?* Lex replied by **naming three corpus documents, pointing at the
panel, and then re-issuing the guiding-policy summary**. It did not answer any part of the question.

Charlie's verdict: *"fundamentally unhelpful."* He then put the same question to plain Gemini and to
ChatGPT and got, in both cases, a direct substantive answer — the statutory basis (Constitutional Reform
and Governance Act 2010, Part 1), what the Civil Service Code does and does not cover, the Accounting
Officer regime, the Senior Responsible Owner regime as the closest existing analogue, and a reasoned
answer to whether a Charter is the right instrument at all. **Lex is the same underlying model.** The
difference is entirely in how we are prompting and constraining it.

**What has gone wrong, in design terms.** In making Lex safe — never claim, only cite what was retrieved,
always drive the field forward — we have made it unable to *think aloud with the user*. Two corrections:

**2a. Separate "answering a question" from "filling a field."** When the user asks a question rather than
supplying field content, Lex's job for that turn is to **answer it**. It may still mention the panel at the
end, in one sentence. It must not respond to a question by re-proposing a field, and it must never treat
"I've drafted a summary" as an answer to "is a Charter the right instrument?"

**2b. Grounding does not mean silence.** The never-claim rule (§19-C 1b) says Lex may not assert *facts
about what the corpus contains* without retrieval. It was never meant to stop Lex reasoning from general
knowledge, weighing instruments against each other, or saying what it thinks. The prompt must draw that
line explicitly:

- **Corpus-grounded and cited:** what a specific Act, case, debate or report says.
- **Reasoned openly, and labelled as reasoning:** whether a Charter is the right instrument; what the
  trade-offs are; what the closest existing analogue is; what a committee would ask.
- **Never:** a fabricated citation, statistic, or claim about a document not retrieved.

Add worked guidance to `method.ts`: *if the user asks a question, answer it — substantively, in your own
reasoning, distinguishing what the corpus establishes from what you are inferring. Naming documents is not
an answer. Pointing at the panel is not an answer.*

**2c. Lex should press the user to read what it surfaced.** Charlie: *"Lex should be fairly firm in the
importance of reading the links given and giving an opinion on those."* When a pass or search returns
sources, Lex should say which ones matter most and why, and ask for the user's reading — not list them.

## Task 3 — Retrieval: sift, don't rank-and-dump

**Charlie's finding:** *"The precedents Lex provides aren't really precedents — they're a random search,
quite a lot of it irrelevant… Instead of ranking the top 20 for relevance, which Lex can't seem to do very
well, it should take the top 100 and pick out intelligently the ones that really are relevant and useful."*

He is describing a **sift** step, and it is the right instinct: the Deepening runs in the background with a
minutes-long budget (§10 of the search strategy), so it can afford what the interactive path cannot.

Implement for Deepening passes only:

- Retrieve a **larger candidate set** (target ~100, honouring whatever the gateway will return).
- Add an **LLM sift** between retrieval and the gather: for each candidate, decide *does this actually bear
  on this proposal's problem, and how?* — keep the ones that do, with a one-line reason; discard the rest.
- **The count of discarded candidates is reported**, not hidden: "reviewed 100 sources, 12 bore on this."
  That is honest and it is also a quality signal we can watch.
- A candidate kept as a **precedent** must satisfy the precedent test: *a comparable measure was tried,
  and we can say what it was for, what was predicted, or what happened.* A topically-related document is
  not a precedent. If nothing passes, the pass says so — the known-unknowns machinery already handles it.

`// Ranking answers "what is most similar"; sifting answers "what actually bears on this". They are
different questions and the background budget lets us ask the second.`

## Task 4 — Self-critique from a different angle

Charlie on the issues list: *"much better quality and genuinely useful. But it should be Lex critiquing its
own work from a different angle to be really helpful."*

Currently the pass that generates findings also generates the issues, so it critiques its own output from
inside its own frame. Change the issues step to a **separate call with an adversarial brief**: *you are a
hostile committee clerk reading this proposal for the first time, with the findings attached. Where is it
weakest? What would you ask that it cannot answer?* Same structured output, different vantage point.

The existing deterministic templates (no-quantified-scale, no-contradicting-evidence) stay — they fire
reliably and both fired correctly on this run.

## Task 5 — Editing surfaces are too small (UI)

Both flagged with screenshots:

- Field editors show **~2.5 lines** of what is often a long Lex draft. Make narrative and structured
  editors substantially taller by default — enough to read a typical proposal without scrolling.
- Add a **drag handle to resize** the editing area (`resize: vertical` on the textarea is the cheap
  version and is probably sufficient; verify it survives the panel layout).

## Task 6 — Delete an idea

There is currently **no way to delete an idea**. Add it: owner-only, confirmation dialog naming the idea,
soft-delete if that is cheaper to reverse, and it must remove the idea from the user's list. Charlie has
pre-rebuild ideas that cannot exercise the current flow and are polluting his testing.

## Task 7 — Diagnosis entry is inconsistent, and a dictation hint

On Diagnosis the interaction changes from *"answer in chat **or** the panel"* to *panel only* — Lex
effectively says "over to you." Restore the chat path (a chat answer should become a proposal, as
everywhere else), and add a hint at the top of the stage:

> Dictating is a faster way to get your ideas down — Lex will tidy up your thoughts.

## Task 8 — A dead link

`https://committees.parliament.uk/writtenevidence/121125/` was surfaced and 404s. Check how committee
written-evidence URLs are constructed; if the pattern cannot be made reliable, link to the parent inquiry
page rather than a URL that may not resolve. **A dead citation is worse than a plain reference.**

## Acceptance criteria

- No user-facing text is cut mid-word anywhere; the cause is named in the CHANGE_LOG; a check guards the
  compose path.
- Asked Charlie's Charter question verbatim, Lex answers it substantively, distinguishes corpus-established
  facts from its own reasoning, and does not re-propose a field instead of answering.
- A Deepening pass reports how many candidates it reviewed and how many it kept; kept precedents satisfy
  the precedent test.
- The issues list is generated by a separate adversarial call.
- Field editors show a long draft without scrolling and can be resized.
- An idea can be deleted.
- Diagnosis accepts chat answers; the dictation hint appears.
- Committee links resolve, or point at a page that does.
