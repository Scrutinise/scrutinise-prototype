// Shared text comparison for the Starkey corpus.
//
// One implementation, imported everywhere. A re-stated similarity function in
// two scripts is how two reports come to disagree about the same pair of
// transcripts for reasons nobody can find.

/**
 * Strip everything that is structure rather than speech, BEFORE tokenising.
 *
 * Not optional tidying. The transcript tools each stamp a time on every line in
 * a different notation — TurboScribe `(1:36)`, summarize.ing `[00:02]`,
 * tactiq.io a bare `00:00:02.240` — and the tokeniser keeps digits, so an
 * unstripped timestamp adds three or four tokens roughly every two seconds of
 * speech. A first pass without this scored the tactiq/summarize documents
 * 0.61-0.81 against the ASR and the TurboScribe ones 0.90-0.94, inverting the
 * two classes: it was measuring which notation the tool used, not the words.
 */
export function stripStructure(s: string): string {
  return s
    .replace(/^#.*$/gm, ' ')                                  // tactiq.io header lines
    .replace(/https?:\/\/\S+/g, ' ')                          // source URLs
    .replace(/\(\d{1,2}:\d{2}(?::\d{2})?\)/g, ' ')            // TurboScribe (1:36)
    .replace(/\[\d{1,2}:\d{2}(?::\d{2})?\]/g, ' ')            // summarize.ing [00:02]
    .replace(/\b\d{1,2}:\d{2}:\d{2}[.,]\d{1,3}\b/g, ' ')      // tactiq 00:00:02.240
    .replace(/\b\d{1,2}:\d{2}:\d{2}\b/g, ' ')                 // bare H:MM:SS
    .replace(/\b\d{1,2}:\d{2}\b/g, ' ')                       // bare M:SS
    .replace(/>>/g, ' ')                                      // tactiq speaker turns
    .replace(/\[Music\]|\bNo text\b/gi, ' ')
}

/** Words only, lower-cased, apostrophes kept. Punctuation differences vanish here. */
export function norm(s: string): string[] {
  return stripStructure(s).toLowerCase().replace(/[^a-z0-9' ]+/g, ' ').split(/\s+/).filter(Boolean)
}

/**
 * 2*LCS/(|a|+|b|) over token sequences — a SEQUENCE measure, so a document that
 * merely shares a speaker's vocabulary with a different recording scores low.
 * Rolling two-row DP: O(n*m) time, O(m) space.
 */
export function lcsRatio(a: string[], b: string[]): number {
  if (!a.length || !b.length) return 0
  let prev = new Uint32Array(b.length + 1)
  let cur = new Uint32Array(b.length + 1)
  for (let i = 1; i <= a.length; i++) {
    for (let j = 1; j <= b.length; j++) {
      cur[j] = a[i - 1] === b[j - 1] ? prev[j - 1] + 1 : Math.max(prev[j], cur[j - 1])
    }
    const t = prev; prev = cur; cur = t; cur.fill(0)
  }
  return (2 * prev[b.length]) / (a.length + b.length)
}
