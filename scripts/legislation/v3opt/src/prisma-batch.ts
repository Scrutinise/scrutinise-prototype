import { CompilationStatus } from './runtime-deps'
import { getPrisma } from './db'

export interface SectionDbRecord {
  legislationItemId: string
  sectionNumber: string
  sectionTitle: string | null
  tnaXmlKey?: string
  originalXmlKey?: string
  originalText: string
}

// Uses createMany + skipDuplicates so resume after a crash is idempotent.
// The unique constraint (legislationItemId, sectionNumber) ensures existing rows
// are silently skipped on duplicate; no partial-write risk.
export async function batchDbCreate(records: SectionDbRecord[]): Promise<number> {
  if (records.length === 0) return 0
  const result = await getPrisma().legislationSection.createMany({
    data: records.map(r => ({
      ...r,
      compilationStatus: CompilationStatus.PENDING,
    })),
    skipDuplicates: true,
  })
  return result.count
}
