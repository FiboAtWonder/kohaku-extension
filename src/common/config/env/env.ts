import * as Application from 'expo-application'
import { Platform } from 'react-native'

import {
  ALCHEMY_API_KEY,
  BUNGEE_API_KEY,
  COLIBRI_DEBUG,
  COLIBRI_PROVER_URLS,
  COLIBRI_TRUSTED_CHECKPOINT,
  EnvTypes,
  HELIOS_CHECKPOINT,
  HYPERSYNC_API_KEY,
  LI_FI_API_KEY,
  NFT_CDN_URL,
  PRIVACY_POOLS_ASP_URL,
  PRIVACY_POOLS_RELAYER_URL,
  RAILGUN_DELEGATING_SIGNER_PK,
  RAILGUN_RELAYER_URL,
  RELAYER_URL,
  RPC_PROVIDER,
  SENTRY_DSN,
  SEPOLIA_RPC_URL,
  SQUID_INTEGRATOR_ID,
  UNISWAP_API_KEY,
  USE_COLIBRI,
  VELCRO_URL,
  WALLETCONNECT_PROJECT_ID
} from '@env'

import appJSON from '../../../../app.json'

export const isTesting = process.env.IS_TESTING === 'true'
const runtimeAppEnv =
  process.env.APP_ENV || (typeof __DEV__ !== 'undefined' && __DEV__ ? 'development' : 'production')
export const isDev = runtimeAppEnv === 'development'
export const isProd = runtimeAppEnv === 'production'
export const isStaging = runtimeAppEnv === 'staging'
export const isBenzin = process.env.BENZIN === 'true'
export const isLegends = process.env.LEGENDS === 'true'
export const isLedgerEmulator = process.env.IS_LEDGER_EMULATOR === 'true'
/**
 * Ambire Next is a separate production build variant used for beta testing and preview
 * before releasing features to the main production build. It allows us to have two
 * production webkit builds with different branding for testing purposes.
 */
export const isAmbireNext = process.env.AMBIRE_NEXT === 'true'

/** On Android, this is the package name. On iOS, this is the bundle ID. */
export const APP_ID = Application.applicationId
/**
 * Internal app version, example: 1.0.0 (follows semantic versioning).
 * Fallback to the appJSON version, because in web mode Constants are missing.
 */
export const APP_VERSION = appJSON.version
/**
 * The internal build version of the native build (binary).
 * This is the Info.plist value for `CFBundleVersion` on iOS and
 * the `versionCode` set by `build.gradle` on Android.
 */
export const BUILD_NUMBER = Application.nativeBuildVersion || 'N/A'

export const isMobile = Platform.OS === 'ios' || Platform.OS === 'android'
export const isiOS = Platform.OS === 'ios'
export const isAndroid = Platform.OS === 'android'
export const isWeb = Platform.OS === 'web'

enum APP_ENV {
  PROD = 'production',
  STAGING = 'staging',
  DEV = 'development'
}

interface Config extends EnvTypes {
  APP_ENV: APP_ENV
}

const CONFIG: Config = {
  APP_ENV: APP_ENV.DEV,
  RELAYER_URL,
  VELCRO_URL,
  SENTRY_DSN,
  NFT_CDN_URL: NFT_CDN_URL || 'https://nftcdn.ambire.com',
  ENVIRONMENT: process.env.ENVIRONMENT || 'development',
  DEFAULT_KEYSTORE_PASSWORD_DEV: process.env.DEFAULT_KEYSTORE_PASSWORD_DEV || '',
  LEGENDS_NFT_ADDRESS:
    process.env.LEGENDS_NFT_ADDRESS || '0xF51dF52d0a9BEeB7b6E4B6451e729108a115B863',
  SENTRY_DSN_LEGENDS: process.env.SENTRY_DSN_LEGENDS || '',
  SENTRY_DSN_BROWSER_EXTENSION: process.env.SENTRY_DSN_BROWSER_EXTENSION || '',
  BUNGEE_API_KEY,
  LI_FI_API_KEY,
  SQUID_INTEGRATOR_ID: SQUID_INTEGRATOR_ID || '',
  UNISWAP_API_KEY: UNISWAP_API_KEY || '',
  WALLETCONNECT_PROJECT_ID,
  // Kohaku privacy-feature configuration (kohaku)
  ALCHEMY_API_KEY: ALCHEMY_API_KEY || '',
  SEPOLIA_RPC_URL: SEPOLIA_RPC_URL || '',
  PRIVACY_POOLS_ASP_URL: PRIVACY_POOLS_ASP_URL || '',
  PRIVACY_POOLS_RELAYER_URL: PRIVACY_POOLS_RELAYER_URL || '',
  HYPERSYNC_API_KEY: HYPERSYNC_API_KEY || '',
  RAILGUN_RELAYER_URL: RAILGUN_RELAYER_URL || '',
  RAILGUN_DELEGATING_SIGNER_PK: RAILGUN_DELEGATING_SIGNER_PK || '',
  RPC_PROVIDER: RPC_PROVIDER || 'rpc',
  HELIOS_CHECKPOINT: HELIOS_CHECKPOINT || '',
  USE_COLIBRI: USE_COLIBRI || '',
  COLIBRI_PROVER_URLS: COLIBRI_PROVER_URLS || '',
  COLIBRI_TRUSTED_CHECKPOINT: COLIBRI_TRUSTED_CHECKPOINT || '',
  COLIBRI_DEBUG: COLIBRI_DEBUG || ''
}

if (isProd) {
  CONFIG.APP_ENV = APP_ENV.PROD
} else if (isStaging) {
  CONFIG.APP_ENV = APP_ENV.STAGING
}

// This is only used for development builds, and it is not a secret, so it's fine to log it.
export const LEDGER_EMULATOR_HTTP_URL = process.env.LEDGER_EMULATOR_HTTP_URL

export default CONFIG
