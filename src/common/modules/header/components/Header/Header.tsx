import React, { useEffect, useState } from 'react'
import { View, ViewStyle } from 'react-native'
import { TextProps } from 'react-native-svg'

import AccountData from '@common/components/AccountData'
import AccountDataDetailed from '@common/components/AccountDataDetailed'
// (kohaku) Kohaku logo replaces the Ambire logo (incl. the OG variant) in headers
import KohakuLogo from '@common/components/HokahuLogo'
import Text from '@common/components/Text'
import { isMobile, isWeb } from '@common/config/env'
import { titleChangeEventStream } from '@common/hooks/useNavigation'
import useRoute from '@common/hooks/useRoute'
import routesConfig from '@common/modules/router/config/routesConfig'
import spacings from '@common/styles/spacings'
import flexbox from '@common/styles/utils/flexbox'
import { tabLayoutWidths } from '@web/components/TabLayoutWrapper'

import HeaderBackButton, { DisplayIn } from '../HeaderBackButton'

type Width = 'sm' | 'md' | 'lg' | 'xl' | 'full'

const HEADER_HEIGHT = 60

const Wrapper = ({
  children,
  style,
  containerStyle,
  width = 'xl'
}: {
  children?: React.ReactNode
  style?: ViewStyle
  containerStyle?: ViewStyle
  width?: Width
}) => {
  return (
    <View
      style={[
        spacings.phSm,
        isWeb && spacings.pvSm,
        isWeb && spacings.ptMd,
        isMobile && spacings.mbLg,
        {
          width: '100%'
        },
        containerStyle
      ]}
    >
      <View
        style={[
          flexbox.directionRow,
          flexbox.justifySpaceBetween,
          flexbox.alignCenter,
          { maxWidth: Number(tabLayoutWidths[width]), width: '100%', marginHorizontal: 'auto' },
          style
        ]}
      >
        {children}
      </View>
    </View>
  )
}

const Title = ({ children, ...rest }: { children: React.ReactNode } & TextProps) => {
  return (
    <Text
      {...rest}
      fontSize={isMobile ? 18 : 20}
      weight="medium"
      style={[
        {
          display: 'flex'
        },
        flexbox.flex1,
        flexbox.directionRow,
        flexbox.alignCenter,
        flexbox.justifyCenter,
        {
          textAlign: 'center'
        }
      ]}
    >
      {children}
    </Text>
  )
}

type CommonHeaderProps = {
  width?: Width
  withOG?: boolean
}

const Header = ({ width }: CommonHeaderProps) => {
  return (
    <Wrapper width={width}>
      <AccountData />
      <KohakuLogo width={72} />
    </Wrapper>
  )
}

const Container = ({
  side,
  style,
  children
}: {
  side: 'left' | 'right'
  style?: ViewStyle
  children?: React.ReactNode
}) => {
  return (
    <View style={[{ flex: 0.5 }, side === 'left' ? flexbox.alignStart : flexbox.alignEnd, style]}>
      {children}
    </View>
  )
}

const HeaderWithTitle = ({
  title: customTitle,
  displayBackButtonIn,
  children,
  withBackButton = true,
  width
}: {
  title?: string
  displayBackButtonIn?: DisplayIn | DisplayIn[]
  children?: React.ReactNode
  withBackButton?: boolean
} & CommonHeaderProps) => {
  const [title, setTitle] = useState('')
  const { path } = useRoute()

  useEffect(() => {
    if (!path) return

    const nextRoute = path?.substring(1)
    setTitle((routesConfig as any)?.[nextRoute]?.title || '')
  }, [path])

  useEffect(() => {
    const subscription = titleChangeEventStream!.subscribe({ next: (v) => setTitle(v) })
    return () => subscription.unsubscribe()
  }, [])

  return (
    <Wrapper width={width}>
      <Container side="left">
        {withBackButton && <HeaderBackButton displayIn={displayBackButtonIn} />}
      </Container>
      <Title>{customTitle || title}</Title>
      <Container side="right">{children || <KohakuLogo width={72} />}</Container>
    </Wrapper>
  )
}

const HeaderWithLogoOnly = ({ width }: CommonHeaderProps & { withOG?: boolean }) => {
  return (
    <Wrapper style={flexbox.justifyEnd} width={width}>
      <KohakuLogo width={72} />
    </Wrapper>
  )
}

// Please don't add 1000 props to the other headers.
// If you need something custom, compose it using these
Header.Wrapper = Wrapper
Header.AccountData = AccountData
Header.AccountDataDetailed = AccountDataDetailed
Header.Title = Title
Header.Container = Container
Header.BackButton = HeaderBackButton
Header.Logo = KohakuLogo

export default Header
export { HeaderWithTitle, HeaderWithLogoOnly, HEADER_HEIGHT }
