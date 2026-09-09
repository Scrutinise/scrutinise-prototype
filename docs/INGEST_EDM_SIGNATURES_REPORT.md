# INGEST — THE 2.06 MILLION SIGNATURES WE NEVER TOOK

**Executes:** `docs/BRIEF_INGEST_EDM_SIGNATURES.md` (all sections)
**By:** CC-Ingest
**Written:** 9 September 2026
**Status:** ✅ **COMPLETE.** All 60,995 motions fetched, **2,126,171 signature rows** loaded
(100.03% of the published figure), **2,002,584 signature signals** created, estimates rebuilt, and
**23 of 23 assertions passing**. §3's hand-check verified 35 of 35 signatures against Parliament's own
page. The load took 3 hours 39 minutes and drew **zero 429s**.

---

## 0 — THE SHORT VERSION

▶ **§1's gate is passed on bytes.** `GET /EarlyDayMotion/{id}` → `Response.Sponsors[]` carries a
member id on **5,739 of 5,739** sampled rows and a date on **5,739 of 5,739**. No name-matching is
needed anywhere in this sprint, and the sponsor is distinguishable from the signatories by an exact
key.

▶ **The date matters more than the brief expected. 80.4% of signatures were added AFTER the motion
was tabled** — 4,614 of 5,739; 1,116 on the day; 9 before it. `edm_sponsor.date_tabled`, the only
date we held, is the wrong `observed_at` for four signatures in five.

▶ **The brief's 2.06 million is right, and it is a NET figure.** `sponsors_count` on the list
endpoint INCLUDES the primary sponsor and reconciled exactly with the detail array on 150 of 150
audited motions. 2,125,547 published − 60,995 sponsors already held = **2,064,552 to gain**.
⚠ That equality does NOT hold at scale, and §1.4 says why: our own snapshot is a month old, so recent
motions have gained signatures since. It fails in the direction of MORE, never fewer.

▶⚠ **THE BLOCKER IS NOT THE DATA, IT IS THE PUBLISHER'S RATE LIMIT, AND §1's OWN COST ESTIMATE WAS
A CHECK THAT COULD NOT FAIL.** §1 measured "0 × 429 in 150 calls at concurrency 4" and costed the
sweep at 32 minutes. The first real run drew **429 on 101 of its first 119 motions** and then stopped
dead. The limiter is a **Cloudflare rate-limiting rule (`error code: 1015`) with a fixed mitigation
instant: `Retry-After` came back at 3,146 seconds and counted down by exactly 60 per minute** toward
one wall-clock moment, identically on the list route and the detail route. **Tripping it puts an hour
on the clock** — though not a total lockout: during the mitigation a minority of requests are answered
anyway, which is why my first readiness test said "cleared" with twenty-three minutes still to run.
See §4 and decision 1.

▶ **§3's hand-check is done and clean: 35 of 35 signatures — name, order AND date — verified against
`edm.parliament.uk`**, a surface entirely independent of the API they were loaded from, on three
motions spanning 2012, 2013 and 2021. A fourth motion reconciled its published total exactly
(62 = 59 supporters + 3 withdrawn).

▶ **The before-state of §3's prediction is recorded and it is worse than the brief says.** Of 80
ideas, 23 resolve to a target; **21 of those 23 resolve to a MOTION, and every single one shows
exactly 1 actor.** The two that resolve to a division show 189 and 254. This is not an edge case;
it is nearly every idea we hold.

---

## 1 — THE AUDIT

### 1.1 The route, and the field-by-field shape

`https://oralquestionsandmotions-api.parliament.uk/EarlyDayMotion/{id}` → `Response.Sponsors[]`.
There is no published swagger (`/swagger/v1/swagger.json` → 404), so the route was found by trying
eight candidate paths and reporting all eight.

Per signature:

| field | what it is | measured |
| --- | --- | --- |
| `Id` | the publisher's own key for **this signature** | present on all rows; used as the PK, so a re-sweep is idempotent without assuming a member signs once |
| `Member.MnisId` | the signatory, keyed | **5,739 of 5,739 (100.00%)**, 0 name-only |
| `CreatedWhen` | **the date signed** | **5,739 of 5,739 (100.00%)** |
| `SponsoringOrder` | 1 = the member who tabled it | see 1.3 |
| `IsWithdrawn` / `WithdrawnDate` | a retracted signature, dated | 36 of 5,739 (0.63%), all dated |
| `Member.Party` / `Constituency` | the member's party **now** | **deliberately not stored** — see 1.5 |

Sampled over **150 motions drawn by `md5(motion_id)`, not by id**: `edm_sponsor.motion_id` ascends
with the tabling date, so an id-ordered sample would have been one session's motions. Signatories came
back for **every tabling year from 1990 to 2026**, dated 100% throughout — this is not a
recent-sessions-only endpoint.

### 1.2 What identifies the signatory: a member id, on every row

**0 of 5,739 rows** were name-only, so the brief's stop-and-report condition does not arise and no
identity is ever merged on similarity anywhere in this sprint.

⚠ A separate and smaller gap, now measured on the whole load: **2,016 of the 2,126 distinct members
who have ever signed an EDM (94.8%) have a `graph_entity` row.** The **110** who do not are older
members (Mr Barry Jones, Lady Hermon, Sir Russell Johnston …), and their **45,004 signatures produce no
signal** — the design forbids a synthetic actor and a name match is refused outright. That is
**2.1% of the load**, counted rather than dropped, and it is decision 5.

### 1.3 Sponsor vs signatory: distinguishable by an exact key

`SponsoringOrder = 1` on **150 of 150** motions, and equal to `PrimarySponsor.MnisId` on **150 of
150**. Parliament's own page agrees and says so in prose: *"The first 6 Members who have signed to
support the motion are the sponsors. The primary sponsor is generally the person who tabled the
motion and has responsibility for it."*

⚠ **`SponsoringOrder` is not 1..n.** The API returns **99999** as a sentinel where no order was
recorded, and NULL on other rows. This is not a footnote: the first load **died** on
`value "99999" is out of range for type smallint`. The column is INTEGER, 99999 is documented as a
sentinel in the DDL, and nothing reads the column as an ordinal.

### 1.4 ⚠⚠ Two counts wear the same name and only one of them is true

* **On the LIST endpoint** `SponsorsCount` == the detail endpoint's `Sponsors.length` on **150 of
  150** motions, and it **includes the primary sponsor**.
* **On the DETAIL endpoint** `SponsorsCount` came back **0 on 150 of 150 motions whose `Sponsors`
  array was non-empty.**

So the brief's 2,125,547 (a `SUM` over `edm_sponsor.sponsors_count`, i.e. the list value) is a sound
target — and reading the same field off the response that actually carries the signatures would have
reported that we had loaded ∞% of nothing.

Confirmed against Parliament's own page on motion 35080: *"Signatures (62) / Supporters (59) /
Withdrawn signatures (3)"*. We hold 62. The published signature count includes the withdrawn.

