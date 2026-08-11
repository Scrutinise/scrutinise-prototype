# BRIEF — INGEST: THREE PARALLEL SOURCES FOR THE POLITICAL-EVIDENCE LAYER

**Owner:** Ingest thread (CC-Ingest)
**Written:** 10 August 2026
**Runs alongside:** the `corpus_vec` delta embed already in progress, and the Search thread's Stage
2C. Nothing here shares a resource with either, so all three can run in parallel.
**Target:** usable by Pilot B (4 September 2026).

---

## Why these three, and why now

The reachability matrix (`docs/CORPUS_REACHABILITY.md`, 9 Aug) found that two of these do not exist
in the corpus at all — no collection, and no `corpus_targets` row, meaning they were never scoped
rather than merely unseeded. The third has always been in the plan as a later phase.

All three feed the same product goal: showing a user who is likely to support or oppose their
proposal, on what grounds, with the evidence attached. See `POSITION_GRAPH_DESIGN.md` for what
consumes them.

**Take them in the order below.** A is the smallest and the most visibly useful; C is the largest
and the most valuable to the graph.

---

## A. Division (voting) data — the smallest, do it first

### What it is

A division is a recorded vote in the Commons or Lords. The division record lists every member and
which lobby they voted in. This is what lets us answer, factually and neutrally:

> This provision entered the Bill as Amendment 12, divided on 14 March 2023. Your MP voted against.
> 78% of their party voted for.

### Sources, in priority order

1. **Commons Votes API — `https://commonsvotes-api.parliament.uk/`.** The source of record. Note
   the older `data.parliament.uk` division endpoints are being retired in favour of this host, so
   do not build against the legacy URLs.
2. **Lords Votes API** — the equivalent for the upper house, listed on
   `https://developer.parliament.uk/`.
3. **Members API — `https://members-api.parliament.uk/`.** Needed for the party affiliation and the
   constituency, because <cite index="12-1">party affiliations are not recorded in the division lists themselves</cite>. Also
   needed for the historical membership table, so a vote is attributed to the person who held the
   seat *at the time*.

### On Public Whip — use it as a cross-check, not as the source

The Public Whip is <cite index="11-1">a parliamentary-informatics project that analyses and publishes UK MPs' voting history. It was built after the March 2003 Iraq vote as a way of recording which MPs had defied their party whip once that information had become effectively inaccessible, and it shares a large part of its parliamentary parsing code with mySociety's TheyWorkForYou.</cite> <cite index="11-1">Its main process downloads Hansard transcripts daily and matches names to member IDs.</cite> It has been under different stewardship since 2011 and is <cite index="10-1">a not-for-profit open-source project, currently maintained by Bairwell Ltd, with its source on GitHub.</cite>

**Two reasons it is not the source of record for us.** First, provenance: Parliament's own API is
the primary and Public Whip is a derived parse of Hansard, so where they disagree the API wins.
Second, and more important for Scrutinise specifically: Public Whip's headline feature is
*policy alignment scores* — "voted strongly for X" — which require someone to have decided which
divisions count as being "for X". **That editorial judgement is exactly the kind of curation we have
ruled out** (same reasoning as not curating a list of think tanks: the selection is the political
act). Take the raw division records; do not import the policy labels.

Its genuine value to us is as a **historical backfill and a cross-check** — it goes back further
than the modern API in places, and a disagreement between the two is a signal worth investigating
rather than averaging away.

### What to store

One row per member per division: division id, date, house, member id, party at that date,
constituency at that date, vote (aye/no/teller/absent), plus the division title and the Bill and
stage it belongs to. Absence must be distinguishable from a no vote and from not being a member.

### The join that makes it useful, and the honest limit

**The House almost never divides on an individual clause.** Divisions happen on amendments, on new
clauses, and on the Bill as a whole at each reading. So the link we need is
*provision → the amendment that inserted it → the division on that amendment*, which comes from the
amendment paper and the Hansard proceedings, not from the votes API alone.

**"Passed without a division" must be a first-class output, not a null.** It is often the more
useful finding: it tells the user the provision went through unexamined. Design the schema so this
is recorded as a fact rather than inferred from missing rows.

