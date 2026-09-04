// ─────────────────────────────────────────────────────────────────────────────
// SPRINT 25-N §5e — THE MEETING PACK. A third document, and a different reader.
//
// §5e: *"A third document, new: the meeting pack. For someone who will contribute but will not
// join the team. The current choices and decisions to be made, plus the research and issues,
// printable, with the user choosing what to show and hide before printing."*
//
// ⚠⚠ IT IS NOT A SHORTER PROPOSAL, AND THAT IS THE WHOLE POINT. The Proposal and the Summary
// are written for somebody being ASKED TO AGREE — they lead on what has been settled and treat
// what has not as a limitation. This is written for somebody being asked to ARGUE, in a room,
// for an hour: it leads on what is still open, because that is the only part of the document a
// meeting can change. A summary handed to that person wastes the meeting on things nobody in
// it can affect.
//
// ⚠ SO THE ORDER IS INVERTED RELATIVE TO EVERY OTHER DOCUMENT WE MAKE:
//     1. what is being decided, and the options on the table
//     2. what nobody has answered
//     3. the challenges — what a hostile reader would ask
//     4. the settled kernel, briefly, as background rather than as the case
//     5. the evidence behind all of it
//
// ⚠ AND IT HAS NO "THE ASK". A person who has not joined the team is not being asked to
// endorse anything; putting an ask in front of them is what makes an invitation to help read
// as a request to sign.
//
// ⚠ WHAT THE USER CHOOSES TO SHOW OR HIDE IS A PARAMETER, NOT A SECOND BUILDER. `sections`
// says which of the five to include; everything else — the ordering, the wording, the never-
// claim rules — is the same code whichever they pick, so a hidden section cannot change what
// the shown ones say.
// ─────────────────────────────────────────────────────────────────────────────

import type { Block, DocumentModel, Run } from './model'
import { betaBlocks } from './build-proposal'
import { BETA_MARKER } from '../lex/beta-disclosure'
import type { ProposalSnapshot } from './proposal-snapshot'
import { snapshotHash } from './proposal-snapshot'
import { QUESTION_HEADINGS, HEADING_ORDER, liveHeading, type HeadingKey } from '../lex/question-headings'
import { positionsCaveat, tallyPositions } from '../lex/positions-caveat'
import type { ProposalBuildResult } from './build-proposal'

function text(s: string): Run[] {
  return [{ text: s }]
}

/**
 * The five sections, in the order a meeting works through them.
 *
 * ⚠ DATA, so a check can assert the order and the wording without rendering anything — the
 * same reasoning as `HEADING_ORDER` and `REPORT_SECTIONS`.
 */
export const MEETING_PACK_SECTIONS = [
  { key: 'decisions', title: 'What is being decided' },
  { key: 'questions', title: 'What nobody has answered' },
  { key: 'challenges', title: 'What a hostile reader would ask' },
  { key: 'background', title: 'The proposal so far' },
  { key: 'evidence', title: 'The evidence behind it' },
] as const

export type MeetingPackSection = (typeof MEETING_PACK_SECTIONS)[number]['key']

export const ALL_MEETING_PACK_SECTIONS: MeetingPackSection[] =
  MEETING_PACK_SECTIONS.map((s) => s.key)

/**
 * ⚠ ONLY AN ACCEPTED OR SKIPPED FIELD HAS A VALUE THE DOCUMENT MAY PRINT, and this mirrors
 * `build-proposal.ts`'s rule exactly. A field still being drafted holds Lex's proposal, not the
 * proposer's position, and printing it in a pack handed to somebody outside the team would
 * attribute a claim to a person who has not made it.
 */
function fieldText(snapshot: ProposalSnapshot, key: string): string | null {
  const f = snapshot.fields.find((x) => x.key === key)
  if (!f) return null
  if (f.status !== 'ACCEPTED' && f.status !== 'SKIPPED') return null
  return typeof f.value === 'string' && f.value.trim() ? f.value.trim() : null
}

