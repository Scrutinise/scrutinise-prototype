-- CENTRAL Stage 2b — question library (2026-08-11)
-- Additive + idempotent. Safe to re-run. HAND-WRITTEN, not from
-- `prisma migrate diff` — that still wants to drop the 914k-row
-- LegislationSection_DEPRECATED table and specialist_queue (docs/CLAUDE.md §16).
-- Column types match the rest of Central: TEXT ids, TIMESTAMP(3).
--
-- Target: the app database (Neon ep-old-dust-aboxi69a / neondb).
--
-- Eight tables and the seeded tag set. No partial or expression indexes this
-- time — every uniqueness rule here is a plain composite, so unlike Stage 1.2
-- and Stage 2 nothing in this file is invisible to schema.prisma.

-- 1 ── questions and answers ─────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS "Question" (
  "id"          TEXT         NOT NULL,
  "communityId" TEXT         NOT NULL,
  "authorId"    TEXT         NOT NULL,
  "text"        TEXT         NOT NULL,
  "scope"       TEXT         NOT NULL DEFAULT 'COMMUNITY',
  "branchId"    TEXT,
  "contextTags" TEXT[]       NOT NULL DEFAULT '{}',
  "topicTags"   TEXT[]       NOT NULL DEFAULT '{}',
  "createdAt"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "Question_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "Question_communityId_createdAt_idx" ON "Question" ("communityId", "createdAt");
CREATE INDEX IF NOT EXISTS "Question_communityId_scope_idx"     ON "Question" ("communityId", "scope");
CREATE INDEX IF NOT EXISTS "Question_branchId_idx"              ON "Question" ("branchId");

CREATE TABLE IF NOT EXISTS "Answer" (
  "id"           TEXT         NOT NULL,
  "questionId"   TEXT         NOT NULL,
  "authorId"     TEXT         NOT NULL,
  "body"         TEXT         NOT NULL,
  "sources"      TEXT[]       NOT NULL DEFAULT '{}',
  "localExample" TEXT,
  "hidden"       BOOLEAN      NOT NULL DEFAULT false,
  "createdAt"    TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"    TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "Answer_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "Answer_questionId_hidden_idx" ON "Answer" ("questionId", "hidden");
CREATE INDEX IF NOT EXISTS "Answer_authorId_idx"          ON "Answer" ("authorId");

-- 2 ── the three vote-ish tables, deliberately not one mechanism ─────────────
CREATE TABLE IF NOT EXISTS "QuestionVote" (
  "id"         TEXT         NOT NULL,
  "questionId" TEXT         NOT NULL,
  "userId"     TEXT         NOT NULL,
  "createdAt"  TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "QuestionVote_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "QuestionVote_questionId_userId_key" ON "QuestionVote" ("questionId", "userId");
CREATE INDEX IF NOT EXISTS "QuestionVote_questionId_idx" ON "QuestionVote" ("questionId");

CREATE TABLE IF NOT EXISTS "AnswerVote" (
  "id"         TEXT             NOT NULL,
  "answerId"   TEXT             NOT NULL,
  "userId"     TEXT             NOT NULL,
  "direction"  TEXT             NOT NULL,
  -- Reserved for credibility weighting. Applied in the sort, but no weighting
  -- logic exists this sprint — the column is here so switching it on later is
  -- not a migration.
  "voteWeight" DOUBLE PRECISION NOT NULL DEFAULT 1.0,
  "createdAt"  TIMESTAMP(3)     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "AnswerVote_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "AnswerVote_answerId_userId_key" ON "AnswerVote" ("answerId", "userId");
CREATE INDEX IF NOT EXISTS "AnswerVote_answerId_idx" ON "AnswerVote" ("answerId");

-- PRIVATE. Never counted, never ranked, never exposed to anyone but its owner.
CREATE TABLE IF NOT EXISTS "AnswerFavourite" (
  "id"        TEXT         NOT NULL,
  "answerId"  TEXT         NOT NULL,
  "userId"    TEXT         NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "AnswerFavourite_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "AnswerFavourite_answerId_userId_key" ON "AnswerFavourite" ("answerId", "userId");
CREATE INDEX IF NOT EXISTS "AnswerFavourite_userId_idx" ON "AnswerFavourite" ("userId");

-- 3 ── moderation and collaboration ──────────────────────────────────────────
CREATE TABLE IF NOT EXISTS "AnswerFlag" (
  "id"          TEXT         NOT NULL,
  "answerId"    TEXT         NOT NULL,
  "level"       TEXT         NOT NULL,
  "reason"      TEXT         NOT NULL,
  "setByUserId" TEXT         NOT NULL,
  "setAt"       TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "AnswerFlag_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "AnswerFlag_answerId_key" ON "AnswerFlag" ("answerId");

CREATE TABLE IF NOT EXISTS "EditSuggestion" (
  "id"                TEXT         NOT NULL,
  "answerId"          TEXT         NOT NULL,
  "suggestedByUserId" TEXT         NOT NULL,
  "suggestedBody"     TEXT         NOT NULL,
  "status"            TEXT         NOT NULL DEFAULT 'PENDING',
  "createdAt"         TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "decidedAt"         TIMESTAMP(3),
  CONSTRAINT "EditSuggestion_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "EditSuggestion_answerId_status_idx"     ON "EditSuggestion" ("answerId", "status");
CREATE INDEX IF NOT EXISTS "EditSuggestion_suggestedByUserId_idx"   ON "EditSuggestion" ("suggestedByUserId");

-- 4 ── packs and tags ────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS "Pack" (
  "id"                 TEXT         NOT NULL,
  "ownerId"            TEXT         NOT NULL,
  "communityId"        TEXT         NOT NULL,
  "name"               TEXT         NOT NULL,
  "filter"             JSONB        NOT NULL DEFAULT '{}',
  "size"               INTEGER      NOT NULL DEFAULT 10,
  "pinnedQuestionIds"  TEXT[]       NOT NULL DEFAULT '{}',
  "removedQuestionIds" TEXT[]       NOT NULL DEFAULT '{}',
  "outputFormat"       TEXT         NOT NULL DEFAULT 'GLANCE',
  "createdAt"          TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"          TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "Pack_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "Pack_communityId_ownerId_idx" ON "Pack" ("communityId", "ownerId");

CREATE TABLE IF NOT EXISTS "QuestionTag" (
  "id"          TEXT         NOT NULL,
  "communityId" TEXT         NOT NULL,
  "kind"        TEXT         NOT NULL,
  "label"       TEXT         NOT NULL,
  "promoted"    BOOLEAN      NOT NULL DEFAULT false,
  "sortOrder"   INTEGER      NOT NULL DEFAULT 0,
  "createdAt"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "QuestionTag_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "QuestionTag_communityId_kind_label_key" ON "QuestionTag" ("communityId", "kind", "label");
CREATE INDEX IF NOT EXISTS "QuestionTag_communityId_kind_idx" ON "QuestionTag" ("communityId", "kind");

-- 5 ── foreign keys ──────────────────────────────────────────────────────────
DO $$
DECLARE fk RECORD;
BEGIN
  FOR fk IN
    SELECT * FROM (VALUES
      ('Question_communityId_fkey',           'Question',        'communityId',       'Community', 'RESTRICT'),
      ('Question_authorId_fkey',              'Question',        'authorId',          'User',      'RESTRICT'),
      ('Question_branchId_fkey',              'Question',        'branchId',          'Community', 'SET NULL'),
      ('Answer_questionId_fkey',              'Answer',          'questionId',        'Question',  'CASCADE'),
      ('Answer_authorId_fkey',                'Answer',          'authorId',          'User',      'RESTRICT'),
      ('QuestionVote_questionId_fkey',        'QuestionVote',    'questionId',        'Question',  'CASCADE'),
      ('QuestionVote_userId_fkey',            'QuestionVote',    'userId',            'User',      'CASCADE'),
      ('AnswerVote_answerId_fkey',            'AnswerVote',      'answerId',          'Answer',    'CASCADE'),
      ('AnswerVote_userId_fkey',              'AnswerVote',      'userId',            'User',      'CASCADE'),
      ('AnswerFavourite_answerId_fkey',       'AnswerFavourite', 'answerId',          'Answer',    'CASCADE'),
      ('AnswerFavourite_userId_fkey',         'AnswerFavourite', 'userId',            'User',      'CASCADE'),
      ('AnswerFlag_answerId_fkey',            'AnswerFlag',      'answerId',          'Answer',    'CASCADE'),
      ('AnswerFlag_setByUserId_fkey',         'AnswerFlag',      'setByUserId',       'User',      'RESTRICT'),
      ('EditSuggestion_answerId_fkey',        'EditSuggestion',  'answerId',          'Answer',    'CASCADE'),
      ('EditSuggestion_suggestedByUserId_fkey','EditSuggestion', 'suggestedByUserId', 'User',      'CASCADE'),
      ('Pack_ownerId_fkey',                   'Pack',            'ownerId',           'User',      'CASCADE'),
      ('Pack_communityId_fkey',               'Pack',            'communityId',       'Community', 'RESTRICT'),
      ('QuestionTag_communityId_fkey',        'QuestionTag',     'communityId',       'Community', 'RESTRICT')
    ) AS t(name, tbl, col, ref, ondelete)
  LOOP
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = fk.name) THEN
      EXECUTE format(
        'ALTER TABLE %I ADD CONSTRAINT %I FOREIGN KEY (%I) REFERENCES %I("id") ON DELETE %s ON UPDATE CASCADE',
        fk.tbl, fk.name, fk.col, fk.ref, fk.ondelete
      );
    END IF;
  END LOOP;
END $$;

-- 6 ── seed the tag set for every existing Community ─────────────────────────
-- Context tags are fixed by the design (the two-way "Out in the world" /
-- "Behind the scenes" toggle switches between the two kinds). Topics are the
-- admin-extendable list, seeded with six and promoted so the chip row starts
-- useful; anything added later is unpromoted and lives in the dropdown.
INSERT INTO "QuestionTag" ("id", "communityId", "kind", "label", "promoted", "sortOrder")
SELECT gen_random_uuid(), c."id", v.kind, v.label, v.promoted, v.ord
FROM "Community" c
CROSS JOIN (VALUES
  ('CONTEXT_EXTERNAL', 'Doorstep',         true, 1),
  ('CONTEXT_EXTERNAL', 'Media interview',  true, 2),
  ('CONTEXT_EXTERNAL', 'Hustings',         true, 3),
  ('CONTEXT_EXTERNAL', 'University AMA',   true, 4),
  ('CONTEXT_EXTERNAL', 'Council chamber',  true, 5),
  ('CONTEXT_INTERNAL', 'How-to',           true, 1),
  ('CONTEXT_INTERNAL', 'Party process',    true, 2),
  ('CONTEXT_INTERNAL', 'Tools & tech',     true, 3),
  ('TOPIC',            'Local finance',    true, 1),
  ('TOPIC',            'Local services',   true, 2),
  ('TOPIC',            'Organising',       true, 3),
  ('TOPIC',            'Energy',           true, 4),
  ('TOPIC',            'Immigration',      true, 5),
  ('TOPIC',            'Housing',          true, 6)
) AS v(kind, label, promoted, ord)
WHERE NOT EXISTS (
  SELECT 1 FROM "QuestionTag" t
  WHERE t."communityId" = c."id" AND t."kind" = v.kind AND t."label" = v.label
);
