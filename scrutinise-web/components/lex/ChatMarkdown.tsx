// ─────────────────────────────────────────────────────────────────────────────
// 235 (CCh 22 Oct (7)) — LEX'S CHAT REPLIES RENDER AS MARKDOWN: headings, bold, lists, paragraphs, tables.
// One parser for the chat and the printed documents: lib/documents/markdown.ts (it imports only types, so nothing server-side reaches this
// client bundle — CLAUDE.md §28). Only Lex's messages come here; the user's own words stay exactly as typed.
// ⚠ A link is drawn only for http(s), a site path or an anchor. Anything else (javascript:, data:) stays as its label, unlinked.
// ─────────────────────────────────────────────────────────────────────────────

import { markdownToBlocks } from '@/lib/documents/markdown'
import type { ReactNode } from 'react'
import type { Block, Run } from '@/lib/documents/model'

const SAFE_HREF = /^(https?:\/\/|\/(?!\/)|#)/i

function Runs({ runs }: { runs: Run[] }) {
  return (
    <>
      {runs.map((r, i) => {
        let node: ReactNode = r.text
        if (r.italic) node = <em>{node}</em>
        if (r.bold) node = <strong className="font-semibold">{node}</strong>
        if (r.href && SAFE_HREF.test(r.href)) node = <a href={r.href} target="_blank" rel="noopener noreferrer" className="underline text-blue-700">{node}</a>
        return <span key={i}>{node}</span>
      })}
    </>
  )
}

function BlockView({ b }: { b: Block }) {
  switch (b.kind) {
    case 'heading':
      return <p data-md="heading" className="font-semibold text-zinc-900"><Runs runs={b.runs} /></p>
    case 'paragraph':
      return <p data-md="paragraph"><Runs runs={b.runs} /></p>
    case 'bullets': {
      const items = b.items.map((it, i) => <li key={i}><Runs runs={it} /></li>)
      return b.ordered
        ? <ol data-md="list" className="list-decimal pl-5 space-y-0.5">{items}</ol>
        : <ul data-md="list" className="list-disc pl-5 space-y-0.5">{items}</ul>
    }
    case 'table':
      return (
        <div className="overflow-x-auto">
          <table data-md="table" className="text-xs border-collapse">
            <thead><tr>{b.header.map((h, i) => <th key={i} className="border border-zinc-300 bg-zinc-200 px-2 py-1 text-left font-semibold"><Runs runs={h} /></th>)}</tr></thead>
            <tbody>{b.rows.map((row, i) => <tr key={i}>{row.map((c, j) => <td key={j} className="border border-zinc-300 px-2 py-1 align-top"><Runs runs={c} /></td>)}</tr>)}</tbody>
          </table>
        </div>
      )
    case 'rule':
      return <hr className="border-zinc-300" />
    case 'section':
      return <p className="font-semibold">{b.title}</p>
    case 'note':
      return <p className="italic">{b.text}</p>
    default:
      return null
  }
}

export default function ChatMarkdown({ text }: { text: string }) {
  return (
    <div data-md="reply" className="space-y-2">
      {markdownToBlocks(text).map((b, i) => <BlockView key={i} b={b} />)}
    </div>
  )
}
