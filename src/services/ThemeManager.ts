import type { Context } from '@deepseek-ai/cordis'
import type { ThemeAPI, ThemeConfig, ThemePreset, WallpaperHistoryItem } from '../types'
import { defaultThemeConfig } from '../types'
import { hexToRgb, themeVariables } from './ColorUtils'

const CONFIG_KEY = 'my-full-theme-plugin:config'
const WALLPAPER_HISTORY_KEY = 'my-full-theme-plugin:wallpaper-history'
const WALLPAPER_CURRENT_KEY = 'my-full-theme-plugin:wallpaper-current'
const WALLPAPER_DATA_PREFIX = 'my-full-theme-plugin:wallpaper:'
const WALLPAPER_LEGACY_KEY = 'my-full-theme-plugin:wallpaper'
const WALLPAPER_MAP_KEY = 'my-full-theme-plugin:wallpaper-map'
const WALLPAPER_HISTORY_MAX = 8
const WALLPAPER_ID_MARKER = '@local:'

interface StoredHistoryItem { id: string; name?: string; ts: number }

export class ThemeManager {
  private currentTheme: ThemeConfig = defaultThemeConfig
  private customStyle: HTMLStyleElement | null = null
  private readonly listeners = new Set<() => void>()
  private currentWallpaperId: string | undefined
  private currentWallpaperUrl: string | undefined

  constructor(private readonly ctx: Context) { }

  getTheme(): ThemeConfig { return this.currentTheme }

  getCurrentTheme(): ThemeConfig { return this.currentTheme }

  subscribe(listener: () => void): () => void {
    this.listeners.add(listener)
    return () => { this.listeners.delete(listener) }
  }

  private notify(): void {
    for (const listener of [...this.listeners]) listener()
  }

  applyTheme(config: ThemeConfig): void {
    this.currentTheme = config
    const root = document.documentElement
    Object.entries(themeVariables(config)).forEach(([key, value]) => root.style.setProperty(key, value))
    root.dataset.theme = config.activePreset
    const dark = this.isDarkTheme(config)
    root.style.colorScheme = dark ? 'dark' : 'light'
    document.body.toggleAttribute('data-ds-dark-theme', dark)
    document.body.dataset.myTheme = config.activePreset

    if (config.customCSS) {
      this.customStyle ??= Object.assign(document.createElement('style'), { id: 'custom-theme-css' })
      this.customStyle.textContent = config.customCSS
      if (!this.customStyle.isConnected) document.head.appendChild(this.customStyle)
    } else {
      this.customStyle?.remove()
      this.customStyle = null
    }
    this.applyWallpaper(config)
    document.querySelector('meta[name="theme-color"]')?.setAttribute('content', config.customColors.primary)
    this.persist(config)
    this.notify()
  }

  persist(config: ThemeConfig): void {
    // 壁纸按 id 独立存放（wallpaper:<id>），当前 id 存 wallpaper-current，历史列表只存 [{id,name,ts}]。
    const url = config.wallpaper.url
    const prevUrl = this.currentWallpaperUrl
    if (url && url !== prevUrl) {
      let id = this.findIdByUrl(url)
      if (!id) {
        id = this.createId()
        if (this.writeWallpaperData(id, { url, name: config.wallpaper.name ?? '' })) {
          this.currentWallpaperId = id
          this.currentWallpaperUrl = url
          localStorage.setItem(WALLPAPER_CURRENT_KEY, id)
        } else {
          id = undefined
        }
      } else {
        this.currentWallpaperId = id
        this.currentWallpaperUrl = url
        localStorage.setItem(WALLPAPER_CURRENT_KEY, id)
      }
      if (id) {
        const oldHistory = this.readHistoryList()
        const history = oldHistory.filter((item) => item.id !== id)
        history.unshift({ id, name: config.wallpaper.name ?? '', ts: Date.now() })
        const kept = history.slice(0, WALLPAPER_HISTORY_MAX)
        this.writeWallpaperHistory(kept)
        this.pruneDataKeys(oldHistory, kept)
      }
    } else if (!url) {
      localStorage.removeItem(WALLPAPER_CURRENT_KEY)
      this.currentWallpaperId = undefined
      this.currentWallpaperUrl = undefined
    }
    const stored: ThemeConfig = { ...config, wallpaper: { ...config.wallpaper, url: '' } }
    try {
      localStorage.setItem(CONFIG_KEY, JSON.stringify(stored))
    } catch (error) {
      console.warn('[my-theme] 主题配置保存失败（可能超出 localStorage 配额），刷新后将回退到旧配置：', error)
    }
  }

