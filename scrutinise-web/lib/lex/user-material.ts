// ─────────────────────────────────────────────────────────────────────────────
// 25-D §4 / §25.6 — DOCUMENTS AND LINKS: AN EVIDENCE SOURCE, NOT CONTEXT.
//
// Page 1 already asks the user whether they have anything to read. Until now that captured
// the INTENT and nothing else. This makes it real, and the three rules that make it
// affordable are all rules about what we DON'T do.
//
// ⚠⚠ 1. STORE THE EXTRACTED TEXT, NEVER THE BINARY. ~30KB a document; ten thousand users at
// fifty documents each is about 15GB and pennies a month, so storage was never the
// constraint. TOKEN COST AND LIABILITY ARE. A stored PDF is a thing we must hold, serve,
// back up and erase on request — and it is an invitation for some future caller to hand the
// whole file to a model. No binary is written anywhere: not to the database, not to R2.
//
// ⚠⚠ 2. NEVER INJECT A DOCUMENT WHOLESALE INTO A PROMPT. This is the rule that decides the
// whole shape. The obvious build — keep the text, paste it into the system prompt "for
// context" — costs the full document on EVERY TURN, forever, and buys a model that has
// skimmed fifty pages badly. So on ingest the document is READ ONCE, by the same pass shape
// the Deepening uses, and turned into FINDINGS WITH PROVENANCE. The findings go into the
// evidence layer like any other source and are retrieved when relevant. A fifty-page report
// then costs nothing per turn and still surfaces its one useful paragraph at the right
// moment. `check:lex-25d` asserts that no prompt anywhere interpolates `material.text`.
//
// ⚠⚠ 3. THE FINDINGS ARE FILED UNDER THE QUESTION THEY ANSWER, not under "the user's stuff".
// §4: "Findings from a user document appear in the panel UNDER THE QUESTION THEY ANSWER,
// alongside corpus material, and are visibly marked as the user's own source." Both halves
// matter. Filing them all under "Your material" would leave a user reading "how the courts
// have read it" unaware that their own document answers it; dropping the mark would let a
// document they uploaded look like something we found.
//
// Liability (§25.6): the user asserts they may share it; the text is deleted with the idea
// (GDPR erasure, by cascade — never a soft delete); documents are private to the idea and
// its team, which holds because every path here goes through `authorizeIdea`.
// ─────────────────────────────────────────────────────────────────────────────

import { prisma } from '@/lib/prisma'
import {
  MaterialRejected, isVideoUrl, isKnownPaywall, VIDEO_MESSAGE, PAYWALL_MESSAGE,
} from './material-rejection'
import { callJson, llmOk } from './build-llm'
import { modelFor } from './model-registry'
import { HEADING_ORDER, QUESTION_HEADINGS, isHeadingKey, type HeadingKey } from './question-headings'
import { USER_MATERIAL_PASS_PREFIX } from './heading-map'
import { sourceDateFields } from './evidence-date'

// ── caps ─────────────────────────────────────────────────────────────────────
//
// ⚠ A PER-IDEA CAP IS IN §25.6 AND IS NOT A COST CONTROL. It is a quality one: an idea with
// two hundred documents attached produces a findings list nobody reads, and the user cannot
// tell which of their own material actually did any work. Every cap below is a number in
// one place, so raising one is a decision rather than an archaeology exercise.

/** §25.6 "a per-idea cap". */
export const MAX_MATERIALS_PER_IDEA = parseInt(process.env.LEX_MATERIAL_MAX ?? '20', 10)
/** Roughly fifty pages of prose. Longer documents are TRUNCATED and say so. */
export const MAX_TEXT_CHARS = parseInt(process.env.LEX_MATERIAL_MAX_CHARS ?? '200000', 10)
/** The upload ceiling, on the ORIGINAL. Nothing this large is ever stored. */
export const MAX_UPLOAD_BYTES = parseInt(process.env.LEX_MATERIAL_MAX_BYTES ?? '10485760', 10)
/** How much of the text one findings pass reads. */
export const READ_CHARS = parseInt(process.env.LEX_MATERIAL_READ_CHARS ?? '60000', 10)

