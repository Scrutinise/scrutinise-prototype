# SURFACE 1 — THE PLATFORM NOW SAYS WHEN A LAW IS NO LONGER IN FORCE

**Executes:** `docs/BRIEF_SURFACE_1_REPEAL.md` §1–§5
**Written:** 17 August 2026, 14:07 UTC
**Owner:** CC-Surface (new stream)
**Cost:** under $0.01 — four Gemini calls in the verification. No new data, no new retrieval, no new
inference, per §0.

⚠ **`docs/PLAN_SURFACING.md` does not exist.** The brief asks that §1 and §4 of it be read first.
The brief's own §0 is self-describing enough to work from, so this proceeded — but the plan should
either be written or the reference dropped.

---

## THE HEADLINE, AND IT IS NOT THE ONE I EXPECTED

**The labelling is built, wired into every surface that shows a legislation result, and into what Lex
reads — and the riskiest surface turned out not to be search.**

**A repealed provision is effectively unreachable through search.** Across **15 distinct queries** —
eight realistic user questions and seven searches for a repealed provision's *own exact title* —
**0 of 96 results carried a repeal record, and the target provision never appeared in the top 20.**

The exposure is instead on **`/legislation/[itemId]`**, which lists every compiled section of an Act
in full with no search step to rank anything out of the way. On the **Income and Corporation Taxes
Act 1988** that page lists 1,650 sections of which **1,335 are repealed** — and until today every one
of them appeared with its text, its citation and a working legislation.gov.uk link, and nothing to
say it was dead.

**That page is now labelled too.** It was not in the brief's list.

---

## §2 — The three states, each seen working on a real provision

`npm run verify:surface-1` — **15 checks, all pass.**

**1. Repealed, and we know by what** — `primary-acts-pre-2000:ukpga/1977/3:section-47`
```
panel : REPEALED — by The Public Bodies (Abolition of British Shipbuilders) Order 2013
prompt: ⚠ REPEALED (repealed by uksi/2013/687) — do NOT describe this as current law
```

**2. Repealed, instrument unknown** — `primary-acts-2000plus:ukpga/2008/4:schedule-19-paragraph-2A`
```
panel : REPEALED — we do not know which instrument repealed it
```

**3. No repeal recorded** — `primary-acts-2000plus:ukpga/2007/29:section-120`
```
panel : No repeal recorded
detail: We hold no repeal record for this provision. That is not the same as confirming it is
        current — we hold repeal records only where the source published them.
```

⚠⚠ **The third state never says "in force", and that is enforced rather than intended.**
`npm run check:repeal-status` greps every file that phrases the state for the assertion and fails on
it — **watched failing** with a planted `'In force'` in the badge. It adds no line to the prompt
either; the standing instruction covers what silence means.

⚠ **AND THERE IS NO REPEAL DATE.** The brief asks for "the date and the instrument". **The census
recorded no date.** `section_repeals.detected_at` is when *we detected* the repeal — a fact about us,
not about the law — and rendering it as the repeal date would be exactly the fabrication this job
exists to prevent. So no date is shown, and the explanation says so: *"We do not hold the date it took
effect."* ▶ **Getting the date is an ingest job**, and it is the single most valuable follow-up.

---

## §2 — Where it appears, and the audit that found them

The brief said to audit rather than assume there are three. There were **six**, in two key spaces.

| surface | route | how it gets the status | ✓ |
|---|---|---|:--:|
| Page-1 background briefing | gateway | `runSearch()` annotates every result | ✓ |
| Page-2 cause seeding, the Deepening, build passes | gateway | same — **no change to their files** | ✓ |
| Create-Idea legislation panel | `/api/ideas/[id]/legislation-search` | `PanelResult.repeal`, rendered by `RepealBadge` | ✓ |
| `POST /api/search` | gateway-legacy | `LegacySearchResult.repeal` | ✓ |
| **The Lex conversation** | `/api/ai/[ideaId]` | `repealNote` in the prompt + a standing instruction | ✓ |
| **⚠ The legislation detail page** | `/legislation/[itemId]` | **(gid, section_ref)** — a different key space | ✓ |

**One seam did most of the work.** The status is attached in `search-gateway.ts` — "the SINGLE point of
contact with search" — so every consumer of a `SearchResult` gets it without knowing it exists, and
none of the LEX stream's in-flight files were touched.

⚠ **Both `results` and `grouped` are annotated.** `grouped` is a filtered view over `results` and a
consumer may read either; annotating one is how a panel comes to disagree with the answer beside it.

---

## §2 — In what Lex reads, not only in what the user sees

This is the half the brief singles out, and it has three parts:

1. **Per-result note** — `⚠ REPEALED (repealed by uksi/2013/687) — do NOT describe this as current law`
2. **A standing instruction**, because without it a model reads an *absent* marker as confirmation:
   *"An UNMARKED provision means only that we hold no repeal record for it — it does NOT mean we have
   confirmed it is in force."*
3. ⚠ **A DIFFERENT instruction for the path where we could not check at all.** The chat route falls
   back to `lib/search.ts` if the gateway fails, and that path returns a `LegislationSection` id with
   no key to join the repeal table on. Silence there must not imply currency in either direction, so
   it gets: *"Repeal status could NOT be checked… Do not state or imply that any of them is in force,
   current, or repealed."* The flag driving it is **used, not merely computed** — the check asserts it,
   because an unused flag is an inert repair.

