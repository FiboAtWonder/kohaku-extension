import { useCallback } from 'react'

import { DashboardMode } from '@common/controllers/wallet-state'
import useController from '@common/hooks/useController'

/**
 * (kohaku) The dashboard renders either the private (Privacy Pools) or the public
 * (portfolio) view. The choice is persisted by the WalletStateController, so it
 * survives closing and reopening the popup. It defaults to `private`.
 */
const useDashboardMode = () => {
  const {
    state: { dashboardMode },
    dispatch: walletStateDispatch
  } = useController('WalletStateController')

  const setDashboardMode = useCallback(
    (mode: DashboardMode) => {
      walletStateDispatch({
        type: 'method',
        params: {
          method: 'setDashboardMode',
          args: [mode]
        }
      })
    },
    [walletStateDispatch]
  )

  return { dashboardMode, setDashboardMode }
}

export default useDashboardMode
