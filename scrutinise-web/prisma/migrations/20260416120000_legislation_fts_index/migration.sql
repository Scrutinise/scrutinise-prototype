-- Add full-text search index on LegislationSection
-- NOTE: Column name casing must be verified before applying.
-- Run \d "LegislationSection" in psql to confirm exact column names
-- (Prisma maps camelCase fields to snake_case columns in PostgreSQL by default,
-- e.g. compiledText → "compiledText" or compiled_text depending on configuration).
-- Apply directly via psql against the Railway DB when ingestion is ready.

CREATE INDEX IF NOT EXISTS legislation_section_fts
ON "LegislationSection"
USING gin(
  to_tsvector('english',
    coalesce("compiledText", '') || ' ' ||
    coalesce("sectionTitle", '') || ' ' ||
    coalesce("policyArea", '')
  )
);

-- Add index on tags array for tag-based filtering
CREATE INDEX IF NOT EXISTS legislation_section_tags
ON "LegislationSection"
USING gin(tags);

-- Add index on jurisdiction and inForce for filtering
CREATE INDEX IF NOT EXISTS legislation_section_jurisdiction
ON "LegislationSection" (jurisdiction, "inForce");