⚠⚠ **AND THE "150 OF 150" DOES NOT HOLD AT SCALE — BUT THE DISAGREEMENT IS OURS, NOT THE
PUBLISHER'S.** At ~2,100 motions the equality failed on **5**, and every one failed the same way: the
detail array had **more** rows than the count, and every one was tabled between June and July 2026.
`count_expected` is `edm_sponsor.sponsors_count`, and **`edm_sponsor` was swept on 2026-08-16** while
the detail endpoint is being read today. A motion tabled in June 2026 is still open for signature:
motion 66381 was **1** in August and is **10** now; 66131 was 10 and is 31.

So the mismatch is **staleness in our own baseline**, and it will grow as the sweep reaches more 2026
motions. That matters for the check as much as for the number: asserting equality would have failed
thousands of times by the end of the run and drowned the signal it exists to carry. The assertion is
now the direction that can only mean a defect — **the API must never return FEWER rows than its own
count**, because a signature does not disappear (a withdrawn one stays in the array with
`IsWithdrawn` set), so a short array means a truncated fetch. Growth is reported beside it, with a
second check that every instance of it is a **recent** motion — growth on a 2008 motion would be a
different and much worse fact.

⚠ **A consequence for the 2.06m target**, and it is small and in the direction of MORE: over the
motions answered so far the arrays returned about **0.03% more rows than the snapshot predicted**.
That figure moves as the sweep advances, so it is not repeated here — §2.4 carries the live one, and
§4's closing figure carries the final one. What matters is the sign: staleness makes us
*under*-predict, never over.

### 1.4a ⚠⚠ On 10 motions the publisher omits the primary sponsor from the array entirely

A second invariant that held on every audited motion and failed at scale. Across the complete load,
**28 motions carry ZERO rows with `sponsoring_order = 1`** — motion 62502's orders run 2, 3, 4, 5, 6, and the
member `edm_sponsor` names as its sponsor (MNIS 4357) is **not in the `Sponsors` array at all**. The
first ten found were all tabled on **2024-10-07**, the opening sitting day of that session.

This is the case the edge view's second exclusion clause was written for. §1.3 measured
`SponsoringOrder = 1` and "the member `edm_sponsor` names" agreeing on 150 of 150, and the view still
tests **both**, by position *and* by identity — so on these ten the sponsor is excluded by the identity
half even though the positional half finds nothing to exclude. Both directions are now measured on the
whole load rather than argued for:

* **the sponsor leaks into the signature edges: 0** (check A6b);
* **a real signature is dropped by the `<> 1` clause: 0** — no row with order 1 belongs to anyone but
  the sponsor (A6c).

⚠ **Two consequences that are real but small.** For those motions we hold **no signature row for the
sponsor**, so `--fix-sponsor-dates` cannot correct their `observed_at` — the join has nothing to join
to, and they keep the tabling date. And for them the publisher's own `sponsors_count` agrees with the
array (A3 passes), which means **`sponsors_count` does *not* include the primary sponsor there** — the
opposite of §1.4's general finding, on 28 of 60,995 motions.

### 1.5 What is on the wire and refused

`Member.Party` and `Member.Constituency` are returned for every signature and are **not stored**.
They are the member's party and seat **as at the request**, not as at the signature: the endpoint
returns the same block for a 1993 signature as for yesterday's. `division_votes.party` is the party
*at the division* and is a fact about the act; this is not. A column called `party` beside a 1993 date
would manufacture the exact error SURFACE 4 §3 went and fixed from the other direction. The party at
signing is recoverable by date from `graph_member_register` / `graph_member_name` if a later sprint
needs it.

### 1.6 A withdrawn signature loses its signing date, and the API does not say so

On **12 of 12** withdrawn rows held, `CreatedWhen` **equals** `WithdrawnDate` to the day. So for a
withdrawn signature the endpoint gives the withdrawal date under the name of the creation date, and
**the original signing date is not recoverable from this route**. It does not corrupt anything —
withdrawn signatures produce no signal — but "the date this row carries" means something different
for 0.63% of rows and that is written into the DDL rather than left to be rediscovered.

### 1.7 One member, two signatures on one motion

Measured over 1,460 motions: **7 motions (0.48%)** carry a repeated member, accounting for 7 extra
rows. **6 of the 7 have exactly one of the pair withdrawn**, so the live signature is unambiguous.
The seventh (motion 13320, Sir Harold Walker, orders 242 and 243, same date) is a genuine duplicate
in the publisher's record and collapses to one signal on the natural key. After the withdrawn filter,
**0 double-counted live signals in 1,460 motions** — and `verify-edm-signatures.ts` check C2 asserts
it over the whole load rather than over the sample.

### 1.8 The cost

| | |
| --- | --- |
| requests | one per motion, **60,995** (the set `sponsors_count` sums over) |
| model spend | **none.** A fetch and an insert, as the brief authorises |
| rate limit | ⚠ **the load-bearing finding — §4** |
| storage | predicted ~1.9 GiB; **now projected ~1.5 GiB** — see below |
| storage cost | predicted ≈ $0.67/month; **now ≈ $0.53/month** at $0.35/GB-month (checked 2026-08-21, `setup-3c.ts`) |

**The storage prediction is scored downward, on a measurement rather than an estimate.** I predicted
`edm_signatory` at ~150 B/row from `edm_sponsor`'s 153. Measured on 150,047 real rows it is
**132 B/row** — the table carries no party, no constituency and no per-row `fetched_at` (§1.5), and
those omissions are worth 14%:

| | rate | × rows | |
| --- | --- | --- | --- |
| `edm_signatory` | **132 B/row, measured** | ~2.05 M | 0.25 GiB |
| `edm_signatory_fetch` | **119 B/row, measured** | 60,995 | 0.007 GiB |
| `position_signal_stored` | 400 B/row, measured on this DB in §1.8's earlier read | ~1.91 M | 0.71 GiB |
| `position_estimate` | 280 B/row, measured | ~1.91 M | 0.50 GiB |
| | | | **≈ 1.47 GiB** |

✅ **MEASURED, after the load and both rebuilds:** `edm_signatory` **262 MB at 131 B/row** (predicted
132 — exact), `edm_signatory_fetch` **5.4 MB at 95 B/row**, `position_signal_stored` **719 MB at
336 B/row** (predicted 400, so 16% better), `position_estimate` **1,092 MB at 266 B/row** (predicted
280). The database went **21.09 → 22.43 GiB**, i.e. **+1.34 GiB for $0.47/month**, against a prediction
of 1.9 GiB / $0.67 and a revised projection of 1.47 GiB / $0.53. Total storage now **$8.43/month**.

⚠ The two derived-layer rates are **carried over from measurements taken before this load**, not
re-measured on it: only 32,102 signature signals existed when the reading was taken, so the marginal
cost of the rest is an extrapolation and is labelled as one. §4's closing figures replace both with
the real thing.

