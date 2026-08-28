-- ─────────────────────────────────────────────────────────────────────────────
-- SPRINT 25-M §4 — THE PILOT ALLOWANCE.
--
-- ⚠ ADDITIVE ONLY. Two columns on "User", nothing dropped, nothing rewritten. Idempotent.
--
-- ⚠⚠ WHY THERE IS NO LEDGER TABLE HERE, AND WHY THE COUNTER IS NOT `LlmSpend`.
--
-- §4 says "the counter is over `LlmSpend`, which already carries the user and the cost. No
-- new source of truth." The second half is right and the first half is not, measured:
--
--     LlmSpend: 2,702 rows — 2 with a userId, 5 with an ideaId.
--     All 306 build-stream rows sampled carry userId: null.
--
-- `SpendAttribution` is an OPTIONAL argument to the model-call helper and the build passes
-- have never passed it. An allowance counted over `LlmSpend` would therefore read ZERO for
-- every user and hand out unlimited free builds — the exact failure the allowance exists to
-- prevent, shipped as a feature and invisible until the bill arrived.
--
-- So the counter is `IdeaBuild`, which is ALSO not a new source of truth and is the unit §4
-- defines its own spend rule in: "spent means the build reached DONE and drafted the kernel."
-- One row per build, `status` on it, and `Idea.creatorId` for the user. `LlmSpend` remains
-- the COST record, which is what it is good at.
--
-- Applied against Neon (ep-old-dust-aboxi69a) — host checked with scripts/whichdb.ts first,
-- per docs/CLAUDE.md §16.
-- ─────────────────────────────────────────────────────────────────────────────

-- ⚠ THIRDS, AS AN INTEGER. A full build costs 3, a reuse re-run costs 1 (25-K §6's "re-runs
-- counted in thirds"). Holding the balance in whole builds would force a float, and a float
-- is what decides whether somebody may press a button — 0.30000000000000004 of a build left
-- is not a state anybody should have to reason about.
--
-- The default is ONE FREE BUILD PLUS ONE RE-RUN: 3 + 1 = 4 thirds. §4 says "one free build
-- per user"; a user whose single build comes back wrong and who cannot redraft it has not
-- really had one, and the re-run is the cheap half by construction.
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "buildAllowanceThirds" INTEGER NOT NULL DEFAULT 4;

-- ⚠ WHO GRANTED IT AND WHEN, on the row. An allowance that changes with no record of who
-- changed it is an unaccountable grant, and the admin action that writes it is exactly the
-- one somebody will later ask about.
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "buildAllowanceNote" TEXT;

-- ⚠⚠ WHICH MODE THE BUILD ACTUALLY RAN IN, ON THE ROW.
--
-- 25-G introduced FULL and REUSE as a REQUEST parameter and never recorded which one was
-- honoured. That was fine while nothing depended on it. It is not fine now: the allowance
-- charges a full build three thirds and a re-run one, so "what were you charged for this
-- build" has to be answerable from the build row rather than inferred from the shape of a
-- JSON pass log. An inferred charge is a charge nobody can audit.
--
-- ⚠ THE STORED VALUE IS WHAT RAN, NOT WHAT WAS ASKED FOR. `claimBuild` DOWNGRADES a REUSE
-- request to FULL when there is nothing to reuse — so writing the request would charge a
-- third for a build that did the whole job.
--
-- Default FULL: every existing row predates this and the conservative direction charges us
-- rather than the user for our own missing data.
ALTER TABLE "IdeaBuild" ADD COLUMN IF NOT EXISTS "mode" TEXT NOT NULL DEFAULT 'FULL';
