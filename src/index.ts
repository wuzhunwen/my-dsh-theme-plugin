import type { Context } from '@deepseek-ai/cordis'
import z from '@deepseek-ai/schemastery'
import { ThemeService } from './services/ThemeService'
import type { ThemeAPI, ThemeConfig, ThemePreset } from './types'
import { defaultThemeConfig } from './types'

export const name = 'my-full-theme'
export const inject = ['settings']

export interface Config extends ThemeConfig {}

export const Config = z.object({
	activePreset: z.string().default(defaultThemeConfig.activePreset),
	customColors: z.object({
		primary: z.string().default(defaultThemeConfig.customColors.primary),
		secondary: z.string().default(defaultThemeConfig.customColors.secondary),
		background: z.string().default(defaultThemeConfig.customColors.background),
		surface: z.string().default(defaultThemeConfig.customColors.surface),
		text: z.string().default(defaultThemeConfig.customColors.text)
	}),
	glassEffect: z.object({
		enabled: z.boolean().default(true), blur: z.number().min(0).max(50).default(20), opacity: z.number().min(0).max(100).default(30)
	}),
	wallpaper: z.object({
		url: z.string().default(''), fit: z.union(['cover', 'contain', 'fill']).default('cover'), opacity: z.number().min(0).max(100).default(100)
	}),
	customCSS: z.string().default('')
})

const presets: ThemePreset[] = [
	{ id: 'dark', name: '暗黑深邃', colors: defaultThemeConfig.customColors, glassEffect: defaultThemeConfig.glassEffect, wallpaper: defaultThemeConfig.wallpaper },
	{ id: 'light', name: '明亮清新', colors: { primary: '#2563EB', secondary: '#7C3AED', background: '#F8FAFC', surface: '#FFFFFF', text: '#111827' }, glassEffect: { enabled: true, blur: 15, opacity: 20 }, wallpaper: defaultThemeConfig.wallpaper },
	{ id: 'ocean', name: '海洋蓝调', colors: { primary: '#0EA5E9', secondary: '#06B6D4', background: '#0C4A6E', surface: '#082F49', text: '#E0F2FE' }, glassEffect: { enabled: true, blur: 25, opacity: 40 }, wallpaper: defaultThemeConfig.wallpaper }
]

export function apply(ctx: Context, config: Config): void {
	const logger = ctx.logger('my-theme')
	const service = new ThemeService(ctx, config)
	const runtime = ctx as Context & {
		settings: {
			register: (name: string, schema: unknown, options: { base: Config }) => {
				get: () => Config
				watch: (callback: (config: Config) => void) => () => void
				update: (patch: Partial<Config>) => Promise<void>
			}
		}
		emit: (event: string, data: unknown) => void
	}
	presets.forEach((preset) => service.registerPreset(preset))
	ctx.provide('themeService', service)
	const settings = runtime.settings.register('my-theme', Config, { base: config })
	settings.watch((next: Config) => {
		service.update(next)
		runtime.emit('theme:update', { config: next, preset: service.getPreset(next.activePreset) })
	})
	const api: ThemeAPI = {
		getTheme: () => service.getCurrentTheme(),
		getPresets: () => service.getAllPresets(),
		setPreset: async (id) => {
			const preset = service.getPreset(id)
			if (!preset) return false
			await settings.update({ activePreset: id, customColors: preset.colors, glassEffect: preset.glassEffect, wallpaper: preset.wallpaper })
			return true
		},
		uploadWallpaper: (file) => service.uploadWallpaper(file)
	}
	ctx.provide('themeAPI', api)
	logger.info('Theme plugin initialized')
}
