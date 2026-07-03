import { ColorValue } from 'react-native'

import { ACCENT_PRIMITIVES, FEEDBACK_PRIMITIVES, NEUTRAL_PRIMITIVES } from './theme/primitives'
import { THEME_TYPES, ThemeType } from './theme/types'
import { hexToRgba } from './utils/common'

/**
 * Theme color configuration for the application.
 *
 * To determine the color of an element:
 * 1. Identify the color in Figma (e.g., "grey/300 bg 1")
 * 2. Map design color to theme prefix (grey → neutral, purple → primaryAccent, etc.)
 * 3. Find the semantic token in this object (prefer over primitives) (e.g., primaryBackground)
 * 4. Fall back to primitives if no semantic token exists
 */
const ThemeColors = {
  ...NEUTRAL_PRIMITIVES,
  ...ACCENT_PRIMITIVES,
  ...FEEDBACK_PRIMITIVES,
  // --- Background tokens --- (kohaku brand values)
  primaryBackground: {
    [THEME_TYPES.DARK]: '#000000',
    [THEME_TYPES.LIGHT]: '#FFFFFF'
  },
  secondaryBackground: {
    [THEME_TYPES.DARK]: '#1A1A1A',
    [THEME_TYPES.LIGHT]: '#f1f1f1'
  },
  tertiaryBackground: {
    [THEME_TYPES.DARK]: '#2A2A2A',
    [THEME_TYPES.LIGHT]: '#9E9E9F'
  },
  // --- Text tokens --- (kohaku brand values)
  primaryText: {
    [THEME_TYPES.DARK]: '#FFFFFF',
    [THEME_TYPES.LIGHT]: '#000000'
  },
  secondaryText: {
    [THEME_TYPES.DARK]: '#A6A6A7',
    [THEME_TYPES.LIGHT]: '#4A4A4A'
  },
  tertiaryText: {
    [THEME_TYPES.DARK]: '#818181',
    [THEME_TYPES.LIGHT]: '#6B6B6B'
  },
  // --- Border tokens --- (kohaku brand values)
  primaryBorder: {
    [THEME_TYPES.DARK]: '#FFFFFF1F',
    [THEME_TYPES.LIGHT]: '#00000030'
  },
  secondaryBorder: {
    [THEME_TYPES.DARK]: '#FFFFFF52',
    [THEME_TYPES.LIGHT]: '#00000050'
  },
  // --- Icon tokens --- (kohaku brand values)
  iconPrimary: {
    [THEME_TYPES.DARK]: '#9E9E9F',
    [THEME_TYPES.LIGHT]: '#4A4A4A'
  },
  /**
   * @deprecated
   */
  iconSecondary: {
    [THEME_TYPES.DARK]: '#9E9E9F',
    [THEME_TYPES.LIGHT]: '#2D2D2D'
  },
  // --- Accent tokens ---
  /**
   * @deprecated - please use primaryAccent
   */
  primary: {
    // (kohaku brand values)
    [THEME_TYPES.DARK]: '#FFFFFF',
    [THEME_TYPES.LIGHT]: '#000000'
  },
  primaryAccent: ACCENT_PRIMITIVES.primaryAccent300,
  primaryAccentHovered: ACCENT_PRIMITIVES.primaryAccent400,
  secondaryAccent: ACCENT_PRIMITIVES.secondaryAccent500,
  secondaryAccentHovered: ACCENT_PRIMITIVES.secondaryAccent400,
  // --- Feedback tokens --- (info tokens carry kohaku brand values)
  infoText: {
    [THEME_TYPES.DARK]: '#D01C15',
    [THEME_TYPES.LIGHT]: '#8B1510'
  },
  infoDecorative: {
    [THEME_TYPES.DARK]: '#D01C15',
    [THEME_TYPES.LIGHT]: '#D01C15'
  },
  infoBackground: {
    [THEME_TYPES.DARK]: '#2a1b1b',
    [THEME_TYPES.LIGHT]: '#FFF5F5'
  },
  successText: FEEDBACK_PRIMITIVES.success400,
  successDecorative: FEEDBACK_PRIMITIVES.success300,
  successBackground: FEEDBACK_PRIMITIVES.success100,
  warningText: FEEDBACK_PRIMITIVES.warning400,
  warningDecorative: FEEDBACK_PRIMITIVES.warning300,
  warningBackground: FEEDBACK_PRIMITIVES.warning100,
  warningDecorative2: {
    [THEME_TYPES.DARK]: '#FBBA27',
    [THEME_TYPES.LIGHT]: '#FBBA27'
  },
  errorText: FEEDBACK_PRIMITIVES.error300,
  errorDecorative: FEEDBACK_PRIMITIVES.error300,
  errorBackground: FEEDBACK_PRIMITIVES.error100,
  // --- Other tokens ---
  backdrop: {
    // (kohaku brand values)
    [THEME_TYPES.DARK]: '#00000095',
    [THEME_TYPES.LIGHT]: hexToRgba('#000000', 0.8)
  },
  shadowPrimary: {
    [THEME_TYPES.LIGHT]: '#2F343D',
    [THEME_TYPES.DARK]: '#101114'
  },
  linkText: {
    // (kohaku brand values)
    [THEME_TYPES.DARK]: '#D01C15',
    [THEME_TYPES.LIGHT]: '#D01C15'
  },
  /**
   * @deprecated
   */
  projectedRewards: {
    [THEME_TYPES.DARK]: '#D7FF00',
    [THEME_TYPES.LIGHT]: '#8B3DFF'
  },
  // --- Kohaku-specific tokens (kohaku) ---
  primary20: {
    [THEME_TYPES.DARK]: '#FFFFFF20',
    [THEME_TYPES.LIGHT]: '#00000020'
  },
  primaryLight: {
    [THEME_TYPES.DARK]: '#2A2A2A',
    [THEME_TYPES.LIGHT]: '#1A1A1A'
  },
  primaryLight80: {
    [THEME_TYPES.DARK]: '#2A2A2A80',
    [THEME_TYPES.LIGHT]: '#1A1A1A80'
  },
  primaryTextInverted: {
    [THEME_TYPES.DARK]: '#000000',
    [THEME_TYPES.LIGHT]: '#FFFFFF'
  },
  kohakuAccent: {
    [THEME_TYPES.DARK]: '#F9F6E9',
    [THEME_TYPES.LIGHT]: '#F9F6E9'
  },
  primaryBackgroundInverted: {
    [THEME_TYPES.DARK]: '#FFFFFF',
    [THEME_TYPES.LIGHT]: '#000000'
  },
  secondaryBackgroundInverted: {
    [THEME_TYPES.DARK]: '#F9F6E9',
    [THEME_TYPES.LIGHT]: '#1A1A1A'
  },
  quaternaryBackground: {
    [THEME_TYPES.DARK]: '#FFFFFF20',
    [THEME_TYPES.LIGHT]: '#00000010'
  },
  quaternaryBackgroundSolid: {
    [THEME_TYPES.DARK]: '#2A2A2A',
    [THEME_TYPES.LIGHT]: '#FAFAF8'
  },
  quinaryBackground: {
    [THEME_TYPES.DARK]: '#0D0D0D',
    [THEME_TYPES.LIGHT]: '#FCFCFA'
  },
  info2Text: {
    [THEME_TYPES.DARK]: '#D01C15',
    [THEME_TYPES.LIGHT]: '#8B1510'
  },
  info2Decorative: {
    [THEME_TYPES.DARK]: '#D01C15',
    [THEME_TYPES.LIGHT]: '#D01C15'
  },
  info2Background: {
    [THEME_TYPES.DARK]: '#D01C151F',
    [THEME_TYPES.LIGHT]: '#D01C1514'
  },
  featureDecorative: {
    [THEME_TYPES.DARK]: '#D01C15',
    [THEME_TYPES.LIGHT]: '#D01C15'
  },
  featureBackground: {
    [THEME_TYPES.DARK]: '#D01C151F',
    [THEME_TYPES.LIGHT]: '#FFF5F5'
  },
  iconPrimary2: {
    [THEME_TYPES.DARK]: '#D01C15',
    [THEME_TYPES.LIGHT]: '#D01C15'
  },
  depositRejectedNotificationBackground: {
    [THEME_TYPES.DARK]: '#FF4D4D',
    [THEME_TYPES.LIGHT]: '#FF4D4D'
  },
  depositRejectedBackground: {
    [THEME_TYPES.DARK]: '#FECACA',
    [THEME_TYPES.LIGHT]: '#FECACA'
  },
  depositRejectedText: {
    [THEME_TYPES.DARK]: '#9b2c2c',
    [THEME_TYPES.LIGHT]: '#9b2c2c'
  },
  depositPendingNotificationBackground: {
    [THEME_TYPES.DARK]: '#097db2',
    [THEME_TYPES.LIGHT]: '#097db2'
  },
  depositPendingBackground: {
    [THEME_TYPES.DARK]: '#bee3f8',
    [THEME_TYPES.LIGHT]: '#bee3f8'
  },
  depositPendingText: {
    [THEME_TYPES.DARK]: '#2c5282',
    [THEME_TYPES.LIGHT]: '#2c5282'
  },
  depositInactiveBackground: {
    [THEME_TYPES.DARK]: '#f7fafc',
    [THEME_TYPES.LIGHT]: '#f7fafc'
  },
  depositInactiveText: {
    [THEME_TYPES.DARK]: '#4a5568',
    [THEME_TYPES.LIGHT]: '#4a5568'
  },
  // --- Tokens consumed by the privacy / railgun UI (kohaku) ---
  muted: {
    [THEME_TYPES.DARK]: '#7F7F7F',
    [THEME_TYPES.LIGHT]: '#6b7280'
  },
  surfaceInput: {
    [THEME_TYPES.DARK]: '#021B26',
    [THEME_TYPES.LIGHT]: '#f5f9fc'
  },
  accent: {
    [THEME_TYPES.DARK]: '#097db2',
    [THEME_TYPES.LIGHT]: '#097db2'
  },
  textPrimary: {
    [THEME_TYPES.DARK]: '#F9F6E9',
    [THEME_TYPES.LIGHT]: '#021b26'
  },
  warning: {
    [THEME_TYPES.DARK]: '#ffa500',
    [THEME_TYPES.LIGHT]: '#ffa500'
  },
  success: {
    [THEME_TYPES.DARK]: '#00C853',
    [THEME_TYPES.LIGHT]: '#00C853'
  },
  danger: {
    [THEME_TYPES.DARK]: '#FF4D4D',
    [THEME_TYPES.LIGHT]: '#FF4D4D'
  }
} as const

type ThemeProps = {
  [key in keyof typeof ThemeColors]: ColorValue
}

// Backwards compatibility
export type { ThemeType, ThemeProps }
export { THEME_TYPES }

export default ThemeColors
