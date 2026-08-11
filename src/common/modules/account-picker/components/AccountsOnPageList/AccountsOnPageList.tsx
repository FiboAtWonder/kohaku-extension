import { uniqBy } from 'lodash'
import groupBy from 'lodash/groupBy'
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { NativeScrollEvent, View } from 'react-native'
import { createPublicClient, http } from 'viem'

import {
  Account as AccountInterface,
  AccountOnPage,
  ImportStatus
} from '@ambire-common/interfaces/account'
import { IAccountPickerController } from '@ambire-common/interfaces/accountPicker'
import { isSmartAccount } from '@ambire-common/libs/account/account'
import WarningIcon from '@common/assets/svg/WarningIcon'
import Alert from '@common/components/Alert'
import Badge from '@common/components/Badge'
import { createGlobalTooltipDataSet } from '@common/components/GlobalTooltip'
import Pagination from '@common/components/Pagination'
import ScrollableWrapper from '@common/components/ScrollableWrapper'
import Spinner from '@common/components/Spinner'
import Text from '@common/components/Text'
import { isMobile, isWeb } from '@common/config/env'
import { useTranslation } from '@common/config/localization'
import useController from '@common/hooks/useController'
import useTheme from '@common/hooks/useTheme'
import Account from '@common/modules/account-picker/components/Account'
import AnimatedDownArrow from '@common/modules/account-picker/components/AccountsOnPageList/AnimatedDownArrow/AnimatedDownArrow'
import AccountsRetrieveError from '@common/modules/account-picker/components/AccountsRetrieveError'
import spacings from '@common/styles/spacings'
import flexbox from '@common/styles/utils/flexbox'
import text from '@common/styles/utils/text'

import getStyles from './styles'

// Kohaku's onboarding imports basic (EOA) accounts only, so the smart/linked accounts
// section stays hidden and the used-account scan below drives the selection instead. The
// upstream markup is kept intact behind this flag so it can be re-enabled. (kohaku)
const ARE_SMART_ACCOUNTS_SUPPORTED = false

const isCloseToBottom = ({ layoutMeasurement, contentOffset, contentSize }: NativeScrollEvent) => {
  const paddingToBottom = 40
  return layoutMeasurement.height + contentOffset.y >= contentSize.height - paddingToBottom
}

type Props = {
  state: IAccountPickerController
  setPage: (page: number) => void
  subType: IAccountPickerController['subType']
  isLoading: boolean
  lookingForLinkedAccounts: boolean
  // The used-account scan runs inside this component, so the parent is told when it
  // is over and in turn keeps the import button and the pagination disabled. Screens that
  // do not pass `onScanComplete` (the mobile app) opt out of the scan entirely. (kohaku)
  isScanComplete?: boolean
  onScanComplete?: () => void
  children?: any
}

