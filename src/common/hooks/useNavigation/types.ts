import { Subject } from 'rxjs'

import { ROUTES } from '@common/modules/router/constants/common'

interface UseNavigationReturnTypeCommon {
  navigate: (to: string | number, options?: any) => void
  goBack: () => void
  searchParams: any
  setSearchParams: (params: any) => void
  setOptions: (options: { headerTitle?: string; [key: string]: any }) => void
  canGoBack: boolean
  dashGoBack: (routes?: typeof ROUTES) => void
}

export type UseNavigationReturnType = UseNavigationReturnTypeCommon

export type TitleChangeEventStreamType = Subject<string> | null