⚠ **The "17.5 GiB ops ALERT line" is not quoted anywhere in this sprint and its absence is
deliberate.** GRAPH 3C §5 retired it — never a plan limit, its only citation was itself, and the
database passed it during 3B. The enforced ceiling read from this compute is
`neon.max_cluster_size = 16,777,216 MB`. The database stands at **21.09 GiB = $7.93/month**. A script
of mine printed "headroom −3.59 GiB" against the retired line before this was caught; that number is
against a fiction and appears nowhere in the numbers above.

---

## 2 — WHAT WAS BUILT, AND THE ONE THING IT CANNOT DO

### 2.1 The tables

`scripts/ingest/position-graph/schema-edm-signatures.sql`, applied by `setup-edm-signatures.ts`
(host-guarded, DROP-refusing, and it also **refuses to create or replace any object this sprint does
not own** — the graph's `position_signal*` objects included, because redefining one from an ingest
script is how a later `setup-3b`/`setup-3c` run silently reverts it).

* **`edm_signatory`** — one row per signature: the publisher's signature id (PK), the motion, the
  member's MNIS id, the name **as the record printed it**, the sponsoring order, `signed_at`, and the
  withdrawal with its date.
* **`edm_signatory_fetch`** — **what was ATTEMPTED**, one row per motion, with the HTTP status and the
  array length the API returned. Written before the rows it accounts for. This is what makes a resume
  safe: a row with status 200 and `sponsors_seen = 0` is a motion with no signatories, which is a
  different fact from a motion never fetched, and only this table can tell them apart.
* **`graph_edm_signature_edge`** — person → motion for a SIGNATURE, `role = 'signatory'`, excluding
  the primary sponsor and excluding withdrawn signatures, and only where a `corpus_sections` row
  exists to evidence it.
* **`graph_edm_signature_edge_all`** — both roles in one shape, with the role never merged. 2D-2's
  own comment said `role` *"must stay explicit when the full signatory scrape lands"*; this is that
  scrape and it is still explicit.
* **`edm_signature_reconciliation`** — a view whose only job is to be able to disagree with us:
  published count vs array length vs rows stored, **per motion**.

⚠ **2D-2's `graph_signed_motion_edge` is not touched.** It is read by `graph_edge_all`,
`graph_mention` and `derive-signals.ts`; replacing it would change what all three return in the same
commit that loads two million rows. Check B5 asserts it still returns exactly 59,925.

### 2.2 The signal — and where the brief and the ownership rule collide

Signatures land in `position_signal_stored` as `signal_type = 'edm_signature'`, direction +1, weight
**0.6 read from `POSITION_CONFIG`**, `observed_at` = the date signed, `evidence_ids` = the motion's
corpus section, `derivation = 'signatory:v1'`.

⚠⚠ **BRIEF §2 ASKS FOR DISTINCT SIGNAL TYPES AND THIS SPRINT DELIVERS DISTINCT DERIVATIONS, WITH
THE SAME WEIGHT. That is a real gap and it is decision 2, not a silent choice.**

* §2: *"Keep sponsorship and signature as distinct signal types. They carry different weights … and
  merging them would lose that permanently."*
* §5: *"nothing owned by search, graph or lex edited — report the change needed instead."*

A distinct **weight** requires a distinct `SignalType`, and the type union, the weight table and the
half-life table all live in `scrutinise-web/lib/graph/position-config.ts`, which is CC-Graph's. So
the two acts are distinguished on every row by `derivation`:

```
primary-sponsor:v1   the member who TABLED the motion, dated as tabled     57,450 rows
primary-sponsor:v2   the same, re-dated to the day they actually signed     2,475 rows
signatory:v1         a member who SIGNED it                             2,002,584 rows
                                                    live total          2,062,509 rows
```

**Nothing is lost permanently** — the part of §2 that matters. `derivation` is stored per row and
`position_raw_weight(signal_type, derivation)` already takes it, so applying a different weight later
is one statement over rows that already know which act they are:

```sql
UPDATE position_signal_stored SET raw_weight = <w> WHERE derivation = 'signatory:v1';
```

That is not the "rewriting two million immutable rows" `schema-3a.sql` warns against, because the
classification the weight depends on is already in the row.

⚠ **And re-using the existing type is what keeps three graph-owned things working untouched**, which
is worth stating because it was checked rather than hoped: `position_signal_for()` reaches the new
rows through its existing stored arm; `build-position-estimates.ts`'s attention-ceiling assertion
(`NOT (signal_counts ?| ARRAY['vote','edm_signature'])`) stays correct; and `position-coverage.ts`'s
`LAYER_WORDS`, keyed by `SignalType`, still compiles. A new type would have needed all three edited.

### 2.3 The sponsorship dates, corrected in place by the append-only rule

The 59,925 stored sponsorship signals carry `date_tabled` as `observed_at` because it was the only
date we held. We now hold the sponsor's own `CreatedWhen`. `--fix-sponsor-dates` corrects them the way
design §2 says a correction happens — **a NEW row with `superseded_by` set on the old one, never an
UPDATE of the fact** — in ONE statement, so it cannot half-apply and leave a sponsor with two live
signals. Where the new date equals the old one the `ON CONFLICT` fires and the existing row is left
alone, correctly.

⚠⚠ **AND A CORRECTION TO MY OWN FRAMING OF THIS, MEASURED RATHER THAN ASSUMED.** §1's headline is that
**80.4% of signatures were added after the motion was tabled**, and I let that carry the rationale for
this fix. It does not: that figure is about **all signatories**, and the **sponsor** is a different
population. Measured over the 31,879 sponsors for whom a signature row had landed:

```
sponsor signed on the tabling day    30,547   95.8%   (sampled at 52% of the load)
sponsor's date DIFFERS                1,332    4.2%   ← the rows this corrects
sponsor withdrew their own signature      4
sponsors with no signature row at all    16   ← §1.4a; these keep the tabling date

FINAL, over the whole load:  2,475 sponsorship rows re-dated, 2,475 retired — one new row per
                             retired row, so the live sponsorship count is unchanged at 59,925.
```

So the correction touched **2,475 of 59,925 rows (4.1%)** — measured, against the ~2,550 this
paragraph projected — not most of them. The member who tables
a motion signs it that day almost always — which is exactly what you would expect and is not what my
own §2.3 implied before it was counted. **Two populations, two rates; quoting the wider one to justify
work on the narrower one is the same error as reading a corpus mean as a per-idea prediction (§3.4).**

### 2.3a ⚠⚠ One act, two signals — the third invariant that was true of the sample and false of the corpus

Check C2 asserts that no (actor, motion) pair carries more than one live signal. It passed on the
64-motion pilot and at 947 motions, and **failed on 42 pairs once all 60,995 were loaded.** Read rather
than assumed:

```
271 (motion, member) pairs appear twice in the publisher's record
  183   one of the two is withdrawn   → the edge view already drops it; no double count
    9   both withdrawn                → neither is an edge
   79   BOTH LIVE                     → those whose two dates DIFFER produce two signals;
                                        those sharing a date collapse on the natural key
```

They are concentrated on a handful of members, and the two rows sit days to months apart:

```
Mr Michael Foster   (MNIS 271)    21 motions   1998–1999
Sir Harold Walker   (MNIS 1006)   11 motions   1993–1996
Robert Hughes       (MNIS 980)     4 motions   1996
five others                        1 each      up to 2005
```

⚠ **AND MY FIRST DESCRIPTION OF THIS POPULATION WAS WRONG, BY THE MISTAKE THIS PROJECT HAS A NAME FOR.**
I wrote that Walker and Hughes "account for most" — read off the first eight rows of a query ordered by
`motion_id`. Ordering by id put the oldest motions first, so the head of the list was the 1990s pair and
**Michael Foster, who is half the population on his own, was not in it.** The grouped count took one
extra query. `ORDER BY id` is not a sample, and it produced a wrong characterisation of a population in
the same sprint whose sweep is `md5`-ordered specifically to avoid that.

The era is still the point: these are historic records, and `edm.parliament.uk` warns about them
itself — *"As this motion is using historical data, we may not have the record of the original
ordering."*

⚠ **The judgement, stated so it can be disagreed with: a member cannot sign a motion twice without
withdrawing in between, and neither row is withdrawn — so the second row is a duplicate RECORD, not a
second ACT.** Two signals would give that member double the evidence mass on that motion for one act.
`fix-edm-duplicate-signals.ts` keeps the **earliest** (the date they first put their name to it) and
retires the later one with `superseded_by` pointing at the survivor — retired, not deleted, so the fact
that the publisher's record held two remains visible and `edm_signatory` keeps both rows untouched.

✅ **Applied: 42 retired, 0 pairs with more than one live signal, 2,062,509 live signals.**
⚠ **42 of 2,002,626 is 0.002% and changes no number in this report.** It is here because "one act, one
signal" is either true or it is not — and because this is the **third** time in one sprint that an
invariant which held on every sampled motion failed on the whole corpus (A3's count equality, A6's one
primary sponsor, and now C2). The pattern is worth more than any of the three findings: **a check that
has only ever seen a sample has not yet been tested.**

### 2.4 The load, measured — and the projection that got there by converging

✅ **Final, at 100% of motions answered:**

```
motions answered           60,995 of 60,995   100.00%
signature rows held         2,126,171
  withdrawn                    14,680   0.69%
  primary sponsors             60,965
  unidentified (no MNIS)            0
signature EDGES             2,002,653
the published target        2,125,547   (SUM of sponsors_count, snapshot 2026-08-16)
→ loaded                        100.03%   (+624)
```

**The +624 is fully explained and is not an error in either direction**: it is signatures added between
the 16 August sponsor sweep and today. `edm_signatory_fetch` sums the publisher's own snapshot at
2,125,547 for exactly the motions whose arrays returned 2,126,171 — +0.029%, in the direction §1.4
predicted (MORE, never fewer), spread over 199 recent motions.

⚠ **The projection was legitimate only because the work list is `md5(motion_id)`-ordered.** That
ordering was chosen so a pilot could not be one session's motions; the second thing it buys is that a
**partial load is an unbiased sample of the corpus**. Under `ORDER BY motion_id` the sample would have
been the oldest motions and every projection from it wrong in a direction nobody could see.

✅ **AND THE GAP DISSOLVED, WHICH IS WHY REFUSING TO EXPLAIN IT MATTERED:**

| motions answered | mean/motion | projected total | gap to target |
| --- | --- | --- | --- |
| 3,246 (5.3%) | 33.09 | 2,018,416 | 2.8σ |
| 4,134 (6.8%) | 33.22 | 2,046,652 | 2.4σ |
| 11,439 (18.8%) | 34.47 | 2,102,778 ± 37,441 | 1.2σ — inside the sampling error |
| **60,995 (100%)** | **34.86** | **2,126,171** | **+624, and it is the staleness above** |

The published mean is 34.85; the measured mean is **34.86**. ⚠ **The temptation was real, and that is
the point worth recording**: with a corrected interval the gap was still "outside" at 5.6%, and a heavy
right tail (sd 38.1 ≈ mean 34.9) is exactly the shape that shows an apparent deficit early and closes
it later. Had I gone looking for a cause I would have found a plausible one — the 17 priority motions
injected at the front of the order, the two motions with `sponsors_count = 0`, the recent-motion
staleness — and published a finding about data that was never wrong. **A number drifting toward its
target is not a discrepancy; it is an unfinished measurement.**

⚠⚠ **AND THE ERROR BAR ITSELF WAS WRONG TWICE, IN BOTH DIRECTIONS OF USELESSNESS.** First it read
`sd × √N × √((N−n)/(N−1))` — no `√n` in it, so it never shrank as the sample grew — and reported
±16,392, which made the shortfall look like five sigma. The correct estimator for a total is
`N × (sd/√n) × √(1 − n/N)`. Then at 100% the finite-population correction takes that to **zero**, and
a real +624 difference printed as **"624.0σ — OUTSIDE the sampling error … re-read this at 100%"**
while sitting at 100%. **A guard that is right in the middle of its range and absurd at its boundary is
still a broken guard**: the sigma framing means something only while something is being estimated. At
100% the difference is a fact and the only question is what explains it.

### 2.5 Who else reads `position_estimate` — re-established, not inherited

`build-position-estimates.ts` says in its own header that this is *"a fact about today which the next
sprint must re-establish rather than inherit"*. Re-established:

* grepped: the string `position_estimate` appears in **19 files**. ⚠ **Three of those mentions are not
  reads at all, and taking the grep at face value would have put a production file on the list:**
  * `scrutinise-web/lib/graph/positions.ts` — the read API, and the *only* thing on the list that
    production runs. Its two hits are a **comment** saying the breakdown is *"Computed from the
    SIGNALS … not read out of `position_estimate`"*, and a query against
    **`position_estimate_meta`, which is a different table**. It does not read the estimate table;
  * `scrutinise-web/scripts/check-surface-3-donations.ts` — an **absence assertion**: it greps a
    route's own source to prove the route never writes the table;
  * `scrutinise-web/prisma/surface3_donation_judgement.sql` — a comment saying there is no
    write-back path.
* the remaining 16 are `build-position-estimates.ts` (the writer), `check-3a/3b/3c.ts`,
  `report-3a.ts`, `audit-3b/3c-distribution.ts`, `probe-3b/3c/3c-pre.ts`, the three `schema-3*.sql`
  files and `setup-3a/3c.ts` — **every one CC-Graph tooling run by hand**;
* asked of the database rather than of the source: **no view, rule or other database object reads
  it**;
* so the production read path still does not touch it, and **the rebuild is still explicitly offline
  with a window that is not user-visible.** `positions.ts` computes every number live from
  `position_signal_for()`.

---

## 3 — VERIFICATION THROUGH THE PLATFORM

### 3.1 The hand-check: 35 of 35, against a surface independent of the API