/**
 * ⚠ NO VIDEO, AND IMAGES ONLY WHERE OCR YIELDS TEXT — §25.6. There is no OCR in this
 * codebase, so an image yields nothing, and the honest thing is to REFUSE it with that
 * sentence rather than store an empty document that looks like it was read. An accepted
 * upload that produced no text is indistinguishable to the user from one that had nothing
 * to say.
 */
export const ACCEPTED_MIME = new Set([
  'application/pdf',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'text/plain',
  'text/markdown',
  'text/html',
])

// ⚠ 25-L §2 — `MaterialRejected` MOVED, AND IT NOW CARRIES A KIND. It lived here with a
// message and nothing else, so a refusal was a sentence on a screen and then nothing at
// all: no count of how often it happens, no gap on the idea, and therefore no evidence for
// the transcript-fetching decision §2 defers on exactly those grounds. Re-exported so every
// existing importer keeps working.
export { MaterialRejected } from './material-rejection'
export type { RejectionKind } from './material-rejection'

// ── extraction ───────────────────────────────────────────────────────────────

export interface Extracted {
  text: string
  /** TRUE when the source was longer than `MAX_TEXT_CHARS` and was cut. Always surfaced. */
  truncated: boolean
  /** The document's own title where the format carries one. */
  title: string | null
}

/**
 * Text out of a file. Format by mime type, never by extension — an extension is a claim by
 * whoever named the file.
 */
export async function extractFile(bytes: Buffer, mimeType: string, filename: string): Promise<Extracted> {
  if (bytes.byteLength > MAX_UPLOAD_BYTES) {
    throw new MaterialRejected(
      'too-large',
      `That file is ${(bytes.byteLength / 1048576).toFixed(1)}MB and the limit is ${(MAX_UPLOAD_BYTES / 1048576).toFixed(0)}MB.`,
    )
  }
  if (!ACCEPTED_MIME.has(mimeType)) {
    // ⚠ A VIDEO FILE IS NOT AN UNREADABLE FORMAT, IT IS A VIDEO, and the two want
    // different things from the user. Naming it as "an unsupported type" would leave them
    // looking for a converter instead of a transcript.
    if (mimeType.startsWith('video/')) throw new MaterialRejected('video', VIDEO_MESSAGE)
    throw new MaterialRejected(
      'unreadable-format',
      `We can read PDFs, Word documents, plain text and HTML. ${mimeType || 'That file type'} isn’t one of them — `
      + 'and we don’t do images or video, so nothing would be extracted.',
    )
  }

  let raw = ''
  let title: string | null = null
  if (mimeType === 'application/pdf') {
    // Dynamically imported: the parser pulls a large dependency tree and this path runs on
    // an upload, not on every request.
    const { PDFParse } = await import('pdf-parse')
    const parser = new PDFParse({ data: new Uint8Array(bytes) })
    const result = await parser.getText()
    raw = result.text ?? ''
  } else if (mimeType.endsWith('wordprocessingml.document')) {
    const { default: mammoth } = await import('mammoth')
    const result = await mammoth.extractRawText({ buffer: bytes })
    raw = result.value ?? ''
  } else if (mimeType === 'text/html') {
    raw = stripHtml(bytes.toString('utf8'))
    title = htmlTitle(bytes.toString('utf8'))
  } else {
    raw = bytes.toString('utf8')
  }

  const text = normalise(raw)
  if (!text.trim()) {
    // ⚠ REFUSED, NOT STORED EMPTY. A scanned PDF is an image in a PDF wrapper and yields
    // nothing; storing it would put a document in the user's list that Lex has never read
    // and cannot read, looking exactly like one it has.
    throw new MaterialRejected(
      'no-text',
      `Nothing readable came out of ${filename}. If it is a scan, it is an image — we have no OCR, so there is no text to work from.`,
    )
  }
  return cap(text, title)
}

/**
 * Text behind a URL.
 *
 * ⚠ A LINK IS FETCHED ONCE AND STORED AS TEXT, WITH THE LINK RETAINED (§25.6). Both halves:
 * fetching once means the finding does not change under the user when the page does, and
 * keeping the link means a quotation can still be checked. A quotation whose source cannot
 * be reopened is not evidence.
 */
