-- ─────────────────────────────────────────────────────────────────────────────
-- CENTRAL 25-C §1 — THE TWO-TIER MEMBERSHIP MODEL, AND §2i's NOMINATION.
--
-- ⚠⚠ THE ROOT MEMBERSHIP ROW IS STILL CREATED. Stage 1.2's branch-implies-root
-- invariant — which `check:central` asserts at 856/858 — is unchanged and stays
-- green. A branch member can still see the Community they belong to. What this
-- migration adds is a TIER on that row, so that only the RIGHTS detach:
-- `canCreateBranchUnder` and `inviteRightFor`. The other ten gates do not move.
--
-- ⚠ DEFAULT 'GROUP' IS THE COMPATIBLE VALUE, NOT THE DERIVED ONE. Every
-- pre-existing row lands on GROUP here and is then re-derived from how the
-- person actually joined by `scripts/backfill-membership-tier.ts` (§1f), which
-- prints its evidence per row and writes only with `--write`. Defaulting the
-- column to GROUP and calling that the answer is precisely what §1f forbids;
-- the default exists so that a write between this file landing and the backfill
-- running cannot produce a NULL the gates would have to guess at.
--
-- Additive. No data rewritten, nothing dropped, no partial or expression index
-- (so nothing to add to docs/CLAUDE.md §21).
-- ─────────────────────────────────────────────────────────────────────────────

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'CommunityMembershipTier') THEN
    CREATE TYPE "CommunityMembershipTier" AS ENUM ('GROUP', 'BRANCH');
  END IF;
END $$;

ALTER TABLE "CommunityMember"
  ADD COLUMN IF NOT EXISTS "tier" "CommunityMembershipTier" NOT NULL DEFAULT 'GROUP';

-- Carried across on removal, exactly like `invitedByUserId` and
-- `acceptedOnBehalfAt`: what somebody was when they were removed is part of the
-- record, and re-deriving it after the live row has gone is not possible.
ALTER TABLE "CommunityMembershipArchive"
  ADD COLUMN IF NOT EXISTS "tier" "CommunityMembershipTier" NOT NULL DEFAULT 'GROUP';

-- §1h's correction surface sorts and filters group-level members by tier on the
-- root node, which is this pair.
CREATE INDEX IF NOT EXISTS "CommunityMember_communityId_tier_idx"
  ON "CommunityMember" ("communityId", "tier");

-- ─────────────────────────────────────────────────────────────────────────────
-- CENTRAL 25-C §2i — RESIGN AND NOMINATE, SUBJECT TO ADMIN APPROVAL.
--
-- ⚠⚠ A PENDING NOMINATION CONFERS NOTHING. It is a row here and nothing else:
-- no `CommunityMember.role` is touched until a community admin approves it, at
-- which point `appointBranchOwner` — the one function that has ever been
-- allowed to write an OWNER row outside creation — does the transfer.
--
-- A table rather than a column on Community because a nomination has an author,
-- a subject, a reason and a decision, and because a declined nomination is a
-- fact worth keeping: "the branch asked for X and the Community said no" is
-- exactly the kind of thing that later reads as a bug if it is not recorded.
-- ─────────────────────────────────────────────────────────────────────────────

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'BranchNominationStatus') THEN
    CREATE TYPE "BranchNominationStatus" AS ENUM ('PENDING', 'APPROVED', 'DECLINED');
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS "BranchOwnerNomination" (
  "id"                TEXT PRIMARY KEY,
  "communityId"       TEXT NOT NULL REFERENCES "Community"("id"),
  -- The outgoing manager. ⚠ Nullable on purpose: a nomination outlives the
  -- resignation that produced it, and §2f says the position may already be
  -- vacant by the time an admin gets to it.
  "nominatedByUserId" TEXT NOT NULL REFERENCES "User"("id"),
  "nomineeUserId"     TEXT NOT NULL REFERENCES "User"("id"),
  -- Required, for the same reason a vacate's reason is required (decision 51).
  "reason"            TEXT NOT NULL,
  "status"            "BranchNominationStatus" NOT NULL DEFAULT 'PENDING',
  "createdAt"         TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "decidedAt"         TIMESTAMP(3),
  "decidedByUserId"   TEXT REFERENCES "User"("id"),
  "decisionNote"      TEXT
);

CREATE INDEX IF NOT EXISTS "BranchOwnerNomination_communityId_status_idx"
  ON "BranchOwnerNomination" ("communityId", "status");
CREATE INDEX IF NOT EXISTS "BranchOwnerNomination_nomineeUserId_idx"
  ON "BranchOwnerNomination" ("nomineeUserId");
