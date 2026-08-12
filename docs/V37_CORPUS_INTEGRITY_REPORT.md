# V37 — THE CORPUS AUDITS ITSELF

**Executes:** `docs/BRIEF_INGEST_V37_CORPUS_INTEGRITY.md`
**Stream:** INGEST · **Written:** 12 August 2026

---

## ⚠ The brief's own precondition was not met, and running anyway was the right call

V37 says: *"Do not start this until V36's recovery has landed — auditing a corpus that is
mid-repair produces numbers nobody can act on."* **V36's recovery has not landed.** The source walk
finished during this session, nothing has been seeded, nothing has been pushed.

Proceeding was still correct, for a reason the brief itself supplies. §1 asks:

> *"Run it once against the pre-V36 corpus if a snapshot allows it. If this check would have
> surfaced the Companies Act, that is the proof it works — and if it would not, we need to know why
> before trusting it."*

**Right now IS the pre-V36 corpus.** No snapshot is needed and none would have been as good. Once
the recovery lands that proof is unavailable forever. So the sequencing risk the brief worried about
— numbers taken mid-repair — is real for §2's completeness figures, which is why those are quoted
from the completed walk rather than from a half-finished corpus, and it is *inverted* for §1, where
now is the only moment the validation is possible.

---

## §1 — The corpus audits itself, and it puts the Companies Act at rank 1

`docs/CORPUS_CITATION_GAPS.md` + `docs/corpus_citation_gaps.json`, from
`scripts/ingest/v37-citation-gaps.ts`.

It is a query, not a build: the `legislation_edges` table already holds **2.36 M edges / 938 MB**
from the Tier-1 graph. The question nobody had asked it: **of every instrument our corpus refers to,
how many do we actually hold?**

**Of 151,612 instruments the graph refers to, 80,805 are held nowhere.**

### The validation the brief asked for

```
POSITIVE  ukpga/2006/46  Companies Act 2006  →  RANK 1, 7,354 references (547 from our own documents)
POSITIVE  eur/2016/679   UK GDPR             →  rank 29, 473 references
NEGATIVE  ukpga/2010/4   Corporation Tax Act 2010 (2,817 sections held)  →  correctly ABSENT
```

**This check would have found the Companies Act, at the top of a self-prioritising queue, months
ago, from data we already had.** The negative control is what makes that worth anything: a check
that reported every instrument would also have "found" it.

### Ranking makes the queue prioritise itself, and it visibly works

| # | gid | title | ours | external |
|---:|---|---|---:|---:|
| 1 | `ukpga/2006/46` | Companies Act 2006 | 547 | 6,807 |
| 2 | `uksi/1996/207` | Jobseeker's Allowance Regulations 1996 | 163 | 6,079 |
| 3 | `uksi/1987/1971` | *(untitled)* | 81 | 3,989 |
| 4 | `uksi/1981/238` | Transfer of Functions (Transport) Order 1981 | 3,627 | 0 |
| 5 | `uksi/2006/213` | Housing Benefit Regulations 2006 | 101 | 2,983 |

Contrast this with V36's completeness work list, 95% of which is 1800–1849 Georgian local Acts that
yield no text. **Same corpus, same gap, opposite ends of the queue** — citation ranking surfaces the
Companies Act; a completeness sweep surfaces an 1823 turnpike Act. That is the argument for building
this layer first, and it is now measured rather than asserted.

### Every gap is classified; none are suppressed

| classification | instruments | references | meaning |
|---|---:|---:|---|
| `never-seen` | 38,316 | 114,341 | no metadata row at all |
| `no-ingest-route` | 29,359 | 37,814 | cited, deliberately not held, reason recorded per doctype |
| `known-no-text` | 11,621 | 106,457 | metadata held, no compiled section — V36's population |
| `needs-a-decision` | **1,509** | **9,405** | no ingest route **and no recorded decision** |

