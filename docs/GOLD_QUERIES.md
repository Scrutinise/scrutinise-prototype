# GOLD QUERY SET v1 — Search Project

*Drafted 12 Jun 2026 (CCh). Status: UNTESTED HYPOTHESES throughout — query realism rests
on persona hypotheses H1/H2 (below), and every "expected sources" line is CCh's best guess
awaiting Charlie's correction. A gold set with unverified expected answers measures nothing:
validation (step 1 below) is part of the artefact, not optional polish.*

---

## Purpose

This set is the fixed yardstick for every retrieval decision in the search project: engine
bake-offs (Neon+pg_search vs LanceDB-on-R2), embedding model choice (voyage-law-2 vs
general flagship), reranker on/off, archetype-layer boosts, enrichment value. Nothing gets
adopted because it sounds good; it gets adopted because it moves these numbers.

## Personas (hypotheses)

- **H1** — MP / parliamentary researcher, experienced with Private Members' Bills. Precise
  vocabulary, wants exhaustiveness and citations, low tolerance for wrong answers.
- **H2** — capable, educated member of the public with a serious policy idea and no
  knowledge of legislative process or statutory vocabulary. Plain-language queries; the
  vocabulary bridge must do the work.

## Scoring protocol

1. **Validate** (Charlie, ~2–3 hrs): for each query, correct/extend the expected-sources
   list. A source is "expected" if a competent parliamentary researcher would consider the
   answer incomplete without it. 2–8 expected sources per query is the target.
2. **Retrieval metric — recall@20**: of the expected sources, what fraction appears in the
   top 20 results handed to Lex? This is the primary number. Lex can rescue a mediocre
   ordering; it cannot cite what was never retrieved. Secondary: MRR (mean reciprocal
   rank — 1/rank of the first relevant result, rewards putting a right answer at the top).