export function buildMeetingPackDocument(
  snapshot: ProposalSnapshot,
  opts: { sections?: MeetingPackSection[]; onlineViewUrl?: string | null } = {},
): ProposalBuildResult {
  // ⚠ THE DEFAULT IS EVERYTHING. A user who has not chosen has not chosen to omit anything,
  // and a pack that quietly dropped a section by default would be a pack whose reader could
  // not tell what they had not been shown.
  const want = new Set<MeetingPackSection>(opts.sections?.length ? opts.sections : ALL_MEETING_PACK_SECTIONS)
  const blocks: Block[] = []
  // ⚠ 25-V §11a/§11b — first block on every generated document. See `betaBlocks`.
  blocks.push(...betaBlocks())

  // ⚠ WHO THIS IS FOR, SAID FIRST. The reader did not ask for it and has thirty seconds to
  // decide whether it is worth an hour of their time.
  blocks.push({
    kind: 'note',
    text: 'A pack for a meeting about this proposal. It leads on what is still open, because that '
      + 'is the part a discussion can change. Nothing in it is a settled position, and you are not '
      + 'being asked to endorse anything.',
  })

  // ⚠ WHAT WAS LEFT OUT IS NAMED, NOT SILENTLY ABSENT. §5e lets the user hide sections before
  // printing, and a reader who cannot tell what was hidden cannot ask for it. Same rule as the
  // stated gaps in the research panel: an omission we chose is worth more said than unsaid.
  const omitted = MEETING_PACK_SECTIONS.filter((s) => !want.has(s.key))
  if (omitted.length) {
    blocks.push({
      kind: 'note',
      text: `Left out of this printing: ${omitted.map((s) => s.title.toLowerCase()).join(', ')}. `
        + 'Ask for the full pack if you want them.',
    })
  }

  // ── 1. What is being decided ────────────────────────────────────────────────
  if (want.has('decisions')) {
    blocks.push({ kind: 'section', title: 'WHAT IS BEING DECIDED' })
    const live = (snapshot.options ?? []).filter((o) => o.status !== 'RULED_OUT')
    const ruledOut = (snapshot.options ?? []).filter((o) => o.status === 'RULED_OUT')

    if (live.length > 1) {
      blocks.push({ kind: 'heading', level: 1, runs: text('The approaches on the table') })
      blocks.push({
        kind: 'note',
        text: `${live.length} approaches are under consideration and none has been committed to. `
          + 'This is the decision the meeting can most usefully help with.',
      })
      blocks.push({
        kind: 'bullets',
        items: live.map((o): Run[] => [
          { text: o.approach, bold: true },
          { text: o.caseFor ? ` — ${o.caseFor}` : '' },
        ]),
      })
    } else if (live.length === 1) {
      blocks.push({ kind: 'heading', level: 1, runs: text('The approach under consideration') })
      blocks.push({ kind: 'paragraph', runs: text(live[0].approach) })
      if (live[0].caseFor) blocks.push({ kind: 'paragraph', runs: text(live[0].caseFor) })
    } else {
      blocks.push({ kind: 'heading', level: 1, runs: text('The approaches on the table') })
      blocks.push({ kind: 'paragraph', runs: text('None has been recorded yet.') })
    }

    // ⚠ WHAT WAS RULED OUT, WITH THE REASON. A meeting that re-proposes a discarded option is a
    // meeting wasted, and the reason is what stops it — 25-C's rule that a proposal showing
    // what it considered is stronger than one that looks inevitable.
    if (ruledOut.length) {
      blocks.push({ kind: 'heading', level: 1, runs: text('Already ruled out, and why') })
      blocks.push({
        kind: 'bullets',
        items: ruledOut.map((o): Run[] => [
          { text: o.approach, bold: true },
          { text: o.ruleOutReason ? ` — ${o.ruleOutReason}` : ' — no reason recorded' },
        ]),
      })
    }

    const causes = snapshot.causes ?? []
    if (causes.length > 1 && !causes.some((c) => c.isRootCause)) {
      blocks.push({ kind: 'heading', level: 1, runs: text('Which cause is the root one') })
      blocks.push({
        kind: 'note',
        text: `${causes.length} causes are under consideration and none has been settled on as the root.`,
      })
      blocks.push({ kind: 'bullets', items: causes.map((c): Run[] => [{ text: c.cause }]) })
    }
  }

  // ── 2. What nobody has answered ─────────────────────────────────────────────
  if (want.has('questions')) {
    blocks.push({ kind: 'section', title: 'WHAT NOBODY HAS ANSWERED' })
    blocks.push({ kind: 'heading', level: 1, runs: text('Open questions') })
    const unknowns = snapshot.knownUnknowns ?? []
    if (unknowns.length) {
      blocks.push({
        kind: 'bullets',
        items: unknowns.map((u): Run[] => [
          { text: u.question, bold: true },
          { text: u.why ? ` — ${u.why}` : '' },
        ]),
      })
    } else {
      // ⚠ AN HONEST EMPTY STATE. "No open questions were recorded" and "there are no open
      // questions" are different claims, and only the first one is ours to make.
      blocks.push({
        kind: 'paragraph',
        runs: text('None were recorded. That is a fact about the research so far, not a claim that '
          + 'every question has been answered.'),
      })
    }
  }

  // ── 3. Challenges ───────────────────────────────────────────────────────────
  if (want.has('challenges')) {
    blocks.push({ kind: 'section', title: 'WHAT A HOSTILE READER WOULD ASK' })
    blocks.push({ kind: 'heading', level: 1, runs: text('Challenges') })
    // ⚠ 25-X §3 — the CURRENT build's set. A meeting pack is read in a room off a printed
    // page; carrying nine drafts' objections into it was the surest way to have none of them
    // discussed. `current !== false` keeps a pre-25-X stored snapshot rendering unchanged.
    const open = (snapshot.issues ?? []).filter((i) => i.status === 'OPEN' && i.current !== false)
    if (open.length) {
      // ⚠ 25-W §C — the title leads, where there is one. This pack is read in a room, out
      // loud, off a page somebody is holding: an unnamed list of thirty objections is the
      // hardest possible thing to chair.
      blocks.push({
        kind: 'bullets',
        items: open.map((i): Run[] => [
          ...(i.title?.trim() ? [{ text: `${i.title.trim()} — `, bold: true }] : []),
          { text: i.text },
        ]),
      })
    } else {
      blocks.push({ kind: 'paragraph', runs: text('No open challenges are on the record.') })
    }
  }

  // ── 4. The proposal so far ──────────────────────────────────────────────────
  if (want.has('background')) {
    blocks.push({ kind: 'section', title: 'THE PROPOSAL SO FAR' })
    for (const [key, label] of [
      ['challenge', 'The problem'],
      ['rootCause', 'The cause'],
      ['chosenApproach', 'The guiding policy'],
    ] as const) {
      const v = fieldText(snapshot, key)
      blocks.push({ kind: 'heading', level: 1, runs: text(label) })
      // ⚠ "NOT SETTLED" IS PRINTED, NOT SKIPPED. To this reader an absent heading reads as an
      // answer nobody thought worth writing down; the stated absence is the invitation.
      blocks.push({ kind: 'paragraph', runs: text(v ?? 'Not settled yet.') })
    }
    if (snapshot.actions.length) {
      blocks.push({ kind: 'heading', level: 1, runs: text('What would be done') })
      blocks.push({
        kind: 'bullets',
        items: snapshot.actions.map((a): Run[] => [
          { text: a.practicalStep, bold: true },
          { text: a.targetOrganisation ? ` — ${a.targetOrganisation}` : '' },
        ]),
      })
    }
  }

  // ── 5. The evidence ─────────────────────────────────────────────────────────
  if (want.has('evidence')) {
    blocks.push({ kind: 'section', title: 'THE EVIDENCE BEHIND IT' })
    const byHeading = new Map<HeadingKey, ProposalSnapshot['evidence']>()
    for (const e of snapshot.evidence ?? []) {
      // ⚠ THROUGH `liveHeading`, LIKE EVERY OTHER READER — 25-N §4. A raw comparison would drop
      // every row the adversarial pass has written.
      const k = liveHeading(e.headingKey)
      if (!k || !HEADING_ORDER.includes(k)) continue
      const list = byHeading.get(k) ?? []
      list.push(e)
      byHeading.set(k, list)
    }
    if (!byHeading.size) {
      blocks.push({ kind: 'paragraph', runs: text('No findings have been filed under a question yet.') })
    }
    for (const key of HEADING_ORDER) {
      const rows = byHeading.get(key)
      if (!rows?.length) continue
      const def = QUESTION_HEADINGS.find((h) => h.key === key)
      blocks.push({ kind: 'heading', level: 1, runs: text(def?.heading ?? key) })
      // ⚠ 26-A §3b — the same caveat, from the same function. See `positions-caveat.ts`.
      if (key === 'POSITIONS') {
        blocks.push({ kind: 'note', text: positionsCaveat(tallyPositions(rows)) })
      }
      // ⚠ TITLES AND CITATIONS ONLY. This is a pack somebody reads in a meeting, not the
      // evidence pack — printing every finding's body would be the hundred pages §5c's running
      // headers exist to help a reader survive, handed to somebody with an hour.
      blocks.push({
        kind: 'bullets',
        items: rows.map((e): Run[] => [
          { text: e.title, bold: true },
          { text: e.citation ? ` — ${e.citation}` : '' },
        ]),
      })
    }
  }

  if (opts.onlineViewUrl) {
    blocks.push({ kind: 'rule' })
    blocks.push({
      kind: 'paragraph',
      runs: [
        { text: 'Everything behind this, in full: ' },
        { text: opts.onlineViewUrl, href: opts.onlineViewUrl },
      ],
    })
  }

  const model: DocumentModel = {
    title: `${snapshot.title} — meeting pack`,
    subtitle: `What is open, and what would most help to discuss · ${BETA_MARKER}`,
    sourceLabel: 'the proposal as it stands',
    generatedAt: new Date(),
    blocks,
  }
  return { model, fingerprint: snapshotHash(snapshot), sourceLabel: model.sourceLabel }
}
