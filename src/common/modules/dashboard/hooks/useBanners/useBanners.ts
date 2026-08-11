import { useMemo } from 'react'

import {
  defiPositionsOnDisabledNetworksBannerId,
  getCurrentAccountBanners
} from '@ambire-common/libs/banners/banners'
import useController from '@common/hooks/useController'
import useOtaUpdateBanner from '@common/modules/dashboard/hooks/useOtaUpdateBanner'
// (kohaku) allows hiding banners that don't apply to the Kohaku build
import { filterDisabledBanners } from '@web/config/disabledBanners'

import type { Banner as BannerInterface } from '@ambire-common/interfaces/banner'
const OFFLINE_BANNER: BannerInterface = {
  id: 'offline-banner',
  type: 'error',
  title: 'Network Issue',
  text: 'Your network connection is too slow or you may be offline. Please check your internet connection.',
  actions: [
    {
      actionName: 'reload-selected-account',
      label: 'Retry'
    }
  ]
}

export default function useBanners(): [BannerInterface[], BannerInterface[]] {
  const { isOffline } = useController('MainController').state
  const { bannersData: marketingBannersData } = useController('BannerController').state
  const {
    state: {
      account,
      portfolio,
      deprecatedSmartAccountBanner,
      banners: selectedAccountBanners = []
    }
  } = useController('SelectedAccountController')

  const { banners: emailVaultBanners = [] } = useController('EmailVaultController').state
  const { banners: requestBanners = [] } = useController('RequestsController').state
  const { extensionUpdateBanner } = useController('ExtensionUpdateController').state
  const { hasFundedHotAccount } = useController('PortfolioController').state
  const otaUpdateBanner = useOtaUpdateBanner()

  const marketingBanners = useMemo(() => {
    return marketingBannersData.banners.filter(
      // if the banner is not a survey banner there is no need to hide it
      // but for surveys we have other requirements that are acc specific
      // the acc comparing is used to hide the fact that banners are not updated at the
      // selected same time as the acc
      (b) => b.actions[0]?.actionName !== 'survey' || marketingBannersData.account === account?.addr
    )
  }, [account?.addr, marketingBannersData.account, marketingBannersData.banners])

  const controllerBanners = useMemo(() => {
    // (kohaku) wrapped in filterDisabledBanners
    return filterDisabledBanners([
      ...(deprecatedSmartAccountBanner || []),
      ...(requestBanners || []),
      ...(isOffline && portfolio.isAllReady ? [OFFLINE_BANNER] : []),
      // (kohaku) Swap & Bridge is disabled, so its banners are never shown
      ...getCurrentAccountBanners(
        hasFundedHotAccount ? emailVaultBanners || [] : [],
        account?.addr
      ),
      // The defi-positions banner renders inside the DeFi tab, not the general dashboard.
      ...getCurrentAccountBanners(selectedAccountBanners || [], account?.addr).filter(
        (b) => b.id !== defiPositionsOnDisabledNetworksBannerId
      ),
      ...(extensionUpdateBanner || []),
      ...otaUpdateBanner
    ])
  }, [
    deprecatedSmartAccountBanner,
    requestBanners,
    isOffline,
    portfolio.isAllReady,
    hasFundedHotAccount,
    emailVaultBanners,
    selectedAccountBanners,
    account?.addr,
    extensionUpdateBanner,
    otaUpdateBanner
  ])

  return [controllerBanners, filterDisabledBanners(marketingBanners)]
}
