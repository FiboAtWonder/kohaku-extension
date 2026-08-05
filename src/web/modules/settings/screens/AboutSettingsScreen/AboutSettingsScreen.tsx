import React, { useContext, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { Pressable } from 'react-native'

import NewsletterIcon from '@common/assets/svg/NewsletterIcon'
import OpenIcon from '@common/assets/svg/OpenIcon'
import TosIcon from '@common/assets/svg/TosIcon'
import Badge from '@common/components/Badge'
import ControlOption from '@common/components/ControlOption'
import { APP_VERSION } from '@common/config/env'
import useNavigation from '@common/hooks/useNavigation'
import useTheme from '@common/hooks/useTheme'
import { ROUTES } from '@common/modules/router/constants/common'
import spacings from '@common/styles/spacings'
import flexbox from '@common/styles/utils/flexbox'
import { openInTab } from '@common/utils/links'
import { SettingsRoutesContext } from '@web/modules/settings/contexts/SettingsRoutesContext'

import SettingsPageHeader from '../../components/SettingsPageHeader'

const AboutSettingsScreen = () => {
  const { theme } = useTheme()
  const { t } = useTranslation()
  const { navigate } = useNavigation()
  const { setCurrentSettingsPage } = useContext(SettingsRoutesContext)

  useEffect(() => {
    setCurrentSettingsPage('about')
  }, [setCurrentSettingsPage])

  const openTos = () => {
    navigate(ROUTES.settingsTerms)
  }

  const openNewsletter = async () => {
    await openInTab({ url: 'https://web3onfire.com/' })
  }

  return (
    <>
      <SettingsPageHeader title="About Ambire Wallet" style={flexbox.justifyStart}>
        <Badge size="md" type="info" text={`v${APP_VERSION}`} style={spacings.ml} />
      </SettingsPageHeader>
      <ControlOption
        style={spacings.mbTy}
        title={t('Terms of Service')}
        description={t('Take a moment to review the full Terms of Service of Ambire Wallet.')}
        renderIcon={<TosIcon color={theme.primaryText} />}
        onPress={openTos}
      >
        <Pressable onPress={openTos}>
          <OpenIcon />
        </Pressable>
      </ControlOption>
      <ControlOption
        style={spacings.mbXl}
        title={t('Newsletter subscription')}
        description={t(
          'Sign up for our newsletter and be the first to know about our exciting new features and updates.'
        )}
        renderIcon={<NewsletterIcon color={theme.primaryText} />}
        onPress={openNewsletter}
      >
        <Pressable onPress={openNewsletter}>
          <OpenIcon />
        </Pressable>
      </ControlOption>
      {/*
        @TODO (kohaku) A "Follow us on" section used to render Ambire's X/Telegram/Discord links
        from the NavMenu `SOCIAL` list. It was removed with the rebrand - add the Kohaku socials
        here once they exist.
      */}
    </>
  )
}

export default React.memo(AboutSettingsScreen)
