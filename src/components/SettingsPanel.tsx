import { useEffect, useState } from 'react'
import type { ThemeAPI, ThemeConfig, ThemePreset } from '../types'
import { ThemePreview } from './ThemePreview'

interface SettingsContext {
  settings: { get: (key: string) => Promise<ThemeConfig>; set: (key: string, value: ThemeConfig) => Promise<void> | void; reset: (key: string) => Promise<void> | void }
  themeAPI?: ThemeAPI
}

export function SettingsPanel({ ctx }: { ctx: SettingsContext }) {
  const [config, setConfig] = useState<ThemeConfig | null>(null)
  const [presets, setPresets] = useState<ThemePreset[]>([])
  const [tab, setTab] = useState<'presets' | 'colors' | 'wallpaper' | 'advanced'>('presets')

  useEffect(() => {
    void ctx.settings.get('my-theme').then(setConfig)
    setPresets(ctx.themeAPI?.getPresets() ?? [])
  }, [ctx])

  if (!config) return <div className="theme-settings-panel">加载中...</div>

  const update = (path: string, value: unknown) => {
    const keys = path.split('.')
    const next = structuredClone(config) as unknown as Record<string, unknown>
    let target = next
    keys.slice(0, -1).forEach((key) => { target = target[key] as Record<string, unknown> })
    target[keys[keys.length - 1]] = value
    const nextConfig = next as unknown as ThemeConfig
    setConfig(nextConfig)
    void ctx.settings.set('my-theme', nextConfig)
  }

  const selectPreset = (preset: ThemePreset) => {
    const next = { ...config, activePreset: preset.id, customColors: preset.colors, glassEffect: preset.glassEffect, wallpaper: preset.wallpaper }
    setConfig(next)
    void ctx.settings.set('my-theme', next)
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
        <label>壁纸<input type="file" accept="image/*" onChange={(event) => { const file = event.target.files?.[0]; if (file) void ctx.themeAPI?.uploadWallpaper(file).then((url) => update('wallpaper.url', url)) }} /></label>
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