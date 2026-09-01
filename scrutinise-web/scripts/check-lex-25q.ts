// ─────────────────────────────────────────────────────────────────────────────
// check:lex-25q — the sprint's own guards.
//
// ⚠⚠ WRITTEN TO CLAUDE.md §25, WHICH 25-P ADDED: where the property is about a VALUE, the
// assertion reads that value out of the running system. §1e says so again in the brief's own
// words — *"the check must show the new text present in the rendered panel, with a control that
// stays false"* — so §1's assertions perform the edit through the route's own writer and then
// read the panel back through `computeCanonicalState`, which is what the middle column renders.
//
// ⚠ THE FIXTURE IS A SCRATCH IDEA IT CREATES AND DELETES, marked, swept first, removed in a
// `finally`, and asserted fresh.
//
// ⚠ AND THE SOURCE-SHAPED ASSERTIONS ARE ONLY WHERE THE PROPERTY REALLY IS ABOUT SOURCE — "this
// route is the only one that writes", "the tour and the prompt read the same array". Those are
// claims about code, and a grep is the right instrument for them.
//
// Usage: npm run check:lex-25q
// ─────────────────────────────────────────────────────────────────────────────

import { randomUUID } from 'node:crypto'
import { readFileSync, existsSync } from 'node:fs'
import { join } from 'node:path'
import { prisma } from '../lib/prisma'
import { computeCanonicalState } from '../lib/lex/state'
import {
  resolvePolicyTarget, looksLikeAReplacement, offerQuestion, AMBIGUOUS_TARGET,
  EDITABLE_TEXT_FIELDS, EDIT_TARGET_LABELS,
} from '../lib/lex/field-edit'
import { PRODUCT_FACTS, productFactsBlock } from '../lib/lex/product-facts'
import { applyFieldEdit, fieldEditFailed } from '../lib/lex/field-edit-write'

let pass = 0
let fail = 0
function ok(label: string, condition: boolean, detail?: string) {
  if (condition) { pass++; console.log(`  ✓ ${label}${detail ? ` — ${detail}` : ''}`) }
  else { fail++; console.log(`  ✗ ${label}${detail ? ` — ${detail}` : ''}`) }
}

/** ⚠ THE LAMBDA RETURNS WHETHER THE PROPERTY HOLDS; the control fires when it does not. */
const controls: Array<{ label: string; fired: boolean }> = []
function control(label: string, propertyHoldsOnBrokenInput: () => boolean) {
  let held: boolean
  try { held = propertyHoldsOnBrokenInput() } catch { held = false }
  controls.push({ label, fired: !held })
}

