# DESIGN — THE POSITION GRAPH: WHO IS LIKELY TO SUPPORT OR OPPOSE, AND WHY

**Status:** 2D-1 and 2D-2 are BUILT. The entity spine, the observed edges from committee evidence,
Hansard-adjacent sources and members' interests, the `voted` and `signed-motion` edges, and (from
Amendment 2) the mention display layer, the identity tiers and the behavioural identity signal are
all live on Neon. `holds-position` — the inferred edge, and the one everything user-facing waits on
— is NOT built. Reports: `POSITION_GRAPH_2D1_REPORT.md`, `POSITION_GRAPH_2D2_REPORT.md`,
`POSITION_GRAPH_AMD2_REPORT.md`.
**Written:** 10 August 2026
**Amendments folded in:** Amendment 1 (11 Aug 2026 — the observed edge list) and Amendment 2
(16 Aug 2026 — identity, mentions, and where the data comes from), on 16 August 2026. Both source
documents are kept unchanged beside this one as the record of what was decided when and by whom;
this file is now the single place to read the design.
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

### The unit of display is the MENTION, not the entity *(Amendment 2 §1 — first principle, ahead of everything below)*

> *"Andrew Roberts spoke against this in committee XYZ"* — click the name — *"no further information
> on Andrew Roberts."*

That is a good output. It states what the record shows, links the evidence, and is honest about the
limit. **The design originally gated MP-facing output behind resolution and should not have.**

- **A mention can always be displayed.** Name as it appeared, position taken, source, date.
- **An entity is a claim that several mentions are the same actor**, and needs evidence.
- **Never withhold a mention because the entity behind it is unresolved.** Unresolved is a state to
  report, not a reason to hide the finding.

The measured cost of the old gate, taken before the change (`report-amd2.ts`, 16 Aug 2026): of
48,409 person entities **2,603 are keyed (5.4%)** and 46,245 carry at least one edge. Gating display
on resolution hid **94.6% of the people we hold anything about at all**.

⚠ **What this does NOT relax is the merge rule.** Three unresolved Andrew Robertses are three thin
records — visibly thin, and harmless; and they really are thin, measured: **38,903 of the 45,018
unresolved people hold exactly one mention.** Three *merged* into one produce a composite actor who
does not exist, holds contradictory positions, and appears more influential than any of the real
ones. **Unresolved is visible. Wrongly merged is not.** That asymmetry is why the caution stays on
merging and comes off display.

⚠ **One thing the mention layer cannot yet do, stated so it is not assumed.** "The name as it
appeared" is not recoverable per appearance: `graph_edge` carries no surface, and
`corpus_sections.speaker` is NULL on 5,000 of 5,000 sampled committee-evidence sections. Surfaces
are held per (entity, source) in `graph_alias`, so `graph_mention.display_name` is the entity's
canonical name and is flagged `surface_is_per_entity`. **The fix belongs in the sweeps: record the
surface on the edge when the edge is written.**

### Confidence is shown to the user, not just stored *(Amendment 2 §3)*

`key_source` and `confidence` were being recorded honestly and read by nobody. Three tiers, defined
once in SQL (`graph_identity_tier`) so a screen cannot invent its own wording:

| basis | what the user is told | count (16 Aug 2026) |
|---|---|---|
| **Stable external key** — Companies House, Charity Commission, Parliament member id | "This person / body, identified" | 2,603 people · 26,111 organisations |
| **Name match, corroborated** — matched against a register | "Probably this person / body" | 788 people · 0 organisations |
| **Mention only** — a name in a document, unresolved | "The name as it appeared, and nothing more" | 45,018 people · 14,407 organisations |

⚠ **Never present the third as the first.** A user acting on a political-risk assessment needs to
know whether the actor is identified or inferred, and the whole product claim is that we show our
working.

⚠ **The tier is derived from `key_source`, never from "does an id column have a value".** All 788
name-matched people DO carry `parl_member_id`; 2D-2 put the match in the id column and the
uncertainty in `key_source`/`confidence`. Reading the id would promote every one of them to tier 1.

### Behaviour is identity evidence *(Amendment 2 §2)*

If two clusters sharing a name take consistently different positions, that is evidence they are
different people. If they take the same positions, the distinction may not matter for what we
report. This is free — the positions are already the graph's content, so it is a query.

- **Splitting.** A name-matched cluster whose positions are internally contradictory is FLAGGED for
  review. A hypothesis, not a verdict: one person genuinely changing their mind is a finding §5.2
  already protects, and must not be silently split into two.
- **Merging.** Behavioural similarity is **not** grounds for merging, and this is now measured
  rather than asserted. Random SAME-PARTY pairs of members who are definitely different people
  agree **97.9%** of the time (n=150, ≥20 shared divisions); cross-party pairs agree 10.5%.
  Agreement is a party signal, not an identity signal. The starkest case in the data: two
  successive Archbishops of Canterbury, an identical register display name, 21 shared divisions and
  **100% agreement** — a merge that behaviour would endorse and that would fabricate a person.

The signal is stored in `graph_identity_signal` with its evidence and **no column a resolution
could be written into**; `finding` refuses a merging value at the database level.

