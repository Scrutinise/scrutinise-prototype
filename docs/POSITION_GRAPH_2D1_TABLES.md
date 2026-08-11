# Position graph — what is stored (2026-08-11 04:24 UTC)

Read back from `ep-old-dust-aboxi69a.eu-west-2.aws.neon.tech`. Every number below is a `COUNT(*)`, not a sweep counter.

## §5 — the counts

| entity kind | rows |
|---|---:|
| person | 46,175 |
| organisation | 39,766 |
| **total entities** | **85,941** |

Aliases 100,205 · edges 163,052 · evidence rows 178,832 · merge-log rows 7,302

### edges by predicate, with evidence coverage

| predicate | edges | with evidence | evidence rows | first seen | last seen |
|---|---:|---:|---:|---|---|
| `gave-evidence-to` | 162,693 | 162,693 (100.0%) | 178,435 | 2012-12-07 | 2026-07-22 |
| `declared-interest` | 359 | 359 (100.0%) | 397 | 2013-09-07 | 2026-07-13 |

✓ **Every edge has at least one evidence row.** An edge without one is a claim we cannot show our working for, so this is a constraint, not a statistic.
✓ `n_evidence` matches the stored evidence rows on every edge.

## §3 — the resolution rate

| kind | identity established by | entities | mean confidence |
|---|---|---:|---:|
| organisation | `parl-cis-id` | 26,111 | 1.00 |
| organisation | `singleton` | 13,655 | 0.70 |
| person | `singleton` | 45,983 | 0.70 |
| person | `parl-member-id` | 192 | 1.00 |

- **93,640 distinct raw surface strings** were seen, resolving to **85,941 entities**.
- **6,499 entities carry more than one spelling.** Each of those is a name match — a judgement, not a key.
- **26,303 of 85,941 entities (30.6%) rest on a stable external key**; the rest are name-matched or singletons at confidence 0.7.
- `graph_merge_log` holds 7,302 rows, so every fold can be undone. Two rows for one body is visible and fixable; one row for two bodies is neither.

### the widest name matches — read these by hand, they are where contamination would live

- **EEF, the manufacturers' organisation** (organisation, 12 forms): EEF - The Manufacturers' Organisation | EEF - the manufacturers' organisation | EEF The Manufacturers' Organisation | EEF, The Manufacturers' Organisation | EEF, The Manufacturers' Organisation. | EEF, the manufacturers organisation | EEF, the manufacturers' organisation | EEF, the manufacturers’ or
- **Department for Business, Innovation and Skills** (organisation, 10 forms): Department For Business Innovation & Skills | Department For Business Innovation And Skills | Department For Business, Innovation And Skills | Department For Business, Innovation and Skills | Department for Business Innovation & Skills | Department for Business Innovation and Skills | Department for
- **Mr Andrew Smith** (person, 6 forms): Andrew Smith | Dr Andrew Smith | Dr. Andrew Smith | Mr Andrew Smith | Professor Andrew  Smith | Professor Andrew Smith
- **Dr Mark Ryan** (person, 6 forms): Dr  Mark  Ryan | Dr  Mark Ryan | Dr Mark Ryan | Dr mark ryan | Mark Ryan | Mr Mark Ryan
- **Prof Colin Murray** (person, 6 forms): Colin Murray | Dr Colin Murray | Mr Colin  Murray | Mr Colin Murray | Prof Colin Murray | Professor Colin Murray
- **A Member of the Public** (person, 6 forms): A Member Of the Public | A Member of The Public | A Member of the Public | A Member of the public | A member of the Public | A member of the public
- **mr john phillips** (person, 6 forms): John Phillips | Mr JOHN PHILLIPS | Mr John Phillips | Mr john phillips | john phillips | mr john phillips
- **Professor Cristina  Leston-Bandeira** (person, 6 forms): Cristina Leston-Bandeira | Dr Cristina  Leston-Bandeira | Dr Cristina Leston-Bandeira | Prof Cristina Leston-Bandeira | Professor Cristina  Leston-Bandeira | Professor Cristina Leston-Bandeira
- **Katy Hayward** (person, 6 forms): Dr Katy Hayward | Katy Hayward | Prof Katy Hayward | Prof. Katy Hayward | Professor Katy  Hayward | Professor Katy Hayward
- **Professor Suresh  Renukappa** (person, 6 forms): Dr  Suresh Renukappa | Dr Suresh Renukappa | Professor  Suresh  Renukappa | Professor  Suresh Renukappa | Professor Suresh  Renukappa | Professor Suresh Renukappa
- **Professor Laurence  Ferry** (person, 5 forms): Dr Laurence Ferry | Mr Laurence Ferry | Professor  Laurence Ferry | Professor Laurence  Ferry | Professor Laurence Ferry
- **Professor Alistair Clark** (person, 5 forms): Alistair Clark | Dr Alistair Clark | Dr. Alistair Clark | Professor Alistair  Clark | Professor Alistair Clark