export async function extractUrl(url: string): Promise<Extracted & { finalUrl: string }> {
  let parsed: URL
  try { parsed = new URL(url) } catch { throw new MaterialRejected('not-a-url', 'That doesn’t look like a web address.') }
  if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') {
    throw new MaterialRejected('not-a-url', 'Only http and https links can be fetched.')
  }

  // ⚠⚠ 25-L §2 — REFUSED BEFORE THE FETCH, AND THE ROUTE OUT IS NAMED.
  //
  // Fetching a YouTube URL returns an app shell: a few hundred characters of script tags
  // that `stripHtml` reduces to nothing, so the old path refused it with "that page had no
  // readable text — it may be built entirely in JavaScript". True, useless, and it sent the
  // user looking for a fault in their link. Refusing up front lets the sentence say the one
  // thing that helps: the transcript is under the video, and we will read that.
  //
  // ⚠ NOTHING HERE FETCHES A TRANSCRIPT. §2 defers that deliberately.
  if (isVideoUrl(parsed.toString())) throw new MaterialRejected('video', VIDEO_MESSAGE)
  if (isKnownPaywall(parsed.toString())) throw new MaterialRejected('paywalled', PAYWALL_MESSAGE)

  const ctrl = new AbortController()
  const timer = setTimeout(() => ctrl.abort(), 20_000)
  let res: Response
  try {
    res = await fetch(parsed.toString(), {
      signal: ctrl.signal,
      redirect: 'follow',
      headers: { 'User-Agent': 'ScrutiniseBot/1.0 (+https://www.scrutinise.org)' },
    })
  } catch (err) {
    const aborted = err instanceof Error && err.name === 'AbortError'
    throw new MaterialRejected(
      'unfetchable',
      aborted ? 'That page did not answer within 20 seconds.' : `That page could not be fetched: ${err instanceof Error ? err.message : String(err)}`,
    )
  } finally { clearTimeout(timer) }

  if (!res.ok) {
    // ⚠ THE STATUS IS REPORTED, NOT SWALLOWED. A 403 from a Cloudflare bot challenge and a
    // 404 from a dead link need different things from the user, and "couldn't fetch that"
    // tells them neither (CLAUDE.md §18: a failure names itself).
    // ⚠ 401/402/403 ON A NEWS SITE IS A WALL, NOT A DEAD LINK, and the two need different
    // things from the user. The host list above catches the ones we know; this catches the
    // ones we do not, from the server's own answer.
    const walled = res.status === 401 || res.status === 402 || res.status === 403
    throw new MaterialRejected(
      walled ? 'paywalled' : 'unfetchable',
      walled
        ? `That page answered HTTP ${res.status} — it is refusing us rather than missing. `
          + 'If you can see it, paste the text or upload the PDF and I’ll read that.'
        : `That page returned HTTP ${res.status}. Nothing was stored.`,
    )
  }

  const contentType = (res.headers.get('content-type') ?? '').split(';')[0].trim()
  const buf = Buffer.from(await res.arrayBuffer())
  if (buf.byteLength > MAX_UPLOAD_BYTES) {
    throw new MaterialRejected('too-large', `That page is larger than the ${(MAX_UPLOAD_BYTES / 1048576).toFixed(0)}MB limit.`)
  }

  // ⚠ A CONTENT TYPE IS THE SERVER'S OWN ANSWER and beats any host list. A video served
  // from a domain nobody has heard of is still a video.
  if (contentType.startsWith('video/')) throw new MaterialRejected('video', VIDEO_MESSAGE)
  if (contentType === 'application/pdf') {
    const out = await extractFile(buf, contentType, parsed.pathname)
    return { ...out, finalUrl: res.url || parsed.toString() }
  }
  const html = buf.toString('utf8')
  const text = normalise(stripHtml(html))
  if (!text.trim()) {
    throw new MaterialRejected('no-text', 'That page had no readable text — it may be built entirely in JavaScript.')
  }
  return { ...cap(text, htmlTitle(html)), finalUrl: res.url || parsed.toString() }
}

