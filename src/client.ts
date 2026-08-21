import type { Context } from '@deepseek-ai/cordis'
import { SettingsPanel } from './components/SettingsPanel'
import { ThemeManager } from './services/ThemeManager'
import type { ThemeEventData } from './types'

export const name = 'my-full-theme-client'
export const inject = ['settings', 'shell']
export const priority = 10

export function apply(ctx: Context): void {
	const manager = new ThemeManager(ctx)
	const runtime = ctx as Context & { shell?: { overlay?: (path: string, factory: () => unknown) => void; notify?: (data: unknown) => void } }
	const services = ctx as Context & {
		settings: { get: (key: string) => Promise<import('./types').ThemeConfig> }
		on: (event: string, callback: (event: ThemeEventData) => void) => void
	}
	ctx.effect(() => {
		if (typeof document === 'undefined') return undefined as any
		const style = document.createElement('style')
		style.id = 'my-theme-styles'
		style.textContent = `:root { --theme-primary: #7C3AED; --theme-secondary: #10B981; --theme-background: #0F0F1A; --theme-surface: #1A1A2E; --theme-text: #E5E7EB; --glass-blur: 20px; --glass-opacity: .3; } body { background: var(--theme-background); color: var(--theme-text); } .glass-effect { backdrop-filter: blur(var(--glass-blur)); background: rgba(var(--theme-primary-rgb), var(--glass-opacity)); }`
		document.head.appendChild(style)
		void services.settings.get('my-theme').then((config) => manager.applyTheme(config))
		return () => { style.remove(); manager.destroy() }
	})
	runtime.shell?.overlay?.('settings.general.items', () => ({ id: name, label: '主题设置', icon: 'palette', component: SettingsPanel, order: 10 }))
	services.on('theme:update', (event) => manager.applyTheme(event.config))
}
