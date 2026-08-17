-- lex_unmet.sql — BRIEF_SEARCH_S5 §4. What Lex looked for and could not get.
--
-- ⚠ WHY THIS IS WORTH A TABLE. §4: "every unmet request should be logged. V37's gap-filler
-- expects exactly this signal: what Lex looked for and could not get is the most direct evidence
-- available about what the corpus should hold next."
--
-- Every other signal we have about corpus gaps is inferred — completeness sweeps, citation
-- ranking, reachability matrices. This one is not inferred: it is a real user, asking a real
-- question, on a real idea, and getting nothing. V37's own finding was that citation ranking beat
-- completeness sweeping because it was closer to demand; this is closer still.
--
-- ⚠ NO QUESTION TEXT IS STORED. The question a user asks Lex about their own idea is private
-- (Stage 1 ideas are private by design), and a gap log is not a reason to start keeping a copy of
-- it. What is stored is the KIND that was wanted and the keywords that were searched — enough to
-- tell the ingest stream "people keep asking for committee evidence on housing and getting
-- nothing", and not enough to reconstruct anybody's idea.
--
-- Applied by:  npx tsx --env-file=.env scripts/apply-sql.ts prisma/lex_unmet.sql
-- Additive and idempotent. No DROP in this file.

CREATE TABLE IF NOT EXISTS "LexUnmetRequest" (
  id           BIGSERIAL PRIMARY KEY,

  -- The display type the question plainly asked for and the search did not return.
  kind         TEXT NOT NULL,

  -- The keywords that were actually searched — the query as the retrieval layer saw it, not the
  -- user's sentence. ⚠ Truncated at 200 chars by the writer.
  keywords     TEXT NOT NULL,

  -- Which streams the router chose. ⚠ THE MOST DIAGNOSTIC COLUMN HERE, because it separates two
  -- completely different failures that look identical from outside: the router never selected the
  -- committees stream (a routing problem, ours to fix today) versus it searched committees and
  -- found nothing (a corpus problem, the ingest stream's). Without this the gap-filler would be
  -- handed a work list contaminated with our own routing bugs.
  streams      TEXT,

  -- How many results came back in total, across both channels. Zero and forty mean different
  -- things: zero is "we found nothing at all", forty is "we found plenty, none of it the kind
  -- asked for" — and only the second is evidence about the corpus.
  n_results    INTEGER NOT NULL DEFAULT 0,

  -- ⚠ NULLABLE, and no foreign key. A gap is worth knowing about after the idea is deleted.
  "ideaId"     TEXT,

  "createdAt"  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS "LexUnmetRequest_kind_idx" ON "LexUnmetRequest" (kind, "createdAt");

-- The view the ingest stream should read: what is most asked for and least served.
CREATE OR REPLACE VIEW "LexUnmetDemand" AS
SELECT kind,
       COUNT(*)                                            AS requests,
       COUNT(DISTINCT "ideaId")                            AS ideas,
       -- ⚠ Split, because they are different findings. "The router never looked" is our bug;
       -- "we looked and the corpus is empty" is the ingest stream's work list.
       COUNT(*) FILTER (WHERE streams IS NULL
                          OR streams NOT ILIKE '%' || lower(kind) || '%') AS never_searched,
       COUNT(*) FILTER (WHERE n_results = 0)               AS returned_nothing_at_all,
       MAX("createdAt")                                    AS last_seen
FROM "LexUnmetRequest"
GROUP BY kind;
