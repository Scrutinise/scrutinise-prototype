# Appendix — who is on the record, per measure

*Generated 2026-09-09 13:06 UTC.*

> ⚠⚠ **This is a candidate list requiring confirmation. It is not a finding, and no part of it should be published as one.**

## How to use it, and why it is shaped this way

Two kinds of row appear below and **they fail in different ways, so they are never mixed**:

- **Assembled** — a recorded division vote, an early day motion tabled, an interest declared, a witness appearance. These are facts about the public record. They can be wrong about *who* (two members of the same name) but not about *whether the act happened*.
- **Extracted** — a model read a passage and concluded it showed a position. **Read by hand against their sources, 44% of these were wrong.** They are not searchable in the product for that reason and they are not published as findings here.

⚠ **The 44% is an interpretation error rate, not a fabrication rate, and the distinction decides how to check it.** Measured across the whole extraction:

| | |
|---|---|
| Rows produced by the extraction | 37,657 |
| …of which record **no position at all** | 21,461 |
| …of which record a position | **16,196** (for 13,240 · against 2,212 · balanced 744) |
| Quotations that round-trip into their own source | **15,937 (98.4%)** |
| Quotations NOT found in their source | 259 |

**So the quotation is nearly always really there; what is unreliable is the claim that it shows the person holding that position.** That is why the second column is the quotation itself rather than a summary of it: the question to ask of each row is not *"is this quote real?"* but *"does this quote show what it is said to show?"*

**Anything that cannot be confirmed from the quotation should be struck out, not softened.**

---

## ⚠⚠ What this run actually shows, before any of the tables are read

| Measure | Target resolved | Kind | Matched on | People with a record | Tabled | Signed |
|---|---|---|---|---|---|---|
| M-01 | European Convention on Human Rights (withdrawal): Ten Minute Rule Motion | division | 3w — "european convention on human" | 254 | — | — |
| M-02 | Consequences of the Equality Act 2010 | edm | 2w — "equality act 2010" | 11 | 1 | 10 |
| M-03 | Supreme Court judgment on religious education in Northern Ireland | edm | 2w — "supreme court" | 3 | 1 | 2 |
| M-04 | ADVERTISING STANDARDS AUTHORITY AND RELIGIOUS LIBERTY | edm | 2w — "advertising standards" | 5 | 1 | 4 |
| M-05 | Judicial review on miscarriages of justice between 1982 and 2016 | edm | 2w — "judicial review" | 10 | 1 | 9 |
| M-06 | Civil Service pensions | edm | 2w — "civil service" | 44 | 1 | 43 |
| M-07 | Independence of the Bank of England | edm | 2w — "independence of the bank" | 2 | 1 | 1 |
| M-08 | Civil Service pensions | edm | 2w — "civil service" | 44 | 1 | 43 |
| M-09 | **none** | — | — | — | — | — |
| M-10 | Maintaining institutional neutrality of publicly funded buildings and spaces | edm | 2w — "publicly funded" | 10 | 1 | 9 |
| M-11 | Sentencing Guidelines (Pre-sentence Reports) Bill | division | 2w — "sentencing guidelines" | 189 | — | — |
| M-12 | **none** | — | — | — | — | — |

**10 of 12 measures return more than one person.** 0 return exactly one and 2 resolve to no target at all.

### What changed since the last run of this register

The previous version of this appendix said, of every measure that returned one name, that *"we hold 60,995 motions and, for each, only the member who tabled it … an EDM target can therefore only ever return one name."* **That is no longer true.** The early day motion signatures have been loaded, and the positions layer now carries them.

| | then | now |
|---|---|---|
| `edm_signature` signals in `position_signal_stored` | 60,995 | **2,062,509** |
| …of which the member who **tabled** the motion | 60,995 | 59,925 |
| …of which a member who **signed** it | 0 | **2,002,584** |

On this run the 8 measure(s) resolving to an early day motion return **121 signatories** between them, against 8 tablers.

⚠ **No EDM-backed measure now returns a single name.** Every one of them returns its signatories as well as its tabler, which is the whole effect of the load.

### ⚠⚠ How thin the mapping is, measured on this run

**9 of 10 resolved targets were matched on two content words or fewer.** A two-word phrase match is not a statement that the measure and the motion are about the same thing.

- **M-02** *Equality Act 2010* → **Consequences of the Equality Act 2010**, on 2 word(s): *"equality act 2010"*
- **M-03** *The United Kingdom Supreme Court* → **Supreme Court judgment on religious education in Northern Ireland**, on 2 word(s): *"supreme court"*
- **M-04** *The arm's-length body estate* → **ADVERTISING STANDARDS AUTHORITY AND RELIGIOUS LIBERTY**, on 2 word(s): *"advertising standards"*
- **M-05** *Judicial review of executive decisions* → **Judicial review on miscarriages of justice between 1982 and 2016**, on 2 word(s): *"judicial review"*
- **M-06** *The permanent, appointed civil service* → **Civil Service pensions**, on 2 word(s): *"civil service"*
- **M-07** *Operational independence of the Bank of England* → **Independence of the Bank of England**, on 2 word(s): *"independence of the bank"*
- **M-08** *Diversity, equity and inclusion practice in the civil service* → **Civil Service pensions**, on 2 word(s): *"civil service"*
- **M-10** *Publicly funded charities campaigning on government policy* → **Maintaining institutional neutrality of publicly funded buildings and spaces**, on 2 word(s): *"publicly funded"*
- **M-11** *The Sentencing Council and sentencing guidelines* → **Sentencing Guidelines (Pre-sentence Reports) Bill**, on 2 word(s): *"sentencing guidelines"*

⚠⚠ **1 target(s) are shared by more than one measure**, which is a phrase match arriving at the same place from different proposals:

- M-06 and M-08 both resolve to **Civil Service pensions** (M-06 on "civil service"; M-08 on "civil service")

**Conclusion: this still cannot be published as a per-measure supporter and opponent register.** What the signature load fixes is the *volume* — an EDM-backed measure now returns the people who signed as well as the one who tabled. What it does not fix is *which motion the measure resolved to*, and that is the defect that decides whether the names underneath mean anything. **Check the target line before reading any table below it.**

⚠ And a signature is not agreement. A member may sign an early day motion to have it debated, because of one clause in it, or as a courtesy. The assembled fact is that they signed; whether that makes them a supporter of the measure in this report is the judgement this list exists to be worked through, not a conclusion it delivers.

---

## M-01 — Human Rights Act 1998 and the European Convention on Human Rights

Resolved to: **European Convention on Human Rights (withdrawal): Ten Minute Rule Motion** (division).

⚠ **Matched on 3 content word(s): "european convention on human"**, from the proposal's own title. A target resolved on a short phrase may be topically wrong; check the label above before relying on anything beneath it.

254 people have a record against this target.

