import { useMemo } from 'react'

import { AccountId } from '@ambire-common/interfaces/account'
import { Banner as BannerInterface } from '@ambire-common/interfaces/banner'
import { filterDisabledBanners } from '@web/config/disabledBanners'
import useController from '@common/hooks/useController'

const getCurrentAccountBanners = (banners: BannerInterface[], selectedAccount?: AccountId) =>
  banners.filter((banner) => {
    if (!banner.meta?.accountAddr) return true

    return banner.meta.accountAddr === selectedAccount
  })

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
  const { account, portfolio, deprecatedSmartAccountBanner } = useController(
    'SelectedAccountController'
  ).state

  const { banners: activityBanners = [] } = useController('ActivityController').state
  const { banners: emailVaultBanners = [] } = useController('EmailVaultController').state
  const { banners: requestBanners = [] } = useController('RequestsController').state
  const { banners: actionBanners = [] } = useController('RequestsController').state
  const { banners: swapAndBridgeBanners = [] } = useController('SwapAndBridgeController').state
  const { extensionUpdateBanner } = useController('ExtensionUpdateController').state
  const { banners: selectedAccountBanners } = useController('SelectedAccountController').state

  const controllerBanners = useMemo(() => {
    return filterDisabledBanners([
      ...deprecatedSmartAccountBanner,
      ...requestBanners,
      ...actionBanners,
      ...(isOffline && portfolio.isAllReady ? [OFFLINE_BANNER] : []),
      ...(isOffline ? [] : [...swapAndBridgeBanners]),
      ...activityBanners,
      ...getCurrentAccountBanners(emailVaultBanners, account?.addr),
      ...selectedAccountBanners,
      ...extensionUpdateBanner
    ])
  }, [
    deprecatedSmartAccountBanner,
    requestBanners,
    actionBanners,
    isOffline,
    portfolio.isAllReady,
    swapAndBridgeBanners,
    activityBanners,
    emailVaultBanners,
    account?.addr,
    selectedAccountBanners,
    extensionUpdateBanner
  ])

  return [controllerBanners, filterDisabledBanners(marketingBannersData.banners)]
}
