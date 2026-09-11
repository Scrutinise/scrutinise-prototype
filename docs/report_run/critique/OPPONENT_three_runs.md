# The prepared opponent — three runs, and the spread (CCW-B23 §1)

*2026-09-11 16:21 UTC · `scripts/b23-opponent-spread.ts` over `B23_OPPONENT_M-XX.md`, `_run2.md`, `_run3.md` — all unhinted, persona only, `gemini-2.5-pro`.*

The 10 September finding — *49 routes, the plan closes none* — came from one run of a pass that is not
deterministic. Two more runs across the twelve, same prompt, same model, same inputs. What holds across
three is publishable; what moves is printed as a range.

## Per run

| Run | When | Measures | Routes | closes | partly | does not close | makes it worse | Measures with every route open | Named a migration case |
|---|---|---|---|---|---|---|---|---|---|
| 1 | 2026-09-10 14:16–14:23 | 12 | **49** | **0** | 5 | 33 | 11 | 7 (M-02, M-03, M-04, M-09, M-10, M-11, M-12) | M-01, M-12 |
| 2 | 2026-09-11 15:59–16:05 | 12 | **47** | **0** | 4 | 35 | 8 | 8 (M-01, M-02, M-03, M-06, M-07, M-09, M-11, M-12) | M-01, M-05, M-12 |
| 3 | 2026-09-11 16:06–16:12 | 12 | **47** | **0** | 3 | 33 | 11 | 9 (M-02, M-03, M-04, M-05, M-06, M-07, M-08, M-09, M-10) | M-01, M-03 |

## Combined

- **Routes found:** 47–49 per run (49 / 47 / 47); 143 readings over three runs.
- **closes:** 0–0 · **partly:** 3–5 · **does not close:** 33–35 · **makes it worse:** 8–11
- **Routes left open (does not close + makes it worse):** 44 / 43 / 44 of 49 / 47 / 47 — 90% / 91% / 94%.
- **Measures with every route open:** 7 / 8 / 9 of 12 per run. Every run: M-02, M-03, M-09. At least one run: M-01, M-02, M-03, M-04, M-05, M-06, M-07, M-08, M-09, M-10, M-11, M-12.

▶▶ **"closes: 0" holds across all three runs.** No route, on any measure, in any of the 143 readings, was judged fully closed by the plan. That is the finding the report can print.

⚠ What moves is the split between *partly* and *does not close* and between *does not close* and *makes it
worse* — the boundary calls — and the exact count of routes. What does not move is the top line.

## Per measure, three runs side by side

*Cells are routes: closes / partly / does not close / makes it worse. "All open" = no route judged closes or partly.*

| Measure | Run 1 | Run 2 | Run 3 | All open in | Migration case named in |
|---|---|---|---|---|---|
| M-01 — Human Rights Act 1998 and the European Convention on Human Rights | 4: 0/1/2/1 | 4: 0/0/3/1 | 4: 0/1/2/1 | runs 2 | runs 1, 2, 3 |
| M-02 — Equality Act 2010 | 4: 0/0/3/1 | 4: 0/0/3/1 | 3: 0/0/2/1 | runs 1, 2, 3 | — |
| M-03 — The United Kingdom Supreme Court | 4: 0/0/3/1 | 4: 0/0/4/0 | 4: 0/0/3/1 | runs 1, 2, 3 | runs 3 |
| M-04 — The arm's-length body estate | 4: 0/0/4/0 | 4: 0/1/3/0 | 4: 0/0/3/1 | runs 1, 3 | — |
| M-05 — Judicial review of executive decisions | 4: 0/1/3/0 | 4: 0/1/2/1 | 4: 0/0/3/1 | runs 3 | runs 2 |
| M-06 — The permanent, appointed civil service | 4: 0/1/2/1 | 4: 0/0/3/1 | 4: 0/0/3/1 | runs 2, 3 | — |
| M-07 — Operational independence of the Bank of England | 4: 0/1/2/1 | 4: 0/0/3/1 | 4: 0/0/3/1 | runs 2, 3 | — |
| M-08 — Diversity, equity and inclusion practice in the civil service | 4: 0/1/2/1 | 4: 0/1/2/1 | 4: 0/0/3/1 | runs 3 | — |
| M-09 — Gender self-identification | 4: 0/0/3/1 | 4: 0/0/4/0 | 4: 0/0/3/1 | runs 1, 2, 3 | — |
| M-10 — Publicly funded charities campaigning on government policy | 5: 0/0/4/1 | 4: 0/1/3/0 | 4: 0/0/4/0 | runs 1, 3 | — |
| M-11 — The Sentencing Council and sentencing guidelines | 4: 0/0/2/2 | 3: 0/0/2/1 | 4: 0/1/2/1 | runs 1, 2 | — |
| M-12 — The Great Repeal: the programme as a single instrument | 4: 0/0/3/1 | 4: 0/0/3/1 | 4: 0/1/2/1 | runs 1, 2 | runs 1, 2 |

