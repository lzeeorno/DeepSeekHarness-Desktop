/** Read-only Research evidence and artifact view over the existing session ledger. */

import { useMemo } from 'react'
import type { ConversationNode } from '@deepseek-ai/dsh-client-runtime/client'
import type { ConvViewProps } from '@deepseek-ai/dsh-client-ui-conversation/client'
import type { InjectFace, PropsLocale } from '@deepseek-ai/dsh-client-ui-slots'
import css from './ResearchEvidenceView.module.css'

/** A file artifact grounded in one successful tool-result event. */
export interface ResearchArtifact {
  /** Durable event sequence that reported the file location. */
  readonly seq: number
  /** Full path supplied by the tool's presentation metadata. */
  readonly path: string
}

/** One completed or failed tool action from the loaded session event window. */
export interface ResearchAction {
  /** Durable result-event sequence. */
  readonly seq: number
  /** Tool name when its call head remains in the loaded window. */
  readonly name: string
  /** Whether the result event reports a tool failure. */
  readonly failed: boolean
}

/** Read-only summary derived from surfaced durable session events. */
export interface ResearchEvidence {
  /** Loaded turn count as supplied by the session timeline. */
  readonly turns: number
  /** Successful mutation artifacts in event order. */
  readonly artifacts: readonly ResearchArtifact[]
  /** Tool outcomes in event order. */
  readonly actions: readonly ResearchAction[]
  /** Recorded provider/model pairs in first-seen order. */
  readonly models: readonly string[]
  /** Landed compaction checkpoints in the loaded event window. */
  readonly compactions: number
}

/** Session-scoped behavior contributed by the workbench slot registration. */
export interface ResearchEvidenceViewInjected {
  /** Load one earlier durable event page for this session. */
  readonly loadOlder: () => Promise<boolean>
}

function pathsFromPresentation(value: unknown): readonly string[] {
  if (typeof value !== 'object' || value === null) return []
  const record = value as Record<string, unknown>
  const isDiff = record.card === 'diff'
  const isGenericEdit = record.card === 'generic' && record.kind === 'edit'
  if (!isDiff && !isGenericEdit) return []
  const candidates = [record.locations, record.diffs]
  const paths: string[] = []
  for (const candidate of candidates) {
    if (!Array.isArray(candidate)) continue
    for (const item of candidate) {
      if (typeof item !== 'object' || item === null) continue
      const path = (item as Record<string, unknown>).path
      if (typeof path === 'string' && path !== '') paths.push(path)
    }
  }
  return paths
}

/**
 * Project artifact, action, model, and compaction facts from surfaced session events.
 * @param nodes - Loaded durable conversation nodes in event order.
 * @param turns - Loaded turn count from the engine-owned timeline.
 * @returns A presentation-only evidence snapshot.
 */
export function deriveResearchEvidence(
  nodes: readonly ConversationNode[],
  turns: number,
): ResearchEvidence {
  const artifacts: ResearchArtifact[] = []
  const actions: ResearchAction[] = []
  const models: string[] = []
  const seenModels = new Set<string>()
  let compactions = 0

  for (const node of nodes) {
    switch (node.kind) {
      case 'assistant': {
        if (node.provenance === undefined) break
        const model = `${node.provenance.provider} / ${node.provenance.model}`
        if (!seenModels.has(model)) {
          seenModels.add(model)
          models.push(model)
        }
        break
      }
      case 'tool-result': {
        actions.push({
          seq: node.seq,
          name: node.call?.name ?? node.callId,
          failed: node.isError,
        })
        if (node.isError) break
        const paths = new Set([
          ...pathsFromPresentation(node.callView),
          ...pathsFromPresentation(node.resultView),
        ])
        for (const path of paths) artifacts.push({ seq: node.seq, path })
        break
      }
      case 'compaction':
        compactions++
        break
      default:
        break
    }
  }

  return { turns, artifacts, actions, models, compactions }
}

/** Full props for the session-bound Research evidence view. */
export type ResearchEvidenceViewProps =
  ConvViewProps & InjectFace<ResearchEvidenceViewInjected> & PropsLocale<'workbench'>

/**
 * Render the loaded session's evidence and artifacts without introducing a second store.
 * @param props - Session reader and the workbench dictionary.
 * @returns An event-derived research ledger view.
 */
export function ResearchEvidenceView({ useSession, loadOlder, t }: ResearchEvidenceViewProps) {
  const snapshot = useSession(value => value)
  const evidence = useMemo(
    () => deriveResearchEvidence(snapshot.nodes, snapshot.turnTimings.size),
    [snapshot],
  )
  const recentActions = evidence.actions.slice(-8).reverse()

  return (
    <div className={css.root} data-research-evidence>
      <header className={css.header}>
        <div>
          <h2 className={css.title}>{t('evidence.title')}</h2>
          <p className={css.description}>{t('evidence.description')}</p>
        </div>
        <span className={css.readOnly}>{t('evidence.readOnly')}</span>
      </header>
      {snapshot.hasMore && (
        <button
          className={css.loadOlder}
          disabled={snapshot.loadingOlder}
          type="button"
          onClick={() => { void loadOlder() }}
        >
          {t(snapshot.loadingOlder ? 'evidence.loadingOlder' : 'evidence.loadOlder')}
        </button>
      )}
      <dl className={css.stats}>
        <div><dt>{t('evidence.turns')}</dt><dd>{evidence.turns}</dd></div>
        <div><dt>{t('evidence.actions')}</dt><dd>{evidence.actions.length}</dd></div>
        <div><dt>{t('evidence.artifacts')}</dt><dd>{evidence.artifacts.length}</dd></div>
        <div><dt>{t('evidence.compactions')}</dt><dd>{evidence.compactions}</dd></div>
      </dl>
      <div className={css.columns}>
        <section className={css.section} aria-labelledby="research-artifacts">
          <h3 id="research-artifacts">{t('evidence.artifacts')}</h3>
          {evidence.artifacts.length === 0
            ? <p className={css.empty}>{t('evidence.artifacts.empty')}</p>
            : (
              <ol className={css.list}>
                {evidence.artifacts.map(({ path, seq }) => (
                  <li key={`${seq}:${path}`}><code>{path}</code><span>{t('evidence.event', { seq: String(seq) })}</span></li>
                ))}
              </ol>
            )}
        </section>
        <section className={css.section} aria-labelledby="research-actions">
          <h3 id="research-actions">{t('evidence.actions')}</h3>
          {recentActions.length === 0
            ? <p className={css.empty}>{t('evidence.actions.empty')}</p>
            : (
              <ol className={css.list}>
                {recentActions.map(({ seq, name, failed }) => (
                  <li key={seq} data-action-status={failed ? 'failed' : 'completed'}>
                    <code>{name}</code><span>{t(failed ? 'evidence.failed' : 'evidence.completed')} · {t('evidence.event', { seq: String(seq) })}</span>
                  </li>
                ))}
              </ol>
            )}
        </section>
        <section className={css.section} aria-labelledby="research-models">
          <h3 id="research-models">{t('evidence.models')}</h3>
          {evidence.models.length === 0
            ? <p className={css.empty}>{t('evidence.models.empty')}</p>
            : <ul className={css.modelList}>{evidence.models.map(model => <li key={model}>{model}</li>)}</ul>}
        </section>
      </div>
    </div>
  )
}
