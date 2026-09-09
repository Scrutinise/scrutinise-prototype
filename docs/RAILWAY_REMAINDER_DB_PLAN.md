# RAILWAY REMAINDER — WHAT IS STILL THERE, WHY, AND HOW IT GETS TIDIED

**Written:** 12 August 2026, by CCh-Search, at Charlie's request.
**Purpose:** a standing answer to *"why is anything still in Railway?"* so it does not have to be
asked again. **CC updates this file** whenever a line changes; Charlie reads it to check nothing has
been quietly forgotten.
**Status:** the plan is agreed and nothing here is urgent. Do not act on it during the V36
legislation recovery.

---

## 1. The short version

Railway does three separate jobs for us and only one of them is a problem.

| what | why it is there | tidy-up needed |
|---|---|---|
| **`fts-serve`** — the keyword search service | It has to run somewhere; it is the search | None. Working as designed. |
| **`vector-serve`** — the semantic search service | Same | None, except the deploy quirk in §4 |
| **`Ops`** — the scheduler | Hourly monitoring, alerts, the daily digest | None |
| **A leftover PostgreSQL database (`scrutinise-db`)** | Historical. It was the original database before we moved to Neon | **Yes — §2** |
| **Two dead services (`fts-build`, `fts-pilot`)** | Superseded scaffolding; their start command is literally `true` | Trivial — delete when convenient |
| **A failed `Ingest` worker** | Dormant by design; last deploy failed and nobody noticed because nothing needed it | Fix or retire — §5 |

**So the answer to "why is anything still in Railway" is: because Railway is where our two search
services and our scheduler run, and that is correct.** The database is the only genuine remainder.

⚠ **And one clarification worth making, because it is the thing that caused the confusion.** The
legacy legislation tables that turned out to hold 77,000 sections of law we do not otherwise have —
`LegislationItem` and `LegislationSection` — are **not in Railway.** They are in **Neon**, our live
production database, sitting alongside everything else. They are "legacy" in the sense of being an
older design, not in the sense of being on old infrastructure. That is a separate problem from this
document and it is being handled by the V36 recovery.

---

## 2. The leftover database — the only real remainder

**What it is:** `scrutinise-db`, a PostgreSQL instance on Railway, roughly 1.98GB, last deployed
10 June 2026.

**Why it is there:** it was the project's original database. When the platform moved to Neon, the old
instance was left running rather than deleted, because nobody had confirmed what was in it.

**Why it is still there:** the same reason. It costs a small amount each month and nobody has been
willing to delete a database without proving first that nothing in it is unique.

**That is the right instinct and the wrong outcome.** The correct resolution is not "leave it
running indefinitely"; it is "prove it, archive it, delete it".

### The plan, in order

1. **Establish whether it is even reachable.** It may already be suspended. Check before planning
   around it.
2. **Audit it against Neon, table by table.** For every table: does it exist in Neon, and does it
   hold the same or more? **Compare row counts and sample contents, not just table names** — the
   V36 finding is precisely a case where the names matched and the contents did not.
3. **For anything unique, decide explicitly:** migrate it to Neon, or record why it is not worth
   keeping. Write the decision down here.
4. **Archive the whole thing to Cloudflare R2** with a database dump, and record the storage key in
   this file.
5. **Then delete the Railway instance**, and note the date here.

⚠ **Step 2 is the one that matters and the one most likely to be rushed.** "The table exists in Neon"
is not the same claim as "Neon holds everything this table holds". We have just spent a fortnight
learning that distinction the expensive way.

⚠ **Do not run this during the V36 legislation recovery.** Two threads writing to overlapping
database state is how the concurrent-session problems started.

---

## 3. The wider audit Charlie asked for

Charlie's question — *"do we need a proper audit of everything in Railway, checking each one is in
Neon or R2?"* — is the right one, and the honest answer is that it should be broader than Railway.

The completeness check being built for the corpus (comparing what we hold against what the source
says exists) is the same idea applied to a different question. This document covers the
infrastructure half:

- **Every Railway service:** what it does, whether anything depends on it, when it last ran
  successfully. `docs/RAILWAY_ROLE.md` already holds this and should be kept current rather than
  duplicated here.
- **Every database:** which is authoritative for what. Today that should be Neon for everything
  except object storage.
- **Every storage bucket:** what is in R2, and whether anything in it is referenced by a database
  row that no longer exists, or vice versa.

That last one has bitten before: the rule *"write to storage first, then record the reference"*
exists because a database row pointing at a missing file is a broken record with no error attached.

---

## 4. `vector-serve` does not auto-deploy, and nobody knows why

Recorded here because it is a live operational trap rather than a tidy-up.

Pushing to the repository deploys `fts-serve` and **creates no `vector-serve` deployment at all**.
It has to be redeployed explicitly. This was discovered on 11 August, after the service had been
serving four-day-old code without anyone noticing.

**Root cause not established.** Worth an hour: a service that silently ignores deployments is the
same failure class as a feature flag that never engages, and we have already lost a fortnight to one
of those.

---

## 5. The failed `Ingest` worker

Dormant by design — it starts on demand when the ingest queue has pending work and exits when the
queue empties. Its last deployment **failed**, on 30 June 2026.

Nothing has needed it since, which is why nobody noticed. **That also means the failure has never
been exercised**: we do not know whether the next ingest run would start it successfully.

Either fix it or retire it, but do not leave it in a state where "it will probably work" is the
strongest thing we can say. If V36 or a later ingest needs it, that is the moment it will matter.

---

## 6. What is definitely correct and needs no action

Worth stating so that "tidy up Railway" does not turn into removing things we depend on:

- **Heavy jobs do not run here and must not.** Index builds and large embedding runs go to
  temporary rented compute with far more memory, which is created, used and destroyed in one
  command. This is a standing rule with measured evidence behind it.
- **`fts-serve` and `vector-serve` staying on Railway is correct.** They are long-running services
  with modest memory needs, which is exactly what the platform is for.

---

## 7. Update log

*CC: append a dated line whenever any of the above changes. Do not rewrite history — this file is a
record as well as a plan.*

- **2026-08-12** — written. Nothing actioned yet. Agreed with Charlie that the remainder database
  stays until after the V36 legislation recovery.