## How much the categories moved, route by route

*Run 1 routes paired with runs 2 and 3 by mechanism and title-word overlap (Jaccard ≥ 0.35 with a 0.25 bonus for the same mechanism). A coarse pairing: an unpaired route is one the later run described differently or did not raise, not necessarily a new attack.*

| Measure | Run 1 route | Mechanism | Run 1 | Run 2 (paired) | Run 3 (paired) |
|---|---|---|---|---|---|
| M-01 | Fundamental rights, including those mirroring the ECHR, will be re-asserted and developed  | `ALTERNATIVE_SOURCE` | makes it worse | makes it worse (=) | makes it worse (=) |
| M-01 | ECHR-equivalent rights will remain legally entrenched in Northern Ireland and Scotland, cr | `ENTRENCHED_ELSEWHERE` | partly | **does not close** (moved) | partly (=) |
| M-01 | The UK's obligations under other international treaties that incorporate or reference ECHR | `ENTRENCHED_ELSEWHERE` | does not close | — (no pair) | — (no pair) |
| M-01 | Courts will narrowly construe the Repeal Bill, particularly any transitional provisions, t | `NARROW_READING` | does not close | — (no pair) | does not close (=) |
| M-02 | The common law duty of procedural fairness will be interpreted to require consideration of | `ALTERNATIVE_SOURCE` | makes it worse | makes it worse (=) | makes it worse (=) |
| M-02 | The Human Rights Act 1998 will be used to compel public bodies to conduct pre-emptive anal | `ENTRENCHED_ELSEWHERE` | does not close | — (no pair) | does not close (=) |
| M-02 | The repeal will be ineffective or create significant legal uncertainty in Scotland and Wal | `DISAPPLICATION` | does not close | does not close (=) | does not close (=) |
| M-02 | The UK's international treaty obligations will be used to argue that a duty to proactively | `ENTRENCHED_ELSEWHERE` | does not close | — (no pair) | — (no pair) |
| M-03 | The Committee's findings will be deemed legally irrelevant to statutory interpretation. | `NARROW_READING` | does not close | does not close (=) | does not close (=) |
| M-03 | The judiciary's exclusive role in interpreting law will be asserted as a fundamental const | `ENTRENCHED_ELSEWHERE` | does not close | — (no pair) | — (no pair) |
| M-03 | The requirement for judges to give evidence on their reasoning will be declined as unconst | `DISAPPLICATION` | does not close | does not close (=) | — (no pair) |
| M-03 | The court's interpretative approach will be re-grounded in common law constitutionalism, m | `ALTERNATIVE_SOURCE` | makes it worse | **does not close** (moved) | — (no pair) |
| M-04 | The Act's powers of removal and reform will be disapplied for any body exercising judicial | `DISAPPLICATION` | does not close | does not close (=) | does not close (=) |
| M-04 | The independence of bodies established or protected under international law will survive,  | `ENTRENCHED_ELSEWHERE` | does not close | — (no pair) | — (no pair) |
| M-04 | The new Act will be read as creating a parallel power for reform, not as extinguishing the | `NARROW_READING` | does not close | **partly** (moved) | does not close (=) |
| M-04 | The 'default presumption of abolition' will be neutered by reading the 'strict statutory c | `PROCEDURAL_SURVIVAL` | does not close | — (no pair) | — (no pair) |
| M-05 | A court could rule that the supervisory jurisdiction of the High Court to correct errors o | `DISAPPLICATION` | does not close | — (no pair) | does not close (=) |
| M-05 | A court could interpret the new statutory definitions of 'merits' and 'legality' narrowly, | `NARROW_READING` | partly | — (no pair) | **does not close** (moved) |
| M-05 | A court could find that a decision was reached in a procedurally unfair manner, and that s | `PROCEDURAL_SURVIVAL` | does not close | — (no pair) | **makes it worse** (moved) |
| M-05 | A court could find that the statutory definitions of 'merits' and 'legality' are incompati | `ALTERNATIVE_SOURCE` | does not close | does not close (=) | does not close (=) |
| M-06 | The Prerogative Snap-Back: Reviving Common Law Constraints | `ALTERNATIVE_SOURCE` | makes it worse | — (no pair) | — (no pair) |
| M-06 | Unfair Dismissal as a Constitutional Check | `PROCEDURAL_SURVIVAL` | does not close | — (no pair) | — (no pair) |
| M-06 | The Devolution Veto | `ENTRENCHED_ELSEWHERE` | does not close | — (no pair) | — (no pair) |
| M-06 | The Accounting Officer's Shield | `NARROW_READING` | partly | — (no pair) | **does not close** (moved) |
| M-07 | The 'reserve power' in Section 19 is a legal trap. Any attempt to use it outside of a genu | `NARROW_READING` | does not close | — (no pair) | — (no pair) |
| M-07 | Repealing the 1998 Act does not automatically grant ministers control. It revives the Bank | `ALTERNATIVE_SOURCE` | makes it worse | — (no pair) | — (no pair) |
| M-07 | The UK's obligations under international agreements, particularly with the IMF, require an | `ENTRENCHED_ELSEWHERE` | does not close | — (no pair) | does not close (=) |
| M-07 | Even with formal control, ministers will be forced to recreate a functionally independent  | `PROCEDURAL_SURVIVAL` | partly | — (no pair) | — (no pair) |
| M-08 | The 'legally authoritative' guidance will be declared unlawful by the courts. | `DISAPPLICATION` | does not close | does not close (=) | does not close (=) |
| M-08 | The statutory duty to 'advance equality of opportunity' will be used to justify proactive  | `NARROW_READING` | partly | **does not close** (moved) | — (no pair) |
| M-08 | The Civil Service Commission will assert its statutory independence to maintain its existi | `ENTRENCHED_ELSEWHERE` | does not close | — (no pair) | — (no pair) |
| M-08 | Repealing internal DEI policies and guidance creates a legal vacuum, forcing decision-make | `OTHER` | makes it worse | — (no pair) | — (no pair) |
| M-09 | The effect of the Gender Recognition Act 2004 survives any change to the Equality Act 2010 | `ENTRENCHED_ELSEWHERE` | does not close | — (no pair) | does not close (=) |
| M-09 | The statutory guidance will be struck down as ultra vires because it purports to resolve a | `PROCEDURAL_SURVIVAL` | does not close | does not close (=) | does not close (=) |
| M-09 | By removing the statutory protection of 'sex' under the Equality Act for GRC holders, the  | `ALTERNATIVE_SOURCE` | makes it worse | — (no pair) | — (no pair) |
| M-09 | The Supreme Court's judgment in *For Women Scotland* will be read down to apply only to th | `NARROW_READING` | does not close | — (no pair) | — (no pair) |
| M-10 | The grant condition's key terms will be read down by the courts to apply only to the most  | `NARROW_READING` | does not close | — (no pair) | does not close (=) |
| M-10 | The right to campaign is relocated to the charity's privately-raised funds, rendering the  | `ALTERNATIVE_SOURCE` | makes it worse | — (no pair) | **does not close** (moved) |
| M-10 | The mandatory imposition of the grant condition will be challenged via judicial review as  | `ENTRENCHED_ELSEWHERE` | does not close | does not close (=) | does not close (=) |
| M-10 | A charity can bypass the campaigning restriction entirely by challenging the government po | `PROCEDURAL_SURVIVAL` | does not close | — (no pair) | — (no pair) |
| M-10 | The grant condition will be challenged as an unlawful and disproportionate interference wi | `DISAPPLICATION` | does not close | — (no pair) | — (no pair) |
| M-11 | The Court of Appeal continues to issue binding guideline judgments, bypassing the vetoed S | `ALTERNATIVE_SOURCE` | does not close | does not close (=) | **makes it worse** (moved) |
| M-11 | A decision by the Lord Chancellor to reject a guideline is challenged and quashed by judic | `PROCEDURAL_SURVIVAL` | makes it worse | makes it worse (=) | — (no pair) |
| M-11 | In the absence of a statutory guideline due to a veto, courts revert to common law princip | `ALTERNATIVE_SOURCE` | makes it worse | — (no pair) | — (no pair) |
| M-11 | The requirement for Lady Chief Justice approval is read as a constitutional check requirin | `NARROW_READING` | does not close | — (no pair) | **partly** (moved) |
| M-12 | The repeal of the Human Rights Act 1998 will be rendered ineffective by the courts develop | `ALTERNATIVE_SOURCE` | makes it worse | makes it worse (=) | makes it worse (=) |
| M-12 | The repeal of the Human Rights Act 1998 will not take effect in Northern Ireland because t | `ENTRENCHED_ELSEWHERE` | does not close | does not close (=) | does not close (=) |
| M-12 | The 'strong ouster clauses' intended to prevent judicial review will be narrowly construed | `NARROW_READING` | does not close | does not close (=) | — (no pair) |
| M-12 | The provisions overriding the Sewel Convention will be interpreted by the courts as politi | `PROCEDURAL_SURVIVAL` | does not close | — (no pair) | does not close (=) |