const AccountsOnPageList = ({
  state,
  setPage,
  subType,
  isLoading,
  lookingForLinkedAccounts,
  isScanComplete = true,
  onScanComplete,
  children
}: Props) => {
  const { t } = useTranslation()
  const { networks: allNetworks } = useController('NetworksController').state
  const { state: accountPickerState, dispatch: accountPickerDispatch } =
    useController('AccountPickerController')
  const [hasReachedBottom, setHasReachedBottom] = useState<null | boolean>(null)
  const [containerHeight, setContainerHeight] = useState(0)
  const [contentHeight, setContentHeight] = useState(0)
  const { styles, theme } = useTheme(getStyles)

  const slots = useMemo(() => {
    if (!ARE_SMART_ACCOUNTS_SUPPORTED)
      // Basic accounts only (kohaku)
      return groupBy(
        state.accountsOnPage.filter((a) => !a.isLinked && !a.account.creation),
        'slot'
      )

    return groupBy(
      [
        ...state.accountsOnPage.filter((a) => !a.isLinked),
        // A linked account with the same address could have multiple Basic accounts
        // added as keys. Therefore, it could appear multiple times in the list.
        // In this case, show it only one time. When it gets selected, all keys
        // will get selected (and later on, imported) below the hood.
        ...uniqBy(
          state.accountsOnPage.filter((a) => a.isLinked),
          (a) => a.account.addr
        )
      ],
      'slot'
    )
  }, [state.accountsOnPage])

  const hasLinkedAccounts = useMemo(
    () => state.accountsOnPage.some((a) => a.isLinked),
    [state.accountsOnPage]
  )

  // The onboarding scan looks up every derived address on every network and pre-selects
  // the ones that were already used, so the user does not have to hunt for them. (kohaku)
  const [accountUsageMap, setAccountUsageMap] = useState<Record<string, boolean>>({})
  const [usageCheckComplete, setUsageCheckComplete] = useState(false)

  const scanStateRef = useRef<{
    phase: 'scanning' | 'at-target' | 'done'
    lastUsedPage: number | null
    pageAdvanceInitiated: boolean
  }>({ phase: 'scanning', lastUsedPage: null, pageAdvanceInitiated: false })

  const finishScan = useCallback(() => {
    scanStateRef.current.phase = 'done'
    onScanComplete?.()
  }, [onScanComplete])

  useEffect(() => {
    // There is a single address to import when the sub type is a private key, so
    // there is nothing to scan for (kohaku)
    if (subType === 'private-key') onScanComplete?.()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    if (!onScanComplete) return

    scanStateRef.current.pageAdvanceInitiated = false
    setUsageCheckComplete(false)

    if (!allNetworks.length || !state.accountsOnPage.length) return

    let cancelled = false

    const checkUsage = async () => {
      const results: Record<string, boolean> = {}

      await Promise.all(
        state.accountsOnPage.map(async (acc) => {
          const address = acc.account.addr as `0x${string}`

          const isUsed = await allNetworks.reduce(async (prevPromise, network) => {
            const alreadyUsed = await prevPromise
            if (alreadyUsed) return true

            try {
              const client = createPublicClient({ transport: http(network.selectedRpcUrl) })
              const [nonce, balance] = await Promise.all([
                client.getTransactionCount({ address }),
                client.getBalance({ address })
              ])

              return nonce > 0 || balance > 0n
            } catch {
              // A single unreachable RPC must not fail the whole scan (kohaku)
              return false
            }
          }, Promise.resolve(false))

          if (isUsed) results[address] = true
        })
      )

      if (cancelled) return

      setAccountUsageMap(results)
      setUsageCheckComplete(true)
    }

    checkUsage().catch(() => {
      if (!cancelled) setUsageCheckComplete(true)
    })

    return () => {
      cancelled = true
    }
  }, [state.accountsOnPage, allNetworks, onScanComplete])

  const handleSelectAccount = useCallback(
    (account: AccountInterface) => {
      accountPickerDispatch({
        type: 'method',
        params: { method: 'selectAccount', args: [account] }
      })
    },
    [accountPickerDispatch]
  )

  const handleDeselectAccount = useCallback(
    (account: AccountInterface) => {
      accountPickerDispatch({
        type: 'method',
        params: { method: 'deselectAccount', args: [account] }
      })
    },
    [accountPickerDispatch]
  )

  const handleRetryFindingLinkedAccounts = useCallback(() => {
    accountPickerDispatch({
      type: 'method',
      params: {
        method: 'findAndSetLinkedAccounts',
        args: []
      }
    })
  }, [accountPickerDispatch])

  // Walks the pages forward while any address on the page was used, then comes back to the
  // last page that had one and selects everything up to the last used slot. (kohaku)
  useEffect(() => {
    if (!onScanComplete) return
    if (!usageCheckComplete || state.accountsLoading || isLoading) return
    if (subType === 'private-key') return

    const scan = scanStateRef.current
    if (scan.phase === 'done') return

    const sortedAccounts = [...state.accountsOnPage]
      .filter((a) => !a.isLinked && !a.account.creation)
      .sort((a, b) => a.slot - b.slot)

    if (scan.phase === 'scanning') {
      if (scan.pageAdvanceInitiated) return

      const hasUsed = sortedAccounts.some((a) => accountUsageMap[a.account.addr])

      if (hasUsed) {
        sortedAccounts.forEach((acc) => {
          const alreadySelected = state.selectedAccounts.some(
            (s) => s.account.addr === acc.account.addr
          )
          if (!alreadySelected) handleSelectAccount(acc.account)
        })
        scan.lastUsedPage = state.page
        scan.pageAdvanceInitiated = true
        setPage(state.page + 1)
      } else if (scan.lastUsedPage !== null) {
        scan.phase = 'at-target'
        scan.pageAdvanceInitiated = true
        setPage(scan.lastUsedPage)
      } else {
        finishScan()
      }

      return
    }

    // Find the last used account by slot order and select everything up to it
    const lastUsedIdx = sortedAccounts.reduce(
      (lastIdx, acc, i) => (accountUsageMap[acc.account.addr] ? i : lastIdx),
      -1
    )

    if (lastUsedIdx === -1) {
      finishScan()
      return
    }

    sortedAccounts.forEach((acc, i) => {
      const isSelected = state.selectedAccounts.some((s) => s.account.addr === acc.account.addr)
      if (i <= lastUsedIdx && !isSelected) {
        handleSelectAccount(acc.account)
      } else if (i > lastUsedIdx && isSelected) {
        handleDeselectAccount(acc.account)
      }
    })

    finishScan()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [usageCheckComplete, state.accountsLoading, isLoading])

  const getType = useCallback((acc: any) => {
    if (!acc.account.creation) return 'basic'
    if (acc.isLinked) return 'linked'

    return 'smart'
  }, [])

  const isImportingFromPrivateKey = subType === 'private-key'

  const getAccounts = useCallback(
    ({
      accounts,
      isLastSlot = false,
      byType = ['basic', 'smart']
    }: {
      accounts: AccountOnPage[]
      isLastSlot?: boolean
      slotIndex?: number
      byType?: ('basic' | 'linked' | 'smart')[]
    }) => {
      const filteredAccounts = accounts.filter((a) => byType.includes(getType(a)))

      return filteredAccounts.map((acc, i: number) => {
        const hasBottomSpacing = !(isLastSlot && i === filteredAccounts.length - 1)
        // The scan is the source of truth for "used" during onboarding, when it runs (kohaku)
        const isUnused = onScanComplete
          ? !accountUsageMap[acc.account.addr]
          : Array.isArray(acc.account.usedOnNetworks) && !acc.account.usedOnNetworks.length
        const isSelected = state.selectedAccounts.some(
          (selectedAcc) => selectedAcc.account.addr === acc.account.addr
        )

        return (
          <Account
            key={acc.account.addr}
            account={acc.account}
            type={getType(acc)}
            withBottomSpacing={hasBottomSpacing}
            unused={isUnused}
            isSelected={isSelected}
            importStatus={acc.importStatus}
            onSelect={handleSelectAccount}
            onDeselect={handleDeselectAccount}
            displayTypeBadge={false}
            displayTypePill={getType(acc) === 'linked'}
            // Only show "new" badge for the last unused smart account.
            // Otherwise, multiple smart accounts could be displayed as "new",
            // because they could have identity on the Relayer, but still be unused.
            shouldBeDisplayedAsNew={
              isLastSlot &&
              getType(acc) === 'smart' &&
              isUnused &&
              acc.importStatus === ImportStatus.NotImported
            }
          />
        )
      })
    },
    [
      getType,
      state.selectedAccounts,
      handleSelectAccount,
      handleDeselectAccount,
      accountUsageMap,
      onScanComplete
    ]
  )

  const networkNamesWithAccountStateError = useMemo(() => {
    return accountPickerState.networksWithAccountStateError.map((chainId) => {
      return allNetworks.find((n) => n.chainId === chainId)?.name
    })
  }, [accountPickerState.networksWithAccountStateError, allNetworks])

  // Empty means it's not loading and no accounts on the current page are derived.
  // Should rarely happen - if the deriving request gets cancelled on the device
  // or if something goes wrong with deriving in general.
  const isAccountPickerEmpty = useMemo(
    () => !state.accountsLoading && state.accountsOnPage.length === 0,
    [state.accountsLoading, state.accountsOnPage]
  )

  useEffect(() => {
    if (
      state.accountsLoading ||
      contentHeight === containerHeight ||
      !Object.keys(slots).length ||
      !containerHeight ||
      !contentHeight
    ) {
      if (hasReachedBottom) return

      setHasReachedBottom(contentHeight === containerHeight)
      return
    }

    const isScrollNotVisible = contentHeight <= containerHeight

    if (setHasReachedBottom && !hasReachedBottom) setHasReachedBottom(isScrollNotVisible)
  }, [
    contentHeight,
    containerHeight,
    setHasReachedBottom,
    hasReachedBottom,
    state.accountsLoading,
    slots
  ])

  const shouldDisplayAnimatedDownArrow =
    typeof hasReachedBottom === 'boolean' &&
    !hasReachedBottom &&
    !state.accountsLoading &&
    !isAccountPickerEmpty &&
    !state.pageError

  const hasSmartAccounts = useMemo(() => {
    return state.accountsOnPage.some((p) => isSmartAccount(p.account))
  }, [state.accountsOnPage])

  // Prevents the user from temporarily seeing (flashing) empty (error) states
  // while being navigated back (resetting the Account Picker state).
  if (!state.isInitialized) return null

  return (
    <View style={[isWeb && spacings.ptTy, flexbox.flex1]} nativeID="account-picker-page-list">
      <View style={flexbox.flex1}>
        {!!networkNamesWithAccountStateError.length && (
          <Alert
            type="warning"
            style={spacings.mbTy}
            title={`We cannot determine if your accounts are used on ${networkNamesWithAccountStateError.join(
              ', '
            )}`}
          />
        )}
        <ScrollableWrapper
          style={[isMobile ? spacings.mb0 : spacings.mbLg]}
          contentContainerStyle={{ flexGrow: 1 }}
          onScroll={(e) => {
            if (isCloseToBottom(e.nativeEvent) && setHasReachedBottom) setHasReachedBottom(true)
          }}
          onLayout={(e) => {
            setContainerHeight(e.nativeEvent.layout.height)
          }}
          onContentSizeChange={(_, height) => {
            setContentHeight(height)
          }}
          scrollEventThrottle={16}
        >
          {!isLoading && (isAccountPickerEmpty || !!accountPickerState.pageError) && (
            <AccountsRetrieveError
              pageError={accountPickerState.pageError}
              page={accountPickerState.page}
              setPage={setPage}
            />
          )}
          {state.accountsLoading || !!isLoading || !isScanComplete ? (
            <View style={[flexbox.flex1, flexbox.center, spacings.mt2Xl]}>
              <Spinner style={styles.spinner} />
            </View>
          ) : (
            <>
              <View style={[!isMobile && spacings.phSm, isMobile ? spacings.pbMd : spacings.pbLg]}>
                {Object.keys(slots).map((key, i) => {
                  return (
                    <View key={key}>
                      {getAccounts({
                        accounts: slots[key] || [],
                        isLastSlot: i === Object.keys(slots).length - 1,
                        slotIndex: 1,
                        byType: ['basic']
                      })}
                    </View>
                  )
                })}
              </View>
              {ARE_SMART_ACCOUNTS_SUPPORTED && hasSmartAccounts && (
                <View style={[styles.smartAccountWrapper, isMobile && spacings.ptSm]}>
                  <View style={[flexbox.directionRow, flexbox.alignCenter, spacings.mbSm]}>
                    <Text fontSize={16} weight="medium" style={[text.center, spacings.mrTy]}>
                      {t('Smart accounts')}
                      {/* TODO: Add an info icon here with a tooltip */}
                    </Text>
                    <View
                      style={[
                        flexbox.directionRow,
                        flexbox.justifySpaceBetween,
                        flexbox.alignCenter
                      ]}
                    >
                      {lookingForLinkedAccounts && (
                        <View style={[flexbox.alignCenter, flexbox.directionRow]}>
                          <Spinner
                            style={{ width: isMobile ? 14 : 16, height: isMobile ? 14 : 16 }}
                          />
                          <Text appearance="primary" style={[spacings.mlTy]} fontSize={12}>
                            {t(`Looking for linked ${!isMobile ? 'smart ' : ''}accounts`)}
                          </Text>
                        </View>
                      )}
                      {!isMobile && !lookingForLinkedAccounts && hasLinkedAccounts && (
                        <View style={[flexbox.directionRow, flexbox.alignCenter]}>
                          <Badge
                            type="info"
                            size="md"
                            withRightSpacing
                            text={`Linked Smart Account (found on page ${state.page})`}
                            tooltipText="Linked smart accounts are accounts that were not created with a given key originally, but this key was authorized for that given account on any supported network."
                          />

                          <WarningIcon
                            color={theme.warning300}
                            dataSet={createGlobalTooltipDataSet({
                              id: 'linked-accounts-warning',
                              style: {
                                backgroundColor: theme.warningBackground as string,
                                color: theme.warningText as string
                              },
                              content: t('Do not add linked accounts you are not aware of!')
                            })}
                          />
                        </View>
                      )}
                    </View>
                  </View>

                  {isMobile && !lookingForLinkedAccounts && hasLinkedAccounts && (
                    <View style={[flexbox.directionRow, flexbox.alignCenter, spacings.mb]}>
                      <Badge
                        type="info"
                        size="md"
                        withRightSpacing
                        text={`Linked Smart Account (found on page ${state.page})`}
                        tooltipText={
                          isMobile
                            ? undefined
                            : 'Linked smart accounts are accounts that were not created with a given key originally, but this key was authorized for that given account on any supported network.'
                        }
                      />
                    </View>
                  )}

                  {Object.keys(slots).map((key, i) => {
                    return (
                      <View key={key}>
                        {getAccounts({
                          accounts: slots[key] || [],
                          isLastSlot: i === Object.keys(slots).length - 1,
                          slotIndex: 1,
                          byType: ['smart', 'linked']
                        })}
                      </View>
                    )
                  })}

                  {!!accountPickerState.linkedAccountsError && (
                    <Alert
                      type="warning"
                      text={accountPickerState.linkedAccountsError}
                      buttonProps={{
                        onPress: handleRetryFindingLinkedAccounts,
                        text: t('Retry'),
                        type: 'warning'
                      }}
                    />
                  )}
                </View>
              )}
              {isMobile && (
                <View
                  style={[
                    flexbox.flex1,
                    flexbox.justifyEnd,
                    flexbox.alignCenter,
                    spacings.mtLg,
                    spacings.mbTy
                  ]}
                >
                  {!isImportingFromPrivateKey && (
                    <Pagination
                      page={state.page}
                      maxPages={1000}
                      setPage={setPage}
                      isDisabled={state.accountsLoading || !isScanComplete}
                      hideLastPage
                    />
                  )}
                </View>
              )}
            </>
          )}
        </ScrollableWrapper>
        <AnimatedDownArrow isVisible={shouldDisplayAnimatedDownArrow} />
      </View>
      {!isMobile && (
        <View style={[flexbox.alignEnd, spacings.mbMd]}>
          {!isImportingFromPrivateKey && (
            <Pagination
              page={state.page}
              maxPages={1000}
              setPage={setPage}
              isDisabled={state.accountsLoading || !isScanComplete}
              hideLastPage
            />
          )}
        </View>
      )}
      {children}
    </View>
  )
}

export default React.memo(AccountsOnPageList)
