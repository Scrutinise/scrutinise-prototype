/**
 * CENTRAL Stage 2d — build the bulk-upload template.
 *
 *   npx tsx scripts/make-question-template.ts
 *
 * Writes `public/central-question-upload-template.xlsx`, which the "Download
 * template" link in the Question library serves as a static asset.
 *
 * ⚠ THIS IS A STAND-IN. The brief says to serve the .xlsx Charlie supplies;
 *   none had been supplied when 2d was built, so this generates one with the
 *   brief's column set. Replacing it is dropping Charlie's file in at the same
 *   path — nothing in the code reads this script at runtime. The importer keys
 *   off COLUMN NAMES, not positions, so a file with the same headers in a
 *   different order still imports.
 *
 * Sheet 1 carries the header row and nothing else — the importer reads sheet 1
 * only, so the worked examples live on sheet 2 where they cannot be uploaded by
 * accident.
 */
import { writeFileSync } from 'node:fs'
import { resolve } from 'node:path'
import * as XLSX from 'xlsx'
import { TEMPLATE_COLUMNS } from '../lib/question-import'

const OUT = resolve(process.cwd(), 'public/central-question-upload-template.xlsx')

const guidance: string[][] = [
  ['How to fill this in'],
  [],
  ['Put one question per row on the "Questions" sheet. Only that sheet is read.'],
  [],
  ['Question', 'Required. The question as it was actually asked. 5–500 characters.'],
  ['Context', 'Required. Where it gets asked. It MUST be one the Community already uses —'],
  ['', 'an unknown context fails that row and is reported; it is never guessed at.'],
  ['', 'Out in the world:  Doorstep · Media interview · Hustings · University AMA · Council chamber'],
  ['', 'Behind the scenes: How-to · Party process · Tools & tech'],
  ['Topics', 'Optional. What it is about. Several allowed, separated by commas or semicolons.'],
  ['', 'A topic that does not exist yet is created, unpromoted, and appears in the'],
  ['', '"All topics" dropdown.'],
  ['Answer', 'Optional. Leave it blank to post a question with no answer yet.'],
  ['Sources', 'Optional. Links backing the answer up, separated by commas or newlines.'],
  ['Local example', 'Optional. "This worked on my patch" — shown as its own block, not as a source.'],
  ['Notes', 'NEVER IMPORTED. Your own working notes. Nothing in this column reaches the site.'],
  [],
  ['Everything you upload is posted under YOUR name, as its author. There is no'],
  ['author column and there will not be one.'],
  [],
  ['Re-uploading the same file writes nothing: a question already in the library'],
  ['is matched on its exact text, and an answer on its exact wording.'],
  [],
  ['Worked examples — copy these onto the Questions sheet and edit them:'],
  [...TEMPLATE_COLUMNS],
  [
    'How are you going to pay for all of this?',
    'Doorstep',
    'Local finance; Economy',
    'The plan is funded from the existing capital budget — no new borrowing. The figures are in the published medium-term financial plan.',
    'https://example.gov.uk/mtfp',
    'We put the same figures on a leaflet in Riverside and it stopped the question dead.',
    'Check the MTFP link after the March update',
  ],
  [
    'Why should anyone trust your party after the last few years?',
    'Media interview',
    'Party conduct',
    'Because the record is checkable. Here is what we said we would do, and here is what happened.',
    '',
    '',
    '',
  ],
  [
    'How do I get the canvassing app working on an old phone?',
    'How-to',
    'Tools & tech',
    '',
    '',
    '',
    'No answer yet — someone in the branch will know',
  ],
]

const wb = XLSX.utils.book_new()

const questions = XLSX.utils.aoa_to_sheet([[...TEMPLATE_COLUMNS]])
questions['!cols'] = [
  { wch: 60 }, { wch: 18 }, { wch: 26 }, { wch: 70 }, { wch: 34 }, { wch: 40 }, { wch: 30 },
]
XLSX.utils.book_append_sheet(wb, questions, 'Questions')

const help = XLSX.utils.aoa_to_sheet(guidance)
help['!cols'] = [{ wch: 22 }, { wch: 100 }, { wch: 26 }, { wch: 40 }, { wch: 30 }, { wch: 40 }, { wch: 30 }]
XLSX.utils.book_append_sheet(wb, help, 'How to fill this in')

// Deterministic bytes: SheetJS stamps the workbook with the current time unless
// told otherwise, and a template whose bytes change on every run makes a noisy
// diff out of a file nobody edited.
writeFileSync(OUT, XLSX.write(wb, { type: 'buffer', bookType: 'xlsx', Props: { CreatedDate: new Date(0) } }))
console.log(`wrote ${OUT}`)
