import React, { useEffect, useRef } from 'react'
import useController from '@common/hooks/useController'
import useToast from '@common/hooks/useToast'
import DashboardScreen from './dashboard/screens/DashboardScreen'
import usePrivacyPoolsForm from '../hooks/usePrivacyPoolsForm'

const HomeScreen = () => {
  const { dispatch: privacyPoolsDispatch } = useController('PrivacyPoolsController')
  const { addToast } = useToast()
  // const { isAccountLoaded, isReadyToLoad, loadPrivateAccount } = usePrivacyPoolsForm()
  const hasLoadedRef = useRef(false)

  // useEffect(() => {
  //   if (!isAccountLoaded && !hasLoadedRef.current && isReadyToLoad) {
  //     hasLoadedRef.current = true
  //     loadPrivateAccount().catch((error) => {
  //       console.error('Failed to load private account:', error)
  //       addToast('Failed to load your privacy account. Please try again.', { type: 'error' })
  //     })
  //   }
  // }, [isAccountLoaded, isReadyToLoad, loadPrivateAccount, addToast])

  useEffect(() => {
    return () => {
      privacyPoolsDispatch({ type: 'method', params: { method: 'unloadScreen', args: [] } })
    }
  }, [privacyPoolsDispatch])

  return <DashboardScreen />
}

export default React.memo(HomeScreen)
