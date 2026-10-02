// 26-P — the shapes the agent's tools, loop, route and UI share. No imports from prisma: this file is
// reachable from the CLIENT bundle (the cards import its types) and CLAUDE.md §28 says a client
// component's value imports are followed transitively. `import type` only, and nothing here has a body.

import type { ToolCategory } from './honesty'
import type { z } from 'zod'

/** What one turn has seen so far. Provenance is validated against it. */
export interface TurnState {
  /** Third-party text (a page, a document, a corpus passage) has entered this turn. */
  tainted: boolean
  /** Corpus ids returned by `search_corpus` this turn — the only ones `corpus` provenance may cite besides ones already on the idea. */
  corpusIds: Set<string>
  /** `[W]` markers returned by `search_web` this turn. */
  webSources: Map<string, { title: string; url: string; publisher: string }>
  /** The user's own recent words (this turn first). `user_words` provenance must quote these. */
  userMessages: string[]
  /**
   * A long text the user pasted. It is held here and NEVER put in the conversation (§4c: content is
   * data, in a separate channel; and a 100,000-character paste would be resent on every later turn).
   * `file_text{fromPaste:true}` files it without Lex having to reproduce it.
   */
  pastedText?: string | null
}

export interface ToolCtx {
  ideaId: string
  userId: string
  turn: TurnState
  /** TRUE only when called from the confirm endpoint with a verified token. Never set by the model. */
  confirmed: boolean
}

export interface PendingConfirmation {
  /** One plain sentence: what pressing the button will do. */
  summary: string
  /** Stated price in pence, or null when the action is free. */
  pence: number | null
  priceIsFloor?: boolean
  /** The brief's figure, not a measured one — carried to the card so it can say so. */
  priceSource?: string
  token: string
}

export interface UndoOffer {
  label: string
  token: string
}

export interface ToolResult {
  ok: boolean
  /** Set when the tool did NOT run and is waiting for the button. `ok` is false. */
  pending?: PendingConfirmation
  /** Structured data for the model. */
  data?: unknown
  /** The real reason, when `ok` is false and not pending. Never invented. */
  error?: string
  /** Per-item outcomes for a tool that handles several things. */
  items?: Array<{ ok: boolean; label?: string }>
  /** Third-party text, delivered in its own fenced channel — never concatenated into `data`. */
  untrusted?: string
  /** A button that reverses what this call did. */
  undo?: UndoOffer
  /** Cards for the interface: the UI is driven by these, not by parsed fields (§2a). */
  ui?: UiEffect[]
}

export type UiEffect =
  | { type: 'candidate_card'; number: number; approach: string; compoundWarning?: string | null }
  | { type: 'highlight_field'; fieldKey: string; waiting?: boolean }
  | { type: 'open_panel'; panel: string }
  | { type: 'note'; text: string }

// ⚠ `= any`, not `= z.ZodTypeAny`: the registry holds tools of many different schemas in one array, and
// with the narrower default `z.infer` collapses to `unknown` and every handler stops compiling. The
// schema is still parsed at runtime by `execute` before any handler sees its input.
export interface ToolDefinition<S extends z.ZodTypeAny = any> {
  name: string
  description: string
  category: ToolCategory
  /** `free` runs at once. `ask` never runs without the signed button. */
  tier: 'free' | 'ask'
  schema: S
  run: (ctx: ToolCtx, input: z.infer<S>) => Promise<ToolResult>
  /** For `ask` tools: the sentence on the confirm card. */
  describe?: (input: z.infer<S>) => string
  /** For run-tools whose confirmation depends on price. */
  runKind?: import('./run-prices').RunKind
}

/** The record of one call, as persisted on the assistant message (§9 "every tool call logged with its result"). */
export interface ToolLogEntry {
  name: string
  input: unknown
  ok: boolean
  pending?: boolean
  error?: string
  /** A short summary, not the payload — third-party text is never logged back into history. */
  summary: string
  ms: number
}
