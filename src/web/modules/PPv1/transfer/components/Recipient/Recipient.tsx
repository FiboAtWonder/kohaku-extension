import React, { useCallback, useEffect, useMemo, useRef } from 'react'
import { useTranslation } from 'react-i18next'
import { View } from 'react-native'
import { useModalize } from 'react-native-modalize'

import { TransferController } from '@ambire-common/controllers/transfer/transfer'
import { TokenResult } from '@ambire-common/libs/portfolio'
import { getSearchableNames } from '@ambire-common/services/nameResolvers'
import { Validation } from '@ambire-common/services/validations'
import AddressBookIcon from '@common/assets/svg/AddressBookIcon'
import DownArrowIcon from '@common/assets/svg/DownArrowIcon'
import SettingsIcon from '@common/assets/svg/SettingsIcon'
import UpArrowIcon from '@common/assets/svg/UpArrowIcon'
import WalletIcon from '@common/assets/svg/WalletIcon'
import AddressInput from '@common/components/AddressInput'
import { InputProps } from '@common/components/Input'
import Text from '@common/components/Text'
import useNavigation from '@common/hooks/useNavigation'
import useTheme from '@common/hooks/useTheme'
import { ROUTES } from '@common/modules/router/constants/common'
import spacings from '@common/styles/spacings'
import flexbox from '@common/styles/utils/flexbox'
import useHover, { AnimatedPressable } from '@common/hooks/useHover'

import AddressBookContact from '@common/components/AddressBookContact'
import { SectionedSelect } from '@common/components/Select'
import {
  RenderSelectedOptionParams,
  SectionedSelectProps,
  SelectValue
} from '@common/components/Select/types'
import TitleAndIcon from '@common/components/TitleAndIcon'
import AddContactBottomSheet from '@common/components/Recipient/AddContactBottomSheet'
import AddToAddressBook from '@common/components/Recipient/AddToAddressBook'
import styles from '@common/components/Recipient/styles'
import useAccountsList from '@common/hooks/useAccountsList'
import { zeroAddress } from 'viem'
import useController from '@common/hooks/useController'

interface Props extends InputProps {
  setAddress: (text: string) => void
  address: string
  ensAddress: string
  addressValidationMsg: string
  isRecipientHumanizerKnownTokenOrSmartContract: boolean
  isRecipientAddressUnknown: boolean
  isRecipientAddressUnknownAgreed: TransferController['isRecipientAddressUnknownAgreed']
  onRecipientCheckboxClick: () => void
  validation: Validation
  isRecipientDomainResolving: boolean
  /**
   * @TODO (kohaku-resync) Upstream dropped the explicit "I understand" checkbox for unknown
   * recipients (ConfirmAddress) in favour of the AddToAddressBook prompt, so these three props
   * are currently inert. Decide whether the confirmation should come back.
   */
  isSWWarningVisible: boolean
  isSWWarningAgreed: boolean
  recipientMenuClosedAutomaticallyRef: React.MutableRefObject<boolean>
  selectedTokenSymbol?: TokenResult['symbol']
  menuPosition?: 'top' | 'bottom'
}

const ADDRESS_BOOK_VISIBLE_VALIDATION: Validation = {
  severity: 'error', // Don't let the user submit, just in case there is an error
  message: ''
}