  loadPersisted(): ThemeConfig | null {
    try {
      this.migrateLegacy()
      const raw = localStorage.getItem(CONFIG_KEY)
      if (!raw) return null
      const config = JSON.parse(raw) as ThemeConfig
      config.wallpaper = { ...config.wallpaper, url: '' }
      const id = this.getCurrentWallpaperId()
      if (id) {
        const data = this.readWallpaperData(id)
        if (data?.url) {
          config.wallpaper.url = data.url
          config.wallpaper.name = data.name ?? config.wallpaper.name
          this.currentWallpaperId = id
          this.currentWallpaperUrl = data.url
        }
      }
      return config
    } catch {
      return null
    }
  }

  getWallpaperHistory(): WallpaperHistoryItem[] {
    return this.readHistoryList()
      .map((item) => ({ ...item, url: this.readWallpaperData(item.id)?.url ?? '' }))
      .filter((item) => Boolean(item.url))
  }

  removeWallpaperFromHistory(id: string): void {
    this.writeWallpaperHistory(this.readHistoryList().filter((item) => item.id !== id))
    if (id !== this.currentWallpaperId) {
      localStorage.removeItem(WALLPAPER_DATA_PREFIX + id)
    }
    this.notify()
  }

  clearWallpaperHistory(): void {
    const history = this.readHistoryList()
    for (const item of history) {
      if (item.id !== this.currentWallpaperId) {
        localStorage.removeItem(WALLPAPER_DATA_PREFIX + item.id)
      }
    }
    this.writeWallpaperHistory([])
    this.notify()
  }

  getPresets(): Promise<ThemePreset[]> {
    const api = (this.ctx as Context & { themeAPI?: ThemeAPI }).themeAPI
    return Promise.resolve(api?.getPresets() ?? [])
  }

  destroy(): void {
    this.customStyle?.remove()
    this.customStyle = null
    document.getElementById('theme-wallpaper')?.remove()
    document.body.removeAttribute('data-my-wallpaper')
    Object.keys(themeVariables(this.currentTheme)).forEach((key) => {
      document.documentElement.style.removeProperty(key)
    })
    document.documentElement.style.removeProperty('color-scheme')
    document.body.removeAttribute('data-ds-dark-theme')
    delete document.body.dataset.myTheme
  }

  private readWallpaperData(id: string): { url: string; name?: string } | null {
    try {
      const raw = localStorage.getItem(WALLPAPER_DATA_PREFIX + id)
      if (!raw) return null
      const data = JSON.parse(raw)
      return typeof data?.url === 'string' ? data : null
    } catch {
      return null
    }
  }

  private writeWallpaperData(id: string, data: { url: string; name?: string }): boolean {
    const save = (): boolean => {
      try {
        localStorage.setItem(WALLPAPER_DATA_PREFIX + id, JSON.stringify(data))
        return true
      } catch (error) {
        console.warn('[my-theme] 壁纸数据保存失败（可能超出 localStorage 配额）：', error)
        return false
      }
    }
    if (save()) return true
    const oldest = this.readHistoryList()
      .filter((item) => item.id !== id && item.id !== this.currentWallpaperId)
      .sort((a, b) => a.ts - b.ts)
    for (const item of oldest) {
      localStorage.removeItem(WALLPAPER_DATA_PREFIX + item.id)
      this.writeWallpaperHistory(this.readHistoryList().filter((h) => h.id !== item.id))
      if (save()) return true
    }
    return false
  }

