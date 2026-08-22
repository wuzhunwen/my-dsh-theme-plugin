import { useEffect, useSyncExternalStore, useState } from 'react'
import type { ThemeConfig, ThemePreset } from '../types'
import type { ThemeManager } from '../services/ThemeManager'
import { ThemePreview } from './ThemePreview'

interface SettingsPanelProps {
  manager: ThemeManager
  onConfigChange?: (config: ThemeConfig) => void
}

const presets: ThemePreset[] = [
  { id: 'dark', name: '暗黑深邃', colors: { primary: '#7C3AED', secondary: '#10B981', background: '#0F0F1A', surface: '#1A1A2E', text: '#E5E7EB' }, glassEffect: { enabled: true, blur: 20, opacity: 30 }, wallpaper: { url: '', fit: 'cover', opacity: 100 } },
  { id: 'light', name: '明亮清新', colors: { primary: '#2563EB', secondary: '#7C3AED', background: '#F8FAFC', surface: '#FFFFFF', text: '#111827' }, glassEffect: { enabled: true, blur: 15, opacity: 20 }, wallpaper: { url: '', fit: 'cover', opacity: 100 } },
  { id: 'ocean', name: '海洋蓝调', colors: { primary: '#0EA5E9', secondary: '#06B6D4', background: '#0C4A6E', surface: '#082F49', text: '#E0F2FE' }, glassEffect: { enabled: true, blur: 25, opacity: 40 }, wallpaper: { url: '', fit: 'cover', opacity: 100 } }
]

