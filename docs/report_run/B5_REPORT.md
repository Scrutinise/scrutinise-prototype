# CCW-B5 — resolving the register: what would have to change

**Run 2026-08-30.** Input `docs/report_run/register_proposals.json` (14 proposals, CCW's column one).
**Outputs:** `docs/report_run/register_resolved.json` and `register_resolved.csv`.
**Tool:** `scripts/ingest/graph/report-b5-register.ts`, new.

**14 proposals in, 14 out. 10 resolved to at least one instrument, 4 unresolved, 15 candidate
instruments.** Nothing here is a disposition — whether a gate bites, and whether a measure is worth
doing, are CCW's calls.

---

## 1. Prediction, and how it scored

Logged in `docs/report_run/B5_PREDICTION.md` before the resolver existed or `corpus_acts` was
queried.

| Predicted | Actual | |
|---|---|---|
| 2 proposals resolve to a **proposer-named** instrument | **1** (SP-02 only) | ✗ |
| 8 resolve to **my identification** | **9** | ✗ by one, the same one |
| 4 **unresolved** | **4**, and the same four | ✓ |
| SP-01: 1,000–1,800 UK public general Acts 1997–2010 | **561** | ✗ over by ~2× |
| SP-10 rests on a mistaken premise; GRA 2004 is what is in force | **confirmed** | ✓ |
| CRA 2005 is the most-overlapped instrument | **confirmed — but invisible in this table alone** | ✓ with a correction |

**The named/identification miss is one proposal and it went the safe way.** I predicted SP-05 would
count as proposer-named because he says "the European Convention". It resolves as *my
identification*, because the Convention is a treaty and the instrument I attached is the Human
Rights Act — which he never named. Counting his naming of a treaty as naming a statute is exactly
the inflation B5 §4.1 warns against, so the prediction was wrong in the direction that protects him.

**The SP-01 miss matters more than its size.** I guessed 1,000–1,800 and it is 561. I was reasoning
from an impression of "a lot of Blair legislation" rather than from the ~40 Acts a year the period
actually produced. The direction of the error is worth noting: I over-estimated the thing that makes
his programme look hardest.

---

## 2. The register

Full reasoning per row is in the JSON; the CSV is flat for drafting. Summary:

| id | resolved to | basis | conf. |
|---|---|---|---|
| SP-01 | — *(temporal scope; countable, see §3)* | — | — |
| SP-02 | Human Rights Act 1998 · Equality Act 2010 | **named** ⚠ | high / medium |
| SP-03 | Public Bodies Act 2011 | mine | low |
| SP-04 | CRA 2005 Pt 3 · Scotland Act 1998 · NI Act 1998 | mine | medium |
| SP-05 | Human Rights Act 1998 | mine ⚠ | high |
| SP-06 | — *(corroborates SP-05)* | — | — |
| SP-07 | — *(the aim, not a measure)* | — | — |
| SP-08 | Senior Courts Act 1981 · Judicial Review and Courts Act 2022 | mine | low |
| SP-09 | CRAG 2010 Pt 1 | mine ⚠⚠ | low |
| SP-10 | Equality Act 2010 s.149 · Gender Recognition Act 2004 | mine ⚠⚠ | medium / low |
| SP-11 | Bank of England Act 1998 | mine ⚠⚠ | medium |
| SP-12 | Charities Act 2011 | mine | low |
| SP-13 | Coroners and Justice Act 2009 Pt 4 | mine | medium |
| SP-14 | — *(his drafting standard, for front matter)* | — | — |

**13 of 15 instruments are my identification.** That is the headline for him: the programme is
stated almost entirely without naming legislation, so almost every row in column two is a guess he
needs to correct.

---

## 3. The five things he should read first

**1. The scope is temporal, and that is the whole problem.** SP-01 asks to repeal "the legislation
passed under the Blair and Brown governments from 1997 to 2010". That is countable, and the answer
bounds every other row:

| what was passed 1997–2010, as held in this corpus | |
|---|---|
| UK public general Acts | **561** |
| UK statutory instruments | **23,697** |
| Scottish SIs · Welsh SIs · NI rules | 4,523 · 2,175 · 5,211 |

⚠ These are corpus holdings for the date range, not a complete statute book, and **no in-force
filter has been applied** — treat as an order of magnitude. Even at the narrowest reading it is
hundreds of Acts; on any reading including secondary legislation it is tens of thousands. **A
temporal scope is a different and far larger drafting problem than twelve named measures**, and no
amount of work on the twelve addresses it.

**2. The route he names for the ECHR does not exist.** SP-05 says "repeal the European Convention".
A treaty is not repealed by an Act — it is **denounced** under Article 58, which takes six months
and is a prerogative act, not a Bill. Denunciation also does not by itself change domestic law: the
Convention rights stay enforceable through the Human Rights Act until that Act is changed. **The
proposal as spoken is two separable actions with different effects**, and he has not said which he
means.

**3. The only statutes he is recorded naming were named by someone else.** SP-02's Human Rights Act
and Equality Act are named by **Littlewood, the interviewer**. Starkey's own reply is *"I think it is
a day one thing."* He assents to a list he did not compose. The row carries a `named_by` field
saying so, because "named by the proposer" alone would overstate his commitment — and he says "the
**Equalities** Act", which is not the statute's title (B10 §8.2).

**4. Two targets may not be what he thinks they are.**

- **SP-09** — he argues against **Northcote–Trevelyan (1854)**, not against CRAG 2010. WS-05 is built
  on CRAG Part 1, and "civil service commission" is never uttered in any of the 287 transcripts.
  Repealing CRAG Part 1 removes the statutory footing but does **not** restore patronage
  appointment, which is what he appears to want. Those are not the same measure.
- **SP-10** — gender self-identification **was never enacted in Great Britain**. The instrument in
  force is the Gender Recognition Act 2004, which requires a diagnosis and a panel: close to the
  opposite. There is nothing here matching what he described to repeal. The row exists to say so.

**5. One target is in no workstream at all.** SP-11, **Bank of England Act 1998** — he names the year
and the effect ("complete political independence in 1998") precisely. It is Blair-era, squarely
inside his own stated scope, and absent from all twelve workstreams. This is the register finding
something the programme spec missed.

---

## 4. Overlaps — and why the within-table view understates them

Recorded both ways, computed from shared `gid`. Within B5: Human Rights Act 1998 carries SP-02 and
SP-05; Equality Act 2010 carries SP-02 and SP-10.

⚠ **That view is misleading on its own, and I nearly published it.** Six instruments are also claimed
by workstreams in `scoping_remaining.csv`, which the within-table computation cannot see:

| instrument | claimed by |
|---|---|
| **Constitutional Reform Act 2005** | **SP-04 + WS-02 + WS-03 + WS-09 — four measures on one statute** |
| Public Bodies Act 2011 | SP-03 + WS-07 |
| Senior Courts Act 1981 | SP-08 + WS-08 |
| Judicial Review and Courts Act 2022 | SP-08 + WS-08 |
| Charities Act 2011 | SP-12 + WS-12 |
| Coroners and Justice Act 2009 | SP-13 + WS-11 |

**This is what changes the meaning of "twelve measures."** CRA 2005 alone is the target of four, and
they are not independent: abolishing the Supreme Court (SP-04/WS-02), restoring the Lord Chancellor
(WS-03) and restoring judicial patronage (WS-09) all cut the same Act, in Parts that reference each
other.

⚠ **The Charities Act row is a contradiction, not just an overlap.** `CCW_SPEC` §6 lists it as part
of the **existing toolkit** for WS-12 — something to use. SP-12 points at it as something to
restrict. The same statute appears in the programme twice, pointing opposite ways.

---

## 5. Gates — flags, not analysis

Per B5 §4.2 these are yes/no/unknown and nothing more. Across 15 instruments:

| gate | yes | no | unknown | how it was set |
|---|---|---|---|---|
| devolution | 13 | 2 | 0 | **computed** — citation edges either direction with the Scotland Act 1998, GoWA 2006 or NI Act 1998 |
| northern_ireland | 8 | 7 | 0 | **computed** — the same, NI Act 1998 only |
| international | 2 | 0 | 13 | **declared** only where the instrument is on its face treaty-connected |
| absorption | 5 | 0 | 10 | **read from B3** (`caselaw_WS-01/04/05.json`), unknown wherever B3 did not measure |

⚠ **A "no" on devolution means the detector found no edge, not that no edge exists.** Absence is
weaker evidence than presence, and both `no` rows (Senior Courts Act 1981, Bank of England Act 1998)
should be read that way.

⚠ **`international` is 13 unknowns and that is deliberate.** It is not computable from the citation
graph, and B5 §4.2 says unknown beats a guess.

---

## 6. Method, and what it is not

- Instruments resolved by **exact title match against `corpus_acts`** — the same table the text
  detector resolves against, never typed from memory. All 15 titles resolved first time.
- Detection counts and Part expansion use the **identical code path** as `report-t4-scoping.ts`
  (`inboundEvidence` / `expandPart`), so the report's two tables count the same way.
- **markup, text and enabling are never summed.** `act_level_rows` is reported separately on scoped
  rows and never added in.
- Three Part scopes expanded from the Act's own CLML (CRA 2005 Pt 3 → 46 refs; CRAG 2010 Pt 1 → 20;
  CJA 2009 Pt 4 → 26). ⚠ CJA 2009 Part 4 returns **0** on a literal match and **26** expanded — the
  exact trap the scoping script documents, hit again here.

### Two "checks" in the output are labelled as invariants, because they cannot fail

`overlaps_symmetric` and `no_total_column` would pass on a completely broken run: overlaps are built
from one `gid → proposals` map so symmetry is guaranteed by construction, and the total-column test
reads a constant declared in the same file. They are kept because they catch corruption during
assembly, and demoted in the JSON because that is all they catch. The two real checks —
every proposal present, and every instrument carrying basis/reasoning/confidence — compare against
the input file and against hand-written fields, and can fail.

### One defect found and fixed during the run

The first version printed **⚠⚠ "the counts are a floor, probably a bad one"** against SP-10's
`section-149` scope. That warning is written for a **Part** that failed to expand — and it is wrong
for a section, where a literal match on `target_provision_ref` is precisely the form references use
and precisely the right query. It would have told a reader to distrust a number that is correct.
Sections and Parts now take different messages.
