-- LEX 26-C §7b (19 Sep 2026) — the owner's own archive, separate from the admin's `archivedAt`.
--
-- `archivedAt` (25-O §4b) is an ADMIN act on somebody else's idea. §7b asks for an OWNER control
-- ("archive and delete, on every card") that hides an idea from the owner's own list without
-- deleting it — a different actor, a different reason, and per that column's own comment,
-- reusing it would make the two indistinguishable, which is exactly the failure it was created
-- to prevent one column over. So this is additive and separate, not a rename.
--
-- Additive and nullable: every existing row reads as not-archived.

ALTER TABLE "Idea" ADD COLUMN IF NOT EXISTS "ownerArchivedAt" TIMESTAMP(3);
