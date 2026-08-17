/** Read-only, compaction-aware ledger for durable model-facing context injections. */

import { useMemo } from 'react'
import type { ContextMessageNode, ConversationNode } from '@deepseek-ai/dsh-client-runtime/client'
import type { InjectFace, PropsLocale } from '@deepseek-ai/dsh-client-ui-slots'
import type { ConvViewProps } from '../contract/slots.ts'
import { ContextInjectionRow } from './ContextInjectionRow.tsx'
import css from './ContextLedgerView.module.css'

/** Projection of loaded context injection events around the latest loaded compaction. */
export interface ContextLedger {
  /** Context events whose sequence follows the latest loaded compaction marker. */
  readonly retained: readonly ContextMessageNode[]
  /** Context events preceding the latest loaded compaction marker. */
  readonly earlier: readonly ContextMessageNode[]
  /** Latest loaded compaction event sequence, or null when none is loaded. */
  readonly latestCompactionSeq: number | null
}

/** Session verb supplied by the conversation view registration. */
export interface ContextLedgerViewInjected {
  /** Request the next earlier durable event page for this session. */
  readonly loadOlder: () => void
}

/**
 * Group durable context injections by the most recent compaction marker in the loaded event window.
 * @param nodes - Loaded conversation nodes in durable event order.
 * @returns Context events separated into post-compaction and earlier history.
 */
export function deriveContextLedger(nodes: readonly ConversationNode[]): ContextLedger {
  let latestCompactionSeq: number | null = null
  for (const node of nodes) {
    if (node.kind === 'compaction') latestCompactionSeq = node.seq
  }
  const injections = nodes.filter((node): node is ContextMessageNode => node.kind === 'context')
  if (latestCompactionSeq === null) return { retained: injections, earlier: [], latestCompactionSeq }
  const retained: ContextMessageNode[] = []
  const earlier: ContextMessageNode[] = []
  for (const node of injections) {
    if (node.seq > latestCompactionSeq) retained.push(node)
    else earlier.push(node)
  }
  return { retained, earlier, latestCompactionSeq }
}

/** Full props of the session-local Context ledger view. */
export type ContextLedgerViewProps =
  ConvViewProps & InjectFace<ContextLedgerViewInjected> & PropsLocale<'conversation'>

/**
 * Render loaded model-facing context events without reconstructing a provider request.
 * @param props - Session reader, paging verb, and conversation dictionary.
 * @returns Context grouped around the latest loaded compaction checkpoint.
 */
export function ContextLedgerView({ useSession, loadOlder, t }: ContextLedgerViewProps) {
  const snapshot = useSession(value => value)
  const ledger = useMemo(() => deriveContextLedger(snapshot.nodes), [snapshot])

  return (
    <div className={css.root} data-context-ledger>
      <header className={css.header}>
        <div>
          <h2 className={css.title}>{t('context.ledger.title')}</h2>
          <p className={css.description}>{t('context.ledger.description')}</p>
        </div>
        <span className={css.readOnly}>{t('context.ledger.readOnly')}</span>
      </header>
      {snapshot.hasMore && (
        <button
          className={css.loadOlder}
          disabled={snapshot.loadingOlder}
          type="button"
          onClick={() => { loadOlder() }}
        >
          {t(snapshot.loadingOlder ? 'chat.loadingHistory' : 'chat.loadOlder')}
        </button>
      )}
      <section className={css.section} aria-labelledby="context-ledger-retained">
        <h3 id="context-ledger-retained">{t('context.ledger.retained')}</h3>
        {ledger.retained.length === 0
          ? <p className={css.empty}>{t('context.ledger.retained.empty')}</p>
          : <ContextRows nodes={ledger.retained} t={t} />}
      </section>
      {ledger.latestCompactionSeq !== null && (
        <section className={css.section} aria-labelledby="context-ledger-earlier">
          <h3 id="context-ledger-earlier">{t('context.ledger.earlier')}</h3>
          {ledger.earlier.length === 0
            ? <p className={css.empty}>{t('context.ledger.earlier.empty')}</p>
            : <ContextRows nodes={ledger.earlier} t={t} />}
        </section>
      )}
    </div>
  )
}

/** Render event-labelled context rows through the chat domain's established source/body presentation. */
function ContextRows({ nodes, t }: {
  nodes: readonly ContextMessageNode[]
  t: ContextLedgerViewProps['t']
}) {
  return (
    <ol className={css.list}>
      {nodes.map(node => (
        <li key={node.seq} className={css.item}>
          <span className={css.event}>{t('context.ledger.event', { seq: String(node.seq) })}</span>
          <ContextInjectionRow
            content={node.content}
            source={node.source}
            provenance={node.provenance}
            form={node.form}
            t={t}
          />
        </li>
      ))}
    </ol>
  )
}
