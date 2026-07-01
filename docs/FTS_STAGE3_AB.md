# FTS Stage 3 — expansion A/B (recall@20 OFF vs ON)

*Generated 2026-07-01T15:59:47.434Z against the Lance FTS dataset (16509051 rows). For each recall@20 query: `rankedSearch` on the BARE query (OFF) vs the `expandQuery`-enriched keyword set (ON) — the same platform `expandQuery` `fireSearchTrigger` uses (Gemini 2.5 Flash). The concept query is modelled as a single lay keyword. Expansion feeds ONLY the FTS query (grounding guardrail).*

## Headline — archetype B (payoff) and A (flat check)

| archetype | stream | recall@20 OFF | recall@20 ON | delta | n |
|---|---|---|---|---|---|
| B | legislation | 33.3% | 48.6% | **+15.3pp** | 6 |
| A | legislation | 60.0% | 70.0% | **+10.0pp** | 5 |

## All recall@20 archetypes

| archetype | recall@20 OFF | recall@20 ON | delta | n |
|---|---|---|---|---|
| A | 60.0% | 70.0% | +10.0pp | 5 |
| B | 33.3% | 48.6% | +15.3pp | 6 |
| C | 60.0% | 66.7% | +6.7pp | 5 |
| D | 76.7% | 60.0% | -16.7pp | 5 |
| E | 90.0% | 100.0% | +10.0pp | 5 |
| F | 90.0% | 90.0% | 0.0pp | 5 |
| J | 0.0% | 0.0% | 0.0pp | 1 |
| K | 0.0% | 0.0% | 0.0pp | 2 |

## Per-query recall@20 OFF vs ON

| id | arch | OFF | ON | delta | anchors named by expansion |
|---|---|---|---|---|---|
| A1 | A | 100.0% | 50.0% | -50.0pp | Housing Act 1988; Renters (Reform) Bill; Section 21 Housing Act 1988 |
| A2 | A | 50.0% | 50.0% | 0.0pp | Theft Act 1968 |
| A3 | A | 100.0% | 100.0% | 0.0pp | Working Time Regulations 1998; Employment Rights Act 1996; Health and Safety at Work etc. Act 1974 |
| A4 | A | 50.0% | 50.0% | 0.0pp | Equality Act 2010; Equality Act 2010 (Specific Duties) Regulations 2011 |
| A5 | A | 0.0% | 100.0% | +100.0pp | Road Traffic Act 1988; Motor Vehicles (Wearing of Seat Belts) Regulations 1993; Motor Vehicles (Wearing of Seat Belts by Children) Regulations |
| B1 | B | 0.0% | 25.0% | +25.0pp | Housing Act 1988; Protection from Eviction Act 1977; Deregulation Act 2015; Renting Homes (Wales) Act 2016 |
| B2 | B | 33.3% | 66.7% | +33.3pp | Town and Country Planning Act 1990; Levelling Up and Regeneration Act 2023; Housing Act 2004; Planning (Use Classes) Order 1987 |
| B3 | B | 0.0% | 66.7% | +66.7pp | Data Protection Act 2018; UK GDPR; Human Rights Act 1998; Protection from Harassment Act 1997 |
| B4 | B | 100.0% | 50.0% | -50.0pp | Health and Social Care Act 2008; Care Act 2014; NHS Act 2006; Regulated Activities Regulations 2014 |
| B5 | B | 66.7% | 66.7% | 0.0pp | Environmental Protection Act 1990; Noise Act 1996; Local Government Act 1972 |
| C1 | C | 33.3% | 33.3% | 0.0pp | — |
| C2 | C | 66.7% | 66.7% | 0.0pp | — |
| C3 | C | 33.3% | 33.3% | 0.0pp | Care Act 2014; National Assistance Act 1948; Health and Social Care Act 2012 |
| C4 | C | 66.7% | 100.0% | +33.3pp | Water Industry Act 1991; Environment Act 2021; Water Resources Act 1991; Environmental Protection Act 1990; Urban Waste Water Treatment Regulations 1994 |
| C5 | C | 100.0% | 100.0% | 0.0pp | Mobile Homes Act 1983; Caravan Sites and Control of Development Act 1960; Housing Act 2004; Housing and Planning Act 2016; Local Government (Miscellaneous Provisions) Act 1982 |
| D1 | D | 50.0% | 0.0% | -50.0pp | Housing Act 1988; Deregulation Act 2015; Renters (Reform) Bill; Coronavirus Act 2020 |
| D2 | D | 100.0% | 100.0% | 0.0pp | Building Safety Act 2022 |
| D3 | D | 100.0% | 0.0% | -100.0pp | Environment Act 2021 |
| D4 | D | 33.3% | 100.0% | +66.7pp | Dangerous Dogs Act 1991 |
| D5 | D | 100.0% | 100.0% | 0.0pp | Equality Act 2010 |
| E1 | E | 100.0% | 100.0% | 0.0pp | Welfare Reform Act 2012; Housing Benefit Regulations 2006; Housing Benefit (Persons who have attained the qualifying age for state pension credit) Regulations 2006 |
| E2 | E | 100.0% | 100.0% | 0.0pp | Finance Act 2017; Soft Drinks Industry Levy Regulations 2018 |
| E3 | E | 100.0% | 100.0% | 0.0pp | Investigatory Powers Act 2016; Investigatory Powers (Codes of Practice) Regulations; Investigatory Powers Commissioner |
| E4 | E | 50.0% | 100.0% | +50.0pp | Health Act 2006; Smoke-free (Premises and Enforcement) Regulations 2007 |
| E5 | E | 100.0% | 100.0% | 0.0pp | Hunting Act 2004 |
| F1 | F | 100.0% | 100.0% | 0.0pp | Environment Act 2021; Environmental Protection Act 1990; Single Use Plastics (Bans) (England) Regulations 2023; Environmental Permitting (England and Wales) Regulations 2016 |
| F2 | F | 100.0% | 100.0% | 0.0pp | — |
| F3 | F | 100.0% | 100.0% | 0.0pp | Renters (Reform) Bill; Housing Act 1988; Tenant Fees Act 2019; Model Tenancy Agreement |
| F4 | F | 50.0% | 50.0% | 0.0pp | — |
| F5 | F | 100.0% | 100.0% | 0.0pp | Education Act 1996; Education Act 2002; Relationships Education, RSE and Health Education (England) Regulations 2019 |
| B6 | B | 0.0% | 16.7% | +16.7pp | Financial Services and Markets Act 2000; Markets in Financial Instruments Directive; UK MiFID; Investment Firms Regulation; Investment Firms Directive |
| J1 | J | 0.0% | 0.0% | 0.0pp | — |
| K1 | K | 0.0% | 0.0% | 0.0pp | Housing Act 1988; Renters (Reform) Bill; Assured Shorthold Tenancy Notices (Prescribed Information) (England) Regulations 2007 |
| K2 | K | 0.0% | 0.0% | 0.0pp | — |

