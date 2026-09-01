'use client'

// ─────────────────────────────────────────────────────────────────────────────
// 25-S §3 — THE MAP IS A DIAGRAM.
//
// Charlie: *"'map' just indents some a bit."* That is a second list, not a map.
//
// ══ §3a — SVG, NOT MERMAID, AND HERE IS WHY ═══════════════════════════════════════
//
// Mermaid was the brief's first suggestion and it is the wrong tool for this box:
//
//   1. **It is a dependency of about half a megabyte** for one diagram of a dozen nodes, loaded
//      into the client bundle of the app's busiest page. Nothing else here needs it.
//   2. **Its layout engine assumes it can have the width it wants.** This diagram lives in a
//      column measured below at ~420 px by default and ~180 px at the user's minimum. Mermaid
//      would produce a correct diagram at a width the panel does not have.
//   3. **Its styling is where colour creeps in.** §3c forbids meaning carried by colour alone,
//      and Mermaid's defaults encode node classes as fills. Overriding that is more work than
//      drawing the tree.
//
// A tree of at most four levels (`MAX_CAUSE_DEPTH`) with one parent each is a layout problem
// with a closed-form answer. So: hand-drawn SVG, no dependency, and full control of both the
// width and the encoding.
//
// ══ §3b — THE DIRECTION IS THE ONE ALREADY SETTLED ════════════════════════════════
//
// 25-O settled it: **stored root-down, displayed material-cause-up.** The material cause — the
// thing the proposal attacks — sits at the TOP, and what it follows from descends beneath it.
// This does not introduce a second convention; it draws the one the list already uses, which is
// why a node's children appear below it here exactly as they are indented below it there.
//
// ══ §3c — NOTHING IS ENCODED BY COLOUR ALONE ══════════════════════════════════════
//
// Charlie is colour blind. Every distinction carries at least two of: **shape, position, text.**
//   · a MATERIAL cause is a rectangle with a 2px border AND the word "material";
//   · a CONTRIBUTORY cause is a rectangle with a 1px dashed border AND the word "contributory";
//   · the root cause carries a "root" label, not a hue;
//   · every node carries its §2a NUMBER, so the diagram and the list name the same things the
//     same way — which is the whole reason the numbers had to be stable first.
// Colour is still there and still helps whoever can see it. It is never the only cue.
//
// ══ §3d — THE WIDTH IT HAS TO LIVE IN, REPORTED BEFORE IT WAS BUILT ═══════════════
//
// ⚠ COMPUTED FROM `panel-layout.ts`, NOT MEASURED — the browser renderer froze during this
// sprint and I did not get a live figure. `DEFAULT_LAYOUT.width.middle` is **0.3125** of the row
// and `MIN_WIDTH` is **0.15**. On a 1512 px window (~1480 px of row) that is **≈462 px by
// default and ≈222 px at the floor**, less ~40 px of padding: **≈420 px and ≈180 px of usable
// width.**
//
// A four-deep tree does not fit in 180 px. So rather than pretend:
//   · the diagram lays out at its natural width and **scrolls horizontally inside its own
//     container** — the panel never scrolls sideways;
//   · nodes wrap their text and the tree stays legible at 420 px, which is the default;
//   · below that the user scrolls, which is honest and is the behaviour every wide table in
//     this codebase already has.
// ⚠ If Charlie wants it comfortable at the minimum width, the answer is an expand control or
// opening it in THE RESEARCH panel — that is a design decision and is reported, not assumed.
// ─────────────────────────────────────────────────────────────────────────────

import type { CanonicalCause, CauseClassification } from '@/lib/lex/page1-config'

export interface MapNode extends CanonicalCause { depth: number; kids: MapNode[] }

/** Layout constants. Node width is what makes it legible at the default 420px column. */
const NODE_W = 190
const NODE_MIN_H = 48
const GAP_X = 18
const GAP_Y = 34
const PAD = 8
const CHAR_PER_LINE = 26

interface Placed {
  node: MapNode
  x: number
  y: number
  w: number
  h: number
  lines: string[]
}

/** Wrap on words so a node's text does not run past its box. */
function wrap(text: string, perLine = CHAR_PER_LINE, maxLines = 4): string[] {
  const words = text.split(/\s+/)
  const lines: string[] = []
  let cur = ''
  for (const w of words) {
    if ((cur + ' ' + w).trim().length > perLine) { if (cur) lines.push(cur); cur = w }
    else cur = (cur + ' ' + w).trim()
    if (lines.length === maxLines) break
  }
  if (cur && lines.length < maxLines) lines.push(cur)
  if (lines.length === maxLines) {
    const last = lines[maxLines - 1]
    if (last.length > perLine - 1) lines[maxLines - 1] = last.slice(0, perLine - 1) + '…'
  }
  return lines.length ? lines : ['(no text)']
}

