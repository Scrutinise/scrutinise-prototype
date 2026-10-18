// CHARLIE'S SEVEN HEADINGS for idea 452c5ade (26-S2 decision 187, CCh 18 Oct 2026 (5)) - the instruments of implementation the Re-sort pass sorts into.
// Charlie had already built these seven under short names (Legislation, CS Code, CS Mgt Code, The platform, Rules & Standards, Oversight, Training); formerly renames each IN PLACE (same id, same actions, same hidden flag) instead of archiving it and starting again.
// The wording of each purpose is Charlie's own, from his notebook note "New implementation headings for the actions". Data for ONE idea, so it lives
// with the scripts that seed and measure it, not in product code: the product reads the plan from `Idea.headingPlan`.
import type { HeadingPlan } from '../../lib/lex/action-resort-pure'

export const SEVEN_HEADINGS: HeadingPlan = {
  source: 'Charlie, 18 Oct 2026 (decision 187): headings are instruments of implementation; purposes from his note "New implementation headings for the actions"',
  targets: [
    { name: 'Primary legislation', formerly: ['Legislation'], purpose: 'The Act: to include the named-owner duty, authority with duty, the standard stated before work starts, candour, records, committee powers.' },
    { name: 'Civil Service Code', formerly: ['CS Code'], purpose: 'How individuals must behave: candour, no covert frustration, record integrity.' },
    { name: 'Civil Service Management Code', formerly: ['CS Mgt Code'], purpose: 'How departments must manage: appointment and dismissal on merit, judgement reflected upward, consequences, safe harbour, review by line and panel.' },
    { name: 'The accountability platform', formerly: ['The platform'], purpose: 'Includes strategies, goals, owners, standards, constraints, handovers, reporting.' },
    { name: 'Budgets and standards', formerly: ['Rules & Standards'], purpose: 'Includes the service-standard scale, benchmarks, market creation, public value.' },
    { name: 'Transparency and oversight', formerly: ['Oversight', 'Transparency & Oversight'], purpose: 'Includes transparency, Parliament and the NAO: questioning named owners, evidence rules, publication.' },
    { name: 'Training, guidance and the pilot', formerly: ['Training', 'Training & Implementation'], purpose: 'Includes induction, the anti-evasion manual, programme owner, phases, evaluation.' },
  ],
}

/** Charlie's ten conditions on 452c5ade, verbatim (CCh 18 Oct 2026 (5), decision 188). */
export const CHARLIES_TEN: string[] = [
  'One named owner per task',
  'Authority and resources match the duty',
  'Duty, purpose and measure stated before work starts',
  'Consequences that tell honest error in a broken system from recklessness or negligence',
  'Visibility to everyone above in the line',
  'Safeguards against gaming',
  'Psychological safety, so bad news surfaces — blame-free investigation of system failure before individual fault',
  'Fit with existing machinery if not in conflict, else replacement of conflicting existing rules, codes and legislation',
  "Success judged in two interests: the taxpayer's cost and the beneficiary's chosen standard; the standard decided by elected members or by delegated authority",
  'Ruthless brevity in goals',
]
export const CONDITIONS_SOURCE = { noteId: null, label: 'Charlie’s ten conditions, as given to Lex by CCh on 18 Oct 2026 (brief 26-S2, decision 188). No notebook note holding them was found on this idea.' }
