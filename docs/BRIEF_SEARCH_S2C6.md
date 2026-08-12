# BRIEF — SEARCH STAGE 2C-6: TYPE THE NEW CORPORA, THEN FIX RECALL

**Owner:** CC-Search
**Stream:** SEARCH
**Written:** 12 August 2026
**Follows:** `BRIEF_SEARCH_S2C5.md` — §1/§2/§3 complete (`docs/SEARCH_S2C5_REPORT.md`); §4's two
unknowns settled, its eight repoints deliberately not done; §5 untouched.

**Where this sits:**
- *Two back:* S2C-4 — measured dense recall at 70.4%, stopped at the gate
- *Last:* S2C-5 — probes to 64; ordering metric honest; **reranker NOT authorised** because the
  binding constraint is recall, not order
- **This: S2C-6 — type the four new corpora, then attack recall directly**
- *Next:* the routed-gateway migration (Lex chat onto the routed path) — the last thing before Pilot A
- *Then:* semantic search on the remaining four streams, one at a time

---

## §0 — On what S2C-5 found, because it changed the plan rather than executing it

Three things in that report are worth naming before anything else.

**You stopped the reranker on evidence rather than on instruction.** The brief authorised it if the
number supported it. The number's *denominator* said something different: only 4 of 15 scoreable
pairs compared two documents the system actually returned, 11 turned on whether a document arrived at
all, and a reranker cannot promote a document that never arrived. That is the correct reading and it
redirects this sprint.

**You caught the harness concluding from zero data.** *"PECR still leads — the ordering problem is
REAL"* printed off an empty ranking because `DATABASE_URL` was missing. Reported, that would have
authorised a sprint from a missing environment variable. It is the same family as every other failure
this project has had: a true-looking sentence with its provenance stripped off.

**And you separated two metrics I had conflated in the brief, which was my error to own.** S2C-4's
70.4% → 85% was *overlap with an exhaustive probe* — candidate-set fidelity — and I wrote it into
S2C-5 as "+12.7pp of dense recall". They are not the same quantity and they did not move together.
A better candidate set is necessary for better answers, not sufficient.

---

## §1 — Type the four V34 corpora (first, because ingest is blocked on it)

V34 landed **31,852 sections, 34.5M words** and none of it is retrievable: no `corpus-map.ts` entry,
so `corpusToType` returns null and the adapter drops every row. CC-Ingest cannot build the FTS index
until the typing is committed, so this is the critical path.

| corpus | sections | what it is |
|---|---:|---|
| `commons-divisions-votes` | 2,361 | roll-calls, 2016→ |
| `lords-divisions-votes` | 3,284 | roll-calls, 1999→ |
| `impact-assessments` | 18,759 | the government's own statement of problem, options, expected effects |
| `consultations` | 7,448 | who was asked, who responded, what the department did |

**Decide and state the reasoning for each, and treat them as four decisions rather than one sweep** —
the same discipline as S2C §1. My reading, for you to confirm or overturn with evidence:

- **Impact assessments are the important one and they are not GUIDANCE.** GUIDANCE means "regulator
  and soft law". An IA is the government's case for a provision — what problem it was solving, what
  it expected to cost, what it predicted would happen. Paired with `EXPLANATORY_NOTE` (what it was
  *for*) it is half the deepening's precedent triangulation, and mislabelling it repeats exactly the
  error the tenth type was created to fix. **A dedicated type is probably the honest answer.**
- **Consultations** are a different thing again — the record of who was asked and what they said
  before the law existed. Also arguably its own type.
- **Divisions** are the closest to an existing type (DEBATE), but a roll-call is not a debate and a
  user seeing one labelled "Debates" would reasonably think it was one.

⚠ **Do not add a type silently** — S2C-2 established that a type missing from `TYPE_ORDER` renders
nowhere and tsc cannot catch it. `check:corpus-types` asserts all three display files cover the live
union; extend it for whatever you add.

⚠ **Before-and-after on whichever stream receives them**, in the S2C-2 §3 shape: gold questions,
contamination on queries that plainly want something else, latency. 31,852 sections is not the
million that Scottish material was, but impact assessments are dense and long.

