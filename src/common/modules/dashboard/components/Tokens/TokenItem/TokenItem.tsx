import React, { useCallback, useMemo } from 'react'

import KohakuLogo from '@common/components/HokahuLogo'
import Text from '@common/components/Text'
import { useTranslation } from '@common/config/localization'
import useController from '@common/hooks/useController'
import { AnimatedPressable, useCustomHover } from '@common/hooks/useHover'
import useNavigation from '@common/hooks/useNavigation'
import useTheme from '@common/hooks/useTheme'
import getAndFormatTokenDetails from '@common/modules/dashboard/helpers/getTokenDetails'
import { ROUTES } from '@common/modules/router/constants/common'
import spacings from '@common/styles/spacings'
import { BORDER_RADIUS_PRIMARY } from '@common/styles/utils/common'
import flexbox from '@common/styles/utils/flexbox'
import { getUiType } from '@common/utils/uiType'

import BaseTokenItem from './BaseTokenItem'
import RewardsTokenItem from './RewardsTokenItem'

import type { TokenResult } from '@ambire-common/libs/portfolio'
const { isPopup } = getUiType()

// Shortcut from a funded token straight into the Privacy Pools deposit flow (kohaku)
const ShieldTokenButton = ({ token }: { token: TokenResult }) => {
  const { t } = useTranslation()
  const { theme } = useTheme()
  const { navigate } = useNavigation()
  const [bindAnim, animStyle] = useCustomHover({
    property: 'backgroundColor',
    values: { from: theme.primaryBackgroundInverted, to: theme.tertiaryBackground }
  })

  const onPress = useCallback(() => {
    navigate(ROUTES.pp1Deposit, { state: { token } })
  }, [navigate, token])

  return (
    <AnimatedPressable
      testID="token-button-shield"
      onPress={onPress}
      style={[
        flexbox.directionRow,
        flexbox.alignCenter,
        spacings.phTy,
        { paddingVertical: 5, borderRadius: BORDER_RADIUS_PRIMARY },
        animStyle
      ]}
      {...bindAnim}
    >
      <Text weight="regular" fontSize={11} color={theme.primaryBackground} style={spacings.mrMi}>
        {t('Shield It!')}
      </Text>
      <KohakuLogo height={13} width={13} />
    </AnimatedPressable>
  )
}

const TokenItem = ({ token }: { token: TokenResult }) => {
  const { dispatch: requestsDispatch } = useController('RequestsController')
  const { state: portfolio } = useController(
    'SelectedAccountController',
    (state) => state.portfolio
  )
  const { state: networks } = useController('NetworksController', (state) => state.networks)
  const simulatedAccountOp = portfolio.networkSimulatedAccountOp[token.chainId.toString()]
  const { isVesting, isRewards, balance } = getAndFormatTokenDetails(
    token,
    networks,
    simulatedAccountOp
  )

  const sendTransaction = useCallback(
    (type: 'claimWalletRequest' | 'mintVestingRequest') => {
      requestsDispatch({
        type: 'method',
        params: {
          method: 'build',
          args: [{ type, params: { token } }]
        }
      })
    },
    [requestsDispatch, token]
  )

  // Only funded tokens can be shielded (kohaku)
  const extraActions = useMemo(
    () => (Number(balance) > 0 ? <ShieldTokenButton token={token} /> : undefined),
    [balance, token]
  )

  if (isRewards)
    return (
      <RewardsTokenItem
        token={token}
        onPress={() => sendTransaction('claimWalletRequest')}
        actionButtonText="Claim"
        description="Claimable rewards"
      />
    )
  if (isVesting)
    return (
      <RewardsTokenItem
        token={token}
        actionButtonText="Claim"
        onPress={() => sendTransaction('mintVestingRequest')}
        description={!isPopup ? 'Claimable early supporters vestings' : 'Claimable vestings'}
      />
    )

  return <BaseTokenItem token={token} extraActions={extraActions} />
}

export default React.memo(TokenItem)
