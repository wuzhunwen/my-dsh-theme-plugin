import type { ThemeConfig } from '../types'

export function ThemePreview({ config }: { config: ThemeConfig }) {
  return (
    <div className="theme-preview" style={{ background: config.customColors.background, color: config.customColors.text }}>
      <div className="theme-preview-bar" style={{ background: config.customColors.primary }} />
      <div>
        <strong>主题预览</strong>
        <p style={{ color: config.customColors.secondary }}>当前主题：{config.activePreset}</p>
      </div>
      <div className="theme-preview-surface" style={{ background: config.customColors.surface }} />
    </div>
  )
}