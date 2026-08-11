import React, { useCallback, useEffect, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'

import { AccountOpStatus } from '@ambire-common/libs/accountOp/types'
import Text from '@common/components/Text'
import useNavigation from '@common/hooks/useNavigation'
import { ROUTES, WEB_ROUTES } from '@common/modules/router/constants/common'
import { Content, Wrapper } from '@web/modules/PPv1/deposit/components/TransactionsScreen'
import { SelectValue } from '@common/components/Select/types'
import TrackProgress from '@common/components/TrackProgress'
import Completed from '@common/components/TrackProgress/ByStatus/Completed'
import Failed from '@common/components/TrackProgress/ByStatus/Failed'
import InProgress from '@common/components/TrackProgress/ByStatus/InProgress'
import useTrackAccountOp from '@common/modules/sign-account-op/hooks/OneClick/useTrackAccountOp'
import { getUiType } from '@common/utils/uiType'
import usePrivacyPoolsControllerState from '@web/hooks/usePrivacyPoolsControllerState'
import { getPPv1Accounts } from '@web/modules/PPv1/sdk/misc'
import { getPrivacyProtocolOptions } from '@web/components/PrivacyProtocols'
import AddChainScreen from '../components/ImportForm'
import useController from '@common/hooks/useController'

const { isRequestWindow } = getUiType()

const ImportScreen = () => {
  const { dispatch: requestsDispatch } = useController('RequestsController')
  const {
    state: { latestBroadcastedAccountOp },
    dispatch: transferDispatch
  } = useController('TransferController')
  const { dispatch: privacyPoolsDispatch } = useController('PrivacyPoolsController')
  const { addImportedPrivateAccount, seedPhrase, importedPrivateAccounts } =
    usePrivacyPoolsControllerState()
  const { navigate } = useNavigation()
  const { t } = useTranslation()

  const { account } = useController('SelectedAccountController').state

  const navigateOut = useCallback(() => {
    if (isRequestWindow) {
      if (account) {
        requestsDispatch({
          type: 'method',
          params: { method: 'removeUserRequests', args: [[`${account.addr}-transfer-sign`]] }
        })
      }
    } else {
      navigate(WEB_ROUTES.pp1Home)
    }

    transferDispatch({ type: 'method', params: { method: 'resetForm', args: [] } })
  }, [account, requestsDispatch, transferDispatch, navigate])

  useTrackAccountOp({
    address: latestBroadcastedAccountOp?.accountAddr,
    chainId: latestBroadcastedAccountOp?.chainId,
    sessionId: 'transfer'
  })

  const [displayedView, setDisplayedView] = useState<'transfer' | 'track'>('transfer')
  const [trackProgress, setTrackProgress] = useState<AccountOpStatus>(AccountOpStatus.Pending)
  const [isDuplicate, setIsDuplicate] = useState(false)
  const [isCheckingDuplicate, setIsCheckingDuplicate] = useState(false)
  const [selectedProtocol, setSelectedProtocol] = useState<SelectValue>(
    getPrivacyProtocolOptions(t)[1] as SelectValue
  )
  const selectedProtocolLabel = selectedProtocol.value === 'railgun' ? 'Railgun' : 'Privacy Pool'

  const defaultAccountName = useMemo(() => {
    const existingCount = importedPrivateAccounts.filter((accounts) => accounts.length > 0).length
    return `${selectedProtocol.value === 'railgun' ? 'Railgun' : 'Privacy Pools'} #${
      existingCount + 1
    }`
  }, [importedPrivateAccounts, selectedProtocol.value])

  const [accountName, setAccountName] = useState(defaultAccountName)

  useEffect(() => {
    setAccountName(defaultAccountName)
  }, [defaultAccountName])

  useEffect(() => {
    async function checkForDuplicate() {
      if (!seedPhrase || seedPhrase.trim().length === 0) {
        setIsDuplicate(false)
        return
      }

      setIsCheckingDuplicate(true)
      try {
        const existingAccounts = await getPPv1Accounts()
        const normalizedSeedPhrase = seedPhrase.trim().toLowerCase()

        const duplicate = existingAccounts.some((account) => {
          if ('mnemonic' in account) {
            return account.mnemonic.trim().toLowerCase() === normalizedSeedPhrase
          }
          return false
        })

        setIsDuplicate(duplicate)
      } catch {
        setIsDuplicate(false)
      } finally {
        setIsCheckingDuplicate(false)
      }
    }

    checkForDuplicate().catch(() => {
      setIsDuplicate(false)
    })
  }, [seedPhrase])

  const handleImportSecretNote = useCallback(async () => {
    if (isDuplicate || !accountName.trim()) return

    setDisplayedView('track')
    await addImportedPrivateAccount({ mnemonic: seedPhrase, name: accountName.trim() })

    privacyPoolsDispatch({
      type: 'method',
      params: {
        method: 'addImportedAccountToActivityController',
        args: [accountName.trim()]
      }
    })

    setTrackProgress(AccountOpStatus.Success)
  }, [isDuplicate, accountName, addImportedPrivateAccount, seedPhrase, privacyPoolsDispatch])

  const headerTitle = 'Import Private Acct'

  const handleGoBackPress = useCallback(() => {
    navigate(ROUTES.pp1Home)
  }, [navigate])

  if (displayedView === 'track') {
    return (
      <TrackProgress
        onPrimaryButtonPress={navigateOut}
        handleClose={() => {
          transferDispatch({
            type: 'method',
            params: { method: 'destroyLatestBroadcastedAccountOp', args: [] }
          })
        }}
      >
        {trackProgress === AccountOpStatus.Pending && (
          <InProgress title={t(`Importing your ${selectedProtocolLabel} account`)}>
            <Text fontSize={16} weight="medium" appearance="secondaryText">
              {t('Fetching account deposit details...')}
            </Text>
          </InProgress>
        )}
        {(trackProgress === AccountOpStatus.Success ||
          trackProgress === AccountOpStatus.UnknownButPastNonce) && (
          <Completed
            title={t('Private account imported successfully!')}
            titleSecondary={t(`Your ${selectedProtocolLabel} account is ready to use`)}
            openExplorerText="View Transaction"
          />
        )}

        {(trackProgress === AccountOpStatus.Failure ||
          trackProgress === AccountOpStatus.Rejected ||
          trackProgress === AccountOpStatus.BroadcastButStuck) && (
          <Failed
            title={t('Import failed')}
            errorMessage={t(
              `We couldn't import your ${selectedProtocolLabel} account. Please verify your mnemonic and try again, or contact Kohaku support.`
            )}
          />
        )}
      </TrackProgress>
    )
  }

  return (
    <Wrapper title={headerTitle} handleGoBack={handleGoBackPress} buttons={undefined}>
      <Content buttons={<> </>}>
        <AddChainScreen
          handleImportSecretNote={handleImportSecretNote}
          isDuplicate={isDuplicate}
          isCheckingDuplicate={isCheckingDuplicate}
          accountName={accountName}
          onAccountNameChange={setAccountName}
          selectedProtocol={selectedProtocol}
          changeProtocol={setSelectedProtocol}
        />
      </Content>
    </Wrapper>
  )
}

export default React.memo(ImportScreen)
