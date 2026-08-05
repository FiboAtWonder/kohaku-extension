import React, { FC, useCallback, useEffect, useMemo, useRef } from 'react'
import { ScrollView, View, Pressable } from 'react-native'

import formatDecimals from '@ambire-common/utils/formatDecimals/formatDecimals'
import Text from '@common/components/Text/Text'
import { DashboardMode } from '@common/controllers/wallet-state'
import useNavigation from '@common/hooks/useNavigation'
import useTheme from '@common/hooks/useTheme'
import { WEB_ROUTES } from '@common/modules/router/constants/common'
import spacings from '@common/styles/spacings'
import { usePrivacyPoolsDepositForm } from '@web/hooks/useDepositForm'
import useRailgunForm from '@web/modules/railgun/hooks/useRailgunForm'
import { getUiType } from '@common/utils/uiType'

import RefreshIcon from '@common/modules/dashboard/components/DashboardOverview/RefreshIcon'
import flexbox from '@common/styles/utils/flexbox'
import useToast from '@common/hooks/useToast'
import DAppFooter from '../components/DAppFooter'
import PendingActionWindowModal from '../components/PendingActionWindowModal'
import NewPrivateActionButtons from './PrivateActionButtons'
import NewDashboardHeader from './DashboardHeader'
import NewFundsCards from './FundsCards'
import PageContentArea from './PageContentArea'
import usePublicBalanceCache from './usePublicBalanceCache'
import { ActiveView } from './types'
import NewSelectedPublicAccountDetail from './SelectedPublicAccountDetail'
import NewPublicAccounts from './PublicAccounts'
import NewDisplayBalance from './DisplayBalance'
import useController from '@common/hooks/useController'

const { isPopup } = getUiType()

export const OVERVIEW_CONTENT_MAX_HEIGHT = 120

type Props = {
  // (kohaku) the merged dashboard owns the mode; the toggle lives in the header
  dashboardMode: DashboardMode
  onDashboardModeChange: (mode: DashboardMode) => void
}

