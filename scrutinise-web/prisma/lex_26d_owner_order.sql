-- LEX 26-D §1/§2 (20 Sep 2026) — the owner's own drag order for "My ideas".
--
-- Additive and nullable: every existing row reads as "never explicitly ordered" and sorts
-- exactly as it does today (by updatedAt) until the owner actually drags something.

ALTER TABLE "Idea" ADD COLUMN IF NOT EXISTS "ownerOrderIndex" DOUBLE PRECISION;