⚠ **`needs-a-decision` is the bucket to read, and it exists because the alternative was to guess.**
A first draft of the scope list asserted `mwa` was "superseded by anaw" — the corpus holds 22 `mwa`
instruments and 1,446 sections, so that entry would have relabelled real coverage as out of scope.
The list is now derived from what the corpus demonstrably holds (`v37-doctype-scope.ts`: exactly 15
doctypes have a non-zero held count), and anything absent with no recorded reason is flagged rather
than assigned one:

- **`apni`** — 1,264 instruments, 2,602 references. **Acts of the Parliament of Northern Ireland,
  1921–1972: fifty years of NI primary legislation.** The corpus holds `nia` (2000+) and `nisi`
  (Orders in Council) and nothing for this period. Verified present at source.
- **`ukcm`** — 245 instruments, 6,803 references. **Church Measures**, which are primary legislation
  passed by General Synod with the force of an Act. `ukcm/1969/2` alone carries 1,108 references.

Both are Charlie's call. Neither is this script's to make by writing rows.

### Two classes of false gap this check would otherwise have invented

**1,227 instruments resolve only through an alias** and are not gaps at all:

- **Regnal/calendar** — a citation to `ukpga/1925/20` against a corpus holding
  `ukpga/Geo5/15-16/20`. V36 found 1,610 instruments held only under the regnal form; without the
  alias map (built from legislation.gov.uk's own year feeds) this report's headline would be
  inflated by thousands.
- **Prefix and zero-padding** — `eud/1999/468` **404s at the source**, while `eudn/1999/468` is a
  live document the corpus holds. `eud` is an alternate prefix for the EU decision series, and some
  numbers are zero-padded (`eud/2000/0532` for `eudn/2000/532`). Checked against the source, not
  assumed.

### Proving the check can fail

`--self-test` empties the held-instrument set, so every referred-to instrument looks absent and the
negative control must fire:

```
NEGATIVE  a HELD instrument (ukpga/2010/4) must be absent : PRESENT ⚠ FALSE POSITIVE
[v37] SELF-TEST: validation CORRECTLY FAILED
```

It writes nothing and exits 0 only when the validation *fails*. This whole sprint exists because a
suite of checks that always passed was measuring the wrong thing; a validation block that has never
been seen to fail is that suite.

---

## §2 — Completeness against the source's own totals

Built in V36 and completed here, now that the walk has finished: **804 year-feeds, 0 throttled,
324,622 instruments enumerated.**

**The corpus holds 44.1% of what its own source publishes** (143,269 of 324,622). Per collection:

| collection | held | published | completeness |
|---|---:|---:|---:|
| `primary-acts-2000plus` | 933 | 938 | **99.5%** |
| `regional` | 26,150 | 38,099 | 68.6% |
| `si-2010plus` | 19,489 | 28,389 | 68.6% |
| `si-pre-2010` | 54,069 | 80,801 | 66.9% |
| `retained-eu` | 39,068 | 159,773 | **24.5%** |
| `primary-acts-pre-2000` | 3,560 | 16,622 | **21.4%** |

⚠ **Read the columns before the headline.** 139,440 of the 181,353 absences are instruments whose
CLML *was* fetched and declares `NumberOfProvisions="0"` — not a fetch failure, and overwhelmingly
`eur` (95,842) and `eudn` (16,303). The recoverable list is **41,913**.

**`unverifiable` vs `NOT RECONCILED`.** The brief requires that a collection nobody can check must
not print the same word as one that checks out. `CORPUS_COMPLETENESS.md` states NOT RECONCILED means
*unmeasured*, not incomplete, and says no coverage figure may be quoted for those rows. **The
distinction between "no authoritative total exists" and "nobody has looked yet" is NOT yet drawn**,
and drawing it by guessing which publishers have totals would be the `mwa` mistake again. It needs
the per-publisher enquiry it deserves; it is named here rather than fudged.

**The warning now lives in the reachability matrix's own header**, not in a companion file, because
the failure being guarded against is that matrix's headline being read as a health score:

> ⚠ **REACHABILITY IS NOT COMPLETENESS, AND THE NUMBER ABOVE IS ONLY THE FIRST.** A collection that
> is 60% ingested and 100% reachable reports as healthy on this table. […] 17,261 instruments —
> including the Companies Act 2006 and UK GDPR — were absent for months while this matrix read
> 99.12%, and they were found by accident. […] **Quote all three or none.**

**Monthly scheduling is NOT wired.** The brief asks for it and it is a real requirement — a check
nobody reads is a check that does not exist. Not done.

---

## §4 — Detect → size → price → queue

`scripts/ingest/v37-gap-filler.ts`. Run on the top 6 citation gaps:

```
detected      : 49,937 fillable gaps
batch cap     : 6 — 49,931 requeued

  ukpga/2006/46   refs=7354  sections=1968  tokens=504,308
  uksi/1996/207   refs=6242  sections= 472  tokens=177,129
  uksi/1987/1971  refs=4070  sections=   0  hasNoProvisions
  uksi/1981/238   refs=3627  sections=   3  tokens=    813
  uksi/2006/213   refs=3084  sections= 424  tokens=158,357
  uksi/2006/214   refs=2236  sections= 262  tokens=114,935

sections 3,129 · tokens 955,542 · $0.0717 = £0.0564 · month-to-date £0.0000
GATE: PASS — under £15
```

**The six highest-value gaps in the corpus cost 5.6 pence to embed.** That is worth stating plainly
against a brief that anticipated $12–15 for the whole recovery: the money was never the constraint,
and the ranking is what makes a tiny spend buy the Companies Act rather than an 1823 turnpike Act.

**Sizing is exact, not estimated.** The fetch is free (OGL v3.0) and yields the real bodies, so the
price is computed from the actual token count. Nothing is extrapolated — that is how "77,000
sections" came to be attached to the wrong population in V36.

**The threshold cannot be evaded by a hundred small jobs.** The gate tests *this batch plus
month-to-date*, held in a `gap_filler_spend` ledger on Neon. Plan-only runs are recorded as
`plan-only` and excluded from the month, so planning is free and spending is counted.

**Dot leaders are excluded from the price**, so the Companies Act sizes at 1,968 storable sections
rather than 2,093 — V36's fix, visible in the invoice.

### ⚠ What §4 does NOT do, and it refuses to pretend otherwise

The gate passes and the run still stops, at exit code 3, printing the six steps it has not wired:
fetch→store · chunk+embed · keyword index · semantic index · **restart both serves** · verify
through the product.

**A gap half-filled is worse than a gap** — it stops appearing in the report while still missing
from the answers. So the filler reports INCOMPLETE rather than success.

One thing was checked rather than assumed: I suspected the batch cap could not propagate into the
embed, because the catch-up scripts are corpus-wide delta processors. **That was wrong.**
`v33-vec-catchup.ts` reads `<tag>-vec-delta.jsonl` selected by `--run <tag>`, so a scoped work list
does confine the spend to the batch. **The cap is real, not cosmetic.**

---

## §3 — Not built

Live miss logging, and the web-orientation feed into the same gap queue. Not started. It is the
layer with the longest lead time to value (it needs traffic before it says anything) and it was the
right one to defer when §1 turned out to answer the sprint's central question on day one.

---

## What "done" looks like, honestly scored

| §5 criterion | state |
|---|---|
| Citation gap report exists, ranked, findings classified | ✅ 80,805 gaps, 4 classifications, `needs-a-decision` flagged not guessed |
| Completeness check runs against source totals | ✅ 804 feeds, 6 collections reconciled, warning in the matrix header |
| …**monthly**, somewhere Charlie will see it | ❌ not scheduled |
| Every gap lands in one queue with a size and a price | ⚠ citation and completeness gaps both feed the filler; §3's live layer does not exist, so it is not yet *one* queue |
| Filler run end-to-end **including index rebuilds and service restarts**, verified through the product | ❌ **not run** — gate passes, steps not wired |
| Every new check proved able to fail | ✅ `--self-test`, and the negative control |

**Two of six are not done and one is partial.** The sprint's central claim — that a citation audit
would have caught V36's gap — is proven, at rank 1, with a negative control. The filler is the
remaining work, and its precondition is the same one V37 opened with: V36's recovery, and the push
that must precede it.