  private getCurrentWallpaperId(): string | undefined {
    try {
      return localStorage.getItem(WALLPAPER_CURRENT_KEY) || undefined
    } catch {
      return undefined
    }
  }

  private findIdByUrl(url: string): string | undefined {
    if (!url) return undefined
    if (this.currentWallpaperId && this.readWallpaperData(this.currentWallpaperId)?.url === url) {
      return this.currentWallpaperId
    }
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i)
      if (key?.startsWith(WALLPAPER_DATA_PREFIX)) {
        const id = key.slice(WALLPAPER_DATA_PREFIX.length)
        if (this.readWallpaperData(id)?.url === url) return id
      }
    }
    return undefined
  }

  private pruneDataKeys(oldHistory: StoredHistoryItem[], kept: StoredHistoryItem[]): void {
    const keptIds = new Set(kept.map((item) => item.id))
    if (this.currentWallpaperId) keptIds.add(this.currentWallpaperId)
    for (const item of oldHistory) {
      if (!keptIds.has(item.id)) {
        localStorage.removeItem(WALLPAPER_DATA_PREFIX + item.id)
      }
    }
  }

  private readHistoryList(): StoredHistoryItem[] {
    try {
      const raw = localStorage.getItem(WALLPAPER_HISTORY_KEY)
      if (!raw) return []
      const list = JSON.parse(raw)
      return Array.isArray(list) ? list.filter((item): item is StoredHistoryItem => Boolean(item?.id)) : []
    } catch {
      return []
    }
  }

  private writeWallpaperHistory(history: StoredHistoryItem[]): void {
    try {
      localStorage.setItem(WALLPAPER_HISTORY_KEY, JSON.stringify(history))
    } catch (error) {
      console.warn('[my-theme] 历史壁纸列表保存失败：', error)
    }
  }

  private createId(): string {
    return `wp_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`
  }

  private migrateLegacy(): void {
    // 1) 上一版 wallpaper-map {id:url} -> 独立数据 key
    try {
      const mapRaw = localStorage.getItem(WALLPAPER_MAP_KEY)
      if (mapRaw) {
        const map = JSON.parse(mapRaw)
        if (typeof map === 'object' && map !== null) {
          const history = this.readHistoryList()
          const nameById = new Map(history.map((item) => [item.id, item.name]))
          for (const [id, url] of Object.entries(map)) {
            if (typeof url === 'string' && !this.readWallpaperData(id)) {
              this.writeWallpaperData(id, { url, name: nameById.get(id) ?? '' })
            }
          }
        }
        localStorage.removeItem(WALLPAPER_MAP_KEY)
      }
    } catch { /* 迁移失败忽略 */ }

    // 2) 旧格式历史（含完整 url、无 id）-> id 引用 + 独立数据 key
    try {
      const raw = localStorage.getItem(WALLPAPER_HISTORY_KEY)
      if (raw) {
        const list = JSON.parse(raw)
        if (Array.isArray(list) && list.some((item) => typeof item?.url === 'string' && !item.id)) {
          const converted = list.map((item) => {
            if (item?.url && !item.id) {
              const id = this.findIdByUrl(item.url) ?? this.createId()
              if (!this.readWallpaperData(id)) this.writeWallpaperData(id, { url: item.url, name: item.name ?? '' })
              return { id, name: item.name, ts: item.ts ?? Date.now() }
            }
            return { id: item.id, name: item.name, ts: item.ts ?? Date.now() }
          })
          this.writeWallpaperHistory(converted.slice(0, WALLPAPER_HISTORY_MAX))
        }
      }
    } catch { /* 迁移失败忽略 */ }

    // 3) 旧单独当前壁纸 key -> 独立数据 key + 并入历史
    try {
      const legacy = localStorage.getItem(WALLPAPER_LEGACY_KEY)
      if (legacy) {
        const parsed = JSON.parse(legacy)
        if (parsed?.url) {
          const id = this.findIdByUrl(parsed.url) ?? this.createId()
          if (!this.readWallpaperData(id)) this.writeWallpaperData(id, { url: parsed.url, name: parsed.name ?? '' })
          const history = this.readHistoryList().filter((item) => item.id !== id)
          history.unshift({ id, name: parsed.name ?? '', ts: Date.now() })
          this.writeWallpaperHistory(history.slice(0, WALLPAPER_HISTORY_MAX))
        }
        localStorage.removeItem(WALLPAPER_LEGACY_KEY)
      }
    } catch { /* 迁移失败忽略 */ }

    // 4) 确定当前壁纸 id：wallpaper-current > 配置 @local:<id> > 配置 @local（历史第一条）
    try {
      let currentId = this.getCurrentWallpaperId()
      const cfgRaw = localStorage.getItem(CONFIG_KEY)
      let cfg: ThemeConfig | null = null
      if (cfgRaw) { try { cfg = JSON.parse(cfgRaw) } catch { cfg = null } }
      if (!currentId && cfg?.wallpaper?.url?.startsWith(WALLPAPER_ID_MARKER)) {
        currentId = cfg.wallpaper.url.slice(WALLPAPER_ID_MARKER.length)
      }
      if (!currentId && cfg?.wallpaper?.url === '@local') {
        currentId = this.readHistoryList()[0]?.id
      }
      if (!currentId) {
        const first = this.readHistoryList()[0]
        if (first && this.readWallpaperData(first.id)) currentId = first.id
      }
      if (currentId && this.readWallpaperData(currentId)) {
        localStorage.setItem(WALLPAPER_CURRENT_KEY, currentId)
        this.currentWallpaperId = currentId
        this.currentWallpaperUrl = this.readWallpaperData(currentId)?.url
      }
      if (cfg) {
        if (cfg.wallpaper?.url) cfg.wallpaper.url = ''
        localStorage.setItem(CONFIG_KEY, JSON.stringify(cfg))
      }
    } catch { /* 迁移失败忽略 */ }

    // 5) 清理孤儿数据 key（不在历史且非当前）
    try {
      const history = this.readHistoryList()
      const currentId = this.getCurrentWallpaperId()
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i)
        if (key && key.startsWith(WALLPAPER_DATA_PREFIX)) {
          const id = key.slice(WALLPAPER_DATA_PREFIX.length)
          if (id !== currentId && !history.some((item) => item.id === id)) {
            localStorage.removeItem(key)
            i--
          }
        }
      }
    } catch { /* 迁移失败忽略 */ }
  }

  private isDarkTheme(config: ThemeConfig): boolean {
    const rgb = hexToRgb(config.customColors.background)
    if (!rgb) return config.activePreset !== 'light'
    const luminance = (0.2126 * rgb.r + 0.7152 * rgb.g + 0.0722 * rgb.b) / 255
    return luminance < 0.5
  }

  private applyWallpaper(config: ThemeConfig): void {
    const hasWallpaper = Boolean(config.wallpaper.url)
    document.body.toggleAttribute('data-my-wallpaper', hasWallpaper)
    let wallpaper = document.getElementById('theme-wallpaper')
    if (!hasWallpaper) { wallpaper?.remove(); return }
    if (!wallpaper) {
      wallpaper = document.createElement('div')
      wallpaper.id = 'theme-wallpaper'
      document.body.prepend(wallpaper)
    }
    wallpaper.style.cssText = [
      'position:fixed', 'inset:0', 'z-index:1', 'pointer-events:none',
      'background-position:center', 'background-repeat:no-repeat',
      'transition:opacity .2s ease', `background-image:url(${JSON.stringify(config.wallpaper.url)})`,
      `background-size:${config.wallpaper.fit}`, `opacity:${config.wallpaper.opacity / 100}`
    ].join(';')
  }
}
