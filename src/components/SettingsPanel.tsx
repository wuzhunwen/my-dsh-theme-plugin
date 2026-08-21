import { useEffect, useState } from 'react'
import type { ThemeConfig, ThemePreset } from '../types'
import { defaultThemeConfig } from '../types'
import { ThemePreview } from './ThemePreview'

interface SettingsScope {
  getSnapshot: () => { status: string; value?: ThemeConfig }
  subscribe: (listener: () => void) => () => void
  set: (field: string, value: unknown) => Promise<void>
}

interface SettingsPanelProps { scope: SettingsScope }

const presets: ThemePreset[] = [
  { id: 'dark', name: '暗黑深邃', colors: { primary: '#7C3AED', secondary: '#10B981', background: '#0F0F1A', surface: '#1A1A2E', text: '#E5E7EB' }, glassEffect: { enabled: true, blur: 20, opacity: 30 }, wallpaper: { url: '', fit: 'cover', opacity: 100 } },
  { id: 'light', name: '明亮清新', colors: { primary: '#2563EB', secondary: '#7C3AED', background: '#F8FAFC', surface: '#FFFFFF', text: '#111827' }, glassEffect: { enabled: true, blur: 15, opacity: 20 }, wallpaper: { url: '', fit: 'cover', opacity: 100 } },
  { id: 'ocean', name: '海洋蓝调', colors: { primary: '#0EA5E9', secondary: '#06B6D4', background: '#0C4A6E', surface: '#082F49', text: '#E0F2FE' }, glassEffect: { enabled: true, blur: 25, opacity: 40 }, wallpaper: { url: '', fit: 'cover', opacity: 100 } }
]

export function SettingsPanel({ scope }: SettingsPanelProps) {
  const [config, setConfig] = useState<ThemeConfig>(() => scope.getSnapshot().value ?? structuredClone(defaultThemeConfig))
  const [tab, setTab] = useState<'presets' | 'colors' | 'wallpaper' | 'advanced'>('presets')

  useEffect(() => {
    const sync = () => {
      const value = scope.getSnapshot().value
      if (value) setConfig(value)
    }
    return scope.subscribe(sync)
  }, [scope])

  const update = (path: string, value: unknown) => {
    const [section, key] = path.split('.') as ['customColors' | 'glassEffect' | 'wallpaper', string]
    if (key) {
      setConfig((current) => ({ ...current, [section]: { ...current[section], [key]: value } }))
    }
    void scope.set(path, value).catch(() => undefined)
  }

  const selectPreset = (preset: ThemePreset) => {
    setConfig((current) => ({ ...current, activePreset: preset.id, customColors: preset.colors, glassEffect: preset.glassEffect, wallpaper: preset.wallpaper }))
    void Promise.all([
      scope.set('activePreset', preset.id).catch(() => undefined),
      scope.set('customColors', preset.colors).catch(() => undefined),
      scope.set('glassEffect', preset.glassEffect).catch(() => undefined),
      scope.set('wallpaper', preset.wallpaper).catch(() => undefined)
    ])
  }

  return (
    <div className="theme-settings-panel">
      <h2>主题定制</h2>
      <ThemePreview config={config} />
      <nav className="theme-tabs" aria-label="主题设置分类">
        {([['presets', '预设主题'], ['colors', '自定义颜色'], ['wallpaper', '壁纸设置'], ['advanced', '高级设置']] as const).map(([id, label]) => (
          <button key={id} className={tab === id ? 'active' : ''} onClick={() => setTab(id)}>{label}</button>
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
        <label>壁纸<input type="file" accept="image/*" onChange={(event) => { const file = event.target.files?.[0]; if (file) { const reader = new FileReader(); reader.onload = () => update('wallpaper.url', String(reader.result ?? '')); reader.readAsDataURL(file) } }} /></label>
        <label>适配方式<select value={config.wallpaper.fit} onChange={(event) => update('wallpaper.fit', event.target.value)}><option value="cover">Cover</option><option value="contain">Contain</option><option value="fill">Fill</option></select></label>
        <label>透明度 {config.wallpaper.opacity}%<input type="range" min="0" max="100" value={config.wallpaper.opacity} onChange={(event) => update('wallpaper.opacity', Number(event.target.value))} /></label>
      </div>}
      {tab === 'advanced' && <div className="theme-form">
        <label>毛玻璃效果<input type="checkbox" checked={config.glassEffect.enabled} onChange={(event) => update('glassEffect.enabled', event.target.checked)} /></label>
        <label>模糊强度 {config.glassEffect.blur}px<input type="range" min="0" max="50" value={config.glassEffect.blur} onChange={(event) => update('glassEffect.blur', Number(event.target.value))} /></label>
        <label>自定义 CSS<textarea rows={8} value={config.customCSS} onChange={(event) => update('customCSS', event.target.value)} /></label>
      </div>}
    </div>
  )
}
