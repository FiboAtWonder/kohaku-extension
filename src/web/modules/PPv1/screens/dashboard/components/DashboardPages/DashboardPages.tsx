import { nanoid } from 'nanoid'
import React, { useEffect, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import {
  Animated,
  NativeScrollEvent,
  NativeSyntheticEvent,
  StyleProp,
  View,
  ViewStyle
} from 'react-native'
import { useSearchParams } from 'react-router-dom'

import usePrevious from '@common/hooks/usePrevious'
import useRoute from '@common/hooks/useRoute'
import spacings from '@common/styles/spacings'
import flexbox from '@common/styles/utils/flexbox'
import { getUiType } from '@common/utils/uiType'

import Activity from '../Activity'
// import Sends from '../Transfers'
// import Deposits from '../Deposits'
import Tokens from '../Tokens'
import { TabType } from '../TabsAndSearch/Tabs/Tab/Tab'
import useController from '@common/hooks/useController'

interface Props {
  onScroll: (event: NativeSyntheticEvent<NativeScrollEvent>) => void
  animatedOverviewHeight: Animated.Value
  generalViewStyle?: StyleProp<ViewStyle>
}

const { isTab } = getUiType()

const DashboardPages = ({ onScroll, animatedOverviewHeight, generalViewStyle }: Props) => {
  const { t } = useTranslation()
  const route = useRoute()
  const [sessionId] = useState(nanoid())
  const [, setSearchParams] = useSearchParams()
  const { dashboardNetworkFilter } = useController('SelectedAccountController').state
  const { networks } = useController('NetworksController').state
  const { dispatch: activityDispatch } = useController('ActivityController')

  const [openTab, setOpenTab] = useState(() => {
    const params = new URLSearchParams(route?.search)

    return (params.get('tab') as TabType) || 'tokens'
  })
  const prevOpenTab = usePrevious(openTab)
  // To prevent initial load of all tabs but load them when requested by the user
  // Persist the rendered list of items for each tab once opened
  // This technique improves the initial loading speed of the dashboard
  const [initTab, setInitTab] = useState<{
    [key: string]: boolean
  }>({})

  const dashboardNetworkFilterName = useMemo(() => {
    if (!dashboardNetworkFilter) return null

    if (dashboardNetworkFilter === 'rewards') return t('Rewards')
    if (dashboardNetworkFilter === 'gasTank') return t('Gas Tank')

    const network = networks.find(({ chainId }) => chainId === BigInt(dashboardNetworkFilter))

    return network?.name || null
  }, [dashboardNetworkFilter, networks, t])

  useEffect(() => {
    if (openTab !== prevOpenTab && !initTab?.[openTab]) {
      setInitTab((prev) => ({ ...prev, [openTab]: true }))
    }
  }, [openTab, prevOpenTab, initTab])

  useEffect(() => {
    // Initialize the port session. This is necessary to automatically terminate the session when the tab is closed.
    // The process is managed in the background using port.onDisconnect,
    // as there is no reliable window event triggered when a tab is closed.
    setSearchParams((prev) => {
      prev.set('sessionId', sessionId)
      return prev
    })

    return () => {
      // Remove session - this will be triggered only when navigation to another screen internally in the extension.
      // The session removal when the window is forcefully closed is handled
      // in the port.onDisconnect callback in the background.
      activityDispatch({
        type: 'method',
        params: { method: 'resetAccountsOpsFilters', args: [sessionId] }
      })
    }
    // setSearchParams must not be in the dependency array
    // as it changes on call and kills the session prematurely
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activityDispatch, sessionId])

  return (
    <View style={[flexbox.flex1, isTab ? spacings.phSm : {}]}>
      <Tokens
        openTab={openTab}
        sessionId={sessionId}
        setOpenTab={setOpenTab}
        onScroll={onScroll}
        initTab={initTab}
        dashboardNetworkFilterName={dashboardNetworkFilterName}
        animatedOverviewHeight={animatedOverviewHeight}
        style={generalViewStyle}
      />
      <Activity
        openTab={openTab}
        sessionId={sessionId}
        setOpenTab={setOpenTab}
        onScroll={onScroll}
        initTab={initTab}
        dashboardNetworkFilterName={dashboardNetworkFilterName}
        animatedOverviewHeight={animatedOverviewHeight}
      />
      {/* <Deposits
        openTab={openTab}
        sessionId={sessionId}
        setOpenTab={setOpenTab}
        onScroll={onScroll}
        initTab={initTab}
        dashboardNetworkFilterName={dashboardNetworkFilterName}
        animatedOverviewHeight={animatedOverviewHeight}
      />
      <Sends
        openTab={openTab}
        sessionId={sessionId}
        setOpenTab={setOpenTab}
        onScroll={onScroll}
        initTab={initTab}
        dashboardNetworkFilterName={dashboardNetworkFilterName}
        animatedOverviewHeight={animatedOverviewHeight}
      /> */}
    </View>
  )
}

export default React.memo(DashboardPages)
