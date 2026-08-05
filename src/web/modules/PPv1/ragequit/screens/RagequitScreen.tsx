import React, { useCallback, useEffect, useMemo, useRef } from 'react'
import { useTranslation } from 'react-i18next'

import { SigningStatus } from '@ambire-common/controllers/signAccountOp/signAccountOp'
import { Key } from '@ambire-common/interfaces/keystore'
import { AccountOpStatus } from '@ambire-common/libs/accountOp/types'
import BackButton from '@common/components/BackButton'
import Text from '@common/components/Text'
import useNavigation from '@common/hooks/useNavigation'
import useToast from '@common/hooks/useToast'
import { ROUTES } from '@common/modules/router/constants/common'
import Estimation from '@common/modules/sign-account-op/components/OneClick/Estimation'
import TrackProgress from '@common/components/TrackProgress'
import Completed from '@common/components/TrackProgress/ByStatus/Completed'
import Failed from '@common/components/TrackProgress/ByStatus/Failed'
import InProgress from '@common/components/TrackProgress/ByStatus/InProgress'
import useTrackAccountOp from '@common/modules/sign-account-op/hooks/OneClick/useTrackAccountOp'
import RagequitForm from '@web/modules/PPv1/ragequit/components/RagequitForm'
import Buttons from '@web/modules/PPv1/ragequit/components/Buttons'
import usePrivacyPoolsForm from '@web/modules/PPv1/hooks/usePrivacyPoolsForm'
import { getUiType } from '@common/utils/uiType'
import { View } from 'react-native'
import flexbox from '@common/styles/utils/flexbox'
import { usePrivacyPoolsDepositForm } from '@web/hooks/useDepositForm'
import Modals from '@web/modules/sign-account-op/components/Modals'
import { Content, Form, Wrapper } from '../components/TransactionsScreen'
import useController from '@common/hooks/useController'

const { isRequestWindow } = getUiType()

