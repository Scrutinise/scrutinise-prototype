-- LEX 26-O §4d (4 Oct 2026). Additive, nullable. GuidingPolicyDraft.servedBy = the model that ACTUALLY wrote a
-- draft when the panel slot's own model was unavailable and a fallback answered (gemini-3.1-pro-preview is a
-- preview). NULL = the slot's own model wrote it. The card says so when it is set.
ALTER TABLE "GuidingPolicyDraft" ADD COLUMN IF NOT EXISTS "servedBy" TEXT;
