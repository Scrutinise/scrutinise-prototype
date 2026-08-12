// ─────────────────────────────────────────────────────────────────────────────
// §19-D Tasks 2a + 9a, SECOND INSTANCES — the two defects the 12 Aug walk found
// after the sprint that fixed them had already shipped.
//
// Both are the same species: a claim the panel makes on Lex's behalf that the
// underlying state does not support.
//
//   2a  `keywords` is `type: 'structured'` with NO `slots`, because "structured" is
//       what AcceptCard keys off to render chips in chat. FieldsPanel dispatched it
//       to StructuredField anyway, which renders one input PER SLOT — so with zero
//       slots the card was a "proposed by Lex — refine" badge, a Save & accept
//       button, and nothing between them. Pressing Save would have written `{}` over
//       Lex's proposed keywords.
//
//   9a  "Save & exit" POSTed `{action:'accept'}` to `/fields` for whatever field was
//       AWAITING_CONFIRMATION. For a child-entity field (causes / policyOptions /
//       actions) that route 422s by design, so the save could never succeed and the
//       only way out of the dialog was Discard — 9a's original symptom, one page on.
//       The dialog also claimed an already-persisted list was an unsaved draft.
//
// Asserted here, none of it needing a model, a browser or a database:
//   1. no field def can reach StructuredField without slots;
//   2. a slotless structured field is treated as a LIST by both accept surfaces, and
//      by the same test, so panel and chat cannot disagree;
//   3. CHILD_ENTITY_FIELDS has exactly one definition, and both the API route and the
//      create client read THAT one;
//   4. the unsaved-draft test excludes child-entity fields.
//
// What this cannot prove: that the rendered card looks right. It proves the two
// conditions that made it look wrong are unreachable.
// ─────────────────────────────────────────────────────────────────────────────

import fs from 'fs'
import path from 'path'
import { ALL_FIELDS, CHILD_ENTITY_FIELDS, fieldDef } from '../lib/lex/page1-config'
import { DIAGNOSIS_FIELDS } from '../lib/lex/page2-config'
import { GUIDING_POLICY_FIELDS } from '../lib/lex/page3-config'

