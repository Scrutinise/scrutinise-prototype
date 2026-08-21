-- ─────────────────────────────────────────────────────────────────────────────
-- Sprint 25-D / 20-E — source exclusion (§2a), the question heading an evidence
-- item answers (§3), and the user's own documents and links (§4 / §25.6).
--
-- Additive and idempotent. Applied to the APP Neon DB (ep-old-dust-aboxi69a /
-- neondb) via `prisma db execute`. NEVER `prisma db push` (docs/CLAUDE.md §16),
-- and never against Railway.
-- ─────────────────────────────────────────────────────────────────────────────

-- ═════════════════════════════════════════════════════════════════════════════
-- §2a — A SOURCE THE USER SET ASIDE STAYS IN THE RECORD, EXCLUDED, WITH A REASON.
--
-- ⚠ WHY A ROW AND NOT A FLAG ON THE SOURCE ITSELF. Corpus sources live in JSON
-- columns written by retrieval — `Idea.legislationRefs` and the per-stage search
-- store. Writing a user decision into those has two failure modes and both are
-- silent: it mixes user state into retrieval output, and THE DECISION IS
-- DESTROYED THE NEXT TIME THE SEARCH RUNS. "Excluded, never deleted" cannot be
-- built on a column that a re-run overwrites.
--
-- ⚠⚠ AND WHY THE ROW CARRIES THE SOURCE'S OWN TITLE, CITATION AND URL. A source
-- can be excluded today and drop out of retrieval tomorrow — rankings move, a
-- collection is reindexed, a stage search is re-run with different terms. If the
-- decision were only a foreign key into a JSON blob, the Evidence Pack's "what
-- was considered and set aside" would quietly become a list of orphan ids, and
-- the strongest thing this feature does — SHOWING what was rejected and why —
-- would be the first thing to break. The row is self-sufficient by design.
-- ═════════════════════════════════════════════════════════════════════════════

DO $$ BEGIN
  CREATE TYPE "SourceDecisionStatus" AS ENUM ('INCLUDED','EXCLUDED');
EXCEPTION WHEN duplicate_object THEN null; END $$;

CREATE TABLE IF NOT EXISTS "IdeaSourceDecision" (
  "id"         TEXT NOT NULL,
  "ideaId"     TEXT NOT NULL,
  -- The corpus ref id — the same `SearchResult.id` every surface already keys a
  -- source by, so a decision made in the panel is the same decision the Evidence
  -- Pack reads.
  "sourceKey"  TEXT NOT NULL,
  "status"     "SourceDecisionStatus" NOT NULL DEFAULT 'EXCLUDED',
  -- ⚠ Required by the application whenever status = EXCLUDED. An exclusion with
  -- no stated reason is an unaccountable veto — the same rule
  -- `DeepeningIssue.dismissReason` is held to.
  "reason"     TEXT,
  -- The user's own note, kept whether the source is in or out. §20.2.1: "the user
  -- includes, excludes, or annotates each".
  "annotation" TEXT,
  -- Self-sufficiency: see the header.
  "title"      TEXT,
  "citation"   TEXT,
  "url"        TEXT,
  "sourceType" TEXT,
  "decidedBy"  TEXT NOT NULL,
  "decidedAt"  TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "createdAt"  TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"  TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "IdeaSourceDecision_pkey" PRIMARY KEY ("id")
);

DO $$ BEGIN
  ALTER TABLE "IdeaSourceDecision"
    ADD CONSTRAINT "IdeaSourceDecision_ideaId_fkey"
    FOREIGN KEY ("ideaId") REFERENCES "Idea"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null; END $$;

CREATE UNIQUE INDEX IF NOT EXISTS "IdeaSourceDecision_ideaId_sourceKey_key"
  ON "IdeaSourceDecision" ("ideaId", "sourceKey");
CREATE INDEX IF NOT EXISTS "IdeaSourceDecision_ideaId_status_idx"
  ON "IdeaSourceDecision" ("ideaId", "status");

-- ═════════════════════════════════════════════════════════════════════════════
-- §3 — WHICH QUESTION AN EVIDENCE ITEM ANSWERS, TAGGED AT CREATION.
--
-- ⚠ TAGGED BY THE PRODUCER, NEVER DERIVED BY THE PANEL. 25-C's known-unknowns
-- collapse learned this the expensive way: a consumer that classifies by reading
-- the text guesses, and a wrong guess puts a finding under a heading it does not
-- answer. Four different producers write EvidenceItem rows — the build's
-- interrogation questions, the revision pass, the adversarial read, and now the
-- user's own documents — and each of them knows the answer at the moment it
-- writes. Nothing downstream should have to work it out.
--
-- Null on every row written before this sprint. That is rendered as "not
-- classified", never silently filed under a heading nobody chose.
-- ═════════════════════════════════════════════════════════════════════════════

