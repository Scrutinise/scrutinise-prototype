# CCW-B14b — Allowance, visibility, and the browser cross-check

**From:** CCW · **To:** CC · **Date:** 2 Sep 2026 · **Read alongside CCW-B14a.** Answers three
questions Charlie asked. All three checked against the code, not assumed.

---

## 1. Yes, the twelve will appear in Charlie's idea list — and that is what we want

`Idea` defaults, from the schema:

| Field | Default |
|---|---|
| `visibility` | **`PRIVATE`** |
| `status` | **`DRAFT`** |
| `stage` | **`STAGE_1`** |

`GET /api/ideas` lists by `creatorId`. So the twelve appear in **Charlie's own My Ideas list and
nowhere else** — not in any public listing, not visible to other pilot users, not published.

⚠ **Leave all three fields at their defaults.** Do not set `visibility`, do not advance `stage`, do
not touch `publication`. There is no reason to and every reason not to.

**And this is the cross-check Charlie asked for.** After M-01 completes he can open it in the browser
and read it beside `docs/report_run/builds/M-01.json`.

**Do this explicitly as a step, and report it:**

1. Open M-01 in the browser. Note what the interface shows for each of the eleven passes.
2. Diff that against the JSON export field by field.
3. **Report anything in the interface that is not in the export.** ⚠ That is the failure mode that
   matters — an exporter that silently drops a field looks like a complete file. §20: confirm the
   content, not that the file exists.
4. Report anything in the export that the interface does not show. That is not a fault, but I need to
   know it is there so I can use it.

---

## 2. Yes, it uses Charlie's cap — and there are two ways to raise it, only one of which is right

**Verified in `lib/lex/allowance.ts`:**

- The counter is **`IdeaBuild` rows with `status = 'DONE'`, per user, since `ALLOWANCE_EPOCH`
  (28 Aug 2026, 11:45 UTC)** — deliberately *not* `LlmSpend`, because build-stream spend rows carry
  no `userId`.
- `FULL_BUILD_THIRDS = 3`. **Twelve full builds = 36 thirds.** Default grant is 12.
- ⚠ **A build that fails does not spend the allowance.** Only `DONE` counts. So a failed run costs
  money but not credits.
- ⚠ **In-flight builds hold a reservation**, which is released if the build stops without completing.
  Another reason to drain serially rather than enqueue twelve at once.

### The two instruments, and the distinction matters

| | What it does | Right for this? |
|---|---|---|
| **`LEX_PILOT_ALLOWANCE_THIRDS` env var** | Raises the **default grant for every user who has no explicit grant** | ❌ **No.** Blunt — it hands 36 thirds to every other pilot tester as a side effect of one report run |
| **`PATCH /api/admin/allowance`** with the required note | Sets `buildAllowanceThirds` on **one named user**, with a recorded reason | ✔ **Yes.** Scoped to Charlie, and leaves a record of who decided and why |

**Recommendation: the admin grant, not the env var.**

### ⚠⚠ Two traps in that file, both of which will bite if ignored

1. **"A user with an explicit grant keeps it."** If Charlie's account already carries a
   `buildAllowanceNote`, **changing the env var will do nothing for him at all** and the run will
   block halfway with no obvious cause.
2. **You cannot tell an explicit grant from the number.** The column defaults to 4 in the database, so
   a user nobody has touched is indistinguishable *by value* from one an admin deliberately set to 4.
   **"Explicitly granted" is read off `buildAllowanceNote`, which nothing but the admin route
   writes.**

### So, before step 2 of B14a, report these four numbers

1. Charlie's `grantedThirds`, and **whether `buildAllowanceNote` is set** (the only reliable signal)
2. His `spentThirds` — DONE builds since 28 Aug 11:45 UTC. **This may already be non-zero**
3. `remainingThirds`
4. What M-01 actually cost, from `LlmSpend` / `check:cost-summary`

**Then Charlie decides the grant knowing the arithmetic.** He needs `granted − spent ≥ 36` before the
remaining eleven start, and if he has spent some already it is more than 36.

---

## 3. The four unsourced measures — include in the register, do not build

Charlie's decision: **include them, marked.** That means the **register**, not the build queue.

Restoring the Lord Chancellor · repealing the Climate Change Act 2008 / the Net Zero duty · abolishing
the Judicial Appointments Commission · removal of named judges.

They appear on a widely circulated third-party reading of the programme. **We hold no verbatim
statement of any of them across 287 transcripts.** They go into the register with column one reading
*"attributed to the proposer; not found in his own words in our corpus"* and column two giving our
reading of the legislation that would have to change.

⚠ **They do not get builds**, for two reasons. Four more full builds is another 12 thirds on top of
36, spent on measures the proposer may not hold. And a build states a diagnosis in the proposer's
name — doing that for something he is not recorded as saying would be the report making up his
position, which is the one thing it exists not to do.

**Register depth is the correct depth for an unsourced measure.** If Charlie confirms with Starkey
that any of the four is his, that one can be built afterwards.

---

## Reminder of the two pre-flights from B14a

1. **`LEX_BUILD_DRIVER` is not set in `.env` or `.env.local`** — the default is `client`, and enqueued
   builds will sit unclaimed. Force `process.env.LEX_BUILD_DRIVER = 'worker'` **before** importing
   `lib/lex/build`, exactly as `scripts/check-lex-25t-1b.ts:28` does on purpose.
2. **Add `builds/` to `docs/report_run/.gitignore`** before the first export lands. Verify with
   `find`, not `git check-ignore`.
