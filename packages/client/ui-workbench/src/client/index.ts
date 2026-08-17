/** Browser plugin for the durable Build/Research workbench lens. */

import type { ClientContext, SessionId } from '@deepseek-ai/dsh-client-runtime/client'
import { bindSnapshotSelector } from '@deepseek-ai/dsh-client-web-react'
import type {} from '@deepseek-ai/dsh-client-locale/client'
import type {} from '@deepseek-ai/dsh-client-ui-conversation/client'
import type {} from '@deepseek-ai/dsh-client-ui-settings/client'
import type {} from '@deepseek-ai/dsh-client-ui-slots'
import { WORKBENCH_SETTINGS_NAMESPACE, type WorkbenchSettings } from '../workbench-settings.ts'
import {
  WorkbenchModeBadge, WorkbenchModeHero, WorkbenchModeRow,
  type WorkbenchModeInjected,
} from './WorkbenchModeControls.tsx'
import { ResearchEvidenceView, type ResearchEvidenceViewInjected } from './ResearchEvidenceView.tsx'
import { en, zh, type WorkbenchKey } from './locales.ts'
import { WorkbenchModeController } from './mode-controller.ts'

export {
  WorkbenchModeBadge, WorkbenchModeHero, WorkbenchModeRow,
  type WorkbenchModeBadgeProps, type WorkbenchModeHeroProps, type WorkbenchModeInjected,
  type WorkbenchModeRowProps,
} from './WorkbenchModeControls.tsx'
export {
  deriveResearchEvidence, ResearchEvidenceView,
  type ResearchAction, type ResearchArtifact, type ResearchEvidence, type ResearchEvidenceViewInjected,
  type ResearchEvidenceViewProps,
} from './ResearchEvidenceView.tsx'
export { WorkbenchModeController, type WorkbenchModeSnapshot } from './mode-controller.ts'
export { type WorkbenchKey } from './locales.ts'
export {
  DEFAULT_WORKBENCH_MODE, WORKBENCH_MODE_FIELD, WORKBENCH_MODES, WORKBENCH_SETTINGS_NAMESPACE,
  type WorkbenchMode, type WorkbenchSettings,
} from '../workbench-settings.ts'

/** Dictionary namespace for the workbench controls. */
export const WORKBENCH_LOCALE_NAMESPACE = 'workbench'

declare module '@deepseek-ai/dsh-client-ui-slots' {
  interface LocaleNamespaceMap {
    /** Build/Research workbench controls and transparent limitation copy. */
    workbench: WorkbenchKey
  }
}

/** Required services for settings, four slot registrations, and localization. */
export const inject = ['slots', 'locale', 'connection', 'remote', 'settingsScope', 'sessions']

/**
 * Register the settings-backed workbench controls at their existing Web Client extension points.
 * @param ctx - browser client context.
 */
export function apply(ctx: ClientContext): void {
  const host = ctx.settingsScope.bind<WorkbenchSettings>({ namespace: WORKBENCH_SETTINGS_NAMESPACE })
  const controller = new WorkbenchModeController(host)
  ctx.effect(() => () => { controller.dispose() }, 'ui-workbench: settings subscription')
  ctx.effect(() => ctx.locale.register(WORKBENCH_LOCALE_NAMESPACE, { zh, en }), 'ui-workbench: dictionaries')

  const injected = (): WorkbenchModeInjected => ({
    useMode: bindSnapshotSelector(controller.store),
    setMode: (mode) => { controller.setMode(mode) },
  })

  ctx.slots.inject('settings.general.item', () => ctx.slots.register({
    name: 'settings.general.item',
    id: 'workbench',
    order: 20,
    locale: WORKBENCH_LOCALE_NAMESPACE,
    inject: injected,
  }, WorkbenchModeRow))
  ctx.slots.inject('conversation.hero.workbench', () => ctx.slots.register({
    name: 'conversation.hero.workbench',
    locale: WORKBENCH_LOCALE_NAMESPACE,
    inject: injected,
  }, WorkbenchModeHero))
  ctx.slots.inject('conversation.session.header.actions', () => ctx.slots.register({
    name: 'conversation.session.header.actions',
    id: 'workbench',
    order: -5,
    locale: WORKBENCH_LOCALE_NAMESPACE,
    inject: injected,
  }, WorkbenchModeBadge))
  ctx.slots.inject('conversation.view', () => ctx.slots.register({
    name: 'conversation.view',
    id: 'research',
    order: 20,
    locale: WORKBENCH_LOCALE_NAMESPACE,
    label: () => ctx.locale.bind(WORKBENCH_LOCALE_NAMESPACE)('view.research'),
    inject: (sessionId: SessionId): ResearchEvidenceViewInjected => {
      const session = ctx.sessions.binding(sessionId)?.session
      if (session === undefined) {
        throw new Error(`ui-workbench: session "${sessionId}" is unavailable`)
      }
      return {
        loadOlder: async () => {
          const before = session.getSnapshot().nodes
          await session.loadOlder()
          return session.getSnapshot().nodes !== before
        },
      }
    },
  }, ResearchEvidenceView))
}