const PrivateDashboardView: FC<Props> = ({ dashboardMode, onDashboardModeChange }) => {
  const { addToast } = useToast()
  const { theme } = useTheme()
  const { navigate } = useNavigation()
  // The receive modal became a standalone route upstream (kohaku)
  const openReceiveModal = useCallback(() => {
    navigate(WEB_ROUTES.receive)
  }, [navigate])

  const { account, portfolio } = useController('SelectedAccountController').state
  const { accounts } = useController('AccountsController').state
  const scrollViewRef = useRef<ScrollView>(null)
  const cachedPrivateBalanceRef = useRef<number>(0)
  // (kohaku) the in-screen view switch and the header toggle are now the same
  // control - the public mode renders the public dashboard instead of this screen
  const activeView: ActiveView = dashboardMode

  const privacyPoolsForm = usePrivacyPoolsDepositForm()
  const railgunForm = useRailgunForm()

  const { balanceCache, isLoadingPublicBalances, refreshPublicBalances } = usePublicBalanceCache({
    accounts,
    accountAddr: account?.addr,
    portfolioIsAllReady: portfolio?.isAllReady,
    portfolioTotalBalance: portfolio?.totalBalance
  })

  const totalPublicBalance = useMemo(
    () => Object.values(balanceCache).reduce((sum, bal) => sum + bal, 0),
    [balanceCache]
  )

  const livePrivateBalance =
    (privacyPoolsForm.totalPrivatePortfolio || 0) + (railgunForm.totalPrivatePortfolio || 0)

  if (livePrivateBalance > 0) cachedPrivateBalanceRef.current = livePrivateBalance

  const privateBalance = cachedPrivateBalanceRef.current
  const totalHoldings = totalPublicBalance + privateBalance

  const [displayedInteger = '', displayedDecimal = ''] = useMemo(
    () => formatDecimals(totalHoldings, 'value').split('.'),
    [totalHoldings]
  )

  const [privateInteger = '', privateDecimal = ''] = useMemo(
    () => formatDecimals(privateBalance, 'value').split('.'),
    [privateBalance]
  )

  const [publicInteger = '', publicDecimal = ''] = useMemo(
    () => formatDecimals(totalPublicBalance, 'value').split('.'),
    [totalPublicBalance]
  )

  const handleAddMoney = useCallback(() => navigate(WEB_ROUTES.pp1Deposit), [navigate])
  const changeView = useCallback(
    (view: ActiveView) => {
      onDashboardModeChange(view)
    },
    [onDashboardModeChange]
  )

  const handleRefreshAll = useCallback(() => {
    privacyPoolsForm.refreshPrivateAccount()
    railgunForm.refreshPrivateAccount()
    refreshPublicBalances()
  }, [
    privacyPoolsForm.refreshPrivateAccount,
    railgunForm.refreshPrivateAccount,
    refreshPublicBalances
  ])

  const handleRetryLoadPrivateAccount = useCallback(() => {
    privacyPoolsForm.refreshPrivateAccount()
    railgunForm.refreshPrivateAccount()
  }, [privacyPoolsForm.refreshPrivateAccount, railgunForm.refreshPrivateAccount])

  useEffect(() => {
    // safe not to check sync state because the base function (sync) checks this
    if (privacyPoolsForm.isReady && !privacyPoolsForm.isLoading) {
      privacyPoolsForm.loadPrivateAccount().catch((error) => {
        console.error('Failed to load private account:', error)
        addToast('Failed to load your privacy account. Please try again.', { type: 'error' })
      })
    }
  }, [privacyPoolsForm.isReady])

  useEffect(() => {
    if (!railgunForm.isAccountLoaded && !railgunForm.isLoading) {
      railgunForm.loadPrivateAccount()
    }
  }, [railgunForm.isAccountLoaded, railgunForm.isLoading])

  return (
    <>
      <PendingActionWindowModal />
      <View
        style={{
          flex: 1,
          // backgroundColor: activeView === 'private' ? '#053F59' : '#F9F6E9',
          // backgroundColor: theme.primaryBackground,
          ...(isPopup ? { height: '100vh' as unknown as number, overflow: 'hidden' as const } : {})
        }}
      >
        <ScrollView
          ref={scrollViewRef}
          style={{ flex: 1, minHeight: '100%' }}
          contentContainerStyle={{
            minHeight: '100%',
            ...(isPopup ? { flexGrow: 1 } : undefined)
          }}
          showsVerticalScrollIndicator={false}
          scrollEnabled
        >
          <View
            style={[
              {
                width: '100%',
                alignSelf: 'center',
                marginLeft: 20,
                marginRight: 20,
                borderLeftWidth: 1,
                borderRightWidth: 1,
                borderColor: theme.primaryBorder,
                paddingLeft: 20,
                paddingRight: 20,
                minHeight: '100%',
                ...(isPopup ? { flex: 1 } : {})
              }
            ]}
          >
            <NewDashboardHeader
              activeView={activeView}
              onDashboardModeChange={onDashboardModeChange}
            />

            <View
              style={{
                height: 1,
                backgroundColor: theme.primaryBorder
              }}
            />

            <View
              style={{
                borderColor: theme.primaryBorder,
                borderLeftWidth: isPopup ? 0 : 1,
                borderRightWidth: isPopup ? 0 : 1,
                marginLeft: isPopup ? 10 : 80,
                marginRight: isPopup ? 10 : 80,
                paddingHorizontal: isPopup ? 0 : 20,
                flex: 1
              }}
            >
              <View
                style={[
                  {
                    maxWidth: 800,
                    width: '100%',
                    alignSelf: 'center'
                  }
                ]}
              >
                <View style={[spacings.ptMd, spacings.pbSm, spacings.mb, spacings.mt]}>
                  <Text
                    fontSize={16}
                    weight="number_regular"
                    style={{ letterSpacing: 1, color: theme.muted }}
                  >
                    Total funds
                  </Text>
                  <View
                    style={[
                      flexbox.alignCenter,
                      flexbox.directionRow,
                      { display: 'flex', alignSelf: 'flex-start' }
                    ]}
                  >
                    <NewDisplayBalance
                      activeView={activeView}
                      integer={displayedInteger}
                      decimal={displayedDecimal}
                    />
                    <Pressable onPress={handleRefreshAll} style={[spacings.mlTy]}>
                      <RefreshIcon width={12} height={12} color={String(theme.secondaryText)} />
                    </Pressable>
                  </View>
                </View>

                <NewFundsCards
                  activeView={activeView}
                  privateInteger={privateInteger}
                  privateDecimal={privateDecimal}
                  publicInteger={publicInteger}
                  publicDecimal={publicDecimal}
                  changeView={changeView}
                  onAddMoney={handleAddMoney}
                  accounts={accounts}
                  handleRetryLoadPrivateAccount={handleRetryLoadPrivateAccount}
                />

                {activeView === 'private' ? (
                  <NewPrivateActionButtons onReceive={openReceiveModal} />
                ) : (
                  <>
                    <NewPublicAccounts
                      selectedAccount={account?.addr}
                      balanceCache={balanceCache}
                      isLoadingPublicBalances={isLoadingPublicBalances}
                    />
                    <NewSelectedPublicAccountDetail openReceiveModal={openReceiveModal} />
                  </>
                )}

                <PageContentArea
                  activeView={activeView}
                  isLoadingPublicBalances={isLoadingPublicBalances}
                />
              </View>
            </View>
          </View>
        </ScrollView>
        <DAppFooter />
      </View>
    </>
  )
}

export default React.memo(PrivateDashboardView)
