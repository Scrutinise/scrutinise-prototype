// ─────────────────────────────────────────────────────────────────────────────
// THE LAW THIS IDEA TOUCHES — the idea page's panel over `ideaLawSet()` (GRAPH 7 §4).
//
// ⚠ SEVEN GROUPS, RENDERED SEPARATELY (constraint d), never one "related legislation" list. ⚠ Amends and repeals
// carry GRAPH_6's per-type counts WITH the change-the-words split, never a bare count. ⚠ The idea's own `modifies`
// group shows no corpus figure at all (constraint e). ⚠ A Bill says it is not law (constraint f).
// ⚠ Imports only the pure module (CLAUDE.md §28): this renders inside a client component.
// ⚠ Every state is a WORD, never only a colour (CLAUDE.md §21).
// ─────────────────────────────────────────────────────────────────────────────

import {
  LAW_RELATIONS, RELATION_GROUPS, RESOLUTION_WORDS, BILL_LABEL,
  type IdeaLawSet, type IdeaLawRow, type LawEffectsSummary,
} from '@/lib/lex/idea-law-pure'
import { sourceWords, alsoNamedAt, unansweredAmendment, provisionWords } from '@/lib/lex/law-panel-words'

function targetHref(r: IdeaLawRow): string | null {
  if (r.targetKind === 'bill') return `https://bills.parliament.uk/bills/${r.docUri.slice('bill/'.length)}`
  if (r.targetKind === 'document') return null
  return `https://www.legislation.gov.uk/${r.docUri}${r.provisionPath ? `/${r.provisionPath}` : ''}`
}

const provisionLabel = provisionWords

function EffectsLine({ fx }: { fx: LawEffectsSummary }) {
  if (fx.failed) return <p className="mt-1 text-xs">⚠ {fx.failed}</p>
  return (
    <div className="mt-2 text-xs text-muted-foreground" data-law-effects>
      <p className="font-medium text-foreground">Changes already made to it, from the official record:</p>
      <ul className="mt-1 space-y-0.5">
        {fx.perType.map((t) => (
          <li key={t.edgeType} data-effect-type={t.edgeType}>
            {t.edgeType}: {t.total.toLocaleString()} recorded
            {t.total > 0 && <> — {t.textual.toLocaleString()} change the words · {t.notTextual.toLocaleString()} do not · {t.unclassified.toLocaleString()} unclassified</>}
          </li>
        ))}
      </ul>
      <p className="mt-1">{fx.caveat}</p>
    </div>
  )
}

function LawRow({ r, all }: { r: IdeaLawRow; all: IdeaLawRow[] }) {
  const also = alsoNamedAt(all, r)
  const gap = unansweredAmendment(all, r)
  const href = targetHref(r)
  const name = r.resolution.title ?? r.docUri
  return (
    <li className="rounded-md border p-3" data-law-row={r.id}>
      <div className="text-sm font-medium">
        {href ? <a className="underline underline-offset-2" href={href} target="_blank" rel="noreferrer">{name}</a> : name}
        {r.provisionPath && <span> — {provisionLabel(r.provisionPath)}</span>}
      </div>
      <div className="mt-0.5 text-xs text-muted-foreground">
        {r.docUri}{r.provisionPath ? ` · ${r.provisionPath}` : ''}
        {r.targetKind === 'bill' && <> · <strong className="text-foreground">{BILL_LABEL}</strong></>}
        {r.targetKind === 'document' && <> · a document, not law</>}
      </div>
      {r.sources.length > 1 && (
        <p className="mt-1 text-xs font-medium" data-law-sources={r.sources.length}>Named {r.sources.length} times — shown once, with each source:</p>
      )}
      <ul className="mt-1 space-y-1">
        {r.sources.map((s) => (
          <li key={s.id} data-law-source={s.source} data-law-source-row={s.id}>
            <div className="text-xs">
              {s.action ? <>For action {s.action.number ?? '—'}: {s.action.title}</> : <>For the idea as a whole</>}
            </div>
            {s.note && <p className="text-sm">{s.note}</p>}
            <p className="text-xs text-muted-foreground">
              {/* 26-V1b 6a — the action's number and the version, never the internal id */}
              {sourceWords(s)}, against the law as at {s.asAt}.
            </p>
          </li>
        ))}
      </ul>
      {/* 26-V1b 6b — the same Act named elsewhere (another provision or another relation): said here, so the reader need not hunt */}
      {also.length > 0 && <p className="mt-1 text-xs" data-law-also>Also named at: {also.join(' · ')}.</p>}
      {/* 26-V1b 6c — the stated position and the drafted one, side by side */}
      {gap && <p className="mt-1 text-xs font-semibold" data-law-gap>Question: {gap}</p>}
      {r.resolution.state !== 'held' && (
        <p className="mt-1 text-xs font-medium" data-law-state={r.resolution.state}>⚠ {RESOLUTION_WORDS[r.resolution.state]} ({r.resolution.reason})</p>
      )}
      {r.resolution.provision?.state === 'unaddressable' && (
        <p className="mt-1 text-xs text-muted-foreground">{r.resolution.provision.reason}</p>
      )}
      {r.effects && <EffectsLine fx={r.effects} />}
    </li>
  )
}

