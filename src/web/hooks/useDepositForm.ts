/**
 * Wrapper hook that routes to the appropriate privacy protocol form hook
 * based on the selected provider (Privacy Pools or Railgun).
 *
 * This allows both protocols to maintain independent state and prevents
 * mixing of concerns between different privacy protocols.
 */
import { useCallback, useEffect, useMemo, useState } from 'react'
import { useModalize } from 'react-native-modalize'
import { formatEther, formatUnits, parseUnits, toHex } from 'viem'
import type { PPv1Address, PPv1AssetAmount } from '@kohaku-eth/privacy-pools'

import useRailgunForm from '@web/modules/railgun/hooks/useRailgunForm'
import { validateSendTransferAddress } from '@ambire-common/services/privacyPools/validations'
import { TokenResult } from '@ambire-common/libs/portfolio'
import { getTokenAmount } from '@ambire-common/libs/portfolio/helpers'
import { INote } from '@ambire-common/controllers/privacyPools/privacyPoolsV1'
import { AddressState, AddressStateOptional } from '@ambire-common/interfaces/domains'
import useAddressInput from '@common/hooks/useAddressInput'
import useController from '@common/hooks/useController'
import usePrivacyPools from './usePrivacyPools/usePrivacyPools'

const DEFAULT_ADDRESS_STATE: AddressState = {
  fieldValue: '',
  resolvedAddress: '',
  resolvedAddressType: null,
  isDomainResolving: false
}

export interface UpdateFormParams {
  depositAmount: string
  withdrawalAmount: string
  hasProceeded: boolean
  selectedToken: TokenResult | null
  addressState: AddressState
}

