-- LEX 26-B §3 — the three avenues a kernel evaluates (17 Sep 2026).
--
-- The instrument comes OUT of the strategy, never in before it. Every build's coherent-actions
-- pass now evaluates a legislative, an organisational and a financial route, each drafted,
-- costed for difficulty and given its trade-offs to comparable depth — and one that does not
-- apply says so and why rather than being omitted. One row per (build, avenue), so the depth
-- of each treatment is a column a query can compare across builds (§3a's median), not a
-- reading of prose.
--
-- `chars` is the length of the treatment as written (draft + difficulty + trade-offs), stored
-- at write time so "worked to the same depth" is measurable without re-reading every row.
-- `existingPower*` hold the research pass's finding on the legislative avenue (§3c): a
-- finding beside the route, never an override.
--
-- Additive: a new table, cascade on both parents (an avenue is a detail of its build).

CREATE TABLE IF NOT EXISTS "BuildAvenue" (
  "id"                 TEXT PRIMARY KEY,
  "buildId"            TEXT NOT NULL REFERENCES "IdeaBuild"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  "ideaId"             TEXT NOT NULL REFERENCES "Idea"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  "avenue"             TEXT NOT NULL,
  "applies"            BOOLEAN NOT NULL DEFAULT TRUE,
  "whyNotApplicable"   TEXT,
  "draft"              TEXT NOT NULL,
  "difficulty"         TEXT NOT NULL,
  "tradeoffs"          TEXT NOT NULL,
  "rulesIn"            TEXT NOT NULL,
  "rulesOut"           TEXT NOT NULL,
  "whatWouldSettleIt"  TEXT NOT NULL,
  "existingPower"      TEXT,
  "existingPowerReach" TEXT,
  "chars"              INTEGER NOT NULL DEFAULT 0,
  "createdAt"          TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"          TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE UNIQUE INDEX IF NOT EXISTS "BuildAvenue_buildId_avenue_key" ON "BuildAvenue"("buildId", "avenue");
CREATE INDEX IF NOT EXISTS "BuildAvenue_ideaId_idx" ON "BuildAvenue"("ideaId");
