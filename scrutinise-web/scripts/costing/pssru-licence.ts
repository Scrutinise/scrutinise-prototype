// The licence statement for every PSSRU/CoReC CostBenchmark row (decision, 4 Nov 2026).
// One definition, imported by m5-pssru.ts (the loader) and pssru-licence-apply.ts (the one-off
// restatement), so the loader cannot put the old "openly published" wording back on a re-run.
//
// CostBenchmark has NO licence column; until one exists (D-4, a schema change for Charlie/CCh)
// the statement lives at the start of `notes`, in a fixed machine-readable form: `licence=<value>;`.
export const PSSRU_LICENCE = 'all-rights-reserved-presumed'

export const PSSRU_LICENCE_NOTE =
  `licence=${PSSRU_LICENCE}; ` +
  'The Kent Academic Repository record for Unit Costs of Health and Social Care 2025 (kar.kent.ac.uk/115569, re-read 4 Nov 2026) ' +
  'states no licence, no Creative Commons designation and no copyright notice; its only relevant line is "freely available online", ' +
  'which is access, not reuse. Absent a statement the default is all rights reserved. ' +
  'Treat like BAILII: cite the source, quote the specific line with a link to the publisher, do not republish the figure. ' +
  'Relax to full republication only if PSSRU confirm terms in writing.'
