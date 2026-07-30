# FTS query ROUTER — per-stream routing A/B (recall@20 OFF vs ON)

*Generated 2026-07-30T04:31:44.753Z against the Lance FTS dataset (17700396 rows). For each recall@20 query: `rankedSearch` on the BARE query (OFF) vs `routeQuery`'s per-stream decision dispatched to tier-filtered `rankedSearch` calls, merged and re-sorted by score (ON) — the same `routeQuery`/query-router.ts path search-gateway.ts uses behind `LEX_QUERY_ROUTER` (Gemini 2.5 Flash). Router fail-opens (null/empty decision, 2/34 queries) fall back to the identical OFF result, so those queries show a flat delta by construction, not a router win/loss.*

## Headline — archetype B (payoff, the vocabulary-bridge target) and A (citation queries — expect flat or improved, NOT diluted)

| archetype | stream | recall@20 OFF | recall@20 ON | delta | n |
|---|---|---|---|---|---|
| B | legislation | 33.3% | 48.6% | **+15.3pp** | 6 |
| A | legislation | 60.0% | 70.0% | **+10.0pp** | 5 |

## All recall@20 archetypes

| archetype | recall@20 OFF | recall@20 ON | delta | n |
|---|---|---|---|---|
| A | 60.0% | 70.0% | +10.0pp | 5 |
| B | 33.3% | 48.6% | +15.3pp | 6 |
| C | 60.0% | 46.7% | -13.3pp | 5 |
| D | 76.7% | 90.0% | +13.3pp | 5 |
| E | 90.0% | 90.0% | 0.0pp | 5 |
| F | 90.0% | 90.0% | 0.0pp | 5 |
| J | 0.0% | 0.0% | 0.0pp | 1 |
| K | 0.0% | 0.0% | 0.0pp | 2 |

## Per-query recall@20 OFF vs ON + routing decision

| id | arch | OFF | ON | delta | mode | streams routed |
|---|---|---|---|---|---|---|
| A1 | A | 100.0% | 100.0% | 0.0pp | routed | legislation |
| A2 | A | 50.0% | 50.0% | 0.0pp | routed | legislation |
| A3 | A | 100.0% | 100.0% | 0.0pp | routed | legislation |
| A4 | A | 50.0% | 50.0% | 0.0pp | routed | legislation |
| A5 | A | 0.0% | 50.0% | +50.0pp | routed | legislation |
| B1 | B | 0.0% | 75.0% | +75.0pp | routed | legislation, debates, committees, caselaw, guidance |
| B2 | B | 33.3% | 33.3% | 0.0pp | routed | legislation |
| B3 | B | 0.0% | 33.3% | +33.3pp | routed | legislation, debates, committees, caselaw, guidance |
| B4 | B | 100.0% | 100.0% | 0.0pp | routed | legislation, debates, committees, caselaw, guidance |
| B5 | B | 66.7% | 33.3% | -33.3pp | routed | legislation, debates, committees, caselaw, guidance |
| C1 | C | 33.3% | 0.0% | -33.3pp | routed | legislation |
| C2 | C | 66.7% | 66.7% | 0.0pp | routed | legislation |
| C3 | C | 33.3% | 0.0% | -33.3pp | routed | legislation |
| C4 | C | 66.7% | 66.7% | 0.0pp | fail-open | — |
| C5 | C | 100.0% | 100.0% | 0.0pp | fail-open | — |
| D1 | D | 50.0% | 50.0% | 0.0pp | routed | legislation |
| D2 | D | 100.0% | 100.0% | 0.0pp | routed | legislation |
| D3 | D | 100.0% | 100.0% | 0.0pp | routed | legislation |
| D4 | D | 33.3% | 100.0% | +66.7pp | routed | legislation |
| D5 | D | 100.0% | 100.0% | 0.0pp | routed | caselaw |
| E1 | E | 100.0% | 50.0% | -50.0pp | routed | legislation, debates |
| E2 | E | 100.0% | 100.0% | 0.0pp | routed | legislation, debates, committees, guidance |
| E3 | E | 100.0% | 100.0% | 0.0pp | routed | legislation, debates |
| E4 | E | 50.0% | 100.0% | +50.0pp | routed | legislation, debates |
| E5 | E | 100.0% | 100.0% | 0.0pp | routed | debates, guidance |
| F1 | F | 100.0% | 100.0% | 0.0pp | routed | legislation, debates, committees, guidance |
| F2 | F | 100.0% | 100.0% | 0.0pp | routed | legislation, debates |
| F3 | F | 100.0% | 100.0% | 0.0pp | routed | legislation, debates, committees, caselaw, guidance |
| F4 | F | 50.0% | 50.0% | 0.0pp | routed | legislation, debates |
| F5 | F | 100.0% | 100.0% | 0.0pp | routed | legislation, debates, guidance |
| B6 | B | 0.0% | 16.7% | +16.7pp | routed | legislation |
| J1 | J | 0.0% | 0.0% | 0.0pp | routed | legislation, debates, committees, guidance |
| K1 | K | 0.0% | 0.0% | 0.0pp | routed | legislation |
| K2 | K | 0.0% | 0.0% | 0.0pp | routed | legislation |

## Archetype A — per-source OFF vs ON (citation dilution check)

