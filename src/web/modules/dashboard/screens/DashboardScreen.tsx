import React, { FC, useCallback } from 'react'

import { DashboardMode } from '@common/controllers/wallet-state'
import useNavigation from '@common/hooks/useNavigation'
import useDashboardMode from '@common/modules/dashboard/hooks/useDashboardMode'
import { WEB_ROUTES } from '@common/modules/router/constants/common'
import PrivateDashboardView from '@web/modules/PPv1/screens/dashboard/screens'

import PublicDashboardView from './PublicDashboardView'

type Props = {
  /**
   * (kohaku) The `dashboard` and `public` routes are kept as deep links into a
   * specific mode. They only preselect the view for as long as the user stays on
   * them - they don't overwrite the persisted preference, so being bounced to the
   * public dashboard after e.g. a transfer doesn't change what the landing screen
   * (`mainDashboard`) opens in.
   */
  mode?: DashboardMode
}

/**
 * (kohaku) The single dashboard entry. It renders either the private (Privacy
 * Pools) or the public (portfolio) view. The mode defaults to private and is
 * persisted by the WalletStateController.
 */
const DashboardScreen: FC<Props> = ({ mode }) => {
  const { dashboardMode, setDashboardMode } = useDashboardMode()
  const { navigate } = useNavigation()

  const activeMode = mode ?? dashboardMode

  const onDashboardModeChange = useCallback(
    (nextMode: DashboardMode) => {
      setDashboardMode(nextMode)

      // Leaving a deep-linked mode behind, so that the toggle isn't overridden
      // by the route on the next render
      if (mode && mode !== nextMode) navigate(WEB_ROUTES.mainDashboard, { replace: true })
    },
    [mode, navigate, setDashboardMode]
  )

  if (activeMode === 'public') {
    return (
      <PublicDashboardView
        dashboardMode={activeMode}
        onDashboardModeChange={onDashboardModeChange}
      />
    )
  }

  return (
    <PrivateDashboardView
      dashboardMode={activeMode}
      onDashboardModeChange={onDashboardModeChange}
    />
  )
}

export default React.memo(DashboardScreen)