function cap(text: string, title: string | null): Extracted {
  if (text.length <= MAX_TEXT_CHARS) return { text, truncated: false, title }
  // ⚠ TRUNCATION IS RECORDED AND SHOWN. A silently shortened document is a document whose
  // last thirty pages the user believes were read.
  return { text: text.slice(0, MAX_TEXT_CHARS), truncated: true, title }
}

/**
 * ⚠ WRITTEN OUT OF A LIVE RUN, NOT REASONED ABOUT. Extracting gov.uk and legislation.gov.uk
 * through `stripHtml` produced twelve thousand characters whose first several hundred were
 * newline-space pairs — the skeleton of the stripped navigation. That matters for two reasons
 * and neither is cosmetic: the findings pass reads the FIRST `READ_CHARS` of the text, so
 * whitespace at the head is budget spent on nothing, and a document whose visible beginning is
 * blank reads to a user as a failed extraction.
 *
 * The original collapse could not touch it, because those runs are not consecutive newlines —
 * they are newline-space pairs. This collapses WHITESPACE-ONLY LINES, which is the real shape.
 *
 * ⚠ CONTROL CHARACTERS ARE STRIPPED BY ESCAPE, NOT BY A LITERAL. The first version of this
 * line carried a raw NUL byte, which made the whole module read as BINARY to `grep` — a guard
 * that grepped this file would have matched nothing and reported a clean pass. CLAUDE.md §13's
 * byte-level rule, arriving from the other direction.
 */
/** C0 control characters, tab and newline excepted. */
const CONTROL_CHARS = /[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g

/**
 * ⚠ EXPORTED SO A GUARD CAN WATCH IT. It is four regexes over user content and it looks
 * unremarkable, and during this sprint one careless edit turned the control-character class
 * into one that also matched the LETTER `u` — which silently deleted every `u` from every
 * document a user uploaded ("Treasury" became "Treasry"), with no error and nothing in a log.
 * That is the §14 corruption class exactly: invisible, downstream, and only visible if
 * somebody happens to read the text. `check:lex-25d` now reads it on every run.
 */
export function normalise(s: string): string {
  return s
    .replace(/\r\n/g, '\n')
    // C0 controls except tab and newline. PDF and Word exports carry them, nothing downstream
    // wants them, and a NUL inside a stored string breaks Postgres text on write.
    .replace(CONTROL_CHARS, '')
    .replace(/\u00a0/g, ' ')
    // However many whitespace-only lines, one blank line.
    .replace(/\n[ \t]*(?:\n[ \t]*)+/g, '\n\n')
    .replace(/[ \t]{2,}/g, ' ')
    .trim()
}

function stripHtml(html: string): string {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<!--[\s\S]*?-->/g, ' ')
    .replace(/<\/(p|div|li|h[1-6]|tr|section|article)>/gi, '\n')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .replace(/[ \t]{2,}/g, ' ')
}

function htmlTitle(html: string): string | null {
  const m = /<title[^>]*>([\s\S]*?)<\/title>/i.exec(html)
  return m ? m[1].replace(/\s+/g, ' ').trim() || null : null
}

// ── the findings pass ────────────────────────────────────────────────────────

interface MaterialFinding {
  headingKey?: unknown
  title?: unknown
  body?: unknown
  quote?: unknown
  locator?: unknown
}

const FINDINGS_SCHEMA = {
  type: 'object',
  properties: {
    findings: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          headingKey: { type: 'string', enum: HEADING_ORDER },
          title: { type: 'string' },
          body: { type: 'string' },
          quote: { type: 'string' },
          locator: { type: 'string' },
        },
        required: ['headingKey', 'title', 'body', 'quote'],
      },
    },
    nothingUseful: { type: 'string' },
  },
  required: ['findings'],
}

