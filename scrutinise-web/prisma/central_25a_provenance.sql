-- ─────────────────────────────────────────────────────────────────────────────
-- CENTRAL 25-A §7h — WHO BROUGHT WHOM, ON THE MEMBERSHIP, PERMANENTLY.
--
-- Charlie is relying on branch chairs being accountable for the people they
-- brought in, so the record of who brought in whom must not be destroyable by a
-- removal.
--
-- Before this it was derivable only from `CommunityReferral`, which is unique
-- per (ROOT community, invitee): a branch held no record of its own, and
-- somebody in three branches of one Community had a single row covering all of
-- them. The membership row is where the fact belongs.
--
-- ⚠ It survives removal because `archiveMembership` copies these columns into
-- `CommunityMembershipArchive` in the same transaction that deletes the live
-- row, and nothing anywhere nulls them.
--
-- Additive. No data rewritten, nothing dropped, no partial or expression index
-- (so nothing to add to docs/CLAUDE.md §21).
-- ─────────────────────────────────────────────────────────────────────────────

ALTER TABLE "CommunityMember" ADD COLUMN IF NOT EXISTS "invitedByUserId" TEXT;
ALTER TABLE "CommunityMember" ADD COLUMN IF NOT EXISTS "invitedViaInviteId" TEXT;

ALTER TABLE "CommunityMembershipArchive" ADD COLUMN IF NOT EXISTS "invitedByUserId" TEXT;
ALTER TABLE "CommunityMembershipArchive" ADD COLUMN IF NOT EXISTS "invitedViaInviteId" TEXT;

-- The foreign keys are added separately and tolerantly: on a database where
-- they already exist, ADD CONSTRAINT would abort the whole file.
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'CommunityMember_invitedByUserId_fkey') THEN
    ALTER TABLE "CommunityMember"
      ADD CONSTRAINT "CommunityMember_invitedByUserId_fkey"
      FOREIGN KEY ("invitedByUserId") REFERENCES "User"("id");
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'CommunityMember_invitedViaInviteId_fkey') THEN
    ALTER TABLE "CommunityMember"
      ADD CONSTRAINT "CommunityMember_invitedViaInviteId_fkey"
      FOREIGN KEY ("invitedViaInviteId") REFERENCES "CommunityInvite"("id");
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'CommunityMembershipArchive_invitedByUserId_fkey') THEN
    ALTER TABLE "CommunityMembershipArchive"
      ADD CONSTRAINT "CommunityMembershipArchive_invitedByUserId_fkey"
      FOREIGN KEY ("invitedByUserId") REFERENCES "User"("id");
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS "CommunityMember_invitedByUserId_idx" ON "CommunityMember" ("invitedByUserId");

-- ─────────────────────────────────────────────────────────────────────────────
-- CENTRAL 25-A §7e — COMMUNITY TITLES ARE NOT PLATFORM ROLES.
--
-- "Branch Chair" is a title inside a Community, defined by that Community,
-- granting rights only within it. ⚠ `User.role` — the PLATFORM role — is not
-- touched by any of this and must never be: everyone is an ordinary platform
-- member unless separately granted otherwise.
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS "CommunityTitle" (
  "id"           TEXT PRIMARY KEY,
  "communityId"  TEXT NOT NULL REFERENCES "Community"("id"),
  "name"         TEXT NOT NULL,
  "description"  TEXT,
  -- The only right a title carries today. More may be added; each one is a
  -- column here and a branch in `inviteRightFor`, never a platform role.
  "grantsInvite" BOOLEAN NOT NULL DEFAULT false,
  "createdAt"    TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"    TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- One title of a given name per Community. Two "Branch Chair" rows in one
-- Community is a mistake, not a feature.
CREATE UNIQUE INDEX IF NOT EXISTS "CommunityTitle_communityId_name_key"
  ON "CommunityTitle" ("communityId", "name");

ALTER TABLE "CommunityMember" ADD COLUMN IF NOT EXISTS "titleId" TEXT;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'CommunityMember_titleId_fkey') THEN
    ALTER TABLE "CommunityMember"
      ADD CONSTRAINT "CommunityMember_titleId_fkey"
      FOREIGN KEY ("titleId") REFERENCES "CommunityTitle"("id");
  END IF;
END $$;

-- ─────────────────────────────────────────────────────────────────────────────
-- CENTRAL 25-A §7c/§7j — ACCEPTED ON THEIR BEHALF, RECORDED AS SUCH.
--
-- §7c creates the membership at first sign-in and §7j sweeps the people who
-- already have an account and an unredeemed invitation. In both, nobody
-- clicked anything.
--
-- ⚠ A COLUMN, not an inference from timestamps. "They accepted" and "we
-- accepted for them" are different facts about consent, and a member who never
-- clicked must be visible as one.
-- ─────────────────────────────────────────────────────────────────────────────
ALTER TABLE "CommunityMember" ADD COLUMN IF NOT EXISTS "acceptedOnBehalfAt" TIMESTAMP(3);
ALTER TABLE "CommunityMembershipArchive" ADD COLUMN IF NOT EXISTS "acceptedOnBehalfAt" TIMESTAMP(3);
