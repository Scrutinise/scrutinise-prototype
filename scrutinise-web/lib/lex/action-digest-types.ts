// The words for the digest's controls - NO IMPORTS, so the browser bundle can read them without zod (docs/CLAUDE.md §28, §30).
export const DIGEST_OP_WORDS = {
  start: '“Ask four models”',
  advance: 'Carrying on with the digest',
  retry: '“Ask the ones that failed again”',
  suggestGaps: '“Add the gaps as suggestions”',
} as const

export const DIGEST_INPUT_WORDS: Record<string, string> = {
  op: 'the control',
  scope: 'what to ask about (a heading, or the whole set)',
  headingId: 'the heading',
  digestId: 'the digest',
  index: 'the gap',
}
