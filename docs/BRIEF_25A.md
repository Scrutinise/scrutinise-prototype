# BRIEF — Sprint 25-A: minimum elicitation and the first build

**Spec:** `LEX_DESIGN_ADDENDUM_25.md` (§25). **Thread:** Lex/UX. **Date:** 17 August 2026.

**What this sprint proves.** §25 inverts the flow: the user decides, Lex writes. 25-A builds the
smallest end-to-end version of that — four questions, then Lex drafts a rough kernel and shows it —
so Charlie can judge the premise before we commit to the rest. **If a kernel drafted from four
answers is not worth reviewing, nothing in 25-B/C/D rescues it.** Build it, then stop.

Production. Scoped commit paths (three threads share this tree); `commit-lex-25a.sh`. **Browser-verify
before reporting done** — the standing rule, and a build harness with a progress display cannot be
judged any other way.

---

## §0 — What is NOT in this sprint

State it plainly so scope does not drift: the interrogation library (25-B), the revision loop and
adversarial read (25-B), the review-agenda UI and forks-as-decisions (25-C), the RH panel
reorganisation and document ingestion (25-D). **The existing kernel pages remain exactly as they
are** — 25-A adds a path, it does not remove one. An idea built the current way must still work.

## §1 — Page 1: four exchanges, then a confirmation

Replaces the current Page 1 conversation. Fields and storage per §25.1; the field machine, proposal
contract and save-before-advance are unchanged.

**1a. The four exchanges.**

1. **The problem, in their words** — subject to the existing §19-D problem gate (a solution offered
   here is challenged, at most twice, then accepted).
2. **What you want to happen** — a change in the law · a change in how a rule is applied · pressure on
   an institution · not sure yet — **and anything already ruled out.**
3. **What you know that we won't find** — their own experience, what the record won't show. Stored
   with a flag marking it as the user's own knowledge, not retrieved material, because §25.3 item 5
   and every later citation depend on telling the two apart.
4. **Anything to read?** — optional; a link or a file. *(Ingestion itself is 25-D: for now, capture
   what they give us and say plainly that Lex will read it in a later sprint. Do not pretend to have
   read it — never-claim.)*

Plus the reusable **About you** profile, skipped for a returning user.

**1b. Lex's opening ask, verbatim** — Charlie's wording, lightly smoothed:

> Tell me as much as you can about this issue and why you want it solved — what you've seen, what
> you know that isn't written down anywhere, and what you think is really going on. The outlying
> details are often what change the whole approach, so nothing is too small to mention.

**1c. The confirmation step.** When the four are answered, Lex writes back its understanding in a
short paragraph and waits. **Framing matters here and Charlie's instinct that a warning reads as
tense is right** — confident and collaborative, not fearful:

> Here's what I understand you're trying to do — *[paragraph]*.
> Everything I write next follows from this, so if I've got the wrong end of anything, now is the
> cheapest moment to say so. Otherwise I'll go and build it.

Two buttons: **That's right — build it** · **Not quite — let me correct you**. The correction re-runs
the confirmation, not the whole of Page 1.

## §2 — The build harness

The part with real engineering in it. A build is a **job**, not a chat turn.

- `IdeaBuild { id, ideaId, version, status: QUEUED|RUNNING|DONE|FAILED|CANCELLED, passesComplete,
  currentPass, startedAt, completedAt, failureReason, tokensIn, tokensOut, estCostPence }` —
  additive, idempotent SQL, applied after `whichdb`.
- `POST /api/ideas/{id}/build` starts one; one active build per idea, **claimed in a single
  conditional update whose count is checked** (the Deepening's pattern — two concurrent posts must not
  both start).
- Status by polling the row. **The status shown is the status stored**, and an abandoned RUNNING row is
  settled by *writing* it to FAILED (`deepening-settle.ts` has the shape).
- **Incremental persistence.** Each pass commits its output as it completes. A timeout loses the tail,
  never the run, and a partial build says which passes completed.
- **Ceilings, per Charlie:** target 5–10 minutes, **hard stop at 15**; a token/cost ceiling with the
  spend recorded on the row and shown to the user. Hitting a ceiling is a FAILED build with a plain
  reason, never a silently shortened one.
- **Cancel** is available while running.

**Progress display.** Named passes, not a spinner: *Understanding the terrain · Drafting the
diagnosis · Drafting the approach · Drafting the actions*. Elapsed time visible. A user who cannot see
what a five-minute job is doing assumes it has hung.

## §3 — Pass 1: orient

