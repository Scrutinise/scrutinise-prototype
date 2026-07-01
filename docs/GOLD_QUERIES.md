# GOLD QUERY SET v2 — Search Project

*Revised 2026-06-30 (CCh). Builds on v1 (12 Jun) — every v1 query is retained; v2 adds the* **stream map** *(§A), a* **second metric** *for principle streams (§B), three new archetypes for the principle streams (G–I), two new caller archetypes (J–K), and the validated "Revoke MiFID II" query (B6).*

>   **Status: provisional throughout.** Expected-sources are CCh's best guess; principle success- criteria are deliberately left to be set **by example** (see §B). A gold set with unverified answers measures nothing — validation is part of the artefact, not polish. See §C for the *tractable* validation method (review a generated answer-key; don't hand-write 30 lists).

***

## Purpose

The fixed yardstick for every retrieval decision: engine choice, embedding-model bake-off, reranker on/off, boosts, stage-3 expansion on/off, graph layers. Nothing is adopted because it sounds good; it is adopted because it moves these numbers.

## Personas (hypotheses)

-   **H1** — MP / parliamentary researcher. Precise vocabulary, wants exhaustiveness + citations, low tolerance for wrong answers.
-   **H2** — capable member of the public with a serious idea and no statutory vocabulary. Plain language; the vocabulary bridge must do the work.

***

## §A. Stream map — what each archetype tests, and how it is scored

Search is now specialised by stream (SEARCH_STRATEGY.md §3). Each archetype targets a stream and is scored by that stream's metric. The load-bearing split is **specific-retrieval** (want the exact item → recall@20) vs **principle-retrieval** (want a transferable lesson → 0–2 judgement).

| Archetype                              | Stream(s)                      | Kind           | Metric                | Stage-3 / vector target?  |
|----------------------------------------|--------------------------------|----------------|-----------------------|---------------------------|
| A — citation lookup                    | legislation                    | specific       | recall@20 + exact-pin | no (citation resolver)    |
| B — concept / vocabulary bridge        | legislation                    | specific       | recall@20             | **YES — the core target** |
| C — policy-area sweep                  | legislation + guidance         | specific       | recall@20 (breadth)   | partial                   |
| D — graph (amendments/powers/in-force) | citation graph                 | specific+graph | recall@20             | no (graph layer)          |
| E — legislative intent (Hansard)       | debates                        | specific       | recall@20             | partial (vector helps)    |
| F — precedent / prior attempts         | bills + debates                | specific       | recall@20             | partial                   |
| **G — implementation pattern**         | **codes / guidance**           | **principle**  | **0–2 lesson**        | YES (failure-mode vocab)  |
| **H — institutional behaviour**        | **investigations / inquiries** | **principle**  | **0–2 lesson**        | YES (failure-mode vocab)  |
| **I — evaluation / what works**        | **parliamentary evaluations**  | **principle**  | **0–2 lesson**        | YES (failure-mode vocab)  |
| J — comparative / foreign law          | web + foreign corpus           | specific       | recall@20             | deferred                  |
| K — precise amendable section          | legislation (section-level)    | specific       | exact-pin             | no (citation + graph)     |

## §B. The two metrics

1.  **recall@20** (specific streams). Of the validated expected sources, what fraction appears in the top 20 handed to Lex. Secondary: **MRR** (1/rank of first relevant result). For A and K also record **exact-pin**: did the precise cited/target section land at rank 1.
2.  **0–2 transferable-lesson judgement** (principle streams G–I). recall@20 does **not** apply — "good" is not a document ID but whether a *relevant, transferable* lesson surfaced. Per query:
    -   **0** — nothing relevant, or only off-topic noise.
    -   **1** — topical hits only (it found documents *about the subject* but no transferable lesson).
    -   **2** — a genuine transferable lesson surfaced (a pattern usable even though it came from a different domain — the actual aim of these streams). Scored by a human rater (Charlie) or an LLM-as-judge against the rubric. **The rubric is set by example (§C), not in the abstract.**

## §C. Scoring protocol — and the *tractable* way to validate

