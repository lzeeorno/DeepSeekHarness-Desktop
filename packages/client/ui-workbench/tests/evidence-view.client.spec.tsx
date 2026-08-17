// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { bindSnapshotSelector } from '@deepseek-ai/dsh-client-web-react'
import { createSnapshotStore, type ConversationNode, type ConversationSnapshot } from '@deepseek-ai/dsh-client-runtime/client'
import {
  deriveResearchEvidence, ResearchEvidenceView, type ResearchEvidenceViewProps,
} from '../src/client/ResearchEvidenceView.tsx'

afterEach(cleanup)

const NODES = [
  {
    kind: 'assistant', seq: 1, time: 1, turn: 1, step: 1, blocks: [],
    provenance: { provider: 'deepseek', model: 'deepseek-chat' },
  },
  {
    kind: 'tool-result', seq: 2, time: 2, callId: 'write',
    call: { name: 'write', argsRaw: '{}' }, callTime: 1, content: [], isError: false,
    callView: null, resultView: { card: 'diff', diffs: [{ path: 'results/summary.md' }] }, subCalls: [],
  },
  {
    kind: 'tool-result', seq: 3, time: 3, callId: 'edit',
    call: { name: 'edit', argsRaw: '{}' }, callTime: 2, content: [], isError: false,
    callView: { card: 'generic', kind: 'edit', locations: [{ path: 'notes/method.md' }] }, resultView: null, subCalls: [],
  },
  {
    kind: 'tool-result', seq: 4, time: 4, callId: 'bash',
    call: { name: 'bash', argsRaw: '{}' }, callTime: 3, content: [], isError: true,
    callView: null, resultView: null, subCalls: [],
  },
  { kind: 'compaction', seq: 5, time: 5, summary: null, summaryEventSeq: null, shadowedItemCount: null, shadowedTokenCount: null },
] as unknown as readonly ConversationNode[]

const COPY: Record<string, string> = {
  'evidence.title': 'Evidence & artifacts',
  'evidence.description': 'Projected directly from loaded events in this session.',
  'evidence.readOnly': 'Read-only event ledger',
  'evidence.loadOlder': 'Load earlier events',
  'evidence.loadingOlder': 'Loading earlier events…',
  'evidence.turns': 'Turns',
  'evidence.actions': 'Tool actions',
  'evidence.artifacts': 'Artifacts',
  'evidence.compactions': 'Compactions',
  'evidence.models': 'Recorded models',
  'evidence.artifacts.empty': 'No file artifacts in the loaded events.',
  'evidence.actions.empty': 'No tool actions in the loaded events.',
  'evidence.models.empty': 'No model requests in the loaded events.',
  'evidence.event': 'Event {seq}',
  'evidence.completed': 'Completed',
  'evidence.failed': 'Failed',
}

describe('ResearchEvidenceView', () => {
  it('derives files only from successful mutation presentation facts', () => {
    expect(deriveResearchEvidence(NODES, 1)).toEqual({
      turns: 1,
      artifacts: [
        { seq: 2, path: 'results/summary.md' },
        { seq: 3, path: 'notes/method.md' },
      ],
      actions: [
        { seq: 2, name: 'write', failed: false },
        { seq: 3, name: 'edit', failed: false },
        { seq: 4, name: 'bash', failed: true },
      ],
      models: ['deepseek / deepseek-chat'],
      compactions: 1,
    })
  })

  it('renders the event-derived artifact, action, and model ledger', () => {
    const snapshot = {
      nodes: NODES,
      turnTimings: new Map([[1, { startTime: 1 }]]),
      hasMore: true,
      loadingOlder: false,
    } as unknown as ConversationSnapshot
    const useSession = bindSnapshotSelector(createSnapshotStore(snapshot))
    const loadOlder = vi.fn(() => Promise.resolve(true))
    const props = {
      useSession,
      loadOlder,
      t: (key: string, values?: Record<string, string>) =>
        (COPY[key] ?? key).replace('{seq}', values?.seq ?? '{seq}'),
    } as unknown as ResearchEvidenceViewProps

    render(<ResearchEvidenceView {...props} />)

    expect(screen.getByText('Evidence & artifacts')).toBeDefined()
    expect(screen.getByText('results/summary.md')).toBeDefined()
    expect(screen.getByText('notes/method.md')).toBeDefined()
    expect(screen.getByText('deepseek / deepseek-chat')).toBeDefined()
    expect(screen.getByText('bash').parentElement?.getAttribute('data-action-status')).toBe('failed')
    fireEvent.click(screen.getByRole('button', { name: 'Load earlier events' }))
    expect(loadOlder).toHaveBeenCalledOnce()
  })
})
