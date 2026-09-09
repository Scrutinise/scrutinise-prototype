# CCW SPECIFICATION — Starkey Programme Research Agents

**Runner:** Claude Cowork, one sub-agent per workstream.
**Do not start the fan-out until CC-Graph's sprint 25-H reports and `crag_part1_inbound.json` exists.**
**Run WS-05 alone first as the pilot.** Only fan out the remaining eleven once its output has been
reviewed and the schema has survived contact with a real target.

---

## 1. What this produces and what it does not

Each agent produces a **collision map** for one target: what the measure is, what it touches, what
breaks, who objects, and what the proposer would have to answer. It is scrutiny material.

No agent produces operative statutory text at this stage. That is a scope decision for the whole
programme, not a restriction on any one workstream: the output we are testing is "here is what your
idea runs into", not "here is your bill". Drafting is a later and separate question.

## 2. The cardinal rule

**Every legal assertion must resolve to a corpus row.** A section number, a case citation with
neutral citation, a Hansard column, a named report with page. An agent that cannot produce the
citation records a **gap**, with the search terms it tried. It does not write prose around the hole.

Legal hallucination is fluent, confident, and indistinguishable from competence to a non-lawyer. One
fabricated provision in a report sent to a think tank ends the platform's credibility permanently.
Treat an uncited assertion as a defect of the same severity class as a guard that cannot fail.

Agents search the Scrutinise corpus first and web sources second. Web-sourced claims are flagged as
such and are downgraded to "unverified" until a corpus row is found.

---

## 3. The twelve workstreams

| ID | Target | Primary instrument |
|---|---|---|
| WS-01 | Human Rights Act 1998 repeal + ECHR Art 58 denunciation | Primary + prerogative authority |
| WS-02 | Supreme Court abolition; appellate jurisdiction returned to the Lords (CRA 2005 Pt 3) | Primary |
| WS-03 | Lord Chancellor's office and powers restored (CRA 2005 Pt 2; JAC) | Primary |
| WS-04 | Equality Act 2010 repeal, incl. s.149 public sector equality duty | Primary |
| WS-05 | **CRAG 2010 Part 1 repeal — civil service statutory footing** (PILOT) | Primary |
| WS-06 | Climate Change Act 2008 + the 2019 target order | SI for target, primary for framework |
| WS-07 | Arm's-length body estate (~444 quangos) | Mixed; Public Bodies Act 2011 for a subset |
| WS-08 | Judicial review restriction | Primary |
| WS-09 | Patronage restoration — judicial, KC, Regius appointments | Primary |
| WS-10 | Removal from office and public-employment disqualification | Primary + resolutions of both Houses |
| WS-11 | Non-crime hate incidents; College of Policing guidance; Sentencing Council powers | Primary or SI |
| WS-12 | Regulation of religio-political movements (see §6) | Analysis only this phase |

Two cross-cutting workstreams run after all twelve report — see §7.

---

## 4. Standard output schema

Each agent returns `WS-NN.json` plus `WS-NN.md`. The JSON is the machine-readable spine; the markdown
is the human report. Fields:

```
{
  "ws_id": "WS-05",
  "target": { "act": "", "provisions": [], "legislation_uri": "" },
  "proposer_statement": {
    "what_is_asked": "",
    "source_quotes": [ { "text": "", "source": "", "locator": "" } ],
    "stated_rationale": "",
    "what_the_proposer_does_not_say": []
  },
  "what_the_law_currently_does": { "summary": "", "citations": [] },
  "inbound_references": {
    "count": 0,
    "source": "crag_part1_inbound.json | citation_edge query",
    "classified": [
      { "source_provision": "", "citation_text": "",
        "disposition": "repeal | amend | save | replace | no_action",
        "reason": "", "confidence": "high|medium|low" }
    ],
    "unclassified_count": 0
  },
  "gates": {
    "devolution":      { "engaged": true, "detail": "", "citations": [], "sewel_consent_required": true },
    "international":   { "engaged": true, "treaties": [], "detail": "", "citations": [] },
    "northern_ireland":{ "engaged": true, "detail": "", "citations": [] },
    "common_law_absorption": { "engaged": true, "cases": [], "detail": "" },
    "retained_eu_law": { "engaged": false, "detail": "" }
  },
  "case_law": [ { "citation": "", "relevance": "", "holding": "" } ],
  "parliamentary_history": { "passage_debates": [], "committee_reports": [] },
  "opposition_map": [
    { "actor": "", "type": "institution|party|profession|devolved|external",
      "predicted_position": "", "instrument_of_opposition": "",
      "evidence_for_prediction": [] }
  ],
  "counterparty_response": [
    { "counterparty": "",
      "trigger": "",
      "mechanism": "treaty_dispute|rebalancing|suspension|termination|tariff|diplomatic|domestic_political",
      "authority": { "instrument": "", "article": "", "text": "" },
      "precedent": [],
      "basis": "clause | documented_precedent | speculation",
      "notice_period": "",
      "reciprocal_exposure": "" }
  ],
  "difficulty": {
    "score": 1,
    "scale_note": "1 = routine repeal, 5 = requires constitutional confrontation",
    "drivers": []
  },
  "second_order_proposals": [ { "title": "", "why_it_arises": "" } ],
  "open_questions_for_proposer": [],
  "gaps": [ { "question": "", "searches_attempted": [], "why_unresolved": "" } ]
}
```

