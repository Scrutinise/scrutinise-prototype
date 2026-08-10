# BRIEF — SEARCH STAGE 2C-3: BILLS, AND THE DISPOSAL OF THE LAST 0.92%

**Owner:** Search thread (CC-Search)
**Written:** 10 August 2026
**Follows:** `BRIEF_SEARCH_S2C2.md` §1–§3 (landed, commit `e1406d0`). **§4 of that brief is still
the priority** — this is small work to run while Gate 2 is closed, not instead of it.

---

## §1 — `bills-api` into the search path

**Decision: yes, wire it in.** 6,574 sections, currently outside every stream.

The reasoning is product-shaped rather than coverage-shaped. Scrutinise exists to take someone from
an idea to a Parliament-ready proposal, and one of the first things such a person needs to know is
**"has someone already introduced a Bill doing this?"** A live or recent Bill on the same subject
changes what the user should do next more than almost anything else the corpus can tell them — it
may mean joining an existing effort rather than starting one, or it may mean their proposal needs
to distinguish itself from something already before the House.

Requirements:

- `BILL` already exists as a display type and `bills-api` is already excluded from the debates
  stream by name (`NON_DEBATE_PARLIAMENTARY`). Decide and state whether it belongs in the
  legislation stream, the debates stream, or its own leg, and give the reasoning — a Bill is
  proposed law, not enacted law, and the distinction has to survive into what the user sees.
- **A user must never mistake a Bill for an Act.** Same requirement as Holyrood versus Westminster:
  make the status visible in the rendered title or citation, and say what it now reads as. If the
  data carries a stage (first reading, committee, royal assent), surface it — a Bill that fell in
  2019 and a Bill in committee this week are very different pieces of information.
- Before-and-after on whichever stream receives it, in the shape §3 of S2C-2 used: gold questions,
  contamination on questions that plainly want enacted law, latency. 6,574 sections is small enough
  that I predict no measurable movement — but predicting it is not measuring it, and the prediction
  goes in `CHANGE_LOG` before the run either way.
- Re-run the reachability matrix and report the new figure.

---

## §2 — Early day motions and petitions: NOT search, record as graph inputs

**Decision: leave both out of the search streams.** `early-day-motions` (60,737 sections) and
`petitions` (49,529) stay outside, and the matrix should say why rather than listing them as a
residual.

An EDM is a motion that MPs sign to put a position on the record. As a document to retrieve and
read it is thin. As **data** it is one of the cleanest position signals in UK public life: a named
list of members who endorsed a specific proposition on a specific date, with no inference required.
That makes it a `holds-position` edge of the highest confidence tier, and it belongs to the position
graph (`POSITION_GRAPH_DESIGN.md` §3), not to a retrieval stream. Petitions are the same shape for
public salience rather than parliamentary position.

**Action here is documentation only:** record both in the matrix as `deferred-to-graph` with a
one-line reason, in the same spirit as `excluded-by-design` for `members-interests`. The point of
that verdict was that a collection nobody can reach *on purpose* must not print the same word as one
nobody can reach *by mistake*; a collection routed to a different consumer entirely is a third case
and should read as one.

---

## §3 — The rest of the 0.92%: deferred, by name

`cma-cases` (22,898), `ofgem` (17,161), `ofcom` (4,169), `uk-treaties` (3,264),
`independent-reviews` (667), `tax-treaties-dta` (324), `cps-guidance` (270), `inquiry-evidence` (90),
`lgsco` (40).

No action. Revisit after the reranker decision. Recording the list here so that "deferred" is a
decision with a date on it rather than an omission nobody owns.

---

## §4 — Unchanged and still first

`BRIEF_SEARCH_S2C2.md` §4: check the `corpus_vec` completion marker, then the benchmark and the
ordering baseline. Recall-lost-to-scoping is now 10 questions, not 12; the ordering baseline still
excludes D2–D5. **The reranker is authorised by that number or not at all**, and it is the last item
before the first-pass retrieval stack is closed.
