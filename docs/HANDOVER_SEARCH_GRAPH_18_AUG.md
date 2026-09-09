# HANDOVER — SEARCH AND GRAPH, AS AT 18 AUGUST 2026

**Written by:** CCh-Search (the outgoing conversation), for the incoming one.
**Covers:** the Search and Graph streams, and the Surface stream it spawned.
**Read alongside:** `docs/handoff_summary.md`, which is authoritative on what has actually shipped.
This file carries the reasoning and the open questions, which the change log does not.

---

## 1. How Charlie wants to be talked to, and where the outgoing conversation kept failing

**This is the first section on purpose.** It was the most frequent complaint over 51 replies and the
failure recurred after being corrected four times.

**The rule:** every reply must stand alone. Assume he has not read the previous one. Define every
technical term, abbreviation and project shorthand **the first time it appears in that reply**, even
if it was defined an hour ago.

**Never quote a percentage without saying what it is a percentage OF**, what a good number would be,
what a bad one would be, and what follows from it. *"54%"* means nothing. *"Of fifty positions read
by hand against the source document, twenty-seven were wrong — so if we showed a user twelve
supporting organisations, about six would be wrong"* means something.

⚠ **The mechanism behind the failure, so the incoming conversation can avoid it.** The temptation is
to read CC's reports and *summarise* them. Summarising preserves the shape of the source, and CC's
reports are dense with project shorthand and bare figures. **Writing plainly means discarding CC's
framing and reconstructing from what the number means.** That is more work and it is the step that
keeps getting skipped.

**Also:** he is a capable non-programmer running four parallel CC terminals and relaying between
them. He does not want to be asked questions he cannot answer, and he does want decisions put to him
as numbered questions with a recommendation attached and the consequences of each choice stated.

---

## 2. Where things actually stand

### Search — the first-pass stack is essentially complete

Over roughly ten days the search stack went from broken to working, and the fixes are worth knowing
because each was found by measurement rather than reasoning:

- **Lex was answering from one part of the corpus out of five.** All five were retrieved, paid for,
  displayed — and four discarded before the answer was written.
- **The results panel sorted legislation off the end**, because two parts of the system produced
  scores on scales three orders of magnitude apart and something sorted them together.
- **The main Lex conversation could only see legislation.** Asked what MPs argued in the assisted
  dying debate, it answered from the letters *"assist investi"* matched inside an
  investigatory-powers regulation. Fixed in S5: on ten test questions it went from zero
  non-legislation results to a hundred, and seven questions that previously could not be answered
  at all now are.
- **17,261 instruments were missing from the corpus**, including the Companies Act 2006 and UK GDPR.
  Found by one engineer chasing one odd result rather than filing it. Recovered.
- **The spend meter was recording nothing** — the function existed and was wired into no
  user-facing path.

### The current binding constraint is the measuring instrument, not the search

**This is the most important thing in this document.**

Turning meaning-based search on changes between a third and a half of the top twenty results. **We
have no way to tell whether those changes are improvements**, because the test set is thin and three
of the four collections were scored on questions CC wrote itself. One metric CC built came back
identical in every configuration — saturated, measuring nothing.

**Nothing about retrieval quality can be improved reliably until the test set is real.** That is the
highest-value search job now and it is cheap: roughly ten questions per collection, whose correct
answers are known documents, sanity-checked by Charlie as things a real user would ask.

### Graph — factual layer strong, inferred layer not ready

**Reliable and completely invisible to users:**
- 2,478,613 records of how each member voted in each division
- 59,996 early day motion sponsorships
- 1,505 declared financial interests
- who gave evidence to which committee inquiry
- 5,496 organisations carrying a Companies House or Charity Commission number

**Not ready:** positions extracted from written submissions. Of fifty checked by hand against the
source, twenty-two were wrong or partly wrong. **If we showed a user "these twelve organisations
support your idea", around five would be wrong.** Not showable.

⚠ **And the diagnosis matters more than the number.** The direction was wrong on only two of the
fifty. When the model says a submission takes a side, it is nearly always right about which side —
it simply says so far too often, because models are built to be helpful and saying "this document
doesn't mention that" feels like failing. It is over-eagerness, not misreading, which is a much
cheaper thing to be wrong about.

⚠ **The insight the outgoing conversation reached late and should have reached early: we already
hold 2.5 million perfectly reliable positions and have surfaced none of them.** A vote *is* a
position. *"Matt Hancock voted for it"* needs no extraction, no confidence score and no caveat. We
have been trying to read positions out of careful prose while sitting on a mountain of positions
recorded as fact.

### Surfacing — the stream that exists because of a pattern

**Almost everything built in the last fortnight is invisible to a user.** Every other stream's job
is to add capability; nobody's was to make it visible; and when those compete, adding always wins
because it feels like progress.

CC-Surface was created with one rule: **it builds nothing new.** If a job needs new data, new
retrieval or new inference it belongs elsewhere. The test is *does the data already exist?*

First job done: telling a user when a provision has been repealed. Remaining, in order: the corpus
made visible; how your MP voted; explicit search.

---

## 3. Open decisions Charlie has not yet taken

1. **Committee test questions** — nobody can measure the largest collection we hold without them.
2. **The bottom-up claims architecture** (graph 2D-5 §4). Charlie's own idea and better than the
   design it replaces: instead of asking every submission about 83 pre-written claims, read each one
   once and extract every claim it makes. Finds what nobody thought to ask. Tested, not yet decided.
3. **OpenAI has no API key on the machine.** Google, Anthropic and xAI all verified working.
4. **Anthropic and xAI prices are not recorded**, so any pass on those models reports "unpriced" and
   the cost ceiling cannot hold on it.
5. **Two configured fallback models do not exist in the accounts** — a fallback that fails only when
   the primary already has.

---

## 4. Things that will be rediscovered expensively if forgotten

- **A check that cannot fail is not a check.** Prove every new check fails before trusting it to
  pass. This has caught real defects repeatedly, including a delete guard that would have accepted a
  four-day-old backup of the wrong data.
- **An inference must not travel as a measurement.** The outgoing conversation broke this itself:
  it asserted a 17.5 GiB database limit taken from a handoff note. The real ceiling is 16 TiB. A
  whole sprint had already been designed around the fiction.
- **Reachability is not completeness.** The corpus reported 99% *reachable* for two sprints while
  holding a quarter of the Acts that exist. Different question, and only one was being asked.
- **Read the artefact, not the counter.** Three of one sprint's findings were corrections to its own
  earlier results, and every correction came from opening the actual file.
- **Never merge two identities on similarity.** Members of the same party who are certainly
  different people vote the same way 98% of the time. Displaying every name is free; merging two is
  a claim. An unresolved name is visibly thin and harmless; a wrongly merged one is a person who
  does not exist, holding contradictory views, and nothing looks wrong.

---

## 5. What still has to happen for the full vision

**Search:** attribution on results (a committee transcript comes back without saying who wrote it —
the most useful fact about it); real test questions; case law split into its three distinct uses
(how will this be interpreted / how has it been challenged / how does the law connect); a derived
record of legal challenges to legislation and their outcomes; cross-domain mechanism analogues,
which need provisions tagged by mechanism first and are the platform's strongest potential
differentiator; grouping results by the question they answer rather than by document type.

**Graph:** positions accurate enough to show; the claims architecture decision; the external
registers — lobbying register, all-party group funders, ministerial meetings, Electoral Commission;
web data for organisations that never appear in the corpus; the media layer; the explorable graph
itself.

**That second list is the larger body of work and the one nothing else can replicate.**
