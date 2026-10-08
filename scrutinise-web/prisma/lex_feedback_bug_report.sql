-- LEX feedback (8 Oct 2026, Charlie's walkthrough item 4) — additive only.
--
--   (a) "Bug / error report" joins "What is this about?"            -> FeedbackSurface gains BUG_REPORT
--   (b) a screenshot or file can travel with a report                -> FeedbackItem.attachments  (R2 keys + names; the files are in R2)
--   (c) the technical detail passes through VERBATIM for bug reports -> FeedbackItem.technicalDetail (the error shown, the control
--                                                                        pressed, the numbers, the failing request — sanitised)
--   (d) DECISION 137: "User 435" replaces "the user"                 -> User.feedbackRef, a stable pseudonymous number
--
-- ⚠ User.feedbackRef is a SERIAL on a table that already has rows: Postgres fills every existing user with the next value, in
--   arbitrary order, which is exactly what is wanted — a number that identifies a person across reports WITHOUT naming them, and
--   that cannot be derived from anything about them (an initial, a hash of the email, a creation order a reader could guess).
--   It is shown only in feedback; it is not a public identifier and appears nowhere else.
-- ⚠ ALTER TYPE ... ADD VALUE cannot be used in the same transaction that adds it; this file adds it and never uses it.

ALTER TYPE "FeedbackSurface" ADD VALUE IF NOT EXISTS 'BUG_REPORT';

ALTER TABLE "FeedbackItem" ADD COLUMN IF NOT EXISTS "technicalDetail" JSONB;
ALTER TABLE "FeedbackItem" ADD COLUMN IF NOT EXISTS "attachments" JSONB;

ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "feedbackRef" SERIAL;
CREATE UNIQUE INDEX IF NOT EXISTS "User_feedbackRef_key" ON "User"("feedbackRef");
