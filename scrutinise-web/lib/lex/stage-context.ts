// ─────────────────────────────────────────────────────────────────────────────
// SPRINT 25-K §1 → LEX 26-X §2–§3 (decisions 316, 317) — WHAT THE STAGE BAR SAYS, COUNTED. SERVER ONLY.
//
// ⚠⚠ SPLIT OUT OF `stages.ts` BECAUSE A CLIENT COMPONENT IMPORTS THAT ONE. `CreateIdeaClient` needs the stage NAMES; putting the prisma
// query beside them dragged `lib/prisma` → `pg` → `require('tls')` into the browser bundle and broke `next build` (CLAUDE.md §28).
//
// 26-X: THE BAR IS THE SEVEN-STAGE LIFECYCLE — Creation · Development · Private Scrutiny · Public Scrutiny · Promotion · Submission · In
// Force — each with ONE LINE OF STATE read from the data, the current one marked. Inside Development, the CHECKLIST (§3a): seven lines, each
// with its state in words and a shape, each opening its page. The checklist replaces the old "Stage N of 3" line (§3c).
// ⚠ A STATE LINE IS COUNTED OR SAYS WHY IT CANNOT BE. Private Scrutiny, Public Scrutiny and Promotion have nothing built behind them yet,
//   so they read "not yet open"; nothing on the platform records a submission yet, so Submission reads "not submitted" (2b defines what
//   one will record); In Force reads "not yet available" (decision 102). Those words are the truth, not placeholders.
// ─────────────────────────────────────────────────────────────────────────────

import { prisma } from '@/lib/prisma'
import { LEX_STAGES, LIFECYCLE_KEYS, lifecycleOfScreen, stageHref, type ActionsPage, type LexStage, type LexStageKey, type LifecycleKey } from './stages'
import { LIFECYCLE_STAGE_WORD, LIFECYCLE_UI } from './screen-labels'
import { developmentChecklist, developmentState, type ChecklistKey, type ChecklistLine } from './development'

export interface LexStageView extends LexStage {
  href: string
  detail: string | null
  available: boolean
  unavailableReason: string | null
}

export interface LifecycleStageView {
  key: LifecycleKey
  n: number
  name: string
  /** One line of state, from the data (§2a). */
  state: string
  /** Where pressing it goes; null when there is nothing built behind it yet. */
  href: string | null
}

export interface StageContext {
  ideaId: string | null
  /** Which SCREEN the user is on (the URL's stage). */
  here: LexStageKey
  /** 316 — the seven lifecycle stages and which one the user is in. */
  lifecycle: LifecycleStageView[]
  current: LifecycleKey
  /** §3 — the Development checklist; null on the Creation screen or before an idea exists. */
  checklist: ChecklistLine[] | null
  /** The checklist line the user is on (the Organising or Drafting page, or the Deepening), or null. */
  checklistHere: ChecklistKey | null
  /** The three screens, kept for the screens that link between them (BuildIdeaClient, Lex's controls). */
  stages: LexStageView[]
}

const plural = (n: number, one: string, many = `${one}s`) => `${n} ${n === 1 ? one : many}`

export async function stageContext(ideaId: string | null, here: LexStageKey, page: ActionsPage | null = null): Promise<StageContext> {
  const current = lifecycleOfScreen(here)
  const screens: LexStageView[] = LEX_STAGES.map((s) => ({
    ...s, href: stageHref(s.key, ideaId), detail: null,
    available: !!ideaId || s.key === 'idea', unavailableReason: ideaId || s.key === 'idea' ? null : 'Opens once you’ve told me the idea.',
  }))
  const idle: Record<Exclude<LifecycleKey, 'creation' | 'development'>, string> = {
    privateScrutiny: LIFECYCLE_UI.notYetOpen, publicScrutiny: LIFECYCLE_UI.notYetOpen, promotion: LIFECYCLE_UI.notYetOpen,
    submission: LIFECYCLE_UI.notSubmitted, inForce: LIFECYCLE_UI.notYetAvailable,
  }
  if (!ideaId) {
    return {
      ideaId: null, here, current, checklist: null, checklistHere: null, stages: screens,
      lifecycle: LIFECYCLE_KEYS.map((k, i) => ({ key: k, n: i + 1, name: LIFECYCLE_STAGE_WORD[k],
        state: k === 'creation' ? 'tell Lex the idea' : k === 'development' ? 'opens once Lex has built the idea' : idle[k], href: k === 'creation' ? stageHref('idea', null) : null })),
    }
  }
  const [runs, dev] = await Promise.all([prisma.ideaBuild.count({ where: { ideaId } }), developmentState(ideaId)])
  const checklist = here === 'idea' ? null : await developmentChecklist(ideaId, dev)
  const lifecycle: LifecycleStageView[] = LIFECYCLE_KEYS.map((k, i) => ({
    key: k, n: i + 1, name: LIFECYCLE_STAGE_WORD[k],
    state: k === 'creation' ? `Lex’s first pass · ${plural(runs, 'run')}`
      : k === 'development' ? `Organising ${plural(dev.counts.total, 'action')} · ${dev.counts.drafted} drafted · ${dev.counts.accepted} accepted`
      : idle[k],
    href: k === 'creation' ? stageHref('idea', ideaId) : k === 'development' ? stageHref('strategy', ideaId) : null,
  }))
  return {
    ideaId, here, current, lifecycle, checklist, stages: screens,
    checklistHere: here === 'deepening' ? 'deepening' : here === 'strategy' && page ? page : null,
  }
}