const SYSTEM = [
  'You are reading ONE document a user has attached to their policy proposal, and turning it into',
  'a small number of FINDINGS WITH PROVENANCE. You are not summarising it.',
  '',
  '⚠ EVERY FINDING MUST QUOTE THE DOCUMENT. `quote` is a VERBATIM span from the text you were',
  'given — not a paraphrase, not a reconstruction. A finding whose quote is not in the document is',
  'worse than no finding: the user will take it into a committee room and be asked to point at it.',
  '',
  '⚠ FILE EACH FINDING UNDER THE QUESTION IT ANSWERS. `headingKey` is one of the listed keys, and',
  'it must be the question the finding ACTUALLY answers — not the one nearest the subject matter.',
  '',
  '⚠ FEWER IS BETTER, AND NOTHING IS A LEGITIMATE ANSWER. If this document does not bear on the',
  'proposal, return an empty `findings` array and say why in `nothingUseful`. A document that',
  'yields three sharp findings has been read well; one that yields fifteen has been skimmed.',
  'Never manufacture a finding to fill a heading.',
].join('\n')

/**
 * Read a stored document into findings, and write them to the evidence layer.
 *
 * ⚠ ONE CALL, AT INGEST. The text is read here and NOT stored on any prompt path. Every
 * later turn sees the FINDINGS, which are small, cited and retrievable — which is the whole
 * economics of §25.6.
 */
export async function runMaterialFindings(materialId: string): Promise<{ written: number; note: string | null }> {
  const material = await prisma.ideaUserMaterial.findUnique({ where: { id: materialId } })
  if (!material?.text) return { written: 0, note: 'There is no stored text to read.' }
  // Held in a local: this package compiles with `strict: false` and the narrowing above does
  // not survive the awaits below.
  const storedText: string = material.text

  const idea = await prisma.idea.findUnique({
    where: { id: material.ideaId },
    select: { title: true, summaryDescription: true },
  })

  const headingList = QUESTION_HEADINGS
    .map((h) => `  ${h.key} — ${h.heading}: ${h.lookingFor}`)
    .join('\n')

  const user = [
    `THE PROPOSAL: ${idea?.title ?? '(untitled)'}`,
    idea?.summaryDescription ? `${idea.summaryDescription}` : '',
    '',
    'THE QUESTIONS A FINDING MAY BE FILED UNDER:',
    headingList,
    '',
    `THE DOCUMENT — "${material.label}"${material.url ? ` (${material.url})` : ''}:`,
    storedText.slice(0, READ_CHARS),
  ].filter(Boolean).join('\n')

  const res = await callJson<{ findings?: MaterialFinding[]; nothingUseful?: unknown }>({
    model: modelFor('lex.material'),
    system: SYSTEM,
    user,
    schema: FINDINGS_SCHEMA,
    maxOutputTokens: 6000,
    timeoutMs: 120_000,
    temperature: 0.2,
    label: `material:${material.id}`,
  })

  if (!llmOk(res)) {
    // ⚠ THE DOCUMENT IS KEPT AND THE FAILURE IS NAMED. Deleting it because one pass failed
    // would lose the user's own material for a transient reason.
    await prisma.ideaUserMaterial.update({
      where: { id: materialId },
      data: { findingsAt: new Date(), findingCount: 0 },
    })
    return { written: 0, note: `The reading pass did not complete (${res.reason}). The document is stored; it can be read again.` }
  }

  const passKey = `${USER_MATERIAL_PASS_PREFIX}${material.id}`
  // A re-read supersedes its own earlier findings and touches nothing else — the same rule
  // the rest of the evidence layer follows.
  await prisma.evidenceItem.updateMany({
    where: { ideaId: material.ideaId, passKey, status: 'PROPOSED' },
    data: { status: 'REJECTED', note: 'Superseded by a re-read of this document' },
  })

  const findings = Array.isArray(res.value.findings) ? res.value.findings : []
  let written = 0
  for (const f of findings) {
    const title = typeof f.title === 'string' ? f.title.trim() : ''
    const body = typeof f.body === 'string' ? f.body.trim() : ''
    const quote = typeof f.quote === 'string' ? f.quote.trim() : ''
    if (!title || !body || !quote) continue

    // ⚠⚠ THE QUOTE IS VERIFIED AGAINST THE STORED TEXT, NOT TRUSTED. This is the one check
    // that makes "findings with provenance" mean anything: a model asked to quote will
    // sometimes reconstruct, and a reconstructed quote attributed to the user's own
    // document is the most damaging thing this feature could produce. A finding whose quote
    // is not in the text is DROPPED, and the drop is counted and logged.
    // ⚠ `verbatimSpan`, NOT `quoteIsInText`. See its comment: the all-or-nothing check
    // dropped 11 of 15 findings on Charlie's own document, ten of whose quotes were in it.
    // What is stored below is the DOCUMENT'S text for the matched span, never the model's.
    const verbatim = verbatimSpan(quote, storedText)
    if (!verbatim) {
      console.warn('[material] finding DROPPED — the model diverges from the document too early', {
        materialId: material.id, title: title.slice(0, 60), quote: quote.slice(0, 80),
      })
      continue
    }
    // How much the model had tidied. Zero on a clean quote; the interesting case is the
    // long tail, and it is worth being able to see it without re-running anything.
    if (quoteNorm(verbatim).length < quoteNorm(quote).length) {
      console.log('[material] quote anchored to the document', {
        materialId: material.id,
        offered: quoteNorm(quote).length,
        anchored: quoteNorm(verbatim).length,
      })
    }

    const headingKey: HeadingKey = isHeadingKey(f.headingKey) ? f.headingKey : 'YOUR_MATERIAL'
    await prisma.evidenceItem.create({
      data: {
        ideaId: material.ideaId,
        passKey,
        headingKey,
        runVersion: 1,
        fieldRef: null,
        kind: 'FINDING',
        title,
        body: `${body}\n\n“${verbatim}”${typeof f.locator === 'string' && f.locator.trim() ? ` — ${f.locator.trim()}` : ''}`,
        // ⚠ The badge the panel reads. `USER_DOCUMENT` is what marks this visibly as the
        // user's own source rather than something we found.
        sourceType: 'USER_DOCUMENT',
        // ⚠ 25-P §2b — NO SOURCE ROW TO DATE. Recorded as such rather than left undated:
        // a reasoning step with nothing behind it is not an undated document.
        ...sourceDateFields(null),
        sourceId: material.id,
        citation: material.label,
        url: material.url,
        status: 'PROPOSED',
        siftReason: `From your own ${material.kind === 'LINK' ? 'link' : 'document'}, “${material.label}”.`,
      },
    })
    written++
  }

  const dropped = findings.length - written
  await prisma.ideaUserMaterial.update({
    where: { id: materialId },
    data: { findingsAt: new Date(), findingCount: written },
  })

  const note = written === 0
    ? (typeof res.value.nothingUseful === 'string' && res.value.nothingUseful.trim()
        ? res.value.nothingUseful.trim()
        : 'Nothing in this document bore on the proposal.')
    : dropped > 0
      ? `${dropped} finding${dropped === 1 ? '' : 's'} dropped — what they quoted was not in the document.`
      : null
  console.log('[material] findings pass', { materialId: material.id, offered: findings.length, written, dropped })
  return { written, note }
}

