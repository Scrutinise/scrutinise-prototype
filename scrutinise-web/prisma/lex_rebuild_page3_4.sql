-- Lex rebuild — Sprint 3 (Page 2 refinements + causal tree + Page 3 Guiding Policy +
-- Page 4 Coherent Actions + costing shell). Additive, idempotent.
-- Applied to Neon (production app DB after the V26 cutover). NOT applied to Railway.
-- See docs/LEX_REBUILD_DESIGN.md §16–§19, docs/LEX_DESIGN_ADDENDUM_16-19.md.

-- ── Enums ─────────────────────────────────────────────────────────────────────
DO $$ BEGIN
  CREATE TYPE "CauseClassification" AS ENUM ('MATERIAL','CONTRIBUTORY','UNASSESSED');
EXCEPTION WHEN duplicate_object THEN null; END $$;
DO $$ BEGIN
  CREATE TYPE "LexEntitySource" AS ENUM ('USER','LEX');
EXCEPTION WHEN duplicate_object THEN null; END $$;
DO $$ BEGIN
  CREATE TYPE "PolicyOptionStatus" AS ENUM ('CANDIDATE','CHOSEN','RULED_OUT');
EXCEPTION WHEN duplicate_object THEN null; END $$;

-- ── Page 2 refinements (§16.1) + causal tree (§16.2) on DiagnosisCause ─────────
ALTER TABLE "DiagnosisCause" ADD COLUMN IF NOT EXISTS "classification" "CauseClassification" NOT NULL DEFAULT 'UNASSESSED';
ALTER TABLE "DiagnosisCause" ADD COLUMN IF NOT EXISTS "parentCauseId" TEXT;
DO $$ BEGIN
  ALTER TABLE "DiagnosisCause" ADD CONSTRAINT "DiagnosisCause_parentCauseId_fkey"
    FOREIGN KEY ("parentCauseId") REFERENCES "DiagnosisCause"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null; END $$;
CREATE INDEX IF NOT EXISTS "DiagnosisCause_parentCauseId_idx" ON "DiagnosisCause"("parentCauseId");

-- ── Page 3 (Guiding Policy) + Page 4 (Coherent Actions) aggregate columns on Idea
ALTER TABLE "Idea" ADD COLUMN IF NOT EXISTS "chosenApproach" TEXT;
ALTER TABLE "Idea" ADD COLUMN IF NOT EXISTS "whatItRulesOut" TEXT;
ALTER TABLE "Idea" ADD COLUMN IF NOT EXISTS "leverage" TEXT;
ALTER TABLE "Idea" ADD COLUMN IF NOT EXISTS "anticipatedResponses" JSONB;
ALTER TABLE "Idea" ADD COLUMN IF NOT EXISTS "conditionsForSuccessLex" TEXT;
ALTER TABLE "Idea" ADD COLUMN IF NOT EXISTS "coherenceCheck" TEXT;
ALTER TABLE "Idea" ADD COLUMN IF NOT EXISTS "costSummary" JSONB;

-- ── Page 3 child table: PolicyOption (§17) ────────────────────────────────────
CREATE TABLE IF NOT EXISTS "PolicyOption" (
  "id" TEXT NOT NULL,
  "ideaId" TEXT NOT NULL,
  "approach" TEXT NOT NULL,
  "mechanismTypes" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  "targetCauseIds" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  "caseFor" TEXT,
  "caseAgainst" TEXT,
  "status" "PolicyOptionStatus" NOT NULL DEFAULT 'CANDIDATE',
  "ruleOutReason" TEXT,
  "source" "LexEntitySource" NOT NULL DEFAULT 'USER',
  "orderIndex" INTEGER NOT NULL DEFAULT 0,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "PolicyOption_pkey" PRIMARY KEY ("id")
);
DO $$ BEGIN
  ALTER TABLE "PolicyOption" ADD CONSTRAINT "PolicyOption_ideaId_fkey"
    FOREIGN KEY ("ideaId") REFERENCES "Idea"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null; END $$;
CREATE INDEX IF NOT EXISTS "PolicyOption_ideaId_idx" ON "PolicyOption"("ideaId");

-- ── Page 4 child table: LexCoherentAction (§18.1/§18.2) ────────────────────────
CREATE TABLE IF NOT EXISTS "LexCoherentAction" (
  "id" TEXT NOT NULL,
  "ideaId" TEXT NOT NULL,
  "practicalStep" TEXT NOT NULL,
  "mechanismType" TEXT,
  "whoImplements" TEXT,
  "targetOrganisation" TEXT,
  "wording" TEXT,
  "benefits" JSONB,
  "implementationCost" JSONB,
  "enforcementCost" JSONB,
  "regulatoryFriction" JSONB,
  "source" "LexEntitySource" NOT NULL DEFAULT 'USER',
  "orderIndex" INTEGER NOT NULL DEFAULT 0,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "LexCoherentAction_pkey" PRIMARY KEY ("id")
);
DO $$ BEGIN
  ALTER TABLE "LexCoherentAction" ADD CONSTRAINT "LexCoherentAction_ideaId_fkey"
    FOREIGN KEY ("ideaId") REFERENCES "Idea"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null; END $$;