### ⚠ The test that matters, run against a real model

Asked *"Is [the repealed provision] still current law?"*:

| | answer |
|---|---|
| **without** the status (what the platform did until today) | *"No… no longer current law. This is because British Shipbuilders was privatized and subsequently dissolved, rendering the provisions related to it obsolete."* |
| **with** the status | *"No… no longer current law. **It was repealed by S.I. 2013/687.**"* |
| on the **could-not-check** path | declines to confirm currency and points at legislation.gov.uk |

⚠ **Read the first row honestly: the model happened to get the direction right on its own**, because
British Shipbuilders is famous enough to reason about. **What it could not do was name the repealing
instrument** — that came only from our record. On a provision repealed by an obscure SI there is
nothing for a model to reason from, which is the case the label exists for. **A single example is not
a measurement**, and the checks assert the mechanism rather than the model's disposition.

---

## §4 — The counts

| | |
|---|---:|
| repeal records held | **178,826** |
| of those, naming the repealing instrument | **25,138 (14.1%)** |
| corpus-wide rate (V36 census) | 11.44% |
| **results carrying a repeal record in 8 realistic searches** | **0 of 96** |
| **target provision reachable by its own exact title** | **0 of 7 attempts** |
| results carrying NO status at all (a lookup failure would show here) | **0** |
| detail-page repeals successfully placed | **2,731 of 4,061 (67.2%)** across the ten largest affected Acts |

### Why search returns none, established rather than assumed

Repealed sections are **not missing from the corpus** — all 178,826 are `status='compiled'` with an R2
key. They are **effectively unrankable**: median **33 words against 69** for live provisions, and that
body is largely the dot leaders the source uses to render a repealed provision. Asked for the exact
title *"Right of persons to object to practices of British Shipbuilders"*, the live index returns five
results and the repealed section is not among them — **while `uksi/2013/687`, the instrument that
repealed it, ranks first.**

**So the search-surface risk was lower than the brief assumed, and the detail-page risk was higher.**
Both are now labelled; the finding is worth more than either.

### The detail-page join, and what it misses

67.2% placement is not a defect to hide. Two honest causes: the page lists only COMPILED sections, and
a `section_ref` like `schedule-15-paragraph-10` cannot be reconstructed from a bare section number.
**An unplaced section shows NO status rather than a reassuring one.** ⚠ One act placed **0 of 77** —
*Act of Sederunt (Rules of the Court of Session 1994)*, whose refs are rule-numbered differently. Named
so it is fixed rather than rediscovered.

---

## ⚠ Anything that shows legislation and does NOT now carry the status

Named, as §4 requires. **A partial fix that looks complete is the worst outcome available here.**

| surface | why not | risk |
|---|---|---|
| **`/legislation-compare`** | compiles two versions of a section side by side from the legacy table; no repeal join wired | ⚠ **real** — someone comparing versions of a repealed section sees no warning |
| **`/admin`** | admin-only listing | low |
| **The Lex chat fallback path** | `lib/search.ts` returns a legacy id with no key to join on | **handled by refusing to speak** rather than by labelling — see above |
| **Sections whose `section_ref` cannot be derived** (~33% on the detail page) | key-space mismatch | shows nothing, claims nothing |
| **Non-legislation results** (committee, debates, case law) | `section_repeals` covers legislation only | n/a — but see below |

⚠ **The client-supplied path is unproven.** When the Lex chat route receives `legislationContext` from
the browser rather than resolving it server-side, the note is only present if the client sends it. The
field is accepted (`repealNote`, optional) and the panel now has the data to send, **but the client
was not changed to send it** — so on that path the prompt gets no note. Named rather than assumed
fixed.

---

## §3 — Verification, and what is outstanding

- `npm run verify:surface-1` — **15/15**, driving the real gateway, the real panel wording, the real
  prompt text, and a real model
- `npm run check:repeal-status` — **15/15**, including the "in force" grep watched failing on a
  planted string, and an assertion that the unavailable-path flag is used rather than computed
- `npx tsc --noEmit` — clean
- one test bug found and fixed in the verifier itself: it read the status map directly for state 3,
  where turning absence into `no-record` is `annotate`'s job — it reported "(none)" for a provision
  the product correctly labels "No repeal recorded"

⚠⚠ **NOT DONE: the browser walk.** §3 asks for the page to be opened. Production deploys are Charlie's
(the Vercel token is SAML-blocked from here) and local Clerk is a dev instance, so the on-screen check
is his. Everything beneath the pixels is exercised above. ▶ **Charlie: open an Act with repealed
sections — `/legislation/[itemId]` for the Income and Corporation Taxes Act 1988 is the strongest case,
1,335 of 1,650 — and confirm the red REPEALED badge appears; then ask Lex in chat whether a repealed
provision is current law.**

## What should happen next

1. **Get the repeal DATE.** Ingest. The single most valuable follow-up — the brief asked for it and the
   census did not record it.
2. **`/legislation-compare`**, the one remaining real exposure.
3. **The client-supplied prompt path**, so the note survives when the browser supplies the context.
4. **The 33% of detail-page sections whose ref cannot be derived**, and the rules-instrument case.
