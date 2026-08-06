# SPRINT — vector wired into the LEGISLATION stream (re-issued 2026-08-06)

> **Provenance note.** This brief was handed over in conversation twice and did not reach disk
> either time — the exact failure mode `SEARCH_STRATEGY v3` §1.8 names as a standing rule
> ("a sprint brief handed over verbally is a sprint brief that can be lost"). CC has written it
> here from Charlie's 6 Aug re-issue, cross-checked against `SEARCH_STRATEGY v3` §12
> ("Immediate next steps", refreshed 6 Aug), which independently states items 1–4 below.
> **Charlie: correct anything mis-stated — the bracketed original detail is summarised, not quoted.**

## Goal

Wire vector search into the **legislation stream only** (`tier='legislation'`). Audit, build and
scoping-confirmation land now. **The full gold-set measurement is deliberately HELD.**

## Why measurement is held (not forgotten)

The index has changed **twice** since any prior baseline was drawn:

1. the coverage fix (4 Aug — 1,191,345 un-indexed rows merged, `unindexed=0`), and
2. the dedup/orphan removal (5 Aug — 19,161 rows removed, which changed BM25 **document
   frequencies** and therefore ranking for every query).

So every number in `VECTOR_FULL_RECONFIRM.md` (fusion weight 0.7, vector-alone 70.5%, fused 71.2%)
was measured against an index that no longer exists. Re-baselining now would only have to be done
again once Charlie's answer-key validation pass lands. **Nothing measured before that pass is
trustworthy** — `SEARCH_STRATEGY v3` §12.1 marks it "now genuinely urgent" for this reason.

## Scope — in

1. **Audit the router's per-stream dispatch.** How a query is routed to a stream today, and where a
   per-stream retrieval strategy can be attached without disturbing the other streams.
2. **Design the flag scope.** Config-driven, flag-gated, **default OFF** (§1.7). The flag must be
   able to say "vector on, for legislation, only" — not "vector on".
3. **Build BM25+vector fusion for legislation only.**
4. **Confirm the scoping holds** — prove the other streams are byte-identical with the flag on and
   off, so this cannot regress anything already serving users.
5. **`corpus_vec` orphan drift — audit its scale and FIX IT, in this same piece of work.**
   Confirmed by sampling on 5 Aug: ids deleted from `corpus_fts` still resolve in `corpus_vec` and
   `corpus_chunks`, so vector search can surface superseded content that keyword search no longer
   can. Audit it the way `fts-hygiene.ts` did for `corpus_fts` — exhaustiveness proof, full-row R2
   backup before deletion, dry-run then apply. Explicitly **not** a separate sprint (§12.3).

## Scope — out (this sprint)

- **The full gold-set comparison.** Held until the answer-key validation pass lands.
- **Re-sweeping the fusion weight.** Belongs with the measurement, not before it. Carry 0.7 forward
  as an unvalidated placeholder and say so wherever it appears.
- Any other stream. Legislation first, one at a time (§12.7).

## Acceptance

- Vector fusion serves the legislation stream behind a flag that is **OFF by default**.
- With the flag OFF, every stream returns exactly what it returns today — demonstrated, not assumed.
- With it ON, only the legislation stream's behaviour changes.
- `corpus_vec` / `corpus_chunks` reconcile against `corpus_sections` with a stated, exhaustive audit;
  drift removed, backed up first, index rebuilt if the deletion requires it.
- The held measurement is recorded as an explicit, named follow-up — not left implied.

## Standing constraints

- `docs/CLAUDE.md` §12 — no git mid-sprint; single `commit-all.sh` at the end.
- `docs/CLAUDE.md` §17 — index/embedding rebuilds are Heavy Job Runner work, never Railway.
- `INGEST_PLAYBOOK` §20 — rebuild after append **or deletion**, then restart `fts-serve`.
- Concurrent sessions are active on this repo (Lex/UX Sprint 2.5, stats). Touch search files only.