⚠ Checking the API against itself proves nothing, so the check is against `edm.parliament.uk` — the
page a member of the public sees. It is behind a Cloudflare challenge to plain `fetch()` (403 *"Just a
moment…"*, measured), so the pages were opened in a browser and read by eye.

| motion | tabled | published | held | verified |
| --- | --- | --- | --- | --- |
| 43659 CORSTORPHINE DEMENTIA PROJECT | 2012-01-10 | 8 | 8 | **8 of 8** — name, order and date |
| 45311 BRADFORD'S MUSLIM COMMUNITY AND ITS LAST REMAINING SYNAGOGUE | 2013-03-05 | 11 | 11 | **11 of 11** |
| 58842 Transparency in the Apprenticeship Levy funding | 2021-09-06 | 16 | 16 | **16 of 16** |
| 35080 POST OFFICE CHRISTMAS CLUB (No. 2) | 2008-02-06 | 62 | 62 | totals reconcile: page says 62 = 59 supporters + 3 withdrawn |

**35 live signatures checked, 35 correct**, and three details survived the check that a name-only
comparison would have missed:

* on 45311 the page's own order puts Sharma (14 March) **before** Wood (12 March) — our rows carry
  the same out-of-date-order sequence, so the order is the publisher's and not a re-sort of ours;
* on 58842 the sponsor signed **1 September 2021** for a motion tabled **6 September** — signing
  before tabling is real, and it is 9 of 5,739 in the sample rather than a parsing error;
* and 58842's last signature is **24 January 2022**, 4.6 months after tabling. Under a 5-year
  half-life that is a materially different signal from a day-one signature, which is the whole reason
  §1 made the date a gate.

### 3.2 What a user sees — the before, recorded before the load

Measured with the surface's own functions (`extractPhrasesFrom` → `findTargetsByPhrases` →
`positionsFor`, limit 5, `actorKind: 'person'`), not an approximation of them:

```
ideas that resolve to a target        23  (of 80 read)
of those, whose target is a MOTION    21   ← every one shows exactly 1 actor
whose target is a division             2   ← 189 and 254 actors
```

The named idea to score §3's prediction against:

```
idea    a6473880-e328-4674-b747-2eb3c658306b   "Publicly funded charities campaigning on gover…"
target  edm:63844  "Maintaining institutional neutrality of publicly funded buildings and spaces"
actors  1   (Andrew Rosindell, who tabled it)
```

### 3.3 The ranking sentence BEFORE the load — and why `ranking.note` cannot answer §3's question

§3 asks whether the ranking sentence still travels. `ranking.note` is the wrong thing to look at:
`renderPositionBody` prints the sentence only when `ofMatched > shown`, and **with one actor and a
limit of five that is FALSE — correctly, and indistinguishably from the SURFACE 4 bug where the
sentence was computed and then thrown away.** The only way to tell those two apart is to render the
paragraph and look for the words. Rendered on the before-state:

```
⚠ "Who else is here" present in the rendered paragraph: NO
  (ofMatched 1 > shown 1: false)
```

On the division-target ideas the sentence does travel today, with the note SURFACE 4 restored:
*"5 of 254 actors, tied at this confidence (0.394, 1 signal) — ordered by name. This is not a
ranking."*

### 3.4 What a user sees NOW — the prediction scored, and MISSED for a measurable reason

Measured on the same 21 ideas with the same functions, on the complete load:

| | before | after |
| --- | --- | --- |
| motion-target ideas showing **1 actor** | **21 of 21** | **0 of 21** |
| range of actors shown | 1 – 1 | **2 – 45** |
| mean actors across the 17 distinct motions | 1.0 | **15.4** |

**Every one of the 21 ideas moved off a single actor.** `edm:44681` ("PLASTIC BAGS") went from 1 to
**45**; `edm:65948` to 44; `edm:17572` to 36.

⚠⚠ **AND §3's PREDICTION IS MISSED, AT 15.4 RATHER THAN "ROUGHLY 35" — NOT BECAUSE THE LOAD FELL
SHORT BUT BECAUSE THE MOTIONS AN IDEA REACHES ARE SMALLER THAN THE AVERAGE MOTION.** The corpus mean is
**34.86** signatures, measured over all 60,995 motions, and the brief's floor is exactly right *about
the corpus*. The 17 motions our phrase matcher actually resolves these ideas to hold **2 to 46**,
mean **15.4** — so what a user sees is less than half the corpus average.

That is a fact about the **matcher's selection**, not about the ingest, and it is the same error as
§2.3's first framing: **quoting a wider population's rate to predict a narrower one.** It would have
been invisible had the prediction been scored against a corpus-wide average instead of against the
named ideas §3 asked for. ⚠ The corpus can still deliver the brief's number and more — the largest
motion we now hold carries **486 signatures** (§3.6) — but only for an idea that reaches it.

### 3.5 The ranking sentence AFTER the load: it travels, and it now says something usable

Rendered, not asserted — §3.3 explains why a rendered paragraph is the only thing that can answer this. On `edm:44681`:

> **Who else is here.** 5 of 45 people with a record on this, ordered by confidence (descending), then
> number of contributing signals (descending), then name (A–Z).

```
⚠ "Who else is here" present in the rendered paragraph: YES
  (ofMatched 45 > shown 5: true)
```

⚠ And the note is now **better** than the division case, which is worth saying because it was not
predicted. On a division all 254 actors are tied at one confidence, so the note has to say *"This is
not a ranking."* On a motion the signatures carry **different dates**, so decay separates them and the
order is real; the note fires only on the actual ties it finds — *"2 actors are tied at the top of this
order (confidence 0.363, 1 signal); among those the order is by name."* The ranking became load-bearing
exactly as the brief predicted, and it turns out to be able to bear it.

### 3.6 Surface latency, with a control that is not an EDM — no regression, and the control proves it

⚠ **Measured because "it uses an index" is a claim about a plan, not a number.** GRAPH 3B found this
read path taking **9,048 ms** because `position_signal`'s derived `target_id` could not be pushed down;
the fix was `position_signal_for()`, a function, at 57 ms. This sprint multiplied the **stored arm of
that same function** from ~237,000 rows to **2.3 million**, and in this project optimising one access
pattern has wrecked another before.

| target | signals | actors | cold ms | **warm ms** |
| --- | --- | --- | --- | --- |
| **before** — `edm:6918` | 189 | 189 | 506 | **83** |
| **before** — `division:commons:62` (control) | 650 | 549 | 278 | **101** |
| **after** — `edm:21449` | **486** | 486 | 341 | **82** |
| **after** — `edm:9` | 442 | 442 | 70 | **71** |
| **after** — `edm:28373` | 401 | 401 | 70 | **67** |
| **after** — `division:commons:62` (control) | 650 | 549 | 164 | **101** |

✅ **The control is identical at 101 ms**, and the largest motion — now **486 signatures**, up from 189
— answers in **82 ms**, one millisecond faster than a 189-signature motion did before the load.

⚠ **The control is the point of the table, not a courtesy.** It reads the same function whose stored
arm grew tenfold, so a regression on the vote path would not have shown anywhere in the EDM rows. A
table with only EDM targets in it would have been a check that could not fail in the direction that
mattered.

### 3.7 The coverage statement — the count moved by itself, the wording did not

Generated from live state. **Before:**