## §4 — the policy-area candidate table

**Policy area = the committee.** Chosen because it is *Parliament's own* division of policy
rather than ours: the brief rules out picking an area by intuition, and any clustering of
inquiry titles we invented would be exactly that curation act. The committee is carried on
every evidence item at source, on 100% of the items sampled in §1.

Edges whose label yielded no committee: **571 of 162,693** (0.4%).

| policy area (committee) | inquiries | orgs | **orgs in >1 inquiry** | people | submissions | subs/inquiry |
|---|---:|---:|---:|---:|---:|---:|
| Health and Social Care Committee | 130 | 3,480 | **794** | 2,619 | 8,973 | 69.0 |
| Environmental Audit Committee | 152 | 3,360 | **754** | 1,634 | 7,365 | 48.5 |
| Education Committee | 134 | 3,458 | **729** | 3,306 | 9,154 | 68.3 |
| Housing, Communities and Local Government Committee | 117 | 3,114 | **686** | 2,499 | 7,531 | 64.4 |
| Work and Pensions Committee | 139 | 2,273 | **643** | 2,131 | 6,785 | 48.8 |
| Public Accounts Committee | 639 | 2,472 | **599** | 1,653 | 6,212 | 9.7 |
| Transport Committee | 169 | 2,505 | **594** | 1,864 | 6,551 | 38.8 |
| Science, Innovation and Technology Committee | 167 | 2,911 | **568** | 2,241 | 7,321 | 43.8 |
| Business and Trade Committee | 135 | 2,316 | **553** | 776 | 4,499 | 33.3 |
| Environment, Food and Rural Affairs Committee | 147 | 2,499 | **548** | 2,340 | 6,696 | 45.6 |
| Women and Equalities Committee | 109 | 2,168 | **454** | 3,340 | 6,809 | 62.5 |
| Treasury Committee | 302 | 2,049 | **419** | 1,893 | 5,473 | 18.1 |
| Justice Committee | 179 | 1,563 | **404** | 1,340 | 4,258 | 23.8 |
| Culture, Media and Sport Committee | 97 | 2,402 | **403** | 1,167 | 4,482 | 46.2 |
| Home Affairs Committee | 168 | 2,091 | **402** | 1,801 | 5,030 | 29.9 |
| International Development Committee | 139 | 1,534 | **365** | 973 | 4,124 | 29.7 |
| Energy Security and Net Zero Committee | 31 | 1,025 | **256** | 668 | 2,414 | 77.9 |
| Foreign Affairs Committee | 132 | 1,339 | **246** | 1,552 | 3,735 | 28.3 |
| Communications and Digital Committee | 38 | 886 | **222** | 744 | 2,177 | 57.3 |
| Energy and Climate Change Committee | 57 | 810 | **220** | 396 | 1,784 | 31.3 |

**Ranked by organisations appearing in more than one inquiry** — the brief's own primary
signal, and the right one: repeat participation is what gives the most edges per unit of
extraction cost when proposition extraction is proved on one area.

**On the contestation proxy, and what was chosen instead.** The brief suggests counting
organisations in inquiries whose recommendations were *not accepted in full*, "or another
countable signal you can defend". Acceptance is not derivable from anything structured we
hold: it lives inside the prose of government responses, and mining prose is what this
sprint refuses. So the defensible countable signal reported here is **submissions per
inquiry** — an inquiry many bodies felt the need to be heard on is where positions are
contested. It is a proxy for *salience*, which is weaker than contestation, and it is
labelled as such rather than dressed up.

## §5 — three organisations, read by hand

_"If the graph says something obviously wrong about a body you can check, the counts are decoration."_

### Local Government Association — 369 `gave-evidence-to` edges, identity by `parl-cis-id`

Surfaces seen: "Local Government Association" (committees-written ×351), "The Local Government Association" (committees-written ×42), "Local Government Association" (committees-oral ×40)