⚠ **Record it as a signal with its evidence, never as a resolution.** *"These two clusters disagree
on 6 of 8 shared propositions"* is a fact. *"Therefore they are different people"* is an inference,
and it belongs to whoever reads it.

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
- `signed-motion` — **person → motion**, with the date of signature *(the EDM register)*
  *(Amendment 1 §1.)* An EDM is a motion an MP signs to put a position on the record. Nobody signs
  one by accident and nobody signs one on someone else's behalf, which makes it **the
  highest-confidence position signal anywhere in this design** — higher than a committee
  submission, which is often an organisation's institutional line rather than an individual's, and
  far higher than anything inferred from a speech.
  - **The motion is the proposition, or very nearly.** "That this House notes X, believes Y, and
    calls on the Government to Z" is closer to §2's proposition unit than anything else we hold, so
    EDMs may be the cheapest place to *bootstrap* the proposition set rather than merely a place to
    hang positions on one.
  - **A signature is dated and never withdrawn in the record**, so signature order over time is a
    coalition-formation signal that costs nothing extra to capture. §5.2 applies directly.
  - ⚠ **Non-signature is NOT opposition.** Most members never sign any given motion, often having
    never seen it. §5.4 without exception: silence is silence.
  - *Built in 2D-2 as a view over `edm_sponsor`, PRIMARY SPONSOR ONLY — 59,996 edges. **97.1% of
    the 2,125,547 signatures are still absent**; the full signatory scrape is outstanding.*

**Not an actor edge, and the difference matters** *(Amendment 1 §2)*:

- `petition-support` — **proposition → signature count**, with date and, where published,
  constituency breakdown. **No named individuals.**

Petition signatures are anonymous. There is no actor edge to be had, and anyone arriving from the
EDM design will look for one and find nothing. What a petition gives is **public salience attached
to a proposition** — how many people cared, when, and where. The constituency breakdown, where
published, permits *"this proposition drew above-average support in your constituency"*, which is
factual, neutral and directly useful to someone deciding how to approach their own MP.

⚠ **Petition volume is not evidence that a proposition is right.** It is evidence that people
signed. A large count beside a small one is a salience comparison, not an argument.

**Inferred (LLM-extracted, always confidence-tagged, always with the passage attached):**

- `holds-position` — actor → proposition, with polarity (`for` / `against` / `balanced`) and the
  extract that supports it.

The discipline from `SEARCH_STRATEGY.md` §9.6 applies unchanged: explicit before inferred, every
inferred edge carries provenance and confidence, and nothing ships until the retrieval underneath
it is solid.

**The standing rule Amendment 1 §3 exposed:** *a collection may only be deferred to the graph
against a named edge type.* If no edge type above consumes it, either the edge is missing from this
design — as it was for EDMs and petitions — or the deferral is wrong. Naming the edge is what makes
"deferred" a decision rather than a shelf.

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
7. **Users are a source, not just a complaints channel** *(Amendment 2 §5)*. A user may add what we
   do not hold; an unresolved mention is exactly the thing someone who works in the field can
   identify in five seconds.
   - Contributions are their own object, attributed and reviewable — the same shape as §22.4's
     contribution model, never a direct edit.
   - **A user-supplied identity carries its own confidence tier**, distinct from a register match
     and distinct from a name match, and is labelled as such.
   - ⚠ **Anyone may claim their own record**, and a self-identification is evidence — but it is
     also the obvious vector for someone to curate how they appear. Attribute it, date it, and
     **never let a claim delete the record it disputes**: the correction sits *alongside* the
     evidence, never over it.
8. **Report the two halves separately; never average them** *(Amendment 2 §6)*. Measured 16 Aug
   2026: organisations are identified on a stable key at **64.4%**, people at **5.4%** — a factor
   of twelve. The blended 32.3% describes neither. The reason is about language rather than data:
   **organisation names are distinctive and personal names are not.** "Shelter" is Shelter;
   "Andrew Smith" is nobody in particular. A name match on an organisation is far stronger evidence
   than the same match on a person, so tier 2 does not even mean the same thing across the two
   halves. **Organisations are usable now. People are not**, and §3's mention-level display is what
   makes them useful in the meantime.

---

## 6. Sources, ranked by yield against cost

⚠ **Recorded plainly because the design implied it and never said it** *(Amendment 2 §4)*: **the
graph currently reads only the corpus.** No external register, no web. That was right for a first
pass and is not sufficient for what this is for. In order of value per unit of work:

1. **Companies House and the Charity Commission.** Stable keys for organisations, plus the funding
   and directorship picture that says what a body calling itself a think tank actually is. **The
   single largest improvement available to the organisation half**, and organisations are the half
   that matters most. *(The `companies_house_no` and `charity_no` columns already exist on
   `graph_entity` and `graph_identity_tier` already assigns them tier 1 — the sweep is the work.)*
2. **The registers already named below** — APPG secretariats and funders, the consultant lobbyist
   register, ministerial and senior-official meeting returns, Electoral Commission donations.
3. **The open web**, for organisations that appear nowhere in the corpus. ⚠ Adding web data before
   resolution is solid multiplies ambiguity rather than reducing it — **so registers first, web
   after.** The registers *improve* resolution; the web *tests* it.

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

⚠ **Step 1 below was written as a hard gate and Amendment 2 removed it as one.** Resolution still
comes first because everything downstream is better for it — but *display* no longer waits on it
(§3, the mention). Read step 1 as "build the spine early", not "show nothing until it is done".

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
