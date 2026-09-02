-- ─────────────────────────────────────────────────────────────────────────────
-- CENTRAL 25-A §2 — an invitation has to be able to say what happened to it.
--
-- Before this, `CommunityInvite` held only `usedCount`/`maxUses`. That answers
-- "has anyone redeemed it" and nothing else: not whether the invitee ever
-- opened the link, not whether the invitation was called off, and not which
-- link a person arrived through. An owner running an invitation process had no
-- way to tell "invited and never came" from "came and could not get in" — the
-- exact pair that produced 25-A §1.
--
-- Three additive columns. No data is rewritten, nothing is dropped, and every
-- existing row keeps behaving as it did (all three are NULL, which every reader
-- renders as "not recorded" rather than as a false negative).
--
-- ⚠ NO PARTIAL OR EXPRESSION INDEX HERE, so nothing to add to docs/CLAUDE.md §21.
-- ─────────────────────────────────────────────────────────────────────────────

-- When the invitation link was first opened. Set once, by the invite screen.
-- ⚠ HONEST LIMIT, and it is rendered on the page: a corporate mail scanner that
-- follows links will set this without a human seeing anything. "Opened" is
-- evidence the link works, not evidence the person read it.
ALTER TABLE "CommunityInvite" ADD COLUMN IF NOT EXISTS "openedAt" TIMESTAMP(3);

-- Revocation. A revoked invitation is REFUSED at redemption (see
-- app/api/communities/join/route.ts) — it is not merely hidden from a list.
ALTER TABLE "CommunityInvite" ADD COLUMN IF NOT EXISTS "revokedAt" TIMESTAMP(3);
ALTER TABLE "CommunityInvite" ADD COLUMN IF NOT EXISTS "revokedByUserId" TEXT;

-- Which invite the arrival came through, so a link arrival is a FACT rather
-- than an inference from "this member matches no direct invitation".
-- ⚠ NULL on the rows that predate this: those are shown as "arrived before we
-- recorded which link", never as "arrived through a link".
ALTER TABLE "CommunityReferral" ADD COLUMN IF NOT EXISTS "inviteId" TEXT;

CREATE INDEX IF NOT EXISTS "CommunityReferral_inviteId_idx" ON "CommunityReferral" ("inviteId");

-- ─────────────────────────────────────────────────────────────────────────────
-- CENTRAL 25-A §3 — Charlie's decisions, 1 September 2026.
--
-- §3a  Invitation rights are a SETTING on the Community, not a rule in code.
-- §3b  An invite link becomes a request to join: nobody joins on click.
-- §3c  Removal archives the membership. The contributions stay, attributed.
-- ─────────────────────────────────────────────────────────────────────────────

-- §3a — which roles besides the owner may invite. Default is both, which is
-- exactly what every Community could already do, so this changes nothing until
-- an owner narrows it. ⚠ The OWNER is not listed and cannot be removed: a
-- setting able to take the owner's own right away can lock a Community out of
-- inviting anybody.
ALTER TABLE "CommunitySettings"
  ADD COLUMN IF NOT EXISTS "inviteRights" TEXT[] NOT NULL DEFAULT ARRAY['COMMUNITY_ADMIN','BRANCH_MANAGER']::TEXT[];

-- §3b — the link arrival's request names the link it came through.
ALTER TABLE "CommunityJoinRequest" ADD COLUMN IF NOT EXISTS "inviteId" TEXT;
CREATE INDEX IF NOT EXISTS "CommunityJoinRequest_inviteId_idx" ON "CommunityJoinRequest" ("inviteId");

-- §3c — the archive. ⚠ A TABLE, NOT A `removedAt` COLUMN on CommunityMember:
-- that table carries a unique index on (communityId, userId), so an archived row
-- left in place would make re-joining impossible — and dozens of queries read it
-- as "the members", so the one that forgot the filter would silently treat a
-- removed person as present.
CREATE TABLE IF NOT EXISTS "CommunityMembershipArchive" (
  "id"              TEXT PRIMARY KEY,
  "communityId"     TEXT NOT NULL REFERENCES "Community"("id"),
  "userId"          TEXT NOT NULL REFERENCES "User"("id"),
  "role"            "CommunityMemberRole" NOT NULL,
  "joinedAt"        TIMESTAMP(3) NOT NULL,
  "removedAt"       TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "removedByUserId" TEXT REFERENCES "User"("id"),
  "reason"          TEXT
);
CREATE INDEX IF NOT EXISTS "CommunityMembershipArchive_communityId_idx" ON "CommunityMembershipArchive" ("communityId");
CREATE INDEX IF NOT EXISTS "CommunityMembershipArchive_userId_idx" ON "CommunityMembershipArchive" ("userId");
