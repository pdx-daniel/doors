import type {LinkingOptions} from '@react-navigation/native'

import type {RootTabRouteName} from './routes'

/** Param list for the root bottom-tab navigator. */
export type RootTabParamList = Record<RootTabRouteName, undefined>

/** Resolves the web origin used for deep-link prefixes at runtime. */
function getWebPrefix(): string {
  if (typeof window !== 'undefined') {
    return window.location.origin
  }

  return 'http://localhost:3001'
}

/**
 * React Navigation linking config for web URL sync.
 * Maps `/`, `/dummy-1`, and `/settings` to root tab routes.
 */
export const linking: LinkingOptions<RootTabParamList> = {
  prefixes: [getWebPrefix()],
  config: {
    screens: {
      // Route keys must match RootNavigator screen names (PascalCase).
      // biome-ignore lint/style/useNamingConvention: React Navigation screen names
      Map: '',
      // biome-ignore lint/style/useNamingConvention: React Navigation screen names
      Dummy1: 'dummy-1',
      // biome-ignore lint/style/useNamingConvention: React Navigation screen names
      Settings: 'settings',
    },
  },
}