**One correctness requirement regardless of type:** a user must be able to tell an impact assessment
from the law it assesses, and a roll-call from a debate. Say what the rendered titles read as.

---

## §2 — Attack recall, which is what S2C-5 said the constraint is

Your own recommendation, and it is the right one: **raise the candidate count reaching the scorer,
then re-measure on the same harness.** The six vacuous pairs are the target.

- Report what the candidate count currently is at each stage — per-stream retrieval limit, what
  survives fusion, what reaches the interleave, what reaches the answer.
- Raise it and re-run the preference harness. **The number to watch is the denominator, not the
  accuracy**: 9 → something worth the name is the result. Accuracy moving on a denominator of 9 is
  noise.
- Report latency and token cost alongside, since a bigger candidate set is a direct cost.

**If the denominator improves materially and accuracy stays near two-thirds, the reranker case
becomes real and this same harness will show it.** That is the gate, unchanged.

Two specific retrieval findings from S2C-5 worth chasing here rather than filing:

- **UK GDPR is absent from the top 20** on the data-protection query, while the SI that *amends* it
  (`uksi/2019/419`) is retrieved at 16. A retrieved amendment whose parent is missing is a concrete,
  diagnosable recall failure and probably a good place to start.
- **`caselaw` selection 36/36 → 22/36 is still open.** Neither harness measures router stream
  selection over that 36-query set. It needs a small separate run — a router-selection count. Do it
  here rather than carrying it a fifth time.

---

## §3 — The legacy DROP repoints (§4 of S2C-5, unchanged)

Eight paths, re-audited and all still live. Run it with a clean session, as you said. Both unknowns
are settled and in your report: **migrate the `IdeaLegislation` row** (the Constitutional Reform Act
2005 linked from "Abolish the Supreme Court" by the idea's creator — considered work, not a fixture),
and **no new indexes are needed on `corpus_acts`**.

**Charlie's answer to the untitled-rows question you raised, which was the right question to stop
on:** `corpus_acts` has 250,808 rows but only 135,531 titled — the extra 115,277 are precisely the
untitled EU material. **Filter to `title IS NOT NULL` for the browse and filter UI.** Reasoning: a
filter that returns a gid as a display label is not a wider feature, it is a worse one, and "wider
coverage" is only a benefit if the extra rows are usable. The untitled instruments remain fully
searchable by keyword — they are excluded from *browse*, not from the corpus. Revisit if titles ever
land.

Then the repoint-confirm to ingest.

---

## §4 — NOT this sprint, recorded so it survives a `/clear`

**The routed-gateway migration.** The Lex chat route, `/api/search` and the legislation-search panel
still take the tier-scoped branch and get neither routing nor dense retrieval. That is where pilot
users will spend their time. It gets its own brief, immediately after §2 reports.

**Semantic search on the remaining four streams.** Cheap to enable — `LEX_VECTOR_STREAMS` takes a
list — but the binding constraint is `vector-serve`'s concurrency cap of 4 with a queue observed at a
high-water mark of 46. Five streams means five ANN searches per query. One stream at a time,
gold-tested, with the queue depth watched. After §2.

---

## §5 — One decision Charlie needs to take, teed up by your own numbers

**`VECTOR_NPROBES` is 64 and the justification weakened under measurement.** We pay ~14% on p50 for a
materially better candidate set whose benefit at gold is undemonstrated. You were right not to revert
it unilaterally.

**Leave it at 64 for now** — but the reason is §2, not the original one: a better candidate set is
exactly what a recall-focused sprint wants to consume, and reverting it now would remove the input
before testing whether anything can use it. **If §2 reports no recall improvement that traces to
candidate quality, revert to 24 and take the 14% back.** That is the decision point, and it is
recorded here rather than left implied.

---

## Working rules

Unchanged. This week added two worth keeping: **a comment describing a fix that has landed is a false
map, not a harmless artefact** — the stale `interleave.ts` header nearly produced the opposite
conclusion in §2 — and **a harness must refuse to conclude from an empty result**.
