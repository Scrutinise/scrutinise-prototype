# BRIEF — INGEST V35: MAKE THE POLITICAL-EVIDENCE LAYER SEARCHABLE

**Owner:** CC-Ingest
**Stream:** INGEST
**Written:** 12 August 2026
**Follows:** V34 (`docs/V34_POLITICAL_SOURCES_REPORT.md`) — drained, 14,274/14,274 rows, 0 failures.

**Where this sits:**
- *Last:* V33 (vector delta embed + ANN rebuild) → V34 (divisions, impact assessments, consultations ingested)
- **This: V35 — index the V34 material so it can actually be retrieved**
- *Next:* Lords eligible-peer roll (for Lords absence); `stage_outcomes` population; gov.uk IA route overlap measurement

---

## §0 — Why this exists

V34 put **31,852 sections and 34.5M words** into `corpus_sections` and **not one of them is
retrievable**. They are absent from the FTS index and the vector index, and `corpus-map.ts` has no
entry for them, so `corpusToType` returns null and the adapter drops every row before any caller sees
it. That is precisely the UNREACHABLE condition Stage 2C spent three sprints clearing.

**Sequencing note, and it is the whole reason this is a separate brief:** the display typing is
CC-Search's decision, not yours, and it must land **before** the FTS build so the index carries the
right tier. Do not start §2 until CC-Search confirms the typing is committed. §1 can start now.

---

## §1 — The embed (start now, it is the long pole)

**~46M tokens**, per V34's own measurement — roughly two-thirds of it impact assessments.

- Run under the **V33 `--max-cost` ceiling mechanism**, as V34 recommended. Set the ceiling from the
  measured token count and the rate the V33 run established ($36.51 for 768,085 chunks), and
  **predict the cost in `CHANGE_LOG` before starting** so the actual can be scored against it.
- Chunk first, then embed, then reconcile — the V33 shape.
- ⚠ **Do not push mid-drain.** V34's own closing finding: a SIGTERM between `r2Put` and
  `upsertSection` left two consultations with an R2 object, no section row, and a `done` queue row.
  Both processors now require the object *and* the row, but the discipline stands regardless.

## §2 — The FTS index build (gated on CC-Search's typing)

Full or incremental as the tooling supports. Report row counts per corpus before and after.

## §3 — The ANN rebuild, and this one is easy to forget

**After the embed lands, the ANN index must be rebuilt and `vector-serve` restarted.** V33 established
both halves of this:

- Without the rebuild, every query brute-force scans the new fragments forever. V33 measured 768,085
  unindexed rows as **3.41% brute-forced per query**.
- Without the restart, `openTable()` is called once at boot and the service serves a stale snapshot.
  V33 found `vector-serve` pinned to a three-day-old snapshot containing none of the new work.

⚠ **And a fact discovered on 11 August that changes the mechanics: `vector-serve` does not
auto-deploy from GitHub.** The same push deployed `fts-serve` (SUCCESS) and created **no vector-serve
deployment at all**. It needs an explicit `vector-serve-run.ts redeploy`. Root cause is not
established; establishing it is worth an hour, because a service that silently ignores pushes is the
same failure class as a flag that never engaged.

Use `verify-vector-index.ts` — it reports indexed/unindexed and was proven able to fail.

## §4 — Report

Sections indexed per corpus, embed cost predicted versus actual, ANN unindexed count (expect 0),
`vector-serve` `/stats` before and after with `started_at` and `config.nprobes` quoted.

---

## §5 — Carried, not started

- **Lords absence** — needs the Members API eligible-peer roll. `absence_known = false` on all 3,284
  until then, which is the correct state.
- **`stage_outcomes`** — deliberately empty. Populating "passed without a division" needs a 30s/call
  Bills API stage crawl plus a fuzzy title match, and a fuzzy row there manufactures the false
  certainty the table exists to prevent.
- **gov.uk IA route + RPC opinions** (1,932 and 826 documents, licence-cleared) — no seeder. The
  `ukia` bulk route is strictly better and has now drained, so the overlap can finally be measured
  against something real. Worth doing after §1–§4.

## §6 — Two licence questions for Charlie, blocking nothing

Both recorded here so they do not get lost, neither needs answering to proceed:

1. **Public Whip is ODbL — share-alike.** It would be the first licence to attach an obligation to
   our *derived* database. Flagged in `licence-map.ts`, not ingested. Nothing depends on it: the
   parliamentary APIs already cover Commons 2016→ and Lords 1999→ under OPL v3.0. It only matters if
   we want the pre-2016 Commons backfill.
2. **ONSPD is OGL v3.0, but Northern Ireland "BT" postcodes need a separate Land & Property Services
   licence for commercial users.** Relevant to the constituency feature specifically, and worth
   noting that Charlie is in Lisburn — the first postcode anyone tests will be a BT one.

---

## Working rules

Unchanged. The three V34 earned again: **predict then measure**, **a clean `tsc` and a passing pilot
hide write-path bugs**, and **an R2 object does not prove a section row exists**.