## Archetype B — per-source OFF vs ON (which sources the expansion pulled in)

### B1 — Can my landlord kick me out without giving a reason?
OFF 0.0% → ON 25.0% (+25.0pp) · anchors: Housing Act 1988; Protection from Eviction Act 1977; Deregulation Act 2015; Renting Homes (Wales) Act 2016

| expected source | OFF | ON |
|---|---|---|
| HA 1988 s.21 | ✗ | ✓ @1 |
| HA 1988 s.8 / Sch 2 | ✗ | ✗ |
| Renters’ Rights Act 2025 | ✗ | ✗ |
| Deregulation Act 2015 ss.33–41 (retaliatory eviction) | ✗ | ✗ |

### B2 — I want to stop people renting out whole houses as Airbnbs all year round
OFF 33.3% → ON 66.7% (+33.3pp) · anchors: Town and Country Planning Act 1990; Levelling Up and Regeneration Act 2023; Housing Act 2004; Planning (Use Classes) Order 1987

| expected source | OFF | ON |
|---|---|---|
| Levelling-up and Regeneration Act 2023 (short-term lets) | ✗ | ✓ @11 |
| Use Classes Order | ✓ @9 | ✓ @1 |
| Deregulation Act 2015 s.44 (London 90-night) | ✗ | ✗ |

### B3 — Is it illegal to take a photo of someone in public without their permission?
OFF 0.0% → ON 66.7% (+66.7pp) · anchors: Data Protection Act 2018; UK GDPR; Human Rights Act 1998; Protection from Harassment Act 1997

| expected source | OFF | ON |
|---|---|---|
| Sexual Offences Act 2003 ss.67–67A (voyeurism) | ✗ | ✗ |
| Protection from Harassment Act 1997 | ✗ | ✓ @16 |
| UK GDPR / DPA 2018 | ✗ | ✓ @1 |

### B4 — Statutory duty of candour — who does it bind and where is it heading?
OFF 100.0% → ON 50.0% (-50.0pp) · anchors: Health and Social Care Act 2008; Care Act 2014; NHS Act 2006; Regulated Activities Regulations 2014

| expected source | OFF | ON |
|---|---|---|
| HSCA 2008 (Regulated Activities) Regs 2014 reg 20 | ✓ @1 | ✓ @1 |
| Public Office (Accountability) Bill / Hillsborough Law [BILLS] | ✓ @9 | ✗ |

### B5 — What are the rules about how much noise my neighbours can make at night?
OFF 66.7% → ON 66.7% (0.0pp) · anchors: Environmental Protection Act 1990; Noise Act 1996; Local Government Act 1972

| expected source | OFF | ON |
|---|---|---|
| EPA 1990 Part III (statutory nuisance) | ✓ @2 | ✓ @13 |
| Noise Act 1996 | ✓ @8 | ✓ @17 |
| Control of Pollution Act 1974 s.60 | ✗ | ✗ |

### B6 — I want to revoke MiFID II
OFF 0.0% → ON 16.7% (+16.7pp) · anchors: Financial Services and Markets Act 2000; Markets in Financial Instruments Directive; UK MiFID; Investment Firms Regulation; Investment Firms Directive

| expected source | OFF | ON |
|---|---|---|
| FSMA 2023 — revocation framework (ukpga/2023/29; s.1+Sch 1, Sch 2 UK MiFID amendments) | ✗ | ✗ |
| FSMA 2000 (Markets in Financial Instruments) Regs 2017 (uksi/2017/701) | ✗ | ✗ |
| Retained/assimilated MiFIR — Reg (EU) 600/2014 (eur/2014/600) | ✗ | ✗ |
| FCA Handbook COBS + SYSC (fca-handbook) | ✗ | ✗ |
| FSMA 2000 — framework Act (ukpga/2000/8) | ✗ | ✗ |
| Post-Brexit onshoring SIs (uksi/2019/1390; uksi/2021/1388) | ✗ | ✓ @9 |