### Field notes

- **`what_the_proposer_does_not_say`** is doing real work. The value we add is not summarising the
  thesis — anyone can do that — but enumerating the collision surface its author has not addressed.
- **`disposition` on every inbound reference.** This is the bulk of the labour and the bulk of the
  value. Unclassified rows are counted, not hidden.
- **`difficulty.score` must have `drivers`.** A bare number is an inference travelling as a
  measurement. The drivers are the measurement.
- **`opposition_map` requires `evidence_for_prediction`.** "The Law Society would object" is a guess;
  "the Law Society objected to X in these terms in this consultation response" is a finding.
- **`counterparty_response` covers external states and bodies, not domestic opponents.** Where a
  measure touches a treaty, the other parties have legal routes to respond and those routes are
  written down. "The EU may retaliate over the Windsor Framework" is speculation; "Withdrawal
  Agreement Article 178 permits an arbitration panel to authorise suspension of obligations, and the
  TCA rebalancing mechanism permits X on Y days' notice" is a finding with a clause behind it.
  `basis` must be set honestly — an entry marked `speculation` is allowed, but it must be marked, and
  it must not be presented alongside clause-backed entries as though it carried the same weight.
  `reciprocal_exposure` records what *we* could do in return, which is usually absent from advocacy
  on both sides and is what makes the assessment balanced rather than alarmed.
- **`second_order_proposals`** is how the programme grows. Each is a candidate Scrutinise proposal in
  its own right. Expect 5–15 per workstream.

---

## 5. The four gates — what each agent must check

Every workstream runs all four, even where the answer is "not engaged". A recorded negative is worth
more than a silence.

**Devolution gate.** Scotland Act 1998 s.29(2)(d), Government of Wales Act 2006 s.108A(2)(e),
Northern Ireland Act 1998 s.6(2)(c) each make Convention-incompatible devolved legislation *not law*.
Repealing the Human Rights Act does not touch them. Does this measure require amending a devolution
statute? If so, Sewel consent is engaged, and refusal is the working assumption.

**International gate.** Beyond the ECHR: the 1951 Refugee Convention, UNCAT, ICCPR, UNCRC, and the
UK–EU Trade and Cooperation Agreement Part Three, whose law-enforcement co-operation provisions are
tied to continued ECHR adherence. Several outcomes attributed to the ECHR in the source material in
fact rest on these instruments — check before accepting the attribution.

**Northern Ireland gate.** Separate from devolution because the obligation is bilateral treaty, not
domestic settlement. The live expert disagreement is already in print and must be represented fairly
from all three sides: Prosperity Institute (Braverman/Dampier — the Agreement can be amended);
Policy Exchange (Casey/Ekins/Laws — withdrawal is possible while preserving NI-specific
restrictions); CAJ (withdrawal breaches the Agreement, and no equivalent arrangement can satisfy it).
Windsor Framework Article 2 is a further non-diminution obligation. Do not adjudicate between them.
Set out each position, its authorities, and what each would need to be true.

**Common-law absorption gate.** This is the proposer's own central mechanism and the most important
research question in the programme. Starkey argues repeal is insufficient because judges have
absorbed Convention principles into the common law, and proposes annulment — declaring the
legislation void from the outset — instead. That claim is testable against actual case law. For each
target: has the principle been restated as common law independently of the statute, and in which
cases? Report what you find, whether or not it supports the thesis.

---

## 6. WS-12 — specific remit

The proposal as stated is to separate religious practice from political manifestation, protect the
first and regulate the second, on the model of the treatment of political Catholicism in the 17th to
19th centuries. It forms part of the thesis and is analysed like every other element.

