import React, { FC, useMemo } from 'react'
import { View } from 'react-native'

import { isSmartAccount } from '@ambire-common/libs/account/account'
import shortenAddress from '@ambire-common/utils/shortenAddress'
import CopyIcon from '@common/assets/svg/CopyIcon'
import Avatar from '@common/components/Avatar'
import Text from '@common/components/Text'
import useTheme from '@common/hooks/useTheme'
import useToast from '@common/hooks/useToast'
import useWindowSize from '@common/hooks/useWindowSize'
import Header from '@common/modules/header/components/Header'
import spacings from '@common/styles/spacings'
import flexbox from '@common/styles/utils/flexbox'
import { setStringAsync } from '@common/utils/clipboard'
import { TabLayoutContainer, TabLayoutWrapperMainContent } from '@web/components/TabLayoutWrapper'
import {
  getTabLayoutPadding,
  tabLayoutWidths
} from '@web/components/TabLayoutWrapper/TabLayoutWrapper'
import { AnimatedPressable } from '@common/hooks/useHover'
import { getUiType } from '@common/utils/uiType'
import { useTranslation } from 'react-i18next'

import HokahuLogo from '@common/components/HokahuLogo'
import getStyles from './styles'
import useController from '@common/hooks/useController'

const { isTab } = getUiType()

type WrapperProps = {
  children: React.ReactNode
  title?: string | React.ReactNode
  buttons: React.ReactNode
}

type ContentProps = {
  children: React.ReactNode
  buttons: React.ReactNode
  scrollViewRef?: React.RefObject<any>
}

type FormProps = {
  children: React.ReactNode
}

const Wrapper: FC<WrapperProps> = ({ children, title, buttons }) => {
  const { t } = useTranslation()
  const { addToast } = useToast()
  const { theme, styles } = useTheme(getStyles)
  const { account } = useController('SelectedAccountController').state

  const handleCopyText = async () => {
    if (!account) return

    try {
      await setStringAsync(account.addr)
      addToast(t('Copied address to clipboard!') as string, { timeout: 2500 })
    } catch {
      addToast(t('Failed to copy address to clipboard!') as string, {
        timeout: 2500,
        type: 'error'
      })
    }
  }

  return (
    <TabLayoutContainer
      backgroundColor={theme.secondaryBackground}
      header={
        <Header.Wrapper>
          <View
            style={[
              flexbox.directionRow,
              flexbox.alignCenter,
              flexbox.justifySpaceBetween,
              { maxWidth: Number(tabLayoutWidths.xl), width: '100%' }
            ]}
          >
            <View style={styles.headerSideContainer}>
              {account && (
                <View style={[flexbox.directionRow, flexbox.alignCenter]}>
                  <View style={[flexbox.directionRow, flexbox.alignCenter]}>
                    <Avatar
                      address={account.addr}
                      pfp={account.preferences.pfp}
                      size={32}
                      smartAccountType={
                        (account.creation && 'Ambire') || (account.safeCreation && 'Safe')
                      }
                    />
                    <View style={spacings.mlTy}>
                      <Text fontSize={16} weight="medium" numberOfLines={1}>
                        {account.preferences.label}
                      </Text>
                      <AnimatedPressable
                        style={[flexbox.directionRow, flexbox.alignCenter]}
                        onPress={handleCopyText}
                      >
                        <Text
                          fontSize={14}
                          appearance="secondaryText"
                          weight="medium"
                          style={spacings.mrMi}
                        >
                          {shortenAddress(account.addr, 13)}
                        </Text>
                        <CopyIcon width={16} height={16} />
                      </AnimatedPressable>
                    </View>
                  </View>
                </View>
              )}
            </View>
            {title && (
              <Text fontSize={isTab ? 24 : 20} weight="medium">
                {title}
              </Text>
            )}
            <View style={[styles.headerSideContainer, { alignItems: 'flex-end' }]}>
              <HokahuLogo width={72} />
            </View>
          </View>
        </Header.Wrapper>
      }
      withHorizontalPadding={false}
      footer={isTab ? buttons : null}
    >
      {children}
    </TabLayoutContainer>
  )
}

const Content: FC<ContentProps> = ({ children, buttons, scrollViewRef }) => {
  const { styles } = useTheme(getStyles)
  const { maxWidthSize, minHeightSize } = useWindowSize()
  const paddingHorizontalStyle = useMemo(() => getTabLayoutPadding(maxWidthSize), [maxWidthSize])

  return (
    <TabLayoutWrapperMainContent
      contentContainerStyle={{
        ...spacings.pv0,
        ...paddingHorizontalStyle,
        ...(isTab ? (minHeightSize('m') ? {} : spacings.pt2Xl) : {}),
        flexGrow: 1
      }}
      wrapperRef={scrollViewRef}
    >
      <View style={styles.container}>
        {children}
        {!isTab && <View style={styles.nonTabButtons}>{buttons}</View>}
      </View>
    </TabLayoutWrapperMainContent>
  )
}

const Form: FC<FormProps> = ({ children }) => {
  const { styles } = useTheme(getStyles)

  return <View style={styles.form}>{children}</View>
}

export { Wrapper, Content, Form }
