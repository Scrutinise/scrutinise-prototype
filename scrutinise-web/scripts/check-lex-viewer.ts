// check:lex-viewer — THE VIEWER HOLE (CCh 2145Z point 3, 22 Nov 2026). Counts what RAN: ran, passed, controls fired, dead, not run.
//
//   A · the rule, pure: owner and EDITOR read and write; a VIEWER reads only; a stranger nothing; an unknown role reads only.
//   B · the source: every GET handler that calls authorizeIdea passes 'read'; no write handler does; no idea route admits a collaborator
//       without reading the role (the six routes that checked inline). Comments are stripped before scanning.
//   C · the REAL routes, on a scratch copy of 452c5ade (452c5ade itself is never written), as three users through the stub-auth seam:
//       a VIEWER's write is refused 403 in words and changes nothing; an EDITOR's and the owner's go through; the VIEWER can still read.
//       Planted control: the same VIEWER made an EDITOR is let through, so the refusal is the role and not something else.
import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join } from 'node:path'
import { prisma } from '../lib/prisma'
import { ideaAccessOf, accessAllows, VIEWER_WRITE_REFUSED } from '../lib/lex/authz'

const ROOT = join(__dirname, '..')
let ran = 0, pass = 0, fail = 0, controls = 0, dead = 0, notRun = 0
function ok(name: string, cond: boolean, detail = '') { ran++; if (cond) { pass++; console.log(`  ✓ ${name}`) } else { fail++; console.log(`  ✗ ${name}${detail ? `\n      ${detail}` : ''}`) } }
/** A planted case the check must SEE: `seen` true = the control fired (the check can tell). */
function control(name: string, seen: boolean) { controls++; if (!seen) { dead++; console.log(`  ✗ DEAD CONTROL — ${name}`) } else console.log(`  · control fired — ${name}`) }
function skip(name: string, why: string) { notRun++; console.log(`  – NOT RUN — ${name} (${why})`) }
const section = (s: string) => console.log(`\n── ${s} ──`)

function partA() {
  section('A · the rule')
  const c = [{ userId: 'ed', role: 'EDITOR' }, { userId: 'vw', role: 'VIEWER' }, { userId: 'odd', role: 'SOMETHING' }]
  const may = (u: string, need: 'read' | 'write') => accessAllows(ideaAccessOf(u, 'own', c), need)
  ok('the owner reads and writes', may('own', 'read') && may('own', 'write'))
  ok('an EDITOR reads and writes', may('ed', 'read') && may('ed', 'write'))
  ok('a VIEWER reads, and may NOT write', may('vw', 'read') && !may('vw', 'write'))
  ok('a role the rule does not know reads only (never write by default)', may('odd', 'read') && !may('odd', 'write'))
  ok('a stranger may do neither', !may('x', 'read') && !may('x', 'write'))
  // the old rule, planted: role ignored, any collaborator admitted — the check must tell it apart
  const oldRule = (u: string) => u === 'own' || c.some((x) => x.userId === u)
  control('the OLD rule (role ignored) lets the VIEWER write — the new one does not', oldRule('vw') && !may('vw', 'write'))
}

function walk(d: string, out: string[] = []): string[] {
  for (const n of readdirSync(d)) { const p = join(d, n); if (statSync(p).isDirectory()) walk(p, out); else if (/route\.tsx?$/.test(n)) out.push(p) }
  return out
}
const stripComments = (s: string) => s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:'"`])\/\/.*$/gm, '$1')

function partB() {
  section('B · the source: every route says what it needs')
  const routes = walk(join(ROOT, 'app/api'))
  const wrong: string[] = []; let gets = 0, writes = 0
  for (const f of routes) {
    const lines = stripComments(readFileSync(f, 'utf8')).split('\n')
    let fn = '?'
    lines.forEach((l, i) => {
      const m = l.match(/export\s+(?:async\s+)?function\s+(\w+)|export\s+const\s+(\w+)\s*=/)
      if (m) fn = m[1] || m[2]
      if (!/authorizeIdea\(/.test(l) || /import/.test(l)) return
      const read = /authorizeIdea\([^)]*'read'\)/.test(l)
      if (fn === 'GET') { gets++; if (!read) wrong.push(`${f.slice(ROOT.length)}:${i + 1} GET without 'read'`) }
      else { writes++; if (read) wrong.push(`${f.slice(ROOT.length)}:${i + 1} ${fn} asks only for 'read'`) }
    })
  }
  ok(`every GET handler's authorizeIdea passes 'read' (${gets}) and no write handler does (${writes})`, wrong.length === 0 && gets > 30 && writes > 50, wrong.join('; '))
  // an inline "any collaborator" check is fine where it guards a READ (a GET: a VIEWER may read); inside a write handler it is the hole
  const ROLELESS = /collaborators\.some\(\s*\(?c\)?\s*=>\s*c\.userId\s*===\s*\w+(\.id)?\s*\)/
  const inline: string[] = []; let inlineReads = 0
  for (const f of routes) {
    let fn = '?'
    stripComments(readFileSync(f, 'utf8')).split('\n').forEach((l, i) => {
      const m = l.match(/export\s+(?:async\s+)?function\s+(\w+)|export\s+const\s+(\w+)\s*=/)
      if (m) fn = m[1] || m[2]
      if (!ROLELESS.test(l)) return
      if (fn === 'GET') inlineReads++
      else inline.push(`${f.slice(ROOT.length)}:${i + 1} (${fn})`)
    })
  }
  ok(`no WRITE handler admits a collaborator without reading the role (the six inline checks go through ideaAccessOf; ${inlineReads} GET-only check(s) left, reads are a VIEWER's)`, inline.length === 0, inline.join(', '))
  control('…the scan sees a role-less check: planted in a POST, it is found', (() => { const planted = 'export async function POST() {\n  const ok = idea.collaborators.some(c => c.userId === user.id)\n}'; let fn = '?', hit = false; planted.split('\n').forEach((l) => { const m = l.match(/export\s+(?:async\s+)?function\s+(\w+)/); if (m) fn = m[1]; if (ROLELESS.test(l) && fn !== 'GET') hit = true }); return hit })())
}