export const usePrivacyPoolsDepositForm = () => {
  // balance/sync/notes come from usePrivacyPools (the context wrapper)
  const {
    balance,
    sync,
    isReady,
    isSynced,
    initializationError,
    pendingNotes,
    approvedNotes,
    state: controllerState,
    isUnshielding,
    prepareUnshield,
    unshield,
    pendingUnshieldOperation,
    hasProceeded,
    latestBroadcastedAccountOp,
    signAccountOpController,
    syncState
  } = usePrivacyPools()

  const { state: selectedAccountState } = useController('SelectedAccountController')
  const { portfolio } = selectedAccountState
  const { dispatch: privacyPoolsDispatch } = useController('PrivacyPoolsController')
  const { dispatch: privacyPoolsV1Dispatch } = useController('PrivacyPoolsV1Controller')
  const { ref: estimationModalRef, open: openEstimationModal, close: closeModalRaw } = useModalize()

  const closeEstimationModal = useCallback(() => {
    privacyPoolsDispatch({ type: 'method', params: { method: 'destroySignAccountOp', args: [] } })
    closeModalRaw()
  }, [privacyPoolsDispatch, closeModalRaw])

  const [depositAmount, setDepositAmount] = useState<string>('')
  const [withdrawalAmount, setWithdrawalAmount] = useState<string>('')
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null)
  const [selectedToken, setselectedToken] = useState<TokenResult | null>(null)
  const [amountFieldMode, setAmountFieldMode] = useState<'token' | 'fiat'>('token')
  const [isRecipientAddressUnknownAgreed, setIsRecipientAddressUnknownAgreed] = useState(false)
  // PPv1 never broadcasts through a token-scoped flow, so this stays null; it exists
  // to keep the return shape identical to the railgun form.
  const [latestBroadcastedToken] = useState<TokenResult | null>(null)
  const [programmaticUpdateCounter, setProgrammaticUpdateCounter] = useState(0)

  const [addressState, setAddressStateRaw] = useState<AddressState>({ ...DEFAULT_ADDRESS_STATE })

  const setAddressState = useCallback((newState: AddressStateOptional) => {
    setAddressStateRaw((prev) => ({ ...prev, ...newState }))
  }, [])

  const resetForm = useCallback(() => {
    setDepositAmount('')
    setWithdrawalAmount('')
    setMessage(null)
    setselectedToken(null)
    setAmountFieldMode('token')
    setIsRecipientAddressUnknownAgreed(false)
    setProgrammaticUpdateCounter(0)
    setAddressStateRaw({ ...DEFAULT_ADDRESS_STATE })
  }, [])

  const addressInputState = useAddressInput({
    addressState,
    setAddressState
  })

  const handleUpdateForm = useCallback(
    (params: Partial<UpdateFormParams>) => {
      if (params.depositAmount !== undefined) setDepositAmount(params.depositAmount)
      if (params.withdrawalAmount !== undefined) {
        setWithdrawalAmount(params.withdrawalAmount)
        setProgrammaticUpdateCounter((c) => c + 1)
      }
      if (params.selectedToken !== undefined) setselectedToken(params.selectedToken)
      if (params.addressState !== undefined) {
        setAddressState(params.addressState)
        setProgrammaticUpdateCounter((c) => c + 1)
      }
      setMessage(null)
    },
    [setAddressState]
  )

  const ethPrice = useMemo(() => {
    return portfolio.tokens
      .find((token) => token.name === 'Ether')
      ?.priceIn.find((price) => price.baseCurrency === 'usd')?.price
  }, [portfolio.tokens])

  const totalApprovedBalance = useMemo(() => {
    const total = approvedNotes.reduce((sum: bigint, b: INote) => sum + b.balance, 0n)
    return { total, accounts: approvedNotes }
  }, [approvedNotes])

  const totalPendingBalance = useMemo(() => {
    const total = pendingNotes.reduce((sum: bigint, b: INote) => sum + b.balance, 0n)
    return { total, accounts: pendingNotes }
  }, [pendingNotes])

  const totalDeclinedBalance = useMemo(() => ({ total: 0n, accounts: [] }), [])

  const ethPrivateBalance = useMemo(
    () => formatEther(totalApprovedBalance.total),
    [totalApprovedBalance.total]
  )

  const totalPrivatePortfolio = useMemo(
    () => Number(ethPrivateBalance) * (ethPrice || 0),
    [ethPrivateBalance, ethPrice]
  )

  const supportedAssets = useMemo(() => new Set(balance.map((b) => b.asset.contract)), [balance])

  const emptyImportedBalance = useMemo(() => ({ total: 0n, accounts: [] }), [])

  // isRefreshing: true while the controller is fetching a new unshield quote
  const isRefreshing = useMemo(() => controllerState === 'preparing-unshield', [controllerState])

  const maxAmount = useMemo(() => {
    if (!selectedToken || approvedNotes.length === 0) return '0'

    const selectedAddress = selectedToken.address.toLowerCase()
    const totalBalance = approvedNotes
      .filter((note) => toHex(note.assetAddress, { size: 20 }).toLowerCase() === selectedAddress)
      .reduce((sum, note) => sum + note.balance, 0n)

    return formatUnits(totalBalance, selectedToken.decimals)
  }, [approvedNotes, selectedToken])

  // amountInFiat: withdrawal amount converted to USD
  const amountInFiat = useMemo(() => {
    const num = parseFloat(withdrawalAmount)
    if (!num || !ethPrice) return '0'
    return (num * ethPrice).toFixed(2)
  }, [withdrawalAmount, ethPrice])

  // relayerQuote: derived from the pending unshield operation's relay data
  const relayerQuote = useMemo(() => {
    if (!pendingUnshieldOperation) return null
    const feeBps = (pendingUnshieldOperation.rawData.relayData as any).relayFeeBps
    const estimatedFee = formatEther(
      BigInt(pendingUnshieldOperation.quoteData.quote.detail.relayTxCost.eth)
    )
    return {
      relayFeeBPS: Number(feeBps),
      estimatedFee
    }
  }, [pendingUnshieldOperation])

  // updateQuoteStatus: re-fetches the quote by calling prepareUnshield with current form values
  const updateQuoteStatus = useCallback(() => {
    if (!selectedToken || !withdrawalAmount || !addressInputState.address) return
    const asset: PPv1AssetAmount = {
      asset: { contract: selectedToken.address as `0x${string}`, __type: 'erc20' },
      amount: parseUnits(withdrawalAmount, selectedToken.decimals)
    }
    prepareUnshield(asset, addressInputState.address as PPv1Address)
  }, [selectedToken, withdrawalAmount, addressInputState.address, prepareUnshield])

  // Auto-fetch the quote whenever the form inputs are valid and complete
  useEffect(() => {
    if (!selectedToken || !withdrawalAmount || parseFloat(withdrawalAmount) <= 0) return
    if (!addressInputState.address || addressInputState.validation.severity === 'error') return

    const timeout = setTimeout(() => updateQuoteStatus(), 400)
    return () => clearTimeout(timeout)
  }, [
    selectedToken,
    withdrawalAmount,
    addressInputState.address,
    addressInputState.validation.severity,
    updateQuoteStatus
  ])

  const handleDeposit = useCallback(() => {
    if (!depositAmount || !selectedToken) return

    privacyPoolsV1Dispatch({
      type: 'method',
      params: {
        method: 'prepareShield',
        args: [
          {
            asset: { contract: selectedToken.address as `0x${string}`, __type: 'erc20' },
            amount: BigInt(depositAmount)
          }
        ]
      }
    })

    privacyPoolsV1Dispatch({
      type: 'method',
      params: { method: 'setUserProceeded', args: [true] }
    })

    openEstimationModal()
  }, [depositAmount, selectedToken, privacyPoolsV1Dispatch, openEstimationModal])

  const validationFormMsgs = useMemo(() => {
    const amount = (() => {
      if (!depositAmount || !selectedToken) return { success: false, message: '' }
      try {
        const formatted = formatUnits(BigInt(depositAmount), selectedToken.decimals)
        if (Number(formatted) <= 0)
          return { success: false, message: 'The amount must be greater than 0.' }

        const tokenInPortfolio = portfolio.tokens.find(
          (t) =>
            t.chainId === selectedToken.chainId &&
            t.address.toLowerCase() === selectedToken.address.toLowerCase()
        )
        const tokenBalance = tokenInPortfolio ? getTokenAmount(tokenInPortfolio) : 0n
        if (BigInt(depositAmount) > tokenBalance)
          return { success: false, message: 'Insufficient balance.' }

        return { success: true, message: '' }
      } catch {
        return { success: false, message: 'Invalid amount.' }
      }
    })()

    // isRecipientAddressUnknown is always false for PPv1 (no address book requirement)
    const recipientAddress = validateSendTransferAddress(
      addressInputState.address || '',
      '',
      isRecipientAddressUnknownAgreed,
      false,
      false,
      !!addressState.resolvedAddress,
      addressState.isDomainResolving
    )

    return { amount, recipientAddress }
  }, [
    depositAmount,
    selectedToken,
    portfolio.tokens,
    addressInputState.address,
    isRecipientAddressUnknownAgreed,
    addressState.resolvedAddress,
    addressState.isDomainResolving
  ])

  const handleMultipleRagequit = useCallback(async () => {
    throw new Error('handleMultipleRagequit: not yet implemented in usePrivacyPoolsDepositForm')
  }, [])

  const handleSelectedAccount = useCallback(() => {
    // TODO: implement with notes support
  }, [])

  const loadPrivateAccount = useCallback(async () => {
    sync()
  }, [sync])

  const refreshPrivateAccount = useCallback(async () => {
    sync()
  }, [sync])

  const isRagequitLoading = useCallback(() => false, [])

  return {
    chainId: 0n,
    supportedAssets,
    ethPrice,
    message,
    poolInfo: null,
    chainData: null,
    seedPhrase: '',
    poolAccounts: [],
    hasProceeded,
    depositAmount,
    selectedToken,
    accountService: null,
    syncState,
    withdrawalAmount,
    privacyProvider: 'privacy-pools' as const,
    showAddedToBatch: false,
    estimationModalRef,
    selectedPoolAccount: null,
    signAccountOpController,
    latestBroadcastedAccountOp,
    isLoading: !isReady,
    isReady,
    isRefreshing,
    isAccountLoaded: isSynced,
    isLoadingAnonymitySet: false,
    totalApprovedBalance,
    totalPendingBalance,
    totalDeclinedBalance,
    totalPrivatePortfolio,
    ethPrivateBalance,
    totalImportedApprovedBalance: emptyImportedBalance,
    totalImportedPendingBalance: emptyImportedBalance,
    totalImportedDeclinedBalance: emptyImportedBalance,
    totalImportedPrivatePortfolio: 0,
    ethImportedPrivateBalance: '0',
    importedAccountsWithNames: {},
    validationFormMsgs,
    isReadyToLoad: isReady,
    loadingError: initializationError,
    loadingSelectionAlgorithm: false,
    latestBroadcastedToken,
    handleDeposit,
    handleMultipleRagequit,
    handleUpdateForm,
    isRagequitLoading,
    closeEstimationModal,
    handleSelectedAccount,
    loadPrivateAccount,
    refreshPrivateAccount,
    addressState,
    setAddressState,
    addressInputState,
    amountFieldMode,
    setAmountFieldMode,
    amountInFiat,
    isRecipientAddressUnknown: false,
    isRecipientAddressUnknownAgreed,
    setIsRecipientAddressUnknownAgreed,
    maxAmount,
    programmaticUpdateCounter,
    relayerQuote,
    updateQuoteStatus,
    unshield,
    isUnshielding,
    resetForm
  } as const
}

