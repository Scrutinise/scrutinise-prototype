-- LEX 26-B §10/§11 (addendum, 17 Sep 2026) — what an avenue says when it cannot be drafted.
--
-- An avenue is never left blank for want of development. Each row now says which of four states
-- it is in — DRAFTED (enough evidence; `restsOn` says what it rests on) · FROM_DEBATE (a debate
-- exists but has not resolved the problem; `debate` carries §11's four findings) · NOT_NEEDED
-- (enough evidence to say this route is not needed) · INSUFFICIENT (not enough evidence to say
-- anything; what would settle it follows).
--
-- ⚠⚠ NOT_NEEDED and INSUFFICIENT are opposite statements — a finding and an absence — and the
-- platform has already asserted one as the other at scale (952 instruments told nobody had
-- reviewed them while 1,197 review sections were held). The column is what makes the distinction
-- assertable; `applies` is kept for readers written before this and now derives from `state`.
--
-- Additive and nullable: rows written before this carry NULL and are read as DRAFTED/NOT_NEEDED
-- from `applies`, labelled as inferred.

ALTER TABLE "BuildAvenue" ADD COLUMN IF NOT EXISTS "state" TEXT;
ALTER TABLE "BuildAvenue" ADD COLUMN IF NOT EXISTS "restsOn" TEXT;
ALTER TABLE "BuildAvenue" ADD COLUMN IF NOT EXISTS "debate" JSONB;
