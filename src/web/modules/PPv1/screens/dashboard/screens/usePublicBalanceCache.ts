import { useCallback, useEffect, useRef, useState } from 'react'

import { captureException } from '@common/config/analytics/CrashAnalytics.web'
import { useTranslation } from '@common/config/localization'
import useController from '@common/hooks/useController'
import useToast from '@common/hooks/useToast'

type PublicBalances = { [addr: string]: number }

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
  const { t } = useTranslation()
  const { addToast } = useToast()
  const { dispatchAndWait: portfolioDispatchAndWait } = useController('PortfolioController')
  const [balanceCache, setBalanceCache] = useState<PublicBalances>({})
  const [isLoadingPublicBalances, setIsLoadingPublicBalances] = useState(true)
  const hasRequestedRef = useRef(false)
  // Increments on every request so that a response of a superseded request (e.g. the user
  // hit refresh while the previous one was still in flight) is discarded
  const requestIdRef = useRef(0)

  // Always keep the current account's balance up to date from its live portfolio
  useEffect(() => {
    if (accountAddr && portfolioIsAllReady && portfolioTotalBalance != null) {
      setBalanceCache((prev) => {
        if (prev[accountAddr] === portfolioTotalBalance) return prev
        return { ...prev, [accountAddr]: portfolioTotalBalance }
      })
    }
  }, [accountAddr, portfolioIsAllReady, portfolioTotalBalance])

  const loadTotalBalancesFor = useCallback(
    async (addrs: string[]) => {
      requestIdRef.current += 1
      const requestId = requestIdRef.current

      try {
        const balances = await portfolioDispatchAndWait<'getAccountsTotalBalances', PublicBalances>(
          {
            type: 'method',
            params: { method: 'getAccountsTotalBalances', args: [addrs] }
          },
          // A cold portfolio refresh across several accounts and networks routinely takes
          // longer than the default 10s deadline, and timing out means no balances at all
          { timeoutMs: 60_000 }
        )

        if (requestId !== requestIdRef.current) return

        setBalanceCache((prev) => ({ ...prev, ...balances }))
      } catch (error: any) {
        captureException(error)
        addToast(t('Failed to load the balances of your other accounts.'), { type: 'error' })
      } finally {
        if (requestId === requestIdRef.current) setIsLoadingPublicBalances(false)
      }
    },
    [addToast, portfolioDispatchAndWait, t]
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

    loadTotalBalancesFor(otherAddrs).catch(captureException)
  }, [accounts, accountAddr, loadTotalBalancesFor])

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

    loadTotalBalancesFor(otherAddrs).catch(captureException)
  }, [accounts, accountAddr, loadTotalBalancesFor])

  return { balanceCache, isLoadingPublicBalances, refreshPublicBalances }
}

export default usePublicBalanceCache