| inquiry | id | first seen | evidence | a section id you can open |
|---|---|---|---:|---|
| Modernising Elections (Housing, Communities and Local Government Committee) | 9680 | 2026-06-01 | 1 | `committees-evidence:writtenevidence:166202:295466` |
| Children and Young Adults in the Secure Estate (Justice Committee) | 9543 | 2026-04-21 | 1 | `committees-evidence:writtenevidence:163896:294053` |
| National Resilience (National Resilience Committee) | 9585 | 2026-03-18 | 2 | `committees-evidence:oralevidence:17346:293148` |
| Armed Forces Bill 2026 (Select Committee on the Armed Forces Bill) | 9626 | 2026-03-04 | 1 | `committees-evidence:writtenevidence:163266:288291` |
| Healthy Ageing: physical activity in an ageing society (Health and Social Ca | 9230 | 2026-02-04 | 1 | `committees-evidence:writtenevidence:145354:270603` |
| Joined-up journeys: achieving and measuring transport integration (Transport | 9258 | 2026-01-14 | 1 | `committees-evidence:writtenevidence:150042:282109` |
| Whole of Government Accounts 2023-24 (Public Accounts Committee) | 9284 | 2025-12-11 | 1 | `committees-evidence:writtenevidence:148049:263287` |
| Early Years: Improving Support for Children and Families (Education Committe | 9309 | 2025-11-25 | 2 | `committees-evidence:writtenevidence:149730:271821` |

### University of Oxford — 194 `gave-evidence-to` edges, identity by `parl-cis-id`

Surfaces seen: "University of Oxford" (committees-written ×238), "University of Oxford" (committees-oral ×92), "The University of Oxford" (committees-oral ×7), "The University of Oxford" (committees-written ×5), "The University Of Oxford" (committees-written ×1), "University Of Oxford" (committees-written ×1)

| inquiry | id | first seen | evidence | a section id you can open |
|---|---|---|---:|---|
| Modernising Elections (Housing, Communities and Local Government Committee) | 9680 | 2026-06-10 | 1 | `committees-evidence:writtenevidence:166047:295215` |
| The use of Artificial Intelligence and EdTech in Education (Education Commit | 9642 | 2026-06-03 | 1 | `committees-evidence:writtenevidence:165141:298029` |
| Multilateralism (International Relations and Defence Committee) | 9772 | 2026-06-01 | 1 | `committees-evidence:oralevidence:17637:298276` |
| Air Pollution in England (Environmental Audit Committee) | 9561 | 2026-03-27 | 1 | `committees-evidence:writtenevidence:163193:288801` |
| Warm Homes Plan (Energy Security and Net Zero Committee) | 9637 | 2026-03-17 | 1 | `committees-evidence:oralevidence:17337:289889` |
| Legislative scrutiny: Courts and Tribunals Bill (Justice Committee) | 9654 | 2026-03-17 | 1 | `committees-evidence:writtenevidence:163741:290088` |
| Ancient woodlands (Environmental Audit Committee) | 9652 | 2026-03-13 | 1 | `committees-evidence:oralevidence:17318:289690` |
| Inquiry into the recommendations of the Infected Blood Inquiry (Stage 1) (Pu | 9497 | 2026-03-03 | 1 | `committees-evidence:writtenevidence:162340:289096` |

### Home Office — 192 `gave-evidence-to` edges, identity by `parl-cis-id`

Surfaces seen: "Home Office" (committees-oral ×263), "Home Office" (committees-written ×173), "The Home Office" (committees-oral ×3), "The Home Office" (committees-written ×3)

| inquiry | id | first seen | evidence | a section id you can open |
|---|---|---|---:|---|
| Government compensation schemes: update (Public Accounts Committee) | 9271 | 2026-06-04 | 1 | `committees-evidence:oralevidence:17665:298690` |
| Violence Against Women and Girls strategy update (Home Affairs Committee) | 9755 | 2026-05-05 | 1 | `committees-evidence:oralevidence:17581:295563` |
| Ending violence against women and girls in Northern Ireland (Northern Irelan | 9132 | 2026-03-23 | 1 | `committees-evidence:oralevidence:17375:290453` |
| Armed Forces Bill 2026 (Select Committee on the Armed Forces Bill) | 9626 | 2026-03-18 | 1 | `committees-evidence:writtenevidence:163892:289651` |
| Policing and security in Northern Ireland (Northern Ireland Affairs Committe | 9358 | 2026-03-12 | 2 | `committees-evidence:oralevidence:17310:289549` |
| Settlement, Citizenship and Integration (Justice and Home Affairs Committee) | 9453 | 2026-02-27 | 3 | `committees-evidence:oralevidence:17153:285704` |
| Data security across government (Science, Innovation and Technology Committe | 9466 | 2026-02-12 | 1 | `committees-evidence:oralevidence:17194:286272` |
| An analysis of the asylum system (Public Accounts Committee) | 9508 | 2026-02-11 | 1 | `committees-evidence:oralevidence:17184:286025` |

## integrity checks

- ✓ the graph_evidence → corpus_sections FK exists and is validated (this is what makes a dangling section impossible)
- ✓ no dangling section in a bounded 5,000-row sample
- ✓ no entity has an empty normal form
- ✓ no edge points at itself
- ✓ every declared-interest edge has an entity object
- ✓ every gave-evidence-to edge has an inquiry object
- ✓ no cisId of 0 was stored as an identity
- ✓ every entity has at least one alias