async function partC() {
  section('C · the real routes, as a VIEWER, an EDITOR and the owner, on a scratch copy of 452c5ade')
  const { scratchCopy, deleteScratch } = await import('./lib/scratch-copy')
  let scratch: { id: string; userId: string } | null = null
  try { scratch = await scratchCopy('452c5ade', 'viewer-hole') } catch (e) { skip('the routes', `no scratch copy: ${(e as Error).message.slice(0, 120)}`); return }
  const as = (u: unknown) => { (globalThis as { __STUB_AUTH_USER?: unknown }).__STUB_AUTH_USER = u }
  const added: string[] = []
  try {
    // two existing users who are NOT the owner, in a fixed but non-id order; made collaborators of the SCRATCH idea only
    const others = await prisma.$queryRaw<Array<{ id: string }>>`SELECT id FROM "User" WHERE id <> ${scratch.userId} ORDER BY md5(id) LIMIT 2`
    if (others.length < 2) { skip('the routes', 'fewer than two other users'); return }
    const [viewerId, editorId] = others.map((o) => o.id)
    for (const [userId, role] of [[viewerId, 'VIEWER'], [editorId, 'EDITOR']] as const) {
      const r = await prisma.ideaCollaborator.create({ data: { ideaId: scratch.id, userId, role, invitedByUserId: scratch.userId } })
      added.push(r.id)
    }
    const owner = await prisma.user.findUnique({ where: { id: scratch.userId } })
    const viewer = await prisma.user.findUnique({ where: { id: viewerId } })
    const editor = await prisma.user.findUnique({ where: { id: editorId } })
    const params = { params: Promise.resolve({ id: scratch.id }) }
    const actions = await import('../app/api/ideas/[id]/actions/route')
    const state = await import('../app/api/ideas/[id]/state/route')
    const roots = await import('../app/api/ideas/[id]/root-causes/route')
    const a = await prisma.lexCoherentAction.findFirst({ where: { ideaId: scratch.id, status: 'LIVE' }, orderBy: { number: 'asc' }, select: { id: true, practicalStep: true } })
    if (!a) { skip('the routes', 'the scratch copy has no live action'); return }
    const edit = (t: string) => actions.POST(new Request('http://x', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ action: 'update', actionId: a.id, practicalStep: t }) }), params)
    const now = async () => (await prisma.lexCoherentAction.findUnique({ where: { id: a.id }, select: { practicalStep: true } }))?.practicalStep

    as(viewer)
    const vw = await edit('Written by a viewer (viewer check)')
    const vwBody = await vw.json().catch(() => ({})) as { error?: string }
    ok('a VIEWER\'s write to an action is refused 403, in words', vw.status === 403 && vwBody.error === VIEWER_WRITE_REFUSED, `${vw.status} ${JSON.stringify(vwBody).slice(0, 160)}`)
    ok('…and nothing was written', (await now()) === a.practicalStep, await now() ?? '')
    const vr = await state.GET(new Request('http://x'), params)
    ok('the VIEWER can still READ the idea (GET state → 200)', vr.status === 200, String(vr.status))
    const rg = await roots.GET(new Request('http://x'), params)
    const rp = await roots.POST(new Request('http://x', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({}) }), params)
    ok('an inline-check route (root causes): the VIEWER reads (GET 200) and is refused the write (POST 403)', rg.status === 200 && rp.status === 403, `GET ${rg.status}, POST ${rp.status}`)

    as(editor)
    const ed = await edit('Written by an editor (viewer check)')
    ok('an EDITOR\'s write goes through (200) and is saved', ed.status === 200 && (await now()) === 'Written by an editor (viewer check)', `${ed.status} ${await now()}`)
    as(owner)
    const ow = await edit('Written by the owner (viewer check)')
    ok('the owner\'s write goes through (200) and is saved', ow.status === 200 && (await now()) === 'Written by the owner (viewer check)', `${ow.status} ${await now()}`)

    // planted control: the SAME viewer, made an EDITOR, is let through — the refusal above was the role, nothing else
    await prisma.ideaCollaborator.update({ where: { id: added[0] }, data: { role: 'EDITOR' } })
    as(viewer)
    const promoted = await edit('Written by the viewer once an editor (viewer check)')
    control('the same user, made an EDITOR, is let through: the 403 was the role', promoted.status === 200)
  } finally {
    as(undefined)
    if (added.length) await prisma.ideaCollaborator.deleteMany({ where: { id: { in: added } } })
    console.log(`  (collaborator rows removed: ${added.length}; scratch copy deleted: ${await deleteScratch(scratch.id)})`)
  }
}

;(async () => {
  console.log('check:lex-viewer — a VIEWER reads only; writes need the owner or an EDITOR')
  partA()
  partB()
  await partC()
  console.log(`\n${ran} ran · ${pass} passed · ${fail} failed · ${controls} controls (${dead} dead) · ${notRun} not run`)
  await prisma.$disconnect()
  process.exit(fail || dead ? 1 : 0)
})().catch((e) => { console.error(e); process.exit(1) })
