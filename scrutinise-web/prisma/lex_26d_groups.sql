-- 26-D §3-§6 — grouping. One group at a time (a single nullable FK on Idea), per §1's report.
CREATE TABLE IF NOT EXISTS "IdeaGroup" (
  "id"        TEXT NOT NULL,
  "ownerId"   TEXT NOT NULL,
  "name"      TEXT NOT NULL,
  "hidden"    BOOLEAN NOT NULL DEFAULT false,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "IdeaGroup_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "IdeaGroup_ownerId_idx" ON "IdeaGroup"("ownerId");

ALTER TABLE "IdeaGroup"
  ADD CONSTRAINT "IdeaGroup_ownerId_fkey"
  FOREIGN KEY ("ownerId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "Idea" ADD COLUMN IF NOT EXISTS "groupId" TEXT;

CREATE INDEX IF NOT EXISTS "Idea_groupId_idx" ON "Idea"("groupId");

ALTER TABLE "Idea"
  ADD CONSTRAINT "Idea_groupId_fkey"
  FOREIGN KEY ("groupId") REFERENCES "IdeaGroup"("id") ON DELETE SET NULL ON UPDATE CASCADE;
