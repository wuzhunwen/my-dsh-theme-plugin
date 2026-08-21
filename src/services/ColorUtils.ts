import type { ThemeConfig } from '../types'

export function hexToRgb(hex: string): { r: number; g: number; b: number } | null {
  const normalized = hex.trim().replace(/^#/, '')
  const value = normalized.length === 3 ? normalized.split('').map((part) => part + part).join('') : normalized
  if (!/^[a-f\d]{6}$/i.test(value)) return null
  return {
    r: Number.parseInt(value.slice(0, 2), 16),
    g: Number.parseInt(value.slice(2, 4), 16),
    b: Number.parseInt(value.slice(4, 6), 16)
  }
}

export function themeVariables(config: ThemeConfig): Record<string, string> {
  const rgb = hexToRgb(config.customColors.primary) ?? { r: 124, g: 58, b: 237 }
  return {
    '--theme-primary': config.customColors.primary,
    '--theme-secondary': config.customColors.secondary,
    '--theme-background': config.customColors.background,
    '--theme-surface': config.customColors.surface,
    '--theme-text': config.customColors.text,
    '--theme-primary-rgb': `${rgb.r}, ${rgb.g}, ${rgb.b}`,
    '--glass-blur': `${config.glassEffect.blur}px`,
    '--glass-opacity': String(config.glassEffect.opacity / 100),
    '--wallpaper-fit': config.wallpaper.fit,
    '--wallpaper-opacity': String(config.wallpaper.opacity / 100)
  }
}