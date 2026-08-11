import React from 'react'
import { View } from 'react-native'

import ExploreIcon from '@common/assets/svg/ExploreIcon'
import ReceiveIcon from '@common/assets/svg/ReceiveIcon'
import SendIcon from '@common/assets/svg/SendIcon'
import SwapAndBridgeIcon from '@common/assets/svg/SwapAndBridgeIcon'
import KohakuLogo from '@common/components/HokahuLogo'
import { isMobile } from '@common/config/env'
import { useTranslation } from '@common/config/localization'
import { ROUTES } from '@common/modules/router/constants/common'
import flexbox from '@common/styles/utils/flexbox'

import RouteItem from './RouteItem'
import { RouteItemType } from './RouteItem/RouteItem'

// The logo is rendered as-is, so it ignores the `color` prop RouteItem passes to icons (kohaku)
const ShieldFundsIcon = ({ height, width }: { height?: number; width?: number }) => (
  <KohakuLogo height={height} width={width} />
)

const Routes = () => {
  const { t } = useTranslation()

  const routeItems: RouteItemType[] = [
    // Entry point to the Privacy Pools shielding flow (kohaku)
    {
      testID: 'dashboard-button-privacy-pools',
      icon: ShieldFundsIcon,
      label: t('Shield Funds'),
      route: ROUTES.pp1Deposit,
      scale: 1.08,
      scaleOnHover: 1.18
    },
    {
      testID: 'dashboard-button-send',
      icon: SendIcon,
      label: t('Send'),
      route: ROUTES.transfer,
      scale: 1.08,
      scaleOnHover: 1.18
    },
    ...(isMobile
      ? [
          {
            testID: 'dashboard-button-receive',
            icon: ReceiveIcon,
            label: t('Receive'),
            route: ROUTES.receive,
            scale: 1.08,
            scaleOnHover: 1.18
          }
        ]
      : []),
    {
      testID: 'dashboard-button-swap-and-bridge',
      icon: SwapAndBridgeIcon,
      label: t('Swap & Bridge'),
      route: ROUTES.swapAndBridge,
      scale: 0.95,
      scaleOnHover: 1
    },
    {
      testID: 'dashboard-button-explore',
      icon: ExploreIcon,
      label: t('Explore'),
      route: ROUTES.explore,
      scale: 0.95,
      scaleOnHover: 1.02
    }
  ]

  return (
    <View style={[flexbox.directionRow]}>
      {routeItems.map((routeItem, index) => (
        <RouteItem
          key={routeItem.label}
          routeItem={routeItem}
          index={index}
          routeItemsLength={routeItems.length}
        />
      ))}
    </View>
  )
}

export default React.memo(Routes)
