import type {LinkingOptions} from '@react-navigation/native'

import {ROOT_TABS, type RootTabRouteName} from './routes'
import {WEB_DEV_SERVER_ORIGIN} from '@/constants/map'

/** Param list for the root bottom-tab navigator. */
export type RootTabParamList = Record<RootTabRouteName, undefined>

/** Resolves the web origin used for deep-link prefixes at runtime. */
function getWebPrefix(): string {
  if (typeof window !== 'undefined') {
    return window.location.origin
  }

  return WEB_DEV_SERVER_ORIGIN
}

/** Screen paths derived from root tab definitions. */
const rootTabScreens = Object.fromEntries(
  ROOT_TABS.map(tab => [tab.name, tab.path]),
) as LinkingOptions<RootTabParamList>['config'] extends {screens: infer Screens} ? Screens : never

/**
 * React Navigation linking config for web URL sync.
 * Maps `/`, `/dummy-1`, and `/settings` to root tab routes.
 */
export const linking: LinkingOptions<RootTabParamList> = {
  prefixes: [getWebPrefix()],
  config: {
    screens: rootTabScreens,
  },
}