1.  **Build an independent answer-key, then score against it.** The expected-sources list is the answer-key. It must be generated **independently of our own search** (otherwise we grade our search against its own output — circular). The MiFID query (B6) is the model: Charlie's external Google comparison produced the targets, independent of our FTS.
2.  **Validation = review, not generate.** CCh (or a strong LLM + web) drafts the candidate expected-sources per query; Charlie **reviews and corrects** — applying real scrutiny in domains he knows, sanity-checking the web-sourced key elsewhere. Reviewing a proposed key is far more tractable than hand-writing 30 lists from memory. CC can additionally dump *what our current search returns* per query, so the key and our output sit side by side.
3.  **Principle criteria are set by example.** For G–I, Charlie cannot define "good" in the abstract — he sees a real result and critiques it ("transferable lesson" vs "topical only"), and those critiques *become* the 0/1/2 rubric. This is correctly **deferred** until a principle-stream result exists to react to (the principle retrieval is not built yet).
4.  **Versioning.** Append-only per version. Queries are not silently edited once scoring on a version has begun (that breaks comparability). Corrections before first scoring = v2 edits.

## Corpus-dependency flags

-   `[BILLS]` landed 17 Jun. `[INFORCE]` needs commencement metadata (TNA changes; not extracted).
-   `[GRAPH]` needs the citation/amendment edge table (planned). `[MECHANISM]` needs the mechanism graph (SEARCH_STRATEGY §9, later).
-   `[PRINCIPLE-STREAM]` — G–I assume the principle corpora (codes/guidance, inquiries, evaluations) are ingested **and** the principle-retrieval method exists. Until then these score as deliberate failures (and can't yet be rubric-calibrated).
-   `[FOREIGN]` — J needs foreign-law corpus / web orientation.

***

## Archetype A — Known-item / citation lookup · *legislation · recall@20 + exact-pin*

-   **A1 (H1)** "Section 21 Housing Act 1988" → HA 1988 s.21 as amended; prospective abolition (Renters' Rights Act 2025); in-force status. `[INFORCE]` for the flag.
-   **A2 (H2)** "What does section 1 of the Theft Act 1968 actually say?" → s.1 TA 1968; ss.2–6 as context.
-   **A3 (H1)** "Working Time Regulations 1998" → SI 1998/1833; reg 4, regs 13–13A; amendment status.
-   **A4 (H1)** "Equality Act 2010 section 149" → s.149 PSED; Sch 18; commencement SI.
-   **A5 (H2)** "Find me the law that says you have to wear a seatbelt" → RTA 1988 ss.14–15; Seat Belts Regs 1993. (Bridges A↔B: a known item described, not cited.)

## Archetype B — Concept search (vocabulary bridge) · *legislation · recall@20 ·* **stage-3/vector core target**

*The user's words appear nowhere in the statute. This is the archetype stage 3 and the vector layer exist to fix.*

-   **B1 (H2)** "Can my landlord kick me out without giving a reason?" → HA 1988 s.21, s.8/Sch 2; Renters' Rights Act 2025; Deregulation Act 2015 ss.33–41.
-   **B2 (H2)** "I want to stop people renting out whole houses as Airbnbs all year round" → Levelling-up and Regeneration Act 2023 short-let provisions; Use Classes Order; London 90-night rule (Deregulation Act 2015 s.44).
-   **B3 (H2)** "Is it illegal to take a photo of someone in public without their permission?" → honest "no general prohibition": SOA 2003 ss.67–67A; PfHA 1997; UK GDPR/DPA 2018. (Tests retrieving *adjacent* law rather than hallucinating an on-point statute.)
-   **B4 (H1)** "Statutory duty of candour — who does it bind and where is it heading?" → HSCA 2008 (Regulated Activities) Regs 2014 reg 20; Public Office (Accountability) Bill `[BILLS]` + debates.
-   **B5 (H2)** "Rules about how much noise my neighbours can make at night?" → EPA 1990 Part III; Noise Act 1996; Control of Pollution Act 1974 s.60.
-   **B6 (H2)** "I want to revoke MiFID II" → **FCA Handbook COBS & SYSC; FSMA 2023 (post-Brexit framework); retained MiFIR / MiFID Org Reg; post-Brexit onshoring SIs.** *(VALIDATED via external Google comparison — the canonical lay-vocabulary test for stage 3.)*

## Archetype C — Policy-area sweep · *legislation + guidance · recall@20 (breadth)*

-   **C1 (H1)** "Everything currently regulating short-term holiday lets in England" → B2's set + tax treatment (FHL abolition) + council-tax/rates SIs + fire-safety guidance.
-   **C2 (H2)** "What laws govern e-scooters?" → RTA 1988; EAPC Regs 1983; e-scooter trial SIs; written answers on legalisation timetable.
-   **C3 (H1)** "Statutory framework for adult social care funding in England" → Care Act 2014 Part 1; Charging & Assessment Regs 2014; postponed cap provisions `[INFORCE]`.
-   **C4 (H1)** "Duties of water companies on sewage discharges, and where they come from" → Water Industry Act 1991; Environment Act 2021 ss.141A–; UWWT Regs 1994; EA enforcement powers.
-   **C5 (H2)** "Protections for people who live in park homes / mobile homes" → Mobile Homes Acts 1983 & 2013; Caravan Sites Act 1968. (Long-tail coverage.)

## Archetype D — Graph (amendments, powers, applications) · *citation graph · recall@20* `[GRAPH]`

-   **D1 (H1)** "What has amended section 21 of the Housing Act 1988 since 2015?" → Deregulation Act 2015 ss.33–41; form-prescribing SIs; Renters' Rights Act 2025.
-   **D2 (H1)** "List the statutory instruments made under the Building Safety Act 2022" → the made-under set; scored vs TNA enabling-power data.
-   **D3 (H1)** "Which provisions of the Environment Act 2021 are not yet in force?" `[INFORCE]` → accurate not-yet-commenced list. The flagship in-force test.
-   **D4 (H2)** "Has the Dangerous Dogs Act 1991 been changed — what changed and why?" → 1997 Amendment Act; ABCPA 2014 s.106; XL Bully Order 2023 under s.1; 2023 intent material.
-   **D5 (H1)** "Case law on 'philosophical belief' under section 10 of the Equality Act 2010" → Grainger v Nicholson; Forstater v CGD Europe; EAT applications. (case→section edge.)

## Archetype E — Legislative intent (Hansard) · *debates · recall@20*

-   **E1 (H1)** "What did ministers say the under-occupancy provisions of the Welfare Reform Act 2012 were intended to achieve?" → Commons/Lords 2nd-reading + committee 2011–12; IA if ingested.
-   **E2 (H2)** "Why was the sugar tax a levy on manufacturers, not a tax at the till?" → Finance Act 2017 Part 2; Budget 2016 / Finance Bill 2017 debate on reformulation incentive.
-   **E3 (H1)** "Assurances on safeguards for bulk powers during the Investigatory Powers Act 2016?" → committee/report-stage Hansard (double-lock, IPC); Parts 6–7.
-   **E4 (H2)** "Why does the indoor smoking ban not apply to private homes — what was said?" → Health Act 2006 Part 1; 2005–06 debates on scope/exemptions.
-   **E5 (H1)** "When the Hunting Act 2004 was passed, what did ministers say about enforcement?" → 2003–04 Hansard on enforcement/policing; ss.1–6.

## Archetype F — Precedent / prior attempts · *bills + debates · recall@20* `[BILLS]`

-   **F1 (H2)** "Has anyone tried to ban single-use plastics completely? What happened?" → wet-wipes & similar PMBs; EPA 1990 s.140 SIs (straws 2020, cutlery 2023); debates on piecemeal-vs-ban.
-   **F2 (H1)** "Previous PMBs to restrict fireworks sales, and why they failed" → repeated Fireworks Bills; Fireworks Act 2003; petitions debates; ministerial enforcement objections.
-   **F3 (H2)** "A law making landlords accept tenants with pets — has this been tried?" → Dogs and Domestic Animals Bill (Rosindell); Renters (Reform) Bill 2023 pet clauses; Renters' Rights Act 2025 outcome. (failed PMB → absorbed into gov bill → enacted.)
-   **F4 (H1)** "Attempts since 2010 to introduce PR for Westminster elections" → TMR/PMB attempts; Parliamentary Voting System and Constituencies Act 2011; relevant divisions.
-   **F5 (H2)** "Has Parliament tried to make first aid training compulsory in schools?" → Emergency First Aid Education Bill 2015 (talked out); statutory RSHE 2020 under Children and Social Work Act 2017 s.34. (tried→failed-in-form-X→succeeded-in-form-Y.)

***

## Archetype G — Implementation pattern · *codes / guidance · 0–2 lesson* `[PRINCIPLE-STREAM]`

*How legislation is implemented in practice — transferable even from unrelated law. Score: did a transferable implementation lesson surface (not topical hits). Rubric by example (§C).*

-   **G1 (H1)** "A regulator is handed a new statutory duty with no extra budget — how has that gone before?" → under-resourced-duty patterns drawn from *across domains* (the lesson, not the topic).
-   **G2 (H2)** "If we make companies report something, how do we make sure they actually do it?" → enforcement/compliance patterns from duty-to-report regimes (financial, safeguarding, environmental). `[MECHANISM]`
-   **G3 (H1)** "How is a 'fit and proper person' test typically operated by regulators in practice?" → cross-domain implementation of a recurring mechanism. `[MECHANISM]`

## Archetype H — Institutional behaviour · *investigations / inquiries · 0–2 lesson* `[PRINCIPLE-STREAM]`

*How the civil service and public bodies actually behave — incentives, failure modes. Score: a transferable institutional insight, not a topical match.*

-   **H1 (H1)** "When an arms-length body fails, how do departments typically respond, and how fast?" → patterns across inquiries (e.g. Horizon and others) — the behavioural regularity.
-   **H2 (H2)** "What usually goes wrong when government runs a big IT programme?" → cross-inquiry IT-failure patterns (not one named project).
-   **H3 (H1)** "Where inquiries have examined regulatory capture, what mechanisms recur?" → transferable capture patterns. `[MECHANISM]`

## Archetype I — Evaluation / what works · *parliamentary evaluations · 0–2 lesson* `[PRINCIPLE-STREAM]`

*Where laws succeed and fail — general principles of effective law. Score: a general principle surfaced.*

-   **I1 (H1)** "What distinguishes regulatory-enforcement laws that worked from ones that didn't?" → PAC/NAO/post-legislative-scrutiny patterns.
-   **I2 (H2)** "Do sunset clauses actually work — do laws get reviewed when they're meant to?" → cross-domain evaluation of a *mechanism*. `[MECHANISM]`
-   **I3 (H1)** "When has post-legislative scrutiny found a law had significant unintended consequences, and of what kind?" → transferable unintended-consequence patterns.

***

## Archetype J — Comparative / foreign law · *web + foreign corpus · recall@20* `[FOREIGN]` (deferred)

*Anticipates the Page-3 comparative caller. Deferred until foreign corpus / web orientation.*

-   **J1 (H1)** "How do other countries regulate short-term lets — and what worked?" → comparator regimes (e.g. EU registration models, US city caps); included now only to mark the gap.

## Archetype K — Precise amendable section · *legislation (section-level) · exact-pin*

*The Page-4 coherent-actions caller: given a stated policy change, return the exact provision(s) to amend, with citation.*

-   **K1 (H2)** "I want to remove the no-fault eviction route — which exact provision do I amend?" → HA 1988 s.21 (+ the Renters' Rights Act 2025 repealing provision). Exact-pin on s.21.
-   **K2 (H1)** "To add a statutory duty of candour for public bodies, where would it slot in?" → the candour framework (HSCA 2008 Regs reg 20) + the Public Office (Accountability) Bill as the live vehicle. `[BILLS]`

***

## Coverage notes (v2 gaps, deliberate)

-   **Principle archetypes (G–I) are unscored until** the principle corpora are ingested and the principle-retrieval method exists; their 0–2 rubric is then calibrated by example (§C.3).
-   Devolved-jurisdiction queries still thin — add one Scots/Welsh/NI sweep when regional corpus passes audit.
-   J (comparative) and the mechanism-tagged queries (`[MECHANISM]`) depend on later layers.
-   Telemetry replaces guesswork: once real users + the feedback feature produce observed queries, those feed v3 and test the H1/H2 persona hypotheses against reality.
