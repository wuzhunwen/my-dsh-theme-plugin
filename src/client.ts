import type { Context } from '@deepseek-ai/cordis'
import { SettingsPanel } from './components/SettingsPanel'
import { ThemeManager } from './services/ThemeManager'

export const name = 'my-full-theme-client'
export const inject = ['slots']
export const priority = 10

export function apply(ctx: Context): void {
	const manager = new ThemeManager(ctx)
	const runtime = ctx as Context & {
		slots: {
			inject: (name: string, factory: () => unknown) => void
			register: (options: Record<string, unknown>, component: unknown) => unknown
		}
	}
	ctx.effect(() => {
		if (typeof document === 'undefined') return undefined as any
		const style = document.createElement('style')
		style.id = 'my-theme-styles'
		style.textContent = `
			:root { --theme-primary: #7C3AED; --theme-secondary: #10B981; --theme-background: #0F0F1A; --theme-surface: #1A1A2E; --theme-text: #E5E7EB; --glass-blur: 20px; --glass-opacity: .3; --column-opacity: 0%; --composer-opacity: 0%; }
			body { background: var(--theme-background); color: var(--theme-text); }
			/* 令牌映射：DSH 组件背景全部取自 --dsw-* 设计令牌（如 --dsw-alias-bg-base、
			   --dsw-specific-sidebar-fill）。把消费最多的背景令牌指到主题色后，
			   工作区列/聊天记录列/侧边栏等所有消费它们的元素自动与 root 同色，
			   不再需要按哈希类名逐类覆盖，也免受 DSH 每次构建改类名的影响。 */
			body[data-my-theme][data-ds-dark-theme],
			body[data-my-theme]:not([data-ds-dark-theme]) {
				--dsw-alias-bg-base: var(--theme-background);
				--dsw-specific-sidebar-fill: var(--theme-background);
				--dsw-alias-bg-layer-1: var(--theme-surface);
				--dsw-alias-bg-layer-2: var(--theme-surface);
				--dsw-alias-bg-layer-3: var(--theme-surface);
				--dsw-specific-input-major: var(--theme-surface);
				--dsw-specific-bubble: var(--theme-surface);
				--dsw-specific-menu: var(--theme-surface);
				--dsw-specific-selector: var(--theme-surface);
				--dsw-alias-bg-module-platform: var(--theme-surface);
			}
			body[data-my-theme] [class*="_frame"] { background: var(--theme-background) !important; color: var(--theme-text) !important; }
			body[data-my-theme] [class*="_card"] { background: var(--theme-surface) !important; color: var(--theme-text) !important; border-color: color-mix(in srgb, var(--theme-text) 15%, transparent) !important; }
			/* 壁纸垫底模型（#theme-wallpaper 为 z-index:-1，位于一切内容之下）：
			   1) body 背景放行，否则负层级壁纸会被 body 自身背景盖住；
			   2) 顶层框架 _frame 与侧边栏列 _sidebarCol 透底，背景交给其下的列容器，
			      避免两层半透明叠乘把壁纸压没；
			   3) 壁纸激活时把背景令牌置为按 --column-opacity（0-100%，设置面板可调）混合的
			      主题背景色：0% = 工作区/聊天记录/侧边栏与 root 一样完全透底、壁纸全幅可见；
			      100% = 纯主题背景色不透壁纸；中间值 = 半透明衬托、兼顾可读性；
			   4) 兜底：框架内所有元素背景一律透底——代码块、状态胶囊、行选中态、
			      选择器等大量自带背景的类全部跟随 root 透明度，不再逐类枚举；
			   5) 豁免：图片与悬浮层（菜单/弹层/提示/对话框）恢复表面色，保证可读；
			   6) 反馈：按钮/行的悬停与选中态保留轻微主色淡染。
			   只改动背景，文字保持不透明正常显示；聊天记录等所有内容天然绘制在壁纸之上。 */
			body[data-my-wallpaper] { background: transparent !important; }
			body[data-my-wallpaper]:not(.my-theme-settings-open) {
				--dsw-alias-bg-base: color-mix(in srgb, var(--theme-background) var(--column-opacity, 0%), transparent);
				--dsw-specific-sidebar-fill: color-mix(in srgb, var(--theme-background) var(--column-opacity, 0%), transparent);
				--dsw-alias-bg-layer-1: transparent;
				--dsw-alias-bg-layer-2: transparent;
				--dsw-alias-bg-layer-3: transparent;
			}
			body[data-my-wallpaper]:not(.my-theme-settings-open) [class*="_frame"],
			body[data-my-wallpaper]:not(.my-theme-settings-open) [class*="_sidebarCol"] { background: transparent !important; }
			/* 兜底（先声明）：框架内所有元素背景一律透底 */
			body[data-my-wallpaper]:not(.my-theme-settings-open) [class*="_frame"] * { background: transparent !important; }
			/* 列容器底色（后声明，同等优先级下覆盖兜底；不透明度由 --column-opacity 控制，
			   0% 与 root 一样全透明，100% 纯主题背景色） */
			body[data-my-wallpaper]:not(.my-theme-settings-open) [class*="_root"] { background: color-mix(in srgb, var(--theme-background) var(--column-opacity, 0%), transparent) !important; }
			/* 消息发送框底色（后声明，同等优先级下覆盖兜底；不透明度由 --composer-opacity 单独控制，
			   0% 完全透明，100% 纯表面色，与列底色互不影响） */
			body[data-my-wallpaper]:not(.my-theme-settings-open) [class*="_card"] { background: color-mix(in srgb, var(--theme-surface) var(--composer-opacity, 0%), transparent) !important; }
			/* 豁免：悬浮层（菜单/弹层/提示/对话框）恢复表面色，保证可读 */
			body[data-my-wallpaper]:not(.my-theme-settings-open) [class*="_frame"] [class*="_panel" i],
			body[data-my-wallpaper]:not(.my-theme-settings-open) [class*="_frame"] [class*="_menu" i],
			body[data-my-wallpaper]:not(.my-theme-settings-open) [class*="_frame"] [class*="_popover" i],
			body[data-my-wallpaper]:not(.my-theme-settings-open) [class*="_frame"] [class*="_tooltip" i],
			body[data-my-wallpaper]:not(.my-theme-settings-open) [class*="_frame"] [class*="_dialog" i],
			body[data-my-wallpaper]:not(.my-theme-settings-open) [class*="_frame"] [class*="_modal" i] { background: var(--theme-surface) !important; }
			/* 反馈：按钮/行的悬停与选中态保留轻微主色淡染 */
			body[data-my-wallpaper]:not(.my-theme-settings-open) button:hover,
			body[data-my-wallpaper]:not(.my-theme-settings-open) [class*="_frame"] [class*="Row" i]:hover,
			body[data-my-wallpaper]:not(.my-theme-settings-open) [class*="_frame"] [class*="_selected" i] { background: color-mix(in srgb, var(--theme-primary) 22%, transparent) !important; }
			body[data-my-theme] button { color: var(--theme-text); }
			body[data-my-theme] button:hover { background: color-mix(in srgb, var(--theme-primary) 18%, transparent); }
			.glass-effect { backdrop-filter: blur(var(--glass-blur)); background: rgba(var(--theme-primary-rgb), var(--glass-opacity)); }
			.theme-settings-panel { color: var(--theme-text); background: var(--theme-surface); padding: 1rem; min-height: 100%; }
			.theme-settings-panel h2 { margin: 0 0 1rem; color: var(--theme-text); }
			.theme-preview { display: flex; align-items: center; gap: .75rem; padding: .75rem; margin-bottom: 1rem; border-radius: 6px; }
			.theme-preview-bar { width: .4rem; align-self: stretch; border-radius: 4px; }
			.theme-preview p { margin: .25rem 0 0; }
			.theme-tabs, .presets-grid, .theme-form { display: flex; flex-wrap: wrap; gap: .5rem; }
			.theme-tabs button, .preset-card { border: 1px solid color-mix(in srgb, var(--theme-text) 18%, transparent); background: var(--theme-background); color: var(--theme-text); padding: .5rem .75rem; border-radius: 4px; }
			.theme-tabs button.active, .preset-card.active { border-color: var(--theme-primary); background: color-mix(in srgb, var(--theme-primary) 20%, var(--theme-background)); }
			.presets-grid { margin-top: .75rem; }
			.preset-card { display: grid; gap: .35rem; min-width: 9rem; text-align: left; cursor: pointer; }
			.preset-card > span { display: block; height: 2rem; }
			.theme-form { display: grid; width: 100%; margin-top: .75rem; }
			.theme-form label { display: flex; align-items: center; justify-content: space-between; gap: 1rem; }
			.wallpaper-history { display: grid; gap: .5rem; }
			.wallpaper-history-head { display: flex; align-items: center; justify-content: space-between; }
			.wallpaper-history-head button { border: 1px solid color-mix(in srgb, var(--theme-text) 18%, transparent); background: var(--theme-background); color: var(--theme-text); padding: .25rem .6rem; border-radius: 4px; }
			.wallpaper-history-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(5rem, 1fr)); gap: .5rem; }
			.wallpaper-history-item { position: relative; display: grid; gap: .25rem; padding: .25rem; text-align: center; border: 1px solid color-mix(in srgb, var(--theme-text) 18%, transparent); background: var(--theme-background); border-radius: 4px; }
			.wallpaper-history-item img { width: 100%; height: 4rem; object-fit: cover; border-radius: 4px; display: block; }
			.wallpaper-history-item small { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; color: var(--theme-text); }
			.wallpaper-history-remove { position: absolute; top: .15rem; right: .15rem; width: 1.1rem; height: 1.1rem; line-height: 1; display: grid; place-items: center; border-radius: 50%; background: rgba(0,0,0,.55); color: #fff; cursor: pointer; }
			.wallpaper-staged { display: flex; align-items: center; gap: .75rem; padding: .5rem; border: 1px dashed color-mix(in srgb, var(--theme-primary) 60%, transparent); border-radius: 6px; }
			.wallpaper-staged img { width: 5rem; height: 4rem; object-fit: cover; border-radius: 4px; }
			.wallpaper-staged > div { display: grid; gap: .5rem; }
			.wallpaper-staged-actions { display: flex; gap: .5rem; }
			.wallpaper-staged-actions button { border: 1px solid color-mix(in srgb, var(--theme-text) 18%, transparent); background: var(--theme-background); color: var(--theme-text); padding: .25rem .6rem; border-radius: 4px; }
			.wallpaper-staged-actions button:first-child { border-color: var(--theme-primary); background: color-mix(in srgb, var(--theme-primary) 20%, var(--theme-background)); }
		`
		document.head.appendChild(style)
		const saved = manager.loadPersisted()
		manager.applyTheme(saved ?? manager.getTheme())
		return () => { style.remove(); manager.destroy() }
	})
	runtime.slots.inject('settings.section', () => runtime.slots.register({
		name: 'settings.section',
		id: 'my-theme',
		order: 30,
		label: '主题设置',
		inject: () => ({
			manager,
			onConfigChange: (config: import('./types').ThemeConfig) => manager.applyTheme(config)
		})
	}, SettingsPanel))
}
