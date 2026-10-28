-- 292/282/289 (CCh-Lex 28 Oct (5)) — LexMessage: the whole Lex conversation, one row per message, never cut.
-- Additive only: one new table, no change to any existing table. See the model's doc comment in schema.prisma.
-- ⚠ The (ideaId, turnId, role) unique is 289's in-flight lock. NULL turnIds are distinct in Postgres, so confirmation lines
--   and copied-in messages with no turn id never collide.

CREATE TABLE IF NOT EXISTS "LexMessage" (
  "id"        TEXT         NOT NULL,
  "ideaId"    TEXT         NOT NULL,
  "n"         INTEGER      NOT NULL,
  "replyNo"   INTEGER,
  "role"      TEXT         NOT NULL,
  "content"   TEXT         NOT NULL,
  "turnId"    TEXT,
  "meta"      JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "LexMessage_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "LexMessage_ideaId_fkey" FOREIGN KEY ("ideaId") REFERENCES "Idea"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE UNIQUE INDEX IF NOT EXISTS "LexMessage_ideaId_n_key"              ON "LexMessage"("ideaId", "n");
CREATE UNIQUE INDEX IF NOT EXISTS "LexMessage_ideaId_replyNo_key"        ON "LexMessage"("ideaId", "replyNo");
CREATE UNIQUE INDEX IF NOT EXISTS "LexMessage_ideaId_turnId_role_key"    ON "LexMessage"("ideaId", "turnId", "role");
CREATE INDEX        IF NOT EXISTS "LexMessage_ideaId_createdAt_idx"      ON "LexMessage"("ideaId", "createdAt");
