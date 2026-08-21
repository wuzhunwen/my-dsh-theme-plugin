import type { Context } from '@deepseek-ai/cordis'
import { SettingsPanel } from './components/SettingsPanel'
import { ThemeManager } from './services/ThemeManager'
import type { ThemeEventData } from './types'

export const name = 'my-full-theme-client'
export const inject = ['slots', 'settingsScope', 'connection', 'remote']
export const priority = 10

export function apply(ctx: Context): void {
	const manager = new ThemeManager(ctx)
	const runtime = ctx as Context & {
		slots: {
			inject: (name: string, factory: () => unknown) => void
			register: (options: Record<string, unknown>, component: unknown) => unknown
		}
		settingsScope: { bind: (spec: { namespace: string }) => unknown }
		on: (event: string, callback: (event: ThemeEventData) => void) => void
	}
	const scope = runtime.settingsScope.bind({ namespace: 'my-theme' }) as {
		getSnapshot: () => { value?: import('./types').ThemeConfig }
		subscribe: (listener: () => void) => () => void
	}
	ctx.effect(() => {
		if (typeof document === 'undefined') return undefined as any
		const style = document.createElement('style')
		style.id = 'my-theme-styles'
		style.textContent = `:root { --theme-primary: #7C3AED; --theme-secondary: #10B981; --theme-background: #0F0F1A; --theme-surface: #1A1A2E; --theme-text: #E5E7EB; --glass-blur: 20px; --glass-opacity: .3; } body { background: var(--theme-background); color: var(--theme-text); } .glass-effect { backdrop-filter: blur(var(--glass-blur)); background: rgba(var(--theme-primary-rgb), var(--glass-opacity)); }`
		document.head.appendChild(style)
			const applySnapshot = () => {
				const config = scope.getSnapshot().value
				if (config) manager.applyTheme(config)
			}
			applySnapshot()
			const unsubscribe = scope.subscribe(applySnapshot)
			return () => { unsubscribe(); style.remove(); manager.destroy() }
	})
	runtime.slots.inject('settings.section', () => runtime.slots.register({
		name: 'settings.section',
		id: 'my-theme',
		order: 30,
		label: '主题设置',
		inject: () => ({ scope })
	}, SettingsPanel))
	runtime.on('theme:update', (event) => manager.applyTheme(event.config))
}