export function SettingsPanel({ manager, onConfigChange }: SettingsPanelProps) {
  const config = useSyncExternalStore(
    (listener) => manager.subscribe(listener),
    () => manager.getTheme()
  )
  const [tab, setTab] = useState<'presets' | 'colors' | 'wallpaper' | 'advanced'>('presets')
  const [stagedWallpaper, setStagedWallpaper] = useState<{ url: string; name: string } | null>(null)

  const switchTab = (id: typeof tab) => {
    setTab(id)
    setStagedWallpaper(null)
  }

  useEffect(() => {
    if (typeof document === 'undefined') return
    document.body.classList.add('my-theme-settings-open')
    return () => document.body.classList.remove('my-theme-settings-open')
  }, [])

  const update = (path: string, value: unknown, name_path?: string, name?: string) => {
    const [section, key] = path.split('.')
    let next = key
      ? { ...config, [section]: { ...(config as unknown as Record<string, unknown>)[section] as object, [key]: value } }
      : { ...config, [section]: value }
    if (name_path) {
      const [name_section, name_key] = name_path.split('.')
      next = name_key ? { ...next, [name_section]: { ...(next as unknown as Record<string, unknown>)[name_section] as object, [name_key]: name } }
        : { ...next, [name_section]: name }
    }
    onConfigChange?.(next as ThemeConfig)
  }

  const selectPreset = (preset: ThemePreset) => {
    onConfigChange?.({
      ...config,
      activePreset: preset.id,
      customColors: preset.colors,
      glassEffect: preset.glassEffect,
      wallpaper: preset.wallpaper
    })
  }

  const stageWallpaper = (file: File, event: React.ChangeEvent<HTMLInputElement>) => {
    if (file.size > 5 * 1024 * 1024) {
      window.alert('壁纸文件超过 5MB，无法保存，请更换图片')
      event.target.value = ''
      return
    }
    const reader = new FileReader()
    reader.onload = () => setStagedWallpaper({ url: String(reader.result ?? ''), name: file.name })
    reader.onerror = () => console.warn('[my-theme] 壁纸读取失败：', reader.error)
    reader.readAsDataURL(file)
    event.target.value = ''
  }
  const saveStagedWallpaper = () => {
    if (!stagedWallpaper) return
    update('wallpaper.url', stagedWallpaper.url, 'wallpaper.name', stagedWallpaper.name)
    setStagedWallpaper(null)
  }
  const applyHistoryWallpaper = (url: string, name?: string) => {
    update('wallpaper.url', url, 'wallpaper.name', name)
    setStagedWallpaper(null)
  }
  return (
    <div className="theme-settings-panel">
      <h2>主题定制</h2>
      <ThemePreview config={config} />
      <nav className="theme-tabs" aria-label="主题设置分类">
        {([['presets', '预设主题'], ['colors', '自定义颜色'], ['wallpaper', '壁纸设置'], ['advanced', '高级设置']] as const).map(([id, label]) => (
          <button key={id} className={tab === id ? 'active' : ''} onClick={() => switchTab(id)}>{label}</button>
        ))}
      </nav>
      {tab === 'presets' && <div className="presets-grid">{presets.map((preset) => (
        <button key={preset.id} className={`preset-card ${config.activePreset === preset.id ? 'active' : ''}`} onClick={() => selectPreset(preset)}>
          <span style={{ background: `linear-gradient(135deg, ${preset.colors.primary}, ${preset.colors.secondary})` }} />
          <strong>{preset.name}</strong><small>{preset.id}</small>
        </button>
      ))}</div>}
      {tab === 'colors' && <div className="theme-form">{(['primary', 'secondary', 'background', 'surface', 'text'] as const).map((key) => (
        <label key={key}>{key}<span><input type="color" value={config.customColors[key]} onChange={(event) => update(`customColors.${key}`, event.target.value)} /><input value={config.customColors[key]} onChange={(event) => update(`customColors.${key}`, event.target.value)} /></span></label>
      ))}</div>}
      {tab === 'wallpaper' && <div className="theme-form">
        <label>壁纸 {config.wallpaper.name || '（未设置）'}
          <input type="file" accept="image/*" onChange={(event) => { const file = event.target.files?.[0]; if (file) stageWallpaper(file, event) }} />
        </label>
        {stagedWallpaper && (
          <div className="wallpaper-staged">
            <img src={stagedWallpaper.url} alt={stagedWallpaper.name} />
            <div>
              <strong>{stagedWallpaper.name}</strong>
              <span className="wallpaper-staged-actions">
                <button onClick={saveStagedWallpaper}>保存</button>
                <button onClick={() => setStagedWallpaper(null)}>取消</button>
              </span>
            </div>
          </div>
        )}
        <label>适配方式<select value={config.wallpaper.fit} onChange={(event) => update('wallpaper.fit', event.target.value)}><option value="cover">Cover</option><option value="contain">Contain</option><option value="fill">Fill</option></select></label>
        <label>透明度 {config.wallpaper.opacity}%<input type="range" min="0" max="100" value={config.wallpaper.opacity} onChange={(event) => update('wallpaper.opacity', Number(event.target.value))} /></label>
        {manager.getWallpaperHistory().length > 0 && (
          <div className="wallpaper-history">
            <div className="wallpaper-history-head"><strong>历史壁纸</strong><button onClick={() => manager.clearWallpaperHistory()}>清空</button></div>
            <div className="wallpaper-history-grid">
              {manager.getWallpaperHistory().map((item) => (
                <button key={item.id} className="wallpaper-history-item" title={item.name} onClick={() => applyHistoryWallpaper(item.url, item.name)}>
                  <img src={item.url} alt={item.name ?? ''} />
                  <small>{item.name ?? ''}</small>
                  <span className="wallpaper-history-remove" onClick={(event) => { event.stopPropagation(); manager.removeWallpaperFromHistory(item.id) }}>×</span>
                </button>
              ))}
            </div>
          </div>
        )}
      </div>}
      {tab === 'advanced' && <div className="theme-form">
        <label>毛玻璃效果<input type="checkbox" checked={config.glassEffect.enabled} onChange={(event) => update('glassEffect.enabled', event.target.checked)} /></label>
        <label>模糊强度 {config.glassEffect.blur}px<input type="range" min="0" max="50" value={config.glassEffect.blur} onChange={(event) => update('glassEffect.blur', Number(event.target.value))} /></label>
        <label>自定义 CSS<textarea rows={8} value={config.customCSS} onChange={(event) => update('customCSS', event.target.value)} /></label>
      </div>}
    </div>
  )
}
