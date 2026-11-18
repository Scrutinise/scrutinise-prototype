-- ─────────────────────────────────────────────────────────────────────────────
-- LEX 26-Y (BRIEF_26Y; decisions 334–341) — cost–benefit analysis. ADDITIVE ONLY: nothing is dropped, renamed or rewritten.
--
-- Part 1 RECORDS what was already on Neon (ep-old-dust-aboxi69a) on 18 Nov 2026, read from information_schema before this file was
-- written. It was applied by an earlier 26-Y session whose code never reached the repository (cc-lex-26y, inbox 2026-11-18T1058Z).
-- Every statement is IF NOT EXISTS, so applying this file to that database changes nothing in Part 1.
-- Part 2 is NEW in this file.
-- ─────────────────────────────────────────────────────────────────────────────

-- ── Part 1 · already present ─────────────────────────────────────────────────

-- 334 — benefit lines on the action, beside cost lines.
--   status:    ACCEPTED (on the action) | PROPOSED (Lex's, waiting) | SET_ASIDE (a proposal not taken) | REMOVED (taken off; kept, never deleted)
--   valuation: VALUED (an amount with a source) | NOT_VALUED (never enters a total)
--   sourceKind: REF ([Ref: n] = sourceRef) | BENCHMARK (CostBenchmark row = benchmarkId) | CITATION (manifest key = citationKey) | OWNER (ownerReason)
CREATE TABLE IF NOT EXISTS "BenefitLine" (
  "id"              text PRIMARY KEY,
  "actionId"        text NOT NULL REFERENCES "LexCoherentAction"("id") ON UPDATE CASCADE ON DELETE CASCADE,
  "label"           text NOT NULL,
  "beneficiary"     text NOT NULL DEFAULT 'OTHER',
  "beneficiaryName" text,
  "measure"         text,
  "low"             double precision,
  "high"            double precision,
  "unit"            text DEFAULT 'GBP',
  "priceYear"       integer,
  "recurrence"      text,
  "durationMonths"  double precision,
  "isHealth"        boolean NOT NULL DEFAULT false,
  "sourceKind"      text,
  "sourceRef"       integer,
  "benchmarkId"     text,
  "citationKey"     text,
  "ownerReason"     text,
  "notValuedWhy"    text,
  "valuation"       text NOT NULL DEFAULT 'NOT_VALUED',
  "status"          text NOT NULL DEFAULT 'ACCEPTED',
  "proposedWhy"     text,
  "orderIndex"      integer NOT NULL DEFAULT 0,
  "createdAt"       timestamp(3) without time zone NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"       timestamp(3) without time zone NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS "BenefitLine_actionId_idx" ON "BenefitLine"("actionId");

-- 337 — a cost line's citation, a key of the citation manifest.
ALTER TABLE "CostLine" ADD COLUMN IF NOT EXISTS "citationKey" text;

-- 335 / §6 — the idea's appraisal settings. NULL = the default (10 years; start = price year = the default price year).
ALTER TABLE "Idea" ADD COLUMN IF NOT EXISTS "appraisalYears" integer;
ALTER TABLE "Idea" ADD COLUMN IF NOT EXISTS "appraisalStartYear" integer;
ALTER TABLE "Idea" ADD COLUMN IF NOT EXISTS "cbaPriceYear" integer;

-- ── Part 2 · new ─────────────────────────────────────────────────────────────

-- §3.1 / 339 / 340 — what the Green Book shape needs of a cost line that it does not hold yet, in one jsonb:
--   { "payer": { "kind": "EXCHEQUER"|"DEPARTMENT"|"CITIZENS"|"BUSINESS"|"OTHER", "name": string|null },
--     "onCost": { "rate": number, "source": string, "by": "OWNER"|"LEX", "status": "ACCEPTED"|"PROPOSED" },
--     "ob": { "type": <Table 1 project type>, "lowered": { "rate": number, "reason": string } | null } }
-- NULL = none of it said.
ALTER TABLE "CostLine" ADD COLUMN IF NOT EXISTS "appraisal" jsonb;

-- 336 — the Cost–benefit report (and, in Y2, the IA draft) as an Output Report: versioned, never overwritten.
--   inputs: the per-line fingerprint the version was built from, so a later read can say "stale: N lines changed since".
--   result: the engine's output as printed (every figure with its trace).
CREATE TABLE IF NOT EXISTS "CbaReport" (
  "id"            text PRIMARY KEY,
  "ideaId"        text NOT NULL REFERENCES "Idea"("id") ON UPDATE CASCADE ON DELETE CASCADE,
  "kind"          text NOT NULL DEFAULT 'CBA',
  "version"       integer NOT NULL,
  "inputs"        jsonb NOT NULL,
  "result"        jsonb NOT NULL,
  "narrative"     text,
  "narrativePence" double precision,
  "docxKey"       text,
  "pdfKey"        text,
  "generatedById" text,
  "createdAt"     timestamp(3) without time zone NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE UNIQUE INDEX IF NOT EXISTS "CbaReport_ideaId_kind_version_key" ON "CbaReport"("ideaId", "kind", "version");
CREATE INDEX IF NOT EXISTS "CbaReport_ideaId_idx" ON "CbaReport"("ideaId");
