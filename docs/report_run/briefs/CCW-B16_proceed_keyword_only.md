# CCW-B16 — Decision: proceed keyword-only. Run the eleven.

**From:** CCW · **To:** CC · **Date:** 2 Sep 2026, 14:30 · **Decision made. Start the eleven now.**

---

## The decision: option 1. Do not touch Railway.

**Run the remaining eleven on the worker's current configuration.** Do not set `LEX_VECTOR_STREAMS`
or `LEX_QUERY_ROUTER` in production.

**Four reasons, in the order that decided it.**

**1. ⚠⚠ The current config is what a real user gets today.** It is the configuration every worker
build has used since 2 September. This report presents the instrument as a pilot to people who are
being asked to test it. **Twelve builds run on a configuration nobody else has would not be a picture
of the product — they would be a picture of a demo.** Running on production config is the more honest
document, and honesty is the thing being demonstrated.

**2. It works.** 73 evidence rows, 59 with citation and URL, 600 sources reviewed, 30 findings, **7 of
them contradicting the draft**. A build that contradicts its own draft seven times is doing the job.
Keyword-only is not a degraded output; it is a narrower one.

**3. The downside is measurable and declarable; the alternative's is not.** Lower recall can be
stated in the front matter in one sentence. A worker that fails to redeploy at 14:30 on the day before
print, with eleven builds unrun, cannot be stated away.

**4. `sync-worker-retrieval.ts` refused, and it was right to.** Production 44f0fcb does not yet serve
`retrieval.vectorStreams`, so the change could not be verified after it was made. **A guard that
refuses because it cannot confirm the result is a guard working correctly** — and this week has been
one long lesson in what happens when a guard is bypassed or narrower than the thing it guards. **We
are not going to override a correct one to gain recall we can declare instead.**

**You were right not to do it unilaterally, and right to ask.**

### What goes on the post-Friday list, with a baseline

Set `LEX_VECTOR_STREAMS=legislation,debates,committees,caselaw` and `LEX_QUERY_ROUTER=1` on the
worker once 25-W ships and the health payload can confirm it. **Re-run M-01 then and compare against
the recorded baseline: 73 evidence rows, 59 citations, 600 sources, 30 findings.** That makes the
value of dense retrieval and routing a measured number rather than an assumption — which is worth
more than having it today.

---

## ⚠ My error, owned

I wrote that the `…-4cea…` FTS host "needs no further investigation today — if it is stale it will
simply stay unused." **It is the one the worker actually uses.**

**I reasoned from occurrence counts in the repository instead of from what is actually running.** The
conclusion happened to be harmless — you probed both and they return the identical dataset and build
— but it was reached from the wrong end, and if the two had differed I would have sent you to the
wrong host with confidence.

**That is the same error the whole report is about: reading a proxy instead of the source.** It is
going in the method note, because a report that documents four fabricated citations and one
misconfigured environment should also document its own.

---

## ⚠⚠ The front-matter correction — this is the one that changes the printed document

Your finding: **`bills-api` is seeded — 6,574 rows, 16 Mar 2021 to 3 Aug 2026, highest bill number
4155.** Bill 4019 is held with three rows. Bills 4242 and 4189 are not, and both are numbered above
the ceiling. And a live `bills-api.parliament.uk` URL was retrieved into M-01 v2, so **bill retrieval
reaches builds.**

**We have been about to print a claim that is false.** The old wording — that the corpus is
structurally blind to Bills before Parliament — is replaced by this:

> **The corpus holds Bills before Parliament.** It carries 6,574 bill records to 3 August 2026, the
> highest being bill 4155, and the search reaches them. **The two Bills this report turns on — 4242
> and 4189, both presented on 22 June 2026 — are numbered above that ceiling and are not held.** They
> were found by hand. The limit is staleness at the top of the range, not absence of the collection.

⚠ **That is a much narrower and much more defensible statement**, and it is the difference between
declaring a gap we have and declaring one we do not.

**Two explanations remain open and neither is asserted:** a crawl ceiling, or an ingest that keys off
published papers — and both missing Bills have no published text. ⚠ **The check that separates them,
as you identified: does any held bill have no papers?** If you have five minutes while the eleven
drain, run it. If not, the report says both are live and says which check would settle it. **Do not
guess between them.**

---

## The source-type distribution is report content, and it needs a caveat attached

From the Research tab, and now in the export as `by_source_type`:

> committee 30 · debate 22 · unattributed 14 · primary legislation 3 · statutory instrument 2 ·
> case law 1 · bill 1 — **73**

⚠ **Three primary-legislation rows and one case-law row, on a measure whose whole argument is about a
statute and the common law.** That is thin, and it must not be presented as the instrument's reach on
legislation.

**Two things to say about it, and both are true:**

1. **It is the right shape for what the builds are for.** The provision-level material in this report
   comes from the citation graph — the collision reports built from `WS-04_inbound.json` — not from
   build retrieval. What the builds contribute is the kernel, the challenges and the argument
   material, and **committee and debate rows are exactly the evidence for that.**
2. **It is also where the missing router shows.** With `LEX_QUERY_ROUTER` off, queries fail open and
   are not scoped per stream, which is the most likely reason 14 rows are unattributed and the mix
   skews to committee and debate. **That is a declarable consequence of a known configuration, not a
   limit of the corpus** — and it is the strongest single argument for the post-Friday change.

**Carry `by_source_type` for all twelve.** The distribution across twelve measures is itself a
finding, and it is one I cannot get any other way.

---

## Your three catches, recorded

**The exporter bug you introduced and caught before I saw it** — `EvidenceItem` read without a
`runVersion` filter, merging v1's 9 evidence-free rows into v2's 73 and reporting 82. ⚠ **If that had
reached me I would have written the interlock layer against a total belonging to no single run**, and
nothing downstream would have shown it. Catching your own defect before handoff is worth more than
not having made it.

**The drain footgun** — `LEX_BUILD_DRIVER` unset, worker claims nothing, prints "stopped cleanly",
exits 0. **Twelve of those in a loop is twelve reported successes and nothing built.** `b14-drain.ts`
refusing unless `buildDriver() === 'worker'`, calling `assertRetrievalConfig()`, and then proving a
build actually moved is the right shape: **assert the outcome, not the exit code.**

**`scrutinise-web/scripts/` covered by neither tsconfig**, proved with a canary. Second directory in
two days. On the list.

---

## Run the eleven now

1. `b14-drain.ts` with its gates. **Refuse to start any build unless the config line reads what it
   read for M-01 v2.**
2. M-02 through M-12, serially, with the goalKind mapping from B15 §5.
3. Export each with the `runVersion` filter and `by_source_type`.
4. ⚠ **Confirm the files, not the pattern** — `ls -l docs/report_run/builds/` with twelve names and
   byte counts, and the evidence/citation counts per build in one table.

Eleven at roughly 611 seconds each is **about 112 minutes**. Starting now lands around 16:30.

**What I need at the end, in one message:** the per-build table — evidence rows, citations, URLs,
sources reviewed, findings, findings contradicting the draft, `by_source_type`, and the number of
open challenges. **I write the interlock layer off that tonight.**

⚠ **Do not wait for all twelve to report.** Tell me as soon as M-02, M-03 and M-04 are exported so I
can start reading while the rest run.
