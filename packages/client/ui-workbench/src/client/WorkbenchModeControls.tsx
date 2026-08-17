/** Build/Research lens controls rendered in settings, the empty-session hero, and session chrome. */

import { IconCodeOutline16, IconSearchOutline16 } from '@deepseek-ai/dsh-client-ui-primitives'
import type { PropsLocale, PropsRuntime, SnapshotSelectorHook } from '@deepseek-ai/dsh-client-ui-slots'
import type {} from '@deepseek-ai/dsh-client-ui-conversation/client'
import type {} from '@deepseek-ai/dsh-client-ui-settings/client'
import type { WorkbenchMode } from '../workbench-settings.ts'
import type { WorkbenchKey } from './locales.ts'
import type { WorkbenchModeSnapshot } from './mode-controller.ts'
import css from './WorkbenchModeControls.module.css'

/** Injected state and action shared by every workbench lens control. */
export interface WorkbenchModeInjected {
  /** Stable selector hook over the current workbench lens. */
  useMode: SnapshotSelectorHook<WorkbenchModeSnapshot>
  /** Persist a user-selected UI lens. */
  setMode: (mode: WorkbenchMode) => void
}

type ModeOption = {
  mode: WorkbenchMode
  label: WorkbenchKey
  aria: WorkbenchKey
  Icon: typeof IconCodeOutline16
}

const OPTIONS: readonly ModeOption[] = [
  { mode: 'build', label: 'build', aria: 'build.aria', Icon: IconCodeOutline16 },
  { mode: 'research', label: 'research', aria: 'research.aria', Icon: IconSearchOutline16 },
]

/** Full props for the durable General-settings preference row. */
export type WorkbenchModeRowProps =
  PropsRuntime<'settings.general.item'> & PropsLocale<'workbench'> & WorkbenchModeInjected

/**
 * Render the full Build/Research settings row.
 * @param props - settings runtime, localized copy, and mode controller face.
 * @returns the local-workbench preference row.
 */
export function WorkbenchModeRow({ useMode, setMode, t }: WorkbenchModeRowProps) {
  const mode = useMode(snapshot => snapshot.mode)
  return (
    <section className={css.settingsRow} aria-labelledby="workbench-focus-title">
      <div className={css.copy}>
        <div id="workbench-focus-title" className={css.title}>{t('title')}</div>
        <div className={css.description}>{t('description')}</div>
      </div>
      <div className={css.settingsOptions} role="group" aria-label={t('title')}>
        {OPTIONS.map(({ mode: option, label, aria, Icon }) => (
          <button
            key={option}
            type="button"
            className={option === mode ? `${css.settingsOption} ${css.selected}` : css.settingsOption}
            aria-pressed={option === mode}
            aria-label={t(aria)}
            onClick={() => { setMode(option) }}
          >
            <Icon size={16} />
            {t(label)}
          </button>
        ))}
      </div>
    </section>
  )
}

/** Full props for the empty-session workbench lens switcher. */
export type WorkbenchModeHeroProps =
  PropsRuntime<'conversation.hero.workbench'> & PropsLocale<'workbench'> & WorkbenchModeInjected

/**
 * Render the compact, directly selectable lens switcher before the first prompt.
 * @param props - hero runtime, localized copy, and mode controller face.
 * @returns the Build/Research segment pair.
 */
export function WorkbenchModeHero({ useMode, setMode, t }: WorkbenchModeHeroProps) {
  const mode = useMode(snapshot => snapshot.mode)
  return (
    <div className={css.hero} role="group" aria-label={t('title')}>
      {OPTIONS.map(({ mode: option, label, aria, Icon }) => (
        <button
          key={option}
          type="button"
          className={option === mode ? `${css.heroOption} ${css.selected}` : css.heroOption}
          aria-pressed={option === mode}
          aria-label={t(aria)}
          onClick={() => { setMode(option) }}
        >
          <Icon size={14} />
          {t(label)}
        </button>
      ))}
    </div>
  )
}

/** Full props for the active-session lens indicator and quick switch. */
export type WorkbenchModeBadgeProps =
  PropsRuntime<'conversation.session.header.actions'> & PropsLocale<'workbench'> & WorkbenchModeInjected

/**
 * Render the current lens in active session chrome and toggle to the other lens.
 * @param props - session runtime, localized copy, mode controller, and view selector.
 * @returns one compact Build or Research button.
 */
export function WorkbenchModeBadge({ useMode, setMode, selectView, t }: WorkbenchModeBadgeProps) {
  const mode = useMode(snapshot => snapshot.mode)
  const next = mode === 'build' ? 'research' : 'build'
  const label = mode === 'build' ? 'badge.build' : 'badge.research'
  const title = mode === 'build' ? 'badge.build.title' : 'badge.research.title'
  const Icon = mode === 'build' ? IconCodeOutline16 : IconSearchOutline16
  return (
    <button
      type="button"
      className={css.badge}
      aria-label={t(title)}
      title={t(title)}
      onClick={() => {
        setMode(next)
        selectView(next === 'research' ? 'research' : 'chat')
      }}
    >
      <Icon size={14} />
      {t(label)}
    </button>
  )
}