/**
 * Is this quote actually in the document?
 *
 * ⚠ COMPARED ON NORMALISED WHITESPACE AND QUOTE MARKS, and nothing else. Extraction turns a
 * PDF's line breaks into spaces and a Word document's curly quotes into whatever the
 * encoding produced, so an exact `includes` would reject honest quotes and teach us to
 * remove the check. Anything looser — matching on the first few words, or on a similarity
 * score — would let a reconstruction through, which is the failure it exists to stop.
 */
export function quoteIsInText(quote: string, text: string): boolean {
  const q = quoteNorm(quote)
  // A very short "quote" is not provenance — it is a phrase that appears everywhere.
  if (q.length < 20) return false
  return quoteNorm(text).includes(q)
}

function quoteNorm(s: string): string {
  return s
    .replace(/[‘’‚‛]/g, "'")
    .replace(/[“”„‟]/g, '"')
    .replace(/[‐-―]/g, '-')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase()
}

/**
 * The shortest quote we will treat as provenance, in characters of matched text.
 *
 * ⚠ THIS IS THREE TIMES THE OLD FLOOR, NOT A RELAXATION. `quoteIsInText` accepted any
 * exact match of 20 characters; this requires 60 contiguous characters that are demonstrably
 * the document's own. The change below makes the check STRICTER on what it accepts and
 * stops it discarding honest findings — those are the same change, not a trade.
 */