Charlie's second point, which is a requirement not a nice-to-have: **record what the provision was
carried inside.** A clause of interest may sit in a Bill about something else entirely, and the
title of the parent Bill can be actively misleading about what was voted on. Store the parent Bill,
the stage, and the division title, and surface all three together.

### Also needed for the constituency feature

A postcode → constituency mapping (ONS Postcode Directory) plus the current members list. Confirm
licensing before building; ONS geography products are generally Open Government Licence, but check
rather than assume.

---

## B. Impact assessments

### What they are and why they matter

The government's own statement, published alongside a Bill or SI, of the problem being solved, the
options considered, the option chosen, the expected costs and benefits, and the intended outcomes.
The corpus plan calls this class "gold for *what were they solving*", and it is the single best
answer to a user's question "has anyone tried to fix this before, and what did they think would
happen?"

### Sources

Verify the route before building, in the standing priority order — **bulk download first, HTML
scraping second, API only if neither exists.**

- **legislation.gov.uk associated documents.** Impact assessments and explanatory memoranda are
  published as linked documents on SI and Act pages. Since we already ingest legislation.gov.uk
  wholesale, this is likely the cheapest route and reuses an existing pipeline.
- **gov.uk.** Departmental impact assessments published as attachments to policy papers.
- **Regulatory Policy Committee opinions**, which review IAs and rate them — valuable because an
  RPC "not fit for purpose" rating on an impact assessment is exactly the kind of contested
  provenance a user should see.

Most will be PDFs. Confirm the extraction quality on a sample before committing to a full run;
the eur-lex sectioning fault is the standing warning about assuming a document type sections
cleanly.

### Record the gap

Impact assessments are not published for everything and were not always required. **Where a
provision has none, that must be surfaced as a known absence, not silently omitted** — the standing
rule that known unknowns beat silent absences.

---

## C. Consultation responses — the largest, and the most valuable to the graph

### What they are

Before most significant legislation, the department consults. The published outputs are the
consultation document, the responses (sometimes individually, more often summarised), and the
government response explaining what it did with them.

This is the **"who said what before the law passed" record** — organisations stating positions in
their own words, on the record, dated. It is the highest-value single input to the position graph,
because it gives us `responded-to-consultation` and `holds-position` edges for bodies that never
appear before a select committee.

### Sources

- **gov.uk consultations.** Available through the gov.uk Search API filtered to the consultation
  document type, with full content through the Content API. Check for a bulk route first.
- **Departmental sites** for older consultations that predate the gov.uk migration; expect gaps.
- **Committee consultations** are already covered by `committees-evidence` — do not duplicate.

### What to capture, beyond the text

- The **responding organisation's name as given**, verbatim, plus any normalised form. Do not
  discard the raw string — entity resolution across registers is the largest hidden cost in the
  graph build and the original spelling is evidence.
- Whether the response was **published individually or only summarised**. A summarised response is
  the department's characterisation of what someone said, not what they said, and the two must not
  be presented as equivalent.
- Dates on everything, so a position can be attributed to a moment rather than to a body in
  general.

---

## Not in this brief, and why

**`scottish-parliament-or` is not an ingest job.** I described it as one on 10 August and that was
wrong. CC-Search established that the collection is already typed `DEBATE`; it carries tier `other`
in the built index, and the fix is a single `extraCorpora` entry on the debates stream — the same
mechanism just used for `erskine-may`. It has gone back to the Search thread, where it needs a
before-and-after measurement rather than a reindex.

---

## Working rules

- **Source access priority: bulk download → HTML scraping → API.** Build an API client only after
  verifying no bulk or HTML alternative exists.
- **Bytes before hypotheses.** Inspect a real sample before designing the parser.
- **Known unknowns beat silent absences.** Every gap gets classified and surfaced, never dropped.
- **Licensing checked before ingest, not after.** Record the licence and any commercial-use
  restriction per collection, as with the IMF flag.
- Report costs in full — storage *and* write operations *and* embedding — never one line item.
