// annotation-title.ts — how an explanatory note / memorandum names the Act or SI it explains.
//
// THE DEFECT (S2C, reported not fixed; S2C2 §2, approved). S2C made the annotation corpora
// reachable, and they arrived in the panel titled `Explanatory Notes: ukpga/2022/30 — Article 50
// (30)`. That is a machine identifier shown to a user. It is unreadable to anyone without legal
// training, which is the entire intended audience, and a source panel full of gids reads as
// unfinished software. Pilot B is people who do not know us.
//
// WHY THIS IS ITS OWN FILE. The obvious fix — teach fts-search.ts to read the Act's gid off the
// annotation id — touches a function every legislation result passes through, and there are TWO
// such functions: fts-search.ts and vector-search.ts build titles independently, and the dense
// path is live on the legislation stream (LEX_VECTOR_STREAMS=legislation). Fixing one and not the
// other would make a result's title depend on which retriever found it. So the rule lives here,
// once, and both adapters call it.
//
// ⚠ IT MUST FIRE ONLY FOR THE ANNOTATION CORPORA. Everything else must be byte-identical before
// and after — asserted over real hits by `check:annotation-titles`, not assumed. Hence the
// explicit corpus test rather than "does this id have four parts".

/** The two collections this applies to. Explicit, so no `explanatory-*` prefix rule can widen it. */
export const ANNOTATION_CORPORA = ['explanatory-notes', 'explanatory-memoranda'] as const

/** What the annotation is called, per corpus. */
const ANNOTATION_LABEL: Record<string, string> = {
  'explanatory-notes': 'Explanatory Notes',
  'explanatory-memoranda': 'Explanatory Memorandum',
}

export function isAnnotationCorpus(corpus: string): boolean {
  return (ANNOTATION_CORPORA as readonly string[]).includes(corpus)
}

/**
 * The gid of the Act or SI an annotation explains.
 *
 * Annotation ids carry FOUR segments — `explanatory-notes:en:ukpga/2022/30:1-0030` — where an
 * ordinary legislation id carries three (`primary-acts-2000plus:ukpga/2022/30:section-1`). That
 * is exactly why `gidFromId` returns null for them: it reads segment 1, which here is the `en`/`em`
 * discriminator. The gid is segment 2.
 *
 * Returns null rather than guessing when the shape is not what is described above; the caller
 * then keeps the string it already had.
 */
export function annotatedGidFromId(id: string): string | null {
  const parts = id.split(':')
  if (parts.length < 4) return null
  const gid = parts[2]
  return gid && gid.includes('/') ? gid : null
}

/**
 * Title + citation for one annotation row.
 *
 * ⚠ FALLS BACK TO THE EXISTING STRING, NEVER TO A BLANK OR A PARTIAL. 94.9% of annotation rows
 * resolve to an Act title (99.95% of notes, 91.4% of memoranda — the remainder are 2,350 uksi
 * gids with no title in `corpus_acts`). A gid is ugly; an empty title is a defect, and a title
 * reading "Explanatory Notes —" with nothing after it is worse than either.
 *
 * @param actTitle the resolved title, or null/undefined when the gid did not resolve
 * @param current  what the adapter would otherwise have shown (the FTS/DB sectionTitle, or the
 *                 corpus name when even that is absent)
 */
export function annotationTitle(
  corpus: string,
  actTitle: string | null | undefined,
  current: string,
): { title: string; citation: string } {
  const label = ANNOTATION_LABEL[corpus] ?? 'Explanatory material'
  if (!actTitle) return { title: current, citation: current === corpus ? label : current }
  // "Explanatory Notes — Building Safety Act 2022". The em-dash separator matches the citation
  // style used for legislation ("{Act}, s.21") closely enough to read as one family, and the
  // Act's name — not the annotation's paragraph number — is the thing a reader is scanning for.
  return { title: `${label} — ${actTitle}`, citation: `${label} to ${actTitle}` }
}
