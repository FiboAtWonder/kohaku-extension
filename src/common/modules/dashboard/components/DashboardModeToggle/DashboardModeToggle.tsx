import React, { FC, useCallback, useMemo } from 'react'
import { View, ViewStyle } from 'react-native'

import Text from '@common/components/Text'
import { useTranslation } from '@common/config/localization'
import { DashboardMode } from '@common/controllers/wallet-state'
import useHover, { AnimatedPressable } from '@common/hooks/useHover'
import useTheme from '@common/hooks/useTheme'

import getStyles from './styles'

type OptionProps = {
  mode: DashboardMode
  label: string
  isSelected: boolean
  onChange: (mode: DashboardMode) => void
  testID: string
}

const DashboardModeOption = React.memo(
  ({ mode, label, isSelected, onChange, testID }: OptionProps) => {
    const { styles } = useTheme(getStyles)
    const [bindAnim, animStyle] = useHover({ preset: 'opacityInverted' })

    const onPress = useCallback(() => onChange(mode), [mode, onChange])

    return (
      <AnimatedPressable
        testID={testID}
        disabled={isSelected}
        onPress={onPress}
        style={[styles.option, isSelected && styles.optionSelected, animStyle]}
        {...bindAnim}
      >
        <Text
          fontSize={12}
          weight={isSelected ? 'medium' : 'regular'}
          shouldScale={false}
          style={[styles.label, isSelected && styles.labelSelected]}
        >
          {label}
        </Text>
      </AnimatedPressable>
    )
  }
)

DashboardModeOption.displayName = 'DashboardModeOption'

type Props = {
  mode: DashboardMode
  onChange: (mode: DashboardMode) => void
  style?: ViewStyle
  testID?: string
}

/**
 * (kohaku) Switches the dashboard between the private (Privacy Pools) and the
 * public (portfolio) view. Controlled - the selected mode is owned and persisted
 * by the dashboard screen.
 */
const DashboardModeToggle: FC<Props> = ({ mode, onChange, style, testID }) => {
  const { t } = useTranslation()
  const { styles } = useTheme(getStyles)

  const options = useMemo(
    () => [
      { value: 'private' as DashboardMode, label: t('Private'), testID: 'dashboard-mode-private' },
      { value: 'public' as DashboardMode, label: t('Public'), testID: 'dashboard-mode-public' }
    ],
    [t]
  )

  return (
    <View style={[styles.container, style]} testID={testID}>
      {options.map((option) => (
        <DashboardModeOption
          key={option.value}
          mode={option.value}
          label={option.label}
          testID={option.testID}
          isSelected={option.value === mode}
          onChange={onChange}
        />
      ))}
    </View>
  )
}

export default React.memo(DashboardModeToggle)