**45 of 98 pairing attempts** (each run-1 route against run 2 and against run 3) found a route in the later run: **35 kept the same verdict, 10 moved**; 53 found no pair — the later run raised a differently-described attack, and that unpaired share is itself a measure of how much the pass's *wording* moves even where its verdicts do not.

Movements, by direction:

- partly → does not close: 4
- makes it worse → does not close: 2
- does not close → partly: 2
- does not close → makes it worse: 2

▶ **No paired route moved into *closes* on any later run.** The movement is between the three open-ish categories.

## Mechanisms, per run

| Mechanism | Run 1 | Run 2 | Run 3 |
|---|---|---|---|
| `ALTERNATIVE_SOURCE` | 11 | 14 | 10 |
| `DISAPPLICATION` | 6 | 2 | 9 |
| `ENTRENCHED_ELSEWHERE` | 12 | 5 | 7 |
| `NARROW_READING` | 11 | 13 | 12 |
| `OTHER` | 1 | 5 | 3 |
| `PROCEDURAL_SURVIVAL` | 8 | 8 | 6 |

---

⚠ **Every `restsOn` citation in all three runs still needs checking before it is quoted** — the prompt asks
for a doctrine rather than an invented citation, and that is an instruction, not a guarantee. Three runs
agreeing on a verdict says nothing about whether the authority a route rests on exists.
