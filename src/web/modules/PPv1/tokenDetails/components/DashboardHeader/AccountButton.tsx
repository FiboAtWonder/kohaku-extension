import React from 'react'
import { Animated, View } from 'react-native'

import RightArrowIcon from '@common/assets/svg/RightArrowIcon'
import Avatar from '@common/components/Avatar'
import Text from '@common/components/Text'
import useNavigation from '@common/hooks/useNavigation'
import useTheme from '@common/hooks/useTheme'
import { WEB_ROUTES } from '@common/modules/router/constants/common'
import spacings from '@common/styles/spacings'
import { THEME_TYPES } from '@common/styles/themeConfig'
import flexboxStyles from '@common/styles/utils/flexbox'
import { AnimatedPressable, useCustomHover } from '@common/hooks/useHover'

import { NEUTRAL_BACKGROUND_HOVERED } from '../../screens/styles'
import getStyles from './styles'
import useController from '@common/hooks/useController'

const AccountButton = () => {
  const { navigate } = useNavigation()
  const { theme, styles, themeType } = useTheme(getStyles)

  const { account } = useController('SelectedAccountController').state
  const [bindAccountBtnAnim, accountBtnAnimStyle, isAccountBtnHovered] = useCustomHover({
    property: 'left',
    values: {
      from: 0,
      to: 4
    }
  })

  if (!account) return null

  return (
    <View style={[flexboxStyles.directionRow, flexboxStyles.alignCenter]}>
      <AnimatedPressable
        testID="account-select-btn"
        style={[
          styles.accountButton,
          {
            backgroundColor: isAccountBtnHovered
              ? NEUTRAL_BACKGROUND_HOVERED
              : NEUTRAL_BACKGROUND_HOVERED
          }
        ]}
        onPress={() => navigate(WEB_ROUTES.accountSelect)}
        {...bindAccountBtnAnim}
      >
        <>
          <View style={styles.accountButtonInfo}>
            <Avatar
              address={account.addr}
              pfp=""
              size={32}
              smartAccountType={(account.creation && 'Ambire') || (account.safeCreation && 'Safe')}
            />
            <Text
              numberOfLines={1}
              weight="semiBold"
              style={[spacings.mlTy, spacings.mrTy]}
              color={
                themeType === THEME_TYPES.DARK
                  ? theme.primaryBackgroundInverted
                  : theme.primaryBackground
              }
              fontSize={14}
            >
              Private Account
            </Text>
          </View>
          <Animated.View style={accountBtnAnimStyle}>
            <RightArrowIcon
              style={styles.accountButtonRightIcon}
              width={12}
              color={
                themeType === THEME_TYPES.DARK
                  ? theme.primaryBackgroundInverted
                  : theme.primaryBackground
              }
            />
          </Animated.View>
        </>
      </AnimatedPressable>
    </View>
  )
}

export default React.memo(AccountButton)
