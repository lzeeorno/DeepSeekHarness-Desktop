// @vitest-environment jsdom

import { afterEach, describe, expect, it, vi } from 'vitest'
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
import {
  createSnapshotStore, EMPTY_CHAT_SNAPSHOT, EMPTY_CONVERSATION_VIEWS,
  type ContextMessageNode, type ConversationNode, type ConversationSnapshot, type SessionId,
} from '@deepseek-ai/dsh-client-runtime/client'
import { bindSnapshotSelector } from '@deepseek-ai/dsh-client-web-react'
import { makeTranslate } from '@deepseek-ai/dsh-client-test-runtime'
import { zh as commonZh } from '@deepseek-ai/dsh-client-locale/src/locales/zh.ts'
import { zh } from '../src/client/locales.ts'
import {
  ContextLedgerView, deriveContextLedger, type ContextLedgerViewProps,
} from '../src/client/chat/ContextLedgerView.tsx'

afterEach(cleanup)

const SID = 'context-ledger' as SessionId

const EARLIER: ContextMessageNode = {
  kind: 'context', seq: 1, time: 1_000,
  content: [{ type: 'text', text: 'Use the repository instructions.' }] as never,
  source: {
    kind: 'agent-instructions', form: 'instructions',
    changes: [{ action: 'set', path: 'AGENTS.md' }],
  },
  provenance: { role: 'inject', label: 'AGENTS.md' }, form: 'instructions',
}

const LATER: ContextMessageNode = {
  kind: 'context', seq: 3, time: 3_000,
  content: [{ type: 'text', text: 'A new skill catalog is available.' }] as never,
  source: { kind: 'plugin', plugin: 'skill', form: 'notice', summary: 'Skill catalog updated' },
  provenance: { role: 'inject', label: 'skill' }, form: 'notice',
}

const NODES = [
  EARLIER,
  {
    kind: 'compaction', seq: 2, time: 2_000, summary: 'Retain the task.', summaryEventSeq: 2,
    shadowedItemCount: 1, shadowedTokenCount: 100,
  },
  LATER,
] as readonly ConversationNode[]

function snapshot(nodes: readonly ConversationNode[], options: Partial<ConversationSnapshot> = {}): ConversationSnapshot {
  return {
    sessionId: SID,
    views: EMPTY_CONVERSATION_VIEWS,
    chat: EMPTY_CHAT_SNAPSHOT,
    nodes,
    turnTimings: new Map(),
    turnEnds: new Map(),
    partial: null,
    runningCalls: [],
    pending: [],
    queue: [],
    running: false,
    subagent: null,
    composerPhase: 'active',
    removed: false,
    openState: 'open',
    openError: null,
    hasMore: false,
    loadingOlder: false,
    promptError: null,
    blank: false,
    lastAgentError: null,
    ...options,
  }
}

function props(store: ReturnType<typeof createSnapshotStore<ConversationSnapshot>>, loadOlder = vi.fn()): ContextLedgerViewProps {
  return {
    sessionId: SID,
    useSession: bindSnapshotSelector(store),
    useSessions: (() => undefined) as never,
    useWorkspaces: (() => undefined) as never,
    useProjection: (() => undefined) as never,
    loadOlder,
    t: makeTranslate(zh, commonZh),
  } as ContextLedgerViewProps
}

describe('ContextLedgerView', () => {
  it('separates injected context around the latest loaded compaction without discarding either side', () => {
    expect(deriveContextLedger(NODES)).toEqual({
      retained: [LATER],
      earlier: [EARLIER],
      latestCompactionSeq: 2,
    })
    expect(deriveContextLedger([EARLIER])).toEqual({
      retained: [EARLIER],
      earlier: [],
      latestCompactionSeq: null,
    })
  })

  it('renders established context rows, records their event ids, and requests normal history paging', () => {
    const store = createSnapshotStore(snapshot(NODES, { hasMore: true }))
    const loadOlder = vi.fn()
    render(<ContextLedgerView {...props(store, loadOlder)} />)

    expect(screen.getByText('上下文账本')).toBeDefined()
    expect(screen.getByText('最近一次已加载压缩之后')).toBeDefined()
    expect(screen.getByText('最近一次已加载压缩之前')).toBeDefined()
    expect(screen.getByText('事件 1')).toBeDefined()
    expect(screen.getByText('事件 3')).toBeDefined()
    expect(screen.getByText('AGENTS.md')).toBeDefined()
    expect(screen.getByText('skill')).toBeDefined()
    fireEvent.click(screen.getByRole('button', { name: '加载更早' }))
    expect(loadOlder).toHaveBeenCalledOnce()

    act(() => {
      store.update((draft) => { draft.loadingOlder = true })
    })
    expect(screen.getByRole('button', { name: '载入历史…' }).hasAttribute('disabled')).toBe(true)
  })

  it('states when the loaded window contains no durable context injection', () => {
    const store = createSnapshotStore(snapshot([]))
    render(<ContextLedgerView {...props(store)} />)

    expect(screen.getByText('该事件窗口中没有后续上下文注入。')).toBeDefined()
    expect(screen.queryByText('最近一次已加载压缩之前')).toBeNull()
    expect(screen.queryByRole('button', { name: '加载更早' })).toBeNull()
  })
})
