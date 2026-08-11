import React, { createContext, useCallback, useMemo } from 'react'

import type { PPv1Address, PPv1AssetAmount, PPv1AssetBalance } from '@kohaku-eth/privacy-pools'

import useDeepMemo from '@common/hooks/useDeepMemo'
import useController from '@common/hooks/useController'
import {
  INote,
  OpStatus,
  PendingUnshieldOperation,
  State,
  SyncState
} from '@ambire-common/controllers/privacyPools/privacyPoolsV1'
import { SignAccountOpController } from '@ambire-common/controllers/signAccountOp/signAccountOp'
import { AccountOp } from '@ambire-common/libs/accountOp/accountOp'

type PrivacyPoolsV1ControllerStateContextType = {
  balance: PPv1AssetBalance[]
  notes: INote[]
  syncState: SyncState
  isInitialized: boolean
  initializationError: string | null
  init: () => void
  sync: () => void
  shield: (asset: PPv1AssetAmount) => void
  prepareUnshield: (asset: PPv1AssetAmount, to: PPv1Address) => void
  unshield: () => void
  pendingUnshieldOperation: PendingUnshieldOperation | null
  state: State
  lastOp: OpStatus | null
  signAccountOpController: SignAccountOpController | null
  latestBroadcastedAccountOp: AccountOp | null
  hasProceeded: boolean
}

const PrivacyPoolsV1ControllerStateContext =
  createContext<PrivacyPoolsV1ControllerStateContextType>({
    balance: [],
    notes: [],
    syncState: 'unsynced',
    isInitialized: false,
    initializationError: null,
    init: () => {},
    sync: () => {},
    shield: () => {},
    prepareUnshield: () => {},
    unshield: () => {},
    pendingUnshieldOperation: null,
    state: 'idle',
    lastOp: null,
    signAccountOpController: null,
    latestBroadcastedAccountOp: null,
    hasProceeded: false
  })

const PrivacyPoolsV1ControllerStateProvider: React.FC<{ children: React.ReactNode }> = ({
  children
}) => {
  const { state, dispatch } = useController('PrivacyPoolsV1Controller')

  const memoizedState = useDeepMemo(state, 'PrivacyPoolsV1Controller')

  const init = useCallback(() => {
    dispatch({ type: 'method', params: { method: 'init', args: [] } })
  }, [dispatch])

  const sync = useCallback(() => {
    dispatch({ type: 'method', params: { method: 'sync', args: [] } })
  }, [dispatch])

  const shield = useCallback(
    (asset: PPv1AssetAmount) => {
      dispatch({ type: 'method', params: { method: 'prepareShield', args: [asset] } })
    },
    [dispatch]
  )

  const prepareUnshield = useCallback(
    (asset: PPv1AssetAmount, to: PPv1Address) => {
      dispatch({ type: 'method', params: { method: 'prepareUnshield', args: [asset, to] } })
    },
    [dispatch]
  )

  const unshield = useCallback(() => {
    dispatch({ type: 'method', params: { method: 'unshield', args: [] } })
  }, [dispatch])

  const value = useMemo<PrivacyPoolsV1ControllerStateContextType>(
    () => ({
      balance: memoizedState?.balance ?? [],
      syncState: memoizedState?.syncState ?? 'unsynced',
      isInitialized: memoizedState?.isInitialized ?? false,
      initializationError: memoizedState?.initializationError ?? null,
      state: memoizedState?.state ?? 'idle',
      lastOp: memoizedState?.lastOperation ?? null,
      init,
      sync,
      shield,
      prepareUnshield,
      unshield,
      notes: memoizedState?.notes ?? [],
      signAccountOpController: memoizedState?.signAccountOpController ?? null,
      latestBroadcastedAccountOp: memoizedState?.latestBroadcastedAccountOp ?? null,
      hasProceeded: memoizedState?.hasProceeded ?? false,
      pendingUnshieldOperation: memoizedState?.pendingUnshieldOperation ?? null
    }),
    [memoizedState, init, sync, shield, prepareUnshield, unshield]
  )

  return (
    <PrivacyPoolsV1ControllerStateContext.Provider value={value}>
      {children}
    </PrivacyPoolsV1ControllerStateContext.Provider>
  )
}

export { PrivacyPoolsV1ControllerStateContext, PrivacyPoolsV1ControllerStateProvider }
export type { PrivacyPoolsV1ControllerStateContextType }