> `signals:edm_signature` — **Early Day Motions a member tabled** (*the sponsor only — we do not hold
> the members who signed them*): **59,925 rows**, 1989-11-21 to 2026-06-18

**After, with nothing edited:**

> `signals:edm_signature` — **Early Day Motions a member tabled** (*the sponsor only — we do not hold
> the members who signed them*): **2,062,509 rows**, 1989-11-21 to **2026-09-08**

✅ The **count and the dates moved by themselves** — `heldRows` is a `GROUP BY signal_type` over
`position_signal_stored`, so the coverage statement tracked a 34× change in its own subject with no
code change at all. That is the file working exactly as designed.

⚠⚠ **The WORDING did not move, and it is now false in the direction the brief calls out** — describing
a result as a limit. `LAYER_WORDS` in `scrutinise-web/lib/graph/position-coverage.ts` is a string, and
that file is CC-Surface's. **Decision 3** carries the patch.

✅ And a side-effect I flagged as a risk did **not** materialise: `graphEarliest` is still
**1989-11-21** — the EDM record still sets it — so none of the other layers' "begins N years after the
graph's earliest record" notes recalculated. Re-dating the sponsorships moved no boundary.

## 4 — ⚠⚠ THE RATE LIMIT, WHICH IS THE REAL SHAPE OF THIS SPRINT

**The audit's cost estimate was wrong because the check behind it could not fail.** 150 requests at
concurrency 4 drew no 429 and produced "32 minutes". 150 requests finish before this host's limiter
reacts.

What is actually there, read off the wire:

```
HTTP/1.1 429 Too Many Requests
Retry-After: 2802
Server: cloudflare
error code: 1015
```

* it is a **Cloudflare rate-limiting rule**, not the application;
* the penalty is a **fixed mitigation instant, not a cooling rate**: `Retry-After` was 3,146 → 3,115
  → 3,083 → 3,037 → 3,005 across five successive probes and then fell by **exactly 60 per minute**
  for the next twenty minutes, toward one wall-clock moment. **One trip puts an hour on the clock**;
* the **list route and the detail route share it** — both 429 with the same `Retry-After`, so there is
  no second budget to fall back on;
* and `fetch()` has no default timeout, so four hung sockets stopped the first run **dead** rather
  than failing it.

⚠⚠ **AND A CORRECTION TO MY OWN FIRST READING OF IT, WHICH WAS TOO STRONG.** I wrote "one trip costs
an hour" and built a readiness test on it. Then a single `curl` received **200** while, eleven seconds
later and for the identical URL from the same machine with the same headers, `node`'s `fetch()`
received **429 with 1,384 seconds still on the clock**. Four controlled requests inside one minute
(`probe-edm-client-difference.ts`) put it beyond doubt: **200, 429, 429, 429 — during the mitigation,
a minority of requests are answered anyway.** So:

* the mitigation is **not a hard lockout**. It refuses most requests, not all — which is also why the
  duplicate-signature probe got 1,460 of 1,500 motions while the pilot beside it was drawing 429s;
* a **single-probe readiness test is worthless here**, and mine reported "CLEARED at 04:39:43" with
  twenty-three minutes of the window left to run. Readiness is now **five consecutive 200s**;
* ⚠ **and this is explicitly not a workaround.** That one client got through where another did not is
  a fact about the limiter's internals; swapping HTTP client to get past a mitigation a public service
  has deliberately applied to us would be circumventing it. `probe-edm-client-difference.ts` exists to
  establish what is true, once, and says in its own header that it is not used by the sweep. **The
  sweep's answer to a rate limit is to stay under it.**

⚠ **AND THE PROBE WRITTEN TO MEASURE THE SAFE RATE COULD NOT MEASURE IT.**
`probe-edm-rate-limit.ts` ran five concurrency/gap settings, every one drew 429, and its verdict was
*"every setting drew a 429; the sweep needs a backoff rather than a rate"*. That verdict is true and
says **nothing whatever about concurrency**: every setting also reported `Retry-After` counting down
to the **same instant**, which means one lockout was already in force before the first setting ran.
It measured one lockout five times. It is recorded here rather than quietly deleted because the number
a broken measurement produces is the number that ends up in a report.

**What the sweep does about it.** `sweep-edm-signatures.ts` now carries an AbortController timeout on
every request, honours `Retry-After` **in full** (a cap means walking back into an unexpired
mitigation, drawing another 429, and busy-waiting through an hour instead of sleeping through it) on
**one brake shared by every worker**, and paces itself: it starts slow, speeds up only while nothing
has objected, and **the first 429 stops it speeding up permanently for the rest of the run.**
Textbook additive-increase / multiplicative-decrease would trip an hour-long penalty periodically by
design; this converges and then holds.

⚠⚠ **AND TWO BUGS IN THAT CONTROLLER WERE CAUGHT BY WATCHING IT RUN, BOTH OF WHICH WOULD HAVE COST
HOURS WHILE LOOKING LIKE NOTHING AT ALL.** Neither was a crash. Both are the same shape: a slowdown
applied for a reason that was not evidence about this run's pace.

1. **The slowdown was per worker, not per mitigation.** Both workers hit the same active mitigation
   within milliseconds, each called the throttle handler, and each doubled the *shared* gap:
   **400 → 800 → 1,600 ms from ONE rate objection.** Two workers at 1,600 ms is 1.2 requests a second
   — a four-hour sweep becomes a fourteen-hour one, and nothing looks broken, only slow. A concurrent
   429 inside a mitigation already in force is the same event; only one that pushes the wake instant
   forward is new information.
