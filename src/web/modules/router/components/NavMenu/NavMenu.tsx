import React, { useCallback, useEffect, useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import { View } from 'react-native'

import AmbireLogoSquare from '@common/assets/svg/AmbireLogoSquare'
import LockIcon from '@common/assets/svg/LockIcon'
import MaximizeIcon from '@common/assets/svg/MaximizeIcon'
import SettingsIcon from '@common/assets/svg/SettingsIcon'
import BackButton from '@common/components/BackButton'
import Button from '@common/components/Button'
import { createGlobalTooltipDataSet } from '@common/components/GlobalTooltip'
import Text from '@common/components/Text'
import { AUTO_LOCK_OPTIONS } from '@common/constants/autoLock'
import useController from '@common/hooks/useController'
import { AnimatedPressable, useCustomHover } from '@common/hooks/useHover'
import useNavigation from '@common/hooks/useNavigation'
import { syncSessionStorage } from '@common/services/storage'
import useTheme from '@common/hooks/useTheme'
import { HeaderWithTitle } from '@common/modules/header/components/Header/Header'
import { ROUTES, WEB_ROUTES } from '@common/modules/router/constants/common'
import SettingsLink from '@common/modules/settings/components/SettingsLink'
import spacings from '@common/styles/spacings'
import { BORDER_RADIUS_PRIMARY, hexToRgba } from '@common/styles/utils/common'
import flexbox from '@common/styles/utils/flexbox'
import { openInTab } from '@common/utils/links'
import { getUiType } from '@common/utils/uiType'
import {
  TabLayoutContainer,
  tabLayoutWidths,
  TabLayoutWrapperMainContent
} from '@web/components/TabLayoutWrapper/TabLayoutWrapper'
import commonWebStyles from '@web/styles/utils/common'
import { SKIP_AUTO_BIOMETRICS_PROMPT_ONCE } from '@web/modules/keystore/constants'

import getStyles from './styles'

// @TODO (kohaku) The upstream "Help center" and "Report an issue" links pointed at
// help.ambire.com, and a `SOCIAL` section linked Ambire's X/Telegram/Discord. Both were
// removed with the rebrand. Add the Kohaku equivalents here once they exist.
const OTHER_LINKS = [
  {
    key: 'about',
    Icon: AmbireLogoSquare,
    label: 'About',
    path: ROUTES.settingsAbout
  }
]

const { isTab } = getUiType()
const expandViewTooltipId = 'expand-view-tooltip'

const NavMenu = () => {
  const { t } = useTranslation()
  const { navigate } = useNavigation()
  const { theme } = useTheme(getStyles)
  const { dispatch: mainDispatch } = useController('MainController')
  const { hasPasswordSecret } = useController('KeystoreController').state

  const handleLockAmbire = useCallback(() => {
    syncSessionStorage.set(SKIP_AUTO_BIOMETRICS_PROMPT_ONCE, 'true')
    mainDispatch({ type: 'method', params: { method: 'lock', args: [] } })
  }, [mainDispatch])

  const handleGoToDevicePasswordSet = useCallback(() => {
    navigate(WEB_ROUTES.devicePasswordSet)
  }, [navigate])

  const {
    state: { autoLockTime }
  } = useController('AutoLockController')

  const [bindLockAnim, lockAnimStyle] = useCustomHover({
    property: 'backgroundColor',
    values: {
      from: hexToRgba(theme.secondaryBackground, 0),
      to: theme.secondaryBackground
    }
  })

  const selectedOption = useMemo(() => {
    return AUTO_LOCK_OPTIONS.find((option) => option.value === autoLockTime) || AUTO_LOCK_OPTIONS[0]
  }, [autoLockTime])

  const lockLabel = hasPasswordSecret ? t('Lock Wallet') : t('Set extension password')
  const lockActionLabel = hasPasswordSecret ? selectedOption?.label || '' : t('Create')

  useEffect(() => {
    if (isTab) {
      navigate('accounts')
    }
  }, [navigate])

  return (
    <TabLayoutContainer
      hideFooterInPopup
      width="full"
      footer={<BackButton />}
      footerStyle={{ maxWidth: tabLayoutWidths.xl }}
      header={
        <HeaderWithTitle title={t('Menu')}>
          <View style={[flexbox.directionRow, flexbox.alignCenter]}>
            <Button
              type="ghost2"
              size="small"
              hasBottomSpacing={false}
              onPress={() =>
                openInTab({
                  url: `tab.html#/${WEB_ROUTES.mainDashboard}`,
                  shouldCloseCurrentWindow: true
                })
              }
            >
              <MaximizeIcon
                color={theme.iconPrimary}
                dataSet={createGlobalTooltipDataSet({
                  id: expandViewTooltipId,
                  content: t('Expand view')
                })}
                width={24}
                height={24}
              />
            </Button>
          </View>
        </HeaderWithTitle>
      }
      style={spacings.ph0}
      withHorizontalPadding={false}
    >
      <TabLayoutWrapperMainContent contentContainerStyle={spacings.pbLg}>
        <View style={[commonWebStyles.contentContainer, flexbox.flex1]}>
          <View style={flexbox.flex1}>
            <View
              style={[
                spacings.pbSm,
                spacings.phSm,
                {
                  borderBottomWidth: 1,
                  borderBottomColor: theme.primaryBorder
                }
              ]}
            >
              <SettingsLink
                Icon={SettingsIcon}
                label="Settings"
                path={ROUTES.generalSettings}
                isActive={false}
                key="settings"
              />
            </View>
            <View
              style={[
                spacings.pvSm,
                spacings.phSm,
                {
                  borderBottomWidth: 1,
                  borderBottomColor: theme.primaryBorder
                }
              ]}
            >
              {OTHER_LINKS.map(({ Icon, ...link }) => (
                <SettingsLink {...link} Icon={Icon} key={link.key} isActive={false} />
              ))}
            </View>

            <View style={[spacings.ptSm, spacings.phSm]}>
              <AnimatedPressable
                onPress={hasPasswordSecret ? handleLockAmbire : handleGoToDevicePasswordSet}
                style={[
                  flexbox.directionRow,
                  flexbox.justifySpaceBetween,
                  flexbox.alignCenter,
                  spacings.phSm,
                  spacings.pv,
                  flexbox.flex1,
                  spacings.ptSm,
                  spacings.phSm,

                  {
                    borderRadius: BORDER_RADIUS_PRIMARY
                  },
                  lockAnimStyle
                ]}
                {...bindLockAnim}
              >
                <View style={[flexbox.directionRow, flexbox.alignCenter]}>
                  <LockIcon width={24} height={24} color={theme.iconPrimary} />
                  <Text style={spacings.mlSm} weight="medium">
                    {lockLabel}
                  </Text>
                </View>

                <Text appearance="tertiaryText">
                  {t('Auto lock')}: {lockActionLabel}
                </Text>
              </AnimatedPressable>
            </View>
          </View>
        </View>
      </TabLayoutWrapperMainContent>
    </TabLayoutContainer>
  )
}

export default React.memo(NavMenu)
