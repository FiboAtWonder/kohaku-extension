import React, { FC, useMemo } from 'react'
import { View } from 'react-native'

import Avatar from '@common/components/Avatar'
import Text from '@common/components/Text'
import useTheme from '@common/hooks/useTheme'
import useWindowSize from '@common/hooks/useWindowSize'
import Header from '@common/modules/header/components/Header'
import spacings from '@common/styles/spacings'
import flexbox from '@common/styles/utils/flexbox'
import { TabLayoutContainer, TabLayoutWrapperMainContent } from '@web/components/TabLayoutWrapper'
import {
  getTabLayoutPadding,
  tabLayoutWidths
} from '@web/components/TabLayoutWrapper/TabLayoutWrapper'
import { getUiType } from '@common/utils/uiType'
import { useTranslation } from 'react-i18next'

import HokahuLogo from '@common/components/HokahuLogo'
import getStyles from './styles'
import useController from '@common/hooks/useController'

const { isTab } = getUiType()

type WrapperProps = {
  children: React.ReactNode
  title?: string | React.ReactNode
  description?: string
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

const Wrapper: FC<WrapperProps> = ({ children, title, description, buttons }) => {
  const { t } = useTranslation()
  const { theme, styles } = useTheme(getStyles)
  const { account } = useController('SelectedAccountController').state

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
                      pfp=""
                      size={32}
                      smartAccountType={
                        (account.creation && 'Ambire') || (account.safeCreation && 'Safe')
                      }
                    />
                    <View style={spacings.mlTy}>
                      <Text fontSize={16} weight="medium" numberOfLines={1}>
                        {t('Private Account')}
                      </Text>
                    </View>
                  </View>
                </View>
              )}
            </View>
            {title && (
              <View style={flexbox.alignCenter}>
                <Text fontSize={isTab ? 24 : 20} weight="medium">
                  {title}
                </Text>
                {!!description && (
                  <Text fontSize={14} appearance="secondaryText">
                    {description}
                  </Text>
                )}
              </View>
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
        ...(isTab ? (minHeightSize('m') ? {} : spacings.pt2Xl) : spacings.mt0),
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