const useDepositForm = () => {
  const { dispatch: railgunDispatch } = useController('RailgunController')
  const { dispatch: privacyPoolsDispatch } = useController('PrivacyPoolsController')

  // IMPORTANT: Always call both hooks unconditionally to maintain consistent hook order
  // This prevents React's "Hooks called in different order" error
  const privacyPoolsForm = usePrivacyPoolsDepositForm()
  const railgunForm = useRailgunForm()

  const { privacyProvider } = railgunForm

  // Route to the appropriate hook based on the selected provider
  // Default to railgun if not set
  const activeProvider = privacyProvider || 'railgun'

  // Wrap handleUpdateForm to intercept privacyProvider changes
  const wrappedHandleUpdateForm = useCallback(
    (params: any) => {
      // If privacyProvider is being updated, dispatch to both controllers
      if (params.privacyProvider !== undefined) {
        railgunDispatch({
          type: 'method',
          params: { method: 'update', args: [{ privacyProvider: params.privacyProvider }] }
        })
        privacyPoolsDispatch({
          type: 'method',
          params: { method: 'update', args: [{ privacyProvider: params.privacyProvider }] }
        })
      }

      // Call the original handleUpdateForm from the appropriate form
      // We need to determine which form to use based on the current provider
      if ((privacyProvider || 'railgun') === 'railgun') {
        railgunForm.handleUpdateForm(params)
      } else {
        privacyPoolsForm.handleUpdateForm(params)
      }
    },
    [railgunDispatch, privacyPoolsDispatch, privacyProvider, railgunForm, privacyPoolsForm]
  )

  if (activeProvider === 'railgun') {
    return {
      ...railgunForm,
      handleUpdateForm: wrappedHandleUpdateForm,
      supportedAssets: new Set<string>(),

      resetForm: () => {}
    }
  }

  return {
    ...privacyPoolsForm,
    handleUpdateForm: wrappedHandleUpdateForm
  }
}

export default useDepositForm