function RagequitScreen() {
  const hasRefreshedAccountRef = useRef(false)
  const { dispatch: requestsDispatch } = useController('RequestsController')
  const { dispatch: privacyPoolsDispatch } = useController('PrivacyPoolsController')
  const { navigate } = useNavigation()
  const { t } = useTranslation()
  const { addToast } = useToast()

  const { accountsOps } = useController('ActivityController').state
  const { account } = useController('SelectedAccountController').state

  const {
    chainId,
    poolInfo,
    hasProceeded,
    estimationModalRef,
    signAccountOpController,
    latestBroadcastedAccountOp,
    isLoading,
    // totalPendingBalance,
    totalDeclinedBalance,
    ethPrice,
    handleMultipleRagequit,
    closeEstimationModal,
    refreshPrivateAccount
  } = usePrivacyPoolsDepositForm()

  const ragequitableAccounts = useMemo(() => {
    return [
      // ...totalPendingBalance.accounts,
      ...totalDeclinedBalance.accounts
    ]
    // .filter((account) => !account.ragequit)
  }, [
    // totalPendingBalance.accounts,
    totalDeclinedBalance.accounts
  ])

  const submittedAccountOp = useMemo(() => {
    if (!accountsOps.privacyPools || !latestBroadcastedAccountOp?.signature) return

    return accountsOps.privacyPools.result.items.find(
      (accOp) => accOp.signature === latestBroadcastedAccountOp?.signature
    )
  }, [accountsOps.privacyPools, latestBroadcastedAccountOp?.signature])

  const navigateOut = useCallback(async () => {
    if (isRequestWindow) {
      if (account) {
        requestsDispatch({
          type: 'method',
          params: { method: 'removeUserRequests', args: [[`${account.addr}-transfer-sign`]] }
        })
      }
    } else {
      navigate(ROUTES.mainDashboard)
    }

    privacyPoolsDispatch({ type: 'method', params: { method: 'unloadScreen', args: [] } })

    refreshPrivateAccount().catch((error) => {
      console.error('Failed to refresh private account:', error)
      addToast('Failed to refresh your privacy account. Please try again.', { type: 'error' })
    })
  }, [account, requestsDispatch, privacyPoolsDispatch, navigate, refreshPrivateAccount, addToast])

  const { sessionHandler } = useTrackAccountOp({
    address: latestBroadcastedAccountOp?.accountAddr,
    chainId: latestBroadcastedAccountOp?.chainId,
    sessionId: 'privacyPools'
  })

  const explorerLink = useMemo(() => {
    if (!submittedAccountOp) return

    const { chainId: submittedChainId, identifiedBy, txnId } = submittedAccountOp

    if (!submittedChainId || !identifiedBy || !txnId) return

    return `https://sepolia.etherscan.io/tx/${txnId}`
  }, [submittedAccountOp])

  useEffect(() => {
    // Optimization: Don't apply filtration if we don't have a recent broadcasted account op
    if (!latestBroadcastedAccountOp?.accountAddr || !latestBroadcastedAccountOp?.chainId) return

    sessionHandler.initSession()

    return () => {
      sessionHandler.killSession()
    }
  }, [latestBroadcastedAccountOp?.accountAddr, latestBroadcastedAccountOp?.chainId, sessionHandler])

  const displayedView: 'transfer' | 'track' = useMemo(() => {
    if (latestBroadcastedAccountOp) return 'track'

    return 'transfer'
  }, [latestBroadcastedAccountOp])

  useEffect(() => {
    return () => {
      privacyPoolsDispatch({ type: 'method', params: { method: 'unloadScreen', args: [] } })
    }
  }, [privacyPoolsDispatch])

  const handleUpdateStatus = useCallback(
    (status: SigningStatus) => {
      privacyPoolsDispatch({
        type: 'method',
        params: { method: 'callSignAccountOpMethod', args: ['updateStatus', [status]] }
      })
    },
    [privacyPoolsDispatch]
  )

  const updateController = useCallback(
    (params: { signingKeyAddr?: Key['addr']; signingKeyType?: Key['type'] }) => {
      privacyPoolsDispatch({
        type: 'method',
        params: { method: 'callSignAccountOpMethod', args: ['update', [params]] }
      })
    },
    [privacyPoolsDispatch]
  )

  const isRagequitFormValid = useMemo(() => {
    return !!(ragequitableAccounts.length > 0 && poolInfo) && !isLoading
  }, [ragequitableAccounts.length, poolInfo, isLoading])

  const onBack = useCallback(() => {
    navigate(ROUTES.mainDashboard)
  }, [navigate])

  const headerTitle = t('Public Exit')

  const buttons = useMemo(() => {
    return (
      <View style={[flexbox.directionRow, flexbox.alignCenter, flexbox.justifySpaceBetween]}>
        <BackButton onPress={onBack} />
        <Buttons
          handleSubmitForm={handleMultipleRagequit}
          proceedBtnText={t('Exit All')}
          isNotReadyToProceed={!isRagequitFormValid}
          isLoading={isLoading}
          signAccountOpErrors={[]}
          networkUserRequests={[]}
        />
      </View>
    )
  }, [onBack, handleMultipleRagequit, isRagequitFormValid, isLoading, t])

  // Refresh private account after deposit success or unknown but past nonce
  useEffect(() => {
    if (
      !hasRefreshedAccountRef.current &&
      (submittedAccountOp?.status === AccountOpStatus.Success ||
        submittedAccountOp?.status === AccountOpStatus.UnknownButPastNonce)
    ) {
      hasRefreshedAccountRef.current = true
      refreshPrivateAccount().catch((error) => {
        console.error('Failed to refresh private account after deposit:', error)
        addToast('Failed to refresh your privacy account. Please try again.', { type: 'error' })
      })
    }
  }, [submittedAccountOp?.status, refreshPrivateAccount, addToast])

  if (displayedView === 'track') {
    return (
      <TrackProgress
        onPrimaryButtonPress={navigateOut}
        handleClose={() => {
          privacyPoolsDispatch({
            type: 'method',
            params: { method: 'destroyLatestBroadcastedAccountOp', args: [] }
          })
        }}
      >
        {submittedAccountOp?.status === AccountOpStatus.BroadcastedButNotConfirmed && (
          <InProgress title={t('Confirming Your Public Exit')}>
            <Text fontSize={16} weight="medium" appearance="secondaryText">
              {t('Almost there!')}
            </Text>
          </InProgress>
        )}
        {(submittedAccountOp?.status === AccountOpStatus.Success ||
          submittedAccountOp?.status === AccountOpStatus.UnknownButPastNonce) && (
          <Completed
            title={t('Public Exit Complete!')}
            titleSecondary={t('You have successfully exited the pool!')}
            explorerLink={explorerLink}
            openExplorerText="View Transaction"
          />
        )}
        {(submittedAccountOp?.status === AccountOpStatus.Failure ||
          submittedAccountOp?.status === AccountOpStatus.Rejected ||
          submittedAccountOp?.status === AccountOpStatus.BroadcastButStuck) && (
          <Failed
            title={t('Something went wrong!')}
            errorMessage={t(
              "We couldn't complete your public exit. Please try again later or contact Kohaku support."
            )}
          />
        )}
      </TrackProgress>
    )
  }

  return (
    <Wrapper title={headerTitle} buttons={buttons}>
      <Content buttons={buttons}>
        <Form>
          <RagequitForm
            poolInfo={poolInfo ?? undefined}
            // totalPendingBalance={totalPendingBalance}
            totalDeclinedBalance={totalDeclinedBalance}
            ethPrice={ethPrice || 0}
            chainId={chainId ? BigInt(chainId) : BigInt(1)}
          />
        </Form>
      </Content>

      <Estimation
        updateType="PrivacyPools"
        estimationModalRef={estimationModalRef}
        closeEstimationModal={closeEstimationModal}
        updateController={updateController}
        handleUpdateStatus={handleUpdateStatus}
        hasProceeded={!!hasProceeded}
        signAccountOpController={signAccountOpController || null}
        Modals={Modals}
      />
    </Wrapper>
  )
}

export default React.memo(RagequitScreen)
