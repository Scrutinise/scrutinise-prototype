# DESIGN — THE POSITION GRAPH: WHO IS LIKELY TO SUPPORT OR OPPOSE, AND WHY

**Status:** design only. Nothing here is built. Implementation lands in Stage 2D, after the core
retrieval stack is complete and gated on source indexing.
**Written:** 10 August 2026
**Supersedes:** the "people-graphs" entries in `SEARCH_STRATEGY.md` §9.2, which this extends rather
than replaces — §9.2 is person-shaped; this adds organisations, publications, and the thing that
connects them.

---

## 1. What this is for, in one paragraph

A user arrives with a proposal. Before they take it anywhere, they should be able to see who is
likely to support it, who is likely to resist it, on what grounds, and with the evidence for that
expectation laid out so they can check it themselves. The purpose is **not** political intelligence
and **not** campaigning. It is scrutiny: a proposal that has already answered its strongest
opposition is a better proposal, and legislation that survives contact with its opponents is the
legislation that passes. The output is equally useful to someone arguing either side, which is the
test of whether it has been built neutrally.

---

## 2. The load-bearing design decision: propositions, not labels

**We never say an actor is left, right, pro-business, or populist.** Those labels are contested,
lossy, and — Charlie's point, and it is the correct one — frequently orthogonal to the actual
split. The globalist/nationalist division cuts across both main parties; degree-of-intervention
divisions cut across each of them again; on any given bill the real coalition rarely matches the
party map.

So the atom of the graph is a **proposition**: a specific, contestable claim or question on which
an actor can be for, against, or explicitly balanced.

> *"Section 21 no-fault eviction should be abolished."*
> *"Water companies should face criminal liability for sewage discharge."*
> *"Buy-now-pay-later should be brought inside the Consumer Credit Act."*

Each actor holds a **position** on each proposition where evidence exists, and nothing at all where
it does not. Alignment between two actors is then measured, not asserted: it is the agreement rate
across the propositions both have addressed. Two bodies that submit the same recommendation to the
same three inquiries are allies on that question whether or not they would describe themselves that
way — and the same pair can be opponents on the next one. Partial, issue-conditional alliance falls
out of the structure rather than having to be modelled specially.

This is the same mathematics as an embedding, over stated positions instead of word co-occurrence.
The advantage over an embedding is that it stays interpretable: you can always name the three
documents that put two actors close together, which is what makes the drill-down possible.

### Where propositions come from

Two routes, and both are already half-built:

1. **From the user's own proposal.** Lex already decomposes an idea into a diagnosis, a guiding
   policy and coherent actions. The contestable claims are therefore already enumerated by the time
   the user reaches this stage — the diagnosis's causal assertions and the chosen lever are exactly
   the things people take sides on. No new user work.
2. **From the corpus.** Recurring contested claims mined from committee evidence and Hansard,
   clustered. This is the argument/contested-cause graph already sketched in `SEARCH_STRATEGY.md`
   §9.4, and it is what lets us answer "who has taken a side on this before" for a proposition the
   user has never articulated.

---

## 3. Nodes and edges

### Nodes

| Node | Examples | Identity problem |
|---|---|---|
| **Person** | MP, peer, minister, special adviser, named witness, journalist | name collision; name changes; title vs person |
| **Organisation** | trade body, union, charity, think tank, company, regulator, APPG | rebrands; subsidiaries; the same body under three names across three registers |
| **Publication** | newspaper, broadcaster, trade press, substack | ownership changes |
| **Proposition** | as §2 | wording drift — two phrasings of one claim |

Entity resolution across registers is the single largest hidden cost in this build. Budget for it
explicitly rather than discovering it. Companies House numbers and Parliament's member IDs are the
two stable keys available; everything else is name matching with a confidence score.

### Edges — every one carries a source document, a date, and a confidence

**Observed (factual, cheap, high precision):**

- `gave-evidence-to` — person or organisation → inquiry *(committee evidence, in corpus)*
- `responded-to-consultation` — organisation → consultation *(not yet ingested; see §6)*
- `provides-secretariat-to` / `funds` — organisation → APPG *(APPG register)*
- `registered-client-of` — organisation → lobbying agency *(ORCL quarterly returns)*
- `met-with` — organisation → minister or senior official, with the stated purpose *(departmental
  quarterly transparency returns)*
