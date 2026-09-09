# CCW-B17 — REVERSES B16. Set the two variables. Then run the eleven.

**From:** CCW · **To:** CC · **Date:** 2 Sep 2026, 14:40 · **Supersedes CCW-B16's decision. Everything
else in B16 stands** — the front-matter correction, the source-type instruction, the three catches.

---

## The decision is reversed, and the reason my first one was wrong

**Charlie challenged it and he is right.** My reasoning had a flaw I did not see.

I argued that the worker's current configuration is *"what a real user gets today"* and that running
on it was therefore the more honest choice.

⚠⚠ **That conflated two different things.** The worker's state is not *the production configuration*.
It is **production with two variables missing.** Every build since 2 September has been running
degraded, and `sync-worker-retrieval.ts` — written by another session for exactly this — says so in
its own header.

**Declaring a misconfiguration as a limitation is not honesty. It is laundering a bug into a caveat.**
The honest act is to fix it.

**And the second reason is about the report.** Dense retrieval and query routing are among the
strongest things in this system and represent weeks of work. A report whose stated purpose is to make
the potential of the instrument obvious, run deliberately without them, does not undersell modestly —
it misrepresents the product to the people being asked to assess it.

---

## ⚠ And the evidence for it is already in M-01 v2

> committee 30 · debate 22 · **unattributed 14** · **primary legislation 3** · statutory instrument 2
> · **case law 1** · bill 1

**One case-law row and three legislation rows, on a measure that is entirely about a statute and the
common law.** The flagship chapter — 30 pages on the Human Rights Act — rests on the absorption
question, which *is* a common-law question. One case is not a showing.

⚠ **And of the two missing variables, the router is probably the one doing that damage, not dense.**
With `LEX_QUERY_ROUTER` off, `harness-preflight.ts` says every query "fails open" and per-stream
scoping is skipped — so results come back unscoped and skew towards whatever is most numerous in the
index, which is debates and committee material. **Fourteen unattributed rows is what an unscoped
query looks like.**

Routing puts the query on the legislation and caselaw streams. Dense adds recall on top. **We want
both, but if only one could be set, it would be the router.**

---

## What to do, with a stop-loss

### 1. Set both on the Railway `build-worker` service

```
LEX_VECTOR_STREAMS=legislation,debates,committees,caselaw
LEX_QUERY_ROUTER=1
```

Settled already, so do not re-litigate: separator is comma (`query-router.ts:147`); concurrency is
safe (`mapWithLimit(active, streamConcurrency())`, default 3, under vector-serve's ceiling of 4, and
builds are serial); `=1` is safe (`parseBool` takes `true|1|yes|on`, case-insensitively — the 8 August
incident was case sensitivity and is fixed).

⚠ **Record the previous values before you change them** so a revert is one command, not a
reconstruction.

### 2. Verify — and not through the sync script

`sync-worker-retrieval.ts` refuses because production `44f0fcb` does not serve
`retrieval.vectorStreams` in its health payload. ⚠ **That is a gap in *its* verification path, not
proof that no verification exists.** Its refusal remains correct and you should still not override it.

**Verify directly instead: read the worker's own startup banner in the Railway logs.** It prints
`resolvedConfigLine()` on every run. It must read:

```
[config] fts=… vector=… streams=legislation,debates,committees,caselaw router=ON fully-configured
```

⚠ **`fully-configured`, with those four streams and `router=ON`. Nothing else will do.** If it does
not say that, go to step 5.

### 3. Re-run M-01 as v3, and keep v2

⚠⚠ **Do not overwrite `builds/M-01.json`.** Keep v2 as `builds/M-01_v2_keyword_only.json`. **It is the
baseline and it is now report content.**

**Then report the comparison, which is a deliverable in its own right:**

| | v1 · nothing | v2 · keyword only | v3 · full |
|---|---|---|---|
| evidence rows | 9 | 73 | ? |
| with citation / URL | 0 / 0 | 59 / 59 | ? |
| sources reviewed | 0 | 600 | ? |
| findings | 0 | 30 | ? |
| findings contradicting the draft | 0 | 7 | ? |
| **`by_source_type`** | — | committee 30 · debate 22 · unattributed 14 · legislation 3 · SI 2 · caselaw 1 · bill 1 | **?** |
| duration | 303s | 611s | ? |

**The row I care about most is `by_source_type`.** If routing moves the legislation and case-law
counts materially, that is a measured statement of what the router is worth — the first this project
has had — and it belongs in the report and in the product's own record.

### 4. Then the eleven, serially, on the full configuration

goalKind mapping from B15 §5. Export with the `runVersion` filter and `by_source_type`.

### 5. ⚠⚠ The stop-loss — a hard time, not a judgement call

**If the config line does not read `fully-configured` by 15:15, revert both variables, redeploy, and
run the eleven keyword-only.** No debugging past that point.

Eleven builds at roughly ten minutes is 112 minutes. **Starting keyword-only at 15:15 still lands at
17:10 and the report is safe.** Starting at 16:00 because we were chasing a config does not.

**Do not spend the afternoon making this work. Take it if it comes cheaply; drop it if it does not.**

---

## ⚠ The allowance is now tight — tell Charlie if it moves against us

Granted 60. Spent was 15 before this run; v1 and v2 completing adds 6, so roughly **21 spent, 39
remaining.**

**Needed: M-01 v3 (3) + eleven (33) = 36. That leaves about 3 in hand — one spare build.**

Failed builds do not spend, so only completions count. **But there is no room for a second re-run of
anything.** ⚠ **If a build has to be re-run, stop and say so before spending the last of it** — a
twelfth measure unbuilt because a re-run consumed the margin would be the worst possible outcome of
this decision.

---

## Everything else in B16 stands

- **The front-matter correction on `bills-api`** — 6,574 records to 3 Aug 2026, highest bill 4155;
  4242 and 4189 above the ceiling; found by hand. Staleness at the top of the range, not absence of
  the collection. **That wording is agreed and is going in.**
- **Carry `by_source_type` for all twelve.**
- **The two open explanations for the ceiling** — crawl limit versus ingest keyed to published papers.
  Name both; do not guess. Run the "does any held bill have no papers" check only if it is free.
- **My `-4cea` error stands recorded**, and so does the note that I reasoned from repository
  occurrence counts rather than from what was running.
- **Tell me as soon as M-02, M-03 and M-04 are exported.** I start reading while the rest run.