/**
 * ⚠ A TIDY-ENOUGH TREE, NOT REINGOLD–TILFORD. Each subtree is laid out under its own children
 * and the parent is centred over them. At four levels and a dozen nodes that is indistinguishable
 * from the optimal layout and is thirty lines rather than three hundred.
 */
function layout(roots: MapNode[]): { placed: Placed[]; width: number; height: number } {
  const placed: Placed[] = []
  let cursorX = 0

  const place = (n: MapNode, depth: number): { cx: number } => {
    const lines = wrap(n.cause)
    const h = Math.max(NODE_MIN_H, 22 + lines.length * 13)
    const y = depth * (NODE_MIN_H + GAP_Y)

    if (!n.kids.length) {
      const x = cursorX
      cursorX += NODE_W + GAP_X
      placed.push({ node: n, x, y, w: NODE_W, h, lines })
      return { cx: x + NODE_W / 2 }
    }
    const centres = n.kids.map((k) => place(k, depth + 1).cx)
    const cx = (Math.min(...centres) + Math.max(...centres)) / 2
    placed.push({ node: n, x: cx - NODE_W / 2, y, w: NODE_W, h, lines })
    return { cx }
  }

  roots.forEach((r) => place(r, 0))
  const width = Math.max(NODE_W, ...placed.map((p) => p.x + p.w)) + PAD * 2
  const height = Math.max(...placed.map((p) => p.y + p.h)) + PAD * 2
  return { placed, width, height }
}

const SHAPE: Record<CauseClassification, { stroke: string; dash?: string; width: number; word: string }> = {
  // ⚠ TWO CUES EACH: a stroke WEIGHT and a WORD. Never the fill alone.
  MATERIAL: { stroke: '#b45309', width: 2, word: 'material' },
  CONTRIBUTORY: { stroke: '#71717a', width: 1, dash: '4 3', word: 'contributory' },
  UNASSESSED: { stroke: '#a1a1aa', width: 1, dash: '2 3', word: 'not yet classified' },
}

export default function CauseMap({ nodes }: { nodes: MapNode[] }) {
  const { placed, width, height } = layout(nodes)
  const byId = new Map(placed.map((p) => [p.node.id, p]))

  return (
    <figure className="m-0">
      {/* ⚠ §3d — THE DIAGRAM SCROLLS INSIDE ITS OWN BOX. The panel must never scroll sideways;
          a diagram wider than a narrow column is the one thing here that cannot be made to fit. */}
      <div className="overflow-x-auto rounded-lg border border-zinc-200 bg-white p-2">
        <svg
          width={width}
          height={height}
          viewBox={`0 0 ${width} ${height}`}
          role="img"
          aria-label="The causal chain. Each cause sits above the cause it follows from."
          style={{ maxWidth: 'none' }}
        >
          {/* the edges first, so nodes sit on top of them */}
          {placed.map((p) => {
            const parent = p.node.parentCauseId ? byId.get(p.node.parentCauseId) : null
            if (!parent) return null
            const x1 = parent.x + parent.w / 2
            const y1 = parent.y + parent.h
            const x2 = p.x + p.w / 2
            const y2 = p.y
            const mid = (y1 + y2) / 2
            return (
              <path
                key={`e-${p.node.id}`}
                d={`M ${x1} ${y1} V ${mid} H ${x2} V ${y2}`}
                fill="none"
                stroke="#a1a1aa"
                strokeWidth={1}
              />
            )
          })}

          {placed.map((p) => {
            const shape = SHAPE[p.node.classification] ?? SHAPE.UNASSESSED
            return (
              <g key={p.node.id}>
                <rect
                  x={p.x} y={p.y} width={p.w} height={p.h} rx={8}
                  fill="#ffffff"
                  stroke={shape.stroke}
                  strokeWidth={shape.width}
                  strokeDasharray={shape.dash}
                />
                {/* §2a — the number, so the diagram and the list name the same things. */}
                <text x={p.x + 8} y={p.y + 15} fontSize={11} fontWeight={700} fill="#18181b">
                  {p.node.number ?? '·'}
                </text>
                {/* §3c — the classification as a WORD, and the root marked in text. */}
                <text x={p.x + 24} y={p.y + 15} fontSize={9} fill="#52525b">
                  {shape.word}{p.node.isRootCause ? ' · root' : ''}
                </text>
                {p.lines.map((ln, i) => (
                  <text key={i} x={p.x + 8} y={p.y + 30 + i * 13} fontSize={10.5} fill="#27272a">
                    {ln}
                  </text>
                ))}
              </g>
            )
          })}
        </svg>
      </div>
      <figcaption className="mt-1.5 text-[11px] text-zinc-500">
        Each cause sits above the one it follows from. Border weight and the word on each box give
        the classification; the number is the same one the list uses.
      </figcaption>
    </figure>
  )
}
