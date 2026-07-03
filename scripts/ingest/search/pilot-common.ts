/**
 * pilot-common.ts — side-effect-free shared constants for the vector pilot.
 *
 * The table-name constants live here (NOT in pilot-chunk.ts) because pilot-chunk.ts
 * runs main() on load — importing a constant from it would re-trigger the whole
 * chunk rebuild. Keep this module free of any top-level side effects.
 */
export const PILOT_CHUNKS = process.env.PILOT_CHUNKS_TABLE ?? 'pilot_chunks'
export function vecTable(slug: string): string { return `pilot_vec_${slug}` }
export function embedCheckpointKey(slug: string): string { return `_search/pilot/embed-${slug}.checkpoint.json` }
