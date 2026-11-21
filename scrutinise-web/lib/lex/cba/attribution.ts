// ─────────────────────────────────────────────────────────────────────────────
// 26-AA item 9(a) — A HELD FIGURE'S LICENCE ATTRIBUTION, read from the row it came from. PURE; CLIENT-SAFE (imports nothing).
//
// GMCA's Unit Cost Database is CC BY 4.0: wherever one of its figures is shown or cited (the screen, the costing document, an export) the
// attribution must go with it, in the form GMCA asks for. Ingest wrote that form verbatim into `notes` on every m4-* CostBenchmark row
// (cc-ingest → cc-lex, 20 Nov 17:36):
//   "licence=cc-by-4.0; attribution required, in this form: <THE ATTRIBUTION>. Figure held at its original price year; …"
// The attribution is READ from the row, never written here, so a licence register change reaches every place that shows the figure.
//
// ⚠ A row whose notes name a licence requiring attribution but whose form cannot be read is NOT silently shown bare: `attributionOf`
//   returns `{ required: true, text: null }`, and the callers say "attribution required: see the source" rather than nothing.
// ─────────────────────────────────────────────────────────────────────────────

export interface Attribution { required: boolean; text: string | null; licence: string | null }

const LICENCE = /\blicence=([a-z0-9.-]+)/i
const FORM = /attribution required, in this form:\s*([\s\S]+?\((?:https?:\/\/)?creativecommons\.org\/licenses\/[^)\s]+\))/i

/** The attribution a held row's `notes` demands, if any. */
export function attributionOf(notes: string | null | undefined): Attribution {
  const n = notes ?? ''
  const licence = LICENCE.exec(n)?.[1]?.toLowerCase() ?? null
  // every Creative Commons BY licence requires attribution, whatever else it adds
  const required = /attribution required/i.test(n) || (licence != null && /^cc-by\b/.test(licence))
  if (!required) return { required: false, text: null, licence }
  const text = FORM.exec(n)?.[1]?.replace(/\s+/g, ' ').trim() ?? null
  return { required: true, text, licence }
}

/** The words shown beside a figure: the attribution itself, or, where one is required and unreadable, a worded refusal to show it bare. */
export function attributionWords(a: Attribution): string | null {
  if (!a.required) return null
  return a.text ?? 'Attribution required by the source’s licence: see the source.'
}