const SelectedMenuOption: React.FC<{
  selectRef: React.RefObject<any>
  validation: Validation
  isMenuOpen: boolean
  ensAddress: string
  isRecipientDomainResolving: boolean
  address: string
  setAddress: (text: string) => void
  disabled?: boolean
  toggleMenu: () => void
  isAddressInAddressBook: boolean
  totalAvailableOptions: number
  recipientMenuClosedAutomaticallyRef: React.MutableRefObject<boolean>
}> = ({
  selectRef,
  totalAvailableOptions,
  validation,
  isMenuOpen,
  ensAddress,
  isRecipientDomainResolving,
  address,
  setAddress,
  disabled,
  toggleMenu,
  isAddressInAddressBook,
  recipientMenuClosedAutomaticallyRef
}) => {
  const { theme } = useTheme()

  useEffect(() => {
    if (isMenuOpen && !totalAvailableOptions) {
      toggleMenu()

      recipientMenuClosedAutomaticallyRef.current = true
    } else if (
      recipientMenuClosedAutomaticallyRef.current &&
      !isMenuOpen &&
      totalAvailableOptions &&
      // Reopen the menu only if the address is invalid
      // Otherwise we will reopen it while the user is done with this field
      // and wants to proceed
      validation.severity === 'error'
    ) {
      toggleMenu()

      recipientMenuClosedAutomaticallyRef.current = false
    }
  }, [
    address,
    totalAvailableOptions,
    isMenuOpen,
    recipientMenuClosedAutomaticallyRef,
    toggleMenu,
    validation.severity
  ])

  return (
    <AddressInput
      inputBorderWrapperRef={selectRef}
      validation={isMenuOpen ? ADDRESS_BOOK_VISIBLE_VALIDATION : validation}
      containerStyle={styles.inputContainer}
      resolvedAddress={ensAddress}
      resolvedAddressType={ensAddress ? 'ens' : null}
      isRecipientDomainResolving={isRecipientDomainResolving}
      label="Add recipient"
      value={address}
      onChangeText={setAddress}
      disabled={disabled}
      onFocus={toggleMenu}
      childrenBeforeButtons={
        <AddressBookIcon
          color={theme[isAddressInAddressBook ? 'primary' : 'secondaryText']}
          opacity={isAddressInAddressBook ? 1 : 0.25}
          style={spacings.mrTy}
          width={24}
          height={24}
        />
      }
      button={isMenuOpen ? <UpArrowIcon /> : <DownArrowIcon />}
      buttonProps={{
        onPress: toggleMenu
      }}
      buttonStyle={{ ...spacings.pv0, ...spacings.ph, ...spacings.mr0, ...spacings.ml0 }}
      inputWrapperStyle={{ backgroundColor: theme.surfaceInput }}
    />
  )
}