2. **A resume was punished for the mitigation it walked into.** The sweep is restarted after every
   kill (§4's own reason), and a restart's first requests land inside whatever mitigation the previous
   run left behind. Halving the pace on that basis halves it again on the next restart, and again —
   compounding on the strength of somebody else's mistake. A 429 drawn before **50 successful requests
   this run** now sleeps in full but does **not** slow the run down: this process has sent almost
   nothing and cannot be the cause. The distinction is printed, so a run that declines to slow down
   says why.

⚠⚠ **AND THE THIRD FAILURE WAS MINE, NOT THE CODE'S: FOUR SWEEPS WERE RUNNING AT ONCE.** I restarted
the sweep three times to apply controller fixes, each time with `pkill -f "sweep-edm-signatures"` from
Git Bash first — and **`pkill` from Git Bash does not kill Windows processes.** It reported nothing and
killed nothing. `Get-CimInstance Win32_Process` found **four live sweeps**, three at `--gap 400` and
one at `--gap 250`, i.e. eight concurrent workers against a limiter I had just written a comment
insisting must never see more than two.

Three consequences, and the middle one is the reason this is in the report rather than in a commit
message:

1. it is fixed by killing on the right side of the boundary — `Get-CimInstance Win32_Process | Where
   CommandLine -match …` then `Stop-Process`. A liveness check by *name* would not have found it
   either; the command line is what distinguishes four identical `node.exe` processes;
2. ⚠ **every throughput number I took while they were live is confounded, including the one I made a
   decision on.** "400 ms measured at 2.00 motions/s → 8.4 hours" was an aggregate across three
   sweeps, so it was not the per-process rate it was labelled as, and the change from 400 ms to 250 ms
   rests on a number that did not mean what I said it meant. The honest figure is the one taken after
   the duplicates were killed: **one sweep, 4.06 motions/s over a 60-second window, 0 × 429, ETA
   4.1 hours**;
3. ⚠ and it is accidental evidence about the limiter that I would not have gathered deliberately:
   **four sweeps — roughly 13 requests a second — ran for several minutes and drew no 429 at all.**
   That is consistent with the 12 req/s the duplicate-signature probe sustained over 1,460 motions,
   and it means the safe band is wide and 4 req/s is not close to its edge.

**What it does about being killed.** Three of this sprint's background tasks were stopped at once with
*"the system is running low on memory"* — and the twelve largest consumers on the machine were
unrelated processes, so this is a condition to survive rather than a fault to fix.
`run-edm-sweep.sh` restarts the sweep until the work is done, and **its loop condition is the database,
not the exit code**: a clean exit is also what a completed pass looks like when a kill left work
behind, so it asks how many motions still have no status-200 row and stops only at zero. The first
version of the chain was worse than the thing it replaced — it ran the priority motions as a separate
`--motions` invocation with a poller between, which meant **two processes with two independent brakes,
each politely backing off while together doubling the rate the limiter was measuring**, and a fresh
`tsx` spawned every minute on a machine already short of memory. `--first` orders the work list inside
one process instead.

**What that means in wall-clock — and the whole fear turned out to be unfounded at the right pace.**
The completed sweep:

```
elapsed                 219.1 min   (4.5 motions/s, concurrency 2)
HTTP                    200 x 59,596
429s drawn              0
retries spent           0
requests that timed out 0
motions that FAILED     0
final gap               120 ms/worker  (the floor; never throttled, still improving when it finished)
```

**Zero 429s across 59,596 requests.** The pace started at 250 ms/worker and self-tuned down to the
120 ms floor without the limiter ever objecting — so the hour-long penalty that dominated this
section's design never once fired in the run it was designed for. The three data points that bound the
safe band are now: **35 req/s trips immediately, 12 req/s ran 1,460 motions clean, ~13 req/s (four
accidental concurrent sweeps) ran several minutes clean, and 4.5 req/s ran the entire corpus clean.**

⚠ The one cost that did land was the **pre-existing** mitigation the run started inside: it slept
11 minutes at the beginning, and the `SLOWDOWN_AFTER_OK` rule is what stopped that sleep from also
halving the pace for the following 3½ hours.

---

## 5 — WHAT THIS DOES NOT DO

* ⚠ **A signature is a position on the motion, not on a user's proposal.** Nothing here changes that;
  the target of every signal written is the motion.
* **No new scoring and no new weights.** The estimates remain unvalidated and the coverage statement
  still says so — there is no `position_answer_key` table and the probe for it still comes back empty.
* **The 119 motions tabled since the last EDM ingest are not swept.** We hold no `corpus_sections`
  row to evidence them, so an edge for one would be a claim we cannot show. That is the EDM corpus
  ingest's gap, not this sprint's.
* **Signatures on the 258 motions we hold in `edm_sponsor` but not in `corpus_sections` produce no
  signal**, for the same reason and by the same rule 2D-2 applied.
* **The 15 members with no `graph_entity` row get no signal.** A synthetic actor is forbidden; the
  count is reported instead.
* **Withdrawn signatures produce no signal.** They are stored, dated and counted. A member who took
  their name off a motion does not hold the position the signature would assert, and inventing an
  opposing signal from a withdrawal would be worse than either.
* **`sponsoring_order` beyond `<> 1` is not interpreted.** 99999 is a sentinel and Parliament's own
  page warns that historical motions may have lost their ordering ("in which case signatories are
  listed alphabetically").

---

## 6 — DECISIONS FOR CHARLIE

### Decision 1 — the sweep takes hours, not minutes. Which shape do you want?

The publisher's limiter (§4) is the binding constraint. The sweep is resumable by construction —
`edm_signatory_fetch` is the resume key and a re-run costs nothing for a motion already answered —
so this is a choice about wall-clock and attention, not about correctness.

| | what happens | consequence |
| --- | --- | --- |
| **(a) run it to completion, unattended** *(recommended, and what has been done)* | **it did**: 4.5 motions/s, 3 h 39 min, **0 × 429** over 59,596 requests | the whole layer lands. No model spend. Each 429 costs an hour of sleeping, which the controller absorbs rather than fighting |
| (b) stop at a partial load | the work list is ordered by `md5(motion_id)`, so a partial load is an **unbiased sample of the corpus**, not a recent slice | a percentage of motions carry their signatures and the rest still show one actor. Reportable honestly, but the surface is then inconsistent between two ideas for no reason a user can see |
| (c) ask Parliament to raise the limit | `oralquestionsandmotions-api.parliament.uk` publishes no key mechanism and no documented quota | would remove the constraint for every future re-sweep, including the weekly one a live product needs. Slow, and outside this sprint |

⚠ **Whatever you choose, (a) has to happen again.** A signature added tomorrow is a new fact, and
`sponsors_count` moving is how we would notice. There is no incremental route: the detail endpoint is
per motion, so a refresh of the last N months' motions is the only cheap version of this. That is a
sprint, not a decision to take now, but it is the reason (c) matters more than it looks.

### Decision 2 — ⚠ THE LOAD-BEARING ONE. Give sponsorship its own weight, or leave the two equal?

Brief §2 asks for distinct signal **types** with different weights. This sprint delivered distinct
**derivations** at the same weight, because the weight table is CC-Graph's and brief §5 forbids
editing it (§2.2). The two acts are distinguishable on every row, so this is reversible with one
statement — but until it is done, *the member who tabled a motion counts exactly as much as the
member who signed it*, which the design says is wrong.

**Recommended: yes, and with a number the design already contains rather than a new one.** In
`scrutinise-web/lib/graph/position-config.ts`:

```diff
 export type SignalType =
   | 'vote'
   | 'edm_signature'
+  // The member who TABLED the motion. A signature is 0.6; tabling is more than signing, and this
+  // is the design's own "active effort" number rather than a new one invented here.
+  | 'edm_sponsorship'
   | 'amendment_sponsorship'
@@ weights
     edm_signature: 0.6,
+    // [design §5, by analogy] `amendment_sponsorship` is "active effort" at 0.7 and tabling a motion
+    // is the same kind of act: the member wrote the thing others put their name to.
+    edm_sponsorship: 0.7,
@@ halfLifeYears
     edm_signature: 5,
+    // [design §5] "EDMs 5" — the same motion, so the same half-life.
+    edm_sponsorship: 5,
```

Then three consequences, all of which must land in the same change or the build breaks — which is
`position-coverage.ts` working exactly as designed:

1. `LAYER_WORDS` in `position-coverage.ts` is `Record<SignalType, …>` and **will not compile** without
   an `edm_sponsorship` entry. That is the guard, not a nuisance.
2. `build-position-estimates.ts`'s attention-ceiling assertion reads
   `NOT (signal_counts ?| ARRAY['vote','edm_signature'])` and must gain `'edm_sponsorship'`, or every
   actor whose only signal is a sponsorship is counted as attention-only and asserted below the 0.15
   ceiling — **the check fails loudly**, which is the right direction to be wrong in.
3. re-type the rows, which is one statement because the derivation already says which act each is:
   ```sql
   UPDATE position_signal_stored
      SET signal_type = 'edm_sponsorship',
          raw_weight  = position_raw_weight('edm_sponsorship', derivation)
    WHERE signal_type = 'edm_signature'
      AND derivation IN ('primary-sponsor:v1', 'primary-sponsor:v2');
   ```
   ⚠ Run `setup-3a.ts` FIRST so `position_raw_weight()` knows the new type — it is generated from the
   config, and a type the SQL does not know returns NULL, which the NOT NULL refuses. Loudly.

**If you leave it:** nothing is lost and nothing is wrong in the record — the derivation is stored, so
the distinction is intact and the re-weight is available any day. What is wrong is the *estimate*: a
motion's tabler and its 34 signatories contribute identically, so a member who wrote the motion reads
the same as a member who added their name to it four months later. Given every weight in that file is
provisional until the §8 validation set scores it, that may be an acceptable thing to leave until
there is something to measure it against — which is the honest argument for waiting.

### Decision 3 — the coverage statement now describes a limit that no longer exists

The count and the dates in the coverage statement move by themselves (they are a `GROUP BY` over
`position_signal_stored`). **The wording does not.** After this load the surface says:

> `edm_signature` — **Early Day Motions a member tabled** (*the sponsor only — we do not hold the
> members who signed them*)

which is now false, and false in the direction the brief calls out: describing a result as a limit.
`scrutinise-web/lib/graph/position-coverage.ts` is CC-Surface's, so here is the patch rather than the
edit:

```diff
   edm_signature: {
-    what: 'Early Day Motions a member tabled',
-    gloss: 'the sponsor only — we do not hold the members who signed them',
-    consequence: 'without the signatories, a motion shows the one member who tabled it and none '
-      + 'of the members who put their name to it, which is where a motion’s weight actually lies',
+    what: 'signatures members added to Early Day Motions',
+    gloss: 'unwhipped and costless to refuse, so deliberate — and dated to the day it was signed, '
+      + 'which is usually not the day the motion was tabled',
+    consequence: 'without it a motion shows only the member who tabled it, and not the members who '
+      + 'put their name to it, which is where a motion’s weight actually lies',
   },
```

⚠ And a second-order effect to decide with it. `graphEarliest` is **1989-11-21 and the EDM record is
what sets it**; every other window's "begins N years after the graph's earliest record" note is
computed against it. Correcting the sponsorship dates (§2.3) moves the earliest EDM date, so **those
notes recalculate on every other layer.** That is the file working as designed. It is still a change
to sentences on a user's screen that this sprint did not set out to make, and CC-Surface should see it
before a user does.

### Decision 4 — a withdrawn signature produces no signal. Confirm?

Built that way: withdrawn rows are stored, dated, counted, and excluded from the edge and the signal.
A member who took their name off a motion does not hold the position the signature would assert.

**Recommended: confirm.** The alternative worth naming is direction 0 (attention) — "this member
engaged with this motion and then withdrew" — which would make the act visible without asserting a
side. Against it: a withdrawal is the one act in this layer we cannot date properly (§1.6 — the API
returns the withdrawal date under `CreatedWhen`, so the signing date is gone), and an attention signal
whose date is the date the member *stopped* is a strange object.

⚠ Either way, **the design says a changed position is a finding and nothing in this sprint surfaces
one.** **14,680** withdrawn signatures are in the database and no screen mentions them. That is a
gap I am naming rather than closing, because "show the reader that somebody removed their name" is a
surface decision.

### Decision 5 — 110 members who signed motions have no `graph_entity` row, costing 45,004 signatures

Their signatures produce no signal: the design forbids a synthetic actor and a name match is refused
outright. They are older members (Mr Barry Jones, Lady Hermon, Sir Russell Johnston …) and the fix is
not in this sprint — `sweep-members.ts` builds `graph_member_register` from
`members-api.parliament.uk`, and whatever excluded them excluded them there.

**Recommended: leave it and report the number, which is what has been done.** **45,004 signatures of
2,126,171 — 2.1%** is a real but small hole, and closing it belongs with the member sweep where the cause is,
not here where the symptom is. ⚠ The symptom is not the layer.

### Decision 6 — should the estimate table be rebuilt at all?

It was rebuilt (brief §2 says so) and it now holds **4,307,442 rows at 1,092 MB** — up from 2,304,858, with `edm` (2,062,509) now second only to `division` (2,080,585). **Nothing in
production reads it** — re-established in §2.4, not inherited. `positions.ts` computes every number
live and reads `position_estimate_meta` for one string.

**Recommended: keep rebuilding it, and be aware of what it is for.** It costs **$0.40/month** and its
only readers are hand-run checks and reports. It earns that by being the thing a distribution can be
measured on without re-deriving two million estimates — `build-position-estimates.ts` asks its own
"is it a distribution?" question of the table on every build. But if storage ever needs cutting, this
table is the cheapest thing to drop, because it is the only object in the position graph that no user
path touches.

---

## 7 — HOW TO RE-RUN ANY OF IT

```
cd scripts/ingest

# audit (read-only, ~150 requests)
npx tsx position-graph/probe-edm-signatures.ts
npx tsx position-graph/audit-edm-signatures.ts --sample 150
npx tsx position-graph/probe-edm-dup-signatures.ts
npx tsx position-graph/probe-edm-quota.ts            # what kind of limit, and is there a bulk route

# schema
npx tsx position-graph/setup-edm-signatures.ts --dry-run
npx tsx position-graph/setup-edm-signatures.ts

# load (resumable; the fetch table is the resume key)
npx tsx position-graph/sweep-edm-signatures.ts --pilot 400          # measure, write nothing
npx tsx position-graph/sweep-edm-signatures.ts --apply --motions <ids>
npx tsx position-graph/sweep-edm-signatures.ts --apply

# signals, then estimates (in that order — brief §2: recompute AFTER loading)
npx tsx position-graph/derive-edm-signature-signals.ts             # dry run
npx tsx position-graph/derive-edm-signature-signals.ts --apply --fix-sponsor-dates
cd ../graph && npx tsx build-position-estimates.ts

# assertions — run the self-test first, it plants counter-examples
cd ../ingest
npx tsx position-graph/verify-edm-signatures.ts --self-test
npx tsx position-graph/verify-edm-signatures.ts
npx tsx position-graph/handcheck-edm-signatures.ts                 # the §3 sheet

# the surface, before and after
cd ../../scrutinise-web
tsx --env-file=.env scripts/probe-edm-idea-targets.ts
tsx --env-file=.env scripts/probe-edm-coverage-statement.ts
```
