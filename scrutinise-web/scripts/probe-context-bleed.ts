/**
 * probe-context-bleed.ts — does conversation history change what the ROUTER asks for?
 *
 * `general-chat.ts` passes `ideaContext: conversationContext(history)` into the gateway, and
 * `routeQuery` feeds that context to the LLM that writes each stream's tailored search string.
 * On 2026-08-08 a question about regulators' disclosure powers, asked after two data-protection
 * turns, retrieved 233 data-protection sources. This isolates the variable.
 *
 * WHY NOT AN END-TO-END BROWSER RUN. Asking the same question cold in the UI and comparing the
 * retrieved sets would also work, but it changes two things at once (history AND the retrieval
 * that follows) and it is at the mercy of a flaky text input. Calling `routeQuery` directly with
 * and without context changes exactly one thing and shows the tailored queries themselves, which
 * is the actual mechanism rather than a downstream symptom.
 *
 * Costs two Gemini calls. Read-only: no search is run, nothing is written.
 *
 * Usage (LEX_QUERY_ROUTER must be on for routeQuery to do anything — that is its own gate):
 *   LEX_QUERY_ROUTER=true tsx --env-file=.env scripts/probe-context-bleed.ts
 */
import { routeQuery } from '../lib/lex/query-expansion'

const QUESTION = ['What', 'powers', 'do', 'regulators', 'have', 'to', 'compel', 'disclosure', 'of', 'information', 'from', 'companies?']

/** The two turns that preceded it in the live session, in the shape conversationContext emits. */
const HISTORY = [
  'Q: Which Acts and statutory instruments govern data protection, what have select committees said about them, and is there relevant case law?',
  'A: The Privacy and Electronic Communications (EC Directive) Regulations 2003 are a key statutory instrument governing data protection. The Data Protection Act 2018 is also relevant.',
  'Q: what is the law on data protection currently?',
  'A: The Privacy and Electronic Communications (EC Directive) Regulations 2003, often referred to as the PEC Regulations, are a key statutory instrument governing data protection.',
].join('\n').slice(0, 500)

function show(label: string, route: Record<string, string> | null) {
  console.log(`\n── ${label} ${'─'.repeat(Math.max(0, 60 - label.length))}`)
  if (!route) { console.log('   routeQuery returned NULL (fail-open — see the [query-router] line above)'); return }
  const names = Object.keys(route)
  if (!names.length) { console.log('   no streams named'); return }
  console.log(`   streams: ${names.join(', ')}`)
  for (const n of names) console.log(`     ${n.padEnd(12)} "${route[n as keyof typeof route]}"`)
}

/** Crude but sufficient: does the tailored query mention the PREVIOUS topic? */
function bleedTerms(route: Record<string, string> | null): string[] {
  if (!route) return []
  const hay = Object.values(route).join(' ').toLowerCase()
  return ['data protection', 'gdpr', 'personal data', 'privacy', 'pecr', 'data protection act']
    .filter((t) => hay.includes(t))
}

async function main() {
  if (process.env.LEX_QUERY_ROUTER !== 'true' && process.env.LEX_QUERY_ROUTER !== 'TRUE') {
    console.log('LEX_QUERY_ROUTER is not set for this process — routeQuery gates on it and will return null.')
    console.log('Re-run as: LEX_QUERY_ROUTER=true tsx --env-file=.env scripts/probe-context-bleed.ts')
  }
  console.log(`question: ${QUESTION.join(' ')}`)

  const cold = await routeQuery(QUESTION, '')
  show('COLD — no conversation history', cold)
  const coldBleed = bleedTerms(cold)
  console.log(`   previous-topic terms present: ${coldBleed.length ? coldBleed.join(', ') : 'NONE'}`)

  const warm = await routeQuery(QUESTION, HISTORY)
  show('WITH two data-protection turns as history', warm)
  const warmBleed = bleedTerms(warm)
  console.log(`   previous-topic terms present: ${warmBleed.length ? warmBleed.join(', ') : 'NONE'}`)

  console.log('\n── verdict ' + '─'.repeat(50))
  if (!cold || !warm) {
    console.log('   INCONCLUSIVE — one of the two calls failed open.')
  } else if (warmBleed.length && !coldBleed.length) {
    console.log('   CONFIRMED: history injected the previous topic into the tailored queries.')
    console.log(`   The cold run mentions none of it; the warm run mentions: ${warmBleed.join(', ')}.`)
  } else if (warmBleed.length && coldBleed.length) {
    console.log('   AMBIGUOUS: both runs mention the previous topic — the question may genuinely')
    console.log('   invite it, so this does not isolate the bleed. Pick a more distant topic.')
  } else {
    console.log('   NOT REPRODUCED here: history did not inject the previous topic into the queries.')
    console.log('   The retrieval difference seen live would then be downstream of routing, not in it.')
  }
}

main().catch((e) => { console.error(e); process.exit(1) })