One corpus search through the gateway (`BACKGROUND_BRIEFING` + `LEGAL_LANDSCAPE`) plus **one
domain-transfer question**, which is the highest-yield generic question we have (§25.4):

> Who else has this problem, outside this sector, and what have they built to deal with it?

Answered by reasoning, **labelled as reasoning**, never presented as corpus-grounded.

**§3a — the query-framing experiment, and it is the point of including this here.** Charlie's
observation is sharp and worth settling with data: *a naive user-style question may outperform a
heavily contextualised one, because loading a model with structure can crowd out its own reasoning.*

Build pass 1 so the framing is a **switchable strategy**, and run both on the same three ideas:

- **A — naive:** the user's problem, phrased as they would put it into a chat window.
- **B — contextualised:** the problem plus goal, ruled-outs, their own knowledge and the profile.

Report both outputs side by side for Charlie to judge. **Do not pick a winner in code** — record which
was used on each build so the comparison survives. *(Multi-vendor — asking several providers — is
explicitly not in this sprint: the four-model comparison showed the variance came from the framing of
the question rather than the badge on the model, and one variable at a time.)*

## §4 — Pass 2: the rough kernel

Draft diagnosis → guiding policy → coherent actions, straight through, into the existing canonical
fields as **proposals** (`AWAITING_CONFIRMATION`). Nothing new in the state machine: this is
`proposeScalar` and the structured seeder, called in sequence instead of one at a time.

**Deliberately rough, and Lex is told so.** Pass 2 exists to expose what the proposal *implies* so that
25-B's pass 3 knows what to research. Quality comes from revision, not from this pass.

**Two things it must do that the current per-field drafting does not:**

1. **Record its forks.** Wherever Lex had to choose — which cause is pivotal, which approach, which
   instrument — persist the alternative it set aside with the case for it. `BuildFork { id, buildId,
   fieldKey, chosen, alternative, caseForAlternative, resolved: boolean }`. 25-C turns these into
   decisions; 25-A only has to capture them. **Two alternatives per fork** (Charlie's decision):
   two strong beats three with filler.
2. **Say what it is unsure about**, per field, in a sentence. This is what the user reads first.

**Add the instrument question to the Guiding Policy draft.** Charlie's gap, and it is a real one: what
*kind* of tool is this — primary legislation · secondary legislation · regulator rule or guidance ·
funding · organisational change · local vs national · devolved · a quango's remit? Lex must name the
instrument it has assumed and record the alternatives as a fork. *An idea that needs a funding
decision and gets drafted as a Bill is wrong in a way no amount of good drafting fixes.*

## §5 — Presenting the draft

25-A does **not** build the review agenda (that is 25-C). It presents the kernel in the panel as it
stands today — proposals awaiting confirmation, editable, savable — plus:

- A short **"what I did and what I'm unsure about"** message from Lex.
- Charlie's credibility point, placed **here rather than up front** — a warning before the user has
  invested reads as a threat; after the work is done it reads as respect:

  > Everything above is mine until you've been through it. If this goes to an MP or a committee,
  > you'll be asked to defend it — so where you disagree, or where I've put words in your mouth,
  > change it. Where I'm wrong, that's the most useful thing you can tell me.

- **Direct editing stays** (Charlie's decision 4, "essential and encouraged"), and the copy should say
  so: putting it in your own words is encouraged, not a fallback.

## §6 — Acceptance criteria

- The four exchanges complete, the profile is skipped for a returning user, and item 3 is stored
  flagged as the user's own knowledge.
- The confirmation step blocks the build; "Not quite" re-runs the confirmation only.
- A build runs to completion, persists incrementally, shows named-pass progress, records its spend,
  and can be cancelled.
- A build killed mid-run settles to FAILED **by writing the row**, and reports which passes completed.
- Hitting the 15-minute or cost ceiling produces an honest FAILED, never a truncated draft.
- Pass 2 fills the kernel fields as proposals; every field is editable and savable exactly as today.
- Forks are persisted with two alternatives and a case for each; the instrument choice is one of them.
- Both query framings (A and B) run on three ideas and are reported side by side.
- An idea created the existing way still works end to end.
- Browser-verified.

## §7 — Notes for the build

- `LEX_TIER_FUSION` and `LEX_QUERY_ROUTER` are **confirmed on in production**. Assume routed retrieval.
- Search's S5 sprint is widening the Lex chat route beyond legislation. **Do not wait for it**; 25-A's
  retrieval goes through the gateway and inherits the widening when it lands.
- Model choice per pass should be **configurable rather than hardcoded** — pass 5's adversarial read
  (25-B) is where model strength is most likely to matter, and we will want to test it without a code
  change.