const Recipient: React.FC<Props> = ({
  setAddress,
  address,
  ensAddress,
  addressValidationMsg,
  isRecipientAddressUnknownAgreed,
  onRecipientCheckboxClick,
  isRecipientHumanizerKnownTokenOrSmartContract,
  isRecipientAddressUnknown,
  validation,
  isRecipientDomainResolving,
  disabled,
  isSWWarningVisible,
  isSWWarningAgreed,
  selectedTokenSymbol,
  recipientMenuClosedAutomaticallyRef
}) => {
  const { account } = useController('SelectedAccountController').state
  const actualAddress = ensAddress || address
  const { navigate } = useNavigation()
  const { t } = useTranslation()
  const { theme } = useTheme()
  const { ref: sheetRef, open: openBottomSheet, close: closeBottomSheet } = useModalize()
  const { contacts } = useController('AddressBookController').state

  const flatlistRef = useRef(null)
  const { accounts } = useAccountsList({ flatlistRef })
  const { domains } = useController('DomainsController').state
  const [bindManageBtnAnim, manageBtnAnimStyle] = useHover({
    preset: 'opacityInverted'
  })

  const myWalletAccounts = accounts.filter((contact) => contact.addr !== zeroAddress)

  const onManagePress = useCallback(() => {
    navigate(ROUTES.addressBook)
  }, [navigate])

  const isAddressInAddressBook = contacts.some((contact) => {
    return (
      actualAddress.toLowerCase() === contact.address.toLowerCase() ||
      myWalletAccounts.some(
        (myWalletAccount) => myWalletAccount.addr.toLowerCase() === actualAddress.toLowerCase()
      )
    )
  })

  const filteredContacts = useMemo(
    () =>
      contacts.filter((contact) => {
        if (!actualAddress) return true

        const lowercaseActualAddress = actualAddress.toLowerCase()
        const lowercaseName = contact.name.toLowerCase()
        const lowercaseAddress = contact.address.toLowerCase()
        const doesDomainMatch = getSearchableNames(domains[contact.address]?.names)
          .toLowerCase()
          .includes(lowercaseActualAddress)

        return (
          lowercaseAddress.includes(lowercaseActualAddress) ||
          lowercaseName.includes(lowercaseActualAddress) ||
          doesDomainMatch
        )
      }),
    [contacts, actualAddress, domains]
  )

  const setAddressWrapped = useCallback(
    ({ value: newAddress }: Pick<SelectValue, 'value'>) => {
      if (typeof newAddress !== 'string') return

      const correspondingDomain = domains[newAddress]?.names.ens

      setAddress(correspondingDomain || newAddress)
    },
    [domains, setAddress]
  )

  const walletAccountsSourcedContactOptions = useMemo(
    () =>
      myWalletAccounts.map(({ addr }, index) => ({
        value: addr,
        label: (
          <AddressBookContact
            avatarSize={32}
            testID={`address-book-my-wallet-contact-${index + 1}`}
            key={addr}
            style={{
              borderRadius: 0,
              ...spacings.ph0,
              ...spacings.pv0
            }}
            address={addr}
            name={`Address #${index + 1}`}
          />
        )
      })),
    [myWalletAccounts]
  )

  const manuallyAddedContactOptions = useMemo(
    () =>
      filteredContacts
        .filter((contact) => !contact.isWalletAccount)
        .map((contact) => ({
          value: contact.address,
          label: (
            <AddressBookContact
              avatarSize={32}
              key={contact.address}
              style={{
                borderRadius: 0,
                ...spacings.ph0,
                ...spacings.pv0
              }}
              address={contact.address}
              name={contact.name}
            />
          )
        })),
    [filteredContacts]
  )

  const selectedOption = useMemo(
    () =>
      walletAccountsSourcedContactOptions.find((contact) => contact.value === address) ||
      manuallyAddedContactOptions.find((contact) => contact.value === address),
    [walletAccountsSourcedContactOptions, manuallyAddedContactOptions, address]
  )

  const sections = useMemo(() => {
    if (!walletAccountsSourcedContactOptions.length && !manuallyAddedContactOptions.length)
      return []

    return [
      {
        data: walletAccountsSourcedContactOptions,
        key: 'my-wallets'
      },
      {
        data: manuallyAddedContactOptions,
        key: 'contacts'
      }
    ]
  }, [walletAccountsSourcedContactOptions, manuallyAddedContactOptions])

  const renderSectionHeader = useCallback(
    ({ section }: { section: SectionedSelectProps['sections'][0] }) => {
      if (section.data.length === 0) return null

      return section.key === 'contacts' ? (
        <TitleAndIcon title={t('Address Book')} icon={AddressBookIcon}>
          <AnimatedPressable
            style={[flexbox.directionRow, flexbox.alignCenter, manageBtnAnimStyle]}
            onPress={onManagePress}
            {...bindManageBtnAnim}
          >
            <SettingsIcon width={18} height={18} color={theme.secondaryText} />
            <Text fontSize={14} style={spacings.mlMi} appearance="secondaryText">
              {t('Manage contacts')}
            </Text>
          </AnimatedPressable>
        </TitleAndIcon>
      ) : (
        <TitleAndIcon title={t('My wallets')} icon={WalletIcon} />
      )
    },
    [bindManageBtnAnim, manageBtnAnimStyle, onManagePress, t, theme.secondaryText]
  )

  const renderSelectedOption = useCallback(
    ({ toggleMenu, isMenuOpen, selectRef }: RenderSelectedOptionParams) => {
      const totalAvailableOptions =
        walletAccountsSourcedContactOptions.length + manuallyAddedContactOptions.length
      return (
        <SelectedMenuOption
          toggleMenu={toggleMenu}
          selectRef={selectRef}
          totalAvailableOptions={totalAvailableOptions}
          isMenuOpen={isMenuOpen}
          validation={isMenuOpen ? ADDRESS_BOOK_VISIBLE_VALIDATION : validation}
          ensAddress={ensAddress}
          isRecipientDomainResolving={isRecipientDomainResolving}
          address={address}
          setAddress={setAddress}
          disabled={disabled}
          isAddressInAddressBook={isAddressInAddressBook}
          recipientMenuClosedAutomaticallyRef={recipientMenuClosedAutomaticallyRef}
        />
      )
    },
    [
      walletAccountsSourcedContactOptions.length,
      manuallyAddedContactOptions.length,
      validation,
      ensAddress,
      isRecipientDomainResolving,
      address,
      setAddress,
      disabled,
      isAddressInAddressBook,
      recipientMenuClosedAutomaticallyRef
    ]
  )

  return (
    <>
      <SectionedSelect
        value={selectedOption}
        setValue={setAddressWrapped}
        sections={sections}
        headerHeight={32}
        menuOptionHeight={54}
        withSearch={false}
        renderSectionHeader={renderSectionHeader}
        renderSelectedOption={renderSelectedOption}
        emptyListPlaceholderText={t('No contacts found')}
        menuPosition="bottom"
      />
      <View style={styles.inputBottom}>
        <AddToAddressBook
          isRecipientHumanizerKnownTokenOrSmartContract={
            isRecipientHumanizerKnownTokenOrSmartContract
          }
          isRecipientAddressUnknown={isRecipientAddressUnknown}
          isRecipientAddressSameAsSender={actualAddress === account?.addr}
          addressValidationMsg={addressValidationMsg}
          onAddToAddressBookPress={openBottomSheet}
        />
      </View>
      <AddContactBottomSheet
        sheetRef={sheetRef}
        address={ensAddress || address}
        closeBottomSheet={closeBottomSheet}
      />
    </>
  )
}

export default React.memo(Recipient)
