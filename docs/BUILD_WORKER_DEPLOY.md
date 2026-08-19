# Deploying the build worker — AMENDMENT_25B §B

**Status: the worker is built, tested and NOT YET SWITCHED ON.** Two steps remain and
neither is code. Written 2026-08-19.

---

## Why this is a handover rather than a done thing

The worker itself is finished and proven: `npm run verify:build-worker` enqueues a build
through the same path the web request uses, spawns the worker as a **separate OS process**,
touches nothing while it runs, and finds the build DONE at 7/7 passes — **9 assertions, 0
failures**. That is the amendment's "start a build, close the tab, come back to a finished
proposal", tested the only way it can be: across a process boundary.

What I cannot do from this machine is the last two steps:

1. **Create the Railway service** — possible via the API, but it spends money on Charlie's
   account and a half-configured service crash-loops quietly. Recipe below; it is five
   minutes in the dashboard.
2. **Set `LEX_BUILD_DRIVER=worker` in Vercel** — **impossible from here.** The Vercel token
   authenticates (`GET /v2/user` → 200) and then 403s on every project-scoped endpoint with
   `"saml": true` in the body (docs/CLAUDE.md §19). Env vars are Charlie-only.

⚠ **Until step 2, builds run the old way and everything works.** `buildDriver()` defaults to
`client`, so the page drives the build pass-by-pass exactly as it did before. Nothing is
waiting on this; the worker simply is not in use yet.

---

## Step 1 — the Railway service

Project **miraculous-nature** (`68707c61-5c68-4f37-88fc-c301fd6b90e7`). Copy the shape of
the existing **Ingest** service, which is the same pattern:

| setting | value | why |
|---|---|---|
| source | `Scrutinise/scrutinise-prototype`, branch `Main` | same repo as every other service |
| **root directory** | **`scrutinise-web`** | ⚠ **load-bearing** — see below |
| build command | `npx prisma generate` | the worker needs the client, and nothing else |
| start command | `npm run build:worker` | `scripts/build-worker.ts` |
| replicas | **1** | see the concurrency note |

⚠ **The root directory must be `scrutinise-web`, not `scripts/`.** The build engine *is*
`lib/lex/*` — the search gateway, the field machine, the Prisma client, the whole Deepening
— and **`scripts/ingest` cannot import any of it.** SEARCH S7 §3 hit exactly this wall and
had to report a measurement it could not take because of it. Running the worker from inside
the web package is what makes "the same engine, a different driver" true rather than
aspirational, and it is why there is no second implementation of a build anywhere.

⚠ **Set the build command explicitly.** Left alone, Nixpacks sees a `build` script in
`package.json` and runs `next build` — several minutes of work the worker has no use for.

### Environment variables

Copy from Vercel's production set; these are the ones the worker actually reads:

```
DATABASE_URL=            # Neon pooled — the same one the web app uses
DIRECT_URL=              # Neon non-pooled
GEMINI_API_KEY=          # every pass
FTS_SEARCH_URL=          # ⚠ without this, retrieval FAILS on every question
VECTOR_SEARCH_URL=       # to match production retrieval
LEX_VECTOR_STREAMS=legislation,caselaw,guidance
RESEND_API_KEY=          # §C4's "email me when it's done"
NEXT_PUBLIC_APP_URL=https://www.scrutinise.org
LEX_BUILD_DRIVER=worker  # ⚠ on the WORKER too, or it warns and polls an empty queue
```

⚠ **`FTS_SEARCH_URL` is the one that fails quietly.** Without it every library question
returns `failed: true`, the pass correctly reports "the search did not complete" as a stated
gap, and the build finishes looking healthy while having researched nothing. That is not a
hypothetical — it is what the first local run of 25-B did, and the honesty paths are the
only reason it was obvious.

---

## Step 2 — flip the web app

Set `LEX_BUILD_DRIVER=worker` in **Vercel production** and redeploy.

That is the whole change. The web app then enqueues and returns in milliseconds; the client
is told which driver is in force by the state payload and stops driving passes itself.

---

## How to tell it worked

1. Start a build on `/ideas/build`. The "Build it" POST should return **immediately** rather
   than after the first pass.
2. The Railway service logs `[build-worker bw-xxxxxx] running build <id> for idea <id>`.
3. **Close the tab.** Come back a few minutes later: the build is finished.
4. The page says *"This runs on our servers — you can close this tab"* rather than *"Keep
   this tab open"*.

### If nothing picks it up

The page takes over by itself after 90 seconds (`WORKER_PICKUP_GRACE_MS`) and says so:

> ⚠ Our build server hasn't picked this up, so it's running from this page instead — please
> keep the tab open. It will still finish.

⚠ **That message is the diagnostic.** A build that hangs at "Starting" for ever is the
failure this architecture creates, and the fallback exists so the absence of a worker is
visible and survivable rather than silent. If you see it, the Railway service is down,
crash-looping, or missing `LEX_BUILD_DRIVER=worker`.

---

## The concurrency note, which is a real limit

§B: *"A build fires 10–20 searches and the vector service handles four at once. One build
must not saturate the search layer for everyone."*

Two things hold that line and only the second is a setting:

1. **A build is already serial inside itself.** The research pass asks its questions one at a
   time, and each question runs its intents one at a time — so one build is **at most one
   search in flight**. This is a property of the engine, and `check:build-25b` asserts it
   rather than trusting it.
2. **One replica, `LEX_BUILD_WORKER_CONCURRENCY=1`.** Two builds in parallel would be two
   concurrent searches, still inside the service's four — but four workers would not be, and
   the failure would land on **every user's search**, not on the build that caused it.

▶ **Raise `vector-serve`'s cap before you raise this.**
