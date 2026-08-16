# V38 — WHAT IS THE STORAGE LIMIT, AND WHAT IS THE STORAGE FOR?

**Executes:** `docs/BRIEF_INGEST_V38_STORAGE.md`
**Written:** 2026-08-16
**Code:** `scripts/ingest/v38-*.ts`
**Nothing was dropped, vacuumed, rewritten or re-labelled.** Every script in this sprint is
read-only except `v38-index-usage-snapshot.ts`, which creates one small table and inserts into it.

---

## §1 — THE LIMIT. THIS IS THE WHOLE SPRINT.

### 1.1 What Neon actually enforces

Read from the enforcement mechanism itself, not from a figure about it. Neon's compute carries the
project storage ceiling as a GUC, and it is the thing that fails writes when exceeded:

```
neon.max_cluster_size = 16777216 MB   [configuration file]
                      = 16,384 GiB    = 16 TiB
```

Independently corroborated against Neon's published plan documentation (fetched 2026-08-16): the
Launch plan states **"16 TB per branch"** and **no hard storage cap** — storage is billed as usage
at **$0.35/GB-month**. The plan that *does* block writes is Free ("operations that increase storage
fail until you free space or upgrade"), and we are not on it.

**Current usage: 16.58 GiB. That is 0.10% of the enforced ceiling.**

⚠ Two things I could not read from here, labelled rather than inferred (`docs/CLAUDE.md` §19):
there is **no `NEON_API_KEY` in this environment**, so the billing page and any console-side soft
limit are unreadable; and Neon bills and limits per **project**, across all branches, while
`pg_database_size` sees one branch. If other branches exist, project usage is higher than 16.58 GiB
and only the console can say.

### 1.2 Where 17.5 GiB came from

**It was an alert threshold, and the original author labelled it correctly.** The degradation is in
the label, not the number:

| where | what it says | what it is |
|---|---|---|
| `docs/GRAPH_TIER1_REPORT.md` (5 Jul) | "17.5 GB **alert line**" | ✅ accurate |
| `search/serve-observer.ts` | `NEON_CEILING_GB = 17.5`, comment: *"The handoff records the storage line at ~17.5 GB"* | took it from the handoff |
| `docs/V26_LEGACY_DROP_RECHECK.md` | "15.93 GB of a 17.5 GB **ceiling** (91%)" | alert line → ceiling |
| `handoff_summary.md` | "Neon is at 15.93 GB of the 17.5 GB ceiling — 91%" | **emitted by serve-observer** |
| `position-graph/schema-2d2.sql` (2D-2, mine) | "0.93 GiB of headroom… **2.4× the space that exists**" | ceiling → wall |

⚠ **The chain is circular and has no external anchor.** `serve-observer.ts` sources 17.5 from the
handoff; the handoff's 91% alert is produced by `serve-observer.ts`. Neither end touches Neon.

Two further pieces of evidence that the answer was already in the repository:

- `shared/progress-reporter.ts` uses a **different** number — `DB_LIMIT_GB = 20` — with a comment
  that already states the truth: *"display only — Neon bills per-GB; **any hard limit is
  console-side**"*.
- `docs/Archive/SPRINT_V18_BRIEF.md` §7 recorded, as Charlie's action: *"check Project →
  Settings/Billing for any configured storage limit; if one exists, raise to 20GB. **If none exists,
  nothing to do — billing is per-GB automatically.**"* Nobody recorded which it was, and the
  question went unanswered for two months while a number invented downstream hardened into a wall.

**So: two unsourced and mutually inconsistent "limits" (17.5 and 20) coexisted in the codebase, and
the one that won was the one that appeared in an alert email.**

### 1.3 What it costs

At the verified $0.35/GB-month against 17.81 GB (decimal):

| | GB | per month | per year |
|---|---|---|---|
| now | 17.81 | **$6.23** | $74.78 |
| if the corpus doubles | 35.61 | $12.46 | $149.57 |

### 1.4 What this did to 2D-2

2D-2 declined to materialise 2,528,032 `voted` edges because they would cost 2.21 GiB against
"0.93 GiB of headroom". Priced against the real ceiling:

- 2.21 GiB would have taken the database to **18.79 GiB — 0.11% of the 16 TiB branch limit**
- it **would have fit**, with a factor of roughly 870 to spare
- it would have cost **$0.83/month**

⚠ **The design decision was made against a constraint nobody had verified, and the constraint was
mine.** I read 17.5 out of the handoff and wrote "2.4× the space that exists" into a schema comment
as though it were a fact about the platform.

**Whether the view was still the better call is a separate question, and I think it was** — a view
over `division_votes` cannot drift from `division_votes`, and 193 B/row beats 584 B/row for the same
fact. But that is an argument I did not make at the time. What I wrote was that it would not fit.
*The right answer for the wrong reason is still the wrong reason*, and the next design that meets
this number should meet it as "$0.83/month" and not as a wall.

---

## §2 — RECLAIM: MEASURED, AND ALMOST ENTIRELY NOT WORTH DOING

### 2.1 Where the space is

| table | total | heap | indexes | TOAST | cost |
|---|---|---|---|---|---|
| **corpus_sections** | **12.54 GiB** | 8.53 | 2.13 | 1.88 | $4.71/mo |
| LegislationSection | 1.67 GiB | 0.96 | 0.30 | 0.41 | $0.63/mo |
| legislation_edges | 0.92 GiB | 0.44 | 0.48 | — | $0.34/mo |
| division_votes | 0.44 GiB | 0.24 | 0.20 | — | $0.17/mo |
| everything else | ~1.0 GiB | | | | ~$0.38/mo |

`corpus_sections` is **76% of the database**.

### 2.2 Is the body text in the database? — **No, and that work is already done**

`corpus_sections` has **no body-text column at all**. Measured per column on a 50k sample:

| column | avg | fill | projected | |
|---|---|---|---|---|
| `sourceUrl` | 145 B | 100% | **2.50 GiB** | the single largest column |
| `sectionTitle` | 57 B | 96.8% | 0.96 GiB | |
| `r2Key` | 55 B | 99.4% | 0.94 GiB | the pointer that replaced the text |
| `id` | 33 B | 100% | 0.57 GiB | |
| `xmlPreview` | — | **0%** | ~0 | already emptied |
| `ftsVector` | — | **~0.02%** | ~0 | effectively unpopulated |
| **sum of columns** | | | **6.16 GiB** | against 10.41 GiB heap+TOAST |

⚠ **A number I nearly published: the first version of this projection multiplied a NON-NULL average
by ALL rows**, because `AVG` ignores nulls. It put `ftsVector` at **42 GiB inside a 16 GiB
database** and `notes` at 5 GiB on two non-null rows. Both were obviously wrong, which is the only
reason they were caught — a subtler version of the same bug would have shipped.

The remaining ~246 B/row is the tuple header, alignment padding and free space. **It is not
reclaimable by dropping any column**, so §2's step 3 (drop a column, full-table rewrite of 12.5 GiB)
would return approximately nothing. Not done.

`LegislationSection.originalText` **is** real body text in the database — 591 B/row, non-null on
20,000/20,000 sampled. That is the 1.67 GiB, and §4.1 is why it cannot go yet.

### 2.3 Indexes with no reader — **BLOCKED ON EVIDENCE, and that is the finding**

342 indexes; 203 report zero scans and do not back a PK or constraint; **0.64 GiB — $0.24/month**.

**None of them may be dropped, because the evidence does not exist:**

- `pg_stat_database.stats_reset` is **NULL** — no recorded window at all
- the compute had been up **2 minutes 22 seconds** when measured (Neon autosuspends)
- a **positive control** over eight indexes this machine is known to have driven came back **6 of 8**
  — two known-used indexes read zero

So "203 unused indexes" describes a window of unknown length that certainly contains this session's
own read-only probes and possibly nothing else. **Dropping on that would be this brief's own error
repeated inside the sprint written to correct it**, and $0.24/month does not buy a guess.

▶ **Built instead: `v38-index-usage-snapshot.ts`** and an `index_usage_snapshots` table. It records
`idx_scan` per index per run *with the postmaster start time*, so a counter that reset can be told
apart from an index nobody used, and the **delta between two runs is a real measurement over a known
interval** regardless of what the absolute counter means. One snapshot is taken; the script says
plainly that one snapshot proves nothing. **Follow-up not done: wire it into `ops.ts`'s hourly pass**
— that file is shared and another thread is editing this tree.

### 2.4 Ordinary maintenance — **nothing to return**

**No table carries more than 10,000 dead tuples.** Predicted reclaim: zero. Not run.

⚠ And the prediction §2 asks for would have been wrong in a specific way worth recording: dead
tuples are space **autovacuum already reuses**. A plain `VACUUM` does not return them to the OS and
would not have moved the billed figure at all; only `VACUUM FULL`/`pg_repack` does, and that
rewrites the table. "Expected 800 MB, got 40 MB" usually starts here.

### 2.5 §2's verdict

**The reclaim available is ~0.64 GiB of maybe-dead indexes worth $0.24/month, and it is blocked on
evidence.** Everything else measured to approximately zero. Against a $6.23/month bill and a ceiling
we occupy 0.10% of, **§2 is not worth doing at all right now** — which is only knowable because it
was measured.

---

## §3 — THE COST QUESTION

- **Now:** 17.81 GB → **$6.23/month**, ~$75/year.
- **If the corpus doubles:** ~$12.46/month, ~$150/year.
- **Every reclaim identified in §2 put together:** under $0.30/month.
- **The 2D-2 edges, had they been materialised:** $0.83/month.

**Storage is not a constraint on this platform at this size, and it is not close to being one.** At
$0.35/GB-month the corpus could grow **twenty-fold** and cost ~$125/month.

On the Scale tier: the documentation shows the same $0.35/GB-month storage rate, so **there is no
storage reason to move**. What Scale adds is support and uptime commitments. ⚠ I cannot read the
account's current plan or its billing from here (no API key) — **the figures above are Charlie's to
confirm against the console**, and the decision is a business one about support, not a technical one
about space.

---

## §4 — THE QUEUE

### 4.1 The sections held only in the legacy table — **CENSUS, replacing the extrapolation**

S3 reported *"roughly 23,000"*, extrapolated from a random n=400. This project has been caught twice
by that gap (V36's hand-picked pilot said 6/6 until a random draw said 27.5%; the 400-sample
dot-leader rate said 9.75% and the census said 11.44%), and this number decides whether 1.67 GiB can
be dropped. So it was counted.

| | provisions | |
|---|---|---|
| legacy provisions in instruments the corpus is short on | 79,495 | |
| ── dot-leader placeholders | 5,307 | 6.7% — not text we would lose |
| ── no usable title | 7,825 | 9.8% — cannot be judged either way |
| ── covered in place, same instrument | 11,593 | 14.6% |
| ── found elsewhere (S3's amendment-target case) | 11,518 | 14.5% |
| ── ⚠ matched only on an undiscriminating title | 4,845 | 6.1% — the uncertainty band |
| ── ⚠⚠ **HELD ONLY IN THE LEGACY TABLE** | **38,407** | **48.3%** |

**38,407, with a band to 43,252 — against S3's ~23,000. The extrapolation was 67% low.**

⚠ **My first run said 47,427 and was wrong, for the exact reason S3 had already documented.**
`LegislationItem` carries the **calendar** id by design; the corpus holds pre-1963 Acts under the
**regnal** id. Without resolving that, the census reported the Law of Property Act 1925 as 218
legacy sections against **0** in the corpus — and it is in the corpus, as `ukpga/Geo5/15-16/20`.
Applying V36's own alias map (14,294 pairs) moved **1,406 instruments** out of "short". I wrote the
bug S3 had already fixed, because I did not read their fix before writing mine.

**The class is now confirmed at population scale rather than by sample** — the work list is
dominated by amending instruments whose own provisions the corpus holds incompletely:
`uksi/2010/686` Insolvency (Amendment) Rules 2010 (590 legacy / 580 corpus / **523 orphans**),
`uksi/2019/459` Air Traffic Management (307), `uksi/2019/775` Human Medicines (269),
`uksi/2013/262` Civil Procedure (Amendment) Rules (91). Full list in
`scripts/ingest/v38-orphan-census.json`.

**`LegislationSection` DROP: still blocked, and by a bigger number than we thought.** Re-ingesting
these instruments is a V39-scale drain and was not attempted; the work list now exists to seed it.

⚠ **For CC-Search: `s3-drop-readiness.ts` will throw at its VERDICT block.** It references
`absentRegnal`, which is never defined (`tsc` reports it twice). Their lane, flagged not fixed.

### 4.2 The 117,667 `pdf-only` rows — **the label is false, confirmed independently**

117,667 rows, all `pending`, oldest 2026-06-08, across `retained-eu` (89,129), `regional` (11,390),
`si-2010plus` (10,205), `primary-acts-pre-2000` (6,938), `si-pre-2010` (5).

A fresh random draw of 60, tested with **GET** (the original classification used HEAD, which TNA
answers `405` on `data.pdf` — so it could never have found a PDF):

- **0 serve a PDF. 60 of 60 return 404.**

With the prior 0 of 52, that is **0 of 112 on two independent random draws**. The classification is
false and the rows should not keep it.

⚠ **Not re-labelled here, deliberately.** The absence of a PDF says what these rows are *not*; it
does not say what they *are*. Rewriting 117,667 labels to a replacement chosen by elimination would
put a second unevidenced classification where the first one was. The replacement needs its own
positive test — that is the next sprint's first task, and it is now cheap because the population and
the negative are both established.

### 4.3 The ~288 broken R2 keys — **the suspicion is mostly refuted**

The V36 addendum recorded a suspicion: *"many of the broken keys end `schedule-N-paragraph-` with an
empty trailing component, which looks like a section-ref bug rather than lost objects — unconfirmed,
and stated as a suspicion rather than a finding."*

Settled in SQL, without touching R2 — a key with an empty trailing component is malformed by
construction. Of 18,272,501 sections carrying a key:

| shape | count |
|---|---|
| `…/paragraph-/…` empty component | 42 |
| `//` empty path component | 1 |
| key ending in a bare `-` | 0 |
| **total malformed by shape** | **43** |

Spread across `regional` (23), `si-2010plus` (7), `si-pre-2010` (5), `primary-acts-2000plus` (4),
`primary-acts-pre-2000` (3), `lda-lordsdivisions` (1).

**43, not ~288.** So the section-ref bug is real and accounts for roughly 15% of the unreachable
population — **the other ~245 have a second cause that is still unidentified** and needs an R2 probe
to characterise. Recorded as a partial refutation rather than carried forward as an explanation.

---

## §5 — WHAT IS OPEN

1. **⚠ CHARLIE — confirm the plan and billing from the console.** Everything in §3 rests on the
   Launch rate; the API key is absent here and the figure is the brief's, not one I read.
2. **⚠ Retire or re-source the 17.5 figure.** `serve-observer.ts` still alerts against it and
   `progress-reporter.ts` still uses 20. Neither is sourced. An alert threshold is a fine thing to
   have — it should just be a **cost** threshold with a stated owner, not a phantom ceiling.
3. **CC-Ingest — the 38,407.** Re-ingest the amending instruments' own provisions. Work list in
   `v38-orphan-census.json`. This is the last thing blocking a 1.67 GiB drop, though on §1's
   evidence that drop is now worth **$0.63/month**, which is a reason to do it carefully rather than
   soon.
4. **CC-Ingest — find the positive test for the 117,667**, then re-label.
5. **CC-Ingest — characterise the other ~245 broken keys.** 43 are a ref bug; the rest are unknown.
6. **CC-Search — `s3-drop-readiness.ts` throws at its verdict** (`absentRegnal` undefined).
7. **Run `v38-index-usage-snapshot.ts` again in a week**, and wire it into `ops.ts`. Until there are
   two snapshots over a real interval, no index may be dropped.
8. **⚠ `index_usage_snapshots` has NO Prisma model, so `prisma migrate diff` will propose dropping
   it.** That is the same trap 2D-1 and 2D-2 added models to avoid. It was left undone on purpose:
   `schema.prisma` currently carries the LEX thread's uncommitted §19-E work, and adding my model
   would have swept their work in progress into this sprint's commit. **Whoever next touches
   `schema.prisma` should add it** — the table is `CREATE TABLE IF NOT EXISTS`, so a drop is
   recoverable, but the series it holds would be lost and the series is the entire point.