const MIN_SPAN = 60

/**
 * ⚠⚠ 25-I §2 — THE VERBATIM CHECK WAS THROWING AWAY 73% OF WHAT IT FOUND.
 *
 * Measured on Charlie's own document (42,264 chars): the pass offered 15 findings and
 * DROPPED 11 of them as "the quote could not be found in the document". Ten of those
 * eleven quotes were in the document. The eleventh diverged in a way that shows the whole
 * mechanism:
 *
 *     document : …advantage over government there are imperfect but ultimately fair…
 *     model    : …advantage over government. there
 *
 * The model added a full stop. `quoteIsInText` is all-or-nothing over the whole passage, so
 * one tidied character at position 200 of a 300-character quote discarded the entire
 * finding — and told the user their document had produced nothing, which reads as *the
 * document was useless* rather than *our comparison is brittle*. Same shape as the
 * "fabrication rate" that turned out to be our own undecoded HTML entities.
 *
 * ⚠ THE FIX MAKES PROVENANCE STRONGER, WHICH IS WHY IT IS THIS AND NOT A LOOSER MATCH.
 * Matching on the first few words, or on a similarity score, would let a reconstruction
 * through — the very thing the check exists to stop. Instead we find the longest PREFIX of
 * the model's quote that really is in the document, and then return **the document's own
 * words for that span**. The model's string is never stored. A stored quote is therefore
 * verbatim BY CONSTRUCTION rather than by having passed a test, and no amount of tidying
 * downstream of the anchor can put words in the document's mouth.
 *
 * Returns null when the model diverges before `MIN_SPAN` — at that point it is not quoting.
 */
export function verbatimSpan(quote: string, text: string): string | null {
  const nq = quoteNorm(quote)
  if (nq.length < MIN_SPAN) return null
  const nt = quoteNorm(text)

  // Longest matching prefix, by binary search on the normalised forms.
  let lo = 0
  let hi = nq.length
  while (lo < hi) {
    const mid = Math.ceil((lo + hi) / 2)
    if (nt.includes(nq.slice(0, mid))) lo = mid
    else hi = mid - 1
  }
  if (lo < MIN_SPAN) return null

  // ⚠ TRIM TO A WORD BOUNDARY. Cutting mid-word would store "…over governme", which reads
  // as a transcription error and invites exactly the doubt the quote exists to remove.
  const cut = nq.lastIndexOf(' ', lo)
  const end = cut >= MIN_SPAN ? cut : lo
  const matched = nq.slice(0, end)

  // ⚠ NOW RECOVER THE DOCUMENT'S OWN TEXT FOR THAT SPAN. The match was made on a
  // lower-cased, whitespace-collapsed form; returning that would strip the document's
  // capitals and punctuation from a quotation. Walking the original text in step with the
  // normalised one restores it exactly as written.
  const at = nt.indexOf(matched)
  if (at < 0) return null
  return sliceOriginal(text, at, matched.length)
}

/**
 * Map a span located in `quoteNorm(text)` back onto `text` itself.
 *
 * Normalisation only ever collapses runs of whitespace and rewrites single characters
 * one-for-one, so walking both strings together and counting consumed normalised
 * characters recovers the original span. Done by scanning rather than by index arithmetic,
 * because the collapse means the two strings do not share offsets.
 */
function sliceOriginal(text: string, normStart: number, normLength: number): string {
  let consumed = 0
  let start = -1
  let i = 0
  // Mirror `quoteNorm`'s leading trim: skip whitespace the normalised form dropped.
  while (i < text.length && /\s/.test(text[i])) i++
  for (; i < text.length; i++) {
    const isSpaceRun = /\s/.test(text[i])
    if (isSpaceRun) {
      // A whitespace run collapses to exactly one normalised space.
      while (i + 1 < text.length && /\s/.test(text[i + 1])) i++
    }
    if (consumed === normStart && start < 0) start = i
    consumed++
    if (start >= 0 && consumed >= normStart + normLength) return text.slice(start, i + 1).trim()
  }
  return start >= 0 ? text.slice(start).trim() : ''
}