/** Source with comments stripped — an absence assertion must not read a ⚠ note. */
function code(rel: string): string {
  const p = join(process.cwd(), rel)
  if (!existsSync(p)) return ''
  return readFileSync(p, 'utf8')
    .replace(/\/\*[\s\S]*?\*\//g, ' ')
    .replace(/(^|[^:])\/\/.*$/gm, '$1')
}

const MARK = '25Q-CHECK'
const ORIGINAL = 'Require every intermediary to publish its terms in a public register.'
const REWRITE = 'Require every intermediary to publish its terms, in full, in a register the regulator maintains.'

async function main() {
  console.log('\n── check:lex-25q ──\n')

  const swept = await prisma.idea.deleteMany({ where: { title: { startsWith: MARK } } })
  if (swept.count) console.log(`  · swept ${swept.count} leftover scratch idea(s)\n`)

  const owner = await prisma.user.findFirst({
    where: { email: 'charles@scalablefinance.com' }, select: { id: true },
  }) ?? await prisma.user.findFirst({ select: { id: true } })
  if (!owner) { console.log('No user to own the fixture.'); process.exit(1) }

  const idea = await prisma.idea.create({
    data: {
      creatorId: owner.id,
      title: `${MARK} ${randomUUID().slice(0, 8)} — scratch fixture, deleted by the check`,
      summaryDescription: 'Created and destroyed by check:lex-25q.',
      govtArea: 'Check fixture',
    },
    select: { id: true, createdAt: true },
  })
  ok('the fixture is a new row, not a reused one',
    Date.now() - idea.createdAt.getTime() < 60_000, idea.id.slice(0, 8))
  const ideaId = idea.id

  try {
    // ══ §1a — THE DIAGNOSIS, AS AN ASSERTION ═════════════════════════════════
    console.log('\n§1a — why the chat could not reach the middle panel')
    const { validateProposal } = await import('../lib/lex/proposal-schema')
    // ⚠⚠ THE MECHANISM ITSELF. `validateProposal` returns null for the loop fields, so a rewrite
    // of a candidate guiding policy was dropped with no sign at all. Asserted so that anyone who
    // "fixes" it by adding a schema here finds out that the offer path is what depends on it.
    ok('validateProposal still refuses policyOptions — the offer path exists because of this',
      validateProposal({ fieldKey: 'policyOptions', value: REWRITE }) === null)
    ok('...and accepts a text field, so the refusal is about the field and not the value',
      validateProposal({ fieldKey: 'leverage', value: REWRITE }) !== null)
    control('a validator that accepted everything would make this meaningless',
      () => validateProposal({ fieldKey: 'policyOptions', value: REWRITE }) !== null)

    // ══ §1 — TARGETING ═══════════════════════════════════════════════════════
    console.log('\n§1 — the rewrite is addressed to a numbered row')
    const rows = [{ number: 1, live: true }, { number: 2, live: true }, { number: 3, live: false }]
    ok('a named live number resolves',
      (resolvePolicyTarget(2, rows) as { number: number })?.number === 2)
    ok('a rejected or merged-away number does not', resolvePolicyTarget(3, rows) === null)
    ok('a number that is not there does not', resolvePolicyTarget(9, rows) === null)
    // ⚠ AMBIGUITY IS REFUSED, NOT GUESSED — writing into whichever policy is nearest would be
    // the product choosing which of the user's candidates to overwrite.
    ok('no number, and more than one live policy, is AMBIGUOUS rather than a guess',
      resolvePolicyTarget(null, rows) === AMBIGUOUS_TARGET)
    ok('no number, and exactly one live policy, is not ambiguous at all',
      (resolvePolicyTarget(null, [{ number: 4, live: true }]) as { number: number })?.number === 4)
    control('an ambiguous target must not resolve to a row',
      () => typeof (resolvePolicyTarget(null, rows) as { number?: number })?.number === 'number')
    ok('the offer sentence names the box and the number',
      offerQuestion('policyOptions', 4) === 'Shall I put that in as guiding policy 4? You can edit it after.',
      offerQuestion('policyOptions', 4))
    ok('and every editable text field has a name a person would recognise',
      [...EDITABLE_TEXT_FIELDS].every((k) => !!EDIT_TARGET_LABELS[k]),
      `${EDITABLE_TEXT_FIELDS.size} fields`)
    control('a field with no label would fail that',
      () => ['notAField'].every((k) => !!EDIT_TARGET_LABELS[k]))
    ok('a question back to the user is not offered as a replacement',
      !looksLikeAReplacement('Would you like me to rewrite the second one for you?'))
    ok('and a real rewrite is', looksLikeAReplacement(REWRITE))
    control('a two-word fragment must not be offered as a field value',
      () => looksLikeAReplacement('the register'))

    // ══ §1b/§1c/§1d — THE ROUND TRIP, ON RENDERED DATA ═══════════════════════
    console.log('\n§1b–§1d — the round trip')
    const created = await prisma.policyOption.create({
      data: { ideaId, approach: ORIGINAL, number: 1, source: 'USER', kind: 'GUIDING_POLICY' },
      select: { id: true },
    })
    const before = await computeCanonicalState(ideaId)
    ok('the panel renders the original text',
      before?.policyOptions.some((o) => o.approach === ORIGINAL))

    // ⚠⚠ THE ROUTE'S OWN WRITER, NOT A COPY OF IT. CLAUDE.md §25.3: a re-implementation asserts
    // that two pieces of code agree, which they do until one is fixed. The first draft of this
    // check performed the transaction itself and would have stayed green through any change to
    // the real one.
    const wrote = await applyFieldEdit({
      ideaId, userId: owner.id, kind: 'POLICY_OPTION', fieldKey: 'policyOptions',
      number: 1, text: REWRITE,
    })
    ok('the write reports what it wrote, by name',
      !fieldEditFailed(wrote) && wrote.wrote.label === 'guiding policy' && wrote.wrote.number === 1,
      fieldEditFailed(wrote) ? wrote.error : `${wrote.wrote.label} ${wrote.wrote.number}`)

    const after = await computeCanonicalState(ideaId)
    // ⚠⚠ THE ASSERTION §1e ASKS FOR: the NEW TEXT IS PRESENT IN THE RENDERED PANEL. Not "the row
    // was updated" — 25-O §A1 was a row that updated and rendered nothing.
    ok('the rewrite renders in the panel the middle column draws from',
      after?.policyOptions.some((o) => o.approach === REWRITE))
    ok('and the old text is no longer rendered as the policy',
      !after?.policyOptions.some((o) => o.approach === ORIGINAL))
    control('a panel still showing the old text would fail that',
      () => !before?.policyOptions.some((o) => o.approach === ORIGINAL))

    // §1d — the user's words survive, attributed.
    const kept = await prisma.fieldRevision.findMany({
      where: { ideaId, targetId: created.id },
      select: { previousText: true, previousSource: true, newText: true },
    })
    ok('the superseded wording is kept verbatim',
      kept.length === 1 && kept[0].previousText === ORIGINAL)
    ok('and it is attributed to whoever wrote it',
      kept[0]?.previousSource === 'USER')
    control('a revision that lost the previous text would fail',
      () => [{ previousText: '' }].every((r) => r.previousText === ORIGINAL))
    // ⚠ A SECOND REWRITE MUST NOT LOSE THE FIRST — the reason this is a table and not a column.
    await prisma.fieldRevision.create({
      data: {
        ideaId, fieldKey: 'policyOptions', targetId: created.id, targetNumber: 1,
        previousText: REWRITE, previousSource: 'LEX',
        newText: 'A third wording.', acceptedById: owner.id, origin: 'CHAT_REWRITE',
      },
    })
    const both = await prisma.fieldRevision.count({ where: { ideaId, targetId: created.id } })
    ok('a second rewrite keeps the first as well', both === 2, `${both} kept`)

    // ⚠ AND THE REFUSALS ARE THE REAL ONES, run through the same function.
    const same = await applyFieldEdit({
      ideaId, userId: owner.id, kind: 'POLICY_OPTION', fieldKey: 'policyOptions',
      number: 1, text: REWRITE,
    })
    ok('re-writing the same words is refused rather than written twice',
      fieldEditFailed(same) && same.status === 409,
      fieldEditFailed(same) ? same.error : 'it wrote')
    const missing = await applyFieldEdit({
      ideaId, userId: owner.id, kind: 'POLICY_OPTION', fieldKey: 'policyOptions',
      number: 99, text: REWRITE,
    })
    ok('a number that is not on the idea is refused BY NAME',
      fieldEditFailed(missing) && /no policy 99/.test(missing.error),
      fieldEditFailed(missing) ? missing.error : 'it wrote')
    control('a refusal with no number in it would fail that',
      () => /no policy 99/.test('That is not on this idea.'))
    await prisma.policyOption.update({ where: { id: created.id }, data: { status: 'RULED_OUT' } })
    const rejected = await applyFieldEdit({
      ideaId, userId: owner.id, kind: 'POLICY_OPTION', fieldKey: 'policyOptions',
      number: 1, text: 'Something else entirely, at length, to be sure it is not the same-text refusal.',
    })
    ok('a policy rejected since the offer was made is refused, and says so',
      fieldEditFailed(rejected) && /was rejected since/.test(rejected.error),
      fieldEditFailed(rejected) ? rejected.error : 'it wrote')
    await prisma.policyOption.update({ where: { id: created.id }, data: { status: 'CANDIDATE' } })

    // ══ §1 — ONE WRITER, AND ONLY A CLICK REACHES IT ═════════════════════════
    console.log('\n§1 — the offer writes nothing')
    const lexSrc = code('app/api/ideas/[id]/lex/route.ts')
    const editRoute = code('app/api/ideas/[id]/field-edit/route.ts')
    const editSrc = code('lib/lex/field-edit-write.ts')
    ok('the chat route computes the offer and never writes a policy option',
      /editOffer/.test(lexSrc) && !/policyOption\.update/.test(lexSrc))
    // ⚠ THESE THREE FAILED WHEN THE WRITER MOVED OUT OF THE ROUTE — which is the check doing its
    // job. They read the module that holds the write now; the route keeps only auth, validation
    // and the response, and that is asserted separately below.
    ok('exactly one module updates a policy option for a chat edit',
      /policyOption\.update/.test(editSrc) && !/policyOption\.update/.test(editRoute))
    ok('and it keeps the previous wording in the same transaction',
      /\$transaction/.test(editSrc) && /fieldRevision\.create/.test(editSrc))
    ok('a stale target is refused by name rather than written to',
      /has been merged into another/.test(editSrc) && /was rejected since/.test(editSrc))
    ok('and the route is a wrapper the check bypasses only for auth',
      /applyFieldEdit\(/.test(editRoute) && /authorizeIdea/.test(editRoute))

    // ══ §3a — ASK MODE CHANGES NOTHING ═══════════════════════════════════════
    console.log('\n§3a — the first stage\'s chat answers and does not conduct')
    ok('ASK is a mode the route accepts', /'FLOW', 'ASK'/.test(lexSrc))
    ok('and in ASK mode the proposal is discarded before anything can act on it',
      /if \(askOnly\) lex\.proposal = null/.test(lexSrc))
    ok('and no stage advance is attempted', /!askOnly && !pre\.currentField/.test(lexSrc))
    ok('the panel sends that mode', /mode: 'ASK'/.test(code('components/lex/AskLexPanel.tsx')))
    // §23.1 — a component nothing imports cannot be what a user sees.
    ok('and the panel is reachable from the build page',
      /AskLexPanel/.test(code('app/ideas/build/BuildIdeaClient.tsx')))
    control('a component with no importer must fail that',
      () => /NoSuchPanel/.test(code('app/ideas/build/BuildIdeaClient.tsx')))

    // ══ §6 — ONE SOURCE FOR THE OPERATING FACTS ══════════════════════════════
    console.log('\n§6 — the facts the tour renders are the facts Lex is given')
    const block = productFactsBlock()
    ok('every fact reaches the prompt verbatim',
      PRODUCT_FACTS.every((f) => block.includes(f.answer)), `${PRODUCT_FACTS.length} facts`)
    ok('including the one Charlie actually asked',
      /how do i see the middle panel/i.test(block) && /DRAFT STRATEGY/.test(block))
    // ⚠⚠ THE ANSWER MUST BE NAVIGATION, NOT A DESCRIPTION. That is the whole defect: Lex
    // described what the panel contains to somebody asking how to reach it.
    const panelFact = PRODUCT_FACTS.find((f) => /middle panel/i.test(f.question))!
    ok('and it tells the user what to press, on both shapes of screen',
      /press/i.test(panelFact.answer) && /phone|narrow/i.test(panelFact.answer))
    control('a fact that only described the panel would fail that',
      () => /press/i.test('The middle panel holds the report itself.'))
    ok('the tour renders from the same array rather than a copy',
      /PRODUCT_FACTS/.test(code('components/lex/HowItWorksModal.tsx')))
    // ⚠ MATCHED ACROSS THE LINE BREAK, and the first version of this was not. The block is
    // joined with newlines, so a sentence that reads continuously in the source is split in the
    // string — an assertion written against the source's line, not the block's, and it failed on
    // correct code. Same shape as 25-P's absence-grep reading its own comment: the check has to
    // read what the consumer reads.
    ok('and the prompt is told not to improvise beyond them',
      /not\s+covered here, say you are not sure/.test(block))

    // ══ §7 — THE ATTRIBUTION IS AT THE FOOT ══════════════════════════════════
    console.log('\n§7 — the challenges')
    // ⚠ ON THE REAL ROWS, not a fixture: the defect was in data already written.
    const stillPrefixed = await prisma.deepeningIssue.count({
      where: { text: { startsWith: 'ANOTHER MODEL MADE THIS POINT' } },
    })
    const withSource = await prisma.deepeningIssue.count({ where: { sourceModel: { not: null } } })
    ok('no challenge is still headed by its own provenance', stillPrefixed === 0)
    ok('and the model that raised it is in its own column', withSource > 0, `${withSource} rows`)
    ok('the writer no longer builds that prefix',
      !/ANOTHER MODEL MADE THIS POINT/.test(code('lib/lex/build.ts')))
    ok('and it writes the source as a field instead',
      /sourceModel: m\.namedBy/.test(code('lib/lex/build.ts')))
    ok('the coverage check is asked for a title, and required to give one',
      /required: \['title', 'point', 'namedBy', 'whyItMatters'\]/.test(code('lib/lex/build-smart.ts')))
    ok('the panel renders the source at the foot, not as the heading',
      /Raised by \{c\.sourceModel\}/.test(code('components/lex/AgendaPanel.tsx')))
    control('a panel that never mentioned the source would fail that',
      () => /Raised by/.test('<p>{c.text}</p>'))

    // ══ §4/§8a/§8c — WHAT WAS ALREADY TRUE, ASSERTED SO IT STAYS TRUE ════════
    console.log('\n§4/§8 — the three that were already built')
    const ym = code('components/lex/YourMaterial.tsx')
    ok('§4 — an uploaded item can be opened', /openMaterial\(r\.id\)/.test(ym))
    ok('§4 — and the viewer says the file itself was never stored',
      /never stored/.test(readFileSync(join(process.cwd(), 'components/lex/YourMaterial.tsx'), 'utf8')))
    ok('§5 — the character count is explained rather than printed bare',
      /truncated/.test(ym) && !/characters kept\.\)/.test(ym))
    const qp = code('components/lex/QuestionPanel.tsx')
    ok('§8a — not-asked headings are excluded from both lists above',
      (qp.match(/!isNotAsked\(h\)/g) ?? []).length === 2)
    ok('§8b — the cause title is a textarea like the boxes under it',
      /<textarea value=\{c\}[\s\S]{0,200}placeholder="Cause"/.test(qp) === false
        && /<textarea value=\{c\}/.test(code('components/lex/FieldsPanel.tsx')))
    ok('§8c — the draft banner is in both documents already',
      (code('lib/documents/build-proposal.ts').match(/draftBanner\(snapshot\)/g) ?? []).length === 2)
  } finally {
    await prisma.idea.delete({ where: { id: ideaId } }).catch(() => {})
    const left = await prisma.idea.count({ where: { id: ideaId } })
    ok('the scratch idea is gone', left === 0, left ? `${left} still there` : idea.id.slice(0, 8))
  }

  console.log('\n── negative controls (each must FIRE) ──')
  let dead = 0
  for (const c of controls) {
    if (c.fired) console.log(`  ✓ fired — ${c.label}`)
    else { dead++; console.log(`  ✗ DID NOT FIRE — ${c.label}`) }
  }
  console.log(`\n${pass} passed, ${fail} failed, ${controls.length} controls (${dead} dead)\n`)
  process.exit(fail || dead ? 1 : 0)
}

main()
  .catch(async (e) => {
    console.error('\ncheck:lex-25q threw:', e)
    await prisma.idea.deleteMany({ where: { title: { startsWith: MARK } } }).catch(() => {})
    process.exit(1)
  })
  .finally(() => prisma.$disconnect())
