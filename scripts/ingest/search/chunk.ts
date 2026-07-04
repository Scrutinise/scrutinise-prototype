/**
 * chunk.ts — the VALIDATED pilot chunker, extracted pure (no side effects) so the
 * full-corpus embed (build-corpus-chunks.ts) uses byte-identical chunking to the
 * bake-off pilot (pilot-chunk.ts). The pilot proved the model choice on chunks
 * produced by exactly this logic, so the full corpus must be chunked the same way
 * or the pilot's recall numbers don't transfer.
 *
 * Approach (brief §Chunking, already validated in the pilot):
 *   - short sections whole (≤ WHOLE_CHARS ≈ 1024 tokens);
 *   - long sections split into ~800-token windows (WINDOW_CHARS) with ~15% overlap
 *     (OVERLAP_CHARS), snapped forward to a word boundary;
 *   - capped at MAX_CHUNKS windows so a runaway debate/committee section can't emit
 *     hundreds of chunks (the cap is what keeps the embed-token count — and thus the
 *     cost — bounded on the long tail; see docs/VECTOR_EMBED_REPORT.md).
 * The parent section id is carried on every chunk downstream (`{sectionId}#{k}`) so a
 * chunk hit maps back to its section for scoring + citation.
 *
 * Defaults match pilot-chunk.ts exactly. Env overrides share the pilot's names so a
 * re-tune moves both in lockstep.
 */

export const WHOLE_CHARS = parseInt(process.env.PILOT_WHOLE_CHARS ?? '4096', 10)    // ≤ this → one whole chunk (~1024 tok)
export const WINDOW_CHARS = parseInt(process.env.PILOT_WINDOW_CHARS ?? '3200', 10)  // window width (~800 tok)
export const OVERLAP_CHARS = parseInt(process.env.PILOT_OVERLAP_CHARS ?? '480', 10) // ~15% overlap (~120 tok)
export const MAX_CHUNKS = parseInt(process.env.PILOT_MAX_CHUNKS ?? '8', 10)         // cap runaway (long debate) sections

/** short whole; long → overlapping windows, snapped to word boundaries, capped. */
export function chunkBody(raw: string): string[] {
  const text = (raw ?? '').replace(/\s+/g, ' ').trim()
  if (!text) return []
  if (text.length <= WHOLE_CHARS) return [text]
  const out: string[] = []
  let start = 0
  while (start < text.length && out.length < MAX_CHUNKS) {
    let end = Math.min(start + WINDOW_CHARS, text.length)
    if (end < text.length) {
      const sp = text.indexOf(' ', end)
      if (sp !== -1 && sp - end < 200) end = sp // snap forward to a space
    }
    out.push(text.slice(start, end).trim())
    if (end >= text.length) break
    start = end - OVERLAP_CHARS
  }
  return out
}