- `declared-interest` — MP → organisation *(Members' Interests, already ingested)*
- `voted` — MP → division *(Public Whip / Parliament divisions)*
- `donated-to` — organisation or person → party or candidate *(Electoral Commission)*
- `authored` — journalist → article

**Inferred (LLM-extracted, always confidence-tagged, always with the passage attached):**

- `holds-position` — actor → proposition, with polarity (`for` / `against` / `balanced`) and the
  extract that supports it.

The discipline from `SEARCH_STRATEGY.md` §9.6 applies unchanged: explicit before inferred, every
inferred edge carries provenance and confidence, and nothing ships until the retrieval underneath
it is solid.

---

## 4. Media: topic tendency, shown with working

Charlie's framing is the right one and it also happens to be the defensible one: **do not label
outlets left or right; report how they have covered this kind of question.**

The output form is:

> On the 25 propositions in this policy area where coverage divided, these outlets tended to
> support: … These tended to oppose: … These were broadly balanced: … *(show me the articles)*

Three reasons this beats a bias rating. First, it is derived from the material rather than borrowed
from a third party. Second, it is proposition-specific, so it survives the fact that outlets are
not consistent across issues. Third, it is checkable — the user can open the articles and disagree
with us, which is the only honest form for an inference about a publication.

**On buying it in instead:** Ground News does not measure bias. It averages published ratings from
AllSides, Ad Fontes Media, and Media Bias/Fact Check; those ratings are made at *publication* level
and calibrated to the *U.S.* political system; and there is unresolved provenance in that supply
chain, with AllSides having told CJR that Ground News uses its ratings without formal permission or
compensation. For UK legislative propositions that is the wrong instrument on three axes at once.
Build it, and where a lesser-known outlet has too little coverage to place, **say so** rather than
estimating.

Journalists get the same treatment as outlets where the evidence exists, and the same caveats as
§5.

---

## 5. Safety rules, which are also accuracy rules

Charlie's reasoning is right — we gather and display evidence rather than advising anyone to do
anything, and sorting contributions into sides on a debate is not defamatory. The rules below exist
because they make the output *more accurate*, not because they are legal cover.

1. **State the evidence, let the user draw the conclusion.** Every position is displayed with the
   passage that produced it and a link to the source. No summary claim without a visible basis.
2. **Date-stamp every position, and never collapse a changed view.** An actor who argued one way in
   2019 and another in 2024 has changed their mind, which is a *finding*, not noise to be averaged
   away.
3. **Caveat the modes that mislead**: a commissioned or devil's-advocate piece; a body giving
   evidence in a representative capacity rather than its own; a minister stating the government
   line. Where the material does not let us tell, say we cannot tell.
4. **"No evidence" is an output.** Silence is never rendered as neutrality or as opposition.
5. **Publish a correction route.** The same pattern as the legislation guide: a visible "this is
   wrong about me" form. A public position graph will attract corrections, and the corrections are
   worth more than the errors cost.
6. **Never generate a recommendation about a person.** The output describes positions on
   propositions. It does not suggest approaching, pressuring, or avoiding anyone.

---

## 6. Sources, ranked by yield against cost

**Already in the corpus** — usable as soon as the reachability work lands:

- Committee written and oral evidence: submitter organisation, position, argument. The richest
  single source, and the one where organisations state positions in their own words for the record.
- Hansard: who argued what, when, and against whom.
- Members' Interests: declared interests, already ingested (and currently unreachable — see
  `BRIEF_SEARCH_S2C.md` §1c, where the exclusion becomes deliberate).

**Ingest gaps that block this work** — both flagged by the reachability matrix as having no
collection and no `corpus_targets` row at all:

- **Consultation responses.** Directly the "who said what before the law passed" record, and one of
  the highest-value inputs to this graph. Currently absent.
- **Impact assessments.** Problem statement, counterfactuals, intended outcomes.

**External registers** — new ingest, all open, all structured:

| Source | What it gives | Form |
|---|---|---|
| APPG register | secretariat providers and funders per group | published register |
| ORCL quarterly returns | consultant lobbyist → client | published register |
| Departmental quarterly transparency returns | ministers' meetings with external organisations, plus overseas travel; gifts and hospitality centrally published since July 2024 | CSV on gov.uk, collated on data.gov.uk |
| Senior official and SpAd returns | the access that does not happen at ministerial level | same collections |
| Electoral Commission | donations to parties and candidates | database |
| Companies House / Charity Commission | funding, directorships, and who actually controls a body that calls itself a think tank | API |

⚠ **The meetings data is a lower bound on contact, never a census.** The Institute for Government
found meetings omitted from returns, returns amended after publication, and the Ministry of Justice
publishing within its own one-quarter target in only six of twenty-three quarters assessed. Surface
that caveat in the product rather than burying it: a gap in the record is itself information, and
presenting a partial register as complete is the kind of error that would be fair to attack us for.

**Web and news** — for the media layer only, at the reliability tier the strategy document already
sets: the corpus testifies, the web gives context, social merely circulates.

---

## 7. Output, in two stages

**Stage one — pilot.** A narrative paragraph, generated per proposal:

> Expect support from … on the grounds that … *(3 sources)*. Expect resistance from … who have
> argued … *(3 sources)*. Contested within … Coverage in this area has tended to …

Cheap, shippable, and honest about its own confidence. This is what Pilot A and Pilot B get.

**Stage two — deferred, recorded here so it is not re-derived.** An explorable graph: pick a
proposition, see the actors placed by position, expand any node into its evidence, filter by time
to watch a coalition form or break. This is a product in its own right and belongs in the advanced
graph layer alongside the other §9.4 content graphs.

---

## 8. Build order, when 2D starts

1. **Entity resolution spine first.** Organisations and people, keyed on Companies House numbers
   and Parliament member IDs, with name-match confidence for everything else. Everything below
   depends on this and nothing below can compensate for getting it wrong.
2. **Observed edges from material already in the corpus** — committee evidence submitters, Hansard
   contributions, declared interests. Cheap, factual, and immediately useful on its own.
3. **Proposition extraction and `holds-position` edges** on a single policy area, gold-tested,
   before generalising. Pick an area with dense committee evidence.
4. **External registers**, in the yield order of §6.
5. **The media layer**, last, because it is the one most improved by having the rest to calibrate
   against.

The gate at each step is the same as everywhere else in this project: it ships when the measurement
rewards it, not when it is finished.
