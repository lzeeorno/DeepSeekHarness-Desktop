// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest'
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
import {
  createSnapshotStore, type SessionListState, type WorkspaceListState,
} from '@deepseek-ai/dsh-client-runtime/client'
import { bindSnapshotSelector } from '@deepseek-ai/dsh-client-web-react'
import {
  WorkbenchModeBadge, WorkbenchModeHero, WorkbenchModeRow,
  type WorkbenchModeBadgeProps, type WorkbenchModeInjected,
} from '../src/client/WorkbenchModeControls.tsx'
import type { WorkbenchMode } from '../src/workbench-settings.ts'
import type { WorkbenchModeSnapshot } from '../src/client/mode-controller.ts'

afterEach(cleanup)

const COPY: Record<string, string> = {
  title: 'Workbench focus',
  description: 'Changes the local UI focus only.',
  build: 'Build',
  research: 'Research',
  'build.aria': 'Switch to Build',
  'research.aria': 'Switch to Research',
  'badge.build': 'Build',
  'badge.research': 'Research',
  'badge.build.title': 'Build is active. Switch to Research and open the evidence ledger.',
  'badge.research.title': 'Research is active. Switch to Build and open Chat.',
}

function emptySessions() {
  const store = createSnapshotStore<SessionListState>(
    { ids: [], byId: {}, current: undefined, phase: 'ready', subagentsByParent: {}, jobsBySession: {}, currentAddress: undefined },
  )
  return bindSnapshotSelector(store)
}

function emptyWorkspaces() {
  const store = createSnapshotStore<WorkspaceListState>({
    items: [], archivedSessionIds: [], state: 'idle', phase: 'ready', error: null,
    baselinesReady: true, recentWorkspaceId: undefined,
  })
  return bindSnapshotSelector(store)
}

function mount(mode: WorkbenchMode = 'build') {
  const store = createSnapshotStore<WorkbenchModeSnapshot>({ mode, revision: 0 })
  const setMode = vi.fn()
  const selectView = vi.fn()
  const injected: WorkbenchModeInjected = { useMode: bindSnapshotSelector(store), setMode }
  const runtime = { useSessions: emptySessions(), useWorkspaces: emptyWorkspaces() }
  const sessionRuntime = {
    sessionId: 'session' as WorkbenchModeBadgeProps['sessionId'],
    useSession: (() => undefined) as WorkbenchModeBadgeProps['useSession'],
    useProjection: (() => undefined) as WorkbenchModeBadgeProps['useProjection'],
    useInput: (() => { throw new Error('unused') }) as WorkbenchModeBadgeProps['useInput'],
    inputActions: { setDraft: () => {}, submit: () => {} } as unknown as WorkbenchModeBadgeProps['inputActions'],
  }
  const locale = { t: (key: string) => COPY[key] ?? key }
  render(
    <>
      <WorkbenchModeRow {...runtime} {...locale} {...injected} />
      <WorkbenchModeHero {...runtime} {...locale} {...injected} />
      <WorkbenchModeBadge {...runtime} {...sessionRuntime} {...locale} {...injected} selectView={selectView} />
    </>,
  )
  return { store, setMode, selectView }
}

describe('workbench controls', () => {
  it('renders the current preference in every workbench control', () => {
    mount('research')
    expect(screen.getByText('Workbench focus')).toBeDefined()
    expect(screen.getAllByRole('button', { name: 'Switch to Research' })).toHaveLength(2)
    expect(screen.getAllByRole('button', { name: 'Switch to Research' })[0]?.getAttribute('aria-pressed')).toBe('true')
    expect(screen.getByRole('button', { name: 'Research is active. Switch to Build and open Chat.' })).toBeDefined()
  })

  it('routes clicks to the owner and reflects the next Host-backed snapshot', () => {
    const view = mount()
    fireEvent.click(screen.getByRole('button', { name: 'Build is active. Switch to Research and open the evidence ledger.' }))
    expect(view.setMode).toHaveBeenLastCalledWith('research')
    expect(view.selectView).toHaveBeenLastCalledWith('research')
    fireEvent.click(screen.getAllByRole('button', { name: 'Switch to Research' })[0]!)
    expect(view.setMode).toHaveBeenCalledWith('research')
    expect(screen.getAllByRole('button', { name: 'Switch to Build' })[0]?.getAttribute('aria-pressed')).toBe('true')
    act(() => {
      view.store.update((snapshot) => {
        snapshot.mode = 'research'
        snapshot.revision += 1
      })
    })
    expect(screen.getAllByRole('button', { name: 'Switch to Research' })[0]?.getAttribute('aria-pressed')).toBe('true')
    fireEvent.click(screen.getByRole('button', { name: 'Research is active. Switch to Build and open Chat.' }))
    expect(view.setMode).toHaveBeenLastCalledWith('build')
    expect(view.selectView).toHaveBeenLastCalledWith('chat')
  })
})
