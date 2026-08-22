export type WallpaperFit = 'cover' | 'contain' | 'fill'

export interface ThemeColors {
  primary: string
  secondary: string
  background: string
  surface: string
  text: string
}

export interface GlassEffect { enabled: boolean; blur: number; opacity: number }
export interface WallpaperConfig { url: string; fit: WallpaperFit; opacity: number; name?: string }
export interface WallpaperHistoryItem { id: string; name?: string; ts: number; url: string }

export interface ThemeConfig {
  activePreset: string
  customColors: ThemeColors
  glassEffect: GlassEffect
  wallpaper: WallpaperConfig
  customCSS: string
}

export interface ThemePreset {
  id: string
  name: string
  colors: ThemeColors
  glassEffect: GlassEffect
  wallpaper: WallpaperConfig
}

export interface ThemeEventData { config: ThemeConfig; preset?: ThemePreset }

export interface ThemeAPI {
  getTheme: () => ThemeConfig | null
  setPreset: (presetId: string) => Promise<boolean>
  getPresets: () => ThemePreset[]
  uploadWallpaper: (file: File) => Promise<string>
}

export const defaultThemeConfig: ThemeConfig = {
  activePreset: 'dark',
  customColors: {
    primary: '#7C3AED', secondary: '#10B981', background: '#0F0F1A',
    surface: '#1A1A2E', text: '#E5E7EB'
  },
  glassEffect: { enabled: true, blur: 20, opacity: 30 },
  wallpaper: { url: '', fit: 'cover', opacity: 100 },
  customCSS: ''
}