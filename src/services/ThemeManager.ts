import type { Context } from '@deepseek-ai/cordis'
import type { ThemeAPI, ThemeConfig, ThemePreset } from '../types'
import { themeVariables } from './ColorUtils'

export class ThemeManager {
  private currentTheme: ThemeConfig | null = null
  private customStyle: HTMLStyleElement | null = null

  constructor(private readonly ctx: Context) {}

  applyTheme(config: ThemeConfig): void {
    this.currentTheme = config
    const root = document.documentElement
    Object.entries(themeVariables(config)).forEach(([key, value]) => root.style.setProperty(key, value))
    root.dataset.theme = config.activePreset

    if (config.customCSS) {
      this.customStyle ??= Object.assign(document.createElement('style'), { id: 'custom-theme-css' })
      this.customStyle.textContent = config.customCSS
      if (!this.customStyle.isConnected) document.head.appendChild(this.customStyle)
    } else {
      this.customStyle?.remove()
    }
    this.applyWallpaper(config)
    document.querySelector('meta[name="theme-color"]')?.setAttribute('content', config.customColors.primary)
  }

  getCurrentTheme(): ThemeConfig | null { return this.currentTheme }

  getPresets(): Promise<ThemePreset[]> {
    const api = (this.ctx as Context & { themeAPI?: ThemeAPI }).themeAPI
    return Promise.resolve(api?.getPresets() ?? [])
  }

  destroy(): void {
    this.customStyle?.remove()
    document.getElementById('theme-wallpaper')?.remove()
    Object.keys(themeVariables(this.currentTheme ?? {} as ThemeConfig)).forEach((key) => {
      document.documentElement.style.removeProperty(key)
    })
  }

  private applyWallpaper(config: ThemeConfig): void {
    let wallpaper = document.getElementById('theme-wallpaper')
    if (!config.wallpaper.url) { wallpaper?.remove(); return }
    if (!wallpaper) {
      wallpaper = document.createElement('div')
      wallpaper.id = 'theme-wallpaper'
      document.body.prepend(wallpaper)
    }
    wallpaper.style.cssText = [
      'position:fixed', 'inset:0', 'z-index:-1', 'pointer-events:none',
      'background-position:center', 'background-repeat:no-repeat',
      'transition:opacity .2s ease', `background-image:url(${JSON.stringify(config.wallpaper.url)})`,
      `background-size:${config.wallpaper.fit}`, `opacity:${config.wallpaper.opacity / 100}`
    ].join(';')
  }
}