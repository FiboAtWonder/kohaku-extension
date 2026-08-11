import { StyleSheet, TextStyle, ViewStyle } from 'react-native'

import spacings, { SPACING_MI } from '@common/styles/spacings'
import { THEME_TYPES, ThemeProps, ThemeType } from '@common/styles/themeConfig'
import { BORDER_RADIUS_PRIMARY } from '@common/styles/utils/common'
import flexbox from '@common/styles/utils/flexbox'
import text from '@common/styles/utils/text'

interface Style {
  container: ViewStyle
  option: ViewStyle
  optionSelected: ViewStyle
  label: TextStyle
  labelSelected: TextStyle
}

const getStyles = (theme: ThemeProps, themeType: ThemeType) =>
  StyleSheet.create<Style>({
    container: {
      ...flexbox.directionRow,
      ...flexbox.alignCenter,
      padding: SPACING_MI / 2,
      borderRadius: BORDER_RADIUS_PRIMARY,
      backgroundColor:
        themeType === THEME_TYPES.DARK ? theme.secondaryBackground : theme.tertiaryBackground
    },
    option: {
      ...spacings.pvMi,
      ...spacings.phSm,
      ...flexbox.center,
      borderRadius: BORDER_RADIUS_PRIMARY
    },
    optionSelected: {
      backgroundColor: theme.primaryBackground
    },
    label: {
      ...text.center,
      color: theme.secondaryText
    },
    labelSelected: {
      color: themeType === THEME_TYPES.DARK ? theme.primary : theme.primaryText
    }
  })

export default getStyles
