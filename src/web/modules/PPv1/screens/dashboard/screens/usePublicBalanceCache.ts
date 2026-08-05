import { useCallback, useEffect, useRef, useState } from 'react'

import useController from '@common/hooks/useController'
import eventBus from '@common/services/event/eventBus'

const usePublicBalanceCache = ({
  accounts,
  accountAddr,
  portfolioIsAllReady,
  portfolioTotalBalance
}: {
  accounts: { addr: string }[]
  accountAddr: string | undefined
  portfolioIsAllReady: boolean | undefined
  portfolioTotalBalance: number | null | undefined
}) => {
  const { dispatch: portfolioDispatch } = useController('PortfolioController')
  const [balanceCache, setBalanceCache] = useState<{ [addr: string]: number }>({})
  const [isLoadingPublicBalances, setIsLoadingPublicBalances] = useState(true)
  const hasRequestedRef = useRef(false)

  // Always keep the current account's balance up to date from its live portfolio
  useEffect(() => {
    if (accountAddr && portfolioIsAllReady && portfolioTotalBalance != null) {
      setBalanceCache((prev) => {
        if (prev[accountAddr] === portfolioTotalBalance) return prev
        return { ...prev, [accountAddr]: portfolioTotalBalance }
      })
    }
  }, [accountAddr, portfolioIsAllReady, portfolioTotalBalance])

  /**
   * @TODO (kohaku-resync) The `PORTFOLIO_LOAD_ACCOUNTS_TOTAL_BALANCES` background handler that
   * aggregated the per-account totals and emitted the `accountTotalBalances` event was removed
   * when upstream replaced the typed action switch with the generic controller-method dispatcher.
   * Refreshing each account's portfolio still works, but the aggregated event never arrives, so
   * the listener below stays idle. The aggregation has to be reimplemented (e.g. as a
   * `PortfolioController` method) before the public balances list can render again.
   */
  const loadTotalBalancesFor = useCallback(
    (addrs: string[]) => {
      addrs.forEach((addr) => {
        portfolioDispatch({
          type: 'method',
          params: { method: 'updateSelectedAccount', args: [addr] }
        })
      })
    },
    [portfolioDispatch]
  )

  // On mount, request all account balances in parallel
  useEffect(() => {
    if (!accounts.length || !accountAddr || hasRequestedRef.current) return

    hasRequestedRef.current = true
    const otherAddrs = accounts.map((a) => a.addr).filter((addr) => addr !== accountAddr)

    if (!otherAddrs.length) {
      setIsLoadingPublicBalances(false)
      return
    }

    loadTotalBalancesFor(otherAddrs)
  }, [accounts, accountAddr, loadTotalBalancesFor])

  // Listen for the parallel-loaded results from the background
  useEffect(() => {
    const handler = (balances: { [addr: string]: number }) => {
      setBalanceCache((prev) => ({ ...prev, ...balances }))
      setIsLoadingPublicBalances(false)
    }

    eventBus.addEventListener('accountTotalBalances', handler)
    return () => eventBus.removeEventListener('accountTotalBalances', handler)
  }, [])

  const refreshPublicBalances = useCallback(() => {
    if (!accounts.length || !accountAddr) return
    setBalanceCache((prev) => ({ [accountAddr]: prev[accountAddr] ?? 0 }))
    setIsLoadingPublicBalances(true)
    hasRequestedRef.current = false

    const otherAddrs = accounts.map((a) => a.addr).filter((addr) => addr !== accountAddr)
    if (!otherAddrs.length) {
      setIsLoadingPublicBalances(false)
      return
    }

    loadTotalBalancesFor(otherAddrs)
  }, [accounts, accountAddr, loadTotalBalancesFor])

  return { balanceCache, isLoadingPublicBalances, refreshPublicBalances }
}

export default usePublicBalanceCache
