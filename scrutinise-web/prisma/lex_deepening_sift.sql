-- ─────────────────────────────────────────────────────────────────────────────
-- §19-E Task 3 — THE SIFT. Additive schema delta. Idempotent; safe to re-run.
--
-- Apply to Neon (NEVER `prisma db push` — see docs/CLAUDE.md §16 and the playbook):
--   cd scrutinise-web
--   npm run whichdb                        # confirm the host first, every time
--   DIRECT_URL="<neon direct url>" npx prisma db execute --file prisma/lex_deepening_sift.sql --schema prisma/schema.prisma
--   npx prisma generate
--
-- WHY THESE THREE COLUMNS EXIST.
--
-- Charlie, on the precedents a Deepening pass returned: "they aren't really precedents
-- — they're a random search, quite a lot of it irrelevant… Instead of ranking the top
-- 20 for relevance, which Lex can't seem to do very well, it should take the top 100
-- and pick out intelligently the ones that really are relevant and useful."
--
-- Ranking answers "what is most similar". Sifting answers "what actually bears on
-- this". They are different questions, and the Deepening runs in the background with a
-- minutes-long budget, so it can afford to ask the second one.
--
-- The sift's OUTPUT IS A NUMBER THE USER SEES: "reviewed 104 sources, 12 bore on this".
-- That is honest — it says plainly that most of what came back did not help — and it is
-- a quality signal we can watch over time. A sift whose discard count is hidden is
-- indistinguishable from no sift at all, which is the §18 rule one more time.
--
--   candidatesReviewed  how many candidates retrieval returned, after dedupe
--   candidatesKept      how many the sift judged to bear on this proposal
--   siftSkipped         TRUE when the sift could not run (no key, HTTP failure,
--                       truncation) and the pass fell back to the ranked set.
--                       ⚠ WITHOUT THIS COLUMN a fallback run and a sifted run look
--                       identical from outside, and "reviewed 104, kept 104" would read
--                       as a sift that liked everything rather than a sift that never
--                       ran. Same failure family as §18's corollary.
-- ─────────────────────────────────────────────────────────────────────────────

ALTER TABLE "DeepeningPass" ADD COLUMN IF NOT EXISTS "candidatesReviewed" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "DeepeningPass" ADD COLUMN IF NOT EXISTS "candidatesKept"     INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "DeepeningPass" ADD COLUMN IF NOT EXISTS "siftSkipped"        BOOLEAN NOT NULL DEFAULT FALSE;

-- The sift's one-line reason for keeping a source, carried onto the finding that cites
-- it. Nullable: findings written before this sprint have no sift reason, and inventing
-- one would be a claim about a judgement nobody made.
ALTER TABLE "EvidenceItem" ADD COLUMN IF NOT EXISTS "siftReason" TEXT;

-- Whether the sift judged this source to satisfy the PRECEDENT TEST — a comparable
-- measure was tried, and we can say what it was for, what was predicted, or what
-- happened. A topically-related document is not a precedent. Nullable for the same
-- reason as above.
ALTER TABLE "EvidenceItem" ADD COLUMN IF NOT EXISTS "precedentTestPassed" BOOLEAN;