ALTER TABLE "EvidenceItem" ADD COLUMN IF NOT EXISTS "headingKey" TEXT;
CREATE INDEX IF NOT EXISTS "EvidenceItem_ideaId_headingKey_idx"
  ON "EvidenceItem" ("ideaId", "headingKey");

-- ═════════════════════════════════════════════════════════════════════════════
-- §4 / §25.6 — THE USER'S OWN DOCUMENTS AND LINKS.
--
-- ⚠ THE EXTRACTED TEXT, NEVER THE BINARY. §25.6 is explicit and the reasoning is
-- not about disk: ~30KB a document means storage is free at any plausible scale,
-- while a stored PDF is a liability we have to hold, serve and delete, and a
-- stored binary invites somebody to hand the whole thing to a model later.
--
-- ⚠ AND THE TEXT IS NEVER INJECTED WHOLESALE INTO A PROMPT. On ingest the
-- document is READ ONCE and turned into findings with provenance, which land in
-- the evidence layer like any other source. `findingsAt` records that this
-- happened; a document with text and no findings pass is visibly un-read rather
-- than quietly ignored.
--
-- Deleted with the idea (GDPR erasure) — hence ON DELETE CASCADE, not a soft
-- delete. Private to the idea and its team by construction: every read path goes
-- through `authorizeIdea`.
-- ═════════════════════════════════════════════════════════════════════════════

DO $$ BEGIN
  CREATE TYPE "UserMaterialKind" AS ENUM ('FILE','LINK');
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  CREATE TYPE "UserMaterialStatus" AS ENUM ('PENDING','READY','FAILED');
EXCEPTION WHEN duplicate_object THEN null; END $$;

CREATE TABLE IF NOT EXISTS "IdeaUserMaterial" (
  "id"          TEXT NOT NULL,
  "ideaId"      TEXT NOT NULL,
  "kind"        "UserMaterialKind" NOT NULL,
  "status"      "UserMaterialStatus" NOT NULL DEFAULT 'PENDING',
  -- What the user called it, or the document's own title.
  "label"       TEXT NOT NULL,
  -- The original filename (FILE) — kept so the user recognises their own file.
  "filename"    TEXT,
  "mimeType"    TEXT,
  -- ⚠ RETAINED FOR A LINK, ALWAYS. §25.6: "stored as text with the link retained".
  -- A quotation whose source cannot be reopened is not evidence.
  "url"         TEXT,
  -- The extracted text. THE ONLY COPY OF THE CONTENT WE HOLD.
  "text"        TEXT,
  "charCount"   INTEGER NOT NULL DEFAULT 0,
  -- Bytes of the ORIGINAL, recorded for the cap and then discarded with it.
  "sourceBytes" INTEGER NOT NULL DEFAULT 0,
  -- Set on FAILED. A document that could not be read says why — an empty panel
  -- entry and a failed extraction must not look the same (CLAUDE.md §18).
  "failureReason" TEXT,
  -- When the findings pass last read it. NULL = the text is stored and has never
  -- been read, which is a state the UI states rather than hides.
  "findingsAt"  TIMESTAMP(3),
  "findingCount" INTEGER NOT NULL DEFAULT 0,
  -- The user's assertion that they may share it (§25.6 liability).
  "rightsConfirmed" BOOLEAN NOT NULL DEFAULT false,
  "addedBy"     TEXT NOT NULL,
  "createdAt"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "IdeaUserMaterial_pkey" PRIMARY KEY ("id")
);

DO $$ BEGIN
  ALTER TABLE "IdeaUserMaterial"
    ADD CONSTRAINT "IdeaUserMaterial_ideaId_fkey"
    FOREIGN KEY ("ideaId") REFERENCES "Idea"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null; END $$;

CREATE INDEX IF NOT EXISTS "IdeaUserMaterial_ideaId_idx" ON "IdeaUserMaterial" ("ideaId");
CREATE INDEX IF NOT EXISTS "IdeaUserMaterial_ideaId_status_idx" ON "IdeaUserMaterial" ("ideaId", "status");
