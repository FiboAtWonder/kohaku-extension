enum THEME_TYPES {
  LIGHT = 'light',
  DARK = 'dark',
  SYSTEM = 'system'
}

// Kohaku's palette is dark-first, so the wallet defaults to the dark theme (kohaku)
const DEFAULT_THEME = THEME_TYPES.DARK

type ThemeType = THEME_TYPES.LIGHT | THEME_TYPES.DARK | THEME_TYPES.SYSTEM

export type { ThemeType }
export { DEFAULT_THEME, THEME_TYPES }