| Person | Party at the time | What the record shows | On what | Source |
|---|---|---|---|---|
| Brian Leishman ⚠ | Independent | voted in a recorded division, **against** | European Convention on Human Rights (withdrawal): Ten Minute Rule Motion (2025-10-29) | [record](https://votes.parliament.uk/Votes/Commons/Division/2159) |
| Chris Hinchliff ⚠ | Independent | voted in a recorded division, **against** | European Convention on Human Rights (withdrawal): Ten Minute Rule Motion (2025-10-29) | [record](https://votes.parliament.uk/Votes/Commons/Division/2159) |
| Iqbal Mohamed MP ⚠ | Independent | voted in a recorded division, **against** | European Convention on Human Rights (withdrawal): Ten Minute Rule Motion (2025-10-29) | [record](https://votes.parliament.uk/Votes/Commons/Division/2159) |
| Jeremy Corbyn MP ⚠ | Independent | voted in a recorded division, **against** | European Convention on Human Rights (withdrawal): Ten Minute Rule Motion (2025-10-29) | [record](https://votes.parliament.uk/Votes/Commons/Division/2159) |
| Mr Adnan Hussain ⚠ | Independent | voted in a recorded division, **against** | European Convention on Human Rights (withdrawal): Ten Minute Rule Motion (2025-10-29) | [record](https://votes.parliament.uk/Votes/Commons/Division/2159) |
| Mr Rupert Lowe ⚠ | Independent | voted in a recorded division, **for** | European Convention on Human Rights (withdrawal): Ten Minute Rule Motion (2025-10-29) | [record](https://votes.parliament.uk/Votes/Commons/Division/2159) |
| Ms Diane Abbott ⚠ | Independent | voted in a recorded division, **against** | European Convention on Human Rights (withdrawal): Ten Minute Rule Motion (2025-10-29) | [record](https://votes.parliament.uk/Votes/Commons/Division/2159) |
| Ms Rachael Maskell ⚠ | Independent | voted in a recorded division, **against** | European Convention on Human Rights (withdrawal): Ten Minute Rule Motion (2025-10-29) | [record](https://votes.parliament.uk/Votes/Commons/Division/2159) |
| Neil Duncan-Jordan MP ⚠ | Independent | voted in a recorded division, **against** | European Convention on Human Rights (withdrawal): Ten Minute Rule Motion (2025-10-29) | [record](https://votes.parliament.uk/Votes/Commons/Division/2159) |
| Patrick Spencer ⚠ | Independent | voted in a recorded division, **for** | European Convention on Human Rights (withdrawal): Ten Minute Rule Motion (2025-10-29) | [record](https://votes.parliament.uk/Votes/Commons/Division/2159) |
| Shockat Adam ⚠ | Independent | voted in a recorded division, **against** | European Convention on Human Rights (withdrawal): Ten Minute Rule Motion (2025-10-29) | [record](https://votes.parliament.uk/Votes/Commons/Division/2159) |
| Zarah Sultana ⚠ | Independent | voted in a recorded division, **against** | European Convention on Human Rights (withdrawal): Ten Minute Rule Motion (2025-10-29) | [record](https://votes.parliament.uk/Votes/Commons/Division/2159) |
| Abtisam Mohamed ⚠ | Labour | voted in a recorded division, **against** | European Convention on Human Rights (withdrawal): Ten Minute Rule Motion (2025-10-29) | [record](https://votes.parliament.uk/Votes/Commons/Division/2159) |
| Adam Dance ⚠ | Liberal Democrat | voted in a recorded division, **against** | European Convention on Human Rights (withdrawal): Ten Minute Rule Motion (2025-10-29) | [record](https://votes.parliament.uk/Votes/Commons/Division/2159) |
| Adrian Ramsay ⚠ | Green Party | voted in a recorded division, **against** | European Convention on Human Rights (withdrawal): Ten Minute Rule Motion (2025-10-29) | [record](https://votes.parliament.uk/Votes/Commons/Division/2159) |
| Afzal Khan ⚠ | Labour | voted in a recorded division, **against** | European Convention on Human Rights (withdrawal): Ten Minute Rule Motion (2025-10-29) | [record](https://votes.parliament.uk/Votes/Commons/Division/2159) |
| Alan Mak ⚠ | Conservative | voted in a recorded division, **for** | European Convention on Human Rights (withdrawal): Ten Minute Rule Motion (2025-10-29) | [record](https://votes.parliament.uk/Votes/Commons/Division/2159) |
| Alex Brewer ⚠ | Liberal Democrat | voted in a recorded division, **against** | European Convention on Human Rights (withdrawal): Ten Minute Rule Motion (2025-10-29) | [record](https://votes.parliament.uk/Votes/Commons/Division/2159) |
| Alex Burghart ⚠ | Conservative | voted in a recorded division, **for** | European Convention on Human Rights (withdrawal): Ten Minute Rule Motion (2025-10-29) | [record](https://votes.parliament.uk/Votes/Commons/Division/2159) |
| Alex Mayer ⚠ | Labour | voted in a recorded division, **against** | European Convention on Human Rights (withdrawal): Ten Minute Rule Motion (2025-10-29) | [record](https://votes.parliament.uk/Votes/Commons/Division/2159) |
| Alex Sobel ⚠ | Labour | voted in a recorded division, **against** | European Convention on Human Rights (withdrawal): Ten Minute Rule Motion (2025-10-29) | [record](https://votes.parliament.uk/Votes/Commons/Division/2159) |
| Alison Bennett ⚠ | Liberal Democrat | voted in a recorded division, **against** | European Convention on Human Rights (withdrawal): Ten Minute Rule Motion (2025-10-29) | [record](https://votes.parliament.uk/Votes/Commons/Division/2159) |
| Alison Griffiths ⚠ | Conservative | voted in a recorded division, **for** | European Convention on Human Rights (withdrawal): Ten Minute Rule Motion (2025-10-29) | [record](https://votes.parliament.uk/Votes/Commons/Division/2159) |
| Alison Hume ⚠ | Labour | voted in a recorded division, **against** | European Convention on Human Rights (withdrawal): Ten Minute Rule Motion (2025-10-29) | [record](https://votes.parliament.uk/Votes/Commons/Division/2159) |
| Amanda Hack ⚠ | Labour | voted in a recorded division, **against** | European Convention on Human Rights (withdrawal): Ten Minute Rule Motion (2025-10-29) | [record](https://votes.parliament.uk/Votes/Commons/Division/2159) |
| Andrew Bowie MP ⚠ | Conservative | voted in a recorded division, **for** | European Convention on Human Rights (withdrawal): Ten Minute Rule Motion (2025-10-29) | [record](https://votes.parliament.uk/Votes/Commons/Division/2159) |
| Andrew Cooper ⚠ | Labour | voted in a recorded division, **against** | European Convention on Human Rights (withdrawal): Ten Minute Rule Motion (2025-10-29) | [record](https://votes.parliament.uk/Votes/Commons/Division/2159) |
| Andrew George ⚠ | Liberal Democrat | voted in a recorded division, **against** | European Convention on Human Rights (withdrawal): Ten Minute Rule Motion (2025-10-29) | [record](https://votes.parliament.uk/Votes/Commons/Division/2159) |
| Andrew Griffith MP ⚠ | Conservative | voted in a recorded division, **for** | European Convention on Human Rights (withdrawal): Ten Minute Rule Motion (2025-10-29) | [record](https://votes.parliament.uk/Votes/Commons/Division/2159) |
| Andrew Rosindell ⚠ | Conservative | voted in a recorded division, **for** | European Convention on Human Rights (withdrawal): Ten Minute Rule Motion (2025-10-29) | [record](https://votes.parliament.uk/Votes/Commons/Division/2159) |
| Andy Slaughter ⚠ | Labour | voted in a recorded division, **against** | European Convention on Human Rights (withdrawal): Ten Minute Rule Motion (2025-10-29) | [record](https://votes.parliament.uk/Votes/Commons/Division/2159) |
| Ann Davies ⚠ | Plaid Cymru | voted in a recorded division, **against** | European Convention on Human Rights (withdrawal): Ten Minute Rule Motion (2025-10-29) | [record](https://votes.parliament.uk/Votes/Commons/Division/2159) |
| Anna Sabine ⚠ | Liberal Democrat | voted in a recorded division, **against** | European Convention on Human Rights (withdrawal): Ten Minute Rule Motion (2025-10-29) | [record](https://votes.parliament.uk/Votes/Commons/Division/2159) |
| Anneliese Midgley ⚠ | Labour | voted in a recorded division, **against** | European Convention on Human Rights (withdrawal): Ten Minute Rule Motion (2025-10-29) | [record](https://votes.parliament.uk/Votes/Commons/Division/2159) |
| Aphra Brandreth ⚠ | Conservative | voted in a recorded division, **for** | European Convention on Human Rights (withdrawal): Ten Minute Rule Motion (2025-10-29) | [record](https://votes.parliament.uk/Votes/Commons/Division/2159) |
| Apsana Begum ⚠ | Labour | voted in a recorded division, **against** | European Convention on Human Rights (withdrawal): Ten Minute Rule Motion (2025-10-29) | [record](https://votes.parliament.uk/Votes/Commons/Division/2159) |
| Bambos Charalambous ⚠ | Labour | voted in a recorded division, **against** | European Convention on Human Rights (withdrawal): Ten Minute Rule Motion (2025-10-29) | [record](https://votes.parliament.uk/Votes/Commons/Division/2159) |
| Bell Ribeiro-Addy ⚠ | Labour | voted in a recorded division, **against** | European Convention on Human Rights (withdrawal): Ten Minute Rule Motion (2025-10-29) | [record](https://votes.parliament.uk/Votes/Commons/Division/2159) |
| Ben Lake MP ⚠ | Plaid Cymru | voted in a recorded division, **against** | European Convention on Human Rights (withdrawal): Ten Minute Rule Motion (2025-10-29) | [record](https://votes.parliament.uk/Votes/Commons/Division/2159) |
| Ben Maguire ⚠ | Liberal Democrat | voted in a recorded division, **against** | European Convention on Human Rights (withdrawal): Ten Minute Rule Motion (2025-10-29) | [record](https://votes.parliament.uk/Votes/Commons/Division/2159) |

⚠⚠ **Showing 40 of 254.** The other 214 are not absent from the record; they are below the display cap. **Do not read the people below as having no position.**

⚠ **The order is: confidence (descending), then number of contributing signals (descending), then name (A–Z).** 12 actors are tied at the top of this order (confidence 0.394, 1 signal); among those the order is by name. ⚠ 12 of the 254 matched share the top score exactly.

## M-02 — Equality Act 2010

Resolved to: **Consequences of the Equality Act 2010** (edm).

⚠ **Matched on 2 content word(s): "equality act 2010"**, from the proposal's own title. A target resolved on a short phrase may be topically wrong; check the label above before relying on anything beneath it.

11 people have a record against this target.

Of those, **1 tabled** the motion and **10 signed** it.

⚠⚠ **Signing an early day motion is not the same as supporting the proposal in front of you, and it is a judgement rather than a fact.** A member may sign a motion to get it debated, to support one clause of it, or as a courtesy to a colleague, and the record does not distinguish those from agreement. What is assembled here is that they signed; what they meant by it is exactly what the confirmation step is for.

| Person | Party at the time | What the record shows | On what | Source |
|---|---|---|---|---|
| Bob Blackman ⚠ | — | signed an early day motion, **for** | Consequences of the Equality Act 2010 (2025-10-13) | [record](https://edm.parliament.uk/early-day-motion/64141) |
| James McMurdock ⚠ | — | signed an early day motion, **for** | Consequences of the Equality Act 2010 (2025-09-12) | [record](https://edm.parliament.uk/early-day-motion/64141) |
| Jim Allister ⚠ | — | signed an early day motion, **for** | Consequences of the Equality Act 2010 (2025-09-03) | [record](https://edm.parliament.uk/early-day-motion/64141) |
| Jim Shannon ⚠ | — | signed an early day motion, **for** | Consequences of the Equality Act 2010 (2025-09-02) | [record](https://edm.parliament.uk/early-day-motion/64141) |
| Andrew Rosindell ⚠ | — | tabled an early day motion, **for** | Consequences of the Equality Act 2010 (2025-07-22) | [record](https://edm.parliament.uk/early-day-motion/64141) |
| Edward Leigh ⚠ | — | signed an early day motion, **for** | Consequences of the Equality Act 2010 (2025-07-22) | [record](https://edm.parliament.uk/early-day-motion/64141) |
| Jack Rankin ⚠ | — | signed an early day motion, **for** | Consequences of the Equality Act 2010 (2025-07-22) | [record](https://edm.parliament.uk/early-day-motion/64141) |
| Martin Vickers ⚠ | — | signed an early day motion, **for** | Consequences of the Equality Act 2010 (2025-07-22) | [record](https://edm.parliament.uk/early-day-motion/64141) |
| Mr Peter Bedford ⚠ | — | signed an early day motion, **for** | Consequences of the Equality Act 2010 (2025-07-22) | [record](https://edm.parliament.uk/early-day-motion/64141) |
| Mr Rupert Lowe ⚠ | — | signed an early day motion, **for** | Consequences of the Equality Act 2010 (2025-07-22) | [record](https://edm.parliament.uk/early-day-motion/64141) |
| Sir John Hayes ⚠ | — | signed an early day motion, **for** | Consequences of the Equality Act 2010 (2025-07-22) | [record](https://edm.parliament.uk/early-day-motion/64141) |

⚠ **The order is: confidence (descending), then number of contributing signals (descending), then name (A–Z).**

## M-03 — The United Kingdom Supreme Court

Resolved to: **Supreme Court judgment on religious education in Northern Ireland** (edm).

⚠ **Matched on 2 content word(s): "supreme court"**, from the proposal's own title. A target resolved on a short phrase may be topically wrong; check the label above before relying on anything beneath it.

3 people have a record against this target.

Of those, **1 tabled** the motion and **2 signed** it.

⚠⚠ **Signing an early day motion is not the same as supporting the proposal in front of you, and it is a judgement rather than a fact.** A member may sign a motion to get it debated, to support one clause of it, or as a courtesy to a colleague, and the record does not distinguish those from agreement. What is assembled here is that they signed; what they meant by it is exactly what the confirmation step is for.

| Person | Party at the time | What the record shows | On what | Source |
|---|---|---|---|---|
| Bob Blackman ⚠ | — | signed an early day motion, **for** | Supreme Court judgment on religious education in Northern Ireland (2025-12-01) | [record](https://edm.parliament.uk/early-day-motion/64791) |
| Carla Lockhart ⚠ | — | signed an early day motion, **for** | Supreme Court judgment on religious education in Northern Ireland (2025-11-25) | [record](https://edm.parliament.uk/early-day-motion/64791) |
| Mr Gregory Campbell ⚠ | — | tabled an early day motion, **for** | Supreme Court judgment on religious education in Northern Ireland (2025-11-24) | [record](https://edm.parliament.uk/early-day-motion/64791) |

⚠ **The order is: confidence (descending), then number of contributing signals (descending), then name (A–Z).**

## M-04 — The arm's-length body estate

Resolved to: **ADVERTISING STANDARDS AUTHORITY AND RELIGIOUS LIBERTY** (edm).

⚠ **Matched on 2 content word(s): "advertising standards"**, from the body of the proposal. A target resolved on a short phrase may be topically wrong; check the label above before relying on anything beneath it.

5 people have a record against this target.

Of those, **1 tabled** the motion and **4 signed** it.

⚠⚠ **Signing an early day motion is not the same as supporting the proposal in front of you, and it is a judgement rather than a fact.** A member may sign a motion to get it debated, to support one clause of it, or as a courtesy to a colleague, and the record does not distinguish those from agreement. What is assembled here is that they signed; what they meant by it is exactly what the confirmation step is for.

| Person | Party at the time | What the record shows | On what | Source |
|---|---|---|---|---|
| John Pugh ⚠ | — | signed an early day motion, **for** | ADVERTISING STANDARDS AUTHORITY AND RELIGIOUS LIBERTY (2012-06-21) | [record](https://edm.parliament.uk/early-day-motion/44322) |
| Lord Dodds of Duncairn ⚠ | — | signed an early day motion, **for** | ADVERTISING STANDARDS AUTHORITY AND RELIGIOUS LIBERTY (2012-06-20) | [record](https://edm.parliament.uk/early-day-motion/44322) |
| Mr Mike Hancock ⚠ | — | signed an early day motion, **for** | ADVERTISING STANDARDS AUTHORITY AND RELIGIOUS LIBERTY (2012-06-20) | [record](https://edm.parliament.uk/early-day-motion/44322) |
| Jim Dobbin ⚠ | — | signed an early day motion, **for** | ADVERTISING STANDARDS AUTHORITY AND RELIGIOUS LIBERTY (2012-06-13) | [record](https://edm.parliament.uk/early-day-motion/44322) |
| Sir Gary Streeter ⚠ | — | tabled an early day motion, **for** | ADVERTISING STANDARDS AUTHORITY AND RELIGIOUS LIBERTY (2012-06-13) | [record](https://edm.parliament.uk/early-day-motion/44322) |

⚠ **The order is: confidence (descending), then number of contributing signals (descending), then name (A–Z).**

## M-05 — Judicial review of executive decisions

Resolved to: **Judicial review on miscarriages of justice between 1982 and 2016** (edm).

⚠ **Matched on 2 content word(s): "judicial review"**, from the proposal's own title. A target resolved on a short phrase may be topically wrong; check the label above before relying on anything beneath it.

10 people have a record against this target.

Of those, **1 tabled** the motion and **9 signed** it.

⚠⚠ **Signing an early day motion is not the same as supporting the proposal in front of you, and it is a judgement rather than a fact.** A member may sign a motion to get it debated, to support one clause of it, or as a courtesy to a colleague, and the record does not distinguish those from agreement. What is assembled here is that they signed; what they meant by it is exactly what the confirmation step is for.

| Person | Party at the time | What the record shows | On what | Source |
|---|---|---|---|---|
| Richard Thomson ⚠ | — | signed an early day motion, **for** | Judicial review on miscarriages of justice between 1982 and 2016 (2023-06-06) | [record](https://edm.parliament.uk/early-day-motion/60849) |
| Ms Rachael Maskell ⚠ | — | signed an early day motion, **for** | Judicial review on miscarriages of justice between 1982 and 2016 (2023-06-05) | [record](https://edm.parliament.uk/early-day-motion/60849) |
| Richard Burgon ⚠ | — | signed an early day motion, **for** | Judicial review on miscarriages of justice between 1982 and 2016 (2023-05-25) | [record](https://edm.parliament.uk/early-day-motion/60849) |
| Neale Hanvey ⚠ | — | signed an early day motion, **for** | Judicial review on miscarriages of justice between 1982 and 2016 (2023-05-22) | [record](https://edm.parliament.uk/early-day-motion/60849) |
| John McDonnell ⚠ | — | signed an early day motion, **for** | Judicial review on miscarriages of justice between 1982 and 2016 (2023-05-17) | [record](https://edm.parliament.uk/early-day-motion/60849) |
| Martyn Day ⚠ | — | signed an early day motion, **for** | Judicial review on miscarriages of justice between 1982 and 2016 (2023-05-12) | [record](https://edm.parliament.uk/early-day-motion/60849) |
| Chris Stephens ⚠ | — | signed an early day motion, **for** | Judicial review on miscarriages of justice between 1982 and 2016 (2023-05-09) | [record](https://edm.parliament.uk/early-day-motion/60849) |
| Ben Lake MP ⚠ | — | signed an early day motion, **for** | Judicial review on miscarriages of justice between 1982 and 2016 (2023-05-03) | [record](https://edm.parliament.uk/early-day-motion/60849) |
| Hywel Williams ⚠ | — | signed an early day motion, **for** | Judicial review on miscarriages of justice between 1982 and 2016 (2023-05-03) | [record](https://edm.parliament.uk/early-day-motion/60849) |
| Liz Saville Roberts ⚠ | — | tabled an early day motion, **for** | Judicial review on miscarriages of justice between 1982 and 2016 (2023-05-02) | [record](https://edm.parliament.uk/early-day-motion/60849) |

⚠ **The order is: confidence (descending), then number of contributing signals (descending), then name (A–Z).**

## M-06 — The permanent, appointed civil service

Resolved to: **Civil Service pensions** (edm).

⚠ **Matched on 2 content word(s): "civil service"**, from the proposal's own title. A target resolved on a short phrase may be topically wrong; check the label above before relying on anything beneath it.

44 people have a record against this target.

Of those, **1 tabled** the motion and **43 signed** it.

⚠⚠ **Signing an early day motion is not the same as supporting the proposal in front of you, and it is a judgement rather than a fact.** A member may sign a motion to get it debated, to support one clause of it, or as a courtesy to a colleague, and the record does not distinguish those from agreement. What is assembled here is that they signed; what they meant by it is exactly what the confirmation step is for.

| Person | Party at the time | What the record shows | On what | Source |
|---|---|---|---|---|
| Ben Maguire ⚠ | — | signed an early day motion, **for** | Civil Service pensions (2026-07-07) | [record](https://edm.parliament.uk/early-day-motion/65948) |
| Sarah Green MP ⚠ | — | signed an early day motion, **for** | Civil Service pensions (2026-07-07) | [record](https://edm.parliament.uk/early-day-motion/65948) |
| Richard Foord ⚠ | — | signed an early day motion, **for** | Civil Service pensions (2026-06-25) | [record](https://edm.parliament.uk/early-day-motion/65948) |
| Dr Ellie Chowns ⚠ | — | signed an early day motion, **for** | Civil Service pensions (2026-06-23) | [record](https://edm.parliament.uk/early-day-motion/65948) |
| Claire Young ⚠ | — | signed an early day motion, **for** | Civil Service pensions (2026-06-17) | [record](https://edm.parliament.uk/early-day-motion/65948) |
| Alex Brewer ⚠ | — | signed an early day motion, **for** | Civil Service pensions (2026-06-10) | [record](https://edm.parliament.uk/early-day-motion/65948) |
| Ms Christine Jardine ⚠ | — | signed an early day motion, **for** | Civil Service pensions (2026-06-09) | [record](https://edm.parliament.uk/early-day-motion/65948) |
| Calum Miller ⚠ | — | signed an early day motion, **for** | Civil Service pensions (2026-06-08) | [record](https://edm.parliament.uk/early-day-motion/65948) |
| Pippa Heylings ⚠ | — | signed an early day motion, **for** | Civil Service pensions (2026-06-08) | [record](https://edm.parliament.uk/early-day-motion/65948) |
| Zöe Franklin ⚠ | — | signed an early day motion, **for** | Civil Service pensions (2026-06-08) | [record](https://edm.parliament.uk/early-day-motion/65948) |
| Ann Davies ⚠ | — | signed an early day motion, **for** | Civil Service pensions (2026-06-05) | [record](https://edm.parliament.uk/early-day-motion/65948) |
| Liz Saville Roberts ⚠ | — | signed an early day motion, **for** | Civil Service pensions (2026-06-05) | [record](https://edm.parliament.uk/early-day-motion/65948) |
| Llinos Medi ⚠ | — | signed an early day motion, **for** | Civil Service pensions (2026-06-05) | [record](https://edm.parliament.uk/early-day-motion/65948) |
| Cameron Thomas ⚠ | — | signed an early day motion, **for** | Civil Service pensions (2026-06-04) | [record](https://edm.parliament.uk/early-day-motion/65948) |
| Sarah Dyke ⚠ | — | signed an early day motion, **for** | Civil Service pensions (2026-06-04) | [record](https://edm.parliament.uk/early-day-motion/65948) |
| Adam Dance ⚠ | — | signed an early day motion, **for** | Civil Service pensions (2026-06-03) | [record](https://edm.parliament.uk/early-day-motion/65948) |
| Brian Mathew ⚠ | — | signed an early day motion, **for** | Civil Service pensions (2026-06-03) | [record](https://edm.parliament.uk/early-day-motion/65948) |
| David Chadwick ⚠ | — | signed an early day motion, **for** | Civil Service pensions (2026-06-03) | [record](https://edm.parliament.uk/early-day-motion/65948) |
| Gideon Amos ⚠ | — | signed an early day motion, **for** | Civil Service pensions (2026-06-03) | [record](https://edm.parliament.uk/early-day-motion/65948) |
| Liz Jarvis ⚠ | — | signed an early day motion, **for** | Civil Service pensions (2026-06-03) | [record](https://edm.parliament.uk/early-day-motion/65948) |
| Martin Wrigley ⚠ | — | signed an early day motion, **for** | Civil Service pensions (2026-06-03) | [record](https://edm.parliament.uk/early-day-motion/65948) |
| Mr Lee Dillon ⚠ | — | signed an early day motion, **for** | Civil Service pensions (2026-06-03) | [record](https://edm.parliament.uk/early-day-motion/65948) |
| Ms Layla Moran ⚠ | — | signed an early day motion, **for** | Civil Service pensions (2026-06-03) | [record](https://edm.parliament.uk/early-day-motion/65948) |
| Olly Glover ⚠ | — | signed an early day motion, **for** | Civil Service pensions (2026-06-03) | [record](https://edm.parliament.uk/early-day-motion/65948) |
| Professor  Clive  Jones ⚠ | — | signed an early day motion, **for** | Civil Service pensions (2026-06-03) | [record](https://edm.parliament.uk/early-day-motion/65948) |
| Susan Murray ⚠ | — | signed an early day motion, **for** | Civil Service pensions (2026-06-03) | [record](https://edm.parliament.uk/early-day-motion/65948) |
| Tom Gordon ⚠ | — | signed an early day motion, **for** | Civil Service pensions (2026-06-03) | [record](https://edm.parliament.uk/early-day-motion/65948) |
| Andrew George ⚠ | — | signed an early day motion, **for** | Civil Service pensions (2026-06-02) | [record](https://edm.parliament.uk/early-day-motion/65948) |
| Ben Lake MP ⚠ | — | signed an early day motion, **for** | Civil Service pensions (2026-06-02) | [record](https://edm.parliament.uk/early-day-motion/65948) |
| Dr Al Pinkerton ⚠ | — | signed an early day motion, **for** | Civil Service pensions (2026-06-02) | [record](https://edm.parliament.uk/early-day-motion/65948) |
| Dr Danny Chambers ⚠ | — | signed an early day motion, **for** | Civil Service pensions (2026-06-02) | [record](https://edm.parliament.uk/early-day-motion/65948) |
| Ian Sollom ⚠ | — | signed an early day motion, **for** | Civil Service pensions (2026-06-02) | [record](https://edm.parliament.uk/early-day-motion/65948) |
| Jamie Stone ⚠ | — | signed an early day motion, **for** | Civil Service pensions (2026-06-02) | [record](https://edm.parliament.uk/early-day-motion/65948) |
| Jess Brown-Fuller ⚠ | — | signed an early day motion, **for** | Civil Service pensions (2026-06-02) | [record](https://edm.parliament.uk/early-day-motion/65948) |
| Jim Shannon ⚠ | — | signed an early day motion, **for** | Civil Service pensions (2026-06-02) | [record](https://edm.parliament.uk/early-day-motion/65948) |
| Mr Joshua Reynolds ⚠ | — | signed an early day motion, **for** | Civil Service pensions (2026-06-02) | [record](https://edm.parliament.uk/early-day-motion/65948) |
| Mr Will Forster ⚠ | — | signed an early day motion, **for** | Civil Service pensions (2026-06-02) | [record](https://edm.parliament.uk/early-day-motion/65948) |
| Ms Charlotte Cane ⚠ | — | signed an early day motion, **for** | Civil Service pensions (2026-06-02) | [record](https://edm.parliament.uk/early-day-motion/65948) |
| Steve Darling ⚠ | — | signed an early day motion, **for** | Civil Service pensions (2026-06-02) | [record](https://edm.parliament.uk/early-day-motion/65948) |
| Victoria Collins ⚠ | — | signed an early day motion, **for** | Civil Service pensions (2026-06-02) | [record](https://edm.parliament.uk/early-day-motion/65948) |

⚠⚠ **Showing 40 of 44.** The other 4 are not absent from the record; they are below the display cap. **Do not read the people below as having no position.**

⚠ **The order is: confidence (descending), then number of contributing signals (descending), then name (A–Z).** 2 actors are tied at the top of this order (confidence 0.363, 1 signal); among those the order is by name. ⚠ 2 of the 44 matched share the top score exactly.

## M-07 — Operational independence of the Bank of England

Resolved to: **Independence of the Bank of England** (edm).

⚠ **Matched on 2 content word(s): "independence of the bank"**, from the proposal's own title. A target resolved on a short phrase may be topically wrong; check the label above before relying on anything beneath it.

2 people have a record against this target.

Of those, **1 tabled** the motion and **1 signed** it.

⚠⚠ **Signing an early day motion is not the same as supporting the proposal in front of you, and it is a judgement rather than a fact.** A member may sign a motion to get it debated, to support one clause of it, or as a courtesy to a colleague, and the record does not distinguish those from agreement. What is assembled here is that they signed; what they meant by it is exactly what the confirmation step is for.

| Person | Party at the time | What the record shows | On what | Source |
|---|---|---|---|---|
| Steven Norris ⚠ | — | signed an early day motion, **for** | Independence of the Bank of England (1989-12-06) | [record](https://edm.parliament.uk/early-day-motion/1767) |
| Mrs Teresa Gorman ⚠ | — | tabled an early day motion, **for** | Independence of the Bank of England (1989-12-05) | [record](https://edm.parliament.uk/early-day-motion/1767) |

⚠ **The order is: confidence (descending), then number of contributing signals (descending), then name (A–Z).**

## M-08 — Diversity, equity and inclusion practice in the civil service

Resolved to: **Civil Service pensions** (edm).

⚠ **Matched on 2 content word(s): "civil service"**, from the proposal's own title. A target resolved on a short phrase may be topically wrong; check the label above before relying on anything beneath it.

44 people have a record against this target.

Of those, **1 tabled** the motion and **43 signed** it.

⚠⚠ **Signing an early day motion is not the same as supporting the proposal in front of you, and it is a judgement rather than a fact.** A member may sign a motion to get it debated, to support one clause of it, or as a courtesy to a colleague, and the record does not distinguish those from agreement. What is assembled here is that they signed; what they meant by it is exactly what the confirmation step is for.

| Person | Party at the time | What the record shows | On what | Source |
|---|---|---|---|---|
| Ben Maguire ⚠ | — | signed an early day motion, **for** | Civil Service pensions (2026-07-07) | [record](https://edm.parliament.uk/early-day-motion/65948) |
| Sarah Green MP ⚠ | — | signed an early day motion, **for** | Civil Service pensions (2026-07-07) | [record](https://edm.parliament.uk/early-day-motion/65948) |
| Richard Foord ⚠ | — | signed an early day motion, **for** | Civil Service pensions (2026-06-25) | [record](https://edm.parliament.uk/early-day-motion/65948) |
| Dr Ellie Chowns ⚠ | — | signed an early day motion, **for** | Civil Service pensions (2026-06-23) | [record](https://edm.parliament.uk/early-day-motion/65948) |
| Claire Young ⚠ | — | signed an early day motion, **for** | Civil Service pensions (2026-06-17) | [record](https://edm.parliament.uk/early-day-motion/65948) |
| Alex Brewer ⚠ | — | signed an early day motion, **for** | Civil Service pensions (2026-06-10) | [record](https://edm.parliament.uk/early-day-motion/65948) |
| Ms Christine Jardine ⚠ | — | signed an early day motion, **for** | Civil Service pensions (2026-06-09) | [record](https://edm.parliament.uk/early-day-motion/65948) |
| Calum Miller ⚠ | — | signed an early day motion, **for** | Civil Service pensions (2026-06-08) | [record](https://edm.parliament.uk/early-day-motion/65948) |
| Pippa Heylings ⚠ | — | signed an early day motion, **for** | Civil Service pensions (2026-06-08) | [record](https://edm.parliament.uk/early-day-motion/65948) |
| Zöe Franklin ⚠ | — | signed an early day motion, **for** | Civil Service pensions (2026-06-08) | [record](https://edm.parliament.uk/early-day-motion/65948) |
| Ann Davies ⚠ | — | signed an early day motion, **for** | Civil Service pensions (2026-06-05) | [record](https://edm.parliament.uk/early-day-motion/65948) |
| Liz Saville Roberts ⚠ | — | signed an early day motion, **for** | Civil Service pensions (2026-06-05) | [record](https://edm.parliament.uk/early-day-motion/65948) |
| Llinos Medi ⚠ | — | signed an early day motion, **for** | Civil Service pensions (2026-06-05) | [record](https://edm.parliament.uk/early-day-motion/65948) |
| Cameron Thomas ⚠ | — | signed an early day motion, **for** | Civil Service pensions (2026-06-04) | [record](https://edm.parliament.uk/early-day-motion/65948) |
| Sarah Dyke ⚠ | — | signed an early day motion, **for** | Civil Service pensions (2026-06-04) | [record](https://edm.parliament.uk/early-day-motion/65948) |
| Adam Dance ⚠ | — | signed an early day motion, **for** | Civil Service pensions (2026-06-03) | [record](https://edm.parliament.uk/early-day-motion/65948) |
| Brian Mathew ⚠ | — | signed an early day motion, **for** | Civil Service pensions (2026-06-03) | [record](https://edm.parliament.uk/early-day-motion/65948) |
| David Chadwick ⚠ | — | signed an early day motion, **for** | Civil Service pensions (2026-06-03) | [record](https://edm.parliament.uk/early-day-motion/65948) |
| Gideon Amos ⚠ | — | signed an early day motion, **for** | Civil Service pensions (2026-06-03) | [record](https://edm.parliament.uk/early-day-motion/65948) |
| Liz Jarvis ⚠ | — | signed an early day motion, **for** | Civil Service pensions (2026-06-03) | [record](https://edm.parliament.uk/early-day-motion/65948) |
| Martin Wrigley ⚠ | — | signed an early day motion, **for** | Civil Service pensions (2026-06-03) | [record](https://edm.parliament.uk/early-day-motion/65948) |
| Mr Lee Dillon ⚠ | — | signed an early day motion, **for** | Civil Service pensions (2026-06-03) | [record](https://edm.parliament.uk/early-day-motion/65948) |
| Ms Layla Moran ⚠ | — | signed an early day motion, **for** | Civil Service pensions (2026-06-03) | [record](https://edm.parliament.uk/early-day-motion/65948) |
| Olly Glover ⚠ | — | signed an early day motion, **for** | Civil Service pensions (2026-06-03) | [record](https://edm.parliament.uk/early-day-motion/65948) |
| Professor  Clive  Jones ⚠ | — | signed an early day motion, **for** | Civil Service pensions (2026-06-03) | [record](https://edm.parliament.uk/early-day-motion/65948) |
| Susan Murray ⚠ | — | signed an early day motion, **for** | Civil Service pensions (2026-06-03) | [record](https://edm.parliament.uk/early-day-motion/65948) |
| Tom Gordon ⚠ | — | signed an early day motion, **for** | Civil Service pensions (2026-06-03) | [record](https://edm.parliament.uk/early-day-motion/65948) |
| Andrew George ⚠ | — | signed an early day motion, **for** | Civil Service pensions (2026-06-02) | [record](https://edm.parliament.uk/early-day-motion/65948) |
| Ben Lake MP ⚠ | — | signed an early day motion, **for** | Civil Service pensions (2026-06-02) | [record](https://edm.parliament.uk/early-day-motion/65948) |
| Dr Al Pinkerton ⚠ | — | signed an early day motion, **for** | Civil Service pensions (2026-06-02) | [record](https://edm.parliament.uk/early-day-motion/65948) |
| Dr Danny Chambers ⚠ | — | signed an early day motion, **for** | Civil Service pensions (2026-06-02) | [record](https://edm.parliament.uk/early-day-motion/65948) |
| Ian Sollom ⚠ | — | signed an early day motion, **for** | Civil Service pensions (2026-06-02) | [record](https://edm.parliament.uk/early-day-motion/65948) |
| Jamie Stone ⚠ | — | signed an early day motion, **for** | Civil Service pensions (2026-06-02) | [record](https://edm.parliament.uk/early-day-motion/65948) |
| Jess Brown-Fuller ⚠ | — | signed an early day motion, **for** | Civil Service pensions (2026-06-02) | [record](https://edm.parliament.uk/early-day-motion/65948) |
| Jim Shannon ⚠ | — | signed an early day motion, **for** | Civil Service pensions (2026-06-02) | [record](https://edm.parliament.uk/early-day-motion/65948) |
| Mr Joshua Reynolds ⚠ | — | signed an early day motion, **for** | Civil Service pensions (2026-06-02) | [record](https://edm.parliament.uk/early-day-motion/65948) |
| Mr Will Forster ⚠ | — | signed an early day motion, **for** | Civil Service pensions (2026-06-02) | [record](https://edm.parliament.uk/early-day-motion/65948) |
| Ms Charlotte Cane ⚠ | — | signed an early day motion, **for** | Civil Service pensions (2026-06-02) | [record](https://edm.parliament.uk/early-day-motion/65948) |
| Steve Darling ⚠ | — | signed an early day motion, **for** | Civil Service pensions (2026-06-02) | [record](https://edm.parliament.uk/early-day-motion/65948) |
| Victoria Collins ⚠ | — | signed an early day motion, **for** | Civil Service pensions (2026-06-02) | [record](https://edm.parliament.uk/early-day-motion/65948) |

⚠⚠ **Showing 40 of 44.** The other 4 are not absent from the record; they are below the display cap. **Do not read the people below as having no position.**

⚠ **The order is: confidence (descending), then number of contributing signals (descending), then name (A–Z).** 2 actors are tied at the top of this order (confidence 0.363, 1 signal); among those the order is by name. ⚠ 2 of the 44 matched share the top score exactly.

## M-09 — Gender self-identification

**No parliamentary target could be resolved for this measure**, so no register can be built for it. ⚠ That is a statement about the mapping from a broad policy proposal to specific parliamentary business — a division, a motion, a bill — and **not** a statement that nobody has taken a position on the subject.

## M-10 — Publicly funded charities campaigning on government policy

Resolved to: **Maintaining institutional neutrality of publicly funded buildings and spaces** (edm).

⚠ **Matched on 2 content word(s): "publicly funded"**, from the proposal's own title. A target resolved on a short phrase may be topically wrong; check the label above before relying on anything beneath it.

10 people have a record against this target.

Of those, **1 tabled** the motion and **9 signed** it.

⚠⚠ **Signing an early day motion is not the same as supporting the proposal in front of you, and it is a judgement rather than a fact.** A member may sign a motion to get it debated, to support one clause of it, or as a courtesy to a colleague, and the record does not distinguish those from agreement. What is assembled here is that they signed; what they meant by it is exactly what the confirmation step is for.

| Person | Party at the time | What the record shows | On what | Source |
|---|---|---|---|---|
| James McMurdock ⚠ | — | signed an early day motion, **for** | Maintaining institutional neutrality of publicly funded buildings and spaces (2025-09-12) | [record](https://edm.parliament.uk/early-day-motion/63844) |
| Jim Shannon ⚠ | — | signed an early day motion, **for** | Maintaining institutional neutrality of publicly funded buildings and spaces (2025-06-16) | [record](https://edm.parliament.uk/early-day-motion/63844) |
| Mr Gregory Campbell ⚠ | — | signed an early day motion, **for** | Maintaining institutional neutrality of publicly funded buildings and spaces (2025-06-16) | [record](https://edm.parliament.uk/early-day-motion/63844) |
| Bradley Thomas ⚠ | — | signed an early day motion, **for** | Maintaining institutional neutrality of publicly funded buildings and spaces (2025-06-13) | [record](https://edm.parliament.uk/early-day-motion/63844) |
| Jack Rankin ⚠ | — | signed an early day motion, **for** | Maintaining institutional neutrality of publicly funded buildings and spaces (2025-06-13) | [record](https://edm.parliament.uk/early-day-motion/63844) |
| Lewis Cocking ⚠ | — | signed an early day motion, **for** | Maintaining institutional neutrality of publicly funded buildings and spaces (2025-06-13) | [record](https://edm.parliament.uk/early-day-motion/63844) |
| Mr Peter Bedford ⚠ | — | signed an early day motion, **for** | Maintaining institutional neutrality of publicly funded buildings and spaces (2025-06-13) | [record](https://edm.parliament.uk/early-day-motion/63844) |
| Mr Rupert Lowe ⚠ | — | signed an early day motion, **for** | Maintaining institutional neutrality of publicly funded buildings and spaces (2025-06-13) | [record](https://edm.parliament.uk/early-day-motion/63844) |
| Rt Hon Gavin Robinson MP ⚠ | — | signed an early day motion, **for** | Maintaining institutional neutrality of publicly funded buildings and spaces (2025-06-13) | [record](https://edm.parliament.uk/early-day-motion/63844) |
| Andrew Rosindell ⚠ | — | tabled an early day motion, **for** | Maintaining institutional neutrality of publicly funded buildings and spaces (2025-06-12) | [record](https://edm.parliament.uk/early-day-motion/63844) |

⚠ **The order is: confidence (descending), then number of contributing signals (descending), then name (A–Z).**

## M-11 — The Sentencing Council and sentencing guidelines

Resolved to: **Sentencing Guidelines (Pre-sentence Reports) Bill** (division).

⚠ **Matched on 2 content word(s): "sentencing guidelines"**, from the proposal's own title. A target resolved on a short phrase may be topically wrong; check the label above before relying on anything beneath it.

189 people have a record against this target.

| Person | Party at the time | What the record shows | On what | Source |
|---|---|---|---|---|
| Baroness Falkner of Margravine ⚠ | Crossbench | voted in a recorded division, **against** | Sentencing Guidelines (Pre-sentence Reports) Bill (2025-06-04) | [record](https://votes.parliament.uk/Votes/Lords/Division/3317) |
| Baroness Hollins ⚠ | Crossbench | voted in a recorded division, **for** | Sentencing Guidelines (Pre-sentence Reports) Bill (2025-06-04) | [record](https://votes.parliament.uk/Votes/Lords/Division/3317) |
| Lord Brennan ⚠ | Non-affiliated | voted in a recorded division, **against** | Sentencing Guidelines (Pre-sentence Reports) Bill (2025-06-04) | [record](https://votes.parliament.uk/Votes/Lords/Division/3317) |
| Lord Carlile of Berriew ⚠ | Crossbench | voted in a recorded division, **against** | Sentencing Guidelines (Pre-sentence Reports) Bill (2025-06-04) | [record](https://votes.parliament.uk/Votes/Lords/Division/3317) |
| Lord Carter of Haslemere ⚠ | Crossbench | voted in a recorded division, **for** | Sentencing Guidelines (Pre-sentence Reports) Bill (2025-06-04) | [record](https://votes.parliament.uk/Votes/Lords/Division/3317) |
| Lord Hampton ⚠ | Crossbench | voted in a recorded division, **against** | Sentencing Guidelines (Pre-sentence Reports) Bill (2025-06-04) | [record](https://votes.parliament.uk/Votes/Lords/Division/3317) |
| Lord Hardie ⚠ | Crossbench | voted in a recorded division, **against** | Sentencing Guidelines (Pre-sentence Reports) Bill (2025-06-04) | [record](https://votes.parliament.uk/Votes/Lords/Division/3317) |
| Lord Hogan-Howe ⚠ | Crossbench | voted in a recorded division, **against** | Sentencing Guidelines (Pre-sentence Reports) Bill (2025-06-04) | [record](https://votes.parliament.uk/Votes/Lords/Division/3317) |
| Lord Meston ⚠ | Crossbench | voted in a recorded division, **for** | Sentencing Guidelines (Pre-sentence Reports) Bill (2025-06-04) | [record](https://votes.parliament.uk/Votes/Lords/Division/3317) |
| Lord Paddick ⚠ | Non-affiliated | voted in a recorded division, **for** | Sentencing Guidelines (Pre-sentence Reports) Bill (2025-06-04) | [record](https://votes.parliament.uk/Votes/Lords/Division/3317) |
| Lord Sentamu ⚠ | Crossbench | voted in a recorded division, **against** | Sentencing Guidelines (Pre-sentence Reports) Bill (2025-06-04) | [record](https://votes.parliament.uk/Votes/Lords/Division/3317) |
| Lord Skidelsky ⚠ | Crossbench | voted in a recorded division, **for** | Sentencing Guidelines (Pre-sentence Reports) Bill (2025-06-04) | [record](https://votes.parliament.uk/Votes/Lords/Division/3317) |
| Lord Young of Old Windsor ⚠ | Crossbench | voted in a recorded division, **against** | Sentencing Guidelines (Pre-sentence Reports) Bill (2025-06-04) | [record](https://votes.parliament.uk/Votes/Lords/Division/3317) |
| The Baroness O’Loan DBE MRIA ⚠ | Crossbench | voted in a recorded division, **for** | Sentencing Guidelines (Pre-sentence Reports) Bill (2025-06-04) | [record](https://votes.parliament.uk/Votes/Lords/Division/3317) |
| Barbara Keeley ⚠ | Labour | voted in a recorded division, **against** | Sentencing Guidelines (Pre-sentence Reports) Bill (2025-06-04) | [record](https://votes.parliament.uk/Votes/Lords/Division/3317) |
| Baroness Alexander of Cleveden ⚠ | Labour | voted in a recorded division, **against** | Sentencing Guidelines (Pre-sentence Reports) Bill (2025-06-04) | [record](https://votes.parliament.uk/Votes/Lords/Division/3317) |
| Baroness Anderson of Stoke-on-Trent ⚠ | Labour | voted in a recorded division, **against** | Sentencing Guidelines (Pre-sentence Reports) Bill (2025-06-04) | [record](https://votes.parliament.uk/Votes/Lords/Division/3317) |
| Baroness Andrews ⚠ | Labour | voted in a recorded division, **against** | Sentencing Guidelines (Pre-sentence Reports) Bill (2025-06-04) | [record](https://votes.parliament.uk/Votes/Lords/Division/3317) |
| Baroness Armstrong of Hill Top ⚠ | Labour | voted in a recorded division, **against** | Sentencing Guidelines (Pre-sentence Reports) Bill (2025-06-04) | [record](https://votes.parliament.uk/Votes/Lords/Division/3317) |
| Baroness Bakewell Of Hardington Mandeville ⚠ | Liberal Democrat | voted in a recorded division, **for** | Sentencing Guidelines (Pre-sentence Reports) Bill (2025-06-04) | [record](https://votes.parliament.uk/Votes/Lords/Division/3317) |
| Baroness Benjamin ⚠ | Liberal Democrat | voted in a recorded division, **for** | Sentencing Guidelines (Pre-sentence Reports) Bill (2025-06-04) | [record](https://votes.parliament.uk/Votes/Lords/Division/3317) |
| Baroness Bennett of Manor Castle ⚠ | Green Party | voted in a recorded division, **for** | Sentencing Guidelines (Pre-sentence Reports) Bill (2025-06-04) | [record](https://votes.parliament.uk/Votes/Lords/Division/3317) |
| Baroness Blackstone ⚠ | Labour | voted in a recorded division, **against** | Sentencing Guidelines (Pre-sentence Reports) Bill (2025-06-04) | [record](https://votes.parliament.uk/Votes/Lords/Division/3317) |
| Baroness Blake of Leeds ⚠ | Labour | voted in a recorded division, **against** | Sentencing Guidelines (Pre-sentence Reports) Bill (2025-06-04) | [record](https://votes.parliament.uk/Votes/Lords/Division/3317) |
| Baroness Bonham-Carter of Yarnbury ⚠ | Liberal Democrat | voted in a recorded division, **for** | Sentencing Guidelines (Pre-sentence Reports) Bill (2025-06-04) | [record](https://votes.parliament.uk/Votes/Lords/Division/3317) |
| Baroness Bousted ⚠ | Labour | voted in a recorded division, **against** | Sentencing Guidelines (Pre-sentence Reports) Bill (2025-06-04) | [record](https://votes.parliament.uk/Votes/Lords/Division/3317) |
| Baroness Bowles of Berkhamsted ⚠ | Liberal Democrat | voted in a recorded division, **for** | Sentencing Guidelines (Pre-sentence Reports) Bill (2025-06-04) | [record](https://votes.parliament.uk/Votes/Lords/Division/3317) |
| Baroness Brinton ⚠ | Liberal Democrat | voted in a recorded division, **for** | Sentencing Guidelines (Pre-sentence Reports) Bill (2025-06-04) | [record](https://votes.parliament.uk/Votes/Lords/Division/3317) |
| Baroness Caine of Kentish Town ⚠ | Labour | voted in a recorded division, **against** | Sentencing Guidelines (Pre-sentence Reports) Bill (2025-06-04) | [record](https://votes.parliament.uk/Votes/Lords/Division/3317) |
| Baroness Carberry of Muswell Hill ⚠ | Labour | voted in a recorded division, **against** | Sentencing Guidelines (Pre-sentence Reports) Bill (2025-06-04) | [record](https://votes.parliament.uk/Votes/Lords/Division/3317) |
| Baroness Donaghy ⚠ | Labour | voted in a recorded division, **against** | Sentencing Guidelines (Pre-sentence Reports) Bill (2025-06-04) | [record](https://votes.parliament.uk/Votes/Lords/Division/3317) |
| Baroness Doocey ⚠ | Liberal Democrat | voted in a recorded division, **for** | Sentencing Guidelines (Pre-sentence Reports) Bill (2025-06-04) | [record](https://votes.parliament.uk/Votes/Lords/Division/3317) |
| Baroness Drake ⚠ | Labour | voted in a recorded division, **against** | Sentencing Guidelines (Pre-sentence Reports) Bill (2025-06-04) | [record](https://votes.parliament.uk/Votes/Lords/Division/3317) |
| Baroness Elliott of Whitburn Bay ⚠ | Labour | voted in a recorded division, **against** | Sentencing Guidelines (Pre-sentence Reports) Bill (2025-06-04) | [record](https://votes.parliament.uk/Votes/Lords/Division/3317) |
| Baroness Gale ⚠ | Labour | voted in a recorded division, **against** | Sentencing Guidelines (Pre-sentence Reports) Bill (2025-06-04) | [record](https://votes.parliament.uk/Votes/Lords/Division/3317) |
| Baroness Garden of Frognal ⚠ | Liberal Democrat | voted in a recorded division, **for** | Sentencing Guidelines (Pre-sentence Reports) Bill (2025-06-04) | [record](https://votes.parliament.uk/Votes/Lords/Division/3317) |
| Baroness Golding ⚠ | Labour | voted in a recorded division, **against** | Sentencing Guidelines (Pre-sentence Reports) Bill (2025-06-04) | [record](https://votes.parliament.uk/Votes/Lords/Division/3317) |
| Baroness Goudie ⚠ | Labour | voted in a recorded division, **against** | Sentencing Guidelines (Pre-sentence Reports) Bill (2025-06-04) | [record](https://votes.parliament.uk/Votes/Lords/Division/3317) |
| Baroness Gray of Tottenham ⚠ | Labour | voted in a recorded division, **against** | Sentencing Guidelines (Pre-sentence Reports) Bill (2025-06-04) | [record](https://votes.parliament.uk/Votes/Lords/Division/3317) |
| Baroness Grender ⚠ | Liberal Democrat | voted in a recorded division, **for** | Sentencing Guidelines (Pre-sentence Reports) Bill (2025-06-04) | [record](https://votes.parliament.uk/Votes/Lords/Division/3317) |

⚠⚠ **Showing 40 of 189.** The other 149 are not absent from the record; they are below the display cap. **Do not read the people below as having no position.**

⚠ **The order is: confidence (descending), then number of contributing signals (descending), then name (A–Z).** 14 actors are tied at the top of this order (confidence 0.383, 1 signal); among those the order is by name. ⚠ 14 of the 189 matched share the top score exactly.

## M-12 — The Great Repeal: the programme as a single instrument

**No parliamentary target could be resolved for this measure**, so no register can be built for it. ⚠ That is a statement about the mapping from a broad policy proposal to specific parliamentary business — a division, a motion, a bill — and **not** a statement that nobody has taken a position on the subject.
