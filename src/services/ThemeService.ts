import type { Context } from '@deepseek-ai/cordis'
import type { ThemeConfig, ThemePreset } from '../types'
import { themeVariables } from './ColorUtils'

export class ThemeService {
  private readonly presets = new Map<string, ThemePreset>()
  private currentTheme: ThemeConfig

  constructor(private readonly ctx: Context, config: ThemeConfig) {
    this.currentTheme = config
  }

  registerPreset(preset: ThemePreset): void { this.presets.set(preset.id, preset) }
  getPreset(id: string): ThemePreset | undefined { return this.presets.get(id) }
  getAllPresets(): ThemePreset[] { return [...this.presets.values()] }
  getCurrentTheme(): ThemeConfig { return this.currentTheme }
  generateThemeVariables(config: ThemeConfig): Record<string, string> { return themeVariables(config) }

  async uploadWallpaper(file: File): Promise<string> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader()
      reader.onload = () => resolve(String(reader.result ?? ''))
      reader.onerror = () => reject(reader.error ?? new Error('Failed to read wallpaper'))
      reader.readAsDataURL(file)
    })
  }

  update(config: ThemeConfig): void { this.currentTheme = config }
}