-- ─────────────────────────────────────────────────────────────────────────────
-- Sprint 20-B/D — the proposal document, versioning and publication.
-- Additive and idempotent. Applied to the APP Neon DB (ep-old-dust-aboxi69a /
-- neondb) via `prisma db execute`. NEVER `prisma db push` (docs/CLAUDE.md §16),
-- and never against Railway.
--
-- ⚠ WHY A SECOND VISIBILITY ENUM RATHER THAN EXTENDING `IdeaVisibility`.
-- `IdeaVisibility` (PRIVATE | LINK_ONLY | PLATFORM_LISTED) is the FIVE-STAGE
-- lifecycle's visibility: the stage gates, the listing queries and the referral
-- machinery all read it. §20.3's four states are about a PUBLISHED PROPOSAL
-- VERSION, which is a different object with a different lifetime — an idea can be
-- STAGE_3 link-only while its proposal is unpublished, and both facts are true at
-- once. Overloading one column would make every existing "which ideas are listed"
-- query silently include published proposals. CLAUDE.md §11 also forbids removing
-- or repurposing a field without Charlie's instruction.
-- ─────────────────────────────────────────────────────────────────────────────

-- ── §20.3 the four publication states ────────────────────────────────────────
DO $$ BEGIN
  CREATE TYPE "ProposalVisibility" AS ENUM ('PRIVATE','LINK','COMMUNITY','PUBLIC');
EXCEPTION WHEN duplicate_object THEN null; END $$;

-- ── §2 ProposalVersion — append-only, one stored snapshot per version ─────────
-- `snapshot` is the WHOLE §1 object, serialised. A version is not a pointer at
-- live state: state moves, and a recipient's link must not move with it. Storing
-- the snapshot is what makes "the version that was shared" a fact rather than a
-- reconstruction.
CREATE TABLE IF NOT EXISTS "ProposalVersion" (
  "id"            TEXT NOT NULL,
  "ideaId"        TEXT NOT NULL,
  "versionNumber" INTEGER NOT NULL,
  -- sha-256 over the snapshot with its volatile fields removed. Two versions of
  -- the same content hash identically, which is how an unchanged proposal is
  -- stopped from minting a new version.
  "contentHash"   TEXT NOT NULL,
  "snapshot"      JSONB NOT NULL,
  "createdAt"     TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "createdBy"     TEXT NOT NULL,
  "changeNote"    TEXT,
  CONSTRAINT "ProposalVersion_pkey" PRIMARY KEY ("id")
);

-- Append-only is enforced three ways: no UPDATE path in the application, the
-- unique version number below (so a second write of the same number fails loudly
-- rather than overwriting), and `check:20bd`'s live assertion.
CREATE UNIQUE INDEX IF NOT EXISTS "ProposalVersion_ideaId_versionNumber_key"
  ON "ProposalVersion"("ideaId", "versionNumber");
CREATE INDEX IF NOT EXISTS "ProposalVersion_ideaId_createdAt_idx"
  ON "ProposalVersion"("ideaId", "createdAt" DESC);
-- ⚠ NOT unique on (ideaId, contentHash). Reverting an edit legitimately produces
-- a snapshot identical to an older version, and that must be recordable; the
-- no-duplicate rule compares against the LATEST version only.
CREATE INDEX IF NOT EXISTS "ProposalVersion_contentHash_idx"
  ON "ProposalVersion"("contentHash");

DO $$ BEGIN
  ALTER TABLE "ProposalVersion" ADD CONSTRAINT "ProposalVersion_ideaId_fkey"
    FOREIGN KEY ("ideaId") REFERENCES "Idea"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  ALTER TABLE "ProposalVersion" ADD CONSTRAINT "ProposalVersion_createdBy_fkey"
    FOREIGN KEY ("createdBy") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null; END $$;

-- ── §20.3 publication state, on the Idea ─────────────────────────────────────
-- ⚠ `publishedProposalVersionId` is the PIN. Every share resolver reads it and
-- never "the latest version" — that one line is the whole of "a recipient's link
-- does not shift under them while the owner keeps editing".
ALTER TABLE "Idea" ADD COLUMN IF NOT EXISTS "proposalVisibility" "ProposalVisibility" NOT NULL DEFAULT 'PRIVATE';
ALTER TABLE "Idea" ADD COLUMN IF NOT EXISTS "publishedProposalVersionId" TEXT;
ALTER TABLE "Idea" ADD COLUMN IF NOT EXISTS "proposalPublishedAt" TIMESTAMP(3);
-- The share token. Minted once and kept across re-publishes, so a link already
-- in an MP's inbox keeps working when the owner publishes a revision. Revoking
-- is `proposalVisibility = PRIVATE`, which the resolver refuses on.
ALTER TABLE "Idea" ADD COLUMN IF NOT EXISTS "proposalShareToken" TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS "Idea_proposalShareToken_key"
  ON "Idea"("proposalShareToken");
CREATE INDEX IF NOT EXISTS "Idea_proposalVisibility_idx"
  ON "Idea"("proposalVisibility");

DO $$ BEGIN
  ALTER TABLE "Idea" ADD CONSTRAINT "Idea_publishedProposalVersionId_fkey"
    FOREIGN KEY ("publishedProposalVersionId") REFERENCES "ProposalVersion"("id")
    ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null; END $$;

-- ── §3 the rendered pair, per document kind ──────────────────────────────────
-- `Document` is already keyed (ideaId, kind) and already carries the docx/pdf
-- keys, the fingerprint and the generation provenance from Sprint 2.5. The
-- proposal and the summary are two new KINDS through the same columns rather
-- than a second export table — the §8.2 comment says the block model exists so
-- that §20-B is a new BUILDER, not a new pipeline.
--
-- One new column: which stored version a file was rendered from. A file rendered
-- from the working state and a file rendered from published v3 look identical on
-- disk, and telling them apart is the difference between "your draft" and "what
-- the recipient is holding".
ALTER TABLE "Document" ADD COLUMN IF NOT EXISTS "proposalVersionId" TEXT;

DO $$ BEGIN
  ALTER TABLE "Document" ADD CONSTRAINT "Document_proposalVersionId_fkey"
    FOREIGN KEY ("proposalVersionId") REFERENCES "ProposalVersion"("id")
    ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null; END $$;