3. **Answer metric** (later, once synthesis is wired): side-by-side judgment of Lex's
   answers per query — correct / complete / cited / would-impress (the "how did you find
   that?" test). Rubric to be written with the design doc.
4. **Versioning**: this file is append-only per version. Queries are never silently edited
   once scoring has begun (that would make scores incomparable across runs). Corrections
   before first scoring run = v1 edits; after = v2 additions.

## Corpus-dependency flags

- `[BILLS]` — needs the Bills corpus. LANDED 17 Jun (bills-api, 6,535 sections), so these
  queries now score for real, not as deliberate failures. The flag is retained only to
  mark which queries depend on that corpus.
- `[INFORCE]` — needs commencement/in-force metadata (TNA changes data; not yet extracted).
- `[GRAPH]` — needs the citation/amendment edge table (planned, not built).
- Unflagged queries are answerable from corpus already in R2.

---

## Archetype A — Known-item / citation lookup
*Tests: citation parser, direct lookup path, current-as-amended awareness. Should be
near-instant and exact; any miss here is a severe failure.*

**A1 (H1)** — "Section 21 Housing Act 1988"
Expected: HA 1988 s.21 text as amended; flag of its prospective abolition (Renters' Rights
Act 2025) and current in-force status. `[INFORCE]` for the flag; bare text unflagged.

**A2 (H2)** — "What does section 1 of the Theft Act 1968 actually say?"
Expected: s.1 TA 1968; ss.2–6 (the definitions of dishonesty, appropriation etc.) offered
as context.

**A3 (H1)** — "Working Time Regulations 1998"
Expected: SI 1998/1833, key provisions (reg 4 48-hour week, regs 13–13A leave), amendment
status post-Employment Rights/retained-EU changes.

**A4 (H1)** — "Equality Act 2010 section 149"
Expected: s.149 (public sector equality duty), Sch 18 exceptions, the commencement SI
bringing it into force.

**A5 (H2)** — "Find me the law that says you have to wear a seatbelt"
Expected: Road Traffic Act 1988 ss.14–15; Motor Vehicles (Wearing of Seat Belts)
Regulations 1993. Deliberately bridges A and B: a known item described, not cited.

## Archetype B — Concept search (vocabulary bridge)
*Tests: embeddings + query rewriting. The user's words appear nowhere in the statute.*

**B1 (H2)** — "Can my landlord kick me out without giving a reason?"
Expected: HA 1988 s.21 and s.8/Sch 2; Renters' Rights Act 2025 abolition provisions;
Deregulation Act 2015 ss.33–41 (retaliatory eviction limits).

**B2 (H2)** — "I want to stop people renting out whole houses as Airbnbs all year round"
Expected: Levelling-up and Regeneration Act 2023 short-term lets provisions (registration
scheme, planning use class change powers); Town and Country Planning (Use Classes) Order;
the Greater London 90-night rule (Deregulation Act 2015 s.44).

**B3 (H2)** — "Is it illegal to take a photo of someone in public without their permission?"
Expected: an honest "no general prohibition" answer grounded in: Sexual Offences Act 2003
ss.67–67A (voyeurism/upskirting); Protection from Harassment Act 1997; UK GDPR/DPA 2018
boundaries. Tests whether the system can retrieve the *adjacent* law when no on-point
statute exists, rather than hallucinating one.

**B4 (H1)** — "Statutory duty of candour — who does it bind and where is it heading?"
Expected: Health and Social Care Act 2008 (Regulated Activities) Regulations 2014 reg 20;
current Public Office (Accountability) Bill ("Hillsborough Law") material `[BILLS]` and
related debates.

**B5 (H2)** — "What are the rules about how much noise my neighbours can make at night?"
Expected: Environmental Protection Act 1990 Part III (statutory nuisance); Noise Act 1996;
Control of Pollution Act 1974 s.60 (construction).

## Archetype C — Policy-area sweep
*Tests: recall breadth, multi-query decomposition, corpus coverage of guidance + SIs.*

**C1 (H1)** — "Everything currently regulating short-term holiday lets in England"
Expected: union of B2's sources plus tax treatment (FHL abolition, Finance Act 2025?),
council tax/business rates SIs, fire safety guidance. Sweep completeness is the score.

**C2 (H2)** — "What laws govern e-scooters?"
Expected: RTA 1988 (motor vehicle classification); Electrically Assisted Pedal Cycles
Regulations 1983 (why e-scooters fall outside them); the e-scooter trial SIs (2020–);
relevant written answers on legalisation timetable.

**C3 (H1)** — "The statutory framework for adult social care funding in England"
Expected: Care Act 2014 Part 1 (ss.14–17 charging, s.18 duty to meet needs); Care and
Support (Charging and Assessment of Resources) Regulations 2014; the postponed cap
provisions and their commencement history `[INFORCE]`.

**C4 (H1)** — "What duties do water companies have about sewage discharges, and where do
they come from?"
Expected: Water Industry Act 1991 (s.94 etc.); Environment Act 2021 ss.141A–141 (storm
overflow duties, monitoring); Urban Waste Water Treatment Regulations 1994 (retained EU);
Environment Agency enforcement powers.

**C5 (H2)** — "What protections do people who live in park homes / mobile homes have?"
Expected: Mobile Homes Act 1983; Mobile Homes Act 2013 (site licensing, pitch-fee rules);
Caravan Sites Act 1968. Deliberately niche — tests long-tail coverage.

## Archetype D — Graph (amendments, powers, applications)
*Tests: citation-edge table + in-force metadata. Text search alone cannot answer these.*

**D1 (H1)** — "What has amended section 21 of the Housing Act 1988 since 2015?" `[GRAPH]`
Expected: Deregulation Act 2015 ss.33–41; subsequent form-prescribing SIs; Renters' Rights
Act 2025 (prospective repeal).

**D2 (H1)** — "List the statutory instruments made under the Building Safety Act 2022"
`[GRAPH]`
Expected: the made-under edge set — Higher-Risk Buildings regs, leaseholder protection
regs, commencement orders. Completeness scored against TNA's enabling-power data.

**D3 (H1)** — "Which provisions of the Environment Act 2021 are not yet in force?"
`[GRAPH]` `[INFORCE]`
Expected: accurate not-yet-commenced list as at query date. The flagship in-force-awareness
test.

**D4 (H2)** — "Has the Dangerous Dogs Act 1991 been changed since it was passed — what
changed and why?" `[GRAPH]`
Expected: 1997 Amendment Act; ABCPA 2014 s.106 (private-property extension, sentencing);
Dangerous Dogs (Designated Types) Order 2023 (XL Bully) made under s.1; intent material
from the 2023 statements (crosses into E deliberately).

**D5 (H1)** — "What case law has considered 'philosophical belief' under section 10 of the
Equality Act 2010?" `[GRAPH]`
Expected: Grainger plc v Nicholson (the criteria); Forstater v CGD Europe; subsequent EAT
applications in tna-caselaw. Tests the case→section edge direction.

## Archetype E — Legislative intent (Hansard)
*Tests: the parliamentary tier + section↔debate linkage (the Pepper v Hart feature).
Justifies Hansard-from-day-one.*

**E1 (H1)** — "What did ministers say the under-occupancy provisions of the Welfare Reform
Act 2012 were intended to achieve?"
Expected: Commons/Lords second reading and committee passages from Hansard 2011–12
(Freud/Grayling statements); the relevant impact assessment if ingested.

**E2 (H2)** — "Why was the sugar tax designed as a levy on manufacturers instead of a tax
at the till?"
Expected: Finance Act 2017 Part 2 (Soft Drinks Industry Levy); Budget 2016 and Finance
Bill 2017 debate passages explaining the reformulation-incentive design.

**E3 (H1)** — "What assurances were given during the passage of the Investigatory Powers
Act 2016 about safeguards on bulk powers?"
Expected: committee/report stage Hansard passages (double-lock, IPC oversight); the Act's
Parts 6–7.

**E4 (H2)** — "Why does the indoor smoking ban not apply to private homes? What was said
when it was passed?"
Expected: Health Act 2006 Part 1; 2005–06 debate passages on scope, the free-vote context,
and exemptions reasoning.

**E5 (H1)** — "When the Hunting Act 2004 was passed, what did ministers say about how it
would be enforced?"
Expected: Hansard passages on enforcement/policing from 2003–04 stages (incl. Parliament
Acts context); Act ss.1–6.

## Archetype F — Precedent / prior attempts
*Tests: the prior-attempts detector — the core "how did you find that?" feature. The Bills
corpus landed 17 Jun, so these now score for real (no longer deliberate failures).*

**F1 (H2)** — "Has anyone tried to ban single-use plastics completely? What happened?"
`[BILLS]`
Expected: Plastics (Wet Wipes) Bill and similar PMBs; the route actually taken instead
(EPA 1990 s.140 SIs — straws/stirrers 2020, plates/cutlery 2023); debate passages on why
piecemeal SIs over a general ban.

**F2 (H1)** — "Previous Private Members' Bills attempting to restrict fireworks sales, and
why they failed" `[BILLS]`
Expected: the repeated Fireworks Bills (multiple sessions, 2010s–20s); Fireworks Act 2003
as the partial success; petitions-committee debates; ministerial objections on enforcement
grounds.

**F3 (H2)** — "I want a law making landlords accept tenants with pets. Has this been
tried?" `[BILLS]`
Expected: Dogs and Domestic Animals (Accommodation and Protection) Bill (Rosindell);
Renters (Reform) Bill 2023 pet provisions and that Bill's fall; Renters' Rights Act 2025
outcome. The model arc: failed PMB → absorbed into government bill → enacted.

**F4 (H1)** — "Attempts since 2010 to introduce proportional representation for Westminster
elections" `[BILLS]`
Expected: ten-minute-rule and PMB attempts; the 2011 AV referendum legislation
(Parliamentary Voting System and Constituencies Act 2011) as context; relevant divisions.

**F5 (H2)** — "Has Parliament ever tried to make first aid training compulsory in schools?"
`[BILLS]`
Expected: Emergency First Aid Education Bill 2015 (talked out — the debate is the gold
nugget); subsequent success by another route (statutory RSHE from 2020 under Children and
Social Work Act 2017 s.34). The exemplar "your idea was tried, failed in form X, succeeded
in form Y" answer.

---

## Coverage notes (v1 gaps, deliberate)

- Devolved-jurisdiction queries are thin (one Scots/Welsh/NI sweep should join in v2 once
  regional corpus passes its V19 audit).
- No tax-manual or FCA-handbook archetype yet — add when those corpora are quality-checked.
- No cross-jurisdiction comparison queries — V3+ (international expansion).
- Telemetry replaces guesswork: once real users exist, their actual queries feed v2/v3 and
  the persona hypotheses get tested against reality.
