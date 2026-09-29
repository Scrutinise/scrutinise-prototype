-- 26-L addendum 4 §2 — feedback on ONE draft, kept on the draft it is about.
-- Additive, nullable, no default: existing rows read NULL = "no comment". Not a partial or
-- expression index; nothing for docs/CLAUDE.md §21's register.
ALTER TABLE "GuidingPolicyDraft" ADD COLUMN IF NOT EXISTS "userFeedback" TEXT;
