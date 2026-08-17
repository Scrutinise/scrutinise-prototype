# BRIEF — S6: WRITE DOWN WHAT WE CAN CALL, AND START COUNTING WHAT IT COSTS

**Owner:** CC-Search
**Stream:** SEARCH
**Written:** 17 August 2026

**Where this sits:**
- *S4:* audited the Lex chat route's scope · *S5:* fixes it
- **This: S6 — three small things that other streams are currently guessing about**
- ⚠ **§1 should land before S5 finishes**, because 25-A is already building against assumptions
  about what search can do.

Three parts, independent. §1 and §2 are documents. §3 is a shared utility.

---

## §1 — `docs/SEARCH_CONTRACT.md`

Already specified in S5 §4. Pulling it forward, because the Lex stream is building against guesses
right now and 25-A's §3 names two intents without any way of knowing what else exists.

**What it says, in plain terms rather than internal names:**

1. **What the corpus holds**, by kind, with rough sizes. *"Every UK Act and statutory instrument, the
   notes explaining them, what Parliament said and how it voted, what committees were told, what
   courts decided, what regulators advise."* ⚠ Not `pwdata-debates`.
2. **What can be asked for today**, by intent, and what each returns.
3. **What cannot be asked for yet, named individually**, with what it would take. Today that is at
   least: cross-domain mechanism analogues, contradiction retrieval, positions, anything on the open
   web, and — until S5 lands — committee evidence from the Lex chat route.
4. **How to ask.** One call, its parameters, and the fact that the router picks the streams so a
   caller does not have to.
5. **What each surface currently gets**, since they differ and the differences have caused two
   sprints of confusion.

⚠ **And the never-claim rule for unmet requests**, per S5 §4: if Lex wants something search cannot
give, it says what it looked for and could not reach. *"I looked for what committees have said and I
can't reach committee evidence yet"* is a good answer. *"I don't have information on that"* is a bad
answer to the same situation, because a user cannot tell it from the corpus being empty.

---

## §2 — `docs/MODEL_CONTRACT.md`

**Nobody has written down which models we can call.** 25-A §7 asks for model choice per pass to be
configurable, which is right — and the moment 25-B wants a stronger model for the adversarial read
is the moment someone discovers whether we have a key.

Charlie has API access to **Grok, Claude, OpenAI and Gemini.** Establish, per provider:

- **Which key exists, where it lives, and whether it works** — ⚠ **call each one once and report the
  result.** A key in an environment file is not a working credential, and this project has already
  lost a session to a token that authenticated and then 403'd.
- **Which models are reachable on that key**, and the exact model strings.
- **Price per million tokens, in and out**, so a cost estimate is arithmetic rather than a guess.
- **What each is currently used for** — Gemini Flash for most things, Grok as a fallback, Claude
  Haiku somewhere historical. Confirm rather than repeat.
- **What each is plausibly best at**, stated as an opinion and labelled as one. ⚠ Do not present a
  capability ranking as a measurement; the four-model comparison showed the variance came from how
  the question was framed, not from the badge on the model.

**Then make model choice per call configurable**, as 25-A §7 asks — one place, environment-driven,
with the default recorded. Not a rewrite: a lookup where a string is currently hardcoded.

---

## §3 — Meter the spend, and defer the charging

Charlie's design: a free allowance per user, then payment, with **75% of what someone pays funding
their own use and 25% going to a pool** for users who have not hit their limit — topped up by his own
donation.

⚠ **Build the counting now. Do not build the charging.** The token economy was already deferred
pending accounting advice, and it needs the not-for-profit entity to exist before money moves. But
**you cannot charge for what you cannot measure, and the measurement is worth having on its own**:
right now nobody knows what one proposal costs to produce.

### What to build

- **One shared helper that every LLM call goes through**, recording: which model, tokens in and out,
  cost in pence, which user, which idea, which pass. ⚠ **One place, not per caller** — the
  truncation guard taught this exact lesson, where a check written per-caller was missing in seven of
  them.
- **Adopted by every stream**: Lex's build passes, the graph's extraction, ingest's embedding.
  Ingest's cost is not a user's, but it is Charlie's, and a single number for what the platform
  spends is worth more than four.
- **A per-user running total**, and a per-idea one. *"This proposal cost £0.42 to produce"* is the
  number every later decision rests on.
- **A ceiling that stops rather than warns.** 25-A already specifies this per build; the same
  mechanism should apply per user once allowances exist.

### On the quality-level question

> *Do we let the user pick cheap/medium/expensive, or build the escalation behind the scenes and use
> the top model for the adversarial step only?*

**Behind the scenes, and Charlie's instinct on the adversarial step is right.** The reasoning is the
same as the corpus picker: **a user cannot judge which model to use.** Someone who picks "cheap"
gets a worse proposal and has no way to know that is why. Choosing the right model per task is a
technical judgement and we should make it.

⚠ **But there is a version of user control worth keeping**, and it is not a model picker. A user may
reasonably want to spend more on the thing that matters most to them. **"This one is important — do
it properly"** is a request anyone can make sensibly, and it maps onto a deeper pass, a stronger
model and more retrieval without asking anyone to understand any of it.

**Recommend a shape and let Charlie decide. Do not build the charging in this sprint.**

---

## §4 — Standing

- Label change-log and handoff entries **SEARCH**.
- ⚠ **Both documents are standing references and must be kept current.** A contract that has drifted
  is worse than none, because the next reader trusts it. Whoever changes what search or the models
  can do updates the document in the same commit.