### A1 — Section 21 Housing Act 1988
OFF 100.0% → ON 100.0% (0.0pp) · mode: routed · streams: legislation

| expected source | OFF | ON |
|---|---|---|
| HA 1988 s.21 text | ✓ @1 | ✓ @1 |
| HA 1988 prospective abolition (Renters’ Rights Act 2025) [INFORCE] | ✓ @3 | ✓ @3 |

### A2 — What does section 1 of the Theft Act 1968 actually say?
OFF 50.0% → ON 50.0% (0.0pp) · mode: routed · streams: legislation

| expected source | OFF | ON |
|---|---|---|
| TA 1968 s.1 | ✓ @1 | ✓ @1 |
| TA 1968 ss.2–6 (dishonesty/appropriation defs) | ✗ | ✗ |

### A3 — Working Time Regulations 1998
OFF 100.0% → ON 100.0% (0.0pp) · mode: routed · streams: legislation

| expected source | OFF | ON |
|---|---|---|
| SI 1998/1833 | ✓ @1 | ✓ @1 |
| reg 4 / regs 13–13A | ✓ @5 | ✓ @5 |

### A4 — Equality Act 2010 section 149
OFF 50.0% → ON 50.0% (0.0pp) · mode: routed · streams: legislation

| expected source | OFF | ON |
|---|---|---|
| EqA 2010 s.149 (PSED) | ✓ @1 | ✓ @1 |
| Sch 18 exceptions | ✗ | ✗ |

### A5 — Find me the law that says you have to wear a seatbelt
OFF 0.0% → ON 50.0% (+50.0pp) · mode: routed · streams: legislation

| expected source | OFF | ON |
|---|---|---|
| RTA 1988 ss.14–15 | ✗ | ✓ @17 |
| Motor Vehicles (Wearing of Seat Belts) Regs 1993 | ✗ | ✗ |

## Archetype B — per-source OFF vs ON (which streams recovered the concept query)

### B1 — Can my landlord kick me out without giving a reason?
OFF 0.0% → ON 75.0% (+75.0pp) · mode: routed · streams: legislation, debates, committees, caselaw, guidance

| expected source | OFF | ON |
|---|---|---|
| HA 1988 s.21 | ✗ | ✓ @1 |
| HA 1988 s.8 / Sch 2 | ✗ | ✗ |
| Renters’ Rights Act 2025 | ✗ | ✓ @12 |
| Deregulation Act 2015 ss.33–41 (retaliatory eviction) | ✗ | ✓ @8 |

### B2 — I want to stop people renting out whole houses as Airbnbs all year round
OFF 33.3% → ON 33.3% (0.0pp) · mode: routed · streams: legislation

| expected source | OFF | ON |
|---|---|---|
| Levelling-up and Regeneration Act 2023 (short-term lets) | ✗ | ✗ |
| Use Classes Order | ✓ @9 | ✓ @7 |
| Deregulation Act 2015 s.44 (London 90-night) | ✗ | ✗ |

### B3 — Is it illegal to take a photo of someone in public without their permission?
OFF 0.0% → ON 33.3% (+33.3pp) · mode: routed · streams: legislation, debates, committees, caselaw, guidance

| expected source | OFF | ON |
|---|---|---|
| Sexual Offences Act 2003 ss.67–67A (voyeurism) | ✗ | ✗ |
| Protection from Harassment Act 1997 | ✗ | ✗ |
| UK GDPR / DPA 2018 | ✗ | ✓ @1 |

### B4 — Statutory duty of candour — who does it bind and where is it heading?
OFF 100.0% → ON 100.0% (0.0pp) · mode: routed · streams: legislation, debates, committees, caselaw, guidance

| expected source | OFF | ON |
|---|---|---|
| HSCA 2008 (Regulated Activities) Regs 2014 reg 20 | ✓ @1 | ✓ @1 |
| Public Office (Accountability) Bill / Hillsborough Law [BILLS] | ✓ @9 | ✓ @20 |

### B5 — What are the rules about how much noise my neighbours can make at night?
OFF 66.7% → ON 33.3% (-33.3pp) · mode: routed · streams: legislation, debates, committees, caselaw, guidance

| expected source | OFF | ON |
|---|---|---|
| EPA 1990 Part III (statutory nuisance) | ✓ @2 | ✓ @13 |
| Noise Act 1996 | ✓ @8 | ✗ |
| Control of Pollution Act 1974 s.60 | ✗ | ✗ |

### B6 — I want to revoke MiFID II
OFF 0.0% → ON 16.7% (+16.7pp) · mode: routed · streams: legislation

| expected source | OFF | ON |
|---|---|---|
| FSMA 2023 — revocation framework (ukpga/2023/29; s.1+Sch 1, Sch 2 UK MiFID amendments) | ✗ | ✗ |
| FSMA 2000 (Markets in Financial Instruments) Regs 2017 (uksi/2017/701) | ✗ | ✗ |
| Retained/assimilated MiFIR — Reg (EU) 600/2014 (eur/2014/600) | ✗ | ✗ |
| FCA Handbook COBS + SYSC (fca-handbook) | ✗ | ✗ |
| FSMA 2000 — framework Act (ukpga/2000/8) | ✗ | ✓ @1 |
| Post-Brexit onshoring SIs (uksi/2019/1390; uksi/2021/1388) | ✗ | ✗ |