export default function IdeaLawPanel({ set, error }: { set: IdeaLawSet | null; error: string | null }) {
  return (
    <section className="mt-8 rounded-lg border p-4" data-idea-law-panel>
      <h2 className="text-base font-semibold">The law this idea touches</h2>
      {error ? (
        <p className="mt-2 text-sm" data-idea-law-failed>⚠ We could not read which laws this idea concerns, so this is not a statement that it concerns none: {error}</p>
      ) : !set || set.rows.length === 0 ? (
        <p className="mt-2 text-sm text-muted-foreground" data-idea-law-empty>No law has been attached to this idea yet.</p>
      ) : (
        <>
          <p className="mt-2 text-sm text-muted-foreground">
            {set.rows.length} attached: {set.counts.held} held in our corpus
            {set.counts['named-not-held'] > 0 && <>, {set.counts['named-not-held']} named but not held</>}
            {set.counts['no-such-id'] > 0 && <>, {set.counts['no-such-id']} with no such id</>}
            {set.counts['lookup-failed'] > 0 && <>, {set.counts['lookup-failed']} we could not check</>}.
            {set.freshness.asserted_as_at && <> Attached against the law as at {set.freshness.asserted_as_at}; {set.freshness.changed_since.length} of these have a recorded change coming into force since.</>}
          </p>
          <p className="mt-1 text-xs text-muted-foreground">{set.freshness.basis}.</p>
          {LAW_RELATIONS.filter((rel) => set.grouped[rel].length > 0).map((rel) => (
            <div key={rel} className="mt-5" data-law-group={rel}>
              <h3 className="text-sm font-semibold">{RELATION_GROUPS[rel].heading} <span className="font-normal text-muted-foreground">({set.grouped[rel].length})</span></h3>
              <p className="text-xs text-muted-foreground">{RELATION_GROUPS[rel].what}. Shown: {RELATION_GROUPS[rel].shows}.</p>
              <ul className="mt-2 space-y-2">{set.grouped[rel].map((r) => <LawRow key={r.id} r={r} all={set.rows} />)}</ul>
            </div>
          ))}
          {LAW_RELATIONS.some((rel) => set.grouped[rel].length === 0) && (
            <p className="mt-5 text-xs text-muted-foreground">
              Nothing attached as: {LAW_RELATIONS.filter((rel) => set.grouped[rel].length === 0).map((rel) => RELATION_GROUPS[rel].heading.toLowerCase()).join(', ')}.
            </p>
          )}
          {set.inconsistent.length > 0 && (
            <p className="mt-3 text-xs font-medium" data-idea-law-inconsistent>⚠ {set.inconsistent.length} attachment(s) name an action that belongs to another idea, and are not shown above.</p>
          )}
        </>
      )}
    </section>
  )
}
