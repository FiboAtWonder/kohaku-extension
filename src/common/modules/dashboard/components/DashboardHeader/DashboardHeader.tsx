import React from 'react'
import { Animated, Pressable, View } from 'react-native'
import { useModalize } from 'react-native-modalize'

import BurgerIcon from '@common/assets/svg/BurgerIcon'
import NetworkStatusesIcon from '@common/assets/svg/NetworkStatusIcon'
import Text from '@common/components/Text'
import { isAmbireNext, isDev, isMobile } from '@common/config/env'
import { useTranslation } from '@common/config/localization'
import useController from '@common/hooks/useController'
import useHover from '@common/hooks/useHover'
import useNavigation from '@common/hooks/useNavigation'
import { ROUTES, WEB_ROUTES } from '@common/modules/router/constants/common'
import spacings from '@common/styles/spacings'
import flexbox from '@common/styles/utils/flexbox'
import { getUiType } from '@common/utils/uiType'

import NetworkStatusesBottomSheet from '../NetworkStatusesBottomSheet'
import AccountButton from './AccountButton'

const { isPopup } = getUiType()

const SHOULD_DISPLAY_NETWORK_STATUSES = isAmbireNext || isDev

const DashboardHeader = () => {
  const {
    state: { account }
  } = useController('SelectedAccountController')
  const { t } = useTranslation()
  const [bindBurgerAnim, burgerAnimStyle] = useHover({ preset: 'opacityInverted', duration: 50 })
  // Takes the user back to the private dashboard, which is the landing screen (kohaku)
  const [bindDashboardAnim, dashboardAnimStyle] = useHover({ preset: 'opacity' })
  const [bindNetworkStatusesAnim, networkStatusesAnimStyle] = useHover({
    preset: 'opacityInverted',
    duration: 50
  })
  const { navigate } = useNavigation()

  const {
    ref: networkStatusesSheetRef,
    open: openNetworkStatusesSheet,
    close: closeNetworkStatusesSheet
  } = useModalize()

  if (!account) return null

  return (
    <View style={[flexbox.directionRow, flexbox.alignCenter, { width: '100%' }]}>
      {SHOULD_DISPLAY_NETWORK_STATUSES && (
        <NetworkStatusesBottomSheet
          sheetRef={networkStatusesSheetRef}
          closeBottomSheet={closeNetworkStatusesSheet}
        />
      )}
      <View style={[flexbox.directionRow, flexbox.flex1, flexbox.justifySpaceBetween]}>
        <AccountButton />
        <View style={[flexbox.directionRow, flexbox.alignStart]}>
          <Pressable
            testID="dashboard-home-btn"
            style={[spacings.ml, spacings.phTy, spacings.pvTy, flexbox.alignSelfCenter]}
            onPress={() => navigate(WEB_ROUTES.mainDashboard)}
            {...bindDashboardAnim}
          >
            <Animated.View style={dashboardAnimStyle}>
              <Text fontSize={14} weight="medium" appearance="secondaryText">
                {t('Back To Dashboard')}
              </Text>
            </Animated.View>
          </Pressable>

          {SHOULD_DISPLAY_NETWORK_STATUSES && (
            <Pressable
              style={[flexbox.justifyCenter, flexbox.alignCenter, { width: 40, height: 40 }]}
              onPress={() => openNetworkStatusesSheet()}
              {...bindNetworkStatusesAnim}
            >
              <Animated.View style={networkStatusesAnimStyle}>
                <NetworkStatusesIcon width={20} height={20} color="#FFFFFF" />
              </Animated.View>
            </Pressable>
          )}

          <Pressable
            testID="dashboard-hamburger-btn"
            style={[
              spacings.mlTy,
              flexbox.justifyCenter,
              flexbox.alignCenter,
              {
                borderRadius: 50,
                width: 40,
                height: 40,
                backgroundColor: '#000000A3'
              },
              isMobile && {
                borderWidth: 1,
                borderColor: '#FFFFFF1F'
              }
            ]}
            onPress={() => {
              isPopup || isMobile ? navigate(ROUTES.menu) : navigate(WEB_ROUTES.generalSettings)
            }}
            {...bindBurgerAnim}
          >
            <Animated.View style={burgerAnimStyle}>
              <BurgerIcon color="#FFFFFF" width={28} height={28} />
            </Animated.View>
          </Pressable>
        </View>
      </View>
    </View>
  )
}

export default React.memo(DashboardHeader)