CREATE INDEX IF NOT EXISTS "LexCoherentAction_ideaId_idx" ON "LexCoherentAction"("ideaId");

-- ── Costing engine: CostBenchmark + IdeaAssumption (§18.3) ─────────────────────
CREATE TABLE IF NOT EXISTS "CostBenchmark" (
  "id" TEXT NOT NULL,
  "domain" TEXT NOT NULL,
  "metric" TEXT NOT NULL,
  "unit" TEXT NOT NULL,
  "low" DECIMAL(65,30),
  "high" DECIMAL(65,30),
  "source" TEXT NOT NULL,
  "sourceUrl" TEXT,
  "year" INTEGER,
  "method" TEXT,
  "notes" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "CostBenchmark_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "CostBenchmark_domain_idx" ON "CostBenchmark"("domain");

CREATE TABLE IF NOT EXISTS "IdeaAssumption" (
  "id" TEXT NOT NULL,
  "ideaId" TEXT NOT NULL,
  "benchmarkId" TEXT,
  "userValue" TEXT,
  "userEvidence" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "IdeaAssumption_pkey" PRIMARY KEY ("id")
);
DO $$ BEGIN
  ALTER TABLE "IdeaAssumption" ADD CONSTRAINT "IdeaAssumption_ideaId_fkey"
    FOREIGN KEY ("ideaId") REFERENCES "Idea"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null; END $$;
CREATE INDEX IF NOT EXISTS "IdeaAssumption_ideaId_idx" ON "IdeaAssumption"("ideaId");

-- ── Hand-seeded placeholder benchmark set (§18.3) so the costing flow is testable
--    before the Phase-2 research programme lands. Every row is clearly marked as a
--    placeholder. Idempotent: only insert when the table is empty.
INSERT INTO "CostBenchmark" ("id","domain","metric","unit","low","high","source","sourceUrl","year","method","notes")
SELECT * FROM (VALUES
  ('seed-qaly',          'health',        'QALY (quality-adjusted life year)',        '£/QALY',       20000, 30000, 'NICE / HM Treasury Green Book', 'https://www.gov.uk/government/publications/the-green-book-appraisal-and-evaluation-in-central-government', 2022, 'placeholder — Phase 2 research pending', 'NICE cost-effectiveness threshold band.'),
  ('seed-vpf',           'safety',        'Value of a prevented fatality',            '£/fatality',   2400000, 2600000, 'DfT WebTAG',                 'https://www.gov.uk/guidance/transport-analysis-guidance-webtag', 2023, 'placeholder — Phase 2 research pending', 'Order-of-magnitude only.'),
  ('seed-vot',           'transport',     'Value of time (non-work)',                 '£/hour',       8, 12,     'DfT WebTAG',                     'https://www.gov.uk/guidance/transport-analysis-guidance-webtag', 2023, 'placeholder — Phase 2 research pending', 'Illustrative.'),
  ('seed-admin-burden',  'admin-burden',  'Standard admin-burden cost per form',      '£/form',       5, 40,     'Standard Cost Model (illustrative)', NULL, 2020, 'placeholder — Phase 2 research pending', 'Per business interaction.'),
  ('seed-reg-officer',   'enforcement',   'Regulatory officer fully-loaded cost',     '£/FTE-year',   55000, 75000, 'Illustrative departmental average', NULL, 2024, 'placeholder — Phase 2 research pending', 'Includes on-costs.'),
  ('seed-it-system',     'implementation','New government IT/case system (one-off)',   '£/system',     500000, 5000000, 'Illustrative',                NULL, 2024, 'placeholder — Phase 2 research pending', 'Wide range by scale.'),
  ('seed-guidance',      'implementation','Statutory guidance production + rollout',   '£/programme',  50000, 300000, 'Illustrative',                  NULL, 2024, 'placeholder — Phase 2 research pending', 'One-off.'),
  ('seed-inspection',    'enforcement',   'Inspection / audit visit',                 '£/visit',      300, 1500,   'Illustrative',                   NULL, 2024, 'placeholder — Phase 2 research pending', 'Per site.'),
  ('seed-compliance-sme','regulatory-friction','SME annual compliance cost per rule', '£/SME-year',   200, 2000,   'Illustrative',                   NULL, 2024, 'placeholder — Phase 2 research pending', 'Ongoing burden on the economy.'),
  ('seed-carbon',        'environment',   'Central carbon value (traded/non-traded)', '£/tCO2e',      120, 380,    'BEIS/DESNZ carbon values',       'https://www.gov.uk/government/publications/valuing-greenhouse-gas-emissions-in-policy-appraisal', 2023, 'placeholder — Phase 2 research pending', 'Rises over time.')
) AS v("id","domain","metric","unit","low","high","source","sourceUrl","year","method","notes")
WHERE NOT EXISTS (SELECT 1 FROM "CostBenchmark");