The agent's task is four things, in order:

1. **Establish what the historical precedent mechanically did.** Corporation Act 1661, Test Act 1673,
   Papists Act 1778, Roman Catholic Relief Act 1829 and the disqualifications they operated. What was
   the legal trigger in each case — belief, oath refusal, office, association, or act? Cite the
   provisions.
2. **Establish how UK law currently regulates political manifestation regardless of belief.** Terrorism
   Act 2000 proscription regime, Charities Act political-purposes rules, Public Order Act 1986 Pt 3,
   Political Parties Elections and Referendums Act 2000 registration and funding rules, National
   Security Act 2023 foreign-influence registration. What is the existing toolkit, and what does it
   already cover?
3. **Test the operability of the separation.** For a measure to regulate the political manifestation
   and not the religion, the regulated class must be definable without reference to religious belief
   or affiliation. Is it? Work the definitional problem: what is the legal subject of the provision —
   an organisation, a doctrine, a course of conduct, a person? Report the answer whether it is
   workable, workable only with conditions, or not workable, and say why with authority.
4. **Map the collision surface** as for any other workstream: ECHR Arts 9, 11 and 14 (engaged now and
   relevant to sequencing, since this measure would follow the HRA repeal), Equality Act religion
   provisions (also a repeal target — note the interaction), ICCPR Art 18, the Northern Ireland
   settlement's own religious-discrimination safeguards (Northern Ireland Act 1998 s.76 and the
   fair employment regime), and the devolution gate.

Deliver findings as findings. If step 3 concludes the separation cannot be operated in modern
drafting, that is the scrutiny result and it should be stated plainly with its reasoning. If it
concludes it can be operated under stated conditions, state the conditions with the same rigour.
This workstream produces no draft text.

---

## 7. Cross-cutting workstreams — run after all twelve report

**XW-A — Interlock layer.** Build the dependency graph between workstreams: which measures depend on
which others, which conflict, which are self-defeating in isolation. Output a directed graph with an
edge type on each link (`requires`, `blocks`, `duplicates`, `weakens`) and evidence for each edge.
This is where the thesis stands or falls: its author's core claim is that the measures interlock and
must move together. That claim is now testable.

**XW-B — Sequencing and instrument allocation.** For each measure, the instrument (Act / SI /
prerogative / resolution / treaty act), and the ordering constraints the interlock graph imposes.
Note where sequencing is forced rather than chosen. The proposer's stated position is that everything
must move at once; the graph will either support that or not.

---

## 8. Adversarial rounds

After a workstream returns, run it through role-assigned rounds. Use a different model provider for
the red team than for the constructor — same-family models share failure modes and miss the same
things.

| Round | Role | Prompt shape |
|---|---|---|
| 1 | Constructor | Produce the collision map to schema |
| 2 | Claimant counsel | "Identify every ground on which this measure could be challenged in court, with authority" |
| 3 | Parliamentary Counsel | "Find every drafting defect this map implies: undefined terms, missing transitional provisions, unrepealed cross-references, commencement gaps" |
| 4 | Devolution and treaty specialist | "List every devolved competence and international obligation engaged, with citation" |
| 5 | Constructor | Repair |
| 6 | Rounds 2–4 re-run on repaired output | Convergence check |

**Record a numeric prediction before each round** — e.g. "expect Round 2 to return ≥8 challenge
grounds, of which ≥3 devolution-based". A round returning materially fewer than predicted is evidence
the prompt is weak, not that the map is strong.

**Stop condition:** a re-run round produces no new items. If it never converges, that non-convergence
is itself a finding and goes in the report.

---

## 9. Playbook capture (running deliverable)

Because we are building bespoke rather than as a platform feature, the reusable asset is the
playbook. Every agent appends to `PROGRAMME_PLAYBOOK.md` as it works:

- Which schema fields were unused, and which were needed but absent.
- Which corpus queries worked and which returned nothing useful.
- Where the agent had to leave the corpus for the web, and why.
- Any step a human had to do that a tool should have done.

This file is the input to the eventual decision on whether to build a Programme object, and what it
would need to contain. It is worth more than any single workstream's output.

---

## 10. Reporting to Charlie

Per workstream, one page, in this order: what the measure is in ordinary words; what it collides
with; how hard that makes it and why; what the proposer would have to decide; what we could not
establish and why. No jargon undefined on first use. Numbers stated with their units and denominator.