const ROOT = path.join(__dirname, '..')
let fail = 0
const ok = (label: string, cond: boolean, detail = '') => {
  if (cond) console.log(`  ok   ${label}`)
  else { fail++; console.log(` FAIL  ${label}${detail ? ` — ${detail}` : ''}`) }
}
const read = (rel: string) => fs.readFileSync(path.join(ROOT, rel), 'utf8')
/** Source with comments stripped — so a rule is never satisfied by prose describing it. */
const code = (rel: string) => read(rel).replace(/\/\/.*$/gm, '').replace(/\/\*[\s\S]*?\*\//g, '')

console.log('§19-D 2a/9a (second instances) — the panel does not claim what the state cannot support\n')

const PANEL = 'components/lex/FieldsPanel.tsx'
const ACCEPT_CARD = 'components/lex/AcceptCard.tsx'
const CLIENT = 'app/ideas/create/CreateIdeaClient.tsx'
const ROUTE = 'app/api/ideas/[id]/fields/route.ts'

// ── 1. StructuredField is unreachable without slots ──────────────────────────
console.log('2a — a badge can never render over a box with no inputs')

const panel = code(PANEL)
// The dispatcher must gate the structured branch on the field actually having slots.
// Written as a shape rather than a literal so reformatting does not break it, but
// specific enough that deleting the guard fails: `slots` must be consulted in the
// same expression that decides to render StructuredField.
const structuredBranch = panel.match(/if\s*\([\s\S]{0,200}?type\s*===\s*'structured'[\s\S]{0,200}?return\s*<StructuredField/)
ok('FieldsPanel dispatches to StructuredField from exactly one branch', !!structuredBranch,
  structuredBranch ? '' : 'no `type === \'structured\'` → <StructuredField> branch found')
ok('that branch is gated on the field having at least one slot',
  !!structuredBranch && /slots\s*\?\.\s*length|slots\s*\.\s*length/.test(structuredBranch[0]),
  structuredBranch ? structuredBranch[0].replace(/\s+/g, ' ').slice(0, 120) : '')

// Every structured field in every page config is either slotted (so StructuredField
// renders inputs) or slotless (so it must fall through to the list renderer). Both are
// legitimate; a slotless one reaching StructuredField is not.
const EVERY_FIELD = [...ALL_FIELDS, ...DIAGNOSIS_FIELDS, ...GUIDING_POLICY_FIELDS]
const structured = EVERY_FIELD.filter((f) => f.type === 'structured')
ok('there is at least one structured field to check', structured.length > 0, `${structured.length}`)
for (const f of structured) {
  const n = fieldDef(f.key)?.slots?.length ?? 0
  console.log(`       ${f.key}: ${n} slot(s) → ${n > 0 ? 'StructuredField' : 'list renderer'}`)
}
const slotless = structured.filter((f) => (fieldDef(f.key)?.slots?.length ?? 0) === 0)
ok('every slotless structured field is a comma-separated list, not a slotted object',
  slotless.every((f) => f.key === 'keywords'),
  slotless.map((f) => f.key).join(', '))

// ── 2. one list test, used by both accept surfaces ───────────────────────────
console.log('\n2a — the panel and the chat card agree on what a list is')
const accept = code(ACCEPT_CARD)
ok('AcceptCard decides "is a list" from the field TYPE',
  /field\.type\s*===\s*'structured'/.test(accept))
ok('FieldsPanel\'s OutputField uses the same test, not a hardcoded key',
  /const\s+isList\s*=\s*field\.type\s*===\s*'structured'/.test(panel),
  /const\s+isList\s*=\s*[^\n]*/.exec(panel)?.[0] ?? 'no isList found')

// ── 3. one definition of CHILD_ENTITY_FIELDS ─────────────────────────────────
console.log('\n9a — "Save & exit" cannot offer to save what its endpoint refuses')

const DECL = /(?:const|let|var)\s+CHILD_ENTITY_FIELDS\s*[:=]/
const declaring = ['lib/lex/page1-config.ts', ROUTE, CLIENT, PANEL].filter((f) => DECL.test(code(f)))
ok('CHILD_ENTITY_FIELDS is declared in exactly one file', declaring.length === 1, declaring.join(', '))
ok('...and that file is page1-config.ts', declaring[0] === 'lib/lex/page1-config.ts', declaring[0])

for (const f of [ROUTE, CLIENT]) {
  ok(`${f} imports it rather than redeclaring`,
    /import\s*\{[^}]*\bCHILD_ENTITY_FIELDS\b[^}]*\}\s*from\s*'@\/lib\/lex\/page1-config'/.test(code(f)))
}

// ── 4. the unsaved-draft test excludes them ──────────────────────────────────
const client = code(CLIENT)
const unsaved = client.match(/const\s+unsavedField\s*=[\s\S]{0,400}?\?\?\s*null/)
ok('the create client computes an unsavedField', !!unsaved)
ok('...and it excludes child-entity fields',
  !!unsaved && /CHILD_ENTITY_FIELDS\.has\(/.test(unsaved[0]),
  unsaved ? unsaved[0].replace(/\s+/g, ' ').slice(0, 160) : '')

// The child-entity list must also be what the route actually refuses, or the client is
// excluding one set while the server rejects another.
const route = code(ROUTE)
ok('the route still refuses child-entity fields on POST /fields',
  /CHILD_ENTITY_FIELDS\.has\(fieldKey\)/.test(route))
ok('the exclusion covers every loop and reference field on pages 2-4',
  ['causes', 'rootCause', 'policyOptions', 'chosenApproach', 'actions'].every((k) => CHILD_ENTITY_FIELDS.has(k)),
  [...CHILD_ENTITY_FIELDS].join(', '))

console.log(fail === 0 ? '\nAll checks pass.' : `\n${fail} check(s) FAILED.`)
process.exit(fail === 0 ? 0 : 1)
